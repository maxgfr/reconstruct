import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Check the shipped configuration, not a fixture or the user's installed copy.
const skillDir = new URL("../skills/reconstruct/", import.meta.url);
const skill = readFileSync(new URL("SKILL.md", skillDir), "utf8");
const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skill)?.[1] ?? "";

describe("model-invocable skill", () => {
  it("lets Claude Code load the skill on its own", () => {
    expect(frontmatter).not.toMatch(/^disable-model-invocation:\s*true\s*$/m);
    expect(frontmatter).toMatch(/^description:\s*\S/m);
  });

  it("restricts the description to explicit requests", () => {
    expect(frontmatter).toMatch(/^description:.*\bUse only when the user explicitly asks for reconstruct\b/m);
  });

  it("keeps the named skill available to users", () => {
    expect(frontmatter).toMatch(/^name:\s*reconstruct\s*$/m);
    expect(frontmatter).not.toMatch(/^user-invocable:\s*(?:false|no|off|0)\s*$/im);
  });
});
