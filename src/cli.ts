import { resolve, join } from "node:path";
import { existsSync, statSync } from "node:fs";
import { analyze } from "./analyze.js";
import { render } from "./prd/render.js";
import { writeOutput } from "./output.js";
import { VERSION } from "./types.js";
import type { Fidelity, Level, Mode, Options } from "./types.js";

const HELP = `reconstruct v${VERSION}
Analyze a repository and generate reconstruction PRDs to rebuild it from scratch.

Usage:
  reconstruct [--repo <path>] [--out <path>] [options]

Options:
  --repo <path>        Repository to analyze            (default: current dir)
  --out <path>         Output directory                 (default: <repo>/reconstruction)
  --mode <mode>        preserve | redesign              (default: preserve)
  --level <level>      light | complex                  (default: light)
  --fidelity <mode>    mirror | embed | describe        (default: derived from mode+level)
  --max-embed-bytes N  Max bytes embedded per file      (default: 16000)
  --json               Print the inventory JSON only, write nothing
  -h, --help           Show this help
  -v, --version        Show version

Fidelity defaults:
  preserve+light  -> mirror     preserve+complex -> embed
  redesign+light  -> embed      redesign+complex -> describe
`;

function fail(message: string): never {
  process.stderr.write(`reconstruct: ${message}\n`);
  process.exit(1);
}

function oneOf<T extends string>(name: string, value: string, allowed: readonly T[]): T {
  if (!(allowed as readonly string[]).includes(value)) {
    fail(`invalid --${name} "${value}" (expected: ${allowed.join(", ")})`);
  }
  return value as T;
}

function defaultFidelity(mode: Mode, level: Level): Fidelity {
  if (mode === "preserve") return level === "light" ? "mirror" : "embed";
  return level === "light" ? "embed" : "describe";
}

export function parseArgs(argv: string[]): Options {
  const raw: Record<string, string> = {};
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "-h" || arg === "--help") {
      process.stdout.write(HELP);
      process.exit(0);
    }
    if (arg === "-v" || arg === "--version") {
      process.stdout.write(VERSION + "\n");
      process.exit(0);
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        raw[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith("--")) {
          fail(`missing value for ${arg}`);
        }
        raw[arg.slice(2)] = next;
        i++;
      }
    }
  }

  const repo = resolve(raw.repo ?? process.cwd());
  if (!existsSync(repo) || !statSync(repo).isDirectory()) {
    fail(`repo path is not a directory: ${repo}`);
  }
  const mode = oneOf<Mode>("mode", raw.mode ?? "preserve", ["preserve", "redesign"]);
  const level = oneOf<Level>("level", raw.level ?? "light", ["light", "complex"]);
  const fidelity = oneOf<Fidelity>(
    "fidelity",
    raw.fidelity ?? defaultFidelity(mode, level),
    ["mirror", "embed", "describe"],
  );
  const out = resolve(raw.out ?? join(repo, "reconstruction"));
  const maxEmbedBytes = raw["max-embed-bytes"] ? Number(raw["max-embed-bytes"]) : 16000;
  if (!Number.isFinite(maxEmbedBytes) || maxEmbedBytes <= 0) {
    fail(`invalid --max-embed-bytes`);
  }

  return { repo, out, mode, level, fidelity, json, maxEmbedBytes };
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const inv = analyze(opts);

  if (opts.json) {
    process.stdout.write(JSON.stringify(inv, null, 2) + "\n");
    return;
  }

  const result = render(inv, opts);
  writeOutput(result, opts);

  const lines = [
    `reconstruct: analyzed ${inv.fileCount} files (${inv.totalLines} lines) in ${inv.repoName}`,
    `  stack:    ${inv.stack.primaryLanguage}${inv.stack.frameworks.length ? " · " + inv.stack.frameworks.join(", ") : ""}`,
    `  features: ${inv.features.length} · routes: ${inv.routes.length} · locales: ${inv.i18n ? inv.i18n.locales.length : 0}`,
    `  mode/level/fidelity: ${opts.mode}/${opts.level}/${opts.fidelity}`,
    `  output:   ${opts.out}`,
    `  next:     open ${join(opts.out, "REBUILD.md")}`,
  ];
  process.stderr.write(lines.join("\n") + "\n");
}

main();
