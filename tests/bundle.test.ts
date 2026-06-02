import { describe, it, expect } from "vitest";
import { demoteHeadings, mergeArtifacts, summarize } from "../src/prd/bundle.js";
import type { Artifact, Inventory, Options, StackInfo } from "../src/types.js";

const STACK: StackInfo = {
  languages: ["TypeScript"],
  primaryLanguage: "TypeScript",
  frameworks: ["Next.js", "React"],
  libraries: ["Drizzle ORM", "tRPC"],
  packageManagers: ["bun"],
  hasTypeScript: true,
};

function makeInv(over: Partial<Inventory> = {}): Inventory {
  return {
    generatedWith: "reconstruct@test",
    generation: { mode: "preserve", level: "light", fidelity: "mirror", granularity: "coarse" },
    repoName: "demo",
    stack: STACK,
    fileCount: 42,
    totalLines: 1234,
    files: [],
    dependencies: [],
    routes: [
      { route: "/", file: "app/page.tsx", kind: "page" },
      { route: "/api/users", file: "app/api/users/route.ts", kind: "api" },
    ],
    i18n: { locales: ["en", "fr"], files: ["messages/en.json", "messages/fr.json"], keyCount: 3 },
    schemas: ["db/schema.ts"],
    configs: ["next.config.js"],
    docs: ["README.md"],
    envVars: ["DATABASE_URL"],
    scripts: {},
    features: [
      { slug: "01-core", name: "Core", description: "Foundations", kind: "feature", files: ["a.ts"], routes: [] },
      { slug: "02-auth", name: "Auth", description: "Login flow", kind: "feature", files: ["b.ts"], routes: [] },
    ],
    hints: { routeCandidates: ["x"], apiCandidates: ["y", "z"], schemaCandidates: ["db/schema.ts"], entryPoints: ["main.ts"] },
    unknowns: ["Map the tRPC procedures into INTERFACES.md"],
    excludedCount: 0,
    ...over,
  };
}

function makeOpts(over: Partial<Options> = {}): Options {
  return {
    repo: "/repo",
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

/** The artifacts a real render produces (markdown bodies trimmed to essentials). */
function sampleArtifacts(): Artifact[] {
  return [
    { relPath: "REBUILD.md", content: "# REBUILD — demo\n\nBuild order here.\n" },
    { relPath: "00-overview/PRD.md", content: "# Overview\n\nProduct summary.\n" },
    { relPath: "architecture/ARCHITECTURE.md", content: "# Architecture\n\n## Layers\nText.\n" },
    { relPath: "architecture/INTERFACES.md", content: "# Interfaces\n\nRoutes.\n" },
    { relPath: "architecture/DATA-MODEL.md", content: "# Data model\n\nEntities.\n" },
    { relPath: "architecture/diagram.md", content: "# Diagram\n\n```mermaid\ngraph TD\n```\n" },
    { relPath: "features/01-core/PRD.md", content: "# Core\n\nCore feature.\n" },
    { relPath: "features/02-auth/PRD.md", content: "# Auth\n\nAuth feature.\n" },
    { relPath: "inventory.json", content: '{"INVENTORY_SENTINEL":true}\n' },
  ];
}

describe("demoteHeadings", () => {
  it("adds one level to ATX headings", () => {
    expect(demoteHeadings("# Title")).toBe("## Title");
    expect(demoteHeadings("## Sub")).toBe("### Sub");
  });

  it("demotes by an arbitrary amount", () => {
    expect(demoteHeadings("# Title", 2)).toBe("### Title");
  });

  it("leaves headings inside ``` fenced code blocks untouched", () => {
    const md = ["# Real", "```sh", "# not a heading", "```", "## Also real"].join("\n");
    const out = demoteHeadings(md);
    expect(out).toContain("## Real");
    expect(out).toContain("### Also real");
    expect(out).toContain("\n# not a heading\n"); // unchanged inside the fence
  });

  it("respects ~~~ fences too", () => {
    const md = ["~~~", "# inside tilde", "~~~", "# outside"].join("\n");
    const out = demoteHeadings(md);
    expect(out).toContain("\n# inside tilde\n");
    expect(out).toContain("## outside");
  });

  it("ignores '#text' with no space (not a heading)", () => {
    expect(demoteHeadings("#hashtag stays")).toBe("#hashtag stays");
  });

  it("caps at h6 (never produces h7)", () => {
    expect(demoteHeadings("###### Deep")).toBe("###### Deep");
  });
});

describe("mergeArtifacts", () => {
  const out = mergeArtifacts(sampleArtifacts(), makeInv(), makeOpts());

  it("has exactly one top-level H1 (the bundle title)", () => {
    const h1s = out.split("\n").filter((l) => /^# (?!#)/.test(l));
    expect(h1s.length).toBe(1);
    expect(h1s[0]).toContain("demo");
  });

  it("includes a table of contents linking to section anchors", () => {
    expect(out).toMatch(/## Contents/i);
    expect(out).toContain("(#overview)");
    expect(out).toContain("(#feature-01-core)");
    expect(out).toContain('id="overview"');
  });

  it("demotes each embedded document's headings", () => {
    expect(out).toContain("## Overview"); // was "# Overview"
    expect(out).toContain("## Core"); // was "# Core"
    expect(out).toContain("### Layers"); // was "## Layers"
  });

  it("excludes inventory.json, SUMMARY.md and RECONSTRUCTION.md", () => {
    const arts = [
      ...sampleArtifacts(),
      { relPath: "SUMMARY.md", content: "# SUMMARY_SENTINEL\n" },
      { relPath: "RECONSTRUCTION.md", content: "# MERGE_SENTINEL\n" },
    ];
    const merged = mergeArtifacts(arts, makeInv(), makeOpts());
    expect(merged).not.toContain("INVENTORY_SENTINEL");
    expect(merged).not.toContain("SUMMARY_SENTINEL");
    expect(merged).not.toContain("MERGE_SENTINEL");
  });

  it("orders sections: overview → architecture → features → build order", () => {
    const iOverview = out.indexOf("Overview");
    const iArch = out.indexOf("## Architecture");
    const iCore = out.indexOf("## Core");
    const iAuth = out.indexOf("## Auth");
    const iRebuild = out.indexOf("REBUILD");
    expect(iOverview).toBeLessThan(iArch);
    expect(iArch).toBeLessThan(iCore);
    expect(iCore).toBeLessThan(iAuth); // inventory feature order preserved
    expect(iAuth).toBeLessThan(iRebuild); // build order closes the document
  });
});

describe("summarize", () => {
  const out = summarize(makeInv(), makeOpts());

  it("leads with the repo name and the stack", () => {
    expect(out).toContain("demo");
    expect(out).toContain("TypeScript");
    expect(out).toContain("Next.js");
  });

  it("reports notable libraries and size", () => {
    expect(out).toContain("Drizzle ORM");
    expect(out).toContain("42"); // file count
    expect(out).toContain("1234"); // total lines
  });

  it("lists every feature in build order with its PRD path", () => {
    expect(out).toContain("Core");
    expect(out).toContain("features/01-core/PRD.md");
    expect(out).toContain("Auth");
    expect(out).toContain("features/02-auth/PRD.md");
  });

  it("surfaces locales, counts and unknowns to resolve", () => {
    expect(out).toContain("en");
    expect(out).toContain("fr");
    expect(out).toMatch(/Map the tRPC procedures/);
  });

  it("points to REBUILD.md as the next step", () => {
    expect(out).toContain("REBUILD.md");
  });
});
