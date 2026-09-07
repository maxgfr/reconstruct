import { describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runVerify, applyVerdicts, foldSemantic } from "../src/verify.js";
import { checkOutput } from "../src/check.js";
import { runReview, applyFindings } from "../src/review.js";

// Content-staleness of the FAITHFULNESS ledger (`--verify` / `--check --semantic`).
//
// The worklist ids are ordinals (`C1`, `C2`, …), so they are stable under an
// edit that keeps the requirement COUNT: rewriting a claim's prose leaves `C4`
// named `C4`, and a gate that compares only ids happily re-uses the verdict the
// adjudicator gave to the OLD text. These tests pin the gate to the actual
// claim content + the evidence the worklist offered for it.

const BUNDLE = fileURLToPath(new URL("../scripts/analyze.mjs", import.meta.url));
const EXAMPLE = fileURLToPath(new URL("../assets/example-output", import.meta.url));
const NODE = process.execPath;

function scratch(): string {
  return mkdtempSync(join(tmpdir(), "rc-verify-stale-"));
}

function tree(dir: string, prd: string): void {
  const inv = {
    repoName: "demo",
    features: [
      {
        slug: "01-auth",
        name: "Auth",
        description: "user login and sessions",
        kind: "feature",
        files: ["src/auth.ts", "src/login.ts"],
        routes: [{ method: "POST", path: "/api/login" }],
        interfaces: [],
        entities: ["User"],
      },
    ],
  };
  writeFileSync(join(dir, "inventory.json"), JSON.stringify(inv, null, 2));
  mkdirSync(join(dir, "features", "01-auth"), { recursive: true });
  writeFileSync(join(dir, "features", "01-auth", "PRD.md"), prd);
}

const prdPath = (dir: string): string => join(dir, "features", "01-auth", "PRD.md");

const PRD = `# Auth
## Functional requirements
- The system authenticates a user via POST /api/login.
- Passwords are hashed before storage in the User entity.
## Acceptance criteria
- Given valid credentials, when the user calls login, then a session is created.
`;

/** Adjudicate every offered pair as supported — the schema-shaped FRAGMENT (ids only). */
function adjudicateAll(dir: string): void {
  const todo = JSON.parse(readFileSync(join(dir, "VERIFY.todo.json"), "utf8"));
  const verdicts = todo.pairs.map((p: any) => ({ claimId: p.claimId, verdict: "supported", note: "traces to source", confidence: "confirmed" }));
  const f = join(dir, "verdicts.json");
  writeFileSync(f, JSON.stringify({ verdicts }));
  applyVerdicts(dir, f);
}

/** `--check --semantic`'s faithfulness fold, isolated: the errors it contributes. */
function semanticErrors(dir: string, opts: { allowUnverified?: boolean } = {}): { errors: string[]; warnings: string[] } {
  const check = checkOutput(dir);
  const before = check.errors.length;
  const beforeWarn = check.warnings.length;
  foldSemantic(dir, check, opts);
  return { errors: check.errors.slice(before), warnings: check.warnings.slice(beforeWarn) };
}

/** A verified tree at rest: worklist derived, every pair adjudicated supported. */
function verified(prd = PRD): string {
  const dir = scratch();
  tree(dir, prd);
  runVerify(dir);
  adjudicateAll(dir);
  return dir;
}

