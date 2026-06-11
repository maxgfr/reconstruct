import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { JS_SRC_EXTS as SRC_EXTS, joinRoute, readSources, resolveModule } from "./util.js";

// `const app = new Hono()` (generics tolerated), with an optional chained
// `.basePath("/api")` on the same statement.
const APP_RE =
  /(?:const|let|var)\s+(\w+)\s*=\s*new\s+Hono\s*(?:<[^>]*>)?\s*\([^)]*\)(?:\s*\.basePath\(\s*["'`]([^"'`]*)["'`]\s*\))?/g;
// Separate-statement `app.basePath("/api")`.
const BASEPATH_RE = /(\w+)\.basePath\(\s*["'`]([^"'`]*)["'`]/g;
const REQUIRE_RE = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
const IMPORT_RE = /import\s+(\w+)\s+from\s+["'`](\.[^"'`]*)["'`]/g;
const ROUTE_RE = /(\w+)\.(get|post|put|delete|patch|options|all)\(\s*["'`]([^"'`]*)["'`]/g;
// `app.on("PURGE" | ["GET", ...], "/path", handler)`.
const ON_RE =
  /(\w+)\.on\(\s*(?:["'`](\w+)["'`]|\[([^\]]*)\])\s*,\s*["'`]([^"'`]*)["'`]/g;
// `app.route("/prefix", subApp)` — mounts a sub-app (same- or cross-file).
const MOUNT_RE = /(\w+)\.route\(\s*["'`]([^"'`]*)["'`]\s*,\s*(\w+)\s*\)/g;
const EXPORT_RE = /(?:export\s+default|module\.exports\s*=)\s+(\w+)\s*;?/;

function methodOf(verb: string): string {
  return verb.toLowerCase() === "all" ? "*" : verb.toUpperCase();
}

function localVars(src: string, re: RegExp): Set<string> {
  return new Set([...src.matchAll(re)].map((m) => m[1] as string));
}

/**
 * Hono routing: `app.<method>("/x")` / `app.on(verb, "/x")` on a `new Hono()`
 * instance, each prefixed by the instance's `.basePath()`. A sub-app mounted
 * with `app.route("/prefix", subApp)` gets the mount composed in — resolved in
 * the same file or across files via the import that names the sub-app, with
 * nested mounts composing transitively.
 */
export const honoAdapter: RouteAdapter = {
  id: "hono",
  frameworks: ["Hono"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const sources = readSources(files, repo, SRC_EXTS);

    // Per file: Hono instance vars, their basePath, and the default-exported var.
    const appVarsByFile = new Map<string, Set<string>>();
    const basePathByVar = new Map<string, string>(); // "file::var" → base
    const exportedByFile = new Map<string, string>();
    for (const [path, src] of sources) {
      const vars = new Set<string>();
      for (const m of src.matchAll(APP_RE)) {
        vars.add(m[1] as string);
        if (m[2]) basePathByVar.set(`${path}::${m[1]}`, m[2] as string);
      }
      for (const m of src.matchAll(BASEPATH_RE)) {
        if (vars.has(m[1] as string)) basePathByVar.set(`${path}::${m[1]}`, m[2] as string);
      }
      appVarsByFile.set(path, vars);
      const exp = src.match(EXPORT_RE);
      if (exp && vars.has(exp[1] as string)) exportedByFile.set(path, exp[1] as string);
    }

    const baseOf = (path: string, v: string): string => basePathByVar.get(`${path}::${v}`) ?? "";

    // Mounts. Same-file: prefix keyed by "file::var". Cross-file: edges
    // fromFile → (targetFile, prefix incl. the receiver's basePath).
    const mountByLocalVar = new Map<string, string>();
    const edges = new Map<string, Array<{ target: string; prefix: string }>>();
    for (const [path, src] of sources) {
      const vars = appVarsByFile.get(path) ?? new Set<string>();
      const moduleOf = new Map<string, string>();
      for (const m of src.matchAll(REQUIRE_RE)) moduleOf.set(m[1] as string, m[2] as string);
      for (const m of src.matchAll(IMPORT_RE)) moduleOf.set(m[1] as string, m[2] as string);
      for (const m of src.matchAll(MOUNT_RE)) {
        const receiver = m[1] as string;
        if (!vars.has(receiver)) continue;
        const prefix = joinRoute(baseOf(path, receiver), m[2] as string);
        const mounted = m[3] as string;
        const spec = moduleOf.get(mounted);
        if (spec) {
          const target = resolveModule(path, spec, sources);
          if (!target) continue;
          const list = edges.get(path);
          if (list) list.push({ target, prefix });
          else edges.set(path, [{ target, prefix }]);
        } else if (vars.has(mounted)) {
          mountByLocalVar.set(`${path}::${mounted}`, prefix);
        }
      }
    }

    // Mount per file (applies to its default-exported app): BFS from files
    // that are never a mount target, composing prefixes transitively. A file
    // reached twice keeps its first (deterministic) mount.
    const targets = new Set([...edges.values()].flat().map((e) => e.target));
    const mountByFile = new Map<string, string>();
    const queue = [...sources.keys()]
      .filter((p) => !targets.has(p))
      .sort()
      .map((p) => ({ file: p, mount: "" }));
    while (queue.length > 0) {
      const { file, mount } = queue.shift() as { file: string; mount: string };
      for (const { target, prefix } of edges.get(file) ?? []) {
        if (mountByFile.has(target)) continue;
        const next = mount === "" ? prefix : joinRoute(mount, prefix);
        mountByFile.set(target, next);
        queue.push({ file: target, mount: next });
      }
    }

    const routes: RouteInfo[] = [];
    for (const [path, src] of sources) {
      const vars = appVarsByFile.get(path) ?? new Set<string>();
      if (vars.size === 0) continue;
      const exported = exportedByFile.get(path);
      const prefixFor = (v: string): string | null => {
        if (!vars.has(v)) return null;
        const mount =
          mountByLocalVar.get(`${path}::${v}`) ?? (v === exported ? (mountByFile.get(path) ?? "") : "");
        const base = baseOf(path, v);
        return mount === "" && base === "" ? "" : joinRoute(mount, base);
      };

      for (const m of src.matchAll(ROUTE_RE)) {
        const prefix = prefixFor(m[1] as string);
        if (prefix === null) continue;
        routes.push({
          route: joinRoute(prefix, m[3] as string),
          file: path,
          kind: "api",
          method: methodOf(m[2] as string),
        });
      }
      for (const m of src.matchAll(ON_RE)) {
        const prefix = prefixFor(m[1] as string);
        if (prefix === null) continue;
        const route = joinRoute(prefix, m[4] as string);
        const verbs = m[2]
          ? [m[2] as string]
          : (m[3] as string)
              .split(",")
              .map((s) => s.trim().replace(/^["'`]|["'`]$/g, ""))
              .filter(Boolean);
        for (const v of verbs) routes.push({ route, file: path, kind: "api", method: methodOf(v) });
      }
    }
    return routes;
  },
};
