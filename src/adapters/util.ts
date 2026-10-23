import { statSync } from "node:fs";
import { join } from "node:path";
import { readText } from "../read-cache.js";
import type { FileInfo } from "../types.js";

/**
 * Largest source file an adapter reads. Route tables live in hand-written
 * files; anything past this is generated or minified, and reading it whole
 * would only cost memory and regex time.
 */
export const MAX_SOURCE_BYTES = 2 * 1024 * 1024;

// The comment-stripped sources of the current detection pass, keyed by
// absolute path. Six JS adapters read the same files; within one pass each
// file is read and stripped once. Scoped to `withSourceCache`, so nothing
// outlives a pass and a file edited between two analyses is always re-read.
let sourceCache: Map<string, string | null> | null = null;

/** Run `fn` with one shared read of every source file it asks for. */
export function withSourceCache<T>(fn: () => T): T {
  if (sourceCache) return fn();
  sourceCache = new Map();
  try {
    return fn();
  } finally {
    sourceCache = null;
  }
}

/** Read the source of every walked file whose extension is in `exts`. */
export function readSources(files: FileInfo[], repo: string, exts: string[]): Map<string, string> {
  const set = new Set(exts);
  const out = new Map<string, string>();
  for (const f of files) {
    if (!set.has(f.ext)) continue;
    const abs = join(repo, f.path);
    const cached = sourceCache?.get(abs);
    if (cached !== undefined) {
      if (cached !== null) out.set(f.path, cached);
      continue;
    }
    let src: string | null = null;
    try {
      if ((f.size || statSync(abs).size) <= MAX_SOURCE_BYTES) {
        // Comments blanked to spaces (offsets and line numbers unchanged): a
        // commented-out `app.get("/old")` is not a route, and an apostrophe in
        // a `// don't` comment must not be read as an open string literal.
        const raw = readText(abs);
        src = raw === null ? null : stripComments(raw, f.ext);
      }
    } catch {
      /* unreadable — skip */
    }
    sourceCache?.set(abs, src);
    if (src !== null) out.set(f.path, src);
  }
  return out;
}

/** Locale-independent string order (code units) — `localeCompare` varies by machine. */
export function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Line-start offsets of the last source asked about. Adapters call lineAt once
// per match while scanning one file, so a one-entry cache turns a rescan from
// offset 0 per match into one pass per file plus a binary search per lookup.
let startsSrc: string | undefined;
let starts: number[] = [];

/** 1-based line number of a character offset. */
export function lineAt(src: string, offset: number): number {
  if (src !== startsSrc) {
    starts = [0];
    for (let i = src.indexOf("\n"); i !== -1; i = src.indexOf("\n", i + 1)) starts.push(i + 1);
    startsSrc = src;
  }
  // Number of line starts at or before the offset.
  const at = Math.min(offset, src.length);
  let lo = 0;
  let hi = starts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((starts[mid] as number) <= at) lo = mid + 1;
    else hi = mid;
  }
  return Math.max(1, lo);
}

/** Join route segments (prefixes + a path) into one normalized "/a/b" route. */
export function joinRoute(...parts: string[]): string {
  const segs = parts.join("/").split("/").filter(Boolean);
  return "/" + segs.join("/");
}

type CommentSyntax = "js" | "jsx" | "c" | "python" | "ruby";

const SYNTAX_BY_EXT: Record<string, CommentSyntax> = {
  ".js": "js",
  ".jsx": "jsx",
  ".ts": "js",
  ".tsx": "jsx",
  ".mts": "js",
  ".cts": "js",
  ".mjs": "js",
  ".cjs": "js",
  ".go": "c",
  ".cs": "c",
  ".java": "c",
  ".kt": "c",
  ".py": "python",
  ".rb": "ruby",
};

