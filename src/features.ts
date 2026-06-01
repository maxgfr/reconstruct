import type { Feature, FileInfo, Granularity, I18nInfo, RouteInfo } from "./types.js";

const ROOTS = [
  "src/app/",
  "src/pages/",
  "src/components/",
  "src/lib/",
  "src/server/",
  "src/",
  "app/",
  "pages/",
  "lib/",
  "server/",
  "components/",
  "packages/",
];

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
    (seg.startsWith("(") && seg.endsWith(")")) ||
    (seg.startsWith("[") && seg.endsWith("]")) ||
    seg.startsWith("@") // Next.js parallel-route slots (@modal) are not features
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
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

// --- Build-order tiers -------------------------------------------------------
// Foundations (data, types, shared UI, cross-cutting) must exist before the
// feature pages that consume them; tests and docs come last. This drives the
// REBUILD.md build order by *dependency*, not by raw file count.

// Structural keys whose group is always a foundation (tier 0) and never folded
// into Core by the coarse granularity pass.
const FOUNDATION_KEYS = new Set([
  "core", "types", "type", "config", "env",
  "db", "database", "schema", "schemas", "model", "models", "entities", "prisma", "drizzle", "migrations",
  "style", "styles", "css", "theme",
  "ui", "components", "component",
  "lib", "libs", "util", "utils", "helpers", "hooks",
  "store", "stores", "state", "context", "providers",
  "server", "services", "service", "client",
  "api", "rpc", "trpc", "graphql", "gql",
  "auth", "middleware",
  "i18n", "locales",
]);

// Dedicated test directories become a tail-tier "Tests" feature.
const TEST_KEYS = new Set([
  "test", "tests", "__tests__", "spec", "specs", "e2e", "cypress", "playwright",
]);

// Build-earlier-first ordering within the foundation tier.
const FOUNDATION_ORDER = [
  "core", "types", "type",
  "config", "env",
  "db", "database", "schema", "schemas", "model", "models", "entities",
  "style", "styles", "css", "theme",
  "ui", "components", "component",
  "lib", "libs", "util", "utils", "helpers", "hooks",
  "store", "stores", "state", "context", "providers",
  "server", "services", "service", "client",
  "api", "rpc", "trpc", "graphql", "gql",
  "auth", "middleware",
  "i18n", "locales",
];

const SCHEMA_RANK = FOUNDATION_ORDER.indexOf("schema");

// Data-layer dir names that are foundations but aren't literal in FOUNDATION_ORDER;
// they slot with the schema/data tier rather than falling to the end.
const DATA_LAYER_KEYS = new Set(["prisma", "drizzle", "migrations"]);

function foundationRank(key: string, hasSchema: boolean): number {
  const i = FOUNDATION_ORDER.indexOf(key);
  if (i !== -1) return i;
  if (DATA_LAYER_KEYS.has(key) || hasSchema) return SCHEMA_RANK;
  return Number.POSITIVE_INFINITY;
}

interface Record_ {
  feature: Feature;
  key: string;
  tier: 0 | 1 | 2;
  rank: number;
  size: number;
}

export function buildFeatures(
  files: FileInfo[],
  routes: RouteInfo[],
  i18n: I18nInfo | null,
  granularity: Granularity = "coarse",
): Feature[] {
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
    } else if (
      f.category === "code" ||
      f.category === "test" ||
      f.category === "style" ||
      f.category === "schema"
    ) {
      const key = featureKey(f.path);
      const list = codeGroups.get(key) ?? [];
      list.push(f.path);
      codeGroups.set(key, list);
    }
  }

  const routesByKey = new Map<string, RouteInfo[]>();
  for (const r of routes) {
    const k = routeKey(r.route);
    const list = routesByKey.get(k) ?? [];
    list.push(r);
    routesByKey.set(k, list);
  }

  const groupHasSchema = (groupFiles: string[]): boolean =>
    groupFiles.some((p) => schemaPaths.has(p));
  const isFoundationGroup = (key: string, groupFiles: string[]): boolean =>
    FOUNDATION_KEYS.has(key) || groupHasSchema(groupFiles);

  // Coarse granularity: fold trivial, route-less, non-foundation single-file
  // groups into Core so a one-off util doesn't masquerade as a feature.
  if (granularity === "coarse") {
    const core = codeGroups.get("core") ?? [];
    let mergedAny = false;
    for (const [key, groupFiles] of [...codeGroups.entries()]) {
      if (key === "core") continue;
      const routeCount = routesByKey.get(key)?.length ?? 0;
      const trivial =
        groupFiles.length === 1 &&
        routeCount === 0 &&
        !isFoundationGroup(key, groupFiles) &&
        !TEST_KEYS.has(key);
      if (trivial) {
        core.push(...groupFiles);
        codeGroups.delete(key);
        mergedAny = true;
      }
    }
    if (mergedAny || codeGroups.has("core")) codeGroups.set("core", core);
  }

  const records: Record_[] = [];

  for (const [key, groupFiles] of codeGroups.entries()) {
    const featureRoutes = routesByKey.get(key) ?? [];
    const name = humanize(key);
    const routeList = featureRoutes.map((r) => r.route);
    const uniqueRoutes = [...new Set(routeList)];
    const desc =
      `Groups ${groupFiles.length} file(s)` +
      (uniqueRoutes.length ? `; routes: ${uniqueRoutes.slice(0, 6).join(", ")}` : "") +
      ".";
    const hasSchema = groupHasSchema(groupFiles);
    const tier: 0 | 1 | 2 = TEST_KEYS.has(key)
      ? 2
      : isFoundationGroup(key, groupFiles)
        ? 0
        : 1;
    records.push({
      feature: {
        slug: slugify(name),
        name,
        description: desc,
        kind: "feature",
        files: groupFiles.sort(),
        routes: featureRoutes,
      },
      key,
      tier,
      rank: tier === 0 ? foundationRank(key, hasSchema) : 0,
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

  // Sort by build tier, then foundation order / tail order, then size desc, then name.
  records.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.size !== b.size) return b.size - a.size;
    return a.feature.name.localeCompare(b.feature.name);
  });

  // Assign numbered slugs in final (build) order.
  return records.map((r, i) => ({
    ...r.feature,
    slug: `${String(i + 1).padStart(2, "0")}-${r.feature.slug}`,
  }));
}
