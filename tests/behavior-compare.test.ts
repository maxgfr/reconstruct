import { afterEach, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareBehavior } from "../src/behavior.js";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "rc-behavior-"));
  dirs.push(root);
  const originalDir = join(root, "original"),
    rebuiltDir = join(root, "rebuilt");
  mkdirSync(originalDir);
  mkdirSync(rebuiltDir);
  for (const dir of [originalDir, rebuiltDir])
    writeFileSync(join(dir, "main.mjs"), "let s='';for await(const c of process.stdin)s+=c;console.log(s.toUpperCase());");
  const specPath = join(root, "cases.json");
  const spec = {
    schemaVersion: 1,
    cases: [
      {
        id: "uppercase",
        stdin: "hello",
        original: { command: process.execPath, args: ["main.mjs"] },
        rebuilt: { command: process.execPath, args: ["main.mjs"] },
        timeoutMs: 2000,
      },
    ],
  };
  const save = () => writeFileSync(specPath, JSON.stringify(spec));
  save();
  const compare = (runTests = true) => compareBehavior(specPath, { originalDir, rebuiltDir, runTests });
  return { root, originalDir, rebuiltDir, spec, save, compare };
}
it("compares the same input and records observed outputs, without claiming global equivalence", () => {
  const f = fixture();
  const result = f.compare();
  expect(result.ok).toBe(true);
  expect(result.cases[0]?.original?.stdout).toBe("HELLO\n");
  expect(result.cases[0]?.rebuilt?.stdout).toBe("HELLO\n");
  expect(result.scope).toMatch(/only|exercised/i);
});
it("does not execute without explicit authority", () => {
  const f = fixture();
  writeFileSync(join(f.originalDir, "main.mjs"), "import fs from 'node:fs';fs.writeFileSync('executed','yes');");
  expect(f.compare(false).cases[0]?.status).toBe("not-tested");
  expect(existsSync(join(f.originalDir, "executed"))).toBe(false);
});
it("rejects zero cases and duplicate case ids", () => {
  const f = fixture();
  f.spec.cases.push(f.spec.cases[0]!);
  f.save();
  expect(() => f.compare()).toThrow(/unique/i);
  f.spec.cases = [];
  f.save();
  expect(() => f.compare()).toThrow(/case/i);
});
it("compares bytes without accepting different invalid UTF-8 as equal replacement characters", () => {
  const f = fixture();
  writeFileSync(join(f.originalDir, "main.mjs"), "process.stdout.write(Buffer.from([255]));");
  writeFileSync(join(f.rebuiltDir, "main.mjs"), "process.stdout.write(Buffer.from([254]));");
  expect(f.compare().ok).toBe(false);
});
it("requires different trees and validates every command before executing any case", () => {
  const f = fixture();
  expect(() => compareBehavior(join(f.root, "cases.json"), { originalDir: f.originalDir, rebuiltDir: f.originalDir, runTests: true })).toThrow(/distinct/);
  f.spec.cases.push({ ...f.spec.cases[0]!, id: "malformed", original: { command: "", args: [] } });
  f.save();
  writeFileSync(join(f.originalDir, "main.mjs"), "import fs from 'node:fs';fs.writeFileSync('executed','yes');");
  expect(() => f.compare()).toThrow(/command/);
  expect(existsSync(join(f.originalDir, "executed"))).toBe(false);
});
it("allows matching negative behavior only with an explicit expected exit", () => {
  const f = fixture();
  for (const dir of [f.originalDir, f.rebuiltDir]) writeFileSync(join(dir, "main.mjs"), "console.error('invalid input');process.exit(2)");
  Object.assign(f.spec.cases[0]!, { expectedExitCode: 2 });
  f.save();
  expect(f.compare().ok).toBe(true);
});

it.skipIf(process.platform === "win32")("cleans the owned process group on timeout, including ordinary children", async () => {
  const f = fixture();
  f.spec.cases[0]!.timeoutMs = 100;
  f.save();
  for (const dir of [f.originalDir, f.rebuiltDir]) {
    writeFileSync(join(dir, "child.mjs"), "import fs from 'node:fs';setTimeout(()=>fs.writeFileSync('escaped','yes'),700);");
    writeFileSync(
      join(dir, "main.mjs"),
      "import {spawn} from 'node:child_process';spawn(process.execPath,['child.mjs'],{stdio:'ignore'});setInterval(()=>{},1000);",
    );
  }
  expect(f.compare().ok).toBe(false);
  await new Promise((resolve) => setTimeout(resolve, 800));
  expect(existsSync(join(f.originalDir, "escaped"))).toBe(false);
  expect(existsSync(join(f.rebuiltDir, "escaped"))).toBe(false);
});
it.each(["divergence", "timeout", "missing", "both-fail", "overflow"])("rejects %s instead of accepting equal failures", (kind) => {
  const f = fixture();
  if (kind === "missing") f.spec.cases[0]!.rebuilt.command = "no-such-audit-binary";
  else if (kind === "timeout") {
    f.spec.cases[0]!.timeoutMs = 100;
    writeFileSync(join(f.rebuiltDir, "main.mjs"), "setInterval(()=>{},1000)");
  } else if (kind === "both-fail") for (const dir of [f.originalDir, f.rebuiltDir]) writeFileSync(join(dir, "main.mjs"), "process.exit(1)");
  else writeFileSync(join(f.rebuiltDir, "main.mjs"), kind === "overflow" ? "console.log('x'.repeat(100000))" : "console.log('DIFFERENT')");
  f.save();
  expect(f.compare().ok).toBe(false);
});
