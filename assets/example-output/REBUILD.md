# REBUILD — sample-app

| Setting | Value |
| --- | --- |
| Mode | `redesign` |
| Level | `complex` |
| Fidelity | `describe` |
| Generated with | `reconstruct@1.3.0` |

This folder is a complete plan to rebuild the project from scratch.

## Mode & level

- **redesign**: design a new architecture for the same features.
- **complex**: PRDs that also suggest improvements to fold in.
- **describe** fidelity: descriptive PRDs only — build from requirements.

## Build order

Ordered by dependency tier — foundations (types, data, shared UI, i18n, cross-cutting) first, feature pages next, tests & docs last.

1. [ ] **Core** → `features/01-core/PRD.md`
2. [ ] **Project Setup & Tooling** → `features/02-project-setup/PRD.md`
3. [ ] **Prisma** → `features/03-prisma/PRD.md`
4. [ ] **API** → `features/04-api/PRD.md`
5. [ ] **Internationalization** → `features/05-internationalization/PRD.md`
6. [ ] **Dashboard** → `features/06-dashboard/PRD.md`
7. [ ] **Documentation** → `features/07-documentation/PRD.md`

## Procedure

1. Start with `00-overview/PRD.md`, `architecture/ARCHITECTURE.md`, `architecture/INTERFACES.md`, and `architecture/DATA-MODEL.md`.
2. For each unit in order, open its PRD and implement it.
3. Wire shared data from `data/` (translations, schema, config).
4. Validate behavior against the requirements in each PRD.
5. Run the project's own scripts to verify: `dev`, `build`, `start`, `lint`.

## Validation checklist

- [ ] Every interface in `architecture/INTERFACES.md` is implemented (routes, endpoints, RPC/GraphQL, jobs).
- [ ] Data model matches `architecture/DATA-MODEL.md` and `data/schema/`.
- [ ] All routes respond as before.
- [ ] All locales present and keys match `data/translations/`.
- [ ] UI matches `architecture/DESIGN-SYSTEM.md` — design tokens reproduced exactly, components built with their variants/states, and the accessibility target met.
- [ ] Required env vars configured: `DATABASE_URL`, `NEXTAUTH_SECRET`.

## Known gaps (faithful properties of the original — preserve, do not "fix")

These are real gaps in the source. A faithful rebuild reproduces them; each is
recorded in the owning feature PRD so it is preserved deliberately, not silently.

1. **`User` model is declared but never queried** (owner: `03-prisma`, surfaced in `04-api`). No `PrismaClient` is instantiated; `GET /api/users` returns a hardcoded `["alice","bob"]`. The schema also has no `generator client` block.
2. **Pages hardcode copy instead of reading the i18n catalog** (owner: `01-core`, `06-dashboard`, `05-internationalization`). `home.title/cta` and `dashboard.title` exist in `messages/*.json` but are never read; the pages render English literals in every locale.
3. **`"Private area."` has no catalog key** (owner: `06-dashboard` / `05-internationalization`) — it is an untranslatable hardcoded string.
4. **`GET /api/users` performs no authentication** (owner: `04-api`) — it returns `200` for everyone; `NEXTAUTH_SECRET` only toggles the payload, it does not gate access.
5. **`/dashboard` is not access-controlled** (owner: `06-dashboard`) — public despite the "Private area." label.
6. **Declared-but-unused dependencies** (owner: `02-project-setup`) — `zod`, `@playwright/test`, and `tailwindcss` are installed but never imported/configured/used.
7. **`lib/auth.ts#databaseUrl()` is dead code** (owner: `01-core`) — exported but never called.
8. **`next.config.js`'s `i18n` key is inert** (owner: `02-project-setup`) — it is a Pages-Router option ignored by the App Router, so no locale-prefixed routing exists.
9. **No `tsconfig.json`** (owner: `02-project-setup`) — TypeScript is a dependency but no config file ships; a real build would need one added.

These gaps are not blockers: they are the observable behavior of the fixture. The
reconstruction is buildable precisely because it specifies them rather than inventing
the "complete" versions.
