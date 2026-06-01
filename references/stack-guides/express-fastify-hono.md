# Express / Fastify / Koa / Hono — Interface & Data-Model Cheat-Sheet

**When:** `inventory.stack` lists `express`, `fastify`, `koa`/`@koa/router`, or `hono` in deps; entry files `index.ts`/`server.ts`/`app.ts`/`src/main.ts` call `app.listen(...)`, `fastify.listen(...)`, `serve({fetch: app.fetch})`, or `app.callback()`.

## Where the interface surface lives
Routes are imperative calls, not decorators — grep the whole `src/` tree, not just one folder.
- **Express/Koa-router:** `app.get/post/put/patch/delete/all('/path', ...handlers)` and `router.METHOD(...)`. `const r = express.Router()` (or `new Router()` for koa) collects routes; mounted via `app.use('/prefix', r)`. **Full path = concatenation of every mount prefix down the chain** (mounts can nest: `app.use('/api', api)` → `api.use('/v1/users', usersRouter)` → `usersRouter.get('/:id')` = `GET /api/v1/users/:id`). Dynamic segments `:id`, wildcards `*`/`(.*)`, regex params. Handler file = the module exporting the router. Auth = middleware in the handler chain (`requireAuth`, `passport.authenticate(...)`, `app.use(jwt(...))`) or `router.use(mw)` before routes — record middleware applied before/at the route.
- **Fastify:** `fastify.get/post(...)`, `fastify.route({method, url, handler, preHandler, schema})`. Routes live in **plugins** registered via `fastify.register(plugin, { prefix: '/x' })`; prefixes **nest** through registers. `schema.body/querystring/params/response` (JSON Schema or Zod/TypeBox via `fastify-type-provider`) documents the payload — pull field types from it. Auth = `preHandler`/`onRequest` hooks (`fastify.authenticate`), or `@fastify/auth`. `autoload`/`fastify-autoload` maps `routes/` dir to URL prefixes by folder name.
- **Hono:** `app.get/post('/path', c => ...)`. Sub-apps mounted with `app.route('/prefix', subApp)` — **prefixes nest**; `app.basePath('/api')` adds a base. Middleware via `app.use('/path/*', mw)`. RPC type via `hono/client`. Params `c.req.param('id')`, path `:id`.
- **Output rows:** one INTERFACES.md row per method+full-path: `method · full path · handler file:export · auth middleware`. Don't forget `app.all`, mounted 3rd-party routers (`/health`, swagger, GraphQL at `app.use('/graphql', ...)`), and any background jobs (BullMQ `new Worker(queue, fn)`, `node-cron`/`cron.schedule`, `setInterval`).

## Data model
No ORM is bundled — detect from deps:
- **Prisma:** `prisma/schema.prisma` → `model X { field Type @id @unique @relation }`; `@@index`, `@@unique`, `@relation(fields:[],references:[])` give relations; `migrations/` SQL is source of truth.
- **TypeORM:** `@Entity()` classes with `@Column`, `@PrimaryGeneratedColumn`, `@OneToMany/@ManyToOne/@ManyToMany`, `@Index`. Files often `*.entity.ts` / `entities/`.
- **Sequelize:** `sequelize.define('X', {...})` or `Model.init({...}, {...})`; `Model.hasMany/belongsTo/belongsToMany` for relations; `migrations/` dir.
- **Mongoose:** `new Schema({...})` + `model('X', schema)`; `ref:` = relation, `schema.index(...)`, `*.model.ts` / `models/`.
- **Drizzle:** `pgTable/mysqlTable/sqliteTable('name', {col: type()...})` in `schema.ts`/`db/schema/`; relations via `relations()` and `references(() => ...)`; `drizzle/` migrations.
- **Knex/raw SQL:** read `migrations/*.js|sql` `createTable` / `CREATE TABLE` for fields + indexes.
Validation schemas (Zod/Joi/Yup/TypeBox) on request bodies double as field-type sources for DTOs.

## Entry points & boot
Entry = `package.json` `"main"`/`scripts.start`/`scripts.dev` (often `tsx`/`ts-node src/server.ts`, `node dist/index.js`, or `nodemon`). Bootstrap file builds the app, registers middleware/plugins/routers **in order**, then `listen(PORT)`. Server file may differ from app file (app exported from `app.ts`, listened in `server.ts`/`bin/www`).

## Config & env
`.env` via `dotenv`/`process.env` (`PORT`, `DATABASE_URL`, `JWT_SECRET`); config centralized in `config/`, `src/config.ts`, or `env.ts` (often Zod-validated). Build: `tsconfig.json`, `tsup`/`esbuild`/`tsc`; check `scripts` for `build`, `migrate`, `seed`.

## Gotchas
- **Mount prefixes are the #1 miss** — a route reading `'/'` may be `GET /api/v1/users` after two mounts; always trace `app.use`/`register`/`app.route` chains.
- Middleware/plugin **order matters**: auth or `app.use` registered after a route doesn't protect it; error handlers are `(err,req,res,next)` (Express, 4 args) or `app.onError`/`fastify.setErrorHandler`.
- Routes are often dynamically registered in loops/`forEach` or via autoload — static grep misses them; check `routes/` directory conventions.
- Fastify `prefix` is set at `register`, not on the route — the `url` is relative.
- Koa needs `@koa/router`/`koa-router`; vanilla Koa has no router. Hono `app.route` second arg is the sub-app, not a handler.
- Same path with different methods = separate rows; `app.all`/`router.all` covers every method.

> tip: Reconstruct the full URL by walking the mount/register/route tree from the entry file outward — the literal string on each handler is almost never the real endpoint.
