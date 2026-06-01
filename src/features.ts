import type { Feature, FileInfo, I18nInfo, RouteInfo } from "./types.js";

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
    (seg.startsWith("[") && seg.endsWith("]"))
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

export function buildFeatures(
  files: FileInfo[],
  routes: RouteInfo[],
  i18n: I18nInfo | null,
): Feature[] {
  const codeGroups = new Map<string, string[]>();
  const configFiles: string[] = [];
  const docFiles: string[] = [];

  for (const f of files) {
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

  const features: Feature[] = [];

  const sortedKeys = [...codeGroups.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );

  for (const [key, groupFiles] of sortedKeys) {
    const featureRoutes = routesByKey.get(key) ?? [];
    const name = humanize(key);
    const routeList = featureRoutes.map((r) => r.route);
    const uniqueRoutes = [...new Set(routeList)];
    const desc =
      `Groups ${groupFiles.length} file(s)` +
      (uniqueRoutes.length ? `; routes: ${uniqueRoutes.slice(0, 6).join(", ")}` : "") +
      ".";
    features.push({
      slug: slugify(name),
      name,
      description: desc,
      kind: "feature",
      files: groupFiles.sort(),
      routes: featureRoutes,
    });
  }

  if (i18n) {
    features.push({
      slug: "internationalization",
      name: "Internationalization",
      description: `${i18n.locales.length} locale(s) (${i18n.locales.join(", ")}), up to ${i18n.keyCount} keys per locale.`,
      kind: "internationalization",
      files: i18n.files,
      routes: [],
    });
  }

  if (configFiles.length) {
    features.push({
      slug: "project-setup",
      name: "Project Setup & Tooling",
      description: `${configFiles.length} configuration/tooling file(s): build, lint, env, CI.`,
      kind: "project-setup",
      files: configFiles.sort(),
      routes: [],
    });
  }

  if (docFiles.length) {
    features.push({
      slug: "documentation",
      name: "Documentation",
      description: `${docFiles.length} documentation file(s).`,
      kind: "documentation",
      files: docFiles.sort(),
      routes: [],
    });
  }

  // Assign numbered slugs in final order.
  return features.map((f, i) => ({
    ...f,
    slug: `${String(i + 1).padStart(2, "0")}-${f.slug}`,
  }));
}
