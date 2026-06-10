import type {
  EnumDef,
  Entity,
  Feature,
  I18nInfo,
  InterfaceRow,
  Inventory,
  Options,
  Policy,
  ServiceContract,
} from "../types.js";

function agentNote(body: string): string {
  return `> 🧠 **For the AI agent:** ${body}\n`;
}

function metaBlock(inv: Inventory, opts: Options): string {
  return [
    "| Setting | Value |",
    "| --- | --- |",
    `| Mode | \`${opts.mode}\` |`,
    `| Level | \`${opts.level}\` |`,
    `| Fidelity | \`${opts.fidelity}\` |`,
    ...(opts.tdd ? ["| TDD | `on` (build test-first) |"] : []),
    `| Generated with | \`${inv.generatedWith}\` |`,
    "",
  ].join("\n");
}

/** Escape characters that would break a markdown table cell (pipes, newlines). */
function cell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/** Render the interface surface as a filled table (scratch mode pre-fill). */
function filledInterfaceTable(rows: InterfaceRow[]): string {
  const header = [
    "| Method / Trigger | Path / Operation | Kind | Auth | Notes |",
    "| --- | --- | --- | --- | --- |",
  ];
  if (!rows.length) {
    return [...header, "", "_Add one row per operation as the surface takes shape._"].join("\n");
  }
  const body = rows.map(
    (r) =>
      `| ${cell(r.method)} | \`${cell(r.path)}\` | ${cell(r.kind ?? "")} | ${cell(r.auth ?? "")} | ${cell(r.notes ?? "")} |`,
  );
  return [...header, ...body].join("\n");
}

/** Render the data model as filled per-entity tables (scratch mode pre-fill). */
function filledEntityTables(entities: Entity[]): string {
  if (!entities.length) return "_No entities yet — add them as the model takes shape._";
  const parts: string[] = [];
  for (const e of entities) {
    parts.push(`### ${e.entity}`, "", "| Field | Type | Constraints |", "| --- | --- | --- |");
    if (e.fields.length) {
      for (const f of e.fields) {
        parts.push(`| ${cell(f.name)} | ${cell(f.type)} | ${cell(f.constraints ?? "")} |`);
      }
    } else {
      parts.push("| _tbd_ | | |");
    }
    parts.push("");
    if (e.relations?.length) {
      parts.push("Relations:", "");
      for (const r of e.relations) parts.push(`- ${r}`);
      parts.push("");
    }
    if (e.indexes?.length) {
      parts.push("Indexes:", "");
      for (const ix of e.indexes) parts.push(`- ${ix}`);
      parts.push("");
    }
    if (e.uniques?.length) {
      parts.push("Unique constraints:", "");
      for (const u of e.uniques) parts.push(`- ${u}`);
      parts.push("");
    }
  }
  return parts.join("\n").trimEnd();
}

