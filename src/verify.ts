import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult } from "./check.js";
import type {
  ClaimEvidencePair,
  Inventory,
  Verdict,
  VerdictKind,
  VerifyResult,
  VerifyWorklist,
} from "./types.js";

// Bounds the requirement-verification loop (claim↔evidence pairs per run).
export const VERIFY_MAX = 60;
const VALID: VerdictKind[] = ["supported", "partial", "refuted", "unsupported"];

// The feature-PRD sections whose list items are testable requirements/claims.
const CLAIM_SECTIONS = new Set(["## Functional requirements", "## Acceptance criteria"]);

const STOP = new Set(
  "the a an is are be to of in on for and or with via from this that it its as at by into using used user users system when then given so each via must should can will every".split(
    " ",
  ),
);
function tokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t));
}
function overlap(query: string[], hay: Set<string>): number {
  let n = 0;
  for (const t of new Set(query)) if (hay.has(t)) n++;
  return n;
}

// Pull the requirement list-items out of a feature PRD's Functional requirements
// + Acceptance criteria sections. Scaffold callouts (`> 🧠 …` / "fill this in")
// and trivial lines are skipped — those aren't real requirements.
function requirements(prd: string): string[] {
  const out: string[] = [];
  let inSection = false;
  for (const raw of prd.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^##\s/.test(line)) {
      inSection = CLAIM_SECTIONS.has(line);
      continue;
    }
    if (!inSection) continue;
    const m = /^(?:[-*+]|\d+\.)\s+(.*)$/.exec(line);
    if (!m) continue;
    const text = m[1]!.replace(/^\[[ xX]\]\s*/, "").trim();
    if (!text || text.startsWith("🧠") || /fill this in/i.test(text)) continue;
    if (tokens(text).length < 2) continue;
    out.push(text);
  }
  return out;
}

interface Ev {
  ref: string;
  text: string;
}
// The evidence a feature captured from the original repo — its source files,
// routes, interfaces and entities. A requirement is "supported" when it traces
// to one of these (faithful inference) rather than being invented.
function featureEvidence(f: any): Ev[] {
  const out: Ev[] = [];
  for (const file of f.files ?? []) out.push({ ref: file, text: String(file) });
  for (const r of f.routes ?? []) {
    const sig = [r?.method, r?.path].filter(Boolean).join(" ") || (typeof r === "string" ? r : JSON.stringify(r));
    out.push({ ref: `route ${sig}`, text: sig });
  }
  for (const i of f.interfaces ?? []) out.push({ ref: `interface ${i}`, text: String(i) });
  for (const e of f.entities ?? []) out.push({ ref: `entity ${e}`, text: String(e) });
  return out;
}

// Phase A — build the requirement↔evidence worklist. For each feature PRD
// requirement, pair it with the feature's most-relevant captured evidence (by
// keyword overlap) so an agent can judge whether the requirement traces to real
// source (supported) or was invented (unsupported/refuted). Deterministic; the
// JUDGEMENT is the agent's. Capped at maxVerify. Writes VERIFY.todo.json +
// VERIFY.md.
export function runVerify(outDir: string, opts: { maxVerify?: number } = {}): VerifyWorklist {
  const inv = JSON.parse(readFileSync(join(outDir, "inventory.json"), "utf8")) as Inventory;
  const pairs: (ClaimEvidencePair & { score: number })[] = [];
  let n = 0;
  for (const f of inv.features ?? []) {
    const prdPath = join(outDir, "features", f.slug, "PRD.md");
    if (!existsSync(prdPath)) continue;
    const reqs = requirements(readFileSync(prdPath, "utf8"));
    const ev = featureEvidence(f);
    const evTok = ev.map((e) => ({ e, hay: new Set(tokens(e.text)) }));
    for (const req of reqs) {
      n++;
      const qt = tokens(req);
      const ranked = evTok
        .map(({ e, hay }) => ({ e, s: overlap(qt, hay) }))
        .sort((a, b) => b.s - a.s);
      const top = ranked.filter((x, i) => i === 0 || x.s > 0).slice(0, 3);
      const best = top[0];
      const evidenceRef =
        best && best.s > 0 ? best.e.ref : ev.length ? `feature ${f.slug}` : `feature ${f.slug} (no captured evidence)`;
      const digest =
        (top.some((x) => x.s > 0) ? top.filter((x) => x.s > 0) : ranked.slice(0, 4))
          .map((x) => x.e.ref)
          .join(" · ")
          .slice(0, 600) ||
        f.description ||
        f.name;
      pairs.push({
        claimId: `C${n}`,
        claim: req.slice(0, 400),
        feature: f.slug,
        evidenceRef,
        digest,
        score: best ? best.s : 0,
      });
    }
  }

  const max = Math.max(1, Math.floor(opts.maxVerify ?? VERIFY_MAX));
  const kept =
    pairs.length > max
      ? pairs.slice().sort((a, b) => b.score - a.score || a.claimId.localeCompare(b.claimId)).slice(0, max)
      : pairs;
  const worklist: VerifyWorklist = { run: outDir, pairs: kept.map(({ score, ...rest }) => rest) };

  const todo = {
    run: outDir,
    pairs: worklist.pairs.map((p) => ({ ...p, verdict: null as VerdictKind | null, note: "" })),
  };
  writeFileSync(join(outDir, "VERIFY.todo.json"), JSON.stringify(todo, null, 2));
  writeFileSync(join(outDir, "VERIFY.md"), renderWorklistMd(worklist, pairs.length, kept.length));
  return worklist;
}

