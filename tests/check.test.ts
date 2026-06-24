import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { checkOutput } from "../src/check.js";

function write(dir: string, rel: string, content: string): void {
  const dest = join(dir, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content, "utf8");
}

const INVENTORY = {
  generatedWith: "reconstruct@0.5.0",
  repoName: "demo",
  features: [
    { slug: "01-auth", name: "Auth", interfaces: ["auth.register"], entities: ["users"] },
    { slug: "02-posts", name: "Posts", interfaces: ["posts.list"], entities: ["posts"] },
  ],
  interfaces: [
    { method: "tRPC", path: "auth.register" },
    { method: "tRPC", path: "posts.list" },
  ],
  dataModel: [{ entity: "users", fields: [] }, { entity: "posts", fields: [] }],
  i18n: { locales: ["en", "fr"], files: [], keyCount: 0 },
};

const SPINE =
  "## Functional requirements\n\nDone.\n\n## Acceptance criteria\n\nGiven/When/Then.\n\n## Definition of done\n\n- [ ] done\n";

/** A fully-enriched, buildable tree (no callouts, all references resolve). */
function cleanTree(invOverride: Record<string, unknown> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "check-clean-"));
  write(dir, "inventory.json", JSON.stringify({ ...INVENTORY, ...invOverride }));
  write(dir, "REBUILD.md", "# REBUILD\n");
  write(dir, "00-overview/PRD.md", "# Overview\n");
  write(dir, "architecture/ARCHITECTURE.md", "# Architecture\nLocales: en, fr.\n");
  write(dir, "architecture/INTERFACES.md", "# Interfaces\n- auth.register\n- posts.list\n");
  write(dir, "architecture/DATA-MODEL.md", "# Data model\n### users\n### posts\n");
  write(dir, "features/01-auth/PRD.md", "# Auth\n" + SPINE);
  write(dir, "features/02-posts/PRD.md", "# Posts\n" + SPINE);
  write(dir, "data/translations/messages/en.json", "{}");
  write(dir, "data/translations/messages/fr.json", "{}");
  return dir;
}

describe("checkOutput — structure", () => {
  it("errors when there is no inventory.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "check-empty-"));
    const { errors } = checkOutput(dir);
    expect(errors.join("\n")).toMatch(/inventory\.json|reconstruction/i);
  });

  it("passes a fully-enriched, buildable tree with no errors", () => {
    const { errors } = checkOutput(cleanTree());
    expect(errors).toEqual([]);
  });

  it("errors when a required architecture document is missing", () => {
    const dir = cleanTree();
    // overwrite DATA-MODEL with nothing by writing a tree without it
    const bare = mkdtempSync(join(tmpdir(), "check-bare-"));
    write(bare, "inventory.json", JSON.stringify(INVENTORY));
    write(bare, "REBUILD.md", "# r\n");
    write(bare, "00-overview/PRD.md", "# o\n");
    const { errors } = checkOutput(bare);
    expect(errors.join("\n")).toMatch(/DATA-MODEL\.md|INTERFACES\.md|ARCHITECTURE\.md/);
  });
});

