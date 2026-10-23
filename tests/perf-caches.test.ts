import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { readSources, stripComments, withSourceCache } from "../src/adapters/util.js";
import { primeRead, cachedRead, withReadCache } from "../src/read-cache.js";
import type { FileInfo } from "../src/types.js";

// The per-analysis caches: one read per file inside a pass, never a stale
// read across passes.

const temps: string[] = [];
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

function repoWith(content: string): { repo: string; abs: string; files: FileInfo[] } {
  const repo = mkdtempSync(join(tmpdir(), "rc-caches-"));
  temps.push(repo);
  const abs = join(repo, "app.js");
  writeFileSync(abs, content);
  return { repo, abs, files: [{ path: "app.js", ext: ".js", size: content.length, lines: 1, category: "code", binary: false }] };
}

describe("cachedRead / withReadCache", () => {
  it("reads once inside a pass and fresh outside it", () => {
    const { abs } = repoWith("v1");
    withReadCache(() => {
      expect(cachedRead(abs)).toBe("v1");
      writeFileSync(abs, "v2");
      expect(cachedRead(abs)).toBe("v1"); // same pass: the first read is shared
    });
    expect(cachedRead(abs)).toBe("v2"); // outside any pass: always the disk
  });

  it("takes the walk's primed text, and ignores priming outside a pass", () => {
    const { abs } = repoWith("on disk");
    primeRead(abs, "primed");
    expect(cachedRead(abs)).toBe("on disk");
    withReadCache(() => {
      primeRead(abs, "primed");
      expect(cachedRead(abs)).toBe("primed");
    });
  });

  it("an unreadable file is null, not a throw", () => {
    expect(withReadCache(() => cachedRead("/definitely/not/here"))).toBeNull();
  });
});

describe("readSources / withSourceCache", () => {
  it("strips each file once per detection pass, and re-reads across passes", () => {
    const { repo, abs, files } = repoWith('app.get("/a"); // v1\n');
    withSourceCache(() => {
      expect(readSources(files, repo, [".js"]).get("app.js")).toContain('app.get("/a")');
      writeFileSync(abs, 'app.get("/b");\n');
      expect(readSources(files, repo, [".js"]).get("app.js")).toContain('app.get("/a")');
    });
    expect(readSources(files, repo, [".js"]).get("app.js")).toContain('app.get("/b")');
  });
});

describe("stripComments", () => {
  it("returns the very same string when there is no comment introducer", () => {
    const src = 'app.get("x", h);\nconst a = 1;\n';
    expect(stripComments(src, ".js")).toBe(src);
    expect(stripComments("x = 1\n", ".py")).toBe("x = 1\n");
  });

  it("stays linear on a pathological single-line file", () => {
    const line = `${"a".repeat(200_000)} // tail`;
    const t = performance.now();
    const out = stripComments(line, ".js");
    expect(out.length).toBe(line.length);
    expect(out.endsWith("       ")).toBe(true);
    expect(performance.now() - t).toBeLessThan(2000);
  });
});
