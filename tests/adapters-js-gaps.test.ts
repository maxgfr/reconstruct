import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { expressAdapter } from "../src/adapters/express.js";
import { fastifyAdapter } from "../src/adapters/fastify.js";
import { trpcAdapter } from "../src/adapters/trpc.js";
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

describe("fastify: named-export plugins, nested register options, multi-line chains", () => {
  const server = (register: string) => `import Fastify from "fastify";\nimport { userRoutes } from "./users";\nconst app = Fastify();\n${register}\n`;

  it("a plugin exported by name and imported by name is mounted under its register prefix", () => {
    const routes = routesOf(fastifyAdapter, {
      "src/server.ts": server('app.register(userRoutes, { prefix: "/users" });'),
      "src/users.ts": 'export async function userRoutes(app) {\n  app.get("/:id", h);\n}\n',
    });
    expect(sig(routes)).toEqual(["GET /users/:id"]);
  });

  it("an exported arrow-function plugin is mounted too", () => {
    const routes = routesOf(fastifyAdapter, {
      "src/server.ts": server('app.register(userRoutes, { prefix: "/users" });'),
      "src/users.ts": 'export const userRoutes = async (f, opts) => {\n  f.post("/", h);\n};\n',
    });
    expect(sig(routes)).toEqual(["POST /users"]);
  });

  it("an exported function that is never registered is not a plugin", () => {
    const routes = routesOf(fastifyAdapter, {
      "src/server.ts": 'import Fastify from "fastify";\nimport { userRoutes } from "./users";\nconst app = Fastify();\nuserRoutes(cache);\n',
      "src/users.ts": 'export function userRoutes(cache) {\n  cache.get("/:id");\n}\n',
    });
    expect(routes).toEqual([]);
  });

  it("keeps the prefix when register options nest an object", () => {
    const routes = routesOf(fastifyAdapter, {
      "src/server.ts": server('app.register(userRoutes, { logLevel: { x: 1 }, prefix: "/v1" });'),
      "src/users.ts": 'export async function userRoutes(app) {\n  app.get("/:id", h);\n}\n',
    });
    expect(sig(routes)).toEqual(["GET /v1/:id"]);
  });

  it("detects routes on a multi-line chain", () => {
    const routes = routesOf(fastifyAdapter, {
      "src/server.ts": 'import Fastify from "fastify";\nconst app = Fastify();\napp\n  .get("/a", h)\n  .post("/b", h);\n',
    });
    expect(sig(routes)).toEqual(["GET /a", "POST /b"]);
  });
});

describe("trpc: procedures declared as consts, default-imported child routers", () => {
  it("resolves same-file procedure consts used as shorthand and renamed entries", () => {
    const routes = routesOf(trpcAdapter, {
      "server/root.ts":
        "const hello = publicProcedure.query(() => 1);\nconst add = publicProcedure\n  .input(z.object({ a: z.number() }))\n  .mutation(({ input }) => input.a);\nexport const appRouter = t.router({ hello, hi: hello, add });\n",
    });
    expect(sig(routes)).toEqual(["MUTATION add", "QUERY hello", "QUERY hi"]);
  });

  it("resolves a procedure const imported from another file", () => {
    const routes = routesOf(trpcAdapter, {
      "server/procs.ts": "export const ping = publicProcedure.query(() => 'pong');\n",
      "server/root.ts": 'import { ping as p } from "./procs";\nexport const appRouter = t.router({ ping: p });\n',
    });
    expect(sig(routes)).toEqual(["QUERY ping"]);
  });

  it("an entry naming a const that is not a procedure is not a route", () => {
    const routes = routesOf(trpcAdapter, {
      "server/root.ts":
        "const config = loadConfig();\nconst data = fetchData();\nexport const appRouter = t.router({ config, data, ok: publicProcedure.query(() => 1) });\n",
    });
    expect(sig(routes)).toEqual(["QUERY ok"]);
  });

  it("mounts a default-imported child router (export default <var>) under its key", () => {
    const routes = routesOf(trpcAdapter, {
      "server/user.ts": "const userRouter = createTRPCRouter({ list: publicProcedure.query(() => []) });\nexport default userRouter;\n",
      "server/root.ts": 'import userRouter from "./user";\nexport const appRouter = createTRPCRouter({ user: userRouter });\n',
    });
    expect(sig(routes)).toEqual(["QUERY user.list"]);
  });

  it("mounts a default-imported child router (export default createTRPCRouter({...})) under its key", () => {
    const routes = routesOf(trpcAdapter, {
      "server/user.ts": "export default createTRPCRouter({ list: publicProcedure.query(() => []) });\n",
      "server/root.ts": 'import users from "./user";\nexport const appRouter = createTRPCRouter({ user: users });\n',
    });
    expect(sig(routes)).toEqual(["QUERY user.list"]);
  });
});
