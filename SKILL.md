---
name: reconstruct
description: 'Use when the user wants to rebuild, recreate, clone, or reverse-engineer an existing repository from scratch, or turn a codebase into specs/PRDs — e.g. "rebuild this project", "reverse engineer this repo", "generate a PRD/spec from this code", "recreate this app". ALSO use for greenfield asks — "build a new project from scratch", "turn my idea into PRDs / a build plan", "design a new app", "greenfield" — where there is no code yet and the facts are elicited through an interview. Works on any stack (JS/TS, Python, Ruby, Go, PHP, Java, mobile…). Keywords: reconstruct, rebuild, clone, reverse engineer, scaffold from existing, migration spec, from scratch, greenfield, build plan, new project, idea to PRD.'
license: MIT
metadata:
  version: 0.11.0
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
- **Greenfield** — "build me a new project from scratch", "turn my idea into a build plan /
  PRDs", "design a new app". There is no code yet: interview the user, then render the same
  tree. → jump to [**From scratch**](#from-scratch).

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
   node scripts/analyze.mjs --repo <REPO> --out <OUT> --mode <MODE> --level <LEVEL> [--fidelity <F>] [--granularity coarse|fine] [--merge] [--features] [--specs] [--summary]
   ```

   Add `--json` to inspect the raw inventory first; `--help` for all flags
   (`--include`/`--exclude` globs scope large repos). `--merge`/`--features`/`--specs`/`--summary`
   are optional bundles — see **Bundling the output** below.

2. **Read the scaffold:** `inventory.json` (facts **+ `hints` + `unknowns`**),
   `00-overview/PRD.md`, `architecture/ARCHITECTURE.md`, the **`architecture/INTERFACES.md`**
   and **`architecture/DATA-MODEL.md`** skeletons, and each `features/<slug>/PRD.md`.
   Treat `routes`/`i18n` and everything under `hints` as **candidates to verify**, not truth.

3. **Identify the stack & load its guide.** Read `inventory.stack`. If a
   `references/stack-guides/<stack>.md` matches, read it; otherwise use the generic method
   in `references/analysis-playbook.md`. For monorepos (`inventory.workspaces` — each entry
   carries its own `stack`, `dependencies`, `dependsOn`, `routeCount`, and `hints`), read
   `references/stack-guides/monorepo.md` and load the matching stack guide *per workspace*;
   verify the manifest-derived `dependsOn` graph and extend it with implicit edges. If the
   engine detected no workspaces but the layout looks like a monorepo (several apps/services
   with their own manifests), identify the workspaces yourself and scope re-runs with
   `--include '<dir>/**'`.

4. **Map the interface surface** → fill **`architecture/INTERFACES.md`**. Enumerate *every*
   HTTP route, endpoint, tRPC/gRPC procedure, GraphQL operation, CLI command, and job —
   method · path/operation · handler file. Start from `hints.routeCandidates`/`apiCandidates`,
   then **read the source** to confirm. Cover the stack's real paradigm, not just file-based
   routing. `hints.realtimeCandidates` points at WebSocket/SSE surfaces (enumerate their
   channels, events, and message shapes — they rarely appear in route tables);
   `hints.authCandidates` points at the guards/middleware that carry each operation's auth
   rule. For each operation capture the **contract**: exact input shape, output shape,
   auth rule, and side effects (which entities it writes, transactional or not). See
   `references/analysis-playbook.md` (§Interface surface, §Contracts & buildability).

5. **Extract the data model** → fill **`architecture/DATA-MODEL.md`**. List entities/tables,
   key fields + types, relations, indexes, and unique constraints from the ORM/schema in
   `hints.schemaCandidates` (raw copies in `data/schema/`), and fill the **`## Enums & domain
   types`** section with the *complete* member list of every enum/status/role set. Then fill
   the **`architecture/ARCHITECTURE.md`** contract sections — **External services &
   integrations** (provider, request/response, timeout, failure), **Cross-cutting policies**
   (rate limits and format validations, quantified), and the i18n message catalog. See the
   playbook (§Data model, §Contracts & buildability) and `references/buildability-checklist.md`.

6. **Group features semantically — and keep them small.** Turn the path-based skeleton into real
   product features; rename and merge truly trivial ones, but **prefer many focused features over
   a few broad ones**: if a unit carries more than ~5–7 user stories or touches more than ~3
   entities, **split it**. Every distinct capability earns its own PRD. Link each feature to its
   interfaces, data, and components. See the playbook (§Features).

7. **Turn every `features/<slug>/PRD.md` into a complete PRD.** Each one ships with a fixed spine —
   *Context & goal · User stories · Functional requirements · Interfaces & data · Acceptance
   criteria · Edge cases & failure modes · Definition of done* (plus *Test plan* under `--tdd`,
   and *Improvements/Enhancements* at `complex`). **Resolve every `> 🧠` callout exhaustively and
   delete it:** enumerate every actor and story, number every requirement, write Given/When/Then
   for each (including the failure paths), and list every edge case. A 🧠 callout left in place
   means the unit is **not done**. Also write the product summary in `00-overview/PRD.md` and
   cross-reference `INTERFACES.md`/`DATA-MODEL.md`.

8. **Finalize `REBUILD.md`:** confirm the dependency-tiered build order and validation
   checklist, then tell the user how to drive the rebuild (feed feature PRDs to an agent one
   by one, using `data/` and `source/` as ground truth).

9. **Validate buildability — two layers, both must pass.**

   - **Layer 1 — the deterministic gate (structure).** Run the consistency self-review (every
     feature's entities/operations/enums/locales resolve against the architecture docs; every
     write is satisfiable; anonymous writes target anonymous-capable entities), then run:

     ```bash
     node scripts/analyze.mjs --check --out <OUT>
     ```

     It exits non-zero on: a **missing required document** (`REBUILD.md`, `00-overview/PRD.md`,
     or any of the three architecture docs); unresolved `🧠` callouts or `fill this in`
     placeholders; a feature PRD **missing a spine section or leaving one empty** (a heading with
     no content); or an architecture doc **emptied of its contract** (no entities in
     `DATA-MODEL.md`, no operations in `INTERFACES.md`). On the **scratch path** it additionally
     enforces reference integrity — a feature must not reference an entity/operation absent from
     the architecture docs (on the code path the inventory carries no `dataModel`/`interfaces`, so
     the contract-substance check above is the operative gate instead). An uncovered locale is a
     warning. Fix every error and resolve the warnings. See `references/buildability-checklist.md`.

   - **Layer 2 — the AI review (substance).** The gate proves structure but cannot judge
     whether the prose is *actually buildable*. Once `--check` passes, **you (the agent) run a
     semantic self-review** against `references/ai-review-rubric.md` — story completeness,
     testable requirements, real Given/When/Then (incl. failure paths), satisfiable write
     contracts, enum fidelity, cross-doc consistency, faithfulness, i18n, and the decisive
     rebuild self-test. This runs *via the skill* (no API key, no `--ai` flag — the model is
     the reviewer); for a large tree, fan it out one reviewer per feature. A unit is done when
     it has **zero blockers**. Fix blockers in place, re-run `--check`, repeat until clean.

10. **Run the convergence loop — autonomously, to completion.** A reconstruction is not done
    when the scaffold is filled; it is done when it **converges** to buildable. **You own this
    loop end-to-end: run it yourself, to the fixpoint, in one go.** Do not hand rounds back to
    the user, do not ask "should I continue?", and do not stop at the first pass — the user
    invokes the skill once and expects a finished, buildable tree out the other side. Iterate
    both layers until the tree is clean — this loop is what turns "PRDs exist" into "a fresh
    agent rebuilds the right software":

    ```
    repeat:
      a. enrich (or fix) the units                         # write/repair the prose
      b. node scripts/analyze.mjs --check --out <OUT>      # Layer 1: structure
         └─ if errors → fix them → go to (b)
      c. AI review every NEW-or-CHANGED unit               # Layer 2: substance
         per references/ai-review-rubric.md
      d. fix every blocker (then majors) in place
    until  --check passes  AND  the AI review reports ZERO blockers across all units
    ```

    Rules that make the loop terminate on a *correct* fixpoint, not a false one:
    - **A finding is resolved only when a fresh reviewer confirms it** — keep the reviewer
      separate from the author (an adversarial reviewer prompted to *refute* buildability), and
      after each fix **re-review the changed unit**, don't self-certify.
    - **Only re-review what changed** each round (plus anything a fix touched downstream), so the
      loop shrinks instead of re-scanning a clean tree.
    - **Ground every fix in source/`data/` (code mode) or `CONTEXT.md`/ADRs (scratch mode)** — a
      fix that invents behaviour just trades one finding for another; faithfulness is the anchor.
    - **Stop at zero blockers, not zero findings.** Blockers gate "buildable"; majors are
      worth fixing, minors are optional polish — record what you deliberately leave.
    - If the loop is not shrinking (the same finding keeps reappearing), the contract in the
      architecture docs is wrong, not the feature PRD — fix `INTERFACES.md`/`DATA-MODEL.md` first.

    At scale, drive the loop with parallel agents — one finder/fixer + one independent verifier
    per feature — and keep looping until a full review round adds nothing new. **Terminate
    deterministically:** stop when `--check` passes and a whole review round yields zero
    blockers (the fixpoint), or when two consecutive rounds make no progress on the *same*
    residual findings — at which point fix the upstream architecture contract those findings
    share, or, if a finding is a faithful property of the original (a real bug you're preserving),
    record it explicitly rather than looping on it. Bound the rounds (e.g. ≤ 5) so a pathological
    unit can't spin forever. **Report once, at the end** — the final `--check` result, the
    zero-blocker confirmation, and anything you deliberately left (majors/minors, preserved
    quirks). The user should relaunch nothing; one skill invocation goes scaffold → buildable.

See `references/analysis-playbook.md` for the universal methodology, `references/stack-guides/`
for per-stack cheat-sheets, `references/buildability-checklist.md` for the nine contract
categories + the `--check` gate, `references/ai-review-rubric.md` for the layer-2 AI semantic
review, and `references/architecture-analysis.md` / `references/rebuild-instructions.md` / the
PRD templates for the reasoning checklists.

## Everything is a PRD — dig until done

The output is a **PRD suite**, and the markdown is the program. Optimize for depth, not coverage:

- **Every feature is a full PRD.** Fill the whole spine — user stories, numbered functional
  requirements, interface & data contracts, Given/When/Then acceptance criteria, edge cases &
  failure modes, and a definition of done. An unanswered `> 🧠` callout is an unfinished PRD.
- **Be exhaustive, never illustrative.** No "etc.", no "and so on", no happy-path-only. If a
  behaviour, role, validation rule, or error state exists, it gets its own line.
- **Plein de PRD.** Prefer many small, focused feature PRDs over a few broad ones — one per
  distinct capability. Splitting is cheaper than a vague mega-PRD.
- **The self-check:** could a fresh agent rebuild this unit from its PRD alone — no access to the
  original product, no access to this conversation? If not, dig further.

## From scratch

When there is **no repo** — the user wants to turn an idea into a build plan — elicit the facts
through an interview and converge on the **same reconstruction tree**. Greenfield collapses two
axes: mode is always `scratch` (nothing to preserve) and fidelity is forced to `describe` (no
source to mirror); `--level` still applies (`light` = the MVP as described, `complex` = a deeper
interview that also proposes alternatives, enhancements, and more ADRs).

1. **Interview the user** per `references/scratch-playbook.md` — a grill-with-docs walk:
   relentless, one question at a time, recommending an answer each time; sharpen fuzzy terms into
   a canonical glossary; invent concrete scenarios to probe entity/feature boundaries.

2. **Write `CONTEXT.md` + ADRs as decisions crystallize.** Capture the glossary inline in
   `CONTEXT.md` (format: `references/CONTEXT-FORMAT.md`) and offer an ADR under `docs/adr/` only
   when a decision is hard to reverse **and** surprising **and** a real trade-off
   (format: `references/ADR-FORMAT.md`). These live in `<OUT>` and the engine will not clobber
   them.

3. **Write `plan.json`** — the structured output of the interview, mapping 1:1 onto the inventory.
   Capture the full contract surface so the from-scratch tree is as buildable as the
   reverse-engineered one: `dataModel` (with `enumRef`, indexes, uniques), `enums` (full member
   lists), `interfaces` (with input/output/sideEffects), `services`, `policies`, the
   `i18n.messages` catalog, and each `feature.writes`. Schema + worked example:
   `references/scratch-plan-schema.md`. The plan must be **internally consistent** — the engine
   rejects dangling references and warns on anonymous writes to owner-FK tables.

4. **Render the tree** with the deterministic engine (it scaffolds the PRDs and pre-fills the
   `INTERFACES.md` / `DATA-MODEL.md` / enums / services / policies / message-catalog sections
   from the plan, and **validates the plan's consistency first**; add `--tdd` for a test-first
   build):

   ```bash
   node scripts/analyze.mjs --scratch --plan plan.json --out <OUT> --level <light|complex> [--tdd]
   ```

5. **Enrich/author the prose — to full PRD depth.** Fill each `features/<slug>/PRD.md` and the
   architecture docs from the interview + `CONTEXT.md` + ADRs as ground truth. Complete the whole
   PRD spine (see [**Everything is a PRD**](#everything-is-a-prd--dig-until-done)): exhaustive user
   stories, numbered functional requirements, interface & data contracts, Given/When/Then
   acceptance criteria, edge cases, and a definition of done — **resolve every `> 🧠` callout and
   delete it**. Turn the pre-filled tables into a complete interface surface and data model, and
   finalize `REBUILD.md`'s tiered order. If `--tdd`, each unit is built test-first (red → green →
   refactor). Finally, run the gate — `node scripts/analyze.mjs --check --out <OUT>` — and the
   consistency self-review; both must be clean (see `references/buildability-checklist.md`).

## Bundling the output

Four optional, combinable flags collapse the multi-file tree for sharing or review:

- **`--merge`** → `RECONSTRUCTION.md`: the whole tree in one coherent markdown
  (single H1, linked table of contents, every document with headings demoted one
  level, ordered overview → architecture → features → build order).
- **`--features`** → `FEATURES.md`: every feature PRD only — the product
  functionality — in build order, in one file (single H1 + linked table of
  contents, headings demoted one level). The features-only counterpart to
  `--merge`; skips the overview, architecture and build-order docs.
- **`--specs`** → `SPECS.md`: the **same whole tree as `--merge`** (overview,
  architecture — interfaces & data model —, every feature PRD, build order) but
  with each document's `## Source material` section (the embedded original source
  code) stripped. Self-sufficient (it carries the contracts the feature PRDs
  reference) yet code-free — the single file to hand an agent to **implement
  from**.
