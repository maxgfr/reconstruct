# RPC Surfaces — tRPC / gRPC / Connect / Twirp

**When:** inventory.stack/deps include `@trpc/server`, `@trpc/client`, `@trpc/next`, `zod` (tRPC); `*.proto` files + `@grpc/grpc-js`, `grpc`, `protobufjs`, `ts-proto`, `buf`, `nice-grpc` (gRPC); `@connectrpc/connect`, `connect-go`, `twirp` (Connect/Twirp). A single catch-all `api/trpc/[trpc]` route is the strongest tRPC signal — DO NOT list it as one endpoint.

## Where the interface surface lives
The API is the **tree of procedures**, not the HTTP mount. One row in INTERFACES.md per procedure/rpc.

**tRPC:** look for `initTRPC.create()` / `.context<...>().create()` (often `server/api/trpc.ts` or `server/trpc.ts`). It exports builders: `router`/`createTRPCRouter`, `publicProcedure`, `protectedProcedure`/`authedProcedure` (the latter = auth via a `.use(middleware)`). Root router (`server/api/root.ts`, `appRouter`) composes sub-routers: `createTRPCRouter({ user: userRouter, post: postRouter })`. Each sub-router (`server/api/routers/*.ts`) defines `procedureName: publicProcedure.input(zSchema).query(fn)` / `.mutation(fn)` / `.subscription(fn)`.
- **Full operation path** = dotted nesting: root key + sub-router key + procedure key → `post.byId`, `user.profile.update`. Path is the call name, NOT a URL.
- **Row fields:** method = `query` (read) / `mutation` (write) / `subscription` (stream); operation = dotted path; handler = file + procedure key; auth = which base procedure (`publicProcedure` vs `protectedProcedure`); input/output = the `zod` schema in `.input(...)` / `.output(...)`.
- Mount: `fetchRequestHandler`/`createNextApiHandler` in `app/api/trpc/[trpc]/route.ts` or `pages/api/trpc/[trpc].ts` — note it once as the transport, not as endpoints.

**gRPC/Connect/Twirp:** read `*.proto`. Each `service Foo { rpc Bar (BarReq) returns (BarRes); }` = one row: operation = `package.Foo/Bar`, input/output = the messages. Streaming = `stream` keyword: `rpc X(stream Req) returns (Res)` (client-stream), `returns (stream Res)` (server-stream), both (bidi). Note it in the row. Generated stubs (`*_pb.ts`, `*_grpc_pb.js`, `*_connect.ts`, `*.pb.go`) confirm wiring; handler = `addService`/`registerService` impl class/object. `buf.gen.yaml`/`buf.yaml` lists plugins; `connect-go` registers via `NewFooServiceHandler`.

## Data model
tRPC has **no ORM of its own** — the data layer is whatever the app uses. The `zod` `.input`/`.output` schemas describe wire shapes, not tables. For DATA-MODEL.md follow the procedure body to the real store (Prisma `prisma/schema.prisma`, Drizzle `*.schema.ts`, TypeORM entities, raw SQL). proto `message {}` defines field names + scalar/enum/`repeated` types — useful for entity shape when the proto IS the schema, but it carries no relations/indexes; cross-check the DB layer.

## Entry points & boot
tRPC ships inside a host app: Next.js (`next.config.js`, App or Pages router), or standalone via `@trpc/server/adapters/{standalone,express,fastify,ws}`. Boot = the host server; tRPC attaches at the catch-all/adapter. `createContext` (auth, db handle) defined alongside `initTRPC`. gRPC: a `main`/`server.ts`/`cmd/.../main.go` calls `new Server()` + `server.addService(...)` + `bindAsync(host:port)`; Connect mounts on an HTTP handler/mux.

## Config & env
tRPC: `package.json` scripts (`dev`/`build`/`start`); env via host (`.env`, `src/env.mjs` in T3). Transformer (`superjson`) set in `initTRPC` and client `links`. gRPC: `buf.yaml`/`buf.gen.yaml`/`protoc` invocation in scripts/Makefile; port + TLS in server bootstrap and `.env`.

## Gotchas
- A repo with one `[trpc]` catch-all has **dozens of real endpoints** — enumerate procedures, never report the catch-all as the API.
- Procedure path is **structural**: rename a router key in `createTRPCRouter({...})` and every call path changes — derive paths from nesting keys, not from function names.
- `protectedProcedure`/`enforceUserIsAuthed` middleware is the auth boundary; auth lives in the base builder via `.use(...)`, not on each procedure.
- `.input()` may chain/merge zod schemas or be omitted (no args); `.output()` is often absent (inferred) — don't assume a declared output type exists.
- tRPC v10 = `publicProcedure.input().query()` chains; v9 = `t.router().query('name', { input, resolve })` (string keys) — different parse shape. v11 adds richer subscriptions/SSE.
- gRPC method path is `/package.Service/Method` (proto `package`, not the file path); streaming direction changes the interface contract — capture it.
- Merged routers (`t.mergeRouters(...)`) and re-exported sub-routers can hide procedures; trace every key in the root composition.

> tip: The deliverable is the flattened list of every procedure/rpc with its dotted-or-slashed path, query/mutation/stream kind, input & output types, and auth base — the transport mount is a footnote.
