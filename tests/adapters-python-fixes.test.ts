import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { analyze } from "../src/analyze.js";
import type { Options, RouteInfo } from "../src/types.js";

function tempRepo(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "recon-py-"));
  for (const [rel, content] of Object.entries(files)) {
    const dest = join(dir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content, "utf8");
  }
  return dir;
}

function opts(repo: string): Options {
  return {
    repo,
    out: join(repo, "reconstruction"),
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

const routesOf = (files: Record<string, string>): RouteInfo[] => analyze(opts(tempRepo(files))).routes;
const find = (routes: RouteInfo[], method: string | undefined, route: string): RouteInfo | undefined =>
  routes.find((r) => r.route === route && r.method === method);
const has = (routes: RouteInfo[], method: string | undefined, route: string): boolean => find(routes, method, route) !== undefined;

// ---------------------------------------------------------------------------
describe("FastAPI adapter fixes", () => {
  const itemsRouter = `from fastapi import APIRouter

router = APIRouter(prefix="/items")

@router.get("/{id}")
def read_item(id: int): ...
`;

  it("keeps the include prefix with a relative import", () => {
    const r = routesOf({
      "requirements.txt": "fastapi\n",
      "app/__init__.py": "",
      "app/main.py": `from fastapi import FastAPI
from .routers.items import router

app = FastAPI()
app.include_router(router, prefix="/api")
`,
      "app/routers/__init__.py": "",
      "app/routers/items.py": itemsRouter,
    });
    expect(has(r, "GET", "/api/items/{id}")).toBe(true);
    const route = find(r, "GET", "/api/items/{id}");
    expect(route?.file).toBe("app/routers/items.py");
    expect(route?.line).toBe(5);
  });

  it("keeps the include prefix with a src/ layout", () => {
    const r = routesOf({
      "requirements.txt": "fastapi\n",
      "src/app/__init__.py": "",
      "src/app/main.py": `from fastapi import FastAPI
from app.routers.items import router as items_router

app = FastAPI()
app.include_router(items_router, prefix="/api")
`,
      "src/app/routers/__init__.py": "",
      "src/app/routers/items.py": itemsRouter,
    });
    expect(has(r, "GET", "/api/items/{id}")).toBe(true);
  });

  it("reads the prefix of a type-annotated router and a submodule-attribute include", () => {
    const r = routesOf({
      "requirements.txt": "fastapi\n",
      "app/main.py": `from fastapi import FastAPI
from .routers import items

app = FastAPI()
app.include_router(items.router, prefix="/api")
`,
      "app/routers/items.py": `from fastapi import APIRouter

router: APIRouter = APIRouter(prefix="/items", tags=["items"])

@router.get("/{id}")
def read_item(id: int): ...
`,
    });
    expect(has(r, "GET", "/api/items/{id}")).toBe(true);
  });

  it("reads a keyword path= decorator argument", () => {
    const r = routesOf({
      "requirements.txt": "fastapi\n",
      "main.py": `from fastapi import FastAPI
app = FastAPI()

@app.get(path="/x")
def x(): ...
`,
    });
    expect(has(r, "GET", "/x")).toBe(true);
    expect(find(r, "GET", "/x")?.line).toBe(4);
  });

  it("keeps api_route methods listed after a nested call", () => {
    const r = routesOf({
      "requirements.txt": "fastapi\n",
      "main.py": `from fastapi import APIRouter, Depends
router = APIRouter()

@router.api_route("/x", dependencies=[Depends(f)], methods=["GET", "POST"])
def x(): ...
`,
    });
    expect(has(r, "GET", "/x")).toBe(true);
    expect(has(r, "POST", "/x")).toBe(true);
  });

  it("parses a decorator spread over several lines", () => {
    const r = routesOf({
      "requirements.txt": "fastapi\n",
      "main.py": `from fastapi import FastAPI
app = FastAPI()

@app.post(
    "/items",
    response_model=Item,
    responses={404: {"model": Err}},
)
def create(): ...
`,
    });
    expect(has(r, "POST", "/items")).toBe(true);
    expect(find(r, "POST", "/items")?.line).toBe(4);
  });
});

// ---------------------------------------------------------------------------
describe("Flask adapter fixes", () => {
  it("reads methods= placed after a nested call in @route", () => {
    const r = routesOf({
      "requirements.txt": "flask\n",
      "app.py": `from flask import Flask
app = Flask(__name__)

@app.route("/u", defaults=dict(page=1), methods=["POST"])
def u(page): ...
`,
    });
    expect(has(r, "POST", "/u")).toBe(true);
    expect(has(r, "GET", "/u")).toBe(false);
    expect(find(r, "POST", "/u")?.line).toBe(4);
  });

  it("reads every method of an add_url_rule with an as_view() view_func", () => {
    const r = routesOf({
      "requirements.txt": "flask\n",
      "app.py": `from flask import Flask
app = Flask(__name__)
app.add_url_rule("/u", view_func=UserView.as_view("u"), methods=["GET", "POST"])
`,
    });
    expect(has(r, "GET", "/u")).toBe(true);
    expect(has(r, "POST", "/u")).toBe(true);
    expect(find(r, "POST", "/u")?.line).toBe(3);
  });

  it("keeps the blueprint prefix with a relative import", () => {
    const r = routesOf({
      "requirements.txt": "flask\n",
      "pkg/__init__.py": `from flask import Flask
from .views import bp

app = Flask(__name__)
app.register_blueprint(bp, url_prefix="/admin")
`,
      "pkg/views.py": `from flask import Blueprint
bp = Blueprint("admin", __name__)

@bp.route("/users")
def users(): ...
`,
    });
    expect(has(r, "GET", "/admin/users")).toBe(true);
    expect(find(r, "GET", "/admin/users")?.line).toBe(4);
  });

  it("keeps the blueprint prefix for a module-attribute registration", () => {
    const r = routesOf({
      "requirements.txt": "flask\n",
      "app.py": `from flask import Flask
from routes import users

app = Flask(__name__)
app.register_blueprint(users.bp, url_prefix="/x")
`,
      "routes/users.py": `from flask import Blueprint
bp = Blueprint("users", __name__)

@bp.get("/list")
def list_users(): ...
`,
    });
    expect(has(r, "GET", "/x/list")).toBe(true);
  });

  it("honours a constructor url_prefix after a nested call", () => {
    const r = routesOf({
      "requirements.txt": "flask\n",
      "app.py": `from flask import Flask
from views import bp
app = Flask(__name__)
app.register_blueprint(bp)
`,
      "views.py": `import os
from flask import Blueprint
bp = Blueprint("v", __name__, template_folder=os.path.join("a", "b"), url_prefix="/v")

@bp.route("/a")
def a(): ...
`,
    });
    expect(has(r, "GET", "/v/a")).toBe(true);
  });

  it("gives stacked decorators on one view the same kind", () => {
    const r = routesOf({
      "requirements.txt": "flask\n",
      "views.py": `from flask import Blueprint, render_template
bp = Blueprint("v", __name__)

@bp.route("/a")
@bp.route("/b")
def page():
    return render_template("page.html")

@bp.route("/c")
def api():
    return {"ok": True}
`,
    });
    expect(find(r, "GET", "/a")?.kind).toBe("page");
    expect(find(r, "GET", "/b")?.kind).toBe("page");
    expect(find(r, "GET", "/c")?.kind).toBe("api");
    expect(find(r, "GET", "/a")?.line).toBe(4);
    expect(find(r, "GET", "/b")?.line).toBe(5);
  });
});

// ---------------------------------------------------------------------------
describe("Django adapter fixes", () => {
  const blogUrls = `from django.urls import path
from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("<int:year>/", views.year_archive),
]
`;

  it("resolves include() when the project lives in a subfolder", () => {
    const r = routesOf({
      "requirements.txt": "django\n",
      "backend/mysite/urls.py": `from django.urls import path, include
urlpatterns = [
    path("blog/", include("blog.urls")),
]
`,
      "backend/blog/urls.py": blogUrls,
    });
    expect(has(r, undefined, "/blog")).toBe(true);
    expect(has(r, undefined, "/blog/<int:year>")).toBe(true);
    expect(find(r, undefined, "/blog/<int:year>")?.line).toBe(6);
  });

  it("resolves the tuple form include((module, app_name))", () => {
    const r = routesOf({
      "requirements.txt": "django\n",
      "mysite/urls.py": `from django.urls import path, include
urlpatterns = [
    path("blog/", include(("blog.urls", "blog"), namespace="blog")),
]
`,
      "blog/urls.py": blogUrls,
    });
    expect(has(r, undefined, "/blog/<int:year>")).toBe(true);
  });

  it("resolves include() of an imported urls module object", () => {
    const r = routesOf({
      "requirements.txt": "django\n",
      "mysite/urls.py": `from django.urls import path, include
from blog import urls as blog_urls
urlpatterns = [
    path("blog/", include(blog_urls)),
]
`,
      "blog/urls.py": blogUrls,
    });
    expect(has(r, undefined, "/blog/<int:year>")).toBe(true);
  });

  it("sets the declaration line on DRF router routes", () => {
    const r = routesOf({
      "requirements.txt": "django\ndjangorestframework\n",
      "api/urls.py": `from rest_framework import routers
router = routers.DefaultRouter()
router.register(r"users", UserViewSet)
urlpatterns = []
`,
    });
    expect(find(r, "GET", "/users")?.line).toBe(3);
  });
});
