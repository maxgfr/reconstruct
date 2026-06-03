import type { Artifact, GenerationInfo, Inventory, Options } from "../types.js";

/** A line that could be the *content* of a setext heading (plain prose). */
function isSetextContent(s: string): boolean {
  const t = s.trim();
  return t !== "" && !/^[#>\-*+|=]/.test(t) && !/^\d+[.)]/.test(t);
}

/**
 * Shift every heading in a markdown string down by `by` levels, capped at h6, so
 * an embedded document folds under the bundle's own headings. Handles:
 *  - ATX headings (`## x`), with the standard ≤3-space indent (4-space-indented
 *    `#` lines are code per CommonMark and left alone),
 *  - setext H1 (`Title` underlined with `===`) → converted to ATX so it can't
 *    leak a second top-level H1 into the single-H1 bundle (the ambiguous `---`
 *    underline is left as-is to avoid clashing with thematic breaks),
 *  - fenced code blocks (``` / ~~~) and a leading YAML/TOML front-matter block,
 *    both passed through verbatim so a `#` inside them is never demoted.
 */
export function demoteHeadings(md: string, by = 1): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;

  // Leading front matter (--- … --- or +++ … +++): copy through verbatim.
  const fm = lines[0]?.match(/^(---|\+\+\+)\s*$/);
  if (fm) {
    out.push(lines[0] as string);
    i = 1;
    while (i < lines.length && (lines[i] as string).trim() !== fm[1]) out.push(lines[i++] as string);
    if (i < lines.length) out.push(lines[i++] as string); // closing fence
  }

  let fence: string | null = null;
  for (; i < lines.length; i++) {
    const line = lines[i] as string;
    const fenceMatch = line.match(/^(\s{0,3})(`{3,}|~{3,})/);
    if (fenceMatch?.[2]) {
      const marker = fenceMatch[2].startsWith("`") ? "`" : "~";
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      out.push(line);
      continue;
    }
    if (fence !== null) {
      out.push(line);
      continue;
    }
    // setext H1: a `===` underline directly under a plain-text line.
    if (/^\s{0,3}=+\s*$/.test(line) && out.length && isSetextContent(out[out.length - 1] as string)) {
      const level = Math.min(6, 1 + by);
      out[out.length - 1] = `${"#".repeat(level)} ${(out[out.length - 1] as string).trim()}`;
      continue; // drop the underline
    }
    const h = line.match(/^(\s{0,3})(#{1,6})(\s.*)?$/);
    if (h?.[2]) {
      const hashes = "#".repeat(Math.min(6, h[2].length + by));
      out.push(`${h[1] ?? ""}${hashes}${h[3] ?? ""}`);
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

function generationOf(inv: Inventory, opts: Options): GenerationInfo {
  return (
    inv.generation ?? {
      mode: opts.mode,
      level: opts.level,
      fidelity: opts.fidelity,
      granularity: opts.granularity,
    }
  );
}

function metaLine(inv: Inventory, opts: Options): string {
  const g = generationOf(inv, opts);
  return `> Generated with \`${inv.generatedWith}\` · mode \`${g.mode}\` · level \`${g.level}\` · fidelity \`${g.fidelity}\``;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.md$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface Section {
  relPath: string;
  title: string;
  anchor: string;
}

/** The relPaths the bundle must never inline (it would duplicate or recurse). */
const BUNDLE_EXCLUDE = new Set(["inventory.json", "SUMMARY.md", "RECONSTRUCTION.md"]);

/** Ordered sections of the merged document, built from what the tree contains. */
function orderedSections(artifacts: Artifact[], inv: Inventory): Section[] {
  const have = new Set(artifacts.map((a) => a.relPath));
  const sections: Section[] = [];
  const push = (relPath: string, title: string, anchor: string) => {
    if (have.has(relPath)) sections.push({ relPath, title, anchor });
  };

  push("00-overview/PRD.md", "Overview", "overview");
  push("architecture/ARCHITECTURE.md", "Architecture", "architecture");
  push("architecture/INTERFACES.md", "Interfaces", "interfaces");
  push("architecture/DATA-MODEL.md", "Data model", "data-model");
  push("architecture/diagram.md", "Diagram", "diagram");
  for (const f of inv.features) {
    push(`features/${f.slug}/PRD.md`, f.name, `feature-${f.slug}`);
  }
  push("REBUILD.md", "Build order", "build-order");

  // Any other markdown not already placed and not excluded, appended sorted.
  const placed = new Set(sections.map((s) => s.relPath));
  const extra = artifacts
    .map((a) => a.relPath)
    .filter((p) => p.endsWith(".md") && !placed.has(p) && !BUNDLE_EXCLUDE.has(p))
    .sort();
  for (const relPath of extra) {
    sections.push({ relPath, title: relPath.replace(/\.md$/, ""), anchor: slugify(relPath) });
  }
  return sections;
}

/**
 * Bundle the whole reconstruction tree into a single, coherent markdown
 * document: one H1 title, a metadata line, a linked table of contents, then
 * every document (overview → architecture → features → build order) with its
 * headings demoted one level so the result reads as one file.
 */
export function mergeArtifacts(artifacts: Artifact[], inv: Inventory, opts: Options): string {
  const byPath = new Map(artifacts.map((a) => [a.relPath, a.content]));
  const sections = orderedSections(artifacts, inv);

  const parts: string[] = [];
  parts.push(`# ${inv.repoName} — Reconstruction`);
  parts.push("");
  parts.push(metaLine(inv, opts));
  parts.push("");
  parts.push(
    "Single-file bundle of the full reconstruction. Each section below is one document from the reconstruction tree.",
  );
  parts.push("");
  parts.push("## Contents");
  parts.push("");
  for (const s of sections) parts.push(`- [${s.title}](#${s.anchor})`);

  for (const s of sections) {
    const content = byPath.get(s.relPath) ?? "";
    parts.push("");
    parts.push("---");
    parts.push("");
    parts.push(`<a id="${s.anchor}"></a>`);
    parts.push("");
    parts.push(demoteHeadings(content).trimEnd());
  }

  return parts.join("\n") + "\n";
}

/**
 * A one-page digest of the reconstruction, derived deterministically from the
 * inventory: stack, libraries, size, features in build order, interface/data
 * counts, locales, unknowns, and next steps.
 */
export function summarize(inv: Inventory, opts: Options): string {
  const lines: string[] = [];
  lines.push(`# ${inv.repoName} — reconstruction summary`);
  lines.push("");
  lines.push(metaLine(inv, opts));
  lines.push("");

  lines.push("## Project");
  const frameworks = inv.stack.frameworks.length
    ? `${inv.stack.primaryLanguage} · ${inv.stack.frameworks.join(", ")}`
    : inv.stack.primaryLanguage;
  lines.push(`- **Stack:** ${frameworks}`);
  lines.push(`- **Notable libraries:** ${inv.stack.libraries.length ? inv.stack.libraries.join(", ") : "—"}`);
  lines.push(`- **Size:** ${inv.fileCount} files · ${inv.totalLines} lines`);
  if (inv.stack.packageManagers.length) {
    lines.push(`- **Package manager(s):** ${inv.stack.packageManagers.join(", ")}`);
  }
  if (inv.runtime?.node) lines.push(`- **Runtime:** Node ${inv.runtime.node}`);
  if (inv.i18n) {
    lines.push(`- **Locales:** ${inv.i18n.locales.join(", ")} (${inv.i18n.locales.length})`);
  }
  lines.push(`- **Routes:** ${inv.routes.length} · **Features:** ${inv.features.length}`);
  if (inv.workspaces?.length) lines.push(`- **Monorepo:** ${inv.workspaces.length} workspace(s)`);
  lines.push("");

  lines.push("## Features (build order)");
  if (inv.features.length === 0) {
    lines.push("_No features detected._");
  } else {
    inv.features.forEach((f, i) => {
      const desc = f.description ? ` — ${f.description}` : "";
      lines.push(`${i + 1}. **${f.name}**${desc} → \`features/${f.slug}/PRD.md\` (${f.files.length} file(s))`);
    });
  }
  lines.push("");

  lines.push("## Interface & data surface");
  lines.push(`- Routes resolved: ${inv.routes.length}`);
  lines.push(`- Route candidates to verify: ${inv.hints.routeCandidates.length}`);
  lines.push(`- API candidates (RPC / GraphQL / gRPC / OpenAPI): ${inv.hints.apiCandidates.length}`);
  lines.push(`- Schema / data-model candidates: ${inv.hints.schemaCandidates.length}`);
  lines.push("");

  lines.push("## Unknowns to resolve");
  if (inv.unknowns.length === 0) {
    lines.push("_None — the engine resolved everything it looks for._");
  } else {
    for (const u of inv.unknowns) lines.push(`- ${u}`);
  }
  lines.push("");

  lines.push("## Next steps");
  lines.push(
    "Open `REBUILD.md` for the dependency-ordered build order and validation checklist, then feed each `features/<slug>/PRD.md` to an agent, using `data/` and `source/` as ground truth.",
  );
  lines.push("");

  return lines.join("\n");
}