describe("checkOutput — unresolved scaffolding", () => {
  it("flags leftover 🧠 agent callouts", () => {
    const dir = cleanTree();
    write(
      dir,
      "architecture/DATA-MODEL.md",
      "# Data model\n### users\n### posts\n> 🧠 **For the AI agent:** fill the enums.\n",
    );
    const { errors } = checkOutput(dir);
    expect(errors.join("\n")).toMatch(/🧠|unresolved|callout/i);
    expect(errors.join("\n")).toMatch(/DATA-MODEL\.md/);
  });

  it('flags "fill this in" placeholder text', () => {
    const dir = cleanTree();
    write(dir, "features/01-auth/PRD.md", "# Auth\n" + SPINE + "\n(fill this in)\n");
    const { errors } = checkOutput(dir);
    expect(errors.join("\n")).toMatch(/fill this in/i);
  });

  it("does not scan copied ground-truth under data/ or source/", () => {
    const dir = cleanTree();
    write(dir, "source/README.md", "Legacy docs with a 🧠 emoji and 'fill this in' text.\n");
    write(dir, "data/translations/notes.md", "🧠 leftover from the original repo\n");
    const { errors } = checkOutput(dir);
    expect(errors).toEqual([]);
  });

  // Regressions: a *correctly enriched* tree must pass even though the 🧠 marker
  // or the words "fill this in" appear in code spans / quoted examples — i.e. as
  // documentation of the gate, not as unresolved scaffolding.
  it("does not flag the 🧠 inside the rendered Definition-of-done code span", () => {
    const dir = cleanTree();
    write(
      dir,
      "features/01-auth/PRD.md",
      `# Auth\n${SPINE}\n- [ ] \`node scripts/analyze.mjs --check\` passes — no unresolved \`🧠\` callouts or placeholders.\n`,
    );
    const { errors } = checkOutput(dir);
    expect(errors).toEqual([]);
  });

  it('does not flag a quoted "fill this in" example in a docs/buildability PRD', () => {
    const dir = cleanTree();
    write(
      dir,
      "features/02-posts/PRD.md",
      `# Posts\n${SPINE}\n- The gate fails when a placeholder phrase ("fill this in", "TODO", "TBD") remains. (FR1)\n`,
    );
    const { errors } = checkOutput(dir);
    expect(errors).toEqual([]);
  });

  it("does not flag a 🧠 quoted as an example in prose (symmetric with the placeholder check)", () => {
    const dir = cleanTree();
    write(
      dir,
      "features/01-auth/PRD.md",
      `# Auth\n${SPINE}\n- A real callout is always a bare blockquote like "> 🧠 …", never inline. (FR1)\n`,
    );
    const { errors } = checkOutput(dir);
    expect(errors).toEqual([]);
  });

  it("still flags a real `> 🧠` callout and a bare (fill this in) placeholder", () => {
    const dir = cleanTree();
    write(
      dir,
      "features/01-auth/PRD.md",
      `# Auth\n${SPINE}\n> 🧠 **For the AI agent:** describe the flow.\n\n## Notes (fill this in)\n`,
    );
    const { errors } = checkOutput(dir);
    expect(errors.join("\n")).toMatch(/🧠|callout/i);
    expect(errors.join("\n")).toMatch(/fill this in/i);
  });
});

describe("checkOutput — reference integrity", () => {
  it("errors when DATA-MODEL.md omits a referenced entity", () => {
    const dir = cleanTree();
    write(dir, "architecture/DATA-MODEL.md", "# Data model\n### users\n"); // posts missing
    const { errors } = checkOutput(dir);
    expect(errors.join("\n")).toMatch(/posts/);
    expect(errors.join("\n")).toMatch(/DATA-MODEL/);
  });

  it("errors when INTERFACES.md omits a referenced operation", () => {
    const dir = cleanTree();
    write(dir, "architecture/INTERFACES.md", "# Interfaces\n- auth.register\n"); // posts.list missing
    const { errors } = checkOutput(dir);
    expect(errors.join("\n")).toMatch(/posts\.list/);
    expect(errors.join("\n")).toMatch(/INTERFACES/);
  });

  it("errors when a feature PRD drops a required spine section", () => {
    const dir = cleanTree();
    write(dir, "features/01-auth/PRD.md", "# Auth\n## Functional requirements\nx\n"); // no AC / DoD
    const { errors } = checkOutput(dir);
    expect(errors.join("\n")).toMatch(/Acceptance criteria|Definition of done/);
  });
});

// The code path leaves inventory.dataModel/interfaces empty and features without
// entities/interfaces, so the reference-integrity checks are vacuous. These guard
// against a "gutted" tree (callouts deleted, architecture docs emptied) still
// passing — the defect the re-verification reproduced.
const CODE_INVENTORY = {
  generatedWith: "reconstruct@0.5.0",
  repoName: "demo",
  features: [
    { slug: "01-auth", name: "Auth" },
    { slug: "02-posts", name: "Posts" },
  ],
  i18n: null,
};

function cleanCodeTree() {
  const dir = mkdtempSync(join(tmpdir(), "check-code-"));
  write(dir, "inventory.json", JSON.stringify(CODE_INVENTORY));
  write(dir, "REBUILD.md", "# REBUILD\n");
  write(dir, "00-overview/PRD.md", "# Overview\n");
  write(dir, "architecture/ARCHITECTURE.md", "# Architecture\nDescribed.\n");
  write(dir, "architecture/INTERFACES.md", "# Interfaces\n- auth.register\n- posts.list\n");
  write(dir, "architecture/DATA-MODEL.md", "# Data model\n### users\n### posts\n");
  write(dir, "features/01-auth/PRD.md", "# Auth\n" + SPINE);
  write(dir, "features/02-posts/PRD.md", "# Posts\n" + SPINE);
  return dir;
}

