# NestJS Reconstruction Cheat-Sheet

**When:** `inventory.stack` includes `@nestjs/core`/`@nestjs/common` in package.json; presence of `main.ts` with `NestFactory.create`, `*.module.ts`, `*.controller.ts`, `*.service.ts`, decorators `@Module`/`@Controller`/`@Injectable`. GraphQL if `@nestjs/graphql`; microservices if `@nestjs/microservices`; jobs if `@nestjs/schedule`.

## Where the interface surface lives
- **REST**: `*.controller.ts`. Class `@Controller('base')` sets the base path; method decorators `@Get/@Post/@Put/@Patch/@Delete/@Head/@Options('subpath')` set verb + sub-path. **Full path = globalPrefix + controller base + method path**. Dynamic segments use `:id` (Express) — keep as-is in INTERFACES.md.
  - **globalPrefix**: search `setGlobalPrefix(` in `main.ts`. Versioning via `enableVersioning()` + `@Version('1')` → path prefix `/v1`.
  - Empty `@Get()` = the controller base path itself. `@Controller()` with no arg = root-mounted.
  - **Auth** per row: `@UseGuards(JwtAuthGuard)` / `AuthGuard('jwt')` on class or method; class-level applies to all methods. `@Public()`/`@SetMetadata('isPublic', true)` marks unauthenticated. Look for a global guard registered as `APP_GUARD` provider in a module (auth-by-default).
  - Params: `@Param`, `@Query`, `@Body(dto)` — the DTO class names the request schema. Response via `@HttpCode`, `@Header`, `@Redirect`.
- **GraphQL** (`@nestjs/graphql`): `*.resolver.ts`. `@Resolver(() => Entity)` + `@Query()`/`@Mutation()`/`@Subscription()` methods; `@ResolveField()` for nested fields. Operation name = method name (or decorator arg). Code-first builds `schema.gql`; schema-first reads `*.graphql` (`typePaths`). One INTERFACES row per Query/Mutation/Subscription.
- **Microservices/RPC**: `@MessagePattern('cmd')` (request-response) and `@EventPattern('event')` (fire-and-forget) in controllers; transport (TCP/Redis/Kafka/NATS/RMQ/gRPC) set in `main.ts` `createMicroservice`. For gRPC use `@GrpcMethod('Service','Method')`.
- **WebSockets**: `@WebSocketGateway()` + `@SubscribeMessage('event')`.
- **Jobs** (`@nestjs/schedule`): `@Cron('* * * * *')`, `@Interval(ms)`, `@Timeout(ms)` on provider methods. `@nestjs/bull`/`bullmq`: `@Processor('queue')` + `@Process('job')`. List each as a job row (trigger · handler file).

## Data model
- **TypeORM**: `*.entity.ts` with `@Entity('table')`. Columns: `@PrimaryGeneratedColumn`, `@PrimaryColumn`, `@Column({ type, nullable, default, unique })`, `@CreateDateColumn`/`@UpdateDateColumn`/`@DeleteDateColumn`. Relations: `@OneToOne`/`@OneToMany`/`@ManyToOne`/`@ManyToMany` (+ `@JoinColumn`/`@JoinTable`). Indexes: `@Index([...])` on class/column, `unique: true`. Migrations under `migration/` or `src/migrations`. DataSource/config in `ormconfig.*`, `data-source.ts`, or `TypeOrmModule.forRoot`.
- **Prisma** (`@nestjs/`+`@prisma/client`): single source of truth is `prisma/schema.prisma` — `model X { fields, @id, @unique, @relation, @@index, @@map }`. SQL in `prisma/migrations/`. Read schema.prisma directly, NOT TS.
- **Mongoose** (`@nestjs/mongoose`): `*.schema.ts`, `@Schema()` class + `@Prop()` fields; relations via `@Prop({ type: Types.ObjectId, ref: 'Other' })`. Registered with `MongooseModule.forFeature`.
- **Sequelize** (`@nestjs/sequelize`): `@Table` + `@Column`, `@ForeignKey`/`@BelongsTo`/`@HasMany`.

## Entry points & boot
- `src/main.ts` → `bootstrap()` calling `NestFactory.create(AppModule)` then `app.listen(port)`. Read it for: `setGlobalPrefix`, `enableVersioning`, `useGlobalPipes/Guards/Interceptors/Filters`, CORS, Swagger (`SwaggerModule.setup('docs', …)`), and `createMicroservice`.
- `src/app.module.ts` (`@Module`) is the composition root; follow `imports: []` to feature modules. Each feature module's `controllers`/`providers` arrays enumerate the actual route+service surface. `@Global()` modules export shared providers.

## Config & env
- `@nestjs/config` `ConfigModule.forRoot()` reads `.env`/`.env.*`; access via `ConfigService.get('KEY')`. Validation schema (Joi/class-validator) lists expected env vars.
- `package.json` scripts: `start`, `start:dev` (`nest start --watch`), `start:prod` (`node dist/main`), `build` (`nest build`). `nest-cli.json` sets `sourceRoot`, monorepo `projects`. TS config `tsconfig.json`; emit dir usually `dist/`.

## Gotchas
- A route exists only if its controller is in some module's `controllers` array AND that module is imported (transitively) by `AppModule` — orphan controllers don't mount; verify the import chain.
- The real path needs THREE pieces stitched: global prefix + controller base + method path (+ version) — analyzer hints often give only the method decorator arg.
- Global `APP_GUARD`/`APP_INTERCEPTOR`/`APP_PIPE`/`APP_FILTER` providers apply auth/validation to every route invisibly; check for them before marking endpoints as unauthenticated.
- `RouterModule.register([{ path, module }])` and dynamic modules (`forRoot`/`forFeature`/`forRootAsync`) add prefixes/wire entities outside the controller file.
- DTO validation (`class-validator` decorators) lives in `*.dto.ts`, not the entity — that's the real request schema, distinct from the DB model.
- Code-first GraphQL has NO `.graphql` file in repo (generated at runtime); read `@ObjectType`/`@Field`/`@InputType` classes instead. Mongoose/Prisma models won't appear as TypeORM `@Entity` — detect the ORM first.

> tip: Resolve every endpoint's full path by combining `setGlobalPrefix` + class `@Controller` base + method route, and confirm each controller is reachable through the `AppModule` import graph — a decorator alone does not prove a live route.
