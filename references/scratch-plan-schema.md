# The `plan.json` contract (scratch mode)

`plan.json` is the structured output of the greenfield interview — a grill-with-docs session
that elicits the project's facts from the user instead of reading a repo. It maps **1:1 onto
the inventory**: `planToInventory()` is the bridge, validating the plan and projecting it into
the *same* `Inventory` the code analyzer produces (empty `files`/`routes`/`hints` — there is no
source to read — but populated `stack`, `dependencies`, `envVars`, `i18n` (+ message catalog),
tiered `features`, and pre-filled `interfaces`/`dataModel`/`enums`/`services`/`policies`/
`designSystem`, with `mode = "scratch"` and `fidelity = "describe"`).
From there the shared renderer takes over: the **engine** emits the deterministic scaffold and
the **pre-filled** `INTERFACES.md` / `DATA-MODEL.md` tables, and the **agent** enriches the
prose in the PRDs, `00-overview`, `CONTEXT.md`, and the ADRs.

## Schema

Required fields are marked **`// REQUIRED`**; everything else is optional with a default.

```jsonc
{
  "project": {                          // REQUIRED
    "name":     "string",               //   REQUIRED — repoName + 00-overview title
    "summary":  "string",               //   REQUIRED — product one-liner
    "audience": "string",               //   optional
    "value":    "string"                //   optional
  },
  "stack": {                            // REQUIRED
    "primaryLanguage": "string",        //   REQUIRED
    "languages":       ["string"],      //   default: [primaryLanguage]
    "frameworks":      ["string"],      //   default: []
    "libraries":       ["string"],      //   default: []
    "packageManagers": ["string"],      //   default: []
    "hasTypeScript":   true             //   default: inferred from primaryLanguage
  },
  "dependencies": [                     // optional, default: []
    { "manager": "string", "manifest": "string",
      "runtime": { "dep": "ver" },      //   default: {}
      "dev":     { "dep": "ver" } }     //   default: {}
  ],
  "envVars": ["string"],                // optional, default: []
  "i18n": {                             // optional, default: null (omit or null = no i18n)
    "locales":  ["string"],             //   REQUIRED when i18n is present
    "messages": {                       //   optional — the buildable message catalog
      "sourceLocale": "string",         //     locale the source strings are written in
      "namespaces":   ["string"],       //     top-level message namespaces
      "entries": [ { "key": "string", "source": "string" } ] } },  // keys + source strings
  "dataModel": [                        // optional, default: []
    { "entity": "string",
      "fields": [ { "name": "string", "type": "string",
                    "constraints": "string",   // PK/FK->table.col/not null/default/unique
                    "enumRef": "string" } ],   // optional: an enums[].name (sets the member set)
      "relations": ["string"],          //   optional; relations also seed CONTEXT.md
      "indexes":   ["string"],          //   optional: index definitions
      "uniques":   ["string"] }         //   optional: unique-constraint definitions
  ],
  "enums": [                            // optional, default: [] — named domain sets
    { "name": "string", "members": ["string"], "description": "string" } ],
  "interfaces": [                       // optional, default: []
    { "method": "string", "path": "string",
      "kind": "string", "auth": "string", "notes": "string",
      "input": "string",                //   exact input/request shape (fields + types)
      "output": "string",               //   exact output/response shape
      "sideEffects": ["string"] } ],    //   writes / emails / jobs / external calls
  "services": [                         // optional, default: [] — external integrations
    { "name": "string", "purpose": "string", "provider": "string",
      "operations": [ { "name": "string", "input": "string", "output": "string" } ],
      "request": "string", "response": "string",
      "timeout": "string", "onFailure": "string" } ],
  "policies": [                         // optional, default: [] — rate limits, validations
    { "name": "string", "kind": "string",   // rate-limit | validation | security | other
      "rule": "string",                     // concrete, testable (thresholds, regex, window)
      "appliesTo": ["string"] } ],          // interface paths / field names it governs
  "designSystem": {                     // optional — architecture/DESIGN-SYSTEM.md (UI products only)
    "tokens": {                         //   token sets, each entry a `name: value` string
      "colors":          ["primary-500: #1d4ed8"],
      "typographyScale": ["text-sm: 0.875rem/1.25rem"],
      "spacing": ["2: 0.5rem"], "sizing": ["container: 1280px"],
      "radii": ["md: 0.375rem"], "shadows": ["sm: 0 1px 2px rgba(0,0,0,.05)"], "zIndex": ["modal: 1000"] },
    "theme":      { "modes": ["light", "dark"], "scheme": "CSS vars on :root/.dark", "default": "system" },
    "typography": { "families": ["sans: Inter"], "weights": ["400", "600"], "loading": "next/font" },
    "breakpoints": ["sm: 640px", "lg: 1024px"],
    "iconography": "lucide-react · 24px · stroke 2",
    "motion":     { "durations": ["fast: 150ms"], "easings": ["standard: cubic-bezier(.4,0,.2,1)"],
                    "reducedMotion": "honor prefers-reduced-motion" },
    "components": [                      //   each primitive: variants + the states it must render
      { "name": "Button", "source": "owned", "variants": ["primary", "ghost"],
        "states": ["default", "hover", "disabled", "loading"] } ],
    "a11y":  { "target": "WCAG 2.1 AA", "requirements": ["full keyboard nav", "visible focus ring"] },
    "brand": "string" },                //   brand identity / voice notes (redesign anchors to this)
  "features": [                         // REQUIRED — at least one entry
    { "name": "string",                 //   REQUIRED
      "kind": "feature",                //   "feature" | "project-setup" | "internationalization" | "documentation"
      "tier": 1,                        //   0 | 1 | 2 — default: derived from kind
      "summary":    "string",
      "interfaces": ["string"],         //   paths/operations from interfaces[].path
      "entities":   ["string"],         //   entity names from dataModel[].entity
      "writes":     ["string"] } ],     //   subset of entities this feature WRITES
  "glossary": [                         // optional -> CONTEXT.md Language section
    { "term": "string", "definition": "string", "avoid": ["string"] } ],
  "decisions": [                        // optional -> one terse ADR each
    { "title": "string", "context": "string", "decision": "string", "why": "string" } ],
  "tdd": false                          // optional, default: false (same as --tdd)
}
```

