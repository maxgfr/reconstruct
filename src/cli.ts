import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync, statSync } from "node:fs";
import { analyze } from "./analyze.js";
import { render } from "./prd/render.js";
import { writeOutput } from "./output.js";
import { bundleExisting } from "./postprocess.js";
import { VERSION } from "./types.js";
import type { Fidelity, Granularity, Level, Mode, Options, RenderResult } from "./types.js";

const HELP = `reconstruct v${VERSION}
Analyze a repository and generate reconstruction PRDs to rebuild it from scratch.

Usage:
  reconstruct [--repo <path>] [--out <path>] [options]

Options:
  --repo <path>        Repository to analyze            (default: current dir)
  --out <path>         Output directory                 (default: <repo>/reconstruction)
  --mode <mode>        preserve | redesign              (default: preserve)
  --level <level>      light | complex                  (default: light)
  --fidelity <mode>    mirror | embed | describe        (default: derived from mode+level)
  --granularity <g>    coarse | fine (feature grouping) (default: coarse)
  --include <glob>     Only analyze files matching glob (repeatable, comma-ok)
  --exclude <glob>     Skip files matching glob          (repeatable, comma-ok)
  --max-embed-bytes N  Max bytes embedded per file      (default: 16000)
  --merge              Also write RECONSTRUCTION.md (whole tree in one file)
  --summary            Also write SUMMARY.md (one-page digest)
  --json               Print the inventory JSON only, write nothing
  -h, --help           Show this help
  -v, --version        Show version

Fidelity defaults:
  preserve+light  -> mirror     preserve+complex -> embed
  redesign+light  -> embed      redesign+complex -> describe

Bundling:
  --merge / --summary during a normal run append the file(s) to the output tree.
  Used WITHOUT --repo, they run as a post-step on an existing reconstruction:
    reconstruct --merge --summary --out <reconstruction-dir>
`;

function fail(message: string): never {
  process.stderr.write(`reconstruct: ${message}\n`);
  process.exit(1);
}

function oneOf<T extends string>(name: string, value: string, allowed: readonly T[]): T {
  if (!(allowed as readonly string[]).includes(value)) {
    fail(`invalid --${name} "${value}" (expected: ${allowed.join(", ")})`);
  }
  return value as T;
}

function defaultFidelity(mode: Mode, level: Level): Fidelity {
  if (mode === "preserve") return level === "light" ? "mirror" : "embed";
  return level === "light" ? "embed" : "describe";
}

