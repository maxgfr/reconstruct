import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, moduleName, pythonImportAliases, readSources } from "./util.js";

const METHODS = "get|post|put|delete|patch|options|head|api_route";
const DECORATOR_RE = new RegExp(`@(\\w+)\\.(${METHODS})\\(\\s*["']([^"']*)["']`, "g");
const ROUTER_DEF_RE = /(\w+)\s*=\s*APIRouter\(([^)]*)\)/g;
const INCLUDE_RE = /\.include_router\(\s*(\w+)([^)]*)\)/g;

function prefixArg(args: string): string {
  const m = args.match(/prefix\s*=\s*["']([^"']*)["']/);
  return m ? (m[1] as string) : "";
}

/**
 * FastAPI routing: `@app.<method>("/x")` plus `APIRouter` routers whose final
 * path is `include_router(prefix) + APIRouter(prefix) + decorator path`. The
 * include usually lives in a different file from the router definition, so the
 * mount prefix is resolved across modules through the import aliases.
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

    // 2. Each router's mount prefix from include_router(router, prefix=...).
    const mountPrefix = new Map<string, string>();
    for (const [path, src] of sources) {
      const aliases = pythonImportAliases(src);
      for (const m of src.matchAll(INCLUDE_RE)) {
        const includedVar = m[1] as string;
        const key = aliases.get(includedVar) ?? `${moduleName(path)}::${includedVar}`;
        mountPrefix.set(key, prefixArg(m[2] as string));
      }
    }

    // 3. Emit a route per decorator, composing mount + own + path for routers.
    const routes: RouteInfo[] = [];
    for (const [path, src] of sources) {
      for (const m of src.matchAll(DECORATOR_RE)) {
        const obj = m[1] as string;
        const decoratorPath = m[3] as string;
        const key = `${moduleName(path)}::${obj}`;
        const isRouter = ownPrefix.has(key);
        const route = isRouter
          ? joinRoute(mountPrefix.get(key) ?? "", ownPrefix.get(key) ?? "", decoratorPath)
          : joinRoute(decoratorPath);
        routes.push({ route, file: path, kind: "api" });
      }
    }
    return routes;
  },
};
