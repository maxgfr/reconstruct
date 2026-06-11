import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readJsonManifest } from "../detect/manifest.js";
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

export function extractDependencies(
  repo: string,
  files: FileInfo[],
  warnings?: string[],
  labelBase = "",
): DependencyInfo[] {
  const result: DependencyInfo[] = [];
  const present = new Set(files.map((f) => f.path));

  // npm / package.json
  if (present.has("package.json")) {
    const pkg = readJsonManifest(join(repo, "package.json"), labelBase + "package.json", warnings);
    if (pkg) {
      result.push({
        manager: "npm",
        manifest: "package.json",
        runtime: asStringMap(pkg.dependencies),
        dev: asStringMap(pkg.devDependencies),
      });
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

  // pub / pubspec.yaml (Dart / Flutter)
  if (present.has("pubspec.yaml")) {
    const raw = read(repo, "pubspec.yaml") ?? "";
    result.push({
      manager: "pub",
      manifest: "pubspec.yaml",
      runtime: parseYamlDeps(raw, "dependencies"),
      dev: parseYamlDeps(raw, "dev_dependencies"),
    });
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
    const composer = readJsonManifest(
      join(repo, "composer.json"),
      labelBase + "composer.json",
      warnings,
    );
    if (composer) {
      result.push({
        manager: "composer",
        manifest: "composer.json",
        runtime: asStringMap(composer.require),
        dev: asStringMap(composer["require-dev"]),
      });
    }
  }

  // bundler / Gemfile
  if (present.has("Gemfile")) {
    const raw = read(repo, "Gemfile") ?? "";
    const runtime: Record<string, string> = {};
    const dev: Record<string, string> = {};
    let inDev = false;
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      const g = t.match(/^group\s+(.+?)\s+do\b/);
      if (g) {
        inDev = /:(?:development|test)\b/.test(g[1] as string);
        continue;
      }
      if (/^end\b/.test(t)) {
        inDev = false;
        continue;
      }
      const m = t.match(/^gem\s+["']([^"']+)["']\s*(?:,\s*["']([^"']+)["'])?/);
      if (m) (inDev ? dev : runtime)[m[1] as string] = (m[2] ?? "").trim();
    }
    result.push({ manager: "bundler", manifest: "Gemfile", runtime, dev });
  }

  // maven / pom.xml
  if (present.has("pom.xml")) {
    const raw = read(repo, "pom.xml") ?? "";
    const runtime: Record<string, string> = {};
    const dev: Record<string, string> = {};
    const field = (block: string, tag: string): string | undefined =>
      block.match(new RegExp(`<${tag}>\\s*([^<]+?)\\s*</${tag}>`))?.[1];
    for (const m of raw.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
      const block = m[1] as string;
      const gid = field(block, "groupId");
      const aid = field(block, "artifactId");
      if (!gid || !aid) continue;
      const scope = field(block, "scope") ?? "";
      const target = scope === "test" || scope === "provided" ? dev : runtime;
      target[`${gid}:${aid}`] = field(block, "version") ?? "";
    }
    result.push({ manager: "maven", manifest: "pom.xml", runtime, dev });
  }

  // gradle / build.gradle(.kts)
  const GRADLE_CONFIG =
    /^(?:test|android|functional)?(?:implementation|api|compileOnly|runtimeOnly|annotationProcessor|kapt|ksp|developmentOnly|providedRuntime|classpath)$/i;
  for (const manifest of ["build.gradle", "build.gradle.kts"]) {
    if (!present.has(manifest)) continue;
    const raw = read(repo, manifest) ?? "";
    const runtime: Record<string, string> = {};
    const dev: Record<string, string> = {};
    for (const m of raw.matchAll(/(\w+)\s*[(\s]\s*["']([^"'\s]+:[^"'\s]+)["']/g)) {
      const config = m[1] as string;
      const coord = m[2] as string;
      if (!GRADLE_CONFIG.test(config) || coord.includes("/")) continue;
      const parts = coord.split(":");
      const key = parts.length >= 2 ? `${parts[0]}:${parts[1]}` : coord;
      const ver = parts.length >= 3 ? (parts[2] as string) : "";
      const isDev = /^(?:test|android|functional)/i.test(config);
      (isDev ? dev : runtime)[key] = ver;
    }
    result.push({ manager: "gradle", manifest, runtime, dev });
    break;
  }

  return result;
}

/**
 * Dependencies under a top-level `dependencies:` / `dev_dependencies:` key in a
 * pubspec.yaml. Collects the immediate `name: version` children (2-space indent),
 * stopping at the next top-level key. A child with no inline value (e.g. `flutter:`
 * with a nested `sdk: flutter`) is recorded with an empty version.
 */
function parseYamlDeps(yaml: string, section: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = yaml.split(/\r?\n/);
  let inSection = false;
  for (const line of lines) {
    if (/^\S/.test(line)) {
      inSection = new RegExp(`^${section}\\s*:`).test(line);
      continue;
    }
    if (!inSection) continue;
    const m = line.match(/^\s{2}([\w.-]+)\s*:\s*(["']?[\d.^<>=~\s+*]*["']?)\s*(?:#.*)?$/);
    if (m) out[m[1] as string] = (m[2] as string).replace(/["']/g, "").trim();
  }
  return out;
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

export function extractScripts(repo: string, warnings?: string[]): Record<string, string> {
  const pkg = readJsonManifest(join(repo, "package.json"), "package.json", warnings);
  return pkg ? asStringMap(pkg.scripts) : {};
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
