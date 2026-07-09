import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { hasUI } from "./design.js";
import type { Inventory } from "./types.js";

export interface CheckResult {
  errors: string[];
  warnings: string[];
}

/** Required documents every reconstruction tree must carry. */
const REQUIRED_DOCS = ["REBUILD.md", "00-overview/PRD.md", "architecture/ARCHITECTURE.md", "architecture/INTERFACES.md", "architecture/DATA-MODEL.md"];

/** The spine every feature PRD must keep after enrichment. */
const FEATURE_SPINE = ["## Functional requirements", "## Acceptance criteria", "## Definition of done"];

// Directories that hold copied ground truth or original source — never scanned
// for scaffolding, since they legitimately contain arbitrary text. `orchestration`
// holds the artifacts `--orchestrate` emits (contracts, runbook, subagent scratch),
// regenerated deterministically from the worklists — harness plumbing, not spec prose.
const SKIP_DIRS = new Set(["data", "source", "node_modules", ".git", "orchestration"]);

interface Doc {
  rel: string;
  content: string;
}

function collectMarkdown(dir: string, base = dir): Doc[] {
  const out: Doc[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      out.push(...collectMarkdown(full, base));
    } else if (name.endsWith(".md")) {
      out.push({ rel: relative(base, full).split("\\").join("/"), content: readFileSync(full, "utf8") });
    }
  }
  return out;
}

/**
 * Flag unresolved scaffolding in a set of docs. Scans PROSE only — code
 * spans/blocks AND quoted examples are stripped, because both a 🧠 and the words
 * "fill this in" legitimately appear in code or quotes (a Definition-of-done line
 * naming the callout marker inside backticks, embedded source under
 * "## Source material", or a PRD that documents the gate and quotes the
 * placeholder). A real callout is always the bare `> 🧠 …` blockquote. The 🧠 and
 * placeholder scans use the SAME stripped prose so a quoted example is exempted
 * symmetrically. Shared by the reconstruction gate and the brainstorm-only gate.
 */
function scanScaffolding(docs: Doc[], errors: string[]): void {
  for (const d of docs) {
    const prose = stripQuotes(stripCode(d.content));
    const callouts = prose.split("🧠").length - 1;
    if (callouts > 0) {
      errors.push(`${d.rel}: ${callouts} unresolved \`🧠\` agent callout(s) — resolve them exhaustively and delete the callout`);
    }
    if (/fill this in/i.test(prose)) {
      errors.push(`${d.rel}: contains unresolved "fill this in" placeholder text`);
    }
  }
}

/** Gather every filename under a directory tree (recursively). */
function fileNames(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) out.push(...fileNames(full));
    else out.push(name);
  }
  return out;
}

/**
 * Statically verify that a reconstruction output tree is *buildable*: no
 * unresolved scaffolding remains, the contract spine (architecture docs +
 * feature PRDs) is filled, every entity/operation a feature references is
 * documented, and every declared locale is covered. Mode-agnostic — it reads
 * the generated tree + `inventory.json`, so it works whether the tree came from
 * the code path or the scratch path.
 */
