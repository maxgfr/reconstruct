import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { analyze } from "../src/analyze.js";
import { checkOutput } from "../src/check.js";
import { writeOutput } from "../src/output.js";
import { closesFence, codeFence, fenceOpen, rebaseLinks } from "../src/prd/markdown.js";
import { render } from "../src/prd/render.js";
import { applyFindings, runReview } from "../src/review.js";
import type { Options } from "../src/types.js";

// Output-side correctness: routes reach their feature PRDs, bundles keep their
// links, embedded source is verbatim, and the gate reads what is really there.

const temps: string[] = [];
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});
function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  temps.push(d);
  return d;
}

function opts(repo: string, out: string, extra: Partial<Options> = {}): Options {
  return {
    repo,
    out,
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
    ...extra,
  };
}

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

describe("routes reach the feature that declares them", () => {
  for (const name of ["express-app", "go-app", "rails-app", "dotnet-api", "flask-api", "fastapi-app"]) {
    it(`${name}: every route lands in some feature`, () => {
      const inv = analyze(opts(fixture(name), tmp("rc-feat-")));
      expect(inv.routes.length).toBeGreaterThan(0);
      const placed = inv.features.flatMap((f) => f.routes);
      expect(placed.length).toBe(inv.routes.length);
    });
  }
});

describe("line counts", () => {
  it("does not count the trailing newline as an extra line", () => {
    const repo = tmp("rc-lines-");
    writeFileSync(join(repo, "a.txt"), "one\ntwo\n");
    writeFileSync(join(repo, "b.txt"), "one\ntwo");
    const inv = analyze(opts(repo, join(repo, "reconstruction")));
    const lines = Object.fromEntries(inv.files.map((f) => [f.path, f.lines]));
    expect(lines["a.txt"]).toBe(2);
    expect(lines["b.txt"]).toBe(2);
  });
});

describe("markdown fences and links", () => {
  it("chooses a fence longer than any backtick run, and closes only on a long-enough run", () => {
    const body = "const md = `\n```js\nx\n```\n`;";
    const fence = codeFence(body);
    expect(fence).toBe("````");
    const open = fenceOpen(`${fence}ts`);
    expect(open).toEqual({ char: "`", len: 4 });
    expect(closesFence("```", open!)).toBe(false);
    expect(closesFence("````", open!)).toBe(true);
  });

  it("rebases relative links from a subdirectory, leaving code, anchors and URLs alone", () => {
    const md = "[a](../../source/x/a.ts) [b](<../../source/x/b c.ts>) [c](#top) [d](https://e.x)\n```\n[e](../f)\n```\n`[g](../h)`";
    const out = rebaseLinks(md, "features/01-core");
    expect(out).toContain("[a](source/x/a.ts)");
    expect(out).toContain("[b](<source/x/b c.ts>)");
    expect(out).toContain("[c](#top)");
    expect(out).toContain("[d](https://e.x)");
    expect(out).toContain("[e](../f)");
    expect(out).toContain("`[g](../h)`");
  });
});

describe("rendered trees", () => {
  it("bundles keep working links, and embedded source stays verbatim", () => {
    const repo = tmp("rc-embed-");
    mkdirSync(join(repo, "src"), { recursive: true });
    writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "demo", dependencies: { express: "^4" } }));
    writeFileSync(
      join(repo, "src", "server.js"),
      'const express = require("express");\nconst app = express();\nconst doc = `\n```\nnot a fence end\n```\n`;\napp.get("/users", (q, s) => s.json([]));\n',
    );
    const out = join(repo, "reconstruction");
    const o = opts(repo, out, { fidelity: "embed", merge: true, specs: true, features: true });
    writeOutput(render(analyze(o), o), o);
    const res = checkOutput(out);
    expect(res.warnings.filter((w) => w.includes("broken link"))).toEqual([]);

    const mirror = join(repo, "mirror");
    const m = opts(repo, mirror, { fidelity: "mirror", merge: true, specs: true, features: true });
    writeOutput(render(analyze(m), m), m);
    expect(checkOutput(mirror).warnings.filter((w) => w.includes("broken link"))).toEqual([]);
  });

  it("truncates embeds on a byte budget without splitting a character", () => {
    const repo = tmp("rc-bytes-");
    mkdirSync(join(repo, "src"), { recursive: true });
    writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "demo" }));
    writeFileSync(join(repo, "src", "a.js"), `module.exports = "${"é".repeat(100)}";\n`);
    writeFileSync(join(repo, "src", "b.js"), "module.exports = 2;\n");
    const out = join(repo, "reconstruction");
    const o = opts(repo, out, { fidelity: "embed", maxEmbedBytes: 41 });
    const rendered = render(analyze(o), o);
    const prd = rendered.artifacts.find((a) => a.content.includes("src/a.js") && a.relPath.startsWith("features/"));
    expect(prd?.content).toContain("Truncated to 41 bytes");
    expect(prd?.content).not.toContain("�");
  });
});

describe("the gate", () => {
  it("does not descend a symlinked directory loop", () => {
    const repo = tmp("rc-loop-");
    writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "demo" }));
    const out = join(repo, "reconstruction");
    const o = opts(repo, out);
    writeOutput(render(analyze(o), o), o);
    symlinkSync(out, join(out, "features", "loop"));
    expect(() => checkOutput(out)).not.toThrow();
  });
});

describe("review findings fail closed", () => {
  it("keeps an unknown severity as a blocker and normalises case", () => {
    const dir = tmp("rc-sev-");
    writeFileSync(
      join(dir, "inventory.json"),
      JSON.stringify({ repoName: "demo", features: [{ slug: "01-a", name: "a", description: "", kind: "feature", files: [], routes: [] }] }),
    );
    mkdirSync(join(dir, "features", "01-a"), { recursive: true });
    writeFileSync(join(dir, "features", "01-a", "PRD.md"), "# A\nThing.");
    runReview(dir);
    const f = join(dir, "findings.json");
    writeFileSync(
      f,
      JSON.stringify({
        findings: [
          { feature: "01-a", severity: "Blocker", category: "requirements", problem: "p1", fix: "x" },
          { feature: "01-a", severity: "catastrophic", category: "requirements", problem: "p2", fix: "x" },
        ],
      }),
    );
    const res = applyFindings(dir, f);
    expect(res.blockers).toBe(2);
    expect(res.ok).toBe(false);
  });
});
