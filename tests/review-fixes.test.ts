import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { walk } from "../src/walk.js";
import { detectCandidates } from "../src/detect/candidates.js";
import { detectWorkspaces } from "../src/detect/stack.js";
import { buildFeatures } from "../src/features.js";
import { interfacesDoc, dataModelDoc } from "../src/prd/templates.js";
import type { FileCategory, FileInfo, Inventory, Options, StackInfo } from "../src/types.js";

const repos: string[] = [];
function makeRepo(write: (w: (rel: string, content: string) => void) => void): string {
  const dir = mkdtempSync(join(tmpdir(), "recon-fix-"));
  repos.push(dir);
  const w = (rel: string, content: string) => {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  };
  write(w);
  return dir;
}
afterAll(() => repos.forEach((r) => rmSync(r, { recursive: true, force: true })));

function fi(path: string, category: FileCategory = "code", ext = ".ts", size = 100): FileInfo {
  return { path, ext, size, lines: 10, category, binary: false };
}
const STACK: StackInfo = {
  languages: ["TypeScript"], primaryLanguage: "TypeScript", frameworks: [],
  libraries: [], packageManagers: ["npm"], hasTypeScript: true,
};

describe("walk: glob negation & dir semantics (review #2/#3)", () => {
  it("ignores a negated exclude glob instead of inverting it", () => {
    const r = makeRepo((w) => {
      w("a.ts", "x");
      w("a.test.ts", "x");
    });
    const { files } = walk(r, { exclude: ["!*.test.ts"] });
    const paths = files.map((f) => f.path);
    // The '!' must NOT flip into a positive exclude of test files.
    expect(paths).toContain("a.test.ts");
    expect(paths).toContain("a.ts");
  });

  it("honors a dir-only (trailing slash) glob: a file of that name is kept", () => {
    const r = makeRepo((w) => {
      w("build", "i am a file named build");
      w("src/a.ts", "x");
    });
    const { files } = walk(r, { exclude: ["build/"] });
    expect(files.map((f) => f.path)).toContain("build");
  });

  it("prunes an excluded directory's contents", () => {
    const r = makeRepo((w) => {
      w("vendor/deep/lib.js", "x");
      w("src/a.ts", "x");
    });
    const { files } = walk(r, { exclude: ["vendor"] });
    expect(files.some((f) => f.path.startsWith("vendor/"))).toBe(false);
    expect(files.map((f) => f.path)).toContain("src/a.ts");
  });
});

describe("candidates: bounded content scan & regex safety (review #1/#4)", () => {
  it("does not content-scan oversized files (skips the route content match)", () => {
    const r = makeRepo((w) => w("huge.js", "app.get('/x', () => {})"));
    const files = [fi("huge.js", "code", ".js", 3_000_000)];
    const h = detectCandidates(r, files, STACK);
    expect(h.routeCandidates).not.toContain("huge.js");
  });

  it("still recognizes a Prisma-style model declaration with leading whitespace", () => {
    const r = makeRepo((w) => w("db/models.ts", "\n  model User {\n    id Int\n  }\n"));
    const files = [fi("db/models.ts", "code", ".ts", 60)];
    const h = detectCandidates(r, files, STACK);
    expect(h.schemaCandidates).toContain("db/models.ts");
  });
});

describe("features: data-layer build order & @slot skipping (review #5/#10)", () => {
  it("orders a code-only ORM group (drizzle) before Internationalization", () => {
    const files = [
      fi("drizzle/client.ts"),
      fi("messages/en.json", "i18n", ".json"),
    ];
    // i18n requires an i18n feature; emulate via the i18n arg
    const features = buildFeatures(files, [], { locales: ["en"], files: ["messages/en.json"], keyCount: 1 });
    const names = features.map((f) => f.name);
    expect(names.indexOf("Drizzle")).toBeGreaterThanOrEqual(0);
    expect(names.indexOf("Drizzle")).toBeLessThan(names.indexOf("Internationalization"));
  });

  it("does not create a feature from a parallel-route @slot segment", () => {
    const files = [fi("src/app/@sidebar/nav.tsx"), fi("src/app/dashboard/page.tsx")];
    const features = buildFeatures(files, [], null);
    expect(features.every((f) => !f.name.includes("@"))).toBe(true);
  });
});

describe("workspaces: pnpm parsing edge cases (review #6/#7/#11)", () => {
  it("only reads the packages: block, strips comments, and recurses /**", () => {
    const r = makeRepo((w) => {
      w(
        "pnpm-workspace.yaml",
        "packages:\n  - 'apps/*'   # the apps\n  - 'packages/**'\nonlyBuiltDependencies:\n  - 'tools/secret'\n",
      );
      w("apps/web/package.json", JSON.stringify({ name: "web" }));
      w("packages/group/ui/package.json", JSON.stringify({ name: "ui" })); // nested two levels
      w("tools/secret/package.json", JSON.stringify({ name: "secret" }));
    });
    const names = detectWorkspaces(r).map((x) => x.name);
    expect(names).toContain("web"); // apps/* with inline comment
    expect(names).toContain("ui"); // packages/** recursive
    expect(names).not.toContain("secret"); // not under packages:
  });
});

describe("templates: well-formed fill-in tables (review #13)", () => {
  function inv(): Inventory {
    return {
      generatedWith: "reconstruct@test", repoName: "x",
      stack: STACK, fileCount: 0, totalLines: 0, files: [], dependencies: [],
      routes: [], i18n: null, schemas: [], configs: [], docs: [], envVars: [], scripts: {},
      features: [], hints: { routeCandidates: [], apiCandidates: [], schemaCandidates: [], entryPoints: [] },
      unknowns: [], excludedCount: 0,
    };
  }
  const opts = { mode: "preserve", level: "light", fidelity: "describe", granularity: "coarse", include: [], exclude: [], json: false, maxEmbedBytes: 16000, repo: "/x", out: "/o", merge: false, summary: false, features: false, standalone: false, scratch: false, plan: "", tdd: false, check: false } as Options;

  it("separates the table delimiter row from the trailing note with a blank line", () => {
    expect(interfacesDoc(inv(), opts)).toMatch(/\| --- \|[^\n]*\n\n_/);
    expect(dataModelDoc(inv(), opts)).toMatch(/\| --- \|[^\n]*\n\n_/);
  });
});
