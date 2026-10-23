import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult } from "./check.js";
import { canonicalJson, loadExternalEvidence, sha256Hex } from "./evidence.js";
import type { Inventory, UnknownRecord, UnknownSeverity, UnknownStatus, UnknownsLedger } from "./types.js";
import { resolveEvidence } from "./verify.js";

// The residual-unknowns registry (`UNKNOWNS.json`): what the reconstruction
// still does not know, as first-class records instead of prose a reader has to
// trust was resolved. Each record is revisioned and hash-chained
// (`previous_digest` → the record's prior `digest`), a `resolved` status needs
// at least one citation that resolves against the inventory, and an open
// `blocker` fails `--check`. The engine seeds it from `inventory.unknowns`; the
// agent records what it discovers while enriching.

export const UNKNOWNS_FILE = "UNKNOWNS.json";

const SEVERITIES: UnknownSeverity[] = ["blocker", "major", "minor"];
const STATUSES: UnknownStatus[] = ["open", "investigating", "blocked", "contradicted", "resolved"];
/** Statuses that leave the question unanswered — an open blocker in any of them gates. */
const UNSETTLED = new Set<UnknownStatus>(["open", "investigating", "blocked", "contradicted"]);

/** A record's own digest: sha256 of its canonical JSON without the digest field. */
export function unknownDigest(rec: Omit<UnknownRecord, "digest">): string {
  return sha256Hex(canonicalJson(rec)).slice(0, 16);
}

function seal(rec: Omit<UnknownRecord, "digest">): UnknownRecord {
  return { ...rec, digest: unknownDigest(rec) };
}

export function readInventory(outDir: string): Inventory {
  try {
    return JSON.parse(readFileSync(join(outDir, "inventory.json"), "utf8")) as Inventory;
  } catch {
    throw new Error(`no readable inventory.json in ${outDir} — not a reconstruction output (run the analyzer first)`);
  }
}

/** Read the ledger, or undefined when the tree has none yet. Throws on a corrupt file. */
export function readUnknowns(outDir: string): UnknownsLedger | undefined {
  const path = join(outDir, UNKNOWNS_FILE);
  if (!existsSync(path)) return undefined;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as UnknownsLedger;
    if (!Array.isArray(raw?.unknowns)) throw new Error("missing `unknowns` array");
    return raw;
  } catch (e) {
    throw new Error(`${path} is not a valid unknowns ledger: ${(e as Error).message}`);
  }
}

/** The engine's own unknowns, as revision-1 `open` records (U1…Un, in order). */
export function seedUnknowns(inv: Inventory): UnknownsLedger {
  const unknowns = (inv.unknowns ?? []).map((question, i) =>
    seal({
      id: `U${i + 1}`,
      question,
      severity: "major",
      status: "open",
      evidence: [],
      contradicting: [],
      recommendedProbes: [],
      source: "engine",
      revision: 1,
      previousDigest: null,
    }),
  );
  return { version: 1, unknowns };
}

/** Load the ledger, seeding and persisting it from the inventory on first use. */
export function ensureUnknowns(outDir: string): UnknownsLedger {
  const existing = readUnknowns(outDir);
  if (existing) return existing;
  const seeded = seedUnknowns(readInventory(outDir));
  writeFileSync(join(outDir, UNKNOWNS_FILE), JSON.stringify(seeded, null, 2) + "\n");
  return seeded;
}

/** One agent-supplied change: a new record (no id) or an update to an existing id. */
export interface UnknownUpdate {
  id?: string;
  question?: string;
  feature?: string;
  severity?: string;
  status?: string;
  evidence?: string[];
  contradicting?: string[];
  recommendedProbes?: string[];
  note?: string;
}

/**
 * The citation rules a record must meet, shared by `--apply` and the gate so a
 * hand-edited ledger cannot settle a question the apply path would refuse.
 */
function citationProblems(rec: Pick<UnknownRecord, "status" | "evidence" | "contradicting">, inv: Inventory, external: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  if (rec.status === "resolved" && rec.evidence.length === 0) problems.push("`resolved` needs at least one `evidence` citation");
  for (const ref of [...rec.evidence, ...rec.contradicting]) {
    if (!resolveEvidence(ref, inv, external)) problems.push(`citation does not resolve against the inventory or the exported rea evidence: ${ref}`);
  }
  if (rec.status === "contradicted" && rec.contradicting.length === 0) problems.push("`contradicted` needs a `contradicting` citation");
  return problems;
}

function strList(v: unknown): string[] | undefined {
  return Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : undefined;
}

/**
 * Apply agent updates to the ledger, fail-closed: every row is validated first
 * and nothing is written if any row is wrong. A `resolved` record must cite at
 * least one piece of evidence and every citation must resolve against the
 * inventory (an `ev_…` id, a route, an entity, a file[:line]).
 */
