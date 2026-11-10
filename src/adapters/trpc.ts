import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { JS_SRC_EXTS as SRC_EXTS, lineAt, readSources, regexLiteralAllowedAt, resolveModule } from "./util.js";

// A router declaration: `export const userRouter = createTRPCRouter({ … })` or
// the raw factory form `const adminRouter = t.router({ … })`. Captures the var
// name; the object body is balance-scanned from the `{` that follows.
const ROUTER_DECL_RE = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(\w+(?:\.router)?)\s*\(/g;
// The factory alias the tRPC docs recommend: `export const router = t.router;`
// (a property read, not a call). Routers are then built as `router({ … })`.
const FACTORY_ALIAS_RE = /(?:const|let|var)\s+(\w+)\s*=\s*\w+\.router\s*(?=[;,)\n]|$)/gm;
const REQUIRE_RE = /(?:const|let|var)\s+\{([^}]*)\}\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
const IMPORT_RE = /import\s+(?:\w+\s*,\s*)?\{([^}]*)\}\s*from\s*["'`](\.[^"'`]*)["'`]/g;
// `import userRouter from "./user"` (optionally followed by `, { … }`).
const DEFAULT_IMPORT_RE = /import\s+(\w+)\s*(?:,\s*\{[^}]*\}\s*)?from\s*["'`](\.[^"'`]*)["'`]/g;
// `export default userRouter;` — the default export names a declared router.
const DEFAULT_EXPORT_VAR_RE = /export\s+default\s+(\w+)\s*;?\s*$/m;
// `export default createTRPCRouter({ … })` — an anonymous default router.
const DEFAULT_EXPORT_CALL_RE = /export\s+default\s+(\w+(?:\.router)?)\s*\(/g;
// A const that may hold a procedure: `const hello = publicProcedure.query(…)`.
// The value must start as a member chain (`x.` / `t.procedure.`); its extent is
// balance-scanned and must carry a procedure marker to count.
const PROC_DECL_RE = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?=[\w$]+\s*\.)/g;
const ROUTER_VALUE_RE = /\b(?:router|mergeRouters|createTRPCRouter)\s*\(/;
// A procedure chain ends in exactly one of these; a subscription wins, else a
// mutation, else a query (checked in that order below).
const METHOD_MARKERS: Array<[RegExp, string]> = [
  [/\.subscription\s*\(/, "SUBSCRIPTION"],
  [/\.mutation\s*\(/, "MUTATION"],
  [/\.query\s*\(/, "QUERY"],
];

/** A parsed router: the leaf procedures it declares + the child routers it mounts. */
interface RouterDef {
  file: string;
  /** Procedures declared directly on this router. */
  procedures: Array<{ name: string; method: string; line: number }>;
  /** Nested routers referenced by identifier (same-file var or imported). */
  children: Array<{ name: string; ref: string }>;
  /** Inline nested routers: `sub: createTRPCRouter({ … })`. */
  inlineChildren: Array<{ name: string; def: RouterDef }>;
}

const OPENERS = new Set(["{", "(", "["]);
const CLOSERS = new Set(["}", ")", "]"]);

/**
 * End (exclusive) of the string, template or regex literal opening at `i`, or
 * -1 when `src[i]` opens none. `last` is the previous significant code char
 * (`a` for an operand), which tells a regex `/` from a division.
 */
function literalEnd(src: string, i: number, last: string): number {
  const c = src[i];
  const n = src.length;
  if (c === '"' || c === "'") {
    for (let j = i + 1; j < n; j++) {
      if (src[j] === "\\") j++;
      else if (src[j] === c || src[j] === "\n") return j + 1;
    }
    return n;
  }
  if (c === "`") {
    for (let j = i + 1; j < n; j++) {
      if (src[j] === "\\") j++;
      else if (src[j] === "`") return j + 1;
      else if (src[j] === "$" && src[j + 1] === "{") {
        // `${ … }` holds code (nested templates/strings included).
        let depth = 0;
        scanCode(src, j + 1, n, (k, d) => {
          if (OPENERS.has(d)) depth++;
          else if (CLOSERS.has(d) && --depth === 0) {
            j = k;
            return true;
          }
          return false;
        });
      }
    }
    return n;
  }
  if (c === "/" && regexLiteralAllowedAt(src, i, last)) {
    let inClass = false;
    for (let j = i + 1; j < n && src[j] !== "\n"; j++) {
      const d = src[j];
      if (d === "\\") j++;
      else if (d === "[") inClass = true;
      else if (d === "]") inClass = false;
      else if (d === "/" && !inClass) {
        let k = j + 1;
        while (k < n && /[a-z]/i.test(src[k] as string)) k++; // flags
        return k;
      }
    }
    return -1; // no closing `/` on the line: a division after all
  }
  return -1;
}

/**
 * Visit every code char of `src[from, to)` — string, template and regex
 * literals are skipped whole — until `visit` returns true. Comments are already
 * blanked by readSources, so a quote in a comment or in a regex literal like
 * `/'/` can never open a phantom string that swallows the rest of a router.
 */
function scanCode(src: string, from: number, to: number, visit: (i: number, c: string) => boolean): void {
  let last = "";
  for (let i = from; i < to; ) {
    const end = literalEnd(src, i, last);
    if (end !== -1) {
      i = end;
      last = "a";
      continue;
    }
    const c = src[i] as string;
    if (visit(i, c)) return;
    if (!/\s/.test(c)) last = /[\w$)\].]/.test(c) ? "a" : c;
    i++;
  }
}

/**
 * From an index at a `createTRPCRouter(` / `t.router(` match, find the object
 * literal's `{`, then return the range of the body between it and its matching
 * `}` (respecting nested braces/parens/brackets and literals). Returns null when
 * the argument is not an object literal (`mergeRouters(...)`, a spread, a bare
 * variable) — those fall back to the existing apiCandidate hints.
 */
function extractObjectBody(src: string, fromIdx: number): { start: number; end: number } | null {
  let i = fromIdx;
  // Skip to the first non-space; it must be `{` for an object literal.
  while (i < src.length && /\s/.test(src[i] as string)) i++;
  if (src[i] !== "{") return null;
  const start = i + 1;
  let depth = 0;
  let end = -1;
  scanCode(src, i, src.length, (k, c) => {
    if (OPENERS.has(c)) depth++;
    else if (CLOSERS.has(c) && --depth === 0) {
      end = k;
      return true;
    }
    return false;
  });
  return end === -1 ? null : { start, end };
}

/** A top-level object entry; `keyAt`/`valueAt` are offsets into the source. */
interface Entry {
  key: string;
  value: string;
  keyAt: number;
  valueAt: number;
}

/** Split the object body `src[start, end)` into top-level `key: value` (or shorthand) entries. */
function topLevelEntries(src: string, start: number, end: number): Entry[] {
  const cuts = [start - 1];
  let depth = 0;
  scanCode(src, start, end, (i, c) => {
    if (OPENERS.has(c)) depth++;
    else if (CLOSERS.has(c)) depth--;
    else if (c === "," && depth === 0) cuts.push(i);
    return false;
  });
  cuts.push(end);

  const out: Entry[] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    let a = (cuts[k] as number) + 1;
    const b = cuts[k + 1] as number;
    while (a < b && /\s/.test(src[a] as string)) a++;
    if (a >= b) continue;
    // First top-level `:` splits key from value (respecting nesting/literals).
    let d = 0;
    let colon = -1;
    scanCode(src, a, b, (i, c) => {
      if (OPENERS.has(c)) d++;
      else if (CLOSERS.has(c)) d--;
      else if (c === ":" && d === 0) {
        colon = i;
        return true;
      }
      return false;
    });
    if (colon === -1) {
      const key = /^\w+/.exec(src.slice(a, b))?.[0];
      if (key) out.push({ key, value: key, keyAt: a, valueAt: a }); // shorthand `{ foo }`
    } else {
      const key = src
        .slice(a, colon)
        .trim()
        .replace(/^["'`]|["'`]$/g, "");
      const raw = src.slice(colon + 1, b);
      const value = raw.trim();
      out.push({ key, value, keyAt: a, valueAt: colon + 1 + (raw.length - raw.trimStart().length) });
    }
  }
  return out;
}

function procedureMethod(value: string): string | null {
  for (const [re, method] of METHOD_MARKERS) if (re.test(value)) return method;
  return null;
}

/**
 * End (exclusive) of the initializer expression starting at `from`: the first
 * top-level `;` or `,`, a closer that leaves the expression, or a top-level
 * newline not followed by a `.` chain continuation.
 */
function expressionEnd(src: string, from: number): number {
  let depth = 0;
  let end = src.length;
  scanCode(src, from, src.length, (i, c) => {
    if (OPENERS.has(c)) depth++;
    else if (CLOSERS.has(c) && --depth < 0) end = i;
    else if (depth === 0 && (c === ";" || c === ",")) end = i;
    else if (depth === 0 && c === "\n" && !/^\s*\./.test(src.slice(i + 1, i + 200))) end = i;
    return end !== src.length;
  });
  return end;
}

const INLINE_CALL_RE = /^(\w+(?:\.router)?)\s*\(/;

/**
 * Whether `callee` builds a tRPC router: `createTRPCRouter`, any `x.router`, or
 * a bare name bound to the `t.router` factory (`factories`, per file).
 */
function isRouterFactory(callee: string, factories: ReadonlySet<string>): boolean {
  return callee === "createTRPCRouter" || callee.endsWith(".router") || factories.has(callee);
}

/** Parse the object body `src[start, end)` into a RouterDef (procedures + child references). */
function parseRouterBody(src: string, start: number, end: number, file: string, factories: ReadonlySet<string>): RouterDef {
  const def: RouterDef = { file, procedures: [], children: [], inlineChildren: [] };
  for (const { key, value, keyAt, valueAt } of topLevelEntries(src, start, end)) {
    // Inline router first: its body holds `.query(`/`.mutation(` markers too.
    const call = INLINE_CALL_RE.exec(value);
    if (call && isRouterFactory(call[1] as string, factories)) {
      const inner = extractObjectBody(src, valueAt + value.indexOf("(") + 1);
      if (inner !== null) def.inlineChildren.push({ name: key, def: parseRouterBody(src, inner.start, inner.end, file, factories) });
      continue;
    }
    const method = procedureMethod(value);
    if (method) {
      def.procedures.push({ name: key, method, line: lineAt(src, keyAt) });
      continue;
    }
    const ident = /^\w+$/.exec(value.trim());
    if (ident) def.children.push({ name: key, ref: value.trim() });
  }
  return def;
}

/**
 * tRPC routing: procedures live on routers built with `createTRPCRouter({ … })`
 * (or the raw `t.router({ … })`, or a `router({ … })` alias of `t.router`), composed into a tree by nesting routers under
 * keys (`{ user: userRouter }`), same-file or cross-file. This adapter resolves
 * each procedure's dot-path (`user.list`) and its kind (QUERY / MUTATION /
 * SUBSCRIPTION) by walking the tree from every root router. Router composition it
 * can't statically resolve (spreads, `mergeRouters(...)`) is left to the
 * apiCandidate hints — the adapter only ever adds routes it can prove.
 */
export const trpcAdapter: RouteAdapter = {
  id: "trpc",
  frameworks: [],
  libraries: ["tRPC"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const sources = readSources(files, repo, SRC_EXTS);

    // Parse every router declaration into a RouterDef keyed by `file::varName`.
    const routers = new Map<string, RouterDef>();
    // Per file: `localName -> { target file, exported name }` for router
    // identifiers from imports (`import { userRouter as u }` binds `u` to the
    // target's `userRouter`; CommonJS renames with `userRouter: u`).
    const importsByFile = new Map<string, Map<string, { target: string; exported: string }>>();
    // Per file: bare names bound to the `t.router` factory there.
    const aliasesByFile = new Map<string, Set<string>>();
    // Per file: the variable `export default <var>` names.
    const defaultVarByFile = new Map<string, string>();
    // Procedures declared as consts, keyed by `file::varName`.
    const procedures = new Map<string, { file: string; line: number; method: string }>();
    for (const [path, src] of sources) {
      const imports = new Map<string, { target: string; exported: string }>();
      for (const re of [IMPORT_RE, REQUIRE_RE]) {
        for (const m of src.matchAll(re)) {
          const target = resolveModule(path, m[2] as string, sources);
          if (!target) continue;
          for (const name of (m[1] as string).split(",")) {
            const [exported, local] = name
              .trim()
              .split(re === IMPORT_RE ? /\s+as\s+/ : /\s*:\s*/)
              .map((x) => x.trim());
            if (exported) imports.set(local || exported, { target, exported });
          }
        }
      }
      for (const m of src.matchAll(DEFAULT_IMPORT_RE)) {
        const target = resolveModule(path, m[2] as string, sources);
        if (target) imports.set(m[1] as string, { target, exported: "default" });
      }
      importsByFile.set(path, imports);
      const defaultVar = DEFAULT_EXPORT_VAR_RE.exec(src)?.[1];
      if (defaultVar) defaultVarByFile.set(path, defaultVar);
      for (const m of src.matchAll(PROC_DECL_RE)) {
        const from = (m.index ?? 0) + m[0].length;
        const value = src.slice(from, expressionEnd(src, from));
        // A router value (`t.router({ a: p.query() })`) holds markers too — never a procedure.
        if (ROUTER_VALUE_RE.test(value)) continue;
        const method = procedureMethod(value);
        if (method) procedures.set(`${path}::${m[1]}`, { file: path, line: lineAt(src, m.index ?? 0), method });
      }
      const aliases = new Set<string>();
      for (const m of src.matchAll(FACTORY_ALIAS_RE)) aliases.add(m[1] as string);
      if (aliases.size) aliasesByFile.set(path, aliases);
    }

    for (const [path, src] of sources) {
      // The bare factory names valid in THIS file: declared here, or imported
      // from the file that declares them — an unrelated `router()` never counts.
      const factories = new Set(aliasesByFile.get(path) ?? []);
      for (const [local, { target, exported }] of importsByFile.get(path) ?? []) {
        if (aliasesByFile.get(target)?.has(exported)) factories.add(local);
      }
      for (const m of src.matchAll(ROUTER_DECL_RE)) {
        if (!isRouterFactory(m[2] as string, factories)) continue;
        const varName = m[1] as string;
        const body = extractObjectBody(src, (m.index ?? 0) + m[0].length);
        if (body === null) continue; // not an object literal (mergeRouters, etc.)
        routers.set(`${path}::${varName}`, parseRouterBody(src, body.start, body.end, path, factories));
      }
      for (const m of src.matchAll(DEFAULT_EXPORT_CALL_RE)) {
        if (!isRouterFactory(m[1] as string, factories)) continue;
        const body = extractObjectBody(src, (m.index ?? 0) + m[0].length);
        if (body !== null) routers.set(`${path}::default`, parseRouterBody(src, body.start, body.end, path, factories));
      }
    }

    // The `file::name` id a reference `ref` used in `file` points at: a
    // same-file var, else the export it was imported from (a default import
    // resolves through `export default <var>` when the module has one).
    const refIds = (file: string, ref: string): string[] => {
      const ids = [`${file}::${ref}`];
      const imported = importsByFile.get(file)?.get(ref);
      if (imported) {
        const name = imported.exported === "default" ? (defaultVarByFile.get(imported.target) ?? "default") : imported.exported;
        ids.push(`${imported.target}::${name}`);
      }
      return ids;
    };
    // Resolve a child reference `ref` used in `file` to a router id.
    const resolveRef = (file: string, ref: string): string | null => refIds(file, ref).find((id) => routers.has(id)) ?? null;
    // Resolve it to a procedure const instead (`{ hello }`, `{ hi: hello }`).
    const resolveProcedure = (file: string, ref: string) => {
      const id = refIds(file, ref).find((k) => procedures.has(k));
      return id === undefined ? undefined : procedures.get(id);
    };

    // Roots = routers never mounted as a child of another router.
    const referenced = new Set<string>();
    for (const [id, def] of routers) {
      const file = id.slice(0, id.lastIndexOf("::"));
      for (const c of def.children) {
        const target = resolveRef(file, c.ref);
        if (target) referenced.add(target);
      }
    }

    const routes: RouteInfo[] = [];
    const emit = (def: RouterDef, prefix: string, seen: Set<string>): void => {
      const at = (name: string): string => (prefix ? `${prefix}.${name}` : name);
      for (const p of def.procedures) routes.push({ route: at(p.name), file: def.file, line: p.line, kind: "api", method: p.method });
      for (const ic of def.inlineChildren) emit(ic.def, at(ic.name), seen);
      for (const c of def.children) {
        const target = resolveRef(def.file, c.ref);
        if (!target) {
          const proc = resolveProcedure(def.file, c.ref);
          if (proc) routes.push({ route: at(c.name), file: proc.file, line: proc.line, kind: "api", method: proc.method });
          continue;
        }
        if (seen.has(target)) continue; // cyclic
        emit(routers.get(target) as RouterDef, at(c.name), new Set([...seen, target]));
      }
    };

    for (const [id, def] of routers) if (!referenced.has(id)) emit(def, "", new Set([id]));
    return routes;
  },
};
