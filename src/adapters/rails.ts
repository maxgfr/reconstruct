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
// Keywords that open an `end`-closed block when they START a statement (the
// modifier form `get "/x" if dev?` opens nothing).
const STATEMENT_OPENER_RE = /^(?:if|unless|case|begin|def|class|module|while|until|for)\b/;
// Loops whose own optional `do` is part of the statement, not a second block.
const LOOP_RE = /^(?:while|until|for)\b/;
// `do` / `end` keywords — not `.end`, `:do` symbols, `end:` hash keys or `ending`.
const BLOCK_TOKEN_RE = /(?<![\w.:@$])(do|end)(?![\w?!:])/g;
// String / %-array literals, emptied before scanning keywords so `get "/do"`
// does not open a block.
const LITERAL_RE = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|%[iwIWqQ]?\[[^\]]*\]|%[iwIWqQ]?\([^)]*\)/g;
const MEMBER_RE = /^member\b/;
const COLLECTION_RE = /^collection\b/;

function singularize(n: string): string {
  if (n.endsWith("ies")) return n.slice(0, -3) + "y";
  if (n.endsWith("s")) return n.slice(0, -1);
  return n;
}

/**
 * The action names an `only:`/`except:` option selects, in every spelling Rails
 * accepts: `only: :show`, `only: [:index, :show]`, `only: %i[index show]`,
 * `only: "show"`, and the hash-rocket `:only => [...]`. Null when absent.
 */
function selectedActions(args: string, key: "only" | "except"): Set<string> | null {
  const m = args.match(new RegExp(`(?:\\b${key}:|:${key}\\s*=>)\\s*(\\[[^\\]]*\\]|%[iwIW][[(][^\\])]*[\\])]|:\\w+|["']\\w+["'])`));
  if (!m) return null;
  const body = (m[1] as string).replace(/^%[iwIW]/, "");
  return new Set([...body.matchAll(/\w+/g)].map((w) => w[0]));
}

/** The RESTful actions a `resources`/`resource` line generates after only:/except:. */
function actionsFor(args: string, singular: boolean): string[] {
  const all = Object.keys(singular ? SINGULAR_ACTIONS : PLURAL_ACTIONS);
  const only = selectedActions(args, "only");
  if (only) return all.filter((a) => only.has(a));
  const except = selectedActions(args, "except");
  if (except) return all.filter((a) => !except.has(a));
  return all;
}

type Frame =
  | { type: "prefix"; segs: string[] }
  | { type: "resources"; name: string; singular: string }
  | { type: "singular"; name: string }
  | { type: "member" | "collection"; name: string }
  // Any other `do`/`if`/`case`/`def`… block: contributes no prefix, but must be
  // on the stack so its `end` does not pop a routing frame.
  | { type: "block" };

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
      let lineNo = 0;
      const emit = (route: string, method?: string, kind?: "page" | "api") =>
        routes.push({ route, file: path, line: lineNo, kind: kind ?? apiKind(route), ...(method ? { method } : {}) });

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
        // Non-routing blocks (`if`, `do`…) are transparent: a verb in an `if`
        // inside `member do` is still a member route.
        let topIdx = frames.length - 1;
        while (topIdx >= 0 && (frames[topIdx] as Frame).type === "block") topIdx--;
        const top = frames[topIdx];
        if (top && (top.type === "member" || top.type === "collection")) {
          // Build from the ancestors ABOVE the parent resources frame, then add
          // the resource base (member: `name/:id`, collection: `name`) — so the
          // parent's own `name/:name_id` nesting isn't double-counted.
          let parentIdx = topIdx;
          for (let i = topIdx - 1; i >= 0; i--) {
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

      // The frame a routing `do` line opens (`resources :x do`, `namespace :api do`…).
      const routingFrame = (line: string): Frame => {
        const res = line.match(/^(resources|resource)\s+:(\w+)/);
        const ns = line.match(NAMESPACE_RE);
        const scopePath = line.match(SCOPE_PATH_RE) ?? line.match(SCOPE_STR_RE);
        const parentRes = [...frames].reverse().find((f) => f.type === "resources" || f.type === "singular") as { name: string } | undefined;
        if (MEMBER_RE.test(line)) return { type: "member", name: parentRes?.name ?? "" };
        if (COLLECTION_RE.test(line)) return { type: "collection", name: parentRes?.name ?? "" };
        if (res && res[1] === "resources") return { type: "resources", name: res[2] as string, singular: singularize(res[2] as string) };
        if (res) return { type: "singular", name: res[2] as string };
        if (ns) return { type: "prefix", segs: [ns[1] as string] };
        if (scopePath) return { type: "prefix", segs: [scopePath[1] as string] };
        return { type: "prefix", segs: [] };
      };

      // Comments are already blanked by readSources (offsets kept), so a
      // trailing `# note` after `do` no longer hides the block opener.
      for (const rawLine of src.split(/\r?\n/)) {
        lineNo++;
        const line = rawLine.trim();
        if (!line) continue;

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

        // --- block nesting: every opener pushes and every `end` pops, in source
        // order. Only a line's trailing `do` opens a routing frame; any other
        // block (`if`/`case`/`def`, an inner `do … end`) pushes a transparent
        // frame, so its `end` cannot pop the enclosing namespace/scope. ---
        const code = line.replace(LITERAL_RE, '""');
        const tokens = [...code.matchAll(BLOCK_TOKEN_RE)].map((m) => m[1] as string);
        if (LOOP_RE.test(code)) {
          const loopDo = tokens.indexOf("do");
          if (loopDo !== -1) tokens.splice(loopDo, 1);
        }
        if (STATEMENT_OPENER_RE.test(code)) tokens.unshift("open");
        const routingDo = OPENS_BLOCK_RE.test(code) ? tokens.lastIndexOf("do") : -1;
        tokens.forEach((t, i) => {
          if (t === "end") frames.pop();
          else frames.push(i === routingDo ? routingFrame(line) : { type: "block" });
        });
      }
    }
    return routes;
  },
};
