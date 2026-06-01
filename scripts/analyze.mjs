#!/usr/bin/env node

// src/cli.ts
import { resolve, join as join9 } from "path";
import { existsSync as existsSync3, statSync as statSync2 } from "fs";

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
    if (c) out.push(c.re);
  }
  return out;
}
function walk(repo, opts = {}) {
  const ignore = loadIgnore(repo);
  const includeRes = compileGlobs(opts.include);
  const excludeRes = compileGlobs(opts.exclude);
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
        recurse(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (DEFAULT_IGNORE_FILES.has(entry.name)) {
        excludedCount++;
        continue;
      }
      if (excludeRes.some((re) => re.test(rel))) {
        excludedCount++;
        continue;
      }
      if (includeRes.length > 0 && !includeRes.some((re) => re.test(rel))) {
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
  for (const line of pnpm.split(/\r?\n/)) {
    const m = line.match(/^\s*-\s*['"]?([^'"#]+?)['"]?\s*$/);
    if (m) patterns.push(m[1].trim());
  }
  if (patterns.length === 0) return [];
  const found = /* @__PURE__ */ new Map();
  for (const pat of patterns) {
    if (pat.endsWith("/*") || pat.endsWith("/**")) {
      const base = pat.replace(/\/\*+$/, "");
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
var SCHEMA_CONTENT_RE = /pgTable\(|mysqlTable\(|sqliteTable\(|@Entity\(|@PrimaryGeneratedColumn|new\s+Schema\(|mongoose\.model\(|sequelize\.define\(|extends\s+Model\b|models\.Model\b|create_table\b|add_column\b|CREATE\s+TABLE\b|^\s*model\s+\w+\s*\{/im;
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
    if (f.binary) continue;
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
    if (CONTENT_SCAN_EXTS.has(ext)) {
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
    /os\.environ(?:\.get)?\[?["']([A-Z][A-Z0-9_]*)["']/g
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
  return seg.startsWith("(") && seg.endsWith(")") || seg.startsWith("[") && seg.endsWith("]");
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
function foundationRank(key, hasSchema) {
  const i = FOUNDATION_ORDER.indexOf(key);
  if (i !== -1) return i;
  if (hasSchema) return SCHEMA_RANK;
  return Number.POSITIVE_INFINITY;
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

// src/types.ts
var VERSION = "0.1.0";

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
    `| Generated with | \`${inv.generatedWith}\` |`,
    ""
  ].join("\n");
}
function overviewPrd(inv, opts) {
  const s = inv.stack;
  const featureIndex = inv.features.map((f) => `- [\`${f.slug}\`](../features/${f.slug}/PRD.md) \u2014 **${f.name}**: ${f.description}`).join("\n");
  const out = [
    `# ${inv.repoName} \u2014 Reconstruction Overview`,
    "",
    metaBlock(inv, opts),
    "## Product summary",
    "",
    opts.level === "complex" ? agentNote(
      "Write a 1\u20132 paragraph product summary: what this project does, for whom, and the core value. Infer it from the README, routes, and feature names below, then refine."
    ) : "_Summarize what this project does, derived from the README and the feature list below._",
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
    `- Files analyzed: **${inv.fileCount}** (${inv.totalLines} lines)`,
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
    "1. Read `architecture/ARCHITECTURE.md` for the overall shape, then `architecture/INTERFACES.md` (the full interface surface) and `architecture/DATA-MODEL.md` (entities & relations).",
    "2. Rebuild feature by feature using each `features/<slug>/PRD.md`, in the order listed in `REBUILD.md`.",
    "3. Use `data/` (translations, schema, config) and \u2014 when present \u2014 `source/` as ground truth.",
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
    inv.i18n ? `Locales: ${inv.i18n.locales.join(", ")} \u2014 files copied to \`data/translations/\`.` : "_No i18n detected._",
    ""
  ];
  if (opts.mode === "preserve") {
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
    opts.level === "light" ? "_One row per route / endpoint / procedure / command / job. Cover the whole surface, not just the candidates above._" : agentNote(
      "Add a row per operation. Note auth/permission requirements, input/output shapes (link to `DATA-MODEL.md`), and side effects."
    ),
    ""
  ].join("\n");
}
function dataModelDoc(inv, opts) {
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
    opts.level === "light" ? "_One block of rows per entity. Capture primary keys, foreign keys, enums, defaults, and indexes._" : agentNote(
      "For each entity, capture fields + types, PK/FK, enums, defaults, indexes, and how it maps to the interfaces in `INTERFACES.md`."
    ),
    "",
    "## Relations & integrity",
    "",
    "_Summarize relationships, cascade rules, and any derived/computed data._",
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
  const out = [
    `# ${feature.name}`,
    "",
    `> Unit \`${feature.slug}\` \xB7 kind: ${feature.kind}`,
    "",
    "## Summary",
    "",
    feature.description,
    "",
    "## Functional requirements",
    "",
    opts.level === "complex" ? agentNote(
      "Derive precise, testable functional requirements for this unit from the source material below. Cover happy paths, edge cases, validation, and error states."
    ) : "_Describe what this unit must do, as a checklist of behaviors, based on the source below._",
    ""
  ];
  if (feature.routes.length) {
    out.push("## Routes", "", "| Route | Kind | File |", "| --- | --- | --- |");
    for (const r of feature.routes) {
      out.push(`| \`${r.route}\` | ${r.kind} | \`${r.file}\` |`);
    }
    out.push("");
  }
  out.push("## Source material", "", sourceMarkdown, "");
  if (opts.level === "complex") {
    out.push(
      "## Improvements & refactors",
      "",
      agentNote(
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
  return out.join("\n");
}
function rebuildDoc(inv, opts) {
  const order = inv.features.map((f, i) => `${i + 1}. [ ] **${f.name}** \u2192 \`features/${f.slug}/PRD.md\``).join("\n");
  return [
    `# REBUILD \u2014 ${inv.repoName}`,
    "",
    metaBlock(inv, opts),
    "This folder is a complete plan to rebuild the project from scratch.",
    "",
    "## Mode & level",
    "",
    `- **${opts.mode}**: ${opts.mode === "preserve" ? "keep the current architecture" : "design a new architecture for the same features"}.`,
    `- **${opts.level}**: ${opts.level === "light" ? "faithful, minimal-editorializing PRDs" : "PRDs that also suggest improvements to fold in"}.`,
    `- **${opts.fidelity}** fidelity: ${opts.fidelity === "mirror" ? "real files copied under `source/`" : opts.fidelity === "embed" ? "key code embedded directly in the PRDs" : "descriptive PRDs only \u2014 rewrite from requirements"}.`,
    "",
    "## Build order",
    "",
    "Ordered by dependency tier \u2014 foundations (types, data, shared UI, i18n, cross-cutting) first, feature pages next, tests & docs last.",
    "",
    order || "_No features._",
    "",
    "## Procedure",
    "",
    "1. Start with `00-overview/PRD.md`, `architecture/ARCHITECTURE.md`, `architecture/INTERFACES.md`, and `architecture/DATA-MODEL.md`.",
    "2. For each unit in order, open its PRD and implement it.",
    "3. Wire shared data from `data/` (translations, schema, config).",
    opts.fidelity === "mirror" ? "4. Use the copied files under `source/<slug>/` as ground truth." : "4. Validate behavior against the requirements in each PRD.",
    "5. Run the project's own scripts to verify: " + (Object.keys(inv.scripts).length ? Object.keys(inv.scripts).slice(0, 6).map((s) => `\`${s}\``).join(", ") : "_no scripts detected_") + ".",
    "",
    "## Validation checklist",
    "",
    "- [ ] Every interface in `architecture/INTERFACES.md` is implemented (routes, endpoints, RPC/GraphQL, jobs).",
    "- [ ] Data model matches `architecture/DATA-MODEL.md` and `data/schema/`.",
    "- [ ] All routes respond as before.",
    "- [ ] All locales present and keys match `data/translations/`.",
    "- [ ] Required env vars configured: " + (inv.envVars.length ? inv.envVars.map((e) => `\`${e}\``).join(", ") : "_none_") + ".",
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

// src/cli.ts
var HELP = `reconstruct v${VERSION}
Analyze a repository and generate reconstruction PRDs to rebuild it from scratch.

Usage:
  reconstruct [--repo <path>] [--out <path>] [options]

Options:
  --repo <path>        Repository to analyze            (default: current dir)
  --out <path>         Output directory                 (default: <repo>/reconstruction)
  --mode <mode>        preserve | redesign              (default: preserve)
  --level <level>      light | complex                  (default: light)
  --fidelity <mode>    mirror | embed | describe        (default: derived from mode+level)
  --granularity <g>    coarse | fine (feature grouping) (default: coarse)
  --include <glob>     Only analyze files matching glob (repeatable, comma-ok)
  --exclude <glob>     Skip files matching glob          (repeatable, comma-ok)
  --max-embed-bytes N  Max bytes embedded per file      (default: 16000)
  --json               Print the inventory JSON only, write nothing
  -h, --help           Show this help
  -v, --version        Show version

Fidelity defaults:
  preserve+light  -> mirror     preserve+complex -> embed
  redesign+light  -> embed      redesign+complex -> describe
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
  const repo = resolve(raw.repo ?? process.cwd());
  if (!existsSync3(repo) || !statSync2(repo).isDirectory()) {
    fail(`repo path is not a directory: ${repo}`);
  }
  const mode = oneOf("mode", raw.mode ?? "preserve", ["preserve", "redesign"]);
  const level = oneOf("level", raw.level ?? "light", ["light", "complex"]);
  const fidelity = oneOf(
    "fidelity",
    raw.fidelity ?? defaultFidelity(mode, level),
    ["mirror", "embed", "describe"]
  );
  const granularity = oneOf("granularity", raw.granularity ?? "coarse", [
    "coarse",
    "fine"
  ]);
  const out = resolve(raw.out ?? join9(repo, "reconstruction"));
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
    maxEmbedBytes
  };
}
function main() {
  const opts = parseArgs(process.argv.slice(2));
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
    `  output:   ${opts.out}`,
    `  next:     open ${join9(opts.out, "REBUILD.md")}`
  ];
  process.stderr.write(lines.join("\n") + "\n");
}
main();
export {
  parseArgs
};
