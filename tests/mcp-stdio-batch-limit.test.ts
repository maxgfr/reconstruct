import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolJob } from "../src/mcp/handlers.js";

// A fake server: a tool call named "locked" first waits on a gate (as a call
// queued on its tree's lock does), then every tool call runs its job through
// the runner the transport gives it. Anything else answers immediately.
let gate: Promise<void> = Promise.resolve();
vi.mock("../src/mcp/server.js", () => ({
  createServer: (o: { runner: (job: ToolJob) => Promise<unknown> }) => ({
    handle: async (msg: { id?: number; method?: string; params?: { name?: string } }, send: (m: unknown) => void) => {
      if (msg.method === "tools/call") {
        if (msg.params?.name === "locked") await gate;
        await o.runner({ name: msg.params?.name ?? "", args: {}, out: "/", allowWrite: false });
      }
      send({ jsonrpc: "2.0", id: msg.id, result: {} });
    },
  }),
}));

// A job takes a while, and the runner records how many run at once.
let active = 0;
let peak = 0;
const started: string[] = [];
const slow = async (job: ToolJob) => {
  started.push(job.name);
  active++;
  peak = Math.max(peak, active);
  await new Promise((r) => setTimeout(r, 20));
  active--;
  return {};
};

const call = (id: number, name = "reconstruct_review") => ({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: {} } });

async function serve(input: string): Promise<string[]> {
  const { runStdioServer } = await import("../src/mcp/stdio.js");
  const inp = new PassThrough();
  const output = new PassThrough();
  let written = "";
  output.on("data", (c) => (written += String(c)));
  const done = runStdioServer({ input: inp, output, captureStdout: true, runner: slow });
  inp.end(input);
  await done;
  return written.trim().split("\n");
}

beforeEach(() => {
  active = 0;
  peak = 0;
  started.length = 0;
  gate = Promise.resolve();
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

  it("does not count calls still waiting on a lock against the cap", async () => {
    let open: () => void = () => {};
    gate = new Promise((r) => (open = r));
    setTimeout(() => open(), 200);
    const lines = [...Array.from({ length: 6 }, (_, i) => call(i + 1, "locked")), call(7, "free")].map((m) => JSON.stringify(m)).join("\n");
    const frames = await serve(`${lines}\n`);
    // The free call ran first, while six others waited on their lock.
    expect(started[0]).toBe("free");
    expect((JSON.parse(frames[0]!) as { id: number }).id).toBe(7);
    expect(peak).toBe(4);
  });
});
