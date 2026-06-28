import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { analyze } from "../src/analyze.js";
import { detectWorkspaces, buildWorkspaceGraph, topoOrderWorkspaces, findWorkspaceCycle } from "../src/detect/workspaces.js";
import type { Options } from "../src/types.js";

const SAMPLE = fileURLToPath(new URL("./fixtures/sample-app", import.meta.url));

const repos: string[] = [];
function repo(write: (w: (rel: string, content: string) => void) => void): string {
  const r = mkdtempSync(join(tmpdir(), "recon-warn-"));
  repos.push(r);
  write((rel, content) => {
    const abs = join(r, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  });
  return r;
}
afterAll(() => repos.forEach((r) => rmSync(r, { recursive: true, force: true })));

function makeOpts(repoPath: string): Options {
  return {
    repo: repoPath,
    out: join(repoPath, "reconstruction"),
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

describe("analysis warnings — malformed manifests", () => {
  it("warns on a malformed package.json and still degrades gracefully", () => {
    const r = repo((w) => {
      w("package.json", '{ "name": "broken", "dependencies": { "express":'); // truncated
      w("index.js", 'const app = require("express")();\n');
    });
    const inv = analyze(makeOpts(r));
    expect(inv.warnings).toBeDefined();
    expect(inv.warnings?.some((x) => x.includes("malformed package.json"))).toBe(true);
    // Graceful degradation: the file is still inventoried, just without manifest signal.
    expect(inv.files.some((f) => f.path === "index.js")).toBe(true);
    expect(inv.stack.frameworks).toEqual([]);
    expect(inv.dependencies).toEqual([]);
  });

  it("warns once even though the broken manifest is read by several stages", () => {
    const r = repo((w) => {
      w("package.json", "{ not json at all");
      w("index.js", "console.log(1);\n");
    });
    const inv = analyze(makeOpts(r));
    const hits = inv.warnings?.filter((x) => x.includes("malformed package.json")) ?? [];
    expect(hits).toHaveLength(1);
  });

  it("attributes a malformed workspace manifest to its workspace path", () => {
    const r = repo((w) => {
      w("package.json", JSON.stringify({ name: "root", workspaces: ["packages/*"] }));
      w("packages/ui/package.json", "{ broken");
      w("packages/ui/index.ts", "export {};\n");
    });
    const inv = analyze(makeOpts(r));
    expect(inv.warnings?.some((x) => x.includes("malformed packages/ui/package.json"))).toBe(true);
    // The dir was declared a member: it stays a workspace under its path name.
    expect(inv.workspaces?.map((ws) => ws.name)).toContain("packages/ui");
  });

  it("emits no warnings key on a clean repo", () => {
    const inv = analyze({ ...makeOpts(SAMPLE), out: join(tmpdir(), "recon-warn-clean") });
    expect(inv.warnings).toBeUndefined();
  });
});

describe("analysis warnings — workspace dependency cycles", () => {
  const cyclicRepo = () =>
    repo((w) => {
      w("package.json", JSON.stringify({ name: "root", workspaces: ["packages/*"] }));
      w("packages/a/package.json", JSON.stringify({ name: "a", dependencies: { b: "workspace:*" } }));
      w("packages/b/package.json", JSON.stringify({ name: "b", devDependencies: { a: "workspace:*" } }));
      w("packages/a/index.js", "module.exports = {};\n");
      w("packages/b/index.js", "module.exports = {};\n");
    });

  it("findWorkspaceCycle returns the closed cycle path deterministically", () => {
    const r = cyclicRepo();
    const ws = detectWorkspaces(r);
    buildWorkspaceGraph(r, ws);
    expect(findWorkspaceCycle(ws)).toEqual(["a", "b", "a"]);
  });

  it("findWorkspaceCycle returns null on an acyclic graph", () => {
    const ws = [
      { name: "web", path: "web", dependsOn: ["ui"] },
      { name: "ui", path: "ui" },
    ];
    expect(findWorkspaceCycle(ws)).toBeNull();
  });

  it("analyze surfaces the cycle as a warning without changing the topo order", () => {
    const r = cyclicRepo();
    const inv = analyze(makeOpts(r));
    expect(inv.warnings?.some((x) => x.includes("workspace dependency cycle: a → b → a"))).toBe(true);
    // The order itself still resolves deterministically (path-order fallback).
    expect(topoOrderWorkspaces(inv.workspaces ?? [])).toEqual(["a", "b"]);
  });
});
