import { afterEach, describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../src/cli.js";

const REPO = fileURLToPath(new URL("./fixtures/sample-app", import.meta.url));

// parseArgs reports usage errors via fail() → process.exit(1). Trap the exit
// (and silence the message) so the failing branch is observable as a throw.
function expectFail(argv: string[], pattern: RegExp) {
  vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`process.exit(${code})`);
  }) as never);
  const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  expect(() => parseArgs(argv)).toThrow(/process\.exit\(1\)/);
  expect(stderr.mock.calls.map((c) => String(c[0])).join("")).toMatch(pattern);
}

afterEach(() => vi.restoreAllMocks());

describe("parseArgs: --out must not be the analysed repository", () => {
  it("rejects --out equal to --repo (the next run would ingest and re-nest its own output)", () => {
    expectFail(["--repo", REPO, "--out", REPO], /--out must not be the repository root/);
  });

  it("still accepts an --out inside the repository (the walk prunes it)", () => {
    expect(parseArgs(["--repo", REPO, "--out", `${REPO}/reconstruction`]).out).toBe(`${REPO}/reconstruction`);
  });

  it("does not apply to modes that read an existing tree", () => {
    expect(parseArgs(["--check", "--out", REPO]).check).toBe(true);
  });
});

describe("parseArgs: an empty --flag= value is a missing value", () => {
  it("rejects --out= instead of silently writing into the cwd", () => {
    expectFail(["--repo", REPO, "--out="], /missing value for --out/);
  });

  it("rejects --apply= instead of silently re-running the worklist", () => {
    expectFail(["--verify", "--out", "/tmp/x", "--apply="], /missing value for --apply/);
  });
});

describe("parseArgs: numeric flags are validated", () => {
  it("rejects a non-numeric or out-of-range --port", () => {
    expectFail(["--mcp", "--transport", "http", "--port", "abc"], /invalid --port/);
    expectFail(["--mcp", "--transport", "http", "--port", "70000"], /invalid --port/);
    expectFail(["--mcp", "--transport", "http", "--port", "80.5"], /invalid --port/);
  });

  it("keeps --port 0 (an ephemeral port) and the default", () => {
    expect(parseArgs(["--mcp", "--transport", "http", "--port", "0"]).mcpServer?.port).toBe(0);
    expect(parseArgs(["--mcp"]).mcpServer?.port).toBe(7343);
  });

  it("rejects a non-integer --max-response-bytes / --max-embed-bytes", () => {
    expectFail(["--mcp", "--max-response-bytes", "abc"], /invalid --max-response-bytes/);
    expectFail(["--mcp", "--max-response-bytes", "1.5"], /invalid --max-response-bytes/);
    expectFail(["--repo", REPO, "--max-embed-bytes", "0.5"], /invalid --max-embed-bytes/);
  });
});

describe("parseArgs: --include / --exclude brace lists", () => {
  it("expands a {a,b} brace list instead of splitting it on its comma", () => {
    const o = parseArgs(["--repo", REPO, "--include", "src/**/*.{ts,tsx}"]);
    expect(o.include).toEqual(["src/**/*.ts", "src/**/*.tsx"]);
  });

  it("still splits top-level comma lists and expands each entry", () => {
    const o = parseArgs(["--repo", REPO, "--exclude", "docs/**, {a,b}/{x,y}.md"]);
    expect(o.exclude).toEqual(["docs/**", "a/x.md", "a/y.md", "b/x.md", "b/y.md"]);
  });

  it("leaves an unbalanced brace literal", () => {
    expect(parseArgs(["--repo", REPO, "--include", "weird{name"]).include).toEqual(["weird{name"]);
  });
});

describe("parseArgs: a modifier flag needs the mode it modifies", () => {
  const cases: [string, string[], RegExp][] = [
    [
      "--apply without --verify/--review/--unknowns (would re-render the tree)",
      ["--apply", "v.json", "--out", "/tmp/x"],
      /--apply only applies to --verify, --review or --unknowns/,
    ],
    ["--semantic without --check", ["--verify", "--semantic", "--out", "/tmp/x"], /--semantic and --allow-unverified only apply to --check/],
    ["--allow-unverified without --check", ["--review", "--allow-unverified", "--out", "/tmp/x"], /--semantic and --allow-unverified only apply to --check/],
    ["--phase without --orchestrate", ["--check", "--phase", "enrich-map", "--out", "/tmp/x"], /--phase.*only apply to --orchestrate/],
    ["--list without --orchestrate", ["--check", "--list", "--out", "/tmp/x"], /--phase.*only apply to --orchestrate/],
    ["--batch-size without --orchestrate", ["--verify", "--batch-size", "4", "--out", "/tmp/x"], /--phase.*only apply to --orchestrate/],
    ["--max-verify without --verify", ["--check", "--max-verify", "9", "--out", "/tmp/x"], /--max-verify only applies to --verify/],
    ["MCP server flags without --mcp", ["--repo", REPO, "--port", "9000"], /only apply to --mcp/],
    ["--allow-write without --mcp", ["--repo", REPO, "--allow-write"], /only apply to --mcp/],
    ["--plan without --scratch", ["--repo", REPO, "--plan", "p.json"], /--plan only applies to --scratch/],
    ["a bundle flag with a validation action", ["--check", "--specs", "--out", "/tmp/x"], /cannot be combined with --check/],
    ["--scratch with a validation action", ["--check", "--scratch", "--plan", "p.json", "--out", "/tmp/x"], /cannot be combined with --check/],
  ];
  for (const [label, argv, pattern] of cases) {
    it(`rejects ${label}`, () => expectFail(argv, pattern));
  }

  it("keeps every documented combination", () => {
    for (const argv of [
      ["--check", "--semantic", "--allow-unverified", "--out", "/tmp/x"],
      ["--verify", "--apply", "v.json", "--max-verify", "128", "--out", "/tmp/x"],
      ["--review", "--apply", "f.json", "--out", "/tmp/x"],
      ["--unknowns", "--apply", "u.json", "--out", "/tmp/x"],
      ["--orchestrate", "--phase", "enrich-map", "--eco", "--batch-size", "4", "--out", "/tmp/x"],
      ["--orchestrate", "--list", "--out", "/tmp/x"],
      ["--mcp", "--transport", "http", "--port", "7343", "--allow-write", "--out", "/tmp/x"],
      ["--scratch", "--plan", "p.json", "--out", "/tmp/x", "--level", "complex", "--tdd", "--specs"],
      ["--check", "--repo", REPO, "--out", "/tmp/x"],
    ]) {
      expect(() => parseArgs(argv)).not.toThrow();
    }
  });
});
