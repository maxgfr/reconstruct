import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyze } from "../src/analyze.js";
import type { Inventory, Options } from "../src/types.js";

// A stack guide is markdown, so it has no code path of its own — but every guide
// makes CLAIMS about what the engine does on that family of repo ("Angular is
// detected but routes are not resolved", "the engine detects nothing for .NET",
// "a library has no routes"). Those claims are what goes stale.
//
// These tests pin each claim to a real fixture run, so a guide can never drift
// from the engine's actual behaviour without a test failing — the same guarantee
// the route adapters get from tests/adapters.test.ts.

const SKILL = fileURLToPath(new URL("../skills/reconstruct", import.meta.url));

function opts(fixture: string): Options {
  return {
    repo: fileURLToPath(new URL(`./fixtures/${fixture}`, import.meta.url)),
    out: join(tmpdir(), "reconstruct-families", fixture),
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

const guide = (name: string): string => readFileSync(join(SKILL, "references", "stack-guides", `${name}.md`), "utf8");
const unknowns = (inv: Inventory): string => inv.unknowns.join("\n");

/** Every family ships a guide, and the index routes to it. */
describe("every family guide is reachable", () => {
  const index = readFileSync(join(SKILL, "references", "stack-guides", "INDEX.md"), "utf8");

  it.each(["angular", "dotnet-aspnet", "desktop-electron-tauri", "serverless-edge", "library-cli-sdk"])("INDEX.md links %s.md", (name) => {
    expect(index).toContain(`${name}.md`);
  });

  it.each(["angular", "dotnet-aspnet", "desktop-electron-tauri", "serverless-edge", "library-cli-sdk"])("%s.md keeps the guide shape", (name) => {
    const g = guide(name);
    for (const section of ["## Where the interface surface lives", "## Data model", "## Gotchas"]) {
      expect(g, `${name}.md is missing ${section}`).toContain(section);
    }
    expect(g, `${name}.md has no closing tip`).toMatch(/^> tip:/m);
  });
});

describe("angular family", () => {
  const inv = analyze(opts("angular-app"));

  it("is detected as Angular", () => {
    expect(inv.stack.frameworks).toContain("Angular");
  });

  // The guide says: "The engine has no Angular route adapter — build the surface
  // by hand from the route config."
  it("resolves no routes, and SAYS SO in unknowns", () => {
    expect(inv.routes).toHaveLength(0);
    expect(unknowns(inv)).toMatch(/No routes were resolved although Angular was detected/);
    expect(unknowns(inv)).toMatch(/stack-guides\/INDEX\.md/);
  });

  it("guide documents the constructs the fixture actually uses", () => {
    const g = guide("angular");
    for (const token of ["loadChildren", "canActivate", "HttpClient", "environment"]) {
      expect(g, `angular.md never mentions ${token}`).toContain(token);
    }
  });
});

describe("dotnet family", () => {
  const inv = analyze(opts("dotnet-api"));

  it("is detected as ASP.NET Core, with C# as a language", () => {
    expect(inv.stack.frameworks).toContain("ASP.NET Core");
    expect(inv.stack.languages).toContain("C#");
  });

  it("resolves both Minimal APIs and controllers", () => {
    const routes = inv.routes.map((r) => `${r.method} ${r.route}`);
    expect(routes).toContain("GET /health");
    expect(routes).toContain("POST /api/todos");
    expect(routes).toContain("GET /api/users/{id}");
  });

  // The guide originally documented .NET as undetected. That is now false, and
  // this is the assertion that keeps it honest.
  it("guide does not claim the engine detects nothing", () => {
    const g = guide("dotnet-aspnet");
    expect(g).not.toMatch(/engine detects (the )?\*\*?C# language only\*\*?|no route adapter/i);
    expect(g).toMatch(/Microsoft\.NET\.Sdk\.Web/);
  });

  it("guide documents both paradigms it resolves", () => {
    const g = guide("dotnet-aspnet");
    expect(g).toContain("MapGroup");
    expect(g).toContain("[controller]");
  });
});

describe("desktop family (Electron / Tauri)", () => {
  const electron = analyze(opts("electron-app"));
  const tauri = analyze(opts("tauri-app"));

  it("detects each shell", () => {
    expect(electron.stack.frameworks).toContain("Electron");
    expect(tauri.stack.frameworks).toContain("Tauri");
  });

  // The guide's central claim: the surface is IPC, not routes. The engine must
  // not tell the agent to go looking for a route table.
  it("says the surface is NOT http routes, rather than 'routes unresolved'", () => {
    for (const inv of [electron, tauri]) {
      expect(inv.routes).toHaveLength(0);
      expect(unknowns(inv)).toMatch(/exposes no HTTP routes/);
      expect(unknowns(inv)).not.toMatch(/Routes were not resolved deterministically/);
    }
  });

  it("guide documents the real surface of each fixture", () => {
    const g = guide("desktop-electron-tauri");
    for (const token of ["contextBridge", "ipcMain.handle", "#[tauri::command]", "contextIsolation"]) {
      expect(g, `desktop guide never mentions ${token}`).toContain(token);
    }
  });
});

describe("serverless / edge family", () => {
  const inv = analyze(opts("worker-edge"));

  // The in-code Hono routes DO resolve — which is exactly the trap: the cron
  // trigger and the queue consumer declared in wrangler.toml stay invisible, so
  // a resolved route table is an UNDER-report of the real surface.
  it("resolves the in-code fetch routes", () => {
    expect(inv.routes.length).toBeGreaterThan(0);
    expect(inv.routes.map((r) => r.route)).toContain("/health");
  });

  it("still warns that the invocable surface is declared in infra config", () => {
    expect(unknowns(inv)).toMatch(/Serverless\/edge infrastructure config was found \(wrangler\.toml\)/);
    expect(unknowns(inv)).toMatch(/cron triggers, queue consumers/);
  });

  it("guide documents the infra-first method", () => {
    const g = guide("serverless-edge");
    for (const token of ["wrangler.toml", "crons", "MessageBatch", "compatibility_date"]) {
      expect(g, `serverless guide never mentions ${token}`).toContain(token);
    }
  });
});

describe("library / CLI / SDK family", () => {
  const inv = analyze(opts("library-cli"));

  it("detects no web framework — the defining property of this family", () => {
    expect(inv.stack.frameworks).toHaveLength(0);
    expect(inv.routes).toHaveLength(0);
  });

  // The old message sent the agent hunting for an interface surface it does not
  // have. It must name this case and route to its guide.
  it("routes the agent to the library/CLI guide instead of a route hunt", () => {
    expect(unknowns(inv)).toMatch(/library \/ CLI \/ SDK \/ engine/);
    expect(unknowns(inv)).toMatch(/stack-guides\/library-cli-sdk\.md/);
  });

  it("guide documents exports, bin and exit codes as the surface", () => {
    const g = guide("library-cli-sdk");
    for (const token of ["exports", "`bin`", "exit code", "plugin"]) {
      expect(g, `library guide never mentions ${token}`).toContain(token);
    }
  });
});
