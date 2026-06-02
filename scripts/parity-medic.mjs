#!/usr/bin/env node
// Medic convergence harness.
//
// Runs reconstruct two ways against the same product — the CODE path on the
// real `medic` repo and the SCRATCH path on `tests/fixtures/scratch-plan/
// medic.plan.json` — into two temp dirs, then structurally diffs the trees:
// both must produce the same top-level artifacts and the three architecture/*
// docs. It reports feature / interface / data-model / locale coverage side by
// side and prints a convergence summary. Exit non-zero if a generated artifact
// is missing from either tree.
//
// Usage: node scripts/parity-medic.mjs [path-to-medic-repo]
//   default medic repo: ~/Downloads/medic (override with the arg or MEDIC_REPO)

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const analyzer = join(repoRoot, "scripts", "analyze.mjs");
const planFile = join(repoRoot, "tests", "fixtures", "scratch-plan", "medic.plan.json");

const medicRepo = resolve(
  process.argv[2] ?? process.env.MEDIC_REPO ?? join(homedir(), "Downloads", "medic"),
);

// Artifacts both fronts must produce for the trees to be considered aligned.
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

function run(args) {
  execFileSync("node", [analyzer, ...args], { stdio: ["ignore", "ignore", "inherit"] });
}

function readInventory(dir) {
  return JSON.parse(readFileSync(join(dir, "inventory.json"), "utf8"));
}

function missing(dir, rels) {
  return rels.filter((r) => !existsSync(join(dir, r)));
}

function coverage(inv, kind) {
  const features = inv.features?.length ?? 0;
  const locales = inv.i18n?.locales?.length ?? 0;
  // Code mode surfaces routes + API candidates; scratch mode pre-fills interfaces.
  const interfaces =
    kind === "scratch"
      ? inv.interfaces?.length ?? 0
      : (inv.routes?.length ?? 0) + (inv.hints?.apiCandidates?.length ?? 0);
  // Code mode surfaces schema files/candidates; scratch mode pre-fills entities.
  const entities =
    kind === "scratch"
      ? inv.dataModel?.length ?? 0
      : (inv.schemas?.length ?? 0) + (inv.hints?.schemaCandidates?.length ?? 0);
  return { features, interfaces, entities, locales };
}

function pad(s, n) {
  return String(s).padEnd(n);
}

function row(label, code, scratch) {
  return `  ${pad(label, 22)} ${pad(code, 16)} ${scratch}`;
}

function main() {
  if (!existsSync(medicRepo)) {
    process.stderr.write(
      `parity-medic: medic repo not found at ${medicRepo}\n` +
        `  Pass the path (node scripts/parity-medic.mjs <medic>) or set MEDIC_REPO.\n` +
        `  Skipping the code path; nothing to compare. (Not a failure.)\n`,
    );
    process.exit(0);
  }

  const codeOut = mkdtempSync(join(tmpdir(), "parity-code-"));
  const scratchOut = mkdtempSync(join(tmpdir(), "parity-scratch-"));
  let failed = false;
  try {
    process.stdout.write(`parity-medic: medic repo = ${medicRepo}\n`);
    run(["--repo", medicRepo, "--out", codeOut, "--mode", "preserve", "--level", "complex"]);
    run(["--scratch", "--plan", planFile, "--out", scratchOut, "--level", "complex"]);

    const codeMissing = missing(codeOut, REQUIRED);
    const scratchMissing = missing(scratchOut, REQUIRED);
    if (codeMissing.length) {
      process.stderr.write(`  ✗ code path missing: ${codeMissing.join(", ")}\n`);
      failed = true;
    }
    if (scratchMissing.length) {
      process.stderr.write(`  ✗ scratch path missing: ${scratchMissing.join(", ")}\n`);
      failed = true;
    }

    const bothArch = ARCH_DOCS.every(
      (d) => existsSync(join(codeOut, d)) && existsSync(join(scratchOut, d)),
    );

    const codeCov = coverage(readInventory(codeOut), "code");
    const scratchCov = coverage(readInventory(scratchOut), "scratch");

    process.stdout.write("\nConvergence summary\n");
    process.stdout.write(row("metric", "code (repo)", "scratch (plan)") + "\n");
    process.stdout.write("  " + "-".repeat(54) + "\n");
    process.stdout.write(row("features", codeCov.features, scratchCov.features) + "\n");
    process.stdout.write(row("interface surface", codeCov.interfaces, scratchCov.interfaces) + "\n");
    process.stdout.write(row("data-model entities", codeCov.entities, scratchCov.entities) + "\n");
    process.stdout.write(row("locales", codeCov.locales, scratchCov.locales) + "\n");
    process.stdout.write(
      `\n  both trees share the 3 architecture docs: ${bothArch ? "yes ✓" : "NO ✗"}\n`,
    );
    if (!bothArch) failed = true;

    if (failed) {
      process.stderr.write("\nparity-medic: FAIL — trees did not converge.\n");
      process.exit(1);
    }
    process.stdout.write(
      "\nparity-medic: PASS — both paths produced an aligned reconstruction tree.\n",
    );
  } finally {
    rmSync(codeOut, { recursive: true, force: true });
    rmSync(scratchOut, { recursive: true, force: true });
  }
}

main();
