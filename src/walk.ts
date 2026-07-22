import { closeSync, openSync, readSync, readdirSync, readFileSync, statSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join, extname, resolve } from "node:path";
import { categorize as engineCategorize, parseGitignore, isIgnored, readText } from "./vendor/codeindex-engine.mjs";
import type { IgnoreRule } from "./vendor/codeindex-engine.mjs";
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
  "bun.lock",
  "Cargo.lock",
  "poetry.lock",
  "Gemfile.lock",
  "composer.lock",
  "pubspec.lock",
]);

const BINARY_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".ico",
  ".bmp",
  ".tiff",
  ".pdf",
  ".zip",
  ".gz",
  ".tar",
  ".rar",
  ".7z",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".webm",
  ".wasm",
  ".so",
  ".dylib",
  ".dll",
  ".exe",
  ".bin",
  ".class",
  ".jar",
  ".pyc",
  ".node",
]);

/**
 * File categorization is the vendored codeindex engine's `categorize` (which was
 * ported from this very module), with reconstruct's historical asset semantics
 * preserved where the two disagree — behavior is kept local for every case that
 * differs, never regressed silently:
 *
 * - archives / executables / bytecode (`.zip`, `.so`, `.exe`, `.jar`, …) stay
 *   `asset` here; the engine files them under `other`.
 * - `.svg` stays `other` here (it is text, and not in reconstruct's binary/asset
 *   set); the engine calls it an `asset`.
 */
const LOCAL_ASSET_ONLY_EXTS = new Set([
  ".zip",
  ".gz",
  ".tar",
  ".rar",
  ".7z",
  ".wasm",
  ".so",
  ".dylib",
  ".dll",
  ".exe",
  ".bin",
  ".class",
  ".jar",
  ".pyc",
  ".node",
]);

export function categorize(relPath: string, ext: string): FileCategory {
  const cat = engineCategorize(relPath, ext);
  // Both overrides act on the engine's FALLBACK tier only (asset/data/other):
  // the earlier, path-driven rules (i18n/schema/test/config/doc/style/code) are
  // identical in both implementations and always win first in both.
  if (cat === "other" && LOCAL_ASSET_ONLY_EXTS.has(ext)) return "asset";
  if (cat === "asset" && ext === ".svg") return "other";
  return cat;
}

/**
 * Gitignore-style patterns (ignore rules and `--include`/`--exclude` scoping)
 * are compiled and matched by the vendored engine (`parseGitignore`/`isIgnored`),
 * which implements git's real semantics: `!` negation, trailing-`/` dir-only
 * rules, interior-`/` anchoring, `**` at segment boundaries, `[...]` character
 * classes, `\x` escapes — and per-directory `.gitignore` files apply to their own
 * subtree (later rules win), which the previous root-only parser did not honor.
 */
function compileScopeGlobs(patterns: string[] | undefined): IgnoreRule[] {
  if (!patterns || patterns.length === 0) return [];
  // A stray gitignore-style '!' re-include is meaningless for a flat scope
  // filter — ignore it rather than silently inverting the user's intent.
  return parseGitignore(patterns.join("\n"), "").filter((r) => !r.negated);
}

/** True when `rel` (a file) or any of its ancestor directories matches a rule. */
function matchesScope(rules: readonly IgnoreRule[], rel: string): boolean {
  if (isIgnored(rules, rel, false)) return true;
  let dir = rel;
  for (let i = dir.lastIndexOf("/"); i !== -1; i = dir.lastIndexOf("/")) {
    dir = dir.slice(0, i);
    if (isIgnored(rules, dir, true)) return true;
  }
  return false;
}

/**
 * A reconstruct output directory carries an `inventory.json` stamped
 * `"generatedWith": "reconstruct@<ver>"`. Detecting that signature lets us prune
 * a prior reconstruction tree by **what it is**, not its name — so re-running the
 * analyzer never ingests its own earlier PRDs (the default `<repo>/reconstruction`,
 * a `reconstruction-scratch`, or any custom `--out`).
 */
function isReconstructOutput(dir: string): boolean {
  try {
    const head = readFileSync(join(dir, "inventory.json"), "utf8").slice(0, 4096);
    return /"generatedWith"\s*:\s*"reconstruct@/.test(head);
  } catch {
    return false;
  }
}

// Bounded-memory binary sniff: read only the first ~8KB via a file descriptor
// rather than loading the whole file (a huge input would otherwise be slurped
// fully into memory just to check for a NUL byte).
const SNIFF_BYTES = 8192;

