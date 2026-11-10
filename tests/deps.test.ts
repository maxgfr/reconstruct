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

describe("extractDependencies — Gemfile nesting", () => {
  it("a nested block's `end` inside a dev group does not end the group", () => {
    const { dir, files } = repo((w) =>
      w(
        "Gemfile",
        [
          'gem "rails"',
          "group :development, :test do",
          "  platforms :mri, :windows do",
          '    gem "debug"',
          "  end",
          '  gem "rspec-rails"',
          "end",
          'gem "puma"',
        ].join("\n"),
      ),
    );
    const bundler = extractDependencies(dir, files).find((d) => d.manager === "bundler");
    expect(Object.keys(bundler?.runtime ?? {}).sort()).toEqual(["puma", "rails"]);
    expect(Object.keys(bundler?.dev ?? {}).sort()).toEqual(["debug", "rspec-rails"]);
  });

  it("a non-dev block keeps its gems runtime; an `if` block inherits the group", () => {
    const { dir, files } = repo((w) =>
      w(
        "Gemfile",
        [
          'source "https://gems.example.com" do',
          '  gem "private-gem"',
          "end",
          "group :test do",
          '  if ENV["CI"]',
          '    gem "ci-reporter"',
          "  end",
          "end",
          'gem "pg"',
        ].join("\n"),
      ),
    );
    const bundler = extractDependencies(dir, files).find((d) => d.manager === "bundler");
    expect(Object.keys(bundler?.runtime ?? {}).sort()).toEqual(["pg", "private-gem"]);
    expect(Object.keys(bundler?.dev ?? {})).toEqual(["ci-reporter"]);
  });
});

describe("extractDependencies — Python manifests beyond requirements.txt", () => {
  const pipFor = (dir: string, files: FileInfo[], manifest: string) =>
    extractDependencies(dir, files).find((d) => d.manager === "pip" && d.manifest === manifest);

  it("reads PEP 621 [project] dependencies, optional-dependencies and dependency-groups", () => {
    const { dir, files } = repo((w) =>
      w(
        "pyproject.toml",
        [
          "[project]",
          'name = "svc"',
          'requires-python = ">=3.11"',
          "dependencies = [",
          '  "fastapi>=0.110",',
          '  "uvicorn[standard] >=0.20",',
          "  \"pywin32>=306; sys_platform == 'win32'\",",
          '  "httpx",',
          "]",
          "",
          "[project.optional-dependencies]",
          'dev = ["pytest>=8", "ruff"]',
          "",
          "[dependency-groups]",
          "test = [",
          '  "coverage",',
          '  { include-group = "dev" },',
          "]",
          "",
          "[tool.ruff]",
          "line-length = 100",
        ].join("\n"),
      ),
    );
    const pip = pipFor(dir, files, "pyproject.toml");
    expect(pip?.runtime).toEqual({ fastapi: ">=0.110", uvicorn: ">=0.20", pywin32: ">=306", httpx: "" });
    expect(pip?.dev).toEqual({ pytest: ">=8", ruff: "", coverage: "" });
  });

  it("reads Poetry dependencies and dev groups, skipping python", () => {
    const { dir, files } = repo((w) =>
      w(
        "pyproject.toml",
        [
          "[tool.poetry]",
          'name = "svc"',
          "",
          "[tool.poetry.dependencies]",
          'python = "^3.11"',
          'django = "^5.0"',
          'celery = { version = "^5.3", extras = ["redis"] }',
          'requests = "*"',
          "",
          "[tool.poetry.group.dev.dependencies]",
          'pytest = "^8.0"',
          "",
          "[tool.poetry.dev-dependencies]",
          'black = "^24"',
        ].join("\n"),
      ),
    );
    const pip = pipFor(dir, files, "pyproject.toml");
    expect(pip?.runtime).toEqual({ django: "^5.0", celery: "^5.3", requests: "" });
    expect(pip?.dev).toEqual({ pytest: "^8.0", black: "^24" });
  });

  it("emits nothing for a pyproject without dependencies", () => {
    const { dir, files } = repo((w) => w("pyproject.toml", '[tool.black]\nline-length = 100\n\n[project]\nname = "x"\n'));
    expect(pipFor(dir, files, "pyproject.toml")).toBeUndefined();
  });

  it("reads a Pipfile's [packages] and [dev-packages]", () => {
    const { dir, files } = repo((w) =>
      w(
        "Pipfile",
        [
          "[[source]]",
          'url = "https://pypi.org/simple"',
          "",
          "[packages]",
          'flask = "==3.0.0"',
          'gunicorn = "*"',
          'sqlalchemy = {version = ">=2", extras = ["asyncio"]}',
          "",
          "[dev-packages]",
          'pytest = "*"',
          "",
          "[requires]",
          'python_version = "3.12"',
        ].join("\n"),
      ),
    );
    const pip = pipFor(dir, files, "Pipfile");
    expect(pip?.runtime).toEqual({ flask: "==3.0.0", gunicorn: "", sqlalchemy: ">=2" });
    expect(pip?.dev).toEqual({ pytest: "" });
  });

  it("reads requirements/*.txt and requirements-dev.txt, dev when the name says dev/test", () => {
    const { dir, files } = repo((w) => {
      w("requirements/base.txt", "django==5.0\n");
      w("requirements/test.txt", "-r base.txt\npytest\n");
      w("requirements-dev.txt", "ruff>=0.4\n");
      w("docs/requirements.txt", "sphinx\n");
    });
    expect(pipFor(dir, files, "requirements/base.txt")).toEqual({ manager: "pip", manifest: "requirements/base.txt", runtime: { django: "==5.0" }, dev: {} });
    expect(pipFor(dir, files, "requirements/test.txt")).toEqual({ manager: "pip", manifest: "requirements/test.txt", runtime: {}, dev: { pytest: "" } });
    expect(pipFor(dir, files, "requirements-dev.txt")).toEqual({ manager: "pip", manifest: "requirements-dev.txt", runtime: {}, dev: { ruff: ">=0.4" } });
    expect(pipFor(dir, files, "docs/requirements.txt")).toBeUndefined();
  });
});
