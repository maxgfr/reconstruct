import { describe, it, expect } from "vitest";
import { detectStylingLibraries, hasUI } from "../src/design.js";
import type { Inventory } from "../src/types.js";

describe("detectStylingLibraries", () => {
  it("filters the styling / UI libraries out of the full library list", () => {
    expect(
      detectStylingLibraries(["Tailwind CSS", "Drizzle ORM", "Radix UI", "Zod"]),
    ).toEqual(["Tailwind CSS", "Radix UI"]);
  });

  it("returns [] when no styling library is present", () => {
    expect(detectStylingLibraries(["Express", "Prisma"])).toEqual([]);
  });
});

function baseInv(over: Partial<Inventory> = {}): Inventory {
  return {
    generatedWith: "reconstruct@test",
    repoName: "x",
    stack: {
      languages: [],
      primaryLanguage: "TypeScript",
      frameworks: [],
      libraries: [],
      packageManagers: [],
      hasTypeScript: true,
    },
    fileCount: 0,
    totalLines: 0,
    files: [],
    dependencies: [],
    routes: [],
    i18n: null,
    schemas: [],
    configs: [],
    docs: [],
    envVars: [],
    scripts: {},
    features: [],
    hints: {
      routeCandidates: [],
      apiCandidates: [],
      schemaCandidates: [],
      realtimeCandidates: [],
      authCandidates: [],
      designSystemCandidates: [],
      entryPoints: [],
    },
    unknowns: [],
    excludedCount: 0,
    ...over,
  };
}

describe("hasUI", () => {
  it("is false for a pure backend inventory", () => {
    expect(hasUI(baseInv())).toBe(false);
  });

  it("is true when a styling library is detected", () => {
    const inv = baseInv();
    inv.stack.stylingLibraries = ["Tailwind CSS"];
    expect(hasUI(inv)).toBe(true);
  });

  it("is true when design-system candidates exist", () => {
    const inv = baseInv();
    inv.hints.designSystemCandidates = ["tailwind.config.ts"];
    expect(hasUI(inv)).toBe(true);
  });

  it("is true when a style file or a page/component route exists", () => {
    expect(
      hasUI(baseInv({ files: [{ path: "a.css", ext: ".css", size: 1, lines: 1, category: "style", binary: false }] })),
    ).toBe(true);
    expect(hasUI(baseInv({ routes: [{ route: "/", file: "page.tsx", kind: "page" }] }))).toBe(true);
  });

  it("is true when a designSystem block is present", () => {
    expect(hasUI(baseInv({ designSystem: { brand: "Calm, minimal" } }))).toBe(true);
  });

  it("is true for a UI framework even with no styling library or designSystem block", () => {
    // The scratch-path gap: a greenfield Next.js plan has empty files/routes/hints
    // and no styling lib, yet is unambiguously a UI product.
    const inv = baseInv();
    inv.stack.frameworks = ["Next.js"];
    expect(hasUI(inv)).toBe(true);
    const react = baseInv();
    react.stack.frameworks = ["React"];
    expect(hasUI(react)).toBe(true);
  });

  it("stays false for a backend framework (no false-positive on an API repo)", () => {
    const inv = baseInv();
    inv.stack.frameworks = ["Express"];
    expect(hasUI(inv)).toBe(false);
    const nest = baseInv();
    nest.stack.frameworks = ["NestJS"];
    expect(hasUI(nest)).toBe(false);
  });
});
