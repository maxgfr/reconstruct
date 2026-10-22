import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { analyze } from "../src/analyze.js";
import { checkOutput } from "../src/check.js";
import { callTool } from "../src/mcp/handlers.js";
import { writeOutput } from "../src/output.js";
import { render } from "../src/prd/render.js";
import type { Inventory, Options, UnknownsLedger } from "../src/types.js";
import { applyUnknownUpdates, ensureUnknowns, UNKNOWNS_FILE, unknownDigest } from "../src/unknowns.js";

// The residual-unknowns ledger: revisioned, hash-chained records; resolution
// needs a citation that resolves; an unsettled blocker fails the gate.

const temps: string[] = [];
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

let out = "";
let inv: Inventory;

beforeEach(() => {
  const base = mkdtempSync(join(tmpdir(), "rc-unk-"));
  temps.push(base);
  const repo = join(base, "repo");
  cpSync(fileURLToPath(new URL("./fixtures/express-app", import.meta.url)), repo, { recursive: true });
  out = join(base, "tree");
  const o: Options = {
    repo,
    out,
    mode: "preserve",
    level: "light",
    fidelity: "describe",
    granularity: "coarse",
    include: [],
    exclude: [],
    json: false,
    maxEmbedBytes: 16000,
    merge: false,
    summary: false,
    features: false,
    specs: false,
    standalone: false,
    scratch: false,
    plan: "",
    tdd: false,
    check: false,
  };
  inv = analyze(o);
  writeOutput(render(inv, o), o);
});

const blockerErrors = () => checkOutput(out).errors.filter((e) => e.startsWith(UNKNOWNS_FILE));

describe("seeding", () => {
  it("seeds one open record per engine unknown, once", () => {
    expect(existsSync(join(out, UNKNOWNS_FILE))).toBe(false);
    const ledger = ensureUnknowns(out);
    expect(ledger.unknowns.map((u) => u.question)).toEqual(inv.unknowns);
    expect(ledger.unknowns.every((u) => u.status === "open" && u.revision === 1 && u.previousDigest === null && u.source === "engine")).toBe(true);
    expect(ensureUnknowns(out)).toEqual(ledger);
  });

  it("an absent ledger never affects the gate", () => {
    expect(blockerErrors()).toEqual([]);
  });
});

describe("updates", () => {
  it("an unsettled blocker fails the gate until it is resolved with real evidence", () => {
    const added = applyUnknownUpdates(out, [
      { question: "Does POST /users hash the password?", severity: "blocker", recommendedProbes: ["read the users route"] },
    ]);
    const rec = added.unknowns.at(-1)!;
    expect(rec.source).toBe("agent");
    expect(blockerErrors().some((e) => e.includes(rec.id))).toBe(true);

    expect(() => applyUnknownUpdates(out, [{ id: rec.id, status: "resolved" }])).toThrow(/needs at least one `evidence`/);
    expect(() => applyUnknownUpdates(out, [{ id: rec.id, status: "resolved", evidence: ["ev_0000000000000000"] }])).toThrow(/does not resolve/);

    const ev = inv.evidence?.[0]?.id as string;
    const resolved = applyUnknownUpdates(out, [{ id: rec.id, status: "resolved", evidence: [ev] }]).unknowns.find((u) => u.id === rec.id)!;
    expect(resolved.revision).toBe(2);
    expect(resolved.previousDigest).toBe(rec.digest);
    expect(blockerErrors()).toEqual([]);
  });

  it("is fail-closed: one bad row means nothing is written", () => {
    ensureUnknowns(out);
    const before = readFileSync(join(out, UNKNOWNS_FILE), "utf8");
    expect(() => applyUnknownUpdates(out, [{ question: "fine" }, { question: "bad", severity: "catastrophic" }])).toThrow(/severity/);
    expect(readFileSync(join(out, UNKNOWNS_FILE), "utf8")).toBe(before);
  });

  it("flags a hand-edited record whose digest no longer matches", () => {
    const ledger = applyUnknownUpdates(out, [{ question: "original question" }]);
    const edited: UnknownsLedger = { ...ledger, unknowns: ledger.unknowns.map((u, i) => (i === 0 ? { ...u, question: "edited" } : u)) };
    writeFileSync(join(out, UNKNOWNS_FILE), JSON.stringify(edited));
    expect(checkOutput(out).warnings.some((w) => w.includes("digest mismatch"))).toBe(true);
    const { digest, ...rest } = ledger.unknowns[0]!;
    expect(unknownDigest(rest)).toBe(digest);
  });

  it("the gate re-applies the citation rules: a hand-settled blocker still fails", () => {
    const ledger = applyUnknownUpdates(out, [{ question: "Which DB?", severity: "blocker" }]);
    const settle = (patch: Partial<UnknownsLedger["unknowns"][number]>) =>
      writeFileSync(join(out, UNKNOWNS_FILE), JSON.stringify({ ...ledger, unknowns: ledger.unknowns.map((u) => ({ ...u, ...patch })) }));
    settle({ status: "resolved", evidence: [] });
    expect(blockerErrors().some((e) => /`resolved` needs at least one `evidence`/.test(e))).toBe(true);
    settle({ status: "resolved", evidence: ["ev_0000000000000000"] });
    expect(blockerErrors().some((e) => /does not resolve/.test(e))).toBe(true);
    settle({ status: "resolved", evidence: "nope" as unknown as string[] });
    expect(blockerErrors().some((e) => /is malformed/.test(e))).toBe(true);
    settle({ status: "resolved", evidence: [inv.evidence?.[0]?.id as string] });
    expect(blockerErrors()).toEqual([]);
  });
});

describe("MCP reconstruct_unknowns", () => {
  it("lists, records and reports the gate", async () => {
    const listed = JSON.parse((await callTool("reconstruct_unknowns", { out })).text);
    expect(listed.ok).toBe(true);
    // Listing seeds in memory only: a read-only server writes nothing.
    expect(existsSync(join(out, UNKNOWNS_FILE))).toBe(false);
    const updates = [{ question: "Which DB?", severity: "blocker" }];
    // Recording rewrites what the gate reads: refused on a read-only server.
    await expect(callTool("reconstruct_unknowns", { out, updates })).rejects.toMatchObject({ recovery: { kind: "grant_write" } });
    const recorded = JSON.parse((await callTool("reconstruct_unknowns", { out, updates }, { allowWrite: true })).text);
    expect(recorded.ok).toBe(false);
    expect(recorded.gate.errors[0]).toMatch(/blocker U\d+ is open/);
  });
});
