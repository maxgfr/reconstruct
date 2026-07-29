import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type JsonRpcMessage } from "../src/mcp/server.js";
import { callTool, ToolError } from "../src/mcp/handlers.js";

// The handlers driven through the JSON-RPC core, in-process, against a real
// scaffolded tree built from a real (small) repo. Nothing here mocks the
// engine, and nothing reaches the network — the whole engine is a local walk.

let REPO: string;
let TREE: string;
const temps: string[] = [];

beforeAll(async () => {
  const base = mkdtempSync(join(tmpdir(), "rec-mcp-"));
  temps.push(base);
  REPO = join(base, "src-repo");
  TREE = join(base, "tree");
  mkdirSync(join(REPO, "src"), { recursive: true });
  writeFileSync(join(REPO, "package.json"), JSON.stringify({ name: "demo", version: "1.0.0", dependencies: { express: "^4.18.0" } }));
  writeFileSync(
    join(REPO, "src", "server.js"),
    [
      'const express = require("express");',
      "const app = express();",
      'app.get("/users/:id", (req, res) => res.json({ id: req.params.id }));',
      'app.post("/users", (req, res) => res.status(201).json({ ok: true }));',
      "app.listen(3000);",
      "",
    ].join("\n"),
  );
  // Going through callTool proves the allowWrite gate lets a write tool through.
  await callTool("reconstruct_scaffold", { repo: REPO, out: TREE }, { allowWrite: true });
}, 300_000);

afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

const server = createServer();

async function rpc(msg: Omit<JsonRpcMessage, "jsonrpc">): Promise<JsonRpcMessage | undefined> {
  let out: JsonRpcMessage | undefined;
  await server.handle({ jsonrpc: "2.0", ...msg }, (m) => {
    out = m;
  });
  return out;
}

async function call(name: string, args: Record<string, unknown>): Promise<JsonRpcMessage> {
  return (await rpc({ id: 1, method: "tools/call", params: { name, arguments: args } }))!;
}

async function ok(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await call(name, args);
  const result = res.result as { content: { text: string }[]; isError?: boolean } | undefined;
  expect(res.error, `unexpected JSON-RPC error: ${JSON.stringify(res.error)}`).toBeUndefined();
  expect(result?.isError, `unexpected isError: ${result?.content?.[0]?.text}`).toBeFalsy();
  return JSON.parse(result!.content[0]!.text);
}

async function errorText(name: string, args: Record<string, unknown>): Promise<string> {
  const res = await call(name, args);
  const result = res.result as { content: { text: string }[]; isError?: boolean } | undefined;
  expect(result?.isError, "expected an isError tool result").toBe(true);
  return result!.content[0]!.text;
}

describe("lifecycle methods", () => {
  it("negotiates a protocol version and advertises all three primitives", async () => {
    const res = await rpc({ id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
    const r = res!.result as { serverInfo: { name: string }; capabilities: unknown };
    expect(r.serverInfo.name).toBe("reconstruct");
    expect(r.capabilities).toEqual({
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false },
      prompts: { listChanged: false },
    });
  });

  it("rejects an unknown method, an unknown tool and bad arguments as protocol errors", async () => {
    expect((await rpc({ id: 1, method: "resources/subscribe" }))!.error).toMatchObject({ code: -32601 });
    expect((await call("reconstruct_nope", {})).error).toMatchObject({ code: -32602 });
    expect((await call("reconstruct_read", { out: TREE })).error).toMatchObject({ code: -32602 });
  });
});

describe("inventory", () => {
  it("reads a repo and writes nothing", async () => {
    const res = await ok("reconstruct_inventory", { repo: REPO });
    expect(res.repo).toBe(REPO);
    expect(String(res.next)).toMatch(/Nothing was written/);
  });

  it("reports a repo that does not exist", async () => {
    expect(await errorText("reconstruct_inventory", { repo: "/nope/not/here" })).toMatch(/repo not found/);
  });
});

describe("the buildability gate", () => {
  it("states the verdict explicitly rather than leaving it to be inferred", async () => {
    // CheckResult is errors/warnings; the CLI turns that into an exit code, and
    // a tool result has none.
    const res = await ok("reconstruct_check", { out: TREE });
    expect(res.ok).toBeTypeOf("boolean");
    expect(res.ok).toBe((res.errors as string[]).length === 0);
  });

  it("says what passing does NOT mean", async () => {
    const res = await ok("reconstruct_check", { out: TREE });
    expect(String(res.note)).toMatch(/present and says nothing|says nothing/);
  });
});

describe("bundles", () => {
  it("writes the specs bundle and returns its path", async () => {
    const res = await ok("reconstruct_specs", { out: TREE });
    expect(String(res.path)).toMatch(/SPECS\.md$/);
    expect(res.bundle).toBe("specs");
  });

  it("writes the features bundle", async () => {
    expect(String((await ok("reconstruct_features", { out: TREE })).path)).toMatch(/FEATURES\.md$/);
  });
});

describe("read", () => {
  it("returns a line window from the tree", async () => {
    const res = await ok("reconstruct_read", { out: TREE, path: "SUMMARY.md", start_line: 1, end_line: 3 });
    expect(res.start_line).toBe(1);
    expect(String(res.content).split("\n").length).toBeLessThanOrEqual(3);
  });

  it("reads the original source too, when the repo is named", async () => {
    const res = await ok("reconstruct_read", { out: TREE, repo: REPO, path: join(REPO, "src/server.js") });
    expect(String(res.content)).toContain("express");
  });

  it("refuses a path outside the tree", async () => {
    // Containment is the whole point: this server can be reached over HTTP.
    expect(await errorText("reconstruct_read", { out: TREE, path: "/etc/passwd" })).toMatch(/outside the reconstruction tree/);
  });
});

describe("guardrails", () => {
  it("refuses the write tools unless the server allows writes", async () => {
    await expect(callTool("reconstruct_scaffold", { repo: REPO })).rejects.toThrow(ToolError);
    await expect(callTool("reconstruct_brainstorm", { out: TREE })).rejects.toThrow(/--allow-write/);
  });

  it("refuses to re-scaffold over a tree that holds enrichment", async () => {
    // The prose is the whole value of the tree and there is no undo, so the
    // refusal names the witnesses instead of asking the caller to guess.
    await expect(callTool("reconstruct_scaffold", { repo: REPO, out: TREE }, { allowWrite: true })).rejects.toThrow(/ENRICHED/);
  });

  it("names the missing STEP when there is no tree", async () => {
    const bare = mkdtempSync(join(tmpdir(), "rec-bare-"));
    temps.push(bare);
    const msg = await errorText("reconstruct_check", { out: bare });
    expect(msg).toMatch(/no reconstruction tree/);
    expect(msg).toMatch(/reconstruct_scaffold/);
  });

  it("requires an absolute out path", async () => {
    expect(await errorText("reconstruct_check", { out: "relative/tree" })).toMatch(/must be an absolute path/);
  });

  it("uses the server's default tree when the caller omits one", async () => {
    const withDefault = createServer({ defaultOut: TREE });
    let out: JsonRpcMessage | undefined;
    await withDefault.handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "reconstruct_check", arguments: {} } }, (m) => {
      out = m;
    });
    const result = out!.result as { content: { text: string }[]; isError?: boolean };
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0]!.text).ok).toBeTypeOf("boolean");
  });
});
