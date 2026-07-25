# Serverless & edge — Workers, Lambda/SST/CDK, Vercel functions

**When:** the routing table lives in **infrastructure config**, not in application code —
`wrangler.toml`/`wrangler.jsonc`, `serverless.yml`, `template.yaml` (SAM), `sst.config.ts`,
CDK stacks in `infra/`, `netlify.toml`, or a bare `api/` directory of Vercel functions. Often
combined with a framework guide (a Next.js app deployed to edge functions): read both.

The defining property: **a handler is not reachable until infrastructure says so.** Reading the
handlers alone gives you an incomplete and sometimes wrong surface.

## Where the interface surface lives

Work **infra-first, then handler**. One `INTERFACES.md` row per invocable: **trigger · route/
event · handler file · auth · runtime · notes**.

| Platform | Where routes/triggers are declared |
| --- | --- |
| **Cloudflare Workers** | `wrangler.toml`: `routes`/`route` patterns, `[[triggers]] crons`, `[[queues.consumers]]`, Durable Object bindings. A single `fetch` handler usually does its own internal routing (itty-router, Hono) — enumerate **those** paths too. |
| **AWS Lambda + API Gateway (SAM/Serverless Framework)** | `template.yaml` / `serverless.yml`: each function's `Events` — `HttpApi`/`Api` (method + path), `Schedule`, `SQS`, `S3`, `EventBridge`, `DynamoDB` streams. |
| **AWS CDK** | TypeScript/Python stack code: `new NodejsFunction(...)` + `api.addRoutes(...)`, `Rule` targets, `EventSource`s. The stack code *is* the config — read it like config, not like app code. |
| **SST** | `sst.config.ts`: `api.route("GET /notes/{id}", "packages/functions/src/get.handler")` — path and handler in one line. |
| **Vercel** | Filesystem: `api/**` (or a framework's own routing) + `vercel.json` `rewrites`/`redirects`/`headers`/`crons`. |
| **Netlify** | `netlify/functions/**` + `netlify.toml` `[[redirects]]`, `[functions]`, scheduled functions. |

Then, for each handler, capture the contract: **event shape in** (an API Gateway proxy event is
not an SQS record is not a `Request`), **response shape out** (status/headers/body, or the
platform's response object), and the **auth rule** — which for serverless usually lives in
infra too:

- API Gateway authorizers (JWT/Lambda/IAM), Cognito user pools;
- Cloudflare Access, or a Worker that validates a token itself;
- Vercel/Netlify middleware running at the edge before the function.

Non-HTTP triggers are first-class operations — **do not skip them**: cron/scheduled invocations
(record the schedule expression **and its timezone**), queue consumers (batch size, visibility
timeout, DLQ), object-storage events, stream consumers, webhooks.

On Workers these live as **sibling exports next to `fetch`**, so a route table built from the
router alone misses them entirely:

```ts
export default {
  fetch: app.fetch,                                        // the HTTP surface
  async scheduled(event: ScheduledController, env) {},     // one row per [triggers] crons entry
  async queue(batch: MessageBatch, env) {},                // one row per [[queues.consumers]]
};
```

Each of those is an `INTERFACES.md` row with its own trigger, payload type and failure/retry
contract — `ScheduledController` carries the cron that fired, `MessageBatch` carries the batch
and its per-message `retry()`/`ack()`.

## Data model

Rarely a classic relational schema; capture what there is:

- **Key-value / object stores** — Cloudflare KV or R2, S3, Vercel KV/Blob. The *key naming
  scheme* is the schema: document the key pattern, the value shape, and the TTL.
- **DynamoDB** — from the infra definition: partition key, sort key, every GSI/LSI with its keys
  and projection, billing mode, stream settings. Single-table designs need the **access
  patterns** written out or the model is unusable.
- **D1 / Turso / Neon / RDS** — a real SQL schema; find the migrations and treat it normally.
- **Durable Objects** — each class is a stateful entity: its stored keys, their shapes, and its
  concurrency guarantees.
- Enums and status sets, with complete member lists, as always.

## Entry points & boot

There is no long-lived boot — **each invocation is the entry point**. What matters instead:

- **Module scope vs handler scope.** Code outside the handler runs once per *instance* and is
  reused across invocations (warm start). Connection pools, clients and caches initialised there
  are shared state; a rebuild that moves them inside the handler changes performance and
  sometimes correctness.
- **Cold start** behaviour: provisioned concurrency, init timeouts, lazy imports.
- **Runtime constraints** — this is where serverless rebuilds fail most often. Record per
  function:
  - runtime + version (`nodejs20.x`, `python3.12`, Workers `compatibility_date` and flags),
  - **memory** and **timeout** (Workers CPU-time limits are different from wall-clock),
  - payload/response size limits,
  - whether the runtime is full Node or a **restricted edge runtime** (no `fs`, no native
    modules, Web APIs only — Workers, Vercel Edge, Deno Deploy).

## Config & env

- **Bindings are the dependency injection of this world.** Workers: `[vars]`, `[[kv_namespaces]]`,
  `[[r2_buckets]]`, `[[d1_databases]]`, `[[durable_objects]]`, `[[queues]]` — each binding name
  is how the code reaches a resource. Enumerate them: name → resource → which handlers use it.
- Secrets: `wrangler secret`, SSM/Secrets Manager, Vercel/Netlify env UI. **Names only**, never
  values, and note which are build-time vs runtime.
- **Per-environment/stage config** (`[env.production]`, `serverless.yml` `stage`, Vercel
  Preview/Production) — the differences are behaviour: different domains, different limits,
  different resources.
- IAM/permissions per function (least privilege) — a rebuild that skips these produces a
  function that cannot reach its own database.

## Gotchas

- **The filesystem lies.** `api/` shows handlers, but `vercel.json` rewrites, `wrangler.toml`
  route patterns and API Gateway path mappings change or add real paths. Reconcile both sources
  before writing a single row.
- **A handler with no trigger is dead code** — and a trigger with no handler is a broken deploy.
  Cross-check the two lists explicitly; the mismatch is a genuine finding.
- **Cron expressions need their timezone** (and UTC-vs-local is a real bug source). Copy the
  expression verbatim.
- **Retries and idempotency are part of the contract.** Queue and event triggers retry on
  failure — how many times, with what backoff, into which DLQ, and is the handler idempotent?
  If the original is not idempotent, that is a faithfulness fact to record.
- **Edge runtime ≠ Node.** Documenting a handler that uses `fs` or a native module as
  "edge" makes the rebuild fail at deploy time, not at test time.
- **Timeouts are behaviour**, not ops trivia: a 10-second API Gateway limit changes what the
  handler is allowed to do synchronously.
- **Local dev diverges from production** (`wrangler dev`, `sam local`, `netlify dev`) — note
  where, so acceptance criteria are written against production semantics.
- Cost/limits (invocation quotas, KV read/write limits) belong in `ARCHITECTURE.md` under
  quantified cross-cutting policies when the design depends on them.

> tip: build the interface table **from the infrastructure config first** — routes, crons, queue
> consumers, event sources — then open each handler for its event/response contract. Bindings and
> runtime limits (memory, timeout, edge-vs-Node) are contract, not deployment detail: a rebuild
> that misses them compiles and then fails in production.
