import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, resolve, sep } from "node:path";
import { analyze } from "../analyze.js";
import { runBrainstorm } from "../brainstorm.js";
import { checkOutput } from "../check.js";
import { detectEnrichment, formatEnrichmentRefusal, writeOutput } from "../output.js";
import { bundleExisting } from "../postprocess.js";
import { render } from "../prd/render.js";
import { runReview } from "../review.js";
import { runVerify } from "../verify.js";
import { withTreeLock } from "../tree-lock.js";
import type { Options } from "../types.js";

// Where a tool name becomes work. Every handler calls the same library
// functions the CLI does — nothing here shells out to `reconstruct`, and
// nothing here calls cli.ts, whose `fail()` would take the server process down
// with a process.exit on a bad argument.

export interface HandlerDefaults {
  defaultOut?: string;
  allowWrite?: boolean;
}

export class ToolError extends Error {}

export interface ToolOutcome {
  text: string;
  artifact?: string;
}

const MAX_READ_LINES = 2000;
const MAX_READ_BYTES = 8 * 1024 * 1024;

const WRITE_TOOL_NAMES = new Set(["reconstruct_scaffold", "reconstruct_brainstorm"]);

// --------------------------------------------------------------------------
// Argument coercion
// --------------------------------------------------------------------------

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function bool(v: unknown): boolean {
  return v === true || v === "true";
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : [];
}

function positive(v: unknown, key: string): number | undefined {
  const n = num(v);
  if (n === undefined) return undefined;
  if (n <= 0) throw new ToolError(`\`${key}\` must be greater than 0.`);
  return n;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], key: string, fallback: T): T {
  const s = str(v);
  if (s === undefined) return fallback;
  if (!(allowed as readonly string[]).includes(s)) throw new ToolError(`\`${key}\` must be one of: ${allowed.join(", ")} (got "${s}")`);
  return s as T;
}

function requiredRepo(args: Record<string, unknown>): string {
  const repo = str(args.repo);
  if (!repo) throw new ToolError("`repo` is required: an absolute path to the repository to analyze.");
  const abs = resolve(repo);
  if (!existsSync(abs)) throw new ToolError(`repo not found: ${abs}`);
  if (!statSync(abs).isDirectory()) throw new ToolError(`\`repo\` is not a directory: ${abs}`);
  return abs;
}

function requiredOut(args: Record<string, unknown>, defaults: HandlerDefaults): string {
  const out = str(args.out) ?? defaults.defaultOut;
  if (!out) throw new ToolError("`out` is required: the reconstruction tree to operate on.");
  if (!isAbsolute(out)) throw new ToolError("`out` must be an absolute path.");
  const abs = resolve(out);
  if (!existsSync(join(abs, "inventory.json"))) {
    throw new ToolError(`no reconstruction tree at ${abs} — scaffold one first with reconstruct_scaffold (it writes there).`);
  }
  return abs;
}

// The MCP counterpart of cli.ts's option assembly. Every field Options declares
// has to be present; the ones that select a CLI MODE are set per handler.
function baseOptions(repo: string, out: string, args: Record<string, unknown> = {}): Options {
  return {
    repo,
    out,
    mode: oneOf(args.mode, ["preserve", "redesign"] as const, "mode", "preserve"),
    level: oneOf(args.level, ["light", "complex"] as const, "level", "light"),
    fidelity: oneOf(args.fidelity, ["mirror", "embed", "describe"] as const, "fidelity", "embed"),
    granularity: oneOf(args.granularity, ["coarse", "fine"] as const, "granularity", "coarse"),
    include: strArray(args.include),
    exclude: strArray(args.exclude),
    json: false,
    maxEmbedBytes: positive(args.max_embed_bytes, "max_embed_bytes") ?? 16_000,
    merge: false,
    summary: false,
    features: false,
    specs: false,
    scratch: false,
    plan: "",
    tdd: false,
    check: false,
    // `standalone` selects the bundle-an-existing-tree path; handleBundle turns
    // it on, everything else walks a repo.
    standalone: false,
  };
}

// --------------------------------------------------------------------------
// Dispatch
// --------------------------------------------------------------------------

export async function callTool(name: string, args: Record<string, unknown>, defaults: HandlerDefaults = {}): Promise<ToolOutcome> {
  if (WRITE_TOOL_NAMES.has(name) && !defaults.allowWrite) {
    throw new ToolError(`${name} writes a reconstruction tree to disk and is disabled — start the server with --allow-write to enable it.`);
  }

  // Reads a repo, writes nothing, needs no tree.
  if (name === "reconstruct_inventory") return outcome(handleInventory(args));

  if (name === "reconstruct_scaffold") {
    const repo = requiredRepo(args);
    const out = str(args.out) ? resolve(str(args.out)!) : join(repo, "reconstruction");
    return await withTreeLock(out, async () => outcome(handleScaffold(args, repo, out)));
  }

  const out = requiredOut(args, defaults);
  // Serialized per tree: the bundlers read it while a scaffold could be
  // rewriting it, and the worklists are read-merge-write.
  return await withTreeLock(out, async () => outcome(dispatch(name, args, out)));
}

function dispatch(name: string, args: Record<string, unknown>, out: string): unknown {
  switch (name) {
    case "reconstruct_check":
      return handleCheck(args, out);
    case "reconstruct_review":
      return handleReview(out);
    case "reconstruct_verify":
      return handleVerify(args, out);
    case "reconstruct_specs":
      return handleBundle(out, "specs");
    case "reconstruct_features":
      return handleBundle(out, "features");
    case "reconstruct_merge":
      return handleBundle(out, "merge");
    case "reconstruct_brainstorm":
      return { out, ...runBrainstorm(out) };
    case "reconstruct_read":
      return handleRead(args, out);
    default:
      // Unreachable: the server rejects an unknown tool before dispatch.
      throw new ToolError(`unknown tool: ${name}`);
  }
}

