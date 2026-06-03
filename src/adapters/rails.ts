import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, readSources } from "./util.js";

const ALL_ACTIONS = ["index", "create", "new", "show", "update", "destroy", "edit"] as const;
type Action = (typeof ALL_ACTIONS)[number];

// Path segments (relative to the resource base) each RESTful action maps to.
// `RouteInfo` carries no HTTP method, so index/create and show/update/destroy
// collapse to the same path — they de-dupe to one route each.
const ACTION_SEGMENTS: Record<Action, string[]> = {
  index: [],
  create: [],
  new: ["new"],
  show: [":id"],
  update: [":id"],
  destroy: [":id"],
  edit: [":id", "edit"],
};

const ROOT_RE = /^root\b/;
const VERB_RE = /\b(?:get|post|put|patch|delete)\s+["']([^"']+)["']/g;
const RESOURCES_RE = /\bresources\s+:(\w+)([^\n]*)/g;
const NAMESPACE_RE = /^namespace\s+:(\w+)/;
const SCOPE_PATH_RE = /^scope\s+["']([^"']+)["']/;
const OPENS_BLOCK_RE = /\bdo\b(\s*\|[^|]*\|)?\s*$/;

/** The RESTful actions a `resources` line generates, after `only:`/`except:`. */
function actionsFor(args: string): Action[] {
  const parse = (s: string) =>
    new Set(s.split(",").map((a) => a.trim().replace(/^:/, "")).filter(Boolean));
  const only = args.match(/\bonly:\s*\[([^\]]*)\]/);
  if (only) {
    const set = parse(only[1] as string);
    return ALL_ACTIONS.filter((a) => set.has(a));
  }
  const except = args.match(/\bexcept:\s*\[([^\]]*)\]/);
  if (except) {
    const set = parse(except[1] as string);
    return ALL_ACTIONS.filter((a) => !set.has(a));
  }
  return [...ALL_ACTIONS];
}

/**
 * Rails routing: `config/routes.rb` is a DSL drawn inside
 * `Rails.application.routes.draw do ... end`. We resolve:
 *   - explicit verb routes (`get "/health"`), and `root`,
 *   - `resources :photos`, expanded to its member/collection paths (honoring
 *     `only:`/`except:`),
 *   - `namespace :admin` / `scope "/api"` prefixes, tracked through `do`/`end`
 *     block nesting so a resource inside the block inherits the prefix.
 * Singular `resource`, nested-resource member params, and `path:`/`module:`
 * scope options are left to the candidate layer.
 */
export const railsAdapter: RouteAdapter = {
  id: "rails",
  frameworks: ["Ruby on Rails"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const routes: RouteInfo[] = [];

    for (const [path, src] of readSources(files, repo, [".rb"])) {
      if (!path.endsWith("routes.rb")) continue;

      // One frame per open `do` block; its value is the prefix it contributes
      // (namespace/scope) or null. `prefixStack` is the active prefixes in order.
      const frames: (string | null)[] = [];
      const prefixStack: string[] = [];
      const here = () => joinRoute(...prefixStack);
      const emit = (...segs: string[]) =>
        routes.push({ route: joinRoute(here(), ...segs), file: path, kind: "page" });

      for (const rawLine of src.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;

        // Routes declared on this line, under the currently active prefix.
        if (ROOT_RE.test(line)) emit("");
        for (const m of line.matchAll(VERB_RE)) emit(m[1] as string);
        for (const m of line.matchAll(RESOURCES_RE)) {
          const name = m[1] as string;
          const seen = new Set<string>();
          for (const action of actionsFor((m[2] as string) ?? "")) {
            const route = joinRoute(here(), name, ...ACTION_SEGMENTS[action]);
            if (seen.has(route)) continue;
            seen.add(route);
            routes.push({ route, file: path, kind: "page" });
          }
        }

        // Maintain block nesting so prefixes scope to their bodies.
        if (/^end\b/.test(line)) {
          if (frames.pop()) prefixStack.pop();
        }
        if (OPENS_BLOCK_RE.test(line)) {
          const ns = line.match(NAMESPACE_RE);
          const sc = line.match(SCOPE_PATH_RE);
          const contributed = ns ? "/" + (ns[1] as string) : sc ? (sc[1] as string) : null;
          frames.push(contributed);
          if (contributed) prefixStack.push(contributed);
        }
      }
    }
    return routes;
  },
};
