#!/usr/bin/env node

// src/cli.ts
import { resolve as resolve2, join as join16 } from "path";
import { pathToFileURL, fileURLToPath } from "url";
import { existsSync as existsSync8, statSync as statSync3, realpathSync } from "fs";

// src/analyze.ts
import { basename as basename3 } from "path";

// src/walk.ts
import { closeSync, openSync, readSync, readdirSync, readFileSync, statSync } from "fs";
import { join, relative, extname, basename, resolve } from "path";
var DEFAULT_IGNORE_DIRS = /* @__PURE__ */ new Set([
  ".git",
  "node_modules",
  ".next",
  ".nuxt",
  ".svelte-kit",
  "dist",
  "build",
  "out",
  "coverage",
  ".turbo",
  ".vercel",
  ".cache",
  "vendor",
  "target",
  "__pycache__",
  ".venv",
  "venv",
  ".idea",
  ".vscode",
  "reconstruction"
]);
var DEFAULT_IGNORE_FILES = /* @__PURE__ */ new Set([
  ".DS_Store",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "bun.lock",
  "Cargo.lock",
  "poetry.lock",
  "Gemfile.lock",
  "composer.lock",
  "pubspec.lock"
]);
var BINARY_EXTS = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".ico",
  ".bmp",
  ".tiff",
  ".pdf",
  ".zip",
  ".gz",
  ".tar",
  ".rar",
  ".7z",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".webm",
  ".wasm",
  ".so",
  ".dylib",
  ".dll",
  ".exe",
  ".bin",
  ".class",
  ".jar",
  ".pyc",
  ".node"
]);
var CODE_EXTS = /* @__PURE__ */ new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".vue",
  ".svelte",
  ".astro",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".kts",
  ".php",
  ".c",
  ".cc",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".swift",
  ".scala",
  ".clj",
  ".ex",
  ".exs",
  ".dart",
  ".lua",
  ".sh",
  ".bash",
  ".zig",
  ".elm"
]);
var STYLE_EXTS = /* @__PURE__ */ new Set([".css", ".scss", ".sass", ".less", ".styl", ".pcss"]);
var DOC_EXTS = /* @__PURE__ */ new Set([".md", ".mdx", ".rst", ".adoc", ".txt"]);
var DATA_EXTS = /* @__PURE__ */ new Set([".json", ".yaml", ".yml", ".toml", ".csv", ".xml", ".env"]);
var ASSET_EXTS = BINARY_EXTS;
function compilePattern(raw) {
  let pat = raw.trim();
  if (!pat || pat.startsWith("#")) return null;
  let negate = false;
  if (pat.startsWith("!")) {
    negate = true;
    pat = pat.slice(1);
  }
  let dirOnly = false;
  if (pat.endsWith("/")) {
    dirOnly = true;
    pat = pat.slice(0, -1);
  }
  const anchored = pat.startsWith("/");
  if (anchored) pat = pat.slice(1);
  pat = pat.replace(/\*{3,}/g, "**").replace(/(?:\*\*\/)+(?=\*\*)/g, "");
  let re = "";
  for (let i = 0; i < pat.length; i++) {
    const c = pat[i];
    if (c === "*") {
      if (pat[i + 1] === "*") {
        re += ".*";
        i++;
        if (pat[i + 1] === "/") i++;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if ("\\^$.|+()[]{}".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  const prefix = anchored ? "^" : "(^|/)";
  return { re: new RegExp(prefix + re + "($|/)"), negate, dirOnly };
}
function loadIgnore(repo) {
  const patterns = [];
  try {
    const content = readFileSync(join(repo, ".gitignore"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const compiled = compilePattern(line);
      if (compiled) patterns.push(compiled);
    }
  } catch {
  }
  return (relPath, isDir) => {
    let ignored = false;
    for (const p of patterns) {
      if (p.dirOnly && !isDir) continue;
      if (p.re.test(relPath)) ignored = !p.negate;
    }
    return ignored;
  };
}
function isReconstructOutput(dir) {
  try {
    const head = readFileSync(join(dir, "inventory.json"), "utf8").slice(0, 4096);
    return /"generatedWith"\s*:\s*"reconstruct@/.test(head);
  } catch {
    return false;
  }
}
var SNIFF_BYTES = 8192;
function isProbablyBinary(abs, ext) {
  if (BINARY_EXTS.has(ext)) return true;
  let fd = -1;
  try {
    fd = openSync(abs, "r");
    const buf = Buffer.allocUnsafe(SNIFF_BYTES);
    const read2 = readSync(fd, buf, 0, SNIFF_BYTES, 0);
    for (let i = 0; i < read2; i++) {
      if (buf[i] === 0) return true;
    }
    return false;
  } catch {
    return true;
  } finally {
    if (fd >= 0) {
      try {
        closeSync(fd);
      } catch {
      }
    }
  }
}
function categorize(relPath, ext) {
  const lower = relPath.toLowerCase();
  const base = basename(lower);
  const segments = lower.split("/");
  const inDir2 = (...names) => names.some((n) => segments.includes(n));
  if (inDir2("locales", "locale", "i18n", "lang", "langs", "translations", "messages") && (ext === ".json" || ext === ".yaml" || ext === ".yml" || ext === ".po" || ext === ".properties")) {
    return "i18n";
  }
  if (ext === ".prisma" || ext === ".sql" || ext === ".graphql" || ext === ".gql" || base.startsWith("schema.") || base === "models.py" || inDir2("migrations", "entities", "models")) {
    return "schema";
  }
  if (lower.includes(".test.") || lower.includes(".spec.") || inDir2("__tests__", "test", "tests", "spec", "e2e", "__mocks__")) {
    return "test";
  }
  if (base === "package.json" || base === "tsconfig.json" || base.endsWith(".config.js") || base.endsWith(".config.ts") || base.endsWith(".config.mjs") || base.startsWith(".eslintrc") || base.startsWith(".prettierrc") || base.startsWith(".env") || base === "dockerfile" || base.startsWith("docker-compose") || base === "vite.config.ts" || base === "next.config.js" || base === "next.config.mjs" || base === "tailwind.config.js" || base === "tailwind.config.ts" || base === "pyproject.toml" || base === "cargo.toml" || base === "go.mod" || base === "requirements.txt" || base === "gemfile" || base === "composer.json" || base === "pubspec.yaml" || base === "makefile") {
    return "config";
  }
  if (DOC_EXTS.has(ext)) return "doc";
  if (STYLE_EXTS.has(ext)) return "style";
  if (CODE_EXTS.has(ext)) return "code";
  if (ASSET_EXTS.has(ext)) return "asset";
  if (DATA_EXTS.has(ext)) return "data";
  return "other";
}
var MAX_COUNT_LINES_BYTES = 8 * 1024 * 1024;
function countLines(abs, size) {
  if (size > MAX_COUNT_LINES_BYTES) return 0;
  try {
    const content = readFileSync(abs, "utf8");
    if (content.length === 0) return 0;
    let n = 1;
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) === 10) n++;
    }
    return n;
  } catch {
    return 0;
  }
}
function compileGlobs(patterns) {
  if (!patterns) return [];
  const out = [];
  for (const raw of patterns) {
    const c = compilePattern(raw);
    if (c && !c.negate) out.push(c);
  }
  return out;
}
function walk(repo, opts = {}) {
  const ignore = loadIgnore(repo);
  const includePats = compileGlobs(opts.include);
  const excludePats = compileGlobs(opts.exclude);
  const outAbs = opts.out ? resolve(opts.out) : "";
  const files = [];
  let excludedCount = 0;
  const recurse = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      const rel = relative(repo, abs).split("\\").join("/");
      const isDir = entry.isDirectory();
      let isFile = entry.isFile();
      if (entry.isSymbolicLink()) {
        let targetIsFile = false;
        try {
          targetIsFile = statSync(abs).isFile();
        } catch {
        }
        if (!targetIsFile) {
          excludedCount++;
          continue;
        }
        isFile = true;
      }
      if (isDir && outAbs && resolve(abs) === outAbs) continue;
      if (isDir && isReconstructOutput(abs)) continue;
      if (isDir && DEFAULT_IGNORE_DIRS.has(entry.name)) continue;
      if (ignore(rel, isDir)) {
        if (!isDir) excludedCount++;
        continue;
      }
      if (isDir) {
        if (excludePats.some((p) => p.re.test(rel))) continue;
        recurse(abs);
        continue;
      }
      if (!isFile) continue;
      if (DEFAULT_IGNORE_FILES.has(entry.name)) {
        excludedCount++;
        continue;
      }
      if (excludePats.some((p) => !p.dirOnly && p.re.test(rel))) {
        excludedCount++;
        continue;
      }
      if (includePats.length > 0 && !includePats.some((p) => p.re.test(rel))) {
        excludedCount++;
        continue;
      }
      const ext = extname(entry.name).toLowerCase();
      let size = 0;
      try {
        size = statSync(abs).size;
      } catch {
        continue;
      }
      const binary = isProbablyBinary(abs, ext);
      files.push({
        path: rel,
        ext,
        size,
        lines: binary ? 0 : countLines(abs, size),
        category: categorize(rel, ext),
        binary
      });
    }
  };
  recurse(repo);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, excludedCount };
}

// src/detect/stack.ts
import { existsSync as existsSync2 } from "fs";
import { join as join4 } from "path";

