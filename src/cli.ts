import { resolve, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync, statSync, realpathSync } from "node:fs";
import { analyze } from "./analyze.js";
import { render } from "./prd/render.js";
import { writeOutput, writeArtifactsIfAbsent, detectEnrichment, formatEnrichmentRefusal } from "./output.js";
import { bundleExisting } from "./postprocess.js";
import { loadPlan, planToInventory, renderScratchDocs, validatePlanConsistency } from "./scratch.js";
import { checkOutput, formatCheckReport } from "./check.js";
import { runVerify, applyVerdicts, foldSemantic, formatVerifyReport } from "./verify.js";
import { runReview, applyFindings, foldReview, formatReviewReport } from "./review.js";
import { runBrainstorm } from "./brainstorm.js";
import { PHASES, listPhases, orchestrateRun } from "./orchestrate.js";
import { runStdioServer } from "./mcp/stdio.js";
import { startHttpServer } from "./mcp/http.js";
import { VERSION } from "./types.js";
import type { Fidelity, Granularity, Level, Mode, Options, RenderResult } from "./types.js";

const HELP = `reconstruct v${VERSION}
Analyze a repository and generate reconstruction PRDs to rebuild it from scratch.

Usage:
  reconstruct [--repo <path>] [--out <path>] [options]
  reconstruct --scratch --plan <plan.json> [--out <path>] [options]
  reconstruct --orchestrate [--phase <p>] [--eco] [--list] --out <path>

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
  --verify             Write a requirement→source verification worklist for --out
  --review             Write the AI buildability review worklist for --out
  --brainstorm         Scaffold a BRAINSTORM.md into --out (divergent phase before building)
  --mcp                Serve the tree over the Model Context Protocol, for a non-Claude-Code
                       host (Cursor, Zed, Claude Desktop). Read-only unless --allow-write.
                       With --transport stdio|http · --out <tree> · --port · --bind ·
                       --allow-origin · --allow-remote · --max-response-bytes
  --orchestrate        Emit the multi-agent orchestration for --out's CURRENT worklists
                       (per-phase workflows + agent contracts + RUNBOOK) into <out>/orchestration/
  --phase <name>       --orchestrate: emit one phase only — enrich-map | review-find |
                       review-verify | adjudicate (exit 2 if its worklist is missing)
  --eco                --orchestrate: emit only RUNBOOK.md + agents/*.md (sequential low-token path)
  --list               --orchestrate: print the {"phases":[...]} readiness JSON, write nothing
  --batch-size <n>     --orchestrate: items per subagent (default: per-phase, see below)
  --max-verify <n>     --verify: cap the requirement↔evidence worklist (default: 60)
  --force              Overwrite an --out tree that already holds ENRICHED prose
  --apply <path>       Apply an agent-filled verdicts/findings file (--verify/--review)
  --semantic           Fold VERIFY.json + REVIEW.json into --check (fail on unsupported reqs / blockers)
  --allow-unverified   With --check --semantic: downgrade a missing/unreadable ledger to a warning
  --include <glob>     Only analyze files matching glob (repeatable, comma-ok)
  --exclude <glob>     Skip files matching glob          (repeatable, comma-ok)
  --max-embed-bytes N  Max bytes embedded per file      (default: 16000)
  --merge              Also write RECONSTRUCTION.md (whole tree in one file)
  --summary            SUMMARY.md is written on every run; this only selects it
                       for the standalone (no --repo) bundling post-step
  --features           Also write FEATURES.md (every feature PRD, nothing else)
  --specs              Also write SPECS.md (whole spec, source code stripped — implement from this)
  --json               Print the inventory JSON only, write nothing
  -h, --help           Show this help
  -v, --version        Show version

Fidelity defaults:
  preserve+light  -> mirror     preserve+complex -> embed
  redesign+light  -> embed      redesign+complex -> describe

Brainstorm (optional divergent phase, before building):
  --brainstorm scaffolds a BRAINSTORM.md into --out — a divergent worklist for
  generating 3+ genuinely different directions, scoring them, and converging on
  one (with 🧠 callouts so --check gates an un-enriched brainstorm). If --out is
  an existing reconstruction (has inventory.json), it seeds the recovered surface
  so you brainstorm evolutions of what's built. Feed the chosen direction to the
  greenfield interview, or to iteration PRDs. See references/brainstorm-playbook.md.
    reconstruct --brainstorm --out ./ideas            # a fresh idea
    reconstruct --brainstorm --out ./reconstruction   # evolve an existing one

Orchestration (fan the judgment phases out to subagents):
  --orchestrate reads --out's CURRENT worklists and emits, per ready phase, a
  launchable multi-agent workflow (<out>/orchestration/<phase>.workflow.mjs), the
  agents/<role>.md dispatch contracts (drafter/finder/verifier/adjudicator) and a
  sequential RUNBOOK.md fallback. Phases: enrich-map (one drafter per
  inventory.json feature, grouped by workspace), review-find (one finder per
  flagged REVIEW.todo.json unit), review-verify (one independent verifier per
  open REVIEW.json blocker), adjudicate (one adjudicator per VERIFY.todo.json
  pair). Subagents RETURN fragments; the reduce (--review/--verify --apply and
  every doc merge) always stays with the orchestrator. Re-run it whenever a
  worklist changes — emission is deterministic and idempotent.
  Fan-out width: enrich-map/review-find dispatch ONE agent per item (the unit of
  work is a whole PRD); review-verify/adjudicate batch 4 (each item is one short
  judgement). Past 40 agents the batch grows instead of the fleet — always
  reported, never silent. --batch-size <n> overrides all of it.
    reconstruct --orchestrate --out <dir> [--phase <p>] [--eco] [--list]

Re-running over an existing --out:
  A normal (--repo / --scratch) run RE-RENDERS every document, so it would
  overwrite prose an agent already wrote. The CLI detects an ENRICHED tree — a
  document whose 🧠 callouts are all resolved, or a REVIEW.json/VERIFY.json
  ledger — and refuses the run. To continue an existing tree use --check /
  --review / --verify; to re-scaffold, point --out at a new directory; --force
  overwrites and LOSES the enrichment.

From scratch (greenfield):
  --scratch builds the SAME reconstruction tree from a plan.json interview
  instead of a repo. mode/fidelity collapse to scratch/describe; --level still
  applies (complex = deeper interview + alternatives). It also writes CONTEXT.md
  (glossary) and docs/adr/ (decisions), and links them from 00-overview.
    reconstruct --scratch --plan plan.json --out ./reconstruction --level complex

Bundling:
  SUMMARY.md (a one-page digest: stack, features in build order, interface/data
  counts, unknowns) is written on EVERY run — read it to orient instead of
  inventory.json, which carries one entry per analyzed file.
  --merge / --features / --specs during a normal run append the
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

  --review drives the AI buildability review (the semantic layer --check can't
  judge). It writes a per-feature worklist (REVIEW.todo.json/REVIEW.md), flagging
  only the features that changed since the last round. An agent fans out one
  reviewer per flagged feature + one independent verifier per blocker, fills the
  findings, then applies them — the engine reduces them to a pass / no-progress
  signal so the convergence loop terminates (see references/orchestration.md):
    reconstruct --review --out <dir>
    reconstruct --review --apply findings.json --out <dir>
  --check --semantic folds VERIFY.json (refuted/unsupported requirements) and
  REVIEW.json (unresolved blockers) into the gate — additive, never a relaxation.
  It re-reduces the persisted verdicts/findings and re-resolves every cited
  evidenceRef against the inventory (a tampered or stale ok:true never passes),
  and it FAILS CLOSED: a missing or unreadable ledger is an error — run --verify
  and --review first, or pass --allow-unverified to downgrade it to a warning.
  --check, --verify and --review are mutually exclusive (run one at a time).
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
  "apply",
  "phase",
  "max-verify",
  "batch-size",
  // `--mcp` only. The flag set is global, so these are accepted (and ignored)
  // in every other mode — the same as --phase and --batch-size already are.
  "transport",
  "port",
  "bind",
  "allow-origin",
  "max-response-bytes",
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
  let verify = false;
  let review = false;
  let semantic = false;
  let allowUnverified = false;
  let brainstorm = false;
  let orchestrate = false;
  // `--mcp` and its server flags. Serving the tree over MCP is a mode like any
  // other here — this CLI selects modes by flag, not by verb.
  let mcp = false;
  let allowWrite = false;
  let allowRemote = false;
  let eco = false;
  let list = false;
  let force = false;

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
    if (arg === "--verify") {
      verify = true;
      continue;
    }
    if (arg === "--review") {
      review = true;
      continue;
    }
    if (arg === "--semantic") {
      semantic = true;
      continue;
    }
    if (arg === "--allow-unverified") {
      allowUnverified = true;
      continue;
    }
    if (arg === "--brainstorm") {
      brainstorm = true;
      continue;
    }
    if (arg === "--orchestrate") {
      orchestrate = true;
      continue;
    }
    if (arg === "--mcp") {
      mcp = true;
      continue;
    }
    if (arg === "--allow-write") {
      allowWrite = true;
      continue;
    }
    if (arg === "--allow-remote") {
      allowRemote = true;
      continue;
    }
    if (arg === "--eco") {
      eco = true;
      continue;
    }
    if (arg === "--list") {
      list = true;
      continue;
    }
    if (arg === "--force") {
      force = true;
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

  // The three validation actions are mutually exclusive: main() dispatches them in
  // a fixed order, so combining them silently runs one and drops the rest (e.g.
  // `--verify --review --apply` would adjudicate review findings as verify verdicts
  // and print a false green; `--check --review` would skip the check entirely).
  // Reject the combination instead of picking a winner. (`--semantic` modifies
  // `--check`; `--apply` modifies `--verify`/`--review`; `--phase`/`--eco`/`--list`
  // modify `--orchestrate` — those are not actions.)
  const actions = [check, verify, review, brainstorm, orchestrate].filter(Boolean).length;
  if (actions > 1) {
    fail(`--check, --verify, --review, --brainstorm and --orchestrate are mutually exclusive — run one at a time`);
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
  const standalone = (merge || summary || features || specs) && !json && !scratch && raw.repo === undefined;

  const repo = resolve(raw.repo ?? process.cwd());
  // Scratch reads no repo; standalone, --check, --verify, --review, --brainstorm
  // and --orchestrate read/write an existing output dir — all skip the repo-exists check.
  if (!standalone && !scratch && !check && !verify && !review && !brainstorm && !orchestrate && (!existsSync(repo) || !statSync(repo).isDirectory())) {
    fail(`repo path is not a directory: ${repo}`);
  }
  const level = oneOf<Level>("level", raw.level ?? "light", ["light", "complex"]);
  // Greenfield collapses mode/fidelity: nothing to preserve, no source to mirror.
  const mode = scratch ? ("scratch" as Mode) : oneOf<Mode>("mode", raw.mode ?? "preserve", ["preserve", "redesign"]);
  const fidelity = scratch
    ? ("describe" as Fidelity)
    : oneOf<Fidelity>("fidelity", raw.fidelity ?? defaultFidelity(mode, level), ["mirror", "embed", "describe"]);
  const granularity = oneOf<Granularity>("granularity", raw.granularity ?? "coarse", ["coarse", "fine"]);
  const out = resolve(
    raw.out ??
      (standalone || check || verify || review || brainstorm || orchestrate
        ? process.cwd()
        : scratch
          ? join(process.cwd(), "reconstruction")
          : join(repo, "reconstruction")),
  );
  const maxEmbedBytes = raw["max-embed-bytes"] ? Number(raw["max-embed-bytes"]) : 16000;
  // `--mcp` server knobs, read the same way as every other valued flag.
  const transport = raw.transport ?? "stdio";
  const port = raw.port ? Number(raw.port) : 7343;
  const bind = raw.bind;
  const allowOrigin = raw["allow-origin"];
  const maxResponseBytes = raw["max-response-bytes"] ? Number(raw["max-response-bytes"]) : undefined;
  if (!Number.isFinite(maxEmbedBytes) || maxEmbedBytes <= 0) {
    fail(`invalid --max-embed-bytes`);
  }
  const positive = (key: string): number | undefined => {
    if (raw[key] === undefined) return undefined;
    const n = Number(raw[key]);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) fail(`invalid --${key}: expected a positive integer`);
    return n;
  };
  const maxVerify = positive("max-verify");
  const batchSize = positive("batch-size");

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
    verify,
    review,
    apply: raw.apply ?? "",
    semantic,
    allowUnverified,
    brainstorm,
    orchestrate,
    mcp,
    mcpServer: { transport, port, bind, allowOrigin, maxResponseBytes, allowWrite, allowRemote },
    phase: raw.phase ?? "",
    eco,
    list,
    force,
    ...(maxVerify !== undefined ? { maxVerify } : {}),
    ...(batchSize !== undefined ? { batchSize } : {}),
  };
}

/**
 * Refuse to re-render over agent-written prose. `writeOutput` overwrites every
 * artifact it renders, so pointing a fresh `--repo`/`--scratch` run at an
 * enriched tree destroys the work with no warning and no undo. Runs that write
 * nothing (`--json`) and explicit `--force` skip the guard.
 */
function guardEnrichedOutput(opts: Options): void {
  if (opts.force || opts.json) return;
  const witnesses = detectEnrichment(opts.out);
  if (witnesses.length) fail(formatEnrichmentRefusal(opts.out, witnesses));
}

// Async because `--mcp` serves a long-lived server; every other mode is
// synchronous and returns immediately, so nothing else changes shape.
async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  // Requirement-support verification: write the worklist, or apply verdicts.
  if (opts.verify) {
    try {
      if (opts.apply) {
        const r = applyVerdicts(opts.out, resolve(opts.apply));
        process.stdout.write(formatVerifyReport(r) + "\n");
        if (!r.ok) process.exit(1);
        return;
      }
      const wl = runVerify(opts.out, { ...(opts.maxVerify !== undefined ? { maxVerify: opts.maxVerify } : {}) });
      const { total, kept, capped } = wl.coverage;
      process.stderr.write(
        `reconstruct: ${kept} requirement↔evidence pair(s) → ${opts.out}/VERIFY.md & VERIFY.todo.json\n` +
          // Never let a capped worklist read as full coverage.
          (capped
            ? `  ⚠ coverage: ${kept} of ${total} requirement(s) — CAPPED; the other ${total - kept} go unadjudicated (raise with --max-verify ${total})\n`
            : "") +
          `  adjudicate each verdict, save as verdicts.json, then: node scripts/analyze.mjs --verify --apply verdicts.json --out ${opts.out}\n`,
      );
      return;
    } catch (e) {
      fail((e as Error).message);
    }
  }

  // AI buildability review: write the per-feature worklist, or reduce findings.
  if (opts.review) {
    try {
      if (opts.apply) {
        const r = applyFindings(opts.out, resolve(opts.apply));
        process.stdout.write(formatReviewReport(r) + "\n");
        if (!r.ok) process.exit(1);
        return;
      }
      const wl = runReview(opts.out);
      const due = wl.units.filter((u) => u.needsReview).length;
      process.stderr.write(
        `reconstruct: review round ${wl.round} — ${due}/${wl.units.length} unit(s) to review → ${opts.out}/REVIEW.md & REVIEW.todo.json\n` +
          `  review each flagged unit (+ verify each blocker), save findings.json, then: node scripts/analyze.mjs --review --apply findings.json --out ${opts.out}\n`,
      );
      return;
    } catch (e) {
      fail((e as Error).message);
    }
  }

  // Serve the tree over the Model Context Protocol. Returns only when the
  // server stops, so nothing below runs while it is still listening.
  if (opts.mcp) {
    const srv = opts.mcpServer ?? { transport: "stdio", port: 7343, allowWrite: false, allowRemote: false };
    const { transport, port, bind, allowOrigin, maxResponseBytes } = srv;
    if (transport !== "stdio" && transport !== "http") fail(`invalid --transport "${transport}" (expected: stdio, http)`);
    if (maxResponseBytes !== undefined && (!Number.isFinite(maxResponseBytes) || maxResponseBytes <= 0)) fail("invalid --max-response-bytes");
    const serverOpts = {
      // A default tree makes `out` optional on every tool except the scaffold,
      // which never inherits a target it could overwrite.
      defaultOut: opts.out,
      allowWrite: srv.allowWrite,
      maxResponseBytes,
    };

    if (transport === "stdio") {
      // Nothing is written to stdout here: from this point stdout carries
      // JSON-RPC frames only, and runStdioServer guards that.
      await runStdioServer(serverOpts);
      return;
    }

    if (!Number.isInteger(port) || port < 0 || port > 65535) fail("invalid --port");
    const origins = allowOrigin
      ? allowOrigin
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : undefined;
    let running: Awaited<ReturnType<typeof startHttpServer>>;
    try {
      running = await startHttpServer({ ...serverOpts, port, bind, allowOrigin: origins, allowRemote: srv.allowRemote });
    } catch (e) {
      fail((e as Error).message);
    }
    // stderr, not stdout: an HTTP server's stdout is not a protocol stream, but
    // keeping the two transports identical here means no one has to remember
    // which is which.
    process.stderr.write(`reconstruct: MCP server listening on ${running.url}\n`);
    process.stderr.write(`  client: claude mcp add --transport http reconstruct ${running.url}\n`);
    for (const sig of ["SIGINT", "SIGTERM"] as const) {
      process.once(sig, () => {
        void running.close().then(() => process.exit(0));
      });
    }
    await new Promise<void>((res) => running.server.once("close", res));
    return;
  }

  // Divergent-phase scaffold: write BRAINSTORM.md (seeded if --out already has a
  // reconstruction) for the agent to fill, then gate with --check.
  if (opts.brainstorm) {
    const r = runBrainstorm(opts.out);
    process.stderr.write(
      `reconstruct: ${r.created ? "wrote" : "kept existing"} ${r.relPath}${r.seeded ? " (seeded from the recovered surface)" : " (blank scaffold)"} → ${opts.out}\n` +
        `  fill in the concepts + chosen direction, then gate it: node scripts/analyze.mjs --check --out ${opts.out}\n`,
    );
    return;
  }

  // Orchestration: emit the multi-agent fan-out (workflows + contracts + RUNBOOK)
  // from --out's CURRENT worklists. Family-standard exit codes: 2 on a missing
  // out dir, an unknown phase, or a phase whose worklist does not exist yet.
  if (opts.orchestrate) {
    const engineAbs = realpathSync(fileURLToPath(import.meta.url));
    if (opts.list) {
      if (!existsSync(opts.out)) {
        process.stderr.write(`reconstruct --orchestrate: out dir not found: ${opts.out}\n`);
        process.exit(2);
      }
      process.stdout.write(JSON.stringify({ phases: listPhases(opts.out, engineAbs, opts.batchSize) }, null, 2) + "\n");
      return;
    }
    const res = orchestrateRun(opts.out, engineAbs, {
      phase: opts.phase || undefined,
      eco: opts.eco,
      ...(opts.batchSize !== undefined ? { batchSize: opts.batchSize } : {}),
    });
    if (res.exitCode !== 0) {
      for (const e of res.errors) process.stderr.write(`reconstruct --orchestrate: ${e}\n`);
      process.exit(res.exitCode);
    }
    process.stdout.write(`reconstruct --orchestrate: generated\n${res.written.map((w) => `  ${w}`).join("\n")}\n`);
    for (const n of res.notices) process.stderr.write(`reconstruct --orchestrate: note — ${n}\n`);
    const workflows = res.written.filter((w) => w.endsWith(".workflow.mjs"));
    if (workflows.length) {
      process.stdout.write(
        `\n${workflows.map((w) => `Launch: Workflow({ scriptPath: ${JSON.stringify(w)} })`).join("\n")}\n` +
          `Then fold the returned fragments in yourself (single serial reducer) and run the fold command shown at the end of each workflow.\n`,
      );
    } else {
      process.stdout.write(`Follow ${join(opts.out, "orchestration", "RUNBOOK.md")} sequentially (the eco path).\n`);
    }
    // Surface the valid phase names once, so a scripted caller can discover them without --help.
    if (!opts.phase && workflows.length === 0 && !opts.eco) {
      process.stderr.write(`reconstruct --orchestrate: no ready phase — phases are ${PHASES.join(", ")} (see --list).\n`);
    }
    return;
  }

  // Validation mode: statically check an already-generated tree for buildability.
  if (opts.check) {
    const result = checkOutput(opts.out);
    if (opts.semantic) {
      foldSemantic(opts.out, result, { allowUnverified: opts.allowUnverified });
      foldReview(opts.out, result, { allowUnverified: opts.allowUnverified });
    }
    process.stdout.write(formatCheckReport(result, opts.out) + "\n");
    if (result.errors.length) process.exit(1);
    return;
  }

  if (opts.scratch) {
    let plan: ReturnType<typeof loadPlan>;
    try {
      plan = loadPlan(opts.plan);
    } catch (e) {
      fail((e as Error).message);
    }
    // Fail fast on an internally inconsistent plan — a buildable tree starts
    // with a plan whose features, entities, interfaces and enums line up.
    const consistency = validatePlanConsistency(plan);
    if (consistency.errors.length) {
      fail(`plan.json is internally inconsistent (fix these before rendering):\n  - ` + consistency.errors.join("\n  - "));
    }
    // The plan can request TDD too; OR it with the --tdd flag.
    const effOpts: Options = { ...opts, tdd: opts.tdd || !!plan.tdd };
    const inv = planToInventory(plan, effOpts);

    if (effOpts.json) {
      process.stdout.write(JSON.stringify(inv, null, 2) + "\n");
      return;
    }

    guardEnrichedOutput(effOpts);
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
        ? [`  warnings: ${consistency.warnings.length} consistency warning(s) to resolve while enriching:`, ...consistency.warnings.map((w) => `    ⚠ ${w}`)]
        : []),
      ...(effOpts.tdd ? [`  tdd:      test-first build guidance embedded in the PRDs`] : []),
      ...(effOpts.features ? [`  features: FEATURES.md (feature PRDs only)`] : []),
      ...(effOpts.specs ? [`  specs:    SPECS.md (whole spec, source stripped)`] : []),
      ...(effOpts.merge ? [`  merged:   RECONSTRUCTION.md (whole tree in one file)`] : []),
      `  output:   ${effOpts.out}`,
      `  next:     read ${join(effOpts.out, "SUMMARY.md")} to orient, then ${join(effOpts.out, effOpts.merge ? "RECONSTRUCTION.md" : "REBUILD.md")}`,
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

  let inv: ReturnType<typeof analyze>;
  try {
    inv = analyze(opts);
  } catch (e) {
    fail((e as Error).message);
  }

  if (opts.json) {
    process.stdout.write(JSON.stringify(inv, null, 2) + "\n");
    return;
  }

  guardEnrichedOutput(opts);
  try {
    const result = render(inv, opts);
    writeOutput(result, opts);
  } catch (e) {
    fail((e as Error).message);
  }

  const hintTotal =
    inv.hints.routeCandidates.length +
    inv.hints.apiCandidates.length +
    inv.hints.schemaCandidates.length +
    inv.hints.realtimeCandidates.length +
    inv.hints.authCandidates.length +
    inv.hints.designSystemCandidates.length;
  const lines = [
    `reconstruct: analyzed ${inv.fileCount} files (${inv.totalLines} lines) in ${inv.repoName}`,
    `  stack:    ${inv.stack.primaryLanguage}${inv.stack.frameworks.length ? " · " + inv.stack.frameworks.join(", ") : ""}`,
    `  libs:     ${inv.stack.libraries.length ? inv.stack.libraries.join(", ") : "—"}`,
    `  features: ${inv.features.length} · routes: ${inv.routes.length} · locales: ${inv.i18n ? inv.i18n.locales.length : 0}`,
    `  hints:    ${hintTotal} candidate(s) to verify (routes/API/schema/realtime/auth/design-system) · ${inv.hints.entryPoints.length} entry point(s)`,
    ...(inv.workspaces
      ? [`  monorepo: ${inv.workspaces.length} workspace(s) · ${inv.workspaces.reduce((n, w) => n + (w.dependsOn?.length ?? 0), 0)} dependency edge(s)`]
      : []),
    `  excluded: ${inv.excludedCount} file(s) skipped by ignore rules${opts.include.length || opts.exclude.length ? " + scoping globs" : ""}`,
    ...(inv.warnings?.length
      ? [`  warnings: ${inv.warnings.length} analysis warning(s) — detection degraded, verify these by hand:`, ...inv.warnings.map((w) => `    ⚠ ${w}`)]
      : []),
    ...(inv.unknowns.length ? [`  unknowns: ${inv.unknowns.length} item(s) for the agent to resolve (see inventory.json)`] : []),
    `  mode/level/fidelity/granularity: ${opts.mode}/${opts.level}/${opts.fidelity}/${opts.granularity}`,
    ...(opts.features ? [`  features: FEATURES.md (feature PRDs only)`] : []),
    ...(opts.specs ? [`  specs:    SPECS.md (whole spec, source stripped)`] : []),
    ...(opts.merge ? [`  merged:   RECONSTRUCTION.md (whole tree in one file)`] : []),
    `  output:   ${opts.out}`,
    // Orient from SUMMARY.md, not inventory.json: same picture, a fraction of the
    // tokens (inventory.json carries one entry per analyzed file).
    `  next:     read ${join(opts.out, "SUMMARY.md")} to orient, then ${join(opts.out, opts.merge ? "RECONSTRUCTION.md" : "REBUILD.md")}`,
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
if (isInvokedDirectly()) {
  main().catch((e) => {
    process.stderr.write(`reconstruct: ${(e as Error).message}\n`);
    process.exit(1);
  });
}
