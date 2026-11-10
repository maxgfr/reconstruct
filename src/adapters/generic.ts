import { join } from "node:path";
import { readJsonManifest } from "../detect/manifest.js";
import { cachedRead } from "../read-cache.js";
import type { DependencyInfo, FileInfo } from "../types.js";
import { cmp, lineAt } from "./util.js";

function read(repo: string, rel: string): string | null {
  return cachedRead(join(repo, rel));
}

function asStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = typeof v === "string" ? v : "";
  }
  return out;
}

// Root `requirements.txt`, `requirements-dev.txt`, `requirements_test.txt`,
// `dev-requirements.txt`…, and every `requirements/<name>.txt`.
const REQUIREMENTS_ROOT_RE = /^(?:[\w.-]+[-_])?requirements(?:[-_.][\w.-]+)?\.txt$/i;
const REQUIREMENTS_DIR_RE = /^requirements\/[^/]+\.txt$/i;

/**
 * A PEP 508 requirement (`uvicorn[standard] >=0.20 ; python_version > "3.8"`)
 * as [name, version spec]; `; marker` is an environment marker, not part of the
 * version. Null for options (`-r base.txt`, `-e .`) and URLs.
 */
function parseRequirement(spec: string): [string, string] | null {
  const t = spec.split(";")[0]?.trim() ?? "";
  if (!t) return null;
  const m = t.match(/^([A-Za-z0-9_.-]+)\s*(?:\[[^\]]*\])?\s*([<>=!~]+.*)?$/);
  return m ? [m[1] as string, (m[2] ?? "").trim()] : null;
}

