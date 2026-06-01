# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0]

Re-architected into a **stack-agnostic scaffold + an AI-first markdown playbook**. The
deterministic engine now produces universal facts and *candidate hints*; the markdown
teaches the agent to map any stack.

### Added
- `architecture/INTERFACES.md` and `architecture/DATA-MODEL.md` skeletons in every run, so
  the full interface surface (routes, endpoints, RPC/GraphQL, CLI, jobs) and the data model
  are first-class deliverables.
- `inventory.json` now carries `hints` (route/API/schema candidates + entry points),
  `unknowns` (explicit pointers for the agent), `workspaces` (monorepo), `runtime.node`, and
  `excludedCount`.
- `src/detect/candidates.ts`: framework-agnostic candidate detection (tRPC, GraphQL, gRPC,
  OpenAPI, Drizzle/Prisma/TypeORM/Mongoose/Django/Rails, cross-ecosystem entry points).
- `references/analysis-playbook.md` (universal methodology) and `references/stack-guides/*`
  (15 per-stack cheat-sheets, loaded on demand).
- CLI flags: `--granularity coarse|fine`, `--include`/`--exclude` globs; the summary now
  reports candidate, monorepo, excluded-file, and unknowns counts.
- Extended stack catalogue: Vite, SolidStart, Expo, React Native, Electron, Tauri,
  Laravel/Symfony, Spring Boot (Maven/Gradle); monorepo + Node-version detection.
- Multi-stack test fixtures (`i18n-app`, `trpc-app`, `flask-api`, `monorepo`) and suites.

### Changed
- `REBUILD.md` build order is now **dependency-tiered** (foundations → feature pages →
  tests/docs) instead of sorted by file count.
- `SKILL.md` rewritten to a stack-agnostic procedure; PRD references point at
  `INTERFACES.md`/`DATA-MODEL.md`.
- Env-var extraction also recognizes `os.environ.get("X")` / `os.getenv("X")` (Python).

### Removed
- `src/adapters/js-ts.ts` (dead code; generalized into `src/detect/candidates.ts`).
- The silent 2000-file cap in env-var extraction.

## [0.1.0]

Initial release: deterministic analyzer + agent-enriched reconstruction PRDs, tuned for
JS/TS/Next.js with generic extraction for other stacks.

[Unreleased]: https://github.com/maxgfr/reconstruct/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/maxgfr/reconstruct/releases/tag/v0.2.0
[0.1.0]: https://github.com/maxgfr/reconstruct/releases/tag/v0.1.0
