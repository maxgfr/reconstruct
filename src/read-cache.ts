import { readFileSync } from "node:fs";

// One read per file per analysis. The walk already reads every file (for its
// hash and line count); the candidate scan, the env-var scan, the i18n reader
// and the route adapters then each read most source files again. Inside
// `withReadCache` they share one decoded copy instead.
//
// Scoped to a single (synchronous) analysis, so nothing is ever stale across
// runs, and capped: past the budget files are simply re-read, so a giant
// monorepo costs time, never unbounded memory.

const BUDGET_CHARS = 128 * 1024 * 1024;

let cache: Map<string, string | null> | null = null;
let budget = 0;

/** Run `fn` with a shared read cache (re-entrant: an inner call reuses the outer cache). */
export function withReadCache<T>(fn: () => T): T {
  if (cache) return fn();
  cache = new Map();
  budget = BUDGET_CHARS;
  try {
    return fn();
  } finally {
    cache = null;
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
export function primeText(abs: string, text: string): void {
  if (cache && !cache.has(abs)) remember(abs, text);
}

/** A file's UTF-8 text, or null when it cannot be read. */
export function readText(abs: string): string | null {
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
