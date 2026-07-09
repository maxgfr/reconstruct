import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult } from "./check.js";
import type { ClaimEvidencePair, ConfidenceKind, Inventory, Verdict, VerdictKind, VerifyResult, VerifyWorklist } from "./types.js";

// Bounds the requirement-verification loop (claim↔evidence pairs per run).
export const VERIFY_MAX = 60;
const VALID: VerdictKind[] = ["supported", "partial", "refuted", "unsupported"];
const VALID_CONFIDENCE: ConfidenceKind[] = ["confirmed", "inferred", "gap"];

// The feature-PRD sections whose list items are testable requirements/claims.
const CLAIM_SECTIONS = new Set(["## Functional requirements", "## Acceptance criteria"]);

const STOP = new Set(
  "the a an is are be to of in on for and or with via from this that it its as at by into using used user users system when then given so each via must should can will every".split(
    " ",
  ),
);
function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
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
    // Real features carry RouteInfo rows (`route`); older ledgers/fixtures used `path`.
    const sig = [r?.method, r?.route ?? r?.path].filter(Boolean).join(" ") || (typeof r === "string" ? r : JSON.stringify(r));
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
  let invRaw: string;
  try {
    invRaw = readFileSync(join(outDir, "inventory.json"), "utf8");
  } catch {
    throw new Error(`no inventory.json in ${outDir} — not a reconstruction output (run the analyzer first)`);
  }
  let inv: Inventory;
  try {
    inv = JSON.parse(invRaw) as Inventory;
  } catch (e) {
    throw new Error(`inventory.json is not valid JSON: ${(e as Error).message}`);
  }
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
      const ranked = evTok.map(({ e, hay }) => ({ e, s: overlap(qt, hay) })).sort((a, b) => b.s - a.s);
      const top = ranked.filter((x, i) => i === 0 || x.s > 0).slice(0, 3);
      const best = top[0];
      const evidenceRef = best && best.s > 0 ? best.e.ref : ev.length ? `feature ${f.slug}` : `feature ${f.slug} (no captured evidence)`;
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
      ? pairs
          .slice()
          .sort((a, b) => b.score - a.score || a.claimId.localeCompare(b.claimId))
          .slice(0, max)
      : pairs;
  const worklist: VerifyWorklist = { run: outDir, pairs: kept.map(({ score, ...rest }) => rest) };

  const todo = {
    run: outDir,
    pairs: worklist.pairs.map((p) => ({ ...p, verdict: null as VerdictKind | null, note: "", confidence: null as ConfidenceKind | null })),
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
      `(+ a short \`note\`), and stamp each \`confidence\` to confirmed (evidence read and ` +
      `decisive) · inferred (consistent but indirect — a pattern or standard behavior) · gap ` +
      `(evidence thin; needs a human). Save it (e.g. as \`verdicts.json\`), then run ` +
      `\`node scripts/analyze.mjs --verify --apply verdicts.json --out <dir>\`.`,
  );
  if (kept < total) out.push(`\n_Showing ${kept} of ${total} requirement(s) — capped at the best-matched evidence._`);
  out.push("");
  for (const p of wl.pairs) {
    out.push(`## ${p.claimId} · ${p.feature} → ${p.evidenceRef}`);
    out.push(`**Requirement:** ${p.claim}`);
    out.push(`**Captured evidence:** ${p.digest}`);
    out.push(`**Verdict:** _____ · **Confidence:** _____ · **Note:** _____`);
    out.push("");
  }
  return out.join("\n");
}

/** Read `<out>/inventory.json` if present/parseable — else citation resolution is skipped. */
function readInventoryIfPresent(outDir: string): Inventory | undefined {
  try {
    return JSON.parse(readFileSync(join(outDir, "inventory.json"), "utf8")) as Inventory;
  } catch {
    return undefined;
  }
}

/**
 * Whether a verdict's cited evidence actually exists in the inventory. Guards the
 * ledger against fabricated citations: a `supported`/`partial` verdict must point
 * at a route, interface, entity, feature or file the reconstruction actually
 * captured. Names match exactly (never by substring) so `entity User` can't
 * resolve against `Users2`. The `digest` field is deliberately NOT validated —
 * it is a 600-char truncated join, not a hash; re-matching it would only
 * manufacture false positives.
 */
