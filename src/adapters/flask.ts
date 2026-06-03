import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, moduleName, pythonImportAliases, readSources } from "./util.js";

const HTTP_DECORATORS = "route|get|post|put|delete|patch|options|head";
const DECORATOR_RE = new RegExp(`@(\\w+)\\.(${HTTP_DECORATORS})\\(\\s*["']([^"']*)["']`, "g");
const BLUEPRINT_DEF_RE = /^\s*(\w+)\s*=\s*Blueprint\s*\(/gm;
const REGISTER_RE = /register_blueprint\(\s*(\w+)([^)]*)\)/g;

/** A `page` if the handler block renders a template, else an `api` endpoint. */
function routeKind(src: string, from: number): "page" | "api" {
  const next = src.slice(from + 1).search(/\n@\w+\.(route|get|post|put|delete|patch)/);
  const block = next === -1 ? src.slice(from) : src.slice(from, from + 1 + next);
  return /render_template\s*\(/.test(block) ? "page" : "api";
}

/**
 * Flask routing: `@app.route("/x")` / method shortcuts, plus `Blueprint` routes
 * resolved through their registered `url_prefix`. Blueprint registration and
 * definition usually live in different files, so prefixes are resolved across
 * the module graph via the import aliases (`from routes.users import bp as x`).
 */
export const flaskAdapter: RouteAdapter = {
  id: "flask",
  frameworks: ["Flask"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const sources = readSources(files, repo, [".py"]);

    // 1. Where is each blueprint variable defined? key = "module::var".
    const blueprintKeys = new Set<string>();
    const blueprintVarsByFile = new Map<string, Set<string>>();
    for (const [path, src] of sources) {
      const vars = new Set<string>();
      for (const m of src.matchAll(BLUEPRINT_DEF_RE)) vars.add(m[1] as string);
      if (vars.size) {
        blueprintVarsByFile.set(path, vars);
        for (const v of vars) blueprintKeys.add(`${moduleName(path)}::${v}`);
      }
    }

    // 2. Map each blueprint (by "module::name") to its registered url_prefix.
    const prefixByKey = new Map<string, string>();
    for (const [path, src] of sources) {
      const aliases = pythonImportAliases(src);
      for (const m of src.matchAll(REGISTER_RE)) {
        const registeredVar = m[1] as string;
        const prefixMatch = (m[2] as string).match(/url_prefix\s*=\s*["']([^"']*)["']/);
        const prefix = prefixMatch ? (prefixMatch[1] as string) : "";
        // Resolve the registered var to the blueprint's "module::name": either an
        // imported alias, or a blueprint defined locally in this same file.
        const key = aliases.get(registeredVar) ?? `${moduleName(path)}::${registeredVar}`;
        if (blueprintKeys.has(key)) prefixByKey.set(key, prefix);
      }
    }

    // 3. Emit a route per decorator, prefixing blueprint routes.
    const routes: RouteInfo[] = [];
    for (const [path, src] of sources) {
      const localBlueprints = blueprintVarsByFile.get(path) ?? new Set<string>();
      for (const m of src.matchAll(DECORATOR_RE)) {
        const obj = m[1] as string;
        const decoratorPath = m[3] as string;
        const isBlueprint = localBlueprints.has(obj);
        const prefix = isBlueprint ? (prefixByKey.get(`${moduleName(path)}::${obj}`) ?? "") : "";
        routes.push({
          route: joinRoute(prefix, decoratorPath),
          file: path,
          kind: routeKind(src, m.index ?? 0),
        });
      }
    }
    return routes;
  },
};
