import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FileInfo, Hints, StackInfo } from "../types.js";

// Framework-agnostic heuristics that surface *candidate* files for the AI agent
// to verify. They never assert a route/endpoint/model exists — they point the
// agent at the files most likely to declare one, across any stack.

const CONTENT_SCAN_EXTS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rb",
  ".go",
  ".java",
  ".kt",
  ".php",
  ".rs",
  ".cs",
  ".ex",
  ".exs",
  ".graphql",
  ".gql",
  ".proto",
]);

// Directories that conventionally hold request handlers / pages across stacks.
const ROUTE_DIRS = ["routes", "controllers", "handlers", "endpoints", "views", "pages", "api"];
// RPC/GraphQL surface dirs ONLY. "routers" is deliberately NOT here: it is a
// REST convention for Flask/FastAPI/Express as much as a tRPC one, and the
// route adapters + ROUTE_CONTENT_RE already surface those files — listing it
// here made plain-REST apps wrongly trip the "tRPC/GraphQL/gRPC" unknown.
const API_DIRS = ["trpc", "resolvers", "graphql"];
const SCHEMA_DIRS = ["models", "entities", "migrations"];

// File-based-routing leaf files (Next.js, SvelteKit, Remix, Nuxt). `index` is
// intentionally excluded — it is just as often a module entry point.
const ROUTE_FILE_RE = /^(page|route|layout|template|default|\+page|\+server|\+layout)\.[jt]sx?$/;

// Files whose basename alone declares a routing table for a framework whose DSL
// (Rails) or directory (config/) the heuristics below would otherwise miss.
const ROUTE_FILE_NAMES = new Set(["routes.rb"]);

// Content signals that a file declares request handlers, across stacks. Candidates
// are "to verify" hints, so a few false positives are acceptable (see the file
// header); silently missing a real framework's routes is the failure to avoid.
// `r`/`bp`/`blp` are kept as receiver names: idiomatic gin/chi (`r.GET`) and
// Flask blueprint (`bp.route`, smorest `blp.route`) variables.
const ROUTE_CONTENT_RE = new RegExp(
  [
    // method-call routers (JS/TS/Go/Python): app.get(, router.post(, r.GET(, bp.put(
    String.raw`\b(?:app|router|route|api|blueprint|fastify|server|mux|r|bp|blp)\.(?:get|post|put|patch|delete|all|use|route|handle|handlefunc)\s*\(`,
    // any receiver registering a net/http handler: mux.HandleFunc(, http.Handle(
    String.raw`\.handle(?:func)?\s*\(`,
    // decorator frameworks: Spring (@GetMapping/@RequestMapping/@Controller), NestJS
    String.raw`@(?:Get|Post|Put|Patch|Delete|Controller|RequestMapping|(?:Get|Post|Put|Delete|Patch)Mapping)\b`,
    // Python decorator routes: @app.route, @bp.get, @router.post …
    String.raw`@(?:app|router|blueprint|api|bp|blp)\.(?:route|get|post|put|delete|patch)\b`,
    // Laravel: Route::get(, Route::resource(, Route::group(
    String.raw`Route::(?:get|post|put|patch|delete|resource|apiResource|group|match|any)\b`,
    // Flask functional / class-based / flask-restful registration
    String.raw`\.add_url_rule\s*\(`,
    String.raw`\badd_resource\s*\(`,
    String.raw`\bclass\s+\w+\s*\(\s*(?:\w+\.)?(?:Resource|MethodView)\b`,
    String.raw`=\s*Blueprint\s*\(`,
    // Django: urlpatterns table, re_path(, DRF router.register(/DefaultRouter
    String.raw`\burlpatterns\b`,
    String.raw`\bre_path\s*\(`,
    String.raw`routers\.(?:Default|Simple)Router\b`,
    String.raw`\.register\s*\(\s*r?["']`,
    // Rails DSL (covers config/routes.rb and any drawn routes file)
    String.raw`Rails\.application\.routes\.draw\b`,
    // Rust: axum Router::new().route(, actix web::resource/scope/get(
    String.raw`Router::new\b`,
    String.raw`\.route\s*\(`,
    String.raw`web::(?:resource|scope|get|post|put|delete|patch)\s*\(`,
  ].join("|"),
  "i",
);

