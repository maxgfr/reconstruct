import { describe, it, expect } from "vitest";
import {
  PROTOCOL_VERSIONS,
  LATEST_PROTOCOL,
  negotiateProtocol,
  isProtocolVersion,
  validateArgs,
  capResponse,
  structuredContentFor,
  isOriginAllowed,
  type JsonSchema,
} from "../src/mcp/protocol.js";

describe("negotiateProtocol", () => {
  it("echoes every version we advertise", () => {
    for (const v of PROTOCOL_VERSIONS) expect(negotiateProtocol(v)).toBe(v);
  });

  it("falls back to the newest on an unknown or absent version", () => {
    expect(negotiateProtocol("1999-01-01")).toBe(LATEST_PROTOCOL);
    expect(negotiateProtocol(undefined)).toBe(LATEST_PROTOCOL);
    expect(negotiateProtocol(42)).toBe(LATEST_PROTOCOL);
  });

  it("orders the advertised versions oldest-first", () => {
    expect([...PROTOCOL_VERSIONS]).toEqual([...PROTOCOL_VERSIONS].sort());
    expect(isProtocolVersion(LATEST_PROTOCOL)).toBe(true);
    expect(isProtocolVersion("nope")).toBe(false);
  });
});

describe("validateArgs", () => {
  const schema: JsonSchema = {
    type: "object",
    properties: {
      repo: { type: "string" },
      per_source: { type: "number" },
      refresh: { type: "boolean" },
      urls: { type: "array", items: { type: "string" } },
      sources: { type: "array", items: { type: "string" }, enum: ["code", "issue", "web"] },
      transport: { type: "string", enum: ["stdio", "http"] },
    },
    required: ["repo"],
  };

  it("accepts well-formed args", () => {
    expect(validateArgs(schema, { repo: "a/b", per_source: 6, refresh: true, urls: ["u"], sources: ["code"] })).toBeUndefined();
  });

  it("reports a missing required property", () => {
    expect(validateArgs(schema, {})).toMatch(/`repo` is required/);
    expect(validateArgs(schema, { repo: "" })).toMatch(/`repo` is required/);
  });

  it("reports a wrong scalar type and names the property", () => {
    expect(validateArgs(schema, { repo: 5 })).toMatch(/`repo` must be a string, got number/);
    expect(validateArgs(schema, { repo: "a/b", refresh: "yes" })).toMatch(/`refresh` must be a boolean/);
  });

  it("coerces a numeric string but rejects a non-numeric one", () => {
    expect(validateArgs(schema, { repo: "a/b", per_source: "8" })).toBeUndefined();
    expect(validateArgs(schema, { repo: "a/b", per_source: "lots" })).toMatch(/`per_source` must be a number, got "lots"/);
  });

  it("enforces array shape and element type", () => {
    expect(validateArgs(schema, { repo: "a/b", urls: "u" })).toMatch(/`urls` must be an array, got string/);
    expect(validateArgs(schema, { repo: "a/b", urls: [1, 2] })).toMatch(/`urls` must be an array of strings/);
  });

  it("enforces enum membership for scalars and arrays", () => {
    expect(validateArgs(schema, { repo: "a/b", transport: "carrier-pigeon" })).toMatch(/`transport` must be one of: stdio, http/);
    expect(validateArgs(schema, { repo: "a/b", sources: ["code", "telepathy"] })).toMatch(/contains "telepathy"/);
  });

  it("skips null and undefined, and ignores unknown keys", () => {
    expect(validateArgs(schema, { repo: "a/b", per_source: null, refresh: undefined })).toBeUndefined();
    expect(validateArgs(schema, { repo: "a/b", surprise: { deep: true } })).toBeUndefined();
  });
});

describe("capResponse", () => {
  it("returns the payload untouched when it fits", () => {
    const text = '{"ok":true}';
    expect(capResponse(text, "reconstruct_scaffold", 1000)).toBe(text);
  });

  it("withholds an oversized payload and says how to ask for less", () => {
    const big = JSON.stringify({ pad: "x".repeat(5000) });
    const out = capResponse(big, "reconstruct_scaffold", 100);
    expect(out).not.toContain("xxxx");
    const parsed = JSON.parse(out);
    expect(parsed.truncated).toBe(true);
    expect(parsed.tool).toBe("reconstruct_scaffold");
    expect(parsed.bytes).toBeGreaterThan(parsed.maxBytes);
    expect(parsed.narrower).toMatch(/fidelity/);
  });

  it("points at the on-disk artifact when there is one", () => {
    const out = capResponse("x".repeat(500), "reconstruct_scaffold", 10, "/tmp/run/EVIDENCE.md");
    expect(JSON.parse(out).artifact).toBe("/tmp/run/EVIDENCE.md");
  });

  it("still gives a generic hint for a tool with no tailored one", () => {
    expect(JSON.parse(capResponse("x".repeat(500), "reconstruct_review", 10)).narrower).toBe("narrow the request and call again");
  });
});

describe("structuredContentFor", () => {
  it("mirrors a JSON object body", () => {
    expect(structuredContentFor('{"ok":true}', false, true)).toEqual({ ok: true });
  });

  it("is absent when capped, when the tool has no output schema, or when the body is not an object", () => {
    expect(structuredContentFor('{"ok":true}', true, true)).toBeUndefined();
    expect(structuredContentFor('{"ok":true}', false, false)).toBeUndefined();
    expect(structuredContentFor("[1,2]", false, true)).toBeUndefined();
    expect(structuredContentFor("null", false, true)).toBeUndefined();
    expect(structuredContentFor("not json", false, true)).toBeUndefined();
  });
});

describe("isOriginAllowed", () => {
  it("allows loopback origins on any port and scheme", () => {
    for (const o of ["http://localhost", "http://localhost:5173", "http://127.0.0.1:3000", "https://localhost:443", "http://[::1]:8080"]) {
      expect(isOriginAllowed(o)).toBe(true);
    }
  });

  it("allows an absent or opaque origin (non-browser clients send none)", () => {
    expect(isOriginAllowed(undefined)).toBe(true);
    expect(isOriginAllowed("null")).toBe(true);
    expect(isOriginAllowed("")).toBe(true);
  });

  it("rejects a remote origin — the DNS-rebinding case", () => {
    expect(isOriginAllowed("http://evil.test")).toBe(false);
    expect(isOriginAllowed("https://app.example.com")).toBe(false);
    // A hostname that merely embeds "localhost" must not pass.
    expect(isOriginAllowed("http://localhost.evil.test")).toBe(false);
  });

  it("honours an explicit allow-list, case-insensitively", () => {
    expect(isOriginAllowed("https://app.example.com", ["https://app.example.com"])).toBe(true);
    expect(isOriginAllowed("https://APP.example.com", ["https://app.example.com"])).toBe(true);
    expect(isOriginAllowed("http://evil.test", ["https://app.example.com"])).toBe(false);
    expect(isOriginAllowed("http://evil.test", ["*"])).toBe(true);
  });
});
