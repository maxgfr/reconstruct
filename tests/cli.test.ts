import { describe, it, expect, vi, afterEach } from "vitest";
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
    expect(o.specs).toBe(false);
    expect(o.standalone).toBe(false);
  });

  it("sets --merge, --summary, --features and --specs as booleans", () => {
    const o = parseArgs(["--repo", REPO, "--merge", "--summary", "--features", "--specs"]);
    expect(o.merge).toBe(true);
    expect(o.summary).toBe(true);
    expect(o.features).toBe(true);
    expect(o.specs).toBe(true);
  });

  it("enters standalone when --features is used without --repo", () => {
    const o = parseArgs(["--features", "--out", "/tmp/some-recon"]);
    expect(o.standalone).toBe(true);
    expect(o.features).toBe(true);
    expect(o.out).toBe(resolve("/tmp/some-recon"));
  });

  it("enters standalone when --specs is used without --repo", () => {
    const o = parseArgs(["--specs", "--out", "/tmp/some-recon"]);
    expect(o.standalone).toBe(true);
    expect(o.specs).toBe(true);
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

describe("parseArgs: --review / --verify validation flags", () => {
  it("defaults review and verify off", () => {
    const o = parseArgs(["--repo", REPO]);
    expect(o.review).toBe(false);
    expect(o.verify).toBe(false);
  });

  it("sets --review as a boolean and reads an existing --out without a repo", () => {
    const o = parseArgs(["--review", "--out", "/tmp/some-recon"]);
    expect(o.review).toBe(true);
    expect(o.standalone).toBe(false);
    expect(o.out).toBe(resolve("/tmp/some-recon"));
  });

  it("routes --review --apply to a findings file path", () => {
    const o = parseArgs(["--review", "--apply", "findings.json", "--out", "/tmp/some-recon"]);
    expect(o.review).toBe(true);
    expect(o.apply).toBe("findings.json");
  });
});

describe("parseArgs: strict flag validation", () => {
  // parseArgs reports usage errors via fail() → process.exit(1). Trap the exit
  // (and silence the message) so the failing branch is observable as a throw.
  afterEach(() => vi.restoreAllMocks());
  function expectFail(argv: string[], pattern: RegExp) {
    vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    expect(() => parseArgs(argv)).toThrow(/process\.exit\(1\)/);
    const message = stderr.mock.calls.map((c) => String(c[0])).join("");
    expect(message).toMatch(pattern);
  }

  it("rejects an unknown long flag instead of swallowing it", () => {
    expectFail(["--repo", REPO, "--bogus"], /unknown flag: --bogus/);
  });

  it("rejects a typo'd value flag (e.g. --mdoe) rather than ignoring it", () => {
    expectFail(["--repo", REPO, "--mdoe", "preserve"], /unknown flag: --mdoe/);
  });

  it("rejects a stray positional argument", () => {
    expectFail(["./some-repo"], /unexpected argument: \.\/some-repo/);
  });

  it("rejects an unknown short flag", () => {
    expectFail(["-x"], /unexpected argument: -x/);
  });

  it("still reports a missing value for a known value flag", () => {
    expectFail(["--repo"], /missing value for --repo/);
  });

  it("rejects combining the mutually-exclusive validation actions", () => {
    expectFail(["--verify", "--review", "--out", "/tmp/x"], /mutually exclusive/);
    expectFail(["--check", "--review", "--out", "/tmp/x"], /mutually exclusive/);
    expectFail(["--check", "--verify", "--out", "/tmp/x"], /mutually exclusive/);
  });

  it("still allows the action modifiers (--check --semantic, --review --apply)", () => {
    expect(parseArgs(["--check", "--semantic", "--out", "/tmp/x"]).semantic).toBe(true);
    expect(parseArgs(["--review", "--apply", "f.json", "--out", "/tmp/x"]).review).toBe(true);
  });

  it("parses --allow-unverified as a --check modifier, not an action", () => {
    const o = parseArgs(["--check", "--semantic", "--allow-unverified", "--out", "/tmp/x"]);
    expect(o.allowUnverified).toBe(true);
    expect(parseArgs(["--check", "--out", "/tmp/x"]).allowUnverified).toBe(false);
  });

  it("accepts every known value flag (including = form) and routes globs", () => {
    const o = parseArgs([
      "--repo",
      REPO,
      "--out",
      "/tmp/strict-out",
      "--mode",
      "redesign",
      "--level",
      "complex",
      "--fidelity",
      "embed",
      "--granularity",
      "fine",
      "--max-embed-bytes=5000",
      "--include",
      "src/**,lib/**",
      "--exclude",
      "dist/**",
    ]);
    expect(o.mode).toBe("redesign");
    expect(o.level).toBe("complex");
    expect(o.fidelity).toBe("embed");
    expect(o.granularity).toBe("fine");
    expect(o.maxEmbedBytes).toBe(5000);
    expect(o.include).toEqual(["src/**", "lib/**"]);
    expect(o.exclude).toEqual(["dist/**"]);
  });
});
