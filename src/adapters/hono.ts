import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { IDENT_RE, type MountGraph, addMount, moduleBindings, mountPrefixes, stringConstants, stringValue, type StringConstants } from "./js-modules.js";
import { type ChainedCall, JS_SRC_EXTS as SRC_EXTS, callArgs, chainCalls, joinRoute, lineAt, methodOf, readSources, resolveModule } from "./util.js";

// `new Hono()` / `new Hono<{ Bindings: Env }>()` — generics tolerated.
const NEW_RE = /new\s+Hono\s*(?:<[^()]*?>)?\s*\(/g;
// `x.method(` — the head of a call chain on a (possibly) known Hono instance.
const HEAD_RE = /(?<![\w$.])([A-Za-z_$][\w$]*)(?=\s*\.\s*[A-Za-z_$][\w$]*\s*\()/g;
// The text right before a chain that assigns it: `const app: Hono<E> =` / `app =`.
const ASSIGN_RE = /(?<![\w$.])([A-Za-z_$][\w$]*)\s*(?::\s*[\w$.]+(?:<[^;=]*>)?\s*)?=\s*$/;
const DEFAULT_BEFORE_RE = /(?:\bexport\s+default|\bmodule\.exports\s*=)\s*$/;
const EXPORT_DEFAULT_RE = /(?:export\s+default|module\.exports\s*=)\s+(\w+)\s*;?/;
const EXPORT_DECL_RE = /export\s+(?:const|let|var)\s+(\w+)/g;
const EXPORT_LIST_RE = /export\s*\{([^}]*)\}/g;
const EXPORT_PROP_RE = /(?:module\.)?exports\.(\w+)\s*=\s*(\w+)/g;
const VERB_RE = /^(?:get|post|put|delete|patch|options|all)$/;

/** A Hono instance var: `basePath()` copies share their parent's routes. */
interface HonoVar {
  parent: string | null;
  own: string;
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
    const callsByFile = new Map<string, Array<{ recv: string; fresh: boolean; rel: string; call: ChainedCall }>>();
    const exportsByFile = new Map<string, Map<string, string>>(); // export name → var
    // String constants per file: a path may be `${API}/users` or `API_PREFIX`.
    const constsByFile = new Map<string, StringConstants>();
    for (const [path, src] of sources) {
      const consts = stringConstants(path, src, sources, moduleBindings(src));
      constsByFile.set(path, consts);
      const vars = new Map<string, HonoVar>();
      const calls: Array<{ recv: string; fresh: boolean; rel: string; call: ChainedCall }> = [];
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
            const p = stringValue(call.args[0], consts);
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
    const mounts: MountGraph = new Map();
    for (const [path, src] of sources) {
      const vars = varsByFile.get(path) ?? new Map<string, HonoVar>();
      const bindings = moduleBindings(src);
      const consts = constsByFile.get(path);
      for (const { recv, fresh, rel, call } of callsByFile.get(path) ?? []) {
        const p = stringValue(call.args[0], consts);
        const mounted = call.args[1];
        if (call.name !== "route" || p === undefined || !mounted || !IDENT_RE.test(mounted)) continue;
        let target: string | null = null;
        const imported = bindings.get(mounted);
        if (vars.has(mounted)) {
          target = `${path}::${rootOf(vars, mounted)}`;
        } else if (imported) {
          const file = resolveModule(path, imported.spec, sources);
          const v = file ? exportsByFile.get(file)?.get(imported.exported) : undefined;
          const targetVars = file ? varsByFile.get(file) : undefined;
          if (file && v && targetVars?.has(v)) target = `${file}::${rootOf(targetVars, v)}`;
        }
        if (!target) continue;
        addMount(mounts, target, { from: `${path}::${rootOf(vars, recv)}`, prefix: joinRoute(fresh ? "" : baseOf(vars, recv), rel, p) });
      }
    }
    const mountsOf = mountPrefixes(mounts);

    const routes: RouteInfo[] = [];
    for (const [path, src] of sources) {
      const vars = varsByFile.get(path) ?? new Map<string, HonoVar>();
      const consts = constsByFile.get(path);
      const seen = new Set<string>();
      for (const { recv, fresh, rel, call } of callsByFile.get(path) ?? []) {
        let verbs: string[];
        let routePath: string | undefined;
        if (VERB_RE.test(call.name)) {
          verbs = [call.name];
          routePath = stringValue(call.args[0], consts);
        } else if (call.name === "on") {
          // `app.on("PURGE" | ["GET", ...], "/path", handler)`.
          const m = call.args[0] ?? "";
          verbs = (m.startsWith("[") ? m.slice(1, -1) : m)
            .split(",")
            .map((s) => s.trim().match(/^["'`](\w+)["'`]$/)?.[1] ?? "")
            .filter(Boolean);
          routePath = stringValue(call.args[1], consts);
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
