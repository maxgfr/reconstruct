import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { lineAt, readSources } from "./util.js";

const CODE_PAGE_EXTS = new Set([".tsx", ".ts", ".jsx", ".js"]);
const PAGES_SPECIAL = new Set(["_app", "_document", "_error", "middleware"]);
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

/**
 * Clean App Router segments: drop route groups `(group)` and parallel slots
 * `@slot` (neither appears in the URL), and strip intercepting-route markers
 * `(.)`/`(..)`/`(...)`/`(..)(..)` while keeping the intercepted folder name.
 */
function cleanAppSegments(segs: string[]): string[] {
  const out: string[] = [];
  for (const raw of segs) {
    const s = raw.replace(/^(\(\.{1,3}\))+/, ""); // strip leading interceptor markers
    if (!s) continue;
    if (s.startsWith("@")) continue; // parallel-route slot
    if (s.startsWith("(") && s.endsWith(")")) continue; // route group
    out.push(s);
  }
  return out;
}

const WORKSPACE_PREFIX_RE = /^(?:apps|packages)\/[^/]+(?:\/src)?$/;

/**
 * Segments after an `app`/`pages` routing dir, or null when this file isn't in
 * one. Accepts the dir at the repo root, under `src/`, OR under a monorepo
 * workspace (`apps/<name>/`, `packages/<name>/`, optionally `/src`).
 */
function afterDir(path: string, dir: string): string[] | null {
  const parts = path.split("/");
  for (let idx = 0; idx < parts.length; idx++) {
    if (parts[idx] !== dir) continue;
    const prefix = parts.slice(0, idx).join("/");
    if (prefix === "" || prefix === "src" || WORKSPACE_PREFIX_RE.test(prefix)) {
      return parts.slice(idx + 1);
    }
  }
  return null;
}

/** Exported binding names of an export list or destructuring (`a as GET`, `POST`, `GET: get`). */
function exportedNames(list: string, destructuring: boolean): string[] {
  const out: string[] = [];
  for (const raw of list.split(",")) {
    let item = raw.trim().replace(/^type\s+/, "");
    if (!item || item.startsWith("...")) continue;
    item = destructuring ? ((item.split(":").pop() as string).split("=")[0] as string) : (item.split(/\s+as\s+/).pop() as string);
    out.push(item.trim().replace(/^["'`]|["'`]$/g, ""));
  }
  return out;
}

/**
 * Exported HTTP method handlers in a `route.ts`, each with the line of its
 * export: `export [async] function GET`, `export const POST = …` (typed or not),
 * the NextAuth list form `export { handler as GET, handler as POST }`, re-exports
 * `export { GET } from "./x"`, and the v5 destructuring
 * `export const { GET, POST } = handlers`. `src` has its comments blanked, so a
 * commented-out export is not a handler.
 */
function routeMethods(src: string): Array<{ method: string; line: number }> {
  const found = new Map<string, number>();
  const add = (name: string, offset: number): void => {
    if (HTTP_METHODS.includes(name) && !found.has(name)) found.set(name, offset);
  };
  for (const m of src.matchAll(/\bexport\s+(?:async\s+)?function\s*\*?\s*([A-Z]+)\b/g)) add(m[1] as string, m.index ?? 0);
  for (const m of src.matchAll(/\bexport\s+(?:const|let|var)\s+([A-Z]+)\s*[=:]/g)) add(m[1] as string, m.index ?? 0);
  for (const m of src.matchAll(/\bexport\s+(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
    for (const name of exportedNames(m[1] as string, true)) add(name, m.index ?? 0);
  }
  for (const m of src.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
    for (const name of exportedNames(m[1] as string, false)) add(name, m.index ?? 0);
  }
  return [...found].map(([method, offset]) => ({ method, line: lineAt(src, offset) }));
}

/**
 * A `_folder` under `app/` is private: it and every child are opted out of
 * routing. (`%5F` is the escape for a URL segment that really starts with `_`.)
 */
const isPrivateSegment = (seg: string): boolean => seg.startsWith("_");

function detectAppRoutes(files: FileInfo[], repo: string): RouteInfo[] {
  const candidates: Array<{ f: FileInfo; rest: string[] }> = [];
  for (const f of files) {
    if (!CODE_PAGE_EXTS.has(f.ext)) continue;
    const rest = afterDir(f.path, "app");
    if (!rest || rest.length === 0) continue;
    if (rest.slice(0, -1).some(isPrivateSegment)) continue;
    candidates.push({ f, rest });
  }
  // Only route handlers are content-scanned (comments blanked by readSources).
  const handlerFiles = candidates.filter((c) => /^route\.(tsx|ts|jsx|js)$/.test(c.rest[c.rest.length - 1] as string)).map((c) => c.f);
  const sources = readSources(handlerFiles, repo, [...CODE_PAGE_EXTS]);

  const routes: RouteInfo[] = [];
  for (const { f, rest } of candidates) {
    const fileName = (rest[rest.length - 1] as string).replace(/\.(tsx|ts|jsx|js)$/, "");
    const dirSegs = cleanAppSegments(rest.slice(0, -1)).map((s) => s.replace(/^%5F/i, "_"));
    const route = "/" + dirSegs.join("/");
    const normalized = route === "/" ? "/" : route.replace(/\/$/, "");

    if (fileName === "page") {
      routes.push({ route: normalized, file: f.path, kind: "page" });
    } else if (fileName === "route") {
      const methods = routeMethods(sources.get(f.path) ?? "");
      if (methods.length) {
        for (const { method, line } of methods) routes.push({ route: normalized, file: f.path, line, kind: "api", method });
      } else {
        routes.push({ route: normalized, file: f.path, kind: "api" });
      }
    } else if (fileName === "layout") {
      routes.push({ route: normalized, file: f.path, kind: "layout" });
    }
  }
  return routes;
}

function detectPagesRoutes(files: FileInfo[]): RouteInfo[] {
  const routes: RouteInfo[] = [];
  for (const f of files) {
    if (!CODE_PAGE_EXTS.has(f.ext)) continue;
    const rest = afterDir(f.path, "pages");
    if (!rest || rest.length === 0) continue;
    const fileName = (rest[rest.length - 1] as string).replace(/\.(tsx|ts|jsx|js)$/, "");
    if (PAGES_SPECIAL.has(fileName)) continue;

    const segs = [...rest.slice(0, -1), fileName].filter((s) => s !== "index");
    const route = "/" + segs.join("/");
    const normalized = route === "/" ? "/" : route.replace(/\/$/, "");
    const isApi = rest[0] === "api";
    routes.push({ route: normalized, file: f.path, kind: isApi ? "api" : "page" });
  }
  return routes;
}

/**
 * Next.js file-based routing: the App Router (`app/`, `page`/`route`/`layout`)
 * and the legacy Pages Router (`pages/`, `pages/api/*`). Path-based, except that
 * a `route.ts` is content-scanned for its exported HTTP method handlers. Private
 * `_folders` under `app/` are not routable and are skipped.
 */
export const nextjsAdapter: RouteAdapter = {
  id: "nextjs",
  frameworks: ["Next.js"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    return [...detectAppRoutes(files, repo), ...detectPagesRoutes(files)];
  },
};
