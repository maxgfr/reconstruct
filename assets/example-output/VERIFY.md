# Requirement verification worklist

For each requirement, open the cited source evidence and judge whether the requirement **traces to the original code** (faithful inference) or was invented. In `VERIFY.todo.json`, set each `verdict` to supported · partial · refuted · unsupported (+ a short `note`), and stamp each `confidence` to confirmed (evidence read and decisive) · inferred (consistent but indirect — a pattern or standard behavior) · gap (evidence thin; needs a human). Save it (e.g. as `verdicts.json`), then run `node scripts/analyze.mjs --verify --apply verdicts.json --out <dir>`.

## C1 · 01-core → feature 01-core
**Requirement:** [confirmed] `GET /` renders a `<main>` element containing exactly one `<h1>` whose text is `Welcome`.
**Captured evidence:** app/page.tsx · components/Button.tsx · lib/auth.ts · route /
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C2 · 01-core → app/page.tsx
**Requirement:** [confirmed] The home page renders the shared `Button` primitive with `label="Get started"`, producing `<button type="button">Get started</button>`.
**Captured evidence:** app/page.tsx · components/Button.tsx
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C3 · 01-core → app/page.tsx
**Requirement:** [confirmed] The home page hardcodes its copy (`"Welcome"`, `"Get started"`) and does NOT read the `messages/*.json` i18n catalog, so it renders English regardless of the active locale. (Faithful gap.)
**Captured evidence:** app/page.tsx
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C4 · 01-core → components/Button.tsx
**Requirement:** [confirmed] `Button({ label }: { label: string })` renders `<button type="button">{label}</button>` — one required `label` string prop, no other props, no variants, no `onClick`, no children.
**Captured evidence:** components/Button.tsx
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C5 · 01-core → lib/auth.ts
**Requirement:** [confirmed] `lib/auth.ts` exports `getSessionSecret(): string` returning `process.env.NEXTAUTH_SECRET ?? ""`; it performs no validation and never throws.
**Captured evidence:** lib/auth.ts
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C6 · 01-core → lib/auth.ts
**Requirement:** [confirmed] `lib/auth.ts` exports `databaseUrl(): string` returning `process.env.DATABASE_URL ?? ""`; it is a pure env read and is never called anywhere in the source. (Faithful gap: dead code preserved.)
**Captured evidence:** lib/auth.ts
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C7 · 01-core → feature 01-core
**Requirement:** [confirmed] `GET /` fetches no data, declares no dynamic segments, writes no entity, and requires no authentication (public).
**Captured evidence:** app/page.tsx · components/Button.tsx · lib/auth.ts · route /
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C8 · 01-core → feature 01-core
**Requirement:** **AC-1:** Given any visitor, When they GET `/`, Then the response is HTML containing `<h1>Welcome</h1>` inside a `<main>`.
**Captured evidence:** app/page.tsx · components/Button.tsx · lib/auth.ts · route /
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C9 · 01-core → app/page.tsx
**Requirement:** **AC-2:** Given the home page renders, When inspecting the DOM, Then there is exactly one `<button type="button">` whose text is `Get started`.
**Captured evidence:** app/page.tsx · components/Button.tsx
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C10 · 01-core → app/page.tsx
**Requirement:** **AC-3:** Given the active locale is `fr`, When a visitor loads `/`, Then the copy is still English (`Welcome` / `Get started`) because the page never consults the catalog. (Faithful gap path.)
**Captured evidence:** app/page.tsx
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C11 · 01-core → components/Button.tsx
**Requirement:** **AC-4:** Given `Button` is rendered with `label="X"`, When it mounts, Then it outputs exactly `<button type="button">X</button>` and nothing else.
**Captured evidence:** components/Button.tsx
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C12 · 01-core → feature 01-core
**Requirement:** **AC-5:** Given `NEXTAUTH_SECRET` is unset, When `getSessionSecret()` is called, Then it returns `""` (empty string) — not `undefined` — and does not throw.
**Captured evidence:** app/page.tsx · components/Button.tsx · lib/auth.ts · route /
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C13 · 01-core → feature 01-core
**Requirement:** **AC-6:** Given `DATABASE_URL="postgresql://localhost:5432/sample"`, When `databaseUrl()` is called, Then it returns that exact string.
**Captured evidence:** app/page.tsx · components/Button.tsx · lib/auth.ts · route /
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C14 · 01-core → feature 01-core
**Requirement:** **AC-7:** Given a visitor GETs `/`, When the response completes, Then no database query was issued and no entity was written.
**Captured evidence:** app/page.tsx · components/Button.tsx · lib/auth.ts · route /
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C15 · 02-project-setup → package.json
**Requirement:** [confirmed] `package.json` declares name `sample-app`, version `1.0.0`, `private: true`, and scripts `dev` → `next dev`, `build` → `next build`, `start` → `next start`, `lint` → `next lint`.
**Captured evidence:** package.json · next.config.js
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C16 · 02-project-setup → next.config.js
**Requirement:** [confirmed] Runtime dependencies are exactly: `next@^14.2.0`, `react@^18.3.0`, `react-dom@^18.3.0`, `zod@^3.23.0`, `tailwindcss@^3.4.0`.
**Captured evidence:** next.config.js
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C17 · 02-project-setup → feature 02-project-setup
**Requirement:** [confirmed] Dev dependencies are exactly: `typescript@^5.5.0`, `@types/react@^18.3.0`, `@playwright/test@^1.48.0`.
**Captured evidence:** .env.example · next.config.js · package.json
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C18 · 02-project-setup → next.config.js
**Requirement:** [confirmed] `zod`, `tailwindcss`, and `@playwright/test` are declared but never imported/configured/used anywhere in the source (no schema validation, no `tailwind.config`, no `@tailwind` directives, no test files). (Faithful gap.)
**Captured evidence:** next.config.js
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C19 · 02-project-setup → next.config.js
**Requirement:** [confirmed] `next.config.js` sets `reactStrictMode: true`.
**Captured evidence:** next.config.js
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C20 · 02-project-setup → next.config.js
**Requirement:** [inferred] `next.config.js` declares `i18n: { locales: ["en", "fr"], defaultLocale: "en" }`, which is a **Pages-Router** option; under this app's App Router it is inert (no `/en`, `/fr` locale-prefixed routing is produced). (Faithful gap.)
**Captured evidence:** next.config.js
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C21 · 02-project-setup → .env.example
**Requirement:** [confirmed] `.env.example` documents exactly two variables with example values: `DATABASE_URL=postgresql://localhost:5432/sample` and `NEXTAUTH_SECRET=changeme`.
**Captured evidence:** .env.example
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C22 · 02-project-setup → next.config.js
**Requirement:** [confirmed] No `tsconfig.json` and no `tailwind.config.*` exist in the source; TypeScript and Tailwind are present as dependencies only, with no config files. (Faithful gap: a real build would need a `tsconfig.json`.)
**Captured evidence:** next.config.js · package.json
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C23 · 02-project-setup → next.config.js
**Requirement:** **AC-1:** Given the repository, When `npm run dev` is invoked, Then it executes `next dev` (and `build`→`next build`, `start`→`next start`, `lint`→`next lint`).
**Captured evidence:** next.config.js
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C24 · 02-project-setup → package.json
**Requirement:** **AC-2:** Given `package.json`, When reading `dependencies`, Then `next`, `react`, `react-dom`, `zod`, and `tailwindcss` are present at exactly `^14.2.0`, `^18.3.0`, `^18.3.0`, `^3.23.0`, `^3.4.0` respectively.
**Captured evidence:** package.json · next.config.js
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C25 · 02-project-setup → package.json
**Requirement:** **AC-3:** Given `package.json`, When reading `devDependencies`, Then `typescript@^5.5.0`, `@types/react@^18.3.0`, and `@playwright/test@^1.48.0` are present.
**Captured evidence:** package.json
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C26 · 02-project-setup → feature 02-project-setup
**Requirement:** **AC-4:** Given the source tree, When grepping for `zod`, `@playwright/test`, and Tailwind usage, Then there are zero imports/uses (the deps are declared-but-unused). (Faithful gap path.)
**Captured evidence:** .env.example · next.config.js · package.json
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C27 · 02-project-setup → next.config.js
**Requirement:** **AC-5:** Given `next.config.js`, When Next loads it, Then `reactStrictMode` is `true`.
**Captured evidence:** next.config.js
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C28 · 02-project-setup → next.config.js
**Requirement:** **AC-6:** Given the App Router is in use, When `next.config.js`'s `i18n` key is evaluated, Then no locale-prefixed routes exist (the key is inert). (Faithful gap path.)
**Captured evidence:** next.config.js
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C29 · 02-project-setup → .env.example
**Requirement:** **AC-7:** Given `.env.example`, When a developer copies it to `.env`, Then exactly `DATABASE_URL` and `NEXTAUTH_SECRET` are documented, with the example values above.
**Captured evidence:** .env.example
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C30 · 02-project-setup → next.config.js
**Requirement:** **AC-8:** Given the source tree, When looking for `tsconfig.json` or `tailwind.config.*`, Then neither file exists. (Faithful gap path.)
**Captured evidence:** next.config.js · package.json
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C31 · 03-prisma → prisma/schema.prisma
**Requirement:** [confirmed] `prisma/schema.prisma` declares `datasource db { provider = "postgresql"; url = env("DATABASE_URL") }`.
**Captured evidence:** prisma/schema.prisma
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C32 · 03-prisma → prisma/schema.prisma
**Requirement:** [confirmed] It declares `model User` with field `id String @id @default(cuid())` — the primary key, defaulted to a Prisma-generated `cuid()`.
**Captured evidence:** prisma/schema.prisma
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C33 · 03-prisma → feature 03-prisma
**Requirement:** [confirmed] `User.email` is `String @unique` — required (NOT NULL) with a unique index.
**Captured evidence:** prisma/schema.prisma
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C34 · 03-prisma → feature 03-prisma
**Requirement:** [confirmed] `User.name` is `String?` — nullable/optional, no default.
**Captured evidence:** prisma/schema.prisma
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C35 · 03-prisma → prisma/schema.prisma
**Requirement:** [confirmed] The schema declares **no** `generator client {}` block, so `prisma generate` would produce no client as written. (Faithful gap.)
**Captured evidence:** prisma/schema.prisma
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C36 · 03-prisma → feature 03-prisma
**Requirement:** [confirmed] There are **no** relations, indexes beyond the `email` unique, enums, or additional models. `User` is the only entity.
**Captured evidence:** prisma/schema.prisma
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C37 · 03-prisma → feature 03-prisma
**Requirement:** [confirmed] The `User` model is never queried: no `PrismaClient` is instantiated and no read/write is issued anywhere in the source. (Faithful gap — the model is orphaned from the interface surface.)
**Captured evidence:** prisma/schema.prisma
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C38 · 03-prisma → prisma/schema.prisma
**Requirement:** **AC-1:** Given `prisma/schema.prisma`, When it is read, Then the datasource is provider `postgresql` with `url = env("DATABASE_URL")`.
**Captured evidence:** prisma/schema.prisma
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C39 · 03-prisma → feature 03-prisma
**Requirement:** **AC-2:** Given the `User` model, When inspecting `id`, Then it is `String`, `@id`, defaulted `@default(cuid())`.
**Captured evidence:** prisma/schema.prisma
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C40 · 03-prisma → feature 03-prisma
**Requirement:** **AC-3:** Given the `User` model, When inspecting `email`, Then it is `String`, `@unique`, and NOT NULL (no `?`).
**Captured evidence:** prisma/schema.prisma
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C41 · 03-prisma → feature 03-prisma
**Requirement:** **AC-4:** Given the `User` model, When inspecting `name`, Then it is `String?` (nullable) with no default.
**Captured evidence:** prisma/schema.prisma
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C42 · 03-prisma → prisma/schema.prisma
**Requirement:** **AC-5:** Given the schema, When searching for a `generator` block, Then none exists — `prisma generate` produces no client as shipped. (Faithful gap path.)
**Captured evidence:** prisma/schema.prisma
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C43 · 03-prisma → prisma/schema.prisma
**Requirement:** **AC-6:** Given the whole source tree, When grepping for `PrismaClient`, `prisma.`, or any `user.findMany/create/…`, Then there are zero usages — the model is never queried. (Faithful gap path.)
**Captured evidence:** prisma/schema.prisma
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C44 · 04-api → app/api/users/route.ts
**Requirement:** [confirmed] The handler is an exported `async function GET()` in `app/api/users/route.ts` (App-Router route handler).
**Captured evidence:** app/api/users/route.ts · route GET /api/users
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C45 · 04-api → feature 04-api
**Requirement:** [confirmed] The handler ignores the incoming request entirely: it reads no query parameters, no headers, and no body.
**Captured evidence:** app/api/users/route.ts · route GET /api/users
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C46 · 04-api → feature 04-api
**Requirement:** [confirmed] It computes `const ok = Boolean(getSessionSecret())`, where `getSessionSecret()` (from `lib/auth.ts`) returns `process.env.NEXTAUTH_SECRET ?? ""`. `ok` is `true` iff `NEXTAUTH_SECRET` is a **non-empty string**.
**Captured evidence:** app/api/users/route.ts · route GET /api/users
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C47 · 04-api → feature 04-api
**Requirement:** [confirmed] It returns `Response.json({ users: ok ? ["alice", "bob"] : [] })` — HTTP `200`, `Content-Type: application/json`, body shape `{ "users": string[] }`.
**Captured evidence:** app/api/users/route.ts · route GET /api/users
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C48 · 04-api → feature 04-api
**Requirement:** [confirmed] When `NEXTAUTH_SECRET` is non-empty, the body is `{ "users": ["alice", "bob"] }`; when empty/unset, the body is `{ "users": [] }`.
**Captured evidence:** app/api/users/route.ts · route GET /api/users
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C49 · 04-api → feature 04-api
**Requirement:** [confirmed] The endpoint performs **no authentication or authorization**: it never returns `401`/`403` and is reachable by anyone; the env var only toggles the payload, not access. (Faithful gap.)
**Captured evidence:** app/api/users/route.ts · route GET /api/users
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C50 · 04-api → feature 04-api
**Requirement:** [confirmed] The name list is a **hardcoded literal**, not derived from the `User` entity — no database query is issued and no `PrismaClient` is used. (Faithful gap.)
**Captured evidence:** app/api/users/route.ts · route GET /api/users
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C51 · 04-api → feature 04-api
**Requirement:** [confirmed] There is no error branch: the handler cannot fail on input and throws nothing (`ok` is a pure boolean over an env read).
**Captured evidence:** app/api/users/route.ts · route GET /api/users
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C52 · 04-api → app/api/users/route.ts
**Requirement:** **AC-1:** Given `NEXTAUTH_SECRET="anything-nonempty"`, When a client GETs `/api/users`, Then the response is `200` with body `{ "users": ["alice", "bob"] }` and `Content-Type: application/json`.
**Captured evidence:** app/api/users/route.ts · route GET /api/users
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C53 · 04-api → app/api/users/route.ts
**Requirement:** **AC-2:** Given `NEXTAUTH_SECRET` is unset or `""`, When a client GETs `/api/users`, Then the response is `200` with body `{ "users": [] }`.
**Captured evidence:** app/api/users/route.ts · route GET /api/users
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C54 · 04-api → app/api/users/route.ts
**Requirement:** **AC-3:** Given no session/cookie/authorization header at all, When a client GETs `/api/users`, Then it still returns `200` (never `401`/`403`) — access is not gated. (Faithful gap path.)
**Captured evidence:** app/api/users/route.ts · route GET /api/users
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C55 · 04-api → feature 04-api
**Requirement:** **AC-4:** Given the endpoint responds, When the database is unavailable or unconfigured, Then the response is unaffected because no query is issued — the list is hardcoded. (Faithful gap path.)
**Captured evidence:** app/api/users/route.ts · route GET /api/users
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C56 · 04-api → route GET /api/users
**Requirement:** **AC-5:** Given a request with arbitrary query params or a body, When it hits `GET /api/users`, Then the params/body are ignored and the response is identical to a bare GET.
**Captured evidence:** route GET /api/users · app/api/users/route.ts
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C57 · 05-internationalization → messages/en.json
**Requirement:** [confirmed] `messages/en.json` defines namespace `home` with `title = "Welcome"` and `cta = "Get started"`, and namespace `dashboard` with `title = "Dashboard"`.
**Captured evidence:** messages/en.json · messages/fr.json
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C58 · 05-internationalization → messages/en.json
**Requirement:** [confirmed] `messages/fr.json` defines the same keys with French values: `home.title = "Bienvenue"`, `home.cta = "Commencer"`, `dashboard.title = "Tableau de bord"`.
**Captured evidence:** messages/en.json · messages/fr.json
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C59 · 05-internationalization → feature 05-internationalization
**Requirement:** [confirmed] Both locales carry the identical key set — exactly three keys each (`home.title`, `home.cta`, `dashboard.title`) — with full parity (no key present in one locale and missing in the other).
**Captured evidence:** messages/en.json · messages/fr.json
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C60 · 05-internationalization → messages/en.json
**Requirement:** [confirmed] The catalogs are **never loaded** by the app: no `next-intl`/`useTranslations`/`getTranslations`/JSON import references them. The pages render hardcoded literals instead. (Faithful gap.)
**Captured evidence:** messages/en.json · messages/fr.json
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C61 · 05-internationalization → feature 05-internationalization
**Requirement:** [confirmed] The string `"Private area."` rendered on `/dashboard` has **no** catalog key in either locale — it is hardcoded and untranslatable as shipped. (Faithful gap.)
**Captured evidence:** messages/en.json · messages/fr.json
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C62 · 05-internationalization → feature 05-internationalization
**Requirement:** [inferred] The declared locales (`en`, `fr`, default `en`) come from `next.config.js`'s `i18n` block, which is a Pages-Router option and is inert under this App-Router app — so there is no locale-prefixed routing to switch between the catalogs even if they were used. (See `02-project-setup`.)
**Captured evidence:** messages/en.json · messages/fr.json
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C63 · 05-internationalization → messages/en.json
**Requirement:** **AC-1:** Given `messages/en.json`, When it is parsed, Then `home.title === "Welcome"`, `home.cta === "Get started"`, and `dashboard.title === "Dashboard"`.
**Captured evidence:** messages/en.json · messages/fr.json
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C64 · 05-internationalization → messages/en.json
**Requirement:** **AC-2:** Given `messages/fr.json`, When it is parsed, Then `home.title === "Bienvenue"`, `home.cta === "Commencer"`, and `dashboard.title === "Tableau de bord"`.
**Captured evidence:** messages/en.json · messages/fr.json
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C65 · 05-internationalization → feature 05-internationalization
**Requirement:** **AC-3:** Given both catalogs, When their key sets are compared, Then they are identical (three keys each, full parity, no missing translation).
**Captured evidence:** messages/en.json · messages/fr.json
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C66 · 05-internationalization → messages/en.json
**Requirement:** **AC-4:** Given the source tree, When grepping for catalog loaders (`next-intl`, `useTranslations`, imports of `messages/*.json`), Then there are zero references — the catalogs are unused. (Faithful gap path.)
**Captured evidence:** messages/en.json · messages/fr.json
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C67 · 05-internationalization → feature 05-internationalization
**Requirement:** **AC-5:** Given `/dashboard` renders `"Private area."`, When searching either catalog for that string, Then no key maps to it. (Faithful gap path.)
**Captured evidence:** messages/en.json · messages/fr.json
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C68 · 06-dashboard → app/dashboard/page.tsx
**Requirement:** [confirmed] `GET /dashboard` renders a `<section>` containing exactly one `<h2>` with text `Dashboard` and one `<p>` with text `Private area.`.
**Captured evidence:** app/dashboard/page.tsx · route /dashboard
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C69 · 06-dashboard → app/dashboard/page.tsx
**Requirement:** [confirmed] The copy is hardcoded (`"Dashboard"`, `"Private area."`) and not read from the i18n catalog; `"Private area."` has no catalog key in either locale. (Faithful gap.)
**Captured evidence:** app/dashboard/page.tsx · route /dashboard
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C70 · 06-dashboard → app/dashboard/page.tsx
**Requirement:** [confirmed] The page is **not access-controlled**: there is no session check, no `redirect()`, and no middleware — any visitor loads it and receives `200`. The "Private area." label does not imply any enforcement. (Faithful gap.)
**Captured evidence:** app/dashboard/page.tsx
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C71 · 06-dashboard → app/dashboard/page.tsx
**Requirement:** [confirmed] The page fetches no data, declares no dynamic segments, reads/writes no entity, and takes no parameters.
**Captured evidence:** app/dashboard/page.tsx
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C72 · 06-dashboard → app/dashboard/page.tsx
**Requirement:** **AC-1:** Given any visitor, When they GET `/dashboard`, Then the response is HTML with an `<h2>Dashboard</h2>` and a `<p>Private area.</p>` inside a `<section>`.
**Captured evidence:** app/dashboard/page.tsx · route /dashboard
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C73 · 06-dashboard → app/dashboard/page.tsx
**Requirement:** **AC-2:** Given no session, cookie, or authorization header, When a visitor GETs `/dashboard`, Then it returns `200` and renders normally — no `401`/`403`, no redirect to a login page. (Faithful gap path — the "private" label is not enforced.)
**Captured evidence:** app/dashboard/page.tsx · route /dashboard
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C74 · 06-dashboard → app/dashboard/page.tsx
**Requirement:** **AC-3:** Given the active locale is `fr`, When a visitor loads `/dashboard`, Then the copy is still English (`Dashboard` / `Private area.`) because the page never reads the catalog. (Faithful gap path.)
**Captured evidence:** app/dashboard/page.tsx · route /dashboard
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C75 · 06-dashboard → app/dashboard/page.tsx
**Requirement:** **AC-4:** Given the page renders, When the response completes, Then no database query ran and no entity was written.
**Captured evidence:** app/dashboard/page.tsx
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C76 · 07-documentation → README.md
**Requirement:** [confirmed] `README.md` opens with the H1 title `# Sample App`.
**Captured evidence:** README.md
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C77 · 07-documentation → feature 07-documentation
**Requirement:** [confirmed] It contains a one-to-two sentence description stating it is a tiny Next.js (App Router) fixture with two pages, one API route, a Prisma schema, and English/French translations, used to exercise the reconstruct analyzer.
**Captured evidence:** README.md
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C78 · 07-documentation → feature 07-documentation
**Requirement:** [confirmed] It provides **no** install/run/build/test instructions and no other sections — the description is the entire content. (Faithful: minimal by design.)
**Captured evidence:** README.md
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C79 · 07-documentation → feature 07-documentation
**Requirement:** [confirmed] It is the only documentation file in the repository.
**Captured evidence:** README.md
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C80 · 07-documentation → README.md
**Requirement:** **AC-1:** Given `README.md`, When it is opened, Then the first heading is `# Sample App`.
**Captured evidence:** README.md
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C81 · 07-documentation → README.md
**Requirement:** **AC-2:** Given `README.md`, When it is read, Then the body describes a Next.js App-Router fixture with two pages, one API route, a Prisma schema, and en/fr translations, used to exercise the reconstruct analyzer.
**Captured evidence:** README.md
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____

## C82 · 07-documentation → README.md
**Requirement:** **AC-3:** Given `README.md`, When searching for setup/run/test instructions, Then none are present (the file is intentionally minimal). (Faithful gap path.)
**Captured evidence:** README.md
**Verdict:** _____ · **Confidence:** _____ · **Note:** _____
