import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FileInfo } from "../types.js";

/** Read the source of every walked file whose extension is in `exts`. */
export function readSources(files: FileInfo[], repo: string, exts: string[]): Map<string, string> {
  const set = new Set(exts);
  const out = new Map<string, string>();
  for (const f of files) {
    if (!set.has(f.ext)) continue;
    try {
      out.set(f.path, readFileSync(join(repo, f.path), "utf8"));
    } catch {
      /* unreadable — skip */
    }
  }
  return out;
}

/** JS/TS source extensions the JS-family route adapters read. */
export const JS_SRC_EXTS = [".js", ".ts", ".mts", ".cts", ".mjs", ".cjs"];

function dirOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}

/** Resolve a relative import/require spec to a file present in `sources`. */
export function resolveModule(fromFile: string, spec: string, sources: Map<string, string>, exts: string[] = JS_SRC_EXTS): string | null {
  const segs: string[] = [];
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

/** "routes/users.py" -> "routes.users" so an import path matches a file. */
export function moduleName(path: string): string {
  return path
    .replace(/\.py$/, "")
    .replace(/\/__init__$/, "")
    .split("/")
    .join(".");
}

/** Join route segments (prefixes + a path) into one normalized "/a/b" route. */
export function joinRoute(...parts: string[]): string {
  const segs = parts.join("/").split("/").filter(Boolean);
  return "/" + segs.join("/");
}

/** Map `alias -> "module::name"` for every `from module import name [as alias]`. */
export function pythonImportAliases(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of src.matchAll(/^\s*from\s+([\w.]+)\s+import\s+(.+)$/gm)) {
    const module = m[1] as string;
    for (const part of (m[2] as string).split(",")) {
      const asMatch = part.trim().match(/^(\w+)(?:\s+as\s+(\w+))?$/);
      if (!asMatch) continue;
      const name = asMatch[1] as string;
      const alias = (asMatch[2] as string) ?? name;
      out.set(alias, `${module}::${name}`);
    }
  }
  return out;
}
