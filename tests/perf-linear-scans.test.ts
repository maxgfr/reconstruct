import { describe, expect, it } from "vitest";
import { pythonImportAliases } from "../src/adapters/util.js";

// Scans that run once per source file must stay linear in the file size. The
// bounds are generous (≈100× the measured time) so they only trip on a
// regression to quadratic behaviour, never on a slow CI runner.

const elapsed = (fn: () => unknown): number => {
  const t = performance.now();
  fn();
  return performance.now() - t;
};

describe("linear-time source scans", () => {
  it("pythonImportAliases: a long run of whitespace-only lines (blanked comments) stays linear", () => {
    const src = "from a import b\n" + "    \n".repeat(200_000) + "x = 1\nfrom c import d as e\n";
    let aliases = new Map<string, string>();
    expect(elapsed(() => (aliases = pythonImportAliases(src)))).toBeLessThan(1000);
    expect([...aliases.keys()].sort()).toEqual(["b", "e"]);
  });
});
