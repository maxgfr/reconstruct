#!/usr/bin/env node
// Compatibility entry point; maintenance logic lives in the pinned WebIndex CLI.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const cli = fileURLToPath(new URL("../node_modules/@maxgfr/webindex/scripts/webindex.mjs", import.meta.url));
const result = spawnSync(process.execPath, [cli, "skill", "check", ...process.argv.slice(2)], { cwd: root, stdio: "inherit" });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