export function extractDependencies(repo: string, files: FileInfo[], warnings?: string[], labelBase = ""): DependencyInfo[] {
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

  // pip / requirements files: the root `requirements.txt`, its root siblings
  // (`requirements-dev.txt`, `test-requirements.txt`…) and the split
  // `requirements/*.txt` layout. A file whose name says dev/test is dev-only.
  const requirementFiles = [...present]
    .filter((p) => REQUIREMENTS_ROOT_RE.test(p) || REQUIREMENTS_DIR_RE.test(p))
    .sort((a, b) => (a === "requirements.txt" ? -1 : b === "requirements.txt" ? 1 : cmp(a, b)));
  for (const manifest of requirementFiles) {
    const deps: Record<string, string> = {};
    for (const line of (read(repo, manifest) ?? "").split(/\r?\n/)) {
      // pip: a comment starts at a `#` preceded by whitespace.
      const req = parseRequirement(line.replace(/(^|\s)#.*$/, ""));
      if (req) deps[req[0]] = req[1];
    }
    const isDev = /dev|test/i.test(manifest.split("/").pop() as string);
    result.push({ manager: "pip", manifest, runtime: isDev ? {} : deps, dev: isDev ? deps : {} });
  }

  // pip / pyproject.toml: PEP 621 `[project] dependencies` (+ optional
  // dependencies and PEP 735 `[dependency-groups]` as dev) and Poetry's
  // `[tool.poetry.dependencies]` (+ its groups / legacy dev-dependencies).
  if (present.has("pyproject.toml")) {
    const raw = read(repo, "pyproject.toml") ?? "";
    const runtime: Record<string, string> = {};
    const dev: Record<string, string> = {};
    const addAll = (target: Record<string, string>, specs: string[]) => {
      for (const spec of specs) {
        const req = parseRequirement(spec);
        if (req) target[req[0]] = req[1];
      }
    };
    const project = tomlSectionBody(raw, "project");
    if (project !== null) addAll(runtime, tomlStringArray(project, "dependencies"));
    for (const table of ["project.optional-dependencies", "dependency-groups"]) {
      const body = tomlSectionBody(raw, table);
      if (body === null) continue;
      for (const key of body.matchAll(/^[ \t]*([A-Za-z0-9_.-]+)\s*=\s*\[/gm)) addAll(dev, tomlStringArray(body, key[1] as string));
    }
    Object.assign(runtime, poetryDeps(raw, "tool.poetry.dependencies"));
    Object.assign(dev, poetryDeps(raw, "tool.poetry.dev-dependencies"));
    for (const g of raw.matchAll(/^\[tool\.poetry\.group\.([\w-]+)\.dependencies\][ \t]*$/gm)) {
      Object.assign(dev, poetryDeps(raw, `tool.poetry.group.${g[1] as string}.dependencies`));
    }
    delete runtime.python;
    if (Object.keys(runtime).length || Object.keys(dev).length) result.push({ manager: "pip", manifest: "pyproject.toml", runtime, dev });
  }

  // pip / Pipfile (pipenv): `[packages]` and `[dev-packages]`.
  if (present.has("Pipfile")) {
    const raw = read(repo, "Pipfile") ?? "";
    result.push({ manager: "pip", manifest: "Pipfile", runtime: poetryDeps(raw, "packages"), dev: poetryDeps(raw, "dev-packages") });
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
    const add = (line: string): void => {
      const m = line.trim().match(/^([^\s]+)\s+(v[^\s]+)/);
      if (m) runtime[m[1] as string] = m[2] as string;
    };
    // Every `require ( … )` block AND every single-line `require path vX` —
    // `go mod tidy` writes several blocks (direct, then `// indirect`), and a
    // one-dependency module uses the single-line form. `replace`/`exclude`
    // directives are not requirements.
    for (const block of raw.matchAll(/^[ \t]*require[ \t]*\(([\s\S]*?)\)/gm)) for (const line of (block[1] as string).split(/\r?\n/)) add(line);
    for (const single of raw.matchAll(/^[ \t]*require[ \t]+([^\s(].*)$/gm)) add(single[1] as string);
    result.push({ manager: "go modules", manifest: "go.mod", runtime, dev: {} });
  }

  // composer / composer.json
  if (present.has("composer.json")) {
    const composer = readJsonManifest(join(repo, "composer.json"), labelBase + "composer.json", warnings);
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
    // A stack of open blocks, each recording whether it is dev: `group … do`
    // sets it, any other block (`platforms :mri do`, `source … do`, `if …`)
    // inherits its parent's, and `end` pops only the innermost one.
    const blocks: boolean[] = [];
    const inDev = (): boolean => blocks[blocks.length - 1] ?? false;
    for (const line of raw.split(/\r?\n/)) {
      const t = line.replace(/(^|\s)#.*$/, "").trim();
      const g = t.match(/^group\s+(.+?)\s+do\b/);
      if (g) {
        blocks.push(inDev() || /:(?:development|test)\b/.test(g[1] as string));
        continue;
      }
      if (/^end\b/.test(t)) {
        blocks.pop();
        continue;
      }
      const m = t.match(/^gem\s+["']([^"']+)["']\s*(?:,\s*["']([^"']+)["'])?/);
      if (m) (inDev() ? dev : runtime)[m[1] as string] = (m[2] ?? "").trim();
      else if (/\bdo(?:\s*\|[^|]*\|)?$/.test(t) || /^(?:if|unless|case|begin)\b/.test(t)) blocks.push(inDev());
    }
    result.push({ manager: "bundler", manifest: "Gemfile", runtime, dev });
  }

  // maven / pom.xml
  if (present.has("pom.xml")) {
    const raw = read(repo, "pom.xml") ?? "";
    const runtime: Record<string, string> = {};
    const dev: Record<string, string> = {};
    const field = (block: string, tag: string): string | undefined => block.match(new RegExp(`<${tag}>\\s*([^<]+?)\\s*</${tag}>`))?.[1];
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

/**
 * The body of the TOML table `[section]` (up to the next table header), or null
 * when absent. The header must stand on its own line, so `[project]` does not
 * match `[project.urls]`, nor a `[project]` inside a string.
 */
function tomlSectionBody(toml: string, section: string): string | null {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = toml.match(new RegExp(`^\\[${escaped}\\][ \\t]*(?:#.*)?$([\\s\\S]*?)(?=^[ \\t]*\\[|(?![\\s\\S]))`, "m"));
  return m ? (m[1] as string) : null;
}

/**
 * The string items of the array `key = [ … ]` in a table body (multi-line,
 * trailing comma allowed). Non-string items such as PEP 735's
 * `{ include-group = "dev" }` are skipped.
 */
function tomlStringArray(body: string, key: string): string[] {
  const head = body.match(new RegExp(`^[ \\t]*${key.replace(/[.-]/g, "\\$&")}\\s*=\\s*\\[`, "m"));
  if (!head) return [];
  const out: string[] = [];
  let depth = 1;
  for (let i = (head.index ?? 0) + head[0].length; i < body.length && depth > 0; i++) {
    const c = body[i];
    if (c === '"' || c === "'") {
      const close = body.indexOf(c, i + 1);
      if (close === -1) break;
      if (depth === 1) out.push(body.slice(i + 1, close));
      i = close;
    } else if (c === "#") {
      const nl = body.indexOf("\n", i);
      i = nl === -1 ? body.length : nl;
    } else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") depth--;
  }
  return out;
}

/**
 * `name = "spec"` / `name = { version = "spec", … }` entries of a Poetry or
 * Pipfile table; the any-version `"*"` is recorded as unpinned (`""`).
 */
function poetryDeps(toml: string, section: string): Record<string, string> {
  const out: Record<string, string> = {};
  const body = tomlSectionBody(toml, section);
  if (body === null) return out;
  for (const line of body.split(/\r?\n/)) {
    const kv = line.trim().match(/^["']?([A-Za-z0-9_.-]+)["']?\s*=\s*(.+)$/);
    if (!kv) continue;
    const value = (kv[2] as string).trim();
    const spec = value.startsWith("{") ? (value.match(/\bversion\s*=\s*["']([^"']*)["']/)?.[1] ?? "") : (value.match(/^["']([^"']*)["']/)?.[1] ?? "");
    out[kv[1] as string] = spec === "*" ? "" : spec;
  }
  return out;
}

function parseTomlSection(toml: string, section: string): Record<string, string> {
  const out: Record<string, string> = {};
  const body = tomlSectionBody(toml, section);
  if (body === null) return out;
  for (const line of body.split(/\r?\n/)) {
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
  return Object.keys(extractEnvVarSources(repo, files)).sort();
}

/** Every env var name with the first place it was seen (file + 1-based line). */
export function extractEnvVarSources(repo: string, files: FileInfo[]): Record<string, { file: string; line: number }> {
  const names = new Map<string, { file: string; line: number }>();
  const note = (name: string, file: string, line: number) => {
    if (!names.has(name)) names.set(name, { file, line });
  };

  // From .env* files: keys only, never values.
  for (const f of files) {
    if (!f.path.split("/").pop()?.startsWith(".env")) continue;
    const raw = read(repo, f.path) ?? "";
    raw.split(/\r?\n/).forEach((line, i) => {
      const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/);
      if (m) note(m[1] as string, f.path, i + 1);
    });
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
      for (const m of raw.matchAll(re)) note(m[1] as string, f.path, lineAt(raw, m.index ?? 0));
    }
  }

  return Object.fromEntries([...names.entries()].sort(([a], [b]) => cmp(a, b)));
}

export function collectByCategory(files: FileInfo[], category: string): string[] {
  return files.filter((f) => f.category === category).map((f) => f.path);
}
