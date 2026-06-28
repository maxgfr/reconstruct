import { workspaceMatcher, topoOrderWorkspaces } from "./detect/workspaces.js";
import type { Feature, FileInfo, Granularity, I18nInfo, RouteInfo, Workspace } from "./types.js";

const ROOTS = ["src/app/", "src/pages/", "src/components/", "src/lib/", "src/server/", "src/", "app/", "pages/", "lib/", "server/", "components/", "packages/"];

function stripRoot(path: string): string[] {
  let p = path;
  for (const root of ROOTS) {
    if (p.startsWith(root)) {
      p = p.slice(root.length);
      break;
    }
  }
  return p.split("/");
}

// Route groups `(group)` and dynamic segments `[id]` / `[...slug]` are layout/URL
// machinery, not features. Skip leading ones so `app/[locale]/(dashboard)/admin/...`
// keys on `admin` instead of collapsing the whole i18n app under `[locale]`.
function isSkippableSegment(seg: string): boolean {
  return (
    (seg.startsWith("(") && seg.endsWith(")")) || (seg.startsWith("[") && seg.endsWith("]")) || seg.startsWith("@") // Next.js parallel-route slots (@modal) are not features
  );
}

function featureKey(path: string): string {
  const segs = stripRoot(path);
  let i = 0;
  while (i < segs.length - 1 && isSkippableSegment(segs[i] as string)) {
    i++;
  }
  if (segs.length - i <= 1) return "core";
  return segs[i] as string;
}

function routeKey(route: string): string {
  const segs = route.split("/").filter(Boolean);
  let i = 0;
  while (i < segs.length && isSkippableSegment(segs[i] as string)) {
    i++;
  }
  return (segs[i] as string) ?? "core";
}

// Technical tokens that should render with fixed casing rather than naive title-case
// (so a folder named `ui`/`api`/`trpc` becomes "UI"/"API"/"tRPC", not "Ui"/"Api"/"Trpc").
const NAME_OVERRIDES: Record<string, string> = {
  ui: "UI",
  api: "API",
  db: "DB",
  seo: "SEO",
  e2e: "E2E",
  trpc: "tRPC",
  i18n: "i18n",
  cms: "CMS",
  sdk: "SDK",
  cli: "CLI",
  url: "URL",
  ssr: "SSR",
  ssg: "SSG",
  graphql: "GraphQL",
};

