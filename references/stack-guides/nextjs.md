# Next.js (App Router + Pages Router)

**When:** inventory.stack lists `next` in package.json deps; presence of `next.config.{js,mjs,ts}` and an `app/` and/or `pages/` dir. App Router = `app/`; Pages Router = `pages/`. Analyzer resolves file-based routes but flags route handlers / Server Actions / middleware as needing verification.

## Where the interface surface lives
App Router (`app/`, or `src/app/`): routes are folders; URL = folder path minus route groups and private folders.
- **Pages**: `page.tsx` → renders a route (GET, HTML). `layout.tsx` wraps children; `loading.tsx`/`error.tsx`/`not-found.tsx` are UI, not endpoints.
- **API/route handlers**: `route.ts|js` files export named async funcs `GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS` → one INTERFACES.md row per export (method · path · `app/.../route.ts` · auth). A folder can have EITHER `page` or `route`, not both.
- **Path computation**: strip `(group)` route groups (no URL effect), strip `@slot` parallel + `(.)/(..)/(...)`intercepting prefixes. `[param]` → `:param`; `[...slug]` → `*` catch-all; `[[...slug]]` → optional catch-all. `[locale]` (next-intl) is a real dynamic segment in the URL.
- **Server Actions**: functions marked `"use server"` (file-top directive, or inline in a Server Component); invoked via `<form action={fn}>` or from client. These are POST endpoints to the current route with an action ID — list each as an RPC-style row (action name · containing file · "POST (server action)"). Analyzer often misses these; grep `"use server"`.
- **Route-segment config** (export consts in page/route): `dynamic`, `revalidate`, `runtime` (`edge`|`nodejs`), `preferredRegion` — note runtime in the row.
Pages Router (`pages/`, or `src/pages/`):
- **API routes**: `pages/api/**/*.ts` default-export `handler(req,res)`; method is branched inside via `req.method` (read the if/switch) — one row per method handled. `[param]`, `[...slug]` same as above.
- **Pages**: `pages/x.tsx` → GET route; data via `getServerSideProps`/`getStaticProps`/`getStaticPaths`.
- **Middleware**: `middleware.ts` (root or `src/`) exports `middleware()` + optional `config.matcher` — cross-cutting auth/redirect; record matcher globs as a note, not a route.

## Data model
- **Prisma**: `prisma/schema.prisma`. Each `model` = table → DATA-MODEL.md entity. Fields = `name Type modifiers`; `?`=nullable, `[]`=relation/list. Relations via `@relation(fields:[..], references:[..])`. Indexes: `@@index`, `@@unique`, `@id`/`@@id`. `@map`/`@@map` = real column/table name. Enums = `enum`. Migrations in `prisma/migrations/`.
- **Drizzle**: schema in `src/db/schema.ts` (or `drizzle/`). Tables via `pgTable`/`mysqlTable`/`sqliteTable("name",{...})`; columns `text()/integer()/varchar()`, `.notNull()`, `.primaryKey()`, `.references(()=>other.id)`. Indexes/relations in the table's 2nd-arg callback and `relations(...)`. Config: `drizzle.config.ts`; SQL migrations in `drizzle/`.

## Entry points & boot
- No explicit server file (managed by `next start`/`next dev`). Boot order: `middleware.ts` → matched layout(s) → page/route. Pages Router global wrappers: `pages/_app.tsx` (providers), `pages/_document.tsx` (HTML shell). App Router root: `app/layout.tsx` (required), `app/template.tsx`. `instrumentation.ts` runs on server startup. Custom server only if a `server.ts/js` exists.

## Config & env
- `next.config.{js,mjs,ts}` — `rewrites`/`redirects`/`headers` (async funcs) define EXTRA routes not visible in the filesystem; read them. `basePath` prefixes ALL routes; `i18n` (Pages) adds locale prefixes. `env`, `images.domains`.
- Env: `.env`, `.env.local`, `.env.production`; `NEXT_PUBLIC_*` are client-exposed. Scripts in package.json: `dev`/`build`/`start`/`lint`.

## Gotchas
- A `route.ts` and `page.tsx` can't coexist in one folder; don't double-count.
- Route groups `(marketing)` and private `_folders` do NOT appear in the URL; `@slots` and `(.)`intercepts also don't add path segments.
- `rewrites`/`redirects`/`basePath` in `next.config` silently change real paths — filesystem alone lies.
- Pages-Router API method lives in `req.method` branching, not the filename — inspect the body for every method.
- Server Actions are invisible endpoints; only `"use server"` reveals them. Middleware `matcher` defines auth scope but isn't a route.
- `src/` prefix: `app/`, `pages/`, `middleware.ts` may all live under `src/`. Edge vs Node runtime affects available APIs — check segment `runtime` export.

> tip: The URL is NOT the folder path — strip groups/slots/intercepts, expand `[..]` dynamic segments, then reconcile against `next.config` rewrites/redirects/basePath; and never trust the FS for Server Actions/middleware — grep `"use server"` and read `middleware.ts`.
