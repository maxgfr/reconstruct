import { readFileSync } from "node:fs";
import { join, basename, extname } from "node:path";
import type { FileInfo, I18nInfo } from "../types.js";

// BCP-47-ish: a 2–3-letter primary subtag (en, fil, yue), optional script/region
// (zh-Hant, en-US) and variants (es-419). 3-letter codes matter so locales like
// `fil`/`yue` aren't mistaken for namespace filenames.
const LOCALE_RE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?(-[A-Za-z0-9]{2,8})*$/;
const I18N_DIR_RE = /^(locales?|i18n|lang|langs|translations|messages)$/i;

function countJsonLeaves(value: unknown): number {
  if (value === null || typeof value !== "object") return 1;
  if (Array.isArray(value)) return value.length || 1;
  let n = 0;
  for (const v of Object.values(value as Record<string, unknown>)) {
    n += countJsonLeaves(v);
  }
  return n;
}

// ISO 639-1 primary subtags plus the 3-letter codes apps commonly ship. The
// shape alone can't tell `en` from a namespace called `app` or `ui`.
const LANGUAGE_CODES = new Set(
  (
    "aa ab af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy " +
    "ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo " +
    "lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl " +
    "sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu " +
    "ast cat fil haw hsb kab yue zgh ckb"
  ).split(" "),
);

/** A real language tag, judged by its primary subtag (`en-US` → `en`). */
function isLanguageTag(s: string): boolean {
  return LOCALE_RE.test(s) && LANGUAGE_CODES.has((s.split(/[-_]/)[0] as string).toLowerCase());
}

function localeOf(path: string): string {
  const ext = extname(path);
  const base = basename(path, ext);
  const parts = path.split("/");
  const parent = parts[parts.length - 2];
  // Known language codes first, the directory before the file: locales/en/app.json
  // (namespace file in a locale dir) and locales/common/en.json (locale file in a
  // namespace dir) both resolve to `en`.
  if (parent && isLanguageTag(parent)) return parent;
  if (isLanguageTag(base)) return base;
  // Shape-only fallbacks for codes outside the list: the directory still wins,
  // because short namespace names (`app`, `ui`, `faq`) also fit the pattern.
  if (parent && LOCALE_RE.test(parent)) return parent;
  if (LOCALE_RE.test(base)) return base;
  // Namespaced layout (locales/<locale>/<namespace>.json): when neither the file
  // nor the parent looks like a locale but the grandparent is an i18n dir, the
  // parent dir is the locale — never emit a namespace filename as a locale.
  const grand = parts[parts.length - 3];
  if (parent && grand && I18N_DIR_RE.test(grand)) return parent;
  return base;
}

/** Leaf-key count of one i18n file (JSON tree, or approx for yaml/po/properties). */
function keysIn(repo: string, f: FileInfo): number {
  try {
    const raw = readFileSync(join(repo, f.path), "utf8");
    if (f.ext === ".json") return countJsonLeaves(JSON.parse(raw));
    return raw.split(/\r?\n/).filter((l) => /^[\s-]*[\w.-]+\s*:/.test(l) || /^msgid/.test(l)).length;
  } catch {
    return 0;
  }
}

export function detectI18n(repo: string, files: FileInfo[]): I18nInfo | null {
  const i18nFiles = files.filter((f) => f.category === "i18n");
  if (i18nFiles.length === 0) return null;

  // Sum keys per locale (a locale can be split across many namespace files), and
  // report the largest locale's total as the catalog size — Math.max across raw
  // files undercounts a namespaced catalog.
  const locales = new Set<string>();
  const keysByLocale = new Map<string, number>();
  for (const f of i18nFiles) {
    const loc = localeOf(f.path);
    locales.add(loc);
    keysByLocale.set(loc, (keysByLocale.get(loc) ?? 0) + keysIn(repo, f));
  }
  const keyCount = Math.max(0, ...keysByLocale.values());

  return {
    locales: [...locales].sort(),
    files: i18nFiles.map((f) => f.path).sort(),
    keyCount,
  };
}
