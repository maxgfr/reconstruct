import { join } from "node:path";
import type { PhaseInfo } from "./orchestrate.js";

// ---------------------------------------------------------------------------
// Templates for `reconstruct --orchestrate` — the generator that turns the
// reconstruction's CURRENT worklists into a launchable multi-agent Workflow per
// phase, the dispatch contracts it references, and a sequential RUNBOOK
// fallback. Everything here is emitted by string concatenation with the tree's
// constants injected as JSON literals, so the workflow runs as-is under the
// Workflow tool: `export const meta` stays a pure literal, and no emitted line
// ever calls Date.now()/Math.random()/new Date() (they throw in that harness).
// The protocol these artifacts execute is references/orchestration.md — the
// enrichment map-reduce, the finder/verifier review fan-out, and the
// requirement adjudication — with the reduce always kept with the orchestrator.
// ---------------------------------------------------------------------------

/**
 * Family-standard footer: subagents return fragments; the orchestrator is the
 * single serial reducer (the map-reduce contract of references/orchestration.md).
 */
const ONE_WRITER_FOOTER = `
## Return, don't write

Return ONLY the structured output specified above. Do NOT write, edit, or delete any file in the reconstruction tree; do NOT run any engine command that writes (\`--verify --apply\`, \`--review --apply\`, or the analyzer itself over the out dir). Returning proposals — not writing the shared docs directly — is what keeps the map parallel: two agents never race on the same file. The orchestrator is the SINGLE SERIAL REDUCER: it merges your returned fragments, writes the canonical docs and worklists itself, and runs the fail-closed \`--apply\` fold. Exception: if a draft or justification is prose too large to return, write ONLY to \`<OUT>/orchestration/out/<role>-<batch>.md\` (a file namespaced to you alone) and return its path.
`;

// Structured-output schemas the emitted workflows pass to agent(..., { schema }).
// They mirror the shapes the engine's reducers accept (`--review --apply`,
// `--verify --apply`, the map-reduce row proposals), so a fragment that validates
// here still gets re-checked (citation resolution, gating rules) at fold time.

const DRAFT_SCHEMA = {
  type: "object",
  required: ["proposals"],
  properties: {
    proposals: {
      type: "array",
      items: {
        type: "object",
        required: ["slug", "prd", "interfaceRows", "entityRows"],
        properties: {
          slug: { type: "string" },
          prd: { type: "string", description: "the COMPLETE features/<slug>/PRD.md content — full spine, every callout resolved" },
          interfaceRows: {
            type: "array",
            description: "ROW PROPOSALS for architecture/INTERFACES.md (the orchestrator merges them)",
            items: {
              type: "object",
              required: ["method", "path"],
              properties: {
                method: { type: "string" },
                path: { type: "string" },
                kind: { type: "string" },
                auth: { type: "string" },
                input: { type: "string" },
                output: { type: "string" },
                sideEffects: { type: "array", items: { type: "string" } },
              },
            },
          },
          entityRows: {
            type: "array",
            description: "ROW PROPOSALS for architecture/DATA-MODEL.md (the orchestrator merges them)",
            items: {
              type: "object",
              required: ["entity", "fields"],
              properties: {
                entity: { type: "string" },
                fields: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["name", "type"],
                    properties: {
                      name: { type: "string" },
                      type: { type: "string" },
                      constraints: { type: "string" },
                      enumRef: { type: "string" },
                    },
                  },
                },
                relations: { type: "array", items: { type: "string" } },
                indexes: { type: "array", items: { type: "string" } },
                uniques: { type: "array", items: { type: "string" } },
              },
            },
          },
          enums: {
            type: "array",
            description: "every enum the feature touches, with its COMPLETE member list",
            items: {
              type: "object",
              required: ["name", "members"],
              properties: { name: { type: "string" }, members: { type: "array", items: { type: "string" } }, description: { type: "string" } },
            },
          },
          notes: { type: "string", description: "what the source could not settle (goes to unknowns, never into the PRD as fact)" },
        },
      },
    },
  },
};

const FINDINGS_SCHEMA = {
  type: "object",
  required: ["findings"],
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        required: ["feature", "severity", "category", "problem", "fix"],
        properties: {
          feature: { type: "string" },
          severity: { enum: ["blocker", "major", "minor"] },
          category: { enum: ["stories", "requirements", "acceptance", "write-contract", "enum", "consistency", "faithfulness", "i18n", "rebuild-test"] },
          problem: { type: "string" },
          fix: { type: "string" },
        },
      },
    },
  },
};

