---
name: reconstruct
description: Use when the user wants to rebuild, recreate, clone, or reverse-engineer an existing repository from scratch, or turn a codebase into specs/PRDs — e.g. "rebuild this project", "reverse engineer this repo", "generate a PRD/spec from this code", "recreate this app". Keywords: reconstruct, rebuild, clone, reverse engineer, scaffold from existing, migration spec.
license: MIT
metadata:
  version: 0.1.0
---

# Reconstruct: repo → reconstruction PRDs

Turn any repository into a folder of PRDs an AI agent can follow to **rebuild**,
**recreate**, **clone**, or **scaffold** the project from scratch — faithfully and
optionally with improvements. A dependency-free Node script does the **deterministic**
extraction; you (the agent) then **enrich** the PRDs, keeping facts accurate and reasoning
useful.

## When to use

- "Rebuild / recreate / clone / scaffold this project from scratch."
- "Reverse-engineer this repo into a spec / PRDs."
- "Document this codebase so another team or agent can rebuild it."

Skip it for tiny single-file scripts, or when the user wants a running app now, not a plan.

## Inputs to confirm

1. **Target repo** — path to analyze (default: current directory). **Output dir** —
   default `<repo>/reconstruction`.
2. **Mode** — `preserve` (keep current architecture) or `redesign` (same features, fresh
   architecture). Default `preserve`.
3. **Level** — `light` (faithful, minimal editorializing) or `complex` (also suggest
   improvements). Default `light`.
4. **Fidelity** — how real code is carried over: `mirror` (copy files), `embed` (inline
   key code), `describe` (text only). If unset, derived from mode+level:
   preserve+light→mirror, preserve+complex→embed, redesign+light→embed,
   redesign+complex→describe.

## Procedure

1. **Run the analyzer** (deterministic, no API key). Use the absolute path to
   `scripts/analyze.mjs` inside the installed skill folder:

   ```bash
   node scripts/analyze.mjs --repo <REPO> --out <OUT> --mode <MODE> --level <LEVEL> [--fidelity <F>]
   ```

   Add `--json` to inspect the raw inventory without writing files; `--help` for all flags.

2. **Read the output:** `<OUT>/inventory.json`, `<OUT>/00-overview/PRD.md`,
   `<OUT>/architecture/ARCHITECTURE.md`, and each `<OUT>/features/<slug>/PRD.md`. Each PRD
   flags what to fill in: `_italic placeholders_` (e.g. `_Describe what this unit must
   do…_`) in **light** level, and `> 🧠 **For the AI agent:**` callouts in
   **complex**/**redesign**. Resolve them all.

3. **Enrich the PRDs** by editing the generated Markdown:
   - Always: write the product summary in `00-overview/PRD.md`; turn each feature's source
     material into concrete, testable functional requirements.
   - If **level=complex**: add "Improvements & refactors" (tag items `[keep-behavior]`
     unless the user opts into behavior changes).
   - If **mode=redesign**: design the new architecture in `architecture/ARCHITECTURE.md`
     and fill each feature's "Redesign notes".

4. **Finalize `REBUILD.md`:** confirm the build order and validation checklist, then tell
   the user how to drive the rebuild — feed feature PRDs to an agent one by one, using
   `data/` and `source/` as ground truth.

See `references/` for the reasoning checklists (`architecture-analysis.md`,
`rebuild-instructions.md`) and the target shape of an enriched PRD
(`prd-light-template.md`, `prd-complex-template.md`).

## How to know you're done

- `inventory.json` lists files, routes, i18n, and features.
- Every `features/<slug>/PRD.md` has its fill-in markers resolved (italic placeholders in
  light; `🧠` callouts in complex/redesign).
- `REBUILD.md` has a concrete build order and validation checklist.
- Translations, schema, and config sit under `data/` (verbatim).

## Failure modes

| Symptom | What to do |
| --- | --- |
| No features detected | Repo is likely flat — group by top-level folders manually, note it in the overview. |
| Wrong framework/routes | Adapters cover JS/TS/Next.js deeply, other stacks generically — fill gaps from the file list in `inventory.json`. |
| Huge repo | Run `--json` first to scope, then prefer `--level light` + `--fidelity mirror` to reference files instead of embedding them. |

## Safety

The analyzer only **reads** the target repo's filesystem and **copies** files into the
output. It never executes the analyzed project's code. Review `scripts/` before running on
untrusted repositories.
