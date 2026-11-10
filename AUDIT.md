# Code audit — reconstruct (2026-11-10, from v2.29.7)

## Summary

1. The codebase is in good shape overall. It is a TypeScript engine (`src/`) bundled into a committed, dependency-free `scripts/analyze.mjs`. It is strictly typed, uses no `any`-driven shortcuts in its core paths, and its CI is reproducible: bundle diff, Node 18 floor job, golden example and parity.
2. The baseline was fully green before any change: typecheck, Biome, 899 tests in 57 files, `check:build`, `verify:example`, parity and the demo. The full gate took 11.4 s.
3. Most real defects sat in two places:
   - **Regex-based adapters:** routes missed or given the wrong prefix in tRPC, Django, Rails and ASP.NET, plus go.mod and requirements.txt parsing.
   - **Fail-closed edges of the gates:** malformed ledgers crashed instead of failing, review could not commit a zero-feature round, and the heading checks disagreed with each other.
4. Several scans were **quadratic**: Python import aliases, Flask kind detection, Django REST detection, and rea's stdio framing. Pathological but realistic inputs took seconds to minutes; they are now linear.
5. The main remaining risks are in the MCP server's write and read boundaries and in stale artifacts left between runs. These were not changed because they are behavior and policy decisions; see "Open questions".

All work is in 30 small commits on `main` (21 `fix`, 6 `perf`, 2 cleanups, plus this report). The suite grew from 899 to 959 tests. Every commit is signed and carries the rebuilt bundle.

## Bugs fixed

