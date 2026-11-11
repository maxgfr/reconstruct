import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { callTool, runInline, ToolError, type ToolRunner } from "../src/mcp/handlers.js";
import { bundledEngineScript, createToolPool } from "../src/mcp/offload.js";
import type { Inventory } from "../src/types.js";

// Tool calls run in worker threads started from the committed bundle, so a
// long synchronous analysis cannot stall the server's read loop.

const BUNDLE = resolve("scripts/analyze.mjs");
const temps: string[] = [];
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

function bigRepo(files: number): string {
  const repo = mkdtempSync(join(tmpdir(), "recon-offload-"));
  temps.push(repo);
  writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "big", dependencies: { express: "^4.0.0" } }));
  for (let i = 0; i < files; i++) {
    const dir = join(repo, "src", `m${i % 40}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `r${i}.js`),
      `const express = require("express");\nconst r = express.Router();\nr.get("/r${i}", (q, s) => s.send("${i}"));\nmodule.exports = r;\n`,
    );
  }
  return repo;
}

describe("the tool worker pool", () => {
  it("has no script to start from TypeScript sources", () => {
    expect(bundledEngineScript()).toBeUndefined();
    expect(createToolPool({ size: 1 })).toBeUndefined();
  });

  it("runs jobs in workers, rebuilds ToolErrors, and rejects once closed", async () => {
    const pool = createToolPool({ size: 2, script: BUNDLE });
    if (!pool) throw new Error("no pool");
    try {
      const repo = bigRepo(3);
      const inv = (await pool.run({ name: "reconstruct_inventory", args: { repo }, repo, out: join(repo, "reconstruction"), allowWrite: false })) as Inventory;
      expect(inv.routes.length).toBe(3);
      const failed = pool.run({ name: "reconstruct_read", args: {}, out: repo, allowWrite: false });
      await expect(failed).rejects.toBeInstanceOf(ToolError);
      await expect(failed).rejects.toMatchObject({ recovery: { kind: "fix_arguments", do_not_repeat_unchanged: true } });
    } finally {
      await pool.close();
    }
    await expect(pool.run({ name: "reconstruct_review", args: {}, out: "/x", allowWrite: false })).rejects.toThrow(/closed/);
  });
});

describe("calls queued behind a slow scaffold", () => {
  it("see the tree it writes: the tree is checked under the lock, not before it", async () => {
    const repo = bigRepo(2);
    const out = join(repo, "tree");
    // A runner that holds every job back, as a worker does on a large repo.
    const slow: ToolRunner = (job) => new Promise((res) => setTimeout(() => res(runInline(job)), 200));
    const defaults = { allowWrite: true };
    const scaffold = callTool("reconstruct_scaffold", { repo, out, rea: "off" }, defaults, slow);
    const read = callTool("reconstruct_read", { out, path: "SUMMARY.md" }, defaults, slow);
    const view = callTool("reconstruct_view", { out, section: "routes" }, defaults, slow);
    await scaffold;
    expect(JSON.parse((await read).text).content.length).toBeGreaterThan(50);
    expect(JSON.parse((await view).text).total).toBe(2);
  });
});

describe("the bundled stdio server", () => {
  it("answers ping while a long tool call is still running", async () => {
    const repo = bigRepo(1500);
    const frames = [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "reconstruct_inventory", arguments: { repo } } },
      { jsonrpc: "2.0", id: 3, method: "ping" },
    ];
    const lines = await new Promise<string[]>((res, rej) => {
      const child = spawn(process.execPath, [BUNDLE, "--mcp"]);
      let out = "";
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        rej(new Error(`server did not exit; stdout: ${out}`));
      }, 120_000);
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (c: string) => {
        out += c;
      });
      child.on("error", rej);
      child.on("close", () => {
        clearTimeout(timer);
        res(out.split("\n").filter((l) => l.trim() !== ""));
      });
      for (const f of frames) child.stdin.write(`${JSON.stringify(f)}\n`);
      child.stdin.end();
    });
    const ids = lines.map((l) => (JSON.parse(l) as { id: number }).id);
    // All three answered (stdin closing waits for the running call), the
    // ping before the inventory it was queued behind.
    expect([...ids].sort()).toEqual([1, 2, 3]);
    expect(ids.indexOf(3)).toBeLessThan(ids.indexOf(2));
    const inventory = JSON.parse(lines[ids.indexOf(2)] as string) as { result: { content: Array<{ text: string }> } };
    expect(JSON.parse(inventory.result.content[0]?.text as string).summary.sections.routes).toBe(1500);
  }, 150_000);
});