describe("faithfulness gate binds verdicts to the adjudicated claim CONTENT", () => {
  it("a genuinely unchanged tree still passes (the binding never false-fails)", () => {
    const dir = verified();
    expect(semanticErrors(dir).errors).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("re-writing a claim's prose in place invalidates its verdict (same id, same count)", () => {
    const dir = verified();
    writeFileSync(prdPath(dir), readFileSync(prdPath(dir), "utf8").replace("Passwords are hashed before storage", "Passwords are stored in plain text"));
    const { errors } = semanticErrors(dir);
    expect(errors.join(" ")).toMatch(/stale|no longer|changed since/i);
    rmSync(dir, { recursive: true, force: true });
  });

  it("catches an edit BEYOND the 400-char claim truncation (the stored claim text is byte-identical)", () => {
    const tail = ` and the audit trail records ${"the actor, the timestamp and the outcome, ".repeat(12)}`;
    const long = `- The system authenticates a user via POST /api/login${tail}ORIGINAL-SUFFIX.`;
    const dir = verified(PRD.replace("- The system authenticates a user via POST /api/login.", long));
    const before = JSON.parse(readFileSync(join(dir, "VERIFY.json"), "utf8")).verdicts;

    writeFileSync(prdPath(dir), readFileSync(prdPath(dir), "utf8").replace("ORIGINAL-SUFFIX", "TAMPERED-SUFFIX"));
    // The truncated `claim` the ledger stores cannot see the edit — only a
    // fingerprint over the COMPLETE requirement text can.
    expect(before[0].claim.length).toBe(400);
    expect(before[0].claim).not.toContain("SUFFIX");
    const { errors } = semanticErrors(dir);
    expect(errors.join(" ")).toMatch(/stale|no longer|changed since/i);
    rmSync(dir, { recursive: true, force: true });
  });

  it("catches REORDERED claims — the ids stay C1..Cn but each now names different prose", () => {
    const dir = verified();
    const swapped = `# Auth
## Functional requirements
- Passwords are hashed before storage in the User entity.
- The system authenticates a user via POST /api/login.
## Acceptance criteria
- Given valid credentials, when the user calls login, then a session is created.
`;
    writeFileSync(prdPath(dir), swapped);
    const { errors } = semanticErrors(dir);
    expect(errors.join(" ")).toMatch(/stale|no longer|changed since/i);
    rmSync(dir, { recursive: true, force: true });
  });

  it("catches an ADDED claim inserted before the existing ones (every later id shifts)", () => {
    const dir = verified();
    writeFileSync(
      prdPath(dir),
      readFileSync(prdPath(dir), "utf8").replace(
        "## Functional requirements\n",
        "## Functional requirements\n- Sessions expire after thirty minutes of inactivity.\n",
      ),
    );
    expect(semanticErrors(dir).errors.length).toBeGreaterThan(0);
    rmSync(dir, { recursive: true, force: true });
  });

  it("catches a DELETED claim (the remaining ids re-map onto other prose)", () => {
    const dir = verified();
    writeFileSync(prdPath(dir), readFileSync(prdPath(dir), "utf8").replace("- The system authenticates a user via POST /api/login.\n", ""));
    expect(semanticErrors(dir).errors.length).toBeGreaterThan(0);
    rmSync(dir, { recursive: true, force: true });
  });

  it("catches evidence that moved under an unchanged claim (the inventory lost the cited files)", () => {
    const dir = verified();
    const inv = JSON.parse(readFileSync(join(dir, "inventory.json"), "utf8"));
    inv.features[0].files = ["src/rewritten.ts"];
    writeFileSync(join(dir, "inventory.json"), JSON.stringify(inv, null, 2));
    expect(semanticErrors(dir).errors.length).toBeGreaterThan(0);
    rmSync(dir, { recursive: true, force: true });
  });

  it("a fresh --verify + re-adjudication RECOVERS the green gate", () => {
    const dir = verified();
    writeFileSync(prdPath(dir), readFileSync(prdPath(dir), "utf8").replace("Passwords are hashed before storage", "Passwords are stored in plain text"));
    expect(semanticErrors(dir).errors.length).toBeGreaterThan(0);

    runVerify(dir); // re-derive the worklist from the CURRENT prose…
    adjudicateAll(dir); // …and judge it again
    expect(semanticErrors(dir).errors).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("--verify --apply refuses a stale worklist instead of stamping current content onto old judgements", () => {
  it("rejects a fragment applied against a worklist the PRD has moved past", () => {
    const dir = scratch();
    tree(dir, PRD);
    runVerify(dir);
    const todo = JSON.parse(readFileSync(join(dir, "VERIFY.todo.json"), "utf8"));
    // The agent adjudicated the OLD prose; the PRD changed before the fold.
    writeFileSync(prdPath(dir), readFileSync(prdPath(dir), "utf8").replace("Passwords are hashed before storage", "Passwords are stored in plain text"));
    const f = join(dir, "verdicts.json");
    writeFileSync(
      f,
      JSON.stringify({ verdicts: todo.pairs.map((p: any) => ({ claimId: p.claimId, verdict: "supported", note: "", confidence: "confirmed" })) }),
    );
    expect(() => applyVerdicts(dir, f)).toThrow(/stale/i);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a stale FULL row whose claim text no longer matches the current worklist", () => {
    const dir = scratch();
    tree(dir, PRD);
    runVerify(dir);
    const todo = JSON.parse(readFileSync(join(dir, "VERIFY.todo.json"), "utf8"));
    const pairs = todo.pairs.map((p: any, i: number) => ({
      ...p,
      verdict: "supported",
      note: "",
      claim: i === 0 ? "a requirement from some other run entirely" : p.claim,
    }));
    const f = join(dir, "verdicts.json");
    writeFileSync(f, JSON.stringify({ pairs }));
    expect(() => applyVerdicts(dir, f)).toThrow(/stale/i);
    rmSync(dir, { recursive: true, force: true });
  });

  it("still folds a fragment applied against a CURRENT worklist (orchestrate compatibility)", () => {
    const dir = scratch();
    tree(dir, PRD);
    runVerify(dir);
    const todo = JSON.parse(readFileSync(join(dir, "VERIFY.todo.json"), "utf8"));
    const f = join(dir, "verdicts.json");
    writeFileSync(
      f,
      JSON.stringify({ verdicts: todo.pairs.map((p: any) => ({ claimId: p.claimId, verdict: "supported", note: "", confidence: "confirmed" })) }),
    );
    const r = applyVerdicts(dir, f);
    expect(r.ok).toBe(true);
    expect(r.adjudicated).toBe(todo.pairs.length);
    rmSync(dir, { recursive: true, force: true });
  });

  it("refuses fragment binding when the current inventory cannot be derived", () => {
    const dir = scratch();
    try {
      tree(dir, PRD);
      runVerify(dir);
      writeFileSync(join(dir, "inventory.json"), "{");
      expect(() => adjudicateAll(dir)).toThrow(/current|inventory|derive/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("a ledger with no content binding cannot silently certify faithfulness", () => {
  it.each(["missing", "corrupt", "legacy"])("refuses old unbound rows with a %s worklist after a suffix edit", (state) => {
    const dir = scratch();
    try {
      tree(dir, PRD.replace("POST /api/login.", `POST /api/login ${"context ".repeat(80)} ORIGINAL_SUFFIX.`));
      const todo = runVerify(dir);
      const pairs = todo.pairs.map(({ fingerprint: _fingerprint, ...p }) => ({ ...p, verdict: "supported", note: "old judgement" }));
      const f = join(dir, "verdicts.json");
      writeFileSync(f, JSON.stringify({ pairs }));
      const path = join(dir, "VERIFY.todo.json");
      if (state === "missing") rmSync(path);
      else writeFileSync(path, state === "corrupt" ? "{" : JSON.stringify({ pairs }));
      writeFileSync(prdPath(dir), readFileSync(prdPath(dir), "utf8").replace("ORIGINAL_SUFFIX", "CHANGED_SUFFIX"));
      expect(() => applyVerdicts(dir, f)).toThrow(/fingerprint|stale|unbound/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("accepts self-contained modern rows without a worklist, preserving their original binding", () => {
    const dir = verified();
    try {
      const ledger = JSON.parse(readFileSync(join(dir, "VERIFY.json"), "utf8"));
      rmSync(join(dir, "VERIFY.todo.json"));
      const f = join(dir, "modern.json");
      writeFileSync(f, JSON.stringify(ledger.verdicts));
      expect(applyVerdicts(dir, f).ok).toBe(true);
      expect(semanticErrors(dir).errors).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors when the verdicts carry no fingerprint (pre-binding ledger), and --allow-unverified downgrades it", () => {
    const dir = verified();
    const sem = JSON.parse(readFileSync(join(dir, "VERIFY.json"), "utf8"));
    for (const v of sem.verdicts) delete v.fingerprint;
    writeFileSync(join(dir, "VERIFY.json"), JSON.stringify(sem, null, 2));

    const strict = semanticErrors(dir);
    expect(strict.errors.join(" ")).toMatch(/fingerprint|content|--verify/i);
    const lax = semanticErrors(dir, { allowUnverified: true });
    expect(lax.errors).toEqual([]);
    expect(lax.warnings.length).toBeGreaterThan(0);
    rmSync(dir, { recursive: true, force: true });
  });

  it("a fingerprint copied from another claim does not launder the verdict", () => {
    const dir = verified();
    const sem = JSON.parse(readFileSync(join(dir, "VERIFY.json"), "utf8"));
    sem.verdicts[0].fingerprint = sem.verdicts[1].fingerprint;
    writeFileSync(join(dir, "VERIFY.json"), JSON.stringify(sem, null, 2));
    expect(semanticErrors(dir).errors.length).toBeGreaterThan(0);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("the faithfulness gate is INDEPENDENT of the buildability review", () => {
  it("a fresh --review round does not make a stale verification ledger valid", () => {
    const dir = verified();
    writeFileSync(prdPath(dir), readFileSync(prdPath(dir), "utf8").replace("Passwords are hashed before storage", "Passwords are stored in plain text"));
    // Re-review and re-apply findings: the REVIEW ledger is now current…
    runReview(dir);
    const findings = join(dir, "findings.json");
    writeFileSync(findings, JSON.stringify({ findings: [] }));
    applyFindings(dir, findings);
    // …but nobody re-judged the rewritten requirement.
    expect(semanticErrors(dir).errors.length).toBeGreaterThan(0);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("real CLI: the shipped example tree (regression repro)", () => {
  it("passes as shipped, and FAILS once a requirement's prose is rewritten under its id", () => {
    const dir = mkdtempSync(join(tmpdir(), "rc-example-stale-"));
    cpSync(EXAMPLE, dir, { recursive: true, force: true });
    try {
      const clean = spawnSync(NODE, [BUNDLE, "--check", "--semantic", "--out", dir], { encoding: "utf8" });
      expect(clean.status, clean.stderr || clean.stdout).toBe(0);

      const prd = join(dir, "features", "01-core", "PRD.md");
      const before = readFileSync(prd, "utf8");
      const after = before.replace("whose text is `Welcome`", "whose text is `UNSUPPORTED AUDIT CLAIM`");
      expect(after).not.toBe(before); // the repro's anchor still exists
      writeFileSync(prd, after);

      const tampered = spawnSync(NODE, [BUNDLE, "--check", "--semantic", "--out", dir], { encoding: "utf8" });
      expect(tampered.status, tampered.stdout).not.toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
