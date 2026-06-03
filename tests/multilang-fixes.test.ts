import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { analyze } from "../src/analyze.js";
import { checkOutput } from "../src/check.js";
import { validatePlanConsistency } from "../src/scratch.js";
import { demoteHeadings } from "../src/prd/bundle.js";
import type { Inventory, Options, RouteInfo, ScratchPlan } from "../src/types.js";

function tempRepo(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "recon-fix-"));
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
    standalone: false,
    scratch: false,
    plan: "",
    tdd: false,
    check: false,
  };
}
const inv = (files: Record<string, string>): Inventory => analyze(opts(tempRepo(files)));
const hasM = (routes: RouteInfo[], method: string, route: string): boolean =>
  routes.some((r) => r.route === route && r.method === method);

// ---------------------------------------------------------------------------
describe("HTTP method is preserved (engine-wide)", () => {
  it("Express keeps the verb and distinguishes GET/POST on one path", () => {
    const r = inv({
      "package.json": JSON.stringify({ dependencies: { express: "^4" } }),
      "index.js": `const express=require('express');const app=express();
app.get('/items',(q,s)=>{});app.post('/items',(q,s)=>{});app.listen(3000);`,
    }).routes;
    expect(hasM(r, "GET", "/items")).toBe(true);
    expect(hasM(r, "POST", "/items")).toBe(true);
  });

  it("Express resolves a same-file router mount prefix", () => {
    const r = inv({
      "package.json": JSON.stringify({ dependencies: { express: "^4" } }),
      "index.js": `const express=require('express');const app=express();
const api=express.Router();api.get('/users',(q,s)=>{});app.use('/v1',api);app.listen(3000);`,
    }).routes;
    expect(hasM(r, "GET", "/v1/users")).toBe(true);
  });

  it("Express parses router.route().get().post() chaining", () => {
    const r = inv({
      "package.json": JSON.stringify({ dependencies: { express: "^4" } }),
      "index.js": `const express=require('express');const app=express();
app.route('/books').get((q,s)=>{}).post((q,s)=>{});app.listen(3000);`,
    }).routes;
    expect(hasM(r, "GET", "/books")).toBe(true);
    expect(hasM(r, "POST", "/books")).toBe(true);
  });

  it("NestJS expands array paths and applies a global prefix; keeps the verb", () => {
    const r = inv({
      "package.json": JSON.stringify({ dependencies: { "@nestjs/core": "^10" } }),
      "src/main.ts": `import {NestFactory} from '@nestjs/core';
async function bootstrap(){const app=await NestFactory.create(AppModule);app.setGlobalPrefix('api');await app.listen(3000);}`,
      "src/cats.controller.ts": `@Controller(['cats','felines'])
export class CatsController{ @Get(':id') one(){} @Post() create(){} }`,
    }).routes;
    expect(hasM(r, "GET", "/api/cats/:id")).toBe(true);
    expect(hasM(r, "GET", "/api/felines/:id")).toBe(true);
    expect(hasM(r, "POST", "/api/cats")).toBe(true);
    // array path must never collapse to a bogus "/"
    expect(r.some((x) => x.route === "/")).toBe(false);
  });
});

describe("Flask adapter (constructor prefix, add_url_rule, methods)", () => {
  it("honors a url_prefix set on the Blueprint(...) constructor", () => {
    const r = inv({
      "requirements.txt": "flask\n",
      "app.py": `from flask import Blueprint
bp = Blueprint('pets', __name__, url_prefix='/pets')
@bp.get('/')
def list_pets(): ...
@bp.post('/')
def create_pet(): ...`,
    }).routes;
    expect(hasM(r, "GET", "/pets")).toBe(true);
    expect(hasM(r, "POST", "/pets")).toBe(true);
  });
});

describe("FastAPI adapter (module.router include, methods)", () => {
  it("applies the mount prefix for the module-attribute include form", () => {
    const r = inv({
      "requirements.txt": "fastapi\n",
      "main.py": `from fastapi import FastAPI
import users
app = FastAPI()
app.include_router(users.router, prefix='/api')`,
      "users.py": `from fastapi import APIRouter
router = APIRouter()
@router.get('/users')
def list_users(): ...
@router.post('/users')
def create_user(): ...`,
    }).routes;
    expect(hasM(r, "GET", "/api/users")).toBe(true);
    expect(hasM(r, "POST", "/api/users")).toBe(true);
  });
});

