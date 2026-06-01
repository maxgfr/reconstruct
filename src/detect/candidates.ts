import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FileInfo, Hints, StackInfo } from "../types.js";

// Framework-agnostic heuristics that surface *candidate* files for the AI agent
// to verify. They never assert a route/endpoint/model exists — they point the
// agent at the files most likely to declare one, across any stack.

const CONTENT_SCAN_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".java", ".kt", ".php", ".rs", ".cs", ".ex", ".exs",
  ".graphql", ".gql", ".proto",
]);

// Directories that conventionally hold request handlers / pages across stacks.
const ROUTE_DIRS = [
  "routes", "controllers", "handlers", "endpoints", "views", "pages", "api",
];
const API_DIRS = ["routers", "trpc", "resolvers", "graphql"];
const SCHEMA_DIRS = ["models", "entities", "migrations"];

// File-based-routing leaf files (Next.js, SvelteKit, Remix, Nuxt). `index` is
// intentionally excluded — it is just as often a module entry point.
const ROUTE_FILE_RE = /^(page|route|layout|template|default|\+page|\+server|\+layout)\.[jt]sx?$/;

// `r` is kept as a router name because it is the idiomatic gin/chi router variable
// (`r.GET(...)`). Candidates are "to verify" hints, so a few false positives are
// acceptable; missing a real framework's routes is not.
const ROUTE_CONTENT_RE =
  /\b(?:app|router|route|api|blueprint|fastify|server|mux|r)\.(?:get|post|put|patch|delete|all|use|route|handle|handlefunc)\s*\(|@(?:Get|Post|Put|Patch|Delete|Controller|RequestMapping|(?:Get|Post|Put|Delete|Patch)Mapping)\b|@(?:app|router|blueprint|api)\.(?:route|get|post|put|delete|patch)\b|Route::(?:get|post|put|patch|delete|resource|apiResource|group)\b/i;

const API_CONTENT_RE =
  /createTRPCRouter|initTRPC|publicProcedure|protectedProcedure|t\.router\(|\btype\s+Query\b|\btype\s+Mutation\b|buildSchema\(|new\s+GraphQLSchema|makeExecutableSchema|@Resolver\b|gql`|grpc\.|registerService/;

// Note: the `^[ \t]*model[ \t]+...` alternative uses bounded *horizontal* whitespace
// (not `\s`) so it cannot backtrack across newlines on whitespace-heavy files.
const SCHEMA_CONTENT_RE =
  /pgTable\(|mysqlTable\(|sqliteTable\(|@Entity\(|@PrimaryGeneratedColumn|new\s+Schema\(|mongoose\.model\(|sequelize\.define\(|extends\s+Model\b|models\.Model\b|create_table\b|add_column\b|CREATE\s+TABLE\b|^[ \t]*model[ \t]+\w+[ \t]*\{/im;

// Files larger than this are not content-scanned (path heuristics still apply) —
// a hard guard against pathological inputs and wasted I/O on huge generated files.
const MAX_CONTENT_SCAN_BYTES = 2_000_000;

function segmentsOf(path: string): string[] {
  return path.toLowerCase().split("/");
}
function inDir(path: string, names: string[]): boolean {
  const segs = segmentsOf(path);
  return names.some((n) => segs.includes(n));
}
function baseName(path: string): string {
  return path.split("/").pop() ?? "";
}
function safeRead(repo: string, rel: string): string {
  try {
    return readFileSync(join(repo, rel), "utf8");
  } catch {
    return "";
  }
}

/**
 * Surface candidate files for routes, API surface, data model, and entry points.
 * Path heuristics are cheap and run on every file; content heuristics run only on
 * scannable source. `stack` is reserved for future framework-specific weighting.
 */
export function detectCandidates(repo: string, files: FileInfo[], stack: StackInfo): Hints {
  void stack;
  const routeCandidates = new Set<string>();
  const apiCandidates = new Set<string>();
  const schemaCandidates = new Set<string>();

  for (const f of files) {
    if (f.binary || f.size === 0) continue; // empty files (e.g. package markers) declare nothing
    const p = f.path;
    const lower = p.toLowerCase();
    const base = baseName(lower);
    const ext = f.ext;

    // --- path-based signals ---
    if (inDir(lower, ROUTE_DIRS) || ROUTE_FILE_RE.test(base)) routeCandidates.add(p);
    if (ext === ".graphql" || ext === ".gql" || ext === ".proto") apiCandidates.add(p);
    if ((ext === ".json" || ext === ".yaml" || ext === ".yml") && /openapi|swagger/.test(base)) {
      apiCandidates.add(p);
    }
    if (inDir(lower, API_DIRS)) apiCandidates.add(p);
    if (f.category === "schema" || ext === ".prisma") schemaCandidates.add(p);
    if (inDir(lower, SCHEMA_DIRS)) schemaCandidates.add(p);

    // --- content-based signals (bounded to scannable source under a size cap) ---
    if (CONTENT_SCAN_EXTS.has(ext) && f.size <= MAX_CONTENT_SCAN_BYTES) {
      const src = safeRead(repo, p);
      if (!src) continue;
      if (ROUTE_CONTENT_RE.test(src)) routeCandidates.add(p);
      if (API_CONTENT_RE.test(src)) apiCandidates.add(p);
      if (SCHEMA_CONTENT_RE.test(src)) schemaCandidates.add(p);
    }
  }

  return {
    routeCandidates: [...routeCandidates].sort(),
    apiCandidates: [...apiCandidates].sort(),
    schemaCandidates: [...schemaCandidates].sort(),
    entryPoints: detectEntryPoints(repo, files),
  };
}

// Conventional entry-point filenames across ecosystems, matched against the file
// tree. JS/TS package.json `main`/`module`/`bin` are added even when they point
// at build output that is not part of the source tree.
const CONVENTIONAL_ENTRIES = [
  // JS/TS
  "src/index.ts", "src/index.js", "src/index.tsx",
  "src/main.ts", "src/main.tsx", "src/main.js",
  "index.ts", "index.js",
  "src/server.ts", "src/server.js", "server.ts", "server.js",
  "app/layout.tsx", "src/app/layout.tsx",
  // Python
  "manage.py", "main.py", "app.py", "wsgi.py", "asgi.py",
  "src/main.py", "__main__.py",
  // Go
  "main.go", "cmd/main.go",
  // Ruby
  "config.ru", "bin/rails",
  // Rust
  "src/main.rs",
];

/** Best-effort entry points from package.json + cross-ecosystem conventions. */
export function detectEntryPoints(repo: string, files: FileInfo[]): string[] {
  const entries = new Set<string>();
  try {
    const pkg = JSON.parse(readFileSync(join(repo, "package.json"), "utf8")) as Record<
      string,
      unknown
    >;
    for (const key of ["main", "module"]) {
      const v = pkg[key];
      if (typeof v === "string") entries.add(v.replace(/^\.\//, ""));
    }
    if (pkg.bin && typeof pkg.bin === "object") {
      for (const v of Object.values(pkg.bin as Record<string, string>)) {
        if (typeof v === "string") entries.add(v.replace(/^\.\//, ""));
      }
    } else if (typeof pkg.bin === "string") {
      entries.add(pkg.bin.replace(/^\.\//, ""));
    }
  } catch {
    /* no package.json */
  }

  const present = new Set(files.map((f) => f.path));
  for (const c of CONVENTIONAL_ENTRIES) {
    if (present.has(c)) entries.add(c);
  }

  return [...entries].sort();
}
