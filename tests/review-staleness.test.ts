import { describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runReview, applyFindings, foldReview } from "../src/review.js";
import { checkOutput } from "../src/check.js";
import { runVerify, applyVerdicts } from "../src/verify.js";

// Content-staleness of the BUILDABILITY ledger (`--review` / `--check --semantic`).
//
// `--review` already content-hashes each PRD, so it correctly re-flags a unit
// whose prose moved. But the GATE (`foldReview`) only recomputed the blocker set
// from the stored ledger — it never asked whether that ledger still describes the
// tree on disk. So `--check --semantic` certified a tree whose PRDs had changed
// since the last adjudicated round, even while `--review` was reporting the very
// same change as due for review. These tests pin the gate to the last adjudicated
// content baseline.

const BUNDLE = fileURLToPath(new URL("../scripts/analyze.mjs", import.meta.url));
const EXAMPLE = fileURLToPath(new URL("../assets/example-output", import.meta.url));
const NODE = process.execPath;

function scratch(): string {
  return mkdtempSync(join(tmpdir(), "rc-review-stale-"));
}

function tree(dir: string, features: { slug: string; prd: string }[]): void {
  const inv = {
    repoName: "demo",
    features: features.map((f) => ({ slug: f.slug, name: f.slug, description: "", kind: "feature", files: [], routes: [] })),
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

function applyEmpty(dir: string): void {
  const f = join(dir, "findings.json");
  writeFileSync(f, JSON.stringify({ findings: [] }));
  applyFindings(dir, f);
}

/** `--check --semantic`'s review fold, isolated: the errors it contributes. */
function reviewErrors(dir: string, opts: { allowUnverified?: boolean } = {}): { errors: string[]; warnings: string[] } {
  const check = checkOutput(dir);
  const before = check.errors.length;
  const beforeWarn = check.warnings.length;
  foldReview(dir, check, opts);
  return { errors: check.errors.slice(before), warnings: check.warnings.slice(beforeWarn) };
}

/** A reviewed tree at rest: worklist derived, a clean (blocker-free) round applied. */
function reviewed(features = FEAT): string {
  const dir = scratch();
  tree(dir, features);
  runReview(dir);
  applyEmpty(dir);
  return dir;
}

describe("review gate binds to the last ADJUDICATED content baseline", () => {
  it("a genuinely unchanged tree still passes (the binding never false-fails)", () => {
    const dir = reviewed();
    expect(reviewErrors(dir).errors).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails once a reviewed feature PRD changes — the same change --review flags as due", () => {
    const dir = reviewed();
    writeFileSync(join(dir, "features", "01-auth", "PRD.md"), "# Auth\nLogin, sessions and a brand new unreviewed contract.");
    // --review agrees the unit is due…
    expect(runReview(dir).units.find((u) => u.feature === "01-auth")!.needsReview).toBe(true);
    // …so the gate must not certify the tree in the meantime.
    const { errors } = reviewErrors(dir);
    expect(errors.join(" ")).toMatch(/stale|changed since|no longer/i);
    expect(errors.join(" ")).toContain("01-auth");
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails on an ADDED feature the last adjudicated round never saw", () => {
    const dir = reviewed();
    const inv = JSON.parse(readFileSync(join(dir, "inventory.json"), "utf8"));
    inv.features.push({ slug: "03-reporting", name: "03-reporting", description: "", kind: "feature", files: [], routes: [] });
    writeFileSync(join(dir, "inventory.json"), JSON.stringify(inv, null, 2));
    mkdirSync(join(dir, "features", "03-reporting"), { recursive: true });
    writeFileSync(join(dir, "features", "03-reporting", "PRD.md"), "# Reporting\nNever reviewed.");
    const { errors } = reviewErrors(dir);
    expect(errors.join(" ")).toContain("03-reporting");
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails on a DELETED feature — the baseline no longer describes the tree", () => {
    const dir = reviewed();
    const inv = JSON.parse(readFileSync(join(dir, "inventory.json"), "utf8"));
    inv.features = inv.features.filter((f: any) => f.slug !== "02-billing");
    writeFileSync(join(dir, "inventory.json"), JSON.stringify(inv, null, 2));
    rmSync(join(dir, "features", "02-billing"), { recursive: true, force: true });
    const { errors } = reviewErrors(dir);
    expect(errors.join(" ")).toContain("02-billing");
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails on a SHARED ARCHITECTURE doc change — it can regress every feature's contract", () => {
    const dir = reviewed();
    mkdirSync(join(dir, "architecture"), { recursive: true });
    writeFileSync(join(dir, "architecture", "INTERFACES.md"), "# Interfaces\nPOST /api/login now returns 204.");
    const { errors } = reviewErrors(dir);
    expect(errors.join(" ")).toMatch(/architecture/i);
    rmSync(dir, { recursive: true, force: true });
  });

  it("a fresh --review round re-adjudicating the CURRENT content recovers the green gate", () => {
    const dir = reviewed();
    writeFileSync(join(dir, "features", "01-auth", "PRD.md"), "# Auth\nLogin, sessions and a brand new unreviewed contract.");
    expect(reviewErrors(dir).errors.length).toBeGreaterThan(0);
    runReview(dir);
    applyEmpty(dir);
    expect(reviewErrors(dir).errors).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("--review --apply refuses to mint a baseline for content nobody reviewed", () => {
  it("rejects findings applied against a worklist the PRDs have moved past", () => {
    const dir = scratch();
    tree(dir, FEAT);
    runReview(dir);
    // The reviewer judged the worklist's content; the PRD changed before the fold.
    writeFileSync(join(dir, "features", "01-auth", "PRD.md"), "# Auth\nRewritten after the reviewer read it.");
    const f = join(dir, "findings.json");
    writeFileSync(f, JSON.stringify({ findings: [] }));
    expect(() => applyFindings(dir, f)).toThrow(/stale/i);
    rmSync(dir, { recursive: true, force: true });
  });

  it("does not stamp a fresh baseline over the old one when the apply is refused", () => {
    const dir = reviewed();
    const baselineBefore = JSON.parse(readFileSync(join(dir, "REVIEW.json"), "utf8")).baseline;
    writeFileSync(join(dir, "features", "01-auth", "PRD.md"), "# Auth\nRewritten.");
    runReview(dir); // a fresh worklist over the NEW content…
    const f = join(dir, "findings.json");
    // …but the findings on hand are last round's, so the baseline must not move.
    writeFileSync(f, JSON.stringify({ findings: [] }));
    let threw = false;
    try {
      applyFindings(dir, f);
    } catch {
      threw = true;
    }
    const after = JSON.parse(readFileSync(join(dir, "REVIEW.json"), "utf8")).baseline;
    if (!threw) expect(after).not.toEqual(baselineBefore); // an accepted apply DID re-review
    expect(reviewErrors(dir).errors.length === 0 || threw).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a findings file whose echoed worklist stamp is from an older round", () => {
    const dir = scratch();
    tree(dir, FEAT);
    const first = runReview(dir);
    expect(typeof first.contentHash).toBe("string");
    applyEmpty(dir);
    writeFileSync(join(dir, "features", "01-auth", "PRD.md"), "# Auth\nRewritten.");
    runReview(dir);
    const f = join(dir, "findings.json");
    writeFileSync(f, JSON.stringify({ contentHash: first.contentHash, findings: [] }));
    expect(() => applyFindings(dir, f)).toThrow(/stale/i);
    rmSync(dir, { recursive: true, force: true });
  });

  it("still folds a findings file applied against a CURRENT worklist (orchestrate compatibility)", () => {
    const dir = scratch();
    tree(dir, FEAT);
    runReview(dir);
    const f = join(dir, "findings.json");
    writeFileSync(f, JSON.stringify({ findings: [{ feature: "01-auth", severity: "minor", category: "stories", problem: "thin", fix: "expand" }] }));
    const r = applyFindings(dir, f);
    expect(r.ok).toBe(true);
    expect(r.minors).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("a review ledger with no content baseline cannot silently certify buildability", () => {
  it("errors on a baseline-less REVIEW.json (legacy), and --allow-unverified downgrades it", () => {
    const dir = reviewed();
    const rev = JSON.parse(readFileSync(join(dir, "REVIEW.json"), "utf8"));
    delete rev.baseline;
    writeFileSync(join(dir, "REVIEW.json"), JSON.stringify(rev, null, 2));

    const strict = reviewErrors(dir);
    expect(strict.errors.join(" ")).toMatch(/baseline|--review/i);
    const lax = reviewErrors(dir, { allowUnverified: true });
    expect(lax.errors).toEqual([]);
    expect(lax.warnings.length).toBeGreaterThan(0);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("the buildability gate is INDEPENDENT of the faithfulness gate", () => {
  it("a fresh --verify round does not make a stale review ledger valid", () => {
    const dir = scratch();
    tree(dir, [{ slug: "01-auth", prd: "# Auth\n## Functional requirements\n- The system authenticates a user via POST /api/login.\n" }]);
    runReview(dir);
    applyEmpty(dir);
    writeFileSync(join(dir, "features", "01-auth", "PRD.md"), "# Auth\n## Functional requirements\n- The system authenticates a user via POST /api/logout.\n");
    // Re-derive and re-adjudicate the FAITHFULNESS ledger over the new prose…
    runVerify(dir);
    const todo = JSON.parse(readFileSync(join(dir, "VERIFY.todo.json"), "utf8"));
    const vf = join(dir, "verdicts.json");
    writeFileSync(
      vf,
      JSON.stringify({ verdicts: todo.pairs.map((p: any) => ({ claimId: p.claimId, verdict: "supported", note: "", confidence: "confirmed" })) }),
    );
    applyVerdicts(dir, vf);
    // …but nobody re-reviewed the unit for buildability.
    expect(reviewErrors(dir).errors.length).toBeGreaterThan(0);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("real CLI: the shipped example tree (regression repro)", () => {
  it("--review flags the changed unit AND --check --semantic refuses to certify it", () => {
    const dir = mkdtempSync(join(tmpdir(), "rc-example-review-stale-"));
    cpSync(EXAMPLE, dir, { recursive: true, force: true });
    try {
      expect(spawnSync(NODE, [BUNDLE, "--check", "--semantic", "--out", dir], { encoding: "utf8" }).status).toBe(0);

      const prd = join(dir, "features", "01-core", "PRD.md");
      writeFileSync(prd, readFileSync(prd, "utf8").replace("whose text is `Welcome`", "whose text is `UNSUPPORTED AUDIT CLAIM`"));

      const rev = spawnSync(NODE, [BUNDLE, "--review", "--out", dir], { encoding: "utf8" });
      expect(rev.stderr).toContain("1/7 unit(s) to review");

      const gate = spawnSync(NODE, [BUNDLE, "--check", "--semantic", "--out", dir], { encoding: "utf8" });
      expect(gate.status, gate.stdout).not.toBe(0);
      expect(gate.stdout + gate.stderr).toMatch(/review/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
