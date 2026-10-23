import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { analyze, opaqueArtifacts } from "../analyze.js";
import { runBrainstorm } from "../brainstorm.js";
import { checkFindings, checkOutput } from "../check.js";
import { detectEnrichment, formatEnrichmentRefusal, writeOutput } from "../output.js";
import { bundleExisting } from "../postprocess.js";
import { render } from "../prd/render.js";
import { assertReaAvailable, type ReaReport, runRea } from "../rea.js";
import { sha256Hex } from "../evidence.js";
import { foldReview, runReview } from "../review.js";
import { foldSemantic, runVerify } from "../verify.js";
import { applyUnknownUpdates, foldUnknowns, readInventory, readUnknowns, seedUnknowns, UNKNOWNS_FILE } from "../unknowns.js";
import { withTreeLock } from "../tree-lock.js";
import type { Inventory, Options, UnknownsLedger } from "../types.js";
import { recallInventory, rememberInventory, summarizeInventory, VIEW_SECTIONS, viewSection } from "./view.js";

// Where a tool name becomes work. Every handler calls the same library
// functions the CLI does — nothing here shells out to `reconstruct`, and
// nothing here calls cli.ts, whose `fail()` would take the server process down
// with a process.exit on a bad argument.

export interface HandlerDefaults {
  defaultOut?: string;
  allowWrite?: boolean;
}

/**
 * What the caller should do about a failed call. `do_not_repeat_unchanged` is
 * always true: the same arguments will fail the same way, and a model that
 * retries verbatim burns a turn learning nothing.
 */
export interface Recovery {
  kind: "fix_arguments" | "run_first" | "grant_write" | "narrow_request" | "confirm_overwrite";
  hint: string;
  do_not_repeat_unchanged: true;
}

export class ToolError extends Error {
  readonly recovery: Recovery;
  constructor(message: string, recovery: { kind?: Recovery["kind"]; hint?: string } = {}) {
    super(message);
    this.recovery = {
      kind: recovery.kind ?? "fix_arguments",
      hint: recovery.hint ?? "Re-read the tool's input schema and correct the arguments before calling again.",
      do_not_repeat_unchanged: true,
    };
  }
}

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
    throw new ToolError(`no reconstruction tree at ${abs} — scaffold one first with reconstruct_scaffold (it writes there).`, {
      kind: "run_first",
      hint: "Call reconstruct_scaffold for this repo (needs --allow-write), or pass the `out` of an existing tree.",
    });
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
    throw new ToolError(`${name} writes a reconstruction tree to disk and is disabled — start the server with --allow-write to enable it.`, {
      kind: "grant_write",
      hint: "Ask the user to restart the server with --allow-write, or run the equivalent CLI command yourself.",
    });
  }

  // Reads a repo, writes nothing, needs no tree.
  if (name === "reconstruct_inventory") return outcome(handleInventory(args));
  // Pages a remembered inventory, or a tree's inventory.json.
  if (name === "reconstruct_view") return outcome(handleView(args, defaults));

  if (name === "reconstruct_scaffold") {
    const repo = requiredRepo(args);
    const out = str(args.out) ? resolve(str(args.out)!) : join(repo, "reconstruction");
    return await withTreeLock(out, async () => outcome(await handleScaffold(args, repo, out)));
  }

  const out = requiredOut(args, defaults);
  // Serialized per tree: the bundlers read it while a scaffold could be
  // rewriting it, and the worklists are read-merge-write.
  return await withTreeLock(out, async () => outcome(dispatch(name, args, out, defaults.allowWrite === true)));
}

