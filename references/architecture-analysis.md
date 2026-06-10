# Architecture analysis checklist

Use this when filling `architecture/ARCHITECTURE.md`. Read `inventory.json` first
(facts **+ `hints` + `unknowns`**), and work alongside `analysis-playbook.md`, which
carries the stack-agnostic method and the per-paradigm recipes.

## Always answer
- **Entry points:** how does the app boot? (`inventory.hints.entryPoints` — bin, server,
  framework entry, mobile root).
- **Layers:** UI ↔ application/services ↔ data. Where are the boundaries?
- **Interfaces:** the full surface goes in `architecture/INTERFACES.md` — routes, endpoints,
  RPC/GraphQL operations, CLI commands, jobs. Summarize the *shape* here (how routing works),
  not the exhaustive list.
- **Data:** the entities/relations go in `architecture/DATA-MODEL.md` (sourced from
  `inventory.hints.schemaCandidates`, raw copies in `data/schema/`). Summarize the persistence
  approach here.
- **State & side effects:** caches, queues, external services, env vars (`inventory.envVars`).
- **i18n:** locales and how translations load (`data/translations/`).
- **Cross-cutting:** auth, logging, error handling, config (see playbook §Cross-cutting).
- **Monorepo:** if `inventory.workspaces` is set, the workspace table and graph are pre-rendered — verify them and extend `dependsOn` with implicit edges (HTTP calls, generated clients, shared env).

## Preserve mode
Document the structure as it is. Capture the directory layout, framework conventions, and any
implicit rules (naming, folder-per-feature, barrel files). The rebuild should land in the same
shape.

## Redesign mode
Keep behavior identical; improve structure. For each decision, write:
- **Current:** what exists.
- **Proposed:** the new boundary/module/folder.
- **Why:** testability, clarity, coupling, performance.
- **Migration:** how each existing unit maps onto the new structure.

Output a target directory tree and one short paragraph of rationale per top-level module. Do
not change public behavior or data contracts (the interfaces in `INTERFACES.md` and the
entities in `DATA-MODEL.md`) unless the user opts in.