`feature.tier` is derived from `kind` when omitted: `project-setup` & `internationalization` →
`0`, `documentation` → `2`, `feature` → `1`. Within a tier the plan's **declared order is
preserved**; features then get `NN-` numbered slugs in build order.

## Field reference

| Field | Required? | Default | Drives in the output |
| --- | --- | --- | --- |
| `project.name` | **yes** | — | `repoName`; `00-overview` title; `REBUILD.md` heading |
| `project.summary` | **yes** | — | `00-overview` product summary; `CONTEXT.md` intro line |
| `project.audience` / `project.value` | no | omitted | `00-overview` product summary detail |
| `stack.primaryLanguage` | **yes** | — | overview tech-stack; `hasTypeScript` inference |
| `stack.languages/frameworks/libraries/packageManagers` | no | see schema | overview tech-stack; `ARCHITECTURE.md` |
| `stack.hasTypeScript` | no | inferred | overview tech-stack flag |
| `dependencies[]` | no | `[]` | `ARCHITECTURE.md` deps; overview tech-stack |
| `envVars[]` | no | `[]` | overview env section; `REBUILD.md` env-var checklist |
| `i18n.locales` | no | `null` | Internationalization feature; overview locale count; `ARCHITECTURE.md` i18n line |
| `i18n.messages` | no | omitted | `ARCHITECTURE.md` message catalog (namespaces + keys + source strings) |
| `dataModel[]` | no | `[]` | `architecture/DATA-MODEL.md` **pre-filled** entity tables; relations seed `CONTEXT.md` |
| `dataModel[].fields[].enumRef` | no | omitted | links a field to an `enums[]` member set |
| `dataModel[].indexes` / `.uniques` | no | omitted | rendered per entity in `DATA-MODEL.md` |
| `enums[]` | no | `[]` | `architecture/DATA-MODEL.md` `## Enums & domain types` (full member lists) |
| `interfaces[]` | no | `[]` | `architecture/INTERFACES.md` **pre-filled** table |
| `interface.input` / `.output` / `.sideEffects` | no | omitted | `INTERFACES.md` `## Operation contracts` per operation |
| `services[]` | no | `[]` | `ARCHITECTURE.md` `## External services & integrations` |
| `policies[]` | no | `[]` | `ARCHITECTURE.md` `## Cross-cutting policies` (rate limits, validations) |
| `designSystem` | no | omitted | `architecture/DESIGN-SYSTEM.md` **pre-filled** (tokens, theming, typography, breakpoints, iconography, motion, components, a11y) |
| `designSystem.components[]` | no | `[]` | the component-library contract table (variants + states per primitive) |
| `features[]` | **yes** (≥1) | — | `features/NN-<slug>/PRD.md`; dependency-tiered build order in `REBUILD.md` |
| `feature.kind` | no | `"feature"` | tier derivation; PRD framing (setup / i18n / docs) |
| `feature.tier` | no | derived | build order within `REBUILD.md` |
| `feature.interfaces` / `feature.entities` | no | `[]` | cross-links from the feature PRD to `INTERFACES.md` / `DATA-MODEL.md` |
| `feature.writes` | no | `[]` | entities the feature writes; drives the anonymous-write consistency check |
| `glossary[]` | no | `[]` | `CONTEXT.md` Language section (format: [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md)) |
| `decisions[]` | no | `[]` | `docs/adr/NNNN-<slug>.md`, one per entry (format: [ADR-FORMAT.md](./ADR-FORMAT.md)) |
| `tdd` | no | `false` | red→green→refactor build guidance in PRDs/`REBUILD.md` (same as `--tdd`) |

