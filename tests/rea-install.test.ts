import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { callTool } from "../src/mcp/handlers.js";
import { formatReaReport, type InstallReaDeps, installRea, REA_INSTALL_COMMAND, reaSupportsNode } from "../src/rea.js";

// Proposing rea: reconstruct says what rea is and exactly what will run, and
// installs only on a yes — never on its own, never from the MCP server.

const temps: string[] = [];
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

let base = "";
let binDir = "";

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "rc-rea-install-"));
  temps.push(base);
  binDir = join(base, "bin");
  mkdirSync(binDir);
});

/** A fake `npm install --global rea-agents`: drops an executable `rea` into binDir. */
function fakeInstall(): void {
  writeFileSync(join(binDir, "rea"), "#!/bin/sh\nexit 0\n");
  chmodSync(join(binDir, "rea"), 0o755);
}

function deps(over: Partial<InstallReaDeps> & { answers?: boolean[]; npmStatus?: number } = {}) {
  const lines: string[] = [];
  const runs: Array<{ command: string; args: string[] }> = [];
  const asked: string[] = [];
  const answers = [...(over.answers ?? [])];
  const d: InstallReaDeps = {
    env: { PATH: binDir },
    nodeVersion: "v24.22.1",
    interactive: true,
    ask: async (q) => {
      asked.push(q);
      return answers.shift() ?? false;
    },
    run: (command, args) => {
      runs.push({ command, args });
      if (args[0] === "install") {
        if ((over.npmStatus ?? 0) === 0) fakeInstall();
        return over.npmStatus ?? 0;
      }
      return 0;
    },
    log: (l) => lines.push(l),
    ...over,
  };
  return { d, lines, runs, asked, text: () => lines.join("\n") };
}

describe("installRea", () => {
  it("shows what rea is and the exact command before asking", async () => {
    const t = deps({ answers: [false] });
    expect(await installRea({ yes: false }, t.d)).toBe(2);
    expect(t.text()).toContain("https://github.com/morluto/rea");
    expect(t.text()).toContain(`This will run: ${REA_INSTALL_COMMAND.join(" ")}`);
    expect(t.asked).toEqual(["Install rea now? [y/N] "]);
    expect(t.runs).toEqual([]);
  });

  it("installs on yes, then offers rea setup", async () => {
    const t = deps({ answers: [true, true] });
    expect(await installRea({ yes: false }, t.d)).toBe(0);
    expect(t.runs[0]).toEqual({ command: process.platform === "win32" ? "npm.cmd" : "npm", args: ["install", "--global", "rea-agents"] });
    expect(t.runs[1]).toEqual({ command: join(binDir, "rea"), args: ["setup"] });
    expect(t.text()).toMatch(/✓ rea installed/);
    expect(t.text()).toMatch(/GHIDRA_INSTALL_DIR/);
  });

  it("without a terminal and without --yes, runs nothing and says how to confirm", async () => {
    const t = deps({ interactive: false });
    expect(await installRea({ yes: false }, t.d)).toBe(2);
    expect(t.runs).toEqual([]);
    expect(t.text()).toMatch(/re-run with --install-rea --yes/);
  });

  it("--yes installs without prompting and leaves rea setup to the user", async () => {
    const t = deps({ interactive: false });
    expect(await installRea({ yes: true }, t.d)).toBe(0);
    expect(t.asked).toEqual([]);
    expect(t.runs.map((r) => r.args[0])).toEqual(["install"]);
    expect(t.text()).toMatch(/Optional: `rea setup`/);
  });

  it("does nothing when rea is already installed", async () => {
    fakeInstall();
    const t = deps();
    expect(await installRea({ yes: true }, t.d)).toBe(0);
    expect(t.runs).toEqual([]);
    expect(t.text()).toMatch(/already installed/);
  });

  it("reports an npm failure, and a rea that did not land on PATH", async () => {
    const failed = deps({ npmStatus: 243 });
    expect(await installRea({ yes: true }, failed.d)).toBe(1);
    expect(failed.text()).toMatch(/exited 243/);
    const offPath = deps({ run: () => 0 });
    expect(await installRea({ yes: true }, offPath.d)).toBe(1);
    expect(offPath.text()).toMatch(/not on PATH/);
  });

  it("warns on a Node version rea does not support", async () => {
    const t = deps({ nodeVersion: "v24.19.0", answers: [false] });
    await installRea({ yes: false }, t.d);
    expect(t.text()).toMatch(/this is Node 24\.19\.0/);
  });
});

describe("reaSupportsNode", () => {
  it("follows rea's documented support", () => {
    for (const v of ["22.23.4", "v22.30.0", "24.22.1", "24.30.0", "26.12.1", "28.0.0"]) expect(reaSupportsNode(v), v).toBe(true);
    for (const v of ["20.11.0", "22.23.3", "23.5.0", "24.19.0", "25.0.0", "26.0.0", "27.1.0"]) expect(reaSupportsNode(v), v).toBe(false);
  });
});

describe("proposing it", () => {
  it("the CLI summary proposes --install-rea, and says off when it is off", () => {
    expect(formatReaReport({ status: "unavailable", artifacts: [] }, 2)).toMatch(/not installed — 2 compiled artifact.*--install-rea/);
    expect(formatReaReport({ status: "unavailable", artifacts: [] }, 2, "off")).toMatch(/off \(--rea off\)/);
  });

  describe("reconstruct_scaffold without rea", () => {
    const saved = process.env.REA_BIN;
    afterEach(() => {
      if (saved === undefined) delete process.env.REA_BIN;
      else process.env.REA_BIN = saved;
    });

    it("tells the agent to propose the install, and installs nothing", async () => {
      process.env.REA_BIN = join(base, "missing");
      const repo = join(base, "repo");
      mkdirSync(join(repo, "lib"), { recursive: true });
      writeFileSync(join(repo, "lib", "engine.wasm"), Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]));
      writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "app", version: "1.0.0" }));
      const res = JSON.parse((await callTool("reconstruct_scaffold", { repo, out: join(base, "tree") }, { allowWrite: true })).text);
      expect(res.rea.status).toBe("unavailable");
      expect(res.rea.install).toMatch(/Propose installing it to the user: `npm install --global rea-agents`/);
      const off = JSON.parse((await callTool("reconstruct_scaffold", { repo, out: join(base, "tree2"), rea: "off" }, { allowWrite: true })).text);
      expect(off.rea.install).toBeUndefined();
    });
  });
});
