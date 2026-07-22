import { existsSync } from "node:fs";
import { join } from "node:path";
import { extToLang } from "../vendor/codeindex-engine.mjs";
import { readJsonManifest, safeRead } from "./manifest.js";
import type { FileInfo, StackInfo } from "../types.js";

// The ext → language mapping is the vendored codeindex engine's `extToLang`
// (upstream-first); the tables below only translate its lowercase language ids
// into the display labels reconstruct's inventory has always used, and cover
// the one mapping the engine lacks. Engine ids deliberately NOT translated
// (markdown, json, yaml, html, css, shell, sql, clojure, erlang, haskell,
// objective-c, …) stay out of the histogram, exactly as before — the inventory
// counts programming languages, not data/prose formats.
const LANG_LABEL: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  vue: "Vue",
  svelte: "Svelte",
  python: "Python",
  ruby: "Ruby",
  go: "Go",
  rust: "Rust",
  java: "Java",
  kotlin: "Kotlin",
  php: "PHP",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  swift: "Swift",
  scala: "Scala",
  dart: "Dart",
  elixir: "Elixir",
  lua: "Lua",
};

// Engine gap (reported upstream, kept local): codeindex has no `.astro` entry.
const LOCAL_EXT_LANGUAGE: Record<string, string> = {
  ".astro": "Astro",
};

/** Display-label of a file extension's language, or undefined when uncounted. */
function languageLabelOf(ext: string): string | undefined {
  return LOCAL_EXT_LANGUAGE[ext] ?? LANG_LABEL[extToLang(ext)];
}

const NPM_FRAMEWORKS: Array<[string, string]> = [
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
  ["@tauri-apps/cli", "Tauri"],
];

// The framework labels (a curated subset of those NPM_FRAMEWORKS / the other-stack
// detectors emit) that imply a *UI / visual surface*. Used by `hasUI` so a
// greenfield UI plan that names a frontend framework but no styling library still
// surfaces a design-system contract. Deliberately EXCLUDES backend frameworks
// (NestJS/Express/Fastify/Koa/Hono, Django/Flask/FastAPI, Rails, Spring, Laravel,
// Go/Gin…) — a naive "any framework" check would false-positive every API repo.
export const UI_FRAMEWORK_LABELS = new Set([
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
  "Flutter",
]);

// Styling / UI libraries — the design-system signal. Kept as its own array so the
// label set `hasUI`/`detectStylingLibraries` match against is DERIVED from it (no
// hand-maintained duplicate that can drift). Spread into NPM_LIBRARIES below.
const NPM_STYLING_LIBRARIES: Array<[string, string]> = [
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
  ["@vanilla-extract/css", "vanilla-extract"],
];

/** The styling-library labels — derived from NPM_STYLING_LIBRARIES so it can't drift. */
export const STYLING_LIBRARY_LABELS = new Set(NPM_STYLING_LIBRARIES.map(([, label]) => label));

// Notable libraries keyed by dependency. A key ending in "/" matches a scope prefix
// (so all `@trpc/*` packages collapse to one "tRPC"); otherwise it's an exact dep name.
const NPM_LIBRARIES: Array<[string, string]> = [
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
  ["@aws-sdk/", "AWS SDK"],
];

// Go web frameworks keyed by their go.mod module path (matched as a substring,
// so version-suffixed paths like `github.com/go-chi/chi/v5` still hit).
const GO_FRAMEWORKS: Array<[RegExp, string]> = [
  [/github\.com\/gin-gonic\/gin/, "Gin"],
  [/github\.com\/labstack\/echo/, "Echo"],
  [/github\.com\/gofiber\/fiber/, "Fiber"],
  [/github\.com\/go-chi\/chi/, "chi"],
  [/github\.com\/gorilla\/mux/, "Gorilla"],
];

/** Detect notable libraries from a merged dependency map (runtime + dev). */
export function detectLibraries(deps: Record<string, string>): string[] {
  const names = Object.keys(deps);
  const found = new Set<string>();
  for (const [pattern, label] of NPM_LIBRARIES) {
    const hit = pattern.endsWith("/") ? names.some((n) => n.startsWith(pattern)) : pattern in deps;
    if (hit) found.add(label);
  }
  return [...found];
}

/**
 * `labelBase` prefixes manifest paths in warnings (e.g. a workspace dir), so a
 * malformed `apps/web/package.json` is reported as such, not as the root's.
 */
