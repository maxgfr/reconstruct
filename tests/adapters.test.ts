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
    specs: false,
    standalone: false,
    scratch: false,
    plan: "",
    tdd: false,
    check: false,
  };
}

/** A route is present if some RouteInfo matches route + kind (+ optional file). */
function hasRoute(routes: RouteInfo[], route: string, kind: string, file?: string): boolean {
  return routes.some((r) => r.route === route && r.kind === kind && (file === undefined || r.file === file));
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

  it("resolves an express-ws app.ws() route with method WS", () => {
    expect(hasRoute(inv.routes, "/live", "api", "index.js")).toBe(true);
    expect(inv.routes.find((r) => r.route === "/live")?.method).toBe("WS");
  });
});

describe("fastify adapter", () => {
  const inv = analyze(opts("fastify-app"));

  it("detects Fastify", () => {
    expect(inv.stack.frameworks).toContain("Fastify");
  });

  it("resolves app-level verb routes with their method", () => {
    expect(hasRoute(inv.routes, "/health", "api", "index.js")).toBe(true);
    expect(inv.routes.find((r) => r.route === "/health")?.method).toBe("GET");
  });

  it("resolves app-level route({ method, url }) declarations", () => {
    expect(hasRoute(inv.routes, "/version", "api", "index.js")).toBe(true);
    expect(inv.routes.find((r) => r.route === "/version")?.method).toBe("GET");
  });

  it("prefixes plugin routes with their register() prefix (cross-file)", () => {
    // register(require("./routes/users"), { prefix: "/api/users" }) + fastify.get("/")
    expect(hasRoute(inv.routes, "/api/users", "api", "routes/users.js")).toBe(true);
    const methods = inv.routes
      .filter((r) => r.route === "/api/users")
      .map((r) => r.method)
      .sort();
    expect(methods).toEqual(["GET", "POST"]);
  });

  it("expands a route({ method: [...] }) array into one route per verb", () => {
    const byId = inv.routes.filter((r) => r.route === "/api/users/:id");
    expect(byId.map((r) => r.method).sort()).toEqual(["DELETE", "GET"]);
  });

  it("resolves an arrow-function plugin mounted under its own prefix", () => {
    expect(hasRoute(inv.routes, "/admin/cache", "api", "routes/admin.js")).toBe(true);
    expect(inv.routes.find((r) => r.route === "/admin/cache")?.method).toBe("DELETE");
  });

  it("marks a { websocket: true } route as WS, not GET", () => {
    expect(hasRoute(inv.routes, "/live", "api", "index.js")).toBe(true);
    expect(inv.routes.find((r) => r.route === "/live")?.method).toBe("WS");
  });
});

