import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { agentContracts, phaseWorkflowScript, runbookMd } from "./orchestrate-templates.js";
import { recomputeReviewGate } from "./review.js";
import type { Inventory, ReviewResult, ReviewWorklist } from "./types.js";

// ---------------------------------------------------------------------------
// `reconstruct --orchestrate` — emit the reconstruction's multi-agent
// orchestration from the OUT dir's CURRENT worklists (per-phase workflow
// scripts + dispatch contracts + a sequential RUNBOOK), so a subagent-capable
// harness fans the judgment work out while the main agent stays the single
// serial reducer (references/orchestration.md). Per-phase emission is
// deliberate: each worklist only exists after its engine step (the analyzer,
// `--review`, `--review --apply`, `--verify`), so a whole-pipeline script could
// only carry placeholders — exactly what the check/verify gates exist to
// prevent.
// ---------------------------------------------------------------------------

export const PHASES = ["enrich-map", "review-find", "review-verify", "adjudicate"] as const;
export type PhaseName = (typeof PHASES)[number];

/** Small worklists don't amortize a fan-out — orchestrate says so and nudges --eco. */
export const SMALL_WORKLIST = 3;
/** One subagent per batch of at most this many worklist items. */
export const BATCH_SIZE = 8;

export interface PhaseInfo {
  name: PhaseName;
  ready: boolean;
  /** Absolute path of the worklist this phase fans out over. */
  worklist: string;
  items: number;
  /** The injected fan-out ids (feature slug, blocker id, or claimId). */
  ids: string[];
  /**
   * The ids partitioned into batch groups. Batches are chunked WITHIN a group,
   * never across: enrich-map groups by monorepo workspace (a drafter stream
   * loads one workspace's stack guide); every other phase has a single group.
   */
  groups: string[][];
  /** The engine command that produces the worklist when it is missing. */
  prerequisite: string;
}

function readJson<T>(path: string): T | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return undefined; // missing or unreadable worklist = not ready
  }
}

/**
 * Group feature slugs by monorepo workspace (longest-prefix match on each
 * feature's files, majority vote; ties and unmatched features fall to the
 * repo-root group). Single-repo inventories return one group. Group order is
 * first appearance following the inventory's feature order — deterministic.
 */
