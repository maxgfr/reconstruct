#!/usr/bin/env node

// src/cli.ts
import { resolve as resolve2, join as join13 } from "path";
import { pathToFileURL } from "url";
import { existsSync as existsSync5, statSync as statSync3 } from "fs";

// src/analyze.ts
import { basename as basename3 } from "path";

// src/walk.ts
import { readdirSync, readFileSync, statSync } from "fs";
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
function isReconstructOutput(dir) {
  try {
    const head = readFileSync(join(dir, "inventory.json"), "utf8").slice(0, 4096);
    return /"generatedWith"\s*:\s*"reconstruct@/.test(head);
  } catch {
    return false;
  }
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
  const hasPkg = existsSync(join2(repo, "package.json"));
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
  }
  const hasJsManifest = hasPkg || ["pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock", "package-lock.json"].some(
    (f) => existsSync(join2(repo, f))
  );
  if (hasJsManifest) {
    if (existsSync(join2(repo, "pnpm-lock.yaml"))) packageManagers.add("pnpm");
    else if (existsSync(join2(repo, "yarn.lock"))) packageManagers.add("yarn");
    else if (existsSync(join2(repo, "bun.lockb")) || existsSync(join2(repo, "bun.lock")))
      packageManagers.add("bun");
    else packageManagers.add("npm");
  }
  if (existsSync(join2(repo, "requirements.txt")) || existsSync(join2(repo, "pyproject.toml"))) {
    packageManagers.add("pip");
    const py = safeRead(join2(repo, "requirements.txt")) + safeRead(join2(repo, "pyproject.toml"));
    if (/\bdjango\b/i.test(py)) frameworks.add("Django");
    if (/\bflask\b/i.test(py)) frameworks.add("Flask");
    if (/\bfastapi\b/i.test(py)) frameworks.add("FastAPI");
  }
  if (existsSync(join2(repo, "pubspec.yaml"))) {
    packageManagers.add("pub");
    const pubspec = safeRead(join2(repo, "pubspec.yaml"));
    if (/^\s*flutter\s*:/m.test(pubspec) || /sdk:\s*flutter/.test(pubspec)) {
      frameworks.add("Flutter");
    }
  }
  if (existsSync(join2(repo, "Cargo.toml"))) packageManagers.add("cargo");
  if (existsSync(join2(repo, "go.mod"))) {
    packageManagers.add("go modules");
    const gomod = safeRead(join2(repo, "go.mod"));
    for (const [pattern, label] of GO_FRAMEWORKS) {
      if (pattern.test(gomod)) frameworks.add(label);
    }
  }
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
  "src/main.rs",
  // Dart / Flutter
  "lib/main.dart"
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
import { readFileSync as readFileSync5 } from "fs";
import { join as join5 } from "path";
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
    src = readFileSync5(join5(repo, file), "utf8");
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
import { join as join6 } from "path";
function readSources(files, repo, exts) {
  const set = new Set(exts);
  const out = /* @__PURE__ */ new Map();
  for (const f of files) {
    if (!set.has(f.ext)) continue;
    try {
      out.set(f.path, readFileSync6(join6(repo, f.path), "utf8"));
    } catch {
    }
  }
  return out;
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
var DECORATOR_RE = new RegExp(
  `@(\\w+)\\.(${HTTP_DECORATORS})\\(\\s*["']([^"']*)["']([^)]*)\\)`,
  "g"
);
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
  return [...m[1].matchAll(/["']([A-Za-z]+)["']/g)].map(
    (v) => v[1].toUpperCase()
  );
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
var DECORATOR_RE2 = new RegExp(
  `@(\\w+)\\.(${METHODS})\\(\\s*["']([^"']*)["']([^)]*)\\)`,
  "g"
);
var ROUTER_DEF_RE = /(\w+)\s*=\s*APIRouter\(([^)]*)\)/g;
var INCLUDE_RE = /(\w+)\.include_router\(\s*([\w.]+)([^)]*)\)/g;
function prefixArg(args) {
  const m = args.match(/prefix\s*=\s*["']([^"']*)["']/);
  return m ? m[1] : "";
}
function methodsOf2(args) {
  const m = args.match(/methods\s*=\s*[[(]([^\])]*)[\])]/);
  if (!m) return [];
  return [...m[1].matchAll(/["']([A-Za-z]+)["']/g)].map(
    (v) => v[1].toUpperCase()
  );
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
var SRC_EXTS = [".js", ".ts", ".mjs", ".cjs"];
var APP_RE = /(?:const|let|var)\s+(\w+)\s*=\s*express\(\)/g;
var ROUTER_RE = /(?:const|let|var)\s+(\w+)\s*=\s*(?:express\.|require\(\s*["'`]express["'`]\s*\)\.)?Router\(\)/g;
var REQUIRE_RE = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
var IMPORT_RE = /import\s+(\w+)\s+from\s+["'`](\.[^"'`]*)["'`]/g;
var USE_RE = /(\w+)\.use\(\s*["'`]([^"'`]*)["'`]\s*,\s*(\w+)/g;
var ROUTE_RE = /(\w+)\.(get|post|put|delete|patch|all)\(\s*["'`]([^"'`]*)["'`]/g;
var ROUTE_CHAIN_RE = /(\w+)\.route\(\s*["'`]([^"'`]*)["'`]\s*\)/g;
var CHAIN_VERB_RE = /\.\s*(get|post|put|delete|patch|all)\s*\(/g;
function methodOf2(verb) {
  return verb.toLowerCase() === "all" ? "*" : verb.toUpperCase();
}
function dirOf(p) {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}
function resolveModule(fromFile, spec, sources) {
  const segs = [];
  for (const s of `${dirOf(fromFile)}/${spec}`.split("/")) {
    if (s === "" || s === ".") continue;
    if (s === "..") segs.pop();
    else segs.push(s);
  }
  const base = segs.join("/");
  for (const cand of [base, ...SRC_EXTS.map((e) => base + e), ...SRC_EXTS.map((e) => `${base}/index${e}`)]) {
    if (sources.has(cand)) return cand;
  }
  return null;
}
function localVars(src, re) {
  return new Set([...src.matchAll(re)].map((m) => m[1]));
}
var expressAdapter = {
  id: "express",
  frameworks: ["Express"],
  detectRoutes(files, repo) {
    const sources = readSources(files, repo, SRC_EXTS);
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
  update: [{ method: "PUT", segs: [":id"] }, { method: "PATCH", segs: [":id"] }],
  destroy: [{ method: "DELETE", segs: [":id"] }],
  edit: [{ method: "GET", segs: [":id", "edit"] }]
};
var SINGULAR_ACTIONS = {
  create: [{ method: "POST", segs: [] }],
  new: [{ method: "GET", segs: ["new"] }],
  show: [{ method: "GET", segs: [] }],
  update: [{ method: "PUT", segs: [] }, { method: "PATCH", segs: [] }],
  destroy: [{ method: "DELETE", segs: [] }],
  edit: [{ method: "GET", segs: ["edit"] }]
};
var ROOT_RE = /^root\b/;
var VERB_RE = /\b(get|post|put|patch|delete)\s+(?::(\w+)|["']([^"']+)["'])/g;
var RESOURCES_RE = /\b(resources|resource)\s+:(\w+)([^\n]*)/g;
var NAMESPACE_RE = /^namespace\s+:?(\w+)/;
var SCOPE_STR_RE = /^scope\s+["']([^"']+)["']/;
var SCOPE_PATH_RE = /^scope\b[^#\n]*\bpath:\s*["']([^"']+)["']/;
var MOUNT_RE = /\bmount\s+[\w:]+\s*(?:=>|,\s*at:)\s*["']([^"']+)["']/;
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
  const parse = (s) => new Set(s.split(",").map((a) => a.trim().replace(/^:/, "")).filter(Boolean));
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
        const mount = line.match(MOUNT_RE);
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
var MOUNT_RE2 = /(\w+)\.Mount\(\s*["`]([^"`]*)["`]/g;
var STD_VERBS = /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/;
function methodOf3(verb) {
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
          method: methodOf3(m[2])
        });
      }
      for (const m of src.matchAll(HANDLE_VERB_RE)) {
        const routePath = m[3];
        if (!routePath.startsWith("/")) continue;
        routes.push({
          route: joinRoute(prefixAt(m[1], m.index ?? 0), routePath),
          file: path,
          kind: "api",
          method: methodOf3(m[2])
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
      for (const m of src.matchAll(MOUNT_RE2)) {
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

// src/adapters/registry.ts
var ROUTE_ADAPTERS = [
  nextjsAdapter,
  flaskAdapter,
  fastapiAdapter,
  nestjsAdapter,
  expressAdapter,
  djangoAdapter,
  railsAdapter,
  goAdapter
];
function detectRoutes(files, stack, repo) {
  const active = ROUTE_ADAPTERS.filter(
    (a) => a.frameworks.some((f) => stack.frameworks.includes(f))
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
  merged.sort(
    (a, b) => a.route.localeCompare(b.route) || a.kind.localeCompare(b.kind) || (a.method ?? "").localeCompare(b.method ?? "")
  );
  return merged;
}

// src/adapters/i18n.ts
import { readFileSync as readFileSync7 } from "fs";
import { join as join7, basename as basename2, extname as extname2 } from "path";
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
    const raw = readFileSync7(join7(repo, f.path), "utf8");
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
var VERSION = "0.7.1";

// src/analyze.ts
function computeUnknowns(stack, routes, hints) {
  const u = [];
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
  return u;
}
function analyze(opts) {
  const { files, excludedCount } = walk(opts.repo, {
    include: opts.include,
    exclude: opts.exclude,
    out: opts.out
  });
  const stack = detectStack(opts.repo, files);
  const dependencies = extractDependencies(opts.repo, files);
  const routes = detectRoutes(files, stack, opts.repo);
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
import { join as join9 } from "path";

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
      "Enumerate **every** interface this project exposes \u2014 HTTP routes, REST/JSON endpoints, tRPC/gRPC procedures, GraphQL operations, CLI commands, scheduled jobs, queues, and webhooks. The deterministic engine resolves routes for the supported frameworks (Next.js, Express, Flask, FastAPI, NestJS, Django, Rails, Go); for everything else, **read the candidate files below** and follow `references/analysis-playbook.md` (\xA7Interface surface) plus the matching guide in `references/stack-guides/`. Fill the target table with one row per operation."
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
import { readFileSync as readFileSync8 } from "fs";
import { join as join8 } from "path";
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
      body = readFileSync8(join8(opts.repo, rel), "utf8");
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
      from: join8(opts.repo, rel),
      to: join8(opts.out, "source", feature.slug, rel)
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
      copies.push({ from: join9(opts.repo, rel), to: join9(opts.out, "data", sub, rel) });
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
import { dirname, join as join10 } from "path";
function writeOutput(result, opts) {
  for (const a of result.artifacts) {
    const dest = join10(opts.out, a.relPath);
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
    const dest = join10(outDir, a.relPath);
    if (existsSync2(dest)) continue;
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, a.content, "utf8");
    written.push(a.relPath);
  }
  return written;
}

// src/postprocess.ts
import { readdirSync as readdirSync3, readFileSync as readFileSync9, existsSync as existsSync3 } from "fs";
import { join as join11, relative as relative2, sep } from "path";
var GROUND_TRUTH_DIRS = /* @__PURE__ */ new Set(["source", "data"]);
function readMarkdownTree(dir) {
  const out = [];
  const walk2 = (abs) => {
    for (const entry of readdirSync3(abs, { withFileTypes: true })) {
      const child = join11(abs, entry.name);
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
  const invPath = join11(dir, "inventory.json");
  if (!existsSync3(invPath)) {
    throw new Error(
      `no inventory.json in ${dir} \u2014 run a full reconstruction there first (e.g. reconstruct --repo <repo> --out ${dir}).`
    );
  }
  const inv = JSON.parse(readFileSync9(invPath, "utf8"));
  const tree = readMarkdownTree(dir);
  const artifacts = [];
  if (opts.summary) artifacts.push({ relPath: "SUMMARY.md", content: summarize(inv, opts) });
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
        warnings.push(
          `feature "${f.name}" writes \`${w}\` but does not list it among its entities \u2014 add it (writes must be a subset of entities)`
        );
      }
    }
  }
  for (const ent of plan.dataModel ?? []) {
    for (const f of ent.fields ?? []) {
      const target = fkTarget(f);
      if (target && !entityNamesLower.has(target.toLowerCase())) {
        errors.push(
          `field \`${ent.entity}.${f.name}\` has a foreign key to undefined table \`${target}\` \u2014 define it in dataModel or fix the reference`
        );
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
import { existsSync as existsSync4, readFileSync as readFileSync11, readdirSync as readdirSync4, statSync as statSync2 } from "fs";
import { join as join12, relative as relative3 } from "path";
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
    const full = join12(dir, name);
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
    const full = join12(dir, name);
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
  const invPath = join12(outDir, "inventory.json");
  if (!existsSync4(invPath)) {
    errors.push(
      `no inventory.json in ${outDir} \u2014 not a reconstruction output (run the analyzer first)`
    );
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
      errors.push(
        `${d.rel}: ${callouts} unresolved \`\u{1F9E0}\` agent callout(s) \u2014 resolve them exhaustively and delete the callout`
      );
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
      if (!d.content.includes(h)) {
        errors.push(`${d.rel}: missing required section "${h}"`);
      } else if (!sectionHasContent(d.content, h)) {
        errors.push(
          `${d.rel}: section "${h}" has no content \u2014 fill it (a heading alone is not a PRD section)`
        );
      }
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
    const transDir = join12(outDir, "data", "translations");
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
  not buildable: a missing required document, unresolved \u{1F9E0} callouts or "fill
  this in" placeholders, a feature PRD missing a spine section or leaving one
  empty, or an architecture doc emptied of its contract (no entities in
  DATA-MODEL.md, no operations in INTERFACES.md). On the scratch path it also
  checks feature\u2192entity/operation reference integrity. An uncovered locale is
  reported as a warning. Run it before calling a reconstruction done:
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
  const plan = raw.plan ? resolve2(raw.plan) : "";
  const standalone = (merge || summary) && !json && !scratch && raw.repo === void 0;
  const repo = resolve2(raw.repo ?? process.cwd());
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
  const out = resolve2(
    raw.out ?? (standalone || check ? process.cwd() : scratch ? join13(process.cwd(), "reconstruction") : join13(repo, "reconstruction"))
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
      `  next:     open ${join13(effOpts.out, effOpts.merge ? "RECONSTRUCTION.md" : "REBUILD.md")}`
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
    `  next:     open ${join13(opts.out, opts.merge ? "RECONSTRUCTION.md" : "REBUILD.md")}`
  ];
  process.stderr.write(lines.join("\n") + "\n");
}
var invokedDirectly = process.argv[1] !== void 0 && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
export {
  parseArgs
};
