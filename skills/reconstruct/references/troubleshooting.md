# Troubleshooting — symptom → cause → fix

Every entry is a failure that actually happens. Find the symptom, apply the fix, keep going.

---

## Re-running & data loss

### "My enriched PRDs were overwritten"

A normal `--repo` / `--scratch` run **re-renders every document**. Only `CONTEXT.md`,
`docs/adr/*` and `BRAINSTORM.md` are written if-absent; feature PRDs and architecture docs are
not. The engine now refuses such a run:

```
<OUT> already holds an ENRICHED reconstruction — re-running the analyzer would overwrite it.
  - architecture/INTERFACES.md — every agent callout resolved
```

| You want to | Do this |
| --- | --- |
| Continue the existing tree | `--check` / `--review` / `--verify --out <OUT>` — these never re-render |
| Deep-dive one workspace | `--out <OUT>-<workspace>` (a **new** directory) |
| Re-scaffold and compare | `--out <OUT>.new`, then diff by hand and port what you want |
| Refresh bundles only | `--specs --summary --out <OUT>` (no `--repo` → post-step, no re-analysis) |
| Genuinely start over | `--force` — the enrichment is **lost** |

If the loss already happened and the tree is in git, recover from git. Otherwise re-scaffold
into a new directory and re-enrich; there is no undo.

### "The guard fires on a tree I never enriched"

The detector reads *"no `🧠` callouts left"* as *"an agent resolved them"*. If you deleted the
callouts by hand — or your own tooling stripped them — the tree looks enriched. Either restore
them or pass `--force` deliberately.

---

## `--check` (layer 1, structure)

### It will not go green

`--check` exits non-zero on exactly these, and each has one fix:

| Error | Fix |
| --- | --- |
| unresolved `🧠` callout / `fill this in` placeholder | Answer it and **delete the callout**. A callout left in place means the unit is not done. |
| missing required document | `REBUILD.md`, `00-overview/PRD.md` and the three architecture docs must exist — do not delete scaffold files. |
| feature PRD missing a spine section, or one left empty | A heading with no content fails. Fill it or, if genuinely N/A, say so in one line. |
| architecture doc emptied of its contract | No entities in `DATA-MODEL.md` / no operations in `INTERFACES.md`. Fill the table. |
| (scratch path) feature references an unknown entity/operation | Add it to the architecture doc, or fix the reference. Reference integrity is enforced only on the scratch path — on the code path the inventory carries no `dataModel`/`interfaces`, so the contract-substance check is the operative gate. |

An **uncovered locale**, or a UI product with an empty `DESIGN-SYSTEM.md`, is a *warning*, not an
error. Resolve them anyway before calling the tree done.

### "It passes, but the PRDs are obviously thin"

That is by design: `--check` proves structure, never substance. Run layer 2 —
[`ai-review-rubric.md`](./ai-review-rubric.md) — that is what catches vague requirements,
happy-path-only criteria and unsatisfiable write contracts.

---

## `--review` (layer 2, substance)

### `noProgress` / `staleRounds >= 2`

The same blockers survived a fix round. **The feature PRD is usually not the culprit** — the
shared contract it hangs off is. Fix `INTERFACES.md` / `DATA-MODEL.md` first; the features
stop regressing. If two rounds still change nothing, stop and record: write every remaining
`REVIEW.json.failures` entry into `REBUILD.md` under `## Known gaps / unresolved blockers`, and
report it. See [`convergence-loop.md`](./convergence-loop.md).

### "The loop keeps flagging every feature"

You edited an architecture doc. That re-flags **all** features by design — the contract they
reference moved, so their reviews are stale. It is correct, not a bug.

### "A blocker is real but faithful"

If it is a property of the original (a real bug you are preserving), record it in `REBUILD.md`'s
known-gaps list and move on. Do not loop on it.

---

## `--verify` and `--check --semantic`

### `--check --semantic` fails with "no VERIFY.json / no REVIEW.json"

It **fails closed** on purpose: a missing ledger is an error, never a silent pass. Run
`--verify` (then `--verify --apply`) and `--review` (then `--review --apply`) first.
`--allow-unverified` downgrades it to a warning — use it deliberately and say so in your report.

### "0 adjudicated verdicts — the requirement gate never engaged"

Your `verdicts.json` had no valid `verdict` tokens. Valid values are `supported`, `partial`,
`refuted`, `unsupported`. A row with `verdict: null` is not an adjudication.

### "N requirement(s) have no adjudicated verdict"

The gate re-derives the worklist and refuses to pass on dropped rows. Either you deleted rows
before `--apply`, or you edited a PRD after verifying (which shifts claim ids). Re-run
`--verify`, adjudicate the fresh worklist, `--apply` again.

### "I verified everything but coverage looks low"

