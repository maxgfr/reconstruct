---
name: reconstruct
description: 'Use when the user wants to rebuild, recreate, clone, or reverse-engineer an existing repository from scratch, or turn a codebase into specs/PRDs — e.g. "rebuild this project", "reverse engineer this repo", "generate a PRD/spec from this code", "recreate this app". ALSO use for greenfield asks — "build a new project from scratch", "turn my idea into PRDs / a build plan", "design a new app", "greenfield" — where there is no code yet and the facts are elicited through an interview. Works on any stack (JS/TS, Python, Ruby, Go, PHP, Java, mobile…). ALSO brainstorm product directions before building — "brainstorm ideas", "explore concepts", "compare approaches", "what should we build" — a divergent phase that generates several concepts and converges on one. Keywords: reconstruct, rebuild, clone, reverse engineer, from scratch, greenfield, build plan, new project, idea to PRD, brainstorm, ideation, explore concepts, compare approaches.'
license: MIT
metadata:
  version: 2.19.0
---

# Reconstruct: any repo — or any idea — → a buildable PRD suite

A dependency-free Node script does the **deterministic** scaffold (facts + candidate *hints*);
**you** supply the framework-aware understanding — the interface surface, the data model, the
real features — for any stack. The output is a folder of PRDs an agent can rebuild the project
from, with no access to the original and no access to this conversation.

**The markdown is the program.** The engine never reasons; every judgement in this skill is
yours.

## Route the request

| The user wants | Path | Start with | Then read |
| --- | --- | --- | --- |
| Rebuild / clone / reverse-engineer a repo; turn code into specs | **code** | `node scripts/analyze.mjs --repo <REPO> --out <OUT>` | [procedure.md](references/procedure.md) §Path A |
| Turn an idea into PRDs / a build plan (no code yet) | **greenfield** | **interview first** — no command | [scratch-playbook.md](references/scratch-playbook.md), [procedure.md](references/procedure.md) §Path B |
| Decide *what* to build; explore concepts | **brainstorm** | `node scripts/analyze.mjs --brainstorm --out <DIR>` | [brainstorm-playbook.md](references/brainstorm-playbook.md) |
| Continue / refresh a reconstruction that already exists | **resume** | `node scripts/analyze.mjs --check --out <OUT>` | [procedure.md](references/procedure.md) §Path D |
| One file to hand an agent to implement from | **bundle** | `node scripts/analyze.mjs --specs --out <OUT>` (no `--repo`) | [scale-and-context.md](references/scale-and-context.md) §6 |

Use the **absolute path** to `scripts/analyze.mjs` inside the installed skill folder. `--help`
lists every flag. Skip the skill for tiny single-file scripts, or when the user wants a running
app now rather than a plan.

**Inputs to confirm** (code path): target repo · output dir · **mode** `preserve` (keep the
architecture) or `redesign` (same features, fresh architecture) · **level** `light` (faithful) or
`complex` (also suggest improvements) · **fidelity** `mirror`/`embed`/`describe`, derived from
mode+level if unset.

## The pipeline — four phases

```bash
# 1. SCAFFOLD — deterministic, no API key
node scripts/analyze.mjs --repo <REPO> --out <OUT> --mode <MODE> --level <LEVEL>

# 2. ORIENT — SUMMARY.md (~3 KB, written every run), NOT inventory.json (grows with the repo)
#    slice the inventory:  jq '.features[] | {slug, files: (.files|length)}' <OUT>/inventory.json
#    identify the stack → references/stack-guides/INDEX.md maps the label to its guide

# 3. ENRICH — fill INTERFACES.md, DATA-MODEL.md, ARCHITECTURE.md (+ DESIGN-SYSTEM.md for a UI),
#    then every features/<slug>/PRD.md to full spine depth. At scale, fan out:
node scripts/analyze.mjs --orchestrate --out <OUT> --phase enrich-map

# 4. CONVERGE — run to the fixpoint, autonomously, in one go
node scripts/analyze.mjs --check   --out <OUT>              # layer 1: structure
node scripts/analyze.mjs --review  --out <OUT>              # layer 2: worklist (changed units only)
#   → findings.json → --review --apply findings.json --out <OUT>
node scripts/analyze.mjs --verify  --out <OUT>              # faithfulness: requirement↔evidence
#   → verdicts.json → --verify --apply verdicts.json --out <OUT>
node scripts/analyze.mjs --check --semantic --out <OUT>     # the final, fail-closed gate
```

Phase 4 is a **loop**, not a checklist: enrich → check → review → fix → verify → gate, until
`--check --semantic` exits 0. Its rules, ledger fields and stopping conditions are defined once,
in **[convergence-loop.md](references/convergence-loop.md)**. Do not improvise stopping rules.

## Non-negotiables

- **`hints`, `routes` and `i18n` are candidates to verify, never truth.** Open the source and
  confirm. Resolve every entry in `inventory.unknowns`. If `inventory.warnings` is present,
  detection degraded there — check those areas by hand.
- **Every `> 🧠` callout gets resolved and deleted.** One left in place means the unit is not
  done, and `--check` fails.
- **Be exhaustive, never illustrative.** No "etc.", no "and so on", no happy-path-only. If a
  behaviour, role, validation rule or error state exists, it gets its own line.
- **Capture the contract, not the name.** A rate limit without numbers, an enum without its
  member list, a service without its request shape — none of these are buildable. The ten
  categories: [buildability-checklist.md](references/buildability-checklist.md).
