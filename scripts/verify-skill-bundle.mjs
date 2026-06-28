#!/usr/bin/env node
// Install-bundle gate: prove the repo is shaped so that `npx skills add
// maxgfr/reconstruct` installs a WORKING skill — engine + references included,
// not just a lone SKILL.md.
//
// The `skills` CLI (skills.sh) early-returns the moment it sees a SKILL.md at
// the repository ROOT and then installs that file ALONE — the sibling
// scripts/ and references/ are dropped. A skill is only bundled whole when its
// SKILL.md lives in a SUBDIRECTORY (skills/<name>/). This script asserts that
// shape and that the embedded engine(s) are byte-identical to the tested bundle.
//
// Run by CI and by `pnpm run verify:bundle`. Pure Node, no deps, no network.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_SCRIPTS } from "./copy-bundle.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const name = pkg.name;
const skillDir = join(root, "skills", name);
const errors = [];
const ok = (m) => console.log(`  ok   ${m}`);
const warn = (m) => console.log(`  warn ${m}`);
const bad = (m) => {
  errors.push(m);
  console.log(`  FAIL ${m}`);
};

// 1. No SKILL.md at the repo root (would make `skills add` install it alone).
existsSync(join(root, "SKILL.md"))
  ? bad("a SKILL.md exists at the repo ROOT — `skills add` would install it alone, dropping the engine. Move it to skills/" + name + "/SKILL.md")
  : ok("no root SKILL.md");

// 2. The packaged SKILL.md exists with valid, installable frontmatter.
const skillMd = join(skillDir, "SKILL.md");
let raw = "";
if (!existsSync(skillMd)) {
  bad(`missing ${skillMd} — the skill package has no SKILL.md`);
} else {
  raw = readFileSync(skillMd, "utf8");
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!fm) bad("skills/" + name + "/SKILL.md has no frontmatter block");
  else {
    ok("packaged SKILL.md present with frontmatter");
    const nameLine = fm[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
    nameLine === name ? ok(`frontmatter name "${name}" matches package`) : bad(`frontmatter name "${nameLine}" != package name "${name}"`);
    const desc = fm[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
    if (!desc) bad("frontmatter has no description");
    else {
      const len = desc.replace(/^["']|["']$/g, "").length;
      len <= 1024 ? ok(`description ${len} chars (<= 1024 matcher limit)`) : bad(`description ${len} chars exceeds the 1024-char matcher limit`);
    }
  }

  // 3. Every references path SKILL.md links exists, and every shipped playbook
  // is reachable. reconstruct's reference names are mixed-case (ADR-FORMAT.md,
  // CONTEXT-FORMAT.md) and nested (stack-guides/<stack>.md), so the path charset
  // is broad and we match directory links too: SKILL.md points the agent at the
  // whole `references/stack-guides/` folder rather than each guide, so a folder
  // link counts as covering its children. A genuinely unreachable playbook is a
  // soft warning, not a failure — adapters.md, for instance, is reached from the
  // README/DOCUMENTATION and read contextually rather than path-linked from
  // SKILL.md, and must still ship.
  const refsDir = join(skillDir, "references");
  if (existsSync(refsDir)) {
    const REF_RE = /references\/[A-Za-z0-9_./-]+/g;
    const linked = new Set(raw.match(REF_RE) ?? []);
    const reachable = (rel) => {
      if (linked.has(rel)) return true;
      for (const l of linked) if (l.endsWith("/") && rel.startsWith(l)) return true;
      return false;
    };

    const mdFiles = [];
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".md")) mdFiles.push(p);
      }
    };
    walk(refsDir);

    for (const ref of [...linked].filter((l) => l.endsWith(".md"))) existsSync(join(skillDir, ref)) ? ok(`linked ${ref} exists`) : bad(`${ref} is linked from SKILL.md but missing from the package`);

    for (const f of mdFiles) {
      const rel = "references/" + f.slice(refsDir.length + 1).split("\\").join("/");
      reachable(rel) ? null : warn(`${rel} ships but SKILL.md never links it (reached via README/DOCUMENTATION)`);
    }
    ok(`references/ present (${mdFiles.length} playbooks)`);
  }
}

// 4. Every bundled engine is byte-identical to the committed root bundle.
for (const script of ENGINE_SCRIPTS) {
  const engine = `scripts/${script}`;
  const rootEngine = join(root, engine);
  const pkgEngine = join(skillDir, engine);
  if (!existsSync(rootEngine)) bad(`missing ${engine} at repo root — run \`pnpm run build\``);
  else if (!existsSync(pkgEngine)) bad(`missing skills/${name}/${engine} — run \`node scripts/copy-bundle.mjs\``);
  else readFileSync(rootEngine).equals(readFileSync(pkgEngine))
    ? ok(`embedded engine skills/${name}/${engine} is byte-identical to ${engine}`)
    : bad(`skills/${name}/${engine} differs from ${engine} — run \`node scripts/copy-bundle.mjs\` and commit`);
}

if (errors.length) {
  console.error(`\nverify-skill-bundle: ${errors.length} problem(s) — the published skill would not install correctly.`);
  process.exit(1);
}
console.log(`\nverify-skill-bundle: ok — skills/${name}/ installs as a complete skill.`);
