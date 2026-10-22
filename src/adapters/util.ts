import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { FileInfo } from "../types.js";

/**
 * Largest source file an adapter reads. Route tables live in hand-written
 * files; anything past this is generated or minified, and reading it whole
 * would only cost memory and regex time.
 */
export const MAX_SOURCE_BYTES = 2 * 1024 * 1024;

/** Read the source of every walked file whose extension is in `exts`. */
export function readSources(files: FileInfo[], repo: string, exts: string[]): Map<string, string> {
  const set = new Set(exts);
  const out = new Map<string, string>();
  for (const f of files) {
    if (!set.has(f.ext)) continue;
    try {
      if ((f.size || statSync(join(repo, f.path)).size) > MAX_SOURCE_BYTES) continue;
      // Comments blanked to spaces (offsets and line numbers unchanged): a
      // commented-out `app.get("/old")` is not a route, and an apostrophe in a
      // `// don't` comment must not be read as an open string literal.
      out.set(f.path, stripComments(readFileSync(join(repo, f.path), "utf8"), f.ext));
    } catch {
      /* unreadable — skip */
    }
  }
  return out;
}

/** Locale-independent string order (code units) — `localeCompare` varies by machine. */
export function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 1-based line number of a character offset. */
export function lineAt(src: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < src.length; i++) if (src.charCodeAt(i) === 10) line++;
  return line;
}

type CommentSyntax = "js" | "c" | "python" | "ruby";

const SYNTAX_BY_EXT: Record<string, CommentSyntax> = {
  ".js": "js",
  ".jsx": "js",
  ".ts": "js",
  ".tsx": "js",
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

// After one of these a `/` starts a regex literal, not a division.
const REGEX_PRECEDES = new Set(["", "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "<", ">", "~", "^"]);
const REGEX_KEYWORD_BEFORE = /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/;

/**
 * Replace every comment with spaces, keeping newlines, so offsets and line
 * numbers of the remaining code are unchanged. String literals (and JS regex
 * and template literals) are recognised so a `//` or `#` inside one survives.
 * Unknown extensions come back untouched.
 */
export function stripComments(src: string, ext: string): string {
  const syntax = SYNTAX_BY_EXT[ext.toLowerCase()];
  if (!syntax) return src;
  const out = src.split("");
  const n = src.length;
  const blank = (from: number, to: number) => {
    for (let k = from; k < to && k < n; k++) if (out[k] !== "\n") out[k] = " ";
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

  if (syntax === "python" || syntax === "ruby") {
    let i = 0;
    while (i < n) {
      const c = src[i];
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
          i = skipString(c, i, syntax === "ruby");
        }
      } else {
        i++;
      }
    }
    return out.join("");
  }

  // JS template literals nest (`${ `inner` }`): each entry is the brace depth
  // at which the enclosing template body resumes.
  const templates: number[] = [];
  let depth = 0;
  let last = "";
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
      const stop = end === -1 ? n : end + 2;
      blank(i, stop);
      i = stop;
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
    if (syntax === "js") {
      if (c === "/" && (REGEX_PRECEDES.has(last) || REGEX_KEYWORD_BEFORE.test(src.slice(Math.max(0, i - 12), i).trimEnd()))) {
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
    if (!/\s/.test(c)) last = /[\w$)\].]/.test(c) ? "a" : c;
    i++;
  }
  return out.join("");
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
  const byModule = new Map<string, string>();
  for (const p of sources.keys()) if (p.endsWith(".py")) byModule.set(moduleName(p), p);
  const exact = byModule.get(abs);
  if (exact) return exact;
  // Otherwise the shortest path whose module name ends with `.abs`: the
  // unspelled prefix is a source root like `src/` or `backend/`.
  const suffix = `.${abs}`;
  const hits = [...byModule.entries()].filter(([m]) => m.endsWith(suffix)).map(([, p]) => p);
  hits.sort((a, b) => a.length - b.length || cmp(a, b));
  return hits[0] ?? null;
}

/** Join route segments (prefixes + a path) into one normalized "/a/b" route. */
export function joinRoute(...parts: string[]): string {
  const segs = parts.join("/").split("/").filter(Boolean);
  return "/" + segs.join("/");
}

/** Map `alias -> "module::name"` for every `from module import name [as alias]`. */
export function pythonImportAliases(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of src.matchAll(/^\s*from\s+([\w.]+)\s+import\s+(.+)$/gm)) {
    const module = m[1] as string;
    for (const part of (m[2] as string).split(",")) {
      const asMatch = part.trim().match(/^(\w+)(?:\s+as\s+(\w+))?$/);
      if (!asMatch) continue;
      const name = asMatch[1] as string;
      const alias = (asMatch[2] as string) ?? name;
      out.set(alias, `${module}::${name}`);
    }
  }
  return out;
}
