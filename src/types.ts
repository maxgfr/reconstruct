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
  /** Requirement-support verification: write the worklist (`--verify`). */
  verify?: boolean;
  /**
   * AI buildability review ledger: write the per-feature review worklist
   * (`--review`), or reduce agent-filled findings (`--review --apply <p>`).
   */
  review?: boolean;
  /** Path to an agent-filled verdicts/findings file to apply (`--verify`/`--review --apply <p>`). */
  apply?: string;
  /**
   * Fold the semantic gates into `--check`: VERIFY.json (refuted/unsupported
   * requirements) and REVIEW.json (unresolved buildability blockers). `--semantic`.
   */
  semantic?: boolean;
  /**
   * With `--check --semantic`: downgrade a missing/unreadable VERIFY.json or
   * REVIEW.json ledger to a warning instead of failing closed. `--allow-unverified`.
   */
  allowUnverified?: boolean;
}

/** The generation parameters recorded in `inventory.json` for provenance. */
export interface GenerationInfo {
  mode: Mode;
  level: Level;
  fidelity: Fidelity;
  granularity: Granularity;
}

export type FileCategory = "code" | "test" | "config" | "doc" | "i18n" | "schema" | "style" | "asset" | "data" | "other";

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
  /** Name of the monorepo workspace this route's file lives in, if any. */
  workspace?: string;
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

// --- Design system (visual / brand contract) --------------------------------
// The contract a faithful rebuild of the product's *visual identity* needs. Like
// every other contract here, naming a token set is not enough: the tokens, the
// theming scheme, the component states, and the accessibility target must be
// concrete enough to rebuild and test against. Every field is optional — a
// backend / CLI / library has no design system, and a partial capture is valid.

/** Named design tokens, each as a `name: value` pair (e.g. `"primary-500: #1d4ed8"`). */
export interface DesignTokens {
  /** Color roles / scales, e.g. `"primary-500: #1d4ed8"`, `"bg: var(--bg)"`. */
  colors?: string[];
  /** Type scale steps, e.g. `"text-sm: 0.875rem / 1.25rem"`. */
  typographyScale?: string[];
  /** Spacing scale, e.g. `"2: 0.5rem"`. */
  spacing?: string[];
  /** Sizing scale (widths / heights / container sizes). */
  sizing?: string[];
  /** Border radii, e.g. `"md: 0.375rem"`. */
  radii?: string[];
  /** Shadow / elevation tokens. */
  shadows?: string[];
  /** z-index layers, e.g. `"modal: 1000"`. */
  zIndex?: string[];
}

export interface DesignTheme {
  /** Theme modes supported, e.g. `["light", "dark"]`. */
  modes?: string[];
  /** How themes are expressed: `"CSS variables on :root/.dark"`, `"data-theme"`, `"class"`. */
  scheme?: string;
  /** Default mode and how it is chosen (system / persisted / toggle). */
  default?: string;
  notes?: string;
}

export interface DesignTypography {
  /** Font families with role, e.g. `"sans: Inter"`, `"mono: JetBrains Mono"`. */
  families?: string[];
  /** Weights loaded, e.g. `["400", "500", "700"]`. */
  weights?: string[];
  /** How fonts load: `next/font`, `@font-face`, a Google Fonts link, self-hosted. */
  loading?: string;
}

export interface DesignMotion {
  /** Duration tokens, e.g. `"fast: 150ms"`. */
  durations?: string[];
  /** Easing curves, e.g. `"standard: cubic-bezier(0.4, 0, 0.2, 1)"`. */
  easings?: string[];
  /** How `prefers-reduced-motion` is honored. */
  reducedMotion?: string;
}

/** One component-library primitive and the contract a rebuild must reproduce. */
export interface ComponentPrimitive {
  name: string;
  /** Variants, e.g. `["primary", "secondary", "ghost"]`. */
  variants?: string[];
  /** States it must render, e.g. `["default", "hover", "focus", "disabled", "loading", "error"]`. */
  states?: string[];
  /** Where it comes from: `"owned"`, `"Radix"`, `"shadcn/ui"`, `"MUI"`… */
  source?: string;
  notes?: string;
}

export interface Accessibility {
  /** WCAG conformance target, e.g. `"WCAG 2.1 AA"`. */
  target?: string;
  /** Keyboard-nav, focus-management, contrast, and ARIA expectations. */
  requirements?: string[];
}

/**
 * The design-system contract → `architecture/DESIGN-SYSTEM.md`. Pre-filled from
 * the interview on the scratch path; surfaced as a skeleton the agent fills (from
 * the candidate source files) on the code path.
 */
