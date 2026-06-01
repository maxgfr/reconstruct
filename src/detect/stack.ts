import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { FileInfo, StackInfo } from "../types.js";

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
  ["@sveltejs/kit", "SvelteKit"],
  ["astro", "Astro"],
  ["@angular/core", "Angular"],
  ["@nestjs/core", "NestJS"],
  ["express", "Express"],
  ["fastify", "Fastify"],
  ["koa", "Koa"],
  ["@hono/node-server", "Hono"],
  ["hono", "Hono"],
  ["react", "React"],
  ["vue", "Vue"],
  ["svelte", "Svelte"],
  ["solid-js", "SolidJS"],
];

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
  }
  if (existsSync(join(repo, "composer.json"))) packageManagers.add("composer");

  return {
    languages,
    primaryLanguage: languages[0] ?? "Unknown",
    frameworks: [...frameworks],
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
