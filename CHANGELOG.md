# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0]

Make the output **buildable** — and prove it. Both fronts (reverse-engineer-from-code and
from-scratch) now capture the *contracts* a fresh agent needs to rebuild a unit correctly, not
just a faithful-looking sketch, and a deterministic gate enforces it. This closes the gaps a
multi-agent audit found: contracts named but unspecified (enum members, function signatures,
external-service shapes, rate limits, i18n copy) and internally contradictory plans (an
anonymous write to a table that requires an owner foreign key).

### Added
- **`--check` buildability gate** (`src/check.ts`): validates an already-enriched output tree and
  exits non-zero on unresolved `🧠` callouts / `fill this in` placeholders, a feature that
  references an undocumented entity or operation, a feature PRD missing its spine, or an uncovered
  locale. Mode-agnostic (reads the tree + `inventory.json`). `node scripts/analyze.mjs --check --out <OUT>`.
  Includes **contract-substance gates** so a tree gutted to empty (callouts deleted but no
  entities/operations/feature-content left) still fails — the code-path case that previously passed
  vacuously because the reference checks ran over an empty inventory.
- **Plan consistency validation** (`validatePlanConsistency` in `src/scratch.ts`, wired into
  `--scratch`): the engine now **fails fast** on a dangling `features[]` → entity/interface
  reference, an empty enum, or a field `enumRef` to an undefined enum, and **warns** on a
  public/anonymous write to an entity with a non-null owner foreign key. The scratch path is
  buildable by construction.
- **Extended plan schema** for the contract surface (all optional, backward-compatible): `enums`
  (named member sets), `services` (external-service contracts), `policies` (rate limits & format
  validations), `i18n.messages` (a real catalog — namespaces + keys + source strings),
  `interfaces[].input/output/sideEffects`, `dataModel[].fields[].enumRef`,
  `dataModel[].indexes/uniques`, and `feature.writes`.
- **Richer templates (both modes):** `DATA-MODEL.md` gains an *Enums & domain types* section and
  per-entity indexes/uniques; `ARCHITECTURE.md` gains *External services & integrations*,
  *Cross-cutting policies*, and an i18n *message catalog*; `INTERFACES.md` gains per-operation
  *Operation contracts*; feature PRDs render a **Writes** line and a hardened Definition of Done
  (write satisfiability, enum enumeration, source-string i18n coverage, and a `--check` line).
- `references/buildability-checklist.md`: the nine contract categories (incl. shared/owned UI
  components) + the consistency self-review + the gate. Linked from `SKILL.md` and both playbooks.

### Changed
- `references/analysis-playbook.md` and `references/scratch-playbook.md` gain a *Contracts &
  buildability* section and a *consistency self-review & `--check`* discipline; the scratch
  decision-tree now walks enums, services, policies, the message catalog, and per-feature writes.
- `references/scratch-plan-schema.md` documents every new field + the enforced consistency rules.
- `scripts/parity-medic.mjs` now asserts buildability-by-construction (the plan generates with no
  consistency errors/warnings), scaffold richness (real entities incl. `contactRequests`, enums,
  services, policies, message catalog), and locale parity — not just structural alignment.
- The medic plan fixture (`tests/fixtures/scratch-plan/medic.plan.json`) was realigned to mirror
  the real repo (correct `notifications`/`profileViewsLog` shapes, the anonymous `contactRequests`
  table, NextAuth adapter tables, enums, services, policies, message catalog) so the from-code and
  from-scratch paths converge.

## [0.4.0]

Add a **from-scratch (greenfield)** mode: turn an idea into the same reconstruction tree via a
grill-with-docs interview instead of reading a repo — both front-ends converge on one inventory
and one renderer. Plus an orthogonal **`--tdd`** mode for a test-first build plan.

### Added
- `--scratch --plan <plan.json>`: build the reconstruction tree from an interview-produced
  `plan.json` rather than a repository. Mode collapses to `scratch` and fidelity to `describe`;
  `--repo` is not required. `--level` still applies (`complex` = deeper interview + alternatives
  + more ADRs).
- `--tdd`: emit test-first build guidance into every feature PRD and `REBUILD.md` (write failing
  tests → implement → refactor); a `TDD` row in the meta block. Works in any mode.
- Scratch mode also writes the interview's domain docs into `<out>`: `CONTEXT.md` (glossary, from
  `plan.glossary` + data-model relations) and `docs/adr/NNNN-*.md` (one terse ADR per decision),
  both **written if-absent** so agent-authored versions are never clobbered. `00-overview` links
  to them.
- `architecture/INTERFACES.md` and `architecture/DATA-MODEL.md` render **pre-filled** tables from
  the plan in scratch mode (markdown-pipe-safe) instead of empty skeletons.
