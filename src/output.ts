import { createHash } from "node:crypto";
import { constants, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import type { Artifact, Options, RenderResult } from "./types.js";

/** A mirror copy that could not be written (the destination path and the errno code). */
export interface CopyFailure {
  path: string;
  code: string;
}

/** What one `writeOutput` did beyond writing the new tree. */
export interface WriteReport {
  /** Mirror copies that failed (anything but a source that vanished mid-run). */
  copyFailures: CopyFailure[];
  /** Files a previous run generated, this run did not, and nobody edited: deleted. */
  pruned: string[];
  /** Files a previous run generated, this run did not, but that were edited since: kept. */
  keptEdited: string[];
}

/**
 * What the engine itself wrote into a tree, so a later run can tell its own
 * stale output (safe to delete) from anything an agent or a person wrote or
 * edited (never touched). Artifacts are keyed by content hash; mirror copies by
 * size + mtime, which a re-copy or an edit changes.
 */
export const GENERATED_MANIFEST = ".reconstruct-generated.json";
interface GeneratedManifest {
  version: 1;
  artifacts: Record<string, string>;
  copies: Record<string, { size: number; mtimeMs: number }>;
}

export function readGeneratedManifest(outDir: string): GeneratedManifest | undefined {
  try {
    const m = JSON.parse(readFileSync(join(outDir, GENERATED_MANIFEST), "utf8")) as GeneratedManifest;
    return m && m.version === 1 && typeof m.artifacts === "object" && typeof m.copies === "object" ? m : undefined;
  } catch {
    return undefined;
  }
}

const sha256 = (text: string | Buffer): string => createHash("sha256").update(text).digest("hex");

/**
 * Flush a RenderResult to disk: write artifacts, then copy ground-truth files.
 *
 * A full render (anything but a standalone bundle step) then prunes what the
 * PREVIOUS run generated and this one did not — a renamed feature's old PRD and
 * `source/<old-slug>/` mirror — but only files still exactly as the engine wrote
 * them; an edited one is kept and reported. Copy failures other than a source
 * that vanished mid-run (ENOSPC, EACCES, EISDIR…) are reported so an incomplete
 * mirror never passes for a complete one.
 */
export function writeOutput(result: RenderResult, opts: Options): WriteReport {
  const previous = readGeneratedManifest(opts.out);
  const manifest: GeneratedManifest = { version: 1, artifacts: {}, copies: {} };
  // One mkdir per directory, not one per file: a mirror copy of a large repo
  // is tens of thousands of files in a few hundred directories.
  const made = new Set<string>();
  const ensureDir = (dir: string) => {
    if (made.has(dir)) return;
    mkdirSync(dir, { recursive: true });
    made.add(dir);
  };
  for (const a of result.artifacts) {
    const dest = join(opts.out, a.relPath);
    ensureDir(dirname(dest));
    writeFileSync(dest, a.content, "utf8");
    manifest.artifacts[toPosix(a.relPath)] = sha256(a.content);
  }
  const copyFailures: CopyFailure[] = [];
  for (const c of result.copies) {
    if (!existsSync(c.from)) continue;
    ensureDir(dirname(c.to));
    try {
      // A copy-on-write clone where the filesystem offers one (APFS, btrfs,
      // XFS): no data is copied. Elsewhere Node falls back to a plain copy.
      copyFileSync(c.from, c.to, constants.COPYFILE_FICLONE);
      const st = statSync(c.to);
      manifest.copies[toPosix(relative(opts.out, c.to))] = { size: st.size, mtimeMs: st.mtimeMs };
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? "EUNKNOWN";
      // A file deleted between the walk and the copy is not a failure.
      if (code !== "ENOENT") copyFailures.push({ path: c.to, code });
    }
  }

  const pruned: string[] = [];
  const keptEdited: string[] = [];
  if (opts.standalone) {
    // A bundle step adds to the tree; it does not redefine it.
    if (previous) {
      manifest.artifacts = { ...previous.artifacts, ...manifest.artifacts };
      manifest.copies = { ...previous.copies, ...manifest.copies };
    }
  } else if (previous) {
    const unchanged = (rel: string): boolean | undefined => {
      const abs = join(opts.out, rel);
      try {
        const st = statSync(abs);
        if (!st.isFile()) return undefined;
        const art = previous.artifacts[rel];
        if (art !== undefined) return sha256(readFileSync(abs)) === art;
        const copy = previous.copies[rel];
        return copy !== undefined && st.size === copy.size && st.mtimeMs === copy.mtimeMs;
      } catch {
        return undefined; // already gone
      }
    };
    const stale = [
      ...Object.keys(previous.artifacts).filter((rel) => !(rel in manifest.artifacts)),
      ...Object.keys(previous.copies).filter((rel) => !(rel in manifest.copies) && !(rel in manifest.artifacts)),
    ];
    for (const rel of stale.sort()) {
      if (!isInside(rel)) continue; // a hand-edited manifest never reaches outside the tree
      const same = unchanged(rel);
      if (same === undefined) continue;
      if (!same) {
        keptEdited.push(rel);
        continue;
      }
      rmSync(join(opts.out, rel), { force: true });
      pruned.push(rel);
      removeEmptyParents(opts.out, dirname(rel));
    }
  }
  writeFileSync(join(opts.out, GENERATED_MANIFEST), JSON.stringify(manifest) + "\n");
  return { copyFailures, pruned, keptEdited };
}

function toPosix(rel: string): string {
  return rel.split(sep).join("/");
}

/** A tree-relative path that stays inside the tree (no `..`, not absolute). */
function isInside(rel: string): boolean {
  return rel !== "" && !isAbsolute(rel) && !rel.split("/").includes("..");
}

/** Remove now-empty directories from `relDir` up to (not including) the tree root. */
function removeEmptyParents(outDir: string, relDir: string): void {
  for (let d = relDir; d && d !== "." && d !== "/"; d = dirname(d)) {
    try {
      rmdirSync(join(outDir, d));
    } catch {
      return; // not empty (or already gone): stop climbing
    }
  }
}

/** The CLI warning line for stale files a run removed or had to keep. */
export function formatPruneReport(report: WriteReport): string | undefined {
  const parts: string[] = [];
  if (report.pruned.length) parts.push(`removed ${report.pruned.length} stale file(s) a previous run generated`);
  if (report.keptEdited.length) {
    const shown = report.keptEdited.slice(0, 5).join(", ");
    parts.push(`kept ${report.keptEdited.length} stale but edited file(s): ${shown}${report.keptEdited.length > 5 ? ", …" : ""}`);
  }
  return parts.length ? parts.join("; ") : undefined;
}

/** The CLI/MCP warning line for failed mirror copies, or undefined when all landed. */
export function formatCopyFailures(failures: readonly CopyFailure[]): string | undefined {
  if (!failures.length) return undefined;
  const shown = failures.slice(0, 5).map((f) => `${f.path} (${f.code})`);
  const more = failures.length > shown.length ? ` … and ${failures.length - shown.length} more` : "";
  return `${failures.length} ground-truth file(s) could not be copied — the mirror is incomplete: ${shown.join(", ")}${more}`;
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

  const manifest = readGeneratedManifest(outDir);
  const resolved = (rel: string): void => {
    const body = readIfFile(join(outDir, rel));
    if (!body?.trim() || body.includes(CALLOUT)) return;
    // Some documents are generated with nothing to resolve (DESIGN-SYSTEM.md
    // for a repo with no UI): still exactly as the engine wrote them, they are
    // a pristine scaffold, not enrichment.
    if (manifest?.artifacts[toPosix(rel)] === sha256(body)) return;
    witnesses.push(`${rel} — every agent callout resolved`);
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

  // Any generated document edited since the engine wrote it — including the
  // callout-free ones (00-overview/PRD.md, REBUILD.md, diagram.md) the check
  // above cannot see, and partially-enriched docs that still hold callouts.
  if (manifest) {
    const named = new Set(witnesses.map((w) => w.split(" — ")[0]));
    for (const [rel, hash] of Object.entries(manifest.artifacts).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      if (named.has(rel) || !isInside(rel)) continue;
      let body: Buffer;
      try {
        body = readFileSync(join(outDir, rel));
      } catch {
        continue; // deleted — nothing a re-run would overwrite
      }
      if (sha256(body) !== hash) witnesses.push(`${rel} — edited since the engine generated it`);
    }
  }

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