const BLOCKER_VERDICT_SCHEMA = {
  type: "object",
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "verdict", "verifierNote"],
        properties: {
          id: { type: "string" },
          verdict: { enum: ["confirmed", "refuted"] },
          verifierNote: { type: "string", description: "one line grounded in the PRD/architecture docs you read" },
        },
      },
    },
  },
};

const ADJUDICATE_SCHEMA = {
  type: "object",
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        required: ["claimId", "verdict", "note", "confidence"],
        properties: {
          claimId: { type: "string" },
          verdict: { enum: ["supported", "partial", "refuted", "unsupported"] },
          note: { type: "string", description: "one line grounded in the evidence you read" },
          confidence: { enum: ["confirmed", "inferred", "gap"] },
        },
      },
    },
  },
};

interface PhaseSpec {
  role: string;
  title: string;
  schema: unknown;
  description: (items: number) => string;
  /** The orchestrator's fold step, shown as a comment in the workflow tail + in the runbook. */
  applyHint: (engineAbs: string, outAbs: string) => string;
}

const PHASE_SPECS: Record<string, PhaseSpec> = {
  "enrich-map": {
    role: "drafter",
    title: "Draft",
    schema: DRAFT_SCHEMA,
    description: (n) =>
      `Draft the ${n} feature PRD(s) of a reconstruction as a map-reduce (drafters return row proposals; the orchestrator is the single serial reducer)`,
    applyHint: (engine, out) =>
      `merge the proposals into architecture/INTERFACES.md + architecture/DATA-MODEL.md and write each features/<slug>/PRD.md yourself (the serial REDUCE of references/orchestration.md), then gate: node ${engine} --check --out ${out}`,
  },
  "review-find": {
    role: "finder",
    title: "Find",
    schema: FINDINGS_SCHEMA,
    description: (n) => `Review the ${n} flagged feature PRD(s) of a reconstruction against the nine buildability checks (adversarial finder fan-out)`,
    applyHint: (engine, out) =>
      `merge the findings into ${join(out, "findings.json")} ({ "findings": [...] }), then: node ${engine} --review --apply ${join(out, "findings.json")} --out ${out} — then fan the surviving blockers out with --orchestrate --phase review-verify`,
  },
  "review-verify": {
    role: "verifier",
    title: "Verify",
    schema: BLOCKER_VERDICT_SCHEMA,
    description: (n) => `Independently confirm or refute the ${n} open review blocker(s) of a reconstruction (adversarial verifier fan-out)`,
    applyHint: (engine, out) =>
      `stamp each verdict/verifierNote onto its finding (match by id) in ${join(out, "findings.json")}, then re-run: node ${engine} --review --apply ${join(out, "findings.json")} --out ${out} — a refuted blocker drops from the residual`,
  },
  adjudicate: {
    role: "adjudicator",
    title: "Adjudicate",
    schema: ADJUDICATE_SCHEMA,
    description: (n) => `Adjudicate the ${n} requirement↔evidence pair(s) of a reconstruction's verification gate (fan-out, fail-closed fold)`,
    applyHint: (engine, out) =>
      `fill the verdicts into ${join(out, "verdicts.json")}, then: node ${engine} --verify --apply ${join(out, "verdicts.json")} --out ${out} && node ${engine} --check --semantic --out ${out}`,
  },
};

export function phaseSpec(name: string): PhaseSpec {
  const spec = PHASE_SPECS[name];
  if (!spec) throw new Error(`no phase spec for "${name}"`);
  return spec;
}

/**
 * Chunk grouped worklist ids into batches, one subagent per batch — within each
 * group only (order-preserving, deterministic). enrich-map groups by workspace so
 * a drafter stream never straddles two workspaces; other phases pass one group.
 */
export function toBatches(groups: string[][], batchSize: number): string[][] {
  const out: string[][] = [];
  for (const ids of groups) {
    for (let i = 0; i < ids.length; i += batchSize) out.push(ids.slice(i, i + batchSize));
  }
  return out;
}

