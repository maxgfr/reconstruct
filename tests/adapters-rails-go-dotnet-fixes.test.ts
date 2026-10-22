import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { analyze } from "../src/analyze.js";
import { walk } from "../src/walk.js";
import { detectStack } from "../src/detect/stack.js";
import { railsAdapter } from "../src/adapters/rails.js";
import { goAdapter } from "../src/adapters/go.js";
import { dotnetAdapter } from "../src/adapters/dotnet.js";
import type { RouteAdapter } from "../src/adapters/types.js";
import type { FileInfo, Options, RouteInfo } from "../src/types.js";

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

function tempRepo(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "recon-rgd-"));
  dirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const dest = join(dir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content, "utf8");
  }
  return dir;
}

function fileInfos(files: Record<string, string>): FileInfo[] {
  return Object.entries(files).map(([path, content]) => ({
    path,
    ext: path.slice(path.lastIndexOf(".")),
    size: content.length,
    lines: content.split("\n").length,
    category: "code",
    binary: false,
  }));
}

/** Run one adapter directly over in-memory files. */
function run(adapter: RouteAdapter, files: Record<string, string>): RouteInfo[] {
  return adapter.detectRoutes(fileInfos(files), tempRepo(files));
}

const ops = (routes: RouteInfo[]): string[] => routes.map((r) => `${r.method ?? "*"} ${r.route}`).sort();
const has = (routes: RouteInfo[], method: string, route: string): boolean => routes.some((r) => r.route === route && r.method === method);

