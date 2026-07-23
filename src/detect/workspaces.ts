import { existsSync } from "node:fs";
import { join } from "node:path";
import { detectWorkspaces as engineDetectWorkspaces } from "../vendor/codeindex-engine.mjs";
import type { WorkspacePackage } from "../vendor/codeindex-engine.mjs";
import { detectStack } from "./stack.js";
import { readJsonManifest, safeRead } from "./manifest.js";
import { extractDependencies } from "../adapters/generic.js";
import type { FileInfo, Hints, RouteInfo, StackInfo, Workspace, WorkspaceKind } from "../types.js";

// Workspace membership discovery — npm/yarn `workspaces`, pnpm-workspace.yaml
// (incl. `!` negations), lerna.json / nx.json fallbacks (now including nx
// members manifested ONLY by project.json — an engine gap up to v2.0.1, closed
// as of v2.6, verified in the vendored .d.mts/.mjs: `packageAt`'s default probe
// order ends in a project.json probe), Cargo `[workspace] members` (globs +
// exclude), go.work `use` directives, and maven/uv/composer/gradle module
// declarations — is the vendored codeindex engine's `detectWorkspaces`, which
// was itself ported from this module. Two engine-era differences that used to
// be documented here no longer hold and were dropped with the v2.10.0 re-pin:
//
// - NAMING: the engine's per-kind probes (`probeNodePkg`, `probeCargo`, …) now
//   fall back to the full repo-relative dir on a nameless manifest, same as
//   this module — at v2.0.1 the engine fell back to the dir *basename*, which
//   could collide across siblings;
// - nx members manifested only by project.json are now found by the engine's
//   own probe chain (verified against `tests/workspaces.test.ts`'s "reads the
//   nx workspaceLayout, accepting project.json manifests" case), so the local
//   `addNxProjectJsonMembers`/`pnpmDeclaresPackages` fallback (~48 lines) that
//   used to patch this gap is gone; `adaptPackage` below still re-reads the
//   winning manifest itself, for the warning below.
//
// What stays local:
//
// - a dir declared a member via a cargo/go/uv/gradle pattern is a workspace
//   only if its own Cargo.toml / go.mod / pyproject.toml / build.gradle[.kts]
//   actually exists and names it (go.work members are named by their go.mod
//   `module`, even when a package.json is also present) — the engine's
//   per-kind probe chain (`packageAt`) doesn't try the kind's own manifest
//   first for every kind (cargo- and gradle-declared dirs fall through
//   node/maven/… first) and would otherwise report such a dir under a
//   JS-derived name. composer gets the same "own manifest required" guard,
//   re-reading composer.json itself (its probe chain does try composer.json
//   first, but only once the manifest is confirmed present does this module
//   trust it — same as the npm-family package.json branch below). maven is
//   the one exception, kept as-is with no local precedent for the guard;
// - malformed-manifest WARNINGS in this module's own wording (`malformed
//   <ws>/package.json … — falling back to empty defaults`), so a defect
//   surfaces once, in the phrasing every other stage (stack/deps/scripts) uses
//   — the engine's `WorkspaceInfo.warnings` exists too (added v2.10.0) but is
//   worded differently and, being collected separately, would double-report
//   the same malformed file under two strings instead of deduping to one (see
//   `tests/warnings.test.ts`'s "warns once…" case), so it is deliberately not
//   merged in. composer.json gets this treatment too (JSON, like package.json);
//   pyproject.toml and build.gradle[.kts] don't (regex-based, like Cargo.toml
//   and go.mod — see manifest.ts's TOML/YAML/Gemfile note).
//
// The workspace dependency edges (npm name deps, cargo name/path deps, go
// require/replace, maven artifactIds, uv PEP 508 deps / `tool.uv.sources`,
// composer require/require-dev, gradle `project(":x")` refs) come from the
// engine's graph, remapped onto the local naming contract by directory in
// buildWorkspaceGraph below.

/** Workspace name from a member's `Cargo.toml` `[package] name`; null if no manifest. */
function readCargoName(dir: string): string | null {
  const toml = safeRead(join(dir, "Cargo.toml"));
  if (!toml) return null;
  const pkg = tomlSectionBody(toml, "package");
  const m = pkg?.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
  return m ? (m[1] as string) : "";
}

/** Workspace name from a member's `go.mod` `module` line; null if no manifest. */
function readGoModule(dir: string): string | null {
  const gomod = safeRead(join(dir, "go.mod"));
  if (!gomod) return null;
  const m = gomod.match(/^module\s+(\S+)/m);
  return m ? (m[1] as string) : "";
}

