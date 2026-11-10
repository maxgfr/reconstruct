import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { goAdapter } from "../src/adapters/go.js";
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
