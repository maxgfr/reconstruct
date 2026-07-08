# Interface surface

| Setting | Value |
| --- | --- |
| Mode | `redesign` |
| Level | `complex` |
| Fidelity | `describe` |
| Generated with | `reconstruct@1.3.0` |

The project exposes exactly **three** operations, all resolved from the App-Router
file system and confirmed against source. There are no tRPC/GraphQL/gRPC procedures,
no CLI commands, no scheduled jobs, no queues, no webhooks, and no WebSocket/SSE
channels. Server Actions (`"use server"`) and middleware (`middleware.ts`) are both
absent.

## Resolved routes (deterministic — verify against source)

| Method | Kind | Route | Handler file |
| --- | --- | --- | --- |
| — | page | `/` | `app/page.tsx` |
| GET | api | `/api/users` | `app/api/users/route.ts` |
| — | page | `/dashboard` | `app/dashboard/page.tsx` |

## Route candidates (verify — may include false positives)

_No additional route candidates._

## API surface candidates (tRPC / GraphQL / gRPC / OpenAPI)

_No RPC/GraphQL/OpenAPI candidates detected — none exist in the source._

## Realtime / WebSocket candidates (verify)

_No realtime/WebSocket signals detected — none exist in the source._

## Auth / middleware candidates (verify)

_No auth/middleware signals detected. There is no `middleware.ts` and no route
guard; every operation below is effectively public. The `NEXTAUTH_SECRET` env var
influences only the payload of `GET /api/users`, not access._

## Interface table

| Method / Trigger | Path / Operation | Kind | Handler file | Auth | Notes |
| --- | --- | --- | --- | --- | --- |
| GET (HTTP) | `/` | Page (RSC, HTML) | `app/page.tsx` | None (public) | Renders `<main><h1>Welcome</h1><Button label="Get started"/></main>`. No data fetching, no params. |
| GET (HTTP) | `/dashboard` | Page (RSC, HTML) | `app/dashboard/page.tsx` | None (public) — labeled "Private area." but not access-controlled | Renders `<section><h2>Dashboard</h2><p>Private area.</p></section>`. No data fetching, no params. |
| GET | `/api/users` | Route handler (JSON) | `app/api/users/route.ts` | None (public) — returns 200 either way | See operation contract below. |

## Operation contracts

### `GET /` — Home page

- **Input:** none (no query params, no body, no dynamic segments).
- **Output:** HTML. A `<main>` containing an `<h1>Welcome</h1>` and the shared `Button` with `label="Get started"` (rendered as `<button type="button">Get started</button>`).
- **Auth:** none. Public.
- **Side effects:** none. Reads no entity, writes no entity, calls no service.

### `GET /dashboard` — Dashboard page

- **Input:** none.
- **Output:** HTML. A `<section>` containing `<h2>Dashboard</h2>` and `<p>Private area.</p>`.
- **Auth:** none. The copy says "Private area." but there is **no** authentication or redirect — any visitor can load it. (Faithful gap.)
- **Side effects:** none. Reads no entity, writes no entity.

### `GET /api/users` — Users list

- **Handler:** exported `async function GET()` in `app/api/users/route.ts`.
- **Input:** none (no query params, no body). The handler ignores the request entirely.
- **Logic:** `const ok = Boolean(getSessionSecret())` where `getSessionSecret()` returns `process.env.NEXTAUTH_SECRET ?? ""`. `ok` is `true` iff `NEXTAUTH_SECRET` is a **non-empty string**.
- **Output:** always HTTP `200` with `Content-Type: application/json` (via `Response.json(...)`). Body shape `{ "users": string[] }`:
  - `NEXTAUTH_SECRET` non-empty → `{ "users": ["alice", "bob"] }`.
  - `NEXTAUTH_SECRET` empty/unset → `{ "users": [] }`.
- **Auth:** none. It never returns 401/403; the env var only toggles the payload. This is a presence check on a string, not authentication. (Faithful gap.)
- **Side effects:** none. It issues **no** database query — the `["alice","bob"]` list is a hardcoded literal, not derived from the `User` entity in `DATA-MODEL.md`. No entity is read or written. (Faithful gap.)
- **Errors:** none are thrown or handled; the function has no failure branch.

See `DATA-MODEL.md` for entities (note: no operation here actually reads or writes
one) and each feature PRD for the story-level acceptance criteria.
