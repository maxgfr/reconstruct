import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyze } from "../src/analyze.js";
import { render } from "../src/prd/render.js";
import { writeOutput } from "../src/output.js";
import { bundleExisting } from "../src/postprocess.js";
import type { Options } from "../src/types.js";

const REPO = fileURLToPath(new URL("./fixtures/sample-app", import.meta.url));

function makeOpts(over: Partial<Options> = {}): Options {
  return {
    repo: REPO,
    out: "/out",
    mode: "preserve",
    level: "light",
    fidelity: "mirror",
    granularity: "coarse",
    include: [],
    exclude: [],
    json: false,
    maxEmbedBytes: 16000,
    merge: false,
    summary: false,
    standalone: false,
    ...over,
  };
}

describe("bundleExisting (standalone post-step)", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "recon-post-"));
    const genOpts = makeOpts({ out: dir });
    writeOutput(render(analyze(genOpts), genOpts), genOpts); // a real tree, no bundles
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("builds RECONSTRUCTION.md and SUMMARY.md from an existing tree", () => {
    const opts = makeOpts({ out: dir, merge: true, summary: true, standalone: true });
    writeOutput(bundleExisting(opts), opts);

    expect(existsSync(join(dir, "RECONSTRUCTION.md"))).toBe(true);
    expect(existsSync(join(dir, "SUMMARY.md"))).toBe(true);

    const merged = readFileSync(join(dir, "RECONSTRUCTION.md"), "utf8");
    expect(merged).toContain("# sample-app — Reconstruction");
    expect(merged).toContain("## Contents");

    const summary = readFileSync(join(dir, "SUMMARY.md"), "utf8");
    expect(summary).toContain("reconstruction summary");
  });

  it("only writes the requested bundle (summary alone)", () => {
    const isolated = mkdtempSync(join(tmpdir(), "recon-post-iso-"));
    const genOpts = makeOpts({ out: isolated });
    writeOutput(render(analyze(genOpts), genOpts), genOpts);

    writeOutput(bundleExisting(makeOpts({ out: isolated, summary: true, standalone: true })), makeOpts({ out: isolated }));
    expect(existsSync(join(isolated, "SUMMARY.md"))).toBe(true);
    expect(existsSync(join(isolated, "RECONSTRUCTION.md"))).toBe(false);
    rmSync(isolated, { recursive: true, force: true });
  });

  it("is idempotent: re-running keeps a single bundle H1", () => {
    const opts = makeOpts({ out: dir, merge: true, standalone: true });
    writeOutput(bundleExisting(opts), opts); // RECONSTRUCTION.md already on disk now
    const merged = readFileSync(join(dir, "RECONSTRUCTION.md"), "utf8");
    const h1s = merged.split("\n").filter((l) => /^# (?!#)/.test(l));
    expect(h1s.length).toBe(1); // the prior RECONSTRUCTION.md was excluded, not re-nested
  });

  it("reads generation provenance from inventory.json for the meta line", () => {
    const opts = makeOpts({ out: dir, summary: true, standalone: true });
    const summary = bundleExisting(opts).artifacts.find((a) => a.relPath === "SUMMARY.md");
    expect(summary?.content).toContain("mode `preserve`");
    expect(summary?.content).toContain("fidelity `mirror`");
  });

  it("excludes copied ground truth (source/ and data/) so it matches the inline merge", () => {
    const isolated = mkdtempSync(join(tmpdir(), "recon-post-gt-"));
    const genOpts = makeOpts({ out: isolated });
    writeOutput(render(analyze(genOpts), genOpts), genOpts);
    // Simulate copied markdown ground truth that must NOT leak into the bundle.
    writeFileSync(join(isolated, "source", "GT_SOURCE_SENTINEL.md"), "# GT_SOURCE_SENTINEL\n");
    writeFileSync(join(isolated, "data", "GT_DATA_SENTINEL.md"), "# GT_DATA_SENTINEL\n");

    const merged = bundleExisting(makeOpts({ out: isolated, merge: true, standalone: true })).artifacts.find(
      (a) => a.relPath === "RECONSTRUCTION.md",
    );
    expect(merged?.content).not.toContain("GT_SOURCE_SENTINEL");
    expect(merged?.content).not.toContain("GT_DATA_SENTINEL");
    rmSync(isolated, { recursive: true, force: true });
  });

  it("throws a helpful error when inventory.json is missing", () => {
    const empty = mkdtempSync(join(tmpdir(), "recon-post-empty-"));
    writeFileSync(join(empty, "stray.md"), "# nope\n");
    expect(() => bundleExisting(makeOpts({ out: empty, merge: true, standalone: true }))).toThrow(/inventory\.json/);
    rmSync(empty, { recursive: true, force: true });
  });
});
