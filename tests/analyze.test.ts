import { describe, it, expect, beforeEach } from "vitest";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync, rmSync, readFileSync } from "node:fs";
import { analyze } from "../src/analyze.js";
import { render } from "../src/prd/render.js";
import { writeOutput } from "../src/output.js";
import type { Fidelity, Level, Mode, Options } from "../src/types.js";

const REPO = fileURLToPath(new URL("./fixtures/sample-app", import.meta.url));

function makeOpts(over: Partial<Options> = {}): Options {
  const mode: Mode = over.mode ?? "preserve";
  const level: Level = over.level ?? "light";
  const fidelity: Fidelity = over.fidelity ?? "mirror";
  return {
    repo: REPO,
    out: join(tmpdir(), "reconstruct-test", `${mode}-${level}-${fidelity}`),
    mode,
    level,
    fidelity,
    granularity: "coarse",
    include: [],
    exclude: [],
    json: false,
    maxEmbedBytes: 16000,
    merge: false,
    summary: false,
    standalone: false,
    scratch: false,
    plan: "",
    tdd: false,
    check: false,
    ...over,
  };
}

describe("analyze", () => {
  const inv = analyze(makeOpts());

  it("detects the Next.js/React stack", () => {
    expect(inv.stack.frameworks).toContain("Next.js");
    expect(inv.stack.frameworks).toContain("React");
    expect(inv.stack.primaryLanguage).toBe("TypeScript");
    expect(inv.stack.hasTypeScript).toBe(true);
  });

  it("detects app-router routes including the API route", () => {
    const routes = inv.routes.map((r) => r.route);
    expect(routes).toContain("/");
    expect(routes).toContain("/dashboard");
    expect(routes).toContain("/api/users");
    const api = inv.routes.find((r) => r.route === "/api/users");
    expect(api?.kind).toBe("api");
  });

  it("extracts translations with locales and a key count", () => {
    expect(inv.i18n).not.toBeNull();
    expect(inv.i18n?.locales).toEqual(["en", "fr"]);
    expect(inv.i18n?.keyCount).toBe(3);
  });

  it("extracts env var names from .env and source (names only)", () => {
    expect(inv.envVars).toContain("DATABASE_URL");
    expect(inv.envVars).toContain("NEXTAUTH_SECRET");
  });

  it("detects the prisma schema and npm dependencies", () => {
    expect(inv.schemas).toContain("prisma/schema.prisma");
    const npm = inv.dependencies.find((d) => d.manager === "npm");
    expect(npm?.runtime.next).toBeDefined();
  });

  it("builds features including Dashboard and Internationalization", () => {
    expect(inv.features.length).toBeGreaterThan(0);
    expect(inv.features.some((f) => f.name === "Dashboard")).toBe(true);
    expect(inv.features.some((f) => f.kind === "internationalization")).toBe(true);
    for (const f of inv.features) {
      expect(f.slug).toMatch(/^\d\d-/);
    }
  });
});

