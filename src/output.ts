import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Options, RenderResult } from "./types.js";

/** Flush a RenderResult to disk: write artifacts, then copy ground-truth files. */
export function writeOutput(result: RenderResult, opts: Options): void {
  for (const a of result.artifacts) {
    const dest = join(opts.out, a.relPath);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, a.content, "utf8");
  }
  for (const c of result.copies) {
    if (!existsSync(c.from)) continue;
    mkdirSync(dirname(c.to), { recursive: true });
    try {
      copyFileSync(c.from, c.to);
    } catch {
      // Skip files that disappear or are unreadable mid-run.
    }
  }
}
