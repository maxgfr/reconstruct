import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { writeArtifactsIfAbsent } from "./output.js";
import type { Inventory } from "./types.js";

// The 🧠 callout that marks an unresolved section. Rendered into every prompt so
// the EXISTING `--check` scaffolding scan gates an un-enriched brainstorm — the
// same mechanism that gates an unfilled PRD, no new gate code needed.
function callout(text: string): string {
  return `> 🧠 ${text}`;
}

/** The recovered-surface header rendered when brainstorming on an existing reconstruction. */
function recoveredSurface(inv: Inventory): string[] {
  const out: string[] = ["## Current surface (recovered)", ""];
  out.push(`Brainstorm **evolutions** of the surface below, grounded in the recovered PRDs — not a greenfield concept.`);
  out.push("");
  const opCount = inv.interfaces?.length ?? inv.routes?.length ?? 0;
  const entCount = inv.dataModel?.length ?? 0;
  const enumCount = inv.enums?.length ?? 0;
  out.push(`- **Scale:** ${inv.features.length} feature(s) · ${opCount} operation(s) · ${entCount} entit(y/ies) · ${enumCount} enum(s)`);
  if (inv.i18n?.locales?.length) out.push(`- **Locales:** ${inv.i18n.locales.join(", ")}`);
  out.push("");
  out.push("**Features:**");
  for (const f of inv.features) out.push(`- **${f.name}**${f.description ? ` — ${f.description}` : ""} (\`features/${f.slug}/PRD.md\`)`);
  out.push("");
  const entities = (inv.dataModel ?? []).map((e) => e.entity);
  if (entities.length) out.push(`**Entities:** ${entities.join(", ")}`);
  const enums = (inv.enums ?? []).map((e) => e.name);
  if (enums.length) out.push(`**Enums:** ${enums.join(", ")}`);
  out.push("");
  return out;
}

/**
 * Render the divergent-phase BRAINSTORM.md scaffold. Blank when `inv` is null (a
 * fresh idea); pre-seeded with the recovered surface when `inv` is an existing
 * reconstruction (brainstorm evolutions of what's already built). Every section
 * carries a `> 🧠` callout so an un-enriched brainstorm fails `--check` exactly
 * like an unfinished PRD — see `references/brainstorm-playbook.md` for the method.
 */
export function renderBrainstorm(inv: Inventory | null, name: string): string {
  const out: string[] = [];
  out.push(`# ${name} — brainstorm`);
  out.push("");
  out.push(
    "_Divergent phase: generate 3+ genuinely different directions before converging on one. " +
      "Resolve every `> 🧠` callout, then hand the chosen direction to the greenfield interview " +
      "(→ `plan.json`) or, on an existing reconstruction, to iteration PRDs. See " +
      "`references/brainstorm-playbook.md`._",
  );
  out.push("");

  if (inv) out.push(...recoveredSurface(inv));

  const framing = inv
    ? "What jobs are underserved by the current surface? Who hurts today, and where does the product fall short?"
    : "What jobs-to-be-done is this for? Who hurts today, and how do they cope now?";
  out.push("## Problem space", "", callout(framing), "");

  out.push("## Constraints known", "", callout("Hard limits already known — budget, stack, timeline, compliance, integrations, non-negotiables."), "");

  out.push("## Concepts", "", "_At least three genuinely different directions — not variants of one._", "");
  for (const letter of ["A", "B", "C"]) {
    out.push(`### Concept ${letter}`, "");
    out.push(callout(`Pitch — one sentence: what it is and for whom.`));
    out.push(callout(`Differentiators — what makes it distinct from the other concepts.`));
    out.push(callout(`Trade-offs — what it gives up; what gets harder.`));
    out.push(callout(`Risks — the thing most likely to sink it.`));
    out.push("");
  }

  out.push("## Scoring & decision", "");
  out.push(callout("Score each concept against the criteria that matter (value, effort, risk, fit), then state the decision rule you used."));
  out.push("");
  out.push("| Criterion | Concept A | Concept B | Concept C |");
  out.push("| --- | --- | --- | --- |");
  out.push("| _(fill this in)_ | | | |");
  out.push("");

  out.push(
    "## Chosen direction",
    "",
    callout("The concept you're taking forward, and why now. This becomes the product summary the next phase builds on."),
    "",
  );

  out.push(
    "## Rejected alternatives",
    "",
    callout("One bullet per rejected concept: “Rejected X because Y.” Each is an ADR seed — a decision worth recording so it isn't relitigated."),
    "",
  );

  const next = inv
    ? "Turn the chosen direction into new/changed feature PRDs on this reconstruction, then run the enrich → `--check` → `--review` loop."
    : "Feed the chosen direction into the greenfield interview: it becomes `project.summary`, and each rejected alternative becomes a `decisions[]` entry → `plan.json` → `--scratch`.";
  out.push("## Next step", "", callout(next), "");

  return out.join("\n");
}

/**
 * Write BRAINSTORM.md into `outDir` (never clobbering an agent-edited one). Seeds
 * from `<outDir>/inventory.json` when the dir is already a reconstruction, so the
 * brainstorm is grounded in the recovered surface; otherwise renders a blank
 * scaffold for a fresh idea.
 */
export function runBrainstorm(outDir: string): { relPath: string; created: boolean; seeded: boolean } {
  let inv: Inventory | null = null;
  try {
    inv = JSON.parse(readFileSync(join(outDir, "inventory.json"), "utf8")) as Inventory;
  } catch {
    inv = null;
  }
  const name = inv?.repoName ?? "new-idea";
  const relPath = "BRAINSTORM.md";
  const written = writeArtifactsIfAbsent([{ relPath, content: renderBrainstorm(inv, name) }], outDir);
  return { relPath, created: written.includes(relPath), seeded: inv !== null };
}
