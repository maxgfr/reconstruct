# assets/

`example-output/` is the shipped **golden example**: a complete, **enriched, gate-passing**
reconstruction of `tests/fixtures/sample-app` — the shape a finished reconstruction takes, not a
raw scaffold. It has no `🧠` callouts left, every feature PRD spine is filled, the architecture
contracts (`INTERFACES.md` / `DATA-MODEL.md` / `DESIGN-SYSTEM.md`) are complete, and it ships its
adjudicated ledgers (`VERIFY.json`, `REVIEW.json`) so it passes the strictest gate:

```bash
node scripts/analyze.mjs --check --semantic --out assets/example-output   # exits 0
```

CI runs exactly that command (`.github/workflows/ci.yml`), so the example can never silently
regress. **A consequence:** any engine change that tightens the gate will make this example fail
until it is deliberately regenerated and re-enriched — that coupling is intentional; the reference
is meant to always meet the current bar.

Being a faithful reconstruction of a deliberately-minimal fixture, it also records the fixture's
real gaps rather than papering over them (the `User` model is declared but unqueried; the pages
hardcode copy instead of reading the i18n catalog; `/api/users` returns a static list). That is
what a faithful reconstruction looks like — gaps are surfaced, not invented away.

## Regenerate

```bash
# 1. Scaffold from the fixture with the current engine.
node scripts/analyze.mjs --repo tests/fixtures/sample-app \
  --out assets/example-output --mode redesign --level complex --fidelity describe

# 2. Enrich every 🧠 callout + fill the spines from the fixture as ground truth, until:
node scripts/analyze.mjs --check --out assets/example-output           # exits 0

# 3. Adjudicate the ledgers honestly (evidenceRefs must resolve; label confidence):
node scripts/analyze.mjs --verify --out assets/example-output
#   → fill VERIFY.todo.json → verdicts.json, then:
node scripts/analyze.mjs --verify --apply verdicts.json --out assets/example-output
node scripts/analyze.mjs --review --out assets/example-output
#   → fill findings.json, then:
node scripts/analyze.mjs --review --apply findings.json --out assets/example-output

# 4. The final, fail-closed gate must pass:
node scripts/analyze.mjs --check --semantic --out assets/example-output # exits 0
```

Commit the enriched docs plus `VERIFY.json` / `REVIEW.json` (and their `*.md` / `*.todo.json`
siblings); the intermediate `verdicts.json` / `findings.json` are not shipped.
