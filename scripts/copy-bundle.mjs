#!/usr/bin/env node
// Mirror the source-of-truth engine bundle(s) (built by tsup into scripts/)
// byte-for-byte into the skill package. The skill ships standalone — `npx
// skills add` copies the skill directory (skills/reconstruct/), so the engine
// has to live next to its SKILL.md, not just at the repo root. A plain copy
// (no transform) keeps the two files identical, which is what `check:build`
// asserts so the published skill can never drift from the tested bundle.
//
// ENGINE_SCRIPTS is the single source of truth for *which* scripts the
// installed skill needs; verify-skill-bundle.mjs imports the same list so the
// copy and the verification can never disagree. These are the engine scripts
// reconstruct's SKILL.md actually invokes (scripts/analyze.mjs) — NOT the build
// helpers (copy-bundle/sync-version/verify-skill-bundle) or the dev-only
// parity.mjs, which never ship inside the skill.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ENGINE_SCRIPTS = ["analyze.mjs"];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function copyBundle() {
  for (const script of ENGINE_SCRIPTS) {
    const source = join(root, "scripts", script);
    const target = join(root, "skills", "reconstruct", "scripts", script);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
    console.log(`copy-bundle: ${source} -> ${target}`);
  }
}

// Only copy when run directly (`node scripts/copy-bundle.mjs`); when imported
// for ENGINE_SCRIPTS (by verify-skill-bundle.mjs) this is a no-op.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  copyBundle();
}
