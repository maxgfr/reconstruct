import type { Inventory } from "./types.js";

// Library labels (as produced by `detectLibraries` in ./detect/stack.ts) that
// indicate a styling / UI system — the design-system signal. Kept in sync with
// the "Styling / UI" block of NPM_LIBRARIES.
const STYLING_LIBRARY_LABELS = new Set([
  "Tailwind CSS",
  "styled-components",
  "Emotion",
  "MUI",
  "Chakra UI",
  "Radix UI",
  "Mantine",
  "Bootstrap",
]);

/** The subset of detected libraries that are styling / UI systems. */
export function detectStylingLibraries(libraries: string[]): string[] {
  return libraries.filter((l) => STYLING_LIBRARY_LABELS.has(l));
}

/**
 * Whether the inventory shows a UI / visual surface worth a design-system
 * contract. The single source of truth for both the `DESIGN-SYSTEM.md` template
 * (degenerate stub vs. full skeleton) and the `--check` gate (whether to demand
 * the contract). Reads only fields persisted in `inventory.json`, so it works on
 * both the code and scratch paths. Intentionally heuristic — the gate that
 * depends on it only ever WARNS, so a false positive never blocks a backend repo.
 */
export function hasUI(inv: Inventory): boolean {
  if (inv.designSystem != null) return true;
  if ((inv.stack?.stylingLibraries?.length ?? 0) > 0) return true;
  if ((inv.hints?.designSystemCandidates?.length ?? 0) > 0) return true;
  if (inv.files?.some((f) => f.category === "style")) return true;
  if (inv.routes?.some((r) => r.kind === "page" || r.kind === "component")) return true;
  return false;
}
