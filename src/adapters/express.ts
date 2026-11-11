import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import {
  DEFAULT_EXPORT,
  type MountGraph,
  addMount,
  argumentBinding,
  leadingLiteral,
  moduleBindings,
  mountPrefixes,
  stringConstants,
  stringValue,
  type StringConstants,
} from "./js-modules.js";
import { JS_SRC_EXTS as SRC_EXTS, callArgs, chainCalls, joinRoute, lineAt, methodOf, readSources, resolveModule } from "./util.js";

// Optional TS annotation between a declared name and its `=`: `: Express`,
// `: express.Router`, `: Application<Locals>`.
const TYPE = String.raw`(?::\s*[\w$.]+(?:<[^>]*>)?\s*)?`;
// `const app = express()` / `require("express")()`.
const APP_RE = new RegExp(String.raw`(?:const|let|var)\s+(\w+)\s*${TYPE}=\s*(?:express|require\(\s*["'\`]express["'\`]\s*\))\s*\(\s*\)`, "g");
// `const r = express.Router()` / `Router({ mergeParams: true })` / `require("express").Router()`.
const ROUTER_RE = new RegExp(
  String.raw`(?:const|let|var)\s+(\w+)\s*${TYPE}=\s*(?:new\s+)?(?:express\.|require\(\s*["'\`]express["'\`]\s*\)\.)?Router\s*\(`,
  "g",
);
const USE_RE = /\b(\w+)\s*\.\s*use\s*\(/g;
// `ws` is express-ws's verb — it declares a WebSocket route (method "WS").
const VERBS = "get|post|put|delete|patch|options|head|all|ws";
// `app.get ("/x")` — whitespace before the `(` is legal and seen in the wild.
// The path is the call's first argument: a literal, a string constant, or a `+` of those.
const ROUTE_RE = new RegExp(String.raw`\b(\w+)(\s*\.\s*)(${VERBS})\s*\(`, "g");
const VERB_RE = new RegExp(`^(?:${VERBS})$`);
// `router.route("/x").get(h).post(h)` — match the path; the chained verbs are
// read by walking the calls that follow (across lines, balanced parens).
const ROUTE_CHAIN_RE = /\b(\w+)(\s*\.\s*)route\s*\(/g;
// `use(["/a", "/b"], r)`: an array of string literals mounts at every path.
const LITERAL_ARRAY_RE = /^\[\s*(["'`])[^"'`]*\1\s*(?:,\s*(["'`])[^"'`]*\2\s*)*,?\s*\]$/;

function localVars(src: string, re: RegExp): Set<string> {
  return new Set([...src.matchAll(re)].map((m) => m[1] as string));
}

/**
 * A route path, as opposed to a settings key: `app.get("env")` with one string
 * argument is Express's settings getter, so only "/…" and "*" count.
 */
function isRoutePath(p: string): boolean {
  return p.startsWith("/") || p === "*";
}

/**
 * Express routing: `app.<method>("/x")` / `router.<method>("/x")` prefixed by
 * every `use("/mount", …, router)` chain that reaches the receiver. A mount
 * names its router as a local var, a required/imported module, or an inline
 * `require()`; prefixes compose through nested `router.use()` mounts, and a
 * router mounted at two paths yields its routes under both.
 */
export const expressAdapter: RouteAdapter = {
  id: "express",
  frameworks: ["Express"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const sources = readSources(files, repo, SRC_EXTS);

    // Mount graph. A node is a file (its routers mounted by module) or a
    // "file::var" router mounted in its own file; "" is the unmounted root.
    // Each `use()` adds an edge receiver-node → mounted-node carrying the prefix.
    const instancesByFile = new Map<string, Set<string>>();
    const uses: Array<{ file: string; receiver: string; prefix: string; target: string }> = [];
    // String constants per file: a path may be `${API}/users` or `API_PREFIX`.
    const constsByFile = new Map<string, StringConstants>();
    for (const [path, src] of sources) {
      instancesByFile.set(path, new Set([...localVars(src, APP_RE), ...localVars(src, ROUTER_RE)]));
    }
    for (const [path, src] of sources) {
      const instances = instancesByFile.get(path) ?? new Set<string>();
      const bindings = moduleBindings(src);
      const consts = stringConstants(path, sources);
      constsByFile.set(path, consts);
      for (const m of src.matchAll(USE_RE)) {
        const call = callArgs(src, (m.index ?? 0) + (m[0] as string).length - 1);
        if (!call) continue;
        const first = call.args[0] ?? "";
        const literal = stringValue(first, consts);
        const list = literal === undefined && LITERAL_ARRAY_RE.test(first);
        const prefixes = literal !== undefined ? [literal] : list ? [...first.matchAll(/(["'`])([^"'`]*)\1/g)].map((p) => p[2] as string) : [""];
        // Every argument after the path may be the router — middleware
        // (`use("/api", auth, r)`) simply resolves to no mountable node.
        for (const arg of literal !== undefined || list ? call.args.slice(1) : call.args) {
          const imported = argumentBinding(arg, bindings);
          let target: string | null = null;
          if (imported) {
            target = resolveModule(path, imported.spec, sources);
            // `const { usersRouter } = require("./routes")`: that router only,
            // when the module declares it under the exported name.
            if (target && imported.exported !== DEFAULT_EXPORT && instancesByFile.get(target)?.has(imported.exported))
              target = `${target}::${imported.exported}`;
          } else if (instances.has(arg)) target = `${path}::${arg}`;
          if (target) for (const prefix of prefixes) uses.push({ file: path, receiver: m[1] as string, prefix, target });
        }
      }
    }
    const localTargets = new Set(uses.map((u) => u.target).filter((t) => t.includes("::")));
    // A receiver's node: its own "file::var" when mounted in-file, else its file.
    const nodeOf = (file: string, v: string): string => {
      if (!instancesByFile.get(file)?.has(v)) return "";
      const local = `${file}::${v}`;
      return localTargets.has(local) ? local : file;
    };
    const mounts: MountGraph = new Map();
    for (const u of uses) addMount(mounts, u.target, { from: nodeOf(u.file, u.receiver), prefix: u.prefix });
    const mountsOf = mountPrefixes(mounts);

    const routes: RouteInfo[] = [];
    for (const [path, src] of sources) {
      const instances = instancesByFile.get(path) ?? new Set<string>();
      if (instances.size === 0) continue;
      const consts = constsByFile.get(path);
      const seen = new Set<string>();
      const emit = (obj: string, routePath: string, verb: string | null, index: number) => {
        const line = lineAt(src, index);
        const method = verb ? methodOf(verb) : undefined;
        for (const mount of mountsOf(nodeOf(path, obj))) {
          const route = joinRoute(mount, routePath);
          const key = `${method} ${route} ${line}`;
          if (seen.has(key)) continue;
          seen.add(key);
          routes.push(method ? { route, file: path, line, kind: "api", method } : { route, file: path, line, kind: "api" });
        }
      };

      // `app.get("/a", h)` — plus verbs chained on its result (`.post("/b", h)`).
      for (const m of src.matchAll(ROUTE_RE)) {
        const obj = m[1] as string;
        if (!instances.has(obj)) continue;
        const verbAt = (m.index ?? 0) + obj.length + (m[2] as string).length;
        const call = callArgs(src, (m.index ?? 0) + m[0].length - 1);
        const routePath = stringValue(call ? call.args[0] : leadingLiteral(src, (m.index ?? 0) + m[0].length), consts);
        if (routePath !== undefined && isRoutePath(routePath)) emit(obj, routePath, m[3] as string, verbAt);
        if (!call) continue;
        for (const c of chainCalls(src, call.end)) {
          const p = stringValue(c.args[0], consts);
          if (VERB_RE.test(c.name) && p !== undefined && isRoutePath(p)) emit(obj, p, c.name, c.index);
        }
      }
      // `router.route("/x").get().post()` — one route per chained verb (or a
      // method-agnostic route when the chain declares no verb).
      for (const m of src.matchAll(ROUTE_CHAIN_RE)) {
        const obj = m[1] as string;
        if (!instances.has(obj)) continue;
        const call = callArgs(src, (m.index ?? 0) + m[0].length - 1);
        const routePath = call?.args.length === 1 ? stringValue(call.args[0], consts) : undefined;
        if (!call || routePath === undefined || !isRoutePath(routePath)) continue;
        const at = (m.index ?? 0) + obj.length + (m[2] as string).length;
        const verbs = chainCalls(src, call.end).filter((c) => VERB_RE.test(c.name));
        if (verbs.length) for (const v of verbs) emit(obj, routePath, v.name, at);
        else emit(obj, routePath, null, at);
      }
    }
    return routes;
  },
};
