# Monorepos (npm/yarn/pnpm workspaces, Lerna, Nx, Turborepo, Cargo, go.work)

**When:** `inventory.workspaces` is non-empty — or the layout *looks* like a monorepo (several apps/services/packages dirs, each with its own manifest) even though the engine detected nothing.

## What the engine already gives you

Each entry of `inventory.workspaces[*]` is self-contained:

| Field | Meaning |
| --- | --- |
| `name` / `path` / `kind` | Identity + which system declared it (`npm`, `pnpm`, `lerna`, `nx`, `cargo`, `go`) |
| `stack` | The workspace's **own** frameworks/libraries/managers (detected from its files & manifests) |
| `dependencies` | Its own manifest deps (repo-relative manifest path) |
| `dependsOn` | Sibling workspaces it depends on — **manifest-declared edges only** |
| `routeCount` | Routes attributed to it (each `routes[*]` carries `workspace`) |
| `schemas` / `hints` | Schema files and route/API/schema/entry candidates filtered to its subtree |

Features are already grouped per workspace (`NN-<ws>-<feature>` slugs; one feature per
shared package) and `REBUILD.md`'s outer tier is the workspace topological order.
`ARCHITECTURE.md` carries the workspace table; `diagram.md` the workspace graph.

## Where each system declares membership

| System | Membership lives in | Notes |
| --- | --- | --- |
| npm/yarn | `package.json` `workspaces` | array or `{ packages: [...] }` |
| pnpm | `pnpm-workspace.yaml` `packages:` | supports `!negation` patterns |
| Lerna | `lerna.json` `packages` | used as fallback when package.json declares none |
| Nx | `nx.json` `workspaceLayout` (`apps/`, `libs/`) | members may have `project.json` instead of `package.json` |
| Turborepo | **none** — `turbo.json` is task config | membership comes from npm/pnpm workspaces |
| Cargo | root `Cargo.toml` `[workspace] members` / `exclude` | name from each member's `[package]` |
| Go | `go.work` `use` directives | name from each module's `go.mod` `module` line |

## Your job as the agent

1. **Verify each workspace's role** — app, service, shared package, tooling. `routeCount > 0`
   usually means app/service; a package every sibling imports is a foundation.
2. **Extend the dependency graph.** `dependsOn` only sees manifests. Add the implicit edges:
   one app calling another over HTTP, a generated API client, a shared database, shared env
   vars, queues/topics. Update the `## Workspace graph` in `diagram.md` and the table in
   `ARCHITECTURE.md`.
3. **Analyze per workspace, with the right stack guide.** Read `workspaces[*].stack` and load
   the matching `references/stack-guides/<stack>.md` *per workspace* — a monorepo is several
   stacks, not one. Use each workspace's `hints` as the starting candidates.
4. **Map shared packages once.** A shared `ui`/`db`/`core` package gets ONE feature PRD;
   the app PRDs reference it instead of re-describing it.
5. **Keep INTERFACES.md / DATA-MODEL.md global but attributed** — one table, with a
   workspace column (or per-workspace sections) so two apps' routes don't blur together.
   The data model usually lives in one schema workspace; say which.

## When detection misses (the on-the-fly fallback)

No `workspaces` in the inventory but the tree screams monorepo (e.g. `services/*/go.mod`,
ad-hoc `apps/` without a workspaces field)? Identify the workspaces yourself from the
layout, then scope re-runs to keep the analysis sharp:

```bash
node scripts/analyze.mjs --repo <REPO> --out <OUT>/ws-api --include 'services/api/**'
```

Record what you found (and that detection missed it) in `ARCHITECTURE.md`.

## Pitfalls

- `turbo.json` / `nx.json` task pipelines ≠ dependency graph — build edges from manifests
  and imports, not task config.
- Internal deps may be version-pinned (`"@acme/ui": "1.2.3"`) instead of `workspace:*` —
  they still match by name; conversely a published-elsewhere dep can shadow a sibling name.
- Nested workspaces: files attribute to the **deepest** workspace.
- A root-level `src/` next to workspaces is real code too — it stays on the single-package
  path and still needs a feature home.
