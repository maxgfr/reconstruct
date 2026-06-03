# Data model

| Setting | Value |
| --- | --- |
| Mode | `redesign` |
| Level | `complex` |
| Fidelity | `describe` |
| Generated with | `reconstruct@0.7.0` |

> 🧠 **For the AI agent:** Reconstruct the data model from the schema/ORM files below (raw copies live in `data/schema/`). List **every** entity/table with its key fields + types, relations (1-1 / 1-N / N-N), and indexes/constraints. Follow `references/analysis-playbook.md` (§Data model) and the ORM conventions in the matching `references/stack-guides/`.


## Schema / model source files

- `prisma/schema.prisma`

## Entities (fill this in)

| Entity / Table | Field | Type | Constraints | Relation |
| --- | --- | --- | --- | --- |

> 🧠 **For the AI agent:** Keep these columns; for each entity capture fields + types, PK/FK, enums, defaults, indexes, and how it maps to the interfaces in `INTERFACES.md`.


## Relations & integrity

_Summarize relationships, cascade rules, and any derived/computed data._

## Enums & domain types

> 🧠 **For the AI agent:** Enumerate **every** domain enum / fixed value set this schema uses — each with its **complete** member list (e.g. roles, statuses, categories). A field typed `enum`/`status`/`type` whose members are not listed here is not buildable: a fresh agent cannot validate it or write the test.

