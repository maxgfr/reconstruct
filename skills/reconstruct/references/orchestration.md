# Orchestration — fanning the work out across subagents

> **The engine now EMITS these fan-outs.** `node scripts/analyze.mjs --orchestrate --out <OUT>
> [--phase enrich-map|review-find|review-verify|adjudicate] [--eco] [--list]` generates, from the
> tree's CURRENT worklists (`inventory.json`, `REVIEW.todo.json`, `REVIEW.json`,
> `VERIFY.todo.json`), one launchable workflow per ready phase plus the `agents/<role>.md`
> dispatch contracts (drafter / finder / verifier / adjudicator) and a sequential `RUNBOOK.md`
> into `<OUT>/orchestration/` — the protocol below, made executable. The protocol itself stays
> host-agnostic; the emission is a convenience, not a requirement, and the reduce/`--apply` fold
> always stays with the orchestrator.

A reconstruction is embarrassingly parallel: the engine already carves the repo into the
**units** a fleet of agents can own independently. `inventory.json.features[]` is the unit of
fan-out (each carries its own `slug`, `files`, `routes`, `interfaces`, `entities`, `writes`); for a
monorepo the outer unit is `inventory.json.workspaces[]`. The two heavy phases — **enriching** the
PRDs and **reviewing** them to a buildable fixpoint — both map onto a fan-out, and the engine owns
the deterministic glue (worklists, hashing, change-tracking, reduction) so the agents only supply
judgment.

