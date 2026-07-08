# sample-app — Reconstruction Overview

| Setting | Value |
| --- | --- |
| Mode | `redesign` |
| Level | `complex` |
| Fidelity | `describe` |
| Generated with | `reconstruct@1.3.0` |

## Product summary

**sample-app** is a tiny Next.js 14 (App Router) reference application used to
exercise the reconstruct analyzer. It serves two server-rendered pages — a home page
at `/` ("Welcome" plus a "Get started" button) and a dashboard at `/dashboard`
("Dashboard" / "Private area.") — and one JSON route handler, `GET /api/users`, that
returns a hardcoded two-name list gated on whether `NEXTAUTH_SECRET` is set. It
declares a Prisma `User` model (PostgreSQL) and English/French message catalogs.

Its audience is the reconstruct test suite, not end users: it is intentionally
minimal and, faithfully, several declared capabilities are wired but never exercised —
the `User` model is never queried, the pages hardcode copy instead of reading the i18n
catalog, `/api/users` performs no real authentication, `/dashboard` is not
access-controlled, and `zod`/`tailwindcss`/`@playwright/test` are dependencies with no
usage. The core value of the reconstruction is to capture that exact behavior —
including the gaps — precisely enough that a fresh agent rebuilds the same app.


## Tech stack

- **Primary language:** TypeScript
- **Languages:** TypeScript, JavaScript
- **Frameworks:** Next.js, React
- **Libraries:** Tailwind CSS, Zod, Playwright
- **Package managers:** npm
- **TypeScript:** yes

## Metrics

- Files analyzed: **12** (113 lines)
- Features/modules: **7**
- Routes: **3**
- Locales: **2**
- Tracked env vars: **2**

## Feature index

- [`01-core`](../features/01-core/PRD.md) — **Core**: Groups 3 file(s); routes: /.
- [`02-project-setup`](../features/02-project-setup/PRD.md) — **Project Setup & Tooling**: 3 configuration/tooling file(s): build, lint, env, CI.
- [`03-prisma`](../features/03-prisma/PRD.md) — **Prisma**: Groups 1 file(s).
- [`04-api`](../features/04-api/PRD.md) — **API**: Groups 1 file(s); routes: /api/users.
- [`05-internationalization`](../features/05-internationalization/PRD.md) — **Internationalization**: 2 locale(s) (en, fr), up to 3 keys per locale.
- [`06-dashboard`](../features/06-dashboard/PRD.md) — **Dashboard**: Groups 1 file(s); routes: /dashboard.
- [`07-documentation`](../features/07-documentation/PRD.md) — **Documentation**: 1 documentation file(s).

## How to use this output

1. Read `architecture/ARCHITECTURE.md` for the overall shape, then `architecture/INTERFACES.md` (the full interface surface) and `architecture/DATA-MODEL.md` (entities & relations).
2. Rebuild feature by feature using each `features/<slug>/PRD.md`, in the order listed in `REBUILD.md`.
3. Use `data/` (translations, schema, config) and — when present — `source/` as ground truth.

## Redesign note

This run is in **redesign** mode: every feature's observable behavior and logic is
preserved exactly — including the faithful gaps listed in the product summary (a
redesign preserves the contract, it does not "fix" the fixture) — while
`architecture/ARCHITECTURE.md` proposes a cleaner module layout (a root
`app/layout.tsx`, `lib/auth.ts` renamed to `lib/env.ts`, an optional Prisma client
singleton). Each proposed change is marked `[keep-behavior]`, so a rebuild that adopts
the new structure still produces byte-for-byte the same routes, payloads, and copy.

