import { readFileSync } from "node:fs";

// Shared manifest readers. JSON manifests get malformed-file warnings here; the
// TOML/YAML/Gemfile readers stay regex-based and cannot cheaply distinguish a
// malformed file from an absent section, so they degrade silently by design.

/**
 * Read and parse a JSON manifest. A missing/unreadable file is an expected
 * non-signal → null, silently. A file that exists but does not parse is a
 * repo defect the agent should hear about → null, plus a warning pushed to
 * the collector (when given) so detection degrades loudly, not silently.
 */
export function readJsonManifest(
  absPath: string,
  relLabel: string,
  warnings?: string[],
): Record<string, unknown> | null {
  let raw: string;
  try {
    raw = readFileSync(absPath, "utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (e) {
    const reason = String((e as Error).message ?? e).split("\n")[0];
    warnings?.push(`malformed ${relLabel}: ${reason} — falling back to empty defaults`);
    return null;
  }
}

/** File content, or "" when missing/unreadable. */
export function safeRead(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}
