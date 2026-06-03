#!/usr/bin/env node
// Sync the release version across the three places it lives, then let the
// caller rebuild the bundle. Invoked by
// @semantic-release/exec (prepareCmd):  node scripts/sync-version.mjs <version>
//
// The version is duplicated in package.json, src/types.ts (the value the bundle
// embeds), and SKILL.md frontmatter; semantic-release computes it from the
// Conventional Commits, so this keeps all three in lockstep. CHANGELOG.md is
// owned by @semantic-release/changelog, which writes the generated release
// notes before @semantic-release/git commits the bump — so it is NOT touched here.
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version)) {
  console.error(`sync-version: expected a semver version, got "${version ?? ""}"`);
  process.exit(1);
}

function edit(path, transform) {
  const before = readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) {
    console.error(`sync-version: WARNING — no change applied to ${path}`);
  }
  writeFileSync(path, after);
}

// package.json — the top-level "version" field.
edit("package.json", (s) => s.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`));

// src/types.ts — the VERSION constant the analyzer/bundle reports.
edit("src/types.ts", (s) => s.replace(/(export const VERSION = ")[^"]+(";)/, `$1${version}$2`));

// SKILL.md — the indented `version:` under the frontmatter `metadata:` block.
edit("SKILL.md", (s) => s.replace(/(\n[ \t]+version:[ \t]*)[^\n]+/, `$1${version}`));

console.log(`sync-version: set ${version} in package.json, src/types.ts, SKILL.md`);
