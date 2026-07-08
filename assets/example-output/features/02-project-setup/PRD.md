# Project Setup & Tooling

> Unit `02-project-setup` · kind: project-setup

## Summary

3 configuration/tooling file(s): build, lint, env, CI.

## Context & goal

Establish the project's build/run/lint toolchain, dependency set, Next.js
configuration, and the environment-variable contract every other unit relies on. The
outcome for a developer is a repository that installs, runs (`next dev`), builds, and
lints with the exact pinned dependency ranges of the original.

- **Depends on:** nothing (this is the foundation tier).
- **Depended on by:** every other unit — all pages, the API route, Prisma, and i18n need this toolchain and the two env vars.

## User stories

- As a developer, I can run `npm run dev` / `build` / `start` / `lint` so that I can develop, ship, and lint the app with Next.js.
- As a developer, I can install the declared dependencies so that the pinned versions of Next 14, React 18, TypeScript 5.5, Tailwind, Zod, and Playwright are present.
- As a developer, I can copy `.env.example` so that I know the exact env vars the app expects (`DATABASE_URL`, `NEXTAUTH_SECRET`).
- As a developer, I can read `next.config.js` so that I know React strict mode is on and which (inert) i18n locales are declared.

## Functional requirements

1. [confirmed] `package.json` declares name `sample-app`, version `1.0.0`, `private: true`, and scripts `dev` → `next dev`, `build` → `next build`, `start` → `next start`, `lint` → `next lint`.
2. [confirmed] Runtime dependencies are exactly: `next@^14.2.0`, `react@^18.3.0`, `react-dom@^18.3.0`, `zod@^3.23.0`, `tailwindcss@^3.4.0`.
3. [confirmed] Dev dependencies are exactly: `typescript@^5.5.0`, `@types/react@^18.3.0`, `@playwright/test@^1.48.0`.
4. [confirmed] `zod`, `tailwindcss`, and `@playwright/test` are declared but never imported/configured/used anywhere in the source (no schema validation, no `tailwind.config`, no `@tailwind` directives, no test files). (Faithful gap.)
5. [confirmed] `next.config.js` sets `reactStrictMode: true`.
6. [inferred] `next.config.js` declares `i18n: { locales: ["en", "fr"], defaultLocale: "en" }`, which is a **Pages-Router** option; under this app's App Router it is inert (no `/en`, `/fr` locale-prefixed routing is produced). (Faithful gap.)
7. [confirmed] `.env.example` documents exactly two variables with example values: `DATABASE_URL=postgresql://localhost:5432/sample` and `NEXTAUTH_SECRET=changeme`.
8. [confirmed] No `tsconfig.json` and no `tailwind.config.*` exist in the source; TypeScript and Tailwind are present as dependencies only, with no config files. (Faithful gap: a real build would need a `tsconfig.json`.)

## Interfaces & data

- **Operations exposed:** none. This unit exposes no HTTP routes, RPC procedures, jobs, or CLI commands.
- **Entities read/written:** none. No database access; the `User` entity in `../../architecture/DATA-MODEL.md` is not touched here. No mutations, so no write contract applies.
- **Env-var contract (provided to the whole app):** `DATABASE_URL` (Prisma datasource; example `postgresql://localhost:5432/sample`) and `NEXTAUTH_SECRET` (read by `lib/auth.ts#getSessionSecret`; example `changeme`). Both are consumed via `process.env` with an empty-string fallback (see `01-core`).
- **Enums/domain values:** none.

- **UI / design-system conformance:** not applicable — this unit renders no UI. It only configures the toolchain; see `../../architecture/DESIGN-SYSTEM.md` for why the visual contract is "Tailwind installed but unused."

## Acceptance criteria

- **AC-1:** Given the repository, When `npm run dev` is invoked, Then it executes `next dev` (and `build`→`next build`, `start`→`next start`, `lint`→`next lint`).
- **AC-2:** Given `package.json`, When reading `dependencies`, Then `next`, `react`, `react-dom`, `zod`, and `tailwindcss` are present at exactly `^14.2.0`, `^18.3.0`, `^18.3.0`, `^3.23.0`, `^3.4.0` respectively.
- **AC-3:** Given `package.json`, When reading `devDependencies`, Then `typescript@^5.5.0`, `@types/react@^18.3.0`, and `@playwright/test@^1.48.0` are present.
- **AC-4:** Given the source tree, When grepping for `zod`, `@playwright/test`, and Tailwind usage, Then there are zero imports/uses (the deps are declared-but-unused). (Faithful gap path.)
- **AC-5:** Given `next.config.js`, When Next loads it, Then `reactStrictMode` is `true`.
- **AC-6:** Given the App Router is in use, When `next.config.js`'s `i18n` key is evaluated, Then no locale-prefixed routes exist (the key is inert). (Faithful gap path.)
- **AC-7:** Given `.env.example`, When a developer copies it to `.env`, Then exactly `DATABASE_URL` and `NEXTAUTH_SECRET` are documented, with the example values above.
- **AC-8:** Given the source tree, When looking for `tsconfig.json` or `tailwind.config.*`, Then neither file exists. (Faithful gap path.)

## Edge cases & failure modes

- Missing `.env` at runtime → the app still boots; `getSessionSecret()`/`databaseUrl()` return `""` and `GET /api/users` yields `{ users: [] }` (no crash).
- Absent `tsconfig.json` → `tsc`/`next build` would need one added; the fixture as shipped does not provide it (a real build gap, recorded not fixed).
- Unused deps (`zod`, `@playwright/test`, `tailwindcss`) → present in the lockfile but never imported; removing them would not change behavior, but a faithful rebuild keeps them.
- `i18n` in `next.config.js` under the App Router → silently ignored; do not expect locale routing.
- No concurrency/retry/idempotency concerns — this unit is static configuration.

## Source material

Files that implement this unit (rewrite them from the requirements above):

- `.env.example`
- `next.config.js`
- `package.json`


## Improvements & refactors

- [keep-behavior] Add a `tsconfig.json` (Next.js default) so the TypeScript dependency is actually usable — required for a real build, but absent in the fixture.
- [keep-behavior] Remove the three unused dependencies (`zod`, `@playwright/test`, `tailwindcss`) or start using them; today they only inflate `node_modules`.
- [keep-behavior] Move the inert Pages-Router `i18n` config to an App-Router i18n approach (e.g. `next-intl` with a `[locale]` segment) if locale routing is ever wanted.
- [keep-behavior] Add a `.nvmrc`/`engines` field to pin Node; the fixture pins none.

## Redesign notes

Under the proposed layout in `architecture/ARCHITECTURE.md`, this unit still owns the
root config files. The only structural addition is a root `app/layout.tsx` (needed for
a runnable App-Router app) — configuration values (`reactStrictMode`, the env-var
names) are unchanged.

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
