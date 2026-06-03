# Buildability checklist — the contract a PRD must carry

A reconstruction is **buildable** when a fresh agent — with no access to the
original product and no access to the conversation that produced the PRDs — can
rebuild each unit *correctly* from its PRD plus the architecture docs alone. The
recurring reason that fails is not missing prose; it is a missing **contract**.
The deterministic engine scaffolds the shape; **you** supply the contract, in
both modes (reverse-engineered from code, and from-scratch from the interview).

Run the gate when you think you're done:

```bash
node scripts/analyze.mjs --check --out <OUT>
```

It exits non-zero on the structural failures (unresolved `🧠` callouts or
`fill this in` placeholders, a feature that references an undocumented entity or
operation, a feature PRD missing its spine or left content-less, or an
architecture doc emptied of its contract — no entities in `DATA-MODEL.md`, no
operations in `INTERFACES.md`). An uncovered locale is a **warning**, not a
non-zero exit. A clean `--check` is necessary, not sufficient — the categories
below are the rest.

## The nine contract categories

Every one of these is a category the verification found *named but not
specified*. Naming is not enough; capture the contract.

1. **Data model — field-level.** Every entity, every field: exact type,
   nullability, PK, FK (+ target *and* `on delete` behavior), default, unique
   constraints, indexes. Copy types verbatim; never paraphrase. (→ `DATA-MODEL.md`.)

2. **Enums & domain sets — full member lists.** Every `enum`/`status`/`type`/
   `role`/`category` field must enumerate its **complete** member set. A field
   typed `enum` with no members is untestable ("unknown value → rejected" cannot
   be written). Put shared sets in the `## Enums & domain types` section and
   reference them. (→ `DATA-MODEL.md`.)

3. **Operation contracts.** Every route / RPC / endpoint / job: exact **input**
   shape (fields + types + validation rules), exact **output** shape, the
   **auth/permission** rule, and the **side effects** (which entities are
   written, and which writes are transactional). (→ `INTERFACES.md` + each
   feature PRD.)

4. **Write satisfiability.** For every mutation, every required column (NOT NULL,
   no default) and every foreign key must have a stated source. A **public /
   anonymous** operation cannot satisfy an owner foreign key — it must write to
   an **anonymous-capable** entity (e.g. a `contactRequests` table), not to one
   that requires a logged-in user. This is the single failure that made the
   original Public Directory PRD impossible to build.

5. **Format validations.** Coded identifiers (national registry numbers, slugs,
   phone, IBAN…) need the actual rule — length, regex, checksum, examples of a
   valid and an invalid value — not just the registry's name. If the source has
   no real validation, **say so** rather than implying one. (→ `## Cross-cutting
   policies`.)

6. **External services.** Every third-party integration (email, geocoding,
   payments, storage, queues): provider, the exact request/response shape,
   timeout, and the failure behavior (best-effort vs hard error). The functions
   the app calls need their **exact parameter shapes**. (→ `## External
   services & integrations`.)

7. **Cross-cutting policies — quantified.** Rate limits with concrete thresholds,
   window, key strategy, and store. Security policies. A `SHOULD rate-limit` with
   no numbers is untestable. (→ `## Cross-cutting policies`.)

8. **i18n message catalog.** Every user-facing key with its **source string**,
   in the source locale, resolving in **every** locale. Namespaces alone are not
   buildable copy. (Code mode: the real files are copied to `data/translations/`
   verbatim. Scratch mode: author the catalog — namespaces + keys + source
   strings.)

9. **Shared & owned UI components.** For a unit that renders UI, the contract of
   each shared or owned component it consumes or builds — props/inputs, the states
   it must render (empty / loading / error / populated), validation, and which
   design-system primitives it uses. A component named but not contracted (e.g.
   `BookingCard`, `AvailabilityCalendar`) can't be rebuilt to a fixed spec, and a
   structural acceptance criterion ("renders an h1", "two-card CTA") can't be
   verified against one.

Helpers the unit calls (e.g. `sendWelcomeEmail`) need their exact signatures too;
fold them into category 3 (side effects) or 6 (services).

## The consistency self-review

Before `--check`, re-read every feature PRD against the architecture docs and
confirm — this catches the semantic contradictions a linter can't:

- Every entity/operation the feature names exists in `DATA-MODEL.md` /
  `INTERFACES.md`, with the **same** field names, types, and constraints (no
  drift — don't invent a column or a locale the data model doesn't have).
- Every write is **satisfiable** (category 4).
- Every enum value the feature uses is a member listed in `DATA-MODEL.md`.
- The locale set in the feature matches the project's declared locales exactly.
- Two features that touch the same entity agree on its shape.

## The self-test

> Could a fresh agent rebuild this unit from its PRD + the architecture docs
> alone — no original product, no conversation — and get the **contracts**
> right, not just the gist? If any of the nine categories is named but not
> specified, the answer is no. Dig further.
