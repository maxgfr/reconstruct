import { type ChildProcess, spawn } from "node:child_process";
import { accessSync, constants, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { delimiter, isAbsolute, join, resolve } from "node:path";
import { REA_EVIDENCE_DIR } from "./evidence.js";

// rea, underneath. When the repo ships compiled artifacts the source walk cannot
// read (a native library, a .wasm module, an Electron .asar, an APK…) and the
// rea reverse-engineering MCP server is installed, the engine drives it itself
// over stdio: one static inspection per artifact, the results and rea's own
// evidence bundle written into `<out>/evidence/rea/`, so every `rea:ev_…` id in
// them is citable from the first scaffold on. Nothing here is required: rea is
// looked up, never installed, and any failure is recorded, never fatal.

export type ReaMode = "off" | "auto" | "on";

/** The per-run record written to `evidence/rea/INDEX.json`. */
export interface ReaReport {
  status: "ran" | "unavailable" | "failed";
  bin?: string;
  error?: string;
  artifacts: Array<{
    path: string;
    status: "inspected" | "failed" | "skipped";
    tool?: string;
    file?: string;
    evidenceIds: string[];
    error?: string;
    /** rea's exported bundles for this artifact (session chains export before closing). */
    bundles?: string[];
    /** Probes that did not apply or need a backend the user has not installed. */
    notes?: string[];
  }>;
  bundle?: string;
}

export interface ReaRunOptions {
  mode: ReaMode;
  /** Per-call deadline. Native analysis can take minutes on a large binary. */
  timeoutMs?: number;
  /** At most this many artifacts per run; the rest are recorded as skipped. */
  maxArtifacts?: number;
  env?: NodeJS.ProcessEnv;
}

const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_MAX_ARTIFACTS = 25;
const PROTOCOL_VERSION = "2025-06-18";

// Static inspection only: every tool here parses the file and none launches
// it. rea also has tools that RUN the target (capture_process_scenario,
// capture_electron_scenario…) or shell out to decoders; the engine never calls
// anything outside this list.
const STATIC_TOOLS = new Set([
  "analyze_javascript_application",
  "inspect_wasm_artifact",
  "inspect_android_package",
  "identify_flutter_build",
  "inspect_managed_artifact",
  "inspect_pe_resources",
  "inspect_binary_layout",
  "inspect_macho",
  "inspect_go_binary",
  "inspect_rust_binary",
  "open_binary",
  "inspect_artifact",
  "binary_overview",
  "close_binary",
  "export_evidence_bundle",
]);

/** The rea executable: `REA_BIN`, else `rea` on PATH. Null when absent. */
export function locateRea(env: NodeJS.ProcessEnv = process.env): string | null {
  const executable = (p: string): boolean => {
    try {
      if (!statSync(p).isFile()) return false;
      accessSync(p, process.platform === "win32" ? constants.F_OK : constants.X_OK);
      return true;
    } catch {
      return false;
    }
  };
  if (env.REA_BIN) {
    const p = resolve(env.REA_BIN);
    return executable(p) ? p : null;
  }
  const names = process.platform === "win32" ? ["rea.cmd", "rea.exe", "rea"] : ["rea"];
  for (const dir of (env.PATH ?? "").split(delimiter)) {
    if (!dir || !isAbsolute(dir)) continue;
    for (const n of names) if (executable(join(dir, n))) return join(dir, n);
  }
  return null;
}

/**
 * `--rea on` with compiled artifacts to inspect but no rea installed: throw.
 * Callers run it before writing anything, so a refused run leaves no tree.
 */
export function assertReaAvailable(mode: ReaMode, artifacts: string[], env: NodeJS.ProcessEnv = process.env): void {
  if (mode === "on" && artifacts.length > 0 && !locateRea(env)) {
    throw new Error("--rea on: the rea executable was not found (set REA_BIN, or install it: `npx rea-agents setup`, Node 22+)");
  }
}

interface ToolDecl {
  name: string;
  inputSchema?: { properties?: Record<string, { type?: unknown }>; required?: string[] };
}

/** A minimal MCP client over newline-delimited JSON-RPC on a child's stdio. */
class StdioClient {
  private nextId = 1;
  private buffer = "";
  private readonly pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  private stderr = "";
  private exited: Error | null = null;

  constructor(private readonly child: ChildProcess) {
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => this.onData(chunk));
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      if (this.stderr.length < 4096) this.stderr += chunk;
    });
    const fail = (why: string) => {
      this.exited = new Error(`${why}${this.stderr.trim() ? `: ${this.stderr.trim().slice(0, 400)}` : ""}`);
      for (const p of this.pending.values()) {
        clearTimeout(p.timer);
        p.reject(this.exited);
      }
      this.pending.clear();
    };
    child.on("error", (e) => fail(`rea could not start (${e.message})`));
    child.on("exit", (code, signal) => fail(`rea exited (${signal ?? code})`));
    child.stdin?.on("error", () => {
      // EPIPE after the child died: the exit handler reports it.
    });
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let nl = this.buffer.indexOf("\n");
    while (nl !== -1) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (line) this.onMessage(line);
      nl = this.buffer.indexOf("\n");
    }
  }

  private onMessage(line: string): void {
    let msg: { id?: unknown; method?: unknown; result?: unknown; error?: { message?: unknown } };
    try {
      msg = JSON.parse(line);
    } catch {
      return; // stray output on stdout; not ours to interpret
    }
    if (typeof msg.method === "string") {
      // A server→client request (roots/list, sampling…): we offer none.
      if (msg.id !== undefined) this.send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "not supported by reconstruct" } });
      return;
    }
    const p = typeof msg.id === "number" ? this.pending.get(msg.id) : undefined;
    if (!p) return;
    this.pending.delete(msg.id as number);
    clearTimeout(p.timer);
    if (msg.error) p.reject(new Error(String(msg.error.message ?? "rea returned an error")));
    else p.resolve(msg.result);
  }

  private send(msg: unknown): void {
    this.child.stdin?.write(`${JSON.stringify(msg)}\n`);
  }

  request(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
    if (this.exited) return Promise.reject(this.exited);
    const id = this.nextId++;
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out after ${Math.round(timeoutMs / 1000)}s`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolvePromise, reject, timer });
      this.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  notify(method: string, params?: unknown): void {
    this.send({ jsonrpc: "2.0", method, ...(params ? { params } : {}) });
  }

  close(): void {
    for (const p of this.pending.values()) clearTimeout(p.timer);
    this.pending.clear();
    this.child.stdin?.end();
    this.child.kill();
  }
}

/** The argument a tool takes its target path in, read from its schema. */
function pathArg(tool: ToolDecl): string | undefined {
  const props = Object.entries(tool.inputSchema?.properties ?? {}).filter(([, s]) => s?.type === undefined || s.type === "string");
  const required = new Set(tool.inputSchema?.required ?? []);
  const named = (re: RegExp) => props.find(([k]) => re.test(k) && required.has(k))?.[0] ?? props.find(([k]) => re.test(k))?.[0];
  return named(/^(path|target|file|artifact|input)(_path)?$/i) ?? named(/path|target|file/i);
}

function callArgs(tool: ToolDecl, target: string): Record<string, unknown> | undefined {
  const arg = pathArg(tool);
  if (!arg) return undefined;
  const props = tool.inputSchema?.properties ?? {};
  return { [arg]: target, ...("detail" in props ? { detail: "summary" } : {}), ...("provider_id" in props ? { provider_id: "auto" } : {}) };
}

// A session chain: the first tool opens the target by path, the middle ones
// read the opened target, the last closes it.
const SESSION = (tool: string) => ["open_binary", tool, "close_binary"];
// Native engine overview (Ghidra/Hopper/IDA, whichever rea's `auto` provider
// finds) — useful only where such a backend is installed, so it runs last.
const OVERVIEW = SESSION("binary_overview");

/**
 * The static probes for an artifact, by kind. Every probe that succeeds is
 * kept: a Go binary's module list and its section layout are both evidence.
 */
function probesFor(path: string): string[][] {
  const lower = path.toLowerCase();
  if (lower.endsWith(".asar")) return [["analyze_javascript_application"]];
  if (lower.endsWith(".wasm")) return [["inspect_wasm_artifact"], ["inspect_binary_layout"]];
  if (/\.(apk|aab|xapk)$/.test(lower)) return [["inspect_android_package"], ["identify_flutter_build"]];
  if (/\.(dll|exe)$/.test(lower)) {
    return [["inspect_managed_artifact"], ["inspect_binary_layout"], ["inspect_pe_resources"], ["inspect_go_binary"], ["inspect_rust_binary"], OVERVIEW];
  }
  if (/\.(so|dylib|node)$/.test(lower) || /\.so\.\d[\d.]*$/.test(lower) || !/\.[^/]+$/.test(lower)) {
    return [["inspect_binary_layout"], SESSION("inspect_macho"), ["inspect_go_binary"], ["inspect_rust_binary"], OVERVIEW];
  }
  // Packages and archives rea opens as a target (.ipa, .pck, .dex, .beam…).
  return [SESSION("inspect_artifact")];
}

function slug(path: string): string {
  return path.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "artifact";
}

const EV_RE = /\bev_[0-9a-f]{64}\b/g;

/**
 * The error a tool result carries, if any. rea reports most failures as a
 * normal result whose payload is `{ "error": { message, … } }` — not only
 * through `isError` — so both are read.
 */
function errorText(result: unknown): string | undefined {
  const r = result as { isError?: unknown; structuredContent?: unknown; content?: Array<{ text?: unknown }> } | undefined;
  const texts = (r?.content ?? []).map((c) => (typeof c?.text === "string" ? c.text : ""));
  const fromPayload = (v: unknown): string | undefined => {
    const e = (v as { error?: unknown } | null)?.error;
    if (!e) return undefined;
    return typeof e === "string" ? e : String((e as { message?: unknown }).message ?? "rea reported an error");
  };
  const clip = (s: string) => s.trim().slice(0, 400);
  const structured = fromPayload(r?.structuredContent);
  if (structured) return clip(structured);
  for (const t of texts) {
    try {
      const parsed = fromPayload(JSON.parse(t));
      if (parsed) return clip(parsed);
    } catch {
      // not JSON: plain prose
    }
  }
  return r?.isError ? clip(texts.join(" ")) || "rea reported an error" : undefined;
}

/**
 * Inspect `artifacts` (repo-relative paths) with rea and write the results under
 * `<out>/evidence/rea/`. Resolves with the run's report — also written as
 * `INDEX.json` whenever rea was found. Rejects only in `on` mode when rea is
 * not installed; every other problem is recorded in the report.
 */
export async function runRea(repo: string, out: string, artifacts: string[], opts: ReaRunOptions): Promise<ReaReport> {
  const env = opts.env ?? process.env;
  if (opts.mode === "off" || artifacts.length === 0) return { status: "unavailable", artifacts: [] };
  assertReaAvailable(opts.mode, artifacts, env);
  const bin = locateRea(env);
  if (!bin) return { status: "unavailable", artifacts: [] };
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const max = opts.maxArtifacts ?? DEFAULT_MAX_ARTIFACTS;
  const dir = join(out, REA_EVIDENCE_DIR);
  mkdirSync(dir, { recursive: true });
  const report: ReaReport = { status: "ran", bin, artifacts: [] };

  const child = spawn(bin, ["mcp"], { cwd: repo, env, stdio: ["pipe", "pipe", "pipe"], shell: process.platform === "win32" && bin.endsWith(".cmd") });
  const client = new StdioClient(child);
  try {
    await client.request("initialize", { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "reconstruct", version: "1" } }, timeoutMs);
    client.notify("notifications/initialized");
    const listed = (await client.request("tools/list", {}, timeoutMs)) as { tools?: ToolDecl[] };
    const tools = new Map((listed.tools ?? []).filter((t) => STATIC_TOOLS.has(t.name)).map((t) => [t.name, t]));

    // rea's own portable bundle of what it retained so far. Kept only when it
    // carries evidence ids — an empty bundle would only look like coverage.
    const exportBundle = async (name: string): Promise<string | undefined> => {
      const exporter = tools.get("export_evidence_bundle");
      const arg = exporter && pathArg(exporter);
      if (!exporter || !arg) return undefined;
      const rel = `${REA_EVIDENCE_DIR}/${name}`;
      const overwrite = "overwrite" in (exporter.inputSchema?.properties ?? {}) ? { overwrite: true } : {};
      try {
        const res = await client.request("tools/call", { name: exporter.name, arguments: { [arg]: join(out, rel), ...overwrite } }, timeoutMs);
        if (!errorText(res) && EV_RE.test(readFileSync(join(out, rel), "utf8"))) return rel;
      } catch {
        // No bundle: the per-artifact results already carry the evidence ids.
      } finally {
        EV_RE.lastIndex = 0;
      }
      rmSync(join(out, rel), { force: true });
      return undefined;
    };

    for (const [i, rel] of artifacts.entries()) {
      if (i >= max) {
        report.artifacts.push({ path: rel, status: "skipped", evidenceIds: [], error: `over the ${max}-artifact cap of one run` });
        continue;
      }
      const abs = join(repo, rel);
      const results: Record<string, unknown> = {};
      const succeeded: string[] = [];
      const problems: string[] = [];
      const bundles: string[] = [];
      for (const chain of probesFor(rel)) {
        if (!chain.every((n) => tools.has(n))) continue;
        const [first, ...rest] = chain as [string, ...string[]];
        const args = callArgs(tools.get(first) as ToolDecl, abs);
        if (!args) continue;
        const label = chain.length > 1 ? (chain[1] as string) : first;
        try {
          const head = await client.request("tools/call", { name: first, arguments: args }, timeoutMs);
          const opened = errorText(head);
          if (opened) throw new Error(opened);
          if (rest.length === 0) {
            results[first] = head;
            succeeded.push(first);
            continue;
          }
          // A session chain: read the opened target, then always close it.
          const [read, close] = rest as [string, string];
          let readError: string | undefined;
          try {
            const readArgs = "detail" in (tools.get(read)?.inputSchema?.properties ?? {}) ? { detail: "summary" } : {};
            const res = await client.request("tools/call", { name: read, arguments: readArgs }, timeoutMs);
            readError = errorText(res);
            results[label] = { open_binary: head, [read]: res };
            // close_binary clears rea's retained records: export them first.
            if (!readError) {
              const saved = await exportBundle(`${slug(rel)}.${read}.bundle.json`);
              if (saved) bundles.push(saved);
            }
          } finally {
            await client.request("tools/call", { name: close, arguments: {} }, timeoutMs).catch(() => undefined);
          }
          if (readError) throw new Error(readError);
          succeeded.push(label);
        } catch (e) {
          if (/rea exited|could not start/.test((e as Error).message)) throw e;
          problems.push(`${label}: ${(e as Error).message}`);
        }
      }
      if (succeeded.length === 0) {
        report.artifacts.push({
          path: rel,
          status: "failed",
          evidenceIds: [],
          error: problems.join("; ") || "no static rea tool on this server inspects this kind of artifact",
        });
        continue;
      }
      const file = `${slug(rel)}.json`;
      const body = JSON.stringify({ artifact: rel, tools: succeeded, results }, null, 2);
      writeFileSync(join(dir, file), `${body}\n`);
      report.artifacts.push({
        path: rel,
        status: "inspected",
        tool: succeeded.join(", "),
        file: `${REA_EVIDENCE_DIR}/${file}`,
        evidenceIds: [...new Set(body.match(EV_RE) ?? [])].sort(),
        ...(bundles.length ? { bundles } : {}),
        // What did not apply (a Go probe on a C library) or needs a backend
        // the user has not installed (the native overview without Ghidra).
        ...(problems.length ? { notes: problems } : {}),
      });
    }

    // What the path-based probes left in rea's retained session.
    if (report.artifacts.some((a) => a.status === "inspected")) {
      const saved = await exportBundle("session.bundle.json");
      if (saved) report.bundle = saved;
    }
  } catch (e) {
    report.status = "failed";
    report.error = (e as Error).message;
  } finally {
    client.close();
  }
  writeFileSync(join(dir, "INDEX.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

/** One line for the CLI summary. */
export function formatReaReport(r: ReaReport, total: number): string | undefined {
  if (r.status === "unavailable") {
    return total ? `  rea:      not installed — ${total} compiled artifact(s) left for the agent (see references/rea-companion.md)` : undefined;
  }
  const n = (s: string) => r.artifacts.filter((a) => a.status === s).length;
  if (r.status === "failed" && n("inspected") === 0) return `  rea:      failed — ${r.error ?? "unknown error"} (see ${REA_EVIDENCE_DIR}/INDEX.json)`;
  const ids = r.artifacts.reduce((k, a) => k + a.evidenceIds.length, 0);
  return `  rea:      inspected ${n("inspected")}/${total} compiled artifact(s) · ${ids} evidence id(s)${n("failed") ? ` · ${n("failed")} failed` : ""}${n("skipped") ? ` · ${n("skipped")} skipped` : ""} → ${REA_EVIDENCE_DIR}/INDEX.json`;
}