describe("Django adapter (transitive include, DRF, kind)", () => {
  it("composes nested include() prefixes and classes DRF routes as api", () => {
    const r = inv({
      "requirements.txt": "django\ndjangorestframework\n",
      "config/urls.py": `from django.urls import path, include
urlpatterns = [ path('api/', include('apiapp.urls')) ]`,
      "apiapp/urls.py": `from rest_framework import routers
from django.urls import path, include
router = routers.DefaultRouter()
router.register(r'users', UserViewSet)
urlpatterns = [ path('', include(router.urls)) ]`,
    }).routes;
    expect(hasM(r, "GET", "/api/users")).toBe(true); // list
    expect(hasM(r, "POST", "/api/users")).toBe(true); // create
    expect(hasM(r, "DELETE", "/api/users/<pk>")).toBe(true); // destroy
    expect(r.find((x) => x.route === "/api/users")?.kind).toBe("api");
  });
});

describe("Rails adapter (nesting, member/collection, singular, method, kind)", () => {
  const r = inv({
    Gemfile: "gem 'rails'\n",
    "config/routes.rb": `Rails.application.routes.draw do
  resources :magazines do
    resources :ads
    member do
      get :preview
    end
    collection do
      get :search
    end
  end
  resource :profile
  namespace :api do
    resources :sessions, only: [:create]
  end
end`,
  }).routes;

  it("nests child resources under the parent member prefix", () => {
    expect(hasM(r, "GET", "/magazines/:magazine_id/ads")).toBe(true);
  });
  it("resolves member and collection custom actions", () => {
    expect(hasM(r, "GET", "/magazines/:id/preview")).toBe(true);
    expect(hasM(r, "GET", "/magazines/search")).toBe(true);
  });
  it("expands a singular resource (no :id, no index)", () => {
    expect(hasM(r, "GET", "/profile")).toBe(true);
    expect(hasM(r, "GET", "/profile/edit")).toBe(true);
  });
  it("distinguishes the 7 RESTful actions by HTTP method", () => {
    expect(hasM(r, "POST", "/api/sessions")).toBe(true);
    expect(r.find((x) => x.route === "/api/sessions")?.kind).toBe("api");
  });
});

describe("Go adapter (chi closures, net/http, verb-as-argument)", () => {
  it("composes chi r.Route closure prefixes and keeps verbs", () => {
    const r = inv({
      "go.mod": "module x\nrequire github.com/go-chi/chi/v5 v5.0.0\n",
      "main.go": `package main
func main(){ r := chi.NewRouter()
  r.Route("/api", func(r chi.Router){
    r.Get("/users", h)
    r.Post("/users", h)
  })
}`,
    }).routes;
    expect(hasM(r, "GET", "/api/users")).toBe(true);
    expect(hasM(r, "POST", "/api/users")).toBe(true);
  });

  it("detects net/http HandleFunc with a Go 1.22 method-in-pattern", () => {
    const r = inv({
      "go.mod": "module x\n",
      "main.go": `package main
func main(){ mux := http.NewServeMux()
  mux.HandleFunc("GET /health", h)
}`,
    });
    // net/http has no framework label, so routes aren't resolved — but the file
    // must be surfaced as a route candidate so the agent can recover it.
    expect(r.hints.routeCandidates).toContain("main.go");
  });
});

describe("Next.js adapter (intercepting markers, monorepo, route methods)", () => {
  it("strips intercepting-route markers and resolves a monorepo app dir", () => {
    const r = inv({
      "package.json": JSON.stringify({ dependencies: { next: "^14" } }),
      "apps/web/app/feed/(.)photo/page.tsx": "export default function P(){}",
      "apps/web/app/api/health/route.ts": "export async function GET(){}\nexport async function POST(){}",
    }).routes;
    expect(r.some((x) => x.route === "/feed/photo" && x.kind === "page")).toBe(true);
    expect(hasM(r, "GET", "/api/health")).toBe(true);
    expect(hasM(r, "POST", "/api/health")).toBe(true);
  });
});

