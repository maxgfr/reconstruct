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
// the `http.Handler` form `mux.Handle("/p", h)`, optionally chained
// `.Methods("GET","POST")` (gorilla). A verb-first `r.Handle("GET", "/p")` has
// no leading `/` and is left to HANDLE_VERB_RE.
const HANDLEFUNC_RE = /\b(\w+)\.(?:HandleFunc|Handle)\(\s*["`]([^"`]*)["`][^;\n]*/g;
const METHODS_CHAIN_RE = /\.Methods\(\s*([^)]*)\)/;
// Assignment route group: `v1 := r.Group("/api/v1")` (or `api = r.Group(…)` on a
// pre-declared var), and the gorilla subrouter `s := r.PathPrefix("/api").Subrouter()`.
// Resolved transitively so nested groups (`admin := v1.Group("/admin")`)
// compose their full prefix.
const GROUP_RE = /\b(\w+)\s*:?=\s*(\w+)\.(?:Group\(\s*["`]([^"`]*)["`]|PathPrefix\(\s*["`]([^"`]*)["`]\s*\)\s*\.Subrouter\(\s*\))/g;
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
// Derived routers: `api := r.Group(…)`, `sub := r.Route(…)`, `auth := r.With(mw)`,
// gorilla `s := r.PathPrefix(…).Subrouter()`.
const DERIVED_ROUTER_RE = /\b(\w+)\s*:?=\s*\w+\.(?:Group|Route|With|PathPrefix)\(/g;
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

/** A top-level `func` declaration: its body range plus what the header names. */
interface FuncDecl {
  start: number;
  end: number;
  /** Function name; `null` for a method (receiver): methods are never bound to call sites. */
  name: string | null;
  /** Offset of the name in the source, to skip the declaration when counting uses. */
  nameAt: number;
  /** Parameter list text, between the signature's parens. */
  params: string;
}

// `func name(` / `func (s *Server) name(` / generic `func name[T any](`, sticky
// at a line-leading `func` keyword.
const FUNC_HEAD_RE = /func\s*(\([^)]*\)\s*)?(\w+)\s*(?:\[[^\]]*\]\s*)?\(/y;

/**
 * Top-level `func` bodies as [start, end] brace ranges: the scope a route
 * group variable lives in, so `v1` reused in two functions keeps both.
 */
function funcScopes(src: string, pairs: Map<number, number>): FuncDecl[] {
  const scopes: FuncDecl[] = [];
  for (const m of src.matchAll(/^func\b/gm)) {
    const at = m.index ?? 0;
    FUNC_HEAD_RE.lastIndex = at;
    const head = FUNC_HEAD_RE.exec(src);
    let name: string | null = null;
    let nameAt = -1;
    let params = "";
    if (head) {
      name = head[1] ? null : (head[2] as string);
      const open = at + head[0].length - 1;
      nameAt = at + head[0].lastIndexOf(head[2] as string, open - at);
      let parens = 0;
      let close = open;
      for (; close < src.length; close++) {
        if (src[close] === "(") parens++;
        else if (src[close] === ")" && --parens === 0) break;
      }
      params = src.slice(open + 1, close);
    }
    // The body brace is the first `{` outside the signature's parens that is
    // not an inline `interface{}` / `struct{}` type.
    let depth = 0;
    for (let i = at + 4; i < src.length; i++) {
      const c = src[i];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      else if (c === "{" && depth === 0) {
        if (/(?:interface|struct)\s*$/.test(src.slice(Math.max(0, i - 12), i))) {
          i = pairs.get(i) ?? i;
          continue;
        }
        const end = pairs.get(i);
        if (end !== undefined) scopes.push({ start: i, end, name, nameAt, params });
        break;
      }
    }
  }
  return scopes;
}

const ROUTER_PARAM_TYPE_RE = new RegExp(`^\\*?${ROUTER_TYPE}`);

/**
 * Router-typed parameters of a parameter list, as name -> position. Handles the
 * shared-type form `a, b *gin.RouterGroup` (each bare name takes the next type).
 */
function routerParams(params: string): Map<string, number> {
  const out = new Map<string, number>();
  const pending: number[] = [];
  const names: string[] = [];
  params.split(",").forEach((raw, pos) => {
    const part = raw.trim();
    const typed = part.match(/^(\w+)\s+(\S.*)$/);
    if (!typed) {
      names[pos] = part;
      pending.push(pos);
      return;
    }
    names[pos] = typed[1] as string;
    if (ROUTER_PARAM_TYPE_RE.test(typed[2] as string)) for (const p of [...pending, pos]) out.set(names[p] as string, p);
    pending.length = 0;
  });
  return out;
}

/** Top-level, comma-separated argument texts of the call whose `(` is at `open`. */
function callArgs(src: string, open: number): string[] {
  const args: string[] = [];
  let depth = 0;
  let from = open + 1;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "`") {
      const close = src.indexOf(c, i + 1);
      i = close === -1 ? src.length : close;
    } else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (--depth === 0) {
        args.push(src.slice(from, i).trim());
        break;
      }
    } else if (c === "," && depth === 1) {
      args.push(src.slice(from, i).trim());
      from = i + 1;
    }
  }
  return args;
}

