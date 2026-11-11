/** biome-ignore-all lint/suspicious/noTemplateCurlyInString: these strings are JS source text with template literals. */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { expressAdapter } from "../src/adapters/express.js";
import { fastifyAdapter } from "../src/adapters/fastify.js";
import { honoAdapter } from "../src/adapters/hono.js";
import { literalValue, moduleBindings, stringConstants, stringValue } from "../src/adapters/js-modules.js";
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
    const consts = stringConstants("a.ts", src, new Map([["a.ts", src]]), moduleBindings(src));
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
    const src = files.get("src/app.ts") as string;
    const consts = stringConstants("src/app.ts", src, files, moduleBindings(src));
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
