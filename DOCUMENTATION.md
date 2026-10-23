# reconstruct — Documentation

`reconstruct` analyzes any repository and emits a folder of **reconstruction PRDs** that an
AI agent can follow to rebuild the project from scratch — faithfully, and optionally with
improvements. This document is the full reference; the [README](./README.md) is the quick
start and [`SKILL.md`](./skills/reconstruct/SKILL.md) is the agent-facing playbook.

---

## Concept: thin deterministic scaffold + thick AI playbook

reconstruct splits the work into two layers with a sharp boundary:

1. **Deterministic scaffold** — a bundled, dependency-free Node script
   ([`scripts/analyze.mjs`](./scripts/analyze.mjs)) walks the repo and produces a precise,
   reproducible inventory of **universal facts** (tree, languages, lines, dependencies, env
   vars, scripts, i18n, stack/library detection) plus framework-agnostic **candidate hints**
   — files that likely declare routes, an API surface, the data model, or entry points,
   clearly labelled *to verify*. It also emits `unknowns`: explicit notes about what it could
   not resolve. No API key, no model, no guessing.
2. **AI playbook** — the markdown (`SKILL.md` + `references/`) is the program the agent
   follows to supply framework-aware understanding for **any** stack: it maps the real
   interface surface (`INTERFACES.md`), extracts the data model (`DATA-MODEL.md`), captures the
   design system for UI products (`DESIGN-SYSTEM.md`), groups features semantically, and turns
   source into concrete, testable PRDs.

