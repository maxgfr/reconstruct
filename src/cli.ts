import { resolve, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync, statSync, realpathSync } from "node:fs";
import { analyze } from "./analyze.js";
import { render } from "./prd/render.js";
import { writeOutput, writeArtifactsIfAbsent } from "./output.js";
import { bundleExisting } from "./postprocess.js";
import { loadPlan, planToInventory, renderScratchDocs, validatePlanConsistency } from "./scratch.js";
import { checkOutput, formatCheckReport } from "./check.js";
import { VERSION } from "./types.js";
import type { Fidelity, Granularity, Level, Mode, Options, RenderResult } from "./types.js";

const HELP = `reconstruct v${VERSION}
Analyze a repository and generate reconstruction PRDs to rebuild it from scratch.

Usage:
  reconstruct [--repo <path>] [--out <path>] [options]
  reconstruct --scratch --plan <plan.json> [--out <path>] [options]

Options:
  --repo <path>        Repository to analyze            (default: current dir)
  --out <path>         Output directory                 (default: <repo>/reconstruction)
  --mode <mode>        preserve | redesign              (default: preserve)
  --level <level>      light | complex                  (default: light)
  --fidelity <mode>    mirror | embed | describe        (default: derived from mode+level)
  --granularity <g>    coarse | fine (feature grouping) (default: coarse)
  --scratch            Build from a plan.json (greenfield), not a repo
  --plan <path>        The plan.json driving --scratch   (required with --scratch)
  --tdd                Emit test-first build guidance into the PRDs/REBUILD
  --check              Validate an existing --out tree for buildability, then exit
  --include <glob>     Only analyze files matching glob (repeatable, comma-ok)
  --exclude <glob>     Skip files matching glob          (repeatable, comma-ok)
  --max-embed-bytes N  Max bytes embedded per file      (default: 16000)
  --merge              Also write RECONSTRUCTION.md (whole tree in one file)
  --summary            Also write SUMMARY.md (one-page digest)
  --features           Also write FEATURES.md (every feature PRD, nothing else)
  --specs              Also write SPECS.md (whole spec, source code stripped — implement from this)
  --json               Print the inventory JSON only, write nothing
  -h, --help           Show this help
  -v, --version        Show version

Fidelity defaults:
  preserve+light  -> mirror     preserve+complex -> embed
  redesign+light  -> embed      redesign+complex -> describe

From scratch (greenfield):
  --scratch builds the SAME reconstruction tree from a plan.json interview
  instead of a repo. mode/fidelity collapse to scratch/describe; --level still
  applies (complex = deeper interview + alternatives). It also writes CONTEXT.md
  (glossary) and docs/adr/ (decisions), and links them from 00-overview.
    reconstruct --scratch --plan plan.json --out ./reconstruction --level complex

Bundling:
  --merge / --summary / --features / --specs during a normal run append the
  file(s) to the output tree. RECONSTRUCTION.md is the whole tree in one file
  (with the embedded source); SPECS.md is the same whole tree (architecture +
  features) with the source code stripped — the self-sufficient, code-free spec
  to hand an agent to implement from; FEATURES.md is the feature PRDs only.
  Used WITHOUT --repo, they run as a post-step on an existing reconstruction:
    reconstruct --merge --summary --features --specs --out <reconstruction-dir>

Validation:
  --check runs on an already-enriched output tree and exits non-zero if it is
  not buildable: a missing required document, unresolved 🧠 callouts or "fill
  this in" placeholders, a feature PRD missing a spine section or leaving one
  empty, or an architecture doc emptied of its contract (no entities in
  DATA-MODEL.md, no operations in INTERFACES.md). On the scratch path it also
  checks feature→entity/operation reference integrity. An uncovered locale is
  reported as a warning. Run it before calling a reconstruction done:
    reconstruct --check --out <reconstruction-dir>
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

// The flags that take a value (`--key <value>` or `--key=<value>`). Every other
// recognized flag is a boolean switch handled inline above. Used to reject an
// unknown or typo'd flag loudly instead of silently swallowing it (and then
// falling back to a default the user never asked for).
const VALUE_FLAGS = new Set([
  "repo",
  "out",
  "mode",
  "level",
  "fidelity",
  "granularity",
  "plan",
  "max-embed-bytes",
  "include",
  "exclude",
]);

export function parseArgs(argv: string[]): Options {
  const raw: Record<string, string> = {};
  const includeGlobs: string[] = [];
  const excludeGlobs: string[] = [];
  let json = false;
  let merge = false;
  let summary = false;
  let features = false;
  let specs = false;
  let scratch = false;
  let tdd = false;
  let check = false;

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
    if (arg === "--features") {
      features = true;
      continue;
    }
    if (arg === "--specs") {
      specs = true;
      continue;
    }
    if (arg === "--scratch") {
      scratch = true;
      continue;
    }
    if (arg === "--tdd") {
      tdd = true;
      continue;
    }
    if (arg === "--check") {
      check = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      const key = eq !== -1 ? arg.slice(2, eq) : arg.slice(2);
      if (!VALUE_FLAGS.has(key)) {
        fail(`unknown flag: --${key} (run --help for the supported options)`);
      }
      let value: string;
      if (eq !== -1) {
        value = arg.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith("--")) {
          fail(`missing value for --${key}`);
        }
        value = next as string;
        i++;
      }
      if (key === "include") includeGlobs.push(...splitGlobs(value));
      else if (key === "exclude") excludeGlobs.push(...splitGlobs(value));
      else raw[key] = value;
      continue;
    }
    // Not a boolean switch, not -h/-v, not a known --flag: a stray positional or
    // an unknown short flag. Fail rather than silently ignore it.
    fail(`unexpected argument: ${arg} (run --help for usage)`);
  }

  // Scratch (greenfield) needs a --plan and no repo; it can't also be a bundle
  // post-step. Validate up front so the rest of the resolution can assume it.
  if (scratch && raw.plan === undefined) {
    fail(`--scratch requires --plan <path> (the plan.json produced by the interview)`);
  }
  const plan = raw.plan ? resolve(raw.plan) : "";

  // Standalone post-step: bundle an existing output dir when
  // --merge/--summary/--features/--specs is used without --repo (and not in
  // --json/--scratch mode).
  const standalone =
    (merge || summary || features || specs) && !json && !scratch && raw.repo === undefined;

  const repo = resolve(raw.repo ?? process.cwd());
  // Scratch reads no repo; standalone and --check read an existing output dir —
  // all three skip the repo-exists check.
  if (!standalone && !scratch && !check && (!existsSync(repo) || !statSync(repo).isDirectory())) {
    fail(`repo path is not a directory: ${repo}`);
  }
  const level = oneOf<Level>("level", raw.level ?? "light", ["light", "complex"]);
  // Greenfield collapses mode/fidelity: nothing to preserve, no source to mirror.
  const mode = scratch
    ? ("scratch" as Mode)
    : oneOf<Mode>("mode", raw.mode ?? "preserve", ["preserve", "redesign"]);
  const fidelity = scratch
    ? ("describe" as Fidelity)
    : oneOf<Fidelity>("fidelity", raw.fidelity ?? defaultFidelity(mode, level), [
        "mirror",
        "embed",
        "describe",
      ]);
  const granularity = oneOf<Granularity>("granularity", raw.granularity ?? "coarse", [
    "coarse",
    "fine",
  ]);
  const out = resolve(
    raw.out ??
      (standalone || check
        ? process.cwd()
        : scratch
          ? join(process.cwd(), "reconstruction")
          : join(repo, "reconstruction")),
  );
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
    features,
    specs,
    standalone,
    scratch,
    plan,
    tdd,
    check,
  };
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));

  // Validation mode: statically check an already-generated tree for buildability.
  if (opts.check) {
    const result = checkOutput(opts.out);
    process.stdout.write(formatCheckReport(result, opts.out) + "\n");
    if (result.errors.length) process.exit(1);
    return;
  }

  if (opts.scratch) {
    let plan;
    try {
      plan = loadPlan(opts.plan);
    } catch (e) {
      fail((e as Error).message);
    }
    // Fail fast on an internally inconsistent plan — a buildable tree starts
    // with a plan whose features, entities, interfaces and enums line up.
    const consistency = validatePlanConsistency(plan);
    if (consistency.errors.length) {
      fail(
        `plan.json is internally inconsistent (fix these before rendering):\n  - ` +
          consistency.errors.join("\n  - "),
      );
    }
    // The plan can request TDD too; OR it with the --tdd flag.
    const effOpts: Options = { ...opts, tdd: opts.tdd || !!plan.tdd };
    const inv = planToInventory(plan, effOpts);

    if (effOpts.json) {
      process.stdout.write(JSON.stringify(inv, null, 2) + "\n");
      return;
    }

    const result = render(inv, effOpts);
    writeOutput(result, effOpts);
    // CONTEXT.md + ADRs: write only if absent so agent-authored versions win.
    const docs = writeArtifactsIfAbsent(renderScratchDocs(plan), effOpts.out);
    const adrCount = docs.filter((p) => p.startsWith("docs/adr/")).length;

    const lines = [
      `reconstruct: planned ${inv.repoName} from scratch (${inv.features.length} feature(s))`,
      `  stack:    ${inv.stack.primaryLanguage}${inv.stack.frameworks.length ? " · " + inv.stack.frameworks.join(", ") : ""}`,
      `  surface:  ${inv.features.length} feature(s) · ${inv.interfaces?.length ?? 0} interface(s) · ${inv.dataModel?.length ?? 0} entit(y/ies) · ${inv.i18n ? inv.i18n.locales.length : 0} locale(s)`,
      `  docs:     ${docs.includes("CONTEXT.md") ? "CONTEXT.md" : "CONTEXT.md (kept existing)"}${adrCount ? ` + ${adrCount} ADR(s)` : ""} (written if absent)`,
      ...(consistency.warnings.length
        ? [
            `  warnings: ${consistency.warnings.length} consistency warning(s) to resolve while enriching:`,
            ...consistency.warnings.map((w) => `    ⚠ ${w}`),
          ]
        : []),
      ...(effOpts.tdd ? [`  tdd:      test-first build guidance embedded in the PRDs`] : []),
      ...(effOpts.summary ? [`  summary:  SUMMARY.md (one-page digest)`] : []),
      ...(effOpts.features ? [`  features: FEATURES.md (feature PRDs only)`] : []),
      ...(effOpts.specs ? [`  specs:    SPECS.md (whole spec, source stripped)`] : []),
      ...(effOpts.merge ? [`  merged:   RECONSTRUCTION.md (whole tree in one file)`] : []),
      `  output:   ${effOpts.out}`,
      `  next:     open ${join(effOpts.out, effOpts.merge ? "RECONSTRUCTION.md" : "REBUILD.md")}`,
    ];
    process.stderr.write(lines.join("\n") + "\n");
    return;
  }

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
      ...(opts.features ? ["FEATURES.md"] : []),
      ...(opts.specs ? ["SPECS.md"] : []),
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
    ...(inv.workspaces
      ? [
          `  monorepo: ${inv.workspaces.length} workspace(s) · ${inv.workspaces.reduce(
            (n, w) => n + (w.dependsOn?.length ?? 0),
            0,
          )} dependency edge(s)`,
        ]
      : []),
    `  excluded: ${inv.excludedCount} file(s) skipped by ignore rules${opts.include.length || opts.exclude.length ? " + scoping globs" : ""}`,
    ...(inv.unknowns.length ? [`  unknowns: ${inv.unknowns.length} item(s) for the agent to resolve (see inventory.json)`] : []),
    `  mode/level/fidelity/granularity: ${opts.mode}/${opts.level}/${opts.fidelity}/${opts.granularity}`,
    ...(opts.summary ? [`  summary:  SUMMARY.md (one-page digest)`] : []),
    ...(opts.features ? [`  features: FEATURES.md (feature PRDs only)`] : []),
    ...(opts.specs ? [`  specs:    SPECS.md (whole spec, source stripped)`] : []),
    ...(opts.merge ? [`  merged:   RECONSTRUCTION.md (whole tree in one file)`] : []),
    `  output:   ${opts.out}`,
    `  next:     open ${join(opts.out, opts.merge ? "RECONSTRUCTION.md" : "REBUILD.md")}`,
  ];
  process.stderr.write(lines.join("\n") + "\n");
}

// Only run when invoked directly (node scripts/analyze.mjs), not when imported
// (e.g. by tests that exercise parseArgs). Compare *real* paths: Node resolves
// import.meta.url to the canonical (symlink-resolved) path, but process.argv[1]
// is left as-typed. On a symlinked invocation path — e.g. macOS `/tmp` -> the
// real `/private/tmp`, or a globally-linked skill folder — a raw URL compare
// silently fails and main() never runs (exit 0, no output). Realpath both sides
// first, then fall back to the URL compare if a path can't be resolved.
function isInvokedDirectly(): boolean {
  const argv1 = process.argv[1];
  if (argv1 === undefined) return false;
  const modulePath = fileURLToPath(import.meta.url);
  try {
    if (realpathSync(argv1) === realpathSync(modulePath)) return true;
  } catch {
    // a path may not exist on disk (e.g. a virtual entry) — fall through
  }
  return import.meta.url === pathToFileURL(argv1).href;
}
if (isInvokedDirectly()) main();
