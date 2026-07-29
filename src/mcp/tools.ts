import { ANNOTATIONS_SINCE, RICH_TOOLS_SINCE, type JsonSchema, type JsonSchemaProp, type ProtocolVersion } from "./protocol.js";

// What the server advertises. Pure data — nothing here imports the analysis
// pipeline, so the declarations can be asserted in a test without walking a
// repo. handlers.ts is where these names become work.

export interface ToolDecl {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  title?: string;
  outputSchema?: JsonSchema;
  annotations?: Record<string, boolean>;
}

const outProp: JsonSchemaProp = { type: "string", description: "The reconstruction tree — the durable artifact holding the PRDs and the spine documents." };
const repoProp: JsonSchemaProp = { type: "string", description: "Absolute path to the repository to analyze." };

// The sentence the whole skill turns on, from its own SKILL.md: the markdown is
// the program, and the engine never reasons. A model that misses it reads the
// scaffold as a finished spec — which it is not, by construction.
const JUDGMENT_NOTE = "The engine scaffolds STRUCTURE and never reasons: every judgement in a reconstruction is yours to write.";

export const TOOLS: ToolDecl[] = [
  {
    name: "reconstruct_inventory",
    title: "Inventory a repository, write nothing",
    description:
      "Walk a repository and return what it is made of — stack, entry points, routes, data model candidates, i18n — as JSON, persisting nothing. Use it to " +
      "size a rebuild before committing to a scaffold, or to answer 'what is in here' without creating a tree.",
    inputSchema: {
      type: "object",
      properties: {
        repo: repoProp,
        include: { type: "array", items: { type: "string" }, description: "Keep only files matching these globs." },
        exclude: { type: "array", items: { type: "string" }, description: "Drop files matching these globs." },
      },
      required: ["repo"],
    },
  },
  {
    name: "reconstruct_check",
    title: "The buildability gate",
    description:
      "Prove the tree is actually buildable from: no missing spine document, no unresolved callout, no empty feature PRD. Exits non-zero when someone " +
      "could not build the product from what is written. A result with ok:false is a real verdict, not a tool failure. " +
      JUDGMENT_NOTE,
    inputSchema: {
      type: "object",
      properties: {
        out: outProp,
        semantic: { type: "boolean", description: "Also fold in the recorded verification verdicts." },
        allow_unverified: { type: "boolean", description: "With semantic, warn instead of failing when no verdicts exist yet." },
      },
      required: ["out"],
    },
  },
  {
    name: "reconstruct_review",
    title: "Per-feature buildability worklist",
    description:
      "Emit, per feature, what a builder would still have to guess. This is the pass that turns a structurally complete tree into one someone can actually " +
      "build from — the gate can see an empty section, but only you can see a section that says nothing.",
    inputSchema: { type: "object", properties: { out: outProp }, required: ["out"] },
  },
  {
    name: "reconstruct_verify",
    title: "Requirement→source worklist",
    description:
      "Emit a requirement-by-source worklist for you to adjudicate: does the original code actually do what this PRD claims? This is the faithfulness pass " +
      "— a reconstruction that describes a product the source never implemented is worse than no reconstruction.",
    inputSchema: {
      type: "object",
      properties: { out: outProp, max_verify: { type: "number", description: "Cap on the number of requirement/evidence pairs emitted (default 60)." } },
      required: ["out"],
    },
  },
  {
    name: "reconstruct_specs",
    title: "The hand-to-an-agent spec bundle",
    description:
      "Bundle every feature PRD with the embedded source code STRIPPED — the spec you hand to an agent that must rebuild the product without copying it. " +
      "Use reconstruct_merge instead when you want the source kept in.",
    inputSchema: { type: "object", properties: { out: outProp }, required: ["out"] },
  },
  {
    name: "reconstruct_features",
    title: "The features-only bundle",
    description: "Bundle every feature PRD and nothing else — no spine documents, no overview. The fastest way to read what the product actually does.",
    inputSchema: { type: "object", properties: { out: outProp }, required: ["out"] },
  },
  {
    name: "reconstruct_merge",
    title: "The whole tree as one document",
    description: "Bundle the entire reconstruction — spine documents, overview and every feature PRD, source included — into a single markdown file.",
    inputSchema: { type: "object", properties: { out: outProp }, required: ["out"] },
  },
  {
    name: "reconstruct_read",
    title: "Read a file from the tree or the repo",
    description:
      "Read a file, or a line range of one, from the reconstruction tree or the repository it was built from. Use it to see the real source behind a PRD " +
      "before writing about it. Reads are confined to those two roots; anything else is your own file tool's job.",
    inputSchema: {
      type: "object",
      properties: {
        out: outProp,
        repo: { type: "string", description: "The repository, if you want to read from it as well as from the tree." },
        path: { type: "string", description: "Path relative to the tree, or an absolute path inside the tree or the repo." },
        start_line: { type: "number", description: "First line to return, 1-based (default 1)." },
        end_line: { type: "number", description: "Last line to return, inclusive (default: end of file, capped)." },
      },
      required: ["out", "path"],
    },
    outputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        start_line: { type: "number" },
        end_line: { type: "number" },
        total_lines: { type: "number" },
        truncated: { type: "boolean" },
        content: { type: "string" },
      },
      required: ["path", "start_line", "end_line", "total_lines", "truncated", "content"],
    },
  },
];

