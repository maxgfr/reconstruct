#!/usr/bin/env node
// Generic convergence + buildability-by-construction harness.
//
// Runs reconstruct on a from-scratch plan.json (and, optionally, on a real repo)
// and checks that the output is buildable *by construction* — without any
// hardcoded knowledge of a specific product. Everything it asserts is DERIVED
// from the plan itself, so it works for ANY plan.json:
//
//   1. Plan consistency — the SCRATCH run completes with NO consistency errors
//      (it would exit non-zero otherwise) and NO consistency warnings (e.g. an
//      anonymous write to an owner-FK table). A plan that passes is buildable
//      by construction instead of impossible.
//   2. Scaffold richness (derived) — every entity, enum, interface, service and
//      policy the plan DECLARES is pre-filled into the matching architecture doc,
//      and every declared locale is detected. The expectations are read from the
//      plan; nothing is product-specific.
//   3. Structural convergence (only with --repo) — the CODE path and the SCRATCH
//      path both produce the same top-level artifacts and the three architecture
//      docs, so the two fronts converge on one tree.
//
// NB: `--check` is the post-ENRICHMENT gate; a freshly-generated scaffold still
// carries 🧠 callouts by design, so we do NOT run --check here. End-to-end
// buildability of the enriched tree is proven by the multi-agent verification.
//
// Usage:
//   node scripts/parity.mjs --plan <plan.json> [--repo <repo>] [--locales a,b,...]
//     --plan     required; the from-scratch plan to render and validate
//     --repo     optional; also run the code path and check structural convergence
//     --locales  optional; override the expected locale set (default: plan.i18n.locales)

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const analyzer = join(repoRoot, "scripts", "analyze.mjs");

// Artifacts every reconstruction front must produce for the trees to be aligned.
const REQUIRED = [
  "REBUILD.md",
  "00-overview/PRD.md",
  "architecture/ARCHITECTURE.md",
  "architecture/INTERFACES.md",
  "architecture/DATA-MODEL.md",
  "inventory.json",
];
const ARCH_DOCS = [
  "architecture/ARCHITECTURE.md",
  "architecture/INTERFACES.md",
  "architecture/DATA-MODEL.md",
];

function usage(msg) {
  if (msg) process.stderr.write(`parity: ${msg}\n`);
  process.stderr.write(
    "Usage: node scripts/parity.mjs --plan <plan.json> [--repo <repo>] [--locales a,b,...]\n",
  );
  process.exit(msg ? 1 : 0);
}

/** Minimal --key value / --key=value parser for the three flags we accept. */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") usage();
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    let key, value;
    if (eq !== -1) {
      key = arg.slice(2, eq);
      value = arg.slice(eq + 1);
    } else {
      key = arg.slice(2);
      value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) usage(`missing value for --${key}`);
      i++;
    }
    out[key] = value;
  }
  return out;
}

function run(args) {
  execFileSync("node", [analyzer, ...args], { stdio: ["ignore", "ignore", "inherit"] });
}

