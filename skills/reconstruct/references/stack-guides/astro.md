# Astro

**When:** inventory.stack lists `astro`; root has `astro.config.mjs|ts|js` and `dependencies.astro`; presence of `src/pages/` with `.astro` files and `src/content/` (or `src/content.config.ts`).

## Where the interface surface lives
File-based routing in `src/pages/` — the path on disk IS the URL (minus `src/pages` and the extension). Two surface types:
- **Pages**: `.astro`, `.md`, `.mdx`, `.html` files → GET HTML routes. `src/pages/index.astro`→`/`, `src/pages/blog/[slug].astro`→`/blog/:slug`, `src/pages/[...path].astro`→catch-all `/*`. Dynamic segments `[param]`/`[...rest]` resolve via an exported `getStaticPaths()` (static build) returning `{ params, props }[]`. Auth: usually none, or guarded in `src/middleware.ts` (`onRequest`) or per-page checks of `Astro.locals`/cookies.
- **API endpoints**: `.ts`/`.js`/`.mjs` files in `src/pages/` (often `src/pages/api/...`) that **export named functions** `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `ALL` — each typed `APIRoute` = `(context: APIContext) => Response | Promise<Response>`. One file = one path, multiple methods = multiple exports. E.g. `src/pages/api/users/[id].ts` exporting `GET` and `DELETE` → two INTERFACES rows for `/api/users/:id`. `export const prerender = false` marks an endpoint as SSR (dynamic); `true` or default depends on output mode (see Gotchas).
To build a row: method = exported fn name (pages = GET); path = filesystem path under `src/pages` with `[x]`→`:x`, `[...x]`→`*`, `index`→`/`; handler = the file; auth = middleware/locals logic. Per-route config lives in the file: `getStaticPaths`, `prerender`. Global request interception (auth, headers, redirects) is `src/middleware.ts` / `src/middleware/index.ts` exporting `onRequest` (or `sequence(...)`).

## Data model
Astro has no ORM; the "data model" is **Content Collections**. Schema defined in `src/content.config.ts` (Astro 5) or `src/content/config.ts` (Astro 4) via `defineCollection({ loader, schema })` where `schema` is a **Zod** object (`z.object({...})`, often via `({ image }) => z.object(...)`). Each `defineCollection` = an entity; Zod fields = columns/types; `reference('otherCollection')` = a relation/FK. Collections registered in the exported `collections` object. Sources: `loader: glob({ pattern, base })` for local Markdown/`.md`/`.mdx`/`.json`/`.yaml` (Astro 5) or legacy `type: 'content' | 'data'` folders under `src/content/<name>/`. Read entries with `getCollection('name')`/`getEntry`. Also check `db/config.ts` (Astro DB / `@astrojs/db`: `defineTable`, `column.text/number/...`, `references`) — that is a real SQL schema if present. Treat each Zod/`defineTable` field as a DATA-MODEL row (name, type, optional/default, relation).

## Entry points & boot
No explicit server entry in source — Astro's compiler/Vite owns boot. Real entry surface = `astro.config.mjs` + `src/pages/` + `src/middleware.ts`. Layout/shell: `src/layouts/*.astro`. After build, the adapter emits a server entry (`dist/server/entry.mjs`) — node/vercel/netlify/cloudflare wrap it. `Astro.locals` is seeded in middleware and passed to pages/endpoints.

## Config & env
`astro.config.mjs`: `output: 'static' | 'server' | 'hybrid'` (Astro 4) — in Astro 5 only `'static'` or `'server'` with per-route `prerender`. `adapter:` (`@astrojs/node|vercel|netlify|cloudflare`) → SSR target. `integrations: []` (e.g. `@astrojs/react`, `tailwind`, `mdx`, `sitemap`, `db`) add renderers/routes. `base`/`site` affect URLs. Env: `import.meta.env.*` (Vite), `PUBLIC_`-prefixed vars are client-exposed; typed schema in `astro.config` `env.schema` (`envField`) → check for required secrets. Scripts in `package.json`: `astro dev`, `astro build`, `astro preview`, `astro check`.

## Gotchas
- An API route only handles the HTTP methods it **exports** — a missing `POST` export = 405, so enumerate exports, not assumptions.
- `output: 'static'` (default) means `.ts` endpoints are prerendered to JSON at build and dynamic pages REQUIRE `getStaticPaths`; only `output: 'server'`/`prerender=false` gives true runtime endpoints. The output mode changes whether a "route" is live or baked.
- Islands (`client:load|idle|visible|only`) are hydration directives on components, NOT routes/endpoints — do not list them in INTERFACES.
- `[...slug].astro` is a catch-all (lowest priority); `index` maps to the directory root; route specificity matters for overlap.
- Astro 5 moved collection config to `src/content.config.ts` and introduced the `loader` API; Astro 4 used `src/content/config.ts` with `type`. Check the version before locating the schema.
- Rest/spread params, redirects defined in `astro.config` (`redirects: {}`), and middleware-injected routes won't appear as files — scan the config too.

> tip: Enumerate every named HTTP-verb export across all `src/pages/**/*.{ts,js}` plus every `.astro`/`.md` page (path-mapped, with `getStaticPaths` for dynamics), and treat every `defineCollection`/`defineTable` Zod field as a data-model row — that pair is the entire interface + data surface.