export function checkOutput(outDir: string): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const invPath = join(outDir, "inventory.json");
  if (!existsSync(invPath)) {
    // A brainstorm-only directory (a BRAINSTORM.md with no reconstruction) is
    // still gatable on the scaffolding scan alone: unresolved 🧠 callouts or
    // "fill this in" mean the brainstorm isn't finished. Everything else (the
    // required-docs / spine / contract checks) needs an inventory, so skip them.
    if (existsSync(join(outDir, "BRAINSTORM.md"))) {
      scanScaffolding(collectMarkdown(outDir), errors);
      return { errors, warnings };
    }
    errors.push(`no inventory.json in ${outDir} — not a reconstruction output (run the analyzer first)`);
    return { errors, warnings };
  }
  let inv: Inventory;
  try {
    inv = JSON.parse(readFileSync(invPath, "utf8")) as Inventory;
  } catch (e) {
    errors.push(`inventory.json is not valid JSON: ${(e as Error).message}`);
    return { errors, warnings };
  }

  const docs = collectMarkdown(outDir);
  const byRel = new Map(docs.map((d) => [d.rel, d]));
  const findDoc = (rel: string): Doc | undefined => byRel.get(rel) ?? docs.find((d) => d.rel.endsWith("/" + rel));

  // 1. Required structure.
  for (const req of REQUIRED_DOCS) {
    if (!findDoc(req)) errors.push(`missing required document: ${req}`);
  }

  // 2. Unresolved scaffolding — the #1 cause of an unbuildable PRD is an
  //    architecture doc or feature spec left as a 🧠 skeleton.
  scanScaffolding(docs, errors);

  // 3. Reference integrity: every entity/operation a feature references must be
  //    documented in the architecture docs. (Inventory carries these on the
  //    scratch path; on the code path the agent fills the docs by hand and the
  //    scaffolding scan above is the primary gate.)
  const dataModelDoc = findDoc("architecture/DATA-MODEL.md")?.content ?? "";
  const interfacesDoc = findDoc("architecture/INTERFACES.md")?.content ?? "";

  const referencedEntities = new Set<string>();
  for (const e of inv.dataModel ?? []) referencedEntities.add(e.entity);
  for (const f of inv.features ?? []) for (const e of f.entities ?? []) referencedEntities.add(e);
  if (dataModelDoc) {
    for (const e of referencedEntities) {
      if (!documents(dataModelDoc, e)) {
        errors.push(`architecture/DATA-MODEL.md does not document entity \`${e}\` referenced by the plan/features`);
      }
    }
  }

  const referencedOps = new Set<string>();
  for (const i of inv.interfaces ?? []) referencedOps.add(i.path);
  for (const f of inv.features ?? []) for (const i of f.interfaces ?? []) referencedOps.add(i);
  if (interfacesDoc) {
    for (const op of referencedOps) {
      if (!documents(interfacesDoc, op)) {
        errors.push(`architecture/INTERFACES.md does not document operation \`${op}\` referenced by the plan/features`);
      }
    }
  }

  // 4. Feature PRD spine — enrichment must keep the demanding sections, and the
  //    sections must carry content (a spine of bare headings is not a PRD).
  for (const d of docs) {
    if (!d.rel.includes("features/") || !d.rel.endsWith("PRD.md")) continue;
    for (const h of FEATURE_SPINE) {
      if (!d.content.includes(h)) {
        errors.push(`${d.rel}: missing required section "${h}"`);
      } else if (!sectionHasContent(d.content, h)) {
        // A heading whose body is empty (or only its scaffold callout) is not a
        // filled PRD section — the auto-generated DoD/Routes/Source elsewhere in
        // the doc must not mask an unwritten requirements/criteria section.
        errors.push(`${d.rel}: section "${h}" has no content — fill it (a heading alone is not a PRD section)`);
      }
    }
  }

  // 5. Contract substance — the decisive gate on the code path, where the
  //    inventory carries no dataModel/interfaces so the reference checks above are
  //    vacuous. An architecture doc emptied of its contract (no callouts left, but
  //    no entities/operations either) must still fail: a hollow tree is not buildable.
  if (dataModelDoc && !declaresEntities(dataModelDoc)) {
    errors.push("architecture/DATA-MODEL.md declares no entities — the data model is empty; fill it before the tree is buildable");
  }
  if (interfacesDoc && !declaresOperations(interfacesDoc)) {
    errors.push("architecture/INTERFACES.md declares no operations — the interface surface is empty; enumerate it before the tree is buildable");
  }

  // 5b. Design-system contract — CONDITIONAL on UI presence and WARNING-only. A
  //     backend / CLI / library has no design system; demanding the doc there
  //     would be a false failure. An *un-enriched* DESIGN-SYSTEM.md still hard-
  //     fails via the 🧠-callout scan above; this only catches an enriched-but-
  //     emptied one, and only when the inventory actually shows a UI surface.
  if (hasUI(inv)) {
    const ds = findDoc("architecture/DESIGN-SYSTEM.md");
    if (!ds) {
      warnings.push(
        "architecture/DESIGN-SYSTEM.md is missing but UI was detected — capture the visual contract (tokens, theming, typography, components, a11y).",
      );
    } else if (!declaresDesignSystem(stripSection(stripMetaTable(ds.content), "Design-system source files"))) {
      warnings.push("architecture/DESIGN-SYSTEM.md captures no tokens/components — fill the design-system contract for a faithful visual rebuild.");
    }
  }

  // 5. i18n locale coverage (warning): every declared locale should have a
  //    messages file under data/translations/ OR appear in the message catalog.
  if (inv.i18n && inv.i18n.locales?.length) {
    const transDir = join(outDir, "data", "translations");
    const names = existsSync(transDir) ? fileNames(transDir) : [];
    const catalog =
      (findDoc("architecture/ARCHITECTURE.md")?.content ?? "") +
      "\n" +
      dataModelDoc +
      "\n" +
      interfacesDoc +
      "\n" +
      docs
        .filter((d) => /international|i18n|messages|locale/i.test(d.rel))
        .map((d) => d.content)
        .join("\n");
    for (const loc of inv.i18n.locales) {
      const inFiles = names.some((n) => n.includes(loc));
      const inCatalog = catalog.includes(`${loc}`);
      if (!inFiles && !inCatalog) {
        warnings.push(`locale \`${loc}\` has no messages file under data/translations/ and is not covered in the message catalog`);
      }
    }
  }

  return { errors, warnings };
}

/** Whether a doc documents a token — as a word, not an incidental substring. */
function documents(doc: string, token: string): boolean {
  return doc.includes(token);
}

