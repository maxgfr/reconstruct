import { callArgs, joinRoute, resolveModule } from "./util.js";

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

// The body of a quoted literal: escapes, or anything but its own quote.
const BODY = String.raw`(?:\\[\s\S]|(?!\1)[^\\])*`;
/**
 * A string literal expression: its quote and its raw body. The body may hold
 * the other two quote characters (`"/it's"`, `` `/t/${cfg['x']}` ``) and
 * escaped ones (`'/it\'s'`).
 */
export const LITERAL_RE = new RegExp(String.raw`^(["'${"`"}])(${BODY})\1$`);
// One term of a `+` concatenation, then the `+` or the end.
const TERM_RE = new RegExp(String.raw`\s*(?:(["'${"`"}])(${BODY})\1|([A-Za-z_$][\w$]*))\s*(\+|$)`, "y");
// A leading literal: the start of an argument such as `'/api/' + v` or `'/x'.toLowerCase()`.
const LEADING_LITERAL_RE = new RegExp(String.raw`^\s*(["'${"`"}])(${BODY})\1`);
// A module-level `const NAME[: string] = <expression>`. Indented declarations
// are local to a block or function, so only column-0 ones count. The
// expression (up to `;` or the end of the line) is trimmed and read by
// `concatValue`; no part of this pattern can backtrack over a long run of
// blanks (a blanked comment is one).
const STRING_CONST_RE = /^(?:export[ \t]+)?const[ \t]+([A-Za-z_$][\w$]*)[ \t]*(?::[ \t]*string[ \t]*)?=([^;\n]*)/gm;
const AS_CONST_RE = /\s+as\s+const\s*$/;
const INTERPOLATION_RE = /\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g;

/** String constants by name, as an adapter sees them from one file. */
export type StringConstants = ReadonlyMap<string, string>;
const NO_CONSTANTS: StringConstants = new Map();

/**
 * The value of a quoted string body. Escaped quotes and backslashes are
 * unescaped; a template literal has each `${NAME}` that names a known string
 * constant replaced by its value. An interpolation with no static value is
 * left as written — the text is then the most faithful hint there is.
 */
export function literalValue(quote: string, body: string, consts?: StringConstants): string {
  const text = body.includes("\\") ? body.replace(/\\(["'`\\])/g, "$1") : body;
  if (quote !== "`" || !consts?.size || !text.includes("${")) return text;
  return text.replace(INTERPOLATION_RE, (whole, name: string) => consts.get(name) ?? whole);
}

/**
 * The value of `"a" + NAME + `b`` — string literals and names joined by `+`.
 * With `strict` (a constant's declaration), every name must be a known
 * constant and no `${…}` may remain. Otherwise (a route path), an unknown name
 * stays as `${name}` — like an unresolved template interpolation — so the
 * path keeps its known parts. Undefined when a term is anything else.
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
      if (v === undefined && strict) return undefined;
      out += v ?? `\${${m[3]}}`;
    } else {
      const v = literalValue(m[1] as string, m[2] as string, consts);
      if (strict && m[1] === "`" && v.includes("${")) return undefined;
      out += v;
    }
    at = TERM_RE.lastIndex;
    if (m[4] !== "+") return at >= expr.length ? out : undefined;
  }
}

/**
 * The static string value of an argument expression: a string literal (see
 * `literalValue`), a name bound to a string constant, or `+` concatenations of
 * those (an unknown name in one kept as `${name}`). Undefined otherwise.
 */
export function stringValue(expr: string | undefined, consts?: StringConstants): string | undefined {
  if (expr === undefined) return undefined;
  const m = expr.match(LITERAL_RE);
  if (m) return literalValue(m[1] as string, m[2] as string, consts);
  const trimmed = expr.trim();
  if (IDENT_RE.test(trimmed)) return consts?.get(trimmed);
  return trimmed.includes("+") ? concatValue(trimmed, consts, false) : undefined;
}

/**
 * A route path argument: its `stringValue`, else — for `'/x' as string` or
 * `'/x'.toLowerCase()` — the literal it starts with.
 */
export function pathValue(expr: string | undefined, consts?: StringConstants): string | undefined {
  const v = stringValue(expr, consts);
  if (v !== undefined || expr === undefined) return v;
  const m = expr.match(LEADING_LITERAL_RE);
  return m ? literalValue(m[1] as string, m[2] as string, consts) : undefined;
}

/** A string literal right at `at` (whitespace allowed), as written — for a call whose arguments do not balance. */
export function leadingLiteral(src: string, at: number): string | undefined {
  return src
    .slice(at, at + 2048)
    .match(LEADING_LITERAL_RE)?.[0]
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
      out.set(name, (m[2] as string).trim().replace(AS_CONST_RE, ""));
    }
  }
  return out;
}

// Every string or template literal, so a name inside one is not read as a binding.
const STRING_LITERALS_RE = /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\[\s\S]|[^`\\])*`/g;
// Where a parameter list opens: `function f(`, `catch (`, a method `name(` at
// the start of a line (not a control statement).
const PARAMS_OPEN_RES = [
  /\bfunction\b\s*(?:\*\s*)?[\w$]*\s*\(/g,
  /\bcatch\s*\(/g,
  /^[ \t]*(?:(?:async|static|get|set|public|private|protected|override)[ \t]+)*(?!(?:if|for|while|switch|with|return|catch|function)\b)[A-Za-z_$][\w$]*[ \t]*\((?=[^)\n]{0,512}\)[ \t]*(?::[^{;\n]{0,256})?\{)/gm,
];
// Where an arrow function's parameter list closes: `) =>` or `): T =>`.
const ARROW_CLOSE_RE = /\)\s*(?::[^=;{}()\n]{0,256})?=>/g;
// Other bindings: `let`/`var`, an indented `const`, a `for (const x`, a
// destructuring declaration, a single-parameter arrow (`x =>`, `async x =>`).
const LOCAL_BINDING_RES = [
  /\b(?:let|var)\s+([A-Za-z_$][\w$]*)/g,
  /^[ \t]+const\s+([A-Za-z_$][\w$]*)/gm,
  /\bfor\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
  /(?:^|[(,=?]|=>|\breturn|\basync)[ \t]*([A-Za-z_$][\w$]*)[ \t]*=>/gm,
];
const DESTRUCTURE_RE = /\b(?:const|let|var)\s*([{[][^=;]{0,512}?[}\]])\s*=/g;

/** The names a parameter list (or a destructuring pattern) binds. */
function boundNames(list: string, out: Set<string>): void {
  // Split on top-level commas; `<…>` counts as nesting, so a generic type
  // argument is not read as a parameter.
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === "(" || c === "[" || c === "{" || c === "<") depth++;
    else if (c === ")" || c === "]" || c === "}" || (c === ">" && list[i - 1] !== "=")) depth--;
    else if (c === "," && depth === 0) {
      parts.push(list.slice(from, i));
      from = i + 1;
    }
  }
  parts.push(list.slice(from));
  for (const raw of parts) {
    const part = raw.trim().replace(/^\.\.\./, "");
    if (part.startsWith("{") || part.startsWith("[")) {
      // A destructuring pattern: the names left of a default, right of a rename.
      const inner = part.slice(1, part.lastIndexOf(part[0] === "{" ? "}" : "]"));
      for (const piece of inner.split(",")) {
        const binding = (piece.includes(":") ? piece.slice(piece.indexOf(":") + 1) : piece).split("=")[0] ?? "";
        const name = binding
          .trim()
          .replace(/^\.\.\./, "")
          .match(/^[A-Za-z_$][\w$]*/)?.[0];
        if (name) out.add(name);
      }
      continue;
    }
    const name = part.match(/^[A-Za-z_$][\w$]*/)?.[0];
    if (name) out.add(name);
  }
}

/** The index of the `(` matching the `)` at `close`, looking back at most 1 024 characters. */
function openParenBefore(src: string, close: number): number {
  let depth = 0;
  for (let i = close; i >= 0 && close - i < 1024; i--) {
    if (src[i] === ")") depth++;
    else if (src[i] === "(" && --depth === 0) return i;
  }
  return -1;
}

/**
 * Names a file also binds as a parameter or a local variable. A module-level
 * constant of the same name may be shadowed where it is used
 * (`function mount(app, prefix) { app.use(prefix, r) }`), so it is not trusted.
 */
function shadowedNames(source: string): Set<string> {
  const src = source.replace(STRING_LITERALS_RE, '""');
  const out = new Set<string>();
  const list = (open: number) => {
    // A bounded window: an unclosed `(` must not cost a scan to the end.
    const call = callArgs(src.slice(open, open + 1024), 0);
    if (call) boundNames(call.args.join(","), out);
  };
  for (const re of PARAMS_OPEN_RES) for (const m of src.matchAll(re)) list((m.index ?? 0) + m[0].length - 1);
  for (const m of src.matchAll(ARROW_CLOSE_RE)) {
    const open = openParenBefore(src, m.index ?? 0);
    if (open !== -1) list(open);
  }
  for (const re of LOCAL_BINDING_RES) for (const m of src.matchAll(re)) out.add(m[1] as string);
  for (const m of src.matchAll(DESTRUCTURE_RE)) boundNames(m[1] as string, out);
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
