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
import { extractDependencies, extractScripts, extractEnvVars, collectByCategory } from "./adapters/generic.js";
import { detectRoutes } from "./adapters/registry.js";
import { detectI18n } from "./adapters/i18n.js";
import { buildFeatures } from "./features.js";
import { VERSION } from "./types.js";
import type { FileInfo, Hints, Inventory, Options, RouteInfo, StackInfo, Workspace } from "./types.js";

/**
 * Frameworks that declare HTTP routes. One of these detected with ZERO resolved
 * routes means the interface surface is simply unmapped — the engine has no
 * adapter for it, or the routes are declared in a way regex resolution cannot
 * see. Silence there would leave the agent with no signal at all.
 */
const ROUTE_BEARING_FRAMEWORKS = new Set([
  "Next.js",
  "Nuxt",
  "Remix",
  "React Router",
  "SvelteKit",
  "Astro",
  "Angular",
  "SolidStart",
  "NestJS",
  "Express",
  "Fastify",
  "Koa",
  "Hono",
  "Django",
  "Flask",
  "FastAPI",
  "Ruby on Rails",
  "Sinatra",
  "Laravel",
  "Symfony",
  "Spring Boot",
  "ASP.NET Core",
  "Gin",
  "Echo",
  "Fiber",
  "chi",
  "Gorilla",
]);

/**
 * Frameworks whose interface surface is NOT HTTP routes: desktop apps expose IPC
 * channels, mobile apps expose screens, view libraries expose components plus the
 * API they call. Reporting "routes were not resolved" for these is actively
 * misleading — they have no routes to resolve.
 */
const NON_HTTP_SURFACE_FRAMEWORKS = new Set(["Electron", "Tauri", "React Native", "Expo", "Flutter", "React", "Vue", "Svelte", "SolidJS"]);

/**
 * Infrastructure configs that declare the invocable surface (HTTP routes, cron
 * triggers, queue consumers, event sources) OUTSIDE the application code. Reading
 * the handlers alone under-reports the surface, so their presence is always worth
 * an explicit pointer.
 */
const INFRA_SURFACE_CONFIGS = [
  "wrangler.toml",
  "wrangler.jsonc",
  "wrangler.json",
  "serverless.yml",
  "serverless.yaml",
  "template.yaml",
  "sst.config.ts",
  "netlify.toml",
];

/**
 * Notes the engine could not resolve deterministically — explicit pointers that
 * send the AI agent to the right hints/playbook step instead of leaving a silent
 * gap. The agent resolves these while writing INTERFACES.md / DATA-MODEL.md.
 */
function computeUnknowns(stack: StackInfo, routes: RouteInfo[], hints: Hints, workspaces: Workspace[], files: FileInfo[]): string[] {
  const u: string[] = [];
  if (workspaces.length > 0) {
    u.push(
      "Monorepo: workspaces were detected (`workspaces[*]` carries each one's stack, dependencies, hints, and `dependsOn`) — verify each workspace's role (app / package / service) and extend the dependency graph with implicit edges (HTTP calls between apps, generated clients, shared env vars); deterministic edges come from manifest declarations only.",
    );
  }
  if (stack.frameworks.length === 0) {
    u.push(
      "No web framework was detected from manifests — identify the stack from `stack.languages` + `dependencies`, find the entry points (`hints.entryPoints`, else the file tree), then map the interface surface manually. If there is no web framework because this is a library / CLI / SDK / engine, that is a first-class case: the interface surface is the exported public API plus the CLI commands, not routes — see `references/stack-guides/library-cli-sdk.md`.",
    );
  }
  // Route-surface guidance, most specific first. Each branch is exclusive: a
  // detected framework tells us what KIND of surface to expect, so a generic
  // "routes not resolved" would either duplicate it or mislead.
  if (routes.length === 0) {
    const routeBearing = stack.frameworks.filter((f) => ROUTE_BEARING_FRAMEWORKS.has(f));
    const nonHttp = stack.frameworks.filter((f) => NON_HTTP_SURFACE_FRAMEWORKS.has(f));
    if (routeBearing.length > 0) {
      u.push(
        `No routes were resolved although ${routeBearing.join(", ")} was detected — the engine has no route adapter for it, or its routes are declared in a way static resolution cannot see. Build the interface surface by hand from the framework's own route configuration (see \`references/stack-guides/INDEX.md\` for the matching guide) into \`architecture/INTERFACES.md\`.`,
      );
    } else if (nonHttp.length > 0) {
      u.push(
        `${nonHttp.join(", ")} exposes no HTTP routes — its interface surface is something else entirely (desktop IPC channels and the preload/command contract, mobile screens and navigation, or an exported component/module API). Enumerate that surface per its guide in \`references/stack-guides/INDEX.md\`, not a route table.`,
      );
    } else if (hints.routeCandidates.length > 0 || hints.apiCandidates.length > 0) {
      u.push(
        "Routes were not resolved deterministically (a framework without a dedicated route adapter, or an RPC/GraphQL surface) — derive the real interface surface from `hints.routeCandidates` / `hints.apiCandidates` into `architecture/INTERFACES.md`.",
      );
    }
  }
  // Serverless/edge: the invocable surface lives in infra config, so even a
  // fully-resolved set of in-code routes is an under-report (crons, queue
  // consumers and event sources are invisible to route resolution).
  const infra = [...new Set(files.map((f) => f.path.split("/").pop() ?? "").filter((n) => INFRA_SURFACE_CONFIGS.includes(n)))].sort();
  if (infra.length > 0) {
    u.push(
      `Serverless/edge infrastructure config was found (${infra.join(", ")}) — the invocable surface is declared THERE, not only in code: HTTP routes/patterns, cron triggers, queue consumers, event sources and their bindings. Enumerate it from the config first, then open each handler for its event/response contract (see \`references/stack-guides/serverless-edge.md\`).`,
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
      warnings.push(`workspace dependency cycle: ${cycle.join(" → ")} — the build order falls back to path order for these workspaces`);
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
  const unknowns = computeUnknowns(stack, routes, hints, workspaces, files);
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
