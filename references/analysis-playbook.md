# Analysis playbook — the universal method

This is the methodology the AI agent follows to understand **any** stack. The
deterministic engine gives you facts and *candidate hints*; this playbook tells you
how to turn them into a faithful reconstruction: the real **interface surface**, the
**data model**, and **semantic features**. Read the matching `stack-guides/<x>.md` for
shortcuts, but the recipes here work even when no guide exists.

**Golden rule:** `inventory.json.routes`, `.i18n`, and everything under `.hints` are
*candidates to verify* — never ground truth. Always open the source to confirm. Resolve
every entry in `inventory.json.unknowns`.

---

## §Identify the stack & architecture

1. Read `inventory.stack` (languages, frameworks, libraries, package managers) and
   `inventory.dependencies`. Pick the primary framework; note ORM, auth, API-layer, and
   i18n libraries — they tell you *where* to look next. (`stack.libraries` is npm-aware; for
   Python/Ruby/PHP/JVM/Go, read the real deps from `inventory.dependencies` directly.)
2. Read `inventory.hints.entryPoints` to find how the app boots (server, CLI, framework
   entry, mobile root).
3. If `inventory.workspaces` is non-empty, it's a **monorepo** — see §Monorepo.
4. If `inventory.stack.frameworks` is empty, infer the stack from manifests, entry points,
   and directory shape, and record it in `00-overview` and `ARCHITECTURE.md`.

---

## §Interface surface  → fill `architecture/INTERFACES.md`

List **every** way the outside world reaches this code. Start from
`hints.routeCandidates` + `hints.apiCandidates` + resolved `routes`, then read each file to
confirm. Match the stack's actual paradigm — most stacks mix several. One table row per
operation: **method/trigger · path/operation · kind · handler file · auth · notes**.

### Recipes by paradigm

- **File-based routing** (Next.js, Nuxt, SvelteKit, Remix, Astro, SolidStart): the route is
  the folder path; the leaf file is the handler. Map dir → URL, drop route groups `(group)`
  and dynamic-segment brackets, resolve `index`/`page`/`route`/`+page`/`+server`. Note
  middleware, layouts, and route-segment config. (Engine resolves Next.js here; verify, and
  do the others by hand — see the stack guide.)
- **Route tables & decorators** (Express/Koa/Fastify/Hono, NestJS, Spring, Laravel, Rails,
  Django, FastAPI, Flask): find where routes are *registered*.
  - Express/Koa/Fastify/Hono: `app.get('/x', …)`, `router.post(…)`, `app.use(router)`. Follow
    the router mounting to build full paths.
  - NestJS / Spring: class + method decorators (`@Controller('users')` + `@Get(':id')`,
    `@RestController` + `@GetMapping`). Path = controller base + method path.
  - Laravel: `routes/web.php` & `routes/api.php` (`Route::get`, `Route::apiResource`).
  - Rails: `config/routes.rb` (`resources :users`, `get '/x'`) → controller actions.
  - Django: `urls.py` `urlpatterns` → views; DRF routers/viewsets. Flask/FastAPI:
    `@app.route` / `@router.get` decorators (+ blueprints / `APIRouter` prefixes).
- **RPC** — see `stack-guides/rpc-trpc-grpc.md`. tRPC: a router tree
  (`createTRPCRouter({...})`) where each `.query`/`.mutation`/`.subscription` is an endpoint;
  the procedure path is `router.sub.procedure`. The HTTP layer is a single
  `/api/trpc/[trpc]` catch-all — **list the procedures, not the catch-all**. gRPC: `.proto`
  `service`/`rpc` definitions.
- **GraphQL** — see `stack-guides/graphql.md`. SDL (`type Query`/`type Mutation`/
  `type Subscription`) or code-first resolvers (`@Resolver`, `buildSchema`). List each
  query/mutation/subscription as an operation.
- **CLI**: command definitions (commander/yargs/oclif, Click, Cobra, Thor). List each command
  + flags. **Jobs/cron/queues**: schedulers (cron, BullMQ, Celery, Sidekiq, `@nestjs/schedule`)
  and webhook handlers — list trigger + handler.

