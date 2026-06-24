import { existsSync, readdirSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join, posix } from "node:path";
import { detectStack } from "./stack.js";
import { readJsonManifest, safeRead } from "./manifest.js";
import { extractDependencies } from "../adapters/generic.js";
import type { FileInfo, Hints, RouteInfo, StackInfo, Workspace, WorkspaceKind } from "../types.js";

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

function addWorkspace(
  repo: string,
  relDir: string,
  found: Map<string, Workspace>,
  kind: WorkspaceKind,
  warnings?: string[],
): void {
  const norm = relDir.split("\\").join("/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (!norm || norm === "." || found.has(norm)) return;
  let name: string | null;
  if (kind === "cargo") {
    name = readCargoName(join(repo, norm));
  } else if (kind === "go") {
    name = readGoModule(join(repo, norm));
  } else if (existsSync(join(repo, norm, "package.json"))) {
    // A malformed member manifest still marks a workspace (the dir was declared
    // a member); it falls back to the path name and the warning surfaces it.
    const pkg = readJsonManifest(join(repo, norm, "package.json"), `${norm}/package.json`, warnings);
    name = pkg && typeof pkg.name === "string" && pkg.name ? pkg.name : "";
  } else if (kind === "nx" && existsSync(join(repo, norm, "project.json"))) {
    const proj = readJsonManifest(join(repo, norm, "project.json"), `${norm}/project.json`, warnings);
    name = proj && typeof proj.name === "string" && proj.name ? proj.name : "";
  } else {
    name = null;
  }
  if (name === null) return; // no manifest → not a workspace
  found.set(norm, { name: name || norm, path: norm, kind });
}

const WS_SKIP_DIRS = new Set([".git", "node_modules", ".turbo", "dist", "build", ".next"]);

/** Recursively collect package-bearing dirs under a `/**` glob base (depth-bounded). */
function collectWorkspacesRecursive(
  repo: string,
  relBase: string,
  found: Map<string, Workspace>,
  kind: WorkspaceKind,
  depth: number,
  warnings?: string[],
): void {
  if (depth > 5) return;
  let entries: Dirent[];
  try {
    entries = readdirSync(join(repo, relBase), { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (!ent.isDirectory() || WS_SKIP_DIRS.has(ent.name)) continue;
    const sub = relBase ? `${relBase}/${ent.name}` : ent.name;
    addWorkspace(repo, sub, found, kind, warnings);
    collectWorkspacesRecursive(repo, sub, found, kind, depth + 1, warnings);
  }
}

/** Expand one membership pattern (a literal dir, or a trailing `/*` / `/**` glob). */
function expandPattern(
  repo: string,
  raw: string,
  found: Map<string, Workspace>,
  kind: WorkspaceKind,
  warnings?: string[],
): void {
  const pat = raw.replace(/\/+$/, ""); // normalize a trailing slash
  if (pat.endsWith("/**")) {
    collectWorkspacesRecursive(repo, pat.slice(0, -3), found, kind, 0, warnings);
  } else if (pat.endsWith("/*")) {
    const base = pat.slice(0, -2);
    try {
      for (const ent of readdirSync(join(repo, base), { withFileTypes: true })) {
        if (ent.isDirectory()) addWorkspace(repo, join(base, ent.name), found, kind, warnings);
      }
    } catch {
      /* glob base missing */
    }
  } else {
    addWorkspace(repo, pat, found, kind, warnings);
  }
}

/** Minimal glob → anchored regex (`**` spans segments, `*` stays within one). */
function globToRegExp(pat: string): RegExp {
  let re = "";
  for (let i = 0; i < pat.length; i++) {
    const c = pat[i] as string;
    if (c === "*") {
      if (pat[i + 1] === "*") {
        re += ".*";
        i++;
        if (pat[i + 1] === "/") i++;
      } else {
        re += "[^/]*";
      }
    } else if ("\\^$.|?+()[]{}".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}($|/)`);
}

/** npm/yarn `workspaces` + pnpm-workspace.yaml patterns (positives and `!` negations). */
function npmFamilyPatterns(
  repo: string,
  warnings?: string[],
): {
  positives: Array<{ pattern: string; kind: WorkspaceKind }>;
  negations: string[];
} {
  const positives: Array<{ pattern: string; kind: WorkspaceKind }> = [];
  const negations: string[] = [];
  const push = (raw: string, kind: WorkspaceKind) => {
    const t = raw.trim();
    if (!t) return;
    if (t.startsWith("!")) negations.push(t.slice(1));
    else positives.push({ pattern: t, kind });
  };

  const pkg = readJsonManifest(join(repo, "package.json"), "package.json", warnings);
  if (pkg) {
    const ws = pkg.workspaces;
    if (Array.isArray(ws)) {
      for (const x of ws) if (typeof x === "string") push(x, "npm");
    } else if (ws && typeof ws === "object" && Array.isArray((ws as { packages?: unknown }).packages)) {
      for (const x of (ws as { packages: unknown[] }).packages) {
        if (typeof x === "string") push(x, "npm");
      }
    }
  }

  // pnpm-workspace.yaml: collect list items only under the top-level `packages:` key,
  // tolerating inline `# comments`.
  const pnpm = safeRead(join(repo, "pnpm-workspace.yaml"));
  let inPackages = false;
  for (const line of pnpm.split(/\r?\n/)) {
    if (/^\S/.test(line)) {
      inPackages = /^packages\s*:/.test(line);
      continue;
    }
    if (!inPackages) continue;
    const m = line.match(/^\s*-\s*['"]?([^'"#]+?)['"]?\s*(?:#.*)?$/);
    if (m) push((m[1] as string).trim(), "pnpm");
  }

  return { positives, negations };
}

/** lerna.json `packages` / nx.json layout — fallbacks when package.json declares none. */
function fallbackNpmPatterns(
  repo: string,
  warnings?: string[],
): Array<{ pattern: string; kind: WorkspaceKind }> {
  const lerna = readJsonManifest(join(repo, "lerna.json"), "lerna.json", warnings);
  if (lerna && Array.isArray(lerna.packages)) {
    return lerna.packages
      .filter((x): x is string => typeof x === "string")
      .map((pattern) => ({ pattern, kind: "lerna" as WorkspaceKind }));
  }
  const nx = readJsonManifest(join(repo, "nx.json"), "nx.json", warnings);
  if (nx) {
    const layout = (nx.workspaceLayout ?? {}) as Record<string, unknown>;
    const appsDir = typeof layout.appsDir === "string" ? layout.appsDir : "apps";
    const libsDir = typeof layout.libsDir === "string" ? layout.libsDir : "libs";
    return [...new Set([appsDir, libsDir])].map((dir) => ({
      pattern: `${dir}/*`,
      kind: "nx" as WorkspaceKind,
    }));
  }
  return [];
}

/** The body of a top-level `[section]` table, up to the next `[…]` header. */
function tomlSectionBody(toml: string, section: string): string | null {
  const re = new RegExp(`^\\[${section}\\]\\s*$([\\s\\S]*?)(?=^\\[|$(?![\\s\\S]))`, "m");
  const m = toml.match(re);
  return m ? (m[1] as string) : null;
}

/** A `key = [ "a", "b" ]` string array inside a TOML body (multiline-tolerant). */
function tomlStringArray(body: string, key: string): string[] {
  const m = body.match(new RegExp(`${key}\\s*=\\s*\\[([^\\]]*)\\]`));
  if (!m) return [];
  return (m[1] as string)
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, ""))
    .join("\n")
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/** Cargo workspaces: root `Cargo.toml` `[workspace] members` minus `exclude`. */
function detectCargoWorkspaces(repo: string, found: Map<string, Workspace>): void {
  const toml = safeRead(join(repo, "Cargo.toml"));
  if (!toml) return;
  const body = tomlSectionBody(toml, "workspace");
  if (!body) return;
  const members = tomlStringArray(body, "members");
  if (members.length === 0) return;
  const excludes = tomlStringArray(body, "exclude").map(globToRegExp);
  const candidates = new Map<string, Workspace>();
  for (const pat of members) expandPattern(repo, pat, candidates, "cargo");
  for (const ws of candidates.values()) {
    if (excludes.some((re) => re.test(ws.path))) continue;
    if (!found.has(ws.path)) found.set(ws.path, ws);
  }
}

/** Go workspaces: `go.work` `use` directives (single-line and block form). */
function detectGoWorkspaces(repo: string, found: Map<string, Workspace>): void {
  const gowork = safeRead(join(repo, "go.work"));
  if (!gowork) return;
  const dirs: string[] = [];
  // Block form: use ( ./a ./b ) — strip // comments per line.
  for (const block of gowork.matchAll(/^use\s*\(([\s\S]*?)\)/gm)) {
    for (const line of (block[1] as string).split(/\r?\n/)) {
      const t = line.replace(/\/\/.*$/, "").trim();
      if (t) dirs.push(t);
    }
  }
  // Single-line form: use ./tools
  for (const m of gowork.matchAll(/^use\s+([^\s(]+)/gm)) {
    dirs.push(m[1] as string);
  }
  for (const dir of dirs) {
    if (dir === "." || dir === "./") continue; // the root module is not a workspace entry
    addWorkspace(repo, dir, found, "go");
  }
}

/**
 * Detect monorepo workspaces across ecosystems: npm/yarn `workspaces`,
 * pnpm-workspace.yaml (incl. `!` negation patterns), lerna.json / nx.json as
 * fallbacks when package.json declares none, Cargo `[workspace] members`, and
 * go.work `use` directives. A trailing `/*` glob is expanded one directory
 * level, `/**` recursively. Returns [] for a single-package repo.
 */
export function detectWorkspaces(repo: string, warnings?: string[]): Workspace[] {
  const found = new Map<string, Workspace>();

  // JS/TS family: npm/yarn/pnpm declarations, else lerna/nx as fallback signals.
  const { positives, negations } = npmFamilyPatterns(repo, warnings);
  const npmPatterns = positives.length ? positives : fallbackNpmPatterns(repo, warnings);
  if (npmPatterns.length) {
    const candidates = new Map<string, Workspace>();
    for (const { pattern, kind } of npmPatterns)
      expandPattern(repo, pattern, candidates, kind, warnings);
    const negRes = negations.map(globToRegExp);
    for (const ws of candidates.values()) {
      if (negRes.some((re) => re.test(ws.path))) continue;
      found.set(ws.path, ws);
    }
  }

  // Other ecosystems (a polyglot monorepo unions them all).
  detectCargoWorkspaces(repo, found);
  detectGoWorkspaces(repo, found);

  return [...found.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/** A workspace-relative dep path resolved to a repo-relative POSIX path. */
function resolveDepPath(wsPath: string, rel: string): string {
  return posix.normalize(posix.join(wsPath, rel)).replace(/\/+$/, "");
}

/** Sibling-workspace edges declared in an npm-family manifest. */
function npmEdges(repo: string, ws: Workspace, byName: Set<string>, warnings?: string[]): string[] {
  const pkg = readJsonManifest(
    join(repo, ws.path, "package.json"),
    `${ws.path}/package.json`,
    warnings,
  );
  if (!pkg) return [];
  const edges = new Set<string>();
  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    const deps = pkg[field];
    if (!deps || typeof deps !== "object") continue;
    for (const dep of Object.keys(deps as Record<string, unknown>)) {
      if (dep !== ws.name && byName.has(dep)) edges.add(dep);
    }
  }
  return [...edges];
}

/** Sibling-workspace edges in a member's Cargo.toml (name or `path = "../x"` deps). */
function cargoEdges(repo: string, ws: Workspace, byName: Set<string>, byPath: Map<string, string>): string[] {
  const toml = safeRead(join(repo, ws.path, "Cargo.toml"));
  if (!toml) return [];
  const edges = new Set<string>();
  for (const section of ["dependencies", "dev-dependencies", "build-dependencies"]) {
    const body = tomlSectionBody(toml, section);
    if (!body) continue;
    for (const line of body.split(/\r?\n/)) {
      const kv = line.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
      if (!kv) continue;
      const dep = kv[1] as string;
      const value = kv[2] as string;
      if (dep !== ws.name && byName.has(dep)) {
        edges.add(dep);
        continue;
      }
      const pathDep = value.match(/path\s*=\s*["']([^"']+)["']/);
      if (pathDep) {
        const target = byPath.get(resolveDepPath(ws.path, pathDep[1] as string));
        if (target && target !== ws.name) edges.add(target);
      }
    }
  }
  return [...edges];
}

/** Sibling-workspace edges in a module's go.mod (require of a sibling, or replace => ../x). */
function goEdges(repo: string, ws: Workspace, byName: Set<string>, byPath: Map<string, string>): string[] {
  const gomod = safeRead(join(repo, ws.path, "go.mod"));
  if (!gomod) return [];
  const edges = new Set<string>();
  for (const m of gomod.matchAll(/^\s*(?:require\s+)?([^\s/(][^\s]*)\s+v[^\s]+/gm)) {
    const dep = m[1] as string;
    if (dep !== ws.name && byName.has(dep)) edges.add(dep);
  }
  for (const m of gomod.matchAll(/^\s*(?:replace\s+)?(\S+)(?:\s+\S+)?\s*=>\s*(\.\.?\/\S+)/gm)) {
    const target = byPath.get(resolveDepPath(ws.path, m[2] as string));
    if (target && target !== ws.name) edges.add(target);
  }
  return [...edges];
}

/**
 * Fill each workspace's `dependsOn` with the sibling workspaces its manifest
 * declares a dependency on. Edges come from manifests only; implicit coupling
 * is left to the agent.
 */
export function buildWorkspaceGraph(
  repo: string,
  workspaces: Workspace[],
  warnings?: string[],
): void {
  const byName = new Set(workspaces.map((w) => w.name));
  const byPath = new Map(workspaces.map((w) => [w.path, w.name]));
  for (const ws of workspaces) {
    const edges =
      ws.kind === "cargo"
        ? cargoEdges(repo, ws, byName, byPath)
        : ws.kind === "go"
          ? goEdges(repo, ws, byName, byPath)
          : npmEdges(repo, ws, byName, warnings);
    if (edges.length) ws.dependsOn = edges.sort();
  }
}

/**
 * First dependency cycle in the workspace graph (DFS over `dependsOn`, nodes
 * and edges visited in sorted order, so the result is deterministic). Returns
 * the cycle as a closed path (`["a", "b", "a"]`), or null. A cycle is legal —
 * npm devDependencies routinely create one — but the build order then falls
 * back to path order, which the agent should hear about, not discover.
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
export function workspaceMatcher(
  workspaces: Workspace[],
): (path: string) => Workspace | undefined {
  const byDepth = [...workspaces].sort((a, b) => b.path.length - a.path.length);
  return (path) => byDepth.find((ws) => path.startsWith(ws.path + "/"));
}

/**
 * First attribution phase — before route detection. Gives each workspace its
 * own stack and manifest dependencies by rebasing its files onto the workspace
 * dir, so detectStack/extractDependencies read the workspace's own manifests.
 */
export function enrichWorkspaceStacks(
  repo: string,
  workspaces: Workspace[],
  files: FileInfo[],
  warnings?: string[],
): void {
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
export function enrichWorkspaceSurface(
  workspaces: Workspace[],
  routes: RouteInfo[],
  hints: Hints,
  schemas: string[],
): void {
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
 */
export function topoOrderWorkspaces(workspaces: Workspace[]): string[] {
  const remaining = new Map(workspaces.map((w) => [w.name, new Set(w.dependsOn ?? [])]));
  const order: string[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining.entries()]
      .filter(([, deps]) => [...deps].every((d) => !remaining.has(d)))
      .map(([name]) => name);
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
