import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyze } from "../src/analyze.js";
import type { Options, RouteInfo } from "../src/types.js";

function opts(fixture: string): Options {
  return {
    repo: fileURLToPath(new URL(`./fixtures/${fixture}`, import.meta.url)),
    out: join(tmpdir(), "reconstruct-adapters", fixture),
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
    standalone: false,
    scratch: false,
    plan: "",
    tdd: false,
    check: false,
  };
}

/** A route is present if some RouteInfo matches route + kind (+ optional file). */
function hasRoute(routes: RouteInfo[], route: string, kind: string, file?: string): boolean {
  return routes.some(
    (r) => r.route === route && r.kind === kind && (file === undefined || r.file === file),
  );
}

describe("flask adapter", () => {
  const inv = analyze(opts("flask-api"));

  it("resolves app-level @app.route decorators", () => {
    expect(hasRoute(inv.routes, "/health", "api", "app.py")).toBe(true);
  });

  it("resolves blueprint routes with their registered url_prefix", () => {
    // routes/users.py: bp = Blueprint(...), @bp.route("/") ; mounted at /api/users
    expect(hasRoute(inv.routes, "/api/users", "api", "routes/users.py")).toBe(true);
  });
});

describe("fastapi adapter", () => {
  const inv = analyze(opts("fastapi-app"));

  it("detects FastAPI", () => {
    expect(inv.stack.frameworks).toContain("FastAPI");
  });

  it("resolves app-level method decorators", () => {
    expect(hasRoute(inv.routes, "/health", "api", "main.py")).toBe(true);
  });

  it("composes include_router prefix + APIRouter prefix + decorator path", () => {
    // include_router(prefix="/api") + APIRouter(prefix="/items") + @router.get("/")
    expect(hasRoute(inv.routes, "/api/items", "api", "routers/items.py")).toBe(true);
    expect(hasRoute(inv.routes, "/api/items/{item_id}", "api", "routers/items.py")).toBe(true);
  });
});

describe("nestjs adapter", () => {
  const inv = analyze(opts("nestjs-app"));

  it("detects NestJS", () => {
    expect(inv.stack.frameworks).toContain("NestJS");
  });

  it("composes @Controller(base) with method-decorator subpaths", () => {
    // @Controller("users") + @Get() / @Post() / @Get(":id")
    expect(hasRoute(inv.routes, "/users", "api", "src/users/users.controller.ts")).toBe(true);
    expect(hasRoute(inv.routes, "/users/:id", "api", "src/users/users.controller.ts")).toBe(true);
  });

  it("handles an empty @Controller() with an absolute method path", () => {
    // @Controller() + @Get("health") -> /health
    expect(hasRoute(inv.routes, "/health", "api", "src/app.controller.ts")).toBe(true);
  });
});

describe("express adapter", () => {
  const inv = analyze(opts("express-app"));

  it("detects Express", () => {
    expect(inv.stack.frameworks).toContain("Express");
  });

  it("resolves app-level routes", () => {
    expect(hasRoute(inv.routes, "/health", "api", "index.js")).toBe(true);
  });

  it("prefixes router routes with their app.use mount path (cross-file)", () => {
    // app.use("/api/users", require("./routes/users")) + router.get("/") / "/:id"
    expect(hasRoute(inv.routes, "/api/users", "api", "routes/users.js")).toBe(true);
    expect(hasRoute(inv.routes, "/api/users/:id", "api", "routes/users.js")).toBe(true);
  });
});
