import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { JS_SRC_EXTS as SRC_EXTS, readSources, resolveModule } from "./util.js";

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
  procedures: Array<{ name: string; method: string }>;
  /** Nested routers referenced by identifier (same-file var or imported). */
  children: Array<{ name: string; ref: string }>;
  /** Inline nested routers: `sub: createTRPCRouter({ … })`. */
  inlineChildren: Array<{ name: string; def: RouterDef }>;
}

/**
 * From an index at a `createTRPCRouter(` / `t.router(` match, find the object
 * literal's `{`, then return the body between it and its matching `}` (respecting
 * nested braces/parens/brackets, strings and template literals). Returns null
 * when the argument is not an object literal (`mergeRouters(...)`, a spread, a
 * bare variable) — those fall back to the existing apiCandidate hints.
 */
function extractObjectBody(src: string, fromIdx: number): string | null {
  let i = fromIdx;
  // Skip to the first non-space; it must be `{` for an object literal.
  while (i < src.length && /\s/.test(src[i] as string)) i++;
  if (src[i] !== "{") return null;
  const start = i;
  let depth = 0;
  let str: string | null = null;
  for (; i < src.length; i++) {
    const c = src[i] as string;
    if (str) {
      if (c === "\\") i++;
      else if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") str = c;
    else if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") {
      depth--;
      if (depth === 0) return src.slice(start + 1, i);
    }
  }
  return null;
}

/** Split an object body into top-level `key: value` (or shorthand) entries. */
function topLevelEntries(body: string): Array<{ key: string; value: string }> {
  const segments: string[] = [];
  let depth = 0;
  let str: string | null = null;
  let seg = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i] as string;
    if (str) {
      seg += c;
      if (c === "\\") {
        seg += body[i + 1] ?? "";
        i++;
      } else if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      str = c;
      seg += c;
      continue;
    }
    if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") depth--;
    if (c === "," && depth === 0) {
      segments.push(seg);
      seg = "";
      continue;
    }
    seg += c;
  }
  if (seg.trim()) segments.push(seg);

  const out: Array<{ key: string; value: string }> = [];
  for (const raw of segments) {
    const s = raw.trim();
    if (!s) continue;
    // First top-level `:` splits key from value (respecting nesting/strings).
    let d = 0;
    let q: string | null = null;
    let colon = -1;
    for (let i = 0; i < s.length; i++) {
      const c = s[i] as string;
      if (q) {
        if (c === "\\") i++;
        else if (c === q) q = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") q = c;
      else if (c === "{" || c === "(" || c === "[") d++;
      else if (c === "}" || c === ")" || c === "]") d--;
      else if (c === ":" && d === 0) {
        colon = i;
        break;
      }
    }
    if (colon === -1) {
      const key = /^\w+/.exec(s)?.[0];
      if (key) out.push({ key, value: key }); // shorthand `{ foo }`
    } else {
      const key = s
        .slice(0, colon)
        .trim()
        .replace(/^["'`]|["'`]$/g, "");
      out.push({ key, value: s.slice(colon + 1).trim() });
    }
  }
  return out;
}

function procedureMethod(value: string): string | null {
  for (const [re, method] of METHOD_MARKERS) if (re.test(value)) return method;
  return null;
}

const INLINE_ROUTER_RE = /^(?:createTRPCRouter|\w+\.router)\s*\(/;

/** Parse an object body into a RouterDef (procedures + child references). */
function parseRouterBody(body: string, file: string): RouterDef {
  const def: RouterDef = { file, procedures: [], children: [], inlineChildren: [] };
  for (const { key, value } of topLevelEntries(body)) {
    const method = procedureMethod(value);
    if (method) {
      def.procedures.push({ name: key, method });
      continue;
    }
    if (INLINE_ROUTER_RE.test(value)) {
      const inner = extractObjectBody(value, value.indexOf("(") + 1);
      if (inner !== null) def.inlineChildren.push({ name: key, def: parseRouterBody(inner, file) });
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
        routers.set(`${path}::${varName}`, parseRouterBody(body, path));
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
      for (const p of def.procedures) routes.push({ route: at(p.name), file: def.file, kind: "api", method: p.method });
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