- **`--summary`** → `SUMMARY.md`: a one-page digest from the inventory (stack,
  libraries, size, features in build order, interface/data counts, locales,
  unknowns, next steps).

They work two ways:

1. **Inline** — add them to a normal run; the file(s) land in `<OUT>` alongside the tree.
2. **Standalone post-step** — run them **without `--repo`** against an already-generated
   output to (re)build just the bundles, no re-analysis:

   ```bash
   node scripts/analyze.mjs --merge --features --specs --summary --out <OUT>
   ```

   This reads `<OUT>/inventory.json` + the `.md` files and rewrites the bundle(s);
   it errors clearly if `<OUT>` holds no `inventory.json`. Re-running is idempotent.

## How to know you're done

- `INTERFACES.md` lists the **whole** interface surface, each with its input/output/side-effect
  contract; `DATA-MODEL.md` lists every entity with field-level types and constraints, and
  every enum with its **complete** member list.
- **Every contract category is captured, not just named** — operation contracts, write
  contracts (every required column/FK has a source; anonymous writes use anonymous-capable
  entities), enums, format validations, external services, quantified policies, and the i18n
  message catalog. The nine categories are in `references/buildability-checklist.md`.
- **Every `features/<slug>/PRD.md` is a complete PRD** — the full spine is filled (user stories,
  numbered requirements, interface & data contracts, Given/When/Then acceptance criteria, edge
  cases, definition of done), and **no `> 🧠` callout or `_placeholder_` remains** anywhere.
- Features are semantic and granular — distinct capabilities are separate PRDs, not lumped.
- Every item in `inventory.json.unknowns` is resolved.
- `REBUILD.md` has a dependency-ordered build order + validation checklist; `data/` holds
  translations, schema, and config verbatim (code mode).
- **Layer 1 — the gate passes:** `node scripts/analyze.mjs --check --out <OUT>` reports no
  errors, and the consistency self-review is clean.
- **Layer 2 — the AI review passes:** every unit has **zero blockers** against
  `references/ai-review-rubric.md` (the agent's semantic pass — substance, not just structure).
- **The self-check passes:** a fresh agent could rebuild each unit *correctly* — getting the
  contracts right, not just the gist — from its PRD + the architecture docs alone.

## Safety

The analyzer only **reads** the target repo and **copies** files into the output. It never
executes the analyzed project's code. Review `scripts/` before running on untrusted repos.