/** `src` with string, rune and raw-string literal contents blanked (offsets kept). */
const blankLiterals = (src: string): string => src.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`[^`]*`/g, (lit) => lit.replace(/[^\n]/g, " "));

const dirOf = (path: string): string => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");

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

    // Pass 1 — per-file context: routers, function scopes, assignment groups and
    // chi closure ranges.
    interface Ctx {
      path: string;
      src: string;
      /** `src` with literals blanked: identifier uses are counted here. */
      code: string;
      routers: Set<string>;
      scopes: FuncDecl[];
      scopeAt: (idx: number) => number;
      groups: Map<string, { parent: string; seg: string; scope: number }>;
      closurePrefix: (idx: number) => string;
    }
    const ctxs: Ctx[] = [];
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
        groups.set(`${scope}:${m[1] as string}`, { parent: m[2] as string, seg: (m[3] ?? m[4]) as string, scope });
      }

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
      ctxs.push({ path, src, code: blankLiterals(src), routers, scopes, scopeAt, groups, closurePrefix });
    }

    // Pass 2 — a router-typed parameter (`func registerUsers(rg *gin.RouterGroup)`)
    // takes the prefix of the argument passed at the function's call site, but
    // only when that is unambiguous: a plain function (not a method) of the same
    // package (directory) referenced exactly once, by a call, and — if exported —
    // never referenced as `pkg.Name` anywhere. Key: "path:scope:param".
    const bindings = new Map<string, { ctx: Ctx; arg: string; at: number; seg: string }>();
    const byDir = new Map<string, Ctx[]>();
    for (const ctx of ctxs) byDir.set(dirOf(ctx.path), [...(byDir.get(dirOf(ctx.path)) ?? []), ctx]);
    for (const ctx of ctxs) {
      for (const fn of ctx.scopes) {
        if (!fn.name) continue;
        const params = routerParams(fn.params);
        if (!params.size) continue;
        const name = fn.name;
        if (/^[A-Z]/.test(name)) {
          const qualified = new RegExp(`\\.${name}\\b`);
          if (ctxs.some((c) => qualified.test(c.code))) continue;
        }
        const useRe = new RegExp(`(?<![\\w.])${name}\\b`, "g");
        const uses: { ctx: Ctx; at: number }[] = [];
        for (const c of byDir.get(dirOf(ctx.path)) ?? []) {
          for (const m of c.code.matchAll(useRe)) if (!(c === ctx && m.index === fn.nameAt)) uses.push({ ctx: c, at: m.index ?? 0 });
        }
        if (uses.length !== 1) continue;
        const use = uses[0] as { ctx: Ctx; at: number };
        const call = /\s*\(/y;
        call.lastIndex = use.at + name.length;
        if (!call.exec(use.ctx.src)) continue;
        const args = callArgs(use.ctx.src, call.lastIndex - 1);
        for (const [param, pos] of params) {
          const arg = args[pos] ?? "";
          // A plain variable, or an inline group `r.Group("/api")`.
          const inline = arg.match(/^(\w+)\.Group\(\s*["`]([^"`]*)["`]\s*\)$/);
          if (inline) bindings.set(`${ctx.path}:${fn.start}:${param}`, { ctx: use.ctx, arg: inline[1] as string, at: use.at, seg: inline[2] as string });
          else if (/^\w+$/.test(arg)) bindings.set(`${ctx.path}:${fn.start}:${param}`, { ctx: use.ctx, arg, at: use.at, seg: "" });
        }
      }
    }

    // The group prefix of `v` in `scope`: a group assigned in that function, else
    // a bound parameter, else a package-level group.
    const groupPrefix = (ctx: Ctx, v: string, scope: number, seen: Set<string>): string => {
      const local = ctx.groups.get(`${scope}:${v}`);
      const bindKey = `${ctx.path}:${scope}:${v}`;
      const bound = local ? undefined : bindings.get(bindKey);
      if (bound) {
        if (seen.has(bindKey)) return "";
        seen.add(bindKey);
        return joinRoute(prefixOf(bound.ctx, bound.arg, bound.at, seen), bound.seg);
      }
      const key = local ? `${ctx.path}:${scope}:${v}` : `${ctx.path}:-1:${v}`;
      const g = local ?? ctx.groups.get(`-1:${v}`);
      if (!g || seen.has(key)) return "";
      seen.add(key);
      return joinRoute(groupPrefix(ctx, g.parent, g.scope, seen), g.seg);
    };
    const prefixOf = (ctx: Ctx, recv: string, idx: number, seen = new Set<string>()): string =>
      joinRoute(ctx.closurePrefix(idx), groupPrefix(ctx, recv, ctx.scopeAt(idx), seen));

    for (const ctx of ctxs) {
      const { path, src, routers } = ctx;
      const prefixAt = (recv: string, idx: number): string => prefixOf(ctx, recv, idx);
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
