import { describe, expect, it, vi, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { CALLOUT_BEARING_DOCS, detectEnrichment, formatEnrichmentRefusal } from "../src/output.js";
import { parseArgs } from "../src/cli.js";

// Guards the re-run hazard: `writeOutput` re-renders EVERY artifact, so pointing a
// fresh --repo/--scratch run at an already-enriched tree used to delete the prose
// silently (only CONTEXT.md / docs/adr/ / BRAINSTORM.md were written if-absent).
// The unit half tests the detector; the e2e half drives the real bundled CLI to
// prove the refusal actually fires and the enrichment survives.

const BUNDLE = fileURLToPath(new URL("../scripts/analyze.mjs", import.meta.url));
const FIXTURE = fileURLToPath(new URL("./fixtures/sample-app", import.meta.url));
const NODE = process.execPath;

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "rc-guard-"));
}

/** A scaffold-shaped tree: documents still carrying their `> 🧠` callouts. */
function scaffold(dir: string): void {
  mkdirSync(join(dir, "features", "01-core"), { recursive: true });
  mkdirSync(join(dir, "architecture"), { recursive: true });
  writeFileSync(join(dir, "features", "01-core", "PRD.md"), "# Core\n\n## User stories\n\n> 🧠 **For the AI agent:** enumerate every actor.\n");
  writeFileSync(join(dir, "architecture", "INTERFACES.md"), "# Interface surface\n\n> 🧠 **For the AI agent:** enumerate every operation.\n");
}

