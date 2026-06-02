#!/usr/bin/env node

// src/cli.ts
import { resolve, join as join11 } from "path";
import { pathToFileURL } from "url";
import { existsSync as existsSync5, statSync as statSync3 } from "fs";

// src/analyze.ts
import { basename as basename3 } from "path";

// src/walk.ts
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, extname, basename } from "path";
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
  "Cargo.lock",
  "poetry.lock",
  "Gemfile.lock",
  "composer.lock"
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
function isProbablyBinary(abs, ext) {
  if (BINARY_EXTS.has(ext)) return true;
  try {
    const buf = readFileSync(abs);
    const sample = buf.subarray(0, 8e3);
    for (const byte of sample) {
      if (byte === 0) return true;
    }
    return false;
  } catch {
    return true;
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
  if (base === "package.json" || base === "tsconfig.json" || base.endsWith(".config.js") || base.endsWith(".config.ts") || base.endsWith(".config.mjs") || base.startsWith(".eslintrc") || base.startsWith(".prettierrc") || base.startsWith(".env") || base === "dockerfile" || base.startsWith("docker-compose") || base === "vite.config.ts" || base === "next.config.js" || base === "next.config.mjs" || base === "tailwind.config.js" || base === "tailwind.config.ts" || base === "pyproject.toml" || base === "cargo.toml" || base === "go.mod" || base === "requirements.txt" || base === "gemfile" || base === "composer.json" || base === "makefile") {
    return "config";
  }
  if (DOC_EXTS.has(ext)) return "doc";
  if (STYLE_EXTS.has(ext)) return "style";
  if (CODE_EXTS.has(ext)) return "code";
  if (ASSET_EXTS.has(ext)) return "asset";
  if (DATA_EXTS.has(ext)) return "data";
  return "other";
}
function countLines(abs) {
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
      if (!entry.isFile()) continue;
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
        lines: binary ? 0 : countLines(abs),
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
import { readFileSync as readFileSync2, existsSync, readdirSync as readdirSync2 } from "fs";
import { join as join2 } from "path";
var EXT_LANGUAGE = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
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
  // Styling / UI
  ["tailwindcss", "Tailwind CSS"],
  ["styled-components", "styled-components"],
  ["@emotion/react", "Emotion"],
  ["@mui/material", "MUI"],
  ["@chakra-ui/react", "Chakra UI"],
  ["@radix-ui/", "Radix UI"],
  ["@mantine/core", "Mantine"],
  ["bootstrap", "Bootstrap"],
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
function detectLibraries(deps) {
  const names = Object.keys(deps);
  const found = /* @__PURE__ */ new Set();
  for (const [pattern, label] of NPM_LIBRARIES) {
    const hit = pattern.endsWith("/") ? names.some((n) => n.startsWith(pattern)) : pattern in deps;
    if (hit) found.add(label);
  }
  return [...found];
}
function readJson(path) {
  try {
    return JSON.parse(readFileSync2(path, "utf8"));
  } catch {
    return null;
  }
}
function detectStack(repo, files) {
  const counts = /* @__PURE__ */ new Map();
  for (const f of files) {
    const lang = EXT_LANGUAGE[f.ext];
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  const languages = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([lang]) => lang);
  const frameworks = /* @__PURE__ */ new Set();
  const packageManagers = /* @__PURE__ */ new Set();
  let libraries = [];
  let hasTypeScript = files.some((f) => f.ext === ".ts" || f.ext === ".tsx");
  const pkg = readJson(join2(repo, "package.json"));
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
    if (existsSync(join2(repo, "pnpm-lock.yaml"))) packageManagers.add("pnpm");
    else if (existsSync(join2(repo, "yarn.lock"))) packageManagers.add("yarn");
    else if (existsSync(join2(repo, "bun.lockb"))) packageManagers.add("bun");
    else packageManagers.add("npm");
  }
  if (existsSync(join2(repo, "requirements.txt")) || existsSync(join2(repo, "pyproject.toml"))) {
    packageManagers.add("pip");
    const py = safeRead(join2(repo, "requirements.txt")) + safeRead(join2(repo, "pyproject.toml"));
    if (/\bdjango\b/i.test(py)) frameworks.add("Django");
    if (/\bflask\b/i.test(py)) frameworks.add("Flask");
    if (/\bfastapi\b/i.test(py)) frameworks.add("FastAPI");
  }
  if (existsSync(join2(repo, "Cargo.toml"))) packageManagers.add("cargo");
  if (existsSync(join2(repo, "go.mod"))) packageManagers.add("go modules");
  if (existsSync(join2(repo, "Gemfile"))) {
    packageManagers.add("bundler");
    if (/\brails\b/i.test(safeRead(join2(repo, "Gemfile")))) frameworks.add("Ruby on Rails");
    if (/\bsinatra\b/i.test(safeRead(join2(repo, "Gemfile")))) frameworks.add("Sinatra");
  }
  if (existsSync(join2(repo, "composer.json"))) {
    packageManagers.add("composer");
    const composer = safeRead(join2(repo, "composer.json"));
    if (/laravel\/framework/.test(composer)) frameworks.add("Laravel");
    if (/symfony\/framework-bundle/.test(composer)) frameworks.add("Symfony");
  }
  if (existsSync(join2(repo, "pom.xml"))) {
    packageManagers.add("maven");
    if (/spring-boot/.test(safeRead(join2(repo, "pom.xml")))) frameworks.add("Spring Boot");
  }
  for (const gradle of ["build.gradle", "build.gradle.kts"]) {
    if (existsSync(join2(repo, gradle))) {
      packageManagers.add("gradle");
      if (/spring-boot/.test(safeRead(join2(repo, gradle)))) frameworks.add("Spring Boot");
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
function safeRead(path) {
  try {
    return readFileSync2(path, "utf8");
  } catch {
    return "";
  }
}
function addWorkspace(repo, relDir, found) {
  const norm = relDir.split("\\").join("/").replace(/\/+$/, "");
  if (found.has(norm)) return;
  const pkg = readJson(join2(repo, norm, "package.json"));
  if (!pkg) return;
  const name = typeof pkg.name === "string" && pkg.name ? pkg.name : norm;
  found.set(norm, { name, path: norm });
}
var WS_SKIP_DIRS = /* @__PURE__ */ new Set([".git", "node_modules", ".turbo", "dist", "build", ".next"]);
function collectWorkspacesRecursive(repo, relBase, found, depth) {
  if (depth > 5) return;
  let entries;
  try {
    entries = readdirSync2(join2(repo, relBase), { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (!ent.isDirectory() || WS_SKIP_DIRS.has(ent.name)) continue;
    const sub = relBase ? `${relBase}/${ent.name}` : ent.name;
    addWorkspace(repo, sub, found);
    collectWorkspacesRecursive(repo, sub, found, depth + 1);
  }
}
function detectWorkspaces(repo) {
  const patterns = [];
  const pkg = readJson(join2(repo, "package.json"));
  if (pkg) {
    const ws = pkg.workspaces;
    if (Array.isArray(ws)) {
      patterns.push(...ws.filter((x) => typeof x === "string"));
    } else if (ws && typeof ws === "object" && Array.isArray(ws.packages)) {
      patterns.push(
        ...ws.packages.filter((x) => typeof x === "string")
      );
    }
  }
  const pnpm = safeRead(join2(repo, "pnpm-workspace.yaml"));
  let inPackages = false;
  for (const line of pnpm.split(/\r?\n/)) {
    if (/^\S/.test(line)) {
      inPackages = /^packages\s*:/.test(line);
      continue;
    }
    if (!inPackages) continue;
    const m = line.match(/^\s*-\s*['"]?([^'"#]+?)['"]?\s*(?:#.*)?$/);
    if (m) patterns.push(m[1].trim());
  }
  if (patterns.length === 0) return [];
  const found = /* @__PURE__ */ new Map();
  for (const raw of patterns) {
    const pat = raw.replace(/\/+$/, "");
    if (pat.endsWith("/**")) {
      collectWorkspacesRecursive(repo, pat.slice(0, -3), found, 0);
    } else if (pat.endsWith("/*")) {
      const base = pat.slice(0, -2);
      try {
        for (const ent of readdirSync2(join2(repo, base), { withFileTypes: true })) {
          if (ent.isDirectory()) addWorkspace(repo, join2(base, ent.name), found);
        }
      } catch {
      }
    } else {
      addWorkspace(repo, pat, found);
    }
  }
  return [...found.values()].sort((a, b) => a.path.localeCompare(b.path));
}
function detectNodeVersion(repo) {
  const pkg = readJson(join2(repo, "package.json"));
  const engines = pkg?.engines;
  if (engines && typeof engines === "object") {
    const node = engines.node;
    if (typeof node === "string") return node;
  }
  return void 0;
}

// src/detect/candidates.ts
import { readFileSync as readFileSync3 } from "fs";
import { join as join3 } from "path";
var CONTENT_SCAN_EXTS = /* @__PURE__ */ new Set([
  ".ts",
  ".tsx",
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
var ROUTE_DIRS = [
  "routes",
  "controllers",
  "handlers",
  "endpoints",
  "views",
  "pages",
  "api"
];
var API_DIRS = ["routers", "trpc", "resolvers", "graphql"];
var SCHEMA_DIRS = ["models", "entities", "migrations"];
var ROUTE_FILE_RE = /^(page|route|layout|template|default|\+page|\+server|\+layout)\.[jt]sx?$/;
var ROUTE_CONTENT_RE = /\b(?:app|router|route|api|blueprint|fastify|server|mux|r)\.(?:get|post|put|patch|delete|all|use|route|handle|handlefunc)\s*\(|@(?:Get|Post|Put|Patch|Delete|Controller|RequestMapping|(?:Get|Post|Put|Delete|Patch)Mapping)\b|@(?:app|router|blueprint|api)\.(?:route|get|post|put|delete|patch)\b|Route::(?:get|post|put|patch|delete|resource|apiResource|group)\b/i;
var API_CONTENT_RE = /createTRPCRouter|initTRPC|publicProcedure|protectedProcedure|t\.router\(|\btype\s+Query\b|\btype\s+Mutation\b|buildSchema\(|new\s+GraphQLSchema|makeExecutableSchema|@Resolver\b|gql`|grpc\.|registerService/;
var SCHEMA_CONTENT_RE = /pgTable\(|mysqlTable\(|sqliteTable\(|@Entity\(|@PrimaryGeneratedColumn|new\s+Schema\(|mongoose\.model\(|sequelize\.define\(|extends\s+Model\b|models\.Model\b|create_table\b|add_column\b|CREATE\s+TABLE\b|^[ \t]*model[ \t]+\w+[ \t]*\{/im;
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
    return readFileSync3(join3(repo, rel), "utf8");
  } catch {
    return "";
  }
}
function detectCandidates(repo, files, stack) {
  void stack;
  const routeCandidates = /* @__PURE__ */ new Set();
  const apiCandidates = /* @__PURE__ */ new Set();
  const schemaCandidates = /* @__PURE__ */ new Set();
  for (const f of files) {
    if (f.binary || f.size === 0) continue;
    const p = f.path;
    const lower = p.toLowerCase();
    const base = baseName(lower);
    const ext = f.ext;
    if (inDir(lower, ROUTE_DIRS) || ROUTE_FILE_RE.test(base)) routeCandidates.add(p);
    if (ext === ".graphql" || ext === ".gql" || ext === ".proto") apiCandidates.add(p);
    if ((ext === ".json" || ext === ".yaml" || ext === ".yml") && /openapi|swagger/.test(base)) {
      apiCandidates.add(p);
    }
    if (inDir(lower, API_DIRS)) apiCandidates.add(p);
    if (f.category === "schema" || ext === ".prisma") schemaCandidates.add(p);
    if (inDir(lower, SCHEMA_DIRS)) schemaCandidates.add(p);
    if (CONTENT_SCAN_EXTS.has(ext) && f.size <= MAX_CONTENT_SCAN_BYTES) {
      const src = safeRead2(repo, p);
      if (!src) continue;
      if (ROUTE_CONTENT_RE.test(src)) routeCandidates.add(p);
      if (API_CONTENT_RE.test(src)) apiCandidates.add(p);
      if (SCHEMA_CONTENT_RE.test(src)) schemaCandidates.add(p);
    }
  }
  return {
    routeCandidates: [...routeCandidates].sort(),
    apiCandidates: [...apiCandidates].sort(),
    schemaCandidates: [...schemaCandidates].sort(),
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
  "src/main.rs"
];
function detectEntryPoints(repo, files) {
  const entries = /* @__PURE__ */ new Set();
  try {
    const pkg = JSON.parse(readFileSync3(join3(repo, "package.json"), "utf8"));
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

// src/adapters/generic.ts
import { readFileSync as readFileSync4 } from "fs";
import { join as join4 } from "path";
function read(repo, rel) {
  try {
    return readFileSync4(join4(repo, rel), "utf8");
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
function extractDependencies(repo, files) {
  const result = [];
  const present = new Set(files.map((f) => f.path));
  if (present.has("package.json")) {
    const raw = read(repo, "package.json");
    if (raw) {
      try {
        const pkg = JSON.parse(raw);
        result.push({
          manager: "npm",
          manifest: "package.json",
          runtime: asStringMap(pkg.dependencies),
          dev: asStringMap(pkg.devDependencies)
        });
      } catch {
      }
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
    const raw = read(repo, "composer.json");
    if (raw) {
      try {
        const composer = JSON.parse(raw);
        result.push({
          manager: "composer",
          manifest: "composer.json",
          runtime: asStringMap(composer.require),
          dev: asStringMap(composer["require-dev"])
        });
      } catch {
      }
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
function extractScripts(repo) {
  const raw = read(repo, "package.json");
  if (!raw) return {};
  try {
    const pkg = JSON.parse(raw);
    return asStringMap(pkg.scripts);
  } catch {
    return {};
  }
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

// src/adapters/nextjs.ts
var CODE_PAGE_EXTS = /* @__PURE__ */ new Set([".tsx", ".ts", ".jsx", ".js"]);
var PAGES_SPECIAL = /* @__PURE__ */ new Set(["_app", "_document", "_error", "middleware"]);
function cleanAppSegments(segs) {
  return segs.filter((s) => !(s.startsWith("(") && s.endsWith(")")) && !s.startsWith("@"));
}
function afterDir(path, dir) {
  const parts = path.split("/");
  const idx = parts.indexOf(dir);
  if (idx === -1) return null;
  if (idx > 1) return null;
  if (idx === 1 && parts[0] !== "src") return null;
  return parts.slice(idx + 1);
}
function detectAppRoutes(files) {
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
      routes.push({ route: normalized, file: f.path, kind: "api" });
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
function detectRoutes(files, stack) {
  if (!stack.frameworks.includes("Next.js")) return [];
  const app = detectAppRoutes(files);
  const pages = detectPagesRoutes(files);
  const all = [...app, ...pages];
  all.sort((a, b) => a.route.localeCompare(b.route) || a.kind.localeCompare(b.kind));
  return all;
}

// src/adapters/i18n.ts
import { readFileSync as readFileSync5 } from "fs";
import { join as join5, basename as basename2, extname as extname2 } from "path";
var LOCALE_RE = /^[a-z]{2}(-[A-Za-z]{2,4})?$/;
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
  return base;
}
function detectI18n(repo, files) {
  const i18nFiles = files.filter((f) => f.category === "i18n");
  if (i18nFiles.length === 0) return null;
  const locales = /* @__PURE__ */ new Set();
  let keyCount = 0;
  for (const f of i18nFiles) {
    locales.add(localeOf(f.path));
    if (f.ext === ".json") {
      try {
        const data = JSON.parse(readFileSync5(join5(repo, f.path), "utf8"));
        keyCount = Math.max(keyCount, countJsonLeaves(data));
      } catch {
      }
    } else {
      try {
        const raw = readFileSync5(join5(repo, f.path), "utf8");
        const approx = raw.split(/\r?\n/).filter((l) => /^[\s-]*[\w.-]+\s*:/.test(l) || /^msgid/.test(l)).length;
        keyCount = Math.max(keyCount, approx);
      } catch {
      }
    }
  }
  return {
    locales: [...locales].sort(),
    files: i18nFiles.map((f) => f.path).sort(),
    keyCount
  };
}

// src/features.ts
var ROOTS = [
  "src/app/",
  "src/pages/",
  "src/components/",
  "src/lib/",
  "src/server/",
  "src/",
  "app/",
  "pages/",
  "lib/",
  "server/",
  "components/",
  "packages/"
];
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
var TEST_KEYS = /* @__PURE__ */ new Set([
  "test",
  "tests",
  "__tests__",
  "spec",
  "specs",
  "e2e",
  "cypress",
  "playwright"
]);
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
function buildFeatures(files, routes, i18n, granularity = "coarse") {
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
      const key = featureKey(f.path);
      const list = codeGroups.get(key) ?? [];
      list.push(f.path);
      codeGroups.set(key, list);
    }
  }
  const routesByKey = /* @__PURE__ */ new Map();
  for (const r of routes) {
    const k = routeKey(r.route);
    const list = routesByKey.get(k) ?? [];
    list.push(r);
    routesByKey.set(k, list);
  }
  const groupHasSchema = (groupFiles) => groupFiles.some((p) => schemaPaths.has(p));
  const isFoundationGroup = (key, groupFiles) => FOUNDATION_KEYS.has(key) || groupHasSchema(groupFiles);
  if (granularity === "coarse") {
    const core = codeGroups.get("core") ?? [];
    let mergedAny = false;
    for (const [key, groupFiles] of [...codeGroups.entries()]) {
      if (key === "core") continue;
      const routeCount = routesByKey.get(key)?.length ?? 0;
      const trivial = groupFiles.length === 1 && routeCount === 0 && !isFoundationGroup(key, groupFiles) && !TEST_KEYS.has(key);
      if (trivial) {
        core.push(...groupFiles);
        codeGroups.delete(key);
        mergedAny = true;
      }
    }
    if (mergedAny || codeGroups.has("core")) codeGroups.set("core", core);
  }
  const records = [];
  for (const [key, groupFiles] of codeGroups.entries()) {
    const featureRoutes = routesByKey.get(key) ?? [];
    const name = humanize(key);
    const routeList = featureRoutes.map((r) => r.route);
    const uniqueRoutes = [...new Set(routeList)];
    const desc = `Groups ${groupFiles.length} file(s)` + (uniqueRoutes.length ? `; routes: ${uniqueRoutes.slice(0, 6).join(", ")}` : "") + ".";
    const hasSchema = groupHasSchema(groupFiles);
    const tier = TEST_KEYS.has(key) ? 2 : isFoundationGroup(key, groupFiles) ? 0 : 1;
    records.push({
      feature: {
        slug: slugify(name),
        name,
        description: desc,
        kind: "feature",
        files: groupFiles.sort(),
        routes: featureRoutes
      },
      key,
      tier,
      rank: tier === 0 ? foundationRank(key, hasSchema) : 0,
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
var VERSION = "0.5.0";

// src/analyze.ts
function computeUnknowns(stack, routes, hints) {
  const u = [];
  if (stack.frameworks.length === 0) {
    u.push(
      "No web framework was detected from manifests \u2014 identify the stack and entry points from `hints.entryPoints`, then map the interface surface manually."
    );
  }
  if (routes.length === 0 && (hints.routeCandidates.length > 0 || hints.apiCandidates.length > 0)) {
    u.push(
      "Routes were not resolved deterministically (non-Next.js routing, or an RPC/GraphQL surface) \u2014 derive the real interface surface from `hints.routeCandidates` / `hints.apiCandidates` into `architecture/INTERFACES.md`."
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
  return u;
}
function analyze(opts) {
  const { files, excludedCount } = walk(opts.repo, {
    include: opts.include,
    exclude: opts.exclude
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
    generation: {
      mode: opts.mode,
      level: opts.level,
      fidelity: opts.fidelity,
      granularity: opts.granularity
    },
    repoName: basename3(opts.repo) || "project",
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
    ...workspaces.length ? { workspaces } : {},
    ...node ? { runtime: { node } } : {},
    excludedCount
  };
}

// src/prd/render.ts
import { join as join7 } from "path";

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
  const header = [
    "| Method / Trigger | Path / Operation | Kind | Auth | Notes |",
    "| --- | --- | --- | --- | --- |"
  ];
  if (!rows.length) {
    return [...header, "", "_Add one row per operation as the surface takes shape._"].join("\n");
  }
  const body = rows.map(
    (r) => `| ${cell(r.method)} | \`${cell(r.path)}\` | ${cell(r.kind ?? "")} | ${cell(r.auth ?? "")} | ${cell(r.notes ?? "")} |`
  );
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
    lines.push(
      "_No standalone enums. Every enum-typed field above must still enumerate its full member set inline (e.g. `ADMIN \\| USER`)._"
    );
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
        lines.push(
          `- \`${op.name}\`${op.input ? ` \u2014 in: ${op.input}` : ""}${op.output ? ` \u2192 out: ${op.output}` : ""}`
        );
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
    lines.push(
      `| ${cell(p.name)} | ${cell(p.kind ?? "")} | ${cell(p.rule)} | ${cell((p.appliesTo ?? []).join(", "))} |`
    );
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
    agentNote(
      "Expand this into a 1\u20132 paragraph product summary grounded in `../CONTEXT.md` (the glossary) and the feature list below."
    )
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
function architectureDoc(inv, opts) {
  const isScratch = opts.mode === "scratch";
  const topDirs = [
    ...new Set(inv.files.filter((f) => f.path.includes("/")).map((f) => f.path.split("/")[0]))
  ].sort();
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
    "| Kind | Route | Handler file |",
    "| --- | --- | --- |",
    ...inv.routes.map((r) => `| ${r.kind} | \`${r.route}\` | \`${r.file}\` |`)
  ].join("\n") : "_None resolved deterministically (the engine only resolves Next.js file-based routes)._";
  const routeCandidates = /* @__PURE__ */ new Set([...inv.hints.routeCandidates]);
  for (const r of inv.routes) routeCandidates.delete(r.file);
  return [
    "# Interface surface",
    "",
    metaBlock(inv, opts),
    agentNote(
      "Enumerate **every** interface this project exposes \u2014 HTTP routes, REST/JSON endpoints, tRPC/gRPC procedures, GraphQL operations, CLI commands, scheduled jobs, queues, and webhooks. The deterministic engine only resolves Next.js file-based routes; for everything else, **read the candidate files below** and follow `references/analysis-playbook.md` (\xA7Interface surface) plus the matching guide in `references/stack-guides/`. Fill the target table with one row per operation."
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
function diagramDoc(inv) {
  const nodes = inv.features.map((f, i) => `  F${i}["${f.name}"]`).join("\n");
  const dataNode = inv.i18n || inv.schemas.length ? '  DATA[("Data / i18n / schema")]' : "";
  const edges = inv.features.filter((f) => f.kind === "feature").map((f, i) => inv.i18n ? `  F${i} --> DATA` : "").filter(Boolean).join("\n");
  return [
    "# Module diagram",
    "",
    "```mermaid",
    "graph TD",
    nodes,
    dataNode,
    edges,
    "```",
    ""
  ].join("\n");
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
      `Turn the stories into a **numbered** checklist of precise, testable behaviours, derived from ${truth}. Cover happy paths, every edge case, every validation rule, and every error state. Leave nothing as "etc." or "and so on" \u2014 if you write a placeholder, you are not done.`
    ),
    ""
  ];
  if (feature.routes.length) {
    out.push("## Routes", "", "| Route | Kind | File |", "| --- | --- | --- |");
    for (const r of feature.routes) {
      out.push(`| \`${r.route}\` | ${r.kind} | \`${r.file}\` |`);
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
    "",
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
    ...inv.i18n ? [
      "- [ ] Every user-facing string has a source string in the message catalog and resolves in every locale (no missing keys, no hard-coded copy)."
    ] : [],
    "- [ ] `node scripts/analyze.mjs --check --out <out>` passes \u2014 no unresolved `\u{1F9E0}` callouts or placeholders, and every reference resolves.",
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
    ...inv.i18n ? [
      isScratch ? "- [ ] All locales present, each with its own messages file." : "- [ ] All locales present and keys match `data/translations/`."
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
    "Ordered by dependency tier \u2014 foundations (types, data, shared UI, i18n, cross-cutting) first, feature pages next, tests & docs last.",
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
import { readFileSync as readFileSync6 } from "fs";
import { join as join6 } from "path";
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
  const parts = [
    `Key source for this unit (${feature.files.length} file(s) total, showing up to ${MAX_EMBED_FILES}):
`
  ];
  for (const rel of feature.files.slice(0, MAX_EMBED_FILES)) {
    const ext = extOf(rel);
    const lang = FENCE_LANG[ext] ?? "";
    let body;
    try {
      body = readFileSync6(join6(opts.repo, rel), "utf8");
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
  const lines = [
    "Ground-truth source has been copied verbatim alongside this PRD. Reference it while rebuilding:\n"
  ];
  for (const rel of feature.files) {
    copies.push({
      from: join6(opts.repo, rel),
      to: join6(opts.out, "source", feature.slug, rel)
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
function demoteHeadings(md, by = 1) {
  const out = [];
  let fence = null;
  for (const line of md.split("\n")) {
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
var BUNDLE_EXCLUDE = /* @__PURE__ */ new Set(["inventory.json", "SUMMARY.md", "RECONSTRUCTION.md"]);
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
function mergeArtifacts(artifacts, inv, opts) {
  const byPath = new Map(artifacts.map((a) => [a.relPath, a.content]));
  const sections = orderedSections(artifacts, inv);
  const parts = [];
  parts.push(`# ${inv.repoName} \u2014 Reconstruction`);
  parts.push("");
  parts.push(metaLine(inv, opts));
  parts.push("");
  parts.push(
    "Single-file bundle of the full reconstruction. Each section below is one document from the reconstruction tree."
  );
  parts.push("");
  parts.push("## Contents");
  parts.push("");
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
function summarize(inv, opts) {
  const lines = [];
  lines.push(`# ${inv.repoName} \u2014 reconstruction summary`);
  lines.push("");
  lines.push(metaLine(inv, opts));
  lines.push("");
  lines.push("## Project");
  const frameworks = inv.stack.frameworks.length ? `${inv.stack.primaryLanguage} \xB7 ${inv.stack.frameworks.join(", ")}` : inv.stack.primaryLanguage;
  lines.push(`- **Stack:** ${frameworks}`);
  lines.push(`- **Notable libraries:** ${inv.stack.libraries.length ? inv.stack.libraries.join(", ") : "\u2014"}`);
  lines.push(`- **Size:** ${inv.fileCount} files \xB7 ${inv.totalLines} lines`);
  if (inv.stack.packageManagers.length) {
    lines.push(`- **Package manager(s):** ${inv.stack.packageManagers.join(", ")}`);
  }
  if (inv.runtime?.node) lines.push(`- **Runtime:** Node ${inv.runtime.node}`);
  if (inv.i18n) {
    lines.push(`- **Locales:** ${inv.i18n.locales.join(", ")} (${inv.i18n.locales.length})`);
  }
  lines.push(`- **Routes:** ${inv.routes.length} \xB7 **Features:** ${inv.features.length}`);
  if (inv.workspaces?.length) lines.push(`- **Monorepo:** ${inv.workspaces.length} workspace(s)`);
  lines.push("");
  lines.push("## Features (build order)");
  if (inv.features.length === 0) {
    lines.push("_No features detected._");
  } else {
    inv.features.forEach((f, i) => {
      const desc = f.description ? ` \u2014 ${f.description}` : "";
      lines.push(`${i + 1}. **${f.name}**${desc} \u2192 \`features/${f.slug}/PRD.md\` (${f.files.length} file(s))`);
    });
  }
  lines.push("");
  lines.push("## Interface & data surface");
  lines.push(`- Routes resolved: ${inv.routes.length}`);
  lines.push(`- Route candidates to verify: ${inv.hints.routeCandidates.length}`);
  lines.push(`- API candidates (RPC / GraphQL / gRPC / OpenAPI): ${inv.hints.apiCandidates.length}`);
  lines.push(`- Schema / data-model candidates: ${inv.hints.schemaCandidates.length}`);
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
      copies.push({ from: join7(opts.repo, rel), to: join7(opts.out, "data", sub, rel) });
    }
  };
  if (inv.i18n) dataCopy(inv.i18n.files, "translations");
  dataCopy(inv.schemas, "schema");
  dataCopy(inv.configs, "config");
  if (opts.summary) {
    artifacts.push({ relPath: "SUMMARY.md", content: summarize(inv, opts) });
  }
  if (opts.merge) {
    artifacts.push({ relPath: "RECONSTRUCTION.md", content: mergeArtifacts(artifacts, inv, opts) });
  }
  return { artifacts, copies };
}

// src/output.ts
import { mkdirSync, writeFileSync, copyFileSync, existsSync as existsSync2 } from "fs";
import { dirname, join as join8 } from "path";
function writeOutput(result, opts) {
  for (const a of result.artifacts) {
    const dest = join8(opts.out, a.relPath);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, a.content, "utf8");
  }
  for (const c of result.copies) {
    if (!existsSync2(c.from)) continue;
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
    const dest = join8(outDir, a.relPath);
    if (existsSync2(dest)) continue;
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, a.content, "utf8");
    written.push(a.relPath);
  }
  return written;
}

// src/postprocess.ts
import { readdirSync as readdirSync3, readFileSync as readFileSync7, existsSync as existsSync3 } from "fs";
import { join as join9, relative as relative2, sep } from "path";
var GROUND_TRUTH_DIRS = /* @__PURE__ */ new Set(["source", "data"]);
function readMarkdownTree(dir) {
  const out = [];
  const walk2 = (abs) => {
    for (const entry of readdirSync3(abs, { withFileTypes: true })) {
      const child = join9(abs, entry.name);
      const rel = relative2(dir, child).split(sep).join("/");
      if (entry.isDirectory()) {
        if (GROUND_TRUTH_DIRS.has(rel)) continue;
        walk2(child);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push({ relPath: rel, content: readFileSync7(child, "utf8") });
      }
    }
  };
  walk2(dir);
  return out;
}
function bundleExisting(opts) {
  const dir = opts.out;
  const invPath = join9(dir, "inventory.json");
  if (!existsSync3(invPath)) {
    throw new Error(
      `no inventory.json in ${dir} \u2014 run a full reconstruction there first (e.g. reconstruct --repo <repo> --out ${dir}).`
    );
  }
  const inv = JSON.parse(readFileSync7(invPath, "utf8"));
  const tree = readMarkdownTree(dir);
  const artifacts = [];
  if (opts.summary) artifacts.push({ relPath: "SUMMARY.md", content: summarize(inv, opts) });
  if (opts.merge) artifacts.push({ relPath: "RECONSTRUCTION.md", content: mergeArtifacts(tree, inv, opts) });
  return { artifacts, copies: [] };
}

// src/scratch.ts
import { readFileSync as readFileSync8 } from "fs";
function loadPlan(path) {
  let raw;
  try {
    raw = readFileSync8(path, "utf8");
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
  return {
    primaryLanguage: s.primaryLanguage,
    languages: s.languages ?? [s.primaryLanguage],
    frameworks: s.frameworks ?? [],
    libraries: s.libraries ?? [],
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
    hints: { routeCandidates: [], apiCandidates: [], schemaCandidates: [], entryPoints: [] },
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
    ...plan.policies && plan.policies.length ? { policies: plan.policies } : {}
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
    for (const w of f.writes ?? []) {
      if (!entities.has(w)) {
        errors.push(`feature "${f.name}" writes entity \`${w}\` not defined in dataModel`);
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
        warnings.push(
          `enum field \`${ent.entity}.${f.name}\` has no enumerated members \u2014 list them inline (\`A | B\`) or via enumRef so values are testable`
        );
      }
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
  const lines = [
    `# ${plan.project.name} \u2014 Context`,
    "",
    plan.project.summary,
    "",
    "## Language",
    ""
  ];
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
import { existsSync as existsSync4, readFileSync as readFileSync9, readdirSync as readdirSync4, statSync as statSync2 } from "fs";
import { join as join10, relative as relative3 } from "path";
var REQUIRED_DOCS = [
  "REBUILD.md",
  "00-overview/PRD.md",
  "architecture/ARCHITECTURE.md",
  "architecture/INTERFACES.md",
  "architecture/DATA-MODEL.md"
];
var FEATURE_SPINE = [
  "## Functional requirements",
  "## Acceptance criteria",
  "## Definition of done"
];
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
    const full = join10(dir, name);
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
      out.push({ rel: relative3(base, full).split("\\").join("/"), content: readFileSync9(full, "utf8") });
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
    const full = join10(dir, name);
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
  const invPath = join10(outDir, "inventory.json");
  if (!existsSync4(invPath)) {
    errors.push(
      `no inventory.json in ${outDir} \u2014 not a reconstruction output (run the analyzer first)`
    );
    return { errors, warnings };
  }
  let inv;
  try {
    inv = JSON.parse(readFileSync9(invPath, "utf8"));
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
    const callouts = d.content.split("\u{1F9E0}").length - 1;
    if (callouts > 0) {
      errors.push(
        `${d.rel}: ${callouts} unresolved \`\u{1F9E0}\` agent callout(s) \u2014 resolve them exhaustively and delete the callout`
      );
    }
    if (/fill this in/i.test(d.content)) {
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
        errors.push(
          `architecture/DATA-MODEL.md does not document entity \`${e}\` referenced by the plan/features`
        );
      }
    }
  }
  const referencedOps = /* @__PURE__ */ new Set();
  for (const i of inv.interfaces ?? []) referencedOps.add(i.path);
  for (const f of inv.features ?? []) for (const i of f.interfaces ?? []) referencedOps.add(i);
  if (interfacesDoc2) {
    for (const op of referencedOps) {
      if (!documents(interfacesDoc2, op)) {
        errors.push(
          `architecture/INTERFACES.md does not document operation \`${op}\` referenced by the plan/features`
        );
      }
    }
  }
  for (const d of docs) {
    if (!d.rel.includes("features/") || !d.rel.endsWith("PRD.md")) continue;
    for (const h of FEATURE_SPINE) {
      if (!d.content.includes(h)) errors.push(`${d.rel}: missing required section "${h}"`);
    }
    if (!hasContent(d.content)) {
      errors.push(`${d.rel}: has section headings but no content \u2014 fill the PRD (requirements, criteria, definition of done)`);
    }
  }
  if (dataModelDoc2 && !declaresEntities(dataModelDoc2)) {
    errors.push(
      "architecture/DATA-MODEL.md declares no entities \u2014 the data model is empty; fill it before the tree is buildable"
    );
  }
  if (interfacesDoc2 && !declaresOperations(interfacesDoc2)) {
    errors.push(
      "architecture/INTERFACES.md declares no operations \u2014 the interface surface is empty; enumerate it before the tree is buildable"
    );
  }
  if (inv.i18n && inv.i18n.locales?.length) {
    const transDir = join10(outDir, "data", "translations");
    const names = existsSync4(transDir) ? fileNames(transDir) : [];
    const catalog = (findDoc("architecture/ARCHITECTURE.md")?.content ?? "") + "\n" + dataModelDoc2 + "\n" + interfacesDoc2 + "\n" + docs.filter((d) => /international|i18n|messages|locale/i.test(d.rel)).map((d) => d.content).join("\n");
    for (const loc of inv.i18n.locales) {
      const inFiles = names.some((n) => n.includes(loc));
      const inCatalog = catalog.includes(`${loc}`);
      if (!inFiles && !inCatalog) {
        warnings.push(
          `locale \`${loc}\` has no messages file under data/translations/ and is not covered in the message catalog`
        );
      }
    }
  }
  return { errors, warnings };
}
function documents(doc, token) {
  return doc.includes(token);
}
function tableDataRowCount(doc) {
  return doc.split(/\r?\n/).filter((l) => {
    const t = l.trim();
    return t.startsWith("|") && !/^\|[\s|:-]+\|?$/.test(t);
  }).length;
}
function declaresEntities(doc) {
  return /^###\s+\S/m.test(doc) || tableDataRowCount(doc) >= 2;
}
function declaresOperations(doc) {
  return /^###\s+\S/m.test(doc) || tableDataRowCount(doc) >= 2 || /^\s*[-*]\s+\S+[./]\S*/m.test(doc);
}
function hasContent(doc) {
  return /^\s*[-*]\s+\S/m.test(doc) || /^\s*\d+\.\s+\S/m.test(doc) || tableDataRowCount(doc) >= 2;
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
  --include <glob>     Only analyze files matching glob (repeatable, comma-ok)
  --exclude <glob>     Skip files matching glob          (repeatable, comma-ok)
  --max-embed-bytes N  Max bytes embedded per file      (default: 16000)
  --merge              Also write RECONSTRUCTION.md (whole tree in one file)
  --summary            Also write SUMMARY.md (one-page digest)
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
  --merge / --summary during a normal run append the file(s) to the output tree.
  Used WITHOUT --repo, they run as a post-step on an existing reconstruction:
    reconstruct --merge --summary --out <reconstruction-dir>

Validation:
  --check runs on an already-enriched output tree and exits non-zero if it is
  not buildable: unresolved \u{1F9E0} callouts or "fill this in" placeholders, a feature
  that references an undocumented entity/operation, a feature PRD missing its
  spine, or an uncovered locale. Run it before calling a reconstruction done:
    reconstruct --check --out <reconstruction-dir>
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
function parseArgs(argv) {
  const raw = {};
  const includeGlobs = [];
  const excludeGlobs = [];
  let json = false;
  let merge = false;
  let summary = false;
  let scratch = false;
  let tdd = false;
  let check = false;
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
    if (arg.startsWith("--")) {
      let key;
      let value;
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        key = arg.slice(2, eq);
        value = arg.slice(eq + 1);
      } else {
        key = arg.slice(2);
        const next = argv[i + 1];
        if (next === void 0 || next.startsWith("--")) {
          fail(`missing value for ${arg}`);
        }
        value = next;
        i++;
      }
      if (key === "include") includeGlobs.push(...splitGlobs(value));
      else if (key === "exclude") excludeGlobs.push(...splitGlobs(value));
      else raw[key] = value;
    }
  }
  if (scratch && raw.plan === void 0) {
    fail(`--scratch requires --plan <path> (the plan.json produced by the interview)`);
  }
  const plan = raw.plan ? resolve(raw.plan) : "";
  const standalone = (merge || summary) && !json && !scratch && raw.repo === void 0;
  const repo = resolve(raw.repo ?? process.cwd());
  if (!standalone && !scratch && !check && (!existsSync5(repo) || !statSync3(repo).isDirectory())) {
    fail(`repo path is not a directory: ${repo}`);
  }
  const level = oneOf("level", raw.level ?? "light", ["light", "complex"]);
  const mode = scratch ? "scratch" : oneOf("mode", raw.mode ?? "preserve", ["preserve", "redesign"]);
  const fidelity = scratch ? "describe" : oneOf("fidelity", raw.fidelity ?? defaultFidelity(mode, level), [
    "mirror",
    "embed",
    "describe"
  ]);
  const granularity = oneOf("granularity", raw.granularity ?? "coarse", [
    "coarse",
    "fine"
  ]);
  const out = resolve(
    raw.out ?? (standalone || check ? process.cwd() : scratch ? join11(process.cwd(), "reconstruction") : join11(repo, "reconstruction"))
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
    standalone,
    scratch,
    plan,
    tdd,
    check
  };
}
function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.check) {
    const result2 = checkOutput(opts.out);
    process.stdout.write(formatCheckReport(result2, opts.out) + "\n");
    if (result2.errors.length) process.exit(1);
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
      fail(
        `plan.json is internally inconsistent (fix these before rendering):
  - ` + consistency.errors.join("\n  - ")
      );
    }
    const effOpts = { ...opts, tdd: opts.tdd || !!plan.tdd };
    const inv2 = planToInventory(plan, effOpts);
    if (effOpts.json) {
      process.stdout.write(JSON.stringify(inv2, null, 2) + "\n");
      return;
    }
    const result2 = render(inv2, effOpts);
    writeOutput(result2, effOpts);
    const docs = writeArtifactsIfAbsent(renderScratchDocs(plan), effOpts.out);
    const adrCount = docs.filter((p) => p.startsWith("docs/adr/")).length;
    const lines2 = [
      `reconstruct: planned ${inv2.repoName} from scratch (${inv2.features.length} feature(s))`,
      `  stack:    ${inv2.stack.primaryLanguage}${inv2.stack.frameworks.length ? " \xB7 " + inv2.stack.frameworks.join(", ") : ""}`,
      `  surface:  ${inv2.features.length} feature(s) \xB7 ${inv2.interfaces?.length ?? 0} interface(s) \xB7 ${inv2.dataModel?.length ?? 0} entit(y/ies) \xB7 ${inv2.i18n ? inv2.i18n.locales.length : 0} locale(s)`,
      `  docs:     ${docs.includes("CONTEXT.md") ? "CONTEXT.md" : "CONTEXT.md (kept existing)"}${adrCount ? ` + ${adrCount} ADR(s)` : ""} (written if absent)`,
      ...consistency.warnings.length ? [
        `  warnings: ${consistency.warnings.length} consistency warning(s) to resolve while enriching:`,
        ...consistency.warnings.map((w) => `    \u26A0 ${w}`)
      ] : [],
      ...effOpts.tdd ? [`  tdd:      test-first build guidance embedded in the PRDs`] : [],
      ...effOpts.summary ? [`  summary:  SUMMARY.md (one-page digest)`] : [],
      ...effOpts.merge ? [`  merged:   RECONSTRUCTION.md (whole tree in one file)`] : [],
      `  output:   ${effOpts.out}`,
      `  next:     open ${join11(effOpts.out, effOpts.merge ? "RECONSTRUCTION.md" : "REBUILD.md")}`
    ];
    process.stderr.write(lines2.join("\n") + "\n");
    return;
  }
  if (opts.standalone) {
    let result2;
    try {
      result2 = bundleExisting(opts);
    } catch (e) {
      fail(e.message);
    }
    writeOutput(result2, opts);
    const made = [
      ...opts.summary ? ["SUMMARY.md"] : [],
      ...opts.merge ? ["RECONSTRUCTION.md"] : []
    ];
    process.stderr.write(`reconstruct: bundled ${made.join(" + ")} into ${opts.out}
`);
    return;
  }
  const inv = analyze(opts);
  if (opts.json) {
    process.stdout.write(JSON.stringify(inv, null, 2) + "\n");
    return;
  }
  const result = render(inv, opts);
  writeOutput(result, opts);
  const hintTotal = inv.hints.routeCandidates.length + inv.hints.apiCandidates.length + inv.hints.schemaCandidates.length;
  const lines = [
    `reconstruct: analyzed ${inv.fileCount} files (${inv.totalLines} lines) in ${inv.repoName}`,
    `  stack:    ${inv.stack.primaryLanguage}${inv.stack.frameworks.length ? " \xB7 " + inv.stack.frameworks.join(", ") : ""}`,
    `  libs:     ${inv.stack.libraries.length ? inv.stack.libraries.join(", ") : "\u2014"}`,
    `  features: ${inv.features.length} \xB7 routes: ${inv.routes.length} \xB7 locales: ${inv.i18n ? inv.i18n.locales.length : 0}`,
    `  hints:    ${hintTotal} candidate(s) to verify (routes/API/schema) \xB7 ${inv.hints.entryPoints.length} entry point(s)`,
    ...inv.workspaces ? [`  monorepo: ${inv.workspaces.length} workspace(s)`] : [],
    `  excluded: ${inv.excludedCount} file(s) skipped by ignore rules${opts.include.length || opts.exclude.length ? " + scoping globs" : ""}`,
    ...inv.unknowns.length ? [`  unknowns: ${inv.unknowns.length} item(s) for the agent to resolve (see inventory.json)`] : [],
    `  mode/level/fidelity/granularity: ${opts.mode}/${opts.level}/${opts.fidelity}/${opts.granularity}`,
    ...opts.summary ? [`  summary:  SUMMARY.md (one-page digest)`] : [],
    ...opts.merge ? [`  merged:   RECONSTRUCTION.md (whole tree in one file)`] : [],
    `  output:   ${opts.out}`,
    `  next:     open ${join11(opts.out, opts.merge ? "RECONSTRUCTION.md" : "REBUILD.md")}`
  ];
  process.stderr.write(lines.join("\n") + "\n");
}
var invokedDirectly = process.argv[1] !== void 0 && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
export {
  parseArgs
};
