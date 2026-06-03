import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";

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

/** Exported HTTP method handlers in a `route.ts` (`export function GET`, `export const POST = …`). */
function routeMethods(repo: string, file: string): string[] {
  let src: string;
  try {
    src = readFileSync(join(repo, file), "utf8");
  } catch {
    return [];
  }
  const found = new Set<string>();
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Z]+)\b/g)) {
    if (HTTP_METHODS.includes(m[1] as string)) found.add(m[1] as string);
  }
  for (const m of src.matchAll(/export\s+const\s+([A-Z]+)\s*=/g)) {
    if (HTTP_METHODS.includes(m[1] as string)) found.add(m[1] as string);
  }
  return [...found];
}

function detectAppRoutes(files: FileInfo[], repo: string): RouteInfo[] {
  const routes: RouteInfo[] = [];
  for (const f of files) {
    if (!CODE_PAGE_EXTS.has(f.ext)) continue;
    const rest = afterDir(f.path, "app");
    if (!rest || rest.length === 0) continue;
    const fileName = (rest[rest.length - 1] as string).replace(/\.(tsx|ts|jsx|js)$/, "");
    const dirSegs = cleanAppSegments(rest.slice(0, -1));
    const route = "/" + dirSegs.join("/");
    const normalized = route === "/" ? "/" : route.replace(/\/$/, "");

    if (fileName === "page") {
      routes.push({ route: normalized, file: f.path, kind: "page" });
    } else if (fileName === "route") {
      const methods = routeMethods(repo, f.path);
      if (methods.length) {
        for (const method of methods) routes.push({ route: normalized, file: f.path, kind: "api", method });
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
 * a `route.ts` is content-scanned for its exported HTTP method handlers.
 */
export const nextjsAdapter: RouteAdapter = {
  id: "nextjs",
  frameworks: ["Next.js"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    return [...detectAppRoutes(files, repo), ...detectPagesRoutes(files)];
  },
};
