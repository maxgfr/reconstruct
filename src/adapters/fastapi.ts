import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, lineAt, moduleName, type PyCall, parsePyCall, pyMethods, pyString, pythonRefResolver, readSources } from "./util.js";

const METHODS = "get|post|put|delete|patch|options|head|api_route|websocket";
// Only the head is matched; the arguments are parsed bracket-balanced.
const DECORATOR_RE = new RegExp(`@(\\w+)\\.(${METHODS})\\s*\\(`, "g");
// `router = APIRouter(...)`, typed `router: APIRouter = …`, or `fastapi.APIRouter(...)`.
const ROUTER_DEF_RE = /\b(\w+)\s*(?::\s*[\w.]+\s*)?=\s*(?:[\w.]+\.)?APIRouter\s*\(/g;
// Receiver kept: nested `api.include_router(v2, prefix=…)` composes the parent.
const INCLUDE_RE = /(\w+)\.include_router\s*\(/g;

const openParen = (m: RegExpMatchArray): number => (m.index ?? 0) + m[0].length - 1;
const prefixOf = (call: PyCall): string => pyString(call.kwargs.get("prefix")) ?? "";
const lastSeg = (mod: string): string => mod.split(".").pop() ?? mod;

/**
 * FastAPI routing: `@app.<method>("/x")` plus `APIRouter` routers whose final
 * path composes every mount prefix in the include chain with the router's own
 * `APIRouter(prefix=…)` and the decorator path. Mounts are resolved across files
 * via imports (relative, aliased, `src/`-rooted), support the `module.router`
 * attribute form, and compose transitively for nested `router.include_router(...)`.
 * The HTTP method (incl. `websocket` → `WS` and `api_route(methods=[…])`) is
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
        ownPrefix.set(`${path}::${m[1]}`, prefixOf(parsePyCall(src, openParen(m))));
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

    // 2. Include edges: childKey -> { receiverKey|null (app), mountPrefix }.
    const includeOf = new Map<string, { receiverKey: string | null; mountPrefix: string }>();
    const resolvers = new Map<string, (expr: string) => string | null>();
    for (const [path, src] of sources) {
      const resolve = pythonRefResolver(path, src, sources);
      resolvers.set(path, resolve);
      for (const m of src.matchAll(INCLUDE_RE)) {
        const call = parsePyCall(src, openParen(m));
        const expr = (call.args[0] ?? call.kwargs.get("router") ?? "").trim();
        if (!/^[\w.]+$/.test(expr)) continue;
        const resolved = resolve(expr);
        const childKey = resolved && ownPrefix.has(resolved) ? resolved : bySegment(expr);
        if (!childKey) continue;
        const receiverKey = resolve(m[1] as string);
        includeOf.set(childKey, {
          receiverKey: receiverKey && ownPrefix.has(receiverKey) ? receiverKey : null,
          mountPrefix: prefixOf(call),
        });
      }
    }

    // The full path prefix a router's own decorators get: parent chain + own prefix.
    const fullPrefix = (key: string, seen = new Set<string>()): string => {
      if (seen.has(key)) return "";
      seen.add(key);
      const own = ownPrefix.get(key) ?? "";
      const inc = includeOf.get(key);
      if (!inc) return own;
      const parent = inc.receiverKey ? fullPrefix(inc.receiverKey, seen) : "";
      return joinRoute(parent, inc.mountPrefix, own);
    };

    // 3. Emit a route per decorator (one per HTTP method).
    const routes: RouteInfo[] = [];
    for (const [path, src] of sources) {
      const resolve = resolvers.get(path) as (expr: string) => string | null;
      for (const m of src.matchAll(DECORATOR_RE)) {
        const call = parsePyCall(src, openParen(m));
        const subPath = pyString(call.args[0] ?? call.kwargs.get("path"));
        if (subPath === null) continue;
        const decorator = m[2] as string;
        // A router decorated in another file than its definition resolves via imports.
        const key = resolve(m[1] as string);
        const prefix = key && ownPrefix.has(key) ? fullPrefix(key) : "";
        const route = joinRoute(prefix, subPath);
        const line = lineAt(src, m.index ?? 0);
        const methods = decorator === "websocket" ? ["WS"] : decorator === "api_route" ? pyMethods(call.kwargs.get("methods")) : [decorator.toUpperCase()];
        if (methods.length) {
          for (const method of methods) routes.push({ route, file: path, line, kind: "api", method });
        } else {
          routes.push({ route, file: path, line, kind: "api" });
        }
      }
    }
    return routes;
  },
};
