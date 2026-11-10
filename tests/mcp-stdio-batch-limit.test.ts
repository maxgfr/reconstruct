import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";

// A fake server whose every request takes a while, recording how many run at once.
let active = 0;
let peak = 0;
vi.mock("../src/mcp/server.js", () => ({
  createServer: () => ({
    handle: async (msg: { id?: number }, send: (m: unknown) => void) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      send({ jsonrpc: "2.0", id: msg.id, result: {} });
    },
  }),
}));

describe("stdio transport: a batch does not bypass the in-flight cap", () => {
  it("runs a 20-request batch at most 4 at a time and still answers it as one array", async () => {
    const { runStdioServer } = await import("../src/mcp/stdio.js");
    const input = new PassThrough();
    const output = new PassThrough();
    let written = "";
    output.on("data", (c) => (written += String(c)));
    const done = runStdioServer({ input, output, captureStdout: true });
    input.end(`${JSON.stringify(Array.from({ length: 20 }, (_, i) => ({ jsonrpc: "2.0", id: i + 1, method: "ping" })))}\n`);
    await done;
    expect(peak).toBeLessThanOrEqual(4);
    const frames = written.trim().split("\n");
    expect(frames).toHaveLength(1);
    expect((JSON.parse(frames[0]!) as { id: number }[]).map((m) => m.id).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
});
