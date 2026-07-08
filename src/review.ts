import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult } from "./check.js";
import type { Inventory, ReviewCategory, ReviewFinding, ReviewResult, ReviewSeverity, ReviewUnit, ReviewWorklist } from "./types.js";

// The architecture docs every feature PRD's contract hangs off — a change to any
// of them can regress every feature, so they fold into one shared `archHash`.
const ARCH_DOCS = ["architecture/INTERFACES.md", "architecture/DATA-MODEL.md", "architecture/ARCHITECTURE.md"];

const SEVERITIES: ReviewSeverity[] = ["blocker", "major", "minor"];
const CATEGORIES: ReviewCategory[] = ["stories", "requirements", "acceptance", "write-contract", "enum", "consistency", "faithfulness", "i18n", "rebuild-test"];

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function readIfExists(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

/** The shared architecture-docs hash — concatenation of the three contract docs. */
function archHash(outDir: string): string {
  return sha256(ARCH_DOCS.map((rel) => `# ${rel}\n` + readIfExists(join(outDir, rel))).join("\n"));
}

/** Normalize a finding's problem text so the same issue hashes to the same id. */
function normalizeProblem(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Stable id `feature:category:hash(problem)` — survives rounds while the finding does. */
function findingId(f: { feature: string; category: string; problem: string }): string {
  return `${f.feature}:${f.category}:${sha256(normalizeProblem(f.problem)).slice(0, 8)}`;
}

// Phase A — build the per-feature review worklist. For each feature PRD, hash it
// and the shared architecture docs, and flag `needsReview` when it is the first
// round or the hashes moved since the last REVIEW.json (the "only re-review what
// changed" signal). Deterministic; the JUDGEMENT (the nine-check findings) is the
// agent's. Writes REVIEW.todo.json + REVIEW.md.
export function runReview(outDir: string): ReviewWorklist {
  const inv = readInventory(outDir);
  const prior = readPrior(outDir);
  const round = (prior?.round ?? 0) + 1;
  const arch = archHash(outDir);
  // An architecture-doc change can regress every feature → everything re-reviews.
  const archChanged = prior ? prior.archHash !== arch : true;

  const units: ReviewUnit[] = [];
  const changedSet: string[] = [];
  for (const f of inv.features ?? []) {
    const prdPath = join(outDir, "features", f.slug, "PRD.md");
    if (!existsSync(prdPath)) continue;
    const prdHash = sha256(readFileSync(prdPath, "utf8"));
    const priorHash = prior?.units.get(f.slug);
    const changed = priorHash !== undefined && priorHash !== prdHash;
    // A feature absent from the prior round (split/added since) must be reviewed.
    const isNew = prior !== null && priorHash === undefined;
    const needsReview = prior === null || archChanged || changed || isNew;
    if (needsReview) changedSet.push(f.slug);
    units.push({ feature: f.slug, prdHash, archHash: arch, needsReview, findings: [] });
  }

  const worklist: ReviewWorklist = { run: outDir, round, changedSet, units };
  writeFileSync(join(outDir, "REVIEW.todo.json"), JSON.stringify(worklist, null, 2));
  writeFileSync(join(outDir, "REVIEW.md"), renderWorklistMd(worklist));
  return worklist;
}

/** Read inventory.json with a friendly error instead of a raw JSON/ENOENT stack. */
function readInventory(outDir: string): Inventory {
  let raw: string;
  try {
    raw = readFileSync(join(outDir, "inventory.json"), "utf8");
  } catch {
    throw new Error(`no inventory.json in ${outDir} — not a reconstruction output (run the analyzer first)`);
  }
  try {
    return JSON.parse(raw) as Inventory;
  } catch (e) {
    throw new Error(`inventory.json is not valid JSON: ${(e as Error).message}`);
  }
}

interface Prior {
  round: number;
  staleRounds: number;
  residual: string[];
  archHash: string;
  units: Map<string, string>; // feature → prdHash, from the last ADJUDICATED round
}

/**
 * Recover the last *adjudicated* state from REVIEW.json — including the content-hash
 * `baseline` that round committed. Diffing against the baseline (only `--apply`
 * moves it), not against REVIEW.todo.json (every `--review` overwrites it), makes
 * repeated `--review` calls idempotent. Falls back to the prior todo when an older
 * REVIEW.json carries no baseline.
 */
function readPrior(outDir: string): Prior | null {
  const reviewPath = join(outDir, "REVIEW.json");
  if (!existsSync(reviewPath)) return null;
  let rev: ReviewResult;
  try {
    rev = JSON.parse(readFileSync(reviewPath, "utf8")) as ReviewResult;
  } catch {
    return null;
  }
  const units = new Map<string, string>();
  let priorArch = "";
  if (rev.baseline && Array.isArray(rev.baseline.features)) {
    priorArch = rev.baseline.archHash ?? "";
    for (const u of rev.baseline.features) units.set(u.feature, u.prdHash);
  } else {
    // Fallback for a baseline-less REVIEW.json: the prior todo's hashes.
    try {
      const todo = JSON.parse(readFileSync(join(outDir, "REVIEW.todo.json"), "utf8")) as ReviewWorklist;
      for (const u of todo.units ?? []) units.set(u.feature, u.prdHash);
      priorArch = todo.units?.[0]?.archHash ?? "";
    } catch {
      /* no prior todo — treat all as changed */
    }
  }
  return {
    round: rev.round ?? 0,
    staleRounds: rev.staleRounds ?? 0,
    residual: rev.residual ?? [],
    archHash: priorArch,
    units,
  };
}

function renderWorklistMd(wl: ReviewWorklist): string {
  const out: string[] = [];
  const due = wl.units.filter((u) => u.needsReview);
  out.push(`# AI buildability review worklist — round ${wl.round}`);
  out.push("");
  out.push(
    `Review the ${due.length} feature(s) flagged below against the nine checks in ` +
      `\`references/ai-review-rubric.md\` (story completeness, requirement testability, real ` +
      `Given/When/Then, write-contract satisfiability, enum fidelity, cross-doc consistency, ` +
      `faithfulness, i18n, the rebuild self-test). For each, read the PRD plus the architecture ` +
      `docs it references and the embedded source. Keep the reviewer **separate from the author** ` +
      `and prompt it to find reasons the unit is *not* buildable.`,
  );
  out.push("");
  out.push(
    `Emit each finding as \`{ feature, severity (blocker|major|minor), category, problem, fix }\`. ` +
      `Have an **independent verifier** set \`verdict\` to \`confirmed\` or \`refuted\` per blocker ` +
      `(a refuted blocker does not gate). Save the findings (e.g. as \`findings.json\`, shape ` +
      `\`{ "findings": [...] }\`), then run ` +
      `\`node scripts/analyze.mjs --review --apply findings.json --out <dir>\`.`,
  );
  out.push("");
  if (wl.changedSet.length && wl.round > 1) {
    out.push(`_Changed since last round: ${wl.changedSet.join(", ")}._`);
    out.push("");
  }
  for (const u of wl.units) {
    out.push(`## ${u.feature}${u.needsReview ? "" : " — _unchanged, skip_"}`);
    out.push(`PRD: \`features/${u.feature}/PRD.md\``);
    out.push("");
  }
  return out.join("\n");
}

const VALID_SEVERITY = new Set(SEVERITIES);
const VALID_CATEGORY = new Set(CATEGORIES);

// Normalize an agent-filled findings file: a bare array, `{ findings: [...] }`,
// or the worklist shape `{ units: [{ feature, findings: [...] }] }`.
function normalizeFindings(raw: any): ReviewFinding[] {
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (Array.isArray(raw?.findings)) list = raw.findings;
  else if (Array.isArray(raw?.units)) {
    for (const u of raw.units) {
      for (const f of u?.findings ?? []) list.push({ feature: f.feature ?? u.feature, ...f });
    }
  }
  const out: ReviewFinding[] = [];
  for (const f of list) {
    if (!f || typeof f.feature !== "string") continue;
    if (!VALID_SEVERITY.has(f.severity)) continue;
    const category: ReviewCategory = VALID_CATEGORY.has(f.category) ? f.category : "rebuild-test";
    const finding: ReviewFinding = {
      feature: f.feature,
      severity: f.severity,
      category,
      problem: typeof f.problem === "string" ? f.problem : "",
      fix: typeof f.fix === "string" ? f.fix : "",
      verdict: f.verdict === "confirmed" || f.verdict === "refuted" ? f.verdict : null,
      verifierNote: typeof f.verifierNote === "string" ? f.verifierNote : "",
    };
    finding.id = typeof f.id === "string" && f.id ? f.id : findingId(finding);
    out.push(finding);
  }
  return out;
}

/** A blocker gates buildability unless an independent verifier refuted it. */
function gates(f: ReviewFinding): boolean {
  return f.severity === "blocker" && f.verdict !== "refuted";
}

// Phase B — reduce agent-filled findings into a pass / changed-set / no-progress
// signal. Pure: given this round's findings and the prior round's open blockers,
// it decides the fixpoint.
//
// Soundness: a feature's blockers are re-decided this round only if the agent
// **touched** it — flagged `needsReview`, or submitted a finding for it. An open
// blocker in an **untouched** feature **carries forward** (no new information →
// it stands), so the "only re-review what changed" optimization can never silently
// drop a real blocker and declare a false `ok`. `ok` is zero open blockers
// (majors/minors never gate); `noProgress` is the same open-blocker id set as last
// round, which — with `staleRounds` — lets the loop terminate instead of spinning.
export function reduceFindings(
  findings: ReviewFinding[],
  ctx: {
    round: number;
    changedSet: string[];
    units: number;
    reviewedFeatures: string[];
    /** Every feature still in the current worklist; empty = unknown (no worklist). */
    currentFeatures: string[];
    priorFailures: ReviewResult["failures"];
    priorStale: number;
  },
): ReviewResult {
  let majors = 0;
  let minors = 0;
  for (const f of findings) {
    if (f.severity === "major") majors++;
    else if (f.severity === "minor") minors++;
  }

  // Features the agent looked at this round; their submitted findings are the
  // new truth. Everything else is untouched and keeps its prior open blockers.
  const touched = new Set<string>([...ctx.reviewedFeatures, ...findings.map((f) => f.feature)]);
  const known = new Set(ctx.currentFeatures);
  const fresh = findings.filter(gates).map((f) => ({
    id: f.id ?? findingId(f),
    feature: f.feature,
    category: f.category,
    problem: f.problem,
    fix: f.fix,
  }));
  // Carry forward an untouched feature's open blockers — but only if the feature
  // still exists (a removed feature's stale blocker must not haunt the residual).
  const carried = ctx.priorFailures.filter((pf) => !touched.has(pf.feature) && (known.size === 0 || known.has(pf.feature)));

  const byId = new Map<string, ReviewResult["failures"][number]>();
  for (const f of carried) byId.set(f.id, f);
  for (const f of fresh) byId.set(f.id, f); // a fresh re-find supersedes the carried copy
  // Code-unit order for BOTH residual and priorResidual so the no-progress
  // comparison can never misfire on a sort mismatch (ids contain `:` and `-`).
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const failures = [...byId.values()].sort((a, b) => cmp(a.id, b.id));
  const residual = failures.map((f) => f.id);

  const priorResidual = [...new Set(ctx.priorFailures.map((f) => f.id))].sort(cmp);
  const sameAsPrior = residual.length > 0 && residual.length === priorResidual.length && residual.every((id, i) => id === priorResidual[i]);
  const noProgress = sameAsPrior;
  const staleRounds = noProgress ? ctx.priorStale + 1 : 0;

  return {
    ok: residual.length === 0,
    round: ctx.round,
    units: ctx.units,
    reviewed: ctx.reviewedFeatures.length,
    blockers: failures.length,
    majors,
    minors,
    changedSet: ctx.changedSet,
    residual,
    noProgress,
    staleRounds,
    failures,
    findings,
  };
}

// Read an agent-filled findings file, reduce it against the worklist (round,
// changed-set) and the prior REVIEW.json (residual, staleRounds), and persist
// REVIEW.json.
export function applyFindings(outDir: string, findingsPath: string): ReviewResult {
  const findings = normalizeFindings(JSON.parse(readFileSync(findingsPath, "utf8")));

  let round: number | undefined;
  let changedSet: string[] = [];
  let units = 0;
  let reviewedFeatures: string[] = [];
  let currentFeatures: string[] = [];
  let baseline: ReviewResult["baseline"];
  try {
    const todo = JSON.parse(readFileSync(join(outDir, "REVIEW.todo.json"), "utf8")) as ReviewWorklist;
    round = todo.round;
    changedSet = todo.changedSet ?? [];
    units = todo.units?.length ?? 0;
    reviewedFeatures = (todo.units ?? []).filter((u) => u.needsReview).map((u) => u.feature);
    currentFeatures = (todo.units ?? []).map((u) => u.feature);
    // The hashes this round adjudicates — the next --review diffs against these.
    baseline = {
      archHash: todo.units?.[0]?.archHash ?? "",
      features: (todo.units ?? []).map((u) => ({ feature: u.feature, prdHash: u.prdHash })),
    };
  } catch {
    /* no worklist on disk — reduce with defaults */
  }

  let priorFailures: ReviewResult["failures"] = [];
  let priorStale = 0;
  let priorRound = 0;
  const reviewPath = join(outDir, "REVIEW.json");
  if (existsSync(reviewPath)) {
    try {
      const prev = JSON.parse(readFileSync(reviewPath, "utf8")) as ReviewResult;
      priorFailures = prev.failures ?? [];
      priorStale = prev.staleRounds ?? 0;
      priorRound = prev.round ?? 0;
    } catch {
      /* unreadable prior — start fresh */
    }
  }

  const result = reduceFindings(findings, {
    round: round ?? priorRound + 1, // fall back to prior+1 if the worklist is gone
    changedSet,
    units,
    reviewedFeatures,
    currentFeatures,
    priorFailures,
    priorStale,
  });
  if (baseline) result.baseline = baseline;
  writeFileSync(reviewPath, JSON.stringify(result, null, 2));
  return result;
}

/**
 * Recompute the review gate from the persisted ledger: the union of the stored
 * open-blocker `failures[]` and every finding in `findings[]` that still gates
 * (an unrefuted blocker). Trustless on `rev.ok`/`rev.residual`. Integrity
 * boundary: wholesale deletion of BOTH arrays is indistinguishable from a clean
 * review — that case is defended by the fail-closed absence handling plus the
 * `--review --apply` flow, which always persists the arrays together.
 */
export function recomputeReviewGate(rev: ReviewResult): string[] {
  const ids = new Set<string>();
  for (const f of rev.failures ?? []) if (f && typeof f.id === "string") ids.add(f.id);
  for (const f of rev.findings ?? []) {
    if (!f || typeof f.feature !== "string") continue;
    if (gates(f)) ids.add(f.id ?? findingId(f));
  }
  return [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// Fold the buildability-review ledger into a `--check` result when `--semantic`
// is set. Strictly additive on the structural gate, and trustless on the ledger:
// the open-blocker set is RECOMPUTED from `failures[]` ∪ gating `findings[]` at
// check time — a hand-edited or stale `ok: true` never passes. Fails closed: a
// missing or unreadable REVIEW.json is an error unless `allowUnverified`
// explicitly downgrades it.
export function foldReview(outDir: string, check: CheckResult, opts: { allowUnverified?: boolean } = {}): void {
  const p = join(outDir, "REVIEW.json");
  const skip = (msg: string): void => {
    if (opts.allowUnverified) check.warnings.push(`${msg}; review gate skipped (--allow-unverified)`);
    else check.errors.push(`${msg} (or pass --allow-unverified to downgrade this to a warning)`);
  };
  if (!existsSync(p)) {
    skip("--semantic: no REVIEW.json — run `--review` then `--review --apply <findings.json>` first");
    return;
  }
  let rev: ReviewResult;
  try {
    rev = JSON.parse(readFileSync(p, "utf8")) as ReviewResult;
  } catch (e) {
    skip(`--semantic: REVIEW.json is unreadable (${(e as Error).message})`);
    return;
  }
  const residual = recomputeReviewGate(rev);
  if (residual.length) {
    check.errors.push(`AI buildability review failed: ${residual.length} unresolved blocker(s) across the feature PRDs (see REVIEW.json)`);
  }
  if (rev.noProgress) {
    check.warnings.push(
      `review made no progress for ${rev.staleRounds} round(s) on the same ${residual.length} blocker(s) — fix the shared architecture contract or record them as known gaps`,
    );
  }
}

export function formatReviewReport(r: ReviewResult): string {
  const lines: string[] = [];
  lines.push(
    `reconstruct --review: round ${r.round} · ${r.reviewed}/${r.units} unit(s) reviewed · ` +
      `${r.blockers} blocker(s) · ${r.majors} major(s) · ${r.minors} minor(s)`,
  );
  for (const f of r.failures.slice(0, 12)) {
    lines.push(`  ✗ ${f.feature} [${f.category}]: ${f.problem}${f.fix ? " — fix: " + f.fix : ""}`);
  }
  if (r.noProgress) {
    lines.push(`  ⚠ no progress for ${r.staleRounds} round(s) on the same blocker(s) — fix the upstream architecture contract or record as known gaps`);
  }
  lines.push(
    r.ok
      ? `  ✓ zero unresolved blockers — the tree passes the AI buildability review`
      : `  ✗ ${r.residual.length} blocker(s) gate buildability — fix in place, re-review the changed units, repeat`,
  );
  return lines.join("\n");
}