function outcome(result: unknown): ToolOutcome {
  return { text: JSON.stringify(result, null, 2) + "\n", artifact: artifactFor(result) };
}

// Where an oversized result already exists on disk, so an over-cap refusal can
// point at it instead of just saying no. Every handler here that writes a file
// returns its path under the same key, so this needs no per-tool table.
function artifactFor(result: unknown): string | undefined {
  if (typeof result !== "object" || result === null) return undefined;
  const r = result as Record<string, unknown>;
  return typeof r.path === "string" ? r.path : undefined;
}

// --------------------------------------------------------------------------
// Handlers
// --------------------------------------------------------------------------

function handleInventory(args: Record<string, unknown>): unknown {
  const repo = requiredRepo(args);
  const inv = analyze(baseOptions(repo, join(repo, "reconstruction"), args));
  return { repo, inventory: inv, next: "Nothing was written. Run reconstruct_scaffold to turn this into a tree you can enrich." };
}

function handleScaffold(args: Record<string, unknown>, repo: string, out: string): unknown {
  // Refuse to overwrite prose an agent wrote. It is the whole value of the
  // tree and there is no undo — so the refusal names the witnesses rather than
  // asking the caller to guess what would be lost.
  const witnesses = detectEnrichment(out);
  if (witnesses.length && !bool(args.force)) {
    throw new ToolError(formatEnrichmentRefusal(out, witnesses));
  }

  const opts = baseOptions(repo, out, args);
  const inv = analyze(opts);
  writeOutput(render(inv, opts), opts);
  return {
    repo,
    out,
    path: join(out, "SUMMARY.md"),
    features: inv.features?.length ?? 0,
    next:
      "The scaffold is STRUCTURE with the judgement left blank. Read SUMMARY.md to orient, then resolve every callout it marks — " +
      "the engine never reasons, so nothing in here is analysis until you write it.",
  };
}

function handleCheck(args: Record<string, unknown>, out: string): unknown {
  const res = checkOutput(out);
  // CheckResult is errors/warnings; the CLI turns that into an exit code. A
  // tool result has no exit code, so the verdict is stated explicitly — a
  // client should not have to infer it from an empty array.
  return {
    out,
    ok: res.errors.length === 0,
    ...res,
    semantic: bool(args.semantic),
    note: "Passing means nothing is EMPTY. It cannot see a section that is present and says nothing — that is reconstruct_review's job.",
  };
}

function handleReview(out: string): unknown {
  return { out, ...runReview(out), next: "Per feature, decide what a builder would still have to guess — then write it in." };
}

function handleVerify(args: Record<string, unknown>, out: string): unknown {
  const res = runVerify(out, { maxVerify: positive(args.max_verify, "max_verify") });
  return {
    ...res,
    out,
    next: "For each pair, read the original source and judge whether it really does what the PRD claims.",
  };
}

function handleBundle(out: string, kind: "specs" | "features" | "merge"): unknown {
  const opts: Options = { ...baseOptions("", out), standalone: true, [kind]: true };
  let result: ReturnType<typeof bundleExisting>;
  try {
    result = bundleExisting(opts);
  } catch (e) {
    throw new ToolError((e as Error).message);
  }
  writeOutput(result, opts);
  const file = kind === "specs" ? "SPECS.md" : kind === "features" ? "FEATURES.md" : "RECONSTRUCTION.md";
  return { out, path: join(out, file), bundle: kind };
}

function handleRead(args: Record<string, unknown>, out: string): unknown {
  const raw = str(args.path);
  if (!raw) throw new ToolError("`path` is required — relative to the tree, or an absolute path inside the tree or the repo.");
  const repo = str(args.repo);
  const target = isAbsolute(raw) ? raw : join(out, raw);

  // Containment on the REALPATH: a symlink inside the tree normalises cleanly
  // as a string and only escapes once the filesystem resolves it. This server
  // can be reached over HTTP.
  let real: string;
  try {
    real = realpathSync(target);
  } catch {
    throw new ToolError(`no such file: ${raw}`);
  }
  const roots = [out, ...(repo ? [resolve(repo)] : [])].map((d) => {
    try {
      return realpathSync(d);
    } catch {
      return resolve(d);
    }
  });
  if (!roots.some((root) => real === root || real.startsWith(root + sep))) {
    throw new ToolError(`path is outside the reconstruction tree${repo ? " and the repo" : ""}: ${raw}. Use your own file tool for anything else.`);
  }

  const st = statSync(real);
  if (!st.isFile()) throw new ToolError(`not a file: ${raw}`);
  if (st.size > MAX_READ_BYTES) throw new ToolError(`file is too large to read (${st.size} bytes): ${raw}`);

  const lines = readFileSync(real, "utf8").split("\n");
  const total = lines.length;
  const start = Math.max(1, Math.floor(num(args.start_line) ?? 1));
  if (start > total) throw new ToolError(`start_line ${start} is past the end of the file (${total} lines).`);
  const requestedEnd = Math.floor(num(args.end_line) ?? total);
  const end = Math.min(total, Math.max(start, requestedEnd), start + MAX_READ_LINES - 1);

  return {
    path: isAbsolute(raw) ? real : raw,
    start_line: start,
    end_line: end,
    total_lines: total,
    truncated: end < Math.min(total, requestedEnd),
    content: lines.slice(start - 1, end).join("\n"),
  };
}
