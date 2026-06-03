import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, moduleName, pythonImportAliases, readSources } from "./util.js";

const HTTP_DECORATORS = "route|get|post|put|delete|patch|options|head";
// Capture the path AND the trailing kwargs so `methods=[...]` can be read.
const DECORATOR_RE = new RegExp(
  `@(\\w+)\\.(${HTTP_DECORATORS})\\(\\s*["']([^"']*)["']([^)]*)\\)`,
  "g",
);
// Capture the Blueprint constructor args so a `url_prefix=` set there is honored.
const BLUEPRINT_DEF_RE = /(\w+)\s*=\s*Blueprint\s*\(([^)]*)\)/g;
// `app.register_blueprint(bp, url_prefix=...)` — receiver kept so blueprints
// registered onto another blueprint (nested) compose the parent prefix.
const REGISTER_RE = /(\w+)\.register_blueprint\(\s*(\w+)([^)]*)\)/g;
// Functional / class-based registration: `app.add_url_rule("/x", view_func=…, methods=[…])`.
const ADD_URL_RE = /(\w+)\.add_url_rule\(\s*["']([^"']*)["']([^)]*)\)/g;

function urlPrefixOf(args: string): string {
  const m = args.match(/url_prefix\s*=\s*["']([^"']*)["']/);
  return m ? (m[1] as string) : "";
}

/** HTTP methods declared via `methods=["GET","POST"]`, uppercased. */
function methodsOf(args: string): string[] {
  const m = args.match(/methods\s*=\s*[[(]([^\])]*)[\])]/);
  if (!m) return [];
  return [...(m[1] as string).matchAll(/["']([A-Za-z]+)["']/g)].map((v) =>
    (v[1] as string).toUpperCase(),
  );
}

/** A `page` if the handler block renders a template, else an `api` endpoint. */
function routeKind(src: string, from: number): "page" | "api" {
  const next = src.slice(from + 1).search(/\n@\w+\.(route|get|post|put|delete|patch)/);
  const block = next === -1 ? src.slice(from) : src.slice(from, from + 1 + next);
  return /render_template\s*\(/.test(block) ? "page" : "api";
}

/**
 * Flask routing: `@app.route("/x")` / method shortcuts and `app.add_url_rule(...)`,
 * plus `Blueprint` routes resolved through their `url_prefix` — taken from the
 * `Blueprint(...)` constructor and/or the `register_blueprint(...)` call (the
 * registration prefix overrides the constructor's). Blueprints registered onto
 * another blueprint compose the parent's prefix transitively. The HTTP method is
 * preserved (shortcut decorator or `methods=[…]`).
 */
export const flaskAdapter: RouteAdapter = {
  id: "flask",
  frameworks: ["Flask"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const sources = readSources(files, repo, [".py"]);

    // 1. Blueprint vars per file, their keys ("module::var"), and constructor prefix.
    const blueprintKeys = new Set<string>();
    const blueprintVarsByFile = new Map<string, Set<string>>();
    const ownPrefix = new Map<string, string>();
    for (const [path, src] of sources) {
      const vars = new Set<string>();
      for (const m of src.matchAll(BLUEPRINT_DEF_RE)) {
        const v = m[1] as string;
        vars.add(v);
        const key = `${moduleName(path)}::${v}`;
        blueprintKeys.add(key);
        ownPrefix.set(key, urlPrefixOf(m[2] as string));
      }
      if (vars.size) blueprintVarsByFile.set(path, vars);
    }

    // 2. Registrations: childKey -> { receiverKey, regPrefix }.
    const regOf = new Map<string, { receiverKey: string; regPrefix: string }>();
    for (const [path, src] of sources) {
      const aliases = pythonImportAliases(src);
      const keyFor = (v: string) => aliases.get(v) ?? `${moduleName(path)}::${v}`;
      for (const m of src.matchAll(REGISTER_RE)) {
        const childKey = keyFor(m[2] as string);
        if (!blueprintKeys.has(childKey)) continue;
        regOf.set(childKey, {
          receiverKey: keyFor(m[1] as string),
          regPrefix: urlPrefixOf(m[3] as string),
        });
      }
    }

    // The full mount prefix for a blueprint key: registration prefix overrides the
    // constructor's; a blueprint registered onto another inherits the parent's.
    const effectivePrefix = (key: string, seen = new Set<string>()): string => {
      if (seen.has(key)) return "";
      seen.add(key);
      const own = ownPrefix.get(key) ?? "";
      const reg = regOf.get(key);
      if (!reg) return own;
      const childPrefix = reg.regPrefix || own;
      if (blueprintKeys.has(reg.receiverKey)) {
        return joinRoute(effectivePrefix(reg.receiverKey, seen), childPrefix);
      }
      return childPrefix;
    };

    // 3. Emit routes from decorators and add_url_rule, prefixing blueprint routes.
    const routes: RouteInfo[] = [];
    for (const [path, src] of sources) {
      const localBlueprints = blueprintVarsByFile.get(path) ?? new Set<string>();
      const prefixForObj = (obj: string): string =>
        localBlueprints.has(obj) ? effectivePrefix(`${moduleName(path)}::${obj}`) : "";

      for (const m of src.matchAll(DECORATOR_RE)) {
        const obj = m[1] as string;
        const decorator = m[2] as string;
        const route = joinRoute(prefixForObj(obj), m[3] as string);
        const kind = routeKind(src, m.index ?? 0);
        const methods =
          decorator === "route" ? methodsOf(m[4] as string) : [decorator.toUpperCase()];
        const verbs = methods.length ? methods : ["GET"]; // @route defaults to GET
        for (const method of verbs) routes.push({ route, file: path, kind, method });
      }

      for (const m of src.matchAll(ADD_URL_RE)) {
        const route = joinRoute(prefixForObj(m[1] as string), m[2] as string);
        const kind = routeKind(src, m.index ?? 0);
        const verbs = methodsOf(m[3] as string);
        for (const method of verbs.length ? verbs : ["GET"]) {
          routes.push({ route, file: path, kind, method });
        }
      }
    }
    return routes;
  },
};