describe("candidate hints never go blind (stacks without a route adapter)", () => {
  it("surfaces a Laravel routes file and detects the stack", () => {
    const i = inv({
      "composer.json": JSON.stringify({ require: { "laravel/framework": "^11" } }),
      "routes/web.php": `<?php
Route::get('/users', 'UserController@index');
Route::resource('posts', 'PostController');`,
    });
    expect(i.stack.frameworks).toContain("Laravel");
    expect(i.stack.packageManagers).toContain("composer");
    expect(i.hints.routeCandidates).toContain("routes/web.php");
  });

  it("surfaces a Spring controller and detects Spring Boot", () => {
    const i = inv({
      "pom.xml": `<project><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies></project>`,
      "src/main/java/com/x/UserController.java": `@RestController
@RequestMapping("/api")
public class UserController { @GetMapping("/users") public List users(){return null;} }`,
    });
    expect(i.stack.frameworks).toContain("Spring Boot");
    expect(i.hints.routeCandidates).toContain("src/main/java/com/x/UserController.java");
  });

  it("surfaces an axum Rust route file and its entry point", () => {
    const i = inv({
      "Cargo.toml": "[dependencies]\naxum = \"0.7\"\n",
      "src/main.rs": `fn main(){ let app = Router::new().route("/users", get(list)); }`,
    });
    expect(i.stack.primaryLanguage).toBe("Rust");
    expect(i.hints.routeCandidates).toContain("src/main.rs");
    expect(i.hints.entryPoints).toContain("src/main.rs");
  });

  it("surfaces a flask-restful Resource registration", () => {
    const i = inv({
      "requirements.txt": "flask\nflask-restful\n",
      "app.py": `from flask_restful import Api, Resource
class TodoList(Resource):
    def get(self): ...
api = Api(app)
api.add_resource(TodoList, '/todos')`,
    });
    expect(i.hints.routeCandidates).toContain("app.py");
  });
});

describe("detection gaps", () => {
  it("detects Flutter from pubspec.yaml with deps + entry point", () => {
    const i = inv({
      "pubspec.yaml": `name: demo
environment:
  sdk: ">=3.0.0"
dependencies:
  flutter:
    sdk: flutter
  http: ^1.0.0
dev_dependencies:
  flutter_test:
    sdk: flutter`,
      "lib/main.dart": `void main(){}`,
    });
    expect(i.stack.frameworks).toContain("Flutter");
    expect(i.stack.packageManagers).toContain("pub");
    expect(i.hints.entryPoints).toContain("lib/main.dart");
    const pub = i.dependencies.find((d) => d.manager === "pub");
    expect(pub?.runtime).toHaveProperty("http");
  });

  it("recognizes the modern text bun.lock as bun", () => {
    const i = inv({ "package.json": JSON.stringify({ name: "x" }), "bun.lock": "{}" });
    expect(i.stack.packageManagers).toContain("bun");
  });

  it("still reports a package manager when package.json is malformed but a lockfile exists", () => {
    const i = inv({ "package.json": "{ not json", "pnpm-lock.yaml": "lockfileVersion: 9\n" });
    expect(i.stack.packageManagers).toContain("pnpm");
  });

  it("keeps a 3-letter BCP-47 locale and sums namespaced keys per locale", () => {
    const i = inv({
      "package.json": JSON.stringify({ dependencies: { "react-i18next": "^14" } }),
      "locales/fil/common.json": JSON.stringify({ a: "1", b: "2" }),
      "locales/fil/auth.json": JSON.stringify({ c: "3" }),
      "locales/en/common.json": JSON.stringify({ a: "1", b: "2" }),
      "locales/en/auth.json": JSON.stringify({ c: "3" }),
    });
    expect(i.i18n?.locales).toContain("fil");
    expect(i.i18n?.locales).not.toContain("common"); // namespace filename never a locale
    expect(i.i18n?.keyCount).toBe(3); // 2 (common) + 1 (auth) summed within a locale
  });
});

