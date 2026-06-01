import type { Feature, Inventory, Options } from "../types.js";

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
    `| Generated with | \`${inv.generatedWith}\` |`,
    "",
  ].join("\n");
}

export function overviewPrd(inv: Inventory, opts: Options): string {
  const s = inv.stack;
  const featureIndex = inv.features
    .map((f) => `- [\`${f.slug}\`](../features/${f.slug}/PRD.md) — **${f.name}**: ${f.description}`)
    .join("\n");

  const out: string[] = [
    `# ${inv.repoName} — Reconstruction Overview`,
    "",
    metaBlock(inv, opts),
    "## Product summary",
    "",
    opts.level === "complex"
      ? agentNote(
          "Write a 1–2 paragraph product summary: what this project does, for whom, and the core value. Infer it from the README, routes, and feature names below, then refine.",
        )
      : "_Summarize what this project does, derived from the README and the feature list below._",
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
    `- Files analyzed: **${inv.fileCount}** (${inv.totalLines} lines)`,
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
    "1. Read `architecture/ARCHITECTURE.md` for the overall shape, then `architecture/INTERFACES.md` (the full interface surface) and `architecture/DATA-MODEL.md` (entities & relations).",
    "2. Rebuild feature by feature using each `features/<slug>/PRD.md`, in the order listed in `REBUILD.md`.",
    "3. Use `data/` (translations, schema, config) and — when present — `source/` as ground truth.",
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

export function architectureDoc(inv: Inventory, opts: Options): string {
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
      ? `Locales: ${inv.i18n.locales.join(", ")} — files copied to \`data/translations/\`.`
      : "_No i18n detected._",
    "",
  ];

  if (opts.mode === "preserve") {
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
  const routesTable = inv.routes.length
    ? [
        "| Kind | Route | Handler file |",
        "| --- | --- | --- |",
        ...inv.routes.map((r) => `| ${r.kind} | \`${r.route}\` | \`${r.file}\` |`),
      ].join("\n")
    : "_None resolved deterministically (the engine only resolves Next.js file-based routes)._";

  const routeCandidates = new Set([...inv.hints.routeCandidates]);
  for (const r of inv.routes) routeCandidates.delete(r.file); // don't repeat resolved handlers

  return [
    "# Interface surface",
    "",
    metaBlock(inv, opts),
    agentNote(
      "Enumerate **every** interface this project exposes — HTTP routes, REST/JSON endpoints, " +
        "tRPC/gRPC procedures, GraphQL operations, CLI commands, scheduled jobs, queues, and webhooks. " +
        "The deterministic engine only resolves Next.js file-based routes; for everything else, **read the " +
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

  return [
    "# Module diagram",
    "",
    "```mermaid",
    "graph TD",
    nodes,
    dataNode,
    edges,
    "```",
    "",
  ].join("\n");
}

export function featurePrd(
  inv: Inventory,
  feature: Feature,
  opts: Options,
  sourceMarkdown: string,
): string {
  const out: string[] = [
    `# ${feature.name}`,
    "",
    `> Unit \`${feature.slug}\` · kind: ${feature.kind}`,
    "",
    "## Summary",
    "",
    feature.description,
    "",
    "## Functional requirements",
    "",
    opts.level === "complex"
      ? agentNote(
          "Derive precise, testable functional requirements for this unit from the source material below. Cover happy paths, edge cases, validation, and error states.",
        )
      : "_Describe what this unit must do, as a checklist of behaviors, based on the source below._",
    "",
  ];

  if (feature.routes.length) {
    out.push("## Routes", "", "| Route | Kind | File |", "| --- | --- | --- |");
    for (const r of feature.routes) {
      out.push(`| \`${r.route}\` | ${r.kind} | \`${r.file}\` |`);
    }
    out.push("");
  }

  out.push("## Source material", "", sourceMarkdown, "");

  if (opts.level === "complex") {
    out.push(
      "## Improvements & refactors",
      "",
      agentNote(
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

  return out.join("\n");
}

export function rebuildDoc(inv: Inventory, opts: Options): string {
  const order = inv.features
    .map((f, i) => `${i + 1}. [ ] **${f.name}** → \`features/${f.slug}/PRD.md\``)
    .join("\n");

  return [
    `# REBUILD — ${inv.repoName}`,
    "",
    metaBlock(inv, opts),
    "This folder is a complete plan to rebuild the project from scratch.",
    "",
    "## Mode & level",
    "",
    `- **${opts.mode}**: ${opts.mode === "preserve" ? "keep the current architecture" : "design a new architecture for the same features"}.`,
    `- **${opts.level}**: ${opts.level === "light" ? "faithful, minimal-editorializing PRDs" : "PRDs that also suggest improvements to fold in"}.`,
    `- **${opts.fidelity}** fidelity: ${
      opts.fidelity === "mirror"
        ? "real files copied under `source/`"
        : opts.fidelity === "embed"
          ? "key code embedded directly in the PRDs"
          : "descriptive PRDs only — rewrite from requirements"
    }.`,
    "",
    "## Build order",
    "",
    "Ordered by dependency tier — foundations (types, data, shared UI, i18n, cross-cutting) first, feature pages next, tests & docs last.",
    "",
    order || "_No features._",
    "",
    "## Procedure",
    "",
    "1. Start with `00-overview/PRD.md`, `architecture/ARCHITECTURE.md`, `architecture/INTERFACES.md`, and `architecture/DATA-MODEL.md`.",
    "2. For each unit in order, open its PRD and implement it.",
    "3. Wire shared data from `data/` (translations, schema, config).",
    opts.fidelity === "mirror"
      ? "4. Use the copied files under `source/<slug>/` as ground truth."
      : "4. Validate behavior against the requirements in each PRD.",
    "5. Run the project's own scripts to verify: " +
      (Object.keys(inv.scripts).length
        ? Object.keys(inv.scripts).slice(0, 6).map((s) => `\`${s}\``).join(", ")
        : "_no scripts detected_") +
      ".",
    "",
    "## Validation checklist",
    "",
    "- [ ] Every interface in `architecture/INTERFACES.md` is implemented (routes, endpoints, RPC/GraphQL, jobs).",
    "- [ ] Data model matches `architecture/DATA-MODEL.md` and `data/schema/`.",
    "- [ ] All routes respond as before.",
    "- [ ] All locales present and keys match `data/translations/`.",
    "- [ ] Required env vars configured: " +
      (inv.envVars.length ? inv.envVars.map((e) => `\`${e}\``).join(", ") : "_none_") +
      ".",
    "",
  ].join("\n");
}