/** Render the named domain enums with their full member lists (buildability). */
function enumsBlock(enums: EnumDef[] | undefined): string {
  const lines = ["## Enums & domain types", ""];
  if (!enums || !enums.length) {
    lines.push(
      "_No standalone enums. Every enum-typed field above must still enumerate its full member set inline (e.g. `ADMIN \\| USER`)._",
    );
    return lines.join("\n");
  }
  for (const e of enums) {
    lines.push(`### ${e.name}`, "");
    if (e.description) lines.push(e.description, "");
    lines.push(`- Members: ${e.members.map((m) => `\`${m}\``).join(", ") || "_none — fill in_"}`, "");
  }
  return lines.join("\n").trimEnd();
}

/** Render external-service contracts (scratch pre-fill) for ARCHITECTURE.md. */
function servicesBlock(services: ServiceContract[]): string {
  const lines = ["## External services & integrations", ""];
  for (const s of services) {
    lines.push(`### ${s.name}${s.provider ? ` (${s.provider})` : ""}`, "", s.purpose, "");
    if (s.operations?.length) {
      lines.push("Operations:", "");
      for (const op of s.operations) {
        lines.push(
          `- \`${op.name}\`${op.input ? ` — in: ${op.input}` : ""}${op.output ? ` → out: ${op.output}` : ""}`,
        );
      }
      lines.push("");
    }
    if (s.request) lines.push(`- **Request:** ${s.request}`);
    if (s.response) lines.push(`- **Response:** ${s.response}`);
    if (s.timeout) lines.push(`- **Timeout:** ${s.timeout}`);
    if (s.onFailure) lines.push(`- **On failure:** ${s.onFailure}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

/** Render cross-cutting policies (rate limits, validations) for ARCHITECTURE.md. */
function policiesBlock(policies: Policy[]): string {
  const lines = ["## Cross-cutting policies", "", "| Policy | Kind | Rule | Applies to |", "| --- | --- | --- | --- |"];
  for (const p of policies) {
    lines.push(
      `| ${cell(p.name)} | ${cell(p.kind ?? "")} | ${cell(p.rule)} | ${cell((p.appliesTo ?? []).join(", "))} |`,
    );
  }
  return lines.join("\n");
}

/** Render the i18n message catalog (namespaces + keys with source strings). */
function messageCatalogBlock(i18n: I18nInfo): string {
  const m = i18n.messages;
  const lines = ["## Internationalization — message catalog", ""];
  lines.push(`Locales: ${i18n.locales.join(", ")}.`, "");
  if (!m) {
    lines.push(
      agentNote(
        "Author the message catalog: list every namespace and every user-facing key with its source string, then translate into all locales above. A key without a source string is not buildable.",
      ),
    );
    return lines.join("\n").trimEnd();
  }
  if (m.sourceLocale) lines.push(`Source locale: \`${m.sourceLocale}\`.`, "");
  if (m.namespaces?.length) lines.push(`Namespaces: ${m.namespaces.map((n) => `\`${n}\``).join(", ")}.`, "");
  if (m.entries?.length) {
    lines.push("| Key | Source string |", "| --- | --- |");
    for (const e of m.entries) lines.push(`| \`${cell(e.key)}\` | ${cell(e.source ?? "")} |`);
    lines.push("");
  }
  lines.push(
    agentNote(
      `Complete the catalog: every user-facing key must have a source string and resolve in all ${i18n.locales.length} locales (${i18n.locales.join(", ")}). The keys above are the contract — extend, don't trim.`,
    ),
  );
  return lines.join("\n").trimEnd();
}