describe("check gate hardening", () => {
  function tree(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), "recon-chk-"));
    const base: Record<string, string> = {
      "inventory.json": JSON.stringify({
        generatedWith: "reconstruct@0.6.3",
        repoName: "demo",
        features: [{ slug: "01-core", name: "Core" }],
        i18n: null,
      }),
      "REBUILD.md": "# REBUILD\n",
      "00-overview/PRD.md": "# Overview\n",
      "architecture/ARCHITECTURE.md": "# Architecture\nDescribed.\n",
      "architecture/INTERFACES.md": "# Interfaces\n- auth.login\n",
      "architecture/DATA-MODEL.md": "# Data model\n### users\n",
      "features/01-core/PRD.md":
        "# Core\n## Functional requirements\nFR1 the system does X.\n## Acceptance criteria\nGiven/When/Then.\n## Definition of done\n- [ ] done\n",
      ...files,
    };
    for (const [rel, content] of Object.entries(base)) {
      const dest = join(dir, rel);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, content, "utf8");
    }
    return dir;
  }

  it("does not let the scaffold's Setting|Value meta table satisfy the substance gate", () => {
    const { errors } = checkOutput(
      tree({
        "architecture/DATA-MODEL.md":
          "# Data model\n\n| Setting | Value |\n| --- | --- |\n| Mode | `preserve` |\n| Level | `light` |\n| Fidelity | `mirror` |\n| Generated with | `reconstruct@0.6.3` |\n\n_no entities yet_\n",
      }),
    );
    expect(errors.join("\n")).toMatch(/DATA-MODEL\.md/);
    expect(errors.join("\n")).toMatch(/entit|empty/i);
  });

  it("fails a feature PRD whose spine section is an empty heading", () => {
    const { errors } = checkOutput(
      tree({
        "features/01-core/PRD.md":
          "# Core\n## Functional requirements\n## Acceptance criteria\nGiven/When/Then.\n## Definition of done\n- [ ] done\n",
      }),
    );
    expect(errors.join("\n")).toMatch(/Functional requirements/);
    expect(errors.join("\n")).toMatch(/no content/i);
  });

  it("does not false-fail a 🧠 / placeholder quoted with curly quotes", () => {
    const { errors } = checkOutput(
      tree({
        "features/01-core/PRD.md":
          "# Core\n## Functional requirements\nThe gate rejects a leftover “🧠” callout or a “fill this in” phrase. (FR1)\n## Acceptance criteria\nGiven/When/Then.\n## Definition of done\n- [ ] done\n",
      }),
    );
    expect(errors).toEqual([]);
  });
});

describe("scratch plan consistency (FK / writes / duplicates)", () => {
  const base: ScratchPlan = {
    project: { name: "x", summary: "s" },
    stack: { primaryLanguage: "TypeScript" },
    features: [{ name: "F", entities: ["User"] }],
    dataModel: [{ entity: "User", fields: [] }],
    interfaces: [],
  };

  it("errors on a foreign key to an undefined table", () => {
    const plan: ScratchPlan = {
      ...base,
      dataModel: [{ entity: "Post", fields: [{ name: "authorId", type: "string", constraints: "not null -> users" }] }],
      features: [{ name: "F", entities: ["Post"] }],
    };
    expect(validatePlanConsistency(plan).errors.join("\n")).toMatch(/foreign key to undefined table `users`/);
  });

  it("errors on a duplicate entity name", () => {
    const plan: ScratchPlan = {
      ...base,
      dataModel: [{ entity: "User", fields: [] }, { entity: "User", fields: [] }],
    };
    expect(validatePlanConsistency(plan).errors.join("\n")).toMatch(/User.*more than once/);
  });

  it("warns when a feature writes an entity not in its entities list", () => {
    const plan: ScratchPlan = {
      ...base,
      features: [{ name: "F", entities: ["User"], writes: ["User"] }],
      dataModel: [{ entity: "User", fields: [] }],
    };
    const ok = validatePlanConsistency(plan);
    expect(ok.warnings.join("\n")).not.toMatch(/subset/);
    const bad: ScratchPlan = {
      ...base,
      features: [{ name: "F", entities: [], writes: ["User"] }],
    };
    expect(validatePlanConsistency(bad).warnings.join("\n")).toMatch(/subset of entities/);
  });
});

describe("bundle heading demotion", () => {
  it("demotes a setext H1 so the bundle keeps a single top-level H1", () => {
    const out = demoteHeadings("Title\n=====\n\nbody\n");
    expect(out).toContain("## Title");
    expect(out).not.toMatch(/^=+$/m);
  });

  it("passes YAML front matter through without demoting a # comment inside it", () => {
    const out = demoteHeadings("---\n# a yaml comment\ntitle: x\n---\n\n# Heading\n");
    expect(out).toContain("# a yaml comment"); // untouched in front matter
    expect(out).toContain("## Heading"); // real heading demoted
  });
});
