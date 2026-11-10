import { mkdirSync, mkdtempSync, realpathSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canonical } from "../src/tree-lock.js";

describe("tree lock key", () => {
  it("is the same before and after a nested out dir is created under a symlinked parent", () => {
    const real = mkdtempSync(join(tmpdir(), "rc-lock-"));
    const link = `${real}-link`;
    symlinkSync(real, link);
    const out = join(link, "new", "out");
    const before = canonical(out);
    mkdirSync(out, { recursive: true });
    expect(canonical(out)).toBe(before);
    expect(before).toBe(join(realpathSync(real), "new", "out"));
  });
});
