import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { fastapiAdapter } from "../src/adapters/fastapi.js";
import { flaskAdapter } from "../src/adapters/flask.js";
import { goAdapter } from "../src/adapters/go.js";
import { railsAdapter } from "../src/adapters/rails.js";
import { pythonImportAliases } from "../src/adapters/util.js";
import { detectStack } from "../src/detect/stack.js";
import type { FileCategory, FileInfo, RouteInfo } from "../src/types.js";

// Regression tests for Go / Rails / Python route, dependency and stack gaps.

function repoOf(files: Record<string, string>, category: FileCategory = "code"): { repo: string; infos: FileInfo[] } {
  const repo = mkdtempSync(join(tmpdir(), "recon-gaps-"));
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

describe("go: gorilla subrouters and Handle", () => {
  it("prefixes routes on a PathPrefix(...).Subrouter()", () => {
    const routes = routesOf(goAdapter, {
      "main.go": `package main

func main() {
	r := mux.NewRouter()
	s := r.PathPrefix("/api").Subrouter()
	s.HandleFunc("/users", h).Methods("GET")
	r.HandleFunc("/health", h)
}
`,
    });
    expect(sig(routes)).toEqual(["- /health", "GET /api/users"]);
  });

  it("detects r.Handle(path, h).Methods(...) and http.Handle(path, h)", () => {
    const routes = routesOf(goAdapter, {
      "main.go": `package main

func main() {
	r := mux.NewRouter()
	r.Handle("/x", h).Methods("POST")
	http.Handle("/metrics", promhttp.Handler())
}
`,
    });
    expect(sig(routes)).toEqual(["- /metrics", "POST /x"]);
  });

  it('keeps the verb-as-argument r.Handle("GET", path) form', () => {
    const routes = routesOf(goAdapter, {
      "main.go": 'package main\n\nfunc main() {\n\tr := gin.Default()\n\tr.Handle("GET", "/p", h)\n}\n',
    });
    expect(sig(routes)).toEqual(["GET /p"]);
  });
});

describe("go: gin groups", () => {
  it("keeps the prefix of a group assigned with =", () => {
    const routes = routesOf(goAdapter, {
      "main.go": `package main

var api *gin.RouterGroup

func main() {
	r := gin.Default()
	api = r.Group("/api")
	api.GET("/users", h)
}
`,
    });
    expect(sig(routes)).toEqual(["GET /api/users"]);
  });

  it("resolves a group passed to a same-package function with one call site", () => {
    const routes = routesOf(goAdapter, {
      "main.go": `package main

func main() {
	r := gin.Default()
	v1 := r.Group("/api/v1")
	registerUsers(v1)
}
`,
      "users.go": `package main

func registerUsers(rg *gin.RouterGroup) {
	rg.GET("/users", h)
	admin := rg.Group("/admin")
	admin.POST("/ban", h)
}
`,
    });
    expect(sig(routes)).toEqual(["GET /api/v1/users", "POST /api/v1/admin/ban"]);
  });

  it("resolves a same-file helper and composes through two levels", () => {
    const routes = routesOf(goAdapter, {
      "main.go": `package main

func main() {
	r := gin.Default()
	api := r.Group("/api")
	mount(api)
}

func mount(g *gin.RouterGroup) {
	v2 := g.Group("/v2")
	items(v2)
}

func items(g *gin.RouterGroup) {
	g.GET("/items", h)
}
`,
    });
    expect(sig(routes)).toEqual(["GET /api/v2/items"]);
  });

  it("leaves the prefix off when the function has several call sites", () => {
    const routes = routesOf(goAdapter, {
      "main.go": `package main

func main() {
	r := gin.Default()
	v1 := r.Group("/v1")
	v2 := r.Group("/v2")
	registerUsers(v1)
	registerUsers(v2)
}

func registerUsers(rg *gin.RouterGroup) {
	rg.GET("/users", h)
}
`,
    });
    expect(sig(routes)).toEqual(["GET /users"]);
  });

  it("leaves the prefix off for an exported function also called from another package", () => {
    const routes = routesOf(goAdapter, {
      "routes/users.go": `package routes

func Register(rg *gin.RouterGroup) {
	rg.GET("/users", h)
}

func init() {
	Register(nil)
}
`,
      "main.go": `package main

func main() {
	r := gin.Default()
	routes.Register(r.Group("/api"))
}
`,
    });
    expect(sig(routes)).toEqual(["GET /users"]);
  });

  it("does not bind a function from another package with the same name", () => {
    const routes = routesOf(goAdapter, {
      "main.go": `package main

func main() {
	r := gin.Default()
	v1 := r.Group("/api")
	registerUsers(v1)
}

func registerUsers(rg *gin.RouterGroup) {
	rg.GET("/a", h)
}
`,
      "other/other.go": `package other

func registerUsers(rg *gin.RouterGroup) {
	rg.GET("/b", h)
}
`,
    });
    expect(sig(routes)).toEqual(["GET /api/a", "GET /b"]);
  });
});

describe("stack: Go net/http activation and indirect deps", () => {
  const stackOf = (files: Record<string, string>) => {
    const { repo, infos } = repoOf(files);
    return detectStack(repo, infos);
  };

  it("labels a framework-less Go repo importing net/http", () => {
    const s = stackOf({ "go.mod": "module x\n", "main.go": 'package main\n\nimport "net/http"\n\nfunc main() { http.HandleFunc("/x", h) }\n' });
    expect(s.frameworks).toEqual([]);
    expect(s.libraries).toContain("net/http");
  });

  it("does not label a Go repo that never imports net/http, or only in tests", () => {
    const s = stackOf({
      "go.mod": "module x\n",
      "main.go": 'package main\n\nimport "fmt"\n\nfunc main() { fmt.Println("net/http") }\n',
      "main_test.go": 'package main\n\nimport "net/http"\n',
      "testdata/srv.go": 'package srv\n\nimport "net/http"\n',
    });
    expect(s.libraries).not.toContain("net/http");
  });

  it("does not add the net/http label when a Go web framework is detected", () => {
    const s = stackOf({
      "go.mod": "module x\n\nrequire github.com/gin-gonic/gin v1.9.1\n",
      "main.go": 'package main\n\nimport (\n\t"net/http"\n\t"github.com/gin-gonic/gin"\n)\n',
    });
    expect(s.frameworks).toEqual(["Gin"]);
    expect(s.libraries).not.toContain("net/http");
  });

  it("ignores a framework that is only an // indirect requirement", () => {
    const s = stackOf({
      "go.mod": "module x\n\nrequire (\n\tgithub.com/go-chi/chi/v5 v5.0.0\n)\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1 // indirect\n)\n",
      "main.go": "package main\n",
    });
    expect(s.frameworks).toEqual(["chi"]);
  });

  it("ignores an indirect single-line require too", () => {
    const s = stackOf({ "go.mod": "module x\n\nrequire github.com/labstack/echo/v4 v4.11.0 // indirect\n", "main.go": "package main\n" });
    expect(s.frameworks).toEqual([]);
  });
});

describe("rails: scope symbols, parenthesised verbs, match via:, singularize", () => {
  const rails = (body: string): string[] => sig(routesOf(railsAdapter, { "config/routes.rb": `Rails.application.routes.draw do\n${body}\nend\n` }));

  it("scope :admin sets the path from the symbol", () => {
    expect(rails('  scope :admin do\n    get "stats", to: "admin#stats"\n  end')).toEqual(["GET /admin/stats"]);
  });

  it("scope :v1, module: ... still uses the symbol as path", () => {
    expect(rails('  scope :v1, module: "api" do\n    get "ping", to: "p#p"\n  end')).toEqual(["GET /v1/ping"]);
  });

  it("scope module: / as: add no path segment", () => {
    expect(rails('  scope module: "admin" do\n    get "a", to: "x#a"\n  end\n  scope as: "staff" do\n    get "b", to: "x#b"\n  end')).toEqual([
      "GET /a",
      "GET /b",
    ]);
  });

  it("detects verbs written with parentheses", () => {
    expect(rails('  get("/y", to: "a#b")\n  post(:z, to: "a#c")')).toEqual(["GET /y", "POST /z"]);
  });

  it("expands match ... via: into one route per method", () => {
    expect(rails('  match "/z", to: "a#b", via: [:get, :post]\n  match("/w", to: "a#c", via: :patch)\n  match "/all", to: "a#d", via: :all')).toEqual([
      "* /all",
      "GET /z",
      "PATCH /w",
      "POST /z",
    ]);
  });

  it("ignores a match without via: and a method call on a receiver", () => {
    expect(rails('  match "/legacy", to: "a#b"\n  constraints(lambda { |req| req.get("/x") }) do\n    get "ok", to: "a#b"\n  end')).toEqual(["GET /ok"]);
  });

  it("singularizes -sses, -uses, -xes and irregular plurals for nested params", () => {
    const nest = (parent: string, child: string) => `  resources :${parent}, only: [] do\n    resources :${child}, only: :index\n  end`;
    expect(
      rails([nest("addresses", "notes"), nest("statuses", "likes"), nest("boxes", "items"), nest("categories", "posts"), nest("people", "pets")].join("\n")),
    ).toEqual([
      "GET /addresses/:address_id/notes",
      "GET /boxes/:box_id/items",
      "GET /categories/:category_id/posts",
      "GET /people/:person_id/pets",
      "GET /statuses/:status_id/likes",
    ]);
  });
});

describe("fastapi / flask: routers mounted more than once", () => {
  it("fastapi: a router included under two prefixes yields both", () => {
    const routes = routesOf(fastapiAdapter, {
      "app/users.py": 'from fastapi import APIRouter\nrouter = APIRouter(prefix="/users")\n\n@router.get("/me")\ndef me(): ...\n',
      "app/main.py":
        'from fastapi import FastAPI\nfrom app.users import router\napp = FastAPI()\napp.include_router(router, prefix="/v1")\napp.include_router(router, prefix="/v2")\n',
    });
    expect(sig(routes)).toEqual(["GET /v1/users/me", "GET /v2/users/me"]);
  });

  it("fastapi: a twice-mounted parent multiplies into its child's routes", () => {
    const routes = routesOf(fastapiAdapter, {
      "main.py":
        'from fastapi import FastAPI, APIRouter\napp = FastAPI()\napi = APIRouter()\nitems = APIRouter(prefix="/items")\n\n@items.get("/")\ndef ls(): ...\n\napi.include_router(items)\napp.include_router(api, prefix="/v1")\napp.include_router(api, prefix="/v2")\n',
    });
    expect(sig(routes)).toEqual(["GET /v1/items", "GET /v2/items"]);
  });

  it("fastapi: @app.api_route without methods= defaults to GET", () => {
    const routes = routesOf(fastapiAdapter, {
      "main.py":
        'from fastapi import FastAPI\napp = FastAPI()\n\n@app.api_route("/x")\ndef x(): ...\n\n@app.api_route("/y", methods=["POST", "PUT"])\ndef y(): ...\n',
    });
    expect(sig(routes)).toEqual(["GET /x", "POST /y", "PUT /y"]);
  });

  it("flask: a blueprint registered under two prefixes yields both", () => {
    const routes = routesOf(flaskAdapter, {
      "app.py":
        'from flask import Flask, Blueprint\napp = Flask(__name__)\nbp = Blueprint("bp", __name__, url_prefix="/bp")\n\n@bp.route("/ping")\ndef ping():\n    return "ok"\n\napp.register_blueprint(bp, url_prefix="/v1")\napp.register_blueprint(bp, url_prefix="/v2", name="bp2")\n',
    });
    expect(sig(routes)).toEqual(["GET /v1/ping", "GET /v2/ping"]);
  });

  it("flask: a single registration keeps its one prefix", () => {
    const routes = routesOf(flaskAdapter, {
      "app.py":
        'from flask import Flask, Blueprint\napp = Flask(__name__)\nbp = Blueprint("bp", __name__, url_prefix="/bp")\n\n@bp.get("/ping")\ndef ping():\n    return "ok"\n\napp.register_blueprint(bp)\n',
    });
    expect(sig(routes)).toEqual(["GET /bp/ping"]);
  });
});

describe("pythonImportAliases: backslash continuation", () => {
  it("imports every name of a continued from-import", () => {
    const aliases = pythonImportAliases("from c import d, \\\n    e as f, \\\n    g\nh = 1\n");
    expect([...aliases.entries()]).toEqual([
      ["d", "c::d"],
      ["f", "c::e"],
      ["g", "c::g"],
    ]);
  });

  it("resolves a router imported on a continuation line", () => {
    const routes = routesOf(fastapiAdapter, {
      "app/routes.py": 'from fastapi import APIRouter\nother = APIRouter()\nusers = APIRouter(prefix="/users")\n\n@users.get("/me")\ndef me(): ...\n',
      "app/main.py": 'from fastapi import FastAPI\nfrom app.routes import other, \\\n    users\napp = FastAPI()\napp.include_router(users, prefix="/api")\n',
    });
    expect(sig(routes)).toEqual(["GET /api/users/me"]);
  });
});
