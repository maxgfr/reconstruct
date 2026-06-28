import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, readSources } from "./util.js";

// Per RESTful action: HTTP method(s) + path segments (relative to the resource
// base). Plural `resources` and singular `resource` differ (no `:id`, no index).
type ActionDef = { method: string; segs: string[] };
const PLURAL_ACTIONS: Record<string, ActionDef[]> = {
  index: [{ method: "GET", segs: [] }],
  create: [{ method: "POST", segs: [] }],
  new: [{ method: "GET", segs: ["new"] }],
  show: [{ method: "GET", segs: [":id"] }],
  update: [
    { method: "PUT", segs: [":id"] },
    { method: "PATCH", segs: [":id"] },
  ],
  destroy: [{ method: "DELETE", segs: [":id"] }],
  edit: [{ method: "GET", segs: [":id", "edit"] }],
};
const SINGULAR_ACTIONS: Record<string, ActionDef[]> = {
  create: [{ method: "POST", segs: [] }],
  new: [{ method: "GET", segs: ["new"] }],
  show: [{ method: "GET", segs: [] }],
  update: [
    { method: "PUT", segs: [] },
    { method: "PATCH", segs: [] },
  ],
  destroy: [{ method: "DELETE", segs: [] }],
  edit: [{ method: "GET", segs: ["edit"] }],
};

const ROOT_RE = /^root\b/;
const VERB_RE = /\b(get|post|put|patch|delete)\s+(?::(\w+)|["']([^"']+)["'])/g;
const RESOURCES_RE = /\b(resources|resource)\s+:(\w+)([^\n]*)/g;
const NAMESPACE_RE = /^namespace\s+:?(\w+)/;
// scope "/api" | scope path: "/api" | scope :admin (symbol → no url) | scope module: … (no url)
const SCOPE_STR_RE = /^scope\s+["']([^"']+)["']/;
const SCOPE_PATH_RE = /^scope\b[^#\n]*\bpath:\s*["']([^"']+)["']/;
const MOUNT_RE = /\bmount\s+[\w:]+\s*(?:=>|,\s*at:)\s*["']([^"']+)["']/;
const OPENS_BLOCK_RE = /\bdo\b(\s*\|[^|]*\|)?\s*$/;
const MEMBER_RE = /^member\b/;
const COLLECTION_RE = /^collection\b/;

function singularize(n: string): string {
  if (n.endsWith("ies")) return n.slice(0, -3) + "y";
  if (n.endsWith("s")) return n.slice(0, -1);
  return n;
}

/** The RESTful actions a `resources`/`resource` line generates after only:/except:. */
function actionsFor(args: string, singular: boolean): string[] {
  const all = Object.keys(singular ? SINGULAR_ACTIONS : PLURAL_ACTIONS);
  const parse = (s: string) =>
    new Set(
      s
        .split(",")
        .map((a) => a.trim().replace(/^:/, ""))
        .filter(Boolean),
    );
  const only = args.match(/\bonly:\s*\[([^\]]*)\]/);
  if (only) {
    const set = parse(only[1] as string);
    return all.filter((a) => set.has(a));
  }
  const except = args.match(/\bexcept:\s*\[([^\]]*)\]/);
  if (except) {
    const set = parse(except[1] as string);
    return all.filter((a) => !set.has(a));
  }
  return all;
}

type Frame =
  | { type: "prefix"; segs: string[] }
  | { type: "resources"; name: string; singular: string }
  | { type: "singular"; name: string }
  | { type: "member" | "collection"; name: string };

const apiKind = (route: string): "page" | "api" => (/(^|\/)api(\/|$)/i.test(route) ? "api" : "page");

/**
 * Rails routing (`config/routes.rb`, drawn in `routes.draw do … end`):
 *   - explicit verb routes (`get "/health"`, `get :preview`) and `root`,
 *   - `resources`/`resource`, expanded to their per-action paths + HTTP methods
 *     (honoring `only:`/`except:`), with nested resources composing the parent's
 *     `name/:singular_id` prefix and `member`/`collection` blocks resolving to
 *     `name/:id/...` and `name/...`,
 *   - `namespace`/`scope`/`scope path:` prefixes tracked through block nesting,
 *   - `mount Engine => "/path"`.
 * REST/JSON routes under an `api` segment are classed `api`, the rest `page`.
 */
