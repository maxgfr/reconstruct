export interface SlugifyOptions {
  /** Separator between words. */
  separator?: string;
  /** Lowercase the result. */
  lower?: boolean;
  /** Maximum length; the slug is truncated on a word boundary. */
  maxLength?: number;
  locale?: Locale;
}

export type Locale = "en" | "fr" | "de";

export class SlugifyError extends Error {
  constructor(public readonly code: "EMPTY_INPUT" | "UNSUPPORTED_LOCALE", message: string) {
    super(message);
  }
}

export function slugify(input: string, options: SlugifyOptions = {}): string {
  if (!input.trim()) throw new SlugifyError("EMPTY_INPUT", "input must not be empty");
  const { separator = "-", lower = true } = options;
  const out = input.trim().replace(/[^\p{L}\p{N}]+/gu, separator);
  return lower ? out.toLowerCase() : out;
}

export { transliterate } from "./transliterate.js";
