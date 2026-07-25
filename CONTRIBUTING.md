# Contributing to reconstruct

Thanks for helping improve `reconstruct`! This guide covers the architecture, the
workflow, and — most importantly — how to add support for a new stack.

## Architecture in one minute

`reconstruct` is a **thin deterministic scaffold + a thick AI playbook**:

- **The engine** (`src/`, bundled to `scripts/analyze.mjs`) extracts only universal facts
  and framework-agnostic *candidate hints* — file tree, dependencies, env vars, i18n,
  stack/library detection, and candidates for routes / API / schema / entry points. It
  never tries to be deeply framework-specific.
- **The markdown** (`SKILL.md` + `references/`) is the program the AI agent follows to turn
  those facts and hints into a real reconstruction: the interface surface, the data model,
  and semantic features — for any stack.

> The engine guarantees correct facts; the agent supplies framework-aware understanding.
> A per-framework adapter does not scale; a markdown playbook that teaches the agent where
> to look does.

## Prerequisites

The **dev toolchain** (vitest 4 / vite 8) needs **Node ≥ 20.19** and pnpm (pinned via
`packageManager`). The **shipped bundle** (`scripts/analyze.mjs`) is dependency-free and runs
on **Node ≥ 18** — that floor is the `engines.node` promise, and CI guards it with a dedicated
zero-install job that runs the committed bundle on Node 18. Keep `src/` within Node-18 APIs.

## Add support for a new stack — write markdown, not code

The high-leverage way to extend `reconstruct` is a **stack guide**, not an adapter:

1. Add `references/stack-guides/<stack>.md`. Follow the existing 5-section shape:
   `## Where the interface surface lives`, `## Data model`, `## Entry points & boot`,
   `## Config & env`, `## Gotchas`, plus a closing `> tip:`. Keep it a dense ~25–45-line
   cheat-sheet with concrete file paths and real function/decorator names.
2. **Add a row to `references/stack-guides/INDEX.md` in the same commit.** The agent routes
   through the index — the labels the engine emits and the guide filenames are deliberately
   not one-to-one — so an unindexed guide is unreachable no matter how good it is.
3. If a cheap, framework-agnostic heuristic would help the agent find the right files, add
   it to `src/detect/candidates.ts` (a *candidate*, never asserted truth) and cover it with
   a test. Run `pnpm run build` to refresh the committed bundle.

That's it — most stacks need only the markdown.

## Engine changes

If you do change `src/`:

- **Tests first (TDD).** Add a failing test under `tests/`, watch it fail, then implement.
- Keep heuristics generic. Surface uncertainty in `inventory.unknowns` rather than guessing.
- **No silent caps.** If you bound coverage, make it visible.
- Run the full gate and refresh the bundle:

  ```bash
  pnpm run typecheck
  pnpm test
  pnpm run build        # refresh scripts/analyze.mjs (committed, zero-dep)
  pnpm run check:build  # asserts the committed bundle matches src/
  ```

  CI runs all of the above on Node 24, plus a smoke run of the committed bundle, and a
  separate Node-18 job that runs the bundle on the `engines` floor (no install).

## Pull requests

- One focused change per PR; keep the committed `scripts/analyze.mjs` in sync with `src/`.
- Update `CHANGELOG.md` (Unreleased section) and any affected docs.
- Be kind and concise in descriptions — say what changed and why.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org) — `feat:`, `fix:`,
`perf:`, `refactor:`, `docs:`, `test:`, `ci:`, `build:`, `chore:`, optionally scoped
(`feat(scratch): …`). **The release is driven entirely by these**, so the type matters:
`fix:` → patch, `feat:` → minor, and a `!` or a `BREAKING CHANGE:` footer → major. The
release notes users read on GitHub are generated from the subject lines too.

## Releasing

Releases are **fully automated in CI** via [semantic-release](https://semantic-release.gitbook.io).
Just merge Conventional Commits to `main`: the [`Release`](.github/workflows/release.yml)
workflow runs the gate, computes the next version from the commits, syncs it across
`package.json` / `src/types.ts` / `SKILL.md` / `CHANGELOG.md` and rebuilds the bundle
(`scripts/sync-version.mjs`), commits the bump back as `chore(release): <v> [skip ci]`, then
tags `v<version>` and creates the GitHub release with auto notes + an `npm pack` tarball.

- **No manual version bump or tag** — never edit the `version` fields or push a `v*` tag by
  hand; semantic-release owns them.
- **GitHub-only** — nothing is published to the npm registry (no `NPM_TOKEN` needed); it uses
  the built-in `GITHUB_TOKEN`. To also publish to npm, add `@semantic-release/npm` to
  `.releaserc.json` and an `NPM_TOKEN` secret.
- **CHANGELOG** — add your human-readable entry under `## [Unreleased]`; on release the script
  promotes it to the new `## [X.Y.Z]` heading and reopens an empty `[Unreleased]`.
- A no-release commit set (only `docs:`/`chore:`/`test:`) ships nothing — that's expected.

Run the same gate locally before pushing:

```bash
pnpm run typecheck && pnpm test && pnpm run check:build   # same gate CI runs
```

By contributing you agree your work is licensed under the project's [MIT license](./LICENSE).
