import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, lineAt, readSources } from "./util.js";

// --- Minimal APIs -----------------------------------------------------------
// `app.MapGet("/health", handler)` / `todos.MapPost("/", handler)`.
const MAP_VERB_RE = /(\w+)\s*\.\s*Map(Get|Post|Put|Delete|Patch|Head|Options)\(\s*(?:@?\$?)"([^"]*)"/g;
// `app.MapMethods("/x", new[] { "GET", "POST" }, handler)` — verbs as an argument.
const MAP_METHODS_RE = /(\w+)\s*\.\s*MapMethods\(\s*(?:@?\$?)"([^"]*)"\s*,\s*([^)]*?)\s*,/g;
// Assignment group: `var todos = app.MapGroup("/api/todos");`. Resolved
// transitively so a nested group composes its parent's prefix.
const MAP_GROUP_RE = /(?:var|RouteGroupBuilder)\s+(\w+)\s*=\s*(\w+)\s*\.\s*MapGroup\(\s*(?:@?\$?)"([^"]*)"/g;

// --- Controllers ------------------------------------------------------------
// `[Route("api/[controller]")]` (or `[ApiController, Route("…", Name = "x")]`) —
// a class-level or method-level template, told apart by where it sits.
const ROUTE_ATTR_RE = /[[,]\s*Route\(\s*(?:@?\$?)"([^"]*)"\s*[,)]/g;
// `class UsersController : ControllerBase` — gives the `[controller]` token value
// (generic and primary-constructor declarations included).
const CLASS_DECL_RE = /\bclass\s+(\w+)\s*(?:<[^>{;]*>\s*)?(?::|$|\{|\(|where\b)/gm;
// `[HttpGet]` / `[HttpGet("{id}")]` / `[HttpGet("{id}", Name = "x")]` — the
// action-level verb + template.
const ACTION_RE = /[[,]\s*Http(Get|Post|Put|Delete|Patch|Head|Options)\b(?:\(\s*(?:(?:@?\$?)"([^"]*)")?[^)\]]*\))?/g;

/**
 * Expand ASP.NET's route tokens. `[controller]` is the class name minus the
 * `Controller` suffix, lowercased (`UsersController` -> `users`); `[action]`
 * cannot be resolved without binding to a specific method name, so it is left
 * as a visible placeholder rather than guessed wrong.
 */
function expandTokens(template: string, className: string): string {
  const controller = className.replace(/Controller$/, "").toLowerCase();
  return template.replace(/\[controller\]/gi, controller);
}

/** Index -> the class declared immediately above it, for binding attributes. */
function classAt<T extends { index: number }>(decls: T[], idx: number): T | undefined {
  let found: T | undefined;
  for (const d of decls) {
    if (d.index < idx) found = d;
    else break;
  }
  return found;
}

/**
 * String literal contents replaced by spaces (offsets kept), so a `{id}` or a
 * `;` inside a template cannot be mistaken for code structure.
 */
function blankStrings(src: string): string {
  return src.replace(/@"(?:[^"]|"")*"|"(?:[^"\\\n]|\\.)*"/g, (s) => {
    const open = s.startsWith("@") ? 2 : 1;
    return s.slice(0, open) + s.slice(open, -1).replace(/[^\n]/g, " ") + '"';
  });
}

/** Start of the declaration whose attributes include `idx`: just past the previous `;`, `{` or `}`. */
function declStart(code: string, idx: number): number {
  return Math.max(code.lastIndexOf(";", idx), code.lastIndexOf("{", idx), code.lastIndexOf("}", idx)) + 1;
}

/**
 * End of a member's attribute list scanned from its `declStart`: the method's
 * parameter `(` (or a body/terminator) outside any `[...]`.
 */
function attrListEnd(code: string, from: number): number {
  let depth = 0;
  for (let i = from; i < code.length; i++) {
    const c = code[i];
    if (c === "[") depth++;
    else if (c === "]") depth--;
    else if (depth === 0 && (c === "(" || c === ";" || c === "{" || c === "}")) return i;
  }
  return code.length;
}

/** `/health` and `~/ping` ignore the controller's template. */
const isAbsolute = (t: string): boolean => t.startsWith("/") || t.startsWith("~/");

/**
 * ASP.NET Core routing, both paradigms — a repo routinely mixes them:
 *
 * - **Minimal APIs**: `app.MapGet("/health", …)`, with `MapGroup` prefixes
 *   resolved transitively (`var todos = app.MapGroup("/api/todos")` then
 *   `todos.MapGet("/", …)` -> `GET /api/todos`).
 * - **Controllers**: the class `[Route("api/[controller]")]` template composed
 *   with each action's `[HttpGet("{id}")]`, with `[controller]` expanded from
 *   the class name. A bare `[HttpGet]` inherits the class template unchanged; a
 *   method-level `[Route("search")]` applies to its own action only; an
 *   absolute action template (`/health`, `~/ping`) discards the class template.
 *
 * Conventional routing (`MapControllerRoute` with a `{controller}/{action}`
 * pattern) is deliberately NOT expanded: without binding every action to the
 * pattern the result would be guesswork, and a wrong route is worse than a
 * candidate — the stack guide covers doing it by hand.
 */
export const dotnetAdapter: RouteAdapter = {
  id: "dotnet",
  frameworks: ["ASP.NET Core"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const routes: RouteInfo[] = [];

    for (const [path, src] of readSources(files, repo, [".cs"])) {
      // 1. Minimal APIs — resolve MapGroup chains first so verbs can use them.
      const groups = new Map<string, { parent: string; seg: string }>();
      for (const m of src.matchAll(MAP_GROUP_RE)) {
        groups.set(m[1] as string, { parent: m[2] as string, seg: m[3] as string });
      }
      const groupPrefix = (v: string, seen = new Set<string>()): string => {
        const g = groups.get(v);
        if (!g || seen.has(v)) return "";
        seen.add(v);
        return joinRoute(groupPrefix(g.parent, seen), g.seg);
      };

      for (const m of src.matchAll(MAP_VERB_RE)) {
        routes.push({
          route: joinRoute(groupPrefix(m[1] as string), m[3] as string),
          file: path,
          line: lineAt(src, m.index ?? 0),
          kind: "api",
          method: (m[2] as string).toUpperCase(),
        });
      }
      for (const m of src.matchAll(MAP_METHODS_RE)) {
        const verbs = [...(m[3] as string).matchAll(/"([A-Za-z]+)"/g)].map((v) => (v[1] as string).toUpperCase());
        for (const method of verbs.length ? verbs : ["*"]) {
          routes.push({ route: joinRoute(groupPrefix(m[1] as string), m[2] as string), file: path, line: lineAt(src, m.index ?? 0), kind: "api", method });
        }
      }

      // 2. Controllers — bind each [Http*] action to the class above it. The
      //    structural scan runs on a string-blanked copy (same offsets).
      const code = blankStrings(src);
      const routeAttrs = [...src.matchAll(ROUTE_ATTR_RE)].map((m) => ({ index: m.index ?? 0, template: m[1] as string }));
      const routesIn = (from: number, to: number): string[] => routeAttrs.filter((r) => r.index >= from && r.index < to).map((r) => r.template);
      // Each class owns only the [Route] attributes written directly above its
      // declaration — a class without one does not inherit its neighbour's.
      const decls = [...code.matchAll(CLASS_DECL_RE)].map((m) => {
        const index = m.index ?? 0;
        return { index, name: m[1] as string, templates: routesIn(declStart(code, index), index) };
      });
      if (!decls.length) continue;

      for (const m of src.matchAll(ACTION_RE)) {
        const idx = m.index ?? 0;
        const cls = classAt(decls, idx);
        if (!cls) continue;
        // A method-level [Route] sits in the same attribute list as the verb.
        const start = declStart(code, idx);
        const own = m[2] ?? routesIn(start, attrListEnd(code, start))[0];
        const method = (m[1] as string).toUpperCase();
        const line = lineAt(src, idx);
        if (own !== undefined && isAbsolute(own)) {
          routes.push({ route: joinRoute(expandTokens(own.replace(/^~/, ""), cls.name)), file: path, line, kind: "api", method });
          continue;
        }
        // A controller with no [Route] attribute is conventionally routed; skip
        // rather than invent a path.
        for (const template of new Set(cls.templates)) {
          routes.push({
            route: joinRoute(expandTokens(template, cls.name), expandTokens(own ?? "", cls.name)),
            file: path,
            line,
            kind: "api",
            method,
          });
        }
      }
    }
    return routes;
  },
};