// After one of these (or a keyword below) a `/` starts a regex literal, not a division.
const REGEX_PRECEDES = new Set(["", "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "<", ">", "~", "^"]);
// Ruby: after these a `/` opens a regex (`path: /x/`, `=~ /x/`, `(/x/`).
const RUBY_REGEX_PRECEDES = new Set(["", "(", ",", "=", ":", "[", "{", "!", "&", "|", "~"]);
const REGEX_KEYWORD_BEFORE = /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/;

/**
 * Whether a JS `/` at `i` opens a regex literal rather than a division. `last`
 * is the previous significant code char (`a` for an operand, `""` at start).
 */
export function regexLiteralAllowedAt(src: string, i: number, last: string): boolean {
  return REGEX_PRECEDES.has(last) || REGEX_KEYWORD_BEFORE.test(src.slice(Math.max(0, i - 12), i).trimEnd());
}

/**
 * Replace every comment with spaces, keeping newlines, so offsets and line
 * numbers of the remaining code are unchanged. String literals (and JS regex
 * and template literals) are recognised so a `//` or `#` inside one survives.
 * Unknown extensions come back untouched.
 */
export function stripComments(src: string, ext: string): string {
  const syntax = SYNTAX_BY_EXT[ext.toLowerCase()];
  if (!syntax) return src;
  // No comment introducer at all: nothing to blank (most data-ish files).
  if (syntax === "python" ? !src.includes("#") : syntax === "ruby" ? !src.includes("#") && !src.includes("=begin") : !src.includes("/")) return src;
  const n = src.length;
  // Blanked ranges, flat [from, to, …] in increasing order (the scanner only
  // moves forward); the result is assembled once from slices.
  const ranges: number[] = [];
  const blank = (from: number, to: number) => {
    if (to > from) ranges.push(from, Math.min(to, n));
  };
  const assemble = (): string => {
    if (ranges.length === 0) return src;
    let res = "";
    let at = 0;
    for (let k = 0; k < ranges.length; k += 2) {
      const from = ranges[k] as number;
      const to = ranges[k + 1] as number;
      res += src.slice(at, from) + src.slice(from, to).replace(/[^\n]/g, " ");
      at = to;
    }
    return res + src.slice(at);
  };
  const eolFrom = (from: number) => {
    const eol = src.indexOf("\n", from);
    return eol === -1 ? n : eol;
  };
  // Index just past a quoted string opened at `start`.
  const skipString = (q: string, start: number, multiline: boolean, escapes = true): number => {
    let j = start + 1;
    while (j < n) {
      const c = src[j];
      if (escapes && c === "\\") {
        j += 2;
        continue;
      }
      if (c === q) return j + 1;
      if (c === "\n" && !multiline) return j;
      j++;
    }
    return n;
  };

  // The previous significant code char (`a` for an operand): decides whether a
  // `/` opens a regex literal.
  let last = "";

  if (syntax === "python" || syntax === "ruby") {
    let i = 0;
    while (i < n) {
      const c = src[i] as string;
      if (syntax === "ruby" && c === "=" && (i === 0 || src[i - 1] === "\n") && src.startsWith("=begin", i)) {
        const end = src.indexOf("\n=end", i);
        const stop = end === -1 ? n : eolFrom(end + 1);
        blank(i, stop);
        i = stop;
      } else if (c === "#") {
        const stop = eolFrom(i);
        blank(i, stop);
        i = stop;
      } else if (c === '"' || c === "'") {
        if (syntax === "python" && src.startsWith(c.repeat(3), i)) {
          const end = src.indexOf(c.repeat(3), i + 3);
          i = end === -1 ? n : end + 3;
        } else {
          // Single-line even in Ruby (which allows multi-line strings): a quote
          // this scanner misreads — inside a %-literal or a heredoc — then
          // costs one line, not every comment below it.
          i = skipString(c, i, false);
        }
        last = "a";
      } else if (syntax === "ruby" && c === "/" && RUBY_REGEX_PRECEDES.has(last)) {
        // A Ruby regex literal (`constraints: { path: /[^']+/ }`): its quotes
        // and `#` are not code. Bounded to the line, like strings.
        i = skipString("/", i, false);
        last = "a";
      } else {
        const code = src.charCodeAt(i);
        if (!isSpaceCode(code)) last = isOperandEnd(code) || code === 125 /* } */ ? "a" : c;
        i++;
      }
    }
    return assemble();
  }

  // JS template literals nest (`${ `inner` }`): each entry is the brace depth
  // at which the enclosing template body resumes.
  const templates: number[] = [];
  let depth = 0;
  const skipTemplate = (from: number): number => {
    let j = from;
    while (j < n) {
      const d = src[j];
      if (d === "\\") {
        j += 2;
        continue;
      }
      if (d === "`") return j + 1;
      if (d === "$" && src[j + 1] === "{") {
        templates.push(depth);
        return j + 2;
      }
      j++;
    }
    return n;
  };

  let i = 0;
  while (i < n) {
    const c = src[i] as string;
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      const stop = eolFrom(i);
      blank(i, stop);
      i = stop;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      // Not a comment: an unterminated `/*` (a scanner misread, or a syntax
      // error) and, in JSX, a `/*` in element text — anything but whitespace
      // or `{` before it on its line, without a close on that same line.
      // Blanking those would erase every route down to the next `*/`.
      const lineStart = src.lastIndexOf("\n", i) + 1;
      const jsxText = syntax === "jsx" && !/^[\s{]*$/.test(src.slice(lineStart, i)) && (end === -1 || end > eolFrom(i));
      if (end === -1 || jsxText) {
        i += 2;
        continue;
      }
      blank(i, end + 2);
      i = end + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      if (syntax === "c" && c === '"' && src[i - 1] === "@") {
        // C# verbatim string: "" is an escaped quote, no backslash escapes.
        let j = i + 1;
        while (j < n && !(src[j] === '"' && src[j + 1] !== '"')) j += src[j] === '"' ? 2 : 1;
        i = j + 1;
      } else {
        i = skipString(c, i, false);
      }
      last = "a";
      continue;
    }
    if (c === "`") {
      // Go raw string (no escapes) vs JS template literal.
      i = syntax === "c" ? skipString("`", i, true, false) : skipTemplate(i + 1);
      last = "a";
      continue;
    }
    if (syntax === "js" || syntax === "jsx") {
      if (c === "/" && regexLiteralAllowedAt(src, i, last)) {
        let j = i + 1;
        let inClass = false;
        while (j < n && src[j] !== "\n") {
          const d = src[j];
          if (d === "\\") {
            j += 2;
            continue;
          }
          if (d === "[") inClass = true;
          else if (d === "]") inClass = false;
          else if (d === "/" && !inClass) break;
          j++;
        }
        i = j + 1;
        last = "a";
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") {
        if (templates.length && templates[templates.length - 1] === depth) {
          templates.pop();
          i = skipTemplate(i + 1);
          last = "a";
          continue;
        }
        depth--;
      }
    }
    const code = src.charCodeAt(i);
    if (!isSpaceCode(code)) last = isOperandEnd(code) || code === 46 /* . */ ? "a" : c;
    i++;
  }
  return assemble();
}

/** `/\s/` on one UTF-16 unit, without a regex for the ASCII range. */
function isSpaceCode(code: number): boolean {
  if (code < 128) return code === 32 || (code >= 9 && code <= 13);
  return /\s/.test(String.fromCharCode(code));
}

/** `[\w$)\]]`: a char that ends an operand, so a following `/` divides. */
function isOperandEnd(code: number): boolean {
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) || // a-z
    code === 95 || // _
    code === 36 || // $
    code === 41 || // )
    code === 93 // ]
  );
}

