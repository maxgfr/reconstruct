# Code audit — reconstruct (2026-11-10, from v2.29.7; second pass from v2.29.9)

## Summary

1. The codebase is in good shape overall. It is a TypeScript engine (`src/`) bundled into a committed, dependency-free `scripts/analyze.mjs`. It is strictly typed, and its CI is reproducible: bundle diff, Node 18 floor job, golden example and parity.
2. The baseline was fully green before any change: typecheck, Biome, 899 tests in 57 files, `check:build`, `verify:example`, parity and the demo. The full gate took 11.4 s.
3. Most real defects sat in two places:
   - **Regex-based route and dependency adapters:** 20 framework fixes across tRPC, Express, Fastify, NestJS, Next.js, Django, FastAPI, Flask, Rails, Go, ASP.NET, i18n and dependency manifests.
   - **Fail-closed edges of the gates:** malformed ledgers crashed instead of failing, `--semantic` could pass on orphaned verdicts, required documents were matched by suffix, and review could not commit a zero-feature round.
4. Several scans were **quadratic** (Python imports, Flask, Django, rea's stdio framing) and are now linear. Re-runs now prune their own stale output and treat edited generated docs as enrichment.
5. What remains open is either intended behavior, an upstream engine limitation, or a large refactor; see "Issues found, not fixed".

All work is in small commits on `main`: 51 `fix`, 8 `perf`, 4 refactor/chore/test commits, plus this report. The suite grew from 899 to 1 068 tests. Every commit is signed and carries the rebuilt bundle. The second pass changed no CI workflow, secret or release config.

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

### Second pass

| Area / file | Problem | Fix | Test |
|---|---|---|---|
| `src/mcp/handlers.ts` | Any directory with an `inventory.json` counted as a tree, so `reconstruct_read` would serve an app's `.env`. | The tree must carry the `generatedWith: reconstruct@` stamp. | `tests/mcp-handlers.test.ts` |
| `src/mcp/stdio.ts` | A JSON-RPC batch counted as one in-flight entry, so 20 calls ran at once despite the cap of 4. | Each element acquires a slot; the batch is still answered as one array. | `tests/mcp-stdio-batch-limit.test.ts` |
| `src/cli.ts` | Modifier flags were silently ignored outside their mode. For example `--apply v.json` without `--verify` re-rendered the tree. | Fails with the mode it belongs to. ⚠️ user-facing | `tests/cli-args-validation.test.ts` |
| `src/output.ts` | Re-runs left orphan `features/<old>/` and `source/<old>/` behind, and silently overwrote edited callout-free docs (`REBUILD.md`, overview, diagram). | `.reconstruct-generated.json` records what the engine wrote. A full render deletes only its own unchanged stale files (edited ones are kept and reported). An edited generated doc is an enrichment witness. ⚠️ user-facing | `tests/output-stale-prune.test.ts` |
| `src/rea.ts` | A list of problems, all fixed (see the next row). | — | `tests/rea-engine.test.ts` |
| | **Problems:** stale rea evidence stayed citable; a failed probe's payload was citable; a timeout was not cancelled on rea's side; `open_binary` timeouts left sessions open; there was no overall budget; a synchronous spawn failure escaped; a Windows `.cmd`/`.bat` on a path with a space failed (unquoted, case-sensitive); a child could keep the CLI alive. | **Fixes:** prune only what the previous INDEX named (agent exports untouched); `notifications/cancelled`; always close; a 20 min run budget; spawn inside `try`; `spawnTarget()` quoting; destroy the pipes and `unref`. | same |
| `src/verify.ts` | `--semantic` passed when the verified requirements were rewritten into prose: the verdicts were orphaned and nothing counted as "uncovered". `1)` lists were never extracted. | Orphaned verdicts are a coverage failure; `1)` items are extracted. | `tests/verify.test.ts` |
| `src/postprocess.ts` | Standalone bundles inlined `REVIEW.md`, `VERIFY.md`, `BRAINSTORM.md` and `orchestration/*`. | Excluded (`CONTEXT.md` and ADRs are kept). | `tests/postprocess.test.ts` |
| `src/check.ts` | Three problems: required docs were matched by suffix (`features/x/REBUILD.md` satisfied the root); an inch mark `5"` paired with a later quote and hid a callout; a nameless inventory entry crashed the gate. | Exact paths; a `"` after a digit is not a quote; non-string names are skipped. | `tests/check.test.ts` |
| `src/brainstorm.ts` | `{}` inventory crashed. | Guarded. | `tests/brainstorm.test.ts` |
| `src/scratch.ts` | `not nullable` / `non-nullable` read as nullable, suppressing the owner-FK warning. | Fixed precedence. | `tests/consistency.test.ts` |
| `src/prd/bundle.ts` | A `===` after a closing fence turned the fence into an H1. | Fence lines are never setext content. | `tests/bundle.test.ts` |
| `src/analyze.ts` | Any `template.yaml` (for example a GitHub issue form) raised a "serverless infra" unknown. | Requires SAM/CloudFormation markers. | `tests/unknowns.test.ts` |
| `src/walk.ts`, `adapters/generic.ts` | Unreadable files became "binary", so an extension-less one went to rea as an executable. The env-var scan read files of any size. | Only the extension decides binary-ness; the env scan skips files over 8 MB and names them in a warning. | `tests/scan.test.ts` |
| `src/tree-lock.ts` | The lock key changed once the out dir existed (`/tmp` vs `/private/tmp`). | Realpath of the nearest existing ancestor. | `tests/tree-lock.test.ts` |
| `src/features.ts` | A route whose URL and file matched no code group reached no feature PRD. | It gets its own group. | `tests/features.test.ts` |
| `src/prd/templates.ts` | A schema-only repo drew an unconnected DATA node. The golden example still showed the pre-fix edges. | Edges follow the node; `assets/example-output/architecture/diagram.md` is corrected. | `tests/templates-rendering.test.ts` |
| `src/cli.ts` | "excluded: N file(s)" did not mention that pruned directories are uncounted. | Wording and docs state what the count covers. | — |
| **Adapters** (12 commits, written test-first in two parallel worktrees, then reviewed and rebased here) | **JS/.NET:** Express array mounts and `get (`; Fastify named-export plugins, nested options and multi-line chains; tRPC procedure consts and default imports; NestJS non-controller classes; ASP.NET chained `MapGroup` and `$@` strings; JSX `</` and postfix `++` in comment stripping. **Python/Ruby/Go:** Gorilla `Subrouter`/`Handle`, Gin `=` groups and helper hand-offs; net/http-only Go repos; `// indirect` deps; Rails `scope :sym`, `get(...)`, `match via:`, singularize; FastAPI/Flask multi-prefix mounts and `api_route` → GET; Python `\` continuation imports; Gemfile nested `end`; pyproject/Pipfile/split requirements; `rspec-rails` / `sentry-sdk[flask]` false positives; Next.js `pages/index/` directories. | — | `tests/adapters-js-gaps.test.ts`, `tests/adapters-py-rb-go-gaps.test.ts`, `tests/deps.test.ts`, `tests/adapters-audit-fixes.test.ts` |
| tooling | Local worktrees under `.claude/worktrees/` broke `biome ci` and were collected by vitest. | Gitignored and excluded; biome honours `.gitignore`; `$schema` bumped to 2.6.2. | — |

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
| `--verify --apply`: derive requirement pairs once (was 3×) | 200 features × 21 requirements | 117 ms | 82 ms |

## Quality

- `methodOf` (×4) and the open-paren helper (×2) are deduplicated into `src/adapters/util.ts`.
- Removed `resetTreeLocks`, which was dead and unsafe by its own comment.
- **Dependencies:** none are unused (`yaml` is used by `tests/skill-md.test.ts`). Only minor dev bumps are pending (biome 2.6.2→2.6.6, vitest 5.0.5→5.1.0, @types/node). Dependabot groups these weekly, so I left them alone.
- `biome.json`'s `$schema` is bumped from 2.4.16 to the installed 2.6.2, and Biome now honours `.gitignore`.

## Issues found, not fixed

### Critical
None.

### Important
1. **The stdio MCP server blocks while one long call runs.** Handlers such as `analyze`, `runVerify` and the bundlers are synchronous, so a long call stalls `ping`/`tools/list`. The in-flight cap now holds for batches too, but true concurrency needs the heavy handlers in a worker thread. That is an architecture change, so I left it as a recommendation.

### Minor
- **Template-literal route paths** (`` app.get(`/t/${id}`) ``) are emitted verbatim. There is no static value to resolve, and the verbatim text is the most faithful hint for the agent.
- **Comment-stripping edges the narrow fix does not cover:**
  - a spaced `n < /re/`;
  - `{x}/>` (self-closing JSX after `}`);
  - an apostrophe in JSX text (`<p>don't</p>`).

  No rule handles these without regressing real regex literals; a tokenizer would.
