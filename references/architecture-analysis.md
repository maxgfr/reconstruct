# Architecture analysis checklist

Use this when filling `architecture/ARCHITECTURE.md`. Read `inventory.json` first.

## Always answer
- **Entry points:** how does the app boot? (bin, server, framework entry)
- **Layers:** UI ↔ application/services ↔ data. Where are the boundaries?
- **Routing:** route table (from `inventory.json.routes`) — pages vs API.
- **Data:** schema/models (`data/schema/`), persistence, migrations.
- **State & side effects:** caches, queues, external services, env vars.
- **i18n:** locales and how translations are loaded (`data/translations/`).
- **Cross-cutting:** auth, logging, error handling, config.

## Preserve mode
Document the structure as it is. Capture the directory layout, framework
conventions, and any implicit rules (naming, folder-per-feature, barrel files).
The rebuild should land in the same shape.

## Redesign mode
Keep behavior identical; improve structure. For each decision, write:
- **Current:** what exists.
- **Proposed:** the new boundary/module/folder.
- **Why:** testability, clarity, coupling, performance.
- **Migration:** how each existing unit maps onto the new structure.

Output a target directory tree and one short paragraph of rationale per top-level
module. Do not change public behavior or data contracts unless the user opts in.
