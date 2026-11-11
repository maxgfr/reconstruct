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

/**
 * A string literal expression: its quote and its raw body. The body may hold
 * the other two quote characters (`"/it's"`, `` `/t/${cfg['x']}` ``).
 */
export const LITERAL_RE = /^(["'`])((?:(?!\1)[^\n])*)\1$/;
// One term of a `+` concatenation, then the `+` or the end.
const TERM_RE = /\s*(?:(["'`])((?:(?!\1)[^\n])*)\1|([A-Za-z_$][\w$]*))\s*(\+|$)/y;
// A module-level `const NAME[: string] = <expression>[ as const];`. Indented
// declarations are local to a block or function, so only column-0 ones count;
// the expression is read by `concatValue`.
const STRING_CONST_RE =
  /^(?:export[ \t]+)?const[ \t]+([A-Za-z_$][\w$]*)[ \t]*(?::[ \t]*string[ \t]*)?=[ \t]*([^;\n]+?)[ \t]*(?:as[ \t]+const[ \t]*)?;?[ \t]*$/gm;
const INTERPOLATION_RE = /\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g;

/** String constants by name, as an adapter sees them from one file. */
export type StringConstants = ReadonlyMap<string, string>;
const NO_CONSTANTS: StringConstants = new Map();

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
 * The value of `"a" + NAME + `b`` — string literals and names of string
 * constants joined by `+`. Undefined when a term is anything else or names no
 * constant. With `strict`, a template left with an unresolved `${…}` fails too.
 */
function concatValue(expr: string, consts: StringConstants | undefined, strict: boolean): string | undefined {
  let out = "";
  let at = 0;
  for (;;) {
    TERM_RE.lastIndex = at;
    const m = TERM_RE.exec(expr);
    if (!m || m[0] === "") return undefined;
    if (m[3] !== undefined) {
      const v = consts?.get(m[3]);
      if (v === undefined) return undefined;
      out += v;
    } else {
      const v = literalValue(m[1] as string, m[2] as string, consts);
      if (strict && m[1] === "`" && INTERPOLATION_RE.test(v)) return undefined;
      INTERPOLATION_RE.lastIndex = 0;
      out += v;
    }
    at = TERM_RE.lastIndex;
    if (m[4] !== "+") return at >= expr.length ? out : undefined;
  }
}

/**
 * The static string value of an argument expression: a string literal (see
 * `literalValue`), a name bound to a string constant, or `+` concatenations of
 * those. Undefined otherwise.
 */
export function stringValue(expr: string | undefined, consts?: StringConstants): string | undefined {
  if (expr === undefined) return undefined;
  const m = expr.match(LITERAL_RE);
  if (m) return literalValue(m[1] as string, m[2] as string, consts);
  const trimmed = expr.trim();
  if (IDENT_RE.test(trimmed)) return consts?.get(trimmed);
  return trimmed.includes("+") ? concatValue(trimmed, consts, false) : undefined;
}

/** A string literal right at `at` (whitespace allowed), as written — for a call whose arguments do not balance. */
export function leadingLiteral(src: string, at: number): string | undefined {
  return src
    .slice(at, at + 2048)
    .match(/^\s*(["'`])(?:(?!\1)[^\n])*\1/)?.[0]
    .trim();
}

/** The module-level `const` declarations of one file, unevaluated (a name declared twice is dropped). */
function declaredConstants(src: string): Map<string, string> {
  const out = new Map<string, string>();
  const twice = new Set<string>();
  for (const m of src.matchAll(STRING_CONST_RE)) {
    const name = m[1] as string;
    if (out.has(name) || twice.has(name)) {
      out.delete(name);
      twice.add(name);
    } else {
      out.set(name, m[2] as string);
    }
  }
  return out;
}

const PARAM_LIST_RES = [
  /\bfunction\b\s*\*?\s*[\w$]*\s*\(([^)]*)\)/g,
  /\(([^()]*)\)\s*(?::\s*[^=;{}()]+)?=>/g,
  /\bcatch\s*\(([^)]*)\)/g,
  // A method: `name(params) {` at the start of a line, not a control statement.
  /^[ \t]*(?:(?:async|static|get|set|public|private|protected|override)\s+)*(?!(?:if|for|while|switch|with|return|catch|function)\b)[A-Za-z_$][\w$]*\s*\(([^)]*)\)\s*(?::[^{;]*)?\{/gm,
];
const LOCAL_BINDING_RES = [/\b(?:let|var)\s+([A-Za-z_$][\w$]*)/g, /^[ \t]+const\s+([A-Za-z_$][\w$]*)/gm, /(?<![\w$.)\]])([A-Za-z_$][\w$]*)\s*=>/g];

/**
 * Names a file also binds as a parameter or a local variable. A module-level
 * constant of the same name may be shadowed where it is used
 * (`function mount(app, prefix) { app.use(prefix, r) }`), so it is not trusted.
 */
function shadowedNames(src: string): Set<string> {
  const out = new Set<string>();
  for (const re of PARAM_LIST_RES) {
    for (const m of src.matchAll(re)) {
      for (const part of (m[1] as string).split(",")) {
        const name = part
          .split(/[=:]/)[0]
          ?.replace(/^[\s.{[]+/, "")
          .match(/^[A-Za-z_$][\w$]*/)?.[0];
        if (name) out.add(name);
      }
    }
  }
  for (const re of LOCAL_BINDING_RES) for (const m of src.matchAll(re)) out.add(m[1] as string);
  return out;
}

// Per source set (one adapter pass reuses its Map): the constants visible in each file.
const constantsBySources = new WeakMap<Map<string, string>, Map<string, Map<string, string>>>();

/**
 * Every file's visible string constants, resolved together: what it imports
 * by name from a relative module (`import { API_PREFIX } from "./config"`)
 * and what it declares at module level, composed from those
 * (`const V1 = \`${API_PREFIX}/v1\``, `const V2 = API_PREFIX + "/v2"`). Values
 * are propagated to a fixpoint, so the walk order and import cycles do not
 * change the result. A name the file also binds as a parameter or a local is
 * left out. Re-exports are not followed.
 */
function resolveConstants(sources: Map<string, string>): Map<string, Map<string, string>> {
  const files: Array<{ file: string; decls: Map<string, string>; imports: Array<{ local: string; target: string; exported: string }> }> = [];
  for (const [file, text] of sources) {
    const decls = text.includes("const") ? declaredConstants(text) : new Map<string, string>();
    const imports: Array<{ local: string; target: string; exported: string }> = [];
    if (text.includes("import") || text.includes("require")) {
      for (const [local, { spec, exported }] of moduleBindings(text)) {
        if (exported === DEFAULT_EXPORT || decls.has(local)) continue;
        const target = resolveModule(file, spec, sources);
        if (target) imports.push({ local, target, exported });
      }
    }
    if (!decls.size && !imports.length) continue;
    const shadowed = shadowedNames(text);
    for (const name of shadowed) decls.delete(name);
    const kept = imports.filter((i) => !shadowed.has(i.local));
    if (decls.size || kept.length) files.push({ file, decls, imports: kept });
  }
  const out = new Map<string, Map<string, string>>(files.map((f) => [f.file, new Map()]));
  // Values only ever get added, so this ends; each round settles one more hop.
  for (let round = 0; round < 32; round++) {
    let changed = false;
    for (const { file, decls, imports } of files) {
      const vals = out.get(file) as Map<string, string>;
      for (const { local, target, exported } of imports) {
        if (vals.has(local)) continue;
        const v = out.get(target)?.get(exported);
        if (v === undefined) continue;
        vals.set(local, v);
        changed = true;
      }
      for (const [name, expr] of decls) {
        if (vals.has(name)) continue;
        const v = concatValue(expr, vals, true);
        if (v === undefined) continue;
        vals.set(name, v);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return out;
}

/** The string constants visible in `path` (see `resolveConstants`). */
export function stringConstants(path: string, sources: Map<string, string>): StringConstants {
  let all = constantsBySources.get(sources);
  if (!all) {
    all = resolveConstants(sources);
    constantsBySources.set(sources, all);
  }
  return all.get(path) ?? NO_CONSTANTS;
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
