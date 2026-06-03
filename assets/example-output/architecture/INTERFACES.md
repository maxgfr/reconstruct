# Interface surface

| Setting | Value |
| --- | --- |
| Mode | `redesign` |
| Level | `complex` |
| Fidelity | `describe` |
| Generated with | `reconstruct@0.7.0` |

> 🧠 **For the AI agent:** Enumerate **every** interface this project exposes — HTTP routes, REST/JSON endpoints, tRPC/gRPC procedures, GraphQL operations, CLI commands, scheduled jobs, queues, and webhooks. The deterministic engine resolves routes for the supported frameworks (Next.js, Express, Flask, FastAPI, NestJS, Django, Rails, Go); for everything else, **read the candidate files below** and follow `references/analysis-playbook.md` (§Interface surface) plus the matching guide in `references/stack-guides/`. Fill the target table with one row per operation.


## Resolved routes (deterministic — verify against source)

| Method | Kind | Route | Handler file |
| --- | --- | --- | --- |
| — | page | `/` | `app/page.tsx` |
| GET | api | `/api/users` | `app/api/users/route.ts` |
| — | page | `/dashboard` | `app/dashboard/page.tsx` |

## Route candidates (verify — may include false positives)

_No additional route candidates._

## API surface candidates (tRPC / GraphQL / gRPC / OpenAPI)

_No RPC/GraphQL/OpenAPI candidates detected._

## Interface table (fill this in)

| Method / Trigger | Path / Operation | Kind | Handler file | Auth | Notes |
| --- | --- | --- | --- | --- | --- |

> 🧠 **For the AI agent:** Keep these columns; add a row per operation. Note auth/permission requirements, input/output shapes (link to `DATA-MODEL.md`), and side effects.

