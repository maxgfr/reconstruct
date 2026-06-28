# SvelteKit Reconstruction Cheat-Sheet

**When:** inventory.stack lists `@sveltejs/kit` in package.json deps; `svelte.config.js` + `vite.config.{js,ts}` at root; a `src/routes/` tree with `+page`/`+server`/`+layout` files; `src/app.html` present.

## Where the interface surface lives
Routing is **file-based** under `src/routes/`. The folder path = URL path; the **filename** decides the kind of endpoint. Each row in INTERFACES.md comes from one of:
- **API endpoints** → `+server.ts` (or `.js`). Exports named functions `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD` — each is one route row. Method = export name; path = folder path; handler = the file. Returns `json()` / `Response`. `export const fallback` catches all other methods.
- **Page data loaders** → `+page.server.ts` `export const load` (server load, runs only on server) and `+page.ts`/`.js` `load` (universal). Treat server `load` as a GET-like data endpoint for the page route.
- **Form actions** → `+page.server.ts` `export const actions = { default, namedAction }`. Each key is a **POST** to the page path; named actions are invoked as `?/namedAction` (query, not path). Add a row per action key with method POST, path `<route>?/<name>`.
- **Layout loaders** → `+layout.server.ts` / `+layout.ts` `load` provide cascading data to child routes (parent data via `await parent()`); not their own URL but note as shared loaders.
**Computing the full path** from folder names:
- `[param]` → `:param` dynamic segment; `[...rest]` → catch-all (`/*`); `[[optional]]` → optional segment.
- `(group)` folders are **route groups** — paginate organizationally, **do NOT appear in the URL**. Strip them.
- `[x=matcher]` uses a param matcher from `src/params/<matcher>.ts`.
- `\(...\)` (escaped) or special chars via `[x+2e]` hex encoding.
- `@named` / `+page@.svelte` resets layout inheritance (no URL effect).
**Auth** lives in `hooks.server.ts` `handle` (sets `event.locals.user`/session) and is enforced inside each `load`/action/`+server` via `event.locals` checks or `redirect(303,'/login')` / `error(401)`. There is no decorator — read the guard logic at the top of each handler.

## Data model
SvelteKit ships **no ORM**. Detect the data layer in `src/lib/server/` (server-only, never bundled to client). Common: Drizzle (`drizzle.config.ts`, `schema.ts` with `pgTable`/`sqliteTable`/`mysqlTable`, `relations()`), Prisma (`prisma/schema.prisma`), Lucia (auth tables), Kysely, raw SQL. Read entities/fields/relations/indexes from those schema files (see the matching ORM guide). Migrations: `drizzle/` or `prisma/migrations/`. `load` functions and actions call these via `$lib/server/db`.

## Entry points & boot
No manual server bootstrap — the **adapter** generates it. `src/hooks.server.ts` (`handle`, `handleFetch`, `handleError`) is the request middleware entry; `src/hooks.client.ts` for client. `src/app.html` is the HTML shell (`%sveltekit.head%`, `%sveltekit.body%`). `src/app.d.ts` types `App.Locals`/`App.PageData` (tells you the session/user shape). Root `+layout.server.ts` often seeds global data. Adapter in `svelte.config.js` (`adapter-node`, `-vercel`, `-cloudflare`, `-static`) determines deploy target.

## Config & env
- `svelte.config.js` — adapter, `kit.alias`, `kit.csrf`, `paths.base`, preprocessors.
- `vite.config.ts` — plugins, server proxy, env prefix.
- Env: `$env/static/private` & `$env/dynamic/private` (server secrets), `$env/static/public` & `$env/dynamic/public` (`PUBLIC_`-prefixed, client-safe). `.env` at root.
- Scripts: `vite dev`, `vite build`, `vite preview`, `svelte-kit sync` (generates `.svelte-kit/types`).

## Gotchas
- Form **actions are POST routes** but addressed by `?/name` query, not a path segment — easy to miss as endpoints.
- `(group)` folders and `@named` layouts must be **stripped** when computing URLs; including them yields wrong paths.
- `+server.ts` and `+page.server.ts` can coexist in the same folder but a page route and a `+server.ts` cannot both own the bare path for the same method — `+server.ts` wins for non-GET; check carefully.
- `+page.ts` `load` runs on **both** server and client; `+page.server.ts` `load` is server-only (where DB/secret access lives) — only the latter is a true backend endpoint.
- Code in `src/lib/server/**` and `$env/*/private` is build-time-enforced server-only; that boundary marks the real backend surface.
- API routes are often **un-prefixed** — there's no `/api` unless the folder literally is `routes/api/`. Don't assume a prefix.
- `export const prerender`/`ssr`/`csr` flags change whether a route is static vs dynamic — note prerendered routes as static.

> tip: Walk `src/routes/` recursively and emit one INTERFACES.md row per exported HTTP-method in `+server.ts`, per server `load`, and per key in `actions` — translating `[param]`/`[...rest]` to dynamic segments and deleting `(group)` folders from the URL.
