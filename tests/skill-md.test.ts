import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "yaml";

// Guards that the published SKILL.md stays installable via `npx skills add`.
// The `skills` CLI (vercel-labs/skills) discovers a skill by reading SKILL.md,
// extracting the frontmatter with this exact regex, and `parse()`-ing it with the
// `yaml` package. If that parse throws — or name/description are missing — it
// SILENTLY drops the skill and reports "No skills found". The original break: the
// long `description:` was an unquoted YAML scalar containing `: ` sequences (e.g.
// "Keywords: …"), which `yaml` reads as a nested mapping and rejects.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

describe("SKILL.md is installable by the `skills` CLI", () => {
  const raw = readFileSync(join(ROOT, "SKILL.md"), "utf8");
  const match = raw.match(FRONTMATTER_RE);
  const frontmatter = match?.[1] ?? "";

  it("has a frontmatter block", () => {
    expect(match).not.toBeNull();
    expect(frontmatter.length).toBeGreaterThan(0);
  });

  it("parses as YAML without throwing", () => {
    expect(() => parse(frontmatter)).not.toThrow();
  });

  it("exposes a non-empty string name and description", () => {
    const data = parse(frontmatter) as Record<string, unknown>;
    expect(typeof data.name).toBe("string");
    expect((data.name as string).length).toBeGreaterThan(0);
    expect(typeof data.description).toBe("string");
    expect((data.description as string).length).toBeGreaterThan(0);
  });
});
