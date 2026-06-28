# Nuxt 3 / Vue

**When:** `inventory.stack` shows `nuxt`/`nuxt3` or deps include `nuxt`, `nitropack`, `vue`; presence of `nuxt.config.ts`, `app.vue`, `pages/`, `server/api/`. Plain Vue (no Nuxt) shows `vue` + `vue-router` + `vite.config.*` and a `src/router/` with `createRouter`.

## Where the interface surface lives
HTTP endpoints (Nitro) — the main surface:
- `server/api/**` → auto-mounted under `/api/<path>`. File path = route. `server/api/users.ts` → `/api/users`. `server/api/users/index.ts` → `/api/users`.
- `server/routes/**` → mounted at root (no `/api` prefix). `server/routes/sitemap.xml.ts` → `/sitemap.xml`.
- **Method encoded in filename suffix**: `users.get.ts`, `users.post.ts`, `[id].delete.ts`, `[id].patch.ts`. No suffix = matches ALL methods (inspect `event.method` / `getMethod(event)` inside the handler to split rows).
- **Dynamic segments**: `[id].ts` → `:id`; `[...slug].ts` → catch-all `/**`; `[[optional]].ts` → optional. Read params via `getRouterParam(event, 'id')` or `event.context.params`.
- Each handler = `export default defineEventHandler((event) => {...})` (sometimes `defineCachedEventHandler`, `defineLazyEventHandler`). Handler file IS the handler column.
- **Middleware/auth**: `server/middleware/*.ts` runs on EVERY request (global, no path) — check here for auth/session (`event.context.auth`, `requireUserSession`). Auth may also be inline (`getServerSession`, `nuxt-auth-utils`, JWT checks). Note per-route guards from `defineEventHandler` wrappers or `nuxt.config.ts` `routeRules`.
- **Pages (UI routes, not API)**: `pages/**/*.vue` → file-based Vue Router routes; `pages/users/[id].vue` → `/users/:id`. Meta/auth via `definePageMeta({ middleware: 'auth', layout: ... })`; client middleware in `middleware/*.ts` (`.global.ts` = always-on). List these as page routes only if INTERFACES.md tracks UI routes.
- **Plain Vue**: routes are objects in `createRouter({ routes: [...] })` (often `src/router/index.ts`) — read `path`, `component`, `children`, `meta.requiresAuth`. Nested children prepend parent `path`.
- `$fetch`/`useFetch('/api/...')` calls in components/composables confirm which endpoints exist and their shapes.

## Data model
No built-in ORM. Detect from deps:
- **Prisma** → `prisma/schema.prisma` (`model` blocks = tables; `@relation`, `@id`, `@unique`, `@@index`). Most authoritative; read this first.
- **Drizzle** → `*.schema.ts` / `db/schema.ts` via `pgTable`/`sqliteTable`/`mysqlTable`; relations in `relations()`.
- **Mongoose** → `new Schema({...})` + `model('Name', schema)` in `server/models/`.
- **TypeORM/Sequelize** → `@Entity`/`@Column` classes or `sequelize.define`.
- Migrations: `prisma/migrations/`, `drizzle/` / `server/db/migrations/`.
- Fallback: TS interfaces/`zod` schemas in `server/utils/`, `types/`, or `~/types` define payload shapes — use for fields when no ORM.

## Entry points & boot
- `nuxt.config.ts` — central config (modules, `runtimeConfig`, `routeRules`, `nitro`, `serverDir`, `srcDir`).
- `app.vue` — root component; `app/router.options.ts` overrides route generation.
- Nitro auto-bootstraps the server from `server/`; no manual `app.listen`. `server/plugins/*.ts` run on Nitro startup (DB connect, hooks).
- Vue plugins: `plugins/*.ts` (`.server.ts`/`.client.ts` suffixes scope execution).

## Config & env
- `runtimeConfig` in `nuxt.config.ts`: top-level = server-only secrets; `public:` = client-exposed. Env override: `NUXT_<KEY>` and `NUXT_PUBLIC_<KEY>`.
- `.env` / `.env.example` for var names; `app.config.ts` for non-secret reactive config.
- Scripts in `package.json`: `nuxt dev`, `nuxt build`, `nuxt generate` (static), `nuxt preview`.

## Gotchas
- The method is in the FILENAME, not the code — a suffixless `users.ts` may serve GET+POST+DELETE in one `switch(event.method)`; emit multiple rows.
- `server/routes/` has NO `/api` prefix; only `server/api/` does. Easy to mislabel paths.
- `server/middleware/` is path-less and global — it's auth/CORS, not a route; never emit it as an endpoint, but cite it as the auth source.
- `routeRules` in `nuxt.config.ts` can add redirects, headers, caching, proxy, and per-route SSR/auth — endpoints can exist purely as `routeRules` proxies with no file.
- `~`/`@` alias = `srcDir` (project root or `src/`); `~~`/`@@` = rootDir. Resolve these to find handlers.
- Catch-all `[...slug].ts` often implements a mini-router internally — read its body for sub-paths.
- Nuxt 2 (Options API, `pages/` + `_id.vue` underscore dynamics, `serverMiddleware` array in `nuxt.config.js`, no `server/api/`) differs entirely — confirm major version via `package.json`.

> tip: Walk `server/api/` + `server/routes/` file trees and decode each filename (path + method suffix + `[param]`) — that tree IS the API contract; the handler bodies only confirm auth and payload shape.