describe("render", () => {
  it("produces the core artifacts and one PRD per feature", () => {
    const opts = makeOpts();
    const inv = analyze(opts);
    const { artifacts } = render(inv, opts);
    const paths = artifacts.map((a) => a.relPath);
    expect(paths).toContain("REBUILD.md");
    expect(paths).toContain("00-overview/PRD.md");
    expect(paths).toContain("architecture/ARCHITECTURE.md");
    expect(paths).toContain("inventory.json");
    const prdCount = paths.filter((p) => p.startsWith("features/")).length;
    expect(prdCount).toBe(inv.features.length);
  });

  it("mirror fidelity copies real source files, describe does not", () => {
    const mirror = makeOpts({ fidelity: "mirror" });
    const mirrorRes = render(analyze(mirror), mirror);
    expect(mirrorRes.copies.some((c) => c.to.includes(`${"/source/"}`))).toBe(true);

    const describe = makeOpts({ fidelity: "describe" });
    const describeRes = render(analyze(describe), describe);
    expect(describeRes.copies.some((c) => c.to.includes("/source/"))).toBe(false);
    // data (translations/schema/config) is always mirrored regardless of fidelity:
    expect(describeRes.copies.some((c) => c.to.includes("/data/translations/"))).toBe(true);
  });

  it("redesign mode writes a proposed-architecture section", () => {
    const opts = makeOpts({ mode: "redesign", level: "complex", fidelity: "describe" });
    const { artifacts } = render(analyze(opts), opts);
    const arch = artifacts.find((a) => a.relPath === "architecture/ARCHITECTURE.md");
    expect(arch?.content).toContain("Proposed architecture (redesign)");
  });

  it("emits no bundle files by default", () => {
    const opts = makeOpts();
    const paths = render(analyze(opts), opts).artifacts.map((a) => a.relPath);
    expect(paths).not.toContain("RECONSTRUCTION.md");
    expect(paths).not.toContain("SUMMARY.md");
  });

  it("emits RECONSTRUCTION.md only when --merge is set", () => {
    const opts = makeOpts({ merge: true });
    const merged = render(analyze(opts), opts).artifacts.find((a) => a.relPath === "RECONSTRUCTION.md");
    expect(merged).toBeDefined();
    expect(merged?.content).toContain("# sample-app — Reconstruction");
  });

  it("emits SUMMARY.md only when --summary is set", () => {
    const opts = makeOpts({ summary: true });
    const summary = render(analyze(opts), opts).artifacts.find((a) => a.relPath === "SUMMARY.md");
    expect(summary).toBeDefined();
    expect(summary?.content).toContain("reconstruction summary");
  });
});

describe("interface & data-model skeletons", () => {
  const opts = makeOpts();
  const inv = analyze(opts);
  const artifacts = render(inv, opts).artifacts;
  const byPath = (p: string) => artifacts.find((a) => a.relPath === p);

  it("emits INTERFACES.md and DATA-MODEL.md skeletons for the agent to fill", () => {
    const paths = artifacts.map((a) => a.relPath);
    expect(paths).toContain("architecture/INTERFACES.md");
    expect(paths).toContain("architecture/DATA-MODEL.md");
  });

  it("seeds INTERFACES.md with an agent callout and the discovered interface files", () => {
    const c = byPath("architecture/INTERFACES.md")?.content ?? "";
    expect(c).toMatch(/🧠/);
    expect(c).toContain("app/api/users/route.ts");
  });

  it("seeds DATA-MODEL.md with an agent callout and the schema candidates", () => {
    const c = byPath("architecture/DATA-MODEL.md")?.content ?? "";
    expect(c).toMatch(/🧠/);
    expect(c).toContain("prisma/schema.prisma");
  });
});

describe("writeOutput (integration)", () => {
  const opts = makeOpts({ mode: "preserve", level: "light", fidelity: "mirror" });

  beforeEach(() => {
    rmSync(opts.out, { recursive: true, force: true });
  });

  it("writes the full tree and copies ground-truth data", () => {
    const inv = analyze(opts);
    writeOutput(render(inv, opts), opts);

    expect(existsSync(join(opts.out, "REBUILD.md"))).toBe(true);
    expect(existsSync(join(opts.out, "00-overview/PRD.md"))).toBe(true);
    expect(existsSync(join(opts.out, "inventory.json"))).toBe(true);
    expect(existsSync(join(opts.out, "data/translations/messages/en.json"))).toBe(true);
    expect(existsSync(join(opts.out, "data/schema/prisma/schema.prisma"))).toBe(true);

    const copiedFr = readFileSync(join(opts.out, "data/translations/messages/fr.json"), "utf8");
    expect(copiedFr).toContain("Bienvenue");

    const inventory = JSON.parse(readFileSync(join(opts.out, "inventory.json"), "utf8"));
    expect(inventory.repoName).toBe("sample-app");
  });
});