export function phaseWorkflowScript(ph: PhaseInfo, outAbs: string, engineAbs: string, batchSize: number): string {
  const spec = phaseSpec(ph.name);
  const scriptPath = join(outAbs, "orchestration", `${ph.name}.workflow.mjs`);
  const meta = { name: `reconstruct-${ph.name}`, description: spec.description(ph.items), phases: [{ title: spec.title }] };
  return [
    `export const meta = ${JSON.stringify(meta)}`,
    ``,
    `// NOT a plain Node script: launch via the Workflow tool — Workflow({ scriptPath: ${JSON.stringify(scriptPath)} }).`,
    `// Emitted by \`reconstruct --orchestrate\` from the CURRENT worklist. The worklist is the source`,
    `// of truth: if it changes, re-run \`--orchestrate --phase ${ph.name}\` before launching.`,
    ``,
    `// Constants for THIS reconstruction (injected at emit time; no Date.now/Math.random in this harness).`,
    `const OUT = ${JSON.stringify(outAbs)}`,
    `const ENGINE = ${JSON.stringify(engineAbs)}`,
    `const WORKLIST = ${JSON.stringify(ph.worklist)}`,
    `const AGENTS = OUT + '/orchestration/agents'`,
    `const BATCHES = ${JSON.stringify(toBatches(ph.groups, batchSize))}`,
    `const SCHEMA = ${JSON.stringify(spec.schema)}`,
    ``,
    `function contract(name, extra) {`,
    `  return 'Read and follow the dispatch contract at ' + AGENTS + '/' + name + '.md VERBATIM.\\n'`,
    `    + 'Constants: OUT=' + OUT + '  ENGINE=' + ENGINE + '  WORKLIST=' + WORKLIST + '.\\n'`,
    `    + 'Invoke the engine only by its ABSOLUTE path: node ' + ENGINE + ' <flags> — read-only flags only.'`,
    `    + (extra ? '\\n' + extra : '')`,
    `}`,
    ``,
    `log('reconstruct ${ph.name}: ' + ${JSON.stringify(String(ph.items))} + ' item(s) across ' + BATCHES.length + ' agent(s)')`,
    ``,
    `phase(${JSON.stringify(spec.title)})`,
    `const results = await pipeline(BATCHES, (batch, _item, i) =>`,
    `  agent(contract('${spec.role}', 'ITEMS=' + batch.join(',')), { label: '${ph.name}:' + (i + 1), phase: ${JSON.stringify(spec.title)}, agentType: 'general-purpose', schema: SCHEMA }))`,
    ``,
    `// One-writer rule: this workflow only COLLECTS fragments. The main agent stays the single`,
    `// serial reducer — it folds them in itself. Next step:`,
    `//   ${spec.applyHint(engineAbs, outAbs)}`,
    `return { phase: ${JSON.stringify(ph.name)}, worklist: WORKLIST, results: results.filter(Boolean) }`,
    ``,
  ].join("\n");
}