function isProbablyBinary(abs: string, ext: string): boolean {
  if (BINARY_EXTS.has(ext)) return true;
  let fd = -1;
  try {
    fd = openSync(abs, "r");
    const buf = Buffer.allocUnsafe(SNIFF_BYTES);
    const read = readSync(fd, buf, 0, SNIFF_BYTES, 0);
    for (let i = 0; i < read; i++) {
      if (buf[i] === 0) return true;
    }
    return false;
  } catch {
    return true;
  } finally {
    if (fd >= 0) {
      try {
        closeSync(fd);
      } catch {
        /* already closed / never opened */
      }
    }
  }
}

// Above this size a file's exact line count isn't worth slurping the whole thing
// into memory (and a multi-GB input would realistically OOM). Past the cap we
// report 0 lines — the inventory still records the file and its byte size.
const MAX_COUNT_LINES_BYTES = 8 * 1024 * 1024; // 8 MB

function countLines(abs: string, size: number): number {
  if (size > MAX_COUNT_LINES_BYTES) return 0;
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

export interface WalkOptions {
  /** Keep only files matching at least one of these gitignore-style globs. */
  include?: string[];
  /** Drop files matching any of these gitignore-style globs. */
  exclude?: string[];
  /**
   * Absolute path of this run's output directory. When it lives inside the repo
   * (the default `<repo>/reconstruction`), it is pruned so the analyzer never
   * re-scans its own prior output — regardless of the dir's name (e.g.
   * `reconstruction-scratch` or a custom `--out`), which the name-based default
   * ignore can't cover.
   */
  out?: string;
}

export interface WalkResult {
  files: FileInfo[];
  /** Number of files skipped by ignore rules / include-exclude scoping. */
  excludedCount: number;
}

export function walk(repo: string, opts: WalkOptions = {}): WalkResult {
  const includeRules = compileScopeGlobs(opts.include);
  const excludeRules = compileScopeGlobs(opts.exclude);
  const outAbs = opts.out ? resolve(opts.out) : "";
  const files: FileInfo[] = [];
  let excludedCount = 0;

  // `ignoreRules` is the .gitignore chain inherited from ancestor directories;
  // this directory's own .gitignore (when present) is appended after, so deeper
  // rules win — the engine's `isIgnored` returns the last matching rule's verdict.
  const recurse = (dir: string, relDir: string, inherited: readonly IgnoreRule[]): void => {
    let entries: Dirent<string>[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    let ignoreRules = inherited;
    if (entries.some((e) => e.name === ".gitignore")) {
      const parsed = parseGitignore(readText(join(dir, ".gitignore")), relDir);
      if (parsed.length) ignoreRules = [...ignoreRules, ...parsed];
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      const isDir = entry.isDirectory();
      // Symlinks: a link to a file is real content — include it like any
      // file. A link to a directory is never followed (following could loop
      // or escape the repo; not descending keeps the walk loop-safe by
      // construction). Broken links are skipped. Both are counted.
      let isFile = entry.isFile();
      if (entry.isSymbolicLink()) {
        let targetIsFile = false;
        try {
          targetIsFile = statSync(abs).isFile(); // follows the link
        } catch {
          /* broken link */
        }
        if (!targetIsFile) {
          excludedCount++;
          continue;
        }
        isFile = true;
      }

      // Never re-scan this run's own output tree, whatever it's named, nor any
      // prior reconstruct output detected by its inventory.json signature.
      if (isDir && outAbs && resolve(abs) === outAbs) continue;
      if (isDir && isReconstructOutput(abs)) continue;
      // Pruned directories are not counted (their contents are never enumerated).
      if (isDir && DEFAULT_IGNORE_DIRS.has(entry.name)) continue;
      if (ignoreRules.length && isIgnored(ignoreRules, rel, isDir)) {
        if (!isDir) excludedCount++;
        continue;
      }

      if (isDir) {
        // Prune directories matching an exclude glob so we never descend into a
        // large excluded tree. Their contents are not counted (like other pruned
        // dirs). Includes are file-level only — a dir is never pruned by include.
        if (isIgnored(excludeRules, rel, true)) continue;
        recurse(abs, rel, ignoreRules);
        continue;
      }
      if (!isFile) continue;

      if (DEFAULT_IGNORE_FILES.has(entry.name)) {
        excludedCount++;
        continue;
      }
      // A dir-only pattern (trailing slash) must not exclude a file of that name.
      if (isIgnored(excludeRules, rel, false)) {
        excludedCount++;
        continue;
      }
      if (includeRules.length > 0 && !matchesScope(includeRules, rel)) {
        excludedCount++;
        continue;
      }

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
        lines: binary ? 0 : countLines(abs, size),
        category: categorize(rel, ext),
        binary,
      });
    }
  };

  recurse(repo, "", []);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, excludedCount };
}
