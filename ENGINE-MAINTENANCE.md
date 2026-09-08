## Shared engine maintenance

`skill.json` declares the runtime engines, minimum versions, import floors and justified adapters. The engine bundles are byte-identical upstream release artifacts, pinned by commit and SHA-256; the skill owns its domain policy and output. Prefer upstream engine primitives for generic work, and report incomplete coverage or unavailable web sources explicitly.

Run `node scripts/sync-engine.mjs --check` and `pnpm verify:engine` to audit the installed pins and source adoption. To update, run `pnpm exec webindex skill repin`, `pnpm install --no-frozen-lockfile`, then `pnpm engine:prepare`. Review the artifact differences, commit the candidate locally and run `pnpm engine:gate` before pushing. A failed recall check requires a semantic review; do not lower floors or replace expectations simply to pass.

The daily workflow uses the same immutable WebIndex release as the development CLI. It validates even when no pin changes, never rebases a tested candidate, and waits for CI and publication. `pnpm exec webindex skill finish` resumes incomplete publication on the current main commit. Runtime bundles remain self-contained; the maintenance package is development-only.
