# PRD template — complex

Use this shape when enriching a `features/<slug>/PRD.md` at **complex** level. Goal:
faithful rebuild **plus** concrete improvements the agent can apply.

```markdown
# <Feature name>

## Summary
What this unit does and why it exists.

## Functional requirements
- [ ] Happy-path behaviors (testable)
- [ ] Edge cases and validation
- [ ] Error states and recovery

## Routes / interfaces
| Route / Operation / Export | Kind | Contract |
| --- | --- | --- |
(This unit's slice of `architecture/INTERFACES.md` — routes, endpoints, RPC/GraphQL ops, jobs.)

## Data & contracts
- Types, schemas, events, side effects (reference the entities in `architecture/DATA-MODEL.md`).

## Source material
(Generated — embedded code or `source/` references.)

## Improvements & refactors
Each item tagged so the rebuild stays safe by default:
- [ ] [keep-behavior] Stronger types / remove `any`
- [ ] [keep-behavior] Error handling around <X>
- [ ] [keep-behavior] Tests for <Y>
- [ ] [behavior-change] (opt-in) <bigger idea>

## Acceptance criteria
- [ ] Behaviors reproduced; `[keep-behavior]` items applied.
- [ ] `[behavior-change]` items only if the user approved them.
```

Rule: **never** silently change behavior. Mark anything that alters output as
`[behavior-change]` and leave it opt-in.