| # | Area / file | Problem | Fix | Test |
|---|---|---|---|---|
| 1 | `src/cli.ts` | `--out` equal to the repo root: the next run ingested its own output and nested it one level deeper each time, and overwrote the repo's `SUMMARY.md`/`REBUILD.md`. | Fails with a clear error on the analysing path. ⚠️ user-facing (see below) | `tests/cli-args-validation.test.ts` |
| 2 | `src/cli.ts` | `--out=` / `--apply=` (empty inline value) silently meant cwd / "no findings file", exit 0. | Treated like a missing value. ⚠️ user-facing | same |
| 3 | `src/cli.ts` | `--port abc` reached the server as `NaN`, and fractional byte limits were accepted. | Same positive-integer check as `--max-verify`; `--port` is checked against 0–65535. | same |
| 4 | `src/cli.ts` | `--include 'src/**/*.{ts,tsx}'` was split on its inner comma, and the gitignore matcher has no brace syntax, so 0 files were analysed silently. | Top-level comma split plus `{a,b}` expansion (documented in DOCUMENTATION.md). | same |
| 5 | `src/output.ts` | The mirror copy swallowed every error (ENOSPC/EACCES/EISDIR), so an incomplete `source/` sat behind a success summary. | Only ENOENT is skipped; other failures surface as a `mirror:` warning (CLI) or a `warning` field (MCP scaffold). | `tests/output-copy-failures.test.ts` |
| 6 | `src/rea.ts` | `lib/x.so` and `lib_x.so` produced the same evidence file, so one overwrote the other while INDEX.json listed both. | Stable hash suffix, applied only on collision. | `tests/rea-slugs.test.ts` |
| 7 | `src/unknowns.ts` | `--unknowns --apply` was not really fail-closed: a non-array citation list was silently replaced, the seed ledger was written before validation, a null row crashed the formatter, and the id sort compared `NaN`. | Validate first, write once; malformed rows are errors. | `tests/unknowns.test.ts` |
| 8 | `src/prd/templates.ts` | Module diagram edges used indices of the *filtered* list, so they pointed at the wrong features. A `"` in a name broke the mermaid label. | Full-list indices; labels escaped. | `tests/templates-rendering.test.ts` |
| 9 | `src/prd/templates.ts` | `/:lang(en\|fr)` broke the route tables in INTERFACES.md and the feature PRDs. | Cells go through `cell()`. | same |
| 10 | `src/check.ts`, `src/verify.ts` | `## Acceptance criteria (Given/When/Then)` was reported as empty: the presence check used a substring, the content check needed an exact line. `--verify` ignored requirements under such headings. | One `isSectionHeading()` predicate used by all three. | `tests/check.test.ts`, `tests/verify.test.ts` |
| 11 | `src/review.ts` | On a tree with no feature PRDs, `--review --apply` always failed as "stale", because the arch hash was taken from `units[0]`. | `REVIEW.todo.json` now records `archHash` at top level (older worklists still read). | `tests/review.test.ts` |
| 12 | `src/verify.ts` | A hand-edited `VERIFY.json` (null entry, missing or non-string `evidenceRef`) crashed `--check --semantic` (`-32603` over MCP). | Reported as a hard gate error. | `tests/verify.test.ts` |
| 13 | `src/scratch.ts` | `plan.json` entries missing `method`/`path`/`type`/`rule`/`members`/`name`/`title`, or `"i18n": {}`, crashed rendering with a bare TypeError. | `loadPlan` lists every malformed entry precisely. | `tests/scratch.test.ts` |
| 14 | `src/adapters/trpc.ts` | `import { userRouter as u }` put the child's procedures at the root (`list` instead of `user.list`). | Local alias mapped back to the exported name (ESM and CJS). | `tests/adapters-audit-fixes.test.ts` |
| 15 | `src/adapters/trpc.ts` | The documented `export const router = t.router` / `router({...})` pattern yielded no procedures. | A bare factory name counts when it is bound to `x.router` in the file or imported from the file that binds it. | same |
| 16 | `src/adapters/django.ts` | `path("api/", include([path("users/", v)]))` gave `/users`. | Inline include ranges contribute their prefix, including nested ones. | same |
| 17 | `src/adapters/rails.ts` | `resources :a, :b` expanded only `a`. `get :x, on: :member/:collection` was nested wrongly. `mount ActionCable.server => …` and `mount(X, at:)` were missed. | All three handled; hash-rocket option keys are excluded from resource names. | same |
| 18 | `src/adapters/generic.ts` | `go.mod`: only the first `require (...)` block was read and single-line `require` was never parsed. | Every block and every single-line require is read; `replace` is ignored. | `tests/deps.test.ts` |
| 19 | `src/adapters/generic.ts` | `requirements.txt` dropped `pkg[extra]>=x`, and inline comments and env markers ended up in versions. | Parsed properly. | same |
| 20 | `src/adapters/i18n.ts` | `locales/pt_BR/app.json` reported the namespace `app` as the locale. | `_` region/script tags accepted with strict casing (`my_app` is still not a locale). | `tests/adapters-audit-fixes.test.ts` |
| 21 | `src/adapters/dotnet.ts` | `[HttpGet("api/health")]` in a controller with no class `[Route]` was dropped. | Actions with their own template are attribute-routed. | same |

**User-facing changes:**
- **Errors that replace old silent behavior:**
  - #1: `--out` equal to the repo now errors.
  - #2: an empty `--flag=` now errors.
  - #3: an invalid `--port` or byte limit now errors.
  - #13: a malformed `plan.json` now errors.
  - #7 and #12: a malformed ledger now fails the gate.
- **Changed behavior:**
  - #4: brace lists are expanded.
  - #5: a new `mirror:` warning line.
  - #6: colliding rea evidence files get a suffix (non-colliding names are unchanged).
  - #10: `--verify` now extracts requirements under suffixed headings, so existing ledgers on such trees will show newly covered claims.
  - #14–21: the inventory finds more and more correct routes, dependencies and locales.

## Optimizations

Each one was measured with a micro-benchmark before and after (best of 2–5 runs, Node 24, Apple Silicon). Output is unchanged in every case and the existing tests pass. Linear-time regression tests with roughly 100× headroom are in `tests/perf-linear-scans.test.ts` and `tests/rea-line-splitter.test.ts`.

