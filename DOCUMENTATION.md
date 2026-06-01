# reconstruct — Documentation

`reconstruct` analyzes any repository and emits a folder of **reconstruction PRDs** that an
AI agent can follow to rebuild the project from scratch — faithfully, and optionally with
improvements. This document is the full reference; the [README](./README.md) is the quick
start and [`SKILL.md`](./SKILL.md) is the agent-facing playbook.

---

## Concept: a hybrid engine

reconstruct splits the work into two halves with different strengths:

1. **Deterministic extraction** — a bundled, dependency-free Node script
   ([`scripts/analyze.mjs`](./scripts/analyze.mjs)) walks the repo and produces a precise,
   reproducible inventory: stack, routes, i18n, schema, config, dependencies, and a
   feature breakdown. No API key, no model, no guessing — just facts read off the
   filesystem.
2. **Agent enrichment** — the agent that runs the skill turns that raw material into
   concrete, testable PRDs: product summary, functional requirements, acceptance
   criteria, and (optionally) improvements or a redesigned architecture.

Keeping facts and reasoning apart is the whole point: the script never hallucinates a
route or a translation key, and the agent never has to re-derive what the code already
states. You get accurate ground truth *and* useful judgement.

---

## Installation

As an [Agent Skill](https://www.skills.sh/) (the open agent-skills ecosystem):

```bash
# into the current project (committed, team-shared)
npx skills add maxgfr/reconstruct

# or globally, for all your projects
npx skills add -g maxgfr/reconstruct
```

This installs the skill into your agent (Claude Code, Cursor, Codex, …). For local
development of reconstruct itself:

```bash
git clone https://github.com/maxgfr/reconstruct
cd reconstruct
npm install
```

---

## Usage

### As a skill

Once installed, just ask your agent:

> "Use the reconstruct skill on this repo in redesign + complex mode."

The agent follows [`SKILL.md`](./SKILL.md): it confirms the inputs (target repo, mode,
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
| `--max-embed-bytes N` | integer > 0 | `16000` | Max bytes embedded per file when `fidelity=embed`. |
| `--json` | flag | off | Print the inventory JSON to stdout and write nothing to disk. |
| `-h, --help` | flag | — | Show help and exit. |
| `-v, --version` | flag | — | Print the version and exit. |

Both `--flag value` and `--flag=value` forms are accepted. After a successful run the CLI
prints a short summary to stderr (file count, stack, feature/route/locale counts, and the
path to `REBUILD.md`).

---

## The three axes

reconstruct is steered by three orthogonal choices.

| Axis | Values | Meaning |
| --- | --- | --- |
| **Mode** | `preserve` \| `redesign` | `preserve` documents the architecture as it is. `redesign` keeps the *features* but invites a fresh architecture. |
| **Level** | `light` \| `complex` | `light` is faithful and minimal. `complex` also adds "Improvements & refactors" sections and architectural suggestions. |
| **Fidelity** | `mirror` \| `embed` \| `describe` | How much real source travels with the PRDs: `mirror` copies files verbatim under `source/`, `embed` inlines key code (truncated to `--max-embed-bytes`), `describe` is text-only. |

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
├── 00-overview/PRD.md         # product summary, stack, metrics, feature index
├── architecture/
│   ├── ARCHITECTURE.md        # current (preserve) or proposed (redesign) architecture
│   └── diagram.md             # mermaid module diagram
├── features/
│   └── NN-<slug>/PRD.md       # one PRD per feature/module (numbered, slugified)
├── data/                      # ground truth, copied verbatim
│   ├── translations/          # i18n files
│   ├── schema/                # DB schema / models (.prisma, .sql, .graphql, …)
│   └── config/                # build/lint/env config
├── source/                    # (fidelity=mirror only) copied real source, per feature
└── inventory.json             # machine-readable manifest of the whole analysis
```

`inventory.json` is the structured backbone every PRD is rendered from: it includes
`repoName`, `fileCount`, `totalLines`, `stack` (primary language, frameworks, and
detected `libraries`), `features`, `routes`, `i18n`, `schemas`, and `configs`. The
artifacts and the per-feature copies are produced by
[`src/prd/render.ts`](./src/prd/render.ts) and flushed to disk by
[`src/output.ts`](./src/output.ts).

---

## How the analyzer works

The pipeline is a straight line, orchestrated by [`src/analyze.ts`](./src/analyze.ts) (the
analysis) and [`src/cli.ts`](./src/cli.ts) (CLI + render + write):

```
walk → detect → adapters → features → prd → output
```

| Stage | File(s) | Responsibility |
| --- | --- | --- |
| **walk** | [`src/walk.ts`](./src/walk.ts) | Traverse the repo, honor `.gitignore`, categorize each file (code, config, schema, i18n, …). |
| **detect** | [`src/detect/stack.ts`](./src/detect/stack.ts) | Rank languages, identify frameworks, **detect notable libraries** (ORM, auth, API layer, styling, testing, i18n, services), find the package manager, flag TypeScript. |
| **adapters** | [`src/adapters/*`](./src/adapters) | Extract dependencies, routes, and i18n (see below). |
| **features** | [`src/features.ts`](./src/features.ts) | Group files into features by route/directory segment — skipping route groups `(...)` and dynamic segments `[...]` so i18n apps (`app/[locale]/...`) split into real features; assign numbered slugs. |
| **prd** | [`src/prd/render.ts`](./src/prd/render.ts), [`templates.ts`](./src/prd/templates.ts), [`fidelity.ts`](./src/prd/fidelity.ts) | Render the Markdown artifacts and decide which real files to copy/embed/describe. |
| **output** | [`src/output.ts`](./src/output.ts) | Write artifacts and copy ground-truth files to `--out`. |

Types shared across the pipeline live in [`src/types.ts`](./src/types.ts).

### Adapters

| Adapter | File | What it does |
| --- | --- | --- |
| Generic | [`src/adapters/generic.ts`](./src/adapters/generic.ts) | Dependencies (npm, pip, Cargo, Go modules, Composer), npm scripts, env vars, file categories. |
| Next.js | [`src/adapters/nextjs.ts`](./src/adapters/nextjs.ts) | Deep route detection for the app router and pages router (route groups, parallel slots, API routes). |
| i18n | [`src/adapters/i18n.ts`](./src/adapters/i18n.ts) | Locale detection and per-file translation-key counting. |
| JS/TS | [`src/adapters/js-ts.ts`](./src/adapters/js-ts.ts) | Entry-point and component-count utilities. |

The **deepest** analysis (routes, i18n, components) targets **JS/TS/Next.js**. Every other
stack is detected and inventoried generically (tree, files, dependencies, scripts).

---

## Extending: add an adapter

To deepen support for another stack (e.g. Vite, Remix, a Python framework):

1. Add a module under [`src/adapters/`](./src/adapters) that exports an extractor — follow
   the shape of `nextjs.ts` (it returns `RouteInfo[]`) or `i18n.ts` (returns `I18nInfo | null`).
2. Gate it on the detected stack, e.g. `if (stack.frameworks.includes("Remix")) …`, so it
   stays inert for unrelated repos.
3. Call it from [`src/analyze.ts`](./src/analyze.ts) and fold the result into the returned
   `Inventory`. Add the new field to the relevant type in [`src/types.ts`](./src/types.ts).
4. If the new data should surface in the PRDs, render it from
   [`src/prd/templates.ts`](./src/prd/templates.ts).
5. Add a fixture under `tests/fixtures/` and a case in `tests/analyze.test.ts`, then
   `npm run build` to refresh the committed bundle.

---

## Driving a reconstruction

Once the `reconstruction/` folder exists, rebuild feature-by-feature:

1. Read `00-overview/PRD.md` and `architecture/ARCHITECTURE.md` for the big picture.
2. Follow the build order in `REBUILD.md`, implementing one `features/<slug>/PRD.md` at a
   time.
3. Use `data/` (translations, schema, config) and `source/` (when `fidelity=mirror`) as
   ground truth.

The full reasoning checklist lives in
[`references/rebuild-instructions.md`](./references/rebuild-instructions.md); the PRD shapes
are in [`references/prd-light-template.md`](./references/prd-light-template.md) and
[`references/prd-complex-template.md`](./references/prd-complex-template.md); architecture
guidance is in [`references/architecture-analysis.md`](./references/architecture-analysis.md).

---

## Security

The analyzer only **reads** the target repository's filesystem and **copies** files into
the output directory. It **never executes** the analyzed project's code, installs nothing,
and makes no network calls. Review `scripts/` before running on untrusted repositories.

---

## Development

```bash
npm install
npm run build       # tsup bundles src/ -> scripts/analyze.mjs (committed, zero-dep)
npm test            # vitest unit + integration on tests/fixtures/sample-app
npm run typecheck   # tsc --noEmit (strict)
npm run check:build # rebuild and assert scripts/analyze.mjs is up to date (git diff)
npm run demo        # run the bundle on the sample fixture into /tmp/reconstruct-demo
```

### Why the bundle is committed

`scripts/analyze.mjs` is produced by **tsup** ([`tsup.config.ts`](./tsup.config.ts)) — a
single ESM file targeting Node 18+, bundled with zero runtime dependencies and a
`#!/usr/bin/env node` shebang. It is committed so an agent sandbox can run the analyzer
with plain `node` at skill-use time, without an `npm install` step. CI enforces that the
committed bundle matches the source via `npm run check:build`.

---

## Limits & FAQ

**Which stacks get deep analysis?** Routes, i18n, components, and schema detection are
tuned for **JS/TS/Next.js**. Other stacks (Python, Go, Rust, PHP, Ruby, …) are detected
and inventoried generically — tree, files, dependencies, scripts — which is still enough
to drive a faithful rebuild, just with fewer framework-specific niceties.

**No features detected?** The repo is probably flat. Group by top-level folders manually
and note it in `00-overview/PRD.md`.

**Huge repo?** Run with `--json` first to scope it, then prefer `--level light` +
`--fidelity mirror` so PRDs reference files instead of embedding them.

**Does it need an API key?** No. The analyzer is fully deterministic. Only the optional
enrichment step uses an AI agent.