- **Full-PRD feature templates (both modes).** Every `features/<slug>/PRD.md` now ships a complete
  PRD spine — *Context & goal · User stories · Functional requirements · Interfaces & data ·
  Acceptance criteria (Given/When/Then) · Edge cases & failure modes · Definition of done* — with
  demanding agent-notes that push for exhaustive enumeration ("no etc."). Scratch features carry
  their `interfaces`/`entities` cross-refs through `Feature`. `SKILL.md` gains an "Everything is a
  PRD — dig until done" section and a granularity push (prefer many focused PRDs).
- `src/scratch.ts` (`loadPlan`, `planToInventory`, `renderScratchDocs`); `orderFeatures` extracted
  from `src/features.ts` so both front-ends share the dependency-tier build order;
  `writeArtifactsIfAbsent` in `src/output.ts`.
- `references/scratch-playbook.md` (greenfield interview methodology), `references/scratch-plan-schema.md`
  (the `plan.json` contract + worked example), and vendored `references/CONTEXT-FORMAT.md` /
  `references/ADR-FORMAT.md` so the skill stays self-contained.
- Medic convergence harness: `scripts/parity-medic.mjs` + `npm run parity:medic` structurally
  diffs the code path and the from-scratch path; `tests/fixtures/scratch-plan/medic.plan.json`;
  `tests/scratch.test.ts`.

## [0.3.0]

Add opt-in **bundling**: collapse the whole reconstruction into one file, or emit a
one-page digest — both available inline during a run or as a standalone post-step.

### Added
- `--merge` writes `RECONSTRUCTION.md`: the entire tree (overview → architecture →
  every feature → build order) in a single coherent markdown — one H1 title, a linked
  table of contents, and each document's headings demoted one level (fence-aware).
- `--summary` writes `SUMMARY.md`: a one-page digest derived from the inventory
  (stack, libraries, size, features in build order, interface/data counts, locales,
  unknowns, next steps).
- **Standalone post-step:** using `--merge` / `--summary` *without* `--repo` rebuilds
  the bundle(s) from an existing output dir (reads `inventory.json` + the `.md` tree),
  e.g. `reconstruct --merge --summary --out <reconstruction-dir>`. Idempotent.
- `inventory.json` now records a `generation` block (`mode/level/fidelity/granularity`)
  for provenance, so the standalone step renders an accurate meta line.
- `src/prd/bundle.ts` (`demoteHeadings`, `mergeArtifacts`, `summarize`) and
  `src/postprocess.ts` (`bundleExisting`), with `tests/bundle.test.ts`,
  `tests/postprocess.test.ts`, and `tests/cli.test.ts`.

## [0.2.0]

Re-architected into a **stack-agnostic scaffold + an AI-first markdown playbook**. The
deterministic engine now produces universal facts and *candidate hints*; the markdown
teaches the agent to map any stack.

### Added
- `architecture/INTERFACES.md` and `architecture/DATA-MODEL.md` skeletons in every run, so
  the full interface surface (routes, endpoints, RPC/GraphQL, CLI, jobs) and the data model
  are first-class deliverables.
- `inventory.json` now carries `hints` (route/API/schema candidates + entry points),
  `unknowns` (explicit pointers for the agent), `workspaces` (monorepo), `runtime.node`, and
  `excludedCount`.
- `src/detect/candidates.ts`: framework-agnostic candidate detection (tRPC, GraphQL, gRPC,
  OpenAPI, Drizzle/Prisma/TypeORM/Mongoose/Django/Rails, cross-ecosystem entry points).
- `references/analysis-playbook.md` (universal methodology) and `references/stack-guides/*`
  (15 per-stack cheat-sheets, loaded on demand).
- CLI flags: `--granularity coarse|fine`, `--include`/`--exclude` globs; the summary now
  reports candidate, monorepo, excluded-file, and unknowns counts.
- Extended stack catalogue: Vite, SolidStart, Expo, React Native, Electron, Tauri,
  Laravel/Symfony, Spring Boot (Maven/Gradle); monorepo + Node-version detection.
- Multi-stack test fixtures (`i18n-app`, `trpc-app`, `flask-api`, `monorepo`) and suites.

### Changed
- `REBUILD.md` build order is now **dependency-tiered** (foundations → feature pages →
  tests/docs) instead of sorted by file count.
- `SKILL.md` rewritten to a stack-agnostic procedure; PRD references point at
  `INTERFACES.md`/`DATA-MODEL.md`.
- Env-var extraction also recognizes `os.environ.get("X")` / `os.getenv("X")` (Python).

### Removed
- `src/adapters/js-ts.ts` (dead code; generalized into `src/detect/candidates.ts`).
- The silent 2000-file cap in env-var extraction.

## [0.1.0]

Initial release: deterministic analyzer + agent-enriched reconstruction PRDs, tuned for
JS/TS/Next.js with generic extraction for other stacks.

[Unreleased]: https://github.com/maxgfr/reconstruct/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/maxgfr/reconstruct/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/maxgfr/reconstruct/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/maxgfr/reconstruct/releases/tag/v0.2.0
[0.1.0]: https://github.com/maxgfr/reconstruct/releases/tag/v0.1.0
