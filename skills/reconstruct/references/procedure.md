# Procedure — the full method, step by step

`SKILL.md` routes and states the pipeline in four phases. This file is the detailed version of
those phases: what to run, what to read, what to fill, and in what order. Read it once you know
which path you are on.

Paths: **[code](#path-a--an-existing-repo)** · **[greenfield](#path-b--from-scratch-greenfield)**
· **[brainstorm](#path-c--brainstorm-the-divergent-phase)** ·
**[resume / refresh](#path-d--resume-or-refresh-an-existing-tree)**

---

## Path A — an existing repo

### 1. Confirm the inputs

| Input | Default | Notes |
| --- | --- | --- |
| Target repo | current dir | |
| Output dir | `<repo>/reconstruction` | must **not** be an already-enriched tree |
| **Mode** | `preserve` | `preserve` keeps the architecture; `redesign` = same features, fresh architecture |
| **Level** | `light` | `light` faithful; `complex` also proposes improvements |
| **Fidelity** | derived | `mirror` / `embed` / `describe` — see [scale-and-context.md](./scale-and-context.md) §2 |

### 2. Run the analyzer (deterministic, no API key)

Use the absolute path to `scripts/analyze.mjs` inside the installed skill folder:

```bash
node scripts/analyze.mjs --repo <REPO> --out <OUT> --mode <MODE> --level <LEVEL> \
  [--fidelity <F>] [--granularity coarse|fine] [--include '<glob>'] [--exclude '<glob>'] \
  [--tdd] [--merge] [--features] [--specs]
```

`--help` lists every flag. `--json` prints the inventory and writes nothing.

### 3. Orient — cheaply

Read **`SUMMARY.md`** (written on every run) for stack, features in build order, counts and
unknowns. Then read the scaffolds you are about to fill: `00-overview/PRD.md`,
`architecture/ARCHITECTURE.md`, `architecture/INTERFACES.md`, `architecture/DATA-MODEL.md`, and
— for a UI product — `architecture/DESIGN-SYSTEM.md`, plus each `features/<slug>/PRD.md`.

**Slice `inventory.json` with `jq`; do not read it whole** — it carries one entry per analyzed
file and grows linearly with the repo ([scale-and-context.md](./scale-and-context.md) §1).

Two things to internalise before writing anything:

- **`routes`, `i18n` and everything under `hints` are candidates to verify, not truth.** Open
  the source and confirm.
- **`inventory.warnings`** (a malformed manifest, a workspace dependency cycle) means detection
  degraded there — verify those areas by hand rather than trusting the empty defaults.

### 4. Identify the stack and load its guide

Read `inventory.stack`, then look the label up in
**[stack-guides/INDEX.md](./stack-guides/INDEX.md)** — the filenames deliberately do not match
the labels one-to-one. No guide matches? The universal method in
[analysis-playbook.md](./analysis-playbook.md) works without one. No framework at all? That is
its own first-class case: [stack-guides/library-cli-sdk.md](./stack-guides/library-cli-sdk.md).

**Monorepo** (`inventory.workspaces` non-empty): read
[stack-guides/monorepo.md](./stack-guides/monorepo.md) and load the matching guide *per
workspace* — each entry carries its own `stack`, `dependencies`, `dependsOn`, `routeCount` and
`hints`. Verify the manifest-derived `dependsOn` graph and extend it with the **implicit edges**
manifests cannot see:

- HTTP base-URLs pointing at a sibling app,
- queue/event topics one workspace publishes and another consumes,
- env vars consumed by two or more workspaces,
- generated API clients.

Cross-check the finished graph against `architecture/diagram.md` and `REBUILD.md`'s tier order.
Heed the `workspace dependency cycle` warning: a cycle demotes the build order to path order —
break it, or document the bootstrap order in `REBUILD.md`.

For a deep dive into one workspace, re-run **scoped, into its own output directory**:

```bash
node scripts/analyze.mjs --repo <REPO> --include '<workspace-dir>/**' --out <OUT>-<workspace>
```

> Never point a fresh analyzer run at an enriched `<OUT>` — it re-renders every document. The
> CLI refuses it; see [Path D](#path-d--resume-or-refresh-an-existing-tree).

If the engine detected no workspaces but the layout looks like a monorepo, identify them
yourself and scope runs the same way.

### 5. Map the interface surface → `architecture/INTERFACES.md`

Enumerate **every** HTTP route, endpoint, tRPC/gRPC procedure, GraphQL operation, CLI command
and job — method · path/operation · handler file. Start from
`hints.routeCandidates`/`apiCandidates`, then **read the source** to confirm. Cover the stack's
real paradigm, not just file-based routing.

- `hints.realtimeCandidates` points at WebSocket/SSE surfaces — enumerate their channels,
  events and message shapes; they rarely appear in route tables.
- `hints.authCandidates` points at the guards/middleware carrying each operation's auth rule.

For each operation capture the **contract**: exact input shape, output shape, auth rule, and
side effects (which entities it writes, transactional or not). See
[analysis-playbook.md](./analysis-playbook.md) §Interface surface and §Contracts & buildability.

### 6. Extract the data model → `architecture/DATA-MODEL.md`

List entities/tables with key fields + types, relations, indexes and unique constraints from the
ORM/schema in `hints.schemaCandidates` (raw copies live in `data/schema/`). Fill
**`## Enums & domain types`** with the *complete* member list of every enum/status/role set.

Then fill the `architecture/ARCHITECTURE.md` contract sections:

- **External services & integrations** — provider, exact request/response shape and function
  signatures, timeout, failure behaviour.
- **Cross-cutting policies** — rate limits and format validations, **quantified**.
- The **i18n message catalog**.

**For a UI product**, fill `architecture/DESIGN-SYSTEM.md` from
`hints.designSystemCandidates` — design tokens with their *exact values*, theming (light/dark),
typography, breakpoints, iconography, motion, the component-library contract (variants +
states), and the accessibility target. It self-degrades to a stub when there is no UI.

See [buildability-checklist.md](./buildability-checklist.md) for the ten contract categories.

### 7. Group features semantically — and keep them small

Turn the path-based skeleton into real product features. Rename and merge truly trivial ones,
but **prefer many focused features over a few broad ones**: more than ~5–7 user stories or more
than ~3 entities in one unit means **split it**.

**Split** when a unit serves two disjoint actor sets (admin vs end-user), when its route
clusters share no interface rows or entities, when its halves could ship independently in either
order, or when its honest name needs an "and".

**Merge** into a neighbour (or Core) when it has a single story with no entity or route of its
own, or is pure glue (re-exports, wiring). Config-only groups fold into project-setup.

Every distinct capability earns its own PRD. Link each feature to its interfaces, data and
components.

### 8. Turn every `features/<slug>/PRD.md` into a complete PRD

Each ships with a fixed spine — *Context & goal · User stories · Functional requirements ·
Interfaces & data · Acceptance criteria · Edge cases & failure modes · Definition of done* (plus
*Test plan* under `--tdd`, and *Improvements/Enhancements* at `complex`).

**Resolve every `> 🧠` callout exhaustively and delete it.** Enumerate every actor and story,
number every requirement, write Given/When/Then for each **including the failure paths**, and
list every edge case. A `🧠` left in place means the unit is **not done**.

Also write the product summary in `00-overview/PRD.md` and cross-reference
`INTERFACES.md`/`DATA-MODEL.md`.

**[worked-example.md](./worked-example.md) is the depth bar** — a filled PRD, shallow-vs-deep in
parallel, plus the anti-pattern catalogue. Read it before writing your first PRD, not after.

At scale, run steps 5–8 as the map-reduce in [orchestration.md](./orchestration.md): one
drafting agent per feature (each reads its `files` + `hints` and **returns** interface/entity row
proposals), then a single serial **reduce** that merges them into the canonical
`INTERFACES.md`/`DATA-MODEL.md`, deduping and reconciling conflicts against source. The engine
emits the fan-out ready to launch:

```bash
node scripts/analyze.mjs --orchestrate --out <OUT> --phase enrich-map
```

### 9. Finalize `REBUILD.md`

Confirm the dependency-tiered build order and the validation checklist, then tell the user how
to drive the rebuild (feed feature PRDs to an agent one by one, using `data/` and `source/` as
ground truth — [rebuild-instructions.md](./rebuild-instructions.md)).

### 10. Converge

Run the loop in **[convergence-loop.md](./convergence-loop.md)** to the fixpoint, autonomously,
in one go. Both layers, both semantic ledgers, then the fail-closed final gate. That file is the
single source of truth for termination; do not improvise stopping rules.

---

## Path B — from scratch (greenfield)

No repo: elicit the facts through an interview and converge on the **same** reconstruction tree.
Greenfield collapses two axes — mode is always `scratch` and fidelity is forced to `describe`.
`--level` still applies (`light` = the MVP as described; `complex` = a deeper interview that
also proposes alternatives, enhancements and more ADRs).

1. **Interview the user** per [scratch-playbook.md](./scratch-playbook.md) — a grill-with-docs
   walk: relentless, one question at a time, recommending an answer each time; sharpen fuzzy
   terms into a canonical glossary; invent concrete scenarios to probe entity/feature
   boundaries. If the direction itself is undecided, run [Path C](#path-c--brainstorm-the-divergent-phase) first.

2. **Write `CONTEXT.md` + ADRs as decisions crystallize.** Glossary inline in `CONTEXT.md`
   (format: [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md)); an ADR under `docs/adr/` only when a
   decision is hard to reverse **and** surprising **and** a real trade-off (format:
   [ADR-FORMAT.md](./ADR-FORMAT.md)). Both live in `<OUT>` and the engine will not clobber them.

3. **Write `plan.json`** — the structured output of the interview, mapping 1:1 onto the
   inventory. Capture the full contract surface: `dataModel` (with `enumRef`, indexes, uniques),
   `enums` (complete member lists), `interfaces` (with input/output/sideEffects), `services`,
   `policies`, the `i18n.messages` catalog, `designSystem` for a UI product, and each
   `feature.writes`. Schema + worked example:
   [scratch-plan-schema.md](./scratch-plan-schema.md). The plan must be **internally
   consistent** — the engine rejects dangling references and warns on anonymous writes to
   owner-FK tables.

4. **Render the tree:**

   ```bash
   node scripts/analyze.mjs --scratch --plan plan.json --out <OUT> --level <light|complex> [--tdd]
   ```

   It validates the plan first, then scaffolds the PRDs and pre-fills
   `INTERFACES.md` / `DATA-MODEL.md` / enums / services / policies / message catalog.

5. **Enrich to full PRD depth** — same spine, same exhaustiveness as step 8 above, using the
   interview + `CONTEXT.md` + ADRs as ground truth (the role `source/` + `data/` play in code
   mode). At `complex`, fill *Enhancements & alternatives* (mark extras `[post-MVP]`); with
   `--tdd`, frame each unit's requirements as the tests to write first.

6. **Converge** — [convergence-loop.md](./convergence-loop.md), identically. In scratch mode
   `--check` additionally enforces feature→entity/operation reference integrity, and `--verify`
   adjudicates against the interview rather than source.

---

## Path C — brainstorm (the divergent phase)

Every other path **converges**. Brainstorming is the one divergent step: use it when the
direction itself is undecided.

```bash
node scripts/analyze.mjs --brainstorm --out <DIR>          # a fresh idea → blank scaffold
node scripts/analyze.mjs --brainstorm --out <RECON_DIR>    # an existing tree → seeded scaffold
```

Pointed at a tree that already has `inventory.json`, the scaffold is **seeded** with the
recovered surface (features, operations, entities), so you brainstorm *evolutions* of what is
built. It writes `BRAINSTORM.md` (never clobbering an edited one) with a `🧠` callout per
section, so an un-enriched brainstorm **fails `--check`** exactly like an unfinished PRD.

Resolve every callout — problem space, ≥3 genuinely different concepts (pitch / differentiators
/ trade-offs / risks each), a scoring table with a stated decision rule, the chosen direction,
and the rejected alternatives — then hand off: to the greenfield interview (the chosen concept
becomes `project.summary`, each rejected alternative a `decisions[]` entry), or to iteration PRDs
on the existing tree. Method: [brainstorm-playbook.md](./brainstorm-playbook.md).

---

## Path D — resume or refresh an existing tree

The user comes back to a reconstruction that already exists. **Do not re-run the analyzer over
it** — a `--repo`/`--scratch` run re-renders every document and destroys enrichment (the CLI
refuses; `--force` overrides and loses the work).

### First, find out where the tree stands

```bash
node scripts/analyze.mjs --check --out <OUT>      # structural state (never re-renders)
cat <OUT>/SUMMARY.md                              # what the tree covers
ls <OUT>/REVIEW.json <OUT>/VERIFY.json 2>/dev/null # has the semantic loop run?
```

| State | Next move |
| --- | --- |
| `--check` reports unresolved `🧠` / empty spine sections | Enrichment is incomplete — resume at step 8. |
| `--check` clean, no `REVIEW.json` | Enter the convergence loop at `--review`. |
| `REVIEW.json` exists, `ok: false` | Resume the loop mid-round: `--review` re-flags only what changed. |
| `REVIEW.json.ok`, no `VERIFY.json` | Run the faithfulness gate: `--verify` → adjudicate → `--apply`. |
| Both ledgers present | `--check --semantic` — the final gate. |

The ledgers make this safe: `--review` content-hashes each unit, so resuming re-reviews only
what actually changed. You are never restarting from zero.

### The source repo moved on

The tree describes an older commit. There is no in-place refresh — the honest procedure is:

1. **Scaffold the new state into a fresh directory:** `--repo <REPO> --out <OUT>.new`.
2. **Diff the two scaffolds** — `diff -ru <OUT>/architecture <OUT>.new/architecture`, and
   compare `SUMMARY.md` side by side. The interesting deltas are new/removed features, new
   routes, and schema changes.
3. **Port the deltas into the enriched tree by hand**, feature by feature. Enriched prose is the
   expensive artifact; the scaffold is cheap to regenerate.
4. **Re-run the loop.** Editing a PRD re-flags it, and editing an architecture doc re-flags every
   feature — exactly the units whose contracts moved.
5. Delete `<OUT>.new`.

Record what changed in `REBUILD.md` so the next refresh starts from a known baseline.

### Just re-issue the bundles

No re-analysis needed — run the bundle flags **without `--repo`** (idempotent):

```bash
node scripts/analyze.mjs --specs --features --merge --out <OUT>
```