## Consistency rules (enforced by `--scratch`)

A buildable tree starts with an internally consistent plan, so the engine validates these
before it renders — **errors abort**, **warnings print** (resolve them while enriching):

- **Errors:** a `features[].entities`/`writes` or `features[].interfaces` that names something
  not defined in `dataModel`/`interfaces`; an `enums[]` entry with no members; a field
  `enumRef` that names no defined enum.
- **Warning:** an `auth: "public"` mutation whose owning feature `writes` an entity that has a
  non-null foreign key to an identity table (`users`) — an anonymous caller can't satisfy it,
  so write to an anonymous-capable entity (e.g. a `contactRequests` table) instead.
- **Warning:** a `designSystem.components[]` entry with no `variants` and no `states` — a
  component named but not contracted can't be rebuilt to a fixed spec.

The post-enrichment gate (`node scripts/analyze.mjs --check --out <OUT>`) then verifies the
rendered tree. See `references/buildability-checklist.md` for the full ten contract
categories and the consistency self-review.

## Worked example — `linkrolls` (link-in-bio app)

A small but real plan that exercises **every** top-level section. Valid JSON; copy it to a file
and run `node scripts/analyze.mjs --scratch --plan linkrolls.plan.json --out ./out --level light`.

```json
{
  "project": {
    "name": "linkrolls",
    "summary": "A link-in-bio app: each user gets one public page that lists their links, themed and reorderable.",
    "audience": "Creators and small businesses who need a single shareable profile link.",
    "value": "Spin up a branded link page in under a minute, then track which links get clicked."
  },
  "stack": {
    "primaryLanguage": "TypeScript",
    "languages": ["TypeScript", "SQL"],
    "frameworks": ["Next.js"],
    "libraries": ["Drizzle ORM", "NextAuth.js", "next-intl", "Tailwind CSS", "Zod"],
    "packageManagers": ["pnpm"],
    "hasTypeScript": true
  },
  "dependencies": [
    {
      "manager": "pnpm",
      "manifest": "package.json",
      "runtime": { "next": "15.x", "react": "19.x", "drizzle-orm": "latest", "next-auth": "5.x", "next-intl": "3.x", "zod": "3.x" },
      "dev": { "drizzle-kit": "latest", "typescript": "5.x", "tailwindcss": "4.x" }
    }
  ],
  "envVars": ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"],
  "i18n": { "locales": ["en", "fr"] },
  "dataModel": [
    {
      "entity": "users",
      "fields": [
        { "name": "id", "type": "uuid", "constraints": "PK" },
        { "name": "email", "type": "text", "constraints": "unique, not null" },
        { "name": "handle", "type": "text", "constraints": "unique (public URL slug)" },
        { "name": "locale", "type": "text", "constraints": "default 'en'" }
      ],
      "relations": ["A users row has one page", "A users row has one theme"]
    },
    {
      "entity": "pages",
      "fields": [
        { "name": "id", "type": "uuid", "constraints": "PK" },
        { "name": "userId", "type": "uuid", "constraints": "FK -> users.id" },
        { "name": "title", "type": "text", "constraints": "" },
        { "name": "published", "type": "boolean", "constraints": "default false" }
      ],
      "relations": ["pages belongs to users", "pages has many links"]
    },
    {
      "entity": "links",
      "fields": [
        { "name": "id", "type": "uuid", "constraints": "PK" },
        { "name": "pageId", "type": "uuid", "constraints": "FK -> pages.id" },
        { "name": "label", "type": "text", "constraints": "not null" },
        { "name": "url", "type": "text", "constraints": "not null" },
        { "name": "position", "type": "integer", "constraints": "order within page" },
        { "name": "clicks", "type": "integer", "constraints": "default 0" }
      ],
      "relations": ["links belongs to pages"]
    }
  ],
  "interfaces": [
    { "method": "GET", "path": "/[handle]", "kind": "page (SSR)", "auth": "public", "notes": "Public link page by handle" },
    { "method": "tRPC", "path": "links.create", "kind": "tRPC mutation", "auth": "user", "notes": "Add a link to the page" },
    { "method": "tRPC", "path": "links.reorder", "kind": "tRPC mutation", "auth": "user", "notes": "Persist drag-and-drop order" },
    { "method": "tRPC", "path": "links.trackClick", "kind": "tRPC mutation", "auth": "public", "notes": "Increment click count" },
    { "method": "GET", "path": "/api/auth/[...nextauth]", "kind": "REST", "auth": "public", "notes": "NextAuth handler" }
  ],
  "designSystem": {
    "tokens": {
      "colors": ["primary-500: #1d4ed8", "bg: #ffffff", "fg: #0f172a"],
      "typographyScale": ["text-sm: 0.875rem/1.25rem", "text-base: 1rem/1.5rem", "text-xl: 1.25rem/1.75rem"],
      "spacing": ["2: 0.5rem", "4: 1rem", "8: 2rem"],
      "radii": ["md: 0.375rem", "full: 9999px"]
    },
    "theme": { "modes": ["light", "dark"], "scheme": "Tailwind CSS variables on :root and .dark", "default": "system" },
    "typography": { "families": ["sans: Inter"], "weights": ["400", "600", "700"], "loading": "next/font (self-hosted)" },
    "breakpoints": ["sm: 640px", "md: 768px", "lg: 1024px"],
    "iconography": "lucide-react · 20px · stroke 2",
    "motion": { "durations": ["fast: 150ms"], "easings": ["standard: cubic-bezier(.4,0,.2,1)"], "reducedMotion": "honor prefers-reduced-motion" },
    "components": [
      { "name": "LinkCard", "source": "owned", "variants": ["default", "editing"], "states": ["default", "hover", "dragging", "empty"] },
      { "name": "Button", "source": "owned", "variants": ["primary", "ghost"], "states": ["default", "hover", "disabled", "loading"] }
    ],
    "a11y": { "target": "WCAG 2.1 AA", "requirements": ["full keyboard reordering", "visible focus ring", "4.5:1 text contrast"] }
  },
  "features": [
    { "name": "Project Setup & Tooling", "kind": "project-setup", "tier": 0, "summary": "Next.js App Router, Tailwind, Drizzle config, env wiring, CI lint." },
    { "name": "Internationalization", "kind": "internationalization", "tier": 0, "summary": "next-intl with en + fr; messages/{locale}.json; locale stored per user." },
    { "name": "Authentication", "kind": "feature", "tier": 0, "summary": "NextAuth email sign-in; one page per user on first login.", "interfaces": ["/api/auth/[...nextauth]"], "entities": ["users"] },
    { "name": "Link Editor", "kind": "feature", "tier": 1, "summary": "Add, edit, and drag-reorder links on the owner's page.", "interfaces": ["links.create", "links.reorder"], "entities": ["pages", "links"] },
    { "name": "Public Page & Click Tracking", "kind": "feature", "tier": 1, "summary": "Render the public page by handle and count link clicks.", "interfaces": ["/[handle]", "links.trackClick"], "entities": ["pages", "links"] },
    { "name": "Documentation", "kind": "documentation", "tier": 2, "summary": "README, deployment guide, and CONTEXT for contributors." }
  ],
  "glossary": [
    { "term": "Page", "definition": "The single public profile a user owns, addressed by their handle.", "avoid": ["site", "profile"] },
    { "term": "Handle", "definition": "The unique URL slug that resolves to a user's Page.", "avoid": ["username", "slug"] },
    { "term": "Link", "definition": "One outbound entry on a Page, with a label, URL, and click count.", "avoid": ["button", "item"] }
  ],
  "decisions": [
    { "title": "Drizzle ORM over Prisma", "context": "Need a typed Postgres layer with lightweight migrations.", "decision": "Use Drizzle ORM with drizzle-kit.", "why": "Closer-to-SQL queries and TypeScript types without a separate generation step." },
    { "title": "One page per user", "context": "Link-in-bio is inherently single-page per identity.", "decision": "Model a strict 1-1 users↔pages relation rather than allowing multiple pages.", "why": "Keeps handles, themes, and analytics unambiguous; multi-page can be added later without a migration of the public URL." }
  ],
  "tdd": false
}
```

