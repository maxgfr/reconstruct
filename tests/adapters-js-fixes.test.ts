import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { expressAdapter } from "../src/adapters/express.js";
import { fastifyAdapter } from "../src/adapters/fastify.js";
import { honoAdapter } from "../src/adapters/hono.js";
import type { RouteAdapter } from "../src/adapters/types.js";
import type { FileInfo, RouteInfo } from "../src/types.js";

/** Write `files` to a fresh temp repo and run one adapter over them. */
function run(adapter: RouteAdapter, files: Record<string, string>): RouteInfo[] {
  const repo = mkdtempSync(join(tmpdir(), "recon-jsfix-"));
  const infos: FileInfo[] = [];
  for (const [rel, content] of Object.entries(files)) {
    const dest = join(repo, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content, "utf8");
    infos.push({ path: rel, ext: extname(rel), size: content.length, lines: content.split("\n").length, category: "code", binary: false });
  }
  return adapter.detectRoutes(infos, repo);
}

/** "METHOD /route" for every route, sorted — the comparable surface. */
const sig = (routes: RouteInfo[]): string[] => routes.map((r) => `${r.method ?? "-"} ${r.route}`).sort();

describe("express adapter fixes", () => {
  it("resolves routes on typed instances and Router({ options })", () => {
    const r = run(expressAdapter, {
      "app.ts": `import express, { Express, Router } from "express";
const app: Express = express();
const router: Router = Router();
const nested = express.Router({ mergeParams: true });
app.get("/health", (req, res) => res.send("ok"));
router.get("/items", (req, res) => res.send([]));
nested.post("/notes", (req, res) => res.send({}));
app.use("/api", router);
router.use("/n", nested);
`,
    });
    expect(sig(r)).toEqual(["GET /api/items", "GET /health", "POST /api/n/notes"]);
  });

  it("keeps the mount prefix of an inline require and of a router after middleware", () => {
    const r = run(expressAdapter, {
      "index.js": `const express = require("express");
const auth = require("./auth");
const admin = require("./admin");
const app = express();
app.use("/api", require("./users"));
app.use("/admin", auth, admin);
`,
      "users.js": `const router = require("express").Router();
router.get("/:id", (req, res) => res.send({}));
module.exports = router;
`,
      "admin.js": `const express = require("express");
const router = express.Router();
router.delete("/cache", (req, res) => res.send({}));
module.exports = router;
`,
      "auth.js": "module.exports = (req, res, next) => next();\n",
    });
    expect(sig(r)).toEqual(["DELETE /admin/cache", "GET /api/:id"]);
  });

  it("composes nested router mounts across files and emits every mount of a router", () => {
    const r = run(expressAdapter, {
      "index.ts": `import express from "express";
import api from "./api.js";
import health from "./health.js";
const app = express();
app.use("/api", api);
app.use("/health", health);
app.use("/status", health);
`,
      "api.ts": `import { Router } from "express";
import usersRouter from "./users.js";
const router = Router();
router.use("/users", usersRouter);
export default router;
`,
      "users.ts": `import { Router } from "express";
const usersRouter = Router();
usersRouter.get("/:id", (req, res) => res.send({}));
export default usersRouter;
`,
      "health.ts": `import { Router } from "express";
const h = Router();
h.get("/", (req, res) => res.send("ok"));
export default h;
`,
    });
    expect(sig(r)).toEqual(["GET /api/users/:id", "GET /health", "GET /status"]);
  });

  it("scans a route() chain across lines, including options and head", () => {
    const r = run(expressAdapter, {
      "index.js": `const express = require("express");
const app = express();
app
  .route("/book")
  .get((req, res) => {
    res.send(fn(1, (x) => x));
  })
  .post((req, res) => res.send({}))
  .options((req, res) => res.end());
app.head("/ping", (req, res) => res.end());
app.get("/a", (req, res) => res.end()).put("/b", (req, res) => res.end());
`,
    });
    expect(sig(r)).toEqual(["GET /a", "GET /book", "HEAD /ping", "OPTIONS /book", "POST /book", "PUT /b"]);
  });

  it("does not read a settings getter as a route", () => {
    const r = run(expressAdapter, {
      "index.js": `const express = require("express");
const app = express();
const env = app.get("env");
app.set("port", 3000);
app.get("*", (req, res) => res.status(404).end());
`,
    });
    expect(sig(r)).toEqual(["GET /*"]);
  });

  it("records the declaration line of every route", () => {
    const r = run(expressAdapter, {
      "index.js": `const express = require("express");
const app = express();

app.get("/one", h);
app.route("/two")
  .get(h)
  .post(h);
`,
    });
    expect(r.map((x) => `${x.method} ${x.route}:${x.line}`).sort()).toEqual(["GET /one:4", "GET /two:5", "POST /two:5"]);
  });
});

