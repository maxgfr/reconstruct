import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { djangoAdapter } from "../src/adapters/django.js";
import { dotnetAdapter } from "../src/adapters/dotnet.js";
import { detectI18n } from "../src/adapters/i18n.js";
import { railsAdapter } from "../src/adapters/rails.js";
import { nextjsAdapter } from "../src/adapters/nextjs.js";
import { trpcAdapter } from "../src/adapters/trpc.js";
import type { FileCategory, FileInfo, RouteInfo } from "../src/types.js";

// Regression tests for route/dependency extraction misses found by the audit.

function repoOf(files: Record<string, string>, category: FileCategory = "code"): { repo: string; infos: FileInfo[] } {
  const repo = mkdtempSync(join(tmpdir(), "recon-audit-"));
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

describe("trpc: child routers imported under an alias", () => {
  it("import { userRouter as u } mounts the child under its key, not at the root", () => {
    const routes = routesOf(trpcAdapter, {
      "server/user.ts": "export const userRouter = createTRPCRouter({ list: publicProcedure.query(() => []) });\n",
      "server/root.ts": 'import { userRouter as u } from "./user";\nexport const appRouter = createTRPCRouter({ user: u });\n',
    });
    expect(sig(routes)).toEqual(["QUERY user.list"]);
  });
});

describe("trpc: CommonJS renamed destructuring", () => {
  it("const { userRouter: u } = require('./user') resolves to the exported router", () => {
    const routes = routesOf(trpcAdapter, {
      "server/user.js": "const userRouter = t.router({ list: publicProcedure.query(() => []) });\nmodule.exports = { userRouter };\n",
      "server/root.js": 'const { userRouter: u } = require("./user");\nconst appRouter = t.router({ user: u });\n',
    });
    expect(sig(routes)).toEqual(["QUERY user.list"]);
  });
});

describe("trpc: the documented `export const router = t.router` factory", () => {
  it("finds routers built with the bare router({...}) alias, same-file and imported", () => {
    const routes = routesOf(trpcAdapter, {
      "server/trpc.ts": "const t = initTRPC.create();\nexport const router = t.router;\nexport const publicProcedure = t.procedure;\n",
      "server/routers/user.ts":
        'import { router, publicProcedure } from "../trpc";\nexport const userRouter = router({ byId: publicProcedure.query(() => 1) });\n',
      "server/routers/_app.ts":
        'import { router, publicProcedure } from "../trpc";\nimport { userRouter } from "./user";\nexport const appRouter = router({ hello: publicProcedure.query(() => 1), user: userRouter, admin: router({ ping: publicProcedure.mutation(() => 1) }) });\n',
    });
    expect(sig(routes)).toEqual(["MUTATION admin.ping", "QUERY hello", "QUERY user.byId"]);
  });

  it("does not treat an unrelated router(...) call as a tRPC router", () => {
    const routes = routesOf(trpcAdapter, {
      "src/app.ts": 'import { router } from "./express-helpers";\nexport const r = router({ hello: something.query(() => 1) });\n',
      "src/express-helpers.ts": "export function router(o) { return o; }\n",
    });
    expect(routes).toEqual([]);
  });
});

describe("django: inline include([...]) lists", () => {
  it("prefixes the path() entries of an inline include, nested ones included", () => {
    const routes = routesOf(djangoAdapter, {
      "mysite/urls.py": [
        "from django.urls import include, path",
        "from . import views",
        "urlpatterns = [",
        '    path("", views.home),',
        '    path("api/", include([',
        '        path("users/", views.users),',
        '        path("v1/", include([path("items/", views.items)])),',
        "    ])),",
        '    path("about/", views.about),',
        "]",
      ].join("\n"),
    });
    expect(routes.map((r) => r.route).sort()).toEqual(["/", "/about", "/api/users", "/api/v1/items"]);
  });
});

describe("rails: routes.rb forms the adapter missed", () => {
  const rails = (body: string) => routesOf(railsAdapter, { "config/routes.rb": `Rails.application.routes.draw do\n${body}\nend\n` });

  it("expands every resource of a multi-resource line", () => {
    expect(sig(rails("  resources :photos, :books, only: [:index]"))).toEqual(["GET /books", "GET /photos"]);
  });

  it("honours on: :member / on: :collection on a verb inside resources", () => {
    const routes = rails(
      ["  resources :photos, only: [] do", "    get :preview, on: :member", "    get :search, on: :collection", "    get :stats", "  end"].join("\n"),
    );
    expect(sig(routes)).toEqual(["GET /photos/:id/preview", "GET /photos/:photo_id/stats", "GET /photos/search"]);
  });

  it("detects mount with a dotted app and the parenthesised at: form", () => {
    const routes = rails(['  mount ActionCable.server => "/cable"', '  mount(Sidekiq::Web, at: "/sidekiq")', '  mount Blog::Engine, at: "/blog"'].join("\n"));
    expect(routes.map((r) => r.route).sort()).toEqual(["/blog", "/cable", "/sidekiq"]);
  });
});

describe("i18n: underscore locale tags (en_US, pt_BR)", () => {
  it("takes the locale from an underscore-tagged directory, not the namespace file", () => {
    const { repo, infos } = repoOf({ "locales/pt_BR/app.json": '{"a":1}', "locales/en_US/app.json": '{"a":1}' }, "i18n");
    expect(detectI18n(repo, infos)?.locales).toEqual(["en_US", "pt_BR"]);
  });

  it("takes the locale from an underscore-tagged file name", () => {
    const { repo, infos } = repoOf({ "config/locales/zh_Hant_TW.json": '{"a":1}', "config/locales/en.json": '{"a":1}' }, "i18n");
    expect(detectI18n(repo, infos)?.locales).toEqual(["en", "zh_Hant_TW"]);
  });
});

describe("dotnet: attribute-routed actions in a controller without [Route]", () => {
  it("emits an action's own template and still skips conventionally-routed ones", () => {
    const routes = routesOf(dotnetAdapter, {
      "Controllers/HealthController.cs": [
        "[ApiController]",
        "public class HealthController : ControllerBase",
        "{",
        '    [HttpGet("api/health")]',
        "    public IActionResult Get() => Ok();",
        "",
        "    [HttpPost]",
        "    public IActionResult Conventional() => Ok();",
        "}",
      ].join("\n"),
    });
    expect(sig(routes)).toEqual(["GET /api/health"]);
  });
});

describe("nextjs: pages router index handling", () => {
  it("collapses only index FILES, keeping a directory named index", () => {
    const routes = routesOf(nextjsAdapter, {
      "pages/index.tsx": "export default function H() {}",
      "pages/blog/index.tsx": "export default function B() {}",
      "pages/index/about.tsx": "export default function A() {}",
      "pages/index/index.tsx": "export default function I() {}",
    });
    expect(routes.map((r) => r.route).sort()).toEqual(["/", "/blog", "/index", "/index/about"]);
  });
});
