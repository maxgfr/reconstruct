import { joinRoute, resolveModule } from "./util.js";

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
// A module-level `const NAME = "value"` (optionally exported, annotated
// `: string`, or `as const`). Indented declarations are local to a function
// and may be shadowed, so only column-0 ones count.
const STRING_CONST_RE =
  /^(?:export[ \t]+)?const[ \t]+([A-Za-z_$][\w$]*)[ \t]*(?::[ \t]*string[ \t]*)?=[ \t]*(["'`])([^"'`\n]*)\2[ \t]*(?:as[ \t]+const[ \t]*)?;?[ \t]*$/gm;
const INTERPOLATION_RE = /\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g;

/** String constants by name, as an adapter sees them from one file. */
export type StringConstants = ReadonlyMap<string, string>;

/**
 * The value of a quoted string body. A template literal has each `${NAME}`
 * that names a known string constant replaced by its value; an interpolation
 * with no static value is left as written — the text is then the most faithful
 * hint there is.
 */
export function literalValue(quote: string, body: string, consts?: StringConstants): string {
  if (quote !== "`" || !consts?.size || !body.includes("${")) return body;
  return body.replace(INTERPOLATION_RE, (whole, name: string) => consts.get(name) ?? whole);
}

/**
 * The static string value of an argument expression: a string literal (see
 * `literalValue`), or a name bound to a string constant. Undefined otherwise.
 */
export function stringValue(expr: string | undefined, consts?: StringConstants): string | undefined {
  if (expr === undefined) return undefined;
  const m = expr.match(LITERAL_RE);
  if (m) return literalValue(m[1] as string, m[2] as string, consts);
  return IDENT_RE.test(expr) ? consts?.get(expr) : undefined;
}

/** The module-level string constants one file declares, unresolved (a name declared twice is dropped). */
function declaredConstants(src: string): Map<string, { quote: string; body: string }> {
  const out = new Map<string, { quote: string; body: string }>();
  if (!src.includes("const")) return out;
  const twice = new Set<string>();
  for (const m of src.matchAll(STRING_CONST_RE)) {
    const name = m[1] as string;
    if (out.has(name) || twice.has(name)) {
      out.delete(name);
      twice.add(name);
    } else {
      out.set(name, { quote: m[2] as string, body: m[3] as string });
    }
  }
  return out;
}

// Per source set (one adapter pass reuses its Map): the constants visible in
// each file, imports followed.
const constantsBySources = new WeakMap<Map<string, string>, Map<string, Map<string, string>>>();

/**
 * The string constants visible in `path`: those it imports by name from a
 * relative module (`import { API_PREFIX } from "./config"`), then the ones it
 * declares at module level, each composed from the constants before it
 * (`const V1 = \`${API_PREFIX}/v1\``). A template with an interpolation that has
 * no static value is not a constant. Re-exports are not followed.
 */
export function stringConstants(path: string, src: string, sources: Map<string, string>, bindings?: Map<string, ModuleBinding>): StringConstants {
  let cache = constantsBySources.get(sources);
  if (!cache) {
    cache = new Map();
    constantsBySources.set(sources, cache);
  }
  const memo = cache;
  const inProgress = new Set<string>();
  const visible = (file: string, text: string, binds: Map<string, ModuleBinding> | undefined): Map<string, string> => {
    const hit = memo.get(file);
    if (hit) return hit;
    // An import cycle: the file being resolved contributes nothing to itself.
    if (inProgress.has(file)) return new Map();
    inProgress.add(file);
    const declared = declaredConstants(text);
    const out = new Map<string, string>();
    if (text.includes("import") || text.includes("require")) {
      for (const [local, { spec, exported }] of binds ?? moduleBindings(text)) {
        if (exported === DEFAULT_EXPORT || declared.has(local)) continue;
        const target = resolveModule(file, spec, sources);
        const value = target ? visible(target, sources.get(target) as string, undefined).get(exported) : undefined;
        if (value !== undefined) out.set(local, value);
      }
    }
    for (const [name, { quote, body }] of declared) {
      const value = literalValue(quote, body, out);
      if (!(quote === "`" && value.includes("${"))) out.set(name, value);
    }
    inProgress.delete(file);
    memo.set(file, out);
    return out;
  };
  return visible(path, src, bindings);
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
