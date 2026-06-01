# REBUILD — sample-app

| Setting | Value |
| --- | --- |
| Mode | `redesign` |
| Level | `complex` |
| Fidelity | `describe` |
| Generated with | `reconstruct@0.2.0` |

This folder is a complete plan to rebuild the project from scratch.

## Mode & level

- **redesign**: design a new architecture for the same features.
- **complex**: PRDs that also suggest improvements to fold in.
- **describe** fidelity: descriptive PRDs only — rewrite from requirements.

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
- [ ] Required env vars configured: `DATABASE_URL`, `NEXTAUTH_SECRET`.
