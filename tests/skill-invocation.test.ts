import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Check the shipped configuration, not a fixture or the user's installed copy.
const skillDir = new URL("../skills/reconstruct/", import.meta.url);
const skill = readFileSync(new URL("SKILL.md", skillDir), "utf8");
const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skill)?.[1] ?? "";

describe("explicit-only skill invocation", () => {
  it("disables model invocation in Claude Code", () => {
    expect(frontmatter).toMatch(/^disable-model-invocation:\s*true\s*$/m);
  });

  it("keeps the named skill available to users", () => {
    expect(frontmatter).toMatch(/^name:\s*reconstruct\s*$/m);
    expect(frontmatter).not.toMatch(/^user-invocable:\s*(?:false|no|off|0)\s*$/im);
  });

  it("disables implicit invocation in Codex without disabling the skill", () => {
    const config = readFileSync(new URL("agents/openai.yaml", skillDir), "utf8");
    // This is a host policy boolean, not a prose instruction to the model.
    expect(config).toMatch(/^policy:\s*\n(?:[ \t]+[^\n]*\n)*?[ \t]+allow_implicit_invocation:\s*false\s*$/m);
  });
});
