import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPlan, planToInventory, renderScratchDocs, validatePlanConsistency } from "../src/scratch.js";
import { render } from "../src/prd/render.js";
import { writeArtifactsIfAbsent } from "../src/output.js";
import { overviewPrd, architectureDoc, interfacesDoc, dataModelDoc, featurePrd, rebuildDoc } from "../src/prd/templates.js";
import type { Feature, Options, ScratchPlan } from "../src/types.js";

function opts(overrides: Partial<Options> = {}): Options {
  return {
    repo: process.cwd(),
    out: join(tmpdir(), "scratch-out"),
    mode: "scratch",
    level: "light",
    fidelity: "describe",
    granularity: "coarse",
    include: [],
    exclude: [],
    json: false,
    maxEmbedBytes: 16000,
    merge: false,
    summary: false,
    features: false,
    specs: false,
    standalone: false,
    scratch: true,
    plan: "plan.json",
    tdd: false,
    check: false,
    ...overrides,
  };
}

function tinyPlan(overrides: Partial<ScratchPlan> = {}): ScratchPlan {
  return {
    project: { name: "todo-app", summary: "A tiny todo app.", audience: "individuals", value: "track tasks" },
    stack: {
      primaryLanguage: "TypeScript",
      frameworks: ["Next.js"],
      libraries: ["Drizzle"],
      packageManagers: ["npm"],
      hasTypeScript: true,
    },
    envVars: ["DATABASE_URL"],
    i18n: { locales: ["en", "fr"] },
    dataModel: [
      {
        entity: "Todo",
        fields: [
          { name: "id", type: "uuid", constraints: "PK" },
          { name: "title", type: "text", constraints: "not null" },
        ],
        relations: ["Todo belongs to User"],
      },
    ],
    interfaces: [{ method: "POST", path: "/api/todos", kind: "REST", auth: "session", notes: "create a todo" }],
    features: [
      { name: "Todos", kind: "feature", tier: 1, summary: "CRUD todos." },
      { name: "Project Setup & Tooling", kind: "project-setup", tier: 0, summary: "Build tooling." },
      { name: "Internationalization", kind: "internationalization", tier: 0, summary: "Locales." },
      { name: "Documentation", kind: "documentation", tier: 2, summary: "Docs." },
    ],
    glossary: [{ term: "Todo", definition: "A task to complete.", avoid: ["item", "task"] }],
    decisions: [{ title: "Use Drizzle ORM", context: "Need a typed DB layer.", decision: "Adopt Drizzle.", why: "Type-safe + lightweight." }],
    ...overrides,
  };
}

describe("loadPlan", () => {
  function writePlan(content: string): string {
    const dir = mkdtempSync(join(tmpdir(), "plan-"));
    const p = join(dir, "plan.json");
    writeFileSync(p, content, "utf8");
    return p;
  }

  it("parses a valid plan file", () => {
    const p = writePlan(JSON.stringify(tinyPlan()));
    const plan = loadPlan(p);
    expect(plan.project.name).toBe("todo-app");
    expect(plan.features.length).toBe(4);
  });

  it("throws a clear error on malformed JSON", () => {
    const p = writePlan("{ not valid json ");
    expect(() => loadPlan(p)).toThrow(/plan\.json/i);
  });

  it("throws when a required field is missing", () => {
    const p = writePlan(JSON.stringify({ stack: { primaryLanguage: "TS" } }));
    expect(() => loadPlan(p)).toThrow(/project|features/i);
  });

  it("throws a clear error when the file does not exist", () => {
    expect(() => loadPlan(join(tmpdir(), "does-not-exist-xyz.json"))).toThrow();
  });
});

