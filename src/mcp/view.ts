import { canonicalJson, sha256Hex } from "../evidence.js";
import type { Inventory } from "../types.js";

// Summary-first inventories and a deterministic pager over them.
//
// A whole inventory of a real repo is tens of thousands of lines of JSON: sent
// in one tool result it either blows the response cap or buries the few facts
// the model needed under every file path. So reconstruct_inventory answers with
// a summary plus an `inventory_id`, keeps the full record here, and
// reconstruct_view pages one section of it at a time.

/** Sections reconstruct_view can page, each an array in the inventory. */
export const VIEW_SECTIONS = ["files", "routes", "features", "evidence", "envVars", "dependencies", "unknowns", "warnings", "workspaces", "hints"] as const;
export type ViewSection = (typeof VIEW_SECTIONS)[number];

export const VIEW_DEFAULT_LIMIT = 100;
export const VIEW_MAX_LIMIT = 500;

// Bounded: a long-lived server must not keep every inventory it ever built.
const CACHE_MAX = 16;
const cache = new Map<string, Inventory>();

/** Content id of an inventory (the version stamp excluded, so it is stable across releases). */
export function inventoryId(inv: Inventory): string {
  const { generatedWith: _ignored, ...rest } = inv;
  return `inv_${sha256Hex(canonicalJson(rest)).slice(0, 16)}`;
}

export function rememberInventory(inv: Inventory): string {
  const id = inventoryId(inv);
  cache.delete(id);
  cache.set(id, inv);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  return id;
}

export function recallInventory(id: string): Inventory | undefined {
  return cache.get(id);
}

/** Test seam. */
export function resetInventoryCache(): void {
  cache.clear();
}

/** What a model needs to decide where to look next — counts, stack, features — and nothing per-file. */
export function summarizeInventory(inv: Inventory): Record<string, unknown> {
  const sizes: Record<string, number> = {};
  for (const s of VIEW_SECTIONS) sizes[s] = sectionItems(inv, s).length;
  return {
    repoName: inv.repoName,
    stack: inv.stack,
    fileCount: inv.fileCount,
    totalLines: inv.totalLines,
    features: (inv.features ?? []).map((f) => ({ slug: f.slug, name: f.name, kind: f.kind, files: f.files.length, routes: f.routes.length })),
    unknowns: inv.unknowns,
    ...(inv.warnings?.length ? { warnings: inv.warnings } : {}),
    sections: sizes,
  };
}

function sectionItems(inv: Inventory, section: ViewSection): unknown[] {
  if (section === "hints") {
    // Hints is an object of candidate lists: flatten to { kind, path } rows.
    return Object.entries(inv.hints ?? {}).flatMap(([kind, list]) => (Array.isArray(list) ? list.map((path) => ({ kind, path })) : []));
  }
  const v = (inv as unknown as Record<string, unknown>)[section];
  return Array.isArray(v) ? v : [];
}

export interface ViewPage {
  section: ViewSection;
  offset: number;
  limit: number;
  total: number;
  /** Items matching the filter (equals total without one). */
  matched: number;
  items: unknown[];
  /** Offset of the next page, or null on the last one. */
  next_offset: number | null;
}

/** One deterministic page of a section, optionally filtered by a case-insensitive substring. */
export function viewSection(inv: Inventory, section: ViewSection, opts: { offset?: number; limit?: number; filter?: string } = {}): ViewPage {
  const all = sectionItems(inv, section);
  const needle = opts.filter?.toLowerCase();
  const matching = needle ? all.filter((x) => JSON.stringify(x).toLowerCase().includes(needle)) : all;
  const limit = Math.min(VIEW_MAX_LIMIT, Math.max(1, Math.floor(opts.limit ?? VIEW_DEFAULT_LIMIT)));
  const offset = Math.max(0, Math.floor(opts.offset ?? 0));
  const items = matching.slice(offset, offset + limit);
  return {
    section,
    offset,
    limit,
    total: all.length,
    matched: matching.length,
    items,
    next_offset: offset + items.length < matching.length ? offset + items.length : null,
  };
}
