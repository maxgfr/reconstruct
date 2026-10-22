import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { JS_SRC_EXTS as SRC_EXTS, callArgs, chainCalls, joinRoute, lineAt, readSources, resolveModule } from "./util.js";

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
const REQUIRE_RE = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
const REQUIRE_NAMED_RE = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
// `import a from "./x"`, `import { b, c as d } from "./x"`, or both.
const IMPORT_RE = /import\s+(?:type\s+)?(\w+)?\s*,?\s*(?:\{([^}]*)\})?\s*from\s*["'`](\.[^"'`]*)["'`]/g;
const USE_RE = /(\w+)\s*\.\s*use\s*\(/g;
// `ws` is express-ws's verb — it declares a WebSocket route (method "WS").
const VERBS = "get|post|put|delete|patch|options|head|all|ws";
const ROUTE_RE = new RegExp(String.raw`(\w+)(\s*\.\s*)(${VERBS})\(\s*["'\`]([^"'\`]*)["'\`]`, "g");
const VERB_RE = new RegExp(`^(?:${VERBS})$`);
// `router.route("/x").get(h).post(h)` — match the path; the chained verbs are
// read by walking the calls that follow (across lines, balanced parens).
const ROUTE_CHAIN_RE = /(\w+)(\s*\.\s*)route\(\s*["'`]([^"'`]*)["'`]\s*\)/g;
const LITERAL_RE = /^(["'`])([^"'`]*)\1$/;
const IDENT_RE = /^[A-Za-z_$][\w$]*$/;
const INLINE_REQUIRE_RE = /^require\(\s*["'`](\.[^"'`]*)["'`]\s*\)$/;

function methodOf(verb: string): string {
  return verb.toLowerCase() === "all" ? "*" : verb.toUpperCase();
}

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
 * Relative module spec per local name, from `require`/`import` (default and
 * named). A named binding also keeps the name it was exported under, so a
 * mount can target that one router rather than every router in the module.
 */
function moduleSpecs(src: string): Map<string, { spec: string; exported?: string }> {
  const out = new Map<string, { spec: string; exported?: string }>();
  const bind = (list: string, spec: string) => {
    for (const part of list.split(",")) {
      const [exported = "", local = exported] = part.trim().split(/\s+as\s+|\s*:\s*/);
      if (IDENT_RE.test(local) && IDENT_RE.test(exported)) out.set(local, { spec, exported });
    }
  };
  for (const m of src.matchAll(REQUIRE_RE)) out.set(m[1] as string, { spec: m[2] as string });
  for (const m of src.matchAll(REQUIRE_NAMED_RE)) bind(m[1] as string, m[2] as string);
  for (const m of src.matchAll(IMPORT_RE)) {
    if (m[1]) out.set(m[1], { spec: m[3] as string });
    if (m[2]) bind(m[2], m[3] as string);
  }
  return out;
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
    for (const [path, src] of sources) {
      instancesByFile.set(path, new Set([...localVars(src, APP_RE), ...localVars(src, ROUTER_RE)]));
    }
    for (const [path, src] of sources) {
      const instances = instancesByFile.get(path) ?? new Set<string>();
      const moduleOf = moduleSpecs(src);
      for (const m of src.matchAll(USE_RE)) {
        const call = callArgs(src, (m.index ?? 0) + (m[0] as string).length - 1);
        if (!call) continue;
        const literal = call.args[0]?.match(LITERAL_RE);
        const prefix = literal ? (literal[2] as string) : "";
        // Every argument after the path may be the router — middleware
        // (`use("/api", auth, r)`) simply resolves to no mountable node.
        for (const arg of literal ? call.args.slice(1) : call.args) {
          const inline = arg.match(INLINE_REQUIRE_RE)?.[1];
          const imported = inline ? { spec: inline } : IDENT_RE.test(arg) ? moduleOf.get(arg) : undefined;
          let target: string | null = null;
          if (imported) {
            target = resolveModule(path, imported.spec, sources);
            // `const { usersRouter } = require("./routes")`: that router only,
            // when the module declares it under the exported name.
            if (target && imported.exported && instancesByFile.get(target)?.has(imported.exported)) target = `${target}::${imported.exported}`;
          } else if (instances.has(arg)) target = `${path}::${arg}`;
          if (target) uses.push({ file: path, receiver: m[1] as string, prefix, target });
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
    const incoming = new Map<string, Array<{ from: string; prefix: string }>>();
    for (const u of uses) {
      const edge = { from: nodeOf(u.file, u.receiver), prefix: u.prefix };
      const list = incoming.get(u.target);
      if (list) list.push(edge);
      else incoming.set(u.target, [edge]);
    }
    // Every mount prefix of a node, composed through its mounters. A cycle
    // contributes nothing; a node with no resolvable mount is the root ("").
    const memo = new Map<string, string[]>();
    const mountsOf = (node: string): string[] => {
      const hit = memo.get(node);
      if (hit) return hit;
      memo.set(node, []);
      const all = new Set<string>();
      for (const e of incoming.get(node) ?? []) for (const p of mountsOf(e.from)) all.add(joinRoute(p, e.prefix));
      const out = all.size ? [...all] : [""];
      memo.set(node, out);
      return out;
    };

    const routes: RouteInfo[] = [];
    for (const [path, src] of sources) {
      const instances = instancesByFile.get(path) ?? new Set<string>();
      if (instances.size === 0) continue;
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
        if (isRoutePath(m[4] as string)) emit(obj, m[4] as string, m[3] as string, verbAt);
        const call = callArgs(src, verbAt + (m[3] as string).length);
        if (!call) continue;
        for (const c of chainCalls(src, call.end)) {
          const p = c.args[0]?.match(LITERAL_RE)?.[2];
          if (VERB_RE.test(c.name) && p !== undefined && isRoutePath(p)) emit(obj, p, c.name, c.index);
        }
      }
      // `router.route("/x").get().post()` — one route per chained verb (or a
      // method-agnostic route when the chain declares no verb).
      for (const m of src.matchAll(ROUTE_CHAIN_RE)) {
        const obj = m[1] as string;
        if (!instances.has(obj) || !isRoutePath(m[3] as string)) continue;
        const at = (m.index ?? 0) + obj.length + (m[2] as string).length;
        const verbs = chainCalls(src, (m.index ?? 0) + (m[0] as string).length).filter((c) => VERB_RE.test(c.name));
        if (verbs.length) for (const v of verbs) emit(obj, m[3] as string, v.name, at);
        else emit(obj, m[3] as string, null, at);
      }
    }
    return routes;
  },
};
