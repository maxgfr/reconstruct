# Internationalization

> Unit `05-internationalization` · kind: internationalization

## Summary

2 locale(s) (en, fr), up to 3 keys per locale.

## Context & goal

Provide the English and French message catalogs (`messages/en.json`,
`messages/fr.json`) that define the app's user-facing copy. The intended outcome is
localized text for the home and dashboard screens. Faithfully, the catalogs exist and
are complete/parallel, but the pages do **not** consume them — copy is hardcoded — so
this unit's deliverable is the catalog data itself.

- **Depends on:** `02-project-setup` (`next.config.js` declares the `en`/`fr` locales, albeit inert under the App Router).
- **Depended on by:** `01-core` and `06-dashboard` *should* read these strings but currently hardcode them instead.

## User stories

- As a developer, I can read `messages/en.json` / `messages/fr.json` so that I have the source strings for the `home` and `dashboard` namespaces in both locales.
- As a translator, I can add a locale file so that the catalog structure (namespaces `home`, `dashboard`) is clear and parallel across languages.
- As a maintainer, I can see that the pages hardcode copy so that I know the catalogs are declared-but-unused today.

## Functional requirements

1. [confirmed] `messages/en.json` defines namespace `home` with `title = "Welcome"` and `cta = "Get started"`, and namespace `dashboard` with `title = "Dashboard"`.
2. [confirmed] `messages/fr.json` defines the same keys with French values: `home.title = "Bienvenue"`, `home.cta = "Commencer"`, `dashboard.title = "Tableau de bord"`.
3. [confirmed] Both locales carry the identical key set — exactly three keys each (`home.title`, `home.cta`, `dashboard.title`) — with full parity (no key present in one locale and missing in the other).
4. [confirmed] The catalogs are **never loaded** by the app: no `next-intl`/`useTranslations`/`getTranslations`/JSON import references them. The pages render hardcoded literals instead. (Faithful gap.)
5. [confirmed] The string `"Private area."` rendered on `/dashboard` has **no** catalog key in either locale — it is hardcoded and untranslatable as shipped. (Faithful gap.)
6. [inferred] The declared locales (`en`, `fr`, default `en`) come from `next.config.js`'s `i18n` block, which is a Pages-Router option and is inert under this App-Router app — so there is no locale-prefixed routing to switch between the catalogs even if they were used. (See `02-project-setup`.)

## Interfaces & data

- **Operations exposed:** none. This unit ships data files, not endpoints.
- **Entities read/written:** none. No database access.
- **Message catalog (the deliverable):** see `../../architecture/ARCHITECTURE.md` (§Internationalization) for the full table. Source (`en`) → `fr`:
  - `home.title`: `Welcome` → `Bienvenue`
  - `home.cta`: `Get started` → `Commencer`
  - `dashboard.title`: `Dashboard` → `Tableau de bord`
- **Enums/domain values:** none.

- **UI / design-system conformance:** not applicable — this unit renders no UI itself; it supplies strings the pages could render.

## Acceptance criteria

- **AC-1:** Given `messages/en.json`, When it is parsed, Then `home.title === "Welcome"`, `home.cta === "Get started"`, and `dashboard.title === "Dashboard"`.
- **AC-2:** Given `messages/fr.json`, When it is parsed, Then `home.title === "Bienvenue"`, `home.cta === "Commencer"`, and `dashboard.title === "Tableau de bord"`.
- **AC-3:** Given both catalogs, When their key sets are compared, Then they are identical (three keys each, full parity, no missing translation).
- **AC-4:** Given the source tree, When grepping for catalog loaders (`next-intl`, `useTranslations`, imports of `messages/*.json`), Then there are zero references — the catalogs are unused. (Faithful gap path.)
- **AC-5:** Given `/dashboard` renders `"Private area."`, When searching either catalog for that string, Then no key maps to it. (Faithful gap path.)

## Edge cases & failure modes

- Adding a third locale → would need a new `messages/<loc>.json` with the same three keys; the app would still not display it (catalogs unused).
- Missing a key in one locale → would break parity; today parity holds, so this is only a guard for future edits.
- The `"Private area."` string cannot be localized without first adding a `dashboard.subtitle` (or similar) key — recorded, not fixed.
- No runtime failure path: these are static JSON assets; a malformed file would fail at build/import time, but nothing imports them today.

## Source material

Files that implement this unit (rewrite them from the requirements above):

- `messages/en.json`
- `messages/fr.json`


## Improvements & refactors

- [keep-behavior] Introduce `next-intl` (App-Router `[locale]` segment) and route page copy through these catalogs so `fr` actually renders — opt-in, changes behavior.
- [keep-behavior] Add a `dashboard.subtitle` key mapping to "Private area." / "Zone privée." so that string becomes translatable.
- [keep-behavior] Add a key-parity test that fails if `en` and `fr` diverge.

## Redesign notes

Under the proposed layout in `architecture/ARCHITECTURE.md`, the catalogs stay in
`messages/`. Wiring them is an opt-in improvement; the redesign preserves today's
hardcoded, English-only rendering by default so behavior is unchanged.

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
