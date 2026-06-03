# Core

> Unit `01-core` · kind: feature

## Summary

Groups 3 file(s); routes: /.

## Context & goal

> 🧠 **For the AI agent:** State this unit's user-facing goal in 1–2 sentences (the outcome a user gets), and name the other units it depends on and that depend on it. Derive it from the source material below.


## User stories

> 🧠 **For the AI agent:** Enumerate **every** actor and what they need, one line each — `As a <role>, I can <action> so that <value>.` Be **exhaustive**: cover every role and every distinct behaviour, not just the happy path. This list is the backbone of the PRD; nothing below should exist without a story above it.


## Functional requirements

> 🧠 **For the AI agent:** Turn the stories into a **numbered** checklist of precise, testable behaviours, derived from the source material below. Cover happy paths, every edge case, every validation rule, and every error state. Leave nothing as "etc." or "and so on" — if you write a placeholder, you are not done.


## Routes

| Method | Route | Kind | File |
| --- | --- | --- | --- |
| — | `/` | page | `app/page.tsx` |

## Interfaces & data

> 🧠 **For the AI agent:** List **every** operation this unit exposes with its input/output shape (link `../../architecture/INTERFACES.md`), and **every** entity it reads or writes (link `../../architecture/DATA-MODEL.md`). Spell out the **write contract** for each mutation: which entities are written, whether the write is transactional, and — for every required (NOT NULL, no-default) column and foreign key — where the value comes from. A public/anonymous operation cannot satisfy an owner foreign key: it must write to an anonymous-capable entity instead. Every enum/domain value it accepts must be one of the members enumerated in `DATA-MODEL.md`.


## Acceptance criteria

> 🧠 **For the AI agent:** Write **Given / When / Then** scenarios that gate "done" — at least one per functional requirement, **including** the failure paths. Example: `Given an unauthenticated visitor, When they POST a todo, Then the API responds 401 and writes nothing.` These scenarios are the spec the rebuild is verified against.


## Edge cases & failure modes

> 🧠 **For the AI agent:** Enumerate what can go wrong and the expected behaviour for each: invalid / empty / oversized input, auth & permission failures, concurrency / race conditions, missing or slow dependencies, partial failures, and idempotency / retries. Each row here should map to an error-path requirement above.


## Source material

Files that implement this unit (rewrite them from the requirements above):

- `app/page.tsx`
- `components/Button.tsx`
- `lib/auth.ts`


## Improvements & refactors

> 🧠 **For the AI agent:** Propose concrete improvements for this unit: better types, dead-code removal, performance, accessibility, security, and tests. Mark each as `[keep-behavior]` so the rebuild stays functionally identical unless the user opts in.


## Redesign notes

> 🧠 **For the AI agent:** Map this unit onto the new architecture from `architecture/ARCHITECTURE.md`. Note where its files should live and which interfaces it exposes.


## Definition of done

- [ ] Every functional requirement is implemented and covered by a test.
- [ ] Every acceptance-criteria scenario passes (including the failure paths).
- [ ] Every operation this unit owns in `architecture/INTERFACES.md` responds correctly.
- [ ] Every entity it writes matches `architecture/DATA-MODEL.md` (fields, types, constraints).
- [ ] Every write is satisfiable against the schema: no required (NOT NULL, no-default) column or foreign key is left unfilled; anonymous/public operations write only to anonymous-capable entities (no owner FK).
- [ ] Every enum/domain value this unit uses is one of the members fully enumerated in `architecture/DATA-MODEL.md`.
- [ ] Every edge case & failure mode above is handled.
- [ ] Every user-facing string has a source string in the message catalog and resolves in every locale (no missing keys, no hard-coded copy).
- [ ] `node scripts/analyze.mjs --check --out <out>` passes — no unresolved agent callouts or placeholders, and every reference resolves.
