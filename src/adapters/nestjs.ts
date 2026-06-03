import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, readSources } from "./util.js";

const CONTROLLER_RE = /@Controller\(\s*(?:["'`]([^"'`]*)["'`])?/g;
const METHOD_RE = /@(Get|Post|Put|Delete|Patch|Options|Head|All)\(\s*(?:["'`]([^"'`]*)["'`])?/g;

/**
 * NestJS routing: a method's path is `@Controller(base) + @<Method>(sub)`. Each
 * method decorator is bound to the nearest preceding `@Controller` in the file
 * (one controller per file is the convention, but multiple are handled by
 * position), so a file with `@Controller("users")` and `@Get(":id")` yields
 * `/users/:id`.
 */
export const nestjsAdapter: RouteAdapter = {
  id: "nestjs",
  frameworks: ["NestJS"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const sources = readSources(files, repo, [".ts"]);
    const routes: RouteInfo[] = [];

    for (const [path, src] of sources) {
      const controllers = [...src.matchAll(CONTROLLER_RE)].map((m) => ({
        index: m.index ?? 0,
        base: (m[1] as string) ?? "",
      }));
      if (!controllers.length) continue;

      for (const m of src.matchAll(METHOD_RE)) {
        const idx = m.index ?? 0;
        // Bind to the nearest @Controller declared above this method decorator.
        let base = "";
        for (const c of controllers) {
          if (c.index < idx) base = c.base;
          else break;
        }
        routes.push({ route: joinRoute(base, (m[2] as string) ?? ""), file: path, kind: "api" });
      }
    }
    return routes;
  },
};
