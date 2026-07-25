# Libraries, CLIs, SDKs & engines (no web framework)

**When:** `inventory.stack.frameworks` is **empty**, or the only entries are build tooling
(`Vite`) — and `inventory.routes` is `0`. The unknown *"No web framework was detected from
manifests"* is the engine telling you it is this case. Also use it for a package inside a
monorepo that ships no HTTP surface, and for the library half of a framework+library repo.

This is the most common "no guide matched" situation, and the one where the reflex to look for
routes wastes the most time. **There are no routes. The interface surface is the public API.**

## Where the interface surface lives

Enumerate every way a consumer reaches this code. One `INTERFACES.md` row per entry:
**kind · name/signature · defining file · stability · notes**.

- **Package entry points** — the contract of what is importable:
  - npm: `package.json` `exports` (the authority — subpaths, `types`/`import`/`require`
    conditions), `main`/`module`/`types`, `bin`, `files`. A subpath in `exports` is a **separate
    public entry**; give each its own rows.
  - Python: `pyproject.toml` `[project.scripts]` / `[project.entry-points]`, `__init__.py`
    re-exports, `__all__`.
  - Go: every exported (capitalised) identifier in a non-`internal/` package. `internal/` is
    private by language rule — do not list it as public.
  - Rust: `pub` items in `src/lib.rs` and re-exports; `[[bin]]` targets.
  - Ruby/PHP/JVM: gemspec/composer autoload roots, public classes.
- **Exported symbols** — for each entry point, list the public functions, classes, types and
  constants with their **full signatures**: parameters + types + defaults, return type, thrown
  errors. A named export with no signature is the "named, not specified" anti-pattern.
- **CLI commands** — one row per command *and per subcommand*: name, positional args, every
  flag (long/short, type, default, required?), stdin/stdout contract, and **exit codes**. Find
  them in commander/yargs/oclif/clipanion (JS), Click/argparse/Typer (Python), Cobra (Go),
  clap (Rust), Thor (Ruby). Exit codes are part of the contract — a CLI whose `--check` exits 1
  on failure is unbuildable if you only wrote "reports errors".
- **Plugin / extension points** — the interface a third party implements (adapter registries,
  hooks, middleware signatures, lifecycle callbacks). List the interface *and* the dispatch
  rule: when is it called, in what order, what happens if it throws.
- **Configuration as an interface** — a config file schema (`*.config.ts`, `pyproject` table,
  YAML) is a public contract: every key, its type, default and validation.
- **Emitted artifacts** — for a codegen tool or build plugin, the *output* is the interface:
  file layout, naming rules, determinism guarantees.

## Data model

Usually there is no database. `DATA-MODEL.md` still has a job: the **in-memory domain types**
this library is built around.

- The core types/interfaces/structs consumers pass and receive — field by field, with exact
  types and optionality. Copy them verbatim from the source; never paraphrase a type.
- Every **enum / union / string-literal set**, with its complete member list (the discriminants
  of a tagged union count).
- Serialized formats the library reads or writes: the JSON/YAML/binary schema of every file it
  persists (a lockfile, a cache, a manifest, a report). Version fields and migration behaviour
  belong here.
- If there is genuinely no persistence, say so in one line rather than leaving the section empty
  — an emptied `DATA-MODEL.md` fails `--check`.

## Entry points & boot

- `hints.entryPoints` plus `package.json` `bin` / `[project.scripts]` / `[[bin]]` / `main()`.
- Distinguish the **library entry** (imported; must have no side effects at import time) from
  the **CLI entry** (executed; parses argv, exits). Note explicitly whether importing the
  package runs anything — that is a real behavioural contract.
- Build pipeline: bundler config (tsup/rollup/esbuild/setuptools), what is emitted (ESM/CJS/
  types/wasm), and whether build output is **committed** (some skills/tools vendor their bundle
  — if so, that invariant is a requirement, usually with a CI gate).

## Config & env

Env vars the library reads at runtime (`inventory.envVars`), config-file discovery order
(cwd → parents → home → defaults), and precedence between flag / env / config / default. That
precedence order is a contract and is almost never written down — read the resolution code.

## Gotchas

- **Do not invent an HTTP surface.** If `INTERFACES.md` for a library lists routes, something
  went wrong. Rows are exports, commands, and hooks.
- **`hints.routeCandidates` is noisy here.** Files matching route-ish heuristics (an adapter
  that *parses* Express routes, a fixture, a test) will surface as candidates. Read before you
  believe — most are false positives in this stack.
- **Tests are the spec.** With no UI and no routes, the test suite is the most precise statement
  of intended behaviour. Read it to recover edge cases, and mine assertion messages for the
  invariants the author cared about.
- **Public vs internal is a decision, not an accident.** Anything re-exported from the entry
  point is public API and cannot change without a major version. Say which symbols are internal.
- **Semver is behaviour.** If the repo publishes releases, the compatibility promise (what may
  change in a patch) belongs in `ARCHITECTURE.md` under cross-cutting policies.
- **Peer dependencies and supported runtimes** (`engines`, `python_requires`, MSRV, target
  platforms) are part of the contract.
- **A CLI's stdout is an API.** If output is machine-readable (`--json`), its schema is an
  interface row; if humans read it, the exact wording is not — say which.
- `DESIGN-SYSTEM.md` self-degrades to a stub: a library with no UI has no design system. Say so
  rather than inventing one.

> tip: rewrite the question — not "where are the routes?" but **"what can a consumer call, and
> what exactly happens?"** The public entry points in the manifest, the exported signatures, the
> CLI flags **with their exit codes**, and the plugin interfaces *are* the interface surface;
> the tests are your best source for the edge cases nobody wrote down.
