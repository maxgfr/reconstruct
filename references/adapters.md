# Route adapters — extracting a deterministic interface surface

The analyzer's deterministic core is framework-agnostic: it walks the repo,
detects the stack, and surfaces **candidates** (`hints.routeCandidates` /
`apiCandidates`) for the agent to enumerate. On top of that, a **route adapter**
turns one framework's routing convention into the *resolved* interface surface —
`inventory.routes` — so the agent starts from real paths, not guesses.

Adapters are a **plugin point**. Adding a framework is a small, self-contained
PR: one new file under `src/adapters/`, one line in the registry, one fixture +
test. No core file changes.

## The contract

`src/adapters/types.ts`:

```ts
export interface RouteAdapter {
  id: string;            // stable id, e.g. "flask"
  frameworks: string[];  // labels in stack.frameworks this adapter handles, e.g. ["Flask"]
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[];
}
```

- The registry (`src/adapters/registry.ts`) only calls `detectRoutes` when one of
  `frameworks` is in the detected stack, so an adapter never re-checks the
  framework itself.
- `files` is the walked file list (paths + metadata); `repo` is the absolute root
  so you can read source for decorator-/convention-based frameworks. Read with the
  shared `readSources(files, repo, exts)` helper in `src/adapters/util.ts`.
- Return routes **in any order** — the registry merges, de-dupes, and sorts.
- `RouteInfo` = `{ route: string; file: string; kind: "page" | "api" | "layout" | "component"; method?: string }`.
  Use `joinRoute(...segments)` (from `util.ts`) to compose and normalize paths.

## How dispatch works

```
analyze() → detectStack() → detectRoutes(files, stack, repo)   // src/adapters/registry.ts
                              └─ for each adapter whose framework is active:
                                   merge adapter.detectRoutes(files, repo)
                              └─ de-dupe (kind+route+file) + sort
```

A repo can activate **several** adapters at once (e.g. a Next.js frontend over an
Express API) — their routes merge.

## Shipped adapters

| id        | frameworks   | resolution highlights |
|-----------|--------------|-----------------------|
| `nextjs`  | Next.js      | file-based: `app/` (`page`/`route`/`layout`) + `pages/` (incl. `pages/api/*`); strips route groups/slots |
| `flask`   | Flask        | `@app.route` + method shortcuts; `Blueprint` routes resolved through their registered `url_prefix` across modules |
| `fastapi` | FastAPI      | `@app.<method>` + `APIRouter`: `include_router(prefix) + APIRouter(prefix) + path` across modules |
| `nestjs`  | NestJS       | `@Controller(base)` + method decorators `@Get(sub)` → `/base/sub` |
| `express` | Express      | `app.<method>` absolute; `router.<method>` prefixed by the cross-file `app.use("/mount", router)` |
| `fastify` | Fastify      | `app.<method>` + `route({ method, url })`; plugin routes prefixed by the cross-file `register(plugin, { prefix })`, composed transitively |
| `django`  | Django       | `urls.py` `path`/`re_path` (regex anchors stripped); `include("app.urls")` mounts resolved across modules |
| `rails`   | Ruby on Rails| `config/routes.rb` verb routes + `root`; `resources` RESTful expansion (`only:`/`except:`); `namespace`/`scope` prefixes via `do`/`end` nesting |
| `go`      | Gin, Echo, chi, Fiber | `<router>.GET("/x")` (both `GET`/`Get` casings) prefixed by `<child> := <parent>.Group("/p")` chains, resolved transitively |

## Add an adapter — worked example (Sinatra, a good first PR)

The `django`, `rails`, and `go` adapters are now shipped — read
`src/adapters/{django,rails,go}.ts` for fuller examples (cross-file `include`
resolution, `resources` expansion, transitive `Group` prefixes). For the *shape*
of a minimal PR, here's an unshipped framework with trivial routing: **Sinatra**,
whose routes are `get "/x" do … end` blocks in a Ruby file.

1. **Detection already exists.** `src/detect/stack.ts` labels a repo `"Sinatra"`
   from a `Gemfile`. If your framework is *not* yet detected, add its signal there
   first — exactly as the `go` adapter added a `GO_FRAMEWORKS` table matching
   `github.com/gin-gonic/gin` etc. from `go.mod`.

2. **Create `src/adapters/sinatra.ts`:**

   ```ts
   import type { FileInfo, RouteInfo } from "../types.js";
   import type { RouteAdapter } from "./types.js";
   import { joinRoute, readSources } from "./util.js";

   const ROUTE_RE = /\b(?:get|post|put|patch|delete)\s+["']([^"']*)["']\s+do\b/g;

   export const sinatraAdapter: RouteAdapter = {
     id: "sinatra",
     frameworks: ["Sinatra"],
     detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
       const routes: RouteInfo[] = [];
       for (const [path, src] of readSources(files, repo, [".rb"])) {
         for (const m of src.matchAll(ROUTE_RE)) {
           routes.push({ route: joinRoute(m[1] as string), file: path, kind: "page" });
         }
       }
       return routes;
       // Stretch goal: resolve `Sinatra::Base` subclasses mounted under a prefix
       // (`map("/admin") { run Admin }`), the way django/rails resolve mounts.
     },
   };
   ```

3. **Register it** in `src/adapters/registry.ts`: add `sinatraAdapter` to
   `ROUTE_ADAPTERS`.

4. **Add a fixture + test.** Drop a minimal `tests/fixtures/sinatra-app/` (a
   `Gemfile` with `sinatra`, an `app.rb`) and a `describe("sinatra adapter", …)`
   block in `tests/adapters.test.ts` asserting the resolved routes. Write the test
   first (red), then make it pass (green).

5. **Rebuild the bundle:** `pnpm build` (regenerates `scripts/analyze.mjs`),
   then `pnpm test && pnpm run check:build`.

That's the whole PR. The deterministic scaffold stays universal; the adapter just
upgrades one framework's routes from *candidates* to *resolved*.

## Design notes

- **Be honest, not heroic.** If a mount/prefix can't be resolved deterministically
  (dynamic registration, runtime config), emit the local path + handler file and
  let the candidate/agent layer fill the rest. A wrong route is worse than a
  partial one.
- **Method is part of the identity.** Set `RouteInfo.method` when the framework
  declares a verb (`GET`, `POST`, … — `*` for any/all): the registry de-dupes on
  method+kind+route+file, so `GET /items` and `POST /items` survive as two
  operations. Omit `method` for verb-agnostic routing (file-based pages,
  view-dispatched URLs); the full I/O contract stays the agent's job in
  `INTERFACES.md`.
- **`kind`:** API frameworks emit `"api"`; server-rendered routes emit `"page"`
  (e.g. Flask handlers that `render_template`).
