import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, lineAt, matchOpenParen, moduleName, type PyCall, parsePyCall, pyMethods, pyString, pythonRefResolver, readSources } from "./util.js";

const METHODS = "get|post|put|delete|patch|options|head|api_route|websocket";
// Only the head is matched; the arguments are parsed bracket-balanced.
const DECORATOR_RE = new RegExp(`@(\\w+)\\.(${METHODS})\\s*\\(`, "g");
// `router = APIRouter(...)`, typed `router: APIRouter = …`, or `fastapi.APIRouter(...)`.
const ROUTER_DEF_RE = /\b(\w+)\s*(?::\s*[\w.]+\s*)?=\s*(?:[\w.]+\.)?APIRouter\s*\(/g;
// Receiver kept: nested `api.include_router(v2, prefix=…)` composes the parent.
const INCLUDE_RE = /\b(\w+)\.include_router\s*\(/g;

const prefixOf = (call: PyCall): string => pyString(call.kwargs.get("prefix")) ?? "";
const lastSeg = (mod: string): string => mod.split(".").pop() ?? mod;

/**
 * FastAPI routing: `@app.<method>("/x")` plus `APIRouter` routers whose final
 * path composes every mount prefix in the include chain with the router's own
 * `APIRouter(prefix=…)` and the decorator path. Mounts are resolved across files
 * via imports (relative, aliased, `src/`-rooted), support the `module.router`
 * attribute form, and compose transitively for nested `router.include_router(...)`.
 * A router included several times gets every mount's prefix. The HTTP method
 * (incl. `websocket` → `WS` and `api_route(methods=[…])`, GET by default) is
 * preserved.
 */
export const fastapiAdapter: RouteAdapter = {
  id: "fastapi",
  frameworks: ["FastAPI"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const sources = readSources(files, repo, [".py"]);

    // 1. Each router's own prefix, keyed by "path::var".
    const ownPrefix = new Map<string, string>();
    for (const [path, src] of sources) {
      for (const m of src.matchAll(ROUTER_DEF_RE)) {
        ownPrefix.set(`${path}::${m[1]}`, prefixOf(parsePyCall(src, matchOpenParen(m))));
      }
    }
    const routerKeys = [...ownPrefix.keys()];

    // An unresolvable `mod.router` falls back to a router named `router` in any
    // file whose module's last segment is `mod`.
    const bySegment = (expr: string): string | null => {
      const parts = expr.split(".");
      if (parts.length < 2) return null;
      const attr = parts.pop() as string;
      const mod = parts.pop() as string;
      return routerKeys.find((k) => k.endsWith(`::${attr}`) && lastSeg(moduleName(k.split("::")[0] as string)) === mod) ?? null;
    };

    // 2. Include edges: childKey -> every { receiverKey|null (app), mountPrefix }.
    //    A router included twice (`prefix="/v1"` and `prefix="/v2"`) serves its
    //    routes under both.
    const includeOf = new Map<string, { receiverKey: string | null; mountPrefix: string }[]>();
    const resolvers = new Map<string, (expr: string) => string | null>();
    for (const [path, src] of sources) {
      const resolve = pythonRefResolver(path, src, sources);
      resolvers.set(path, resolve);
      for (const m of src.matchAll(INCLUDE_RE)) {
        const call = parsePyCall(src, matchOpenParen(m));
        const expr = (call.args[0] ?? call.kwargs.get("router") ?? "").trim();
        if (!/^[\w.]+$/.test(expr)) continue;
        const resolved = resolve(expr);
        const childKey = resolved && ownPrefix.has(resolved) ? resolved : bySegment(expr);
        if (!childKey) continue;
        const receiverKey = resolve(m[1] as string);
        includeOf.set(childKey, [
          ...(includeOf.get(childKey) ?? []),
          { receiverKey: receiverKey && ownPrefix.has(receiverKey) ? receiverKey : null, mountPrefix: prefixOf(call) },
        ]);
      }
    }

    // Every full path prefix a router's own decorators get: each include chain
    // (parent prefixes + mount prefix) + own prefix. `seen` is the current
    // chain, so a cycle stops without hiding a sibling mount.
    const fullPrefixes = (key: string, seen: ReadonlySet<string> = new Set()): string[] => {
      if (seen.has(key)) return [""];
      const own = ownPrefix.get(key) ?? "";
      const incs = includeOf.get(key);
      if (!incs) return [own];
      const chain = new Set(seen).add(key);
      const out = new Set<string>();
      for (const inc of incs) {
        const parents = inc.receiverKey ? fullPrefixes(inc.receiverKey, chain) : [""];
        for (const parent of parents) out.add(joinRoute(parent, inc.mountPrefix, own));
      }
      return [...out];
    };

    // 3. Emit a route per decorator (one per HTTP method).
    const routes: RouteInfo[] = [];
    for (const [path, src] of sources) {
      const resolve = resolvers.get(path) as (expr: string) => string | null;
      for (const m of src.matchAll(DECORATOR_RE)) {
        const call = parsePyCall(src, matchOpenParen(m));
        const subPath = pyString(call.args[0] ?? call.kwargs.get("path"));
        if (subPath === null) continue;
        const decorator = m[2] as string;
        // A router decorated in another file than its definition resolves via imports.
        const key = resolve(m[1] as string);
        const prefixes = key && ownPrefix.has(key) ? fullPrefixes(key) : [""];
        const line = lineAt(src, m.index ?? 0);
        // `api_route` without `methods=` registers GET (Starlette's default).
        const listed = decorator === "api_route" ? pyMethods(call.kwargs.get("methods")) : [];
        const methods = decorator === "websocket" ? ["WS"] : decorator === "api_route" ? (listed.length ? listed : ["GET"]) : [decorator.toUpperCase()];
        for (const prefix of prefixes) {
          const route = joinRoute(prefix, subPath);
          for (const method of methods) routes.push({ route, file: path, line, kind: "api", method });
        }
      }
    }
    return routes;
  },
};
