---
name: reconstruct
description: Use when the user wants to rebuild, recreate, clone, or reverse-engineer an existing repository from scratch, or turn a codebase into specs/PRDs — e.g. "rebuild this project", "reverse engineer this repo", "generate a PRD/spec from this code", "recreate this app". Works on any stack (JS/TS, Python, Ruby, Go, PHP, Java, mobile…). Keywords: reconstruct, rebuild, clone, reverse engineer, scaffold from existing, migration spec.
license: MIT
metadata:
  version: 0.2.0
---

# Reconstruct: repo → reconstruction PRDs

Turn any repository into a folder of PRDs an AI agent can follow to **rebuild**,
**recreate**, **clone**, or **scaffold** the project from scratch — faithfully and
optionally with improvements. A dependency-free Node script does the **deterministic**
scaffold (facts + candidate *hints*); you (the agent) supply the **framework-aware
understanding** — the interface surface, the data model, and the real features — for
**any** stack. The deterministic scaffold is universal; **the markdown is the program.**

## When to use

- "Rebuild / recreate / clone / scaffold this project from scratch."
- "Reverse-engineer this repo into a spec / PRDs."
- "Document this codebase so another team or agent can rebuild it."

Skip it for tiny single-file scripts, or when the user wants a running app now, not a plan.

## Inputs to confirm

1. **Target repo** (default: current dir) and **output dir** (default `<repo>/reconstruction`).
2. **Mode** — `preserve` (keep architecture) or `redesign` (same features, fresh architecture). Default `preserve`.
3. **Level** — `light` (faithful) or `complex` (also suggest improvements). Default `light`.
4. **Fidelity** — `mirror` / `embed` / `describe`. If unset, derived from mode+level.

## Procedure

1. **Run the analyzer** (deterministic, no API key). Use the absolute path to
   `scripts/analyze.mjs` inside the installed skill folder:

   ```bash
   node scripts/analyze.mjs --repo <REPO> --out <OUT> --mode <MODE> --level <LEVEL> [--fidelity <F>] [--granularity coarse|fine]
   ```

   Add `--json` to inspect the raw inventory first; `--help` for all flags
   (`--include`/`--exclude` globs scope large repos).

2. **Read the scaffold:** `inventory.json` (facts **+ `hints` + `unknowns`**),
   `00-overview/PRD.md`, `architecture/ARCHITECTURE.md`, the **`architecture/INTERFACES.md`**
   and **`architecture/DATA-MODEL.md`** skeletons, and each `features/<slug>/PRD.md`.
   Treat `routes`/`i18n` and everything under `hints` as **candidates to verify**, not truth.

3. **Identify the stack & load its guide.** Read `inventory.stack`. If a
   `references/stack-guides/<stack>.md` matches, read it; otherwise use the generic method
   in `references/analysis-playbook.md`. For monorepos (`inventory.workspaces`), analyze
   per workspace.

4. **Map the interface surface** → fill **`architecture/INTERFACES.md`**. Enumerate *every*
   HTTP route, endpoint, tRPC/gRPC procedure, GraphQL operation, CLI command, and job —
   method · path/operation · handler file. Start from `hints.routeCandidates`/`apiCandidates`,
   then **read the source** to confirm. Cover the stack's real paradigm, not just file-based
   routing. See `references/analysis-playbook.md` (§Interface surface).

5. **Extract the data model** → fill **`architecture/DATA-MODEL.md`**. List entities/tables,
   key fields + types, relations, and indexes from the ORM/schema in `hints.schemaCandidates`
   (raw copies in `data/schema/`). See the playbook (§Data model).

6. **Group features semantically.** Turn the path-based feature skeleton into real product
   features: rename, merge trivial ones, and link each feature to its interfaces, data, and
   components. See the playbook (§Features).

7. **Enrich each `features/<slug>/PRD.md`** (as today): write the product summary in
   `00-overview/PRD.md`, turn source material into concrete, testable requirements, and
   reference `INTERFACES.md`/`DATA-MODEL.md`. Resolve every `_italic placeholder_` (light)
   and `> 🧠` callout (complex/redesign). Add "Improvements & refactors" if `level=complex`;
   design the new architecture if `mode=redesign`.

8. **Finalize `REBUILD.md`:** confirm the dependency-tiered build order and validation
   checklist, then tell the user how to drive the rebuild (feed feature PRDs to an agent one
   by one, using `data/` and `source/` as ground truth).

See `references/analysis-playbook.md` for the universal methodology, `references/stack-guides/`
for per-stack cheat-sheets, and `references/architecture-analysis.md` /
`references/rebuild-instructions.md` / the PRD templates for the reasoning checklists.

## How to know you're done

- `INTERFACES.md` lists the **whole** interface surface; `DATA-MODEL.md` lists every entity.
- Every `features/<slug>/PRD.md` has its fill-in markers resolved; features are semantic.
- Every item in `inventory.json.unknowns` is resolved.
- `REBUILD.md` has a dependency-ordered build order + validation checklist; `data/` holds
  translations, schema, and config verbatim.

## Safety

The analyzer only **reads** the target repo and **copies** files into the output. It never
executes the analyzed project's code. Review `scripts/` before running on untrusted repos.