- **Many small PRDs beat a few broad ones.** More than ~5–7 stories or ~3 entities in one unit →
  split it. Every distinct capability earns its own PRD.
- **Never re-run the analyzer over an enriched tree** — it re-renders every document. The CLI
  refuses it; to continue an existing tree use `--check`/`--review`/`--verify`, and to
  re-scaffold point `--out` at a new directory.
- **Ground every claim** in `source/`/`data/` (code mode) or `CONTEXT.md`/ADRs (scratch mode). An
  invented fix just trades one finding for another.
- **Never let a cap stay silent.** `--verify` bounds its worklist (60 pairs by default) and a
  large fan-out bounds its agent count. Read `coverage`, report what you actually covered.
- **Own the loop end-to-end.** Run it yourself to the fixpoint — do not hand rounds back, do not
  ask "should I continue?", do not stop at the first pass. **Report once, at the end.**
- **The self-check:** could a fresh agent rebuild this unit *correctly* — contracts right, not
  just the gist — from its PRD + the architecture docs alone? If not, dig further.
  [worked-example.md](references/worked-example.md) is the depth bar.

## Orchestration — route by harness

The judgment phases fan out over independent per-unit worklists. `--orchestrate` emits the
fan-out from `<OUT>`'s **current** worklists, with absolute paths and real unit ids baked in:

```bash
node scripts/analyze.mjs --orchestrate --out <OUT> [--phase enrich-map|review-find|review-verify|adjudicate] [--eco] [--list]
```

| Your harness | How to run each judgment phase |
| --- | --- |
| Codex or another host with subagents | `--orchestrate --phase <p>`; dispatch one subagent per batch following `<OUT>/orchestration/agents/<role>.md`. Subagents return fragments; you perform the single serial merge and run the fold command. |
| Claude Code with the Workflow tool | `--orchestrate --phase <p>`, then launch `<OUT>/orchestration/<p>.workflow.mjs` with `Workflow`. Subagents return fragments; you perform the single serial merge and run the printed fold command. |
| Eco mode, or no subagents | `--orchestrate --eco` → follow `<OUT>/orchestration/RUNBOOK.md` sequentially, playing each role yourself. Correctness-identical; only wall-clock differs. |

Fan-out is an optimization, never a requirement — the gates are harness-independent and every
phase has a sequential fallback with identical artifacts. **Subagents never write:** the reduce
(every doc merge, every `--apply` fold) always stays with you. Never fan out the greenfield
interview, `--brainstorm`, a reduce step, or the scratch build. `--phase <p>` before its worklist
exists exits 2 and names the command that produces it. Protocol:
[orchestration.md](references/orchestration.md); sizing: [scale-and-context.md](references/scale-and-context.md).

## Reference map

**Start here**

| File | Read it when |
| --- | --- |
| [procedure.md](references/procedure.md) | Doing the work — the full step-by-step for all four paths |
| [convergence-loop.md](references/convergence-loop.md) | Phase 4 — the loop, the ledger, when to stop |
| [worked-example.md](references/worked-example.md) | Before writing your first PRD — the depth bar + anti-patterns |
| [troubleshooting.md](references/troubleshooting.md) | Anything fails, refuses, or will not go green |

**Method**

| File | Read it when |
| --- | --- |
| [analysis-playbook.md](references/analysis-playbook.md) | The universal method — works when no stack guide exists |
| [stack-guides/INDEX.md](references/stack-guides/INDEX.md) | **Routing a stack label to its guide — do not guess a filename.** It indexes every cheat-sheet in `references/stack-guides/`, including the no-framework case (library/CLI/SDK) |
| [buildability-checklist.md](references/buildability-checklist.md) | The ten contract categories + the consistency self-review |
| [architecture-analysis.md](references/architecture-analysis.md) | Filling `ARCHITECTURE.md`, especially in `redesign` mode |
| [scale-and-context.md](references/scale-and-context.md) | A big repo, a monorepo, or the run is costing too much context |
| [adapters.md](references/adapters.md) | How `inventory.routes` gets resolved — and how to add a framework |

**Gates**

| File | Read it when |
| --- | --- |
| [ai-review-rubric.md](references/ai-review-rubric.md) | Layer 2 — the nine semantic buildability checks |
| [verify-playbook.md](references/verify-playbook.md) | `--verify` — claims, evidence, verdicts, confidence, **the cap** |
| [orchestration.md](references/orchestration.md) | Fanning enrichment and the review loop across subagents |

**Greenfield & ideation**

| File | Read it when |
| --- | --- |
| [scratch-playbook.md](references/scratch-playbook.md) | The greenfield interview method |
| [scratch-plan-schema.md](references/scratch-plan-schema.md) | Writing `plan.json` — schema + worked example |
| [CONTEXT-FORMAT.md](references/CONTEXT-FORMAT.md) · [ADR-FORMAT.md](references/ADR-FORMAT.md) | Writing the glossary / an ADR |
| [brainstorm-playbook.md](references/brainstorm-playbook.md) | The divergent phase, before anything is decided |

**Output shape**

| File | Read it when |
| --- | --- |
| [prd-light-template.md](references/prd-light-template.md) · [prd-complex-template.md](references/prd-complex-template.md) | The per-level PRD shape |
| [rebuild-instructions.md](references/rebuild-instructions.md) | Telling the user how to drive the rebuild |

## Safety

The analyzer only **reads** the target repo and **copies** files into the output. It never
executes the analyzed project's code. Review `scripts/` before running on untrusted repos.
