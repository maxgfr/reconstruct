import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { dotnetAdapter } from "../src/adapters/dotnet.js";
import { expressAdapter } from "../src/adapters/express.js";
import { fastifyAdapter } from "../src/adapters/fastify.js";
import { nestjsAdapter } from "../src/adapters/nestjs.js";
import { trpcAdapter } from "../src/adapters/trpc.js";
import { stripComments } from "../src/adapters/util.js";
import type { FileInfo, RouteInfo } from "../src/types.js";

// Regression tests for route-extraction gaps in the JS-family and ASP.NET adapters.

function repoOf(files: Record<string, string>): { repo: string; infos: FileInfo[] } {
  const repo = mkdtempSync(join(tmpdir(), "recon-js-gaps-"));
  const infos: FileInfo[] = [];
  for (const [rel, content] of Object.entries(files)) {
    const dest = join(repo, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content, "utf8");
    infos.push({ path: rel, ext: extname(rel), size: 0, lines: content.split("\n").length, category: "code", binary: false });
  }
  return { repo, infos };
}
const routesOf = (adapter: { detectRoutes(f: FileInfo[], r: string): RouteInfo[] }, files: Record<string, string>): RouteInfo[] => {
  const { repo, infos } = repoOf(files);
  return adapter.detectRoutes(infos, repo);
};
const sig = (routes: RouteInfo[]): string[] => routes.map((r) => `${r.method ?? "-"} ${r.route}`).sort();

describe("express: array mount paths and spaced verb calls", () => {
  it('app.use(["/a", "/b"], r) mounts the router under every listed path', () => {
    const routes = routesOf(expressAdapter, {
      "src/app.js": 'const express = require("express");\nconst app = express();\nconst r = express.Router();\nr.get("/x", h);\napp.use(["/a", "/b"], r);\n',
    });
    expect(sig(routes)).toEqual(["GET /a/x", "GET /b/x"]);
  });

  it("an array of non-literals is not read as mount paths", () => {
    const routes = routesOf(expressAdapter, {
      "src/app.js": 'const express = require("express");\nconst app = express();\nconst r = express.Router();\nr.get("/x", h);\napp.use([auth, log], r);\n',
    });
    expect(sig(routes)).toEqual(["GET /x"]);
  });

  it("detects a verb call with whitespace before its parenthesis", () => {
    const routes = routesOf(expressAdapter, {
      "src/app.js": 'const express = require("express");\nconst app = express();\napp.get ("/sp", h)\n  .post ("/sp2", h);\n',
    });
    expect(sig(routes)).toEqual(["GET /sp", "POST /sp2"]);
  });
});

describe("fastify: named-export plugins, nested register options, multi-line chains", () => {
  const server = (register: string) => `import Fastify from "fastify";\nimport { userRoutes } from "./users";\nconst app = Fastify();\n${register}\n`;

  it("a plugin exported by name and imported by name is mounted under its register prefix", () => {
    const routes = routesOf(fastifyAdapter, {
      "src/server.ts": server('app.register(userRoutes, { prefix: "/users" });'),
      "src/users.ts": 'export async function userRoutes(app) {\n  app.get("/:id", h);\n}\n',
    });
    expect(sig(routes)).toEqual(["GET /users/:id"]);
  });

  it("an exported arrow-function plugin is mounted too", () => {
    const routes = routesOf(fastifyAdapter, {
      "src/server.ts": server('app.register(userRoutes, { prefix: "/users" });'),
      "src/users.ts": 'export const userRoutes = async (f, opts) => {\n  f.post("/", h);\n};\n',
    });
    expect(sig(routes)).toEqual(["POST /users"]);
  });

  it("an exported function that is never registered is not a plugin", () => {
    const routes = routesOf(fastifyAdapter, {
      "src/server.ts": 'import Fastify from "fastify";\nimport { userRoutes } from "./users";\nconst app = Fastify();\nuserRoutes(cache);\n',
      "src/users.ts": 'export function userRoutes(cache) {\n  cache.get("/:id");\n}\n',
    });
    expect(routes).toEqual([]);
  });

  it("keeps the prefix when register options nest an object", () => {
    const routes = routesOf(fastifyAdapter, {
      "src/server.ts": server('app.register(userRoutes, { logLevel: { x: 1 }, prefix: "/v1" });'),
      "src/users.ts": 'export async function userRoutes(app) {\n  app.get("/:id", h);\n}\n',
    });
    expect(sig(routes)).toEqual(["GET /v1/:id"]);
  });

  it("detects routes on a multi-line chain", () => {
    const routes = routesOf(fastifyAdapter, {
      "src/server.ts": 'import Fastify from "fastify";\nconst app = Fastify();\napp\n  .get("/a", h)\n  .post("/b", h);\n',
    });
    expect(sig(routes)).toEqual(["GET /a", "POST /b"]);
  });
});

