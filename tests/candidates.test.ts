import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { detectCandidates, detectEntryPoints } from "../src/detect/candidates.js";
import type { FileCategory, FileInfo, StackInfo } from "../src/types.js";

function fi(path: string, category: FileCategory = "code", ext = ".ts"): FileInfo {
  return { path, ext, size: 100, lines: 10, category, binary: false };
}

const STACK: StackInfo = {
  languages: ["TypeScript"],
  primaryLanguage: "TypeScript",
  frameworks: [],
  libraries: [],
  packageManagers: ["npm"],
  hasTypeScript: true,
};

let repo: string;
const files: FileInfo[] = [];

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "recon-cand-"));
  const w = (rel: string, content: string) => {
    const abs = join(repo, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  };
  w(
    "package.json",
    JSON.stringify({ name: "x", main: "dist/index.js", bin: { x: "bin/cli.js" } }),
  );
  w(
    "src/server/routers/user.ts",
    `import { createTRPCRouter, publicProcedure } from "../trpc";\nexport const userRouter = createTRPCRouter({\n  list: publicProcedure.query(() => []),\n  create: publicProcedure.mutation(() => ({})),\n});`,
  );
  w("src/app/api/users/route.ts", `export async function GET() { return Response.json([]); }`);
  w("prisma/schema.prisma", "model User {\n id Int @id @default(autoincrement())\n}");
  w("schema.graphql", "type Query {\n users: [User!]!\n}");
  w("api/orders.proto", `syntax = "proto3";\nservice Orders { rpc List (Empty) returns (OrderList); }`);
  w("manage.py", "#!/usr/bin/env python\nimport sys");
  w("src/index.ts", "console.log('hi')");
  w("routes/__init__.py", ""); // empty package marker — must not be a candidate

  files.push(
    fi("package.json", "config", ".json"),
    fi("src/server/routers/user.ts"),
    fi("src/app/api/users/route.ts"),
    fi("prisma/schema.prisma", "schema", ".prisma"),
    fi("schema.graphql", "schema", ".graphql"),
    fi("api/orders.proto", "other", ".proto"),
    fi("manage.py", "code", ".py"),
    fi("src/index.ts"),
    { path: "routes/__init__.py", ext: ".py", size: 0, lines: 0, category: "other", binary: false },
  );
});

afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("detectCandidates", () => {
  it("flags a tRPC router as an API candidate (content signal)", () => {
    const h = detectCandidates(repo, files, STACK);
    expect(h.apiCandidates).toContain("src/server/routers/user.ts");
  });

  it("flags a GraphQL SDL file and a .proto file as API candidates", () => {
    const h = detectCandidates(repo, files, STACK);
    expect(h.apiCandidates).toContain("schema.graphql");
    expect(h.apiCandidates).toContain("api/orders.proto");
  });

  it("flags Prisma/ORM schema files as schema candidates", () => {
    const h = detectCandidates(repo, files, STACK);
    expect(h.schemaCandidates).toContain("prisma/schema.prisma");
  });

  it("flags files under routing-ish dirs as route candidates", () => {
    const h = detectCandidates(repo, files, STACK);
    expect(h.routeCandidates).toContain("src/app/api/users/route.ts");
  });

  it("does not invent candidates from unrelated files", () => {
    const h = detectCandidates(repo, files, STACK);
    expect(h.routeCandidates).not.toContain("src/index.ts");
  });

  it("ignores empty files even inside a routing dir", () => {
    const h = detectCandidates(repo, files, STACK);
    expect(h.routeCandidates).not.toContain("routes/__init__.py");
  });
});

describe("detectEntryPoints", () => {
  it("reads package.json main/bin and conventional entries", () => {
    const eps = detectEntryPoints(repo, files);
    expect(eps).toContain("dist/index.js");
    expect(eps).toContain("bin/cli.js");
    expect(eps).toContain("src/index.ts");
  });

  it("recognizes non-JS entry points (Python manage.py)", () => {
    const eps = detectEntryPoints(repo, files);
    expect(eps).toContain("manage.py");
  });
});
