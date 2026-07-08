# AI buildability review worklist — round 1

Review the 7 feature(s) flagged below against the nine checks in `references/ai-review-rubric.md` (story completeness, requirement testability, real Given/When/Then, write-contract satisfiability, enum fidelity, cross-doc consistency, faithfulness, i18n, the rebuild self-test). For each, read the PRD plus the architecture docs it references and the embedded source. Keep the reviewer **separate from the author** and prompt it to find reasons the unit is *not* buildable.

Emit each finding as `{ feature, severity (blocker|major|minor), category, problem, fix }`. Have an **independent verifier** set `verdict` to `confirmed` or `refuted` per blocker (a refuted blocker does not gate). Save the findings (e.g. as `findings.json`, shape `{ "findings": [...] }`), then run `node scripts/analyze.mjs --review --apply findings.json --out <dir>`.

## 01-core
PRD: `features/01-core/PRD.md`

## 02-project-setup
PRD: `features/02-project-setup/PRD.md`

## 03-prisma
PRD: `features/03-prisma/PRD.md`

## 04-api
PRD: `features/04-api/PRD.md`

## 05-internationalization
PRD: `features/05-internationalization/PRD.md`

## 06-dashboard
PRD: `features/06-dashboard/PRD.md`

## 07-documentation
PRD: `features/07-documentation/PRD.md`
