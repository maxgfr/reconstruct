import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, readSources } from "./util.js";

const SRC_EXTS = [".js", ".ts", ".mjs", ".cjs"];
const APP_RE = /(?:const|let|var)\s+(\w+)\s*=\s*express\(\)/g;
const ROUTER_RE = /(?:const|let|var)\s+(\w+)\s*=\s*(?:express\.)?Router\(\)/g;
const REQUIRE_RE = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
const IMPORT_RE = /import\s+(\w+)\s+from\s+["'`](\.[^"'`]*)["'`]/g;
const USE_RE = /(\w+)\.use\(\s*["'`]([^"'`]*)["'`]\s*,\s*(\w+)/g;
const ROUTE_RE = /(\w+)\.(get|post|put|delete|patch|all)\(\s*["'`]([^"'`]*)["'`]/g;

function dirOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}

/** Resolve a relative import/require spec to a file present in `sources`. */
function resolveModule(fromFile: string, spec: string, sources: Map<string, string>): string | null {
  const segs: string[] = [];
  for (const s of `${dirOf(fromFile)}/${spec}`.split("/")) {
    if (s === "" || s === ".") continue;
    if (s === "..") segs.pop();
    else segs.push(s);
  }
  const base = segs.join("/");
  for (const cand of [base, ...SRC_EXTS.map((e) => base + e), ...SRC_EXTS.map((e) => `${base}/index${e}`)]) {
    if (sources.has(cand)) return cand;
  }
  return null;
}

function localVars(src: string, re: RegExp): Set<string> {
  return new Set([...src.matchAll(re)].map((m) => m[1] as string));
}

/**
 * Express routing: `app.<method>("/x")` are absolute; `router.<method>("/x")`
 * routes are prefixed by the `app.use("/mount", router)` that mounts the router
 * module — resolved across files via the `require`/`import` that names it.
 */
export const expressAdapter: RouteAdapter = {
  id: "express",
  frameworks: ["Express"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const sources = readSources(files, repo, SRC_EXTS);

    // Mount prefix per router *module*, from `app.use("/p", routerVar)` where the
    // var was required/imported from another file.
    const mountByFile = new Map<string, string>();
    for (const [path, src] of sources) {
      const moduleOf = new Map<string, string>();
      for (const m of src.matchAll(REQUIRE_RE)) moduleOf.set(m[1] as string, m[2] as string);
      for (const m of src.matchAll(IMPORT_RE)) moduleOf.set(m[1] as string, m[2] as string);
      for (const m of src.matchAll(USE_RE)) {
        const prefix = m[2] as string;
        const spec = moduleOf.get(m[3] as string);
        if (!spec) continue;
        const target = resolveModule(path, spec, sources);
        if (target) mountByFile.set(target, prefix);
      }
    }

    const routes: RouteInfo[] = [];
    for (const [path, src] of sources) {
      const appVars = localVars(src, APP_RE);
      const routerVars = localVars(src, ROUTER_RE);
      for (const m of src.matchAll(ROUTE_RE)) {
        const obj = m[1] as string;
        const routePath = m[3] as string;
        if (!appVars.has(obj) && !routerVars.has(obj)) continue;
        const prefix = routerVars.has(obj) ? (mountByFile.get(path) ?? "") : "";
        routes.push({ route: joinRoute(prefix, routePath), file: path, kind: "api" });
      }
    }
    return routes;
  },
};
