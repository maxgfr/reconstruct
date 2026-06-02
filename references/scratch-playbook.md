# Scratch playbook — the from-scratch interview method

This is the methodology for **greenfield** (`--scratch`) mode. There is no repo to read,
so the agent does what the code analyzer would do — it produces the **same inventory**
(stack, data model, interface surface, semantic features) — but it **elicits the facts
from the user** through a grill-with-docs-style interview instead of from source. The
interview's structured output is a `plan.json`; the engine renders the identical PRD tree
plus greenfield docs (`CONTEXT.md`, `docs/adr/`). **The interview is the analysis.**

**Golden rule:** every field you would have *resolved* from code, you now have to *resolve
from the user* — one decision at a time, recommending an answer each time. A vague answer
is a `inventory.unknowns` entry you forgot to close. Don't leave it.

---

## §The interview loop (grill-with-docs, greenfield)

Run a relentless, **one-question-at-a-time** loop. Adapted from `grill-me` /
`grill-with-docs`:

- **Ask exactly one question, then wait for the answer.** Never batch. Each answer
  reshapes the tree you're about to walk, so you cannot pre-write the next three questions.
- **Always recommend an answer.** End every question with the choice you'd make and *why*
  ("I'd model this as one `Order` entity with a status enum rather than two tables —
  fewer joins, same information. Agree?"). The user corrects a default faster than they
  fill a blank.
- **Think before you ask.** If a question can be settled by reasoning from what you already
  know — a sensible default, an industry convention, an answer implied by an earlier reply —
  decide it yourself and *tell* the user the decision rather than asking. Reserve questions
  for genuine forks where the user holds information you can't derive.
- **Walk the decision tree, resolving dependencies first.** Decisions depend on each other:
  the stack constrains the data-model idioms; entities define the interface surface;
  features reference both. Resolve the upstream decision before the ones that hang off it,
  and **let later answers refine earlier ones** — loop back and amend the plan when a feature
  reveals an entity you missed.

---

## §The decision-tree order

Walk roughly in this order. It is dependency-tiered, not rigid — later branches routinely
send you back to sharpen an earlier one.

1. **Project** — name, one-sentence summary, audience, value. This frames everything; get it
   crisp first. ("Who is this for, and what can they do after using it that they couldn't
   before?")
2. **Stack** — primary language, then frameworks, libraries, package managers, TypeScript.
   The stack picks the idioms for everything downstream (ORM shape, routing paradigm).
3. **Data model** — entities, then each entity's fields (name · type · constraints incl.
   PK/FK/nullability/default/unique), indexes, and relations (1-1 / 1-N / N-N). Copy types in
   the user's words; don't paraphrase. Pin down every **enum/domain set** with its *complete*
   member list (→ `plan.enums`), and reference it from the field (`enumRef`). A "status" with
   no members is a `inventory.unknowns` you forgot to close.
4. **Interface surface** — every way the outside world reaches the app: HTTP routes,
   RPC/GraphQL ops, CLI commands, jobs. One row per operation, and for each: method · path ·
   kind · auth · the exact **input** shape · the **output** shape · the **side effects**
   (entities written, transactional?). An operation without a contract isn't buildable.
5. **Contracts & policies** — the categories that are easy to leave implicit and impossible
   to rebuild later (see `references/buildability-checklist.md`):
   - **External services** (→ `plan.services`): email, geocoding, payments, storage, queues —
     provider, exact request/response shape, the function signatures the app calls, timeout,
     failure behavior.
   - **Policies** (→ `plan.policies`): rate limits (concrete thresholds · window · key ·
     store) and format validations (the real regex/checksum/length for coded identifiers, or
     an honest "no validation"), each `appliesTo` its operations/fields.
   - **i18n message catalog** (→ `plan.i18n.messages`): the source locale, the namespaces,
     and the keys with their source strings — naming locales isn't buildable copy.
6. **Features** — the units of behavior a user cares about, each tied to its `interfaces`,
   `entities`, and the subset it **`writes`**. Assign tiers (below). Features often surface a
   missing entity, enum, service, or route — go back. For any public/anonymous write, name an
   **anonymous-capable** entity to write to (one with no owner FK), not a user-owned table.
7. **Glossary** — sharpen the fuzzy terms that surfaced (see §Glossary). Write inline.
8. **Decisions** — only the hard, surprising trade-offs (see §ADRs).

**Tiers** drive the build order in `REBUILD.md`. Tier 0 = foundations (`project-setup`,
`internationalization`); tier 1 = features; tier 2 = docs. If you don't set `tier`, the
engine derives it from `kind`; within a tier the plan's declared order is preserved.

---

## §Glossary — sharpen terms, write CONTEXT.md inline

When the same word means two things, or two words mean one thing, you've found a glossary
entry. Resolve it on the spot and **append it to `CONTEXT.md` as it crystallises** — never
batch the glossary to the end, because a sharpened term changes how you ask the *next*
question.

- **Be opinionated:** pick the canonical term, list the rest as `avoid` aliases.
- **CONTEXT.md is a glossary ONLY** — what a term *is*, plus relationships and cardinality.
  No implementation detail, no how-it-works. Entity relations from the data model seed the
  Relationships section.
- Follow `references/CONTEXT-FORMAT.md` exactly (Language / Relationships / Example dialogue
  / Flagged ambiguities). Only project-specific terms belong; skip general programming
  concepts.

> **You:** "You said 'account' for the thing a user logs into *and* for the billing record.
> Those are different — I'll call the first **User** and the second **Account**. OK?"

Each resolved term becomes a `plan.glossary` entry (`term`, `definition`, `avoid[]`).

---

## §Invent scenarios to force precise answers

Abstract questions get abstract answers. Probe boundaries with concrete, slightly awkward
scenarios that the user must adjudicate — the answer pins down a field, a relation, or a
feature edge.

- **Entity boundary:** "A customer changes their email, then we ship an old order. Does the
  invoice show the *new* email or the one captured at checkout?" → reveals whether email is
  a `User` field or a snapshot on `Order`.
- **Feature boundary:** "An admin deletes a product that sits in three open carts. What does
  the shopper see at checkout?" → reveals soft-delete vs hard-delete, and whether
  "catalog" and "cart" are one feature or two.

Whenever a scenario exposes something the plan doesn't yet cover, fold it back in
immediately.

---

## §Interview area → plan.json mapping

| Interview area | plan.json section | Renders to |
| --- | --- | --- |
| Project (name/summary/audience/value) | `project` | `repoName` + `00-overview` product summary |
| Stack, deps, env vars | `stack` / `dependencies` / `envVars` | overview tech-stack, architecture deps, REBUILD env checklist |
| Entities (fields, relations, indexes, uniques; `enumRef`) | `dataModel` | `architecture/DATA-MODEL.md` pre-filled tables; relations seed `CONTEXT.md` |
| Enums / domain sets (member lists) | `enums` | `architecture/DATA-MODEL.md` `## Enums & domain types` |
| Operations (routes, RPC, CLI, jobs; input/output/sideEffects) | `interfaces` | `architecture/INTERFACES.md` pre-filled table + `## Operation contracts` |
| External services (provider, contract, timeout, failure) | `services` | `architecture/ARCHITECTURE.md` `## External services & integrations` |
| Policies (rate limits, format validations) | `policies` | `architecture/ARCHITECTURE.md` `## Cross-cutting policies` |
| Features (tiers; interfaces/entities/`writes`) | `features` | `features/NN-<slug>/PRD.md`, tiered build order in `REBUILD.md` |
| Locales + message catalog | `i18n.locales` / `i18n.messages` | Internationalization, overview locale count, architecture i18n message catalog |
| Terms | `glossary` | `CONTEXT.md` (format: `references/CONTEXT-FORMAT.md`) |
| Hard decisions | `decisions` | `docs/adr/NNNN-<slug>.md` (format: `references/ADR-FORMAT.md`) |

Defaults fill the gaps: `languages → [primaryLanguage]`, `hasTypeScript` inferred, `i18n →
null`, env/interfaces/dataModel/dependencies empty, `feature.kind → "feature"`, `tier`
derived from `kind`. Only `project.name`, `project.summary`, `stack.primaryLanguage`, and
at least one `feature` are required.

---

## §Offer ADRs sparingly

Most decisions in a greenfield interview are obvious and don't earn an ADR. Offer one only
when **all three** hold (per `references/ADR-FORMAT.md`):

1. **Hard to reverse** — changing your mind later is expensive (DB choice, event-sourcing,
   monorepo, auth provider).
2. **Surprising without context** — a future reader will wonder "why on earth this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one
   for specific reasons.

If it's easy to reverse, skip it. If it's unsurprising, nobody will wonder. If there was no
alternative, there's nothing to record. Each kept decision is a `plan.decisions` entry
(`title`, `context`, `decision`, `why`) → one terse ADR. Keep them to a sentence or three.

---

## §light vs complex

- **light** — capture the **MVP exactly as described**. Resolve the entities, interfaces,
  and features the user states; recommend sane defaults; don't editorialize. The tree mirrors
  what they said and no more.
- **complex** — go deeper. Probe harder, propose **alternatives** ("you could split this into
  a read model and a write model — worth it?") and **enhancements** the user might want,
  surface **more ADRs** (the extra forks you opened are exactly the trade-offs worth
  recording), and **recommend `--tdd`** so each unit is built test-first (red → green →
  refactor) with that guidance baked into the PRDs and `REBUILD.md`. Set `plan.tdd: true`
  (or pass `--tdd`) once the user opts in.

Either way `--scratch` forces `mode = scratch` and `fidelity = describe` — there is no source
to mirror, so the PRDs must capture requirements precisely enough to rewrite from nothing.

---

## §The hand-off

1. **Write `plan.json`** from the interview — the structured transcript of every resolved
   decision. Validate the required fields are present, and that it is **internally
   consistent**: every `features[].entities`/`writes` is a real entity, every
   `features[].interfaces` is a real operation, every `enumRef` names a defined enum, and no
   public/anonymous write targets an owner-FK table. The engine enforces this — `--scratch`
   **fails fast** on a dangling reference or empty enum, and **warns** on an anonymous write
   to an owner-FK entity. Fix every error and resolve every warning before enriching.
2. **Run the engine:**

   ```bash
   node scripts/analyze.mjs --scratch --plan <plan.json> --out <OUT> --level <light|complex> [--tdd] [--merge] [--summary]
   ```

   It renders the full tree: `REBUILD.md`, `00-overview/PRD.md`,
   `architecture/{ARCHITECTURE,INTERFACES,DATA-MODEL,diagram}.md` (INTERFACES/DATA-MODEL
   **pre-filled** from the plan), `inventory.json`, `features/NN-<slug>/PRD.md`, and — written
   **if-absent** so your richer interview versions are never clobbered — `CONTEXT.md` and
   `docs/adr/NNNN-<slug>.md`. `00-overview` links back to `../CONTEXT.md` and `../docs/adr/`.
3. **Enrich the scaffold to full PRD depth.** The engine pre-fills tables and scaffolding;
   **you fill the `> 🧠` callouts** in each feature PRD and remove them. Complete the whole
   spine — *Context & goal · User stories · Functional requirements · Interfaces & data ·
   Acceptance criteria (Given/When/Then) · Edge cases & failure modes · Definition of done* —
   exhaustively, and write the architecture prose. Use the interview, `CONTEXT.md`, and the
   ADRs as **ground truth** (the same role `source/` + `data/` play in code mode). At complex
   level, fill the **Enhancements & alternatives** section (mark extras `[post-MVP]`); with
   `--tdd`, frame each unit's requirements as the tests to write first. **A 🧠 callout left in
   place means the unit isn't done.**

You're done when every `> 🧠` callout is resolved, `INTERFACES.md` and `DATA-MODEL.md`
match the interview (enums enumerated, operation contracts and write contracts spelled out,
services and policies concrete, the message catalog complete), `CONTEXT.md` names every
fuzzy term, and `REBUILD.md`'s tiered build order is one an agent can follow from the first
foundation to the last doc.

Then run the buildability gate — it must pass:

```bash
node scripts/analyze.mjs --check --out <OUT>
```

It fails on unresolved `🧠`/placeholders, a feature that references an undocumented entity or
operation, a feature PRD missing its spine, or an uncovered locale. The full category list —
the eight contract categories and the consistency self-review — is in
`references/buildability-checklist.md`. Work it until both the consistency review and
`--check` are clean.