/** Render per-operation contracts (input/output/side-effects) when pre-filled. */
function operationContracts(rows: InterfaceRow[]): string {
  const detailed = rows.filter((r) => r.input || r.output || (r.sideEffects && r.sideEffects.length));
  if (!detailed.length) return "";
  const lines = ["## Operation contracts", ""];
  for (const r of detailed) {
    lines.push(`### \`${r.path}\`${r.auth ? ` · auth: ${r.auth}` : ""}`, "");
    if (r.input) lines.push(`- **Input:** ${r.input}`);
    if (r.output) lines.push(`- **Output:** ${r.output}`);
    if (r.sideEffects?.length) lines.push(`- **Side effects:** ${r.sideEffects.join("; ")}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

export function overviewPrd(inv: Inventory, opts: Options): string {
  const isScratch = opts.mode === "scratch";
  const s = inv.stack;
  const featureIndex = inv.features
    .map((f) => `- [\`${f.slug}\`](../features/${f.slug}/PRD.md) — **${f.name}**: ${f.description}`)
    .join("\n");

  const productSummary = isScratch
    ? [
        inv.product?.summary ?? "",
        ...(inv.product?.audience ? ["", `**Audience:** ${inv.product.audience}`] : []),
        ...(inv.product?.value ? ["", `**Core value:** ${inv.product.value}`] : []),
        "",
        agentNote(
          "Expand this into a 1–2 paragraph product summary grounded in `../CONTEXT.md` (the glossary) and the feature list below.",
        ),
      ].join("\n")
    : opts.level === "complex"
      ? agentNote(
          "Write a 1–2 paragraph product summary: what this project does, for whom, and the core value. Infer it from the README, routes, and feature names below, then refine.",
        )
      : "_Summarize what this project does, derived from the README and the feature list below._";

  const out: string[] = [
    `# ${inv.repoName} — Reconstruction Overview`,
    "",
    metaBlock(inv, opts),
    "## Product summary",
    "",
    productSummary,
    "",
    "## Tech stack",
    "",
    `- **Primary language:** ${s.primaryLanguage}`,
    `- **Languages:** ${s.languages.join(", ") || "n/a"}`,
    `- **Frameworks:** ${s.frameworks.join(", ") || "none detected"}`,
    `- **Libraries:** ${s.libraries.join(", ") || "none detected"}`,
    `- **Package managers:** ${s.packageManagers.join(", ") || "n/a"}`,
    `- **TypeScript:** ${s.hasTypeScript ? "yes" : "no"}`,
    "",
    "## Metrics",
    "",
    isScratch
      ? `- Files: **0** — greenfield (designed from the interview, not read from source)`
      : `- Files analyzed: **${inv.fileCount}** (${inv.totalLines} lines)`,
    `- Features/modules: **${inv.features.length}**`,
    `- Routes: **${inv.routes.length}**`,
    `- Locales: **${inv.i18n ? inv.i18n.locales.length : 0}**`,
    `- Tracked env vars: **${inv.envVars.length}**`,
    "",
    "## Feature index",
    "",
    featureIndex || "_No features detected._",
    "",
    "## How to use this output",
    "",
    ...(isScratch
      ? [
          "1. Read `../CONTEXT.md` (the glossary) and the decisions in `../docs/adr/` — they are the ground truth for terminology and constraints.",
          "2. Read `architecture/ARCHITECTURE.md`, then the pre-filled `architecture/INTERFACES.md` and `architecture/DATA-MODEL.md` (refine them).",
          "3. Build feature by feature using each `features/<slug>/PRD.md`, in the order listed in `REBUILD.md`.",
        ]
      : [
          "1. Read `architecture/ARCHITECTURE.md` for the overall shape, then `architecture/INTERFACES.md` (the full interface surface) and `architecture/DATA-MODEL.md` (entities & relations).",
          "2. Rebuild feature by feature using each `features/<slug>/PRD.md`, in the order listed in `REBUILD.md`.",
          "3. Use `data/` (translations, schema, config) and — when present — `source/` as ground truth.",
        ]),
    "",
  ];

  if (opts.mode === "redesign") {
    out.push(
      "## Redesign note",
      "",
      agentNote(
        "This run is in **redesign** mode: preserve every feature's behavior and logic, but you are free to propose a cleaner architecture in `architecture/ARCHITECTURE.md`.",
      ),
      "",
    );
  }

  return out.join("\n");
}

function workspacesBlock(workspaces: NonNullable<Inventory["workspaces"]>): string {
  const rows = workspaces.map((w) => {
    const stack = [
      ...(w.stack?.frameworks ?? []),
      ...(w.stack?.frameworks?.length ? [] : [w.stack?.primaryLanguage ?? "—"]),
    ].join(", ");
    return `| \`${w.name}\` | \`${w.path}/\` | ${w.kind ?? "—"} | ${stack || "—"} | ${
      w.dependsOn?.map((d) => `\`${d}\``).join(", ") || "—"
    } | ${w.routeCount ?? 0} |`;
  });
  return [
    "## Workspaces",
    "",
    "| Workspace | Path | Kind | Stack | Depends on | Routes |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    agentNote(
      "Verify each workspace's role (app / package / service) and **extend the dependency graph**: the `Depends on` column carries manifest-declared edges only — add the implicit ones (HTTP calls between apps, generated clients, shared env vars, queues) and draw the result in `diagram.md`. Map each shared package once and reference it from the apps that consume it.",
    ),
  ].join("\n");
}

export function architectureDoc(inv: Inventory, opts: Options): string {
  const isScratch = opts.mode === "scratch";
  const topDirs = [
    ...new Set(inv.files.filter((f) => f.path.includes("/")).map((f) => f.path.split("/")[0])),
  ].sort();
  const rootFiles = inv.files.filter((f) => !f.path.includes("/")).map((f) => f.path).sort();
  const deps = inv.dependencies
    .map((d) => `- **${d.manager}** (\`${d.manifest}\`): ${Object.keys(d.runtime).length} runtime, ${Object.keys(d.dev).length} dev`)
    .join("\n");

  const common: string[] = [
    `# Architecture`,
    "",
    metaBlock(inv, opts),
    "## Detected stack",
    "",
    `${inv.stack.frameworks.join(", ") || "No framework detected"} · ${inv.stack.primaryLanguage}`,
    "",
    ...(inv.stack.libraries.length ? [`**Libraries:** ${inv.stack.libraries.join(", ")}`, ""] : []),
    "## Top-level layout",
    "",
    (topDirs.map((d) => `- \`${d}/\``).join("\n") || "_Flat layout (no subdirectories)._") +
      (rootFiles.length ? `\n- root files: ${rootFiles.map((f) => `\`${f}\``).join(", ")}` : ""),
    "",
    ...(inv.workspaces?.length ? [workspacesBlock(inv.workspaces), ""] : []),
    "## Dependencies",
    "",
    deps || "_No dependency manifests found._",
    "",
    "## Data & schema",
    "",
    inv.schemas.length ? inv.schemas.map((s) => `- \`${s}\``).join("\n") : "_No schema/model files detected._",
    "",
    "## Internationalization",
    "",
    inv.i18n
      ? isScratch
        ? `Locales: ${inv.i18n.locales.join(", ")} — provide a messages file per locale (see the message catalog below).`
        : `Locales: ${inv.i18n.locales.join(", ")} — files copied to \`data/translations/\`.`
      : "_No i18n detected._",
    "",
    // External services & cross-cutting policies — rendered from the plan in
    // scratch mode, demanded via callouts otherwise. Both are buildability gaps
    // when left implicit (a named "geocoding" with no contract isn't rebuildable).
    ...(isScratch && inv.services?.length
      ? [servicesBlock(inv.services), ""]
      : [
          "## External services & integrations",
          "",
          agentNote(
            "List **every** external service the project calls (payment, email, geocoding, storage, analytics, queues, third-party APIs). For each: provider, the exact request/response shape, timeout, and what happens on failure (best-effort? hard error?). Naming the service is not enough — capture the contract.",
          ),
          "",
        ]),
    ...(isScratch && inv.policies?.length
      ? [policiesBlock(inv.policies), ""]
      : [
          "## Cross-cutting policies",
          "",
          agentNote(
            "Capture every cross-cutting rule that is otherwise left vague: rate limits (exact thresholds, window, key, store), format validations (e.g. national registry numbers — give the regex/checksum/length), and security policies. Each rule must be concrete enough to write a test against.",
          ),
          "",
        ]),
    ...(isScratch && inv.i18n ? [messageCatalogBlock(inv.i18n), ""] : []),
  ];

  if (isScratch) {
    common.push(
      "## Architecture (greenfield)",
      "",
      agentNote(
        "Design the architecture that delivers the features below. Decide module boundaries, data flow, and folder structure. Ground every decision in `../CONTEXT.md` (the glossary) and the ADRs in `../docs/adr/`. Document the proposed structure here as a directory tree plus a short rationale per module.",
      ),
      "",
    );
    if (opts.level === "complex") {
      common.push(
        agentNote(
          "Also sketch 1–2 alternative architectures you considered and why you rejected them, and note enhancements beyond the MVP that the structure should leave room for.",
        ),
        "",
      );
    }
  } else if (opts.mode === "preserve") {
    common.push(
      "## Reconstruction guidance (preserve)",
      "",
      "Reproduce the structure above as-is. Keep the same directory layout, framework, routing strategy, and data layer.",
      "",
    );
    if (opts.level === "complex") {
      common.push(
        agentNote(
          "While preserving the architecture, list any low-risk, high-value improvements (typing, error handling, test coverage) the rebuild should fold in.",
        ),
        "",
      );
    }
  } else {
    common.push(
      "## Proposed architecture (redesign)",
      "",
      agentNote(
        "Design a fresh architecture that delivers the SAME features and logic. Decide module boundaries, data flow, and folder structure. Justify changes against the detected stack above. Keep behavior identical; improve structure, testability, and clarity.",
      ),
      "",
      "Document the proposed structure here as a directory tree plus a short rationale per module.",
      "",
    );
  }

  return common.join("\n");
}