export function detectStack(repo: string, files: FileInfo[], warnings?: string[], labelBase = ""): StackInfo {
  // Languages ranked by file count.
  const counts = new Map<string, number>();
  for (const f of files) {
    const lang = languageLabelOf(f.ext);
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  const languages = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([lang]) => lang);

  const frameworks = new Set<string>();
  const packageManagers = new Set<string>();
  let libraries: string[] = [];
  let hasTypeScript = files.some((f) => languageLabelOf(f.ext) === "TypeScript");

  // JS/TS ecosystem.
  const hasPkg = existsSync(join(repo, "package.json"));
  const pkg = readJsonManifest(join(repo, "package.json"), labelBase + "package.json", warnings);
  if (pkg) {
    const allDeps = {
      ...((pkg.dependencies as Record<string, string>) ?? {}),
      ...((pkg.devDependencies as Record<string, string>) ?? {}),
    };
    for (const [dep, label] of NPM_FRAMEWORKS) {
      if (dep in allDeps) frameworks.add(label);
    }
    libraries = detectLibraries(allDeps);
    if ("typescript" in allDeps) hasTypeScript = true;
  }
  // Package manager from the lockfile — resolved independently of whether
  // package.json parsed, so a malformed manifest with a lockfile present still
  // reports a manager. `bun.lock` is Bun's modern text lockfile (bun.lockb is legacy).
  const hasJsManifest = hasPkg || ["pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock", "package-lock.json"].some((f) => existsSync(join(repo, f)));
  if (hasJsManifest) {
    if (existsSync(join(repo, "pnpm-lock.yaml"))) packageManagers.add("pnpm");
    else if (existsSync(join(repo, "yarn.lock"))) packageManagers.add("yarn");
    else if (existsSync(join(repo, "bun.lockb")) || existsSync(join(repo, "bun.lock"))) packageManagers.add("bun");
    else packageManagers.add("npm");
  }

  // Other ecosystems by manifest presence.
  if (existsSync(join(repo, "requirements.txt")) || existsSync(join(repo, "pyproject.toml"))) {
    packageManagers.add("pip");
    const py = safeRead(join(repo, "requirements.txt")) + safeRead(join(repo, "pyproject.toml"));
    if (/\bdjango\b/i.test(py)) frameworks.add("Django");
    if (/\bflask\b/i.test(py)) frameworks.add("Flask");
    if (/\bfastapi\b/i.test(py)) frameworks.add("FastAPI");
  }
  // Dart / Flutter (pub).
  if (existsSync(join(repo, "pubspec.yaml"))) {
    packageManagers.add("pub");
    const pubspec = safeRead(join(repo, "pubspec.yaml"));
    if (/^\s*flutter\s*:/m.test(pubspec) || /sdk:\s*flutter/.test(pubspec)) {
      frameworks.add("Flutter");
    }
  }
  if (existsSync(join(repo, "Cargo.toml"))) packageManagers.add("cargo");
  if (existsSync(join(repo, "go.mod"))) {
    packageManagers.add("go modules");
    const gomod = safeRead(join(repo, "go.mod"));
    for (const [pattern, label] of GO_FRAMEWORKS) {
      if (pattern.test(gomod)) frameworks.add(label);
    }
  }
  if (existsSync(join(repo, "Gemfile"))) {
    packageManagers.add("bundler");
    if (/\brails\b/i.test(safeRead(join(repo, "Gemfile")))) frameworks.add("Ruby on Rails");
    if (/\bsinatra\b/i.test(safeRead(join(repo, "Gemfile")))) frameworks.add("Sinatra");
  }
  if (existsSync(join(repo, "composer.json"))) {
    packageManagers.add("composer");
    const composer = safeRead(join(repo, "composer.json"));
    if (/laravel\/framework/.test(composer)) frameworks.add("Laravel");
    if (/symfony\/framework-bundle/.test(composer)) frameworks.add("Symfony");
  }
  // JVM: Maven / Gradle, with Spring Boot detection from the build file.
  if (existsSync(join(repo, "pom.xml"))) {
    packageManagers.add("maven");
    if (/spring-boot/.test(safeRead(join(repo, "pom.xml")))) frameworks.add("Spring Boot");
  }
  for (const gradle of ["build.gradle", "build.gradle.kts"]) {
    if (existsSync(join(repo, gradle))) {
      packageManagers.add("gradle");
      if (/spring-boot/.test(safeRead(join(repo, gradle)))) frameworks.add("Spring Boot");
    }
  }

  return {
    languages,
    primaryLanguage: languages[0] ?? "Unknown",
    frameworks: [...frameworks],
    libraries,
    packageManagers: [...packageManagers],
    hasTypeScript,
  };
}

// Workspace detection lives in ./workspaces.js; re-exported here for compatibility.
export { detectWorkspaces } from "./workspaces.js";

/** Required Node version from package.json `engines.node`, if declared. */
export function detectNodeVersion(repo: string, warnings?: string[]): string | undefined {
  const pkg = readJsonManifest(join(repo, "package.json"), "package.json", warnings);
  const engines = pkg?.engines;
  if (engines && typeof engines === "object") {
    const node = (engines as Record<string, unknown>).node;
    if (typeof node === "string") return node;
  }
  return undefined;
}
