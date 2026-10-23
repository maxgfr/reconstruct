import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, lineAt, parsePyCall, pyString, pythonImportAliases, readSources, resolvePythonModule, splitPyArgs, subModule } from "./util.js";

// A `path("x", view)` / `re_path(r"^x$", view)` / legacy `url(r"^x$", view)`
// entry. The view head (dotted) is captured so an `include(...)` / admin mount
// can be told apart from a leaf route.
const ENTRY_RE = /\b(path|re_path|url)\(\s*r?["']([^"']*)["']\s*,\s*([\w.]+)/g;
// A mount: `path("blog/", include(…))`. The include argument is parsed
// bracket-balanced: a dotted module string, a `("blog.urls", "blog")` tuple, or
// an imported urls module object.
const MOUNT_RE = /\b(path|re_path|url)\(\s*r?["']([^"']*)["']\s*,\s*include\s*\(/g;
// DRF: `router = DefaultRouter()`, `router.register(r"users", UserViewSet)`, and
// the mount `path("api/", include(router.urls))`.
const DRF_ROUTER_RE = /\b(\w+)\s*=\s*(?:routers\.)?(?:Default|Simple)Router\(/g;
const DRF_REGISTER_RE = /\b(\w+)\.register\(\s*r?["']([^"']*)["']/g;
const DRF_MOUNT_RE = /\b(?:path|re_path|url)\(\s*r?["']([^"']*)["']\s*,\s*include\(\s*(\w+)\.urls/g;

/** Strip `^`/`$` anchors and render `(?P<name>…)` named groups as `<name>`. */
function cleanRegex(pattern: string): string {
  return pattern
    .replace(/^\^/, "")
    .replace(/\$$/, "")
    .replace(/\(\?P<(\w+)>[^)]*\)/g, "<$1>");
}

/** An app whose views are REST (DRF) → its routes are `api`, not server `page`s. */
function isApiContext(src: string, route: string): boolean {
  return /rest_framework|ViewSet|APIView|JsonResponse|@api_view/.test(src) || /(^|\/)api(\/|$)/.test(route);
}

/**
 * The file an `include(<arg>)` argument names, from the including file `path`:
 * a module string, the first element of an `(module, app_name)` tuple, or a
 * module object (`from blog import urls as blog_urls`, `import blog.urls`).
 * A name imported FROM a urls module (`from blog.urls import urlpatterns`)
 * resolves to that module. Source roots / subfolders are resolved by
 * `resolvePythonModule`.
 */
function includeTarget(path: string, arg: string, aliases: Map<string, string>, sources: Map<string, string>): string | null {
  let expr = arg.trim();
  if (/^[([]/.test(expr)) expr = splitPyArgs(expr.slice(1, -1))[0] ?? "";
  const literal = pyString(expr);
  if (literal !== null) return resolvePythonModule(path, literal, sources);
  if (!/^[\w.]+$/.test(expr)) return null;
  const [head, ...rest] = expr.split(".") as [string, ...string[]];
  const alias = aliases.get(head);
  if (!alias) return resolvePythonModule(path, expr, sources);
  const [pkg, name] = alias.split("::") as [string, string];
  const sub = resolvePythonModule(path, [subModule(pkg, name), ...rest].join("."), sources);
  return sub ?? (rest.length ? null : resolvePythonModule(path, pkg, sources));
}

/**
 * Django routing: `urls.py` modules list `path("x", view)` / `re_path` / legacy
 * `url()` entries. App URLs mount into the project with
 * `path("blog/", include("blog.urls"))` (or a `(module, app_name)` tuple, or an
 * imported urls module), composed TRANSITIVELY so a route two includes deep
 * (`api/` → `v1/` → resource) gets its full prefix. Included modules are
 * resolved to files relative to the including one, so a project living in a
 * subfolder (`backend/mysite/urls.py` → `backend/blog/urls.py`) still composes.
 * DRF `DefaultRouter`/`SimpleRouter` registrations expand to their list/detail
 * routes with HTTP methods. `admin.site.urls` is treated as a mounted sub-app,
 * not a leaf page.
 */
export const djangoAdapter: RouteAdapter = {
  id: "django",
  frameworks: ["Django"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const sources = readSources(files, repo, [".py"]);

    // 1. Include edges: childFile -> { parentFile, prefix }, then resolve the
    //    full mount prefix of each URLconf transitively from the project root.
    //    URLconfs are the `urls.py` files plus every file mounting or mounted.
    const includeEdge = new Map<string, { parent: string; prefix: string }>();
    const urlFiles = new Set<string>();
    for (const [path, src] of sources) {
      if (path.endsWith("urls.py")) urlFiles.add(path);
      if (!src.includes("include")) continue;
      const aliases = pythonImportAliases(src);
      for (const m of src.matchAll(MOUNT_RE)) {
        const call = parsePyCall(src, (m.index ?? 0) + m[0].length - 1);
        const child = includeTarget(path, call.args[0] ?? call.kwargs.get("arg") ?? "", aliases, sources);
        if (!child || child === path) continue;
        urlFiles.add(path);
        urlFiles.add(child);
        const prefix = m[1] !== "path" ? cleanRegex(m[2] as string) : (m[2] as string);
        if (!includeEdge.has(child)) includeEdge.set(child, { parent: path, prefix });
      }
    }
    const fullPrefix = (file: string, seen = new Set<string>()): string => {
      if (seen.has(file)) return "";
      seen.add(file);
      const e = includeEdge.get(file);
      return e ? joinRoute(fullPrefix(e.parent, seen), e.prefix) : "";
    };

    const routes: RouteInfo[] = [];
    for (const [path, src] of sources) {
      if (!urlFiles.has(path)) continue;
      const prefix = fullPrefix(path);

      // 2. Leaf routes (skip include mounts and the admin sub-app).
      for (const m of src.matchAll(ENTRY_RE)) {
        const view = m[3] as string;
        if (view === "include") continue; // a mount, handled above
        if (view.endsWith(".site.urls") || view === "admin") continue; // admin sub-app
        const raw = m[1] !== "path" ? cleanRegex(m[2] as string) : (m[2] as string);
        const route = joinRoute(prefix, raw);
        routes.push({ route, file: path, line: lineAt(src, m.index ?? 0), kind: isApiContext(src, route) ? "api" : "page" });
      }

      // 3. DRF routers: expand each registration to list + detail routes.
      const routerVars = new Set([...src.matchAll(DRF_ROUTER_RE)].map((m) => m[1] as string));
      if (!routerVars.size) continue;
      const mountOf = new Map<string, string>();
      for (const m of src.matchAll(DRF_MOUNT_RE)) {
        if (routerVars.has(m[2] as string)) mountOf.set(m[2] as string, m[1] as string);
      }
      for (const m of src.matchAll(DRF_REGISTER_RE)) {
        const router = m[1] as string;
        if (!routerVars.has(router)) continue;
        const base = joinRoute(prefix, mountOf.get(router) ?? "", m[2] as string);
        const detail = joinRoute(base, "<pk>");
        const line = lineAt(src, m.index ?? 0);
        const add = (route: string, method: string) => routes.push({ route, file: path, line, kind: "api", method });
        add(base, "GET"); // list
        add(base, "POST"); // create
        add(detail, "GET"); // retrieve
        add(detail, "PUT"); // update
        add(detail, "PATCH"); // partial_update
        add(detail, "DELETE"); // destroy
      }
    }
    return routes;
  },
};