export function resolveEvidence(ref: string, inv: Inventory): boolean {
  const features = inv.features ?? [];
  const feat = /^feature (\S+)( \(no captured evidence\))?$/.exec(ref);
  if (feat) return features.some((f) => f.slug === feat[1]);

  const route = /^route (.+)$/.exec(ref);
  if (route) {
    const sig = route[1] as string;
    const sigs = new Set<string>();
    const add = (method: unknown, path: unknown): void => {
      if (typeof path !== "string" || !path) return;
      if (typeof method === "string" && method) sigs.add(`${method} ${path}`);
      sigs.add(path); // a method-less ref may cite a verb-carrying route
    };
    for (const r of inv.routes ?? []) add(r.method, r.route);
    for (const i of inv.interfaces ?? []) add(i.method, i.path);
    for (const f of features) for (const r of (f.routes ?? []) as any[]) add(r?.method, r?.route ?? r?.path);
    return sigs.has(sig);
  }

  const iface = /^interface (.+)$/.exec(ref);
  if (iface) {
    const name = iface[1] as string;
    return (inv.interfaces ?? []).some((i) => i.path === name) || features.some((f) => (f.interfaces ?? []).includes(name));
  }

  const ent = /^entity (.+)$/.exec(ref);
  if (ent) {
    const name = ent[1] as string;
    return (inv.dataModel ?? []).some((e) => e.entity === name) || features.some((f) => (f.entities ?? []).includes(name));
  }

  // Anything else is a file path, optionally with a `:line[-line]` locator.
  const path = ref.replace(/:\d+(-\d+)?$/, "");
  return (inv.files ?? []).some((f) => f.path === path) || features.some((f) => (f.files ?? []).includes(path));
}

/**
 * Read the run's VERIFY.todo.json pairs keyed by claimId — the worklist the
 * orchestrate-emitted adjudicator fragments answer. A missing/unreadable
 * worklist only disables backfill and unknown-id detection (hand-rolled
 * verdicts files stay self-contained).
 */
function readTodoPairs(outDir: string): Map<string, ClaimEvidencePair> | undefined {
  try {
    const todo = JSON.parse(readFileSync(join(outDir, "VERIFY.todo.json"), "utf8"));
    if (!Array.isArray(todo?.pairs)) return undefined;
    const byClaim = new Map<string, ClaimEvidencePair>();
    for (const p of todo.pairs) if (p && typeof p.claimId === "string") byClaim.set(p.claimId, p as ClaimEvidencePair);
    return byClaim.size ? byClaim : undefined;
  } catch {
    return undefined;
  }
}

