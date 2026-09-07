import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";

const OUTPUT_CAP = 65_536;
interface Command {
  command: string;
  args: string[];
}
interface Case {
  id: string;
  stdin: string;
  original: Command;
  rebuilt: Command;
  timeoutMs?: number;
  expectedExitCode?: number;
}
interface Observation {
  command: string;
  args: string[];
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  stdoutBase64: string;
  stderrBase64: string;
  error?: string;
  timedOut: boolean;
  truncated: boolean;
}
interface CaseResult {
  id: string;
  stdin: string;
  status: "passed" | "failed" | "not-tested";
  reason?: string;
  original?: Observation;
  rebuilt?: Observation;
}

function validCommand(value: unknown): value is Command {
  if (!value || typeof value !== "object") return false;
  const c = value as Command;
  return (
    typeof c.command === "string" &&
    c.command.trim().length > 0 &&
    !c.command.includes("\0") &&
    Array.isArray(c.args) &&
    c.args.every((arg) => typeof arg === "string" && !arg.includes("\0"))
  );
}

function readCases(path: string): { cases: Case[]; fingerprint: string } {
  if (statSync(path).size > 1_048_576) throw new Error("Behavior cases file exceeds 1 MiB.");
  const text = readFileSync(path, "utf8");
  const doc = JSON.parse(text) as { schemaVersion?: unknown; cases?: unknown };
  if (!doc || doc.schemaVersion !== 1 || !Array.isArray(doc.cases) || doc.cases.length === 0 || doc.cases.length > 100) {
    throw new Error("Behavior schemaVersion 1 requires 1–100 explicit cases.");
  }
  const ids = new Set<string>();
  for (const c of doc.cases as Case[]) {
    if (!c || typeof c.id !== "string" || !c.id.trim() || ids.has(c.id)) throw new Error("Behavior case IDs must be nonempty and unique.");
    ids.add(c.id);
    if (typeof c.stdin !== "string" || Buffer.byteLength(c.stdin) > OUTPUT_CAP || !validCommand(c.original) || !validCommand(c.rebuilt)) {
      throw new Error(`Case ${c.id}: explicit stdin (at most 64 KiB) and original/rebuilt command + args are required.`);
    }
    if (c.timeoutMs !== undefined && (!Number.isInteger(c.timeoutMs) || c.timeoutMs < 1 || c.timeoutMs > 600_000)) {
      throw new Error(`Case ${c.id}: timeoutMs must be an integer between 1 and 600000.`);
    }
    if (c.expectedExitCode !== undefined && (!Number.isInteger(c.expectedExitCode) || c.expectedExitCode < 0 || c.expectedExitCode > 255)) {
      throw new Error(`Case ${c.id}: expectedExitCode must be an integer between 0 and 255.`);
    }
  }
  return { cases: doc.cases as Case[], fingerprint: createHash("sha256").update(text).digest("hex") };
}

function observe(command: Command, cwd: string, input: string, timeout: number): Observation {
  // No shell interpolation. This is explicitly authorized code execution, not a sandbox.
  const windows = process.platform === "win32";
  // Native spawnSync supports detached although its TS options omit that field.
  const options = { cwd, input, timeout, maxBuffer: OUTPUT_CAP, killSignal: "SIGKILL" as const, detached: !windows };
  const r = spawnSync(command.command, command.args, options);
  let cleanupError: string | undefined;
  if (!windows && r.pid) {
    try {
      process.kill(-r.pid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") cleanupError = (error as Error).message;
    }
  }
  const stdout = r.stdout ?? Buffer.alloc(0),
    stderr = r.stderr ?? Buffer.alloc(0);
  const error = r.error as NodeJS.ErrnoException | undefined;
  return {
    ...command,
    exitCode: r.status,
    signal: r.signal,
    stdout: stdout.subarray(0, OUTPUT_CAP).toString("utf8"),
    stderr: stderr.subarray(0, OUTPUT_CAP).toString("utf8"),
    stdoutBase64: stdout.subarray(0, OUTPUT_CAP).toString("base64"),
    stderrBase64: stderr.subarray(0, OUTPUT_CAP).toString("base64"),
    ...(error || cleanupError ? { error: (error?.message ?? cleanupError!).slice(0, 1000) } : {}),
    timedOut: error?.code === "ETIMEDOUT",
    truncated: error?.code === "ENOBUFS" || stdout.length > OUTPUT_CAP || stderr.length > OUTPUT_CAP,
  };
}

/** Compare only declared observations, never infer whole-program equivalence. */
export function compareBehavior(casesPath: string, opts: { originalDir: string; rebuiltDir: string; runTests?: boolean }) {
  const { cases, fingerprint } = readCases(casesPath);
  const originalDir = realpathSync(opts.originalDir),
    rebuiltDir = realpathSync(opts.rebuiltDir);
  if (!statSync(originalDir).isDirectory() || !statSync(rebuiltDir).isDirectory() || originalDir === rebuiltDir) {
    throw new Error("Behavior comparison requires two distinct existing directories.");
  }
  const results: CaseResult[] = cases.map((c) => {
    if (!opts.runTests) return { id: c.id, stdin: c.stdin, status: "not-tested", reason: "Execution requires explicit --run-tests authorization." };
    const original = observe(c.original, originalDir, c.stdin, c.timeoutMs ?? 5000);
    const rebuilt = observe(c.rebuilt, rebuiltDir, c.stdin, c.timeoutMs ?? 5000);
    const healthy = (o: Observation) => !o.error && !o.signal && !o.timedOut && !o.truncated && o.exitCode === (c.expectedExitCode ?? 0);
    const passed =
      healthy(original) &&
      healthy(rebuilt) &&
      original.stdoutBase64 === rebuilt.stdoutBase64 &&
      original.stderrBase64 === rebuilt.stderrBase64 &&
      original.exitCode === rebuilt.exitCode;
    return {
      id: c.id,
      stdin: c.stdin,
      status: passed ? "passed" : "failed",
      original,
      rebuilt,
      ...(!passed ? { reason: "Observable stdout/stderr/exit differs, unexpected exit, or execution was incomplete (error/timeout/output limit)." } : {}),
    };
  });
  return {
    schemaVersion: 1,
    ok: results.every((c) => c.status === "passed"),
    generatedAt: new Date().toISOString(),
    fixtureFingerprint: fingerprint,
    originalDir,
    rebuiltDir,
    scope:
      "Only the listed exercised cases and their exact stdout, stderr and exit codes are compared. No global equivalence, side-effect, timing, network or UI fidelity is claimed. Commands run with local user privileges; this is not a sandbox.",
    cases: results,
  };
}