describe("trpc: procedures declared as consts, default-imported child routers", () => {
  it("resolves same-file procedure consts used as shorthand and renamed entries", () => {
    const routes = routesOf(trpcAdapter, {
      "server/root.ts":
        "const hello = publicProcedure.query(() => 1);\nconst add = publicProcedure\n  .input(z.object({ a: z.number() }))\n  .mutation(({ input }) => input.a);\nexport const appRouter = t.router({ hello, hi: hello, add });\n",
    });
    expect(sig(routes)).toEqual(["MUTATION add", "QUERY hello", "QUERY hi"]);
  });

  it("resolves a procedure const imported from another file", () => {
    const routes = routesOf(trpcAdapter, {
      "server/procs.ts": "export const ping = publicProcedure.query(() => 'pong');\n",
      "server/root.ts": 'import { ping as p } from "./procs";\nexport const appRouter = t.router({ ping: p });\n',
    });
    expect(sig(routes)).toEqual(["QUERY ping"]);
  });

  it("an entry naming a const that is not a procedure is not a route", () => {
    const routes = routesOf(trpcAdapter, {
      "server/root.ts":
        "const config = loadConfig();\nconst data = fetchData();\nexport const appRouter = t.router({ config, data, ok: publicProcedure.query(() => 1) });\n",
    });
    expect(sig(routes)).toEqual(["QUERY ok"]);
  });

  it("mounts a default-imported child router (export default <var>) under its key", () => {
    const routes = routesOf(trpcAdapter, {
      "server/user.ts": "const userRouter = createTRPCRouter({ list: publicProcedure.query(() => []) });\nexport default userRouter;\n",
      "server/root.ts": 'import userRouter from "./user";\nexport const appRouter = createTRPCRouter({ user: userRouter });\n',
    });
    expect(sig(routes)).toEqual(["QUERY user.list"]);
  });

  it("mounts a default-imported child router (export default createTRPCRouter({...})) under its key", () => {
    const routes = routesOf(trpcAdapter, {
      "server/user.ts": "export default createTRPCRouter({ list: publicProcedure.query(() => []) });\n",
      "server/root.ts": 'import users from "./user";\nexport const appRouter = createTRPCRouter({ user: users });\n',
    });
    expect(sig(routes)).toEqual(["QUERY user.list"]);
  });
});

describe("nestjs: method decorators outside a controller class", () => {
  it("does not attribute an @Get() in a later non-controller class to the controller above it", () => {
    const routes = routesOf(nestjsAdapter, {
      "src/cats.controller.ts":
        '@Controller("cats")\nexport class CatsController {\n  @Get()\n  list() {}\n}\n\nexport class Helper {\n  @Get("leak")\n  leak() {}\n}\n',
    });
    expect(sig(routes)).toEqual(["GET /cats"]);
  });

  it("still binds each controller's methods when several controllers share a file", () => {
    const routes = routesOf(nestjsAdapter, {
      "src/pets.controller.ts":
        '@Controller("cats")\nexport class CatsController {\n  @Get(":id")\n  one() {}\n}\n\n@Injectable()\nexport class Svc {}\n\n@Controller("dogs")\nexport class DogsController {\n  @Post()\n  create() {}\n}\n',
    });
    expect(sig(routes)).toEqual(["GET /cats/:id", "POST /dogs"]);
  });
});

