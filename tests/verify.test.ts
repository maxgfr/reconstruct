import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runVerify, applyVerdicts, foldSemantic, formatVerifyReport, reduceVerdicts, resolveEvidence } from "../src/verify.js";
import { checkOutput } from "../src/check.js";

function scratch(): string {
  return mkdtempSync(join(tmpdir(), "rc-verify-"));
}

// A minimal reconstruction tree: inventory.json + one feature PRD with filled
// Functional requirements / Acceptance criteria.
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

const PRD = `# Auth
## Functional requirements
- The system authenticates a user via POST /api/login.
- Passwords are hashed before storage in the User entity.
## Acceptance criteria
- Given valid credentials, when the user calls login, then a session is created.
## Definition of done
- [ ] Every functional requirement is implemented and covered by a test.`;

function writeVerdicts(dir: string, map: Record<string, string>): string {
  const todo = JSON.parse(readFileSync(join(dir, "VERIFY.todo.json"), "utf8"));
  const pairs = todo.pairs.map((p: any) => ({ ...p, verdict: map[p.claimId] ?? "supported", note: "" }));
  const f = join(dir, "verdicts.json");
  writeFileSync(f, JSON.stringify({ pairs }));
  return f;
}

describe("runVerify (requirement worklist)", () => {
  it("extracts requirements and pairs each with feature evidence", () => {
    const dir = scratch();
    tree(dir, PRD);
    const r = runVerify(dir);
    expect(r.pairs.length).toBe(3); // 2 functional + 1 acceptance
    expect(r.pairs.map((p) => p.claimId)).toEqual(["C1", "C2", "C3"]);
    expect(r.pairs.every((p) => p.feature === "01-auth")).toBe(true);
    expect(r.pairs.every((p) => p.digest.length > 0)).toBe(true);
    // the login requirement should match the login route/file in its digest
    expect(r.pairs[0]!.digest.toLowerCase()).toMatch(/login|auth/);
    expect(existsSync(join(dir, "VERIFY.todo.json"))).toBe(true);
    expect(existsSync(join(dir, "VERIFY.md"))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("skips scaffold callouts and empty items", () => {
    const dir = scratch();
    tree(
      dir,
      "# Auth\n## Functional requirements\n> 🧠 fill this in exhaustively\n- A real requirement about login here.\n## Acceptance criteria\n## Definition of done\n",
    );
    const r = runVerify(dir);
    expect(r.pairs.length).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it("caps the worklist at maxVerify", () => {
    const dir = scratch();
    tree(dir, PRD);
    const r = runVerify(dir, { maxVerify: 2 });
    expect(r.pairs.length).toBe(2);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("applyVerdicts (gate)", () => {
  function setup(): string {
    const dir = scratch();
    tree(dir, PRD);
    runVerify(dir);
    return dir;
  }

  it("passes when every requirement traces to evidence", () => {
    const dir = setup();
    const r = applyVerdicts(dir, writeVerdicts(dir, { C1: "supported", C2: "partial", C3: "supported" }));
    expect(r.ok).toBe(true);
    expect(existsSync(join(dir, "VERIFY.json"))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails when a requirement is contradicted by the source (refuted)", () => {
    const dir = setup();
    const r = applyVerdicts(dir, writeVerdicts(dir, { C1: "refuted", C2: "supported", C3: "supported" }));
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.verdict === "refuted")).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails when a requirement has no supporting evidence (invented)", () => {
    const dir = setup();
    const r = applyVerdicts(dir, writeVerdicts(dir, { C1: "unsupported", C2: "supported", C3: "supported" }));
    expect(r.ok).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("orchestrate adjudicator fragments (ADJUDICATE_SCHEMA shape)", () => {
  function setup(): string {
    const dir = scratch();
    tree(dir, PRD);
    runVerify(dir);
    return dir;
  }

  /**
   * The EXACT shape the emitted adjudicate contract/schema returns:
   * `{ verdicts: [{ claimId, verdict, note, confidence }] }` — NO evidenceRef,
   * claim, feature or digest (those live in VERIFY.todo.json).
   */
  function fragment(dir: string, map: Record<string, string> = {}): string {
    const todo = JSON.parse(readFileSync(join(dir, "VERIFY.todo.json"), "utf8"));
    const verdicts = todo.pairs.map((p: any) => ({
      claimId: p.claimId,
      verdict: map[p.claimId] ?? "supported",
      note: "grounded in the captured evidence",
      confidence: "confirmed",
    }));
    const f = join(dir, "verdicts.json");
    writeFileSync(f, JSON.stringify({ verdicts }));
    return f;
  }

  it("folds the schema-shaped fragment, backfilling evidence from VERIFY.todo.json (supported)", () => {
    const dir = setup();
    const r = applyVerdicts(dir, fragment(dir));
    expect(r.ok).toBe(true);
    expect(r.adjudicated).toBe(3); // NOT the 0/0 vacuous fold
    expect(r.supported).toBe(3);
    const sem = JSON.parse(readFileSync(join(dir, "VERIFY.json"), "utf8"));
    const todo = JSON.parse(readFileSync(join(dir, "VERIFY.todo.json"), "utf8"));
    for (const [i, v] of sem.verdicts.entries()) {
      expect(v.claimId).toBe(todo.pairs[i].claimId);
      expect(v.evidenceRef).toBe(todo.pairs[i].evidenceRef); // backfilled, so resolveEvidence still guards it
      expect(v.evidenceRef.length).toBeGreaterThan(0);
      expect(v.claim).toBe(todo.pairs[i].claim);
      expect(v.feature).toBe(todo.pairs[i].feature);
      expect(v.digest).toBe(todo.pairs[i].digest);
      expect(v.confidence).toBe("confirmed");
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it("adjudicates an unsupported fragment verdict into a real gate failure", () => {
    const dir = setup();
    const r = applyVerdicts(dir, fragment(dir, { C1: "unsupported" }));
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.claimId === "C1" && f.verdict === "unsupported")).toBe(true);
    // and the persisted ledger gates check --semantic
    const check = checkOutput(dir);
    const before = check.errors.length;
    foldSemantic(dir, check);
    expect(check.errors.length).toBeGreaterThan(before);
    rmSync(dir, { recursive: true, force: true });
  });

  it("the vacuous-pass repro now FAILS: a file yielding zero rows throws instead of writing an ok ledger", () => {
    const dir = setup();
    const f = join(dir, "verdicts.json");
    writeFileSync(f, JSON.stringify({ verdicts: [] }));
    expect(() => applyVerdicts(dir, f)).toThrow(/no verdict rows/i);
    expect(existsSync(join(dir, "VERIFY.json"))).toBe(false);
    // an object under any OTHER key is just as empty — never a silent 0/0 ok:true
    writeFileSync(f, JSON.stringify({ judgements: [{ claimId: "C1", verdict: "supported" }] }));
    expect(() => applyVerdicts(dir, f)).toThrow(/no verdict rows/i);
    expect(existsSync(join(dir, "VERIFY.json"))).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("ignores unknown claimIds with a report, and errors when ALL are unknown", () => {
    const dir = setup();
    const f = join(dir, "verdicts.json");
    writeFileSync(
      f,
      JSON.stringify({
        verdicts: [
          { claimId: "C1", verdict: "supported", note: "ok", confidence: "confirmed" },
          { claimId: "C999", verdict: "supported", note: "ghost of a stale worklist", confidence: "confirmed" },
        ],
      }),
    );
    const r = applyVerdicts(dir, f);
    expect(r.pairs).toBe(1);
    expect(r.ignored).toEqual(["C999"]);
    expect(formatVerifyReport(r)).toMatch(/1 ignored \(unknown id\)/);
    writeFileSync(f, JSON.stringify({ verdicts: [{ claimId: "C888", verdict: "supported", note: "x", confidence: "confirmed" }] }));
    expect(() => applyVerdicts(dir, f)).toThrow(/unknown/i);
    rmSync(dir, { recursive: true, force: true });
  });

  it("hard-errors on an explicit-but-invalid verdict token (fail-closed, not unadjudicated)", () => {
    const dir = setup();
    const f = join(dir, "verdicts.json");
    writeFileSync(f, JSON.stringify({ verdicts: [{ claimId: "C1", verdict: "SUPPORTED!!", note: "typo", confidence: "confirmed" }] }));
    expect(() => applyVerdicts(dir, f)).toThrow(/invalid verdict/i);
    rmSync(dir, { recursive: true, force: true });
  });

  it("hard-errors on a row missing its claimId", () => {
    const dir = setup();
    const f = join(dir, "verdicts.json");
    writeFileSync(f, JSON.stringify({ verdicts: [{ verdict: "supported", note: "who am I?" }] }));
    expect(() => applyVerdicts(dir, f)).toThrow(/claimId/);
    rmSync(dir, { recursive: true, force: true });
  });

  it("still accepts a null verdict as unadjudicated (mid-loop fragments)", () => {
    const dir = setup();
    const f = join(dir, "verdicts.json");
    writeFileSync(
      f,
      JSON.stringify({
        verdicts: [
          { claimId: "C1", verdict: "supported", note: "", confidence: "confirmed" },
          { claimId: "C2", verdict: null, note: "", confidence: null },
        ],
      }),
    );
    const r = applyVerdicts(dir, f);
    expect(r.adjudicated).toBe(1);
    expect(r.unadjudicated).toEqual(["C2"]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("foldSemantic engagement (vacuous ledgers)", () => {
  it("fails when VERIFY.json carries 0 adjudicated verdicts — the gate never engaged", () => {
    const dir = scratch();
    tree(dir, PRD);
    // The exact ledger the old fail-open applyVerdicts wrote when it could not
    // read a fragment: ok:true with an empty verdicts[].
    writeFileSync(
      join(dir, "VERIFY.json"),
      JSON.stringify({
        ok: true,
        pairs: 0,
        adjudicated: 0,
        supported: 0,
        partial: 0,
        refuted: 0,
        unsupported: 0,
        failures: [],
        unadjudicated: [],
        verdicts: [],
      }),
    );
    const check = checkOutput(dir);
    const before = check.errors.length;
    foldSemantic(dir, check);
    expect(check.errors.length).toBeGreaterThan(before);
    expect(check.errors.join(" ")).toMatch(/0 adjudicated|never engaged/i);
    rmSync(dir, { recursive: true, force: true });
  });

  it("downgrades the vacuous ledger to a warning under allowUnverified", () => {
    const dir = scratch();
    tree(dir, PRD);
    writeFileSync(join(dir, "VERIFY.json"), JSON.stringify({ ok: true, pairs: 0, adjudicated: 0, failures: [], unadjudicated: [], verdicts: [] }));
    const check = checkOutput(dir);
    const before = check.errors.length;
    foldSemantic(dir, check, { allowUnverified: true });
    expect(check.errors.length).toBe(before);
    expect(check.warnings.join(" ")).toMatch(/0 adjudicated|never engaged/i);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("foldSemantic (--check --semantic composition)", () => {
  it("adds an error to the check result when VERIFY.json fails", () => {
    const dir = scratch();
    tree(dir, PRD);
    runVerify(dir);
    applyVerdicts(dir, writeVerdicts(dir, { C1: "unsupported", C2: "supported", C3: "supported" }));
    const check = checkOutput(dir); // mechanical (may have its own errors; we only assert the semantic add)
    const before = check.errors.length;
    foldSemantic(dir, check);
    expect(check.errors.length).toBeGreaterThan(before);
    rmSync(dir, { recursive: true, force: true });
  });

  it("errors when VERIFY.json is absent (fail closed)", () => {
    const dir = scratch();
    tree(dir, PRD);
    const check = checkOutput(dir);
    const before = check.errors.length;
    foldSemantic(dir, check);
    expect(check.errors.length).toBeGreaterThan(before);
    expect(check.errors.join(" ").toLowerCase()).toContain("verify");
    rmSync(dir, { recursive: true, force: true });
  });

  it("downgrades the absent ledger to a warning under allowUnverified", () => {
    const dir = scratch();
    tree(dir, PRD);
    const check = checkOutput(dir);
    const before = check.errors.length;
    foldSemantic(dir, check, { allowUnverified: true });
    expect(check.errors.length).toBe(before);
    expect(check.warnings.join(" ").toLowerCase()).toContain("verify");
    rmSync(dir, { recursive: true, force: true });
  });

  it("errors on an unparseable VERIFY.json", () => {
    const dir = scratch();
    tree(dir, PRD);
    writeFileSync(join(dir, "VERIFY.json"), "not-json{");
    const check = checkOutput(dir);
    const before = check.errors.length;
    foldSemantic(dir, check);
    expect(check.errors.length).toBeGreaterThan(before);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("foldSemantic re-reduces the persisted ledger (no trusted summary)", () => {
  it("ignores a tampered ok:true when verdicts[] still carry a refuted claim", () => {
    const dir = scratch();
    tree(dir, PRD);
    runVerify(dir);
    applyVerdicts(dir, writeVerdicts(dir, { C1: "refuted", C2: "supported", C3: "supported" }));
    // Tamper the summary but keep the ledger: the gate must re-reduce verdicts[].
    const sem = JSON.parse(readFileSync(join(dir, "VERIFY.json"), "utf8"));
    sem.ok = true;
    sem.failures = [];
    writeFileSync(join(dir, "VERIFY.json"), JSON.stringify(sem));
    const check = checkOutput(dir);
    const before = check.errors.length;
    foldSemantic(dir, check);
    expect(check.errors.length).toBeGreaterThan(before);
    rmSync(dir, { recursive: true, force: true });
  });

  it("errors when VERIFY.json carries no verdicts[] (pre-ledger or stripped file)", () => {
    const dir = scratch();
    tree(dir, PRD);
    writeFileSync(join(dir, "VERIFY.json"), JSON.stringify({ ok: true, pairs: 3, adjudicated: 3, failures: [] }));
    const check = checkOutput(dir);
    const before = check.errors.length;
    foldSemantic(dir, check);
    expect(check.errors.length).toBeGreaterThan(before);
    expect(check.errors.join(" ")).toMatch(/--verify/);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("evidence resolution (fabricated citations)", () => {
  function setup(): string {
    const dir = scratch();
    tree(dir, PRD);
    runVerify(dir);
    return dir;
  }

  it("fails a supported verdict whose evidenceRef names a route the inventory does not contain", () => {
    const dir = setup();
    const todo = JSON.parse(readFileSync(join(dir, "VERIFY.todo.json"), "utf8"));
    const pairs = todo.pairs.map((p: any, i: number) => ({
      ...p,
      verdict: "supported",
      note: "",
      evidenceRef: i === 0 ? "route DELETE /api/ghost" : p.evidenceRef,
    }));
    const f = join(dir, "verdicts.json");
    writeFileSync(f, JSON.stringify({ pairs }));
    const r = applyVerdicts(dir, f);
    expect(r.ok).toBe(false);
    expect(r.failures.some((x) => /does not resolve|fabricated/i.test(x.note))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("accepts engine-generated refs of every form", () => {
    const dir = setup();
    const todo = JSON.parse(readFileSync(join(dir, "VERIFY.todo.json"), "utf8"));
    const refs = ["route POST /api/login", "entity User", "src/auth.ts", "feature 01-auth", "feature 01-auth (no captured evidence)"];
    const pairs = todo.pairs.map((p: any, i: number) => ({
      ...p,
      verdict: "supported",
      note: "",
      evidenceRef: refs[i % refs.length],
    }));
    const f = join(dir, "verdicts.json");
    writeFileSync(f, JSON.stringify({ pairs }));
    const r = applyVerdicts(dir, f);
    expect(r.ok).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("foldSemantic re-validates refs even when VERIFY.json was hand-edited post-apply", () => {
    const dir = setup();
    applyVerdicts(dir, writeVerdicts(dir, { C1: "supported", C2: "supported", C3: "supported" }));
    const sem = JSON.parse(readFileSync(join(dir, "VERIFY.json"), "utf8"));
    expect(sem.ok).toBe(true);
    sem.verdicts[0].evidenceRef = "route DELETE /api/ghost";
    writeFileSync(join(dir, "VERIFY.json"), JSON.stringify(sem));
    const check = checkOutput(dir);
    const before = check.errors.length;
    foldSemantic(dir, check);
    expect(check.errors.length).toBeGreaterThan(before);
    rmSync(dir, { recursive: true, force: true });
  });

  it("confidence: applyVerdicts keeps a valid label and drops an invalid one", () => {
    const dir = setup();
    const todo = JSON.parse(readFileSync(join(dir, "VERIFY.todo.json"), "utf8"));
    const labels = ["confirmed", "banana", "gap"];
    const pairs = todo.pairs.map((p: any, i: number) => ({ ...p, verdict: "supported", note: "", confidence: labels[i] }));
    const f = join(dir, "verdicts.json");
    writeFileSync(f, JSON.stringify({ pairs }));
    applyVerdicts(dir, f);
    const sem = JSON.parse(readFileSync(join(dir, "VERIFY.json"), "utf8"));
    expect(sem.verdicts[0].confidence).toBe("confirmed");
    expect(sem.verdicts[1].confidence).toBeUndefined();
    expect(sem.verdicts[2].confidence).toBe("gap");
    rmSync(dir, { recursive: true, force: true });
  });

  it("confidence: reduceVerdicts aggregates the label counts", () => {
    const v = (claimId: string, confidence?: string) =>
      ({ claimId, claim: "", feature: "f", evidenceRef: "feature f", digest: "", verdict: "supported", note: "", confidence }) as any;
    const r = reduceVerdicts([v("C1", "confirmed"), v("C2", "inferred"), v("C3", "gap"), v("C4")]);
    expect(r.confidence).toEqual({ confirmed: 1, inferred: 1, gap: 1, unlabeled: 1 });
  });

  it("confidence: formatVerifyReport prints the label line only when labels exist", () => {
    const v = (claimId: string, confidence?: string) =>
      ({ claimId, claim: "", feature: "f", evidenceRef: "feature f", digest: "", verdict: "supported", note: "", confidence }) as any;
    const labeled = formatVerifyReport(reduceVerdicts([v("C1", "confirmed"), v("C2", "gap")]));
    expect(labeled).toMatch(/confidence: .*1 confirmed.*1 gap/);
    const unlabeled = formatVerifyReport(reduceVerdicts([v("C1"), v("C2")]));
    expect(unlabeled).not.toContain("confidence:");
  });

  it("confidence: foldSemantic warns on gap-labeled verdicts", () => {
    const dir = setup();
    const todo = JSON.parse(readFileSync(join(dir, "VERIFY.todo.json"), "utf8"));
    const pairs = todo.pairs.map((p: any, i: number) => ({ ...p, verdict: "supported", note: "", confidence: i === 0 ? "gap" : "confirmed" }));
    const f = join(dir, "verdicts.json");
    writeFileSync(f, JSON.stringify({ pairs }));
    const r = applyVerdicts(dir, f);
    expect(r.ok).toBe(true); // confidence is triage metadata, never a gate
    const check = checkOutput(dir);
    foldSemantic(dir, check);
    expect(check.warnings.join(" ")).toMatch(/gap/);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a file:line citation whose line is beyond the file's known length, but accepts an in-range one", () => {
    // The inventory records each file's `lines`; a citation pointing at a line
    // past the end of a real file is a wrong/fabricated citation the guard must
    // catch (fail-closed), while an in-range line and a plain path must resolve.
    const inv: any = {
      repoName: "demo",
      files: [{ path: "src/main.ts", ext: ".ts", size: 100, lines: 60, category: "code", binary: false }],
      features: [{ slug: "01-core", name: "Core", kind: "feature", files: ["src/only-in-feature.ts"], routes: [], interfaces: [], entities: [] }],
    };
    // plain path (no locator) — unchanged behaviour
    expect(resolveEvidence("src/main.ts", inv)).toBe(true);
    expect(resolveEvidence("src/nope.ts", inv)).toBe(false);
    // in-range single line + range — resolve
    expect(resolveEvidence("src/main.ts:5", inv)).toBe(true);
    expect(resolveEvidence("src/main.ts:60", inv)).toBe(true);
    expect(resolveEvidence("src/main.ts:10-40", inv)).toBe(true);
    // out-of-range line — fail closed
    expect(resolveEvidence("src/main.ts:9999", inv)).toBe(false);
    expect(resolveEvidence("src/main.ts:61", inv)).toBe(false);
    expect(resolveEvidence("src/main.ts:10-9999", inv)).toBe(false);
    // a file known only through a feature's string list has no recorded length →
    // a locator on it must NOT false-fail (we can only range-check when we know the length)
    expect(resolveEvidence("src/only-in-feature.ts:9999", inv)).toBe(true);
  });

  it("real RouteInfo-shaped feature routes produce route refs with a path", () => {
    const dir = scratch();
    const inv = {
      repoName: "demo",
      features: [
        {
          slug: "01-items",
          name: "Items",
          description: "item listing",
          kind: "feature",
          files: [],
          routes: [{ method: "GET", route: "/items", kind: "api", file: "src/items.ts" }],
          interfaces: [],
          entities: [],
        },
      ],
    };
    writeFileSync(join(dir, "inventory.json"), JSON.stringify(inv, null, 2));
    mkdirSync(join(dir, "features", "01-items"), { recursive: true });
    writeFileSync(join(dir, "features", "01-items", "PRD.md"), "# Items\n## Functional requirements\n- The system lists items via GET /items.\n");
    const r = runVerify(dir);
    expect(r.pairs[0]!.evidenceRef).toBe("route GET /items");
    rmSync(dir, { recursive: true, force: true });
  });
});
