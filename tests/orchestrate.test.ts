import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyze } from "../src/analyze.js";
import { checkOutput } from "../src/check.js";
import { parseArgs } from "../src/cli.js";
import { MAX_AGENTS, PHASES, SMALL_WORKLIST, batchSizeFor, listPhases, orchestrateRun } from "../src/orchestrate.js";
import { writeOutput } from "../src/output.js";
import { render } from "../src/prd/render.js";
import { applyFindings, runReview } from "../src/review.js";
import { runVerify } from "../src/verify.js";

const ENGINE = "/opt/skills/reconstruct/scripts/analyze.mjs";
const FIXTURE = fileURLToPath(new URL("./fixtures/sample-app", import.meta.url));
const MONOREPO = fileURLToPath(new URL("./fixtures/monorepo", import.meta.url));
const BUNDLE = fileURLToPath(new URL("../scripts/analyze.mjs", import.meta.url));

/** Generate a REAL reconstruction tree through the actual engine (analyze → render → writeOutput). */
function generate(repo = FIXTURE): string {
  const dir = mkdtempSync(join(tmpdir(), "rc-orch-"));
  const opts = parseArgs(["--repo", repo, "--out", dir]);
  const inv = analyze(opts);
  writeOutput(render(inv, opts), opts);
  return dir;
}

/**
 * Enrich one feature PRD with n real requirement bullets, then build the verify
 * worklist with the SAME writer the pipeline uses (`runVerify`) — so the
 * adjudicate phase fans out over engine-written state, not hand-rolled JSON.
 */
function withVerifyPairs(dir: string, n: number): void {
  const prdPath = join(dir, "features", "01-core", "PRD.md");
  const bullets = Array.from({ length: n }, (_, i) => `- The layout renders shell number ${i + 1} from app/layout.tsx`).join("\n");
  writeFileSync(prdPath, readFileSync(prdPath, "utf8").replace("## Functional requirements", `## Functional requirements\n${bullets}`));
  runVerify(dir);
}

/** Run a real review round and apply n blocker findings → REVIEW.json failures[]. */
function withBlockers(dir: string, n: number): string[] {
  runReview(dir);
  const findings = Array.from({ length: n }, (_, i) => ({
    feature: "01-core",
    severity: "blocker",
    category: "write-contract",
    problem: `required column ${i + 1} has no source`,
    fix: "resolve it server-side",
  }));
  const f = join(dir, "findings.json");
  writeFileSync(f, JSON.stringify({ findings }));
  return applyFindings(dir, f).failures.map((x) => x.id);
}

/** A tree where every phase is ready: 7 features, flagged review units, blockers, verify pairs. */
function fullState(opts: { pairs?: number; blockers?: number } = {}): string {
  const dir = generate();
  withVerifyPairs(dir, opts.pairs ?? 5);
  withBlockers(dir, opts.blockers ?? 2);
  return dir;
}

const wf = (dir: string, phase: string) => join(dir, "orchestration", `${phase}.workflow.mjs`);
const readWf = (dir: string, phase: string) => readFileSync(wf(dir, phase), "utf8");
const stable = (src: string, dir: string) => src.replaceAll(dir, "<OUT>").replaceAll(ENGINE, "<ENGINE>");

describe("orchestrate — listPhases", () => {
  it("reports all four phases not ready on an empty out dir, naming the producing command", () => {
    const dir = mkdtempSync(join(tmpdir(), "rc-orch-empty-"));
    const phases = listPhases(dir, ENGINE);
    expect(phases.map((p) => p.name)).toEqual(["enrich-map", "review-find", "review-verify", "adjudicate"]);
    for (const p of phases) {
      expect(p.ready).toBe(false);
      expect(p.items).toBe(0);
    }
    expect(phases[0]!.prerequisite).toContain("--repo");
    expect(phases[1]!.prerequisite).toContain("--review");
    expect(phases[2]!.prerequisite).toContain("--review --apply");
    expect(phases[3]!.prerequisite).toContain("--verify");
  });

  it("reports ready phases with real item counts and absolute worklist paths", () => {
    const dir = fullState({ pairs: 5, blockers: 2 });
    const phases = listPhases(dir, ENGINE);
    expect(phases[0]).toMatchObject({ name: "enrich-map", ready: true, items: 7 });
    expect(phases[1]).toMatchObject({ name: "review-find", ready: true, items: 7 });
    expect(phases[2]).toMatchObject({ name: "review-verify", ready: true, items: 2 });
    expect(phases[3]).toMatchObject({ name: "adjudicate", ready: true, items: 5 });
    for (const p of phases) expect(isAbsolute(p.worklist)).toBe(true);
  });

  it("review-find counts only the flagged (needsReview) units", () => {
    const dir = generate();
    withBlockers(dir, 0); // round 1 reviewed clean → REVIEW.json baseline committed
    runReview(dir); // round 2: nothing changed → zero flagged units
    const phases = listPhases(dir, ENGINE);
    const find = phases.find((p) => p.name === "review-find")!;
    expect(find.ready).toBe(true);
    expect(find.items).toBe(0);
  });
});

