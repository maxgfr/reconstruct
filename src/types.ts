// Core data model shared across the analyzer pipeline.

export type Mode = "preserve" | "redesign" | "scratch";
export type Level = "light" | "complex";
export type Fidelity = "mirror" | "embed" | "describe";
export type Granularity = "coarse" | "fine";

export interface Options {
  /** Absolute path to the repository to analyze. */
  repo: string;
  /** Absolute path to the output directory (the `reconstruction/` tree). */
  out: string;
  mode: Mode;
  level: Level;
  fidelity: Fidelity;
  /** How aggressively trivial single-file groups fold into Core. */
  granularity: Granularity;
  /** Keep only files matching these gitignore-style globs (empty = all). */
  include: string[];
  /** Drop files matching these gitignore-style globs. */
  exclude: string[];
  /** When true, print the inventory JSON to stdout and write nothing. */
  json: boolean;
  /** Max bytes of a single file embedded into a PRD (embed fidelity). */
  maxEmbedBytes: number;
  /** Emit a single bundled markdown (`RECONSTRUCTION.md`) of the whole tree. */
  merge: boolean;
  /** Emit a one-page digest (`SUMMARY.md`) derived from the inventory. */
  summary: boolean;
  /** Emit a features-only bundle (`FEATURES.md`) — every feature PRD, nothing else. */
  features: boolean;
  /** Emit a specs bundle (`SPECS.md`) — feature PRDs with embedded source code stripped. */
  specs: boolean;
  /**
   * Post-step mode: rebuild the merge/summary/features/specs bundle(s) from an
   * already-generated output directory (`out`) without re-analysing a repo. Set
   * when `--merge`/`--summary`/`--features`/`--specs` is used without `--repo`.
   */
  standalone: boolean;
  /**
   * From-scratch (greenfield) mode: build the reconstruction tree from a
   * `plan.json` interview instead of analysing a repo. Set by `--scratch`.
   */
  scratch: boolean;
  /** Path to the `plan.json` that drives `--scratch` mode (else ""). */
  plan: string;
  /**
   * Test-driven build mode: emit test-first guidance into the PRDs/REBUILD so
   * the rebuild proceeds red→green→refactor. Set by `--tdd`. Orthogonal to mode.
   */
  tdd: boolean;
  /**
   * Validation mode: statically check an existing output tree (`out`) for
   * buildability — no unresolved callouts, references resolve, locales covered.
   * Set by `--check`; reads no repo.
   */
  check: boolean;
}

/** The generation parameters recorded in `inventory.json` for provenance. */
export interface GenerationInfo {
  mode: Mode;
  level: Level;
  fidelity: Fidelity;
  granularity: Granularity;
}

export type FileCategory =
  | "code"
  | "test"
  | "config"
  | "doc"
  | "i18n"
  | "schema"
  | "style"
  | "asset"
  | "data"
  | "other";

export interface FileInfo {
  /** Repo-relative POSIX path. */
  path: string;
  ext: string;
  size: number;
  lines: number;
  category: FileCategory;
  binary: boolean;
}

export interface RouteInfo {
  route: string;
  file: string;
  kind: "page" | "api" | "layout" | "component";
  /**
   * HTTP method/verb when the framework declares one (`GET`, `POST`, …; `*` for
   * any/all). Carries the read-vs-write dimension so two operations on the same
   * path (e.g. `GET /items` + `POST /items`) survive as distinct routes. Omitted
   * when the framework's routing is verb-agnostic (file-based pages, Django
   * view-dispatched URLs).
   */
  method?: string;
}

export interface I18nInfo {
  locales: string[];
  files: string[];
  keyCount: number;
  /**
   * The message catalog that makes localized copy buildable: the namespaces, a
   * source locale, and the keys with their source-locale strings. In code mode
   * the raw files are copied to `data/translations/`; in scratch mode this is
   * the agent/plan-authored catalog the rebuild localizes from.
   */
  messages?: MessageCatalog;
}

export interface MessageEntry {
  key: string;
  /** The source-locale string for this key (what every locale translates). */
  source?: string;
}

/**
 * The i18n message catalog. Buildability requires every user-facing key to have
 * a source string and to resolve in every locale — naming namespaces is not
 * enough.
 */
export interface MessageCatalog {
  /** Locale the `source` strings are written in (e.g. "fr" or "en"). */
  sourceLocale?: string;
  /** Top-level message namespaces (e.g. "auth", "directory", "calendar"). */
  namespaces?: string[];
  /** Representative/required keys with their source strings. */
  entries?: MessageEntry[];
}

