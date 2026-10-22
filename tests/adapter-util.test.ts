import { describe, expect, it } from "vitest";
import { cmp, lineAt, pythonImportAliases, resolveModule, resolvePythonModule, stripComments } from "../src/adapters/util.js";

// The shared lexical layer every route adapter reads through. Offsets must be
// preserved exactly: provenance line numbers are computed on the stripped text.

describe("stripComments", () => {
  it("blanks JS line and block comments, keeping offsets and newlines", () => {
    const src = 'app.get("/a");\n// app.get("/old");\n/* app.post("/x")\n */ app.put("/b");\n';
    const out = stripComments(src, ".ts");
    expect(out.length).toBe(src.length);
    expect(out.split("\n").length).toBe(src.split("\n").length);
    expect(out).toContain('app.get("/a")');
    expect(out).toContain('app.put("/b")');
    expect(out).not.toContain("/old");
    expect(out).not.toContain('"/x"');
  });

  it("keeps `//` inside strings, template literals and regex literals", () => {
    const src = 'const u = "http://x";\nconst t = `//${a /* c */}//`;\nconst r = /\\/\\//g;\n';
    const out = stripComments(src, ".js");
    expect(out).toContain('"http://x"');
    expect(out).toContain("`//${a ");
    expect(out).not.toContain("/* c */");
    expect(out).toContain("/\\/\\//g");
  });

  it("does not treat an apostrophe in a comment as an open string", () => {
    const src = "router({\n  // don't break\n  list: p.query(),\n});\n";
    const out = stripComments(src, ".ts");
    expect(out).not.toContain("don't");
    expect(out).toContain("list: p.query()");
  });

  it("handles Python `#` comments but not `#` inside strings or docstrings", () => {
    const src = '@app.get("/a#b")\n# @app.get("/old")\n"""doc # not a comment"""\n';
    const out = stripComments(src, ".py");
    expect(out).toContain('"/a#b"');
    expect(out).not.toContain("/old");
    expect(out).toContain("doc # not a comment");
  });

  it("handles Ruby comments and =begin blocks", () => {
    const src = 'get "/a" # trailing\n=begin\nget "/old"\n=end\nget "/b"\n';
    const out = stripComments(src, ".rb");
    expect(out).toContain('get "/a"');
    expect(out).toContain('get "/b"');
    expect(out).not.toContain("trailing");
    expect(out).not.toContain("/old");
  });

  it("handles Go raw strings and C# verbatim strings", () => {
    expect(stripComments("r.Get(`/a//b`) // x\n", ".go")).toContain("`/a//b`");
    expect(stripComments('[Route(@"api//""q""")] // x\n', ".cs")).toContain('@"api//""q"""');
    expect(stripComments('[Route(@"api//""q""")] // x\n', ".cs")).not.toContain("// x");
  });

  it("leaves unknown extensions untouched", () => {
    expect(stripComments("# not code // at all", ".md")).toBe("# not code // at all");
  });
});

describe("lineAt / cmp", () => {
  it("returns 1-based line numbers", () => {
    const src = "a\nb\nc";
    expect(lineAt(src, 0)).toBe(1);
    expect(lineAt(src, src.indexOf("c"))).toBe(3);
  });

  it("orders by code unit, independent of the user's locale", () => {
    expect(["src/zz.ts", "src/aa.ts", "B", "a"].sort(cmp)).toEqual(["B", "a", "src/aa.ts", "src/zz.ts"]);
  });
});

describe("module resolution", () => {
  it("resolves a TypeScript ESM `./x.js` import to x.ts", () => {
    const sources = new Map([
      ["src/app.ts", ""],
      ["src/routes/users.ts", ""],
    ]);
    expect(resolveModule("src/app.ts", "./routes/users.js", sources)).toBe("src/routes/users.ts");
  });

  it("resolves relative and source-rooted Python imports", () => {
    const sources = new Map([
      ["src/app/main.py", ""],
      ["src/app/routers/items.py", ""],
      ["src/app/routers/__init__.py", ""],
    ]);
    expect(resolvePythonModule("src/app/main.py", ".routers.items", sources)).toBe("src/app/routers/items.py");
    expect(resolvePythonModule("src/app/main.py", "app.routers.items", sources)).toBe("src/app/routers/items.py");
    expect(resolvePythonModule("src/app/routers/items.py", "..main", sources)).toBe("src/app/main.py");
    expect(resolvePythonModule("src/app/main.py", "nope", sources)).toBeNull();
  });

  it("reads parenthesised multi-line `from … import (…)` aliases", () => {
    // Comments arrive blanked by readSources; a trailing comma is allowed.
    const src = stripComments(
      `from fastapi import FastAPI
from .routers.items import (
    router as items_router,  # the items API
    helper,
)
from app.deps import (get_db, get_user as current_user)
`,
      ".py",
    );
    expect(Object.fromEntries(pythonImportAliases(src))).toEqual({
      FastAPI: "fastapi::FastAPI",
      items_router: ".routers.items::router",
      helper: ".routers.items::helper",
      get_db: "app.deps::get_db",
      current_user: "app.deps::get_user",
    });
  });
});
