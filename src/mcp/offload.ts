import { fileURLToPath } from "node:url";
import { parentPort, Worker } from "node:worker_threads";
import { runJob, ToolError, type Recovery, type ToolJob, type ToolRunner } from "./handlers.js";

// Tool calls off the event loop.
//
// The heavy handlers (analyze, render, the bundlers, verify) are synchronous:
// run on the server's own thread, one long `reconstruct_scaffold` stalls every
// `ping` and `tools/list` behind it, which clients report as a dead server.
// A small pool of worker threads runs them instead. The engine ships as one
// self-contained script, so a worker is that same script started with a flag
// (see cli.ts) — there is no second file to keep in step.
//
// What stays on the server thread: argument checks that answer instantly, the
// per-tree locks (they must see every call) and the inventory cache that
// reconstruct_view pages (it must outlive any one worker).

/** workerData key that turns the engine script into a tool worker. */
export const TOOL_WORKER_FLAG = "reconstructToolWorker";

interface JobMessage {
  id: number;
  job: ToolJob;
}

type ResultMessage = { id: number; ok: true; value: unknown } | { id: number; ok: false; error: { message: string; recovery?: Recovery } };

/** The worker side: run each job the server posts and post its outcome back. */
export function startToolWorker(): void {
  const port = parentPort;
  if (!port) throw new Error("startToolWorker() must run inside a worker thread");
  port.on("message", (msg: JobMessage) => {
    void (async () => {
      let reply: ResultMessage;
      try {
        reply = { id: msg.id, ok: true, value: await runJob(msg.job) };
      } catch (e) {
        reply = {
          id: msg.id,
          ok: false,
          error: { message: e instanceof Error ? e.message : String(e), ...(e instanceof ToolError ? { recovery: e.recovery } : {}) },
        };
      }
      try {
        port.postMessage(reply);
      } catch (e) {
        // A result that cannot be cloned is a server bug; say so rather than hang the call.
        port.postMessage({ id: msg.id, ok: false, error: { message: `tool result could not be sent back: ${(e as Error).message}` } });
      }
    })();
  });
}

export interface ToolPool {
  run: ToolRunner;
  /** Stop every worker; calls still queued or running are rejected. */
  close(): Promise<void>;
}

interface Slot {
  worker: Worker;
  busy?: { id: number; resolve: (v: unknown) => void; reject: (e: unknown) => void };
}

/**
 * The engine script a worker can run: this module's own file once bundled
 * (`scripts/analyze.mjs`). From TypeScript sources (the test suite) there is
 * none, and calls run inline.
 */
export function bundledEngineScript(): string | undefined {
  const self = fileURLToPath(import.meta.url);
  return /\.[cm]?js$/.test(self) ? self : undefined;
}

/**
 * A pool of up to `size` tool workers, started on first use. Returns
 * undefined when there is no script to start them from.
 */
export function createToolPool(opts: { size: number; script?: string }): ToolPool | undefined {
  const script = opts.script ?? bundledEngineScript();
  if (!script) return undefined;
  const slots: Slot[] = [];
  const queue: Array<{ job: ToolJob; resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];
  let nextId = 0;
  let closed = false;

  const spawn = (): Slot => {
    // stdout: true keeps the worker's stdout off the protocol stream: a
    // console.log in a worker lands on stderr, like one on the server thread.
    const worker = new Worker(script, { workerData: { [TOOL_WORKER_FLAG]: true }, stdout: true });
    worker.stdout.pipe(process.stderr);
    const slot: Slot = { worker };
    worker.on("message", (msg: ResultMessage) => {
      const busy = slot.busy;
      if (!busy || busy.id !== msg.id) return;
      slot.busy = undefined;
      worker.unref();
      if (msg.ok) busy.resolve(msg.value);
      else busy.reject(msg.error.recovery ? new ToolError(msg.error.message, msg.error.recovery) : new Error(msg.error.message));
      pump();
    });
    const lost = (why: string) => {
      const i = slots.indexOf(slot);
      if (i !== -1) slots.splice(i, 1);
      const busy = slot.busy;
      slot.busy = undefined;
      busy?.reject(new Error(`tool worker ${why}`));
      pump();
    };
    worker.on("error", (e: Error) => lost(`crashed: ${e.message}`));
    worker.on("exit", (code) => lost(`exited with code ${code}`));
    worker.unref();
    slots.push(slot);
    return slot;
  };

  const pump = () => {
    while (!closed && queue.length) {
      const slot = slots.find((s) => !s.busy) ?? (slots.length < opts.size ? spawn() : undefined);
      if (!slot) return;
      const { job, resolve, reject } = queue.shift() as (typeof queue)[number];
      const id = nextId++;
      slot.busy = { id, resolve, reject };
      // Referenced while it works, so a pending call keeps the process alive.
      slot.worker.ref();
      slot.worker.postMessage({ id, job } satisfies JobMessage);
    }
  };

  return {
    run: (job) =>
      new Promise((resolve, reject) => {
        if (closed) {
          reject(new Error("tool pool is closed"));
          return;
        }
        queue.push({ job, resolve, reject });
        pump();
      }),
    close: async () => {
      closed = true;
      for (const q of queue.splice(0)) q.reject(new Error("tool pool is closed"));
      await Promise.all(slots.splice(0).map((s) => s.worker.terminate()));
    },
  };
}
