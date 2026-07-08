import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { renderBrainstorm, runBrainstorm } from "../src/brainstorm.js";
import type { Inventory } from "../src/types.js";

function scratch(): string {
  return mkdtempSync(join(tmpdir(), "rc-brainstorm-"));
}

const SECTIONS = [
  "## Problem space",
  "## Constraints known",
  "## Concepts",
  "### Concept A",
  "### Concept B",
  "### Concept C",
  "## Scoring & decision",
  "## Chosen direction",
  "## Rejected alternatives",
  "## Next step",
];

function seededInv(): Inventory {
  return {
    generatedWith: "reconstruct@test",
    repoName: "acme",
    stack: { languages: ["TypeScript"], primaryLanguage: "TypeScript", frameworks: ["Next.js"], libraries: [], packageManagers: ["pnpm"], hasTypeScript: true },
    fileCount: 10,
    totalLines: 500,
    files: [],
    dependencies: [],
    routes: [{ route: "/api/users", file: "app/api/users/route.ts", kind: "api", method: "GET" }],
    i18n: { locales: ["en", "fr"], files: [], keyCount: 2 },
    schemas: [],
    configs: [],
    docs: [],
    envVars: [],
    scripts: {},
    features: [
      { slug: "01-auth", name: "Authentication", description: "Login and sessions", kind: "feature", files: ["a.ts"], routes: [] },
      { slug: "02-billing", name: "Billing", description: "Invoices", kind: "feature", files: ["b.ts"], routes: [] },
    ],
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
    interfaces: [{ method: "GET", path: "/api/users" }],
    dataModel: [{ entity: "User", fields: [{ name: "id", type: "string" }] }],
    enums: [{ name: "Role", members: ["admin", "user"] }],
  };
}

describe("renderBrainstorm", () => {
  it("renders every template section", () => {
    const md = renderBrainstorm(null, "my-idea");
    for (const s of SECTIONS) expect(md).toContain(s);
  });

  it("an un-enriched brainstorm carries unresolved callouts the gate catches", () => {
    const md = renderBrainstorm(null, "my-idea");
    expect(md.split("🧠").length - 1).toBeGreaterThanOrEqual(SECTIONS.length - 4); // ≥ one per major section
  });

  it("pre-seeds from an existing inventory (recovered surface + evolution framing)", () => {
    const md = renderBrainstorm(seededInv(), "acme");
    expect(md).toContain("## Current surface (recovered)");
    expect(md).toContain("Authentication");
    expect(md).toContain("Billing");
    expect(md).toContain("User"); // entity
    expect(md.toLowerCase()).toMatch(/evolutions?|evolve|iterate|extend/); // evolution framing
  });

  it("a blank brainstorm has no recovered-surface section", () => {
    expect(renderBrainstorm(null, "x")).not.toContain("## Current surface (recovered)");
  });
});

describe("runBrainstorm", () => {
  it("writes BRAINSTORM.md and reports created/seeded", () => {
    const dir = scratch();
    const r = runBrainstorm(dir);
    expect(r.created).toBe(true);
    expect(r.seeded).toBe(false);
    expect(existsSync(join(dir, "BRAINSTORM.md"))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("does not clobber an edited BRAINSTORM.md on a second run", () => {
    const dir = scratch();
    runBrainstorm(dir);
    writeFileSync(join(dir, "BRAINSTORM.md"), "# edited by the agent");
    const r = runBrainstorm(dir);
    expect(r.created).toBe(false);
    expect(readFileSync(join(dir, "BRAINSTORM.md"), "utf8")).toBe("# edited by the agent");
    rmSync(dir, { recursive: true, force: true });
  });

  it("seeds from inventory.json when the out dir is an existing reconstruction", () => {
    const dir = scratch();
    writeFileSync(join(dir, "inventory.json"), JSON.stringify(seededInv()));
    const r = runBrainstorm(dir);
    expect(r.seeded).toBe(true);
    expect(readFileSync(join(dir, "BRAINSTORM.md"), "utf8")).toContain("## Current surface (recovered)");
    rmSync(dir, { recursive: true, force: true });
  });
});
