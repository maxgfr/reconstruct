import type { FileInfo, RouteInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { joinRoute, lineAt, moduleName, pythonImportAliases, readSources, resolvePythonModule } from "./util.js";

// ---------------------------------------------------------------------------
// Python call-argument parsing shared by the Python adapters (flask, django).
// Decorator / constructor arguments nest calls and literals
// (`dependencies=[Depends(f)]`, `defaults=dict(page=1)`), so they are split on
// TOP-LEVEL commas of a bracket-balanced, string-aware scan — never a regex
// that stops at the first `)`.

/** A parsed call: positional argument texts, keyword arguments, end offset. */
export interface PyCall {
  args: string[];
  kwargs: Map<string, string>;
  /** Offset just past the closing `)`. */
  end: number;
}

/** Offset just past the Python string literal opening at `i`. */
function skipPyString(src: string, i: number): number {
  const q = src[i] as string;
  const triple = q.repeat(3);
  if (src.startsWith(triple, i)) {
    const end = src.indexOf(triple, i + 3);
    return end === -1 ? src.length : end + 3;
  }
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (c === q) return j + 1;
    if (c === "\n") return j;
    j++;
  }
  return src.length;
}

/**
 * Walk `src` from `from` to `to`, calling `onTop(i)` for every character
 * outside any bracket opened during the walk (string literals skipped).
 * Returns the offset just past the first unmatched closing bracket, or `to`.
 */
function scanTop(src: string, from: number, to: number, onTop: (i: number) => void): number {
  let depth = 0;
  for (let i = from; i < to; i++) {
    const c = src[i] as string;
    if (c === '"' || c === "'") {
      i = skipPyString(src, i) - 1;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (depth === 0) return i + 1;
      depth--;
    } else if (depth === 0) onTop(i);
  }
  return to;
}

