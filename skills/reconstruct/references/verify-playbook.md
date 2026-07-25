# Verify playbook — the requirement↔evidence ledger (`--verify`)

Three gates guard a reconstruction, and they answer different questions:

| Gate | Question |
| --- | --- |
| `--check` | Is the tree **well-formed**? (structure) |
| `--review` | Is the prose **buildable**? (substance — [`ai-review-rubric.md`](./ai-review-rubric.md)) |
| **`--verify`** | Does each requirement **trace back to the original**? (faithfulness) |

`--verify` is the anti-invention gate. A PRD can be perfectly structured and perfectly
buildable and still describe software that never existed. This ledger pairs every requirement
you wrote with the evidence the analyzer captured from the repo, and makes you adjudicate each
pair. Like `--review`, **the engine does not reason** — it derives the worklist and reduces
your verdicts; the judgement is yours.

---

## The cycle

```bash
node scripts/analyze.mjs --verify --out <OUT>                       # A. worklist
#   → adjudicate each pair (one adjudicator each, or inline)        # B. judgement
node scripts/analyze.mjs --verify --apply verdicts.json --out <OUT> # C. reduce → VERIFY.json
node scripts/analyze.mjs --check --semantic --out <OUT>             # D. final gate
```

The adjudication fans out — `--orchestrate --phase adjudicate` emits one adjudicator per pair
(batched; see [`scale-and-context.md`](./scale-and-context.md)). The `--apply` fold always
stays with you.

---

## A — what becomes a "claim"

The engine harvests requirements from **list items** under exactly two headings of each
`features/<slug>/PRD.md`:

- `## Functional requirements`
- `## Acceptance criteria`

It skips scaffold callouts (`> 🧠 …`), `fill this in` placeholders, and lines with fewer than
two meaningful words. Nothing else in the PRD is harvested — a requirement buried in a prose
paragraph under `## Context & goal` **is never verified**. That is a reason to keep real
requirements in those two numbered lists, not to work around the gate.

Each claim is paired with the feature's captured **evidence** — its `files`, `routes`,
`interfaces` and `entities` from `inventory.json` — by keyword overlap. The best match becomes
`evidenceRef`, and a `digest` shows you what was matched.

## ⚠ The worklist is capped — coverage is partial by default

The worklist keeps at most **60** pairs (`VERIFY_MAX`), the best-matched ones. On a tree with
more requirements than that, **the rest go unadjudicated**. This is surfaced in three places so
it can never read as full coverage:

- stdout: `⚠ coverage: 60 of 128 requirement(s) — CAPPED; the other 68 go unadjudicated`
- `VERIFY.md`: a `> ⚠ **Partial coverage:**` banner
- `VERIFY.todo.json`: `"coverage": { "total": 128, "kept": 60, "max": 60, "capped": true }`

**A capped run does not pass the final gate.** `--check --semantic` measures coverage against
**every** requirement in the PRDs, not against the worklist the run happened to show — so
leaving the cap in place fails closed with the fix in the message:

```
--semantic: 68 of 128 requirement(s) were never offered for adjudication (C61, C62, …) —
the --verify worklist was CAPPED, so the faithfulness gate only covered part of the tree.
Re-run with `--max-verify 128` and adjudicate the rest
```

So the cap is a **batch size, not a coverage decision**: raise it and adjudicate the rest —

```bash
node scripts/analyze.mjs --verify --max-verify 128 --out <OUT>
```

— or, if you deliberately accept partial coverage, pass `--allow-unverified` (which downgrades
it to a warning) and say plainly in your final report which fraction the gate actually covered.
Silent partial coverage is the failure this design exists to prevent.

The gate distinguishes the two ways a requirement ends up unadjudicated, because the fixes
differ: **never offered** (the cap — raise it) versus **offered but dropped** (verdict rows
deleted before `--apply`, or a PRD edited after verification, which shifts claim ids — re-run
`--verify`).

---

## B — adjudicating a pair

For each pair: open the cited evidence in `source/` / `data/` / the original repo, read it, and
decide.

### `verdict` — the gating axis

| verdict | meaning |
| --- | --- |
| `supported` | The evidence backs the requirement. |
| `partial` | Partly backed — the requirement says more than the evidence shows. |
| `refuted` | The evidence **contradicts** the requirement. Hard-fails the gate. |
| `unsupported` | No evidence backs it — likely invented. Hard-fails the gate. |

### `confidence` — the honesty axis

Stamped alongside the verdict. It never gates; it keeps a grounded fact machine-distinguishable
from an inference.

| confidence | meaning |
| --- | --- |
| `confirmed` | You read the cited evidence and it decisively supports the requirement. |
| `inferred` | Consistent with the source but **indirect** — a convention, a pattern, standard library/DB behaviour. No false certainty. |
| `gap` | The evidence is thin or missing and a human should confirm. |

`--check --semantic` **warns** on any verdict labelled `gap`, so thin evidence surfaces instead
of reading as directly confirmed.

> In scratch (greenfield) mode the ground truth is not code: adjudicate against the interview,
> `CONTEXT.md` and the ADRs. A requirement that traces to no decision is `unsupported` exactly
> as an invented one would be in code mode.

---

## C — the verdicts file

Write your adjudications as `verdicts.json`. Three shapes are accepted:

```jsonc
{ "pairs":    [ … ] }   // the worklist's own shape — easiest: edit VERIFY.todo.json in place
{ "verdicts": [ … ] }   // what the emitted adjudicator contract returns
[ … ]                   // a bare array
```

A row only needs the fields you decided; the rest are backfilled from `VERIFY.todo.json` by
`claimId`:

```jsonc
{
  "claimId":    "C17",
  "verdict":    "partial",
  "confidence": "inferred",
  "note":       "the handler validates the email but the 30-day expiry is a convention, not in code"
}
```

**The citation guard.** A `supported`/`partial` verdict must cite an `evidenceRef` that actually
resolves in `inventory.json`. A fabricated citation is rejected at fold time — you cannot pass
the gate by inventing a source file.

**Rows are never silently dropped.** A `claimId` absent from the run's worklist lands in
`VERIFY.json.ignored` rather than being folded.

---

## D — the final gate

```bash
node scripts/analyze.mjs --check --semantic --out <OUT>
```

It folds `VERIFY.json` **and** `REVIEW.json` into the structural check, additively — never a
relaxation. Specifically it:

- re-reduces the persisted verdicts (a hand-edited `ok: true` never passes);
- re-resolves every cited `evidenceRef` against the inventory;
- **fails closed** — a missing, unreadable, or 0-adjudication ledger is an *error*;
- **re-derives the FULL requirement set** and fails closed on any requirement with no
  adjudicated verdict — whether it was dropped before `--apply` or never offered because the
  worklist was capped;
- warns on every `confidence: gap`.

`--allow-unverified` downgrades the missing-ledger errors to warnings. Use it deliberately, and
say so in your final report.

See [`convergence-loop.md`](./convergence-loop.md) for where this sits in the round, and
[`orchestration.md`](./orchestration.md) for the adjudicator fan-out.