function renderWorklistMd(wl: VerifyWorklist, total: number, kept: number): string {
  const out: string[] = [];
  out.push(`# Requirement verification worklist`);
  out.push("");
  out.push(
    `For each requirement, open the cited source evidence and judge whether the requirement ` +
      `**traces to the original code** (faithful inference) or was invented. In ` +
      `\`VERIFY.todo.json\`, set each \`verdict\` to supported · partial · refuted · unsupported ` +
      `(+ a short \`note\`), save it (e.g. as \`verdicts.json\`), then run ` +
      `\`node scripts/analyze.mjs --verify --apply verdicts.json --out <dir>\`.`,
  );
  if (kept < total) out.push(`\n_Showing ${kept} of ${total} requirement(s) — capped at the best-matched evidence._`);
  out.push("");
  for (const p of wl.pairs) {
    out.push(`## ${p.claimId} · ${p.feature} → ${p.evidenceRef}`);
    out.push(`**Requirement:** ${p.claim}`);
    out.push(`**Captured evidence:** ${p.digest}`);
    out.push(`**Verdict:** _____ · **Note:** _____`);
    out.push("");
  }
  return out.join("\n");
}

// Phase B — read an agent-filled verdicts file (`{ pairs: Verdict[] }` or a bare
// array), reduce to a VerifyResult, and persist VERIFY.json.
export function applyVerdicts(outDir: string, verdictsPath: string): VerifyResult {
  const raw = JSON.parse(readFileSync(verdictsPath, "utf8"));
  const list: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.pairs) ? raw.pairs : [];
  const verdicts: Verdict[] = [];
  for (const v of list) {
    if (!v || typeof v.claimId !== "string") continue;
    const verdict = VALID.includes(v.verdict) ? (v.verdict as VerdictKind) : (undefined as unknown as VerdictKind);
    verdicts.push({
      claimId: v.claimId,
      claim: typeof v.claim === "string" ? v.claim : "",
      feature: typeof v.feature === "string" ? v.feature : "",
      evidenceRef: typeof v.evidenceRef === "string" ? v.evidenceRef : "",
      digest: typeof v.digest === "string" ? v.digest : "",
      verdict,
      note: typeof v.note === "string" ? v.note : "",
    });
  }
  const result = reduceVerdicts(verdicts);
  writeFileSync(join(outDir, "VERIFY.json"), JSON.stringify({ ...result, verdicts }, null, 2));
  return result;
}

// Fold per-requirement verdicts into a pass/fail. A requirement FAILS if the
// source REFUTES it, or if it is `unsupported` (traces to nothing — invented).
export function reduceVerdicts(verdicts: Verdict[]): VerifyResult {
  const counts: Record<VerdictKind, number> = { supported: 0, partial: 0, refuted: 0, unsupported: 0 };
  for (const v of verdicts) if (v.verdict && counts[v.verdict] !== undefined) counts[v.verdict]++;

  const failures: VerifyResult["failures"] = [];
  const unadjudicated: string[] = [];
  for (const v of verdicts) {
    if (!v.verdict) {
      unadjudicated.push(v.claimId);
      continue;
    }
    if (v.verdict === "refuted" || v.verdict === "unsupported") {
      failures.push({ claimId: v.claimId, evidenceRef: v.evidenceRef, verdict: v.verdict, note: v.note });
    }
  }

  return {
    ok: failures.length === 0,
    pairs: verdicts.length,
    adjudicated: verdicts.filter((v) => !!v.verdict).length,
    supported: counts.supported,
    partial: counts.partial,
    refuted: counts.refuted,
    unsupported: counts.unsupported,
    failures,
    unadjudicated,
  };
}

// Fold the resolved VERIFY.json into a `--check` result when `--semantic` is set.
// Strictly additive: it can only ADD an error (a refuted/unsupported requirement),
// never relax the structural gate. Missing VERIFY.json warns, never fails.
export function foldSemantic(outDir: string, check: CheckResult): void {
  const p = join(outDir, "VERIFY.json");
  if (!existsSync(p)) {
    check.warnings.push(
      "--semantic: no VERIFY.json — run `--verify` then `--verify --apply <verdicts.json>` first; semantic gate skipped.",
    );
    return;
  }
  try {
    const sem = JSON.parse(readFileSync(p, "utf8")) as VerifyResult;
    if (!sem.ok) {
      check.errors.push(
        `semantic verification failed: ${sem.failures.length} requirement(s) refuted or unsupported by the original source (see VERIFY.json)`,
      );
    }
    if (sem.unadjudicated?.length) {
      check.warnings.push(`${sem.unadjudicated.length} requirement(s) not fully adjudicated by --verify`);
    }
  } catch (e) {
    check.warnings.push(`--semantic: VERIFY.json is unreadable (${(e as Error).message})`);
  }
}

export function formatVerifyReport(r: VerifyResult): string {
  const lines: string[] = [];
  lines.push(`reconstruct --verify: ${r.adjudicated}/${r.pairs} requirement(s) adjudicated`);
  lines.push(
    `  supported: ${r.supported} · partial: ${r.partial} · refuted: ${r.refuted} · unsupported: ${r.unsupported}`,
  );
  for (const f of r.failures.slice(0, 12)) {
    lines.push(`  ✗ ${f.claimId} (${f.evidenceRef}): ${f.verdict}${f.note ? " — " + f.note : ""}`);
  }
  if (r.unadjudicated.length) {
    lines.push(`  ⚠ ${r.unadjudicated.length} requirement(s) not fully adjudicated: ${r.unadjudicated.join(", ")}`);
  }
  lines.push(
    r.ok
      ? `  ✓ every requirement traces to the original source`
      : `  ✗ some requirements are refuted or unsupported (invented)`,
  );
  return lines.join("\n");
}