/** Markdown with fenced code blocks and inline code spans removed. */
function stripCode(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, "")
    .replace(/~~~[\s\S]*?~~~/g, "")
    .replace(/`[^`\n]*`/g, "");
}

/**
 * Drop quoted spans so a *quoted* placeholder example doesn't false-fail — straight
 * double quotes and the curly “…” / ‘…’ forms (authors quote the gate phrase or the
 * 🧠 marker many ways). ASCII single quotes are left alone: they collide with prose
 * apostrophes and stripping them could mask a real placeholder.
 */
function stripQuotes(s: string): string {
  return s
    .replace(/"[^"\n]*"/g, "")
    .replace(/[“”][^“”\n]*[“”]/g, "")
    .replace(/[‘’][^‘’\n]*[‘’]/g, "");
}

/**
 * Strip the boilerplate provenance table (`| Setting | Value |`) the scaffold
 * injects into every architecture doc, so its 4–5 rows can't masquerade as a
 * filled contract in the substance checks below.
 */
function stripMetaTable(doc: string): string {
  const lines = doc.split(/\r?\n/);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\|\s*Setting\s*\|\s*Value\s*\|/i.test((lines[i] as string).trim())) {
      i++; // skip the header; then skip the separator + every data row
      while (i + 1 < lines.length && /^\|/.test((lines[i + 1] as string).trim())) i++;
      continue;
    }
    out.push(lines[i] as string);
  }
  return out.join("\n");
}

/**
 * Remove a named `## <heading>` section (its heading + body up to the next level
 * 1–2 heading). Used so the design-system "## Design-system source files" listing
 * — bare candidate-file bullets, which carry no captured contract — can't make
 * `declaresDesignSystem` read an otherwise-empty doc as filled.
 */
function stripSection(doc: string, heading: string): string {
  const re = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  const lines = doc.split(/\r?\n/);
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (/^#{1,2}\s/.test(line)) skipping = re.test(line);
    if (!skipping) out.push(line);
  }
  return out.join("\n");
}

/** Count markdown table rows that carry data (excluding the `| --- |` separator). */
function tableDataRowCount(doc: string): number {
  return doc.split(/\r?\n/).filter((l) => {
    const t = l.trim();
    return t.startsWith("|") && !/^\|[\s|:-]+\|?$/.test(t);
  }).length;
}

/** A DATA-MODEL.md declares entities via `### <entity>` blocks or a filled table. */
function declaresEntities(doc: string): boolean {
  const real = stripMetaTable(doc);
  return /^###\s+\S/m.test(real) || tableDataRowCount(real) >= 2;
}

/** An INTERFACES.md declares operations via headings, a filled table, or path bullets. */
function declaresOperations(doc: string): boolean {
  const real = stripMetaTable(doc);
  return /^###\s+\S/m.test(real) || tableDataRowCount(real) >= 2 || /^\s*[-*]\s+\S+[./]\S*/m.test(real);
}

/** A DESIGN-SYSTEM.md captures a contract via `###` subsections, a filled table row, or token bullets. */
function declaresDesignSystem(doc: string): boolean {
  return /^###\s+\S/m.test(doc) || tableDataRowCount(doc) >= 2 || /^\s*[-*]\s+\S/m.test(doc);
}

/** The body of a `## <heading>` section: lines until the next level-2 heading. */
function sectionBody(doc: string, heading: string): string {
  const lines = doc.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) return "";
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i] as string)) break;
    body.push(lines[i] as string);
  }
  return body.join("\n");
}

/**
 * A section carries real content if any line is neither blank, a heading, nor a
 * blockquote/callout (`>` / `> 🧠 …`). Prose, lists, tables and code all count —
 * only a heading left alone (or with just its scaffold callout) is "empty".
 */
function sectionHasContent(doc: string, heading: string): boolean {
  return sectionBody(doc, heading)
    .split(/\r?\n/)
    .some((l) => {
      const t = l.trim();
      return t !== "" && !t.startsWith(">") && !t.startsWith("#");
    });
}

/** Human-readable report for the CLI; PASS when there are no errors. */
export function formatCheckReport(r: CheckResult, outDir: string): string {
  const lines: string[] = [];
  if (r.errors.length) {
    lines.push(`reconstruct --check: ${r.errors.length} error(s) in ${outDir}:`);
    for (const e of r.errors) lines.push(`  ✗ ${e}`);
  }
  if (r.warnings.length) {
    lines.push(`reconstruct --check: ${r.warnings.length} warning(s):`);
    for (const w of r.warnings) lines.push(`  ⚠ ${w}`);
  }
  if (!r.errors.length) {
    lines.push(
      r.warnings.length
        ? `reconstruct --check: PASS (with warnings) — ${outDir} has no blocking gaps.`
        : `reconstruct --check: PASS — ${outDir} is buildable (no unresolved callouts; references resolve).`,
    );
  } else {
    lines.push(`reconstruct --check: FAIL — resolve the errors above, then re-run.`);
  }
  return lines.join("\n");
}
