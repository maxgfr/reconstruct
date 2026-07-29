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

export function withTreeLock<T>(dir: string, fn: () => Promise<T>): Promise<T> {
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

// Test seam: drop every pending chain. Never call this from product code — an
// in-flight lock holder would stop serializing against later arrivals.
export function resetTreeLocks(): void {
  chains.clear();
}
