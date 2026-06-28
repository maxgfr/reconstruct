import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyze } from "../src/analyze.js";
import { architectureDoc, diagramDoc, rebuildDoc } from "../src/prd/templates.js";
import { summarize } from "../src/prd/bundle.js";
import type { Options } from "../src/types.js";

function opts(fixture: string): Options {
  return {
    repo: fileURLToPath(new URL(`./fixtures/${fixture}`, import.meta.url)),
    out: join(tmpdir(), "reconstruct-multistack", fixture),
    mode: "preserve",
    level: "light",
    fidelity: "mirror",
    granularity: "coarse",
    include: [],
    exclude: [],
    json: false,
    maxEmbedBytes: 16000,
    merge: false,
    summary: false,
    features: false,
    specs: false,
    standalone: false,
    scratch: false,
    plan: "",
    tdd: false,
    check: false,
  };
}

// End-to-end lock for the Next.js [locale] i18n shape that originally collapsed a
// whole app into one "Locale" feature.
describe("i18n-app (Next.js [locale] App Router)", () => {
  const inv = analyze(opts("i18n-app"));
  const names = inv.features.map((f) => f.name);

  it("detects the Next.js stack and en/fr locales", () => {
    expect(inv.stack.frameworks).toContain("Next.js");
    expect(inv.i18n?.locales).toEqual(["en", "fr"]);
  });

  it("does not collapse the app under [locale] and keeps section features", () => {
    expect(names).not.toContain("Locale");
    expect(names.some((n) => n.includes("["))).toBe(false);
    expect(names).toContain("Admin");
    expect(names).toContain("Doctor");
    expect(names).toContain("About");
  });

  it("surfaces the Drizzle schema as a schema candidate and reads engines.node", () => {
    expect(inv.hints.schemaCandidates).toContain("drizzle/schema.ts");
    expect(inv.runtime?.node).toBe(">=20");
  });
});

// tRPC: the procedures are invisible behind a single catch-all route — the engine
// must surface the routers as API candidates and flag the surface in `unknowns`.
describe("trpc-app (tRPC routers behind a catch-all)", () => {
  const inv = analyze(opts("trpc-app"));

  it("detects tRPC as a library", () => {
    expect(inv.stack.libraries).toContain("tRPC");
  });

  it("flags the tRPC router files as API candidates", () => {
    expect(inv.hints.apiCandidates).toContain("src/server/api/routers/user.ts");
    expect(inv.hints.apiCandidates).toContain("src/server/api/routers/post.ts");
  });

  it("tells the agent to enumerate the API surface in unknowns", () => {
    expect(inv.unknowns.some((u) => /API surface|INTERFACES\.md/.test(u))).toBe(true);
  });
});

// Non-JS stack: proves the candidate/stack generalization works beyond Next.js.
describe("flask-api (Python / Flask / SQLAlchemy)", () => {
  const inv = analyze(opts("flask-api"));

  it("detects Flask, Python, and pip dependencies", () => {
    expect(inv.stack.frameworks).toContain("Flask");
    expect(inv.stack.primaryLanguage).toBe("Python");
    expect(inv.dependencies.some((d) => d.manager === "pip")).toBe(true);
  });

  it("surfaces route, schema, and entry-point candidates", () => {
    expect(inv.hints.routeCandidates).toContain("app.py");
    expect(inv.hints.routeCandidates).toContain("routes/users.py");
    expect(inv.hints.schemaCandidates).toContain("models.py");
    expect(inv.hints.entryPoints).toContain("app.py");
  });

  it("extracts env var names from Python source", () => {
    expect(inv.envVars).toContain("DATABASE_URL");
    expect(inv.envVars).toContain("SECRET_KEY");
  });
});

// Monorepo: workspaces are enumerated AND the analysis is attributed per workspace.
describe("monorepo (npm/yarn workspaces)", () => {
  const inv = analyze(opts("monorepo"));
  const ws = (name: string) => (inv.workspaces ?? []).find((w) => w.name === name);

  it("enumerates all workspaces by package name", () => {
    const names = (inv.workspaces ?? []).map((w) => w.name);
    expect(names).toContain("@acme/web");
    expect(names).toContain("@acme/ui");
    expect(names).toContain("@acme/db");
  });

  it("builds the workspace dependency graph from manifests", () => {
    expect(ws("@acme/web")?.dependsOn).toEqual(["@acme/db", "@acme/ui"]);
    expect(ws("@acme/ui")?.dependsOn).toBeUndefined();
  });

  it("detects each workspace's own stack", () => {
    expect(ws("@acme/web")?.stack?.frameworks).toContain("Next.js");
    expect(ws("@acme/db")?.stack?.frameworks).not.toContain("Next.js");
    expect(ws("@acme/db")?.stack?.libraries).toContain("Drizzle ORM");
  });

  it("merges workspace frameworks into the global stack so adapters activate", () => {
    expect(inv.stack.frameworks).toContain("Next.js");
    expect(inv.routes.length).toBeGreaterThan(0);
  });

  it("attributes routes to their workspace", () => {
    expect(inv.routes.every((r) => r.workspace === "@acme/web")).toBe(true);
    expect(ws("@acme/web")?.routeCount).toBe(inv.routes.length);
    expect(ws("@acme/ui")?.routeCount).toBeUndefined();
  });

  it("attributes per-workspace dependencies with repo-relative manifests", () => {
    expect(ws("@acme/web")?.dependencies?.[0]?.manifest).toBe("apps/web/package.json");
    expect(Object.keys(ws("@acme/web")?.dependencies?.[0]?.runtime ?? {})).toContain("next");
  });

  it("surfaces a monorepo unknown for the agent", () => {
    expect(inv.unknowns.some((u) => u.startsWith("Monorepo:"))).toBe(true);
  });

  it("groups features by workspace with shared packages first", () => {
    const slugs = inv.features.map((f) => f.slug);
    const at = (re: RegExp) => slugs.findIndex((s) => re.test(s));
    expect(at(/-db$/)).toBeGreaterThanOrEqual(0);
    expect(at(/-web-/)).toBeGreaterThanOrEqual(0);
    expect(at(/-db$/)).toBeLessThan(at(/-web-/));
    expect(at(/-ui$/)).toBeLessThan(at(/-web-/));
  });
});

