# Stack-guide index — `inventory.stack` label → guide

**Do not guess a filename.** The labels the engine emits and the guide filenames deliberately do
not match one-to-one — several frameworks share a guide (`Flask` lives in
`django-flask-fastapi.md`, `Gin` in `go-net-http.md`). Look the label up here.

A repo routinely activates **several** guides at once (a Next.js frontend over an Express API
with tRPC): read every one that matches, plus `monorepo.md` if `inventory.workspaces` is
non-empty.

---

## By `stack.frameworks` label

| Label emitted by the engine | Guide | Routes resolved by an adapter? |
| --- | --- | --- |
| `Next.js` | [nextjs.md](./nextjs.md) | ✅ file-based (`app/` + `pages/`) |
| `Nuxt`, `Vue` | [nuxt-vue.md](./nuxt-vue.md) | — candidates only |
| `Remix`, `React Router` | [remix-react-router.md](./remix-react-router.md) | — candidates only |
| `SvelteKit`, `Svelte` | [sveltekit.md](./sveltekit.md) | — candidates only |
| `Astro` | [astro.md](./astro.md) | — candidates only |
| `Angular` | [angular.md](./angular.md) | — candidates only |
| `SolidStart`, `SolidJS` | [sveltekit.md](./sveltekit.md) (nearest file-based analogue) + [analysis-playbook.md](../analysis-playbook.md) §Interface surface | — candidates only |
| `React` (alone, no meta-framework) | [library-cli-sdk.md](./library-cli-sdk.md) if it is a component library; else the app's server guide | — |
| `NestJS` | [nestjs.md](./nestjs.md) | ✅ decorators |
| `Express`, `Fastify`, `Hono`, `Koa` | [express-fastify-hono.md](./express-fastify-hono.md) | ✅ Express/Fastify/Hono · Koa: candidates only |
| `Django`, `Flask`, `FastAPI` | [django-flask-fastapi.md](./django-flask-fastapi.md) | ✅ all three |
| `Ruby on Rails` | [rails.md](./rails.md) | ✅ `config/routes.rb` |
| `Sinatra` | [rails.md](./rails.md) (Ruby idioms) + [analysis-playbook.md](../analysis-playbook.md) | — candidates only |
| `Laravel` | [laravel.md](./laravel.md) | — deliberately deferred (see [adapters.md](../adapters.md)) |
| `Symfony` | [laravel.md](./laravel.md) (PHP idioms) + [analysis-playbook.md](../analysis-playbook.md) | — candidates only |
| `Spring Boot` | [spring-boot.md](./spring-boot.md) | — candidates only |
| `Gin`, `Echo`, `Fiber`, `chi`, `Gorilla` | [go-net-http.md](./go-net-http.md) | ✅ all five |
| `Expo`, `React Native`, `Flutter` | [mobile-rn-expo-flutter.md](./mobile-rn-expo-flutter.md) | n/a — screens, not routes |
| `Electron`, `Tauri` | [desktop-electron-tauri.md](./desktop-electron-tauri.md) | n/a — IPC, not routes |
| `Vite` (alone) | build tooling, not an app framework — identify the app framework beside it | — |

## By `stack.libraries` label (these activate *in addition* to the framework)

| Label | Guide |
| --- | --- |
| `tRPC` | [rpc-trpc-grpc.md](./rpc-trpc-grpc.md) — ✅ procedures resolved to dot-paths |
| `GraphQL`, `Apollo GraphQL` | [graphql.md](./graphql.md) |
| `Prisma`, `Drizzle ORM`, `TypeORM`, `Sequelize`, `Mongoose`, `Kysely` | the data-model section of your framework's guide, plus [analysis-playbook.md](../analysis-playbook.md) §Data model |
| `NextAuth.js`, `Auth.js`, `Clerk`, `Lucia`, `Passport`, `Supabase` | [analysis-playbook.md](../analysis-playbook.md) §Cross-cutting concerns — these carry the per-operation auth rule |

## By shape, when no framework label helps

| Situation | Guide |
| --- | --- |
| `stack.frameworks` is **empty** — a library, CLI, SDK, engine, or plugin | [library-cli-sdk.md](./library-cli-sdk.md) |
| Handlers declared in infra config — Cloudflare Workers, Lambda/SST/CDK, Vercel functions | [serverless-edge.md](./serverless-edge.md) |
| ASP.NET Core / .NET (only the `C#` **language** is detected today) | [dotnet-aspnet.md](./dotnet-aspnet.md) |
| `inventory.workspaces` is non-empty, or the layout looks like several apps | [monorepo.md](./monorepo.md) — **then** the matching guide *per workspace* |
| Nothing above fits | [analysis-playbook.md](../analysis-playbook.md) — the universal method works without a guide |

---

## Not detected at all

The engine has no manifest signal for these. If you are looking at one, identify it yourself
from the file tree and record the finding in `ARCHITECTURE.md`:

- **.NET / ASP.NET Core** — `*.csproj`, `Program.cs`, `appsettings.json` → [dotnet-aspnet.md](./dotnet-aspnet.md)
- **Phoenix / Elixir** — `mix.exs`, `lib/*_web/router.ex` (the `Elixir` *language* is detected)
- **Rust web** — `Cargo.toml` with `axum`/`actix-web`/`rocket` (the `Rust` language is detected)
- **WordPress / CMS themes & plugins** — `wp-content/`, `functions.php`
- **Data/ML pipelines** — Airflow DAGs, dbt models, notebooks: the "interface surface" is the
  set of scheduled DAGs/models and their inputs/outputs

In every case the deterministic scaffold still works — only the routing shortcut is missing, and
[analysis-playbook.md](../analysis-playbook.md) carries the method.

---

## Adding a guide

Guides follow one shape: **When · Where the interface surface lives · Data model · Entry points
& boot · Config & env · Gotchas · a one-line tip**. Add the file, add a row here, and — if you
also want routes *resolved* rather than merely hinted — add an adapter per
[adapters.md](../adapters.md).
