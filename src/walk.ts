import { createHash } from "node:crypto";
import { closeSync, openSync, readSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { categorize as engineCategorize, parseGitignore, isIgnored, walk as engineWalk } from "./vendor/codeindex-engine.mjs";
import type { IgnoreRule } from "./vendor/codeindex-engine.mjs";
import { primeRead } from "./read-cache.js";
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

// The categories the candidate, env-var and route scans read again, up to the
// adapters' own per-file cap: their text is kept from the walk's read.
const PRIMED_CATEGORIES = new Set<FileCategory>(["code", "config", "schema", "style"]);
const PRIME_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Binary sniff, line count (text files) and content hash (every file) in one
 * read. The hash is the first 16 hex of sha256 — enough to tell, later, that a
 * file cited as evidence has changed since the tree was generated.
 */
function readFacts(abs: string, ext: string, size: number, prime: boolean): { binary: boolean; lines: number; hash?: string } {
  // Past the cap: sniff the head only, record no line count or hash.
  if (size > MAX_COUNT_LINES_BYTES) return { binary: isProbablyBinary(abs, ext), lines: 0 };
  let buf: Buffer;
  try {
    buf = readFileSync(abs);
  } catch {
    return { binary: true, lines: 0 };
  }
  // One read serves all three facts: the NUL sniff on the head, the hash, and
  // the line count straight off the bytes ("\n" is one byte in UTF-8 and never
  // part of a multi-byte sequence, so no decode is needed).
  const binary = BINARY_EXTS.has(ext) || buf.subarray(0, SNIFF_BYTES).includes(0);
  const hash = createHash("sha256").update(buf).digest("hex").slice(0, 16);
  // Source the later stages will scan: hand them this read (no-op outside an analysis).
  if (prime && !binary && size <= PRIME_MAX_BYTES) primeRead(abs, buf.toString("utf8"));
  return { binary, lines: binary ? 0 : countLines(buf), hash };
}

function countLines(content: Buffer): number {
  if (content.length === 0) return 0;
  let n = 1;
  for (let i = content.indexOf(10); i !== -1; i = content.indexOf(10, i + 1)) n++;
  // A trailing newline terminates the last line; it does not start a new one
  // (`wc -l` semantics plus the unterminated last line, if any).
  return content[content.length - 1] === 10 ? n - 1 : n;
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
  let linkSkips = 0;
  const result = engineWalk(repo, {
    onSkip: ({ reason }) => {
      if (["directory-symlink", "broken-symlink", "symlink-outside-root"].includes(reason)) linkSkips++;
    },
    ignoreDirs: [...DEFAULT_IGNORE_DIRS],
    includeBinary: true,
    includeLockfiles: true,
    includeOversize: true,
    includeMinified: true,
    // A full inventory lists in-repo file symlinks like regular files.
    includeFileSymlinks: true,
    filter: ({ rel, abs, directory }) => {
      if (directory) return resolve(abs) !== outAbs && !isReconstructOutput(abs) && !isIgnored(excludeRules, rel, true);
      return (
        !DEFAULT_IGNORE_FILES.has(rel.split("/").pop()!) && !isIgnored(excludeRules, rel, false) && (!includeRules.length || matchesScope(includeRules, rel))
      );
    },
  });
  const files: FileInfo[] = result.files.map(({ rel, abs, ext, size }) => {
    const category = categorize(rel, ext);
    const { binary, lines, hash } = readFacts(abs, ext, size, PRIMED_CATEGORIES.has(category));
    return { path: rel, ext, size, lines, category, binary, ...(hash ? { hash } : {}) };
  });
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files, excludedCount: result.excluded + linkSkips };
}