/** A named domain enum — its full member list must be enumerated to be buildable. */
export interface EnumDef {
  name: string;
  members: string[];
  description?: string;
}

/**
 * An external service the project integrates with (geocoding, email, payments…).
 * Buildability requires the contract — provider, request/response shape, timeout,
 * and failure behavior — not just the service's name.
 */
export interface ServiceContract {
  name: string;
  purpose: string;
  provider?: string;
  /** Named operations/functions the app calls, with their exact I/O shapes. */
  operations?: { name: string; input?: string; output?: string }[];
  request?: string;
  response?: string;
  timeout?: string;
  /** What the app does when the service is slow / down / errors. */
  onFailure?: string;
}

/**
 * A cross-cutting rule that is otherwise easy to leave vague: rate limits,
 * format validations (e.g. a national registry number), security policies.
 * The `rule` must be concrete enough to write a test against.
 */
export interface Policy {
  name: string;
  /** rate-limit | validation | security | other */
  kind?: string;
  /** The concrete, testable rule (thresholds, regex, window, store…). */
  rule: string;
  /** Interface paths or field names this policy governs. */
  appliesTo?: string[];
}

export interface DependencyInfo {
  manager: string;
  manifest: string;
  runtime: Record<string, string>;
  dev: Record<string, string>;
}

export interface StackInfo {
  languages: string[];
  primaryLanguage: string;
  frameworks: string[];
  /** Notable libraries detected from dependencies: ORM, auth, API layer, styling, testing, etc. */
  libraries: string[];
  packageManagers: string[];
  hasTypeScript: boolean;
}

export interface Feature {
  /** Numbered slug assigned during grouping, e.g. "01-auth". */
  slug: string;
  name: string;
  description: string;
  kind: "feature" | "internationalization" | "project-setup" | "documentation";
  files: string[];
  routes: RouteInfo[];
  /** Operations this unit exposes (scratch mode cross-ref into INTERFACES.md). */
  interfaces?: string[];
  /** Entities this unit reads/writes (scratch mode cross-ref into DATA-MODEL.md). */
  entities?: string[];
  /** Entities this unit WRITES (subset of entities); drives consistency checks. */
  writes?: string[];
}

/**
 * Framework-agnostic *candidates* the deterministic engine surfaces for the AI
 * agent to verify and turn into ground truth. These are starting points — never
 * authoritative — for mapping the interface surface and the data model.
 */
export interface Hints {
  /** Files that likely declare HTTP routes / pages / endpoints. */
  routeCandidates: string[];
  /** Files that likely declare an API surface: RPC routers, GraphQL SDL, OpenAPI, .proto. */
  apiCandidates: string[];
  /** Files that likely define the data model: ORM models/entities/schema/migrations. */
  schemaCandidates: string[];
  /** Best-effort program entry points (any ecosystem). */
  entryPoints: string[];
}

/** A workspace inside a monorepo. */
export interface Workspace {
  name: string;
  path: string;
}

/**
 * One row of the interface surface. In code mode the agent fills these from the
 * `hints`; in scratch mode they come pre-filled from the interview (`plan.json`).
 */
export interface InterfaceRow {
  method: string;
  path: string;
  /** REST / tRPC / GraphQL / gRPC / CLI / job / webhook … */
  kind?: string;
  auth?: string;
  notes?: string;
  /** Exact input/request shape (fields + types + validation). */
  input?: string;
  /** Exact output/response shape. */
  output?: string;
  /** Observable side effects: writes, emails, jobs, external calls. */
  sideEffects?: string[];
}

export interface EntityField {
  name: string;
  type: string;
  constraints?: string;
  /** Name of an {@link EnumDef} this field's values are drawn from. */
  enumRef?: string;
}

/** One entity/table of the data model. */
export interface Entity {
  entity: string;
  fields: EntityField[];
  /** Free-text relation descriptions (e.g. "belongs to User"). */
  relations?: string[];
  /** Index definitions (e.g. "btree on (doctorProfileId, date)"). */
  indexes?: string[];
  /** Unique-constraint definitions (e.g. "unique on (provider, providerAccountId)"). */
  uniques?: string[];
}

