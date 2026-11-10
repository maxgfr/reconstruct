import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { Artifact, Inventory, Options, RenderResult } from "./types.js";
import { mergeArtifacts, mergeFeatures, mergeSpecs, summarize } from "./prd/bundle.js";

/**
 * Top-level dirs that are not spec documents — never bundled: verbatim copies
 * (`source/`, `data/`) and the `--orchestrate` harness (contracts, runbook).
 */
const NON_SPEC_DIRS = new Set(["source", "data", "orchestration"]);
/**
 * Workflow files at the tree root: worklists and the divergent-phase scratch.
 * The inline run never renders them, so a standalone bundle must not either.
 */
const NON_SPEC_FILES = new Set(["REVIEW.md", "VERIFY.md", "BRAINSTORM.md"]);

/**
 * Collect the spec `.md` files under `dir` as artifacts (POSIX relPaths),
 * skipping ground-truth copies, worklists and orchestration plumbing so a
 * standalone bundle matches what the inline run produces.
 */
function readMarkdownTree(dir: string): Artifact[] {
  const out: Artifact[] = [];
  const walk = (abs: string): void => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = join(abs, entry.name);
      const rel = relative(dir, child).split(sep).join("/");
      if (entry.isDirectory()) {
        if (NON_SPEC_DIRS.has(rel)) continue;
        walk(child);
      } else if (entry.isFile() && entry.name.endsWith(".md") && !NON_SPEC_FILES.has(rel)) {
        out.push({ relPath: rel, content: readFileSync(child, "utf8") });
      }
    }
  };
  walk(dir);
  return out;
}

/**
 * Standalone post-step: rebuild the requested bundle(s) from an already-generated
 * reconstruction directory (`opts.out`) without re-analysing a repo. Reads
 * `inventory.json` (for provenance + feature order) and every `.md` on disk,
 * then returns only the requested `SUMMARY.md` / `FEATURES.md` / `SPECS.md` /
 * `RECONSTRUCTION.md` artifacts.
 *
 * The bundlers exclude any pre-existing `SUMMARY.md` / `FEATURES.md` /
 * `SPECS.md` / `RECONSTRUCTION.md`, so re-running is idempotent.
 */
export function bundleExisting(opts: Options): RenderResult {
  const dir = opts.out;
  const invPath = join(dir, "inventory.json");
  if (!existsSync(invPath)) {
    throw new Error(`no inventory.json in ${dir} — run a full reconstruction there first ` + `(e.g. reconstruct --repo <repo> --out ${dir}).`);
  }
  const inv = JSON.parse(readFileSync(invPath, "utf8")) as Inventory;
  const tree = readMarkdownTree(dir);

  const artifacts: Artifact[] = [];
  if (opts.summary) artifacts.push({ relPath: "SUMMARY.md", content: summarize(inv, opts) });
  if (opts.features) artifacts.push({ relPath: "FEATURES.md", content: mergeFeatures(tree, inv, opts) });
  if (opts.specs) artifacts.push({ relPath: "SPECS.md", content: mergeSpecs(tree, inv, opts) });
  if (opts.merge) artifacts.push({ relPath: "RECONSTRUCTION.md", content: mergeArtifacts(tree, inv, opts) });
  return { artifacts, copies: [] };
}
