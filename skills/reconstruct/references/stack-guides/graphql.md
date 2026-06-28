# GraphQL (SDL-first & code-first)

**When:** `inventory.stack` lists `graphql`/`apollo-server`/`@apollo/server`/`graphql-yoga`/`mercurius`/`@nestjs/graphql`/`nexus`/`@pothos/core`/`type-graphql`; or files match `*.graphql`/`*.gql`, `schema.graphql`, `gql\`` template tags, `*.resolver.ts`, `builder.ts`, `nexus`/`pothos` imports.

## Where the interface surface lives
Every field on `Query`, `Mutation`, `Subscription` = **one operation row** in INTERFACES.md (method = Query/Mutation/Subscription; "path" = the field name + args; handler = the resolver function/file; auth = directive or guard). REST verbs don't apply — all traffic hits one HTTP endpoint (usually `POST /graphql`); record that base path once.
- **SDL-first:** schema in `.graphql`/`.gql` files or inline `gql\`...\`` / `buildSchema`. Read `type Query { feed(first: Int): [Post!]! }`. Resolvers live in a `resolvers` object map: `{ Query: { feed: (parent,args,ctx)=>... }, Mutation: {...}, Post: { author: ... } }` — often `resolvers/*.ts` or `*.resolvers.ts`. Match each schema field to its resolver key for the handler.
- **Nexus (code-first):** `objectType`, `queryType`/`mutationType`, `queryField`/`mutationField`, `extendType({ type:'Query', definition(t){ t.field('feed',{...resolve}) } })`. Generated SDL at `nexus-typegen`/`schema.graphql` — trust the generator output if present.
- **Pothos:** `builder.queryType`, `builder.queryField('feed', t=>...)`, `builder.mutationField`, `builder.prismaObject`. Resolve in the `resolve:` option.
- **TypeGraphQL:** classes decorated `@Resolver(of => Post)`; operations are methods with `@Query(() => [Post])`, `@Mutation`, `@Subscription`; args via `@Arg`/`@Args`; `@FieldResolver` for relations. Auth via `@Authorized(roles)`.
- **NestJS GraphQL:** `@Resolver(() => Post)` classes; `@Query()`, `@Mutation()`, `@Subscription()`, `@ResolveField()`; auth via `@UseGuards(GqlAuthGuard)` + `@Roles()`. Code-first (`autoSchemaFile`) or schema-first (`typePaths`).
- **Full operation name** = field name (no prefixes/nesting). Namespacing is by convention only (`user_create`) or via schema stitching/`extend type Query`. Federation: `@key(fields:"id")` on types, `@external`/`@requires`/`@provides`; each subgraph contributes operations — record the subgraph/service per operation.

## Data model
**The GraphQL `type`/`input`/`interface`/`enum`/`union` definitions ARE the data model** — list each `type` as an entity with its fields + scalar/object types, and `[T!]!`/`T` nullability. Object-typed fields (`author: User`) = relations; resolved by `@FieldResolver`/`Post.author` map entry, frequently via **DataLoader** (look for `new DataLoader`, `ctx.loaders.*`) — note the batched FK. But GraphQL types are a *projection*, not storage: cross-check the real persistence layer for true tables/indexes/migrations:
- Prisma (`schema.prisma` `model`, `@relation`, `@@index`), TypeORM `@Entity`, Sequelize, Drizzle, Mongoose `Schema`. Pothos `prismaObject`/TypeGraphQL+TypeORM often map 1:1 to DB entities. Put DB indexes/constraints in DATA-MODEL.md from the ORM, not the SDL.

## Entry points & boot
Server bootstrap: `new ApolloServer({ typeDefs, resolvers })` + `startStandaloneServer`/`expressMiddleware`; `createYoga({ schema })`; Mercurius `app.register(mercurius,{schema,resolvers})`; NestJS `GraphQLModule.forRoot()`. Entry usually `src/index.ts`/`server.ts`/`main.ts`/`app.ts`. `context` factory here defines `ctx` (auth/user, loaders) used by every resolver.

## Config & env
`codegen.yml`/`codegen.ts` (GraphQL Code Generator), `.graphqlconfig`/`graphql.config.*`, `apollo.config.js`, federation `supergraph.yaml`/`rover`. Env: `PORT`, `GRAPHQL_PATH`, DB URLs, `APOLLO_KEY`/`APOLLO_GRAPH_REF`. Scripts: `codegen`, `start`, `dev`.

## Gotchas
- One HTTP endpoint serves all ops — don't emit per-field REST routes; emit GraphQL operation rows.
- Schema-first SDL field and its resolver are in **different files**; an unmapped field = default resolver (returns `parent[field]`), still a valid operation.
- `@FieldResolver`/relation resolvers are operations too but represent relations, not top-level entry points — tag them.
- Auth is rarely on the route; it's in directives (`@auth`/`@hasRole`), guards (`@UseGuards`), `@Authorized`, or hand-rolled checks inside `resolve` — inspect resolver bodies.
- Subscriptions use a separate transport (WebSocket `graphql-ws`/SSE), not `POST /graphql` — note it.
- Generated files (`generated/graphql.ts`, `nexus-typegen.ts`) mirror but don't define the surface; read the source builders/SDL.
- Federation subgraphs split the schema across services — the full surface is the union of all subgraphs, not one file.

> tip: Enumerate every field under Query/Mutation/Subscription (across all SDL files, code-first builders, and federated subgraphs) as operations, then reconcile the SDL types against the real ORM models so DATA-MODEL.md reflects storage, not just the API projection.
