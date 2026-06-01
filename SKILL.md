---
name: reconstruct
description: Use when the user wants to analyze an existing repository and generate reconstruction PRDs to rebuild a project from scratch. Produces an inventory plus one PRD per feature, with preserve/redesign architecture modes and light/complex levels. Trigger on "rebuild this project", "reverse engineer this repo", "generate PRDs from this codebase", "recreate this app from scratch".
license: MIT
metadata:
  version: 0.1.0
---

# Reconstruct: repo → reconstruction PRDs

Turn any repository into a folder of PRDs that an AI agent can follow to rebuild
the project from scratch — faithfully (logic, routes, translations, schema, config)
and, optionally, with improvements.

A bundled, dependency-free Node script does the **deterministic** extraction. You
(the agent) then **enrich** the generated PRDs. This split keeps facts accurate and
reasoning useful.

## When to use

- "Rebuild / recreate / clone this project from scratch."
- "Reverse-engineer this repo into a spec / PRDs."
- "Document this codebase so another team (or agent) can rebuild it."

## When NOT to use

- Tiny single-file scripts (just read the file).
- The user wants a running app right now, not a plan.

## Inputs to confirm with the user

1. **Target repo** — path to analyze (default: current directory).
2. **Mode** — `preserve` (keep the current architecture) or `redesign` (same
   features, fresh architecture). Default `preserve`.
3. **Level** — `light` (faithful, minimal editorializing) or `complex` (also
   suggest improvements / let you improve the code). Default `light`.
4. **Fidelity** — how real code is carried over: `mirror` (copy files), `embed`
   (inline key code), `describe` (text only). If unset, it is derived:
   `preserve+light→mirror`, `preserve+complex→embed`, `redesign+light→embed`,
   `redesign+complex→describe`.
5. **Output dir** — default `<repo>/reconstruction`.

## Procedure

1. **Run the analyzer** (deterministic, no API key). From this skill's directory:

   ```bash
   node scripts/analyze.mjs --repo <REPO> --out <OUT> --mode <MODE> --level <LEVEL> [--fidelity <F>]
   ```

   Use the absolute path to `scripts/analyze.mjs` inside the installed skill folder.
   Add `--json` to inspect the raw inventory without writing files.

2. **Read the output.** Open `<OUT>/inventory.json`, `<OUT>/00-overview/PRD.md`,
   `<OUT>/architecture/ARCHITECTURE.md`, and each `<OUT>/features/<slug>/PRD.md`.
   Each PRD contains `> 🧠 For the AI agent:` callouts marking exactly what to fill in.

3. **Enrich the PRDs** by editing the generated Markdown:
   - Always: write the product summary in `00-overview/PRD.md`; turn each feature's
     source material into concrete, testable functional requirements.
   - If **level=complex**: add the "Improvements & refactors" sections (mark items
     `[keep-behavior]` unless the user opts into behavior changes).
   - If **mode=redesign**: design the new architecture in
     `architecture/ARCHITECTURE.md` and fill each feature's "Redesign notes".

4. **Finalize `REBUILD.md`**: confirm the build order and validation checklist, then
   tell the user how to drive the rebuild (feed feature PRDs to an agent one by one,
   using `data/` and `source/` as ground truth).

See `references/architecture-analysis.md` and `references/rebuild-instructions.md`
for the reasoning checklists, and `references/prd-light-template.md` /
`references/prd-complex-template.md` for the target shape of an enriched PRD.

## How to know you're done

- `inventory.json` exists and lists files, routes, i18n, and features.
- Every `features/<slug>/PRD.md` has its agent callouts resolved (no `🧠` left
  unaddressed for the chosen level/mode).
- `REBUILD.md` has a concrete build order and validation checklist.
- Translations/schema/config are present under `data/` (verbatim).

## Failure modes

- **No features detected** → the repo may be flat; group by top-level folders
  manually and note it in the overview.
- **Wrong framework/routes** → adapters cover JS/TS/Next.js deeply and other stacks
  generically; fill route/feature gaps from the file list in `inventory.json`.
- **Huge repo** → run with `--json` first to scope, then prefer `--level light` and
  `--fidelity mirror` so you reference files instead of embedding them.

## Safety

The analyzer only **reads** the target repository's filesystem and **copies** files
into the output. It never executes the analyzed project's code. Review `scripts/`
before running on untrusted repositories.
