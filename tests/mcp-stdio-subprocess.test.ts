import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// The stdio transport driven against the REAL committed bundle, as a separate
// process — the exact file `claude mcp add -- node scripts/reconstruct.mjs mcp`
// runs. In-process tests against src/ cannot see a bundling or wiring
// regression, and they cannot see the one property that matters most here:
// that stdout carries JSON-RPC frames and nothing else.
//
// No tool call here reaches the network: `research` is the only one that
// would, and it is not exercised.

const BUNDLE = resolve("scripts/analyze.mjs");
// A one-line CommonJS module, enough for the walker to classify the repo.
const MODULE_SRC = "module.exports = () => 1;\n";
const temps: string[] = [];

afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

interface Session {
  lines: string[];
  stderr: string;
  code: number | null;
}

// Feed the server a set of newline-delimited frames, close stdin, and collect
// everything it wrote.
function session(frames: unknown[], opts: { args?: string[]; timeoutMs?: number } = {}): Promise<Session> {
  const { args = [], timeoutMs = 120_000 } = opts;
  return new Promise((res, rej) => {
    const child: ChildProcessWithoutNullStreams = spawn(process.execPath, [BUNDLE, "--mcp", ...args], { env: { ...process.env } });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rej(new Error(`server did not exit within ${timeoutMs}ms; stdout so far: ${out}`));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (c: string) => {
      out += c;
    });
    child.stderr.on("data", (c: string) => {
      err += c;
    });
    child.on("error", rej);
    child.on("close", (code) => {
      clearTimeout(timer);
      res({ lines: out.split("\n").filter((l) => l.trim() !== ""), stderr: err, code });
    });

    for (const f of frames) child.stdin.write(JSON.stringify(f) + "\n");
    child.stdin.end();
  });
}

const INIT = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } };
const INITIALIZED = { jsonrpc: "2.0", method: "notifications/initialized" };

describe("the bundled MCP server over stdio", () => {
  it("completes a handshake, and writes NOTHING to stdout but JSON-RPC frames", async () => {
    const s = await session([INIT, INITIALIZED, { jsonrpc: "2.0", id: 2, method: "tools/list" }]);

    // Three frames in, two out: a notification is answered with silence. If a
    // stray console.log ever lands on an import path, this count breaks first.
    expect(s.lines).toHaveLength(2);
    const msgs = s.lines.map((l) => JSON.parse(l));

    expect(msgs[0].id).toBe(1);
    expect(msgs[0].result.serverInfo.name).toBe("reconstruct");
    expect(msgs[0].result.serverInfo.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(msgs[0].result.protocolVersion).toBe("2025-06-18");

    const names = msgs[1].result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("reconstruct_inventory");
    expect(names).toContain("reconstruct_check");
    // The write tools stay hidden without --allow-write.
    expect(names).not.toContain("reconstruct_scaffold");
    expect(s.code).toBe(0);
  });

  it("runs a real tool call, offline", async () => {
    const repo = mkdtempSync(join(tmpdir(), "rec-inv-"));
    temps.push(repo);
    writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "demo", version: "1.0.0" }));
    const s = await session([INIT, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "reconstruct_inventory", arguments: { repo } } }]);
    const call = s.lines.map((l) => JSON.parse(l)).find((m) => m.id === 2);
    expect(JSON.parse(call.result.content[0].text).repo).toBe(repo);
  });

  it("scaffolds a tree through the bundle and reads it back", async () => {
    // The full loop an MCP client actually runs: scaffold writes, read opens
    // what it wrote.
    const base = mkdtempSync(join(tmpdir(), "rec-stdio-"));
    temps.push(base);
    const repo = join(base, "repo");
    const tree = join(base, "tree");
    mkdirSync(join(repo, "src"), { recursive: true });
    writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "demo", version: "1.0.0" }));
    writeFileSync(join(repo, "src", "index.js"), MODULE_SRC);

    const s = await session(
      [
        INIT,
        { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "reconstruct_scaffold", arguments: { repo, out: tree } } },
        { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "reconstruct_read", arguments: { out: tree, path: "SUMMARY.md" } } },
      ],
      { args: ["--allow-write"], timeoutMs: 300_000 },
    );
    // Three requests in, three frames out — and nothing else.
    expect(s.lines).toHaveLength(3);
    const msgs = s.lines.map((l) => JSON.parse(l));
    expect(JSON.parse(msgs.find((m) => m.id === 2).result.content[0].text).out).toBe(tree);
    expect(JSON.parse(msgs.find((m) => m.id === 3).result.content[0].text).content.length).toBeGreaterThan(50);
  }, 300_000);

  it("survives an unknown method and keeps serving", async () => {
    const s = await session([INIT, { jsonrpc: "2.0", id: 2, method: "resources/subscribe" }, { jsonrpc: "2.0", id: 3, method: "ping" }]);
    const msgs = s.lines.map((l) => JSON.parse(l));
    expect(msgs.find((m) => m.id === 2).error.code).toBe(-32601);
    // Still answering afterwards: a bad frame must not end the session.
    expect(msgs.find((m) => m.id === 3).result).toEqual({});
    expect(s.code).toBe(0);
  });

  it("advertises and serves all three primitives from the committed bundle", async () => {
    // The one test that proves the skill's METHOD ships with the engine. It
    // runs against the bundle, so it also proves resources resolve from the
    // bundle's own location rather than from the source tree.
    const s = await session([
      INIT,
      { jsonrpc: "2.0", id: 2, method: "resources/list" },
      { jsonrpc: "2.0", id: 3, method: "prompts/list" },
      { jsonrpc: "2.0", id: 4, method: "resources/read", params: { uri: "skill://SKILL.md" } },
      { jsonrpc: "2.0", id: 5, method: "prompts/get", params: { name: "review_buildability", arguments: { out: "/srv/tree" } } },
    ]);
    const msgs = s.lines.map((l) => JSON.parse(l));

    expect(msgs[0]!.result.capabilities).toEqual({
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false },
      prompts: { listChanged: false },
    });

    const uris = msgs.find((m) => m.id === 2).result.resources.map((r: { uri: string }) => r.uri);
    expect(uris).toContain("skill://SKILL.md");
    expect(uris).toContain("skill://references/adapters.md");

    expect(msgs.find((m) => m.id === 3).result.prompts.map((p: { name: string }) => p.name)).toEqual([
      "enrich_feature",
      "review_buildability",
      "greenfield_interview",
    ]);

    const contents = msgs.find((m) => m.id === 4).result.contents[0];
    expect(contents.mimeType).toBe("text/markdown");
    expect(contents.text).toContain("reconstruct");

    const rendered = msgs.find((m) => m.id === 5).result.messages[0].content.text;
    expect(rendered).toContain("/srv/tree");
    expect(rendered).toContain("reconstruct_check");

    expect(s.code).toBe(0);
  });

  it("reports a bad resource uri and a bad prompt name as invalid params", async () => {
    const s = await session([
      INIT,
      { jsonrpc: "2.0", id: 2, method: "resources/read", params: { uri: "skill://../../package.json" } },
      { jsonrpc: "2.0", id: 3, method: "prompts/get", params: { name: "nope" } },
      { jsonrpc: "2.0", id: 4, method: "prompts/get", params: { name: "review_buildability", arguments: {} } },
      { jsonrpc: "2.0", id: 5, method: "ping" },
    ]);
    const msgs = s.lines.map((l) => JSON.parse(l));
    for (const id of [2, 3, 4]) expect(msgs.find((m) => m.id === id).error.code, `id ${id}`).toBe(-32602);
    // A client naming something wrong never ends the session.
    expect(msgs.find((m) => m.id === 5).result).toEqual({});
    expect(s.code).toBe(0);
  });

  it("reports malformed JSON as a parse error without dying", async () => {
    const s = await new Promise<Session>((res, rej) => {
      const child = spawn(process.execPath, [BUNDLE, "--mcp"], { env: { ...process.env } });
      let out = "";
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (c: string) => {
        out += c;
      });
      child.on("error", rej);
      child.on("close", (code) => res({ lines: out.split("\n").filter((l) => l.trim()), stderr: "", code }));
      child.stdin.write("{ not json\n");
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "ping" }) + "\n");
      child.stdin.end();
    });
    const msgs = s.lines.map((l) => JSON.parse(l));
    expect(msgs[0].error.code).toBe(-32700);
    expect(msgs[1].result).toEqual({});
    expect(s.code).toBe(0);
  });

  it("does not answer a request the client cancelled", async () => {
    const s = await session([INIT, { jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 2 } }, { jsonrpc: "2.0", id: 2, method: "ping" }]);
    expect(s.lines.map((l) => JSON.parse(l).id)).toEqual([1]);
  });

  it("answers a batch with a single array frame", async () => {
    const s = await session([INIT, [{ jsonrpc: "2.0", id: 2, method: "ping" }, INITIALIZED, { jsonrpc: "2.0", id: 3, method: "ping" }]]);
    const batch = JSON.parse(s.lines[1]!);
    expect(Array.isArray(batch)).toBe(true);
    expect(batch.map((m: { id: number }) => m.id)).toEqual([2, 3]);
  });
});

