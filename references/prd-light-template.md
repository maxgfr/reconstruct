# PRD template — light

Use this shape when enriching a `features/<slug>/PRD.md` at **light** level. Goal:
faithful and concise. Do not invent features; describe what exists.

```markdown
# <Feature name>

## Summary
One or two sentences: what this unit is responsible for.

## Functional requirements
- [ ] Behavior 1 (observable, testable)
- [ ] Behavior 2
- [ ] Validation / error states

## Interfaces (if any)
| Route / Operation | Kind | Notes |
| --- | --- | --- |
(The routes/endpoints/RPC/GraphQL ops this unit owns — a subset of `architecture/INTERFACES.md`.)

## Data & contracts
- Inputs, outputs, types, events this unit exposes (reference entities in `architecture/DATA-MODEL.md`).

## Source material
(Generated automatically — keep references to `source/` or embedded code.)

## Acceptance criteria
- [ ] The rebuilt unit reproduces the behaviors above.
```

Keep it tight. The reader should be able to rebuild the unit faithfully without
guesswork, using `data/` and `source/` as ground truth.
