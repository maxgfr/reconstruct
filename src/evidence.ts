import { createHash } from "node:crypto";
import type { EvidenceAuthority, EvidenceRecord, FileInfo, RouteInfo } from "./types.js";

// Content-addressed evidence: every fact the engine resolved statically gets a
// record naming WHERE it came from (file, line, content hash) and HOW MUCH it
// can be trusted, on two separate axes:
//   - confidence — was it observed in the artifact, derived from observed facts
//     (a mount prefix composed with a route), or inferred;
//   - authority — what kind of artifact vouches for it: shipped source, a test,
//     config, a manifest, the greenfield plan, or an agent's own judgement.
// The id is a hash of the canonical record, so the same fact always gets the
// same id and an edited record is detectably a different one.

/** Canonical JSON: object keys sorted at every depth, no whitespace. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Hex(s: string | Buffer): string {
  return createHash("sha256").update(s).digest("hex");
}

/** `ev_` + 16 hex of the sha256 of the record's canonical JSON (id excluded). */
export function evidenceId(rec: Omit<EvidenceRecord, "id">): string {
  return `ev_${sha256Hex(canonicalJson(rec)).slice(0, 16)}`;
}

function withId(rec: Omit<EvidenceRecord, "id">): EvidenceRecord {
  return { id: evidenceId(rec), ...rec };
}

function authorityOf(file: FileInfo | undefined): EvidenceAuthority {
  if (!file) return "source";
  if (file.category === "test") return "test";
  if (file.category === "config") return "config";
  return "source";
}

/** The subject a route's evidence is filed under: `GET /users/:id`, or the bare path for a verb-agnostic route. */
export function routeSubject(r: RouteInfo): string {
  return r.method ? `${r.method} ${r.route}` : r.route;
}

/**
 * Evidence for everything the engine resolved on the code path: routes (with
 * their declaration line) and environment variables (first sighting). Sorted
 * by id so the inventory stays byte-stable.
 */
export function buildEvidence(files: FileInfo[], routes: RouteInfo[], envSources: Record<string, { file: string; line: number }>): EvidenceRecord[] {
  const byPath = new Map(files.map((f) => [f.path, f]));
  const out: EvidenceRecord[] = [];
  for (const r of routes) {
    const f = byPath.get(r.file);
    out.push(
      withId({
        kind: "route",
        subject: routeSubject(r),
        source: { file: r.file, ...(r.line ? { line: r.line } : {}), ...(f?.hash ? { hash: f.hash } : {}) },
        confidence: "observed",
        authority: authorityOf(f),
      }),
    );
  }
  for (const [name, at] of Object.entries(envSources)) {
    const f = byPath.get(at.file);
    out.push(
      withId({
        kind: "env",
        subject: name,
        source: { file: at.file, line: at.line, ...(f?.hash ? { hash: f.hash } : {}) },
        confidence: "observed",
        authority: f?.path.split("/").pop()?.startsWith(".env") ? "config" : authorityOf(f),
      }),
    );
  }
  const seen = new Set<string>();
  return out.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true))).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Evidence ids whose cited file changed since generation (hash mismatch) or vanished. */
export function staleEvidence(
  evidence: EvidenceRecord[],
  currentHash: (file: string) => string | null,
): { id: string; subject: string; file: string; reason: string }[] {
  const out: { id: string; subject: string; file: string; reason: string }[] = [];
  for (const e of evidence) {
    if (!e.source?.hash) continue;
    const now = currentHash(e.source.file);
    if (now === null) out.push({ id: e.id, subject: e.subject, file: e.source.file, reason: "file no longer exists" });
    else if (now !== e.source.hash) out.push({ id: e.id, subject: e.subject, file: e.source.file, reason: "file changed since the tree was generated" });
  }
  return out;
}
