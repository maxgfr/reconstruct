# .NET / ASP.NET Core

**When:** `inventory.stack.frameworks` lists `ASP.NET Core` — detected from a `*.csproj` with the
`Microsoft.NET.Sdk.Web` SDK, or a `Program.cs` calling `WebApplication.CreateBuilder`. Look for
`*.sln`, `appsettings.json`, `Controllers/`.

**Routes are resolved deterministically** for both paradigms: Minimal APIs (with `MapGroup`
prefixes composed transitively) and attribute-routed controllers (with the `[controller]` token
expanded from the class name). Verify them against source as always, and note the two things the
adapter deliberately does **not** resolve — see Gotchas.

Since .NET 6, `Program.cs` is usually top-level statements with a `WebApplicationBuilder`. Older
projects (and many enterprise ones) still have `Startup.cs` with `ConfigureServices` +
`Configure`.

## Where the interface surface lives

Two coexisting paradigms — check for **both**:

- **Minimal APIs** — `app.MapGet("/todos/{id}", handler)`, `MapPost`, `MapPut`, `MapDelete`,
  `MapGroup("/api/v1")`. Route = group prefix + template. `MapGroup` chains compose, so follow
  them transitively. Filters (`AddEndpointFilter`) and `RequireAuthorization()` hang off the
  endpoint or the group — that is the auth rule.
- **Controllers** — `[ApiController]` classes with `[Route("api/[controller]")]` +
  `[HttpGet("{id}")]`. Path = controller route template + action template.
  - `[controller]` expands to the class name minus the `Controller` suffix
    (`TodosController` → `todos`). `[action]` and `[area]` expand similarly.
  - Attribute routing (`[Route]`) and conventional routing (`MapControllerRoute` with
    `{controller}/{action}/{id?}`) can coexist — with conventional routing there is no per-action
    template, so enumerate the actions and derive the URLs from the pattern.
  - MVC (server-rendered) actions returning `View()` are page routes; `ControllerBase` +
    `ActionResult<T>` are API routes.
- **Auth rules** — `[Authorize]` / `[Authorize(Roles = "Admin")]` /
  `[Authorize(Policy = "CanEdit")]` / `[AllowAnonymous]` on the class **or** the action (action
  wins). Policies are *defined* in `AddAuthorization(o => o.AddPolicy(...))` — read the
  definition, not just the policy name, and put the real rule in the Auth column.
- **Model binding & validation** — the request DTO's shape is the input contract:
  `[FromBody]`/`[FromQuery]`/`[FromRoute]`/`[FromForm]`, DataAnnotations (`[Required]`,
  `[StringLength(80)]`, `[Range]`, `[RegularExpression]`), or FluentValidation validators.
  `[ApiController]` makes validation failures return an automatic **400 ProblemDetails** — that
  is real, documented behaviour a rebuild must reproduce.
- **Other surfaces**: SignalR hubs (`Hub` subclasses — each public method is an operation, plus
  the server→client callbacks), gRPC services (`.proto` + generated base classes), background
  jobs (`IHostedService` / `BackgroundService`, Hangfire, Quartz), and health checks
  (`MapHealthChecks`).
- **Middleware order is behaviour.** The `app.UseX()` sequence in `Program.cs` decides what runs
  before what (`UseRouting` → `UseAuthentication` → `UseAuthorization` → endpoints). Record the
  order in `ARCHITECTURE.md`; getting it wrong silently disables auth.

## Data model

Almost always **Entity Framework Core**:

- `DbContext` subclass: each `DbSet<T>` is a table. Entity classes give fields and CLR types.
- `OnModelCreating` fluent config and `IEntityTypeConfiguration<T>` classes carry the real
  constraints: `.IsRequired()`, `.HasMaxLength(n)`, `.HasIndex(...).IsUnique()`,
  `.HasForeignKey(...)`, `.OnDelete(DeleteBehavior.Cascade|Restrict|SetNull)`, `.HasDefaultValue`.
  **`OnDelete` behaviour is part of the contract** — capture it per FK.
- Data annotations on entities (`[Key]`, `[Required]`, `[MaxLength]`, `[Column(TypeName=...)]`)
  do the same job; a project may use either or both.
