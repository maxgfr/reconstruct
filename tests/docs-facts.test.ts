import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PROMPTS } from "../src/mcp/prompts.js";
import { TOOLS, WRITE_TOOLS } from "../src/mcp/tools.js";

// Doc-drift gate: the facts the docs state about the code are checked against
// the code itself, so a renamed tool, a new flag or a new reference file cannot
// leave README / DOCUMENTATION / SKILL.md quietly wrong. (The README once said
// "42 references" while 44 shipped.)

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const README = read("README.md");
const DOCUMENTATION = read("DOCUMENTATION.md");
const SKILL = read("skills/reconstruct/SKILL.md");
const REF_DIR = join(ROOT, "skills/reconstruct/references");

function mdFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? mdFiles(join(dir, e.name)) : e.name.endsWith(".md") ? [join(dir, e.name)] : [],
  );
}
const REFERENCES = mdFiles(REF_DIR);
const DECLARED_TOOLS = [...TOOLS, ...WRITE_TOOLS].map((t) => t.name);

describe("MCP surface ↔ docs", () => {
  it("the README tool table lists every declared tool", () => {
    for (const name of DECLARED_TOOLS) expect(README, name).toMatch(new RegExp(`\`${name}\``));
  });

  it("the README prompt table lists every declared prompt", () => {
    for (const p of PROMPTS) expect(README, p.name).toMatch(new RegExp(`\\| \`${p.name}\` \\|`));
  });

  it("no doc names a tool that does not exist", () => {
    const docs = { "README.md": README, "DOCUMENTATION.md": DOCUMENTATION, "SKILL.md": SKILL };
    for (const f of REFERENCES) Object.assign(docs, { [relative(ROOT, f)]: readFileSync(f, "utf8") });
    const declared = new Set(DECLARED_TOOLS);
    for (const [file, text] of Object.entries(docs)) {
      const unknown = [...text.matchAll(/\breconstruct_[a-z_]+\b/g)].map((m) => m[0]).filter((n) => !declared.has(n));
      expect(unknown, file).toEqual([]);
    }
  });
});

describe("CLI flags ↔ docs", () => {
  const help = read("src/cli.ts").match(/const HELP = `([\s\S]*?)`;/)?.[1] ?? "";
  const flags = [...new Set([...help.matchAll(/^\s{2}(--[a-z][a-z-]*)/gm)].map((m) => m[1] as string))];

  it("finds the flags in --help", () => {
    expect(flags.length).toBeGreaterThan(20);
  });

  it("DOCUMENTATION.md documents every --help flag", () => {
    const undocumented = flags.filter((f) => !DOCUMENTATION.includes(`\`${f}`));
    expect(undocumented).toEqual([]);
  });
});

describe("references ↔ docs", () => {
  it("the README states the real number of reference files", () => {
    const stated = README.match(/all (\d+) `references\/\*\.md`/)?.[1];
    expect(Number(stated)).toBe(REFERENCES.length);
    const guides = README.match(/the (\d+) per-stack cheat-sheets/)?.[1];
    expect(Number(guides)).toBe(mdFiles(join(REF_DIR, "stack-guides")).length);
  });

  it("every top-level reference is reachable from SKILL.md", () => {
    const topLevel = readdirSync(REF_DIR).filter((n) => n.endsWith(".md"));
    // Reachable = linked from SKILL.md, or from a reference SKILL.md links to.
    const linked = new Set([...SKILL.matchAll(/references\/([\w.-]+\.md)/g)].map((m) => m[1]));
    for (const name of [...linked]) {
      try {
        for (const m of readFileSync(join(REF_DIR, name as string), "utf8").matchAll(/\(\.?\/?([\w.-]+\.md)\)/g)) linked.add(m[1]);
      } catch {
        /* a dangling SKILL.md link fails the assertion below */
      }
    }
    const orphans = topLevel.filter((n) => !linked.has(n));
    expect(orphans).toEqual([]);
  });
});
