import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadExternalEvidence, REA_EVIDENCE_DIR } from "../src/evidence.js";
import { callTool } from "../src/mcp/handlers.js";
import { formatReaReport, locateRea, type ReaReport, runRea } from "../src/rea.js";

// rea underneath: the engine drives the rea MCP server over stdio. A fake
// server stands in for it — same protocol, and the conventions observed on the
// real rea-agents 6.7 server: failures come back as a normal result whose
// payload is { "error": … }, target-bound tools read what open_binary opened,
// and close_binary clears the retained records — so the tests pin the client:
// what it asks, what it writes, what it never calls, and that no failure of
// rea ever fails a reconstruction.

const FAKE = String.raw`#!/usr/bin/env node
const { createHash } = require("node:crypto");
const { appendFileSync, writeFileSync } = require("node:fs");
const mode = process.env.FAKE_REA_MODE || "ok";
const log = (m) => process.env.FAKE_REA_LOG && appendFileSync(process.env.FAKE_REA_LOG, m + "\n");
let retained = [];
let target = null;
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
const obj = (properties, required = []) => ({ type: "object", properties, required });
const S = { type: "string" };
const tools = [
  { name: "inspect_binary_layout", inputSchema: obj({ path: S, detail: S }, ["path"]) },
  { name: "inspect_wasm_artifact", inputSchema: obj({ path: S, detail: S }, ["path"]) },
  { name: "inspect_managed_artifact", inputSchema: obj({ path: S, detail: S }) },
  { name: "open_binary", inputSchema: obj({ path: S, provider_id: S }, ["path"]) },
  { name: "inspect_macho", inputSchema: obj({ detail: S }) },
  { name: "binary_overview", inputSchema: obj({}) },
  { name: "close_binary", inputSchema: obj({ snapshot_path: S }) },
  { name: "export_evidence_bundle", inputSchema: obj({ path: S, overwrite: { type: "boolean" } }, ["path"]) },
  { name: "capture_process_scenario", inputSchema: obj({ path: S }) },
];
const payload = (id, data) => send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data } });
const evidence = (id, what) => {
  const ev = "ev_" + createHash("sha256").update(what).digest("hex");
  retained.push(ev);
  payload(id, { result: { evidence_id: ev, what } });
};
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => {
  buf += c;
  let i;
  while ((i = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.method) log(msg.method + (msg.params && msg.params.name ? " " + msg.params.name + " " + JSON.stringify(msg.params.arguments) : ""));
    if (msg.id === undefined) continue;
    if (msg.method === "initialize") send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "fake-rea", version: "0" } } });
    else if (msg.method === "tools/list") {
      if (mode === "crash") process.exit(3);
      send({ jsonrpc: "2.0", id: msg.id, result: { tools } });
    } else if (msg.method === "tools/call") {
      const { name, arguments: args } = msg.params;
      if (mode === "hang") continue;
      const p = String(args.path || target || "");
      if (name === "export_evidence_bundle") {
        writeFileSync(args.path, JSON.stringify({ records: retained.map((evidence_id) => ({ evidence_id })) }));
        payload(msg.id, { result: { path: args.path } });
      } else if (name === "open_binary") {
        target = args.path;
        payload(msg.id, { result: { path: args.path, format: p.endsWith(".so") ? "mach-o" : "pe" } });
      } else if (name === "close_binary") {
        target = null;
        retained = [];
        payload(msg.id, { result: { closed: true } });
      } else if (name === "binary_overview") {
        payload(msg.id, { error: { code: "provider_unavailable", message: "Set GHIDRA_INSTALL_DIR" } });
      } else if (name === "inspect_macho") {
        if (p.endsWith(".so")) evidence(msg.id, "macho " + p);
        else payload(msg.id, { error: { message: "not a Mach-O image" } });
      } else if (name === "inspect_managed_artifact") {
        payload(msg.id, { error: { message: "not a managed PE/CLI image" } });
      } else if (name === "inspect_binary_layout" && p.endsWith(".dll")) {
        // The text-only form of a failure: no structuredContent.
        send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: JSON.stringify({ error: { message: "PE layout unsupported" } }) }] } });
      } else {
        evidence(msg.id, name + " " + p + " " + (args.detail || ""));
      }
    }
  }
});
`;

