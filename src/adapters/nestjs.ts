import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { cmp, joinRoute, lineAt, readSources } from "./util.js";

// Capture the WHOLE first-arg region so single strings, `['a','b']` arrays, and
// `{ path: 'x' }` object forms can all be parsed for the path(s).
const CONTROLLER_RE = /@Controller\(\s*([^)]*)\)/g;
const METHOD_RE = /@(Get|Post|Put|Delete|Patch|Options|Head|All)\(\s*([^)]*)\)/g;
const GLOBAL_PREFIX_RE = /setGlobalPrefix\(\s*["'`]([^"'`]*)["'`]/g;

/** One `setGlobalPrefix(prefix, { exclude })` call and the app root it governs. */
interface GlobalPrefix {
  root: string;
  prefix: string;
  exclude: Array<{ re: RegExp; method?: string }>;
}

/**
 * Index just past the bracket closing the one opened at `open` (`(`/`[`/`{`),
 * skipping quoted strings; `src.length` when unbalanced.
 */
function closeOf(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i] as string;
    if (c === '"' || c === "'" || c === "`") {
      const end = src.indexOf(c, i + 1);
      if (end === -1) return src.length;
      i = end;
    } else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return src.length;
}

/** `users/:id`, `health/(.*)`, `docs/*` → a matcher over un-prefixed routes. */
function excludeMatcher(path: string): RegExp {
  const body = joinRoute(path)
    .split("/")
    .map((seg) => {
      if (seg === "*" || seg === "(.*)" || /^\{?\*\w*\}?$/.test(seg)) return ".*";
      if (seg.startsWith(":")) return "[^/]+";
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return new RegExp(`^${body}$`);
}

/**
 * The `exclude` list of a `setGlobalPrefix` call's options: plain path strings
 * and `{ path, method: RequestMethod.X }` objects.
 */
function parseExclude(args: string): GlobalPrefix["exclude"] {
  const at = /exclude\s*:\s*\[/.exec(args);
  if (!at) return [];
  const open = at.index + at[0].length - 1;
  const list = args.slice(open + 1, closeOf(args, open) - 1);
  const out: GlobalPrefix["exclude"] = [];
  let i = 0;
  while (i < list.length) {
    const c = list[i] as string;
    if (c === '"' || c === "'" || c === "`") {
      const end = list.indexOf(c, i + 1);
      if (end === -1) break;
      out.push({ re: excludeMatcher(list.slice(i + 1, end)) });
      i = end + 1;
    } else if (c === "{") {
      const end = closeOf(list, i);
      const obj = list.slice(i, end);
      const path = /path\s*:\s*["'`]([^"'`]*)["'`]/.exec(obj)?.[1];
      const verb = /method\s*:\s*RequestMethod\.(\w+)/.exec(obj)?.[1];
      if (path !== undefined) out.push({ re: excludeMatcher(path), method: verb && verb !== "ALL" ? verb : undefined });
      i = end;
    } else i++;
  }
  return out;
}

/** App root a bootstrap file governs: its directory, or the parent of a `src/` dir. */
function appRootOf(file: string): string {
  const dir = file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : "";
  if (dir === "src") return "";
  return dir.endsWith("/src") ? dir.slice(0, -"/src".length) : dir;
}

const isUnder = (file: string, root: string): boolean => root === "" || file.startsWith(`${root}/`);

/** All path strings a decorator argument declares (handles arrays + object form). */
function pathsFromArg(arg: string): string[] {
  const t = arg.trim();
  if (!t) return [""];
  if (t.startsWith("[")) {
    const parts = [...t.matchAll(/["'`]([^"'`]*)["'`]/g)].map((m) => m[1] as string);
    return parts.length ? parts : [""];
  }
  const str = t.match(/^["'`]([^"'`]*)["'`]/);
  if (str) return [str[1] as string];
  const obj = t.match(/path\s*:\s*["'`]([^"'`]*)["'`]/); // { path: 'x', host: '…' }
  if (obj) return [obj[1] as string];
  return [""];
}

const methodOf = (verb: string): string => (verb === "All" ? "*" : verb.toUpperCase());

/**
 * NestJS routing: a method's path is `setGlobalPrefix + @Controller(base) +
 * @<Method>(sub)`. Each method decorator binds to the nearest preceding
 * `@Controller` in the file, so `@Controller("users")` + `@Get(":id")` yields
 * `GET /users/:id`. Array paths (`@Controller(['a','b'])`, `@Get(['x','y'])`)
 * fan out to one route per (base × sub) combination. A `setGlobalPrefix("api")`
 * (typically in `main.ts`) prefixes the routes of its own app only — the
 * controllers under the bootstrap file's app root (its dir, or the parent of
 * `src/`) — so each app of a monorepo keeps its own prefix; its `exclude`
 * paths stay un-prefixed.
 */
export const nestjsAdapter: RouteAdapter = {
  id: "nestjs",
  frameworks: ["NestJS"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const sources = readSources(files, repo, [".ts"]);

    // Global prefixes wired at bootstrap, one per app root (first call wins).
    const prefixes: GlobalPrefix[] = [];
    for (const path of [...sources.keys()].sort(cmp)) {
      const src = sources.get(path) as string;
      for (const m of src.matchAll(GLOBAL_PREFIX_RE)) {
        const root = appRootOf(path);
        if (prefixes.some((p) => p.root === root)) continue;
        const open = (m.index ?? 0) + m[0].indexOf("(");
        const args = src.slice(open, closeOf(src, open));
        prefixes.push({ root, prefix: m[1] as string, exclude: parseExclude(args) });
      }
    }
    // Deepest root first, so a controller takes its nearest app's prefix.
    prefixes.sort((a, b) => b.root.length - a.root.length || cmp(a.root, b.root));

    const routes: RouteInfo[] = [];
    for (const [path, src] of sources) {
      const controllers = [...src.matchAll(CONTROLLER_RE)].map((m) => ({
        index: m.index ?? 0,
        bases: pathsFromArg(m[1] as string),
      }));
      if (!controllers.length) continue;
      const global = prefixes.find((p) => isUnder(path, p.root));

      for (const m of src.matchAll(METHOD_RE)) {
        const idx = m.index ?? 0;
        // Bind to the nearest @Controller declared above this method decorator.
        let bases = [""];
        for (const c of controllers) {
          if (c.index < idx) bases = c.bases;
          else break;
        }
        const method = methodOf(m[1] as string);
        const line = lineAt(src, idx);
        for (const base of bases) {
          for (const sub of pathsFromArg(m[2] as string)) {
            const bare = joinRoute(base, sub);
            const excluded = global?.exclude.some((e) => e.re.test(bare) && (!e.method || e.method === method));
            routes.push({
              route: global && !excluded ? joinRoute(global.prefix, bare) : bare,
              file: path,
              line,
              kind: "api",
              method,
            });
          }
        }
      }
    }
    return routes;
  },
};
