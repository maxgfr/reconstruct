import type { FileInfo, RouteInfo, StackInfo } from "../types.js";
import type { RouteAdapter } from "./types.js";
import { nextjsAdapter } from "./nextjs.js";
import { flaskAdapter } from "./flask.js";
import { fastapiAdapter } from "./fastapi.js";
import { nestjsAdapter } from "./nestjs.js";
import { expressAdapter } from "./express.js";
import { fastifyAdapter } from "./fastify.js";
import { honoAdapter } from "./hono.js";
import { djangoAdapter } from "./django.js";
import { railsAdapter } from "./rails.js";
import { goAdapter } from "./go.js";
import { trpcAdapter } from "./trpc.js";

/**
 * Every registered route adapter. To add a framework, append its adapter here
 * and create its file under `src/adapters/` — nothing else changes. Order is
 * irrelevant; the merged result is sorted deterministically below.
 */
export const ROUTE_ADAPTERS: RouteAdapter[] = [
  nextjsAdapter,
  flaskAdapter,
  fastapiAdapter,
  nestjsAdapter,
  expressAdapter,
  fastifyAdapter,
  honoAdapter,
  djangoAdapter,
  railsAdapter,
  goAdapter,
  trpcAdapter,
];

/**
 * Run every adapter whose framework is active in the detected stack and merge
 * their routes into one sorted, de-duplicated surface. A repo can legitimately
 * activate more than one adapter (e.g. a Next.js frontend over an Express API).
 */
export function detectRoutes(files: FileInfo[], stack: StackInfo, repo: string): RouteInfo[] {
  const active = ROUTE_ADAPTERS.filter(
    (a) => a.frameworks.some((f) => stack.frameworks.includes(f)) || (a.libraries?.some((l) => stack.libraries.includes(l)) ?? false),
  );
  const seen = new Set<string>();
  const merged: RouteInfo[] = [];
  for (const adapter of active) {
    for (const r of adapter.detectRoutes(files, repo)) {
      // Method is part of the identity: `GET /items` and `POST /items` are two
      // distinct operations, not one route. Verb-agnostic routes (method
      // undefined) still de-dupe on kind+route+file.
      const key = `${r.method ?? ""} ${r.kind} ${r.route} ${r.file}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(r);
    }
  }
  merged.sort((a, b) => a.route.localeCompare(b.route) || a.kind.localeCompare(b.kind) || (a.method ?? "").localeCompare(b.method ?? ""));
  return merged;
}
