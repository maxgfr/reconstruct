import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Never collect tests from a generated reconstruction tree. The default
    // output dir is `<repo>/reconstruction`, and at `mirror` fidelity it copies
    // the analyzed repo's real source — including `*.test.ts` — into `source/`.
    // If such a tree sits in this repo (e.g. someone ran the analyzer on it),
    // vitest would otherwise try to run those copies and fail. CI never sees it
    // (it's gitignored), but this keeps local runs robust regardless.
    exclude: [...configDefaults.exclude, "**/reconstruction/**", "**/reconstruction-*/**"],
  },
});