describe("hono adapter", () => {
  const inv = analyze(opts("hono-app"));

  it("detects Hono", () => {
    expect(inv.stack.frameworks).toContain("Hono");
  });

  it("prefixes app-level routes with the chained basePath()", () => {
    expect(hasRoute(inv.routes, "/api/health", "api", "src/index.ts")).toBe(true);
    expect(inv.routes.find((r) => r.route === "/api/health")?.method).toBe("GET");
  });

  it("resolves on(verb, path) declarations with their custom verb", () => {
    expect(hasRoute(inv.routes, "/api/cache", "api", "src/index.ts")).toBe(true);
    expect(inv.routes.find((r) => r.route === "/api/cache")?.method).toBe("PURGE");
  });

  it("composes basePath + route() mount for a cross-file sub-app", () => {
    // basePath("/api") + app.route("/users", users) + users.get("/")
    expect(hasRoute(inv.routes, "/api/users", "api", "src/users.ts")).toBe(true);
    const methods = inv.routes
      .filter((r) => r.route === "/api/users")
      .map((r) => r.method)
      .sort();
    expect(methods).toEqual(["GET", "POST"]);
    expect(hasRoute(inv.routes, "/api/users/:id", "api", "src/users.ts")).toBe(true);
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

/** The method of a resolved route (or undefined if not present). */
function methodOf(routes: RouteInfo[], route: string): string | undefined {
  return routes.find((r) => r.route === route)?.method;
}

describe("trpc adapter", () => {
  const inv = analyze(opts("trpc-app"));

  it("resolves procedures as dot-paths with QUERY/MUTATION methods", () => {
    expect(hasRoute(inv.routes, "user.list", "api", "src/server/api/routers/user.ts")).toBe(true);
    expect(methodOf(inv.routes, "user.list")).toBe("QUERY");
    expect(methodOf(inv.routes, "user.byId")).toBe("QUERY");
    expect(methodOf(inv.routes, "user.update")).toBe("MUTATION");
    expect(hasRoute(inv.routes, "post.feed", "api", "src/server/api/routers/post.ts")).toBe(true);
    expect(methodOf(inv.routes, "post.feed")).toBe("QUERY");
    expect(methodOf(inv.routes, "post.create")).toBe("MUTATION");
  });

  it("composes nested routers transitively (cross-file and same-file)", () => {
    // root.ts: appRouter = createTRPCRouter({ user, post, admin })
    // admin.ts (t.router form): { stats, purge, events, audit: auditRouter }
    expect(methodOf(inv.routes, "admin.stats")).toBe("QUERY");
    expect(methodOf(inv.routes, "admin.purge")).toBe("MUTATION");
    // same-file nested router auditRouter mounted at `audit`
    expect(hasRoute(inv.routes, "admin.audit.log", "api", "src/server/api/routers/admin.ts")).toBe(true);
  });

  it("detects the subscription kind", () => {
    expect(methodOf(inv.routes, "admin.events")).toBe("SUBSCRIPTION");
  });

  it("activates from the library signal, not frameworks", () => {
    expect(inv.stack.frameworks).not.toContain("tRPC");
    expect(inv.routes.length).toBeGreaterThan(0);
  });
});

describe("dotnet adapter", () => {
  const inv = analyze(opts("dotnet-api"));

  it("detects ASP.NET Core from the csproj SDK", () => {
    expect(inv.stack.frameworks).toContain("ASP.NET Core");
    expect(inv.stack.languages).toContain("C#");
  });

  it("resolves a top-level Minimal API route", () => {
    expect(hasRoute(inv.routes, "/health", "api", "Program.cs")).toBe(true);
  });

  it("prefixes Minimal API routes with their MapGroup path", () => {
    // var todos = app.MapGroup("/api/todos") ; todos.MapGet("/") / MapPost("/")
    expect(hasRoute(inv.routes, "/api/todos", "api", "Program.cs")).toBe(true);
    expect(hasRoute(inv.routes, "/api/todos/{id}", "api", "Program.cs")).toBe(true);
  });

  it("expands the [controller] token from the class name", () => {
    // [Route("api/[controller]")] on UsersController -> /api/users
    expect(hasRoute(inv.routes, "/api/users", "api", "Controllers/UsersController.cs")).toBe(true);
    expect(hasRoute(inv.routes, "/api/users/{id}", "api", "Controllers/UsersController.cs")).toBe(true);
  });

  it("keeps the HTTP verb as part of the operation identity", () => {
    const users = inv.routes.filter((r) => r.route === "/api/users");
    expect(users.map((r) => r.method).sort()).toEqual(["GET", "POST"]);
    const todos = inv.routes.filter((r) => r.route === "/api/todos");
    expect(todos.map((r) => r.method).sort()).toEqual(["GET", "POST"]);
  });

  it("resolves both paradigms in one repo without double-counting", () => {
    expect(inv.routes).toHaveLength(8);
  });

  it("no longer reports the surface as unmapped", () => {
    expect(inv.unknowns.join("\n")).not.toMatch(/No routes were resolved/);
  });
});
