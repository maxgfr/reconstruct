/** biome-ignore-all lint/suspicious/noTemplateCurlyInString: these strings are JS source text with template literals. */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { expressAdapter } from "../src/adapters/express.js";
import { fastifyAdapter } from "../src/adapters/fastify.js";
import { honoAdapter } from "../src/adapters/hono.js";
import { literalValue, stringConstants, stringValue } from "../src/adapters/js-modules.js";
import type { FileInfo, RouteInfo } from "../src/types.js";

// Route paths and mount prefixes built from module-level string constants:
// `app.get(`${API}/users`)`, `app.use(API_PREFIX, r)`, `register(p, { prefix: V1 })`.

function routesOf(adapter: { detectRoutes(f: FileInfo[], r: string): RouteInfo[] }, files: Record<string, string>): string[] {
  const repo = mkdtempSync(join(tmpdir(), "recon-js-consts-"));
  const infos: FileInfo[] = [];
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, rel)), { recursive: true });
    writeFileSync(join(repo, rel), content, "utf8");
    infos.push({ path: rel, ext: extname(rel), size: 0, lines: content.split("\n").length, category: "code", binary: false });
  }
  return adapter
    .detectRoutes(infos, repo)
    .map((r) => `${r.method ?? "-"} ${r.route}`)
    .sort();
}

describe("string constants", () => {
  it("resolves module-level constants, composes them, and leaves the rest as written", () => {
    const src = [
      'const API = "/api";',
      "export const V1 = `${API}/v1`;",
      "const ID: string = '/:id' as const;",
      "const DUP = '/a';",
      "const DUP = '/b';",
      "function f() {",
      '  const LOCAL = "/shadow";',
      "}",
      "",
    ].join("\n");
    const consts = stringConstants("a.ts", new Map([["a.ts", src]]));
    expect([...consts.entries()]).toEqual([
      ["API", "/api"],
      ["V1", "/api/v1"],
      ["ID", "/:id"],
    ]);
    expect(literalValue("`", "${V1}/users${ID}", consts)).toBe("/api/v1/users/:id");
    expect(literalValue("`", "/t/${id}", consts)).toBe("/t/${id}");
    expect(literalValue('"', "${V1}", consts)).toBe("${V1}");
    expect(stringValue("V1", consts)).toBe("/api/v1");
    expect(stringValue("LOCAL", consts)).toBeUndefined();
    expect(stringValue("f(x)", consts)).toBeUndefined();
  });

  it("follows named imports from a relative module", () => {
    const files = new Map([
      ["src/config.ts", 'export const API_PREFIX = "/api";\n'],
      ["src/app.ts", 'import { API_PREFIX as P } from "./config";\nimport def from "./config";\n'],
    ]);
    const consts = stringConstants("src/app.ts", files);
    expect(consts.get("P")).toBe("/api");
    expect(consts.has("def")).toBe(false);
  });
});

describe("express: constant-backed paths", () => {
  it("resolves template-literal routes and identifier mount prefixes", () => {
    const routes = routesOf(expressAdapter, {
      "src/config.js": 'export const API = "/api";\n',
      "src/app.js": [
        'import express from "express";',
        'import { API } from "./config.js";',
        "const V1 = `${API}/v1`;",
        "const app = express();",
        "const r = express.Router();",
        "r.get(`/users`, h).post(`${V1}/x`, h);",
        "r.route(`/items/${ID}`).get(h);",
        "app.get(`/t/${id}`, h);",
        "app.use(V1, r);",
        "",
      ].join("\n"),
    });
    expect(routes).toEqual(["GET /api/v1/items/${ID}", "GET /api/v1/users", "GET /t/${id}", "POST /api/v1/api/v1/x"]);
  });
});