const temps: string[] = [];
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

let base = "";
let repo = "";
let out = "";
let bin = "";
let log = "";
const saved = { REA_BIN: process.env.REA_BIN, FAKE_REA_MODE: process.env.FAKE_REA_MODE, FAKE_REA_LOG: process.env.FAKE_REA_LOG };

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "rc-rea-engine-"));
  temps.push(base);
  repo = join(base, "repo");
  out = join(base, "tree");
  mkdirSync(join(repo, "lib"), { recursive: true });
  mkdirSync(out, { recursive: true });
  writeFileSync(join(repo, "lib", "engine.wasm"), Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]));
  writeFileSync(join(repo, "lib", "native.so"), Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
  writeFileSync(join(repo, "lib", "legacy.dll"), Buffer.from([0x4d, 0x5a]));
  writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "app", version: "1.0.0" }));
  bin = join(base, "fake-rea");
  writeFileSync(bin, FAKE);
  chmodSync(bin, 0o755);
  log = join(base, "calls.log");
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const env = (mode = "ok") => ({ ...process.env, REA_BIN: bin, FAKE_REA_MODE: mode, FAKE_REA_LOG: log });
const calls = () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : []);
const ARTIFACTS = ["lib/engine.wasm", "lib/legacy.dll", "lib/native.so"];

describe("runRea", () => {
  it("inspects each artifact statically, writes its evidence and rea's bundle, and indexes the run", async () => {
    const report = await runRea(repo, out, ARTIFACTS, { mode: "auto", env: env() });
    expect(report.status).toBe("ran");
    const by = Object.fromEntries(report.artifacts.map((a) => [a.path, a]));
    // Every probe that applies is kept, not just the first.
    expect(by["lib/engine.wasm"]?.tool).toBe("inspect_wasm_artifact, inspect_binary_layout");
    expect(by["lib/native.so"]?.tool).toBe("inspect_binary_layout, inspect_macho");
    expect(by["lib/native.so"]?.evidenceIds).toHaveLength(2);
    // A probe needing a backend the user lacks is a note, not a failure.
    expect(by["lib/native.so"]?.notes?.join(" ")).toMatch(/binary_overview: Set GHIDRA_INSTALL_DIR/);
    // A session chain exports before close_binary clears what rea retained.
    expect(by["lib/native.so"]?.bundles).toEqual([`${REA_EVIDENCE_DIR}/lib_native.so.inspect_macho.bundle.json`]);
    // rea's in-payload errors (structured or text-only) are failures; a failing
    // artifact is recorded, never fatal, and the others still go through.
    expect(by["lib/legacy.dll"]?.status).toBe("failed");
    expect(by["lib/legacy.dll"]?.error).toMatch(/not a managed PE\/CLI image/);
    expect(by["lib/legacy.dll"]?.error).toMatch(/PE layout unsupported/);
    // Nothing retained after the last close: no empty bundle pretends coverage.
    expect(report.bundle).toBeUndefined();
    expect(existsSync(join(out, REA_EVIDENCE_DIR, "session.bundle.json"))).toBe(false);

    const index = JSON.parse(readFileSync(join(out, REA_EVIDENCE_DIR, "INDEX.json"), "utf8")) as ReaReport;
    expect(index.artifacts).toHaveLength(3);
    // Every id rea returned is now citable as rea:ev_… from the tree.
    const external = loadExternalEvidence(out);
    for (const id of report.artifacts.flatMap((a) => a.evidenceIds)) expect(external.has(`rea:${id}`)).toBe(true);
    // The summary detail is asked for when the tool offers it.
    expect(calls()).toContain(`tools/call inspect_binary_layout {"path":"${join(repo, "lib/native.so")}","detail":"summary"}`);
    expect(calls()).toContain('tools/call inspect_macho {"detail":"summary"}');
  });

  it("never calls a tool that runs the target", async () => {
    await runRea(repo, out, ARTIFACTS, { mode: "auto", env: env() });
    expect(
      calls()
        .filter((c) => c.startsWith("tools/call"))
        .map((c) => c.split(" ")[1]),
    ).not.toContain("capture_process_scenario");
    expect(calls().some((c) => c.startsWith("tools/call inspect_wasm_artifact "))).toBe(true);
  });

  it("a crashing server fails the run, not the caller, and the index says why", async () => {
    const report = await runRea(repo, out, ARTIFACTS, { mode: "auto", env: env("crash") });
    expect(report.status).toBe("failed");
    expect(report.error).toMatch(/rea exited/);
    expect(existsSync(join(out, REA_EVIDENCE_DIR, "INDEX.json"))).toBe(true);
  });

  it("a hung call times out per artifact", async () => {
    const report = await runRea(repo, out, ["lib/native.so"], { mode: "auto", env: env("hang"), timeoutMs: 400 });
    expect(report.artifacts[0]?.status).toBe("failed");
    expect(report.artifacts[0]?.error).toMatch(/timed out/);
  });

  it("caps the artifacts of one run", async () => {
    const report = await runRea(repo, out, ARTIFACTS, { mode: "auto", env: env(), maxArtifacts: 1 });
    expect(report.artifacts.filter((a) => a.status === "skipped")).toHaveLength(2);
  });

  it("off spawns nothing; auto without rea is a no-op; on without rea refuses", async () => {
    expect((await runRea(repo, out, ARTIFACTS, { mode: "off", env: env() })).status).toBe("unavailable");
    expect(calls()).toEqual([]);
    const none = { ...process.env, REA_BIN: join(base, "missing"), PATH: "" };
    expect(locateRea(none)).toBeNull();
    expect((await runRea(repo, out, ARTIFACTS, { mode: "auto", env: none })).status).toBe("unavailable");
    await expect(runRea(repo, out, ARTIFACTS, { mode: "on", env: none })).rejects.toThrow(/rea executable was not found/);
    expect(existsSync(join(out, REA_EVIDENCE_DIR))).toBe(false);
  });

  it("finds rea on PATH", () => {
    const dir = join(base, "bin");
    mkdirSync(dir);
    writeFileSync(join(dir, "rea"), FAKE);
    chmodSync(join(dir, "rea"), 0o755);
    expect(locateRea({ PATH: dir })).toBe(join(dir, "rea"));
  });

  it("reports in one line", () => {
    expect(formatReaReport({ status: "unavailable", artifacts: [] }, 3)).toMatch(/not installed — 3 compiled artifact/);
    expect(formatReaReport({ status: "unavailable", artifacts: [] }, 0)).toBeUndefined();
  });
});

