import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { trpcAdapter } from "../src/adapters/trpc.js";
import type { FileCategory, FileInfo, RouteInfo } from "../src/types.js";

// Regression tests for route/dependency extraction misses found by the audit.

function repoOf(files: Record<string, string>, category: FileCategory = "code"): { repo: string; infos: FileInfo[] } {
  const repo = mkdtempSync(join(tmpdir(), "recon-audit-"));
  const infos: FileInfo[] = [];
  for (const [rel, content] of Object.entries(files)) {
    const dest = join(repo, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content, "utf8");
    infos.push({ path: rel, ext: extname(rel), size: 0, lines: content.split("\n").length, category, binary: false });
  }
  return { repo, infos };
}
const routesOf = (adapter: { detectRoutes(f: FileInfo[], r: string): RouteInfo[] }, files: Record<string, string>): RouteInfo[] => {
  const { repo, infos } = repoOf(files);
  return adapter.detectRoutes(infos, repo);
};
const sig = (routes: RouteInfo[]): string[] => routes.map((r) => `${r.method ?? "-"} ${r.route}`).sort();

describe("trpc: child routers imported under an alias", () => {
  it("import { userRouter as u } mounts the child under its key, not at the root", () => {
    const routes = routesOf(trpcAdapter, {
      "server/user.ts": "export const userRouter = createTRPCRouter({ list: publicProcedure.query(() => []) });\n",
      "server/root.ts": 'import { userRouter as u } from "./user";\nexport const appRouter = createTRPCRouter({ user: u });\n',
    });
    expect(sig(routes)).toEqual(["QUERY user.list"]);
  });
});

describe("trpc: CommonJS renamed destructuring", () => {
  it("const { userRouter: u } = require('./user') resolves to the exported router", () => {
    const routes = routesOf(trpcAdapter, {
      "server/user.js": "const userRouter = t.router({ list: publicProcedure.query(() => []) });\nmodule.exports = { userRouter };\n",
      "server/root.js": 'const { userRouter: u } = require("./user");\nconst appRouter = t.router({ user: u });\n',
    });
    expect(sig(routes)).toEqual(["QUERY user.list"]);
  });
});