function opts(repo: string): Options {
  return {
    repo,
    out: join(tmpdir(), "reconstruct-rgd-out"),
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

// ---------------------------------------------------------------------------
describe("rails adapter fixes", () => {
  const routesRb = (body: string) => ({ "config/routes.rb": `Rails.application.routes.draw do\n${body}\nend\n` });

  it("honors `only:` given as a single symbol", () => {
    const r = run(railsAdapter, routesRb("  resources :photos, only: :show"));
    expect(ops(r)).toEqual(["GET /photos/:id"]);
  });

  it("honors `only:` given as a %i[] array", () => {
    const r = run(railsAdapter, routesRb("  resources :photos, only: %i[index show]"));
    expect(ops(r)).toEqual(["GET /photos", "GET /photos/:id"]);
  });

  it("honors `only:` / `except:` arrays and the hash-rocket spelling", () => {
    expect(ops(run(railsAdapter, routesRb("  resources :photos, only: [:index, :show]")))).toEqual(["GET /photos", "GET /photos/:id"]);
    expect(ops(run(railsAdapter, routesRb("  resources :photos, :only => [:index]")))).toEqual(["GET /photos"]);
    const except = ops(run(railsAdapter, routesRb("  resources :photos, except: %i[new edit update destroy]")));
    expect(except).toEqual(["GET /photos", "GET /photos/:id", "POST /photos"]);
  });

  it("keeps the namespace when a `do` line carries a trailing comment", () => {
    const r = run(railsAdapter, routesRb("  namespace :api do # JSON endpoints\n    resources :users, only: :index\n  end"));
    expect(ops(r)).toEqual(["GET /api/users"]);
    expect(r[0]?.kind).toBe("api");
  });

  it("does not let an `if … end` block pop the enclosing namespace", () => {
    const r = run(
      railsAdapter,
      routesRb(`  namespace :api do
    if Rails.env.development?
      get "/debug", to: "debug#show"
    end
    resources :users, only: :index
  end
  namespace :admin do
    get "/stats", to: "stats#show"
  end`),
    );
    expect(has(r, "GET", "/api/debug")).toBe(true);
    expect(has(r, "GET", "/api/users")).toBe(true);
    expect(r.find((x) => x.route === "/api/users")?.kind).toBe("api");
    expect(has(r, "GET", "/admin/stats")).toBe(true);
  });

  it("treats non-route do…end blocks and one-line blocks as transparent", () => {
    const r = run(
      railsAdapter,
      routesRb(`  namespace :api do
    constraints(lambda { |req| req.format == :json }) do
      resources :posts, only: :index
    end
    %w[a b].each do |n| puts n end
    resources :users do
      member do
        unless ENV["X"]
          get :preview
        end
      end
    end
    resources :tags, only: :index
  end`),
    );
    expect(has(r, "GET", "/api/posts")).toBe(true);
    expect(has(r, "GET", "/api/users/:id/preview")).toBe(true);
    expect(has(r, "GET", "/api/tags")).toBe(true);
  });

  it("records the declaration line on every route", () => {
    const r = run(railsAdapter, routesRb('  root "home#index"\n\n  resources :photos, only: :show'));
    expect(r.find((x) => x.route === "/")?.line).toBe(2);
    expect(r.find((x) => x.route === "/photos/:id")?.line).toBe(4);
  });
});

// ---------------------------------------------------------------------------
describe("go adapter fixes", () => {
  it("ignores braces inside chi route patterns when matching closures", () => {
    const r = run(goAdapter, {
      "main.go": `package main

func main() {
	r := chi.NewRouter()
	r.Route("/articles", func(r chi.Router) {
		r.Get("/", list)
		r.Route("/{articleID}", func(r chi.Router) {
			r.Get("/", get)
			r.Put("/", update)
		})
	})
	r.Get("/health", health)
}
`,
    });
    expect(ops(r)).toEqual(["GET /articles", "GET /articles/{articleID}", "GET /health", "PUT /articles/{articleID}"]);
  });

  it("does not treat HTTP client calls as routes", () => {
    const r = run(goAdapter, {
      "main.go": `package main

func main() {
	r := gin.Default()
	r.GET("/ping", ping)
}

func callRemote() {
	client := &http.Client{}
	client.Get("/api/remote")
	resp, err := c.Post("/api/other", "application/json", nil)
	_, _ = resp, err
	http.Get(url)
}
`,
    });
    expect(ops(r)).toEqual(["GET /ping"]);
  });

  it("recognises routers from typed params, struct fields and router-returning funcs", () => {
    const r = run(goAdapter, {
      "server.go": `package main

type Server struct {
	router *gin.Engine
}

func (s *Server) routes() {
	s.router.GET("/a", h)
}

func newRouter() *echo.Echo {
	return echo.New()
}
`,
      "routes.go": `package main

func Register(app *fiber.App) {
	app.Get("/b", h)
}

func main() {
	e := newRouter()
	e.POST("/c", h)
}
`,
    });
    expect(ops(r)).toEqual(["GET /a", "GET /b", "POST /c"]);
  });

  it("scopes route groups to their function", () => {
    const r = run(goAdapter, {
      "main.go": `package main

func publicRoutes(r *gin.Engine) {
	v1 := r.Group("/public")
	v1.GET("/items", h)
}

func adminRoutes(r *gin.Engine) {
	v1 := r.Group("/admin")
	v1.GET("/items", h)
}
`,
    });
    expect(ops(r)).toEqual(["GET /admin/items", "GET /public/items"]);
  });

  it("records the declaration line on every route", () => {
    const r = run(goAdapter, { "main.go": 'package main\n\nfunc main() {\n\tr := chi.NewRouter()\n\tr.Get("/x", h)\n\tr.Mount("/m", sub)\n}\n' });
    expect(r.find((x) => x.route === "/x")?.line).toBe(5);
    expect(r.find((x) => x.route === "/m")?.line).toBe(6);
  });
});

// ---------------------------------------------------------------------------
describe("dotnet adapter fixes", () => {
  it("lets an absolute action template override the controller template", () => {
    const r = run(dotnetAdapter, {
      "Controllers/UsersController.cs": `[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    [HttpGet("/health")]
    public IActionResult Health() => Ok();

    [HttpGet("~/ping")]
    public IActionResult Ping() => Ok();

    [HttpGet("{id}")]
    public IActionResult Get(int id) => Ok();
}
`,
    });
    expect(ops(r)).toEqual(["GET /api/users/{id}", "GET /health", "GET /ping"]);
  });

  it("applies a method-level [Route] only to its own action", () => {
    const r = run(dotnetAdapter, {
      "Controllers/ItemsController.cs": `[Route("api/items")]
public class ItemsController : ControllerBase
{
    [HttpGet]
    [Route("search")]
    public IActionResult Search(string q) => Ok();

    [HttpPost]
    public IActionResult Create() => Ok();

    [Route("~/legacy"), HttpDelete]
    public IActionResult Legacy() => Ok();
}
`,
    });
    expect(ops(r)).toEqual(["DELETE /legacy", "GET /api/items/search", "POST /api/items"]);
  });

  it("does not let a class without [Route] inherit the previous class's template", () => {
    const r = run(dotnetAdapter, {
      "Controllers/Mixed.cs": `[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    [HttpGet("{id}")]
    public IActionResult Get(int id) => Ok();
}

public class HomeController : Controller
{
    [HttpGet]
    public IActionResult Index() => View();
}
`,
    });
    expect(ops(r)).toEqual(["GET /api/orders/{id}"]);
  });

  it("records the declaration line on every route", () => {
    const r = run(dotnetAdapter, {
      "Program.cs": 'var app = WebApplication.CreateBuilder(args).Build();\n\napp.MapGet("/health", () => "ok");\n',
      "C.cs": '[Route("api/c")]\npublic class CController : ControllerBase\n{\n    [HttpGet]\n    public IActionResult L() => Ok();\n}\n',
    });
    expect(r.find((x) => x.route === "/health")?.line).toBe(3);
    expect(r.find((x) => x.route === "/api/c")?.line).toBe(4);
  });
});

// ---------------------------------------------------------------------------
describe("stack detection fixes", () => {
  it("ignores .csproj / Program.cs under test fixture directories", () => {
    const repo = tempRepo({
      "package.json": JSON.stringify({ dependencies: { express: "^4" } }),
      "index.js": "require('express')().listen(3000);\n",
      "tests/fixtures/dotnet-api/Api.csproj": '<Project Sdk="Microsoft.NET.Sdk.Web"></Project>\n',
      "tests/fixtures/dotnet-api/Program.cs": "var builder = WebApplication.CreateBuilder(args);\n",
      "examples/web/Web.csproj": '<Project Sdk="Microsoft.NET.Sdk.Web"></Project>\n',
    });
    const stack = detectStack(repo, walk(repo).files);
    expect(stack.frameworks).not.toContain("ASP.NET Core");
    expect(stack.packageManagers).not.toContain("nuget");
  });

  it("examines every project, not just the first .csproj", () => {
    const repo = tempRepo({
      "src/Core/Core.csproj": '<Project Sdk="Microsoft.NET.Sdk"></Project>\n',
      "src/Web/Web.csproj": '<Project Sdk="Microsoft.NET.Sdk.Web"></Project>\n',
    });
    const stack = detectStack(repo, walk(repo).files);
    expect(stack.frameworks).toContain("ASP.NET Core");
  });

  it("does not report ASP.NET Core for this repository itself", () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    expect(analyze(opts(root)).stack.frameworks).not.toContain("ASP.NET Core");
  });

  it.each([
    ["Pipfile", '[packages]\ndjango = "*"\n', "Django"],
    ["setup.py", 'setup(name="x", install_requires=["flask>=2"])\n', "Flask"],
    ["setup.cfg", "[options]\ninstall_requires =\n    fastapi\n", "FastAPI"],
    ["requirements/base.txt", "Django==5.0\n", "Django"],
  ])("detects the Python framework from %s", (file, content, framework) => {
    const repo = tempRepo({ [file]: content, "app.py": "x = 1\n" });
    const stack = detectStack(repo, walk(repo).files);
    expect(stack.frameworks).toContain(framework);
    expect(stack.packageManagers).toContain("pip");
  });
});
