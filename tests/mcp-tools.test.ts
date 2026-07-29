import { describe, it, expect } from "vitest";
import { TOOLS, WRITE_TOOLS, TOOL_META, annotationsFor, toolsFor } from "../src/mcp/tools.js";
import { validateArgs } from "../src/mcp/protocol.js";

const ALL = [...TOOLS, ...WRITE_TOOLS];

describe("tool declarations", () => {
  it("names every tool consistently and uniquely", () => {
    const names = ALL.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).toMatch(/^reconstruct_[a-z_]+$/);
  });

  it("declares a well-formed object schema whose required properties exist", () => {
    for (const t of ALL) {
      expect(t.inputSchema.type, t.name).toBe("object");
      expect(Array.isArray(t.inputSchema.required), t.name).toBe(true);
      for (const r of t.inputSchema.required) {
        expect(Object.keys(t.inputSchema.properties), `${t.name}.required lists "${r}"`).toContain(r);
      }
      for (const [key, spec] of Object.entries(t.inputSchema.properties)) {
        expect(spec.description, `${t.name}.${key} has no description`).toBeTruthy();
      }
    }
  });

  it("gives every tool a description that says what it is for", () => {
    for (const t of ALL) {
      expect(t.description.length, t.name).toBeGreaterThan(80);
      expect(t.title, t.name).toBeTruthy();
    }
  });

  it("says out loud that the engine scaffolds structure and never reasons", () => {
    // The scaffold is not a spec. A client that misses this reads an empty
    // tree as a finished reconstruction.
    for (const name of ["reconstruct_scaffold", "reconstruct_check"]) {
      expect(ALL.find((t) => t.name === name)!.description, name).toMatch(/never reasons/);
    }
  });

  it("warns that the scaffold refuses to overwrite enrichment", () => {
    const scaffold = WRITE_TOOLS.find((t) => t.name === "reconstruct_scaffold")!;
    expect(scaffold.description).toMatch(/REFUSES to overwrite/);
    expect(scaffold.description).toMatch(/no undo/);
    expect(scaffold.inputSchema.properties.force!.description).toMatch(/no undo/);
  });

  it("declares an outputSchema only where the result shape is small and stable", () => {
    expect(ALL.filter((t) => t.outputSchema).map((t) => t.name)).toEqual(["reconstruct_read"]);
  });
});

describe("annotations", () => {
  const EXPECTED: Record<string, { readOnlyHint: boolean; openWorldHint: boolean; destructiveHint?: boolean; idempotentHint?: boolean }> = {
    reconstruct_inventory: { readOnlyHint: true, openWorldHint: false },
    reconstruct_check: { readOnlyHint: true, openWorldHint: false },
    reconstruct_review: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    reconstruct_verify: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    reconstruct_specs: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    reconstruct_features: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    reconstruct_merge: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    reconstruct_read: { readOnlyHint: true, openWorldHint: false },
    reconstruct_scaffold: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    reconstruct_brainstorm: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  };

  it("annotates every declared tool, and only declared tools", () => {
    expect(Object.keys(TOOL_META).sort()).toEqual(ALL.map((t) => t.name).sort());
    expect(Object.keys(EXPECTED).sort()).toEqual(ALL.map((t) => t.name).sort());
  });

  it("matches the expected hint matrix", () => {
    for (const [name, want] of Object.entries(EXPECTED)) expect(annotationsFor(name), name).toEqual(want);
  });

  it("marks the scaffold destructive, because force:true discards agent prose", () => {
    expect(ALL.filter((t) => TOOL_META[t.name]!.destructive).map((t) => t.name)).toEqual(["reconstruct_scaffold"]);
  });

  it("reaches the network nowhere — the whole engine is a local walk", () => {
    expect(ALL.filter((t) => TOOL_META[t.name]!.openWorld)).toEqual([]);
  });
});

describe("toolsFor", () => {
  it("hides the write tools unless the server was started with --allow-write", () => {
    const readOnly = toolsFor("2025-06-18").map((t) => t.name);
    expect(readOnly).not.toContain("reconstruct_scaffold");
    expect(readOnly).not.toContain("reconstruct_brainstorm");
    expect(toolsFor("2025-06-18", { allowWrite: true }).map((t) => t.name)).toContain("reconstruct_scaffold");
  });

  it("gates rich fields and annotations on the negotiated protocol version", () => {
    const old = toolsFor("2024-11-05").find((t) => t.name === "reconstruct_read")!;
    expect(old.annotations).toBeUndefined();
    expect(old.title).toBeUndefined();

    const now = toolsFor("2025-06-18").find((t) => t.name === "reconstruct_read")!;
    expect(now.annotations).toBeTruthy();
    expect(now.outputSchema).toBeTruthy();
  });

  it("makes `out` optional with a default — but never for the scaffold", () => {
    const withDefault = toolsFor("2025-06-18", { defaultOut: "/srv/tree", allowWrite: true });
    for (const t of withDefault) {
      if (t.name === "reconstruct_scaffold") continue;
      if (!t.inputSchema.properties.out) continue;
      expect(t.inputSchema.required, t.name).not.toContain("out");
    }
    // The one tool that can destroy enrichment never inherits its target.
    const scaffold = withDefault.find((t) => t.name === "reconstruct_scaffold")!;
    expect(scaffold.inputSchema.properties.out!.description).not.toContain("/srv/tree");
  });
});

describe("declared schemas accept what the handlers expect", () => {
  it("validates a representative call per tool", () => {
    const sample: Record<string, Record<string, unknown>> = {
      reconstruct_inventory: { repo: "/r", include: ["src/**"] },
      reconstruct_check: { out: "/t", semantic: true },
      reconstruct_review: { out: "/t" },
      reconstruct_verify: { out: "/t", max_verify: 30 },
      reconstruct_specs: { out: "/t" },
      reconstruct_features: { out: "/t" },
      reconstruct_merge: { out: "/t" },
      reconstruct_read: { out: "/t", path: "SUMMARY.md", start_line: 1, end_line: 20 },
      reconstruct_scaffold: { repo: "/r", out: "/t", mode: "preserve", level: "complex", fidelity: "describe", granularity: "fine" },
      reconstruct_brainstorm: { out: "/t" },
    };
    for (const t of ALL) expect(validateArgs(t.inputSchema, sample[t.name]!), t.name).toBeUndefined();
  });

  it("rejects a missing required argument and an out-of-enum value", () => {
    const read = TOOLS.find((t) => t.name === "reconstruct_read")!;
    expect(validateArgs(read.inputSchema, { out: "/t" })).toMatch(/`path` is required/);
    const scaffold = WRITE_TOOLS.find((t) => t.name === "reconstruct_scaffold")!;
    expect(validateArgs(scaffold.inputSchema, { repo: "/r", fidelity: "photocopy" })).toMatch(/fidelity/);
  });
});
