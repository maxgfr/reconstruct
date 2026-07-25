# The convergence loop — the single source of truth

A reconstruction is **not** done when the scaffold is filled. It is done when it
**converges**: two gates agree the tree is buildable, and a fresh reviewer cannot find a
blocker. This file is the one canonical description of that loop — `SKILL.md`,
[`procedure.md`](./procedure.md), [`orchestration.md`](./orchestration.md) and
[`ai-review-rubric.md`](./ai-review-rubric.md) all point here rather than restate it.

**You own this loop end-to-end.** Run it yourself, to the fixpoint, in one go. Do not hand
rounds back to the user, do not ask "should I continue?", and do not stop at the first pass.
The user invokes the skill once and expects a finished, buildable tree out the other side.

---

## The two layers

| Layer | Command | Judges | Cost |
| --- | --- | --- | --- |
| **1 — structure** | `--check` | Is the tree well-formed? No unresolved `🧠`/placeholders, every spine section present and non-empty, architecture docs carry their contract, references resolve. | Deterministic, instant |
| **2 — substance** | *you*, against [`ai-review-rubric.md`](./ai-review-rubric.md) | Is the prose actually **buildable**? The nine checks. `--review` is only the ledger around your judgement — it does not reason. | One agent per changed unit |

Run layer 1 first: there is no point reasoning about substance while callouts are still
unresolved.

---

## The loop

```
round = 1
repeat:
  a. enrich (or fix) the changed units                     # write/repair the prose
  b. node scripts/analyze.mjs --check   --out <OUT>        # layer 1 — fix errors, repeat (b)
  c. node scripts/analyze.mjs --review  --out <OUT>        # layer 2 worklist: flags only what CHANGED
  d. review each flagged unit + verify each blocker        # per ai-review-rubric.md
     → findings.json  (one finder/unit, one independent verifier/blocker)
  e. node scripts/analyze.mjs --review --apply findings.json --out <OUT>   # reduce → REVIEW.json
  f. when (b)–(e) are clean:
     node scripts/analyze.mjs --verify --out <OUT>         # requirement↔evidence worklist
     → adjudicate each pair  → --verify --apply verdicts.json --out <OUT>
  g. node scripts/analyze.mjs --check --semantic --out <OUT>   # the final, fail-closed gate
until  --check --semantic exits 0
   or  REVIEW.json.staleRounds >= 2
   or  round > 5
```

Step (f) has its own reference: [`verify-playbook.md`](./verify-playbook.md) — including the
worklist **cap**, which silently bounds coverage if you ignore it.

---

## What `REVIEW.json` tells you

`--review --apply` reduces the findings into a ledger, so termination is a *measured fact*
rather than a feeling:

| field | meaning |
| --- | --- |
| `ok` | true ⟺ zero gating (unrefuted) blockers — the buildable fixpoint |
| `residual` | this round's gating blockers, by **stable id** (`feature:category:hash(problem)`) |
| `noProgress` | this round's `residual` equals the previous round's — a fix round changed nothing |
| `staleRounds` | consecutive no-progress rounds — the escape hatch |
| `changedSet` | features whose PRD changed since the previous round |
| `failures` | the gating blockers, each `{ id, feature, category, problem, fix }` |

Because ids are stable across rounds, "the same findings keep reappearing" is `noProgress`,
not a vibe.

---

## The rules that make it terminate on a *correct* fixpoint

- **A finding is resolved only when a fresh reviewer confirms it.** Keep the reviewer separate
  from the author: an adversarial verifier prompted to *refute* sets each blocker's `verdict`,
  and a `refuted` blocker drops out of `residual`. Never self-certify.
- **Only re-review what changed.** `--review` content-hashes each unit and flags `needsReview`,
  so the loop shrinks instead of re-scanning a clean tree. Review exactly the flagged units.
  (An architecture-doc change re-flags **every** feature — the contract they hang off moved.)
- **Ground every fix** in `source/`/`data/` (code mode) or `CONTEXT.md`/ADRs (scratch mode). A
  fix that invents behaviour just trades one finding for another; faithfulness is the anchor.
- **Stop at zero blockers, not zero findings.** `ok` gates "buildable"; majors are worth fixing,
  minors are optional polish — record what you deliberately leave.
- **If the loop is not shrinking** (`noProgress`, the same `residual` ids), the contract in the
  architecture docs is wrong, not the feature PRD. Fix `INTERFACES.md`/`DATA-MODEL.md` first and
  the features hanging off it stop regressing.

### Why "only re-review what changed" is sound

It never drops a real blocker. A feature's blockers are re-decided in a round only if you
**touched** it (flagged `needsReview`, or you submitted a finding for it). An open blocker in a
feature you did **not** touch is **carried forward** into the next `residual` — so the loop can
never report `ok` while an unresolved blocker sits in an unreviewed feature. Fixing a blocker
edits its PRD, which re-flags that feature, which lets the next round's clean review clear it.
Change-tracking anchors to the last *applied* round, so running `--review` repeatedly without
`--apply` is idempotent.

---

## Stopping — and what to do when you stop short

Terminate at `REVIEW.json.ok` (the fixpoint), or bail out at `staleRounds >= 2` (two rounds
stuck on the same blockers) or after ≤ 5 rounds.

When you stop **not** at `ok`, do not stop silently. Climb the escalation ladder:

1. **Re-edit the unit** — the finding may be a local prose gap.
2. **Fix the shared architecture contract** those blockers have in common —
   `INTERFACES.md`/`DATA-MODEL.md` is the usual real culprit.
3. **Record and report** — write every remaining `REVIEW.json.failures` entry into `REBUILD.md`
   under `## Known gaps / unresolved blockers` (owning unit · the finding · what was tried), and
   surface it to the user.

If a residual blocker is a **faithful property of the original** (a real bug you are preserving),
record it rather than looping on it.

**Report once, at the end** — the final `--check`/`REVIEW.json` result, the zero-blocker
confirmation (or the known-gaps list), and anything you deliberately left. The user should
relaunch nothing: one skill invocation goes scaffold → buildable.

---

## The final gate is fail-closed

`--check --semantic` re-reduces **both** persisted ledgers (`VERIFY.json` verdicts,
`REVIEW.json` findings) and re-resolves every cited `evidenceRef` against the inventory — a
stale or hand-edited `ok: true` never passes. A missing or unreadable ledger is an **error**,
not a pass. `--allow-unverified` downgrades that to a warning; use it only deliberately, and
say so in the final report.

At scale, drive each round as a fan-out — see [`orchestration.md`](./orchestration.md); the
engine emits it ready to launch (`--orchestrate --phase review-find | review-verify |
adjudicate`).
