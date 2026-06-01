---
name: Bug report
about: The analyzer produced wrong or missing output
title: "[bug] "
labels: bug
---

## What happened

A clear description of the bug.

## Repro

- Stack of the analyzed repo (framework, ORM, language):
- Command run: `node scripts/analyze.mjs --repo … --mode … --level …`
- If possible, a minimal repo or file layout that reproduces it.

## Expected vs actual

- **Expected:** …
- **Actual:** … (paste the relevant part of `inventory.json` — `stack`, `routes`,
  `hints`, `unknowns`, or `features` — and/or the generated PRD section).

## Environment

- reconstruct version (`node scripts/analyze.mjs --version`):
- Node version:
- OS:
