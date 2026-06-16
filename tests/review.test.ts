import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runReview, applyFindings, foldReview } from "../src/review.js";
import { checkOutput } from "../src/check.js";

function scratch(): string {
  return mkdtempSync(join(tmpdir(), "rc-review-"));
}

// A minimal reconstruction tree: inventory.json + N feature PRDs. The review
// ledger only hashes the PRD + architecture docs, so the prose can be anything.
function tree(dir: string, features: { slug: string; prd: string }[]): void {
  const inv = {
    repoName: "demo",
    features: features.map((f) => ({
      slug: f.slug,
      name: f.slug,
      description: "",
      kind: "feature",
      files: [],
      routes: [],
    })),
  };
  writeFileSync(join(dir, "inventory.json"), JSON.stringify(inv, null, 2));
  for (const f of features) {
    mkdirSync(join(dir, "features", f.slug), { recursive: true });
    writeFileSync(join(dir, "features", f.slug, "PRD.md"), f.prd);
  }
}

const FEAT = [
  { slug: "01-auth", prd: "# Auth\nLogin and sessions." },
  { slug: "02-billing", prd: "# Billing\nInvoices and payments." },
];

function writeFindings(dir: string, findings: any[]): string {
  const f = join(dir, "findings.json");
  writeFileSync(f, JSON.stringify({ findings }));
  return f;
}

const blocker = (feature: string, problem = "write contract unsatisfiable", extra: any = {}) => ({
  feature,
  severity: "blocker",
  category: "write-contract",
  problem,
  fix: "resolve the source server-side",
  ...extra,
});