export interface DesignSystem {
  tokens?: DesignTokens;
  theme?: DesignTheme;
  typography?: DesignTypography;
  /** Responsive breakpoints, e.g. `"sm: 640px"`. */
  breakpoints?: string[];
  /** Icon set / library and usage, e.g. `"lucide-react · 24px · stroke 2"`. */
  iconography?: string;
  motion?: DesignMotion;
  /** Component-library contract: the primitives and their variants / states. */
  components?: ComponentPrimitive[];
  a11y?: Accessibility;
  /** Free-text brand identity / voice notes — redesign mode anchors to this. */
  brand?: string;
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
  /** Styling / UI libraries (subset of `libraries`): Tailwind, MUI, Radix, Chakra… — the design-system signal. */
  stylingLibraries?: string[];
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
  /** Files with realtime signals: WebSocket servers/gateways, socket.io, SSE. */
  realtimeCandidates: string[];
  /** Files with auth/middleware signals: guards, auth middleware, session/token plumbing. */
  authCandidates: string[];
  /**
   * Files that likely declare a design system: Tailwind/Panda/UnoCSS configs,
   * theme/token modules, global CSS with custom properties, font config.
   */
  designSystemCandidates: string[];
  /** Best-effort program entry points (any ecosystem). */
  entryPoints: string[];
}

/** Which membership declaration a workspace was detected from. */
export type WorkspaceKind = "npm" | "pnpm" | "lerna" | "nx" | "cargo" | "go";

