import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { parseArgs } from "../src/cli.js";

const REPO = fileURLToPath(new URL("./fixtures/sample-app", import.meta.url));

describe("parseArgs: merge/summary/standalone flags", () => {
  it("defaults all bundle flags to false", () => {
    const o = parseArgs(["--repo", REPO]);
    expect(o.merge).toBe(false);
    expect(o.summary).toBe(false);
    expect(o.features).toBe(false);
    expect(o.standalone).toBe(false);
  });

  it("sets --merge, --summary and --features as booleans", () => {
    const o = parseArgs(["--repo", REPO, "--merge", "--summary", "--features"]);
    expect(o.merge).toBe(true);
    expect(o.summary).toBe(true);
    expect(o.features).toBe(true);
  });

  it("enters standalone when --features is used without --repo", () => {
    const o = parseArgs(["--features", "--out", "/tmp/some-recon"]);
    expect(o.standalone).toBe(true);
    expect(o.features).toBe(true);
    expect(o.out).toBe(resolve("/tmp/some-recon"));
  });

  it("stays inline (not standalone) when --repo is provided", () => {
    const o = parseArgs(["--repo", REPO, "--merge"]);
    expect(o.standalone).toBe(false);
  });

  it("enters standalone when --merge is used without --repo", () => {
    const o = parseArgs(["--merge", "--out", "/tmp/some-recon"]);
    expect(o.standalone).toBe(true);
    expect(o.merge).toBe(true);
    expect(o.out).toBe(resolve("/tmp/some-recon"));
  });

  it("enters standalone for --summary alone, defaulting out to cwd", () => {
    const o = parseArgs(["--summary"]);
    expect(o.standalone).toBe(true);
    expect(o.out).toBe(resolve(process.cwd()));
  });

  it("--json wins over bundle flags and never goes standalone", () => {
    const o = parseArgs(["--json", "--merge"]);
    expect(o.json).toBe(true);
    expect(o.standalone).toBe(false);
  });
});

describe("parseArgs: scratch (greenfield) mode", () => {
  it("defaults scratch off, plan empty, tdd off", () => {
    const o = parseArgs(["--repo", REPO]);
    expect(o.scratch).toBe(false);
    expect(o.plan).toBe("");
    expect(o.tdd).toBe(false);
  });

  it("enters scratch mode with --scratch --plan, forcing mode=scratch + fidelity=describe", () => {
    const o = parseArgs(["--scratch", "--plan", "p.json"]);
    expect(o.scratch).toBe(true);
    expect(o.mode).toBe("scratch");
    expect(o.fidelity).toBe("describe");
    expect(o.plan).toBe(resolve("p.json"));
  });

  it("does not require --repo to exist and defaults out to <cwd>/reconstruction", () => {
    const o = parseArgs(["--scratch", "--plan", "p.json"]);
    expect(o.standalone).toBe(false);
    expect(o.out).toBe(resolve("reconstruction"));
  });

  it("respects --level in scratch mode", () => {
    const o = parseArgs(["--scratch", "--plan", "p.json", "--level", "complex"]);
    expect(o.level).toBe("complex");
  });

  it("honours an explicit --out in scratch mode", () => {
    const o = parseArgs(["--scratch", "--plan", "p.json", "--out", "/tmp/greenfield"]);
    expect(o.out).toBe(resolve("/tmp/greenfield"));
  });
});

describe("parseArgs: --tdd flag", () => {
  it("sets tdd as a boolean, independent of mode", () => {
    expect(parseArgs(["--repo", REPO, "--tdd"]).tdd).toBe(true);
    expect(parseArgs(["--scratch", "--plan", "p.json", "--tdd"]).tdd).toBe(true);
  });
});