/** Workspace name from a member's `pyproject.toml` (`[project]` or `[tool.poetry]` `name`); null if no manifest. */
function readUvName(dir: string): string | null {
  const toml = safeRead(join(dir, "pyproject.toml"));
  if (!toml) return null;
  const nameIn = (body: string | null) => body?.match(/^\s*name\s*=\s*["']([^"']+)["']/m)?.[1];
  return nameIn(tomlSectionBody(toml, "project")) ?? nameIn(tomlSectionBody(toml, "tool.poetry")) ?? "";
}

/** A member's `build.gradle`/`build.gradle.kts` — presence only, gradle has no portable name field; null if neither exists. */
function hasGradleManifest(dir: string): boolean {
  return existsSync(join(dir, "build.gradle")) || existsSync(join(dir, "build.gradle.kts"));
}

/** The body of a top-level `[section]` table, up to the next `[…]` header. */
function tomlSectionBody(toml: string, section: string): string | null {
  const re = new RegExp(`^\\[${section}\\]\\s*$([\\s\\S]*?)(?=^\\[|$(?![\\s\\S]))`, "m");
  const m = toml.match(re);
  return m ? (m[1] as string) : null;
}

/**
 * Re-derive an engine-detected package's name under reconstruct's contract,
 * reading the manifest the engine identified it by (which also surfaces the
 * malformed-manifest warnings the engine swallows). Returns null when the
 * local contract says "not a workspace" (e.g. a cargo member dir whose
 * Cargo.toml vanished but that carries a package.json).
 */
function adaptPackage(repo: string, pkg: WorkspacePackage, warnings?: string[]): Workspace | null {
  const path = pkg.dir;
  let name: string | null;
  if (pkg.kind === "cargo") {
    name = readCargoName(join(repo, path));
  } else if (pkg.kind === "go") {
    name = readGoModule(join(repo, path));
  } else if (pkg.kind === "uv") {
    name = readUvName(join(repo, path));
  } else if (pkg.kind === "gradle") {
    // No portable name field in Gradle's DSL (probeGradle itself falls back to
    // the dir) — presence of the member's own build.gradle[.kts] is what the
    // local contract requires; the empty string here defers to `name || path`.
    name = hasGradleManifest(join(repo, path)) ? "" : null;
  } else if (pkg.kind === "composer") {
    if (!existsSync(join(repo, path, "composer.json"))) {
      name = null;
    } else {
      const manifest = readJsonManifest(join(repo, path, "composer.json"), `${path}/composer.json`, warnings);
      name = manifest && typeof manifest.name === "string" && manifest.name ? manifest.name : "";
    }
  } else if (pkg.kind === "maven") {
    // No local precedent — keep the engine's `<artifactId>` naming as-is.
    name = pkg.name;
  } else if (pkg.kind === "nx" && !existsSync(join(repo, path, "package.json"))) {
    // The engine's own probe chain now finds nx members manifested only by
    // project.json (v2.6+); only the malformed-manifest warning wording — this
    // module's, not the engine's — stays local (see the header comment).
    const proj = readJsonManifest(join(repo, path, "project.json"), `${path}/project.json`, warnings);
    name = proj && typeof proj.name === "string" && proj.name ? proj.name : "";
  } else if (existsSync(join(repo, path, "package.json"))) {
    // A malformed member manifest still marks a workspace (the dir was declared
    // a member); it falls back to the path name and the warning surfaces it.
    const manifest = readJsonManifest(join(repo, path, "package.json"), `${path}/package.json`, warnings);
    name = manifest && typeof manifest.name === "string" && manifest.name ? manifest.name : "";
  } else {
    name = null; // no manifest under the local contract → not a workspace
  }
  if (name === null) return null;
  return { name: name || path, path, kind: pkg.kind as WorkspaceKind };
}

/**
 * Detect monorepo workspaces across ecosystems: npm/yarn `workspaces`,
 * pnpm-workspace.yaml (incl. `!` negation patterns), lerna.json / nx.json as
 * fallbacks when package.json declares none, Cargo `[workspace] members`,
 * go.work `use` directives, maven `<modules>`, uv `[tool.uv.workspace]
 * members`, composer `repositories` path entries, and gradle `settings.gradle[
 * .kts]` `include`. A trailing `/*` glob is expanded one directory level,
 * `/**` recursively. Returns [] for a single-package repo.
 */
