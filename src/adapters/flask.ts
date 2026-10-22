import type { FileInfo, RouteInfo } from "../types.js";
import { type PyCall, parsePyCall, pyMethods, pyString, pythonRefResolver } from "./fastapi.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, lineAt, readSources } from "./util.js";

const HTTP_DECORATORS = "route|get|post|put|delete|patch|options|head";
// Only the heads are matched; the arguments are parsed bracket-balanced so a
// nested call (`defaults=dict(page=1)`) cannot hide a later `methods=[…]`.
const DECORATOR_RE = new RegExp(`@(\\w+)\\.(${HTTP_DECORATORS})\\s*\\(`, "g");
// `bp = Blueprint(...)`, typed `bp: Blueprint = …`, or `flask.Blueprint(...)`.
const BLUEPRINT_DEF_RE = /\b(\w+)\s*(?::\s*[\w.]+\s*)?=\s*(?:[\w.]+\.)?Blueprint\s*\(/g;
// `app.register_blueprint(bp, url_prefix=...)` — receiver kept so blueprints
// registered onto another blueprint (nested) compose the parent prefix.
const REGISTER_RE = /(\w+)\.register_blueprint\s*\(/g;
// Functional / class-based registration: `app.add_url_rule("/x", view_func=…, methods=[…])`.
const ADD_URL_RE = /(\w+)\.add_url_rule\s*\(/g;

const openParen = (m: RegExpMatchArray): number => (m.index ?? 0) + m[0].length - 1;
const urlPrefixOf = (call: PyCall): string => pyString(call.kwargs.get("url_prefix")) ?? "";
const kindOf = (block: string): "page" | "api" => (/render_template\s*\(/.test(block) ? "page" : "api");

/**
 * The `def` / `class` block whose header line starts at `start`: every
 * following line indented deeper (blank lines and a closing `)` / `]` of a
 * multi-line signature included).
 */
function blockAt(src: string, start: number): string {
  const lines = src.slice(start).split("\n");
  const indent = (lines[0] as string).match(/^[ \t]*/)?.[0].length ?? 0;
  let end = 1;
  for (; end < lines.length; end++) {
    const l = lines[end] as string;
    if (l.trim() && !/^[ \t]*[)\]]/.test(l) && (l.match(/^[ \t]*/)?.[0].length ?? 0) <= indent) break;
  }
  return lines.slice(0, end).join("\n");
}

/**
 * A `page` if the view decorated at `from` renders a template, else `api`. The
 * view is the first `def` after the decorator, so every decorator stacked on
 * one function gets the same kind.
 */
function decoratedKind(src: string, from: number): "page" | "api" {
  const def = src.slice(from).search(/^[ \t]*(?:async[ \t]+)?def[ \t]/m);
  return def === -1 ? "api" : kindOf(blockAt(src, from + def));
}

/** Kind of an `add_url_rule` view: its `def` / `as_view` class body when defined locally. */
function viewFuncKind(src: string, from: number, viewFunc: string | undefined): "page" | "api" {
  const cls = viewFunc?.match(/^(\w+)\.as_view\s*\(/)?.[1];
  const fn = viewFunc?.match(/^\w+$/)?.[0];
  const head = cls ? new RegExp(`^[ \\t]*class[ \\t]+${cls}\\b`, "m") : fn ? new RegExp(`^[ \\t]*(?:async[ \\t]+)?def[ \\t]+${fn}\\s*\\(`, "m") : null;
  const at = head ? src.search(head) : -1;
  if (at !== -1) return kindOf(blockAt(src, at));
  // Fallback: the code following the registration, up to the next route decorator.
  const next = src.slice(from + 1).search(/\n@\w+\.(route|get|post|put|delete|patch)/);
  return kindOf(next === -1 ? src.slice(from) : src.slice(from, from + 1 + next));
}

/**
 * Flask routing: `@app.route("/x")` / method shortcuts and `app.add_url_rule(...)`,
 * plus `Blueprint` routes resolved through their `url_prefix` — taken from the
 * `Blueprint(...)` constructor and/or the `register_blueprint(...)` call (the
 * registration prefix overrides the constructor's). Blueprints are resolved
 * across files through imports (relative, aliased, `module.bp` attribute) and
 * those registered onto another blueprint compose the parent's prefix
 * transitively. The HTTP method is preserved (shortcut decorator or `methods=[…]`).
 */
export const flaskAdapter: RouteAdapter = {
  id: "flask",
  frameworks: ["Flask"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const sources = readSources(files, repo, [".py"]);

    // 1. Blueprints keyed "path::var", with their constructor prefix.
    const ownPrefix = new Map<string, string>();
    for (const [path, src] of sources) {
      for (const m of src.matchAll(BLUEPRINT_DEF_RE)) {
        ownPrefix.set(`${path}::${m[1]}`, urlPrefixOf(parsePyCall(src, openParen(m))));
      }
    }

    // 2. Registrations: childKey -> { receiverKey, regPrefix }.
    const regOf = new Map<string, { receiverKey: string | null; regPrefix: string }>();
    const resolvers = new Map<string, (expr: string) => string | null>();
    for (const [path, src] of sources) {
      const resolve = pythonRefResolver(path, src, sources);
      resolvers.set(path, resolve);
      for (const m of src.matchAll(REGISTER_RE)) {
        const call = parsePyCall(src, openParen(m));
        const expr = (call.args[0] ?? call.kwargs.get("blueprint") ?? "").trim();
        if (!/^[\w.]+$/.test(expr)) continue;
        const childKey = resolve(expr);
        if (!childKey || !ownPrefix.has(childKey)) continue;
        regOf.set(childKey, { receiverKey: resolve(m[1] as string), regPrefix: urlPrefixOf(call) });
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
      if (reg.receiverKey && ownPrefix.has(reg.receiverKey)) {
        return joinRoute(effectivePrefix(reg.receiverKey, seen), childPrefix);
      }
      return childPrefix;
    };

    // 3. Emit routes from decorators and add_url_rule, prefixing blueprint routes.
    const routes: RouteInfo[] = [];
    for (const [path, src] of sources) {
      const resolve = resolvers.get(path) as (expr: string) => string | null;
      const prefixForObj = (obj: string): string => {
        const key = resolve(obj);
        return key && ownPrefix.has(key) ? effectivePrefix(key) : "";
      };

      for (const m of src.matchAll(DECORATOR_RE)) {
        const call = parsePyCall(src, openParen(m));
        const rule = pyString(call.args[0] ?? call.kwargs.get("rule"));
        if (rule === null) continue;
        const decorator = m[2] as string;
        const route = joinRoute(prefixForObj(m[1] as string), rule);
        const line = lineAt(src, m.index ?? 0);
        const kind = decoratedKind(src, m.index ?? 0);
        const methods = decorator === "route" ? pyMethods(call.kwargs.get("methods")) : [decorator.toUpperCase()];
        const verbs = methods.length ? methods : ["GET"]; // @route defaults to GET
        for (const method of verbs) routes.push({ route, file: path, line, kind, method });
      }

      for (const m of src.matchAll(ADD_URL_RE)) {
        const call = parsePyCall(src, openParen(m));
        const rule = pyString(call.args[0] ?? call.kwargs.get("rule"));
        if (rule === null) continue;
        const route = joinRoute(prefixForObj(m[1] as string), rule);
        const line = lineAt(src, m.index ?? 0);
        const kind = viewFuncKind(src, m.index ?? 0, (call.kwargs.get("view_func") ?? call.args[2])?.trim());
        const verbs = pyMethods(call.kwargs.get("methods"));
        for (const method of verbs.length ? verbs : ["GET"]) {
          routes.push({ route, file: path, line, kind, method });
        }
      }
    }
    return routes;
  },
};
