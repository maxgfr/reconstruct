# Laravel (PHP)

**When:** `composer.json` requires `laravel/framework`; `artisan` at root; `app/`, `routes/web.php`, `routes/api.php`, `config/`, `database/migrations/`, `public/index.php` present.

## Where the interface surface lives
- **Route files:** `routes/web.php` (session/cookie auth, Blade), `routes/api.php` (stateless, auto-prefixed `/api`, `api` middleware group), plus `routes/console.php` (CLI) and `routes/channels.php` (broadcast). Laravel 11+ replaces `app/Http/Kernel.php` with `bootstrap/app.php` — check `->withRouting()` for custom route files/prefixes.
- **Declarations:** `Route::get/post/put/patch/delete/match/any('/path', [Ctrl::class,'method'])`; `Route::apiResource('posts', PostController::class)` expands to 5 rows (index GET, store POST, show GET `{post}`, update PUT/PATCH, destroy DELETE); `Route::resource` adds `create`/`edit` GET rows (7 total). `Route::controller(X::class)->group(...)` shares a controller.
- **Full path:** concatenate nested `Route::group(['prefix'=>'v1'], ...)` / `Route::prefix('admin')->group(...)`. api.php paths get an implicit `/api` (configurable in `withRouting`/`RouteServiceProvider`). `{id}`, `{post:slug}` (route-model binding by column), `{name?}` (optional) are dynamic segments.
- **Auth column:** read `->middleware('auth')`, `auth:sanctum`, `auth:api`, `verified`, `can:`, `throttle:`, custom middleware aliases (in `bootstrap/app.php` `withMiddleware` or `Kernel::$middlewareAliases`). Group middleware applies to every contained route.
- **Handlers:** `app/Http/Controllers/*Controller.php`. Single-action controllers use `__invoke`. Map `Route::name('posts.index')` for named routes. Closures count as inline handlers.
- **Validation/auth rules** often live in Form Requests: `app/Http/Requests/*` (`rules()`, `authorize()`) — note these as the request contract for the endpoint.
- **Jobs/CLI/Events:** queued jobs in `app/Jobs/*` (`handle()`); Artisan commands in `app/Console/Commands/*` (`$signature` = command name, `handle()`); schedule in `routes/console.php` or `Console/Kernel::schedule()`; broadcast routes in `channels.php`. GraphQL only via Lighthouse (`graphql/*.graphql` schema, `@field`/resolver directives).

## Data model
- **ORM = Eloquent.** Entities in `app/Models/*.php` (older apps: `app/*.php`). One class ≈ one table (snake_case plural; override via `protected $table`).
- **Fields/types:** the source of truth is `database/migrations/*_create_*.php` — `Schema::create('posts', fn(Blueprint $t) => ...)` with `$t->string/integer/bigInteger/text/boolean/json/foreignId/timestamp(...)`, `->nullable()`, `->default()`, `->unique()`, `->index()`. Read migrations in filename-timestamp order; later `Schema::table` migrations alter columns. `$t->foreignId('user_id')->constrained()` = FK + index.
- **Relations (on model methods):** `hasOne`, `hasMany`, `belongsTo`, `belongsToMany('role', 'role_user'pivot)`, `hasManyThrough`, `morphMany`/`morphTo` (polymorphic). FK convention `<singular>_id`.
- **Casts/guards:** `$fillable`/`$guarded`, `$casts` (e.g. `'meta'=>'array'`, enum casts), `$hidden`. Soft deletes = `use SoftDeletes` + `deleted_at`.
- Seed/factory data in `database/seeders/`, `database/factories/`. `php artisan migrate:status` not needed — read files statically.

## Entry points & boot
- HTTP entry: `public/index.php` → `bootstrap/app.php`. CLI entry: `artisan`. Laravel 11+: `bootstrap/app.php` (`Application::configure()->withRouting()->withMiddleware()->withProviders()`). Laravel ≤10: `app/Http/Kernel.php`, `app/Console/Kernel.php`, `app/Providers/*ServiceProvider.php` (esp. `RouteServiceProvider` for prefixes/binding).

## Config & env
- `config/*.php` (`app`, `database`, `auth`, `queue`, `services`); values pulled from `.env` via `env()`. `.env.example` lists vars. `composer.json` scripts; `php artisan serve`, `migrate`, `queue:work`, `route:list` (route:list is the ground-truth dump if runnable). Frontend build via `vite.config.js`/`package.json`.

## Gotchas
- `api.php` routes are silently `/api`-prefixed and named-route prefixed `api.` — don't emit paths without it.
- `apiResource`/`resource` expand to multiple endpoints; enumerate each, and subtract `->only([...])`/`->except([...])`.
- Migrations, not models, hold column types — models often have zero schema info; many `$t->...` columns are never mentioned in the model.
- Group middleware/prefix nest cumulatively; a route's real auth is the union of group + route middleware.
- `php artisan tinker`/packages can register routes you won't see in `routes/*` (e.g. Sanctum, Telescope, Horizon, Fortify, Passport auto-register endpoints via service providers/`Route::macro`).
- Route-model binding `{post:slug}` changes the lookup key, not the URL param meaning; polymorphic relations span multiple tables via `*_type`/`*_id` columns.

> tip: Cross-reference `routes/*.php` (paths + middleware) against `app/Http/Controllers` (handlers) and `database/migrations` (real column types) — never trust the model file alone for the schema.
