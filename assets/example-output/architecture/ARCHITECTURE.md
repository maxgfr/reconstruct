# Architecture

| Setting | Value |
| --- | --- |
| Mode | `redesign` |
| Level | `complex` |
| Fidelity | `describe` |
| Generated with | `reconstruct@1.3.0` |

## Detected stack

Next.js, React · TypeScript

**Libraries:** Tailwind CSS, Zod, Playwright

The project is a Next.js 14 **App Router** application (folder `app/`) written in
TypeScript. It ships two server-rendered pages (`/`, `/dashboard`), one JSON route
handler (`GET /api/users`), a Prisma schema targeting PostgreSQL, and English/French
message catalogs. It is a fixture: the surface is deliberately tiny and several
declared capabilities are wired but never exercised (see **Known gaps** below).

## Top-level layout

- `app/` — App-Router routes: `page.tsx` (`/`), `dashboard/page.tsx` (`/dashboard`), `api/users/route.ts` (`GET /api/users`).
- `components/` — one shared UI primitive, `Button.tsx`.
- `lib/` — `auth.ts`, two pure environment-variable readers (`getSessionSecret`, `databaseUrl`).
- `messages/` — `en.json`, `fr.json` message catalogs (namespaces `home`, `dashboard`).
- `prisma/` — `schema.prisma` (datasource `postgresql`, one `User` model).
- root files: `.env.example`, `README.md`, `next.config.js`, `package.json`.

## Dependencies

- **npm** (`package.json`): 5 runtime, 3 dev.
- Runtime: `next@^14.2.0`, `react@^18.3.0`, `react-dom@^18.3.0`, `zod@^3.23.0`, `tailwindcss@^3.4.0`.
- Dev: `typescript@^5.5.0`, `@types/react@^18.3.0`, `@playwright/test@^1.48.0`.
- **Faithful gap:** `zod` and `@playwright/test` are declared but never imported or used anywhere in the source (no schema validation, no test files). `tailwindcss` is declared but there is no `tailwind.config.*`, no `globals.css`, and no `className` usage — it is inert too.

## Data & schema

- `prisma/schema.prisma` — datasource `db` (provider `postgresql`, `url = env("DATABASE_URL")`), one model `User { id, email, name }`. See `DATA-MODEL.md`.
- **Faithful gap:** no Prisma client is instantiated and no query is issued anywhere. The schema is declared but unused at runtime.

## Internationalization

Locales: `en`, `fr` — files copied verbatim to `data/translations/`. Default locale `en`.

Message catalog (source strings, per `data/translations/messages/*.json`):

| Namespace.key | en (source) | fr |
| --- | --- | --- |
| `home.title` | `Welcome` | `Bienvenue` |
| `home.cta` | `Get started` | `Commencer` |
| `dashboard.title` | `Dashboard` | `Tableau de bord` |

- **Faithful gap:** the pages do **not** read these catalogs. `HomePage` hardcodes `"Welcome"` and `"Get started"`; `DashboardPage` hardcodes `"Dashboard"` and `"Private area."`. The `"Private area."` string has no catalog key at all.
- **Faithful gap:** the `i18n` block in `next.config.js` (`locales`, `defaultLocale`) is a **Pages-Router** configuration option. This app uses the App Router, which ignores that key, so no locale-prefixed routing (`/fr`, `/en`) is actually produced.

## External services & integrations

**None are called at runtime.** The project configures, but never contacts, any
external system:

- **PostgreSQL** — declared as the Prisma datasource (`provider = "postgresql"`, `url = env("DATABASE_URL")`). No Prisma client is created and no connection is opened; the database is never reached. Failure behavior: not applicable (no call site).
- **NextAuth / session store** — implied by the `NEXTAUTH_SECRET` env var, but no NextAuth handler, provider, or session lookup exists. `lib/auth.ts#getSessionSecret()` only reads the raw env string; it validates nothing and calls nothing.
- No email, payment, geocoding, storage, queue, analytics, or third-party HTTP integration exists in the source.

