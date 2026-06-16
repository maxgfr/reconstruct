import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

// A REAL end-to-end test: it drives the actual bundled CLI (`scripts/analyze.mjs`)
// — the exact thing the skill invokes — through the documented convergence loop on
// a real generated tree. Black-box: every step is a subprocess + on-disk JSON,
// nothing imported. This is the test that proves the --review ledger works the way
// SKILL.md / references/orchestration.md promise.

const BUNDLE = fileURLToPath(new URL("../scripts/analyze.mjs", import.meta.url));
const FIXTURE = fileURLToPath(new URL("./fixtures/sample-app", import.meta.url));
const NODE = process.execPath;

function cli(dir: string, args: string[]) {
  const r = spawnSync(NODE, [BUNDLE, ...args, "--out", dir], { encoding: "utf8" });
  return { status: r.status ?? 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** Generate a real reconstruction tree from the sample-app fixture. */
function generate(): string {
  const dir = mkdtempSync(join(tmpdir(), "rc-e2e-"));
  const r = spawnSync(NODE, [BUNDLE, "--repo", FIXTURE, "--out", dir], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`generate failed: ${r.stderr}`);
  return dir;
}

function readJson(dir: string, name: string): any {
  return JSON.parse(readFileSync(join(dir, name), "utf8"));
}

/** Run `--review`, return the worklist the engine wrote. */
function review(dir: string) {
  const r = cli(dir, ["--review"]);
  expect(r.status, `--review stderr: ${r.stderr}`).toBe(0);
  return readJson(dir, "REVIEW.todo.json") as {
    round: number;
    changedSet: string[];
    units: { feature: string; needsReview: boolean; prdHash: string }[];
  };
}

/** Write findings.json and run `--review --apply`; return the exit status + REVIEW.json. */
function apply(dir: string, findings: any[]) {
  const f = join(dir, "findings.json");
  writeFileSync(f, JSON.stringify({ findings }));
  const r = cli(dir, ["--review", "--apply", f]);
  return { status: r.status, stdout: r.stdout, result: readJson(dir, "REVIEW.json") };
}

const blocker = (feature: string, problem: string) => ({
  feature,
  severity: "blocker",
  category: "write-contract",
  problem,
  fix: "resolve it server-side",
});

/** Simulate an agent editing a feature PRD (changes its content hash). */
function editPrd(dir: string, slug: string, note: string) {
  appendFileSync(join(dir, "features", slug, "PRD.md"), `\n- ${note}\n`);
}

describe("review ledger — real CLI end-to-end", () => {
  it("round 1 flags every feature and a clean review converges (exit 0)", () => {
    const dir = generate();
    try {
      const wl = review(dir);
      expect(wl.round).toBe(1);
      expect(wl.units.length).toBeGreaterThanOrEqual(2);
      expect(wl.units.every((u) => u.needsReview)).toBe(true);
      expect(wl.changedSet.length).toBe(wl.units.length);

      const { status, result } = apply(dir, []); // no findings → buildable
      expect(result.ok).toBe(true);
      expect(status).toBe(0);
      expect(existsSync(join(dir, "REVIEW.md"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);

  it("a blocker fails the gate, and fixing it re-flags ONLY that feature and converges", () => {
    const dir = generate();
    try {
      const wl = review(dir);
      const target = wl.units[0]!.feature;

      const r1 = apply(dir, [blocker(target, "anonymous write needs an owner id it cannot supply")]);
      expect(r1.result.ok).toBe(false);
      expect(r1.status).toBe(1);
      expect(r1.result.residual.length).toBe(1);

      // Agent fixes the blocker → the PRD changes → only that unit re-reviews.
      editPrd(dir, target, "Fixed: resolve owner id server-side from the session.");
      const wl2 = review(dir);
      expect(wl2.round).toBe(2);
      expect(wl2.changedSet).toEqual([target]);
      expect(wl2.units.find((u) => u.feature === target)!.needsReview).toBe(true);
      expect(wl2.units.filter((u) => u.needsReview).length).toBe(1);

      const r2 = apply(dir, []); // re-reviewed, now clean
      expect(r2.result.ok).toBe(true);
      expect(r2.status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);

  // THE SOUNDNESS TEST: a blocker in a feature that is NOT re-reviewed this round
  // must NOT silently vanish from the residual. Otherwise "only re-review what
  // changed" lets the loop declare victory while real blockers remain.
  it("does not lose an unresolved blocker in a feature that was not re-reviewed", () => {
    const dir = generate();
    try {
      const wl = review(dir);
      const a = wl.units[0]!.feature;
      const b = wl.units[1]!.feature;

      const r1 = apply(dir, [
        blocker(a, "blocker in feature A"),
        blocker(b, "blocker in feature B"),
      ]);
      expect(r1.result.ok).toBe(false);
      expect(r1.result.residual.length).toBe(2);

      // Agent fixes ONLY feature A this round → only A changes → only A re-reviews.
      editPrd(dir, a, "Fixed A.");
      const wl2 = review(dir);
      expect(wl2.changedSet).toEqual([a]);

      // Agent submits findings for the re-reviewed unit (A, now clean). B was NOT
      // re-reviewed and was NOT fixed — its blocker must still gate.
      const r2 = apply(dir, []);
      expect(r2.result.residual.length, "B's unresolved blocker must survive").toBe(1);
      expect(r2.result.ok).toBe(false);
      expect(r2.status).toBe(1);

      // Now fix B too → it re-reviews → the loop finally converges.
      editPrd(dir, b, "Fixed B.");
      review(dir);
      const r3 = apply(dir, []);
      expect(r3.result.ok).toBe(true);
      expect(r3.status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);

  it("--check --semantic surfaces an unresolved review blocker as an error", () => {
    const dir = generate();
    try {
      review(dir);
      const slug = readJson(dir, "REVIEW.todo.json").units[0].feature;
      apply(dir, [blocker(slug, "unsatisfiable write contract")]);

      const r = cli(dir, ["--check", "--semantic"]);
      expect(r.status).toBe(1);
      expect(r.stdout.toLowerCase()).toContain("review");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);

  it("fails gracefully on a malformed inventory.json (a friendly error, not a stack trace)", () => {
    const dir = mkdtempSync(join(tmpdir(), "rc-e2e-bad-"));
    try {
      writeFileSync(join(dir, "inventory.json"), "{ not valid json");
      const r = cli(dir, ["--review"]);
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/not valid JSON/i);
      expect(r.stderr).not.toContain("    at "); // no raw V8 stack frame
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);

  it("an architecture-doc edit re-flags every feature", () => {
    const dir = generate();
    try {
      review(dir);
      apply(dir, []); // round 1 clean
      // Touch a shared architecture doc — the contract every feature hangs off.
      appendFileSync(join(dir, "architecture", "INTERFACES.md"), "\n<!-- contract changed -->\n");
      const wl2 = review(dir);
      expect(wl2.units.every((u) => u.needsReview)).toBe(true);
      expect(wl2.changedSet.length).toBe(wl2.units.length);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);
});
