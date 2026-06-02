import { readFileSync } from "node:fs";
import { orderFeatures, slugify } from "./features.js";
import { VERSION } from "./types.js";
import type {
  Artifact,
  DependencyInfo,
  Entity,
  EntityField,
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
    fields: (e.fields ?? []).map((f) => ({
      name: f.name,
      type: f.type,
      ...(f.constraints ? { constraints: f.constraints } : {}),
      ...(f.enumRef ? { enumRef: f.enumRef } : {}),
    })),
    ...(e.relations && e.relations.length ? { relations: e.relations } : {}),
    ...(e.indexes && e.indexes.length ? { indexes: e.indexes } : {}),
    ...(e.uniques && e.uniques.length ? { uniques: e.uniques } : {}),
  }));
}

function planInterfaces(plan: ScratchPlan): InterfaceRow[] {
  return (plan.interfaces ?? []).map((r) => ({
    method: r.method,
    path: r.path,
    ...(r.kind ? { kind: r.kind } : {}),
    ...(r.auth ? { auth: r.auth } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
    ...(r.input ? { input: r.input } : {}),
    ...(r.output ? { output: r.output } : {}),
    ...(r.sideEffects && r.sideEffects.length ? { sideEffects: r.sideEffects } : {}),
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
        ...(f.writes && f.writes.length ? { writes: f.writes } : {}),
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
    ? {
        locales: plan.i18n.locales,
        files: [],
        keyCount: plan.i18n.messages?.entries?.length ?? 0,
        ...(plan.i18n.messages ? { messages: plan.i18n.messages } : {}),
      }
    : null;
  const interfaces: InterfaceRow[] = planInterfaces(plan);

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
    ...(plan.enums && plan.enums.length ? { enums: plan.enums } : {}),
    ...(plan.services && plan.services.length ? { services: plan.services } : {}),
    ...(plan.policies && plan.policies.length ? { policies: plan.policies } : {}),
  };
}

// --- Plan consistency validation ---------------------------------------------
// Buildability begins with an internally consistent plan: a feature cannot
// reference an entity or operation that does not exist, an enum cannot be empty,
// and an anonymous (public) write cannot target a table that requires an owner
// foreign key. These checks run before rendering so the scratch path is
// buildable *by construction* — they catch the class of contradiction that made
// the original Public Directory PRD impossible to build.

const IDENTITY_ENTITY = /^users?$/i;
// An FK column the *caller* must own/author — the value can only be the caller's
// own identity (created-by/sender/author/owner), which an anonymous request has
// no way to supply. A recipient/target/subject FK is a *pre-existing* party
// passed as input, so an anonymous caller CAN satisfy it — not the bug.
const OWNER_FK_COLUMN = /(^user_?id$|owner|author|sender|creator|created_?by)/i;

function fkTarget(f: EntityField): string | null {
  const m = (f.constraints ?? "").match(/->\s*([a-z0-9_]+)/i);
  return m ? (m[1] as string) : null;
}

/** A required FK to the identity table that names the caller as the row's owner. */
function isOwnerCallerFk(f: EntityField): boolean {
  const target = fkTarget(f);
  if (!target || !IDENTITY_ENTITY.test(target)) return false;
  if (isNullable(f) || hasDefault(f)) return false;
  return OWNER_FK_COLUMN.test(f.name);
}

function isNullable(f: EntityField): boolean {
  const c = (f.constraints ?? "").toLowerCase();
  if (/\bnullable\b/.test(c)) return true;
  if (/\bnot null\b/.test(c)) return false;
  return false; // FK/identity columns are required unless explicitly nullable.
}

function hasDefault(f: EntityField): boolean {
  return /\bdefault\b/i.test(f.constraints ?? "");
}

function isEnumTyped(f: EntityField): boolean {
  return /\benum\b/i.test(f.type);
}

function enumMembersInline(f: EntityField): boolean {
  return /\|/.test(f.constraints ?? "");
}

function isWriteOp(r: InterfaceRow): boolean {
  if (/mutation/i.test(r.kind ?? "")) return true;
  return ["POST", "PUT", "PATCH", "DELETE"].includes((r.method ?? "").toUpperCase());
}

function isAnonymousAuth(auth: string | undefined): boolean {
  return /\b(public|anon(?:ymous)?|none)\b/i.test(auth ?? "");
}

/**
 * Validate a plan's internal consistency. Returns hard `errors` (dangling
 * references, empty/undefined enums) that block rendering, and `warnings`
 * (under-specified enums, anonymous writes to owner-FK tables) the author
 * should resolve. Pure — callers decide how to surface the results.
 */
export function validatePlanConsistency(plan: ScratchPlan): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const entities = new Map((plan.dataModel ?? []).map((e) => [e.entity, e]));
  const interfacePaths = new Set((plan.interfaces ?? []).map((i) => i.path));
  const enumNames = new Set((plan.enums ?? []).map((e) => e.name));

  // Referential integrity: features → entities / interfaces / writes.
  for (const f of plan.features) {
    for (const e of f.entities ?? []) {
      if (!entities.has(e)) {
        errors.push(`feature "${f.name}" references entity \`${e}\` not defined in dataModel`);
      }
    }
    for (const i of f.interfaces ?? []) {
      if (!interfacePaths.has(i)) {
        errors.push(`feature "${f.name}" references interface/operation \`${i}\` not defined in interfaces`);
      }
    }
    for (const w of f.writes ?? []) {
      if (!entities.has(w)) {
        errors.push(`feature "${f.name}" writes entity \`${w}\` not defined in dataModel`);
      }
    }
  }

  // Enums: declared enums need members; field enumRefs must resolve.
  for (const e of plan.enums ?? []) {
    if (!e.members || e.members.length === 0) {
      errors.push(`enum \`${e.name}\` has no members`);
    }
  }
  for (const ent of plan.dataModel ?? []) {
    for (const f of ent.fields ?? []) {
      if (f.enumRef && !enumNames.has(f.enumRef)) {
        errors.push(`field \`${ent.entity}.${f.name}\` references undefined enum \`${f.enumRef}\``);
      }
      if (isEnumTyped(f) && !f.enumRef && !enumMembersInline(f)) {
        warnings.push(
          `enum field \`${ent.entity}.${f.name}\` has no enumerated members — list them inline (\`A | B\`) or via enumRef so values are testable`,
        );
      }
    }
  }

  // Anonymous writes: a public mutation whose feature WRITES an entity that
  // requires a non-null owner FK cannot be satisfied by an account-less caller.
  const featureByInterface = new Map<string, ScratchFeature[]>();
  for (const f of plan.features) {
    for (const i of f.interfaces ?? []) {
      const list = featureByInterface.get(i) ?? [];
      list.push(f);
      featureByInterface.set(i, list);
    }
  }
  for (const r of plan.interfaces ?? []) {
    if (!isWriteOp(r) || !isAnonymousAuth(r.auth)) continue;
    for (const f of featureByInterface.get(r.path) ?? []) {
      for (const w of f.writes ?? []) {
        const ent = entities.get(w);
        if (!ent) continue;
        for (const field of ent.fields ?? []) {
          if (isOwnerCallerFk(field)) {
            warnings.push(
              `anonymous/public operation \`${r.path}\` writes \`${w}\`, which requires the caller's own non-null owner FK \`${w}.${field.name} -> ${fkTarget(field)}\` — an anonymous caller cannot supply it; use an anonymous-capable entity (e.g. a contactRequests table)`,
            );
          }
        }
      }
    }
  }

  return { errors, warnings };
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
