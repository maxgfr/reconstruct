import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { callTool } from "../src/mcp/handlers.js";
import { startHttpServer, type RunningHttpServer } from "../src/mcp/http.js";

// The Streamable HTTP transport, exercised over a real socket on port 0. This
// is loopback, not network: nothing here reaches outside the machine.

let TREE = "";
const temps: string[] = [];

let running: RunningHttpServer;
beforeAll(async () => {
  const base = mkdtempSync(join(tmpdir(), "rec-http-"));
  temps.push(base);
  const repo = join(base, "repo");
  TREE = join(base, "tree");
  mkdirSync(join(repo, "src"), { recursive: true });
  writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "demo", version: "1.0.0" }));
  writeFileSync(join(repo, "src", "index.js"), "module.exports = () => 1;\n");
  await callTool("reconstruct_scaffold", { repo, out: TREE }, { allowWrite: true });
  running = await startHttpServer({ port: 0 });
});
afterAll(async () => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
  await running.close();
});

interface PostOptions {
  body?: unknown;
  headers?: Record<string, string>;
  path?: string;
  method?: string;
  raw?: string;
}

async function post(opts: PostOptions = {}) {
  const url = `http://127.0.0.1:${running.port}${opts.path ?? "/mcp"}`;
  const init: RequestInit = {
    method: opts.method ?? "POST",
    headers: { "content-type": "application/json", ...opts.headers },
  };
  if (opts.raw !== undefined) init.body = opts.raw;
  else if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  const res = await fetch(url, init);
  const text = await res.text();
  return { status: res.status, headers: res.headers, text, json: () => JSON.parse(text) };
}

describe("the JSON-RPC contract", () => {
  it("initializes and identifies itself, issuing no session id", async () => {
    const res = await post({ body: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    // Stateless by design: a session id would buy interop bugs and no capability.
    expect(res.headers.get("mcp-session-id")).toBeNull();
    const body = res.json();
    expect(body.result.protocolVersion).toBe("2025-06-18");
    expect(body.result.serverInfo.name).toBe("reconstruct");
  });

  it("answers a notification with 202 and an empty body", async () => {
    // notifications/initialized arrives exactly this way; a 200 with a body
    // here is what trips strict clients.
    const res = await post({ body: { jsonrpc: "2.0", method: "notifications/initialized" } });
    expect(res.status).toBe(202);
    expect(res.text).toBe("");
  });

  it("lists tools, and answers a batch with an array", async () => {
    const single = await post({ body: { jsonrpc: "2.0", id: 1, method: "tools/list" } });
    expect(single.json().result.tools.map((t: { name: string }) => t.name)).toContain("reconstruct_check");

    const batch = await post({
      body: [
        { jsonrpc: "2.0", id: 1, method: "ping" },
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", id: 2, method: "ping" },
      ],
    });
    const out = batch.json();
    expect(Array.isArray(out)).toBe(true);
    // The notification contributes nothing.
    expect(out.map((m: { id: number }) => m.id)).toEqual([1, 2]);
  });

  it("runs a real tool call end to end", async () => {
    const res = await post({ body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "reconstruct_check", arguments: { out: TREE } } } });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.json().result.content[0].text).ok).toBeTypeOf("boolean");
  });

  it("reports a parse error as JSON-RPC -32700, not as an HTTP failure", async () => {
    const res = await post({ raw: "{" });
    expect(res.status).toBe(200);
    expect(res.json().error.code).toBe(-32700);
  });

  it("returns a failing tool as 200 + isError, never as an HTTP 5xx", async () => {
    // The transport succeeded; the tool didn't. Mapping that to a 500 would
    // make a bad argument look like a crashed server.
    const res = await post({
      body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "reconstruct_check", arguments: { out: "/nope/not/a/tree" } } },
    });
    expect(res.status).toBe(200);
    const result = res.json().result;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/no reconstruction tree/);
  });
});

describe("statelessness under concurrency", () => {
  it("keeps two overlapping requests on different protocol versions from reading each other's", async () => {
    // The negotiated version cannot live on a shared server object: without a
    // server instance per request, whichever request landed last would decide
    // what the other one is told.
    const [oldRes, newRes] = await Promise.all([
      post({ body: { jsonrpc: "2.0", id: 1, method: "tools/list" }, headers: { "mcp-protocol-version": "2024-11-05" } }),
      post({ body: { jsonrpc: "2.0", id: 2, method: "tools/list" }, headers: { "mcp-protocol-version": "2025-06-18" } }),
    ]);
    const pick = (r: { json: () => { result: { tools: { name: string }[] } } }) =>
      r.json().result.tools.find((t) => t.name === "reconstruct_read") as Record<string, unknown>;
    const oldTool = pick(oldRes);
    const newTool = pick(newRes);
    expect(oldTool.annotations).toBeUndefined();
    expect(oldTool.outputSchema).toBeUndefined();
    expect(newTool.annotations).toBeDefined();
    expect(newTool.outputSchema).toBeDefined();
  });
});

