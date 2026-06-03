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
- `RouteInfo` = `{ route: string; file: string; kind: "page" | "api" | "layout" | "component" }`.
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

## Add an adapter — worked example (Django, a good first PR)

Django routes live in `urls.py` as `path("articles/", views.index)` /
`re_path(...)` entries, often nested with `include("blog.urls")`.

1. **Detection already exists.** `src/detect/stack.ts` labels a repo `"Django"`
   from `requirements.txt` / `pyproject.toml`. If your framework is *not* yet
   detected, add its signal there first (a one-liner in the matcher table).

2. **Create `src/adapters/django.ts`:**

   ```ts
   import type { FileInfo, RouteInfo } from "../types.js";
   import type { RouteAdapter } from "./types.js";
   import { joinRoute, readSources } from "./util.js";

   const PATH_RE = /\b(?:path|re_path)\(\s*["'`]([^"'`]*)["'`]/g;

   export const djangoAdapter: RouteAdapter = {
     id: "django",
     frameworks: ["Django"],
     detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
       const routes: RouteInfo[] = [];
       for (const [path, src] of readSources(files, repo, [".py"])) {
         if (!path.endsWith("urls.py")) continue;
         for (const m of src.matchAll(PATH_RE)) {
           routes.push({ route: joinRoute(m[1] as string), file: path, kind: "page" });
         }
       }
       return routes;
       // Stretch goal: resolve include("app.urls", prefix) mounts across files,
       // the way the flask/express adapters resolve blueprint/router prefixes.
     },
   };
   ```

3. **Register it** in `src/adapters/registry.ts`: add `djangoAdapter` to
   `ROUTE_ADAPTERS`.

4. **Add a fixture + test.** Drop a minimal `tests/fixtures/django-app/` (a
   `requirements.txt` with `django`, a `urls.py`) and a `describe("django
   adapter", …)` block in `tests/adapters.test.ts` asserting the resolved routes.
   Write the test first (red), then make it pass (green).

5. **Rebuild the bundle:** `npm run build` (regenerates `scripts/analyze.mjs`),
   then `npm test && npm run check:build`.

That's the whole PR. The deterministic scaffold stays universal; the adapter just
upgrades one framework's routes from *candidates* to *resolved*.

## Design notes

- **Be honest, not heroic.** If a mount/prefix can't be resolved deterministically
  (dynamic registration, runtime config), emit the local path + handler file and
  let the candidate/agent layer fill the rest. A wrong route is worse than a
  partial one.
- **No method dimension.** `RouteInfo` has no HTTP method, so `GET`/`POST` on the
  same path collapse to one route (the registry de-dupes). Method-level contracts
  are the agent's job in `INTERFACES.md`.
- **`kind`:** API frameworks emit `"api"`; server-rendered routes emit `"page"`
  (e.g. Flask handlers that `render_template`).
