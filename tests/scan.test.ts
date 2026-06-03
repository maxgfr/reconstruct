import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { walk } from "../src/walk.js";
import { extractEnvVars } from "../src/adapters/generic.js";
import type { FileInfo } from "../src/types.js";

function makeRepo(write: (w: (rel: string, content: string) => void) => void): string {
  const repo = mkdtempSync(join(tmpdir(), "recon-scan-"));
  const w = (rel: string, content: string) => {
    const abs = join(repo, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  };
  write(w);
  return repo;
}

const repos: string[] = [];
function repo(write: (w: (rel: string, content: string) => void) => void): string {
  const r = makeRepo(write);
  repos.push(r);
  return r;
}
afterAll(() => repos.forEach((r) => rmSync(r, { recursive: true, force: true })));

describe("walk transparency & scoping", () => {
  it("returns files plus a count of files excluded by ignore rules", () => {
    const r = repo((w) => {
      w(".gitignore", "ignored.ts\n");
      w("keep.ts", "export const x = 1;");
      w("ignored.ts", "secret");
      w("package-lock.json", "{}"); // default-ignored file
    });
    const { files, excludedCount } = walk(r);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("keep.ts");
    expect(paths).not.toContain("ignored.ts");
    expect(paths).not.toContain("package-lock.json");
    expect(excludedCount).toBeGreaterThanOrEqual(2);
  });

  it("honors an include glob (keeps only matches)", () => {
    const r = repo((w) => {
      w("a.ts", "1");
      w("b.js", "1");
      w("c.ts", "1");
    });
    const { files } = walk(r, { include: ["**/*.ts"] });
    const exts = files.map((f) => f.ext);
    expect(exts.every((e) => e === ".ts")).toBe(true);
    expect(files.length).toBe(2);
  });

  it("honors an exclude glob (drops matches, counts them)", () => {
    const r = repo((w) => {
      w("a.ts", "1");
      w("a.test.ts", "1");
    });
    const { files, excludedCount } = walk(r, { exclude: ["**/*.test.ts"] });
    const paths = files.map((f) => f.path);
    expect(paths).toContain("a.ts");
    expect(paths).not.toContain("a.test.ts");
    expect(excludedCount).toBeGreaterThanOrEqual(1);
  });

  it("prunes prior reconstruct outputs by inventory.json signature, whatever they're named", () => {
    const sig = JSON.stringify({ generatedWith: "reconstruct@0.6.2", repoName: "x" });
    const r = repo((w) => {
      w("src/app.ts", "export const x = 1;");
      // output trees the name-based default ignore does NOT cover
      w("reconstruction-scratch/00-overview/PRD.md", "# Overview\n");
      w("reconstruction-scratch/inventory.json", sig);
      w("custom-out/REBUILD.md", "# r\n");
      w("custom-out/inventory.json", sig);
      // a normal dir that merely has a non-reconstruct inventory.json — kept
      w("data-pkg/inventory.json", JSON.stringify({ foo: 1 }));
      w("data-pkg/value.ts", "1");
    });
    const { files } = walk(r);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("src/app.ts");
    expect(paths).toContain("data-pkg/value.ts"); // not a reconstruct output → kept
    expect(paths.some((p) => p.startsWith("reconstruction-scratch/"))).toBe(false);
    expect(paths.some((p) => p.startsWith("custom-out/"))).toBe(false);
  });

  it("prunes this run's --out tree even before it has an inventory (first run)", () => {
    const r = repo((w) => {
      w("src/app.ts", "1");
      w("fresh-out/placeholder.md", "wip"); // freshly created, no inventory.json yet
    });
    const { files } = walk(r, { out: join(r, "fresh-out") });
    expect(files.some((f) => f.path.startsWith("fresh-out/"))).toBe(false);
    expect(files.some((f) => f.path === "src/app.ts")).toBe(true);
  });
});

describe("extractEnvVars has no silent file cap", () => {
  let r: string;
  const files: FileInfo[] = [];
  const COUNT = 2050; // deliberately past the old hard-coded 2000-file cap

  beforeAll(() => {
    r = mkdtempSync(join(tmpdir(), "recon-env-"));
    mkdirSync(join(r, "src"), { recursive: true });
    for (let i = 0; i < COUNT; i++) {
      const rel = `src/f${String(i).padStart(5, "0")}.js`;
      writeFileSync(join(r, rel), `process.env.VAR_${i};`);
      files.push({ path: rel, ext: ".js", size: 20, lines: 1, category: "code", binary: false });
    }
    // sentinel sorts last, so it is only reached if scanning is uncapped
    const sentinel = "src/zzzz_last.js";
    writeFileSync(join(r, sentinel), "process.env.SENTINEL_VAR;");
    files.push({ path: sentinel, ext: ".js", size: 25, lines: 1, category: "code", binary: false });
    files.sort((a, b) => a.path.localeCompare(b.path));
  });

  afterAll(() => rmSync(r, { recursive: true, force: true }));

  it("captures env vars from files beyond the 2000th", () => {
    const vars = extractEnvVars(r, files);
    expect(vars).toContain("SENTINEL_VAR");
    expect(vars).toContain("VAR_2049");
  });
});
