import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// The skill's own documentation, served over MCP.
//
// A tool list hands a client the ENGINE. It does not hand it the method: the
// rule that you answer only from retrieved evidence, the citation format, the
// rubric a good answer is held to. Inside Claude Code that method arrives as
// SKILL.md. Everywhere else — Cursor, Zed, Claude Desktop — nothing carries it,
// and a model driving these tools from cold reinvents a worse protocol.
//
// So SKILL.md and references/*.md are exposed as resources. Nothing here is
// generated: they are the same files the skill ships, read off disk at request
// time, which is why a documentation fix never needs a rebuild to reach a
// client.

export const SKILL_NAME = "reconstruct";

const URI_SCHEME = "skill://";

export interface ResourceDecl {
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mimeType: string;
}

export interface ResourceContents {
  uri: string;
  mimeType: string;
  text: string;
}

// Where SKILL.md lives, relative to whatever directory this module was loaded
// from. Three layouts, tried in order, because the same code runs from all of
// them:
//
//   <payload>/scripts/reconstruct.mjs  → <payload>/SKILL.md              (installed skill)
//   <repo>/scripts/reconstruct.mjs     → <repo>/skills/reconstruct/SKILL.md (repo-root bundle)
//   <repo>/src/mcp/resources.ts     → <repo>/skills/reconstruct/SKILL.md (source tree, tests)
//
// `moduleDir` is injectable for the same reason the vendored engine makes it
// injectable (codeindex-engine.mjs:5560): a test must be able to point this at
// a fixture without staging a fake bundle on disk.
export function resolveSkillRoot(moduleDir?: string): string | undefined {
  const here = moduleDir ?? dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(here, ".."), resolve(here, "..", "skills", SKILL_NAME), resolve(here, "..", "..", "skills", SKILL_NAME)];
  return candidates.find((dir) => existsSync(join(dir, "SKILL.md")));
}

// The catalogue. An unresolvable root is not an error: a skill installed
// without its payload should still serve every tool it has, with an empty
// resource list, rather than refuse to start over missing documentation.
export function listResources(moduleDir?: string): ResourceDecl[] {
  const root = resolveSkillRoot(moduleDir);
  if (!root) return [];

  const out: ResourceDecl[] = [describe(root, "SKILL.md", `${SKILL_NAME}: the skill`)];

  const refDir = join(root, "references");
  if (!existsSync(refDir)) return out;
  for (const file of readdirSync(refDir).sort()) {
    if (!file.endsWith(".md")) continue;
    out.push(describe(root, join("references", file), `${SKILL_NAME} reference: ${basename(file, ".md")}`));
  }
  return out;
}

export function readResource(uri: string, moduleDir?: string): ResourceContents {
  if (!uri.startsWith(URI_SCHEME)) {
    throw new ResourceError(`unknown resource scheme in "${uri}" (expected ${URI_SCHEME}…)`);
  }
  const root = resolveSkillRoot(moduleDir);
  if (!root) throw new ResourceError("no skill payload found next to this build — nothing to read");

  const rel = uri.slice(URI_SCHEME.length);
  if (!rel) throw new ResourceError("empty resource path");

  // Containment is checked on the REALPATH, not on the joined string. A
  // `skill://../../.ssh/id_rsa` normalises away, but a symlink inside
  // references/ pointing out of the tree does not — and this server may be
  // reachable over HTTP.
  const target = resolve(root, rel);
  const rootReal = realpathSync(root);
  let targetReal: string;
  try {
    targetReal = realpathSync(target);
  } catch {
    throw new ResourceError(`no such resource: ${uri}`);
  }
  if (targetReal !== rootReal && !targetReal.startsWith(rootReal + sep)) {
    throw new ResourceError(`resource path escapes the skill root: ${uri}`);
  }
  if (!statSync(targetReal).isFile()) throw new ResourceError(`not a file: ${uri}`);

  return { uri, mimeType: "text/markdown", text: readFileSync(targetReal, "utf8") };
}

// Thrown for a resource the caller asked for wrongly. The server turns it into
// a JSON-RPC error, the way an unknown tool is one: the client named something
// that does not exist, which is a client bug, not a failed read.
export class ResourceError extends Error {}

function describe(root: string, rel: string, fallbackTitle: string): ResourceDecl {
  const decl: ResourceDecl = {
    uri: `${URI_SCHEME}${rel.split(sep).join("/")}`,
    name: rel.split(sep).join("/"),
    title: fallbackTitle,
    mimeType: "text/markdown",
  };
  const summary = firstProse(join(root, rel));
  if (summary) decl.description = summary;
  return decl;
}

// The first real sentence of a markdown file, for the resource description.
// Skips YAML frontmatter, headings and blockquote callouts, so what a client
// shows is the document's claim rather than its title repeated.
function firstProse(file: string): string | undefined {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
  const body = text.startsWith("---\n") ? text.slice(text.indexOf("\n---", 3) + 4) : text;
  for (const block of body.split(/\n\s*\n/)) {
    const line = block.trim();
    if (!line || line.startsWith("#") || line.startsWith(">") || line.startsWith("|") || line.startsWith("```")) continue;
    const flat = line.replace(/\s+/g, " ").replace(/[*`]/g, "");
    return flat.length > 300 ? `${flat.slice(0, 297)}…` : flat;
  }
  return undefined;
}
