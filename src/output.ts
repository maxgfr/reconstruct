import { mkdirSync, writeFileSync, copyFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Artifact, Options, RenderResult } from "./types.js";

/** Flush a RenderResult to disk: write artifacts, then copy ground-truth files. */
export function writeOutput(result: RenderResult, opts: Options): void {
  for (const a of result.artifacts) {
    const dest = join(opts.out, a.relPath);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, a.content, "utf8");
  }
  for (const c of result.copies) {
    if (!existsSync(c.from)) continue;
    mkdirSync(dirname(c.to), { recursive: true });
    try {
      copyFileSync(c.from, c.to);
    } catch {
      // Skip files that disappear or are unreadable mid-run.
    }
  }
}

/**
 * Write artifacts under `outDir`, skipping any whose destination already exists,
 * and return the relPaths actually written. Used for scratch-mode `CONTEXT.md` /
 * `docs/adr/*` so an agent-authored version is never clobbered by a re-run.
 */
export function writeArtifactsIfAbsent(artifacts: Artifact[], outDir: string): string[] {
  const written: string[] = [];
  for (const a of artifacts) {
    const dest = join(outDir, a.relPath);
    if (existsSync(dest)) continue;
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, a.content, "utf8");
    written.push(a.relPath);
  }
  return written;
}

/** How many enrichment witnesses to name before summarizing the rest. */
const ENRICHMENT_WITNESS_LIMIT = 5;

// A scaffolded document still carries its `> 🧠` agent callouts; an ENRICHED one
// has had every callout resolved and deleted. That asymmetry is what makes
// enrichment detectable without tracking state.
const CALLOUT = "🧠";

/**
 * Documents the scaffold seeds WITH `> 🧠` callouts, so "no callouts left" means
 * "an agent resolved them" rather than "this template never had any". Listing a
 * callout-free document here (`00-overview/PRD.md` is one) would flag a pristine
 * scaffold as enriched and make every legitimate re-scaffold demand `--force`.
 * `tests/rerun-guard.test.ts` asserts this list against a really-generated tree,
 * so a template that stops emitting callouts fails a test instead of silently
 * misfiring the guard. Feature PRDs are globbed separately (slugs are not known
 * up front); they are entirely callout-driven.
 */
export const CALLOUT_BEARING_DOCS = [
  "architecture/ARCHITECTURE.md",
  "architecture/INTERFACES.md",
  "architecture/DATA-MODEL.md",
  "architecture/DESIGN-SYSTEM.md",
  "BRAINSTORM.md",
];

// Ledgers only exist once a semantic gate has run over enriched prose, so their
// presence alone is proof of work-in-progress.
const LEDGERS = ["REVIEW.json", "VERIFY.json"];

function readIfFile(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined; // missing, a directory, or unreadable — not a witness
  }
}

/**
 * Evidence that `outDir` holds AGENT-WRITTEN prose a re-run would destroy.
 *
 * `writeOutput` overwrites every artifact it renders, so re-pointing `--repo …
 * --out <enriched tree>` silently deletes the enrichment (only `CONTEXT.md`,
 * `docs/adr/*` and `BRAINSTORM.md` are written if-absent). The CLI calls this
 * first and refuses the run unless `--force`.
 *
 * Returns human-readable witnesses, empty when the tree is absent, empty, or a
 * pristine scaffold (every document still carrying its `> 🧠` callouts).
 */
export function detectEnrichment(outDir: string): string[] {
  if (!existsSync(outDir)) return [];
  const witnesses: string[] = [];

  for (const ledger of LEDGERS) {
    if (existsSync(join(outDir, ledger))) witnesses.push(`${ledger} — a semantic-gate ledger from a previous round`);
  }

  const resolved = (rel: string): void => {
    const body = readIfFile(join(outDir, rel));
    if (body !== undefined && body.trim() && !body.includes(CALLOUT)) witnesses.push(`${rel} — every agent callout resolved`);
  };
  for (const rel of CALLOUT_BEARING_DOCS) resolved(rel);

  let slugs: string[] = [];
  try {
    slugs = readdirSync(join(outDir, "features"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    // no features/ dir — nothing more to witness
  }
  for (const slug of slugs) resolved(join("features", slug, "PRD.md"));

  return witnesses;
}

/** Render `detectEnrichment` witnesses into the CLI's refusal message. */
export function formatEnrichmentRefusal(outDir: string, witnesses: string[]): string {
  const shown = witnesses.slice(0, ENRICHMENT_WITNESS_LIMIT);
  const rest = witnesses.length - shown.length;
  return (
    `${outDir} already holds an ENRICHED reconstruction — re-running the analyzer would overwrite it.\n` +
    shown.map((w) => `  - ${w}`).join("\n") +
    (rest > 0 ? `\n  - …and ${rest} more` : "") +
    `\n\nPick one:\n` +
    `  - continue the existing tree:   --check / --review / --verify --out ${outDir}\n` +
    `  - scaffold a scoped deep-dive:  --out ${outDir}-<scope>\n` +
    `  - re-scaffold and diff by hand: --out ${outDir}.new\n` +
    `  - overwrite it anyway:          --force  (the enrichment above is LOST)`
  );
}
