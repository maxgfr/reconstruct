import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runVerify, applyVerdicts, foldSemantic } from "../src/verify.js";
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

  it("does not add errors when there is no VERIFY.json (no regression)", () => {
    const dir = scratch();
    tree(dir, PRD);
    const check = checkOutput(dir);
    const before = check.errors.length;
    foldSemantic(dir, check);
    expect(check.errors.length).toBe(before);
    expect(check.warnings.join(" ").toLowerCase()).toContain("verify");
    rmSync(dir, { recursive: true, force: true });
  });
});