export const railsAdapter: RouteAdapter = {
  id: "rails",
  frameworks: ["Ruby on Rails"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const routes: RouteInfo[] = [];

    for (const [path, src] of readSources(files, repo, [".rb"])) {
      if (!path.endsWith("routes.rb")) continue;

      const frames: Frame[] = [];
      const emit = (route: string, method?: string, kind?: "page" | "api") =>
        routes.push({ route, file: path, kind: kind ?? apiKind(route), ...(method ? { method } : {}) });

      // Prefix segments from frames[0 .. upto-1], skipping member/collection frames.
      const nestPrefix = (upto: number): string[] => {
        const out: string[] = [];
        for (let i = 0; i < upto; i++) {
          const f = frames[i] as Frame;
          if (f.type === "prefix") out.push(...f.segs);
          else if (f.type === "resources") out.push(f.name, `:${f.singular}_id`);
          else if (f.type === "singular") out.push(f.name);
        }
        return out;
      };

      // The prefix a verb declared at the current point sits under.
      const verbPrefix = (): string[] => {
        const top = frames[frames.length - 1];
        if (top && (top.type === "member" || top.type === "collection")) {
          // Build from the ancestors ABOVE the parent resources frame, then add
          // the resource base (member: `name/:id`, collection: `name`) — so the
          // parent's own `name/:name_id` nesting isn't double-counted.
          let parentIdx = frames.length - 1;
          for (let i = frames.length - 2; i >= 0; i--) {
            const f = frames[i] as Frame;
            if (f.type === "resources" || f.type === "singular") {
              parentIdx = i;
              break;
            }
          }
          const base = nestPrefix(parentIdx);
          return top.type === "member" ? [...base, top.name, ":id"] : [...base, top.name];
        }
        return nestPrefix(frames.length);
      };

      for (const rawLine of src.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;

        // --- routes declared on this line, under the active prefix ---
        if (ROOT_RE.test(line)) emit(joinRoute(...verbPrefix()), "GET");
        for (const m of line.matchAll(VERB_RE)) {
          const p = (m[2] as string) ?? (m[3] as string);
          emit(joinRoute(...verbPrefix(), p), (m[1] as string).toUpperCase());
        }
        for (const m of line.matchAll(RESOURCES_RE)) {
          const singular = (m[1] as string) === "resource";
          const name = m[2] as string;
          const args = (m[3] as string) ?? "";
          const base = joinRoute(...nestPrefix(frames.length), name);
          const table = singular ? SINGULAR_ACTIONS : PLURAL_ACTIONS;
          for (const action of actionsFor(args, singular)) {
            for (const def of table[action] as ActionDef[]) {
              emit(joinRoute(base, ...def.segs), def.method);
            }
          }
        }
        const mount = line.match(MOUNT_RE);
        if (mount) emit(joinRoute(...nestPrefix(frames.length), mount[1] as string), undefined, "api");

        // --- block nesting: pop on `end`, push on a line that opens a `do` block ---
        if (/^end\b/.test(line)) {
          frames.pop();
          continue;
        }
        if (OPENS_BLOCK_RE.test(line)) {
          const res = line.match(/^(resources|resource)\s+:(\w+)/);
          const ns = line.match(NAMESPACE_RE);
          const scopePath = line.match(SCOPE_PATH_RE) ?? line.match(SCOPE_STR_RE);
          const parentRes = [...frames].reverse().find((f) => f.type === "resources" || f.type === "singular") as { name: string } | undefined;
          if (MEMBER_RE.test(line)) frames.push({ type: "member", name: parentRes?.name ?? "" });
          else if (COLLECTION_RE.test(line)) frames.push({ type: "collection", name: parentRes?.name ?? "" });
          else if (res && res[1] === "resources") frames.push({ type: "resources", name: res[2] as string, singular: singularize(res[2] as string) });
          else if (res) frames.push({ type: "singular", name: res[2] as string });
          else if (ns) frames.push({ type: "prefix", segs: [ns[1] as string] });
          else if (scopePath) frames.push({ type: "prefix", segs: [scopePath[1] as string] });
          else frames.push({ type: "prefix", segs: [] });
        }
      }
    }
    return routes;
  },
};
