import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import {
  DEFAULT_EXPORT,
  type ModuleBinding,
  argumentBinding,
  leadingLiteral,
  moduleBindings,
  literalValue,
  stringConstants,
  stringValue,
  type StringConstants,
} from "./js-modules.js";
import { JS_SRC_EXTS as SRC_EXTS, callArgs, chainCalls, joinRoute, lineAt, methodOf, readSources, resolveModule } from "./util.js";

// Optional TS annotation between a declared name and its `=`: `: FastifyInstance`.
const TYPE = String.raw`(?::\s*[\w$.]+(?:<[^>]*>)?\s*)?`;
// `const app = Fastify()` / `fastify()` / `require("fastify")()`.
const APP_RE = new RegExp(String.raw`(?:const|let|var)\s+(\w+)\s*${TYPE}=\s*(?:require\(\s*["'\`]fastify["'\`]\s*\)|[Ff]astify)\s*\(`, "g");
// The local name `fastify-plugin` is bound to (`fp` / `fastifyPlugin` by convention).
const FP_IMPORT_RE = /(?:import\s+(\w+)\s+from|(?:const|let|var)\s+(\w+)\s*=\s*require\()\s*["'`]fastify-plugin["'`]/g;
// `app.register(require("./x") | pluginVar, { prefix: "/p", ... })` — the
// arguments are read with a balanced scan, so nested option objects are fine.
const REGISTER_RE = /\b(\w+)\s*\.\s*register\s*\(/g;
// `prefix: "/p"`, `prefix: `${API}/p``, or `prefix: API_PREFIX`.
const VERBS = "get|head|post|put|delete|options|patch|all";
// `app.get("/x")`, also as `app\n  .get("/x")` (a multi-line chain).
// The path is the call's first argument: a literal, a string constant, or a `+` of those.
const ROUTE_RE = new RegExp(String.raw`\b(\w+)\s*\.\s*(${VERBS})\s*\(`, "g");
const VERB_RE = new RegExp(`^(?:${VERBS})$`);
const WS_OPTS_RE = /^\{[^}]*\bwebsocket\s*:\s*true/;
const isWsOpts = (opts: string | undefined): boolean => opts !== undefined && WS_OPTS_RE.test(opts);
// `app.route({ method: "GET" | ["GET", ...], url: "/x", ... })` — match the
// receiver + opening brace; method/url are picked out of a bounded slice
// (handler bodies can nest braces, so a balanced capture is unreliable).
const ROUTE_OBJ_RE = /\b(\w+)\.route\(\s*\{/g;
const URL_RE = /\burl\s*:\s*(?:(["'`])((?:(?!\1)[^\n])*)\1|([A-Za-z_$][\w$]*)(?=\s*[,}\n]))/;
const METHOD_RE = /\bmethod\s*:\s*(?:["'`](\w+)["'`]|\[([^\]]*)\])/;

/**
 * The instance parameter of the plugin this file exports — the receiver its
 * routes are declared on. Covers `module.exports = [async] function (app)`,
 * `export default [async] (app) =>`, and the indirect `async function routes
 * (app) {} … module.exports = routes` form — each also wrapped in
 * `fastify-plugin` (`export default fp(async (app) => {})`, `fp(routes)`).
 * `wrapped` reports that wrapper: such a plugin skips encapsulation.
 */
function pluginParam(src: string): { param: string; wrapped: boolean } | null {
  const { fp, fn } = pluginPatterns(src);
  const exp = String.raw`(?:module\.exports\s*=|export\s+default)\s*`;
  const direct = src.match(new RegExp(exp + fp + fn));
  if (direct) return { param: (direct[2] ?? direct[3]) as string, wrapped: direct[1] !== undefined };
  const named = src.match(new RegExp(String.raw`${exp}${fp}(\w+)\s*(?:,[^)]*)?\)?\s*;?\s*$`, "m"));
  if (!named) return null;
  const decl = declaredPluginParam(src, named[2] as string);
  return decl && { param: decl.param, wrapped: named[1] !== undefined || decl.wrapped };
}

/**
 * Regex sources for an optional `fp(` wrapper (group 1, over every local name
 * of `fastify-plugin`), then a function expression whose first parameter is
 * group 2 (`function (app)`) or group 3 (`(app) =>`).
 */
function pluginPatterns(src: string): { fp: string; fn: string } {
  const names = new Set(["fp", "fastifyPlugin"]);
  for (const m of src.matchAll(FP_IMPORT_RE)) names.add((m[1] ?? m[2]) as string);
  return {
    fp: String.raw`(?:(${[...names].join("|")})\s*\(\s*)?`,
    fn: String.raw`(?:(?:async\s+)?function\s*\w*\s*\(\s*(\w+)|(?:async\s*)?\(\s*(\w+))`,
  };
}

/**
 * The instance parameter of the plugin declared as `name` in this file —
 * `[async] function name(app)` or `const name = [fp(][async] (app) =>` — the
 * form a plugin exported by name (`export async function userRoutes(app)`) takes.
 */
function declaredPluginParam(src: string, name: string): { param: string; wrapped: boolean } | null {
  const decl = src.match(new RegExp(String.raw`function\s*\*?\s*${name}\s*\(\s*(\w+)`));
  if (decl) return { param: decl[1] as string, wrapped: false };
  const { fp, fn } = pluginPatterns(src);
  const expr = src.match(new RegExp(String.raw`(?:const|let|var)\s+${name}\s*${TYPE}=\s*${fp}${fn}`));
  if (expr) return { param: (expr[2] ?? expr[3]) as string, wrapped: expr[1] !== undefined };
  return null;
}

/**
 * The `prefix` of a register options object — its top-level `prefix` entry
 * only (`{ swagger: { prefix } }` is another plugin's), resolved through string
 * constants, shorthand `{ prefix }` included; "" when absent or not static.
 */
function registerPrefix(opts: string, consts: StringConstants | undefined): string {
  for (const entry of callArgs(opts, 0)?.args ?? []) {
    if (entry === "prefix") return consts?.get("prefix") ?? "";
    const value = entry.match(/^prefix\s*:\s*([\s\S]+)$/)?.[1];
    if (value !== undefined) return stringValue(value, consts) ?? "";
  }
  return "";
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
    const modulesByFile = new Map<string, Map<string, ModuleBinding>>();
    // String constants per file: a path may be `${API}/users` or `API_PREFIX`.
    const constsByFile = new Map<string, StringConstants>();
    const registersByFile = new Map<string, Array<{ receiver: string; args: string[] }>>();
    for (const [path, src] of sources) {
      appVarsByFile.set(path, localVars(src, APP_RE));
      const plugin = pluginParam(src);
      if (plugin) pluginParamByFile.set(path, plugin.param);
      if (plugin?.wrapped) unencapsulated.add(path);
      const bindings = moduleBindings(src);
      modulesByFile.set(path, bindings);
      constsByFile.set(path, stringConstants(path, sources));
      const registers: Array<{ receiver: string; args: string[] }> = [];
      for (const m of src.matchAll(REGISTER_RE)) {
        const call = callArgs(src, (m.index ?? 0) + (m[0] as string).length - 1);
        if (call?.args.length) registers.push({ receiver: m[1] as string, args: call.args });
      }
      registersByFile.set(path, registers);
    }
    // A plugin exported by name (`export async function userRoutes(app)`) is
    // a plugin only once some file registers it by that name — an exported
    // helper that nobody registers keeps its parameter a plain variable.
    for (const [path, registers] of registersByFile) {
      for (const { args } of registers) {
        const imported = argumentBinding(args[0] as string, modulesByFile.get(path) as Map<string, ModuleBinding>);
        if (!imported || imported.exported === DEFAULT_EXPORT) continue;
        const target = resolveModule(path, imported.spec, sources);
        if (!target || pluginParamByFile.has(target)) continue;
        const decl = declaredPluginParam(sources.get(target) as string, imported.exported);
        if (!decl) continue;
        pluginParamByFile.set(target, decl.param);
        if (decl.wrapped) unencapsulated.add(target);
      }
    }

    // Register edges: fromFile → (targetFile, prefix). Only registers on a
    // known receiver count — `someLib.register(...)` is not a route mount.
    const edges = new Map<string, Array<{ target: string; prefix: string }>>();
    for (const [path] of sources) {
      const receivers = new Set(appVarsByFile.get(path));
      const param = pluginParamByFile.get(path);
      if (param) receivers.add(param);
      const bindings = modulesByFile.get(path) as Map<string, ModuleBinding>;
      for (const { receiver, args } of registersByFile.get(path) ?? []) {
        if (!receivers.has(receiver)) continue;
        const spec = argumentBinding(args[0] as string, bindings)?.spec;
        if (!spec) continue;
        const target = resolveModule(path, spec, sources);
        if (!target) continue;
        // An fp()-wrapped plugin runs in its parent's context: Fastify ignores
        // the register `prefix` for it, so it inherits the parent's mount.
        const opts = args[1]?.startsWith("{") ? args[1] : "";
        const prefix = unencapsulated.has(target) ? "" : registerPrefix(opts, constsByFile.get(path));
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
      const consts = constsByFile.get(path);
      const prefixFor = (obj: string): string | null => {
        if (appVars.has(obj)) return "";
        if (obj === param) return mountByFile.get(path) ?? "";
        return null; // not a Fastify receiver in this file
      };

      for (const m of src.matchAll(ROUTE_RE)) {
        const prefix = prefixFor(m[1] as string);
        if (prefix === null) continue;
        const call = callArgs(src, (m.index ?? 0) + m[0].length - 1);
        const routePath = stringValue(call ? call.args[0] : leadingLiteral(src, (m.index ?? 0) + m[0].length), consts);
        // `app.get("/live", { websocket: true }, h)` (@fastify/websocket) is a
        // WebSocket route, not an HTTP GET — check the options right after the path.
        if (routePath !== undefined)
          routes.push({
            route: joinRoute(prefix, routePath),
            file: path,
            line: lineAt(src, m.index ?? 0),
            kind: "api",
            method: isWsOpts(call?.args[1]) ? "WS" : methodOf(m[2] as string),
          });
        // Shorthand routes return the instance: `app.get("/a", h).post("/b", h)`.
        if (!call) continue;
        for (const c of chainCalls(src, call.end)) {
          const p = stringValue(c.args[0], consts);
          if (!VERB_RE.test(c.name) || p === undefined) continue;
          routes.push({
            route: joinRoute(prefix, p),
            file: path,
            line: lineAt(src, c.index),
            kind: "api",
            method: isWsOpts(c.args[1]) ? "WS" : methodOf(c.name),
          });
        }
      }
      for (const m of src.matchAll(ROUTE_OBJ_RE)) {
        const prefix = prefixFor(m[1] as string);
        if (prefix === null) continue;
        const slice = src.slice(m.index ?? 0, (m.index ?? 0) + 400);
        const urlM = slice.match(URL_RE);
        const url = !urlM ? undefined : urlM[3] !== undefined ? consts?.get(urlM[3]) : literalValue(urlM[1] as string, urlM[2] as string, consts);
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
