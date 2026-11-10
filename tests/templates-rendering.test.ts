import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyze } from "../src/analyze.js";
import { diagramDoc, featurePrd, interfacesDoc } from "../src/prd/templates.js";
import type { Feature, Inventory, Options, RouteInfo } from "../src/types.js";

const REPO = fileURLToPath(new URL("./fixtures/express-app", import.meta.url));
const OPTS: Options = {
  repo: REPO,
  out: "/tmp/never-written",
  mode: "preserve",
  level: "light",
  fidelity: "describe",
  granularity: "coarse",
  include: [],
  exclude: [],
  json: false,
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
const base: Inventory = analyze(OPTS);
const feature = (slug: string, kind: Feature["kind"], routes: RouteInfo[] = []): Feature => ({ slug, name: slug, description: "", kind, files: [], routes });

describe("diagramDoc", () => {
  it("draws the data edge from each code feature's own node, not from a filtered index", () => {
    const inv: Inventory = {
      ...base,
      i18n: base.i18n ?? { locales: ["en"], files: [], defaultLocale: "en" },
      features: [feature("core", "feature"), feature("setup", "project-setup"), feature("i18n", "internationalization"), feature("auth", "feature")],
    } as Inventory;
    const doc = diagramDoc(inv);
    expect(doc).toContain("F0 --> DATA");
    expect(doc).toContain("F3 --> DATA");
    expect(doc).not.toContain("F1 --> DATA");
  });

  it("escapes a double quote in a feature name so the mermaid label stays valid", () => {
    const inv = { ...base, features: [{ ...feature("x", "feature"), name: 'say "hi"' }] } as Inventory;
    expect(diagramDoc(inv)).toContain('F0["say #quot;hi#quot;"]');
  });
});

describe("route tables escape pipes", () => {
  const route: RouteInfo = { route: "/:lang(en|fr)", file: "src/app.js", line: 3, kind: "api", method: "GET" };
  const rowsWith = (doc: string) => doc.split("\n").filter((l) => l.includes(":lang("));

  it("INTERFACES.md keeps a 4-column row for a route with a regex alternation", () => {
    const doc = interfacesDoc({ ...base, routes: [route] }, OPTS);
    const [row] = rowsWith(doc);
    expect(row).toContain("/:lang(en\\|fr)");
    expect(row?.split(/(?<!\\)\|/).length).toBe(6);
  });

  it("a feature PRD's routes table does the same", () => {
    const doc = featurePrd(base, feature("01-core", "feature", [route]), OPTS, "");
    const [row] = rowsWith(doc);
    expect(row).toContain("/:lang(en\\|fr)");
    expect(row?.split(/(?<!\\)\|/).length).toBe(6);
  });
});
