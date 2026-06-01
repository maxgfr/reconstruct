import { basename } from "node:path";
import { walk } from "./walk.js";
import { detectStack, detectWorkspaces, detectNodeVersion } from "./detect/stack.js";
import { detectCandidates } from "./detect/candidates.js";
import {
  extractDependencies,
  extractScripts,
  extractEnvVars,
  collectByCategory,
} from "./adapters/generic.js";
import { detectRoutes } from "./adapters/nextjs.js";
import { detectI18n } from "./adapters/i18n.js";
import { buildFeatures } from "./features.js";
import { VERSION } from "./types.js";
import type { Hints, Inventory, Options, RouteInfo, StackInfo } from "./types.js";

/**
 * Notes the engine could not resolve deterministically — explicit pointers that
 * send the AI agent to the right hints/playbook step instead of leaving a silent
 * gap. The agent resolves these while writing INTERFACES.md / DATA-MODEL.md.
 */
function computeUnknowns(stack: StackInfo, routes: RouteInfo[], hints: Hints): string[] {
  const u: string[] = [];
  if (stack.frameworks.length === 0) {
    u.push(
      "No web framework was detected from manifests — identify the stack and entry points from `hints.entryPoints`, then map the interface surface manually.",
    );
  }
  if (routes.length === 0 && (hints.routeCandidates.length > 0 || hints.apiCandidates.length > 0)) {
    u.push(
      "Routes were not resolved deterministically (non-Next.js routing, or an RPC/GraphQL surface) — derive the real interface surface from `hints.routeCandidates` / `hints.apiCandidates` into `architecture/INTERFACES.md`.",
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
  return u;
}

/** Deterministic, LLM-free analysis of a repository into a structured inventory. */
export function analyze(opts: Options): Inventory {
  const { files, excludedCount } = walk(opts.repo, {
    include: opts.include,
    exclude: opts.exclude,
  });
  const stack = detectStack(opts.repo, files);
  const dependencies = extractDependencies(opts.repo, files);
  const routes = detectRoutes(files, stack);
  const i18n = detectI18n(opts.repo, files);
  const schemas = collectByCategory(files, "schema");
  const configs = collectByCategory(files, "config");
  const docs = collectByCategory(files, "doc");
  const envVars = extractEnvVars(opts.repo, files);
  const scripts = extractScripts(opts.repo);
  const hints = detectCandidates(opts.repo, files, stack);
  const workspaces = detectWorkspaces(opts.repo);
  const node = detectNodeVersion(opts.repo);
  const features = buildFeatures(files, routes, i18n, opts.granularity);
  const unknowns = computeUnknowns(stack, routes, hints);
  const totalLines = files.reduce((n, f) => n + f.lines, 0);

  return {
    generatedWith: `reconstruct@${VERSION}`,
    repoName: basename(opts.repo) || "project",
    stack,
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
    ...(workspaces.length ? { workspaces } : {}),
    ...(node ? { runtime: { node } } : {}),
    excludedCount,
  };
}