const API_CONTENT_RE =
  /createTRPCRouter|initTRPC|publicProcedure|protectedProcedure|t\.router\(|\btype\s+Query\b|\btype\s+Mutation\b|buildSchema\(|new\s+GraphQLSchema|makeExecutableSchema|@Resolver\b|gql`|grpc\.|registerService/;

// Realtime signals: WebSocket servers/gateways, socket.io, ActionCable, SSE.
// A realtime surface rarely shows up in HTTP route tables, so these files are
// surfaced separately for the agent to enumerate channels/events from.
const REALTIME_CONTENT_RE = new RegExp(
  [
    String.raw`@WebSocketGateway|@SubscribeMessage`, // NestJS gateways
    String.raw`new\s+WebSocketServer|new\s+WebSocket\.Server`, // ws
    String.raw`socket\.io|\bio\.on\(\s*["']connection`,
    String.raw`\bwebsocket\s*:\s*true`, // fastify route option
    String.raw`upgradeWebSocket`, // hono
    String.raw`@\w+\.websocket\b|websockets\.serve|WebsocketConsumer`, // FastAPI / websockets / Django Channels
    String.raw`ActionCable|ApplicationCable`, // rails
    String.raw`text/event-stream`, // SSE
  ].join("|"),
);

// Auth/middleware signals: guard decorators, auth middleware registration,
// session/token plumbing. They tell the agent which operations carry an auth
// rule that must land in the INTERFACES.md Auth column — not that one exists.
const AUTH_CONTENT_RE = new RegExp(
  [
    String.raw`@UseGuards|\bpassport\.`, // NestJS / Express
    String.raw`app\.use\(\s*\w*[aA]uth`, // app.use(auth...), app.use(requireAuth...)
    String.raw`\brequireAuth\b|\bwithAuth\b|\bverifyToken\b|\bjwt\.(?:sign|verify)\b`,
    String.raw`getServerSession|getToken\(`, // next-auth
    String.raw`\bpreHandler\b`, // fastify hook (often auth)
    String.raw`@login_required|@permission_required|@permission_classes|permission_classes\s*=`, // Django/Flask
    String.raw`\bbefore_request\b`, // flask middleware
    String.raw`HTTPBearer|OAuth2PasswordBearer`, // FastAPI security
    String.raw`before_action\s+:authenticate|authenticate_user!`, // rails
    String.raw`\[Authorize|@PreAuthorize|@Secured\b`, // ASP.NET / Spring
  ].join("|"),
);

// Note: the `^[ \t]*model[ \t]+...` alternative uses bounded *horizontal* whitespace
// (not `\s`) so it cannot backtrack across newlines on whitespace-heavy files.
const SCHEMA_CONTENT_RE =
  /pgTable\(|mysqlTable\(|sqliteTable\(|@Entity\(|@PrimaryGeneratedColumn|new\s+Schema\(|mongoose\.model\(|sequelize\.define\(|extends\s+Model\b|models\.Model\b|create_table\b|add_column\b|CREATE\s+TABLE\b|^[ \t]*model[ \t]+\w+[ \t]*\{/im;

// Design-system config / token source files, matched on basename. These declare
// the visual contract (tokens, theme, font config) the rebuild must reproduce.
const DS_FILE_NAMES = new Set([
  "tailwind.config.js",
  "tailwind.config.ts",
  "tailwind.config.cjs",
  "tailwind.config.mjs",
  "panda.config.ts",
  "panda.config.js",
  "panda.config.mjs",
  "uno.config.ts",
  "uno.config.js",
  "unocss.config.ts",
  "unocss.config.js",
  "theme.ts",
  "theme.tsx",
  "theme.js",
  "tokens.ts",
  "tokens.js",
  "tokens.json",
  "design-tokens.ts",
  "design-tokens.js",
  "design-tokens.json",
  "globals.css",
  "global.css",
  "app.css",
  "index.css",
  "styles.css",
  "tokens.css",
  "theme.css",
  "components.json", // shadcn/ui
]);

// Stylesheet extensions worth content-scanning for token declarations (CSS is not
// in CONTENT_SCAN_EXTS, so design-system detection reads these separately).
const DS_STYLE_EXTS = new Set([".css", ".scss", ".sass", ".less", ".styl", ".pcss"]);
// A stylesheet declares design tokens via CSS custom properties, a Tailwind v4
// `@theme` block, or a `@layer base` token layer.
const DS_CSS_RE = /--[\w-]+\s*:|@theme\b|@layer\s+base\b|:root\s*\{/;

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
  const realtimeCandidates = new Set<string>();
  const authCandidates = new Set<string>();
  const designSystemCandidates = new Set<string>();

  for (const f of files) {
    if (f.binary || f.size === 0) continue; // empty files (e.g. package markers) declare nothing
    const p = f.path;
    const lower = p.toLowerCase();
    const base = baseName(lower);
    const ext = f.ext;

    // --- path-based signals ---
    if (inDir(lower, ROUTE_DIRS) || ROUTE_FILE_RE.test(base) || ROUTE_FILE_NAMES.has(base)) {
      routeCandidates.add(p);
    }
    if (ext === ".graphql" || ext === ".gql" || ext === ".proto") apiCandidates.add(p);
    if ((ext === ".json" || ext === ".yaml" || ext === ".yml") && /openapi|swagger/.test(base)) {
      apiCandidates.add(p);
    }
    if (inDir(lower, API_DIRS)) apiCandidates.add(p);
    if (f.category === "schema" || ext === ".prisma") schemaCandidates.add(p);
    if (inDir(lower, SCHEMA_DIRS)) schemaCandidates.add(p);
    if (DS_FILE_NAMES.has(base)) designSystemCandidates.add(p);

    // --- design-system stylesheet scan (CSS is not in CONTENT_SCAN_EXTS) ---
    if (DS_STYLE_EXTS.has(ext) && f.size <= MAX_CONTENT_SCAN_BYTES) {
      const css = safeRead(repo, p);
      if (css && DS_CSS_RE.test(css)) designSystemCandidates.add(p);
    }

    // --- content-based signals (bounded to scannable source under a size cap) ---
    if (CONTENT_SCAN_EXTS.has(ext) && f.size <= MAX_CONTENT_SCAN_BYTES) {
      const src = safeRead(repo, p);
      if (!src) continue;
      if (ROUTE_CONTENT_RE.test(src)) routeCandidates.add(p);
      if (API_CONTENT_RE.test(src)) apiCandidates.add(p);
      if (SCHEMA_CONTENT_RE.test(src)) schemaCandidates.add(p);
      if (REALTIME_CONTENT_RE.test(src)) realtimeCandidates.add(p);
      if (AUTH_CONTENT_RE.test(src)) authCandidates.add(p);
    }
  }

  return {
    routeCandidates: [...routeCandidates].sort(),
    apiCandidates: [...apiCandidates].sort(),
    schemaCandidates: [...schemaCandidates].sort(),
    realtimeCandidates: [...realtimeCandidates].sort(),
    authCandidates: [...authCandidates].sort(),
    designSystemCandidates: [...designSystemCandidates].sort(),
    entryPoints: detectEntryPoints(repo, files),
  };
}

// Conventional entry-point filenames across ecosystems, matched against the file
// tree. JS/TS package.json `main`/`module`/`bin` are added even when they point
// at build output that is not part of the source tree.
const CONVENTIONAL_ENTRIES = [
  // JS/TS
  "src/index.ts",
  "src/index.js",
  "src/index.tsx",
  "src/main.ts",
  "src/main.tsx",
  "src/main.js",
  "index.ts",
  "index.js",
  "src/server.ts",
  "src/server.js",
  "server.ts",
  "server.js",
  "app/layout.tsx",
  "src/app/layout.tsx",
  // Python
  "manage.py",
  "main.py",
  "app.py",
  "wsgi.py",
  "asgi.py",
  "src/main.py",
  "__main__.py",
  // Go
  "main.go",
  "cmd/main.go",
  // Ruby
  "config.ru",
  "bin/rails",
  // Rust
  "src/main.rs",
  // Dart / Flutter
  "lib/main.dart",
];

/** Best-effort entry points from package.json + cross-ecosystem conventions. */
export function detectEntryPoints(repo: string, files: FileInfo[]): string[] {
  const entries = new Set<string>();
  try {
    const pkg = JSON.parse(readFileSync(join(repo, "package.json"), "utf8")) as Record<string, unknown>;
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
