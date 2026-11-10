import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { expressAdapter } from "../src/adapters/express.js";
import type { FileInfo, RouteInfo } from "../src/types.js";

// Regression tests for route-extraction gaps in the JS-family and ASP.NET adapters.

function repoOf(files: Record<string, string>): { repo: string; infos: FileInfo[] } {
  const repo = mkdtempSync(join(tmpdir(), "recon-js-gaps-"));
  const infos: FileInfo[] = [];
  for (const [rel, content] of Object.entries(files)) {
    const dest = join(repo, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content, "utf8");
    infos.push({ path: rel, ext: extname(rel), size: 0, lines: content.split("\n").length, category: "code", binary: false });
  }
  return { repo, infos };
}
const routesOf = (adapter: { detectRoutes(f: FileInfo[], r: string): RouteInfo[] }, files: Record<string, string>): RouteInfo[] => {
  const { repo, infos } = repoOf(files);
  return adapter.detectRoutes(infos, repo);
};
const sig = (routes: RouteInfo[]): string[] => routes.map((r) => `${r.method ?? "-"} ${r.route}`).sort();

describe("express: array mount paths and spaced verb calls", () => {
  it('app.use(["/a", "/b"], r) mounts the router under every listed path', () => {
    const routes = routesOf(expressAdapter, {
      "src/app.js": 'const express = require("express");\nconst app = express();\nconst r = express.Router();\nr.get("/x", h);\napp.use(["/a", "/b"], r);\n',
    });
    expect(sig(routes)).toEqual(["GET /a/x", "GET /b/x"]);
  });

  it("an array of non-literals is not read as mount paths", () => {
    const routes = routesOf(expressAdapter, {
      "src/app.js": 'const express = require("express");\nconst app = express();\nconst r = express.Router();\nr.get("/x", h);\napp.use([auth, log], r);\n',
    });
    expect(sig(routes)).toEqual(["GET /x"]);
  });

  it("detects a verb call with whitespace before its parenthesis", () => {
    const routes = routesOf(expressAdapter, {
      "src/app.js": 'const express = require("express");\nconst app = express();\napp.get ("/sp", h)\n  .post ("/sp2", h);\n',
    });
    expect(sig(routes)).toEqual(["GET /sp", "POST /sp2"]);
  });
});
