# Remix / React Router v7 (framework mode)

**When:** `package.json` deps include `@remix-run/react` + `@remix-run/node`/`@remix-run/serve` (Remix v1/v2) OR `react-router` + `@react-router/dev` + `@react-router/node`/`@react-router/serve` (RR7); presence of `app/root.tsx`, `app/routes/`, `remix.config.js` or `react-router.config.ts`, and a `vite.config.ts` with `@react-router/dev/vite` or `@remix-run/dev/vite` plugins.

## Where the interface surface lives
Every file under `app/routes/` is a route module. Each contributes 0-N rows to INTERFACES.md based on its exports:
- `export default function Component()` → an HTML page route (GET, server-rendered). Path = derived from filename.
- `export async function loader({ request, params })` → data fetch for that route. GET to the same path; `?_data=routeId` or `.data` request internally. Row: method GET, handler = this file.
- `export async function action({ request, params })` → mutation handler. Methods POST/PUT/PATCH/DELETE to the SAME path (Remix multiplexes by HTTP verb; branch on `request.method` inside). One row per verb the action handles.
- **Resource routes** = route module with a `loader`/`action` but NO default `Component` export → pure API/JSON/file endpoint. Treat as REST API rows.
- `export const headers`, `meta`, `links`, `ErrorBoundary`, `shouldRevalidate` are NOT endpoints — skip.
- `export const handle` → arbitrary metadata, skip for interfaces.

**Computing the full path from filename** (two conventions, check `routes.ts`/config):
- *Flat-file routes* (Remix v2 default, `flatRoutes`): dots = slashes. `app/routes/users.$id.edit.tsx` → `/users/:id/edit`. `_index.tsx` → index (`/` for `app/routes/_index.tsx`). Leading `_` segment = pathless layout (`_auth.login.tsx` → `/login`, wrapped by `_auth.tsx`). Trailing `_` opts out of nesting (`users_.new.tsx`). `$` = dynamic param (`$id` → `:id`), `$.tsx` = splat (`*`). `[...]` escapes literal dots: `[sitemap.xml].tsx` → `/sitemap.xml`.
- *Nested folder routes* (RR7 / opt-in): `app/routes/users.tsx` + `app/routes/users.$id/route.tsx`; the `route.tsx` (or `index.tsx`) inside a folder is the module.
- **RR7 config mode:** `app/routes.ts` defines routes EXPLICITLY via `route("path", "file.tsx")`, `index("file.tsx")`, `layout("file.tsx", [...])`, `prefix("api", [...])` from `@react-router/dev/routes`. When this file exists it is the SOURCE OF TRUTH — filenames don't imply paths. Read it to map path → module file and assemble nested prefixes. `flatRoutes()` helper there re-enables filename convention.
- Auth: usually a `requireUserId(request)` / `getSession`-style call at the top of loader/action, or a parent pathless layout (`_auth.tsx`/`_protected.tsx`) loader that redirects. Note the helper + which layout guards the subtree.

## Data model
Remix/RR7 is data-layer-agnostic — there is NO built-in ORM. Detect the actual one and read it:
- **Prisma** (most common): `prisma/schema.prisma` → `model` blocks = tables; fields with `@id`, `@relation`, `@unique`, `@@index`, `@@map`. Migrations in `prisma/migrations/`. Client usually `app/db.server.ts` / `app/utils/db.server.ts`.
- **Drizzle:** `drizzle.config.ts`; tables in `app/db/schema.ts` via `pgTable`/`sqliteTable`; relations via `relations()`; migrations in `drizzle/`.
- Others: Kysely, raw SQL, Mongoose models in `app/models/*.server.ts`. Files named `*.server.ts` (esp. `app/models/`) hold the data access — read them for entity shape even without an ORM schema.

## Entry points & boot
- `app/root.tsx` — root layout, renders `<Outlet/>`, `<Links/>`, `<Scripts/>`; its `loader` is the global data root.
- `app/entry.server.tsx` — SSR render (`handleRequest`), often customized; `app/entry.client.tsx` — hydration. Both are auto-generated if absent.
- Server: `@remix-run/serve` / `@react-router/serve` runs the built `build/server`; or a custom `server.ts`/`server.js` (Express/Hono) calling `createRequestHandler`.
- Build/dev driven by Vite (`vite.config.ts`) in current versions; legacy Remix used `remix.config.js` (classic compiler).

## Config & env
- `remix.config.js` (v1/v2 classic) or `react-router.config.ts` (RR7): `appDirectory`, `ssr`, `serverModuleFormat`, `routes()` programmatic routes, `ignoredRouteFiles`.
- `vite.config.ts`: the `remix()`/`reactRouter()` plugin holds route config in modern setups.
- Scripts: `dev` (`remix vite:dev` / `react-router dev`), `build`, `start`. Env via `process.env`, loaded with `dotenv`; `*.server.ts` files are server-only (never bundled to client).

## Gotchas
- One file = multiple HTTP verbs: a single `action` commonly handles POST+PATCH+DELETE — inspect `switch (request.method)` or a hidden `_action`/`intent` form field; emit a row per branch, not per file.
- Resource routes vs pages hinge entirely on the presence/absence of a `default` export — easy to miscount.
- Filename `.` is a path separator, NOT a literal dot; literal dots live in `[...]`. Leading-`_` and trailing-`_` segments change nesting/path and are routinely misread.
- `app/routes.ts` (RR7) silently OVERRIDES filename conventions — never infer paths from filenames if it exists.
- `loader`/`action` only run server-side; `useFetcher`/`<Form>` and `clientLoader`/`clientAction` (RR7) can also hit these — `clientLoader`/`clientAction` are client-only and NOT separate endpoints.
- Nested routes mean ONE URL invokes MULTIPLE loaders (parent layouts + leaf). The "auth" for a leaf may live in an ancestor pathless layout, not the leaf file.

> tip: Resolve every route's full URL path FIRST (via `app/routes.ts` if present, else the flat-file/folder filename rules), then walk each module's exports — `loader`=GET, `action`=non-GET verbs, no-default=resource API — to enumerate INTERFACES.md.