describe("orchestrate — emitted workflow", () => {
  it("emits one workflow per ready phase, plus contracts and the runbook", () => {
    const dir = fullState();
    const res = orchestrateRun(dir, ENGINE);
    expect(res.exitCode).toBe(0);
    for (const p of PHASES) expect(existsSync(wf(dir, p)), p).toBe(true);
    expect(existsSync(join(dir, "orchestration", "RUNBOOK.md"))).toBe(true);
    for (const role of ["drafter", "finder", "verifier", "adjudicator"]) {
      expect(existsSync(join(dir, "orchestration", "agents", `${role}.md`)), role).toBe(true);
    }
  });

  it("parses as JavaScript the way the Workflow harness evaluates it (meta export + async body)", () => {
    const dir = fullState();
    orchestrateRun(dir, ENGINE);
    for (const phase of PHASES) {
      const [metaLine, ...body] = readWf(dir, phase).split("\n");
      expect(() => new Script(metaLine!.replace("export const meta =", "const meta ="))).not.toThrow();
      expect(() => new Script(`(async () => {\n${body.join("\n")}\n})`)).not.toThrow();
    }
  });

  it("meta is a pure JSON literal on line 1 (name, description, phases)", () => {
    const dir = fullState();
    orchestrateRun(dir, ENGINE);
    const first = readWf(dir, "enrich-map").split("\n")[0]!;
    expect(first.startsWith("export const meta = ")).toBe(true);
    const meta = JSON.parse(first.replace("export const meta = ", "")) as { name: string; description: string; phases: unknown[] };
    expect(meta.name).toBe("reconstruct-enrich-map");
    expect(meta.description.length).toBeGreaterThan(0);
    expect(Array.isArray(meta.phases)).toBe(true);
  });

  it("never contains Date.now / Math.random / new Date (forbidden under the Workflow tool)", () => {
    const dir = fullState();
    orchestrateRun(dir, ENGINE);
    for (const phase of PHASES) {
      const src = readWf(dir, phase);
      expect(src).not.toContain("Date.now(");
      expect(src).not.toContain("Math.random(");
      expect(src).not.toContain("new Date(");
    }
  });

  it("injects absolute OUT/ENGINE/WORKLIST constants matching the tree", () => {
    const dir = fullState();
    orchestrateRun(dir, ENGINE);
    const src = readWf(dir, "adjudicate");
    for (const name of ["OUT", "ENGINE", "WORKLIST"]) {
      const m = src.match(new RegExp(`const ${name} = "([^"]+)"`));
      expect(m, `const ${name} missing`).not.toBeNull();
      expect(isAbsolute(m![1]!)).toBe(true);
    }
    expect(src).toContain(JSON.stringify(join(dir, "VERIFY.todo.json")));
    expect(src).toContain(JSON.stringify(ENGINE));
  });

  it("injects the REAL current worklist ids — a doctored worklist shows up on re-emit", () => {
    const dir = fullState({ pairs: 4 });
    orchestrateRun(dir, ENGINE);
    expect(readWf(dir, "adjudicate")).not.toContain("C999");
    const todoPath = join(dir, "VERIFY.todo.json");
    const todo = JSON.parse(readFileSync(todoPath, "utf8")) as { pairs: Record<string, unknown>[] };
    todo.pairs.push({ ...todo.pairs[0]!, claimId: "C999" });
    writeFileSync(todoPath, JSON.stringify(todo, null, 2));
    orchestrateRun(dir, ENGINE);
    expect(readWf(dir, "adjudicate")).toContain("C999");
  });

  it("is deterministic — two runs over the same state emit byte-identical artifacts", () => {
    const dir = fullState();
    const snapshot = () => PHASES.map((p) => readWf(dir, p)).join("\0") + readFileSync(join(dir, "orchestration", "RUNBOOK.md"), "utf8");
    orchestrateRun(dir, ENGINE);
    const first = snapshot();
    orchestrateRun(dir, ENGINE);
    expect(snapshot()).toBe(first);
  });

  it("batches an adjudicate worklist and dispatches one agent per batch", () => {
    const dir = fullState({ pairs: 20 });
    orchestrateRun(dir, ENGINE);
    const src = readWf(dir, "adjudicate");
    const m = src.match(/const BATCHES = (\[.*?\])\n/s);
    expect(m).not.toBeNull();
    const batches = JSON.parse(m![1]!) as string[][];
    expect(batches.length).toBe(Math.ceil(20 / batchSizeFor("adjudicate", 20)));
    expect(batches.flat().length).toBe(20);
    expect(src).toContain("pipeline(BATCHES");
    expect(src).toContain("agentType: 'general-purpose'");
    expect(src).toContain("schema: SCHEMA");
  });

  it("small worklist (≤ SMALL_WORKLIST) → single agent + an eco notice", () => {
    const dir = fullState({ pairs: 2 });
    const res = orchestrateRun(dir, ENGINE);
    const m = readWf(dir, "adjudicate").match(/const BATCHES = (\[.*?\])\n/s);
    expect((JSON.parse(m![1]!) as string[][]).length).toBe(1);
    expect(res.notices.some((n) => n.includes("--eco"))).toBe(true);
    expect(SMALL_WORKLIST).toBeLessThanOrEqual(batchSizeFor("adjudicate", SMALL_WORKLIST));
  });

  // The unit of work in enrich-map is a COMPLETE feature PRD. Folding several into
  // one agent is what the emitted drafter contract ("you draft ONE feature at a
  // time") explicitly denies, and it serialises work the host would have run
  // concurrently.
  it("enrich-map and review-find dispatch exactly one agent per item", () => {
    const dir = fullState();
    orchestrateRun(dir, ENGINE);
    for (const phase of ["enrich-map", "review-find"] as const) {
      const m = readWf(dir, phase).match(/const BATCHES = (\[.*?\])\n/s);
      const batches = JSON.parse(m![1]!) as string[][];
      expect(
        batches.every((b) => b.length === 1),
        `${phase} batched more than one item per agent`,
      ).toBe(true);
    }
  });

  it("batchSizeFor: per-phase defaults, agent cap, and --batch-size override", () => {
    expect(batchSizeFor("enrich-map", 12)).toBe(1);
    expect(batchSizeFor("review-find", 12)).toBe(1);
    expect(batchSizeFor("review-verify", 12)).toBe(4);
    expect(batchSizeFor("adjudicate", 12)).toBe(4);
    // Past MAX_AGENTS the BATCH grows, not the fleet.
    expect(batchSizeFor("enrich-map", MAX_AGENTS)).toBe(1);
    expect(batchSizeFor("enrich-map", MAX_AGENTS * 2)).toBe(2);
    expect(Math.ceil((MAX_AGENTS * 3) / batchSizeFor("enrich-map", MAX_AGENTS * 3))).toBeLessThanOrEqual(MAX_AGENTS);
    // An explicit override wins outright, in both directions.
    expect(batchSizeFor("enrich-map", 12, 5)).toBe(5);
    expect(batchSizeFor("adjudicate", 12, 1)).toBe(1);
  });

  it("reports the batching decision — a cap is never silent", () => {
    const dir = fullState({ pairs: 20 });
    const res = orchestrateRun(dir, ENGINE);
    const note = res.notices.find((n) => n.includes('"adjudicate"') && n.includes("agent(s)"));
    expect(note).toBeDefined();
    expect(note).toMatch(/20 item\(s\) → 5 agent\(s\), 4 item\(s\) each/);
  });

  it("--batch-size overrides the per-phase default and is reported as such", () => {
    const dir = fullState({ pairs: 20 });
    const res = orchestrateRun(dir, ENGINE, { batchSize: 10 });
    const batches = JSON.parse(readWf(dir, "adjudicate").match(/const BATCHES = (\[.*?\])\n/s)![1]!) as string[][];
    expect(batches.length).toBe(2);
    expect(res.notices.some((n) => n.includes("--batch-size"))).toBe(true);
  });

  it("--list exposes the fan-out shape (batch + agents) per phase", () => {
    const dir = fullState({ pairs: 20 });
    const phases = listPhases(dir, ENGINE);
    const adj = phases.find((p) => p.name === "adjudicate")!;
    expect(adj.batch).toBe(4);
    expect(adj.agents).toBe(5);
    const enrich = phases.find((p) => p.name === "enrich-map")!;
    expect(enrich.batch).toBe(1);
    expect(enrich.agents).toBe(enrich.items);
  });

  it("an empty worklist is skipped with a notice, not emitted", () => {
    const dir = generate();
    runVerify(dir); // an un-enriched scaffold has zero requirement↔evidence pairs
    const res = orchestrateRun(dir, ENGINE);
    expect(res.exitCode).toBe(0);
    expect(existsSync(wf(dir, "adjudicate"))).toBe(false);
    expect(existsSync(wf(dir, "enrich-map"))).toBe(true);
    expect(res.notices.some((n) => n.includes("adjudicate") && n.includes("empty"))).toBe(true);
  });

  it("every contract('<role>') referenced by a workflow has its agents/<role>.md", () => {
    const dir = fullState();
    orchestrateRun(dir, ENGINE);
    const agents = readdirSync(join(dir, "orchestration", "agents")).map((f) => f.replace(/\.md$/, ""));
    for (const phase of PHASES) {
      const refs = [...readWf(dir, phase).matchAll(/contract\('([a-z-]+)'/g)].map((m) => m[1]!);
      expect(refs.length).toBeGreaterThan(0);
      for (const r of refs) expect(agents).toContain(r);
    }
  });

  it("workflows return fragments and never contain a write step (--apply stays with the orchestrator)", () => {
    const dir = fullState();
    orchestrateRun(dir, ENGINE);
    for (const phase of PHASES) {
      const src = readWf(dir, phase);
      expect(src).toMatch(/^return \{/m);
      // --apply may appear only in comments (the orchestrator's next step), never as executed code.
      const code = src
        .split("\n")
        .filter((l) => !l.trim().startsWith("//"))
        .join("\n");
      expect(code).not.toContain("--apply");
    }
  });

  it("monorepo: enrich-map batches never straddle workspaces", () => {
    const dir = generate(MONOREPO);
    orchestrateRun(dir, ENGINE);
    const m = readWf(dir, "enrich-map").match(/const BATCHES = (\[.*?\])\n/s);
    const batches = JSON.parse(m![1]!) as string[][];
    expect(batches.flat().sort()).toEqual(["01-db", "02-project-setup", "03-ui", "04-web-core", "05-web-api", "06-web-dashboard"]);
    // Features of different workspaces (packages/db vs packages/ui vs apps/web)
    // must never share a batch: each drafter stream loads ONE workspace's stack guide.
    const disjoint: [string, string][] = [
      ["01-db", "03-ui"],
      ["01-db", "04-web-core"],
      ["03-ui", "05-web-api"],
    ];
    for (const [a, b] of disjoint) {
      expect(
        batches.some((batch) => batch.includes(a) && batch.includes(b)),
        `${a} and ${b} share a batch`,
      ).toBe(false);
    }
    expect(batches.length).toBeGreaterThanOrEqual(3);
  });
});

describe("orchestrate — contracts & runbook", () => {
  it("every emitted contract carries the one-writer footer and returns structured output", () => {
    const dir = fullState();
    orchestrateRun(dir, ENGINE);
    const agentsDir = join(dir, "orchestration", "agents");
    const files = readdirSync(agentsDir);
    expect(files.sort()).toEqual(["adjudicator.md", "drafter.md", "finder.md", "verifier.md"]);
    for (const f of files) {
      const md = readFileSync(join(agentsDir, f), "utf8");
      expect(md).toContain("Return, don't write");
      expect(md).toMatch(/single serial reducer/i);
      expect(md).toContain("orchestration/out/");
    }
  });

  it("every worklist-driven contract carries the family stale-id rule", () => {
    const dir = fullState();
    orchestrateRun(dir, ENGINE);
    for (const role of ["drafter", "finder", "verifier", "adjudicator"]) {
      const md = readFileSync(join(dir, "orchestration", "agents", `${role}.md`), "utf8");
      expect(md, role).toContain("If an ITEMS id is no longer in the worklist, skip it and say so in your note");
    }
  });

  it("adjudicator carries the verdict kinds + confidence labels and the harsher-verdict rule", () => {
    const dir = fullState();
    orchestrateRun(dir, ENGINE);
    const adj = readFileSync(join(dir, "orchestration", "agents", "adjudicator.md"), "utf8");
    for (const v of ["supported", "partial", "refuted", "unsupported"]) expect(adj).toContain(v);
    for (const c of ["confirmed", "inferred", "gap"]) expect(adj).toContain(c);
    expect(adj).toMatch(/HARSHER/i);
  });

  it("finder carries the nine-check categories and the adversarial rule; verifier the refute-first rule", () => {
    const dir = fullState();
    orchestrateRun(dir, ENGINE);
    const finder = readFileSync(join(dir, "orchestration", "agents", "finder.md"), "utf8");
    for (const s of ["blocker", "major", "minor", "write-contract", "rebuild-test"]) expect(finder).toContain(s);
    expect(finder).toMatch(/adversarial/i);
    const verifier = readFileSync(join(dir, "orchestration", "agents", "verifier.md"), "utf8");
    for (const s of ["confirmed", "refuted", "verifierNote"]) expect(verifier).toContain(s);
    expect(verifier).toMatch(/REFUTE/i);
  });

  it("drafter proposes rows and never writes the shared docs (the map-reduce contract)", () => {
    const dir = fullState();
    orchestrateRun(dir, ENGINE);
    const drafter = readFileSync(join(dir, "orchestration", "agents", "drafter.md"), "utf8");
    for (const s of ["proposals", "INTERFACES.md", "DATA-MODEL.md", "interfaceRows", "entityRows"]) expect(drafter).toContain(s);
    expect(drafter).toMatch(/never race on the same file/);
  });

  it("the runbook covers every phase with concrete paths, the fold commands and the never-fan-out list", () => {
    const dir = fullState();
    orchestrateRun(dir, ENGINE);
    const rb = readFileSync(join(dir, "orchestration", "RUNBOOK.md"), "utf8");
    for (const w of ["inventory.json", "REVIEW.todo.json", "REVIEW.json", "VERIFY.todo.json"]) expect(rb).toContain(join(dir, w));
    expect(rb).toContain(ENGINE);
    for (const role of ["drafter.md", "finder.md", "verifier.md", "adjudicator.md"]) expect(rb).toContain(role);
    expect(rb).toContain("--check --semantic");
    expect(rb).toMatch(/interview/i);
    expect(rb).toMatch(/brainstorm/i);
    expect(rb).toMatch(/scratch build/i);
  });

  it("golden shape (paths normalized)", () => {
    const dir = fullState({ pairs: 4, blockers: 2 });
    orchestrateRun(dir, ENGINE);
    expect(stable(readWf(dir, "adjudicate"), dir)).toMatchSnapshot("adjudicate.workflow.mjs");
    expect(stable(readFileSync(join(dir, "orchestration", "agents", "drafter.md"), "utf8"), dir)).toMatchSnapshot("drafter.md");
    expect(stable(readFileSync(join(dir, "orchestration", "RUNBOOK.md"), "utf8"), dir)).toMatchSnapshot("RUNBOOK.md");
  });
});

describe("orchestrate — eco mode & phase gating", () => {
  it("--eco emits RUNBOOK + contracts only, no workflow scripts", () => {
    const dir = fullState();
    const res = orchestrateRun(dir, ENGINE, { eco: true });
    expect(res.exitCode).toBe(0);
    expect(existsSync(join(dir, "orchestration", "RUNBOOK.md"))).toBe(true);
    expect(existsSync(join(dir, "orchestration", "agents", "drafter.md"))).toBe(true);
    for (const p of PHASES) expect(existsSync(wf(dir, p)), p).toBe(false);
  });

  it("--phase on a not-ready phase exits 2 and names the producing command", () => {
    const dir = generate(); // no REVIEW.todo.json yet
    const res = orchestrateRun(dir, ENGINE, { phase: "review-find" });
    expect(res.exitCode).toBe(2);
    expect(res.errors.some((e) => e.includes("--review"))).toBe(true);
    expect(existsSync(wf(dir, "review-find"))).toBe(false);
  });

  it("--phase restricts emission to that phase", () => {
    const dir = fullState();
    const res = orchestrateRun(dir, ENGINE, { phase: "adjudicate" });
    expect(res.exitCode).toBe(0);
    expect(existsSync(wf(dir, "adjudicate"))).toBe(true);
    expect(existsSync(wf(dir, "enrich-map"))).toBe(false);
  });

  it("an unknown phase exits 2 naming the valid ones", () => {
    const dir = generate();
    const res = orchestrateRun(dir, ENGINE, { phase: "nope" });
    expect(res.exitCode).toBe(2);
    expect(res.errors.some((e) => PHASES.every((p) => e.includes(p)))).toBe(true);
  });

  it("a missing out dir exits 2", () => {
    const res = orchestrateRun(join(tmpdir(), "rc-orch-does-not-exist-xyz"), ENGINE);
    expect(res.exitCode).toBe(2);
  });
});

describe("orchestrate — --check ignores the emitted orchestration dir", () => {
  it("emission changes nothing in the buildability gate", () => {
    const dir = fullState();
    const before = checkOutput(dir);
    orchestrateRun(dir, ENGINE);
    const after = checkOutput(dir);
    expect(after.errors).toEqual(before.errors);
    expect(after.warnings).toEqual(before.warnings);
  });
});

describe("orchestrate — CLI parsing", () => {
  afterEach(() => vi.restoreAllMocks());
  function expectFail(argv: string[], pattern: RegExp) {
    vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    expect(() => parseArgs(argv)).toThrow(/process\.exit\(1\)/);
    expect(stderr.mock.calls.map((c) => String(c[0])).join("")).toMatch(pattern);
  }

  it("parses --orchestrate with its modifiers (--phase/--eco/--list) and defaults out to cwd", () => {
    const o = parseArgs(["--orchestrate", "--phase", "adjudicate", "--eco", "--list", "--out", "/tmp/some-recon"]);
    expect(o.orchestrate).toBe(true);
    expect(o.phase).toBe("adjudicate");
    expect(o.eco).toBe(true);
    expect(o.list).toBe(true);
    expect(o.standalone).toBe(false);
    expect(parseArgs(["--orchestrate"]).out).toBe(process.cwd());
  });

  it("rejects --orchestrate combined with another action", () => {
    expectFail(["--orchestrate", "--check", "--out", "/tmp/x"], /mutually exclusive/);
    expectFail(["--orchestrate", "--verify", "--out", "/tmp/x"], /mutually exclusive/);
    expectFail(["--orchestrate", "--review", "--out", "/tmp/x"], /mutually exclusive/);
    expectFail(["--orchestrate", "--brainstorm", "--out", "/tmp/x"], /mutually exclusive/);
  });
});

// The shipped-bundle wiring: the exact artifact the skill invokes. Requires a
// built bundle (pnpm build) — the same convention review-e2e.test.ts relies on.
describe("orchestrate — CLI wiring e2e (shipped bundle)", () => {
  const NODE = process.execPath;
  const cli = (args: string[]) => {
    const r = spawnSync(NODE, [BUNDLE, ...args], { encoding: "utf8" });
    return { status: r.status ?? 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  };

  it("--orchestrate with a missing out dir exits 2", () => {
    const r = cli(["--orchestrate", "--out", join(tmpdir(), "rc-orch-missing-e2e")]);
    expect(r.status).toBe(2);
  });

  it("--orchestrate --list prints the phases JSON and exits 0", () => {
    const dir = generate();
    const r = cli(["--orchestrate", "--list", "--out", dir]);
    expect(r.status, r.stderr).toBe(0);
    const parsed = JSON.parse(r.stdout) as { phases: { name: string; ready: boolean }[] };
    expect(parsed.phases.map((p) => p.name)).toEqual([...PHASES]);
  });

  it("a full run emits the ready phases and exits 0; a not-ready --phase exits 2 naming the producer", () => {
    const dir = generate();
    const full = cli(["--orchestrate", "--out", dir]);
    expect(full.status, full.stderr).toBe(0);
    expect(existsSync(wf(dir, "enrich-map"))).toBe(true);
    const gated = cli(["--orchestrate", "--phase", "adjudicate", "--out", dir]);
    expect(gated.status).toBe(2);
    expect(gated.stderr).toContain("--verify");
  });
});