describe("runReview (per-feature worklist)", () => {
  it("emits one unit per feature with hashes, all needing review on the first round", () => {
    const dir = scratch();
    tree(dir, FEAT);
    const wl = runReview(dir);
    expect(wl.round).toBe(1);
    expect(wl.units.map((u) => u.feature)).toEqual(["01-auth", "02-billing"]);
    expect(wl.units.every((u) => u.needsReview)).toBe(true);
    expect(wl.units.every((u) => u.prdHash.length === 64 && u.archHash.length === 64)).toBe(true);
    expect(wl.changedSet).toEqual(["01-auth", "02-billing"]);
    expect(existsSync(join(dir, "REVIEW.todo.json"))).toBe(true);
    expect(existsSync(join(dir, "REVIEW.md"))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("re-flags only the features whose PRD changed on a later round", () => {
    const dir = scratch();
    tree(dir, FEAT);
    runReview(dir);
    applyFindings(dir, writeFindings(dir, [])); // round 1 clean → REVIEW.json
    // Mutate only the first feature's PRD.
    writeFileSync(join(dir, "features", "01-auth", "PRD.md"), "# Auth\nNow with MFA.");
    const wl2 = runReview(dir);
    expect(wl2.round).toBe(2);
    expect(wl2.changedSet).toEqual(["01-auth"]);
    expect(wl2.units.find((u) => u.feature === "01-auth")!.needsReview).toBe(true);
    expect(wl2.units.find((u) => u.feature === "02-billing")!.needsReview).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("applyFindings (gate)", () => {
  function setup(): string {
    const dir = scratch();
    tree(dir, FEAT);
    runReview(dir);
    return dir;
  }

  it("passes when there are no blockers (only majors/minors)", () => {
    const dir = setup();
    const r = applyFindings(
      dir,
      writeFindings(dir, [
        { feature: "01-auth", severity: "major", category: "stories", problem: "missing admin story", fix: "add it" },
        { feature: "02-billing", severity: "minor", category: "acceptance", problem: "AC wording", fix: "tighten" },
      ]),
    );
    expect(r.ok).toBe(true);
    expect(r.majors).toBe(1);
    expect(r.minors).toBe(1);
    expect(existsSync(join(dir, "REVIEW.json"))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails on an unverified blocker", () => {
    const dir = setup();
    const r = applyFindings(dir, writeFindings(dir, [blocker("01-auth")]));
    expect(r.ok).toBe(false);
    expect(r.residual.length).toBe(1);
    expect(r.failures[0]!.feature).toBe("01-auth");
    rmSync(dir, { recursive: true, force: true });
  });

  it("drops a blocker an independent verifier refuted", () => {
    const dir = setup();
    const r = applyFindings(dir, writeFindings(dir, [blocker("01-auth", "false positive", { verdict: "refuted" })]));
    expect(r.ok).toBe(true);
    expect(r.residual.length).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  it("keeps a confirmed blocker gating", () => {
    const dir = setup();
    const r = applyFindings(dir, writeFindings(dir, [blocker("01-auth", "real", { verdict: "confirmed" })]));
    expect(r.ok).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("no-progress detection across rounds", () => {
  it("flags noProgress when the same residual blocker recurs, and clears it when fixed", () => {
    const dir = scratch();
    tree(dir, FEAT);

    // Round 1 — a blocker on 01-auth.
    runReview(dir);
    const r1 = applyFindings(dir, writeFindings(dir, [blocker("01-auth")]));
    expect(r1.round).toBe(1);
    expect(r1.noProgress).toBe(false);
    expect(r1.staleRounds).toBe(0);

    // Round 2 — same blocker text → same id → no progress.
    runReview(dir);
    const r2 = applyFindings(dir, writeFindings(dir, [blocker("01-auth")]));
    expect(r2.round).toBe(2);
    expect(r2.noProgress).toBe(true);
    expect(r2.staleRounds).toBe(1);

    // Round 3 — still stuck → stale climbs (this is the loop's escape hatch).
    runReview(dir);
    const r3 = applyFindings(dir, writeFindings(dir, [blocker("01-auth")]));
    expect(r3.staleRounds).toBe(2);

    // Round 4 — fixed: editing the PRD re-flags the unit, and an empty review of
    // the now-touched feature clears its open blocker → ok, stale resets.
    writeFileSync(join(dir, "features", "01-auth", "PRD.md"), "# Auth\nLogin and sessions, fixed.");
    runReview(dir);
    const r4 = applyFindings(dir, writeFindings(dir, []));
    expect(r4.ok).toBe(true);
    expect(r4.noProgress).toBe(false);
    expect(r4.staleRounds).toBe(0);

    rmSync(dir, { recursive: true, force: true });
  });
});

describe("carry-forward soundness", () => {
  it("keeps an open blocker in a feature that was not re-reviewed this round", () => {
    const dir = scratch();
    tree(dir, FEAT); // 01-auth, 02-billing
    runReview(dir);
    const r1 = applyFindings(dir, writeFindings(dir, [blocker("01-auth", "A"), blocker("02-billing", "B")]));
    expect(r1.residual.length).toBe(2);

    // Fix only 01-auth → only it re-reviews; 02-billing's blocker must NOT vanish.
    writeFileSync(join(dir, "features", "01-auth", "PRD.md"), "# Auth\nfixed.");
    runReview(dir);
    const r2 = applyFindings(dir, writeFindings(dir, [])); // empty review of the touched unit
    expect(r2.residual.length).toBe(1);
    expect(r2.ok).toBe(false);
    expect(r2.failures[0]!.feature).toBe("02-billing");

    // Now fix 02-billing too → it re-reviews → converged.
    writeFileSync(join(dir, "features", "02-billing", "PRD.md"), "# Billing\nfixed.");
    runReview(dir);
    const r3 = applyFindings(dir, writeFindings(dir, []));
    expect(r3.ok).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("change-tracking baseline (idempotent --review)", () => {
  it("repeated runReview without an apply in between keeps flagging a pending change", () => {
    const dir = scratch();
    tree(dir, FEAT);
    runReview(dir);
    applyFindings(dir, writeFindings(dir, [])); // baseline committed at v1
    writeFileSync(join(dir, "features", "01-auth", "PRD.md"), "# Auth\nv2 — pending review.");

    const a = runReview(dir);
    expect(a.units.find((u) => u.feature === "01-auth")!.needsReview).toBe(true);
    // Run --review AGAIN with no --apply: the baseline (in REVIEW.json) has not
    // moved, so the still-unadjudicated change must remain flagged (not masked).
    const b = runReview(dir);
    expect(b.units.find((u) => u.feature === "01-auth")!.needsReview).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("foldReview (--check --semantic composition)", () => {
  it("adds an error to the check result when REVIEW.json has unresolved blockers", () => {
    const dir = scratch();
    tree(dir, FEAT);
    runReview(dir);
    applyFindings(dir, writeFindings(dir, [blocker("01-auth")]));
    const check = checkOutput(dir);
    const before = check.errors.length;
    foldReview(dir, check);
    expect(check.errors.length).toBeGreaterThan(before);
    rmSync(dir, { recursive: true, force: true });
  });

  it("does not add errors when there is no REVIEW.json (no regression)", () => {
    const dir = scratch();
    tree(dir, FEAT);
    const check = checkOutput(dir);
    const before = check.errors.length;
    foldReview(dir, check);
    expect(check.errors.length).toBe(before);
    expect(check.warnings.join(" ").toLowerCase()).toContain("review");
    rmSync(dir, { recursive: true, force: true });
  });
});
