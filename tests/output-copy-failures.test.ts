import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { writeOutput } from "../src/output.js";
import type { Options } from "../src/types.js";

const temps: string[] = [];
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

describe("writeOutput: mirror copy failures are reported, not swallowed", () => {
  it("returns every copy that failed for a reason other than the source vanishing", () => {
    const dir = mkdtempSync(join(tmpdir(), "recon-copy-"));
    temps.push(dir);
    const out = join(dir, "out");
    writeFileSync(join(dir, "a.txt"), "a");
    writeFileSync(join(dir, "b.txt"), "b");
    // The destination of b.txt is already a directory: copyFileSync → EISDIR.
    mkdirSync(join(out, "source", "b.txt"), { recursive: true });
    const opts = { out } as Options;
    const { copyFailures: failures } = writeOutput(
      {
        artifacts: [],
        copies: [
          { from: join(dir, "a.txt"), to: join(out, "source", "a.txt") },
          { from: join(dir, "b.txt"), to: join(out, "source", "b.txt") },
          { from: join(dir, "gone.txt"), to: join(out, "source", "gone.txt") },
        ],
      },
      opts,
    );
    expect(readFileSync(join(out, "source", "a.txt"), "utf8")).toBe("a");
    expect(failures).toEqual([{ path: join(out, "source", "b.txt"), code: "EISDIR" }]);
  });
});
