import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { detectStack, detectWorkspaces, detectNodeVersion } from "../src/detect/stack.js";
import type { FileInfo } from "../src/types.js";

function makeRepo(write: (w: (rel: string, content: string) => void) => void): string {
  const repo = mkdtempSync(join(tmpdir(), "recon-stack-"));
  const w = (rel: string, content: string) => {
    const abs = join(repo, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  };
  write(w);
  return repo;
}
function fi(path: string, ext = ".ts"): FileInfo {
  return { path, ext, size: 100, lines: 10, category: "code", binary: false };
}

const repos: string[] = [];
function repo(write: (w: (rel: string, content: string) => void) => void): string {
  const r = makeRepo(write);
  repos.push(r);
  return r;
}
afterAll(() => repos.forEach((r) => rmSync(r, { recursive: true, force: true })));

describe("detectStack — extended framework catalogue", () => {
  it("detects Vite, Expo, Electron, and Tauri from npm deps", () => {
    const r = repo((w) =>
      w(
        "package.json",
        JSON.stringify({
          dependencies: { expo: "^51", "@tauri-apps/api": "^2" },
          devDependencies: { vite: "^5", electron: "^31" },
        }),
      ),
    );
    const stack = detectStack(r, [fi("src/main.ts")]);
    for (const fw of ["Vite", "Expo", "Electron", "Tauri"]) {
      expect(stack.frameworks).toContain(fw);
    }
  });

  it("detects Laravel from composer.json", () => {
    const r = repo((w) =>
      w("composer.json", JSON.stringify({ require: { "laravel/framework": "^11" } })),
    );
    const stack = detectStack(r, [fi("app/Http/Controllers/X.php", ".php")]);
    expect(stack.frameworks).toContain("Laravel");
    expect(stack.packageManagers).toContain("composer");
  });

  it("detects Spring Boot from a Maven pom.xml", () => {
    const r = repo((w) =>
      w(
        "pom.xml",
        `<project><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies></project>`,
      ),
    );
    const stack = detectStack(r, [fi("src/Main.java", ".java")]);
    expect(stack.frameworks).toContain("Spring Boot");
    expect(stack.packageManagers).toContain("maven");
  });
});

describe("detectWorkspaces", () => {
  it("reads npm/yarn workspaces from package.json", () => {
    const r = repo((w) => {
      w("package.json", JSON.stringify({ workspaces: ["packages/*", "apps/web"] }));
      w("packages/ui/package.json", JSON.stringify({ name: "@acme/ui" }));
      w("apps/web/package.json", JSON.stringify({ name: "web" }));
    });
    const ws = detectWorkspaces(r);
    const names = ws.map((x) => x.name);
    expect(names).toContain("@acme/ui");
    expect(names).toContain("web");
  });

  it("reads pnpm-workspace.yaml", () => {
    const r = repo((w) => {
      w("pnpm-workspace.yaml", "packages:\n  - 'packages/*'\n");
      w("packages/core/package.json", JSON.stringify({ name: "core" }));
    });
    const ws = detectWorkspaces(r);
    expect(ws.map((x) => x.name)).toContain("core");
  });

  it("returns an empty list for a single-package repo", () => {
    const r = repo((w) => w("package.json", JSON.stringify({ name: "solo" })));
    expect(detectWorkspaces(r)).toEqual([]);
  });
});

describe("detectNodeVersion", () => {
  it("reads engines.node from package.json", () => {
    const r = repo((w) => w("package.json", JSON.stringify({ engines: { node: ">=20" } })));
    expect(detectNodeVersion(r)).toBe(">=20");
  });

  it("returns undefined when unspecified", () => {
    const r = repo((w) => w("package.json", JSON.stringify({ name: "x" })));
    expect(detectNodeVersion(r)).toBeUndefined();
  });
});