This file is **host-agnostic**. "Fan out" means *dispatch one subagent per unit* — with whatever
primitive the host has (Claude Code's Task/Agent tool, a plain loop of sequential subagent calls, or
a dynamic workflow engine). The protocol below does not depend on any one of them; the optional
[workflow mapping](#optional-on-hosts-with-a-dynamic-workflow-engine) at the end is a convenience,
not a requirement. On a small repo, just do the steps inline — the fan-out earns its keep when the
tree has more than a handful of features.

> **When to fan out, and how wide.** See [`scale-and-context.md`](./scale-and-context.md) §4 — it
> carries the threshold (≤ ~5 features → inline), the per-phase batch sizes the engine picks, and
> the agent cap. The short version: `enrich-map`/`review-find` dispatch **one agent per item**;
> `review-verify`/`adjudicate` batch 4. The cost of a wrong call is small — the gates are
> identical either way.

---

## Phase 1 — enrichment as map-reduce

Mapping the interface surface and the data model, then writing each feature PRD, is the most
expensive phase. It parallelizes cleanly because every feature is independent **except** for the one
thing they all share: the architecture docs (`INTERFACES.md` / `DATA-MODEL.md` / `ARCHITECTURE.md`).
So treat enrichment as a map-reduce with the shared docs as the reduce target.

**MAP — one subagent per `inventory.features[i]` (parallel).** Each agent:
- reads its `feature.files` plus the `inventory.hints.*Candidates` that fall inside those files
  (routes/api/schema/realtime/auth), and the embedded `## Source material` / `data/` ground truth;
- drafts its own `features/<slug>/PRD.md` to full spine depth (see the PRD templates);
- **does not** write the shared architecture docs. Instead it **returns proposals**: the interface
  rows it discovered (method · path · kind · auth · input · output · side-effects) and the entity
  rows (entity · fields+types · constraints · relations · enums) its feature touches.

Returning proposals — not writing the shared docs directly — is what keeps the map parallel: two
agents never race on the same file.

**REDUCE — one agent merges the proposals into the canonical docs (serial).** It:
- unions every proposed interface row into `architecture/INTERFACES.md` and every entity row into
  `architecture/DATA-MODEL.md`, **deduping** by path/operation and by entity name;
- **reconciles conflicts** — when two features propose a different type for the same field, or a
  different auth rule for the same operation, resolve it against `source/`/`data/` (code mode) or
  `CONTEXT.md`/ADRs (scratch mode), never by guessing;
- enumerates every enum's **complete** member set once, in the shared `## Enums & domain types`
  section, and points the features at it;
- then the feature PRDs **re-link** to the now-canonical rows.

**Reduce-time gate.** Run the consistency self-review (every entity/operation a feature names exists
in the arch docs with the same shape; every write is satisfiable; enum values are members) and then
`node scripts/analyze.mjs --check --out <OUT>`. The gate is the proof the merge didn't drift.

**Monorepo.** The outer map unit is the workspace (`stack-guides/monorepo.md`): one stream per
workspace, each loading its own stack guide and using its own `hints`. The reduce stays **global but
attributed** — one `INTERFACES.md` / `DATA-MODEL.md` with a workspace column, not a doc per
workspace — so cross-workspace contracts line up.

---

## Phase 2 — the review/fix loop as a finder/verifier fan-out

Once `--check` passes, the AI buildability review (`references/ai-review-rubric.md`) runs as a
fan-out the engine drives through a **review ledger**. The ledger is the AI-review sibling of the
`--verify` requirement gate: the engine emits a per-feature worklist, agents fill structured
findings, and the engine reduces them to a pass / no-progress signal so the loop terminates on a
*correct* fixpoint instead of spinning or stopping early.

### The cycle (one round)

```
node scripts/analyze.mjs --review --out <OUT>     # A. worklist: REVIEW.todo.json + REVIEW.md
                                                  #    flags only the units that CHANGED since last round
fan out: one FINDER per flagged unit              # B. each returns findings (the schema below)
fan out: one VERIFIER per blocker                 # C. independent, adversarial — sets verdict
save merged findings as findings.json             # D. { "findings": [ … ] }
node scripts/analyze.mjs --review --apply findings.json --out <OUT>   # E. reduce → REVIEW.json
```

**A — the worklist.** `--review` hashes each `features/<slug>/PRD.md` and the shared architecture
docs, compares against the previous round's `REVIEW.json`, and sets `needsReview` on the units whose
hash moved (everything on the first round; an architecture-doc change re-flags **all** features,
since the contract they hang off changed). This is *"only re-review what changed"* made mechanical —
the loop shrinks each round instead of re-scanning a clean tree.

**B — the finder.** One subagent per `needsReview` unit reads the PRD + the architecture docs it
references + the ground truth, applies the [nine checks](ai-review-rubric.md#the-nine-checks), and
returns its findings. Prompt it **adversarially** — to find reasons the unit is *not* buildable, not
to bless it.

**C — the verifier (separate agent, per blocker).** Keep the reviewer **separate from the author**:
a finding "counts" only when an independent verifier confirms it. For each `blocker`, a fresh
subagent — prompted to *refute* it, defaulting to `confirmed` only if it cannot — sets `verdict`. A
`refuted` blocker does not gate (the engine drops it from the residual set). This is the
adversarial-verify step: it kills plausible-but-wrong blockers before they cost a fix round.

**E — the reduce.** `--review --apply` writes `REVIEW.json`:

| field | meaning |
| --- | --- |
| `ok` | true ⟺ zero gating (unrefuted) blockers — the buildable fixpoint |
| `residual` | sorted **stable ids** of this round's gating blockers (`feature:category:hash(problem)`) |
| `noProgress` | this round's `residual` equals the previous round's (same blockers survived a fix round) |
| `staleRounds` | consecutive no-progress rounds — the loop's escape hatch |
| `changedSet` | features whose PRD changed since the previous round |
| `failures` | the gating blockers, each with `{ id, feature, category, problem, fix }` |

Because each finding's id is stable across rounds, "the same residual findings keep reappearing" is
a measured fact (`noProgress`), not a vibe.

### The finding schema (what a finder/verifier returns)

```jsonc
{
  "feature":  "06-public-directory",     // the feature slug (matches inventory.features[].slug)
  "severity": "blocker",                 // blocker | major | minor
  "category": "write-contract",          // stories|requirements|acceptance|write-contract|enum|
                                         //   consistency|faithfulness|i18n|rebuild-test
  "problem":  "submitContactRequest lists doctorProfileId as required but the anonymous caller has no way to supply it",
  "fix":      "resolve the slug → doctorProfileId server-side; the only client input is slug + message + sender fields",
  "verdict":  "confirmed",               // set by the VERIFIER, not the finder: confirmed | refuted | null
  "verifierNote": "real — the form has no profile id field"
}
```

Findings file shape: `{ "findings": [ … ] }` (a bare array or the worklist's
`{ "units": [{ feature, findings }] }` shape are also accepted).

**Soundness of the optimization.** "Only re-review what changed" never drops a real
blocker. A feature's blockers are re-decided in a round only if the agent **touched**
it (it was flagged `needsReview`, or you submitted a finding for it). An open blocker
in a feature you did **not** touch is **carried forward** into the next `residual` —
so the loop can never report `ok` while an unresolved blocker sits in an unreviewed
feature. Fixing a blocker edits its PRD, which re-flags that feature, which lets the
next round's clean review actually clear it. (Change-tracking anchors to the last
*applied* round, so running `--review` repeatedly without `--apply` is idempotent.)

### Termination

Driven by the ledger, not by feel — and defined once, in
**[`convergence-loop.md`](./convergence-loop.md)**: the stopping conditions (`ok`,
`staleRounds >= 2`, `round > 5`), the escalation ladder when you stop short, and the
known-gaps report. Do not improvise stopping rules here.

---

## Phase 3 — adjudicating the requirement ledger

`--verify` pairs every requirement with the evidence the analyzer captured, and the pairs fan out
one adjudicator each (`--orchestrate --phase adjudicate`). The full contract — what becomes a
claim, the verdict and confidence vocabularies, the citation guard, the `verdicts.json` shapes,
and the **worklist cap that bounds coverage** — is in
[`verify-playbook.md`](./verify-playbook.md).

The one thing to carry into every adjudicator prompt: alongside `verdict`, stamp a `confidence`
label — **confirmed** (evidence read, decisive), **inferred** (consistent but indirect: a
convention, a pattern, standard library/DB behavior — no false certainty), or **gap** (evidence
thin, a human should confirm). It never gates, but it keeps a grounded fact
machine-distinguishable from an inference, and `--check --semantic` warns on every `gap`.

---

## Optional — on hosts with a dynamic workflow engine

If your host can orchestrate subagents as a dataflow (a "workflow"), the review loop is the
canonical *review → adversarially-verify* pipeline with a *loop-until-dry* outer loop:

```
loop while not REVIEW.json.ok and staleRounds < 2 and round <= 5:
  units      = read REVIEW.todo.json (after `--review`); keep needsReview === true
  findings   = pipeline(units,
                 u  => finder(u)            // returns findings[] for the unit
                 fs => parallel(fs.filter(isBlocker).map(verifier))   // each blocker refuted/confirmed
               )
  write findings.json ; run `--review --apply` ; re-read REVIEW.json
```

The enrichment phase is the same shape with a barrier: `parallel(features.map(mapDraft))` →
`reduce(mergeIntoArchDocs)` → `--check`. This is an optimization of the exact protocol above; a host
without a workflow engine runs the identical steps by dispatching the subagents in a plain loop. The
engine's worklists and `REVIEW.json` are the contract either way.
