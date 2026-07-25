import type { Locale } from "./index.js";

const MAPS: Record<Locale, Record<string, string>> = {
  en: {},
  fr: { é: "e", è: "e", à: "a" },
  de: { ä: "ae", ö: "oe", ü: "ue", ß: "ss" },
};

export function transliterate(input: string, locale: Locale = "en"): string {
  const map = MAPS[locale];
  return [...input].map((ch) => map[ch] ?? ch).join("");
}