export function applyUnknownUpdates(outDir: string, updates: unknown): UnknownsLedger {
  const rows: unknown[] = Array.isArray(updates)
    ? updates
    : Array.isArray((updates as { unknowns?: unknown })?.unknowns)
      ? (updates as { unknowns: unknown[] }).unknowns
      : [];
  if (rows.length === 0) throw new Error("no updates: expected an array of unknown records (or { unknowns: [...] })");
  const inv = readInventory(outDir);
  const external = loadExternalEvidence(outDir);
  const ledger = ensureUnknowns(outDir);
  const byId = new Map(ledger.unknowns.map((u) => [u.id, u]));
  let next = ledger.unknowns.reduce((n, u) => Math.max(n, Number(u.id.replace(/^U/, "")) || 0), 0);
  const problems: string[] = [];
  const changed: UnknownRecord[] = [];

  rows.forEach((raw, i) => {
    const row = (raw ?? {}) as UnknownUpdate;
    const label = `row ${i + 1}${row.id ? ` (${row.id})` : ""}`;
    const prev = row.id ? byId.get(row.id) : undefined;
    if (row.id && !prev) {
      problems.push(`${label}: unknown id — omit \`id\` to record a new unknown`);
      return;
    }
    const question = typeof row.question === "string" && row.question.trim() ? row.question.trim() : prev?.question;
    if (!question) {
      problems.push(`${label}: a new unknown needs a \`question\``);
      return;
    }
    const severity = (row.severity ?? prev?.severity ?? "major") as UnknownSeverity;
    if (!SEVERITIES.includes(severity)) problems.push(`${label}: severity must be one of ${SEVERITIES.join(", ")}`);
    const status = (row.status ?? prev?.status ?? "open") as UnknownStatus;
    if (!STATUSES.includes(status)) problems.push(`${label}: status must be one of ${STATUSES.join(", ")}`);
    const evidence = strList(row.evidence) ?? prev?.evidence ?? [];
    const contradicting = strList(row.contradicting) ?? prev?.contradicting ?? [];
    const recommendedProbes = strList(row.recommendedProbes) ?? prev?.recommendedProbes ?? [];
    for (const p of citationProblems({ status, evidence, contradicting }, inv, external)) problems.push(`${label}: ${p}`);
    const id = prev?.id ?? `U${++next}`;
    const feature = typeof row.feature === "string" ? row.feature : prev?.feature;
    const note = typeof row.note === "string" ? row.note : prev?.note;
    const rec = seal({
      id,
      question,
      ...(feature ? { feature } : {}),
      severity,
      status,
      evidence,
      contradicting,
      recommendedProbes,
      ...(note ? { note } : {}),
      source: prev?.source ?? "agent",
      revision: (prev?.revision ?? 0) + 1,
      previousDigest: prev?.digest ?? null,
    });
    byId.set(id, rec);
    changed.push(rec);
  });

  if (problems.length) {
    throw new Error(`${problems.length} invalid unknown update(s) — fix them and re-apply (fail-closed):\n  - ${problems.join("\n  - ")}`);
  }
  const unknowns = [...byId.values()].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  const out: UnknownsLedger = { version: 1, unknowns };
  writeFileSync(join(outDir, UNKNOWNS_FILE), JSON.stringify(out, null, 2) + "\n");
  return out;
}

/**
 * Fold the ledger into a check: open blockers fail, and so does a record that
 * breaks the apply-time rules (a malformed record, a `resolved` without a
 * citation, a citation that no longer resolves). A broken digest alone warns.
 * Absent ledger: nothing.
 */
export function foldUnknowns(outDir: string, check: CheckResult): void {
  let ledger: UnknownsLedger | undefined;
  try {
    ledger = readUnknowns(outDir);
  } catch (e) {
    check.errors.push((e as Error).message);
    return;
  }
  if (!ledger) return;
  let inv: Inventory | undefined;
  try {
    inv = readInventory(outDir);
  } catch {
    // checkOutput already fails a tree without a readable inventory.
  }
  const external = loadExternalEvidence(outDir);
  for (const u of ledger.unknowns) {
    const label = `${UNKNOWNS_FILE}: ${typeof u?.id === "string" ? u.id : "a record"}`;
    if (
      typeof u?.id !== "string" ||
      typeof u.question !== "string" ||
      !SEVERITIES.includes(u.severity) ||
      !STATUSES.includes(u.status) ||
      !strList(u.evidence) ||
      !strList(u.contradicting) ||
      !strList(u.recommendedProbes)
    ) {
      check.errors.push(
        `${label} is malformed (id, question, severity, status, evidence[], contradicting[], recommendedProbes[]) — record it with --unknowns --apply`,
      );
      continue;
    }
    const { digest, ...rest } = u;
    if (digest !== unknownDigest(rest)) {
      check.warnings.push(`${label} was edited by hand (digest mismatch) — record changes with --unknowns --apply so the revision chain holds`);
    }
    if (inv) {
      for (const p of citationProblems(u, inv, external)) check.errors.push(`${label}: ${p}`);
    }
    if (u.severity === "blocker" && UNSETTLED.has(u.status)) {
      check.errors.push(
        `${UNKNOWNS_FILE}: blocker ${u.id} is ${u.status} — "${u.question}"${u.recommendedProbes.length ? ` (probes: ${u.recommendedProbes.join("; ")})` : ""}`,
      );
    }
  }
}

/** Human-readable summary of the ledger. */
export function formatUnknowns(ledger: UnknownsLedger): string {
  const counts = new Map<string, number>();
  for (const u of ledger.unknowns) counts.set(u.status, (counts.get(u.status) ?? 0) + 1);
  const lines = [`reconstruct --unknowns: ${ledger.unknowns.length} record(s) · ${[...counts.entries()].map(([s, n]) => `${n} ${s}`).join(" · ") || "none"}`];
  for (const u of ledger.unknowns) {
    lines.push(`  ${u.id} [${u.severity} · ${u.status} · r${u.revision}]${u.feature ? ` (${u.feature})` : ""} ${u.question.slice(0, 160)}`);
  }
  return lines.join("\n");
}