describe("fastify: constant-backed paths", () => {
  it("resolves route templates and register prefixes given as constants", () => {
    const routes = routesOf(fastifyAdapter, {
      "src/server.js": [
        'const Fastify = require("fastify");',
        'const API = "/api";',
        "const app = Fastify();",
        'app.register(require("./users"), { prefix: API });',
        'app.register(require("./items"), { prefix: `${API}/items` });',
        "app.get(`${API}/health`, h);",
        "",
      ].join("\n"),
      "src/users.js":
        "const BASE = '/users';\nmodule.exports = async function (app) {\n  app.get(`${BASE}/:id`, h);\n  app.route({ method: 'POST', url: `${BASE}` });\n};\n",
      "src/items.js": "module.exports = async function (app) {\n  app.get('/', h);\n};\n",
    });
    expect(routes).toEqual(["GET /api/health", "GET /api/items", "GET /api/users/:id", "POST /api/users"]);
  });
});

describe("hono: constant-backed paths", () => {
  it("resolves verb paths, basePath and route mounts given as constants", () => {
    const routes = routesOf(honoAdapter, {
      "src/index.ts": [
        'import { Hono } from "hono";',
        'const V1 = "/v1";',
        'const USERS = "/users";',
        "const users = new Hono();",
        "users.get(`${USERS}/:id`, h);",
        "const app = new Hono().basePath(V1);",
        "app.route(`/api`, users);",
        "app.get(USERS, h);",
        "",
      ].join("\n"),
    });
    expect(routes).toEqual(["GET /v1/api/users/:id", "GET /v1/users"]);
  });
});

describe("review findings on constant-backed paths", () => {
  it("resolves constants across an import cycle whatever the walk order", () => {
    const index =
      'import { usersRouter } from "./users";\nimport express from "express";\nexport const API = "/api";\nconst app = express();\napp.use(usersRouter);\n';
    const users =
      'import express from "express";\nimport { API } from "./index";\nexport const usersRouter = express.Router();\nusersRouter.get(`${API}/users`, h);\n';
    expect(routesOf(expressAdapter, { "src/index.ts": index, "src/users.ts": users })).toEqual(["GET /api/users"]);
    expect(routesOf(expressAdapter, { "src/users.ts": users, "src/index.ts": index })).toEqual(["GET /api/users"]);
  });

  it("keeps a path that holds another quote character", () => {
    const routes = routesOf(expressAdapter, {
      "src/app.js": 'const express = require("express");\nconst app = express();\napp.get("/it\'s", h);\napp.get(`/t/${cfg[\'x\']}`, h);\n',
    });
    expect(routes).toEqual(["GET /it's", "GET /t/${cfg['x']}"]);
    const fastify = routesOf(fastifyAdapter, {
      "src/s.js": 'const Fastify = require("fastify");\nconst app = Fastify();\napp.route({ method: "GET", url: "/it\'s" });\n',
    });
    expect(fastify).toEqual(["GET /it's"]);
  });

  it("reads a fastify prefix from the top-level entry, through concatenation and shorthand", () => {
    const routes = routesOf(fastifyAdapter, {
      "src/s.js": [
        'const Fastify = require("fastify");',
        "const API = '/api';",
        "const prefix = '/short';",
        "const app = Fastify();",
        'app.register(require("./a"), { prefix: API + "/v1" });',
        'app.register(require("./b"), { swagger: { prefix: docs }, prefix: "/b" });',
        'app.register(require("./c"), { prefix });',
        "",
      ].join("\n"),
      "src/a.js": "module.exports = async function (app) { app.get('/a', h); };\n",
      "src/b.js": "module.exports = async function (app) { app.get('/b', h); };\n",
      "src/c.js": "module.exports = async function (app) { app.get('/c', h); };\n",
    });
    expect(routes).toEqual(["GET /api/v1/a", "GET /b/b", "GET /short/c"]);
  });

  it("resolves identifier paths in express and fastify too", () => {
    expect(
      routesOf(expressAdapter, {
        "src/app.js":
          'const express = require("express");\nconst USERS = "/users";\nconst app = express();\napp.get(USERS, h);\napp.post(USERS + "/:id", h);\n',
      }),
    ).toEqual(["GET /users", "POST /users/:id"]);
    expect(
      routesOf(fastifyAdapter, {
        "src/s.js":
          'const Fastify = require("fastify");\nconst USERS = "/users";\nconst app = Fastify();\napp.get(USERS, h);\napp.route({ method: "PUT", url: USERS });\n',
      }),
    ).toEqual(["GET /users", "PUT /users"]);
  });

  it("does not trust a constant that a parameter or a local shadows", () => {
    const routes = routesOf(expressAdapter, {
      "src/app.js": [
        'const express = require("express");',
        'const prefix = "/api";',
        "const app = express();",
        "const r = express.Router();",
        'r.get("/x", h);',
        "function mount(a, prefix) {",
        "  a.use(prefix, r);",
        "}",
        "",
      ].join("\n"),
    });
    expect(routes).toEqual(["GET /x"]);
  });
});

