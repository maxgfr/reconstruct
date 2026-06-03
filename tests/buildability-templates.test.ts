import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planToInventory } from "../src/scratch.js";
import {
  architectureDoc,
  dataModelDoc,
  interfacesDoc,
  featurePrd,
} from "../src/prd/templates.js";
import type { Feature, Options, ScratchPlan } from "../src/types.js";

function opts(overrides: Partial<Options> = {}): Options {
  return {
    repo: process.cwd(),
    out: join(tmpdir(), "bt-out"),
    mode: "scratch",
    level: "complex",
    fidelity: "describe",
    granularity: "coarse",
    include: [],
    exclude: [],
    json: false,
    maxEmbedBytes: 16000,
    merge: false,
    summary: false,
    features: false,
    standalone: false,
    scratch: true,
    plan: "plan.json",
    tdd: false,
    check: false,
    ...overrides,
  };
}

const PLAN: ScratchPlan = {
  project: { name: "demo", summary: "Demo app." },
  stack: { primaryLanguage: "TypeScript", frameworks: ["Next.js"] },
  i18n: {
    locales: ["en", "fr"],
    messages: {
      sourceLocale: "en",
      namespaces: ["auth", "directory"],
      entries: [
        { key: "auth.signIn", source: "Sign in" },
        { key: "directory.empty", source: "No doctors found" },
      ],
    },
  },
  enums: [
    { name: "Role", members: ["ADMIN", "DOCTOR", "CABINET"], description: "Account role" },
  ],
  services: [
    {
      name: "Geocoder",
      purpose: "Turn an address into lat/lng",
      provider: "Nominatim",
      request: "GET /search?q=<address>&format=json",
      response: "[{ lat, lon }]",
      timeout: "3s",
      onFailure: "store null lat/lng and continue (best-effort)",
    },
  ],
  policies: [
    {
      name: "registration rate limit",
      kind: "rate-limit",
      rule: "5 per hour per IP, 3 per 24h per email; Postgres sliding window",
      appliesTo: ["auth.register"],
    },
  ],
  dataModel: [
    {
      entity: "users",
      fields: [
        { name: "id", type: "uuid", constraints: "PK" },
        { name: "role", type: "enum", enumRef: "Role", constraints: "not null" },
      ],
      indexes: ["btree on (email)"],
      uniques: ["email"],
    },
  ],
  interfaces: [
    {
      method: "tRPC",
      path: "auth.register",
      kind: "tRPC mutation",
      auth: "public",
      input: "{ email: string; password: string }",
      output: "{ userId: string }",
      sideEffects: ["insert users row", "send welcome email"],
    },
  ],
  features: [
    {
      name: "Auth",
      kind: "feature",
      interfaces: ["auth.register"],
      entities: ["users"],
      writes: ["users"],
    },
  ],
};

const inv = planToInventory(PLAN, opts());
function feat(name: string): Feature {
  const f = inv.features.find((x) => x.name === name);
  if (!f) throw new Error(`no feature ${name}`);
  return f;
}

describe("DATA-MODEL.md — enums & constraints", () => {
  const md = dataModelDoc(inv, opts());

  it("renders an Enums & domain types section with full member lists", () => {
    expect(md).toMatch(/Enums.*domain types/i);
    expect(md).toContain("Role");
    expect(md).toContain("ADMIN");
    expect(md).toContain("DOCTOR");
    expect(md).toContain("CABINET");
  });

  it("renders entity indexes and unique constraints", () => {
    expect(md).toContain("btree on (email)");
    expect(md).toMatch(/uniqu/i);
  });

  it("code mode demands enum enumeration even without pre-filled enums", () => {
    const codeMd = dataModelDoc(inv, opts({ mode: "preserve", fidelity: "embed" }));
    expect(codeMd).toMatch(/enum/i);
  });
});

describe("ARCHITECTURE.md — services & policies", () => {
  const md = architectureDoc(inv, opts());

  it("renders an External services section with the contract", () => {
    expect(md).toMatch(/External services/i);
    expect(md).toContain("Geocoder");
    expect(md).toContain("Nominatim");
    expect(md).toContain("3s");
    expect(md).toMatch(/best-effort|store null/i);
  });

  it("renders a Cross-cutting policies section with concrete rules", () => {
    expect(md).toMatch(/Cross-cutting policies|Policies/i);
    expect(md).toContain("5 per hour per IP");
  });

  it("renders the i18n message catalog (namespaces + source strings)", () => {
    expect(md).toContain("auth.signIn");
    expect(md).toContain("Sign in");
    expect(md).toMatch(/namespace/i);
  });

  it("code mode demands services & policies via callouts", () => {
    const codeMd = architectureDoc(inv, opts({ mode: "preserve", fidelity: "embed" }));
    expect(codeMd).toMatch(/External services/i);
    expect(codeMd).toMatch(/polic/i);
  });
});

describe("INTERFACES.md — operation contracts", () => {
  it("renders per-operation input/output/side-effects when present", () => {
    const md = interfacesDoc(inv, opts());
    expect(md).toMatch(/Operation contracts|contract/i);
    expect(md).toContain("{ email: string; password: string }");
    expect(md).toContain("{ userId: string }");
    expect(md).toContain("send welcome email");
  });
});

describe("feature PRD — write contracts & hardened DoD", () => {
  const md = featurePrd(inv, feat("Auth"), opts(), "SRC");

  it("renders the entities this unit writes", () => {
    expect(md).toMatch(/Writes/i);
    expect(md).toContain("users");
  });

  it("DoD requires --check to pass", () => {
    const dod = md.slice(md.indexOf("## Definition of done"));
    expect(dod).toMatch(/--check/);
  });

  it("DoD requires writes to be satisfiable / anonymous-capable", () => {
    const dod = md.slice(md.indexOf("## Definition of done"));
    expect(dod).toMatch(/satisf|anonymous-capable|NOT NULL|foreign key|owner FK/i);
  });

  it("DoD requires enums to be fully enumerated", () => {
    const dod = md.slice(md.indexOf("## Definition of done"));
    expect(dod).toMatch(/enum/i);
  });

  it("DoD requires localized copy with the source string for every key", () => {
    const dod = md.slice(md.indexOf("## Definition of done"));
    expect(dod).toMatch(/source (string|copy)|every key|message/i);
  });
});
