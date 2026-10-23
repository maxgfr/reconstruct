import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, lineAt, readSources } from "./util.js";

// HTTP verbs as a router method, in both Gin/Echo (`GET`) and chi/Fiber (`Get`)
// capitalizations, plus method-agnostic `Any`/`All`.
const VERB_TOKENS = "GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE|Get|Post|Put|Delete|Patch|Head|Options|Connect|Trace|Any|ANY|All";
const VERB_RE = new RegExp(`(\\w+)\\.(${VERB_TOKENS})\\(\\s*["\`]([^"\`]*)["\`]`, "g");
// Verb-as-argument forms: gin `r.Handle("GET","/p",h)`, echo `e.Add("GET","/p",h)`.
const HANDLE_VERB_RE = /\b(\w+)\.(?:Handle|Add)\(\s*["`](GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)["`]\s*,\s*["`]([^"`]*)["`]/g;
// net/http + gorilla: `mux.HandleFunc("/p", h)` / Go 1.22 `mux.HandleFunc("GET /p", h)`,
// optionally chained `.Methods("GET","POST")` (gorilla).
const HANDLEFUNC_RE = /\b(\w+)\.HandleFunc\(\s*["`]([^"`]*)["`][^;\n]*/g;
const METHODS_CHAIN_RE = /\.Methods\(\s*([^)]*)\)/;
// Assignment route group: `v1 := r.Group("/api/v1")`. Resolved transitively so
// nested groups (`admin := v1.Group("/admin")`) compose their full prefix.
const GROUP_RE = /\b(\w+)\s*:=\s*(\w+)\.Group\(\s*["`]([^"`]*)["`]/g;
// chi closure groups: `r.Route("/prefix", func(r chi.Router){ ... })` and the
// prefixing `r.Mount("/prefix", subRouter)`.
const ROUTE_OPEN_RE = /\b(\w+)\.Route\(\s*["`]([^"`]*)["`]\s*,\s*func/g;
const MOUNT_RE = /\b(\w+)\.Mount\(\s*["`]([^"`]*)["`]/g;
const STD_VERBS = /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/;

// --- Router receivers --------------------------------------------------------
// `r.Get("/x")` is a route only when `r` is a router: an HTTP client's
// `client.Get("/api/remote")` has the very same shape.
const ROUTER_TYPE =
  "(?:chi\\.(?:Router|Mux)|gin\\.(?:Engine|RouterGroup|IRouter|IRoutes)|echo\\.(?:Echo|Group)|fiber\\.(?:App|Router)|mux\\.Router|http\\.ServeMux|httprouter\\.Router)\\b";
// Typed declarations: params `r chi.Router`, fields `router *gin.Engine`, `var e *echo.Echo`.
const TYPED_ROUTER_RE = new RegExp(`\\b(\\w+)\\s+\\*?${ROUTER_TYPE}`, "g");
// Constructors: `r := chi.NewRouter()`, `e = echo.New()`, `app := fiber.New(…)`.
const CTOR_ROUTER_RE = /\b(\w+)\s*:?=\s*&?(?:\w+\.(?:NewRouter|NewMux|NewServeMux)|gin\.(?:Default|New)|echo\.New|fiber\.New|httprouter\.New)\(/g;
// Derived routers: `api := r.Group(…)`, `sub := r.Route(…)`, `auth := r.With(mw)`.
const DERIVED_ROUTER_RE = /\b(\w+)\s*:?=\s*\w+\.(?:Group|Route|With)\(/g;
// `resp, err := ` right before a call: a (value, error) result, i.e. a client call.
const MULTI_ASSIGN_BEFORE_RE = /\w+\s*,\s*\w+\s*:?=\s*$/;
// Functions returning a router: `func setupRouter() *gin.Engine {`.
const ROUTER_FUNC_RE = new RegExp(`\\bfunc\\s+(?:\\([^)]*\\)\\s*)?(\\w+)\\s*\\([^)]*\\)\\s*\\(?\\s*\\*?${ROUTER_TYPE}`, "g");

function methodOf(verb: string): string {
  const up = verb.toUpperCase();
  return up === "ANY" || up === "ALL" ? "*" : up;
}

/**
 * Map each `{` index to its matching `}` index. Braces inside string, rune and
 * raw-string literals are skipped — a chi pattern like `"/{articleID}"` must
 * not shift the pairing (comments are already blanked by readSources).
 */
function braceMatch(src: string): Map<number, number> {
  const stack: number[] = [];
  const pairs = new Map<number, number>();
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      i = j;
    } else if (c === "`") {
      const end = src.indexOf("`", i + 1);
      i = end === -1 ? src.length : end;
    } else if (c === "{") stack.push(i);
    else if (c === "}") {
      const open = stack.pop();
      if (open !== undefined) pairs.set(open, i);
    }
  }
  return pairs;
}

/**
 * Top-level `func` bodies as [start, end] brace ranges: the scope a route
 * group variable lives in, so `v1` reused in two functions keeps both.
 */
function funcScopes(src: string, pairs: Map<number, number>): { start: number; end: number }[] {
  const scopes: { start: number; end: number }[] = [];
  for (const m of src.matchAll(/^func\b/gm)) {
    // The body brace is the first `{` outside the signature's parens that is
    // not an inline `interface{}` / `struct{}` type.
    let depth = 0;
    for (let i = (m.index ?? 0) + 4; i < src.length; i++) {
      const c = src[i];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      else if (c === "{" && depth === 0) {
        if (/(?:interface|struct)\s*$/.test(src.slice(Math.max(0, i - 12), i))) {
          i = pairs.get(i) ?? i;
          continue;
        }
        const end = pairs.get(i);
        if (end !== undefined) scopes.push({ start: i, end });
        break;
      }
    }
  }
  return scopes;
}

/**
 * Go routing across the method-call frameworks (Gin, Echo, chi, Fiber, gorilla/mux)
 * and the net/http standard library. Prefixes come from three constructs, all
 * composed: assignment groups (`v1 := r.Group("/api/v1")`, transitive, scoped to
 * the enclosing function), chi closure groups (`r.Route("/prefix", func(r){ ... })`
 * / `r.Mount`), and the route's own path. The HTTP verb is preserved (incl. the
 * verb-as-argument `r.Handle("GET", …)` and net/http `mux.HandleFunc("GET /p", …)`
 * forms). A `<recv>.Get("/x")` call counts only when `recv` is a known router, so
 * HTTP client calls (`client.Get("/api/remote")`, `http.Get(url)`) are skipped.
 */
export const goAdapter: RouteAdapter = {
  id: "go",
  frameworks: ["Gin", "Echo", "chi", "Fiber", "Gorilla"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const routes: RouteInfo[] = [];
    const sources = readSources(files, repo, [".go"]);

    // Router evidence that crosses files within a package: struct fields
    // (`s.router.GET`) and router-returning constructors declared elsewhere.
    const sharedRouters = new Set<string>();
    const routerFuncs = new Set<string>();
    for (const src of sources.values()) {
      for (const m of src.matchAll(TYPED_ROUTER_RE)) sharedRouters.add(m[1] as string);
      for (const m of src.matchAll(ROUTER_FUNC_RE)) routerFuncs.add(m[1] as string);
    }
    const routerFuncCall = routerFuncs.size ? new RegExp(`\\b(\\w+)\\s*:?=\\s*(?:\\w+\\.)?(?:${[...routerFuncs].join("|")})\\(`, "g") : null;

    for (const [path, src] of sources) {
      const routers = new Set(sharedRouters);
      for (const re of [CTOR_ROUTER_RE, DERIVED_ROUTER_RE, ...(routerFuncCall ? [routerFuncCall] : [])]) {
        for (const m of src.matchAll(re)) routers.add(m[1] as string);
      }

      const pairs = braceMatch(src);
      const scopes = funcScopes(src, pairs);
      // Innermost-first is unnecessary: top-level funcs never overlap. -1 = package level.
      const scopeAt = (idx: number): number => scopes.find((s) => idx > s.start && idx < s.end)?.start ?? -1;

      // 1. Assignment group chains, keyed by scope + var: "scope:var" -> {parent, seg}.
      const groups = new Map<string, { parent: string; seg: string; scope: number }>();
      for (const m of src.matchAll(GROUP_RE)) {
        const scope = scopeAt(m.index ?? 0);
        groups.set(`${scope}:${m[1] as string}`, { parent: m[2] as string, seg: m[3] as string, scope });
      }
      const groupPrefix = (v: string, scope: number, seen = new Set<string>()): string => {
        const key = groups.has(`${scope}:${v}`) ? `${scope}:${v}` : `-1:${v}`;
        const g = groups.get(key);
        if (!g || seen.has(key)) return "";
        seen.add(key);
        return joinRoute(groupPrefix(g.parent, g.scope, seen), g.seg);
      };

      // 2. chi closure-group ranges: each `r.Route("/x", func…){ … }` contributes
      //    "/x" to every route declared inside its braces.
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

      const prefixAt = (recv: string, idx: number): string => joinRoute(closurePrefix(idx), groupPrefix(recv, scopeAt(idx)));
      const at = (idx: number) => ({ file: path, line: lineAt(src, idx) });

      // 3a. `<recv>.VERB("/path")` — Gin/Echo/chi/Fiber, on a known router only.
      for (const m of src.matchAll(VERB_RE)) {
        const routePath = m[3] as string;
        // Only true route paths; skips client calls like `http.Get("https://…")`.
        if (!routePath.startsWith("/")) continue;
        if (!routers.has(m[1] as string)) continue;
        // `resp, err := x.Get("/p")` is a client call whatever `x` is named:
        // route registrations never return a (value, error) pair.
        if (MULTI_ASSIGN_BEFORE_RE.test(src.slice(Math.max(0, (m.index ?? 0) - 80), m.index ?? 0))) continue;
        routes.push({
          route: joinRoute(prefixAt(m[1] as string, m.index ?? 0), routePath),
          ...at(m.index ?? 0),
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
          ...at(m.index ?? 0),
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
        const loc = at(m.index ?? 0);
        if (verbInPattern) {
          routes.push({ route, ...loc, kind: "api", method: verbInPattern[1] as string });
        } else if (methods.length) {
          for (const v of methods) routes.push({ route, ...loc, kind: "api", method: v });
        } else {
          routes.push({ route, ...loc, kind: "api" });
        }
      }

      // 3d. `<recv>.Mount("/prefix", subRouter)` — surface the mount point itself.
      for (const m of src.matchAll(MOUNT_RE)) {
        const seg = m[2] as string;
        if (!seg.startsWith("/")) continue;
        routes.push({
          route: joinRoute(prefixAt(m[1] as string, m.index ?? 0), seg),
          ...at(m.index ?? 0),
          kind: "api",
        });
      }
    }
    return routes;
  },
};
