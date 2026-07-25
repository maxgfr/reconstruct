# AI review rubric — the semantic buildability pass

`node scripts/analyze.mjs --check` is a **deterministic** gate: it proves the
*structure* is intact (no unresolved `🧠` callouts or `fill this in` placeholders,
the architecture docs declare entities/operations, every feature PRD keeps its
spine, every locale is covered). It is fast, needs no API key, and runs in CI.

It cannot judge *substance*. A PRD can pass `--check` and still be unbuildable —
vague requirements, happy-path-only acceptance criteria, a write contract that
can't be satisfied, an enum value that contradicts the data model, a feature that
silently drops behaviour the source has. **That judgement is the AI's job.** Now
that the model running this skill is smart enough to reason about buildability,
the second validation layer is an **AI self-review** the agent performs against
this rubric — *the judgement is the model's, not the script's*. There is no `--ai`
flag and no API call: the agent (or a fresh reviewer agent) reads the tree and
applies the checks below. The `--review` command does **not** reason — it is the
deterministic ledger around that judgement (a per-feature worklist in, a reduced
pass/no-progress signal out), so the loop is orchestratable and terminates.

> **Order:** run `--check` first (cheap, deterministic). Only once it PASSES is the
> AI review worth doing — there's no point reasoning about substance while
> callouts are still unresolved.

## How to run it (via the skill)

1. Make sure `--check` passes.
2. For **each** `features/<slug>/PRD.md`, read the PRD plus the architecture docs
   it references (`architecture/INTERFACES.md`, `architecture/DATA-MODEL.md`,
   `architecture/ARCHITECTURE.md`) and — in code mode — the embedded
   `## Source material` / `data/` / `source/` ground truth, and in scratch mode
   `CONTEXT.md` + `docs/adr/`. Apply the **nine checks** below.
3. Emit findings as a table — one row per issue (the human-readable view):

   | file | severity | category | problem | fix |
   | --- | --- | --- | --- | --- |

   - **blocker** — a fresh agent would build the wrong thing or be unable to build it.
   - **major** — buildable but a real gap (a missing role, an unhandled error path).
   - **minor** — polish (wording, ordering, a redundant story).

   When you drive the review as a fan-out (below), return each finding as a JSON
   object instead — the **structured contract** the engine reduces:

   ```jsonc
   { "feature":  "06-public-directory",   // the feature slug
     "severity": "blocker",               // blocker | major | minor
     "category": "write-contract",        // stories|requirements|acceptance|write-contract|
                                          //   enum|consistency|faithfulness|i18n|rebuild-test
     "problem":  "…", "fix": "…",
     "verdict":  "confirmed",             // set by the VERIFIER, not the finder: confirmed|refuted|null
     "verifierNote": "…" }
   ```

4. A unit **passes the AI review** when it has **zero blockers**. Fix blockers
   (and ideally majors) in place, then re-run `--check` and repeat the review on
   the changed units until no blockers remain.

## Fanning it out — the review ledger (`--review`)

For anything past a handful of features, drive the review through the engine's
**review ledger** so it terminates on a correct fixpoint instead of by feel:

1. `node scripts/analyze.mjs --review --out <OUT>` writes `REVIEW.todo.json` +
   `REVIEW.md`, flagging `needsReview` on **only the units that changed** since the
   last round (content hashes — the first round flags all; an architecture-doc
   change re-flags every feature).
2. **Finder per flagged unit:** one reviewer agent per `needsReview` feature applies
   the nine checks and returns the finding objects above. Keep the reviewer
   **separate from the author** and prompt it to look for reasons the unit is *not*
   buildable — an adversarial reviewer catches what a self-congratulating author misses.
3. **Verifier per blocker:** a *second, independent* agent — prompted to **refute**
   each blocker, defaulting to `confirmed` only if it cannot — sets the `verdict`. A
   `refuted` blocker is a false positive and does not gate.
4. Save the findings as `findings.json` (`{ "findings": [ … ] }`) and run
   `node scripts/analyze.mjs --review --apply findings.json --out <OUT>`. The engine
   reduces them to `REVIEW.json`: `ok` (zero unrefuted blockers), `residual` (the
   gating blockers by stable id), and `noProgress`/`staleRounds`.

The fan-out mechanics (and the parallel map-reduce *enrichment*) are in
[`orchestration.md`](./orchestration.md).

## The convergence loop

This review is one layer of a loop that runs to a fixpoint. The loop itself — the round, the
ledger fields, the rules that make it terminate *correctly*, and what to do when it stops short
— lives in **[`convergence-loop.md`](./convergence-loop.md)**. Read it once; it is the single
source of truth, and this rubric is what you apply inside step (d) of it.

