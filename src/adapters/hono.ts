import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { JS_SRC_EXTS as SRC_EXTS, joinRoute, lineAt, readSources, resolveModule } from "./util.js";

// `new Hono()` / `new Hono<{ Bindings: Env }>()` — generics tolerated.
const NEW_RE = /new\s+Hono\s*(?:<[^()]*?>)?\s*\(/g;
// `x.method(` — the head of a call chain on a (possibly) known Hono instance.
const HEAD_RE = /(?<![\w$.])([A-Za-z_$][\w$]*)(?=\s*\.\s*[A-Za-z_$][\w$]*\s*\()/g;
// The text right before a chain that assigns it: `const app: Hono<E> =` / `app =`.
const ASSIGN_RE = /(?<![\w$.])([A-Za-z_$][\w$]*)\s*(?::\s*[\w$.]+(?:<[^;=]*>)?\s*)?=\s*$/;
const DEFAULT_BEFORE_RE = /(?:\bexport\s+default|\bmodule\.exports\s*=)\s*$/;
const REQUIRE_RE = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
const REQUIRE_NAMED_RE = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
// `import a from "./x"`, `import { b, c as d } from "./x"`, or both.
const IMPORT_RE = /import\s+(?:type\s+)?(\w+)?\s*,?\s*(?:\{([^}]*)\})?\s*from\s*["'`](\.[^"'`]*)["'`]/g;
const EXPORT_DEFAULT_RE = /(?:export\s+default|module\.exports\s*=)\s+(\w+)\s*;?/;
const EXPORT_DECL_RE = /export\s+(?:const|let|var)\s+(\w+)/g;
const EXPORT_LIST_RE = /export\s*\{([^}]*)\}/g;
const EXPORT_PROP_RE = /(?:module\.)?exports\.(\w+)\s*=\s*(\w+)/g;
const VERB_RE = /^(?:get|post|put|delete|patch|options|all)$/;
const LITERAL_RE = /^(["'`])([^"'`]*)\1$/;
const IDENT_RE = /^[A-Za-z_$][\w$]*$/;

/** A Hono instance var: `basePath()` copies share their parent's routes. */
interface HonoVar {
  parent: string | null;
  own: string;
}

interface Call {
  name: string;
  args: string[];
  index: number;
}

function methodOf(verb: string): string {
  return verb.toLowerCase() === "all" ? "*" : verb.toUpperCase();
}

const literal = (arg: string | undefined): string | undefined => arg?.match(LITERAL_RE)?.[2];

/** Index of the quote closing the string literal opened at `i`. */
function skipString(src: string, i: number): number {
  const q = src[i];
  let j = i + 1;
  while (j < src.length && src[j] !== q) {
    if (src[j] === "\\") j++;
    else if (src[j] === "\n" && q !== "`") break;
    j++;
  }
  return j;
}

/**
 * The top-level arguments of the call whose `(` is at `open`, and the index
 * just past its `)`. Comments are already blanked by `readSources`, so only
 * string literals need skipping.
 */
function callArgs(src: string, open: number): { args: string[]; end: number } | null {
  const args: string[] = [];
  let depth = 0;
  let from = open + 1;
  for (let i = open; i < src.length; i++) {
    const c = src[i] as string;
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(src, i);
    } else if (c === "(" || c === "[" || c === "{") {
      depth++;
    } else if (c === ")" || c === "]" || c === "}") {
      if (--depth === 0) {
        args.push(src.slice(from, i));
        return { args: args.map((a) => a.trim()).filter(Boolean), end: i + 1 };
      }
    } else if (c === "," && depth === 1) {
      args.push(src.slice(from, i));
      from = i + 1;
    }
  }
  return null;
}

/** The `.name(args)` calls chained from `pos` onward — `x.a(1)\n  .b(2)` → a, b. */
function chainCalls(src: string, pos: number): Call[] {
  const calls: Call[] = [];
  const re = /(\s*\.\s*)([A-Za-z_$][\w$]*)\s*\(/y;
  for (;;) {
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) break;
    const call = callArgs(src, pos + m[0].length - 1);
    if (!call) break;
    calls.push({ name: m[2] as string, args: call.args, index: pos + (m[1] as string).length });
    pos = call.end;
  }
  return calls;
}

/** Relative module + imported export name per local name (`"default"` for default imports). */
function moduleSpecs(src: string): Map<string, { spec: string; name: string }> {
  const out = new Map<string, { spec: string; name: string }>();
  const named = (list: string, spec: string) => {
    for (const part of list.split(",")) {
      const [name, alias] = part
        .trim()
        .split(/\s+as\s+|\s*:\s*/)
        .map((s) => s.trim());
      if (name && IDENT_RE.test(alias ?? name)) out.set(alias ?? name, { spec, name });
    }
  };
  for (const m of src.matchAll(REQUIRE_RE)) out.set(m[1] as string, { spec: m[2] as string, name: "default" });
  for (const m of src.matchAll(REQUIRE_NAMED_RE)) named(m[1] as string, m[2] as string);
  for (const m of src.matchAll(IMPORT_RE)) {
    if (m[1]) out.set(m[1], { spec: m[3] as string, name: "default" });
    if (m[2]) named(m[2], m[3] as string);
  }
  return out;
}

/**
 * Hono routing: `app.<method>("/x")` / `app.on(verb, "/x")` on a `new Hono()`
 * instance — as separate statements or chained (`new Hono().get(..).post(..)`)
 * — each prefixed by the instance's `.basePath()`. `basePath()` returns a copy,
 * so `const v2 = app.basePath("/v2")` prefixes only `v2`'s routes. A sub-app
 * mounted with `app.route("/prefix", subApp)` gets the mount composed in —
 * resolved in the same file or across files via the default or named import
 * that names the sub-app, with nested mounts composing transitively.
 */
export const honoAdapter: RouteAdapter = {
  id: "hono",
  frameworks: ["Hono"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const sources = readSources(files, repo, SRC_EXTS);

    // Per file: Hono instance vars, the calls chained on them, and exports.
    // A call's `rel` is the basePath accumulated earlier in its own chain;
    // `fresh` chains start at `new Hono()`, so the var's base does not apply.
    const varsByFile = new Map<string, Map<string, HonoVar>>();
    const callsByFile = new Map<string, Array<{ recv: string; fresh: boolean; rel: string; call: Call }>>();
    const exportsByFile = new Map<string, Map<string, string>>(); // export name → var
    for (const [path, src] of sources) {
      const vars = new Map<string, HonoVar>();
      const calls: Array<{ recv: string; fresh: boolean; rel: string; call: Call }> = [];
      const exportsOf = new Map<string, string>();
      const heads: Array<{ index: number; start: number; name: string | null }> = [];
      for (const m of src.matchAll(NEW_RE)) {
        const ctor = callArgs(src, (m.index ?? 0) + (m[0] as string).length - 1);
        if (ctor) heads.push({ index: m.index ?? 0, start: ctor.end, name: null });
      }
      for (const m of src.matchAll(HEAD_RE)) {
        heads.push({ index: m.index ?? 0, start: (m.index ?? 0) + (m[1] as string).length, name: m[1] as string });
      }
      heads.sort((a, b) => a.index - b.index);
      // Source order: a var is known before the chains that use it.
      let anon = 0;
      for (const h of heads) {
        if (h.name !== null && !vars.has(h.name)) continue;
        const before = src.slice(Math.max(0, h.index - 200), h.index);
        const assigned = before.match(ASSIGN_RE)?.[1];
        const isDefault = DEFAULT_BEFORE_RE.test(before);
        const recv = h.name ?? assigned ?? (isDefault ? "*default" : `*anon${anon++}`);
        const chain = chainCalls(src, h.start);
        let rel = "";
        for (const call of chain) {
          if (call.name !== "basePath") calls.push({ recv, fresh: h.name === null, rel, call });
          else {
            const p = literal(call.args[0]);
            if (p !== undefined) rel = joinRoute(rel, p);
          }
        }
        // What the chain's value makes of the assigned (or receiver) var.
        const self = h.name === null ? undefined : vars.get(h.name);
        if (!self) {
          vars.set(recv, { parent: null, own: rel });
          if (isDefault) exportsOf.set("default", recv);
        } else if (assigned === h.name || (!assigned && chain.length > 0 && chain.every((c) => c.name === "basePath"))) {
          // `app = app.basePath("/x")`, or a bare `app.basePath("/x")` statement.
          if (rel) self.own = joinRoute(self.own, rel);
        } else if (assigned) {
          vars.set(assigned, { parent: h.name, own: rel });
        }
      }
      const def = src.match(EXPORT_DEFAULT_RE);
      if (def && vars.has(def[1] as string)) exportsOf.set("default", def[1] as string);
      for (const m of src.matchAll(EXPORT_DECL_RE)) exportsOf.set(m[1] as string, m[1] as string);
      for (const m of src.matchAll(EXPORT_PROP_RE)) exportsOf.set(m[1] as string, m[2] as string);
      for (const m of src.matchAll(EXPORT_LIST_RE)) {
        for (const part of (m[1] as string).split(",")) {
          const [local, name] = part.trim().split(/\s+as\s+/);
          if (local) exportsOf.set(name ?? local, local);
        }
      }
      varsByFile.set(path, vars);
      callsByFile.set(path, calls);
      exportsByFile.set(path, exportsOf);
    }

    // The original instance a var copies (mounts key on it), and its full base.
    const rootOf = (vars: Map<string, HonoVar>, v: string): string => {
      let cur = v;
      for (let i = 0; i < 32; i++) {
        const parent = vars.get(cur)?.parent;
        if (!parent) break;
        cur = parent;
      }
      return cur;
    };
    const baseOf = (vars: Map<string, HonoVar>, v: string, depth = 0): string => {
      const hv = vars.get(v);
      if (!hv) return "";
      return hv.parent && depth < 32 ? joinRoute(baseOf(vars, hv.parent, depth + 1), hv.own) : hv.own;
    };

    // Mount graph over "file::rootVar" nodes: `app.route("/p", sub)` is an edge
    // app → sub carrying the prefix (incl. the receiver's basePath).
    const incoming = new Map<string, Array<{ from: string; prefix: string }>>();
    for (const [path, src] of sources) {
      const vars = varsByFile.get(path) ?? new Map<string, HonoVar>();
      const moduleOf = moduleSpecs(src);
      for (const { recv, fresh, rel, call } of callsByFile.get(path) ?? []) {
        const p = literal(call.args[0]);
        const mounted = call.args[1];
        if (call.name !== "route" || p === undefined || !mounted || !IDENT_RE.test(mounted)) continue;
        let target: string | null = null;
        const imported = moduleOf.get(mounted);
        if (vars.has(mounted)) {
          target = `${path}::${rootOf(vars, mounted)}`;
        } else if (imported) {
          const file = resolveModule(path, imported.spec, sources);
          const v = file ? exportsByFile.get(file)?.get(imported.name) : undefined;
          const targetVars = file ? varsByFile.get(file) : undefined;
          if (file && v && targetVars?.has(v)) target = `${file}::${rootOf(targetVars, v)}`;
        }
        if (!target) continue;
        const edge = {
          from: `${path}::${rootOf(vars, recv)}`,
          prefix: joinRoute(fresh ? "" : baseOf(vars, recv), rel, p),
        };
        const list = incoming.get(target);
        if (list) list.push(edge);
        else incoming.set(target, [edge]);
      }
    }
    // Every mount prefix of a node, composed through its mounters. A cycle
    // contributes nothing; an unmounted instance is the root ("").
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
      const vars = varsByFile.get(path) ?? new Map<string, HonoVar>();
      const seen = new Set<string>();
      for (const { recv, fresh, rel, call } of callsByFile.get(path) ?? []) {
        let verbs: string[];
        let routePath: string | undefined;
        if (VERB_RE.test(call.name)) {
          verbs = [call.name];
          routePath = literal(call.args[0]);
        } else if (call.name === "on") {
          // `app.on("PURGE" | ["GET", ...], "/path", handler)`.
          const m = call.args[0] ?? "";
          verbs = (m.startsWith("[") ? m.slice(1, -1) : m)
            .split(",")
            .map((s) => s.trim().match(/^["'`](\w+)["'`]$/)?.[1] ?? "")
            .filter(Boolean);
          routePath = literal(call.args[1]);
        } else continue;
        if (routePath === undefined) continue;
        const base = joinRoute(fresh ? "" : baseOf(vars, recv), rel);
        const line = lineAt(src, call.index);
        for (const mount of mountsOf(`${path}::${rootOf(vars, recv)}`)) {
          const route = joinRoute(mount, base, routePath);
          for (const v of verbs) {
            const method = methodOf(v);
            const key = `${method} ${route} ${line}`;
            if (seen.has(key)) continue;
            seen.add(key);
            routes.push({ route, file: path, line, kind: "api", method });
          }
        }
      }
    }
    return routes;
  },
};
