import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { CopyOp, Feature, Options } from "../types.js";
import { codeFence } from "./markdown.js";

export interface SourceSection {
  markdown: string;
  copies: CopyOp[];
}

const FENCE_LANG: Record<string, string> = {
  ".ts": "ts",
  ".tsx": "tsx",
  ".js": "js",
  ".jsx": "jsx",
  ".mjs": "js",
  ".cjs": "js",
  ".json": "json",
  ".py": "python",
  ".rb": "ruby",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".php": "php",
  ".css": "css",
  ".scss": "scss",
  ".prisma": "prisma",
  ".sql": "sql",
  ".graphql": "graphql",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".vue": "vue",
  ".svelte": "svelte",
};

const MAX_EMBED_FILES = 15;
const MAX_EMBED_SOURCE_BYTES = 2 * 1024 * 1024;

function extOf(path: string): string {
  const i = path.lastIndexOf(".");
  return i === -1 ? "" : path.slice(i).toLowerCase();
}

function describeSection(feature: Feature): string {
  if (feature.files.length === 0) return "_No files associated with this unit._\n";
  const lines = feature.files.map((f) => `- \`${f}\``);
  return `Files that implement this unit (rewrite them from the requirements above):\n\n${lines.join("\n")}\n`;
}

function embedSection(feature: Feature, opts: Options): string {
  const parts: string[] = [`Key source for this unit (${feature.files.length} file(s) total, showing up to ${MAX_EMBED_FILES}):\n`];
  for (const rel of feature.files.slice(0, MAX_EMBED_FILES)) {
    const ext = extOf(rel);
    const lang = FENCE_LANG[ext] ?? "";
    let body: string;
    try {
      // Generated/minified giants are not "key source"; don't slurp them.
      if (statSync(join(opts.repo, rel)).size > MAX_EMBED_SOURCE_BYTES) {
        parts.push(`#### \`${rel}\`\n`, "> _Too large to embed — see the file in the source repo._", "");
        continue;
      }
      body = readFileSync(join(opts.repo, rel), "utf8");
    } catch {
      continue;
    }
    let truncated = false;
    if (Buffer.byteLength(body, "utf8") > opts.maxEmbedBytes) {
      // Cut on a byte budget without splitting a multi-byte character.
      body = Buffer.from(body, "utf8")
        .subarray(0, opts.maxEmbedBytes)
        .toString("utf8")
        .replace(/\uFFFD$/, "");
      truncated = true;
    }
    // Verbatim: a fence longer than any backtick run in the file, rather than
    // rewriting the file's own ``` into look-alikes.
    const fence = codeFence(body);
    parts.push(`#### \`${rel}\`\n`);
    parts.push(fence + lang + "\n" + body + "\n" + fence);
    if (truncated) parts.push(`> _Truncated to ${opts.maxEmbedBytes} bytes — see full file in the source repo._`);
    parts.push("");
  }
  if (feature.files.length > MAX_EMBED_FILES) {
    parts.push(`_…and ${feature.files.length - MAX_EMBED_FILES} more file(s) not shown._`);
  }
  return parts.join("\n");
}

function mirrorSection(feature: Feature, opts: Options): SourceSection {
  const copies: CopyOp[] = [];
  const lines: string[] = ["Ground-truth source has been copied verbatim alongside this PRD. Reference it while rebuilding:\n"];
  for (const rel of feature.files) {
    copies.push({
      from: join(opts.repo, rel),
      to: join(opts.out, "source", feature.slug, rel),
    });
    // Angle brackets keep a path with spaces a valid link destination.
    lines.push(`- [\`${rel}\`](<../../source/${feature.slug}/${rel}>)`);
  }
  if (feature.files.length === 0) lines.push("_No files associated with this unit._");
  return { markdown: lines.join("\n") + "\n", copies };
}

/** Build the "source material" block of a feature PRD according to the fidelity mode. */
export function renderSourceMaterial(feature: Feature, opts: Options): SourceSection {
  switch (opts.fidelity) {
    case "mirror":
      return mirrorSection(feature, opts);
    case "embed":
      return { markdown: embedSection(feature, opts), copies: [] };
    case "describe":
    default:
      return { markdown: describeSection(feature), copies: [] };
  }
}
