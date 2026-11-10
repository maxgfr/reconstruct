import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { detectEnrichment, formatPruneReport, writeOutput } from "../src/output.js";
import type { Options, RenderResult } from "../src/types.js";

const temps: string[] = [];
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});
function setup(): { repo: string; out: string } {
  const base = mkdtempSync(join(tmpdir(), "recon-prune-"));
  temps.push(base);
  const repo = join(base, "repo");
  mkdirSync(join(repo, "src"), { recursive: true });
  writeFileSync(join(repo, "src", "a.ts"), "export const a = 1;\n");
  writeFileSync(join(repo, "src", "b.ts"), "export const b = 2;\n");
  return { repo, out: join(base, "out") };
}
const opts = (out: string, extra: Partial<Options> = {}) => ({ out, standalone: false, ...extra }) as Options;
const render = (repo: string, out: string, slugs: string[]): RenderResult => ({
  artifacts: [
    { relPath: "REBUILD.md", content: `# Rebuild ${slugs.join(",")}\n` },
    ...slugs.map((s) => ({ relPath: `features/${s}/PRD.md`, content: `# ${s}\n> 🧠 fill\n` })),
  ],
  copies: slugs.map((s) => ({ from: join(repo, "src", `${s}.ts`), to: join(out, "source", s, "src", `${s}.ts`) })),
});

describe("writeOutput: stale output from a previous run", () => {
  it("removes what the previous run generated and this one did not, with its empty directories", () => {
    const { repo, out } = setup();
    writeOutput(render(repo, out, ["a", "b"]), opts(out));
    const report = writeOutput(render(repo, out, ["a"]), opts(out));
    expect(report.pruned.sort()).toEqual(["features/b/PRD.md", "source/b/src/b.ts"]);
    expect(existsSync(join(out, "features", "b"))).toBe(false);
    expect(existsSync(join(out, "source", "b"))).toBe(false);
    expect(existsSync(join(out, "features", "a", "PRD.md"))).toBe(true);
    expect(formatPruneReport(report)).toMatch(/removed 2 stale file/);
  });

  it("keeps a stale file that was edited since it was generated, and says so", () => {
    const { repo, out } = setup();
    writeOutput(render(repo, out, ["a", "b"]), opts(out));
    writeFileSync(join(out, "features", "b", "PRD.md"), "# b\nagent prose\n");
    const report = writeOutput(render(repo, out, ["a"]), opts(out));
    expect(report.keptEdited).toEqual(["features/b/PRD.md"]);
    expect(readFileSync(join(out, "features", "b", "PRD.md"), "utf8")).toMatch(/agent prose/);
    expect(formatPruneReport(report)).toMatch(/kept 1 stale but edited file/);
  });

  it("never prunes files it did not generate (agent-written docs, a tree without a manifest)", () => {
    const { repo, out } = setup();
    mkdirSync(join(out, "docs"), { recursive: true });
    writeFileSync(join(out, "docs", "notes.md"), "mine\n");
    writeOutput(render(repo, out, ["a", "b"]), opts(out));
    expect(writeOutput(render(repo, out, ["a"]), opts(out)).pruned).not.toContain("docs/notes.md");
    expect(existsSync(join(out, "docs", "notes.md"))).toBe(true);
  });

  it("a standalone bundle step adds to the record and prunes nothing", () => {
    const { repo, out } = setup();
    writeOutput(render(repo, out, ["a", "b"]), opts(out));
    const bundle = writeOutput({ artifacts: [{ relPath: "SPECS.md", content: "# specs\n" }], copies: [] }, opts(out, { standalone: true }));
    expect(bundle.pruned).toEqual([]);
    expect(existsSync(join(out, "features", "b", "PRD.md"))).toBe(true);
    // …and the next full render knows SPECS.md was generated (unchanged → stale → removed).
    expect(writeOutput(render(repo, out, ["a", "b"]), opts(out)).pruned).toEqual(["SPECS.md"]);
  });
});

describe("detectEnrichment: edits to generated documents", () => {
  it("names a callout-free document edited since it was generated", () => {
    const { repo, out } = setup();
    writeOutput(render(repo, out, ["a"]), opts(out));
    expect(detectEnrichment(out)).toEqual([]);
    writeFileSync(join(out, "REBUILD.md"), "# Rebuild\nhand-tuned build order\n");
    expect(detectEnrichment(out)).toEqual(["REBUILD.md — edited since the engine generated it"]);
  });

  it("names a partially enriched PRD that still carries a callout", () => {
    const { repo, out } = setup();
    writeOutput(render(repo, out, ["a"]), opts(out));
    writeFileSync(join(out, "features", "a", "PRD.md"), "# a\n> 🧠 fill\nhalf written\n");
    expect(detectEnrichment(out)).toEqual(["features/a/PRD.md — edited since the engine generated it"]);
  });
});
