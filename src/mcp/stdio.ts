import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { createServer, ERR_INVALID_REQUEST, type JsonRpcMessage, type ServerOptions } from "./server.js";

// The stdio transport: one JSON-RPC message per line, in on stdin, out on
// stdout. This is what `claude mcp add --transport stdio` and Claude Desktop
// speak, and it is the default.
//
// Two properties this file exists to guarantee:
//
// 1. stdout carries frames and nothing else. Today no module outside cli.ts
//    writes to stdout, but "nobody does it yet" is an invariant maintained by
//    discipline. Reassigning process.stdout.write makes it one maintained by
//    construction: a console.log added to a source module in a year lands on
//    stderr instead of corrupting the stream mid-session.
//
// 2. A slow tool never blocks a fast one. `reconstruct_ask` on a cold repo takes
//    tens of seconds; serializing the read loop behind it would make `ping` and
//    `tools/list` time out. JSON-RPC explicitly permits out-of-order responses.

// How many tool calls may be in flight at once. Above this, reconstruct's own
// per-source concurrency and the git subprocesses stop paying for themselves.
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

  const server = createServer(opts);
  const send = (msg: JsonRpcMessage) => {
    emit(JSON.stringify(msg) + "\n");
  };

  const inFlight = new Set<Promise<void>>();
  const track = (p: Promise<void>) => {
    inFlight.add(p);
    void p.finally(() => inFlight.delete(p));
    return p;
  };
  const drainToLimit = async () => {
    while (inFlight.size >= MAX_IN_FLIGHT) await Promise.race(inFlight);
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

      await drainToLimit();

      if (Array.isArray(parsed)) {
        // A batch answers as one array, so the client can match it to what it
        // sent. Notifications inside it contribute nothing, and a batch of only
        // notifications produces no frame at all.
        track(
          (async () => {
            const out: JsonRpcMessage[] = [];
            await Promise.all(parsed.map((m) => server.handle(m as JsonRpcMessage, (r) => void out.push(r))));
            if (out.length) emit(JSON.stringify(out) + "\n");
          })().catch(reportInternal(send)),
        );
        continue;
      }

      if (parsed === null || typeof parsed !== "object") {
        send({ jsonrpc: "2.0", id: null, error: { code: ERR_INVALID_REQUEST, message: "invalid request: expected a JSON-RPC object" } });
        continue;
      }

      // Deliberately not awaited: the loop goes back for the next frame while
      // this one works.
      track(server.handle(parsed as JsonRpcMessage, send).catch(reportInternal(send)));
    }

    // stdin closed. Let whatever is still running finish and answer — calling
    // process.exit() here would drop these frames, because stdout on a pipe is
    // asynchronous and exit() does not flush it.
    await Promise.all(inFlight);
  } finally {
    rl.close();
    restore?.();
  }
}

function reportInternal(send: (msg: JsonRpcMessage) => void) {
  return (e: unknown) => {
    send({ jsonrpc: "2.0", id: null, error: { code: -32603, message: e instanceof Error ? e.message : String(e) } });
  };
}