/** JS/TS source extensions the JS-family route adapters read. */
export const JS_SRC_EXTS = [".js", ".ts", ".mts", ".cts", ".mjs", ".cjs"];

function dirOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}

/** Resolve a relative import/require spec to a file present in `sources`. */
export function resolveModule(fromFile: string, spec: string, sources: Map<string, string>, exts: string[] = JS_SRC_EXTS): string | null {
  const segs: string[] = [];
  for (const s of `${dirOf(fromFile)}/${spec}`.split("/")) {
    if (s === "" || s === ".") continue;
    if (s === "..") segs.pop();
    else segs.push(s);
  }
  const base = segs.join("/");
  // TypeScript ESM imports name the EMITTED file: `./users.js` for `users.ts`.
  const stem = base.replace(/\.(?:js|jsx|mjs|cjs)$/, "");
  const emitted = stem === base ? [] : exts.map((e) => stem + e);
  for (const cand of [base, ...exts.map((e) => base + e), ...exts.map((e) => `${base}/index${e}`), ...emitted]) {
    if (sources.has(cand)) return cand;
  }
  return null;
}

// ---------------------------------------------------------------------------
// JS call scanning shared by the JS-family adapters (express, hono). Call
// arguments nest calls, objects and literals, so they are split on TOP-LEVEL
// commas of a bracket-balanced, string-aware scan.