// Phase B — read an agent-filled verdicts file (`{ pairs: Verdict[] }`, a
// `{ verdicts: Verdict[] }` object — the shape the orchestrate-emitted
// adjudicator fragments return — or a bare array), validate it FAIL-CLOSED,
// reduce to a VerifyResult (re-resolving each citation against the inventory),
// and persist VERIFY.json. Fragment rows carrying only claimId/verdict/note/
// confidence are backfilled (claim, feature, evidenceRef, digest) from the
// run's VERIFY.todo.json by claimId, so the citation guard stays engaged.
export function applyVerdicts(outDir: string, verdictsPath: string): VerifyResult {
  const raw = JSON.parse(readFileSync(verdictsPath, "utf8"));
  const list: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.pairs) ? raw.pairs : Array.isArray(raw?.verdicts) ? raw.verdicts : [];
  // Fail closed: a parseable file that yields no rows means the fold never
  // engaged — writing an empty (vacuously ok:true) VERIFY.json here is exactly
  // the fail-open path `--check --semantic` exists to prevent.
  if (list.length === 0) {
    throw new Error(`${verdictsPath}: no verdict rows found — expected a bare array, { "pairs": [...] } or { "verdicts": [...] } with at least one row.`);
  }
  const todo = readTodoPairs(outDir);
  const problems: string[] = [];
  const unknown: string[] = [];
  const verdicts: Verdict[] = [];
  for (const [i, v] of (list as any[]).entries()) {
    if (!v || typeof v.claimId !== "string") {
      problems.push(`row ${i + 1}: missing claimId`);
      continue;
    }
    // An explicit-but-unknown token is a typo, not an un-adjudication: hard-error
    // beats silently downgrading a "REFUTED!!" to a warning-level unadjudicated.
    if (v.verdict != null && !VALID.includes(v.verdict)) {
      problems.push(`row ${i + 1} (${v.claimId}): invalid verdict "${String(v.verdict)}" — expected ${VALID.join("|")} or null`);
      continue;
    }
    const base = todo?.get(v.claimId);
    if (todo && !base) {
      unknown.push(v.claimId);
      continue;
    }
    const verdict = VALID.includes(v.verdict) ? (v.verdict as VerdictKind) : (undefined as unknown as VerdictKind);
    const confidence = VALID_CONFIDENCE.includes(v.confidence) ? (v.confidence as ConfidenceKind) : undefined;
    verdicts.push({
      claimId: v.claimId,
      claim: typeof v.claim === "string" ? v.claim : (base?.claim ?? ""),
      feature: typeof v.feature === "string" ? v.feature : (base?.feature ?? ""),
      evidenceRef: typeof v.evidenceRef === "string" ? v.evidenceRef : (base?.evidenceRef ?? ""),
      digest: typeof v.digest === "string" ? v.digest : (base?.digest ?? ""),
      verdict,
      note: typeof v.note === "string" ? v.note : "",
      ...(confidence ? { confidence } : {}),
    });
  }
  if (problems.length) {
    throw new Error(`${verdictsPath}: ${problems.length} malformed row(s) — fix them and re-apply (fail-closed):\n  - ${problems.join("\n  - ")}`);
  }
  if (verdicts.length === 0) {
    throw new Error(
      `${verdictsPath}: every row cites a claimId unknown to ${join(outDir, "VERIFY.todo.json")} (${unknown.join(", ")}) — stale fragment? Re-run --verify and re-adjudicate.`,
    );
  }
  const result = reduceVerdicts(verdicts, readInventoryIfPresent(outDir));
  if (unknown.length) result.ignored = unknown;
  writeFileSync(join(outDir, "VERIFY.json"), JSON.stringify({ ...result, verdicts }, null, 2));
  return result;
}

