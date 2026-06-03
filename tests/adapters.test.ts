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
    features: false,
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

describe("django adapter", () => {
  const inv = analyze(opts("django-app"));

  it("detects Django", () => {
    expect(inv.stack.frameworks).toContain("Django");
  });

  it("resolves a root-level path()", () => {
    expect(hasRoute(inv.routes, "/", "page", "config/urls.py")).toBe(true);
  });

  it("prefixes included app routes with their include() mount path (cross-file)", () => {
    // config/urls.py: path("blog/", include("blog.urls")) + blog/urls.py path("")
    expect(hasRoute(inv.routes, "/blog", "page", "blog/urls.py")).toBe(true);
    expect(hasRoute(inv.routes, "/blog/<int:year>", "page", "blog/urls.py")).toBe(true);
  });

  it("resolves re_path() patterns, stripping the regex anchors", () => {
    // re_path(r"^feed/$", views.feed) mounted under "blog/"
    expect(hasRoute(inv.routes, "/blog/feed", "page", "blog/urls.py")).toBe(true);
  });

  it("does not emit the include() mount itself as a leaf route", () => {
    expect(hasRoute(inv.routes, "/blog", "page", "config/urls.py")).toBe(false);
  });
});

describe("rails adapter", () => {
  const inv = analyze(opts("rails-app"));
  const file = "config/routes.rb";

  it("detects Ruby on Rails", () => {
    expect(inv.stack.frameworks).toContain("Ruby on Rails");
  });

  it("resolves the root route", () => {
    expect(hasRoute(inv.routes, "/", "page", file)).toBe(true);
  });

  it("resolves an explicit HTTP verb route", () => {
    expect(hasRoute(inv.routes, "/health", "page", file)).toBe(true);
  });

  it("expands `resources` into its RESTful member/collection paths", () => {
    // resources :photos -> index/create, new, show/update/destroy, edit
    expect(hasRoute(inv.routes, "/photos", "page", file)).toBe(true);
    expect(hasRoute(inv.routes, "/photos/new", "page", file)).toBe(true);
    expect(hasRoute(inv.routes, "/photos/:id", "page", file)).toBe(true);
    expect(hasRoute(inv.routes, "/photos/:id/edit", "page", file)).toBe(true);
  });

  it("prefixes routes inside a `namespace` block", () => {
    expect(hasRoute(inv.routes, "/admin/articles", "page", file)).toBe(true);
    expect(hasRoute(inv.routes, "/admin/articles/:id/edit", "page", file)).toBe(true);
  });

  it("prefixes routes inside a `scope` block and honors `only:`", () => {
    // scope "/api" { resources :sessions, only: [:create, :destroy] }
    // Routes under an `api` segment are classed `api`, not server-rendered `page`.
    expect(hasRoute(inv.routes, "/api/sessions", "api", file)).toBe(true);
    expect(hasRoute(inv.routes, "/api/sessions/:id", "api", file)).toBe(true);
    expect(hasRoute(inv.routes, "/api/sessions/new", "api", file)).toBe(false);
  });

  it("restricts the expansion when `only:` is given", () => {
    // resources :users, only: [:index, :show] -> /users and /users/:id only
    expect(hasRoute(inv.routes, "/users", "page", file)).toBe(true);
    expect(hasRoute(inv.routes, "/users/:id", "page", file)).toBe(true);
    expect(hasRoute(inv.routes, "/users/new", "page", file)).toBe(false);
    expect(hasRoute(inv.routes, "/users/:id/edit", "page", file)).toBe(false);
  });
});

describe("go adapter", () => {
  const inv = analyze(opts("go-app"));

  it("detects Gin", () => {
    expect(inv.stack.frameworks).toContain("Gin");
  });

  it("resolves a top-level method route", () => {
    expect(hasRoute(inv.routes, "/health", "api", "main.go")).toBe(true);
  });

  it("prefixes routes with their .Group() mount path", () => {
    // v1 := r.Group("/api/v1") ; v1.GET("/users") / v1.GET("/users/:id")
    expect(hasRoute(inv.routes, "/api/v1/users", "api", "main.go")).toBe(true);
    expect(hasRoute(inv.routes, "/api/v1/users/:id", "api", "main.go")).toBe(true);
  });

  it("composes nested .Group() prefixes", () => {
    // admin := v1.Group("/admin") ; admin.DELETE("/users/:id")
    expect(hasRoute(inv.routes, "/api/v1/admin/users/:id", "api", "main.go")).toBe(true);
  });

  it("ignores HTTP client calls like http.Get(url)", () => {
    expect(inv.routes.every((r) => !r.route.includes("example.com"))).toBe(true);
  });
});
