import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, extname } from "node:path";
import { nextjsAdapter } from "../src/adapters/nextjs.js";
import { nestjsAdapter } from "../src/adapters/nestjs.js";
import { trpcAdapter } from "../src/adapters/trpc.js";
import { detectI18n } from "../src/adapters/i18n.js";
import type { FileCategory, FileInfo, RouteInfo } from "../src/types.js";

/** Write `files` into a fresh temp repo and return it with its FileInfo list. */
function repoOf(files: Record<string, string>, category: FileCategory = "code"): { repo: string; infos: FileInfo[] } {
  const repo = mkdtempSync(join(tmpdir(), "recon-nnti-"));
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

// ---------------------------------------------------------------------------
describe("nextjs: route-handler exports", () => {
  it("export { handler as GET, handler as POST } (NextAuth) yields GET and POST with the export line", () => {
    const routes = routesOf(nextjsAdapter, {
      "app/api/auth/[...nextauth]/route.ts":
        'import NextAuth from "next-auth";\nconst handler = NextAuth({});\n\nexport { handler as GET, handler as POST };\n',
    });
    expect(sig(routes)).toEqual(["GET /api/auth/[...nextauth]", "POST /api/auth/[...nextauth]"]);
    for (const r of routes) expect(r.line).toBe(4);
  });

  it("export const / export async function / typed const each report their own line", () => {
    const routes = routesOf(nextjsAdapter, {
      "app/api/items/route.ts": [
        "export const GET = async () => Response.json([]);",
        "export async function POST(req: Request) { return new Response(null); }",
        'export const DELETE: (r: Request) => Response = () => new Response("");',
        "export function helper() {}",
      ].join("\n"),
    });
    expect(sig(routes)).toEqual(["DELETE /api/items", "GET /api/items", "POST /api/items"]);
    const line = (m: string) => routes.find((r) => r.method === m)?.line;
    expect([line("GET"), line("POST"), line("DELETE")]).toEqual([1, 2, 3]);
  });

  it("re-exports `export { GET, POST } from` and NextAuth v5 `export const { GET, POST } = handlers`", () => {
    const routes = routesOf(nextjsAdapter, {
      "app/api/a/route.ts": 'export { GET, POST } from "./impl";\n',
      "app/api/b/route.ts": 'import { handlers } from "@/auth";\nexport const { GET, POST } = handlers;\n',
    });
    expect(sig(routes)).toEqual(["GET /api/a", "GET /api/b", "POST /api/a", "POST /api/b"]);
    expect(routes.find((r) => r.route === "/api/b")?.line).toBe(2);
  });

  it("a commented-out handler is not a method", () => {
    const routes = routesOf(nextjsAdapter, {
      "app/api/x/route.ts": "// export async function DELETE() {}\nexport async function GET() {}\n",
    });
    expect(sig(routes)).toEqual(["GET /api/x"]);
  });
});

describe("nextjs: non-routable app segments", () => {
  it("excludes private `_folder` segments, strips groups, slots and interceptors", () => {
    const routes = routesOf(nextjsAdapter, {
      "app/_components/page.tsx": "export default function P() {}",
      "app/dashboard/_lib/route.ts": "export async function GET() {}",
      "app/(marketing)/about/page.tsx": "export default function P() {}",
      "app/dashboard/@analytics/page.tsx": "export default function P() {}",
      "app/feed/(.)photo/[id]/page.tsx": "export default function P() {}",
      "app/%5Fescaped/page.tsx": "export default function P() {}",
    });
    const pages = routes.filter((r) => r.kind === "page").map((r) => r.route);
    expect(pages.sort()).toEqual(["/_escaped", "/about", "/dashboard", "/feed/photo/[id]"]);
    expect(routes.some((r) => r.file.includes("_components") || r.file.includes("_lib"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("nestjs: setGlobalPrefix scope", () => {
  const ctrl = (base: string) => `import { Controller, Get } from "@nestjs/common";\n@Controller("${base}")\nexport class C {\n  @Get()\n  list() {}\n}\n`;

  it("applies each app's global prefix only to controllers in that app", () => {
    const routes = routesOf(nestjsAdapter, {
      "apps/api/src/main.ts": 'const app = await NestFactory.create(AppModule);\napp.setGlobalPrefix("api");\n',
      "apps/api/src/users/users.controller.ts": ctrl("users"),
      "apps/admin/src/main.ts": 'app.setGlobalPrefix("admin/v1");\n',
      "apps/admin/src/stats.controller.ts": ctrl("stats"),
      "apps/worker/src/main.ts": "await app.listen(3000);\n",
      "apps/worker/src/jobs.controller.ts": ctrl("jobs"),
    });
    expect(sig(routes)).toEqual(["GET /admin/v1/stats", "GET /api/users", "GET /jobs"]);
    expect(routes.find((r) => r.route === "/api/users")?.line).toBe(4);
  });

  it("a root-level bootstrap prefixes every controller; exclude options are honoured", () => {
    const routes = routesOf(nestjsAdapter, {
      "src/main.ts": 'app.setGlobalPrefix("api", { exclude: ["health", { path: "metrics", method: RequestMethod.GET }] });\n',
      "src/health.controller.ts": ctrl("health"),
      "src/metrics.controller.ts": ctrl("metrics"),
      "src/users.controller.ts": ctrl("users"),
    });
    expect(sig(routes)).toEqual(["GET /api/users", "GET /health", "GET /metrics"]);
  });

  it("a prefix set in a bootstrap helper still governs its whole app", () => {
    const routes = routesOf(nestjsAdapter, {
      "src/config/setup.ts": 'export function setup(app) {\n  app.setGlobalPrefix("api");\n}\n',
      "src/users/users.controller.ts": ctrl("users"),
    });
    expect(sig(routes)).toEqual(["GET /api/users"]);
  });
});

// ---------------------------------------------------------------------------
describe("trpc: router bodies survive quotes in comments and regex literals", () => {
  it("an apostrophe in a comment inside the router keeps every procedure", () => {
    const routes = routesOf(trpcAdapter, {
      "server/root.ts": [
        "export const appRouter = createTRPCRouter({",
        "  // don't drop the next procedures",
        "  list: publicProcedure.query(() => []),",
        "  /* it's fine */",
        "  create: publicProcedure.mutation(() => 1),",
        "});",
      ].join("\n"),
    });
    expect(sig(routes)).toEqual(["MUTATION create", "QUERY list"]);
    expect(routes.find((r) => r.route === "list")?.line).toBe(3);
    expect(routes.find((r) => r.route === "create")?.line).toBe(5);
  });

  it("regex literals containing quotes do not open a string", () => {
    const routes = routesOf(trpcAdapter, {
      "server/root.ts": [
        "export const appRouter = createTRPCRouter({",
        "  bySlug: publicProcedure.input(z.string().regex(/'/)).query(() => 1),",
        '  byName: publicProcedure.input(z.string().regex(/"[a-z]+/i)).query(() => 2),',
        "  ratio: publicProcedure.query(() => 4 / 2),",
        "  nested: createTRPCRouter({",
        "    clean: publicProcedure.input(z.string().regex(/[`}]/)).mutation(() => 3),",
        "    tail: publicProcedure.subscription(() => 0),",
        "  }),",
        "});",
      ].join("\n"),
    });
    expect(sig(routes)).toEqual(["MUTATION nested.clean", "QUERY byName", "QUERY bySlug", "QUERY ratio", "SUBSCRIPTION nested.tail"]);
    expect(routes.find((r) => r.route === "nested.tail")?.line).toBe(7);
  });
});

// ---------------------------------------------------------------------------
describe("i18n: namespace files are not locales", () => {
  it("locales/<locale>/<namespace>.json: locale is the directory, keys summed per locale", () => {
    const { repo, infos } = repoOf(
      {
        "locales/en/app.json": JSON.stringify({ a: 1, b: 2 }),
        "locales/en/ui.json": JSON.stringify({ c: 1 }),
        "locales/fr/app.json": JSON.stringify({ a: 1 }),
        "locales/fr/ui.json": JSON.stringify({ c: 1 }),
      },
      "i18n",
    );
    const info = detectI18n(repo, infos);
    expect(info?.locales).toEqual(["en", "fr"]);
    expect(info?.keyCount).toBe(3);
  });

  it("flat messages/<locale>.json keeps working", () => {
    const { repo, infos } = repoOf({ "messages/en.json": '{"a":1,"b":{"c":2}}', "messages/pt-BR.json": '{"a":1}' }, "i18n");
    const info = detectI18n(repo, infos);
    expect(info?.locales).toEqual(["en", "pt-BR"]);
    expect(info?.keyCount).toBe(2);
  });

  it("locales/<namespace>/<locale>.json: a known language code wins over a namespace dir", () => {
    const { repo, infos } = repoOf({ "locales/common/en.json": '{"a":1}', "locales/common/fr.json": '{"a":1}', "locales/app/de.json": '{"a":1}' }, "i18n");
    expect(detectI18n(repo, infos)?.locales).toEqual(["de", "en", "fr"]);
  });
});
