import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/transliterate.ts", "src/cli.ts"],
  format: ["esm"],
  dts: true,
});
