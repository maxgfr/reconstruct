import type { FileInfo, RouteInfo, StackInfo } from "../types.js";

const CODE_PAGE_EXTS = new Set([".tsx", ".ts", ".jsx", ".js"]);
const PAGES_SPECIAL = new Set(["_app", "_document", "_error", "middleware"]);

/** Drop Next.js route groups `(group)` and parallel-route slots `@slot`. */
function cleanAppSegments(segs: string[]): string[] {
  return segs.filter((s) => !(s.startsWith("(") && s.endsWith(")")) && !s.startsWith("@"));
}

function afterDir(path: string, dir: string): string[] | null {
  const parts = path.split("/");
  const idx = parts.indexOf(dir);
  if (idx === -1) return null;
  // Only treat as app/pages dir if it's at repo root or directly under src/.
  if (idx > 1) return null;
  if (idx === 1 && parts[0] !== "src") return null;
  return parts.slice(idx + 1);
}

function detectAppRoutes(files: FileInfo[]): RouteInfo[] {
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
      routes.push({ route: normalized, file: f.path, kind: "api" });
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

export function detectRoutes(files: FileInfo[], stack: StackInfo): RouteInfo[] {
  if (!stack.frameworks.includes("Next.js")) return [];
  const app = detectAppRoutes(files);
  const pages = detectPagesRoutes(files);
  const all = [...app, ...pages];
  all.sort((a, b) => a.route.localeCompare(b.route) || a.kind.localeCompare(b.kind));
  return all;
}
