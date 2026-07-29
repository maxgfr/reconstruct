import { TOOLS, WRITE_TOOLS } from "./tools.js";

// The workflows, as MCP prompts.
//
// Tools are the half of this skill a client can discover on its own. The other
// half is the sentence its SKILL.md opens with: the markdown is the program,
// and the engine never reasons. The scaffold is STRUCTURE — headings, feature
// folders, callouts marking what is unresolved — and every judgement in it is
// the model's to write. A client handed the scaffolding tool and no protocol
// treats the empty tree as a finished spec, which is the failure this whole
// skill exists to prevent.
//
// Each prompt says three things, in this order: the contract, the exact tool
// sequence, and what the gate does on failure.

export interface PromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

export interface PromptDecl {
  name: string;
  title?: string;
  description: string;
  arguments: PromptArgument[];
}

export interface PromptMessage {
  role: "user" | "assistant";
  content: { type: "text"; text: string };
}

export interface PromptResult {
  description: string;
  messages: PromptMessage[];
}

export class PromptError extends Error {}

const outArg: PromptArgument = { name: "out", description: "The reconstruction tree.", required: true };

export const PROMPTS: PromptDecl[] = [
  {
    name: "enrich_feature",
    title: "Write a feature's PRD from the real source",
    description:
      "The enrichment workflow: turn one scaffolded feature folder into a PRD someone could build from, by reading what the original code actually does — " +
      "not by describing what its file names suggest.",
    arguments: [
      outArg,
      { name: "feature", description: "The feature slug to enrich.", required: false },
      { name: "repo", description: "The original repository, to read source from.", required: false },
    ],
  },
  {
    name: "review_buildability",
    title: "Find what a builder would still have to guess",
    description:
      "The review workflow: go feature by feature and name what is missing — not what is absent from the template, but what someone rebuilding this would " +
      "have to invent.",
    arguments: [outArg],
  },
  {
    name: "greenfield_interview",
    title: "Interview a new product into a plan",
    description:
      "The greenfield workflow: there is no repo to read, so every fact comes from the user. Elicit them in the order that makes the next question " +
      "answerable, and record what is still unknown.",
    arguments: [{ name: "idea", description: "The product idea, in one line.", required: true }],
  },
];

export function getPrompt(name: string, args: Record<string, unknown> = {}): PromptResult {
  const decl = PROMPTS.find((p) => p.name === name);
  if (!decl) throw new PromptError(`unknown prompt: ${name || "(none given)"}`);

  for (const arg of decl.arguments) {
    if (arg.required && !str(args[arg.name])) throw new PromptError(`\`${arg.name}\` is required for prompt "${name}"`);
  }

  const text = name === "enrich_feature" ? enrichFeature(args) : name === "review_buildability" ? reviewBuildability(args) : greenfieldInterview(args);
  return { description: decl.description, messages: [{ role: "user", content: { type: "text", text } }] };
}

// The rule every workflow here rests on. Stated once, quoted into each prompt,
// so the two can never drift apart.
const CORE_RULE = `The markdown is the program, and the engine never reasons. What reconstruct_scaffold wrote is STRUCTURE — headings, feature folders, and callouts marking what is unresolved. Every judgement in the tree is yours to write, from the real source, and a section left as the template wrote it is an empty section however complete the tree looks.`;

const GATE = `\`reconstruct_check\` returning \`ok: false\` is a VERDICT, not a tool failure: someone could not build the product from what is written, and it says where. But passing it is a floor, not a finish — it sees an EMPTY section, never a section that says nothing.`;

function enrichFeature(args: Record<string, unknown>): string {
  const out = str(args.out)!;
  const feature = str(args.feature);
  const repo = str(args.repo);

  return `Write the PRD for ${feature ? `the \`${feature}\` feature` : "the next unresolved feature"} in \`${out}\`.

${CORE_RULE}

**Sequence:**

1. \`reconstruct_read\` the feature's scaffolded PRD — it marks what is unresolved.
2. \`reconstruct_read\`${repo ? ` with \`repo: "${repo}"\`` : " the original source it points at"}. Read the real implementation before writing a word about it.
3. Write the PRD: what this feature does, the rules it enforces, the states it can be in, what it does when things go wrong.
4. \`reconstruct_check\` when the feature is done.

**Write what the code DOES, not what it is called.** A file named \`validator.ts\` may validate nothing; a function named \`sync\` may be fire-and-forget. The behaviours that matter are usually the ones with no obvious name: the retry that swallows a specific error, the ordering that another module depends on, the default that only applies on the first run.

**Rebuild-completeness is the bar.** Someone with this PRD and no access to the original must produce the same behaviour. Every rule, every edge case, every value that matters. Where you could not determine something from the source, say so explicitly — an honest unknown is buildable-around; a confident guess is not.

${GATE}`;
}

function reviewBuildability(args: Record<string, unknown>): string {
  const out = str(args.out)!;

  return `Review \`${out}\` for buildability.

${CORE_RULE}

**Sequence:**

1. \`reconstruct_review\` — the per-feature worklist.
2. For each feature: \`reconstruct_read\` its PRD and ask the only question that matters — could someone build this without seeing the original?
3. \`reconstruct_verify\` to check the other direction: does the original source actually do what the PRD claims?
4. \`reconstruct_check\`, then \`reconstruct_specs\` for the bundle you hand to a builder.

**Look for what is missing, not what is absent.** A section present and generic is worse than one missing: the gate passes it, and the builder finds the hole at implementation time. "Handles errors appropriately" and "validates the input" are holes with prose in them.

**The faithfulness direction matters as much.** A reconstruction that describes a product the source never implemented is worse than no reconstruction — it will be built, and it will be wrong. Where the PRD claims a behaviour the code does not show, that is a finding.

${GATE}`;
}

function greenfieldInterview(args: Record<string, unknown>): string {
  const idea = str(args.idea)!;

  return `Interview this idea into a plan a reconstruction tree can be built from:

> ${idea}

${CORE_RULE}

**There is no repo to read.** Every fact in this tree comes from the user, which makes the interview the entire input — and makes inventing an answer indistinguishable from inventing the product.

**Sequence:**

1. Interview the user, one question at a time.
2. Write the plan from their answers, with every unknown recorded as an unknown.
3. Scaffold the tree from that plan, then enrich it feature by feature.
4. \`reconstruct_check\`, and \`reconstruct_review\` to find what a builder would still guess.

**Ask in the order that makes the next question answerable.** Who uses it and what do they do today instead? What is the one thing it must do — and what is deliberately out of scope for v1? What data does it hold, and who is allowed to see it? What does it integrate with that you do not control? What has to be true for this to be a success, and what would make it a failure even if it shipped?

**Follow the surprising answer rather than the script.** A constraint the user mentions in passing — a regulation, a legacy system, a team of one — usually determines more of the architecture than anything on your list. And when they do not know yet, record it as an open question: that is a real finding, not a gap to paper over.`;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

// Every tool a prompt tells the model to call must actually be declared —
// otherwise a prompt survives a tool rename as a set of instructions that
// cannot be followed. Exported so the test can assert it.
const DECLARED = new Set([...TOOLS, ...WRITE_TOOLS].map((t) => t.name));

export function toolNamesReferencedBy(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/reconstruct_[a-z_]+/g)) if (DECLARED.has(m[0])) found.add(m[0]);
  return [...found].sort();
}

export function unknownToolNamesIn(text: string): string[] {
  const bad = new Set<string>();
  for (const m of text.matchAll(/reconstruct_[a-z_]+/g)) if (!DECLARED.has(m[0])) bad.add(m[0]);
  return [...bad].sort();
}