describe("protocol version negotiation over HTTP", () => {
  it("accepts a supported version header", async () => {
    const res = await post({ body: { jsonrpc: "2.0", id: 1, method: "tools/list" }, headers: { "mcp-protocol-version": "2025-06-18" } });
    expect(res.status).toBe(200);
    // Rich fields are gated on the negotiated version.
    const read = res.json().result.tools.find((t: { name: string }) => t.name === "reconstruct_read");
    expect(read.outputSchema).toBeDefined();
    expect(read.annotations).toBeDefined();
  });

  it("assumes 2025-03-26 when the header is absent, per the backwards-compatibility rule", async () => {
    const res = await post({ body: { jsonrpc: "2.0", id: 1, method: "tools/list" } });
    expect(res.status).toBe(200);
    const read = res.json().result.tools.find((t: { name: string }) => t.name === "reconstruct_read");
    expect(read.annotations).toBeDefined();
    expect(read.outputSchema).toBeUndefined();
  });

  it("rejects an unsupported version with 400", async () => {
    const res = await post({ body: { jsonrpc: "2.0", id: 1, method: "ping" }, headers: { "mcp-protocol-version": "1999-01-01" } });
    expect(res.status).toBe(400);
    expect(res.json().error).toMatch(/unsupported MCP-Protocol-Version/);
  });
});

describe("DNS-rebinding defense", () => {
  it("rejects a remote Origin with 403 before reading the body", async () => {
    const res = await post({ body: { jsonrpc: "2.0", id: 1, method: "ping" }, headers: { origin: "http://evil.test" } });
    expect(res.status).toBe(403);
  });

  it("accepts a loopback Origin and echoes it for CORS", async () => {
    const res = await post({ body: { jsonrpc: "2.0", id: 1, method: "ping" }, headers: { origin: "http://localhost:5173" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("accepts a request with no Origin at all — non-browser clients send none", async () => {
    expect((await post({ body: { jsonrpc: "2.0", id: 1, method: "ping" } })).status).toBe(200);
  });

  it("honours an explicit allow-list", async () => {
    const alt = await startHttpServer({ port: 0, allowOrigin: ["https://app.example.com"] });
    try {
      const res = await fetch(alt.url, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://app.example.com" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
      });
      expect(res.status).toBe(200);
    } finally {
      await alt.close();
    }
  });

  it("refuses to bind a non-loopback address without --allow-remote", async () => {
    await expect(startHttpServer({ port: 0, bind: "0.0.0.0" })).rejects.toThrow(/refusing to bind/);
  });
});

describe("HTTP method and header handling", () => {
  it("answers GET and DELETE with 405 — there is no server-initiated stream", async () => {
    for (const method of ["GET", "DELETE"]) {
      const res = await post({ method, body: undefined });
      expect(res.status, method).toBe(405);
      expect(res.headers.get("allow"), method).toMatch(/POST/);
    }
  });

  it("answers OPTIONS with 204 and CORS headers", async () => {
    const res = await post({ method: "OPTIONS", headers: { origin: "http://localhost:3000" } });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toMatch(/POST/);
    expect(res.headers.get("access-control-allow-headers")).toMatch(/mcp-protocol-version/);
  });

  it("404s any path other than /mcp", async () => {
    const res = await post({ path: "/other", body: { jsonrpc: "2.0", id: 1, method: "ping" } });
    expect(res.status).toBe(404);
    expect(res.json().error).toMatch(/the MCP endpoint is \/mcp/);
  });

  it("rejects a non-JSON content type with 415", async () => {
    const res = await post({ headers: { "content-type": "text/plain" }, raw: "{}" });
    expect(res.status).toBe(415);
  });

  it("is lenient about Accept, but rejects one that excludes JSON outright", async () => {
    expect((await post({ body: { jsonrpc: "2.0", id: 1, method: "ping" }, headers: { accept: "application/json, text/event-stream" } })).status).toBe(200);
    expect((await post({ body: { jsonrpc: "2.0", id: 1, method: "ping" }, headers: { accept: "*/*" } })).status).toBe(200);
    expect((await post({ body: { jsonrpc: "2.0", id: 1, method: "ping" }, headers: { accept: "text/csv" } })).status).toBe(406);
  });

  it("rejects an oversized body with 413 rather than buffering it", async () => {
    const res = await post({ raw: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping", pad: "x".repeat(5 * 1024 * 1024) }) });
    expect(res.status).toBe(413);
  });
});