describe("checkOutput — contract substance (code-path enforcement)", () => {
  it("passes an enriched code-mode tree (empty inventory, but docs are filled)", () => {
    const { errors } = checkOutput(cleanCodeTree());
    expect(errors).toEqual([]);
  });

  it("fails a tree whose DATA-MODEL.md was gutted to no entities", () => {
    const dir = cleanCodeTree();
    write(dir, "architecture/DATA-MODEL.md", "# Data model\n"); // emptied, no callouts
    const { errors } = checkOutput(dir);
    expect(errors.join("\n")).toMatch(/DATA-MODEL\.md/);
    expect(errors.join("\n")).toMatch(/entit|empty/i);
  });

  it("fails a tree whose INTERFACES.md was gutted to no operations", () => {
    const dir = cleanCodeTree();
    write(dir, "architecture/INTERFACES.md", "# Interface surface\n"); // emptied
    const { errors } = checkOutput(dir);
    expect(errors.join("\n")).toMatch(/INTERFACES\.md/);
    expect(errors.join("\n")).toMatch(/operation|interface|empty/i);
  });

  it("fails a feature PRD that is headings with no content", () => {
    const dir = cleanCodeTree();
    write(
      dir,
      "features/01-auth/PRD.md",
      "# Auth\n## Functional requirements\n## Acceptance criteria\n## Definition of done\n",
    );
    const { errors } = checkOutput(dir);
    expect(errors.join("\n")).toMatch(/content|empty/i);
  });
});

describe("checkOutput — i18n coverage", () => {
  it("warns when a declared locale has no messages file and is not in the catalog", () => {
    const dir = cleanTree({ i18n: { locales: ["en", "zz"], files: [], keyCount: 0 } });
    const { warnings } = checkOutput(dir);
    expect(warnings.join("\n")).toMatch(/zz/);
    expect(warnings.join("\n")).toMatch(/local|translation|message/i);
  });

  it("does not warn when every locale is covered by a translations file", () => {
    const { warnings } = checkOutput(cleanTree());
    expect(warnings.join("\n")).not.toMatch(/locale `en`|locale `fr`/);
  });
});

describe("checkOutput — design-system (conditional, warning-only)", () => {
  // A styling library in the inventory is enough to flag a UI surface.
  const UI_OVERRIDE = { stack: { stylingLibraries: ["Tailwind CSS"] } };

  it("warns — never errors — when UI is detected but DESIGN-SYSTEM.md is missing", () => {
    const dir = cleanTree(UI_OVERRIDE);
    const { errors, warnings } = checkOutput(dir);
    expect(errors).toEqual([]);
    expect(warnings.join("\n")).toMatch(/DESIGN-SYSTEM/);
  });

  it("warns when DESIGN-SYSTEM.md is present but captures no contract", () => {
    const dir = cleanTree(UI_OVERRIDE);
    write(dir, "architecture/DESIGN-SYSTEM.md", "# Design system\n\nNothing captured here.\n");
    const { errors, warnings } = checkOutput(dir);
    expect(errors).toEqual([]);
    expect(warnings.join("\n")).toMatch(/DESIGN-SYSTEM/);
  });

  it("is silent when DESIGN-SYSTEM.md captures a real contract", () => {
    const dir = cleanTree(UI_OVERRIDE);
    write(
      dir,
      "architecture/DESIGN-SYSTEM.md",
      "# Design system\n\n### Design tokens\n\n- `primary-500: #1d4ed8`\n",
    );
    const { errors, warnings } = checkOutput(dir);
    expect(errors).toEqual([]);
    expect(warnings.join("\n")).not.toMatch(/DESIGN-SYSTEM/);
  });

  it("does not demand a design system for a non-UI (backend) tree", () => {
    const { errors, warnings } = checkOutput(cleanCodeTree());
    expect(errors).toEqual([]);
    expect(warnings.join("\n")).not.toMatch(/DESIGN-SYSTEM/);
  });
});