function splitGlobs(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseArgs(argv: string[]): Options {
  const raw: Record<string, string> = {};
  const includeGlobs: string[] = [];
  const excludeGlobs: string[] = [];
  let json = false;
  let merge = false;
  let summary = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "-h" || arg === "--help") {
      process.stdout.write(HELP);
      process.exit(0);
    }
    if (arg === "-v" || arg === "--version") {
      process.stdout.write(VERSION + "\n");
      process.exit(0);
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--merge") {
      merge = true;
      continue;
    }
    if (arg === "--summary") {
      summary = true;
      continue;
    }
    if (arg.startsWith("--")) {
      let key: string;
      let value: string;
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        key = arg.slice(2, eq);
        value = arg.slice(eq + 1);
      } else {
        key = arg.slice(2);
        const next = argv[i + 1];
        if (next === undefined || next.startsWith("--")) {
          fail(`missing value for ${arg}`);
        }
        value = next as string;
        i++;
      }
      if (key === "include") includeGlobs.push(...splitGlobs(value));
      else if (key === "exclude") excludeGlobs.push(...splitGlobs(value));
      else raw[key] = value;
    }
  }

  // Standalone post-step: bundle an existing output dir when --merge/--summary
  // is used without --repo (and not in --json mode, which writes nothing).
  const standalone = (merge || summary) && !json && raw.repo === undefined;

  const repo = resolve(raw.repo ?? process.cwd());
  if (!standalone && (!existsSync(repo) || !statSync(repo).isDirectory())) {
    fail(`repo path is not a directory: ${repo}`);
  }
  const mode = oneOf<Mode>("mode", raw.mode ?? "preserve", ["preserve", "redesign"]);
  const level = oneOf<Level>("level", raw.level ?? "light", ["light", "complex"]);
  const fidelity = oneOf<Fidelity>(
    "fidelity",
    raw.fidelity ?? defaultFidelity(mode, level),
    ["mirror", "embed", "describe"],
  );
  const granularity = oneOf<Granularity>("granularity", raw.granularity ?? "coarse", [
    "coarse",
    "fine",
  ]);
  const out = standalone
    ? resolve(raw.out ?? process.cwd())
    : resolve(raw.out ?? join(repo, "reconstruction"));
  const maxEmbedBytes = raw["max-embed-bytes"] ? Number(raw["max-embed-bytes"]) : 16000;
  if (!Number.isFinite(maxEmbedBytes) || maxEmbedBytes <= 0) {
    fail(`invalid --max-embed-bytes`);
  }

  return {
    repo,
    out,
    mode,
    level,
    fidelity,
    granularity,
    include: includeGlobs,
    exclude: excludeGlobs,
    json,
    maxEmbedBytes,
    merge,
    summary,
    standalone,
  };
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.standalone) {
    let result: RenderResult;
    try {
      result = bundleExisting(opts);
    } catch (e) {
      fail((e as Error).message);
    }
    writeOutput(result, opts);
    const made = [
      ...(opts.summary ? ["SUMMARY.md"] : []),
      ...(opts.merge ? ["RECONSTRUCTION.md"] : []),
    ];
    process.stderr.write(`reconstruct: bundled ${made.join(" + ")} into ${opts.out}\n`);
    return;
  }

  const inv = analyze(opts);

  if (opts.json) {
    process.stdout.write(JSON.stringify(inv, null, 2) + "\n");
    return;
  }

  const result = render(inv, opts);
  writeOutput(result, opts);

  const hintTotal =
    inv.hints.routeCandidates.length +
    inv.hints.apiCandidates.length +
    inv.hints.schemaCandidates.length;
  const lines = [
    `reconstruct: analyzed ${inv.fileCount} files (${inv.totalLines} lines) in ${inv.repoName}`,
    `  stack:    ${inv.stack.primaryLanguage}${inv.stack.frameworks.length ? " · " + inv.stack.frameworks.join(", ") : ""}`,
    `  libs:     ${inv.stack.libraries.length ? inv.stack.libraries.join(", ") : "—"}`,
    `  features: ${inv.features.length} · routes: ${inv.routes.length} · locales: ${inv.i18n ? inv.i18n.locales.length : 0}`,
    `  hints:    ${hintTotal} candidate(s) to verify (routes/API/schema) · ${inv.hints.entryPoints.length} entry point(s)`,
    ...(inv.workspaces ? [`  monorepo: ${inv.workspaces.length} workspace(s)`] : []),
    `  excluded: ${inv.excludedCount} file(s) skipped by ignore rules${opts.include.length || opts.exclude.length ? " + scoping globs" : ""}`,
    ...(inv.unknowns.length ? [`  unknowns: ${inv.unknowns.length} item(s) for the agent to resolve (see inventory.json)`] : []),
    `  mode/level/fidelity/granularity: ${opts.mode}/${opts.level}/${opts.fidelity}/${opts.granularity}`,
    ...(opts.summary ? [`  summary:  SUMMARY.md (one-page digest)`] : []),
    ...(opts.merge ? [`  merged:   RECONSTRUCTION.md (whole tree in one file)`] : []),
    `  output:   ${opts.out}`,
    `  next:     open ${join(opts.out, opts.merge ? "RECONSTRUCTION.md" : "REBUILD.md")}`,
  ];
  process.stderr.write(lines.join("\n") + "\n");
}

// Only run when invoked directly (node scripts/analyze.mjs), not when imported
// (e.g. by tests that exercise parseArgs).
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
