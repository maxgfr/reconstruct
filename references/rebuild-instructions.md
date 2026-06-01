# Driving a rebuild from the output

How to actually rebuild the project once the `reconstruction/` folder is ready.

## Order
1. `00-overview/PRD.md` — understand the product and the stack.
2. `architecture/ARCHITECTURE.md` — scaffold the project shape first.
3. `REBUILD.md` — follow the build order; it lists features as a checklist.
4. `features/<slug>/PRD.md` — implement units one at a time.

## Per-feature loop
For each feature, in order:
1. Read its PRD's functional requirements and acceptance criteria.
2. Pull ground truth:
   - `source/<slug>/…` when fidelity is `mirror`,
   - embedded code in the PRD when fidelity is `embed`,
   - otherwise rebuild from the requirements.
3. Implement, then check the acceptance criteria.
4. For **complex** level, apply `[keep-behavior]` improvements; ask before any
   `[behavior-change]` item.

## Shared data
- Copy translations from `data/translations/` verbatim — do not re-translate.
- Recreate the schema from `data/schema/`.
- Reproduce config and env-var names from `data/config/` and the overview.

## Final validation (from REBUILD.md)
- All routes respond as before.
- All locales present; keys match `data/translations/`.
- Schema matches `data/schema/`.
- Required env vars configured.
- The project's own scripts (build/test/lint) pass.

## Tip for large projects
Rebuild feature-by-feature in separate agent sessions, each scoped to a single
`features/<slug>/PRD.md`, to keep context small and edits reliable.
