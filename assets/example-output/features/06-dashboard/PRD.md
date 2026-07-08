# Dashboard

> Unit `06-dashboard` · kind: feature

## Summary

Groups 1 file(s); routes: /dashboard.

## Context & goal

Serve the `/dashboard` page — a static screen that displays a "Dashboard" heading and
a "Private area." line. The outcome for a visitor is that page rendering. Faithfully,
despite the "Private area." wording, the page is **public and static**: there is no
authentication, no data, and no redirect.

- **Depends on:** `02-project-setup` (Next.js/React toolchain).
- **Depended on by:** nothing links to it in the source; it is a standalone route.

## User stories

- As any visitor, I can open `/dashboard` so that I see the "Dashboard" heading and "Private area." text.
- As an unauthenticated visitor, I can open `/dashboard` so that I still see it — there is no gate (faithful: the "private" label is cosmetic).

## Functional requirements

1. [confirmed] `GET /dashboard` renders a `<section>` containing exactly one `<h2>` with text `Dashboard` and one `<p>` with text `Private area.`.
2. [confirmed] The copy is hardcoded (`"Dashboard"`, `"Private area."`) and not read from the i18n catalog; `"Private area."` has no catalog key in either locale. (Faithful gap.)
3. [confirmed] The page is **not access-controlled**: there is no session check, no `redirect()`, and no middleware — any visitor loads it and receives `200`. The "Private area." label does not imply any enforcement. (Faithful gap.)
4. [confirmed] The page fetches no data, declares no dynamic segments, reads/writes no entity, and takes no parameters.

## Routes

| Method | Route | Kind | File |
| --- | --- | --- | --- |
| — | `/dashboard` | page | `app/dashboard/page.tsx` |

## Interfaces & data

- **Operations exposed:** `GET /dashboard` (page, HTML) — see `../../architecture/INTERFACES.md` (§`GET /dashboard`). Input: none. Output: `<section><h2>Dashboard</h2><p>Private area.</p></section>`. Auth: none (public, despite the label).
- **Entities read/written:** none. No access to the `User` entity in `../../architecture/DATA-MODEL.md`; no mutation, so no write contract applies.
- **Enums/domain values:** none.

- **UI / design-system conformance:** per `../../architecture/DESIGN-SYSTEM.md`, unstyled semantic HTML — a `<section>`, an `<h2>` (heading level 2, one below the home `<h1>`), and a `<p>`. Zero design tokens, no `className`, no ARIA. There is no empty/loading/error state because the page fetches nothing.

## Acceptance criteria

- **AC-1:** Given any visitor, When they GET `/dashboard`, Then the response is HTML with an `<h2>Dashboard</h2>` and a `<p>Private area.</p>` inside a `<section>`.
- **AC-2:** Given no session, cookie, or authorization header, When a visitor GETs `/dashboard`, Then it returns `200` and renders normally — no `401`/`403`, no redirect to a login page. (Faithful gap path — the "private" label is not enforced.)
- **AC-3:** Given the active locale is `fr`, When a visitor loads `/dashboard`, Then the copy is still English (`Dashboard` / `Private area.`) because the page never reads the catalog. (Faithful gap path.)
- **AC-4:** Given the page renders, When the response completes, Then no database query ran and no entity was written.

## Edge cases & failure modes

- Unauthenticated access → allowed (public); this is the intended faithful behavior, not an error.
- Non-`en` locale → copy stays English (catalog unused).
- No data dependency → the page cannot fail on a missing database or slow upstream; it is fully static.
- No concurrency/idempotency concerns — stateless render.

## Source material

Files that implement this unit (rewrite them from the requirements above):

- `app/dashboard/page.tsx`


## Improvements & refactors

- [keep-behavior] Enforce the "private" intent: add a session check that redirects unauthenticated visitors to a login route — opt-in, changes behavior (today it is public).
- [keep-behavior] Route the copy through the i18n catalog and add a `dashboard.subtitle` key for "Private area." so it is translatable.
- [keep-behavior] Promote `<h2>` to `<h1>` if `/dashboard` is a standalone page with its own layout, to keep a valid heading hierarchy per screen.

## Redesign notes

Under the proposed layout in `architecture/ARCHITECTURE.md`, the page stays at
`app/dashboard/page.tsx`. The redesign keeps it public and static by default (to
preserve behavior); adding auth is called out as an opt-in improvement, not a redesign
default.

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
