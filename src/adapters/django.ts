import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, moduleName, readSources } from "./util.js";

// A `path("x", view)` / `re_path(r"^x$", view)` / legacy `url(r"^x$", view)`
// entry. The view head (dotted) is captured so an `include(...)` / admin mount
// can be told apart from a leaf route.
const ENTRY_RE = /\b(path|re_path|url)\(\s*r?["']([^"']*)["']\s*,\s*([\w.]+)/g;
// A mount: `path("blog/", include("blog.urls"))` -> prefix "blog/", module "blog.urls".
const INCLUDE_RE = /\b(?:path|re_path|url)\(\s*r?["']([^"']*)["']\s*,\s*include\(\s*["']([^"']*)["']/g;
// DRF: `router = DefaultRouter()`, `router.register(r"users", UserViewSet)`, and
// the mount `path("api/", include(router.urls))`.
const DRF_ROUTER_RE = /(\w+)\s*=\s*(?:routers\.)?(?:Default|Simple)Router\(/g;
const DRF_REGISTER_RE = /(\w+)\.register\(\s*r?["']([^"']*)["']/g;
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
 * Django routing: `urls.py` modules list `path("x", view)` / `re_path` / legacy
 * `url()` entries. App URLs mount into the project with
 * `path("blog/", include("blog.urls"))`, composed TRANSITIVELY so a route two
 * includes deep (`api/` → `v1/` → resource) gets its full prefix. DRF
 * `DefaultRouter`/`SimpleRouter` registrations expand to their list/detail
 * routes with HTTP methods. `admin.site.urls` is treated as a mounted sub-app,
 * not a leaf page.
 */
export const djangoAdapter: RouteAdapter = {
  id: "django",
  frameworks: ["Django"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const sources = readSources(files, repo, [".py"]);

    // 1. Include edges: childModule -> { parentModule, prefix }, then resolve the
    //    full mount prefix of each urls module transitively from the project root.
    const includeEdge = new Map<string, { parent: string; prefix: string }>();
    for (const [path, src] of sources) {
      if (!path.endsWith("urls.py")) continue;
      const parent = moduleName(path);
      for (const m of src.matchAll(INCLUDE_RE)) {
        const child = m[2] as string;
        if (!includeEdge.has(child)) includeEdge.set(child, { parent, prefix: m[1] as string });
      }
    }
    const fullPrefix = (mod: string, seen = new Set<string>()): string => {
      if (seen.has(mod)) return "";
      seen.add(mod);
      const e = includeEdge.get(mod);
      return e ? joinRoute(fullPrefix(e.parent, seen), e.prefix) : "";
    };

    const routes: RouteInfo[] = [];
    for (const [path, src] of sources) {
      if (!path.endsWith("urls.py")) continue;
      const prefix = fullPrefix(moduleName(path));

      // 2. Leaf routes (skip include mounts and the admin sub-app).
      for (const m of src.matchAll(ENTRY_RE)) {
        const view = m[3] as string;
        if (view === "include") continue; // a mount, handled above
        if (view.endsWith(".site.urls") || view === "admin") continue; // admin sub-app
        const raw = m[1] !== "path" ? cleanRegex(m[2] as string) : (m[2] as string);
        const route = joinRoute(prefix, raw);
        routes.push({ route, file: path, kind: isApiContext(src, route) ? "api" : "page" });
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
        const add = (route: string, method: string) =>
          routes.push({ route, file: path, kind: "api", method });
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
