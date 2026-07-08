# Brainstorm playbook — the divergent phase

Every other path in this skill **converges**: the interview narrows to one product, the analyzer
resolves one repo, the review loop drives to one buildable fixpoint. Brainstorming is the one
**divergent** step — it exists to widen the option space *before* you commit, so the product you
converge on is one you chose against alternatives, not the first idea that stuck.

Use it when the **direction itself is undecided**: the user has a problem but not a product, is
weighing several concepts, or has an existing app and wants to know what to build next. Skip it when
the product is already decided — go straight to the interview (`scratch-playbook.md`) or the repo
analysis (`analysis-playbook.md`).

**The engine part is a scaffold, not the thinking.** `--brainstorm` writes `BRAINSTORM.md` with a
`> 🧠` callout per section; YOU do the divergence and fill it. Every callout left unresolved fails
`--check` exactly like an unfinished PRD, so a half-done brainstorm can't masquerade as a decision.

---

## The method

1. **Frame the problem space, not the solution.** Name the jobs-to-be-done and who hurts today —
   before any concept. A brainstorm anchored on a solution ("a mobile app that…") has already
   skipped the divergence. Anchor on the problem so the concepts can genuinely differ.

2. **Generate ≥3 genuinely different concepts — not variants of one.** The test: if two concepts
   would produce the same data model and the same core screens, they are one concept with two
   coats of paint. Push for real forks — a different primary user, a different business model, a
   different depth (a focused tool vs a platform), a different build-vs-integrate stance. For each:
   - **Pitch** — one sentence: what it is and for whom.
   - **Differentiators** — what makes it distinct from the *other concepts here*, not from the
     market in the abstract.
   - **Trade-offs** — what it gives up; what gets harder or more expensive.
   - **Risks** — the single thing most likely to sink it (the assumption that, if wrong, kills it).

3. **Score against the criteria that matter, then state the decision rule.** Build the little table
   (value, effort, risk, fit — or whatever this decision actually turns on) and, crucially, write
   down *how* you're deciding: highest value within the effort budget? lowest risk that clears a
   value bar? The rule is what makes the choice defensible instead of a vibe.

4. **Converge — commit to one direction, and say why now.** The chosen concept is what the next
   phase builds on. Don't hedge into "we'll do a bit of each"; that's the failure mode this phase
   exists to prevent.

5. **Record the rejected alternatives as ADR seeds.** One bullet each — "Rejected X because Y." A
   rejected concept is a decision worth keeping so it isn't relitigated three weeks in. In
   greenfield these become `decisions[]` entries in `plan.json`; on an existing tree they belong in
   an ADR under `docs/adr/`.

---

## Grounding — blank vs seeded

- **Blank** (`--brainstorm --out <fresh-dir>`): a pure idea. The concepts are yours to invent;
  ground them in what the user tells you, not in wishful market claims.
- **Seeded** (`--brainstorm --out <reconstruction-dir>`, where the dir already has `inventory.json`):
  the scaffold is pre-filled with the **recovered surface** — features, operations, entities, enums,
  locales. Now you're brainstorming **evolutions of a real system**: every concept must respect what
  exists (don't propose rebuilding what's already there), and each should name which existing
  features/entities it extends, changes, or deprecates. Ground each concept in the recovered PRDs the
  way a repo-mode requirement is grounded in source — an evolution that ignores the current data
  model is as unfaithful as an invented requirement.

---

## Handoff — where the chosen direction goes

- **→ Greenfield interview.** The chosen concept becomes the seed for `scratch-playbook.md`: it is
  `project.summary`, its differentiators shape the feature wishlist, and each rejected alternative is
  a `decisions[]` entry. Then run the interview to resolve the full contract → `plan.json` →
  `--scratch`.
- **→ Iteration PRDs (existing tree).** On a seeded brainstorm, turn the chosen direction into
  new or changed `features/<slug>/PRD.md` on the existing reconstruction, then run the normal
  enrich → `--check` → `--review` loop so the evolution is as buildable and grounded as the rest of
  the tree.

---

## The gate

`node scripts/analyze.mjs --check --out <DIR>` gates a brainstorm the same way it gates a
reconstruction: every unresolved `> 🧠` callout and every `fill this in` placeholder is an error.
A brainstorm-only directory (a `BRAINSTORM.md` with no `inventory.json`) is checked on the
scaffolding scan alone; a `BRAINSTORM.md` inside a full reconstruction tree is scanned along with
everything else. Either way: no unresolved callouts, or it's not a decision yet.
