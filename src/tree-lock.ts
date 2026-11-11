import { realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

// Serialize work that touches one reconstruction tree.
//
// The tree is the durable, ENRICHMENT-BEARING artifact: the whole point is that
// an agent writes real analysis into the PRDs, and a re-scaffold refuses to
// overwrite it (see detectEnrichment). `--apply` folds verdicts and findings
// into ledgers that are read-merge-write, and the bundlers read the tree while
// a scaffold could be rewriting it.
//
// The CLI never hit this because one process runs one command to completion.
// The MCP server can have several tool calls in flight at once.
//
// The fix is a promise chain per output tree — the smallest thing that is
// actually correct. Different trees stay fully parallel.
const chains = new Map<string, Promise<unknown>>();

export function withTreeLock<T>(path: string, fn: () => Promise<T>): Promise<T> {
  // Keyed by the resolved path: `/tmp/x` and a symlink to it are one tree.
  return withLock(canonical(path), fn);
}

/**
 * Serialize the calls that read or write inside one REPOSITORY: an inventory
 * walk must not see a scaffold half-way through writing an `out` that lives
 * inside the repo. A scaffold takes it inside its tree lock; an inventory takes
 * it alone, so the two orders can never wait on each other.
 */
export function withRepoLock<T>(repo: string, fn: () => Promise<T>): Promise<T> {
  return withLock(`repo:${canonical(repo)}`, fn);
}

function withLock<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(dir) ?? Promise.resolve();
  // Chain off `prev` however it settled: a failed predecessor must not poison
  // every later call for the same repo.
  const next = prev.then(fn, fn);
  // The tail the NEXT caller waits on never rejects, so one thrown tool call
  // can't reject the whole queue behind it.
  const tail = next.then(noop, noop);
  chains.set(dir, tail);
  // Drop the entry once the tail is still us, so a long-lived server doesn't
  // accumulate a settled promise per repo it ever touched.
  tail.then(() => {
    if (chains.get(dir) === tail) chains.delete(dir);
  }, noop);
  return next;
}

function noop(): void {}

/**
 * The lock key: the realpath of the nearest EXISTING ancestor, plus the rest of
 * the path. Resolving only the path or its parent gave `/tmp/new/out` before a
 * first scaffold created it and `/private/tmp/new/out` after (macOS), so a
 * scaffold and a call made once the tree existed held two different locks.
 */
export function canonical(path: string): string {
  const missing: string[] = [];
  let at = resolve(path);
  for (;;) {
    try {
      return join(realpathSync(at), ...missing.reverse());
    } catch {
      const parent = dirname(at);
      if (parent === at) return resolve(path);
      missing.push(basename(at));
      at = parent;
    }
  }
}