## How it renders

| Plan section | Output it produces |
| --- | --- |
| `project` | `repoName`; `00-overview/PRD.md` product summary (summary/audience/value) |
| `stack` / `dependencies` / `envVars` | `00-overview` tech-stack; `architecture/ARCHITECTURE.md` deps; `REBUILD.md` env-var checklist |
| `i18n.locales` | Internationalization feature; `00-overview` locale count; `ARCHITECTURE.md` i18n line |
| `dataModel` | `architecture/DATA-MODEL.md` **pre-filled** entity tables; relations seed `CONTEXT.md` |
| `interfaces` | `architecture/INTERFACES.md` **pre-filled** table |
| `designSystem` | `architecture/DESIGN-SYSTEM.md` **pre-filled** (tokens, theming, typography, breakpoints, iconography, motion, components, a11y) |
| `features` | `features/NN-<slug>/PRD.md` (tiered foundations → features → docs); build order in `REBUILD.md` |
| `glossary` | `CONTEXT.md` Language section — see [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md) |
| `decisions` | `docs/adr/NNNN-<slug>.md`, one terse ADR each — see [ADR-FORMAT.md](./ADR-FORMAT.md) |

`CONTEXT.md` and `docs/adr/` are written **if-absent**, so an agent-authored richer version is
never clobbered, but a bare engine run is still self-contained. `00-overview` links to
`../CONTEXT.md` and `../docs/adr/`.

> A complete worked plan — a small online bookstore (6 features, 7 interfaces, 5 entities, 2 enums,
> 2 services, 2 policies) — lives at [`tests/fixtures/scratch-plan/example.plan.json`](../tests/fixtures/scratch-plan/example.plan.json).
> Read it for a end-to-end example of every section.