describe("detectEnrichment", () => {
  it("returns nothing for a missing or empty out dir", () => {
    expect(detectEnrichment(join(tmpdir(), "rc-guard-does-not-exist"))).toEqual([]);
    const dir = tmp();
    expect(detectEnrichment(dir)).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns nothing for a pristine scaffold — every callout still unresolved", () => {
    const dir = tmp();
    scaffold(dir);
    expect(detectEnrichment(dir)).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("flags a feature PRD whose callouts were all resolved", () => {
    const dir = tmp();
    scaffold(dir);
    writeFileSync(join(dir, "features", "01-core", "PRD.md"), "# Core\n\n## User stories\n\n- As a visitor, I can read the docs.\n");
    const w = detectEnrichment(dir);
    expect(w.join("\n")).toMatch(/features[/\\]01-core[/\\]PRD\.md/);
    rmSync(dir, { recursive: true, force: true });
  });

  it("flags an architecture doc whose callouts were all resolved", () => {
    const dir = tmp();
    scaffold(dir);
    writeFileSync(join(dir, "architecture", "INTERFACES.md"), "# Interface surface\n\n| GET | /health | api |\n");
    expect(detectEnrichment(dir).join("\n")).toMatch(/INTERFACES\.md/);
    rmSync(dir, { recursive: true, force: true });
  });

  it("flags a semantic-gate ledger even when every document is still a scaffold", () => {
    const dir = tmp();
    scaffold(dir);
    writeFileSync(join(dir, "REVIEW.json"), JSON.stringify({ ok: false, residual: ["01-core:acceptance:abc"] }));
    expect(detectEnrichment(dir).join("\n")).toMatch(/REVIEW\.json/);
    rmSync(dir, { recursive: true, force: true });
  });

  it("does not flag an empty document (a placeholder is not enrichment)", () => {
    const dir = tmp();
    scaffold(dir);
    writeFileSync(join(dir, "architecture", "INTERFACES.md"), "   \n");
    expect(detectEnrichment(dir)).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});

// The detector reads "no 🧠 callouts left" as "an agent resolved them". That only
// holds for documents the scaffold actually seeds WITH callouts — listing a
// callout-free template (00-overview/PRD.md is one) would flag a pristine tree as
// enriched and make every legitimate re-scaffold demand --force. Pin the
// assumption to a really-generated tree so a template change breaks a test here
// instead of misfiring the guard in the field.
describe("the guard's callout-bearing assumption holds against a real scaffold", () => {
  it("every CALLOUT_BEARING_DOCS entry really carries callouts, and a fresh tree is not flagged", () => {
    const dir = tmp();
    try {
      const gen = spawnSync(NODE, [BUNDLE, "--repo", FIXTURE, "--out", dir], { encoding: "utf8" });
      expect(gen.status, gen.stderr).toBe(0);
      for (const rel of CALLOUT_BEARING_DOCS) {
        const p = join(dir, rel);
        if (!existsSync(p)) continue; // BRAINSTORM.md/DESIGN-SYSTEM.md are conditional
        expect(readFileSync(p, "utf8"), `${rel} ships without 🧠 callouts — it must not gate the re-run guard`).toContain("🧠");
      }
      expect(detectEnrichment(dir), "a freshly generated scaffold must never look enriched").toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lets a pristine tree be re-scaffolded without --force", () => {
    const dir = tmp();
    try {
      spawnSync(NODE, [BUNDLE, "--repo", FIXTURE, "--out", dir], { encoding: "utf8" });
      const again = spawnSync(NODE, [BUNDLE, "--repo", FIXTURE, "--out", dir], { encoding: "utf8" });
      expect(again.status, again.stderr).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("formatEnrichmentRefusal", () => {
  it("names the witnesses and every safe alternative", () => {
    const msg = formatEnrichmentRefusal("/tmp/recon", ["REVIEW.json — a semantic-gate ledger from a previous round"]);
    expect(msg).toMatch(/REVIEW\.json/);
    expect(msg).toMatch(/--check/);
    expect(msg).toMatch(/--force/);
    expect(msg).toMatch(/LOST/);
  });

  it("summarizes the tail instead of listing every witness", () => {
    const msg = formatEnrichmentRefusal(
      "/tmp/recon",
      Array.from({ length: 9 }, (_, i) => `features/0${i}-x/PRD.md — every agent callout resolved`),
    );
    expect(msg).toMatch(/…and 4 more/);
  });
});

describe("parseArgs: --force / --max-verify / --batch-size", () => {
  it("defaults --force to false and leaves the numeric caps unset", () => {
    const o = parseArgs(["--repo", FIXTURE]);
    expect(o.force).toBe(false);
    expect(o.maxVerify).toBeUndefined();
    expect(o.batchSize).toBeUndefined();
  });

  it("parses --force, --max-verify and --batch-size", () => {
    const o = parseArgs(["--repo", FIXTURE, "--force", "--max-verify", "200", "--batch-size", "3"]);
    expect(o.force).toBe(true);
    expect(o.maxVerify).toBe(200);
    expect(o.batchSize).toBe(3);
  });

  // parseArgs reports usage errors via fail() → process.exit(1); trap the exit so
  // the rejecting branch is observable as a throw (same pattern as cli.test.ts).
  afterEach(() => vi.restoreAllMocks());

  it("rejects a non-positive or non-integer cap", () => {
    for (const args of [
      ["--max-verify", "0"],
      ["--max-verify", "-1"],
      ["--batch-size", "1.5"],
      ["--batch-size", "abc"],
    ]) {
      vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
        throw new Error(`process.exit(${code})`);
      }) as never);
      const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      expect(() => parseArgs(["--repo", FIXTURE, ...args]), args.join(" ")).toThrow(/process\.exit\(1\)/);
      expect(stderr.mock.calls.map((c) => String(c[0])).join("")).toMatch(/expected a positive integer/);
      vi.restoreAllMocks();
    }
  });
});

// The scratch (greenfield) path renders the SAME tree from a plan.json, so it
// carries the SAME hazard — and its own subtlety: CONTEXT.md and docs/adr/ are
// written if-absent, so they survive either way, but the PRDs do not.
describe("the guard covers the scratch (greenfield) path too", () => {
  const PLAN = fileURLToPath(new URL("./fixtures/scratch-plan/example.plan.json", import.meta.url));

  it("allows a pristine re-render but refuses an enriched one, keeping CONTEXT.md and the ADRs", () => {
    const dir = tmp();
    try {
      const gen = spawnSync(NODE, [BUNDLE, "--scratch", "--plan", PLAN, "--out", dir], { encoding: "utf8" });
      expect(gen.status, gen.stderr).toBe(0);
      expect(existsSync(join(dir, "CONTEXT.md"))).toBe(true);

      // A pristine scratch scaffold must still be re-renderable.
      expect(spawnSync(NODE, [BUNDLE, "--scratch", "--plan", PLAN, "--out", dir], { encoding: "utf8" }).status).toBe(0);

      // Enrich one architecture doc, then re-run.
      const doc = join(dir, "architecture", "DATA-MODEL.md");
      writeFileSync(doc, readFileSync(doc, "utf8").replace(/^.*🧠.*$/gm, "") + "\n## SENTINEL\n");

      const rerun = spawnSync(NODE, [BUNDLE, "--scratch", "--plan", PLAN, "--out", dir], { encoding: "utf8" });
      expect(rerun.status).not.toBe(0);
      expect(rerun.stderr).toMatch(/ENRICHED/);
      expect(readFileSync(doc, "utf8")).toContain("SENTINEL");
      expect(existsSync(join(dir, "CONTEXT.md"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the bundled CLI refuses to overwrite an enriched tree", () => {
  it("fails the re-run, keeps the prose, and overwrites only under --force", () => {
    const dir = tmp();
    try {
      const gen = spawnSync(NODE, [BUNDLE, "--repo", FIXTURE, "--out", dir], { encoding: "utf8" });
      expect(gen.status, gen.stderr).toBe(0);

      // Stand in for an enrichment pass: resolve the callouts of one feature PRD.
      const prd = join(dir, "features", "01-core", "PRD.md");
      expect(existsSync(prd)).toBe(true);
      writeFileSync(prd, "# Core\n\n## User stories\n\n- As a visitor, I can read the docs.\n\n## SENTINEL\n");

      const rerun = spawnSync(NODE, [BUNDLE, "--repo", FIXTURE, "--out", dir], { encoding: "utf8" });
      expect(rerun.status).not.toBe(0);
      expect(rerun.stderr).toMatch(/ENRICHED/);
      expect(readFileSync(prd, "utf8")).toContain("SENTINEL");

      const forced = spawnSync(NODE, [BUNDLE, "--repo", FIXTURE, "--out", dir, "--force"], { encoding: "utf8" });
      expect(forced.status, forced.stderr).toBe(0);
      expect(readFileSync(prd, "utf8")).not.toContain("SENTINEL");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
