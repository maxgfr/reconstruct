import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, readSources } from "./util.js";

const SRC_EXTS = [".js", ".ts", ".mts", ".cts", ".mjs", ".cjs"];
const APP_RE = /(?:const|let|var)\s+(\w+)\s*=\s*express\(\)/g;
// `const r = express.Router()` / `Router()` / `require("express").Router()`.
const ROUTER_RE =
  /(?:const|let|var)\s+(\w+)\s*=\s*(?:express\.|require\(\s*["'`]express["'`]\s*\)\.)?Router\(\)/g;
const REQUIRE_RE = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
const IMPORT_RE = /import\s+(\w+)\s+from\s+["'`](\.[^"'`]*)["'`]/g;
const USE_RE = /(\w+)\.use\(\s*["'`]([^"'`]*)["'`]\s*,\s*(\w+)/g;
const ROUTE_RE = /(\w+)\.(get|post|put|delete|patch|all)\(\s*["'`]([^"'`]*)["'`]/g;
// `router.route("/x").get(h).post(h)` — match the path; the chained verbs are
// scanned from the rest of the statement (handler args can nest parens, so a
// balanced-paren capture is unreliable).
const ROUTE_CHAIN_RE = /(\w+)\.route\(\s*["'`]([^"'`]*)["'`]\s*\)/g;
const CHAIN_VERB_RE = /\.\s*(get|post|put|delete|patch|all)\s*\(/g;

function methodOf(verb: string): string {
  return verb.toLowerCase() === "all" ? "*" : verb.toUpperCase();
}

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
    // var was required/imported from another file; AND per local router var when
    // a router is defined and mounted in the SAME file (`const api =
    // express.Router(); app.use("/v1", api)`), keyed by "file::var".
    const mountByFile = new Map<string, string>();
    const mountByLocalVar = new Map<string, string>();
    for (const [path, src] of sources) {
      const localRouters = localVars(src, ROUTER_RE);
      const moduleOf = new Map<string, string>();
      for (const m of src.matchAll(REQUIRE_RE)) moduleOf.set(m[1] as string, m[2] as string);
      for (const m of src.matchAll(IMPORT_RE)) moduleOf.set(m[1] as string, m[2] as string);
      for (const m of src.matchAll(USE_RE)) {
        const prefix = m[2] as string;
        const usedVar = m[3] as string;
        const spec = moduleOf.get(usedVar);
        if (spec) {
          const target = resolveModule(path, spec, sources);
          if (target) mountByFile.set(target, prefix);
        } else if (localRouters.has(usedVar)) {
          // Same-file router mount: the prefix belongs to this var here.
          mountByLocalVar.set(`${path}::${usedVar}`, prefix);
        }
      }
    }

    const routes: RouteInfo[] = [];
    for (const [path, src] of sources) {
      const appVars = localVars(src, APP_RE);
      const routerVars = localVars(src, ROUTER_RE);
      // The prefix that applies to a route receiver in this file: a same-file
      // mount wins over the cross-file module mount; an `express()` app is absolute.
      const prefixFor = (obj: string): string => {
        if (appVars.has(obj)) return "";
        if (!routerVars.has(obj)) return "";
        return mountByLocalVar.get(`${path}::${obj}`) ?? mountByFile.get(path) ?? "";
      };
      const known = (obj: string) => appVars.has(obj) || routerVars.has(obj);

      for (const m of src.matchAll(ROUTE_RE)) {
        const obj = m[1] as string;
        if (!known(obj)) continue;
        routes.push({
          route: joinRoute(prefixFor(obj), m[3] as string),
          file: path,
          kind: "api",
          method: methodOf(m[2] as string),
        });
      }
      // `router.route("/x").get().post()` — one route per chained verb (or a
      // method-agnostic route when the chain declares no verb on this statement).
      for (const m of src.matchAll(ROUTE_CHAIN_RE)) {
        const obj = m[1] as string;
        if (!known(obj)) continue;
        const route = joinRoute(prefixFor(obj), m[2] as string);
        const start = (m.index ?? 0) + (m[0] as string).length;
        const lineEnd = src.indexOf("\n", start);
        const tail = src.slice(start, lineEnd === -1 ? start + 200 : lineEnd);
        const verbs = [...tail.matchAll(CHAIN_VERB_RE)].map((v) => v[1] as string);
        if (verbs.length) {
          for (const v of verbs) routes.push({ route, file: path, kind: "api", method: methodOf(v) });
        } else {
          routes.push({ route, file: path, kind: "api" });
        }
      }
    }
    return routes;
  },
};
