import { defineConfig } from "tsup";

// Bundles the TypeScript engine into a single, dependency-free ESM script
// (scripts/analyze.mjs) that any agent sandbox can run with `node` — no
// `npm install` required at skill-use time.
export default defineConfig({
  entry: { analyze: "src/cli.ts" },
  outDir: "scripts",
  format: ["esm"],
  outExtension: () => ({ js: ".mjs" }),
  target: "node18",
  platform: "node",
  bundle: true,
  clean: false,
  minify: false,
  splitting: false,
  sourcemap: false,
  banner: { js: "#!/usr/bin/env node" },
});