The engine guarantees correct facts and good starting points; the agent supplies the
understanding. A markdown playbook that teaches the agent *where to look* scales to any stack;
on top of it, a pluggable registry of route adapters resolves routes deterministically where a
framework has a clear convention (see [Adapters](#adapters)).

The same boundary governs **validation**. The gates (`--check`, `--verify`, `--review`) are
deterministic — they generate worklists, hash what changed, and reduce results to a pass/fail
signal — while the *judgement* they fold in (does this requirement trace to source? is this PRD
actually buildable?) stays the agent's. That lets the review/fix loop fan out across subagents
and still terminate on a real fixpoint; the protocol is in
[`references/orchestration.md`](./skills/reconstruct/references/orchestration.md).

---

## Installation

As an [Agent Skill](https://www.skills.sh/) (the open agent-skills ecosystem):

```bash
# into the current project (committed, team-shared)
npx skills add maxgfr/reconstruct

# or globally, for all your projects
npx skills add -g maxgfr/reconstruct

# optionally target specific agents (default: the ones detected)
npx skills add maxgfr/reconstruct -a codex opencode
```

This installs the skill into your agent (Codex, OpenCode, Claude Code, Cursor, …). For local
development of reconstruct itself:

```bash
git clone https://github.com/maxgfr/reconstruct
cd reconstruct
pnpm install
```

---

## Usage

### As a skill

Once installed, just ask your agent:

> "Use the reconstruct skill on this repo in redesign + complex mode."

The agent follows [`SKILL.md`](./skills/reconstruct/SKILL.md): it confirms the inputs (target repo, mode,
level, fidelity, output dir), runs the analyzer, reads the generated output, and enriches
the PRDs — resolving the fill-in markers the script leaves behind. Those markers come in
two forms: `_italic placeholders_` in **light** level, and `> 🧠 **For the AI agent:**`
callouts in **complex** level / **redesign** mode.

### Standalone CLI

The deterministic engine also runs on its own — no agent, no API key:

```bash
node scripts/analyze.mjs --repo ./my-app --out ./my-app/reconstruction \
  --mode preserve --level light --fidelity mirror

# inspect the raw inventory without writing anything
node scripts/analyze.mjs --repo ./my-app --json
```

When installed as a skill, the binary is also exposed as `reconstruct` (see the `bin`
field in `package.json`), so `npx reconstruct --help` works too.

#### All flags

| Flag | Values | Default | Description |
| --- | --- | --- | --- |
| `--repo <path>` | path | current directory | Repository to analyze. Must be a directory. |
| `--out <path>` | path | `<repo>/reconstruction` | Output directory for the generated tree. |
| `--mode <mode>` | `preserve` \| `redesign` | `preserve` | Keep the current architecture, or design a fresh one for the same features. |
| `--level <level>` | `light` \| `complex` | `light` | Faithful & concise, or also surface improvements the agent folds in. |
| `--fidelity <mode>` | `mirror` \| `embed` \| `describe` | derived from mode+level | How real code is carried into the PRDs (see below). |
| `--granularity <g>` | `coarse` \| `fine` | `coarse` | Feature grouping. `coarse` folds trivial, route-less single-file groups into Core; `fine` keeps them split. |
| `--rea <mode>` | `auto` \| `on` \| `off` | `auto` | After the scaffold, inspect the repo's compiled artifacts (`.so`, `.dll`, `.wasm`, `.asar`, APK, …) with the [rea](https://github.com/morluto/rea) MCP server, statically, into `evidence/rea/`. `auto` runs it when it is installed (`REA_BIN`, else `rea` on `PATH`); `on` fails when it is missing; `off` never spawns it. See [rea underneath](#rea-underneath). |
| `--scratch` | flag | off | **Greenfield** mode: build from a `plan.json` interview instead of a repo. Forces `mode=scratch`, `fidelity=describe`; `--repo` is not used. See [From scratch](#from-scratch-greenfield). |
| `--plan <path>` | path | — | The `plan.json` driving `--scratch` (required with it). Schema: [`references/scratch-plan-schema.md`](./skills/reconstruct/references/scratch-plan-schema.md). |
| `--tdd` | flag | off | Emit test-first build guidance into the PRDs/`REBUILD.md` (each unit built red → green → refactor). Works in any mode. |
| `--check` | flag | off | Validate an existing `--out` tree for buildability and exit non-zero on failures (unresolved `🧠`/placeholders, a feature referencing an undocumented entity/operation, a feature PRD missing its spine, an unsettled `blocker` in `UNKNOWNS.json`). Warnings (non-blocking): an uncovered locale, a UI project whose `DESIGN-SYSTEM.md` is left empty, a broken relative link, a hand-edited unknown. Reads no repo — unless `--repo <path>` is given, in which case every file cited in `evidence[]` is re-hashed and stale evidence is reported. `--json` prints typed findings with stable `RCxxx` codes. See [`references/buildability-checklist.md`](./skills/reconstruct/references/buildability-checklist.md). |
| `--verify` | flag | off | Write a requirement→source verification worklist (`VERIFY.todo.json`/`VERIFY.md`) for an existing `--out`: each PRD requirement paired with its captured evidence for an agent to adjudicate (supported/partial/refuted/unsupported). With `--apply`, reduces the filled verdicts to `VERIFY.json`. Reads no repo. |
| `--unknowns` | flag | off | List the residual-unknowns ledger `UNKNOWNS.json` of an existing `--out` (seeded from `inventory.unknowns` on first use). With `--apply`, records new/updated unknowns fail-closed: `resolved` needs a citation that resolves against the inventory. Exits 1 while a `blocker` is unsettled. `--json` prints the ledger. See [`references/evidence-model.md`](./skills/reconstruct/references/evidence-model.md). |
| `--review` | flag | off | Write the AI buildability-review worklist (`REVIEW.todo.json`/`REVIEW.md`) for an existing `--out`: one per-feature unit, content-hashed so only changed units are flagged `needsReview`. With `--apply`, reduces agent-filled findings to `REVIEW.json` (`ok`/`residual`/`noProgress`/`staleRounds`). The deterministic ledger that makes the review/fix loop terminate — see [`references/orchestration.md`](./skills/reconstruct/references/orchestration.md). Reads no repo. |
| `--brainstorm` | flag | off | Scaffold a `BRAINSTORM.md` into `--out` for the optional divergent phase (generate several concepts, score, converge). Seeds the recovered surface when `--out` already has an `inventory.json`; never clobbers an edited file. Each section carries a `🧠` callout so `--check` gates an un-enriched brainstorm. Reads no repo. See [`references/brainstorm-playbook.md`](./skills/reconstruct/references/brainstorm-playbook.md). |
| `--orchestrate` | flag | off | Emit the multi-agent orchestration for an existing `--out` into `<OUT>/orchestration/`: the `agents/<role>.md` dispatch contracts (drafter/finder/verifier/adjudicator) that any host's subagents can run, a sequential `RUNBOOK.md` for a single agent, and — optionally, for Claude Code's Workflow tool — one launchable `<phase>.workflow.mjs` per ready phase (`enrich-map` \| `review-find` \| `review-verify` \| `adjudicate`). Built from the CURRENT worklists (`inventory.json`, `REVIEW.todo.json`, `REVIEW.json`, `VERIFY.todo.json`) with real ids baked in — deterministic and idempotent. Subagents RETURN fragments; the reduce/`--apply` fold stays with the orchestrator. Exit 2 on a missing `--out`, an unknown phase, or a phase whose worklist does not exist yet (the error names the producing command). Reads no repo. See [`references/orchestration.md`](./skills/reconstruct/references/orchestration.md). |
| `--phase <name>` | `enrich-map` \| `review-find` \| `review-verify` \| `adjudicate` | all ready phases | With `--orchestrate`, emit one phase only. |
| `--eco` | flag | off | With `--orchestrate`, emit only `RUNBOOK.md` + `agents/*.md` — the explicit sequential, low-token path. |
| `--list` | flag | off | With `--orchestrate`, print the `{"phases":[...]}` readiness JSON (worklist, item count, producing command per phase) and write nothing. |
| `--batch-size <n>` | integer > 0 | per phase | With `--orchestrate`, items per subagent batch. |
| `--max-verify <n>` | integer > 0 | `60` | With `--verify`, cap the requirement↔evidence worklist. The cap is recorded in `VERIFY.todo.json` `coverage`, and `--check --semantic` fails on requirements it left unoffered. |
| `--mcp` | flag | off | Serve the tree over the Model Context Protocol instead of running a command. With `--transport stdio\|http`, `--out <tree>` (default tree), `--port`, `--bind`, `--allow-origin`, `--allow-remote`, `--allow-write` (exposes `reconstruct_scaffold`/`reconstruct_brainstorm` and lets `reconstruct_unknowns` record `updates`) and `--max-response-bytes`. Cannot be combined with another action. See the README's MCP section. |
| `--compare <path>` | path | — | Compare a rebuilt program with the original on the explicit local cases in this JSON file: exact stdout/stderr/exit only. Requires `--original` and `--rebuilt`; executes nothing without `--run-tests`. See [`references/behavior-compare.md`](./skills/reconstruct/references/behavior-compare.md). |
| `--original <path>` | path | — | With `--compare`, the original working tree. |
| `--rebuilt <path>` | path | — | With `--compare`, the rebuilt working tree. |
| `--run-tests` | flag | off | With `--compare`, authorize executing the case commands locally (not sandboxed). Without it every case stays `not-tested` and the gate fails. |
| `--apply <path>` | path | — | Apply an agent-filled file: pair with `--verify` (verdicts → `VERIFY.json` + `OBLIGATIONS.json`), `--review` (findings → `REVIEW.json`) or `--unknowns` (updates → `UNKNOWNS.json`). |
| `--semantic` | flag | off | With `--check`, fold the semantic gates into the structural one: `VERIFY.json` (refuted/unsupported requirements) and `REVIEW.json` (unresolved blockers). Strictly additive — never relaxes `--check`. Trustless and fail-closed: it re-reduces the persisted verdicts/findings (never a stored `ok`), re-resolves every cited `evidenceRef` against the inventory, and errors when a ledger is missing or unreadable. |
| `--allow-unverified` | flag | off | With `--check --semantic`, downgrade a missing/unreadable `VERIFY.json`/`REVIEW.json` ledger — and unadjudicated or `confidence: gap` verdicts — to a warning instead of failing closed. Use deliberately, and say so in the report. |
| `--include <glob>` | gitignore-style glob | — | Only analyze files matching the glob. Repeatable; comma-separated lists accepted. |
| `--exclude <glob>` | gitignore-style glob | — | Skip files matching the glob. Repeatable; comma-separated lists accepted. |
| `--max-embed-bytes N` | integer > 0 | `16000` | Max bytes embedded per file when `fidelity=embed`. |
| `--merge` | flag | off | Also write `RECONSTRUCTION.md` — the whole tree bundled into one markdown (single H1, table of contents, headings demoted one level). Without `--repo`, runs standalone on an existing `--out`. |
| `--features` | flag | off | Also write `FEATURES.md` — every feature PRD only (the product functionality), in build order, in one file (single H1, table of contents, headings demoted one level). The features-only counterpart to `--merge`. Without `--repo`, runs standalone on an existing `--out`. |
| `--specs` | flag | off | Also write `SPECS.md` — the **same whole tree as `--merge`** (overview, architecture, every feature PRD, build order) but with each document's `## Source material` section (the embedded original source code) stripped. Self-sufficient yet code-free: the single file to hand an agent to (re)implement the project from. Without `--repo`, runs standalone on an existing `--out`. |
| `--summary` | flag | off | Also write `SUMMARY.md` — a one-page digest from the inventory (stack, libraries, size, features in build order, interface/data counts, locales, unknowns). Without `--repo`, runs standalone on an existing `--out`. |
| `--json` | flag | off | Print the inventory JSON to stdout and write nothing to disk. Takes precedence over `--merge`/`--features`/`--specs`/`--summary`. With `--check`, print typed findings (`{ok, findings:[{code, severity, message, file, next_action}]}`) instead of the text report; with `--unknowns`, print the ledger. |
| `-h, --help` | flag | — | Show help and exit. |
| `-v, --version` | flag | — | Print the version and exit. |

Both `--flag value` and `--flag=value` forms are accepted. After a successful run the CLI
prints a short summary to stderr (file count, stack, feature/route/locale counts, candidate
hints, monorepo workspaces, excluded-file count, unresolved `unknowns`, and the path to
`REBUILD.md`).

---

## From scratch (greenfield)

When there is **no repo** — you want to turn an idea into a build plan — reconstruct runs the
other way around: it produces the *same* tree, but the facts come from an **interview** instead
of source code. The two front-ends converge on one `Inventory` and one renderer, so a
greenfield build plan and a reverse-engineered one are structurally identical.

**Who writes `plan.json`?** The **agent** does — you never hand-author it. When you ask your
agent to build something from scratch, it follows the `## From scratch` procedure in
[`SKILL.md`](./skills/reconstruct/SKILL.md) and the interview method in
[`references/scratch-playbook.md`](./skills/reconstruct/references/scratch-playbook.md):

1. **Interview** — the agent grills you one question at a time (recommending an answer each
   time), sharpening fuzzy terms into a glossary and probing entity/feature boundaries with
   concrete scenarios.
2. **Capture** — as decisions crystallize it writes `CONTEXT.md` (the glossary) and, sparingly,
   ADRs under `docs/adr/`.
3. **`plan.json`** — it serializes the resolved interview into a `plan.json` (the structured
   transcript). This is an **intermediate artifact the agent generates**; the schema and a
   worked example live in [`references/scratch-plan-schema.md`](./skills/reconstruct/references/scratch-plan-schema.md)
   if you'd rather hand-write or tweak one.
4. **Render** — it runs the engine, which scaffolds the tree and **pre-fills** the
   `INTERFACES.md` / `DATA-MODEL.md` / `DESIGN-SYSTEM.md` tables from the plan:

   ```bash
   node scripts/analyze.mjs --scratch --plan plan.json --out ./reconstruction --level complex [--tdd]
   ```
5. **Enrich** — it fills the `> 🧠` callouts in each PRD from the interview + `CONTEXT.md` + ADRs.

`--scratch` forces `mode=scratch` and `fidelity=describe` (there is no source to mirror); no
`--repo` is read. On top of the usual tree it writes `CONTEXT.md` and `docs/adr/NNNN-*.md`,
both **if-absent** so the agent's richer versions are never clobbered, and `00-overview` links
to them. Add `--tdd` (in any mode) to make every feature PRD and `REBUILD.md` drive the build
**test-first** (red → green → refactor). `pnpm run parity` renders a plan and checks it is
buildable-by-construction (every declared entity/interface/enum/service/policy/locale is
pre-filled); pass `-- --repo <repo>` to also assert the code path and the from-scratch path
converge on the same tree.

---

## The three axes

reconstruct is steered by three orthogonal choices.

| Axis | Values | Meaning |
| --- | --- | --- |
| **Mode** | `preserve` \| `redesign` \| `scratch` | `preserve` documents the architecture as it is. `redesign` keeps the *features* but invites a fresh architecture. `scratch` is greenfield: there is no repo, so the facts come from an interview (`--scratch`, see below). |
| **Level** | `light` \| `complex` | `light` is faithful and minimal. `complex` also adds "Improvements & refactors" sections and architectural suggestions. |
| **Fidelity** | `mirror` \| `embed` \| `describe` | How much real source travels with the PRDs: `mirror` copies files verbatim under `source/`, `embed` inlines key code (truncated to `--max-embed-bytes`), `describe` is text-only. `scratch` always uses `describe` — there is no source to carry. |

### Default fidelity matrix

If you don't pass `--fidelity`, it is derived from mode + level
([`defaultFidelity` in `src/cli.ts`](./src/cli.ts)):

| Mode + Level | Fidelity | Rationale |
| --- | --- | --- |
| preserve + light | `mirror` | Faithful rebuild → keep the real files as ground truth. |
| preserve + complex | `embed` | Improving in place → inline key code to reason over. |
| redesign + light | `embed` | New architecture, faithful behavior → inline references. |
| redesign + complex | `describe` | Clean-slate rewrite → describe intent, don't copy code. |

> **Always copied verbatim:** translations, schema, and config land under `data/`
> regardless of fidelity — you can't faithfully "rewrite" data.

---

## Output structure

A run writes this tree under `--out` (default `<repo>/reconstruction`):

```
reconstruction/
├── REBUILD.md                 # master plan: build order + validation checklist
├── SUMMARY.md                 # one-page digest — written on EVERY run; the cheap way to orient
├── 00-overview/PRD.md         # product summary, stack, metrics, feature index
├── architecture/
│   ├── ARCHITECTURE.md        # current (preserve) or proposed (redesign) architecture
│   ├── INTERFACES.md          # interface surface skeleton (routes/endpoints/RPC/GraphQL/CLI/jobs)
│   ├── DATA-MODEL.md          # data-model skeleton (entities, fields, relations)
│   ├── DESIGN-SYSTEM.md       # design-system skeleton (tokens, theming, typography, components, a11y)
│   └── diagram.md             # mermaid module diagram
├── features/
│   └── NN-<slug>/PRD.md       # one PRD per feature/module (numbered in dependency-tier order)
├── data/                      # ground truth, copied verbatim
│   ├── translations/          # i18n files
│   ├── schema/                # DB schema / models (.prisma, .sql, .graphql, …)
│   └── config/                # build/lint/env config
├── source/                    # (fidelity=mirror only) copied real source, per feature
├── UNKNOWNS.json              # (--unknowns) residual-unknowns ledger, revisioned + hash-chained
├── OBLIGATIONS.json           # (--verify --apply) requirement obligations: closed / open / failed + closure digest
├── evidence/rea/              # (--rea, when rea is installed) INDEX.json + one rea inspection per compiled artifact + rea's exported bundles
└── inventory.json             # machine-readable manifest of the whole analysis, incl. evidence[]
```

`--brainstorm` writes a single `BRAINSTORM.md` into `--out` instead of the tree above — a divergent
worklist for the optional pre-build phase. It stands alone (no `inventory.json` needed) or sits
inside an existing reconstruction, where it seeds the recovered surface for brainstorming evolutions.

`inventory.json` is the structured backbone every PRD is rendered from: it includes
`repoName`, `fileCount`, `totalLines`, `stack` (primary language, frameworks, and detected
`libraries`), `features`, `routes`, `i18n`, `schemas`, `configs`, and the v0.2 additions:
`hints` (`routeCandidates` / `apiCandidates` / `schemaCandidates` / `realtimeCandidates` /
`authCandidates` / `entryPoints`),
`unknowns` (explicit pointers for the agent), `warnings` (non-fatal degradations: a manifest
that exists but does not parse, a workspace dependency cycle — omitted when empty),
`workspaces` (monorepo packages — each entry
carries its `kind` — npm/pnpm/lerna/nx/cargo/go —, its own `stack` and `dependencies`, the
manifest-derived `dependsOn` edges, `routeCount`, `schemas`, and per-workspace `hints`),
`runtime` (e.g. required Node version), `excludedCount`, and `evidence` — one content-addressed
record per resolved route / env var (`ev_<hash>`, file, line, content hash, `confidence`,
`authority`; see [`references/evidence-model.md`](./skills/reconstruct/references/evidence-model.md)).
Each `files[]` entry carries a 16-hex content `hash`, and each route its declaration `line`. The artifacts and the per-feature copies
are produced by [`src/prd/render.ts`](./src/prd/render.ts) and flushed to disk by
[`src/output.ts`](./src/output.ts).

**Read `SUMMARY.md`, not `inventory.json`, to orient.** The inventory carries one entry per
analyzed file, so it grows linearly with the repo (tens of KB on a mid-size project, far more on
a large one); `SUMMARY.md` is a few KB and bounded. Slice the inventory with `jq` when you need a
specific field — see
[`references/scale-and-context.md`](./skills/reconstruct/references/scale-and-context.md).

### Re-running is guarded

`writeOutput` re-renders **every** artifact, so a fresh `--repo`/`--scratch` run pointed at an
already-enriched `--out` would destroy the prose (only `CONTEXT.md`, `docs/adr/*` and
`BRAINSTORM.md` are written if-absent). `detectEnrichment` in
[`src/output.ts`](./src/output.ts) spots an enriched tree — a callout-bearing document whose `🧠`
callouts are all resolved, or a `REVIEW.json`/`VERIFY.json` ledger — and the CLI refuses the run,
naming the safe alternatives. `--force` overrides it and loses the enrichment. The list of
callout-bearing documents is pinned to a really-generated tree by `tests/rerun-guard.test.ts`, so
a template that stops emitting callouts fails a test instead of silently misfiring the guard.

---

## How the analyzer works

The pipeline is a straight line, orchestrated by [`src/analyze.ts`](./src/analyze.ts) (the
analysis) and [`src/cli.ts`](./src/cli.ts) (CLI + render + write):

```
walk → detect → candidates → adapters → features → prd → output
```

| Stage | File(s) | Responsibility |
| --- | --- | --- |
| **walk** | [`src/walk.ts`](./src/walk.ts) | Traverse the repo, honor `.gitignore` + `--include`/`--exclude`, categorize each file, and report `excludedCount`. |
| **detect** | [`src/detect/stack.ts`](./src/detect/stack.ts), [`src/detect/workspaces.ts`](./src/detect/workspaces.ts) | Rank languages; identify frameworks (JS/TS + Python/Ruby/PHP/JVM via manifests); **detect notable libraries**; find package managers; detect the required **Node version**; detect **monorepo workspaces** (npm/yarn/pnpm, lerna/nx fallbacks, Cargo, go.work), build the **workspace dependency graph**, and attribute stack/deps/routes/hints **per workspace**. |
| **candidates** | [`src/detect/candidates.ts`](./src/detect/candidates.ts) | Framework-agnostic **hints**: candidate files for routes, API surface (tRPC/GraphQL/gRPC/OpenAPI), data model (ORM schemas/models), design-system sources (Tailwind/theme/token configs, global CSS), realtime/auth signals, and entry points — from path + bounded content heuristics. |
| **adapters** | [`src/adapters/*`](./src/adapters) | Extract dependencies, env vars, framework routes, and i18n (see below). |
| **features** | [`src/features.ts`](./src/features.ts) | Group files into features (skipping route groups `(...)` / dynamic `[...]` segments), order them by **dependency tier** (foundations → feature pages → tests/docs), and apply `--granularity`. |
| **prd** | [`src/prd/render.ts`](./src/prd/render.ts), [`templates.ts`](./src/prd/templates.ts), [`fidelity.ts`](./src/prd/fidelity.ts) | Render the Markdown artifacts — including the `INTERFACES.md` / `DATA-MODEL.md` / `DESIGN-SYSTEM.md` skeletons — and decide which real files to copy/embed/describe. |
| **output** | [`src/output.ts`](./src/output.ts) | Write artifacts and copy ground-truth files to `--out`. |
| **rea** | [`src/rea.ts`](./src/rea.ts) | When the repo ships compiled artifacts and rea is installed: drive the rea MCP server over stdio, one static inspection per artifact, into `evidence/rea/` (see [rea underneath](#rea-underneath)). |

Types shared across the pipeline live in [`src/types.ts`](./src/types.ts).

### Adapters

| Adapter | File | What it does |
| --- | --- | --- |
| Generic | [`src/adapters/generic.ts`](./src/adapters/generic.ts) | Dependencies (npm, pip, Cargo, Go modules, Composer, Maven, Gradle, Bundler), scripts, env vars, file categories. |
| Route registry | [`src/adapters/registry.ts`](./src/adapters/registry.ts) | Runs every route adapter whose framework is active, then merges + de-dupes + sorts the resolved routes. |
| Next.js | [`src/adapters/nextjs.ts`](./src/adapters/nextjs.ts) | File-based routing: `app/` (`page`/`route`/`layout`) + `pages/` (incl. `pages/api/*`); route groups & parallel slots. |
| Flask | [`src/adapters/flask.ts`](./src/adapters/flask.ts) | `@app.route` + method shortcuts; `Blueprint` routes resolved through their registered `url_prefix` across modules. |
| FastAPI | [`src/adapters/fastapi.ts`](./src/adapters/fastapi.ts) | `@app.<method>` + `APIRouter`: `include_router(prefix)` + `APIRouter(prefix)` + decorator path across modules. |
| NestJS | [`src/adapters/nestjs.ts`](./src/adapters/nestjs.ts) | `@Controller(base)` + method decorators (`@Get(sub)`) → `/base/sub`. |
| Express | [`src/adapters/express.ts`](./src/adapters/express.ts) | `app.<method>` absolute; `router.<method>` prefixed by the cross-file `app.use("/mount", router)`. |
| Fastify | [`src/adapters/fastify.ts`](./src/adapters/fastify.ts) | `app.<method>` + `route({ method, url })`; plugin routes prefixed by the cross-file `register(plugin, { prefix })`, composed transitively. |
| Hono | [`src/adapters/hono.ts`](./src/adapters/hono.ts) | `app.<method>` + `app.on(verb, path)`, prefixed by `.basePath()`; `app.route("/p", sub)` mounts resolved across files, composed transitively. |
| Django | [`src/adapters/django.ts`](./src/adapters/django.ts) | `urls.py` `path`/`re_path` (regex anchors stripped); `include("app.urls")` mounts resolved across modules. |
| Rails | [`src/adapters/rails.ts`](./src/adapters/rails.ts) | `config/routes.rb` verb routes + `root`; `resources` RESTful expansion (`only:`/`except:`); `namespace`/`scope` prefixes. |
| Go | [`src/adapters/go.ts`](./src/adapters/go.ts) | Gin/Echo/chi/Fiber `<router>.GET("/x")` prefixed by `.Group("/p")` chains, resolved transitively. |
| tRPC | [`src/adapters/trpc.ts`](./src/adapters/trpc.ts) | Procedures on `createTRPCRouter({…})` / `t.router({…})` → dot-paths (`user.list`) with method QUERY/MUTATION/SUBSCRIPTION; nested routers composed across files. Activates on the `tRPC` **library** label (not a framework). |
| i18n | [`src/adapters/i18n.ts`](./src/adapters/i18n.ts) | Locale detection and per-file translation-key counting. |

Several web frameworks resolve routes **deterministically** (Next.js, Express, Fastify, Hono,
Flask, FastAPI, NestJS, Django, Rails, Go, ASP.NET Core, tRPC); every other stack's interface surface and data model are mapped by the **AI playbook**
from the candidate hints — see [`references/analysis-playbook.md`](./skills/reconstruct/references/analysis-playbook.md)
and the per-stack cheat-sheets in [`references/stack-guides/`](./skills/reconstruct/references/stack-guides), indexed by
[`stack-guides/INDEX.md`](./skills/reconstruct/references/stack-guides/INDEX.md) (which maps each
emitted label onto its guide — the names are deliberately not one-to-one — and covers the stacks
with no detection signal at all, plus the no-framework library/CLI/SDK case). The two
layers are **complementary**: an adapter gives a resolved head-start where a framework has a clear
routing convention; the playbook + candidates cover everything else and all the deep semantic work.

---

## Extending: two complementary paths

Framework support has two seams; pick the one that fits — or both.

**1. Add a stack guide (markdown) — scales to any stack, no code.** This is the default for
*understanding* depth:

1. Add `references/stack-guides/<stack>.md` following the existing 5-section shape
   (`Where the interface surface lives`, `Data model`, `Entry points & boot`, `Config & env`,
   `Gotchas`, + a closing `> tip:`). Keep it a dense cheat-sheet with real file paths and
   function/decorator names. The agent loads it on demand to fill `INTERFACES.md` / `DATA-MODEL.md`.
   **Add a row to [`stack-guides/INDEX.md`](./skills/reconstruct/references/stack-guides/INDEX.md)**
   in the same commit — the agent routes through the index, so an unindexed guide is unreachable.
2. *Optional:* if a cheap, framework-agnostic signal helps the agent find the right files, add a
   candidate heuristic to [`src/detect/candidates.ts`](./src/detect/candidates.ts) (a *candidate*,
   never asserted truth), cover it with a test, and `pnpm run build`.

**2. Add a route adapter (code) — a pluggable registry, one small PR.** When a framework has a
clear routing convention, a deterministic adapter upgrades its routes from *candidates* to
*resolved*. The registry is data-driven, so a new adapter is one file under `src/adapters/` + one
line in `src/adapters/registry.ts` + a fixture/test — no core change. Full walkthrough (with a
worked Django example): [`references/adapters.md`](./skills/reconstruct/references/adapters.md).

Markdown remains the way to teach the agent *any* stack; adapters make deterministic route
resolution cheap to add where a convention exists. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for
the full workflow.

---

## Driving a reconstruction

Once the `reconstruction/` folder exists, rebuild feature-by-feature:

1. Read `00-overview/PRD.md`, `architecture/ARCHITECTURE.md`, `architecture/INTERFACES.md`,
   `architecture/DATA-MODEL.md`, and — for a UI product — `architecture/DESIGN-SYSTEM.md` for
   the big picture.
2. Follow the dependency-tiered build order in `REBUILD.md`, implementing one
   `features/<slug>/PRD.md` at a time.
3. Use `data/` (translations, schema, config) and `source/` (when `fidelity=mirror`) as
   ground truth.

The full reasoning checklist lives in
[`references/rebuild-instructions.md`](./skills/reconstruct/references/rebuild-instructions.md); the PRD shapes
are in [`references/prd-light-template.md`](./skills/reconstruct/references/prd-light-template.md) and
[`references/prd-complex-template.md`](./skills/reconstruct/references/prd-complex-template.md); architecture
guidance is in [`references/architecture-analysis.md`](./skills/reconstruct/references/architecture-analysis.md).

---

## rea underneath

The analyzer reads source. A vendored native library, a `.wasm` module, an Electron `.asar` or an
APK has none to read, so the engine hands those to [rea](https://github.com/morluto/rea)
("Reverse Engineer Anything"), a local MCP server that inspects binaries (Ghidra, Hopper or IDA
backends), WebAssembly, .NET, Android, Apple, Electron and JavaScript applications.

**What runs, and when.** On a scaffold (CLI or `reconstruct_scaffold`), if the repo has
compiled artifacts with no source (`.so` / `.dylib` / `.dll` / `.exe` / `.node`, `.wasm`,
`.apk` / `.aab` / `.ipa`, `.asar`, `.dex`, `.beam`, `.pck`, extension-less executables, outside
the ignored `vendor/`, `dist/`, `build/`, `out/` and `target/` directories) and rea is installed,
[`src/rea.ts`](./src/rea.ts):

1. starts `rea mcp` and speaks MCP to it over stdio (no dependency; the tool list and argument
   names are read from rea's own `tools/list`);
2. runs every static probe that fits the artifact and keeps each one that succeeds:

   | Artifact | Probes |
   | --- | --- |
   | `.asar` | `analyze_javascript_application` |
   | `.wasm` | `inspect_wasm_artifact`, `inspect_binary_layout` |
   | `.apk` / `.aab` | `inspect_android_package`, `identify_flutter_build` |
   | `.dll` / `.exe` | `inspect_managed_artifact`, `inspect_binary_layout`, `inspect_pe_resources`, `inspect_go_binary`, `inspect_rust_binary`, native overview |
   | `.so` / `.dylib` / `.node` / executables | `inspect_binary_layout`, `inspect_macho`, `inspect_go_binary`, `inspect_rust_binary`, native overview |
   | anything else (`.ipa`, `.pck`, …) | `inspect_artifact` |

   Target-bound tools run in an `open_binary` → tool → `close_binary` session. The native
   overview is `binary_overview`, with rea picking Ghidra, Hopper or IDA;
3. writes each artifact's results to `evidence/rea/<artifact>.json`, and rea's own export
   (`export_evidence_bundle`, taken before `close_binary` clears it) to
   `evidence/rea/<artifact>.<tool>.bundle.json`. A bundle without any evidence id is not kept. The run
   goes to `evidence/rea/INDEX.json`: per artifact, the probes that succeeded, their evidence ids,
   bundles, and `notes` for the probes that did not apply.

Several probes need tools rea does not install: WABT for `inspect_wasm_artifact`, pwntools for
`inspect_binary_layout` (Linux x64), Ghidra and Java for the native overview. A missing one shows
up as a note or a failure in `INDEX.json`, with rea's remediation (e.g. "Supply WABT 1.0.42 via
absolute `REA_WABT_BIN_DIRECTORY`"). With rea-agents 6.7 and no backend installed, a macOS
executable is still inspected through `inspect_macho`.

Every `ev_…` id in those files is citable from the first enrichment pass as `rea:ev_…`, with
`authority: "analyzer"`. The gate resolves those citations against the files: an id that is not
there fails as fabricated. See
[`references/rea-companion.md`](./skills/reconstruct/references/rea-companion.md).

**What never happens.** The engine never installs rea, never uses `npx`, and only calls an
allowlist of **static** tools: rea's `capture_*` tools, which execute the target, are never called. A
missing rea, a crash, a timeout (180 s per call) or an unsupported artifact is recorded in
`INDEX.json` and never fails the reconstruction, unless you passed `--rea on`. One run inspects at
most 25 artifacts. `inventory.json` stays deterministic: rea's output lives only under
`evidence/rea/`.

| Control | Effect |
| --- | --- |
| `--rea auto` (default) / MCP `rea: "auto"` | Run rea when installed, skip silently otherwise |
| `--rea on` | Require it: fail when the `rea` executable is not found |
| `--rea off` | Never spawn it |
| `REA_BIN=/path/to/rea` | Use this executable instead of `rea` on `PATH` |

Install rea with `npx rea-agents setup` (Node 22+). Its native backends (Ghidra, JADX, WABT…)
are yours to provide, and commercial ones (IDA, Hopper, JEB) need your own licenses.

## Security

The analyzer only **reads** the target repository's filesystem and **copies** files into
the output directory. It **never executes** the analyzed project's code, installs nothing,
and makes no network calls. The one exception is [rea underneath](#rea-underneath): when the repo
ships compiled artifacts and an `rea` executable is installed, the scaffold runs it (`--rea off`
disables it), restricted to rea's static inspection tools. Review `scripts/` before running on
untrusted repositories.

---

## Development

```bash
pnpm install
pnpm run build       # tsup bundles src/ -> scripts/analyze.mjs (committed, zero-dep)
pnpm test            # vitest unit + integration over multi-stack fixtures
pnpm run typecheck   # tsc --noEmit (strict)
pnpm run check:build # rebuild and assert scripts/analyze.mjs is up to date (git diff)
pnpm run demo        # run the bundle on the sample fixture into /tmp/reconstruct-demo
```

### Why the bundle is committed

`scripts/analyze.mjs` is produced by **tsup** ([`tsup.config.ts`](./tsup.config.ts)) — a
single ESM file targeting Node 18+, bundled with zero runtime dependencies and a
`#!/usr/bin/env node` shebang. It is committed so an agent sandbox can run the analyzer
with plain `node` at skill-use time, without a `pnpm install` step. CI enforces that the
committed bundle matches the source via `pnpm run check:build`.

---

## Limits & FAQ

**Which stacks are supported?** All of them. The deterministic scaffold is universal and
emits candidate hints for routes/API/schema/entry points on any stack; the framework-aware
depth (the interface surface and data model) comes from the AI playbook plus the per-stack
guides in [`references/stack-guides/`](./skills/reconstruct/references/stack-guides) — Next.js, Remix, Nuxt,
SvelteKit, Astro, Express/Fastify/Hono, NestJS, Django/Flask/FastAPI, Rails, Laravel, Go,
Spring Boot, tRPC/gRPC, GraphQL, and mobile. Next.js, Flask, FastAPI, NestJS, and Express
routes are additionally resolved deterministically by [route adapters](#adapters). Missing a
guide? Adding one is just markdown — missing a route adapter? That's one small PR.

**No features detected?** The repo is probably flat. Group by top-level folders manually
and note it in `00-overview/PRD.md`.

**Huge repo?** Run with `--json` first to scope it, then prefer `--level light` +
`--fidelity mirror` so PRDs reference files instead of embedding them.

**Does it need an API key?** No. The analyzer is fully deterministic. Only the optional
enrichment step uses an AI agent.
