import { readFileSync } from "node:fs";

// One read per file per analysis. The walk already reads every file (for its
// hash and line count); the candidate scan, the env-var scan, the i18n reader
// and the route adapters then each read most source files again. Inside
// `withReadCache` they share one decoded copy instead.
//
// Scoped to a single (synchronous) analysis, so nothing is ever stale across
// runs, and capped: past the budget files are simply re-read, so a giant
// monorepo costs time rather than an ever-growing cache. A read itself loads
// the whole file, so callers bound the size of what they read (the walk at
// 8 MB, the adapters at MAX_SOURCE_BYTES, the env-var scan at 8 MB).

const BUDGET_CHARS = 128 * 1024 * 1024;

let cache: Map<string, string | null> | null = null;
let memo: Map<string, unknown> | null = null;
let budget = 0;

/** Run `fn` with a shared read cache (re-entrant: an inner call reuses the outer cache). */
export function withReadCache<T>(fn: () => T): T {
  if (cache) return fn();
  cache = new Map();
  memo = new Map();
  budget = BUDGET_CHARS;
  try {
    return fn();
  } finally {
    cache = null;
    memo = null;
  }
}

function remember(abs: string, text: string | null): void {
  if (!cache) return;
  if (text === null) {
    cache.set(abs, null);
    return;
  }
  if (text.length > budget) return;
  budget -= text.length;
  cache.set(abs, text);
}

/** Offer the walk's already-decoded text, so the next reader does not touch the disk. */
export function primeRead(abs: string, text: string): void {
  if (cache && !cache.has(abs)) remember(abs, text);
}

/**
 * `compute()` once per analysis for `key` (outside `withReadCache`, every call
 * computes). For derived facts several detectors need — e.g. the workspace
 * discovery both the inventory and the dependency graph start from.
 */
export function scopedMemo<T>(key: string, compute: () => T): T {
  if (!memo) return compute();
  if (memo.has(key)) return memo.get(key) as T;
  const value = compute();
  memo.set(key, value);
  return value;
}

/** A file's UTF-8 text, or null when it cannot be read. */
export function cachedRead(abs: string): string | null {
  const hit = cache?.get(abs);
  if (hit !== undefined) return hit;
  let text: string | null;
  try {
    text = readFileSync(abs, "utf8");
  } catch {
    text = null;
  }
  remember(abs, text);
  return text;
}
