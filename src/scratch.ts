import { readFileSync } from "node:fs";
import { orderFeatures, slugify } from "./features.js";
import { VERSION } from "./types.js";
import type {
  Artifact,
  DependencyInfo,
  Entity,
  Feature,
  I18nInfo,
  InterfaceRow,
  Inventory,
  Options,
  ScratchFeature,
  ScratchPlan,
  StackInfo,
} from "./types.js";
import type { OrderingRecord } from "./features.js";

/**
 * Read and validate a `plan.json`. Fails with clear, actionable messages so the
 * agent (or a user hand-writing a plan) can fix the file rather than guess.
 */
export function loadPlan(path: string): ScratchPlan {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(`cannot read plan.json at ${path} — does the file exist?`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`invalid plan.json at ${path}: ${(e as Error).message}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`invalid plan.json at ${path}: expected a JSON object`);
  }
  const plan = parsed as Partial<ScratchPlan>;
  if (!plan.project || typeof plan.project.name !== "string" || !plan.project.name.trim()) {
    throw new Error(`plan.json is missing a "project.name" (the project's name)`);
  }
  if (typeof plan.project.summary !== "string") {
    throw new Error(`plan.json is missing a "project.summary" (one-line description)`);
  }
  if (!plan.stack || typeof plan.stack.primaryLanguage !== "string") {
    throw new Error(`plan.json is missing a "stack.primaryLanguage"`);
  }
  if (!Array.isArray(plan.features) || plan.features.length === 0) {
    throw new Error(`plan.json must list at least one "features" entry`);
  }
  return plan as ScratchPlan;
}

/** Build tier from a feature kind when the plan doesn't pin one explicitly. */
function deriveTier(kind: Feature["kind"]): 0 | 1 | 2 {
  if (kind === "project-setup" || kind === "internationalization") return 0;
  if (kind === "documentation") return 2;
  return 1;
}

function planStack(plan: ScratchPlan): StackInfo {
  const s = plan.stack;
  return {
    primaryLanguage: s.primaryLanguage,
    languages: s.languages ?? [s.primaryLanguage],
    frameworks: s.frameworks ?? [],
    libraries: s.libraries ?? [],
    packageManagers: s.packageManagers ?? [],
    hasTypeScript: s.hasTypeScript ?? /typescript|\bts\b/i.test(s.primaryLanguage),
  };
}

function planDependencies(plan: ScratchPlan): DependencyInfo[] {
  return (plan.dependencies ?? []).map((d) => ({
    manager: d.manager,
    manifest: d.manifest,
    runtime: d.runtime ?? {},
    dev: d.dev ?? {},
  }));
}

function planDataModel(plan: ScratchPlan): Entity[] {
  return (plan.dataModel ?? []).map((e) => ({
    entity: e.entity,
    fields: e.fields ?? [],
    ...(e.relations && e.relations.length ? { relations: e.relations } : {}),
  }));
}

function planFeatures(features: ScratchFeature[]): Feature[] {
  const records: OrderingRecord[] = features.map((f, i) => {
    const kind: Feature["kind"] = f.kind ?? "feature";
    const tier = f.tier ?? deriveTier(kind);
    return {
      feature: {
        slug: slugify(f.name),
        name: f.name,
        description: f.summary ?? `${f.name}.`,
        kind,
        files: [],
        routes: [],
        ...(f.interfaces && f.interfaces.length ? { interfaces: f.interfaces } : {}),
        ...(f.entities && f.entities.length ? { entities: f.entities } : {}),
      },
      tier,
      // Preserve the plan's declared order within a tier — the author controls it.
      rank: i,
      size: 0,
    };
  });
  return orderFeatures(records);
}

/**
 * Bridge a validated `ScratchPlan` into the same `Inventory` the code analyzer
 * produces — empty `files/routes/hints/...` (nothing to read), populated
 * `stack/dependencies/envVars/i18n`, tiered `features`, pre-filled
 * `interfaces`/`dataModel`, and `generation.mode = "scratch"` /
 * `fidelity = "describe"`. From here the shared renderer takes over.
 */
export function planToInventory(plan: ScratchPlan, opts: Options): Inventory {
  const i18n: I18nInfo | null = plan.i18n
    ? { locales: plan.i18n.locales, files: [], keyCount: 0 }
    : null;
  const interfaces: InterfaceRow[] = plan.interfaces ?? [];

  return {
    generatedWith: `reconstruct@${VERSION}`,
    generation: {
      mode: "scratch",
      level: opts.level,
      fidelity: "describe",
      granularity: opts.granularity,
    },
    repoName: plan.project.name,
    stack: planStack(plan),
    fileCount: 0,
    totalLines: 0,
    files: [],
    dependencies: planDependencies(plan),
    routes: [],
    i18n,
    schemas: [],
    configs: [],
    docs: [],
    envVars: plan.envVars ?? [],
    scripts: {},
    features: planFeatures(plan.features),
    hints: { routeCandidates: [], apiCandidates: [], schemaCandidates: [], entryPoints: [] },
    unknowns: [],
    excludedCount: 0,
    product: {
      summary: plan.project.summary,
      ...(plan.project.audience ? { audience: plan.project.audience } : {}),
      ...(plan.project.value ? { value: plan.project.value } : {}),
    },
    interfaces,
    dataModel: planDataModel(plan),
  };
}

/**
 * Render the grill-with-docs artifacts the interview produces: a `CONTEXT.md`
 * glossary (from `plan.glossary` + data-model relations) and one terse ADR per
 * `plan.decisions` entry under `docs/adr/`. These are written *if-absent* so a
 * richer, agent-authored version is never clobbered — but a bare engine run is
 * still self-contained. See `references/CONTEXT-FORMAT.md` / `ADR-FORMAT.md`.
 */
export function renderScratchDocs(plan: ScratchPlan): Artifact[] {
  return [{ relPath: "CONTEXT.md", content: contextDoc(plan) }, ...adrDocs(plan)];
}

function contextDoc(plan: ScratchPlan): string {
  const lines: string[] = [
    `# ${plan.project.name} — Context`,
    "",
    plan.project.summary,
    "",
    "## Language",
    "",
  ];
  if (plan.glossary && plan.glossary.length) {
    for (const g of plan.glossary) {
      lines.push(`**${g.term}**:`, g.definition);
      if (g.avoid && g.avoid.length) lines.push(`_Avoid_: ${g.avoid.join(", ")}`);
      lines.push("");
    }
  } else {
    lines.push("_Capture the project's domain terms here as they are defined._", "");
  }
  const relations = (plan.dataModel ?? []).flatMap((e) => e.relations ?? []);
  if (relations.length) {
    lines.push("## Relationships", "");
    for (const r of relations) lines.push(`- ${r}`);
    lines.push("");
  }
  return lines.join("\n");
}

function adrDocs(plan: ScratchPlan): Artifact[] {
  return (plan.decisions ?? []).map((d, i) => {
    const num = String(i + 1).padStart(4, "0");
    const body = [d.context, d.decision, d.why].filter(Boolean).join(" ");
    return { relPath: `docs/adr/${num}-${slugify(d.title)}.md`, content: `# ${d.title}\n\n${body}\n` };
  });
}
