// Core data model shared across the analyzer pipeline.

export type Mode = "preserve" | "redesign";
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
  /**
   * Post-step mode: rebuild the merge/summary from an already-generated output
   * directory (`out`) without re-analysing a repo. Set when `--merge`/`--summary`
   * is used without `--repo`.
   */
  standalone: boolean;
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
}

export interface I18nInfo {
  locales: string[];
  files: string[];
  keyCount: number;
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

export const VERSION = "0.3.0";
