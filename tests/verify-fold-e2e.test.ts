import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

// Fold-integration tests for the adjudication gate: the EXACT fragment shape the
// orchestrate-emitted adjudicator contract/schema returns —
// `{ "verdicts": [{ claimId, verdict, note, confidence }] }` — driven through the
// REAL bundled CLI (`--verify` then `--verify --apply`), the same subprocess the
// skill and the emitted workflows invoke. This is the round-trip that used to
// fold 0/0 with exit 0 (the fail-open path on the flagship gate).

const BUNDLE = fileURLToPath(new URL("../scripts/analyze.mjs", import.meta.url));
const FIXTURE = fileURLToPath(new URL("./fixtures/sample-app", import.meta.url));
const NODE = process.execPath;

function cli(dir: string, args: string[]) {
  const r = spawnSync(NODE, [BUNDLE, ...args, "--out", dir], { encoding: "utf8" });
  return { status: r.status ?? 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** Generate a real tree, give one feature real requirement bullets, run --verify. */
function generateWithWorklist(): { dir: string; todo: { pairs: any[] } } {
  const dir = mkdtempSync(join(tmpdir(), "rc-fold-e2e-"));
  const gen = spawnSync(NODE, [BUNDLE, "--repo", FIXTURE, "--out", dir], { encoding: "utf8" });
  if (gen.status !== 0) throw new Error(`generate failed: ${gen.stderr}`);
  const slug = readdirSync(join(dir, "features"))[0]!;
  const prdPath = join(dir, "features", slug, "PRD.md");
  const bullets = ["- The layout renders the application shell from app/layout.tsx", "- The home page lists items from app/page.tsx"].join("\n");
  writeFileSync(prdPath, readFileSync(prdPath, "utf8").replace("## Functional requirements", `## Functional requirements\n${bullets}`));
  const v = cli(dir, ["--verify"]);
  if (v.status !== 0) throw new Error(`--verify failed: ${v.stderr}`);
  const todo = JSON.parse(readFileSync(join(dir, "VERIFY.todo.json"), "utf8"));
  return { dir, todo };
}

/** Save the schema-shaped fragment (claimId/verdict/note/confidence ONLY) and run the real fold. */
function applyFragment(dir: string, todo: { pairs: any[] }, map: Record<string, string> = {}) {
  const verdicts = todo.pairs.map((p) => ({
    claimId: p.claimId,
    verdict: map[p.claimId] ?? "supported",
    note: "traces to the captured source",
    confidence: "confirmed",
  }));
  const f = join(dir, "verdicts.json");
  writeFileSync(f, JSON.stringify({ verdicts }));
  return cli(dir, ["--verify", "--apply", f]);
}

describe("--verify --apply round-trips the orchestrate adjudicator fragment (real CLI)", () => {
  it("supported fragment: adjudicates every pair and exits 0 (never the vacuous 0/0)", () => {
    const { dir, todo } = generateWithWorklist();
    expect(todo.pairs.length).toBeGreaterThan(0);
    const r = applyFragment(dir, todo);
    expect(r.status, r.stderr || r.stdout).toBe(0);
    expect(r.stdout).toContain(`${todo.pairs.length}/${todo.pairs.length} requirement(s) adjudicated`);
    expect(r.stdout).not.toContain("0/0");
    const sem = JSON.parse(readFileSync(join(dir, "VERIFY.json"), "utf8"));
    expect(sem.ok).toBe(true);
    expect(sem.adjudicated).toBe(todo.pairs.length);
    // evidence backfilled from the worklist, so the citation guard stays engaged
    for (const [i, v] of sem.verdicts.entries()) {
      expect(v.evidenceRef).toBe(todo.pairs[i].evidenceRef);
      expect(v.evidenceRef.length).toBeGreaterThan(0);
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it("unsupported fragment verdict: the fold fails the gate (exit 1) with the failure named", () => {
    const { dir, todo } = generateWithWorklist();
    const first = todo.pairs[0]!.claimId as string;
    const r = applyFragment(dir, todo, { [first]: "unsupported" });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain(first);
    expect(r.stdout).toContain("unsupported");
    const sem = JSON.parse(readFileSync(join(dir, "VERIFY.json"), "utf8"));
    expect(sem.ok).toBe(false);
    expect(sem.failures.some((f: any) => f.claimId === first && f.verdict === "unsupported")).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("a fragment yielding zero rows fails closed (non-zero exit, no ok ledger)", () => {
    const { dir } = generateWithWorklist();
    const f = join(dir, "verdicts.json");
    writeFileSync(f, JSON.stringify({ verdicts: [] }));
    const r = cli(dir, ["--verify", "--apply", f]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/no verdict rows/i);
    rmSync(dir, { recursive: true, force: true });
  });
});
