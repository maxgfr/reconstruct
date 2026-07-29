// The MCP wire rules, with no knowledge of what the tools do and no I/O. Kept
// separate from tools.ts and server.ts so the parts that are pure functions of
// their input stay directly testable.
//
// Written by hand rather than pulled from @modelcontextprotocol/sdk: the shipped
// bundle has zero runtime dependencies (design principle 2), and the surface an
// reconstruct server needs — initialize, ping, tools/list, tools/call — is a few
// hundred lines. The vendored codeindex engine ships the same shape at
// src/vendor/codeindex-engine.mjs:10468; this is that shape, retargeted.

// Oldest first. We answer on whichever of these the client asks for, and fall
// back to the newest when it asks for something we don't know — the spec's
// rule is that the server replies with a version it supports and the client
// then decides whether it can live with it.
export const PROTOCOL_VERSIONS = ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"] as const;
export type ProtocolVersion = (typeof PROTOCOL_VERSIONS)[number];

export const LATEST_PROTOCOL: ProtocolVersion = PROTOCOL_VERSIONS[PROTOCOL_VERSIONS.length - 1]!;

// What an HTTP request without an `MCP-Protocol-Version` header means. The spec
// (2025-06-18) says to assume this version for backwards compatibility rather
// than reject, because clients written against the previous revision never send
// the header at all.
export const ASSUMED_HTTP_PROTOCOL: ProtocolVersion = "2025-03-26";

// Tool `annotations` arrived in 2025-03-26; `title`, `outputSchema` and
// `structuredContent` in 2025-06-18. Sending them to an older client is not
// fatal but is noise it never asked for, so they are gated.
export const ANNOTATIONS_SINCE = "2025-03-26";
export const RICH_TOOLS_SINCE = "2025-06-18";

// A tool result larger than this is withheld rather than sent as a truncated
// payload — see capResponse.
export const DEFAULT_MAX_RESPONSE_BYTES = 1_000_000;

export function isProtocolVersion(v: unknown): v is ProtocolVersion {
  return typeof v === "string" && (PROTOCOL_VERSIONS as readonly string[]).includes(v);
}

// Echo the client's version when we speak it, otherwise offer the newest we do.
export function negotiateProtocol(requested: unknown): ProtocolVersion {
  return isProtocolVersion(requested) ? requested : LATEST_PROTOCOL;
}

// --------------------------------------------------------------------------
// Argument validation
// --------------------------------------------------------------------------

export interface JsonSchemaProp {
  type?: "string" | "number" | "boolean" | "array" | "object";
  items?: { type?: string };
  enum?: readonly string[];
  description?: string;
}

export interface JsonSchema {
  type: "object";
  properties: Record<string, JsonSchemaProp>;
  required: string[];
}

// Check a tool call's arguments against its declared schema. Returns a message
// naming the offending property, or undefined when the args are usable.
//
// Deliberately shallow: it enforces required-ness, scalar types, string-array
// shape and enum membership, and it accepts a numeric string for a number
// (several clients stringify every argument). Anything subtler is the handler's
// job, where the error message can be about the domain rather than the schema.
export function validateArgs(schema: JsonSchema, args: Record<string, unknown>): string | undefined {
  for (const key of schema.required) {
    const v = args[key];
    if (v === undefined || v === null || v === "") return `\`${key}\` is required`;
  }
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;
    const spec = schema.properties[key];
    // Unknown keys are ignored, not rejected: a client that sends an extra
    // field should not have its call fail.
    if (!spec?.type) continue;
    const actual = Array.isArray(value) ? "array" : typeof value;

    if (spec.type === "number") {
      if (actual === "number") continue;
      if (actual === "string" && (value as string).trim() !== "" && Number.isFinite(Number(value))) continue;
      return `\`${key}\` must be a number, got ${actual === "string" ? JSON.stringify(value) : actual}`;
    }

    if (spec.type === "array") {
      if (actual !== "array") return `\`${key}\` must be an array, got ${actual}`;
      const arr = value as unknown[];
      if (spec.items?.type === "string" && !arr.every((x) => typeof x === "string")) {
        return `\`${key}\` must be an array of strings`;
      }
      if (spec.enum) {
        const bad = arr.find((x) => typeof x === "string" && !spec.enum!.includes(x));
        if (bad !== undefined) return `\`${key}\` contains "${String(bad)}" — allowed: ${spec.enum.join(", ")}`;
      }
      continue;
    }

    if (actual !== spec.type) return `\`${key}\` must be a ${spec.type}, got ${actual}`;

    if (spec.enum && typeof value === "string" && !spec.enum.includes(value)) {
      return `\`${key}\` must be one of: ${spec.enum.join(", ")}`;
    }
  }
  return undefined;
}

// --------------------------------------------------------------------------
// Response size
// --------------------------------------------------------------------------

// How to ask for less, per tool. A cap that only says "too big" makes the model
// retry the same call; one that names the narrowing argument gets a smaller
// second call.
const NARROWER: Record<string, string> = {
  reconstruct_scaffold: 'narrow with `include`/`exclude`, or drop to `fidelity: "describe"` so source is summarised rather than embedded',
  reconstruct_inventory: "narrow with `include`/`exclude`",
  reconstruct_verify: "lower `max_verify`",
  reconstruct_specs: "read the bundle at the returned path instead of inlining it",
  reconstruct_features: "read the bundle at the returned path instead of inlining it",
  reconstruct_merge: "read the bundle at the returned path instead of inlining it",
  reconstruct_read: "pass `start_line`/`end_line` to read a window instead of the whole file",
};

// Withhold an oversized payload instead of sending a partial one. A truncated
// JSON body is worse than no body: the model cannot tell a clipped result from
// a complete one, so it reasons over half the evidence and says nothing about
// it. The replacement is small, structured, and says exactly how to ask again.
export function capResponse(text: string, tool: string, maxBytes: number, artifact?: string): string {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes <= maxBytes) return text;
  return (
    JSON.stringify(
      {
        truncated: true,
        tool,
        bytes,
        maxBytes,
        reason: "This response exceeds the configured limit and was withheld rather than sent as an unusable partial payload.",
        narrower: NARROWER[tool] ?? "narrow the request and call again",
        ...(artifact ? { artifact, artifactNote: "The full result is on disk here — read it directly if you need all of it." } : {}),
      },
      null,
      2,
    ) + "\n"
  );
}

// `structuredContent` mirrors the text body as a typed object. Only sent when
// the client is new enough, the tool declares an outputSchema, nothing was
// capped, and the body really is a JSON object — a mismatch here is worse than
// the field's absence, because clients validate it.
export function structuredContentFor(text: string, capped: boolean, hasSchema: boolean): Record<string, unknown> | undefined {
  if (capped || !hasSchema) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  return parsed as Record<string, unknown>;
}

// --------------------------------------------------------------------------
// Origin checking (HTTP transport)
// --------------------------------------------------------------------------

const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

// DNS-rebinding defense, required by the spec's security section for a local
// HTTP server. Without it any web page the user visits can POST to
// 127.0.0.1:<port> and drive this server — which clones arbitrary git URLs and
// reads files off disk.
//
// An absent Origin is allowed: non-browser clients (Claude Code, Cursor, curl)
// don't send one, and a browser always does, so absence is not something an
// attacker can use.
export function isOriginAllowed(origin: string | undefined, allowed: string[] = []): boolean {
  if (origin === undefined) return true;
  const o = origin.trim();
  if (o === "" || o === "null") return true;
  if (LOOPBACK_ORIGIN.test(o)) return true;
  return allowed.some((a) => a === "*" || a.toLowerCase() === o.toLowerCase());
}
