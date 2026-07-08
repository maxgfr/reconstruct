# Prisma

> Unit `03-prisma` · kind: feature

## Summary

Groups 1 file(s).

## Context & goal

Define the persistence schema — a single `User` model on PostgreSQL via Prisma. The
outcome is a declared, migratable data model. Faithfully, the model is **not wired**:
nothing in the app queries it, so this unit's deliverable is the schema declaration
itself, captured exactly.

- **Depends on:** `02-project-setup` (the `DATABASE_URL` env var and the `tailwindcss`/toolchain baseline; the Prisma CLI is not itself a declared dependency — another gap).
- **Depended on by:** `04-api` *conceptually* (a real users endpoint would read `User`), but in the current source `04-api` returns a hardcoded list and does not depend on this schema at runtime.

## User stories

- As a developer, I can read `prisma/schema.prisma` so that I know the persistence shape (`User` with `id`, `email`, `name`) and the database provider (PostgreSQL).
- As a developer, I can point `DATABASE_URL` at a Postgres instance so that the datasource is configured (even though no query is issued).
- As a maintainer, I can see that the `User` model is declared but unused so that I understand the intended-but-unbuilt persistence path.

## Functional requirements

1. [confirmed] `prisma/schema.prisma` declares `datasource db { provider = "postgresql"; url = env("DATABASE_URL") }`.
2. [confirmed] It declares `model User` with field `id String @id @default(cuid())` — the primary key, defaulted to a Prisma-generated `cuid()`.
3. [confirmed] `User.email` is `String @unique` — required (NOT NULL) with a unique index.
4. [confirmed] `User.name` is `String?` — nullable/optional, no default.
5. [confirmed] The schema declares **no** `generator client {}` block, so `prisma generate` would produce no client as written. (Faithful gap.)
6. [confirmed] There are **no** relations, indexes beyond the `email` unique, enums, or additional models. `User` is the only entity.
7. [confirmed] The `User` model is never queried: no `PrismaClient` is instantiated and no read/write is issued anywhere in the source. (Faithful gap — the model is orphaned from the interface surface.)

## Interfaces & data

- **Operations exposed:** none. Prisma defines a schema, not an HTTP/RPC surface.
- **Entities:** `User` — see `../../architecture/DATA-MODEL.md` (§User) for the field-level contract (`id` PK `cuid()`, `email` unique NOT NULL, `name` nullable).
- **Write contract:** none. No mutation exists anywhere against `User`. Note for any future writer: `email` is the only required, non-defaulted column (its value must be supplied on insert); `id` is auto-defaulted via `cuid()`; `name` is optional. There is no owner foreign key, so `User` is anonymous-capable in principle — but nothing writes it today.
- **Enums/domain values:** none (no enum declared).

- **UI / design-system conformance:** not applicable — this unit renders no UI.

## Acceptance criteria

- **AC-1:** Given `prisma/schema.prisma`, When it is read, Then the datasource is provider `postgresql` with `url = env("DATABASE_URL")`.
- **AC-2:** Given the `User` model, When inspecting `id`, Then it is `String`, `@id`, defaulted `@default(cuid())`.
- **AC-3:** Given the `User` model, When inspecting `email`, Then it is `String`, `@unique`, and NOT NULL (no `?`).
- **AC-4:** Given the `User` model, When inspecting `name`, Then it is `String?` (nullable) with no default.
- **AC-5:** Given the schema, When searching for a `generator` block, Then none exists — `prisma generate` produces no client as shipped. (Faithful gap path.)
- **AC-6:** Given the whole source tree, When grepping for `PrismaClient`, `prisma.`, or any `user.findMany/create/…`, Then there are zero usages — the model is never queried. (Faithful gap path.)

## Edge cases & failure modes

- `DATABASE_URL` unset/empty → Prisma cannot connect, but since no query runs, the app does not fail at runtime (the datasource is inert).
- Missing `generator client` → any attempt to `import { PrismaClient }` would fail; the fixture never does, so it does not surface. (Recorded, not fixed.)
- Duplicate `email` on insert → the `@unique` index would reject it, but there is no insert path in the source, so this is only a schema-level guarantee, not an exercised one.
- No cascade/relation concerns — the single model holds no foreign keys.

## Source material

Files that implement this unit (rewrite them from the requirements above):

- `prisma/schema.prisma`


## Improvements & refactors

- [keep-behavior] Add the missing `generator client { provider = "prisma-client-js" }` block and the `prisma` + `@prisma/client` dependencies so the schema is actually usable.
- [keep-behavior] Wire `GET /api/users` to `prisma.user.findMany({ select: { name: true } })` so the endpoint returns real rows instead of the hardcoded list — opt-in, changes behavior.
- [keep-behavior] Add a `role` enum and `createdAt DateTime @default(now())` if the model grows; none exists today.

## Redesign notes

Under the proposed layout in `architecture/ARCHITECTURE.md`, the schema stays at
`prisma/schema.prisma`; if the model is ever wired, a `lib/db.ts` `PrismaClient`
singleton is the intended access point. No schema change is required to preserve
current (no-op) behavior.

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
