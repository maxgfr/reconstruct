import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { callTool } from "../src/mcp/handlers.js";
import { createServer, type JsonRpcMessage } from "../src/mcp/server.js";

// Agent ergonomics: summary-first inventories paged by reconstruct_view, errors
// that say what to do next, and untrusted repo text marked as such.

let REPO = "";
let TREE = "";
const temps: string[] = [];

beforeAll(async () => {
  const base = mkdtempSync(join(tmpdir(), "rc-view-"));
  temps.push(base);
  REPO = join(base, "repo");
  cpSync(fileURLToPath(new URL("./fixtures/express-app", import.meta.url)), REPO, { recursive: true });
  TREE = join(base, "tree");
  await callTool("reconstruct_scaffold", { repo: REPO, out: TREE }, { allowWrite: true });
}, 300_000);

afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

const parse = async (name: string, args: Record<string, unknown>) => JSON.parse((await callTool(name, args)).text);

describe("summary-first inventory", () => {
  it("returns counts and an inventory_id, not the whole inventory", async () => {
    const res = await parse("reconstruct_inventory", { repo: REPO });
    expect(res.inventory_id).toMatch(/^inv_[0-9a-f]{16}$/);
    expect(res.inventory).toBeUndefined();
    expect(res.summary.sections.routes).toBeGreaterThan(1);
    expect(res.summary.features.length).toBeGreaterThan(0);
    const full = await parse("reconstruct_inventory", { repo: REPO, detail: "full" });
    expect(full.inventory.routes.length).toBe(res.summary.sections.routes);
    expect(full.inventory_id).toBe(res.inventory_id);
  });

  it("pages a section deterministically, with a filter", async () => {
    const { inventory_id, summary } = await parse("reconstruct_inventory", { repo: REPO });
    const first = await parse("reconstruct_view", { inventory_id, section: "routes", limit: 1 });
    expect(first.items.length).toBe(1);
    expect(first.total).toBe(summary.sections.routes);
    expect(first.next_offset).toBe(1);
    const seen = [first.items[0]];
    let offset = first.next_offset;
    while (offset !== null) {
      const page = await parse("reconstruct_view", { inventory_id, section: "routes", limit: 1, offset });
      seen.push(...page.items);
      offset = page.next_offset;
    }
    expect(seen.length).toBe(summary.sections.routes);
    const filtered = await parse("reconstruct_view", { inventory_id, section: "routes", filter: "POST" });
    expect(filtered.items.every((r: { method?: string }) => r.method === "POST")).toBe(true);
    expect(filtered.matched).toBeLessThan(filtered.total);
  });

  it("pages a tree's inventory.json when given `out`", async () => {
    const page = await parse("reconstruct_view", { out: TREE, section: "evidence", limit: 5 });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items[0].id).toMatch(/^ev_/);
  });
});

describe("over the wire", () => {
  const server = createServer();
  async function call(name: string, args: Record<string, unknown>) {
    let out: JsonRpcMessage | undefined;
    await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, () => {});
    await server.handle({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }, (m) => {
      out = m;
    });
    return out!.result as { content: { text: string }[]; isError?: boolean; structuredContent?: Record<string, unknown>; _meta?: Record<string, unknown> };
  }

  it("a failed call carries a machine-readable recovery", async () => {
    const res = await call("reconstruct_view", { inventory_id: "inv_0000000000000000", section: "routes" });
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toMatch(/recovery: .*"kind":"run_first"/);
    expect(res.structuredContent).toMatchObject({ recovery: { kind: "run_first", do_not_repeat_unchanged: true } });
  });

  it("marks results carrying repo text as untrusted content", async () => {
    const read = await call("reconstruct_read", { out: TREE, path: "SUMMARY.md" });
    expect(read._meta).toEqual({ provenance: { untrusted_content: true } });
    const check = await call("reconstruct_check", { out: TREE });
    expect(check._meta).toBeUndefined();
  });
});