describe("planToInventory", () => {
  it("records scratch generation provenance (mode=scratch, fidelity=describe)", () => {
    const inv = planToInventory(tinyPlan(), opts());
    expect(inv.generation?.mode).toBe("scratch");
    expect(inv.generation?.fidelity).toBe("describe");
    expect(inv.generation?.level).toBe("light");
  });

  it("carries zero file metrics (greenfield — nothing to read)", () => {
    const inv = planToInventory(tinyPlan(), opts());
    expect(inv.fileCount).toBe(0);
    expect(inv.totalLines).toBe(0);
    expect(inv.files).toEqual([]);
    expect(inv.routes).toEqual([]);
    expect(inv.schemas).toEqual([]);
    expect(inv.excludedCount).toBe(0);
  });

  it("populates stack, env vars, and i18n from the plan", () => {
    const inv = planToInventory(tinyPlan(), opts());
    expect(inv.stack.primaryLanguage).toBe("TypeScript");
    expect(inv.stack.frameworks).toContain("Next.js");
    expect(inv.envVars).toContain("DATABASE_URL");
    expect(inv.i18n?.locales).toEqual(["en", "fr"]);
    expect(inv.repoName).toBe("todo-app");
  });

  it("populates interfaces and dataModel for pre-filled tables", () => {
    const inv = planToInventory(tinyPlan(), opts());
    expect(inv.interfaces?.[0]?.path).toBe("/api/todos");
    expect(inv.dataModel?.[0]?.entity).toBe("Todo");
    expect(inv.dataModel?.[0]?.fields?.[0]?.name).toBe("id");
  });

  it("orders features by dependency tier with NN- numbered slugs", () => {
    const inv = planToInventory(tinyPlan(), opts());
    const slugs = inv.features.map((f) => f.slug);
    // every slug is NN-prefixed and unique sequential
    expect(slugs.every((s) => /^\d{2}-/.test(s))).toBe(true);
    const names = inv.features.map((f) => f.name);
    const idx = (n: string) => names.indexOf(n);
    // tier 0 foundations before the tier-1 feature before tier-2 docs
    expect(idx("Project Setup & Tooling")).toBeLessThan(idx("Todos"));
    expect(idx("Internationalization")).toBeLessThan(idx("Todos"));
    expect(idx("Todos")).toBeLessThan(idx("Documentation"));
  });

  it("defaults missing optional plan sections to empty", () => {
    const minimal: ScratchPlan = {
      project: { name: "bare", summary: "Bare." },
      stack: { primaryLanguage: "Go" },
      features: [{ name: "Core" }],
    };
    const inv = planToInventory(minimal, opts());
    expect(inv.i18n).toBeNull();
    expect(inv.envVars).toEqual([]);
    expect(inv.interfaces).toEqual([]);
    expect(inv.dataModel).toEqual([]);
    expect(inv.features.length).toBe(1);
    expect(inv.features[0]?.slug).toBe("01-core");
  });
});

function feat(inv: { features: Feature[] }, name: string): Feature {
  const f = inv.features.find((x) => x.name === name);
  if (!f) throw new Error(`no feature ${name}`);
  return f;
}

describe("templates — scratch (greenfield) mode", () => {
  const inv = planToInventory(tinyPlan(), opts());

  it("overview renders the product summary, greenfield metrics, and CONTEXT/ADR links", () => {
    const md = overviewPrd(inv, opts());
    expect(md).toContain("A tiny todo app.");
    expect(md).toMatch(/greenfield/i);
    expect(md).toContain("../CONTEXT.md");
    expect(md).toContain("../docs/adr/");
    expect(md).not.toMatch(/Redesign note/);
  });

  it("architecture designs from the interview, not 'reproduce as-is'", () => {
    const md = architectureDoc(inv, opts());
    expect(md).not.toContain("Reproduce the structure above as-is");
    expect(md).toContain("../CONTEXT.md");
    expect(md).toMatch(/greenfield|design/i);
    // i18n line must not claim files were copied to data/translations (there are none)
    expect(md).not.toContain("data/translations/");
  });

  it("INTERFACES renders a pre-filled table from the plan", () => {
    const md = interfacesDoc(inv, opts());
    expect(md).toContain("/api/todos");
    expect(md).toContain("POST");
    expect(md).toContain("create a todo");
  });

  it("DATA-MODEL renders pre-filled entity tables from the plan", () => {
    const md = dataModelDoc(inv, opts());
    expect(md).toContain("Todo");
    expect(md).toContain("uuid");
    expect(md).toContain("belongs to User");
  });

  it("feature PRD carries greenfield agent-notes, not a source-material dump", () => {
    const md = featurePrd(inv, feat(inv, "Todos"), opts(), "SOURCE-PLACEHOLDER");
    expect(md).toMatch(/CONTEXT\.md|interview/i);
    expect(md).not.toContain("## Source material");
    expect(md).not.toContain("SOURCE-PLACEHOLDER");
    expect(md).not.toMatch(/Redesign notes/);
  });

  it("REBUILD reflects scratch/greenfield framing", () => {
    const md = rebuildDoc(inv, opts());
    expect(md).toMatch(/scratch/);
    expect(md).toMatch(/greenfield|interview/i);
  });
});