/** A workspace inside a monorepo. */
export interface Workspace {
  name: string;
  path: string;
  /** Detection source (npm/yarn `workspaces`, pnpm, lerna, nx, cargo, go.work). */
  kind?: WorkspaceKind;
  /**
   * Names of sibling workspaces this one depends on, from manifest declarations
   * (package.json deps, Cargo path/name deps, go.mod require/replace). Manifest
   * edges only — implicit coupling (HTTP calls, generated clients, shared env)
   * is the agent's to verify.
   */
  dependsOn?: string[];
  /** This workspace's own stack, detected from its files and manifests. */
  stack?: StackInfo;
  /** Dependencies declared by this workspace's own manifests (repo-relative paths). */
  dependencies?: DependencyInfo[];
  /** Files attributed to this workspace (longest-prefix match). */
  fileCount?: number;
  /** Routes attributed to this workspace (the routes carry `workspace`). */
  routeCount?: number;
  /** Schema files under this workspace. */
  schemas?: string[];
  /** Global hints filtered to this workspace's files. */
  hints?: Hints;
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
  /**
   * Non-fatal analysis warnings — a manifest that exists but does not parse, a
   * workspace dependency cycle. Detection degraded gracefully but the agent
   * should verify the affected area instead of trusting an empty default.
   * Omitted when there are none.
   */
  warnings?: string[];
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
  /**
   * The design-system contract → `architecture/DESIGN-SYSTEM.md`. Present only
   * when UI is detected (code path) or pre-filled from the plan (scratch path);
   * absent for a backend / CLI / library with no visual surface.
   */
  designSystem?: DesignSystem;
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
  /** Design-system plan block → `architecture/DESIGN-SYSTEM.md` (pre-filled). */
  designSystem?: DesignSystem;
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

// ---------------------------------------------------------------------------
// Requirement-support verification (`--verify` / `--check --semantic`). The
// structural `--check` proves the tree is well-formed; it never proves each PRD
// requirement actually TRACES to the original source. `--verify` pairs every
// requirement with the feature's captured evidence; an agent adjudicates whether
// it is grounded (supported), partial, not found (unsupported = invented), or
// contradicted (refuted); `--check --semantic` then fails on a refuted/
// unsupported requirement. Additive — the structural gate is unchanged.
// ---------------------------------------------------------------------------
export type VerdictKind = "supported" | "partial" | "refuted" | "unsupported";

/**
 * How the adjudicator arrived at a verdict: `confirmed` (evidence read and
 * decisive), `inferred` (consistent with the source but indirect — a pattern,
 * a convention, standard library/DB behavior), or `gap` (evidence thin or
 * missing; needs a human). Triage metadata — the verdict kind gates, the
 * confidence never does; it keeps grounded fact machine-distinguishable from
 * inference.
 */
export type ConfidenceKind = "confirmed" | "inferred" | "gap";

export interface ClaimEvidencePair {
  claimId: string; // "C1", "C2", …
  claim: string; // the requirement text (capped)
  feature: string; // the feature slug it came from
  evidenceRef: string; // the best-matched captured evidence (source file / route / entity)
  digest: string; // the candidate evidence for this requirement
}

export interface Verdict extends ClaimEvidencePair {
  verdict: VerdictKind;
  note: string;
  confidence?: ConfidenceKind;
}

export interface VerifyResult {
  ok: boolean;
  pairs: number;
  adjudicated: number;
  supported: number;
  partial: number;
  refuted: number;
  unsupported: number;
  failures: { claimId: string; evidenceRef: string; verdict: VerdictKind; note: string }[];
  unadjudicated: string[];
  verdicts?: Verdict[];
  /** Aggregated confidence labels, when the adjudicator stamped any. */
  confidence?: { confirmed: number; inferred: number; gap: number; unlabeled: number };
}

export interface VerifyWorklist {
  run: string;
  pairs: ClaimEvidencePair[];
}

// ---------------------------------------------------------------------------
// AI buildability review ledger (`--review` / `--check --semantic`). The
// structural `--check` proves the tree is well-formed; `--verify` proves each
// requirement traces to source. Neither judges whether the prose is actually
// *buildable* — that is the nine-check AI review (`references/ai-review-rubric.md`).
// The review ledger turns that review into a deterministic, terminating loop:
// `--review` emits a per-feature worklist (content-hashed, so it can tell what
// changed); an agent fans out one finder per changed feature + one independent
// verifier per blocker and fills the findings; `--review --apply` reduces them to
// a pass / changed-set / no-progress signal so the convergence loop stops on a
// correct fixpoint. Determinism (hashing, change-tracking, reduction) lives here;
// the JUDGEMENT (the findings) is the agent's. Additive — folds into
// `--check --semantic`, never relaxing the structural gate.
// ---------------------------------------------------------------------------
export type ReviewSeverity = "blocker" | "major" | "minor";

/** The nine rubric/contract categories a finding can belong to. */
export type ReviewCategory = "stories" | "requirements" | "acceptance" | "write-contract" | "enum" | "consistency" | "faithfulness" | "i18n" | "rebuild-test";

/** One reviewer finding against a feature PRD — one row of the rubric table. */
export interface ReviewFinding {
  /**
   * Stable id `feature:category:hash(problem)` — assigned by the engine so the
   * SAME finding keeps its id across rounds, which is what makes "the same
   * residual findings" (no-progress) measurable. Agents may omit it.
   */
  id?: string;
  feature: string;
  severity: ReviewSeverity;
  category: ReviewCategory;
  problem: string;
  fix: string;
  /**
   * Adjudication by an INDEPENDENT verifier (never the finder/author): a blocker
   * gates buildability unless a verifier `refuted` it as a false positive. Left
   * null/omitted means "not yet verified" — still gates, conservatively.
   */
  verdict?: "confirmed" | "refuted" | null;
  verifierNote?: string;
}

/** One feature's slot in the review worklist. */
export interface ReviewUnit {
  /** Feature slug, e.g. "06-public-directory". */
  feature: string;
  /** sha256 of this feature's `PRD.md` — detects per-feature change. */
  prdHash: string;
  /** sha256 of the shared architecture docs (INTERFACES + DATA-MODEL + ARCHITECTURE). */
  archHash: string;
  /**
   * True on the first round, or when this feature's `prdHash` or the shared
   * `archHash` changed since the last `REVIEW.json` — the "only re-review what
   * changed" signal. The agent reviews only the units flagged here.
   */
  needsReview: boolean;
  /** Reviewer findings — empty in the worklist; the agent fills them. */
  findings: ReviewFinding[];
}

export interface ReviewWorklist {
  run: string;
  /** The round this worklist prepares (prior round + 1). */
  round: number;
  /** Features changed since the previous round (all of them on the first round). */
  changedSet: string[];
  units: ReviewUnit[];
}

export interface ReviewResult {
  /** True when no gating (unrefuted) blocker remains — the buildable fixpoint. */
  ok: boolean;
  round: number;
  units: number;
  /** Units flagged `needsReview` this round. */
  reviewed: number;
  blockers: number;
  majors: number;
  minors: number;
  /** Features whose PRD changed since the previous round (or all, on an arch change). */
  changedSet: string[];
  /** Sorted ids of the gating (unrefuted) blockers this round. */
  residual: string[];
  /** True when this round's residual id set equals the previous round's (and is non-empty). */
  noProgress: boolean;
  /** Consecutive no-progress rounds — the convergence loop bound (stop at >= 2). */
  staleRounds: number;
  failures: { id: string; feature: string; category: ReviewCategory; problem: string; fix: string }[];
  findings?: ReviewFinding[];
  /**
   * The content-hash baseline this round *adjudicated* — the anchor the next
   * `--review` diffs against. Persisting it in REVIEW.json (which only `--apply`
   * updates) rather than re-reading REVIEW.todo.json (which every `--review`
   * overwrites) makes change-tracking idempotent: running `--review` repeatedly
   * without applying never masks a pending change.
   */
  baseline?: { archHash: string; features: { feature: string; prdHash: string }[] };
}

export const VERSION = "1.3.0";