function listOrNone(items: string[], empty: string): string {
  return items.length ? items.map((s) => `- \`${s}\``).join("\n") : empty;
}

export function interfacesDoc(inv: Inventory, opts: Options): string {
  if (opts.mode === "scratch") {
    return [
      "# Interface surface",
      "",
      metaBlock(inv, opts),
      agentNote(
        "Design the complete interface surface from the interview & `../CONTEXT.md`. The table below is pre-filled from the plan — keep the columns, refine each row, and add any operation that's missing (HTTP routes, REST/JSON endpoints, tRPC/gRPC procedures, GraphQL operations, CLI commands, scheduled jobs, queues, webhooks).",
      ),
      "",
      "## Interface table",
      "",
      filledInterfaceTable(inv.interfaces ?? []),
      "",
      ...(operationContracts(inv.interfaces ?? [])
        ? [operationContracts(inv.interfaces ?? []), ""]
        : []),
      agentNote(
        "Every operation needs an exact contract before it is buildable: the input shape (fields + types + validation), the output shape, the auth/permission rule, and the side effects (which entities it writes — and whether the write is transactional). Spell these out per operation; link shapes to `DATA-MODEL.md`.",
      ),
      "",
    ].join("\n");
  }

  const routesTable = inv.routes.length
    ? [
        "| Method | Kind | Route | Handler file |",
        "| --- | --- | --- | --- |",
        ...inv.routes.map((r) => `| ${r.method ?? "—"} | ${r.kind} | \`${r.route}\` | \`${r.file}\` |`),
      ].join("\n")
    : "_None resolved deterministically — read the candidate files below to map the surface._";

  const routeCandidates = new Set([...inv.hints.routeCandidates]);
  for (const r of inv.routes) routeCandidates.delete(r.file); // don't repeat resolved handlers

  return [
    "# Interface surface",
    "",
    metaBlock(inv, opts),
    agentNote(
      "Enumerate **every** interface this project exposes — HTTP routes, REST/JSON endpoints, " +
        "tRPC/gRPC procedures, GraphQL operations, CLI commands, scheduled jobs, queues, and webhooks. " +
        "The deterministic engine resolves routes for the supported frameworks (Next.js, Express, Flask, " +
        "FastAPI, NestJS, Django, Rails, Go); for everything else, **read the " +
        "candidate files below** and follow `references/analysis-playbook.md` (§Interface surface) plus the " +
        "matching guide in `references/stack-guides/`. Fill the target table with one row per operation.",
    ),
    "",
    "## Resolved routes (deterministic — verify against source)",
    "",
    routesTable,
    "",
    "## Route candidates (verify — may include false positives)",
    "",
    listOrNone([...routeCandidates].sort(), "_No additional route candidates._"),
    "",
    "## API surface candidates (tRPC / GraphQL / gRPC / OpenAPI)",
    "",
    listOrNone(inv.hints.apiCandidates, "_No RPC/GraphQL/OpenAPI candidates detected._"),
    "",
    "## Interface table (fill this in)",
    "",
    "| Method / Trigger | Path / Operation | Kind | Handler file | Auth | Notes |",
    "| --- | --- | --- | --- | --- | --- |",
    "",
    opts.level === "light"
      ? "_Keep these columns; add one row per route / endpoint / procedure / command / job. Cover the whole surface, not just the candidates above._"
      : agentNote(
          "Keep these columns; add a row per operation. Note auth/permission requirements, input/output shapes (link to `DATA-MODEL.md`), and side effects.",
        ),
    "",
  ].join("\n");
}

