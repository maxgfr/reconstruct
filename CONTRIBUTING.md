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

## Add support for a new stack — write markdown, not code

The high-leverage way to extend `reconstruct` is a **stack guide**, not an adapter:

1. Add `references/stack-guides/<stack>.md`. Follow the existing 5-section shape:
   `## Where the interface surface lives`, `## Data model`, `## Entry points & boot`,
   `## Config & env`, `## Gotchas`, plus a closing `> tip:`. Keep it a dense ~25–45-line
   cheat-sheet with concrete file paths and real function/decorator names.
2. If a cheap, framework-agnostic heuristic would help the agent find the right files, add
   it to `src/detect/candidates.ts` (a *candidate*, never asserted truth) and cover it with
   a test. Run `npm run build` to refresh the committed bundle.

That's it — most stacks need only the markdown.

## Engine changes

If you do change `src/`:

- **Tests first (TDD).** Add a failing test under `tests/`, watch it fail, then implement.
- Keep heuristics generic. Surface uncertainty in `inventory.unknowns` rather than guessing.
- **No silent caps.** If you bound coverage, make it visible.
- Run the full gate and refresh the bundle:

  ```bash
  npm run typecheck
  npm test
  npm run build        # refresh scripts/analyze.mjs (committed, zero-dep)
  npm run check:build  # asserts the committed bundle matches src/
  ```

  CI runs all of the above on Node 24, plus a smoke run of the committed bundle.

## Pull requests

- One focused change per PR; keep the committed `scripts/analyze.mjs` in sync with `src/`.
- Update `CHANGELOG.md` (Unreleased section) and any affected docs.
- Be kind and concise in descriptions — say what changed and why.

By contributing you agree your work is licensed under the project's [MIT license](./LICENSE).
