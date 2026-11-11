import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake server whose every tool call takes a while, recording how many run
// at once; anything else answers immediately.
let active = 0;
let peak = 0;
vi.mock("../src/mcp/server.js", () => ({
  createServer: () => ({
    handle: async (msg: { id?: number; method?: string }, send: (m: unknown) => void) => {
      if (msg.method !== "tools/call") {
        send({ jsonrpc: "2.0", id: msg.id, result: {} });
        return;
      }
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      send({ jsonrpc: "2.0", id: msg.id, result: {} });
    },
  }),
}));

const call = (id: number) => ({ jsonrpc: "2.0", id, method: "tools/call", params: { name: "reconstruct_review", arguments: {} } });

async function serve(input: string): Promise<string[]> {
  const { runStdioServer } = await import("../src/mcp/stdio.js");
  const inp = new PassThrough();
  const output = new PassThrough();
  let written = "";
  output.on("data", (c) => (written += String(c)));
  const done = runStdioServer({ input: inp, output, captureStdout: true });
  inp.end(input);
  await done;
  return written.trim().split("\n");
}

beforeEach(() => {
  active = 0;
  peak = 0;
});

describe("stdio transport: the tool-call cap", () => {
  it("runs a 20-call batch at most 4 at a time and still answers it as one array", async () => {
    const frames = await serve(`${JSON.stringify(Array.from({ length: 20 }, (_, i) => call(i + 1)))}\n`);
    expect(peak).toBe(4);
    expect(frames).toHaveLength(1);
    expect((JSON.parse(frames[0]!) as { id: number }[]).map((m) => m.id).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("answers a ping at once, even with more tool calls queued than the cap", async () => {
    const lines = [...Array.from({ length: 10 }, (_, i) => call(i + 1)), { jsonrpc: "2.0", id: 99, method: "ping" }].map((m) => JSON.stringify(m)).join("\n");
    const frames = await serve(`${lines}\n`);
    expect(peak).toBe(4);
    const ids = frames.map((f) => (JSON.parse(f) as { id: number }).id);
    expect(ids[0]).toBe(99);
    // Tool calls start in the order they arrived.
    expect(ids.slice(1)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
  });
});