export function dataModelDoc(inv: Inventory, opts: Options): string {
  if (opts.mode === "scratch") {
    return [
      "# Data model",
      "",
      metaBlock(inv, opts),
      agentNote(
        "Design the complete data model from the interview & `../CONTEXT.md`. The entities below are pre-filled from the plan — refine fields, types, constraints, and relations, and add anything missing. Capture primary keys, foreign keys, enums, defaults, and indexes.",
      ),
      "",
      "## Entities",
      "",
      filledEntityTables(inv.dataModel ?? []),
      "",
      "## Relations & integrity",
      "",
      "_Summarize relationships, cascade rules, and any derived/computed data._",
      "",
      enumsBlock(inv.enums),
      "",
    ].join("\n");
  }

  const schemaFiles = [...new Set([...inv.schemas, ...inv.hints.schemaCandidates])].sort();

  return [
    "# Data model",
    "",
    metaBlock(inv, opts),
    agentNote(
      "Reconstruct the data model from the schema/ORM files below (raw copies live in `data/schema/`). " +
        "List **every** entity/table with its key fields + types, relations (1-1 / 1-N / N-N), and indexes/constraints. " +
        "Follow `references/analysis-playbook.md` (§Data model) and the ORM conventions in the matching `references/stack-guides/`.",
    ),
    "",
    "## Schema / model source files",
    "",
    listOrNone(schemaFiles, "_No schema/model files detected — the data layer may be code-defined; investigate `hints`._"),
    "",
    "## Entities (fill this in)",
    "",
    "| Entity / Table | Field | Type | Constraints | Relation |",
    "| --- | --- | --- | --- | --- |",
    "",
    opts.level === "light"
      ? "_Keep these columns; one block of rows per entity. Capture primary keys, foreign keys, enums, defaults, and indexes._"
      : agentNote(
          "Keep these columns; for each entity capture fields + types, PK/FK, enums, defaults, indexes, and how it maps to the interfaces in `INTERFACES.md`.",
        ),
    "",
    "## Relations & integrity",
    "",
    "_Summarize relationships, cascade rules, and any derived/computed data._",
    "",
    "## Enums & domain types",
    "",
    agentNote(
      "Enumerate **every** domain enum / fixed value set this schema uses — each with its **complete** member list (e.g. roles, statuses, categories). A field typed `enum`/`status`/`type` whose members are not listed here is not buildable: a fresh agent cannot validate it or write the test.",
    ),
    "",
  ].join("\n");
}