export function agentContracts(outAbs: string, engineAbs: string): Record<string, string> {
  const footer = ONE_WRITER_FOOTER.replaceAll("<OUT>", outAbs);
  void engineAbs; // contracts reference the engine through the workflow's injected ENGINE constant
  return {
    drafter: `# Contract: drafter

You draft ONE feature of a reconstruction at a time, to full PRD depth — the MAP half of the enrichment map-reduce (\`references/orchestration.md\`, Phase 1).

Worklist: \`${join(outAbs, "inventory.json")}\` (\`features[]\` — each entry carries \`slug\`, \`files\`, \`routes\`, \`interfaces\`, \`entities\`, \`writes\`). Handle ONLY the features whose \`slug\` is named in your prompt (\`ITEMS=<slug,…>\`).

For EACH of your features:

1. Read ONLY its slice of the tree: the feature's \`files\` plus the \`inventory.hints.*Candidates\` (routes/api/schema/realtime/auth/design-system) that fall inside those files, its scaffold \`features/<slug>/PRD.md\` (including the embedded \`## Source material\`), and the copied ground truth under \`${join(outAbs, "data")}\`. File paths in the inventory are relative to the analyzed repo — prefer the embedded source and \`data/\` copies; open the original repo only when the tree references paths it did not embed.
2. Draft the COMPLETE \`features/<slug>/PRD.md\` content — the full spine (context & goal, user stories, numbered functional requirements, interfaces & data, Given/When/Then acceptance criteria, edge cases & failure modes, definition of done), resolving every \`> 🧠\` callout.
3. PROPOSE — do not write — the shared-doc rows your feature touches:
   - interface ROW PROPOSALS: method · path · kind · auth · input · output · side-effects;
   - entity ROW PROPOSALS: entity · fields+types · constraints · relations · enums;
   - every enum with its COMPLETE member list.
4. Ground everything in the source you actually read — never invent. Anything the source cannot settle goes into \`notes\`, not into the PRD as fact.

Return (structured output): \`{ "proposals": [{ "slug", "prd", "interfaceRows", "entityRows", "enums", "notes" }] }\` — your ITEMS only.

The orchestrator runs the REDUCE serially: it unions your rows into the canonical \`architecture/INTERFACES.md\` / \`architecture/DATA-MODEL.md\` (deduping by path/operation and by entity name), reconciles conflicts against source, and writes the feature PRDs.
${footer}`,
    finder: `# Contract: finder

You are a FINDER of the AI buildability review — one adversarial reviewer per flagged feature (\`references/orchestration.md\`, Phase 2 step B; rubric: \`references/ai-review-rubric.md\`).

Worklist: \`${join(outAbs, "REVIEW.todo.json")}\` (\`units[]\`; the flagged ones carry \`needsReview: true\`). Handle ONLY the features named in your prompt (\`ITEMS=<feature,…>\`).

For EACH of your features:

1. Read \`features/<feature>/PRD.md\`, the architecture docs it references (\`architecture/INTERFACES.md\`, \`architecture/DATA-MODEL.md\`, \`architecture/ARCHITECTURE.md\`), and the ground truth (the embedded \`## Source material\`, \`data/\`).
2. Apply the nine checks — stories, requirements, acceptance, write-contract, enum, consistency, faithfulness, i18n, rebuild-test. Be ADVERSARIAL: hunt for reasons the unit is NOT buildable by a fresh agent from its PRD + the architecture docs alone; do not bless it.
3. Emit each finding as \`{ feature, severity (blocker|major|minor), category, problem, fix }\` — \`problem\` concrete and grounded in what you read, \`fix\` actionable. Leave \`verdict\` unset: an INDEPENDENT verifier rules on each blocker, never you.

Return (structured output): \`{ "findings": [ … ] }\` — your ITEMS only (an empty array means the unit passes).
${footer}`,
    verifier: `# Contract: verifier

You are an INDEPENDENT VERIFIER of the review loop — one fresh, adversarial agent per open blocker (\`references/orchestration.md\`, Phase 2 step C). A finding "counts" only when you confirm it.

Worklist: \`${join(outAbs, "REVIEW.json")}\` (\`failures[]\` — the open blockers, each \`{ id, feature, category, problem, fix }\`). Handle ONLY the blockers whose \`id\` is named in your prompt (\`ITEMS=<id,…>\`).

For EACH of your blockers:

1. Read its failure entry, then the feature's \`features/<feature>/PRD.md\` and the architecture docs — independently. You were NOT the finder: assume the blocker is WRONG until the docs prove it.
2. Try to REFUTE it: \`refuted\` when the PRD/architecture docs already answer the stated problem; \`confirmed\` only if you cannot refute it from what you read. A refuted blocker does not gate (the engine drops it from the residual set).
3. \`verifierNote\` is REQUIRED — one line grounded in what you read (quote or paraphrase the decisive passage).

Return (structured output): \`{ "verdicts": [{ "id", "verdict", "verifierNote" }] }\` — your ITEMS only.
${footer}`,
    adjudicator: `# Contract: adjudicator

You adjudicate the requirement↔source verification gate of a reconstruction — judging whether each PRD requirement TRACES to the original code (faithful inference) or was invented.

Worklist: \`${join(outAbs, "VERIFY.todo.json")}\` (\`pairs[]\`, each \`{ claimId, claim, feature, evidenceRef, digest }\`). Handle ONLY the pairs whose \`claimId\` is named in your prompt (\`ITEMS=<id,…>\`).

For EACH of your pairs:

1. Open the cited evidence — \`evidenceRef\` is a file path, \`route …\`, \`interface …\`, \`entity …\` or \`feature …\` the reconstruction captured; \`digest\` lists the nearest matches — and read it in context (the feature PRD's embedded \`## Source material\`, \`data/\`, the architecture docs).
2. Set \`verdict\`: \`supported\` (the requirement traces to the source exactly), \`partial\` (real but overstated), \`unsupported\` (traces to nothing — invented), \`refuted\` (the source contradicts it). When unsure, choose the HARSHER verdict — a false pass is worse than a false fail.
3. Stamp \`confidence\` alongside the verdict: **confirmed** (you read the cited evidence and it decisively supports the requirement), **inferred** (consistent with the source but indirect — a convention, a pattern, or standard library/DB behavior, with no false certainty), or **gap** (the evidence is thin or missing and a human should confirm). The label never gates — the \`verdict\` kind does — but it keeps a grounded fact machine-distinguishable from an inference.
4. \`note\` is REQUIRED — one line grounded in what you read.

Return (structured output): \`{ "verdicts": [{ "claimId", "verdict", "note", "confidence" }] }\` — your ITEMS only. The fold is fail-closed: \`--verify --apply\` re-resolves every \`evidenceRef\` against the inventory, so a fabricated citation is rejected.
${footer}`,
  };
}

