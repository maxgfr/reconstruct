import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildFeatures, humanize } from "../src/features.js";
import { detectLibraries } from "../src/detect/stack.js";
import { analyze } from "../src/analyze.js";
import { render } from "../src/prd/render.js";
import type { FileCategory, FileInfo, Options, RouteInfo } from "../src/types.js";

const REPO = fileURLToPath(new URL("./fixtures/sample-app", import.meta.url));

function opts(): Options {
  return {
    repo: REPO,
    out: join(tmpdir(), "reconstruct-improve"),
    mode: "preserve",
    level: "light",
    fidelity: "mirror",
    granularity: "coarse",
    include: [],
    exclude: [],
    json: false,
    maxEmbedBytes: 16000,
  };
}

function file(path: string, category: FileCategory = "code"): FileInfo {
  return { path, ext: ".tsx", size: 100, lines: 10, category, binary: false };
}
function route(r: string, f: string, kind: RouteInfo["kind"] = "page"): RouteInfo {
  return { route: r, file: f, kind };
}

// Reproduces the real-world Next.js i18n shape (everything under src/app/[locale]/...)
// that collapsed an entire app into a single "Locale" feature.
describe("feature grouping for [locale]-rooted app router", () => {
  const files = [
    file("src/app/[locale]/(dashboard)/admin/page.tsx"),
    file("src/app/[locale]/(dashboard)/doctor/calendar/page.tsx"),
    file("src/app/[locale]/(dashboard)/doctor/messages/page.tsx"),
    file("src/app/[locale]/a-propos/page.tsx"),
    file("src/app/[locale]/page.tsx"),
  ];
  const routes = [
    route("/[locale]/admin", "src/app/[locale]/(dashboard)/admin/page.tsx"),
    route("/[locale]/doctor/calendar", "src/app/[locale]/(dashboard)/doctor/calendar/page.tsx"),
    route("/[locale]/doctor/messages", "src/app/[locale]/(dashboard)/doctor/messages/page.tsx"),
    route("/[locale]/a-propos", "src/app/[locale]/a-propos/page.tsx"),
    route("/[locale]", "src/app/[locale]/page.tsx"),
  ];
  const features = buildFeatures(files, routes, null);
  const names = features.map((f) => f.name);

  it("does not collapse everything into one 'Locale' feature", () => {
    expect(names).not.toContain("Locale");
  });

  it("splits into route-segment features (admin, doctor, a-propos)", () => {
    expect(names).toContain("Admin");
    expect(names).toContain("Doctor");
    expect(names).toContain("A Propos");
  });

  it("groups a section's sub-pages into one feature with aligned files and routes", () => {
    const doctor = features.find((f) => f.name === "Doctor");
    expect(doctor?.files).toHaveLength(2);
    expect(doctor?.routes).toHaveLength(2);
  });

  it("keeps the bare locale root page in 'Core', not its own feature", () => {
    const core = features.find((f) => f.name === "Core");
    expect(core?.files).toContain("src/app/[locale]/page.tsx");
  });
});

describe("humanize technical acronyms", () => {
  it("uppercases common acronyms", () => {
    expect(humanize("ui")).toBe("UI");
    expect(humanize("api")).toBe("API");
    expect(humanize("db")).toBe("DB");
    expect(humanize("seo")).toBe("SEO");
    expect(humanize("e2e")).toBe("E2E");
  });

  it("uses idiomatic framework casing", () => {
    expect(humanize("trpc")).toBe("tRPC");
    expect(humanize("i18n")).toBe("i18n");
  });

  it("still title-cases ordinary segments (regression guard)", () => {
    expect(humanize("a-propos")).toBe("A Propos");
    expect(humanize("contactRequests")).toBe("Contact Requests");
    expect(humanize("core")).toBe("Core");
  });
});

describe("detectLibraries", () => {
  it("detects ORM, auth, API-layer, styling, testing, and validation libraries", () => {
    const libs = detectLibraries({
      "drizzle-orm": "^0.41.0",
      "next-auth": "5.0.0-beta.25",
      "@trpc/server": "^11.0.0",
      "@tanstack/react-query": "^5.0.0",
      tailwindcss: "^4.0.0",
      "@playwright/test": "^1.58.0",
      zod: "^3.25.0",
    });
    for (const lib of [
      "Drizzle ORM",
      "NextAuth.js",
      "tRPC",
      "TanStack Query",
      "Tailwind CSS",
      "Playwright",
      "Zod",
    ]) {
      expect(libs).toContain(lib);
    }
  });

  it("dedupes when multiple packages map to the same library", () => {
    const libs = detectLibraries({
      "@trpc/server": "^11",
      "@trpc/client": "^11",
      "@trpc/react-query": "^11",
    });
    expect(libs.filter((l) => l === "tRPC")).toHaveLength(1);
  });

  it("returns nothing for unrecognized dependencies", () => {
    expect(detectLibraries({ "left-pad": "^1.0.0" })).toEqual([]);
  });
});

describe("libraries surface in the inventory and overview PRD", () => {
  it("includes detected libraries on the inventory stack", () => {
    const inv = analyze(opts());
    expect(inv.stack.libraries).toContain("Zod");
    expect(inv.stack.libraries).toContain("Tailwind CSS");
  });

  it("renders a Libraries line in the overview PRD", () => {
    const o = opts();
    const inv = analyze(o);
    const overview = render(inv, o).artifacts.find((a) => a.relPath === "00-overview/PRD.md");
    expect(overview?.content).toMatch(/\*\*Libraries:\*\*.*Zod/);
  });
});