export function humanize(key: string): string {
  if (key === "core") return "Core";
  const cleaned = key
    .replace(/^\[+\.{0,3}/, "")
    .replace(/\]+$/, "")
    .replace(/^\(+|\)+$/g, "");
  const override = NAME_OVERRIDES[cleaned.toLowerCase()];
  if (override) return override;
  return cleaned
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

// --- Build-order tiers -------------------------------------------------------
// Foundations (data, types, shared UI, cross-cutting) must exist before the
// feature pages that consume them; tests and docs come last. This drives the
// REBUILD.md build order by *dependency*, not by raw file count.

// Structural keys whose group is always a foundation (tier 0) and never folded
// into Core by the coarse granularity pass.
const FOUNDATION_KEYS = new Set([
  "core",
  "types",
  "type",
  "config",
  "env",
  "db",
  "database",
  "schema",
  "schemas",
  "model",
  "models",
  "entities",
  "prisma",
  "drizzle",
  "migrations",
  "style",
  "styles",
  "css",
  "theme",
  "ui",
  "components",
  "component",
  "lib",
  "libs",
  "util",
  "utils",
  "helpers",
  "hooks",
  "store",
  "stores",
  "state",
  "context",
  "providers",
  "server",
  "services",
  "service",
  "client",
  "api",
  "rpc",
  "trpc",
  "graphql",
  "gql",
  "auth",
  "middleware",
  "i18n",
  "locales",
]);

// Dedicated test directories become a tail-tier "Tests" feature.
const TEST_KEYS = new Set(["test", "tests", "__tests__", "spec", "specs", "e2e", "cypress", "playwright"]);

// Build-earlier-first ordering within the foundation tier.
const FOUNDATION_ORDER = [
  "core",
  "types",
  "type",
  "config",
  "env",
  "db",
  "database",
  "schema",
  "schemas",
  "model",
  "models",
  "entities",
  "style",
  "styles",
  "css",
  "theme",
  "ui",
  "components",
  "component",
  "lib",
  "libs",
  "util",
  "utils",
  "helpers",
  "hooks",
  "store",
  "stores",
  "state",
  "context",
  "providers",
  "server",
  "services",
  "service",
  "client",
  "api",
  "rpc",
  "trpc",
  "graphql",
  "gql",
  "auth",
  "middleware",
  "i18n",
  "locales",
];

const SCHEMA_RANK = FOUNDATION_ORDER.indexOf("schema");

// Intra-tier rank offset per workspace topological position — wide enough that
// every foundation rank fits inside one workspace's band.
const WS_RANK_SPAN = 100;

// Data-layer dir names that are foundations but aren't literal in FOUNDATION_ORDER;
// they slot with the schema/data tier rather than falling to the end.
const DATA_LAYER_KEYS = new Set(["prisma", "drizzle", "migrations"]);

function foundationRank(key: string, hasSchema: boolean): number {
  const i = FOUNDATION_ORDER.indexOf(key);
  if (i !== -1) return i;
  if (DATA_LAYER_KEYS.has(key) || hasSchema) return SCHEMA_RANK;
  return Number.POSITIVE_INFINITY;
}

/**
 * The minimal shape `orderFeatures` needs to sort and number a feature: its
 * build `tier`, an intra-tier `rank`, and a `size` tie-breaker. Both front-ends
 * — the code analyzer (`buildFeatures`) and the from-scratch bridge
 * (`planToInventory`) — produce these so the build order is identical.
 */
export interface OrderingRecord {
  feature: Feature;
  tier: 0 | 1 | 2;
  rank: number;
  size: number;
}

interface Record_ extends OrderingRecord {
  key: string;
}

/**
 * Sort records by build tier (foundations → features → tests/docs), then
 * intra-tier rank, then size desc, then name, and assign the final `NN-`
 * numbered slugs in build order. Shared by both front-ends.
 */
export function orderFeatures(records: OrderingRecord[]): Feature[] {
  records.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.size !== b.size) return b.size - a.size;
    return a.feature.name.localeCompare(b.feature.name);
  });
  return records.map((r, i) => ({
    ...r.feature,
    slug: `${String(i + 1).padStart(2, "0")}-${r.feature.slug}`,
  }));
}

// --- Workspace-aware grouping --------------------------------------------------
// In a monorepo, features group under their workspace: an app workspace (it has
// routes) splits into per-area sub-features keyed `<short>/<inner>`, a library
// workspace collapses into one feature keyed `ws:<short>`. Files outside every
// workspace keep the single-package behavior.

interface WsGroupContext {
  matcher: (path: string) => Workspace | undefined;
  /** ws.path → display short name (last path segment, full-path slug on collision). */
  shortOf: Map<string, string>;
  /** Workspace names that own at least one route (the "apps"). */
  appNames: Set<string>;
  /** ws.name → position in the deps-first topological order. */
  topoIndex: Map<string, number>;
  /** Workspace names some sibling depends on. */
  dependedOn: Set<string>;
  /** group key → its workspace and (for app sub-features) inner key. */
  groups: Map<string, { ws: Workspace; inner?: string }>;
}

function makeWsContext(workspaces: Workspace[], routes: RouteInfo[]): WsGroupContext {
  const lastSeg = (p: string) => p.split("/").pop() ?? p;
  const segCounts = new Map<string, number>();
  for (const ws of workspaces) {
    const seg = lastSeg(ws.path);
    segCounts.set(seg, (segCounts.get(seg) ?? 0) + 1);
  }
  const shortOf = new Map(
    workspaces.map((ws) => {
      const seg = lastSeg(ws.path);
      return [ws.path, (segCounts.get(seg) ?? 0) > 1 ? slugify(ws.path) : seg] as const;
    }),
  );
  const appNames = new Set(routes.map((r) => r.workspace).filter((n): n is string => Boolean(n)));
  const topoIndex = new Map(topoOrderWorkspaces(workspaces).map((name, i) => [name, i]));
  const dependedOn = new Set(workspaces.flatMap((ws) => ws.dependsOn ?? []));
  return {
    matcher: workspaceMatcher(workspaces),
    shortOf,
    appNames,
    topoIndex,
    dependedOn,
    groups: new Map(),
  };
}