If routes were not resolved deterministically, `unknowns` will say so — that is your cue to
build this table from the candidates by hand.

---

## §Data model  → fill `architecture/DATA-MODEL.md`

From `hints.schemaCandidates` (raw copies in `data/schema/`), list every entity/table with
its key fields + types, relations, and indexes/constraints. Recognize the ORM/format:

| Source | How to read it |
| --- | --- |
| **Prisma** (`schema.prisma`) | `model X { … }`; `@id`/`@unique`/`@relation`; enums. |
| **Drizzle** (`pgTable`/`mysqlTable`/`sqliteTable`) | table = call; columns = chained builders; relations via `relations()` / `references()`. |
| **TypeORM** | `@Entity` classes; `@Column`, `@PrimaryGeneratedColumn`, `@ManyToOne`/`@OneToMany`. |
| **Sequelize** | `sequelize.define('X', {…})` or `extends Model` + `init`; `belongsTo`/`hasMany`. |
| **Mongoose** | `new Schema({…})` + `model('X', schema)`; `ref:` for relations. |
| **Django** | `models.py`: `class X(models.Model)`; `*Field`; `ForeignKey`/`ManyToManyField`; `class Meta`. |
| **Rails / ActiveRecord** | `db/schema.rb` (`create_table`) or `db/migrate/*`; `belongs_to`/`has_many` in models. |
| **SQL DDL** (`.sql`) | `CREATE TABLE`, `FOREIGN KEY`, `INDEX`, enums/check constraints. |
| **Ecto / GORM / Hibernate / SQLAlchemy** | schema/struct/entity definitions + association macros/tags/annotations. |

Capture: entity name, fields (name · type · constraints), relations (1-1 / 1-N / N-N),
indexes, enums, defaults. Note migrations and seed data if present. Never paraphrase types —
copy them.

---

## §Semantic feature grouping

The engine emits a path-based feature skeleton (numbered by build tier). Turn it into real
product features:

- **Rename** path keys into product language (`(dashboard)/billing` → "Billing").
- **Merge** trivial fragments: a section's sub-pages, or a one-file util, belong with their
  parent or under Core. (The `--granularity coarse` default already folds route-less
  single-file groups into Core; split further with `--granularity fine` if needed.)
- **Link** each feature to its interfaces (from `INTERFACES.md`), data (from `DATA-MODEL.md`),
  and shared components/services.
- Keep cross-cutting concerns (auth, i18n, config) as their own foundation features.
- A feature is a *unit of behavior a user or client cares about*, not a folder.

---

## §Monorepo

When `inventory.workspaces` is non-empty: identify each workspace's role (app, package,
service). Re-run or scope the analysis per workspace (`--repo <workspace>` or
`--include <workspace>/**`). In `ARCHITECTURE.md`, draw the dependency graph between
workspaces; map shared packages once and reference them from each app.

---

## §Cross-cutting concerns

Always account for these — they rarely live in a single feature:

- **Auth & authorization**: provider/library, session strategy, middleware/guards, protected
  routes (mark them in `INTERFACES.md`), roles/permissions.
- **i18n**: locales and how translations load (`data/translations/`).
- **Config & env**: `inventory.envVars` (names only) and `data/config/`; document required vs
  optional.
- **External services**: payment, email, storage, analytics, queues, third-party APIs — from
  dependencies + env vars.
- **Observability & errors**: logging, error tracking, health checks.

---

## §Fidelity rules

- **mirror**: real files copied under `source/` — reference them; keep PRDs faithful.
- **embed**: key code inlined in PRDs — quote selectively, explain behavior.
- **describe**: text only — capture requirements precisely enough to rewrite from scratch.
- Translations, schema, and config are **always** copied to `data/` verbatim regardless of
  fidelity — never re-translate or re-derive data.
- **light** vs **complex**: light = faithful, minimal editorializing; complex = also propose
  `[keep-behavior]` improvements (never silently change behavior). **redesign** = same
  behavior, fresh architecture documented in `ARCHITECTURE.md`.
