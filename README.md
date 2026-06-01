# reconstruct

[![CI](https://github.com/maxgfr/reconstruct/actions/workflows/ci.yml/badge.svg)](https://github.com/maxgfr/reconstruct/actions/workflows/ci.yml)

> Analyze any repository and generate **reconstruction PRDs** that let an AI agent
> rebuild the project from scratch — faithfully (logic, routes, translations, schema,
> config) and, optionally, with improvements.

`reconstruct` is an [Agent Skill](https://www.skills.sh/) (the open agent-skills
ecosystem by Vercel). It pairs a **thin deterministic scaffold** with a **thick AI
playbook**: a bundled, dependency-free Node script extracts universal facts and *candidate
hints*, and the AI agent that runs the skill supplies the framework-aware understanding —
the interface surface, the data model, and the real features — for **any** stack.

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
├── 00-overview/PRD.md         # product summary, stack, metrics, feature index
├── architecture/
│   ├── ARCHITECTURE.md        # current (preserve) or proposed (redesign) architecture
│   ├── INTERFACES.md          # the full interface surface (routes, endpoints, RPC/GraphQL, CLI, jobs)
│   ├── DATA-MODEL.md          # entities, fields, relations
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
| **Mode** | `preserve` \| `redesign` | Keep the current architecture, or design a fresh one for the same features. |
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

## How the rebuild works

1. Read `00-overview/PRD.md`, `architecture/ARCHITECTURE.md`, `architecture/INTERFACES.md`,
   and `architecture/DATA-MODEL.md`.
2. Follow the dependency-tiered build order in `REBUILD.md`, implementing one
   `features/<slug>/PRD.md` at a time.
3. Use `data/` (and `source/` when present) as ground truth.

**Any stack.** The deterministic scaffold is universal (tree, deps, env, i18n, stack/library
detection, plus *candidate hints* for routes/API/schema/entry points). The framework-aware
depth — mapping the real interface surface and data model — comes from the AI playbook in
[`SKILL.md`](./SKILL.md) + [`references/`](./references), with per-stack cheat-sheets in
[`references/stack-guides/`](./references/stack-guides) (Next.js, Remix, Nuxt, SvelteKit,
Astro, Express/Fastify/Hono, NestJS, Django/Flask/FastAPI, Rails, Laravel, Go, Spring Boot,
tRPC/gRPC, GraphQL, mobile). Adding a stack is adding markdown, not code.

## Development

```bash
npm install
npm run build      # bundles src/ -> scripts/analyze.mjs (committed, zero-dep)
npm test           # vitest unit + integration over multi-stack fixtures
npm run typecheck
```

## Security

The analyzer only **reads** the target repo's filesystem and **copies** files into the
output. It never executes the analyzed project's code. Review `scripts/` before running
on untrusted repositories.

## License

MIT © maxgfr
