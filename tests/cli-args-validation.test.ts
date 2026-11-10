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
