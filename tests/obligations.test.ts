import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { analyze } from "../src/analyze.js";
import { checkFindings, checkOutput } from "../src/check.js";
import { writeOutput } from "../src/output.js";
import { render } from "../src/prd/render.js";
import type { ClaimEvidencePair, Inventory, Options, Verdict } from "../src/types.js";
import { buildObligations } from "../src/verify.js";

// The obligation ledger and the typed gate findings: fail-closed closure rules,
// digests that move with content, stable codes for every message.

const temps: string[] = [];
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

const inv = {
  repoName: "demo",
  files: [{ path: "src/a.ts", ext: ".ts", size: 1, lines: 10, category: "code", binary: false }],
  features: [],
} as unknown as Inventory;
const pair = (id: string, fp = `fp-${id}`): ClaimEvidencePair => ({
  claimId: id,
  claim: `req ${id}`,
  feature: "f",
  evidenceRef: "src/a.ts",
  digest: "",
  fingerprint: fp,
});
const verdict = (id: string, extra: Partial<Verdict> = {}): Verdict => ({
  ...pair(id),
  verdict: "supported",
  note: "",
  confidence: "confirmed",
  authority: "source",
  ...extra,
});

describe("obligation closure", () => {
  it("closes only on a bound, non-gap, non-inference supported verdict", () => {
    const pairs = ["C1", "C2", "C3", "C4", "C5", "C6", "C7"].map((id) => pair(id));
    const verdicts = [
      verdict("C1"),
      verdict("C2", { authority: "agent" }),
      verdict("C3", { confidence: "gap" }),
      verdict("C4", { verdict: "refuted" }),
      verdict("C5", { evidenceRef: "src/missing.ts" }),
      verdict("C6", { fingerprint: "fp-old" }),
      // C7: never adjudicated
    ];
    const l = buildObligations(pairs, verdicts, inv);
    const status = Object.fromEntries(l.obligations.map((o) => [o.id, o.status]));
    expect(status).toEqual({ C1: "closed", C2: "open", C3: "open", C4: "failed", C5: "failed", C6: "open", C7: "open" });
    expect([l.closed, l.open, l.failed, l.total]).toEqual([1, 4, 2, 7]);
  });

  it("ledgerId names the requirement set; closureDigest moves with any verdict", () => {
    const pairs = [pair("C1"), pair("C2")];
    const a = buildObligations(pairs, [verdict("C1"), verdict("C2")], inv);
    const b = buildObligations(pairs, [verdict("C1"), verdict("C2", { verdict: "partial" })], inv);
    const c = buildObligations([pair("C1"), pair("C2", "fp-edited")], [verdict("C1"), verdict("C2")], inv);
    expect(a.ledgerId).toBe(b.ledgerId);
    expect(a.closureDigest).not.toBe(b.closureDigest);
    expect(c.ledgerId).not.toBe(a.ledgerId);
    expect(buildObligations(pairs, [verdict("C1"), verdict("C2")], inv)).toEqual(a);
  });
});

describe("typed findings", () => {
  it("gives every message of a fresh scaffold a stable, specific code", () => {
    const base = mkdtempSync(join(tmpdir(), "rc-find-"));
    temps.push(base);
    const repo = fileURLToPath(new URL("./fixtures/sample-app", import.meta.url));
    const out = join(base, "tree");
    const o: Options = {
      repo,
      out,
      mode: "preserve",
      level: "complex",
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
    writeOutput(render(analyze(o), o), o);
    const findings = checkFindings(checkOutput(out));
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.code, f.message).not.toBe("RC999_OTHER");
      expect(f.next_action.length).toBeGreaterThan(0);
    }
    expect(findings.some((f) => f.code === "RC010_UNRESOLVED_CALLOUT" && f.file?.endsWith(".md"))).toBe(true);
  });

  it("maps the semantic and unknowns messages", () => {
    const codes = checkFindings({
      errors: [
        "--semantic: no VERIFY.json — run `--verify` then `--verify --apply <verdicts.json>` first (or pass --allow-unverified to downgrade this to a warning)",
        "--semantic: no REVIEW.json — run `--review` then `--review --apply <findings.json>` first (or pass --allow-unverified to downgrade this to a warning)",
        'UNKNOWNS.json: blocker U3 is open — "Which DB?"',
        "--semantic: 2 verdict(s) labeled confidence:gap — the cited evidence is thin",
      ],
      warnings: ["features/01-core/PRD.md: broken link → ../x.md"],
    }).map((f) => f.code);
    expect(codes).toEqual(["RC080_NO_VERIFICATION", "RC090_NO_REVIEW", "RC070_OPEN_BLOCKER_UNKNOWN", "RC084_THIN_EVIDENCE", "RC060_BROKEN_LINK"]);
  });

  it("a finding that names a document keeps its own code, not the document's", () => {
    const codes = checkFindings({
      errors: [
        'UNKNOWNS.json: blocker U1 is open — "Is the digest mismatch in DESIGN-SYSTEM.md intended?"',
        "UNKNOWNS.json: U2: `resolved` needs at least one `evidence` citation",
        "architecture/DESIGN-SYSTEM.md is missing but UI was detected — capture the visual contract.",
      ],
      warnings: ["architecture/DESIGN-SYSTEM.md: broken link → ../VERIFY.json"],
    }).map((f) => f.code);
    expect(codes).toEqual(["RC070_OPEN_BLOCKER_UNKNOWN", "RC073_UNKNOWN_INVALID", "RC042_DESIGN_SYSTEM", "RC060_BROKEN_LINK"]);
  });
});
