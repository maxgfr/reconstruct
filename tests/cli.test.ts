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
    expect(o.standalone).toBe(false);
  });

  it("sets --merge and --summary as booleans", () => {
    const o = parseArgs(["--repo", REPO, "--merge", "--summary"]);
    expect(o.merge).toBe(true);
    expect(o.summary).toBe(true);
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
