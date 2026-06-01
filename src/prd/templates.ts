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
    "1. Read `architecture/ARCHITECTURE.md` for the overall shape.",
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
    order || "_No features._",
    "",
    "## Procedure",
    "",
    "1. Start with `00-overview/PRD.md` and `architecture/ARCHITECTURE.md`.",
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
    "- [ ] All routes respond as before.",
    "- [ ] All locales present and keys match `data/translations/`.",
    "- [ ] Data schema matches `data/schema/`.",
    "- [ ] Required env vars configured: " +
      (inv.envVars.length ? inv.envVars.map((e) => `\`${e}\``).join(", ") : "_none_") +
      ".",
    "",
  ].join("\n");
}
