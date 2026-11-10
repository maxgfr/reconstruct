import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { djangoAdapter } from "../src/adapters/django.js";
import { flaskAdapter } from "../src/adapters/flask.js";
import { pythonImportAliases } from "../src/adapters/util.js";
import type { FileInfo } from "../src/types.js";

// Scans that run once per source file must stay linear in the file size. The
// bounds are generous (≈100× the measured time) so they only trip on a
// regression to quadratic behaviour, never on a slow CI runner.

const elapsed = (fn: () => unknown): number => {
  const t = performance.now();
  fn();
  return performance.now() - t;
};

describe("linear-time source scans", () => {
  it("pythonImportAliases: a long run of whitespace-only lines (blanked comments) stays linear", () => {
    const src = "from a import b\n" + "    \n".repeat(200_000) + "x = 1\nfrom c import d as e\n";
    let aliases = new Map<string, string>();
    expect(elapsed(() => (aliases = pythonImportAliases(src)))).toBeLessThan(1000);
    expect([...aliases.keys()].sort()).toEqual(["b", "e"]);
  });
});

describe("linear-time adapter passes", () => {
  it("flask: kind detection does not rescan the rest of the file per route", () => {
    const repo = mkdtempSync(join(tmpdir(), "rc-flask-perf-"));
    const body = ["from flask import Flask, render_template", "app = Flask(__name__)"];
    for (let i = 0; i < 8000; i++) body.push(`@app.route("/r${i}")`, `def r${i}():`, i % 2 ? "    return {}" : '    return render_template("x.html")', "");
    writeFileSync(join(repo, "app.py"), body.join("\n"));
    const files: FileInfo[] = [{ path: "app.py", ext: ".py", size: 0, lines: body.length, category: "code", binary: false }];
    let routes: ReturnType<typeof flaskAdapter.detectRoutes> = [];
    expect(elapsed(() => (routes = flaskAdapter.detectRoutes(files, repo)))).toBeLessThan(1500);
    expect(routes.length).toBe(8000);
    expect(routes.filter((r) => r.kind === "page").length).toBe(4000);
  });

  it("django: the REST-context test runs once per URLconf, not once per route", () => {
    const repo = mkdtempSync(join(tmpdir(), "rc-django-perf-"));
    const body = ["from django.urls import path", "from . import views", "urlpatterns = ["];
    for (let i = 0; i < 20000; i++) body.push(`    path("r${i}/", views.v${i}),`);
    body.push("]");
    writeFileSync(join(repo, "urls.py"), body.join("\n"));
    const files: FileInfo[] = [{ path: "urls.py", ext: ".py", size: 0, lines: body.length, category: "code", binary: false }];
    let routes: ReturnType<typeof djangoAdapter.detectRoutes> = [];
    expect(elapsed(() => (routes = djangoAdapter.detectRoutes(files, repo)))).toBeLessThan(1500);
    expect(routes.length).toBe(20000);
    expect(routes.every((r) => r.kind === "page")).toBe(true);
  });
});