describe("dotnet: chained MapGroup, $@ strings, verbatim strings ending in a backslash", () => {
  it("composes a MapGroup chained straight into a Map verb", () => {
    const routes = routesOf(dotnetAdapter, {
      "Program.cs": [
        'app.MapGroup("/api").MapGet("/x", h);',
        'app.MapGroup("/api").WithTags("t").RequireAuthorization().MapPost("/y", h);',
        'var v = app.MapGroup("/v");',
        'v.MapGroup("/1")',
        '  .MapMethods("/z", new[] { "PUT" }, h);',
        "",
      ].join("\n"),
    });
    expect(sig(routes)).toEqual(["GET /api/x", "POST /api/y", "PUT /v/1/z"]);
  });

  it("reads $@-prefixed (and @$-prefixed) string templates", () => {
    const routes = routesOf(dotnetAdapter, {
      "Program.cs": 'var g = app.MapGroup($@"/api");\ng.MapGet($@"/items/{id}", h);\napp.MapDelete(@$"/old", h);\n',
      "Controllers/UsersController.cs":
        '[ApiController]\n[Route($@"api/[controller]")]\npublic class UsersController : ControllerBase\n{\n    [HttpGet($@"{id}")]\n    public IActionResult One(int id) => Ok();\n}\n',
    });
    expect(sig(routes)).toEqual(["DELETE /old", "GET /api/items/{id}", "GET /api/users/{id}"]);
  });

  it('does not read the closing quote of @$"C:\\dir\\" as escaped', () => {
    const routes = routesOf(dotnetAdapter, {
      "Program.cs": 'var dir = @$"C:\\dir\\"; // app.MapGet("/commented", h);\napp.MapGet("/real", h);\n',
    });
    expect(sig(routes)).toEqual(["GET /real"]);
  });
});

describe("stripComments: a `/` that cannot open a regex literal", () => {
  it("the `/` of a JSX closing tag does not start a regex, so a trailing comment is stripped", () => {
    for (const ext of [".tsx", ".jsx", ".js"]) {
      expect(stripComments("return <a></a>; // comment\n", ext)).toBe("return <a></a>;           \n");
      expect(stripComments("const x = <p>{n}</p>; // a 'quote\n", ext)).toBe("const x = <p>{n}</p>;            \n");
    }
  });

  it("a `/` after a postfix ++ / -- divides, so a trailing comment is stripped", () => {
    expect(stripComments("i++ / 2; // c\n", ".ts")).toBe("i++ / 2;     \n");
    expect(stripComments("x = j-- / k; // c\n", ".js")).toBe("x = j-- / k;     \n");
  });

  it("still reads regex literals after a spaced `<` or a unary `+`", () => {
    const lt = "const ok = n < /a\\/\\/b/.source.length;\n";
    expect(stripComments(lt, ".ts")).toBe(lt);
    const plus = "const n = i + +/\\/\\//.test(s);\n";
    expect(stripComments(plus, ".ts")).toBe(plus);
    const triple = "const n = a+++/\\/\\//.source.length;\n";
    expect(stripComments(triple, ".ts")).toBe(triple);
  });
});