// Fold per-requirement verdicts into a pass/fail. A requirement FAILS if the
// source REFUTES it, if it is `unsupported` (traces to nothing — invented), or —
// when an inventory is provided — if its cited evidence does not resolve
// (fabricated citation).
export function reduceVerdicts(verdicts: Verdict[], inv?: Inventory): VerifyResult {
  const counts: Record<VerdictKind, number> = { supported: 0, partial: 0, refuted: 0, unsupported: 0 };
  for (const v of verdicts) if (v.verdict && counts[v.verdict] !== undefined) counts[v.verdict]++;
  const confidence = { confirmed: 0, inferred: 0, gap: 0, unlabeled: 0 };
  for (const v of verdicts) {
    if (v.confidence && VALID_CONFIDENCE.includes(v.confidence)) confidence[v.confidence]++;
    else confidence.unlabeled++;
  }

  const failures: VerifyResult["failures"] = [];
  const unadjudicated: string[] = [];
  for (const v of verdicts) {
    if (!v.verdict) {
      unadjudicated.push(v.claimId);
      continue;
    }
    if (v.verdict === "refuted" || v.verdict === "unsupported") {
      failures.push({ claimId: v.claimId, evidenceRef: v.evidenceRef, verdict: v.verdict, note: v.note });
    } else if (inv && !resolveEvidence(v.evidenceRef, inv)) {
      failures.push({
        claimId: v.claimId,
        evidenceRef: v.evidenceRef,
        verdict: v.verdict,
        note: `fabricated citation: evidenceRef does not resolve against the inventory${v.note ? " — " + v.note : ""}`,
      });
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
    confidence,
  };
}

// Fold the requirement-verification ledger into a `--check` result when
// `--semantic` is set. Strictly additive on the structural gate, and trustless on
// the ledger: the pass/fail is RE-REDUCED from `verdicts[]` (each citation
// re-resolved against the inventory) at check time — a hand-edited or stale
// `ok: true` never passes. Fails closed: a missing, unreadable or verdict-less
// VERIFY.json is an error unless `allowUnverified` explicitly downgrades it.
export function foldSemantic(outDir: string, check: CheckResult, opts: { allowUnverified?: boolean } = {}): void {
  const p = join(outDir, "VERIFY.json");
  const skip = (msg: string): void => {
    if (opts.allowUnverified) check.warnings.push(`${msg}; semantic gate skipped (--allow-unverified)`);
    else check.errors.push(`${msg} (or pass --allow-unverified to downgrade this to a warning)`);
  };
  if (!existsSync(p)) {
    skip("--semantic: no VERIFY.json — run `--verify` then `--verify --apply <verdicts.json>` first");
    return;
  }
  let sem: VerifyResult;
  try {
    sem = JSON.parse(readFileSync(p, "utf8")) as VerifyResult;
  } catch (e) {
    skip(`--semantic: VERIFY.json is unreadable (${(e as Error).message})`);
    return;
  }
  if (!Array.isArray(sem.verdicts)) {
    skip("--semantic: VERIFY.json carries no verdicts[] ledger — regenerate it with `--verify` then `--verify --apply <verdicts.json>`");
    return;
  }
  const fresh = reduceVerdicts(sem.verdicts, readInventoryIfPresent(outDir));
  // A green semantic exit must mean the gate ENGAGED: an empty verdicts[] (the
  // old fail-open fold wrote one for fragments it could not read) or a ledger
  // whose verdicts were all dropped leaves 0 adjudications — a bypass, not a pass.
  if (fresh.adjudicated === 0) {
    skip(
      "--semantic: VERIFY.json carries 0 adjudicated verdicts — the requirement gate never engaged (re-run --verify then --verify --apply <verdicts.json> with valid verdict tokens)",
    );
    return;
  }
  if (!fresh.ok) {
    check.errors.push(
      `semantic verification failed: ${fresh.failures.length} requirement(s) refuted, unsupported or citing unresolvable evidence (see VERIFY.json)`,
    );
  }
  if (fresh.unadjudicated.length) {
    check.warnings.push(`${fresh.unadjudicated.length} requirement(s) not fully adjudicated by --verify`);
  }
  if (fresh.confidence?.gap) {
    check.warnings.push(
      `${fresh.confidence.gap} verdict(s) labeled confidence:gap — the cited evidence is thin; strengthen it or record the claims as known gaps`,
    );
  }
}

export function formatVerifyReport(r: VerifyResult): string {
  const lines: string[] = [];
  lines.push(`reconstruct --verify: ${r.adjudicated}/${r.pairs} requirement(s) adjudicated`);
  lines.push(`  supported: ${r.supported} · partial: ${r.partial} · refuted: ${r.refuted} · unsupported: ${r.unsupported}`);
  const c = r.confidence;
  if (c && c.confirmed + c.inferred + c.gap > 0) {
    lines.push(`  confidence: ${c.confirmed} confirmed · ${c.inferred} inferred · ${c.gap} gap${c.unlabeled ? ` · ${c.unlabeled} unlabeled` : ""}`);
  }
  for (const f of r.failures.slice(0, 12)) {
    lines.push(`  ✗ ${f.claimId} (${f.evidenceRef}): ${f.verdict}${f.note ? " — " + f.note : ""}`);
  }
  if (r.unadjudicated.length) {
    lines.push(`  ⚠ ${r.unadjudicated.length} requirement(s) not fully adjudicated: ${r.unadjudicated.join(", ")}`);
  }
  if (r.ignored?.length) {
    lines.push(`  ⚠ ${r.ignored.length} ignored (unknown id): ${r.ignored.join(", ")} — not in VERIFY.todo.json (stale fragment?)`);
  }
  lines.push(r.ok ? `  ✓ every requirement traces to the original source` : `  ✗ some requirements are refuted or unsupported (invented)`);
  return lines.join("\n");
}
