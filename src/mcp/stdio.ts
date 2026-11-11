import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { createToolPool } from "./offload.js";
import { createServer, ERR_INVALID_REQUEST, type JsonRpcMessage, type ServerOptions } from "./server.js";

// The stdio transport: one JSON-RPC message per line, in on stdin, out on
// stdout. This is what every local MCP client speaks when it launches the server
// as a subprocess, and it is the default.
//
// Two properties this file exists to guarantee:
//
// 1. stdout carries frames and nothing else. Today no module outside cli.ts
//    writes to stdout, but "nobody does it yet" is an invariant maintained by
//    discipline. Reassigning process.stdout.write makes it one maintained by
//    construction: a console.log added to a source module in a year lands on
//    stderr instead of corrupting the stream mid-session.
//
// 2. A slow tool never blocks a fast one. `reconstruct_scaffold` on a large repo
//    takes tens of seconds; serializing the read loop behind it would make `ping` and
//    `tools/list` time out. JSON-RPC explicitly permits out-of-order responses, and
//    the tool calls run in worker threads (offload.ts): the handlers are
//    synchronous, so not awaiting them is not enough on its own.

// How many tool calls may run at once. Above this, reconstruct's own
// per-source concurrency and the git subprocesses stop paying for themselves.
// Only tool calls wait for a slot: `ping`, `tools/list` and the other
// methods answer at once, and the read loop never stops for a busy server.
const MAX_IN_FLIGHT = 4;

export interface StdioOptions extends ServerOptions {
  input?: Readable;
  output?: Writable;
  // Skip the stdout guard. Only for tests, which need to read what the server
  // wrote through a stream they control.
  captureStdout?: boolean;
}

export async function runStdioServer(opts: StdioOptions = {}): Promise<void> {
  const input = opts.input ?? process.stdin;
  const output = opts.output ?? process.stdout;

  // Capture the real writer BEFORE the guard goes up, so frames still reach the
  // client afterwards.
  const emit = output.write.bind(output);
  let restore: (() => void) | undefined;
  if (!opts.captureStdout && output === process.stdout) {
    const original = process.stdout.write;
    process.stdout.write = ((chunk: unknown, ...rest: unknown[]) =>
      (process.stderr.write as (...a: unknown[]) => boolean)(chunk, ...rest)) as typeof process.stdout.write;
    restore = () => {
      process.stdout.write = original;
    };
  }

  // One worker per in-flight slot. None from TypeScript sources (tests):
  // calls then run on this thread.
  const pool = opts.runner ? undefined : createToolPool({ size: MAX_IN_FLIGHT });
  const server = createServer({ ...opts, runner: opts.runner ?? pool?.run });
  const send = (msg: JsonRpcMessage) => {
    emit(JSON.stringify(msg) + "\n");
  };

  // Every message still being handled, so stdin closing can wait for them.
  const inFlight = new Set<Promise<void>>();
  const track = (p: Promise<void>) => {
    inFlight.add(p);
    void p.finally(() => inFlight.delete(p));
    return p;
  };
  // Tool-call slots. A freed slot passes straight to the next waiting call,
  // so the count never goes over the cap.
  let running = 0;
  const waiting: Array<() => void> = [];
  const acquire = (): Promise<void> => {
    if (running < MAX_IN_FLIGHT) {
      running++;
      return Promise.resolve();
    }
    return new Promise((r) => waiting.push(r));
  };
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else running--;
  };
  const dispatch = (m: JsonRpcMessage, reply: (r: JsonRpcMessage) => void): Promise<void> => {
    const isToolCall = m !== null && typeof m === "object" && m.method === "tools/call";
    const run = isToolCall ? acquire().then(() => server.handle(m, reply).finally(release)) : server.handle(m, reply);
    return track(run.catch(reportInternal(send)));
  };

  const rl = createInterface({ input, terminal: false });
  try {
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } });
        continue;
      }

      if (Array.isArray(parsed) && parsed.length === 0) {
        send({ jsonrpc: "2.0", id: null, error: { code: ERR_INVALID_REQUEST, message: "invalid request: empty batch" } });
        continue;
      }
      if (Array.isArray(parsed)) {
        // A batch answers as one array, so the client can match it to what it
        // sent. Notifications inside it contribute nothing, and a batch of only
        // notifications produces no frame at all. Each tool call in it takes
        // its own slot: a batch of 20 calls must not run 20 at once.
        const out: JsonRpcMessage[] = [];
        const parts = parsed.map((m) => dispatch(m as JsonRpcMessage, (r) => void out.push(r)));
        track(
          Promise.all(parts).then(() => {
            if (out.length) emit(JSON.stringify(out) + "\n");
          }),
        );
        continue;
      }

      if (parsed === null || typeof parsed !== "object") {
        send({ jsonrpc: "2.0", id: null, error: { code: ERR_INVALID_REQUEST, message: "invalid request: expected a JSON-RPC object" } });
        continue;
      }

      // Deliberately not awaited: the loop goes back for the next frame while
      // this one works.
      void dispatch(parsed as JsonRpcMessage, send);
    }

    // stdin closed. Let whatever is still running finish and answer — calling
    // process.exit() here would drop these frames, because stdout on a pipe is
    // asynchronous and exit() does not flush it.
    while (inFlight.size) await Promise.all(inFlight);
  } finally {
    rl.close();
    await pool?.close();
    restore?.();
  }
}

function reportInternal(send: (msg: JsonRpcMessage) => void) {
  return (e: unknown) => {
    send({ jsonrpc: "2.0", id: null, error: { code: -32603, message: e instanceof Error ? e.message : String(e) } });
  };
}
