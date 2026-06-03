# Changelog

All notable changes to this project are documented here, generated automatically from the [Conventional Commits](https://www.conventionalcommits.org/) by [semantic-release](https://github.com/semantic-release/semantic-release).

## [0.10.2](https://github.com/maxgfr/reconstruct/compare/v0.10.1...v0.10.2) (2026-06-03)


### Bug Fixes

* **cli:** reject unknown flags and stray arguments instead of swallowing them ([9f57555](https://github.com/maxgfr/reconstruct/commit/9f575553ef4071520aa5ca6c7a38e7888b6120ec))

## [0.10.1](https://github.com/maxgfr/reconstruct/compare/v0.10.0...v0.10.1) (2026-06-03)


### Bug Fixes

* **deps:** bump vitest to v4 to clear critical + moderate advisories ([3136485](https://github.com/maxgfr/reconstruct/commit/3136485db52a1107f23ec115e4606c556e6f5eb8))

# [0.10.0](https://github.com/maxgfr/reconstruct/compare/v0.9.0...v0.10.0) (2026-06-03)


### Features

* **cli:** make --specs the whole code-free spec (architecture + features) ([0d54097](https://github.com/maxgfr/reconstruct/commit/0d54097a8598784e24fa5af9fd1997dc77d6f895))

# [0.9.0](https://github.com/maxgfr/reconstruct/compare/v0.8.1...v0.9.0) (2026-06-03)


### Features

* **cli:** add --specs bundle (SPECS.md — feature PRDs without the code) ([149ab65](https://github.com/maxgfr/reconstruct/commit/149ab6514f7d5edc9e183b507512ed2400788ee6))

## [0.8.1](https://github.com/maxgfr/reconstruct/compare/v0.8.0...v0.8.1) (2026-06-03)


### Bug Fixes

* **skill:** quote SKILL.md description so `skills add` can parse the frontmatter ([6e87f2f](https://github.com/maxgfr/reconstruct/commit/6e87f2f270cffdac3f430f3c7c749b2286e73532))

# [0.8.0](https://github.com/maxgfr/reconstruct/compare/v0.7.3...v0.8.0) (2026-06-03)


### Features

* **cli:** add --features bundle (FEATURES.md — feature PRDs only) ([37ae347](https://github.com/maxgfr/reconstruct/commit/37ae3478e8e44993a49b2a11c29e544dc9ff8fca))

## [0.7.3](https://github.com/maxgfr/reconstruct/compare/v0.7.2...v0.7.3) (2026-06-03)


### Bug Fixes

* **cli:** run main() when invoked through a symlinked path ([eac4a44](https://github.com/maxgfr/reconstruct/commit/eac4a44bc90cbdf7b95894c7aae3079c565cb8cd))

## [0.7.2](https://github.com/maxgfr/reconstruct/compare/v0.7.1...v0.7.2) (2026-06-03)


### Bug Fixes

* **release:** write generated notes to CHANGELOG.md via @semantic-release/changelog ([c3f62dc](https://github.com/maxgfr/reconstruct/commit/c3f62dc5bc7a7114996e6c0a4b4d9b311ee5b77e))

## [0.7.1](https://github.com/maxgfr/reconstruct/compare/v0.7.0...v0.7.1) (2026-06-03)

### Bug Fixes

* **readme:** reflect v0.7.0 — deterministic route adapters + HTTP method ([2f30073](https://github.com/maxgfr/reconstruct/commit/2f300737e609181ff33b355956804038a4c4986c))

## [0.7.0] - 2026-06-03

### Added
- **Pluggable route-adapter registry** (`src/adapters/registry.ts` + `src/adapters/types.ts`):
  adapters now implement a `RouteAdapter` contract and register in one array, so adding a
  framework is a small, self-contained PR (one file under `src/adapters/` + one registry line +
  a fixture/test) with no core change. The registry runs every adapter whose framework is active
  and merges + de-dupes + sorts the routes — a repo can activate several at once. Guide:
  [`references/adapters.md`](./references/adapters.md).
- **New deterministic route adapters** beyond Next.js: **Flask** (`@app.route`/method shortcuts +
  `Blueprint` `url_prefix` resolved across modules), **FastAPI** (`include_router(prefix)` +
  `APIRouter(prefix)` + decorator path), **NestJS** (`@Controller(base)` + method decorators),
  and **Express** (`app.<method>` + `router.<method>` prefixed by the cross-file `app.use` mount).
  Each ships a fixture + tests. These upgrade their framework's interface surface from *candidate
  hints* to *resolved routes*.
- **Generic convergence harness** `scripts/parity.mjs` + `pnpm run parity`, replacing the earlier
  product-specific harness. It derives ALL its
  expectations from the plan itself (every declared entity, enum, interface, service, policy
  and locale must be pre-filled into the matching architecture doc), so it proves
  buildability-by-construction for **any** `plan.json`, not just one product. `--plan` is required;
  `--repo` is optional and adds the code-path↔scratch-path structural-convergence check. CI now
  runs `pnpm run parity` against the committed example fixture (no external repo needed).
- **HTTP method on the interface surface**: `RouteInfo` now carries the verb (`GET`/`POST`/…; `*`
  for any), so `GET /items` and `POST /items` survive as distinct operations and the resolved-routes
  / feature tables render a **Method** column. Populated by every method-aware adapter
  (Express/NestJS/Flask/FastAPI/Django-DRF/Rails/Go), which lets a Rails `resources` expand to its 7
  RESTful actions by verb.
- **Django, Rails and Go route adapters** gained full prefix + method resolution (see Fixed), and
  **Next.js `route.ts`** is now content-scanned for its exported HTTP method handlers.
- **Flutter / Dart detection**: `pubspec.yaml` → framework `Flutter`, package manager `pub`,
  dependency parsing, and `lib/main.dart` as an entry point.
- **Broader candidate hints** so a stack with no dedicated route adapter is never invisible:
  flask-restful (`add_resource`/`Resource`/`add_url_rule`), Django DRF (`router.register`,
  `DefaultRouter`), Rails `config/routes.rb`, Go `net/http`, Rust (axum/actix), Laravel and Spring
  route files now surface as route candidates.

### Changed
- **Migrated the toolchain to pnpm** (`packageManager` pinned; `pnpm-lock.yaml`; CI on
  `pnpm/action-setup`), replacing the npm/bun lockfiles.
- **Automated, Conventional-Commit-driven releases via semantic-release**, fully in CI on push to
  `main` (replaces the manual `vX.Y.Z` tag flow): it computes the version, syncs it across
  `package.json` / `src/types.ts` / `SKILL.md` / `CHANGELOG.md`, rebuilds the bundle, commits the
  bump, tags, and creates the GitHub release. GitHub-only (no npm-registry publish).
- **`--check` gate hardening** (`src/check.ts`): the `🧠`/placeholder scans also exempt curly-quoted
  examples; the scaffold's own `Setting | Value` meta table no longer satisfies the contract-substance
  check (false-pass); and an empty feature spine section now fails per-section (a heading whose body
  is only a callout/blank is not a filled PRD).
- **Route kind classification**: Rails and Django routes under an `api` segment / DRF views are
  classed `api` (not `page`); a plain-REST FastAPI app no longer mislabels its `routers/` as a
  tRPC/GraphQL/gRPC surface.

### Fixed
- **Prefix composition (wrong → correct paths)** across adapters: Flask `Blueprint(url_prefix=…)`
  constructor prefix + nested blueprints; FastAPI `module.router` includes + nested routers +
  websockets; Django transitive `include()` chains + legacy `url()` + DRF list/detail expansion;
  Rails nested `resources`, `member`/`collection`, singular `resource`, `scope path:`, `mount`;
  Go chi `r.Route`/`r.Mount` closures + gorilla/`net/http` `HandleFunc` + verb-as-argument
  `r.Handle`; NestJS array paths (no more bogus `/`) + `setGlobalPrefix`; Express same-file router
  mounts + `router.route().get().post()` chaining; Next.js intercepting-route markers + monorepo
  `apps/*/app` dirs.
- **i18n locale detection**: 3-letter BCP-47 locales (`fil`, `yue`) are kept and a namespace filename
  is never emitted as a locale; `keyCount` is summed per locale instead of `max` across files.
- **Stack robustness**: a present lockfile still yields a package manager even when `package.json`
  is malformed; Bun's modern text `bun.lock` is recognized as `bun`.
- **Bundle (`--merge`) heading demotion**: setext `===` H1s are demoted (single-H1 guarantee) and a
  leading YAML/TOML front-matter block passes through without its `#` lines being demoted.
- **Scratch plan consistency**: dangling foreign-key targets, duplicate entity names, and
  `writes`-not-in-`entities` are now caught by `validatePlanConsistency`.
- **Docs ↔ gate parity**: the `--check` descriptions (`SKILL.md`, `references/buildability-checklist.md`,
  `references/analysis-playbook.md`, `references/scratch-playbook.md`, the CLI `--help`) now list the
  contract-substance failures (empty `DATA-MODEL.md` / `INTERFACES.md`, a content-less feature PRD)
  and correctly describe an **uncovered locale as a warning**, not a non-zero-exit error. Reconciled
  the stale "eight contract categories" references to "nine".

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
- `scripts/parity.mjs` now asserts buildability-by-construction (the plan generates with no
  consistency errors/warnings), scaffold richness (real entities incl. `contactRequests`, enums,
  services, policies, message catalog), and locale parity — not just structural alignment.
- The example plan fixture (`tests/fixtures/scratch-plan/example.plan.json`) was realigned to mirror
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
- Convergence harness: `scripts/parity.mjs` + `npm run parity` structurally
  diffs the code path and the from-scratch path; `tests/fixtures/scratch-plan/example.plan.json`;
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

[0.4.0]: https://github.com/maxgfr/reconstruct/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/maxgfr/reconstruct/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/maxgfr/reconstruct/releases/tag/v0.2.0
[0.1.0]: https://github.com/maxgfr/reconstruct/releases/tag/v0.1.0