// Workspace-aware rendering: ARCHITECTURE table, diagram graph, REBUILD blurb, summary.
describe("monorepo rendering", () => {
  const monoOpts = opts("monorepo");
  const inv = analyze(monoOpts);
  const soloInv = analyze(opts("sample-app"));

  it("renders the workspace table into ARCHITECTURE.md", () => {
    const doc = architectureDoc(inv, monoOpts);
    expect(doc).toContain("## Workspaces");
    expect(doc).toContain("| Workspace | Path | Kind | Stack | Depends on | Routes |");
    expect(doc).toMatch(/\| `@acme\/web` \| `apps\/web\/` \| npm \| .*Next\.js.* \| `@acme\/db`, `@acme\/ui` \| \d+ \|/);
  });

  it("renders the workspace graph into diagram.md", () => {
    const doc = diagramDoc(inv);
    expect(doc).toContain("## Workspace graph");
    expect(doc).toMatch(/W\d+\["@acme\/web"\]/);
    expect(doc).toMatch(/W\d+ --> W\d+/);
  });

  it("mentions the workspace topological order in REBUILD.md", () => {
    expect(rebuildDoc(inv, monoOpts)).toContain("workspace topological order");
  });

  it("lists workspaces and their edges in the summary", () => {
    const doc = summarize(inv, monoOpts);
    expect(doc).toContain("**Monorepo:** 3 workspace(s)");
    expect(doc).toContain("`@acme/web` → `@acme/db`, `@acme/ui`");
  });

  it("renders none of the workspace sections for a single-package repo", () => {
    expect(architectureDoc(soloInv, opts("sample-app"))).not.toContain("## Workspaces");
    expect(diagramDoc(soloInv)).not.toContain("## Workspace graph");
    expect(rebuildDoc(soloInv, opts("sample-app"))).not.toContain("workspace topological order");
  });
});

// Cargo workspace monorepo: members expanded, exclude honored, path deps → edges.
describe("cargo-workspace (Rust monorepo)", () => {
  const inv = analyze(opts("cargo-workspace"));
  const ws = (name: string) => (inv.workspaces ?? []).find((w) => w.name === name);

  it("enumerates members with kind cargo and honors exclude", () => {
    expect((inv.workspaces ?? []).map((w) => `${w.kind}:${w.name}`)).toEqual(["cargo:acme-cli", "cargo:acme-core"]);
  });

  it("derives the edge from the path dependency", () => {
    expect(ws("acme-cli")?.dependsOn).toEqual(["acme-core"]);
  });

  it("detects each crate's stack as Rust/cargo", () => {
    expect(ws("acme-cli")?.stack?.primaryLanguage).toBe("Rust");
    expect(ws("acme-cli")?.stack?.packageManagers).toContain("cargo");
  });

  it("builds the shared crate before its consumer", () => {
    const slugs = inv.features.map((f) => f.slug);
    const at = (re: RegExp) => slugs.findIndex((s) => re.test(s));
    expect(at(/-core$/)).toBeGreaterThanOrEqual(0);
    expect(at(/-core$/)).toBeLessThan(at(/-cli$/));
  });
});

// go.work monorepo: use directives, module names, replace → edges.
describe("go-work (Go monorepo)", () => {
  const inv = analyze(opts("go-work"));
  const ws = (name: string) => (inv.workspaces ?? []).find((w) => w.name === name);

  it("enumerates modules with kind go, named from go.mod", () => {
    expect((inv.workspaces ?? []).map((w) => `${w.kind}:${w.name}`)).toEqual(["go:example.com/shared", "go:example.com/api"]);
  });

  it("derives the edge from require/replace", () => {
    expect(ws("example.com/api")?.dependsOn).toEqual(["example.com/shared"]);
  });

  it("detects each module's stack as Go", () => {
    expect(ws("example.com/api")?.stack?.primaryLanguage).toBe("Go");
    expect(ws("example.com/api")?.stack?.packageManagers).toContain("go modules");
  });
});
