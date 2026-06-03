# Spec — `--merge` & `--summary` flags

Status: approved 2026-06-02

## Goal

Add two opt-in outputs to `reconstruct`:

- **`--merge`** → one coherent markdown file (`RECONSTRUCTION.md`) bundling the
  whole reconstruction tree (overview → architecture → every feature → build
  order) with a generated title, a table of contents, and headings demoted one
  level so it reads as a single document.
- **`--summary`** → a one-page digest (`SUMMARY.md`) derived deterministically
  from the inventory (stack, libraries, size, features in build order,
  interface/data-model counts, locales, unknowns, next steps).

Both flags are off by default, combinable, and must work in two modes.

## Execution models

1. **Inline** — a normal `--repo` run with `--merge` / `--summary` appends the
   requested file(s) to the generated tree, built from the in-memory artifacts +
   fresh inventory.
2. **Standalone (post-step)** — `--merge` / `--summary` **without `--repo`** runs
   against an already-generated reconstruction directory (`--out`, default cwd).
   It reads `inventory.json` + every `.md` from disk and writes the requested
   file(s) back into that directory. No repo re-analysis.
   - Example: `reconstruct --merge --summary --out ./reconstruction`

## Flag matrix (must all be handled)

| Invocation | Behaviour |
| --- | --- |
| `--repo R` (no merge/summary) | Unchanged — backward compatible. |
| `--repo R --merge` | Normal tree + `RECONSTRUCTION.md`. |
| `--repo R --summary` | Normal tree + `SUMMARY.md`. |
| `--repo R --merge --summary` | Normal tree + both. |
| `--merge` / `--summary` (no `--repo`) | Standalone on `--out`/cwd. |
| `--json` (+ anything) | Prints inventory JSON, writes nothing. `--json` wins; merge/summary ignored; never standalone. |
| standalone, no `inventory.json` in dir | Friendly error, exit 1. |
| standalone + generation flags | Generation flags are irrelevant; noted on stderr, not fatal. |

Provenance: `inventory.json` gains a `generation` block (`mode/level/fidelity/granularity`)
so standalone can render an accurate meta line without re-analysing.

## Modules

- `src/prd/bundle.ts` (pure, no fs):
  - `demoteHeadings(md, by = 1)` — fence-aware (``` and `~~~`, indented), only
    ATX headings outside code fences, capped at h6.
  - `mergeArtifacts(artifacts, inv, opts)` — single H1 + meta + TOC (anchors),
    then sections in narrative order: `00-overview` → `architecture/*`
    (ARCHITECTURE, INTERFACES, DATA-MODEL, diagram) → features in inventory
    order → `REBUILD.md` last. Excludes `SUMMARY.md`, `RECONSTRUCTION.md`,
    `inventory.json`. Unknown `.md` appended sorted.
  - `summarize(inv, opts)` — the one-page digest.
- `src/postprocess.ts` (fs): `bundleExisting(opts)` reads `inventory.json` + the
  `.md` tree from `opts.out`, returns a `RenderResult` of the requested
  artifacts. Reuses the pure functions.
- `src/prd/render.ts` — after existing artifacts, push `SUMMARY.md` /
  `RECONSTRUCTION.md` when the flags are set.
- `src/cli.ts` — parse `--merge` / `--summary`; compute `standalone`; route
  `main()`; update HELP + stderr recap.
- `src/types.ts` — `Options` gains `merge`, `summary`, `standalone` (booleans);
  `Inventory` gains `generation`.

## Tests (TDD, must all be green)

- `tests/bundle.test.ts` — demoteHeadings (outside vs inside fences, `~~~`,
  no-space `#tag` left alone, cap at h6); mergeArtifacts (one H1, TOC entries,
  exclusions, feature order, REBUILD last, sub-doc H1 demoted); summarize (repo
  name, stack, build-order list with slugs, locales, unknowns, counts).
- `tests/cli.test.ts` — parseArgs sets merge/summary; standalone detection;
  `--json` precedence; combinations.
- `tests/postprocess.test.ts` — generate a tree, run standalone, assert files +
  sane content; missing `inventory.json` → throws.
- Existing suites stay green; `inventory.generation` added without breaking
  shape assertions.

## Build & docs

- Rebuild `scripts/analyze.mjs` (`tsup`); keep `check:build` green.
- Bump version `0.2.0 → 0.3.0` (types.ts `VERSION` + package.json).
- Document flags in SKILL.md, README, CHANGELOG.

## Out of scope (YAGNI)

- Merge does not inline `SUMMARY.md` (overview already summarises).
- No HTML/PDF export; markdown only.
- No new third-party dependencies (engine stays dependency-free).