Read `VERIFY.todo.json`'s `coverage`. The worklist caps at 60 pairs; the rest were never
adjudicated. Raise it — `--max-verify <total>` — or report the coverage you actually achieved.
See [`verify-playbook.md`](./verify-playbook.md).

---

## Analysis & detection

### 0 routes resolved

Normal for many stacks. The engine resolves routes only for the frameworks with an adapter
(Next.js, Express, Fastify, Hono, Flask, FastAPI, NestJS, Django, Rails, Go, tRPC). Everything
else surfaces as `hints.routeCandidates` / `apiCandidates` for you to enumerate by hand —
`inventory.unknowns` says so explicitly. Use the matching guide from
[`stack-guides/INDEX.md`](./stack-guides/INDEX.md).

### "No web framework was detected"

Either the framework has no detection signal, or **there is no web framework** — the repo is a
library, CLI, SDK or engine. That is a first-class case: read
[`stack-guides/library-cli-sdk.md`](./stack-guides/library-cli-sdk.md), where the interface
surface is the exported public API and the CLI commands, not HTTP routes.

### The stack is detected wrong, or partially

`stack.libraries` is npm-aware; for Python/Ruby/PHP/JVM/Go read the real deps from
`inventory.dependencies` directly. Record the correction in `00-overview/PRD.md` and
`ARCHITECTURE.md` and carry on — the deterministic scaffold is universal, the stack label is
just a routing hint.

### The monorepo was not detected

If the layout *looks* like a monorepo (several apps/services with their own manifests) but
`inventory.workspaces` is empty, the membership declaration is unconventional. Identify the
workspaces yourself, scope a run per workspace (`--include '<dir>/**' --out <OUT>-<ws>`), and
record the finding in `ARCHITECTURE.md`. See
[`stack-guides/monorepo.md`](./stack-guides/monorepo.md).

### `inventory.warnings` is non-empty

Detection degraded there — a malformed manifest, a workspace dependency cycle. **Verify those
areas by hand** rather than trusting the empty defaults. A dependency cycle demotes the build
order to path order: break it, or document the bootstrap order in `REBUILD.md`.

### The run is huge or slow to work with

It is not CPU: it is context. Scope with `--include`/`--exclude`, lower `--max-embed-bytes`,
orient from `SUMMARY.md` instead of `inventory.json`. See
[`scale-and-context.md`](./scale-and-context.md).

---

## Orchestration

### `--orchestrate --phase <p>` exits 2

That phase's worklist does not exist yet. The error names the command that produces it:

| Phase | Produced by |
| --- | --- |
| `enrich-map` | the analyzer run itself (`inventory.json`) |
| `review-find` | `--review` (`REVIEW.todo.json`) |
| `review-verify` | `--review --apply <findings.json>` (`REVIEW.json`) |
| `adjudicate` | `--verify` (`VERIFY.todo.json`) |

Exit 2 also means an unknown phase name, or a missing `--out` directory.

### "It dispatched fewer agents than there are features"

Past 40 agents in a phase, the batch grows instead of the fleet — and it is always printed
(`… → 40 agent(s), 3 item(s) each (capped at 40 agents)`). Override with `--batch-size 1` if
you want one agent per item regardless. Check with `--orchestrate --list` before launching.

### "Two subagents wrote the same file"

They should not: subagents **return** fragments and never write. The reduce — every doc merge
and every `--apply` fold — stays with you, the orchestrator. If you dispatched agents with
write access to the tree, that is the bug. Re-read the emitted `agents/<role>.md` contract.

---

## Scratch (greenfield)

### `plan.json is internally inconsistent`

`--scratch` fails fast rather than rendering a tree that cannot be built:

| Error | Fix |
| --- | --- |
| a feature references an entity not in `dataModel` | Add the entity, or fix the name. |
| a feature references an interface not in `interfaces` | Same. |
| `feature.writes` names an unknown entity | Same. |
| a declared enum has no members | Enumerate the **complete** member list. A `status` with no members is untestable. |
| a field's `enumRef` points at an undefined enum | Define it in `plan.enums`. |

### Warning: "a public write targets an entity with a required owner FK"

The classic unbuildable contract: an anonymous caller cannot satisfy an owner foreign key. Give
the operation an **anonymous-capable** entity to write to (no owner FK — e.g. `contactRequests`).
A *recipient* FK supplied as input is fine; the caller's **own** id is not. Resolve the warning
before enriching.

---

## Installation

### The skill installed without its engine

`npx skills add` installs a root `SKILL.md` **alone**. This skill lives at
`skills/reconstruct/` precisely so the engine and references are bundled with it. If
`scripts/analyze.mjs` is missing next to your `SKILL.md`, you installed the wrong shape —
reinstall from the repository root.