- **`Migrations/`** is the authority on the actual schema — the model snapshot
  (`*ModelSnapshot.cs`) is the current shape. Copy types verbatim from there when the fluent
  config is ambiguous.
- Nullability: with `<Nullable>enable</Nullable>`, a non-nullable reference type property is
  **NOT NULL**. That is how EF infers requiredness — do not read `string` as optional.
- Enums: C# `enum` types. Note whether they persist as int (default) or string
  (`.HasConversion<string>()`) — it changes the column type and the stored values.
- Alternatives to note if present: Dapper (raw SQL — read the queries), or a `*.sql` DDL folder.

## Entry points & boot

- `Program.cs` — `WebApplication.CreateBuilder(args)`, the `builder.Services.Add*` DI
  registrations, then the middleware pipeline and endpoint mapping. Service lifetimes
  (`AddSingleton` / `AddScoped` / `AddTransient`) are architectural facts worth recording.
- `Startup.cs` in older apps: `ConfigureServices` (DI) + `Configure` (pipeline).
- `*.csproj` — `TargetFramework`, `<Nullable>`, `<ImplicitUsings>`, and every `PackageReference`
  (this is your real dependency list; `inventory.dependencies` will not parse it).
- `*.sln` — in a multi-project solution each `*.csproj` is effectively a workspace: treat it like
  a monorepo member ([monorepo.md](./monorepo.md)) and map the project references as the
  dependency graph.

## Config & env

- `appsettings.json` + `appsettings.{Environment}.json`, overridden by environment variables
  (`Section__Key` double-underscore convention) and user-secrets in development. **Record the
  precedence order** — it is a contract.
- `IOptions<T>` / `builder.Services.Configure<T>(...)` binds a config section to a typed class:
  that class *is* the schema for that section.
- Connection strings live under `ConnectionStrings:*`. Names only in the PRD — never values.
- `ASPNETCORE_ENVIRONMENT` selects the overlay and usually gates dev-only middleware
  (developer exception page, Swagger UI).
- Localization: `IStringLocalizer` + `Resources/*.resx`, `RequestLocalizationOptions` (supported
  cultures + the culture-resolution order). The `.resx` files are the message catalog.

## Gotchas

- **Two things the route adapter does not resolve**, by design — fill them in by hand:
  **conventional routing** (`MapControllerRoute` with a `{controller}/{action}/{id?}` pattern:
  there is no per-action template to read, so enumerate the actions and derive the URLs from the
  pattern), and a controller with **no `[Route]` attribute** (conventionally routed — a guessed
  path would be worse than none). `[action]` tokens are likewise left unexpanded.
- **`[ApiController]` changes behaviour implicitly**: automatic 400 on invalid model state,
  inferred binding sources, and ProblemDetails error shape. A rebuild without the attribute
  behaves differently for every invalid request.
- **Action-level attributes beat controller-level ones** — an `[AllowAnonymous]` action inside an
  `[Authorize]` controller is public.
- **Middleware order silently changes auth.** `UseAuthorization` before `UseAuthentication`
  means no identity is present.
- **`OnDelete` defaults differ** by relationship requiredness — do not assume Cascade; read the
  snapshot.
- **`async` all the way**: an endpoint returning `Task<ActionResult<T>>` is normal; the async-ness
  is not a behavioural contract, but `CancellationToken` handling can be.
- **Swagger/OpenAPI** (`AddSwaggerGen`, or the .NET 9 `AddOpenApi`) may already document the
  surface — if `swagger.json` is generated or committed, it is the fastest accurate source for
  `INTERFACES.md`. Verify it against the code; a stale spec is worse than none.
- Blazor projects are a different shape entirely: `@page "/route"` directives in `.razor` files
  are the routes, and Blazor Server keeps a stateful SignalR circuit per user.

> tip: check for **both** Minimal APIs and controllers before concluding the surface is complete,
> compose `MapGroup`/`[Route]` prefixes transitively, and take the schema from
> `Migrations/*ModelSnapshot.cs` — the fluent config alone hides `OnDelete` and nullability.
