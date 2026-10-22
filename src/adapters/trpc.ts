import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { JS_SRC_EXTS as SRC_EXTS, lineAt, readSources, resolveModule } from "./util.js";

// A router declaration: `export const userRouter = createTRPCRouter({ … })` or
// the raw factory form `const adminRouter = t.router({ … })`. Captures the var
// name; the object body is balance-scanned from the `{` that follows.
const ROUTER_DECL_RE = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:createTRPCRouter|\w+\.router)\s*\(/g;
const REQUIRE_RE = /(?:const|let|var)\s+\{([^}]*)\}\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
const IMPORT_RE = /import\s+\{([^}]*)\}\s+from\s+["'`](\.[^"'`]*)["'`]/g;
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

// After one of these (or a keyword below) a `/` opens a regex literal, not a division.
const REGEX_AFTER = new Set(["", "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "<", ">", "~", "^"]);
const REGEX_KEYWORD_BEFORE = /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/;

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
  if (c === "/" && (REGEX_AFTER.has(last) || REGEX_KEYWORD_BEFORE.test(src.slice(Math.max(0, i - 12), i).trimEnd()))) {
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

const INLINE_ROUTER_RE = /^(?:createTRPCRouter|\w+\.router)\s*\(/;

/** Parse the object body `src[start, end)` into a RouterDef (procedures + child references). */
function parseRouterBody(src: string, start: number, end: number, file: string): RouterDef {
  const def: RouterDef = { file, procedures: [], children: [], inlineChildren: [] };
  for (const { key, value, keyAt, valueAt } of topLevelEntries(src, start, end)) {
    // Inline router first: its body holds `.query(`/`.mutation(` markers too.
    if (INLINE_ROUTER_RE.test(value)) {
      const inner = extractObjectBody(src, valueAt + value.indexOf("(") + 1);
      if (inner !== null) def.inlineChildren.push({ name: key, def: parseRouterBody(src, inner.start, inner.end, file) });
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
 * (or the raw `t.router({ … })`), composed into a tree by nesting routers under
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
    // Per file: `importedName -> targetFile` for router identifiers from imports.
    const importsByFile = new Map<string, Map<string, string>>();
    for (const [path, src] of sources) {
      const imports = new Map<string, string>();
      for (const re of [IMPORT_RE, REQUIRE_RE]) {
        for (const m of src.matchAll(re)) {
          const target = resolveModule(path, m[2] as string, sources);
          if (!target) continue;
          for (const name of (m[1] as string).split(",")) {
            const id = name
              .trim()
              .split(/\s+as\s+/)
              .pop()
              ?.trim();
            if (id) imports.set(id, target);
          }
        }
      }
      importsByFile.set(path, imports);

      for (const m of src.matchAll(ROUTER_DECL_RE)) {
        const varName = m[1] as string;
        const body = extractObjectBody(src, (m.index ?? 0) + m[0].length);
        if (body === null) continue; // not an object literal (mergeRouters, etc.)
        routers.set(`${path}::${varName}`, parseRouterBody(src, body.start, body.end, path));
      }
    }

    // Resolve a child reference `ref` used in `file` to a router id.
    const resolveRef = (file: string, ref: string): string | null => {
      if (routers.has(`${file}::${ref}`)) return `${file}::${ref}`; // same-file var
      const target = importsByFile.get(file)?.get(ref);
      if (target && routers.has(`${target}::${ref}`)) return `${target}::${ref}`;
      return null;
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
        if (!target || seen.has(target)) continue; // unresolved or cyclic
        emit(routers.get(target) as RouterDef, at(c.name), new Set([...seen, target]));
      }
    };

    for (const [id, def] of routers) if (!referenced.has(id)) emit(def, "", new Set([id]));
    return routes;
  },
};