## The nine checks

1. **Story completeness.** Every actor — including the anonymous visitor, the
   admin, and any *system* actor (a job, a matcher, a fan-out) — and every
   distinct behaviour has a `As a <role>, I can <action> so that <value>` story.
   No happy-path-only. *Blocker if a whole role or capability is missing.*

2. **Requirement testability.** Each functional requirement is numbered, atomic,
   and testable from the outside. It covers the validation rules and the error
   states, not just the success path. *Blocker on "etc."/"and so on"/an
   un-numbered wall of prose.*

3. **Acceptance criteria are real.** Given/When/Then scenarios, at least one per
   functional requirement, **including the failure paths** (`Given an
   unauthenticated visitor, When they POST, Then 401 and nothing is written`).
   *Blocker if criteria are vague ("works correctly") or omit every failure path.*

4. **Write-contract satisfiability.** For every mutation, every required (NOT
   NULL, no-default) column and every foreign key has a named source in the PRD.
   A public/anonymous write never targets an owner-FK table — it writes to an
   anonymous-capable entity (e.g. `contactRequests`). Writes that must be atomic
   say so. *Blocker if a required column/FK has no source, or an anonymous write
   needs an owner identity it can't have.*

5. **Enum & domain fidelity.** Every enum/status/role value the unit accepts or
   emits is one of the members **fully enumerated** in `DATA-MODEL.md`. *Blocker
   on a value that isn't in the member list, or a "status" whose members were
   never enumerated.*

6. **Cross-document consistency.** Every operation the PRD lists exists in
   `INTERFACES.md` with a matching contract; every entity exists in
   `DATA-MODEL.md`; the PRD never contradicts the architecture docs (auth rule,
   field type, cardinality). *Blocker on a dangling reference or a contradiction.*

7. **Faithfulness (code mode) / grounding (scratch mode).** Code mode: the PRD
   matches the embedded source and real behaviour — no invented features, no
   silently dropped ones, no guessed constants where the source is explicit.
   Scratch mode: every requirement traces to the interview, `CONTEXT.md`, or an
   ADR — nothing invented beyond what was decided. *Blocker on a fabricated or
   omitted behaviour.* When you later run `--verify`, keep a grounded fact
   distinct from an inference: stamp each verdict `confidence: confirmed`
   (evidence read and decisive) / `inferred` (indirect — a pattern or standard
   behaviour) / `gap` (thin evidence, needs a human), so an inferred claim can
   never read as directly confirmed and `--check --semantic` can surface the gaps.

8. **i18n completeness.** Every user-facing string has a source string in the
   message catalog (`ARCHITECTURE.md`) and resolves in every locale; the PRD
   names no hard-coded copy. *Major if a string has no catalog key; blocker if a
   declared locale is uncovered for this unit.*

9. **The rebuild self-test.** The decisive question: *could a fresh agent rebuild
   this unit **correctly** — getting the contracts right, not just the gist —
   from this PRD plus the architecture docs alone, with no access to the original
   product and no access to the conversation that produced it?* If not, name the
   single biggest reason. *Blocker if the honest answer is "no".*

> **Calibration.** [`worked-example.md`](./worked-example.md) shows a unit that passes all nine
> next to the shallow version that passes `--check` and fails every one — plus the anti-pattern
> catalogue (named-not-specified, happy-path-only, "etc.", enum without members, unsatisfiable
> write). Read it before your first review: it is faster to recognise these than to derive them.

## What good output looks like

```
AI review — features/06-public-directory-annuaire/PRD.md
| severity | category | problem | fix |
| blocker | write-contract | submitContactRequest lists doctorProfileId as required but the anonymous caller has no way to supply it | resolve the slug → doctorProfileId server-side; document that the only client input is the slug + message + sender fields |
| major | stories | no story for the rate-limited/abusive submitter | add: "As an abusive visitor, my repeated submissions are throttled (per the rate-limit policy) so the doctor isn't spammed" |
| minor | acceptance | AC for empty search results missing | add a Given/When/Then for the zero-result state |
Verdict: 1 blocker → FAILS AI review until the write contract is resolved.
```

A clean unit ends with: `Verdict: 0 blockers → PASSES AI review.`

See [`buildability-checklist.md`](./buildability-checklist.md) for the ten
*contract categories* the deterministic gate covers — this per-feature review applies the nine
that live in a feature PRD; the tenth, the design-system/visual contract, is an
architecture-doc concern the gate warns on — and
[`analysis-playbook.md`](./analysis-playbook.md) for how each contract is derived.
