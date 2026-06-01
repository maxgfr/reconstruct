import { basename } from "node:path";
import { walk } from "./walk.js";
import { detectStack } from "./detect/stack.js";
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
import type { Inventory, Options } from "./types.js";

/** Deterministic, LLM-free analysis of a repository into a structured inventory. */
export function analyze(opts: Options): Inventory {
  const files = walk(opts.repo);
  const stack = detectStack(opts.repo, files);
  const dependencies = extractDependencies(opts.repo, files);
  const routes = detectRoutes(files, stack);
  const i18n = detectI18n(opts.repo, files);
  const schemas = collectByCategory(files, "schema");
  const configs = collectByCategory(files, "config");
  const docs = collectByCategory(files, "doc");
  const envVars = extractEnvVars(opts.repo, files);
  const scripts = extractScripts(opts.repo);
  const features = buildFeatures(files, routes, i18n);
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
  };
}