// src/detect/manifest.ts
import { readFileSync as readFileSync2 } from "fs";
function readJsonManifest(absPath, relLabel, warnings) {
  let raw;
  try {
    raw = readFileSync2(absPath, "utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    const reason = String(e.message ?? e).split("\n")[0];
    warnings?.push(`malformed ${relLabel}: ${reason} \u2014 falling back to empty defaults`);
    return null;
  }
}
function safeRead(path) {
  try {
    return readFileSync2(path, "utf8");
  } catch {
    return "";
  }
}

// src/detect/workspaces.ts
import { existsSync, readdirSync as readdirSync2 } from "fs";
import { join as join3, posix } from "path";

// src/adapters/generic.ts
import { readFileSync as readFileSync3 } from "fs";
import { join as join2 } from "path";
function read(repo, rel) {
  try {
    return readFileSync3(join2(repo, rel), "utf8");
  } catch {
    return null;
  }
}
function asStringMap(value) {
  if (!value || typeof value !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = typeof v === "string" ? v : "";
  }
  return out;
}
function extractDependencies(repo, files, warnings, labelBase = "") {
  const result = [];
  const present = new Set(files.map((f) => f.path));
  if (present.has("package.json")) {
    const pkg = readJsonManifest(join2(repo, "package.json"), labelBase + "package.json", warnings);
    if (pkg) {
      result.push({
        manager: "npm",
        manifest: "package.json",
        runtime: asStringMap(pkg.dependencies),
        dev: asStringMap(pkg.devDependencies)
      });
    }
  }
  if (present.has("requirements.txt")) {
    const raw = read(repo, "requirements.txt") ?? "";
    const runtime = {};
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const m = t.match(/^([A-Za-z0-9_.-]+)\s*([<>=!~]+.*)?$/);
      if (m) runtime[m[1]] = (m[2] ?? "").trim();
    }
    result.push({ manager: "pip", manifest: "requirements.txt", runtime, dev: {} });
  }
  if (present.has("pubspec.yaml")) {
    const raw = read(repo, "pubspec.yaml") ?? "";
    result.push({
      manager: "pub",
      manifest: "pubspec.yaml",
      runtime: parseYamlDeps(raw, "dependencies"),
      dev: parseYamlDeps(raw, "dev_dependencies")
    });
  }
  if (present.has("Cargo.toml")) {
    const raw = read(repo, "Cargo.toml") ?? "";
    result.push({
      manager: "cargo",
      manifest: "Cargo.toml",
      runtime: parseTomlSection(raw, "dependencies"),
      dev: parseTomlSection(raw, "dev-dependencies")
    });
  }
  if (present.has("go.mod")) {
    const raw = read(repo, "go.mod") ?? "";
    const runtime = {};
    const block = raw.match(/require\s*\(([\s\S]*?)\)/);
    const lines = block ? block[1].split(/\r?\n/) : raw.split(/\r?\n/);
    for (const line of lines) {
      const m = line.trim().match(/^([^\s]+)\s+(v[^\s]+)/);
      if (m) runtime[m[1]] = m[2];
    }
    result.push({ manager: "go modules", manifest: "go.mod", runtime, dev: {} });
  }
  if (present.has("composer.json")) {
    const composer = readJsonManifest(join2(repo, "composer.json"), labelBase + "composer.json", warnings);
    if (composer) {
      result.push({
        manager: "composer",
        manifest: "composer.json",
        runtime: asStringMap(composer.require),
        dev: asStringMap(composer["require-dev"])
      });
    }
  }
  if (present.has("Gemfile")) {
    const raw = read(repo, "Gemfile") ?? "";
    const runtime = {};
    const dev = {};
    let inDev = false;
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      const g = t.match(/^group\s+(.+?)\s+do\b/);
      if (g) {
        inDev = /:(?:development|test)\b/.test(g[1]);
        continue;
      }
      if (/^end\b/.test(t)) {
        inDev = false;
        continue;
      }
      const m = t.match(/^gem\s+["']([^"']+)["']\s*(?:,\s*["']([^"']+)["'])?/);
      if (m) (inDev ? dev : runtime)[m[1]] = (m[2] ?? "").trim();
    }
    result.push({ manager: "bundler", manifest: "Gemfile", runtime, dev });
  }
  if (present.has("pom.xml")) {
    const raw = read(repo, "pom.xml") ?? "";
    const runtime = {};
    const dev = {};
    const field = (block, tag) => block.match(new RegExp(`<${tag}>\\s*([^<]+?)\\s*</${tag}>`))?.[1];
    for (const m of raw.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
      const block = m[1];
      const gid = field(block, "groupId");
      const aid = field(block, "artifactId");
      if (!gid || !aid) continue;
      const scope = field(block, "scope") ?? "";
      const target = scope === "test" || scope === "provided" ? dev : runtime;
      target[`${gid}:${aid}`] = field(block, "version") ?? "";
    }
    result.push({ manager: "maven", manifest: "pom.xml", runtime, dev });
  }
  const GRADLE_CONFIG = /^(?:test|android|functional)?(?:implementation|api|compileOnly|runtimeOnly|annotationProcessor|kapt|ksp|developmentOnly|providedRuntime|classpath)$/i;
  for (const manifest of ["build.gradle", "build.gradle.kts"]) {
    if (!present.has(manifest)) continue;
    const raw = read(repo, manifest) ?? "";
    const runtime = {};
    const dev = {};
    for (const m of raw.matchAll(/(\w+)\s*[(\s]\s*["']([^"'\s]+:[^"'\s]+)["']/g)) {
      const config = m[1];
      const coord = m[2];
      if (!GRADLE_CONFIG.test(config) || coord.includes("/")) continue;
      const parts = coord.split(":");
      const key = parts.length >= 2 ? `${parts[0]}:${parts[1]}` : coord;
      const ver = parts.length >= 3 ? parts[2] : "";
      const isDev = /^(?:test|android|functional)/i.test(config);
      (isDev ? dev : runtime)[key] = ver;
    }
    result.push({ manager: "gradle", manifest, runtime, dev });
    break;
  }
  return result;
}
function parseYamlDeps(yaml, section) {
  const out = {};
  const lines = yaml.split(/\r?\n/);
  let inSection = false;
  for (const line of lines) {
    if (/^\S/.test(line)) {
      inSection = new RegExp(`^${section}\\s*:`).test(line);
      continue;
    }
    if (!inSection) continue;
    const m = line.match(/^\s{2}([\w.-]+)\s*:\s*(["']?[\d.^<>=~\s+*]*["']?)\s*(?:#.*)?$/);
    if (m) out[m[1]] = m[2].replace(/["']/g, "").trim();
  }
  return out;
}
function parseTomlSection(toml, section) {
  const out = {};
  const re = new RegExp(`\\[${section}\\]([\\s\\S]*?)(\\n\\[|$)`);
  const m = toml.match(re);
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const kv = t.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (kv) out[kv[1]] = kv[2].replace(/["']/g, "").trim();
  }
  return out;
}
function extractScripts(repo, warnings) {
  const pkg = readJsonManifest(join2(repo, "package.json"), "package.json", warnings);
  return pkg ? asStringMap(pkg.scripts) : {};
}
function extractEnvVars(repo, files) {
  const names = /* @__PURE__ */ new Set();
  for (const f of files) {
    if (!f.path.split("/").pop()?.startsWith(".env")) continue;
    const raw = read(repo, f.path) ?? "";
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/);
      if (m) names.add(m[1]);
    }
  }
  const patterns = [
    /process\.env\.([A-Z][A-Z0-9_]*)/g,
    /import\.meta\.env\.([A-Z][A-Z0-9_]*)/g,
    // Python: os.environ["X"], os.environ.get("X"), os.getenv("X").
    /os\.(?:environ(?:\.get)?|getenv)\s*[[(]\s*["']([A-Z][A-Z0-9_]*)["']/g
  ];
  for (const f of files) {
    if (f.binary || f.category !== "code" && f.category !== "config") continue;
    const raw = read(repo, f.path);
    if (!raw) continue;
    for (const re of patterns) {
      for (const m of raw.matchAll(re)) names.add(m[1]);
    }
  }
  return [...names].sort();
}
function collectByCategory(files, category) {
  return files.filter((f) => f.category === category).map((f) => f.path);
}

// src/detect/workspaces.ts
function readCargoName(dir) {
  const toml = safeRead(join3(dir, "Cargo.toml"));
  if (!toml) return null;
  const pkg = tomlSectionBody(toml, "package");
  const m = pkg?.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
  return m ? m[1] : "";
}
function readGoModule(dir) {
  const gomod = safeRead(join3(dir, "go.mod"));
  if (!gomod) return null;
  const m = gomod.match(/^module\s+(\S+)/m);
  return m ? m[1] : "";
}
function addWorkspace(repo, relDir, found, kind, warnings) {
  const norm = relDir.split("\\").join("/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (!norm || norm === "." || found.has(norm)) return;
  let name;
  if (kind === "cargo") {
    name = readCargoName(join3(repo, norm));
  } else if (kind === "go") {
    name = readGoModule(join3(repo, norm));
  } else if (existsSync(join3(repo, norm, "package.json"))) {
    const pkg = readJsonManifest(join3(repo, norm, "package.json"), `${norm}/package.json`, warnings);
    name = pkg && typeof pkg.name === "string" && pkg.name ? pkg.name : "";
  } else if (kind === "nx" && existsSync(join3(repo, norm, "project.json"))) {
    const proj = readJsonManifest(join3(repo, norm, "project.json"), `${norm}/project.json`, warnings);
    name = proj && typeof proj.name === "string" && proj.name ? proj.name : "";
  } else {
    name = null;
  }
  if (name === null) return;
  found.set(norm, { name: name || norm, path: norm, kind });
}
var WS_SKIP_DIRS = /* @__PURE__ */ new Set([".git", "node_modules", ".turbo", "dist", "build", ".next"]);
function collectWorkspacesRecursive(repo, relBase, found, kind, depth, warnings) {
  if (depth > 5) return;
  let entries;
  try {
    entries = readdirSync2(join3(repo, relBase), { withFileTypes: true });
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
function expandPattern(repo, raw, found, kind, warnings) {
  const pat = raw.replace(/\/+$/, "");
  if (pat.endsWith("/**")) {
    collectWorkspacesRecursive(repo, pat.slice(0, -3), found, kind, 0, warnings);
  } else if (pat.endsWith("/*")) {
    const base = pat.slice(0, -2);
    try {
      for (const ent of readdirSync2(join3(repo, base), { withFileTypes: true })) {
        if (ent.isDirectory()) addWorkspace(repo, join3(base, ent.name), found, kind, warnings);
      }
    } catch {
    }
  } else {
    addWorkspace(repo, pat, found, kind, warnings);
  }
}
function globToRegExp(pat) {
  let re = "";
  for (let i = 0; i < pat.length; i++) {
    const c = pat[i];
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
function npmFamilyPatterns(repo, warnings) {
  const positives = [];
  const negations = [];
  const push = (raw, kind) => {
    const t = raw.trim();
    if (!t) return;
    if (t.startsWith("!")) negations.push(t.slice(1));
    else positives.push({ pattern: t, kind });
  };
  const pkg = readJsonManifest(join3(repo, "package.json"), "package.json", warnings);
  if (pkg) {
    const ws = pkg.workspaces;
    if (Array.isArray(ws)) {
      for (const x of ws) if (typeof x === "string") push(x, "npm");
    } else if (ws && typeof ws === "object" && Array.isArray(ws.packages)) {
      for (const x of ws.packages) {
        if (typeof x === "string") push(x, "npm");
      }
    }
  }
  const pnpm = safeRead(join3(repo, "pnpm-workspace.yaml"));
  let inPackages = false;
  for (const line of pnpm.split(/\r?\n/)) {
    if (/^\S/.test(line)) {
      inPackages = /^packages\s*:/.test(line);
      continue;
    }
    if (!inPackages) continue;
    const m = line.match(/^\s*-\s*['"]?([^'"#]+?)['"]?\s*(?:#.*)?$/);
    if (m) push(m[1].trim(), "pnpm");
  }
  return { positives, negations };
}
function fallbackNpmPatterns(repo, warnings) {
  const lerna = readJsonManifest(join3(repo, "lerna.json"), "lerna.json", warnings);
  if (lerna && Array.isArray(lerna.packages)) {
    return lerna.packages.filter((x) => typeof x === "string").map((pattern) => ({ pattern, kind: "lerna" }));
  }
  const nx = readJsonManifest(join3(repo, "nx.json"), "nx.json", warnings);
  if (nx) {
    const layout = nx.workspaceLayout ?? {};
    const appsDir = typeof layout.appsDir === "string" ? layout.appsDir : "apps";
    const libsDir = typeof layout.libsDir === "string" ? layout.libsDir : "libs";
    return [.../* @__PURE__ */ new Set([appsDir, libsDir])].map((dir) => ({
      pattern: `${dir}/*`,
      kind: "nx"
    }));
  }
  return [];
}
function tomlSectionBody(toml, section) {
  const re = new RegExp(`^\\[${section}\\]\\s*$([\\s\\S]*?)(?=^\\[|$(?![\\s\\S]))`, "m");
  const m = toml.match(re);
  return m ? m[1] : null;
}
function tomlStringArray(body, key) {
  const m = body.match(new RegExp(`${key}\\s*=\\s*\\[([^\\]]*)\\]`));
  if (!m) return [];
  return m[1].split(/\r?\n/).map((line) => line.replace(/#.*$/, "")).join("\n").split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
}
function detectCargoWorkspaces(repo, found) {
  const toml = safeRead(join3(repo, "Cargo.toml"));
  if (!toml) return;
  const body = tomlSectionBody(toml, "workspace");
  if (!body) return;
  const members = tomlStringArray(body, "members");
  if (members.length === 0) return;
  const excludes = tomlStringArray(body, "exclude").map(globToRegExp);
  const candidates = /* @__PURE__ */ new Map();
  for (const pat of members) expandPattern(repo, pat, candidates, "cargo");
  for (const ws of candidates.values()) {
    if (excludes.some((re) => re.test(ws.path))) continue;
    if (!found.has(ws.path)) found.set(ws.path, ws);
  }
}
function detectGoWorkspaces(repo, found) {
  const gowork = safeRead(join3(repo, "go.work"));
  if (!gowork) return;
  const dirs = [];
  for (const block of gowork.matchAll(/^use\s*\(([\s\S]*?)\)/gm)) {
    for (const line of block[1].split(/\r?\n/)) {
      const t = line.replace(/\/\/.*$/, "").trim();
      if (t) dirs.push(t);
    }
  }
  for (const m of gowork.matchAll(/^use\s+([^\s(]+)/gm)) {
    dirs.push(m[1]);
  }
  for (const dir of dirs) {
    if (dir === "." || dir === "./") continue;
    addWorkspace(repo, dir, found, "go");
  }
}
function detectWorkspaces(repo, warnings) {
  const found = /* @__PURE__ */ new Map();
  const { positives, negations } = npmFamilyPatterns(repo, warnings);
  const npmPatterns = positives.length ? positives : fallbackNpmPatterns(repo, warnings);
  if (npmPatterns.length) {
    const candidates = /* @__PURE__ */ new Map();
    for (const { pattern, kind } of npmPatterns) expandPattern(repo, pattern, candidates, kind, warnings);
    const negRes = negations.map(globToRegExp);
    for (const ws of candidates.values()) {
      if (negRes.some((re) => re.test(ws.path))) continue;
      found.set(ws.path, ws);
    }
  }
  detectCargoWorkspaces(repo, found);
  detectGoWorkspaces(repo, found);
  return [...found.values()].sort((a, b) => a.path.localeCompare(b.path));
}
function resolveDepPath(wsPath, rel) {
  return posix.normalize(posix.join(wsPath, rel)).replace(/\/+$/, "");
}
function npmEdges(repo, ws, byName, warnings) {
  const pkg = readJsonManifest(join3(repo, ws.path, "package.json"), `${ws.path}/package.json`, warnings);
  if (!pkg) return [];
  const edges = /* @__PURE__ */ new Set();
  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    const deps = pkg[field];
    if (!deps || typeof deps !== "object") continue;
    for (const dep of Object.keys(deps)) {
      if (dep !== ws.name && byName.has(dep)) edges.add(dep);
    }
  }
  return [...edges];
}
function cargoEdges(repo, ws, byName, byPath) {
  const toml = safeRead(join3(repo, ws.path, "Cargo.toml"));
  if (!toml) return [];
  const edges = /* @__PURE__ */ new Set();
  for (const section of ["dependencies", "dev-dependencies", "build-dependencies"]) {
    const body = tomlSectionBody(toml, section);
    if (!body) continue;
    for (const line of body.split(/\r?\n/)) {
      const kv = line.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
      if (!kv) continue;
      const dep = kv[1];
      const value = kv[2];
      if (dep !== ws.name && byName.has(dep)) {
        edges.add(dep);
        continue;
      }
      const pathDep = value.match(/path\s*=\s*["']([^"']+)["']/);
      if (pathDep) {
        const target = byPath.get(resolveDepPath(ws.path, pathDep[1]));
        if (target && target !== ws.name) edges.add(target);
      }
    }
  }
  return [...edges];
}
function goEdges(repo, ws, byName, byPath) {
  const gomod = safeRead(join3(repo, ws.path, "go.mod"));
  if (!gomod) return [];
  const edges = /* @__PURE__ */ new Set();
  for (const m of gomod.matchAll(/^\s*(?:require\s+)?([^\s/(][^\s]*)\s+v[^\s]+/gm)) {
    const dep = m[1];
    if (dep !== ws.name && byName.has(dep)) edges.add(dep);
  }
  for (const m of gomod.matchAll(/^\s*(?:replace\s+)?(\S+)(?:\s+\S+)?\s*=>\s*(\.\.?\/\S+)/gm)) {
    const target = byPath.get(resolveDepPath(ws.path, m[2]));
    if (target && target !== ws.name) edges.add(target);
  }
  return [...edges];
}
function buildWorkspaceGraph(repo, workspaces, warnings) {
  const byName = new Set(workspaces.map((w) => w.name));
  const byPath = new Map(workspaces.map((w) => [w.path, w.name]));
  for (const ws of workspaces) {
    const edges = ws.kind === "cargo" ? cargoEdges(repo, ws, byName, byPath) : ws.kind === "go" ? goEdges(repo, ws, byName, byPath) : npmEdges(repo, ws, byName, warnings);
    if (edges.length) ws.dependsOn = edges.sort();
  }
}
function findWorkspaceCycle(workspaces) {
  const deps = new Map(workspaces.map((w) => [w.name, [...w.dependsOn ?? []].sort()]));
  const state = /* @__PURE__ */ new Map();
  const stack = [];
  const visit = (name) => {
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
function workspaceMatcher(workspaces) {
  const byDepth = [...workspaces].sort((a, b) => b.path.length - a.path.length);
  return (path) => byDepth.find((ws) => path.startsWith(ws.path + "/"));
}
function enrichWorkspaceStacks(repo, workspaces, files, warnings) {
  const matcher = workspaceMatcher(workspaces);
  const filesByWs = /* @__PURE__ */ new Map();
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
    ws.stack = detectStack(join3(repo, ws.path), rebased, warnings, prefix);
    const deps = extractDependencies(join3(repo, ws.path), rebased, warnings, prefix);
    if (deps.length) {
      ws.dependencies = deps.map((d) => ({ ...d, manifest: prefix + d.manifest }));
    }
  }
}
function mergeWorkspaceStacks(stack, workspaces) {
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
    packageManagers: [...packageManagers]
  };
}
function enrichWorkspaceSurface(workspaces, routes, hints, schemas) {
  const matcher = workspaceMatcher(workspaces);
  const routeCounts = /* @__PURE__ */ new Map();
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
    const wsHints = {
      routeCandidates: hints.routeCandidates.filter((p) => p.startsWith(prefix)),
      apiCandidates: hints.apiCandidates.filter((p) => p.startsWith(prefix)),
      schemaCandidates: hints.schemaCandidates.filter((p) => p.startsWith(prefix)),
      realtimeCandidates: hints.realtimeCandidates.filter((p) => p.startsWith(prefix)),
      authCandidates: hints.authCandidates.filter((p) => p.startsWith(prefix)),
      designSystemCandidates: hints.designSystemCandidates.filter((p) => p.startsWith(prefix)),
      entryPoints: hints.entryPoints.filter((p) => p.startsWith(prefix))
    };
    if (Object.values(wsHints).some((list) => list.length > 0)) ws.hints = wsHints;
  }
}
function topoOrderWorkspaces(workspaces) {
  const remaining = new Map(workspaces.map((w) => [w.name, new Set(w.dependsOn ?? [])]));
  const order = [];
  while (remaining.size > 0) {
    const ready = [...remaining.entries()].filter(([, deps]) => [...deps].every((d) => !remaining.has(d))).map(([name]) => name);
    if (ready.length === 0) {
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

// src/detect/stack.ts
var EXT_LANGUAGE = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".mts": "TypeScript",
  ".cts": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".astro": "Astro",
  ".py": "Python",
  ".rb": "Ruby",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".kt": "Kotlin",
  ".php": "PHP",
  ".c": "C",
  ".cc": "C++",
  ".cpp": "C++",
  ".cs": "C#",
  ".swift": "Swift",
  ".scala": "Scala",
  ".dart": "Dart",
  ".ex": "Elixir",
  ".exs": "Elixir",
  ".lua": "Lua"
};
var NPM_FRAMEWORKS = [
  ["next", "Next.js"],
  ["nuxt", "Nuxt"],
  ["@remix-run/react", "Remix"],
  ["react-router-dom", "React Router"],
  ["@sveltejs/kit", "SvelteKit"],
  ["astro", "Astro"],
  ["@angular/core", "Angular"],
  ["@nestjs/core", "NestJS"],
  ["express", "Express"],
  ["fastify", "Fastify"],
  ["koa", "Koa"],
  ["@hono/node-server", "Hono"],
  ["hono", "Hono"],
  ["@solidjs/start", "SolidStart"],
  ["solid-start", "SolidStart"],
  ["react", "React"],
  ["vue", "Vue"],
  ["svelte", "Svelte"],
  ["solid-js", "SolidJS"],
  // Build tooling / runtimes / shells
  ["vite", "Vite"],
  ["expo", "Expo"],
  ["react-native", "React Native"],
  ["electron", "Electron"],
  ["@tauri-apps/api", "Tauri"],
  ["@tauri-apps/cli", "Tauri"]
];
var UI_FRAMEWORK_LABELS = /* @__PURE__ */ new Set([
  "Next.js",
  "Nuxt",
  "Remix",
  "React Router",
  "SvelteKit",
  "Astro",
  "Angular",
  "SolidStart",
  "React",
  "Vue",
  "Svelte",
  "SolidJS",
  "Expo",
  "React Native",
  "Electron",
  "Tauri",
  "Flutter"
]);
var NPM_STYLING_LIBRARIES = [
  ["tailwindcss", "Tailwind CSS"],
  ["styled-components", "styled-components"],
  ["@emotion/react", "Emotion"],
  ["@mui/material", "MUI"],
  ["@chakra-ui/react", "Chakra UI"],
  ["@radix-ui/", "Radix UI"],
  ["@mantine/core", "Mantine"],
  ["bootstrap", "Bootstrap"],
  ["unocss", "UnoCSS"],
  ["@unocss/", "UnoCSS"],
  ["@pandacss/dev", "Panda CSS"],
  ["@vanilla-extract/css", "vanilla-extract"]
];
var STYLING_LIBRARY_LABELS = new Set(NPM_STYLING_LIBRARIES.map(([, label]) => label));
var NPM_LIBRARIES = [
  // ORM / database
  ["drizzle-orm", "Drizzle ORM"],
  ["@prisma/client", "Prisma"],
  ["prisma", "Prisma"],
  ["typeorm", "TypeORM"],
  ["sequelize", "Sequelize"],
  ["mongoose", "Mongoose"],
  ["kysely", "Kysely"],
  ["@supabase/supabase-js", "Supabase"],
  // Auth
  ["next-auth", "NextAuth.js"],
  ["@auth/core", "Auth.js"],
  ["@clerk/nextjs", "Clerk"],
  ["lucia", "Lucia"],
  ["passport", "Passport"],
  // API / data fetching layer
  ["@trpc/", "tRPC"],
  ["@tanstack/react-query", "TanStack Query"],
  ["react-query", "TanStack Query"],
  ["@apollo/client", "Apollo GraphQL"],
  ["graphql", "GraphQL"],
  ["swr", "SWR"],
  // Styling / UI (the design-system signal — see NPM_STYLING_LIBRARIES above)
  ...NPM_STYLING_LIBRARIES,
  // State management
  ["@reduxjs/toolkit", "Redux Toolkit"],
  ["redux", "Redux"],
  ["zustand", "Zustand"],
  ["jotai", "Jotai"],
  ["recoil", "Recoil"],
  ["mobx", "MobX"],
  // Validation / forms
  ["zod", "Zod"],
  ["yup", "Yup"],
  ["valibot", "Valibot"],
  ["react-hook-form", "React Hook Form"],
  ["formik", "Formik"],
  // Testing
  ["vitest", "Vitest"],
  ["jest", "Jest"],
  ["@playwright/test", "Playwright"],
  ["playwright", "Playwright"],
  ["cypress", "Cypress"],
  ["@testing-library/react", "Testing Library"],
  // i18n
  ["next-intl", "next-intl"],
  ["i18next", "i18next"],
  ["react-i18next", "react-i18next"],
  // Services / analytics / email
  ["posthog-js", "PostHog"],
  ["@sentry/", "Sentry"],
  ["resend", "Resend"],
  ["nodemailer", "Nodemailer"],
  ["stripe", "Stripe"],
  ["@aws-sdk/", "AWS SDK"]
];
var GO_FRAMEWORKS = [
  [/github\.com\/gin-gonic\/gin/, "Gin"],
  [/github\.com\/labstack\/echo/, "Echo"],
  [/github\.com\/gofiber\/fiber/, "Fiber"],
  [/github\.com\/go-chi\/chi/, "chi"],
  [/github\.com\/gorilla\/mux/, "Gorilla"]
];
function detectLibraries(deps) {
  const names = Object.keys(deps);
  const found = /* @__PURE__ */ new Set();
  for (const [pattern, label] of NPM_LIBRARIES) {
    const hit = pattern.endsWith("/") ? names.some((n) => n.startsWith(pattern)) : pattern in deps;
    if (hit) found.add(label);
  }
  return [...found];
}
function detectStack(repo, files, warnings, labelBase = "") {
  const counts = /* @__PURE__ */ new Map();
  for (const f of files) {
    const lang = EXT_LANGUAGE[f.ext];
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  const languages = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([lang]) => lang);
  const frameworks = /* @__PURE__ */ new Set();
  const packageManagers = /* @__PURE__ */ new Set();
  let libraries = [];
  let hasTypeScript = files.some((f) => EXT_LANGUAGE[f.ext] === "TypeScript");
  const hasPkg = existsSync2(join4(repo, "package.json"));
  const pkg = readJsonManifest(join4(repo, "package.json"), labelBase + "package.json", warnings);
  if (pkg) {
    const allDeps = {
      ...pkg.dependencies ?? {},
      ...pkg.devDependencies ?? {}
    };
    for (const [dep, label] of NPM_FRAMEWORKS) {
      if (dep in allDeps) frameworks.add(label);
    }
    libraries = detectLibraries(allDeps);
    if ("typescript" in allDeps) hasTypeScript = true;
  }
  const hasJsManifest = hasPkg || ["pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock", "package-lock.json"].some((f) => existsSync2(join4(repo, f)));
  if (hasJsManifest) {
    if (existsSync2(join4(repo, "pnpm-lock.yaml"))) packageManagers.add("pnpm");
    else if (existsSync2(join4(repo, "yarn.lock"))) packageManagers.add("yarn");
    else if (existsSync2(join4(repo, "bun.lockb")) || existsSync2(join4(repo, "bun.lock"))) packageManagers.add("bun");
    else packageManagers.add("npm");
  }
  if (existsSync2(join4(repo, "requirements.txt")) || existsSync2(join4(repo, "pyproject.toml"))) {
    packageManagers.add("pip");
    const py = safeRead(join4(repo, "requirements.txt")) + safeRead(join4(repo, "pyproject.toml"));
    if (/\bdjango\b/i.test(py)) frameworks.add("Django");
    if (/\bflask\b/i.test(py)) frameworks.add("Flask");
    if (/\bfastapi\b/i.test(py)) frameworks.add("FastAPI");
  }
  if (existsSync2(join4(repo, "pubspec.yaml"))) {
    packageManagers.add("pub");
    const pubspec = safeRead(join4(repo, "pubspec.yaml"));
    if (/^\s*flutter\s*:/m.test(pubspec) || /sdk:\s*flutter/.test(pubspec)) {
      frameworks.add("Flutter");
    }
  }
  if (existsSync2(join4(repo, "Cargo.toml"))) packageManagers.add("cargo");
  if (existsSync2(join4(repo, "go.mod"))) {
    packageManagers.add("go modules");
    const gomod = safeRead(join4(repo, "go.mod"));
    for (const [pattern, label] of GO_FRAMEWORKS) {
      if (pattern.test(gomod)) frameworks.add(label);
    }
  }
  if (existsSync2(join4(repo, "Gemfile"))) {
    packageManagers.add("bundler");
    if (/\brails\b/i.test(safeRead(join4(repo, "Gemfile")))) frameworks.add("Ruby on Rails");
    if (/\bsinatra\b/i.test(safeRead(join4(repo, "Gemfile")))) frameworks.add("Sinatra");
  }
  if (existsSync2(join4(repo, "composer.json"))) {
    packageManagers.add("composer");
    const composer = safeRead(join4(repo, "composer.json"));
    if (/laravel\/framework/.test(composer)) frameworks.add("Laravel");
    if (/symfony\/framework-bundle/.test(composer)) frameworks.add("Symfony");
  }
  if (existsSync2(join4(repo, "pom.xml"))) {
    packageManagers.add("maven");
    if (/spring-boot/.test(safeRead(join4(repo, "pom.xml")))) frameworks.add("Spring Boot");
  }
  for (const gradle of ["build.gradle", "build.gradle.kts"]) {
    if (existsSync2(join4(repo, gradle))) {
      packageManagers.add("gradle");
      if (/spring-boot/.test(safeRead(join4(repo, gradle)))) frameworks.add("Spring Boot");
    }
  }
  return {
    languages,
    primaryLanguage: languages[0] ?? "Unknown",
    frameworks: [...frameworks],
    libraries,
    packageManagers: [...packageManagers],
    hasTypeScript
  };
}
function detectNodeVersion(repo, warnings) {
  const pkg = readJsonManifest(join4(repo, "package.json"), "package.json", warnings);
  const engines = pkg?.engines;
  if (engines && typeof engines === "object") {
    const node = engines.node;
    if (typeof node === "string") return node;
  }
  return void 0;
}

// src/detect/candidates.ts
import { readFileSync as readFileSync4 } from "fs";
import { join as join5 } from "path";
var CONTENT_SCAN_EXTS = /* @__PURE__ */ new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rb",
  ".go",
  ".java",
  ".kt",
  ".php",
  ".rs",
  ".cs",
  ".ex",
  ".exs",
  ".graphql",
  ".gql",
  ".proto"
]);
var ROUTE_DIRS = ["routes", "controllers", "handlers", "endpoints", "views", "pages", "api"];
var API_DIRS = ["trpc", "resolvers", "graphql"];
var SCHEMA_DIRS = ["models", "entities", "migrations"];
var ROUTE_FILE_RE = /^(page|route|layout|template|default|\+page|\+server|\+layout)\.[jt]sx?$/;
var ROUTE_FILE_NAMES = /* @__PURE__ */ new Set(["routes.rb"]);
var ROUTE_CONTENT_RE = new RegExp(
  [
    // method-call routers (JS/TS/Go/Python): app.get(, router.post(, r.GET(, bp.put(
    String.raw`\b(?:app|router|route|api|blueprint|fastify|server|mux|r|bp|blp)\.(?:get|post|put|patch|delete|all|use|route|handle|handlefunc)\s*\(`,
    // any receiver registering a net/http handler: mux.HandleFunc(, http.Handle(
    String.raw`\.handle(?:func)?\s*\(`,
    // decorator frameworks: Spring (@GetMapping/@RequestMapping/@Controller), NestJS
    String.raw`@(?:Get|Post|Put|Patch|Delete|Controller|RequestMapping|(?:Get|Post|Put|Delete|Patch)Mapping)\b`,
    // Python decorator routes: @app.route, @bp.get, @router.post …
    String.raw`@(?:app|router|blueprint|api|bp|blp)\.(?:route|get|post|put|delete|patch)\b`,
    // Laravel: Route::get(, Route::resource(, Route::group(
    String.raw`Route::(?:get|post|put|patch|delete|resource|apiResource|group|match|any)\b`,
    // Flask functional / class-based / flask-restful registration
    String.raw`\.add_url_rule\s*\(`,
    String.raw`\badd_resource\s*\(`,
    String.raw`\bclass\s+\w+\s*\(\s*(?:\w+\.)?(?:Resource|MethodView)\b`,
    String.raw`=\s*Blueprint\s*\(`,
    // Django: urlpatterns table, re_path(, DRF router.register(/DefaultRouter
    String.raw`\burlpatterns\b`,
    String.raw`\bre_path\s*\(`,
    String.raw`routers\.(?:Default|Simple)Router\b`,
    String.raw`\.register\s*\(\s*r?["']`,
    // Rails DSL (covers config/routes.rb and any drawn routes file)
    String.raw`Rails\.application\.routes\.draw\b`,
    // Rust: axum Router::new().route(, actix web::resource/scope/get(
    String.raw`Router::new\b`,
    String.raw`\.route\s*\(`,
    String.raw`web::(?:resource|scope|get|post|put|delete|patch)\s*\(`
  ].join("|"),
  "i"
);
var API_CONTENT_RE = /createTRPCRouter|initTRPC|publicProcedure|protectedProcedure|t\.router\(|\btype\s+Query\b|\btype\s+Mutation\b|buildSchema\(|new\s+GraphQLSchema|makeExecutableSchema|@Resolver\b|gql`|grpc\.|registerService/;
var REALTIME_CONTENT_RE = new RegExp(
  [
    String.raw`@WebSocketGateway|@SubscribeMessage`,
    // NestJS gateways
    String.raw`new\s+WebSocketServer|new\s+WebSocket\.Server`,
    // ws
    String.raw`socket\.io|\bio\.on\(\s*["']connection`,
    String.raw`\bwebsocket\s*:\s*true`,
    // fastify route option
    String.raw`upgradeWebSocket`,
    // hono
    String.raw`@\w+\.websocket\b|websockets\.serve|WebsocketConsumer`,
    // FastAPI / websockets / Django Channels
    String.raw`ActionCable|ApplicationCable`,
    // rails
    String.raw`text/event-stream`
    // SSE
  ].join("|")
);
var AUTH_CONTENT_RE = new RegExp(
  [
    String.raw`@UseGuards|\bpassport\.`,
    // NestJS / Express
    String.raw`app\.use\(\s*\w*[aA]uth`,
    // app.use(auth...), app.use(requireAuth...)
    String.raw`\brequireAuth\b|\bwithAuth\b|\bverifyToken\b|\bjwt\.(?:sign|verify)\b`,
    String.raw`getServerSession|getToken\(`,
    // next-auth
    String.raw`\bpreHandler\b`,
    // fastify hook (often auth)
    String.raw`@login_required|@permission_required|@permission_classes|permission_classes\s*=`,
    // Django/Flask
    String.raw`\bbefore_request\b`,
    // flask middleware
    String.raw`HTTPBearer|OAuth2PasswordBearer`,
    // FastAPI security
    String.raw`before_action\s+:authenticate|authenticate_user!`,
    // rails
    String.raw`\[Authorize|@PreAuthorize|@Secured\b`
    // ASP.NET / Spring
  ].join("|")
);
var SCHEMA_CONTENT_RE = /pgTable\(|mysqlTable\(|sqliteTable\(|@Entity\(|@PrimaryGeneratedColumn|new\s+Schema\(|mongoose\.model\(|sequelize\.define\(|extends\s+Model\b|models\.Model\b|create_table\b|add_column\b|CREATE\s+TABLE\b|^[ \t]*model[ \t]+\w+[ \t]*\{/im;
var DS_FILE_NAMES = /* @__PURE__ */ new Set([
  "tailwind.config.js",
  "tailwind.config.ts",
  "tailwind.config.cjs",
  "tailwind.config.mjs",
  "panda.config.ts",
  "panda.config.js",
  "panda.config.mjs",
  "uno.config.ts",
  "uno.config.js",
  "unocss.config.ts",
  "unocss.config.js",
  "theme.ts",
  "theme.tsx",
  "theme.js",
  "tokens.ts",
  "tokens.js",
  "tokens.json",
  "design-tokens.ts",
  "design-tokens.js",
  "design-tokens.json",
  "globals.css",
  "global.css",
  "app.css",
  "index.css",
  "styles.css",
  "tokens.css",
  "theme.css",
  "components.json"
  // shadcn/ui
]);
var DS_STYLE_EXTS = /* @__PURE__ */ new Set([".css", ".scss", ".sass", ".less", ".styl", ".pcss"]);
var DS_CSS_RE = /--[\w-]+\s*:|@theme\b|@layer\s+base\b|:root\s*\{/;
var MAX_CONTENT_SCAN_BYTES = 2e6;
function segmentsOf(path) {
  return path.toLowerCase().split("/");
}
function inDir(path, names) {
  const segs = segmentsOf(path);
  return names.some((n) => segs.includes(n));
}
function baseName(path) {
  return path.split("/").pop() ?? "";
}
function safeRead2(repo, rel) {
  try {
    return readFileSync4(join5(repo, rel), "utf8");
  } catch {
    return "";
  }
}
function detectCandidates(repo, files, stack) {
  void stack;
  const routeCandidates = /* @__PURE__ */ new Set();
  const apiCandidates = /* @__PURE__ */ new Set();
  const schemaCandidates = /* @__PURE__ */ new Set();
  const realtimeCandidates = /* @__PURE__ */ new Set();
  const authCandidates = /* @__PURE__ */ new Set();
  const designSystemCandidates = /* @__PURE__ */ new Set();
  for (const f of files) {
    if (f.binary || f.size === 0) continue;
    const p = f.path;
    const lower = p.toLowerCase();
    const base = baseName(lower);
    const ext = f.ext;
    if (inDir(lower, ROUTE_DIRS) || ROUTE_FILE_RE.test(base) || ROUTE_FILE_NAMES.has(base)) {
      routeCandidates.add(p);
    }
    if (ext === ".graphql" || ext === ".gql" || ext === ".proto") apiCandidates.add(p);
    if ((ext === ".json" || ext === ".yaml" || ext === ".yml") && /openapi|swagger/.test(base)) {
      apiCandidates.add(p);
    }
    if (inDir(lower, API_DIRS)) apiCandidates.add(p);
    if (f.category === "schema" || ext === ".prisma") schemaCandidates.add(p);
    if (inDir(lower, SCHEMA_DIRS)) schemaCandidates.add(p);
    if (DS_FILE_NAMES.has(base)) designSystemCandidates.add(p);
    if (DS_STYLE_EXTS.has(ext) && f.size <= MAX_CONTENT_SCAN_BYTES) {
      const css = safeRead2(repo, p);
      if (css && DS_CSS_RE.test(css)) designSystemCandidates.add(p);
    }
    if (CONTENT_SCAN_EXTS.has(ext) && f.size <= MAX_CONTENT_SCAN_BYTES) {
      const src = safeRead2(repo, p);
      if (!src) continue;
      if (ROUTE_CONTENT_RE.test(src)) routeCandidates.add(p);
      if (API_CONTENT_RE.test(src)) apiCandidates.add(p);
      if (SCHEMA_CONTENT_RE.test(src)) schemaCandidates.add(p);
      if (REALTIME_CONTENT_RE.test(src)) realtimeCandidates.add(p);
      if (AUTH_CONTENT_RE.test(src)) authCandidates.add(p);
    }
  }
  return {
    routeCandidates: [...routeCandidates].sort(),
    apiCandidates: [...apiCandidates].sort(),
    schemaCandidates: [...schemaCandidates].sort(),
    realtimeCandidates: [...realtimeCandidates].sort(),
    authCandidates: [...authCandidates].sort(),
    designSystemCandidates: [...designSystemCandidates].sort(),
    entryPoints: detectEntryPoints(repo, files)
  };
}
var CONVENTIONAL_ENTRIES = [
  // JS/TS
  "src/index.ts",
  "src/index.js",
  "src/index.tsx",
  "src/main.ts",
  "src/main.tsx",
  "src/main.js",
  "index.ts",
  "index.js",
  "src/server.ts",
  "src/server.js",
  "server.ts",
  "server.js",
  "app/layout.tsx",
  "src/app/layout.tsx",
  // Python
  "manage.py",
  "main.py",
  "app.py",
  "wsgi.py",
  "asgi.py",
  "src/main.py",
  "__main__.py",
  // Go
  "main.go",
  "cmd/main.go",
  // Ruby
  "config.ru",
  "bin/rails",
  // Rust
  "src/main.rs",
  // Dart / Flutter
  "lib/main.dart"
];
function detectEntryPoints(repo, files) {
  const entries = /* @__PURE__ */ new Set();
  try {
    const pkg = JSON.parse(readFileSync4(join5(repo, "package.json"), "utf8"));
    for (const key of ["main", "module"]) {
      const v = pkg[key];
      if (typeof v === "string") entries.add(v.replace(/^\.\//, ""));
    }
    if (pkg.bin && typeof pkg.bin === "object") {
      for (const v of Object.values(pkg.bin)) {
        if (typeof v === "string") entries.add(v.replace(/^\.\//, ""));
      }
    } else if (typeof pkg.bin === "string") {
      entries.add(pkg.bin.replace(/^\.\//, ""));
    }
  } catch {
  }
  const present = new Set(files.map((f) => f.path));
  for (const c of CONVENTIONAL_ENTRIES) {
    if (present.has(c)) entries.add(c);
  }
  return [...entries].sort();
}

// src/design.ts
function detectStylingLibraries(libraries) {
  return libraries.filter((l) => STYLING_LIBRARY_LABELS.has(l));
}
function hasUI(inv) {
  if (inv.designSystem != null) return true;
  if ((inv.stack?.stylingLibraries?.length ?? 0) > 0) return true;
  if (inv.stack?.frameworks?.some((f) => UI_FRAMEWORK_LABELS.has(f))) return true;
  if ((inv.hints?.designSystemCandidates?.length ?? 0) > 0) return true;
  if (inv.files?.some((f) => f.category === "style")) return true;
  if (inv.routes?.some((r) => r.kind === "page" || r.kind === "component")) return true;
  return false;
}

// src/adapters/nextjs.ts
import { readFileSync as readFileSync5 } from "fs";
import { join as join6 } from "path";
var CODE_PAGE_EXTS = /* @__PURE__ */ new Set([".tsx", ".ts", ".jsx", ".js"]);
var PAGES_SPECIAL = /* @__PURE__ */ new Set(["_app", "_document", "_error", "middleware"]);
var HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
function cleanAppSegments(segs) {
  const out = [];
  for (const raw of segs) {
    const s = raw.replace(/^(\(\.{1,3}\))+/, "");
    if (!s) continue;
    if (s.startsWith("@")) continue;
    if (s.startsWith("(") && s.endsWith(")")) continue;
    out.push(s);
  }
  return out;
}
var WORKSPACE_PREFIX_RE = /^(?:apps|packages)\/[^/]+(?:\/src)?$/;
function afterDir(path, dir) {
  const parts = path.split("/");
  for (let idx = 0; idx < parts.length; idx++) {
    if (parts[idx] !== dir) continue;
    const prefix = parts.slice(0, idx).join("/");
    if (prefix === "" || prefix === "src" || WORKSPACE_PREFIX_RE.test(prefix)) {
      return parts.slice(idx + 1);
    }
  }
  return null;
}
function routeMethods(repo, file) {
  let src;
  try {
    src = readFileSync5(join6(repo, file), "utf8");
  } catch {
    return [];
  }
  const found = /* @__PURE__ */ new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Z]+)\b/g)) {
    if (HTTP_METHODS.includes(m[1])) found.add(m[1]);
  }
  for (const m of src.matchAll(/export\s+const\s+([A-Z]+)\s*=/g)) {
    if (HTTP_METHODS.includes(m[1])) found.add(m[1]);
  }
  return [...found];
}
function detectAppRoutes(files, repo) {
  const routes = [];
  for (const f of files) {
    if (!CODE_PAGE_EXTS.has(f.ext)) continue;
    const rest = afterDir(f.path, "app");
    if (!rest || rest.length === 0) continue;
    const fileName = rest[rest.length - 1].replace(/\.(tsx|ts|jsx|js)$/, "");
    const dirSegs = cleanAppSegments(rest.slice(0, -1));
    const route = "/" + dirSegs.join("/");
    const normalized = route === "/" ? "/" : route.replace(/\/$/, "");
    if (fileName === "page") {
      routes.push({ route: normalized, file: f.path, kind: "page" });
    } else if (fileName === "route") {
      const methods = routeMethods(repo, f.path);
      if (methods.length) {
        for (const method of methods) routes.push({ route: normalized, file: f.path, kind: "api", method });
      } else {
        routes.push({ route: normalized, file: f.path, kind: "api" });
      }
    } else if (fileName === "layout") {
      routes.push({ route: normalized, file: f.path, kind: "layout" });
    }
  }
  return routes;
}
function detectPagesRoutes(files) {
  const routes = [];
  for (const f of files) {
    if (!CODE_PAGE_EXTS.has(f.ext)) continue;
    const rest = afterDir(f.path, "pages");
    if (!rest || rest.length === 0) continue;
    const fileName = rest[rest.length - 1].replace(/\.(tsx|ts|jsx|js)$/, "");
    if (PAGES_SPECIAL.has(fileName)) continue;
    const segs = [...rest.slice(0, -1), fileName].filter((s) => s !== "index");
    const route = "/" + segs.join("/");
    const normalized = route === "/" ? "/" : route.replace(/\/$/, "");
    const isApi = rest[0] === "api";
    routes.push({ route: normalized, file: f.path, kind: isApi ? "api" : "page" });
  }
  return routes;
}
var nextjsAdapter = {
  id: "nextjs",
  frameworks: ["Next.js"],
  detectRoutes(files, repo) {
    return [...detectAppRoutes(files, repo), ...detectPagesRoutes(files)];
  }
};

// src/adapters/util.ts
import { readFileSync as readFileSync6 } from "fs";
import { join as join7 } from "path";
function readSources(files, repo, exts) {
  const set = new Set(exts);
  const out = /* @__PURE__ */ new Map();
  for (const f of files) {
    if (!set.has(f.ext)) continue;
    try {
      out.set(f.path, readFileSync6(join7(repo, f.path), "utf8"));
    } catch {
    }
  }
  return out;
}
var JS_SRC_EXTS = [".js", ".ts", ".mts", ".cts", ".mjs", ".cjs"];
function dirOf(p) {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}
function resolveModule(fromFile, spec, sources, exts = JS_SRC_EXTS) {
  const segs = [];
  for (const s of `${dirOf(fromFile)}/${spec}`.split("/")) {
    if (s === "" || s === ".") continue;
    if (s === "..") segs.pop();
    else segs.push(s);
  }
  const base = segs.join("/");
  for (const cand of [base, ...exts.map((e) => base + e), ...exts.map((e) => `${base}/index${e}`)]) {
    if (sources.has(cand)) return cand;
  }
  return null;
}
function moduleName(path) {
  return path.replace(/\.py$/, "").replace(/\/__init__$/, "").split("/").join(".");
}
function joinRoute(...parts) {
  const segs = parts.join("/").split("/").filter(Boolean);
  return "/" + segs.join("/");
}
function pythonImportAliases(src) {
  const out = /* @__PURE__ */ new Map();
  for (const m of src.matchAll(/^\s*from\s+([\w.]+)\s+import\s+(.+)$/gm)) {
    const module = m[1];
    for (const part of m[2].split(",")) {
      const asMatch = part.trim().match(/^(\w+)(?:\s+as\s+(\w+))?$/);
      if (!asMatch) continue;
      const name = asMatch[1];
      const alias = asMatch[2] ?? name;
      out.set(alias, `${module}::${name}`);
    }
  }
  return out;
}

// src/adapters/flask.ts
var HTTP_DECORATORS = "route|get|post|put|delete|patch|options|head";
var DECORATOR_RE = new RegExp(`@(\\w+)\\.(${HTTP_DECORATORS})\\(\\s*["']([^"']*)["']([^)]*)\\)`, "g");
var BLUEPRINT_DEF_RE = /(\w+)\s*=\s*Blueprint\s*\(([^)]*)\)/g;
var REGISTER_RE = /(\w+)\.register_blueprint\(\s*(\w+)([^)]*)\)/g;
var ADD_URL_RE = /(\w+)\.add_url_rule\(\s*["']([^"']*)["']([^)]*)\)/g;
function urlPrefixOf(args) {
  const m = args.match(/url_prefix\s*=\s*["']([^"']*)["']/);
  return m ? m[1] : "";
}
function methodsOf(args) {
  const m = args.match(/methods\s*=\s*[[(]([^\])]*)[\])]/);
  if (!m) return [];
  return [...m[1].matchAll(/["']([A-Za-z]+)["']/g)].map((v) => v[1].toUpperCase());
}
function routeKind(src, from) {
  const next = src.slice(from + 1).search(/\n@\w+\.(route|get|post|put|delete|patch)/);
  const block = next === -1 ? src.slice(from) : src.slice(from, from + 1 + next);
  return /render_template\s*\(/.test(block) ? "page" : "api";
}
var flaskAdapter = {
  id: "flask",
  frameworks: ["Flask"],
  detectRoutes(files, repo) {
    const sources = readSources(files, repo, [".py"]);
    const blueprintKeys = /* @__PURE__ */ new Set();
    const blueprintVarsByFile = /* @__PURE__ */ new Map();
    const ownPrefix = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      const vars = /* @__PURE__ */ new Set();
      for (const m of src.matchAll(BLUEPRINT_DEF_RE)) {
        const v = m[1];
        vars.add(v);
        const key = `${moduleName(path)}::${v}`;
        blueprintKeys.add(key);
        ownPrefix.set(key, urlPrefixOf(m[2]));
      }
      if (vars.size) blueprintVarsByFile.set(path, vars);
    }
    const regOf = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      const aliases = pythonImportAliases(src);
      const keyFor = (v) => aliases.get(v) ?? `${moduleName(path)}::${v}`;
      for (const m of src.matchAll(REGISTER_RE)) {
        const childKey = keyFor(m[2]);
        if (!blueprintKeys.has(childKey)) continue;
        regOf.set(childKey, {
          receiverKey: keyFor(m[1]),
          regPrefix: urlPrefixOf(m[3])
        });
      }
    }
    const effectivePrefix = (key, seen = /* @__PURE__ */ new Set()) => {
      if (seen.has(key)) return "";
      seen.add(key);
      const own = ownPrefix.get(key) ?? "";
      const reg = regOf.get(key);
      if (!reg) return own;
      const childPrefix = reg.regPrefix || own;
      if (blueprintKeys.has(reg.receiverKey)) {
        return joinRoute(effectivePrefix(reg.receiverKey, seen), childPrefix);
      }
      return childPrefix;
    };
    const routes = [];
    for (const [path, src] of sources) {
      const localBlueprints = blueprintVarsByFile.get(path) ?? /* @__PURE__ */ new Set();
      const prefixForObj = (obj) => localBlueprints.has(obj) ? effectivePrefix(`${moduleName(path)}::${obj}`) : "";
      for (const m of src.matchAll(DECORATOR_RE)) {
        const obj = m[1];
        const decorator = m[2];
        const route = joinRoute(prefixForObj(obj), m[3]);
        const kind = routeKind(src, m.index ?? 0);
        const methods = decorator === "route" ? methodsOf(m[4]) : [decorator.toUpperCase()];
        const verbs = methods.length ? methods : ["GET"];
        for (const method of verbs) routes.push({ route, file: path, kind, method });
      }
      for (const m of src.matchAll(ADD_URL_RE)) {
        const route = joinRoute(prefixForObj(m[1]), m[2]);
        const kind = routeKind(src, m.index ?? 0);
        const verbs = methodsOf(m[3]);
        for (const method of verbs.length ? verbs : ["GET"]) {
          routes.push({ route, file: path, kind, method });
        }
      }
    }
    return routes;
  }
};

// src/adapters/fastapi.ts
var METHODS = "get|post|put|delete|patch|options|head|api_route|websocket";
var DECORATOR_RE2 = new RegExp(`@(\\w+)\\.(${METHODS})\\(\\s*["']([^"']*)["']([^)]*)\\)`, "g");
var ROUTER_DEF_RE = /(\w+)\s*=\s*APIRouter\(([^)]*)\)/g;
var INCLUDE_RE = /(\w+)\.include_router\(\s*([\w.]+)([^)]*)\)/g;
function prefixArg(args) {
  const m = args.match(/prefix\s*=\s*["']([^"']*)["']/);
  return m ? m[1] : "";
}
function methodsOf2(args) {
  const m = args.match(/methods\s*=\s*[[(]([^\])]*)[\])]/);
  if (!m) return [];
  return [...m[1].matchAll(/["']([A-Za-z]+)["']/g)].map((v) => v[1].toUpperCase());
}
var lastSeg = (mod) => mod.split(".").pop() ?? mod;
var fastapiAdapter = {
  id: "fastapi",
  frameworks: ["FastAPI"],
  detectRoutes(files, repo) {
    const sources = readSources(files, repo, [".py"]);
    const ownPrefix = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      for (const m of src.matchAll(ROUTER_DEF_RE)) {
        ownPrefix.set(`${moduleName(path)}::${m[1]}`, prefixArg(m[2]));
      }
    }
    const routerKeys = [...ownPrefix.keys()];
    const resolveRouter = (expr, fileModule, aliases) => {
      if (expr.includes(".")) {
        const parts = expr.split(".");
        const attr = parts.pop();
        const mod = parts.pop();
        return routerKeys.find((k) => k.endsWith(`::${attr}`) && lastSeg(k.split("::")[0]) === mod) ?? null;
      }
      const key = aliases.get(expr) ?? `${fileModule}::${expr}`;
      return ownPrefix.has(key) ? key : null;
    };
    const includeOf = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      const fileModule = moduleName(path);
      const aliases = pythonImportAliases(src);
      for (const m of src.matchAll(INCLUDE_RE)) {
        const childKey = resolveRouter(m[2], fileModule, aliases);
        if (!childKey) continue;
        const receiverVar = m[1];
        const receiverKey = aliases.get(receiverVar) ?? `${fileModule}::${receiverVar}`;
        includeOf.set(childKey, {
          receiverKey: ownPrefix.has(receiverKey) ? receiverKey : null,
          mountPrefix: prefixArg(m[3])
        });
      }
    }
    const fullPrefix = (key, seen = /* @__PURE__ */ new Set()) => {
      if (seen.has(key)) return "";
      seen.add(key);
      const own = ownPrefix.get(key) ?? "";
      const inc = includeOf.get(key);
      if (!inc) return own;
      const parent = inc.receiverKey ? fullPrefix(inc.receiverKey, seen) : "";
      return joinRoute(parent, inc.mountPrefix, own);
    };
    const routes = [];
    for (const [path, src] of sources) {
      const fileModule = moduleName(path);
      for (const m of src.matchAll(DECORATOR_RE2)) {
        const obj = m[1];
        const decorator = m[2];
        const key = `${fileModule}::${obj}`;
        const prefix = ownPrefix.has(key) ? fullPrefix(key) : "";
        const route = joinRoute(prefix, m[3]);
        const methods = decorator === "websocket" ? ["WS"] : decorator === "api_route" ? methodsOf2(m[4]) : [decorator.toUpperCase()];
        if (methods.length) {
          for (const method of methods) routes.push({ route, file: path, kind: "api", method });
        } else {
          routes.push({ route, file: path, kind: "api" });
        }
      }
    }
    return routes;
  }
};

// src/adapters/nestjs.ts
var CONTROLLER_RE = /@Controller\(\s*([^)]*)\)/g;
var METHOD_RE = /@(Get|Post|Put|Delete|Patch|Options|Head|All)\(\s*([^)]*)\)/g;
var GLOBAL_PREFIX_RE = /setGlobalPrefix\(\s*["'`]([^"'`]*)["'`]/;
function pathsFromArg(arg) {
  const t = arg.trim();
  if (!t) return [""];
  if (t.startsWith("[")) {
    const parts = [...t.matchAll(/["'`]([^"'`]*)["'`]/g)].map((m) => m[1]);
    return parts.length ? parts : [""];
  }
  const str = t.match(/^["'`]([^"'`]*)["'`]/);
  if (str) return [str[1]];
  const obj = t.match(/path\s*:\s*["'`]([^"'`]*)["'`]/);
  if (obj) return [obj[1]];
  return [""];
}
var methodOf = (verb) => verb === "All" ? "*" : verb.toUpperCase();
var nestjsAdapter = {
  id: "nestjs",
  frameworks: ["NestJS"],
  detectRoutes(files, repo) {
    const sources = readSources(files, repo, [".ts"]);
    let globalPrefix = "";
    for (const [, src] of sources) {
      const m = src.match(GLOBAL_PREFIX_RE);
      if (m) {
        globalPrefix = m[1];
        break;
      }
    }
    const routes = [];
    for (const [path, src] of sources) {
      const controllers = [...src.matchAll(CONTROLLER_RE)].map((m) => ({
        index: m.index ?? 0,
        bases: pathsFromArg(m[1])
      }));
      if (!controllers.length) continue;
      for (const m of src.matchAll(METHOD_RE)) {
        const idx = m.index ?? 0;
        let bases = [""];
        for (const c of controllers) {
          if (c.index < idx) bases = c.bases;
          else break;
        }
        const method = methodOf(m[1]);
        for (const base of bases) {
          for (const sub of pathsFromArg(m[2])) {
            routes.push({
              route: joinRoute(globalPrefix, base, sub),
              file: path,
              kind: "api",
              method
            });
          }
        }
      }
    }
    return routes;
  }
};

// src/adapters/express.ts
var APP_RE = /(?:const|let|var)\s+(\w+)\s*=\s*express\(\)/g;
var ROUTER_RE = /(?:const|let|var)\s+(\w+)\s*=\s*(?:express\.|require\(\s*["'`]express["'`]\s*\)\.)?Router\(\)/g;
var REQUIRE_RE = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
var IMPORT_RE = /import\s+(\w+)\s+from\s+["'`](\.[^"'`]*)["'`]/g;
var USE_RE = /(\w+)\.use\(\s*["'`]([^"'`]*)["'`]\s*,\s*(\w+)/g;
var ROUTE_RE = /(\w+)\.(get|post|put|delete|patch|all|ws)\(\s*["'`]([^"'`]*)["'`]/g;
var ROUTE_CHAIN_RE = /(\w+)\.route\(\s*["'`]([^"'`]*)["'`]\s*\)/g;
var CHAIN_VERB_RE = /\.\s*(get|post|put|delete|patch|all|ws)\s*\(/g;
function methodOf2(verb) {
  return verb.toLowerCase() === "all" ? "*" : verb.toUpperCase();
}
function localVars(src, re) {
  return new Set([...src.matchAll(re)].map((m) => m[1]));
}
var expressAdapter = {
  id: "express",
  frameworks: ["Express"],
  detectRoutes(files, repo) {
    const sources = readSources(files, repo, JS_SRC_EXTS);
    const mountByFile = /* @__PURE__ */ new Map();
    const mountByLocalVar = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      const localRouters = localVars(src, ROUTER_RE);
      const moduleOf = /* @__PURE__ */ new Map();
      for (const m of src.matchAll(REQUIRE_RE)) moduleOf.set(m[1], m[2]);
      for (const m of src.matchAll(IMPORT_RE)) moduleOf.set(m[1], m[2]);
      for (const m of src.matchAll(USE_RE)) {
        const prefix = m[2];
        const usedVar = m[3];
        const spec = moduleOf.get(usedVar);
        if (spec) {
          const target = resolveModule(path, spec, sources);
          if (target) mountByFile.set(target, prefix);
        } else if (localRouters.has(usedVar)) {
          mountByLocalVar.set(`${path}::${usedVar}`, prefix);
        }
      }
    }
    const routes = [];
    for (const [path, src] of sources) {
      const appVars = localVars(src, APP_RE);
      const routerVars = localVars(src, ROUTER_RE);
      const prefixFor = (obj) => {
        if (appVars.has(obj)) return "";
        if (!routerVars.has(obj)) return "";
        return mountByLocalVar.get(`${path}::${obj}`) ?? mountByFile.get(path) ?? "";
      };
      const known = (obj) => appVars.has(obj) || routerVars.has(obj);
      for (const m of src.matchAll(ROUTE_RE)) {
        const obj = m[1];
        if (!known(obj)) continue;
        routes.push({
          route: joinRoute(prefixFor(obj), m[3]),
          file: path,
          kind: "api",
          method: methodOf2(m[2])
        });
      }
      for (const m of src.matchAll(ROUTE_CHAIN_RE)) {
        const obj = m[1];
        if (!known(obj)) continue;
        const route = joinRoute(prefixFor(obj), m[2]);
        const start = (m.index ?? 0) + m[0].length;
        const lineEnd = src.indexOf("\n", start);
        const tail = src.slice(start, lineEnd === -1 ? start + 200 : lineEnd);
        const verbs = [...tail.matchAll(CHAIN_VERB_RE)].map((v) => v[1]);
        if (verbs.length) {
          for (const v of verbs) routes.push({ route, file: path, kind: "api", method: methodOf2(v) });
        } else {
          routes.push({ route, file: path, kind: "api" });
        }
      }
    }
    return routes;
  }
};

// src/adapters/fastify.ts
var APP_RE2 = /(?:const|let|var)\s+(\w+)\s*=\s*(?:require\(\s*["'`]fastify["'`]\s*\)|[Ff]astify)\s*\(/g;
var REQUIRE_RE2 = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
var IMPORT_RE2 = /import\s+(\w+)\s+from\s+["'`](\.[^"'`]*)["'`]/g;
var REGISTER_RE2 = /(\w+)\.register\(\s*(?:require\(\s*["'`](\.[^"'`]*)["'`]\s*\)|(\w+))\s*(?:,\s*\{([^}]*)\})?/g;
var PREFIX_RE = /\bprefix\s*:\s*["'`]([^"'`]*)["'`]/;
var ROUTE_RE2 = /(\w+)\.(get|head|post|put|delete|options|patch|all)\(\s*["'`]([^"'`]*)["'`]/g;
var ROUTE_OBJ_RE = /(\w+)\.route\(\s*\{/g;
var URL_RE = /\burl\s*:\s*["'`]([^"'`]*)["'`]/;
var METHOD_RE2 = /\bmethod\s*:\s*(?:["'`](\w+)["'`]|\[([^\]]*)\])/;
function methodOf3(verb) {
  return verb.toLowerCase() === "all" ? "*" : verb.toUpperCase();
}
function pluginParam(src) {
  const direct = src.match(/module\.exports\s*=\s*(?:async\s+)?function\s*\w*\s*\(\s*(\w+)/) ?? src.match(/module\.exports\s*=\s*(?:async\s*)?\(\s*(\w+)/) ?? src.match(/export\s+default\s+(?:async\s+)?function\s*\w*\s*\(\s*(\w+)/) ?? src.match(/export\s+default\s+(?:async\s*)?\(\s*(\w+)/);
  if (direct) return direct[1];
  const named = src.match(/(?:module\.exports\s*=|export\s+default)\s*(\w+)\s*;?\s*$/m);
  if (named) {
    const name = named[1];
    const fn = src.match(new RegExp(`function\\s+${name}\\s*\\(\\s*(\\w+)`)) ?? src.match(new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?\\(\\s*(\\w+)`));
    if (fn) return fn[1];
  }
  return null;
}
function localVars2(src, re) {
  return new Set([...src.matchAll(re)].map((m) => m[1]));
}
var fastifyAdapter = {
  id: "fastify",
  frameworks: ["Fastify"],
  detectRoutes(files, repo) {
    const sources = readSources(files, repo, JS_SRC_EXTS);
    const appVarsByFile = /* @__PURE__ */ new Map();
    const pluginParamByFile = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      appVarsByFile.set(path, localVars2(src, APP_RE2));
      const param = pluginParam(src);
      if (param) pluginParamByFile.set(path, param);
    }
    const edges = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      const receivers = new Set(appVarsByFile.get(path));
      const param = pluginParamByFile.get(path);
      if (param) receivers.add(param);
      const moduleOf = /* @__PURE__ */ new Map();
      for (const m of src.matchAll(REQUIRE_RE2)) moduleOf.set(m[1], m[2]);
      for (const m of src.matchAll(IMPORT_RE2)) moduleOf.set(m[1], m[2]);
      for (const m of src.matchAll(REGISTER_RE2)) {
        if (!receivers.has(m[1])) continue;
        const spec = m[2] ?? moduleOf.get(m[3]);
        if (!spec) continue;
        const target = resolveModule(path, spec, sources);
        if (!target) continue;
        const prefix = (m[4] ?? "").match(PREFIX_RE)?.[1] ?? "";
        const list = edges.get(path);
        if (list) list.push({ target, prefix });
        else edges.set(path, [{ target, prefix }]);
      }
    }
    const mountByFile = /* @__PURE__ */ new Map();
    const queue = [...sources.keys()].filter((p) => (appVarsByFile.get(p)?.size ?? 0) > 0).sort().map((p) => ({ file: p, mount: "" }));
    while (queue.length > 0) {
      const { file, mount } = queue.shift();
      for (const { target, prefix } of edges.get(file) ?? []) {
        if (mountByFile.has(target)) continue;
        const next = mount === "" && prefix === "" ? "" : joinRoute(mount, prefix);
        mountByFile.set(target, next);
        queue.push({ file: target, mount: next });
      }
    }
    const routes = [];
    for (const [path, src] of sources) {
      const appVars = appVarsByFile.get(path) ?? /* @__PURE__ */ new Set();
      const param = pluginParamByFile.get(path);
      const prefixFor = (obj) => {
        if (appVars.has(obj)) return "";
        if (obj === param) return mountByFile.get(path) ?? "";
        return null;
      };
      for (const m of src.matchAll(ROUTE_RE2)) {
        const prefix = prefixFor(m[1]);
        if (prefix === null) continue;
        const tail = src.slice((m.index ?? 0) + m[0].length).slice(0, 200);
        const isWs = /^\s*,\s*\{[^}]*\bwebsocket\s*:\s*true/.test(tail);
        routes.push({
          route: joinRoute(prefix, m[3]),
          file: path,
          kind: "api",
          method: isWs ? "WS" : methodOf3(m[2])
        });
      }
      for (const m of src.matchAll(ROUTE_OBJ_RE)) {
        const prefix = prefixFor(m[1]);
        if (prefix === null) continue;
        const slice = src.slice(m.index ?? 0, (m.index ?? 0) + 400);
        const url = slice.match(URL_RE)?.[1];
        if (url === void 0) continue;
        const route = joinRoute(prefix, url);
        if (/\bwebsocket\s*:\s*true/.test(slice)) {
          routes.push({ route, file: path, kind: "api", method: "WS" });
          continue;
        }
        const methodM = slice.match(METHOD_RE2);
        const verbs = methodM?.[1] ? [methodM[1]] : (methodM?.[2] ?? "").split(",").map((s) => s.trim().replace(/^["'`]|["'`]$/g, "")).filter(Boolean);
        if (verbs.length) {
          for (const v of verbs) routes.push({ route, file: path, kind: "api", method: methodOf3(v) });
        } else {
          routes.push({ route, file: path, kind: "api" });
        }
      }
    }
    return routes;
  }
};

// src/adapters/hono.ts
var APP_RE3 = /(?:const|let|var)\s+(\w+)\s*=\s*new\s+Hono\s*(?:<[^>]*>)?\s*\([^)]*\)(?:\s*\.basePath\(\s*["'`]([^"'`]*)["'`]\s*\))?/g;
var BASEPATH_RE = /(\w+)\.basePath\(\s*["'`]([^"'`]*)["'`]/g;
var REQUIRE_RE3 = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
var IMPORT_RE3 = /import\s+(\w+)\s+from\s+["'`](\.[^"'`]*)["'`]/g;
var ROUTE_RE3 = /(\w+)\.(get|post|put|delete|patch|options|all)\(\s*["'`]([^"'`]*)["'`]/g;
var ON_RE = /(\w+)\.on\(\s*(?:["'`](\w+)["'`]|\[([^\]]*)\])\s*,\s*["'`]([^"'`]*)["'`]/g;
var MOUNT_RE = /(\w+)\.route\(\s*["'`]([^"'`]*)["'`]\s*,\s*(\w+)\s*\)/g;
var EXPORT_RE = /(?:export\s+default|module\.exports\s*=)\s+(\w+)\s*;?/;
function methodOf4(verb) {
  return verb.toLowerCase() === "all" ? "*" : verb.toUpperCase();
}
var honoAdapter = {
  id: "hono",
  frameworks: ["Hono"],
  detectRoutes(files, repo) {
    const sources = readSources(files, repo, JS_SRC_EXTS);
    const appVarsByFile = /* @__PURE__ */ new Map();
    const basePathByVar = /* @__PURE__ */ new Map();
    const exportedByFile = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      const vars = /* @__PURE__ */ new Set();
      for (const m of src.matchAll(APP_RE3)) {
        vars.add(m[1]);
        if (m[2]) basePathByVar.set(`${path}::${m[1]}`, m[2]);
      }
      for (const m of src.matchAll(BASEPATH_RE)) {
        if (vars.has(m[1])) basePathByVar.set(`${path}::${m[1]}`, m[2]);
      }
      appVarsByFile.set(path, vars);
      const exp = src.match(EXPORT_RE);
      if (exp && vars.has(exp[1])) exportedByFile.set(path, exp[1]);
    }
    const baseOf = (path, v) => basePathByVar.get(`${path}::${v}`) ?? "";
    const mountByLocalVar = /* @__PURE__ */ new Map();
    const edges = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      const vars = appVarsByFile.get(path) ?? /* @__PURE__ */ new Set();
      const moduleOf = /* @__PURE__ */ new Map();
      for (const m of src.matchAll(REQUIRE_RE3)) moduleOf.set(m[1], m[2]);
      for (const m of src.matchAll(IMPORT_RE3)) moduleOf.set(m[1], m[2]);
      for (const m of src.matchAll(MOUNT_RE)) {
        const receiver = m[1];
        if (!vars.has(receiver)) continue;
        const prefix = joinRoute(baseOf(path, receiver), m[2]);
        const mounted = m[3];
        const spec = moduleOf.get(mounted);
        if (spec) {
          const target = resolveModule(path, spec, sources);
          if (!target) continue;
          const list = edges.get(path);
          if (list) list.push({ target, prefix });
          else edges.set(path, [{ target, prefix }]);
        } else if (vars.has(mounted)) {
          mountByLocalVar.set(`${path}::${mounted}`, prefix);
        }
      }
    }
    const targets = new Set([...edges.values()].flat().map((e) => e.target));
    const mountByFile = /* @__PURE__ */ new Map();
    const queue = [...sources.keys()].filter((p) => !targets.has(p)).sort().map((p) => ({ file: p, mount: "" }));
    while (queue.length > 0) {
      const { file, mount } = queue.shift();
      for (const { target, prefix } of edges.get(file) ?? []) {
        if (mountByFile.has(target)) continue;
        const next = mount === "" ? prefix : joinRoute(mount, prefix);
        mountByFile.set(target, next);
        queue.push({ file: target, mount: next });
      }
    }
    const routes = [];
    for (const [path, src] of sources) {
      const vars = appVarsByFile.get(path) ?? /* @__PURE__ */ new Set();
      if (vars.size === 0) continue;
      const exported = exportedByFile.get(path);
      const prefixFor = (v) => {
        if (!vars.has(v)) return null;
        const mount = mountByLocalVar.get(`${path}::${v}`) ?? (v === exported ? mountByFile.get(path) ?? "" : "");
        const base = baseOf(path, v);
        return mount === "" && base === "" ? "" : joinRoute(mount, base);
      };
      for (const m of src.matchAll(ROUTE_RE3)) {
        const prefix = prefixFor(m[1]);
        if (prefix === null) continue;
        routes.push({
          route: joinRoute(prefix, m[3]),
          file: path,
          kind: "api",
          method: methodOf4(m[2])
        });
      }
      for (const m of src.matchAll(ON_RE)) {
        const prefix = prefixFor(m[1]);
        if (prefix === null) continue;
        const route = joinRoute(prefix, m[4]);
        const verbs = m[2] ? [m[2]] : m[3].split(",").map((s) => s.trim().replace(/^["'`]|["'`]$/g, "")).filter(Boolean);
        for (const v of verbs) routes.push({ route, file: path, kind: "api", method: methodOf4(v) });
      }
    }
    return routes;
  }
};

// src/adapters/django.ts
var ENTRY_RE = /\b(path|re_path|url)\(\s*r?["']([^"']*)["']\s*,\s*([\w.]+)/g;
var INCLUDE_RE2 = /\b(?:path|re_path|url)\(\s*r?["']([^"']*)["']\s*,\s*include\(\s*["']([^"']*)["']/g;
var DRF_ROUTER_RE = /(\w+)\s*=\s*(?:routers\.)?(?:Default|Simple)Router\(/g;
var DRF_REGISTER_RE = /(\w+)\.register\(\s*r?["']([^"']*)["']/g;
var DRF_MOUNT_RE = /\b(?:path|re_path|url)\(\s*r?["']([^"']*)["']\s*,\s*include\(\s*(\w+)\.urls/g;
function cleanRegex(pattern) {
  return pattern.replace(/^\^/, "").replace(/\$$/, "").replace(/\(\?P<(\w+)>[^)]*\)/g, "<$1>");
}
function isApiContext(src, route) {
  return /rest_framework|ViewSet|APIView|JsonResponse|@api_view/.test(src) || /(^|\/)api(\/|$)/.test(route);
}
var djangoAdapter = {
  id: "django",
  frameworks: ["Django"],
  detectRoutes(files, repo) {
    const sources = readSources(files, repo, [".py"]);
    const includeEdge = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      if (!path.endsWith("urls.py")) continue;
      const parent = moduleName(path);
      for (const m of src.matchAll(INCLUDE_RE2)) {
        const child = m[2];
        if (!includeEdge.has(child)) includeEdge.set(child, { parent, prefix: m[1] });
      }
    }
    const fullPrefix = (mod, seen = /* @__PURE__ */ new Set()) => {
      if (seen.has(mod)) return "";
      seen.add(mod);
      const e = includeEdge.get(mod);
      return e ? joinRoute(fullPrefix(e.parent, seen), e.prefix) : "";
    };
    const routes = [];
    for (const [path, src] of sources) {
      if (!path.endsWith("urls.py")) continue;
      const prefix = fullPrefix(moduleName(path));
      for (const m of src.matchAll(ENTRY_RE)) {
        const view = m[3];
        if (view === "include") continue;
        if (view.endsWith(".site.urls") || view === "admin") continue;
        const raw = m[1] !== "path" ? cleanRegex(m[2]) : m[2];
        const route = joinRoute(prefix, raw);
        routes.push({ route, file: path, kind: isApiContext(src, route) ? "api" : "page" });
      }
      const routerVars = new Set([...src.matchAll(DRF_ROUTER_RE)].map((m) => m[1]));
      if (!routerVars.size) continue;
      const mountOf = /* @__PURE__ */ new Map();
      for (const m of src.matchAll(DRF_MOUNT_RE)) {
        if (routerVars.has(m[2])) mountOf.set(m[2], m[1]);
      }
      for (const m of src.matchAll(DRF_REGISTER_RE)) {
        const router = m[1];
        if (!routerVars.has(router)) continue;
        const base = joinRoute(prefix, mountOf.get(router) ?? "", m[2]);
        const detail = joinRoute(base, "<pk>");
        const add = (route, method) => routes.push({ route, file: path, kind: "api", method });
        add(base, "GET");
        add(base, "POST");
        add(detail, "GET");
        add(detail, "PUT");
        add(detail, "PATCH");
        add(detail, "DELETE");
      }
    }
    return routes;
  }
};

// src/adapters/rails.ts
var PLURAL_ACTIONS = {
  index: [{ method: "GET", segs: [] }],
  create: [{ method: "POST", segs: [] }],
  new: [{ method: "GET", segs: ["new"] }],
  show: [{ method: "GET", segs: [":id"] }],
  update: [
    { method: "PUT", segs: [":id"] },
    { method: "PATCH", segs: [":id"] }
  ],
  destroy: [{ method: "DELETE", segs: [":id"] }],
  edit: [{ method: "GET", segs: [":id", "edit"] }]
};
var SINGULAR_ACTIONS = {
  create: [{ method: "POST", segs: [] }],
  new: [{ method: "GET", segs: ["new"] }],
  show: [{ method: "GET", segs: [] }],
  update: [
    { method: "PUT", segs: [] },
    { method: "PATCH", segs: [] }
  ],
  destroy: [{ method: "DELETE", segs: [] }],
  edit: [{ method: "GET", segs: ["edit"] }]
};
var ROOT_RE = /^root\b/;
var VERB_RE = /\b(get|post|put|patch|delete)\s+(?::(\w+)|["']([^"']+)["'])/g;
var RESOURCES_RE = /\b(resources|resource)\s+:(\w+)([^\n]*)/g;
var NAMESPACE_RE = /^namespace\s+:?(\w+)/;
var SCOPE_STR_RE = /^scope\s+["']([^"']+)["']/;
var SCOPE_PATH_RE = /^scope\b[^#\n]*\bpath:\s*["']([^"']+)["']/;
var MOUNT_RE2 = /\bmount\s+[\w:]+\s*(?:=>|,\s*at:)\s*["']([^"']+)["']/;
var OPENS_BLOCK_RE = /\bdo\b(\s*\|[^|]*\|)?\s*$/;
var MEMBER_RE = /^member\b/;
var COLLECTION_RE = /^collection\b/;
function singularize(n) {
  if (n.endsWith("ies")) return n.slice(0, -3) + "y";
  if (n.endsWith("s")) return n.slice(0, -1);
  return n;
}
function actionsFor(args, singular) {
  const all = Object.keys(singular ? SINGULAR_ACTIONS : PLURAL_ACTIONS);
  const parse = (s) => new Set(
    s.split(",").map((a) => a.trim().replace(/^:/, "")).filter(Boolean)
  );
  const only = args.match(/\bonly:\s*\[([^\]]*)\]/);
  if (only) {
    const set = parse(only[1]);
    return all.filter((a) => set.has(a));
  }
  const except = args.match(/\bexcept:\s*\[([^\]]*)\]/);
  if (except) {
    const set = parse(except[1]);
    return all.filter((a) => !set.has(a));
  }
  return all;
}
var apiKind = (route) => /(^|\/)api(\/|$)/i.test(route) ? "api" : "page";
var railsAdapter = {
  id: "rails",
  frameworks: ["Ruby on Rails"],
  detectRoutes(files, repo) {
    const routes = [];
    for (const [path, src] of readSources(files, repo, [".rb"])) {
      if (!path.endsWith("routes.rb")) continue;
      const frames = [];
      const emit = (route, method, kind) => routes.push({ route, file: path, kind: kind ?? apiKind(route), ...method ? { method } : {} });
      const nestPrefix = (upto) => {
        const out = [];
        for (let i = 0; i < upto; i++) {
          const f = frames[i];
          if (f.type === "prefix") out.push(...f.segs);
          else if (f.type === "resources") out.push(f.name, `:${f.singular}_id`);
          else if (f.type === "singular") out.push(f.name);
        }
        return out;
      };
      const verbPrefix = () => {
        const top = frames[frames.length - 1];
        if (top && (top.type === "member" || top.type === "collection")) {
          let parentIdx = frames.length - 1;
          for (let i = frames.length - 2; i >= 0; i--) {
            const f = frames[i];
            if (f.type === "resources" || f.type === "singular") {
              parentIdx = i;
              break;
            }
          }
          const base = nestPrefix(parentIdx);
          return top.type === "member" ? [...base, top.name, ":id"] : [...base, top.name];
        }
        return nestPrefix(frames.length);
      };
      for (const rawLine of src.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        if (ROOT_RE.test(line)) emit(joinRoute(...verbPrefix()), "GET");
        for (const m of line.matchAll(VERB_RE)) {
          const p = m[2] ?? m[3];
          emit(joinRoute(...verbPrefix(), p), m[1].toUpperCase());
        }
        for (const m of line.matchAll(RESOURCES_RE)) {
          const singular = m[1] === "resource";
          const name = m[2];
          const args = m[3] ?? "";
          const base = joinRoute(...nestPrefix(frames.length), name);
          const table = singular ? SINGULAR_ACTIONS : PLURAL_ACTIONS;
          for (const action of actionsFor(args, singular)) {
            for (const def of table[action]) {
              emit(joinRoute(base, ...def.segs), def.method);
            }
          }
        }
        const mount = line.match(MOUNT_RE2);
        if (mount) emit(joinRoute(...nestPrefix(frames.length), mount[1]), void 0, "api");
        if (/^end\b/.test(line)) {
          frames.pop();
          continue;
        }
        if (OPENS_BLOCK_RE.test(line)) {
          const res = line.match(/^(resources|resource)\s+:(\w+)/);
          const ns = line.match(NAMESPACE_RE);
          const scopePath = line.match(SCOPE_PATH_RE) ?? line.match(SCOPE_STR_RE);
          const parentRes = [...frames].reverse().find((f) => f.type === "resources" || f.type === "singular");
          if (MEMBER_RE.test(line)) frames.push({ type: "member", name: parentRes?.name ?? "" });
          else if (COLLECTION_RE.test(line)) frames.push({ type: "collection", name: parentRes?.name ?? "" });
          else if (res && res[1] === "resources") frames.push({ type: "resources", name: res[2], singular: singularize(res[2]) });
          else if (res) frames.push({ type: "singular", name: res[2] });
          else if (ns) frames.push({ type: "prefix", segs: [ns[1]] });
          else if (scopePath) frames.push({ type: "prefix", segs: [scopePath[1]] });
          else frames.push({ type: "prefix", segs: [] });
        }
      }
    }
    return routes;
  }
};

// src/adapters/go.ts
var VERB_TOKENS = "GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE|Get|Post|Put|Delete|Patch|Head|Options|Connect|Trace|Any|ANY|All";
var VERB_RE2 = new RegExp(`(\\w+)\\.(${VERB_TOKENS})\\(\\s*["\`]([^"\`]*)["\`]`, "g");
var HANDLE_VERB_RE = /(\w+)\.(?:Handle|Add)\(\s*["`](GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)["`]\s*,\s*["`]([^"`]*)["`]/g;
var HANDLEFUNC_RE = /(\w+)\.HandleFunc\(\s*["`]([^"`]*)["`][^;\n]*/g;
var METHODS_CHAIN_RE = /\.Methods\(\s*([^)]*)\)/;
var GROUP_RE = /(\w+)\s*:=\s*(\w+)\.Group\(\s*["`]([^"`]*)["`]/g;
var ROUTE_OPEN_RE = /(\w+)\.Route\(\s*["`]([^"`]*)["`]\s*,\s*func/g;
var MOUNT_RE3 = /(\w+)\.Mount\(\s*["`]([^"`]*)["`]/g;
var STD_VERBS = /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/;
function methodOf5(verb) {
  const up = verb.toUpperCase();
  return up === "ANY" || up === "ALL" ? "*" : up;
}
function braceMatch(src) {
  const stack = [];
  const pairs = /* @__PURE__ */ new Map();
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "{") stack.push(i);
    else if (c === "}") {
      const open = stack.pop();
      if (open !== void 0) pairs.set(open, i);
    }
  }
  return pairs;
}
var goAdapter = {
  id: "go",
  frameworks: ["Gin", "Echo", "chi", "Fiber", "Gorilla"],
  detectRoutes(files, repo) {
    const routes = [];
    for (const [path, src] of readSources(files, repo, [".go"])) {
      const groups = /* @__PURE__ */ new Map();
      for (const m of src.matchAll(GROUP_RE)) {
        groups.set(m[1], { parent: m[2], seg: m[3] });
      }
      const groupPrefix = (v, seen = /* @__PURE__ */ new Set()) => {
        const g = groups.get(v);
        if (!g || seen.has(v)) return "";
        seen.add(v);
        return joinRoute(groupPrefix(g.parent, seen), g.seg);
      };
      const pairs = braceMatch(src);
      const opens = [...pairs.keys()].sort((a, b) => a - b);
      const ranges = [];
      for (const m of src.matchAll(ROUTE_OPEN_RE)) {
        const at = m.index ?? 0;
        const open = opens.find((o) => o > at);
        if (open === void 0) continue;
        ranges.push({ start: open, end: pairs.get(open), seg: m[2] });
      }
      const closurePrefix = (idx) => joinRoute(
        ...ranges.filter((r) => idx >= r.start && idx <= r.end).sort((a, b) => a.start - b.start).map((r) => r.seg)
      );
      const prefixAt = (recv, idx) => joinRoute(closurePrefix(idx), groupPrefix(recv));
      for (const m of src.matchAll(VERB_RE2)) {
        const routePath = m[3];
        if (!routePath.startsWith("/")) continue;
        routes.push({
          route: joinRoute(prefixAt(m[1], m.index ?? 0), routePath),
          file: path,
          kind: "api",
          method: methodOf5(m[2])
        });
      }
      for (const m of src.matchAll(HANDLE_VERB_RE)) {
        const routePath = m[3];
        if (!routePath.startsWith("/")) continue;
        routes.push({
          route: joinRoute(prefixAt(m[1], m.index ?? 0), routePath),
          file: path,
          kind: "api",
          method: methodOf5(m[2])
        });
      }
      for (const m of src.matchAll(HANDLEFUNC_RE)) {
        const raw = m[2];
        const verbInPattern = raw.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\/\S*)$/);
        const routePath = verbInPattern ? verbInPattern[2] : raw;
        if (!routePath.startsWith("/")) continue;
        const prefix = prefixAt(m[1], m.index ?? 0);
        const chained = m[0].match(METHODS_CHAIN_RE);
        const methods = chained ? [...chained[1].matchAll(/["`]([A-Za-z]+)["`]/g)].map((v) => v[1].toUpperCase()).filter((v) => STD_VERBS.test(v)) : [];
        const route = joinRoute(prefix, routePath);
        if (verbInPattern) {
          routes.push({ route, file: path, kind: "api", method: verbInPattern[1] });
        } else if (methods.length) {
          for (const v of methods) routes.push({ route, file: path, kind: "api", method: v });
        } else {
          routes.push({ route, file: path, kind: "api" });
        }
      }
      for (const m of src.matchAll(MOUNT_RE3)) {
        const seg = m[2];
        if (!seg.startsWith("/")) continue;
        routes.push({
          route: joinRoute(prefixAt(m[1], m.index ?? 0), seg),
          file: path,
          kind: "api"
        });
      }
    }
    return routes;
  }
};

// src/adapters/trpc.ts
var ROUTER_DECL_RE = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:createTRPCRouter|\w+\.router)\s*\(/g;
var REQUIRE_RE4 = /(?:const|let|var)\s+\{([^}]*)\}\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
var IMPORT_RE4 = /import\s+\{([^}]*)\}\s+from\s+["'`](\.[^"'`]*)["'`]/g;
var METHOD_MARKERS = [
  [/\.subscription\s*\(/, "SUBSCRIPTION"],
  [/\.mutation\s*\(/, "MUTATION"],
  [/\.query\s*\(/, "QUERY"]
];
function extractObjectBody(src, fromIdx) {
  let i = fromIdx;
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] !== "{") return null;
  const start = i;
  let depth = 0;
  let str = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (str) {
      if (c === "\\") i++;
      else if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") str = c;
    else if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") {
      depth--;
      if (depth === 0) return src.slice(start + 1, i);
    }
  }
  return null;
}
function topLevelEntries(body) {
  const segments = [];
  let depth = 0;
  let str = null;
  let seg = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (str) {
      seg += c;
      if (c === "\\") {
        seg += body[i + 1] ?? "";
        i++;
      } else if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      str = c;
      seg += c;
      continue;
    }
    if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") depth--;
    if (c === "," && depth === 0) {
      segments.push(seg);
      seg = "";
      continue;
    }
    seg += c;
  }
  if (seg.trim()) segments.push(seg);
  const out = [];
  for (const raw of segments) {
    const s = raw.trim();
    if (!s) continue;
    let d = 0;
    let q = null;
    let colon = -1;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) {
        if (c === "\\") i++;
        else if (c === q) q = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") q = c;
      else if (c === "{" || c === "(" || c === "[") d++;
      else if (c === "}" || c === ")" || c === "]") d--;
      else if (c === ":" && d === 0) {
        colon = i;
        break;
      }
    }
    if (colon === -1) {
      const key = /^\w+/.exec(s)?.[0];
      if (key) out.push({ key, value: key });
    } else {
      const key = s.slice(0, colon).trim().replace(/^["'`]|["'`]$/g, "");
      out.push({ key, value: s.slice(colon + 1).trim() });
    }
  }
  return out;
}
function procedureMethod(value) {
  for (const [re, method] of METHOD_MARKERS) if (re.test(value)) return method;
  return null;
}
var INLINE_ROUTER_RE = /^(?:createTRPCRouter|\w+\.router)\s*\(/;
function parseRouterBody(body, file) {
  const def = { file, procedures: [], children: [], inlineChildren: [] };
  for (const { key, value } of topLevelEntries(body)) {
    const method = procedureMethod(value);
    if (method) {
      def.procedures.push({ name: key, method });
      continue;
    }
    if (INLINE_ROUTER_RE.test(value)) {
      const inner = extractObjectBody(value, value.indexOf("(") + 1);
      if (inner !== null) def.inlineChildren.push({ name: key, def: parseRouterBody(inner, file) });
      continue;
    }
    const ident = /^\w+$/.exec(value.trim());
    if (ident) def.children.push({ name: key, ref: value.trim() });
  }
  return def;
}
var trpcAdapter = {
  id: "trpc",
  frameworks: [],
  libraries: ["tRPC"],
  detectRoutes(files, repo) {
    const sources = readSources(files, repo, JS_SRC_EXTS);
    const routers = /* @__PURE__ */ new Map();
    const importsByFile = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      const imports = /* @__PURE__ */ new Map();
      for (const re of [IMPORT_RE4, REQUIRE_RE4]) {
        for (const m of src.matchAll(re)) {
          const target = resolveModule(path, m[2], sources);
          if (!target) continue;
          for (const name of m[1].split(",")) {
            const id = name.trim().split(/\s+as\s+/).pop()?.trim();
            if (id) imports.set(id, target);
          }
        }
      }
      importsByFile.set(path, imports);
      for (const m of src.matchAll(ROUTER_DECL_RE)) {
        const varName = m[1];
        const body = extractObjectBody(src, (m.index ?? 0) + m[0].length);
        if (body === null) continue;
        routers.set(`${path}::${varName}`, parseRouterBody(body, path));
      }
    }
    const resolveRef = (file, ref) => {
      if (routers.has(`${file}::${ref}`)) return `${file}::${ref}`;
      const target = importsByFile.get(file)?.get(ref);
      if (target && routers.has(`${target}::${ref}`)) return `${target}::${ref}`;
      return null;
    };
    const referenced = /* @__PURE__ */ new Set();
    for (const [id, def] of routers) {
      const file = id.slice(0, id.lastIndexOf("::"));
      for (const c of def.children) {
        const target = resolveRef(file, c.ref);
        if (target) referenced.add(target);
      }
    }
    const routes = [];
    const emit = (def, prefix, seen) => {
      const at = (name) => prefix ? `${prefix}.${name}` : name;
      for (const p of def.procedures) routes.push({ route: at(p.name), file: def.file, kind: "api", method: p.method });
      for (const ic of def.inlineChildren) emit(ic.def, at(ic.name), seen);
      for (const c of def.children) {
        const target = resolveRef(def.file, c.ref);
        if (!target || seen.has(target)) continue;
        emit(routers.get(target), at(c.name), /* @__PURE__ */ new Set([...seen, target]));
      }
    };
    for (const [id, def] of routers) if (!referenced.has(id)) emit(def, "", /* @__PURE__ */ new Set([id]));
    return routes;
  }
};

// src/adapters/registry.ts
var ROUTE_ADAPTERS = [
  nextjsAdapter,
  flaskAdapter,
  fastapiAdapter,
  nestjsAdapter,
  expressAdapter,
  fastifyAdapter,
  honoAdapter,
  djangoAdapter,
  railsAdapter,
  goAdapter,
  trpcAdapter
];
function detectRoutes(files, stack, repo) {
  const active = ROUTE_ADAPTERS.filter(
    (a) => a.frameworks.some((f) => stack.frameworks.includes(f)) || (a.libraries?.some((l) => stack.libraries.includes(l)) ?? false)
  );
  const seen = /* @__PURE__ */ new Set();
  const merged = [];
  for (const adapter of active) {
    for (const r of adapter.detectRoutes(files, repo)) {
      const key = `${r.method ?? ""} ${r.kind} ${r.route} ${r.file}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(r);
    }
  }
  merged.sort((a, b) => a.route.localeCompare(b.route) || a.kind.localeCompare(b.kind) || (a.method ?? "").localeCompare(b.method ?? ""));
  return merged;
}

// src/adapters/i18n.ts
import { readFileSync as readFileSync7 } from "fs";
import { join as join8, basename as basename2, extname as extname2 } from "path";
var LOCALE_RE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?(-[A-Za-z0-9]{2,8})*$/;
var I18N_DIR_RE = /^(locales?|i18n|lang|langs|translations|messages)$/i;
function countJsonLeaves(value) {
  if (value === null || typeof value !== "object") return 1;
  if (Array.isArray(value)) return value.length || 1;
  let n = 0;
  for (const v of Object.values(value)) {
    n += countJsonLeaves(v);
  }
  return n;
}
function localeOf(path) {
  const ext = extname2(path);
  const base = basename2(path, ext);
  if (LOCALE_RE.test(base)) return base;
  const parts = path.split("/");
  const parent = parts[parts.length - 2];
  if (parent && LOCALE_RE.test(parent)) return parent;
  const grand = parts[parts.length - 3];
  if (parent && grand && I18N_DIR_RE.test(grand)) return parent;
  return base;
}
function keysIn(repo, f) {
  try {
    const raw = readFileSync7(join8(repo, f.path), "utf8");
    if (f.ext === ".json") return countJsonLeaves(JSON.parse(raw));
    return raw.split(/\r?\n/).filter((l) => /^[\s-]*[\w.-]+\s*:/.test(l) || /^msgid/.test(l)).length;
  } catch {
    return 0;
  }
}
function detectI18n(repo, files) {
  const i18nFiles = files.filter((f) => f.category === "i18n");
  if (i18nFiles.length === 0) return null;
  const locales = /* @__PURE__ */ new Set();
  const keysByLocale = /* @__PURE__ */ new Map();
  for (const f of i18nFiles) {
    const loc = localeOf(f.path);
    locales.add(loc);
    keysByLocale.set(loc, (keysByLocale.get(loc) ?? 0) + keysIn(repo, f));
  }
  const keyCount = Math.max(0, ...keysByLocale.values());
  return {
    locales: [...locales].sort(),
    files: i18nFiles.map((f) => f.path).sort(),
    keyCount
  };
}

// src/features.ts
var ROOTS = ["src/app/", "src/pages/", "src/components/", "src/lib/", "src/server/", "src/", "app/", "pages/", "lib/", "server/", "components/", "packages/"];
function stripRoot(path) {
  let p = path;
  for (const root of ROOTS) {
    if (p.startsWith(root)) {
      p = p.slice(root.length);
      break;
    }
  }
  return p.split("/");
}
function isSkippableSegment(seg) {
  return seg.startsWith("(") && seg.endsWith(")") || seg.startsWith("[") && seg.endsWith("]") || seg.startsWith("@");
}
function featureKey(path) {
  const segs = stripRoot(path);
  let i = 0;
  while (i < segs.length - 1 && isSkippableSegment(segs[i])) {
    i++;
  }
  if (segs.length - i <= 1) return "core";
  return segs[i];
}
function routeKey(route) {
  const segs = route.split("/").filter(Boolean);
  let i = 0;
  while (i < segs.length && isSkippableSegment(segs[i])) {
    i++;
  }
  return segs[i] ?? "core";
}
var NAME_OVERRIDES = {
  ui: "UI",
  api: "API",
  db: "DB",
  seo: "SEO",
  e2e: "E2E",
  trpc: "tRPC",
  i18n: "i18n",
  cms: "CMS",
  sdk: "SDK",
  cli: "CLI",
  url: "URL",
  ssr: "SSR",
  ssg: "SSG",
  graphql: "GraphQL"
};
function humanize(key) {
  if (key === "core") return "Core";
  const cleaned = key.replace(/^\[+\.{0,3}/, "").replace(/\]+$/, "").replace(/^\(+|\)+$/g, "");
  const override = NAME_OVERRIDES[cleaned.toLowerCase()];
  if (override) return override;
  return cleaned.replace(/[-_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
}
function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}
var FOUNDATION_KEYS = /* @__PURE__ */ new Set([
  "core",
  "types",
  "type",
  "config",
  "env",
  "db",
  "database",
  "schema",
  "schemas",
  "model",
  "models",
  "entities",
  "prisma",
  "drizzle",
  "migrations",
  "style",
  "styles",
  "css",
  "theme",
  "ui",
  "components",
  "component",
  "lib",
  "libs",
  "util",
  "utils",
  "helpers",
  "hooks",
  "store",
  "stores",
  "state",
  "context",
  "providers",
  "server",
  "services",
  "service",
  "client",
  "api",
  "rpc",
  "trpc",
  "graphql",
  "gql",
  "auth",
  "middleware",
  "i18n",
  "locales"
]);
var TEST_KEYS = /* @__PURE__ */ new Set(["test", "tests", "__tests__", "spec", "specs", "e2e", "cypress", "playwright"]);
var FOUNDATION_ORDER = [
  "core",
  "types",
  "type",
  "config",
  "env",
  "db",
  "database",
  "schema",
  "schemas",
  "model",
  "models",
  "entities",
  "style",
  "styles",
  "css",
  "theme",
  "ui",
  "components",
  "component",
  "lib",
  "libs",
  "util",
  "utils",
  "helpers",
  "hooks",
  "store",
  "stores",
  "state",
  "context",
  "providers",
  "server",
  "services",
  "service",
  "client",
  "api",
  "rpc",
  "trpc",
  "graphql",
  "gql",
  "auth",
  "middleware",
  "i18n",
  "locales"
];
var SCHEMA_RANK = FOUNDATION_ORDER.indexOf("schema");
var WS_RANK_SPAN = 100;
var DATA_LAYER_KEYS = /* @__PURE__ */ new Set(["prisma", "drizzle", "migrations"]);
function foundationRank(key, hasSchema) {
  const i = FOUNDATION_ORDER.indexOf(key);
  if (i !== -1) return i;
  if (DATA_LAYER_KEYS.has(key) || hasSchema) return SCHEMA_RANK;
  return Number.POSITIVE_INFINITY;
}
function orderFeatures(records) {
  records.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.size !== b.size) return b.size - a.size;
    return a.feature.name.localeCompare(b.feature.name);
  });
  return records.map((r, i) => ({
    ...r.feature,
    slug: `${String(i + 1).padStart(2, "0")}-${r.feature.slug}`
  }));
}
function makeWsContext(workspaces, routes) {
  const lastSeg2 = (p) => p.split("/").pop() ?? p;
  const segCounts = /* @__PURE__ */ new Map();
  for (const ws of workspaces) {
    const seg = lastSeg2(ws.path);
    segCounts.set(seg, (segCounts.get(seg) ?? 0) + 1);
  }
  const shortOf = new Map(
    workspaces.map((ws) => {
      const seg = lastSeg2(ws.path);
      return [ws.path, (segCounts.get(seg) ?? 0) > 1 ? slugify(ws.path) : seg];
    })
  );
  const appNames = new Set(routes.map((r) => r.workspace).filter((n) => Boolean(n)));
  const topoIndex = new Map(topoOrderWorkspaces(workspaces).map((name, i) => [name, i]));
  const dependedOn = new Set(workspaces.flatMap((ws) => ws.dependsOn ?? []));
  return {
    matcher: workspaceMatcher(workspaces),
    shortOf,
    appNames,
    topoIndex,
    dependedOn,
    groups: /* @__PURE__ */ new Map()
  };
}
function wsKeyFor(ctx, ws, innerPath) {
  const short = ctx.shortOf.get(ws.path);
  const key = ctx.appNames.has(ws.name) ? `${short}/${featureKey(innerPath)}` : `ws:${short}`;
  if (!ctx.groups.has(key)) {
    ctx.groups.set(key, {
      ws,
      ...ctx.appNames.has(ws.name) ? { inner: featureKey(innerPath) } : {}
    });
  }
  return key;
}
function buildFeatures(files, routes, i18n, granularity = "coarse", workspaces = []) {
  const ctx = workspaces.length ? makeWsContext(workspaces, routes) : null;
  const keyForFile = (path) => {
    const ws = ctx?.matcher(path);
    return ws ? wsKeyFor(ctx, ws, path.slice(ws.path.length + 1)) : featureKey(path);
  };
  const innerOf = (key) => ctx?.groups.get(key)?.inner ?? key;
  const isLibGroup = (key) => Boolean(ctx?.groups.get(key)) && !ctx?.groups.get(key)?.inner;
  const codeGroups = /* @__PURE__ */ new Map();
  const schemaPaths = /* @__PURE__ */ new Set();
  const configFiles = [];
  const docFiles = [];
  for (const f of files) {
    if (f.category === "schema") schemaPaths.add(f.path);
    if (f.category === "config") {
      configFiles.push(f.path);
    } else if (f.category === "doc") {
      docFiles.push(f.path);
    } else if (f.category === "code" || f.category === "test" || f.category === "style" || f.category === "schema") {
      const key = keyForFile(f.path);
      const list = codeGroups.get(key) ?? [];
      list.push(f.path);
      codeGroups.set(key, list);
    }
  }
  const routesByKey = /* @__PURE__ */ new Map();
  for (const r of routes) {
    const ws = ctx && r.workspace ? workspaces.find((w) => w.name === r.workspace) : void 0;
    const k = ws && ctx ? `${ctx.shortOf.get(ws.path)}/${routeKey(r.route)}` : routeKey(r.route);
    if (ws && ctx && !ctx.groups.has(k)) ctx.groups.set(k, { ws, inner: routeKey(r.route) });
    const list = routesByKey.get(k) ?? [];
    list.push(r);
    routesByKey.set(k, list);
  }
  const groupHasSchema = (groupFiles) => groupFiles.some((p) => schemaPaths.has(p));
  const isFoundationGroup = (key, groupFiles) => FOUNDATION_KEYS.has(innerOf(key)) || groupHasSchema(groupFiles);
  if (granularity === "coarse") {
    const foldTarget = (key) => {
      const group = ctx?.groups.get(key);
      if (!group?.inner) return "core";
      const short = ctx?.shortOf.get(group.ws.path);
      return `${short}/core`;
    };
    for (const [key, groupFiles] of [...codeGroups.entries()]) {
      if (key === "core" || innerOf(key) === "core" || isLibGroup(key)) continue;
      const routeCount = routesByKey.get(key)?.length ?? 0;
      const trivial = groupFiles.length === 1 && routeCount === 0 && !isFoundationGroup(key, groupFiles) && !TEST_KEYS.has(innerOf(key));
      if (trivial) {
        const target = foldTarget(key);
        if (target !== "core" && ctx && !ctx.groups.has(target)) {
          const group = ctx.groups.get(key);
          if (group) ctx.groups.set(target, { ws: group.ws, inner: "core" });
        }
        codeGroups.set(target, [...codeGroups.get(target) ?? [], ...groupFiles]);
        codeGroups.delete(key);
      }
    }
  }
  const records = [];
  for (const [key, groupFiles] of codeGroups.entries()) {
    const featureRoutes = routesByKey.get(key) ?? [];
    const wsGroup = ctx?.groups.get(key);
    const short = wsGroup ? ctx?.shortOf.get(wsGroup.ws.path) : "";
    const name = wsGroup ? wsGroup.inner ? `${humanize(short)} \xB7 ${humanize(wsGroup.inner)}` : humanize(short) + (wsGroup.ws.name !== short ? ` (${wsGroup.ws.name})` : "") : humanize(key);
    const slug = wsGroup ? wsGroup.inner ? slugify(`${short}-${humanize(wsGroup.inner)}`) : slugify(short) : slugify(name);
    const routeList = featureRoutes.map((r) => r.route);
    const uniqueRoutes = [...new Set(routeList)];
    const desc = `Groups ${groupFiles.length} file(s)` + (wsGroup ? ` in workspace \`${wsGroup.ws.path}\`` : "") + (uniqueRoutes.length ? `; routes: ${uniqueRoutes.slice(0, 6).join(", ")}` : "") + ".";
    const hasSchema = groupHasSchema(groupFiles);
    const topoBase = wsGroup ? (ctx?.topoIndex.get(wsGroup.ws.name) ?? 0) * WS_RANK_SPAN : 0;
    let tier;
    let rank;
    if (wsGroup && !wsGroup.inner) {
      const isDep = ctx?.dependedOn.has(wsGroup.ws.name) ?? false;
      tier = isDep ? 0 : 1;
      rank = topoBase;
    } else {
      const structuralKey = innerOf(key);
      tier = TEST_KEYS.has(structuralKey) ? 2 : isFoundationGroup(key, groupFiles) ? 0 : 1;
      rank = topoBase + (tier === 0 ? foundationRank(structuralKey, hasSchema) : 0);
    }
    records.push({
      feature: {
        slug,
        name,
        description: desc,
        kind: "feature",
        files: groupFiles.sort(),
        routes: featureRoutes
      },
      key,
      tier,
      rank,
      size: groupFiles.length
    });
  }
  if (i18n) {
    records.push({
      feature: {
        slug: "internationalization",
        name: "Internationalization",
        description: `${i18n.locales.length} locale(s) (${i18n.locales.join(", ")}), up to ${i18n.keyCount} keys per locale.`,
        kind: "internationalization",
        files: i18n.files,
        routes: []
      },
      key: "i18n",
      tier: 0,
      rank: foundationRank("i18n", false),
      size: i18n.files.length
    });
  }
  if (configFiles.length) {
    records.push({
      feature: {
        slug: "project-setup",
        name: "Project Setup & Tooling",
        description: `${configFiles.length} configuration/tooling file(s): build, lint, env, CI.`,
        kind: "project-setup",
        files: configFiles.sort(),
        routes: []
      },
      key: "config",
      tier: 0,
      rank: foundationRank("config", false),
      size: configFiles.length
    });
  }
  if (docFiles.length) {
    records.push({
      feature: {
        slug: "documentation",
        name: "Documentation",
        description: `${docFiles.length} documentation file(s).`,
        kind: "documentation",
        files: docFiles.sort(),
        routes: []
      },
      key: "documentation",
      tier: 2,
      rank: 1,
      // docs sort after dedicated test buckets in the tail tier
      size: docFiles.length
    });
  }
  return orderFeatures(records);
}

// src/types.ts
var VERSION = "1.3.0";

// src/analyze.ts
function computeUnknowns(stack, routes, hints, workspaces) {
  const u = [];
  if (workspaces.length > 0) {
    u.push(
      "Monorepo: workspaces were detected (`workspaces[*]` carries each one's stack, dependencies, hints, and `dependsOn`) \u2014 verify each workspace's role (app / package / service) and extend the dependency graph with implicit edges (HTTP calls between apps, generated clients, shared env vars); deterministic edges come from manifest declarations only."
    );
  }
  if (stack.frameworks.length === 0) {
    u.push(
      "No web framework was detected from manifests \u2014 identify the stack from `stack.languages` + `dependencies`, find the entry points (`hints.entryPoints`, else the file tree), then map the interface surface manually."
    );
  }
  if (routes.length === 0 && (hints.routeCandidates.length > 0 || hints.apiCandidates.length > 0)) {
    u.push(
      "Routes were not resolved deterministically (a framework without a dedicated route adapter, or an RPC/GraphQL surface) \u2014 derive the real interface surface from `hints.routeCandidates` / `hints.apiCandidates` into `architecture/INTERFACES.md`."
    );
  }
  if (hints.apiCandidates.length > 0) {
    u.push(
      "API surface candidates (tRPC / GraphQL / gRPC / OpenAPI) were found but not enumerated \u2014 read each and list every procedure/operation in `architecture/INTERFACES.md`."
    );
  }
  if (hints.schemaCandidates.length > 0) {
    u.push(
      "The data model is not structured by the engine \u2014 extract entities, fields, types, and relations from `hints.schemaCandidates` into `architecture/DATA-MODEL.md`."
    );
  }
  if (hints.realtimeCandidates.length > 0) {
    u.push(
      "Realtime/WebSocket signals were found \u2014 enumerate the channels, events, and message shapes from `hints.realtimeCandidates` in `architecture/INTERFACES.md`; they rarely appear in HTTP route tables."
    );
  }
  if (hints.authCandidates.length > 0) {
    u.push(
      "Auth/middleware signals were found \u2014 read `hints.authCandidates` and record the auth rule per operation in the `architecture/INTERFACES.md` interface table's Auth column."
    );
  }
  if (hints.designSystemCandidates.length > 0) {
    u.push(
      "Design-system source files were found (Tailwind/theme configs, token modules, global CSS) \u2014 capture the visual contract (tokens with their exact values, theming, typography, components, a11y) from `hints.designSystemCandidates` in `architecture/DESIGN-SYSTEM.md`."
    );
  }
  return u;
}
function analyze(opts) {
  const { files, excludedCount } = walk(opts.repo, {
    include: opts.include,
    exclude: opts.exclude,
    out: opts.out
  });
  const warnings = [];
  let stack = detectStack(opts.repo, files, warnings);
  const workspaces = detectWorkspaces(opts.repo, warnings);
  if (workspaces.length > 0) {
    buildWorkspaceGraph(opts.repo, workspaces, warnings);
    enrichWorkspaceStacks(opts.repo, workspaces, files, warnings);
    stack = mergeWorkspaceStacks(stack, workspaces);
    const cycle = findWorkspaceCycle(workspaces);
    if (cycle) {
      warnings.push(`workspace dependency cycle: ${cycle.join(" \u2192 ")} \u2014 the build order falls back to path order for these workspaces`);
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
  const stylingLibraries = detectStylingLibraries(stack.libraries);
  return {
    generatedWith: `reconstruct@${VERSION}`,
    generation: {
      mode: opts.mode,
      level: opts.level,
      fidelity: opts.fidelity,
      granularity: opts.granularity
    },
    repoName: basename3(opts.repo) || "project",
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
    ...uniqueWarnings.length ? { warnings: uniqueWarnings } : {},
    ...workspaces.length ? { workspaces } : {},
    ...node ? { runtime: { node } } : {},
    excludedCount
  };
}

// src/prd/render.ts
import { join as join10 } from "path";

// src/prd/templates.ts
function agentNote(body) {
  return `> \u{1F9E0} **For the AI agent:** ${body}
`;
}
function metaBlock(inv, opts) {
  return [
    "| Setting | Value |",
    "| --- | --- |",
    `| Mode | \`${opts.mode}\` |`,
    `| Level | \`${opts.level}\` |`,
    `| Fidelity | \`${opts.fidelity}\` |`,
    ...opts.tdd ? ["| TDD | `on` (build test-first) |"] : [],
    `| Generated with | \`${inv.generatedWith}\` |`,
    ""
  ].join("\n");
}
function cell(value) {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
function filledInterfaceTable(rows) {
  const header = ["| Method / Trigger | Path / Operation | Kind | Auth | Notes |", "| --- | --- | --- | --- | --- |"];
  if (!rows.length) {
    return [...header, "", "_Add one row per operation as the surface takes shape._"].join("\n");
  }
  const body = rows.map((r) => `| ${cell(r.method)} | \`${cell(r.path)}\` | ${cell(r.kind ?? "")} | ${cell(r.auth ?? "")} | ${cell(r.notes ?? "")} |`);
  return [...header, ...body].join("\n");
}
function filledEntityTables(entities) {
  if (!entities.length) return "_No entities yet \u2014 add them as the model takes shape._";
  const parts = [];
  for (const e of entities) {
    parts.push(`### ${e.entity}`, "", "| Field | Type | Constraints |", "| --- | --- | --- |");
    if (e.fields.length) {
      for (const f of e.fields) {
        parts.push(`| ${cell(f.name)} | ${cell(f.type)} | ${cell(f.constraints ?? "")} |`);
      }
    } else {
      parts.push("| _tbd_ | | |");
    }
    parts.push("");
    if (e.relations?.length) {
      parts.push("Relations:", "");
      for (const r of e.relations) parts.push(`- ${r}`);
      parts.push("");
    }
    if (e.indexes?.length) {
      parts.push("Indexes:", "");
      for (const ix of e.indexes) parts.push(`- ${ix}`);
      parts.push("");
    }
    if (e.uniques?.length) {
      parts.push("Unique constraints:", "");
      for (const u of e.uniques) parts.push(`- ${u}`);
      parts.push("");
    }
  }
  return parts.join("\n").trimEnd();
}
function enumsBlock(enums) {
  const lines = ["## Enums & domain types", ""];
  if (!enums || !enums.length) {
    lines.push("_No standalone enums. Every enum-typed field above must still enumerate its full member set inline (e.g. `ADMIN \\| USER`)._");
    return lines.join("\n");
  }
  for (const e of enums) {
    lines.push(`### ${e.name}`, "");
    if (e.description) lines.push(e.description, "");
    lines.push(`- Members: ${e.members.map((m) => `\`${m}\``).join(", ") || "_none \u2014 fill in_"}`, "");
  }
  return lines.join("\n").trimEnd();
}
function servicesBlock(services) {
  const lines = ["## External services & integrations", ""];
  for (const s of services) {
    lines.push(`### ${s.name}${s.provider ? ` (${s.provider})` : ""}`, "", s.purpose, "");
    if (s.operations?.length) {
      lines.push("Operations:", "");
      for (const op of s.operations) {
        lines.push(`- \`${op.name}\`${op.input ? ` \u2014 in: ${op.input}` : ""}${op.output ? ` \u2192 out: ${op.output}` : ""}`);
      }
      lines.push("");
    }
    if (s.request) lines.push(`- **Request:** ${s.request}`);
    if (s.response) lines.push(`- **Response:** ${s.response}`);
    if (s.timeout) lines.push(`- **Timeout:** ${s.timeout}`);
    if (s.onFailure) lines.push(`- **On failure:** ${s.onFailure}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
function policiesBlock(policies) {
  const lines = ["## Cross-cutting policies", "", "| Policy | Kind | Rule | Applies to |", "| --- | --- | --- | --- |"];
  for (const p of policies) {
    lines.push(`| ${cell(p.name)} | ${cell(p.kind ?? "")} | ${cell(p.rule)} | ${cell((p.appliesTo ?? []).join(", "))} |`);
  }
  return lines.join("\n");
}
function messageCatalogBlock(i18n) {
  const m = i18n.messages;
  const lines = ["## Internationalization \u2014 message catalog", ""];
  lines.push(`Locales: ${i18n.locales.join(", ")}.`, "");
  if (!m) {
    lines.push(
      agentNote(
        "Author the message catalog: list every namespace and every user-facing key with its source string, then translate into all locales above. A key without a source string is not buildable."
      )
    );
    return lines.join("\n").trimEnd();
  }
  if (m.sourceLocale) lines.push(`Source locale: \`${m.sourceLocale}\`.`, "");
  if (m.namespaces?.length) lines.push(`Namespaces: ${m.namespaces.map((n) => `\`${n}\``).join(", ")}.`, "");
  if (m.entries?.length) {
    lines.push("| Key | Source string |", "| --- | --- |");
    for (const e of m.entries) lines.push(`| \`${cell(e.key)}\` | ${cell(e.source ?? "")} |`);
    lines.push("");
  }
  lines.push(
    agentNote(
      `Complete the catalog: every user-facing key must have a source string and resolve in all ${i18n.locales.length} locales (${i18n.locales.join(", ")}). The keys above are the contract \u2014 extend, don't trim.`
    )
  );
  return lines.join("\n").trimEnd();
}
function operationContracts(rows) {
  const detailed = rows.filter((r) => r.input || r.output || r.sideEffects && r.sideEffects.length);
  if (!detailed.length) return "";
  const lines = ["## Operation contracts", ""];
  for (const r of detailed) {
    lines.push(`### \`${r.path}\`${r.auth ? ` \xB7 auth: ${r.auth}` : ""}`, "");
    if (r.input) lines.push(`- **Input:** ${r.input}`);
    if (r.output) lines.push(`- **Output:** ${r.output}`);
    if (r.sideEffects?.length) lines.push(`- **Side effects:** ${r.sideEffects.join("; ")}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
function overviewPrd(inv, opts) {
  const isScratch = opts.mode === "scratch";
  const s = inv.stack;
  const featureIndex = inv.features.map((f) => `- [\`${f.slug}\`](../features/${f.slug}/PRD.md) \u2014 **${f.name}**: ${f.description}`).join("\n");
  const productSummary = isScratch ? [
    inv.product?.summary ?? "",
    ...inv.product?.audience ? ["", `**Audience:** ${inv.product.audience}`] : [],
    ...inv.product?.value ? ["", `**Core value:** ${inv.product.value}`] : [],
    "",
    agentNote("Expand this into a 1\u20132 paragraph product summary grounded in `../CONTEXT.md` (the glossary) and the feature list below.")
  ].join("\n") : opts.level === "complex" ? agentNote(
    "Write a 1\u20132 paragraph product summary: what this project does, for whom, and the core value. Infer it from the README, routes, and feature names below, then refine."
  ) : "_Summarize what this project does, derived from the README and the feature list below._";
  const out = [
    `# ${inv.repoName} \u2014 Reconstruction Overview`,
    "",
    metaBlock(inv, opts),
    "## Product summary",
    "",
    productSummary,
    "",
    "## Tech stack",
    "",
    `- **Primary language:** ${s.primaryLanguage}`,
    `- **Languages:** ${s.languages.join(", ") || "n/a"}`,
    `- **Frameworks:** ${s.frameworks.join(", ") || "none detected"}`,
    `- **Libraries:** ${s.libraries.join(", ") || "none detected"}`,
    `- **Package managers:** ${s.packageManagers.join(", ") || "n/a"}`,
    `- **TypeScript:** ${s.hasTypeScript ? "yes" : "no"}`,
    "",
    "## Metrics",
    "",
    isScratch ? `- Files: **0** \u2014 greenfield (designed from the interview, not read from source)` : `- Files analyzed: **${inv.fileCount}** (${inv.totalLines} lines)`,
    `- Features/modules: **${inv.features.length}**`,
    `- Routes: **${inv.routes.length}**`,
    `- Locales: **${inv.i18n ? inv.i18n.locales.length : 0}**`,
    `- Tracked env vars: **${inv.envVars.length}**`,
    "",
    "## Feature index",
    "",
    featureIndex || "_No features detected._",
    "",
    "## How to use this output",
    "",
    ...isScratch ? [
      "1. Read `../CONTEXT.md` (the glossary) and the decisions in `../docs/adr/` \u2014 they are the ground truth for terminology and constraints.",
      "2. Read `architecture/ARCHITECTURE.md`, then the pre-filled `architecture/INTERFACES.md` and `architecture/DATA-MODEL.md` (refine them).",
      "3. Build feature by feature using each `features/<slug>/PRD.md`, in the order listed in `REBUILD.md`."
    ] : [
      "1. Read `architecture/ARCHITECTURE.md` for the overall shape, then `architecture/INTERFACES.md` (the full interface surface) and `architecture/DATA-MODEL.md` (entities & relations).",
      "2. Rebuild feature by feature using each `features/<slug>/PRD.md`, in the order listed in `REBUILD.md`.",
      "3. Use `data/` (translations, schema, config) and \u2014 when present \u2014 `source/` as ground truth."
    ],
    ""
  ];
  if (opts.mode === "redesign") {
    out.push(
      "## Redesign note",
      "",
      agentNote(
        "This run is in **redesign** mode: preserve every feature's behavior and logic, but you are free to propose a cleaner architecture in `architecture/ARCHITECTURE.md`."
      ),
      ""
    );
  }
  return out.join("\n");
}
function workspacesBlock(workspaces) {
  const rows = workspaces.map((w) => {
    const stack = [...w.stack?.frameworks ?? [], ...w.stack?.frameworks?.length ? [] : [w.stack?.primaryLanguage ?? "\u2014"]].join(", ");
    return `| \`${w.name}\` | \`${w.path}/\` | ${w.kind ?? "\u2014"} | ${stack || "\u2014"} | ${w.dependsOn?.map((d) => `\`${d}\``).join(", ") || "\u2014"} | ${w.routeCount ?? 0} |`;
  });
  return [
    "## Workspaces",
    "",
    "| Workspace | Path | Kind | Stack | Depends on | Routes |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    agentNote(
      "Verify each workspace's role (app / package / service) and **extend the dependency graph**: the `Depends on` column carries manifest-declared edges only \u2014 add the implicit ones (HTTP calls between apps, generated clients, shared env vars, queues) and draw the result in `diagram.md`. Map each shared package once and reference it from the apps that consume it."
    )
  ].join("\n");
}
function architectureDoc(inv, opts) {
  const isScratch = opts.mode === "scratch";
  const topDirs = [...new Set(inv.files.filter((f) => f.path.includes("/")).map((f) => f.path.split("/")[0]))].sort();
  const rootFiles = inv.files.filter((f) => !f.path.includes("/")).map((f) => f.path).sort();
  const deps = inv.dependencies.map((d) => `- **${d.manager}** (\`${d.manifest}\`): ${Object.keys(d.runtime).length} runtime, ${Object.keys(d.dev).length} dev`).join("\n");
  const common = [
    `# Architecture`,
    "",
    metaBlock(inv, opts),
    "## Detected stack",
    "",
    `${inv.stack.frameworks.join(", ") || "No framework detected"} \xB7 ${inv.stack.primaryLanguage}`,
    "",
    ...inv.stack.libraries.length ? [`**Libraries:** ${inv.stack.libraries.join(", ")}`, ""] : [],
    "## Top-level layout",
    "",
    (topDirs.map((d) => `- \`${d}/\``).join("\n") || "_Flat layout (no subdirectories)._") + (rootFiles.length ? `
- root files: ${rootFiles.map((f) => `\`${f}\``).join(", ")}` : ""),
    "",
    ...inv.workspaces?.length ? [workspacesBlock(inv.workspaces), ""] : [],
    "## Dependencies",
    "",
    deps || "_No dependency manifests found._",
    "",
    "## Data & schema",
    "",
    inv.schemas.length ? inv.schemas.map((s) => `- \`${s}\``).join("\n") : "_No schema/model files detected._",
    "",
    "## Internationalization",
    "",
    inv.i18n ? isScratch ? `Locales: ${inv.i18n.locales.join(", ")} \u2014 provide a messages file per locale (see the message catalog below).` : `Locales: ${inv.i18n.locales.join(", ")} \u2014 files copied to \`data/translations/\`.` : "_No i18n detected._",
    "",
    // External services & cross-cutting policies — rendered from the plan in
    // scratch mode, demanded via callouts otherwise. Both are buildability gaps
    // when left implicit (a named "geocoding" with no contract isn't rebuildable).
    ...isScratch && inv.services?.length ? [servicesBlock(inv.services), ""] : [
      "## External services & integrations",
      "",
      agentNote(
        "List **every** external service the project calls (payment, email, geocoding, storage, analytics, queues, third-party APIs). For each: provider, the exact request/response shape, timeout, and what happens on failure (best-effort? hard error?). Naming the service is not enough \u2014 capture the contract."
      ),
      ""
    ],
    ...isScratch && inv.policies?.length ? [policiesBlock(inv.policies), ""] : [
      "## Cross-cutting policies",
      "",
      agentNote(
        "Capture every cross-cutting rule that is otherwise left vague: rate limits (exact thresholds, window, key, store), format validations (e.g. national registry numbers \u2014 give the regex/checksum/length), and security policies. Each rule must be concrete enough to write a test against."
      ),
      ""
    ],
    ...isScratch && inv.i18n ? [messageCatalogBlock(inv.i18n), ""] : []
  ];
  if (isScratch) {
    common.push(
      "## Architecture (greenfield)",
      "",
      agentNote(
        "Design the architecture that delivers the features below. Decide module boundaries, data flow, and folder structure. Ground every decision in `../CONTEXT.md` (the glossary) and the ADRs in `../docs/adr/`. Document the proposed structure here as a directory tree plus a short rationale per module."
      ),
      ""
    );
    if (opts.level === "complex") {
      common.push(
        agentNote(
          "Also sketch 1\u20132 alternative architectures you considered and why you rejected them, and note enhancements beyond the MVP that the structure should leave room for."
        ),
        ""
      );
    }
  } else if (opts.mode === "preserve") {
    common.push(
      "## Reconstruction guidance (preserve)",
      "",
      "Reproduce the structure above as-is. Keep the same directory layout, framework, routing strategy, and data layer.",
      ""
    );
    if (opts.level === "complex") {
      common.push(
        agentNote(
          "While preserving the architecture, list any low-risk, high-value improvements (typing, error handling, test coverage) the rebuild should fold in."
        ),
        ""
      );
    }
  } else {
    common.push(
      "## Proposed architecture (redesign)",
      "",
      agentNote(
        "Design a fresh architecture that delivers the SAME features and logic. Decide module boundaries, data flow, and folder structure. Justify changes against the detected stack above. Keep behavior identical; improve structure, testability, and clarity."
      ),
      "",
      "Document the proposed structure here as a directory tree plus a short rationale per module.",
      ""
    );
  }
  return common.join("\n");
}
function listOrNone(items, empty) {
  return items.length ? items.map((s) => `- \`${s}\``).join("\n") : empty;
}
function interfacesDoc(inv, opts) {
  if (opts.mode === "scratch") {
    return [
      "# Interface surface",
      "",
      metaBlock(inv, opts),
      agentNote(
        "Design the complete interface surface from the interview & `../CONTEXT.md`. The table below is pre-filled from the plan \u2014 keep the columns, refine each row, and add any operation that's missing (HTTP routes, REST/JSON endpoints, tRPC/gRPC procedures, GraphQL operations, CLI commands, scheduled jobs, queues, webhooks)."
      ),
      "",
      "## Interface table",
      "",
      filledInterfaceTable(inv.interfaces ?? []),
      "",
      ...operationContracts(inv.interfaces ?? []) ? [operationContracts(inv.interfaces ?? []), ""] : [],
      agentNote(
        "Every operation needs an exact contract before it is buildable: the input shape (fields + types + validation), the output shape, the auth/permission rule, and the side effects (which entities it writes \u2014 and whether the write is transactional). Spell these out per operation; link shapes to `DATA-MODEL.md`."
      ),
      ""
    ].join("\n");
  }
  const routesTable = inv.routes.length ? [
    "| Method | Kind | Route | Handler file |",
    "| --- | --- | --- | --- |",
    ...inv.routes.map((r) => `| ${r.method ?? "\u2014"} | ${r.kind} | \`${r.route}\` | \`${r.file}\` |`)
  ].join("\n") : "_None resolved deterministically \u2014 read the candidate files below to map the surface._";
  const routeCandidates = /* @__PURE__ */ new Set([...inv.hints.routeCandidates]);
  for (const r of inv.routes) routeCandidates.delete(r.file);
  return [
    "# Interface surface",
    "",
    metaBlock(inv, opts),
    agentNote(
      "Enumerate **every** interface this project exposes \u2014 HTTP routes, REST/JSON endpoints, tRPC/gRPC procedures, GraphQL operations, CLI commands, scheduled jobs, queues, and webhooks. The deterministic engine resolves routes for the supported frameworks (Next.js, Express, Fastify, Hono, Flask, FastAPI, NestJS, Django, Rails, Go); for everything else, **read the candidate files below** and follow `references/analysis-playbook.md` (\xA7Interface surface) plus the matching guide in `references/stack-guides/`. Fill the target table with one row per operation."
    ),
    "",
    "## Resolved routes (deterministic \u2014 verify against source)",
    "",
    routesTable,
    "",
    "## Route candidates (verify \u2014 may include false positives)",
    "",
    listOrNone([...routeCandidates].sort(), "_No additional route candidates._"),
    "",
    "## API surface candidates (tRPC / GraphQL / gRPC / OpenAPI)",
    "",
    listOrNone(inv.hints.apiCandidates, "_No RPC/GraphQL/OpenAPI candidates detected._"),
    "",
    "## Realtime / WebSocket candidates (verify)",
    "",
    listOrNone(inv.hints.realtimeCandidates, "_No realtime/WebSocket signals detected._"),
    "",
    "## Auth / middleware candidates (verify)",
    "",
    listOrNone(inv.hints.authCandidates, "_No auth/middleware signals detected \u2014 still record the auth rule per operation below._"),
    "",
    "## Interface table (fill this in)",
    "",
    "| Method / Trigger | Path / Operation | Kind | Handler file | Auth | Notes |",
    "| --- | --- | --- | --- | --- | --- |",
    "",
    opts.level === "light" ? "_Keep these columns; add one row per route / endpoint / procedure / command / job. Cover the whole surface, not just the candidates above._" : agentNote(
      "Keep these columns; add a row per operation. Note auth/permission requirements, input/output shapes (link to `DATA-MODEL.md`), and side effects."
    ),
    ""
  ].join("\n");
}
function dataModelDoc(inv, opts) {
  if (opts.mode === "scratch") {
    return [
      "# Data model",
      "",
      metaBlock(inv, opts),
      agentNote(
        "Design the complete data model from the interview & `../CONTEXT.md`. The entities below are pre-filled from the plan \u2014 refine fields, types, constraints, and relations, and add anything missing. Capture primary keys, foreign keys, enums, defaults, and indexes."
      ),
      "",
      "## Entities",
      "",
      filledEntityTables(inv.dataModel ?? []),
      "",
      "## Relations & integrity",
      "",
      "_Summarize relationships, cascade rules, and any derived/computed data._",
      "",
      enumsBlock(inv.enums),
      ""
    ].join("\n");
  }
  const schemaFiles = [.../* @__PURE__ */ new Set([...inv.schemas, ...inv.hints.schemaCandidates])].sort();
  return [
    "# Data model",
    "",
    metaBlock(inv, opts),
    agentNote(
      "Reconstruct the data model from the schema/ORM files below (raw copies live in `data/schema/`). List **every** entity/table with its key fields + types, relations (1-1 / 1-N / N-N), and indexes/constraints. Follow `references/analysis-playbook.md` (\xA7Data model) and the ORM conventions in the matching `references/stack-guides/`."
    ),
    "",
    "## Schema / model source files",
    "",
    listOrNone(schemaFiles, "_No schema/model files detected \u2014 the data layer may be code-defined; investigate `hints`._"),
    "",
    "## Entities (fill this in)",
    "",
    "| Entity / Table | Field | Type | Constraints | Relation |",
    "| --- | --- | --- | --- | --- |",
    "",
    opts.level === "light" ? "_Keep these columns; one block of rows per entity. Capture primary keys, foreign keys, enums, defaults, and indexes._" : agentNote(
      "Keep these columns; for each entity capture fields + types, PK/FK, enums, defaults, indexes, and how it maps to the interfaces in `INTERFACES.md`."
    ),
    "",
    "## Relations & integrity",
    "",
    "_Summarize relationships, cascade rules, and any derived/computed data._",
    "",
    "## Enums & domain types",
    "",
    agentNote(
      "Enumerate **every** domain enum / fixed value set this schema uses \u2014 each with its **complete** member list (e.g. roles, statuses, categories). A field typed `enum`/`status`/`type` whose members are not listed here is not buildable: a fresh agent cannot validate it or write the test."
    ),
    ""
  ].join("\n");
}
function tokenList(label, items) {
  if (!items || !items.length) return [];
  return [`**${label}:**`, "", ...items.map((t) => `- \`${cell(t)}\``), ""];
}
function componentTable(components) {
  if (!components.length) return [];
  const lines = ["### Component library", "", "| Component | Source | Variants | States |", "| --- | --- | --- | --- |"];
  for (const c of components) {
    lines.push(`| ${cell(c.name)} | ${cell(c.source ?? "")} | ${cell((c.variants ?? []).join(", "))} | ${cell((c.states ?? []).join(", "))} |`);
  }
  lines.push("");
  return lines;
}
function filledDesignSystem(ds) {
  const parts = [];
  if (ds.brand) parts.push("### Brand identity", "", ds.brand, "");
  if (ds.tokens) {
    const t = ds.tokens;
    const tokenLines = [
      ...tokenList("Colors", t.colors),
      ...tokenList("Typography scale", t.typographyScale),
      ...tokenList("Spacing", t.spacing),
      ...tokenList("Sizing", t.sizing),
      ...tokenList("Radii", t.radii),
      ...tokenList("Shadows", t.shadows),
      ...tokenList("z-index", t.zIndex)
    ];
    if (tokenLines.length) parts.push("### Design tokens", "", ...tokenLines);
  }
  if (ds.theme) {
    const th = ds.theme;
    const lines = ["### Theming", ""];
    if (th.modes?.length) lines.push(`- **Modes:** ${th.modes.map((m) => `\`${m}\``).join(", ")}`);
    if (th.scheme) lines.push(`- **Scheme:** ${th.scheme}`);
    if (th.default) lines.push(`- **Default:** ${th.default}`);
    if (th.notes) lines.push(`- ${th.notes}`);
    lines.push("");
    parts.push(...lines);
  }
  if (ds.typography) {
    const ty = ds.typography;
    const lines = ["### Typography", ""];
    if (ty.families?.length) lines.push(`- **Families:** ${ty.families.map((f) => `\`${f}\``).join(", ")}`);
    if (ty.weights?.length) lines.push(`- **Weights:** ${ty.weights.map((w) => `\`${w}\``).join(", ")}`);
    if (ty.loading) lines.push(`- **Loading:** ${ty.loading}`);
    lines.push("");
    parts.push(...lines);
  }
  if (ds.breakpoints?.length) {
    parts.push("### Breakpoints", "", ...ds.breakpoints.map((b) => `- \`${cell(b)}\``), "");
  }
  if (ds.iconography) parts.push("### Iconography", "", ds.iconography, "");
  if (ds.motion) {
    const mo = ds.motion;
    const lines = ["### Motion & animation", ""];
    if (mo.durations?.length) lines.push(`- **Durations:** ${mo.durations.map((d) => `\`${d}\``).join(", ")}`);
    if (mo.easings?.length) lines.push(`- **Easings:** ${mo.easings.map((e) => `\`${e}\``).join(", ")}`);
    if (mo.reducedMotion) lines.push(`- **prefers-reduced-motion:** ${mo.reducedMotion}`);
    lines.push("");
    parts.push(...lines);
  }
  if (ds.components?.length) parts.push(...componentTable(ds.components));
  if (ds.a11y) {
    const a = ds.a11y;
    const lines = ["### Accessibility", ""];
    if (a.target) lines.push(`- **Target:** ${a.target}`);
    for (const r of a.requirements ?? []) lines.push(`- ${r}`);
    lines.push("");
    parts.push(...lines);
  }
  return parts.join("\n").trimEnd() || "_No design tokens captured yet._";
}
function designSystemDoc(inv, opts) {
  const head = ["# Design system", "", metaBlock(inv, opts)];
  if (!hasUI(inv)) {
    return [
      ...head,
      "_No UI or styling surface was detected \u2014 this project has no design-system contract. If that is wrong (a UI lives here the engine did not detect), capture the design tokens, theming, typography, components, and the accessibility target here._",
      ""
    ].join("\n");
  }
  const isScratch = opts.mode === "scratch";
  const lead = isScratch ? agentNote(
    "Design the system from the interview's brand/design inputs and `../CONTEXT.md`. Capture every design token with its **exact value**, the theming scheme, typography, breakpoints, iconography, motion, the component-library contract (each primitive's variants and states), and the accessibility target. Any blocks below are pre-filled from the plan \u2014 refine and complete them."
  ) : opts.mode === "redesign" ? agentNote(
    "Keep the **brand identity** (logo, voice, the core palette's intent) but you may refresh the system. Record the brand invariants that must survive, then the new/updated tokens, theming, typography, components, and the accessibility target."
  ) : agentNote(
    "Reproduce the existing design system **verbatim**. Copy every token value exactly \u2014 colors as exact hex/oklch, the type scale, spacing, sizing, radii, shadows, z-index, and breakpoints \u2014 from the source files listed below; never round, rename, or approximate. Then capture theming (light/dark, the CSS-variable names), typography (font families + weights + how they load), iconography, motion (durations, easing, and the `prefers-reduced-motion` behavior), the component-library contract (each primitive's variants and the states it must render \u2014 default / hover / focus / disabled / loading / empty / error), and the accessibility target (WCAG level, keyboard nav, focus management, contrast minimums, ARIA)."
  );
  const out = [...head, lead, ""];
  if (!isScratch) {
    out.push(
      "## Design-system source files",
      "",
      listOrNone(inv.hints.designSystemCandidates, "_No design-system config/token files detected \u2014 capture tokens from the component and CSS files._"),
      ""
    );
  }
  if (inv.designSystem) {
    out.push("## Captured design system", "", filledDesignSystem(inv.designSystem), "");
  } else {
    out.push(
      "## Design tokens",
      "",
      agentNote(
        "Capture every token with its **exact value**: the color palette (exact hex/oklch per role + scale step), the typography scale (size / line-height per step), spacing, sizing, radii, shadows, and z-index layers. A token named but not valued (`primary` with no hex) is not buildable."
      ),
      "",
      "## Theming",
      "",
      agentNote(
        "Document the theme modes (light / dark / system), how they are expressed (CSS variables on `:root`/`.dark`, a `data-theme` attribute, a class), the default and how it is chosen/persisted, and the per-theme token overrides."
      ),
      "",
      "## Typography",
      "",
      agentNote(
        "Font families and their roles, the weights loaded, and how fonts load (`next/font`, `@font-face`, a Google Fonts link, self-hosted) including the fallback stack."
      ),
      "",
      "## Breakpoints & responsive",
      "",
      agentNote("The named breakpoints with their exact values and the layout/grid strategy (mobile-first vs desktop-first, container queries)."),
      "",
      "## Iconography",
      "",
      agentNote("The icon set / library, the sizing and stroke conventions, and how icons are colored and used."),
      "",
      "## Motion & animation",
      "",
      agentNote("The duration and easing tokens, the standard transitions, and how `prefers-reduced-motion` is honored."),
      "",
      "## Component library",
      "",
      "| Component | Source | Variants | States |",
      "| --- | --- | --- | --- |",
      "",
      agentNote(
        "Contract every shared/owned primitive: its variants, the states it must render (default / hover / focus / disabled / loading / empty / error), the props, and which tokens it consumes. A component named but not contracted (`Button`, `Card`) cannot be rebuilt to a fixed spec."
      ),
      "",
      "## Accessibility",
      "",
      agentNote(
        "The WCAG conformance target (A / AA / AAA), the keyboard-navigation and focus-management rules, contrast minimums, and the required ARIA roles/labels per component state."
      ),
      ""
    );
  }
  return out.join("\n");
}
function diagramDoc(inv) {
  const nodes = inv.features.map((f, i) => `  F${i}["${f.name}"]`).join("\n");
  const dataNode = inv.i18n || inv.schemas.length ? '  DATA[("Data / i18n / schema")]' : "";
  const edges = inv.features.filter((f) => f.kind === "feature").map((f, i) => inv.i18n ? `  F${i} --> DATA` : "").filter(Boolean).join("\n");
  const workspaceGraph = inv.workspaces?.length ? [
    "",
    "## Workspace graph",
    "",
    "Manifest-declared dependencies between workspaces (verify and extend with implicit edges).",
    "",
    "```mermaid",
    "graph TD",
    ...inv.workspaces.map((w, i) => `  W${i}["${w.name}"]`),
    ...inv.workspaces.flatMap(
      (w, i) => (w.dependsOn ?? []).map((dep) => {
        const j = inv.workspaces?.findIndex((x) => x.name === dep) ?? -1;
        return j >= 0 ? `  W${i} --> W${j}` : "";
      })
    ).filter(Boolean),
    "```",
    ""
  ] : [""];
  return ["# Module diagram", "", "```mermaid", "graph TD", nodes, dataNode, edges, "```", ...workspaceGraph].join("\n");
}
function featurePrd(inv, feature, opts, sourceMarkdown) {
  const isScratch = opts.mode === "scratch";
  const truth = isScratch ? "the interview & `../../CONTEXT.md`" : "the source material below";
  const out = [
    `# ${feature.name}`,
    "",
    `> Unit \`${feature.slug}\` \xB7 kind: ${feature.kind}`,
    "",
    "## Summary",
    "",
    feature.description,
    "",
    "## Context & goal",
    "",
    agentNote(
      `State this unit's user-facing goal in 1\u20132 sentences (the outcome a user gets), and name the other units it depends on and that depend on it. Derive it from ${truth}.`
    ),
    "",
    "## User stories",
    "",
    agentNote(
      "Enumerate **every** actor and what they need, one line each \u2014 `As a <role>, I can <action> so that <value>.` Be **exhaustive**: cover every role and every distinct behaviour, not just the happy path. This list is the backbone of the PRD; nothing below should exist without a story above it."
    ),
    "",
    "## Functional requirements",
    "",
    agentNote(
      `Turn the stories into a **numbered** checklist of precise, testable behaviours, derived from ${truth}. Cover happy paths, every edge case, every validation rule, and every error state. Leave nothing as "etc." or "and so on" \u2014 if you write a placeholder, you are not done. Tag each requirement \`[confirmed]\` (read directly in the source), \`[inferred]\` (pattern-derived, no false certainty), or \`[gap]\` (needs a human) so the \`--verify\` pass can adjudicate its confidence faster.`
    ),
    ""
  ];
  if (feature.routes.length) {
    out.push("## Routes", "", "| Method | Route | Kind | File |", "| --- | --- | --- | --- |");
    for (const r of feature.routes) {
      out.push(`| ${r.method ?? "\u2014"} | \`${r.route}\` | ${r.kind} | \`${r.file}\` |`);
    }
    out.push("");
  }
  out.push("## Interfaces & data", "");
  if (feature.interfaces?.length) {
    out.push(`- **Operations:** ${feature.interfaces.map((i) => `\`${i}\``).join(", ")}`);
  }
  if (feature.entities?.length) {
    out.push(`- **Entities:** ${feature.entities.map((e) => `\`${e}\``).join(", ")}`);
  }
  if (feature.writes?.length) {
    out.push(`- **Writes:** ${feature.writes.map((e) => `\`${e}\``).join(", ")}`);
  }
  if (feature.interfaces?.length || feature.entities?.length || feature.writes?.length) out.push("");
  out.push(
    agentNote(
      "List **every** operation this unit exposes with its input/output shape (link `../../architecture/INTERFACES.md`), and **every** entity it reads or writes (link `../../architecture/DATA-MODEL.md`). Spell out the **write contract** for each mutation: which entities are written, whether the write is transactional, and \u2014 for every required (NOT NULL, no-default) column and foreign key \u2014 where the value comes from. A public/anonymous operation cannot satisfy an owner foreign key: it must write to an anonymous-capable entity instead. Every enum/domain value it accepts must be one of the members enumerated in `DATA-MODEL.md`."
    ),
    ""
  );
  if (hasUI(inv)) {
    out.push(
      agentNote(
        "For any UI this unit renders, conform to `../../architecture/DESIGN-SYSTEM.md`: use its design tokens (no hard-coded colors / spacing / typography), build on the component-library primitives (with their variants and the states empty / loading / error), and meet its accessibility target (keyboard, focus, contrast, ARIA)."
      ),
      ""
    );
  }
  out.push(
    "## Acceptance criteria",
    "",
    agentNote(
      'Write **Given / When / Then** scenarios that gate "done" \u2014 at least one per functional requirement, **including** the failure paths. Example: `Given an unauthenticated visitor, When they POST a todo, Then the API responds 401 and writes nothing.` These scenarios are the spec the rebuild is verified against.'
    ),
    "",
    "## Edge cases & failure modes",
    "",
    agentNote(
      "Enumerate what can go wrong and the expected behaviour for each: invalid / empty / oversized input, auth & permission failures, concurrency / race conditions, missing or slow dependencies, partial failures, and idempotency / retries. Each row here should map to an error-path requirement above."
    ),
    ""
  );
  if (opts.tdd) {
    out.push(
      "## Test plan (write these first)",
      "",
      agentNote(
        "Before writing any implementation, turn the functional requirements and acceptance criteria above into failing tests (red): one per behaviour \u2014 happy paths, edge cases, validation, and error states. Implement only enough to make them pass (green), then refactor. List the test cases here as a checklist."
      ),
      ""
    );
  }
  if (isScratch) {
    out.push(
      "## Design inputs",
      "",
      agentNote(
        "Build this unit greenfield. Ground every decision in `../../CONTEXT.md` (the glossary), the operations in `../../architecture/INTERFACES.md`, and the entities in `../../architecture/DATA-MODEL.md`."
      ),
      ""
    );
  } else {
    out.push("## Source material", "", sourceMarkdown, "");
  }
  if (opts.level === "complex") {
    out.push(
      isScratch ? "## Enhancements & alternatives" : "## Improvements & refactors",
      "",
      isScratch ? agentNote(
        "Propose enhancements beyond the MVP for this unit and note any alternative approaches worth considering, each marked `[post-MVP]` so the core build stays lean."
      ) : agentNote(
        "Propose concrete improvements for this unit: better types, dead-code removal, performance, accessibility, security, and tests. Mark each as `[keep-behavior]` so the rebuild stays functionally identical unless the user opts in."
      ),
      ""
    );
  }
  if (opts.mode === "redesign") {
    out.push(
      "## Redesign notes",
      "",
      agentNote(
        "Map this unit onto the new architecture from `architecture/ARCHITECTURE.md`. Note where its files should live and which interfaces it exposes."
      ),
      ""
    );
  }
  out.push(
    "## Definition of done",
    "",
    "- [ ] Every functional requirement is implemented and covered by a test.",
    "- [ ] Every acceptance-criteria scenario passes (including the failure paths).",
    "- [ ] Every operation this unit owns in `architecture/INTERFACES.md` responds correctly.",
    "- [ ] Every entity it writes matches `architecture/DATA-MODEL.md` (fields, types, constraints).",
    "- [ ] Every write is satisfiable against the schema: no required (NOT NULL, no-default) column or foreign key is left unfilled; anonymous/public operations write only to anonymous-capable entities (no owner FK).",
    "- [ ] Every enum/domain value this unit uses is one of the members fully enumerated in `architecture/DATA-MODEL.md`.",
    "- [ ] Every edge case & failure mode above is handled.",
    ...inv.i18n ? ["- [ ] Every user-facing string has a source string in the message catalog and resolves in every locale (no missing keys, no hard-coded copy)."] : [],
    "- [ ] `node scripts/analyze.mjs --check --out <out>` passes \u2014 no unresolved agent callouts or placeholders, and every reference resolves.",
    ""
  );
  return out.join("\n");
}
function rebuildDoc(inv, opts) {
  const isScratch = opts.mode === "scratch";
  const order = inv.features.map((f, i) => `${i + 1}. [ ] **${f.name}** \u2192 \`features/${f.slug}/PRD.md\``).join("\n");
  const modeBlurb = opts.mode === "preserve" ? "keep the current architecture" : isScratch ? "build the project from the interview/plan (greenfield)" : "design a new architecture for the same features";
  const procedure = [
    isScratch ? "1. Read `00-overview/PRD.md`, `CONTEXT.md` (the glossary), and the decisions in `docs/adr/`, then `architecture/ARCHITECTURE.md`, `architecture/INTERFACES.md`, and `architecture/DATA-MODEL.md`." : "1. Start with `00-overview/PRD.md`, `architecture/ARCHITECTURE.md`, `architecture/INTERFACES.md`, and `architecture/DATA-MODEL.md`.",
    opts.tdd ? "2. For each unit in order: write its failing acceptance tests first (red), implement until they pass (green), then refactor." : "2. For each unit in order, open its PRD and implement it.",
    isScratch ? "3. Ground terminology and decisions in `CONTEXT.md` and `docs/adr/`; cross-reference `INTERFACES.md` and `DATA-MODEL.md`." : "3. Wire shared data from `data/` (translations, schema, config).",
    opts.fidelity === "mirror" ? "4. Use the copied files under `source/<slug>/` as ground truth." : "4. Validate behavior against the requirements in each PRD.",
    isScratch ? "5. Run your test suite, typecheck, and linter to verify each unit before moving on." : "5. Run the project's own scripts to verify: " + (Object.keys(inv.scripts).length ? Object.keys(inv.scripts).slice(0, 6).map((s) => `\`${s}\``).join(", ") : "_no scripts detected_") + "."
  ];
  const checklist = [
    "- [ ] Every interface in `architecture/INTERFACES.md` is implemented (routes, endpoints, RPC/GraphQL, jobs).",
    isScratch ? "- [ ] Every entity in `architecture/DATA-MODEL.md` exists with its fields, relations, and constraints." : "- [ ] Data model matches `architecture/DATA-MODEL.md` and `data/schema/`.",
    isScratch ? "- [ ] All routes/operations respond per `architecture/INTERFACES.md`." : "- [ ] All routes respond as before.",
    ...inv.i18n ? [isScratch ? "- [ ] All locales present, each with its own messages file." : "- [ ] All locales present and keys match `data/translations/`."] : [],
    ...hasUI(inv) ? [
      "- [ ] UI matches `architecture/DESIGN-SYSTEM.md` \u2014 design tokens reproduced exactly, components built with their variants/states, and the accessibility target met."
    ] : [],
    ...opts.tdd ? ["- [ ] Tests were written before implementation for each unit (red \u2192 green \u2192 refactor)."] : [],
    "- [ ] Required env vars configured: " + (inv.envVars.length ? inv.envVars.map((e) => `\`${e}\``).join(", ") : "_none_") + "."
  ];
  return [
    `# REBUILD \u2014 ${inv.repoName}`,
    "",
    metaBlock(inv, opts),
    isScratch ? "This folder is a complete plan to build the project from scratch." : "This folder is a complete plan to rebuild the project from scratch.",
    "",
    "## Mode & level",
    "",
    `- **${opts.mode}**: ${modeBlurb}.`,
    `- **${opts.level}**: ${opts.level === "light" ? "faithful, minimal-editorializing PRDs" : "PRDs that also suggest improvements to fold in"}.`,
    `- **${opts.fidelity}** fidelity: ${opts.fidelity === "mirror" ? "real files copied under `source/`" : opts.fidelity === "embed" ? "key code embedded directly in the PRDs" : "descriptive PRDs only \u2014 build from requirements"}.`,
    ...opts.tdd ? ["- **TDD**: each unit is built test-first (red \u2192 green \u2192 refactor)."] : [],
    "",
    "## Build order",
    "",
    "Ordered by dependency tier \u2014 foundations (types, data, shared UI, i18n, cross-cutting) first, feature pages next, tests & docs last." + (inv.workspaces?.length ? " The outer tier is the workspace topological order: shared packages build before the apps that consume them." : ""),
    "",
    order || "_No features._",
    "",
    "## Procedure",
    "",
    ...procedure,
    "",
    "## Validation checklist",
    "",
    ...checklist,
    ""
  ].join("\n");
}

// src/prd/fidelity.ts
import { readFileSync as readFileSync8 } from "fs";
import { join as join9 } from "path";
var FENCE_LANG = {
  ".ts": "ts",
  ".tsx": "tsx",
  ".js": "js",
  ".jsx": "jsx",
  ".mjs": "js",
  ".cjs": "js",
  ".json": "json",
  ".py": "python",
  ".rb": "ruby",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".php": "php",
  ".css": "css",
  ".scss": "scss",
  ".prisma": "prisma",
  ".sql": "sql",
  ".graphql": "graphql",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".vue": "vue",
  ".svelte": "svelte"
};
var MAX_EMBED_FILES = 15;
function extOf(path) {
  const i = path.lastIndexOf(".");
  return i === -1 ? "" : path.slice(i).toLowerCase();
}
function describeSection(feature) {
  if (feature.files.length === 0) return "_No files associated with this unit._\n";
  const lines = feature.files.map((f) => `- \`${f}\``);
  return `Files that implement this unit (rewrite them from the requirements above):

${lines.join("\n")}
`;
}
function embedSection(feature, opts) {
  const parts = [`Key source for this unit (${feature.files.length} file(s) total, showing up to ${MAX_EMBED_FILES}):
`];
  for (const rel of feature.files.slice(0, MAX_EMBED_FILES)) {
    const ext = extOf(rel);
    const lang = FENCE_LANG[ext] ?? "";
    let body;
    try {
      body = readFileSync8(join9(opts.repo, rel), "utf8");
    } catch {
      continue;
    }
    let truncated = false;
    if (body.length > opts.maxEmbedBytes) {
      body = body.slice(0, opts.maxEmbedBytes);
      truncated = true;
    }
    parts.push(`#### \`${rel}\`
`);
    parts.push("```" + lang + "\n" + body.replace(/```/g, "\u02BC\u02BC\u02BC") + "\n```");
    if (truncated) parts.push(`> _Truncated to ${opts.maxEmbedBytes} bytes \u2014 see full file in the source repo._`);
    parts.push("");
  }
  if (feature.files.length > MAX_EMBED_FILES) {
    parts.push(`_\u2026and ${feature.files.length - MAX_EMBED_FILES} more file(s) not shown._`);
  }
  return parts.join("\n");
}
function mirrorSection(feature, opts) {
  const copies = [];
  const lines = ["Ground-truth source has been copied verbatim alongside this PRD. Reference it while rebuilding:\n"];
  for (const rel of feature.files) {
    copies.push({
      from: join9(opts.repo, rel),
      to: join9(opts.out, "source", feature.slug, rel)
    });
    lines.push(`- [\`${rel}\`](../../source/${feature.slug}/${rel})`);
  }
  if (feature.files.length === 0) lines.push("_No files associated with this unit._");
  return { markdown: lines.join("\n") + "\n", copies };
}
function renderSourceMaterial(feature, opts) {
  switch (opts.fidelity) {
    case "mirror":
      return mirrorSection(feature, opts);
    case "embed":
      return { markdown: embedSection(feature, opts), copies: [] };
    case "describe":
    default:
      return { markdown: describeSection(feature), copies: [] };
  }
}

// src/prd/bundle.ts
function isSetextContent(s) {
  const t = s.trim();
  return t !== "" && !/^[#>\-*+|=]/.test(t) && !/^\d+[.)]/.test(t);
}
function demoteHeadings(md, by = 1) {
  const lines = md.split("\n");
  const out = [];
  let i = 0;
  const fm = lines[0]?.match(/^(---|\+\+\+)\s*$/);
  if (fm) {
    out.push(lines[0]);
    i = 1;
    while (i < lines.length && lines[i].trim() !== fm[1]) out.push(lines[i++]);
    if (i < lines.length) out.push(lines[i++]);
  }
  let fence = null;
  for (; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^(\s{0,3})(`{3,}|~{3,})/);
    if (fenceMatch?.[2]) {
      const marker = fenceMatch[2].startsWith("`") ? "`" : "~";
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      out.push(line);
      continue;
    }
    if (fence !== null) {
      out.push(line);
      continue;
    }
    if (/^\s{0,3}=+\s*$/.test(line) && out.length && isSetextContent(out[out.length - 1])) {
      const level = Math.min(6, 1 + by);
      out[out.length - 1] = `${"#".repeat(level)} ${out[out.length - 1].trim()}`;
      continue;
    }
    const h = line.match(/^(\s{0,3})(#{1,6})(\s.*)?$/);
    if (h?.[2]) {
      const hashes = "#".repeat(Math.min(6, h[2].length + by));
      out.push(`${h[1] ?? ""}${hashes}${h[3] ?? ""}`);
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}
function generationOf(inv, opts) {
  return inv.generation ?? {
    mode: opts.mode,
    level: opts.level,
    fidelity: opts.fidelity,
    granularity: opts.granularity
  };
}
function metaLine(inv, opts) {
  const g = generationOf(inv, opts);
  return `> Generated with \`${inv.generatedWith}\` \xB7 mode \`${g.mode}\` \xB7 level \`${g.level}\` \xB7 fidelity \`${g.fidelity}\``;
}
function slugify2(value) {
  return value.toLowerCase().replace(/\.md$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
var BUNDLE_EXCLUDE = /* @__PURE__ */ new Set(["inventory.json", "SUMMARY.md", "RECONSTRUCTION.md", "FEATURES.md", "SPECS.md"]);
function orderedSections(artifacts, inv) {
  const have = new Set(artifacts.map((a) => a.relPath));
  const sections = [];
  const push = (relPath, title, anchor) => {
    if (have.has(relPath)) sections.push({ relPath, title, anchor });
  };
  push("00-overview/PRD.md", "Overview", "overview");
  push("architecture/ARCHITECTURE.md", "Architecture", "architecture");
  push("architecture/INTERFACES.md", "Interfaces", "interfaces");
  push("architecture/DATA-MODEL.md", "Data model", "data-model");
  push("architecture/DESIGN-SYSTEM.md", "Design system", "design-system");
  push("architecture/diagram.md", "Diagram", "diagram");
  for (const f of inv.features) {
    push(`features/${f.slug}/PRD.md`, f.name, `feature-${f.slug}`);
  }
  push("REBUILD.md", "Build order", "build-order");
  const placed = new Set(sections.map((s) => s.relPath));
  const extra = artifacts.map((a) => a.relPath).filter((p) => p.endsWith(".md") && !placed.has(p) && !BUNDLE_EXCLUDE.has(p)).sort();
  for (const relPath of extra) {
    sections.push({ relPath, title: relPath.replace(/\.md$/, ""), anchor: slugify2(relPath) });
  }
  return sections;
}
function mergeTree(artifacts, inv, opts, variant) {
  const byPath = new Map(artifacts.map((a) => [a.relPath, a.content]));
  const sections = orderedSections(artifacts, inv);
  const parts = [];
  parts.push(`# ${inv.repoName} \u2014 ${variant.heading}`);
  parts.push("");
  parts.push(metaLine(inv, opts));
  parts.push("");
  parts.push(variant.intro);
  parts.push("");
  parts.push("## Contents");
  parts.push("");
  for (const s of sections) parts.push(`- [${s.title}](#${s.anchor})`);
  for (const s of sections) {
    const raw = byPath.get(s.relPath) ?? "";
    const content = variant.stripSource ? stripSourceMaterial(raw) : raw;
    parts.push("");
    parts.push("---");
    parts.push("");
    parts.push(`<a id="${s.anchor}"></a>`);
    parts.push("");
    parts.push(demoteHeadings(content).trimEnd());
  }
  return parts.join("\n") + "\n";
}
function mergeArtifacts(artifacts, inv, opts) {
  return mergeTree(artifacts, inv, opts, {
    heading: "Reconstruction",
    intro: "Single-file bundle of the full reconstruction. Each section below is one document from the reconstruction tree.",
    stripSource: false
  });
}
function stripSourceMaterial(md) {
  const lines = md.split("\n");
  const out = [];
  let skipping = false;
  let fence = null;
  for (const line of lines) {
    const fenceMatch = line.match(/^(\s{0,3})(`{3,}|~{3,})/);
    const marker = fenceMatch?.[2] ? fenceMatch[2].startsWith("`") ? "`" : "~" : null;
    if (skipping) {
      if (fence !== null) {
        if (marker === fence) fence = null;
        continue;
      }
      if (marker) {
        fence = marker;
        continue;
      }
      if (/^##\s/.test(line))
        skipping = false;
      else continue;
    }
    if (!skipping && /^##\s+Source material\b/i.test(line)) {
      skipping = true;
      continue;
    }
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
function mergeFeatures(artifacts, inv, opts) {
  const byPath = new Map(artifacts.map((a) => [a.relPath, a.content]));
  const have = new Set(artifacts.map((a) => a.relPath));
  const sections = [];
  for (const f of inv.features) {
    const relPath = `features/${f.slug}/PRD.md`;
    if (have.has(relPath)) sections.push({ relPath, title: f.name, anchor: `feature-${f.slug}` });
  }
  const parts = [];
  parts.push(`# ${inv.repoName} \u2014 Features`);
  parts.push("");
  parts.push(metaLine(inv, opts));
  parts.push("");
  parts.push(
    "Single-file bundle of every feature PRD (the product functionality), in build order. For the full reconstruction \u2014 architecture, interfaces, data model, build order \u2014 see `RECONSTRUCTION.md`."
  );
  parts.push("");
  parts.push("## Contents");
  parts.push("");
  if (sections.length === 0) parts.push("_No features detected._");
  for (const s of sections) parts.push(`- [${s.title}](#${s.anchor})`);
  for (const s of sections) {
    const content = byPath.get(s.relPath) ?? "";
    parts.push("");
    parts.push("---");
    parts.push("");
    parts.push(`<a id="${s.anchor}"></a>`);
    parts.push("");
    parts.push(demoteHeadings(content).trimEnd());
  }
  return parts.join("\n") + "\n";
}
function mergeSpecs(artifacts, inv, opts) {
  return mergeTree(artifacts, inv, opts, {
    heading: "Specs",
    intro: "Single-file **specification** to (re)build this project from: overview, architecture (interfaces & data model), every feature PRD, and the build order \u2014 with the embedded original source code (`## Source material`) stripped. Self-sufficient and code-free, so an agent can implement from it directly. For the same tree *with* the original source, see `RECONSTRUCTION.md`.",
    stripSource: true
  });
}
function summarize(inv, opts) {
  const isScratch = generationOf(inv, opts).mode === "scratch";
  const lines = [];
  lines.push(`# ${inv.repoName} \u2014 reconstruction summary`);
  lines.push("");
  lines.push(metaLine(inv, opts));
  lines.push("");
  lines.push("## Project");
  const frameworks = inv.stack.frameworks.length ? `${inv.stack.primaryLanguage} \xB7 ${inv.stack.frameworks.join(", ")}` : inv.stack.primaryLanguage;
  lines.push(`- **Stack:** ${frameworks}`);
  lines.push(`- **Notable libraries:** ${inv.stack.libraries.length ? inv.stack.libraries.join(", ") : "\u2014"}`);
  if (isScratch) {
    lines.push(`- **Surface:** ${inv.interfaces?.length ?? 0} operation(s) \xB7 ${inv.dataModel?.length ?? 0} entit(y/ies) \xB7 ${inv.enums?.length ?? 0} enum(s)`);
  } else {
    lines.push(`- **Size:** ${inv.fileCount} files \xB7 ${inv.totalLines} lines`);
  }
  if (inv.stack.packageManagers.length) {
    lines.push(`- **Package manager(s):** ${inv.stack.packageManagers.join(", ")}`);
  }
  if (inv.runtime?.node) lines.push(`- **Runtime:** Node ${inv.runtime.node}`);
  if (inv.i18n) {
    lines.push(`- **Locales:** ${inv.i18n.locales.join(", ")} (${inv.i18n.locales.length})`);
  }
  if (isScratch) {
    lines.push(`- **Operations:** ${inv.interfaces?.length ?? 0} \xB7 **Features:** ${inv.features.length}`);
  } else {
    lines.push(`- **Routes:** ${inv.routes.length} \xB7 **Features:** ${inv.features.length}`);
  }
  if (inv.workspaces?.length) {
    const names = inv.workspaces.map((w) => `\`${w.name}\`${w.dependsOn?.length ? ` \u2192 ${w.dependsOn.map((d) => `\`${d}\``).join(", ")}` : ""}`).join(" \xB7 ");
    lines.push(`- **Monorepo:** ${inv.workspaces.length} workspace(s) \u2014 ${names}`);
  }
  lines.push("");
  lines.push("## Features (build order)");
  if (inv.features.length === 0) {
    lines.push("_No features detected._");
  } else {
    inv.features.forEach((f, i) => {
      const desc = f.description ? ` \u2014 ${f.description}` : "";
      const scope = isScratch ? `${f.interfaces?.length ?? 0} operation(s) \xB7 ${f.entities?.length ?? 0} entit(y/ies)` : `${f.files.length} file(s)`;
      lines.push(`${i + 1}. **${f.name}**${desc} \u2192 \`features/${f.slug}/PRD.md\` (${scope})`);
    });
  }
  lines.push("");
  lines.push("## Interface & data surface");
  if (isScratch) {
    lines.push(`- Operations (pre-filled from the plan): ${inv.interfaces?.length ?? 0}`);
    lines.push(`- Entities (pre-filled from the plan): ${inv.dataModel?.length ?? 0}`);
    lines.push(`- Enums (full member lists): ${inv.enums?.length ?? 0}`);
  } else {
    lines.push(`- Routes resolved: ${inv.routes.length}`);
    lines.push(`- Route candidates to verify: ${inv.hints.routeCandidates.length}`);
    lines.push(`- API candidates (RPC / GraphQL / gRPC / OpenAPI): ${inv.hints.apiCandidates.length}`);
    lines.push(`- Schema / data-model candidates: ${inv.hints.schemaCandidates.length}`);
  }
  lines.push("");
  lines.push("## Unknowns to resolve");
  if (inv.unknowns.length === 0) {
    lines.push("_None \u2014 the engine resolved everything it looks for._");
  } else {
    for (const u of inv.unknowns) lines.push(`- ${u}`);
  }
  lines.push("");
  lines.push("## Next steps");
  lines.push(
    "Open `REBUILD.md` for the dependency-ordered build order and validation checklist, then feed each `features/<slug>/PRD.md` to an agent, using `data/` and `source/` as ground truth."
  );
  lines.push("");
  return lines.join("\n");
}

// src/prd/render.ts
function render(inv, opts) {
  const artifacts = [];
  const copies = [];
  artifacts.push({ relPath: "REBUILD.md", content: rebuildDoc(inv, opts) });
  artifacts.push({ relPath: "00-overview/PRD.md", content: overviewPrd(inv, opts) });
  artifacts.push({ relPath: "architecture/ARCHITECTURE.md", content: architectureDoc(inv, opts) });
  artifacts.push({ relPath: "architecture/INTERFACES.md", content: interfacesDoc(inv, opts) });
  artifacts.push({ relPath: "architecture/DATA-MODEL.md", content: dataModelDoc(inv, opts) });
  artifacts.push({ relPath: "architecture/DESIGN-SYSTEM.md", content: designSystemDoc(inv, opts) });
  artifacts.push({ relPath: "architecture/diagram.md", content: diagramDoc(inv) });
  artifacts.push({ relPath: "inventory.json", content: JSON.stringify(inv, null, 2) + "\n" });
  for (const feature of inv.features) {
    const src = renderSourceMaterial(feature, opts);
    copies.push(...src.copies);
    artifacts.push({
      relPath: `features/${feature.slug}/PRD.md`,
      content: featurePrd(inv, feature, opts, src.markdown)
    });
  }
  const dataCopy = (paths, sub) => {
    for (const rel of paths) {
      copies.push({ from: join10(opts.repo, rel), to: join10(opts.out, "data", sub, rel) });
    }
  };
  if (inv.i18n) dataCopy(inv.i18n.files, "translations");
  dataCopy(inv.schemas, "schema");
  dataCopy(inv.configs, "config");
  if (opts.summary) {
    artifacts.push({ relPath: "SUMMARY.md", content: summarize(inv, opts) });
  }
  if (opts.features) {
    artifacts.push({ relPath: "FEATURES.md", content: mergeFeatures(artifacts, inv, opts) });
  }
  if (opts.specs) {
    artifacts.push({ relPath: "SPECS.md", content: mergeSpecs(artifacts, inv, opts) });
  }
  if (opts.merge) {
    artifacts.push({ relPath: "RECONSTRUCTION.md", content: mergeArtifacts(artifacts, inv, opts) });
  }
  return { artifacts, copies };
}

// src/output.ts
import { mkdirSync, writeFileSync, copyFileSync, existsSync as existsSync3 } from "fs";
import { dirname, join as join11 } from "path";
function writeOutput(result, opts) {
  for (const a of result.artifacts) {
    const dest = join11(opts.out, a.relPath);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, a.content, "utf8");
  }
  for (const c of result.copies) {
    if (!existsSync3(c.from)) continue;
    mkdirSync(dirname(c.to), { recursive: true });
    try {
      copyFileSync(c.from, c.to);
    } catch {
    }
  }
}
function writeArtifactsIfAbsent(artifacts, outDir) {
  const written = [];
  for (const a of artifacts) {
    const dest = join11(outDir, a.relPath);
    if (existsSync3(dest)) continue;
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, a.content, "utf8");
    written.push(a.relPath);
  }
  return written;
}

// src/postprocess.ts
import { readdirSync as readdirSync3, readFileSync as readFileSync9, existsSync as existsSync4 } from "fs";
import { join as join12, relative as relative2, sep } from "path";
var GROUND_TRUTH_DIRS = /* @__PURE__ */ new Set(["source", "data"]);
function readMarkdownTree(dir) {
  const out = [];
  const walk2 = (abs) => {
    for (const entry of readdirSync3(abs, { withFileTypes: true })) {
      const child = join12(abs, entry.name);
      const rel = relative2(dir, child).split(sep).join("/");
      if (entry.isDirectory()) {
        if (GROUND_TRUTH_DIRS.has(rel)) continue;
        walk2(child);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push({ relPath: rel, content: readFileSync9(child, "utf8") });
      }
    }
  };
  walk2(dir);
  return out;
}
function bundleExisting(opts) {
  const dir = opts.out;
  const invPath = join12(dir, "inventory.json");
  if (!existsSync4(invPath)) {
    throw new Error(`no inventory.json in ${dir} \u2014 run a full reconstruction there first (e.g. reconstruct --repo <repo> --out ${dir}).`);
  }
  const inv = JSON.parse(readFileSync9(invPath, "utf8"));
  const tree = readMarkdownTree(dir);
  const artifacts = [];
  if (opts.summary) artifacts.push({ relPath: "SUMMARY.md", content: summarize(inv, opts) });
  if (opts.features) artifacts.push({ relPath: "FEATURES.md", content: mergeFeatures(tree, inv, opts) });
  if (opts.specs) artifacts.push({ relPath: "SPECS.md", content: mergeSpecs(tree, inv, opts) });
  if (opts.merge) artifacts.push({ relPath: "RECONSTRUCTION.md", content: mergeArtifacts(tree, inv, opts) });
  return { artifacts, copies: [] };
}

// src/scratch.ts
import { readFileSync as readFileSync10 } from "fs";
function loadPlan(path) {
  let raw;
  try {
    raw = readFileSync10(path, "utf8");
  } catch {
    throw new Error(`cannot read plan.json at ${path} \u2014 does the file exist?`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`invalid plan.json at ${path}: ${e.message}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`invalid plan.json at ${path}: expected a JSON object`);
  }
  const plan = parsed;
  if (!plan.project || typeof plan.project.name !== "string" || !plan.project.name.trim()) {
    throw new Error(`plan.json is missing a "project.name" (the project's name)`);
  }
  if (typeof plan.project.summary !== "string") {
    throw new Error(`plan.json is missing a "project.summary" (one-line description)`);
  }
  if (!plan.stack || typeof plan.stack.primaryLanguage !== "string") {
    throw new Error(`plan.json is missing a "stack.primaryLanguage"`);
  }
  if (!Array.isArray(plan.features) || plan.features.length === 0) {
    throw new Error(`plan.json must list at least one "features" entry`);
  }
  return plan;
}
function deriveTier(kind) {
  if (kind === "project-setup" || kind === "internationalization") return 0;
  if (kind === "documentation") return 2;
  return 1;
}
function planStack(plan) {
  const s = plan.stack;
  const libraries = s.libraries ?? [];
  const stylingLibraries = detectStylingLibraries(libraries);
  return {
    primaryLanguage: s.primaryLanguage,
    languages: s.languages ?? [s.primaryLanguage],
    frameworks: s.frameworks ?? [],
    libraries,
    ...stylingLibraries.length ? { stylingLibraries } : {},
    packageManagers: s.packageManagers ?? [],
    hasTypeScript: s.hasTypeScript ?? /typescript|\bts\b/i.test(s.primaryLanguage)
  };
}
function planDependencies(plan) {
  return (plan.dependencies ?? []).map((d) => ({
    manager: d.manager,
    manifest: d.manifest,
    runtime: d.runtime ?? {},
    dev: d.dev ?? {}
  }));
}
function planDataModel(plan) {
  return (plan.dataModel ?? []).map((e) => ({
    entity: e.entity,
    fields: (e.fields ?? []).map((f) => ({
      name: f.name,
      type: f.type,
      ...f.constraints ? { constraints: f.constraints } : {},
      ...f.enumRef ? { enumRef: f.enumRef } : {}
    })),
    ...e.relations && e.relations.length ? { relations: e.relations } : {},
    ...e.indexes && e.indexes.length ? { indexes: e.indexes } : {},
    ...e.uniques && e.uniques.length ? { uniques: e.uniques } : {}
  }));
}
function planInterfaces(plan) {
  return (plan.interfaces ?? []).map((r) => ({
    method: r.method,
    path: r.path,
    ...r.kind ? { kind: r.kind } : {},
    ...r.auth ? { auth: r.auth } : {},
    ...r.notes ? { notes: r.notes } : {},
    ...r.input ? { input: r.input } : {},
    ...r.output ? { output: r.output } : {},
    ...r.sideEffects && r.sideEffects.length ? { sideEffects: r.sideEffects } : {}
  }));
}
function planFeatures(features) {
  const records = features.map((f, i) => {
    const kind = f.kind ?? "feature";
    const tier = f.tier ?? deriveTier(kind);
    return {
      feature: {
        slug: slugify(f.name),
        name: f.name,
        description: f.summary ?? `${f.name}.`,
        kind,
        files: [],
        routes: [],
        ...f.interfaces && f.interfaces.length ? { interfaces: f.interfaces } : {},
        ...f.entities && f.entities.length ? { entities: f.entities } : {},
        ...f.writes && f.writes.length ? { writes: f.writes } : {}
      },
      tier,
      // Preserve the plan's declared order within a tier — the author controls it.
      rank: i,
      size: 0
    };
  });
  return orderFeatures(records);
}
function planToInventory(plan, opts) {
  const i18n = plan.i18n ? {
    locales: plan.i18n.locales,
    files: [],
    keyCount: plan.i18n.messages?.entries?.length ?? 0,
    ...plan.i18n.messages ? { messages: plan.i18n.messages } : {}
  } : null;
  const interfaces = planInterfaces(plan);
  return {
    generatedWith: `reconstruct@${VERSION}`,
    generation: {
      mode: "scratch",
      level: opts.level,
      fidelity: "describe",
      granularity: opts.granularity
    },
    repoName: plan.project.name,
    stack: planStack(plan),
    fileCount: 0,
    totalLines: 0,
    files: [],
    dependencies: planDependencies(plan),
    routes: [],
    i18n,
    schemas: [],
    configs: [],
    docs: [],
    envVars: plan.envVars ?? [],
    scripts: {},
    features: planFeatures(plan.features),
    hints: {
      routeCandidates: [],
      apiCandidates: [],
      schemaCandidates: [],
      realtimeCandidates: [],
      authCandidates: [],
      designSystemCandidates: [],
      entryPoints: []
    },
    unknowns: [],
    excludedCount: 0,
    product: {
      summary: plan.project.summary,
      ...plan.project.audience ? { audience: plan.project.audience } : {},
      ...plan.project.value ? { value: plan.project.value } : {}
    },
    interfaces,
    dataModel: planDataModel(plan),
    ...plan.enums && plan.enums.length ? { enums: plan.enums } : {},
    ...plan.services && plan.services.length ? { services: plan.services } : {},
    ...plan.policies && plan.policies.length ? { policies: plan.policies } : {},
    ...plan.designSystem ? { designSystem: plan.designSystem } : {}
  };
}
var IDENTITY_ENTITY = /^users?$/i;
var OWNER_FK_COLUMN = /(^user_?id$|owner|author|sender|creator|created_?by)/i;
function fkTarget(f) {
  const m = (f.constraints ?? "").match(/->\s*([a-z0-9_]+)/i);
  return m ? m[1] : null;
}
function isOwnerCallerFk(f) {
  const target = fkTarget(f);
  if (!target || !IDENTITY_ENTITY.test(target)) return false;
  if (isNullable(f) || hasDefault(f)) return false;
  return OWNER_FK_COLUMN.test(f.name);
}
function isNullable(f) {
  const c = (f.constraints ?? "").toLowerCase();
  if (/\bnullable\b/.test(c)) return true;
  if (/\bnot null\b/.test(c)) return false;
  return false;
}
function hasDefault(f) {
  return /\bdefault\b/i.test(f.constraints ?? "");
}
function isEnumTyped(f) {
  return /\benum\b/i.test(f.type);
}
function enumMembersInline(f) {
  return /\|/.test(f.constraints ?? "");
}
function isWriteOp(r) {
  if (/mutation/i.test(r.kind ?? "")) return true;
  return ["POST", "PUT", "PATCH", "DELETE"].includes((r.method ?? "").toUpperCase());
}
function isAnonymousAuth(auth) {
  return /\b(public|anon(?:ymous)?|none)\b/i.test(auth ?? "");
}
function validatePlanConsistency(plan) {
  const errors = [];
  const warnings = [];
  const entities = new Map((plan.dataModel ?? []).map((e) => [e.entity, e]));
  const interfacePaths = new Set((plan.interfaces ?? []).map((i) => i.path));
  const enumNames = new Set((plan.enums ?? []).map((e) => e.name));
  const entityNamesLower = new Set([...entities.keys()].map((n) => n.toLowerCase()));
  const seenEntity = /* @__PURE__ */ new Set();
  for (const e of plan.dataModel ?? []) {
    if (seenEntity.has(e.entity)) {
      errors.push(`dataModel defines entity \`${e.entity}\` more than once \u2014 names must be unique`);
    }
    seenEntity.add(e.entity);
  }
  for (const f of plan.features) {
    for (const e of f.entities ?? []) {
      if (!entities.has(e)) {
        errors.push(`feature "${f.name}" references entity \`${e}\` not defined in dataModel`);
      }
    }
    for (const i of f.interfaces ?? []) {
      if (!interfacePaths.has(i)) {
        errors.push(`feature "${f.name}" references interface/operation \`${i}\` not defined in interfaces`);
      }
    }
    const featureEntities = new Set(f.entities ?? []);
    for (const w of f.writes ?? []) {
      if (!entities.has(w)) {
        errors.push(`feature "${f.name}" writes entity \`${w}\` not defined in dataModel`);
      } else if (!featureEntities.has(w)) {
        warnings.push(`feature "${f.name}" writes \`${w}\` but does not list it among its entities \u2014 add it (writes must be a subset of entities)`);
      }
    }
  }
  for (const ent of plan.dataModel ?? []) {
    for (const f of ent.fields ?? []) {
      const target = fkTarget(f);
      if (target && !entityNamesLower.has(target.toLowerCase())) {
        errors.push(`field \`${ent.entity}.${f.name}\` has a foreign key to undefined table \`${target}\` \u2014 define it in dataModel or fix the reference`);
      }
    }
  }
  for (const e of plan.enums ?? []) {
    if (!e.members || e.members.length === 0) {
      errors.push(`enum \`${e.name}\` has no members`);
    }
  }
  for (const ent of plan.dataModel ?? []) {
    for (const f of ent.fields ?? []) {
      if (f.enumRef && !enumNames.has(f.enumRef)) {
        errors.push(`field \`${ent.entity}.${f.name}\` references undefined enum \`${f.enumRef}\``);
      }
      if (isEnumTyped(f) && !f.enumRef && !enumMembersInline(f)) {
        warnings.push(`enum field \`${ent.entity}.${f.name}\` has no enumerated members \u2014 list them inline (\`A | B\`) or via enumRef so values are testable`);
      }
    }
  }
  for (const c of plan.designSystem?.components ?? []) {
    if (!(c.variants?.length || c.states?.length)) {
      warnings.push(`design-system component \`${c.name}\` declares no variants or states \u2014 contract them so it can be rebuilt to a fixed spec`);
    }
  }
  const featureByInterface = /* @__PURE__ */ new Map();
  for (const f of plan.features) {
    for (const i of f.interfaces ?? []) {
      const list = featureByInterface.get(i) ?? [];
      list.push(f);
      featureByInterface.set(i, list);
    }
  }
  for (const r of plan.interfaces ?? []) {
    if (!isWriteOp(r) || !isAnonymousAuth(r.auth)) continue;
    for (const f of featureByInterface.get(r.path) ?? []) {
      for (const w of f.writes ?? []) {
        const ent = entities.get(w);
        if (!ent) continue;
        for (const field of ent.fields ?? []) {
          if (isOwnerCallerFk(field)) {
            warnings.push(
              `anonymous/public operation \`${r.path}\` writes \`${w}\`, which requires the caller's own non-null owner FK \`${w}.${field.name} -> ${fkTarget(field)}\` \u2014 an anonymous caller cannot supply it; use an anonymous-capable entity (e.g. a contactRequests table)`
            );
          }
        }
      }
    }
  }
  return { errors, warnings };
}
function renderScratchDocs(plan) {
  return [{ relPath: "CONTEXT.md", content: contextDoc(plan) }, ...adrDocs(plan)];
}
function contextDoc(plan) {
  const lines = [`# ${plan.project.name} \u2014 Context`, "", plan.project.summary, "", "## Language", ""];
  if (plan.glossary && plan.glossary.length) {
    for (const g of plan.glossary) {
      lines.push(`**${g.term}**:`, g.definition);
      if (g.avoid && g.avoid.length) lines.push(`_Avoid_: ${g.avoid.join(", ")}`);
      lines.push("");
    }
  } else {
    lines.push("_Capture the project's domain terms here as they are defined._", "");
  }
  const relations = (plan.dataModel ?? []).flatMap((e) => e.relations ?? []);
  if (relations.length) {
    lines.push("## Relationships", "");
    for (const r of relations) lines.push(`- ${r}`);
    lines.push("");
  }
  return lines.join("\n");
}
function adrDocs(plan) {
  return (plan.decisions ?? []).map((d, i) => {
    const num = String(i + 1).padStart(4, "0");
    const body = [d.context, d.decision, d.why].filter(Boolean).join(" ");
    return { relPath: `docs/adr/${num}-${slugify(d.title)}.md`, content: `# ${d.title}

${body}
` };
  });
}

// src/check.ts
import { existsSync as existsSync5, readFileSync as readFileSync11, readdirSync as readdirSync4, statSync as statSync2 } from "fs";
import { join as join13, relative as relative3 } from "path";
var REQUIRED_DOCS = ["REBUILD.md", "00-overview/PRD.md", "architecture/ARCHITECTURE.md", "architecture/INTERFACES.md", "architecture/DATA-MODEL.md"];
var FEATURE_SPINE = ["## Functional requirements", "## Acceptance criteria", "## Definition of done"];
var SKIP_DIRS = /* @__PURE__ */ new Set(["data", "source", "node_modules", ".git"]);
function collectMarkdown(dir, base = dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync4(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join13(dir, name);
    let st;
    try {
      st = statSync2(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      out.push(...collectMarkdown(full, base));
    } else if (name.endsWith(".md")) {
      out.push({ rel: relative3(base, full).split("\\").join("/"), content: readFileSync11(full, "utf8") });
    }
  }
  return out;
}
function fileNames(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync4(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join13(dir, name);
    let st;
    try {
      st = statSync2(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) out.push(...fileNames(full));
    else out.push(name);
  }
  return out;
}
function checkOutput(outDir) {
  const errors = [];
  const warnings = [];
  const invPath = join13(outDir, "inventory.json");
  if (!existsSync5(invPath)) {
    errors.push(`no inventory.json in ${outDir} \u2014 not a reconstruction output (run the analyzer first)`);
    return { errors, warnings };
  }
  let inv;
  try {
    inv = JSON.parse(readFileSync11(invPath, "utf8"));
  } catch (e) {
    errors.push(`inventory.json is not valid JSON: ${e.message}`);
    return { errors, warnings };
  }
  const docs = collectMarkdown(outDir);
  const byRel = new Map(docs.map((d) => [d.rel, d]));
  const findDoc = (rel) => byRel.get(rel) ?? docs.find((d) => d.rel.endsWith("/" + rel));
  for (const req of REQUIRED_DOCS) {
    if (!findDoc(req)) errors.push(`missing required document: ${req}`);
  }
  for (const d of docs) {
    const prose = stripQuotes(stripCode(d.content));
    const callouts = prose.split("\u{1F9E0}").length - 1;
    if (callouts > 0) {
      errors.push(`${d.rel}: ${callouts} unresolved \`\u{1F9E0}\` agent callout(s) \u2014 resolve them exhaustively and delete the callout`);
    }
    if (/fill this in/i.test(prose)) {
      errors.push(`${d.rel}: contains unresolved "fill this in" placeholder text`);
    }
  }
  const dataModelDoc2 = findDoc("architecture/DATA-MODEL.md")?.content ?? "";
  const interfacesDoc2 = findDoc("architecture/INTERFACES.md")?.content ?? "";
  const referencedEntities = /* @__PURE__ */ new Set();
  for (const e of inv.dataModel ?? []) referencedEntities.add(e.entity);
  for (const f of inv.features ?? []) for (const e of f.entities ?? []) referencedEntities.add(e);
  if (dataModelDoc2) {
    for (const e of referencedEntities) {
      if (!documents(dataModelDoc2, e)) {
        errors.push(`architecture/DATA-MODEL.md does not document entity \`${e}\` referenced by the plan/features`);
      }
    }
  }
  const referencedOps = /* @__PURE__ */ new Set();
  for (const i of inv.interfaces ?? []) referencedOps.add(i.path);
  for (const f of inv.features ?? []) for (const i of f.interfaces ?? []) referencedOps.add(i);
  if (interfacesDoc2) {
    for (const op of referencedOps) {
      if (!documents(interfacesDoc2, op)) {
        errors.push(`architecture/INTERFACES.md does not document operation \`${op}\` referenced by the plan/features`);
      }
    }
  }
  for (const d of docs) {
    if (!d.rel.includes("features/") || !d.rel.endsWith("PRD.md")) continue;
    for (const h of FEATURE_SPINE) {
      if (!d.content.includes(h)) {
        errors.push(`${d.rel}: missing required section "${h}"`);
      } else if (!sectionHasContent(d.content, h)) {
        errors.push(`${d.rel}: section "${h}" has no content \u2014 fill it (a heading alone is not a PRD section)`);
      }
    }
  }
  if (dataModelDoc2 && !declaresEntities(dataModelDoc2)) {
    errors.push("architecture/DATA-MODEL.md declares no entities \u2014 the data model is empty; fill it before the tree is buildable");
  }
  if (interfacesDoc2 && !declaresOperations(interfacesDoc2)) {
    errors.push("architecture/INTERFACES.md declares no operations \u2014 the interface surface is empty; enumerate it before the tree is buildable");
  }
  if (hasUI(inv)) {
    const ds = findDoc("architecture/DESIGN-SYSTEM.md");
    if (!ds) {
      warnings.push(
        "architecture/DESIGN-SYSTEM.md is missing but UI was detected \u2014 capture the visual contract (tokens, theming, typography, components, a11y)."
      );
    } else if (!declaresDesignSystem(stripSection(stripMetaTable(ds.content), "Design-system source files"))) {
      warnings.push("architecture/DESIGN-SYSTEM.md captures no tokens/components \u2014 fill the design-system contract for a faithful visual rebuild.");
    }
  }
  if (inv.i18n && inv.i18n.locales?.length) {
    const transDir = join13(outDir, "data", "translations");
    const names = existsSync5(transDir) ? fileNames(transDir) : [];
    const catalog = (findDoc("architecture/ARCHITECTURE.md")?.content ?? "") + "\n" + dataModelDoc2 + "\n" + interfacesDoc2 + "\n" + docs.filter((d) => /international|i18n|messages|locale/i.test(d.rel)).map((d) => d.content).join("\n");
    for (const loc of inv.i18n.locales) {
      const inFiles = names.some((n) => n.includes(loc));
      const inCatalog = catalog.includes(`${loc}`);
      if (!inFiles && !inCatalog) {
        warnings.push(`locale \`${loc}\` has no messages file under data/translations/ and is not covered in the message catalog`);
      }
    }
  }
  return { errors, warnings };
}
function documents(doc, token) {
  return doc.includes(token);
}
function stripCode(s) {
  return s.replace(/```[\s\S]*?```/g, "").replace(/~~~[\s\S]*?~~~/g, "").replace(/`[^`\n]*`/g, "");
}
function stripQuotes(s) {
  return s.replace(/"[^"\n]*"/g, "").replace(/[“”][^“”\n]*[“”]/g, "").replace(/[‘’][^‘’\n]*[‘’]/g, "");
}
function stripMetaTable(doc) {
  const lines = doc.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\|\s*Setting\s*\|\s*Value\s*\|/i.test(lines[i].trim())) {
      i++;
      while (i + 1 < lines.length && /^\|/.test(lines[i + 1].trim())) i++;
      continue;
    }
    out.push(lines[i]);
  }
  return out.join("\n");
}
function stripSection(doc, heading) {
  const re = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  const lines = doc.split(/\r?\n/);
  const out = [];
  let skipping = false;
  for (const line of lines) {
    if (/^#{1,2}\s/.test(line)) skipping = re.test(line);
    if (!skipping) out.push(line);
  }
  return out.join("\n");
}
function tableDataRowCount(doc) {
  return doc.split(/\r?\n/).filter((l) => {
    const t = l.trim();
    return t.startsWith("|") && !/^\|[\s|:-]+\|?$/.test(t);
  }).length;
}
function declaresEntities(doc) {
  const real = stripMetaTable(doc);
  return /^###\s+\S/m.test(real) || tableDataRowCount(real) >= 2;
}
function declaresOperations(doc) {
  const real = stripMetaTable(doc);
  return /^###\s+\S/m.test(real) || tableDataRowCount(real) >= 2 || /^\s*[-*]\s+\S+[./]\S*/m.test(real);
}
function declaresDesignSystem(doc) {
  return /^###\s+\S/m.test(doc) || tableDataRowCount(doc) >= 2 || /^\s*[-*]\s+\S/m.test(doc);
}
function sectionBody(doc, heading) {
  const lines = doc.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) return "";
  const body = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    body.push(lines[i]);
  }
  return body.join("\n");
}
function sectionHasContent(doc, heading) {
  return sectionBody(doc, heading).split(/\r?\n/).some((l) => {
    const t = l.trim();
    return t !== "" && !t.startsWith(">") && !t.startsWith("#");
  });
}
function formatCheckReport(r, outDir) {
  const lines = [];
  if (r.errors.length) {
    lines.push(`reconstruct --check: ${r.errors.length} error(s) in ${outDir}:`);
    for (const e of r.errors) lines.push(`  \u2717 ${e}`);
  }
  if (r.warnings.length) {
    lines.push(`reconstruct --check: ${r.warnings.length} warning(s):`);
    for (const w of r.warnings) lines.push(`  \u26A0 ${w}`);
  }
  if (!r.errors.length) {
    lines.push(
      r.warnings.length ? `reconstruct --check: PASS (with warnings) \u2014 ${outDir} has no blocking gaps.` : `reconstruct --check: PASS \u2014 ${outDir} is buildable (no unresolved callouts; references resolve).`
    );
  } else {
    lines.push(`reconstruct --check: FAIL \u2014 resolve the errors above, then re-run.`);
  }
  return lines.join("\n");
}

// src/verify.ts
import { existsSync as existsSync6, readFileSync as readFileSync12, writeFileSync as writeFileSync2 } from "fs";
import { join as join14 } from "path";
var VERIFY_MAX = 60;
var VALID = ["supported", "partial", "refuted", "unsupported"];
var VALID_CONFIDENCE = ["confirmed", "inferred", "gap"];
var CLAIM_SECTIONS = /* @__PURE__ */ new Set(["## Functional requirements", "## Acceptance criteria"]);
var STOP = new Set(
  "the a an is are be to of in on for and or with via from this that it its as at by into using used user users system when then given so each via must should can will every".split(
    " "
  )
);
function tokens(s) {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t));
}
function overlap(query, hay) {
  let n = 0;
  for (const t of new Set(query)) if (hay.has(t)) n++;
  return n;
}
function requirements(prd) {
  const out = [];
  let inSection = false;
  for (const raw of prd.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^##\s/.test(line)) {
      inSection = CLAIM_SECTIONS.has(line);
      continue;
    }
    if (!inSection) continue;
    const m = /^(?:[-*+]|\d+\.)\s+(.*)$/.exec(line);
    if (!m) continue;
    const text = m[1].replace(/^\[[ xX]\]\s*/, "").trim();
    if (!text || text.startsWith("\u{1F9E0}") || /fill this in/i.test(text)) continue;
    if (tokens(text).length < 2) continue;
    out.push(text);
  }
  return out;
}
function featureEvidence(f) {
  const out = [];
  for (const file of f.files ?? []) out.push({ ref: file, text: String(file) });
  for (const r of f.routes ?? []) {
    const sig = [r?.method, r?.route ?? r?.path].filter(Boolean).join(" ") || (typeof r === "string" ? r : JSON.stringify(r));
    out.push({ ref: `route ${sig}`, text: sig });
  }
  for (const i of f.interfaces ?? []) out.push({ ref: `interface ${i}`, text: String(i) });
  for (const e of f.entities ?? []) out.push({ ref: `entity ${e}`, text: String(e) });
  return out;
}
function runVerify(outDir, opts = {}) {
  let invRaw;
  try {
    invRaw = readFileSync12(join14(outDir, "inventory.json"), "utf8");
  } catch {
    throw new Error(`no inventory.json in ${outDir} \u2014 not a reconstruction output (run the analyzer first)`);
  }
  let inv;
  try {
    inv = JSON.parse(invRaw);
  } catch (e) {
    throw new Error(`inventory.json is not valid JSON: ${e.message}`);
  }
  const pairs = [];
  let n = 0;
  for (const f of inv.features ?? []) {
    const prdPath = join14(outDir, "features", f.slug, "PRD.md");
    if (!existsSync6(prdPath)) continue;
    const reqs = requirements(readFileSync12(prdPath, "utf8"));
    const ev = featureEvidence(f);
    const evTok = ev.map((e) => ({ e, hay: new Set(tokens(e.text)) }));
    for (const req of reqs) {
      n++;
      const qt = tokens(req);
      const ranked = evTok.map(({ e, hay }) => ({ e, s: overlap(qt, hay) })).sort((a, b) => b.s - a.s);
      const top = ranked.filter((x, i) => i === 0 || x.s > 0).slice(0, 3);
      const best = top[0];
      const evidenceRef = best && best.s > 0 ? best.e.ref : ev.length ? `feature ${f.slug}` : `feature ${f.slug} (no captured evidence)`;
      const digest = (top.some((x) => x.s > 0) ? top.filter((x) => x.s > 0) : ranked.slice(0, 4)).map((x) => x.e.ref).join(" \xB7 ").slice(0, 600) || f.description || f.name;
      pairs.push({
        claimId: `C${n}`,
        claim: req.slice(0, 400),
        feature: f.slug,
        evidenceRef,
        digest,
        score: best ? best.s : 0
      });
    }
  }
  const max = Math.max(1, Math.floor(opts.maxVerify ?? VERIFY_MAX));
  const kept = pairs.length > max ? pairs.slice().sort((a, b) => b.score - a.score || a.claimId.localeCompare(b.claimId)).slice(0, max) : pairs;
  const worklist = { run: outDir, pairs: kept.map(({ score, ...rest }) => rest) };
  const todo = {
    run: outDir,
    pairs: worklist.pairs.map((p) => ({ ...p, verdict: null, note: "", confidence: null }))
  };
  writeFileSync2(join14(outDir, "VERIFY.todo.json"), JSON.stringify(todo, null, 2));
  writeFileSync2(join14(outDir, "VERIFY.md"), renderWorklistMd(worklist, pairs.length, kept.length));
  return worklist;
}
function renderWorklistMd(wl, total, kept) {
  const out = [];
  out.push(`# Requirement verification worklist`);
  out.push("");
  out.push(
    `For each requirement, open the cited source evidence and judge whether the requirement **traces to the original code** (faithful inference) or was invented. In \`VERIFY.todo.json\`, set each \`verdict\` to supported \xB7 partial \xB7 refuted \xB7 unsupported (+ a short \`note\`), and stamp each \`confidence\` to confirmed (evidence read and decisive) \xB7 inferred (consistent but indirect \u2014 a pattern or standard behavior) \xB7 gap (evidence thin; needs a human). Save it (e.g. as \`verdicts.json\`), then run \`node scripts/analyze.mjs --verify --apply verdicts.json --out <dir>\`.`
  );
  if (kept < total) out.push(`
_Showing ${kept} of ${total} requirement(s) \u2014 capped at the best-matched evidence._`);
  out.push("");
  for (const p of wl.pairs) {
    out.push(`## ${p.claimId} \xB7 ${p.feature} \u2192 ${p.evidenceRef}`);
    out.push(`**Requirement:** ${p.claim}`);
    out.push(`**Captured evidence:** ${p.digest}`);
    out.push(`**Verdict:** _____ \xB7 **Confidence:** _____ \xB7 **Note:** _____`);
    out.push("");
  }
  return out.join("\n");
}
function readInventoryIfPresent(outDir) {
  try {
    return JSON.parse(readFileSync12(join14(outDir, "inventory.json"), "utf8"));
  } catch {
    return void 0;
  }
}
function resolveEvidence(ref, inv) {
  const features = inv.features ?? [];
  const feat = /^feature (\S+)( \(no captured evidence\))?$/.exec(ref);
  if (feat) return features.some((f) => f.slug === feat[1]);
  const route = /^route (.+)$/.exec(ref);
  if (route) {
    const sig = route[1];
    const sigs = /* @__PURE__ */ new Set();
    const add = (method, path2) => {
      if (typeof path2 !== "string" || !path2) return;
      if (typeof method === "string" && method) sigs.add(`${method} ${path2}`);
      sigs.add(path2);
    };
    for (const r of inv.routes ?? []) add(r.method, r.route);
    for (const i of inv.interfaces ?? []) add(i.method, i.path);
    for (const f of features) for (const r of f.routes ?? []) add(r?.method, r?.route ?? r?.path);
    return sigs.has(sig);
  }
  const iface = /^interface (.+)$/.exec(ref);
  if (iface) {
    const name = iface[1];
    return (inv.interfaces ?? []).some((i) => i.path === name) || features.some((f) => (f.interfaces ?? []).includes(name));
  }
  const ent = /^entity (.+)$/.exec(ref);
  if (ent) {
    const name = ent[1];
    return (inv.dataModel ?? []).some((e) => e.entity === name) || features.some((f) => (f.entities ?? []).includes(name));
  }
  const path = ref.replace(/:\d+(-\d+)?$/, "");
  return (inv.files ?? []).some((f) => f.path === path) || features.some((f) => (f.files ?? []).includes(path));
}
function applyVerdicts(outDir, verdictsPath) {
  const raw = JSON.parse(readFileSync12(verdictsPath, "utf8"));
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.pairs) ? raw.pairs : [];
  const verdicts = [];
  for (const v of list) {
    if (!v || typeof v.claimId !== "string") continue;
    const verdict = VALID.includes(v.verdict) ? v.verdict : void 0;
    const confidence = VALID_CONFIDENCE.includes(v.confidence) ? v.confidence : void 0;
    verdicts.push({
      claimId: v.claimId,
      claim: typeof v.claim === "string" ? v.claim : "",
      feature: typeof v.feature === "string" ? v.feature : "",
      evidenceRef: typeof v.evidenceRef === "string" ? v.evidenceRef : "",
      digest: typeof v.digest === "string" ? v.digest : "",
      verdict,
      note: typeof v.note === "string" ? v.note : "",
      ...confidence ? { confidence } : {}
    });
  }
  const result = reduceVerdicts(verdicts, readInventoryIfPresent(outDir));
  writeFileSync2(join14(outDir, "VERIFY.json"), JSON.stringify({ ...result, verdicts }, null, 2));
  return result;
}
function reduceVerdicts(verdicts, inv) {
  const counts = { supported: 0, partial: 0, refuted: 0, unsupported: 0 };
  for (const v of verdicts) if (v.verdict && counts[v.verdict] !== void 0) counts[v.verdict]++;
  const confidence = { confirmed: 0, inferred: 0, gap: 0, unlabeled: 0 };
  for (const v of verdicts) {
    if (v.confidence && VALID_CONFIDENCE.includes(v.confidence)) confidence[v.confidence]++;
    else confidence.unlabeled++;
  }
  const failures = [];
  const unadjudicated = [];
  for (const v of verdicts) {
    if (!v.verdict) {
      unadjudicated.push(v.claimId);
      continue;
    }
    if (v.verdict === "refuted" || v.verdict === "unsupported") {
      failures.push({ claimId: v.claimId, evidenceRef: v.evidenceRef, verdict: v.verdict, note: v.note });
    } else if (inv && !resolveEvidence(v.evidenceRef, inv)) {
      failures.push({
        claimId: v.claimId,
        evidenceRef: v.evidenceRef,
        verdict: v.verdict,
        note: `fabricated citation: evidenceRef does not resolve against the inventory${v.note ? " \u2014 " + v.note : ""}`
      });
    }
  }
  return {
    ok: failures.length === 0,
    pairs: verdicts.length,
    adjudicated: verdicts.filter((v) => !!v.verdict).length,
    supported: counts.supported,
    partial: counts.partial,
    refuted: counts.refuted,
    unsupported: counts.unsupported,
    failures,
    unadjudicated,
    confidence
  };
}
function foldSemantic(outDir, check, opts = {}) {
  const p = join14(outDir, "VERIFY.json");
  const skip = (msg) => {
    if (opts.allowUnverified) check.warnings.push(`${msg}; semantic gate skipped (--allow-unverified)`);
    else check.errors.push(`${msg} (or pass --allow-unverified to downgrade this to a warning)`);
  };
  if (!existsSync6(p)) {
    skip("--semantic: no VERIFY.json \u2014 run `--verify` then `--verify --apply <verdicts.json>` first");
    return;
  }
  let sem;
  try {
    sem = JSON.parse(readFileSync12(p, "utf8"));
  } catch (e) {
    skip(`--semantic: VERIFY.json is unreadable (${e.message})`);
    return;
  }
  if (!Array.isArray(sem.verdicts)) {
    skip("--semantic: VERIFY.json carries no verdicts[] ledger \u2014 regenerate it with `--verify` then `--verify --apply <verdicts.json>`");
    return;
  }
  const fresh = reduceVerdicts(sem.verdicts, readInventoryIfPresent(outDir));
  if (!fresh.ok) {
    check.errors.push(
      `semantic verification failed: ${fresh.failures.length} requirement(s) refuted, unsupported or citing unresolvable evidence (see VERIFY.json)`
    );
  }
  if (fresh.unadjudicated.length) {
    check.warnings.push(`${fresh.unadjudicated.length} requirement(s) not fully adjudicated by --verify`);
  }
  if (fresh.confidence?.gap) {
    check.warnings.push(
      `${fresh.confidence.gap} verdict(s) labeled confidence:gap \u2014 the cited evidence is thin; strengthen it or record the claims as known gaps`
    );
  }
}
function formatVerifyReport(r) {
  const lines = [];
  lines.push(`reconstruct --verify: ${r.adjudicated}/${r.pairs} requirement(s) adjudicated`);
  lines.push(`  supported: ${r.supported} \xB7 partial: ${r.partial} \xB7 refuted: ${r.refuted} \xB7 unsupported: ${r.unsupported}`);
  const c = r.confidence;
  if (c && c.confirmed + c.inferred + c.gap > 0) {
    lines.push(`  confidence: ${c.confirmed} confirmed \xB7 ${c.inferred} inferred \xB7 ${c.gap} gap${c.unlabeled ? ` \xB7 ${c.unlabeled} unlabeled` : ""}`);
  }
  for (const f of r.failures.slice(0, 12)) {
    lines.push(`  \u2717 ${f.claimId} (${f.evidenceRef}): ${f.verdict}${f.note ? " \u2014 " + f.note : ""}`);
  }
  if (r.unadjudicated.length) {
    lines.push(`  \u26A0 ${r.unadjudicated.length} requirement(s) not fully adjudicated: ${r.unadjudicated.join(", ")}`);
  }
  lines.push(r.ok ? `  \u2713 every requirement traces to the original source` : `  \u2717 some requirements are refuted or unsupported (invented)`);
  return lines.join("\n");
}

// src/review.ts
import { createHash } from "crypto";
import { existsSync as existsSync7, readFileSync as readFileSync13, writeFileSync as writeFileSync3 } from "fs";
import { join as join15 } from "path";
var ARCH_DOCS = ["architecture/INTERFACES.md", "architecture/DATA-MODEL.md", "architecture/ARCHITECTURE.md"];
var SEVERITIES = ["blocker", "major", "minor"];
var CATEGORIES = ["stories", "requirements", "acceptance", "write-contract", "enum", "consistency", "faithfulness", "i18n", "rebuild-test"];
function sha256(s) {
  return createHash("sha256").update(s).digest("hex");
}
function readIfExists(path) {
  try {
    return readFileSync13(path, "utf8");
  } catch {
    return "";
  }
}
function archHash(outDir) {
  return sha256(ARCH_DOCS.map((rel) => `# ${rel}
` + readIfExists(join15(outDir, rel))).join("\n"));
}
function normalizeProblem(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function findingId(f) {
  return `${f.feature}:${f.category}:${sha256(normalizeProblem(f.problem)).slice(0, 8)}`;
}
function runReview(outDir) {
  const inv = readInventory(outDir);
  const prior = readPrior(outDir);
  const round = (prior?.round ?? 0) + 1;
  const arch = archHash(outDir);
  const archChanged = prior ? prior.archHash !== arch : true;
  const units = [];
  const changedSet = [];
  for (const f of inv.features ?? []) {
    const prdPath = join15(outDir, "features", f.slug, "PRD.md");
    if (!existsSync7(prdPath)) continue;
    const prdHash = sha256(readFileSync13(prdPath, "utf8"));
    const priorHash = prior?.units.get(f.slug);
    const changed = priorHash !== void 0 && priorHash !== prdHash;
    const isNew = prior !== null && priorHash === void 0;
    const needsReview = prior === null || archChanged || changed || isNew;
    if (needsReview) changedSet.push(f.slug);
    units.push({ feature: f.slug, prdHash, archHash: arch, needsReview, findings: [] });
  }
  const worklist = { run: outDir, round, changedSet, units };
  writeFileSync3(join15(outDir, "REVIEW.todo.json"), JSON.stringify(worklist, null, 2));
  writeFileSync3(join15(outDir, "REVIEW.md"), renderWorklistMd2(worklist));
  return worklist;
}
function readInventory(outDir) {
  let raw;
  try {
    raw = readFileSync13(join15(outDir, "inventory.json"), "utf8");
  } catch {
    throw new Error(`no inventory.json in ${outDir} \u2014 not a reconstruction output (run the analyzer first)`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`inventory.json is not valid JSON: ${e.message}`);
  }
}
function readPrior(outDir) {
  const reviewPath = join15(outDir, "REVIEW.json");
  if (!existsSync7(reviewPath)) return null;
  let rev;
  try {
    rev = JSON.parse(readFileSync13(reviewPath, "utf8"));
  } catch {
    return null;
  }
  const units = /* @__PURE__ */ new Map();
  let priorArch = "";
  if (rev.baseline && Array.isArray(rev.baseline.features)) {
    priorArch = rev.baseline.archHash ?? "";
    for (const u of rev.baseline.features) units.set(u.feature, u.prdHash);
  } else {
    try {
      const todo = JSON.parse(readFileSync13(join15(outDir, "REVIEW.todo.json"), "utf8"));
      for (const u of todo.units ?? []) units.set(u.feature, u.prdHash);
      priorArch = todo.units?.[0]?.archHash ?? "";
    } catch {
    }
  }
  return {
    round: rev.round ?? 0,
    staleRounds: rev.staleRounds ?? 0,
    residual: rev.residual ?? [],
    archHash: priorArch,
    units
  };
}
function renderWorklistMd2(wl) {
  const out = [];
  const due = wl.units.filter((u) => u.needsReview);
  out.push(`# AI buildability review worklist \u2014 round ${wl.round}`);
  out.push("");
  out.push(
    `Review the ${due.length} feature(s) flagged below against the nine checks in \`references/ai-review-rubric.md\` (story completeness, requirement testability, real Given/When/Then, write-contract satisfiability, enum fidelity, cross-doc consistency, faithfulness, i18n, the rebuild self-test). For each, read the PRD plus the architecture docs it references and the embedded source. Keep the reviewer **separate from the author** and prompt it to find reasons the unit is *not* buildable.`
  );
  out.push("");
  out.push(
    `Emit each finding as \`{ feature, severity (blocker|major|minor), category, problem, fix }\`. Have an **independent verifier** set \`verdict\` to \`confirmed\` or \`refuted\` per blocker (a refuted blocker does not gate). Save the findings (e.g. as \`findings.json\`, shape \`{ "findings": [...] }\`), then run \`node scripts/analyze.mjs --review --apply findings.json --out <dir>\`.`
  );
  out.push("");
  if (wl.changedSet.length && wl.round > 1) {
    out.push(`_Changed since last round: ${wl.changedSet.join(", ")}._`);
    out.push("");
  }
  for (const u of wl.units) {
    out.push(`## ${u.feature}${u.needsReview ? "" : " \u2014 _unchanged, skip_"}`);
    out.push(`PRD: \`features/${u.feature}/PRD.md\``);
    out.push("");
  }
  return out.join("\n");
}
var VALID_SEVERITY = new Set(SEVERITIES);
var VALID_CATEGORY = new Set(CATEGORIES);
function normalizeFindings(raw) {
  let list = [];
  if (Array.isArray(raw)) list = raw;
  else if (Array.isArray(raw?.findings)) list = raw.findings;
  else if (Array.isArray(raw?.units)) {
    for (const u of raw.units) {
      for (const f of u?.findings ?? []) list.push({ feature: f.feature ?? u.feature, ...f });
    }
  }
  const out = [];
  for (const f of list) {
    if (!f || typeof f.feature !== "string") continue;
    if (!VALID_SEVERITY.has(f.severity)) continue;
    const category = VALID_CATEGORY.has(f.category) ? f.category : "rebuild-test";
    const finding = {
      feature: f.feature,
      severity: f.severity,
      category,
      problem: typeof f.problem === "string" ? f.problem : "",
      fix: typeof f.fix === "string" ? f.fix : "",
      verdict: f.verdict === "confirmed" || f.verdict === "refuted" ? f.verdict : null,
      verifierNote: typeof f.verifierNote === "string" ? f.verifierNote : ""
    };
    finding.id = typeof f.id === "string" && f.id ? f.id : findingId(finding);
    out.push(finding);
  }
  return out;
}
function gates(f) {
  return f.severity === "blocker" && f.verdict !== "refuted";
}
function reduceFindings(findings, ctx) {
  let majors = 0;
  let minors = 0;
  for (const f of findings) {
    if (f.severity === "major") majors++;
    else if (f.severity === "minor") minors++;
  }
  const touched = /* @__PURE__ */ new Set([...ctx.reviewedFeatures, ...findings.map((f) => f.feature)]);
  const known = new Set(ctx.currentFeatures);
  const fresh = findings.filter(gates).map((f) => ({
    id: f.id ?? findingId(f),
    feature: f.feature,
    category: f.category,
    problem: f.problem,
    fix: f.fix
  }));
  const carried = ctx.priorFailures.filter((pf) => !touched.has(pf.feature) && (known.size === 0 || known.has(pf.feature)));
  const byId = /* @__PURE__ */ new Map();
  for (const f of carried) byId.set(f.id, f);
  for (const f of fresh) byId.set(f.id, f);
  const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const failures = [...byId.values()].sort((a, b) => cmp(a.id, b.id));
  const residual = failures.map((f) => f.id);
  const priorResidual = [...new Set(ctx.priorFailures.map((f) => f.id))].sort(cmp);
  const sameAsPrior = residual.length > 0 && residual.length === priorResidual.length && residual.every((id, i) => id === priorResidual[i]);
  const noProgress = sameAsPrior;
  const staleRounds = noProgress ? ctx.priorStale + 1 : 0;
  return {
    ok: residual.length === 0,
    round: ctx.round,
    units: ctx.units,
    reviewed: ctx.reviewedFeatures.length,
    blockers: failures.length,
    majors,
    minors,
    changedSet: ctx.changedSet,
    residual,
    noProgress,
    staleRounds,
    failures,
    findings
  };
}
function applyFindings(outDir, findingsPath) {
  const findings = normalizeFindings(JSON.parse(readFileSync13(findingsPath, "utf8")));
  let round;
  let changedSet = [];
  let units = 0;
  let reviewedFeatures = [];
  let currentFeatures = [];
  let baseline;
  try {
    const todo = JSON.parse(readFileSync13(join15(outDir, "REVIEW.todo.json"), "utf8"));
    round = todo.round;
    changedSet = todo.changedSet ?? [];
    units = todo.units?.length ?? 0;
    reviewedFeatures = (todo.units ?? []).filter((u) => u.needsReview).map((u) => u.feature);
    currentFeatures = (todo.units ?? []).map((u) => u.feature);
    baseline = {
      archHash: todo.units?.[0]?.archHash ?? "",
      features: (todo.units ?? []).map((u) => ({ feature: u.feature, prdHash: u.prdHash }))
    };
  } catch {
  }
  let priorFailures = [];
  let priorStale = 0;
  let priorRound = 0;
  const reviewPath = join15(outDir, "REVIEW.json");
  if (existsSync7(reviewPath)) {
    try {
      const prev = JSON.parse(readFileSync13(reviewPath, "utf8"));
      priorFailures = prev.failures ?? [];
      priorStale = prev.staleRounds ?? 0;
      priorRound = prev.round ?? 0;
    } catch {
    }
  }
  const result = reduceFindings(findings, {
    round: round ?? priorRound + 1,
    // fall back to prior+1 if the worklist is gone
    changedSet,
    units,
    reviewedFeatures,
    currentFeatures,
    priorFailures,
    priorStale
  });
  if (baseline) result.baseline = baseline;
  writeFileSync3(reviewPath, JSON.stringify(result, null, 2));
  return result;
}
function recomputeReviewGate(rev) {
  const ids = /* @__PURE__ */ new Set();
  for (const f of rev.failures ?? []) if (f && typeof f.id === "string") ids.add(f.id);
  for (const f of rev.findings ?? []) {
    if (!f || typeof f.feature !== "string") continue;
    if (gates(f)) ids.add(f.id ?? findingId(f));
  }
  return [...ids].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}
function foldReview(outDir, check, opts = {}) {
  const p = join15(outDir, "REVIEW.json");
  const skip = (msg) => {
    if (opts.allowUnverified) check.warnings.push(`${msg}; review gate skipped (--allow-unverified)`);
    else check.errors.push(`${msg} (or pass --allow-unverified to downgrade this to a warning)`);
  };
  if (!existsSync7(p)) {
    skip("--semantic: no REVIEW.json \u2014 run `--review` then `--review --apply <findings.json>` first");
    return;
  }
  let rev;
  try {
    rev = JSON.parse(readFileSync13(p, "utf8"));
  } catch (e) {
    skip(`--semantic: REVIEW.json is unreadable (${e.message})`);
    return;
  }
  const residual = recomputeReviewGate(rev);
  if (residual.length) {
    check.errors.push(`AI buildability review failed: ${residual.length} unresolved blocker(s) across the feature PRDs (see REVIEW.json)`);
  }
  if (rev.noProgress) {
    check.warnings.push(
      `review made no progress for ${rev.staleRounds} round(s) on the same ${residual.length} blocker(s) \u2014 fix the shared architecture contract or record them as known gaps`
    );
  }
}
function formatReviewReport(r) {
  const lines = [];
  lines.push(
    `reconstruct --review: round ${r.round} \xB7 ${r.reviewed}/${r.units} unit(s) reviewed \xB7 ${r.blockers} blocker(s) \xB7 ${r.majors} major(s) \xB7 ${r.minors} minor(s)`
  );
  for (const f of r.failures.slice(0, 12)) {
    lines.push(`  \u2717 ${f.feature} [${f.category}]: ${f.problem}${f.fix ? " \u2014 fix: " + f.fix : ""}`);
  }
  if (r.noProgress) {
    lines.push(`  \u26A0 no progress for ${r.staleRounds} round(s) on the same blocker(s) \u2014 fix the upstream architecture contract or record as known gaps`);
  }
  lines.push(
    r.ok ? `  \u2713 zero unresolved blockers \u2014 the tree passes the AI buildability review` : `  \u2717 ${r.residual.length} blocker(s) gate buildability \u2014 fix in place, re-review the changed units, repeat`
  );
  return lines.join("\n");
}

// src/cli.ts
var HELP = `reconstruct v${VERSION}
Analyze a repository and generate reconstruction PRDs to rebuild it from scratch.

Usage:
  reconstruct [--repo <path>] [--out <path>] [options]
  reconstruct --scratch --plan <plan.json> [--out <path>] [options]

Options:
  --repo <path>        Repository to analyze            (default: current dir)
  --out <path>         Output directory                 (default: <repo>/reconstruction)
  --mode <mode>        preserve | redesign              (default: preserve)
  --level <level>      light | complex                  (default: light)
  --fidelity <mode>    mirror | embed | describe        (default: derived from mode+level)
  --granularity <g>    coarse | fine (feature grouping) (default: coarse)
  --scratch            Build from a plan.json (greenfield), not a repo
  --plan <path>        The plan.json driving --scratch   (required with --scratch)
  --tdd                Emit test-first build guidance into the PRDs/REBUILD
  --check              Validate an existing --out tree for buildability, then exit
  --verify             Write a requirement\u2192source verification worklist for --out
  --review             Write the AI buildability review worklist for --out
  --apply <path>       Apply an agent-filled verdicts/findings file (--verify/--review)
  --semantic           Fold VERIFY.json + REVIEW.json into --check (fail on unsupported reqs / blockers)
  --allow-unverified   With --check --semantic: downgrade a missing/unreadable ledger to a warning
  --include <glob>     Only analyze files matching glob (repeatable, comma-ok)
  --exclude <glob>     Skip files matching glob          (repeatable, comma-ok)
  --max-embed-bytes N  Max bytes embedded per file      (default: 16000)
  --merge              Also write RECONSTRUCTION.md (whole tree in one file)
  --summary            Also write SUMMARY.md (one-page digest)
  --features           Also write FEATURES.md (every feature PRD, nothing else)
  --specs              Also write SPECS.md (whole spec, source code stripped \u2014 implement from this)
  --json               Print the inventory JSON only, write nothing
  -h, --help           Show this help
  -v, --version        Show version

Fidelity defaults:
  preserve+light  -> mirror     preserve+complex -> embed
  redesign+light  -> embed      redesign+complex -> describe

From scratch (greenfield):
  --scratch builds the SAME reconstruction tree from a plan.json interview
  instead of a repo. mode/fidelity collapse to scratch/describe; --level still
  applies (complex = deeper interview + alternatives). It also writes CONTEXT.md
  (glossary) and docs/adr/ (decisions), and links them from 00-overview.
    reconstruct --scratch --plan plan.json --out ./reconstruction --level complex

Bundling:
  --merge / --summary / --features / --specs during a normal run append the
  file(s) to the output tree. RECONSTRUCTION.md is the whole tree in one file
  (with the embedded source); SPECS.md is the same whole tree (architecture +
  features) with the source code stripped \u2014 the self-sufficient, code-free spec
  to hand an agent to implement from; FEATURES.md is the feature PRDs only.
  Used WITHOUT --repo, they run as a post-step on an existing reconstruction:
    reconstruct --merge --summary --features --specs --out <reconstruction-dir>

Validation:
  --check runs on an already-enriched output tree and exits non-zero if it is
  not buildable: a missing required document, unresolved \u{1F9E0} callouts or "fill
  this in" placeholders, a feature PRD missing a spine section or leaving one
  empty, or an architecture doc emptied of its contract (no entities in
  DATA-MODEL.md, no operations in INTERFACES.md). On the scratch path it also
  checks feature\u2192entity/operation reference integrity. An uncovered locale is
  reported as a warning. Run it before calling a reconstruction done:
    reconstruct --check --out <reconstruction-dir>

  --review drives the AI buildability review (the semantic layer --check can't
  judge). It writes a per-feature worklist (REVIEW.todo.json/REVIEW.md), flagging
  only the features that changed since the last round. An agent fans out one
  reviewer per flagged feature + one independent verifier per blocker, fills the
  findings, then applies them \u2014 the engine reduces them to a pass / no-progress
  signal so the convergence loop terminates (see references/orchestration.md):
    reconstruct --review --out <dir>
    reconstruct --review --apply findings.json --out <dir>
  --check --semantic folds VERIFY.json (refuted/unsupported requirements) and
  REVIEW.json (unresolved blockers) into the gate \u2014 additive, never a relaxation.
  It re-reduces the persisted verdicts/findings and re-resolves every cited
  evidenceRef against the inventory (a tampered or stale ok:true never passes),
  and it FAILS CLOSED: a missing or unreadable ledger is an error \u2014 run --verify
  and --review first, or pass --allow-unverified to downgrade it to a warning.
  --check, --verify and --review are mutually exclusive (run one at a time).
`;
function fail(message) {
  process.stderr.write(`reconstruct: ${message}
`);
  process.exit(1);
}
function oneOf(name, value, allowed) {
  if (!allowed.includes(value)) {
    fail(`invalid --${name} "${value}" (expected: ${allowed.join(", ")})`);
  }
  return value;
}
function defaultFidelity(mode, level) {
  if (mode === "preserve") return level === "light" ? "mirror" : "embed";
  return level === "light" ? "embed" : "describe";
}
function splitGlobs(value) {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}
var VALUE_FLAGS = /* @__PURE__ */ new Set(["repo", "out", "mode", "level", "fidelity", "granularity", "plan", "max-embed-bytes", "include", "exclude", "apply"]);
function parseArgs(argv) {
  const raw = {};
  const includeGlobs = [];
  const excludeGlobs = [];
  let json = false;
  let merge = false;
  let summary = false;
  let features = false;
  let specs = false;
  let scratch = false;
  let tdd = false;
  let check = false;
  let verify = false;
  let review = false;
  let semantic = false;
  let allowUnverified = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      process.stdout.write(HELP);
      process.exit(0);
    }
    if (arg === "-v" || arg === "--version") {
      process.stdout.write(VERSION + "\n");
      process.exit(0);
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--merge") {
      merge = true;
      continue;
    }
    if (arg === "--summary") {
      summary = true;
      continue;
    }
    if (arg === "--features") {
      features = true;
      continue;
    }
    if (arg === "--specs") {
      specs = true;
      continue;
    }
    if (arg === "--scratch") {
      scratch = true;
      continue;
    }
    if (arg === "--tdd") {
      tdd = true;
      continue;
    }
    if (arg === "--check") {
      check = true;
      continue;
    }
    if (arg === "--verify") {
      verify = true;
      continue;
    }
    if (arg === "--review") {
      review = true;
      continue;
    }
    if (arg === "--semantic") {
      semantic = true;
      continue;
    }
    if (arg === "--allow-unverified") {
      allowUnverified = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      const key = eq !== -1 ? arg.slice(2, eq) : arg.slice(2);
      if (!VALUE_FLAGS.has(key)) {
        fail(`unknown flag: --${key} (run --help for the supported options)`);
      }
      let value;
      if (eq !== -1) {
        value = arg.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next === void 0 || next.startsWith("--")) {
          fail(`missing value for --${key}`);
        }
        value = next;
        i++;
      }
      if (key === "include") includeGlobs.push(...splitGlobs(value));
      else if (key === "exclude") excludeGlobs.push(...splitGlobs(value));
      else raw[key] = value;
      continue;
    }
    fail(`unexpected argument: ${arg} (run --help for usage)`);
  }
  const actions = [check, verify, review].filter(Boolean).length;
  if (actions > 1) {
    fail(`--check, --verify and --review are mutually exclusive \u2014 run one at a time`);
  }
  if (scratch && raw.plan === void 0) {
    fail(`--scratch requires --plan <path> (the plan.json produced by the interview)`);
  }
  const plan = raw.plan ? resolve2(raw.plan) : "";
  const standalone = (merge || summary || features || specs) && !json && !scratch && raw.repo === void 0;
  const repo = resolve2(raw.repo ?? process.cwd());
  if (!standalone && !scratch && !check && !verify && !review && (!existsSync8(repo) || !statSync3(repo).isDirectory())) {
    fail(`repo path is not a directory: ${repo}`);
  }
  const level = oneOf("level", raw.level ?? "light", ["light", "complex"]);
  const mode = scratch ? "scratch" : oneOf("mode", raw.mode ?? "preserve", ["preserve", "redesign"]);
  const fidelity = scratch ? "describe" : oneOf("fidelity", raw.fidelity ?? defaultFidelity(mode, level), ["mirror", "embed", "describe"]);
  const granularity = oneOf("granularity", raw.granularity ?? "coarse", ["coarse", "fine"]);
  const out = resolve2(
    raw.out ?? (standalone || check || verify || review ? process.cwd() : scratch ? join16(process.cwd(), "reconstruction") : join16(repo, "reconstruction"))
  );
  const maxEmbedBytes = raw["max-embed-bytes"] ? Number(raw["max-embed-bytes"]) : 16e3;
  if (!Number.isFinite(maxEmbedBytes) || maxEmbedBytes <= 0) {
    fail(`invalid --max-embed-bytes`);
  }
  return {
    repo,
    out,
    mode,
    level,
    fidelity,
    granularity,
    include: includeGlobs,
    exclude: excludeGlobs,
    json,
    maxEmbedBytes,
    merge,
    summary,
    features,
    specs,
    standalone,
    scratch,
    plan,
    tdd,
    check,
    verify,
    review,
    apply: raw.apply ?? "",
    semantic,
    allowUnverified
  };
}
function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.verify) {
    try {
      if (opts.apply) {
        const r = applyVerdicts(opts.out, resolve2(opts.apply));
        process.stdout.write(formatVerifyReport(r) + "\n");
        if (!r.ok) process.exit(1);
        return;
      }
      const wl = runVerify(opts.out);
      process.stderr.write(
        `reconstruct: ${wl.pairs.length} requirement\u2194evidence pair(s) \u2192 ${opts.out}/VERIFY.md & VERIFY.todo.json
  adjudicate each verdict, save as verdicts.json, then: node scripts/analyze.mjs --verify --apply verdicts.json --out ${opts.out}
`
      );
      return;
    } catch (e) {
      fail(e.message);
    }
  }
  if (opts.review) {
    try {
      if (opts.apply) {
        const r = applyFindings(opts.out, resolve2(opts.apply));
        process.stdout.write(formatReviewReport(r) + "\n");
        if (!r.ok) process.exit(1);
        return;
      }
      const wl = runReview(opts.out);
      const due = wl.units.filter((u) => u.needsReview).length;
      process.stderr.write(
        `reconstruct: review round ${wl.round} \u2014 ${due}/${wl.units.length} unit(s) to review \u2192 ${opts.out}/REVIEW.md & REVIEW.todo.json
  review each flagged unit (+ verify each blocker), save findings.json, then: node scripts/analyze.mjs --review --apply findings.json --out ${opts.out}
`
      );
      return;
    } catch (e) {
      fail(e.message);
    }
  }
  if (opts.check) {
    const result = checkOutput(opts.out);
    if (opts.semantic) {
      foldSemantic(opts.out, result, { allowUnverified: opts.allowUnverified });
      foldReview(opts.out, result, { allowUnverified: opts.allowUnverified });
    }
    process.stdout.write(formatCheckReport(result, opts.out) + "\n");
    if (result.errors.length) process.exit(1);
    return;
  }
  if (opts.scratch) {
    let plan;
    try {
      plan = loadPlan(opts.plan);
    } catch (e) {
      fail(e.message);
    }
    const consistency = validatePlanConsistency(plan);
    if (consistency.errors.length) {
      fail(`plan.json is internally inconsistent (fix these before rendering):
  - ` + consistency.errors.join("\n  - "));
    }
    const effOpts = { ...opts, tdd: opts.tdd || !!plan.tdd };
    const inv2 = planToInventory(plan, effOpts);
    if (effOpts.json) {
      process.stdout.write(JSON.stringify(inv2, null, 2) + "\n");
      return;
    }
    const result = render(inv2, effOpts);
    writeOutput(result, effOpts);
    const docs = writeArtifactsIfAbsent(renderScratchDocs(plan), effOpts.out);
    const adrCount = docs.filter((p) => p.startsWith("docs/adr/")).length;
    const lines2 = [
      `reconstruct: planned ${inv2.repoName} from scratch (${inv2.features.length} feature(s))`,
      `  stack:    ${inv2.stack.primaryLanguage}${inv2.stack.frameworks.length ? " \xB7 " + inv2.stack.frameworks.join(", ") : ""}`,
      `  surface:  ${inv2.features.length} feature(s) \xB7 ${inv2.interfaces?.length ?? 0} interface(s) \xB7 ${inv2.dataModel?.length ?? 0} entit(y/ies) \xB7 ${inv2.i18n ? inv2.i18n.locales.length : 0} locale(s)`,
      `  docs:     ${docs.includes("CONTEXT.md") ? "CONTEXT.md" : "CONTEXT.md (kept existing)"}${adrCount ? ` + ${adrCount} ADR(s)` : ""} (written if absent)`,
      ...consistency.warnings.length ? [`  warnings: ${consistency.warnings.length} consistency warning(s) to resolve while enriching:`, ...consistency.warnings.map((w) => `    \u26A0 ${w}`)] : [],
      ...effOpts.tdd ? [`  tdd:      test-first build guidance embedded in the PRDs`] : [],
      ...effOpts.summary ? [`  summary:  SUMMARY.md (one-page digest)`] : [],
      ...effOpts.features ? [`  features: FEATURES.md (feature PRDs only)`] : [],
      ...effOpts.specs ? [`  specs:    SPECS.md (whole spec, source stripped)`] : [],
      ...effOpts.merge ? [`  merged:   RECONSTRUCTION.md (whole tree in one file)`] : [],
      `  output:   ${effOpts.out}`,
      `  next:     open ${join16(effOpts.out, effOpts.merge ? "RECONSTRUCTION.md" : "REBUILD.md")}`
    ];
    process.stderr.write(lines2.join("\n") + "\n");
    return;
  }
  if (opts.standalone) {
    let result;
    try {
      result = bundleExisting(opts);
    } catch (e) {
      fail(e.message);
    }
    writeOutput(result, opts);
    const made = [
      ...opts.summary ? ["SUMMARY.md"] : [],
      ...opts.features ? ["FEATURES.md"] : [],
      ...opts.specs ? ["SPECS.md"] : [],
      ...opts.merge ? ["RECONSTRUCTION.md"] : []
    ];
    process.stderr.write(`reconstruct: bundled ${made.join(" + ")} into ${opts.out}
`);
    return;
  }
  let inv;
  try {
    inv = analyze(opts);
  } catch (e) {
    fail(e.message);
  }
  if (opts.json) {
    process.stdout.write(JSON.stringify(inv, null, 2) + "\n");
    return;
  }
  try {
    const result = render(inv, opts);
    writeOutput(result, opts);
  } catch (e) {
    fail(e.message);
  }
  const hintTotal = inv.hints.routeCandidates.length + inv.hints.apiCandidates.length + inv.hints.schemaCandidates.length + inv.hints.realtimeCandidates.length + inv.hints.authCandidates.length + inv.hints.designSystemCandidates.length;
  const lines = [
    `reconstruct: analyzed ${inv.fileCount} files (${inv.totalLines} lines) in ${inv.repoName}`,
    `  stack:    ${inv.stack.primaryLanguage}${inv.stack.frameworks.length ? " \xB7 " + inv.stack.frameworks.join(", ") : ""}`,
    `  libs:     ${inv.stack.libraries.length ? inv.stack.libraries.join(", ") : "\u2014"}`,
    `  features: ${inv.features.length} \xB7 routes: ${inv.routes.length} \xB7 locales: ${inv.i18n ? inv.i18n.locales.length : 0}`,
    `  hints:    ${hintTotal} candidate(s) to verify (routes/API/schema/realtime/auth/design-system) \xB7 ${inv.hints.entryPoints.length} entry point(s)`,
    ...inv.workspaces ? [`  monorepo: ${inv.workspaces.length} workspace(s) \xB7 ${inv.workspaces.reduce((n, w) => n + (w.dependsOn?.length ?? 0), 0)} dependency edge(s)`] : [],
    `  excluded: ${inv.excludedCount} file(s) skipped by ignore rules${opts.include.length || opts.exclude.length ? " + scoping globs" : ""}`,
    ...inv.warnings?.length ? [`  warnings: ${inv.warnings.length} analysis warning(s) \u2014 detection degraded, verify these by hand:`, ...inv.warnings.map((w) => `    \u26A0 ${w}`)] : [],
    ...inv.unknowns.length ? [`  unknowns: ${inv.unknowns.length} item(s) for the agent to resolve (see inventory.json)`] : [],
    `  mode/level/fidelity/granularity: ${opts.mode}/${opts.level}/${opts.fidelity}/${opts.granularity}`,
    ...opts.summary ? [`  summary:  SUMMARY.md (one-page digest)`] : [],
    ...opts.features ? [`  features: FEATURES.md (feature PRDs only)`] : [],
    ...opts.specs ? [`  specs:    SPECS.md (whole spec, source stripped)`] : [],
    ...opts.merge ? [`  merged:   RECONSTRUCTION.md (whole tree in one file)`] : [],
    `  output:   ${opts.out}`,
    `  next:     open ${join16(opts.out, opts.merge ? "RECONSTRUCTION.md" : "REBUILD.md")}`
  ];
  process.stderr.write(lines.join("\n") + "\n");
}
function isInvokedDirectly() {
  const argv1 = process.argv[1];
  if (argv1 === void 0) return false;
  const modulePath = fileURLToPath(import.meta.url);
  try {
    if (realpathSync(argv1) === realpathSync(modulePath)) return true;
  } catch {
  }
  return import.meta.url === pathToFileURL(argv1).href;
}
if (isInvokedDirectly()) main();
export {
  parseArgs
};
