import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { FileInfo, StackInfo, Workspace } from "../types.js";

const EXT_LANGUAGE: Record<string, string> = {
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
  ".lua": "Lua",
};

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
  ["@aws-sdk/", "AWS SDK"],
];

/** Detect notable libraries from a merged dependency map (runtime + dev). */
export function detectLibraries(deps: Record<string, string>): string[] {
  const names = Object.keys(deps);
  const found = new Set<string>();
  for (const [pattern, label] of NPM_LIBRARIES) {
    const hit = pattern.endsWith("/")
      ? names.some((n) => n.startsWith(pattern))
      : pattern in deps;
    if (hit) found.add(label);
  }
  return [...found];
}

function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function detectStack(repo: string, files: FileInfo[]): StackInfo {
  // Languages ranked by file count.
  const counts = new Map<string, number>();
  for (const f of files) {
    const lang = EXT_LANGUAGE[f.ext];
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  const languages = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);

  const frameworks = new Set<string>();
  const packageManagers = new Set<string>();
  let libraries: string[] = [];
  let hasTypeScript = files.some((f) => f.ext === ".ts" || f.ext === ".tsx");

  // JS/TS ecosystem.
  const pkg = readJson(join(repo, "package.json"));
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
    if (existsSync(join(repo, "pnpm-lock.yaml"))) packageManagers.add("pnpm");
    else if (existsSync(join(repo, "yarn.lock"))) packageManagers.add("yarn");
    else if (existsSync(join(repo, "bun.lockb"))) packageManagers.add("bun");
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
  if (existsSync(join(repo, "Cargo.toml"))) packageManagers.add("cargo");
  if (existsSync(join(repo, "go.mod"))) packageManagers.add("go modules");
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

function safeRead(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function addWorkspace(repo: string, relDir: string, found: Map<string, Workspace>): void {
  const norm = relDir.split("\\").join("/").replace(/\/+$/, "");
  if (found.has(norm)) return;
  const pkg = readJson(join(repo, norm, "package.json"));
  if (!pkg) return;
  const name = typeof pkg.name === "string" && pkg.name ? pkg.name : norm;
  found.set(norm, { name, path: norm });
}

/**
 * Detect monorepo workspaces from package.json `workspaces`, pnpm-workspace.yaml.
 * A trailing `/*` glob is expanded one directory level. Returns [] for a
 * single-package repo.
 */
export function detectWorkspaces(repo: string): Workspace[] {
  const patterns: string[] = [];

  const pkg = readJson(join(repo, "package.json"));
  if (pkg) {
    const ws = pkg.workspaces;
    if (Array.isArray(ws)) {
      patterns.push(...ws.filter((x): x is string => typeof x === "string"));
    } else if (ws && typeof ws === "object" && Array.isArray((ws as { packages?: unknown }).packages)) {
      patterns.push(
        ...((ws as { packages: unknown[] }).packages.filter((x): x is string => typeof x === "string")),
      );
    }
  }

  const pnpm = safeRead(join(repo, "pnpm-workspace.yaml"));
  for (const line of pnpm.split(/\r?\n/)) {
    const m = line.match(/^\s*-\s*['"]?([^'"#]+?)['"]?\s*$/);
    if (m) patterns.push((m[1] as string).trim());
  }

  if (patterns.length === 0) return [];

  const found = new Map<string, Workspace>();
  for (const pat of patterns) {
    if (pat.endsWith("/*") || pat.endsWith("/**")) {
      const base = pat.replace(/\/\*+$/, "");
      try {
        for (const ent of readdirSync(join(repo, base), { withFileTypes: true })) {
          if (ent.isDirectory()) addWorkspace(repo, join(base, ent.name), found);
        }
      } catch {
        /* glob base missing */
      }
    } else {
      addWorkspace(repo, pat, found);
    }
  }

  return [...found.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/** Required Node version from package.json `engines.node`, if declared. */
export function detectNodeVersion(repo: string): string | undefined {
  const pkg = readJson(join(repo, "package.json"));
  const engines = pkg?.engines;
  if (engines && typeof engines === "object") {
    const node = (engines as Record<string, unknown>).node;
    if (typeof node === "string") return node;
  }
  return undefined;
}
