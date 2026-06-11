# reconstruct

[![CI](https://github.com/maxgfr/reconstruct/actions/workflows/ci.yml/badge.svg)](https://github.com/maxgfr/reconstruct/actions/workflows/ci.yml)

> Turn any repository — or a greenfield idea — into **reconstruction PRDs** an AI agent can
> rebuild the project from: faithful to the original (logic, routes, translations, schema,
> config), optionally improved, and **buildable enough that a fresh agent gets the contracts
> right** — enforced by a `--check` gate.

`reconstruct` is an [Agent Skill](https://www.skills.sh/) (the open agent-skills
ecosystem by Vercel). It pairs a **thin deterministic scaffold** with a **thick AI
playbook**: a bundled, dependency-free Node script extracts universal facts, resolves routes
(with their HTTP method) for the major frameworks, and surfaces *candidate hints* for
everything else; the AI agent that runs the skill supplies the deeper framework-aware
understanding — the full interface surface, the data model, and the real features — for
**any** stack.

> 📖 **Full documentation:** [`DOCUMENTATION.md`](./DOCUMENTATION.md) — concept, CLI
> reference, the analyzer pipeline, how to extend it, and FAQ.

## Install

```bash
# into the current project (committed, team-shared)
npx skills add maxgfr/reconstruct

# or globally for all your projects
npx skills add -g maxgfr/reconstruct
```

This installs the skill into your agent (Claude Code, Cursor, Codex, …). Then just ask:

> "Use the reconstruct skill on this repo in redesign + complex mode."

## What it produces

```
reconstruction/
├── REBUILD.md                 # master plan: build order + validation checklist
├── RECONSTRUCTION.md          # (--merge) the whole tree in one markdown, WITH embedded source
├── SPECS.md                   # (--specs) the whole spec, code-free — the file to implement from
├── FEATURES.md                # (--features) every feature PRD only, in build order
├── SUMMARY.md                 # (--summary) one-page digest of the reconstruction
├── 00-overview/PRD.md         # product summary, stack, metrics, feature index
├── architecture/
│   ├── ARCHITECTURE.md        # architecture + external services, cross-cutting policies, i18n message catalog
│   ├── INTERFACES.md          # interface surface (method · path · kind · handler) + per-op input/output/side-effect contracts
│   ├── DATA-MODEL.md          # entities, fields, relations, indexes + enums & domain types
│   └── diagram.md             # mermaid module diagram
├── features/
│   └── NN-<slug>/PRD.md       # one PRD per feature/module (build-order tiered)
├── data/                      # ground truth, copied verbatim
│   ├── translations/          # i18n files
│   ├── schema/                # DB schema / models
│   └── config/                # build/lint/env config
├── source/                    # (fidelity=mirror) copied real source, per feature
└── inventory.json             # machine-readable manifest
```

## Two axes + fidelity

| Axis | Values | Effect |
| --- | --- | --- |
| **Mode** | `preserve` \| `redesign` \| `scratch` | Keep the current architecture, design a fresh one for the same features, or build **greenfield** from an interview (see [From scratch](#from-scratch-greenfield)). |
| **Level** | `light` \| `complex` | Faithful & concise, or also suggest improvements the agent folds in. |
| **Fidelity** | `mirror` \| `embed` \| `describe` | Copy real files / inline key code / text-only. |

Fidelity defaults are derived (override with `--fidelity`):

| Mode + Level | Fidelity |
| --- | --- |
| preserve + light | `mirror` |
| preserve + complex | `embed` |
| redesign + light | `embed` |
| redesign + complex | `describe` |

> Translations, schema, and config are **always** copied into `data/` verbatim,
> regardless of fidelity — you can't faithfully "rewrite" data.

## Standalone CLI

The deterministic engine also runs on its own (no agent, no API key):

```bash
node scripts/analyze.mjs --repo ./my-app --out ./my-app/reconstruction \
  --mode preserve --level light --fidelity mirror

# inspect the raw inventory without writing anything
node scripts/analyze.mjs --repo ./my-app --json
```

Run `node scripts/analyze.mjs --help` for all flags.

## Bundling: one file or a digest

Four optional, combinable flags collapse the multi-file tree:

- `--merge` → **`RECONSTRUCTION.md`**: the whole tree in one coherent markdown
  (single H1, linked table of contents, headings demoted one level; ordered
  overview → architecture → features → build order), **with the embedded original
  source**. The complete archive.
- `--specs` → **`SPECS.md`**: the **same whole tree** as `--merge` — overview,
  architecture (interfaces + data model), every feature PRD, build order — but
  with each document's `## Source material` section (the embedded original source
  code) **stripped**. Self-sufficient (it carries the contracts the feature PRDs
  reference) yet code-free, so it's the single file you hand an agent to
  **(re)implement the project from**.
- `--features` → **`FEATURES.md`**: every feature PRD only — the product
  functionality — in build order, in one file (single H1 + table of contents).
  The features-only counterpart to `--merge`.
- `--summary` → **`SUMMARY.md`**: a one-page digest from the inventory (stack,
  libraries, size, features in build order, interface/data counts, locales,
  unknowns, next steps).

```bash
# inline: produce the tree and the bundles in one run
node scripts/analyze.mjs --repo ./my-app --out ./my-app/reconstruction --merge --specs --features --summary

# standalone post-step: (re)build the bundles from an existing output, no --repo
node scripts/analyze.mjs --merge --specs --features --summary --out ./my-app/reconstruction

# just the code-free spec to implement from, from an existing reconstruction:
node scripts/analyze.mjs --specs --out ./my-app/reconstruction
```

The standalone form reads `<out>/inventory.json` + the `.md` files, is idempotent,
and errors clearly if the directory holds no `inventory.json`.

## Validation: is it actually buildable?

A reconstruction is only useful if a fresh agent can rebuild each unit **correctly** from
the PRD + architecture docs alone. Once the PRDs are enriched, run the buildability gate:

```bash
node scripts/analyze.mjs --check --out ./my-app/reconstruction
```

It exits non-zero on the structural failures — unresolved `🧠` callouts or `fill this in`
placeholders, a feature that references an undocumented entity/operation, a feature PRD
missing its spine, an uncovered locale, and a **gutted** data model / interface surface /
feature PRD (an emptied contract fails too, not just a callout-laden one).

`--check` covers structure; the **nine contract categories** a PRD must actually carry —
field-level data model, fully-enumerated enums, operation & write contracts (a public write
can't require an owner foreign key), format validations, external services, quantified
policies, the i18n message catalog, and shared/owned UI components — are in
[`references/buildability-checklist.md`](./references/buildability-checklist.md). In
greenfield mode the engine also **validates the plan's consistency** before rendering, so
dangling references and anonymous-write-to-owner-FK contradictions are caught up front.

### Two validation layers: deterministic gate + AI review

`--check` is **deterministic** — it proves *structure* (no leftover callouts, the docs
declare entities/operations, every PRD keeps its spine). It can't judge *substance*: a PRD
can pass the gate and still be unbuildable (vague requirements, happy-path-only criteria, an
unsatisfiable write contract, an enum value that contradicts the data model). That second
judgement is the **AI review** — performed **via the skill**, not the script: there is no
`--ai` flag and no API key, because the agent running the skill *is* the reviewer. After
`--check` passes, the agent re-reads the tree and applies
[`references/ai-review-rubric.md`](./references/ai-review-rubric.md) (story completeness,
testable requirements, real Given/When/Then incl. failure paths, satisfiable write contracts,
enum fidelity, cross-doc consistency, faithfulness, i18n, and the rebuild self-test), fixing
every **blocker** in place. Layer 1 is fast and CI-friendly; layer 2 is where a smart model
earns its keep.

## From scratch (greenfield)

No repo yet? Turn an **idea** into the same reconstruction tree. Just ask your agent:

> "Use reconstruct to turn my idea into a build plan."

**You don't write `plan.json` by hand — the agent does.** Following [`SKILL.md`](./SKILL.md) →
[`references/scratch-playbook.md`](./references/scratch-playbook.md), it **interviews you**
(grill-with-docs style: one question at a time, recommending an answer each time), writes the
domain docs (`CONTEXT.md`, `docs/adr/`) and a **`plan.json`** — the structured transcript of the
interview — then runs the engine and enriches the PRDs:

```bash
# the agent runs this for you, once the interview has produced plan.json
node scripts/analyze.mjs --scratch --plan plan.json --out ./reconstruction --level complex --tdd
```

`plan.json` is an intermediate artifact the agent generates from your answers. You *can*
hand-write one if you prefer — the schema and a worked example are in
[`references/scratch-plan-schema.md`](./references/scratch-plan-schema.md).

Greenfield collapses two axes — mode is always `scratch`, fidelity is forced to `describe`
(there is no source to mirror) — while `--level` still applies (`complex` = a deeper interview
that also proposes alternatives and more ADRs). On top of the usual tree it also writes the
interview's domain docs, and `INTERFACES.md` / `DATA-MODEL.md` come **pre-filled** from the plan —
along with the enums, external services, cross-cutting policies, and i18n message catalog the
interview captures, so the from-scratch tree is as buildable as the reverse-engineered one:

```
reconstruction/
├── …                         # the same REBUILD / overview / architecture / features tree
├── CONTEXT.md                # the glossary (from plan.glossary + data-model relations)
└── docs/adr/NNNN-*.md        # one terse ADR per recorded decision
```

`CONTEXT.md` and `docs/adr/` are written **if-absent**, so a richer version you authored during
the interview is never clobbered. Add `--tdd` (here or in any mode) to make every feature PRD and
`REBUILD.md` drive the build **test-first** (red → green → refactor).

- **The interview:** [`references/scratch-playbook.md`](./references/scratch-playbook.md)
- **The `plan.json` contract + example:** [`references/scratch-plan-schema.md`](./references/scratch-plan-schema.md)
- **A full worked plan:** [`tests/fixtures/scratch-plan/example.plan.json`](./tests/fixtures/scratch-plan/example.plan.json)
  (`pnpm run parity` renders this plan and checks it is buildable-by-construction; pass
  `-- --repo <repo>` to also check the code path and the from-scratch path converge).

## How the rebuild works

1. Read `00-overview/PRD.md`, `architecture/ARCHITECTURE.md`, `architecture/INTERFACES.md`,
   and `architecture/DATA-MODEL.md`.
2. Follow the dependency-tiered build order in `REBUILD.md`, implementing one
   `features/<slug>/PRD.md` at a time.
3. Use `data/` (and `source/` when present) as ground truth.

**Any stack.** The deterministic scaffold is universal (tree, deps, env, i18n, stack/library
detection, plus *candidate hints* for routes/API/schema/entry points — so a stack without a
dedicated adapter is never invisible). On top of that, **route adapters resolve the real
routes — with their HTTP method — for ten framework families** (Next.js, Express, Fastify,
Hono, Flask, FastAPI, NestJS, Django, Rails, Go) through a small pluggable registry. The deeper
framework-aware depth — the full interface surface and data model — comes from the AI playbook
in [`SKILL.md`](./SKILL.md) + [`references/`](./references), with per-stack cheat-sheets in
[`references/stack-guides/`](./references/stack-guides) (Next.js, Remix, Nuxt, SvelteKit,
Astro, Express/Fastify/Hono, NestJS, Django/Flask/FastAPI, Rails, Laravel, Go, Spring Boot,
tRPC/gRPC, GraphQL, mobile). Adding agent guidance for a stack is just markdown; adding a
deterministic route adapter is a small, self-contained code PR — see
[`references/adapters.md`](./references/adapters.md).

**Monorepos too.** Workspaces are detected across ecosystems (npm/yarn/pnpm — with Lerna and
Nx as fallbacks —, Cargo `[workspace]`, `go.work`) and the analysis is attributed per
workspace: each entry of `inventory.workspaces` carries its own stack, dependencies, hints,
and the manifest-derived `dependsOn` graph; features group per workspace and the build order
follows the workspace topological order (shared packages before the apps that consume them).
See [`references/stack-guides/monorepo.md`](./references/stack-guides/monorepo.md).

## Development

```bash
pnpm install
pnpm run build      # bundles src/ -> scripts/analyze.mjs (committed, zero-dep)
pnpm test           # vitest unit + integration over multi-stack fixtures
pnpm run typecheck
```

## Security

The analyzer only **reads** the target repo's filesystem and **copies** files into the
output. It never executes the analyzed project's code. Review `scripts/` before running
on untrusted repositories.

## License

MIT © maxgfr