describe("hono adapter fixes", () => {
  it("resolves chained route declarations", () => {
    const r = run(honoAdapter, {
      "index.ts": `import { Hono } from "hono";
const app = new Hono()
  .get("/a", (c) => c.json({ ok: c.req.param("x") }))
  .post("/b", (c) => c.json({}));
app.get("/c").put("/d");
const route = app.delete("/e", (c) => c.text("x")).patch("/f", (c) => c.text("y"));
export default app;
`,
    });
    expect(sig(r)).toEqual(["DELETE /e", "GET /a", "GET /c", "PATCH /f", "POST /b", "PUT /d"]);
  });

  it("treats basePath() as returning a copy", () => {
    const r = run(honoAdapter, {
      "index.ts": `import { Hono } from "hono";
const app = new Hono().basePath("/api");
const v2 = app.basePath("/v2");
v2.get("/x", (c) => c.text("x"));
app.get("/y", (c) => c.text("y"));
`,
    });
    expect(sig(r)).toEqual(["GET /api/v2/x", "GET /api/y"]);
  });

  it("keeps the mount prefix of a sub-app imported by name", () => {
    const r = run(honoAdapter, {
      "src/index.ts": `import { Hono } from "hono";
import { users } from "./users.js";
import { posts as postsApp } from "./posts";
const app = new Hono().basePath("/api");
app.route("/users", users);
app.route("/posts", postsApp);
export default app;
`,
      "src/users.ts": `import { Hono } from "hono";
export const users = new Hono();
users.get("/:id", (c) => c.json({}));
`,
      "src/posts.ts": `import { Hono } from "hono";
const posts = new Hono().get("/", (c) => c.json([]));
export { posts };
`,
    });
    expect(sig(r)).toEqual(["GET /api/posts", "GET /api/users/:id"]);
  });

  it("mounts a default-exported chained app and ignores a non-literal on() verb", () => {
    const r = run(honoAdapter, {
      "index.ts": `import { Hono } from "hono";
import admin from "./admin";
const app = new Hono();
app.route("/admin", admin);
app.on(method, "/dyn", (c) => c.text(""));
`,
      "admin.ts": `import { Hono } from "hono";
export default new Hono().get("/stats", (c) => c.json({})).on(["GET", "HEAD"], "/ping", (c) => c.text(""));
`,
    });
    expect(sig(r)).toEqual(["GET /admin/ping", "GET /admin/stats", "HEAD /admin/ping"]);
  });

  it("records the declaration line of chained routes", () => {
    const r = run(honoAdapter, {
      "index.ts": `import { Hono } from "hono";
const app = new Hono()
  .get("/a", (c) => c.text("a"))
  .post("/b", (c) => c.text("b"));
`,
    });
    expect(r.map((x) => `${x.method} ${x.route}:${x.line}`).sort()).toEqual(["GET /a:3", "POST /b:4"]);
  });
});

describe("fastify adapter fixes", () => {
  it("resolves routes on a typed instance", () => {
    const r = run(fastifyAdapter, {
      "server.ts": `import Fastify, { FastifyInstance } from "fastify";
const server: FastifyInstance = Fastify({ logger: true });
server.get("/ping", async () => "pong");
`,
    });
    expect(sig(r)).toEqual(["GET /ping"]);
    expect(r[0]?.line).toBe(3);
  });

  it("resolves routes inside fastify-plugin wrapped plugins", () => {
    const r = run(fastifyAdapter, {
      "index.js": `const fastify = require("fastify")();
fastify.register(require("./plugins/db"), { prefix: "/ignored" });
fastify.register(require("./routes/users"), { prefix: "/users" });
`,
      "plugins/db.js": `const fp = require("fastify-plugin");
module.exports = fp(async function (fastify, opts) {
  fastify.get("/db/health", async () => ({ ok: true }));
});
`,
      "routes/users.js": `module.exports = async function (fastify) {
  fastify.register(require("./profile"));
};
`,
      "routes/profile.ts": `import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
export default fp(async (fastify: FastifyInstance, opts) => {
  fastify.post("/profile", async () => ({}));
});
`,
    });
    // fastify-plugin skips encapsulation: a wrapped plugin runs in its parent's
    // context, so the register prefix is NOT applied — the parent's prefix is.
    expect(sig(r)).toEqual(["GET /db/health", "POST /users/profile"]);
  });

  it("resolves a named plugin wrapped at export time", () => {
    const r = run(fastifyAdapter, {
      "index.ts": `import Fastify from "fastify";
import routes from "./routes";
const app = Fastify();
app.register(routes);
`,
      "routes.ts": `import fp from "fastify-plugin";
async function routes(instance, opts) {
  instance.put("/items/:id", async () => ({}));
}
export default fp(routes, { name: "routes" });
`,
    });
    expect(sig(r)).toEqual(["PUT /items/:id"]);
  });
});