export function diagramDoc(inv: Inventory): string {
  const nodes = inv.features
    .map((f, i) => `  F${i}["${f.name}"]`)
    .join("\n");
  const dataNode = inv.i18n || inv.schemas.length ? '  DATA[("Data / i18n / schema")]' : "";
  const edges = inv.features
    .filter((f) => f.kind === "feature")
    .map((f, i) => (inv.i18n ? `  F${i} --> DATA` : ""))
    .filter(Boolean)
    .join("\n");

  const workspaceGraph = inv.workspaces?.length
    ? [
        "",
        "## Workspace graph",
        "",
        "Manifest-declared dependencies between workspaces (verify and extend with implicit edges).",
        "",
        "```mermaid",
        "graph TD",
        ...inv.workspaces.map((w, i) => `  W${i}["${w.name}"]`),
        ...inv.workspaces.flatMap((w, i) =>
          (w.dependsOn ?? []).map((dep) => {
            const j = inv.workspaces?.findIndex((x) => x.name === dep) ?? -1;
            return j >= 0 ? `  W${i} --> W${j}` : "";
          }),
        ).filter(Boolean),
        "```",
        "",
      ]
    : [""];

  return [
    "# Module diagram",
    "",
    "```mermaid",
    "graph TD",
    nodes,
    dataNode,
    edges,
    "```",
    ...workspaceGraph,
  ].join("\n");
}