/** Index of the quote closing the JS string literal opened at `i`. */
function skipJsString(src: string, i: number): number {
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
export function callArgs(src: string, open: number): { args: string[]; end: number } | null {
  const args: string[] = [];
  let depth = 0;
  let from = open + 1;
  for (let i = open; i < src.length; i++) {
    const c = src[i] as string;
    if (c === '"' || c === "'" || c === "`") {
      i = skipJsString(src, i);
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

/** One `.name(args)` link of a call chain; `index` is the offset of `name`. */
export interface ChainedCall {
  name: string;
  args: string[];
  index: number;
}

/** The `.name(args)` calls chained from `pos` onward — `x.a(1)\n  .b(2)` → a, b. */
export function chainCalls(src: string, pos: number): ChainedCall[] {
  const calls: ChainedCall[] = [];
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

// ---------------------------------------------------------------------------
// Python module resolution and call parsing shared by the Python adapters
// (fastapi, flask, django).

/** "routes/users.py" -> "routes.users" so an import path matches a file. */
export function moduleName(path: string): string {
  return path
    .replace(/\.py$/, "")
    .replace(/\/__init__$/, "")
    .split("/")
    .join(".");
}

/**
 * Resolve a Python module reference to a file in `sources`. Handles relative
 * imports (`.routers.items` from `app/main.py`) and source roots the import
 * path does not spell (`src/app/routers/items.py` for `app.routers.items`).
 */
export function resolvePythonModule(fromFile: string, module: string, sources: Map<string, string>): string | null {
  let abs = module;
  const dots = module.match(/^\.+/)?.[0].length ?? 0;
  if (dots) {
    const pkg = dirOf(fromFile).split("/").filter(Boolean);
    pkg.splice(pkg.length - (dots - 1));
    abs = [...pkg, ...module.slice(dots).split(".").filter(Boolean)].join(".");
  }
  let index = pythonModuleIndexes.get(sources);
  if (!index) {
    const byModule = new Map<string, string>();
    for (const p of sources.keys()) if (p.endsWith(".py")) byModule.set(moduleName(p), p);
    index = { byModule, bySuffix: new Map() };
    pythonModuleIndexes.set(sources, index);
  }
  const exact = index.byModule.get(abs);
  if (exact) return exact;
  // Otherwise the shortest path whose module name ends with `.abs`: the
  // unspelled prefix is a source root like `src/` or `backend/`.
  if (!index.bySuffix.has(abs)) {
    const suffix = `.${abs}`;
    const hits = [...index.byModule.entries()].filter(([m]) => m.endsWith(suffix)).map(([, p]) => p);
    hits.sort((a, b) => a.length - b.length || cmp(a, b));
    index.bySuffix.set(abs, hits[0] ?? null);
  }
  return index.bySuffix.get(abs) ?? null;
}

// Module-name index per source set (one detectRoutes pass reuses its Map), so
// resolving every decorator and include does not rebuild it each time.
const pythonModuleIndexes = new WeakMap<Map<string, string>, { byModule: Map<string, string>; bySuffix: Map<string, string | null> }>();

/**
 * Map `alias -> "module::name"` for every `from module import name [as alias]`,
 * including the parenthesised form `from module import (\n  a,\n  b as c,\n)`
 * (spread over lines, trailing comma allowed; comments are already blanked).
 */
export function pythonImportAliases(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of src.matchAll(/^\s*from\s+([\w.]+)\s+import\s+(?:\(([^)]*)\)|(.+)$)/gm)) {
    const module = m[1] as string;
    for (const part of (m[2] ?? (m[3] as string)).split(",")) {
      const asMatch = part.trim().match(/^(\w+)(?:\s+as\s+(\w+))?$/);
      if (!asMatch) continue;
      const name = asMatch[1] as string;
      const alias = (asMatch[2] as string) ?? name;
      out.set(alias, `${module}::${name}`);
    }
  }
  return out;
}

// Python call-argument parsing. Decorator / constructor arguments nest calls
// and literals (`dependencies=[Depends(f)]`, `defaults=dict(page=1)`), so they
// are split on TOP-LEVEL commas of a bracket-balanced, string-aware scan —
// never a regex that stops at the first `)`.

/** A parsed call: positional argument texts, keyword arguments, end offset. */
export interface PyCall {
  args: string[];
  kwargs: Map<string, string>;
  /** Offset just past the closing `)`. */
  end: number;
}

/** Offset just past the Python string literal opening at `i`. */
function skipPyString(src: string, i: number): number {
  const q = src[i] as string;
  const triple = q.repeat(3);
  if (src.startsWith(triple, i)) {
    const end = src.indexOf(triple, i + 3);
    return end === -1 ? src.length : end + 3;
  }
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (c === q) return j + 1;
    if (c === "\n") return j;
    j++;
  }
  return src.length;
}

/**
 * Walk `src` from `from` to `to`, calling `onTop(i)` for every character
 * outside any bracket opened during the walk (string literals skipped).
 * Returns the offset just past the first unmatched closing bracket, or `to`.
 */
function scanTop(src: string, from: number, to: number, onTop: (i: number) => void): number {
  let depth = 0;
  for (let i = from; i < to; i++) {
    const c = src[i] as string;
    if (c === '"' || c === "'") {
      i = skipPyString(src, i) - 1;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (depth === 0) return i + 1;
      depth--;
    } else if (depth === 0) onTop(i);
  }
  return to;
}

/** Split a comma-separated argument list on its top-level commas. */
export function splitPyArgs(inner: string): string[] {
  const parts: string[] = [];
  let start = 0;
  scanTop(inner, 0, inner.length, (i) => {
    if (inner[i] !== ",") return;
    parts.push(inner.slice(start, i));
    start = i + 1;
  });
  parts.push(inner.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Parse the call whose `(` is at offset `open` in `src`. */
export function parsePyCall(src: string, open: number): PyCall {
  const end = scanTop(src, open + 1, src.length, () => {});
  const inner = src.slice(open + 1, src[end - 1] === ")" ? end - 1 : end);
  const args: string[] = [];
  const kwargs = new Map<string, string>();
  for (const part of splitPyArgs(inner)) {
    const kw = part.match(/^(\w+)\s*=(?!=)\s*([\s\S]*)$/);
    if (kw) kwargs.set(kw[1] as string, kw[2] as string);
    else if (!part.startsWith("*")) args.push(part);
  }
  return { args, kwargs, end };
}

/** The value of a plain string-literal expression (`"x"`, `r'^x$'`), else null. */
export function pyString(expr: string | undefined): string | null {
  const m = expr?.trim().match(/^[rRuUbB]{0,2}(["'])([^"'\n]*)\1$/);
  return m ? (m[2] as string) : null;
}

/** HTTP methods listed in a `methods=[…]` / `(…)` / `{…}` value, uppercased. */
export function pyMethods(expr: string | undefined): string[] {
  if (!expr) return [];
  return [...expr.matchAll(/["']([A-Za-z]+)["']/g)].map((v) => (v[1] as string).toUpperCase());
}

/** Map `alias -> module` for every `import a.b [as alias]` statement. */
function pythonModuleImports(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of src.matchAll(/^[ \t]*import[ \t]+(.+)$/gm)) {
    for (const part of (m[1] as string).split(",")) {
      const im = part.trim().match(/^([\w.]+)(?:\s+as\s+(\w+))?$/);
      if (!im) continue;
      const module = im[1] as string;
      out.set((im[2] as string) ?? module, module);
    }
  }
  return out;
}

/** `pkg` + `name` -> the submodule path (`.` + `items` -> `.items`). */
export const subModule = (pkg: string, name: string): string => (pkg.endsWith(".") ? pkg + name : `${pkg}.${name}`);

/**
 * Resolves a Python name or dotted reference in one file to the file-scoped
 * key (`path::var`) of the object it names, following `from … import`
 * (relative, aliased, source-rooted) and `import a.b [as x]` statements.
 */
export function pythonRefResolver(path: string, src: string, sources: Map<string, string>): (expr: string) => string | null {
  const aliases = pythonImportAliases(src);
  const modules = pythonModuleImports(src);
  return (expr) => {
    const parts = expr.split(".");
    const attr = parts.pop() as string;
    if (!parts.length) {
      const alias = aliases.get(attr);
      if (!alias) return `${path}::${attr}`;
      const [module, name] = alias.split("::") as [string, string];
      const file = resolvePythonModule(path, module, sources);
      return file ? `${file}::${name}` : null;
    }
    // `mod.attr`: the head is a `from pkg import mod` submodule or an `import`.
    const head = parts[0] as string;
    const alias = aliases.get(head);
    let module: string;
    if (alias) {
      const [pkg, name] = alias.split("::") as [string, string];
      module = [subModule(pkg, name), ...parts.slice(1)].join(".");
    } else {
      module = modules.get(parts.join(".")) ?? parts.join(".");
    }
    const file = resolvePythonModule(path, module, sources);
    return file ? `${file}::${attr}` : null;
  };
}