export function workspaceGroups(inv: Inventory): string[][] {
  const features = inv.features ?? [];
  const workspaces = (inv.workspaces ?? []).slice().sort((a, b) => b.path.length - a.path.length);
  if (!workspaces.length) return features.length ? [features.map((f) => f.slug)] : [];

  const groupOf = (files: string[]): string => {
    const counts = new Map<string, number>();
    for (const file of files) {
      const ws = workspaces.find((w) => file === w.path || file.startsWith(`${w.path}/`));
      const key = ws ? ws.name : "";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let best = "";
    let bestCount = 0;
    for (const [key, count] of counts) {
      if (count > bestCount) {
        best = key;
        bestCount = count;
      }
    }
    return best;
  };

  const groups = new Map<string, string[]>();
  for (const f of features) {
    const key = groupOf(f.files ?? []);
    const bucket = groups.get(key);
    if (bucket) bucket.push(f.slug);
    else groups.set(key, [f.slug]);
  }
  return [...groups.values()];
}

export function listPhases(outDir: string, engineAbs: string): PhaseInfo[] {
  const out = resolve(outDir);

  // enrich-map — one drafter per inventory feature (grouped by workspace).
  const invPath = join(out, "inventory.json");
  const inv = readJson<Inventory>(invPath);
  const invReady = !!inv && Array.isArray(inv.features);
  const enrichGroups = invReady ? workspaceGroups(inv) : [];
  const enrichIds = enrichGroups.flat();

  // review-find — one finder per unit the review ledger flags (needsReview).
  const todoPath = join(out, "REVIEW.todo.json");
  const todo = readJson<ReviewWorklist>(todoPath);
  const findReady = !!todo && Array.isArray(todo.units);
  const findIds = findReady ? todo.units.filter((u) => u.needsReview).map((u) => u.feature) : [];

  // review-verify — one independent verifier per open blocker in the applied
  // ledger. Trustless on `ok`/`residual`: recomputed from failures ∪ gating
  // findings, the same reduction `--check --semantic` uses.
  const revPath = join(out, "REVIEW.json");
  const rev = readJson<ReviewResult>(revPath);
  const verifyReady = !!rev && (Array.isArray(rev.failures) || Array.isArray(rev.findings));
  const blockerIds = verifyReady ? recomputeReviewGate(rev) : [];

  // adjudicate — one adjudicator per requirement↔evidence pair.
  const verPath = join(out, "VERIFY.todo.json");
  const ver = readJson<{ pairs?: { claimId: string }[] }>(verPath);
  const adjReady = !!ver && Array.isArray(ver.pairs);
  const adjIds = adjReady ? ver.pairs!.map((p) => p.claimId) : [];

  return [
    {
      name: "enrich-map",
      ready: invReady,
      worklist: invPath,
      items: enrichIds.length,
      ids: enrichIds,
      groups: enrichGroups,
      prerequisite: `node ${engineAbs} --repo <repo> --out ${out}`,
    },
    {
      name: "review-find",
      ready: findReady,
      worklist: todoPath,
      items: findIds.length,
      ids: findIds,
      groups: findIds.length ? [findIds] : [],
      prerequisite: `node ${engineAbs} --review --out ${out}`,
    },
    {
      name: "review-verify",
      ready: verifyReady,
      worklist: revPath,
      items: blockerIds.length,
      ids: blockerIds,
      groups: blockerIds.length ? [blockerIds] : [],
      prerequisite: `node ${engineAbs} --review --apply <findings.json> --out ${out}`,
    },
    {
      name: "adjudicate",
      ready: adjReady,
      worklist: verPath,
      items: adjIds.length,
      ids: adjIds,
      groups: adjIds.length ? [adjIds] : [],
      prerequisite: `node ${engineAbs} --verify --out ${out}`,
    },
  ];
}

export interface OrchestrateOptions {
  /** Emit only this phase (exit 2 if its worklist does not exist yet). */
  phase?: string;
  /** Emit only the RUNBOOK + contracts (the explicit low-token sequential path). */
  eco?: boolean;
}

export interface OrchestrateResult {
  exitCode: number;
  written: string[];
  notices: string[];
  errors: string[];
  phases: PhaseInfo[];
}

export function orchestrateRun(outDir: string, engineAbs: string, opts: OrchestrateOptions = {}): OrchestrateResult {
  const out = resolve(outDir);
  if (!existsSync(out)) {
    return { exitCode: 2, written: [], notices: [], errors: [`out dir not found: ${out}`], phases: [] };
  }
  const phases = listPhases(out, engineAbs);

  let selected = phases.filter((p) => p.ready);
  if (opts.phase !== undefined) {
    const ph = phases.find((p) => p.name === opts.phase);
    if (!ph) {
      return {
        exitCode: 2,
        written: [],
        notices: [],
        errors: [`unknown phase "${opts.phase}" — expected one of: ${PHASES.join(", ")}.`],
        phases,
      };
    }
    if (!ph.ready) {
      return {
        exitCode: 2,
        written: [],
        notices: [],
        errors: [`phase "${ph.name}" is not ready — its worklist ${ph.worklist} does not exist yet. Produce it first: ${ph.prerequisite}`],
        phases,
      };
    }
    selected = [ph];
  }

  const orchDir = join(out, "orchestration");
  const agentsDir = join(orchDir, "agents");
  mkdirSync(join(orchDir, "out"), { recursive: true });
  mkdirSync(agentsDir, { recursive: true });

  const written: string[] = [];
  const notices: string[] = [];

  // Contracts: every role, every call (idempotent overwrite) — they double as the
  // RUNBOOK's self-pass checklists, so eco mode needs them too.
  for (const [name, content] of Object.entries(agentContracts(out, engineAbs))) {
    const p = join(agentsDir, `${name}.md`);
    writeFileSync(p, content);
    written.push(p);
  }

  if (!opts.eco) {
    for (const ph of selected) {
      if (ph.items === 0) {
        notices.push(`phase "${ph.name}": worklist is empty — nothing to orchestrate.`);
        continue;
      }
      if (ph.items <= SMALL_WORKLIST) {
        notices.push(`phase "${ph.name}": only ${ph.items} item(s) — the sequential --eco path is equivalent and cheaper.`);
      }
      const p = join(orchDir, `${ph.name}.workflow.mjs`);
      writeFileSync(p, phaseWorkflowScript(ph, out, engineAbs, BATCH_SIZE));
      written.push(p);
    }
  }

  const rb = join(orchDir, "RUNBOOK.md");
  writeFileSync(rb, runbookMd(phases, out, engineAbs));
  written.push(rb);

  return { exitCode: 0, written, notices, errors: [], phases };
}