export function featurePrd(
  inv: Inventory,
  feature: Feature,
  opts: Options,
  sourceMarkdown: string,
): string {
  const isScratch = opts.mode === "scratch";
  // Where the agent gets its ground truth, phrased per mode.
  const truth = isScratch
    ? "the interview & `../../CONTEXT.md`"
    : "the source material below";

  const out: string[] = [
    `# ${feature.name}`,
    "",
    `> Unit \`${feature.slug}\` · kind: ${feature.kind}`,
    "",
    "## Summary",
    "",
    feature.description,
    "",
    "## Context & goal",
    "",
    agentNote(
      `State this unit's user-facing goal in 1–2 sentences (the outcome a user gets), and name the other units it depends on and that depend on it. Derive it from ${truth}.`,
    ),
    "",
    "## User stories",
    "",
    agentNote(
      "Enumerate **every** actor and what they need, one line each — `As a <role>, I can <action> so that <value>.` Be **exhaustive**: cover every role and every distinct behaviour, not just the happy path. This list is the backbone of the PRD; nothing below should exist without a story above it.",
    ),
    "",
    "## Functional requirements",
    "",
    agentNote(
      `Turn the stories into a **numbered** checklist of precise, testable behaviours, derived from ${truth}. Cover happy paths, every edge case, every validation rule, and every error state. Leave nothing as "etc." or "and so on" — if you write a placeholder, you are not done.`,
    ),
    "",
  ];

  if (feature.routes.length) {
    out.push("## Routes", "", "| Method | Route | Kind | File |", "| --- | --- | --- | --- |");
    for (const r of feature.routes) {
      out.push(`| ${r.method ?? "—"} | \`${r.route}\` | ${r.kind} | \`${r.file}\` |`);
    }
    out.push("");
  }

  // Interfaces & data this unit touches — pre-seeded in scratch mode.
  out.push("## Interfaces & data", "");
  if (feature.interfaces?.length) {
    out.push(`- **Operations:** ${feature.interfaces.map((i) => `\`${i}\``).join(", ")}`);
  }
  if (feature.entities?.length) {
    out.push(`- **Entities:** ${feature.entities.map((e) => `\`${e}\``).join(", ")}`);
  }
  if (feature.writes?.length) {
    out.push(`- **Writes:** ${feature.writes.map((e) => `\`${e}\``).join(", ")}`);
  }
  if (feature.interfaces?.length || feature.entities?.length || feature.writes?.length) out.push("");
  out.push(
    agentNote(
      "List **every** operation this unit exposes with its input/output shape (link `../../architecture/INTERFACES.md`), and **every** entity it reads or writes (link `../../architecture/DATA-MODEL.md`). Spell out the **write contract** for each mutation: which entities are written, whether the write is transactional, and — for every required (NOT NULL, no-default) column and foreign key — where the value comes from. A public/anonymous operation cannot satisfy an owner foreign key: it must write to an anonymous-capable entity instead. Every enum/domain value it accepts must be one of the members enumerated in `DATA-MODEL.md`.",
    ),
    "",
    "## Acceptance criteria",
    "",
    agentNote(
      "Write **Given / When / Then** scenarios that gate \"done\" — at least one per functional requirement, **including** the failure paths. Example: `Given an unauthenticated visitor, When they POST a todo, Then the API responds 401 and writes nothing.` These scenarios are the spec the rebuild is verified against.",
    ),
    "",
    "## Edge cases & failure modes",
    "",
    agentNote(
      "Enumerate what can go wrong and the expected behaviour for each: invalid / empty / oversized input, auth & permission failures, concurrency / race conditions, missing or slow dependencies, partial failures, and idempotency / retries. Each row here should map to an error-path requirement above.",
    ),
    "",
  );

  if (opts.tdd) {
    out.push(
      "## Test plan (write these first)",
      "",
      agentNote(
        "Before writing any implementation, turn the functional requirements and acceptance criteria above into failing tests (red): one per behaviour — happy paths, edge cases, validation, and error states. Implement only enough to make them pass (green), then refactor. List the test cases here as a checklist.",
      ),
      "",
    );
  }

  if (isScratch) {
    out.push(
      "## Design inputs",
      "",
      agentNote(
        "Build this unit greenfield. Ground every decision in `../../CONTEXT.md` (the glossary), the operations in `../../architecture/INTERFACES.md`, and the entities in `../../architecture/DATA-MODEL.md`.",
      ),
      "",
    );
  } else {
    out.push("## Source material", "", sourceMarkdown, "");
  }

  if (opts.level === "complex") {
    out.push(
      isScratch ? "## Enhancements & alternatives" : "## Improvements & refactors",
      "",
      isScratch
        ? agentNote(
            "Propose enhancements beyond the MVP for this unit and note any alternative approaches worth considering, each marked `[post-MVP]` so the core build stays lean.",
          )
        : agentNote(
            "Propose concrete improvements for this unit: better types, dead-code removal, performance, accessibility, security, and tests. Mark each as `[keep-behavior]` so the rebuild stays functionally identical unless the user opts in.",
          ),
      "",
    );
  }
  if (opts.mode === "redesign") {
    out.push(
      "## Redesign notes",
      "",
      agentNote(
        "Map this unit onto the new architecture from `architecture/ARCHITECTURE.md`. Note where its files should live and which interfaces it exposes.",
      ),
      "",
    );
  }

  out.push(
    "## Definition of done",
    "",
    "- [ ] Every functional requirement is implemented and covered by a test.",
    "- [ ] Every acceptance-criteria scenario passes (including the failure paths).",
    "- [ ] Every operation this unit owns in `architecture/INTERFACES.md` responds correctly.",
    "- [ ] Every entity it writes matches `architecture/DATA-MODEL.md` (fields, types, constraints).",
    "- [ ] Every write is satisfiable against the schema: no required (NOT NULL, no-default) column or foreign key is left unfilled; anonymous/public operations write only to anonymous-capable entities (no owner FK).",
    "- [ ] Every enum/domain value this unit uses is one of the members fully enumerated in `architecture/DATA-MODEL.md`.",
    "- [ ] Every edge case & failure mode above is handled.",
    ...(inv.i18n
      ? [
          "- [ ] Every user-facing string has a source string in the message catalog and resolves in every locale (no missing keys, no hard-coded copy).",
        ]
      : []),
    "- [ ] `node scripts/analyze.mjs --check --out <out>` passes — no unresolved agent callouts or placeholders, and every reference resolves.",
    "",
  );

  return out.join("\n");
}

export function rebuildDoc(inv: Inventory, opts: Options): string {
  const isScratch = opts.mode === "scratch";
  const order = inv.features
    .map((f, i) => `${i + 1}. [ ] **${f.name}** → \`features/${f.slug}/PRD.md\``)
    .join("\n");

  const modeBlurb =
    opts.mode === "preserve"
      ? "keep the current architecture"
      : isScratch
        ? "build the project from the interview/plan (greenfield)"
        : "design a new architecture for the same features";

  const procedure: string[] = [
    isScratch
      ? "1. Read `00-overview/PRD.md`, `CONTEXT.md` (the glossary), and the decisions in `docs/adr/`, then `architecture/ARCHITECTURE.md`, `architecture/INTERFACES.md`, and `architecture/DATA-MODEL.md`."
      : "1. Start with `00-overview/PRD.md`, `architecture/ARCHITECTURE.md`, `architecture/INTERFACES.md`, and `architecture/DATA-MODEL.md`.",
    opts.tdd
      ? "2. For each unit in order: write its failing acceptance tests first (red), implement until they pass (green), then refactor."
      : "2. For each unit in order, open its PRD and implement it.",
    isScratch
      ? "3. Ground terminology and decisions in `CONTEXT.md` and `docs/adr/`; cross-reference `INTERFACES.md` and `DATA-MODEL.md`."
      : "3. Wire shared data from `data/` (translations, schema, config).",
    opts.fidelity === "mirror"
      ? "4. Use the copied files under `source/<slug>/` as ground truth."
      : "4. Validate behavior against the requirements in each PRD.",
    isScratch
      ? "5. Run your test suite, typecheck, and linter to verify each unit before moving on."
      : "5. Run the project's own scripts to verify: " +
        (Object.keys(inv.scripts).length
          ? Object.keys(inv.scripts).slice(0, 6).map((s) => `\`${s}\``).join(", ")
          : "_no scripts detected_") +
        ".",
  ];

  const checklist: string[] = [
    "- [ ] Every interface in `architecture/INTERFACES.md` is implemented (routes, endpoints, RPC/GraphQL, jobs).",
    isScratch
      ? "- [ ] Every entity in `architecture/DATA-MODEL.md` exists with its fields, relations, and constraints."
      : "- [ ] Data model matches `architecture/DATA-MODEL.md` and `data/schema/`.",
    isScratch
      ? "- [ ] All routes/operations respond per `architecture/INTERFACES.md`."
      : "- [ ] All routes respond as before.",
    ...(inv.i18n
      ? [
          isScratch
            ? "- [ ] All locales present, each with its own messages file."
            : "- [ ] All locales present and keys match `data/translations/`.",
        ]
      : []),
    ...(opts.tdd
      ? ["- [ ] Tests were written before implementation for each unit (red → green → refactor)."]
      : []),
    "- [ ] Required env vars configured: " +
      (inv.envVars.length ? inv.envVars.map((e) => `\`${e}\``).join(", ") : "_none_") +
      ".",
  ];

  return [
    `# REBUILD — ${inv.repoName}`,
    "",
    metaBlock(inv, opts),
    isScratch
      ? "This folder is a complete plan to build the project from scratch."
      : "This folder is a complete plan to rebuild the project from scratch.",
    "",
    "## Mode & level",
    "",
    `- **${opts.mode}**: ${modeBlurb}.`,
    `- **${opts.level}**: ${opts.level === "light" ? "faithful, minimal-editorializing PRDs" : "PRDs that also suggest improvements to fold in"}.`,
    `- **${opts.fidelity}** fidelity: ${
      opts.fidelity === "mirror"
        ? "real files copied under `source/`"
        : opts.fidelity === "embed"
          ? "key code embedded directly in the PRDs"
          : "descriptive PRDs only — build from requirements"
    }.`,
    ...(opts.tdd ? ["- **TDD**: each unit is built test-first (red → green → refactor)."] : []),
    "",
    "## Build order",
    "",
    "Ordered by dependency tier — foundations (types, data, shared UI, i18n, cross-cutting) first, feature pages next, tests & docs last." +
      (inv.workspaces?.length
        ? " The outer tier is the workspace topological order: shared packages build before the apps that consume them."
        : ""),
    "",
    order || "_No features._",
    "",
    "## Procedure",
    "",
    ...procedure,
    "",
    "## Validation checklist",
    "",
    ...checklist,
    "",
  ].join("\n");
}