function dispatch(name: string, args: Record<string, unknown>, out: string, allowWrite: boolean): unknown {
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
    case "reconstruct_unknowns":
      return handleUnknowns(args, out, allowWrite);
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
// Containment
// --------------------------------------------------------------------------

function realOr(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
}

function within(real: string, root: string): boolean {
  return real === root || real.startsWith(root.endsWith(sep) ? root : root + sep);
}

// The caller-supplied `repo` is NOT a root of its own: over HTTP that would let
// any client name `/` and read the whole disk. The inventory records no
// absolute repo path, so a listed relative path proves nothing on its own —
// most projects have a `.env`. A repo file is readable only when the tree's
// inventory lists it AND its content still hashes to the recorded value: it is
// byte for byte one of the files this reconstruction was generated from.
function inRepoInventory(real: string, repo: string | undefined, out: string): boolean {
  if (!repo) return false;
  const root = realOr(resolve(repo));
  if (!within(real, root) || real === root) return false;
  const rel = relative(root, real).split(sep).join("/");
  try {
    const inv = JSON.parse(readFileSync(join(out, "inventory.json"), "utf8")) as { files?: { path?: unknown; hash?: unknown }[] };
    const listed = (inv.files ?? []).find((f) => f.path === rel);
    if (typeof listed?.hash !== "string" || statSync(real).size > MAX_READ_BYTES) return false;
    return sha256Hex(readFileSync(real)).slice(0, 16) === listed.hash;
  } catch {
    return false;
  }
}

// --------------------------------------------------------------------------
// Handlers
// --------------------------------------------------------------------------

function handleInventory(args: Record<string, unknown>): unknown {
  const repo = requiredRepo(args);
  const detail = oneOf(args.detail, ["summary", "full"] as const, "detail", "summary");
  const inv = analyze(baseOptions(repo, join(repo, "reconstruction"), args));
  const inventory_id = rememberInventory(inv);
  if (detail === "full") {
    return { repo, inventory_id, inventory: inv, next: "Nothing was written. Run reconstruct_scaffold to turn this into a tree you can enrich." };
  }
  return {
    repo,
    inventory_id,
    summary: summarizeInventory(inv),
    next:
      "Nothing was written. Page any section with reconstruct_view { inventory_id, section } (follow next_offset), " +
      "or run reconstruct_scaffold to turn this into a tree you can enrich.",
  };
}

function handleView(args: Record<string, unknown>, defaults: HandlerDefaults): unknown {
  const section = oneOf(args.section, VIEW_SECTIONS, "section", "files");
  const id = str(args.inventory_id);
  let inv: Inventory | undefined;
  if (id) {
    inv = recallInventory(id);
    if (!inv) {
      throw new ToolError(`inventory ${id} is not in this server's memory (it keeps the 16 most recent; a restart clears them).`, {
        kind: "run_first",
        hint: "Call reconstruct_inventory again for a fresh inventory_id, or pass the `out` of a scaffolded tree instead.",
      });
    }
  } else {
    const out = requiredOut(args, defaults);
    try {
      inv = JSON.parse(readFileSync(join(out, "inventory.json"), "utf8")) as Inventory;
    } catch (e) {
      throw new ToolError(`unreadable inventory.json in ${out}: ${(e as Error).message}`, { kind: "run_first", hint: "Re-scaffold the tree." });
    }
  }
  const page = viewSection(inv, section, { offset: num(args.offset), limit: num(args.limit), filter: str(args.filter) });
  return { ...(id ? { inventory_id: id } : {}), ...page };
}

async function handleScaffold(args: Record<string, unknown>, repo: string, out: string): Promise<unknown> {
  // Refuse to overwrite prose an agent wrote. It is the whole value of the
  // tree and there is no undo — so the refusal names the witnesses rather than
  // asking the caller to guess what would be lost.
  const witnesses = detectEnrichment(out);
  if (witnesses.length && !bool(args.force)) {
    throw new ToolError(formatEnrichmentRefusal(out, witnesses), {
      kind: "confirm_overwrite",
      hint: "Scaffold into a different `out`, or ask the user before passing force:true — it discards enriched prose.",
    });
  }

  const opts = baseOptions(repo, out, args);
  const reaMode = oneOf(args.rea, ["auto", "on", "off"] as const, "rea", "auto");
  const inv = analyze(opts);
  // Same as the CLI: the compiled artifacts go to rea, when it is installed;
  // `rea: "on"` without rea refuses before anything is written.
  const opaque = opaqueArtifacts(inv.files);
  const reaHint = 'Install rea (`npx rea-agents setup`) or call again with rea: "auto" or "off".';
  try {
    assertReaAvailable(reaMode, opaque);
  } catch (e) {
    throw new ToolError((e as Error).message, { hint: reaHint });
  }
  writeOutput(render(inv, opts), opts);
  let rea: ReaReport;
  try {
    rea = await runRea(repo, out, opaque, { mode: reaMode });
  } catch (e) {
    throw new ToolError((e as Error).message, { hint: reaHint });
  }
  return {
    repo,
    out,
    path: join(out, "SUMMARY.md"),
    features: inv.features?.length ?? 0,
    ...(opaque.length
      ? {
          rea: {
            status: rea.status,
            compiledArtifacts: opaque.length,
            inspected: rea.artifacts.filter((a) => a.status === "inspected").length,
            ...(rea.status === "unavailable" ? {} : { index: join(out, "evidence/rea/INDEX.json") }),
            ...(rea.error ? { error: rea.error } : {}),
          },
        }
      : {}),
    next:
      "The scaffold is STRUCTURE with the judgement left blank. Read SUMMARY.md to orient, then resolve every callout it marks — " +
      "the engine never reasons, so nothing in here is analysis until you write it.",
  };
}

function handleCheck(args: Record<string, unknown>, out: string): unknown {
  const repo = str(args.repo);
  const res = checkOutput(out, { repo: repo ? resolve(repo) : undefined });
  // Same fold as `--check --semantic`: the flag used to be echoed back without
  // ever consulting VERIFY.json / REVIEW.json, so a semantic check always passed.
  if (bool(args.semantic)) {
    const allowUnverified = bool(args.allow_unverified);
    foldSemantic(out, res, { allowUnverified });
    foldReview(out, res, { allowUnverified });
  }
  // CheckResult is errors/warnings; the CLI turns that into an exit code. A
  // tool result has no exit code, so the verdict is stated explicitly — a
  // client should not have to infer it from an empty array.
  return {
    out,
    ok: res.errors.length === 0,
    ...res,
    findings: checkFindings(res),
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

function handleUnknowns(args: Record<string, unknown>, out: string, allowWrite: boolean): unknown {
  // Listing is read-only: an absent ledger is seeded in memory, not on disk.
  // Recording updates rewrites what reconstruct_check gates on, so it needs
  // --allow-write.
  if (Array.isArray(args.updates) && !allowWrite) {
    throw new ToolError(
      "reconstruct_unknowns with `updates` rewrites UNKNOWNS.json, which the gate reads — start the server with --allow-write to enable it.",
      {
        kind: "grant_write",
        hint: "Call it without `updates` to list the ledger, or record the changes with the CLI: --unknowns --apply <file> --out <tree>.",
      },
    );
  }
  let ledger: UnknownsLedger;
  try {
    ledger = Array.isArray(args.updates) ? applyUnknownUpdates(out, args.updates) : (readUnknowns(out) ?? seedUnknowns(readInventory(out)));
  } catch (e) {
    throw new ToolError((e as Error).message);
  }
  const gate = { errors: [] as string[], warnings: [] as string[] };
  foldUnknowns(out, gate);
  return {
    out,
    path: join(out, UNKNOWNS_FILE),
    ok: gate.errors.length === 0,
    ...ledger,
    gate,
    next: "Settle each unknown from the source: cite the evidence that answers it (ev_… ids from inventory.json, route/entity refs, path:line) and set status resolved, or record what contradicts it.",
  };
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
  if (!within(real, realOr(out)) && !inRepoInventory(real, repo, out)) {
    throw new ToolError(
      `path is outside the reconstruction tree${repo ? " and is not, byte for byte, a file the tree's inventory lists from that repo" : ""}: ${raw}. Use your own file tool for anything else.`,
      repo
        ? {
            hint: "The file may have changed since the tree was generated (re-run reconstruct_scaffold), or `repo` is not the repository this tree was built from.",
          }
        : {},
    );
  }
  const st = statSync(real);
  if (!st.isFile()) throw new ToolError(`not a file: ${raw}`);
  if (st.size > MAX_READ_BYTES)
    throw new ToolError(`file is too large to read (${st.size} bytes): ${raw}`, { kind: "narrow_request", hint: "Use your own file tool with a byte range." });

  const lines = readFileSync(real, "utf8").split("\n");
  const total = lines.length;
  const start = Math.max(1, Math.floor(num(args.start_line) ?? 1));
  if (start > total)
    throw new ToolError(`start_line ${start} is past the end of the file (${total} lines).`, {
      kind: "narrow_request",
      hint: `Pass a start_line between 1 and ${total}.`,
    });
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