| Change | Input | Before | After |
|---|---|---|---|
| `^\s*` → `^[ \t]*` in multiline regexes (`pythonImportAliases`, run on every `.py` file by Flask and FastAPI) | 80k whitespace-only lines (= a blanked comment block) | 28 245 ms | 0.8 ms |
| Flask: scan the view block from the route, not the rest of the file | 8 000 routes in one file | 4 332 ms | 16 ms |
| Django: REST-marker test once per URLconf, not per route | 20 000 routes | 5 079 ms | 17 ms |
| rea stdio: linear line splitter | one 50 MB JSON-RPC line in 64 KB chunks | 5 059 ms | 12 ms |
| walk: read 4 KB of `inventory.json` to spot a prior output | 20 dirs × 20 MB `inventory.json` | 121 ms | 4 ms |
| Manifests through the read cache; workspace discovery memoised per analysis | 300-workspace monorepo, full `analyze()` | 151 ms | 75 ms |
| `--check --semantic`: derive requirement pairs once | 200 features × 21 requirements | 117 ms | 69 ms |

## Quality

- `methodOf` (×4) and the open-paren helper (×2) are deduplicated into `src/adapters/util.ts`.
- Removed `resetTreeLocks`, which was dead and unsafe by its own comment.
- **Dependencies:** none are unused (`yaml` is used by `tests/skill-md.test.ts`). Only minor dev bumps are pending (biome 2.6.2→2.6.6, vitest 5.0.5→5.1.0, @types/node). Dependabot groups these weekly, so I left them alone.
- **Note:** `biome.json`'s `$schema` still points at 2.4.16 while 2.6.x is installed. It is harmless today; bump it with the next Biome update.

## Issues found, not fixed

### Critical
None found. Specifically:
- No command injection with attacker-controlled strings.
- No path traversal out of `--out`.
- The HTTP MCP server binds 127.0.0.1 by default, checks Origin, and caps the body size.

### Important
1. **MCP tools write without `--allow-write`** (`src/mcp/handlers.ts:59`). `reconstruct_specs`/`features`/`merge` write SPECS/FEATURES/RECONSTRUCTION.md. `reconstruct_review`/`verify` write their worklists and `.md` files. Only scaffold, brainstorm and unknowns updates are gated, while `tools.ts` marks the others `write: true`. *Recommendation:* gate them, or document them as "derived-artifact writes". This is a policy decision (see questions).
2. **`reconstruct_read` trusts any directory containing an `inventory.json`** (`handlers.ts:105-117`). A prompt-injected client could read `.env` from an app that happens to ship a file named `inventory.json`. *Recommendation:* require the `generatedWith: "reconstruct@"` stamp, as the walk already does.
3. **Stale artifacts survive re-runs:**
   - `writeOutput` never prunes orphan `features/<old-slug>/` or `source/<old-slug>/`, which then feed `detectEnrichment` and the standalone bundles.
   - Old `evidence/rea/*.json` stays citable after `--rea off`, after a failed inspection, or after the binary is deleted.

   *Recommendation:* use a manifest of what each run wrote, then delete what the next run didn't write.
4. **Standalone `--specs`/`--merge` include `REVIEW.md`, `VERIFY.md`, `BRAINSTORM.md` and `orchestration/*.md`** (`postprocess.ts`, `prd/bundle.ts`). This contradicts "matches the inline run". *Recommendation:* use an allow-list of spec docs.
5. **The stdio MCP server blocks:**
   - Handlers (`analyze`, `runVerify`, the bundlers) are synchronous, so one long call stalls `ping`/`tools/list`.
   - A JSON-RPC batch counts as one in-flight entry, bypassing `MAX_IN_FLIGHT`.

   *Recommendation:* count each batch element. Moving the heavy handlers to a worker is a bigger refactor.
6. **Cancellation:** a `notifications/cancelled` that arrives after its response was sent poisons that id until FIFO eviction, and `1` and `"1"` collide (`mcp/server.ts:79-95`). *Recommendation:* track only in-flight ids, keyed by the JSON type as well as the value.
7. **rea robustness** (`src/rea.ts`):
   - No `notifications/cancelled` is sent on timeout and there is no overall deadline (worst case about 27 min per `.exe`).
   - `close_binary` is skipped when `open_binary` times out.
   - A synchronous `spawn` throw (`.bat`/`.CMD` on Windows) escapes "never fatal".
   - On Windows, `shell: true` with unquoted paths breaks on `C:\Users\John Doe\…`.
