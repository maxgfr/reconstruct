import { join } from "node:path";
import type { Artifact, CopyOp, Inventory, Options, RenderResult } from "../types.js";
import {
  overviewPrd,
  architectureDoc,
  interfacesDoc,
  dataModelDoc,
  designSystemDoc,
  diagramDoc,
  featurePrd,
  rebuildDoc,
} from "./templates.js";
import { renderSourceMaterial } from "./fidelity.js";
import { mergeArtifacts, mergeFeatures, mergeSpecs, summarize } from "./bundle.js";

/** Turn an inventory into the full set of files/copies for the reconstruction tree. */
export function render(inv: Inventory, opts: Options): RenderResult {
  const artifacts: Artifact[] = [];
  const copies: CopyOp[] = [];

  artifacts.push({ relPath: "REBUILD.md", content: rebuildDoc(inv, opts) });
  artifacts.push({ relPath: "00-overview/PRD.md", content: overviewPrd(inv, opts) });
  artifacts.push({ relPath: "architecture/ARCHITECTURE.md", content: architectureDoc(inv, opts) });
  artifacts.push({ relPath: "architecture/INTERFACES.md", content: interfacesDoc(inv, opts) });
  artifacts.push({ relPath: "architecture/DATA-MODEL.md", content: dataModelDoc(inv, opts) });
  artifacts.push({ relPath: "architecture/DESIGN-SYSTEM.md", content: designSystemDoc(inv, opts) });
  artifacts.push({ relPath: "architecture/diagram.md", content: diagramDoc(inv) });
  artifacts.push({ relPath: "inventory.json", content: JSON.stringify(inv, null, 2) + "\n" });

  for (const feature of inv.features) {
    const src = renderSourceMaterial(feature, opts);
    copies.push(...src.copies);
    artifacts.push({
      relPath: `features/${feature.slug}/PRD.md`,
      content: featurePrd(inv, feature, opts, src.markdown),
    });
  }

  // Ground-truth data is always mirrored regardless of code fidelity:
  // translations, schema, and config are data you cannot faithfully "rewrite".
  const dataCopy = (paths: string[], sub: string) => {
    for (const rel of paths) {
      copies.push({ from: join(opts.repo, rel), to: join(opts.out, "data", sub, rel) });
    }
  };
  if (inv.i18n) dataCopy(inv.i18n.files, "translations");
  dataCopy(inv.schemas, "schema");
  dataCopy(inv.configs, "config");

  // Opt-in bundles. SUMMARY and FEATURES are pushed before the merge, which
  // excludes them (and RECONSTRUCTION/inventory) so the single file never
  // duplicates itself.
  if (opts.summary) {
    artifacts.push({ relPath: "SUMMARY.md", content: summarize(inv, opts) });
  }
  if (opts.features) {
    artifacts.push({ relPath: "FEATURES.md", content: mergeFeatures(artifacts, inv, opts) });
  }
  if (opts.specs) {
    artifacts.push({ relPath: "SPECS.md", content: mergeSpecs(artifacts, inv, opts) });
  }
  if (opts.merge) {
    artifacts.push({ relPath: "RECONSTRUCTION.md", content: mergeArtifacts(artifacts, inv, opts) });
  }

  return { artifacts, copies };
}