- **The exact `excludedCount`** would need the vendored CodeIndex walk to count the files of the directories it prunes. The fix is upstream (`maxgfr/codeindex`), not in this repo.
- **Dev dependencies** have minor bumps available (biome 2.6.6, vitest 5.1.0, @types/node). Dependabot groups them weekly.

### Checked and intended (no change)
- **MCP tools that write without `--allow-write`** (`specs`/`features`/`merge`/`review`/`verify`). The help text defines `--allow-write` as creating a tree or overwriting prose; worklists and bundles inside `--out` are documented as derived files. The tools are annotated `write: true` so clients can still prompt.
- **Late cancellation poisoning an id.** MCP forbids reusing a request id within a session, so a late `notifications/cancelled` cannot hit a later request from a compliant client. The existing test relies on this behavior.
- **`localhost:*` origins trusted by the HTTP transport.** Any page served from localhost already runs with local-user trust. Non-browser clients send no Origin. Anything else needs `--allow-origin`.
- **Any `.json` under `evidence/rea/` makes ids citable.** Agents export their own rea bundles there by design (`references/rea-companion.md`).

### Larger refactors (recommended, not done)
- **One shared JS module-graph helper** (import/require/mount resolution) for express, hono, fastify and trpc. They still copy `REQUIRE_RE`/`IMPORT_RE`/`LITERAL_RE` and the memoised mount walk.
- **MCP handlers off the event loop** (a worker per heavy tool).

## Decisions taken (please confirm)

The first report listed these as open questions. You asked me to fix everything, so I applied my recommendation for each:

1. **`--out` equal to the repo** stays a hard error.
2. **Modifier flags without their mode** now fail, as listed above. Every documented invocation still parses.
3. **Stale output** is deleted on re-run, but only files the engine itself generated, that this run no longer generates, and that are still byte-for-byte as generated. Edited ones are kept and reported. Agent files and agent-exported rea bundles are never touched.
4. **MCP `--allow-write` scope** and **`localhost` origins** are unchanged (see "Checked and intended").