8. **Modifier flags are not validated without their primary flag.** For example `--apply x.json` without `--verify` runs a full analysis and re-renders; `--semantic` without `--check` is ignored.
9. **Route-adapter coverage gaps:**
   - Gorilla `PathPrefix().Subrouter()` is not handled.
   - Gin groups lose their prefix when passed to another function or assigned with `=`.
   - Fastify plugins exported by name are not resolved.
   - Express array mounts `app.use(["/a","/b"], r)` are missed.
   - Template-literal paths are emitted verbatim.
   - Rails `scope :admin` (symbol) and `get("/x")` with parentheses are missed.
   - FastAPI/Flask: a router included twice keeps only the last prefix.
   - tRPC procedures defined as separate consts are dropped.
   - `pyproject.toml`/`Pipfile` dependencies are not extracted.
   - A Gemfile nested `end` resets the dev group.

   Each needs a test-first fix like #14–21. *Recommendation:* tackle them in that order, which is roughly by ecosystem popularity.

### Minor
- `features.ts:351`: routes whose file is not code-categorized can reach no feature PRD; they still appear in INTERFACES.md.
- **`tree-lock`:**
  - The key differs before and after the out dir exists (`/tmp` vs `/private/tmp`), so two calls on a fresh path can race.
  - `excludedCount` undercounts pruned directories.
- `read-cache` claims bounded memory, but reads a file fully before the budget check. `extractEnvVarSources` has no per-file size cap.
- Unreadable files (`chmod 000 Dockerfile`) are classified as binary and then as compiled artifacts sent to rea.
- `analyze.ts:125`: any `template.yaml` (for example an issue template) adds a false "serverless" unknown.
- Stack detection false positives:
  - `rspec-rails` → Rails;
  - `sentry-sdk[flask]` → Flask;
  - `// indirect` Go deps;
  - a net/http-only Go repo never activates the Go adapter.
- Comment stripping: `</a>; // c` in TSX and C# `@$"…\"` are misread.
- Low-impact edge cases:
  - `scratch.ts:236`: `"not nullable"` matches `/nullable/`.
  - `check.ts:141`: `features/x/REBUILD.md` satisfies the root `REBUILD.md` requirement.
  - `bundle.ts:50`: a `===` line after a closing fence turns that fence into a setext heading.
- `diagramDoc` draws the DATA node for schema-only repos but only links features to it when i18n exists. Ambiguous; left as is.
- `localhost:*` origins are trusted by the HTTP MCP server, so any local dev server page can drive it (defense in depth; see questions).

### Larger refactors (recommended, not done)
- **One shared JS module-graph helper** (import/require/mount resolution) for express, hono, fastify and trpc. They copy `REQUIRE_RE`/`IMPORT_RE`/`LITERAL_RE`, `moduleSpecs` and the memoised `mountsOf` walk. Most of item 9's JS gaps would be fixed once there.
- **MCP handlers off the event loop** (a worker thread per heavy tool) and a per-request in-flight count.

## Open questions (need your decision)

1. **`--allow-write` scope:** should `reconstruct_specs`/`features`/`merge`/`review`/`verify` require `--allow-write` over MCP? Today they write without it.
2. **`--out` equal to the repo:** I made this a hard error. Would you rather auto-exclude the generated files and allow it?
3. **Modifier flags without their primary flag** (`--apply`, `--semantic`, `--phase`, `--max-verify`…): error out (my recommendation) or warn?
4. **`localhost:*` origins:** keep trusting any localhost port, or only the server's own port or an explicit `--allow-origin`?
5. **Stale outputs:** may a re-run delete files that the previous run generated and this one did not (orphan PRDs, old rea evidence)? This is the clean fix for Important #3, but it deletes files in the user's tree.