/** Run the analyzer and capture stderr (where the run summary + warnings land). */
function runCapture(args) {
  try {
    const stdout = execFileSync("node", [analyzer, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    return { code: 0, stdout, stderr: "" };
  } catch (e) {
    return { code: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

function readInventory(dir) {
  return JSON.parse(readFileSync(join(dir, "inventory.json"), "utf8"));
}

function read(dir, rel) {
  const p = join(dir, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

function missing(dir, rels) {
  return rels.filter((r) => !existsSync(join(dir, r)));
}

function names(list, key) {
  return (list ?? []).map((x) => (typeof x === "string" ? x : x?.[key])).filter(Boolean);
}

function pad(s, n) {
  return String(s).padEnd(n);
}
function row(label, code, scratch) {
  return `  ${pad(label, 22)} ${pad(code, 16)} ${scratch}`;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.plan) usage("--plan <plan.json> is required");
  const planFile = resolve(opts.plan);
  if (!existsSync(planFile)) usage(`plan not found: ${planFile}`);

  let plan;
  try {
    plan = JSON.parse(readFileSync(planFile, "utf8"));
  } catch (e) {
    usage(`plan.json is not valid JSON: ${e.message}`);
  }

  const repo = opts.repo ? resolve(opts.repo) : null;
  if (repo && (!existsSync(repo) || !statSync(repo).isDirectory())) {
    usage(`--repo is not a directory: ${repo}`);
  }

  // Expectations DERIVED from the plan — nothing product-specific.
  const expect = {
    entities: names(plan.dataModel, "entity"),
    enums: names(plan.enums, "name"),
    interfaces: names(plan.interfaces, "path"),
    services: names(plan.services, "name"),
    policies: names(plan.policies, "name"),
    designComponents: names(plan.designSystem?.components, "name"),
    locales: opts.locales
      ? opts.locales.split(",").map((s) => s.trim()).filter(Boolean)
      : plan.i18n?.locales ?? [],
  };

  const scratchOut = mkdtempSync(join(tmpdir(), "parity-scratch-"));
  const codeOut = repo ? mkdtempSync(join(tmpdir(), "parity-code-")) : null;
  let failed = false;
  const fail = (msg) => {
    process.stderr.write(`  ✗ ${msg}\n`);
    failed = true;
  };

  try {
    process.stdout.write(`parity: plan = ${planFile}\n`);

    // 1. Scratch path: a consistency ERROR exits non-zero; a WARNING prints to stderr.
    const scratch = runCapture([
      "--scratch",
      "--plan",
      planFile,
      "--out",
      scratchOut,
      "--level",
      "complex",
    ]);
    if (scratch.code !== 0) {
      fail(`scratch path FAILED to generate — the plan is internally inconsistent:\n${scratch.stderr}`);
    }
    if (/⚠/.test(scratch.stderr)) {
      const warnLines = scratch.stderr.split("\n").filter((l) => l.includes("⚠"));
      fail(`scratch plan has consistency warning(s) (resolve for buildability):\n${warnLines.join("\n")}`);
    }

    // 2. Structural: required artifacts present in the scratch tree.
    const scratchMissing = missing(scratchOut, REQUIRED);
    if (scratchMissing.length) fail(`scratch path missing: ${scratchMissing.join(", ")}`);

    // 3. Scaffold richness — every declared token is pre-filled into its doc.
    //    A missing token means the renderer dropped a declared contract: a real
    //    buildability gap, so we fail (and report) rather than allowlist.
    const dm = read(scratchOut, "architecture/DATA-MODEL.md");
    const itf = read(scratchOut, "architecture/INTERFACES.md");
    const arch = read(scratchOut, "architecture/ARCHITECTURE.md");
    const checkAll = (label, tokens, doc) => {
      const miss = tokens.filter((t) => !doc.includes(t));
      if (miss.length) fail(`${label}: ${miss.length}/${tokens.length} not pre-filled — ${miss.slice(0, 8).join(", ")}${miss.length > 8 ? " …" : ""}`);
    };
    checkAll("DATA-MODEL entities", expect.entities, dm);
    if (expect.enums.length) {
      if (!dm.includes("## Enums & domain types")) fail("DATA-MODEL.md is missing the `## Enums & domain types` section");
      checkAll("DATA-MODEL enums", expect.enums, dm);
    }
    checkAll("INTERFACES operations", expect.interfaces, itf);
    if (expect.services.length) {
      if (!/External services/i.test(arch)) fail("ARCHITECTURE.md is missing the `External services` section");
      checkAll("ARCHITECTURE services", expect.services, arch);
    }
    if (expect.policies.length) {
      if (!/Cross-cutting policies/i.test(arch)) fail("ARCHITECTURE.md is missing the `Cross-cutting policies` section");
      checkAll("ARCHITECTURE policies", expect.policies, arch);
    }
    if (expect.designComponents.length) {
      const ds = read(scratchOut, "architecture/DESIGN-SYSTEM.md");
      if (!/Design system/i.test(ds)) fail("DESIGN-SYSTEM.md is missing or carries no `Design system` heading");
      checkAll("DESIGN-SYSTEM components", expect.designComponents, ds);
    }
    if (expect.locales.length && !/message catalog/i.test(arch)) {
      fail("ARCHITECTURE.md is missing the i18n `message catalog`");
    }

    // 4. Locale parity — the scratch inventory must detect exactly the declared set.
    const scratchInv = readInventory(scratchOut);
    const scratchLocales = scratchInv.i18n?.locales ?? [];
    const localesOk =
      expect.locales.length === scratchLocales.length &&
      expect.locales.every((l) => scratchLocales.includes(l));
    if (!localesOk) {
      fail(`scratch locales ${JSON.stringify(scratchLocales)} ≠ expected ${JSON.stringify(expect.locales)}`);
    }

    // 5. Structural convergence with the code path (only when a repo is given).
    let codeInv = null;
    if (repo) {
      run(["--repo", repo, "--out", codeOut, "--mode", "preserve", "--level", "complex"]);
      const codeMissing = missing(codeOut, REQUIRED);
      if (codeMissing.length) fail(`code path missing: ${codeMissing.join(", ")}`);
      const bothArch = ARCH_DOCS.every(
        (d) => existsSync(join(codeOut, d)) && existsSync(join(scratchOut, d)),
      );
      if (!bothArch) fail("code and scratch trees do not share the three architecture docs");
      codeInv = readInventory(codeOut);
    } else {
      process.stdout.write("  (code path skipped — no --repo; running scratch buildability-by-construction only)\n");
    }

    // Convergence summary.
    const codeLocales = codeInv?.i18n?.locales?.length ?? "—";
    process.stdout.write("\nConvergence summary\n");
    process.stdout.write(row("metric", repo ? "code (repo)" : "code", "scratch (plan)") + "\n");
    process.stdout.write("  " + "-".repeat(54) + "\n");
    process.stdout.write(row("interfaces", repo ? (codeInv?.routes?.length ?? 0) + (codeInv?.hints?.apiCandidates?.length ?? 0) : "—", expect.interfaces.length) + "\n");
    process.stdout.write(row("data-model entities", repo ? (codeInv?.schemas?.length ?? 0) + (codeInv?.hints?.schemaCandidates?.length ?? 0) : "—", expect.entities.length) + "\n");
    process.stdout.write(row("enums (scratch)", "—", expect.enums.length) + "\n");
    process.stdout.write(row("services (scratch)", "—", expect.services.length) + "\n");
    process.stdout.write(row("policies (scratch)", "—", expect.policies.length) + "\n");
    process.stdout.write(row("design components (scr)", "—", expect.designComponents.length) + "\n");
    process.stdout.write(row("locales", codeLocales, scratchLocales.length) + "\n");
    process.stdout.write(`\n  scratch plan generated with no consistency errors/warnings: ${scratch.code === 0 && !/⚠/.test(scratch.stderr) ? "yes ✓" : "NO ✗"}\n`);
    process.stdout.write(`  scratch scaffold carries the declared contract surface: ${failed ? "see ✗ above" : "yes ✓"}\n`);
    if (repo) {
      process.stdout.write(`  both trees share the 3 architecture docs: ${failed ? "see ✗ above" : "yes ✓"}\n`);
    }

    if (failed) {
      process.stderr.write("\nparity: FAIL — the tree is not buildable-by-construction or the trees did not converge.\n");
      process.exit(1);
    }
    process.stdout.write(
      repo
        ? "\nparity: PASS — both paths produced an aligned, buildable-by-construction reconstruction tree.\n"
        : "\nparity: PASS — the scratch plan renders a buildable-by-construction reconstruction tree.\n",
    );
  } finally {
    rmSync(scratchOut, { recursive: true, force: true });
    if (codeOut) rmSync(codeOut, { recursive: true, force: true });
  }
}

main();
