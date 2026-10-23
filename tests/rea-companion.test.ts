import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { analyze, opaqueArtifacts } from "../src/analyze.js";
import { checkOutput } from "../src/check.js";
import { loadExternalEvidence, REA_EVIDENCE_DIR } from "../src/evidence.js";
import { writeOutput } from "../src/output.js";
import { getPrompt } from "../src/mcp/prompts.js";
import { render } from "../src/prd/render.js";
import type { FileInfo, Inventory, Options, Verdict } from "../src/types.js";
import { applyUnknownUpdates, UNKNOWNS_FILE } from "../src/unknowns.js";
import { buildObligations, reduceVerdicts, resolveEvidence } from "../src/verify.js";

// rea as a companion: the engine flags what the source walk cannot see, and
// evidence exported from rea into the tree is citable — and checked — like the
// engine's own.

const temps: string[] = [];
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

const REA_ID = `ev_${"a1".repeat(32)}`;
const UNEXPORTED = `ev_${"b2".repeat(32)}`;

let repo = "";
let out = "";
let inv: Inventory;

function options(): Options {
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

beforeEach(() => {
  const base = mkdtempSync(join(tmpdir(), "rc-rea-"));
  temps.push(base);
  repo = join(base, "repo");
  out = join(base, "tree");
  cpSync(fileURLToPath(new URL("./fixtures/express-app", import.meta.url)), repo, { recursive: true });
  mkdirSync(join(repo, "lib"), { recursive: true });
  writeFileSync(join(repo, "lib", "libcrypto.so.3"), Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0, 1, 2, 3]));
  writeFileSync(join(repo, "lib", "engine.wasm"), Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]));
  inv = analyze(options());
  writeOutput(render(inv, options()), options());
});

function exportBundle(ids: string[]): void {
  const dir = join(out, REA_EVIDENCE_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "libcrypto.json"), JSON.stringify({ records: ids.map((evidence_id) => ({ evidence_id, kind: "function" })) }));
}

describe("compiled artifacts", () => {
  it("are flagged as an unknown that points at rea", () => {
    const u = inv.unknowns.find((q) => q.startsWith("Compiled artifacts"));
    expect(u).toBeDefined();
    expect(u).toContain("lib/engine.wasm");
    expect(u).toContain("lib/libcrypto.so.3");
    expect(u).toContain("references/rea-companion.md");
  });

  it("covers native, wasm, packages and extension-less executables — not images or source", () => {
    const f = (path: string, ext: string, binary = true): FileInfo => ({ path, ext, size: 10, lines: 0, category: "other", binary });
    const files = [
      f("bin/tool", ""),
      f("lib/a.dll", ".dll"),
      f("app.asar", ".asar"),
      f("logo.png", ".png"),
      f("src/index.ts", ".ts", false),
      f("Makefile", "", false),
    ];
    expect(opaqueArtifacts(files)).toEqual(["app.asar", "bin/tool", "lib/a.dll"]);
  });

  it("a repo without them gets no such unknown", () => {
    rmSync(join(repo, "lib"), { recursive: true });
    expect(analyze(options()).unknowns.some((q) => q.startsWith("Compiled artifacts"))).toBe(false);
  });
});

describe("rea evidence citations", () => {
  it("resolve only when an exported bundle carries the id", () => {
    expect(resolveEvidence(`rea:${REA_ID}`, inv, loadExternalEvidence(out))).toBe(false);
    exportBundle([REA_ID]);
    const external = loadExternalEvidence(out);
    expect(resolveEvidence(`rea:${REA_ID}`, inv, external)).toBe(true);
    expect(resolveEvidence(`rea:${UNEXPORTED}`, inv, external)).toBe(false);
    // Without the external set (the default), a rea id never resolves.
    expect(resolveEvidence(`rea:${REA_ID}`, inv)).toBe(false);
  });

  it("settle an unknown on apply and at the gate; an unexported id is refused", () => {
    exportBundle([REA_ID]);
    const added = applyUnknownUpdates(out, [{ question: "What does lib/libcrypto.so.3 do?", severity: "blocker" }]);
    const id = added.unknowns.at(-1)!.id;
    expect(() => applyUnknownUpdates(out, [{ id, status: "resolved", evidence: [`rea:${UNEXPORTED}`] }])).toThrow(/exported rea evidence/);
    applyUnknownUpdates(out, [{ id, status: "resolved", evidence: [`rea:${REA_ID}`] }]);
    expect(checkOutput(out).errors.filter((e) => e.startsWith(UNKNOWNS_FILE))).toEqual([]);
  });

  it("close an obligation on analyzer authority; agent authority still does not", () => {
    exportBundle([REA_ID]);
    const external = loadExternalEvidence(out);
    const pair = { claimId: "c1", feature: "01-core", claim: "Encrypts the payload", evidenceRef: `rea:${REA_ID}`, digest: "" };
    const verdict = (authority: Verdict["authority"]): Verdict => ({ ...pair, verdict: "supported", note: "", confidence: "confirmed", authority });
    expect(reduceVerdicts([verdict("analyzer")], inv, external).failures).toEqual([]);
    expect(buildObligations([pair], [verdict("analyzer")], inv, external).closed).toBe(1);
    expect(buildObligations([pair], [verdict("agent")], inv, external).closed).toBe(0);
    // The same citation without its bundle is fabricated.
    expect(buildObligations([pair], [verdict("analyzer")], inv).failed).toBe(1);
  });
});

describe("the MCP prompts point at rea", () => {
  it("enrich_feature and audit_unknowns name the companion workflow", () => {
    for (const name of ["enrich_feature", "audit_unknowns"]) {
      const text = getPrompt(name, { out }).messages[0]!.content.text;
      expect(text, name).toContain("references/rea-companion.md");
      expect(text, name).toContain(`${out}/evidence/rea/`);
    }
  });
});
