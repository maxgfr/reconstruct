// Core data model shared across the analyzer pipeline.

export type Mode = "preserve" | "redesign";
export type Level = "light" | "complex";
export type Fidelity = "mirror" | "embed" | "describe";

export interface Options {
  /** Absolute path to the repository to analyze. */
  repo: string;
  /** Absolute path to the output directory (the `reconstruction/` tree). */
  out: string;
  mode: Mode;
  level: Level;
  fidelity: Fidelity;
  /** When true, print the inventory JSON to stdout and write nothing. */
  json: boolean;
  /** Max bytes of a single file embedded into a PRD (embed fidelity). */
  maxEmbedBytes: number;
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

export interface Inventory {
  generatedWith: string;
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

export const VERSION = "0.1.0";
