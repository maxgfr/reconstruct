import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, readSources } from "./util.js";

// --- Minimal APIs -----------------------------------------------------------
// `app.MapGet("/health", handler)` / `todos.MapPost("/", handler)`.
const MAP_VERB_RE = /(\w+)\s*\.\s*Map(Get|Post|Put|Delete|Patch|Head|Options)\(\s*(?:@?\$?)"([^"]*)"/g;
// `app.MapMethods("/x", new[] { "GET", "POST" }, handler)` — verbs as an argument.
const MAP_METHODS_RE = /(\w+)\s*\.\s*MapMethods\(\s*(?:@?\$?)"([^"]*)"\s*,\s*([^)]*?)\s*,/g;
// Assignment group: `var todos = app.MapGroup("/api/todos");`. Resolved
// transitively so a nested group composes its parent's prefix.
const MAP_GROUP_RE = /(?:var|RouteGroupBuilder)\s+(\w+)\s*=\s*(\w+)\s*\.\s*MapGroup\(\s*(?:@?\$?)"([^"]*)"/g;

// --- Controllers ------------------------------------------------------------
// `[Route("api/[controller]")]` — the class-level template.
const CLASS_ROUTE_RE = /\[\s*Route\(\s*(?:@?\$?)"([^"]*)"\s*\)\s*\]/g;
// `class UsersController : ControllerBase` — gives the `[controller]` token value.
const CLASS_DECL_RE = /\bclass\s+(\w+)\s*(?::|$|\s*\{)/gm;
// `[HttpGet]` / `[HttpGet("{id}")]` — the action-level verb + template.
const ACTION_RE = /\[\s*Http(Get|Post|Put|Delete|Patch|Head|Options)(?:\(\s*(?:(?:@?\$?)"([^"]*)")?\s*\))?\s*\]/g;

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
function classAt(decls: { index: number; name: string }[], idx: number): string {
  let name = "";
  for (const d of decls) {
    if (d.index < idx) name = d.name;
    else break;
  }
  return name;
}

/**
 * ASP.NET Core routing, both paradigms — a repo routinely mixes them:
 *
 * - **Minimal APIs**: `app.MapGet("/health", …)`, with `MapGroup` prefixes
 *   resolved transitively (`var todos = app.MapGroup("/api/todos")` then
 *   `todos.MapGet("/", …)` -> `GET /api/todos`).
 * - **Controllers**: the class `[Route("api/[controller]")]` template composed
 *   with each action's `[HttpGet("{id}")]`, with `[controller]` expanded from
 *   the class name. A bare `[HttpGet]` inherits the class template unchanged.
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
          kind: "api",
          method: (m[2] as string).toUpperCase(),
        });
      }
      for (const m of src.matchAll(MAP_METHODS_RE)) {
        const verbs = [...(m[3] as string).matchAll(/"([A-Za-z]+)"/g)].map((v) => (v[1] as string).toUpperCase());
        for (const method of verbs.length ? verbs : ["*"]) {
          routes.push({ route: joinRoute(groupPrefix(m[1] as string), m[2] as string), file: path, kind: "api", method });
        }
      }

      // 2. Controllers — bind each [Http*] action to the class above it.
      const decls = [...src.matchAll(CLASS_DECL_RE)].map((m) => ({ index: m.index ?? 0, name: m[1] as string }));
      if (!decls.length) continue;
      const classRoutes = [...src.matchAll(CLASS_ROUTE_RE)].map((m) => ({ index: m.index ?? 0, template: m[1] as string }));

      for (const m of src.matchAll(ACTION_RE)) {
        const idx = m.index ?? 0;
        const className = classAt(decls, idx);
        if (!className) continue;
        // The class template is the last [Route(...)] declared above this action
        // AND above its class declaration — attributes sit just before the class.
        let template = "";
        for (const cr of classRoutes) {
          if (cr.index < idx) template = cr.template;
          else break;
        }
        // A controller with no [Route] attribute is conventionally routed; skip
        // rather than invent a path.
        if (!template) continue;
        routes.push({
          route: joinRoute(expandTokens(template, className), m[2] ?? ""),
          file: path,
          kind: "api",
          method: (m[1] as string).toUpperCase(),
        });
      }
    }
    return routes;
  },
};
