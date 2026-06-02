# Driving a rebuild from the output

How to actually rebuild the project once the `reconstruction/` folder is ready.

## Order
1. `00-overview/PRD.md` — understand the product and the stack.
2. `architecture/ARCHITECTURE.md` — scaffold the project shape first.
3. `architecture/INTERFACES.md` — the full interface surface (routes, endpoints, RPC/GraphQL,
   CLI, jobs) and `architecture/DATA-MODEL.md` — entities, fields, relations.
4. `REBUILD.md` — follow the build order; it is dependency-tiered (foundations → feature pages
   → tests/docs) and lists features as a checklist.
5. `features/<slug>/PRD.md` — implement units one at a time.

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
- Every interface in `architecture/INTERFACES.md` is implemented and responds as before.
- Data model matches `architecture/DATA-MODEL.md` and `data/schema/` (fields, types, enums, constraints).
- Every write satisfies the schema; enum values are listed members; coded identifiers pass their format rule.
- External services and policies (rate limits, validations) behave per `architecture/ARCHITECTURE.md`.
- All locales present; keys match `data/translations/` and every key has copy in every locale.
- Required env vars configured.
- The PRD suite itself passes the buildability gate: `node scripts/analyze.mjs --check --out <OUT>`.
- The project's own scripts (build/test/lint) pass.

## Tip for large projects
Rebuild feature-by-feature in separate agent sessions, each scoped to a single
`features/<slug>/PRD.md`, to keep context small and edits reliable.
