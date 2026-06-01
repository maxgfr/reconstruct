import { readFileSync } from "node:fs";
import { join, basename, extname } from "node:path";
import type { FileInfo, I18nInfo } from "../types.js";

const LOCALE_RE = /^[a-z]{2}(-[A-Za-z]{2,4})?$/;

function countJsonLeaves(value: unknown): number {
  if (value === null || typeof value !== "object") return 1;
  if (Array.isArray(value)) return value.length || 1;
  let n = 0;
  for (const v of Object.values(value as Record<string, unknown>)) {
    n += countJsonLeaves(v);
  }
  return n;
}

function localeOf(path: string): string {
  const ext = extname(path);
  const base = basename(path, ext);
  if (LOCALE_RE.test(base)) return base;
  const parts = path.split("/");
  const parent = parts[parts.length - 2];
  if (parent && LOCALE_RE.test(parent)) return parent;
  return base;
}

export function detectI18n(repo: string, files: FileInfo[]): I18nInfo | null {
  const i18nFiles = files.filter((f) => f.category === "i18n");
  if (i18nFiles.length === 0) return null;

  const locales = new Set<string>();
  let keyCount = 0;

  for (const f of i18nFiles) {
    locales.add(localeOf(f.path));
    if (f.ext === ".json") {
      try {
        const data = JSON.parse(readFileSync(join(repo, f.path), "utf8"));
        keyCount = Math.max(keyCount, countJsonLeaves(data));
      } catch {
        /* malformed translation file */
      }
    } else {
      // yaml/po/properties — approximate one key per "key:" or msgid line.
      try {
        const raw = readFileSync(join(repo, f.path), "utf8");
        const approx = raw.split(/\r?\n/).filter((l) => /^[\s-]*[\w.-]+\s*:/.test(l) || /^msgid/.test(l)).length;
        keyCount = Math.max(keyCount, approx);
      } catch {
        /* ignore */
      }
    }
  }

  return {
    locales: [...locales].sort(),
    files: i18nFiles.map((f) => f.path).sort(),
    keyCount,
  };
}