export function runbookMd(phases: PhaseInfo[], outAbs: string, engineAbs: string): string {
  const status = phases
    .map((p) => `| ${p.name} | \`${p.worklist}\` | ${p.ready ? `ready (${p.items} item(s))` : "not ready"} | \`${p.prerequisite}\` |`)
    .join("\n");
  const engine = `node ${engineAbs}`;
  const agents = join(outAbs, "orchestration", "agents");
  return `# reconstruct — sequential RUNBOOK (eco / no-subagent fallback)

Out: \`${outAbs}\` · Engine: \`${engine}\`

Generated by \`reconstruct --orchestrate\` from the CURRENT state of the reconstruction. This
sequential path is correctness-identical to the multi-agent workflows — same worklists, same
contracts, same fail-closed gates; only wall-clock differs. Fan-out is an optimization, not a
requirement.

## Phase status

| Phase | Worklist | Status | Produce it with |
|---|---|---|---|
${status}

## The loop (play every role yourself, one unit at a time)

1. **Analyze** (if not done): \`${engine} --repo <repo> --out ${outAbs}\` → \`${join(outAbs, "inventory.json")}\` (greenfield: \`--scratch --plan <plan.json>\`).
2. **Enrich — the map-reduce, played solo**: for EVERY \`inventory.json\` feature, apply \`${join(agents, "drafter.md")}\` yourself (draft the PRD + the interface/entity row proposals), then play the reducer — merge every proposal into \`architecture/INTERFACES.md\` / \`architecture/DATA-MODEL.md\` and write the feature PRDs. Gate: \`${engine} --check --out ${outAbs}\`.
3. **Review — find**: \`${engine} --review --out ${outAbs}\` writes \`${join(outAbs, "REVIEW.todo.json")}\` (flagging only what changed). For EVERY flagged unit, apply \`${join(agents, "finder.md")}\` yourself; save the findings as \`${join(outAbs, "findings.json")}\` (\`{ "findings": [...] }\`), then reduce: \`${engine} --review --apply ${join(outAbs, "findings.json")} --out ${outAbs}\`.
4. **Review — verify**: for EVERY open blocker in \`${join(outAbs, "REVIEW.json")}\` (\`failures[]\`), apply \`${join(agents, "verifier.md")}\` yourself (confirm/refute + note, stamped onto the matching finding in \`findings.json\` by \`id\`), then re-reduce: \`${engine} --review --apply ${join(outAbs, "findings.json")} --out ${outAbs}\`. Loop 2→4 until \`REVIEW.json.ok\` (or \`staleRounds >= 2\` / round > 5).
5. **Adjudicate the requirement gate**: \`${engine} --verify --out ${outAbs}\` writes \`${join(outAbs, "VERIFY.todo.json")}\`. For EVERY pair, apply \`${join(agents, "adjudicator.md")}\` yourself (verdict + confidence + note → \`${join(outAbs, "verdicts.json")}\`), then fold: \`${engine} --verify --apply ${join(outAbs, "verdicts.json")} --out ${outAbs}\`.
6. **Gate**: \`${engine} --check --semantic --out ${outAbs}\` must exit 0 before presenting anything.

Never fanned out (orchestrator-only, always serial): the greenfield interview, \`--brainstorm\`
(the divergent phase), every reduce/merge step, and the scratch build itself.

With subagents available, prefer the emitted workflows instead: \`--orchestrate --out ${outAbs} --phase <p>\`
then \`Workflow({ scriptPath: "${join(outAbs, "orchestration", "<p>.workflow.mjs")}" })\` — you stay the sole writer either way.
`;
}
