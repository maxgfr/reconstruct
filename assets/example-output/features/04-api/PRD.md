# API

> Unit `04-api` · kind: feature

## Summary

Groups 1 file(s); routes: /api/users.

## Context & goal

Expose the app's single JSON endpoint, `GET /api/users`, which returns a list of user
names. The outcome for a caller is a `200` response whose payload is either two names
or an empty array, decided solely by whether `NEXTAUTH_SECRET` is set. Faithfully, it
does **no** authentication and **no** database access.

- **Depends on:** `01-core` (imports `getSessionSecret` from `lib/auth.ts`); `02-project-setup` (the `NEXTAUTH_SECRET` env var).
- **Depended on by:** nothing in the source consumes this endpoint (the pages do not fetch it).

## User stories

- As an API client, I can GET `/api/users` so that I receive a JSON list of user names.
- As an operator, I can set `NEXTAUTH_SECRET` so that the endpoint returns the populated list (`["alice","bob"]`) instead of an empty one.
- As an unauthenticated client, I can GET `/api/users` so that I still get a `200` (there is no auth gate) — with an empty list when no secret is configured.

## Functional requirements

1. [confirmed] The handler is an exported `async function GET()` in `app/api/users/route.ts` (App-Router route handler).
2. [confirmed] The handler ignores the incoming request entirely: it reads no query parameters, no headers, and no body.
3. [confirmed] It computes `const ok = Boolean(getSessionSecret())`, where `getSessionSecret()` (from `lib/auth.ts`) returns `process.env.NEXTAUTH_SECRET ?? ""`. `ok` is `true` iff `NEXTAUTH_SECRET` is a **non-empty string**.
4. [confirmed] It returns `Response.json({ users: ok ? ["alice", "bob"] : [] })` — HTTP `200`, `Content-Type: application/json`, body shape `{ "users": string[] }`.
5. [confirmed] When `NEXTAUTH_SECRET` is non-empty, the body is `{ "users": ["alice", "bob"] }`; when empty/unset, the body is `{ "users": [] }`.
6. [confirmed] The endpoint performs **no authentication or authorization**: it never returns `401`/`403` and is reachable by anyone; the env var only toggles the payload, not access. (Faithful gap.)
7. [confirmed] The name list is a **hardcoded literal**, not derived from the `User` entity — no database query is issued and no `PrismaClient` is used. (Faithful gap.)
8. [confirmed] There is no error branch: the handler cannot fail on input and throws nothing (`ok` is a pure boolean over an env read).

## Routes

| Method | Route | Kind | File |
| --- | --- | --- | --- |
| GET | `/api/users` | api | `app/api/users/route.ts` |

## Interfaces & data

- **Operations exposed:** `GET /api/users` — see `../../architecture/INTERFACES.md` (§`GET /api/users`) for the full contract. Input: none. Output: `200 application/json { users: string[] }`. Auth: none.
- **Helpers consumed:** `getSessionSecret()` from `01-core`/`lib/auth.ts` (`() => string`).
- **Entities read/written:** none. Despite its name, this endpoint does **not** read the `User` entity in `../../architecture/DATA-MODEL.md`; the returned names are literals. No mutation, so there is no write contract to satisfy.
- **Enums/domain values:** none.

- **UI / design-system conformance:** not applicable — this unit returns JSON, not UI.

## Acceptance criteria

- **AC-1:** Given `NEXTAUTH_SECRET="anything-nonempty"`, When a client GETs `/api/users`, Then the response is `200` with body `{ "users": ["alice", "bob"] }` and `Content-Type: application/json`.
- **AC-2:** Given `NEXTAUTH_SECRET` is unset or `""`, When a client GETs `/api/users`, Then the response is `200` with body `{ "users": [] }`.
- **AC-3:** Given no session/cookie/authorization header at all, When a client GETs `/api/users`, Then it still returns `200` (never `401`/`403`) — access is not gated. (Faithful gap path.)
- **AC-4:** Given the endpoint responds, When the database is unavailable or unconfigured, Then the response is unaffected because no query is issued — the list is hardcoded. (Faithful gap path.)
- **AC-5:** Given a request with arbitrary query params or a body, When it hits `GET /api/users`, Then the params/body are ignored and the response is identical to a bare GET.

## Edge cases & failure modes

- `NEXTAUTH_SECRET` set to a whitespace string (e.g. `" "`) → `Boolean(" ")` is `true`, so the populated list is returned (a space is a non-empty string). (Faithful: it is a presence check, not a validity check.)
- `NEXTAUTH_SECRET=""` (explicit empty) or unset → empty list.
- Database down / `DATABASE_URL` wrong → no effect (no query path).
- Non-GET method (POST/PUT/…) to `/api/users` → Next.js returns `405 Method Not Allowed` automatically because only `GET` is exported. (Framework behavior; no other method is handled.)
- No concurrency/idempotency concerns: the handler is stateless and side-effect-free; repeated calls return identical results for a fixed env.

## Source material

Files that implement this unit (rewrite them from the requirements above):

- `app/api/users/route.ts`


## Improvements & refactors

- [keep-behavior] Replace the hardcoded `["alice","bob"]` with `prisma.user.findMany({ select: { name: true } })` so the endpoint reflects real data — opt-in, changes behavior.
- [keep-behavior] Enforce real authentication (return `401` when unauthenticated) instead of the env-presence check — opt-in, changes the contract.
- [keep-behavior] Validate/normalize output with the already-installed `zod` (e.g. a `z.array(z.string())` response schema) — currently `zod` is unused.
- [keep-behavior] Add a typed response (`NextResponse.json<{ users: string[] }>`) for clarity.

## Redesign notes

Under the proposed layout in `architecture/ARCHITECTURE.md`, the handler stays at
`app/api/users/route.ts` and continues to import the env reader (from `lib/env.ts`
after the rename). The payload and status codes are unchanged; only the import path
would move.

## Definition of done

- [ ] Every functional requirement is implemented and covered by a test.
- [ ] Every acceptance-criteria scenario passes (including the failure paths).
- [ ] Every operation this unit owns in `architecture/INTERFACES.md` responds correctly.
- [ ] Every entity it writes matches `architecture/DATA-MODEL.md` (fields, types, constraints).
- [ ] Every write is satisfiable against the schema: no required (NOT NULL, no-default) column or foreign key is left unfilled; anonymous/public operations write only to anonymous-capable entities (no owner FK).
- [ ] Every enum/domain value this unit uses is one of the members fully enumerated in `architecture/DATA-MODEL.md`.
- [ ] Every edge case & failure mode above is handled.
- [ ] Every user-facing string has a source string in the message catalog and resolves in every locale (no missing keys, no hard-coded copy).
- [ ] `node scripts/analyze.mjs --check --out <out>` passes — no unresolved agent callouts or placeholders, and every reference resolves.
