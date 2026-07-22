#!/usr/bin/env node
// Vendor the codeindex engine (https://github.com/maxgfr/codeindex) into
// src/vendor/, pinned to a release tag. The engine is a self-contained
// zero-dependency ESM bundle; tsup inlines it into scripts/analyze.mjs at
// build time, so the skill still ships as one file.
//
//   node scripts/sync-engine.mjs --ref v1.1.1   # fetch + pin
//   node scripts/sync-engine.mjs --check        # offline drift/tamper gate (CI)
//
// The fetched bytes are written UNMODIFIED (byte-identical to upstream) —
// engine.meta.json carries the pin ({ tag, engineVersion, sha256, syncedAt }),
// and --check re-hashes the vendored files against it.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendorDir = join(root, "src", "vendor");
const files = [
  { remote: "scripts/engine.mjs", local: "codeindex-engine.mjs" },
  { remote: "scripts/engine.d.mts", local: "codeindex-engine.d.mts" },
];
const metaPath = join(vendorDir, "engine.meta.json");

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const args = process.argv.slice(2);
if (args[0] === "--check") {
  let meta;
  try {
    meta = JSON.parse(readFileSync(metaPath, "utf8"));
  } catch {
    console.error("sync-engine: no engine.meta.json — run `node scripts/sync-engine.mjs --ref <tag>` first");
    process.exit(1);
  }
  let ok = true;
  for (const f of files) {
    const actual = sha256(readFileSync(join(vendorDir, f.local)));
    if (actual !== meta.sha256[f.local]) {
      console.error(`sync-engine: DRIFT in src/vendor/${f.local} — vendored bytes differ from the ${meta.tag} pin`);
      ok = false;
    }
  }
  if (!ok) process.exit(1);
  console.log(`sync-engine: vendored engine matches the ${meta.tag} pin (${meta.engineVersion})`);
  process.exit(0);
}

const refIdx = args.indexOf("--ref");
const ref = refIdx !== -1 ? args[refIdx + 1] : undefined;
if (!ref) {
  console.error("usage: sync-engine.mjs --ref <tag>   |   sync-engine.mjs --check");
  process.exit(1);
}

mkdirSync(vendorDir, { recursive: true });
const sums = {};
for (const f of files) {
  const url = `https://raw.githubusercontent.com/maxgfr/codeindex/${ref}/${f.remote}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`sync-engine: ${url} -> HTTP ${res.status}`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(vendorDir, f.local), buf);
  sums[f.local] = sha256(buf);
  console.log(`sync-engine: src/vendor/${f.local} (${buf.length} bytes)`);
}

// The bundle embeds its version greppably — refuse a tag/content mismatch.
const bundle = readFileSync(join(vendorDir, files[0].local), "utf8");
const version = bundle.match(/ENGINE_VERSION = "([^"]+)"/)?.[1];
if (!version || `v${version}` !== ref) {
  console.error(`sync-engine: bundle says ENGINE_VERSION=${version ?? "?"} but the pinned ref is ${ref}`);
  process.exit(1);
}

writeFileSync(
  metaPath,
  JSON.stringify({ tag: ref, engineVersion: version, sha256: sums, syncedAt: new Date().toISOString() }, null, 2) + "\n",
);
console.log(`sync-engine: pinned codeindex ${ref}`);
