import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyze } from "../src/analyze.js";
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
    standalone: false,
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

// Monorepo: workspaces are enumerated for per-workspace analysis.
describe("monorepo (npm/yarn workspaces)", () => {
  const inv = analyze(opts("monorepo"));

  it("enumerates all workspaces by package name", () => {
    const names = (inv.workspaces ?? []).map((w) => w.name);
    expect(names).toContain("@acme/web");
    expect(names).toContain("@acme/ui");
    expect(names).toContain("@acme/db");
  });
});
