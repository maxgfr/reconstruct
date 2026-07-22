import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyze } from "../src/analyze.js";
import type { Inventory, Options } from "../src/types.js";

// Golden snapshot of the full `describe` inventory over a purpose-built fixture:
// an npm-workspaces monorepo with one cargo member, a .gitignored file (root and
// nested .gitignore), and a categorization spread (i18n / schema / test / style /
// doc / asset / data / other). Any behavioral drift in the analyzer — walker,
// categorization, language histogram, workspace detection, routes, i18n —
// surfaces here as a diff that must be adjudicated, never absorbed silently.
//
// Regenerate deliberately with: UPDATE_GOLDEN=1 pnpm vitest run tests/golden-inventory.test.ts

const REPO = fileURLToPath(new URL("./fixtures/golden-monorepo", import.meta.url));
const GOLDEN = fileURLToPath(new URL("./fixtures/golden-monorepo.inventory.json", import.meta.url));

const opts: Options = {
  repo: REPO,
  out: join(tmpdir(), "reconstruct-golden-out"),
  mode: "preserve",
  level: "light",
  fidelity: "describe",
  granularity: "coarse",
  include: [],
  exclude: [],
  json: true,
  maxEmbedBytes: 16000,
  merge: false,
  summary: false,
  features: false,
  specs: false,
  standalone: false,
  scratch: false,
  plan: "",
  tdd: false,
  check: false,
};

/** Strip volatile fields (the version stamp) so the golden survives releases. */
function normalize(inv: Inventory): Inventory {
  return { ...inv, generatedWith: "reconstruct@GOLDEN" };
}

describe("golden inventory (describe) over the monorepo fixture", () => {
  it("matches the committed golden byte-for-byte (modulo the version stamp)", () => {
    const norm = normalize(analyze(opts));
    if (process.env.UPDATE_GOLDEN) {
      writeFileSync(GOLDEN, JSON.stringify(norm, null, 2) + "\n");
      return;
    }
    const golden = JSON.parse(readFileSync(GOLDEN, "utf8")) as Inventory;
    expect(norm).toEqual(golden);
  });
});
