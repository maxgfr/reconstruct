#!/usr/bin/env node
// Vendor the shared engine into src/vendor/, pinned to a release tag.
//
//   codeindex (github.com/maxgfr/codeindex) — indexes the code you have locally
//
// A self-contained zero-dependency ESM bundle; tsup inlines it into
// scripts/analyze.mjs at build time, so the skill still ships as one file.
//
// The table below is a map rather than a single entry because the shape is the
// same one construct, ultradoc and ultrasearch use, where a second engine is
// also vendored. Keeping the scripts identical means a fix to the pin logic is
// one edit copied, not nine written.
//
//   node scripts/sync-engine.mjs --ref v2.27.1                   # pin every engine
//   node scripts/sync-engine.mjs --engine codeindex --ref v2.27.1
//   node scripts/sync-engine.mjs --check                         # offline gate (CI)
//
// The fetched bytes are written UNMODIFIED (byte-identical to upstream). Each
// engine carries its own pin file ({ tag, engineVersion, sha256, syncedAt }), so
// re-pinning one never disturbs the other's recorded hashes, and --check
// re-hashes every vendored file against them.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendorDir = join(root, "src", "vendor");

const ENGINES = {
  codeindex: {
    repo: "maxgfr/codeindex",
    // The oldest engine release this repo's SOURCE is written against. Bump it in
    // the SAME commit that deletes a local copy in favour of an engine export.
    //
    // Why this exists: --check re-hashes the vendored bytes against the pin, so it
    // catches a TAMPERED vendor but not a STALE one. A repo pinned three releases
    // back passes cleanly — and because tsup INLINES the vendored bundle, it then
    // ships the old behaviour with every test green, measuring the wrong code.
    // This turns that silence into a failed build.
    minRef: "v2.27.1",
    meta: "engine.meta.json",
    files: [
      { remote: "scripts/engine.mjs", local: "codeindex-engine.mjs" },
      { remote: "scripts/engine.d.mts", local: "codeindex-engine.d.mts" },
    ],
  },
};

// Compare two `vX.Y.Z` tags. Returns <0, 0, >0 like a sort comparator.
// Numeric per component — "v1.10.0" is NEWER than "v1.9.0", which a string
// compare gets backwards, and getting it backwards here would silently disarm
// the staleness gate at exactly the release where it starts to matter.
function cmpTag(a, b) {
  const parts = (t) => String(t).replace(/^v/, "").split(".").map((n) => Number.parseInt(n, 10) || 0);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const args = process.argv.slice(2);

// `--list` prints one `<name> <repo> <pinned-tag>` line per engine. The daily
// re-pin workflow reads it instead of carrying its own copy of this table, so
// adding an engine here is the only edit needed — the automation cannot drift
// from the list it is supposed to be watching.
if (args[0] === "--list") {
  for (const [name, { repo, meta }] of Object.entries(ENGINES)) {
    let tag = "-";
    try {
      tag = JSON.parse(readFileSync(join(vendorDir, meta), "utf8")).tag;
    } catch {}
    console.log(`${name} ${repo} ${tag}`);
  }
  process.exit(0);
}

function selected() {
  const i = args.indexOf("--engine");
  if (i === -1) return Object.keys(ENGINES);
  const name = args[i + 1];
  if (!ENGINES[name]) {
    console.error(`sync-engine: unknown engine "${name ?? ""}" — expected one of ${Object.keys(ENGINES).join(", ")}`);
    process.exit(1);
  }
  return [name];
}

if (args[0] === "--check") {
  let ok = true;
  for (const name of Object.keys(ENGINES)) {
    const { meta: metaFile, files, minRef } = ENGINES[name];
    let meta;
    try {
      meta = JSON.parse(readFileSync(join(vendorDir, metaFile), "utf8"));
    } catch {
      console.error(`sync-engine: no src/vendor/${metaFile} — run \`node scripts/sync-engine.mjs --engine ${name} --ref <tag>\` first`);
      ok = false;
      continue;
    }
    let engineOk = true;
    for (const f of files) {
      const actual = sha256(readFileSync(join(vendorDir, f.local)));
      if (actual !== meta.sha256[f.local]) {
        console.error(`sync-engine: DRIFT in src/vendor/${f.local} — vendored bytes differ from the ${meta.tag} pin`);
        engineOk = false;
      }
    }
    if (engineOk && cmpTag(meta.tag, minRef) < 0) {
      console.error(`sync-engine: STALE ${name} pin — vendored ${meta.tag}, but this repo's source needs at least ${minRef}.`);
      console.error(`  run: node scripts/sync-engine.mjs --engine ${name} --ref ${minRef}   (or newer)`);
      engineOk = false;
    }
    if (engineOk) console.log(`sync-engine: ${name} matches the ${meta.tag} pin (${meta.engineVersion})`);
    ok &&= engineOk;
  }
  process.exit(ok ? 0 : 1);
}

const refIdx = args.indexOf("--ref");
const ref = refIdx !== -1 ? args[refIdx + 1] : undefined;
if (!ref) {
  console.error("usage: sync-engine.mjs [--engine <name>] --ref <tag>   |   sync-engine.mjs --check");
  process.exit(1);
}

mkdirSync(vendorDir, { recursive: true });
for (const name of selected()) {
  const { repo, meta: metaFile, files } = ENGINES[name];
  const sums = {};
  for (const f of files) {
    const url = `https://raw.githubusercontent.com/${repo}/${ref}/${f.remote}`;
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
    console.error(`sync-engine: ${name} bundle says ENGINE_VERSION=${version ?? "?"} but the pinned ref is ${ref}`);
    process.exit(1);
  }

  writeFileSync(
    join(vendorDir, metaFile),
    JSON.stringify({ tag: ref, engineVersion: version, sha256: sums, syncedAt: new Date().toISOString() }, null, 2) + "\n",
  );
  console.log(`sync-engine: pinned ${name} ${ref}`);
}