// Registered only when the server is started with --allow-write. Both write a
// tree into the user's filesystem.
export const WRITE_TOOLS: ToolDecl[] = [
  {
    name: "reconstruct_scaffold",
    title: "Scaffold a reconstruction tree",
    description:
      "WRITES TO DISK: walk the repository and write the reconstruction tree — inventory, overview, architecture, interfaces, data model, and one PRD per " +
      "feature. The scaffold is STRUCTURE with the judgement left blank: it marks what you must resolve. It REFUSES to overwrite a tree you have already " +
      "enriched unless force:true, because that prose is the whole value and there is no undo. " +
      JUDGMENT_NOTE,
    inputSchema: {
      type: "object",
      properties: {
        repo: repoProp,
        out: { type: "string", description: "Where to write the tree (default: <repo>/reconstruction)." },
        mode: { type: "string", enum: ["preserve", "redesign"], description: "Rebuild as-is, or allow a redesign. Default: preserve." },
        level: { type: "string", enum: ["light", "complex"], description: "How much structure to emit. Default: light." },
        fidelity: {
          type: "string",
          enum: ["mirror", "embed", "describe"],
          description: "How to carry the original code: mirror (paths), embed (inline it), describe (prose only). Default: embed.",
        },
        granularity: { type: "string", enum: ["coarse", "fine"], description: "How aggressively trivial groups fold into Core. Default: coarse." },
        include: { type: "array", items: { type: "string" }, description: "Keep only files matching these globs." },
        exclude: { type: "array", items: { type: "string" }, description: "Drop files matching these globs." },
        max_embed_bytes: { type: "number", description: "Cap on bytes of one file embedded into a PRD." },
        force: { type: "boolean", description: "Overwrite a tree that already carries your enrichment. There is no undo." },
      },
      required: ["repo"],
    },
  },
  {
    name: "reconstruct_brainstorm",
    title: "Scaffold a divergent-options board",
    description:
      "WRITES TO DISK: scaffold a BRAINSTORM.md into the tree — the divergent phase before committing to one direction. Seeded from the inventory when a " +
      "tree already exists, empty otherwise.",
    inputSchema: { type: "object", properties: { out: outProp }, required: ["out"] },
  },
];

// Behavioural hints clients use to decide what needs a confirmation prompt.
//
// The read-only line is drawn at the USER'S filesystem. Nothing here reaches
// the network at all — the whole engine is a deterministic local walk.
export const TOOL_META: Record<string, { write?: boolean; destructive?: boolean; idempotent?: boolean; openWorld?: boolean }> = {
  reconstruct_inventory: { openWorld: false },
  reconstruct_check: { openWorld: false },
  reconstruct_review: { write: true, destructive: false, idempotent: true, openWorld: false },
  reconstruct_verify: { write: true, destructive: false, idempotent: true, openWorld: false },
  reconstruct_specs: { write: true, destructive: false, idempotent: true, openWorld: false },
  reconstruct_features: { write: true, destructive: false, idempotent: true, openWorld: false },
  reconstruct_merge: { write: true, destructive: false, idempotent: true, openWorld: false },
  reconstruct_read: { openWorld: false },
  // Destructive with force:true — it overwrites prose an agent spent real work
  // writing, and nothing else in this repo can bring that back.
  reconstruct_scaffold: { write: true, destructive: true, idempotent: false, openWorld: false },
  reconstruct_brainstorm: { write: true, destructive: false, idempotent: true, openWorld: false },
};

export function annotationsFor(name: string): Record<string, boolean> | undefined {
  const meta = TOOL_META[name];
  if (!meta) return undefined;
  return {
    readOnlyHint: !meta.write,
    ...(meta.write ? { destructiveHint: meta.destructive === true, idempotentHint: meta.idempotent === true } : {}),
    openWorldHint: meta.openWorld === true,
  };
}

export interface ToolsForOptions {
  defaultOut?: string;
  allowWrite?: boolean;
}

// The tool list as one client should see it: gated on what the server was
// started with, and on how new the negotiated protocol is.
export function toolsFor(protocolVersion: ProtocolVersion, opts: ToolsForOptions = {}): ToolDecl[] {
  const base = opts.allowWrite ? [...TOOLS, ...WRITE_TOOLS] : TOOLS;
  const withAnnotations = protocolVersion >= ANNOTATIONS_SINCE;
  const withRich = protocolVersion >= RICH_TOOLS_SINCE;

  return base.map((t) => {
    const decl: ToolDecl = {
      name: t.name,
      description: t.description,
      // The one tool that can destroy enrichment never inherits a target the
      // caller didn't name.
      inputSchema: t.name === "reconstruct_scaffold" ? t.inputSchema : applyDefaultOut(t.inputSchema, opts.defaultOut),
    };
    if (withRich && t.title) decl.title = t.title;
    if (withRich && t.outputSchema) decl.outputSchema = t.outputSchema;
    if (withAnnotations) {
      const a = annotationsFor(t.name);
      if (a) decl.annotations = a;
    }
    return decl;
  });
}

// With a server-level default tree, `out` stops being required and its
// description names the default — so a client working one reconstruction can
// call every tool with no out argument at all.
function applyDefaultOut(schema: JsonSchema, defaultOut?: string): JsonSchema {
  const existing = schema.properties.out;
  if (!defaultOut || !existing) return schema;
  return {
    type: "object",
    properties: {
      ...schema.properties,
      out: { ...existing, description: `${existing.description} Optional — defaults to ${defaultOut}.` },
    },
    required: schema.required.filter((r) => r !== "out"),
  };
}
