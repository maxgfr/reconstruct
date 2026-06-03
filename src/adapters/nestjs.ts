import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, readSources } from "./util.js";

// Capture the WHOLE first-arg region so single strings, `['a','b']` arrays, and
// `{ path: 'x' }` object forms can all be parsed for the path(s).
const CONTROLLER_RE = /@Controller\(\s*([^)]*)\)/g;
const METHOD_RE = /@(Get|Post|Put|Delete|Patch|Options|Head|All)\(\s*([^)]*)\)/g;
const GLOBAL_PREFIX_RE = /setGlobalPrefix\(\s*["'`]([^"'`]*)["'`]/;

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
 * fan out to one route per (base × sub) combination, and a `setGlobalPrefix("api")`
 * found anywhere in the project (typically `main.ts`) prefixes every route.
 */
export const nestjsAdapter: RouteAdapter = {
  id: "nestjs",
  frameworks: ["NestJS"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const sources = readSources(files, repo, [".ts"]);

    // A global prefix wired at bootstrap applies to every controller route.
    let globalPrefix = "";
    for (const [, src] of sources) {
      const m = src.match(GLOBAL_PREFIX_RE);
      if (m) {
        globalPrefix = m[1] as string;
        break;
      }
    }

    const routes: RouteInfo[] = [];
    for (const [path, src] of sources) {
      const controllers = [...src.matchAll(CONTROLLER_RE)].map((m) => ({
        index: m.index ?? 0,
        bases: pathsFromArg(m[1] as string),
      }));
      if (!controllers.length) continue;

      for (const m of src.matchAll(METHOD_RE)) {
        const idx = m.index ?? 0;
        // Bind to the nearest @Controller declared above this method decorator.
        let bases = [""];
        for (const c of controllers) {
          if (c.index < idx) bases = c.bases;
          else break;
        }
        const method = methodOf(m[1] as string);
        for (const base of bases) {
          for (const sub of pathsFromArg(m[2] as string)) {
            routes.push({
              route: joinRoute(globalPrefix, base, sub),
              file: path,
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
