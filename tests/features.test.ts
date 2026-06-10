import { describe, it, expect } from "vitest";
import { buildFeatures } from "../src/features.js";
import type { FileCategory, FileInfo, RouteInfo } from "../src/types.js";

function file(path: string, category: FileCategory = "code"): FileInfo {
  return { path, ext: ".ts", size: 100, lines: 10, category, binary: false };
}
function route(r: string, f: string, kind: RouteInfo["kind"] = "page"): RouteInfo {
  return { route: r, file: f, kind };
}

// Build order should follow dependency tiers, not raw file count:
//   foundations (core/types/db/ui/i18n/rpc/auth/config) → feature pages → tests/docs last.
describe("build order by dependency tiers", () => {
  const files = [
    file("src/auth/config.ts"), // foundation: auth
    file("src/lib/db/client.ts"), // foundation: db
    file("src/lib/ui/theme.ts"), // foundation: ui
    file("src/app/dashboard/page.tsx"), // feature page: dashboard
    file("src/app/settings/page.tsx"), // feature page: settings
    file("tests/unit/auth.test.ts", "test"), // tests bucket → last
    file("README.md", "doc"), // documentation → last
    file("package.json", "config"), // project-setup foundation
  ];
  const routes = [
    route("/dashboard", "src/app/dashboard/page.tsx"),
    route("/settings", "src/app/settings/page.tsx"),
  ];
  const features = buildFeatures(files, routes, null);
  const names = features.map((f) => f.name);
  const idx = (n: string) => names.indexOf(n);

  it("places foundations before feature pages", () => {
    expect(idx("Auth")).toBeGreaterThanOrEqual(0);
    expect(idx("Dashboard")).toBeGreaterThanOrEqual(0);
    expect(idx("Auth")).toBeLessThan(idx("Dashboard"));
    expect(idx("DB")).toBeLessThan(idx("Dashboard"));
    expect(idx("UI")).toBeLessThan(idx("Dashboard"));
  });

  it("places project setup/config among the foundations, before feature pages", () => {
    expect(idx("Project Setup & Tooling")).toBeLessThan(idx("Dashboard"));
  });

  it("places tests and documentation last", () => {
    const tail = names.slice(-2);
    expect(tail).toContain("Documentation");
    expect(tail).toContain("Tests");
  });
});

// --granularity controls how aggressively trivial, route-less single-file groups
// are folded into Core. Default is "coarse".
describe("feature granularity", () => {
  const files = [
    file("src/app/dashboard/page.tsx"), // real feature page (has a route)
    file("src/onboarding/wizard.ts"), // trivial: 1 file, 0 routes, non-foundation
    file("src/auth/config.ts"), // foundation single file — never folded away
  ];
  const routes = [route("/dashboard", "src/app/dashboard/page.tsx")];

  it("coarse (default) folds a trivial single-file group into Core", () => {
    const features = buildFeatures(files, routes, null, "coarse");
    expect(features.find((f) => f.name === "Onboarding")).toBeUndefined();
    const core = features.find((f) => f.name === "Core");
    expect(core?.files).toContain("src/onboarding/wizard.ts");
  });

  it("coarse keeps foundation single-file groups (e.g. Auth) intact", () => {
    const features = buildFeatures(files, routes, null, "coarse");
    expect(features.find((f) => f.name === "Auth")).toBeDefined();
  });

  it("fine keeps trivial single-file groups as their own feature", () => {
    const features = buildFeatures(files, routes, null, "fine");
    expect(features.find((f) => f.name === "Onboarding")).toBeDefined();
  });
});

// Monorepo: features group under their workspace — app workspaces split into
// prefixed sub-features, library workspaces collapse into one feature each,
// and the topological order keeps shared packages before their consumers.
describe("workspace-aware feature grouping", () => {
  const ws = (name: string, path: string, extra: object = {}) => ({ name, path, ...extra });
  const workspaces = [
    ws("@acme/db", "packages/db"),
    ws("@acme/ui", "packages/ui"),
    ws("@acme/web", "apps/web", { dependsOn: ["@acme/db", "@acme/ui"] }),
  ];
  const files = [
    file("apps/web/app/dashboard/page.tsx"),
    file("apps/web/app/billing/page.tsx"),
    file("packages/ui/src/Button.tsx"),
    file("packages/db/src/schema.ts", "schema"),
    file("scripts/release.ts"),
  ];
  const routes = [
    { ...route("/dashboard", "apps/web/app/dashboard/page.tsx"), workspace: "@acme/web" },
    { ...route("/billing", "apps/web/app/billing/page.tsx"), workspace: "@acme/web" },
  ];
  const features = buildFeatures(files, routes, null, "coarse", workspaces);
  const slugs = features.map((f) => f.slug);
  const at = (re: RegExp) => slugs.findIndex((s) => re.test(s));

  it("prefixes app sub-features with the workspace short name", () => {
    expect(slugs.some((s) => /^\d{2}-web-dashboard$/.test(s))).toBe(true);
    expect(slugs.some((s) => /^\d{2}-web-billing$/.test(s))).toBe(true);
  });

  it("collapses each library workspace into one feature", () => {
    const db = features.find((f) => /-db$/.test(f.slug));
    const ui = features.find((f) => /-ui$/.test(f.slug));
    expect(db?.files).toEqual(["packages/db/src/schema.ts"]);
    expect(ui?.files).toEqual(["packages/ui/src/Button.tsx"]);
    expect(db?.name).toBe("DB (@acme/db)");
  });

  it("orders shared packages before the app that consumes them", () => {
    expect(at(/-db$/)).toBeLessThan(at(/-web-/));
    expect(at(/-ui$/)).toBeLessThan(at(/-web-/));
  });

  it("keeps files outside every workspace on the single-package path", () => {
    const all = features.flatMap((f) => f.files);
    expect(all).toContain("scripts/release.ts");
  });

  it("is byte-identical to the old behavior when no workspaces are passed", () => {
    const a = buildFeatures(files, routes, null, "coarse");
    const b = buildFeatures(files, routes, null, "coarse", []);
    expect(b).toEqual(a);
  });

  it("falls back to full-path slugs when two workspaces share a short name", () => {
    const colliding = [ws("@a/web", "apps/web"), ws("@b/web", "packages/web")];
    const colFiles = [file("apps/web/src/index.ts"), file("packages/web/src/index.ts")];
    const f = buildFeatures(colFiles, [], null, "coarse", colliding);
    const colSlugs = f.map((x) => x.slug).join(" ");
    expect(colSlugs).toContain("apps-web");
    expect(colSlugs).toContain("packages-web");
  });
});
