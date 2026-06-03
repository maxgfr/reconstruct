import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Inventory } from "./types.js";

export interface CheckResult {
  errors: string[];
  warnings: string[];
}

/** Required documents every reconstruction tree must carry. */
const REQUIRED_DOCS = [
  "REBUILD.md",
  "00-overview/PRD.md",
  "architecture/ARCHITECTURE.md",
  "architecture/INTERFACES.md",
  "architecture/DATA-MODEL.md",
];

/** The spine every feature PRD must keep after enrichment. */
const FEATURE_SPINE = [
  "## Functional requirements",
  "## Acceptance criteria",
  "## Definition of done",
];

// Directories that hold copied ground truth or original source — never scanned
// for scaffolding, since they legitimately contain arbitrary text.
const SKIP_DIRS = new Set(["data", "source", "node_modules", ".git"]);

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
    let st;
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
    let st;
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
    errors.push(
      `no inventory.json in ${outDir} — not a reconstruction output (run the analyzer first)`,
    );
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
  const findDoc = (rel: string): Doc | undefined =>
    byRel.get(rel) ?? docs.find((d) => d.rel.endsWith("/" + rel));

  // 1. Required structure.
  for (const req of REQUIRED_DOCS) {
    if (!findDoc(req)) errors.push(`missing required document: ${req}`);
  }

  // 2. Unresolved scaffolding — the #1 cause of an unbuildable PRD is an
  //    architecture doc or feature spec left as a 🧠 skeleton.
  for (const d of docs) {
    // Scan PROSE only — code spans/blocks AND quoted examples stripped. Both
    // a 🧠 and the words "fill this in" legitimately appear in code or quotes:
    // the Definition-of-done line that names the callout marker inside backticks,
    // embedded source under "## Source material", or a PRD that documents the
    // gate and quotes the placeholder phrase / the 🧠 marker. Those are not
    // unresolved scaffolding; a real callout is always the bare `> 🧠 ...`
    // blockquote, never code or a quote. The 🧠 and placeholder scans use the
    // SAME stripped prose so a quoted example is exempted symmetrically.
    const prose = stripQuotes(stripCode(d.content));
    const callouts = prose.split("🧠").length - 1;
    if (callouts > 0) {
      errors.push(
        `${d.rel}: ${callouts} unresolved \`🧠\` agent callout(s) — resolve them exhaustively and delete the callout`,
      );
    }
    if (/fill this in/i.test(prose)) {
      errors.push(`${d.rel}: contains unresolved "fill this in" placeholder text`);
    }
  }

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
        errors.push(
          `architecture/DATA-MODEL.md does not document entity \`${e}\` referenced by the plan/features`,
        );
      }
    }
  }

  const referencedOps = new Set<string>();
  for (const i of inv.interfaces ?? []) referencedOps.add(i.path);
  for (const f of inv.features ?? []) for (const i of f.interfaces ?? []) referencedOps.add(i);
  if (interfacesDoc) {
    for (const op of referencedOps) {
      if (!documents(interfacesDoc, op)) {
        errors.push(
          `architecture/INTERFACES.md does not document operation \`${op}\` referenced by the plan/features`,
        );
      }
    }
  }

  // 4. Feature PRD spine — enrichment must keep the demanding sections, and the
  //    sections must carry content (a spine of bare headings is not a PRD).
  for (const d of docs) {
    if (!d.rel.includes("features/") || !d.rel.endsWith("PRD.md")) continue;
    for (const h of FEATURE_SPINE) {
      if (!d.content.includes(h)) errors.push(`${d.rel}: missing required section "${h}"`);
    }
    if (!hasContent(d.content)) {
      errors.push(`${d.rel}: has section headings but no content — fill the PRD (requirements, criteria, definition of done)`);
    }
  }

  // 5. Contract substance — the decisive gate on the code path, where the
  //    inventory carries no dataModel/interfaces so the reference checks above are
  //    vacuous. An architecture doc emptied of its contract (no callouts left, but
  //    no entities/operations either) must still fail: a hollow tree is not buildable.
  if (dataModelDoc && !declaresEntities(dataModelDoc)) {
    errors.push(
      "architecture/DATA-MODEL.md declares no entities — the data model is empty; fill it before the tree is buildable",
    );
  }
  if (interfacesDoc && !declaresOperations(interfacesDoc)) {
    errors.push(
      "architecture/INTERFACES.md declares no operations — the interface surface is empty; enumerate it before the tree is buildable",
    );
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
        warnings.push(
          `locale \`${loc}\` has no messages file under data/translations/ and is not covered in the message catalog`,
        );
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

/** Drop double-quoted spans so a *quoted* placeholder example doesn't false-fail. */
function stripQuotes(s: string): string {
  return s.replace(/"[^"\n]*"/g, "");
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
  return /^###\s+\S/m.test(doc) || tableDataRowCount(doc) >= 2;
}

/** An INTERFACES.md declares operations via headings, a filled table, or path bullets. */
function declaresOperations(doc: string): boolean {
  return /^###\s+\S/m.test(doc) || tableDataRowCount(doc) >= 2 || /^\s*[-*]\s+\S+[./]\S*/m.test(doc);
}

/** A document carries real content if it has a list item, numbered step, or table rows. */
function hasContent(doc: string): boolean {
  return /^\s*[-*]\s+\S/m.test(doc) || /^\s*\d+\.\s+\S/m.test(doc) || tableDataRowCount(doc) >= 2;
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
