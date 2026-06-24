import { basename } from "node:path";
import { walk } from "./walk.js";
import { detectStack, detectNodeVersion } from "./detect/stack.js";
import {
  detectWorkspaces,
  buildWorkspaceGraph,
  enrichWorkspaceStacks,
  mergeWorkspaceStacks,
  enrichWorkspaceSurface,
  findWorkspaceCycle,
} from "./detect/workspaces.js";
import { detectCandidates } from "./detect/candidates.js";
import { detectStylingLibraries } from "./design.js";
import {
  extractDependencies,
  extractScripts,
  extractEnvVars,
  collectByCategory,
} from "./adapters/generic.js";
import { detectRoutes } from "./adapters/registry.js";
import { detectI18n } from "./adapters/i18n.js";
import { buildFeatures } from "./features.js";
import { VERSION } from "./types.js";
import type { Hints, Inventory, Options, RouteInfo, StackInfo, Workspace } from "./types.js";

/**
 * Notes the engine could not resolve deterministically — explicit pointers that
 * send the AI agent to the right hints/playbook step instead of leaving a silent
 * gap. The agent resolves these while writing INTERFACES.md / DATA-MODEL.md.
 */
function computeUnknowns(
  stack: StackInfo,
  routes: RouteInfo[],
  hints: Hints,
  workspaces: Workspace[],
): string[] {
  const u: string[] = [];
  if (workspaces.length > 0) {
    u.push(
      "Monorepo: workspaces were detected (`workspaces[*]` carries each one's stack, dependencies, hints, and `dependsOn`) — verify each workspace's role (app / package / service) and extend the dependency graph with implicit edges (HTTP calls between apps, generated clients, shared env vars); deterministic edges come from manifest declarations only.",
    );
  }
  if (stack.frameworks.length === 0) {
    u.push(
      "No web framework was detected from manifests — identify the stack from `stack.languages` + `dependencies`, find the entry points (`hints.entryPoints`, else the file tree), then map the interface surface manually.",
    );
  }
  if (routes.length === 0 && (hints.routeCandidates.length > 0 || hints.apiCandidates.length > 0)) {
    u.push(
      "Routes were not resolved deterministically (a framework without a dedicated route adapter, or an RPC/GraphQL surface) — derive the real interface surface from `hints.routeCandidates` / `hints.apiCandidates` into `architecture/INTERFACES.md`.",
    );
  }
  if (hints.apiCandidates.length > 0) {
    u.push(
      "API surface candidates (tRPC / GraphQL / gRPC / OpenAPI) were found but not enumerated — read each and list every procedure/operation in `architecture/INTERFACES.md`.",
    );
  }
  if (hints.schemaCandidates.length > 0) {
    u.push(
      "The data model is not structured by the engine — extract entities, fields, types, and relations from `hints.schemaCandidates` into `architecture/DATA-MODEL.md`.",
    );
  }
  if (hints.realtimeCandidates.length > 0) {
    u.push(
      "Realtime/WebSocket signals were found — enumerate the channels, events, and message shapes from `hints.realtimeCandidates` in `architecture/INTERFACES.md`; they rarely appear in HTTP route tables.",
    );
  }
  if (hints.authCandidates.length > 0) {
    u.push(
      "Auth/middleware signals were found — read `hints.authCandidates` and record the auth rule per operation in the `architecture/INTERFACES.md` interface table's Auth column.",
    );
  }
  if (hints.designSystemCandidates.length > 0) {
    u.push(
      "Design-system source files were found (Tailwind/theme configs, token modules, global CSS) — capture the visual contract (tokens with their exact values, theming, typography, components, a11y) from `hints.designSystemCandidates` in `architecture/DESIGN-SYSTEM.md`.",
    );
  }
  return u;
}

/** Deterministic, LLM-free analysis of a repository into a structured inventory. */
export function analyze(opts: Options): Inventory {
  const { files, excludedCount } = walk(opts.repo, {
    include: opts.include,
    exclude: opts.exclude,
    out: opts.out,
  });
  // Non-fatal degradations (malformed manifests, dependency cycles) collect
  // here; deduped+sorted below so repeat reads of one broken file warn once.
  const warnings: string[] = [];
  let stack = detectStack(opts.repo, files, warnings);
  // Workspaces come first: a monorepo's frameworks live in workspace manifests,
  // and route adapters activate off the (merged) global stack.
  const workspaces = detectWorkspaces(opts.repo, warnings);
  if (workspaces.length > 0) {
    buildWorkspaceGraph(opts.repo, workspaces, warnings);
    enrichWorkspaceStacks(opts.repo, workspaces, files, warnings);
    stack = mergeWorkspaceStacks(stack, workspaces);
    const cycle = findWorkspaceCycle(workspaces);
    if (cycle) {
      warnings.push(
        `workspace dependency cycle: ${cycle.join(" → ")} — the build order falls back to path order for these workspaces`,
      );
    }
  }
  const dependencies = extractDependencies(opts.repo, files, warnings);
  const routes = detectRoutes(files, stack, opts.repo);
  const i18n = detectI18n(opts.repo, files);
  const schemas = collectByCategory(files, "schema");
  const configs = collectByCategory(files, "config");
  const docs = collectByCategory(files, "doc");
  const envVars = extractEnvVars(opts.repo, files);
  const scripts = extractScripts(opts.repo, warnings);
  const hints = detectCandidates(opts.repo, files, stack);
  if (workspaces.length > 0) {
    enrichWorkspaceSurface(workspaces, routes, hints, schemas);
  }
  const node = detectNodeVersion(opts.repo, warnings);
  const features = buildFeatures(files, routes, i18n, opts.granularity, workspaces);
  const unknowns = computeUnknowns(stack, routes, hints, workspaces);
  const uniqueWarnings = [...new Set(warnings)].sort();
  const totalLines = files.reduce((n, f) => n + f.lines, 0);
  // Derive the styling-library signal from the final (merged) library set so a
  // workspace-only styling lib still surfaces. Drives `hasUI` / the DS gate.
  const stylingLibraries = detectStylingLibraries(stack.libraries);

  return {
    generatedWith: `reconstruct@${VERSION}`,
    generation: {
      mode: opts.mode,
      level: opts.level,
      fidelity: opts.fidelity,
      granularity: opts.granularity,
    },
    repoName: basename(opts.repo) || "project",
    stack: stylingLibraries.length ? { ...stack, stylingLibraries } : stack,
    fileCount: files.length,
    totalLines,
    files,
    dependencies,
    routes,
    i18n,
    schemas,
    configs,
    docs,
    envVars,
    scripts,
    features,
    hints,
    unknowns,
    ...(uniqueWarnings.length ? { warnings: uniqueWarnings } : {}),
    ...(workspaces.length ? { workspaces } : {}),
    ...(node ? { runtime: { node } } : {}),
    excludedCount,
  };
}
