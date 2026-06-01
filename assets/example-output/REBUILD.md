# REBUILD — sample-app

| Setting | Value |
| --- | --- |
| Mode | `redesign` |
| Level | `complex` |
| Fidelity | `describe` |
| Generated with | `reconstruct@0.1.0` |

This folder is a complete plan to rebuild the project from scratch.

## Mode & level

- **redesign**: design a new architecture for the same features.
- **complex**: PRDs that also suggest improvements to fold in.
- **describe** fidelity: descriptive PRDs only — rewrite from requirements.

## Build order

1. [ ] **Core** → `features/01-core/PRD.md`
2. [ ] **Api** → `features/02-api/PRD.md`
3. [ ] **Dashboard** → `features/03-dashboard/PRD.md`
4. [ ] **Prisma** → `features/04-prisma/PRD.md`
5. [ ] **Internationalization** → `features/05-internationalization/PRD.md`
6. [ ] **Project Setup & Tooling** → `features/06-project-setup/PRD.md`
7. [ ] **Documentation** → `features/07-documentation/PRD.md`

## Procedure

1. Start with `00-overview/PRD.md` and `architecture/ARCHITECTURE.md`.
2. For each unit in order, open its PRD and implement it.
3. Wire shared data from `data/` (translations, schema, config).
4. Validate behavior against the requirements in each PRD.
5. Run the project's own scripts to verify: `dev`, `build`, `start`, `lint`.

## Validation checklist

- [ ] All routes respond as before.
- [ ] All locales present and keys match `data/translations/`.
- [ ] Data schema matches `data/schema/`.
- [ ] Required env vars configured: `DATABASE_URL`, `NEXTAUTH_SECRET`.