describe("stripComments: JSX elements are read as elements", () => {
  const blanked = (code: string, comment: string) => `${code}${" ".repeat(comment.length)}\n`;
  const JSX_EXTS = [".tsx", ".jsx", ".js"];

  it("`/>` after an attribute expression closes the tag instead of opening a regex", () => {
    for (const ext of JSX_EXTS) {
      expect(stripComments("const a = <Foo bar={x}/>; // c\n", ext)).toBe(blanked("const a = <Foo bar={x}/>; ", "// c"));
      expect(stripComments("const a = <Foo {...rest}/>; // 'c\n", ext)).toBe(blanked("const a = <Foo {...rest}/>; ", "// 'c"));
    }
  });

  it("an apostrophe or a `//` in element text opens neither a string nor a comment", () => {
    for (const ext of JSX_EXTS) {
      expect(stripComments("const a = <p>don't</p>; // c\n", ext)).toBe(blanked("const a = <p>don't</p>; ", "// c"));
      const link = 'const l = <a href="https://x.dev">see http://x.dev</a>;\n';
      expect(stripComments(link, ext)).toBe(link);
      const multi = "return (\n  <p>\n    it's /* not a comment\n  </p>\n); // c\n";
      expect(stripComments(multi, ext)).toBe(multi.replace("// c", "    "));
    }
  });

  it("comments in `{ … }` children, attribute values and tags are still blanked", () => {
    const src = [
      "const a = (",
      "  <ul // trailing",
      '    /* block */ className="x">',
      "    {/* app.get('/old') */}",
      "    {items.map((i) => <li key={i}>{i}'s {/* c */}</li>) /* d */}",
      "  </ul>",
      "); // e",
      "",
    ].join("\n");
    const out = stripComments(src, ".tsx");
    expect(out.length).toBe(src.length);
    expect(out).not.toMatch(/trailing|block|app\.get|\/\* [cd] \*\/|\/\/ e/);
    expect(out).toContain("{items.map((i) => <li key={i}>{i}'s {       }</li>)        }");
    expect(out).toContain('className="x">');
  });

  it("fragments and nested elements close in order", () => {
    const src = "const a = <><b>it's</b><i/></>; // c\n";
    expect(stripComments(src, ".jsx")).toBe(blanked("const a = <><b>it's</b><i/></>; ", "// c"));
  });

  it("a `<` that opens no well-formed element is still an operator or a generic", () => {
    // TypeScript modules have no JSX: `<T>` is a generic or an assertion.
    expect(stripComments("const f = <T>(x: T) => x; // c\n", ".ts")).toBe(blanked("const f = <T>(x: T) => x; ", "// c"));
    expect(stripComments("const v = <Foo>bar; // c\n", ".ts")).toBe(blanked("const v = <Foo>bar; ", "// c"));
    // TSX generic arrow functions.
    expect(stripComments("const f = <T,>(x: T) => x; // c\n", ".tsx")).toBe(blanked("const f = <T,>(x: T) => x; ", "// c"));
    expect(stripComments("const f = <T extends object>(x: T) => x; // c\n</T>\n", ".tsx")).toBe(
      `${blanked("const f = <T extends object>(x: T) => x; ", "// c")}</T>\n`,
    );
    expect(stripComments("type F = <T>(x: T) => T; // c\n", ".tsx")).toBe(blanked("type F = <T>(x: T) => T; ", "// c"));
    // An unclosed or mismatched tag falls back to the plain scan.
    expect(stripComments("x = <b; // c\n", ".js")).toBe(blanked("x = <b; ", "// c"));
    expect(stripComments("x = <a>1</b>; // c\n", ".js")).toBe(blanked("x = <a>1</b>; ", "// c"));
    // Comparisons are untouched.
    expect(stripComments("if (a <b && c> d) {} // c\n", ".js")).toBe(blanked("if (a <b && c> d) {} ", "// c"));
  });

  it("a comment blanked inside a failed element attempt is blanked exactly once", () => {
    // `<a b={…}>` never closes: the text is not JSX, so the plain scan decides.
    const src = "x = <a b={1 /* c */}>;\ny = 2; // d\n";
    expect(stripComments(src, ".js")).toBe(`x = <a b={1 ${" ".repeat("/* c */".length)}}>;\ny = 2;     \n`);
  });

  it("template literals with nested code and JSX keep their text", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: JS source text with template literals.
    const src = "const s = `a ${b /* c */ ? `x // y ${<i>it's</i>}` : 1} // not a comment`; // d\n";
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the expected stripped source.
    expect(stripComments(src, ".jsx")).toBe("const s = `a ${b         ? `x // y ${<i>it's</i>}` : 1} // not a comment`;     \n");
  });

  it("matches a closing tag by its whole name: `</Text>` does not close `<T>`", () => {
    const src = "type Fn = <T>(x: T) => void;\nreturn <Text>don't // keep</Text>; // gone\n";
    const out = stripComments(src, ".tsx");
    expect(out).toContain("don't // keep</Text>;");
    expect(out).not.toContain("// gone");
  });

  it("sees a keyword through a comment before a `<` or a `/`", () => {
    const jsx = "return /* c */ <a> see http://x.y/z </a>; /* c2 */\n";
    expect(stripComments(jsx, ".jsx")).toBe("return         <a> see http://x.y/z </a>;         \n");
    const re = "return /* c */ /\\/\\//.test(s); // d\n";
    expect(stripComments(re, ".js")).toBe("return         /\\/\\//.test(s);     \n");
    // An operand after the keyword still divides.
    expect(stripComments('return "x" / 2; // d\n', ".js")).toBe('return "x" / 2;     \n');
  });

  it("gives up on JSX within a bounded budget on nested elements that never close", () => {
    const t = (fn: () => unknown): number => {
      const start = performance.now();
      fn();
      return performance.now() - start;
    };
    const tail = "x = y + 1; // c\n".repeat(60_000);
    const nested = `v = ${"<a>{".repeat(1500)}${tail}</a>`;
    let out = "";
    expect(t(() => (out = stripComments(nested, ".js")))).toBeLessThan(2000);
    expect(out.length).toBe(nested.length);
    expect(out).not.toContain("// c");
    const attrs = `v = ${"<a x={".repeat(2000)}${"y; // c\n".repeat(60_000)}`;
    expect(t(() => (out = stripComments(attrs, ".js")))).toBeLessThan(2000);
    expect(out).not.toContain("// c");
    // Thousands of distinct nested tag names.
    const names = `v = ${Array.from({ length: 16_000 }, (_, i) => `<t${i}>`).join("")}${Array.from({ length: 16_000 }, (_, i) => `</t${15_999 - i}>`).join("")}`;
    expect(t(() => stripComments(names, ".jsx"))).toBeLessThan(2000);
  });

  it("keeps reading JSX in a file with hundreds of distinct components", () => {
    const src = Array.from({ length: 700 }, (_, i) => `const c${i} = <Comp${i}>don't see http://x {/* c */}</Comp${i}>; // c`).join("\n");
    const out = stripComments(src, ".jsx");
    expect(out).not.toContain("// c");
    expect(out).not.toContain("/* c */");
    expect(out.match(/don't see http:\/\/x/g)?.length).toBe(700);
  });

  it("stays linear on text that only looks like JSX", () => {
    const t = (fn: () => unknown): number => {
      const start = performance.now();
      fn();
      return performance.now() - start;
    };
    // 40 000 distinct unclosed "tags": the stripper gives up on JSX early.
    const generics = Array.from({ length: 40_000 }, (_, i) => `const f${i} = <T${i}>(x) => x; // c`).join("\n");
    expect(t(() => stripComments(generics, ".tsx"))).toBeLessThan(2000);
    // 20 000 well-formed siblings inside a parent that never closes.
    const open = `x = <div>${"<p>a</p>".repeat(20_000)}`;
    expect(t(() => stripComments(open, ".jsx"))).toBeLessThan(2000);
    // 20 000 nested opens, none closed.
    expect(t(() => stripComments(`x = ${"<a>{".repeat(20_000)}`, ".jsx"))).toBeLessThan(2000);
  });
});
