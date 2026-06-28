import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, readSources } from "./util.js";

// HTTP verbs as a router method, in both Gin/Echo (`GET`) and chi/Fiber (`Get`)
// capitalizations, plus method-agnostic `Any`/`All`.
const VERB_TOKENS = "GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE|Get|Post|Put|Delete|Patch|Head|Options|Connect|Trace|Any|ANY|All";
const VERB_RE = new RegExp(`(\\w+)\\.(${VERB_TOKENS})\\(\\s*["\`]([^"\`]*)["\`]`, "g");
// Verb-as-argument forms: gin `r.Handle("GET","/p",h)`, echo `e.Add("GET","/p",h)`.
const HANDLE_VERB_RE = /(\w+)\.(?:Handle|Add)\(\s*["`](GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)["`]\s*,\s*["`]([^"`]*)["`]/g;
// net/http + gorilla: `mux.HandleFunc("/p", h)` / Go 1.22 `mux.HandleFunc("GET /p", h)`,
// optionally chained `.Methods("GET","POST")` (gorilla).
const HANDLEFUNC_RE = /(\w+)\.HandleFunc\(\s*["`]([^"`]*)["`][^;\n]*/g;
const METHODS_CHAIN_RE = /\.Methods\(\s*([^)]*)\)/;
// Assignment route group: `v1 := r.Group("/api/v1")`. Resolved transitively so
// nested groups (`admin := v1.Group("/admin")`) compose their full prefix.
const GROUP_RE = /(\w+)\s*:=\s*(\w+)\.Group\(\s*["`]([^"`]*)["`]/g;
// chi closure groups: `r.Route("/prefix", func(r chi.Router){ ... })` and the
// prefixing `r.Mount("/prefix", subRouter)`.
const ROUTE_OPEN_RE = /(\w+)\.Route\(\s*["`]([^"`]*)["`]\s*,\s*func/g;
const MOUNT_RE = /(\w+)\.Mount\(\s*["`]([^"`]*)["`]/g;
const STD_VERBS = /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/;

function methodOf(verb: string): string {
  const up = verb.toUpperCase();
  return up === "ANY" || up === "ALL" ? "*" : up;
}

/** Map each `{` index to its matching `}` index (best-effort, ignores strings). */
function braceMatch(src: string): Map<number, number> {
  const stack: number[] = [];
  const pairs = new Map<number, number>();
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "{") stack.push(i);
    else if (c === "}") {
      const open = stack.pop();
      if (open !== undefined) pairs.set(open, i);
    }
  }
  return pairs;
}

/**
 * Go routing across the method-call frameworks (Gin, Echo, chi, Fiber, gorilla/mux)
 * and the net/http standard library. Prefixes come from three constructs, all
 * composed: assignment groups (`v1 := r.Group("/api/v1")`, transitive), chi
 * closure groups (`r.Route("/prefix", func(r){ ... })` / `r.Mount`), and the
 * route's own path. The HTTP verb is preserved (incl. the verb-as-argument
 * `r.Handle("GET", …)` and net/http `mux.HandleFunc("GET /p", …)` forms).
 */
export const goAdapter: RouteAdapter = {
  id: "go",
  frameworks: ["Gin", "Echo", "chi", "Fiber", "Gorilla"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const routes: RouteInfo[] = [];

    for (const [path, src] of readSources(files, repo, [".go"])) {
      // 1. Assignment group chains: var -> {parent, seg}.
      const groups = new Map<string, { parent: string; seg: string }>();
      for (const m of src.matchAll(GROUP_RE)) {
        groups.set(m[1] as string, { parent: m[2] as string, seg: m[3] as string });
      }
      const groupPrefix = (v: string, seen = new Set<string>()): string => {
        const g = groups.get(v);
        if (!g || seen.has(v)) return "";
        seen.add(v);
        return joinRoute(groupPrefix(g.parent, seen), g.seg);
      };

      // 2. chi closure-group ranges: each `r.Route("/x", func…){ … }` contributes
      //    "/x" to every route declared inside its braces.
      const pairs = braceMatch(src);
      const opens = [...pairs.keys()].sort((a, b) => a - b);
      const ranges: { start: number; end: number; seg: string }[] = [];
      for (const m of src.matchAll(ROUTE_OPEN_RE)) {
        const at = m.index ?? 0;
        const open = opens.find((o) => o > at);
        if (open === undefined) continue;
        ranges.push({ start: open, end: pairs.get(open) as number, seg: m[2] as string });
      }
      const closurePrefix = (idx: number): string =>
        joinRoute(
          ...ranges
            .filter((r) => idx >= r.start && idx <= r.end)
            .sort((a, b) => a.start - b.start)
            .map((r) => r.seg),
        );

      const prefixAt = (recv: string, idx: number): string => joinRoute(closurePrefix(idx), groupPrefix(recv));

      // 3a. `<recv>.VERB("/path")` — Gin/Echo/chi/Fiber.
      for (const m of src.matchAll(VERB_RE)) {
        const routePath = m[3] as string;
        // Only true route paths; skips client calls like `http.Get("https://…")`.
        if (!routePath.startsWith("/")) continue;
        routes.push({
          route: joinRoute(prefixAt(m[1] as string, m.index ?? 0), routePath),
          file: path,
          kind: "api",
          method: methodOf(m[2] as string),
        });
      }

      // 3b. `<recv>.Handle("GET", "/path")` / echo `.Add("GET", …)`.
      for (const m of src.matchAll(HANDLE_VERB_RE)) {
        const routePath = m[3] as string;
        if (!routePath.startsWith("/")) continue;
        routes.push({
          route: joinRoute(prefixAt(m[1] as string, m.index ?? 0), routePath),
          file: path,
          kind: "api",
          method: methodOf(m[2] as string),
        });
      }

      // 3c. net/http + gorilla: `mux.HandleFunc("[VERB ]/path", …)[.Methods(…)]`.
      for (const m of src.matchAll(HANDLEFUNC_RE)) {
        const raw = m[2] as string;
        const verbInPattern = raw.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\/\S*)$/);
        const routePath = verbInPattern ? (verbInPattern[2] as string) : raw;
        if (!routePath.startsWith("/")) continue;
        const prefix = prefixAt(m[1] as string, m.index ?? 0);
        const chained = (m[0] as string).match(METHODS_CHAIN_RE);
        const methods = chained
          ? [...(chained[1] as string).matchAll(/["`]([A-Za-z]+)["`]/g)].map((v) => (v[1] as string).toUpperCase()).filter((v) => STD_VERBS.test(v))
          : [];
        const route = joinRoute(prefix, routePath);
        if (verbInPattern) {
          routes.push({ route, file: path, kind: "api", method: verbInPattern[1] as string });
        } else if (methods.length) {
          for (const v of methods) routes.push({ route, file: path, kind: "api", method: v });
        } else {
          routes.push({ route, file: path, kind: "api" });
        }
      }

      // 3d. `<recv>.Mount("/prefix", subRouter)` — surface the mount point itself.
      for (const m of src.matchAll(MOUNT_RE)) {
        const seg = m[2] as string;
        if (!seg.startsWith("/")) continue;
        routes.push({
          route: joinRoute(prefixAt(m[1] as string, m.index ?? 0), seg),
          file: path,
          kind: "api",
        });
      }
    }
    return routes;
  },
};
