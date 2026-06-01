import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FileInfo } from "../types.js";

/** Best-effort entry points for a JS/TS project, from package.json + conventions. */
export function detectEntryPoints(repo: string, files: FileInfo[]): string[] {
  const entries = new Set<string>();
  try {
    const pkg = JSON.parse(readFileSync(join(repo, "package.json"), "utf8")) as Record<
      string,
      unknown
    >;
    for (const key of ["main", "module"]) {
      const v = pkg[key];
      if (typeof v === "string") entries.add(v.replace(/^\.\//, ""));
    }
    if (pkg.bin && typeof pkg.bin === "object") {
      for (const v of Object.values(pkg.bin as Record<string, string>)) {
        if (typeof v === "string") entries.add(v.replace(/^\.\//, ""));
      }
    }
  } catch {
    /* no package.json */
  }

  const conventional = [
    "src/index.ts",
    "src/index.js",
    "src/main.ts",
    "src/main.tsx",
    "index.ts",
    "index.js",
    "app/layout.tsx",
    "src/app/layout.tsx",
  ];
  const present = new Set(files.map((f) => f.path));
  for (const c of conventional) {
    if (present.has(c)) entries.add(c);
  }

  return [...entries].sort();
}

/** Count UI components (PascalCase .tsx/.jsx files) — a rough complexity signal. */
export function countComponents(files: FileInfo[]): number {
  return files.filter(
    (f) =>
      (f.ext === ".tsx" || f.ext === ".jsx" || f.ext === ".vue" || f.ext === ".svelte") &&
      /^[A-Z]/.test(f.path.split("/").pop() ?? ""),
  ).length;
}
