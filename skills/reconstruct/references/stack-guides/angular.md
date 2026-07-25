# Angular (standalone + NgModule)

**When:** `inventory.stack.frameworks` lists `Angular` (`@angular/core` in package.json). Look
for `angular.json`, `src/main.ts`, `*.component.ts`, `*.routes.ts` or `*-routing.module.ts`.
Angular ≥ 15 favours **standalone** components; older apps use **NgModules**. Many repos mix
both. The engine has no Angular route adapter — build the surface by hand from the route
config.

## Where the interface surface lives

Angular is a client framework: the "interface surface" is **routes + the HTTP calls the app
makes**, and they live in different places.

- **Routes** — a `Routes` array, in `app.routes.ts` (standalone) or `RouterModule.forRoot/
  forChild` (NgModule). Each entry: `path` · `component` | `loadComponent` | `loadChildren` ·
  `canActivate`/`canMatch` · `resolve` · `data` · `children`.
  - Full URL = parent `path` + child `path`s. `loadChildren` mounts a lazy route file — follow
    it and compose the prefix, exactly like a router mount.
  - `path: ''` with `pathMatch: 'full'` is the index; `path: '**'` is the catch-all.
  - `:param` segments are dynamic; matrix params (`;k=v`) and query params are **not** in the
    path — note them per route.
  - `redirectTo` entries are routes too — list them so the rebuild reproduces the redirect.
- **Auth rules** — `canActivate` / `canActivateChild` / `canMatch` guards (functional
  `CanActivateFn` in modern code, class guards in older). The guard *is* the auth rule for that
  route: read it and put the real rule in the `INTERFACES.md` Auth column, not the guard's name.
- **Resolvers** — `resolve: { x: XResolver }` fetches before activation. That is a data
  dependency of the route: record what it loads and what happens when it fails.
- **The backend surface** — Angular apps talk to an API via `HttpClient`. Grep for `http.get`/
  `post`/`put`/`patch`/`delete` in `*.service.ts`. Each call is a row: method · URL (compose the
  base URL from the environment file or an `APP_INITIALIZER`) · request body type · response
  type. If the API lives in the same repo, reconcile these against **its** guide; if not, they
  are external-service rows in `ARCHITECTURE.md`.
- **Interceptors** — `HTTP_INTERCEPTORS` / `withInterceptors(...)` add auth headers, retries and
  error mapping to *every* call. Cross-cutting: document once in `ARCHITECTURE.md`, then note
  which operations rely on them.
- **Forms** — reactive forms (`FormGroup` + `Validators`) carry the real validation rules
  (`Validators.required`, `minLength(n)`, custom validators). Those are your format validations:
  copy the actual bounds.

## Data model

No ORM — the model is the **TypeScript interfaces/DTOs** the services exchange, plus client
state.

- Model interfaces (often `src/app/models/` or `*.model.ts`): every field, exact type,
  optionality. Copy them verbatim.
- Enums and string-literal unions with their **complete** member lists.
- State management: NgRx (`createReducer`/`createEffect`/selectors), NGXS, Akita, or plain
  `BehaviorSubject` services. Record the **state shape** and the actions/effects that mutate it —
  for an Angular app that is the closest thing to a data model.
- Persistence: `localStorage`/`sessionStorage`/IndexedDB keys and their serialized shapes.

## Entry points & boot

- `src/main.ts` — `bootstrapApplication(AppComponent, { providers: [...] })` (standalone) or
  `platformBrowserDynamic().bootstrapModule(AppModule)` (NgModule).
- `app.config.ts` / `AppModule` providers: the DI wiring. `APP_INITIALIZER` runs **before** the
  app renders (config fetch, auth restore) — that is boot-order behaviour a rebuild must
  reproduce.
- `angular.json` — build targets, per-configuration `fileReplacements` (how `environment.ts`
  becomes `environment.prod.ts`), assets, style entry points, budgets.
- SSR: `@angular/ssr` / Angular Universal adds `server.ts` and real HTTP routes — if present,
  those are server routes and belong in `INTERFACES.md` alongside the client routes.

## Config & env

- `src/environments/environment*.ts` — **not** real env vars: they are compile-time constants
  swapped by `fileReplacements`. Record every key, both values, and which build config selects
  which. This trips up rebuilds that expect `process.env`.
- `angular.json` budgets (bundle-size limits) are a CI-enforced policy — a quantified
  cross-cutting policy.
- i18n: `@angular/localize` (`i18n` attributes + `messages.xlf`) or `@ngx-translate` (JSON
  catalogs). The catalogs are copied to `data/translations/` verbatim.

## Gotchas

- **DI is the architecture.** A service's behaviour depends on which provider is registered and
  at what level (`providedIn: 'root'` vs component-level). Component-level providers create a
  *new instance per component* — a real behavioural difference.
- **Standalone vs NgModule changes where things are declared** but not the URL map — build the
  route table from the `Routes` arrays either way.
- **`loadChildren` hides whole route subtrees.** A route table built from the root file alone is
  incomplete; follow every lazy import.
- **Guards run in order and can redirect.** `canMatch` can make the *same* path resolve to
  different components — note it, or the rebuild picks one arbitrarily.
- **Zone.js vs signals / `OnPush`** affect when the UI updates. Note the change-detection
  strategy; a rebuild that gets it wrong looks broken in ways no acceptance criterion catches.
- **`environment.ts` values are baked into the bundle** — anything in there is public. Do not
  document a secret as if it were server-side.
- Angular Material / CDK usage feeds `DESIGN-SYSTEM.md`: theme palettes (`define-palette`,
  density, typography config) are your design tokens — capture the **exact values**.

> tip: the route table is a *tree* — compose parent paths, follow every `loadChildren`, and read
> each guard for the real auth rule. Then remember the second half of the surface: every
> `HttpClient` call in the services is an operation too, and `environment.ts` (not `process.env`)
> is where its base URL comes from.
