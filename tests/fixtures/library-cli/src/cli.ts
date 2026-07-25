#!/usr/bin/env node
import { Command } from "commander";
import { slugify } from "./index.js";

const program = new Command();

program.name("slugify").description("Turn text into URL slugs").version("1.2.0");

program
  .argument("<text>", "text to slugify")
  .option("-s, --separator <char>", "word separator", "-")
  .option("--no-lower", "keep the original case")
  .option("--max-length <n>", "truncate to n characters", Number)
  .action((text, opts) => {
    try {
      process.stdout.write(slugify(text, opts) + "\n");
    } catch {
      process.exitCode = 2;
    }
  });

program.parse();
