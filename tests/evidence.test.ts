import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { analyze } from "../src/analyze.js";
import { checkOutput } from "../src/check.js";
import { canonicalJson, evidenceId } from "../src/evidence.js";
import { callTool } from "../src/mcp/handlers.js";
import { writeOutput } from "../src/output.js";
import { render } from "../src/prd/render.js";
import type { Options, Verdict } from "../src/types.js";
import { reduceVerdicts, resolveEvidence } from "../src/verify.js";

// Provenance: every statically resolved fact carries a content-addressed record
// (file, line, content hash) with separate confidence and authority axes.

const temps: string[] = [];
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

function opts(repo: string, out: string): Options {
  return {
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
}

function copyFixture(name: string): string {
  const base = mkdtempSync(join(tmpdir(), "rc-ev-"));
  temps.push(base);
  const repo = join(base, "repo");
  cpSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), repo, { recursive: true });
  return repo;
}

describe("evidence ids", () => {
  it("are content-addressed: key order does not matter, content does", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
    const a = evidenceId({ kind: "route", subject: "GET /a", confidence: "observed", authority: "source" });
    const b = evidenceId({ authority: "source", confidence: "observed", subject: "GET /a", kind: "route" });
    const c = evidenceId({ kind: "route", subject: "GET /b", confidence: "observed", authority: "source" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^ev_[0-9a-f]{16}$/);
  });
});

describe("inventory evidence", () => {
  const repo = copyFixture("express-app");
  const inv = analyze(opts(repo, join(repo, "reconstruction")));

  it("records every route with its declaration line and the file's hash", () => {
    const routeEv = (inv.evidence ?? []).filter((e) => e.kind === "route");
    expect(routeEv.length).toBe(inv.routes.length);
    for (const r of inv.routes) expect(r.line).toBeGreaterThan(0);
    for (const e of routeEv) {
      expect(e.source?.line).toBeGreaterThan(0);
      expect(e.source?.hash).toMatch(/^[0-9a-f]{16}$/);
      expect(e.confidence).toBe("observed");
    }
  });

  it("is deterministic across runs", () => {
    const again = analyze(opts(repo, join(repo, "reconstruction")));
    expect(again.evidence).toEqual(inv.evidence);
  });

  it("resolves ev_ ids only when the inventory recorded them", () => {
    const id = inv.evidence?.[0]?.id as string;
    expect(resolveEvidence(id, inv)).toBe(true);
    expect(resolveEvidence("ev_0000000000000000", inv)).toBe(false);
  });
});

describe("authority in verdicts", () => {
  it("folds a supported verdict resting on agent inference as partial", () => {
    const base = { claim: "x", feature: "f", evidenceRef: "feature f", digest: "", note: "" };
    const verdicts: Verdict[] = [
      { ...base, claimId: "C1", verdict: "supported", authority: "source" },
      { ...base, claimId: "C2", verdict: "supported", authority: "agent" },
    ];
    const r = reduceVerdicts(verdicts);
    expect(r.supported).toBe(1);
    expect(r.partial).toBe(1);
    expect(r.inferenceOnly).toEqual(["C2"]);
  });
});

describe("evidence freshness", () => {
  it("warns when a cited file changed after generation, only when the repo is named", () => {
    const repo = copyFixture("express-app");
    const out = join(repo, "reconstruction");
    const o = opts(repo, out);
    const inv = analyze(o);
    writeOutput(render(inv, o), o);
    expect(checkOutput(out, { repo }).warnings.filter((w) => w.startsWith("stale evidence"))).toEqual([]);
    const cited = inv.routes[0]?.file as string;
    writeFileSync(join(repo, cited), "// rewritten\n");
    expect(checkOutput(out, { repo }).warnings.some((w) => w.startsWith("stale evidence") && w.includes(cited))).toBe(true);
    expect(checkOutput(out).warnings.some((w) => w.startsWith("stale evidence"))).toBe(false);
  });
});

describe("MCP reconstruct_check", () => {
  it("really folds the semantic ledgers when semantic is set", async () => {
    const repo = copyFixture("express-app");
    const out = join(repo, "reconstruction");
    await callTool("reconstruct_scaffold", { repo, out }, { allowWrite: true });
    const plain = JSON.parse((await callTool("reconstruct_check", { out })).text);
    const semantic = JSON.parse((await callTool("reconstruct_check", { out, semantic: true })).text);
    // No VERIFY.json/REVIEW.json yet: the semantic gate must add errors.
    expect(semantic.errors.length).toBeGreaterThan(plain.errors.length);
  });
});
