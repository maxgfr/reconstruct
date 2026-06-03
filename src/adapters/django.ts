import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, moduleName, readSources } from "./util.js";

// A `path("x", view)` / `re_path(r"^x$", view)` entry. The view head is captured
// so an `include(...)` mount can be told apart from a leaf route.
const ENTRY_RE = /\b(path|re_path)\(\s*r?["']([^"']*)["']\s*,\s*(\w+)/g;
// A mount: `path("blog/", include("blog.urls"))` -> prefix "blog/", module "blog.urls".
const INCLUDE_RE = /\b(?:path|re_path)\(\s*r?["']([^"']*)["']\s*,\s*include\(\s*["']([^"']*)["']/g;

/** Strip `^`/`$` anchors from a `re_path` pattern so it reads as a plain route. */
function cleanRegex(pattern: string): string {
  return pattern.replace(/^\^/, "").replace(/\$$/, "");
}

/**
 * Django routing: `urls.py` modules list `path("x", view)` / `re_path(...)`
 * entries. An app's URLs are mounted into the project with
 * `path("blog/", include("blog.urls"))`, so the leaf routes in `blog/urls.py`
 * are prefixed by that mount. The include usually lives in a different file from
 * the included `urls.py`, so the prefix is resolved across modules by matching
 * the included dotted module (`blog.urls`) to the file (`blog/urls.py`).
 */
export const djangoAdapter: RouteAdapter = {
  id: "django",
  frameworks: ["Django"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const sources = readSources(files, repo, [".py"]);

    // 1. Map each included module ("blog.urls") to its mount prefix ("blog/"),
    //    collected across every urls.py.
    const prefixByModule = new Map<string, string>();
    for (const [path, src] of sources) {
      if (!path.endsWith("urls.py")) continue;
      for (const m of src.matchAll(INCLUDE_RE)) {
        prefixByModule.set(m[2] as string, m[1] as string);
      }
    }

    // 2. Emit one route per leaf entry, prefixing by the file's mount (if any).
    const routes: RouteInfo[] = [];
    for (const [path, src] of sources) {
      if (!path.endsWith("urls.py")) continue;
      const prefix = prefixByModule.get(moduleName(path)) ?? "";
      for (const m of src.matchAll(ENTRY_RE)) {
        if ((m[3] as string) === "include") continue; // a mount, not a leaf route
        const raw = m[1] === "re_path" ? cleanRegex(m[2] as string) : (m[2] as string);
        routes.push({ route: joinRoute(prefix, raw), file: path, kind: "page" });
      }
    }
    return routes;
  },
};
