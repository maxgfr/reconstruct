import type { FileInfo, RouteInfo } from "../types.js";

/**
 * A framework route adapter. Each adapter turns a repo's files into the
 * deterministic interface surface (`RouteInfo[]`) for ONE framework family.
 *
 * Adding support for a new framework is a small, self-contained PR:
 *   1. create `src/adapters/<framework>.ts` exporting a `RouteAdapter`,
 *   2. register it in the `ROUTE_ADAPTERS` array in `src/adapters/registry.ts`.
 * No other file needs to change — the registry dispatches by framework label,
 * and `analyze()` consumes the merged result. See `references/adapters.md`.
 */
export interface RouteAdapter {
  /** Stable identifier, e.g. `"nextjs"`, `"flask"`. */
  id: string;
  /**
   * Framework labels (as they appear in `stack.frameworks`) this adapter
   * handles. The registry only calls `detectRoutes` when one of these is in the
   * detected stack, so an adapter never has to re-check the framework itself.
   */
  frameworks: string[];
  /**
   * Extract the deterministic routes from the walked files. `repo` is the
   * absolute repo root so an adapter can read file contents (decorator- and
   * convention-based frameworks need the source, not just the paths). Return
   * routes in any order — the registry sorts the merged set.
   */
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[];
}
