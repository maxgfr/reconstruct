import { readFileSync, existsSync, readdirSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join, posix } from "node:path";
import type { Workspace, WorkspaceKind } from "../types.js";

function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function safeRead(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

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
): void {
  const norm = relDir.split("\\").join("/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (!norm || norm === "." || found.has(norm)) return;
  let name: string | null;
  if (kind === "cargo") {
    name = readCargoName(join(repo, norm));
  } else if (kind === "go") {
    name = readGoModule(join(repo, norm));
  } else {
    const pkg = readJson(join(repo, norm, "package.json"));
    if (pkg) {
      name = typeof pkg.name === "string" && pkg.name ? pkg.name : "";
    } else if (kind === "nx" && existsSync(join(repo, norm, "project.json"))) {
      const proj = readJson(join(repo, norm, "project.json"));
      name = proj && typeof proj.name === "string" && proj.name ? proj.name : "";
    } else {
      name = null;
    }
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
    addWorkspace(repo, sub, found, kind);
    collectWorkspacesRecursive(repo, sub, found, kind, depth + 1);
  }
}

/** Expand one membership pattern (a literal dir, or a trailing `/*` / `/**` glob). */
function expandPattern(
  repo: string,
  raw: string,
  found: Map<string, Workspace>,
  kind: WorkspaceKind,
): void {
  const pat = raw.replace(/\/+$/, ""); // normalize a trailing slash
  if (pat.endsWith("/**")) {
    collectWorkspacesRecursive(repo, pat.slice(0, -3), found, kind, 0);
  } else if (pat.endsWith("/*")) {
    const base = pat.slice(0, -2);
    try {
      for (const ent of readdirSync(join(repo, base), { withFileTypes: true })) {
        if (ent.isDirectory()) addWorkspace(repo, join(base, ent.name), found, kind);
      }
    } catch {
      /* glob base missing */
    }
  } else {
    addWorkspace(repo, pat, found, kind);
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
function npmFamilyPatterns(repo: string): {
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

  const pkg = readJson(join(repo, "package.json"));
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
function fallbackNpmPatterns(repo: string): Array<{ pattern: string; kind: WorkspaceKind }> {
  const lerna = readJson(join(repo, "lerna.json"));
  if (lerna && Array.isArray(lerna.packages)) {
    return lerna.packages
      .filter((x): x is string => typeof x === "string")
      .map((pattern) => ({ pattern, kind: "lerna" as WorkspaceKind }));
  }
  const nx = readJson(join(repo, "nx.json"));
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
export function detectWorkspaces(repo: string): Workspace[] {
  const found = new Map<string, Workspace>();

  // JS/TS family: npm/yarn/pnpm declarations, else lerna/nx as fallback signals.
  const { positives, negations } = npmFamilyPatterns(repo);
  const npmPatterns = positives.length ? positives : fallbackNpmPatterns(repo);
  if (npmPatterns.length) {
    const candidates = new Map<string, Workspace>();
    for (const { pattern, kind } of npmPatterns) expandPattern(repo, pattern, candidates, kind);
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
function npmEdges(repo: string, ws: Workspace, byName: Set<string>): string[] {
  const pkg = readJson(join(repo, ws.path, "package.json"));
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
export function buildWorkspaceGraph(repo: string, workspaces: Workspace[]): void {
  const byName = new Set(workspaces.map((w) => w.name));
  const byPath = new Map(workspaces.map((w) => [w.path, w.name]));
  for (const ws of workspaces) {
    const edges =
      ws.kind === "cargo"
        ? cargoEdges(repo, ws, byName, byPath)
        : ws.kind === "go"
          ? goEdges(repo, ws, byName, byPath)
          : npmEdges(repo, ws, byName);
    if (edges.length) ws.dependsOn = edges.sort();
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
