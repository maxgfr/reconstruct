# Core

> Unit `01-core` · kind: feature

## Summary

Groups 3 file(s); routes: /.

## Context & goal

Deliver the application's landing page at `/` and the two shared building blocks the
rest of the app is meant to reuse: the `Button` UI primitive and the `lib/auth.ts`
environment-variable readers. The user-facing outcome is a visitor loading `/` and
seeing a "Welcome" heading with a "Get started" button.

- **Depends on:** `02-project-setup` (Next.js/React toolchain and env vars).
- **Depended on by:** `04-api` (consumes `getSessionSecret` from `lib/auth.ts`); `06-dashboard` and `05-internationalization` share the same rendering conventions; `Button` is available to any page.

## User stories

- As an anonymous visitor, I can open `/` so that I see the app's landing page ("Welcome" + a "Get started" button).
- As an anonymous visitor, I can activate the "Get started" button with mouse or keyboard so that the native button responds (it has no handler, so nothing navigates — faithful).
- As a developer, I can render `<Button label="…" />` so that I get a consistent native button without re-implementing markup.
- As a developer, I can call `getSessionSecret()` so that I read `NEXTAUTH_SECRET` safely (empty string when unset) without a throw.
- As a developer, I can call `databaseUrl()` so that I read `DATABASE_URL` safely (empty string when unset).

## Functional requirements

1. [confirmed] `GET /` renders a `<main>` element containing exactly one `<h1>` whose text is `Welcome`.
2. [confirmed] The home page renders the shared `Button` primitive with `label="Get started"`, producing `<button type="button">Get started</button>`.
3. [confirmed] The home page hardcodes its copy (`"Welcome"`, `"Get started"`) and does NOT read the `messages/*.json` i18n catalog, so it renders English regardless of the active locale. (Faithful gap.)
4. [confirmed] `Button({ label }: { label: string })` renders `<button type="button">{label}</button>` — one required `label` string prop, no other props, no variants, no `onClick`, no children.
5. [confirmed] `lib/auth.ts` exports `getSessionSecret(): string` returning `process.env.NEXTAUTH_SECRET ?? ""`; it performs no validation and never throws.
6. [confirmed] `lib/auth.ts` exports `databaseUrl(): string` returning `process.env.DATABASE_URL ?? ""`; it is a pure env read and is never called anywhere in the source. (Faithful gap: dead code preserved.)
7. [confirmed] `GET /` fetches no data, declares no dynamic segments, writes no entity, and requires no authentication (public).

## Routes

| Method | Route | Kind | File |
| --- | --- | --- | --- |
| — | `/` | page | `app/page.tsx` |

## Interfaces & data

- **Operations exposed:** `GET /` (page, HTML) — see `../../architecture/INTERFACES.md` (§`GET /`). Input: none. Output: `<main><h1>Welcome</h1><Button label="Get started"/></main>`. Auth: none (public).
- **Helpers provided (not HTTP operations):** `getSessionSecret()` and `databaseUrl()` from `lib/auth.ts`, both `() => string`. `getSessionSecret` is consumed by `04-api`.
- **Entities read/written:** none. This unit performs no database access; see `../../architecture/DATA-MODEL.md` (the `User` entity is not touched here). There are no mutations, so there is no write contract to satisfy.
- **Enums/domain values:** none used.

- **UI / design-system conformance:** per `../../architecture/DESIGN-SYSTEM.md`, this unit adds no styling — it renders unstyled semantic HTML (`main`, `h1`, native `button`). It consumes zero design tokens (there are none), uses the native `Button` primitive in its only (default) state, and adds no ARIA. Accessibility target: native semantics, keyboard-focusable button, preserved heading order (`h1` on `/`). There is no empty/loading/error state because the page fetches nothing.

## Acceptance criteria

- **AC-1:** Given any visitor, When they GET `/`, Then the response is HTML containing `<h1>Welcome</h1>` inside a `<main>`.
- **AC-2:** Given the home page renders, When inspecting the DOM, Then there is exactly one `<button type="button">` whose text is `Get started`.
- **AC-3:** Given the active locale is `fr`, When a visitor loads `/`, Then the copy is still English (`Welcome` / `Get started`) because the page never consults the catalog. (Faithful gap path.)
- **AC-4:** Given `Button` is rendered with `label="X"`, When it mounts, Then it outputs exactly `<button type="button">X</button>` and nothing else.
- **AC-5:** Given `NEXTAUTH_SECRET` is unset, When `getSessionSecret()` is called, Then it returns `""` (empty string) — not `undefined` — and does not throw.
- **AC-6:** Given `DATABASE_URL="postgresql://localhost:5432/sample"`, When `databaseUrl()` is called, Then it returns that exact string.
- **AC-7:** Given a visitor GETs `/`, When the response completes, Then no database query was issued and no entity was written.

## Edge cases & failure modes

- Missing/empty `NEXTAUTH_SECRET` → `getSessionSecret()` returns `""` (no throw). Missing/empty `DATABASE_URL` → `databaseUrl()` returns `""` (no throw).
- `Button` rendered with `label=""` → renders an empty-text button; there is no validation and no error state (faithful).
- Active locale `fr` (or any non-`en`) → home copy stays English because the catalog is never read (faithful gap; not an error).
- `/` requires no auth, so there is no unauthenticated failure path — it is always public and always 200.
- No concurrency, race, retry, or idempotency concerns: the page and helpers are pure/stateless and touch no shared store.

## Source material

Files that implement this unit (rewrite them from the requirements above):

- `app/page.tsx`
- `components/Button.tsx`
- `lib/auth.ts`


## Improvements & refactors

- [keep-behavior] Route the home copy through the i18n catalog (`home.title`, `home.cta`) instead of hardcoding, so `fr` renders "Bienvenue"/"Commencer". Opt-in only — it changes rendered output under a non-`en` locale.
- [keep-behavior] Rename `lib/auth.ts` to `lib/env.ts`: the functions are env readers, not auth. Signatures unchanged.
- [keep-behavior] Remove the unused `databaseUrl()` export, or wire it to a Prisma client — currently dead code. Keep it if fidelity to the fixture matters.
- [keep-behavior] Give `Button` an optional `type`/`onClick`/`disabled` prop set with sensible defaults so it can be reused for real interactions, defaulting to today's `type="button"` behavior.

## Redesign notes

Under the proposed layout in `architecture/ARCHITECTURE.md`: `app/page.tsx` stays the
`/` route (add a root `app/layout.tsx` to make the app runnable — no output change);
`components/Button.tsx` remains the design-system entry point; `lib/auth.ts` moves to
`lib/env.ts`. This unit exposes only the `GET /` page and the two env helpers; no
interface or payload changes.

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
