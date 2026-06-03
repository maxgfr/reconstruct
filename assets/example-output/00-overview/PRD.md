# sample-app — Reconstruction Overview

| Setting | Value |
| --- | --- |
| Mode | `redesign` |
| Level | `complex` |
| Fidelity | `describe` |
| Generated with | `reconstruct@0.7.0` |

## Product summary

> 🧠 **For the AI agent:** Write a 1–2 paragraph product summary: what this project does, for whom, and the core value. Infer it from the README, routes, and feature names below, then refine.


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

> 🧠 **For the AI agent:** This run is in **redesign** mode: preserve every feature's behavior and logic, but you are free to propose a cleaner architecture in `architecture/ARCHITECTURE.md`.

