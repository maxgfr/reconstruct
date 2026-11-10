import { joinRoute } from "./util.js";

// The module graph the JS route adapters (express, hono, fastify, trpc) share:
// which relative module a local name is bound to, what a string argument's
// static value is, and under which prefixes a mounted node ends up.

export const IDENT_RE = /^[A-Za-z_$][\w$]*$/;

const REQUIRE_RE = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
const REQUIRE_NAMED_RE = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
// `import a from "./x"`, `import { b, c as d } from "./x"`, or both.
const IMPORT_RE = /import\s+(?:type\s+)?(\w+)?\s*,?\s*(?:\{([^}]*)\})?\s*from\s*["'`](\.[^"'`]*)["'`]/g;
const INLINE_REQUIRE_RE = /^require\(\s*["'`](\.[^"'`]*)["'`]\s*\)$/;

/** The export name of a default import or a whole-module `require`. */
export const DEFAULT_EXPORT = "default";

/** What a local name is bound to: a relative module and the name it exports the value under. */
export interface ModuleBinding {
  spec: string;
  /** The exported name; `DEFAULT_EXPORT` for `import x from` / `const x = require()`. */
  exported: string;
}

/**
 * Relative module binding per local name, from `import` (default, named, or
 * both) and `require` (whole module or destructured). A named binding keeps
 * the name it was exported under — `import { a as b }` and `const { a: b } =
 * require()` both bind `b` to the export `a`.
 */
export function moduleBindings(src: string): Map<string, ModuleBinding> {
  const out = new Map<string, ModuleBinding>();
  const named = (list: string, spec: string) => {
    for (const part of list.split(",")) {
      const [exported = "", local = exported] = part.trim().split(/\s+as\s+|\s*:\s*/);
      if (IDENT_RE.test(local) && IDENT_RE.test(exported)) out.set(local, { spec, exported });
    }
  };
  for (const m of src.matchAll(REQUIRE_RE)) out.set(m[1] as string, { spec: m[2] as string, exported: DEFAULT_EXPORT });
  for (const m of src.matchAll(REQUIRE_NAMED_RE)) named(m[1] as string, m[2] as string);
  for (const m of src.matchAll(IMPORT_RE)) {
    if (m[1]) out.set(m[1], { spec: m[3] as string, exported: DEFAULT_EXPORT });
    if (m[2]) named(m[2], m[3] as string);
  }
  return out;
}

/**
 * The module binding a call argument names: an inline `require("./x")`, or a
 * local name bound by an import/require of this file.
 */
export function argumentBinding(arg: string, bindings: Map<string, ModuleBinding>): ModuleBinding | undefined {
  const inline = arg.match(INLINE_REQUIRE_RE)?.[1];
  if (inline) return { spec: inline, exported: DEFAULT_EXPORT };
  return IDENT_RE.test(arg) ? bindings.get(arg) : undefined;
}

// ---------------------------------------------------------------------------
// String values

/** A string literal expression: its quote and its raw body. */
export const LITERAL_RE = /^(["'`])([^"'`]*)\1$/;

/** The body of a string-literal argument (`"x"`, `'x'`, a template), else undefined. */
export function stringValue(expr: string | undefined): string | undefined {
  return expr?.match(LITERAL_RE)?.[2];
}

// ---------------------------------------------------------------------------
// Mount graph

/** `from` mounts a node under `prefix`. */
export interface MountEdge {
  from: string;
  prefix: string;
}

/** The mounts of every node, by the node they mount. */
export type MountGraph = Map<string, MountEdge[]>;

export function addMount(graph: MountGraph, target: string, edge: MountEdge): void {
  const list = graph.get(target);
  if (list) list.push(edge);
  else graph.set(target, [edge]);
}

/**
 * Resolver for every prefix a node is reachable under, composed through its
 * mounters (memoised). A node mounted at two paths has two prefixes; a cycle
 * contributes nothing; a node nothing mounts is the root (`""`).
 */
export function mountPrefixes(graph: MountGraph): (node: string) => string[] {
  const memo = new Map<string, string[]>();
  const mountsOf = (node: string): string[] => {
    const hit = memo.get(node);
    if (hit) return hit;
    memo.set(node, []);
    const all = new Set<string>();
    for (const e of graph.get(node) ?? []) for (const p of mountsOf(e.from)) all.add(joinRoute(p, e.prefix));
    const out = all.size ? [...all] : [""];
    memo.set(node, out);
    return out;
  };
  return mountsOf;
}