/** The group key for a workspace file; registers the group's metadata. */
function wsKeyFor(ctx: WsGroupContext, ws: Workspace, innerPath: string): string {
  const short = ctx.shortOf.get(ws.path) as string;
  const key = ctx.appNames.has(ws.name) ? `${short}/${featureKey(innerPath)}` : `ws:${short}`;
  if (!ctx.groups.has(key)) {
    ctx.groups.set(key, {
      ws,
      ...(ctx.appNames.has(ws.name) ? { inner: featureKey(innerPath) } : {}),
    });
  }
  return key;
}

export function buildFeatures(
  files: FileInfo[],
  routes: RouteInfo[],
  i18n: I18nInfo | null,
  granularity: Granularity = "coarse",
  workspaces: Workspace[] = [],
): Feature[] {
  const ctx = workspaces.length ? makeWsContext(workspaces, routes) : null;
  const keyForFile = (path: string): string => {
    const ws = ctx?.matcher(path);
    return ws ? wsKeyFor(ctx as WsGroupContext, ws, path.slice(ws.path.length + 1)) : featureKey(path);
  };
  // The structural key tier/foundation logic applies to: the inner key for app
  // sub-features, the plain key otherwise (lib workspaces are handled apart).
  const innerOf = (key: string): string => ctx?.groups.get(key)?.inner ?? key;
  const isLibGroup = (key: string): boolean => Boolean(ctx?.groups.get(key)) && !ctx?.groups.get(key)?.inner;

  const codeGroups = new Map<string, string[]>();
  const schemaPaths = new Set<string>();
  const configFiles: string[] = [];
  const docFiles: string[] = [];

  for (const f of files) {
    if (f.category === "schema") schemaPaths.add(f.path);
    if (f.category === "config") {
      configFiles.push(f.path);
    } else if (f.category === "doc") {
      docFiles.push(f.path);
    } else if (f.category === "code" || f.category === "test" || f.category === "style" || f.category === "schema") {
      const key = keyForFile(f.path);
      const list = codeGroups.get(key) ?? [];
      list.push(f.path);
      codeGroups.set(key, list);
    }
  }

  const routesByKey = new Map<string, RouteInfo[]>();
  for (const r of routes) {
    // A workspace owning a route is by definition an "app" workspace.
    const ws = ctx && r.workspace ? workspaces.find((w) => w.name === r.workspace) : undefined;
    const k = ws && ctx ? `${ctx.shortOf.get(ws.path)}/${routeKey(r.route)}` : routeKey(r.route);
    if (ws && ctx && !ctx.groups.has(k)) ctx.groups.set(k, { ws, inner: routeKey(r.route) });
    const list = routesByKey.get(k) ?? [];
    list.push(r);
    routesByKey.set(k, list);
  }

  const groupHasSchema = (groupFiles: string[]): boolean => groupFiles.some((p) => schemaPaths.has(p));
  const isFoundationGroup = (key: string, groupFiles: string[]): boolean => FOUNDATION_KEYS.has(innerOf(key)) || groupHasSchema(groupFiles);

  // Coarse granularity: fold trivial, route-less, non-foundation single-file
  // groups into Core so a one-off util doesn't masquerade as a feature. In a
  // monorepo an app's trivial group folds into that app's own core, and a
  // library workspace never folds — workspace visibility is the point.
  if (granularity === "coarse") {
    const foldTarget = (key: string): string => {
      const group = ctx?.groups.get(key);
      if (!group?.inner) return "core";
      const short = ctx?.shortOf.get(group.ws.path) as string;
      return `${short}/core`;
    };
    for (const [key, groupFiles] of [...codeGroups.entries()]) {
      if (key === "core" || innerOf(key) === "core" || isLibGroup(key)) continue;
      const routeCount = routesByKey.get(key)?.length ?? 0;
      const trivial = groupFiles.length === 1 && routeCount === 0 && !isFoundationGroup(key, groupFiles) && !TEST_KEYS.has(innerOf(key));
      if (trivial) {
        const target = foldTarget(key);
        if (target !== "core" && ctx && !ctx.groups.has(target)) {
          const group = ctx.groups.get(key);
          if (group) ctx.groups.set(target, { ws: group.ws, inner: "core" });
        }
        codeGroups.set(target, [...(codeGroups.get(target) ?? []), ...groupFiles]);
        codeGroups.delete(key);
      }
    }
  }

  const records: Record_[] = [];

  for (const [key, groupFiles] of codeGroups.entries()) {
    const featureRoutes = routesByKey.get(key) ?? [];
    const wsGroup = ctx?.groups.get(key);
    const short = wsGroup ? (ctx?.shortOf.get(wsGroup.ws.path) as string) : "";
    const name = wsGroup
      ? wsGroup.inner
        ? `${humanize(short)} · ${humanize(wsGroup.inner)}`
        : humanize(short) + (wsGroup.ws.name !== short ? ` (${wsGroup.ws.name})` : "")
      : humanize(key);
    const slug = wsGroup ? (wsGroup.inner ? slugify(`${short}-${humanize(wsGroup.inner)}`) : slugify(short)) : slugify(name);
    const routeList = featureRoutes.map((r) => r.route);
    const uniqueRoutes = [...new Set(routeList)];
    const desc =
      `Groups ${groupFiles.length} file(s)` +
      (wsGroup ? ` in workspace \`${wsGroup.ws.path}\`` : "") +
      (uniqueRoutes.length ? `; routes: ${uniqueRoutes.slice(0, 6).join(", ")}` : "") +
      ".";
    const hasSchema = groupHasSchema(groupFiles);
    // Workspace groups are rank-offset by their topological position so a
    // workspace's features never build before the workspaces it depends on.
    const topoBase = wsGroup ? (ctx?.topoIndex.get(wsGroup.ws.name) ?? 0) * WS_RANK_SPAN : 0;
    let tier: 0 | 1 | 2;
    let rank: number;
    if (wsGroup && !wsGroup.inner) {
      // A library workspace: a foundation when a sibling depends on it.
      const isDep = ctx?.dependedOn.has(wsGroup.ws.name) ?? false;
      tier = isDep ? 0 : 1;
      rank = topoBase;
    } else {
      const structuralKey = innerOf(key);
      tier = TEST_KEYS.has(structuralKey) ? 2 : isFoundationGroup(key, groupFiles) ? 0 : 1;
      rank = topoBase + (tier === 0 ? foundationRank(structuralKey, hasSchema) : 0);
    }
    records.push({
      feature: {
        slug,
        name,
        description: desc,
        kind: "feature",
        files: groupFiles.sort(),
        routes: featureRoutes,
      },
      key,
      tier,
      rank,
      size: groupFiles.length,
    });
  }

  if (i18n) {
    records.push({
      feature: {
        slug: "internationalization",
        name: "Internationalization",
        description: `${i18n.locales.length} locale(s) (${i18n.locales.join(", ")}), up to ${i18n.keyCount} keys per locale.`,
        kind: "internationalization",
        files: i18n.files,
        routes: [],
      },
      key: "i18n",
      tier: 0,
      rank: foundationRank("i18n", false),
      size: i18n.files.length,
    });
  }

  if (configFiles.length) {
    records.push({
      feature: {
        slug: "project-setup",
        name: "Project Setup & Tooling",
        description: `${configFiles.length} configuration/tooling file(s): build, lint, env, CI.`,
        kind: "project-setup",
        files: configFiles.sort(),
        routes: [],
      },
      key: "config",
      tier: 0,
      rank: foundationRank("config", false),
      size: configFiles.length,
    });
  }

  if (docFiles.length) {
    records.push({
      feature: {
        slug: "documentation",
        name: "Documentation",
        description: `${docFiles.length} documentation file(s).`,
        kind: "documentation",
        files: docFiles.sort(),
        routes: [],
      },
      key: "documentation",
      tier: 2,
      rank: 1, // docs sort after dedicated test buckets in the tail tier
      size: docFiles.length,
    });
  }

  // Sort + number by build tier, intra-tier rank, size, name (shared logic).
  return orderFeatures(records);
}
