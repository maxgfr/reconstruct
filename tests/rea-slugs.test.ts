import { describe, expect, it } from "vitest";
import { artifactSlugs } from "../src/rea.js";

describe("rea evidence file names", () => {
  it("keeps the readable slug when it is unique", () => {
    expect(artifactSlugs(["bin/tool.exe", "lib/x.so"])).toEqual(
      new Map([
        ["bin/tool.exe", "bin_tool.exe"],
        ["lib/x.so", "lib_x.so"],
      ]),
    );
  });

  it("disambiguates artifacts whose slugs collide so one never overwrites the other", () => {
    const slugs = artifactSlugs(["lib/x.so", "lib_x.so", "a b.dll", "a_b.dll"]);
    const names = [...slugs.values()];
    expect(new Set(names).size).toBe(4);
    for (const n of names) expect(n).toMatch(/^(lib_x\.so|a_b\.dll)-[0-9a-f]{8}$/);
    // Deterministic across runs: the suffix derives from the path alone.
    expect(artifactSlugs(["lib_x.so", "lib/x.so"]).get("lib/x.so")).toBe(slugs.get("lib/x.so"));
  });
});