describe("server flags, through the bundle", () => {
  it("makes `out` optional on every tool when a default tree is configured", async () => {
    const s = await session([INIT, { jsonrpc: "2.0", id: 2, method: "tools/list" }], { args: ["--out", "/tmp/some-tree"] });
    for (const t of JSON.parse(s.lines[1]!).result.tools) {
      if (t.name === "reconstruct_scaffold") continue;
      if (!t.inputSchema.properties.out) continue;
      expect(t.inputSchema.required, t.name).not.toContain("out");
      expect(t.inputSchema.properties.out.description, t.name).toContain("/tmp/some-tree");
    }
  });

  it("withholds an over-cap result and says how to ask for less", async () => {
    const repo = mkdtempSync(join(tmpdir(), "rec-cap-"));
    temps.push(repo);
    mkdirSync(join(repo, "src"), { recursive: true });
    writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "demo", version: "1.0.0" }));
    writeFileSync(join(repo, "src", "index.js"), MODULE_SRC);

    const s = await session([INIT, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "reconstruct_inventory", arguments: { repo } } }], {
      args: ["--max-response-bytes", "200"],
    });
    const payload = JSON.parse(JSON.parse(s.lines[1]!).result.content[0].text);
    expect(payload.truncated).toBe(true);
    expect(payload.bytes).toBeGreaterThan(200);
    // Withholding is only acceptable because it says what to do instead.
    expect(payload.narrower).toBeTruthy();
  });

  it("refuses an invalid --transport instead of starting anything", async () => {
    const s = await session([INIT], { args: ["--transport", "bogus"] });
    expect(s.code).toBe(1);
    expect(s.stderr).toMatch(/invalid --transport/);
  });

  it("refuses to bind a non-loopback address without --allow-remote", async () => {
    const s = await session([], { args: ["--transport", "http", "--bind", "0.0.0.0", "--port", "0"] });
    expect(s.code).toBe(1);
    expect(s.stderr).toMatch(/refusing to bind/);
  });
});