describe("second review pass on constant-backed paths", () => {
  const app = (body: string[]) =>
    ['const express = require("express");', "const app = express();", "const router = express.Router();", 'router.get("/x", h);', ...body, ""].join("\n");
  const time = (fn: () => unknown): number => {
    const t = performance.now();
    fn();
    return performance.now() - t;
  };

  it("stays linear on long blank runs in a declaration and on unclosed parameter lists", () => {
    const blank = " ".repeat(20_000);
    expect(
      time(() => routesOf(expressAdapter, { "src/a.js": app([`const total = first${blank}+ second;`, `const BANNER = "left${blank}right";`]) })),
    ).toBeLessThan(1000);
    const parens = "a(\n".repeat(60_000) + "function(\n".repeat(10_000) + "catch(\n".repeat(10_000);
    expect(time(() => routesOf(expressAdapter, { "src/a.js": app([parens]) }))).toBeLessThan(2000);
  });

  it("never takes a template with an unresolved interpolation for a constant, whatever the order", () => {
    for (const decls of [
      ["const A = `${x}/a`;", "const B = `/b${y}`;"],
      ["const B = `/b${y}`;", "const A = `${x}/a`;"],
    ]) {
      expect(routesOf(expressAdapter, { "src/a.js": app([...decls, "app.use(B, router);", "app.get(`/c${A}`, h);"]) })).toEqual(["GET /c${A}", "GET /x"]);
    }
    expect(routesOf(expressAdapter, { "src/a.js": app(["const API = `${process.env.BASE}/api`;", "app.use(API, router);"]) })).toEqual(["GET /x"]);
  });

  it("sees destructured and loop bindings as shadows, and keeps constants used as types or in defaults", () => {
    expect(
      routesOf(expressAdapter, {
        "src/a.js": app(['const prefix = "/api";', "function m(opts) {", "  const { prefix } = opts;", "  app.use(prefix, router);", "}"]),
      }),
    ).toEqual(["GET /x"]);
    expect(routesOf(expressAdapter, { "src/a.js": app(['const P = "/p";', "for (const P of list) app.use(P, router);"]) })).toEqual(["GET /x"]);
    const kept = [
      'const API = "/api";',
      "function other(x = join(y, API)) {}",
      "const f = (cfg: Record<string, API>) => cfg;",
      "const g = (): API => null;",
      "const sql = `select(API) {`;",
      "app.use(API, router);",
    ];
    expect(routesOf(expressAdapter, { "src/a.ts": app(kept) })).toEqual(["GET /api/x"]);
  });

  it("keeps the known part of a path built from a non-constant, an assertion or a call", () => {
    const routes = routesOf(expressAdapter, {
      "src/a.js": app([
        "app.get('/api/' + version + '/users', h);",
        "app.get('/cast' as string, h);",
        "app.get('/lower'.toLowerCase(), h);",
        "app.get('/it\\'s', h);",
      ]),
    });
    expect(routes).toEqual(["GET /api/${version}/users", "GET /cast", "GET /it's", "GET /lower", "GET /x"]);
  });
});
