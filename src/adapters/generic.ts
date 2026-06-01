import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DependencyInfo, FileInfo } from "../types.js";

function read(repo: string, rel: string): string | null {
  try {
    return readFileSync(join(repo, rel), "utf8");
  } catch {
    return null;
  }
}

function asStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = typeof v === "string" ? v : "";
  }
  return out;
}

export function extractDependencies(repo: string, files: FileInfo[]): DependencyInfo[] {
  const result: DependencyInfo[] = [];
  const present = new Set(files.map((f) => f.path));

  // npm / package.json
  if (present.has("package.json")) {
    const raw = read(repo, "package.json");
    if (raw) {
      try {
        const pkg = JSON.parse(raw) as Record<string, unknown>;
        result.push({
          manager: "npm",
          manifest: "package.json",
          runtime: asStringMap(pkg.dependencies),
          dev: asStringMap(pkg.devDependencies),
        });
      } catch {
        /* ignore malformed */
      }
    }
  }

  // pip / requirements.txt
  if (present.has("requirements.txt")) {
    const raw = read(repo, "requirements.txt") ?? "";
    const runtime: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const m = t.match(/^([A-Za-z0-9_.-]+)\s*([<>=!~]+.*)?$/);
      if (m) runtime[m[1] as string] = (m[2] ?? "").trim();
    }
    result.push({ manager: "pip", manifest: "requirements.txt", runtime, dev: {} });
  }

  // cargo / Cargo.toml
  if (present.has("Cargo.toml")) {
    const raw = read(repo, "Cargo.toml") ?? "";
    result.push({
      manager: "cargo",
      manifest: "Cargo.toml",
      runtime: parseTomlSection(raw, "dependencies"),
      dev: parseTomlSection(raw, "dev-dependencies"),
    });
  }

  // go modules / go.mod
  if (present.has("go.mod")) {
    const raw = read(repo, "go.mod") ?? "";
    const runtime: Record<string, string> = {};
    const block = raw.match(/require\s*\(([\s\S]*?)\)/);
    const lines = block ? (block[1] as string).split(/\r?\n/) : raw.split(/\r?\n/);
    for (const line of lines) {
      const m = line.trim().match(/^([^\s]+)\s+(v[^\s]+)/);
      if (m) runtime[m[1] as string] = m[2] as string;
    }
    result.push({ manager: "go modules", manifest: "go.mod", runtime, dev: {} });
  }

  // composer / composer.json
  if (present.has("composer.json")) {
    const raw = read(repo, "composer.json");
    if (raw) {
      try {
        const composer = JSON.parse(raw) as Record<string, unknown>;
        result.push({
          manager: "composer",
          manifest: "composer.json",
          runtime: asStringMap(composer.require),
          dev: asStringMap(composer["require-dev"]),
        });
      } catch {
        /* ignore */
      }
    }
  }

  return result;
}

function parseTomlSection(toml: string, section: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = new RegExp(`\\[${section}\\]([\\s\\S]*?)(\\n\\[|$)`);
  const m = toml.match(re);
  if (!m) return out;
  for (const line of (m[1] as string).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const kv = t.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (kv) out[kv[1] as string] = (kv[2] as string).replace(/["']/g, "").trim();
  }
  return out;
}

export function extractScripts(repo: string): Record<string, string> {
  const raw = read(repo, "package.json");
  if (!raw) return {};
  try {
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    return asStringMap(pkg.scripts);
  } catch {
    return {};
  }
}

export function extractEnvVars(repo: string, files: FileInfo[]): string[] {
  const names = new Set<string>();

  // From .env* files: keys only, never values.
  for (const f of files) {
    if (!f.path.split("/").pop()?.startsWith(".env")) continue;
    const raw = read(repo, f.path) ?? "";
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/);
      if (m) names.add(m[1] as string);
    }
  }

  // From source: process.env.X, import.meta.env.X, os.environ["X"].
  // All code/config files are scanned — the file set is already bounded by the
  // walk's ignore rules, so there is no silent truncation cap here.
  const patterns = [
    /process\.env\.([A-Z][A-Z0-9_]*)/g,
    /import\.meta\.env\.([A-Z][A-Z0-9_]*)/g,
    // Python: os.environ["X"], os.environ.get("X"), os.getenv("X").
    /os\.(?:environ(?:\.get)?|getenv)\s*[[(]\s*["']([A-Z][A-Z0-9_]*)["']/g,
  ];
  for (const f of files) {
    if (f.binary || (f.category !== "code" && f.category !== "config")) continue;
    const raw = read(repo, f.path);
    if (!raw) continue;
    for (const re of patterns) {
      for (const m of raw.matchAll(re)) names.add(m[1] as string);
    }
  }

  return [...names].sort();
}

export function collectByCategory(files: FileInfo[], category: string): string[] {
  return files.filter((f) => f.category === category).map((f) => f.path);
}
