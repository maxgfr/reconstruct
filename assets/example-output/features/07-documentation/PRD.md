# Documentation

> Unit `07-documentation` · kind: documentation

## Summary

1 documentation file(s).

## Context & goal

Provide the project's README so a reader understands what the repository is. The
outcome is a developer opening `README.md` and learning that this is a tiny Next.js
fixture used to exercise the reconstruct analyzer.

- **Depends on:** nothing at runtime; it describes the whole app.
- **Depended on by:** nothing at runtime; it is reference material for humans.

## User stories

- As a developer, I can read `README.md` so that I understand the project's purpose and shape at a glance.
- As a new contributor, I can see from the README that this is a reconstruct test fixture so that I do not mistake it for a production app.

## Functional requirements

1. [confirmed] `README.md` opens with the H1 title `# Sample App`.
2. [confirmed] It contains a one-to-two sentence description stating it is a tiny Next.js (App Router) fixture with two pages, one API route, a Prisma schema, and English/French translations, used to exercise the reconstruct analyzer.
3. [confirmed] It provides **no** install/run/build/test instructions and no other sections — the description is the entire content. (Faithful: minimal by design.)
4. [confirmed] It is the only documentation file in the repository.

## Interfaces & data

- **Operations exposed:** none. Documentation exposes no runtime surface.
- **Entities read/written:** none.
- **Enums/domain values:** none.

- **UI / design-system conformance:** not applicable — Markdown documentation renders no application UI.

## Acceptance criteria

- **AC-1:** Given `README.md`, When it is opened, Then the first heading is `# Sample App`.
- **AC-2:** Given `README.md`, When it is read, Then the body describes a Next.js App-Router fixture with two pages, one API route, a Prisma schema, and en/fr translations, used to exercise the reconstruct analyzer.
- **AC-3:** Given `README.md`, When searching for setup/run/test instructions, Then none are present (the file is intentionally minimal). (Faithful gap path.)

## Edge cases & failure modes

- The README is descriptive only; there is no code path, so no runtime failure modes exist.
- Because it documents no setup steps, a newcomer must infer commands from `package.json` (`dev`/`build`/`start`/`lint`) — recorded as a documentation gap, not fixed.

## Source material

Files that implement this unit (rewrite them from the requirements above):

- `README.md`


## Improvements & refactors

- [keep-behavior] Expand the README with a Getting Started section (`npm install`, `npm run dev`, the required env vars from `.env.example`) so the fixture is self-serve — additive, no behavior change.
- [keep-behavior] Note the known gaps (unused `User` model, hardcoded copy, unauthenticated `/api/users`) so readers are not surprised.

## Redesign notes

The README stays at the repository root. No structural change; the redesign only adds
optional documentation sections as an improvement.

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