export interface Inventory {
  generatedWith: string;
  /** Generation parameters this inventory was produced with (provenance). */
  generation?: GenerationInfo;
  repoName: string;
  stack: StackInfo;
  fileCount: number;
  totalLines: number;
  files: FileInfo[];
  dependencies: DependencyInfo[];
  routes: RouteInfo[];
  i18n: I18nInfo | null;
  schemas: string[];
  configs: string[];
  docs: string[];
  envVars: string[];
  scripts: Record<string, string>;
  features: Feature[];
  /** Candidate files for the agent to verify (routes/API/schema/entry points). */
  hints: Hints;
  /** Things the engine could not determine and the agent must investigate. */
  unknowns: string[];
  /** Detected monorepo workspaces, if any. */
  workspaces?: Workspace[];
  /** Detected runtime constraints (e.g. required Node version). */
  runtime?: { node?: string };
  /** Count of files skipped by ignore rules — surfaced for transparency. */
  excludedCount: number;
  /**
   * Scratch mode only: the product summary from the interview, used to fill the
   * overview instead of leaving an "infer from the README" placeholder.
   */
  product?: { summary: string; audience?: string; value?: string };
  /**
   * Pre-filled interface surface (scratch mode). When present, `INTERFACES.md`
   * renders a filled table instead of an empty skeleton.
   */
  interfaces?: InterfaceRow[];
  /**
   * Pre-filled data model (scratch mode). When present, `DATA-MODEL.md` renders
   * filled entity tables instead of an empty skeleton.
   */
  dataModel?: Entity[];
  /** Named domain enums (scratch pre-fill) → `DATA-MODEL.md` Enums section. */
  enums?: EnumDef[];
  /** External-service contracts (scratch pre-fill) → `ARCHITECTURE.md`. */
  services?: ServiceContract[];
  /** Cross-cutting policies: rate limits, validations (scratch pre-fill). */
  policies?: Policy[];
}

// --- Scratch (greenfield) plan -----------------------------------------------
// The structured output of the from-scratch interview. Maps 1:1 onto the
// inventory; `planToInventory` is the bridge. Documented in
// `references/scratch-plan-schema.md`.

export interface ScratchProject {
  name: string;
  summary: string;
  audience?: string;
  value?: string;
}

export interface ScratchStack {
  primaryLanguage: string;
  languages?: string[];
  frameworks?: string[];
  libraries?: string[];
  packageManagers?: string[];
  hasTypeScript?: boolean;
}

export interface ScratchDependency {
  manager: string;
  manifest: string;
  runtime?: Record<string, string>;
  dev?: Record<string, string>;
}

export interface ScratchFeature {
  name: string;
  kind?: Feature["kind"];
  /** Build tier hint: 0 foundation, 1 feature, 2 tail (tests/docs). */
  tier?: 0 | 1 | 2;
  summary?: string;
  /** Names/paths of interfaces this feature exposes (cross-reference). */
  interfaces?: string[];
  /** Entity names this feature reads/writes (cross-reference). */
  entities?: string[];
  /**
   * Entity names this feature WRITES (subset of `entities`). When set, the
   * consistency checker uses it to verify anonymous/public writes are
   * satisfiable; falls back to `entities` when omitted.
   */
  writes?: string[];
}

export interface GlossaryTerm {
  term: string;
  definition: string;
  avoid?: string[];
}

export interface Decision {
  title: string;
  context?: string;
  decision: string;
  why?: string;
}

export interface ScratchPlan {
  project: ScratchProject;
  stack: ScratchStack;
  dependencies?: ScratchDependency[];
  envVars?: string[];
  i18n?: { locales: string[]; messages?: MessageCatalog } | null;
  dataModel?: Entity[];
  interfaces?: InterfaceRow[];
  /** Named domain enums (member lists) referenced by entity fields. */
  enums?: EnumDef[];
  /** External-service contracts (geocoding, email, payments…). */
  services?: ServiceContract[];
  /** Cross-cutting policies: rate limits, format validations, security. */
  policies?: Policy[];
  features: ScratchFeature[];
  /** → CONTEXT.md glossary. */
  glossary?: GlossaryTerm[];
  /** → docs/adr/NNNN-*.md decisions. */
  decisions?: Decision[];
  /** Request test-driven build guidance in the output (same as `--tdd`). */
  tdd?: boolean;
}

/** A file to be written into the reconstruction output tree. */
export interface Artifact {
  relPath: string;
  content: string;
}

/** A verbatim file copy (mirror fidelity). */
export interface CopyOp {
  from: string;
  to: string;
}

export interface RenderResult {
  artifacts: Artifact[];
  copies: CopyOp[];
}

export const VERSION = "0.8.1";
