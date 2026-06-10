import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  detectWorkspaces,
  buildWorkspaceGraph,
  topoOrderWorkspaces,
} from "../src/detect/workspaces.js";

function makeRepo(write: (w: (rel: string, content: string) => void) => void): string {
  const repo = mkdtempSync(join(tmpdir(), "recon-ws-"));
  const w = (rel: string, content: string) => {
    const abs = join(repo, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  };
  write(w);
  return repo;
}

const repos: string[] = [];
function repo(write: (w: (rel: string, content: string) => void) => void): string {
  const r = makeRepo(write);
  repos.push(r);
  return r;
}
afterAll(() => repos.forEach((r) => rmSync(r, { recursive: true, force: true })));

describe("detectWorkspaces — npm/pnpm family", () => {
  it("tags package.json workspaces with kind npm", () => {
    const r = repo((w) => {
      w("package.json", JSON.stringify({ workspaces: ["packages/*"] }));
      w("packages/ui/package.json", JSON.stringify({ name: "@acme/ui" }));
    });
    expect(detectWorkspaces(r)).toEqual([
      { name: "@acme/ui", path: "packages/ui", kind: "npm" },
    ]);
  });

  it("tags pnpm-workspace.yaml entries with kind pnpm", () => {
    const r = repo((w) => {
      w("pnpm-workspace.yaml", "packages:\n  - 'packages/*'\n");
      w("packages/core/package.json", JSON.stringify({ name: "core" }));
    });
    expect(detectWorkspaces(r)).toEqual([{ name: "core", path: "packages/core", kind: "pnpm" }]);
  });

  it("applies pnpm negation patterns", () => {
    const r = repo((w) => {
      w("pnpm-workspace.yaml", "packages:\n  - 'packages/*'\n  - '!packages/internal-*'\n");
      w("packages/core/package.json", JSON.stringify({ name: "core" }));
      w("packages/internal-tools/package.json", JSON.stringify({ name: "tools" }));
    });
    expect(detectWorkspaces(r).map((x) => x.name)).toEqual(["core"]);
  });

  it("falls back to the path when the manifest has no name", () => {
    const r = repo((w) => {
      w("package.json", JSON.stringify({ workspaces: ["packages/anon"] }));
      w("packages/anon/package.json", JSON.stringify({ private: true }));
    });
    expect(detectWorkspaces(r)[0]?.name).toBe("packages/anon");
  });

  it("returns an empty list for a single-package repo", () => {
    const r = repo((w) => w("package.json", JSON.stringify({ name: "solo" })));
    expect(detectWorkspaces(r)).toEqual([]);
  });
});

describe("detectWorkspaces — lerna / nx fallbacks", () => {
  it("reads lerna.json packages when package.json declares no workspaces", () => {
    const r = repo((w) => {
      w("package.json", JSON.stringify({ name: "root" }));
      w("lerna.json", JSON.stringify({ packages: ["modules/*"] }));
      w("modules/a/package.json", JSON.stringify({ name: "mod-a" }));
    });
    expect(detectWorkspaces(r)).toEqual([{ name: "mod-a", path: "modules/a", kind: "lerna" }]);
  });

  it("ignores lerna.json when package.json already declares workspaces", () => {
    const r = repo((w) => {
      w("package.json", JSON.stringify({ workspaces: ["packages/*"] }));
      w("lerna.json", JSON.stringify({ packages: ["modules/*"] }));
      w("packages/ui/package.json", JSON.stringify({ name: "ui" }));
      w("modules/a/package.json", JSON.stringify({ name: "mod-a" }));
    });
    expect(detectWorkspaces(r).map((x) => x.name)).toEqual(["ui"]);
  });

  it("reads the nx workspaceLayout, accepting project.json manifests", () => {
    const r = repo((w) => {
      w("package.json", JSON.stringify({ name: "root" }));
      w("nx.json", JSON.stringify({ workspaceLayout: { appsDir: "apps", libsDir: "libs" } }));
      w("apps/site/project.json", JSON.stringify({ name: "site" }));
      w("libs/shared/package.json", JSON.stringify({ name: "@org/shared" }));
    });
    const ws = detectWorkspaces(r);
    expect(ws).toEqual([
      { name: "site", path: "apps/site", kind: "nx" },
      { name: "@org/shared", path: "libs/shared", kind: "nx" },
    ]);
  });
});

describe("detectWorkspaces — cargo", () => {
  it("expands [workspace] members with globs and applies exclude", () => {
    const r = repo((w) => {
      w(
        "Cargo.toml",
        [
          "[workspace]",
          "members = [",
          '  "crates/*", # all crates',
          '  "tools/xtask",',
          "]",
          'exclude = ["crates/legacy"]',
          "",
          "[workspace.dependencies]",
          'serde = "1"',
        ].join("\n"),
      );
      w("crates/core/Cargo.toml", '[package]\nname = "acme-core"\n');
      w("crates/legacy/Cargo.toml", '[package]\nname = "acme-legacy"\n');
      w("tools/xtask/Cargo.toml", '[package]\nname = "xtask"\n');
    });
    expect(detectWorkspaces(r)).toEqual([
      { name: "acme-core", path: "crates/core", kind: "cargo" },
      { name: "xtask", path: "tools/xtask", kind: "cargo" },
    ]);
  });

  it("falls back to the path for a member without [package] name", () => {
    const r = repo((w) => {
      w("Cargo.toml", '[workspace]\nmembers = ["crates/anon"]\n');
      w("crates/anon/Cargo.toml", "[dependencies]\n");
    });
    expect(detectWorkspaces(r)[0]?.name).toBe("crates/anon");
  });

  it("ignores a Cargo.toml without a [workspace] table", () => {
    const r = repo((w) => w("Cargo.toml", '[package]\nname = "solo"\n'));
    expect(detectWorkspaces(r)).toEqual([]);
  });
});

describe("detectWorkspaces — go.work", () => {
  it("reads block-form use directives, naming from go.mod modules", () => {
    const r = repo((w) => {
      w("go.work", "go 1.22\n\nuse (\n\t./services/api // main api\n\t./pkg/shared\n)\n");
      w("services/api/go.mod", "module example.com/api\n\ngo 1.22\n");
      w("pkg/shared/go.mod", "module example.com/shared\n\ngo 1.22\n");
    });
    expect(detectWorkspaces(r)).toEqual([
      { name: "example.com/shared", path: "pkg/shared", kind: "go" },
      { name: "example.com/api", path: "services/api", kind: "go" },
    ]);
  });

  it("reads single-line use directives and skips `use .`", () => {
    const r = repo((w) => {
      w("go.work", "go 1.22\n\nuse .\nuse ./tools\n");
      w("tools/go.mod", "module example.com/tools\n");
      w("go.mod", "module example.com/root\n");
    });
    expect(detectWorkspaces(r)).toEqual([
      { name: "example.com/tools", path: "tools", kind: "go" },
    ]);
  });
});

describe("buildWorkspaceGraph", () => {
  it("derives npm edges from dependency names", () => {
    const r = repo((w) => {
      w("package.json", JSON.stringify({ workspaces: ["apps/*", "packages/*"] }));
      w(
        "apps/web/package.json",
        JSON.stringify({ name: "@acme/web", dependencies: { "@acme/ui": "workspace:*", react: "^18" } }),
      );
      w("packages/ui/package.json", JSON.stringify({ name: "@acme/ui" }));
    });
    const ws = detectWorkspaces(r);
    buildWorkspaceGraph(r, ws);
    const web = ws.find((x) => x.name === "@acme/web");
    expect(web?.dependsOn).toEqual(["@acme/ui"]);
    expect(ws.find((x) => x.name === "@acme/ui")?.dependsOn).toBeUndefined();
  });

  it("derives cargo edges from path dependencies", () => {
    const r = repo((w) => {
      w("Cargo.toml", '[workspace]\nmembers = ["crates/cli", "crates/core"]\n');
      w(
        "crates/cli/Cargo.toml",
        '[package]\nname = "acme-cli"\n\n[dependencies]\nacme-core = { path = "../core" }\nserde = "1"\n',
      );
      w("crates/core/Cargo.toml", '[package]\nname = "acme-core"\n');
    });
    const ws = detectWorkspaces(r);
    buildWorkspaceGraph(r, ws);
    expect(ws.find((x) => x.name === "acme-cli")?.dependsOn).toEqual(["acme-core"]);
  });

  it("derives go edges from require and replace directives", () => {
    const r = repo((w) => {
      w("go.work", "use (\n\t./services/api\n\t./pkg/shared\n)\n");
      w(
        "services/api/go.mod",
        [
          "module example.com/api",
          "",
          "require example.com/shared v0.0.0",
          "",
          "replace example.com/shared => ../../pkg/shared",
        ].join("\n"),
      );
      w("pkg/shared/go.mod", "module example.com/shared\n");
    });
    const ws = detectWorkspaces(r);
    buildWorkspaceGraph(r, ws);
    expect(ws.find((x) => x.name === "example.com/api")?.dependsOn).toEqual([
      "example.com/shared",
    ]);
  });
});

describe("topoOrderWorkspaces", () => {
  const ws = (name: string, dependsOn?: string[]) => ({ name, path: name, dependsOn });

  it("orders dependencies before their dependents", () => {
    const order = topoOrderWorkspaces([ws("web", ["ui", "db"]), ws("ui", ["db"]), ws("db")]);
    expect(order).toEqual(["db", "ui", "web"]);
  });

  it("falls back deterministically on a cycle", () => {
    const order = topoOrderWorkspaces([ws("a", ["b"]), ws("b", ["a"]), ws("c")]);
    expect(order).toEqual(["c", "a", "b"]);
  });
});

describe("detectWorkspaces — polyglot union", () => {
  it("unions npm, cargo and go workspaces in one repo", () => {
    const r = repo((w) => {
      w("package.json", JSON.stringify({ workspaces: ["web"] }));
      w("web/package.json", JSON.stringify({ name: "web" }));
      w("Cargo.toml", '[workspace]\nmembers = ["native"]\n');
      w("native/Cargo.toml", '[package]\nname = "native"\n');
      w("go.work", "use ./backend\n");
      w("backend/go.mod", "module example.com/backend\n");
    });
    expect(detectWorkspaces(r).map((x) => `${x.kind}:${x.path}`)).toEqual([
      "go:backend",
      "cargo:native",
      "npm:web",
    ]);
  });
});