/** Split a comma-separated argument list on its top-level commas. */
export function splitPyArgs(inner: string): string[] {
  const parts: string[] = [];
  let start = 0;
  scanTop(inner, 0, inner.length, (i) => {
    if (inner[i] !== ",") return;
    parts.push(inner.slice(start, i));
    start = i + 1;
  });
  parts.push(inner.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Parse the call whose `(` is at offset `open` in `src`. */
export function parsePyCall(src: string, open: number): PyCall {
  const end = scanTop(src, open + 1, src.length, () => {});
  const inner = src.slice(open + 1, src[end - 1] === ")" ? end - 1 : end);
  const args: string[] = [];
  const kwargs = new Map<string, string>();
  for (const part of splitPyArgs(inner)) {
    const kw = part.match(/^(\w+)\s*=(?!=)\s*([\s\S]*)$/);
    if (kw) kwargs.set(kw[1] as string, kw[2] as string);
    else if (!part.startsWith("*")) args.push(part);
  }
  return { args, kwargs, end };
}

/** The value of a plain string-literal expression (`"x"`, `r'^x$'`), else null. */
export function pyString(expr: string | undefined): string | null {
  const m = expr?.trim().match(/^[rRuUbB]{0,2}(["'])([^"'\n]*)\1$/);
  return m ? (m[2] as string) : null;
}

/** HTTP methods listed in a `methods=[…]` / `(…)` / `{…}` value, uppercased. */
export function pyMethods(expr: string | undefined): string[] {
  if (!expr) return [];
  return [...expr.matchAll(/["']([A-Za-z]+)["']/g)].map((v) => (v[1] as string).toUpperCase());
}

/** Map `alias -> module` for every `import a.b [as alias]` statement. */
function pythonModuleImports(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of src.matchAll(/^[ \t]*import[ \t]+(.+)$/gm)) {
    for (const part of (m[1] as string).split(",")) {
      const im = part.trim().match(/^([\w.]+)(?:\s+as\s+(\w+))?$/);
      if (!im) continue;
      const module = im[1] as string;
      out.set((im[2] as string) ?? module, module);
    }
  }
  return out;
}

/** `pkg` + `name` -> the submodule path (`.` + `items` -> `.items`). */
const subModule = (pkg: string, name: string): string => (pkg.endsWith(".") ? pkg + name : `${pkg}.${name}`);

/**
 * Resolves a Python name or dotted reference in one file to the file-scoped
 * key (`path::var`) of the object it names, following `from … import`
 * (relative, aliased, source-rooted) and `import a.b [as x]` statements.
 */
export function pythonRefResolver(path: string, src: string, sources: Map<string, string>): (expr: string) => string | null {
  const aliases = pythonImportAliases(src);
  const modules = pythonModuleImports(src);
  return (expr) => {
    const parts = expr.split(".");
    const attr = parts.pop() as string;
    if (!parts.length) {
      const alias = aliases.get(attr);
      if (!alias) return `${path}::${attr}`;
      const [module, name] = alias.split("::") as [string, string];
      const file = resolvePythonModule(path, module, sources);
      return file ? `${file}::${name}` : null;
    }
    // `mod.attr`: the head is a `from pkg import mod` submodule or an `import`.
    const head = parts[0] as string;
    const alias = aliases.get(head);
    let module: string;
    if (alias) {
      const [pkg, name] = alias.split("::") as [string, string];
      module = [subModule(pkg, name), ...parts.slice(1)].join(".");
    } else {
      module = modules.get(parts.join(".")) ?? parts.join(".");
    }
    const file = resolvePythonModule(path, module, sources);
    return file ? `${file}::${attr}` : null;
  };
}

// ---------------------------------------------------------------------------

const METHODS = "get|post|put|delete|patch|options|head|api_route|websocket";
// Only the head is matched; the arguments are parsed bracket-balanced.
const DECORATOR_RE = new RegExp(`@(\\w+)\\.(${METHODS})\\s*\\(`, "g");
// `router = APIRouter(...)`, typed `router: APIRouter = …`, or `fastapi.APIRouter(...)`.
const ROUTER_DEF_RE = /\b(\w+)\s*(?::\s*[\w.]+\s*)?=\s*(?:[\w.]+\.)?APIRouter\s*\(/g;
// Receiver kept: nested `api.include_router(v2, prefix=…)` composes the parent.
const INCLUDE_RE = /(\w+)\.include_router\s*\(/g;

const openParen = (m: RegExpMatchArray): number => (m.index ?? 0) + m[0].length - 1;
const prefixOf = (call: PyCall): string => pyString(call.kwargs.get("prefix")) ?? "";
const lastSeg = (mod: string): string => mod.split(".").pop() ?? mod;

/**
 * FastAPI routing: `@app.<method>("/x")` plus `APIRouter` routers whose final
 * path composes every mount prefix in the include chain with the router's own
 * `APIRouter(prefix=…)` and the decorator path. Mounts are resolved across files
 * via imports (relative, aliased, `src/`-rooted), support the `module.router`
 * attribute form, and compose transitively for nested `router.include_router(...)`.
 * The HTTP method (incl. `websocket` → `WS` and `api_route(methods=[…])`) is
 * preserved.
 */
export const fastapiAdapter: RouteAdapter = {
  id: "fastapi",
  frameworks: ["FastAPI"],
  detectRoutes(files: FileInfo[], repo: string): RouteInfo[] {
    const sources = readSources(files, repo, [".py"]);

    // 1. Each router's own prefix, keyed by "path::var".
    const ownPrefix = new Map<string, string>();
    for (const [path, src] of sources) {
      for (const m of src.matchAll(ROUTER_DEF_RE)) {
        ownPrefix.set(`${path}::${m[1]}`, prefixOf(parsePyCall(src, openParen(m))));
      }
    }
    const routerKeys = [...ownPrefix.keys()];

    // An unresolvable `mod.router` falls back to a router named `router` in any
    // file whose module's last segment is `mod`.
    const bySegment = (expr: string): string | null => {
      const parts = expr.split(".");
      if (parts.length < 2) return null;
      const attr = parts.pop() as string;
      const mod = parts.pop() as string;
      return routerKeys.find((k) => k.endsWith(`::${attr}`) && lastSeg(moduleName(k.split("::")[0] as string)) === mod) ?? null;
    };

    // 2. Include edges: childKey -> { receiverKey|null (app), mountPrefix }.
    const includeOf = new Map<string, { receiverKey: string | null; mountPrefix: string }>();
    const resolvers = new Map<string, (expr: string) => string | null>();
    for (const [path, src] of sources) {
      const resolve = pythonRefResolver(path, src, sources);
      resolvers.set(path, resolve);
      for (const m of src.matchAll(INCLUDE_RE)) {
        const call = parsePyCall(src, openParen(m));
        const expr = (call.args[0] ?? call.kwargs.get("router") ?? "").trim();
        if (!/^[\w.]+$/.test(expr)) continue;
        const resolved = resolve(expr);
        const childKey = resolved && ownPrefix.has(resolved) ? resolved : bySegment(expr);
        if (!childKey) continue;
        const receiverKey = resolve(m[1] as string);
        includeOf.set(childKey, {
          receiverKey: receiverKey && ownPrefix.has(receiverKey) ? receiverKey : null,
          mountPrefix: prefixOf(call),
        });
      }
    }

    // The full path prefix a router's own decorators get: parent chain + own prefix.
    const fullPrefix = (key: string, seen = new Set<string>()): string => {
      if (seen.has(key)) return "";
      seen.add(key);
      const own = ownPrefix.get(key) ?? "";
      const inc = includeOf.get(key);
      if (!inc) return own;
      const parent = inc.receiverKey ? fullPrefix(inc.receiverKey, seen) : "";
      return joinRoute(parent, inc.mountPrefix, own);
    };

    // 3. Emit a route per decorator (one per HTTP method).
    const routes: RouteInfo[] = [];
    for (const [path, src] of sources) {
      const resolve = resolvers.get(path) as (expr: string) => string | null;
      for (const m of src.matchAll(DECORATOR_RE)) {
        const call = parsePyCall(src, openParen(m));
        const subPath = pyString(call.args[0] ?? call.kwargs.get("path"));
        if (subPath === null) continue;
        const decorator = m[2] as string;
        // A router decorated in another file than its definition resolves via imports.
        const key = resolve(m[1] as string);
        const prefix = key && ownPrefix.has(key) ? fullPrefix(key) : "";
        const route = joinRoute(prefix, subPath);
        const line = lineAt(src, m.index ?? 0);
        const methods = decorator === "websocket" ? ["WS"] : decorator === "api_route" ? pyMethods(call.kwargs.get("methods")) : [decorator.toUpperCase()];
        if (methods.length) {
          for (const method of methods) routes.push({ route, file: path, line, kind: "api", method });
        } else {
          routes.push({ route, file: path, line, kind: "api" });
        }
      }
    }
    return routes;
  },
};
