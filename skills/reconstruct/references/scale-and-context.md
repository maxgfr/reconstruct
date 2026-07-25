# Scale & context — making a reconstruction affordable

The engine is fast (a few hundred milliseconds on a mid-size repo). **The cost of a
reconstruction is your context, not CPU time.** This file is the set of levers that decide how
many tokens the job burns, and when to spend them.

---

## 1. Orient from `SUMMARY.md`, never from `inventory.json`

`SUMMARY.md` is written on **every** run. It is a one-page digest: stack, notable libraries,
size, features in build order, interface/data counts, locales, unknowns, next steps.

`inventory.json` carries **one entry per analyzed file** plus every hint — it grows linearly
with the repo. On a 238-file repo it is already ~20× the digest, and a few thousand files put
it beyond what is sensible to read at all.

| Document | 238-file repo | Grows with repo size |
| --- | --- | --- |
| `SUMMARY.md` | ~3 KB | no (bounded) |
| `inventory.json` | ~66 KB | **yes, linearly** |

So: **read `SUMMARY.md` to orient. Read `inventory.json` in slices, never whole.**

```bash
OUT=<out>; INV=$OUT/inventory.json

jq '.stack, .unknowns, .warnings'                    "$INV"   # what am I looking at, what is missing
jq '.features[] | {slug, files: (.files|length)}'    "$INV"   # the fan-out units
jq '.features[] | select(.slug=="05-billing")'       "$INV"   # ONE feature's slice
jq '.hints | map_values(length)'                     "$INV"   # how many candidates per hint class
jq -r '.hints.schemaCandidates[]'                    "$INV"   # just the schema files
jq -r '.workspaces[] | "\(.name)\t\(.path)\t\(.stack.frameworks|join(","))"' "$INV"
```

A drafting subagent should read only **its** feature's slice — that is exactly what the emitted
`agents/drafter.md` contract instructs.

---

## 2. Fidelity is a context budget, not just a style

Fidelity decides how much of the original repo lands in `<OUT>`:

| Fidelity | What it does | Cost |
| --- | --- | --- |
| `mirror` | Copies the real files under `source/` | Largest — a 238-file repo produced a **3.4 MB** tree |
| `embed` | Inlines key code into the PRDs, capped by `--max-embed-bytes` | Medium, and it lands *in the documents you read* |
| `describe` | Text only | Smallest |

`mirror` is cheap to *write* and expensive only if you read it all — the files sit on disk and
you open what you need. `embed` is the one to watch: embedded code is inside the PRD, so every
agent that opens that PRD pays for it. Lower `--max-embed-bytes` (default 16000) when PRDs get
unwieldy.

Translations, schema and config are **always** copied to `data/` verbatim regardless of
fidelity — never re-translate or re-derive data.

---

## 3. Scope a large repo instead of drowning in it

```bash
# Analyze one area only (repeatable, comma-ok)
node scripts/analyze.mjs --repo <REPO> --include 'apps/web/**' --out <OUT>-web

# Drop noise
node scripts/analyze.mjs --repo <REPO> --exclude 'vendor/**,**/*.generated.ts' --out <OUT>
```

- **Monorepo** → one scoped run per workspace, each into **its own** `--out`. Never re-point a
  scoped run at an enriched tree (the CLI now refuses; see
  [`troubleshooting.md`](./troubleshooting.md)).
- **`--granularity`** — `coarse` (default) folds route-less single-file groups into Core; `fine`
  splits more. Prefer `coarse` first: you can always split a feature by hand while writing, and
  more features means more fan-out units.
- **`--json`** prints the inventory and writes nothing — useful to size a repo up before
  committing to a full run. Pipe it through `jq`, do not read it raw.

---

## 4. When to fan out

Fan-out is an **optimization, never a requirement**. The gates are identical either way, and
every phase has a sequential fallback with identical artifacts.

| Situation | Do this |
| --- | --- |
| ≤ ~5 features | Enrich and review inline. The fan-out does not amortize. |
| More than that | One subagent per feature (`--orchestrate --phase enrich-map`). |
| Monorepo | Always fan out — one stream per workspace, each loading its own stack guide. |
| Eco mode / no subagents | `--orchestrate --eco` → follow `RUNBOOK.md` sequentially. Correctness-identical; only wall-clock differs. |

`--orchestrate` itself tells you when a worklist is too small: *"only N item(s) — the sequential
`--eco` path is equivalent and cheaper."*

### How wide each phase fans out

The engine picks the batch size per phase, because the phases do different-sized work:

| Phase | Items per agent | Why |
| --- | --- | --- |
| `enrich-map` | **1** | The unit of work is a *complete feature PRD*. One agent per feature. |
| `review-find` | **1** | The unit is the nine checks over one whole PRD. |
| `review-verify` | 4 | Each item is one blocker: a short, bounded judgement. |
| `adjudicate` | 4 | Each item is one claim↔evidence pair. |

Past **40 agents** in a phase the *batch* grows instead of the fleet — and the decision is
always printed (`phase "enrich-map": 96 item(s) → 40 agent(s), 3 item(s) each (capped at 40
agents)`). Override with `--batch-size <n>` when you know better. Check the shape before
launching:

```bash
node scripts/analyze.mjs --orchestrate --out <OUT> --list   # items / batch / agents per phase
```

---

## 5. The other silent cap: `--verify`

The requirement↔evidence worklist keeps at most 60 pairs. On a large tree that is **partial
coverage of the faithfulness gate** — read `VERIFY.todo.json`'s `coverage` field, raise it with
`--max-verify <n>`, or state the coverage you actually achieved.
Details: [`verify-playbook.md`](./verify-playbook.md).

---

## 6. Bundles: pick the right one to hand on

| Flag | File | Use it for |
| --- | --- | --- |
| `--specs` | `SPECS.md` | **The one to hand an agent to implement from** — whole spec, source code stripped. |
| `--features` | `FEATURES.md` | Just the product functionality, in build order. |
| `--merge` | `RECONSTRUCTION.md` | Everything including embedded source — the heaviest. |
| — | `SUMMARY.md` | Always written. Orientation. |

All of them also run as a **standalone post-step** on an already-generated tree (no `--repo`,
no re-analysis, idempotent):

```bash
node scripts/analyze.mjs --specs --summary --out <OUT>
```

---

## Rules of thumb

- Orient from `SUMMARY.md`; slice `inventory.json` with `jq`; never read it whole.
- Give a subagent only its own feature's slice — that is what makes the map parallel *and* cheap.
- Prefer more, smaller feature PRDs; each one is an independently affordable unit of work.
- Scope large repos with `--include`, one `--out` per scope.
- Check `--orchestrate --list` before launching a fan-out you have not sized.
- Never let a cap (`--verify`, batch size) stay silent in your final report.
