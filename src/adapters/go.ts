import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, readSources } from "./util.js";

// HTTP verbs as the router method, in both Gin/Echo (`GET`) and chi/Fiber
// (`Get`) capitalizations.
const METHODS = "GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|Get|Post|Put|Delete|Patch|Head|Options";
const ROUTE_RE = new RegExp(`(\\w+)\\.(?:${METHODS})\\(\\s*["\`]([^"\`]*)["\`]`, "g");
// A route group: `v1 := r.Group("/api/v1")`. Resolved transitively so nested
// groups (`admin := v1.Group("/admin")`) compose their full prefix.
const GROUP_RE = /(\w+)\s*:=\s*(\w+)\.Group\(\s*["`]([^"`]*)["`]/g;

/**
 * Go routing across the method-call frameworks (Gin, Echo, chi, Fiber): routes
 * are `<router>.GET("/path")` and prefixes come from `<child> := <parent>.Group(
 * "/seg")`. Each router method call is prefixed by its receiver's resolved group
 * chain. Group resolution is per-file (the idiomatic single-`main` wiring);
 * cross-file routers and chi's nested `Route(...)` closures fall back to the
 * literal path, which the candidate layer can still surface.
 */
export const goAdapter: RouteAdapter = {
  id: "go",
  frameworks: ["Gin", "Echo", "chi", "Fiber"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const routes: RouteInfo[] = [];

    for (const [path, src] of readSources(files, repo, [".go"])) {
      // var -> {parent, seg} for every `child := parent.Group("/seg")`.
      const groups = new Map<string, { parent: string; seg: string }>();
      for (const m of src.matchAll(GROUP_RE)) {
        groups.set(m[1] as string, { parent: m[2] as string, seg: m[3] as string });
      }
      const prefixOf = (v: string, seen = new Set<string>()): string => {
        const g = groups.get(v);
        if (!g || seen.has(v)) return "";
        seen.add(v);
        return joinRoute(prefixOf(g.parent, seen), g.seg);
      };

      for (const m of src.matchAll(ROUTE_RE)) {
        const recv = m[1] as string;
        const routePath = m[2] as string;
        // Only true route paths (`"/..."`). Skips client calls such as
        // `http.Get("https://...")`, whose argument is a URL, not a route.
        if (!routePath.startsWith("/")) continue;
        routes.push({ route: joinRoute(prefixOf(recv), routePath), file: path, kind: "api" });
      }
    }
    return routes;
  },
};