describe("feature PRD is a full, demanding PRD (both modes)", () => {
  const inv = planToInventory(tinyPlan(), opts());
  const f = feat(inv, "Todos");

  it("includes the core PRD sections in scratch mode", () => {
    const md = featurePrd(inv, f, opts(), "SRC");
    expect(md).toContain("## User stories");
    expect(md).toContain("## Acceptance criteria");
    expect(md).toMatch(/## Edge cases/);
    expect(md).toContain("## Definition of done");
  });

  it("includes the same core PRD sections in code mode, and keeps Source material", () => {
    const md = featurePrd(inv, f, opts({ mode: "preserve", fidelity: "embed" }), "SRC-CODE");
    expect(md).toContain("## User stories");
    expect(md).toContain("## Acceptance criteria");
    expect(md).toMatch(/## Edge cases/);
    expect(md).toContain("## Definition of done");
    expect(md).toContain("## Source material");
  });

  it("pushes the AI to enumerate exhaustively, not stop at the happy path", () => {
    const md = featurePrd(inv, f, opts(), "SRC");
    expect(md).toMatch(/exhaustiv|every (actor|behaviou?r|operation)|do not stop|leave nothing/i);
  });

  it("acceptance criteria demand Given/When/Then scenarios", () => {
    const md = featurePrd(inv, f, opts(), "SRC");
    expect(md).toMatch(/Given[\s\S]*When[\s\S]*Then/);
  });

  it("definition of done is a checklist", () => {
    const md = featurePrd(inv, f, opts(), "SRC");
    const dod = md.slice(md.indexOf("## Definition of done"));
    expect(dod).toMatch(/- \[ \]/);
  });
});

describe("templates — tdd (test-first) mode", () => {
  const inv = planToInventory(tinyPlan(), opts());

  it("feature PRD adds a 'write these first' test plan when --tdd", () => {
    const md = featurePrd(inv, feat(inv, "Todos"), opts({ tdd: true }), "SRC");
    expect(md).toMatch(/write these first|test plan/i);
    expect(md).toMatch(/red.?green.?refactor|failing test/i);
  });

  it("feature PRD omits the test plan without --tdd", () => {
    const md = featurePrd(inv, feat(inv, "Todos"), opts({ tdd: false }), "SRC");
    expect(md).not.toMatch(/write these first/i);
  });

  it("REBUILD makes the build test-first and records TDD in the meta", () => {
    const md = rebuildDoc(inv, opts({ tdd: true }));
    expect(md).toMatch(/test.?first|failing test|red.?green/i);
    expect(md).toContain("TDD");
  });

  it("meta block surfaces TDD across docs when enabled", () => {
    expect(overviewPrd(inv, opts({ tdd: true }))).toContain("TDD");
  });
});

describe("filled tables escape markdown pipes", () => {
  const plan = tinyPlan({
    dataModel: [{ entity: "User", fields: [{ name: "role", type: "enum", constraints: "ADMIN | USER" }] }],
    interfaces: [{ method: "GET", path: "/x", kind: "REST", auth: "a|b", notes: "n" }],
  });
  const inv = planToInventory(plan, opts());

  it("escapes pipes in data-model cells so rows keep their three columns", () => {
    const md = dataModelDoc(inv, opts());
    expect(md).toContain("ADMIN \\| USER");
    expect(md).not.toContain("| ADMIN | USER |");
  });

  it("escapes pipes in interface cells", () => {
    const md = interfacesDoc(inv, opts());
    expect(md).toContain("a\\|b");
  });
});

describe("renderScratchDocs (CONTEXT.md + ADRs from the plan)", () => {
  it("renders CONTEXT.md from the glossary with the project framing", () => {
    const docs = renderScratchDocs(tinyPlan());
    const ctx = docs.find((d) => d.relPath === "CONTEXT.md");
    expect(ctx).toBeDefined();
    expect(ctx?.content).toContain("# todo-app");
    expect(ctx?.content).toContain("A tiny todo app.");
    expect(ctx?.content).toContain("**Todo**");
    expect(ctx?.content).toContain("A task to complete.");
    expect(ctx?.content).toMatch(/_Avoid_:.*item.*task/);
    // dataModel relations surface in the Relationships section
    expect(ctx?.content).toContain("belongs to User");
  });

  it("renders one sequentially-numbered ADR per decision", () => {
    const docs = renderScratchDocs(tinyPlan());
    const adr = docs.find((d) => d.relPath === "docs/adr/0001-use-drizzle-orm.md");
    expect(adr).toBeDefined();
    expect(adr?.content).toContain("# Use Drizzle ORM");
    expect(adr?.content).toContain("Type-safe");
  });

  it("emits no ADRs when the plan records no decisions, but still a CONTEXT.md", () => {
    const docs = renderScratchDocs(tinyPlan({ decisions: [], glossary: [] }));
    expect(docs.some((d) => d.relPath.startsWith("docs/adr/"))).toBe(false);
    expect(docs.some((d) => d.relPath === "CONTEXT.md")).toBe(true);
  });
});

describe("writeArtifactsIfAbsent", () => {
  it("writes missing files but never overwrites existing ones", () => {
    const dir = mkdtempSync(join(tmpdir(), "ifabsent-"));
    const first = writeArtifactsIfAbsent([{ relPath: "CONTEXT.md", content: "engine version" }], dir);
    expect(first).toEqual(["CONTEXT.md"]);
    expect(readFileSync(join(dir, "CONTEXT.md"), "utf8")).toBe("engine version");

    // Simulate an agent-authored richer version, then re-run: it must be preserved.
    writeFileSync(join(dir, "CONTEXT.md"), "agent-authored richer version", "utf8");
    const second = writeArtifactsIfAbsent([{ relPath: "CONTEXT.md", content: "engine version" }], dir);
    expect(second).toEqual([]);
    expect(readFileSync(join(dir, "CONTEXT.md"), "utf8")).toBe("agent-authored richer version");
  });

  it("creates nested directories for ADR paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "ifabsent-"));
    writeArtifactsIfAbsent([{ relPath: "docs/adr/0001-x.md", content: "# X" }], dir);
    expect(existsSync(join(dir, "docs/adr/0001-x.md"))).toBe(true);
  });
});

describe("scratch pipeline integration (render)", () => {
  const inv = planToInventory(tinyPlan(), opts());
  const result = render(inv, opts());

  it("produces the same top-level artifacts as code mode", () => {
    const paths = result.artifacts.map((a) => a.relPath);
    for (const expected of [
      "REBUILD.md",
      "00-overview/PRD.md",
      "architecture/ARCHITECTURE.md",
      "architecture/INTERFACES.md",
      "architecture/DATA-MODEL.md",
      "inventory.json",
    ]) {
      expect(paths).toContain(expected);
    }
    expect(paths.filter((p) => p.startsWith("features/")).length).toBe(inv.features.length);
  });

  it("makes no verbatim copies (greenfield has no source or data)", () => {
    expect(result.copies).toEqual([]);
  });
});

describe("example plan fixture (convergence test case)", () => {
  const fixturePath = fileURLToPath(new URL("./fixtures/scratch-plan/example.plan.json", import.meta.url));

  it("loads and validates", () => {
    const plan = loadPlan(fixturePath);
    expect(plan.project.name).toBe("bookshop");
    expect(plan.i18n?.locales).toEqual(["en", "fr"]);
  });

  it("is internally consistent (no errors, no warnings)", () => {
    const { errors, warnings } = validatePlanConsistency(loadPlan(fixturePath));
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("produces a dependency-tiered inventory mapping 1:1 onto the plan", () => {
    const inv = planToInventory(loadPlan(fixturePath), opts());
    expect(inv.i18n?.locales).toEqual(["en", "fr"]);
    expect((inv.interfaces ?? []).length).toBe(7);
    expect((inv.dataModel ?? []).length).toBe(5);
    expect((inv.enums ?? []).length).toBe(2);
    expect(inv.features.length).toBe(6);
    const names = inv.features.map((f) => f.name);
    // Foundation tiers (project-setup / i18n) sort ahead of feature units.
    expect(names.indexOf("Authentication")).toBeLessThan(names.indexOf("Orders & Checkout"));
    expect(inv.features[0]?.kind).toBe("project-setup");
    expect(inv.features.every((f) => /^\d{2}-/.test(f.slug))).toBe(true);
  });
});
