import { readdirSync, readFileSync, statSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join, relative, extname, basename } from "node:path";
import type { FileCategory, FileInfo } from "./types.js";

const DEFAULT_IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  ".nuxt",
  ".svelte-kit",
  "dist",
  "build",
  "out",
  "coverage",
  ".turbo",
  ".vercel",
  ".cache",
  "vendor",
  "target",
  "__pycache__",
  ".venv",
  "venv",
  ".idea",
  ".vscode",
  "reconstruction",
]);

const DEFAULT_IGNORE_FILES = new Set([
  ".DS_Store",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "Cargo.lock",
  "poetry.lock",
  "Gemfile.lock",
  "composer.lock",
]);

const BINARY_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".bmp", ".tiff",
  ".pdf", ".zip", ".gz", ".tar", ".rar", ".7z", ".woff", ".woff2", ".ttf",
  ".otf", ".eot", ".mp3", ".mp4", ".mov", ".avi", ".webm", ".wasm", ".so",
  ".dylib", ".dll", ".exe", ".bin", ".class", ".jar", ".pyc", ".node",
]);

const CODE_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".astro",
  ".py", ".rb", ".go", ".rs", ".java", ".kt", ".kts", ".php", ".c", ".cc",
  ".cpp", ".h", ".hpp", ".cs", ".swift", ".scala", ".clj", ".ex", ".exs",
  ".dart", ".lua", ".sh", ".bash", ".zig", ".elm",
]);

const STYLE_EXTS = new Set([".css", ".scss", ".sass", ".less", ".styl", ".pcss"]);
const DOC_EXTS = new Set([".md", ".mdx", ".rst", ".adoc", ".txt"]);
const DATA_EXTS = new Set([".json", ".yaml", ".yml", ".toml", ".csv", ".xml", ".env"]);
const ASSET_EXTS = BINARY_EXTS;

interface CompiledPattern {
  re: RegExp;
  negate: boolean;
  dirOnly: boolean;
}

function compilePattern(raw: string): CompiledPattern | null {
  let pat = raw.trim();
  if (!pat || pat.startsWith("#")) return null;
  let negate = false;
  if (pat.startsWith("!")) {
    negate = true;
    pat = pat.slice(1);
  }
  let dirOnly = false;
  if (pat.endsWith("/")) {
    dirOnly = true;
    pat = pat.slice(0, -1);
  }
  const anchored = pat.startsWith("/");
  if (anchored) pat = pat.slice(1);

  let re = "";
  for (let i = 0; i < pat.length; i++) {
    const c = pat[i] as string;
    if (c === "*") {
      if (pat[i + 1] === "*") {
        re += ".*";
        i++;
        if (pat[i + 1] === "/") i++;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if ("\\^$.|+()[]{}".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  const prefix = anchored ? "^" : "(^|/)";
  return { re: new RegExp(prefix + re + "($|/)"), negate, dirOnly };
}

export function loadIgnore(repo: string): (relPath: string, isDir: boolean) => boolean {
  const patterns: CompiledPattern[] = [];
  try {
    const content = readFileSync(join(repo, ".gitignore"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const compiled = compilePattern(line);
      if (compiled) patterns.push(compiled);
    }
  } catch {
    // no .gitignore — rely on defaults only
  }

  return (relPath: string, isDir: boolean): boolean => {
    let ignored = false;
    for (const p of patterns) {
      if (p.dirOnly && !isDir) continue;
      if (p.re.test(relPath)) ignored = !p.negate;
    }
    return ignored;
  };
}

function isProbablyBinary(abs: string, ext: string): boolean {
  if (BINARY_EXTS.has(ext)) return true;
  try {
    const buf = readFileSync(abs);
    const sample = buf.subarray(0, 8000);
    for (const byte of sample) {
      if (byte === 0) return true;
    }
    return false;
  } catch {
    return true;
  }
}

export function categorize(relPath: string, ext: string): FileCategory {
  const lower = relPath.toLowerCase();
  const base = basename(lower);
  const segments = lower.split("/");

  const inDir = (...names: string[]) => names.some((n) => segments.includes(n));

  if (
    inDir("locales", "locale", "i18n", "lang", "langs", "translations", "messages") &&
    (ext === ".json" || ext === ".yaml" || ext === ".yml" || ext === ".po" || ext === ".properties")
  ) {
    return "i18n";
  }

  if (
    ext === ".prisma" ||
    ext === ".sql" ||
    ext === ".graphql" ||
    ext === ".gql" ||
    base.startsWith("schema.") ||
    base === "models.py" ||
    inDir("migrations", "entities", "models")
  ) {
    return "schema";
  }

  if (
    lower.includes(".test.") ||
    lower.includes(".spec.") ||
    inDir("__tests__", "test", "tests", "spec", "e2e", "__mocks__")
  ) {
    return "test";
  }

  if (
    base === "package.json" ||
    base === "tsconfig.json" ||
    base.endsWith(".config.js") ||
    base.endsWith(".config.ts") ||
    base.endsWith(".config.mjs") ||
    base.startsWith(".eslintrc") ||
    base.startsWith(".prettierrc") ||
    base.startsWith(".env") ||
    base === "dockerfile" ||
    base.startsWith("docker-compose") ||
    base === "vite.config.ts" ||
    base === "next.config.js" ||
    base === "next.config.mjs" ||
    base === "tailwind.config.js" ||
    base === "tailwind.config.ts" ||
    base === "pyproject.toml" ||
    base === "cargo.toml" ||
    base === "go.mod" ||
    base === "requirements.txt" ||
    base === "gemfile" ||
    base === "composer.json" ||
    base === "makefile"
  ) {
    return "config";
  }

  if (DOC_EXTS.has(ext)) return "doc";
  if (STYLE_EXTS.has(ext)) return "style";
  if (CODE_EXTS.has(ext)) return "code";
  if (ASSET_EXTS.has(ext)) return "asset";
  if (DATA_EXTS.has(ext)) return "data";
  return "other";
}

function countLines(abs: string): number {
  try {
    const content = readFileSync(abs, "utf8");
    if (content.length === 0) return 0;
    let n = 1;
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) === 10) n++;
    }
    return n;
  } catch {
    return 0;
  }
}

export function walk(repo: string): FileInfo[] {
  const ignore = loadIgnore(repo);
  const files: FileInfo[] = [];

  const recurse = (dir: string): void => {
    let entries: Dirent<string>[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      const rel = relative(repo, abs).split("\\").join("/");
      const isDir = entry.isDirectory();

      if (isDir && DEFAULT_IGNORE_DIRS.has(entry.name)) continue;
      if (!isDir && DEFAULT_IGNORE_FILES.has(entry.name)) continue;
      if (ignore(rel, isDir)) continue;

      if (isDir) {
        recurse(abs);
        continue;
      }
      if (!entry.isFile()) continue;

      const ext = extname(entry.name).toLowerCase();
      let size = 0;
      try {
        size = statSync(abs).size;
      } catch {
        continue;
      }
      const binary = isProbablyBinary(abs, ext);
      files.push({
        path: rel,
        ext,
        size,
        lines: binary ? 0 : countLines(abs),
        category: categorize(rel, ext),
        binary,
      });
    }
  };

  recurse(repo);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}
