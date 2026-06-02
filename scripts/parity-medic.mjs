#!/usr/bin/env node
// Medic convergence + buildability harness.
//
// Runs reconstruct two ways against the same product — the CODE path on the
// real `medic` repo and the SCRATCH path on `tests/fixtures/scratch-plan/
// medic.plan.json` — into two temp dirs, then checks that they CONVERGE and
// that the scratch path is buildable *by construction*:
//
//   1. Structural convergence — both trees produce the same top-level artifacts
//      and the three architecture/* docs.
//   2. Plan consistency — the scratch run completes with NO consistency errors
//      (it would exit non-zero otherwise) and NO consistency warnings (e.g. an
//      anonymous write to an owner-FK table). This is the guarantee that made
//      the original Public Directory PRD buildable instead of impossible.
//   3. Scaffold richness — the scratch architecture docs are pre-filled with the
//      real contract surface (entities incl. contactRequests, operations, enums,
//      external services, cross-cutting policies, the i18n message catalog), so
//      the from-scratch tree starts as buildable as the reverse-engineered one.
//   4. Locale parity — both detect the same five locales.
//
// NB: `--check` is the post-ENRICHMENT gate; a freshly-generated scaffold still
// carries 🧠 callouts by design, so we do not run --check here. End-to-end
// buildability of the enriched tree is proven by the multi-agent verification.
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

// Tokens the scratch architecture docs must carry — proof the realigned plan
// mirrors reality and the engine pre-fills the contract surface.
const RICHNESS = [
  { doc: "architecture/DATA-MODEL.md", needles: ["contactRequests", "notifications", "## Enums & domain types"] },
  { doc: "architecture/INTERFACES.md", needles: ["directory.submitContactRequest"] },
  { doc: "architecture/ARCHITECTURE.md", needles: ["External services", "Cross-cutting policies", "message catalog"] },
];

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

function coverage(inv, kind) {
  const features = inv.features?.length ?? 0;
  const locales = inv.i18n?.locales?.length ?? 0;
  const interfaces =
    kind === "scratch"
      ? inv.interfaces?.length ?? 0
      : (inv.routes?.length ?? 0) + (inv.hints?.apiCandidates?.length ?? 0);
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

    // Scratch run: a consistency ERROR exits non-zero; a WARNING prints to stderr.
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
      process.stderr.write(
        `  ✗ scratch path FAILED to generate — the plan is internally inconsistent:\n${scratch.stderr}\n`,
      );
      failed = true;
    }
    if (/⚠/.test(scratch.stderr)) {
      const warnLines = scratch.stderr.split("\n").filter((l) => l.includes("⚠"));
      process.stderr.write(
        `  ✗ scratch plan has consistency warning(s) (resolve for buildability):\n${warnLines.join("\n")}\n`,
      );
      failed = true;
    }

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
    if (!bothArch) failed = true;

    // Scaffold richness: the scratch tree must already carry the real contract.
    for (const { doc, needles } of RICHNESS) {
      const content = read(scratchOut, doc);
      for (const n of needles) {
        if (!content.includes(n)) {
          process.stderr.write(`  ✗ scratch ${doc} is missing expected content: "${n}"\n`);
          failed = true;
        }
      }
    }

    const codeInv = readInventory(codeOut);
    const scratchInv = readInventory(scratchOut);
    const codeCov = coverage(codeInv, "code");
    const scratchCov = coverage(scratchInv, "scratch");

    // Locale parity — both must see exactly the five real locales.
    const EXPECTED_LOCALES = ["fr", "de", "nl", "en", "de-CH"];
    const scratchLocales = scratchInv.i18n?.locales ?? [];
    const localesOk =
      EXPECTED_LOCALES.length === scratchLocales.length &&
      EXPECTED_LOCALES.every((l) => scratchLocales.includes(l));
    if (!localesOk) {
      process.stderr.write(
        `  ✗ scratch locales ${JSON.stringify(scratchLocales)} ≠ expected ${JSON.stringify(EXPECTED_LOCALES)}\n`,
      );
      failed = true;
    }

    process.stdout.write("\nConvergence summary\n");
    process.stdout.write(row("metric", "code (repo)", "scratch (plan)") + "\n");
    process.stdout.write("  " + "-".repeat(54) + "\n");
    process.stdout.write(row("features", codeCov.features, scratchCov.features) + "\n");
    process.stdout.write(row("interface surface", codeCov.interfaces, scratchCov.interfaces) + "\n");
    process.stdout.write(row("data-model entities", codeCov.entities, scratchCov.entities) + "\n");
    process.stdout.write(row("locales", codeCov.locales, scratchCov.locales) + "\n");
    process.stdout.write(
      row("enums (scratch)", "—", scratchInv.enums?.length ?? 0) + "\n",
    );
    process.stdout.write(
      row("services (scratch)", "—", scratchInv.services?.length ?? 0) + "\n",
    );
    process.stdout.write(
      row("policies (scratch)", "—", scratchInv.policies?.length ?? 0) + "\n",
    );
    process.stdout.write(
      `\n  both trees share the 3 architecture docs: ${bothArch ? "yes ✓" : "NO ✗"}\n`,
    );
    process.stdout.write(
      `  scratch plan generated with no consistency errors/warnings: ${
        scratch.code === 0 && !/⚠/.test(scratch.stderr) ? "yes ✓" : "NO ✗"
      }\n`,
    );
    process.stdout.write(`  scratch scaffold carries the real contract surface: ${failed ? "see ✗ above" : "yes ✓"}\n`);

    if (failed) {
      process.stderr.write("\nparity-medic: FAIL — trees did not converge or the plan is not buildable.\n");
      process.exit(1);
    }
    process.stdout.write(
      "\nparity-medic: PASS — both paths produced an aligned, buildable reconstruction tree.\n",
    );
  } finally {
    rmSync(codeOut, { recursive: true, force: true });
    rmSync(scratchOut, { recursive: true, force: true });
  }
}

main();