describe("reconstruct_scaffold drives rea", () => {
  it("inspects the compiled artifacts after the scaffold and reports it", async () => {
    Object.assign(process.env, { REA_BIN: bin, FAKE_REA_MODE: "ok", FAKE_REA_LOG: log });
    const res = JSON.parse((await callTool("reconstruct_scaffold", { repo, out }, { allowWrite: true })).text);
    expect(res.rea).toMatchObject({ status: "ran", compiledArtifacts: 3, inspected: 2 });
    expect(existsSync(join(out, REA_EVIDENCE_DIR, "INDEX.json"))).toBe(true);
    expect(existsSync(join(out, "SUMMARY.md"))).toBe(true);
  });

  it('rea: "on" without rea refuses before writing anything', async () => {
    Object.assign(process.env, { REA_BIN: join(base, "missing") });
    const fresh = join(base, "fresh-tree");
    await expect(callTool("reconstruct_scaffold", { repo, out: fresh, rea: "on" }, { allowWrite: true })).rejects.toThrow(/rea executable was not found/);
    expect(existsSync(join(fresh, "SUMMARY.md"))).toBe(false);
  });

  it("rea: off leaves rea alone", async () => {
    Object.assign(process.env, { REA_BIN: bin, FAKE_REA_MODE: "ok", FAKE_REA_LOG: log });
    const res = JSON.parse((await callTool("reconstruct_scaffold", { repo, out, rea: "off" }, { allowWrite: true })).text);
    expect(res.rea.status).toBe("unavailable");
    expect(calls()).toEqual([]);
  });
});