There is therefore no request/response contract, timeout, or retry policy to
capture — recording their **absence** is the faithful contract.

## Cross-cutting policies

- **Authentication / authorization:** none is enforced. `GET /api/users` is publicly reachable and returns HTTP 200 whether or not `NEXTAUTH_SECRET` is set. `/dashboard` is publicly reachable despite the `"Private area."` label. There is no middleware (`middleware.ts` is absent) and no route guard.
- **Input validation:** none. No route accepts a body or query parameter; `zod` is present but unused, so there is no schema-validation policy to specify.
- **Format validations:** none. No coded identifiers, slugs, or regex-validated fields exist in the source.
- **Rate limiting:** none. No throttle, window, key strategy, or store is configured.
- **Security headers / CORS:** none configured beyond Next.js defaults.
- **React strict mode:** `reactStrictMode: true` in `next.config.js` — double-invokes effects/renders in development only; no production behavior change.
- **Env-var gate (the one real conditional):** `GET /api/users` branches on `Boolean(getSessionSecret())` — a non-empty `NEXTAUTH_SECRET` yields the list `["alice","bob"]`; an empty/unset one yields `[]`. This is the sole cross-cutting rule and it is a **presence check on a string**, not authentication.

## Proposed architecture (redesign)

This run is in **redesign** mode: the target keeps every behavior identical (including
the faithful gaps — a redesign preserves the observable contract, it does not "fix"
the fixture) while proposing a cleaner module layout. Every change below is
`[keep-behavior]`.

```
app/
  layout.tsx            # root layout (add: required by App Router; render <html><body>)
  page.tsx              # "/"        → <h1>Welcome</h1> + <Button label="Get started"/>
  dashboard/page.tsx    # "/dashboard" → <h2>Dashboard</h2><p>Private area.</p>
  api/users/route.ts    # GET /api/users → { users: string[] }
components/
  Button.tsx            # <button type="button">{label}</button>
lib/
  env.ts                # renamed from auth.ts: getSessionSecret(), databaseUrl()
  db.ts                 # (optional) a single PrismaClient singleton — currently unused
messages/
  en.json  fr.json      # catalogs (namespaces home, dashboard)
prisma/
  schema.prisma         # model User
next.config.js
```

Rationale, per module:

- **`app/`** — keep file-based routing; the three routes map 1:1. A root `layout.tsx`
  is the only genuinely missing piece for a runnable App-Router app; adding it does not
  change any route's output. `[keep-behavior]`
- **`lib/env.ts`** — rename `auth.ts` to `env.ts` to describe what it is (env readers,
  not auth). Signatures and return values are unchanged. `[keep-behavior]`
- **`lib/db.ts`** — if the User model is ever wired, a single `PrismaClient` singleton
  belongs here. Today it stays absent so behavior is identical. `[keep-behavior]`
- **`components/`** — `Button` is the only primitive; keep it as the design-system
  entry point. `[keep-behavior]`
- **i18n** — the catalogs are correct; the redesign would route page copy through them
  (e.g. `next-intl`) instead of hardcoding, but doing so changes rendered behavior only
  if the active locale is `fr`, so it is left as an opt-in improvement, not a redesign
  default. Recorded in each page's feature PRD under *Improvements*.

## Known gaps (faithful properties of the original — preserved, not fixed)

1. The `User` Prisma model is declared but never queried; `GET /api/users` returns a hardcoded list.
2. Pages hardcode UI copy instead of reading the `messages/*.json` catalog; `"Private area."` has no catalog key.
3. `GET /api/users` performs no authentication — it returns 200 for everyone and only varies the payload on `NEXTAUTH_SECRET` presence.
4. `/dashboard` is labeled private but is not access-controlled.
5. `zod`, `@playwright/test`, and `tailwindcss` are declared dependencies with no usage in the source.
6. `lib/auth.ts#databaseUrl()` is exported but never called.
7. `next.config.js`'s `i18n` key is a Pages-Router option and is inert under the App Router.
