import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { JS_SRC_EXTS as SRC_EXTS, joinRoute, lineAt, readSources, resolveModule } from "./util.js";

// Optional TS annotation between a declared name and its `=`: `: FastifyInstance`.
const TYPE = String.raw`(?::\s*[\w$.]+(?:<[^>]*>)?\s*)?`;
// `const app = Fastify()` / `fastify()` / `require("fastify")()`.
const APP_RE = new RegExp(String.raw`(?:const|let|var)\s+(\w+)\s*${TYPE}=\s*(?:require\(\s*["'\`]fastify["'\`]\s*\)|[Ff]astify)\s*\(`, "g");
// The local name `fastify-plugin` is bound to (`fp` / `fastifyPlugin` by convention).
const FP_IMPORT_RE = /(?:import\s+(\w+)\s+from|(?:const|let|var)\s+(\w+)\s*=\s*require\()\s*["'`]fastify-plugin["'`]/g;
const REQUIRE_RE = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
const IMPORT_RE = /import\s+(\w+)\s+from\s+["'`](\.[^"'`]*)["'`]/g;
// `app.register(require("./x") | pluginVar, { prefix: "/p", ... })` — the
// inline-require branch must come first or `(\w+)` would swallow `require`.
const REGISTER_RE = /(\w+)\.register\(\s*(?:require\(\s*["'`](\.[^"'`]*)["'`]\s*\)|(\w+))\s*(?:,\s*\{([^}]*)\})?/g;
const PREFIX_RE = /\bprefix\s*:\s*["'`]([^"'`]*)["'`]/;
const ROUTE_RE = /(\w+)\.(get|head|post|put|delete|options|patch|all)\(\s*["'`]([^"'`]*)["'`]/g;
// `app.route({ method: "GET" | ["GET", ...], url: "/x", ... })` — match the
// receiver + opening brace; method/url are picked out of a bounded slice
// (handler bodies can nest braces, so a balanced capture is unreliable).
const ROUTE_OBJ_RE = /(\w+)\.route\(\s*\{/g;
const URL_RE = /\burl\s*:\s*["'`]([^"'`]*)["'`]/;
const METHOD_RE = /\bmethod\s*:\s*(?:["'`](\w+)["'`]|\[([^\]]*)\])/;

function methodOf(verb: string): string {
  return verb.toLowerCase() === "all" ? "*" : verb.toUpperCase();
}

/**
 * The instance parameter of the plugin this file exports — the receiver its
 * routes are declared on. Covers `module.exports = [async] function (app)`,
 * `export default [async] (app) =>`, and the indirect `async function routes
 * (app) {} … module.exports = routes` form — each also wrapped in
 * `fastify-plugin` (`export default fp(async (app) => {})`, `fp(routes)`).
 * `wrapped` reports that wrapper: such a plugin skips encapsulation.
 */
function pluginParam(src: string): { param: string; wrapped: boolean } | null {
  const names = new Set(["fp", "fastifyPlugin"]);
  for (const m of src.matchAll(FP_IMPORT_RE)) names.add((m[1] ?? m[2]) as string);
  // Optional `fp(` wrapper (group 1), then a function expression whose first
  // parameter is group 2 (`function (app)`) or group 3 (`(app) =>`).
  const fp = String.raw`(?:(${[...names].join("|")})\s*\(\s*)?`;
  const fn = String.raw`(?:(?:async\s+)?function\s*\w*\s*\(\s*(\w+)|(?:async\s*)?\(\s*(\w+))`;
  const exp = String.raw`(?:module\.exports\s*=|export\s+default)\s*`;
  const direct = src.match(new RegExp(exp + fp + fn));
  if (direct) return { param: (direct[2] ?? direct[3]) as string, wrapped: direct[1] !== undefined };
  const named = src.match(new RegExp(String.raw`${exp}${fp}(\w+)\s*(?:,[^)]*)?\)?\s*;?\s*$`, "m"));
  if (!named) return null;
  const name = named[2] as string;
  const decl = src.match(new RegExp(String.raw`function\s+${name}\s*\(\s*(\w+)`));
  if (decl) return { param: decl[1] as string, wrapped: named[1] !== undefined };
  const expr = src.match(new RegExp(String.raw`(?:const|let|var)\s+${name}\s*${TYPE}=\s*${fp}${fn}`));
  if (expr) return { param: (expr[2] ?? expr[3]) as string, wrapped: named[1] !== undefined || expr[1] !== undefined };
  return null;
}

function localVars(src: string, re: RegExp): Set<string> {
  return new Set([...src.matchAll(re)].map((m) => m[1] as string));
}

/**
 * Fastify routing: `app.<method>("/x")` and `app.route({ method, url })` on a
 * `Fastify()` instance are absolute; routes declared inside a plugin (the
 * exported `(fastify, opts)` function) are prefixed by the `register(plugin,
 * { prefix })` that mounts it — resolved across files via the require/import
 * that names the plugin, with nested registers composing transitively.
 */
export const fastifyAdapter: RouteAdapter = {
  id: "fastify",
  frameworks: ["Fastify"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const sources = readSources(files, repo, SRC_EXTS);

    // Receivers per file: Fastify() instances + this file's plugin parameter.
    const appVarsByFile = new Map<string, Set<string>>();
    const pluginParamByFile = new Map<string, string>();
    const unencapsulated = new Set<string>(); // fp()-wrapped plugin files
    for (const [path, src] of sources) {
      appVarsByFile.set(path, localVars(src, APP_RE));
      const plugin = pluginParam(src);
      if (plugin) pluginParamByFile.set(path, plugin.param);
      if (plugin?.wrapped) unencapsulated.add(path);
    }

    // Register edges: fromFile → (targetFile, prefix). Only registers on a
    // known receiver count — `someLib.register(...)` is not a route mount.
    const edges = new Map<string, Array<{ target: string; prefix: string }>>();
    for (const [path, src] of sources) {
      const receivers = new Set(appVarsByFile.get(path));
      const param = pluginParamByFile.get(path);
      if (param) receivers.add(param);
      const moduleOf = new Map<string, string>();
      for (const m of src.matchAll(REQUIRE_RE)) moduleOf.set(m[1] as string, m[2] as string);
      for (const m of src.matchAll(IMPORT_RE)) moduleOf.set(m[1] as string, m[2] as string);
      for (const m of src.matchAll(REGISTER_RE)) {
        if (!receivers.has(m[1] as string)) continue;
        const spec = (m[2] as string | undefined) ?? moduleOf.get(m[3] as string);
        if (!spec) continue;
        const target = resolveModule(path, spec, sources);
        if (!target) continue;
        // An fp()-wrapped plugin runs in its parent's context: Fastify ignores
        // the register `prefix` for it, so it inherits the parent's mount.
        const prefix = unencapsulated.has(target) ? "" : ((m[4] ?? "").match(PREFIX_RE)?.[1] ?? "");
        const list = edges.get(path);
        if (list) list.push({ target, prefix });
        else edges.set(path, [{ target, prefix }]);
      }
    }

    // Mount prefix per plugin file: walk the register edges from every file
    // that owns a Fastify() instance, composing prefixes transitively. A file
    // reached twice keeps its first (deterministic) mount; unreached plugins
    // emit their local paths unprefixed — honest, not heroic.
    const mountByFile = new Map<string, string>();
    const queue = [...sources.keys()]
      .filter((p) => (appVarsByFile.get(p)?.size ?? 0) > 0)
      .sort()
      .map((p) => ({ file: p, mount: "" }));
    while (queue.length > 0) {
      const { file, mount } = queue.shift() as { file: string; mount: string };
      for (const { target, prefix } of edges.get(file) ?? []) {
        if (mountByFile.has(target)) continue;
        const next = mount === "" && prefix === "" ? "" : joinRoute(mount, prefix);
        mountByFile.set(target, next);
        queue.push({ file: target, mount: next });
      }
    }

    const routes: RouteInfo[] = [];
    for (const [path, src] of sources) {
      const appVars = appVarsByFile.get(path) ?? new Set<string>();
      const param = pluginParamByFile.get(path);
      const prefixFor = (obj: string): string | null => {
        if (appVars.has(obj)) return "";
        if (obj === param) return mountByFile.get(path) ?? "";
        return null; // not a Fastify receiver in this file
      };

      for (const m of src.matchAll(ROUTE_RE)) {
        const prefix = prefixFor(m[1] as string);
        if (prefix === null) continue;
        // `app.get("/live", { websocket: true }, h)` (@fastify/websocket) is a
        // WebSocket route, not an HTTP GET — check the options right after the path.
        const tail = src.slice((m.index ?? 0) + (m[0] as string).length).slice(0, 200);
        const isWs = /^\s*,\s*\{[^}]*\bwebsocket\s*:\s*true/.test(tail);
        routes.push({
          route: joinRoute(prefix, m[3] as string),
          file: path,
          line: lineAt(src, m.index ?? 0),
          kind: "api",
          method: isWs ? "WS" : methodOf(m[2] as string),
        });
      }
      for (const m of src.matchAll(ROUTE_OBJ_RE)) {
        const prefix = prefixFor(m[1] as string);
        if (prefix === null) continue;
        const slice = src.slice(m.index ?? 0, (m.index ?? 0) + 400);
        const url = slice.match(URL_RE)?.[1];
        if (url === undefined) continue;
        const route = joinRoute(prefix, url);
        const line = lineAt(src, m.index ?? 0);
        if (/\bwebsocket\s*:\s*true/.test(slice)) {
          routes.push({ route, file: path, line, kind: "api", method: "WS" });
          continue;
        }
        const methodM = slice.match(METHOD_RE);
        const verbs = methodM?.[1]
          ? [methodM[1]]
          : (methodM?.[2] ?? "")
              .split(",")
              .map((s) => s.trim().replace(/^["'`]|["'`]$/g, ""))
              .filter(Boolean);
        if (verbs.length) {
          for (const v of verbs) routes.push({ route, file: path, line, kind: "api", method: methodOf(v) });
        } else {
          routes.push({ route, file: path, line, kind: "api" });
        }
      }
    }
    return routes;
  },
};