export function detectWorkspaces(repo: string, warnings?: string[]): Workspace[] {
  const found = new Map<string, Workspace>();
  for (const pkg of engineDetectWorkspaces(repo).packages) {
    const ws = adaptPackage(repo, pkg, warnings);
    if (ws) found.set(ws.path, ws);
  }
  return [...found.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Fill each workspace's `dependsOn` with the sibling workspaces its manifest
 * declares a dependency on. Edges come from manifests only (the engine's
 * workspace graph: package.json deps, Cargo name/path deps, go.mod
 * require/replace, maven `<dependency>` artifactIds, uv PEP 508 deps /
 * `tool.uv.sources`, composer require/require-dev, gradle `project(":x")`
 * refs), remapped by directory onto the local workspace names; implicit
 * coupling is left to the agent.
 */
export function buildWorkspaceGraph(repo: string, workspaces: Workspace[], _warnings?: string[]): void {
  if (workspaces.length === 0) return;
  const engineByDir = new Map(engineDetectWorkspaces(repo).packages.map((p) => [p.dir, p]));
  const localNames = new Set(workspaces.map((w) => w.name));
  // engine name → local name, joined on the shared directory. An ambiguous
  // engine name (two nameless siblings sharing a basename) maps to null and
  // its edges are dropped rather than mis-attributed.
  const remap = new Map<string, string | null>();
  for (const ws of workspaces) {
    const pkg = engineByDir.get(ws.path);
    if (!pkg) continue;
    remap.set(pkg.name, remap.has(pkg.name) && remap.get(pkg.name) !== ws.name ? null : ws.name);
  }
  for (const ws of workspaces) {
    const pkg = engineByDir.get(ws.path);
    if (!pkg?.dependsOn?.length) continue;
    const edges = new Set<string>();
    for (const dep of pkg.dependsOn) {
      const target = remap.get(dep);
      if (target && target !== ws.name && localNames.has(target)) edges.add(target);
    }
    if (edges.size) ws.dependsOn = [...edges].sort();
  }
}

/**
 * First dependency cycle in the workspace graph (DFS over `dependsOn`, nodes
 * and edges visited in sorted order, so the result is deterministic). Returns
 * the cycle as a closed path (`["a", "b", "a"]`), or null. A cycle is legal —
 * npm devDependencies routinely create one — but the build order then falls
 * back to path order, which the agent should hear about, not discover.
 *
 * Kept local (the algorithm is the same one the engine ports): it operates on
 * the locally-named workspace list, so cycle members are reported under the
 * names the inventory actually uses.
 */
export function findWorkspaceCycle(workspaces: Workspace[]): string[] | null {
  const deps = new Map(workspaces.map((w) => [w.name, [...(w.dependsOn ?? [])].sort()]));
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];
  const visit = (name: string): string[] | null => {
    state.set(name, "visiting");
    stack.push(name);
    for (const dep of deps.get(name) ?? []) {
      if (!deps.has(dep)) continue;
      if (state.get(dep) === "visiting") return [...stack.slice(stack.indexOf(dep)), dep];
      if (!state.has(dep)) {
        const found = visit(dep);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(name, "done");
    return null;
  };
  for (const name of [...deps.keys()].sort()) {
    if (!state.has(name)) {
      const found = visit(name);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Longest-prefix matcher: which workspace does a repo-relative path belong to?
 * Nested workspaces resolve to the deepest one.
 */
export function workspaceMatcher(workspaces: Workspace[]): (path: string) => Workspace | undefined {
  const byDepth = [...workspaces].sort((a, b) => b.path.length - a.path.length);
  return (path) => byDepth.find((ws) => path.startsWith(ws.path + "/"));
}

/**
 * First attribution phase — before route detection. Gives each workspace its
 * own stack and manifest dependencies by rebasing its files onto the workspace
 * dir, so detectStack/extractDependencies read the workspace's own manifests.
 */
export function enrichWorkspaceStacks(repo: string, workspaces: Workspace[], files: FileInfo[], warnings?: string[]): void {
  const matcher = workspaceMatcher(workspaces);
  const filesByWs = new Map<string, FileInfo[]>();
  for (const f of files) {
    const ws = matcher(f.path);
    if (!ws) continue;
    const list = filesByWs.get(ws.path);
    if (list) list.push(f);
    else filesByWs.set(ws.path, [f]);
  }

  for (const ws of workspaces) {
    const wsFiles = filesByWs.get(ws.path) ?? [];
    const prefix = ws.path + "/";
    const rebased = wsFiles.map((f) => ({ ...f, path: f.path.slice(prefix.length) }));
    ws.fileCount = wsFiles.length;
    ws.stack = detectStack(join(repo, ws.path), rebased, warnings, prefix);
    const deps = extractDependencies(join(repo, ws.path), rebased, warnings, prefix);
    if (deps.length) {
      ws.dependencies = deps.map((d) => ({ ...d, manifest: prefix + d.manifest }));
    }
  }
}

/**
 * Union the per-workspace frameworks/libraries/package managers into the global
 * stack. In a monorepo the root manifest rarely declares the app frameworks —
 * without this merge a workspace Next.js app would never activate its route
 * adapter (adapters key off the global stack).
 */
export function mergeWorkspaceStacks(stack: StackInfo, workspaces: Workspace[]): StackInfo {
  const frameworks = new Set(stack.frameworks);
  const libraries = new Set(stack.libraries);
  const packageManagers = new Set(stack.packageManagers);
  for (const ws of workspaces) {
    for (const f of ws.stack?.frameworks ?? []) frameworks.add(f);
    for (const l of ws.stack?.libraries ?? []) libraries.add(l);
    for (const p of ws.stack?.packageManagers ?? []) packageManagers.add(p);
  }
  return {
    ...stack,
    frameworks: [...frameworks],
    libraries: [...libraries],
    packageManagers: [...packageManagers],
  };
}

/**
 * Second attribution phase — after routes/hints exist. Tags each route with the
 * workspace its file lives in, and filters the global hints/schemas down to
 * each workspace's subtree. The global (union) fields stay authoritative.
 */
export function enrichWorkspaceSurface(workspaces: Workspace[], routes: RouteInfo[], hints: Hints, schemas: string[]): void {
  const matcher = workspaceMatcher(workspaces);
  const routeCounts = new Map<string, number>();
  for (const r of routes) {
    const ws = matcher(r.file);
    if (!ws) continue;
    r.workspace = ws.name;
    routeCounts.set(ws.path, (routeCounts.get(ws.path) ?? 0) + 1);
  }

  for (const ws of workspaces) {
    const prefix = ws.path + "/";
    const routeCount = routeCounts.get(ws.path) ?? 0;
    if (routeCount) ws.routeCount = routeCount;
    const wsSchemas = schemas.filter((s) => s.startsWith(prefix));
    if (wsSchemas.length) ws.schemas = wsSchemas;
    const wsHints: Hints = {
      routeCandidates: hints.routeCandidates.filter((p) => p.startsWith(prefix)),
      apiCandidates: hints.apiCandidates.filter((p) => p.startsWith(prefix)),
      schemaCandidates: hints.schemaCandidates.filter((p) => p.startsWith(prefix)),
      realtimeCandidates: hints.realtimeCandidates.filter((p) => p.startsWith(prefix)),
      authCandidates: hints.authCandidates.filter((p) => p.startsWith(prefix)),
      designSystemCandidates: hints.designSystemCandidates.filter((p) => p.startsWith(prefix)),
      entryPoints: hints.entryPoints.filter((p) => p.startsWith(prefix)),
    };
    if (Object.values(wsHints).some((list) => list.length > 0)) ws.hints = wsHints;
  }
}

/**
 * Workspace names in dependency-first topological order (Kahn). On a cycle —
 * legal with npm devDependencies — the remaining nodes are appended in path
 * order, so the result is always complete and deterministic.
 *
 * Kept local (same algorithm the engine ports): the engine's embedded
 * `topoOrder` is keyed to its own package naming and, on a cycle, appends the
 * remainder in NAME order where reconstruct's contract is path order.
 */
export function topoOrderWorkspaces(workspaces: Workspace[]): string[] {
  const remaining = new Map(workspaces.map((w) => [w.name, new Set(w.dependsOn ?? [])]));
  const order: string[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining.entries()].filter(([, deps]) => [...deps].every((d) => !remaining.has(d))).map(([name]) => name);
    if (ready.length === 0) {
      // Cycle: fall back to path order for whatever is left.
      const leftover = workspaces.filter((w) => remaining.has(w.name)).map((w) => w.name);
      order.push(...leftover);
      break;
    }
    for (const name of ready.sort()) {
      order.push(name);
      remaining.delete(name);
    }
  }
  return order;
}
