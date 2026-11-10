import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { extractDependencies } from "../src/adapters/generic.js";
import type { FileInfo } from "../src/types.js";

const repos: string[] = [];
function repo(write: (w: (rel: string, content: string) => void) => void): { dir: string; files: FileInfo[] } {
  const dir = mkdtempSync(join(tmpdir(), "recon-deps-"));
  repos.push(dir);
  const files: FileInfo[] = [];
  const w = (rel: string, content: string) => {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    files.push({ path: rel, ext: "", size: content.length, lines: 1, category: "config", binary: false });
  };
  write(w);
  return { dir, files };
}
afterAll(() => repos.forEach((r) => rmSync(r, { recursive: true, force: true })));

describe("extractDependencies — Ruby / Java ecosystems", () => {
  it("parses a Gemfile (bundler)", () => {
    const { dir, files } = repo((w) =>
      w("Gemfile", `source "https://rubygems.org"\ngem "rails", "~> 7.1"\ngem "pg"\ngroup :development, :test do\n  gem "rspec-rails"\nend\n`),
    );
    const deps = extractDependencies(dir, files);
    const bundler = deps.find((d) => d.manager === "bundler");
    expect(bundler).toBeDefined();
    expect(bundler?.runtime.rails).toBe("~> 7.1");
    expect(bundler?.runtime.pg).toBeDefined();
    expect(bundler?.dev["rspec-rails"]).toBeDefined();
  });

  it("parses a Maven pom.xml", () => {
    const { dir, files } = repo((w) =>
      w(
        "pom.xml",
        `<project><dependencies>
          <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
          <dependency><groupId>com.h2database</groupId><artifactId>h2</artifactId><version>2.1.214</version><scope>test</scope></dependency>
        </dependencies></project>`,
      ),
    );
    const deps = extractDependencies(dir, files);
    const maven = deps.find((d) => d.manager === "maven");
    expect(maven).toBeDefined();
    expect(maven?.runtime["org.springframework.boot:spring-boot-starter-web"]).toBeDefined();
    expect(maven?.dev["com.h2database:h2"]).toBe("2.1.214");
  });

  it("parses a Gradle build.gradle", () => {
    const { dir, files } = repo((w) =>
      w(
        "build.gradle",
        `dependencies {\n  implementation 'org.springframework.boot:spring-boot-starter-web'\n  testImplementation "org.junit.jupiter:junit-jupiter:5.9.0"\n}\n`,
      ),
    );
    const deps = extractDependencies(dir, files);
    const gradle = deps.find((d) => d.manager === "gradle");
    expect(gradle).toBeDefined();
    expect(gradle?.runtime["org.springframework.boot:spring-boot-starter-web"]).toBeDefined();
    expect(gradle?.dev["org.junit.jupiter:junit-jupiter"]).toBe("5.9.0");
  });
});

describe("extractDependencies — go.mod require forms", () => {
  it("reads single-line requires and every require block, but not replace targets", () => {
    const { dir, files } = repo((w) =>
      w(
        "go.mod",
        [
          "module example.com/app",
          "",
          "go 1.22",
          "",
          "require github.com/gin-gonic/gin v1.9.1",
          "",
          "require (",
          "\tgithub.com/a/one v1.0.0",
          ")",
          "",
          "require (",
          "\tgithub.com/b/two v2.1.0 // indirect",
          ")",
          "",
          "replace github.com/a/one v1.0.0 => ../one",
        ].join("\n"),
      ),
    );
    const gomod = extractDependencies(dir, files).find((d) => d.manager === "go modules");
    expect(gomod?.runtime).toEqual({ "github.com/gin-gonic/gin": "v1.9.1", "github.com/a/one": "v1.0.0", "github.com/b/two": "v2.1.0" });
  });
});

describe("extractDependencies — requirements.txt line forms", () => {
  it("keeps packages with extras and strips inline comments and environment markers", () => {
    const { dir, files } = repo((w) =>
      w(
        "requirements.txt",
        [
          "# pinned",
          "fastapi==0.110 # pinned for py3.8",
          "uvicorn[standard]>=0.20",
          "requests",
          'pywin32>=306; sys_platform == "win32"',
          "-r dev.txt",
          "-e .",
        ].join("\n"),
      ),
    );
    const pip = extractDependencies(dir, files).find((d) => d.manager === "pip");
    expect(pip?.runtime).toEqual({ fastapi: "==0.110", uvicorn: ">=0.20", requests: "", pywin32: ">=306" });
  });
});
