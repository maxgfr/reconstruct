import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, moduleName, pythonImportAliases, readSources } from "./util.js";

const METHODS = "get|post|put|delete|patch|options|head|api_route|websocket";
// Capture the path and trailing kwargs (so `api_route(methods=[…])` resolves).
const DECORATOR_RE = new RegExp(`@(\\w+)\\.(${METHODS})\\(\\s*["']([^"']*)["']([^)]*)\\)`, "g");
const ROUTER_DEF_RE = /(\w+)\s*=\s*APIRouter\(([^)]*)\)/g;
// Receiver + included expression captured: nested `api.include_router(v2, prefix=…)`
// and module-attribute `app.include_router(users.router, prefix=…)` forms.
const INCLUDE_RE = /(\w+)\.include_router\(\s*([\w.]+)([^)]*)\)/g;

function prefixArg(args: string): string {
  const m = args.match(/prefix\s*=\s*["']([^"']*)["']/);
  return m ? (m[1] as string) : "";
}

function methodsOf(args: string): string[] {
  const m = args.match(/methods\s*=\s*[[(]([^\])]*)[\])]/);
  if (!m) return [];
  return [...(m[1] as string).matchAll(/["']([A-Za-z]+)["']/g)].map((v) => (v[1] as string).toUpperCase());
}

const lastSeg = (mod: string): string => mod.split(".").pop() ?? mod;

/**
 * FastAPI routing: `@app.<method>("/x")` plus `APIRouter` routers whose final
 * path composes every mount prefix in the include chain with the router's own
 * `APIRouter(prefix=…)` and the decorator path. Mounts are resolved across files
 * via import aliases, support the `module.router` attribute form, and compose
 * transitively for nested `router.include_router(...)`. The HTTP method (incl.
 * `websocket` → `WS` and `api_route(methods=[…])`) is preserved.
 */
export const fastapiAdapter: RouteAdapter = {
  id: "fastapi",
  frameworks: ["FastAPI"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const sources = readSources(files, repo, [".py"]);

    // 1. Each router's own prefix, keyed by "module::var".
    const ownPrefix = new Map<string, string>();
    for (const [path, src] of sources) {
      for (const m of src.matchAll(ROUTER_DEF_RE)) {
        ownPrefix.set(`${moduleName(path)}::${m[1]}`, prefixArg(m[2] as string));
      }
    }
    const routerKeys = [...ownPrefix.keys()];

    // Resolve an include() argument to a router key. Bare var → import alias /
    // local def; `mod.attr` → the router named `attr` in submodule `mod`.
    const resolveRouter = (expr: string, fileModule: string, aliases: Map<string, string>): string | null => {
      if (expr.includes(".")) {
        const parts = expr.split(".");
        const attr = parts.pop() as string;
        const mod = parts.pop() as string;
        return routerKeys.find((k) => k.endsWith(`::${attr}`) && lastSeg(k.split("::")[0] as string) === mod) ?? null;
      }
      const key = aliases.get(expr) ?? `${fileModule}::${expr}`;
      return ownPrefix.has(key) ? key : null;
    };

    // 2. Include edges: childKey -> { receiverKey|null (app), mountPrefix }.
    const includeOf = new Map<string, { receiverKey: string | null; mountPrefix: string }>();
    for (const [path, src] of sources) {
      const fileModule = moduleName(path);
      const aliases = pythonImportAliases(src);
      for (const m of src.matchAll(INCLUDE_RE)) {
        const childKey = resolveRouter(m[2] as string, fileModule, aliases);
        if (!childKey) continue;
        const receiverVar = m[1] as string;
        const receiverKey = aliases.get(receiverVar) ?? `${fileModule}::${receiverVar}`;
        includeOf.set(childKey, {
          receiverKey: ownPrefix.has(receiverKey) ? receiverKey : null,
          mountPrefix: prefixArg(m[3] as string),
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
      const fileModule = moduleName(path);
      for (const m of src.matchAll(DECORATOR_RE)) {
        const obj = m[1] as string;
        const decorator = m[2] as string;
        const key = `${fileModule}::${obj}`;
        const prefix = ownPrefix.has(key) ? fullPrefix(key) : "";
        const route = joinRoute(prefix, m[3] as string);
        const methods = decorator === "websocket" ? ["WS"] : decorator === "api_route" ? methodsOf(m[4] as string) : [decorator.toUpperCase()];
        if (methods.length) {
          for (const method of methods) routes.push({ route, file: path, kind: "api", method });
        } else {
          routes.push({ route, file: path, kind: "api" });
        }
      }
    }
    return routes;
  },
};
