#!/usr/bin/env node

// src/cli.ts
import { resolve as resolve5, join as join34 } from "path";
import { pathToFileURL, fileURLToPath as fileURLToPath2 } from "url";
import { existsSync as existsSync15, statSync as statSync7, realpathSync as realpathSync2 } from "fs";

// src/analyze.ts
import { basename as basename4 } from "path";

// src/walk.ts
import { closeSync, openSync, readSync, readdirSync as readdirSync4, readFileSync as readFileSync9, statSync as statSync5 } from "fs";
import { join as join16, extname as extname2, resolve as resolve3 } from "path";

// src/vendor/codeindex-engine.mjs
import { spawnSync } from "child_process";
import { readdirSync, statSync, lstatSync, readFileSync, realpathSync } from "fs";
import { join, sep, extname } from "path";
import { createHash } from "crypto";
import { readFileSync as readFileSync2, existsSync } from "fs";
import { homedir } from "os";
import { dirname, join as join2 } from "path";
import { fileURLToPath } from "url";
import { basename } from "path";
import { posix } from "path";
import { join as join4 } from "path";
import { posix as posix2 } from "path";
import { join as join5 } from "path";
import { join as join6 } from "path";
import { join as join7 } from "path";
import { join as join8 } from "path";
import { readFileSync as readFileSync4, writeFileSync as writeFileSync2 } from "fs";
import { join as join9 } from "path";
import { mkdirSync as mkdirSync2, readdirSync as readdirSync2, readFileSync as readFileSync5, rmSync as rmSync2, statSync as statSync2, writeFileSync as writeFileSync3 } from "fs";
import { dirname as dirname3, join as join10 } from "path";
import { existsSync as existsSync3, readdirSync as readdirSync3, statSync as statSync3 } from "fs";
import { join as join11 } from "path";
import { createHash as createHash3 } from "crypto";
import { existsSync as existsSync4, readFileSync as readFileSync6 } from "fs";
import { join as join13 } from "path";
import { readFileSync as readFileSync7, statSync as statSync4 } from "fs";
import { join as join14 } from "path";
import { createInterface } from "readline";
import { basename as basename2 } from "path";
import { createHash as createHash2 } from "crypto";
import { existsSync as existsSync2, mkdirSync, mkdtempSync, readFileSync as readFileSync3, renameSync, rmSync, writeFileSync } from "fs";
import { dirname as dirname2, join as join3, resolve, sep as sep2 } from "path";
import { gunzipSync } from "zlib";
import { join as join12 } from "path";
import { existsSync as existsSync5, mkdirSync as mkdirSync3, readFileSync as readFileSync8, writeFileSync as writeFileSync4 } from "fs";
import { join as join15, resolve as resolve2 } from "path";
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var ENGINE_VERSION;
var SCHEMA_VERSION;
var EXTRACTOR_VERSION;
var init_types = __esm({
  "src/types.ts"() {
    "use strict";
    ENGINE_VERSION = "2.17.0";
    SCHEMA_VERSION = 4;
    EXTRACTOR_VERSION = 10;
  }
});
function sh(cmd, args2, opts = {}) {
  const res = spawnSync(cmd, args2, {
    cwd: opts.cwd,
    input: opts.input,
    encoding: "utf8",
    timeout: opts.timeoutMs ?? 12e4,
    maxBuffer: 64 * 1024 * 1024,
    env: opts.env ?? process.env
  });
  const missing = !!res.error && res.error.code === "ENOENT";
  return {
    ok: !res.error && res.status === 0,
    status: res.status,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? (res.error ? String(res.error.message) : ""),
    missing
  };
}
function have(cmd) {
  const cached = whichCache.get(cmd);
  if (cached !== void 0) return cached;
  const probe = sh(process.platform === "win32" ? "where" : "which", [cmd]);
  const found = probe.ok && probe.stdout.trim().length > 0;
  whichCache.set(cmd, found);
  return found;
}
function slugify(input) {
  return input.toLowerCase().replace(/^https?:\/\//, "").replace(/^git@/, "").replace(/\.git$/, "").replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}
function clip(s, max) {
  if (s.length <= max) return s;
  return s.slice(0, max) + `
\u2026 [truncated ${s.length - max} chars]`;
}
function clipInline(s, max) {
  const flat = s.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  let cut = flat.slice(0, max).replace(/\s+\S*$/, "");
  if (!cut) cut = flat.slice(0, max);
  if ((cut.match(/`/g)?.length ?? 0) % 2 === 1) cut = cut.replace(/`[^`]*$/, "");
  if (cut.lastIndexOf("[") > cut.lastIndexOf("]")) cut = cut.slice(0, cut.lastIndexOf("["));
  return cut.replace(/\s+$/, "") + "\u2026";
}
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function foldText(s) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}
function keywords(question) {
  const seen = /* @__PURE__ */ new Set();
  const out2 = [];
  for (const raw of foldText(question).split(/[^A-Za-z0-9_]+/)) {
    if (!raw) continue;
    const lower = raw.toLowerCase();
    if (raw.length < 2) continue;
    if (STOPWORDS.has(lower)) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);
    out2.push(raw);
  }
  return out2;
}
function rankedKeywords(question) {
  const base = keywords(question);
  const score = (raw) => {
    let s = 0;
    if (/\d/.test(raw)) s += 3;
    if (/[A-Z]/.test(raw) && !/^[A-Z0-9]+$/.test(raw)) s += 2;
    if (/_/.test(raw)) s += 2;
    if (raw.length >= 8) s += 1.5;
    else if (raw.length >= 5) s += 0.5;
    return s;
  };
  return base.map((k, i2) => ({ k, s: score(k), i: i2 })).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.k);
}
function rrf(lists, keyOf2, k = 60) {
  const score = /* @__PURE__ */ new Map();
  for (const list of lists) {
    list.forEach((item, idx) => {
      const key = keyOf2(item);
      score.set(key, (score.get(key) ?? 0) + 1 / (k + idx + 1));
    });
  }
  return score;
}
var whichCache;
var STOPWORDS;
var init_util = __esm({
  "src/util.ts"() {
    "use strict";
    whichCache = /* @__PURE__ */ new Map();
    STOPWORDS = /* @__PURE__ */ new Set([
      "the",
      "a",
      "an",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "do",
      "does",
      "did",
      "how",
      "what",
      "why",
      "when",
      "where",
      "which",
      "who",
      "whom",
      "this",
      "that",
      "these",
      "those",
      "of",
      "in",
      "on",
      "to",
      "for",
      "with",
      "and",
      "or",
      "but",
      "if",
      "then",
      "else",
      "than",
      "as",
      "at",
      "by",
      "from",
      "into",
      "about",
      "it",
      "its",
      "i",
      "you",
      "we",
      "they",
      "he",
      "she",
      "there",
      "here",
      "can",
      "could",
      "should",
      "would",
      "will",
      "shall",
      "may",
      "might",
      "must",
      "have",
      "has",
      "had",
      "not",
      "no",
      "yes",
      "so",
      "such",
      "only",
      "any",
      "some",
      "all",
      "get",
      "set",
      "use",
      "used",
      "using",
      "work",
      "works",
      "working",
      "handle",
      "handled",
      "happen",
      "happens",
      "default",
      "value",
      "values",
      "please",
      "explain",
      "tell",
      "me",
      "my",
      "our"
    ]);
  }
});
function patternToRegExpSource(pattern) {
  let re = "";
  for (let i2 = 0; i2 < pattern.length; i2++) {
    const c2 = pattern[i2];
    if (c2 === "\\" && i2 + 1 < pattern.length) {
      re += escapeRegExp(pattern[++i2]);
    } else if (c2 === "*") {
      if (pattern[i2 + 1] === "*") {
        const atStart = i2 === 0 || pattern[i2 - 1] === "/";
        let j = i2;
        while (pattern[j + 1] === "*") j++;
        const next = pattern[j + 1];
        if (atStart && next === "/") {
          i2 = j + 1;
          re += "(?:[^/]+/)*";
        } else if (atStart && next === void 0) {
          i2 = j;
          re += ".*";
        } else {
          i2 = j;
          re += "[^/]*";
        }
      } else {
        re += "[^/]*";
      }
    } else if (c2 === "?") {
      re += "[^/]";
    } else if (c2 === "[") {
      let j = i2 + 1;
      let body2 = "";
      if (pattern[j] === "!") {
        body2 += "^";
        j++;
      }
      if (pattern[j] === "]") {
        body2 += "\\]";
        j++;
      }
      while (j < pattern.length && pattern[j] !== "]") {
        const ch = pattern[j];
        body2 += ch === "\\" || ch === "^" ? "\\" + ch : ch;
        j++;
      }
      if (j < pattern.length && body2 !== "" && body2 !== "^") {
        re += `[${body2}]`;
        i2 = j;
      } else {
        re += "\\[";
      }
    } else {
      re += escapeRegExp(c2);
    }
  }
  return re;
}
function parseGitignore(content, baseRel) {
  const rules = [];
  const prefix = baseRel ? escapeRegExp(baseRel) + "/" : "";
  for (const rawLine of content.split(/\r?\n/)) {
    let line = rawLine.replace(/(?<!\\) +$/, "");
    if (!line || line.startsWith("#")) continue;
    let negated = false;
    if (line.startsWith("!")) {
      negated = true;
      line = line.slice(1);
    }
    let dirOnly = false;
    if (line.endsWith("/")) {
      dirOnly = true;
      line = line.slice(0, -1);
    }
    if (!line) continue;
    const anchored = line.includes("/");
    if (line.startsWith("/")) line = line.slice(1);
    const body2 = patternToRegExpSource(line);
    const source = anchored ? `^${prefix}${body2}$` : `^${prefix}(?:[^/]+/)*${body2}$`;
    try {
      rules.push({ re: new RegExp(source), negated, dirOnly });
    } catch {
    }
  }
  return rules;
}
function isIgnored(rules, rel, isDir) {
  let ignored = false;
  for (const rule of rules) {
    if (rule.dirOnly && !isDir) continue;
    if (rule.re.test(rel)) ignored = !rule.negated;
  }
  return ignored;
}
var init_ignore = __esm({
  "src/ignore.ts"() {
    "use strict";
    init_util();
  }
});
function walk(root, opts = {}) {
  const maxFileBytes = opts.maxFileBytes ?? 1024 * 1024;
  const maxFiles = opts.maxFiles ?? DEFAULT_MAX_FILES;
  const useGitignore = opts.gitignore !== false;
  const ignoreDirs = opts.ignoreDirs ? new Set(opts.ignoreDirs) : IGNORE_DIRS;
  const out2 = [];
  let capped = false;
  let excluded = 0;
  let rootReal;
  try {
    rootReal = realpathSync(root);
  } catch {
    return { files: out2, capped, excluded };
  }
  const contained = (real) => real === rootReal || real.startsWith(rootReal + sep);
  const stack = [
    { dir: root, rel: "", rules: [] }
  ];
  const seenDirs = /* @__PURE__ */ new Set();
  walking: while (stack.length) {
    const frame = stack.pop();
    let real;
    try {
      real = realpathSync(frame.dir);
    } catch {
      continue;
    }
    if (seenDirs.has(real)) continue;
    seenDirs.add(real);
    if (!contained(real)) continue;
    let entries;
    try {
      entries = readdirSync(frame.dir, { withFileTypes: true }).sort(
        (a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0
      );
    } catch {
      continue;
    }
    let rules = frame.rules;
    if (useGitignore && entries.some((e) => e.name === ".gitignore")) {
      const parsed = parseGitignore(readText(join(frame.dir, ".gitignore")), frame.rel);
      if (parsed.length) rules = [...rules, ...parsed];
    }
    for (const entry of entries) {
      const name2 = entry.name;
      const abs = join(frame.dir, name2);
      const rel = frame.rel ? `${frame.rel}/${name2}` : name2;
      const isLink = entry.isSymbolicLink();
      if (entry.isDirectory() && ignoreDirs.has(name2)) continue;
      let st;
      try {
        st = isLink ? statSync(abs) : lstatSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (ignoreDirs.has(name2)) continue;
        if (isLink) continue;
        if (useGitignore && rules.length && isIgnored(rules, rel, true)) continue;
        stack.push({ dir: abs, rel, rules });
        continue;
      }
      if (!st.isFile()) continue;
      if (st.size > maxFileBytes) {
        excluded++;
        continue;
      }
      if (LOCKFILES.has(name2.toLowerCase())) {
        excluded++;
        continue;
      }
      const ext = extname(name2).toLowerCase();
      if (BINARY_EXT.has(ext)) {
        excluded++;
        continue;
      }
      if (name2.endsWith(".min.js") || name2.endsWith(".min.css")) {
        excluded++;
        continue;
      }
      if (useGitignore && rules.length && isIgnored(rules, rel, false)) {
        excluded++;
        continue;
      }
      if (isLink) {
        try {
          if (!contained(realpathSync(abs))) continue;
        } catch {
          continue;
        }
      }
      if (out2.length >= maxFiles) {
        capped = true;
        break walking;
      }
      out2.push({ rel: rel.split(sep).join("/"), abs, size: st.size, ext, mtimeMs: st.mtimeMs });
    }
  }
  return { files: out2, capped, excluded };
}
function readText(abs) {
  try {
    const buf = readFileSync(abs);
    if (buf.length >= 2 && buf[0] === 255 && buf[1] === 254) {
      return buf.subarray(2, 2 + (buf.length - 2 & ~1)).toString("utf16le");
    }
    if (buf.length >= 2 && buf[0] === 254 && buf[1] === 255) {
      const swapped = Buffer.from(buf.subarray(2, 2 + (buf.length - 2 & ~1)));
      swapped.swap16();
      return swapped.toString("utf16le");
    }
    if (buf.length >= 3 && buf[0] === 239 && buf[1] === 187 && buf[2] === 191) return buf.subarray(3).toString("utf8");
    if (buf.includes(0)) return "";
    const text = buf.toString("utf8");
    return text.includes("\uFFFD") ? buf.toString("latin1") : text;
  } catch {
    return "";
  }
}
var IGNORE_DIRS;
var LOCKFILES;
var BINARY_EXT;
var DEFAULT_MAX_FILES;
var init_walk = __esm({
  "src/walk.ts"() {
    "use strict";
    init_ignore();
    IGNORE_DIRS = /* @__PURE__ */ new Set([
      ".git",
      "node_modules",
      ".pnpm",
      "bower_components",
      "vendor",
      "dist",
      "build",
      "out",
      "target",
      ".next",
      ".nuxt",
      ".svelte-kit",
      ".turbo",
      "coverage",
      "__pycache__",
      ".venv",
      "venv",
      ".tox",
      ".mypy_cache",
      ".pytest_cache",
      ".gradle",
      ".idea",
      ".vscode",
      ".cache",
      "tmp",
      ".ultraindex",
      ".codeindex",
      "Pods",
      "DerivedData",
      ".terraform",
      "elm-stuff",
      ".dart_tool"
    ]);
    LOCKFILES = /* @__PURE__ */ new Set([
      "package-lock.json",
      "npm-shrinkwrap.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "bun.lockb",
      "composer.lock",
      "cargo.lock",
      "poetry.lock",
      "pipfile.lock",
      "gemfile.lock",
      "go.sum",
      "flake.lock",
      "packages.lock.json",
      "podfile.lock",
      "mix.lock"
    ]);
    BINARY_EXT = /* @__PURE__ */ new Set([
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".webp",
      ".bmp",
      ".ico",
      ".icns",
      ".svg",
      ".pdf",
      ".zip",
      ".gz",
      ".tar",
      ".tgz",
      ".bz2",
      ".xz",
      ".7z",
      ".rar",
      ".jar",
      ".war",
      ".class",
      ".so",
      ".dylib",
      ".dll",
      ".exe",
      ".bin",
      ".o",
      ".a",
      ".wasm",
      ".woff",
      ".woff2",
      ".ttf",
      ".otf",
      ".eot",
      ".mp3",
      ".mp4",
      ".mov",
      ".avi",
      ".webm",
      ".wav",
      ".flac",
      ".ogg",
      ".lock",
      ".min.js",
      ".map"
    ]);
    DEFAULT_MAX_FILES = 2e4;
  }
});
function headCommit(dir) {
  const res = sh("git", ["-C", dir, "rev-parse", "--short", "HEAD"]);
  return res.ok ? res.stdout.trim() : void 0;
}
function isGitWorktree(dir) {
  return sh("git", ["-C", dir, "rev-parse", "--is-inside-work-tree"]).ok;
}
function resolveBaseRef(dir, base) {
  const verify = (ref) => sh("git", [...gitArgs(dir), "rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).ok;
  const mergeBase = (ref) => {
    const mb = sh("git", [...gitArgs(dir), "merge-base", ref, "HEAD"]);
    return mb.ok ? mb.stdout.trim() : void 0;
  };
  if (base) {
    if (!verify(base)) return { error: `base ref "${base}" not found (tried git rev-parse --verify)` };
    const mb = mergeBase(base);
    if (!mb) return { error: `no merge-base between "${base}" and HEAD` };
    return { ref: base, mergeBase: mb };
  }
  const originHead = sh("git", [...gitArgs(dir), "symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"]);
  const candidates = [
    ...originHead.ok ? [originHead.stdout.trim().replace("refs/remotes/", "")] : [],
    "origin/main",
    "origin/master",
    "main",
    "master"
  ];
  for (const c2 of candidates) {
    if (!verify(c2)) continue;
    const mb = mergeBase(c2);
    if (mb) return { ref: c2, mergeBase: mb };
  }
  const head = sh("git", [...gitArgs(dir), "rev-parse", "HEAD"]);
  if (!head.ok) return { error: "cannot resolve HEAD \u2014 empty repository?" };
  return {
    ref: "HEAD",
    mergeBase: head.stdout.trim(),
    note: "base: HEAD (no default branch found \u2014 reviewing uncommitted work)"
  };
}
function diffFiles(dir, spec) {
  const out2 = [];
  const ns = sh("git", [...gitArgs(dir), "diff", "-z", "-M", "--name-status", ...rangeArgs(spec)]);
  if (ns.ok) {
    const toks = ns.stdout.split("\0");
    let i2 = 0;
    while (i2 < toks.length) {
      const st = toks[i2++];
      if (!st) break;
      const code = st[0];
      if (code === "R" || code === "C") {
        const oldPath = toks[i2++];
        const path = toks[i2++];
        if (path) out2.push({ path, status: "renamed", oldPath });
      } else {
        const path = toks[i2++];
        if (!path) break;
        const status = code === "A" ? "added" : code === "D" ? "deleted" : "modified";
        out2.push({ path, status });
      }
    }
  }
  const byPath = new Map(out2.map((f) => [f.path, f]));
  const num = sh("git", [...gitArgs(dir), "diff", "-z", "-M", "--numstat", ...rangeArgs(spec)]);
  if (num.ok) {
    const toks = num.stdout.split("\0");
    let i2 = 0;
    while (i2 < toks.length) {
      const head = toks[i2++];
      if (!head) break;
      const m = head.match(/^(-|\d+)\t(-|\d+)\t([\s\S]*)$/);
      if (!m) continue;
      let path = m[3];
      if (path === "") {
        i2++;
        path = toks[i2++] ?? "";
      }
      const rec = byPath.get(path);
      if (!rec) continue;
      if (m[1] === "-") rec.binary = true;
      else {
        rec.linesAdded = Number(m[1]);
        rec.linesDeleted = Number(m[2]);
      }
    }
  }
  return out2;
}
function diffHunks(dir, spec) {
  const map = /* @__PURE__ */ new Map();
  const res = sh("git", [...gitArgs(dir), "diff", "-M", "--unified=0", ...rangeArgs(spec)]);
  if (!res.ok) return map;
  let current;
  for (const line of res.stdout.split("\n")) {
    if (line.startsWith("+++ ")) {
      const p = line.slice(4).trim();
      if (p === "/dev/null") {
        current = void 0;
        continue;
      }
      const path = p.startsWith("b/") ? p.slice(2) : p;
      current = map.get(path) ?? [];
      map.set(path, current);
    } else if (current && line.startsWith("@@")) {
      const m = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (!m) continue;
      const start2 = Number(m[1]);
      const count = m[2] === void 0 ? 1 : Number(m[2]);
      if (count === 0) current.push({ start: Math.max(start2, 1), end: Math.max(start2, 1), approx: true });
      else current.push({ start: start2, end: start2 + count - 1 });
    }
  }
  return map;
}
function untrackedFiles(dir) {
  const res = sh("git", [...gitArgs(dir), "ls-files", "--others", "--exclude-standard", "-z"]);
  if (!res.ok) return [];
  return res.stdout.split("\0").filter((p) => p.length > 0);
}
function gitChurn(dir, opts = {}) {
  const churn = /* @__PURE__ */ new Map();
  const range = opts.since ? [`${opts.since}..HEAD`] : [];
  const res = sh("git", [...gitArgs(dir), "log", ...range, "--pretty=format:", "--name-only", "-z"]);
  if (!res.ok) return { churn, ok: false };
  for (const tok of res.stdout.split("\0")) {
    const f = tok.replace(/^\n+/, "").trim();
    if (f) churn.set(f, (churn.get(f) ?? 0) + 1);
  }
  return { churn, ok: true };
}
function changedSince(dir, ref) {
  const out2 = /* @__PURE__ */ new Set();
  const diff = sh("git", [...gitArgs(dir), "diff", "-z", "--name-only", ref, "--"]);
  if (diff.ok) {
    for (const p of diff.stdout.split("\0")) if (p) out2.add(p);
  }
  for (const p of untrackedFiles(dir)) out2.add(p);
  return out2;
}
var gitArgs;
var rangeArgs;
var init_git = __esm({
  "src/git.ts"() {
    "use strict";
    init_util();
    gitArgs = (dir) => ["-C", dir, "-c", "core.quotePath=false"];
    rangeArgs = (spec) => spec.staged ? ["--cached"] : [spec.mergeBase];
  }
});
function sha1(s) {
  return createHash("sha1").update(s).digest("hex");
}
function shortHash(s, n = 8) {
  return sha1(s).slice(0, n);
}
var init_hash = __esm({
  "src/hash.ts"() {
    "use strict";
  }
});
function scan(rel, content, lang, rules) {
  const out2 = [];
  const lines = content.split(/\r?\n/);
  for (let i2 = 0; i2 < lines.length; i2++) {
    const line = lines[i2];
    if (!line.trim()) continue;
    for (const rule of rules) {
      const m = rule.re.exec(line);
      if (!m) continue;
      const name2 = m.groups?.name ?? m[1];
      if (!name2) continue;
      const exported = typeof rule.exported === "function" ? rule.exported(m, line) : rule.exported ?? false;
      out2.push({
        name: name2,
        kind: rule.kind,
        file: rel,
        line: i2 + 1,
        signature: line.trim().slice(0, 200),
        exported,
        lang
      });
      break;
    }
  }
  return out2;
}
function extToLang(ext) {
  return EXT_LANG[ext] ?? "other";
}
function extractReexports(rel, content, localSymbols) {
  if (!REEXPORT_EXTS.has(rel.slice(rel.lastIndexOf(".")))) return [];
  const lang = /\.(ts|tsx|mts|cts)$/.test(rel) ? "typescript" : "javascript";
  const out2 = [];
  const seen = /* @__PURE__ */ new Set();
  const lineAt = (idx) => content.slice(0, idx).split(/\r?\n/).length;
  const localDeclOf = /* @__PURE__ */ new Map();
  for (const s of localSymbols) if (!localDeclOf.has(s.name)) localDeclOf.set(s.name, s);
  const named = /export\s*\{([\s\S]*?)\}\s*(?:from\s*['"]([^'"]+)['"])?\s*;?/g;
  let m;
  while ((m = named.exec(content)) && out2.length < 60) {
    const from = m[2];
    for (const part of m[1].split(",")) {
      const p = part.trim().replace(/^type\s+/, "");
      const as = /^(\S+)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(p);
      const orig = as ? as[1] : p;
      const name2 = as ? as[2] : p;
      if (!/^[A-Za-z_$][\w$]*$/.test(name2) || name2 === "default" || seen.has(name2)) continue;
      seen.add(name2);
      const decl = !from ? localDeclOf.get(orig) : void 0;
      out2.push({
        name: name2,
        kind: decl?.kind ?? "reexport",
        file: rel,
        line: decl ? decl.line : lineAt(m.index),
        ...decl?.endLine !== void 0 ? { endLine: decl.endLine } : {},
        signature: from ? `export { ${name2} } from "${from}"` : `export { ${name2} }`,
        exported: true,
        lang
      });
    }
  }
  const star = /export\s*\*\s*(?:as\s+([A-Za-z_$][\w$]*)\s+)?from\s*['"]([^'"]+)['"]/g;
  while ((m = star.exec(content)) && out2.length < 60) {
    const ns = m[1];
    const from = m[2];
    const key = "*" + (ns ?? from);
    if (seen.has(key)) continue;
    seen.add(key);
    out2.push({
      name: ns ?? `* (${from})`,
      kind: ns ? "reexport" : "reexport-all",
      file: rel,
      line: lineAt(m.index),
      signature: `export * ${ns ? `as ${ns} ` : ""}from "${from}"`,
      exported: true,
      lang
    });
  }
  return out2;
}
var EXT_LANG;
var REEXPORT_EXTS;
var init_common = __esm({
  "src/lang/common.ts"() {
    "use strict";
    EXT_LANG = {
      ".ts": "typescript",
      ".tsx": "typescript",
      ".mts": "typescript",
      ".cts": "typescript",
      ".js": "javascript",
      ".jsx": "javascript",
      ".mjs": "javascript",
      ".cjs": "javascript",
      ".py": "python",
      ".pyi": "python",
      ".go": "go",
      ".rb": "ruby",
      ".rake": "ruby",
      ".java": "java",
      ".rs": "rust",
      ".c": "c",
      ".h": "c",
      ".cc": "cpp",
      ".cpp": "cpp",
      ".cxx": "cpp",
      ".hpp": "cpp",
      ".cs": "csharp",
      ".php": "php",
      ".swift": "swift",
      ".kt": "kotlin",
      ".kts": "kotlin",
      ".scala": "scala",
      ".sc": "scala",
      ".clj": "clojure",
      ".ex": "elixir",
      ".exs": "elixir",
      ".erl": "erlang",
      ".hs": "haskell",
      ".dart": "dart",
      ".lua": "lua",
      ".sh": "shell",
      ".bash": "shell",
      ".zsh": "shell",
      ".ksh": "shell",
      ".fish": "shell",
      ".hh": "cpp",
      ".m": "objective-c",
      ".mm": "objective-c",
      ".sql": "sql",
      ".graphql": "graphql",
      ".gql": "graphql",
      ".proto": "protobuf",
      ".md": "markdown",
      ".mdx": "markdown",
      ".rst": "restructuredtext",
      ".txt": "text",
      ".json": "json",
      ".yaml": "yaml",
      ".yml": "yaml",
      ".toml": "toml",
      ".ini": "ini",
      ".html": "html",
      ".css": "css",
      ".scss": "scss",
      ".vue": "vue",
      ".svelte": "svelte",
      ".astro": "astro"
    };
    REEXPORT_EXTS = /* @__PURE__ */ new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
  }
});
function stemOf(rel) {
  return (rel.split("/").pop() ?? "").replace(/\.[^.]+$/, "");
}
function applyExportLists(content, symbols) {
  const markExported = (name2) => {
    if (!name2 || name2 === "default") return;
    for (const s of symbols) if (s.name === name2) s.exported = true;
  };
  const handleList = (inner, cjs) => {
    for (const raw of inner.split(",")) {
      const part = raw.trim().replace(/^type\s+/, "");
      if (!part) continue;
      const asMatch = /^([\w$]+)\s+as\s+([\w$]+)$/.exec(part);
      if (asMatch) {
        if (asMatch[2] !== "default") markExported(asMatch[1]);
        continue;
      }
      if (cjs) {
        const kv = /^([\w$]+)\s*:\s*([\w$]+)$/.exec(part);
        if (kv) {
          markExported(kv[1]);
          markExported(kv[2]);
          continue;
        }
      }
      markExported(/^([\w$]+)/.exec(part)?.[1]);
    }
  };
  let m;
  EXPORT_LIST_RE.lastIndex = 0;
  while (m = EXPORT_LIST_RE.exec(content)) {
    if (!m[2]) handleList(m[1] ?? "", false);
  }
  CJS_OBJECT_RE.lastIndex = 0;
  while (m = CJS_OBJECT_RE.exec(content)) handleList(m[1] ?? "", true);
  DEFAULT_ID_RE.lastIndex = 0;
  while (m = DEFAULT_ID_RE.exec(content)) markExported(m[2]);
}
var RULES;
var ANON_DEFAULT_RE;
var NAMED_DEFAULT_RE;
var EXPORT_LIST_RE;
var CJS_OBJECT_RE;
var DEFAULT_ID_RE;
var jsTs;
var init_js_ts = __esm({
  "src/lang/js-ts.ts"() {
    "use strict";
    init_common();
    RULES = [
      { re: /^\s*export\s+(?:async\s+)?function\s+(?<name>[\w$]+)/, kind: "function", exported: true },
      { re: /^\s*export\s+default\s+(?:async\s+)?function\s+(?<name>[\w$]+)/, kind: "function", exported: true },
      { re: /^\s*export\s+default\s+(?:abstract\s+)?class\s+(?!extends\b)(?<name>[\w$]+)/, kind: "class", exported: true },
      { re: /^\s*(?:async\s+)?function\s+(?<name>[\w$]+)/, kind: "function", exported: false },
      { re: /^\s*export\s+(?:abstract\s+)?class\s+(?<name>[\w$]+)/, kind: "class", exported: true },
      { re: /^\s*(?:abstract\s+)?class\s+(?<name>[\w$]+)/, kind: "class", exported: false },
      { re: /^\s*export\s+interface\s+(?<name>[\w$]+)/, kind: "interface", exported: true },
      { re: /^\s*interface\s+(?<name>[\w$]+)/, kind: "interface", exported: false },
      { re: /^\s*export\s+type\s+(?<name>[\w$]+)/, kind: "type", exported: true },
      { re: /^\s*type\s+(?<name>[\w$]+)\s*[=<]/, kind: "type", exported: false },
      { re: /^\s*export\s+enum\s+(?<name>[\w$]+)/, kind: "enum", exported: true },
      { re: /^\s*export\s+const\s+enum\s+(?<name>[\w$]+)/, kind: "enum", exported: true },
      // exported const/let bound to an arrow fn or value
      { re: /^\s*export\s+(?:const|let|var)\s+(?<name>[\w$]+)\s*[:=]/, kind: "const", exported: true },
      // CommonJS named exports: `exports.foo = …`, `module.exports.foo = …`
      { re: /^\s*exports\.(?<name>[\w$]+)\s*=/, kind: "const", exported: true },
      { re: /^\s*module\.exports\.(?<name>[\w$]+)\s*=/, kind: "const", exported: true },
      // top-level const arrow function (not exported)
      { re: /^\s*(?:const|let)\s+(?<name>[\w$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::[^=]+)?=>/, kind: "const", exported: false },
      // `export default Foo;` — a class/const declared above and exported by reference.
      { re: /^\s*export\s+default\s+(?<name>[A-Za-z_$][\w$]*)\s*;?\s*$/, kind: "default", exported: true }
    ];
    ANON_DEFAULT_RE = /^\s*export\s+default\s+(?:async\s+)?(?:function|class)?\s*(?:\(|\{|extends\b)/;
    NAMED_DEFAULT_RE = /^\s*export\s+default\s+(?:async\s+)?(?:function|class)\s+(?!extends\b)[\w$]+/;
    EXPORT_LIST_RE = /export\s*\{([^}]*)\}\s*(from\b)?/g;
    CJS_OBJECT_RE = /module\.exports\s*=\s*\{([^}]*)\}/g;
    DEFAULT_ID_RE = /(^|\n)\s*export\s+default\s+([A-Za-z_$][\w$]*)\s*;?\s*(?=\n|$)/g;
    jsTs = {
      lang: "javascript/typescript",
      exts: [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"],
      extract(rel, content) {
        const lang = rel.match(/\.(ts|tsx|mts|cts)$/) ? "typescript" : "javascript";
        const symbols = scan(rel, content, lang, RULES);
        const lines = content.split(/\r?\n/);
        for (let i2 = 0; i2 < lines.length; i2++) {
          const line = lines[i2];
          if (ANON_DEFAULT_RE.test(line) && !NAMED_DEFAULT_RE.test(line)) {
            symbols.push({
              name: stemOf(rel),
              kind: "default",
              file: rel,
              line: i2 + 1,
              signature: line.trim().slice(0, 200),
              exported: true,
              lang
            });
            break;
          }
        }
        applyExportLists(content, symbols);
        return symbols;
      }
    };
  }
});
var pub;
var RULES2;
var python;
var init_python = __esm({
  "src/lang/python.ts"() {
    "use strict";
    init_common();
    pub = (name2) => !name2.startsWith("_") || name2.startsWith("__");
    RULES2 = [
      { re: /^(?:async\s+)?def\s+(?<name>[\w]+)\s*\(/, kind: "function", exported: (m) => pub(m.groups.name) },
      { re: /^\s+(?:async\s+)?def\s+(?<name>[\w]+)\s*\(/, kind: "method", exported: (m) => pub(m.groups.name) },
      { re: /^class\s+(?<name>[\w]+)/, kind: "class", exported: (m) => pub(m.groups.name) },
      { re: /^\s+class\s+(?<name>[\w]+)/, kind: "class", exported: (m) => pub(m.groups.name) }
    ];
    python = {
      lang: "python",
      exts: [".py", ".pyi"],
      extract(rel, content) {
        return scan(rel, content, "python", RULES2);
      }
    };
  }
});
var upper;
var RULES3;
var go;
var init_go = __esm({
  "src/lang/go.ts"() {
    "use strict";
    init_common();
    upper = (name2) => /^[A-Z]/.test(name2);
    RULES3 = [
      { re: /^func\s+\([^)]*\)\s+(?<name>[\w]+)\s*\(/, kind: "method", exported: (m) => upper(m.groups.name) },
      { re: /^func\s+(?<name>[\w]+)\s*\(/, kind: "function", exported: (m) => upper(m.groups.name) },
      { re: /^type\s+(?<name>[\w]+)\s+struct\b/, kind: "struct", exported: (m) => upper(m.groups.name) },
      { re: /^type\s+(?<name>[\w]+)\s+interface\b/, kind: "interface", exported: (m) => upper(m.groups.name) },
      { re: /^type\s+(?<name>[\w]+)\s+/, kind: "type", exported: (m) => upper(m.groups.name) }
    ];
    go = {
      lang: "go",
      exts: [".go"],
      extract(rel, content) {
        return scan(rel, content, "go", RULES3);
      }
    };
  }
});
var RULES4;
var ruby;
var init_ruby = __esm({
  "src/lang/ruby.ts"() {
    "use strict";
    init_common();
    RULES4 = [
      { re: /^\s*def\s+(?:self\.)?(?<name>[\w?!=]+)/, kind: "method", exported: true },
      { re: /^\s*class\s+(?<name>[\w:]+)/, kind: "class", exported: true },
      { re: /^\s*module\s+(?<name>[\w:]+)/, kind: "module", exported: true }
    ];
    ruby = {
      lang: "ruby",
      exts: [".rb", ".rake"],
      extract(rel, content) {
        return scan(rel, content, "ruby", RULES4);
      }
    };
  }
});
var RULES5;
var java;
var init_java = __esm({
  "src/lang/java.ts"() {
    "use strict";
    init_common();
    RULES5 = [
      { re: /^\s*(?:public|protected|private)?\s*(?:abstract\s+|final\s+)?class\s+(?<name>[\w]+)/, kind: "class", exported: (_m, l) => /\bpublic\b/.test(l) },
      { re: /^\s*(?:public|protected|private)?\s*interface\s+(?<name>[\w]+)/, kind: "interface", exported: (_m, l) => /\bpublic\b/.test(l) },
      { re: /^\s*(?:public|protected|private)?\s*enum\s+(?<name>[\w]+)/, kind: "enum", exported: (_m, l) => /\bpublic\b/.test(l) },
      { re: /^\s*(?:public|protected|private)\s+(?:static\s+|final\s+|abstract\s+|synchronized\s+)*[\w<>\[\],.?\s]+\s+(?<name>[\w]+)\s*\(/, kind: "method", exported: (_m, l) => /\bpublic\b/.test(l) }
    ];
    java = {
      lang: "java",
      exts: [".java"],
      extract(rel, content) {
        return scan(rel, content, "java", RULES5);
      }
    };
  }
});
var isPub;
var RULES6;
var rust;
var init_rust = __esm({
  "src/lang/rust.ts"() {
    "use strict";
    init_common();
    isPub = (_m, l) => /^\s*pub\b/.test(l);
    RULES6 = [
      { re: /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+(?<name>[\w]+)/, kind: "function", exported: isPub },
      { re: /^\s*(?:pub(?:\([^)]*\))?\s+)?struct\s+(?<name>[\w]+)/, kind: "struct", exported: isPub },
      { re: /^\s*(?:pub(?:\([^)]*\))?\s+)?enum\s+(?<name>[\w]+)/, kind: "enum", exported: isPub },
      { re: /^\s*(?:pub(?:\([^)]*\))?\s+)?trait\s+(?<name>[\w]+)/, kind: "trait", exported: isPub },
      { re: /^\s*(?:pub(?:\([^)]*\))?\s+)?type\s+(?<name>[\w]+)/, kind: "type", exported: isPub }
    ];
    rust = {
      lang: "rust",
      exts: [".rs"],
      extract(rel, content) {
        return scan(rel, content, "rust", RULES6);
      }
    };
  }
});
var pub2;
var RULES7;
var csharp;
var init_csharp = __esm({
  "src/lang/csharp.ts"() {
    "use strict";
    init_common();
    pub2 = (_m, l) => /\b(public|internal)\b/.test(l);
    RULES7 = [
      { re: /^\s*(?:public|internal|protected|private)?\s*(?:static\s+|sealed\s+|abstract\s+|partial\s+)*(?:class|record)\s+(?<name>\w+)/, kind: "class", exported: pub2 },
      { re: /^\s*(?:public|internal|protected|private)?\s*(?:partial\s+)?interface\s+(?<name>\w+)/, kind: "interface", exported: pub2 },
      { re: /^\s*(?:public|internal|protected|private)?\s*(?:readonly\s+)?(?:ref\s+)?struct\s+(?<name>\w+)/, kind: "struct", exported: pub2 },
      { re: /^\s*(?:public|internal|protected|private)?\s*enum\s+(?<name>\w+)/, kind: "enum", exported: pub2 },
      // method: a visibility modifier, a return type, then `name(`
      { re: /^\s*(?:public|internal|protected|private)\s+(?:static\s+|virtual\s+|override\s+|async\s+|sealed\s+|abstract\s+|new\s+)*[\w<>\[\],.?]+\s+(?<name>\w+)\s*(?:<[^>]*>)?\s*\(/, kind: "method", exported: pub2 }
    ];
    csharp = {
      lang: "csharp",
      exts: [".cs"],
      extract(rel, content) {
        return scan(rel, content, "csharp", RULES7);
      }
    };
  }
});
var RULES8;
var php;
var init_php = __esm({
  "src/lang/php.ts"() {
    "use strict";
    init_common();
    RULES8 = [
      { re: /^\s*(?:abstract\s+|final\s+)*class\s+(?<name>\w+)/, kind: "class", exported: true },
      { re: /^\s*interface\s+(?<name>\w+)/, kind: "interface", exported: true },
      { re: /^\s*trait\s+(?<name>\w+)/, kind: "trait", exported: true },
      { re: /^\s*enum\s+(?<name>\w+)/, kind: "enum", exported: true },
      {
        re: /^\s*(?:public\s+|protected\s+|private\s+|static\s+|abstract\s+|final\s+)*function\s+(?<name>\w+)\s*\(/,
        kind: "function",
        exported: (_m, l) => !/\b(private|protected)\b/.test(l)
      }
    ];
    php = {
      lang: "php",
      exts: [".php"],
      extract(rel, content) {
        return scan(rel, content, "php", RULES8);
      }
    };
  }
});
var vis;
var MODS;
var RULES9;
var swift;
var init_swift = __esm({
  "src/lang/swift.ts"() {
    "use strict";
    init_common();
    vis = (_m, l) => !/\b(private|fileprivate)\b/.test(l);
    MODS = "(?:public\\s+|open\\s+|internal\\s+|private\\s+|fileprivate\\s+)?(?:final\\s+)?";
    RULES9 = [
      { re: new RegExp(`^\\s*${MODS}class\\s+(?<name>\\w+)`), kind: "class", exported: vis },
      { re: new RegExp(`^\\s*${MODS}struct\\s+(?<name>\\w+)`), kind: "struct", exported: vis },
      { re: new RegExp(`^\\s*${MODS}enum\\s+(?<name>\\w+)`), kind: "enum", exported: vis },
      { re: new RegExp(`^\\s*${MODS}protocol\\s+(?<name>\\w+)`), kind: "protocol", exported: vis },
      { re: /^\s*(?:public\s+|open\s+|internal\s+|private\s+|fileprivate\s+)?(?:static\s+|class\s+|final\s+|override\s+|mutating\s+|@\w+\s+)*func\s+(?<name>\w+)/, kind: "function", exported: vis }
    ];
    swift = {
      lang: "swift",
      exts: [".swift"],
      extract(rel, content) {
        return scan(rel, content, "swift", RULES9);
      }
    };
  }
});
var vis2;
var RULES10;
var kotlin;
var init_kotlin = __esm({
  "src/lang/kotlin.ts"() {
    "use strict";
    init_common();
    vis2 = (_m, l) => !/\b(private|internal)\b/.test(l);
    RULES10 = [
      { re: /^\s*(?:public\s+|internal\s+|private\s+|abstract\s+|sealed\s+|open\s+|final\s+|data\s+)*class\s+(?<name>\w+)/, kind: "class", exported: vis2 },
      { re: /^\s*(?:public\s+|internal\s+|private\s+|fun\s+)?interface\s+(?<name>\w+)/, kind: "interface", exported: vis2 },
      { re: /^\s*(?:public\s+|internal\s+|private\s+|companion\s+)?object\s+(?<name>\w+)/, kind: "object", exported: vis2 },
      { re: /^\s*(?:public\s+|internal\s+|private\s+|protected\s+|override\s+|open\s+|abstract\s+|suspend\s+|inline\s+|operator\s+)*fun\s+(?:<[^>]*>\s+)?(?<name>\w+)\s*\(/, kind: "function", exported: vis2 }
    ];
    kotlin = {
      lang: "kotlin",
      exts: [".kt", ".kts"],
      extract(rel, content) {
        return scan(rel, content, "kotlin", RULES10);
      }
    };
  }
});
var NOT_KEYWORD;
var RULES11;
var c;
var init_c = __esm({
  "src/lang/c.ts"() {
    "use strict";
    init_common();
    NOT_KEYWORD = "(?!\\s*(?:if|for|while|switch|return|else|do|sizeof|typedef)\\b)";
    RULES11 = [
      // C++ types
      { re: /^\s*(?:class|struct)\s+(?<name>[A-Za-z_]\w+)\s*(?:[:{]|$)/, kind: "class", exported: true },
      { re: /^\s*namespace\s+(?<name>[A-Za-z_]\w+)/, kind: "namespace", exported: true },
      // typedef struct/enum/union NAME {
      { re: /^\s*(?:typedef\s+)?(?:struct|enum|union)\s+(?<name>[A-Za-z_]\w+)\s*\{/, kind: "struct", exported: true },
      // function definition: <type ...> name(<args>) [const] {?  at column 0-ish
      { re: new RegExp(`^${NOT_KEYWORD}[A-Za-z_][\\w\\s\\*&<>:,]*?\\b(?<name>[A-Za-z_]\\w+)\\s*\\([^;{]*\\)\\s*(?:const)?\\s*\\{?\\s*$`), kind: "function", exported: true }
    ];
    c = {
      lang: "c/cpp",
      exts: [".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".hh"],
      extract(rel, content) {
        return scan(rel, content, rel.match(/\.(c|h)$/) ? "c" : "cpp", RULES11);
      }
    };
  }
});
var RULES12;
var lua;
var init_lua = __esm({
  "src/lang/lua.ts"() {
    "use strict";
    init_common();
    RULES12 = [
      { re: /^\s*local\s+function\s+(?<name>[\w.:]+)\s*\(/, kind: "function", exported: false },
      { re: /^\s*function\s+(?<name>[\w.:]+)\s*\(/, kind: "function", exported: true },
      { re: /^\s*(?:local\s+)?(?<name>[\w.]+)\s*=\s*function\s*\(/, kind: "function", exported: true }
    ];
    lua = {
      lang: "lua",
      exts: [".lua"],
      extract(rel, content) {
        return scan(rel, content, "lua", RULES12);
      }
    };
  }
});
var RULES13;
var shell;
var init_shell = __esm({
  "src/lang/shell.ts"() {
    "use strict";
    init_common();
    RULES13 = [
      { re: /^\s*function\s+(?<name>[\w:-]+)\s*(?:\(\))?\s*\{?/, kind: "function", exported: true },
      { re: /^\s*(?<name>[A-Za-z_][\w:-]*)\s*\(\)\s*\{?/, kind: "function", exported: true }
    ];
    shell = {
      lang: "shell",
      exts: [".sh", ".bash", ".zsh", ".ksh"],
      extract(rel, content) {
        return scan(rel, content, "shell", RULES13);
      }
    };
  }
});
var RULES14;
var elixir;
var init_elixir = __esm({
  "src/lang/elixir.ts"() {
    "use strict";
    init_common();
    RULES14 = [
      { re: /^\s*defmodule\s+(?<name>[\w.]+)/, kind: "module", exported: true },
      { re: /^\s*defp\s+(?<name>[\w?!]+)/, kind: "function", exported: false },
      { re: /^\s*def\s+(?<name>[\w?!]+)/, kind: "function", exported: true },
      { re: /^\s*defmacrop?\s+(?<name>[\w?!]+)/, kind: "macro", exported: true }
    ];
    elixir = {
      lang: "elixir",
      exts: [".ex", ".exs"],
      extract(rel, content) {
        return scan(rel, content, "elixir", RULES14);
      }
    };
  }
});
var RULES15;
var scala;
var init_scala = __esm({
  "src/lang/scala.ts"() {
    "use strict";
    init_common();
    RULES15 = [
      { re: /^\s*(?:final\s+|sealed\s+|abstract\s+|implicit\s+)*(?:case\s+)?class\s+(?<name>\w+)/, kind: "class", exported: true },
      { re: /^\s*(?:sealed\s+)?trait\s+(?<name>\w+)/, kind: "trait", exported: true },
      { re: /^\s*(?:case\s+)?object\s+(?<name>\w+)/, kind: "object", exported: true },
      { re: /^\s*(?:override\s+|final\s+|private\s+|protected\s+|implicit\s+)*def\s+(?<name>\w+)/, kind: "def", exported: (_m, l) => !/\b(private|protected)\b/.test(l) }
    ];
    scala = {
      lang: "scala",
      exts: [".scala", ".sc"],
      extract(rel, content) {
        return scan(rel, content, "scala", RULES15);
      }
    };
  }
});
function extractSymbols(rel, ext, content) {
  const extractor = BY_EXT.get(ext);
  let symbols;
  if (!extractor) symbols = [];
  else {
    try {
      symbols = extractor.extract(rel, content);
    } catch {
      symbols = [];
    }
  }
  const known = new Set(symbols.map((s) => s.name));
  const reexports = extractReexports(rel, content, symbols).filter((s) => !known.has(s.name));
  return reexports.length ? [...symbols, ...reexports] : symbols;
}
function languageOf(ext) {
  return BY_EXT.get(ext)?.lang ?? extToLang(ext);
}
var EXTRACTORS;
var BY_EXT;
var init_registry = __esm({
  "src/lang/registry.ts"() {
    "use strict";
    init_common();
    init_js_ts();
    init_python();
    init_go();
    init_ruby();
    init_java();
    init_rust();
    init_csharp();
    init_php();
    init_swift();
    init_kotlin();
    init_c();
    init_lua();
    init_shell();
    init_elixir();
    init_scala();
    EXTRACTORS = [
      jsTs,
      python,
      go,
      ruby,
      java,
      rust,
      csharp,
      php,
      swift,
      kotlin,
      c,
      lua,
      shell,
      elixir,
      scala
    ];
    BY_EXT = /* @__PURE__ */ new Map();
    for (const e of EXTRACTORS) for (const ext of e.exts) BY_EXT.set(ext, e);
  }
});
function isDoc(rel, ext) {
  const base = rel.split("/").pop().toLowerCase();
  return DOC_EXT.has(ext) || DOC_BASENAME.test(base) || DOC_DIR.test(rel);
}
function isConfig(rel, ext) {
  const base = rel.split("/").pop().toLowerCase();
  return CONFIG_BASENAME.has(base) || CONFIG_EXT.has(ext);
}
function isCode(ext) {
  return !NON_CODE_LANGS.has(languageOf(ext));
}
function classify(rel, ext) {
  if (isCode(ext)) return "code";
  if (isDoc(rel, ext)) return "doc";
  if (isConfig(rel, ext)) return "config";
  return "other";
}
var DOC_BASENAME;
var DOC_EXT;
var DOC_DIR;
var CONFIG_BASENAME;
var CONFIG_EXT;
var MARKDOWN_EXT;
var NON_CODE_LANGS;
var init_classify = __esm({
  "src/classify.ts"() {
    "use strict";
    init_registry();
    DOC_BASENAME = /^(readme|changelog|contributing|history|news|authors|notice|security|code_of_conduct|faq|getting[-_]?started|usage|guide|tutorial)\b/i;
    DOC_EXT = /* @__PURE__ */ new Set([".md", ".mdx", ".rst", ".adoc", ".txt"]);
    DOC_DIR = /^(docs?|documentation|wiki|guides?|website|site|book)\//i;
    CONFIG_BASENAME = /* @__PURE__ */ new Set([
      "package.json",
      "pnpm-workspace.yaml",
      "tsconfig.json",
      "jsconfig.json",
      "pyproject.toml",
      "setup.py",
      "setup.cfg",
      "requirements.txt",
      "pipfile",
      "go.mod",
      "cargo.toml",
      "gemfile",
      "pom.xml",
      "build.gradle",
      "build.gradle.kts",
      "composer.json",
      "mix.exs",
      "pubspec.yaml",
      "build.sbt",
      "dockerfile",
      "docker-compose.yml",
      "docker-compose.yaml",
      "makefile",
      ".env.example",
      "manifest.json"
    ]);
    CONFIG_EXT = /* @__PURE__ */ new Set([".json", ".yaml", ".yml", ".toml", ".ini", ".cfg"]);
    MARKDOWN_EXT = /* @__PURE__ */ new Set([".md", ".mdx"]);
    NON_CODE_LANGS = /* @__PURE__ */ new Set([
      "markdown",
      "restructuredtext",
      "text",
      "json",
      "yaml",
      "toml",
      "ini",
      "other",
      "html",
      "css",
      "scss"
    ]);
  }
});
function globToRegExp(glob) {
  let re = "";
  for (let i2 = 0; i2 < glob.length; i2++) {
    const c2 = glob[i2];
    if (c2 === "*") {
      if (glob[i2 + 1] === "*") {
        i2++;
        if (glob[i2 + 1] === "/") {
          i2++;
          re += "(?:.*/)?";
        } else {
          re += ".*";
        }
      } else {
        re += "[^/]*";
      }
    } else if (c2 === "?") {
      re += "[^/]";
    } else {
      re += escapeRegExp(c2);
    }
  }
  return new RegExp(`^${re}$`);
}
function compileGlobs(globs) {
  if (!globs || globs.length === 0) return null;
  const res = globs.map(globToRegExp);
  return (rel) => res.some((r) => r.test(rel));
}
function compileGlobFilter(globs) {
  if (!globs || globs.length === 0) return null;
  const include = compileGlobs(globs.filter((g) => !g.startsWith("!")));
  const exclude = compileGlobs(globs.filter((g) => g.startsWith("!")).map((g) => g.slice(1)));
  return (rel) => (!include || include(rel)) && !exclude?.(rel);
}
var init_glob = __esm({
  "src/glob.ts"() {
    "use strict";
    init_util();
  }
});
function byStr(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
function byKey(keyOf2) {
  return (a, b) => byStr(keyOf2(a), keyOf2(b));
}
var init_sort = __esm({
  "src/sort.ts"() {
    "use strict";
  }
});
function stripFences(content) {
  const lines = content.split(/\r?\n/);
  const out2 = [];
  let fence = null;
  for (const line of lines) {
    const m = /^\s*(```+|~~~+)/.exec(line);
    if (fence) {
      if (m && line.trim().startsWith(fence[0][0].repeat(3).slice(0, 3))) fence = null;
      out2.push("");
      continue;
    }
    if (m) {
      fence = m[1];
      out2.push("");
      continue;
    }
    out2.push(line);
  }
  return out2.join("\n");
}
function isExternalTarget(spec) {
  if (!spec) return true;
  if (spec.startsWith("#")) return true;
  if (spec.startsWith("//")) return true;
  return /^[a-z][a-z0-9+.-]*:/i.test(spec);
}
function cleanProse(line) {
  return line.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/`([^`]*)`/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#>*_~-]+/g, " ").replace(/\s+/g, " ").trim();
}
function hasProse(s) {
  return /[A-Za-zÀ-ɏ]{3,}/.test(s);
}
function isBoilerplate(s) {
  return /^(all notable changes to this project|in the interest of fostering|this project adheres to|we as members and leaders|table of contents)\b/i.test(s);
}
function extractMarkdown(content) {
  let body2 = content;
  let frontTitle;
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(body2);
  if (fm) {
    const t = /(^|\n)title:\s*["']?(.+?)["']?\s*(\n|$)/i.exec(fm[1]);
    if (t) frontTitle = t[2].trim();
    body2 = body2.slice(fm[0].length);
  }
  const scan2 = stripFences(body2);
  const lines = scan2.split(/\r?\n/);
  const headings = [];
  let title = frontTitle;
  let summary;
  let summaryClosed = false;
  for (const line of lines) {
    const h = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (h) {
      const text = cleanProse(h[2]);
      headings.push(text);
      if (!title && h[1].length === 1) title = text;
      if (!summary && h[1].length >= 2) summaryClosed = true;
      continue;
    }
    if (!summary && !summaryClosed) {
      const t = line.trim();
      if (t && !/^([-*+]|\d+\.)\s/.test(t) && !t.startsWith("|") && !t.startsWith("<")) {
        const cleaned = cleanProse(t);
        if (cleaned.length >= 8 && hasProse(cleaned) && !cleaned.endsWith(":") && !isBoilerplate(cleaned)) {
          summary = cleaned.slice(0, 200);
        }
      }
    }
  }
  const refs = [];
  const seen = /* @__PURE__ */ new Set();
  const addRef = (raw) => {
    let spec = raw.trim();
    spec = spec.replace(/\s+["'(].*$/, "").trim();
    spec = spec.replace(/^<|>$/g, "");
    if (isExternalTarget(spec)) return;
    if (seen.has(spec)) return;
    seen.add(spec);
    refs.push({ kind: "doc-link", spec });
  };
  const inline = /!?\[[^\]]*\]\(([^)]+)\)/g;
  let m;
  while (m = inline.exec(scan2)) addRef(m[1]);
  const refdef = /^\s*\[[^\]]+\]:\s+(\S+)/gm;
  while (m = refdef.exec(scan2)) addRef(m[1]);
  return { title, summary, headings, refs };
}
var init_markdown = __esm({
  "src/extract/markdown.ts"() {
    "use strict";
  }
});
function assertInternal(x) {
  if (x !== INTERNAL) throw new Error("Illegal constructor");
}
function isPoint(point) {
  return !!point && typeof point.row === "number" && typeof point.column === "number";
}
function setModule(module2) {
  C = module2;
}
function getText(tree, startIndex, endIndex, startPosition) {
  const length = endIndex - startIndex;
  let result = tree.textCallback(startIndex, startPosition);
  if (result) {
    startIndex += result.length;
    while (startIndex < endIndex) {
      const string = tree.textCallback(startIndex, startPosition);
      if (string && string.length > 0) {
        startIndex += string.length;
        result += string;
      } else {
        break;
      }
    }
    if (startIndex > endIndex) {
      result = result.slice(0, length);
    }
  }
  return result ?? "";
}
function unmarshalCaptures(query, tree, address, patternIndex, result) {
  for (let i2 = 0, n = result.length; i2 < n; i2++) {
    const captureIndex = C.getValue(address, "i32");
    address += SIZE_OF_INT;
    const node = unmarshalNode(tree, address);
    address += SIZE_OF_NODE;
    result[i2] = { patternIndex, name: query.captureNames[captureIndex], node };
  }
  return address;
}
function marshalNode(node, index = 0) {
  let address = TRANSFER_BUFFER + index * SIZE_OF_NODE;
  C.setValue(address, node.id, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, node.startIndex, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, node.startPosition.row, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, node.startPosition.column, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, node[0], "i32");
}
function unmarshalNode(tree, address = TRANSFER_BUFFER) {
  const id = C.getValue(address, "i32");
  address += SIZE_OF_INT;
  if (id === 0) return null;
  const index = C.getValue(address, "i32");
  address += SIZE_OF_INT;
  const row = C.getValue(address, "i32");
  address += SIZE_OF_INT;
  const column = C.getValue(address, "i32");
  address += SIZE_OF_INT;
  const other = C.getValue(address, "i32");
  const result = new Node(INTERNAL, {
    id,
    tree,
    startIndex: index,
    startPosition: { row, column },
    other
  });
  return result;
}
function marshalTreeCursor(cursor, address = TRANSFER_BUFFER) {
  C.setValue(address + 0 * SIZE_OF_INT, cursor[0], "i32");
  C.setValue(address + 1 * SIZE_OF_INT, cursor[1], "i32");
  C.setValue(address + 2 * SIZE_OF_INT, cursor[2], "i32");
  C.setValue(address + 3 * SIZE_OF_INT, cursor[3], "i32");
}
function unmarshalTreeCursor(cursor) {
  cursor[0] = C.getValue(TRANSFER_BUFFER + 0 * SIZE_OF_INT, "i32");
  cursor[1] = C.getValue(TRANSFER_BUFFER + 1 * SIZE_OF_INT, "i32");
  cursor[2] = C.getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, "i32");
  cursor[3] = C.getValue(TRANSFER_BUFFER + 3 * SIZE_OF_INT, "i32");
}
function marshalPoint(address, point) {
  C.setValue(address, point.row, "i32");
  C.setValue(address + SIZE_OF_INT, point.column, "i32");
}
function unmarshalPoint(address) {
  const result = {
    row: C.getValue(address, "i32") >>> 0,
    column: C.getValue(address + SIZE_OF_INT, "i32") >>> 0
  };
  return result;
}
function marshalRange(address, range) {
  marshalPoint(address, range.startPosition);
  address += SIZE_OF_POINT;
  marshalPoint(address, range.endPosition);
  address += SIZE_OF_POINT;
  C.setValue(address, range.startIndex, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, range.endIndex, "i32");
  address += SIZE_OF_INT;
}
function unmarshalRange(address) {
  const result = {};
  result.startPosition = unmarshalPoint(address);
  address += SIZE_OF_POINT;
  result.endPosition = unmarshalPoint(address);
  address += SIZE_OF_POINT;
  result.startIndex = C.getValue(address, "i32") >>> 0;
  address += SIZE_OF_INT;
  result.endIndex = C.getValue(address, "i32") >>> 0;
  return result;
}
function marshalEdit(edit, address = TRANSFER_BUFFER) {
  marshalPoint(address, edit.startPosition);
  address += SIZE_OF_POINT;
  marshalPoint(address, edit.oldEndPosition);
  address += SIZE_OF_POINT;
  marshalPoint(address, edit.newEndPosition);
  address += SIZE_OF_POINT;
  C.setValue(address, edit.startIndex, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, edit.oldEndIndex, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, edit.newEndIndex, "i32");
  address += SIZE_OF_INT;
}
function unmarshalLanguageMetadata(address) {
  const major_version = C.getValue(address, "i32");
  const minor_version = C.getValue(address += SIZE_OF_INT, "i32");
  const patch_version = C.getValue(address += SIZE_OF_INT, "i32");
  return { major_version, minor_version, patch_version };
}
async function Module2(moduleArg = {}) {
  var moduleRtn;
  var Module = moduleArg;
  var ENVIRONMENT_IS_WEB = typeof window == "object";
  var ENVIRONMENT_IS_WORKER = typeof WorkerGlobalScope != "undefined";
  var ENVIRONMENT_IS_NODE = typeof process == "object" && process.versions?.node && process.type != "renderer";
  if (ENVIRONMENT_IS_NODE) {
    const { createRequire } = await import("module");
    var require = createRequire(import.meta.url);
  }
  Module.currentQueryProgressCallback = null;
  Module.currentProgressCallback = null;
  Module.currentLogCallback = null;
  Module.currentParseCallback = null;
  var arguments_ = [];
  var thisProgram = "./this.program";
  var quit_ = /* @__PURE__ */ __name((status, toThrow) => {
    throw toThrow;
  }, "quit_");
  var _scriptName = import.meta.url;
  var scriptDirectory = "";
  function locateFile(path) {
    if (Module["locateFile"]) {
      return Module["locateFile"](path, scriptDirectory);
    }
    return scriptDirectory + path;
  }
  __name(locateFile, "locateFile");
  var readAsync, readBinary;
  if (ENVIRONMENT_IS_NODE) {
    var fs = require("fs");
    if (_scriptName.startsWith("file:")) {
      scriptDirectory = require("path").dirname(require("url").fileURLToPath(_scriptName)) + "/";
    }
    readBinary = /* @__PURE__ */ __name((filename) => {
      filename = isFileURI(filename) ? new URL(filename) : filename;
      var ret = fs.readFileSync(filename);
      return ret;
    }, "readBinary");
    readAsync = /* @__PURE__ */ __name(async (filename, binary2 = true) => {
      filename = isFileURI(filename) ? new URL(filename) : filename;
      var ret = fs.readFileSync(filename, binary2 ? void 0 : "utf8");
      return ret;
    }, "readAsync");
    if (process.argv.length > 1) {
      thisProgram = process.argv[1].replace(/\\/g, "/");
    }
    arguments_ = process.argv.slice(2);
    quit_ = /* @__PURE__ */ __name((status, toThrow) => {
      process.exitCode = status;
      throw toThrow;
    }, "quit_");
  } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
    try {
      scriptDirectory = new URL(".", _scriptName).href;
    } catch {
    }
    {
      if (ENVIRONMENT_IS_WORKER) {
        readBinary = /* @__PURE__ */ __name((url) => {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", url, false);
          xhr.responseType = "arraybuffer";
          xhr.send(null);
          return new Uint8Array(
            /** @type{!ArrayBuffer} */
            xhr.response
          );
        }, "readBinary");
      }
      readAsync = /* @__PURE__ */ __name(async (url) => {
        if (isFileURI(url)) {
          return new Promise((resolve32, reject) => {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.responseType = "arraybuffer";
            xhr.onload = () => {
              if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                resolve32(xhr.response);
                return;
              }
              reject(xhr.status);
            };
            xhr.onerror = reject;
            xhr.send(null);
          });
        }
        var response = await fetch(url, {
          credentials: "same-origin"
        });
        if (response.ok) {
          return response.arrayBuffer();
        }
        throw new Error(response.status + " : " + response.url);
      }, "readAsync");
    }
  } else {
  }
  var out = console.log.bind(console);
  var err = console.error.bind(console);
  var dynamicLibraries = [];
  var wasmBinary;
  var ABORT = false;
  var EXITSTATUS;
  var isFileURI = /* @__PURE__ */ __name((filename) => filename.startsWith("file://"), "isFileURI");
  var readyPromiseResolve, readyPromiseReject;
  var wasmMemory;
  var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
  var HEAP64, HEAPU64;
  var HEAP_DATA_VIEW;
  var runtimeInitialized = false;
  function updateMemoryViews() {
    var b = wasmMemory.buffer;
    Module["HEAP8"] = HEAP8 = new Int8Array(b);
    Module["HEAP16"] = HEAP16 = new Int16Array(b);
    Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
    Module["HEAPU16"] = HEAPU16 = new Uint16Array(b);
    Module["HEAP32"] = HEAP32 = new Int32Array(b);
    Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
    Module["HEAPF32"] = HEAPF32 = new Float32Array(b);
    Module["HEAPF64"] = HEAPF64 = new Float64Array(b);
    Module["HEAP64"] = HEAP64 = new BigInt64Array(b);
    Module["HEAPU64"] = HEAPU64 = new BigUint64Array(b);
    Module["HEAP_DATA_VIEW"] = HEAP_DATA_VIEW = new DataView(b);
    LE_HEAP_UPDATE();
  }
  __name(updateMemoryViews, "updateMemoryViews");
  function initMemory() {
    if (Module["wasmMemory"]) {
      wasmMemory = Module["wasmMemory"];
    } else {
      var INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 33554432;
      wasmMemory = new WebAssembly.Memory({
        "initial": INITIAL_MEMORY / 65536,
        // In theory we should not need to emit the maximum if we want "unlimited"
        // or 4GB of memory, but VMs error on that atm, see
        // https://github.com/emscripten-core/emscripten/issues/14130
        // And in the pthreads case we definitely need to emit a maximum. So
        // always emit one.
        "maximum": 32768
      });
    }
    updateMemoryViews();
  }
  __name(initMemory, "initMemory");
  var __RELOC_FUNCS__ = [];
  function preRun() {
    if (Module["preRun"]) {
      if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
      while (Module["preRun"].length) {
        addOnPreRun(Module["preRun"].shift());
      }
    }
    callRuntimeCallbacks(onPreRuns);
  }
  __name(preRun, "preRun");
  function initRuntime() {
    runtimeInitialized = true;
    callRuntimeCallbacks(__RELOC_FUNCS__);
    wasmExports["__wasm_call_ctors"]();
    callRuntimeCallbacks(onPostCtors);
  }
  __name(initRuntime, "initRuntime");
  function preMain() {
  }
  __name(preMain, "preMain");
  function postRun() {
    if (Module["postRun"]) {
      if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
      while (Module["postRun"].length) {
        addOnPostRun(Module["postRun"].shift());
      }
    }
    callRuntimeCallbacks(onPostRuns);
  }
  __name(postRun, "postRun");
  function abort(what) {
    Module["onAbort"]?.(what);
    what = "Aborted(" + what + ")";
    err(what);
    ABORT = true;
    what += ". Build with -sASSERTIONS for more info.";
    var e = new WebAssembly.RuntimeError(what);
    readyPromiseReject?.(e);
    throw e;
  }
  __name(abort, "abort");
  var wasmBinaryFile;
  function findWasmBinary() {
    if (Module["locateFile"]) {
      return locateFile("web-tree-sitter.wasm");
    }
    return new URL("web-tree-sitter.wasm", import.meta.url).href;
  }
  __name(findWasmBinary, "findWasmBinary");
  function getBinarySync(file) {
    if (file == wasmBinaryFile && wasmBinary) {
      return new Uint8Array(wasmBinary);
    }
    if (readBinary) {
      return readBinary(file);
    }
    throw "both async and sync fetching of the wasm failed";
  }
  __name(getBinarySync, "getBinarySync");
  async function getWasmBinary(binaryFile) {
    if (!wasmBinary) {
      try {
        var response = await readAsync(binaryFile);
        return new Uint8Array(response);
      } catch {
      }
    }
    return getBinarySync(binaryFile);
  }
  __name(getWasmBinary, "getWasmBinary");
  async function instantiateArrayBuffer(binaryFile, imports) {
    try {
      var binary2 = await getWasmBinary(binaryFile);
      var instance2 = await WebAssembly.instantiate(binary2, imports);
      return instance2;
    } catch (reason) {
      err(`failed to asynchronously prepare wasm: ${reason}`);
      abort(reason);
    }
  }
  __name(instantiateArrayBuffer, "instantiateArrayBuffer");
  async function instantiateAsync(binary2, binaryFile, imports) {
    if (!binary2 && !isFileURI(binaryFile) && !ENVIRONMENT_IS_NODE) {
      try {
        var response = fetch(binaryFile, {
          credentials: "same-origin"
        });
        var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
        return instantiationResult;
      } catch (reason) {
        err(`wasm streaming compile failed: ${reason}`);
        err("falling back to ArrayBuffer instantiation");
      }
    }
    return instantiateArrayBuffer(binaryFile, imports);
  }
  __name(instantiateAsync, "instantiateAsync");
  function getWasmImports() {
    return {
      "env": wasmImports,
      "wasi_snapshot_preview1": wasmImports,
      "GOT.mem": new Proxy(wasmImports, GOTHandler),
      "GOT.func": new Proxy(wasmImports, GOTHandler)
    };
  }
  __name(getWasmImports, "getWasmImports");
  async function createWasm() {
    function receiveInstance(instance2, module2) {
      wasmExports = instance2.exports;
      wasmExports = relocateExports(wasmExports, 1024);
      var metadata2 = getDylinkMetadata(module2);
      if (metadata2.neededDynlibs) {
        dynamicLibraries = metadata2.neededDynlibs.concat(dynamicLibraries);
      }
      mergeLibSymbols(wasmExports, "main");
      LDSO.init();
      loadDylibs();
      __RELOC_FUNCS__.push(wasmExports["__wasm_apply_data_relocs"]);
      assignWasmExports(wasmExports);
      return wasmExports;
    }
    __name(receiveInstance, "receiveInstance");
    function receiveInstantiationResult(result2) {
      return receiveInstance(result2["instance"], result2["module"]);
    }
    __name(receiveInstantiationResult, "receiveInstantiationResult");
    var info2 = getWasmImports();
    if (Module["instantiateWasm"]) {
      return new Promise((resolve32, reject) => {
        Module["instantiateWasm"](info2, (mod, inst) => {
          resolve32(receiveInstance(mod, inst));
        });
      });
    }
    wasmBinaryFile ??= findWasmBinary();
    var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info2);
    var exports = receiveInstantiationResult(result);
    return exports;
  }
  __name(createWasm, "createWasm");
  class ExitStatus {
    static {
      __name(this, "ExitStatus");
    }
    name = "ExitStatus";
    constructor(status) {
      this.message = `Program terminated with exit(${status})`;
      this.status = status;
    }
  }
  var GOT = {};
  var currentModuleWeakSymbols = /* @__PURE__ */ new Set([]);
  var GOTHandler = {
    get(obj, symName) {
      var rtn = GOT[symName];
      if (!rtn) {
        rtn = GOT[symName] = new WebAssembly.Global({
          "value": "i32",
          "mutable": true
        });
      }
      if (!currentModuleWeakSymbols.has(symName)) {
        rtn.required = true;
      }
      return rtn;
    }
  };
  var LE_ATOMICS_NATIVE_BYTE_ORDER = [];
  var LE_HEAP_LOAD_F32 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getFloat32(byteOffset, true), "LE_HEAP_LOAD_F32");
  var LE_HEAP_LOAD_F64 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getFloat64(byteOffset, true), "LE_HEAP_LOAD_F64");
  var LE_HEAP_LOAD_I16 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getInt16(byteOffset, true), "LE_HEAP_LOAD_I16");
  var LE_HEAP_LOAD_I32 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getInt32(byteOffset, true), "LE_HEAP_LOAD_I32");
  var LE_HEAP_LOAD_I64 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getBigInt64(byteOffset, true), "LE_HEAP_LOAD_I64");
  var LE_HEAP_LOAD_U32 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getUint32(byteOffset, true), "LE_HEAP_LOAD_U32");
  var LE_HEAP_STORE_F32 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setFloat32(byteOffset, value, true), "LE_HEAP_STORE_F32");
  var LE_HEAP_STORE_F64 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setFloat64(byteOffset, value, true), "LE_HEAP_STORE_F64");
  var LE_HEAP_STORE_I16 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setInt16(byteOffset, value, true), "LE_HEAP_STORE_I16");
  var LE_HEAP_STORE_I32 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setInt32(byteOffset, value, true), "LE_HEAP_STORE_I32");
  var LE_HEAP_STORE_I64 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setBigInt64(byteOffset, value, true), "LE_HEAP_STORE_I64");
  var LE_HEAP_STORE_U32 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setUint32(byteOffset, value, true), "LE_HEAP_STORE_U32");
  var callRuntimeCallbacks = /* @__PURE__ */ __name((callbacks) => {
    while (callbacks.length > 0) {
      callbacks.shift()(Module);
    }
  }, "callRuntimeCallbacks");
  var onPostRuns = [];
  var addOnPostRun = /* @__PURE__ */ __name((cb) => onPostRuns.push(cb), "addOnPostRun");
  var onPreRuns = [];
  var addOnPreRun = /* @__PURE__ */ __name((cb) => onPreRuns.push(cb), "addOnPreRun");
  var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder() : void 0;
  var findStringEnd = /* @__PURE__ */ __name((heapOrArray, idx, maxBytesToRead, ignoreNul) => {
    var maxIdx = idx + maxBytesToRead;
    if (ignoreNul) return maxIdx;
    while (heapOrArray[idx] && !(idx >= maxIdx)) ++idx;
    return idx;
  }, "findStringEnd");
  var UTF8ArrayToString = /* @__PURE__ */ __name((heapOrArray, idx = 0, maxBytesToRead, ignoreNul) => {
    var endPtr = findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul);
    if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
      return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
    }
    var str2 = "";
    while (idx < endPtr) {
      var u0 = heapOrArray[idx++];
      if (!(u0 & 128)) {
        str2 += String.fromCharCode(u0);
        continue;
      }
      var u1 = heapOrArray[idx++] & 63;
      if ((u0 & 224) == 192) {
        str2 += String.fromCharCode((u0 & 31) << 6 | u1);
        continue;
      }
      var u2 = heapOrArray[idx++] & 63;
      if ((u0 & 240) == 224) {
        u0 = (u0 & 15) << 12 | u1 << 6 | u2;
      } else {
        u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63;
      }
      if (u0 < 65536) {
        str2 += String.fromCharCode(u0);
      } else {
        var ch = u0 - 65536;
        str2 += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
      }
    }
    return str2;
  }, "UTF8ArrayToString");
  var getDylinkMetadata = /* @__PURE__ */ __name((binary2) => {
    var offset = 0;
    var end = 0;
    function getU8() {
      return binary2[offset++];
    }
    __name(getU8, "getU8");
    function getLEB() {
      var ret = 0;
      var mul = 1;
      while (1) {
        var byte = binary2[offset++];
        ret += (byte & 127) * mul;
        mul *= 128;
        if (!(byte & 128)) break;
      }
      return ret;
    }
    __name(getLEB, "getLEB");
    function getString() {
      var len = getLEB();
      offset += len;
      return UTF8ArrayToString(binary2, offset - len, len);
    }
    __name(getString, "getString");
    function getStringList() {
      var count2 = getLEB();
      var rtn = [];
      while (count2--) rtn.push(getString());
      return rtn;
    }
    __name(getStringList, "getStringList");
    function failIf(condition, message) {
      if (condition) throw new Error(message);
    }
    __name(failIf, "failIf");
    if (binary2 instanceof WebAssembly.Module) {
      var dylinkSection = WebAssembly.Module.customSections(binary2, "dylink.0");
      failIf(dylinkSection.length === 0, "need dylink section");
      binary2 = new Uint8Array(dylinkSection[0]);
      end = binary2.length;
    } else {
      var int32View = new Uint32Array(new Uint8Array(binary2.subarray(0, 24)).buffer);
      var magicNumberFound = int32View[0] == 1836278016 || int32View[0] == 6386541;
      failIf(!magicNumberFound, "need to see wasm magic number");
      failIf(binary2[8] !== 0, "need the dylink section to be first");
      offset = 9;
      var section_size = getLEB();
      end = offset + section_size;
      var name2 = getString();
      failIf(name2 !== "dylink.0");
    }
    var customSection = {
      neededDynlibs: [],
      tlsExports: /* @__PURE__ */ new Set(),
      weakImports: /* @__PURE__ */ new Set(),
      runtimePaths: []
    };
    var WASM_DYLINK_MEM_INFO = 1;
    var WASM_DYLINK_NEEDED = 2;
    var WASM_DYLINK_EXPORT_INFO = 3;
    var WASM_DYLINK_IMPORT_INFO = 4;
    var WASM_DYLINK_RUNTIME_PATH = 5;
    var WASM_SYMBOL_TLS = 256;
    var WASM_SYMBOL_BINDING_MASK = 3;
    var WASM_SYMBOL_BINDING_WEAK = 1;
    while (offset < end) {
      var subsectionType = getU8();
      var subsectionSize = getLEB();
      if (subsectionType === WASM_DYLINK_MEM_INFO) {
        customSection.memorySize = getLEB();
        customSection.memoryAlign = getLEB();
        customSection.tableSize = getLEB();
        customSection.tableAlign = getLEB();
      } else if (subsectionType === WASM_DYLINK_NEEDED) {
        customSection.neededDynlibs = getStringList();
      } else if (subsectionType === WASM_DYLINK_EXPORT_INFO) {
        var count = getLEB();
        while (count--) {
          var symname = getString();
          var flags2 = getLEB();
          if (flags2 & WASM_SYMBOL_TLS) {
            customSection.tlsExports.add(symname);
          }
        }
      } else if (subsectionType === WASM_DYLINK_IMPORT_INFO) {
        var count = getLEB();
        while (count--) {
          var modname = getString();
          var symname = getString();
          var flags2 = getLEB();
          if ((flags2 & WASM_SYMBOL_BINDING_MASK) == WASM_SYMBOL_BINDING_WEAK) {
            customSection.weakImports.add(symname);
          }
        }
      } else if (subsectionType === WASM_DYLINK_RUNTIME_PATH) {
        customSection.runtimePaths = getStringList();
      } else {
        offset += subsectionSize;
      }
    }
    return customSection;
  }, "getDylinkMetadata");
  function getValue(ptr, type = "i8") {
    if (type.endsWith("*")) type = "*";
    switch (type) {
      case "i1":
        return HEAP8[ptr];
      case "i8":
        return HEAP8[ptr];
      case "i16":
        return LE_HEAP_LOAD_I16((ptr >> 1) * 2);
      case "i32":
        return LE_HEAP_LOAD_I32((ptr >> 2) * 4);
      case "i64":
        return LE_HEAP_LOAD_I64((ptr >> 3) * 8);
      case "float":
        return LE_HEAP_LOAD_F32((ptr >> 2) * 4);
      case "double":
        return LE_HEAP_LOAD_F64((ptr >> 3) * 8);
      case "*":
        return LE_HEAP_LOAD_U32((ptr >> 2) * 4);
      default:
        abort(`invalid type for getValue: ${type}`);
    }
  }
  __name(getValue, "getValue");
  var newDSO = /* @__PURE__ */ __name((name2, handle2, syms) => {
    var dso = {
      refcount: Infinity,
      name: name2,
      exports: syms,
      global: true
    };
    LDSO.loadedLibsByName[name2] = dso;
    if (handle2 != void 0) {
      LDSO.loadedLibsByHandle[handle2] = dso;
    }
    return dso;
  }, "newDSO");
  var LDSO = {
    loadedLibsByName: {},
    loadedLibsByHandle: {},
    init() {
      newDSO("__main__", 0, wasmImports);
    }
  };
  var ___heap_base = 78240;
  var alignMemory = /* @__PURE__ */ __name((size, alignment) => Math.ceil(size / alignment) * alignment, "alignMemory");
  var getMemory = /* @__PURE__ */ __name((size) => {
    if (runtimeInitialized) {
      return _calloc(size, 1);
    }
    var ret = ___heap_base;
    var end = ret + alignMemory(size, 16);
    ___heap_base = end;
    GOT["__heap_base"].value = end;
    return ret;
  }, "getMemory");
  var isInternalSym = /* @__PURE__ */ __name((symName) => ["__cpp_exception", "__c_longjmp", "__wasm_apply_data_relocs", "__dso_handle", "__tls_size", "__tls_align", "__set_stack_limits", "_emscripten_tls_init", "__wasm_init_tls", "__wasm_call_ctors", "__start_em_asm", "__stop_em_asm", "__start_em_js", "__stop_em_js"].includes(symName) || symName.startsWith("__em_js__"), "isInternalSym");
  var uleb128EncodeWithLen = /* @__PURE__ */ __name((arr) => {
    const n = arr.length;
    return [n % 128 | 128, n >> 7, ...arr];
  }, "uleb128EncodeWithLen");
  var wasmTypeCodes = {
    "i": 127,
    // i32
    "p": 127,
    // i32
    "j": 126,
    // i64
    "f": 125,
    // f32
    "d": 124,
    // f64
    "e": 111
  };
  var generateTypePack = /* @__PURE__ */ __name((types) => uleb128EncodeWithLen(Array.from(types, (type) => {
    var code = wasmTypeCodes[type];
    return code;
  })), "generateTypePack");
  var convertJsFunctionToWasm = /* @__PURE__ */ __name((func2, sig) => {
    var bytes = Uint8Array.of(
      0,
      97,
      115,
      109,
      // magic ("\0asm")
      1,
      0,
      0,
      0,
      // version: 1
      1,
      ...uleb128EncodeWithLen([
        1,
        // count: 1
        96,
        // param types
        ...generateTypePack(sig.slice(1)),
        // return types (for now only supporting [] if `void` and single [T] otherwise)
        ...generateTypePack(sig[0] === "v" ? "" : sig[0])
      ]),
      // The rest of the module is static
      2,
      7,
      // import section
      // (import "e" "f" (func 0 (type 0)))
      1,
      1,
      101,
      1,
      102,
      0,
      0,
      7,
      5,
      // export section
      // (export "f" (func 0 (type 0)))
      1,
      1,
      102,
      0,
      0
    );
    var module2 = new WebAssembly.Module(bytes);
    var instance2 = new WebAssembly.Instance(module2, {
      "e": {
        "f": func2
      }
    });
    var wrappedFunc = instance2.exports["f"];
    return wrappedFunc;
  }, "convertJsFunctionToWasm");
  var wasmTableMirror = [];
  var wasmTable = new WebAssembly.Table({
    "initial": 31,
    "element": "anyfunc"
  });
  var getWasmTableEntry = /* @__PURE__ */ __name((funcPtr) => {
    var func2 = wasmTableMirror[funcPtr];
    if (!func2) {
      wasmTableMirror[funcPtr] = func2 = wasmTable.get(funcPtr);
    }
    return func2;
  }, "getWasmTableEntry");
  var updateTableMap = /* @__PURE__ */ __name((offset, count) => {
    if (functionsInTableMap) {
      for (var i2 = offset; i2 < offset + count; i2++) {
        var item = getWasmTableEntry(i2);
        if (item) {
          functionsInTableMap.set(item, i2);
        }
      }
    }
  }, "updateTableMap");
  var functionsInTableMap;
  var getFunctionAddress = /* @__PURE__ */ __name((func2) => {
    if (!functionsInTableMap) {
      functionsInTableMap = /* @__PURE__ */ new WeakMap();
      updateTableMap(0, wasmTable.length);
    }
    return functionsInTableMap.get(func2) || 0;
  }, "getFunctionAddress");
  var freeTableIndexes = [];
  var getEmptyTableSlot = /* @__PURE__ */ __name(() => {
    if (freeTableIndexes.length) {
      return freeTableIndexes.pop();
    }
    return wasmTable["grow"](1);
  }, "getEmptyTableSlot");
  var setWasmTableEntry = /* @__PURE__ */ __name((idx, func2) => {
    wasmTable.set(idx, func2);
    wasmTableMirror[idx] = wasmTable.get(idx);
  }, "setWasmTableEntry");
  var addFunction = /* @__PURE__ */ __name((func2, sig) => {
    var rtn = getFunctionAddress(func2);
    if (rtn) {
      return rtn;
    }
    var ret = getEmptyTableSlot();
    try {
      setWasmTableEntry(ret, func2);
    } catch (err2) {
      if (!(err2 instanceof TypeError)) {
        throw err2;
      }
      var wrapped = convertJsFunctionToWasm(func2, sig);
      setWasmTableEntry(ret, wrapped);
    }
    functionsInTableMap.set(func2, ret);
    return ret;
  }, "addFunction");
  var updateGOT = /* @__PURE__ */ __name((exports, replace) => {
    for (var symName in exports) {
      if (isInternalSym(symName)) {
        continue;
      }
      var value = exports[symName];
      GOT[symName] ||= new WebAssembly.Global({
        "value": "i32",
        "mutable": true
      });
      if (replace || GOT[symName].value == 0) {
        if (typeof value == "function") {
          GOT[symName].value = addFunction(value);
        } else if (typeof value == "number") {
          GOT[symName].value = value;
        } else {
          err(`unhandled export type for '${symName}': ${typeof value}`);
        }
      }
    }
  }, "updateGOT");
  var relocateExports = /* @__PURE__ */ __name((exports, memoryBase2, replace) => {
    var relocated = {};
    for (var e in exports) {
      var value = exports[e];
      if (typeof value == "object") {
        value = value.value;
      }
      if (typeof value == "number") {
        value += memoryBase2;
      }
      relocated[e] = value;
    }
    updateGOT(relocated, replace);
    return relocated;
  }, "relocateExports");
  var isSymbolDefined = /* @__PURE__ */ __name((symName) => {
    var existing = wasmImports[symName];
    if (!existing || existing.stub) {
      return false;
    }
    return true;
  }, "isSymbolDefined");
  var dynCall = /* @__PURE__ */ __name((sig, ptr, args2 = [], promising = false) => {
    var func2 = getWasmTableEntry(ptr);
    var rtn = func2(...args2);
    function convert(rtn2) {
      return rtn2;
    }
    __name(convert, "convert");
    return convert(rtn);
  }, "dynCall");
  var stackSave = /* @__PURE__ */ __name(() => _emscripten_stack_get_current(), "stackSave");
  var stackRestore = /* @__PURE__ */ __name((val) => __emscripten_stack_restore(val), "stackRestore");
  var createInvokeFunction = /* @__PURE__ */ __name((sig) => (ptr, ...args2) => {
    var sp = stackSave();
    try {
      return dynCall(sig, ptr, args2);
    } catch (e) {
      stackRestore(sp);
      if (e !== e + 0) throw e;
      _setThrew(1, 0);
      if (sig[0] == "j") return 0n;
    }
  }, "createInvokeFunction");
  var resolveGlobalSymbol = /* @__PURE__ */ __name((symName, direct = false) => {
    var sym;
    if (isSymbolDefined(symName)) {
      sym = wasmImports[symName];
    } else if (symName.startsWith("invoke_")) {
      sym = wasmImports[symName] = createInvokeFunction(symName.split("_")[1]);
    }
    return {
      sym,
      name: symName
    };
  }, "resolveGlobalSymbol");
  var onPostCtors = [];
  var addOnPostCtor = /* @__PURE__ */ __name((cb) => onPostCtors.push(cb), "addOnPostCtor");
  var UTF8ToString = /* @__PURE__ */ __name((ptr, maxBytesToRead, ignoreNul) => ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead, ignoreNul) : "", "UTF8ToString");
  var loadWebAssemblyModule = /* @__PURE__ */ __name((binary, flags, libName, localScope, handle) => {
    var metadata = getDylinkMetadata(binary);
    function loadModule() {
      var memAlign = Math.pow(2, metadata.memoryAlign);
      var memoryBase = metadata.memorySize ? alignMemory(getMemory(metadata.memorySize + memAlign), memAlign) : 0;
      var tableBase = metadata.tableSize ? wasmTable.length : 0;
      if (handle) {
        HEAP8[handle + 8] = 1;
        LE_HEAP_STORE_U32((handle + 12 >> 2) * 4, memoryBase);
        LE_HEAP_STORE_I32((handle + 16 >> 2) * 4, metadata.memorySize);
        LE_HEAP_STORE_U32((handle + 20 >> 2) * 4, tableBase);
        LE_HEAP_STORE_I32((handle + 24 >> 2) * 4, metadata.tableSize);
      }
      if (metadata.tableSize) {
        wasmTable.grow(metadata.tableSize);
      }
      var moduleExports;
      function resolveSymbol(sym) {
        var resolved = resolveGlobalSymbol(sym).sym;
        if (!resolved && localScope) {
          resolved = localScope[sym];
        }
        if (!resolved) {
          resolved = moduleExports[sym];
        }
        return resolved;
      }
      __name(resolveSymbol, "resolveSymbol");
      var proxyHandler = {
        get(stubs, prop) {
          switch (prop) {
            case "__memory_base":
              return memoryBase;
            case "__table_base":
              return tableBase;
          }
          if (prop in wasmImports && !wasmImports[prop].stub) {
            var res = wasmImports[prop];
            return res;
          }
          if (!(prop in stubs)) {
            var resolved;
            stubs[prop] = (...args2) => {
              resolved ||= resolveSymbol(prop);
              return resolved(...args2);
            };
          }
          return stubs[prop];
        }
      };
      var proxy = new Proxy({}, proxyHandler);
      currentModuleWeakSymbols = metadata.weakImports;
      var info = {
        "GOT.mem": new Proxy({}, GOTHandler),
        "GOT.func": new Proxy({}, GOTHandler),
        "env": proxy,
        "wasi_snapshot_preview1": proxy
      };
      function postInstantiation(module, instance) {
        updateTableMap(tableBase, metadata.tableSize);
        moduleExports = relocateExports(instance.exports, memoryBase);
        if (!flags.allowUndefined) {
          reportUndefinedSymbols();
        }
        function addEmAsm(addr, body) {
          var args = [];
          var arity = 0;
          for (; arity < 16; arity++) {
            if (body.indexOf("$" + arity) != -1) {
              args.push("$" + arity);
            } else {
              break;
            }
          }
          args = args.join(",");
          var func = `(${args}) => { ${body} };`;
          ASM_CONSTS[start] = eval(func);
        }
        __name(addEmAsm, "addEmAsm");
        if ("__start_em_asm" in moduleExports) {
          var start = moduleExports["__start_em_asm"];
          var stop = moduleExports["__stop_em_asm"];
          while (start < stop) {
            var jsString = UTF8ToString(start);
            addEmAsm(start, jsString);
            start = HEAPU8.indexOf(0, start) + 1;
          }
        }
        function addEmJs(name, cSig, body) {
          var jsArgs = [];
          cSig = cSig.slice(1, -1);
          if (cSig != "void") {
            cSig = cSig.split(",");
            for (var i in cSig) {
              var jsArg = cSig[i].split(" ").pop();
              jsArgs.push(jsArg.replace("*", ""));
            }
          }
          var func = `(${jsArgs}) => ${body};`;
          moduleExports[name] = eval(func);
        }
        __name(addEmJs, "addEmJs");
        for (var name in moduleExports) {
          if (name.startsWith("__em_js__")) {
            var start = moduleExports[name];
            var jsString = UTF8ToString(start);
            var parts = jsString.split("<::>");
            addEmJs(name.replace("__em_js__", ""), parts[0], parts[1]);
            delete moduleExports[name];
          }
        }
        var applyRelocs = moduleExports["__wasm_apply_data_relocs"];
        if (applyRelocs) {
          if (runtimeInitialized) {
            applyRelocs();
          } else {
            __RELOC_FUNCS__.push(applyRelocs);
          }
        }
        var init = moduleExports["__wasm_call_ctors"];
        if (init) {
          if (runtimeInitialized) {
            init();
          } else {
            addOnPostCtor(init);
          }
        }
        return moduleExports;
      }
      __name(postInstantiation, "postInstantiation");
      if (flags.loadAsync) {
        return (async () => {
          var instance2;
          if (binary instanceof WebAssembly.Module) {
            instance2 = new WebAssembly.Instance(binary, info);
          } else {
            ({ module: binary, instance: instance2 } = await WebAssembly.instantiate(binary, info));
          }
          return postInstantiation(binary, instance2);
        })();
      }
      var module = binary instanceof WebAssembly.Module ? binary : new WebAssembly.Module(binary);
      var instance = new WebAssembly.Instance(module, info);
      return postInstantiation(module, instance);
    }
    __name(loadModule, "loadModule");
    flags = {
      ...flags,
      rpath: {
        parentLibPath: libName,
        paths: metadata.runtimePaths
      }
    };
    if (flags.loadAsync) {
      return metadata.neededDynlibs.reduce((chain, dynNeeded) => chain.then(() => loadDynamicLibrary(dynNeeded, flags, localScope)), Promise.resolve()).then(loadModule);
    }
    metadata.neededDynlibs.forEach((needed) => loadDynamicLibrary(needed, flags, localScope));
    return loadModule();
  }, "loadWebAssemblyModule");
  var mergeLibSymbols = /* @__PURE__ */ __name((exports, libName2) => {
    for (var [sym, exp] of Object.entries(exports)) {
      const setImport = /* @__PURE__ */ __name((target) => {
        if (!isSymbolDefined(target)) {
          wasmImports[target] = exp;
        }
      }, "setImport");
      setImport(sym);
      const main_alias = "__main_argc_argv";
      if (sym == "main") {
        setImport(main_alias);
      }
      if (sym == main_alias) {
        setImport("main");
      }
    }
  }, "mergeLibSymbols");
  var asyncLoad = /* @__PURE__ */ __name(async (url) => {
    var arrayBuffer = await readAsync(url);
    return new Uint8Array(arrayBuffer);
  }, "asyncLoad");
  function loadDynamicLibrary(libName2, flags2 = {
    global: true,
    nodelete: true
  }, localScope2, handle2) {
    var dso = LDSO.loadedLibsByName[libName2];
    if (dso) {
      if (!flags2.global) {
        if (localScope2) {
          Object.assign(localScope2, dso.exports);
        }
      } else if (!dso.global) {
        dso.global = true;
        mergeLibSymbols(dso.exports, libName2);
      }
      if (flags2.nodelete && dso.refcount !== Infinity) {
        dso.refcount = Infinity;
      }
      dso.refcount++;
      if (handle2) {
        LDSO.loadedLibsByHandle[handle2] = dso;
      }
      return flags2.loadAsync ? Promise.resolve(true) : true;
    }
    dso = newDSO(libName2, handle2, "loading");
    dso.refcount = flags2.nodelete ? Infinity : 1;
    dso.global = flags2.global;
    function loadLibData() {
      if (handle2) {
        var data = LE_HEAP_LOAD_U32((handle2 + 28 >> 2) * 4);
        var dataSize = LE_HEAP_LOAD_U32((handle2 + 32 >> 2) * 4);
        if (data && dataSize) {
          var libData = HEAP8.slice(data, data + dataSize);
          return flags2.loadAsync ? Promise.resolve(libData) : libData;
        }
      }
      var libFile = locateFile(libName2);
      if (flags2.loadAsync) {
        return asyncLoad(libFile);
      }
      if (!readBinary) {
        throw new Error(`${libFile}: file not found, and synchronous loading of external files is not available`);
      }
      return readBinary(libFile);
    }
    __name(loadLibData, "loadLibData");
    function getExports() {
      if (flags2.loadAsync) {
        return loadLibData().then((libData) => loadWebAssemblyModule(libData, flags2, libName2, localScope2, handle2));
      }
      return loadWebAssemblyModule(loadLibData(), flags2, libName2, localScope2, handle2);
    }
    __name(getExports, "getExports");
    function moduleLoaded(exports) {
      if (dso.global) {
        mergeLibSymbols(exports, libName2);
      } else if (localScope2) {
        Object.assign(localScope2, exports);
      }
      dso.exports = exports;
    }
    __name(moduleLoaded, "moduleLoaded");
    if (flags2.loadAsync) {
      return getExports().then((exports) => {
        moduleLoaded(exports);
        return true;
      });
    }
    moduleLoaded(getExports());
    return true;
  }
  __name(loadDynamicLibrary, "loadDynamicLibrary");
  var reportUndefinedSymbols = /* @__PURE__ */ __name(() => {
    for (var [symName, entry] of Object.entries(GOT)) {
      if (entry.value == 0) {
        var value = resolveGlobalSymbol(symName, true).sym;
        if (!value && !entry.required) {
          continue;
        }
        if (typeof value == "function") {
          entry.value = addFunction(value, value.sig);
        } else if (typeof value == "number") {
          entry.value = value;
        } else {
          throw new Error(`bad export type for '${symName}': ${typeof value}`);
        }
      }
    }
  }, "reportUndefinedSymbols");
  var runDependencies = 0;
  var dependenciesFulfilled = null;
  var removeRunDependency = /* @__PURE__ */ __name((id) => {
    runDependencies--;
    Module["monitorRunDependencies"]?.(runDependencies);
    if (runDependencies == 0) {
      if (dependenciesFulfilled) {
        var callback = dependenciesFulfilled;
        dependenciesFulfilled = null;
        callback();
      }
    }
  }, "removeRunDependency");
  var addRunDependency = /* @__PURE__ */ __name((id) => {
    runDependencies++;
    Module["monitorRunDependencies"]?.(runDependencies);
  }, "addRunDependency");
  var loadDylibs = /* @__PURE__ */ __name(async () => {
    if (!dynamicLibraries.length) {
      reportUndefinedSymbols();
      return;
    }
    addRunDependency("loadDylibs");
    for (var lib of dynamicLibraries) {
      await loadDynamicLibrary(lib, {
        loadAsync: true,
        global: true,
        nodelete: true,
        allowUndefined: true
      });
    }
    reportUndefinedSymbols();
    removeRunDependency("loadDylibs");
  }, "loadDylibs");
  var noExitRuntime = true;
  function setValue(ptr, value, type = "i8") {
    if (type.endsWith("*")) type = "*";
    switch (type) {
      case "i1":
        HEAP8[ptr] = value;
        break;
      case "i8":
        HEAP8[ptr] = value;
        break;
      case "i16":
        LE_HEAP_STORE_I16((ptr >> 1) * 2, value);
        break;
      case "i32":
        LE_HEAP_STORE_I32((ptr >> 2) * 4, value);
        break;
      case "i64":
        LE_HEAP_STORE_I64((ptr >> 3) * 8, BigInt(value));
        break;
      case "float":
        LE_HEAP_STORE_F32((ptr >> 2) * 4, value);
        break;
      case "double":
        LE_HEAP_STORE_F64((ptr >> 3) * 8, value);
        break;
      case "*":
        LE_HEAP_STORE_U32((ptr >> 2) * 4, value);
        break;
      default:
        abort(`invalid type for setValue: ${type}`);
    }
  }
  __name(setValue, "setValue");
  var ___memory_base = new WebAssembly.Global({
    "value": "i32",
    "mutable": false
  }, 1024);
  var ___stack_high = 78240;
  var ___stack_low = 12704;
  var ___stack_pointer = new WebAssembly.Global({
    "value": "i32",
    "mutable": true
  }, 78240);
  var ___table_base = new WebAssembly.Global({
    "value": "i32",
    "mutable": false
  }, 1);
  var __abort_js = /* @__PURE__ */ __name(() => abort(""), "__abort_js");
  __abort_js.sig = "v";
  var getHeapMax = /* @__PURE__ */ __name(() => (
    // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
    // full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
    // for any code that deals with heap sizes, which would require special
    // casing all heap size related code to treat 0 specially.
    2147483648
  ), "getHeapMax");
  var growMemory = /* @__PURE__ */ __name((size) => {
    var oldHeapSize = wasmMemory.buffer.byteLength;
    var pages = (size - oldHeapSize + 65535) / 65536 | 0;
    try {
      wasmMemory.grow(pages);
      updateMemoryViews();
      return 1;
    } catch (e) {
    }
  }, "growMemory");
  var _emscripten_resize_heap = /* @__PURE__ */ __name((requestedSize) => {
    var oldSize = HEAPU8.length;
    requestedSize >>>= 0;
    var maxHeapSize = getHeapMax();
    if (requestedSize > maxHeapSize) {
      return false;
    }
    for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
      var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
      overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
      var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
      var replacement = growMemory(newSize);
      if (replacement) {
        return true;
      }
    }
    return false;
  }, "_emscripten_resize_heap");
  _emscripten_resize_heap.sig = "ip";
  var _fd_close = /* @__PURE__ */ __name((fd) => 52, "_fd_close");
  _fd_close.sig = "ii";
  var INT53_MAX = 9007199254740992;
  var INT53_MIN = -9007199254740992;
  var bigintToI53Checked = /* @__PURE__ */ __name((num) => num < INT53_MIN || num > INT53_MAX ? NaN : Number(num), "bigintToI53Checked");
  function _fd_seek(fd, offset, whence, newOffset) {
    offset = bigintToI53Checked(offset);
    return 70;
  }
  __name(_fd_seek, "_fd_seek");
  _fd_seek.sig = "iijip";
  var printCharBuffers = [null, [], []];
  var printChar = /* @__PURE__ */ __name((stream, curr) => {
    var buffer = printCharBuffers[stream];
    if (curr === 0 || curr === 10) {
      (stream === 1 ? out : err)(UTF8ArrayToString(buffer));
      buffer.length = 0;
    } else {
      buffer.push(curr);
    }
  }, "printChar");
  var _fd_write = /* @__PURE__ */ __name((fd, iov, iovcnt, pnum) => {
    var num = 0;
    for (var i2 = 0; i2 < iovcnt; i2++) {
      var ptr = LE_HEAP_LOAD_U32((iov >> 2) * 4);
      var len = LE_HEAP_LOAD_U32((iov + 4 >> 2) * 4);
      iov += 8;
      for (var j = 0; j < len; j++) {
        printChar(fd, HEAPU8[ptr + j]);
      }
      num += len;
    }
    LE_HEAP_STORE_U32((pnum >> 2) * 4, num);
    return 0;
  }, "_fd_write");
  _fd_write.sig = "iippp";
  function _tree_sitter_log_callback(isLexMessage, messageAddress) {
    if (Module.currentLogCallback) {
      const message = UTF8ToString(messageAddress);
      Module.currentLogCallback(message, isLexMessage !== 0);
    }
  }
  __name(_tree_sitter_log_callback, "_tree_sitter_log_callback");
  function _tree_sitter_parse_callback(inputBufferAddress, index, row, column, lengthAddress) {
    const INPUT_BUFFER_SIZE = 10 * 1024;
    const string = Module.currentParseCallback(index, {
      row,
      column
    });
    if (typeof string === "string") {
      setValue(lengthAddress, string.length, "i32");
      stringToUTF16(string, inputBufferAddress, INPUT_BUFFER_SIZE);
    } else {
      setValue(lengthAddress, 0, "i32");
    }
  }
  __name(_tree_sitter_parse_callback, "_tree_sitter_parse_callback");
  function _tree_sitter_progress_callback(currentOffset, hasError) {
    if (Module.currentProgressCallback) {
      return Module.currentProgressCallback({
        currentOffset,
        hasError
      });
    }
    return false;
  }
  __name(_tree_sitter_progress_callback, "_tree_sitter_progress_callback");
  function _tree_sitter_query_progress_callback(currentOffset) {
    if (Module.currentQueryProgressCallback) {
      return Module.currentQueryProgressCallback({
        currentOffset
      });
    }
    return false;
  }
  __name(_tree_sitter_query_progress_callback, "_tree_sitter_query_progress_callback");
  var runtimeKeepaliveCounter = 0;
  var keepRuntimeAlive = /* @__PURE__ */ __name(() => noExitRuntime || runtimeKeepaliveCounter > 0, "keepRuntimeAlive");
  var _proc_exit = /* @__PURE__ */ __name((code) => {
    EXITSTATUS = code;
    if (!keepRuntimeAlive()) {
      Module["onExit"]?.(code);
      ABORT = true;
    }
    quit_(code, new ExitStatus(code));
  }, "_proc_exit");
  _proc_exit.sig = "vi";
  var exitJS = /* @__PURE__ */ __name((status, implicit) => {
    EXITSTATUS = status;
    _proc_exit(status);
  }, "exitJS");
  var handleException = /* @__PURE__ */ __name((e) => {
    if (e instanceof ExitStatus || e == "unwind") {
      return EXITSTATUS;
    }
    quit_(1, e);
  }, "handleException");
  var lengthBytesUTF8 = /* @__PURE__ */ __name((str2) => {
    var len = 0;
    for (var i2 = 0; i2 < str2.length; ++i2) {
      var c2 = str2.charCodeAt(i2);
      if (c2 <= 127) {
        len++;
      } else if (c2 <= 2047) {
        len += 2;
      } else if (c2 >= 55296 && c2 <= 57343) {
        len += 4;
        ++i2;
      } else {
        len += 3;
      }
    }
    return len;
  }, "lengthBytesUTF8");
  var stringToUTF8Array = /* @__PURE__ */ __name((str2, heap, outIdx, maxBytesToWrite) => {
    if (!(maxBytesToWrite > 0)) return 0;
    var startIdx = outIdx;
    var endIdx = outIdx + maxBytesToWrite - 1;
    for (var i2 = 0; i2 < str2.length; ++i2) {
      var u = str2.codePointAt(i2);
      if (u <= 127) {
        if (outIdx >= endIdx) break;
        heap[outIdx++] = u;
      } else if (u <= 2047) {
        if (outIdx + 1 >= endIdx) break;
        heap[outIdx++] = 192 | u >> 6;
        heap[outIdx++] = 128 | u & 63;
      } else if (u <= 65535) {
        if (outIdx + 2 >= endIdx) break;
        heap[outIdx++] = 224 | u >> 12;
        heap[outIdx++] = 128 | u >> 6 & 63;
        heap[outIdx++] = 128 | u & 63;
      } else {
        if (outIdx + 3 >= endIdx) break;
        heap[outIdx++] = 240 | u >> 18;
        heap[outIdx++] = 128 | u >> 12 & 63;
        heap[outIdx++] = 128 | u >> 6 & 63;
        heap[outIdx++] = 128 | u & 63;
        i2++;
      }
    }
    heap[outIdx] = 0;
    return outIdx - startIdx;
  }, "stringToUTF8Array");
  var stringToUTF8 = /* @__PURE__ */ __name((str2, outPtr, maxBytesToWrite) => stringToUTF8Array(str2, HEAPU8, outPtr, maxBytesToWrite), "stringToUTF8");
  var stackAlloc = /* @__PURE__ */ __name((sz) => __emscripten_stack_alloc(sz), "stackAlloc");
  var stringToUTF8OnStack = /* @__PURE__ */ __name((str2) => {
    var size = lengthBytesUTF8(str2) + 1;
    var ret = stackAlloc(size);
    stringToUTF8(str2, ret, size);
    return ret;
  }, "stringToUTF8OnStack");
  var AsciiToString = /* @__PURE__ */ __name((ptr) => {
    var str2 = "";
    while (1) {
      var ch = HEAPU8[ptr++];
      if (!ch) return str2;
      str2 += String.fromCharCode(ch);
    }
  }, "AsciiToString");
  var stringToUTF16 = /* @__PURE__ */ __name((str2, outPtr, maxBytesToWrite) => {
    maxBytesToWrite ??= 2147483647;
    if (maxBytesToWrite < 2) return 0;
    maxBytesToWrite -= 2;
    var startPtr = outPtr;
    var numCharsToWrite = maxBytesToWrite < str2.length * 2 ? maxBytesToWrite / 2 : str2.length;
    for (var i2 = 0; i2 < numCharsToWrite; ++i2) {
      var codeUnit = str2.charCodeAt(i2);
      LE_HEAP_STORE_I16((outPtr >> 1) * 2, codeUnit);
      outPtr += 2;
    }
    LE_HEAP_STORE_I16((outPtr >> 1) * 2, 0);
    return outPtr - startPtr;
  }, "stringToUTF16");
  LE_ATOMICS_NATIVE_BYTE_ORDER = new Int8Array(new Int16Array([1]).buffer)[0] === 1 ? [
    /* little endian */
    ((x) => x),
    ((x) => x),
    void 0,
    ((x) => x)
  ] : [
    /* big endian */
    ((x) => x),
    ((x) => ((x & 65280) << 8 | (x & 255) << 24) >> 16),
    void 0,
    ((x) => x >> 24 & 255 | x >> 8 & 65280 | (x & 65280) << 8 | (x & 255) << 24)
  ];
  function LE_HEAP_UPDATE() {
    HEAPU16.unsigned = ((x) => x & 65535);
    HEAPU32.unsigned = ((x) => x >>> 0);
  }
  __name(LE_HEAP_UPDATE, "LE_HEAP_UPDATE");
  {
    initMemory();
    if (Module["noExitRuntime"]) noExitRuntime = Module["noExitRuntime"];
    if (Module["print"]) out = Module["print"];
    if (Module["printErr"]) err = Module["printErr"];
    if (Module["dynamicLibraries"]) dynamicLibraries = Module["dynamicLibraries"];
    if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
    if (Module["arguments"]) arguments_ = Module["arguments"];
    if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
    if (Module["preInit"]) {
      if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
      while (Module["preInit"].length > 0) {
        Module["preInit"].shift()();
      }
    }
  }
  Module["setValue"] = setValue;
  Module["getValue"] = getValue;
  Module["UTF8ToString"] = UTF8ToString;
  Module["stringToUTF8"] = stringToUTF8;
  Module["lengthBytesUTF8"] = lengthBytesUTF8;
  Module["AsciiToString"] = AsciiToString;
  Module["stringToUTF16"] = stringToUTF16;
  Module["loadWebAssemblyModule"] = loadWebAssemblyModule;
  Module["LE_HEAP_STORE_I64"] = LE_HEAP_STORE_I64;
  var ASM_CONSTS = {};
  var _malloc, _calloc, _realloc, _free, _ts_range_edit, _memcmp, _ts_language_symbol_count, _ts_language_state_count, _ts_language_abi_version, _ts_language_name, _ts_language_field_count, _ts_language_next_state, _ts_language_symbol_name, _ts_language_symbol_for_name, _strncmp, _ts_language_symbol_type, _ts_language_field_name_for_id, _ts_lookahead_iterator_new, _ts_lookahead_iterator_delete, _ts_lookahead_iterator_reset_state, _ts_lookahead_iterator_reset, _ts_lookahead_iterator_next, _ts_lookahead_iterator_current_symbol, _ts_point_edit, _ts_parser_delete, _ts_parser_reset, _ts_parser_set_language, _ts_parser_set_included_ranges, _ts_query_new, _ts_query_delete, _iswspace, _iswalnum, _ts_query_pattern_count, _ts_query_capture_count, _ts_query_string_count, _ts_query_capture_name_for_id, _ts_query_capture_quantifier_for_id, _ts_query_string_value_for_id, _ts_query_predicates_for_pattern, _ts_query_start_byte_for_pattern, _ts_query_end_byte_for_pattern, _ts_query_is_pattern_rooted, _ts_query_is_pattern_non_local, _ts_query_is_pattern_guaranteed_at_step, _ts_query_disable_capture, _ts_query_disable_pattern, _ts_tree_copy, _ts_tree_delete, _ts_init, _ts_parser_new_wasm, _ts_parser_enable_logger_wasm, _ts_parser_parse_wasm, _ts_parser_included_ranges_wasm, _ts_language_type_is_named_wasm, _ts_language_type_is_visible_wasm, _ts_language_metadata_wasm, _ts_language_supertypes_wasm, _ts_language_subtypes_wasm, _ts_tree_root_node_wasm, _ts_tree_root_node_with_offset_wasm, _ts_tree_edit_wasm, _ts_tree_included_ranges_wasm, _ts_tree_get_changed_ranges_wasm, _ts_tree_cursor_new_wasm, _ts_tree_cursor_copy_wasm, _ts_tree_cursor_delete_wasm, _ts_tree_cursor_reset_wasm, _ts_tree_cursor_reset_to_wasm, _ts_tree_cursor_goto_first_child_wasm, _ts_tree_cursor_goto_last_child_wasm, _ts_tree_cursor_goto_first_child_for_index_wasm, _ts_tree_cursor_goto_first_child_for_position_wasm, _ts_tree_cursor_goto_next_sibling_wasm, _ts_tree_cursor_goto_previous_sibling_wasm, _ts_tree_cursor_goto_descendant_wasm, _ts_tree_cursor_goto_parent_wasm, _ts_tree_cursor_current_node_type_id_wasm, _ts_tree_cursor_current_node_state_id_wasm, _ts_tree_cursor_current_node_is_named_wasm, _ts_tree_cursor_current_node_is_missing_wasm, _ts_tree_cursor_current_node_id_wasm, _ts_tree_cursor_start_position_wasm, _ts_tree_cursor_end_position_wasm, _ts_tree_cursor_start_index_wasm, _ts_tree_cursor_end_index_wasm, _ts_tree_cursor_current_field_id_wasm, _ts_tree_cursor_current_depth_wasm, _ts_tree_cursor_current_descendant_index_wasm, _ts_tree_cursor_current_node_wasm, _ts_node_symbol_wasm, _ts_node_field_name_for_child_wasm, _ts_node_field_name_for_named_child_wasm, _ts_node_children_by_field_id_wasm, _ts_node_first_child_for_byte_wasm, _ts_node_first_named_child_for_byte_wasm, _ts_node_grammar_symbol_wasm, _ts_node_child_count_wasm, _ts_node_named_child_count_wasm, _ts_node_child_wasm, _ts_node_named_child_wasm, _ts_node_child_by_field_id_wasm, _ts_node_next_sibling_wasm, _ts_node_prev_sibling_wasm, _ts_node_next_named_sibling_wasm, _ts_node_prev_named_sibling_wasm, _ts_node_descendant_count_wasm, _ts_node_parent_wasm, _ts_node_child_with_descendant_wasm, _ts_node_descendant_for_index_wasm, _ts_node_named_descendant_for_index_wasm, _ts_node_descendant_for_position_wasm, _ts_node_named_descendant_for_position_wasm, _ts_node_start_point_wasm, _ts_node_end_point_wasm, _ts_node_start_index_wasm, _ts_node_end_index_wasm, _ts_node_to_string_wasm, _ts_node_children_wasm, _ts_node_named_children_wasm, _ts_node_descendants_of_type_wasm, _ts_node_is_named_wasm, _ts_node_has_changes_wasm, _ts_node_has_error_wasm, _ts_node_is_error_wasm, _ts_node_is_missing_wasm, _ts_node_is_extra_wasm, _ts_node_parse_state_wasm, _ts_node_next_parse_state_wasm, _ts_query_matches_wasm, _ts_query_captures_wasm, _memset, _memcpy, _memmove, _iswalpha, _iswblank, _iswdigit, _iswlower, _iswupper, _iswxdigit, _memchr, _strlen, _strcmp, _strncat, _strncpy, _towlower, _towupper, _setThrew, __emscripten_stack_restore, __emscripten_stack_alloc, _emscripten_stack_get_current, ___wasm_apply_data_relocs;
  function assignWasmExports(wasmExports2) {
    Module["_malloc"] = _malloc = wasmExports2["malloc"];
    Module["_calloc"] = _calloc = wasmExports2["calloc"];
    Module["_realloc"] = _realloc = wasmExports2["realloc"];
    Module["_free"] = _free = wasmExports2["free"];
    Module["_ts_range_edit"] = _ts_range_edit = wasmExports2["ts_range_edit"];
    Module["_memcmp"] = _memcmp = wasmExports2["memcmp"];
    Module["_ts_language_symbol_count"] = _ts_language_symbol_count = wasmExports2["ts_language_symbol_count"];
    Module["_ts_language_state_count"] = _ts_language_state_count = wasmExports2["ts_language_state_count"];
    Module["_ts_language_abi_version"] = _ts_language_abi_version = wasmExports2["ts_language_abi_version"];
    Module["_ts_language_name"] = _ts_language_name = wasmExports2["ts_language_name"];
    Module["_ts_language_field_count"] = _ts_language_field_count = wasmExports2["ts_language_field_count"];
    Module["_ts_language_next_state"] = _ts_language_next_state = wasmExports2["ts_language_next_state"];
    Module["_ts_language_symbol_name"] = _ts_language_symbol_name = wasmExports2["ts_language_symbol_name"];
    Module["_ts_language_symbol_for_name"] = _ts_language_symbol_for_name = wasmExports2["ts_language_symbol_for_name"];
    Module["_strncmp"] = _strncmp = wasmExports2["strncmp"];
    Module["_ts_language_symbol_type"] = _ts_language_symbol_type = wasmExports2["ts_language_symbol_type"];
    Module["_ts_language_field_name_for_id"] = _ts_language_field_name_for_id = wasmExports2["ts_language_field_name_for_id"];
    Module["_ts_lookahead_iterator_new"] = _ts_lookahead_iterator_new = wasmExports2["ts_lookahead_iterator_new"];
    Module["_ts_lookahead_iterator_delete"] = _ts_lookahead_iterator_delete = wasmExports2["ts_lookahead_iterator_delete"];
    Module["_ts_lookahead_iterator_reset_state"] = _ts_lookahead_iterator_reset_state = wasmExports2["ts_lookahead_iterator_reset_state"];
    Module["_ts_lookahead_iterator_reset"] = _ts_lookahead_iterator_reset = wasmExports2["ts_lookahead_iterator_reset"];
    Module["_ts_lookahead_iterator_next"] = _ts_lookahead_iterator_next = wasmExports2["ts_lookahead_iterator_next"];
    Module["_ts_lookahead_iterator_current_symbol"] = _ts_lookahead_iterator_current_symbol = wasmExports2["ts_lookahead_iterator_current_symbol"];
    Module["_ts_point_edit"] = _ts_point_edit = wasmExports2["ts_point_edit"];
    Module["_ts_parser_delete"] = _ts_parser_delete = wasmExports2["ts_parser_delete"];
    Module["_ts_parser_reset"] = _ts_parser_reset = wasmExports2["ts_parser_reset"];
    Module["_ts_parser_set_language"] = _ts_parser_set_language = wasmExports2["ts_parser_set_language"];
    Module["_ts_parser_set_included_ranges"] = _ts_parser_set_included_ranges = wasmExports2["ts_parser_set_included_ranges"];
    Module["_ts_query_new"] = _ts_query_new = wasmExports2["ts_query_new"];
    Module["_ts_query_delete"] = _ts_query_delete = wasmExports2["ts_query_delete"];
    Module["_iswspace"] = _iswspace = wasmExports2["iswspace"];
    Module["_iswalnum"] = _iswalnum = wasmExports2["iswalnum"];
    Module["_ts_query_pattern_count"] = _ts_query_pattern_count = wasmExports2["ts_query_pattern_count"];
    Module["_ts_query_capture_count"] = _ts_query_capture_count = wasmExports2["ts_query_capture_count"];
    Module["_ts_query_string_count"] = _ts_query_string_count = wasmExports2["ts_query_string_count"];
    Module["_ts_query_capture_name_for_id"] = _ts_query_capture_name_for_id = wasmExports2["ts_query_capture_name_for_id"];
    Module["_ts_query_capture_quantifier_for_id"] = _ts_query_capture_quantifier_for_id = wasmExports2["ts_query_capture_quantifier_for_id"];
    Module["_ts_query_string_value_for_id"] = _ts_query_string_value_for_id = wasmExports2["ts_query_string_value_for_id"];
    Module["_ts_query_predicates_for_pattern"] = _ts_query_predicates_for_pattern = wasmExports2["ts_query_predicates_for_pattern"];
    Module["_ts_query_start_byte_for_pattern"] = _ts_query_start_byte_for_pattern = wasmExports2["ts_query_start_byte_for_pattern"];
    Module["_ts_query_end_byte_for_pattern"] = _ts_query_end_byte_for_pattern = wasmExports2["ts_query_end_byte_for_pattern"];
    Module["_ts_query_is_pattern_rooted"] = _ts_query_is_pattern_rooted = wasmExports2["ts_query_is_pattern_rooted"];
    Module["_ts_query_is_pattern_non_local"] = _ts_query_is_pattern_non_local = wasmExports2["ts_query_is_pattern_non_local"];
    Module["_ts_query_is_pattern_guaranteed_at_step"] = _ts_query_is_pattern_guaranteed_at_step = wasmExports2["ts_query_is_pattern_guaranteed_at_step"];
    Module["_ts_query_disable_capture"] = _ts_query_disable_capture = wasmExports2["ts_query_disable_capture"];
    Module["_ts_query_disable_pattern"] = _ts_query_disable_pattern = wasmExports2["ts_query_disable_pattern"];
    Module["_ts_tree_copy"] = _ts_tree_copy = wasmExports2["ts_tree_copy"];
    Module["_ts_tree_delete"] = _ts_tree_delete = wasmExports2["ts_tree_delete"];
    Module["_ts_init"] = _ts_init = wasmExports2["ts_init"];
    Module["_ts_parser_new_wasm"] = _ts_parser_new_wasm = wasmExports2["ts_parser_new_wasm"];
    Module["_ts_parser_enable_logger_wasm"] = _ts_parser_enable_logger_wasm = wasmExports2["ts_parser_enable_logger_wasm"];
    Module["_ts_parser_parse_wasm"] = _ts_parser_parse_wasm = wasmExports2["ts_parser_parse_wasm"];
    Module["_ts_parser_included_ranges_wasm"] = _ts_parser_included_ranges_wasm = wasmExports2["ts_parser_included_ranges_wasm"];
    Module["_ts_language_type_is_named_wasm"] = _ts_language_type_is_named_wasm = wasmExports2["ts_language_type_is_named_wasm"];
    Module["_ts_language_type_is_visible_wasm"] = _ts_language_type_is_visible_wasm = wasmExports2["ts_language_type_is_visible_wasm"];
    Module["_ts_language_metadata_wasm"] = _ts_language_metadata_wasm = wasmExports2["ts_language_metadata_wasm"];
    Module["_ts_language_supertypes_wasm"] = _ts_language_supertypes_wasm = wasmExports2["ts_language_supertypes_wasm"];
    Module["_ts_language_subtypes_wasm"] = _ts_language_subtypes_wasm = wasmExports2["ts_language_subtypes_wasm"];
    Module["_ts_tree_root_node_wasm"] = _ts_tree_root_node_wasm = wasmExports2["ts_tree_root_node_wasm"];
    Module["_ts_tree_root_node_with_offset_wasm"] = _ts_tree_root_node_with_offset_wasm = wasmExports2["ts_tree_root_node_with_offset_wasm"];
    Module["_ts_tree_edit_wasm"] = _ts_tree_edit_wasm = wasmExports2["ts_tree_edit_wasm"];
    Module["_ts_tree_included_ranges_wasm"] = _ts_tree_included_ranges_wasm = wasmExports2["ts_tree_included_ranges_wasm"];
    Module["_ts_tree_get_changed_ranges_wasm"] = _ts_tree_get_changed_ranges_wasm = wasmExports2["ts_tree_get_changed_ranges_wasm"];
    Module["_ts_tree_cursor_new_wasm"] = _ts_tree_cursor_new_wasm = wasmExports2["ts_tree_cursor_new_wasm"];
    Module["_ts_tree_cursor_copy_wasm"] = _ts_tree_cursor_copy_wasm = wasmExports2["ts_tree_cursor_copy_wasm"];
    Module["_ts_tree_cursor_delete_wasm"] = _ts_tree_cursor_delete_wasm = wasmExports2["ts_tree_cursor_delete_wasm"];
    Module["_ts_tree_cursor_reset_wasm"] = _ts_tree_cursor_reset_wasm = wasmExports2["ts_tree_cursor_reset_wasm"];
    Module["_ts_tree_cursor_reset_to_wasm"] = _ts_tree_cursor_reset_to_wasm = wasmExports2["ts_tree_cursor_reset_to_wasm"];
    Module["_ts_tree_cursor_goto_first_child_wasm"] = _ts_tree_cursor_goto_first_child_wasm = wasmExports2["ts_tree_cursor_goto_first_child_wasm"];
    Module["_ts_tree_cursor_goto_last_child_wasm"] = _ts_tree_cursor_goto_last_child_wasm = wasmExports2["ts_tree_cursor_goto_last_child_wasm"];
    Module["_ts_tree_cursor_goto_first_child_for_index_wasm"] = _ts_tree_cursor_goto_first_child_for_index_wasm = wasmExports2["ts_tree_cursor_goto_first_child_for_index_wasm"];
    Module["_ts_tree_cursor_goto_first_child_for_position_wasm"] = _ts_tree_cursor_goto_first_child_for_position_wasm = wasmExports2["ts_tree_cursor_goto_first_child_for_position_wasm"];
    Module["_ts_tree_cursor_goto_next_sibling_wasm"] = _ts_tree_cursor_goto_next_sibling_wasm = wasmExports2["ts_tree_cursor_goto_next_sibling_wasm"];
    Module["_ts_tree_cursor_goto_previous_sibling_wasm"] = _ts_tree_cursor_goto_previous_sibling_wasm = wasmExports2["ts_tree_cursor_goto_previous_sibling_wasm"];
    Module["_ts_tree_cursor_goto_descendant_wasm"] = _ts_tree_cursor_goto_descendant_wasm = wasmExports2["ts_tree_cursor_goto_descendant_wasm"];
    Module["_ts_tree_cursor_goto_parent_wasm"] = _ts_tree_cursor_goto_parent_wasm = wasmExports2["ts_tree_cursor_goto_parent_wasm"];
    Module["_ts_tree_cursor_current_node_type_id_wasm"] = _ts_tree_cursor_current_node_type_id_wasm = wasmExports2["ts_tree_cursor_current_node_type_id_wasm"];
    Module["_ts_tree_cursor_current_node_state_id_wasm"] = _ts_tree_cursor_current_node_state_id_wasm = wasmExports2["ts_tree_cursor_current_node_state_id_wasm"];
    Module["_ts_tree_cursor_current_node_is_named_wasm"] = _ts_tree_cursor_current_node_is_named_wasm = wasmExports2["ts_tree_cursor_current_node_is_named_wasm"];
    Module["_ts_tree_cursor_current_node_is_missing_wasm"] = _ts_tree_cursor_current_node_is_missing_wasm = wasmExports2["ts_tree_cursor_current_node_is_missing_wasm"];
    Module["_ts_tree_cursor_current_node_id_wasm"] = _ts_tree_cursor_current_node_id_wasm = wasmExports2["ts_tree_cursor_current_node_id_wasm"];
    Module["_ts_tree_cursor_start_position_wasm"] = _ts_tree_cursor_start_position_wasm = wasmExports2["ts_tree_cursor_start_position_wasm"];
    Module["_ts_tree_cursor_end_position_wasm"] = _ts_tree_cursor_end_position_wasm = wasmExports2["ts_tree_cursor_end_position_wasm"];
    Module["_ts_tree_cursor_start_index_wasm"] = _ts_tree_cursor_start_index_wasm = wasmExports2["ts_tree_cursor_start_index_wasm"];
    Module["_ts_tree_cursor_end_index_wasm"] = _ts_tree_cursor_end_index_wasm = wasmExports2["ts_tree_cursor_end_index_wasm"];
    Module["_ts_tree_cursor_current_field_id_wasm"] = _ts_tree_cursor_current_field_id_wasm = wasmExports2["ts_tree_cursor_current_field_id_wasm"];
    Module["_ts_tree_cursor_current_depth_wasm"] = _ts_tree_cursor_current_depth_wasm = wasmExports2["ts_tree_cursor_current_depth_wasm"];
    Module["_ts_tree_cursor_current_descendant_index_wasm"] = _ts_tree_cursor_current_descendant_index_wasm = wasmExports2["ts_tree_cursor_current_descendant_index_wasm"];
    Module["_ts_tree_cursor_current_node_wasm"] = _ts_tree_cursor_current_node_wasm = wasmExports2["ts_tree_cursor_current_node_wasm"];
    Module["_ts_node_symbol_wasm"] = _ts_node_symbol_wasm = wasmExports2["ts_node_symbol_wasm"];
    Module["_ts_node_field_name_for_child_wasm"] = _ts_node_field_name_for_child_wasm = wasmExports2["ts_node_field_name_for_child_wasm"];
    Module["_ts_node_field_name_for_named_child_wasm"] = _ts_node_field_name_for_named_child_wasm = wasmExports2["ts_node_field_name_for_named_child_wasm"];
    Module["_ts_node_children_by_field_id_wasm"] = _ts_node_children_by_field_id_wasm = wasmExports2["ts_node_children_by_field_id_wasm"];
    Module["_ts_node_first_child_for_byte_wasm"] = _ts_node_first_child_for_byte_wasm = wasmExports2["ts_node_first_child_for_byte_wasm"];
    Module["_ts_node_first_named_child_for_byte_wasm"] = _ts_node_first_named_child_for_byte_wasm = wasmExports2["ts_node_first_named_child_for_byte_wasm"];
    Module["_ts_node_grammar_symbol_wasm"] = _ts_node_grammar_symbol_wasm = wasmExports2["ts_node_grammar_symbol_wasm"];
    Module["_ts_node_child_count_wasm"] = _ts_node_child_count_wasm = wasmExports2["ts_node_child_count_wasm"];
    Module["_ts_node_named_child_count_wasm"] = _ts_node_named_child_count_wasm = wasmExports2["ts_node_named_child_count_wasm"];
    Module["_ts_node_child_wasm"] = _ts_node_child_wasm = wasmExports2["ts_node_child_wasm"];
    Module["_ts_node_named_child_wasm"] = _ts_node_named_child_wasm = wasmExports2["ts_node_named_child_wasm"];
    Module["_ts_node_child_by_field_id_wasm"] = _ts_node_child_by_field_id_wasm = wasmExports2["ts_node_child_by_field_id_wasm"];
    Module["_ts_node_next_sibling_wasm"] = _ts_node_next_sibling_wasm = wasmExports2["ts_node_next_sibling_wasm"];
    Module["_ts_node_prev_sibling_wasm"] = _ts_node_prev_sibling_wasm = wasmExports2["ts_node_prev_sibling_wasm"];
    Module["_ts_node_next_named_sibling_wasm"] = _ts_node_next_named_sibling_wasm = wasmExports2["ts_node_next_named_sibling_wasm"];
    Module["_ts_node_prev_named_sibling_wasm"] = _ts_node_prev_named_sibling_wasm = wasmExports2["ts_node_prev_named_sibling_wasm"];
    Module["_ts_node_descendant_count_wasm"] = _ts_node_descendant_count_wasm = wasmExports2["ts_node_descendant_count_wasm"];
    Module["_ts_node_parent_wasm"] = _ts_node_parent_wasm = wasmExports2["ts_node_parent_wasm"];
    Module["_ts_node_child_with_descendant_wasm"] = _ts_node_child_with_descendant_wasm = wasmExports2["ts_node_child_with_descendant_wasm"];
    Module["_ts_node_descendant_for_index_wasm"] = _ts_node_descendant_for_index_wasm = wasmExports2["ts_node_descendant_for_index_wasm"];
    Module["_ts_node_named_descendant_for_index_wasm"] = _ts_node_named_descendant_for_index_wasm = wasmExports2["ts_node_named_descendant_for_index_wasm"];
    Module["_ts_node_descendant_for_position_wasm"] = _ts_node_descendant_for_position_wasm = wasmExports2["ts_node_descendant_for_position_wasm"];
    Module["_ts_node_named_descendant_for_position_wasm"] = _ts_node_named_descendant_for_position_wasm = wasmExports2["ts_node_named_descendant_for_position_wasm"];
    Module["_ts_node_start_point_wasm"] = _ts_node_start_point_wasm = wasmExports2["ts_node_start_point_wasm"];
    Module["_ts_node_end_point_wasm"] = _ts_node_end_point_wasm = wasmExports2["ts_node_end_point_wasm"];
    Module["_ts_node_start_index_wasm"] = _ts_node_start_index_wasm = wasmExports2["ts_node_start_index_wasm"];
    Module["_ts_node_end_index_wasm"] = _ts_node_end_index_wasm = wasmExports2["ts_node_end_index_wasm"];
    Module["_ts_node_to_string_wasm"] = _ts_node_to_string_wasm = wasmExports2["ts_node_to_string_wasm"];
    Module["_ts_node_children_wasm"] = _ts_node_children_wasm = wasmExports2["ts_node_children_wasm"];
    Module["_ts_node_named_children_wasm"] = _ts_node_named_children_wasm = wasmExports2["ts_node_named_children_wasm"];
    Module["_ts_node_descendants_of_type_wasm"] = _ts_node_descendants_of_type_wasm = wasmExports2["ts_node_descendants_of_type_wasm"];
    Module["_ts_node_is_named_wasm"] = _ts_node_is_named_wasm = wasmExports2["ts_node_is_named_wasm"];
    Module["_ts_node_has_changes_wasm"] = _ts_node_has_changes_wasm = wasmExports2["ts_node_has_changes_wasm"];
    Module["_ts_node_has_error_wasm"] = _ts_node_has_error_wasm = wasmExports2["ts_node_has_error_wasm"];
    Module["_ts_node_is_error_wasm"] = _ts_node_is_error_wasm = wasmExports2["ts_node_is_error_wasm"];
    Module["_ts_node_is_missing_wasm"] = _ts_node_is_missing_wasm = wasmExports2["ts_node_is_missing_wasm"];
    Module["_ts_node_is_extra_wasm"] = _ts_node_is_extra_wasm = wasmExports2["ts_node_is_extra_wasm"];
    Module["_ts_node_parse_state_wasm"] = _ts_node_parse_state_wasm = wasmExports2["ts_node_parse_state_wasm"];
    Module["_ts_node_next_parse_state_wasm"] = _ts_node_next_parse_state_wasm = wasmExports2["ts_node_next_parse_state_wasm"];
    Module["_ts_query_matches_wasm"] = _ts_query_matches_wasm = wasmExports2["ts_query_matches_wasm"];
    Module["_ts_query_captures_wasm"] = _ts_query_captures_wasm = wasmExports2["ts_query_captures_wasm"];
    Module["_memset"] = _memset = wasmExports2["memset"];
    Module["_memcpy"] = _memcpy = wasmExports2["memcpy"];
    Module["_memmove"] = _memmove = wasmExports2["memmove"];
    Module["_iswalpha"] = _iswalpha = wasmExports2["iswalpha"];
    Module["_iswblank"] = _iswblank = wasmExports2["iswblank"];
    Module["_iswdigit"] = _iswdigit = wasmExports2["iswdigit"];
    Module["_iswlower"] = _iswlower = wasmExports2["iswlower"];
    Module["_iswupper"] = _iswupper = wasmExports2["iswupper"];
    Module["_iswxdigit"] = _iswxdigit = wasmExports2["iswxdigit"];
    Module["_memchr"] = _memchr = wasmExports2["memchr"];
    Module["_strlen"] = _strlen = wasmExports2["strlen"];
    Module["_strcmp"] = _strcmp = wasmExports2["strcmp"];
    Module["_strncat"] = _strncat = wasmExports2["strncat"];
    Module["_strncpy"] = _strncpy = wasmExports2["strncpy"];
    Module["_towlower"] = _towlower = wasmExports2["towlower"];
    Module["_towupper"] = _towupper = wasmExports2["towupper"];
    _setThrew = wasmExports2["setThrew"];
    __emscripten_stack_restore = wasmExports2["_emscripten_stack_restore"];
    __emscripten_stack_alloc = wasmExports2["_emscripten_stack_alloc"];
    _emscripten_stack_get_current = wasmExports2["emscripten_stack_get_current"];
    ___wasm_apply_data_relocs = wasmExports2["__wasm_apply_data_relocs"];
  }
  __name(assignWasmExports, "assignWasmExports");
  var wasmImports = {
    /** @export */
    __heap_base: ___heap_base,
    /** @export */
    __indirect_function_table: wasmTable,
    /** @export */
    __memory_base: ___memory_base,
    /** @export */
    __stack_high: ___stack_high,
    /** @export */
    __stack_low: ___stack_low,
    /** @export */
    __stack_pointer: ___stack_pointer,
    /** @export */
    __table_base: ___table_base,
    /** @export */
    _abort_js: __abort_js,
    /** @export */
    emscripten_resize_heap: _emscripten_resize_heap,
    /** @export */
    fd_close: _fd_close,
    /** @export */
    fd_seek: _fd_seek,
    /** @export */
    fd_write: _fd_write,
    /** @export */
    memory: wasmMemory,
    /** @export */
    tree_sitter_log_callback: _tree_sitter_log_callback,
    /** @export */
    tree_sitter_parse_callback: _tree_sitter_parse_callback,
    /** @export */
    tree_sitter_progress_callback: _tree_sitter_progress_callback,
    /** @export */
    tree_sitter_query_progress_callback: _tree_sitter_query_progress_callback
  };
  function callMain(args2 = []) {
    var entryFunction = resolveGlobalSymbol("main").sym;
    if (!entryFunction) return;
    args2.unshift(thisProgram);
    var argc = args2.length;
    var argv = stackAlloc((argc + 1) * 4);
    var argv_ptr = argv;
    args2.forEach((arg) => {
      LE_HEAP_STORE_U32((argv_ptr >> 2) * 4, stringToUTF8OnStack(arg));
      argv_ptr += 4;
    });
    LE_HEAP_STORE_U32((argv_ptr >> 2) * 4, 0);
    try {
      var ret = entryFunction(argc, argv);
      exitJS(
        ret,
        /* implicit = */
        true
      );
      return ret;
    } catch (e) {
      return handleException(e);
    }
  }
  __name(callMain, "callMain");
  function run(args2 = arguments_) {
    if (runDependencies > 0) {
      dependenciesFulfilled = run;
      return;
    }
    preRun();
    if (runDependencies > 0) {
      dependenciesFulfilled = run;
      return;
    }
    function doRun() {
      Module["calledRun"] = true;
      if (ABORT) return;
      initRuntime();
      preMain();
      readyPromiseResolve?.(Module);
      Module["onRuntimeInitialized"]?.();
      var noInitialRun = Module["noInitialRun"] || false;
      if (!noInitialRun) callMain(args2);
      postRun();
    }
    __name(doRun, "doRun");
    if (Module["setStatus"]) {
      Module["setStatus"]("Running...");
      setTimeout(() => {
        setTimeout(() => Module["setStatus"](""), 1);
        doRun();
      }, 1);
    } else {
      doRun();
    }
  }
  __name(run, "run");
  var wasmExports;
  wasmExports = await createWasm();
  run();
  if (runtimeInitialized) {
    moduleRtn = Module;
  } else {
    moduleRtn = new Promise((resolve32, reject) => {
      readyPromiseResolve = resolve32;
      readyPromiseReject = reject;
    });
  }
  return moduleRtn;
}
async function initializeBinding(moduleOptions) {
  return Module3 ??= await web_tree_sitter_default(moduleOptions);
}
function checkModule() {
  return !!Module3;
}
function parseAnyPredicate(steps, index, operator, textPredicates) {
  if (steps.length !== 3) {
    throw new Error(
      `Wrong number of arguments to \`#${operator}\` predicate. Expected 2, got ${steps.length - 1}`
    );
  }
  if (!isCaptureStep(steps[1])) {
    throw new Error(
      `First argument of \`#${operator}\` predicate must be a capture. Got "${steps[1].value}"`
    );
  }
  const isPositive = operator === "eq?" || operator === "any-eq?";
  const matchAll = !operator.startsWith("any-");
  if (isCaptureStep(steps[2])) {
    const captureName1 = steps[1].name;
    const captureName2 = steps[2].name;
    textPredicates[index].push((captures) => {
      const nodes1 = [];
      const nodes2 = [];
      for (const c2 of captures) {
        if (c2.name === captureName1) nodes1.push(c2.node);
        if (c2.name === captureName2) nodes2.push(c2.node);
      }
      const compare = /* @__PURE__ */ __name((n1, n2, positive) => {
        return positive ? n1.text === n2.text : n1.text !== n2.text;
      }, "compare");
      return matchAll ? nodes1.every((n1) => nodes2.some((n2) => compare(n1, n2, isPositive))) : nodes1.some((n1) => nodes2.some((n2) => compare(n1, n2, isPositive)));
    });
  } else {
    const captureName = steps[1].name;
    const stringValue = steps[2].value;
    const matches = /* @__PURE__ */ __name((n) => n.text === stringValue, "matches");
    const doesNotMatch = /* @__PURE__ */ __name((n) => n.text !== stringValue, "doesNotMatch");
    textPredicates[index].push((captures) => {
      const nodes = [];
      for (const c2 of captures) {
        if (c2.name === captureName) nodes.push(c2.node);
      }
      const test = isPositive ? matches : doesNotMatch;
      return matchAll ? nodes.every(test) : nodes.some(test);
    });
  }
}
function parseMatchPredicate(steps, index, operator, textPredicates) {
  if (steps.length !== 3) {
    throw new Error(
      `Wrong number of arguments to \`#${operator}\` predicate. Expected 2, got ${steps.length - 1}.`
    );
  }
  if (steps[1].type !== "capture") {
    throw new Error(
      `First argument of \`#${operator}\` predicate must be a capture. Got "${steps[1].value}".`
    );
  }
  if (steps[2].type !== "string") {
    throw new Error(
      `Second argument of \`#${operator}\` predicate must be a string. Got @${steps[2].name}.`
    );
  }
  const isPositive = operator === "match?" || operator === "any-match?";
  const matchAll = !operator.startsWith("any-");
  const captureName = steps[1].name;
  const regex = new RegExp(steps[2].value);
  textPredicates[index].push((captures) => {
    const nodes = [];
    for (const c2 of captures) {
      if (c2.name === captureName) nodes.push(c2.node.text);
    }
    const test = /* @__PURE__ */ __name((text, positive) => {
      return positive ? regex.test(text) : !regex.test(text);
    }, "test");
    if (nodes.length === 0) return !isPositive;
    return matchAll ? nodes.every((text) => test(text, isPositive)) : nodes.some((text) => test(text, isPositive));
  });
}
function parseAnyOfPredicate(steps, index, operator, textPredicates) {
  if (steps.length < 2) {
    throw new Error(
      `Wrong number of arguments to \`#${operator}\` predicate. Expected at least 1. Got ${steps.length - 1}.`
    );
  }
  if (steps[1].type !== "capture") {
    throw new Error(
      `First argument of \`#${operator}\` predicate must be a capture. Got "${steps[1].value}".`
    );
  }
  const isPositive = operator === "any-of?";
  const captureName = steps[1].name;
  const stringSteps = steps.slice(2);
  if (!stringSteps.every(isStringStep)) {
    throw new Error(
      `Arguments to \`#${operator}\` predicate must be strings.".`
    );
  }
  const values = stringSteps.map((s) => s.value);
  textPredicates[index].push((captures) => {
    const nodes = [];
    for (const c2 of captures) {
      if (c2.name === captureName) nodes.push(c2.node.text);
    }
    if (nodes.length === 0) return !isPositive;
    return nodes.every((text) => values.includes(text)) === isPositive;
  });
}
function parseIsPredicate(steps, index, operator, assertedProperties, refutedProperties) {
  if (steps.length < 2 || steps.length > 3) {
    throw new Error(
      `Wrong number of arguments to \`#${operator}\` predicate. Expected 1 or 2. Got ${steps.length - 1}.`
    );
  }
  if (!steps.every(isStringStep)) {
    throw new Error(
      `Arguments to \`#${operator}\` predicate must be strings.".`
    );
  }
  const properties = operator === "is?" ? assertedProperties : refutedProperties;
  if (!properties[index]) properties[index] = {};
  properties[index][steps[1].value] = steps[2]?.value ?? null;
}
function parseSetDirective(steps, index, setProperties) {
  if (steps.length < 2 || steps.length > 3) {
    throw new Error(`Wrong number of arguments to \`#set!\` predicate. Expected 1 or 2. Got ${steps.length - 1}.`);
  }
  if (!steps.every(isStringStep)) {
    throw new Error(`Arguments to \`#set!\` predicate must be strings.".`);
  }
  if (!setProperties[index]) setProperties[index] = {};
  setProperties[index][steps[1].value] = steps[2]?.value ?? null;
}
function parsePattern(index, stepType, stepValueId, captureNames, stringValues, steps, textPredicates, predicates, setProperties, assertedProperties, refutedProperties) {
  if (stepType === PREDICATE_STEP_TYPE_CAPTURE) {
    const name2 = captureNames[stepValueId];
    steps.push({ type: "capture", name: name2 });
  } else if (stepType === PREDICATE_STEP_TYPE_STRING) {
    steps.push({ type: "string", value: stringValues[stepValueId] });
  } else if (steps.length > 0) {
    if (steps[0].type !== "string") {
      throw new Error("Predicates must begin with a literal value");
    }
    const operator = steps[0].value;
    switch (operator) {
      case "any-not-eq?":
      case "not-eq?":
      case "any-eq?":
      case "eq?":
        parseAnyPredicate(steps, index, operator, textPredicates);
        break;
      case "any-not-match?":
      case "not-match?":
      case "any-match?":
      case "match?":
        parseMatchPredicate(steps, index, operator, textPredicates);
        break;
      case "not-any-of?":
      case "any-of?":
        parseAnyOfPredicate(steps, index, operator, textPredicates);
        break;
      case "is?":
      case "is-not?":
        parseIsPredicate(steps, index, operator, assertedProperties, refutedProperties);
        break;
      case "set!":
        parseSetDirective(steps, index, setProperties);
        break;
      default:
        predicates[index].push({ operator, operands: steps.slice(1) });
    }
    steps.length = 0;
  }
}
var __defProp2;
var __name;
var Edit;
var SIZE_OF_SHORT;
var SIZE_OF_INT;
var SIZE_OF_CURSOR;
var SIZE_OF_NODE;
var SIZE_OF_POINT;
var SIZE_OF_RANGE;
var ZERO_POINT;
var INTERNAL;
var C;
var LookaheadIterator;
var Tree;
var TreeCursor;
var Node;
var LANGUAGE_FUNCTION_REGEX;
var Language;
var web_tree_sitter_default;
var Module3;
var TRANSFER_BUFFER;
var LANGUAGE_VERSION;
var MIN_COMPATIBLE_VERSION;
var Parser;
var PREDICATE_STEP_TYPE_CAPTURE;
var PREDICATE_STEP_TYPE_STRING;
var QUERY_WORD_REGEX;
var CaptureQuantifier;
var isCaptureStep;
var isStringStep;
var QueryErrorKind;
var QueryError;
var Query;
var init_web_tree_sitter = __esm({
  "node_modules/.pnpm/web-tree-sitter@0.26.11/node_modules/web-tree-sitter/web-tree-sitter.js"() {
    "use strict";
    __defProp2 = Object.defineProperty;
    __name = (target, value) => __defProp2(target, "name", { value, configurable: true });
    Edit = class {
      static {
        __name(this, "Edit");
      }
      /** The start position of the change. */
      startPosition;
      /** The end position of the change before the edit. */
      oldEndPosition;
      /** The end position of the change after the edit. */
      newEndPosition;
      /** The start index of the change. */
      startIndex;
      /** The end index of the change before the edit. */
      oldEndIndex;
      /** The end index of the change after the edit. */
      newEndIndex;
      constructor({
        startIndex,
        oldEndIndex,
        newEndIndex,
        startPosition,
        oldEndPosition,
        newEndPosition
      }) {
        this.startIndex = startIndex >>> 0;
        this.oldEndIndex = oldEndIndex >>> 0;
        this.newEndIndex = newEndIndex >>> 0;
        this.startPosition = startPosition;
        this.oldEndPosition = oldEndPosition;
        this.newEndPosition = newEndPosition;
      }
      /**
       * Edit a point and index to keep it in-sync with source code that has been edited.
       *
       * This function updates a single point's byte offset and row/column position
       * based on an edit operation. This is useful for editing points without
       * requiring a tree or node instance.
       */
      editPoint(point, index) {
        let newIndex = index;
        const newPoint = { ...point };
        if (index >= this.oldEndIndex) {
          newIndex = this.newEndIndex + (index - this.oldEndIndex);
          const originalRow = point.row;
          newPoint.row = this.newEndPosition.row + (point.row - this.oldEndPosition.row);
          newPoint.column = originalRow === this.oldEndPosition.row ? this.newEndPosition.column + (point.column - this.oldEndPosition.column) : point.column;
        } else if (index > this.startIndex) {
          newIndex = this.newEndIndex;
          newPoint.row = this.newEndPosition.row;
          newPoint.column = this.newEndPosition.column;
        }
        return { point: newPoint, index: newIndex };
      }
      /**
       * Edit a range to keep it in-sync with source code that has been edited.
       *
       * This function updates a range's start and end positions based on an edit
       * operation. This is useful for editing ranges without requiring a tree
       * or node instance.
       */
      editRange(range) {
        const newRange = {
          startIndex: range.startIndex,
          startPosition: { ...range.startPosition },
          endIndex: range.endIndex,
          endPosition: { ...range.endPosition }
        };
        if (range.endIndex >= this.oldEndIndex) {
          if (range.endIndex !== Number.MAX_SAFE_INTEGER) {
            newRange.endIndex = this.newEndIndex + (range.endIndex - this.oldEndIndex);
            newRange.endPosition = {
              row: this.newEndPosition.row + (range.endPosition.row - this.oldEndPosition.row),
              column: range.endPosition.row === this.oldEndPosition.row ? this.newEndPosition.column + (range.endPosition.column - this.oldEndPosition.column) : range.endPosition.column
            };
            if (newRange.endIndex < this.newEndIndex) {
              newRange.endIndex = Number.MAX_SAFE_INTEGER;
              newRange.endPosition = { row: Number.MAX_SAFE_INTEGER, column: Number.MAX_SAFE_INTEGER };
            }
          }
        } else if (range.endIndex > this.startIndex) {
          newRange.endIndex = this.startIndex;
          newRange.endPosition = { ...this.startPosition };
        }
        if (range.startIndex >= this.oldEndIndex) {
          newRange.startIndex = this.newEndIndex + (range.startIndex - this.oldEndIndex);
          newRange.startPosition = {
            row: this.newEndPosition.row + (range.startPosition.row - this.oldEndPosition.row),
            column: range.startPosition.row === this.oldEndPosition.row ? this.newEndPosition.column + (range.startPosition.column - this.oldEndPosition.column) : range.startPosition.column
          };
          if (newRange.startIndex < this.newEndIndex) {
            newRange.startIndex = Number.MAX_SAFE_INTEGER;
            newRange.startPosition = { row: Number.MAX_SAFE_INTEGER, column: Number.MAX_SAFE_INTEGER };
          }
        } else if (range.startIndex > this.startIndex) {
          newRange.startIndex = this.startIndex;
          newRange.startPosition = { ...this.startPosition };
        }
        return newRange;
      }
    };
    SIZE_OF_SHORT = 2;
    SIZE_OF_INT = 4;
    SIZE_OF_CURSOR = 4 * SIZE_OF_INT;
    SIZE_OF_NODE = 5 * SIZE_OF_INT;
    SIZE_OF_POINT = 2 * SIZE_OF_INT;
    SIZE_OF_RANGE = 2 * SIZE_OF_INT + 2 * SIZE_OF_POINT;
    ZERO_POINT = { row: 0, column: 0 };
    INTERNAL = /* @__PURE__ */ Symbol("INTERNAL");
    __name(assertInternal, "assertInternal");
    __name(isPoint, "isPoint");
    __name(setModule, "setModule");
    LookaheadIterator = class {
      static {
        __name(this, "LookaheadIterator");
      }
      /** @internal */
      [0] = 0;
      // Internal handle for Wasm
      /** @internal */
      language;
      /** @internal */
      constructor(internal, address, language) {
        assertInternal(internal);
        this[0] = address;
        this.language = language;
      }
      /** Get the current symbol of the lookahead iterator. */
      get currentTypeId() {
        return C._ts_lookahead_iterator_current_symbol(this[0]);
      }
      /** Get the current symbol name of the lookahead iterator. */
      get currentType() {
        return this.language.types[this.currentTypeId] || "ERROR";
      }
      /** Delete the lookahead iterator, freeing its resources. */
      delete() {
        C._ts_lookahead_iterator_delete(this[0]);
        this[0] = 0;
      }
      /**
       * Reset the lookahead iterator.
       *
       * This returns `true` if the language was set successfully and `false`
       * otherwise.
       */
      reset(language, stateId) {
        if (C._ts_lookahead_iterator_reset(this[0], language[0], stateId)) {
          this.language = language;
          return true;
        }
        return false;
      }
      /**
       * Reset the lookahead iterator to another state.
       *
       * This returns `true` if the iterator was reset to the given state and
       * `false` otherwise.
       */
      resetState(stateId) {
        return Boolean(C._ts_lookahead_iterator_reset_state(this[0], stateId));
      }
      /**
       * Returns an iterator that iterates over the symbols of the lookahead iterator.
       *
       * The iterator will yield the current symbol name as a string for each step
       * until there are no more symbols to iterate over.
       */
      [Symbol.iterator]() {
        return {
          next: /* @__PURE__ */ __name(() => {
            if (C._ts_lookahead_iterator_next(this[0])) {
              return { done: false, value: this.currentType };
            }
            return { done: true, value: "" };
          }, "next")
        };
      }
    };
    __name(getText, "getText");
    Tree = class _Tree {
      static {
        __name(this, "Tree");
      }
      /** @internal */
      [0] = 0;
      // Internal handle for Wasm
      /** @internal */
      textCallback;
      /** The language that was used to parse the syntax tree. */
      language;
      /** @internal */
      constructor(internal, address, language, textCallback) {
        assertInternal(internal);
        this[0] = address;
        this.language = language;
        this.textCallback = textCallback;
      }
      /** Create a shallow copy of the syntax tree. This is very fast. */
      copy() {
        const address = C._ts_tree_copy(this[0]);
        return new _Tree(INTERNAL, address, this.language, this.textCallback);
      }
      /** Delete the syntax tree, freeing its resources. */
      delete() {
        C._ts_tree_delete(this[0]);
        this[0] = 0;
      }
      /** Get the root node of the syntax tree. */
      get rootNode() {
        C._ts_tree_root_node_wasm(this[0]);
        return unmarshalNode(this);
      }
      /**
       * Get the root node of the syntax tree, but with its position shifted
       * forward by the given offset.
       */
      rootNodeWithOffset(offsetBytes, offsetExtent) {
        const address = TRANSFER_BUFFER + SIZE_OF_NODE;
        C.setValue(address, offsetBytes, "i32");
        marshalPoint(address + SIZE_OF_INT, offsetExtent);
        C._ts_tree_root_node_with_offset_wasm(this[0]);
        return unmarshalNode(this);
      }
      /**
       * Edit the syntax tree to keep it in sync with source code that has been
       * edited.
       *
       * You must describe the edit both in terms of byte offsets and in terms of
       * row/column coordinates.
       */
      edit(edit) {
        marshalEdit(edit);
        C._ts_tree_edit_wasm(this[0]);
      }
      /** Create a new {@link TreeCursor} starting from the root of the tree. */
      walk() {
        return this.rootNode.walk();
      }
      /**
       * Compare this old edited syntax tree to a new syntax tree representing
       * the same document, returning a sequence of ranges whose syntactic
       * structure has changed.
       *
       * For this to work correctly, this syntax tree must have been edited such
       * that its ranges match up to the new tree. Generally, you'll want to
       * call this method right after calling one of the [`Parser::parse`]
       * functions. Call it on the old tree that was passed to parse, and
       * pass the new tree that was returned from `parse`.
       */
      getChangedRanges(other) {
        if (!(other instanceof _Tree)) {
          throw new TypeError("Argument must be a Tree");
        }
        C._ts_tree_get_changed_ranges_wasm(this[0], other[0]);
        const count = C.getValue(TRANSFER_BUFFER, "i32");
        const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
        const result = new Array(count);
        if (count > 0) {
          let address = buffer;
          for (let i2 = 0; i2 < count; i2++) {
            result[i2] = unmarshalRange(address);
            address += SIZE_OF_RANGE;
          }
          C._free(buffer);
        }
        return result;
      }
      /** Get the included ranges that were used to parse the syntax tree. */
      getIncludedRanges() {
        C._ts_tree_included_ranges_wasm(this[0]);
        const count = C.getValue(TRANSFER_BUFFER, "i32");
        const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
        const result = new Array(count);
        if (count > 0) {
          let address = buffer;
          for (let i2 = 0; i2 < count; i2++) {
            result[i2] = unmarshalRange(address);
            address += SIZE_OF_RANGE;
          }
          C._free(buffer);
        }
        return result;
      }
    };
    TreeCursor = class _TreeCursor {
      static {
        __name(this, "TreeCursor");
      }
      /** @internal */
      // @ts-expect-error: never read
      [0] = 0;
      // Internal handle for Wasm
      /** @internal */
      // @ts-expect-error: never read
      [1] = 0;
      // Internal handle for Wasm
      /** @internal */
      // @ts-expect-error: never read
      [2] = 0;
      // Internal handle for Wasm
      /** @internal */
      // @ts-expect-error: never read
      [3] = 0;
      // Internal handle for Wasm
      /** @internal */
      tree;
      /** @internal */
      constructor(internal, tree) {
        assertInternal(internal);
        this.tree = tree;
        unmarshalTreeCursor(this);
      }
      /** Creates a deep copy of the tree cursor. This allocates new memory. */
      copy() {
        const copy = new _TreeCursor(INTERNAL, this.tree);
        C._ts_tree_cursor_copy_wasm(this.tree[0]);
        unmarshalTreeCursor(copy);
        return copy;
      }
      /** Delete the tree cursor, freeing its resources. */
      delete() {
        marshalTreeCursor(this);
        C._ts_tree_cursor_delete_wasm(this.tree[0]);
        this[0] = this[1] = this[2] = 0;
      }
      /** Get the tree cursor's current {@link Node}. */
      get currentNode() {
        marshalTreeCursor(this);
        C._ts_tree_cursor_current_node_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /**
       * Get the numerical field id of this tree cursor's current node.
       *
       * See also {@link TreeCursor#currentFieldName}.
       */
      get currentFieldId() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_current_field_id_wasm(this.tree[0]);
      }
      /** Get the field name of this tree cursor's current node. */
      get currentFieldName() {
        return this.tree.language.fields[this.currentFieldId];
      }
      /**
       * Get the depth of the cursor's current node relative to the original
       * node that the cursor was constructed with.
       */
      get currentDepth() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_current_depth_wasm(this.tree[0]);
      }
      /**
       * Get the index of the cursor's current node out of all of the
       * descendants of the original node that the cursor was constructed with.
       */
      get currentDescendantIndex() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_current_descendant_index_wasm(this.tree[0]);
      }
      /** Get the type of the cursor's current node. */
      get nodeType() {
        return this.tree.language.types[this.nodeTypeId] || "ERROR";
      }
      /** Get the type id of the cursor's current node. */
      get nodeTypeId() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_current_node_type_id_wasm(this.tree[0]);
      }
      /** Get the state id of the cursor's current node. */
      get nodeStateId() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_current_node_state_id_wasm(this.tree[0]);
      }
      /** Get the id of the cursor's current node. */
      get nodeId() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_current_node_id_wasm(this.tree[0]);
      }
      /**
       * Check if the cursor's current node is *named*.
       *
       * Named nodes correspond to named rules in the grammar, whereas
       * *anonymous* nodes correspond to string literals in the grammar.
       */
      get nodeIsNamed() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_current_node_is_named_wasm(this.tree[0]) === 1;
      }
      /**
       * Check if the cursor's current node is *missing*.
       *
       * Missing nodes are inserted by the parser in order to recover from
       * certain kinds of syntax errors.
       */
      get nodeIsMissing() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_current_node_is_missing_wasm(this.tree[0]) === 1;
      }
      /** Get the string content of the cursor's current node. */
      get nodeText() {
        marshalTreeCursor(this);
        const startIndex = C._ts_tree_cursor_start_index_wasm(this.tree[0]);
        const endIndex = C._ts_tree_cursor_end_index_wasm(this.tree[0]);
        C._ts_tree_cursor_start_position_wasm(this.tree[0]);
        const startPosition = unmarshalPoint(TRANSFER_BUFFER);
        return getText(this.tree, startIndex, endIndex, startPosition);
      }
      /** Get the start position of the cursor's current node. */
      get startPosition() {
        marshalTreeCursor(this);
        C._ts_tree_cursor_start_position_wasm(this.tree[0]);
        return unmarshalPoint(TRANSFER_BUFFER);
      }
      /** Get the end position of the cursor's current node. */
      get endPosition() {
        marshalTreeCursor(this);
        C._ts_tree_cursor_end_position_wasm(this.tree[0]);
        return unmarshalPoint(TRANSFER_BUFFER);
      }
      /** Get the start index of the cursor's current node. */
      get startIndex() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_start_index_wasm(this.tree[0]);
      }
      /** Get the end index of the cursor's current node. */
      get endIndex() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_end_index_wasm(this.tree[0]);
      }
      /**
       * Move this cursor to the first child of its current node.
       *
       * This returns `true` if the cursor successfully moved, and returns
       * `false` if there were no children.
       */
      gotoFirstChild() {
        marshalTreeCursor(this);
        const result = C._ts_tree_cursor_goto_first_child_wasm(this.tree[0]);
        unmarshalTreeCursor(this);
        return result === 1;
      }
      /**
       * Move this cursor to the last child of its current node.
       *
       * This returns `true` if the cursor successfully moved, and returns
       * `false` if there were no children.
       *
       * Note that this function may be slower than
       * {@link TreeCursor#gotoFirstChild} because it needs to
       * iterate through all the children to compute the child's position.
       */
      gotoLastChild() {
        marshalTreeCursor(this);
        const result = C._ts_tree_cursor_goto_last_child_wasm(this.tree[0]);
        unmarshalTreeCursor(this);
        return result === 1;
      }
      /**
       * Move this cursor to the parent of its current node.
       *
       * This returns `true` if the cursor successfully moved, and returns
       * `false` if there was no parent node (the cursor was already on the
       * root node).
       *
       * Note that the node the cursor was constructed with is considered the root
       * of the cursor, and the cursor cannot walk outside this node.
       */
      gotoParent() {
        marshalTreeCursor(this);
        const result = C._ts_tree_cursor_goto_parent_wasm(this.tree[0]);
        unmarshalTreeCursor(this);
        return result === 1;
      }
      /**
       * Move this cursor to the next sibling of its current node.
       *
       * This returns `true` if the cursor successfully moved, and returns
       * `false` if there was no next sibling node.
       *
       * Note that the node the cursor was constructed with is considered the root
       * of the cursor, and the cursor cannot walk outside this node.
       */
      gotoNextSibling() {
        marshalTreeCursor(this);
        const result = C._ts_tree_cursor_goto_next_sibling_wasm(this.tree[0]);
        unmarshalTreeCursor(this);
        return result === 1;
      }
      /**
       * Move this cursor to the previous sibling of its current node.
       *
       * This returns `true` if the cursor successfully moved, and returns
       * `false` if there was no previous sibling node.
       *
       * Note that this function may be slower than
       * {@link TreeCursor#gotoNextSibling} due to how node
       * positions are stored. In the worst case, this will need to iterate
       * through all the children up to the previous sibling node to recalculate
       * its position. Also note that the node the cursor was constructed with is
       * considered the root of the cursor, and the cursor cannot walk outside this node.
       */
      gotoPreviousSibling() {
        marshalTreeCursor(this);
        const result = C._ts_tree_cursor_goto_previous_sibling_wasm(this.tree[0]);
        unmarshalTreeCursor(this);
        return result === 1;
      }
      /**
       * Move the cursor to the node that is the nth descendant of
       * the original node that the cursor was constructed with, where
       * zero represents the original node itself.
       */
      gotoDescendant(goalDescendantIndex) {
        marshalTreeCursor(this);
        C._ts_tree_cursor_goto_descendant_wasm(this.tree[0], goalDescendantIndex);
        unmarshalTreeCursor(this);
      }
      /**
       * Move this cursor to the first child of its current node that contains or
       * starts after the given byte offset.
       *
       * This returns `true` if the cursor successfully moved to a child node, and returns
       * `false` if no such child was found.
       */
      gotoFirstChildForIndex(goalIndex) {
        marshalTreeCursor(this);
        C.setValue(TRANSFER_BUFFER + SIZE_OF_CURSOR, goalIndex, "i32");
        const result = C._ts_tree_cursor_goto_first_child_for_index_wasm(this.tree[0]);
        unmarshalTreeCursor(this);
        return result === 1;
      }
      /**
       * Move this cursor to the first child of its current node that contains or
       * starts after the given byte offset.
       *
       * This returns the index of the child node if one was found, and returns
       * `null` if no such child was found.
       */
      gotoFirstChildForPosition(goalPosition) {
        marshalTreeCursor(this);
        marshalPoint(TRANSFER_BUFFER + SIZE_OF_CURSOR, goalPosition);
        const result = C._ts_tree_cursor_goto_first_child_for_position_wasm(this.tree[0]);
        unmarshalTreeCursor(this);
        return result === 1;
      }
      /**
       * Re-initialize this tree cursor to start at the original node that the
       * cursor was constructed with.
       */
      reset(node) {
        marshalNode(node);
        marshalTreeCursor(this, TRANSFER_BUFFER + SIZE_OF_NODE);
        C._ts_tree_cursor_reset_wasm(this.tree[0]);
        unmarshalTreeCursor(this);
      }
      /**
       * Re-initialize a tree cursor to the same position as another cursor.
       *
       * Unlike {@link TreeCursor#reset}, this will not lose parent
       * information and allows reusing already created cursors.
       */
      resetTo(cursor) {
        marshalTreeCursor(this, TRANSFER_BUFFER);
        marshalTreeCursor(cursor, TRANSFER_BUFFER + SIZE_OF_CURSOR);
        C._ts_tree_cursor_reset_to_wasm(this.tree[0], cursor.tree[0]);
        unmarshalTreeCursor(this);
      }
    };
    Node = class {
      static {
        __name(this, "Node");
      }
      /** @internal */
      // @ts-expect-error: never read
      [0] = 0;
      // Internal handle for Wasm
      /** @internal */
      _children;
      /** @internal */
      _namedChildren;
      /** @internal */
      constructor(internal, {
        id,
        tree,
        startIndex,
        startPosition,
        other
      }) {
        assertInternal(internal);
        this[0] = other;
        this.id = id;
        this.tree = tree;
        this.startIndex = startIndex;
        this.startPosition = startPosition;
      }
      /**
       * The numeric id for this node that is unique.
       *
       * Within a given syntax tree, no two nodes have the same id. However:
       *
       * * If a new tree is created based on an older tree, and a node from the old tree is reused in
       *   the process, then that node will have the same id in both trees.
       *
       * * A node not marked as having changes does not guarantee it was reused.
       *
       * * If a node is marked as having changed in the old tree, it will not be reused.
       */
      id;
      /** The byte index where this node starts. */
      startIndex;
      /** The position where this node starts. */
      startPosition;
      /** The tree that this node belongs to. */
      tree;
      /** Get this node's type as a numerical id. */
      get typeId() {
        marshalNode(this);
        return C._ts_node_symbol_wasm(this.tree[0]);
      }
      /**
       * Get the node's type as a numerical id as it appears in the grammar,
       * ignoring aliases.
       */
      get grammarId() {
        marshalNode(this);
        return C._ts_node_grammar_symbol_wasm(this.tree[0]);
      }
      /** Get this node's type as a string. */
      get type() {
        return this.tree.language.types[this.typeId] || "ERROR";
      }
      /**
       * Get this node's symbol name as it appears in the grammar, ignoring
       * aliases as a string.
       */
      get grammarType() {
        return this.tree.language.types[this.grammarId] || "ERROR";
      }
      /**
       * Check if this node is *named*.
       *
       * Named nodes correspond to named rules in the grammar, whereas
       * *anonymous* nodes correspond to string literals in the grammar.
       */
      get isNamed() {
        marshalNode(this);
        return C._ts_node_is_named_wasm(this.tree[0]) === 1;
      }
      /**
       * Check if this node is *extra*.
       *
       * Extra nodes represent things like comments, which are not required
       * by the grammar, but can appear anywhere.
       */
      get isExtra() {
        marshalNode(this);
        return C._ts_node_is_extra_wasm(this.tree[0]) === 1;
      }
      /**
       * Check if this node represents a syntax error.
       *
       * Syntax errors represent parts of the code that could not be incorporated
       * into a valid syntax tree.
       */
      get isError() {
        marshalNode(this);
        return C._ts_node_is_error_wasm(this.tree[0]) === 1;
      }
      /**
       * Check if this node is *missing*.
       *
       * Missing nodes are inserted by the parser in order to recover from
       * certain kinds of syntax errors.
       */
      get isMissing() {
        marshalNode(this);
        return C._ts_node_is_missing_wasm(this.tree[0]) === 1;
      }
      /** Check if this node has been edited. */
      get hasChanges() {
        marshalNode(this);
        return C._ts_node_has_changes_wasm(this.tree[0]) === 1;
      }
      /**
       * Check if this node represents a syntax error or contains any syntax
       * errors anywhere within it.
       */
      get hasError() {
        marshalNode(this);
        return C._ts_node_has_error_wasm(this.tree[0]) === 1;
      }
      /** Get the byte index where this node ends. */
      get endIndex() {
        marshalNode(this);
        return C._ts_node_end_index_wasm(this.tree[0]);
      }
      /** Get the position where this node ends. */
      get endPosition() {
        marshalNode(this);
        C._ts_node_end_point_wasm(this.tree[0]);
        return unmarshalPoint(TRANSFER_BUFFER);
      }
      /** Get the string content of this node. */
      get text() {
        return getText(this.tree, this.startIndex, this.endIndex, this.startPosition);
      }
      /** Get this node's parse state. */
      get parseState() {
        marshalNode(this);
        return C._ts_node_parse_state_wasm(this.tree[0]);
      }
      /** Get the parse state after this node. */
      get nextParseState() {
        marshalNode(this);
        return C._ts_node_next_parse_state_wasm(this.tree[0]);
      }
      /** Check if this node is equal to another node. */
      equals(other) {
        return this.tree === other.tree && this.id === other.id;
      }
      /**
       * Get the node's child at the given index, where zero represents the first child.
       *
       * This method is fairly fast, but its cost is technically log(n), so if
       * you might be iterating over a long list of children, you should use
       * {@link Node#children} instead.
       */
      child(index) {
        marshalNode(this);
        C._ts_node_child_wasm(this.tree[0], index);
        return unmarshalNode(this.tree);
      }
      /**
       * Get this node's *named* child at the given index.
       *
       * See also {@link Node#isNamed}.
       * This method is fairly fast, but its cost is technically log(n), so if
       * you might be iterating over a long list of children, you should use
       * {@link Node#namedChildren} instead.
       */
      namedChild(index) {
        marshalNode(this);
        C._ts_node_named_child_wasm(this.tree[0], index);
        return unmarshalNode(this.tree);
      }
      /**
       * Get this node's child with the given numerical field id.
       *
       * See also {@link Node#childForFieldName}. You can
       * convert a field name to an id using {@link Language#fieldIdForName}.
       */
      childForFieldId(fieldId) {
        marshalNode(this);
        C._ts_node_child_by_field_id_wasm(this.tree[0], fieldId);
        return unmarshalNode(this.tree);
      }
      /**
       * Get the first child with the given field name.
       *
       * If multiple children may have the same field name, access them using
       * {@link Node#childrenForFieldName}.
       */
      childForFieldName(fieldName) {
        const fieldId = this.tree.language.fields.indexOf(fieldName);
        if (fieldId !== -1) return this.childForFieldId(fieldId);
        return null;
      }
      /** Get the field name of this node's child at the given index. */
      fieldNameForChild(index) {
        marshalNode(this);
        const address = C._ts_node_field_name_for_child_wasm(this.tree[0], index);
        if (!address) return null;
        return C.AsciiToString(address);
      }
      /** Get the field name of this node's named child at the given index. */
      fieldNameForNamedChild(index) {
        marshalNode(this);
        const address = C._ts_node_field_name_for_named_child_wasm(this.tree[0], index);
        if (!address) return null;
        return C.AsciiToString(address);
      }
      /**
       * Get an array of this node's children with a given field name.
       *
       * See also {@link Node#children}.
       */
      childrenForFieldName(fieldName) {
        const fieldId = this.tree.language.fields.indexOf(fieldName);
        if (fieldId !== -1 && fieldId !== 0) return this.childrenForFieldId(fieldId);
        return [];
      }
      /**
        * Get an array of this node's children with a given field id.
        *
        * See also {@link Node#childrenForFieldName}.
        */
      childrenForFieldId(fieldId) {
        marshalNode(this);
        C._ts_node_children_by_field_id_wasm(this.tree[0], fieldId);
        const count = C.getValue(TRANSFER_BUFFER, "i32");
        const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
        const result = new Array(count);
        if (count > 0) {
          let address = buffer;
          for (let i2 = 0; i2 < count; i2++) {
            result[i2] = unmarshalNode(this.tree, address);
            address += SIZE_OF_NODE;
          }
          C._free(buffer);
        }
        return result;
      }
      /** Get the node's first child that contains or starts after the given byte offset. */
      firstChildForIndex(index) {
        marshalNode(this);
        const address = TRANSFER_BUFFER + SIZE_OF_NODE;
        C.setValue(address, index, "i32");
        C._ts_node_first_child_for_byte_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /** Get the node's first named child that contains or starts after the given byte offset. */
      firstNamedChildForIndex(index) {
        marshalNode(this);
        const address = TRANSFER_BUFFER + SIZE_OF_NODE;
        C.setValue(address, index, "i32");
        C._ts_node_first_named_child_for_byte_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /** Get this node's number of children. */
      get childCount() {
        marshalNode(this);
        return C._ts_node_child_count_wasm(this.tree[0]);
      }
      /**
       * Get this node's number of *named* children.
       *
       * See also {@link Node#isNamed}.
       */
      get namedChildCount() {
        marshalNode(this);
        return C._ts_node_named_child_count_wasm(this.tree[0]);
      }
      /** Get this node's first child. */
      get firstChild() {
        return this.child(0);
      }
      /**
       * Get this node's first named child.
       *
       * See also {@link Node#isNamed}.
       */
      get firstNamedChild() {
        return this.namedChild(0);
      }
      /** Get this node's last child. */
      get lastChild() {
        return this.child(this.childCount - 1);
      }
      /**
       * Get this node's last named child.
       *
       * See also {@link Node#isNamed}.
       */
      get lastNamedChild() {
        return this.namedChild(this.namedChildCount - 1);
      }
      /**
       * Iterate over this node's children.
       *
       * If you're walking the tree recursively, you may want to use the
       * {@link TreeCursor} APIs directly instead.
       */
      get children() {
        if (!this._children) {
          marshalNode(this);
          C._ts_node_children_wasm(this.tree[0]);
          const count = C.getValue(TRANSFER_BUFFER, "i32");
          const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
          this._children = new Array(count);
          if (count > 0) {
            let address = buffer;
            for (let i2 = 0; i2 < count; i2++) {
              this._children[i2] = unmarshalNode(this.tree, address);
              address += SIZE_OF_NODE;
            }
            C._free(buffer);
          }
        }
        return this._children;
      }
      /**
       * Iterate over this node's named children.
       *
       * See also {@link Node#children}.
       */
      get namedChildren() {
        if (!this._namedChildren) {
          marshalNode(this);
          C._ts_node_named_children_wasm(this.tree[0]);
          const count = C.getValue(TRANSFER_BUFFER, "i32");
          const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
          this._namedChildren = new Array(count);
          if (count > 0) {
            let address = buffer;
            for (let i2 = 0; i2 < count; i2++) {
              this._namedChildren[i2] = unmarshalNode(this.tree, address);
              address += SIZE_OF_NODE;
            }
            C._free(buffer);
          }
        }
        return this._namedChildren;
      }
      /**
       * Get the descendants of this node that are the given type, or in the given types array.
       *
       * The types array should contain node type strings, which can be retrieved from {@link Language#types}.
       *
       * Additionally, a `startPosition` and `endPosition` can be passed in to restrict the search to a byte range.
       */
      descendantsOfType(types, startPosition = ZERO_POINT, endPosition = ZERO_POINT) {
        if (!Array.isArray(types)) types = [types];
        const symbols = [];
        const typesBySymbol = this.tree.language.types;
        for (const node_type of types) {
          if (node_type == "ERROR") {
            symbols.push(65535);
          }
        }
        for (let i2 = 0, n = typesBySymbol.length; i2 < n; i2++) {
          if (types.includes(typesBySymbol[i2])) {
            symbols.push(i2);
          }
        }
        const symbolsAddress = C._malloc(SIZE_OF_INT * symbols.length);
        for (let i2 = 0, n = symbols.length; i2 < n; i2++) {
          C.setValue(symbolsAddress + i2 * SIZE_OF_INT, symbols[i2], "i32");
        }
        marshalNode(this);
        C._ts_node_descendants_of_type_wasm(
          this.tree[0],
          symbolsAddress,
          symbols.length,
          startPosition.row,
          startPosition.column,
          endPosition.row,
          endPosition.column
        );
        const descendantCount = C.getValue(TRANSFER_BUFFER, "i32");
        const descendantAddress = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
        const result = new Array(descendantCount);
        if (descendantCount > 0) {
          let address = descendantAddress;
          for (let i2 = 0; i2 < descendantCount; i2++) {
            result[i2] = unmarshalNode(this.tree, address);
            address += SIZE_OF_NODE;
          }
        }
        C._free(descendantAddress);
        C._free(symbolsAddress);
        return result;
      }
      /** Get this node's next sibling. */
      get nextSibling() {
        marshalNode(this);
        C._ts_node_next_sibling_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /** Get this node's previous sibling. */
      get previousSibling() {
        marshalNode(this);
        C._ts_node_prev_sibling_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /**
       * Get this node's next *named* sibling.
       *
       * See also {@link Node#isNamed}.
       */
      get nextNamedSibling() {
        marshalNode(this);
        C._ts_node_next_named_sibling_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /**
       * Get this node's previous *named* sibling.
       *
       * See also {@link Node#isNamed}.
       */
      get previousNamedSibling() {
        marshalNode(this);
        C._ts_node_prev_named_sibling_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /** Get the node's number of descendants, including one for the node itself. */
      get descendantCount() {
        marshalNode(this);
        return C._ts_node_descendant_count_wasm(this.tree[0]);
      }
      /**
       * Get this node's immediate parent.
       * Prefer {@link Node#childWithDescendant} for iterating over this node's ancestors.
       */
      get parent() {
        marshalNode(this);
        C._ts_node_parent_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /**
       * Get the node that contains `descendant`.
       *
       * Note that this can return `descendant` itself.
       */
      childWithDescendant(descendant) {
        marshalNode(this);
        marshalNode(descendant, 1);
        C._ts_node_child_with_descendant_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /** Get the smallest node within this node that spans the given byte range. */
      descendantForIndex(start2, end = start2) {
        if (typeof start2 !== "number" || typeof end !== "number") {
          throw new Error("Arguments must be numbers");
        }
        marshalNode(this);
        const address = TRANSFER_BUFFER + SIZE_OF_NODE;
        C.setValue(address, start2, "i32");
        C.setValue(address + SIZE_OF_INT, end, "i32");
        C._ts_node_descendant_for_index_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /** Get the smallest named node within this node that spans the given byte range. */
      namedDescendantForIndex(start2, end = start2) {
        if (typeof start2 !== "number" || typeof end !== "number") {
          throw new Error("Arguments must be numbers");
        }
        marshalNode(this);
        const address = TRANSFER_BUFFER + SIZE_OF_NODE;
        C.setValue(address, start2, "i32");
        C.setValue(address + SIZE_OF_INT, end, "i32");
        C._ts_node_named_descendant_for_index_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /** Get the smallest node within this node that spans the given point range. */
      descendantForPosition(start2, end = start2) {
        if (!isPoint(start2) || !isPoint(end)) {
          throw new Error("Arguments must be {row, column} objects");
        }
        marshalNode(this);
        const address = TRANSFER_BUFFER + SIZE_OF_NODE;
        marshalPoint(address, start2);
        marshalPoint(address + SIZE_OF_POINT, end);
        C._ts_node_descendant_for_position_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /** Get the smallest named node within this node that spans the given point range. */
      namedDescendantForPosition(start2, end = start2) {
        if (!isPoint(start2) || !isPoint(end)) {
          throw new Error("Arguments must be {row, column} objects");
        }
        marshalNode(this);
        const address = TRANSFER_BUFFER + SIZE_OF_NODE;
        marshalPoint(address, start2);
        marshalPoint(address + SIZE_OF_POINT, end);
        C._ts_node_named_descendant_for_position_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /**
       * Create a new {@link TreeCursor} starting from this node.
       *
       * Note that the given node is considered the root of the cursor,
       * and the cursor cannot walk outside this node.
       */
      walk() {
        marshalNode(this);
        C._ts_tree_cursor_new_wasm(this.tree[0]);
        return new TreeCursor(INTERNAL, this.tree);
      }
      /**
       * Edit this node to keep it in-sync with source code that has been edited.
       *
       * This function is only rarely needed. When you edit a syntax tree with
       * the {@link Tree#edit} method, all of the nodes that you retrieve from
       * the tree afterward will already reflect the edit. You only need to
       * use {@link Node#edit} when you have a specific {@link Node} instance that
       * you want to keep and continue to use after an edit.
       */
      edit(edit) {
        if (this.startIndex >= edit.oldEndIndex) {
          this.startIndex = edit.newEndIndex + (this.startIndex - edit.oldEndIndex);
          let subbedPointRow;
          let subbedPointColumn;
          if (this.startPosition.row > edit.oldEndPosition.row) {
            subbedPointRow = this.startPosition.row - edit.oldEndPosition.row;
            subbedPointColumn = this.startPosition.column;
          } else {
            subbedPointRow = 0;
            subbedPointColumn = this.startPosition.column;
            if (this.startPosition.column >= edit.oldEndPosition.column) {
              subbedPointColumn = this.startPosition.column - edit.oldEndPosition.column;
            }
          }
          if (subbedPointRow > 0) {
            this.startPosition.row += subbedPointRow;
            this.startPosition.column = subbedPointColumn;
          } else {
            this.startPosition.column += subbedPointColumn;
          }
        } else if (this.startIndex > edit.startIndex) {
          this.startIndex = edit.newEndIndex;
          this.startPosition.row = edit.newEndPosition.row;
          this.startPosition.column = edit.newEndPosition.column;
        }
      }
      /** Get the S-expression representation of this node. */
      toString() {
        marshalNode(this);
        const address = C._ts_node_to_string_wasm(this.tree[0]);
        const result = C.AsciiToString(address);
        C._free(address);
        return result;
      }
    };
    __name(unmarshalCaptures, "unmarshalCaptures");
    __name(marshalNode, "marshalNode");
    __name(unmarshalNode, "unmarshalNode");
    __name(marshalTreeCursor, "marshalTreeCursor");
    __name(unmarshalTreeCursor, "unmarshalTreeCursor");
    __name(marshalPoint, "marshalPoint");
    __name(unmarshalPoint, "unmarshalPoint");
    __name(marshalRange, "marshalRange");
    __name(unmarshalRange, "unmarshalRange");
    __name(marshalEdit, "marshalEdit");
    __name(unmarshalLanguageMetadata, "unmarshalLanguageMetadata");
    LANGUAGE_FUNCTION_REGEX = /^tree_sitter_\w+$/;
    Language = class _Language {
      static {
        __name(this, "Language");
      }
      /** @internal */
      [0] = 0;
      // Internal handle for Wasm
      /**
       * A list of all node types in the language. The index of each type in this
       * array is its node type id.
       */
      types;
      /**
       * A list of all field names in the language. The index of each field name in
       * this array is its field id.
       */
      fields;
      /** @internal */
      constructor(internal, address) {
        assertInternal(internal);
        this[0] = address;
        this.types = new Array(C._ts_language_symbol_count(this[0]));
        for (let i2 = 0, n = this.types.length; i2 < n; i2++) {
          if (C._ts_language_symbol_type(this[0], i2) < 2) {
            this.types[i2] = C.UTF8ToString(C._ts_language_symbol_name(this[0], i2));
          }
        }
        this.fields = new Array(C._ts_language_field_count(this[0]) + 1);
        for (let i2 = 0, n = this.fields.length; i2 < n; i2++) {
          const fieldName = C._ts_language_field_name_for_id(this[0], i2);
          if (fieldName !== 0) {
            this.fields[i2] = C.UTF8ToString(fieldName);
          } else {
            this.fields[i2] = null;
          }
        }
      }
      /**
       * Gets the name of the language.
       */
      get name() {
        const ptr = C._ts_language_name(this[0]);
        if (ptr === 0) return null;
        return C.UTF8ToString(ptr);
      }
      /**
       * Gets the ABI version of the language.
       */
      get abiVersion() {
        return C._ts_language_abi_version(this[0]);
      }
      /**
      * Get the metadata for this language. This information is generated by the
      * CLI, and relies on the language author providing the correct metadata in
      * the language's `tree-sitter.json` file.
      */
      get metadata() {
        C._ts_language_metadata_wasm(this[0]);
        const length = C.getValue(TRANSFER_BUFFER, "i32");
        if (length === 0) return null;
        return unmarshalLanguageMetadata(TRANSFER_BUFFER + SIZE_OF_INT);
      }
      /**
       * Gets the number of fields in the language.
       */
      get fieldCount() {
        return this.fields.length - 1;
      }
      /**
       * Gets the number of states in the language.
       */
      get stateCount() {
        return C._ts_language_state_count(this[0]);
      }
      /**
       * Get the field id for a field name.
       */
      fieldIdForName(fieldName) {
        const result = this.fields.indexOf(fieldName);
        return result !== -1 ? result : null;
      }
      /**
       * Get the field name for a field id.
       */
      fieldNameForId(fieldId) {
        return this.fields[fieldId] ?? null;
      }
      /**
       * Get the node type id for a node type name.
       */
      idForNodeType(type, named) {
        const typeLength = C.lengthBytesUTF8(type);
        const typeAddress = C._malloc(typeLength + 1);
        C.stringToUTF8(type, typeAddress, typeLength + 1);
        const result = C._ts_language_symbol_for_name(this[0], typeAddress, typeLength, named ? 1 : 0);
        C._free(typeAddress);
        return result || null;
      }
      /**
       * Gets the number of node types in the language.
       */
      get nodeTypeCount() {
        return C._ts_language_symbol_count(this[0]);
      }
      /**
       * Get the node type name for a node type id.
       */
      nodeTypeForId(typeId) {
        const name2 = C._ts_language_symbol_name(this[0], typeId);
        return name2 ? C.UTF8ToString(name2) : null;
      }
      /**
       * Check if a node type is named.
       *
       * @see {@link https://tree-sitter.github.io/tree-sitter/using-parsers/2-basic-parsing.html#named-vs-anonymous-nodes}
       */
      nodeTypeIsNamed(typeId) {
        return C._ts_language_type_is_named_wasm(this[0], typeId) ? true : false;
      }
      /**
       * Check if a node type is visible.
       */
      nodeTypeIsVisible(typeId) {
        return C._ts_language_type_is_visible_wasm(this[0], typeId) ? true : false;
      }
      /**
       * Get the supertypes ids of this language.
       *
       * @see {@link https://tree-sitter.github.io/tree-sitter/using-parsers/6-static-node-types.html?highlight=supertype#supertype-nodes}
       */
      get supertypes() {
        C._ts_language_supertypes_wasm(this[0]);
        const count = C.getValue(TRANSFER_BUFFER, "i32");
        const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
        const result = new Array(count);
        if (count > 0) {
          let address = buffer;
          for (let i2 = 0; i2 < count; i2++) {
            result[i2] = C.getValue(address, "i16");
            address += SIZE_OF_SHORT;
          }
        }
        return result;
      }
      /**
       * Get the subtype ids for a given supertype node id.
       */
      subtypes(supertype) {
        C._ts_language_subtypes_wasm(this[0], supertype);
        const count = C.getValue(TRANSFER_BUFFER, "i32");
        const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
        const result = new Array(count);
        if (count > 0) {
          let address = buffer;
          for (let i2 = 0; i2 < count; i2++) {
            result[i2] = C.getValue(address, "i16");
            address += SIZE_OF_SHORT;
          }
        }
        return result;
      }
      /**
       * Get the next state id for a given state id and node type id.
       */
      nextState(stateId, typeId) {
        return C._ts_language_next_state(this[0], stateId, typeId);
      }
      /**
       * Create a new lookahead iterator for this language and parse state.
       *
       * This returns `null` if state is invalid for this language.
       *
       * Iterating {@link LookaheadIterator} will yield valid symbols in the given
       * parse state. Newly created lookahead iterators will return the `ERROR`
       * symbol from {@link LookaheadIterator#currentType}.
       *
       * Lookahead iterators can be useful for generating suggestions and improving
       * syntax error diagnostics. To get symbols valid in an `ERROR` node, use the
       * lookahead iterator on its first leaf node state. For `MISSING` nodes, a
       * lookahead iterator created on the previous non-extra leaf node may be
       * appropriate.
       */
      lookaheadIterator(stateId) {
        const address = C._ts_lookahead_iterator_new(this[0], stateId);
        if (address) return new LookaheadIterator(INTERNAL, address, this);
        return null;
      }
      /**
       * Load a language from a WebAssembly module.
       * The module can be provided as a path to a file or as a buffer.
       */
      static async load(input) {
        let binary2;
        if (input instanceof Uint8Array) {
          binary2 = input;
        } else if (globalThis.process?.versions.node) {
          const fs2 = await import("fs/promises");
          binary2 = await fs2.readFile(input);
        } else {
          const response = await fetch(input);
          if (!response.ok) {
            const body2 = await response.text();
            throw new Error(`Language.load failed with status ${response.status}.

${body2}`);
          }
          const retryResp = response.clone();
          try {
            binary2 = await WebAssembly.compileStreaming(response);
          } catch (reason) {
            console.error("wasm streaming compile failed:", reason);
            console.error("falling back to ArrayBuffer instantiation");
            binary2 = new Uint8Array(await retryResp.arrayBuffer());
          }
        }
        const mod = await C.loadWebAssemblyModule(binary2, { loadAsync: true });
        const symbolNames = Object.keys(mod);
        const functionName = symbolNames.find((key) => LANGUAGE_FUNCTION_REGEX.test(key) && !key.includes("external_scanner_"));
        if (!functionName) {
          console.log(`Couldn't find language function in Wasm file. Symbols:
${JSON.stringify(symbolNames, null, 2)}`);
          throw new Error("Language.load failed: no language function found in Wasm file");
        }
        const languageAddress = mod[functionName]();
        return new _Language(INTERNAL, languageAddress);
      }
    };
    __name(Module2, "Module");
    web_tree_sitter_default = Module2;
    Module3 = null;
    __name(initializeBinding, "initializeBinding");
    __name(checkModule, "checkModule");
    Parser = class {
      static {
        __name(this, "Parser");
      }
      /** @internal */
      [0] = 0;
      // Internal handle for Wasm
      /** @internal */
      [1] = 0;
      // Internal handle for Wasm
      /** @internal */
      logCallback = null;
      /** The parser's current language. */
      language = null;
      /**
       * This must always be called before creating a Parser.
       *
       * You can optionally pass in options to configure the Wasm module, the most common
       * one being `locateFile` to help the module find the `.wasm` file.
       */
      static async init(moduleOptions) {
        setModule(await initializeBinding(moduleOptions));
        TRANSFER_BUFFER = C._ts_init();
        LANGUAGE_VERSION = C.getValue(TRANSFER_BUFFER, "i32");
        MIN_COMPATIBLE_VERSION = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
      }
      /**
       * Create a new parser.
       */
      constructor() {
        this.initialize();
      }
      /** @internal */
      initialize() {
        if (!checkModule()) {
          throw new Error("cannot construct a Parser before calling `init()`");
        }
        C._ts_parser_new_wasm();
        this[0] = C.getValue(TRANSFER_BUFFER, "i32");
        this[1] = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
      }
      /** Delete the parser, freeing its resources. */
      delete() {
        C._ts_parser_delete(this[0]);
        C._free(this[1]);
        this[0] = 0;
        this[1] = 0;
      }
      /**
       * Set the language that the parser should use for parsing.
       *
       * If the language was not successfully assigned, an error will be thrown.
       * This happens if the language was generated with an incompatible
       * version of the Tree-sitter CLI. Check the language's version using
       * {@link Language#version} and compare it to this library's
       * {@link LANGUAGE_VERSION} and {@link MIN_COMPATIBLE_VERSION} constants.
       */
      setLanguage(language) {
        let address;
        if (!language) {
          address = 0;
          this.language = null;
        } else if (language.constructor === Language) {
          address = language[0];
          const version = C._ts_language_abi_version(address);
          if (version < MIN_COMPATIBLE_VERSION || LANGUAGE_VERSION < version) {
            throw new Error(
              `Incompatible language version ${version}. Compatibility range ${MIN_COMPATIBLE_VERSION} through ${LANGUAGE_VERSION}.`
            );
          }
          this.language = language;
        } else {
          throw new Error("Argument must be a Language");
        }
        C._ts_parser_set_language(this[0], address);
        return this;
      }
      /**
       * Parse a slice of UTF8 text.
       *
       * @param {string | ParseCallback} callback - The UTF8-encoded text to parse or a callback function.
       *
       * @param {Tree | null} [oldTree] - A previous syntax tree parsed from the same document. If the text of the
       *   document has changed since `oldTree` was created, then you must edit `oldTree` to match
       *   the new text using {@link Tree#edit}.
       *
       * @param {ParseOptions} [options] - Options for parsing the text.
       *  This can be used to set the included ranges, or a progress callback.
       *
       * @returns {Tree | null} A {@link Tree} if parsing succeeded, or `null` if:
       *  - The parser has not yet had a language assigned with {@link Parser#setLanguage}.
       *  - The progress callback returned true.
       */
      parse(callback, oldTree, options) {
        if (typeof callback === "string") {
          C.currentParseCallback = (index) => callback.slice(index);
        } else if (typeof callback === "function") {
          C.currentParseCallback = callback;
        } else {
          throw new Error("Argument must be a string or a function");
        }
        if (options?.progressCallback) {
          C.currentProgressCallback = options.progressCallback;
        } else {
          C.currentProgressCallback = null;
        }
        if (this.logCallback) {
          C.currentLogCallback = this.logCallback;
          C._ts_parser_enable_logger_wasm(this[0], 1);
        } else {
          C.currentLogCallback = null;
          C._ts_parser_enable_logger_wasm(this[0], 0);
        }
        let rangeCount = 0;
        let rangeAddress = 0;
        if (options?.includedRanges) {
          rangeCount = options.includedRanges.length;
          rangeAddress = C._calloc(rangeCount, SIZE_OF_RANGE);
          let address = rangeAddress;
          for (let i2 = 0; i2 < rangeCount; i2++) {
            marshalRange(address, options.includedRanges[i2]);
            address += SIZE_OF_RANGE;
          }
        }
        const treeAddress = C._ts_parser_parse_wasm(
          this[0],
          this[1],
          oldTree ? oldTree[0] : 0,
          rangeAddress,
          rangeCount
        );
        if (!treeAddress) {
          C.currentParseCallback = null;
          C.currentLogCallback = null;
          C.currentProgressCallback = null;
          return null;
        }
        if (!this.language) {
          throw new Error("Parser must have a language to parse");
        }
        const result = new Tree(INTERNAL, treeAddress, this.language, C.currentParseCallback);
        C.currentParseCallback = null;
        C.currentLogCallback = null;
        C.currentProgressCallback = null;
        return result;
      }
      /**
       * Instruct the parser to start the next parse from the beginning.
       *
       * If the parser previously failed because of a callback, 
       * then by default, it will resume where it left off on the
       * next call to {@link Parser#parse} or other parsing functions.
       * If you don't want to resume, and instead intend to use this parser to
       * parse some other document, you must call `reset` first.
       */
      reset() {
        C._ts_parser_reset(this[0]);
      }
      /** Get the ranges of text that the parser will include when parsing. */
      getIncludedRanges() {
        C._ts_parser_included_ranges_wasm(this[0]);
        const count = C.getValue(TRANSFER_BUFFER, "i32");
        const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
        const result = new Array(count);
        if (count > 0) {
          let address = buffer;
          for (let i2 = 0; i2 < count; i2++) {
            result[i2] = unmarshalRange(address);
            address += SIZE_OF_RANGE;
          }
          C._free(buffer);
        }
        return result;
      }
      /** Set the logging callback that a parser should use during parsing. */
      setLogger(callback) {
        if (!callback) {
          this.logCallback = null;
        } else if (typeof callback !== "function") {
          throw new Error("Logger callback must be a function");
        } else {
          this.logCallback = callback;
        }
        return this;
      }
      /** Get the parser's current logger. */
      getLogger() {
        return this.logCallback;
      }
    };
    PREDICATE_STEP_TYPE_CAPTURE = 1;
    PREDICATE_STEP_TYPE_STRING = 2;
    QUERY_WORD_REGEX = /[\w-]+/g;
    CaptureQuantifier = {
      Zero: 0,
      ZeroOrOne: 1,
      ZeroOrMore: 2,
      One: 3,
      OneOrMore: 4
    };
    isCaptureStep = /* @__PURE__ */ __name((step) => step.type === "capture", "isCaptureStep");
    isStringStep = /* @__PURE__ */ __name((step) => step.type === "string", "isStringStep");
    QueryErrorKind = {
      Syntax: 1,
      NodeName: 2,
      FieldName: 3,
      CaptureName: 4,
      PatternStructure: 5
    };
    QueryError = class _QueryError extends Error {
      constructor(kind, info2, index, length) {
        super(_QueryError.formatMessage(kind, info2));
        this.kind = kind;
        this.info = info2;
        this.index = index;
        this.length = length;
        this.name = "QueryError";
      }
      static {
        __name(this, "QueryError");
      }
      /** Formats an error message based on the error kind and info */
      static formatMessage(kind, info2) {
        switch (kind) {
          case QueryErrorKind.NodeName:
            return `Bad node name '${info2.word}'`;
          case QueryErrorKind.FieldName:
            return `Bad field name '${info2.word}'`;
          case QueryErrorKind.CaptureName:
            return `Bad capture name @${info2.word}`;
          case QueryErrorKind.PatternStructure:
            return `Bad pattern structure at offset ${info2.suffix}`;
          case QueryErrorKind.Syntax:
            return `Bad syntax at offset ${info2.suffix}`;
        }
      }
    };
    __name(parseAnyPredicate, "parseAnyPredicate");
    __name(parseMatchPredicate, "parseMatchPredicate");
    __name(parseAnyOfPredicate, "parseAnyOfPredicate");
    __name(parseIsPredicate, "parseIsPredicate");
    __name(parseSetDirective, "parseSetDirective");
    __name(parsePattern, "parsePattern");
    Query = class {
      static {
        __name(this, "Query");
      }
      /** @internal */
      [0] = 0;
      // Internal handle for Wasm
      /** @internal */
      exceededMatchLimit;
      /** @internal */
      textPredicates;
      /** The names of the captures used in the query. */
      captureNames;
      /** The quantifiers of the captures used in the query. */
      captureQuantifiers;
      /**
       * The other user-defined predicates associated with the given index.
       *
       * This includes predicates with operators other than:
       * - `match?`
       * - `eq?` and `not-eq?`
       * - `any-of?` and `not-any-of?`
       * - `is?` and `is-not?`
       * - `set!`
       */
      predicates;
      /** The properties for predicates with the operator `set!`. */
      setProperties;
      /** The properties for predicates with the operator `is?`. */
      assertedProperties;
      /** The properties for predicates with the operator `is-not?`. */
      refutedProperties;
      /** The maximum number of in-progress matches for this cursor. */
      matchLimit;
      /**
       * Create a new query from a string containing one or more S-expression
       * patterns.
       *
       * The query is associated with a particular language, and can only be run
       * on syntax nodes parsed with that language. References to Queries can be
       * shared between multiple threads.
       *
       * @link {@see https://tree-sitter.github.io/tree-sitter/using-parsers/queries}
       */
      constructor(language, source) {
        const sourceLength = C.lengthBytesUTF8(source);
        const sourceAddress = C._malloc(sourceLength + 1);
        C.stringToUTF8(source, sourceAddress, sourceLength + 1);
        const address = C._ts_query_new(
          language[0],
          sourceAddress,
          sourceLength,
          TRANSFER_BUFFER,
          TRANSFER_BUFFER + SIZE_OF_INT
        );
        if (!address) {
          const errorId = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
          const errorByte = C.getValue(TRANSFER_BUFFER, "i32");
          const errorIndex = C.UTF8ToString(sourceAddress, errorByte).length;
          const suffix = source.slice(errorIndex, errorIndex + 100).split("\n")[0];
          const word = suffix.match(QUERY_WORD_REGEX)?.[0] ?? "";
          C._free(sourceAddress);
          switch (errorId) {
            case QueryErrorKind.Syntax:
              throw new QueryError(QueryErrorKind.Syntax, { suffix: `${errorIndex}: '${suffix}'...` }, errorIndex, 0);
            case QueryErrorKind.NodeName:
              throw new QueryError(errorId, { word }, errorIndex, word.length);
            case QueryErrorKind.FieldName:
              throw new QueryError(errorId, { word }, errorIndex, word.length);
            case QueryErrorKind.CaptureName:
              throw new QueryError(errorId, { word }, errorIndex, word.length);
            case QueryErrorKind.PatternStructure:
              throw new QueryError(errorId, { suffix: `${errorIndex}: '${suffix}'...` }, errorIndex, 0);
          }
        }
        const stringCount = C._ts_query_string_count(address);
        const captureCount = C._ts_query_capture_count(address);
        const patternCount = C._ts_query_pattern_count(address);
        const captureNames = new Array(captureCount);
        const captureQuantifiers = new Array(patternCount);
        const stringValues = new Array(stringCount);
        for (let i2 = 0; i2 < captureCount; i2++) {
          const nameAddress = C._ts_query_capture_name_for_id(
            address,
            i2,
            TRANSFER_BUFFER
          );
          const nameLength = C.getValue(TRANSFER_BUFFER, "i32");
          captureNames[i2] = C.UTF8ToString(nameAddress, nameLength);
        }
        for (let i2 = 0; i2 < patternCount; i2++) {
          const captureQuantifiersArray = new Array(captureCount);
          for (let j = 0; j < captureCount; j++) {
            const quantifier = C._ts_query_capture_quantifier_for_id(address, i2, j);
            captureQuantifiersArray[j] = quantifier;
          }
          captureQuantifiers[i2] = captureQuantifiersArray;
        }
        for (let i2 = 0; i2 < stringCount; i2++) {
          const valueAddress = C._ts_query_string_value_for_id(
            address,
            i2,
            TRANSFER_BUFFER
          );
          const nameLength = C.getValue(TRANSFER_BUFFER, "i32");
          stringValues[i2] = C.UTF8ToString(valueAddress, nameLength);
        }
        const setProperties = new Array(patternCount);
        const assertedProperties = new Array(patternCount);
        const refutedProperties = new Array(patternCount);
        const predicates = new Array(patternCount);
        const textPredicates = new Array(patternCount);
        for (let i2 = 0; i2 < patternCount; i2++) {
          const predicatesAddress = C._ts_query_predicates_for_pattern(address, i2, TRANSFER_BUFFER);
          const stepCount = C.getValue(TRANSFER_BUFFER, "i32");
          predicates[i2] = [];
          textPredicates[i2] = [];
          const steps = new Array();
          let stepAddress = predicatesAddress;
          for (let j = 0; j < stepCount; j++) {
            const stepType = C.getValue(stepAddress, "i32");
            stepAddress += SIZE_OF_INT;
            const stepValueId = C.getValue(stepAddress, "i32");
            stepAddress += SIZE_OF_INT;
            parsePattern(
              i2,
              stepType,
              stepValueId,
              captureNames,
              stringValues,
              steps,
              textPredicates,
              predicates,
              setProperties,
              assertedProperties,
              refutedProperties
            );
          }
          Object.freeze(textPredicates[i2]);
          Object.freeze(predicates[i2]);
          Object.freeze(setProperties[i2]);
          Object.freeze(assertedProperties[i2]);
          Object.freeze(refutedProperties[i2]);
        }
        C._free(sourceAddress);
        this[0] = address;
        this.captureNames = captureNames;
        this.captureQuantifiers = captureQuantifiers;
        this.textPredicates = textPredicates;
        this.predicates = predicates;
        this.setProperties = setProperties;
        this.assertedProperties = assertedProperties;
        this.refutedProperties = refutedProperties;
        this.exceededMatchLimit = false;
      }
      /** Delete the query, freeing its resources. */
      delete() {
        C._ts_query_delete(this[0]);
        this[0] = 0;
      }
      /**
       * Iterate over all of the matches in the order that they were found.
       *
       * Each match contains the index of the pattern that matched, and a list of
       * captures. Because multiple patterns can match the same set of nodes,
       * one match may contain captures that appear *before* some of the
       * captures from a previous match.
       *
       * @param {Node} node - The node to execute the query on.
       *
       * @param {QueryOptions} options - Options for query execution.
       */
      matches(node, options = {}) {
        const startPosition = options.startPosition ?? ZERO_POINT;
        const endPosition = options.endPosition ?? ZERO_POINT;
        const startIndex = options.startIndex ?? 0;
        const endIndex = options.endIndex ?? 0;
        const startContainingPosition = options.startContainingPosition ?? ZERO_POINT;
        const endContainingPosition = options.endContainingPosition ?? ZERO_POINT;
        const startContainingIndex = options.startContainingIndex ?? 0;
        const endContainingIndex = options.endContainingIndex ?? 0;
        const matchLimit = options.matchLimit ?? 4294967295;
        const maxStartDepth = options.maxStartDepth ?? 4294967295;
        const progressCallback = options.progressCallback;
        if (typeof matchLimit !== "number") {
          throw new Error("Arguments must be numbers");
        }
        this.matchLimit = matchLimit;
        if (endIndex !== 0 && startIndex > endIndex) {
          throw new Error("`startIndex` cannot be greater than `endIndex`");
        }
        if (endPosition !== ZERO_POINT && (startPosition.row > endPosition.row || startPosition.row === endPosition.row && startPosition.column > endPosition.column)) {
          throw new Error("`startPosition` cannot be greater than `endPosition`");
        }
        if (endContainingIndex !== 0 && startContainingIndex > endContainingIndex) {
          throw new Error("`startContainingIndex` cannot be greater than `endContainingIndex`");
        }
        if (endContainingPosition !== ZERO_POINT && (startContainingPosition.row > endContainingPosition.row || startContainingPosition.row === endContainingPosition.row && startContainingPosition.column > endContainingPosition.column)) {
          throw new Error("`startContainingPosition` cannot be greater than `endContainingPosition`");
        }
        if (progressCallback) {
          C.currentQueryProgressCallback = progressCallback;
        }
        marshalNode(node);
        C._ts_query_matches_wasm(
          this[0],
          node.tree[0],
          startPosition.row,
          startPosition.column,
          endPosition.row,
          endPosition.column,
          startIndex,
          endIndex,
          startContainingPosition.row,
          startContainingPosition.column,
          endContainingPosition.row,
          endContainingPosition.column,
          startContainingIndex,
          endContainingIndex,
          matchLimit,
          maxStartDepth
        );
        const rawCount = C.getValue(TRANSFER_BUFFER, "i32");
        const startAddress = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
        const didExceedMatchLimit = C.getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, "i32");
        const result = new Array(rawCount);
        this.exceededMatchLimit = Boolean(didExceedMatchLimit);
        let filteredCount = 0;
        let address = startAddress;
        for (let i2 = 0; i2 < rawCount; i2++) {
          const patternIndex = C.getValue(address, "i32");
          address += SIZE_OF_INT;
          const captureCount = C.getValue(address, "i32");
          address += SIZE_OF_INT;
          const captures = new Array(captureCount);
          address = unmarshalCaptures(this, node.tree, address, patternIndex, captures);
          if (this.textPredicates[patternIndex].every((p) => p(captures))) {
            result[filteredCount] = { patternIndex, captures };
            const setProperties = this.setProperties[patternIndex];
            result[filteredCount].setProperties = setProperties;
            const assertedProperties = this.assertedProperties[patternIndex];
            result[filteredCount].assertedProperties = assertedProperties;
            const refutedProperties = this.refutedProperties[patternIndex];
            result[filteredCount].refutedProperties = refutedProperties;
            filteredCount++;
          }
        }
        result.length = filteredCount;
        C._free(startAddress);
        C.currentQueryProgressCallback = null;
        return result;
      }
      /**
       * Iterate over all of the individual captures in the order that they
       * appear.
       *
       * This is useful if you don't care about which pattern matched, and just
       * want a single, ordered sequence of captures.
       *
       * @param {Node} node - The node to execute the query on.
       *
       * @param {QueryOptions} options - Options for query execution.
       */
      captures(node, options = {}) {
        const startPosition = options.startPosition ?? ZERO_POINT;
        const endPosition = options.endPosition ?? ZERO_POINT;
        const startIndex = options.startIndex ?? 0;
        const endIndex = options.endIndex ?? 0;
        const startContainingPosition = options.startContainingPosition ?? ZERO_POINT;
        const endContainingPosition = options.endContainingPosition ?? ZERO_POINT;
        const startContainingIndex = options.startContainingIndex ?? 0;
        const endContainingIndex = options.endContainingIndex ?? 0;
        const matchLimit = options.matchLimit ?? 4294967295;
        const maxStartDepth = options.maxStartDepth ?? 4294967295;
        const progressCallback = options.progressCallback;
        if (typeof matchLimit !== "number") {
          throw new Error("Arguments must be numbers");
        }
        this.matchLimit = matchLimit;
        if (endIndex !== 0 && startIndex > endIndex) {
          throw new Error("`startIndex` cannot be greater than `endIndex`");
        }
        if (endPosition !== ZERO_POINT && (startPosition.row > endPosition.row || startPosition.row === endPosition.row && startPosition.column > endPosition.column)) {
          throw new Error("`startPosition` cannot be greater than `endPosition`");
        }
        if (endContainingIndex !== 0 && startContainingIndex > endContainingIndex) {
          throw new Error("`startContainingIndex` cannot be greater than `endContainingIndex`");
        }
        if (endContainingPosition !== ZERO_POINT && (startContainingPosition.row > endContainingPosition.row || startContainingPosition.row === endContainingPosition.row && startContainingPosition.column > endContainingPosition.column)) {
          throw new Error("`startContainingPosition` cannot be greater than `endContainingPosition`");
        }
        if (progressCallback) {
          C.currentQueryProgressCallback = progressCallback;
        }
        marshalNode(node);
        C._ts_query_captures_wasm(
          this[0],
          node.tree[0],
          startPosition.row,
          startPosition.column,
          endPosition.row,
          endPosition.column,
          startIndex,
          endIndex,
          startContainingPosition.row,
          startContainingPosition.column,
          endContainingPosition.row,
          endContainingPosition.column,
          startContainingIndex,
          endContainingIndex,
          matchLimit,
          maxStartDepth
        );
        const count = C.getValue(TRANSFER_BUFFER, "i32");
        const startAddress = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
        const didExceedMatchLimit = C.getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, "i32");
        const result = new Array();
        this.exceededMatchLimit = Boolean(didExceedMatchLimit);
        const captures = new Array();
        let address = startAddress;
        for (let i2 = 0; i2 < count; i2++) {
          const patternIndex = C.getValue(address, "i32");
          address += SIZE_OF_INT;
          const captureCount = C.getValue(address, "i32");
          address += SIZE_OF_INT;
          const captureIndex = C.getValue(address, "i32");
          address += SIZE_OF_INT;
          captures.length = captureCount;
          address = unmarshalCaptures(this, node.tree, address, patternIndex, captures);
          if (this.textPredicates[patternIndex].every((p) => p(captures))) {
            const capture = captures[captureIndex];
            const setProperties = this.setProperties[patternIndex];
            capture.setProperties = setProperties;
            const assertedProperties = this.assertedProperties[patternIndex];
            capture.assertedProperties = assertedProperties;
            const refutedProperties = this.refutedProperties[patternIndex];
            capture.refutedProperties = refutedProperties;
            result.push(capture);
          }
        }
        C._free(startAddress);
        C.currentQueryProgressCallback = null;
        return result;
      }
      /** Get the predicates for a given pattern. */
      predicatesForPattern(patternIndex) {
        return this.predicates[patternIndex];
      }
      /**
       * Disable a certain capture within a query.
       *
       * This prevents the capture from being returned in matches, and also
       * avoids any resource usage associated with recording the capture.
       */
      disableCapture(captureName) {
        const captureNameLength = C.lengthBytesUTF8(captureName);
        const captureNameAddress = C._malloc(captureNameLength + 1);
        C.stringToUTF8(captureName, captureNameAddress, captureNameLength + 1);
        C._ts_query_disable_capture(this[0], captureNameAddress, captureNameLength);
        C._free(captureNameAddress);
      }
      /**
       * Disable a certain pattern within a query.
       *
       * This prevents the pattern from matching, and also avoids any resource
       * usage associated with the pattern. This throws an error if the pattern
       * index is out of bounds.
       */
      disablePattern(patternIndex) {
        if (patternIndex >= this.predicates.length) {
          throw new Error(
            `Pattern index is ${patternIndex} but the pattern count is ${this.predicates.length}`
          );
        }
        C._ts_query_disable_pattern(this[0], patternIndex);
      }
      /**
       * Check if, on its last execution, this cursor exceeded its maximum number
       * of in-progress matches.
       */
      didExceedMatchLimit() {
        return this.exceededMatchLimit;
      }
      /** Get the byte offset where the given pattern starts in the query's source. */
      startIndexForPattern(patternIndex) {
        if (patternIndex >= this.predicates.length) {
          throw new Error(
            `Pattern index is ${patternIndex} but the pattern count is ${this.predicates.length}`
          );
        }
        return C._ts_query_start_byte_for_pattern(this[0], patternIndex);
      }
      /** Get the byte offset where the given pattern ends in the query's source. */
      endIndexForPattern(patternIndex) {
        if (patternIndex >= this.predicates.length) {
          throw new Error(
            `Pattern index is ${patternIndex} but the pattern count is ${this.predicates.length}`
          );
        }
        return C._ts_query_end_byte_for_pattern(this[0], patternIndex);
      }
      /** Get the number of patterns in the query. */
      patternCount() {
        return C._ts_query_pattern_count(this[0]);
      }
      /** Get the index for a given capture name. */
      captureIndexForName(captureName) {
        return this.captureNames.indexOf(captureName);
      }
      /** Check if a given pattern within a query has a single root node. */
      isPatternRooted(patternIndex) {
        return C._ts_query_is_pattern_rooted(this[0], patternIndex) === 1;
      }
      /** Check if a given pattern within a query has a single root node. */
      isPatternNonLocal(patternIndex) {
        return C._ts_query_is_pattern_non_local(this[0], patternIndex) === 1;
      }
      /**
       * Check if a given step in a query is 'definite'.
       *
       * A query step is 'definite' if its parent pattern will be guaranteed to
       * match successfully once it reaches the step.
       */
      isPatternGuaranteedAtStep(byteIndex) {
        return C._ts_query_is_pattern_guaranteed_at_step(this[0], byteIndex) === 1;
      }
    };
  }
});
function grammarKeyForExt(ext) {
  return EXT_GRAMMAR[ext];
}
function sharedGrammarsCacheDir() {
  const xdg = process.env.XDG_CACHE_HOME;
  const base = xdg && xdg.trim() ? xdg.trim() : join2(homedir(), ".cache");
  return join2(base, "codeindex", "grammars", ENGINE_VERSION);
}
function resolveGrammarsTier(opts = {}) {
  const cacheDir = sharedGrammarsCacheDir();
  const legacy = process.env.CODEINDEX_GRAMMAR_DIR ?? process.env.ULTRAINDEX_GRAMMAR_DIR;
  if (legacy && legacy.trim() && existsSync(legacy)) return { tier: "env", dir: legacy, cacheDir };
  const here = opts.moduleDir ?? dirname(fileURLToPath(import.meta.url));
  const adjacent = [
    join2(here, "grammars"),
    // bundle: <...>/scripts/grammars
    join2(here, "..", "..", "scripts", "grammars"),
    // dev: src/ast → <repo>/scripts/grammars
    join2(here, "..", "scripts", "grammars")
  ];
  for (const c2 of adjacent) if (existsSync(c2)) return { tier: "adjacent", dir: c2, cacheDir };
  const env = process.env.CODEINDEX_GRAMMARS_DIR;
  if (env && env.trim() && existsSync(env)) return { tier: "env", dir: env, cacheDir };
  if (existsSync(cacheDir)) return { tier: "cache", dir: cacheDir, cacheDir };
  return { tier: "none", cacheDir };
}
function resolveGrammarsDir(opts) {
  return resolveGrammarsTier(opts).dir;
}
async function ensureGrammars(keys) {
  const dir = resolveGrammarsDir();
  if (!dir) return;
  if (!runtimeReady) {
    const runtime = join2(dir, "web-tree-sitter.wasm");
    if (!existsSync(runtime)) return;
    await Parser.init({ wasmBinary: readFileSync2(runtime) });
    runtimeReady = true;
    parser = new Parser();
  }
  for (const key of new Set(keys)) {
    if (loaded.has(key) || failed.has(key)) continue;
    const wasm = join2(dir, `${key}.wasm`);
    if (!existsSync(wasm)) {
      failed.add(key);
      continue;
    }
    try {
      loaded.set(key, await Language.load(new Uint8Array(readFileSync2(wasm))));
    } catch {
      failed.add(key);
    }
  }
}
function allGrammarKeys() {
  return [...new Set(Object.values(EXT_GRAMMAR))];
}
function grammarKeysForExts(exts) {
  const keys = /* @__PURE__ */ new Set();
  for (const ext of exts) {
    const key = EXT_GRAMMAR[ext];
    if (key !== void 0) keys.add(key);
  }
  return [...keys].sort();
}
function grammarReady(key) {
  return loaded.has(key);
}
function parserFor(key) {
  const lang = loaded.get(key);
  if (!parser || !lang) return null;
  parser.setLanguage(lang);
  return parser;
}
var EXT_GRAMMAR;
var runtimeReady;
var parser;
var loaded;
var failed;
var init_loader = __esm({
  "src/ast/loader.ts"() {
    "use strict";
    init_web_tree_sitter();
    init_types();
    EXT_GRAMMAR = {
      ".ts": "typescript",
      ".mts": "typescript",
      ".cts": "typescript",
      ".tsx": "tsx",
      ".js": "javascript",
      ".jsx": "javascript",
      ".mjs": "javascript",
      ".cjs": "javascript",
      ".py": "python",
      ".pyi": "python",
      ".go": "go",
      ".rs": "rust",
      ".java": "java",
      ".rb": "ruby",
      ".rake": "ruby",
      ".c": "c",
      ".h": "c",
      ".cc": "cpp",
      ".cpp": "cpp",
      ".cxx": "cpp",
      ".hpp": "cpp",
      ".hh": "cpp",
      ".cs": "c_sharp",
      ".php": "php",
      ".scala": "scala",
      ".sc": "scala",
      ".sh": "bash",
      ".bash": "bash",
      ".lua": "lua"
    };
    runtimeReady = false;
    parser = null;
    loaded = /* @__PURE__ */ new Map();
    failed = /* @__PURE__ */ new Set();
  }
});
function collectRefIdents(root, defNames) {
  const found = /* @__PURE__ */ new Set();
  const visit = (node) => {
    if (node.namedChildCount === 0 && /identifier|constant|(^|_)name$/.test(node.type) && /^[A-Za-z_]\w{4,}$/.test(node.text) && !defNames.has(node.text)) {
      found.add(node.text);
    }
    for (let i2 = 0; i2 < node.namedChildCount; i2++) visit(node.namedChild(i2));
  };
  visit(root);
  return [...found].sort().slice(0, MAX_REF_IDENTS);
}
function firstLine(node) {
  const nl = node.text.indexOf("\n");
  return (nl === -1 ? node.text : node.text.slice(0, nl)).trim().slice(0, 200);
}
function nameOf(node) {
  const named = node.childForFieldName("name");
  if (named?.text) return named.text;
  let decl = node.childForFieldName("declarator");
  while (decl) {
    if (decl.namedChildCount === 0 && /(^|_)identifier$/.test(decl.type)) return decl.text;
    const next = decl.childForFieldName("declarator");
    if (!next || next === decl) break;
    decl = next;
  }
  for (let i2 = 0; i2 < node.namedChildCount; i2++) {
    const c2 = node.namedChild(i2);
    if (/(^|_)(identifier|name|constant)$/.test(c2.type)) return c2.text;
  }
  return void 0;
}
function collectImports(root, spec) {
  if (!spec.imports) return [];
  const out2 = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (s) => {
    const v = s.trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      out2.push({ kind: "import", spec: v });
    }
  };
  const visit = (node) => {
    const how = spec.imports[node.type];
    if (how === "string") {
      const str2 = findFirst(node, (n) => /string/.test(n.type));
      if (str2) add(str2.text.replace(/^['"]|['"]$/g, ""));
    } else if (how === "path") {
      const name2 = node.childForFieldName("name") ?? node.childForFieldName("module_name");
      add((name2 ?? node).text.replace(/^(import|from)\s+/, "").split(/\s+/)[0]);
    }
    for (let i2 = 0; i2 < node.namedChildCount; i2++) visit(node.namedChild(i2));
  };
  visit(root);
  return out2;
}
function findFirst(node, pred) {
  for (let i2 = 0; i2 < node.namedChildCount; i2++) {
    const c2 = node.namedChild(i2);
    if (pred(c2)) return c2;
    const deep = findFirst(c2, pred);
    if (deep) return deep;
  }
  return void 0;
}
function readName(node) {
  if (!node) return void 0;
  if (node.namedChildCount === 0) return IDENT_LEAF.test(node.type) ? node.text : void 0;
  const seg = node.childForFieldName("name") ?? node.childForFieldName("property") ?? node.childForFieldName("attribute") ?? node.childForFieldName("field") ?? // Callee wrappers that point at the real callee via a `function` field:
  // scala's generic_function (`foo[Int](x)`) and a curried/chained
  // call_expression callee (`curried(a)(b)`) — descend to the inner name
  // instead of tripping over type_arguments/arguments as the last child.
  node.childForFieldName("function");
  if (seg) return readName(seg);
  const last = node.namedChild(node.namedChildCount - 1);
  return last && last !== node ? readName(last) : void 0;
}
function readReceiver(node) {
  if (!node || node.namedChildCount === 0) return void 0;
  const obj = node.childForFieldName("object") ?? node.childForFieldName("operand") ?? node.childForFieldName("value") ?? node.childForFieldName("path") ?? node.childForFieldName("expression") ?? node.childForFieldName("argument") ?? node.childForFieldName("receiver") ?? node.childForFieldName("table");
  const name2 = obj ? readName(obj) : void 0;
  return name2 && /^[A-Za-z_]\w*$/.test(name2) ? name2 : void 0;
}
function collectCalls(root, spec, maxCalls = MAX_CALLS) {
  if (!spec.calls) return [];
  const out2 = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (name2, node, receiver) => {
    if (!name2 || name2.length < 2 || !/^[A-Za-z_]\w*$/.test(name2)) return;
    const line = node.startPosition.row + 1;
    const key = `${name2} ${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    out2.push(receiver ? { name: name2, line, receiver } : { name: name2, line });
  };
  const visit = (node) => {
    const how = spec.calls[node.type];
    if (how === "function") {
      const callee = node.childForFieldName("function") ?? node.childForFieldName("callee") ?? node.childForFieldName("method") ?? node.childForFieldName("name");
      add(readName(callee), node, readReceiver(callee) ?? readReceiver(node));
    } else if (how === "member") {
      add(readName(node.childForFieldName("name")), node, readReceiver(node));
    } else if (how === "constructor") {
      let t = node.childForFieldName("constructor") ?? node.childForFieldName("type") ?? node.childForFieldName("name");
      for (let i2 = 0; !t && i2 < node.namedChildCount; i2++) {
        const c2 = node.namedChild(i2);
        if (IDENT_LEAF.test(c2.type)) t = c2;
      }
      add(readName(t), node, readReceiver(t ?? null));
    }
    for (let i2 = 0; i2 < node.namedChildCount; i2++) visit(node.namedChild(i2));
  };
  visit(root);
  out2.sort((a, b) => byStr(a.name, b.name) || a.line - b.line);
  return out2.slice(0, maxCalls);
}
function collectImportedNames(root, spec) {
  if (!spec.imports?.import_statement) return [];
  const found = /* @__PURE__ */ new Set();
  const visit = (node) => {
    if (node.type === "import_statement") {
      for (let i2 = 0; i2 < node.namedChildCount; i2++) {
        const clause = node.namedChild(i2);
        if (clause.type !== "import_clause") continue;
        for (let j = 0; j < clause.namedChildCount; j++) {
          const named = clause.namedChild(j);
          if (named.type !== "named_imports") continue;
          for (let k = 0; k < named.namedChildCount; k++) {
            const specifier = named.namedChild(k);
            if (specifier.type !== "import_specifier") continue;
            const nm = specifier.childForFieldName("name") ?? specifier.namedChild(0);
            if (nm?.text) found.add(nm.text);
          }
        }
      }
    }
    for (let i2 = 0; i2 < node.namedChildCount; i2++) visit(node.namedChild(i2));
  };
  visit(root);
  return [...found].sort(byStr).slice(0, MAX_IMPORTED_NAMES);
}
function extractAst(rel, ext, content, opts = {}) {
  const key = grammarKeyForExt(ext);
  if (!key || !grammarReady(key)) return void 0;
  const spec = SPECS[key];
  if (!spec) return void 0;
  const parser2 = parserFor(key);
  if (!parser2) return void 0;
  let tree = null;
  try {
    tree = parser2.parse(content);
    if (!tree) return void 0;
    const symbols = [];
    const root = tree.rootNode;
    const stem = (rel.split("/").pop() ?? "").replace(/\.[^.]+$/, "");
    const exportedNames = /* @__PURE__ */ new Set();
    const walk22 = (node, parent, exported) => {
      const nowExported = exported || node.type === "export_statement";
      if (node.type === "export_statement") {
        for (let i2 = 0; i2 < node.namedChildCount; i2++) {
          const c2 = node.namedChild(i2);
          if (c2.type === "identifier") exportedNames.add(c2.text);
          else if (c2.type === "export_clause") {
            for (let j = 0; j < c2.namedChildCount; j++) {
              const spec2 = c2.namedChild(j);
              const nm = spec2.childForFieldName("name") ?? spec2.namedChild(0);
              if (nm?.text) exportedNames.add(nm.text);
            }
          }
        }
        if (stem && node.children.some((c2) => c2.type === "default")) {
          for (let i2 = 0; i2 < node.namedChildCount; i2++) {
            const c2 = node.namedChild(i2);
            const fnLike = ANON_DEFAULT_FN.has(c2.type);
            const classLike = ANON_DEFAULT_CLASS.has(c2.type);
            if ((fnLike || classLike) && !c2.childForFieldName("name")) {
              symbols.push({
                name: stem,
                kind: classLike ? "class" : "function",
                file: rel,
                line: node.startPosition.row + 1,
                endLine: node.endPosition.row + 1,
                signature: firstLine(node),
                exported: true,
                lang: spec.lang
              });
              break;
            }
          }
        }
      }
      if (spec.assignments && node.type === "expression_statement") {
        const expr = node.namedChild(0);
        if (expr?.type === "assignment_expression") {
          const left = expr.childForFieldName("left");
          const right = expr.childForFieldName("right");
          if (left?.type === "member_expression" && left.text === "module.exports" && right) {
            if (right.type === "object") {
              for (let i2 = 0; i2 < right.namedChildCount; i2++) {
                const p = right.namedChild(i2);
                if (p.type === "shorthand_property_identifier") exportedNames.add(p.text);
                else if (p.type === "pair") {
                  const k = p.childForFieldName("key");
                  const v = p.childForFieldName("value");
                  if (k?.type === "property_identifier") exportedNames.add(k.text);
                  if (v?.type === "identifier") exportedNames.add(v.text);
                }
              }
              return;
            }
            if (right.type === "identifier") {
              exportedNames.add(right.text);
              return;
            }
          }
          const funcy = right && ["function_expression", "function", "generator_function", "arrow_function", "class"].includes(right.type);
          if (left && right && funcy) {
            let name2;
            let exportedAssign = false;
            if (left.type === "member_expression") {
              const prop = left.childForFieldName("property");
              if (prop?.type === "property_identifier") {
                name2 = prop.text;
                const obj = left.text.slice(0, left.text.length - prop.text.length - 1);
                exportedAssign = obj === "exports" || obj === "module.exports";
              }
            } else if (left.type === "identifier") {
              name2 = left.text;
            }
            if (name2) {
              symbols.push({
                name: name2,
                kind: right.type === "class" ? "class" : "function",
                file: rel,
                line: expr.startPosition.row + 1,
                endLine: expr.endPosition.row + 1,
                ...parent ? { parent } : {},
                signature: firstLine(expr),
                exported: nowExported || exportedAssign,
                lang: spec.lang
              });
              return;
            }
          } else if (left?.type === "member_expression" && right) {
            const prop = left.childForFieldName("property");
            if (prop?.type === "property_identifier") {
              const obj = left.text.slice(0, left.text.length - prop.text.length - 1);
              if (obj === "exports" || obj === "module.exports") {
                if (right.type === "identifier") exportedNames.add(right.text);
                if (right.type !== "identifier" || right.text !== prop.text) {
                  symbols.push({
                    name: prop.text,
                    kind: "const",
                    file: rel,
                    line: expr.startPosition.row + 1,
                    endLine: expr.endPosition.row + 1,
                    ...parent ? { parent } : {},
                    signature: firstLine(expr),
                    exported: true,
                    lang: spec.lang
                  });
                }
                return;
              }
            }
          }
        }
      }
      if (spec.assignments && node.type === "assignment_statement") {
        const vars = node.children.find((c2) => c2.type === "variable_list");
        const vals = node.children.find((c2) => c2.type === "expression_list");
        const pairs = Math.min(vars?.namedChildCount ?? 0, vals?.namedChildCount ?? 0);
        for (let i2 = 0; i2 < pairs; i2++) {
          const target = vars.namedChild(i2);
          const value = vals.namedChild(i2);
          if (value.type !== "function_definition" || !/^[\w.:]+$/.test(target.text)) continue;
          symbols.push({
            name: target.text,
            kind: "function",
            file: rel,
            line: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
            ...parent ? { parent } : {},
            signature: firstLine(node),
            exported: nowExported || spec.exported(firstLine(node), target.text),
            lang: spec.lang
          });
        }
        return;
      }
      const kind = spec.defs[node.type];
      if (kind) {
        const name2 = nameOf(node);
        if (name2) {
          const line = firstLine(node);
          symbols.push({
            name: name2,
            kind,
            file: rel,
            line: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
            ...parent ? { parent } : {},
            signature: line,
            exported: nowExported || spec.exported(line, name2),
            lang: spec.lang
          });
          for (let i2 = 0; i2 < node.namedChildCount; i2++) {
            walkBody(node.namedChild(i2), name2, nowExported);
          }
          return;
        }
      }
      if (spec.containers.has(node.type)) {
        for (let i2 = 0; i2 < node.namedChildCount; i2++) walk22(node.namedChild(i2), parent, nowExported);
      }
    };
    const walkBody = (node, parent, exported) => {
      if (spec.containers.has(node.type)) {
        for (let i2 = 0; i2 < node.namedChildCount; i2++) walk22(node.namedChild(i2), parent, exported);
      }
    };
    walk22(root, void 0, false);
    if (exportedNames.size) {
      for (const s of symbols) if (!s.exported && exportedNames.has(s.name)) s.exported = true;
    }
    const refs = collectImports(root, spec);
    const idents = collectRefIdents(root, new Set(symbols.map((s) => s.name)));
    const calls = collectCalls(root, spec, opts.maxCalls);
    const importedNames = collectImportedNames(root, spec);
    let pkg;
    if (spec.lang === "java") {
      const p = findFirst(root, (n) => n.type === "package_declaration");
      if (p) pkg = p.text.replace(/^package\s+/, "").replace(/;.*$/, "").trim();
    }
    return { symbols, refs, pkg, idents, calls, importedNames };
  } catch {
    return void 0;
  } finally {
    tree?.delete();
  }
}
var MAX_REF_IDENTS;
var MAX_CALLS;
var MAX_IMPORTED_NAMES;
var ANON_DEFAULT_FN;
var ANON_DEFAULT_CLASS;
var byPublicKeyword;
var byNotPrivate;
var byNotLocal;
var byPub;
var byCapital;
var byPyConvention;
var always;
var neverExport;
var TS_SPEC;
var SPECS;
var IDENT_LEAF;
var init_extract = __esm({
  "src/ast/extract.ts"() {
    "use strict";
    init_sort();
    init_loader();
    MAX_REF_IDENTS = 256;
    MAX_CALLS = 512;
    MAX_IMPORTED_NAMES = 256;
    ANON_DEFAULT_FN = /* @__PURE__ */ new Set([
      "function",
      "function_expression",
      "function_declaration",
      "generator_function",
      "generator_function_declaration",
      "arrow_function"
    ]);
    ANON_DEFAULT_CLASS = /* @__PURE__ */ new Set(["class", "class_declaration", "abstract_class_declaration"]);
    byPublicKeyword = (line) => /\b(public|internal)\b/.test(line);
    byNotPrivate = (line) => !/\b(private|protected)\b/.test(line);
    byNotLocal = (line) => !/^local\b/.test(line);
    byPub = (line) => /\bpub\b/.test(line);
    byCapital = (_l, name2) => /^[A-Z]/.test(name2);
    byPyConvention = (_l, name2) => !name2.startsWith("_") || /^__\w+__$/.test(name2);
    always = () => true;
    neverExport = () => false;
    TS_SPEC = {
      lang: "typescript",
      defs: {
        function_declaration: "function",
        generator_function_declaration: "function",
        class_declaration: "class",
        abstract_class_declaration: "class",
        interface_declaration: "interface",
        type_alias_declaration: "type",
        enum_declaration: "enum",
        method_definition: "method",
        variable_declarator: "const"
      },
      containers: /* @__PURE__ */ new Set(["class_body", "export_statement", "program", "lexical_declaration", "variable_declaration"]),
      exported: neverExport,
      // export is tracked structurally via export_statement; see walk
      imports: { import_statement: "string" },
      calls: { call_expression: "function", new_expression: "constructor" },
      assignments: true
    };
    SPECS = {
      typescript: TS_SPEC,
      tsx: { ...TS_SPEC, lang: "typescript" },
      javascript: {
        ...TS_SPEC,
        lang: "javascript",
        defs: {
          function_declaration: "function",
          generator_function_declaration: "function",
          class_declaration: "class",
          method_definition: "method",
          variable_declarator: "const"
        }
      },
      python: {
        lang: "python",
        defs: { function_definition: "function", class_definition: "class" },
        containers: /* @__PURE__ */ new Set(["block", "decorated_definition", "module"]),
        exported: byPyConvention,
        imports: { import_statement: "path", import_from_statement: "path" },
        calls: { call: "function" }
      },
      go: {
        lang: "go",
        defs: {
          function_declaration: "function",
          method_declaration: "method",
          type_spec: "type",
          const_spec: "const",
          var_spec: "var"
        },
        containers: /* @__PURE__ */ new Set(["type_declaration", "const_declaration", "var_declaration", "source_file"]),
        exported: byCapital,
        imports: { import_declaration: "string" },
        calls: { call_expression: "function" }
      },
      ruby: {
        lang: "ruby",
        defs: { method: "def", singleton_method: "def", class: "class", module: "module" },
        containers: /* @__PURE__ */ new Set(["class", "module", "body_statement", "program"]),
        exported: always,
        // Ruby models every invocation — dotted, parenthesized, or bare command form
        // (`puts "x"`) — as a `call` node whose callee is the `method` field.
        calls: { call: "function" }
      },
      java: {
        lang: "java",
        defs: {
          class_declaration: "class",
          interface_declaration: "interface",
          enum_declaration: "enum",
          record_declaration: "record",
          method_declaration: "method",
          constructor_declaration: "constructor"
        },
        containers: /* @__PURE__ */ new Set(["class_body", "interface_body", "enum_body", "program"]),
        exported: byPublicKeyword,
        imports: { import_declaration: "path" },
        calls: { method_invocation: "function", object_creation_expression: "constructor" }
      },
      rust: {
        lang: "rust",
        defs: {
          function_item: "function",
          struct_item: "struct",
          enum_item: "enum",
          trait_item: "trait",
          type_item: "type",
          mod_item: "mod",
          const_item: "const",
          static_item: "static",
          union_item: "union",
          macro_definition: "macro"
        },
        containers: /* @__PURE__ */ new Set(["impl_item", "declaration_list", "source_file"]),
        exported: byPub,
        calls: { call_expression: "function" }
      },
      c_sharp: {
        lang: "csharp",
        defs: {
          class_declaration: "class",
          interface_declaration: "interface",
          struct_declaration: "struct",
          enum_declaration: "enum",
          record_declaration: "record",
          method_declaration: "method",
          constructor_declaration: "constructor",
          property_declaration: "property"
        },
        containers: /* @__PURE__ */ new Set(["namespace_declaration", "declaration_list", "compilation_unit", "file_scoped_namespace_declaration"]),
        exported: byPublicKeyword,
        calls: { invocation_expression: "function", object_creation_expression: "constructor" }
      },
      php: {
        lang: "php",
        defs: {
          function_definition: "function",
          class_declaration: "class",
          interface_declaration: "interface",
          trait_declaration: "trait",
          enum_declaration: "enum",
          method_declaration: "method"
        },
        containers: /* @__PURE__ */ new Set(["declaration_list", "program"]),
        exported: always,
        calls: { function_call_expression: "function", member_call_expression: "member", object_creation_expression: "constructor" }
      },
      c: {
        lang: "c",
        defs: {
          function_definition: "function",
          struct_specifier: "struct",
          enum_specifier: "enum",
          union_specifier: "union",
          type_definition: "type"
        },
        // C has no visibility keyword — headers are the interface, so everything
        // counts as exported (same stance as the regex extractor).
        containers: /* @__PURE__ */ new Set(["translation_unit", "declaration_list", "linkage_specification", "preproc_ifdef", "preproc_if"]),
        exported: always,
        calls: { call_expression: "function" }
      },
      cpp: {
        lang: "cpp",
        defs: {
          function_definition: "function",
          class_specifier: "class",
          struct_specifier: "struct",
          enum_specifier: "enum",
          union_specifier: "union",
          type_definition: "type",
          namespace_definition: "namespace"
        },
        containers: /* @__PURE__ */ new Set([
          "translation_unit",
          "declaration_list",
          "field_declaration_list",
          "template_declaration",
          "linkage_specification",
          "preproc_ifdef",
          "preproc_if"
        ]),
        exported: always,
        calls: { call_expression: "function", new_expression: "constructor" }
      },
      scala: {
        lang: "scala",
        defs: {
          class_definition: "class",
          object_definition: "object",
          trait_definition: "trait",
          enum_definition: "enum",
          function_definition: "def",
          function_declaration: "def",
          val_definition: "val",
          var_definition: "var",
          type_definition: "type",
          given_definition: "given"
        },
        // package_clause carries braced-package bodies (`package com.acme { … }`);
        // template_body is every class/object/trait body.
        containers: /* @__PURE__ */ new Set(["compilation_unit", "package_clause", "template_body"]),
        exported: byNotPrivate,
        // Qualified calls are call_expression → field_expression (value/field);
        // `new Widget(...)` is an instance_expression with a bare type child.
        calls: { call_expression: "function", instance_expression: "constructor" }
      },
      bash: {
        lang: "shell",
        defs: { function_definition: "function" },
        // if/compound bodies carry guarded definitions (`if …; then f() { … }; fi`).
        containers: /* @__PURE__ */ new Set(["program", "if_statement", "compound_statement"]),
        // Shell has no visibility — every function is callable from outside.
        exported: always,
        // Every invocation is a `command` whose `name` field is a command_name
        // wrapping a `word` leaf (hence IDENT_LEAF includes `word`).
        calls: { command: "function" }
      },
      lua: {
        lang: "lua",
        defs: { function_declaration: "function" },
        // variable_declaration wraps `local x = function()` assignment statements.
        containers: /* @__PURE__ */ new Set(["chunk", "variable_declaration"]),
        exported: byNotLocal,
        // function_call's `name` is an identifier, a dot_index_expression
        // (table/field) or a method_index_expression (table/method) — the receiver
        // is the `table` field in both qualified forms.
        calls: { function_call: "function" },
        assignments: true
        // `M.alias = function(z) … end` (assignment_statement shape)
      }
    };
    IDENT_LEAF = /(^|_)(identifier|name|constant|word)$/;
  }
});
function isDirective(line) {
  return DIRECTIVE_RE.test(line.trim());
}
function isBanner(line) {
  return BANNER_RE.test(line.trim());
}
function topDocComment(content) {
  const lines = content.split(/\r?\n/);
  const collected = [];
  let inBlock = null;
  for (let i2 = 0; i2 < Math.min(lines.length, 40); i2++) {
    const raw = lines[i2];
    const line = raw.trim();
    if (inBlock === "c") {
      collected.push(line.replace(/\*+\/\s*$/, "").replace(/^\*+/, "").trim());
      if (line.includes("*/")) inBlock = null;
      continue;
    }
    if (inBlock === "py") {
      if (line.includes('"""') || line.includes("'''")) {
        collected.push(line.replace(/['"]{3}.*$/, "").trim());
        inBlock = null;
      } else collected.push(line);
      continue;
    }
    if (line === "" && collected.length === 0) continue;
    if (line.startsWith("#!")) continue;
    if (line.startsWith("//")) {
      collected.push(line.replace(/^\/+/, "").trim());
      continue;
    }
    if (line.startsWith("#")) {
      collected.push(line.replace(/^#+/, "").trim());
      continue;
    }
    if (line.startsWith("/*")) {
      collected.push(line.replace(/^\/\*+!?/, "").replace(/\*+\/\s*$/, "").trim());
      if (!line.includes("*/")) inBlock = "c";
      continue;
    }
    if (line.startsWith('"""') || line.startsWith("'''")) {
      const rest = line.slice(3);
      if (rest.includes('"""') || rest.includes("'''")) collected.push(rest.replace(/['"]{3}.*$/, "").trim());
      else {
        collected.push(rest.trim());
        inBlock = "py";
      }
      continue;
    }
    break;
  }
  const text = collected.filter((l) => l && !isDirective(l) && !isBanner(l)).join(" ").replace(/\s+/g, " ").trim();
  if (text.length < 8) return void 0;
  const sentence = /^(.*?[.!?])(\s|$)/.exec(text);
  return (sentence ? sentence[1] : text).slice(0, 200);
}
function expandUseGroups(path, out2 = []) {
  if (out2.length >= MAX_USE_EXPANSION) return out2;
  const brace = path.indexOf("{");
  if (brace === -1) {
    const cleaned = path.replace(/\s+as\s+\w+\s*$/, "").replace(/::\s*\*\s*$/, "").replace(/^::/, "").trim();
    if (cleaned) out2.push(cleaned);
    return out2;
  }
  const prefix = path.slice(0, brace);
  let depth = 0;
  let end = -1;
  for (let i2 = brace; i2 < path.length; i2++) {
    if (path[i2] === "{") depth++;
    else if (path[i2] === "}" && --depth === 0) {
      end = i2;
      break;
    }
  }
  if (end === -1) return out2;
  const parts2 = [];
  let cur = "";
  depth = 0;
  for (const ch of path.slice(brace + 1, end)) {
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (ch === "," && depth === 0) {
      parts2.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts2.push(cur);
  for (const part of parts2) {
    const t = part.trim();
    if (!t) continue;
    if (t === "self") expandUseGroups(prefix.replace(/::\s*$/, ""), out2);
    else expandUseGroups(prefix + t, out2);
  }
  return out2;
}
function extractImports(ext, content) {
  const specs = /* @__PURE__ */ new Set();
  const lines = content.split(/\r?\n/);
  if (JS_TS.has(ext)) {
    let m;
    const from = /(?:^|[^\w$.])(?:import|export)\b[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g;
    while (m = from.exec(content)) specs.add(m[1]);
    const bare = /(?:^|[\n;])\s*import\s*['"]([^'"]+)['"]/g;
    while (m = bare.exec(content)) specs.add(m[1]);
    const req = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
    while (m = req.exec(content)) specs.add(m[1]);
    const dyn = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
    while (m = dyn.exec(content)) specs.add(m[1]);
  } else if (PY.has(ext)) {
    for (const line of lines) {
      const from = /^\s*from\s+(\.*[\w.]*)\s+import\b/.exec(line);
      if (from) {
        specs.add(from[1]);
        continue;
      }
      const imp = /^\s*import\s+(.+)$/.exec(line);
      if (imp) {
        for (const part of imp[1].split(",")) {
          const name2 = part.trim().split(/\s+as\s+/)[0].trim();
          if (name2 && /^[\w.]+$/.test(name2)) specs.add(name2);
        }
      }
    }
  } else if (ext === ".go") {
    let inBlock = false;
    for (const line of lines) {
      const t = line.trim();
      if (inBlock) {
        if (t === ")") {
          inBlock = false;
          continue;
        }
        const b = /"([^"]+)"/.exec(t);
        if (b) specs.add(b[1]);
        continue;
      }
      if (/^import\s*\($/.test(t)) {
        inBlock = true;
        continue;
      }
      const single = /^import\s+(?:[\w.]+\s+)?"([^"]+)"/.exec(t);
      if (single) specs.add(single[1]);
    }
  } else if (ext === ".rs") {
    let m;
    const modRe = /^\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+([A-Za-z_]\w*)\s*;/gm;
    while (m = modRe.exec(content)) specs.add(`mod ${m[1]}`);
    const useRe = /^\s*(?:pub(?:\([^)]*\))?\s+)?use\s+([^;]+);/gm;
    while (m = useRe.exec(content)) {
      for (const p of expandUseGroups(m[1].trim())) specs.add(p);
    }
  } else if (ext === ".java") {
    let m;
    const imp = /^\s*import\s+(?:static\s+)?([\w.]+(?:\.\*)?)\s*;/gm;
    while (m = imp.exec(content)) specs.add(m[1]);
  } else if (ext === ".rb" || ext === ".rake") {
    let m;
    const rel = /^\s*require_relative\s+['"]([^'"]+)['"]/gm;
    while (m = rel.exec(content)) specs.add(/^\.\.?\//.test(m[1]) ? m[1] : "./" + m[1]);
    const req = /^\s*require\s+['"]([^'"]+)['"]/gm;
    while (m = req.exec(content)) specs.add(m[1]);
  } else if (C_CPP.has(ext)) {
    let m;
    const inc = /^\s*#\s*include\s*"([^"]+)"/gm;
    while (m = inc.exec(content)) specs.add(m[1]);
  } else if (ext === ".php") {
    let m;
    const use = /^\s*use\s+(?:function\s+|const\s+)?\\?([A-Za-z_][\w\\]*)\s*(?:as\s+\w+)?\s*;/gm;
    while (m = use.exec(content)) specs.add(m[1]);
    const inc = /\b(?:require|include)(?:_once)?\s*\(?\s*['"]([^'"]+)['"]/g;
    while (m = inc.exec(content)) specs.add(/^\.\.?\//.test(m[1]) ? m[1] : "./" + m[1]);
  } else if (ext === ".cs") {
    let m;
    const using = /^\s*(?:global\s+)?using\s+(?:static\s+)?([A-Za-z_][\w.]*)\s*;/gm;
    while (m = using.exec(content)) specs.add(m[1]);
  }
  return [...specs].map((spec) => ({ kind: "import", spec }));
}
function collectCallsRegex(content, symbols = [], maxCalls = 512) {
  const out2 = /* @__PURE__ */ new Map();
  const ownDefLines = new Set(symbols.map((s) => `${s.name} ${s.line}`));
  const lines = content.split("\n");
  const CALL_RE = /(?:\bnew\s+)?(?:([A-Za-z_$][\w$]*)\s*\.\s*)?([A-Za-z_$][\w$]*)\s*\(/g;
  for (let i2 = 0; i2 < lines.length && out2.size < maxCalls; i2++) {
    const line = lines[i2];
    const trimmed = line.trimStart();
    if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*")) continue;
    CALL_RE.lastIndex = 0;
    let probe;
    const introducerCaught = /* @__PURE__ */ new Set();
    while ((probe = CALL_RE.exec(line)) !== null) {
      const name2 = probe[2];
      const key = `${name2} ${i2 + 1}`;
      if (ownDefLines.has(key) && DEF_INTRODUCERS.test(line.slice(0, probe.index))) introducerCaught.add(key);
    }
    CALL_RE.lastIndex = 0;
    let m;
    const fallbackExcluded = /* @__PURE__ */ new Set();
    while ((m = CALL_RE.exec(line)) !== null && out2.size < maxCalls) {
      const receiver = m[1];
      const name2 = m[2];
      if (name2.length < 2 || CALL_KEYWORDS.has(name2)) continue;
      if (DEF_INTRODUCERS.test(line.slice(0, m.index))) continue;
      const key = `${name2} ${i2 + 1}`;
      if (ownDefLines.has(key) && !introducerCaught.has(key)) {
        if (!fallbackExcluded.has(key)) {
          fallbackExcluded.add(key);
          continue;
        }
      }
      if (!out2.has(key)) out2.set(key, receiver ? { name: name2, line: i2 + 1, receiver } : { name: name2, line: i2 + 1 });
    }
  }
  return [...out2.values()].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : a.line - b.line);
}
function extractCode(rel, ext, content, opts = {}) {
  const ast = extractAst(rel, ext, content, { maxCalls: opts.maxCallsPerFile });
  const symbols = (ast ? ast.symbols : extractSymbols(rel, ext, content)).slice(0, 400);
  const known = new Set(symbols.map((s) => s.name));
  const reexports = extractReexports(rel, content, symbols).filter((s) => !known.has(s.name));
  return {
    symbols: [...symbols, ...reexports],
    summary: topDocComment(content),
    refs: extractImports(ext, content),
    // pkg anchors namespace→source-root resolution: Java's `package`, C#'s
    // `namespace` (block or file-scoped). Both feed the same resolver pattern.
    pkg: ext === ".java" ? /^\s*package\s+([\w.]+)\s*;/m.exec(content)?.[1] : ext === ".cs" ? /^\s*(?:file-scoped\s+)?namespace\s+([\w.]+)/m.exec(content)?.[1] : void 0,
    idents: ast?.idents,
    // AST call sites when a grammar parsed the file; the conservative regex
    // collector otherwise, so caller indexes exist without the wasm sidecar.
    // `symbols` (this file's own regex-extracted defs) lets the collector
    // exclude a definition's own name+line from its call candidates.
    calls: ast ? ast.calls : collectCallsRegex(content, symbols, opts.maxCallsPerFile),
    importedNames: ast?.importedNames
  };
}
var JS_TS;
var PY;
var C_CPP;
var DIRECTIVE_RE;
var BANNER_RE;
var MAX_USE_EXPANSION;
var CALL_KEYWORDS;
var DEF_INTRODUCERS;
var init_code = __esm({
  "src/extract/code.ts"() {
    "use strict";
    init_registry();
    init_extract();
    init_common();
    JS_TS = /* @__PURE__ */ new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
    PY = /* @__PURE__ */ new Set([".py", ".pyi"]);
    C_CPP = /* @__PURE__ */ new Set([".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".hh"]);
    DIRECTIVE_RE = /^(eslint\b|eslint-|prettier\b|prettier-|tslint\b|jshint\b|jslint\b|globals?\b|istanbul\b|c8\s|v8\s|@ts-|ts-|@flow\b|@jsx\b|@jsxRuntime\b|@jest-environment\b|@vitest-environment\b|@license\b|@preserve\b|@copyright\b|copyright\b|spdx-|<reference\b|use strict|biome-|deno-lint|noqa\b|type:\s*ignore|pylint:|flake8:|mypy:|coding[:=])/i;
    BANNER_RE = /^((?:mit|isc|bsd|apache|gnu|gpl|mpl|lgpl|agpl)\s+licen[sc]ed?\b|licen[sc]ed\b|(?:released|distributed)\s+under\b|all rights reserved\b|https?:\/\/|www\.)/i;
    MAX_USE_EXPANSION = 16;
    CALL_KEYWORDS = /* @__PURE__ */ new Set([
      "if",
      "else",
      "elif",
      "for",
      "while",
      "do",
      "switch",
      "case",
      "match",
      "when",
      "unless",
      "until",
      "catch",
      "except",
      "return",
      "throw",
      "raise",
      "yield",
      "await",
      "typeof",
      "instanceof",
      "sizeof",
      "delete",
      "void",
      "in",
      "of",
      "not",
      "and",
      "or",
      "assert",
      "defer",
      "select",
      "with",
      "loop"
    ]);
    DEF_INTRODUCERS = /(?:\bfunction|\bdef|\bfunc|\bfun|\bfn|\bclass|\bsub|\bmacro|\bproc)\s*[*]?\s*$/;
  }
});
function countLines(s) {
  if (!s) return 0;
  let n = 1;
  for (let i2 = 0; i2 < s.length; i2++) if (s.charCodeAt(i2) === 10) n++;
  return n;
}
function scanRepo(root, opts = {}) {
  const scoped = opts.scope ? [...opts.include ?? [], `${opts.scope.replace(/\/+$/, "")}/**`] : opts.include;
  const include = compileGlobs(scoped);
  const exclude = compileGlobs(opts.exclude);
  const { files: walked, capped, excluded } = opts.precomputedWalk ?? walk(root, {
    maxFileBytes: opts.maxBytes,
    maxFiles: opts.maxFiles,
    gitignore: opts.gitignore,
    ignoreDirs: opts.ignoreDirs
  });
  const outPrefix = opts.out ? opts.out.replace(/\/+$/, "") + "/" : null;
  const files = [];
  const languages = {};
  const docText = /* @__PURE__ */ new Map();
  const mtimes = /* @__PURE__ */ new Map();
  const cache = opts.cache;
  let allReused = cache !== void 0;
  let cacheDirty = cache === void 0;
  for (const f of walked) {
    if (outPrefix && (f.abs === opts.out || f.abs.startsWith(outPrefix))) continue;
    if (include && !include(f.rel)) continue;
    if (exclude && exclude(f.rel)) continue;
    const kind = classify(f.rel, f.ext);
    const lang = extToLang(f.ext);
    languages[lang] = (languages[lang] ?? 0) + 1;
    mtimes.set(f.rel, f.mtimeMs);
    const cached = opts.cache?.get(f.rel);
    if (kind !== "doc" && !opts.fullHash && cached && cached.size !== void 0 && cached.mtimeMs !== void 0 && cached.size === f.size && cached.mtimeMs === f.mtimeMs) {
      files.push(cached.record);
      continue;
    }
    const content = readText(f.abs);
    const hash = sha1(content);
    if (cached && cached.hash === hash) {
      files.push(cached.record);
      if (kind === "doc" && content) docText.set(f.rel, content);
      if (cached.size !== f.size || cached.mtimeMs !== f.mtimeMs) cacheDirty = true;
      continue;
    }
    allReused = false;
    cacheDirty = true;
    const record = {
      rel: f.rel,
      ext: f.ext,
      size: f.size,
      lines: countLines(content),
      hash,
      kind,
      lang,
      headings: [],
      symbols: [],
      refs: []
    };
    if (content) {
      if (kind === "doc" && MARKDOWN_EXT.has(f.ext)) {
        const md = extractMarkdown(content);
        record.title = md.title ?? basename(f.rel);
        record.summary = md.summary;
        record.headings = md.headings;
        record.refs = md.refs;
      } else if (kind === "doc") {
        record.title = basename(f.rel);
      } else if (kind === "code") {
        const code = extractCode(f.rel, f.ext, content, { maxCallsPerFile: opts.maxCallsPerFile });
        record.title = basename(f.rel);
        record.summary = code.summary;
        record.symbols = code.symbols;
        record.refs = code.refs;
        record.pkg = code.pkg;
        record.idents = code.idents;
        record.calls = code.calls;
        record.importedNames = code.importedNames;
      } else {
        record.title = basename(f.rel);
      }
    } else {
      record.title = basename(f.rel);
    }
    if (kind === "doc" && content) docText.set(f.rel, content);
    files.push(record);
  }
  files.sort(byKey((f) => f.rel));
  if (cache !== void 0 && files.length !== cache.size) {
    allReused = false;
    cacheDirty = true;
  }
  return {
    root,
    commit: headCommit(root),
    files,
    languages,
    docText,
    mtimes,
    capped,
    excluded,
    contentUnchanged: allReused,
    cacheDirty
  };
}
var init_scan = __esm({
  "src/scan.ts"() {
    "use strict";
    init_walk();
    init_git();
    init_hash();
    init_classify();
    init_registry();
    init_glob();
    init_sort();
    init_markdown();
    init_code();
  }
});
function distToSrcCandidates(target) {
  const segs = norm(target).split("/").filter((s) => s !== ".");
  const out2 = [];
  let i2 = 0;
  while (i2 < segs.length - 1 && BUILD_DIRS.has(segs[i2])) {
    i2++;
    const rest = segs.slice(i2).join("/");
    out2.push("src/" + rest, rest);
  }
  return out2;
}
function norm(p) {
  return posix.normalize(p).replace(/\/$/, "");
}
function firstThat(fileSet, candidates) {
  for (const c2 of candidates) {
    const n = norm(c2);
    if (fileSet.has(n)) return n;
  }
  return void 0;
}
function byLen(a, b) {
  return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}
function tolerantJsonParse(text) {
  let stripped = "";
  let inStr = false;
  for (let i2 = 0; i2 < text.length; i2++) {
    const c2 = text[i2];
    if (inStr) {
      stripped += c2;
      if (c2 === "\\") stripped += text[++i2] ?? "";
      else if (c2 === '"') inStr = false;
      continue;
    }
    if (c2 === '"') {
      inStr = true;
      stripped += c2;
    } else if (c2 === "/" && text[i2 + 1] === "/") {
      while (i2 < text.length && text[i2] !== "\n") i2++;
      stripped += "\n";
    } else if (c2 === "/" && text[i2 + 1] === "*") {
      i2 += 2;
      while (i2 < text.length && !(text[i2] === "*" && text[i2 + 1] === "/")) i2++;
      i2++;
    } else {
      stripped += c2;
    }
  }
  let out2 = "";
  inStr = false;
  for (let i2 = 0; i2 < stripped.length; i2++) {
    const c2 = stripped[i2];
    if (inStr) {
      out2 += c2;
      if (c2 === "\\") out2 += stripped[++i2] ?? "";
      else if (c2 === '"') inStr = false;
      continue;
    }
    if (c2 === '"') {
      inStr = true;
      out2 += c2;
      continue;
    }
    if (c2 === ",") {
      let j = i2 + 1;
      while (j < stripped.length && (stripped[j] === " " || stripped[j] === "	" || stripped[j] === "\n" || stripped[j] === "\r")) j++;
      if (stripped[j] === "}" || stripped[j] === "]") continue;
    }
    out2 += c2;
  }
  try {
    return JSON.parse(out2);
  } catch {
    return void 0;
  }
}
function resolveExtends(fileSet, fromDir, ext) {
  const base = norm(posix.join(fromDir, ext));
  const cands = ext.endsWith(".json") ? [base] : [base + ".json", posix.join(base, "tsconfig.json")];
  for (const c2 of cands) if (fileSet.has(c2)) return c2;
  return void 0;
}
function readTsConfig(root, fileSet, rel, warnings, seen) {
  if (seen.has(rel)) return void 0;
  seen.add(rel);
  const cfg = tolerantJsonParse(readText(join4(root, rel)));
  if (cfg === void 0) {
    warnings.push(`unparseable ${rel} \u2014 its path aliases were ignored`);
    return void 0;
  }
  const dir = rel.includes("/") ? posix.dirname(rel) : "";
  const eff = { baseUrlDir: "", pathsDir: "" };
  const exts = cfg.extends === void 0 ? [] : Array.isArray(cfg.extends) ? cfg.extends : [cfg.extends];
  for (const ext of exts) {
    if (typeof ext !== "string") continue;
    const baseRel = resolveExtends(fileSet, dir, ext);
    if (!baseRel) {
      if (/^\.\.?\//.test(ext)) warnings.push(`${rel} extends "${ext}" which is missing \u2014 its path aliases were ignored`);
      continue;
    }
    const inherited = readTsConfig(root, fileSet, baseRel, warnings, seen);
    if (inherited?.baseUrl !== void 0) {
      eff.baseUrl = inherited.baseUrl;
      eff.baseUrlDir = inherited.baseUrlDir;
    }
    if (inherited?.paths) {
      eff.paths = inherited.paths;
      eff.pathsDir = inherited.pathsDir;
    }
  }
  const co = cfg.compilerOptions;
  if (co?.baseUrl !== void 0) {
    eff.baseUrl = co.baseUrl;
    eff.baseUrlDir = dir;
  }
  if (co?.paths) {
    eff.paths = co.paths;
    eff.pathsDir = dir;
  }
  return eff;
}
function conditionRank(key) {
  const i2 = CONDITION_PRIORITY.indexOf(key);
  if (i2 !== -1) return i2;
  return key === "types" ? CONDITION_PRIORITY.length + 1 : CONDITION_PRIORITY.length;
}
function flattenExportTargets(value, out2) {
  if (out2.length >= MAX_EXPORT_TARGETS) return;
  if (typeof value === "string") {
    if (!out2.includes(value)) out2.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) flattenExportTargets(v, out2);
  } else if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort((a, b) => conditionRank(a) - conditionRank(b) || (a < b ? -1 : a > b ? 1 : 0));
    for (const k of keys) flattenExportTargets(value[k], out2);
  }
}
function parseExportEntries(exportsField) {
  if (exportsField === void 0 || exportsField === null) return [];
  const entries = [];
  const push = (key, value) => {
    const targets = [];
    flattenExportTargets(value, targets);
    if (targets.length) entries.push({ key, star: key.includes("*"), targets });
  };
  if (typeof exportsField === "string" || Array.isArray(exportsField)) {
    push(".", exportsField);
  } else if (typeof exportsField === "object") {
    const keys = Object.keys(exportsField);
    if (keys.every((k) => k === "." || k.startsWith("./"))) {
      for (const k of keys) push(k, exportsField[k]);
    } else {
      push(".", exportsField);
    }
  }
  entries.sort((a, b) => Number(a.star) - Number(b.star) || b.key.length - a.key.length || (a.key < b.key ? -1 : 1));
  return entries;
}
function parseGoReplaces(text, modDir) {
  const out2 = [];
  const addLine = (line) => {
    const m = /^\s*([^\s=]+)(?:\s+v\S+)?\s*=>\s*(\S+)(?:\s+v\S+)?\s*$/.exec(line);
    if (!m) return;
    const target = m[2];
    if (!/^\.\.?\//.test(target)) return;
    const toDir = norm(posix.join(modDir, target));
    if (toDir.startsWith("..")) return;
    out2.push({ from: m[1], toDir });
  };
  for (const m of text.matchAll(/^[ \t]*replace[ \t]+([^(\r\n][^\r\n]*)$/gm)) addLine(m[1]);
  for (const b of text.matchAll(/^[ \t]*replace[ \t]*\(([\s\S]*?)\)/gm)) {
    for (const line of b[1].split(/\r?\n/)) addLine(line);
  }
  return out2;
}
function buildResolveContext(scan2) {
  const fileSet = new Set(scan2.files.map((f) => f.rel));
  const filesByDir = /* @__PURE__ */ new Map();
  const dirSet = /* @__PURE__ */ new Set();
  for (const f of scan2.files) {
    const dir = f.rel.includes("/") ? posix.dirname(f.rel) : "";
    let list = filesByDir.get(dir);
    if (!list) filesByDir.set(dir, list = []);
    list.push(f.rel);
    let d = dir;
    while (d) {
      if (dirSet.has(d)) break;
      dirSet.add(d);
      d = d.includes("/") ? posix.dirname(d) : "";
    }
  }
  const warnings = [];
  const tsConfigs = [];
  for (const rel of fileSet) {
    const base = rel.slice(rel.lastIndexOf("/") + 1);
    const isRootBase = rel === "tsconfig.base.json";
    if (base !== "tsconfig.json" && base !== "jsconfig.json" && !isRootBase) continue;
    const dir = rel.includes("/") ? posix.dirname(rel) : "";
    const eff = readTsConfig(scan2.root, fileSet, rel, warnings, /* @__PURE__ */ new Set());
    if (!eff?.paths) continue;
    const tsPaths = [];
    for (const [alias, targets] of Object.entries(eff.paths)) {
      if (!Array.isArray(targets)) continue;
      const star = alias.endsWith("*");
      tsPaths.push({ prefix: star ? alias.slice(0, -1) : alias, star, targets });
    }
    if (!tsPaths.length) continue;
    const baseUrl = eff.baseUrl !== void 0 ? norm(posix.join(eff.baseUrlDir, eff.baseUrl)).replace(/^\.$/, "") : eff.pathsDir;
    tsConfigs.push({ dir, baseUrl, paths: tsPaths });
  }
  tsConfigs.sort((a, b) => b.dir.length - a.dir.length);
  const goModules = [];
  for (const rel of fileSet) {
    if (rel !== "go.mod" && !rel.endsWith("/go.mod")) continue;
    const text = readText(join4(scan2.root, rel));
    const m = /^\s*module\s+(\S+)/m.exec(text);
    if (!m) continue;
    const dir = rel.includes("/") ? posix.dirname(rel) : "";
    goModules.push({ module: m[1], dir, replaces: parseGoReplaces(text, dir) });
  }
  goModules.sort((a, b) => b.dir.length - a.dir.length || (a.dir < b.dir ? -1 : 1));
  const rustCrates = [];
  for (const rel of fileSet) {
    if (rel !== "Cargo.toml" && !rel.endsWith("/Cargo.toml")) continue;
    const text = readText(join4(scan2.root, rel));
    const m = /\[package\][^[]*?^\s*name\s*=\s*"([^"]+)"/ms.exec(text);
    if (!m) continue;
    const dir = rel.includes("/") ? posix.dirname(rel) : "";
    const srcDir = norm(posix.join(dir, "src")).replace(/^\.$/, "");
    const rootFile = firstThat(fileSet, [posix.join(srcDir, "lib.rs"), posix.join(srcDir, "main.rs")]);
    rustCrates.push({ name: m[1].replace(/-/g, "_"), dir, srcDir, rootFile });
  }
  rustCrates.sort((a, b) => b.dir.length - a.dir.length || (a.dir < b.dir ? -1 : 1));
  const javaRoots = /* @__PURE__ */ new Set();
  for (const f of scan2.files) {
    if (f.ext !== ".java" || !f.pkg) continue;
    const dir = f.rel.includes("/") ? posix.dirname(f.rel) : "";
    const pkgPath = f.pkg.replace(/\./g, "/");
    if (dir === pkgPath) javaRoots.add("");
    else if (dir.endsWith("/" + pkgPath)) javaRoots.add(dir.slice(0, -pkgPath.length - 1));
  }
  const pyRoots = /* @__PURE__ */ new Set([""]);
  for (const rel of fileSet) {
    const base = rel.split("/").pop();
    if (base === "__init__.py" || base === "pyproject.toml" || base === "setup.py") {
      pyRoots.add(rel.includes("/") ? posix.dirname(rel) : "");
    }
  }
  const workspacePackages = [];
  for (const rel of fileSet) {
    if (rel !== "package.json" && !rel.endsWith("/package.json")) continue;
    const pkg = tolerantJsonParse(readText(join4(scan2.root, rel)));
    if (pkg === void 0) {
      warnings.push(`unparseable ${rel} \u2014 skipped for workspace resolution`);
      continue;
    }
    if (typeof pkg.name !== "string") continue;
    const mainCandidates = [pkg.source, pkg.main, pkg.module, pkg.types].filter(
      (v) => typeof v === "string"
    );
    workspacePackages.push({
      name: pkg.name,
      dir: rel.includes("/") ? posix.dirname(rel) : "",
      exportEntries: parseExportEntries(pkg.exports),
      mainCandidates
    });
  }
  workspacePackages.sort((a, b) => b.name.length - a.name.length);
  const cIncludeRoots = /* @__PURE__ */ new Set([""]);
  for (const d of dirSet) {
    const base = d.slice(d.lastIndexOf("/") + 1);
    if (base === "include" || base === "inc" || base === "src") cIncludeRoots.add(d);
  }
  const rubyLibRoots = /* @__PURE__ */ new Set([""]);
  for (const d of dirSet) if (d.slice(d.lastIndexOf("/") + 1) === "lib") rubyLibRoots.add(d);
  const phpPsr4 = [];
  for (const rel of fileSet) {
    if (rel !== "composer.json" && !rel.endsWith("/composer.json")) continue;
    const composer = tolerantJsonParse(readText(join4(scan2.root, rel)));
    if (!composer) {
      warnings.push(`unparseable ${rel} \u2014 skipped for PHP PSR-4 resolution`);
      continue;
    }
    const baseDir = rel.includes("/") ? posix.dirname(rel) : "";
    for (const block of [composer.autoload?.["psr-4"], composer["autoload-dev"]?.["psr-4"]]) {
      if (!block) continue;
      for (const [prefix, dirs] of Object.entries(block)) {
        for (const d of Array.isArray(dirs) ? dirs : [dirs]) {
          if (typeof d !== "string") continue;
          phpPsr4.push({ prefix: prefix.replace(/\\+$/, ""), dir: norm(posix.join(baseDir, d)).replace(/^\.$/, "") });
        }
      }
    }
  }
  phpPsr4.sort((a, b) => b.prefix.length - a.prefix.length);
  const csharpNamespaces = /* @__PURE__ */ new Map();
  for (const f of scan2.files) {
    if (f.ext !== ".cs" || !f.pkg) continue;
    let arr = csharpNamespaces.get(f.pkg);
    if (!arr) csharpNamespaces.set(f.pkg, arr = []);
    arr.push(f.rel);
  }
  for (const arr of csharpNamespaces.values()) arr.sort(byStr);
  return {
    fileSet,
    dirSet,
    filesByDir,
    tsConfigs,
    goModules,
    rustCrates,
    javaRoots: [...javaRoots].sort(byLen),
    pyRoots: [...pyRoots],
    workspacePackages,
    cIncludeRoots: [...cIncludeRoots].sort(byLen),
    rubyLibRoots: [...rubyLibRoots].sort(byLen),
    phpPsr4,
    csharpNamespaces,
    warnings
  };
}
function firstExisting(ctx, candidates) {
  for (const c2 of candidates) {
    const n = norm(c2);
    if (n && !n.startsWith("..") && ctx.fileSet.has(n)) return n;
  }
  return void 0;
}
function resolveDocLink(fromRel, spec, ctx) {
  let target = spec.split("#")[0].split("?")[0];
  if (!target) return { kind: "external" };
  if (target.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(target)) return { kind: "external" };
  const base = fromRel.includes("/") ? posix.dirname(fromRel) : "";
  const p = norm(posix.join(base, target));
  if (p.startsWith("..")) return { kind: "dangling", reason: "escapes-repo-root" };
  const hit = firstExisting(ctx, [
    p,
    p + ".md",
    p + ".mdx",
    posix.join(p, "README.md"),
    posix.join(p, "readme.md"),
    posix.join(p, "index.md"),
    posix.join(p, "index.mdx")
  ]);
  if (hit) return { kind: "resolved", target: hit };
  if (ctx.dirSet.has(p)) return { kind: "external" };
  return { kind: "dangling", reason: "missing-target" };
}
function resolveJs(fromRel, spec, ctx) {
  const probe = (p) => firstExisting(ctx, [...JS_EXT_PROBES.map((e) => p + e), ...JS_INDEX.map((i2) => posix.join(p, i2))]);
  const tryResolve = (p) => {
    const hit = probe(p);
    if (hit) return hit;
    const noJs = p.replace(/\.(js|jsx|mjs|cjs)$/, "");
    return noJs !== p ? probe(noJs) : void 0;
  };
  if (spec.startsWith(".")) {
    const base = fromRel.includes("/") ? posix.dirname(fromRel) : "";
    const p = norm(posix.join(base, spec));
    if (p.startsWith("..")) return { kind: "dangling", reason: "escapes-repo-root" };
    const hit = tryResolve(p);
    return hit ? { kind: "resolved", target: hit } : { kind: "dangling", reason: "missing-module" };
  }
  let aliasFallback;
  for (const cfg of ctx.tsConfigs) {
    if (cfg.dir && fromRel !== cfg.dir && !fromRel.startsWith(cfg.dir + "/")) continue;
    let matched = false;
    for (const tp of cfg.paths) {
      if (!(tp.star ? spec.startsWith(tp.prefix) : spec === tp.prefix)) continue;
      matched = true;
      const suffix = tp.star ? spec.slice(tp.prefix.length) : "";
      let targetTreeExists = false;
      for (const t of tp.targets) {
        const resolved = tp.star ? t.replace(/\*/, suffix) : t;
        const p = norm(posix.join(cfg.baseUrl, resolved));
        const hit = tryResolve(p);
        if (hit) return { kind: "resolved", target: hit };
        const tdir = p.includes("/") ? posix.dirname(p) : "";
        if (ctx.dirSet.has(tdir) || ctx.fileSet.has(p)) targetTreeExists = true;
      }
      aliasFallback = targetTreeExists ? { kind: "dangling", reason: "alias-unresolved" } : { kind: "external" };
      break;
    }
    if (matched) break;
  }
  for (const pkg of ctx.workspacePackages) {
    if (spec !== pkg.name && !spec.startsWith(pkg.name + "/")) continue;
    const sub = spec.slice(pkg.name.length).replace(/^\//, "");
    const probeEntry = (entry) => {
      for (const cand of [entry, ...distToSrcCandidates(entry)]) {
        const hit = tryResolve(norm(posix.join(pkg.dir, cand)));
        if (hit) return hit;
      }
      return void 0;
    };
    const subKey = sub ? "./" + sub : ".";
    for (const entry of pkg.exportEntries) {
      let fill;
      if (entry.star) {
        const starAt = entry.key.indexOf("*");
        const pre = entry.key.slice(0, starAt);
        const post = entry.key.slice(starAt + 1);
        if (!subKey.startsWith(pre) || !subKey.endsWith(post) || subKey.length < pre.length + post.length) continue;
        fill = subKey.slice(pre.length, subKey.length - post.length);
      } else if (entry.key !== subKey) continue;
      for (const t of entry.targets) {
        const hit = probeEntry(fill === void 0 ? t : t.replace(/\*/g, fill));
        if (hit) return { kind: "resolved", target: hit };
      }
      break;
    }
    if (!sub) {
      for (const m of pkg.mainCandidates) {
        const hit = probeEntry(m);
        if (hit) return { kind: "resolved", target: hit };
      }
    }
    const bases = sub ? [posix.join(pkg.dir, "src", sub), posix.join(pkg.dir, sub)] : [posix.join(pkg.dir, "src", "index"), posix.join(pkg.dir, "index"), posix.join(pkg.dir, "src")];
    for (const b of bases) {
      const hit = tryResolve(norm(b));
      if (hit) return { kind: "resolved", target: hit };
    }
    return { kind: "external" };
  }
  return aliasFallback ?? { kind: "external" };
}
function resolvePython(fromRel, spec, ctx) {
  const probeModule = (dir, dotted) => {
    const sub = dotted ? dotted.replace(/\./g, "/") : "";
    const base = norm(posix.join(dir, sub));
    return firstExisting(ctx, [base + ".py", base + ".pyi", posix.join(base, "__init__.py")]);
  };
  if (spec.startsWith(".")) {
    const dots = /^\.+/.exec(spec)[0].length;
    const rest = spec.slice(dots);
    const base = fromRel.includes("/") ? posix.dirname(fromRel) : "";
    let dir = base;
    for (let i2 = 1; i2 < dots; i2++) dir = dir.includes("/") ? posix.dirname(dir) : "";
    const hit = rest ? probeModule(dir, rest) : firstExisting(ctx, [posix.join(norm(dir), "__init__.py")]);
    return hit ? { kind: "resolved", target: hit } : { kind: "dangling", reason: "missing-module" };
  }
  for (const root of ctx.pyRoots) {
    const hit = probeModule(root, spec);
    if (hit) return { kind: "resolved", target: hit };
  }
  return { kind: "external" };
}
function resolveGo(fromRel, spec, ctx) {
  if (!ctx.goModules.length) return { kind: "external" };
  const probePkg = (dir) => {
    const d = norm(dir).replace(/^\.$/, "");
    const inDir2 = (ctx.filesByDir.get(d) ?? []).filter((f) => f.endsWith(".go")).sort();
    return inDir2.length ? { kind: "resolved", target: inDir2[0] } : { kind: "dangling", reason: "missing-package" };
  };
  const home = ctx.goModules.find((g) => !g.dir || fromRel === g.dir || fromRel.startsWith(g.dir + "/"));
  if (home) {
    for (const r of home.replaces) {
      if (spec !== r.from && !spec.startsWith(r.from + "/")) continue;
      const sub = spec.slice(r.from.length).replace(/^\//, "");
      return probePkg(posix.join(r.toDir, sub));
    }
  }
  const ordered = home ? [home, ...ctx.goModules.filter((g) => g !== home)] : ctx.goModules;
  for (const g of ordered) {
    if (spec !== g.module && !spec.startsWith(g.module + "/")) continue;
    const sub = spec.slice(g.module.length).replace(/^\//, "");
    return probePkg(posix.join(g.dir, sub));
  }
  return { kind: "external" };
}
function resolveRust(fromRel, spec, ctx) {
  if (!ctx.rustCrates.length) return { kind: "external" };
  const probeMod = (dir, name2) => firstExisting(ctx, [posix.join(dir, name2 + ".rs"), posix.join(dir, name2, "mod.rs")]);
  const walkPath = (baseDir2, segs2) => {
    for (let n = segs2.length; n >= 1; n--) {
      const dir = norm(posix.join(baseDir2, ...segs2.slice(0, n - 1)));
      const hit2 = probeMod(dir, segs2[n - 1]);
      if (hit2) return hit2;
    }
    return void 0;
  };
  const fromDir = fromRel.includes("/") ? posix.dirname(fromRel) : "";
  const stem = fromRel.slice(fromRel.lastIndexOf("/") + 1).replace(/\.rs$/, "");
  const isRootish = stem === "mod" || stem === "lib" || stem === "main";
  const childDir = isRootish ? fromDir : posix.join(fromDir, stem);
  if (spec.startsWith("mod ")) {
    const name2 = spec.slice(4);
    const hit2 = probeMod(childDir, name2) ?? (isRootish ? void 0 : probeMod(fromDir, name2));
    return hit2 ? { kind: "resolved", target: hit2 } : { kind: "dangling", reason: "missing-module" };
  }
  const segs = spec.split("::").map((s) => s.trim()).filter(Boolean);
  if (!segs.length) return { kind: "external" };
  const head = segs[0];
  const home = ctx.rustCrates.find((c2) => !c2.dir || fromRel === c2.dir || fromRel.startsWith(c2.dir + "/"));
  let baseDir;
  let rest = [];
  if (head === "crate" && home) {
    baseDir = home.srcDir;
    rest = segs.slice(1);
  } else if (head === "self") {
    baseDir = childDir;
    rest = segs.slice(1);
  } else if (head === "super") {
    let dir = isRootish ? fromDir.includes("/") ? posix.dirname(fromDir) : "" : fromDir;
    let i2 = 1;
    while (i2 < segs.length && segs[i2] === "super") {
      dir = dir.includes("/") ? posix.dirname(dir) : "";
      i2++;
    }
    baseDir = dir;
    rest = segs.slice(i2);
  } else {
    const target = ctx.rustCrates.find((c2) => c2.name === head);
    if (target) {
      const walked = walkPath(target.srcDir, segs.slice(1));
      if (walked) return { kind: "resolved", target: walked };
      if (target.rootFile) return { kind: "resolved", target: target.rootFile };
    }
    return { kind: "external" };
  }
  if (!rest.length) return { kind: "external" };
  const hit = walkPath(baseDir, rest);
  if (hit) return { kind: "resolved", target: hit };
  if (home && baseDir === home.srcDir && home.rootFile) return { kind: "resolved", target: home.rootFile };
  const ownerDir = baseDir.includes("/") ? posix.dirname(baseDir) : "";
  const ownerName = baseDir.slice(baseDir.lastIndexOf("/") + 1);
  const owner = ownerName ? probeMod(ownerDir, ownerName) : void 0;
  if (owner && owner !== fromRel) return { kind: "resolved", target: owner };
  return { kind: "external" };
}
function resolveJava(spec, ctx) {
  if (!ctx.javaRoots.length) return { kind: "external" };
  const probe = (pkgPath) => {
    for (const root of ctx.javaRoots) {
      const p = norm(posix.join(root, pkgPath));
      if (p.endsWith("/*") || p === "*") {
        const dir = p === "*" ? "" : p.slice(0, -2);
        const inDir2 = (ctx.filesByDir.get(dir) ?? []).filter((f) => f.endsWith(".java")).sort();
        if (inDir2.length) return inDir2[0];
        continue;
      }
      if (ctx.fileSet.has(p + ".java")) return p + ".java";
    }
    return void 0;
  };
  const path = spec.replace(/\./g, "/");
  let hit = probe(path);
  if (!hit && !spec.endsWith(".*")) {
    const segs = path.split("/");
    for (let n = segs.length - 1; n >= 2 && !hit; n--) {
      hit = probe(segs.slice(0, n).join("/"));
    }
  }
  return hit ? { kind: "resolved", target: hit } : { kind: "external" };
}
function resolveC(fromRel, spec, ctx) {
  const fromDir = fromRel.includes("/") ? posix.dirname(fromRel) : "";
  const hit = firstExisting(ctx, [posix.join(fromDir, spec), ...ctx.cIncludeRoots.map((r) => posix.join(r, spec))]);
  return hit ? { kind: "resolved", target: hit } : { kind: "dangling", reason: "missing-include" };
}
function resolveRuby(fromRel, spec, ctx) {
  if (spec.startsWith(".")) {
    const fromDir = fromRel.includes("/") ? posix.dirname(fromRel) : "";
    const base = norm(posix.join(fromDir, spec));
    const hit = firstExisting(ctx, [base + ".rb", posix.join(base, "index.rb")]);
    return hit ? { kind: "resolved", target: hit } : { kind: "dangling", reason: "missing-module" };
  }
  for (const root of ctx.rubyLibRoots) {
    const hit = firstExisting(ctx, [posix.join(root, spec + ".rb")]);
    if (hit) return { kind: "resolved", target: hit };
  }
  return { kind: "external" };
}
function resolvePhp(fromRel, spec, ctx) {
  if (spec.startsWith(".")) {
    const fromDir = fromRel.includes("/") ? posix.dirname(fromRel) : "";
    const base = norm(posix.join(fromDir, spec));
    const hit = firstExisting(ctx, [base, base + ".php"]);
    return hit ? { kind: "resolved", target: hit } : { kind: "dangling", reason: "missing-module" };
  }
  const ns = spec.replace(/^\\+/, "");
  for (const { prefix, dir } of ctx.phpPsr4) {
    if (prefix && ns !== prefix && !ns.startsWith(prefix + "\\")) continue;
    const rest = prefix ? ns.slice(prefix.length).replace(/^\\+/, "") : ns;
    const hit = firstExisting(ctx, [posix.join(dir, rest.replace(/\\/g, "/")) + ".php"]);
    if (hit) return { kind: "resolved", target: hit };
  }
  return { kind: "external" };
}
function resolveCsharp(spec, ctx) {
  const exact = ctx.csharpNamespaces.get(spec);
  if (exact?.length) return { kind: "resolved", target: exact[0] };
  let best;
  for (const [ns, files] of ctx.csharpNamespaces) {
    if (ns === spec || ns.startsWith(spec + ".")) {
      const f = files[0];
      if (best === void 0 || byStr(f, best) < 0) best = f;
    }
  }
  return best ? { kind: "resolved", target: best } : { kind: "external" };
}
function resolveImport(fromRel, ext, spec, ctx) {
  const dot = spec.lastIndexOf(".");
  if (dot !== -1 && ASSET_EXT.has(spec.slice(dot).toLowerCase().replace(/[?#].*$/, ""))) {
    return { kind: "external" };
  }
  if (JS_TS2.has(ext) || SFC_HTML.has(ext)) return resolveJs(fromRel, spec, ctx);
  if (PY2.has(ext)) return resolvePython(fromRel, spec, ctx);
  if (ext === ".go") return resolveGo(fromRel, spec, ctx);
  if (ext === ".rs") return resolveRust(fromRel, spec, ctx);
  if (ext === ".java") return resolveJava(spec, ctx);
  if (C_CPP2.has(ext)) return resolveC(fromRel, spec, ctx);
  if (ext === ".rb" || ext === ".rake") return resolveRuby(fromRel, spec, ctx);
  if (ext === ".php") return resolvePhp(fromRel, spec, ctx);
  if (ext === ".cs") return resolveCsharp(spec, ctx);
  return { kind: "external" };
}
var ASSET_EXT;
var JS_EXT_PROBES;
var JS_INDEX;
var JS_TS2;
var SFC_HTML;
var PY2;
var C_CPP2;
var BUILD_DIRS;
var CONDITION_PRIORITY;
var MAX_EXPORT_TARGETS;
var init_resolve = __esm({
  "src/resolve.ts"() {
    "use strict";
    init_walk();
    init_sort();
    ASSET_EXT = /* @__PURE__ */ new Set([
      ".svg",
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".webp",
      ".bmp",
      ".ico",
      ".icns",
      ".pdf",
      ".woff",
      ".woff2",
      ".ttf",
      ".otf",
      ".eot",
      ".mp3",
      ".mp4",
      ".mov",
      ".avi",
      ".webm",
      ".wav",
      ".flac",
      ".ogg",
      ".map"
    ]);
    JS_EXT_PROBES = [
      "",
      ".ts",
      ".tsx",
      ".d.ts",
      ".mts",
      ".cts",
      ".js",
      ".jsx",
      ".mjs",
      ".cjs",
      ".vue",
      ".svelte",
      ".astro",
      ".html",
      ".htm"
    ];
    JS_INDEX = ["index.ts", "index.tsx", "index.js", "index.jsx", "index.mjs", "index.cjs"];
    JS_TS2 = /* @__PURE__ */ new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
    SFC_HTML = /* @__PURE__ */ new Set([".vue", ".svelte", ".astro", ".html", ".htm"]);
    PY2 = /* @__PURE__ */ new Set([".py", ".pyi"]);
    C_CPP2 = /* @__PURE__ */ new Set([".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".hh"]);
    BUILD_DIRS = /* @__PURE__ */ new Set(["dist", "build", "lib", "out", "output", "esm", "cjs", "umd"]);
    CONDITION_PRIORITY = ["source", "ts", "import", "module", "require", "node", "default"];
    MAX_EXPORT_TARGETS = 8;
  }
});
function isTestFile(rel) {
  return TEST_FILE.test(rel.split("/").pop());
}
function dirOf(rel) {
  return rel.includes("/") ? posix2.dirname(rel) : ROOT_PATH;
}
function tierForPath(path) {
  if (path === ROOT_PATH) return 0;
  if (TIER2_ANY.test(path) || TIER2_LEAF.test(path)) return 2;
  if (TIER0.test(path)) return 0;
  return null;
}
function tierOf(path, members) {
  const byPath = tierForPath(path);
  if (byPath !== null) return byPath;
  if (members.every((m) => m.kind === "doc" || m.kind === "config" || isTestFile(m.rel))) return 2;
  return 1;
}
function summaryOf(path, members) {
  const readme = members.find((m) => /^(readme|index)\.(md|mdx)$/i.test(m.rel.split("/").pop()));
  if (readme?.summary) return readme.summary;
  if (readme?.title) return readme.title;
  const withSummary = members.filter((m) => m.summary).sort((a, b) => (b.summary?.length ?? 0) - (a.summary?.length ?? 0));
  if (withSummary[0]?.summary) return withSummary[0].summary;
  const langs = [...new Set(members.map((m) => m.lang))].filter((l) => l !== "other");
  const where = path === ROOT_PATH ? "the repository root" : `\`${path}/\``;
  return `${members.length} file(s) in ${where}${langs.length ? ` (${langs.slice(0, 3).join(", ")})` : ""}.`;
}
function buildModules(scan2) {
  const byDir = /* @__PURE__ */ new Map();
  for (const f of scan2.files) {
    const dir = dirOf(f.rel);
    let list = byDir.get(dir);
    if (!list) byDir.set(dir, list = []);
    list.push(f);
  }
  const dirs = [...byDir.keys()].sort(byStr);
  const baseOf = /* @__PURE__ */ new Map();
  const baseCount = /* @__PURE__ */ new Map();
  for (const dir of dirs) {
    const b = dir === ROOT_PATH ? "root" : slugify(dir);
    baseOf.set(dir, b);
    baseCount.set(b, (baseCount.get(b) ?? 0) + 1);
  }
  const slugForDir = (dir) => {
    const b = baseOf.get(dir);
    return b && baseCount.get(b) === 1 ? b : `${b || "module"}-${sha1(dir).slice(0, 8)}`;
  };
  const modules = [];
  const moduleOf = /* @__PURE__ */ new Map();
  for (const dir of dirs) {
    const members = byDir.get(dir).slice().sort((a, b) => byStr(a.rel, b.rel));
    const slug = slugForDir(dir);
    const info2 = {
      slug,
      path: dir,
      title: dir,
      tier: tierOf(dir, members),
      members: members.map((m) => m.rel),
      summary: summaryOf(dir, members)
    };
    modules.push(info2);
    for (const m of members) moduleOf.set(m.rel, slug);
  }
  modules.sort((a, b) => byStr(a.slug, b.slug));
  return { modules, moduleOf };
}
var ROOT_PATH;
var TIER0;
var TIER2_ANY;
var TIER2_LEAF;
var TEST_FILE;
var init_modules = __esm({
  "src/modules.ts"() {
    "use strict";
    init_util();
    init_hash();
    init_sort();
    ROOT_PATH = "(root)";
    TIER0 = /(^|\/)(types?|util|utils|lib|libs|common|core|config|configs|constants|shared|helpers|internal)$/i;
    TIER2_ANY = /(^|\/)(tests?|__tests?__|__mocks?__|__snapshots?__|spec|specs|e2e|examples?|example|benchmark|benchmarks|fixtures?|docs?|documentation|\.github)(\/|$)/i;
    TIER2_LEAF = /(^|\/)(scripts?|bin|\.storybook)$/i;
    TEST_FILE = /\.(test|spec|e2e|stories|story)\.[cm]?[jt]sx?$/i;
  }
});
function familyOf(lang) {
  if (lang === "typescript" || lang === "javascript") return "js";
  if (lang === "c" || lang === "cpp") return "c";
  return lang;
}
function sharedSegments(a, b) {
  const as = a.split("/");
  const bs = b.split("/");
  let n = 0;
  while (n < as.length && n < bs.length && as[n] === bs[n]) n++;
  return n;
}
function pickCandidate(callerRel, cands) {
  if (cands.length === 1) return cands[0];
  if (cands.length === 0) return void 0;
  let best;
  let bestScore = -1;
  let tied = false;
  for (const c2 of cands) {
    const s = sharedSegments(callerRel, c2.file);
    if (s > bestScore) {
      bestScore = s;
      best = c2;
      tied = false;
    } else if (s === bestScore) {
      tied = true;
    }
  }
  return tied ? void 0 : best;
}
function resolveCallEdges(scan2, importPairs) {
  const defs = /* @__PURE__ */ new Map();
  const seen = /* @__PURE__ */ new Set();
  for (const f of scan2.files) {
    for (const s of f.symbols) {
      if (!s.exported || REFERENCE_KINDS.has(s.kind)) continue;
      const dedup = `${s.name} ${s.file}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      let arr = defs.get(s.name);
      if (!arr) defs.set(s.name, arr = []);
      arr.push({ file: s.file, lang: s.lang });
    }
  }
  const agg = /* @__PURE__ */ new Map();
  for (const f of scan2.files) {
    if (!f.calls?.length) continue;
    const family = familyOf(f.lang);
    const ownNames = new Set(f.symbols.map((s) => s.name));
    const counts = /* @__PURE__ */ new Map();
    for (const c2 of f.calls) counts.set(c2.name, (counts.get(c2.name) ?? 0) + 1);
    for (const [name2, count] of counts) {
      if (ownNames.has(name2)) continue;
      const cands = (defs.get(name2) ?? []).filter((d) => familyOf(d.lang) === family && d.file !== f.rel);
      if (!cands.length) continue;
      const imported = cands.filter((d) => importPairs.has(`${f.rel}|${d.file}`));
      let chosen;
      let confidence;
      if (family === "js") {
        if (!imported.length) continue;
        chosen = pickCandidate(f.rel, imported);
        confidence = "extracted";
      } else if (imported.length) {
        chosen = pickCandidate(f.rel, imported);
        confidence = "extracted";
      } else {
        chosen = pickCandidate(f.rel, cands);
        confidence = "inferred";
      }
      if (!chosen) continue;
      const key = `${f.rel}|${chosen.file}`;
      const prev = agg.get(key);
      if (prev) {
        prev.weight += count;
        if (confidence === "extracted") prev.confidence = "extracted";
      } else {
        agg.set(key, { from: f.rel, to: chosen.file, weight: count, confidence });
      }
    }
  }
  return [...agg.values()].map((e) => ({ from: e.from, to: e.to, kind: "call", weight: Math.min(e.weight, 5), confidence: e.confidence })).sort((a, b) => byStr(a.from, b.from) || byStr(a.to, b.to));
}
var REFERENCE_KINDS;
var init_calls = __esm({
  "src/calls.ts"() {
    "use strict";
    init_sort();
    REFERENCE_KINDS = /* @__PURE__ */ new Set(["reexport", "reexport-all", "default"]);
  }
});
function isDistinctive(name2) {
  if (name2.length < 5) return false;
  const internalUpper = /[a-z][A-Z]/.test(name2) || /[A-Z]{2}/.test(name2);
  return internalUpper || name2.includes("_") || /\d/.test(name2);
}
function uniqueSymbolDefs(scan2) {
  const byName = /* @__PURE__ */ new Map();
  for (const f of scan2.files) {
    for (const s of f.symbols) {
      if (!s.exported || REFERENCE_KINDS2.has(s.kind) || !isDistinctive(s.name)) continue;
      let set = byName.get(s.name);
      if (!set) byName.set(s.name, set = /* @__PURE__ */ new Set());
      set.add(f.rel);
    }
  }
  const unique = /* @__PURE__ */ new Map();
  for (const [name2, files] of byName) if (files.size === 1) unique.set(name2, [...files][0]);
  return unique;
}
function collect(edges, e) {
  const k = keyOf(e.from, e.to, e.kind);
  const prev = edges.get(k);
  if (prev) {
    prev.weight += e.weight;
    return;
  }
  edges.set(k, { ...e });
}
function buildGraph(scan2, ctx, modules, moduleOf, meta) {
  const fileEdgeMap = /* @__PURE__ */ new Map();
  const importPairs = /* @__PURE__ */ new Set();
  for (const f of scan2.files) {
    for (const ref of f.refs) {
      if (ref.kind === "doc-link") {
        const r = resolveDocLink(f.rel, ref.spec, ctx);
        if (r.kind === "external") continue;
        if (r.kind === "dangling") {
          collect(fileEdgeMap, { from: f.rel, to: ref.spec, kind: "doc-link", weight: 1, dangling: true, reason: r.reason });
        } else if (r.target !== f.rel) {
          collect(fileEdgeMap, { from: f.rel, to: r.target, kind: "doc-link", weight: 1 });
        }
      } else {
        const r = resolveImport(f.rel, f.ext, ref.spec, ctx);
        if (r.kind === "external") continue;
        if (r.kind === "dangling") {
          collect(fileEdgeMap, { from: f.rel, to: ref.spec, kind: "import", weight: 1, dangling: true, reason: r.reason });
        } else if (r.target !== f.rel) {
          collect(fileEdgeMap, { from: f.rel, to: r.target, kind: "import", weight: 1 });
          importPairs.add(`${f.rel}|${r.target}`);
        }
      }
    }
  }
  const callPairs = /* @__PURE__ */ new Set();
  for (const e of resolveCallEdges(scan2, importPairs)) {
    collect(fileEdgeMap, e);
    callPairs.add(`${e.from}|${e.to}`);
  }
  const unique = uniqueSymbolDefs(scan2);
  if (unique.size) {
    for (const f of scan2.files) {
      if (f.kind !== "code" || !f.idents?.length) continue;
      const perTarget = /* @__PURE__ */ new Map();
      for (const id of f.idents) {
        const target = unique.get(id);
        if (!target || target === f.rel) continue;
        perTarget.set(target, (perTarget.get(target) ?? 0) + 1);
      }
      for (const [target, count] of perTarget) {
        const pair = `${f.rel}|${target}`;
        if (importPairs.has(pair) || callPairs.has(pair)) continue;
        collect(fileEdgeMap, { from: f.rel, to: target, kind: "use", weight: Math.min(count, 5) });
      }
    }
  }
  if (unique.size) {
    for (const f of scan2.files) {
      if (f.kind !== "doc") continue;
      const content = scan2.docText.get(f.rel) ?? readText(join5(scan2.root, f.rel));
      if (!content) continue;
      const tokens2 = /* @__PURE__ */ new Map();
      for (const tok of content.split(/[^A-Za-z0-9_]+/)) {
        if (unique.has(tok)) tokens2.set(tok, (tokens2.get(tok) ?? 0) + 1);
      }
      for (const [name2, count] of tokens2) {
        const target = unique.get(name2);
        if (target === f.rel) continue;
        collect(fileEdgeMap, { from: f.rel, to: target, kind: "mention", weight: Math.min(count, 5) });
      }
    }
  }
  const fileEdges = [...fileEdgeMap.values()].sort(
    (a, b) => byStr(a.from, b.from) || byStr(a.to, b.to) || byStr(a.kind, b.kind)
  );
  const degIn = /* @__PURE__ */ new Map();
  const degOut = /* @__PURE__ */ new Map();
  const fileSet = new Set(scan2.files.map((f) => f.rel));
  for (const e of fileEdges) {
    if (e.dangling || !fileSet.has(e.to)) continue;
    degOut.set(e.from, (degOut.get(e.from) ?? 0) + 1);
    degIn.set(e.to, (degIn.get(e.to) ?? 0) + 1);
  }
  const KIND_RANK = { import: 5, call: 4, use: 3, "doc-link": 2, mention: 1, contains: 0 };
  const modEdgeMap = /* @__PURE__ */ new Map();
  for (const e of fileEdges) {
    if (e.dangling || !fileSet.has(e.to)) continue;
    const from = moduleOf.get(e.from);
    const to = moduleOf.get(e.to);
    if (!from || !to || from === to) continue;
    const k = `${from}\0${to}`;
    const prev = modEdgeMap.get(k);
    if (prev) {
      prev.weight += e.weight;
      if ((KIND_RANK[e.kind] ?? 0) > (KIND_RANK[prev.kind] ?? 0)) prev.kind = e.kind;
    } else {
      modEdgeMap.set(k, { from, to, kind: e.kind, weight: e.weight });
    }
  }
  const moduleEdges = [...modEdgeMap.values()].sort((a, b) => byStr(a.from, b.from) || byStr(a.to, b.to));
  const modDegIn = /* @__PURE__ */ new Map();
  const modDegOut = /* @__PURE__ */ new Map();
  for (const e of moduleEdges) {
    modDegOut.set(e.from, (modDegOut.get(e.from) ?? 0) + 1);
    modDegIn.set(e.to, (modDegIn.get(e.to) ?? 0) + 1);
  }
  const files = scan2.files.map((f) => ({
    id: f.rel,
    kind: "file",
    rel: f.rel,
    fileKind: f.kind,
    lang: f.lang,
    module: moduleOf.get(f.rel) ?? "root",
    title: f.title,
    summary: f.summary,
    symbols: f.symbols.length,
    lines: f.lines,
    degIn: degIn.get(f.rel) ?? 0,
    degOut: degOut.get(f.rel) ?? 0
  })).sort((a, b) => byStr(a.rel, b.rel));
  const symbolsByModule = /* @__PURE__ */ new Map();
  for (const f of scan2.files) {
    const slug = moduleOf.get(f.rel) ?? "root";
    symbolsByModule.set(slug, (symbolsByModule.get(slug) ?? 0) + f.symbols.length);
  }
  const moduleNodes = modules.map((m) => ({
    id: m.slug,
    kind: "module",
    slug: m.slug,
    path: m.path,
    title: m.title,
    summary: m.summary,
    tier: m.tier,
    members: m.members,
    symbols: symbolsByModule.get(m.slug) ?? 0,
    degIn: modDegIn.get(m.slug) ?? 0,
    degOut: modDegOut.get(m.slug) ?? 0
  })).sort((a, b) => byStr(a.slug, b.slug));
  return {
    schemaVersion: meta?.schemaVersion ?? SCHEMA_VERSION,
    version: meta?.version ?? ENGINE_VERSION,
    commit: scan2.commit,
    fileCount: scan2.files.length,
    languages: scan2.languages,
    files,
    modules: moduleNodes,
    fileEdges,
    moduleEdges
  };
}
var REFERENCE_KINDS2;
var keyOf;
var init_graph = __esm({
  "src/graph.ts"() {
    "use strict";
    init_types();
    init_resolve();
    init_calls();
    init_walk();
    init_sort();
    REFERENCE_KINDS2 = /* @__PURE__ */ new Set(["reexport", "reexport-all", "default"]);
    keyOf = (from, to, kind) => `${from}\0${to}\0${kind}`;
  }
});
function computeSymbolRefs(scan2) {
  const unique = uniqueSymbolDefs(scan2);
  const refs = /* @__PURE__ */ new Map();
  if (!unique.size) return refs;
  const add = (name2, file) => {
    let set = refs.get(name2);
    if (!set) refs.set(name2, set = /* @__PURE__ */ new Set());
    set.add(file);
  };
  for (const f of scan2.files) {
    if (f.kind === "code" && f.idents) {
      for (const id of f.idents) {
        const target = unique.get(id);
        if (target && target !== f.rel) add(id, f.rel);
      }
    } else if (f.kind === "doc") {
      const content = scan2.docText.get(f.rel);
      if (!content) continue;
      for (const tok of content.split(/[^A-Za-z0-9_]+/)) {
        const target = unique.get(tok);
        if (target && target !== f.rel) add(tok, f.rel);
      }
    }
  }
  return refs;
}
function buildSymbolIndex(scan2, refs = /* @__PURE__ */ new Map()) {
  const defsByName = /* @__PURE__ */ new Map();
  for (const f of scan2.files) {
    for (const s of f.symbols) {
      let arr = defsByName.get(s.name);
      if (!arr) defsByName.set(s.name, arr = []);
      arr.push({
        file: s.file,
        line: s.line,
        ...s.endLine !== void 0 ? { endLine: s.endLine } : {},
        kind: s.kind,
        exported: s.exported,
        lang: s.lang,
        ...s.parent ? { parent: s.parent } : {}
      });
    }
  }
  const defs = {};
  for (const name2 of [...defsByName.keys()].sort(byStr)) {
    defs[name2] = defsByName.get(name2).slice().sort((a, b) => byStr(a.file, b.file) || a.line - b.line || byStr(a.kind, b.kind));
  }
  const refsOut = {};
  for (const name2 of [...refs.keys()].sort(byStr)) {
    const files = [...refs.get(name2)].sort(byStr);
    if (files.length) refsOut[name2] = files;
  }
  return { schemaVersion: SCHEMA_VERSION, defs, refs: refsOut };
}
function renderSymbolsJson(index) {
  return JSON.stringify(index, null, 2) + "\n";
}
var init_symbols_json = __esm({
  "src/render/symbols-json.ts"() {
    "use strict";
    init_types();
    init_sort();
    init_graph();
  }
});
function subtokens(raw) {
  const folded = foldText(raw).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  const out2 = [];
  const seen = /* @__PURE__ */ new Set();
  const push = (t) => {
    if (t.length < 2 || seen.has(t)) return;
    seen.add(t);
    out2.push(t);
  };
  if (!/\s/.test(raw.trim())) push(foldText(raw).toLowerCase().replace(/[^a-z0-9_]+/g, ""));
  for (const part of folded.split(/[^A-Za-z0-9]+/)) push(part.toLowerCase());
  return out2;
}
function addTerms(doc, text) {
  for (const t of subtokens(text)) {
    doc.tf.set(t, (doc.tf.get(t) ?? 0) + 1);
    doc.len++;
  }
}
function buildDocs(scan2) {
  const docs = [];
  for (const f of scan2.files) {
    const doc = { file: f.rel, tf: /* @__PURE__ */ new Map(), len: 0, symbols: [] };
    const seenSym = /* @__PURE__ */ new Set();
    for (const s of f.symbols) {
      addTerms(doc, s.name);
      if (!seenSym.has(s.name)) {
        seenSym.add(s.name);
        doc.symbols.push(s.name);
      }
    }
    for (const seg of f.rel.split("/")) addTerms(doc, seg);
    for (const h of f.headings) addTerms(doc, h);
    if (f.summary) addTerms(doc, f.summary);
    docs.push(doc);
  }
  return docs;
}
function charTrigrams(term) {
  const padded = `^^${term}$$`;
  const grams = /* @__PURE__ */ new Set();
  for (let i2 = 0; i2 + 3 <= padded.length; i2++) grams.add(padded.slice(i2, i2 + 3));
  return grams;
}
function diceCoefficient(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const g of a) if (b.has(g)) inter++;
  return 2 * inter / (a.size + b.size);
}
function buildTrigramIndex(docs) {
  const index = /* @__PURE__ */ new Map();
  for (const d of docs) {
    for (const term of d.tf.keys()) {
      if (!index.has(term)) index.set(term, charTrigrams(term));
    }
  }
  return index;
}
function searchIndex(scan2, query, opts = {}) {
  const terms = [];
  const seen = /* @__PURE__ */ new Set();
  for (const kw of keywords(query)) {
    for (const t of subtokens(kw)) {
      if (seen.has(t)) continue;
      seen.add(t);
      terms.push(t);
    }
  }
  if (!terms.length) return [];
  const docs = bm25DocsFor(scan2);
  const n = docs.length;
  if (!n) return [];
  let totalLen = 0;
  for (const d of docs) totalLen += d.len;
  const avgLen = totalLen / n || 1;
  const df = /* @__PURE__ */ new Map();
  for (const t of terms) {
    let count = 0;
    for (const d of docs) if (d.tf.has(t)) count++;
    df.set(t, count);
  }
  const fuzzyEnabled = opts.fuzzy ?? true;
  const fuzzyCandidates = /* @__PURE__ */ new Map();
  if (fuzzyEnabled) {
    const unmatched = terms.filter((t) => df.get(t) === 0);
    if (unmatched.length) {
      const trigramIndex = bm25TrigramsFor(scan2);
      for (const t of unmatched) {
        const grams = charTrigrams(t);
        const candidates = [];
        for (const [vocabTerm, vocabGrams] of trigramIndex) {
          const dice = diceCoefficient(grams, vocabGrams);
          if (dice >= FUZZY_DICE_THRESHOLD) candidates.push({ term: vocabTerm, dice });
        }
        candidates.sort((a, b) => b.dice - a.dice || byStr(a.term, b.term));
        fuzzyCandidates.set(t, candidates.slice(0, FUZZY_CAP));
      }
    }
  }
  const vocabDf = /* @__PURE__ */ new Map();
  const dfOfVocabTerm = (term) => {
    const known = df.get(term) ?? vocabDf.get(term);
    if (known !== void 0) return known;
    let count = 0;
    for (const d of docs) if (d.tf.has(term)) count++;
    vocabDf.set(term, count);
    return count;
  };
  const results = [];
  for (const d of docs) {
    let score = 0;
    const matched = [];
    const symbolTerms = /* @__PURE__ */ new Set();
    const fuzzyHit = /* @__PURE__ */ new Set();
    for (const t of terms) {
      const tf = d.tf.get(t);
      if (tf) {
        matched.push(t);
        symbolTerms.add(t);
        const idf = Math.log(1 + (n - df.get(t) + 0.5) / (df.get(t) + 0.5));
        score += idf * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * d.len / avgLen));
        continue;
      }
      const candidates = fuzzyCandidates.get(t);
      if (!candidates) continue;
      for (const cand of candidates) {
        const ctf = d.tf.get(cand.term);
        if (!ctf) continue;
        const cdf = dfOfVocabTerm(cand.term);
        const idf = Math.log(1 + (n - cdf + 0.5) / (cdf + 0.5));
        const contribution = idf * (ctf * (K1 + 1)) / (ctf + K1 * (1 - B + B * d.len / avgLen));
        score += contribution * cand.dice;
        symbolTerms.add(cand.term);
        fuzzyHit.add(t);
      }
    }
    if (!matched.length && !fuzzyHit.size) continue;
    const scored = d.symbols.map((name2) => {
      const toks = new Set(subtokens(name2));
      let hits = 0;
      for (const t of symbolTerms) if (toks.has(t)) hits++;
      return { name: name2, hits };
    }).filter((s) => s.hits > 0).sort((a, b) => b.hits - a.hits || byStr(a.name, b.name));
    const result = {
      file: d.file,
      score: Number(score.toFixed(4)),
      matchedTerms: matched.sort(byStr),
      topSymbols: scored.slice(0, TOP_SYMBOLS).map((s) => s.name)
    };
    if (fuzzyHit.size) result.fuzzyTerms = [...fuzzyHit].sort(byStr);
    results.push(result);
  }
  results.sort((a, b) => b.score - a.score || byStr(a.file, b.file));
  return results.slice(0, opts.limit ?? DEFAULT_LIMIT);
}
var K1;
var B;
var DEFAULT_LIMIT;
var TOP_SYMBOLS;
var FUZZY_DICE_THRESHOLD;
var FUZZY_CAP;
var init_bm25 = __esm({
  "src/bm25.ts"() {
    "use strict";
    init_derived();
    init_util();
    init_sort();
    K1 = 1.2;
    B = 0.75;
    DEFAULT_LIMIT = 20;
    TOP_SYMBOLS = 5;
    FUZZY_DICE_THRESHOLD = 0.6;
    FUZZY_CAP = 3;
  }
});
function complexityOfSource(source) {
  return 1 + (source.match(BRANCH_RE) ?? []).length;
}
function symbolComplexity(scan2, rel, top = 50) {
  const out2 = [];
  for (const f of scan2.files) {
    if (f.kind !== "code") continue;
    if (rel && f.rel !== rel) continue;
    if (!f.symbols.length) continue;
    const lines = readText(join6(scan2.root, f.rel)).split("\n");
    for (const s of f.symbols) {
      if (s.kind === "reexport" || s.kind === "reexport-all") continue;
      const end = s.endLine ?? s.line;
      const body2 = lines.slice(s.line - 1, end).join("\n");
      const entry = { file: f.rel, name: s.name, line: s.line, complexity: complexityOfSource(body2) };
      if (s.endLine !== void 0) entry.endLine = s.endLine;
      out2.push(entry);
    }
  }
  out2.sort((a, b) => b.complexity - a.complexity || byStr(a.file, b.file) || a.line - b.line);
  return out2.slice(0, top);
}
function riskHotspots(scan2, churn, top = 20) {
  const complexityByFile = fileComplexityFor(scan2);
  const out2 = scan2.files.filter((f) => f.kind === "code").map((f) => {
    const complexity = complexityByFile.get(f.rel);
    const commits = churn.get(f.rel) ?? 0;
    return { file: f.rel, complexity, commits, score: (commits + 1) * complexity };
  });
  out2.sort((a, b) => b.score - a.score || byStr(a.file, b.file));
  return out2.slice(0, top);
}
var BRANCH_RE;
var init_complexity = __esm({
  "src/complexity.ts"() {
    "use strict";
    init_derived();
    init_walk();
    init_sort();
    BRANCH_RE = /\b(if|elif|elsif|else\s+if|for|foreach|while|until|unless|case|when|match|catch|rescue|except)\b|&&|\|\||(?<![?:])\?(?![?.:])/g;
  }
});
function cacheFor(scan2) {
  let c2 = caches.get(scan2);
  if (!c2) caches.set(scan2, c2 = {});
  return c2;
}
function resolveContextFor(scan2) {
  const c2 = cacheFor(scan2);
  return c2.resolveCtx ??= buildResolveContext(scan2);
}
function importPairsFor(scan2) {
  const c2 = cacheFor(scan2);
  if (!c2.importPairs) {
    const ctx = resolveContextFor(scan2);
    const pairs = /* @__PURE__ */ new Set();
    for (const f of scan2.files) {
      for (const ref of f.refs) {
        if (ref.kind !== "import") continue;
        const r = resolveImport(f.rel, f.ext, ref.spec, ctx);
        if (r.kind === "resolved" && r.target !== f.rel) pairs.add(`${f.rel}|${r.target}`);
      }
    }
    c2.importPairs = pairs;
  }
  return c2.importPairs;
}
function uniqueDefsFor(scan2) {
  const c2 = cacheFor(scan2);
  return c2.uniqueDefs ??= uniqueSymbolDefs(scan2);
}
function symbolRefsFor(scan2) {
  const c2 = cacheFor(scan2);
  return c2.symbolRefs ??= computeSymbolRefs(scan2);
}
function callerIndexFor(scan2) {
  const c2 = cacheFor(scan2);
  return c2.callerIndex ??= buildCallerIndex(scan2, importPairsFor(scan2));
}
function bm25DocsFor(scan2) {
  const c2 = cacheFor(scan2);
  return (c2.bm25 ??= { docs: buildDocs(scan2) }).docs;
}
function bm25TrigramsFor(scan2) {
  const c2 = cacheFor(scan2);
  const bm25 = c2.bm25 ??= { docs: buildDocs(scan2) };
  return bm25.trigrams ??= buildTrigramIndex(bm25.docs);
}
function fileComplexityFor(scan2) {
  const c2 = cacheFor(scan2);
  if (!c2.fileComplexity) {
    const m = /* @__PURE__ */ new Map();
    for (const f of scan2.files) {
      if (f.kind !== "code") continue;
      m.set(f.rel, complexityOfSource(readText(join7(scan2.root, f.rel))));
    }
    c2.fileComplexity = m;
  }
  return c2.fileComplexity;
}
var caches;
var init_derived = __esm({
  "src/derived.ts"() {
    "use strict";
    init_resolve();
    init_graph();
    init_symbols_json();
    init_callers();
    init_bm25();
    init_complexity();
    init_walk();
    caches = /* @__PURE__ */ new WeakMap();
  }
});
function computeImportPairs(scan2) {
  return new Set(importPairsFor(scan2));
}
function buildCallerIndex(scan2, importPairs, opts = {}) {
  const pairs = importPairs ?? importPairsFor(scan2);
  const recall = opts.recall === true;
  const defs = /* @__PURE__ */ new Map();
  for (const f of scan2.files) {
    const seen = /* @__PURE__ */ new Set();
    for (const s of f.symbols) {
      if (!s.exported || REFERENCE_KINDS3.has(s.kind)) continue;
      if (seen.has(s.name)) continue;
      seen.add(s.name);
      let arr = defs.get(s.name);
      if (!arr) defs.set(s.name, arr = []);
      arr.push(s);
    }
  }
  const localDefs = /* @__PURE__ */ new Map();
  for (const f of scan2.files) {
    const byName = /* @__PURE__ */ new Map();
    for (const s of f.symbols) {
      if (!REFERENCE_KINDS3.has(s.kind) && !byName.has(s.name)) byName.set(s.name, s);
    }
    localDefs.set(f.rel, byName);
  }
  const sites = /* @__PURE__ */ new Map();
  const record = (def, caller) => {
    let entry = sites.get(def.name + "\0" + def.file);
    if (!entry) sites.set(def.name + "\0" + def.file, entry = { def, callers: [] });
    entry.callers.push(caller);
  };
  for (const f of scan2.files) {
    if (!f.calls?.length) continue;
    const family = familyOf(f.lang);
    const own = localDefs.get(f.rel);
    for (const c2 of f.calls) {
      const local = own.get(c2.name);
      if (local) {
        if (local.line !== c2.line)
          record(local, recall ? { file: f.rel, line: c2.line, confidence: "corroborated" } : { file: f.rel, line: c2.line });
        continue;
      }
      const cands = (defs.get(c2.name) ?? []).filter((d) => familyOf(d.lang) === family && d.file !== f.rel).map((d) => ({ file: d.file, lang: d.lang }));
      if (!cands.length) continue;
      const imported = cands.filter((d) => pairs.has(`${f.rel}|${d.file}`));
      const chosen = family === "js" ? imported.length ? pickCandidate(f.rel, imported) : (
        // JS/TS gate: no corroborating import → no binding. Recall mode
        // relaxes this to a unique-repo-wide name match (issue #7).
        recall && cands.length === 1 ? cands[0] : void 0
      ) : imported.length ? pickCandidate(f.rel, imported) : pickCandidate(f.rel, cands);
      if (!chosen) continue;
      const def = defs.get(c2.name).find((d) => d.file === chosen.file);
      record(
        def,
        recall ? { file: f.rel, line: c2.line, confidence: imported.length ? "corroborated" : "unique-name" } : { file: f.rel, line: c2.line }
      );
    }
  }
  const index = /* @__PURE__ */ new Map();
  const keys = [...sites.keys()].sort(byStr);
  for (const key of keys) {
    const { def, callers } = sites.get(key);
    callers.sort((a, b) => byStr(a.file, b.file) || a.line - b.line);
    if (!index.has(def.name)) index.set(def.name, { def, callers });
    else index.set(`${def.name}@${def.file}`, { def, callers });
  }
  return index;
}
function enclosingSymbol(scan2, file, line) {
  const f = scan2.files.find((x) => x.rel === file);
  if (!f?.symbols.length) return void 0;
  return enclosingAmong(f.symbols, line);
}
function enclosingAmong(symbols, line) {
  let best;
  for (const s of symbols) {
    if (REFERENCE_KINDS3.has(s.kind)) continue;
    if (s.line > line) continue;
    if (s.endLine !== void 0 && line > s.endLine) continue;
    if (!best || s.line > best.line || s.line === best.line && (s.endLine ?? Infinity) <= (best.endLine ?? Infinity)) {
      best = s;
    }
  }
  return best;
}
function buildRawCallerIndex(scan2) {
  const byName = /* @__PURE__ */ new Map();
  for (const f of scan2.files) {
    if (!f.calls?.length) continue;
    const symbols = f.symbols.filter((s) => !REFERENCE_KINDS3.has(s.kind));
    for (const c2 of f.calls) {
      const site = { file: f.rel, line: c2.line };
      if (c2.receiver !== void 0) site.receiver = c2.receiver;
      const enc = enclosingAmong(symbols, c2.line);
      if (enc) site.enclosingSymbol = enc;
      let arr = byName.get(c2.name);
      if (!arr) byName.set(c2.name, arr = []);
      arr.push(site);
    }
  }
  const index = /* @__PURE__ */ new Map();
  for (const name2 of [...byName.keys()].sort(byStr)) {
    const sites = byName.get(name2);
    sites.sort((a, b) => byStr(a.file, b.file) || a.line - b.line);
    index.set(name2, sites);
  }
  return index;
}
var REFERENCE_KINDS3;
var init_callers = __esm({
  "src/callers.ts"() {
    "use strict";
    init_calls();
    init_derived();
    init_sort();
    REFERENCE_KINDS3 = /* @__PURE__ */ new Set(["reexport", "reexport-all", "default"]);
  }
});
function symbolsOverview(scan2, rel) {
  const f = scan2.files.find((x) => x.rel === rel);
  if (!f) return [];
  return [...f.symbols].filter((s) => !REFERENCE_KINDS4.has(s.kind)).sort((a, b) => a.line - b.line || byStr(a.name, b.name));
}
function findSymbol(scan2, namePath, opts = {}) {
  const segments = namePath.split("/").filter(Boolean);
  if (!segments.length) return [];
  const leaf = segments[segments.length - 1];
  const parents = segments.slice(0, -1);
  const matchName = (name2, wanted) => opts.substring ? name2.toLowerCase().includes(wanted.toLowerCase()) : name2 === wanted;
  const out2 = [];
  for (const f of scan2.files) {
    for (const s of f.symbols) {
      if (REFERENCE_KINDS4.has(s.kind)) continue;
      if (!matchName(s.name, leaf)) continue;
      if (parents.length) {
        const parent = parents[parents.length - 1];
        if (!s.parent || s.parent !== parent) continue;
      }
      out2.push({ ...s });
    }
  }
  out2.sort(
    (a, b) => Number(b.name === leaf) - Number(a.name === leaf) || byStr(a.file, b.file) || a.line - b.line
  );
  const capped = out2.slice(0, opts.maxResults ?? 50);
  if (opts.includeBody) {
    for (const m of capped) {
      const end = m.endLine ?? m.line;
      const content = readText(join8(scan2.root, m.file));
      if (!content) continue;
      m.body = content.split("\n").slice(m.line - 1, end).join("\n");
    }
  }
  return capped;
}
function findReferences(scan2, name2) {
  const defs = [];
  for (const f of scan2.files) {
    for (const s of f.symbols) {
      if (s.name === name2 && !REFERENCE_KINDS4.has(s.kind)) defs.push(s);
    }
  }
  defs.sort((a, b) => byStr(a.file, b.file) || a.line - b.line);
  const index = callerIndexFor(scan2);
  const entry = index.get(name2);
  const callSites = entry ? [...entry.callers] : [];
  const referencingFiles = /* @__PURE__ */ new Set();
  const unique = uniqueDefsFor(scan2);
  const defFile = unique.get(name2);
  for (const f of scan2.files) {
    if (f.rel === defFile) continue;
    if (f.kind === "code" && f.idents?.includes(name2)) referencingFiles.add(f.rel);
    else if (f.kind === "doc") {
      const content = scan2.docText.get(f.rel);
      if (content && new RegExp(`\\b${name2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(content)) {
        referencingFiles.add(f.rel);
      }
    }
  }
  for (const site of callSites) referencingFiles.add(site.file);
  return { defs, callSites, referencingFiles: [...referencingFiles].sort(byStr) };
}
var REFERENCE_KINDS4;
var init_query = __esm({
  "src/query.ts"() {
    "use strict";
    init_walk();
    init_derived();
    init_sort();
    REFERENCE_KINDS4 = /* @__PURE__ */ new Set(["reexport", "reexport-all", "default"]);
  }
});
function resolveUniqueSymbol(scan2, namePath, file) {
  let matches = findSymbol(scan2, namePath);
  if (file) matches = matches.filter((m) => m.file === file);
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    const near = findSymbol(scan2, namePath, { substring: true, maxResults: 5 }).map((m) => `${m.file}:${m.line} ${m.parent ? m.parent + "/" : ""}${m.name}`).join(", ");
    throw new Error(`no symbol matches "${namePath}"${file ? ` in ${file}` : ""}${near ? ` \u2014 near matches: ${near}` : ""}`);
  }
  const list = matches.map((m) => `${m.file}:${m.line}`).join(", ");
  throw new Error(`"${namePath}" is ambiguous (${matches.length} matches: ${list}) \u2014 qualify with \`file\` or a Parent/name path`);
}
function readLines(abs) {
  return readFileSync4(abs, "utf8").split("\n");
}
function replaceSymbolBody(scan2, namePath, body2, file) {
  const sym = resolveUniqueSymbol(scan2, namePath, file);
  const end = sym.endLine ?? sym.line;
  const abs = join9(scan2.root, sym.file);
  const lines = readLines(abs);
  const newLines = body2.replace(/^\n+|\n+$/g, "").split("\n");
  lines.splice(sym.line - 1, end - sym.line + 1, ...newLines);
  writeFileSync2(abs, lines.join("\n"));
  return { file: sym.file, startLine: sym.line, endLine: sym.line + newLines.length - 1, lines: newLines.length };
}
function insertAt(scan2, sym, body2, index, blankBefore, blankAfter) {
  const abs = join9(scan2.root, sym.file);
  const lines = readLines(abs);
  const minGap = SEPARATED_KINDS.has(sym.kind) ? 1 : 0;
  const newLines = body2.replace(/^\n+|\n+$/g, "").split("\n");
  const block = [];
  if (blankBefore && minGap && lines[index - 1]?.trim() !== "") block.push("");
  block.push(...newLines);
  if (blankAfter && minGap && lines[index]?.trim() !== "") block.push("");
  lines.splice(index, 0, ...block);
  writeFileSync2(abs, lines.join("\n"));
  return { file: sym.file, startLine: index + 1, endLine: index + block.length, lines: block.length };
}
function insertAfterSymbol(scan2, namePath, body2, file) {
  const sym = resolveUniqueSymbol(scan2, namePath, file);
  const end = sym.endLine ?? sym.line;
  return insertAt(scan2, sym, body2, end, true, true);
}
function insertBeforeSymbol(scan2, namePath, body2, file) {
  const sym = resolveUniqueSymbol(scan2, namePath, file);
  return insertAt(scan2, sym, body2, sym.line - 1, true, true);
}
var SEPARATED_KINDS;
var init_edit = __esm({
  "src/edit.ts"() {
    "use strict";
    init_query();
    SEPARATED_KINDS = /* @__PURE__ */ new Set(["function", "method", "class", "interface", "struct", "trait", "enum", "def"]);
  }
});
function sanitize(name2) {
  const clean = name2.replace(/^mem:/, "").replace(/\.md$/, "");
  if (!clean) throw new Error("memory name is empty");
  const segments = clean.split("/");
  for (const seg of segments) {
    if (!seg || seg === "." || seg === ".." || seg.includes("\\")) {
      throw new Error(`invalid memory name: "${name2}"`);
    }
    if (!/^[\w][\w.-]*$/.test(seg)) throw new Error(`invalid memory name segment: "${seg}"`);
  }
  return clean;
}
function memoryPath(repo, name2) {
  return join10(repo, ...MEMORY_DIR, `${sanitize(name2)}.md`);
}
function writeMemory(repo, name2, content) {
  const path = memoryPath(repo, name2);
  mkdirSync2(dirname3(path), { recursive: true });
  writeFileSync3(path, content.endsWith("\n") ? content : content + "\n");
  return sanitize(name2);
}
function readMemory(repo, name2) {
  try {
    return readFileSync5(memoryPath(repo, name2), "utf8");
  } catch {
    return void 0;
  }
}
function deleteMemory(repo, name2) {
  const path = memoryPath(repo, name2);
  try {
    statSync2(path);
  } catch {
    return false;
  }
  rmSync2(path);
  return true;
}
function listMemories(repo) {
  const root = join10(repo, ...MEMORY_DIR);
  const out2 = [];
  const walk22 = (dir, prefix) => {
    let entries;
    try {
      entries = readdirSync2(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) walk22(join10(dir, e.name), prefix ? `${prefix}/${e.name}` : e.name);
      else if (e.name.endsWith(".md")) out2.push(prefix ? `${prefix}/${e.name.slice(0, -3)}` : e.name.slice(0, -3));
    }
  };
  walk22(root, "");
  return out2.sort();
}
var MEMORY_DIR;
var init_memory = __esm({
  "src/memory.ts"() {
    "use strict";
    MEMORY_DIR = [".codeindex", "memories"];
  }
});
function readJson(path, label, warnings) {
  const raw = readText(path);
  if (!raw) return void 0;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
    if (label && warnings) warnings.push(`malformed ${label}: not a JSON object`);
    return void 0;
  } catch (e) {
    if (label && warnings) {
      const reason = String(e instanceof Error ? e.message : e).split("\n")[0];
      warnings.push(`malformed ${label}: ${reason}`);
    }
    return void 0;
  }
}
function tomlSectionBody(toml, section) {
  const re = new RegExp(`^\\[${escapeRegExp(section)}\\]\\s*$([\\s\\S]*?)(?=^\\[|$(?![\\s\\S]))`, "m");
  const m = toml.match(re);
  return m ? m[1] : null;
}
function tomlStringArray(body2, key) {
  const m = body2.match(new RegExp(`${escapeRegExp(key)}\\s*=\\s*\\[([^\\]]*)\\]`));
  if (!m) return [];
  return m[1].split(/\r?\n/).map((line) => line.replace(/#.*$/, "")).join("\n").split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
}
function tomlString(body2, key) {
  return body2?.match(new RegExp(`^\\s*${escapeRegExp(key)}\\s*=\\s*["']([^"']+)["']`, "m"))?.[1];
}
function wsGlobToRegExp(pat) {
  let re = "";
  for (let i2 = 0; i2 < pat.length; i2++) {
    const c2 = pat[i2];
    if (c2 === "*") {
      if (pat[i2 + 1] === "*") {
        re += ".*";
        i2++;
        if (pat[i2 + 1] === "/") i2++;
      } else {
        re += "[^/]*";
      }
    } else if ("\\^$.|?+()[]{}".includes(c2)) {
      re += "\\" + c2;
    } else {
      re += c2;
    }
  }
  return new RegExp(`^${re}($|/)`);
}
function probeNodePkg(root, dir, kind, warnings) {
  const path = join11(root, dir, "package.json");
  if (!existsSync3(path)) return void 0;
  const manifest = `${dir}/package.json`;
  const pkg = readJson(path, manifest, warnings);
  const out2 = {
    name: typeof pkg?.name === "string" && pkg.name ? pkg.name : dir,
    dir,
    kind,
    manifest
  };
  if (typeof pkg?.description === "string" && pkg.description) out2.description = pkg.description;
  return out2;
}
function probeCargo(root, dir) {
  const path = join11(root, dir, "Cargo.toml");
  if (!existsSync3(path)) return void 0;
  const body2 = tomlSectionBody(readText(path), "package");
  const out2 = {
    name: tomlString(body2, "name") ?? dir,
    dir,
    kind: "cargo",
    manifest: `${dir}/Cargo.toml`
  };
  const description = tomlString(body2, "description");
  if (description) out2.description = description;
  return out2;
}
function probeGoMod(root, dir) {
  const path = join11(root, dir, "go.mod");
  if (!existsSync3(path)) return void 0;
  const name2 = readText(path).match(/^module\s+(\S+)/m)?.[1] ?? dir;
  return { name: name2, dir, kind: "go", manifest: `${dir}/go.mod` };
}
function probeMaven(root, dir) {
  const path = join11(root, dir, "pom.xml");
  if (!existsSync3(path)) return void 0;
  return { name: ownArtifactId(readText(path)) ?? dir, dir, kind: "maven", manifest: `${dir}/pom.xml` };
}
function probePyproject(root, dir) {
  const path = join11(root, dir, "pyproject.toml");
  if (!existsSync3(path)) return void 0;
  const toml = readText(path);
  const project = tomlSectionBody(toml, "project");
  const poetry = tomlSectionBody(toml, "tool.poetry");
  const out2 = {
    name: tomlString(project, "name") ?? tomlString(poetry, "name") ?? dir,
    dir,
    kind: "uv",
    manifest: `${dir}/pyproject.toml`
  };
  const description = tomlString(project, "description") ?? tomlString(poetry, "description");
  if (description) out2.description = description;
  return out2;
}
function probeComposer(root, dir, warnings) {
  const path = join11(root, dir, "composer.json");
  if (!existsSync3(path)) return void 0;
  const manifest = `${dir}/composer.json`;
  const pkg = readJson(path, manifest, warnings);
  const out2 = {
    name: typeof pkg?.name === "string" && pkg.name ? pkg.name : dir,
    dir,
    kind: "composer",
    manifest
  };
  if (typeof pkg?.description === "string" && pkg.description) out2.description = pkg.description;
  return out2;
}
function probeNxProject(root, dir, warnings) {
  const path = join11(root, dir, "project.json");
  if (!existsSync3(path)) return void 0;
  const manifest = `${dir}/project.json`;
  const proj = readJson(path, manifest, warnings);
  return {
    name: typeof proj?.name === "string" && proj.name ? proj.name : dir,
    dir,
    kind: "nx",
    manifest
  };
}
function probeGradle(root, dir) {
  for (const f of ["build.gradle", "build.gradle.kts"]) {
    if (existsSync3(join11(root, dir, f))) {
      return { name: dir, dir, kind: "gradle", manifest: `${dir}/${f}` };
    }
  }
  return void 0;
}
function packageAt(root, dir, kind, warnings) {
  const node = () => probeNodePkg(root, dir, kind, warnings);
  const cargo = () => probeCargo(root, dir);
  const gomod = () => probeGoMod(root, dir);
  const maven = () => probeMaven(root, dir);
  const py = () => probePyproject(root, dir);
  const composer = () => probeComposer(root, dir, warnings);
  const nx = () => probeNxProject(root, dir, warnings);
  const gradle = () => probeGradle(root, dir);
  const probes = kind === "go" ? [gomod, node, cargo, maven, py, composer, nx] : kind === "uv" ? [py, node, cargo, gomod, maven, composer, nx] : kind === "composer" ? [composer, node, py, cargo, gomod, maven, nx] : kind === "gradle" ? [node, maven, cargo, gomod, py, composer, nx, gradle] : [node, cargo, gomod, maven, py, composer, nx];
  for (const probe of probes) {
    const pkg = probe();
    if (pkg) return pkg;
  }
  return void 0;
}
function ownArtifactId(pom) {
  const stripped = pom.replace(/<parent>[\s\S]*?<\/parent>/g, "").replace(/<dependencies>[\s\S]*?<\/dependencies>/g, "");
  return stripped.match(/<artifactId>\s*([^<]+?)\s*<\/artifactId>/)?.[1];
}
function addPackage(root, dir, found, kind, warnings) {
  const clean = dir.replace(/^\.\//, "").replace(/\/+$/, "");
  if (!clean || clean === "." || found.has(clean)) return;
  if (clean.split("/").includes("..")) return;
  const pkg = packageAt(root, clean, kind, warnings);
  if (pkg) found.set(clean, pkg);
}
function isDirAt(root, rel) {
  try {
    return statSync3(join11(root, rel)).isDirectory();
  } catch {
    return false;
  }
}
function subdirsOf(root, base) {
  let entries;
  try {
    entries = readdirSync3(base ? join11(root, base) : root, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.filter((e) => e.isDirectory() && !e.name.startsWith(".") && !WS_SKIP_DIRS.has(e.name)).map((e) => base ? `${base}/${e.name}` : e.name).sort(byStr);
}
function descendantsOf(root, base, depth, out2) {
  if (depth > MAX_RECURSE_DEPTH) return;
  for (const sub of subdirsOf(root, base)) {
    out2.push(sub);
    descendantsOf(root, sub, depth + 1, out2);
  }
}
function expandGlobDirs(root, pat) {
  const segs = pat.split("/").filter((s) => s && s !== ".");
  if (segs.includes("..")) return [];
  let dirs = [""];
  for (const seg of segs) {
    const next = /* @__PURE__ */ new Set();
    if (seg === "**") {
      for (const d of dirs) {
        if (d) next.add(d);
        const desc = [];
        descendantsOf(root, d, 0, desc);
        for (const s of desc) next.add(s);
      }
    } else if (seg.includes("*")) {
      const re = new RegExp(`^${seg.split("*").map(escapeRegExp).join("[^/]*")}$`);
      for (const d of dirs) {
        for (const sub of subdirsOf(root, d)) {
          if (re.test(sub.split("/").pop())) next.add(sub);
        }
      }
    } else {
      for (const d of dirs) {
        const cand = d ? `${d}/${seg}` : seg;
        if (isDirAt(root, cand)) next.add(cand);
      }
    }
    dirs = [...next];
    if (!dirs.length) return [];
  }
  return dirs.filter(Boolean);
}
function expandPattern(root, raw, found, kind, warnings) {
  const pat = raw.replace(/^\.\//, "").replace(/\/+$/, "");
  if (!pat) return;
  if (!pat.includes("*")) {
    addPackage(root, pat, found, kind, warnings);
    return;
  }
  for (const dir of expandGlobDirs(root, pat)) addPackage(root, dir, found, kind, warnings);
}
function npmFamilyPatterns(root, warnings) {
  const positives = [];
  const negations = [];
  const push = (raw, kind) => {
    const t = raw.trim();
    if (!t) return;
    if (t.startsWith("!")) negations.push(t.slice(1));
    else positives.push({ pattern: t, kind });
  };
  const pkg = readJson(join11(root, "package.json"), "package.json", warnings);
  const ws = pkg?.workspaces;
  if (Array.isArray(ws)) {
    for (const x of ws) if (typeof x === "string") push(x, "npm");
  } else if (ws && typeof ws === "object" && Array.isArray(ws.packages)) {
    for (const x of ws.packages) if (typeof x === "string") push(x, "npm");
  }
  const pnpm = readText(join11(root, "pnpm-workspace.yaml"));
  let inPackages = false;
  for (const line of pnpm.split(/\r?\n/)) {
    if (/^\S/.test(line)) {
      inPackages = /^packages\s*:/.test(line);
      continue;
    }
    if (!inPackages) continue;
    const m = line.match(/^\s*-\s*['"]?([^'"#]+?)['"]?\s*(?:#.*)?$/);
    if (m) push(m[1].trim(), "pnpm");
  }
  return { positives, negations };
}
function fallbackNpmPatterns(root, warnings) {
  const lerna = readJson(join11(root, "lerna.json"), "lerna.json", warnings);
  if (lerna && Array.isArray(lerna.packages)) {
    return lerna.packages.filter((x) => typeof x === "string").map((pattern) => ({ pattern, kind: "lerna" }));
  }
  const nx = readJson(join11(root, "nx.json"), "nx.json", warnings);
  if (nx) {
    const layout = nx.workspaceLayout ?? {};
    const appsDir = typeof layout.appsDir === "string" ? layout.appsDir : "apps";
    const libsDir = typeof layout.libsDir === "string" ? layout.libsDir : "libs";
    return [.../* @__PURE__ */ new Set([appsDir, libsDir])].map((dir) => ({ pattern: `${dir}/*`, kind: "nx" }));
  }
  return [];
}
function detectCargoMembers(root, found, warnings) {
  const toml = readText(join11(root, "Cargo.toml"));
  if (!toml) return;
  const body2 = tomlSectionBody(toml, "workspace");
  if (!body2) return;
  const members = tomlStringArray(body2, "members");
  if (!members.length) return;
  const excludes = tomlStringArray(body2, "exclude").map(wsGlobToRegExp);
  const candidates = /* @__PURE__ */ new Map();
  for (const pat of members) expandPattern(root, pat, candidates, "cargo", warnings);
  for (const [dir, pkg] of candidates) {
    if (excludes.some((re) => re.test(dir))) continue;
    if (!found.has(dir)) found.set(dir, pkg);
  }
}
function detectGoWork(root, found, warnings) {
  const gowork = readText(join11(root, "go.work"));
  if (!gowork) return;
  const dirs = [];
  for (const block of gowork.matchAll(/^use\s*\(([\s\S]*?)\)/gm)) {
    for (const line of block[1].split(/\r?\n/)) {
      const t = line.replace(/\/\/.*$/, "").trim();
      if (t) dirs.push(t);
    }
  }
  for (const m of gowork.matchAll(/^use\s+([^\s(]+)/gm)) dirs.push(m[1]);
  for (const dir of dirs) {
    if (dir === "." || dir === "./") continue;
    addPackage(root, dir, found, "go", warnings);
  }
}
function detectMavenModules(root, found, warnings) {
  const pom = readText(join11(root, "pom.xml"));
  if (!pom) return;
  const modules = pom.match(/<modules>([\s\S]*?)<\/modules>/)?.[1];
  if (!modules) return;
  for (const m of modules.matchAll(/<module>\s*([^<]+?)\s*<\/module>/g)) {
    addPackage(root, m[1], found, "maven", warnings);
  }
}
function detectUvMembers(root, found, warnings) {
  const toml = readText(join11(root, "pyproject.toml"));
  if (!toml) return;
  const body2 = tomlSectionBody(toml, "tool.uv.workspace");
  if (!body2) return;
  const members = tomlStringArray(body2, "members");
  if (!members.length) return;
  const excludes = tomlStringArray(body2, "exclude").map(wsGlobToRegExp);
  const candidates = /* @__PURE__ */ new Map();
  for (const pat of members) expandPattern(root, pat, candidates, "uv", warnings);
  for (const [dir, pkg] of candidates) {
    if (excludes.some((re) => re.test(dir))) continue;
    if (!found.has(dir)) found.set(dir, pkg);
  }
}
function detectComposerPathRepos(root, found, warnings) {
  const composer = readJson(join11(root, "composer.json"), "composer.json", warnings);
  const repos = composer?.repositories;
  if (!Array.isArray(repos)) return;
  for (const r of repos) {
    if (!r || typeof r !== "object") continue;
    const { type, url } = r;
    if (type === "path" && typeof url === "string" && url) expandPattern(root, url, found, "composer", warnings);
  }
}
function detectGradleIncludes(root, found, warnings) {
  for (const f of ["settings.gradle", "settings.gradle.kts"]) {
    const text = readText(join11(root, f));
    if (!text) continue;
    for (const line of text.split(/\r?\n/)) {
      if (!/^\s*include[\s(]/.test(line)) continue;
      for (const m of line.matchAll(/["']([^"']+)["']/g)) {
        const dir = m[1].replace(/^:/, "").replace(/:/g, "/");
        if (dir) addPackage(root, dir, found, "gradle", warnings);
      }
    }
  }
}
function npmEdges(root, pkg, byName, warnings) {
  const manifest = readJson(join11(root, pkg.dir, "package.json"), `${pkg.dir}/package.json`, warnings);
  if (!manifest) return [];
  const edges = /* @__PURE__ */ new Set();
  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    const deps = manifest[field];
    if (!deps || typeof deps !== "object") continue;
    for (const dep of Object.keys(deps)) {
      if (dep !== pkg.name && byName.has(dep)) edges.add(dep);
    }
  }
  return [...edges];
}
function normalizeDepPath(fromDir, rel) {
  const parts2 = `${fromDir}/${rel}`.split("/");
  const out2 = [];
  for (const p of parts2) {
    if (!p || p === ".") continue;
    if (p === "..") out2.pop();
    else out2.push(p);
  }
  return out2.join("/");
}
function cargoEdges(root, pkg, byName, byDir) {
  const toml = readText(join11(root, pkg.dir, "Cargo.toml"));
  if (!toml) return [];
  const edges = /* @__PURE__ */ new Set();
  for (const section of ["dependencies", "dev-dependencies", "build-dependencies"]) {
    const body2 = tomlSectionBody(toml, section);
    if (!body2) continue;
    for (const line of body2.split(/\r?\n/)) {
      const kv = line.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
      if (!kv) continue;
      const dep = kv[1];
      if (dep !== pkg.name && byName.has(dep)) {
        edges.add(dep);
        continue;
      }
      const pathDep = kv[2].match(/path\s*=\s*["']([^"']+)["']/);
      if (pathDep) {
        const target = byDir.get(normalizeDepPath(pkg.dir, pathDep[1]));
        if (target && target !== pkg.name) edges.add(target);
      }
    }
  }
  return [...edges];
}
function goPkgEdges(root, pkg, byName, byDir) {
  const gomod = readText(join11(root, pkg.dir, "go.mod"));
  if (!gomod) return [];
  const edges = /* @__PURE__ */ new Set();
  for (const m of gomod.matchAll(/^\s*(?:require\s+)?([^\s/(][^\s]*)\s+v[^\s]+/gm)) {
    const dep = m[1];
    if (dep !== pkg.name && byName.has(dep)) edges.add(dep);
  }
  for (const m of gomod.matchAll(/^\s*(?:replace\s+)?(\S+)(?:\s+\S+)?\s*=>\s*(\.\.?\/\S+)/gm)) {
    const target = byDir.get(normalizeDepPath(pkg.dir, m[2]));
    if (target && target !== pkg.name) edges.add(target);
  }
  return [...edges];
}
function mavenEdges(root, pkg, byName) {
  const pom = readText(join11(root, pkg.dir, "pom.xml"));
  if (!pom) return [];
  const edges = /* @__PURE__ */ new Set();
  for (const m of pom.replace(/<parent>[\s\S]*?<\/parent>/g, "").matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
    const aid = m[1].match(/<artifactId>\s*([^<]+?)\s*<\/artifactId>/)?.[1];
    if (aid && aid !== pkg.name && byName.has(aid)) edges.add(aid);
  }
  return [...edges];
}
function uvEdges(root, pkg, byName) {
  const toml = readText(join11(root, pkg.dir, "pyproject.toml"));
  if (!toml) return [];
  const edges = /* @__PURE__ */ new Set();
  const project = tomlSectionBody(toml, "project");
  if (project) {
    for (const dep of tomlStringArray(project, "dependencies")) {
      const name2 = dep.match(/^[A-Za-z0-9_.-]+/)?.[0];
      if (name2 && name2 !== pkg.name && byName.has(name2)) edges.add(name2);
    }
  }
  const sources = tomlSectionBody(toml, "tool.uv.sources");
  if (sources) {
    for (const line of sources.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_.-]+)\s*=\s*\{[^}]*workspace\s*=\s*true/);
      if (m && m[1] !== pkg.name && byName.has(m[1])) edges.add(m[1]);
    }
  }
  return [...edges];
}
function composerEdges(root, pkg, byName, warnings) {
  const manifest = readJson(join11(root, pkg.dir, "composer.json"), `${pkg.dir}/composer.json`, warnings);
  if (!manifest) return [];
  const edges = /* @__PURE__ */ new Set();
  for (const field of ["require", "require-dev"]) {
    const deps = manifest[field];
    if (!deps || typeof deps !== "object") continue;
    for (const dep of Object.keys(deps)) {
      if (dep !== pkg.name && byName.has(dep)) edges.add(dep);
    }
  }
  return [...edges];
}
function gradleEdges(root, pkg, byName, byDir) {
  for (const f of ["build.gradle", "build.gradle.kts"]) {
    const text = readText(join11(root, pkg.dir, f));
    if (!text) continue;
    const edges = /* @__PURE__ */ new Set();
    for (const m of text.matchAll(/project\s*\(\s*["']:?([^"']+)["']\s*\)/g)) {
      const path = m[1].replace(/:/g, "/");
      const target = byDir.get(path) ?? (byName.has(path) ? path : void 0);
      if (target && target !== pkg.name) edges.add(target);
    }
    return [...edges];
  }
  return [];
}
function edgesFor(root, pkg, byName, byDir, warnings) {
  switch (pkg.kind) {
    case "cargo":
      return cargoEdges(root, pkg, byName, byDir);
    case "go":
      return goPkgEdges(root, pkg, byName, byDir);
    case "maven":
      return mavenEdges(root, pkg, byName);
    case "uv":
      return uvEdges(root, pkg, byName);
    case "composer":
      return composerEdges(root, pkg, byName, warnings);
    case "gradle":
      return gradleEdges(root, pkg, byName, byDir);
    default:
      return npmEdges(root, pkg, byName, warnings);
  }
}
function findCycle(packages) {
  const deps = new Map(packages.map((p) => [p.name, [...p.dependsOn ?? []].sort(byStr)]));
  const state = /* @__PURE__ */ new Map();
  const stack = [];
  const visit = (name2) => {
    state.set(name2, "visiting");
    stack.push(name2);
    for (const dep of deps.get(name2) ?? []) {
      if (!deps.has(dep)) continue;
      if (state.get(dep) === "visiting") return [...stack.slice(stack.indexOf(dep)), dep];
      if (!state.has(dep)) {
        const found = visit(dep);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(name2, "done");
    return null;
  };
  for (const name2 of [...deps.keys()].sort(byStr)) {
    if (!state.has(name2)) {
      const found = visit(name2);
      if (found) return found;
    }
  }
  return void 0;
}
function topoOrder(packages) {
  const remaining = new Map(packages.map((p) => [p.name, new Set(p.dependsOn ?? [])]));
  const order = [];
  while (remaining.size > 0) {
    const ready = [...remaining.entries()].filter(([, deps]) => [...deps].every((d) => !remaining.has(d))).map(([name2]) => name2).sort(byStr);
    if (!ready.length) {
      order.push(...[...remaining.keys()].sort(byStr));
      break;
    }
    for (const name2 of ready) {
      order.push(name2);
      remaining.delete(name2);
    }
  }
  return order;
}
function detectWorkspaces(root) {
  const warnings = [];
  const found = /* @__PURE__ */ new Map();
  const { positives, negations } = npmFamilyPatterns(root, warnings);
  const npmPatterns = positives.length ? positives : fallbackNpmPatterns(root, warnings);
  if (npmPatterns.length) {
    const candidates = /* @__PURE__ */ new Map();
    for (const { pattern, kind } of npmPatterns) expandPattern(root, pattern, candidates, kind, warnings);
    const negRes = negations.map(wsGlobToRegExp);
    for (const [dir, pkg] of candidates) {
      if (negRes.some((re) => re.test(dir))) continue;
      found.set(dir, pkg);
    }
  }
  detectCargoMembers(root, found, warnings);
  detectGoWork(root, found, warnings);
  detectMavenModules(root, found, warnings);
  detectUvMembers(root, found, warnings);
  detectComposerPathRepos(root, found, warnings);
  detectGradleIncludes(root, found, warnings);
  const packages = [...found.values()].sort((a, b) => byStr(a.dir, b.dir));
  const byName = new Set(packages.map((p) => p.name));
  const byDir = new Map(packages.map((p) => [p.dir, p.name]));
  for (const pkg of packages) {
    const edges = edgesFor(root, pkg, byName, byDir, warnings);
    if (edges.length) pkg.dependsOn = edges.sort(byStr);
  }
  const byDepth = [...packages].sort((a, b) => b.dir.length - a.dir.length);
  return {
    packages,
    cycle: findCycle(packages),
    topoOrder: topoOrder(packages),
    warnings: [...new Set(warnings)].sort(byStr),
    packageOf: (rel) => byDepth.find((p) => rel === p.dir || rel.startsWith(p.dir + "/"))
  };
}
var WS_SKIP_DIRS;
var MAX_RECURSE_DEPTH;
var init_workspaces = __esm({
  "src/workspaces.ts"() {
    "use strict";
    init_walk();
    init_sort();
    init_util();
    WS_SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", "build", "target", "coverage"]);
    MAX_RECURSE_DEPTH = 4;
  }
});
function pagerankOf(ids, edges, damping = DAMPING) {
  const out2 = /* @__PURE__ */ new Map();
  const n = ids.length;
  if (n === 0) return out2;
  const idx = new Map(ids.map((s, i2) => [s, i2]));
  const adj = Array.from({ length: n }, () => []);
  const outW = new Array(n).fill(0);
  for (const e of edges) {
    if (e.dangling) continue;
    const a = idx.get(e.from);
    const b = idx.get(e.to);
    if (a === void 0 || b === void 0 || a === b) continue;
    adj[a].push([b, e.weight]);
    outW[a] += e.weight;
  }
  let pr = new Array(n).fill(1 / n);
  for (let iter = 0; iter < MAX_ITERS; iter++) {
    let dangling = 0;
    for (let i2 = 0; i2 < n; i2++) if (outW[i2] === 0) dangling += pr[i2];
    const base = (1 - damping) / n + damping * dangling / n;
    const next = new Array(n).fill(base);
    for (let i2 = 0; i2 < n; i2++) {
      if (outW[i2] === 0) continue;
      const share = damping * pr[i2] / outW[i2];
      for (const [j, w] of adj[i2]) next[j] += share * w;
    }
    let delta = 0;
    for (let i2 = 0; i2 < n; i2++) delta += Math.abs(next[i2] - pr[i2]);
    pr = next;
    if (delta < CONVERGENCE) break;
  }
  ids.forEach((s, i2) => out2.set(s, pr[i2]));
  return out2;
}
function betweennessOf(ids, edges) {
  const out2 = /* @__PURE__ */ new Map();
  for (const s of ids) out2.set(s, 0);
  const n = ids.length;
  if (n < 3) return out2;
  const idx = new Map(ids.map((s, i2) => [s, i2]));
  const nbSets = Array.from({ length: n }, () => /* @__PURE__ */ new Set());
  for (const e of edges) {
    if (e.dangling) continue;
    const a = idx.get(e.from);
    const b = idx.get(e.to);
    if (a === void 0 || b === void 0 || a === b) continue;
    nbSets[a].add(b);
    nbSets[b].add(a);
  }
  const adj = nbSets.map((s) => [...s].sort((x, y) => x - y));
  const cb = new Array(n).fill(0);
  for (let s = 0; s < n; s++) {
    const stack = [];
    const pred = Array.from({ length: n }, () => []);
    const sigma = new Array(n).fill(0);
    const dist = new Array(n).fill(-1);
    sigma[s] = 1;
    dist[s] = 0;
    const queue = [s];
    for (let qi = 0; qi < queue.length; qi++) {
      const v = queue[qi];
      stack.push(v);
      for (const w of adj[v]) {
        if (dist[w] < 0) {
          dist[w] = dist[v] + 1;
          queue.push(w);
        }
        if (dist[w] === dist[v] + 1) {
          sigma[w] += sigma[v];
          pred[w].push(v);
        }
      }
    }
    const delta = new Array(n).fill(0);
    for (let si = stack.length - 1; si >= 0; si--) {
      const w = stack[si];
      for (const v of pred[w]) delta[v] += sigma[v] / sigma[w] * (1 + delta[w]);
      if (w !== s) cb[w] += delta[w];
    }
  }
  const norm2 = (n - 1) * (n - 2) / 2;
  ids.forEach((id, i2) => out2.set(id, cb[i2] / 2 / norm2));
  return out2;
}
function applyCentrality(graph) {
  const notes = [];
  const nM = graph.modules.length;
  if (nM > 0) {
    const mIds = graph.modules.map((m) => m.id);
    const mPr = pagerankOf(mIds, graph.moduleEdges);
    for (const m of graph.modules) m.pagerank = Number(((mPr.get(m.id) ?? 0) * nM).toFixed(4));
    if (nM > BETWEENNESS_MAX_NODES) {
      notes.push(`betweenness skipped (${nM} modules > ${BETWEENNESS_MAX_NODES})`);
    } else {
      const bt = betweennessOf(mIds, graph.moduleEdges);
      for (const m of graph.modules) m.betweenness = Number((bt.get(m.id) ?? 0).toFixed(6));
    }
  }
  const nF = graph.files.length;
  if (nF > 0) {
    const fIds = graph.files.map((f) => f.id);
    const fPr = pagerankOf(fIds, graph.fileEdges);
    for (const f of graph.files) f.pagerank = Number(((fPr.get(f.id) ?? 0) * nF).toFixed(4));
  }
  return notes;
}
var DAMPING;
var MAX_ITERS;
var CONVERGENCE;
var BETWEENNESS_MAX_NODES;
var init_centrality = __esm({
  "src/centrality.ts"() {
    "use strict";
    DAMPING = 0.85;
    MAX_ITERS = 100;
    CONVERGENCE = 1e-10;
    BETWEENNESS_MAX_NODES = 3e3;
  }
});
function communityOf(graph, slug) {
  return graph.modules.find((m) => m.slug === slug)?.community;
}
function buildAdjacency(slugs, edges) {
  const n = slugs.length;
  const idx = new Map(slugs.map((s, i2) => [s, i2]));
  const adj = Array.from({ length: n }, () => /* @__PURE__ */ new Map());
  for (const e of edges) {
    if (e.dangling) continue;
    const a = idx.get(e.from);
    const b = idx.get(e.to);
    if (a === void 0 || b === void 0 || a === b) continue;
    adj[a].set(b, (adj[a].get(b) ?? 0) + e.weight);
    adj[b].set(a, (adj[b].get(a) ?? 0) + e.weight);
  }
  const k = adj.map((m) => {
    let s = 0;
    for (const w of m.values()) s += w;
    return s;
  });
  const twoM = k.reduce((a, b) => a + b, 0);
  return { n, adj, k, twoM };
}
function canonicalize(comm) {
  const remap = /* @__PURE__ */ new Map();
  const out2 = new Array(comm.length);
  for (let i2 = 0; i2 < comm.length; i2++) {
    let id = remap.get(comm[i2]);
    if (id === void 0) {
      id = remap.size;
      remap.set(comm[i2], id);
    }
    out2[i2] = id;
  }
  return { comm: out2, count: remap.size };
}
function localMove(g) {
  const { n, adj, k, twoM } = g;
  const comm = Array.from({ length: n }, (_, i2) => i2);
  if (twoM === 0) return canonicalize(comm);
  const commTot = k.slice();
  let moved = true;
  let sweeps = 0;
  while (moved && sweeps < MAX_SWEEPS) {
    moved = false;
    sweeps++;
    for (let i2 = 0; i2 < n; i2++) {
      const cOld = comm[i2];
      commTot[cOld] -= k[i2];
      const nb = /* @__PURE__ */ new Map();
      for (const [j, wij] of adj[i2]) {
        if (j === i2) continue;
        const cj = comm[j];
        nb.set(cj, (nb.get(cj) ?? 0) + wij);
      }
      let bestC = cOld;
      let bestScore = (nb.get(cOld) ?? 0) - GAMMA * k[i2] * commTot[cOld] / twoM;
      for (const c2 of [...nb.keys()].sort((a, b) => a - b)) {
        if (c2 === cOld) continue;
        const score = nb.get(c2) - GAMMA * k[i2] * commTot[c2] / twoM;
        if (score > bestScore + EPS) {
          bestScore = score;
          bestC = c2;
        }
      }
      commTot[bestC] += k[i2];
      if (bestC !== cOld) {
        comm[i2] = bestC;
        moved = true;
      }
    }
  }
  return canonicalize(comm);
}
function aggregate(g, comm, count) {
  const adj = Array.from({ length: count }, () => /* @__PURE__ */ new Map());
  for (let i2 = 0; i2 < g.n; i2++) {
    const ci = comm[i2];
    for (const [j, wij] of g.adj[i2]) {
      const cj = comm[j];
      adj[ci].set(cj, (adj[ci].get(cj) ?? 0) + wij);
    }
  }
  const k = adj.map((m) => {
    let s = 0;
    for (const w of m.values()) s += w;
    return s;
  });
  const twoM = k.reduce((a, b) => a + b, 0);
  return { n: count, adj, k, twoM };
}
function louvain(g) {
  if (g.n === 0) return [];
  let level = g;
  const mapping = Array.from({ length: g.n }, (_, i2) => i2);
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const { comm, count } = localMove(level);
    for (let i2 = 0; i2 < mapping.length; i2++) mapping[i2] = comm[mapping[i2]];
    if (count === level.n) break;
    level = aggregate(level, comm, count);
  }
  return canonicalize(mapping).comm;
}
function groupByLabel(labels) {
  const groups = [];
  for (let i2 = 0; i2 < labels.length; i2++) {
    (groups[labels[i2]] ??= []).push(i2);
  }
  return groups.filter((g) => g && g.length > 0);
}
function louvainInduced(g, members) {
  const m = members.length;
  const local = /* @__PURE__ */ new Map();
  members.forEach((b, li) => local.set(b, li));
  const adj = Array.from({ length: m }, () => /* @__PURE__ */ new Map());
  for (let li = 0; li < m; li++) {
    for (const [nb, w] of g.adj[members[li]]) {
      const lj = local.get(nb);
      if (lj === void 0) continue;
      adj[li].set(lj, w);
    }
  }
  const k = adj.map((mp) => {
    let s = 0;
    for (const w of mp.values()) s += w;
    return s;
  });
  const twoM = k.reduce((a, b) => a + b, 0);
  const labels = louvain({ n: m, adj, k, twoM });
  return groupByLabel(labels).map((grp) => grp.map((li) => members[li]));
}
function splitOversized(groups, g, n) {
  const out2 = [];
  for (const grp of groups) {
    if (grp.length > OVERSIZE_FRACTION * n && grp.length >= OVERSIZE_MIN) {
      const sub = louvainInduced(g, grp);
      if (sub.length > 1) {
        out2.push(...sub);
        continue;
      }
    }
    out2.push(grp);
  }
  return out2;
}
function compareCommunities(a, b) {
  if (a.length !== b.length) return b.length - a.length;
  for (let i2 = 0; i2 < a.length; i2++) {
    const c2 = byStr(a[i2], b[i2]);
    if (c2) return c2;
  }
  return 0;
}
function assignIds(ordered, previous) {
  const n = ordered.length;
  const ids = new Array(n).fill(-1);
  if (!previous || Object.keys(previous).length === 0) {
    for (let i2 = 0; i2 < n; i2++) ids[i2] = i2;
    return ids;
  }
  const prevSets = Object.entries(previous).map(([id, members]) => ({
    id: Number(id),
    set: new Set(members)
  }));
  const pairs = [];
  ordered.forEach((comm, ni) => {
    for (const prev of prevSets) {
      let inter = 0;
      for (const s of comm) if (prev.set.has(s)) inter++;
      if (inter > 0) pairs.push({ ni, prevId: prev.id, inter });
    }
  });
  pairs.sort((a, b) => b.inter - a.inter || a.ni - b.ni || a.prevId - b.prevId);
  const matched = /* @__PURE__ */ new Map();
  const usedPrev = /* @__PURE__ */ new Set();
  for (const p of pairs) {
    if (matched.has(p.ni) || usedPrev.has(p.prevId)) continue;
    matched.set(p.ni, p.prevId);
    usedPrev.add(p.prevId);
  }
  const taken = /* @__PURE__ */ new Set();
  for (let ni = 0; ni < n; ni++) {
    const pid = matched.get(ni);
    if (pid !== void 0 && pid >= 0 && pid < n && !taken.has(pid)) {
      ids[ni] = pid;
      taken.add(pid);
    }
  }
  const free = [];
  for (let id = 0; id < n; id++) if (!taken.has(id)) free.push(id);
  let fi = 0;
  for (let ni = 0; ni < n; ni++) if (ids[ni] === -1) ids[ni] = free[fi++];
  return ids;
}
function detectCommunities(modules, edges, previous) {
  const out2 = /* @__PURE__ */ new Map();
  if (modules.length === 0) return out2;
  const slugs = modules.map((m) => m.slug).sort(byStr);
  const g = buildAdjacency(slugs, edges);
  const labels = louvain(g);
  const split = splitOversized(groupByLabel(labels), g, slugs.length);
  const communities = split.map((grp) => grp.map((i2) => slugs[i2]).sort(byStr));
  communities.sort(compareCommunities);
  const ids = assignIds(communities, previous);
  communities.forEach((comm, ni) => {
    for (const s of comm) out2.set(s, ids[ni]);
  });
  return out2;
}
var GAMMA;
var MAX_SWEEPS;
var MAX_PASSES;
var EPS;
var OVERSIZE_FRACTION;
var OVERSIZE_MIN;
var init_community = __esm({
  "src/community.ts"() {
    "use strict";
    init_sort();
    GAMMA = 1;
    MAX_SWEEPS = 20;
    MAX_PASSES = 10;
    EPS = 1e-12;
    OVERSIZE_FRACTION = 0.25;
    OVERSIZE_MIN = 10;
  }
});
function isTestPath(rel) {
  if (TEST_DIR.test(rel)) return true;
  if (isTestFile(rel)) return true;
  const base = rel.split("/").pop();
  return BASENAME_PATTERNS.some((p) => p.test(base));
}
function computeTestMap(graph) {
  const testFiles = /* @__PURE__ */ new Set();
  const moduleOf = /* @__PURE__ */ new Map();
  for (const f of graph.files) {
    moduleOf.set(f.rel, f.module);
    if (f.fileKind === "code" && isTestPath(f.rel)) testFiles.add(f.rel);
  }
  const byFile = /* @__PURE__ */ new Map();
  const byModule = /* @__PURE__ */ new Map();
  for (const e of graph.fileEdges) {
    if (e.dangling) continue;
    if (e.kind !== "import" && e.kind !== "use" && e.kind !== "call") continue;
    if (!testFiles.has(e.from) || testFiles.has(e.to)) continue;
    let set = byFile.get(e.to);
    if (!set) byFile.set(e.to, set = /* @__PURE__ */ new Set());
    set.add(e.from);
    const slug = moduleOf.get(e.to);
    if (slug !== void 0) {
      let mset = byModule.get(slug);
      if (!mset) byModule.set(slug, mset = /* @__PURE__ */ new Set());
      mset.add(e.from);
    }
  }
  const sortSets = (m) => {
    const out2 = /* @__PURE__ */ new Map();
    for (const key of [...m.keys()].sort(byStr)) out2.set(key, [...m.get(key)].sort(byStr));
    return out2;
  };
  return { testFiles, testedByFile: sortSets(byFile), testedByModule: sortSets(byModule) };
}
function testsForModule(graph, slug) {
  const m = graph.modules.find((x) => x.slug === slug);
  if (m?.testedBy) return m.testedBy;
  return computeTestMap(graph).testedByModule.get(slug) ?? [];
}
function untestedModules(graph) {
  const tm = computeTestMap(graph);
  const codeMembers = /* @__PURE__ */ new Map();
  for (const f of graph.files) {
    if (f.fileKind !== "code" || tm.testFiles.has(f.rel)) continue;
    codeMembers.set(f.module, (codeMembers.get(f.module) ?? 0) + 1);
  }
  return graph.modules.filter(
    (m) => m.tier <= 1 && m.symbols > 0 && (codeMembers.get(m.slug) ?? 0) > 0 && !tm.testedByModule.has(m.slug)
  );
}
var BASENAME_PATTERNS;
var TEST_DIR;
var init_tests_map = __esm({
  "src/tests-map.ts"() {
    "use strict";
    init_modules();
    init_sort();
    BASENAME_PATTERNS = [
      /^test_.*\.py$/i,
      /_test\.py$/i,
      /_test\.go$/,
      /(Test|Tests|IT)\.java$/,
      /(Test|Tests)\.kt$/,
      /_spec\.rb$/,
      /_test\.rb$/,
      /Test\.php$/,
      /(Test|Tests)\.cs$/,
      /_test\.exs$/
    ];
    TEST_DIR = /(^|\/)(tests?|__tests?__|spec|specs|e2e)(\/|$)/i;
  }
});
function computeSurprises(graph) {
  const commOf = /* @__PURE__ */ new Map();
  const tierOf2 = /* @__PURE__ */ new Map();
  for (const m of graph.modules) {
    if (m.community !== void 0) commOf.set(m.slug, m.community);
    tierOf2.set(m.slug, m.tier);
  }
  const pairCount = /* @__PURE__ */ new Map();
  const pairKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
  const candidates = [];
  for (const e of graph.moduleEdges) {
    if (e.dangling) continue;
    const ca = commOf.get(e.from);
    const cb = commOf.get(e.to);
    if (ca === void 0 || cb === void 0 || ca === cb) continue;
    pairCount.set(pairKey(ca, cb), (pairCount.get(pairKey(ca, cb)) ?? 0) + 1);
    if (!DEP_KINDS.has(e.kind)) continue;
    if (tierOf2.get(e.to) === 0) continue;
    candidates.push({ edge: e, comms: [ca, cb] });
  }
  return candidates.filter((c2) => pairCount.get(pairKey(c2.comms[0], c2.comms[1])) <= MAX_PAIR_EDGES).map((c2) => ({
    from: c2.edge.from,
    to: c2.edge.to,
    kind: c2.edge.kind,
    weight: c2.edge.weight,
    communities: c2.comms,
    pairEdges: pairCount.get(pairKey(c2.comms[0], c2.comms[1]))
  })).sort((a, b) => a.pairEdges - b.pairEdges || byStr(a.from, b.from) || byStr(a.to, b.to)).slice(0, SURPRISE_CAP);
}
function isSurprising(graph, from, to) {
  const list = graph.surprises ?? computeSurprises(graph);
  return list.some((s) => s.from === from && s.to === to);
}
var SURPRISE_CAP;
var MAX_PAIR_EDGES;
var DEP_KINDS;
var init_surprise = __esm({
  "src/surprise.ts"() {
    "use strict";
    init_sort();
    SURPRISE_CAP = 24;
    MAX_PAIR_EDGES = 2;
    DEP_KINDS = /* @__PURE__ */ new Set(["import", "call", "use"]);
  }
});
function sortObject(obj) {
  const out2 = {};
  for (const k of Object.keys(obj).sort(byStr)) out2[k] = obj[k];
  return out2;
}
function renderGraphJson(graph) {
  const ordered = { ...graph, languages: sortObject(graph.languages) };
  return JSON.stringify(ordered, null, 2) + "\n";
}
var init_graph_json = __esm({
  "src/render/graph-json.ts"() {
    "use strict";
    init_sort();
  }
});
function buildIndexArtifacts(repo, opts = {}) {
  return buildArtifactsFromScan(scanRepo(repo, opts), opts);
}
function buildArtifactsFromScan(scan2, opts = {}) {
  const ctx = resolveContextFor(scan2);
  const { modules, moduleOf } = buildModules(scan2);
  const graph = buildGraph(scan2, ctx, modules, moduleOf, opts.meta);
  const communities = detectCommunities(graph.modules, graph.moduleEdges, opts.previousCommunities);
  for (const m of graph.modules) {
    const id = communities.get(m.slug);
    if (id !== void 0) m.community = id;
  }
  applyCentrality(graph);
  const testMap = computeTestMap(graph);
  for (const f of graph.files) {
    if (testMap.testFiles.has(f.rel)) f.testFile = true;
  }
  for (const m of graph.modules) {
    const t = testMap.testedByModule.get(m.slug);
    if (t?.length) m.testedBy = t;
  }
  const surprises = computeSurprises(graph);
  if (surprises.length) graph.surprises = surprises;
  const symbols = buildSymbolIndex(scan2, symbolRefsFor(scan2));
  return { scan: scan2, graph, symbols };
}
var init_pipeline = __esm({
  "src/pipeline.ts"() {
    "use strict";
    init_scan();
    init_derived();
    init_modules();
    init_graph();
    init_community();
    init_centrality();
    init_tests_map();
    init_surprise();
    init_symbols_json();
  }
});
function sortHits(hits) {
  return hits.sort((a, b) => byStr(a.file, b.file) || a.line - b.line);
}
function rgBackend(root, pattern, opts) {
  const args2 = [
    "--no-heading",
    "--line-number",
    "--null",
    // path\0line:text — a `:12:` inside a filename can't corrupt parsing
    "--color=never",
    "--no-messages",
    "--hidden",
    "--no-require-git",
    "--no-ignore-global",
    "--no-ignore-exclude",
    "--no-ignore-parent",
    "--no-ignore-dot",
    "--max-filesize",
    "1M"
  ];
  for (const d of IGNORE_DIRS) args2.push("--glob", `!**/${d}/**`);
  for (const l of LOCKFILES) args2.push("--iglob", `!**/${l}`);
  for (const ext of BINARY_EXT) args2.push("--iglob", `!**/*${ext}`);
  args2.push("--glob", "!*.min.js", "--glob", "!*.min.css");
  if (opts.ignoreCase) args2.push("--ignore-case");
  const user = opts.globs ?? [];
  const anchor = (g) => g.startsWith("/") ? g : `/${g}`;
  for (const g of user.filter((g2) => !g2.startsWith("!"))) args2.push("--glob", anchor(g));
  for (const g of user.filter((g2) => g2.startsWith("!"))) args2.push("--glob", `!${anchor(g.slice(1))}`);
  args2.push("--regexp", pattern, "./");
  const res = sh("rg", args2, { cwd: root });
  if (res.missing || !res.ok && res.status !== 1) return void 0;
  const hits = [];
  for (const line of res.stdout.split("\n")) {
    if (!line) continue;
    const nul = line.indexOf("\0");
    if (nul === -1) continue;
    const file = line.slice(0, nul).replace(/^\.\//, "");
    const rest = line.slice(nul + 1);
    const colon = rest.indexOf(":");
    if (colon === -1) continue;
    hits.push({ file, line: Number(rest.slice(0, colon)), text: rest.slice(colon + 1) });
  }
  return hits;
}
function jsBackend(root, re, opts) {
  const filter = compileGlobFilter(opts.globs?.map((g) => g.replace(/^(!?)\//, "$1")));
  const hits = [];
  for (const f of walk(root).files) {
    if (filter && !filter(f.rel)) continue;
    const content = readText(f.abs);
    if (!content) continue;
    const lines = content.split("\n");
    for (let i2 = 0; i2 < lines.length; i2++) {
      if (re.test(lines[i2])) hits.push({ file: f.rel, line: i2 + 1, text: lines[i2] });
    }
  }
  return hits;
}
function grepRepo(root, pattern, opts = {}) {
  const re = new RegExp(pattern, opts.ignoreCase ? "i" : "");
  const max = opts.maxHits ?? DEFAULT_MAX_HITS;
  let hits;
  if (!opts.noRipgrep && have("rg")) hits = rgBackend(root, pattern, opts);
  hits ??= jsBackend(root, re, opts);
  return sortHits(hits).slice(0, max);
}
var DEFAULT_MAX_HITS;
var init_grep = __esm({
  "src/grep.ts"() {
    "use strict";
    init_walk();
    init_glob();
    init_util();
    init_sort();
    DEFAULT_MAX_HITS = 200;
  }
});
function resolveEmbedModelDir(repo) {
  const env = process.env.CODEINDEX_EMBED_DIR;
  const candidates = [];
  if (env) candidates.push(env);
  if (repo) candidates.push(join13(repo, ".codeindex", DEFAULT_EMBED_DIRNAME));
  candidates.push(join13(process.cwd(), ".codeindex", DEFAULT_EMBED_DIRNAME));
  for (const c2 of candidates) {
    if (existsSync4(join13(c2, "model.json"))) return c2;
  }
  return void 0;
}
function hasEmbedModel(repo) {
  return resolveEmbedModelDir(repo) !== void 0;
}
function parseEmbedModel(raw, source) {
  const { modelId, dim, vocab, weights, unk: rawUnk } = raw ?? {};
  if (typeof modelId !== "string" || !modelId) throw new Error(`embed model: missing modelId in ${source}`);
  if (!Number.isInteger(dim) || dim <= 0) throw new Error(`embed model: bad dim ${dim} in ${source}`);
  if (!Array.isArray(vocab) || !Array.isArray(weights) || vocab.length !== weights.length) {
    throw new Error(`embed model: vocab/weights length mismatch in ${source}`);
  }
  const vocabSize = vocab.length;
  const flat = new Float64Array(vocabSize * dim);
  const vmap = /* @__PURE__ */ new Map();
  for (let i2 = 0; i2 < vocabSize; i2++) {
    const tok = vocab[i2];
    if (typeof tok !== "string") throw new Error(`embed model: non-string vocab entry at ${i2}`);
    if (!vmap.has(tok)) vmap.set(tok, i2);
    const row = weights[i2];
    if (!Array.isArray(row) || row.length !== dim) {
      throw new Error(`embed model: row ${i2} has length ${row?.length}, expected ${dim}`);
    }
    for (let d = 0; d < dim; d++) flat[i2 * dim + d] = Number(row[d]);
  }
  const unk = typeof rawUnk === "string" ? rawUnk : "[UNK]";
  const unkId = vmap.has(unk) ? vmap.get(unk) : -1;
  return { modelId, dim, unk, unkId, vocabSize, vocab: vmap, weights: flat };
}
function loadEmbedModel(dir) {
  if (!dir) return void 0;
  const path = join13(dir, "model.json");
  if (!existsSync4(path)) return void 0;
  const raw = JSON.parse(readFileSync6(path, "utf8"));
  return parseEmbedModel(raw, path);
}
function resolveEmbedPullUrl() {
  const env = process.env.CODEINDEX_EMBED_URL;
  if (env && env.trim()) return { url: env.trim() };
  return { url: DEFAULT_EMBED_URL, sha256: EMBED_ASSET_SHA256 };
}
async function fetchEmbedModel(url, expectedSha256) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const body2 = await res.text();
  if (expectedSha256) {
    const got = createHash3("sha256").update(body2).digest("hex");
    if (got !== expectedSha256) {
      throw new Error(`sha256 mismatch: expected ${expectedSha256}, got ${got}`);
    }
  }
  return body2;
}
var EMBED_VERSION;
var DEFAULT_EMBED_DIRNAME;
var DEFAULT_EMBED_URL;
var EMBED_ASSET_SHA256;
var init_model = __esm({
  "src/embed/model.ts"() {
    "use strict";
    EMBED_VERSION = 1;
    DEFAULT_EMBED_DIRNAME = "models";
    DEFAULT_EMBED_URL = "https://github.com/maxgfr/codeindex/releases/download/embed-model-v1/model.json";
    EMBED_ASSET_SHA256 = "163ad053eab4e9a80d421ed4164f32292c83290f02fbbe6fe4b9b1cd6ea18d34";
  }
});
function basicTokenize(text) {
  const spaced = foldText(text).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  const out2 = [];
  for (const part of spaced.toLowerCase().split(/[^a-z0-9]+/)) {
    if (part) out2.push(part);
  }
  return out2;
}
function wordpiece(word, model) {
  if (!word) return [];
  const ids = [];
  let start2 = 0;
  const n = word.length;
  while (start2 < n) {
    let end = n;
    let match = -1;
    while (end > start2) {
      const piece = start2 === 0 ? word.slice(start2, end) : "##" + word.slice(start2, end);
      const id = model.vocab.get(piece);
      if (id !== void 0) {
        match = id;
        break;
      }
      end--;
    }
    if (match === -1) return model.unkId >= 0 ? [model.unkId] : [];
    ids.push(match);
    start2 = end;
  }
  return ids;
}
function tokenize(text, model) {
  const ids = [];
  for (const word of basicTokenize(text)) {
    for (const id of wordpiece(word, model)) ids.push(id);
  }
  return ids;
}
function roundHalfToEven(x) {
  const f = Math.floor(x);
  const diff = x - f;
  if (diff < 0.5) return f;
  if (diff > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}
function quantize(vec) {
  const dim = vec.length;
  const out2 = new Int8Array(dim);
  let sumsq = 0;
  for (let d = 0; d < dim; d++) sumsq += vec[d] * vec[d];
  const norm2 = Math.sqrt(sumsq);
  if (norm2 === 0) return out2;
  for (let d = 0; d < dim; d++) {
    let q = roundHalfToEven(vec[d] / norm2 * QUANT);
    if (q > QUANT) q = QUANT;
    else if (q < -QUANT) q = -QUANT;
    out2[d] = q;
  }
  return out2;
}
function encode(model, text) {
  const { dim, weights } = model;
  const ids = tokenize(text, model);
  if (ids.length === 0) return new Int8Array(dim);
  const pooled = new Float64Array(dim);
  for (const id of ids) {
    const base = id * dim;
    for (let d = 0; d < dim; d++) pooled[d] += weights[base + d];
  }
  const inv = 1 / ids.length;
  for (let d = 0; d < dim; d++) pooled[d] *= inv;
  return quantize(pooled);
}
function intDot(a, b) {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i2 = 0; i2 < n; i2++) dot += a[i2] * b[i2];
  return dot;
}
var QUANT;
var init_encode = __esm({
  "src/embed/encode.ts"() {
    "use strict";
    init_util();
    QUANT = 127;
  }
});
function symbolText(rel, name2, signature, summary) {
  return [name2, signature ?? "", summary ?? "", rel.replace(/\//g, " ")].join("\n");
}
function fileText(rel, title, summary, headings) {
  return [title ?? "", summary ?? "", ...headings, rel.replace(/\//g, " ")].join("\n");
}
function embeddingUnits(scan2) {
  const units = [];
  for (const f of scan2.files) {
    const seen = /* @__PURE__ */ new Set();
    let hadSymbol = false;
    for (const s of f.symbols) {
      if (seen.has(s.name)) continue;
      seen.add(s.name);
      hadSymbol = true;
      units.push({ file: f.rel, symbol: s.name, line: s.line, text: symbolText(f.rel, s.name, s.signature, f.summary) });
    }
    if (!hadSymbol) {
      const text = fileText(f.rel, f.title, f.summary, f.headings);
      if (text.replace(/\s+/g, "")) units.push({ file: f.rel, text });
    }
  }
  return units;
}
function buildEmbeddingIndex(scan2, model) {
  const records = embeddingUnits(scan2).map((u) => {
    const rec = { file: u.file, vec: encode(model, u.text) };
    if (u.symbol !== void 0) rec.symbol = u.symbol;
    if (u.line !== void 0) rec.line = u.line;
    return rec;
  });
  return { embedVersion: EMBED_VERSION, modelId: model.modelId, dim: model.dim, records };
}
function serializeEmbeddings(index) {
  const header = JSON.stringify({
    embedVersion: index.embedVersion,
    modelId: index.modelId,
    dim: index.dim,
    count: index.records.length,
    records: index.records.map((r) => ({ file: r.file, symbol: r.symbol ?? "", line: r.line ?? 0 }))
  });
  const headerBuf = Buffer.from(header, "utf8");
  const body2 = Buffer.alloc(index.records.length * index.dim);
  let off = 0;
  for (const r of index.records) {
    for (let d = 0; d < index.dim; d++) body2.writeInt8(r.vec[d] ?? 0, off++);
  }
  const out2 = Buffer.alloc(8 + headerBuf.length + body2.length);
  out2.write(MAGIC, 0, "ascii");
  out2.writeUInt32LE(headerBuf.length, 4);
  headerBuf.copy(out2, 8);
  body2.copy(out2, 8 + headerBuf.length);
  return out2;
}
function deserializeEmbeddings(bytes) {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buf.length < 8 || buf.toString("ascii", 0, 4) !== MAGIC) {
    throw new Error("embeddings.bin: bad magic (not a codeindex embeddings artifact)");
  }
  const headerLen = buf.readUInt32LE(4);
  const header = JSON.parse(buf.toString("utf8", 8, 8 + headerLen));
  const bodyOff = 8 + headerLen;
  const { dim } = header;
  const records = header.records.map((m, i2) => {
    const vec = new Int8Array(dim);
    for (let d = 0; d < dim; d++) vec[d] = buf.readInt8(bodyOff + i2 * dim + d);
    const rec = { file: m.file, vec };
    if (m.symbol) rec.symbol = m.symbol;
    if (m.line) rec.line = m.line;
    return rec;
  });
  return { embedVersion: header.embedVersion, modelId: header.modelId, dim, records };
}
var MAGIC;
var init_embed = __esm({
  "src/embed/index.ts"() {
    "use strict";
    init_encode();
    init_model();
    MAGIC = "CIE1";
  }
});
function searchSemantic(scan2, query, index, opts = {}) {
  const limit = opts.limit ?? DEFAULT_LIMIT2;
  const lexical = searchIndex(scan2, query, { limit: Math.max(limit, 50), fuzzy: opts.fuzzy });
  const q = opts.queryVec ?? (opts.model ? encode(opts.model, query) : void 0);
  if (!q || !index || index.records.length === 0) {
    return lexical.slice(0, limit);
  }
  const bestByFile = /* @__PURE__ */ new Map();
  for (const r of index.records) {
    const dot = intDot(q, r.vec);
    const prev = bestByFile.get(r.file);
    if (!prev || dot > prev.score) bestByFile.set(r.file, { score: dot, symbol: r.symbol });
  }
  const semList = [...bestByFile.entries()].filter(([, v]) => v.score > 0).sort((a, b) => b[1].score - a[1].score || byStr(a[0], b[0])).map(([file]) => file);
  const lexList = lexical.map((r) => r.file);
  const fused = rrf([lexList, semList], (f) => f, opts.rrfK ?? RRF_K);
  const lexByFile = new Map(lexical.map((r) => [r.file, r]));
  const results = [...fused.entries()].sort((a, b) => b[1] - a[1] || byStr(a[0], b[0])).map(([file, score]) => {
    const lex = lexByFile.get(file);
    const res = {
      file,
      score: Number(score.toFixed(4)),
      matchedTerms: lex?.matchedTerms ?? [],
      topSymbols: lex?.topSymbols ?? []
    };
    const sem = bestByFile.get(file);
    if (sem?.symbol) res.semanticSymbol = sem.symbol;
    if (lex?.fuzzyTerms) res.fuzzyTerms = lex.fuzzyTerms;
    return res;
  });
  return results.slice(0, limit);
}
var DEFAULT_LIMIT2;
var RRF_K;
var init_search = __esm({
  "src/embed/search.ts"() {
    "use strict";
    init_util();
    init_sort();
    init_bm25();
    init_encode();
    DEFAULT_LIMIT2 = 20;
    RRF_K = 60;
  }
});
function resolveEmbedEndpoint(opts = {}) {
  const url = opts.url ?? process.env.CODEINDEX_EMBED_ENDPOINT;
  return url && url.trim() ? url.trim() : void 0;
}
function stripTrailingSlash(url) {
  return url.replace(/\/+$/, "");
}
function embedEndpointUrl(base) {
  const b = stripTrailingSlash(base);
  return b.endsWith("/embed") ? b : b + "/embed";
}
function healthzUrl(base) {
  return stripTrailingSlash(base).replace(/\/embed$/, "") + "/healthz";
}
function resolveTimeout(opts) {
  if (typeof opts.timeoutMs === "number") return opts.timeoutMs;
  const env = Number(process.env.CODEINDEX_EMBED_TIMEOUT_MS);
  return Number.isFinite(env) && env > 0 ? env : 3e4;
}
async function embedViaEndpoint(texts, opts = {}) {
  const base = resolveEmbedEndpoint(opts);
  if (!base) throw new Error("no embedding endpoint configured (set CODEINDEX_EMBED_ENDPOINT or pass opts.url)");
  const url = embedEndpointUrl(base);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), resolveTimeout(opts));
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...opts.headers ?? {} },
      body: JSON.stringify({ texts }),
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`embedding endpoint ${url} returned HTTP ${res.status}`);
    const data = await res.json();
    const vectors = data.vectors;
    if (!Array.isArray(vectors) || !vectors.every((v) => Array.isArray(v) && v.every((x) => typeof x === "number"))) {
      throw new Error(`embedding endpoint ${url} returned a malformed { vectors } payload`);
    }
    return vectors;
  } finally {
    clearTimeout(timer);
  }
}
async function probeEndpoint(base, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), resolveTimeout(opts));
  try {
    const res = await fetch(healthzUrl(base), { signal: controller.signal, headers: opts.headers });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
async function encodeQueryViaEndpoint(query, opts = {}) {
  const [vec] = await embedViaEndpoint([query], opts);
  if (!vec) throw new Error("embedding endpoint returned no vector for the query");
  return quantize(vec);
}
async function buildEndpointIndex(scan2, opts = {}) {
  const units = embeddingUnits(scan2);
  const batchSize = opts.batchSize && opts.batchSize > 0 ? opts.batchSize : 64;
  const records = [];
  let dim = 0;
  for (let i2 = 0; i2 < units.length; i2 += batchSize) {
    const batch = units.slice(i2, i2 + batchSize);
    const vectors = await embedViaEndpoint(batch.map((u) => u.text), opts);
    if (vectors.length !== batch.length) {
      throw new Error(`embedding endpoint returned ${vectors.length} vectors for ${batch.length} texts`);
    }
    for (let j = 0; j < batch.length; j++) {
      const u = batch[j];
      const vec = quantize(vectors[j]);
      if (vec.length > dim) dim = vec.length;
      const rec = { file: u.file, vec };
      if (u.symbol !== void 0) rec.symbol = u.symbol;
      if (u.line !== void 0) rec.line = u.line;
      records.push(rec);
    }
  }
  return { embedVersion: EMBED_VERSION, modelId: "endpoint", dim, records };
}
var init_endpoint = __esm({
  "src/embed/endpoint.ts"() {
    "use strict";
    init_encode();
    init_model();
    init_embed();
  }
});
function isEntrypointLike(rel) {
  const base = rel.split("/").pop();
  const stem = base.split(".")[0].toLowerCase();
  return ENTRYPOINT_STEMS.has(stem);
}
function toList(v) {
  return Array.isArray(v) ? v : [v];
}
function parseRules(input) {
  const raw = Array.isArray(input) ? input : input?.rules;
  if (!Array.isArray(raw)) throw new Error("rules config must be an array (or an object with a `rules` array)");
  return raw.map((entry, i2) => {
    const at = `rules[${i2}]`;
    if (typeof entry !== "object" || entry === null) throw new Error(`${at}: must be an object`);
    const r = entry;
    if (typeof r.name !== "string" || !r.name) throw new Error(`${at}: \`name\` (non-empty string) is required`);
    if (r.severity !== void 0 && !SEVERITIES.has(r.severity))
      throw new Error(`${at} (${r.name}): \`severity\` must be "error" or "warn"`);
    if (r.comment !== void 0 && typeof r.comment !== "string")
      throw new Error(`${at} (${r.name}): \`comment\` must be a string`);
    if (r.builtin !== void 0) {
      if (!BUILTINS.has(r.builtin))
        throw new Error(`${at} (${r.name}): \`builtin\` must be "cycles" or "orphans"`);
      return { name: r.name, builtin: r.builtin, severity: r.severity, comment: r.comment };
    }
    const glob = (field) => {
      const v = r[field];
      const ok = typeof v === "string" ? v.length > 0 : Array.isArray(v) && v.length > 0 && v.every((g) => typeof g === "string" && g);
      if (!ok) throw new Error(`${at} (${r.name}): \`${field}\` must be a glob or a non-empty array of globs`);
      return v;
    };
    const from = glob("from");
    const to = glob("to");
    if (r.kind !== void 0) {
      const ok = Array.isArray(r.kind) && r.kind.every((k) => EDGE_KINDS.has(k));
      if (!ok) throw new Error(`${at} (${r.name}): \`kind\` must be an array of edge kinds (${[...EDGE_KINDS].join(", ")})`);
    }
    return { name: r.name, from, to, kind: r.kind, severity: r.severity, comment: r.comment };
  });
}
function findImportCycles(graph) {
  const adj = /* @__PURE__ */ new Map();
  for (const e of graph.moduleEdges) {
    if (e.kind !== "import") continue;
    let list = adj.get(e.from);
    if (!list) adj.set(e.from, list = []);
    list.push(e.to);
  }
  for (const list of adj.values()) list.sort(byStr);
  const nodes = [...adj.keys()].sort(byStr);
  const indexOf = /* @__PURE__ */ new Map();
  const low = /* @__PURE__ */ new Map();
  const onStack = /* @__PURE__ */ new Set();
  const stack = [];
  const sccs = [];
  let counter = 0;
  for (const root of nodes) {
    if (indexOf.has(root)) continue;
    const work = [{ node: root, next: 0 }];
    while (work.length) {
      const frame = work[work.length - 1];
      const v = frame.node;
      if (frame.next === 0) {
        indexOf.set(v, counter);
        low.set(v, counter);
        counter++;
        stack.push(v);
        onStack.add(v);
      }
      const targets = adj.get(v) ?? [];
      if (frame.next < targets.length) {
        const w = targets[frame.next];
        frame.next++;
        if (!indexOf.has(w)) work.push({ node: w, next: 0 });
        else if (onStack.has(w)) low.set(v, Math.min(low.get(v), indexOf.get(w)));
      } else {
        if (low.get(v) === indexOf.get(v)) {
          const scc = [];
          for (; ; ) {
            const w = stack.pop();
            onStack.delete(w);
            scc.push(w);
            if (w === v) break;
          }
          if (scc.length > 1) sccs.push(scc);
        }
        work.pop();
        const parent = work[work.length - 1];
        if (parent) low.set(parent.node, Math.min(low.get(parent.node), low.get(v)));
      }
    }
  }
  const cycles = [];
  for (const scc of sccs) {
    const members = new Set(scc);
    const start2 = [...scc].sort(byStr)[0];
    const parent = /* @__PURE__ */ new Map([[start2, null]]);
    const order = [start2];
    for (let i2 = 0; i2 < order.length; i2++) {
      const v = order[i2];
      for (const w of adj.get(v) ?? []) {
        if (!members.has(w) || parent.has(w)) continue;
        parent.set(w, v);
        order.push(w);
      }
    }
    const closer = order.find((v) => (adj.get(v) ?? []).includes(start2) && v !== start2) ?? // Degenerate (shouldn't happen in an SCC): fall back to start itself.
    start2;
    const path = [];
    for (let v = closer; v !== null; v = parent.get(v) ?? null) path.unshift(v);
    path.push(start2);
    cycles.push({ start: start2, path });
  }
  return cycles;
}
function checkRules(graph, rules) {
  const out2 = [];
  const emit2 = (rule, v) => {
    out2.push({
      rule: rule.name,
      ...v,
      severity: rule.severity ?? "error",
      ...rule.comment !== void 0 ? { comment: rule.comment } : {}
    });
  };
  const fileSet = new Set(graph.files.map((f) => f.rel));
  for (const rule of rules) {
    if ("builtin" in rule) {
      if (rule.builtin === "cycles") {
        for (const c2 of findImportCycles(graph)) {
          emit2(rule, { from: c2.start, to: c2.path.join(" -> "), kind: "cycle" });
        }
      } else {
        for (const f of graph.files) {
          if (f.fileKind !== "code" || f.degIn !== 0 || f.degOut !== 0) continue;
          if (isEntrypointLike(f.rel)) continue;
          emit2(rule, { from: f.rel, to: f.rel, kind: "orphan" });
        }
      }
      continue;
    }
    const fromMatch = compileGlobs(toList(rule.from));
    const toMatch = compileGlobs(toList(rule.to));
    if (!fromMatch || !toMatch) continue;
    const kinds = rule.kind?.length ? new Set(rule.kind) : null;
    for (const e of graph.fileEdges) {
      if (e.dangling || !fileSet.has(e.to)) continue;
      if (kinds && !kinds.has(e.kind)) continue;
      if (!fromMatch(e.from) || !toMatch(e.to)) continue;
      emit2(rule, { from: e.from, to: e.to, kind: e.kind });
    }
  }
  out2.sort((a, b) => byStr(a.rule, b.rule) || byStr(a.from, b.from) || byStr(a.to, b.to) || byStr(a.kind, b.kind));
  return out2;
}
var EDGE_KINDS;
var SEVERITIES;
var BUILTINS;
var ENTRYPOINT_STEMS;
var init_rules = __esm({
  "src/rules.ts"() {
    "use strict";
    init_glob();
    init_sort();
    EDGE_KINDS = /* @__PURE__ */ new Set(["contains", "doc-link", "import", "call", "use", "mention"]);
    SEVERITIES = /* @__PURE__ */ new Set(["error", "warn"]);
    BUILTINS = /* @__PURE__ */ new Set(["cycles", "orphans"]);
    ENTRYPOINT_STEMS = /* @__PURE__ */ new Set([
      "index",
      "main",
      "app",
      "application",
      "cli",
      "server",
      "entry",
      "entrypoint",
      "setup",
      "conftest",
      "__init__",
      "__main__",
      "mod",
      "lib"
    ]);
  }
});
function changeCoupling(dir, opts = {}) {
  const maxCommitFiles = opts.maxCommitFiles ?? 30;
  const minTogether = opts.minTogether ?? 3;
  const maxPairs = opts.maxPairs ?? 100;
  const range = opts.since ? [`${opts.since}..HEAD`] : [];
  const res = sh("git", ["-C", dir, "-c", "core.quotePath=false", "log", ...range, "--pretty=format:%x1e", "--name-only"]);
  if (!res.ok) return { ok: false, couplings: [] };
  const totals = /* @__PURE__ */ new Map();
  const pairs = /* @__PURE__ */ new Map();
  for (const block of res.stdout.split("")) {
    const files = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!files.length || files.length > maxCommitFiles) continue;
    const unique = [...new Set(files)].sort(byStr);
    for (const f of unique) totals.set(f, (totals.get(f) ?? 0) + 1);
    for (let i2 = 0; i2 < unique.length; i2++) {
      for (let j = i2 + 1; j < unique.length; j++) {
        const key = `${unique[i2]}\0${unique[j]}`;
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }
    }
  }
  const out2 = [];
  for (const [key, together] of pairs) {
    if (together < minTogether) continue;
    const [a, b] = key.split("\0");
    const totalA = totals.get(a) ?? together;
    const totalB = totals.get(b) ?? together;
    out2.push({ a, b, together, totalA, totalB, strength: Number((together / Math.min(totalA, totalB)).toFixed(3)) });
  }
  out2.sort((x, y) => y.strength - x.strength || y.together - x.together || byStr(x.a, y.a) || byStr(x.b, y.b));
  return { ok: true, couplings: out2.slice(0, maxPairs) };
}
function rankHotspots(scan2, churn, top = 20) {
  const out2 = scan2.files.filter((f) => f.kind === "code").map((f) => {
    const commits = churn.get(f.rel) ?? 0;
    return { rel: f.rel, lines: f.lines, commits, score: Number((commits * Math.log2(f.lines + 1)).toFixed(2)) };
  });
  out2.sort((a, b) => b.score - a.score || b.lines - a.lines || byStr(a.rel, b.rel));
  return out2.slice(0, top);
}
var init_coupling = __esm({
  "src/coupling.ts"() {
    "use strict";
    init_util();
    init_sort();
  }
});
function renderRepoMap(scan2, graph, opts = {}) {
  const budgetChars = (opts.budgetTokens ?? 1024) * CHARS_PER_TOKEN;
  const maxSymbols = opts.maxSymbolsPerFile ?? 8;
  const ranked = [...graph.files].filter((f) => f.fileKind === "code").sort((a, b) => (b.pagerank ?? 0) - (a.pagerank ?? 0) || b.symbols - a.symbols || byStr(a.rel, b.rel));
  const records = new Map(scan2.files.map((f) => [f.rel, f]));
  const header = `# repo map \u2014 ${graph.fileCount} files
`;
  let out2 = header;
  let files = 0;
  for (const node of ranked) {
    const rec = records.get(node.rel);
    if (!rec) continue;
    const symbols = [...rec.symbols].filter((s) => s.kind !== "reexport" && s.kind !== "reexport-all").sort((a, b) => Number(b.exported) - Number(a.exported) || a.line - b.line).slice(0, maxSymbols);
    let block = `
${node.rel}:
`;
    for (const s of symbols) {
      const sig = (s.signature ?? `${s.kind} ${s.name}`).replace(/\s+/g, " ").trim().slice(0, 120);
      block += `  ${s.line}: ${sig}
`;
    }
    if (out2.length + block.length > budgetChars) break;
    out2 += block;
    files++;
  }
  return `${out2}
(${files} of ${ranked.length} code files shown, ~${Math.ceil(out2.length / CHARS_PER_TOKEN)} tokens)
`;
}
var CHARS_PER_TOKEN;
var init_repomap = __esm({
  "src/repomap.ts"() {
    "use strict";
    init_sort();
    CHARS_PER_TOKEN = 4;
  }
});
function findDeadCode(scan2) {
  const callers = callerIndexFor(scan2);
  const refs = symbolRefsFor(scan2);
  const out2 = [];
  const consider = (s) => s.exported && !REFERENCE_KINDS6.has(s.kind) && !isTestPath(s.file) && !ENTRYPOINT_RE.test(s.file);
  for (const f of scan2.files) {
    for (const s of f.symbols) {
      if (!consider(s)) continue;
      const entry = callers.get(s.name) ?? callers.get(`${s.name}@${s.file}`);
      const hasCallers = !!entry && entry.def.file === s.file && entry.callers.length > 0;
      if (hasCallers) continue;
      const referenced = (refs.get(s.name)?.size ?? 0) > 0;
      out2.push({ name: s.name, file: s.file, line: s.line, kind: s.kind, tier: referenced ? "uncalled" : "unreferenced" });
    }
  }
  return out2.sort((a, b) => byStr(a.tier, b.tier) || byStr(a.file, b.file) || a.line - b.line);
}
var REFERENCE_KINDS6;
var ENTRYPOINT_RE;
var init_deadcode = __esm({
  "src/deadcode.ts"() {
    "use strict";
    init_derived();
    init_tests_map();
    init_sort();
    REFERENCE_KINDS6 = /* @__PURE__ */ new Set(["reexport", "reexport-all", "default"]);
    ENTRYPOINT_RE = /(^|\/)(index|main|cli|app|server|engine)\.[a-z]+$/;
  }
});
function renderMermaid(graph, opts = {}) {
  const maxEdges = opts.maxEdges ?? 80;
  let edges = [...graph.moduleEdges].filter((e) => !e.dangling);
  if (opts.module) {
    edges = edges.filter((e) => e.from === opts.module || e.to === opts.module);
  }
  edges.sort((a, b) => b.weight - a.weight || byStr(a.from, b.from) || byStr(a.to, b.to));
  const dropped = Math.max(0, edges.length - maxEdges);
  edges = edges.slice(0, maxEdges);
  const shown = /* @__PURE__ */ new Set();
  for (const e of edges) {
    shown.add(e.from);
    shown.add(e.to);
  }
  if (opts.module) shown.add(opts.module);
  const lines = ["graph LR"];
  for (const m of [...graph.modules].sort((a, b) => byStr(a.slug, b.slug))) {
    if (!shown.has(m.slug)) continue;
    lines.push(`  ${sanitizeId(m.slug)}["${m.slug}${m.tier === 0 ? " (core)" : ""}"]`);
  }
  for (const e of edges) {
    const label = e.kind === "import" ? "" : `|${e.kind}|`;
    lines.push(`  ${sanitizeId(e.from)} -->${label} ${sanitizeId(e.to)}`);
  }
  if (dropped) lines.push(`  %% ${dropped} lighter edges omitted (maxEdges=${maxEdges})`);
  return lines.join("\n") + "\n";
}
var sanitizeId;
var init_viz = __esm({
  "src/viz.ts"() {
    "use strict";
    init_sort();
    sanitizeId = (slug) => slug.replace(/[^\w]/g, "_");
  }
});
var mcp_exports = {};
__export(mcp_exports, {
  getArtifacts: () => getArtifacts,
  getScan: () => getScan,
  memoizedEmbedModel: () => memoizedEmbedModel,
  memoizedEmbeddingIndex: () => memoizedEmbeddingIndex,
  runMcpServer: () => runMcpServer,
  scanFingerprint: () => scanFingerprint,
  toCacheMap: () => toCacheMap,
  warmGrammarsForRepo: () => warmGrammarsForRepo
});
function str(v) {
  return typeof v === "string" && v ? v : void 0;
}
function strArray(v) {
  return Array.isArray(v) && v.every((x) => typeof x === "string") && v.length ? v : void 0;
}
function errMessage(e) {
  return e instanceof Error ? e.message : String(e);
}
function scanFingerprint(scan2) {
  return sha1(scan2.files.map((f) => `${f.rel}:${f.hash}`).join("\n"));
}
async function memoizedEmbeddingIndex(key, build) {
  const cacheKey = `${key.mode}:${key.identity}:${scanFingerprint(key.scan)}`;
  if (embeddingIndexCache && embeddingIndexCache.key === cacheKey) return embeddingIndexCache.index;
  const index = await build();
  embeddingIndexCache = { key: cacheKey, index };
  return index;
}
function memoizedEmbedModel(modelDir) {
  let stat;
  try {
    stat = statSync4(join14(modelDir, "model.json"));
  } catch {
    return void 0;
  }
  const key = `${modelDir}:${stat.mtimeMs}:${stat.size}`;
  if (embedModelCache && embedModelCache.key === key) return embedModelCache.model;
  const model = loadEmbedModel(modelDir);
  if (model) embedModelCache = { key, model };
  return model;
}
function sessionKey(repo, opts) {
  return repo + "\0" + JSON.stringify({
    scope: opts.scope,
    include: opts.include,
    exclude: opts.exclude,
    gitignore: opts.gitignore,
    ignoreDirs: opts.ignoreDirs,
    maxBytes: opts.maxBytes,
    maxFiles: opts.maxFiles,
    maxCallsPerFile: opts.maxCallsPerFile,
    out: opts.out,
    fullHash: opts.fullHash
  });
}
function toCacheMap(scan2) {
  const m = /* @__PURE__ */ new Map();
  for (const f of scan2.files) m.set(f.rel, { hash: f.hash, record: f, size: f.size, mtimeMs: scan2.mtimes.get(f.rel) });
  return m;
}
function readPersistedIndex(repo) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync7(join14(repo, ".codeindex", "cache.json"), "utf8"));
  } catch {
    return void 0;
  }
  if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION || parsed.extractorVersion !== EXTRACTOR_VERSION || !parsed.files) {
    return void 0;
  }
  const cacheMap = new Map(Object.entries(parsed.files));
  const meta = {
    engineVersion: parsed.engineVersion,
    commit: parsed.commit,
    graphSha1: parsed.graphSha1,
    symbolsSha1: parsed.symbolsSha1
  };
  return { cacheMap, meta };
}
function preloadArtifacts(repo, scan2, meta) {
  if (!scan2.contentUnchanged || meta.engineVersion !== ENGINE_VERSION || meta.commit !== scan2.commit || meta.graphSha1 === void 0 || meta.symbolsSha1 === void 0) {
    return void 0;
  }
  const dir = join14(repo, ".codeindex");
  let graphBytes;
  let symbolsBytes;
  try {
    graphBytes = readFileSync7(join14(dir, "graph.json"));
    symbolsBytes = readFileSync7(join14(dir, "symbols.json"));
  } catch {
    return void 0;
  }
  if (sha1(graphBytes) !== meta.graphSha1 || sha1(symbolsBytes) !== meta.symbolsSha1) {
    return void 0;
  }
  try {
    const graph = JSON.parse(graphBytes.toString("utf8"));
    const symbols = JSON.parse(symbolsBytes.toString("utf8"));
    if (graph.schemaVersion !== SCHEMA_VERSION || symbols.schemaVersion !== SCHEMA_VERSION) return void 0;
    return { scan: scan2, graph, symbols };
  } catch {
    return void 0;
  }
}
function preloadSession(repo, opts) {
  const persisted = readPersistedIndex(repo);
  if (!persisted) return void 0;
  const scan2 = scanRepo(repo, { ...opts, cache: persisted.cacheMap });
  const arts = preloadArtifacts(repo, scan2, persisted.meta);
  return { scan: scan2, cacheMap: toCacheMap(scan2), arts };
}
function getScan(repo, opts = {}) {
  const key = sessionKey(repo, opts);
  if (sessionCache && sessionCache.key === key) {
    const fresh = scanRepo(repo, { ...opts, cache: sessionCache.cacheMap });
    if (fresh.contentUnchanged) {
      if (fresh.cacheDirty) sessionCache.cacheMap = toCacheMap(fresh);
      if (sessionCache.scan.commit !== fresh.commit) sessionCache.scan.commit = fresh.commit;
      return sessionCache.scan;
    }
    sessionCache = { key, scan: fresh, cacheMap: toCacheMap(fresh) };
    return fresh;
  }
  const preloaded = preloadSession(repo, opts);
  if (preloaded) {
    sessionCache = { key, scan: preloaded.scan, cacheMap: preloaded.cacheMap, arts: preloaded.arts };
    return preloaded.scan;
  }
  const scan2 = scanRepo(repo, opts);
  sessionCache = { key, scan: scan2, cacheMap: toCacheMap(scan2) };
  return scan2;
}
function getArtifacts(repo, opts = {}) {
  const scan2 = getScan(repo, opts);
  if (sessionCache && sessionCache.scan === scan2) {
    return sessionCache.arts ??= buildArtifactsFromScan(scan2, opts);
  }
  return buildArtifactsFromScan(scan2, opts);
}
async function warmGrammarsForRepo(repo) {
  const { files } = walk(repo, {});
  await ensureGrammars(grammarKeysForExts(files.map((f) => f.ext)));
}
async function callTool(name2, args2, defaultRepo) {
  const repo = str(args2.repo) ?? defaultRepo;
  if (!repo) throw new Error("`repo` is required (absolute path to the repository root)");
  const scanOpts = { scope: str(args2.scope), include: strArray(args2.include), exclude: strArray(args2.exclude) };
  if (!SCANLESS_TOOLS.has(name2)) await warmGrammarsForRepo(repo);
  if (name2 === "scan_summary") {
    const scan2 = getScan(repo, scanOpts);
    return JSON.stringify(
      { engineVersion: ENGINE_VERSION, commit: scan2.commit, fileCount: scan2.files.length, languages: scan2.languages, capped: scan2.capped },
      null,
      2
    );
  }
  if (name2 === "graph") {
    return renderGraphJson(getArtifacts(repo, scanOpts).graph);
  }
  if (name2 === "symbols") {
    const { symbols } = getArtifacts(repo, scanOpts);
    const lookup = str(args2.name);
    if (lookup) {
      return JSON.stringify({ name: lookup, defs: symbols.defs[lookup] ?? [], refs: symbols.refs[lookup] ?? [] }, null, 2);
    }
    return JSON.stringify(symbols, null, 2);
  }
  if (name2 === "callers") {
    const index = buildCallerIndex(getScan(repo, scanOpts));
    const lookup = str(args2.name);
    if (lookup) {
      const entry = index.get(lookup);
      return JSON.stringify(entry ?? { error: `no tracked callers for "${lookup}"` }, null, 2);
    }
    const obj = {};
    for (const [k, v] of index) obj[k] = v;
    return JSON.stringify(obj, null, 2);
  }
  if (name2 === "workspaces") {
    const info2 = detectWorkspaces(repo);
    return JSON.stringify({ packages: info2.packages, cycle: info2.cycle ?? null, topoOrder: info2.topoOrder }, null, 2);
  }
  if (name2 === "churn") {
    const { churn, ok } = gitChurn(repo, { since: str(args2.since) });
    const sorted = {};
    for (const k of [...churn.keys()].sort()) sorted[k] = churn.get(k);
    return JSON.stringify({ ok, churn: sorted }, null, 2);
  }
  if (name2 === "symbols_overview") {
    const file = str(args2.file);
    if (!file) throw new Error("`file` is required");
    return JSON.stringify(symbolsOverview(getScan(repo, scanOpts), file), null, 2);
  }
  if (name2 === "find_symbol") {
    const namePath = str(args2.namePath);
    if (!namePath) throw new Error("`namePath` is required");
    const matches = findSymbol(getScan(repo, scanOpts), namePath, {
      substring: args2.substring === true,
      includeBody: args2.includeBody === true
    });
    return JSON.stringify(matches, null, 2);
  }
  if (name2 === "find_references") {
    const symName = str(args2.name);
    if (!symName) throw new Error("`name` is required");
    return JSON.stringify(findReferences(getScan(repo, scanOpts), symName), null, 2);
  }
  if (name2 === "replace_symbol_body" || name2 === "insert_after_symbol" || name2 === "insert_before_symbol") {
    const namePath = str(args2.namePath);
    const body2 = typeof args2.body === "string" ? args2.body : void 0;
    if (!namePath || body2 === void 0) throw new Error("`namePath` and `body` are required");
    const scan2 = getScan(repo, scanOpts);
    const fn = name2 === "replace_symbol_body" ? replaceSymbolBody : name2 === "insert_after_symbol" ? insertAfterSymbol : insertBeforeSymbol;
    const result = fn(scan2, namePath, body2, str(args2.file));
    sessionCache = void 0;
    return JSON.stringify(result, null, 2);
  }
  if (name2 === "write_memory") {
    const memName = str(args2.name);
    const content = typeof args2.content === "string" ? args2.content : void 0;
    if (!memName || content === void 0) throw new Error("`name` and `content` are required");
    return JSON.stringify({ written: writeMemory(repo, memName, content) }, null, 2);
  }
  if (name2 === "read_memory") {
    const memName = str(args2.name);
    if (!memName) throw new Error("`name` is required");
    const content = readMemory(repo, memName);
    if (content === void 0) throw new Error(`no memory named "${memName}" \u2014 see list_memories`);
    return content;
  }
  if (name2 === "list_memories") {
    return JSON.stringify(listMemories(repo), null, 2);
  }
  if (name2 === "delete_memory") {
    const memName = str(args2.name);
    if (!memName) throw new Error("`name` is required");
    return JSON.stringify({ deleted: deleteMemory(repo, memName) }, null, 2);
  }
  if (name2 === "dead_code") {
    return JSON.stringify(findDeadCode(getScan(repo, scanOpts)), null, 2);
  }
  if (name2 === "complexity") {
    const scan2 = getScan(repo, scanOpts);
    if (args2.risk === true) {
      const { churn, ok } = gitChurn(repo);
      return JSON.stringify({ churnOk: ok, risks: riskHotspots(scan2, churn) }, null, 2);
    }
    return JSON.stringify(symbolComplexity(scan2, str(args2.file)), null, 2);
  }
  if (name2 === "mermaid") {
    const { graph } = getArtifacts(repo, scanOpts);
    return renderMermaid(graph, { module: str(args2.module) });
  }
  if (name2 === "repo_map") {
    const { scan: scan2, graph } = getArtifacts(repo, scanOpts);
    return renderRepoMap(scan2, graph, { budgetTokens: typeof args2.budgetTokens === "number" ? args2.budgetTokens : void 0 });
  }
  if (name2 === "hotspots") {
    const scan2 = getScan(repo, scanOpts);
    const { churn, ok } = gitChurn(repo, { since: str(args2.since) });
    return JSON.stringify({ churnOk: ok, hotspots: rankHotspots(scan2, churn) }, null, 2);
  }
  if (name2 === "coupling") {
    const { ok, couplings } = changeCoupling(repo, { since: str(args2.since) });
    return JSON.stringify({ ok, couplings }, null, 2);
  }
  if (name2 === "grep") {
    const pattern = str(args2.pattern);
    if (!pattern) throw new Error("`pattern` is required");
    const hits = grepRepo(repo, pattern, {
      globs: strArray(args2.globs),
      ignoreCase: args2.ignoreCase === true,
      maxHits: typeof args2.maxHits === "number" ? args2.maxHits : void 0
    });
    return JSON.stringify(hits, null, 2);
  }
  if (name2 === "search") {
    const query = str(args2.query);
    if (!query) throw new Error("`query` is required");
    const scan2 = getScan(repo, scanOpts);
    const limit = typeof args2.limit === "number" ? args2.limit : void 0;
    const fuzzy = typeof args2.fuzzy === "boolean" ? args2.fuzzy : void 0;
    if (args2.semantic === true) {
      const endpoint = resolveEmbedEndpoint();
      if (endpoint) {
        try {
          const index = await memoizedEmbeddingIndex({ mode: "endpoint", identity: endpoint, scan: scan2 }, () => buildEndpointIndex(scan2));
          const queryVec = await encodeQueryViaEndpoint(query);
          const results2 = searchSemantic(scan2, query, index, { queryVec, limit, fuzzy });
          return JSON.stringify({ results: results2, tier: "endpoint" }, null, 2);
        } catch (e) {
          const results2 = searchIndex(scan2, query, { limit, fuzzy });
          return JSON.stringify(
            { results: results2, tier: "lexical", degradedReason: `embedding endpoint failed: ${errMessage(e)}` },
            null,
            2
          );
        }
      }
      const modelDir = resolveEmbedModelDir(repo);
      const model = modelDir ? memoizedEmbedModel(modelDir) : void 0;
      if (model) {
        const index = await memoizedEmbeddingIndex(
          { mode: "static", identity: `${modelDir}#${model.modelId}`, scan: scan2 },
          () => buildEmbeddingIndex(scan2, model)
        );
        const results2 = searchSemantic(scan2, query, index, { model, limit, fuzzy });
        return JSON.stringify({ results: results2, tier: "static" }, null, 2);
      }
      const results = searchIndex(scan2, query, { limit, fuzzy });
      return JSON.stringify(
        { results, tier: "lexical", degradedReason: "no embedding endpoint or static model configured \u2014 see embed_status" },
        null,
        2
      );
    }
    return JSON.stringify(searchIndex(scan2, query, { limit, fuzzy }), null, 2);
  }
  if (name2 === "embed_status") {
    const modelDir = resolveEmbedModelDir(repo);
    const model = modelDir ? memoizedEmbedModel(modelDir) : void 0;
    const endpoint = resolveEmbedEndpoint();
    const mode = endpoint ? "endpoint" : model ? "static" : "none";
    const status = {
      embedVersion: EMBED_VERSION,
      mode,
      model: model ? { present: true, dir: modelDir, modelId: model.modelId, dim: model.dim, vocabSize: model.vocabSize } : { present: false },
      endpoint: endpoint ?? null
    };
    if (endpoint) status.endpointReachable = await probeEndpoint(endpoint);
    return JSON.stringify(status, null, 2);
  }
  if (name2 === "check_rules") {
    const rules = parseRules(args2.rules);
    const { graph } = getArtifacts(repo, scanOpts);
    return JSON.stringify(checkRules(graph, rules), null, 2);
  }
  throw new Error(`unknown tool: ${name2}`);
}
function toolsFor(defaultRepo) {
  if (!defaultRepo) return TOOLS;
  return TOOLS.map((t) => ({
    ...t,
    inputSchema: {
      ...t.inputSchema,
      properties: {
        ...t.inputSchema.properties,
        repo: { type: "string", description: `Absolute path to the repository root (optional \u2014 defaults to ${defaultRepo})` }
      },
      required: t.inputSchema.required.filter((r) => r !== "repo")
    }
  }));
}
async function runMcpServer(opts = {}) {
  const serverInfo = {
    name: opts.serverInfo?.name ?? "codeindex",
    version: opts.serverInfo?.version ?? ENGINE_VERSION
  };
  const tools = toolsFor(opts.defaultRepo);
  const send = (msg) => {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...msg }) + "\n");
  };
  const rl = createInterface({ input: process.stdin, terminal: false });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      send({ id: null, error: { code: -32700, message: "parse error" } });
      continue;
    }
    const requests = Array.isArray(parsed) ? parsed : [parsed];
    for (const req of requests) await handle2(req);
  }
  async function handle2(req) {
    if (req.id === void 0 || req.id === null) return;
    try {
      if (req.method === "initialize") {
        send({
          id: req.id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo
          }
        });
      } else if (req.method === "ping") {
        send({ id: req.id, result: {} });
      } else if (req.method === "tools/list") {
        send({ id: req.id, result: { tools } });
      } else if (req.method === "tools/call") {
        const params = req.params ?? {};
        const name2 = str(params.name) ?? "";
        const args2 = params.arguments ?? {};
        try {
          const text = await callTool(name2, args2, opts.defaultRepo);
          send({ id: req.id, result: { content: [{ type: "text", text }] } });
        } catch (e) {
          send({
            id: req.id,
            result: { content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true }
          });
        }
      } else {
        send({ id: req.id, error: { code: -32601, message: `method not found: ${req.method}` } });
      }
    } catch (e) {
      send({ id: req.id, error: { code: -32603, message: e instanceof Error ? e.message : String(e) } });
    }
  }
}
var repoProp;
var scopeProps;
var TOOLS;
var embeddingIndexCache;
var embedModelCache;
var sessionCache;
var SCANLESS_TOOLS;
var init_mcp = __esm({
  "src/mcp.ts"() {
    "use strict";
    init_types();
    init_loader();
    init_pipeline();
    init_graph_json();
    init_scan();
    init_walk();
    init_callers();
    init_workspaces();
    init_git();
    init_grep();
    init_coupling();
    init_repomap();
    init_deadcode();
    init_complexity();
    init_viz();
    init_query();
    init_edit();
    init_memory();
    init_bm25();
    init_rules();
    init_model();
    init_embed();
    init_search();
    init_endpoint();
    init_hash();
    repoProp = { repo: { type: "string", description: "Absolute path to the repository root" } };
    scopeProps = {
      scope: { type: "string", description: "Restrict to one directory (repo-relative)" },
      include: { type: "array", items: { type: "string" }, description: "Include globs" },
      exclude: { type: "array", items: { type: "string" }, description: "Exclude globs" }
    };
    TOOLS = [
      {
        name: "scan_summary",
        description: "Deterministically scan a repository: file count, per-language file histogram, HEAD commit, and whether the walk was capped. Fast first look at any codebase.",
        inputSchema: { type: "object", properties: { ...repoProp, ...scopeProps }, required: ["repo"] }
      },
      {
        name: "graph",
        description: "Build the full typed cross-file link-graph (import/call/use/doc-link/mention edges, module grouping, PageRank centrality, Louvain communities, tests-map). Returns graph.json. Large on big repos \u2014 prefer scan_summary/symbols/callers for targeted questions.",
        inputSchema: { type: "object", properties: { ...repoProp, ...scopeProps }, required: ["repo"] }
      },
      {
        name: "symbols",
        description: "Where is a symbol defined and which files reference it? Returns the definition sites (file, line, kind, exported) and referencing files. Omit `name` for the full symbol index.",
        inputSchema: {
          type: "object",
          properties: { ...repoProp, name: { type: "string", description: "Symbol name to look up" } },
          required: ["repo"]
        }
      },
      {
        name: "callers",
        description: "Who calls a function? Per-symbol caller index: each defined symbol with the exact (file, line) call sites that bind to it. Omit `name` for the full index.",
        inputSchema: {
          type: "object",
          properties: { ...repoProp, name: { type: "string", description: "Symbol name to look up" } },
          required: ["repo"]
        }
      },
      {
        name: "workspaces",
        description: "Detect monorepo packages (npm/pnpm/yarn/lerna/nx/cargo/go.work/maven) with the workspace dependency graph, one cycle if present, and a topological build order.",
        inputSchema: { type: "object", properties: { ...repoProp }, required: ["repo"] }
      },
      {
        name: "churn",
        description: "Per-file git commit counts (whole history, or since a ref) \u2014 the churn half of hotspot analysis.",
        inputSchema: {
          type: "object",
          properties: { ...repoProp, since: { type: "string", description: "Only count commits after this ref" } },
          required: ["repo"]
        }
      },
      {
        name: "symbols_overview",
        description: "All symbols declared in ONE file (name, kind, line span, exported, parent), in declaration order \u2014 the fastest way to understand a file without reading it.",
        inputSchema: {
          type: "object",
          properties: { ...repoProp, file: { type: "string", description: "Repo-relative file path" } },
          required: ["repo", "file"]
        }
      },
      {
        name: "find_symbol",
        description: "Find symbol declarations by name or name path ('Class/method' matches a method inside Class). Options: substring matching, includeBody to return the declaration's source. Exact-name matches rank first.",
        inputSchema: {
          type: "object",
          properties: {
            ...repoProp,
            namePath: { type: "string", description: "Symbol name or Parent/child path" },
            substring: { type: "boolean" },
            includeBody: { type: "boolean" }
          },
          required: ["repo", "namePath"]
        }
      },
      {
        name: "find_references",
        description: "Who references a symbol? Three labeled tiers: defs (declarations), callSites (line-precise, import-corroborated call bindings), referencingFiles (file-level identifier/doc mentions \u2014 may include homonyms). Confidence decreases across tiers; the labels let you decide what to trust.",
        inputSchema: {
          type: "object",
          properties: { ...repoProp, name: { type: "string", description: "Symbol name" } },
          required: ["repo", "name"]
        }
      },
      {
        name: "repo_map",
        description: "Token-budgeted map of the repository: the highest-PageRank files with their key exported signatures, deterministically rendered to fit `budgetTokens` (default 1024). The densest single read to understand an unfamiliar codebase.",
        inputSchema: {
          type: "object",
          properties: { ...repoProp, budgetTokens: { type: "number", description: "Approximate token budget (default 1024)" } },
          required: ["repo"]
        }
      },
      {
        name: "hotspots",
        description: "Where does work concentrate? Files ranked by git churn \xD7 size (commits \xD7 log2 lines). High-scoring files are where changes and defects cluster.",
        inputSchema: {
          type: "object",
          properties: { ...repoProp, since: { type: "string", description: "Only count commits after this ref" } },
          required: ["repo"]
        }
      },
      {
        name: "coupling",
        description: "Change coupling: pairs of files that repeatedly change in the same commits \u2014 hidden dependencies no import shows. strength 1.0 = every change to one touched the other.",
        inputSchema: {
          type: "object",
          properties: { ...repoProp, since: { type: "string", description: "Only mine commits after this ref" } },
          required: ["repo"]
        }
      },
      {
        name: "replace_symbol_body",
        description: "WRITE: replace a symbol's whole declaration with `body` (verbatim, supply full indentation). The symbol is resolved by name path ('Class/method'); ambiguity errors list the candidates \u2014 qualify with `file`. Line spans come from the AST index.",
        inputSchema: {
          type: "object",
          properties: {
            ...repoProp,
            namePath: { type: "string" },
            body: { type: "string" },
            file: { type: "string", description: "Disambiguate: repo-relative file containing the symbol" }
          },
          required: ["repo", "namePath", "body"]
        }
      },
      {
        name: "insert_after_symbol",
        description: "WRITE: insert `body` after a symbol's declaration (blank-line separation preserved for definition-like kinds). Resolved like replace_symbol_body.",
        inputSchema: {
          type: "object",
          properties: { ...repoProp, namePath: { type: "string" }, body: { type: "string" }, file: { type: "string" } },
          required: ["repo", "namePath", "body"]
        }
      },
      {
        name: "insert_before_symbol",
        description: "WRITE: insert `body` before a symbol's declaration (blank-line separation preserved). Resolved like replace_symbol_body.",
        inputSchema: {
          type: "object",
          properties: { ...repoProp, namePath: { type: "string" }, body: { type: "string" }, file: { type: "string" } },
          required: ["repo", "namePath", "body"]
        }
      },
      {
        name: "write_memory",
        description: "Persist a named markdown note under <repo>/.codeindex/memories/ (names may use topic/name form). Write small, focused notes: project map, build commands, conventions.",
        inputSchema: {
          type: "object",
          properties: { ...repoProp, name: { type: "string" }, content: { type: "string" } },
          required: ["repo", "name", "content"]
        }
      },
      {
        name: "read_memory",
        description: "Read one persisted memory by name.",
        inputSchema: {
          type: "object",
          properties: { ...repoProp, name: { type: "string" } },
          required: ["repo", "name"]
        }
      },
      {
        name: "list_memories",
        description: "List persisted memory names \u2014 load this first, then read individual memories on relevance.",
        inputSchema: { type: "object", properties: { ...repoProp }, required: ["repo"] }
      },
      {
        name: "delete_memory",
        description: "Delete one persisted memory by name.",
        inputSchema: {
          type: "object",
          properties: { ...repoProp, name: { type: "string" } },
          required: ["repo", "name"]
        }
      },
      {
        name: "dead_code",
        description: "Dead-code candidates in two labeled tiers: 'unreferenced' (no call site binds AND nothing references the name) and 'uncalled' (referenced somewhere \u2014 re-export, type position \u2014 but never called). Exported symbols only; test files and entrypoint-looking files excluded as roots.",
        inputSchema: { type: "object", properties: { ...repoProp, ...scopeProps }, required: ["repo"] }
      },
      {
        name: "complexity",
        description: "Cyclomatic-complexity estimates (branch-token counting over AST line spans), most-complex first. Pass `file` for one file's symbols, omit for the repo-wide top. Combine with hotspots: the `risk` field of this tool's sibling ranks complexity \xD7 churn.",
        inputSchema: {
          type: "object",
          properties: { ...repoProp, file: { type: "string" }, risk: { type: "boolean", description: "Return complexity \xD7 git-churn risk ranking instead" } },
          required: ["repo"]
        }
      },
      {
        name: "mermaid",
        description: "Mermaid diagram of the module graph (renders inline in Claude/GitHub \u2014 no graph database). Optionally scoped to one module's neighborhood.",
        inputSchema: {
          type: "object",
          properties: { ...repoProp, module: { type: "string", description: "Module slug to focus on" } },
          required: ["repo"]
        }
      },
      {
        name: "grep",
        description: "Search file contents (ripgrep when available, deterministic JS fallback otherwise). Returns sorted (file, line, text) hits.",
        inputSchema: {
          type: "object",
          properties: {
            ...repoProp,
            pattern: { type: "string", description: "Regular expression to search for" },
            globs: { type: "array", items: { type: "string" }, description: "Restrict to matching paths" },
            ignoreCase: { type: "boolean" },
            maxHits: { type: "number" }
          },
          required: ["repo", "pattern"]
        }
      },
      {
        name: "search",
        description: 'Natural-language-ish lexical search: BM25 ranking (k1=1.2, b=0.75) over symbol names (camelCase/snake_case subtokens), file path segments, markdown headings and summary lines. NOT embeddings by default \u2014 deterministic, diacritic-folded, zero API keys. Answers "where is auth handled?"-style queries with ranked files, matched terms and top symbols. Query terms with zero document frequency get a deterministic trigram-fuzzy fallback (typo-tolerant) unless `fuzzy: false`. Set `semantic: true` to RRF-fuse an embedding tier (HTTP endpoint, else a local static model) with lexical \u2014 the response then wraps the ranked list as `{ results, tier, degradedReason? }`, `tier` being "endpoint"/"static" when fusion happened or "lexical" (with `degradedReason`) when it did not (see embed_status). Without `semantic`, the response is the bare ranked array, unchanged.',
        inputSchema: {
          type: "object",
          properties: {
            ...repoProp,
            ...scopeProps,
            query: { type: "string", description: "Natural-language or identifier query" },
            limit: { type: "number", description: "Max results (default 20)" },
            fuzzy: {
              type: "boolean",
              description: "Trigram fuzzy fallback for query terms with zero document frequency (default true)"
            },
            semantic: {
              type: "boolean",
              description: 'RRF-fuse an embedding tier with lexical (default false). Precedence: the HTTP endpoint (CODEINDEX_EMBED_ENDPOINT) if set, else a local static model. The response reports the effective tier as a top-level `tier` field ("endpoint"/"static" on success, "lexical" plus `degradedReason` when neither is available/reachable) instead of degrading silently \u2014 see embed_status.'
            }
          },
          required: ["repo", "query"]
        }
      },
      {
        name: "embed_status",
        description: "Report the embedding tier: the effective mode (none/static/endpoint; endpoint > static model), the resolved model (opt-in, never shipped in the package) with its modelId/dim, EMBED_VERSION, and the configured HTTP endpoint with its reachability. Use to check whether `search` with semantic:true will fuse embeddings or degrade to lexical.",
        inputSchema: { type: "object", properties: { ...repoProp }, required: ["repo"] }
      },
      {
        name: "check_rules",
        description: 'Validate dependency-cruiser-style architecture rules against the link-graph. Rules (inline JSON array): forbidden edges {name, from, to, kind?, severity?, comment?} with glob paths, plus builtins {name, builtin: "cycles"|"orphans"} (module-level import cycles; edge-less code files). Returns deterministic violations with severity error|warn \u2014 a CI gate.',
        inputSchema: {
          type: "object",
          properties: {
            ...repoProp,
            ...scopeProps,
            rules: { type: "array", description: "Rules array (inline JSON \u2014 see description)" }
          },
          required: ["repo", "rules"]
        }
      }
    ];
    SCANLESS_TOOLS = /* @__PURE__ */ new Set([
      "workspaces",
      "churn",
      "coupling",
      "grep",
      "write_memory",
      "read_memory",
      "list_memories",
      "delete_memory",
      "embed_status"
    ]);
  }
});
var rewrite_exports = {};
__export(rewrite_exports, {
  rewriteCommand: () => rewriteCommand,
  shellQuote: () => shellQuote,
  tokenize: () => tokenize2
});
function tokenize2(line) {
  const out2 = [];
  let cur = "";
  let quote;
  let started = false;
  for (let i2 = 0; i2 < line.length; i2++) {
    const c2 = line[i2];
    if (quote) {
      if (c2 === quote) quote = void 0;
      else cur += c2;
      continue;
    }
    if (c2 === '"' || c2 === "'") {
      quote = c2;
      started = true;
      continue;
    }
    if (c2 === " " || c2 === "	") {
      if (started || cur) out2.push(cur);
      cur = "";
      started = false;
      continue;
    }
    cur += c2;
  }
  if (quote) return void 0;
  if (started || cur) out2.push(cur);
  return out2;
}
function shellQuote(s) {
  if (s !== "" && !/[^A-Za-z0-9_\-./=@:]/.test(s)) return s;
  return "'" + s.replace(/'/g, `'\\''`) + "'";
}
function parseSearch(bin, args2) {
  const p = { ignoreCase: false, includes: [], recursive: bin !== "grep" && bin !== "egrep" };
  const positionals = [];
  for (let i2 = 0; i2 < args2.length; i2++) {
    const a = args2[i2];
    if (a === void 0) continue;
    if (a === "--") {
      positionals.push(...args2.slice(i2 + 1));
      break;
    }
    if (!a.startsWith("-") || a === "-") {
      positionals.push(a);
      continue;
    }
    if (a === "-i" || a === "--ignore-case") {
      p.ignoreCase = true;
    } else if (a === "-r" || a === "-R" || a === "--recursive") {
      p.recursive = true;
    } else if (a === "-n" || a === "--line-number" || a === "-H" || a === "--with-filename" || a === "--no-heading") {
    } else if (a === "-e" || a === "--regexp") {
      const v = args2[++i2];
      if (v === void 0 || p.pattern !== void 0) return void 0;
      p.pattern = v;
    } else if (a.startsWith("--include=")) {
      p.includes.push(a.slice("--include=".length));
    } else if (a === "--include" || a === "-g" || a === "--glob") {
      const v = args2[++i2];
      if (v === void 0) return void 0;
      p.includes.push(v);
    } else if (a.length > 2 && /^-[a-zA-Z]+$/.test(a)) {
      const expanded = a.slice(1).split("").map((c2) => `-${c2}`);
      args2.splice(i2, 1, ...expanded);
      i2--;
    } else {
      return void 0;
    }
  }
  if (p.pattern === void 0) {
    const first = positionals.shift();
    if (first === void 0 || first === "") return void 0;
    p.pattern = first;
  }
  if (positionals.length > 1) return void 0;
  p.path = positionals[0];
  return p;
}
function rewriteCommand(cmd, bin = "codeindex") {
  const line = cmd.trim();
  if (!line || SHELL_METACHARS.test(line)) return void 0;
  const tokens2 = tokenize2(line);
  if (!tokens2 || tokens2.length < 2) return void 0;
  const [head, ...args2] = tokens2;
  if (head === void 0 || !GREP_BINARIES.has(head)) return void 0;
  const p = parseSearch(head, args2);
  if (!p || p.pattern === void 0) return void 0;
  const pattern = p.pattern;
  if (!p.recursive) return void 0;
  const path = p.path;
  const out2 = [bin, "grep", shellQuote(pattern)];
  if (path && path !== "." && path !== "./") {
    out2.push("--scope", shellQuote(path.replace(/\/+$/, "")));
  }
  if (p.ignoreCase) out2.push("--ignore-case");
  for (const g of p.includes) out2.push("--include", shellQuote(g));
  return out2.join(" ");
}
var SHELL_METACHARS;
var GREP_BINARIES;
var init_rewrite = __esm({
  "src/rewrite.ts"() {
    "use strict";
    SHELL_METACHARS = /[|&;<>`\n\r$(){}]/;
    GREP_BINARIES = /* @__PURE__ */ new Set(["grep", "egrep", "rg", "ripgrep"]);
  }
});
init_types();
init_walk();
init_scan();
init_glob();
init_ignore();
init_classify();
var CODE_EXTS = /* @__PURE__ */ new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".vue",
  ".svelte",
  ".astro",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".kts",
  ".php",
  ".c",
  ".cc",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".swift",
  ".scala",
  ".clj",
  ".ex",
  ".exs",
  ".dart",
  ".lua",
  ".sh",
  ".bash",
  ".zig",
  ".elm"
]);
var STYLE_EXTS = /* @__PURE__ */ new Set([".css", ".scss", ".sass", ".less", ".styl", ".pcss"]);
var DOC_EXTS = /* @__PURE__ */ new Set([".md", ".mdx", ".rst", ".adoc", ".txt"]);
var DATA_EXTS = /* @__PURE__ */ new Set([".json", ".yaml", ".yml", ".toml", ".csv", ".xml", ".env"]);
var ASSET_EXTS = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".ico",
  ".bmp",
  ".tiff",
  ".svg",
  ".pdf",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".webm",
  // Archives / compiled binaries: reconstruct's bundle files these under
  // "asset" (opaque blob shipped with the repo, not code/data) — the engine
  // matches instead of letting them fall through to "other".
  ".zip",
  ".gz",
  ".tar",
  ".rar",
  ".7z",
  ".wasm",
  ".so",
  ".dylib",
  ".dll",
  ".exe",
  ".bin",
  ".class",
  ".jar",
  ".pyc",
  ".node"
]);
var I18N_DIRS = ["locales", "locale", "i18n", "lang", "langs", "translations", "messages"];
var I18N_EXTS = /* @__PURE__ */ new Set([".json", ".yaml", ".yml", ".po", ".properties"]);
var TEST_DIRS = ["__tests__", "test", "tests", "spec", "e2e", "__mocks__"];
var SCHEMA_DIRS = ["migrations", "entities", "models"];
var CONFIG_BASES = /* @__PURE__ */ new Set([
  "package.json",
  "tsconfig.json",
  "dockerfile",
  "makefile",
  "pyproject.toml",
  "cargo.toml",
  "go.mod",
  "requirements.txt",
  "gemfile",
  "composer.json",
  "pubspec.yaml"
]);
function categorize(rel, ext) {
  const lower = rel.toLowerCase();
  const base = basename2(lower);
  const segments = lower.split("/");
  const inDir2 = (names) => names.some((n) => segments.includes(n));
  if (inDir2(I18N_DIRS) && I18N_EXTS.has(ext)) return "i18n";
  if (ext === ".prisma" || ext === ".sql" || ext === ".graphql" || ext === ".gql" || base.startsWith("schema.") || base === "models.py" || inDir2(SCHEMA_DIRS)) {
    return "schema";
  }
  if (lower.includes(".test.") || lower.includes(".spec.") || inDir2(TEST_DIRS)) return "test";
  if (CONFIG_BASES.has(base) || base.endsWith(".config.js") || base.endsWith(".config.ts") || base.endsWith(".config.mjs") || base.startsWith(".eslintrc") || base.startsWith(".prettierrc") || base.startsWith(".env") || base.startsWith("docker-compose")) {
    return "config";
  }
  if (DOC_EXTS.has(ext)) return "doc";
  if (STYLE_EXTS.has(ext)) return "style";
  if (CODE_EXTS.has(ext)) return "code";
  if (ASSET_EXTS.has(ext)) return "asset";
  if (DATA_EXTS.has(ext)) return "data";
  return "other";
}
init_registry();
init_code();
init_markdown();
init_loader();
init_extract();
init_loader();
init_types();
var DEFAULT_GRAMMARS_URL = `https://github.com/maxgfr/codeindex/releases/download/v${ENGINE_VERSION}/grammars-${ENGINE_VERSION}.tar.gz`;
function resolveGrammarsPullTarget() {
  const env = process.env.CODEINDEX_GRAMMARS_URL;
  if (env && env.trim()) return { url: env.trim() };
  return { url: DEFAULT_GRAMMARS_URL, sha256Url: `${DEFAULT_GRAMMARS_URL}.sha256` };
}
async function fetchGrammarsTarball(url, expectedSha256) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (expectedSha256) {
    const got = createHash2("sha256").update(buf).digest("hex");
    if (got !== expectedSha256) {
      throw new Error(`sha256 mismatch: expected ${expectedSha256}, got ${got}`);
    }
  }
  return buf;
}
function asBuffer(u) {
  return Buffer.isBuffer(u) ? u : Buffer.from(u.buffer, u.byteOffset, u.byteLength);
}
async function fetchExpectedSha256(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const text = await res.text();
  const hex = (text.trim().split(/\s+/)[0] ?? "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error(`invalid sha256 sidecar at ${url}`);
  return hex;
}
function cstr(block, start2, len) {
  const slice = block.subarray(start2, start2 + len);
  const nul = slice.indexOf(0);
  return slice.toString("utf8", 0, nul === -1 ? slice.length : nul);
}
function* readTar(buf) {
  let off = 0;
  while (off + 512 <= buf.length) {
    const block = buf.subarray(off, off + 512);
    let allZero = true;
    for (let i2 = 0; i2 < 512; i2++) {
      if (block[i2] !== 0) {
        allZero = false;
        break;
      }
    }
    if (allZero) break;
    const name2 = cstr(block, 0, 100);
    const prefix = cstr(block, 345, 155);
    const sizeStr = cstr(block, 124, 12).trim();
    const size = sizeStr ? parseInt(sizeStr, 8) : 0;
    const type = String.fromCharCode(block[156] ?? 0);
    off += 512;
    const data = buf.subarray(off, off + size);
    off += Math.ceil(size / 512) * 512;
    yield { name: prefix ? `${prefix}/${name2}` : name2, type, data };
  }
}
function safeRelPath(name2) {
  if (!name2 || name2.includes("\0")) return null;
  if (name2.startsWith("/") || name2.startsWith("\\") || /^[A-Za-z]:/.test(name2)) return null;
  const out2 = [];
  for (const part of name2.split(/[/\\]/)) {
    if (part === "" || part === ".") continue;
    if (part === "..") return null;
    out2.push(part);
  }
  return out2.length ? out2.join("/") : null;
}
function extractTarInto(rawTar, destDir) {
  const root = resolve(destDir);
  const written = [];
  for (const entry of readTar(asBuffer(rawTar))) {
    if (entry.type !== "0" && entry.type !== "\0") continue;
    const rel = safeRelPath(entry.name);
    if (rel === null) throw new Error(`refusing unsafe tar entry: ${entry.name}`);
    const dest = resolve(destDir, rel);
    if (dest !== root && !dest.startsWith(root + sep2)) {
      throw new Error(`tar entry escapes destination: ${entry.name}`);
    }
    mkdirSync(dirname2(dest), { recursive: true });
    writeFileSync(dest, entry.data);
    written.push(rel);
  }
  return written;
}
function extractGrammarsTarball(bytes, destDir) {
  const b = asBuffer(bytes);
  const raw = b.length >= 2 && b[0] === 31 && b[1] === 139 ? gunzipSync(b) : b;
  return extractTarInto(raw, destDir);
}
async function pullGrammars(cacheDir, opts = {}) {
  const note = opts.onNote ?? (() => {
  });
  const target = resolveGrammarsPullTarget();
  let expected;
  if (target.sha256Url) {
    try {
      expected = await fetchExpectedSha256(target.sha256Url);
    } catch (e) {
      note(`codeindex: could not fetch checksum (${e instanceof Error ? e.message : String(e)}) \u2014 proceeding unverified
`);
    }
  }
  const runtime = join3(cacheDir, "web-tree-sitter.wasm");
  const markerPath = join3(dirname2(cacheDir), `${ENGINE_VERSION}.sha256`);
  if (existsSync2(runtime) && expected && existsSync2(markerPath)) {
    let marker = "";
    try {
      marker = readFileSync3(markerPath, "utf8").trim();
    } catch {
    }
    if (marker === expected) {
      return { ok: true, status: "up-to-date", cacheDir, message: `codeindex: grammars already present at ${cacheDir} (up to date)
` };
    }
  }
  note(`codeindex: fetching grammars from ${target.url} \u2192 ${cacheDir}
`);
  let bytes;
  try {
    bytes = await fetchGrammarsTarball(target.url, expected);
  } catch (e) {
    return {
      ok: false,
      status: "failed",
      cacheDir,
      message: `codeindex: pull failed \u2014 ${e instanceof Error ? e.message : String(e)} (nothing written)
`
    };
  }
  let tmp;
  try {
    mkdirSync(dirname2(cacheDir), { recursive: true });
    tmp = mkdtempSync(join3(dirname2(cacheDir), ".grammars-tmp-"));
    extractGrammarsTarball(bytes, tmp);
    if (!existsSync2(join3(tmp, "web-tree-sitter.wasm"))) {
      throw new Error("archive is missing web-tree-sitter.wasm");
    }
    if (existsSync2(cacheDir)) rmSync(cacheDir, { recursive: true, force: true });
    renameSync(tmp, cacheDir);
    tmp = void 0;
    if (expected) writeFileSync(markerPath, expected + "\n");
  } catch (e) {
    if (tmp) {
      try {
        rmSync(tmp, { recursive: true, force: true });
      } catch {
      }
    }
    return {
      ok: false,
      status: "failed",
      cacheDir,
      message: `codeindex: pull failed \u2014 ${e instanceof Error ? e.message : String(e)} (nothing written)
`
    };
  }
  return { ok: true, status: "pulled", cacheDir, message: `codeindex: grammars extracted \u2192 ${cacheDir}
` };
}
init_loader();
async function warmGrammars(opts = {}) {
  const label = opts.label ?? "codeindex";
  const notes = [];
  const note = (msg) => {
    notes.push(msg);
    if (opts.onNote) opts.onNote(msg);
    else process.stderr.write(msg);
  };
  const noPull = process.env.CODEINDEX_NO_GRAMMARS_PULL;
  const mayPull = (opts.pull ?? true) && !(noPull && noPull.trim() && noPull !== "0");
  const keys = [...opts.keys ?? allGrammarKeys()];
  let pulled = false;
  if (resolveGrammarsTier().tier === "none" && mayPull) {
    note(`${label}: tree-sitter grammars not found locally \u2014 pulling them into the shared cache (once per machine)\u2026
`);
    const res = await pullGrammars(sharedGrammarsCacheDir(), { onNote: note });
    note(res.message);
    pulled = res.ok && res.status === "pulled";
  }
  await ensureGrammars(keys);
  const tier = resolveGrammarsTier().tier;
  const ready = keys.some((k) => grammarReady(k));
  if (!ready) {
    note(
      `${label}: no tree-sitter grammars available (offline?) \u2014 extracting with the regex tier, so symbols and call sites are less precise. Run \`codeindex grammars pull\` once online to enable AST precision.
`
    );
  }
  return { tier, ready, pulled, notes };
}
init_resolve();
init_modules();
init_graph();
init_calls();
init_callers();
init_query();
init_edit();
init_memory();
init_workspaces();
init_centrality();
init_community();
init_tests_map();
init_surprise();
init_symbols_json();
init_graph_json();
init_types();
init_walk();
init_sort();
var utf8 = new TextEncoder();
function pushVarint(out2, n) {
  if (n < 0) throw new Error(`pushVarint: negative input ${n} is not a valid unsigned varint`);
  while (n > 127) {
    out2.push(n & 127 | 128);
    n = Math.floor(n / 128);
  }
  out2.push(n & 127);
}
function pushTag(out2, field, wire) {
  pushVarint(out2, field * 8 + wire);
}
function pushVarintField(out2, field, n) {
  pushTag(out2, field, 0);
  pushVarint(out2, n);
}
function pushLenDelim(out2, field, payload) {
  pushTag(out2, field, 2);
  pushVarint(out2, payload.length);
  for (let i2 = 0; i2 < payload.length; i2++) out2.push(payload[i2]);
}
function pushString(out2, field, s) {
  pushLenDelim(out2, field, utf8.encode(s));
}
function pushPackedInt32(out2, field, values) {
  const payload = [];
  for (const v of values) pushVarint(payload, v);
  pushLenDelim(out2, field, payload);
}
var F_INDEX_METADATA = 1;
var F_INDEX_DOCUMENTS = 2;
var F_META_TOOL_INFO = 2;
var F_META_PROJECT_ROOT = 3;
var F_META_TEXT_ENCODING = 4;
var F_TOOL_NAME = 1;
var F_TOOL_VERSION = 2;
var F_DOC_RELPATH = 1;
var F_DOC_OCCURRENCES = 2;
var F_DOC_SYMBOLS = 3;
var F_DOC_LANGUAGE = 4;
var F_DOC_POSITION_ENCODING = 6;
var F_OCC_RANGE = 1;
var F_OCC_SYMBOL = 2;
var F_OCC_ROLES = 3;
var F_SI_SYMBOL = 1;
var F_SI_KIND = 5;
var F_SI_DISPLAY_NAME = 6;
var F_SI_ENCLOSING = 8;
var TEXT_ENCODING_UTF8 = 1;
var ROLE_DEFINITION = 1;
var POSITION_ENCODING_UTF16 = 2;
var KIND = {
  function: 17,
  // Function
  method: 26,
  // Method
  class: 7,
  // Class
  interface: 21,
  // Interface
  enum: 11,
  // Enum
  struct: 49,
  // Struct
  trait: 53,
  // Trait
  type: 54,
  // Type
  const: 8,
  // Constant
  var: 61
  // Variable
};
var SYMBOL_PREFIX = "codeindex . . . ";
var SIMPLE_ID = /^[A-Za-z0-9_+\-$]+$/;
function escapeId(name2) {
  return SIMPLE_ID.test(name2) ? name2 : "`" + name2.replace(/`/g, "``") + "`";
}
function fileNamespace(rel) {
  return "`" + rel.replace(/`/g, "``") + "`/";
}
function parentDescriptor(parent) {
  return escapeId(parent) + "#";
}
var TYPE_KINDS = /* @__PURE__ */ new Set(["class", "interface", "enum", "struct", "trait", "type"]);
var METHOD_KINDS = /* @__PURE__ */ new Set(["function", "method", "def"]);
function suffixFor(kind) {
  if (TYPE_KINDS.has(kind)) return "#";
  if (METHOD_KINDS.has(kind)) return "().";
  return ".";
}
function baseSymbol(rel, sym) {
  let s = SYMBOL_PREFIX + fileNamespace(rel);
  if (sym.parent) s += parentDescriptor(sym.parent);
  return s + escapeId(sym.name) + suffixFor(sym.kind);
}
function enclosingSymbolOf(rel, parent) {
  return SYMBOL_PREFIX + fileNamespace(rel) + parentDescriptor(parent);
}
function makeUnique(base, line, used) {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  for (let n = 0; ; n++) {
    const disambiguator = n === 0 ? String(line) : `${line}_${n}`;
    const cand = `${base}(${disambiguator})`;
    if (!used.has(cand)) {
      used.add(cand);
      return cand;
    }
  }
}
function familyOf2(lang) {
  if (lang === "typescript" || lang === "javascript") return "js";
  if (lang === "c" || lang === "cpp") return "c";
  return lang;
}
var REFERENCE_KINDS5 = /* @__PURE__ */ new Set(["reexport", "reexport-all", "default"]);
function isIdentByte(code) {
  return code >= 48 && code <= 57 || // 0-9
  code >= 65 && code <= 90 || // A-Z
  code >= 97 && code <= 122 || // a-z
  code === 95 || // _
  code === 36;
}
function findWord(line, name2) {
  if (!name2) return null;
  const wordy = /^[A-Za-z_$][\w$]*$/.test(name2);
  let from = 0;
  for (; ; ) {
    const idx = line.indexOf(name2, from);
    if (idx < 0) return null;
    if (!wordy) return [idx, idx + name2.length];
    const before = idx > 0 ? line.charCodeAt(idx - 1) : -1;
    const afterIdx = idx + name2.length;
    const after = afterIdx < line.length ? line.charCodeAt(afterIdx) : -1;
    if (!isIdentByte(before) && !isIdentByte(after)) return [idx, idx + name2.length];
    from = idx + 1;
  }
}
function renderScip(scan2, opts = {}) {
  const projectRoot = opts.projectRoot ?? "file://" + scan2.root.replace(/\\/g, "/");
  const toolVersion = opts.toolVersion ?? ENGINE_VERSION;
  const docs = scan2.files.filter((f) => f.kind === "code" && f.symbols.length > 0);
  const docDefs = /* @__PURE__ */ new Map();
  const defByName = /* @__PURE__ */ new Map();
  for (const f of docs) {
    const used = /* @__PURE__ */ new Set();
    const entries = [];
    for (const sym of f.symbols) {
      const symbolString = makeUnique(baseSymbol(f.rel, sym), sym.line, used);
      entries.push({ sym, symbolString });
      if (sym.exported && !REFERENCE_KINDS5.has(sym.kind)) {
        let arr = defByName.get(sym.name);
        if (!arr) defByName.set(sym.name, arr = []);
        arr.push({ symbolString, family: familyOf2(sym.lang) });
      }
    }
    docDefs.set(f.rel, entries);
  }
  const resolveRef = (name2, callerFamily) => {
    const cands = defByName.get(name2);
    if (!cands || cands.length !== 1) return void 0;
    const only = cands[0];
    return only.family === callerFamily ? only.symbolString : void 0;
  };
  const documents2 = [];
  for (const f of docs) {
    const text = readText(join12(scan2.root, f.rel));
    const lines = text.split("\n").map((l) => l.endsWith("\r") ? l.slice(0, -1) : l);
    const locate = (lineNo, name2) => {
      const line = lines[lineNo - 1];
      if (line === void 0) return [lineNo - 1, 0, 0];
      const r = findWord(line, name2);
      return r ? [lineNo - 1, r[0], r[1]] : [lineNo - 1, 0, line.length];
    };
    const entries = docDefs.get(f.rel);
    const occs = [];
    for (const { sym, symbolString } of entries) {
      occs.push({ range: locate(sym.line, sym.name), symbol: symbolString, roles: ROLE_DEFINITION });
    }
    const callerFamily = familyOf2(f.lang);
    for (const c2 of f.calls ?? []) {
      const target = resolveRef(c2.name, callerFamily);
      if (!target) continue;
      occs.push({ range: locate(c2.line, c2.name), symbol: target, roles: 0 });
    }
    occs.sort(
      (a, b) => a.range[0] - b.range[0] || a.range[1] - b.range[1] || a.range[2] - b.range[2] || a.roles - b.roles || byStr(a.symbol, b.symbol)
    );
    const seenOcc = /* @__PURE__ */ new Set();
    const infos = entries.map(({ sym, symbolString }) => ({
      symbol: symbolString,
      displayName: sym.name,
      kind: KIND[sym.kind],
      enclosing: sym.parent ? enclosingSymbolOf(f.rel, sym.parent) : void 0
    })).sort((a, b) => byStr(a.symbol, b.symbol));
    const doc = [];
    pushString(doc, F_DOC_RELPATH, f.rel);
    for (const o of occs) {
      const key = `${o.range.join(",")} ${o.roles} ${o.symbol}`;
      if (seenOcc.has(key)) continue;
      seenOcc.add(key);
      const ob = [];
      pushPackedInt32(ob, F_OCC_RANGE, o.range);
      pushString(ob, F_OCC_SYMBOL, o.symbol);
      if (o.roles !== 0) pushVarintField(ob, F_OCC_ROLES, o.roles);
      pushLenDelim(doc, F_DOC_OCCURRENCES, ob);
    }
    for (const si of infos) {
      const sb = [];
      pushString(sb, F_SI_SYMBOL, si.symbol);
      if (si.kind !== void 0) pushVarintField(sb, F_SI_KIND, si.kind);
      pushString(sb, F_SI_DISPLAY_NAME, si.displayName);
      if (si.enclosing) pushString(sb, F_SI_ENCLOSING, si.enclosing);
      pushLenDelim(doc, F_DOC_SYMBOLS, sb);
    }
    pushString(doc, F_DOC_LANGUAGE, f.lang);
    pushVarintField(doc, F_DOC_POSITION_ENCODING, POSITION_ENCODING_UTF16);
    documents2.push(doc);
  }
  const toolInfo = [];
  pushString(toolInfo, F_TOOL_NAME, "codeindex");
  pushString(toolInfo, F_TOOL_VERSION, toolVersion);
  const metadata2 = [];
  pushLenDelim(metadata2, F_META_TOOL_INFO, toolInfo);
  pushString(metadata2, F_META_PROJECT_ROOT, projectRoot);
  pushVarintField(metadata2, F_META_TEXT_ENCODING, TEXT_ENCODING_UTF8);
  const index = [];
  pushLenDelim(index, F_INDEX_METADATA, metadata2);
  for (const d of documents2) pushLenDelim(index, F_INDEX_DOCUMENTS, d);
  return Uint8Array.from(index);
}
init_pipeline();
init_git();
init_grep();
init_bm25();
init_model();
init_encode();
init_embed();
init_search();
init_endpoint();
init_rules();
init_coupling();
init_repomap();
init_deadcode();
init_complexity();
init_viz();
init_mcp();
init_rewrite();
init_hash();
init_sort();
init_util();
init_types();
init_types();
init_loader();
init_pipeline();
init_hash();
init_graph_json();
init_symbols_json();
init_scan();
init_walk();
init_callers();
init_workspaces();
init_git();
init_grep();
init_coupling();
init_repomap();
init_deadcode();
init_complexity();
init_viz();
init_bm25();
init_rules();
init_model();
init_embed();
init_search();
init_endpoint();
init_util();
var HELP = `codeindex engine v${ENGINE_VERSION} \u2014 deterministic repo indexing

Usage: engine.mjs <command> [flags]

Commands:
  index       Build graph.json + symbols.json (+ incremental cache.json) into
              --out <dir> in ONE pass \u2014 the fast path for repeated runs
  scan        Scan summary: file count, language histogram, capped flag
  graph       Full link-graph (graph.json bytes) to stdout or --out
  symbols     Symbol index (symbols.json bytes) to stdout or --out
  scip        SCIP code-intelligence index (protobuf bytes) into --out
              (default index.scip; --out - writes to stdout)
  callers     Per-symbol caller index (JSON)
  workspaces  Monorepo packages + dependency graph (JSON)
  churn       Per-file git commit counts (JSON; --since <ref> to bound)
  grep        Search: cli.mjs grep <pattern> --repo <dir> (JSON hits)
  search      Keyless BM25 lexical search over symbol names, path segments,
              markdown headings and summaries: cli.mjs search "<query>" --repo <dir>.
              --semantic fuses in an embedding tier (RRF) \u2014 the HTTP endpoint
              (CODEINDEX_EMBED_ENDPOINT) if set, else a local static model;
              degrades to lexical (exit 0) when neither is available/reachable
  embed       Embedding tiers (opt-in). Precedence: endpoint > static model:
                embed status   Effective mode (none/static/endpoint), model +
                               EMBED_VERSION, and endpoint reachability (JSON)
                embed build    Write embeddings.bin into --out <dir> (static tier)
                embed pull     Fetch the official model asset into CODEINDEX_EMBED_DIR
                               (or <repo>/.codeindex/models/); sha256-verified. Override
                               the source with CODEINDEX_EMBED_URL
                embed serve    Print (or --run) the docker command that starts the
                               containerized embedding server (rich tier)
  grammars    Tree-sitter wasm grammars (optional AST tier; regex without them).
              Precedence: bundle-adjacent > CODEINDEX_GRAMMARS_DIR > shared cache:
                grammars status  Active tier (adjacent/env/cache/none), resolved
                                 dir, pinned ENGINE_VERSION, pull-needed (JSON)
                grammars pull    Fetch the per-release grammars-<version>.tar.gz
                                 asset into the shared cache (sha256-verified,
                                 atomic). Override the source with
                                 CODEINDEX_GRAMMARS_URL
  rules       Architecture rules (forbidden edges, cycles, orphans) validated
              against the link-graph: --config <codeindex.rules.json>; exits 1
              on any error-severity violation (a CI gate)
  repomap     Token-budgeted map of the highest-PageRank files (--budget-tokens)
  hotspots    Churn \xD7 size ranking of the files where work concentrates (JSON)
  coupling    Change coupling: files that change together (JSON; --since <ref>)
  deadcode    Dead-code candidates in two labeled tiers: 'unreferenced' (no
              call site binds AND nothing references the name) and 'uncalled'
              (referenced \u2014 re-export, type position \u2014 but never called)
  complexity  Cyclomatic-complexity estimates, most-complex first. Pass a file
              positional for one file; omit for the repo-wide top
  risk        Complexity \xD7 git-churn ranking (JSON; --since <ref> to bound)
  mermaid     Mermaid diagram of the module graph; pass a module positional to
              focus on one neighborhood
  rewrite     Map an expensive tree-wide search onto its indexed equivalent:
              cli.mjs rewrite '<command line>'. Prints the replacement command
              and exits 0, or exits 1 when it has no opinion (run the original).
              Deliberately conservative \u2014 any shell metacharacter or unknown
              flag refuses the rewrite
  mcp         Run as an MCP server over stdio (26 tools: scan_summary, graph,
              symbols, callers, workspaces, churn, symbols_overview,
              find_symbol, find_references, repo_map, hotspots, coupling,
              dead_code, complexity, mermaid, grep, search, embed_status,
              check_rules, the memory quartet and the three symbolic-edit
              writes). Flags: --repo <dir> pins ONE repository so the per-tool
              repo argument becomes optional (an explicit per-call repo still
              wins); --server-name <name> overrides the announced serverInfo
  version     Print the engine version

Flags:
  --repo <dir>        Repo root (default: cwd)
  --out <file>        Write output to a file instead of stdout (\`scip\`: --out -
                      writes the binary index to stdout)
  --project-root <uri> \`scip\`: override Metadata.project_root (default
                      file://<repo>); pin it for a byte-reproducible index
  --include <glob>    Only include matching paths (repeatable)
  --exclude <glob>    Exclude matching paths (repeatable)
  --scope <dir>       Restrict to one directory (sugar for --include '<dir>/**')
  --no-gitignore      Do not honor .gitignore files (default: honored)
  --ignore-dir <name> Directory names to skip (repeatable) \u2014 REPLACES the
                      default ignored-directory set, never merges with it
  --max-files <n>     Cap walked files (default 20000)
  --max-bytes <n>     Skip files above this size (default 1 MiB)
  --max-calls <n>     Per-file call-site cap for extraction (default 512)
  --no-ast            Skip tree-sitter grammars even when present (regex tier)
  --config <file>     Rules config for \`rules\` (JSON: [{name, from, to, \u2026}])
  --limit <n>         Max results for \`search\` (default 20)
  --no-fuzzy          \`search\`: disable trigram fuzzy fallback for query terms
                      with zero document frequency (default: enabled)
  --semantic          \`search\`: RRF-fuse an embedding tier with lexical \u2014 the
                      HTTP endpoint if CODEINDEX_EMBED_ENDPOINT is set, else a
                      local static model (lexical-only when neither is available)
  --run               \`embed serve\`: run the docker command instead of printing it
  --recall            \`callers\`: recall-oriented binding (issue #7) \u2014 relaxes
                      the JS/TS import gate to unique repo-wide names and labels
                      each site corroborated|unique-name
  --ignore-case       \`grep\`: case-insensitive matching
  --max-hits <n>      \`grep\`: cap returned hits (default 200)
`;
function parseFlags(args2) {
  const flags2 = { repo: process.cwd(), include: [], exclude: [], gitignore: true, ignoreDirs: [], noAst: false, fuzzy: true, semantic: false };
  for (let i2 = 0; i2 < args2.length; i2++) {
    const a = args2[i2];
    const next = () => {
      const v = args2[++i2];
      if (v === void 0) throw new Error(`missing value for ${a}`);
      return v;
    };
    const num = () => {
      const raw = next();
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`${a} expects a positive number, got "${raw}"`);
      return n;
    };
    if (a === "--repo") flags2.repo = resolve2(next());
    else if (a === "--out") {
      const v = next();
      flags2.out = v === "-" ? "-" : resolve2(v);
    } else if (a === "--project-root") flags2.projectRoot = next();
    else if (a === "--include") flags2.include.push(next());
    else if (a === "--exclude") flags2.exclude.push(next());
    else if (a === "--scope") flags2.scope = next();
    else if (a === "--no-gitignore") flags2.gitignore = false;
    else if (a === "--ignore-dir") flags2.ignoreDirs.push(next());
    else if (a === "--max-files") flags2.maxFiles = num();
    else if (a === "--max-bytes") flags2.maxBytes = num();
    else if (a === "--max-calls") flags2.maxCalls = num();
    else if (a === "--ignore-case") flags2.ignoreCase = true;
    else if (a === "--max-hits") flags2.maxHits = num();
    else if (a === "--budget-tokens") flags2.budgetTokens = num();
    else if (a === "--no-ast") flags2.noAst = true;
    else if (a === "--since") flags2.since = next();
    else if (a === "--config") flags2.config = resolve2(next());
    else if (a === "--limit") flags2.limit = num();
    else if (a === "--no-fuzzy") flags2.fuzzy = false;
    else if (a === "--semantic") flags2.semantic = true;
    else if (a === "--recall") flags2.recall = true;
    else if (a === "--run") flags2.run = true;
    else if (!a.startsWith("--") && flags2.positional === void 0) flags2.positional = a;
    else throw new Error(`unknown flag: ${a}`);
  }
  return flags2;
}
function emit(content, out2) {
  if (out2) writeFileSync4(out2, content);
  else process.stdout.write(content);
}
function scanOptions(flags2, precomputedWalk) {
  return {
    include: flags2.include.length ? flags2.include : void 0,
    exclude: flags2.exclude.length ? flags2.exclude : void 0,
    scope: flags2.scope,
    gitignore: flags2.gitignore,
    ignoreDirs: flags2.ignoreDirs.length ? flags2.ignoreDirs : void 0,
    maxFiles: flags2.maxFiles,
    maxBytes: flags2.maxBytes,
    maxCallsPerFile: flags2.maxCalls,
    // The walk performed once in runCli to warm the present-language grammars,
    // reused here so scanRepo does not traverse the tree a second time. Absent
    // for --no-ast / scan-less commands: scanRepo walks itself, unchanged.
    precomputedWalk
  };
}
var SCANLESS_COMMANDS = /* @__PURE__ */ new Set(["grep", "churn", "coupling", "workspaces", "grammars"]);
function parseMcpFlags(argv) {
  let defaultRepo;
  let name2;
  for (let i2 = 0; i2 < argv.length; i2++) {
    const a = argv[i2];
    if (a === "--repo") {
      const v = argv[++i2];
      if (!v) throw new Error("--repo requires a directory");
      defaultRepo = resolve2(v);
    } else if (a === "--server-name") {
      const v = argv[++i2];
      if (!v) throw new Error("--server-name requires a value");
      name2 = v;
    } else {
      throw new Error(`unknown flag for \`mcp\`: ${a}`);
    }
  }
  if (defaultRepo && !existsSync5(defaultRepo)) throw new Error(`--repo path does not exist: ${defaultRepo}`);
  return { defaultRepo, serverInfo: name2 ? { name: name2 } : void 0 };
}
async function runCli(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    process.stdout.write(HELP);
    return;
  }
  if (cmd === "version" || cmd === "--version") {
    process.stdout.write(ENGINE_VERSION + "\n");
    return;
  }
  if (cmd === "rewrite") {
    const { rewriteCommand: rewriteCommand2 } = await Promise.resolve().then(() => (init_rewrite(), rewrite_exports));
    const rewritten = rewriteCommand2(rest.join(" "));
    if (!rewritten) {
      process.exitCode = 1;
      return;
    }
    process.stdout.write(rewritten + "\n");
    return;
  }
  if (cmd === "mcp") {
    const { runMcpServer: runMcpServer2 } = await Promise.resolve().then(() => (init_mcp(), mcp_exports));
    await runMcpServer2(parseMcpFlags(rest));
    return;
  }
  const flags2 = parseFlags(rest);
  if (!existsSync5(flags2.repo)) throw new Error(`--repo path does not exist: ${flags2.repo}`);
  const scans = !SCANLESS_COMMANDS.has(cmd) && !(cmd === "embed" && flags2.positional !== "build");
  let precomputedWalk;
  if (scans && !flags2.noAst) {
    precomputedWalk = walk(flags2.repo, {
      maxFileBytes: flags2.maxBytes,
      maxFiles: flags2.maxFiles,
      gitignore: flags2.gitignore,
      ignoreDirs: flags2.ignoreDirs.length ? flags2.ignoreDirs : void 0
    });
    await ensureGrammars(grammarKeysForExts(precomputedWalk.files.map((f) => f.ext)));
  }
  if (cmd === "index") {
    if (!flags2.out) throw new Error("index needs --out <dir>");
    const outDir = flags2.out;
    mkdirSync3(outDir, { recursive: true });
    const cachePath = join15(outDir, "cache.json");
    let cache;
    let meta = {};
    try {
      const parsed = JSON.parse(readFileSync8(cachePath, "utf8"));
      if (parsed.schemaVersion === SCHEMA_VERSION && parsed.extractorVersion === EXTRACTOR_VERSION) {
        cache = new Map(Object.entries(parsed.files));
        meta = {
          engineVersion: parsed.engineVersion,
          commit: parsed.commit,
          graphSha1: parsed.graphSha1,
          symbolsSha1: parsed.symbolsSha1,
          embed: parsed.embed
        };
      }
    } catch {
    }
    const scan2 = scanRepo(flags2.repo, { ...scanOptions(flags2, precomputedWalk), cache, out: outDir });
    const modelDir = resolveEmbedModelDir(flags2.repo);
    const model = modelDir ? loadEmbedModel(modelDir) : void 0;
    const graphPath = join15(outDir, "graph.json");
    const symbolsPath = join15(outDir, "symbols.json");
    const embedPath = join15(outDir, "embeddings.bin");
    const artifactSha = (path) => {
      try {
        return sha1(readFileSync8(path));
      } catch {
        return void 0;
      }
    };
    const writeCache = (out2) => {
      const files = {};
      for (const f of scan2.files) {
        const entry = { hash: f.hash, record: f, size: f.size };
        const mtime = scan2.mtimes.get(f.rel);
        if (mtime !== void 0) entry.mtimeMs = mtime;
        files[f.rel] = entry;
      }
      writeFileSync4(
        cachePath,
        JSON.stringify({
          schemaVersion: SCHEMA_VERSION,
          extractorVersion: EXTRACTOR_VERSION,
          engineVersion: ENGINE_VERSION,
          commit: scan2.commit,
          graphSha1: out2.graphSha1,
          symbolsSha1: out2.symbolsSha1,
          embed: out2.embed,
          files
        }) + "\n"
      );
    };
    const embedUnchanged = !model || meta.embed !== void 0 && meta.embed.embedVersion === EMBED_VERSION && meta.embed.modelId === model.modelId && meta.embed.sha1 !== void 0 && artifactSha(embedPath) === meta.embed.sha1;
    const fastpath = scan2.contentUnchanged && meta.engineVersion === ENGINE_VERSION && meta.commit === scan2.commit && meta.graphSha1 !== void 0 && artifactSha(graphPath) === meta.graphSha1 && meta.symbolsSha1 !== void 0 && artifactSha(symbolsPath) === meta.symbolsSha1 && embedUnchanged;
    if (fastpath) {
      if (scan2.cacheDirty) writeCache(meta);
      process.stderr.write(
        `codeindex: ${scan2.files.length} files \u2192 ${outDir}/graph.json + symbols.json${scan2.capped ? " (capped)" : ""} (unchanged \u2014 artifacts reused)
`
      );
    } else {
      const { graph, symbols } = buildArtifactsFromScan(scan2);
      const graphJson = renderGraphJson(graph);
      const symbolsJson = renderSymbolsJson(symbols);
      writeFileSync4(graphPath, graphJson);
      writeFileSync4(symbolsPath, symbolsJson);
      let embedNote = "";
      let embedMeta;
      if (model) {
        const index = buildEmbeddingIndex(scan2, model);
        const bytes = serializeEmbeddings(index);
        writeFileSync4(embedPath, bytes);
        embedMeta = { embedVersion: EMBED_VERSION, modelId: model.modelId, sha1: sha1(bytes) };
        embedNote = ` + embeddings.bin (${index.records.length} records, model ${model.modelId})`;
      }
      writeCache({ graphSha1: sha1(graphJson), symbolsSha1: sha1(symbolsJson), embed: embedMeta });
      process.stderr.write(`codeindex: ${scan2.files.length} files \u2192 ${outDir}/graph.json + symbols.json${embedNote}${scan2.capped ? " (capped)" : ""}
`);
    }
  } else if (cmd === "scan") {
    const { scan: scan2 } = buildIndexArtifacts(flags2.repo, scanOptions(flags2, precomputedWalk));
    const summary = {
      engineVersion: ENGINE_VERSION,
      commit: scan2.commit,
      fileCount: scan2.files.length,
      languages: scan2.languages,
      capped: scan2.capped
    };
    emit(JSON.stringify(summary, null, 2) + "\n", flags2.out);
  } else if (cmd === "graph") {
    const { graph } = buildIndexArtifacts(flags2.repo, scanOptions(flags2, precomputedWalk));
    emit(renderGraphJson(graph), flags2.out);
  } else if (cmd === "symbols") {
    const { symbols } = buildIndexArtifacts(flags2.repo, scanOptions(flags2, precomputedWalk));
    emit(renderSymbolsJson(symbols), flags2.out);
  } else if (cmd === "scip") {
    const scan2 = scanRepo(flags2.repo, scanOptions(flags2, precomputedWalk));
    const bytes = renderScip(scan2, { projectRoot: flags2.projectRoot });
    const out2 = flags2.out ?? resolve2("index.scip");
    if (out2 === "-") process.stdout.write(Buffer.from(bytes));
    else {
      writeFileSync4(out2, bytes);
      process.stderr.write(`codeindex: SCIP index \u2192 ${out2} (${bytes.length} bytes)
`);
    }
  } else if (cmd === "callers") {
    const scan2 = scanRepo(flags2.repo, scanOptions(flags2, precomputedWalk));
    const index = buildCallerIndex(scan2, void 0, { recall: flags2.recall });
    const obj = {};
    for (const [name2, entry] of index) obj[name2] = entry;
    emit(JSON.stringify(obj, null, 2) + "\n", flags2.out);
  } else if (cmd === "search") {
    if (!flags2.positional) throw new Error('search needs a query: cli.mjs search "<query>" --repo <dir>');
    const scan2 = scanRepo(flags2.repo, scanOptions(flags2, precomputedWalk));
    if (flags2.semantic) {
      const endpoint = resolveEmbedEndpoint();
      const lexical = () => {
        const results = searchIndex(scan2, flags2.positional, { limit: flags2.limit, fuzzy: flags2.fuzzy });
        emit(JSON.stringify(results, null, 2) + "\n", flags2.out);
      };
      if (endpoint) {
        try {
          const index = await buildEndpointIndex(scan2);
          const queryVec = await encodeQueryViaEndpoint(flags2.positional);
          const results = searchSemantic(scan2, flags2.positional, index, { queryVec, limit: flags2.limit, fuzzy: flags2.fuzzy });
          emit(JSON.stringify(results, null, 2) + "\n", flags2.out);
        } catch (e) {
          process.stderr.write(
            `codeindex: embedding endpoint ${endpoint} unavailable (${e instanceof Error ? e.message : e}) \u2014 returning lexical results
`
          );
          lexical();
        }
      } else {
        const modelDir = resolveEmbedModelDir(flags2.repo);
        const model = modelDir ? loadEmbedModel(modelDir) : void 0;
        if (!model) {
          process.stderr.write(
            "codeindex: semantic search unavailable (no embedding model or endpoint) \u2014 returning lexical results; run `codeindex embed pull` or set CODEINDEX_EMBED_ENDPOINT to enable it\n"
          );
          lexical();
        } else {
          const index = buildEmbeddingIndex(scan2, model);
          const results = searchSemantic(scan2, flags2.positional, index, { model, limit: flags2.limit, fuzzy: flags2.fuzzy });
          emit(JSON.stringify(results, null, 2) + "\n", flags2.out);
        }
      }
    } else {
      const results = searchIndex(scan2, flags2.positional, { limit: flags2.limit, fuzzy: flags2.fuzzy });
      emit(JSON.stringify(results, null, 2) + "\n", flags2.out);
    }
  } else if (cmd === "embed") {
    const sub = flags2.positional;
    const modelDir = resolveEmbedModelDir(flags2.repo);
    if (sub === "status") {
      const model = modelDir ? loadEmbedModel(modelDir) : void 0;
      const endpoint = resolveEmbedEndpoint();
      const mode = endpoint ? "endpoint" : model ? "static" : "none";
      const status = {
        embedVersion: EMBED_VERSION,
        mode,
        model: model ? { present: true, dir: modelDir, modelId: model.modelId, dim: model.dim, vocabSize: model.vocabSize } : { present: false },
        endpoint: endpoint ?? null
      };
      if (endpoint) status.endpointReachable = await probeEndpoint(endpoint);
      emit(JSON.stringify(status, null, 2) + "\n", flags2.out);
    } else if (sub === "serve") {
      const dockerArgs = ["run", "-d", "-p", "8756:8756", "ghcr.io/maxgfr/codeindex-embed:latest"];
      const oneLiner = `docker ${dockerArgs.join(" ")}`;
      if (!have("docker")) {
        process.stderr.write(
          "codeindex: docker not found on PATH. Install Docker, then run:\n  " + oneLiner + "\n"
        );
        process.exitCode = 1;
        return;
      }
      if (flags2.run) {
        process.stderr.write(`codeindex: starting embedding server \u2192 ${oneLiner}
`);
        const res = sh("docker", dockerArgs);
        if (res.stdout.trim()) process.stdout.write(res.stdout.trim() + "\n");
        if (!res.ok) {
          process.stderr.write(res.stderr || "codeindex: docker run failed\n");
          process.exitCode = 1;
          return;
        }
        process.stderr.write(
          'codeindex: server starting on http://localhost:8756 \u2014 then:\n  CODEINDEX_EMBED_ENDPOINT=http://localhost:8756 codeindex search "<query>" --repo . --semantic\n'
        );
      } else {
        process.stdout.write(oneLiner + "\n");
        process.stderr.write(
          'codeindex: run the line above to start the embedding server (or `embed serve --run`), then:\n  CODEINDEX_EMBED_ENDPOINT=http://localhost:8756 codeindex search "<query>" --repo . --semantic\n'
        );
      }
    } else if (sub === "build") {
      if (!flags2.out) throw new Error("embed build needs --out <dir>");
      if (!modelDir) {
        process.stderr.write("codeindex: no embedding model present \u2014 run `codeindex embed pull` first (nothing written)\n");
        process.exitCode = 1;
        return;
      }
      const model = loadEmbedModel(modelDir);
      mkdirSync3(flags2.out, { recursive: true });
      const scan2 = scanRepo(flags2.repo, scanOptions(flags2, precomputedWalk));
      const index = buildEmbeddingIndex(scan2, model);
      writeFileSync4(join15(flags2.out, "embeddings.bin"), serializeEmbeddings(index));
      process.stderr.write(`codeindex: ${index.records.length} embedding records \u2192 ${flags2.out}/embeddings.bin (model ${model.modelId})
`);
    } else if (sub === "pull") {
      const { url, sha256: sha2562 } = resolveEmbedPullUrl();
      const destDir = process.env.CODEINDEX_EMBED_DIR ?? join15(flags2.repo, ".codeindex", "models");
      mkdirSync3(destDir, { recursive: true });
      process.stderr.write(`codeindex: fetching model from ${url} \u2192 ${join15(destDir, "model.json")}
`);
      let body2;
      try {
        body2 = await fetchEmbedModel(url, sha2562);
      } catch (e) {
        process.stderr.write(`codeindex: pull failed \u2014 ${e instanceof Error ? e.message : String(e)} (nothing written)
`);
        process.exitCode = 1;
        return;
      }
      try {
        parseEmbedModel(JSON.parse(body2), url);
      } catch (e) {
        process.stderr.write(
          `codeindex: pull failed \u2014 response is not a valid model.json (${e instanceof Error ? e.message : String(e)}) (nothing written)
`
        );
        process.exitCode = 1;
        return;
      }
      writeFileSync4(join15(destDir, "model.json"), body2);
      process.stderr.write(`codeindex: model written to ${join15(destDir, "model.json")}
`);
    } else {
      throw new Error("embed needs a subcommand: status | build | pull | serve");
    }
  } else if (cmd === "grammars") {
    const sub = flags2.positional;
    const cacheDir = sharedGrammarsCacheDir();
    if (sub === "status") {
      const info2 = resolveGrammarsTier();
      const runtimePresent = info2.dir ? existsSync5(join15(info2.dir, "web-tree-sitter.wasm")) : false;
      const target = resolveGrammarsPullTarget();
      const status = {
        engineVersion: ENGINE_VERSION,
        tier: info2.tier,
        dir: info2.dir ?? null,
        cacheDir,
        runtimePresent,
        pullNeeded: !runtimePresent,
        url: target.url
      };
      emit(JSON.stringify(status, null, 2) + "\n", flags2.out);
    } else if (sub === "pull") {
      const res = await pullGrammars(cacheDir, { onNote: (m) => process.stderr.write(m) });
      process.stderr.write(res.message);
      if (!res.ok) process.exitCode = 1;
    } else {
      throw new Error("grammars needs a subcommand: status | pull");
    }
  } else if (cmd === "rules") {
    if (!flags2.config) throw new Error("rules needs --config <codeindex.rules.json>");
    const rules = parseRules(JSON.parse(readFileSync8(flags2.config, "utf8")));
    const { graph } = buildIndexArtifacts(flags2.repo, scanOptions(flags2, precomputedWalk));
    const violations = checkRules(graph, rules);
    const errors = violations.filter((v) => v.severity === "error").length;
    emit(JSON.stringify({ errors, warnings: violations.length - errors, violations }, null, 2) + "\n", flags2.out);
    if (errors > 0) process.exitCode = 1;
  } else if (cmd === "workspaces") {
    const info2 = detectWorkspaces(flags2.repo);
    emit(
      JSON.stringify(
        { packages: info2.packages, cycle: info2.cycle ?? null, topoOrder: info2.topoOrder },
        null,
        2
      ) + "\n",
      flags2.out
    );
  } else if (cmd === "churn") {
    const { churn, ok } = gitChurn(flags2.repo, { since: flags2.since });
    const sorted = {};
    for (const k of [...churn.keys()].sort()) sorted[k] = churn.get(k);
    emit(JSON.stringify({ ok, churn: sorted }, null, 2) + "\n", flags2.out);
  } else if (cmd === "repomap") {
    const { scan: scan2, graph } = buildIndexArtifacts(flags2.repo, scanOptions(flags2, precomputedWalk));
    emit(renderRepoMap(scan2, graph, { budgetTokens: flags2.budgetTokens }), flags2.out);
  } else if (cmd === "hotspots") {
    const scan2 = scanRepo(flags2.repo, scanOptions(flags2, precomputedWalk));
    const { churn, ok } = gitChurn(flags2.repo, { since: flags2.since });
    emit(JSON.stringify({ churnOk: ok, hotspots: rankHotspots(scan2, churn) }, null, 2) + "\n", flags2.out);
  } else if (cmd === "coupling") {
    const { ok, couplings } = changeCoupling(flags2.repo, { since: flags2.since });
    emit(JSON.stringify({ ok, couplings }, null, 2) + "\n", flags2.out);
  } else if (cmd === "deadcode") {
    emit(JSON.stringify(findDeadCode(scanRepo(flags2.repo, scanOptions(flags2, precomputedWalk))), null, 2) + "\n", flags2.out);
  } else if (cmd === "complexity") {
    const scan2 = scanRepo(flags2.repo, scanOptions(flags2, precomputedWalk));
    emit(JSON.stringify(symbolComplexity(scan2, flags2.positional), null, 2) + "\n", flags2.out);
  } else if (cmd === "risk") {
    const scan2 = scanRepo(flags2.repo, scanOptions(flags2, precomputedWalk));
    const { churn, ok } = gitChurn(flags2.repo, { since: flags2.since });
    emit(JSON.stringify({ churnOk: ok, risks: riskHotspots(scan2, churn) }, null, 2) + "\n", flags2.out);
  } else if (cmd === "mermaid") {
    const { graph } = buildIndexArtifacts(flags2.repo, scanOptions(flags2, precomputedWalk));
    emit(renderMermaid(graph, { module: flags2.positional }), flags2.out);
  } else if (cmd === "grep") {
    if (!flags2.positional) throw new Error("grep needs a pattern: cli.mjs grep <pattern> --repo <dir>");
    const scopeGlobs = flags2.scope ? [`${flags2.scope.replace(/\/+$/, "")}/**`] : [];
    const globs = [...scopeGlobs, ...flags2.include, ...flags2.exclude.map((g) => `!${g}`)];
    const hits = grepRepo(flags2.repo, flags2.positional, {
      globs: globs.length ? globs : void 0,
      ignoreCase: flags2.ignoreCase,
      maxHits: flags2.maxHits
    });
    emit(JSON.stringify(hits, null, 2) + "\n", flags2.out);
  } else {
    process.stderr.write(`unknown command: ${cmd}

${HELP}`);
    process.exitCode = 2;
  }
}

// src/walk.ts
var DEFAULT_IGNORE_DIRS = /* @__PURE__ */ new Set([
  ".git",
  "node_modules",
  ".next",
  ".nuxt",
  ".svelte-kit",
  "dist",
  "build",
  "out",
  "coverage",
  ".turbo",
  ".vercel",
  ".cache",
  "vendor",
  "target",
  "__pycache__",
  ".venv",
  "venv",
  ".idea",
  ".vscode",
  "reconstruction"
]);
var DEFAULT_IGNORE_FILES = /* @__PURE__ */ new Set([
  ".DS_Store",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "bun.lock",
  "Cargo.lock",
  "poetry.lock",
  "Gemfile.lock",
  "composer.lock",
  "pubspec.lock"
]);
var BINARY_EXTS = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".ico",
  ".bmp",
  ".tiff",
  ".pdf",
  ".zip",
  ".gz",
  ".tar",
  ".rar",
  ".7z",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".webm",
  ".wasm",
  ".so",
  ".dylib",
  ".dll",
  ".exe",
  ".bin",
  ".class",
  ".jar",
  ".pyc",
  ".node"
]);
var LOCAL_ASSET_ONLY_EXTS = /* @__PURE__ */ new Set([
  ".zip",
  ".gz",
  ".tar",
  ".rar",
  ".7z",
  ".wasm",
  ".so",
  ".dylib",
  ".dll",
  ".exe",
  ".bin",
  ".class",
  ".jar",
  ".pyc",
  ".node"
]);
function categorize2(relPath, ext) {
  const cat = categorize(relPath, ext);
  if (cat === "other" && LOCAL_ASSET_ONLY_EXTS.has(ext)) return "asset";
  if (cat === "asset" && ext === ".svg") return "other";
  return cat;
}
function compileScopeGlobs(patterns) {
  if (!patterns || patterns.length === 0) return [];
  return parseGitignore(patterns.join("\n"), "").filter((r) => !r.negated);
}
function matchesScope(rules, rel) {
  if (isIgnored(rules, rel, false)) return true;
  let dir = rel;
  for (let i2 = dir.lastIndexOf("/"); i2 !== -1; i2 = dir.lastIndexOf("/")) {
    dir = dir.slice(0, i2);
    if (isIgnored(rules, dir, true)) return true;
  }
  return false;
}
function isReconstructOutput(dir) {
  try {
    const head = readFileSync9(join16(dir, "inventory.json"), "utf8").slice(0, 4096);
    return /"generatedWith"\s*:\s*"reconstruct@/.test(head);
  } catch {
    return false;
  }
}
var SNIFF_BYTES = 8192;
function isProbablyBinary(abs, ext) {
  if (BINARY_EXTS.has(ext)) return true;
  let fd = -1;
  try {
    fd = openSync(abs, "r");
    const buf = Buffer.allocUnsafe(SNIFF_BYTES);
    const read2 = readSync(fd, buf, 0, SNIFF_BYTES, 0);
    for (let i2 = 0; i2 < read2; i2++) {
      if (buf[i2] === 0) return true;
    }
    return false;
  } catch {
    return true;
  } finally {
    if (fd >= 0) {
      try {
        closeSync(fd);
      } catch {
      }
    }
  }
}
var MAX_COUNT_LINES_BYTES = 8 * 1024 * 1024;
function countLines2(abs, size) {
  if (size > MAX_COUNT_LINES_BYTES) return 0;
  try {
    const content = readFileSync9(abs, "utf8");
    if (content.length === 0) return 0;
    let n = 1;
    for (let i2 = 0; i2 < content.length; i2++) {
      if (content.charCodeAt(i2) === 10) n++;
    }
    return n;
  } catch {
    return 0;
  }
}
function walk2(repo, opts = {}) {
  const includeRules = compileScopeGlobs(opts.include);
  const excludeRules = compileScopeGlobs(opts.exclude);
  const outAbs = opts.out ? resolve3(opts.out) : "";
  const files = [];
  let excludedCount = 0;
  const recurse = (dir, relDir, inherited) => {
    let entries;
    try {
      entries = readdirSync4(dir, { withFileTypes: true });
    } catch {
      return;
    }
    let ignoreRules = inherited;
    if (entries.some((e) => e.name === ".gitignore")) {
      const parsed = parseGitignore(readText(join16(dir, ".gitignore")), relDir);
      if (parsed.length) ignoreRules = [...ignoreRules, ...parsed];
    }
    for (const entry of entries) {
      const abs = join16(dir, entry.name);
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      const isDir = entry.isDirectory();
      let isFile = entry.isFile();
      if (entry.isSymbolicLink()) {
        let targetIsFile = false;
        try {
          targetIsFile = statSync5(abs).isFile();
        } catch {
        }
        if (!targetIsFile) {
          excludedCount++;
          continue;
        }
        isFile = true;
      }
      if (isDir && outAbs && resolve3(abs) === outAbs) continue;
      if (isDir && isReconstructOutput(abs)) continue;
      if (isDir && DEFAULT_IGNORE_DIRS.has(entry.name)) continue;
      if (ignoreRules.length && isIgnored(ignoreRules, rel, isDir)) {
        if (!isDir) excludedCount++;
        continue;
      }
      if (isDir) {
        if (isIgnored(excludeRules, rel, true)) continue;
        recurse(abs, rel, ignoreRules);
        continue;
      }
      if (!isFile) continue;
      if (DEFAULT_IGNORE_FILES.has(entry.name)) {
        excludedCount++;
        continue;
      }
      if (isIgnored(excludeRules, rel, false)) {
        excludedCount++;
        continue;
      }
      if (includeRules.length > 0 && !matchesScope(includeRules, rel)) {
        excludedCount++;
        continue;
      }
      const ext = extname2(entry.name).toLowerCase();
      let size = 0;
      try {
        size = statSync5(abs).size;
      } catch {
        continue;
      }
      const binary2 = isProbablyBinary(abs, ext);
      files.push({
        path: rel,
        ext,
        size,
        lines: binary2 ? 0 : countLines2(abs, size),
        category: categorize2(rel, ext),
        binary: binary2
      });
    }
  };
  recurse(repo, "", []);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, excludedCount };
}

// src/detect/stack.ts
import { existsSync as existsSync7 } from "fs";
import { join as join19 } from "path";

// src/detect/manifest.ts
import { readFileSync as readFileSync10 } from "fs";
function readJsonManifest(absPath, relLabel, warnings) {
  let raw;
  try {
    raw = readFileSync10(absPath, "utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    const reason = String(e.message ?? e).split("\n")[0];
    warnings?.push(`malformed ${relLabel}: ${reason} \u2014 falling back to empty defaults`);
    return null;
  }
}
function safeRead(path) {
  try {
    return readFileSync10(path, "utf8");
  } catch {
    return "";
  }
}

// src/detect/workspaces.ts
import { existsSync as existsSync6 } from "fs";
import { join as join18 } from "path";

// src/adapters/generic.ts
import { readFileSync as readFileSync11 } from "fs";
import { join as join17 } from "path";
function read(repo, rel) {
  try {
    return readFileSync11(join17(repo, rel), "utf8");
  } catch {
    return null;
  }
}
function asStringMap(value) {
  if (!value || typeof value !== "object") return {};
  const out2 = {};
  for (const [k, v] of Object.entries(value)) {
    out2[k] = typeof v === "string" ? v : "";
  }
  return out2;
}
function extractDependencies(repo, files, warnings, labelBase = "") {
  const result = [];
  const present = new Set(files.map((f) => f.path));
  if (present.has("package.json")) {
    const pkg = readJsonManifest(join17(repo, "package.json"), labelBase + "package.json", warnings);
    if (pkg) {
      result.push({
        manager: "npm",
        manifest: "package.json",
        runtime: asStringMap(pkg.dependencies),
        dev: asStringMap(pkg.devDependencies)
      });
    }
  }
  if (present.has("requirements.txt")) {
    const raw = read(repo, "requirements.txt") ?? "";
    const runtime = {};
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const m = t.match(/^([A-Za-z0-9_.-]+)\s*([<>=!~]+.*)?$/);
      if (m) runtime[m[1]] = (m[2] ?? "").trim();
    }
    result.push({ manager: "pip", manifest: "requirements.txt", runtime, dev: {} });
  }
  if (present.has("pubspec.yaml")) {
    const raw = read(repo, "pubspec.yaml") ?? "";
    result.push({
      manager: "pub",
      manifest: "pubspec.yaml",
      runtime: parseYamlDeps(raw, "dependencies"),
      dev: parseYamlDeps(raw, "dev_dependencies")
    });
  }
  if (present.has("Cargo.toml")) {
    const raw = read(repo, "Cargo.toml") ?? "";
    result.push({
      manager: "cargo",
      manifest: "Cargo.toml",
      runtime: parseTomlSection(raw, "dependencies"),
      dev: parseTomlSection(raw, "dev-dependencies")
    });
  }
  if (present.has("go.mod")) {
    const raw = read(repo, "go.mod") ?? "";
    const runtime = {};
    const block = raw.match(/require\s*\(([\s\S]*?)\)/);
    const lines = block ? block[1].split(/\r?\n/) : raw.split(/\r?\n/);
    for (const line of lines) {
      const m = line.trim().match(/^([^\s]+)\s+(v[^\s]+)/);
      if (m) runtime[m[1]] = m[2];
    }
    result.push({ manager: "go modules", manifest: "go.mod", runtime, dev: {} });
  }
  if (present.has("composer.json")) {
    const composer = readJsonManifest(join17(repo, "composer.json"), labelBase + "composer.json", warnings);
    if (composer) {
      result.push({
        manager: "composer",
        manifest: "composer.json",
        runtime: asStringMap(composer.require),
        dev: asStringMap(composer["require-dev"])
      });
    }
  }
  if (present.has("Gemfile")) {
    const raw = read(repo, "Gemfile") ?? "";
    const runtime = {};
    const dev = {};
    let inDev = false;
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      const g = t.match(/^group\s+(.+?)\s+do\b/);
      if (g) {
        inDev = /:(?:development|test)\b/.test(g[1]);
        continue;
      }
      if (/^end\b/.test(t)) {
        inDev = false;
        continue;
      }
      const m = t.match(/^gem\s+["']([^"']+)["']\s*(?:,\s*["']([^"']+)["'])?/);
      if (m) (inDev ? dev : runtime)[m[1]] = (m[2] ?? "").trim();
    }
    result.push({ manager: "bundler", manifest: "Gemfile", runtime, dev });
  }
  if (present.has("pom.xml")) {
    const raw = read(repo, "pom.xml") ?? "";
    const runtime = {};
    const dev = {};
    const field = (block, tag) => block.match(new RegExp(`<${tag}>\\s*([^<]+?)\\s*</${tag}>`))?.[1];
    for (const m of raw.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
      const block = m[1];
      const gid = field(block, "groupId");
      const aid = field(block, "artifactId");
      if (!gid || !aid) continue;
      const scope = field(block, "scope") ?? "";
      const target = scope === "test" || scope === "provided" ? dev : runtime;
      target[`${gid}:${aid}`] = field(block, "version") ?? "";
    }
    result.push({ manager: "maven", manifest: "pom.xml", runtime, dev });
  }
  const GRADLE_CONFIG = /^(?:test|android|functional)?(?:implementation|api|compileOnly|runtimeOnly|annotationProcessor|kapt|ksp|developmentOnly|providedRuntime|classpath)$/i;
  for (const manifest of ["build.gradle", "build.gradle.kts"]) {
    if (!present.has(manifest)) continue;
    const raw = read(repo, manifest) ?? "";
    const runtime = {};
    const dev = {};
    for (const m of raw.matchAll(/(\w+)\s*[(\s]\s*["']([^"'\s]+:[^"'\s]+)["']/g)) {
      const config = m[1];
      const coord = m[2];
      if (!GRADLE_CONFIG.test(config) || coord.includes("/")) continue;
      const parts2 = coord.split(":");
      const key = parts2.length >= 2 ? `${parts2[0]}:${parts2[1]}` : coord;
      const ver = parts2.length >= 3 ? parts2[2] : "";
      const isDev = /^(?:test|android|functional)/i.test(config);
      (isDev ? dev : runtime)[key] = ver;
    }
    result.push({ manager: "gradle", manifest, runtime, dev });
    break;
  }
  return result;
}
function parseYamlDeps(yaml, section) {
  const out2 = {};
  const lines = yaml.split(/\r?\n/);
  let inSection = false;
  for (const line of lines) {
    if (/^\S/.test(line)) {
      inSection = new RegExp(`^${section}\\s*:`).test(line);
      continue;
    }
    if (!inSection) continue;
    const m = line.match(/^\s{2}([\w.-]+)\s*:\s*(["']?[\d.^<>=~\s+*]*["']?)\s*(?:#.*)?$/);
    if (m) out2[m[1]] = m[2].replace(/["']/g, "").trim();
  }
  return out2;
}
function parseTomlSection(toml, section) {
  const out2 = {};
  const re = new RegExp(`\\[${section}\\]([\\s\\S]*?)(\\n\\[|$)`);
  const m = toml.match(re);
  if (!m) return out2;
  for (const line of m[1].split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const kv = t.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (kv) out2[kv[1]] = kv[2].replace(/["']/g, "").trim();
  }
  return out2;
}
function extractScripts(repo, warnings) {
  const pkg = readJsonManifest(join17(repo, "package.json"), "package.json", warnings);
  return pkg ? asStringMap(pkg.scripts) : {};
}
function extractEnvVars(repo, files) {
  const names = /* @__PURE__ */ new Set();
  for (const f of files) {
    if (!f.path.split("/").pop()?.startsWith(".env")) continue;
    const raw = read(repo, f.path) ?? "";
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/);
      if (m) names.add(m[1]);
    }
  }
  const patterns = [
    /process\.env\.([A-Z][A-Z0-9_]*)/g,
    /import\.meta\.env\.([A-Z][A-Z0-9_]*)/g,
    // Python: os.environ["X"], os.environ.get("X"), os.getenv("X").
    /os\.(?:environ(?:\.get)?|getenv)\s*[[(]\s*["']([A-Z][A-Z0-9_]*)["']/g
  ];
  for (const f of files) {
    if (f.binary || f.category !== "code" && f.category !== "config") continue;
    const raw = read(repo, f.path);
    if (!raw) continue;
    for (const re of patterns) {
      for (const m of raw.matchAll(re)) names.add(m[1]);
    }
  }
  return [...names].sort();
}
function collectByCategory(files, category) {
  return files.filter((f) => f.category === category).map((f) => f.path);
}

// src/detect/workspaces.ts
function readCargoName(dir) {
  const toml = safeRead(join18(dir, "Cargo.toml"));
  if (!toml) return null;
  const pkg = tomlSectionBody2(toml, "package");
  const m = pkg?.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
  return m ? m[1] : "";
}
function readGoModule(dir) {
  const gomod = safeRead(join18(dir, "go.mod"));
  if (!gomod) return null;
  const m = gomod.match(/^module\s+(\S+)/m);
  return m ? m[1] : "";
}
function readUvName(dir) {
  const toml = safeRead(join18(dir, "pyproject.toml"));
  if (!toml) return null;
  const nameIn = (body2) => body2?.match(/^\s*name\s*=\s*["']([^"']+)["']/m)?.[1];
  return nameIn(tomlSectionBody2(toml, "project")) ?? nameIn(tomlSectionBody2(toml, "tool.poetry")) ?? "";
}
function hasGradleManifest(dir) {
  return existsSync6(join18(dir, "build.gradle")) || existsSync6(join18(dir, "build.gradle.kts"));
}
function tomlSectionBody2(toml, section) {
  const re = new RegExp(`^\\[${section}\\]\\s*$([\\s\\S]*?)(?=^\\[|$(?![\\s\\S]))`, "m");
  const m = toml.match(re);
  return m ? m[1] : null;
}
function adaptPackage(repo, pkg, warnings) {
  const path = pkg.dir;
  let name2;
  if (pkg.kind === "cargo") {
    name2 = readCargoName(join18(repo, path));
  } else if (pkg.kind === "go") {
    name2 = readGoModule(join18(repo, path));
  } else if (pkg.kind === "uv") {
    name2 = readUvName(join18(repo, path));
  } else if (pkg.kind === "gradle") {
    name2 = hasGradleManifest(join18(repo, path)) ? "" : null;
  } else if (pkg.kind === "composer") {
    if (!existsSync6(join18(repo, path, "composer.json"))) {
      name2 = null;
    } else {
      const manifest = readJsonManifest(join18(repo, path, "composer.json"), `${path}/composer.json`, warnings);
      name2 = manifest && typeof manifest.name === "string" && manifest.name ? manifest.name : "";
    }
  } else if (pkg.kind === "maven") {
    name2 = pkg.name;
  } else if (pkg.kind === "nx" && !existsSync6(join18(repo, path, "package.json"))) {
    const proj = readJsonManifest(join18(repo, path, "project.json"), `${path}/project.json`, warnings);
    name2 = proj && typeof proj.name === "string" && proj.name ? proj.name : "";
  } else if (existsSync6(join18(repo, path, "package.json"))) {
    const manifest = readJsonManifest(join18(repo, path, "package.json"), `${path}/package.json`, warnings);
    name2 = manifest && typeof manifest.name === "string" && manifest.name ? manifest.name : "";
  } else {
    name2 = null;
  }
  if (name2 === null) return null;
  return { name: name2 || path, path, kind: pkg.kind };
}
function detectWorkspaces2(repo, warnings) {
  const found = /* @__PURE__ */ new Map();
  for (const pkg of detectWorkspaces(repo).packages) {
    const ws = adaptPackage(repo, pkg, warnings);
    if (ws) found.set(ws.path, ws);
  }
  return [...found.values()].sort((a, b) => a.path.localeCompare(b.path));
}
function buildWorkspaceGraph(repo, workspaces, _warnings) {
  if (workspaces.length === 0) return;
  const engineByDir = new Map(detectWorkspaces(repo).packages.map((p) => [p.dir, p]));
  const localNames = new Set(workspaces.map((w) => w.name));
  const remap = /* @__PURE__ */ new Map();
  for (const ws of workspaces) {
    const pkg = engineByDir.get(ws.path);
    if (!pkg) continue;
    remap.set(pkg.name, remap.has(pkg.name) && remap.get(pkg.name) !== ws.name ? null : ws.name);
  }
  for (const ws of workspaces) {
    const pkg = engineByDir.get(ws.path);
    if (!pkg?.dependsOn?.length) continue;
    const edges = /* @__PURE__ */ new Set();
    for (const dep of pkg.dependsOn) {
      const target = remap.get(dep);
      if (target && target !== ws.name && localNames.has(target)) edges.add(target);
    }
    if (edges.size) ws.dependsOn = [...edges].sort();
  }
}
function findWorkspaceCycle(workspaces) {
  const deps = new Map(workspaces.map((w) => [w.name, [...w.dependsOn ?? []].sort()]));
  const state = /* @__PURE__ */ new Map();
  const stack = [];
  const visit = (name2) => {
    state.set(name2, "visiting");
    stack.push(name2);
    for (const dep of deps.get(name2) ?? []) {
      if (!deps.has(dep)) continue;
      if (state.get(dep) === "visiting") return [...stack.slice(stack.indexOf(dep)), dep];
      if (!state.has(dep)) {
        const found = visit(dep);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(name2, "done");
    return null;
  };
  for (const name2 of [...deps.keys()].sort()) {
    if (!state.has(name2)) {
      const found = visit(name2);
      if (found) return found;
    }
  }
  return null;
}
function workspaceMatcher(workspaces) {
  const byDepth = [...workspaces].sort((a, b) => b.path.length - a.path.length);
  return (path) => byDepth.find((ws) => path.startsWith(ws.path + "/"));
}
function enrichWorkspaceStacks(repo, workspaces, files, warnings) {
  const matcher = workspaceMatcher(workspaces);
  const filesByWs = /* @__PURE__ */ new Map();
  for (const f of files) {
    const ws = matcher(f.path);
    if (!ws) continue;
    const list = filesByWs.get(ws.path);
    if (list) list.push(f);
    else filesByWs.set(ws.path, [f]);
  }
  for (const ws of workspaces) {
    const wsFiles = filesByWs.get(ws.path) ?? [];
    const prefix = ws.path + "/";
    const rebased = wsFiles.map((f) => ({ ...f, path: f.path.slice(prefix.length) }));
    ws.fileCount = wsFiles.length;
    ws.stack = detectStack(join18(repo, ws.path), rebased, warnings, prefix);
    const deps = extractDependencies(join18(repo, ws.path), rebased, warnings, prefix);
    if (deps.length) {
      ws.dependencies = deps.map((d) => ({ ...d, manifest: prefix + d.manifest }));
    }
  }
}
function mergeWorkspaceStacks(stack, workspaces) {
  const frameworks = new Set(stack.frameworks);
  const libraries = new Set(stack.libraries);
  const packageManagers = new Set(stack.packageManagers);
  for (const ws of workspaces) {
    for (const f of ws.stack?.frameworks ?? []) frameworks.add(f);
    for (const l of ws.stack?.libraries ?? []) libraries.add(l);
    for (const p of ws.stack?.packageManagers ?? []) packageManagers.add(p);
  }
  return {
    ...stack,
    frameworks: [...frameworks],
    libraries: [...libraries],
    packageManagers: [...packageManagers]
  };
}
function enrichWorkspaceSurface(workspaces, routes, hints, schemas) {
  const matcher = workspaceMatcher(workspaces);
  const routeCounts = /* @__PURE__ */ new Map();
  for (const r of routes) {
    const ws = matcher(r.file);
    if (!ws) continue;
    r.workspace = ws.name;
    routeCounts.set(ws.path, (routeCounts.get(ws.path) ?? 0) + 1);
  }
  for (const ws of workspaces) {
    const prefix = ws.path + "/";
    const routeCount = routeCounts.get(ws.path) ?? 0;
    if (routeCount) ws.routeCount = routeCount;
    const wsSchemas = schemas.filter((s) => s.startsWith(prefix));
    if (wsSchemas.length) ws.schemas = wsSchemas;
    const wsHints = {
      routeCandidates: hints.routeCandidates.filter((p) => p.startsWith(prefix)),
      apiCandidates: hints.apiCandidates.filter((p) => p.startsWith(prefix)),
      schemaCandidates: hints.schemaCandidates.filter((p) => p.startsWith(prefix)),
      realtimeCandidates: hints.realtimeCandidates.filter((p) => p.startsWith(prefix)),
      authCandidates: hints.authCandidates.filter((p) => p.startsWith(prefix)),
      designSystemCandidates: hints.designSystemCandidates.filter((p) => p.startsWith(prefix)),
      entryPoints: hints.entryPoints.filter((p) => p.startsWith(prefix))
    };
    if (Object.values(wsHints).some((list) => list.length > 0)) ws.hints = wsHints;
  }
}
function topoOrderWorkspaces(workspaces) {
  const remaining = new Map(workspaces.map((w) => [w.name, new Set(w.dependsOn ?? [])]));
  const order = [];
  while (remaining.size > 0) {
    const ready = [...remaining.entries()].filter(([, deps]) => [...deps].every((d) => !remaining.has(d))).map(([name2]) => name2);
    if (ready.length === 0) {
      const leftover = workspaces.filter((w) => remaining.has(w.name)).map((w) => w.name);
      order.push(...leftover);
      break;
    }
    for (const name2 of ready.sort()) {
      order.push(name2);
      remaining.delete(name2);
    }
  }
  return order;
}

// src/detect/stack.ts
var LANG_LABEL = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  vue: "Vue",
  svelte: "Svelte",
  python: "Python",
  ruby: "Ruby",
  go: "Go",
  rust: "Rust",
  java: "Java",
  kotlin: "Kotlin",
  php: "PHP",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  swift: "Swift",
  scala: "Scala",
  dart: "Dart",
  elixir: "Elixir",
  lua: "Lua"
};
var LOCAL_EXT_LANGUAGE = {
  ".astro": "Astro"
};
function languageLabelOf(ext) {
  return LOCAL_EXT_LANGUAGE[ext] ?? LANG_LABEL[extToLang(ext)];
}
var NPM_FRAMEWORKS = [
  ["next", "Next.js"],
  ["nuxt", "Nuxt"],
  ["@remix-run/react", "Remix"],
  ["react-router-dom", "React Router"],
  ["@sveltejs/kit", "SvelteKit"],
  ["astro", "Astro"],
  ["@angular/core", "Angular"],
  ["@nestjs/core", "NestJS"],
  ["express", "Express"],
  ["fastify", "Fastify"],
  ["koa", "Koa"],
  ["@hono/node-server", "Hono"],
  ["hono", "Hono"],
  ["@solidjs/start", "SolidStart"],
  ["solid-start", "SolidStart"],
  ["react", "React"],
  ["vue", "Vue"],
  ["svelte", "Svelte"],
  ["solid-js", "SolidJS"],
  // Build tooling / runtimes / shells
  ["vite", "Vite"],
  ["expo", "Expo"],
  ["react-native", "React Native"],
  ["electron", "Electron"],
  ["@tauri-apps/api", "Tauri"],
  ["@tauri-apps/cli", "Tauri"]
];
var UI_FRAMEWORK_LABELS = /* @__PURE__ */ new Set([
  "Next.js",
  "Nuxt",
  "Remix",
  "React Router",
  "SvelteKit",
  "Astro",
  "Angular",
  "SolidStart",
  "React",
  "Vue",
  "Svelte",
  "SolidJS",
  "Expo",
  "React Native",
  "Electron",
  "Tauri",
  "Flutter"
]);
var NPM_STYLING_LIBRARIES = [
  ["tailwindcss", "Tailwind CSS"],
  ["styled-components", "styled-components"],
  ["@emotion/react", "Emotion"],
  ["@mui/material", "MUI"],
  ["@chakra-ui/react", "Chakra UI"],
  ["@radix-ui/", "Radix UI"],
  ["@mantine/core", "Mantine"],
  ["bootstrap", "Bootstrap"],
  ["unocss", "UnoCSS"],
  ["@unocss/", "UnoCSS"],
  ["@pandacss/dev", "Panda CSS"],
  ["@vanilla-extract/css", "vanilla-extract"]
];
var STYLING_LIBRARY_LABELS = new Set(NPM_STYLING_LIBRARIES.map(([, label]) => label));
var NPM_LIBRARIES = [
  // ORM / database
  ["drizzle-orm", "Drizzle ORM"],
  ["@prisma/client", "Prisma"],
  ["prisma", "Prisma"],
  ["typeorm", "TypeORM"],
  ["sequelize", "Sequelize"],
  ["mongoose", "Mongoose"],
  ["kysely", "Kysely"],
  ["@supabase/supabase-js", "Supabase"],
  // Auth
  ["next-auth", "NextAuth.js"],
  ["@auth/core", "Auth.js"],
  ["@clerk/nextjs", "Clerk"],
  ["lucia", "Lucia"],
  ["passport", "Passport"],
  // API / data fetching layer
  ["@trpc/", "tRPC"],
  ["@tanstack/react-query", "TanStack Query"],
  ["react-query", "TanStack Query"],
  ["@apollo/client", "Apollo GraphQL"],
  ["graphql", "GraphQL"],
  ["swr", "SWR"],
  // Styling / UI (the design-system signal — see NPM_STYLING_LIBRARIES above)
  ...NPM_STYLING_LIBRARIES,
  // State management
  ["@reduxjs/toolkit", "Redux Toolkit"],
  ["redux", "Redux"],
  ["zustand", "Zustand"],
  ["jotai", "Jotai"],
  ["recoil", "Recoil"],
  ["mobx", "MobX"],
  // Validation / forms
  ["zod", "Zod"],
  ["yup", "Yup"],
  ["valibot", "Valibot"],
  ["react-hook-form", "React Hook Form"],
  ["formik", "Formik"],
  // Testing
  ["vitest", "Vitest"],
  ["jest", "Jest"],
  ["@playwright/test", "Playwright"],
  ["playwright", "Playwright"],
  ["cypress", "Cypress"],
  ["@testing-library/react", "Testing Library"],
  // i18n
  ["next-intl", "next-intl"],
  ["i18next", "i18next"],
  ["react-i18next", "react-i18next"],
  // Services / analytics / email
  ["posthog-js", "PostHog"],
  ["@sentry/", "Sentry"],
  ["resend", "Resend"],
  ["nodemailer", "Nodemailer"],
  ["stripe", "Stripe"],
  ["@aws-sdk/", "AWS SDK"]
];
var GO_FRAMEWORKS = [
  [/github\.com\/gin-gonic\/gin/, "Gin"],
  [/github\.com\/labstack\/echo/, "Echo"],
  [/github\.com\/gofiber\/fiber/, "Fiber"],
  [/github\.com\/go-chi\/chi/, "chi"],
  [/github\.com\/gorilla\/mux/, "Gorilla"]
];
function detectLibraries(deps) {
  const names = Object.keys(deps);
  const found = /* @__PURE__ */ new Set();
  for (const [pattern, label] of NPM_LIBRARIES) {
    const hit = pattern.endsWith("/") ? names.some((n) => n.startsWith(pattern)) : pattern in deps;
    if (hit) found.add(label);
  }
  return [...found];
}
function detectStack(repo, files, warnings, labelBase = "") {
  const counts = /* @__PURE__ */ new Map();
  for (const f of files) {
    const lang = languageLabelOf(f.ext);
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  const languages = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([lang]) => lang);
  const frameworks = /* @__PURE__ */ new Set();
  const packageManagers = /* @__PURE__ */ new Set();
  let libraries = [];
  let hasTypeScript = files.some((f) => languageLabelOf(f.ext) === "TypeScript");
  const hasPkg = existsSync7(join19(repo, "package.json"));
  const pkg = readJsonManifest(join19(repo, "package.json"), labelBase + "package.json", warnings);
  if (pkg) {
    const allDeps = {
      ...pkg.dependencies ?? {},
      ...pkg.devDependencies ?? {}
    };
    for (const [dep, label] of NPM_FRAMEWORKS) {
      if (dep in allDeps) frameworks.add(label);
    }
    libraries = detectLibraries(allDeps);
    if ("typescript" in allDeps) hasTypeScript = true;
  }
  const hasJsManifest = hasPkg || ["pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock", "package-lock.json"].some((f) => existsSync7(join19(repo, f)));
  if (hasJsManifest) {
    if (existsSync7(join19(repo, "pnpm-lock.yaml"))) packageManagers.add("pnpm");
    else if (existsSync7(join19(repo, "yarn.lock"))) packageManagers.add("yarn");
    else if (existsSync7(join19(repo, "bun.lockb")) || existsSync7(join19(repo, "bun.lock"))) packageManagers.add("bun");
    else packageManagers.add("npm");
  }
  if (existsSync7(join19(repo, "requirements.txt")) || existsSync7(join19(repo, "pyproject.toml"))) {
    packageManagers.add("pip");
    const py = safeRead(join19(repo, "requirements.txt")) + safeRead(join19(repo, "pyproject.toml"));
    if (/\bdjango\b/i.test(py)) frameworks.add("Django");
    if (/\bflask\b/i.test(py)) frameworks.add("Flask");
    if (/\bfastapi\b/i.test(py)) frameworks.add("FastAPI");
  }
  if (existsSync7(join19(repo, "pubspec.yaml"))) {
    packageManagers.add("pub");
    const pubspec = safeRead(join19(repo, "pubspec.yaml"));
    if (/^\s*flutter\s*:/m.test(pubspec) || /sdk:\s*flutter/.test(pubspec)) {
      frameworks.add("Flutter");
    }
  }
  if (existsSync7(join19(repo, "Cargo.toml"))) packageManagers.add("cargo");
  if (existsSync7(join19(repo, "go.mod"))) {
    packageManagers.add("go modules");
    const gomod = safeRead(join19(repo, "go.mod"));
    for (const [pattern, label] of GO_FRAMEWORKS) {
      if (pattern.test(gomod)) frameworks.add(label);
    }
  }
  if (existsSync7(join19(repo, "Gemfile"))) {
    packageManagers.add("bundler");
    if (/\brails\b/i.test(safeRead(join19(repo, "Gemfile")))) frameworks.add("Ruby on Rails");
    if (/\bsinatra\b/i.test(safeRead(join19(repo, "Gemfile")))) frameworks.add("Sinatra");
  }
  if (existsSync7(join19(repo, "composer.json"))) {
    packageManagers.add("composer");
    const composer = safeRead(join19(repo, "composer.json"));
    if (/laravel\/framework/.test(composer)) frameworks.add("Laravel");
    if (/symfony\/framework-bundle/.test(composer)) frameworks.add("Symfony");
  }
  if (existsSync7(join19(repo, "pom.xml"))) {
    packageManagers.add("maven");
    if (/spring-boot/.test(safeRead(join19(repo, "pom.xml")))) frameworks.add("Spring Boot");
  }
  for (const gradle of ["build.gradle", "build.gradle.kts"]) {
    if (existsSync7(join19(repo, gradle))) {
      packageManagers.add("gradle");
      if (/spring-boot/.test(safeRead(join19(repo, gradle)))) frameworks.add("Spring Boot");
    }
  }
  const csproj = files.find((f) => f.path.endsWith(".csproj"));
  if (csproj) {
    packageManagers.add("nuget");
    const proj = safeRead(join19(repo, csproj.path));
    const program = files.find((f) => f.path.endsWith("Program.cs"));
    if (/Microsoft\.NET\.Sdk\.Web/.test(proj) || program && /WebApplication\s*\.\s*CreateBuilder/.test(safeRead(join19(repo, program.path)))) {
      frameworks.add("ASP.NET Core");
    }
  }
  return {
    languages,
    primaryLanguage: languages[0] ?? "Unknown",
    frameworks: [...frameworks],
    libraries,
    packageManagers: [...packageManagers],
    hasTypeScript
  };
}
function detectNodeVersion(repo, warnings) {
  const pkg = readJsonManifest(join19(repo, "package.json"), "package.json", warnings);
  const engines = pkg?.engines;
  if (engines && typeof engines === "object") {
    const node = engines.node;
    if (typeof node === "string") return node;
  }
  return void 0;
}

// src/detect/candidates.ts
import { readFileSync as readFileSync12 } from "fs";
import { join as join20 } from "path";
var CONTENT_SCAN_EXTS = /* @__PURE__ */ new Set([
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
  ".proto"
]);
var ROUTE_DIRS = ["routes", "controllers", "handlers", "endpoints", "views", "pages", "api"];
var API_DIRS = ["trpc", "resolvers", "graphql"];
var SCHEMA_DIRS2 = ["models", "entities", "migrations"];
var ROUTE_FILE_RE = /^(page|route|layout|template|default|\+page|\+server|\+layout)\.[jt]sx?$/;
var ROUTE_FILE_NAMES = /* @__PURE__ */ new Set(["routes.rb"]);
var ROUTE_CONTENT_RE = new RegExp(
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
    String.raw`web::(?:resource|scope|get|post|put|delete|patch)\s*\(`
  ].join("|"),
  "i"
);
var API_CONTENT_RE = /createTRPCRouter|initTRPC|publicProcedure|protectedProcedure|t\.router\(|\btype\s+Query\b|\btype\s+Mutation\b|buildSchema\(|new\s+GraphQLSchema|makeExecutableSchema|@Resolver\b|gql`|grpc\.|registerService/;
var REALTIME_CONTENT_RE = new RegExp(
  [
    String.raw`@WebSocketGateway|@SubscribeMessage`,
    // NestJS gateways
    String.raw`new\s+WebSocketServer|new\s+WebSocket\.Server`,
    // ws
    String.raw`socket\.io|\bio\.on\(\s*["']connection`,
    String.raw`\bwebsocket\s*:\s*true`,
    // fastify route option
    String.raw`upgradeWebSocket`,
    // hono
    String.raw`@\w+\.websocket\b|websockets\.serve|WebsocketConsumer`,
    // FastAPI / websockets / Django Channels
    String.raw`ActionCable|ApplicationCable`,
    // rails
    String.raw`text/event-stream`
    // SSE
  ].join("|")
);
var AUTH_CONTENT_RE = new RegExp(
  [
    String.raw`@UseGuards|\bpassport\.`,
    // NestJS / Express
    String.raw`app\.use\(\s*\w*[aA]uth`,
    // app.use(auth...), app.use(requireAuth...)
    String.raw`\brequireAuth\b|\bwithAuth\b|\bverifyToken\b|\bjwt\.(?:sign|verify)\b`,
    String.raw`getServerSession|getToken\(`,
    // next-auth
    String.raw`\bpreHandler\b`,
    // fastify hook (often auth)
    String.raw`@login_required|@permission_required|@permission_classes|permission_classes\s*=`,
    // Django/Flask
    String.raw`\bbefore_request\b`,
    // flask middleware
    String.raw`HTTPBearer|OAuth2PasswordBearer`,
    // FastAPI security
    String.raw`before_action\s+:authenticate|authenticate_user!`,
    // rails
    String.raw`\[Authorize|@PreAuthorize|@Secured\b`
    // ASP.NET / Spring
  ].join("|")
);
var SCHEMA_CONTENT_RE = /pgTable\(|mysqlTable\(|sqliteTable\(|@Entity\(|@PrimaryGeneratedColumn|new\s+Schema\(|mongoose\.model\(|sequelize\.define\(|extends\s+Model\b|models\.Model\b|create_table\b|add_column\b|CREATE\s+TABLE\b|^[ \t]*model[ \t]+\w+[ \t]*\{/im;
var DS_FILE_NAMES = /* @__PURE__ */ new Set([
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
  "components.json"
  // shadcn/ui
]);
var DS_STYLE_EXTS = /* @__PURE__ */ new Set([".css", ".scss", ".sass", ".less", ".styl", ".pcss"]);
var DS_CSS_RE = /--[\w-]+\s*:|@theme\b|@layer\s+base\b|:root\s*\{/;
var MAX_CONTENT_SCAN_BYTES = 2e6;
function segmentsOf(path) {
  return path.toLowerCase().split("/");
}
function inDir(path, names) {
  const segs = segmentsOf(path);
  return names.some((n) => segs.includes(n));
}
function baseName(path) {
  return path.split("/").pop() ?? "";
}
function safeRead2(repo, rel) {
  try {
    return readFileSync12(join20(repo, rel), "utf8");
  } catch {
    return "";
  }
}
function detectCandidates(repo, files, stack) {
  void stack;
  const routeCandidates = /* @__PURE__ */ new Set();
  const apiCandidates = /* @__PURE__ */ new Set();
  const schemaCandidates = /* @__PURE__ */ new Set();
  const realtimeCandidates = /* @__PURE__ */ new Set();
  const authCandidates = /* @__PURE__ */ new Set();
  const designSystemCandidates = /* @__PURE__ */ new Set();
  for (const f of files) {
    if (f.binary || f.size === 0) continue;
    const p = f.path;
    const lower = p.toLowerCase();
    const base = baseName(lower);
    const ext = f.ext;
    if (inDir(lower, ROUTE_DIRS) || ROUTE_FILE_RE.test(base) || ROUTE_FILE_NAMES.has(base)) {
      routeCandidates.add(p);
    }
    if (ext === ".graphql" || ext === ".gql" || ext === ".proto") apiCandidates.add(p);
    if ((ext === ".json" || ext === ".yaml" || ext === ".yml") && /openapi|swagger/.test(base)) {
      apiCandidates.add(p);
    }
    if (inDir(lower, API_DIRS)) apiCandidates.add(p);
    if (f.category === "schema" || ext === ".prisma") schemaCandidates.add(p);
    if (inDir(lower, SCHEMA_DIRS2)) schemaCandidates.add(p);
    if (DS_FILE_NAMES.has(base)) designSystemCandidates.add(p);
    if (DS_STYLE_EXTS.has(ext) && f.size <= MAX_CONTENT_SCAN_BYTES) {
      const css = safeRead2(repo, p);
      if (css && DS_CSS_RE.test(css)) designSystemCandidates.add(p);
    }
    if (CONTENT_SCAN_EXTS.has(ext) && f.size <= MAX_CONTENT_SCAN_BYTES) {
      const src = safeRead2(repo, p);
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
    entryPoints: detectEntryPoints(repo, files)
  };
}
var CONVENTIONAL_ENTRIES = [
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
  "lib/main.dart"
];
function detectEntryPoints(repo, files) {
  const entries = /* @__PURE__ */ new Set();
  try {
    const pkg = JSON.parse(readFileSync12(join20(repo, "package.json"), "utf8"));
    for (const key of ["main", "module"]) {
      const v = pkg[key];
      if (typeof v === "string") entries.add(v.replace(/^\.\//, ""));
    }
    if (pkg.bin && typeof pkg.bin === "object") {
      for (const v of Object.values(pkg.bin)) {
        if (typeof v === "string") entries.add(v.replace(/^\.\//, ""));
      }
    } else if (typeof pkg.bin === "string") {
      entries.add(pkg.bin.replace(/^\.\//, ""));
    }
  } catch {
  }
  const present = new Set(files.map((f) => f.path));
  for (const c2 of CONVENTIONAL_ENTRIES) {
    if (present.has(c2)) entries.add(c2);
  }
  return [...entries].sort();
}

// src/design.ts
function detectStylingLibraries(libraries) {
  return libraries.filter((l) => STYLING_LIBRARY_LABELS.has(l));
}
function hasUI(inv) {
  if (inv.designSystem != null) return true;
  if ((inv.stack?.stylingLibraries?.length ?? 0) > 0) return true;
  if (inv.stack?.frameworks?.some((f) => UI_FRAMEWORK_LABELS.has(f))) return true;
  if ((inv.hints?.designSystemCandidates?.length ?? 0) > 0) return true;
  if (inv.files?.some((f) => f.category === "style")) return true;
  if (inv.routes?.some((r) => r.kind === "page" || r.kind === "component")) return true;
  return false;
}

// src/adapters/nextjs.ts
import { readFileSync as readFileSync13 } from "fs";
import { join as join21 } from "path";
var CODE_PAGE_EXTS = /* @__PURE__ */ new Set([".tsx", ".ts", ".jsx", ".js"]);
var PAGES_SPECIAL = /* @__PURE__ */ new Set(["_app", "_document", "_error", "middleware"]);
var HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
function cleanAppSegments(segs) {
  const out2 = [];
  for (const raw of segs) {
    const s = raw.replace(/^(\(\.{1,3}\))+/, "");
    if (!s) continue;
    if (s.startsWith("@")) continue;
    if (s.startsWith("(") && s.endsWith(")")) continue;
    out2.push(s);
  }
  return out2;
}
var WORKSPACE_PREFIX_RE = /^(?:apps|packages)\/[^/]+(?:\/src)?$/;
function afterDir(path, dir) {
  const parts2 = path.split("/");
  for (let idx = 0; idx < parts2.length; idx++) {
    if (parts2[idx] !== dir) continue;
    const prefix = parts2.slice(0, idx).join("/");
    if (prefix === "" || prefix === "src" || WORKSPACE_PREFIX_RE.test(prefix)) {
      return parts2.slice(idx + 1);
    }
  }
  return null;
}
function routeMethods(repo, file) {
  let src;
  try {
    src = readFileSync13(join21(repo, file), "utf8");
  } catch {
    return [];
  }
  const found = /* @__PURE__ */ new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Z]+)\b/g)) {
    if (HTTP_METHODS.includes(m[1])) found.add(m[1]);
  }
  for (const m of src.matchAll(/export\s+const\s+([A-Z]+)\s*=/g)) {
    if (HTTP_METHODS.includes(m[1])) found.add(m[1]);
  }
  return [...found];
}
function detectAppRoutes(files, repo) {
  const routes = [];
  for (const f of files) {
    if (!CODE_PAGE_EXTS.has(f.ext)) continue;
    const rest = afterDir(f.path, "app");
    if (!rest || rest.length === 0) continue;
    const fileName = rest[rest.length - 1].replace(/\.(tsx|ts|jsx|js)$/, "");
    const dirSegs = cleanAppSegments(rest.slice(0, -1));
    const route = "/" + dirSegs.join("/");
    const normalized = route === "/" ? "/" : route.replace(/\/$/, "");
    if (fileName === "page") {
      routes.push({ route: normalized, file: f.path, kind: "page" });
    } else if (fileName === "route") {
      const methods = routeMethods(repo, f.path);
      if (methods.length) {
        for (const method of methods) routes.push({ route: normalized, file: f.path, kind: "api", method });
      } else {
        routes.push({ route: normalized, file: f.path, kind: "api" });
      }
    } else if (fileName === "layout") {
      routes.push({ route: normalized, file: f.path, kind: "layout" });
    }
  }
  return routes;
}
function detectPagesRoutes(files) {
  const routes = [];
  for (const f of files) {
    if (!CODE_PAGE_EXTS.has(f.ext)) continue;
    const rest = afterDir(f.path, "pages");
    if (!rest || rest.length === 0) continue;
    const fileName = rest[rest.length - 1].replace(/\.(tsx|ts|jsx|js)$/, "");
    if (PAGES_SPECIAL.has(fileName)) continue;
    const segs = [...rest.slice(0, -1), fileName].filter((s) => s !== "index");
    const route = "/" + segs.join("/");
    const normalized = route === "/" ? "/" : route.replace(/\/$/, "");
    const isApi = rest[0] === "api";
    routes.push({ route: normalized, file: f.path, kind: isApi ? "api" : "page" });
  }
  return routes;
}
var nextjsAdapter = {
  id: "nextjs",
  frameworks: ["Next.js"],
  detectRoutes(files, repo) {
    return [...detectAppRoutes(files, repo), ...detectPagesRoutes(files)];
  }
};

// src/adapters/util.ts
import { readFileSync as readFileSync14 } from "fs";
import { join as join22 } from "path";
function readSources(files, repo, exts) {
  const set = new Set(exts);
  const out2 = /* @__PURE__ */ new Map();
  for (const f of files) {
    if (!set.has(f.ext)) continue;
    try {
      out2.set(f.path, readFileSync14(join22(repo, f.path), "utf8"));
    } catch {
    }
  }
  return out2;
}
var JS_SRC_EXTS = [".js", ".ts", ".mts", ".cts", ".mjs", ".cjs"];
function dirOf2(p) {
  const i2 = p.lastIndexOf("/");
  return i2 === -1 ? "" : p.slice(0, i2);
}
function resolveModule(fromFile, spec, sources, exts = JS_SRC_EXTS) {
  const segs = [];
  for (const s of `${dirOf2(fromFile)}/${spec}`.split("/")) {
    if (s === "" || s === ".") continue;
    if (s === "..") segs.pop();
    else segs.push(s);
  }
  const base = segs.join("/");
  for (const cand of [base, ...exts.map((e) => base + e), ...exts.map((e) => `${base}/index${e}`)]) {
    if (sources.has(cand)) return cand;
  }
  return null;
}
function moduleName(path) {
  return path.replace(/\.py$/, "").replace(/\/__init__$/, "").split("/").join(".");
}
function joinRoute(...parts2) {
  const segs = parts2.join("/").split("/").filter(Boolean);
  return "/" + segs.join("/");
}
function pythonImportAliases(src) {
  const out2 = /* @__PURE__ */ new Map();
  for (const m of src.matchAll(/^\s*from\s+([\w.]+)\s+import\s+(.+)$/gm)) {
    const module2 = m[1];
    for (const part of m[2].split(",")) {
      const asMatch = part.trim().match(/^(\w+)(?:\s+as\s+(\w+))?$/);
      if (!asMatch) continue;
      const name2 = asMatch[1];
      const alias = asMatch[2] ?? name2;
      out2.set(alias, `${module2}::${name2}`);
    }
  }
  return out2;
}

// src/adapters/flask.ts
var HTTP_DECORATORS = "route|get|post|put|delete|patch|options|head";
var DECORATOR_RE = new RegExp(`@(\\w+)\\.(${HTTP_DECORATORS})\\(\\s*["']([^"']*)["']([^)]*)\\)`, "g");
var BLUEPRINT_DEF_RE = /(\w+)\s*=\s*Blueprint\s*\(([^)]*)\)/g;
var REGISTER_RE = /(\w+)\.register_blueprint\(\s*(\w+)([^)]*)\)/g;
var ADD_URL_RE = /(\w+)\.add_url_rule\(\s*["']([^"']*)["']([^)]*)\)/g;
function urlPrefixOf(args2) {
  const m = args2.match(/url_prefix\s*=\s*["']([^"']*)["']/);
  return m ? m[1] : "";
}
function methodsOf(args2) {
  const m = args2.match(/methods\s*=\s*[[(]([^\])]*)[\])]/);
  if (!m) return [];
  return [...m[1].matchAll(/["']([A-Za-z]+)["']/g)].map((v) => v[1].toUpperCase());
}
function routeKind(src, from) {
  const next = src.slice(from + 1).search(/\n@\w+\.(route|get|post|put|delete|patch)/);
  const block = next === -1 ? src.slice(from) : src.slice(from, from + 1 + next);
  return /render_template\s*\(/.test(block) ? "page" : "api";
}
var flaskAdapter = {
  id: "flask",
  frameworks: ["Flask"],
  detectRoutes(files, repo) {
    const sources = readSources(files, repo, [".py"]);
    const blueprintKeys = /* @__PURE__ */ new Set();
    const blueprintVarsByFile = /* @__PURE__ */ new Map();
    const ownPrefix = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      const vars = /* @__PURE__ */ new Set();
      for (const m of src.matchAll(BLUEPRINT_DEF_RE)) {
        const v = m[1];
        vars.add(v);
        const key = `${moduleName(path)}::${v}`;
        blueprintKeys.add(key);
        ownPrefix.set(key, urlPrefixOf(m[2]));
      }
      if (vars.size) blueprintVarsByFile.set(path, vars);
    }
    const regOf = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      const aliases = pythonImportAliases(src);
      const keyFor = (v) => aliases.get(v) ?? `${moduleName(path)}::${v}`;
      for (const m of src.matchAll(REGISTER_RE)) {
        const childKey = keyFor(m[2]);
        if (!blueprintKeys.has(childKey)) continue;
        regOf.set(childKey, {
          receiverKey: keyFor(m[1]),
          regPrefix: urlPrefixOf(m[3])
        });
      }
    }
    const effectivePrefix = (key, seen = /* @__PURE__ */ new Set()) => {
      if (seen.has(key)) return "";
      seen.add(key);
      const own = ownPrefix.get(key) ?? "";
      const reg = regOf.get(key);
      if (!reg) return own;
      const childPrefix = reg.regPrefix || own;
      if (blueprintKeys.has(reg.receiverKey)) {
        return joinRoute(effectivePrefix(reg.receiverKey, seen), childPrefix);
      }
      return childPrefix;
    };
    const routes = [];
    for (const [path, src] of sources) {
      const localBlueprints = blueprintVarsByFile.get(path) ?? /* @__PURE__ */ new Set();
      const prefixForObj = (obj) => localBlueprints.has(obj) ? effectivePrefix(`${moduleName(path)}::${obj}`) : "";
      for (const m of src.matchAll(DECORATOR_RE)) {
        const obj = m[1];
        const decorator = m[2];
        const route = joinRoute(prefixForObj(obj), m[3]);
        const kind = routeKind(src, m.index ?? 0);
        const methods = decorator === "route" ? methodsOf(m[4]) : [decorator.toUpperCase()];
        const verbs = methods.length ? methods : ["GET"];
        for (const method of verbs) routes.push({ route, file: path, kind, method });
      }
      for (const m of src.matchAll(ADD_URL_RE)) {
        const route = joinRoute(prefixForObj(m[1]), m[2]);
        const kind = routeKind(src, m.index ?? 0);
        const verbs = methodsOf(m[3]);
        for (const method of verbs.length ? verbs : ["GET"]) {
          routes.push({ route, file: path, kind, method });
        }
      }
    }
    return routes;
  }
};

// src/adapters/fastapi.ts
var METHODS = "get|post|put|delete|patch|options|head|api_route|websocket";
var DECORATOR_RE2 = new RegExp(`@(\\w+)\\.(${METHODS})\\(\\s*["']([^"']*)["']([^)]*)\\)`, "g");
var ROUTER_DEF_RE = /(\w+)\s*=\s*APIRouter\(([^)]*)\)/g;
var INCLUDE_RE = /(\w+)\.include_router\(\s*([\w.]+)([^)]*)\)/g;
function prefixArg(args2) {
  const m = args2.match(/prefix\s*=\s*["']([^"']*)["']/);
  return m ? m[1] : "";
}
function methodsOf2(args2) {
  const m = args2.match(/methods\s*=\s*[[(]([^\])]*)[\])]/);
  if (!m) return [];
  return [...m[1].matchAll(/["']([A-Za-z]+)["']/g)].map((v) => v[1].toUpperCase());
}
var lastSeg = (mod) => mod.split(".").pop() ?? mod;
var fastapiAdapter = {
  id: "fastapi",
  frameworks: ["FastAPI"],
  detectRoutes(files, repo) {
    const sources = readSources(files, repo, [".py"]);
    const ownPrefix = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      for (const m of src.matchAll(ROUTER_DEF_RE)) {
        ownPrefix.set(`${moduleName(path)}::${m[1]}`, prefixArg(m[2]));
      }
    }
    const routerKeys = [...ownPrefix.keys()];
    const resolveRouter = (expr, fileModule, aliases) => {
      if (expr.includes(".")) {
        const parts2 = expr.split(".");
        const attr = parts2.pop();
        const mod = parts2.pop();
        return routerKeys.find((k) => k.endsWith(`::${attr}`) && lastSeg(k.split("::")[0]) === mod) ?? null;
      }
      const key = aliases.get(expr) ?? `${fileModule}::${expr}`;
      return ownPrefix.has(key) ? key : null;
    };
    const includeOf = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      const fileModule = moduleName(path);
      const aliases = pythonImportAliases(src);
      for (const m of src.matchAll(INCLUDE_RE)) {
        const childKey = resolveRouter(m[2], fileModule, aliases);
        if (!childKey) continue;
        const receiverVar = m[1];
        const receiverKey = aliases.get(receiverVar) ?? `${fileModule}::${receiverVar}`;
        includeOf.set(childKey, {
          receiverKey: ownPrefix.has(receiverKey) ? receiverKey : null,
          mountPrefix: prefixArg(m[3])
        });
      }
    }
    const fullPrefix = (key, seen = /* @__PURE__ */ new Set()) => {
      if (seen.has(key)) return "";
      seen.add(key);
      const own = ownPrefix.get(key) ?? "";
      const inc = includeOf.get(key);
      if (!inc) return own;
      const parent = inc.receiverKey ? fullPrefix(inc.receiverKey, seen) : "";
      return joinRoute(parent, inc.mountPrefix, own);
    };
    const routes = [];
    for (const [path, src] of sources) {
      const fileModule = moduleName(path);
      for (const m of src.matchAll(DECORATOR_RE2)) {
        const obj = m[1];
        const decorator = m[2];
        const key = `${fileModule}::${obj}`;
        const prefix = ownPrefix.has(key) ? fullPrefix(key) : "";
        const route = joinRoute(prefix, m[3]);
        const methods = decorator === "websocket" ? ["WS"] : decorator === "api_route" ? methodsOf2(m[4]) : [decorator.toUpperCase()];
        if (methods.length) {
          for (const method of methods) routes.push({ route, file: path, kind: "api", method });
        } else {
          routes.push({ route, file: path, kind: "api" });
        }
      }
    }
    return routes;
  }
};

// src/adapters/nestjs.ts
var CONTROLLER_RE = /@Controller\(\s*([^)]*)\)/g;
var METHOD_RE = /@(Get|Post|Put|Delete|Patch|Options|Head|All)\(\s*([^)]*)\)/g;
var GLOBAL_PREFIX_RE = /setGlobalPrefix\(\s*["'`]([^"'`]*)["'`]/;
function pathsFromArg(arg) {
  const t = arg.trim();
  if (!t) return [""];
  if (t.startsWith("[")) {
    const parts2 = [...t.matchAll(/["'`]([^"'`]*)["'`]/g)].map((m) => m[1]);
    return parts2.length ? parts2 : [""];
  }
  const str2 = t.match(/^["'`]([^"'`]*)["'`]/);
  if (str2) return [str2[1]];
  const obj = t.match(/path\s*:\s*["'`]([^"'`]*)["'`]/);
  if (obj) return [obj[1]];
  return [""];
}
var methodOf = (verb) => verb === "All" ? "*" : verb.toUpperCase();
var nestjsAdapter = {
  id: "nestjs",
  frameworks: ["NestJS"],
  detectRoutes(files, repo) {
    const sources = readSources(files, repo, [".ts"]);
    let globalPrefix = "";
    for (const [, src] of sources) {
      const m = src.match(GLOBAL_PREFIX_RE);
      if (m) {
        globalPrefix = m[1];
        break;
      }
    }
    const routes = [];
    for (const [path, src] of sources) {
      const controllers = [...src.matchAll(CONTROLLER_RE)].map((m) => ({
        index: m.index ?? 0,
        bases: pathsFromArg(m[1])
      }));
      if (!controllers.length) continue;
      for (const m of src.matchAll(METHOD_RE)) {
        const idx = m.index ?? 0;
        let bases = [""];
        for (const c2 of controllers) {
          if (c2.index < idx) bases = c2.bases;
          else break;
        }
        const method = methodOf(m[1]);
        for (const base of bases) {
          for (const sub of pathsFromArg(m[2])) {
            routes.push({
              route: joinRoute(globalPrefix, base, sub),
              file: path,
              kind: "api",
              method
            });
          }
        }
      }
    }
    return routes;
  }
};

// src/adapters/express.ts
var APP_RE = /(?:const|let|var)\s+(\w+)\s*=\s*express\(\)/g;
var ROUTER_RE = /(?:const|let|var)\s+(\w+)\s*=\s*(?:express\.|require\(\s*["'`]express["'`]\s*\)\.)?Router\(\)/g;
var REQUIRE_RE = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
var IMPORT_RE = /import\s+(\w+)\s+from\s+["'`](\.[^"'`]*)["'`]/g;
var USE_RE = /(\w+)\.use\(\s*["'`]([^"'`]*)["'`]\s*,\s*(\w+)/g;
var ROUTE_RE = /(\w+)\.(get|post|put|delete|patch|all|ws)\(\s*["'`]([^"'`]*)["'`]/g;
var ROUTE_CHAIN_RE = /(\w+)\.route\(\s*["'`]([^"'`]*)["'`]\s*\)/g;
var CHAIN_VERB_RE = /\.\s*(get|post|put|delete|patch|all|ws)\s*\(/g;
function methodOf2(verb) {
  return verb.toLowerCase() === "all" ? "*" : verb.toUpperCase();
}
function localVars(src, re) {
  return new Set([...src.matchAll(re)].map((m) => m[1]));
}
var expressAdapter = {
  id: "express",
  frameworks: ["Express"],
  detectRoutes(files, repo) {
    const sources = readSources(files, repo, JS_SRC_EXTS);
    const mountByFile = /* @__PURE__ */ new Map();
    const mountByLocalVar = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      const localRouters = localVars(src, ROUTER_RE);
      const moduleOf = /* @__PURE__ */ new Map();
      for (const m of src.matchAll(REQUIRE_RE)) moduleOf.set(m[1], m[2]);
      for (const m of src.matchAll(IMPORT_RE)) moduleOf.set(m[1], m[2]);
      for (const m of src.matchAll(USE_RE)) {
        const prefix = m[2];
        const usedVar = m[3];
        const spec = moduleOf.get(usedVar);
        if (spec) {
          const target = resolveModule(path, spec, sources);
          if (target) mountByFile.set(target, prefix);
        } else if (localRouters.has(usedVar)) {
          mountByLocalVar.set(`${path}::${usedVar}`, prefix);
        }
      }
    }
    const routes = [];
    for (const [path, src] of sources) {
      const appVars = localVars(src, APP_RE);
      const routerVars = localVars(src, ROUTER_RE);
      const prefixFor = (obj) => {
        if (appVars.has(obj)) return "";
        if (!routerVars.has(obj)) return "";
        return mountByLocalVar.get(`${path}::${obj}`) ?? mountByFile.get(path) ?? "";
      };
      const known = (obj) => appVars.has(obj) || routerVars.has(obj);
      for (const m of src.matchAll(ROUTE_RE)) {
        const obj = m[1];
        if (!known(obj)) continue;
        routes.push({
          route: joinRoute(prefixFor(obj), m[3]),
          file: path,
          kind: "api",
          method: methodOf2(m[2])
        });
      }
      for (const m of src.matchAll(ROUTE_CHAIN_RE)) {
        const obj = m[1];
        if (!known(obj)) continue;
        const route = joinRoute(prefixFor(obj), m[2]);
        const start2 = (m.index ?? 0) + m[0].length;
        const lineEnd = src.indexOf("\n", start2);
        const tail = src.slice(start2, lineEnd === -1 ? start2 + 200 : lineEnd);
        const verbs = [...tail.matchAll(CHAIN_VERB_RE)].map((v) => v[1]);
        if (verbs.length) {
          for (const v of verbs) routes.push({ route, file: path, kind: "api", method: methodOf2(v) });
        } else {
          routes.push({ route, file: path, kind: "api" });
        }
      }
    }
    return routes;
  }
};

// src/adapters/fastify.ts
var APP_RE2 = /(?:const|let|var)\s+(\w+)\s*=\s*(?:require\(\s*["'`]fastify["'`]\s*\)|[Ff]astify)\s*\(/g;
var REQUIRE_RE2 = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
var IMPORT_RE2 = /import\s+(\w+)\s+from\s+["'`](\.[^"'`]*)["'`]/g;
var REGISTER_RE2 = /(\w+)\.register\(\s*(?:require\(\s*["'`](\.[^"'`]*)["'`]\s*\)|(\w+))\s*(?:,\s*\{([^}]*)\})?/g;
var PREFIX_RE = /\bprefix\s*:\s*["'`]([^"'`]*)["'`]/;
var ROUTE_RE2 = /(\w+)\.(get|head|post|put|delete|options|patch|all)\(\s*["'`]([^"'`]*)["'`]/g;
var ROUTE_OBJ_RE = /(\w+)\.route\(\s*\{/g;
var URL_RE = /\burl\s*:\s*["'`]([^"'`]*)["'`]/;
var METHOD_RE2 = /\bmethod\s*:\s*(?:["'`](\w+)["'`]|\[([^\]]*)\])/;
function methodOf3(verb) {
  return verb.toLowerCase() === "all" ? "*" : verb.toUpperCase();
}
function pluginParam(src) {
  const direct = src.match(/module\.exports\s*=\s*(?:async\s+)?function\s*\w*\s*\(\s*(\w+)/) ?? src.match(/module\.exports\s*=\s*(?:async\s*)?\(\s*(\w+)/) ?? src.match(/export\s+default\s+(?:async\s+)?function\s*\w*\s*\(\s*(\w+)/) ?? src.match(/export\s+default\s+(?:async\s*)?\(\s*(\w+)/);
  if (direct) return direct[1];
  const named = src.match(/(?:module\.exports\s*=|export\s+default)\s*(\w+)\s*;?\s*$/m);
  if (named) {
    const name2 = named[1];
    const fn = src.match(new RegExp(`function\\s+${name2}\\s*\\(\\s*(\\w+)`)) ?? src.match(new RegExp(`(?:const|let|var)\\s+${name2}\\s*=\\s*(?:async\\s*)?\\(\\s*(\\w+)`));
    if (fn) return fn[1];
  }
  return null;
}
function localVars2(src, re) {
  return new Set([...src.matchAll(re)].map((m) => m[1]));
}
var fastifyAdapter = {
  id: "fastify",
  frameworks: ["Fastify"],
  detectRoutes(files, repo) {
    const sources = readSources(files, repo, JS_SRC_EXTS);
    const appVarsByFile = /* @__PURE__ */ new Map();
    const pluginParamByFile = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      appVarsByFile.set(path, localVars2(src, APP_RE2));
      const param = pluginParam(src);
      if (param) pluginParamByFile.set(path, param);
    }
    const edges = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      const receivers = new Set(appVarsByFile.get(path));
      const param = pluginParamByFile.get(path);
      if (param) receivers.add(param);
      const moduleOf = /* @__PURE__ */ new Map();
      for (const m of src.matchAll(REQUIRE_RE2)) moduleOf.set(m[1], m[2]);
      for (const m of src.matchAll(IMPORT_RE2)) moduleOf.set(m[1], m[2]);
      for (const m of src.matchAll(REGISTER_RE2)) {
        if (!receivers.has(m[1])) continue;
        const spec = m[2] ?? moduleOf.get(m[3]);
        if (!spec) continue;
        const target = resolveModule(path, spec, sources);
        if (!target) continue;
        const prefix = (m[4] ?? "").match(PREFIX_RE)?.[1] ?? "";
        const list = edges.get(path);
        if (list) list.push({ target, prefix });
        else edges.set(path, [{ target, prefix }]);
      }
    }
    const mountByFile = /* @__PURE__ */ new Map();
    const queue = [...sources.keys()].filter((p) => (appVarsByFile.get(p)?.size ?? 0) > 0).sort().map((p) => ({ file: p, mount: "" }));
    while (queue.length > 0) {
      const { file, mount } = queue.shift();
      for (const { target, prefix } of edges.get(file) ?? []) {
        if (mountByFile.has(target)) continue;
        const next = mount === "" && prefix === "" ? "" : joinRoute(mount, prefix);
        mountByFile.set(target, next);
        queue.push({ file: target, mount: next });
      }
    }
    const routes = [];
    for (const [path, src] of sources) {
      const appVars = appVarsByFile.get(path) ?? /* @__PURE__ */ new Set();
      const param = pluginParamByFile.get(path);
      const prefixFor = (obj) => {
        if (appVars.has(obj)) return "";
        if (obj === param) return mountByFile.get(path) ?? "";
        return null;
      };
      for (const m of src.matchAll(ROUTE_RE2)) {
        const prefix = prefixFor(m[1]);
        if (prefix === null) continue;
        const tail = src.slice((m.index ?? 0) + m[0].length).slice(0, 200);
        const isWs = /^\s*,\s*\{[^}]*\bwebsocket\s*:\s*true/.test(tail);
        routes.push({
          route: joinRoute(prefix, m[3]),
          file: path,
          kind: "api",
          method: isWs ? "WS" : methodOf3(m[2])
        });
      }
      for (const m of src.matchAll(ROUTE_OBJ_RE)) {
        const prefix = prefixFor(m[1]);
        if (prefix === null) continue;
        const slice = src.slice(m.index ?? 0, (m.index ?? 0) + 400);
        const url = slice.match(URL_RE)?.[1];
        if (url === void 0) continue;
        const route = joinRoute(prefix, url);
        if (/\bwebsocket\s*:\s*true/.test(slice)) {
          routes.push({ route, file: path, kind: "api", method: "WS" });
          continue;
        }
        const methodM = slice.match(METHOD_RE2);
        const verbs = methodM?.[1] ? [methodM[1]] : (methodM?.[2] ?? "").split(",").map((s) => s.trim().replace(/^["'`]|["'`]$/g, "")).filter(Boolean);
        if (verbs.length) {
          for (const v of verbs) routes.push({ route, file: path, kind: "api", method: methodOf3(v) });
        } else {
          routes.push({ route, file: path, kind: "api" });
        }
      }
    }
    return routes;
  }
};

// src/adapters/hono.ts
var APP_RE3 = /(?:const|let|var)\s+(\w+)\s*=\s*new\s+Hono\s*(?:<[^>]*>)?\s*\([^)]*\)(?:\s*\.basePath\(\s*["'`]([^"'`]*)["'`]\s*\))?/g;
var BASEPATH_RE = /(\w+)\.basePath\(\s*["'`]([^"'`]*)["'`]/g;
var REQUIRE_RE3 = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
var IMPORT_RE3 = /import\s+(\w+)\s+from\s+["'`](\.[^"'`]*)["'`]/g;
var ROUTE_RE3 = /(\w+)\.(get|post|put|delete|patch|options|all)\(\s*["'`]([^"'`]*)["'`]/g;
var ON_RE = /(\w+)\.on\(\s*(?:["'`](\w+)["'`]|\[([^\]]*)\])\s*,\s*["'`]([^"'`]*)["'`]/g;
var MOUNT_RE = /(\w+)\.route\(\s*["'`]([^"'`]*)["'`]\s*,\s*(\w+)\s*\)/g;
var EXPORT_RE = /(?:export\s+default|module\.exports\s*=)\s+(\w+)\s*;?/;
function methodOf4(verb) {
  return verb.toLowerCase() === "all" ? "*" : verb.toUpperCase();
}
var honoAdapter = {
  id: "hono",
  frameworks: ["Hono"],
  detectRoutes(files, repo) {
    const sources = readSources(files, repo, JS_SRC_EXTS);
    const appVarsByFile = /* @__PURE__ */ new Map();
    const basePathByVar = /* @__PURE__ */ new Map();
    const exportedByFile = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      const vars = /* @__PURE__ */ new Set();
      for (const m of src.matchAll(APP_RE3)) {
        vars.add(m[1]);
        if (m[2]) basePathByVar.set(`${path}::${m[1]}`, m[2]);
      }
      for (const m of src.matchAll(BASEPATH_RE)) {
        if (vars.has(m[1])) basePathByVar.set(`${path}::${m[1]}`, m[2]);
      }
      appVarsByFile.set(path, vars);
      const exp = src.match(EXPORT_RE);
      if (exp && vars.has(exp[1])) exportedByFile.set(path, exp[1]);
    }
    const baseOf = (path, v) => basePathByVar.get(`${path}::${v}`) ?? "";
    const mountByLocalVar = /* @__PURE__ */ new Map();
    const edges = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      const vars = appVarsByFile.get(path) ?? /* @__PURE__ */ new Set();
      const moduleOf = /* @__PURE__ */ new Map();
      for (const m of src.matchAll(REQUIRE_RE3)) moduleOf.set(m[1], m[2]);
      for (const m of src.matchAll(IMPORT_RE3)) moduleOf.set(m[1], m[2]);
      for (const m of src.matchAll(MOUNT_RE)) {
        const receiver = m[1];
        if (!vars.has(receiver)) continue;
        const prefix = joinRoute(baseOf(path, receiver), m[2]);
        const mounted = m[3];
        const spec = moduleOf.get(mounted);
        if (spec) {
          const target = resolveModule(path, spec, sources);
          if (!target) continue;
          const list = edges.get(path);
          if (list) list.push({ target, prefix });
          else edges.set(path, [{ target, prefix }]);
        } else if (vars.has(mounted)) {
          mountByLocalVar.set(`${path}::${mounted}`, prefix);
        }
      }
    }
    const targets = new Set([...edges.values()].flat().map((e) => e.target));
    const mountByFile = /* @__PURE__ */ new Map();
    const queue = [...sources.keys()].filter((p) => !targets.has(p)).sort().map((p) => ({ file: p, mount: "" }));
    while (queue.length > 0) {
      const { file, mount } = queue.shift();
      for (const { target, prefix } of edges.get(file) ?? []) {
        if (mountByFile.has(target)) continue;
        const next = mount === "" ? prefix : joinRoute(mount, prefix);
        mountByFile.set(target, next);
        queue.push({ file: target, mount: next });
      }
    }
    const routes = [];
    for (const [path, src] of sources) {
      const vars = appVarsByFile.get(path) ?? /* @__PURE__ */ new Set();
      if (vars.size === 0) continue;
      const exported = exportedByFile.get(path);
      const prefixFor = (v) => {
        if (!vars.has(v)) return null;
        const mount = mountByLocalVar.get(`${path}::${v}`) ?? (v === exported ? mountByFile.get(path) ?? "" : "");
        const base = baseOf(path, v);
        return mount === "" && base === "" ? "" : joinRoute(mount, base);
      };
      for (const m of src.matchAll(ROUTE_RE3)) {
        const prefix = prefixFor(m[1]);
        if (prefix === null) continue;
        routes.push({
          route: joinRoute(prefix, m[3]),
          file: path,
          kind: "api",
          method: methodOf4(m[2])
        });
      }
      for (const m of src.matchAll(ON_RE)) {
        const prefix = prefixFor(m[1]);
        if (prefix === null) continue;
        const route = joinRoute(prefix, m[4]);
        const verbs = m[2] ? [m[2]] : m[3].split(",").map((s) => s.trim().replace(/^["'`]|["'`]$/g, "")).filter(Boolean);
        for (const v of verbs) routes.push({ route, file: path, kind: "api", method: methodOf4(v) });
      }
    }
    return routes;
  }
};

// src/adapters/django.ts
var ENTRY_RE = /\b(path|re_path|url)\(\s*r?["']([^"']*)["']\s*,\s*([\w.]+)/g;
var INCLUDE_RE2 = /\b(?:path|re_path|url)\(\s*r?["']([^"']*)["']\s*,\s*include\(\s*["']([^"']*)["']/g;
var DRF_ROUTER_RE = /(\w+)\s*=\s*(?:routers\.)?(?:Default|Simple)Router\(/g;
var DRF_REGISTER_RE = /(\w+)\.register\(\s*r?["']([^"']*)["']/g;
var DRF_MOUNT_RE = /\b(?:path|re_path|url)\(\s*r?["']([^"']*)["']\s*,\s*include\(\s*(\w+)\.urls/g;
function cleanRegex(pattern) {
  return pattern.replace(/^\^/, "").replace(/\$$/, "").replace(/\(\?P<(\w+)>[^)]*\)/g, "<$1>");
}
function isApiContext(src, route) {
  return /rest_framework|ViewSet|APIView|JsonResponse|@api_view/.test(src) || /(^|\/)api(\/|$)/.test(route);
}
var djangoAdapter = {
  id: "django",
  frameworks: ["Django"],
  detectRoutes(files, repo) {
    const sources = readSources(files, repo, [".py"]);
    const includeEdge = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      if (!path.endsWith("urls.py")) continue;
      const parent = moduleName(path);
      for (const m of src.matchAll(INCLUDE_RE2)) {
        const child = m[2];
        if (!includeEdge.has(child)) includeEdge.set(child, { parent, prefix: m[1] });
      }
    }
    const fullPrefix = (mod, seen = /* @__PURE__ */ new Set()) => {
      if (seen.has(mod)) return "";
      seen.add(mod);
      const e = includeEdge.get(mod);
      return e ? joinRoute(fullPrefix(e.parent, seen), e.prefix) : "";
    };
    const routes = [];
    for (const [path, src] of sources) {
      if (!path.endsWith("urls.py")) continue;
      const prefix = fullPrefix(moduleName(path));
      for (const m of src.matchAll(ENTRY_RE)) {
        const view = m[3];
        if (view === "include") continue;
        if (view.endsWith(".site.urls") || view === "admin") continue;
        const raw = m[1] !== "path" ? cleanRegex(m[2]) : m[2];
        const route = joinRoute(prefix, raw);
        routes.push({ route, file: path, kind: isApiContext(src, route) ? "api" : "page" });
      }
      const routerVars = new Set([...src.matchAll(DRF_ROUTER_RE)].map((m) => m[1]));
      if (!routerVars.size) continue;
      const mountOf = /* @__PURE__ */ new Map();
      for (const m of src.matchAll(DRF_MOUNT_RE)) {
        if (routerVars.has(m[2])) mountOf.set(m[2], m[1]);
      }
      for (const m of src.matchAll(DRF_REGISTER_RE)) {
        const router = m[1];
        if (!routerVars.has(router)) continue;
        const base = joinRoute(prefix, mountOf.get(router) ?? "", m[2]);
        const detail = joinRoute(base, "<pk>");
        const add = (route, method) => routes.push({ route, file: path, kind: "api", method });
        add(base, "GET");
        add(base, "POST");
        add(detail, "GET");
        add(detail, "PUT");
        add(detail, "PATCH");
        add(detail, "DELETE");
      }
    }
    return routes;
  }
};

// src/adapters/rails.ts
var PLURAL_ACTIONS = {
  index: [{ method: "GET", segs: [] }],
  create: [{ method: "POST", segs: [] }],
  new: [{ method: "GET", segs: ["new"] }],
  show: [{ method: "GET", segs: [":id"] }],
  update: [
    { method: "PUT", segs: [":id"] },
    { method: "PATCH", segs: [":id"] }
  ],
  destroy: [{ method: "DELETE", segs: [":id"] }],
  edit: [{ method: "GET", segs: [":id", "edit"] }]
};
var SINGULAR_ACTIONS = {
  create: [{ method: "POST", segs: [] }],
  new: [{ method: "GET", segs: ["new"] }],
  show: [{ method: "GET", segs: [] }],
  update: [
    { method: "PUT", segs: [] },
    { method: "PATCH", segs: [] }
  ],
  destroy: [{ method: "DELETE", segs: [] }],
  edit: [{ method: "GET", segs: ["edit"] }]
};
var ROOT_RE = /^root\b/;
var VERB_RE = /\b(get|post|put|patch|delete)\s+(?::(\w+)|["']([^"']+)["'])/g;
var RESOURCES_RE = /\b(resources|resource)\s+:(\w+)([^\n]*)/g;
var NAMESPACE_RE = /^namespace\s+:?(\w+)/;
var SCOPE_STR_RE = /^scope\s+["']([^"']+)["']/;
var SCOPE_PATH_RE = /^scope\b[^#\n]*\bpath:\s*["']([^"']+)["']/;
var MOUNT_RE2 = /\bmount\s+[\w:]+\s*(?:=>|,\s*at:)\s*["']([^"']+)["']/;
var OPENS_BLOCK_RE = /\bdo\b(\s*\|[^|]*\|)?\s*$/;
var MEMBER_RE = /^member\b/;
var COLLECTION_RE = /^collection\b/;
function singularize(n) {
  if (n.endsWith("ies")) return n.slice(0, -3) + "y";
  if (n.endsWith("s")) return n.slice(0, -1);
  return n;
}
function actionsFor(args2, singular) {
  const all = Object.keys(singular ? SINGULAR_ACTIONS : PLURAL_ACTIONS);
  const parse = (s) => new Set(
    s.split(",").map((a) => a.trim().replace(/^:/, "")).filter(Boolean)
  );
  const only = args2.match(/\bonly:\s*\[([^\]]*)\]/);
  if (only) {
    const set = parse(only[1]);
    return all.filter((a) => set.has(a));
  }
  const except = args2.match(/\bexcept:\s*\[([^\]]*)\]/);
  if (except) {
    const set = parse(except[1]);
    return all.filter((a) => !set.has(a));
  }
  return all;
}
var apiKind = (route) => /(^|\/)api(\/|$)/i.test(route) ? "api" : "page";
var railsAdapter = {
  id: "rails",
  frameworks: ["Ruby on Rails"],
  detectRoutes(files, repo) {
    const routes = [];
    for (const [path, src] of readSources(files, repo, [".rb"])) {
      if (!path.endsWith("routes.rb")) continue;
      const frames = [];
      const emit2 = (route, method, kind) => routes.push({ route, file: path, kind: kind ?? apiKind(route), ...method ? { method } : {} });
      const nestPrefix = (upto) => {
        const out2 = [];
        for (let i2 = 0; i2 < upto; i2++) {
          const f = frames[i2];
          if (f.type === "prefix") out2.push(...f.segs);
          else if (f.type === "resources") out2.push(f.name, `:${f.singular}_id`);
          else if (f.type === "singular") out2.push(f.name);
        }
        return out2;
      };
      const verbPrefix = () => {
        const top = frames[frames.length - 1];
        if (top && (top.type === "member" || top.type === "collection")) {
          let parentIdx = frames.length - 1;
          for (let i2 = frames.length - 2; i2 >= 0; i2--) {
            const f = frames[i2];
            if (f.type === "resources" || f.type === "singular") {
              parentIdx = i2;
              break;
            }
          }
          const base = nestPrefix(parentIdx);
          return top.type === "member" ? [...base, top.name, ":id"] : [...base, top.name];
        }
        return nestPrefix(frames.length);
      };
      for (const rawLine of src.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        if (ROOT_RE.test(line)) emit2(joinRoute(...verbPrefix()), "GET");
        for (const m of line.matchAll(VERB_RE)) {
          const p = m[2] ?? m[3];
          emit2(joinRoute(...verbPrefix(), p), m[1].toUpperCase());
        }
        for (const m of line.matchAll(RESOURCES_RE)) {
          const singular = m[1] === "resource";
          const name2 = m[2];
          const args2 = m[3] ?? "";
          const base = joinRoute(...nestPrefix(frames.length), name2);
          const table = singular ? SINGULAR_ACTIONS : PLURAL_ACTIONS;
          for (const action of actionsFor(args2, singular)) {
            for (const def of table[action]) {
              emit2(joinRoute(base, ...def.segs), def.method);
            }
          }
        }
        const mount = line.match(MOUNT_RE2);
        if (mount) emit2(joinRoute(...nestPrefix(frames.length), mount[1]), void 0, "api");
        if (/^end\b/.test(line)) {
          frames.pop();
          continue;
        }
        if (OPENS_BLOCK_RE.test(line)) {
          const res = line.match(/^(resources|resource)\s+:(\w+)/);
          const ns = line.match(NAMESPACE_RE);
          const scopePath = line.match(SCOPE_PATH_RE) ?? line.match(SCOPE_STR_RE);
          const parentRes = [...frames].reverse().find((f) => f.type === "resources" || f.type === "singular");
          if (MEMBER_RE.test(line)) frames.push({ type: "member", name: parentRes?.name ?? "" });
          else if (COLLECTION_RE.test(line)) frames.push({ type: "collection", name: parentRes?.name ?? "" });
          else if (res && res[1] === "resources") frames.push({ type: "resources", name: res[2], singular: singularize(res[2]) });
          else if (res) frames.push({ type: "singular", name: res[2] });
          else if (ns) frames.push({ type: "prefix", segs: [ns[1]] });
          else if (scopePath) frames.push({ type: "prefix", segs: [scopePath[1]] });
          else frames.push({ type: "prefix", segs: [] });
        }
      }
    }
    return routes;
  }
};

// src/adapters/go.ts
var VERB_TOKENS = "GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE|Get|Post|Put|Delete|Patch|Head|Options|Connect|Trace|Any|ANY|All";
var VERB_RE2 = new RegExp(`(\\w+)\\.(${VERB_TOKENS})\\(\\s*["\`]([^"\`]*)["\`]`, "g");
var HANDLE_VERB_RE = /(\w+)\.(?:Handle|Add)\(\s*["`](GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)["`]\s*,\s*["`]([^"`]*)["`]/g;
var HANDLEFUNC_RE = /(\w+)\.HandleFunc\(\s*["`]([^"`]*)["`][^;\n]*/g;
var METHODS_CHAIN_RE = /\.Methods\(\s*([^)]*)\)/;
var GROUP_RE = /(\w+)\s*:=\s*(\w+)\.Group\(\s*["`]([^"`]*)["`]/g;
var ROUTE_OPEN_RE = /(\w+)\.Route\(\s*["`]([^"`]*)["`]\s*,\s*func/g;
var MOUNT_RE3 = /(\w+)\.Mount\(\s*["`]([^"`]*)["`]/g;
var STD_VERBS = /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/;
function methodOf5(verb) {
  const up = verb.toUpperCase();
  return up === "ANY" || up === "ALL" ? "*" : up;
}
function braceMatch(src) {
  const stack = [];
  const pairs = /* @__PURE__ */ new Map();
  for (let i2 = 0; i2 < src.length; i2++) {
    const c2 = src[i2];
    if (c2 === "{") stack.push(i2);
    else if (c2 === "}") {
      const open = stack.pop();
      if (open !== void 0) pairs.set(open, i2);
    }
  }
  return pairs;
}
var goAdapter = {
  id: "go",
  frameworks: ["Gin", "Echo", "chi", "Fiber", "Gorilla"],
  detectRoutes(files, repo) {
    const routes = [];
    for (const [path, src] of readSources(files, repo, [".go"])) {
      const groups = /* @__PURE__ */ new Map();
      for (const m of src.matchAll(GROUP_RE)) {
        groups.set(m[1], { parent: m[2], seg: m[3] });
      }
      const groupPrefix = (v, seen = /* @__PURE__ */ new Set()) => {
        const g = groups.get(v);
        if (!g || seen.has(v)) return "";
        seen.add(v);
        return joinRoute(groupPrefix(g.parent, seen), g.seg);
      };
      const pairs = braceMatch(src);
      const opens = [...pairs.keys()].sort((a, b) => a - b);
      const ranges = [];
      for (const m of src.matchAll(ROUTE_OPEN_RE)) {
        const at = m.index ?? 0;
        const open = opens.find((o) => o > at);
        if (open === void 0) continue;
        ranges.push({ start: open, end: pairs.get(open), seg: m[2] });
      }
      const closurePrefix = (idx) => joinRoute(
        ...ranges.filter((r) => idx >= r.start && idx <= r.end).sort((a, b) => a.start - b.start).map((r) => r.seg)
      );
      const prefixAt = (recv, idx) => joinRoute(closurePrefix(idx), groupPrefix(recv));
      for (const m of src.matchAll(VERB_RE2)) {
        const routePath = m[3];
        if (!routePath.startsWith("/")) continue;
        routes.push({
          route: joinRoute(prefixAt(m[1], m.index ?? 0), routePath),
          file: path,
          kind: "api",
          method: methodOf5(m[2])
        });
      }
      for (const m of src.matchAll(HANDLE_VERB_RE)) {
        const routePath = m[3];
        if (!routePath.startsWith("/")) continue;
        routes.push({
          route: joinRoute(prefixAt(m[1], m.index ?? 0), routePath),
          file: path,
          kind: "api",
          method: methodOf5(m[2])
        });
      }
      for (const m of src.matchAll(HANDLEFUNC_RE)) {
        const raw = m[2];
        const verbInPattern = raw.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\/\S*)$/);
        const routePath = verbInPattern ? verbInPattern[2] : raw;
        if (!routePath.startsWith("/")) continue;
        const prefix = prefixAt(m[1], m.index ?? 0);
        const chained = m[0].match(METHODS_CHAIN_RE);
        const methods = chained ? [...chained[1].matchAll(/["`]([A-Za-z]+)["`]/g)].map((v) => v[1].toUpperCase()).filter((v) => STD_VERBS.test(v)) : [];
        const route = joinRoute(prefix, routePath);
        if (verbInPattern) {
          routes.push({ route, file: path, kind: "api", method: verbInPattern[1] });
        } else if (methods.length) {
          for (const v of methods) routes.push({ route, file: path, kind: "api", method: v });
        } else {
          routes.push({ route, file: path, kind: "api" });
        }
      }
      for (const m of src.matchAll(MOUNT_RE3)) {
        const seg = m[2];
        if (!seg.startsWith("/")) continue;
        routes.push({
          route: joinRoute(prefixAt(m[1], m.index ?? 0), seg),
          file: path,
          kind: "api"
        });
      }
    }
    return routes;
  }
};

// src/adapters/trpc.ts
var ROUTER_DECL_RE = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:createTRPCRouter|\w+\.router)\s*\(/g;
var REQUIRE_RE4 = /(?:const|let|var)\s+\{([^}]*)\}\s*=\s*require\(\s*["'`](\.[^"'`]*)["'`]\s*\)/g;
var IMPORT_RE4 = /import\s+\{([^}]*)\}\s+from\s+["'`](\.[^"'`]*)["'`]/g;
var METHOD_MARKERS = [
  [/\.subscription\s*\(/, "SUBSCRIPTION"],
  [/\.mutation\s*\(/, "MUTATION"],
  [/\.query\s*\(/, "QUERY"]
];
function extractObjectBody(src, fromIdx) {
  let i2 = fromIdx;
  while (i2 < src.length && /\s/.test(src[i2])) i2++;
  if (src[i2] !== "{") return null;
  const start2 = i2;
  let depth = 0;
  let str2 = null;
  for (; i2 < src.length; i2++) {
    const c2 = src[i2];
    if (str2) {
      if (c2 === "\\") i2++;
      else if (c2 === str2) str2 = null;
      continue;
    }
    if (c2 === '"' || c2 === "'" || c2 === "`") str2 = c2;
    else if (c2 === "{" || c2 === "(" || c2 === "[") depth++;
    else if (c2 === "}" || c2 === ")" || c2 === "]") {
      depth--;
      if (depth === 0) return src.slice(start2 + 1, i2);
    }
  }
  return null;
}
function topLevelEntries(body2) {
  const segments = [];
  let depth = 0;
  let str2 = null;
  let seg = "";
  for (let i2 = 0; i2 < body2.length; i2++) {
    const c2 = body2[i2];
    if (str2) {
      seg += c2;
      if (c2 === "\\") {
        seg += body2[i2 + 1] ?? "";
        i2++;
      } else if (c2 === str2) str2 = null;
      continue;
    }
    if (c2 === '"' || c2 === "'" || c2 === "`") {
      str2 = c2;
      seg += c2;
      continue;
    }
    if (c2 === "{" || c2 === "(" || c2 === "[") depth++;
    else if (c2 === "}" || c2 === ")" || c2 === "]") depth--;
    if (c2 === "," && depth === 0) {
      segments.push(seg);
      seg = "";
      continue;
    }
    seg += c2;
  }
  if (seg.trim()) segments.push(seg);
  const out2 = [];
  for (const raw of segments) {
    const s = raw.trim();
    if (!s) continue;
    let d = 0;
    let q = null;
    let colon = -1;
    for (let i2 = 0; i2 < s.length; i2++) {
      const c2 = s[i2];
      if (q) {
        if (c2 === "\\") i2++;
        else if (c2 === q) q = null;
        continue;
      }
      if (c2 === '"' || c2 === "'" || c2 === "`") q = c2;
      else if (c2 === "{" || c2 === "(" || c2 === "[") d++;
      else if (c2 === "}" || c2 === ")" || c2 === "]") d--;
      else if (c2 === ":" && d === 0) {
        colon = i2;
        break;
      }
    }
    if (colon === -1) {
      const key = /^\w+/.exec(s)?.[0];
      if (key) out2.push({ key, value: key });
    } else {
      const key = s.slice(0, colon).trim().replace(/^["'`]|["'`]$/g, "");
      out2.push({ key, value: s.slice(colon + 1).trim() });
    }
  }
  return out2;
}
function procedureMethod(value) {
  for (const [re, method] of METHOD_MARKERS) if (re.test(value)) return method;
  return null;
}
var INLINE_ROUTER_RE = /^(?:createTRPCRouter|\w+\.router)\s*\(/;
function parseRouterBody(body2, file) {
  const def = { file, procedures: [], children: [], inlineChildren: [] };
  for (const { key, value } of topLevelEntries(body2)) {
    const method = procedureMethod(value);
    if (method) {
      def.procedures.push({ name: key, method });
      continue;
    }
    if (INLINE_ROUTER_RE.test(value)) {
      const inner = extractObjectBody(value, value.indexOf("(") + 1);
      if (inner !== null) def.inlineChildren.push({ name: key, def: parseRouterBody(inner, file) });
      continue;
    }
    const ident = /^\w+$/.exec(value.trim());
    if (ident) def.children.push({ name: key, ref: value.trim() });
  }
  return def;
}
var trpcAdapter = {
  id: "trpc",
  frameworks: [],
  libraries: ["tRPC"],
  detectRoutes(files, repo) {
    const sources = readSources(files, repo, JS_SRC_EXTS);
    const routers = /* @__PURE__ */ new Map();
    const importsByFile = /* @__PURE__ */ new Map();
    for (const [path, src] of sources) {
      const imports = /* @__PURE__ */ new Map();
      for (const re of [IMPORT_RE4, REQUIRE_RE4]) {
        for (const m of src.matchAll(re)) {
          const target = resolveModule(path, m[2], sources);
          if (!target) continue;
          for (const name2 of m[1].split(",")) {
            const id = name2.trim().split(/\s+as\s+/).pop()?.trim();
            if (id) imports.set(id, target);
          }
        }
      }
      importsByFile.set(path, imports);
      for (const m of src.matchAll(ROUTER_DECL_RE)) {
        const varName = m[1];
        const body2 = extractObjectBody(src, (m.index ?? 0) + m[0].length);
        if (body2 === null) continue;
        routers.set(`${path}::${varName}`, parseRouterBody(body2, path));
      }
    }
    const resolveRef = (file, ref) => {
      if (routers.has(`${file}::${ref}`)) return `${file}::${ref}`;
      const target = importsByFile.get(file)?.get(ref);
      if (target && routers.has(`${target}::${ref}`)) return `${target}::${ref}`;
      return null;
    };
    const referenced = /* @__PURE__ */ new Set();
    for (const [id, def] of routers) {
      const file = id.slice(0, id.lastIndexOf("::"));
      for (const c2 of def.children) {
        const target = resolveRef(file, c2.ref);
        if (target) referenced.add(target);
      }
    }
    const routes = [];
    const emit2 = (def, prefix, seen) => {
      const at = (name2) => prefix ? `${prefix}.${name2}` : name2;
      for (const p of def.procedures) routes.push({ route: at(p.name), file: def.file, kind: "api", method: p.method });
      for (const ic of def.inlineChildren) emit2(ic.def, at(ic.name), seen);
      for (const c2 of def.children) {
        const target = resolveRef(def.file, c2.ref);
        if (!target || seen.has(target)) continue;
        emit2(routers.get(target), at(c2.name), /* @__PURE__ */ new Set([...seen, target]));
      }
    };
    for (const [id, def] of routers) if (!referenced.has(id)) emit2(def, "", /* @__PURE__ */ new Set([id]));
    return routes;
  }
};

// src/adapters/dotnet.ts
var MAP_VERB_RE = /(\w+)\s*\.\s*Map(Get|Post|Put|Delete|Patch|Head|Options)\(\s*(?:@?\$?)"([^"]*)"/g;
var MAP_METHODS_RE = /(\w+)\s*\.\s*MapMethods\(\s*(?:@?\$?)"([^"]*)"\s*,\s*([^)]*?)\s*,/g;
var MAP_GROUP_RE = /(?:var|RouteGroupBuilder)\s+(\w+)\s*=\s*(\w+)\s*\.\s*MapGroup\(\s*(?:@?\$?)"([^"]*)"/g;
var CLASS_ROUTE_RE = /\[\s*Route\(\s*(?:@?\$?)"([^"]*)"\s*\)\s*\]/g;
var CLASS_DECL_RE = /\bclass\s+(\w+)\s*(?::|$|\s*\{)/gm;
var ACTION_RE = /\[\s*Http(Get|Post|Put|Delete|Patch|Head|Options)(?:\(\s*(?:(?:@?\$?)"([^"]*)")?\s*\))?\s*\]/g;
function expandTokens(template, className) {
  const controller = className.replace(/Controller$/, "").toLowerCase();
  return template.replace(/\[controller\]/gi, controller);
}
function classAt(decls, idx) {
  let name2 = "";
  for (const d of decls) {
    if (d.index < idx) name2 = d.name;
    else break;
  }
  return name2;
}
var dotnetAdapter = {
  id: "dotnet",
  frameworks: ["ASP.NET Core"],
  detectRoutes(files, repo) {
    const routes = [];
    for (const [path, src] of readSources(files, repo, [".cs"])) {
      const groups = /* @__PURE__ */ new Map();
      for (const m of src.matchAll(MAP_GROUP_RE)) {
        groups.set(m[1], { parent: m[2], seg: m[3] });
      }
      const groupPrefix = (v, seen = /* @__PURE__ */ new Set()) => {
        const g = groups.get(v);
        if (!g || seen.has(v)) return "";
        seen.add(v);
        return joinRoute(groupPrefix(g.parent, seen), g.seg);
      };
      for (const m of src.matchAll(MAP_VERB_RE)) {
        routes.push({
          route: joinRoute(groupPrefix(m[1]), m[3]),
          file: path,
          kind: "api",
          method: m[2].toUpperCase()
        });
      }
      for (const m of src.matchAll(MAP_METHODS_RE)) {
        const verbs = [...m[3].matchAll(/"([A-Za-z]+)"/g)].map((v) => v[1].toUpperCase());
        for (const method of verbs.length ? verbs : ["*"]) {
          routes.push({ route: joinRoute(groupPrefix(m[1]), m[2]), file: path, kind: "api", method });
        }
      }
      const decls = [...src.matchAll(CLASS_DECL_RE)].map((m) => ({ index: m.index ?? 0, name: m[1] }));
      if (!decls.length) continue;
      const classRoutes = [...src.matchAll(CLASS_ROUTE_RE)].map((m) => ({ index: m.index ?? 0, template: m[1] }));
      for (const m of src.matchAll(ACTION_RE)) {
        const idx = m.index ?? 0;
        const className = classAt(decls, idx);
        if (!className) continue;
        let template = "";
        for (const cr of classRoutes) {
          if (cr.index < idx) template = cr.template;
          else break;
        }
        if (!template) continue;
        routes.push({
          route: joinRoute(expandTokens(template, className), m[2] ?? ""),
          file: path,
          kind: "api",
          method: m[1].toUpperCase()
        });
      }
    }
    return routes;
  }
};

// src/adapters/registry.ts
var ROUTE_ADAPTERS = [
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
  dotnetAdapter
];
function detectRoutes(files, stack, repo) {
  const active = ROUTE_ADAPTERS.filter(
    (a) => a.frameworks.some((f) => stack.frameworks.includes(f)) || (a.libraries?.some((l) => stack.libraries.includes(l)) ?? false)
  );
  const seen = /* @__PURE__ */ new Set();
  const merged = [];
  for (const adapter of active) {
    for (const r of adapter.detectRoutes(files, repo)) {
      const key = `${r.method ?? ""} ${r.kind} ${r.route} ${r.file}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(r);
    }
  }
  merged.sort((a, b) => a.route.localeCompare(b.route) || a.kind.localeCompare(b.kind) || (a.method ?? "").localeCompare(b.method ?? ""));
  return merged;
}

// src/adapters/i18n.ts
import { readFileSync as readFileSync15 } from "fs";
import { join as join23, basename as basename3, extname as extname3 } from "path";
var LOCALE_RE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?(-[A-Za-z0-9]{2,8})*$/;
var I18N_DIR_RE = /^(locales?|i18n|lang|langs|translations|messages)$/i;
function countJsonLeaves(value) {
  if (value === null || typeof value !== "object") return 1;
  if (Array.isArray(value)) return value.length || 1;
  let n = 0;
  for (const v of Object.values(value)) {
    n += countJsonLeaves(v);
  }
  return n;
}
function localeOf(path) {
  const ext = extname3(path);
  const base = basename3(path, ext);
  if (LOCALE_RE.test(base)) return base;
  const parts2 = path.split("/");
  const parent = parts2[parts2.length - 2];
  if (parent && LOCALE_RE.test(parent)) return parent;
  const grand = parts2[parts2.length - 3];
  if (parent && grand && I18N_DIR_RE.test(grand)) return parent;
  return base;
}
function keysIn(repo, f) {
  try {
    const raw = readFileSync15(join23(repo, f.path), "utf8");
    if (f.ext === ".json") return countJsonLeaves(JSON.parse(raw));
    return raw.split(/\r?\n/).filter((l) => /^[\s-]*[\w.-]+\s*:/.test(l) || /^msgid/.test(l)).length;
  } catch {
    return 0;
  }
}
function detectI18n(repo, files) {
  const i18nFiles = files.filter((f) => f.category === "i18n");
  if (i18nFiles.length === 0) return null;
  const locales = /* @__PURE__ */ new Set();
  const keysByLocale = /* @__PURE__ */ new Map();
  for (const f of i18nFiles) {
    const loc = localeOf(f.path);
    locales.add(loc);
    keysByLocale.set(loc, (keysByLocale.get(loc) ?? 0) + keysIn(repo, f));
  }
  const keyCount = Math.max(0, ...keysByLocale.values());
  return {
    locales: [...locales].sort(),
    files: i18nFiles.map((f) => f.path).sort(),
    keyCount
  };
}

// src/features.ts
var ROOTS = ["src/app/", "src/pages/", "src/components/", "src/lib/", "src/server/", "src/", "app/", "pages/", "lib/", "server/", "components/", "packages/"];
function stripRoot(path) {
  let p = path;
  for (const root of ROOTS) {
    if (p.startsWith(root)) {
      p = p.slice(root.length);
      break;
    }
  }
  return p.split("/");
}
function isSkippableSegment(seg) {
  return seg.startsWith("(") && seg.endsWith(")") || seg.startsWith("[") && seg.endsWith("]") || seg.startsWith("@");
}
function featureKey(path) {
  const segs = stripRoot(path);
  let i2 = 0;
  while (i2 < segs.length - 1 && isSkippableSegment(segs[i2])) {
    i2++;
  }
  if (segs.length - i2 <= 1) return "core";
  return segs[i2];
}
function routeKey(route) {
  const segs = route.split("/").filter(Boolean);
  let i2 = 0;
  while (i2 < segs.length && isSkippableSegment(segs[i2])) {
    i2++;
  }
  return segs[i2] ?? "core";
}
var NAME_OVERRIDES = {
  ui: "UI",
  api: "API",
  db: "DB",
  seo: "SEO",
  e2e: "E2E",
  trpc: "tRPC",
  i18n: "i18n",
  cms: "CMS",
  sdk: "SDK",
  cli: "CLI",
  url: "URL",
  ssr: "SSR",
  ssg: "SSG",
  graphql: "GraphQL"
};
function humanize(key) {
  if (key === "core") return "Core";
  const cleaned = key.replace(/^\[+\.{0,3}/, "").replace(/\]+$/, "").replace(/^\(+|\)+$/g, "");
  const override = NAME_OVERRIDES[cleaned.toLowerCase()];
  if (override) return override;
  return cleaned.replace(/[-_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c2) => c2.toUpperCase());
}
function slugify2(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}
var FOUNDATION_KEYS = /* @__PURE__ */ new Set([
  "core",
  "types",
  "type",
  "config",
  "env",
  "db",
  "database",
  "schema",
  "schemas",
  "model",
  "models",
  "entities",
  "prisma",
  "drizzle",
  "migrations",
  "style",
  "styles",
  "css",
  "theme",
  "ui",
  "components",
  "component",
  "lib",
  "libs",
  "util",
  "utils",
  "helpers",
  "hooks",
  "store",
  "stores",
  "state",
  "context",
  "providers",
  "server",
  "services",
  "service",
  "client",
  "api",
  "rpc",
  "trpc",
  "graphql",
  "gql",
  "auth",
  "middleware",
  "i18n",
  "locales"
]);
var TEST_KEYS = /* @__PURE__ */ new Set(["test", "tests", "__tests__", "spec", "specs", "e2e", "cypress", "playwright"]);
var FOUNDATION_ORDER = [
  "core",
  "types",
  "type",
  "config",
  "env",
  "db",
  "database",
  "schema",
  "schemas",
  "model",
  "models",
  "entities",
  "style",
  "styles",
  "css",
  "theme",
  "ui",
  "components",
  "component",
  "lib",
  "libs",
  "util",
  "utils",
  "helpers",
  "hooks",
  "store",
  "stores",
  "state",
  "context",
  "providers",
  "server",
  "services",
  "service",
  "client",
  "api",
  "rpc",
  "trpc",
  "graphql",
  "gql",
  "auth",
  "middleware",
  "i18n",
  "locales"
];
var SCHEMA_RANK = FOUNDATION_ORDER.indexOf("schema");
var WS_RANK_SPAN = 100;
var DATA_LAYER_KEYS = /* @__PURE__ */ new Set(["prisma", "drizzle", "migrations"]);
function foundationRank(key, hasSchema) {
  const i2 = FOUNDATION_ORDER.indexOf(key);
  if (i2 !== -1) return i2;
  if (DATA_LAYER_KEYS.has(key) || hasSchema) return SCHEMA_RANK;
  return Number.POSITIVE_INFINITY;
}
function orderFeatures(records) {
  records.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.size !== b.size) return b.size - a.size;
    return a.feature.name.localeCompare(b.feature.name);
  });
  return records.map((r, i2) => ({
    ...r.feature,
    slug: `${String(i2 + 1).padStart(2, "0")}-${r.feature.slug}`
  }));
}
function makeWsContext(workspaces, routes) {
  const lastSeg2 = (p) => p.split("/").pop() ?? p;
  const segCounts = /* @__PURE__ */ new Map();
  for (const ws of workspaces) {
    const seg = lastSeg2(ws.path);
    segCounts.set(seg, (segCounts.get(seg) ?? 0) + 1);
  }
  const shortOf = new Map(
    workspaces.map((ws) => {
      const seg = lastSeg2(ws.path);
      return [ws.path, (segCounts.get(seg) ?? 0) > 1 ? slugify2(ws.path) : seg];
    })
  );
  const appNames = new Set(routes.map((r) => r.workspace).filter((n) => Boolean(n)));
  const topoIndex = new Map(topoOrderWorkspaces(workspaces).map((name2, i2) => [name2, i2]));
  const dependedOn = new Set(workspaces.flatMap((ws) => ws.dependsOn ?? []));
  return {
    matcher: workspaceMatcher(workspaces),
    shortOf,
    appNames,
    topoIndex,
    dependedOn,
    groups: /* @__PURE__ */ new Map()
  };
}
function wsKeyFor(ctx, ws, innerPath) {
  const short = ctx.shortOf.get(ws.path);
  const key = ctx.appNames.has(ws.name) ? `${short}/${featureKey(innerPath)}` : `ws:${short}`;
  if (!ctx.groups.has(key)) {
    ctx.groups.set(key, {
      ws,
      ...ctx.appNames.has(ws.name) ? { inner: featureKey(innerPath) } : {}
    });
  }
  return key;
}
function buildFeatures(files, routes, i18n, granularity = "coarse", workspaces = []) {
  const ctx = workspaces.length ? makeWsContext(workspaces, routes) : null;
  const keyForFile = (path) => {
    const ws = ctx?.matcher(path);
    return ws ? wsKeyFor(ctx, ws, path.slice(ws.path.length + 1)) : featureKey(path);
  };
  const innerOf = (key) => ctx?.groups.get(key)?.inner ?? key;
  const isLibGroup = (key) => Boolean(ctx?.groups.get(key)) && !ctx?.groups.get(key)?.inner;
  const codeGroups = /* @__PURE__ */ new Map();
  const schemaPaths = /* @__PURE__ */ new Set();
  const configFiles = [];
  const docFiles = [];
  for (const f of files) {
    if (f.category === "schema") schemaPaths.add(f.path);
    if (f.category === "config") {
      configFiles.push(f.path);
    } else if (f.category === "doc") {
      docFiles.push(f.path);
    } else if (f.category === "code" || f.category === "test" || f.category === "style" || f.category === "schema") {
      const key = keyForFile(f.path);
      const list = codeGroups.get(key) ?? [];
      list.push(f.path);
      codeGroups.set(key, list);
    }
  }
  const routesByKey = /* @__PURE__ */ new Map();
  for (const r of routes) {
    const ws = ctx && r.workspace ? workspaces.find((w) => w.name === r.workspace) : void 0;
    const k = ws && ctx ? `${ctx.shortOf.get(ws.path)}/${routeKey(r.route)}` : routeKey(r.route);
    if (ws && ctx && !ctx.groups.has(k)) ctx.groups.set(k, { ws, inner: routeKey(r.route) });
    const list = routesByKey.get(k) ?? [];
    list.push(r);
    routesByKey.set(k, list);
  }
  const groupHasSchema = (groupFiles) => groupFiles.some((p) => schemaPaths.has(p));
  const isFoundationGroup = (key, groupFiles) => FOUNDATION_KEYS.has(innerOf(key)) || groupHasSchema(groupFiles);
  if (granularity === "coarse") {
    const foldTarget = (key) => {
      const group = ctx?.groups.get(key);
      if (!group?.inner) return "core";
      const short = ctx?.shortOf.get(group.ws.path);
      return `${short}/core`;
    };
    for (const [key, groupFiles] of [...codeGroups.entries()]) {
      if (key === "core" || innerOf(key) === "core" || isLibGroup(key)) continue;
      const routeCount = routesByKey.get(key)?.length ?? 0;
      const trivial = groupFiles.length === 1 && routeCount === 0 && !isFoundationGroup(key, groupFiles) && !TEST_KEYS.has(innerOf(key));
      if (trivial) {
        const target = foldTarget(key);
        if (target !== "core" && ctx && !ctx.groups.has(target)) {
          const group = ctx.groups.get(key);
          if (group) ctx.groups.set(target, { ws: group.ws, inner: "core" });
        }
        codeGroups.set(target, [...codeGroups.get(target) ?? [], ...groupFiles]);
        codeGroups.delete(key);
      }
    }
  }
  const records = [];
  for (const [key, groupFiles] of codeGroups.entries()) {
    const featureRoutes = routesByKey.get(key) ?? [];
    const wsGroup = ctx?.groups.get(key);
    const short = wsGroup ? ctx?.shortOf.get(wsGroup.ws.path) : "";
    const name2 = wsGroup ? wsGroup.inner ? `${humanize(short)} \xB7 ${humanize(wsGroup.inner)}` : humanize(short) + (wsGroup.ws.name !== short ? ` (${wsGroup.ws.name})` : "") : humanize(key);
    const slug = wsGroup ? wsGroup.inner ? slugify2(`${short}-${humanize(wsGroup.inner)}`) : slugify2(short) : slugify2(name2);
    const routeList = featureRoutes.map((r) => r.route);
    const uniqueRoutes = [...new Set(routeList)];
    const desc = `Groups ${groupFiles.length} file(s)` + (wsGroup ? ` in workspace \`${wsGroup.ws.path}\`` : "") + (uniqueRoutes.length ? `; routes: ${uniqueRoutes.slice(0, 6).join(", ")}` : "") + ".";
    const hasSchema = groupHasSchema(groupFiles);
    const topoBase = wsGroup ? (ctx?.topoIndex.get(wsGroup.ws.name) ?? 0) * WS_RANK_SPAN : 0;
    let tier;
    let rank;
    if (wsGroup && !wsGroup.inner) {
      const isDep = ctx?.dependedOn.has(wsGroup.ws.name) ?? false;
      tier = isDep ? 0 : 1;
      rank = topoBase;
    } else {
      const structuralKey = innerOf(key);
      tier = TEST_KEYS.has(structuralKey) ? 2 : isFoundationGroup(key, groupFiles) ? 0 : 1;
      rank = topoBase + (tier === 0 ? foundationRank(structuralKey, hasSchema) : 0);
    }
    records.push({
      feature: {
        slug,
        name: name2,
        description: desc,
        kind: "feature",
        files: groupFiles.sort(),
        routes: featureRoutes
      },
      key,
      tier,
      rank,
      size: groupFiles.length
    });
  }
  if (i18n) {
    records.push({
      feature: {
        slug: "internationalization",
        name: "Internationalization",
        description: `${i18n.locales.length} locale(s) (${i18n.locales.join(", ")}), up to ${i18n.keyCount} keys per locale.`,
        kind: "internationalization",
        files: i18n.files,
        routes: []
      },
      key: "i18n",
      tier: 0,
      rank: foundationRank("i18n", false),
      size: i18n.files.length
    });
  }
  if (configFiles.length) {
    records.push({
      feature: {
        slug: "project-setup",
        name: "Project Setup & Tooling",
        description: `${configFiles.length} configuration/tooling file(s): build, lint, env, CI.`,
        kind: "project-setup",
        files: configFiles.sort(),
        routes: []
      },
      key: "config",
      tier: 0,
      rank: foundationRank("config", false),
      size: configFiles.length
    });
  }
  if (docFiles.length) {
    records.push({
      feature: {
        slug: "documentation",
        name: "Documentation",
        description: `${docFiles.length} documentation file(s).`,
        kind: "documentation",
        files: docFiles.sort(),
        routes: []
      },
      key: "documentation",
      tier: 2,
      rank: 1,
      // docs sort after dedicated test buckets in the tail tier
      size: docFiles.length
    });
  }
  return orderFeatures(records);
}

// src/types.ts
var VERSION = "2.10.0";

// src/analyze.ts
var ROUTE_BEARING_FRAMEWORKS = /* @__PURE__ */ new Set([
  "Next.js",
  "Nuxt",
  "Remix",
  "React Router",
  "SvelteKit",
  "Astro",
  "Angular",
  "SolidStart",
  "NestJS",
  "Express",
  "Fastify",
  "Koa",
  "Hono",
  "Django",
  "Flask",
  "FastAPI",
  "Ruby on Rails",
  "Sinatra",
  "Laravel",
  "Symfony",
  "Spring Boot",
  "ASP.NET Core",
  "Gin",
  "Echo",
  "Fiber",
  "chi",
  "Gorilla"
]);
var NON_HTTP_SURFACE_FRAMEWORKS = /* @__PURE__ */ new Set(["Electron", "Tauri", "React Native", "Expo", "Flutter", "React", "Vue", "Svelte", "SolidJS"]);
var INFRA_SURFACE_CONFIGS = [
  "wrangler.toml",
  "wrangler.jsonc",
  "wrangler.json",
  "serverless.yml",
  "serverless.yaml",
  "template.yaml",
  "sst.config.ts",
  "netlify.toml"
];
function computeUnknowns(stack, routes, hints, workspaces, files) {
  const u = [];
  if (workspaces.length > 0) {
    u.push(
      "Monorepo: workspaces were detected (`workspaces[*]` carries each one's stack, dependencies, hints, and `dependsOn`) \u2014 verify each workspace's role (app / package / service) and extend the dependency graph with implicit edges (HTTP calls between apps, generated clients, shared env vars); deterministic edges come from manifest declarations only."
    );
  }
  if (stack.frameworks.length === 0) {
    u.push(
      "No web framework was detected from manifests \u2014 identify the stack from `stack.languages` + `dependencies`, find the entry points (`hints.entryPoints`, else the file tree), then map the interface surface manually. If there is no web framework because this is a library / CLI / SDK / engine, that is a first-class case: the interface surface is the exported public API plus the CLI commands, not routes \u2014 see `references/stack-guides/library-cli-sdk.md`."
    );
  }
  if (routes.length === 0) {
    const routeBearing = stack.frameworks.filter((f) => ROUTE_BEARING_FRAMEWORKS.has(f));
    const nonHttp = stack.frameworks.filter((f) => NON_HTTP_SURFACE_FRAMEWORKS.has(f));
    if (routeBearing.length > 0) {
      u.push(
        `No routes were resolved although ${routeBearing.join(", ")} was detected \u2014 the engine has no route adapter for it, or its routes are declared in a way static resolution cannot see. Build the interface surface by hand from the framework's own route configuration (see \`references/stack-guides/INDEX.md\` for the matching guide) into \`architecture/INTERFACES.md\`.`
      );
    } else if (nonHttp.length > 0) {
      u.push(
        `${nonHttp.join(", ")} exposes no HTTP routes \u2014 its interface surface is something else entirely (desktop IPC channels and the preload/command contract, mobile screens and navigation, or an exported component/module API). Enumerate that surface per its guide in \`references/stack-guides/INDEX.md\`, not a route table.`
      );
    } else if (hints.routeCandidates.length > 0 || hints.apiCandidates.length > 0) {
      u.push(
        "Routes were not resolved deterministically (a framework without a dedicated route adapter, or an RPC/GraphQL surface) \u2014 derive the real interface surface from `hints.routeCandidates` / `hints.apiCandidates` into `architecture/INTERFACES.md`."
      );
    }
  }
  const infra = [...new Set(files.map((f) => f.path.split("/").pop() ?? "").filter((n) => INFRA_SURFACE_CONFIGS.includes(n)))].sort();
  if (infra.length > 0) {
    u.push(
      `Serverless/edge infrastructure config was found (${infra.join(", ")}) \u2014 the invocable surface is declared THERE, not only in code: HTTP routes/patterns, cron triggers, queue consumers, event sources and their bindings. Enumerate it from the config first, then open each handler for its event/response contract (see \`references/stack-guides/serverless-edge.md\`).`
    );
  }
  if (hints.apiCandidates.length > 0) {
    u.push(
      "API surface candidates (tRPC / GraphQL / gRPC / OpenAPI) were found but not enumerated \u2014 read each and list every procedure/operation in `architecture/INTERFACES.md`."
    );
  }
  if (hints.schemaCandidates.length > 0) {
    u.push(
      "The data model is not structured by the engine \u2014 extract entities, fields, types, and relations from `hints.schemaCandidates` into `architecture/DATA-MODEL.md`."
    );
  }
  if (hints.realtimeCandidates.length > 0) {
    u.push(
      "Realtime/WebSocket signals were found \u2014 enumerate the channels, events, and message shapes from `hints.realtimeCandidates` in `architecture/INTERFACES.md`; they rarely appear in HTTP route tables."
    );
  }
  if (hints.authCandidates.length > 0) {
    u.push(
      "Auth/middleware signals were found \u2014 read `hints.authCandidates` and record the auth rule per operation in the `architecture/INTERFACES.md` interface table's Auth column."
    );
  }
  if (hints.designSystemCandidates.length > 0) {
    u.push(
      "Design-system source files were found (Tailwind/theme configs, token modules, global CSS) \u2014 capture the visual contract (tokens with their exact values, theming, typography, components, a11y) from `hints.designSystemCandidates` in `architecture/DESIGN-SYSTEM.md`."
    );
  }
  return u;
}
function analyze(opts) {
  const { files, excludedCount } = walk2(opts.repo, {
    include: opts.include,
    exclude: opts.exclude,
    out: opts.out
  });
  const warnings = [];
  let stack = detectStack(opts.repo, files, warnings);
  const workspaces = detectWorkspaces2(opts.repo, warnings);
  if (workspaces.length > 0) {
    buildWorkspaceGraph(opts.repo, workspaces, warnings);
    enrichWorkspaceStacks(opts.repo, workspaces, files, warnings);
    stack = mergeWorkspaceStacks(stack, workspaces);
    const cycle = findWorkspaceCycle(workspaces);
    if (cycle) {
      warnings.push(`workspace dependency cycle: ${cycle.join(" \u2192 ")} \u2014 the build order falls back to path order for these workspaces`);
    }
  }
  const dependencies = extractDependencies(opts.repo, files, warnings);
  const routes = detectRoutes(files, stack, opts.repo);
  const i18n = detectI18n(opts.repo, files);
  const schemas = collectByCategory(files, "schema");
  const configs = collectByCategory(files, "config");
  const docs = collectByCategory(files, "doc");
  const envVars = extractEnvVars(opts.repo, files);
  const scripts = extractScripts(opts.repo, warnings);
  const hints = detectCandidates(opts.repo, files, stack);
  if (workspaces.length > 0) {
    enrichWorkspaceSurface(workspaces, routes, hints, schemas);
  }
  const node = detectNodeVersion(opts.repo, warnings);
  const features = buildFeatures(files, routes, i18n, opts.granularity, workspaces);
  const unknowns = computeUnknowns(stack, routes, hints, workspaces, files);
  const uniqueWarnings = [...new Set(warnings)].sort();
  const totalLines = files.reduce((n, f) => n + f.lines, 0);
  const stylingLibraries = detectStylingLibraries(stack.libraries);
  return {
    generatedWith: `reconstruct@${VERSION}`,
    generation: {
      mode: opts.mode,
      level: opts.level,
      fidelity: opts.fidelity,
      granularity: opts.granularity
    },
    repoName: basename4(opts.repo) || "project",
    stack: stylingLibraries.length ? { ...stack, stylingLibraries } : stack,
    fileCount: files.length,
    totalLines,
    files,
    dependencies,
    routes,
    i18n,
    schemas,
    configs,
    docs,
    envVars,
    scripts,
    features,
    hints,
    unknowns,
    ...uniqueWarnings.length ? { warnings: uniqueWarnings } : {},
    ...workspaces.length ? { workspaces } : {},
    ...node ? { runtime: { node } } : {},
    excludedCount
  };
}

// src/prd/render.ts
import { join as join25 } from "path";

// src/prd/templates.ts
function agentNote(body2) {
  return `> \u{1F9E0} **For the AI agent:** ${body2}
`;
}
function metaBlock(inv, opts) {
  return [
    "| Setting | Value |",
    "| --- | --- |",
    `| Mode | \`${opts.mode}\` |`,
    `| Level | \`${opts.level}\` |`,
    `| Fidelity | \`${opts.fidelity}\` |`,
    ...opts.tdd ? ["| TDD | `on` (build test-first) |"] : [],
    `| Generated with | \`${inv.generatedWith}\` |`,
    ""
  ].join("\n");
}
function cell(value) {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
function filledInterfaceTable(rows) {
  const header = ["| Method / Trigger | Path / Operation | Kind | Auth | Notes |", "| --- | --- | --- | --- | --- |"];
  if (!rows.length) {
    return [...header, "", "_Add one row per operation as the surface takes shape._"].join("\n");
  }
  const body2 = rows.map((r) => `| ${cell(r.method)} | \`${cell(r.path)}\` | ${cell(r.kind ?? "")} | ${cell(r.auth ?? "")} | ${cell(r.notes ?? "")} |`);
  return [...header, ...body2].join("\n");
}
function filledEntityTables(entities) {
  if (!entities.length) return "_No entities yet \u2014 add them as the model takes shape._";
  const parts2 = [];
  for (const e of entities) {
    parts2.push(`### ${e.entity}`, "", "| Field | Type | Constraints |", "| --- | --- | --- |");
    if (e.fields.length) {
      for (const f of e.fields) {
        parts2.push(`| ${cell(f.name)} | ${cell(f.type)} | ${cell(f.constraints ?? "")} |`);
      }
    } else {
      parts2.push("| _tbd_ | | |");
    }
    parts2.push("");
    if (e.relations?.length) {
      parts2.push("Relations:", "");
      for (const r of e.relations) parts2.push(`- ${r}`);
      parts2.push("");
    }
    if (e.indexes?.length) {
      parts2.push("Indexes:", "");
      for (const ix of e.indexes) parts2.push(`- ${ix}`);
      parts2.push("");
    }
    if (e.uniques?.length) {
      parts2.push("Unique constraints:", "");
      for (const u of e.uniques) parts2.push(`- ${u}`);
      parts2.push("");
    }
  }
  return parts2.join("\n").trimEnd();
}
function enumsBlock(enums) {
  const lines = ["## Enums & domain types", ""];
  if (!enums || !enums.length) {
    lines.push("_No standalone enums. Every enum-typed field above must still enumerate its full member set inline (e.g. `ADMIN \\| USER`)._");
    return lines.join("\n");
  }
  for (const e of enums) {
    lines.push(`### ${e.name}`, "");
    if (e.description) lines.push(e.description, "");
    lines.push(`- Members: ${e.members.map((m) => `\`${m}\``).join(", ") || "_none \u2014 fill in_"}`, "");
  }
  return lines.join("\n").trimEnd();
}
function servicesBlock(services) {
  const lines = ["## External services & integrations", ""];
  for (const s of services) {
    lines.push(`### ${s.name}${s.provider ? ` (${s.provider})` : ""}`, "", s.purpose, "");
    if (s.operations?.length) {
      lines.push("Operations:", "");
      for (const op of s.operations) {
        lines.push(`- \`${op.name}\`${op.input ? ` \u2014 in: ${op.input}` : ""}${op.output ? ` \u2192 out: ${op.output}` : ""}`);
      }
      lines.push("");
    }
    if (s.request) lines.push(`- **Request:** ${s.request}`);
    if (s.response) lines.push(`- **Response:** ${s.response}`);
    if (s.timeout) lines.push(`- **Timeout:** ${s.timeout}`);
    if (s.onFailure) lines.push(`- **On failure:** ${s.onFailure}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
function policiesBlock(policies) {
  const lines = ["## Cross-cutting policies", "", "| Policy | Kind | Rule | Applies to |", "| --- | --- | --- | --- |"];
  for (const p of policies) {
    lines.push(`| ${cell(p.name)} | ${cell(p.kind ?? "")} | ${cell(p.rule)} | ${cell((p.appliesTo ?? []).join(", "))} |`);
  }
  return lines.join("\n");
}
function messageCatalogBlock(i18n) {
  const m = i18n.messages;
  const lines = ["## Internationalization \u2014 message catalog", ""];
  lines.push(`Locales: ${i18n.locales.join(", ")}.`, "");
  if (!m) {
    lines.push(
      agentNote(
        "Author the message catalog: list every namespace and every user-facing key with its source string, then translate into all locales above. A key without a source string is not buildable."
      )
    );
    return lines.join("\n").trimEnd();
  }
  if (m.sourceLocale) lines.push(`Source locale: \`${m.sourceLocale}\`.`, "");
  if (m.namespaces?.length) lines.push(`Namespaces: ${m.namespaces.map((n) => `\`${n}\``).join(", ")}.`, "");
  if (m.entries?.length) {
    lines.push("| Key | Source string |", "| --- | --- |");
    for (const e of m.entries) lines.push(`| \`${cell(e.key)}\` | ${cell(e.source ?? "")} |`);
    lines.push("");
  }
  lines.push(
    agentNote(
      `Complete the catalog: every user-facing key must have a source string and resolve in all ${i18n.locales.length} locales (${i18n.locales.join(", ")}). The keys above are the contract \u2014 extend, don't trim.`
    )
  );
  return lines.join("\n").trimEnd();
}
function operationContracts(rows) {
  const detailed = rows.filter((r) => r.input || r.output || r.sideEffects && r.sideEffects.length);
  if (!detailed.length) return "";
  const lines = ["## Operation contracts", ""];
  for (const r of detailed) {
    lines.push(`### \`${r.path}\`${r.auth ? ` \xB7 auth: ${r.auth}` : ""}`, "");
    if (r.input) lines.push(`- **Input:** ${r.input}`);
    if (r.output) lines.push(`- **Output:** ${r.output}`);
    if (r.sideEffects?.length) lines.push(`- **Side effects:** ${r.sideEffects.join("; ")}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
function overviewPrd(inv, opts) {
  const isScratch = opts.mode === "scratch";
  const s = inv.stack;
  const featureIndex = inv.features.map((f) => `- [\`${f.slug}\`](../features/${f.slug}/PRD.md) \u2014 **${f.name}**: ${f.description}`).join("\n");
  const productSummary = isScratch ? [
    inv.product?.summary ?? "",
    ...inv.product?.audience ? ["", `**Audience:** ${inv.product.audience}`] : [],
    ...inv.product?.value ? ["", `**Core value:** ${inv.product.value}`] : [],
    "",
    agentNote("Expand this into a 1\u20132 paragraph product summary grounded in `../CONTEXT.md` (the glossary) and the feature list below.")
  ].join("\n") : opts.level === "complex" ? agentNote(
    "Write a 1\u20132 paragraph product summary: what this project does, for whom, and the core value. Infer it from the README, routes, and feature names below, then refine."
  ) : "_Summarize what this project does, derived from the README and the feature list below._";
  const out2 = [
    `# ${inv.repoName} \u2014 Reconstruction Overview`,
    "",
    metaBlock(inv, opts),
    "## Product summary",
    "",
    productSummary,
    "",
    "## Tech stack",
    "",
    `- **Primary language:** ${s.primaryLanguage}`,
    `- **Languages:** ${s.languages.join(", ") || "n/a"}`,
    `- **Frameworks:** ${s.frameworks.join(", ") || "none detected"}`,
    `- **Libraries:** ${s.libraries.join(", ") || "none detected"}`,
    `- **Package managers:** ${s.packageManagers.join(", ") || "n/a"}`,
    `- **TypeScript:** ${s.hasTypeScript ? "yes" : "no"}`,
    "",
    "## Metrics",
    "",
    isScratch ? `- Files: **0** \u2014 greenfield (designed from the interview, not read from source)` : `- Files analyzed: **${inv.fileCount}** (${inv.totalLines} lines)`,
    `- Features/modules: **${inv.features.length}**`,
    `- Routes: **${inv.routes.length}**`,
    `- Locales: **${inv.i18n ? inv.i18n.locales.length : 0}**`,
    `- Tracked env vars: **${inv.envVars.length}**`,
    "",
    "## Feature index",
    "",
    featureIndex || "_No features detected._",
    "",
    "## How to use this output",
    "",
    ...isScratch ? [
      "1. Read `../CONTEXT.md` (the glossary) and the decisions in `../docs/adr/` \u2014 they are the ground truth for terminology and constraints.",
      "2. Read `architecture/ARCHITECTURE.md`, then the pre-filled `architecture/INTERFACES.md` and `architecture/DATA-MODEL.md` (refine them).",
      "3. Build feature by feature using each `features/<slug>/PRD.md`, in the order listed in `REBUILD.md`."
    ] : [
      "1. Read `architecture/ARCHITECTURE.md` for the overall shape, then `architecture/INTERFACES.md` (the full interface surface) and `architecture/DATA-MODEL.md` (entities & relations).",
      "2. Rebuild feature by feature using each `features/<slug>/PRD.md`, in the order listed in `REBUILD.md`.",
      "3. Use `data/` (translations, schema, config) and \u2014 when present \u2014 `source/` as ground truth."
    ],
    ""
  ];
  if (opts.mode === "redesign") {
    out2.push(
      "## Redesign note",
      "",
      agentNote(
        "This run is in **redesign** mode: preserve every feature's behavior and logic, but you are free to propose a cleaner architecture in `architecture/ARCHITECTURE.md`."
      ),
      ""
    );
  }
  return out2.join("\n");
}
function workspacesBlock(workspaces) {
  const rows = workspaces.map((w) => {
    const stack = [...w.stack?.frameworks ?? [], ...w.stack?.frameworks?.length ? [] : [w.stack?.primaryLanguage ?? "\u2014"]].join(", ");
    return `| \`${w.name}\` | \`${w.path}/\` | ${w.kind ?? "\u2014"} | ${stack || "\u2014"} | ${w.dependsOn?.map((d) => `\`${d}\``).join(", ") || "\u2014"} | ${w.routeCount ?? 0} |`;
  });
  return [
    "## Workspaces",
    "",
    "| Workspace | Path | Kind | Stack | Depends on | Routes |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    agentNote(
      "Verify each workspace's role (app / package / service) and **extend the dependency graph**: the `Depends on` column carries manifest-declared edges only \u2014 add the implicit ones (HTTP calls between apps, generated clients, shared env vars, queues) and draw the result in `diagram.md`. Map each shared package once and reference it from the apps that consume it."
    )
  ].join("\n");
}
function architectureDoc(inv, opts) {
  const isScratch = opts.mode === "scratch";
  const topDirs = [...new Set(inv.files.filter((f) => f.path.includes("/")).map((f) => f.path.split("/")[0]))].sort();
  const rootFiles = inv.files.filter((f) => !f.path.includes("/")).map((f) => f.path).sort();
  const deps = inv.dependencies.map((d) => `- **${d.manager}** (\`${d.manifest}\`): ${Object.keys(d.runtime).length} runtime, ${Object.keys(d.dev).length} dev`).join("\n");
  const common = [
    `# Architecture`,
    "",
    metaBlock(inv, opts),
    "## Detected stack",
    "",
    `${inv.stack.frameworks.join(", ") || "No framework detected"} \xB7 ${inv.stack.primaryLanguage}`,
    "",
    ...inv.stack.libraries.length ? [`**Libraries:** ${inv.stack.libraries.join(", ")}`, ""] : [],
    "## Top-level layout",
    "",
    (topDirs.map((d) => `- \`${d}/\``).join("\n") || "_Flat layout (no subdirectories)._") + (rootFiles.length ? `
- root files: ${rootFiles.map((f) => `\`${f}\``).join(", ")}` : ""),
    "",
    ...inv.workspaces?.length ? [workspacesBlock(inv.workspaces), ""] : [],
    "## Dependencies",
    "",
    deps || "_No dependency manifests found._",
    "",
    "## Data & schema",
    "",
    inv.schemas.length ? inv.schemas.map((s) => `- \`${s}\``).join("\n") : "_No schema/model files detected._",
    "",
    "## Internationalization",
    "",
    inv.i18n ? isScratch ? `Locales: ${inv.i18n.locales.join(", ")} \u2014 provide a messages file per locale (see the message catalog below).` : `Locales: ${inv.i18n.locales.join(", ")} \u2014 files copied to \`data/translations/\`.` : "_No i18n detected._",
    "",
    // External services & cross-cutting policies — rendered from the plan in
    // scratch mode, demanded via callouts otherwise. Both are buildability gaps
    // when left implicit (a named "geocoding" with no contract isn't rebuildable).
    ...isScratch && inv.services?.length ? [servicesBlock(inv.services), ""] : [
      "## External services & integrations",
      "",
      agentNote(
        "List **every** external service the project calls (payment, email, geocoding, storage, analytics, queues, third-party APIs). For each: provider, the exact request/response shape, timeout, and what happens on failure (best-effort? hard error?). Naming the service is not enough \u2014 capture the contract."
      ),
      ""
    ],
    ...isScratch && inv.policies?.length ? [policiesBlock(inv.policies), ""] : [
      "## Cross-cutting policies",
      "",
      agentNote(
        "Capture every cross-cutting rule that is otherwise left vague: rate limits (exact thresholds, window, key, store), format validations (e.g. national registry numbers \u2014 give the regex/checksum/length), and security policies. Each rule must be concrete enough to write a test against."
      ),
      ""
    ],
    ...isScratch && inv.i18n ? [messageCatalogBlock(inv.i18n), ""] : []
  ];
  if (isScratch) {
    common.push(
      "## Architecture (greenfield)",
      "",
      agentNote(
        "Design the architecture that delivers the features below. Decide module boundaries, data flow, and folder structure. Ground every decision in `../CONTEXT.md` (the glossary) and the ADRs in `../docs/adr/`. Document the proposed structure here as a directory tree plus a short rationale per module."
      ),
      ""
    );
    if (opts.level === "complex") {
      common.push(
        agentNote(
          "Also sketch 1\u20132 alternative architectures you considered and why you rejected them, and note enhancements beyond the MVP that the structure should leave room for."
        ),
        ""
      );
    }
  } else if (opts.mode === "preserve") {
    common.push(
      "## Reconstruction guidance (preserve)",
      "",
      "Reproduce the structure above as-is. Keep the same directory layout, framework, routing strategy, and data layer.",
      ""
    );
    if (opts.level === "complex") {
      common.push(
        agentNote(
          "While preserving the architecture, list any low-risk, high-value improvements (typing, error handling, test coverage) the rebuild should fold in."
        ),
        ""
      );
    }
  } else {
    common.push(
      "## Proposed architecture (redesign)",
      "",
      agentNote(
        "Design a fresh architecture that delivers the SAME features and logic. Decide module boundaries, data flow, and folder structure. Justify changes against the detected stack above. Keep behavior identical; improve structure, testability, and clarity."
      ),
      "",
      "Document the proposed structure here as a directory tree plus a short rationale per module.",
      ""
    );
  }
  return common.join("\n");
}
function listOrNone(items, empty) {
  return items.length ? items.map((s) => `- \`${s}\``).join("\n") : empty;
}
function interfacesDoc(inv, opts) {
  if (opts.mode === "scratch") {
    return [
      "# Interface surface",
      "",
      metaBlock(inv, opts),
      agentNote(
        "Design the complete interface surface from the interview & `../CONTEXT.md`. The table below is pre-filled from the plan \u2014 keep the columns, refine each row, and add any operation that's missing (HTTP routes, REST/JSON endpoints, tRPC/gRPC procedures, GraphQL operations, CLI commands, scheduled jobs, queues, webhooks)."
      ),
      "",
      "## Interface table",
      "",
      filledInterfaceTable(inv.interfaces ?? []),
      "",
      ...operationContracts(inv.interfaces ?? []) ? [operationContracts(inv.interfaces ?? []), ""] : [],
      agentNote(
        "Every operation needs an exact contract before it is buildable: the input shape (fields + types + validation), the output shape, the auth/permission rule, and the side effects (which entities it writes \u2014 and whether the write is transactional). Spell these out per operation; link shapes to `DATA-MODEL.md`."
      ),
      ""
    ].join("\n");
  }
  const routesTable = inv.routes.length ? [
    "| Method | Kind | Route | Handler file |",
    "| --- | --- | --- | --- |",
    ...inv.routes.map((r) => `| ${r.method ?? "\u2014"} | ${r.kind} | \`${r.route}\` | \`${r.file}\` |`)
  ].join("\n") : "_None resolved deterministically \u2014 read the candidate files below to map the surface._";
  const routeCandidates = /* @__PURE__ */ new Set([...inv.hints.routeCandidates]);
  for (const r of inv.routes) routeCandidates.delete(r.file);
  return [
    "# Interface surface",
    "",
    metaBlock(inv, opts),
    agentNote(
      "Enumerate **every** interface this project exposes \u2014 HTTP routes, REST/JSON endpoints, tRPC/gRPC procedures, GraphQL operations, CLI commands, scheduled jobs, queues, and webhooks. The deterministic engine resolves routes for the supported frameworks (Next.js, Express, Fastify, Hono, Flask, FastAPI, NestJS, Django, Rails, Go); for everything else, **read the candidate files below** and follow `references/analysis-playbook.md` (\xA7Interface surface) plus the matching guide in `references/stack-guides/`. Fill the target table with one row per operation."
    ),
    "",
    "## Resolved routes (deterministic \u2014 verify against source)",
    "",
    routesTable,
    "",
    "## Route candidates (verify \u2014 may include false positives)",
    "",
    listOrNone([...routeCandidates].sort(), "_No additional route candidates._"),
    "",
    "## API surface candidates (tRPC / GraphQL / gRPC / OpenAPI)",
    "",
    listOrNone(inv.hints.apiCandidates, "_No RPC/GraphQL/OpenAPI candidates detected._"),
    "",
    "## Realtime / WebSocket candidates (verify)",
    "",
    listOrNone(inv.hints.realtimeCandidates, "_No realtime/WebSocket signals detected._"),
    "",
    "## Auth / middleware candidates (verify)",
    "",
    listOrNone(inv.hints.authCandidates, "_No auth/middleware signals detected \u2014 still record the auth rule per operation below._"),
    "",
    "## Interface table (fill this in)",
    "",
    "| Method / Trigger | Path / Operation | Kind | Handler file | Auth | Notes |",
    "| --- | --- | --- | --- | --- | --- |",
    "",
    opts.level === "light" ? "_Keep these columns; add one row per route / endpoint / procedure / command / job. Cover the whole surface, not just the candidates above._" : agentNote(
      "Keep these columns; add a row per operation. Note auth/permission requirements, input/output shapes (link to `DATA-MODEL.md`), and side effects."
    ),
    ""
  ].join("\n");
}
function dataModelDoc(inv, opts) {
  if (opts.mode === "scratch") {
    return [
      "# Data model",
      "",
      metaBlock(inv, opts),
      agentNote(
        "Design the complete data model from the interview & `../CONTEXT.md`. The entities below are pre-filled from the plan \u2014 refine fields, types, constraints, and relations, and add anything missing. Capture primary keys, foreign keys, enums, defaults, and indexes."
      ),
      "",
      "## Entities",
      "",
      filledEntityTables(inv.dataModel ?? []),
      "",
      "## Relations & integrity",
      "",
      "_Summarize relationships, cascade rules, and any derived/computed data._",
      "",
      enumsBlock(inv.enums),
      ""
    ].join("\n");
  }
  const schemaFiles = [.../* @__PURE__ */ new Set([...inv.schemas, ...inv.hints.schemaCandidates])].sort();
  return [
    "# Data model",
    "",
    metaBlock(inv, opts),
    agentNote(
      "Reconstruct the data model from the schema/ORM files below (raw copies live in `data/schema/`). List **every** entity/table with its key fields + types, relations (1-1 / 1-N / N-N), and indexes/constraints. Follow `references/analysis-playbook.md` (\xA7Data model) and the ORM conventions in the matching `references/stack-guides/`."
    ),
    "",
    "## Schema / model source files",
    "",
    listOrNone(schemaFiles, "_No schema/model files detected \u2014 the data layer may be code-defined; investigate `hints`._"),
    "",
    "## Entities (fill this in)",
    "",
    "| Entity / Table | Field | Type | Constraints | Relation |",
    "| --- | --- | --- | --- | --- |",
    "",
    opts.level === "light" ? "_Keep these columns; one block of rows per entity. Capture primary keys, foreign keys, enums, defaults, and indexes._" : agentNote(
      "Keep these columns; for each entity capture fields + types, PK/FK, enums, defaults, indexes, and how it maps to the interfaces in `INTERFACES.md`."
    ),
    "",
    "## Relations & integrity",
    "",
    "_Summarize relationships, cascade rules, and any derived/computed data._",
    "",
    "## Enums & domain types",
    "",
    agentNote(
      "Enumerate **every** domain enum / fixed value set this schema uses \u2014 each with its **complete** member list (e.g. roles, statuses, categories). A field typed `enum`/`status`/`type` whose members are not listed here is not buildable: a fresh agent cannot validate it or write the test."
    ),
    ""
  ].join("\n");
}
function tokenList(label, items) {
  if (!items || !items.length) return [];
  return [`**${label}:**`, "", ...items.map((t) => `- \`${cell(t)}\``), ""];
}
function componentTable(components) {
  if (!components.length) return [];
  const lines = ["### Component library", "", "| Component | Source | Variants | States |", "| --- | --- | --- | --- |"];
  for (const c2 of components) {
    lines.push(`| ${cell(c2.name)} | ${cell(c2.source ?? "")} | ${cell((c2.variants ?? []).join(", "))} | ${cell((c2.states ?? []).join(", "))} |`);
  }
  lines.push("");
  return lines;
}
function filledDesignSystem(ds) {
  const parts2 = [];
  if (ds.brand) parts2.push("### Brand identity", "", ds.brand, "");
  if (ds.tokens) {
    const t = ds.tokens;
    const tokenLines = [
      ...tokenList("Colors", t.colors),
      ...tokenList("Typography scale", t.typographyScale),
      ...tokenList("Spacing", t.spacing),
      ...tokenList("Sizing", t.sizing),
      ...tokenList("Radii", t.radii),
      ...tokenList("Shadows", t.shadows),
      ...tokenList("z-index", t.zIndex)
    ];
    if (tokenLines.length) parts2.push("### Design tokens", "", ...tokenLines);
  }
  if (ds.theme) {
    const th = ds.theme;
    const lines = ["### Theming", ""];
    if (th.modes?.length) lines.push(`- **Modes:** ${th.modes.map((m) => `\`${m}\``).join(", ")}`);
    if (th.scheme) lines.push(`- **Scheme:** ${th.scheme}`);
    if (th.default) lines.push(`- **Default:** ${th.default}`);
    if (th.notes) lines.push(`- ${th.notes}`);
    lines.push("");
    parts2.push(...lines);
  }
  if (ds.typography) {
    const ty = ds.typography;
    const lines = ["### Typography", ""];
    if (ty.families?.length) lines.push(`- **Families:** ${ty.families.map((f) => `\`${f}\``).join(", ")}`);
    if (ty.weights?.length) lines.push(`- **Weights:** ${ty.weights.map((w) => `\`${w}\``).join(", ")}`);
    if (ty.loading) lines.push(`- **Loading:** ${ty.loading}`);
    lines.push("");
    parts2.push(...lines);
  }
  if (ds.breakpoints?.length) {
    parts2.push("### Breakpoints", "", ...ds.breakpoints.map((b) => `- \`${cell(b)}\``), "");
  }
  if (ds.iconography) parts2.push("### Iconography", "", ds.iconography, "");
  if (ds.motion) {
    const mo = ds.motion;
    const lines = ["### Motion & animation", ""];
    if (mo.durations?.length) lines.push(`- **Durations:** ${mo.durations.map((d) => `\`${d}\``).join(", ")}`);
    if (mo.easings?.length) lines.push(`- **Easings:** ${mo.easings.map((e) => `\`${e}\``).join(", ")}`);
    if (mo.reducedMotion) lines.push(`- **prefers-reduced-motion:** ${mo.reducedMotion}`);
    lines.push("");
    parts2.push(...lines);
  }
  if (ds.components?.length) parts2.push(...componentTable(ds.components));
  if (ds.a11y) {
    const a = ds.a11y;
    const lines = ["### Accessibility", ""];
    if (a.target) lines.push(`- **Target:** ${a.target}`);
    for (const r of a.requirements ?? []) lines.push(`- ${r}`);
    lines.push("");
    parts2.push(...lines);
  }
  return parts2.join("\n").trimEnd() || "_No design tokens captured yet._";
}
function designSystemDoc(inv, opts) {
  const head = ["# Design system", "", metaBlock(inv, opts)];
  if (!hasUI(inv)) {
    return [
      ...head,
      "_No UI or styling surface was detected \u2014 this project has no design-system contract. If that is wrong (a UI lives here the engine did not detect), capture the design tokens, theming, typography, components, and the accessibility target here._",
      ""
    ].join("\n");
  }
  const isScratch = opts.mode === "scratch";
  const lead = isScratch ? agentNote(
    "Design the system from the interview's brand/design inputs and `../CONTEXT.md`. Capture every design token with its **exact value**, the theming scheme, typography, breakpoints, iconography, motion, the component-library contract (each primitive's variants and states), and the accessibility target. Any blocks below are pre-filled from the plan \u2014 refine and complete them."
  ) : opts.mode === "redesign" ? agentNote(
    "Keep the **brand identity** (logo, voice, the core palette's intent) but you may refresh the system. Record the brand invariants that must survive, then the new/updated tokens, theming, typography, components, and the accessibility target."
  ) : agentNote(
    "Reproduce the existing design system **verbatim**. Copy every token value exactly \u2014 colors as exact hex/oklch, the type scale, spacing, sizing, radii, shadows, z-index, and breakpoints \u2014 from the source files listed below; never round, rename, or approximate. Then capture theming (light/dark, the CSS-variable names), typography (font families + weights + how they load), iconography, motion (durations, easing, and the `prefers-reduced-motion` behavior), the component-library contract (each primitive's variants and the states it must render \u2014 default / hover / focus / disabled / loading / empty / error), and the accessibility target (WCAG level, keyboard nav, focus management, contrast minimums, ARIA)."
  );
  const out2 = [...head, lead, ""];
  if (!isScratch) {
    out2.push(
      "## Design-system source files",
      "",
      listOrNone(inv.hints.designSystemCandidates, "_No design-system config/token files detected \u2014 capture tokens from the component and CSS files._"),
      ""
    );
  }
  if (inv.designSystem) {
    out2.push("## Captured design system", "", filledDesignSystem(inv.designSystem), "");
  } else {
    out2.push(
      "## Design tokens",
      "",
      agentNote(
        "Capture every token with its **exact value**: the color palette (exact hex/oklch per role + scale step), the typography scale (size / line-height per step), spacing, sizing, radii, shadows, and z-index layers. A token named but not valued (`primary` with no hex) is not buildable."
      ),
      "",
      "## Theming",
      "",
      agentNote(
        "Document the theme modes (light / dark / system), how they are expressed (CSS variables on `:root`/`.dark`, a `data-theme` attribute, a class), the default and how it is chosen/persisted, and the per-theme token overrides."
      ),
      "",
      "## Typography",
      "",
      agentNote(
        "Font families and their roles, the weights loaded, and how fonts load (`next/font`, `@font-face`, a Google Fonts link, self-hosted) including the fallback stack."
      ),
      "",
      "## Breakpoints & responsive",
      "",
      agentNote("The named breakpoints with their exact values and the layout/grid strategy (mobile-first vs desktop-first, container queries)."),
      "",
      "## Iconography",
      "",
      agentNote("The icon set / library, the sizing and stroke conventions, and how icons are colored and used."),
      "",
      "## Motion & animation",
      "",
      agentNote("The duration and easing tokens, the standard transitions, and how `prefers-reduced-motion` is honored."),
      "",
      "## Component library",
      "",
      "| Component | Source | Variants | States |",
      "| --- | --- | --- | --- |",
      "",
      agentNote(
        "Contract every shared/owned primitive: its variants, the states it must render (default / hover / focus / disabled / loading / empty / error), the props, and which tokens it consumes. A component named but not contracted (`Button`, `Card`) cannot be rebuilt to a fixed spec."
      ),
      "",
      "## Accessibility",
      "",
      agentNote(
        "The WCAG conformance target (A / AA / AAA), the keyboard-navigation and focus-management rules, contrast minimums, and the required ARIA roles/labels per component state."
      ),
      ""
    );
  }
  return out2.join("\n");
}
function diagramDoc(inv) {
  const nodes = inv.features.map((f, i2) => `  F${i2}["${f.name}"]`).join("\n");
  const dataNode = inv.i18n || inv.schemas.length ? '  DATA[("Data / i18n / schema")]' : "";
  const edges = inv.features.filter((f) => f.kind === "feature").map((f, i2) => inv.i18n ? `  F${i2} --> DATA` : "").filter(Boolean).join("\n");
  const workspaceGraph = inv.workspaces?.length ? [
    "",
    "## Workspace graph",
    "",
    "Manifest-declared dependencies between workspaces (verify and extend with implicit edges).",
    "",
    "```mermaid",
    "graph TD",
    ...inv.workspaces.map((w, i2) => `  W${i2}["${w.name}"]`),
    ...inv.workspaces.flatMap(
      (w, i2) => (w.dependsOn ?? []).map((dep) => {
        const j = inv.workspaces?.findIndex((x) => x.name === dep) ?? -1;
        return j >= 0 ? `  W${i2} --> W${j}` : "";
      })
    ).filter(Boolean),
    "```",
    ""
  ] : [""];
  return ["# Module diagram", "", "```mermaid", "graph TD", nodes, dataNode, edges, "```", ...workspaceGraph].join("\n");
}
function featurePrd(inv, feature, opts, sourceMarkdown) {
  const isScratch = opts.mode === "scratch";
  const truth = isScratch ? "the interview & `../../CONTEXT.md`" : "the source material below";
  const out2 = [
    `# ${feature.name}`,
    "",
    `> Unit \`${feature.slug}\` \xB7 kind: ${feature.kind}`,
    "",
    "## Summary",
    "",
    feature.description,
    "",
    "## Context & goal",
    "",
    agentNote(
      `State this unit's user-facing goal in 1\u20132 sentences (the outcome a user gets), and name the other units it depends on and that depend on it. Derive it from ${truth}.`
    ),
    "",
    "## User stories",
    "",
    agentNote(
      "Enumerate **every** actor and what they need, one line each \u2014 `As a <role>, I can <action> so that <value>.` Be **exhaustive**: cover every role and every distinct behaviour, not just the happy path. This list is the backbone of the PRD; nothing below should exist without a story above it."
    ),
    "",
    "## Functional requirements",
    "",
    agentNote(
      `Turn the stories into a **numbered** checklist of precise, testable behaviours, derived from ${truth}. Cover happy paths, every edge case, every validation rule, and every error state. Leave nothing as "etc." or "and so on" \u2014 if you write a placeholder, you are not done. Tag each requirement \`[confirmed]\` (read directly in the source), \`[inferred]\` (pattern-derived, no false certainty), or \`[gap]\` (needs a human) so the \`--verify\` pass can adjudicate its confidence faster.`
    ),
    ""
  ];
  if (feature.routes.length) {
    out2.push("## Routes", "", "| Method | Route | Kind | File |", "| --- | --- | --- | --- |");
    for (const r of feature.routes) {
      out2.push(`| ${r.method ?? "\u2014"} | \`${r.route}\` | ${r.kind} | \`${r.file}\` |`);
    }
    out2.push("");
  }
  out2.push("## Interfaces & data", "");
  if (feature.interfaces?.length) {
    out2.push(`- **Operations:** ${feature.interfaces.map((i2) => `\`${i2}\``).join(", ")}`);
  }
  if (feature.entities?.length) {
    out2.push(`- **Entities:** ${feature.entities.map((e) => `\`${e}\``).join(", ")}`);
  }
  if (feature.writes?.length) {
    out2.push(`- **Writes:** ${feature.writes.map((e) => `\`${e}\``).join(", ")}`);
  }
  if (feature.interfaces?.length || feature.entities?.length || feature.writes?.length) out2.push("");
  out2.push(
    agentNote(
      "List **every** operation this unit exposes with its input/output shape (link `../../architecture/INTERFACES.md`), and **every** entity it reads or writes (link `../../architecture/DATA-MODEL.md`). Spell out the **write contract** for each mutation: which entities are written, whether the write is transactional, and \u2014 for every required (NOT NULL, no-default) column and foreign key \u2014 where the value comes from. A public/anonymous operation cannot satisfy an owner foreign key: it must write to an anonymous-capable entity instead. Every enum/domain value it accepts must be one of the members enumerated in `DATA-MODEL.md`."
    ),
    ""
  );
  if (hasUI(inv)) {
    out2.push(
      agentNote(
        "For any UI this unit renders, conform to `../../architecture/DESIGN-SYSTEM.md`: use its design tokens (no hard-coded colors / spacing / typography), build on the component-library primitives (with their variants and the states empty / loading / error), and meet its accessibility target (keyboard, focus, contrast, ARIA)."
      ),
      ""
    );
  }
  out2.push(
    "## Acceptance criteria",
    "",
    agentNote(
      'Write **Given / When / Then** scenarios that gate "done" \u2014 at least one per functional requirement, **including** the failure paths. Example: `Given an unauthenticated visitor, When they POST a todo, Then the API responds 401 and writes nothing.` These scenarios are the spec the rebuild is verified against.'
    ),
    "",
    "## Edge cases & failure modes",
    "",
    agentNote(
      "Enumerate what can go wrong and the expected behaviour for each: invalid / empty / oversized input, auth & permission failures, concurrency / race conditions, missing or slow dependencies, partial failures, and idempotency / retries. Each row here should map to an error-path requirement above."
    ),
    ""
  );
  if (opts.tdd) {
    out2.push(
      "## Test plan (write these first)",
      "",
      agentNote(
        "Before writing any implementation, turn the functional requirements and acceptance criteria above into failing tests (red): one per behaviour \u2014 happy paths, edge cases, validation, and error states. Implement only enough to make them pass (green), then refactor. List the test cases here as a checklist."
      ),
      ""
    );
  }
  if (isScratch) {
    out2.push(
      "## Design inputs",
      "",
      agentNote(
        "Build this unit greenfield. Ground every decision in `../../CONTEXT.md` (the glossary), the operations in `../../architecture/INTERFACES.md`, and the entities in `../../architecture/DATA-MODEL.md`."
      ),
      ""
    );
  } else {
    out2.push("## Source material", "", sourceMarkdown, "");
  }
  if (opts.level === "complex") {
    out2.push(
      isScratch ? "## Enhancements & alternatives" : "## Improvements & refactors",
      "",
      isScratch ? agentNote(
        "Propose enhancements beyond the MVP for this unit and note any alternative approaches worth considering, each marked `[post-MVP]` so the core build stays lean."
      ) : agentNote(
        "Propose concrete improvements for this unit: better types, dead-code removal, performance, accessibility, security, and tests. Mark each as `[keep-behavior]` so the rebuild stays functionally identical unless the user opts in."
      ),
      ""
    );
  }
  if (opts.mode === "redesign") {
    out2.push(
      "## Redesign notes",
      "",
      agentNote(
        "Map this unit onto the new architecture from `architecture/ARCHITECTURE.md`. Note where its files should live and which interfaces it exposes."
      ),
      ""
    );
  }
  out2.push(
    "## Definition of done",
    "",
    "- [ ] Every functional requirement is implemented and covered by a test.",
    "- [ ] Every acceptance-criteria scenario passes (including the failure paths).",
    "- [ ] Every operation this unit owns in `architecture/INTERFACES.md` responds correctly.",
    "- [ ] Every entity it writes matches `architecture/DATA-MODEL.md` (fields, types, constraints).",
    "- [ ] Every write is satisfiable against the schema: no required (NOT NULL, no-default) column or foreign key is left unfilled; anonymous/public operations write only to anonymous-capable entities (no owner FK).",
    "- [ ] Every enum/domain value this unit uses is one of the members fully enumerated in `architecture/DATA-MODEL.md`.",
    "- [ ] Every edge case & failure mode above is handled.",
    ...inv.i18n ? ["- [ ] Every user-facing string has a source string in the message catalog and resolves in every locale (no missing keys, no hard-coded copy)."] : [],
    "- [ ] `node scripts/analyze.mjs --check --out <out>` passes \u2014 no unresolved agent callouts or placeholders, and every reference resolves.",
    ""
  );
  return out2.join("\n");
}
function rebuildDoc(inv, opts) {
  const isScratch = opts.mode === "scratch";
  const order = inv.features.map((f, i2) => `${i2 + 1}. [ ] **${f.name}** \u2192 \`features/${f.slug}/PRD.md\``).join("\n");
  const modeBlurb = opts.mode === "preserve" ? "keep the current architecture" : isScratch ? "build the project from the interview/plan (greenfield)" : "design a new architecture for the same features";
  const procedure = [
    isScratch ? "1. Read `00-overview/PRD.md`, `CONTEXT.md` (the glossary), and the decisions in `docs/adr/`, then `architecture/ARCHITECTURE.md`, `architecture/INTERFACES.md`, and `architecture/DATA-MODEL.md`." : "1. Start with `00-overview/PRD.md`, `architecture/ARCHITECTURE.md`, `architecture/INTERFACES.md`, and `architecture/DATA-MODEL.md`.",
    opts.tdd ? "2. For each unit in order: write its failing acceptance tests first (red), implement until they pass (green), then refactor." : "2. For each unit in order, open its PRD and implement it.",
    isScratch ? "3. Ground terminology and decisions in `CONTEXT.md` and `docs/adr/`; cross-reference `INTERFACES.md` and `DATA-MODEL.md`." : "3. Wire shared data from `data/` (translations, schema, config).",
    opts.fidelity === "mirror" ? "4. Use the copied files under `source/<slug>/` as ground truth." : "4. Validate behavior against the requirements in each PRD.",
    isScratch ? "5. Run your test suite, typecheck, and linter to verify each unit before moving on." : "5. Run the project's own scripts to verify: " + (Object.keys(inv.scripts).length ? Object.keys(inv.scripts).slice(0, 6).map((s) => `\`${s}\``).join(", ") : "_no scripts detected_") + "."
  ];
  const checklist = [
    "- [ ] Every interface in `architecture/INTERFACES.md` is implemented (routes, endpoints, RPC/GraphQL, jobs).",
    isScratch ? "- [ ] Every entity in `architecture/DATA-MODEL.md` exists with its fields, relations, and constraints." : "- [ ] Data model matches `architecture/DATA-MODEL.md` and `data/schema/`.",
    isScratch ? "- [ ] All routes/operations respond per `architecture/INTERFACES.md`." : "- [ ] All routes respond as before.",
    ...inv.i18n ? [isScratch ? "- [ ] All locales present, each with its own messages file." : "- [ ] All locales present and keys match `data/translations/`."] : [],
    ...hasUI(inv) ? [
      "- [ ] UI matches `architecture/DESIGN-SYSTEM.md` \u2014 design tokens reproduced exactly, components built with their variants/states, and the accessibility target met."
    ] : [],
    ...opts.tdd ? ["- [ ] Tests were written before implementation for each unit (red \u2192 green \u2192 refactor)."] : [],
    "- [ ] Required env vars configured: " + (inv.envVars.length ? inv.envVars.map((e) => `\`${e}\``).join(", ") : "_none_") + "."
  ];
  return [
    `# REBUILD \u2014 ${inv.repoName}`,
    "",
    metaBlock(inv, opts),
    isScratch ? "This folder is a complete plan to build the project from scratch." : "This folder is a complete plan to rebuild the project from scratch.",
    "",
    "## Mode & level",
    "",
    `- **${opts.mode}**: ${modeBlurb}.`,
    `- **${opts.level}**: ${opts.level === "light" ? "faithful, minimal-editorializing PRDs" : "PRDs that also suggest improvements to fold in"}.`,
    `- **${opts.fidelity}** fidelity: ${opts.fidelity === "mirror" ? "real files copied under `source/`" : opts.fidelity === "embed" ? "key code embedded directly in the PRDs" : "descriptive PRDs only \u2014 build from requirements"}.`,
    ...opts.tdd ? ["- **TDD**: each unit is built test-first (red \u2192 green \u2192 refactor)."] : [],
    "",
    "## Build order",
    "",
    "Ordered by dependency tier \u2014 foundations (types, data, shared UI, i18n, cross-cutting) first, feature pages next, tests & docs last." + (inv.workspaces?.length ? " The outer tier is the workspace topological order: shared packages build before the apps that consume them." : ""),
    "",
    order || "_No features._",
    "",
    "## Procedure",
    "",
    ...procedure,
    "",
    "## Validation checklist",
    "",
    ...checklist,
    ""
  ].join("\n");
}

// src/prd/fidelity.ts
import { readFileSync as readFileSync16 } from "fs";
import { join as join24 } from "path";
var FENCE_LANG = {
  ".ts": "ts",
  ".tsx": "tsx",
  ".js": "js",
  ".jsx": "jsx",
  ".mjs": "js",
  ".cjs": "js",
  ".json": "json",
  ".py": "python",
  ".rb": "ruby",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".php": "php",
  ".css": "css",
  ".scss": "scss",
  ".prisma": "prisma",
  ".sql": "sql",
  ".graphql": "graphql",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".vue": "vue",
  ".svelte": "svelte"
};
var MAX_EMBED_FILES = 15;
function extOf(path) {
  const i2 = path.lastIndexOf(".");
  return i2 === -1 ? "" : path.slice(i2).toLowerCase();
}
function describeSection(feature) {
  if (feature.files.length === 0) return "_No files associated with this unit._\n";
  const lines = feature.files.map((f) => `- \`${f}\``);
  return `Files that implement this unit (rewrite them from the requirements above):

${lines.join("\n")}
`;
}
function embedSection(feature, opts) {
  const parts2 = [`Key source for this unit (${feature.files.length} file(s) total, showing up to ${MAX_EMBED_FILES}):
`];
  for (const rel of feature.files.slice(0, MAX_EMBED_FILES)) {
    const ext = extOf(rel);
    const lang = FENCE_LANG[ext] ?? "";
    let body2;
    try {
      body2 = readFileSync16(join24(opts.repo, rel), "utf8");
    } catch {
      continue;
    }
    let truncated = false;
    if (body2.length > opts.maxEmbedBytes) {
      body2 = body2.slice(0, opts.maxEmbedBytes);
      truncated = true;
    }
    parts2.push(`#### \`${rel}\`
`);
    parts2.push("```" + lang + "\n" + body2.replace(/```/g, "\u02BC\u02BC\u02BC") + "\n```");
    if (truncated) parts2.push(`> _Truncated to ${opts.maxEmbedBytes} bytes \u2014 see full file in the source repo._`);
    parts2.push("");
  }
  if (feature.files.length > MAX_EMBED_FILES) {
    parts2.push(`_\u2026and ${feature.files.length - MAX_EMBED_FILES} more file(s) not shown._`);
  }
  return parts2.join("\n");
}
function mirrorSection(feature, opts) {
  const copies = [];
  const lines = ["Ground-truth source has been copied verbatim alongside this PRD. Reference it while rebuilding:\n"];
  for (const rel of feature.files) {
    copies.push({
      from: join24(opts.repo, rel),
      to: join24(opts.out, "source", feature.slug, rel)
    });
    lines.push(`- [\`${rel}\`](../../source/${feature.slug}/${rel})`);
  }
  if (feature.files.length === 0) lines.push("_No files associated with this unit._");
  return { markdown: lines.join("\n") + "\n", copies };
}
function renderSourceMaterial(feature, opts) {
  switch (opts.fidelity) {
    case "mirror":
      return mirrorSection(feature, opts);
    case "embed":
      return { markdown: embedSection(feature, opts), copies: [] };
    case "describe":
    default:
      return { markdown: describeSection(feature), copies: [] };
  }
}

// src/prd/bundle.ts
function isSetextContent(s) {
  const t = s.trim();
  return t !== "" && !/^[#>\-*+|=]/.test(t) && !/^\d+[.)]/.test(t);
}
function demoteHeadings(md, by = 1) {
  const lines = md.split("\n");
  const out2 = [];
  let i2 = 0;
  const fm = lines[0]?.match(/^(---|\+\+\+)\s*$/);
  if (fm) {
    out2.push(lines[0]);
    i2 = 1;
    while (i2 < lines.length && lines[i2].trim() !== fm[1]) out2.push(lines[i2++]);
    if (i2 < lines.length) out2.push(lines[i2++]);
  }
  let fence = null;
  for (; i2 < lines.length; i2++) {
    const line = lines[i2];
    const fenceMatch = line.match(/^(\s{0,3})(`{3,}|~{3,})/);
    if (fenceMatch?.[2]) {
      const marker = fenceMatch[2].startsWith("`") ? "`" : "~";
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      out2.push(line);
      continue;
    }
    if (fence !== null) {
      out2.push(line);
      continue;
    }
    if (/^\s{0,3}=+\s*$/.test(line) && out2.length && isSetextContent(out2[out2.length - 1])) {
      const level = Math.min(6, 1 + by);
      out2[out2.length - 1] = `${"#".repeat(level)} ${out2[out2.length - 1].trim()}`;
      continue;
    }
    const h = line.match(/^(\s{0,3})(#{1,6})(\s.*)?$/);
    if (h?.[2]) {
      const hashes = "#".repeat(Math.min(6, h[2].length + by));
      out2.push(`${h[1] ?? ""}${hashes}${h[3] ?? ""}`);
    } else {
      out2.push(line);
    }
  }
  return out2.join("\n");
}
function generationOf(inv, opts) {
  return inv.generation ?? {
    mode: opts.mode,
    level: opts.level,
    fidelity: opts.fidelity,
    granularity: opts.granularity
  };
}
function metaLine(inv, opts) {
  const g = generationOf(inv, opts);
  return `> Generated with \`${inv.generatedWith}\` \xB7 mode \`${g.mode}\` \xB7 level \`${g.level}\` \xB7 fidelity \`${g.fidelity}\``;
}
function slugify3(value) {
  return value.toLowerCase().replace(/\.md$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
var BUNDLE_EXCLUDE = /* @__PURE__ */ new Set(["inventory.json", "SUMMARY.md", "RECONSTRUCTION.md", "FEATURES.md", "SPECS.md"]);
function orderedSections(artifacts, inv) {
  const have2 = new Set(artifacts.map((a) => a.relPath));
  const sections = [];
  const push = (relPath, title, anchor) => {
    if (have2.has(relPath)) sections.push({ relPath, title, anchor });
  };
  push("00-overview/PRD.md", "Overview", "overview");
  push("architecture/ARCHITECTURE.md", "Architecture", "architecture");
  push("architecture/INTERFACES.md", "Interfaces", "interfaces");
  push("architecture/DATA-MODEL.md", "Data model", "data-model");
  push("architecture/DESIGN-SYSTEM.md", "Design system", "design-system");
  push("architecture/diagram.md", "Diagram", "diagram");
  for (const f of inv.features) {
    push(`features/${f.slug}/PRD.md`, f.name, `feature-${f.slug}`);
  }
  push("REBUILD.md", "Build order", "build-order");
  const placed = new Set(sections.map((s) => s.relPath));
  const extra = artifacts.map((a) => a.relPath).filter((p) => p.endsWith(".md") && !placed.has(p) && !BUNDLE_EXCLUDE.has(p)).sort();
  for (const relPath of extra) {
    sections.push({ relPath, title: relPath.replace(/\.md$/, ""), anchor: slugify3(relPath) });
  }
  return sections;
}
function mergeTree(artifacts, inv, opts, variant) {
  const byPath = new Map(artifacts.map((a) => [a.relPath, a.content]));
  const sections = orderedSections(artifacts, inv);
  const parts2 = [];
  parts2.push(`# ${inv.repoName} \u2014 ${variant.heading}`);
  parts2.push("");
  parts2.push(metaLine(inv, opts));
  parts2.push("");
  parts2.push(variant.intro);
  parts2.push("");
  parts2.push("## Contents");
  parts2.push("");
  for (const s of sections) parts2.push(`- [${s.title}](#${s.anchor})`);
  for (const s of sections) {
    const raw = byPath.get(s.relPath) ?? "";
    const content = variant.stripSource ? stripSourceMaterial(raw) : raw;
    parts2.push("");
    parts2.push("---");
    parts2.push("");
    parts2.push(`<a id="${s.anchor}"></a>`);
    parts2.push("");
    parts2.push(demoteHeadings(content).trimEnd());
  }
  return parts2.join("\n") + "\n";
}
function mergeArtifacts(artifacts, inv, opts) {
  return mergeTree(artifacts, inv, opts, {
    heading: "Reconstruction",
    intro: "Single-file bundle of the full reconstruction. Each section below is one document from the reconstruction tree.",
    stripSource: false
  });
}
function stripSourceMaterial(md) {
  const lines = md.split("\n");
  const out2 = [];
  let skipping = false;
  let fence = null;
  for (const line of lines) {
    const fenceMatch = line.match(/^(\s{0,3})(`{3,}|~{3,})/);
    const marker = fenceMatch?.[2] ? fenceMatch[2].startsWith("`") ? "`" : "~" : null;
    if (skipping) {
      if (fence !== null) {
        if (marker === fence) fence = null;
        continue;
      }
      if (marker) {
        fence = marker;
        continue;
      }
      if (/^##\s/.test(line))
        skipping = false;
      else continue;
    }
    if (!skipping && /^##\s+Source material\b/i.test(line)) {
      skipping = true;
      continue;
    }
    out2.push(line);
  }
  return out2.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
function mergeFeatures(artifacts, inv, opts) {
  const byPath = new Map(artifacts.map((a) => [a.relPath, a.content]));
  const have2 = new Set(artifacts.map((a) => a.relPath));
  const sections = [];
  for (const f of inv.features) {
    const relPath = `features/${f.slug}/PRD.md`;
    if (have2.has(relPath)) sections.push({ relPath, title: f.name, anchor: `feature-${f.slug}` });
  }
  const parts2 = [];
  parts2.push(`# ${inv.repoName} \u2014 Features`);
  parts2.push("");
  parts2.push(metaLine(inv, opts));
  parts2.push("");
  parts2.push(
    "Single-file bundle of every feature PRD (the product functionality), in build order. For the full reconstruction \u2014 architecture, interfaces, data model, build order \u2014 see `RECONSTRUCTION.md`."
  );
  parts2.push("");
  parts2.push("## Contents");
  parts2.push("");
  if (sections.length === 0) parts2.push("_No features detected._");
  for (const s of sections) parts2.push(`- [${s.title}](#${s.anchor})`);
  for (const s of sections) {
    const content = byPath.get(s.relPath) ?? "";
    parts2.push("");
    parts2.push("---");
    parts2.push("");
    parts2.push(`<a id="${s.anchor}"></a>`);
    parts2.push("");
    parts2.push(demoteHeadings(content).trimEnd());
  }
  return parts2.join("\n") + "\n";
}
function mergeSpecs(artifacts, inv, opts) {
  return mergeTree(artifacts, inv, opts, {
    heading: "Specs",
    intro: "Single-file **specification** to (re)build this project from: overview, architecture (interfaces & data model), every feature PRD, and the build order \u2014 with the embedded original source code (`## Source material`) stripped. Self-sufficient and code-free, so an agent can implement from it directly. For the same tree *with* the original source, see `RECONSTRUCTION.md`.",
    stripSource: true
  });
}
function summarize(inv, opts) {
  const isScratch = generationOf(inv, opts).mode === "scratch";
  const lines = [];
  lines.push(`# ${inv.repoName} \u2014 reconstruction summary`);
  lines.push("");
  lines.push(metaLine(inv, opts));
  lines.push("");
  lines.push("## Project");
  const frameworks = inv.stack.frameworks.length ? `${inv.stack.primaryLanguage} \xB7 ${inv.stack.frameworks.join(", ")}` : inv.stack.primaryLanguage;
  lines.push(`- **Stack:** ${frameworks}`);
  lines.push(`- **Notable libraries:** ${inv.stack.libraries.length ? inv.stack.libraries.join(", ") : "\u2014"}`);
  if (isScratch) {
    lines.push(`- **Surface:** ${inv.interfaces?.length ?? 0} operation(s) \xB7 ${inv.dataModel?.length ?? 0} entit(y/ies) \xB7 ${inv.enums?.length ?? 0} enum(s)`);
  } else {
    lines.push(`- **Size:** ${inv.fileCount} files \xB7 ${inv.totalLines} lines`);
  }
  if (inv.stack.packageManagers.length) {
    lines.push(`- **Package manager(s):** ${inv.stack.packageManagers.join(", ")}`);
  }
  if (inv.runtime?.node) lines.push(`- **Runtime:** Node ${inv.runtime.node}`);
  if (inv.i18n) {
    lines.push(`- **Locales:** ${inv.i18n.locales.join(", ")} (${inv.i18n.locales.length})`);
  }
  if (isScratch) {
    lines.push(`- **Operations:** ${inv.interfaces?.length ?? 0} \xB7 **Features:** ${inv.features.length}`);
  } else {
    lines.push(`- **Routes:** ${inv.routes.length} \xB7 **Features:** ${inv.features.length}`);
  }
  if (inv.workspaces?.length) {
    const names = inv.workspaces.map((w) => `\`${w.name}\`${w.dependsOn?.length ? ` \u2192 ${w.dependsOn.map((d) => `\`${d}\``).join(", ")}` : ""}`).join(" \xB7 ");
    lines.push(`- **Monorepo:** ${inv.workspaces.length} workspace(s) \u2014 ${names}`);
  }
  lines.push("");
  lines.push("## Features (build order)");
  if (inv.features.length === 0) {
    lines.push("_No features detected._");
  } else {
    inv.features.forEach((f, i2) => {
      const desc = f.description ? ` \u2014 ${f.description}` : "";
      const scope = isScratch ? `${f.interfaces?.length ?? 0} operation(s) \xB7 ${f.entities?.length ?? 0} entit(y/ies)` : `${f.files.length} file(s)`;
      lines.push(`${i2 + 1}. **${f.name}**${desc} \u2192 \`features/${f.slug}/PRD.md\` (${scope})`);
    });
  }
  lines.push("");
  lines.push("## Interface & data surface");
  if (isScratch) {
    lines.push(`- Operations (pre-filled from the plan): ${inv.interfaces?.length ?? 0}`);
    lines.push(`- Entities (pre-filled from the plan): ${inv.dataModel?.length ?? 0}`);
    lines.push(`- Enums (full member lists): ${inv.enums?.length ?? 0}`);
  } else {
    lines.push(`- Routes resolved: ${inv.routes.length}`);
    lines.push(`- Route candidates to verify: ${inv.hints.routeCandidates.length}`);
    lines.push(`- API candidates (RPC / GraphQL / gRPC / OpenAPI): ${inv.hints.apiCandidates.length}`);
    lines.push(`- Schema / data-model candidates: ${inv.hints.schemaCandidates.length}`);
  }
  lines.push("");
  lines.push("## Unknowns to resolve");
  if (inv.unknowns.length === 0) {
    lines.push("_None \u2014 the engine resolved everything it looks for._");
  } else {
    for (const u of inv.unknowns) lines.push(`- ${u}`);
  }
  lines.push("");
  lines.push("## Next steps");
  lines.push(
    "Open `REBUILD.md` for the dependency-ordered build order and validation checklist, then feed each `features/<slug>/PRD.md` to an agent, using `data/` and `source/` as ground truth."
  );
  lines.push("");
  return lines.join("\n");
}

// src/prd/render.ts
function render(inv, opts) {
  const artifacts = [];
  const copies = [];
  artifacts.push({ relPath: "REBUILD.md", content: rebuildDoc(inv, opts) });
  artifacts.push({ relPath: "00-overview/PRD.md", content: overviewPrd(inv, opts) });
  artifacts.push({ relPath: "architecture/ARCHITECTURE.md", content: architectureDoc(inv, opts) });
  artifacts.push({ relPath: "architecture/INTERFACES.md", content: interfacesDoc(inv, opts) });
  artifacts.push({ relPath: "architecture/DATA-MODEL.md", content: dataModelDoc(inv, opts) });
  artifacts.push({ relPath: "architecture/DESIGN-SYSTEM.md", content: designSystemDoc(inv, opts) });
  artifacts.push({ relPath: "architecture/diagram.md", content: diagramDoc(inv) });
  artifacts.push({ relPath: "inventory.json", content: JSON.stringify(inv, null, 2) + "\n" });
  for (const feature of inv.features) {
    const src = renderSourceMaterial(feature, opts);
    copies.push(...src.copies);
    artifacts.push({
      relPath: `features/${feature.slug}/PRD.md`,
      content: featurePrd(inv, feature, opts, src.markdown)
    });
  }
  const dataCopy = (paths, sub) => {
    for (const rel of paths) {
      copies.push({ from: join25(opts.repo, rel), to: join25(opts.out, "data", sub, rel) });
    }
  };
  if (inv.i18n) dataCopy(inv.i18n.files, "translations");
  dataCopy(inv.schemas, "schema");
  dataCopy(inv.configs, "config");
  artifacts.push({ relPath: "SUMMARY.md", content: summarize(inv, opts) });
  if (opts.features) {
    artifacts.push({ relPath: "FEATURES.md", content: mergeFeatures(artifacts, inv, opts) });
  }
  if (opts.specs) {
    artifacts.push({ relPath: "SPECS.md", content: mergeSpecs(artifacts, inv, opts) });
  }
  if (opts.merge) {
    artifacts.push({ relPath: "RECONSTRUCTION.md", content: mergeArtifacts(artifacts, inv, opts) });
  }
  return { artifacts, copies };
}

// src/output.ts
import { mkdirSync as mkdirSync4, writeFileSync as writeFileSync5, copyFileSync, existsSync as existsSync8, readFileSync as readFileSync17, readdirSync as readdirSync5 } from "fs";
import { dirname as dirname4, join as join26 } from "path";
function writeOutput(result, opts) {
  for (const a of result.artifacts) {
    const dest = join26(opts.out, a.relPath);
    mkdirSync4(dirname4(dest), { recursive: true });
    writeFileSync5(dest, a.content, "utf8");
  }
  for (const c2 of result.copies) {
    if (!existsSync8(c2.from)) continue;
    mkdirSync4(dirname4(c2.to), { recursive: true });
    try {
      copyFileSync(c2.from, c2.to);
    } catch {
    }
  }
}
function writeArtifactsIfAbsent(artifacts, outDir) {
  const written = [];
  for (const a of artifacts) {
    const dest = join26(outDir, a.relPath);
    if (existsSync8(dest)) continue;
    mkdirSync4(dirname4(dest), { recursive: true });
    writeFileSync5(dest, a.content, "utf8");
    written.push(a.relPath);
  }
  return written;
}
var ENRICHMENT_WITNESS_LIMIT = 5;
var CALLOUT = "\u{1F9E0}";
var CALLOUT_BEARING_DOCS = [
  "architecture/ARCHITECTURE.md",
  "architecture/INTERFACES.md",
  "architecture/DATA-MODEL.md",
  "architecture/DESIGN-SYSTEM.md",
  "BRAINSTORM.md"
];
var LEDGERS = ["REVIEW.json", "VERIFY.json"];
function readIfFile(path) {
  try {
    return readFileSync17(path, "utf8");
  } catch {
    return void 0;
  }
}
function detectEnrichment(outDir) {
  if (!existsSync8(outDir)) return [];
  const witnesses = [];
  for (const ledger of LEDGERS) {
    if (existsSync8(join26(outDir, ledger))) witnesses.push(`${ledger} \u2014 a semantic-gate ledger from a previous round`);
  }
  const resolved = (rel) => {
    const body2 = readIfFile(join26(outDir, rel));
    if (body2 !== void 0 && body2.trim() && !body2.includes(CALLOUT)) witnesses.push(`${rel} \u2014 every agent callout resolved`);
  };
  for (const rel of CALLOUT_BEARING_DOCS) resolved(rel);
  let slugs = [];
  try {
    slugs = readdirSync5(join26(outDir, "features"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
  }
  for (const slug of slugs) resolved(join26("features", slug, "PRD.md"));
  return witnesses;
}
function formatEnrichmentRefusal(outDir, witnesses) {
  const shown = witnesses.slice(0, ENRICHMENT_WITNESS_LIMIT);
  const rest = witnesses.length - shown.length;
  return `${outDir} already holds an ENRICHED reconstruction \u2014 re-running the analyzer would overwrite it.
` + shown.map((w) => `  - ${w}`).join("\n") + (rest > 0 ? `
  - \u2026and ${rest} more` : "") + `

Pick one:
  - continue the existing tree:   --check / --review / --verify --out ${outDir}
  - scaffold a scoped deep-dive:  --out ${outDir}-<scope>
  - re-scaffold and diff by hand: --out ${outDir}.new
  - overwrite it anyway:          --force  (the enrichment above is LOST)`;
}

// src/postprocess.ts
import { readdirSync as readdirSync6, readFileSync as readFileSync18, existsSync as existsSync9 } from "fs";
import { join as join27, relative, sep as sep3 } from "path";
var GROUND_TRUTH_DIRS = /* @__PURE__ */ new Set(["source", "data"]);
function readMarkdownTree(dir) {
  const out2 = [];
  const walk3 = (abs) => {
    for (const entry of readdirSync6(abs, { withFileTypes: true })) {
      const child = join27(abs, entry.name);
      const rel = relative(dir, child).split(sep3).join("/");
      if (entry.isDirectory()) {
        if (GROUND_TRUTH_DIRS.has(rel)) continue;
        walk3(child);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out2.push({ relPath: rel, content: readFileSync18(child, "utf8") });
      }
    }
  };
  walk3(dir);
  return out2;
}
function bundleExisting(opts) {
  const dir = opts.out;
  const invPath = join27(dir, "inventory.json");
  if (!existsSync9(invPath)) {
    throw new Error(`no inventory.json in ${dir} \u2014 run a full reconstruction there first (e.g. reconstruct --repo <repo> --out ${dir}).`);
  }
  const inv = JSON.parse(readFileSync18(invPath, "utf8"));
  const tree = readMarkdownTree(dir);
  const artifacts = [];
  if (opts.summary) artifacts.push({ relPath: "SUMMARY.md", content: summarize(inv, opts) });
  if (opts.features) artifacts.push({ relPath: "FEATURES.md", content: mergeFeatures(tree, inv, opts) });
  if (opts.specs) artifacts.push({ relPath: "SPECS.md", content: mergeSpecs(tree, inv, opts) });
  if (opts.merge) artifacts.push({ relPath: "RECONSTRUCTION.md", content: mergeArtifacts(tree, inv, opts) });
  return { artifacts, copies: [] };
}

// src/scratch.ts
import { readFileSync as readFileSync19 } from "fs";
function loadPlan(path) {
  let raw;
  try {
    raw = readFileSync19(path, "utf8");
  } catch {
    throw new Error(`cannot read plan.json at ${path} \u2014 does the file exist?`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`invalid plan.json at ${path}: ${e.message}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`invalid plan.json at ${path}: expected a JSON object`);
  }
  const plan = parsed;
  if (!plan.project || typeof plan.project.name !== "string" || !plan.project.name.trim()) {
    throw new Error(`plan.json is missing a "project.name" (the project's name)`);
  }
  if (typeof plan.project.summary !== "string") {
    throw new Error(`plan.json is missing a "project.summary" (one-line description)`);
  }
  if (!plan.stack || typeof plan.stack.primaryLanguage !== "string") {
    throw new Error(`plan.json is missing a "stack.primaryLanguage"`);
  }
  if (!Array.isArray(plan.features) || plan.features.length === 0) {
    throw new Error(`plan.json must list at least one "features" entry`);
  }
  return plan;
}
function deriveTier(kind) {
  if (kind === "project-setup" || kind === "internationalization") return 0;
  if (kind === "documentation") return 2;
  return 1;
}
function planStack(plan) {
  const s = plan.stack;
  const libraries = s.libraries ?? [];
  const stylingLibraries = detectStylingLibraries(libraries);
  return {
    primaryLanguage: s.primaryLanguage,
    languages: s.languages ?? [s.primaryLanguage],
    frameworks: s.frameworks ?? [],
    libraries,
    ...stylingLibraries.length ? { stylingLibraries } : {},
    packageManagers: s.packageManagers ?? [],
    hasTypeScript: s.hasTypeScript ?? /typescript|\bts\b/i.test(s.primaryLanguage)
  };
}
function planDependencies(plan) {
  return (plan.dependencies ?? []).map((d) => ({
    manager: d.manager,
    manifest: d.manifest,
    runtime: d.runtime ?? {},
    dev: d.dev ?? {}
  }));
}
function planDataModel(plan) {
  return (plan.dataModel ?? []).map((e) => ({
    entity: e.entity,
    fields: (e.fields ?? []).map((f) => ({
      name: f.name,
      type: f.type,
      ...f.constraints ? { constraints: f.constraints } : {},
      ...f.enumRef ? { enumRef: f.enumRef } : {}
    })),
    ...e.relations && e.relations.length ? { relations: e.relations } : {},
    ...e.indexes && e.indexes.length ? { indexes: e.indexes } : {},
    ...e.uniques && e.uniques.length ? { uniques: e.uniques } : {}
  }));
}
function planInterfaces(plan) {
  return (plan.interfaces ?? []).map((r) => ({
    method: r.method,
    path: r.path,
    ...r.kind ? { kind: r.kind } : {},
    ...r.auth ? { auth: r.auth } : {},
    ...r.notes ? { notes: r.notes } : {},
    ...r.input ? { input: r.input } : {},
    ...r.output ? { output: r.output } : {},
    ...r.sideEffects && r.sideEffects.length ? { sideEffects: r.sideEffects } : {}
  }));
}
function planFeatures(features) {
  const records = features.map((f, i2) => {
    const kind = f.kind ?? "feature";
    const tier = f.tier ?? deriveTier(kind);
    return {
      feature: {
        slug: slugify2(f.name),
        name: f.name,
        description: f.summary ?? `${f.name}.`,
        kind,
        files: [],
        routes: [],
        ...f.interfaces && f.interfaces.length ? { interfaces: f.interfaces } : {},
        ...f.entities && f.entities.length ? { entities: f.entities } : {},
        ...f.writes && f.writes.length ? { writes: f.writes } : {}
      },
      tier,
      // Preserve the plan's declared order within a tier — the author controls it.
      rank: i2,
      size: 0
    };
  });
  return orderFeatures(records);
}
function planToInventory(plan, opts) {
  const i18n = plan.i18n ? {
    locales: plan.i18n.locales,
    files: [],
    keyCount: plan.i18n.messages?.entries?.length ?? 0,
    ...plan.i18n.messages ? { messages: plan.i18n.messages } : {}
  } : null;
  const interfaces = planInterfaces(plan);
  return {
    generatedWith: `reconstruct@${VERSION}`,
    generation: {
      mode: "scratch",
      level: opts.level,
      fidelity: "describe",
      granularity: opts.granularity
    },
    repoName: plan.project.name,
    stack: planStack(plan),
    fileCount: 0,
    totalLines: 0,
    files: [],
    dependencies: planDependencies(plan),
    routes: [],
    i18n,
    schemas: [],
    configs: [],
    docs: [],
    envVars: plan.envVars ?? [],
    scripts: {},
    features: planFeatures(plan.features),
    hints: {
      routeCandidates: [],
      apiCandidates: [],
      schemaCandidates: [],
      realtimeCandidates: [],
      authCandidates: [],
      designSystemCandidates: [],
      entryPoints: []
    },
    unknowns: [],
    excludedCount: 0,
    product: {
      summary: plan.project.summary,
      ...plan.project.audience ? { audience: plan.project.audience } : {},
      ...plan.project.value ? { value: plan.project.value } : {}
    },
    interfaces,
    dataModel: planDataModel(plan),
    ...plan.enums && plan.enums.length ? { enums: plan.enums } : {},
    ...plan.services && plan.services.length ? { services: plan.services } : {},
    ...plan.policies && plan.policies.length ? { policies: plan.policies } : {},
    ...plan.designSystem ? { designSystem: plan.designSystem } : {}
  };
}
var IDENTITY_ENTITY = /^users?$/i;
var OWNER_FK_COLUMN = /(^user_?id$|owner|author|sender|creator|created_?by)/i;
function fkTarget(f) {
  const m = (f.constraints ?? "").match(/->\s*([a-z0-9_]+)/i);
  return m ? m[1] : null;
}
function isOwnerCallerFk(f) {
  const target = fkTarget(f);
  if (!target || !IDENTITY_ENTITY.test(target)) return false;
  if (isNullable(f) || hasDefault(f)) return false;
  return OWNER_FK_COLUMN.test(f.name);
}
function isNullable(f) {
  const c2 = (f.constraints ?? "").toLowerCase();
  if (/\bnullable\b/.test(c2)) return true;
  if (/\bnot null\b/.test(c2)) return false;
  return false;
}
function hasDefault(f) {
  return /\bdefault\b/i.test(f.constraints ?? "");
}
function isEnumTyped(f) {
  return /\benum\b/i.test(f.type);
}
function enumMembersInline(f) {
  return /\|/.test(f.constraints ?? "");
}
function isWriteOp(r) {
  if (/mutation/i.test(r.kind ?? "")) return true;
  return ["POST", "PUT", "PATCH", "DELETE"].includes((r.method ?? "").toUpperCase());
}
function isAnonymousAuth(auth) {
  return /\b(public|anon(?:ymous)?|none)\b/i.test(auth ?? "");
}
function validatePlanConsistency(plan) {
  const errors = [];
  const warnings = [];
  const entities = new Map((plan.dataModel ?? []).map((e) => [e.entity, e]));
  const interfacePaths = new Set((plan.interfaces ?? []).map((i2) => i2.path));
  const enumNames = new Set((plan.enums ?? []).map((e) => e.name));
  const entityNamesLower = new Set([...entities.keys()].map((n) => n.toLowerCase()));
  const seenEntity = /* @__PURE__ */ new Set();
  for (const e of plan.dataModel ?? []) {
    if (seenEntity.has(e.entity)) {
      errors.push(`dataModel defines entity \`${e.entity}\` more than once \u2014 names must be unique`);
    }
    seenEntity.add(e.entity);
  }
  for (const f of plan.features) {
    for (const e of f.entities ?? []) {
      if (!entities.has(e)) {
        errors.push(`feature "${f.name}" references entity \`${e}\` not defined in dataModel`);
      }
    }
    for (const i2 of f.interfaces ?? []) {
      if (!interfacePaths.has(i2)) {
        errors.push(`feature "${f.name}" references interface/operation \`${i2}\` not defined in interfaces`);
      }
    }
    const featureEntities = new Set(f.entities ?? []);
    for (const w of f.writes ?? []) {
      if (!entities.has(w)) {
        errors.push(`feature "${f.name}" writes entity \`${w}\` not defined in dataModel`);
      } else if (!featureEntities.has(w)) {
        warnings.push(`feature "${f.name}" writes \`${w}\` but does not list it among its entities \u2014 add it (writes must be a subset of entities)`);
      }
    }
  }
  for (const ent of plan.dataModel ?? []) {
    for (const f of ent.fields ?? []) {
      const target = fkTarget(f);
      if (target && !entityNamesLower.has(target.toLowerCase())) {
        errors.push(`field \`${ent.entity}.${f.name}\` has a foreign key to undefined table \`${target}\` \u2014 define it in dataModel or fix the reference`);
      }
    }
  }
  for (const e of plan.enums ?? []) {
    if (!e.members || e.members.length === 0) {
      errors.push(`enum \`${e.name}\` has no members`);
    }
  }
  for (const ent of plan.dataModel ?? []) {
    for (const f of ent.fields ?? []) {
      if (f.enumRef && !enumNames.has(f.enumRef)) {
        errors.push(`field \`${ent.entity}.${f.name}\` references undefined enum \`${f.enumRef}\``);
      }
      if (isEnumTyped(f) && !f.enumRef && !enumMembersInline(f)) {
        warnings.push(`enum field \`${ent.entity}.${f.name}\` has no enumerated members \u2014 list them inline (\`A | B\`) or via enumRef so values are testable`);
      }
    }
  }
  for (const c2 of plan.designSystem?.components ?? []) {
    if (!(c2.variants?.length || c2.states?.length)) {
      warnings.push(`design-system component \`${c2.name}\` declares no variants or states \u2014 contract them so it can be rebuilt to a fixed spec`);
    }
  }
  const featureByInterface = /* @__PURE__ */ new Map();
  for (const f of plan.features) {
    for (const i2 of f.interfaces ?? []) {
      const list = featureByInterface.get(i2) ?? [];
      list.push(f);
      featureByInterface.set(i2, list);
    }
  }
  for (const r of plan.interfaces ?? []) {
    if (!isWriteOp(r) || !isAnonymousAuth(r.auth)) continue;
    for (const f of featureByInterface.get(r.path) ?? []) {
      for (const w of f.writes ?? []) {
        const ent = entities.get(w);
        if (!ent) continue;
        for (const field of ent.fields ?? []) {
          if (isOwnerCallerFk(field)) {
            warnings.push(
              `anonymous/public operation \`${r.path}\` writes \`${w}\`, which requires the caller's own non-null owner FK \`${w}.${field.name} -> ${fkTarget(field)}\` \u2014 an anonymous caller cannot supply it; use an anonymous-capable entity (e.g. a contactRequests table)`
            );
          }
        }
      }
    }
  }
  return { errors, warnings };
}
function renderScratchDocs(plan) {
  return [{ relPath: "CONTEXT.md", content: contextDoc(plan) }, ...adrDocs(plan)];
}
function contextDoc(plan) {
  const lines = [`# ${plan.project.name} \u2014 Context`, "", plan.project.summary, "", "## Language", ""];
  if (plan.glossary && plan.glossary.length) {
    for (const g of plan.glossary) {
      lines.push(`**${g.term}**:`, g.definition);
      if (g.avoid && g.avoid.length) lines.push(`_Avoid_: ${g.avoid.join(", ")}`);
      lines.push("");
    }
  } else {
    lines.push("_Capture the project's domain terms here as they are defined._", "");
  }
  const relations = (plan.dataModel ?? []).flatMap((e) => e.relations ?? []);
  if (relations.length) {
    lines.push("## Relationships", "");
    for (const r of relations) lines.push(`- ${r}`);
    lines.push("");
  }
  return lines.join("\n");
}
function adrDocs(plan) {
  return (plan.decisions ?? []).map((d, i2) => {
    const num = String(i2 + 1).padStart(4, "0");
    const body2 = [d.context, d.decision, d.why].filter(Boolean).join(" ");
    return { relPath: `docs/adr/${num}-${slugify2(d.title)}.md`, content: `# ${d.title}

${body2}
` };
  });
}

// src/check.ts
import { existsSync as existsSync10, readFileSync as readFileSync20, readdirSync as readdirSync7, statSync as statSync6 } from "fs";
import { join as join28, relative as relative2 } from "path";
var REQUIRED_DOCS = ["REBUILD.md", "00-overview/PRD.md", "architecture/ARCHITECTURE.md", "architecture/INTERFACES.md", "architecture/DATA-MODEL.md"];
var FEATURE_SPINE = ["## Functional requirements", "## Acceptance criteria", "## Definition of done"];
var SKIP_DIRS = /* @__PURE__ */ new Set(["data", "source", "node_modules", ".git", "orchestration"]);
function collectMarkdown(dir, base = dir) {
  const out2 = [];
  let entries;
  try {
    entries = readdirSync7(dir);
  } catch {
    return out2;
  }
  for (const name2 of entries) {
    const full = join28(dir, name2);
    let st;
    try {
      st = statSync6(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name2)) continue;
      out2.push(...collectMarkdown(full, base));
    } else if (name2.endsWith(".md")) {
      out2.push({ rel: relative2(base, full).split("\\").join("/"), content: readFileSync20(full, "utf8") });
    }
  }
  return out2;
}
function scanScaffolding(docs, errors) {
  for (const d of docs) {
    const prose = stripQuotes(stripCode(d.content));
    const callouts = prose.split("\u{1F9E0}").length - 1;
    if (callouts > 0) {
      errors.push(`${d.rel}: ${callouts} unresolved \`\u{1F9E0}\` agent callout(s) \u2014 resolve them exhaustively and delete the callout`);
    }
    if (/fill this in/i.test(prose)) {
      errors.push(`${d.rel}: contains unresolved "fill this in" placeholder text`);
    }
  }
}
function fileNames(dir) {
  const out2 = [];
  let entries;
  try {
    entries = readdirSync7(dir);
  } catch {
    return out2;
  }
  for (const name2 of entries) {
    const full = join28(dir, name2);
    let st;
    try {
      st = statSync6(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) out2.push(...fileNames(full));
    else out2.push(name2);
  }
  return out2;
}
function checkOutput(outDir) {
  const errors = [];
  const warnings = [];
  const invPath = join28(outDir, "inventory.json");
  if (!existsSync10(invPath)) {
    if (existsSync10(join28(outDir, "BRAINSTORM.md"))) {
      scanScaffolding(collectMarkdown(outDir), errors);
      return { errors, warnings };
    }
    errors.push(`no inventory.json in ${outDir} \u2014 not a reconstruction output (run the analyzer first)`);
    return { errors, warnings };
  }
  let inv;
  try {
    inv = JSON.parse(readFileSync20(invPath, "utf8"));
  } catch (e) {
    errors.push(`inventory.json is not valid JSON: ${e.message}`);
    return { errors, warnings };
  }
  const docs = collectMarkdown(outDir);
  const byRel = new Map(docs.map((d) => [d.rel, d]));
  const findDoc = (rel) => byRel.get(rel) ?? docs.find((d) => d.rel.endsWith("/" + rel));
  for (const req of REQUIRED_DOCS) {
    if (!findDoc(req)) errors.push(`missing required document: ${req}`);
  }
  scanScaffolding(docs, errors);
  const dataModelDoc2 = findDoc("architecture/DATA-MODEL.md")?.content ?? "";
  const interfacesDoc2 = findDoc("architecture/INTERFACES.md")?.content ?? "";
  const referencedEntities = /* @__PURE__ */ new Set();
  for (const e of inv.dataModel ?? []) referencedEntities.add(e.entity);
  for (const f of inv.features ?? []) for (const e of f.entities ?? []) referencedEntities.add(e);
  if (dataModelDoc2) {
    for (const e of referencedEntities) {
      if (!documents(dataModelDoc2, e)) {
        errors.push(`architecture/DATA-MODEL.md does not document entity \`${e}\` referenced by the plan/features`);
      }
    }
  }
  const referencedOps = /* @__PURE__ */ new Set();
  for (const i2 of inv.interfaces ?? []) referencedOps.add(i2.path);
  for (const f of inv.features ?? []) for (const i2 of f.interfaces ?? []) referencedOps.add(i2);
  if (interfacesDoc2) {
    for (const op of referencedOps) {
      if (!documents(interfacesDoc2, op)) {
        errors.push(`architecture/INTERFACES.md does not document operation \`${op}\` referenced by the plan/features`);
      }
    }
  }
  for (const d of docs) {
    if (!d.rel.includes("features/") || !d.rel.endsWith("PRD.md")) continue;
    for (const h of FEATURE_SPINE) {
      if (!d.content.includes(h)) {
        errors.push(`${d.rel}: missing required section "${h}"`);
      } else if (!sectionHasContent(d.content, h)) {
        errors.push(`${d.rel}: section "${h}" has no content \u2014 fill it (a heading alone is not a PRD section)`);
      }
    }
  }
  if (dataModelDoc2 && !declaresEntities(dataModelDoc2)) {
    errors.push("architecture/DATA-MODEL.md declares no entities \u2014 the data model is empty; fill it before the tree is buildable");
  }
  if (interfacesDoc2 && !declaresOperations(interfacesDoc2)) {
    errors.push("architecture/INTERFACES.md declares no operations \u2014 the interface surface is empty; enumerate it before the tree is buildable");
  }
  if (hasUI(inv)) {
    const ds = findDoc("architecture/DESIGN-SYSTEM.md");
    if (!ds) {
      warnings.push(
        "architecture/DESIGN-SYSTEM.md is missing but UI was detected \u2014 capture the visual contract (tokens, theming, typography, components, a11y)."
      );
    } else if (!declaresDesignSystem(stripSection(stripMetaTable(ds.content), "Design-system source files"))) {
      warnings.push("architecture/DESIGN-SYSTEM.md captures no tokens/components \u2014 fill the design-system contract for a faithful visual rebuild.");
    }
  }
  if (inv.i18n && inv.i18n.locales?.length) {
    const transDir = join28(outDir, "data", "translations");
    const names = existsSync10(transDir) ? fileNames(transDir) : [];
    const catalog = (findDoc("architecture/ARCHITECTURE.md")?.content ?? "") + "\n" + dataModelDoc2 + "\n" + interfacesDoc2 + "\n" + docs.filter((d) => /international|i18n|messages|locale/i.test(d.rel)).map((d) => d.content).join("\n");
    for (const loc of inv.i18n.locales) {
      const inFiles = names.some((n) => n.includes(loc));
      const inCatalog = catalog.includes(`${loc}`);
      if (!inFiles && !inCatalog) {
        warnings.push(`locale \`${loc}\` has no messages file under data/translations/ and is not covered in the message catalog`);
      }
    }
  }
  return { errors, warnings };
}
function documents(doc, token) {
  return doc.includes(token);
}
function stripCode(s) {
  return s.replace(/```[\s\S]*?```/g, "").replace(/~~~[\s\S]*?~~~/g, "").replace(/`[^`\n]*`/g, "");
}
function stripQuotes(s) {
  return s.replace(/"[^"\n]*"/g, "").replace(/[“”][^“”\n]*[“”]/g, "").replace(/[‘’][^‘’\n]*[‘’]/g, "");
}
function stripMetaTable(doc) {
  const lines = doc.split(/\r?\n/);
  const out2 = [];
  for (let i2 = 0; i2 < lines.length; i2++) {
    if (/^\|\s*Setting\s*\|\s*Value\s*\|/i.test(lines[i2].trim())) {
      i2++;
      while (i2 + 1 < lines.length && /^\|/.test(lines[i2 + 1].trim())) i2++;
      continue;
    }
    out2.push(lines[i2]);
  }
  return out2.join("\n");
}
function stripSection(doc, heading) {
  const re = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  const lines = doc.split(/\r?\n/);
  const out2 = [];
  let skipping = false;
  for (const line of lines) {
    if (/^#{1,2}\s/.test(line)) skipping = re.test(line);
    if (!skipping) out2.push(line);
  }
  return out2.join("\n");
}
function tableDataRowCount(doc) {
  return doc.split(/\r?\n/).filter((l) => {
    const t = l.trim();
    return t.startsWith("|") && !/^\|[\s|:-]+\|?$/.test(t);
  }).length;
}
function declaresEntities(doc) {
  const real = stripMetaTable(doc);
  return /^###\s+\S/m.test(real) || tableDataRowCount(real) >= 2;
}
function declaresOperations(doc) {
  const real = stripMetaTable(doc);
  return /^###\s+\S/m.test(real) || tableDataRowCount(real) >= 2 || /^\s*[-*]\s+\S+[./]\S*/m.test(real);
}
function declaresDesignSystem(doc) {
  return /^###\s+\S/m.test(doc) || tableDataRowCount(doc) >= 2 || /^\s*[-*]\s+\S/m.test(doc);
}
function sectionBody(doc, heading) {
  const lines = doc.split(/\r?\n/);
  const start2 = lines.findIndex((l) => l.trim() === heading);
  if (start2 === -1) return "";
  const body2 = [];
  for (let i2 = start2 + 1; i2 < lines.length; i2++) {
    if (/^##\s/.test(lines[i2])) break;
    body2.push(lines[i2]);
  }
  return body2.join("\n");
}
function sectionHasContent(doc, heading) {
  return sectionBody(doc, heading).split(/\r?\n/).some((l) => {
    const t = l.trim();
    return t !== "" && !t.startsWith(">") && !t.startsWith("#");
  });
}
function formatCheckReport(r, outDir) {
  const lines = [];
  if (r.errors.length) {
    lines.push(`reconstruct --check: ${r.errors.length} error(s) in ${outDir}:`);
    for (const e of r.errors) lines.push(`  \u2717 ${e}`);
  }
  if (r.warnings.length) {
    lines.push(`reconstruct --check: ${r.warnings.length} warning(s):`);
    for (const w of r.warnings) lines.push(`  \u26A0 ${w}`);
  }
  if (!r.errors.length) {
    lines.push(
      r.warnings.length ? `reconstruct --check: PASS (with warnings) \u2014 ${outDir} has no blocking gaps.` : `reconstruct --check: PASS \u2014 ${outDir} is buildable (no unresolved callouts; references resolve).`
    );
  } else {
    lines.push(`reconstruct --check: FAIL \u2014 resolve the errors above, then re-run.`);
  }
  return lines.join("\n");
}

// src/verify.ts
import { existsSync as existsSync11, readFileSync as readFileSync21, writeFileSync as writeFileSync6 } from "fs";
import { join as join29 } from "path";
var VERIFY_MAX = 60;
var VALID = ["supported", "partial", "refuted", "unsupported"];
var VALID_CONFIDENCE = ["confirmed", "inferred", "gap"];
var CLAIM_SECTIONS = /* @__PURE__ */ new Set(["## Functional requirements", "## Acceptance criteria"]);
var STOP = new Set(
  "the a an is are be to of in on for and or with via from this that it its as at by into using used user users system when then given so each via must should can will every".split(
    " "
  )
);
function tokens(s) {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t));
}
function overlap(query, hay) {
  let n = 0;
  for (const t of new Set(query)) if (hay.has(t)) n++;
  return n;
}
function requirements(prd) {
  const out2 = [];
  let inSection = false;
  for (const raw of prd.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^##\s/.test(line)) {
      inSection = CLAIM_SECTIONS.has(line);
      continue;
    }
    if (!inSection) continue;
    const m = /^(?:[-*+]|\d+\.)\s+(.*)$/.exec(line);
    if (!m) continue;
    const text = m[1].replace(/^\[[ xX]\]\s*/, "").trim();
    if (!text || text.startsWith("\u{1F9E0}") || /fill this in/i.test(text)) continue;
    if (tokens(text).length < 2) continue;
    out2.push(text);
  }
  return out2;
}
function featureEvidence(f) {
  const out2 = [];
  for (const file of f.files ?? []) out2.push({ ref: file, text: String(file) });
  for (const r of f.routes ?? []) {
    const sig = [r?.method, r?.route ?? r?.path].filter(Boolean).join(" ") || (typeof r === "string" ? r : JSON.stringify(r));
    out2.push({ ref: `route ${sig}`, text: sig });
  }
  for (const i2 of f.interfaces ?? []) out2.push({ ref: `interface ${i2}`, text: String(i2) });
  for (const e of f.entities ?? []) out2.push({ ref: `entity ${e}`, text: String(e) });
  return out2;
}
function buildWorklist(outDir, opts = {}) {
  let invRaw;
  try {
    invRaw = readFileSync21(join29(outDir, "inventory.json"), "utf8");
  } catch {
    throw new Error(`no inventory.json in ${outDir} \u2014 not a reconstruction output (run the analyzer first)`);
  }
  let inv;
  try {
    inv = JSON.parse(invRaw);
  } catch (e) {
    throw new Error(`inventory.json is not valid JSON: ${e.message}`);
  }
  const pairs = [];
  let n = 0;
  for (const f of inv.features ?? []) {
    const prdPath = join29(outDir, "features", f.slug, "PRD.md");
    if (!existsSync11(prdPath)) continue;
    const reqs = requirements(readFileSync21(prdPath, "utf8"));
    const ev = featureEvidence(f);
    const evTok = ev.map((e) => ({ e, hay: new Set(tokens(e.text)) }));
    for (const req of reqs) {
      n++;
      const qt = tokens(req);
      const ranked = evTok.map(({ e, hay }) => ({ e, s: overlap(qt, hay) })).sort((a, b) => b.s - a.s);
      const top = ranked.filter((x, i2) => i2 === 0 || x.s > 0).slice(0, 3);
      const best = top[0];
      const evidenceRef = best && best.s > 0 ? best.e.ref : ev.length ? `feature ${f.slug}` : `feature ${f.slug} (no captured evidence)`;
      const digest = (top.some((x) => x.s > 0) ? top.filter((x) => x.s > 0) : ranked.slice(0, 4)).map((x) => x.e.ref).join(" \xB7 ").slice(0, 600) || f.description || f.name;
      pairs.push({
        claimId: `C${n}`,
        claim: req.slice(0, 400),
        feature: f.slug,
        evidenceRef,
        digest,
        score: best ? best.s : 0
      });
    }
  }
  const max = Math.max(1, Math.floor(opts.maxVerify ?? VERIFY_MAX));
  const kept = pairs.length > max ? pairs.slice().sort((a, b) => b.score - a.score || a.claimId.localeCompare(b.claimId)).slice(0, max) : pairs;
  const worklist = {
    run: outDir,
    pairs: kept.map(({ score, ...rest }) => rest),
    coverage: { total: pairs.length, kept: kept.length, max, capped: kept.length < pairs.length }
  };
  return { worklist, total: pairs.length, kept: kept.length };
}
function capUsedFor(outDir) {
  try {
    const todo = JSON.parse(readFileSync21(join29(outDir, "VERIFY.todo.json"), "utf8"));
    const max = todo?.coverage?.max;
    if (typeof max === "number" && Number.isFinite(max) && max > 0) return Math.floor(max);
  } catch {
  }
  return VERIFY_MAX;
}
function runVerify(outDir, opts = {}) {
  const { worklist, total, kept } = buildWorklist(outDir, opts);
  const todo = {
    run: outDir,
    // Coverage rides in the MACHINE worklist, not just VERIFY.md's prose: an
    // agent reading only the JSON must still see that a capped run adjudicates
    // a subset — partial coverage never reads as complete.
    coverage: worklist.coverage,
    pairs: worklist.pairs.map((p) => ({ ...p, verdict: null, note: "", confidence: null }))
  };
  writeFileSync6(join29(outDir, "VERIFY.todo.json"), JSON.stringify(todo, null, 2));
  writeFileSync6(join29(outDir, "VERIFY.md"), renderWorklistMd(worklist, total, kept));
  return worklist;
}
function renderWorklistMd(wl, total, kept) {
  const out2 = [];
  out2.push(`# Requirement verification worklist`);
  out2.push("");
  out2.push(
    `For each requirement, open the cited source evidence and judge whether the requirement **traces to the original code** (faithful inference) or was invented. In \`VERIFY.todo.json\`, set each \`verdict\` to supported \xB7 partial \xB7 refuted \xB7 unsupported (+ a short \`note\`), and stamp each \`confidence\` to confirmed (evidence read and decisive) \xB7 inferred (consistent but indirect \u2014 a pattern or standard behavior) \xB7 gap (evidence thin; needs a human). Save it (e.g. as \`verdicts.json\`), then run \`node scripts/analyze.mjs --verify --apply verdicts.json --out <dir>\`.`
  );
  if (kept < total)
    out2.push(
      `
> \u26A0 **Partial coverage:** showing ${kept} of ${total} requirement(s) \u2014 capped at the best-matched evidence. The ${total - kept} unshown requirement(s) are NOT adjudicated by this round. Raise the cap with \`--max-verify ${total}\` to cover them all.`
    );
  out2.push("");
  for (const p of wl.pairs) {
    out2.push(`## ${p.claimId} \xB7 ${p.feature} \u2192 ${p.evidenceRef}`);
    out2.push(`**Requirement:** ${p.claim}`);
    out2.push(`**Captured evidence:** ${p.digest}`);
    out2.push(`**Verdict:** _____ \xB7 **Confidence:** _____ \xB7 **Note:** _____`);
    out2.push("");
  }
  return out2.join("\n");
}
function readInventoryIfPresent(outDir) {
  try {
    return JSON.parse(readFileSync21(join29(outDir, "inventory.json"), "utf8"));
  } catch {
    return void 0;
  }
}
function resolveEvidence(ref, inv) {
  const features = inv.features ?? [];
  const feat = /^feature (\S+)( \(no captured evidence\))?$/.exec(ref);
  if (feat) return features.some((f) => f.slug === feat[1]);
  const route = /^route (.+)$/.exec(ref);
  if (route) {
    const sig = route[1];
    const sigs = /* @__PURE__ */ new Set();
    const add = (method, path2) => {
      if (typeof path2 !== "string" || !path2) return;
      if (typeof method === "string" && method) sigs.add(`${method} ${path2}`);
      sigs.add(path2);
    };
    for (const r of inv.routes ?? []) add(r.method, r.route);
    for (const i2 of inv.interfaces ?? []) add(i2.method, i2.path);
    for (const f of features) for (const r of f.routes ?? []) add(r?.method, r?.route ?? r?.path);
    return sigs.has(sig);
  }
  const iface = /^interface (.+)$/.exec(ref);
  if (iface) {
    const name2 = iface[1];
    return (inv.interfaces ?? []).some((i2) => i2.path === name2) || features.some((f) => (f.interfaces ?? []).includes(name2));
  }
  const ent = /^entity (.+)$/.exec(ref);
  if (ent) {
    const name2 = ent[1];
    return (inv.dataModel ?? []).some((e) => e.entity === name2) || features.some((f) => (f.entities ?? []).includes(name2));
  }
  const loc = /:(\d+)(?:-(\d+))?$/.exec(ref);
  const path = ref.replace(/:\d+(-\d+)?$/, "");
  const invFile = (inv.files ?? []).find((f) => f.path === path);
  const inFeature = features.some((f) => (f.files ?? []).includes(path));
  if (!invFile && !inFeature) return false;
  if (loc && invFile && typeof invFile.lines === "number" && invFile.lines > 0) {
    const hi = Math.max(Number(loc[1]), loc[2] ? Number(loc[2]) : 0);
    if (hi > invFile.lines) return false;
  }
  return true;
}
function readTodoPairs(outDir) {
  try {
    const todo = JSON.parse(readFileSync21(join29(outDir, "VERIFY.todo.json"), "utf8"));
    if (!Array.isArray(todo?.pairs)) return void 0;
    const byClaim = /* @__PURE__ */ new Map();
    for (const p of todo.pairs) if (p && typeof p.claimId === "string") byClaim.set(p.claimId, p);
    return byClaim.size ? byClaim : void 0;
  } catch {
    return void 0;
  }
}
function applyVerdicts(outDir, verdictsPath) {
  const raw = JSON.parse(readFileSync21(verdictsPath, "utf8"));
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.pairs) ? raw.pairs : Array.isArray(raw?.verdicts) ? raw.verdicts : [];
  if (list.length === 0) {
    throw new Error(`${verdictsPath}: no verdict rows found \u2014 expected a bare array, { "pairs": [...] } or { "verdicts": [...] } with at least one row.`);
  }
  const todo = readTodoPairs(outDir);
  const problems = [];
  const unknown = [];
  const verdicts = [];
  for (const [i2, v] of list.entries()) {
    if (!v || typeof v.claimId !== "string") {
      problems.push(`row ${i2 + 1}: missing claimId`);
      continue;
    }
    if (v.verdict != null && !VALID.includes(v.verdict)) {
      problems.push(`row ${i2 + 1} (${v.claimId}): invalid verdict "${String(v.verdict)}" \u2014 expected ${VALID.join("|")} or null`);
      continue;
    }
    const base = todo?.get(v.claimId);
    if (todo && !base) {
      unknown.push(v.claimId);
      continue;
    }
    const verdict = VALID.includes(v.verdict) ? v.verdict : void 0;
    const confidence = VALID_CONFIDENCE.includes(v.confidence) ? v.confidence : void 0;
    verdicts.push({
      claimId: v.claimId,
      claim: typeof v.claim === "string" ? v.claim : base?.claim ?? "",
      feature: typeof v.feature === "string" ? v.feature : base?.feature ?? "",
      evidenceRef: typeof v.evidenceRef === "string" ? v.evidenceRef : base?.evidenceRef ?? "",
      digest: typeof v.digest === "string" ? v.digest : base?.digest ?? "",
      verdict,
      note: typeof v.note === "string" ? v.note : "",
      ...confidence ? { confidence } : {}
    });
  }
  if (problems.length) {
    throw new Error(`${verdictsPath}: ${problems.length} malformed row(s) \u2014 fix them and re-apply (fail-closed):
  - ${problems.join("\n  - ")}`);
  }
  if (verdicts.length === 0) {
    throw new Error(
      `${verdictsPath}: every row cites a claimId unknown to ${join29(outDir, "VERIFY.todo.json")} (${unknown.join(", ")}) \u2014 stale fragment? Re-run --verify and re-adjudicate.`
    );
  }
  const result = reduceVerdicts(verdicts, readInventoryIfPresent(outDir));
  if (unknown.length) result.ignored = unknown;
  writeFileSync6(join29(outDir, "VERIFY.json"), JSON.stringify({ ...result, verdicts }, null, 2));
  return result;
}
function reduceVerdicts(verdicts, inv) {
  const counts = { supported: 0, partial: 0, refuted: 0, unsupported: 0 };
  for (const v of verdicts) if (v.verdict && counts[v.verdict] !== void 0) counts[v.verdict]++;
  const confidence = { confirmed: 0, inferred: 0, gap: 0, unlabeled: 0 };
  for (const v of verdicts) {
    if (v.confidence && VALID_CONFIDENCE.includes(v.confidence)) confidence[v.confidence]++;
    else confidence.unlabeled++;
  }
  const failures = [];
  const unadjudicated = [];
  for (const v of verdicts) {
    if (!v.verdict) {
      unadjudicated.push(v.claimId);
      continue;
    }
    if (v.verdict === "refuted" || v.verdict === "unsupported") {
      failures.push({ claimId: v.claimId, evidenceRef: v.evidenceRef, verdict: v.verdict, note: v.note });
    } else if (inv && !resolveEvidence(v.evidenceRef, inv)) {
      failures.push({
        claimId: v.claimId,
        evidenceRef: v.evidenceRef,
        verdict: v.verdict,
        note: `fabricated citation: evidenceRef does not resolve against the inventory${v.note ? " \u2014 " + v.note : ""}`
      });
    }
  }
  return {
    ok: failures.length === 0,
    pairs: verdicts.length,
    adjudicated: verdicts.filter((v) => !!v.verdict).length,
    supported: counts.supported,
    partial: counts.partial,
    refuted: counts.refuted,
    unsupported: counts.unsupported,
    failures,
    unadjudicated,
    confidence
  };
}
function foldSemantic(outDir, check, opts = {}) {
  const p = join29(outDir, "VERIFY.json");
  const skip = (msg) => {
    if (opts.allowUnverified) check.warnings.push(`${msg}; semantic gate skipped (--allow-unverified)`);
    else check.errors.push(`${msg} (or pass --allow-unverified to downgrade this to a warning)`);
  };
  if (!existsSync11(p)) {
    skip("--semantic: no VERIFY.json \u2014 run `--verify` then `--verify --apply <verdicts.json>` first");
    return;
  }
  let sem;
  try {
    sem = JSON.parse(readFileSync21(p, "utf8"));
  } catch (e) {
    skip(`--semantic: VERIFY.json is unreadable (${e.message})`);
    return;
  }
  if (!Array.isArray(sem.verdicts)) {
    skip("--semantic: VERIFY.json carries no verdicts[] ledger \u2014 regenerate it with `--verify` then `--verify --apply <verdicts.json>`");
    return;
  }
  const fresh = reduceVerdicts(sem.verdicts, readInventoryIfPresent(outDir));
  if (fresh.adjudicated === 0) {
    skip(
      "--semantic: VERIFY.json carries 0 adjudicated verdicts \u2014 the requirement gate never engaged (re-run --verify then --verify --apply <verdicts.json> with valid verdict tokens)"
    );
    return;
  }
  let all = [];
  try {
    all = buildWorklist(outDir, { maxVerify: Number.MAX_SAFE_INTEGER }).worklist.pairs;
  } catch {
    all = [];
  }
  const offeredIds = /* @__PURE__ */ new Set();
  try {
    for (const p2 of buildWorklist(outDir, { maxVerify: capUsedFor(outDir) }).worklist.pairs) offeredIds.add(p2.claimId);
  } catch {
  }
  const adjudicatedIds = new Set(sem.verdicts.filter((v) => !!v.verdict).map((v) => v.claimId));
  const uncovered = all.filter((p2) => !adjudicatedIds.has(p2.claimId));
  const dropped = uncovered.filter((p2) => offeredIds.has(p2.claimId));
  const neverOffered = uncovered.filter((p2) => !offeredIds.has(p2.claimId));
  const preview = (ps) => {
    const ids = ps.map((p2) => p2.claimId);
    return `${ids.slice(0, 6).join(", ")}${ids.length > 6 ? ", \u2026" : ""}`;
  };
  if (dropped.length) {
    skip(
      `--semantic: ${dropped.length} requirement(s) the worklist DID offer have no adjudicated verdict in VERIFY.json (${preview(dropped)}) \u2014 the verdict rows were dropped, or a PRD was edited after verification (which shifts claim ids); re-run --verify then --verify --apply <verdicts.json> (the gate must not pass on dropped verdicts)`
    );
  }
  if (neverOffered.length) {
    skip(
      `--semantic: ${neverOffered.length} of ${all.length} requirement(s) were never offered for adjudication (${preview(neverOffered)}) \u2014 the --verify worklist was CAPPED, so the faithfulness gate only covered part of the tree. Re-run with \`--max-verify ${all.length}\` and adjudicate the rest`
    );
  }
  if (!fresh.ok) {
    check.errors.push(
      `semantic verification failed: ${fresh.failures.length} requirement(s) refuted, unsupported or citing unresolvable evidence (see VERIFY.json)`
    );
  }
  if (fresh.unadjudicated.length) {
    check.warnings.push(`${fresh.unadjudicated.length} requirement(s) not fully adjudicated by --verify`);
  }
  if (fresh.confidence?.gap) {
    check.warnings.push(
      `${fresh.confidence.gap} verdict(s) labeled confidence:gap \u2014 the cited evidence is thin; strengthen it or record the claims as known gaps`
    );
  }
}
function formatVerifyReport(r) {
  const lines = [];
  lines.push(`reconstruct --verify: ${r.adjudicated}/${r.pairs} requirement(s) adjudicated`);
  lines.push(`  supported: ${r.supported} \xB7 partial: ${r.partial} \xB7 refuted: ${r.refuted} \xB7 unsupported: ${r.unsupported}`);
  const c2 = r.confidence;
  if (c2 && c2.confirmed + c2.inferred + c2.gap > 0) {
    lines.push(`  confidence: ${c2.confirmed} confirmed \xB7 ${c2.inferred} inferred \xB7 ${c2.gap} gap${c2.unlabeled ? ` \xB7 ${c2.unlabeled} unlabeled` : ""}`);
  }
  for (const f of r.failures.slice(0, 12)) {
    lines.push(`  \u2717 ${f.claimId} (${f.evidenceRef}): ${f.verdict}${f.note ? " \u2014 " + f.note : ""}`);
  }
  if (r.unadjudicated.length) {
    lines.push(`  \u26A0 ${r.unadjudicated.length} requirement(s) not fully adjudicated: ${r.unadjudicated.join(", ")}`);
  }
  if (r.ignored?.length) {
    lines.push(`  \u26A0 ${r.ignored.length} ignored (unknown id): ${r.ignored.join(", ")} \u2014 not in VERIFY.todo.json (stale fragment?)`);
  }
  lines.push(r.ok ? `  \u2713 every requirement traces to the original source` : `  \u2717 some requirements are refuted or unsupported (invented)`);
  return lines.join("\n");
}

// src/review.ts
import { createHash as createHash4 } from "crypto";
import { existsSync as existsSync12, readFileSync as readFileSync22, writeFileSync as writeFileSync7 } from "fs";
import { join as join30 } from "path";
var ARCH_DOCS = ["architecture/INTERFACES.md", "architecture/DATA-MODEL.md", "architecture/ARCHITECTURE.md"];
var SEVERITIES2 = ["blocker", "major", "minor"];
var CATEGORIES = ["stories", "requirements", "acceptance", "write-contract", "enum", "consistency", "faithfulness", "i18n", "rebuild-test"];
function sha256(s) {
  return createHash4("sha256").update(s).digest("hex");
}
function readIfExists(path) {
  try {
    return readFileSync22(path, "utf8");
  } catch {
    return "";
  }
}
function archHash(outDir) {
  return sha256(ARCH_DOCS.map((rel) => `# ${rel}
` + readIfExists(join30(outDir, rel))).join("\n"));
}
function normalizeProblem(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function findingId(f) {
  return `${f.feature}:${f.category}:${sha256(normalizeProblem(f.problem)).slice(0, 8)}`;
}
function runReview(outDir) {
  const inv = readInventory(outDir);
  const prior = readPrior(outDir);
  const round = (prior?.round ?? 0) + 1;
  const arch = archHash(outDir);
  const archChanged = prior ? prior.archHash !== arch : true;
  const units = [];
  const changedSet = [];
  for (const f of inv.features ?? []) {
    const prdPath = join30(outDir, "features", f.slug, "PRD.md");
    if (!existsSync12(prdPath)) continue;
    const prdHash = sha256(readFileSync22(prdPath, "utf8"));
    const priorHash = prior?.units.get(f.slug);
    const changed = priorHash !== void 0 && priorHash !== prdHash;
    const isNew = prior !== null && priorHash === void 0;
    const needsReview = prior === null || archChanged || changed || isNew;
    if (needsReview) changedSet.push(f.slug);
    units.push({ feature: f.slug, prdHash, archHash: arch, needsReview, findings: [] });
  }
  const worklist = { run: outDir, round, changedSet, units };
  writeFileSync7(join30(outDir, "REVIEW.todo.json"), JSON.stringify(worklist, null, 2));
  writeFileSync7(join30(outDir, "REVIEW.md"), renderWorklistMd2(worklist));
  return worklist;
}
function readInventory(outDir) {
  let raw;
  try {
    raw = readFileSync22(join30(outDir, "inventory.json"), "utf8");
  } catch {
    throw new Error(`no inventory.json in ${outDir} \u2014 not a reconstruction output (run the analyzer first)`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`inventory.json is not valid JSON: ${e.message}`);
  }
}
function readPrior(outDir) {
  const reviewPath = join30(outDir, "REVIEW.json");
  if (!existsSync12(reviewPath)) return null;
  let rev;
  try {
    rev = JSON.parse(readFileSync22(reviewPath, "utf8"));
  } catch {
    return null;
  }
  const units = /* @__PURE__ */ new Map();
  let priorArch = "";
  if (rev.baseline && Array.isArray(rev.baseline.features)) {
    priorArch = rev.baseline.archHash ?? "";
    for (const u of rev.baseline.features) units.set(u.feature, u.prdHash);
  } else {
    try {
      const todo = JSON.parse(readFileSync22(join30(outDir, "REVIEW.todo.json"), "utf8"));
      for (const u of todo.units ?? []) units.set(u.feature, u.prdHash);
      priorArch = todo.units?.[0]?.archHash ?? "";
    } catch {
    }
  }
  return {
    round: rev.round ?? 0,
    staleRounds: rev.staleRounds ?? 0,
    residual: rev.residual ?? [],
    archHash: priorArch,
    units
  };
}
function renderWorklistMd2(wl) {
  const out2 = [];
  const due = wl.units.filter((u) => u.needsReview);
  out2.push(`# AI buildability review worklist \u2014 round ${wl.round}`);
  out2.push("");
  out2.push(
    `Review the ${due.length} feature(s) flagged below against the nine checks in \`references/ai-review-rubric.md\` (story completeness, requirement testability, real Given/When/Then, write-contract satisfiability, enum fidelity, cross-doc consistency, faithfulness, i18n, the rebuild self-test). For each, read the PRD plus the architecture docs it references and the embedded source. Keep the reviewer **separate from the author** and prompt it to find reasons the unit is *not* buildable.`
  );
  out2.push("");
  out2.push(
    `Emit each finding as \`{ feature, severity (blocker|major|minor), category, problem, fix }\`. Have an **independent verifier** set \`verdict\` to \`confirmed\` or \`refuted\` per blocker (a refuted blocker does not gate). Save the findings (e.g. as \`findings.json\`, shape \`{ "findings": [...] }\`), then run \`node scripts/analyze.mjs --review --apply findings.json --out <dir>\`.`
  );
  out2.push("");
  if (wl.changedSet.length && wl.round > 1) {
    out2.push(`_Changed since last round: ${wl.changedSet.join(", ")}._`);
    out2.push("");
  }
  for (const u of wl.units) {
    out2.push(`## ${u.feature}${u.needsReview ? "" : " \u2014 _unchanged, skip_"}`);
    out2.push(`PRD: \`features/${u.feature}/PRD.md\``);
    out2.push("");
  }
  return out2.join("\n");
}
var VALID_SEVERITY = new Set(SEVERITIES2);
var VALID_CATEGORY = new Set(CATEGORIES);
function normalizeFindings(raw) {
  let list = [];
  if (Array.isArray(raw)) list = raw;
  else if (Array.isArray(raw?.findings)) list = raw.findings;
  else if (Array.isArray(raw?.units)) {
    for (const u of raw.units) {
      for (const f of u?.findings ?? []) list.push({ feature: f.feature ?? u.feature, ...f });
    }
  }
  const out2 = [];
  for (const f of list) {
    if (!f || typeof f.feature !== "string") continue;
    if (!VALID_SEVERITY.has(f.severity)) continue;
    const category = VALID_CATEGORY.has(f.category) ? f.category : "rebuild-test";
    const finding = {
      feature: f.feature,
      severity: f.severity,
      category,
      problem: typeof f.problem === "string" ? f.problem : "",
      fix: typeof f.fix === "string" ? f.fix : "",
      verdict: f.verdict === "confirmed" || f.verdict === "refuted" ? f.verdict : null,
      verifierNote: typeof f.verifierNote === "string" ? f.verifierNote : ""
    };
    finding.id = typeof f.id === "string" && f.id ? f.id : findingId(finding);
    out2.push(finding);
  }
  return out2;
}
function gates(f) {
  return f.severity === "blocker" && f.verdict !== "refuted";
}
function reduceFindings(findings, ctx) {
  let majors = 0;
  let minors = 0;
  for (const f of findings) {
    if (f.severity === "major") majors++;
    else if (f.severity === "minor") minors++;
  }
  const touched = /* @__PURE__ */ new Set([...ctx.reviewedFeatures, ...findings.map((f) => f.feature)]);
  const known = new Set(ctx.currentFeatures);
  const fresh = findings.filter(gates).map((f) => ({
    id: f.id ?? findingId(f),
    feature: f.feature,
    category: f.category,
    problem: f.problem,
    fix: f.fix
  }));
  const carried = ctx.priorFailures.filter((pf) => !touched.has(pf.feature) && (known.size === 0 || known.has(pf.feature)));
  const byId = /* @__PURE__ */ new Map();
  for (const f of carried) byId.set(f.id, f);
  for (const f of fresh) byId.set(f.id, f);
  const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const failures = [...byId.values()].sort((a, b) => cmp(a.id, b.id));
  const residual = failures.map((f) => f.id);
  const priorResidual = [...new Set(ctx.priorFailures.map((f) => f.id))].sort(cmp);
  const sameAsPrior = residual.length > 0 && residual.length === priorResidual.length && residual.every((id, i2) => id === priorResidual[i2]);
  const noProgress = sameAsPrior;
  const staleRounds = noProgress ? ctx.priorStale + 1 : 0;
  return {
    ok: residual.length === 0,
    round: ctx.round,
    units: ctx.units,
    reviewed: ctx.reviewedFeatures.length,
    blockers: failures.length,
    majors,
    minors,
    changedSet: ctx.changedSet,
    residual,
    noProgress,
    staleRounds,
    failures,
    findings
  };
}
function applyFindings(outDir, findingsPath) {
  const findings = normalizeFindings(JSON.parse(readFileSync22(findingsPath, "utf8")));
  let round;
  let changedSet = [];
  let units = 0;
  let reviewedFeatures = [];
  let currentFeatures = [];
  let baseline;
  try {
    const todo = JSON.parse(readFileSync22(join30(outDir, "REVIEW.todo.json"), "utf8"));
    round = todo.round;
    changedSet = todo.changedSet ?? [];
    units = todo.units?.length ?? 0;
    reviewedFeatures = (todo.units ?? []).filter((u) => u.needsReview).map((u) => u.feature);
    currentFeatures = (todo.units ?? []).map((u) => u.feature);
    baseline = {
      archHash: todo.units?.[0]?.archHash ?? "",
      features: (todo.units ?? []).map((u) => ({ feature: u.feature, prdHash: u.prdHash }))
    };
  } catch {
  }
  let priorFailures = [];
  let priorStale = 0;
  let priorRound = 0;
  const reviewPath = join30(outDir, "REVIEW.json");
  if (existsSync12(reviewPath)) {
    try {
      const prev = JSON.parse(readFileSync22(reviewPath, "utf8"));
      priorFailures = prev.failures ?? [];
      priorStale = prev.staleRounds ?? 0;
      priorRound = prev.round ?? 0;
    } catch {
    }
  }
  const result = reduceFindings(findings, {
    round: round ?? priorRound + 1,
    // fall back to prior+1 if the worklist is gone
    changedSet,
    units,
    reviewedFeatures,
    currentFeatures,
    priorFailures,
    priorStale
  });
  if (baseline) result.baseline = baseline;
  writeFileSync7(reviewPath, JSON.stringify(result, null, 2));
  return result;
}
function recomputeReviewGate(rev) {
  const ids = /* @__PURE__ */ new Set();
  for (const f of rev.failures ?? []) if (f && typeof f.id === "string") ids.add(f.id);
  for (const f of rev.findings ?? []) {
    if (!f || typeof f.feature !== "string") continue;
    if (gates(f)) ids.add(f.id ?? findingId(f));
  }
  return [...ids].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}
function foldReview(outDir, check, opts = {}) {
  const p = join30(outDir, "REVIEW.json");
  const skip = (msg) => {
    if (opts.allowUnverified) check.warnings.push(`${msg}; review gate skipped (--allow-unverified)`);
    else check.errors.push(`${msg} (or pass --allow-unverified to downgrade this to a warning)`);
  };
  if (!existsSync12(p)) {
    skip("--semantic: no REVIEW.json \u2014 run `--review` then `--review --apply <findings.json>` first");
    return;
  }
  let rev;
  try {
    rev = JSON.parse(readFileSync22(p, "utf8"));
  } catch (e) {
    skip(`--semantic: REVIEW.json is unreadable (${e.message})`);
    return;
  }
  const residual = recomputeReviewGate(rev);
  if (residual.length) {
    check.errors.push(`AI buildability review failed: ${residual.length} unresolved blocker(s) across the feature PRDs (see REVIEW.json)`);
  }
  if (rev.noProgress) {
    check.warnings.push(
      `review made no progress for ${rev.staleRounds} round(s) on the same ${residual.length} blocker(s) \u2014 fix the shared architecture contract or record them as known gaps`
    );
  }
}
function formatReviewReport(r) {
  const lines = [];
  lines.push(
    `reconstruct --review: round ${r.round} \xB7 ${r.reviewed}/${r.units} unit(s) reviewed \xB7 ${r.blockers} blocker(s) \xB7 ${r.majors} major(s) \xB7 ${r.minors} minor(s)`
  );
  for (const f of r.failures.slice(0, 12)) {
    lines.push(`  \u2717 ${f.feature} [${f.category}]: ${f.problem}${f.fix ? " \u2014 fix: " + f.fix : ""}`);
  }
  if (r.noProgress) {
    lines.push(`  \u26A0 no progress for ${r.staleRounds} round(s) on the same blocker(s) \u2014 fix the upstream architecture contract or record as known gaps`);
  }
  lines.push(
    r.ok ? `  \u2713 zero unresolved blockers \u2014 the tree passes the AI buildability review` : `  \u2717 ${r.residual.length} blocker(s) gate buildability \u2014 fix in place, re-review the changed units, repeat`
  );
  return lines.join("\n");
}

// src/brainstorm.ts
import { readFileSync as readFileSync23 } from "fs";
import { join as join31 } from "path";
function callout(text) {
  return `> \u{1F9E0} ${text}`;
}
function recoveredSurface(inv) {
  const out2 = ["## Current surface (recovered)", ""];
  out2.push(`Brainstorm **evolutions** of the surface below, grounded in the recovered PRDs \u2014 not a greenfield concept.`);
  out2.push("");
  const opCount = inv.interfaces?.length ?? inv.routes?.length ?? 0;
  const entCount = inv.dataModel?.length ?? 0;
  const enumCount = inv.enums?.length ?? 0;
  out2.push(`- **Scale:** ${inv.features.length} feature(s) \xB7 ${opCount} operation(s) \xB7 ${entCount} entit(y/ies) \xB7 ${enumCount} enum(s)`);
  if (inv.i18n?.locales?.length) out2.push(`- **Locales:** ${inv.i18n.locales.join(", ")}`);
  out2.push("");
  out2.push("**Features:**");
  for (const f of inv.features) out2.push(`- **${f.name}**${f.description ? ` \u2014 ${f.description}` : ""} (\`features/${f.slug}/PRD.md\`)`);
  out2.push("");
  const entities = (inv.dataModel ?? []).map((e) => e.entity);
  if (entities.length) out2.push(`**Entities:** ${entities.join(", ")}`);
  const enums = (inv.enums ?? []).map((e) => e.name);
  if (enums.length) out2.push(`**Enums:** ${enums.join(", ")}`);
  out2.push("");
  return out2;
}
function renderBrainstorm(inv, name2) {
  const out2 = [];
  out2.push(`# ${name2} \u2014 brainstorm`);
  out2.push("");
  out2.push(
    "_Divergent phase: generate 3+ genuinely different directions before converging on one. Resolve every `> \u{1F9E0}` callout, then hand the chosen direction to the greenfield interview (\u2192 `plan.json`) or, on an existing reconstruction, to iteration PRDs. See `references/brainstorm-playbook.md`._"
  );
  out2.push("");
  if (inv) out2.push(...recoveredSurface(inv));
  const framing = inv ? "What jobs are underserved by the current surface? Who hurts today, and where does the product fall short?" : "What jobs-to-be-done is this for? Who hurts today, and how do they cope now?";
  out2.push("## Problem space", "", callout(framing), "");
  out2.push("## Constraints known", "", callout("Hard limits already known \u2014 budget, stack, timeline, compliance, integrations, non-negotiables."), "");
  out2.push("## Concepts", "", "_At least three genuinely different directions \u2014 not variants of one._", "");
  for (const letter of ["A", "B", "C"]) {
    out2.push(`### Concept ${letter}`, "");
    out2.push(callout(`Pitch \u2014 one sentence: what it is and for whom.`));
    out2.push(callout(`Differentiators \u2014 what makes it distinct from the other concepts.`));
    out2.push(callout(`Trade-offs \u2014 what it gives up; what gets harder.`));
    out2.push(callout(`Risks \u2014 the thing most likely to sink it.`));
    out2.push("");
  }
  out2.push("## Scoring & decision", "");
  out2.push(callout("Score each concept against the criteria that matter (value, effort, risk, fit), then state the decision rule you used."));
  out2.push("");
  out2.push("| Criterion | Concept A | Concept B | Concept C |");
  out2.push("| --- | --- | --- | --- |");
  out2.push("| _(fill this in)_ | | | |");
  out2.push("");
  out2.push(
    "## Chosen direction",
    "",
    callout("The concept you're taking forward, and why now. This becomes the product summary the next phase builds on."),
    ""
  );
  out2.push(
    "## Rejected alternatives",
    "",
    callout("One bullet per rejected concept: \u201CRejected X because Y.\u201D Each is an ADR seed \u2014 a decision worth recording so it isn't relitigated."),
    ""
  );
  const next = inv ? "Turn the chosen direction into new/changed feature PRDs on this reconstruction, then run the enrich \u2192 `--check` \u2192 `--review` loop." : "Feed the chosen direction into the greenfield interview: it becomes `project.summary`, and each rejected alternative becomes a `decisions[]` entry \u2192 `plan.json` \u2192 `--scratch`.";
  out2.push("## Next step", "", callout(next), "");
  return out2.join("\n");
}
function runBrainstorm(outDir) {
  let inv = null;
  try {
    inv = JSON.parse(readFileSync23(join31(outDir, "inventory.json"), "utf8"));
  } catch {
    inv = null;
  }
  const name2 = inv?.repoName ?? "new-idea";
  const relPath = "BRAINSTORM.md";
  const written = writeArtifactsIfAbsent([{ relPath, content: renderBrainstorm(inv, name2) }], outDir);
  return { relPath, created: written.includes(relPath), seeded: inv !== null };
}

// src/orchestrate.ts
import { existsSync as existsSync14, mkdirSync as mkdirSync5, readFileSync as readFileSync24, writeFileSync as writeFileSync8 } from "fs";
import { join as join33, resolve as resolve4 } from "path";

// src/orchestrate-templates.ts
import { join as join32 } from "path";
var ONE_WRITER_FOOTER = `
## Return, don't write

Return ONLY the structured output specified above. Do NOT write, edit, or delete any file in the reconstruction tree; do NOT run any engine command that writes (\`--verify --apply\`, \`--review --apply\`, or the analyzer itself over the out dir). Returning proposals \u2014 not writing the shared docs directly \u2014 is what keeps the map parallel: two agents never race on the same file. The orchestrator is the SINGLE SERIAL REDUCER: it merges your returned fragments, writes the canonical docs and worklists itself, and runs the fail-closed \`--apply\` fold. Exception: if a draft or justification is prose too large to return, write ONLY to \`<OUT>/orchestration/out/<role>-<batch>.md\` (a file namespaced to you alone) and return its path.
`;
var DRAFT_SCHEMA = {
  type: "object",
  required: ["proposals"],
  properties: {
    proposals: {
      type: "array",
      items: {
        type: "object",
        required: ["slug", "prd", "interfaceRows", "entityRows"],
        properties: {
          slug: { type: "string" },
          prd: { type: "string", description: "the COMPLETE features/<slug>/PRD.md content \u2014 full spine, every callout resolved" },
          interfaceRows: {
            type: "array",
            description: "ROW PROPOSALS for architecture/INTERFACES.md (the orchestrator merges them)",
            items: {
              type: "object",
              required: ["method", "path"],
              properties: {
                method: { type: "string" },
                path: { type: "string" },
                kind: { type: "string" },
                auth: { type: "string" },
                input: { type: "string" },
                output: { type: "string" },
                sideEffects: { type: "array", items: { type: "string" } }
              }
            }
          },
          entityRows: {
            type: "array",
            description: "ROW PROPOSALS for architecture/DATA-MODEL.md (the orchestrator merges them)",
            items: {
              type: "object",
              required: ["entity", "fields"],
              properties: {
                entity: { type: "string" },
                fields: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["name", "type"],
                    properties: {
                      name: { type: "string" },
                      type: { type: "string" },
                      constraints: { type: "string" },
                      enumRef: { type: "string" }
                    }
                  }
                },
                relations: { type: "array", items: { type: "string" } },
                indexes: { type: "array", items: { type: "string" } },
                uniques: { type: "array", items: { type: "string" } }
              }
            }
          },
          enums: {
            type: "array",
            description: "every enum the feature touches, with its COMPLETE member list",
            items: {
              type: "object",
              required: ["name", "members"],
              properties: { name: { type: "string" }, members: { type: "array", items: { type: "string" } }, description: { type: "string" } }
            }
          },
          notes: { type: "string", description: "what the source could not settle (goes to unknowns, never into the PRD as fact)" }
        }
      }
    }
  }
};
var FINDINGS_SCHEMA = {
  type: "object",
  required: ["findings"],
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        required: ["feature", "severity", "category", "problem", "fix"],
        properties: {
          feature: { type: "string" },
          severity: { enum: ["blocker", "major", "minor"] },
          category: { enum: ["stories", "requirements", "acceptance", "write-contract", "enum", "consistency", "faithfulness", "i18n", "rebuild-test"] },
          problem: { type: "string" },
          fix: { type: "string" }
        }
      }
    }
  }
};
var BLOCKER_VERDICT_SCHEMA = {
  type: "object",
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "verdict", "verifierNote"],
        properties: {
          id: { type: "string" },
          verdict: { enum: ["confirmed", "refuted"] },
          verifierNote: { type: "string", description: "one line grounded in the PRD/architecture docs you read" }
        }
      }
    }
  }
};
var ADJUDICATE_SCHEMA = {
  type: "object",
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        required: ["claimId", "verdict", "note", "confidence"],
        properties: {
          claimId: { type: "string" },
          verdict: { enum: ["supported", "partial", "refuted", "unsupported"] },
          note: { type: "string", description: "one line grounded in the evidence you read" },
          confidence: { enum: ["confirmed", "inferred", "gap"] }
        }
      }
    }
  }
};
var PHASE_SPECS = {
  "enrich-map": {
    role: "drafter",
    title: "Draft",
    schema: DRAFT_SCHEMA,
    description: (n) => `Draft the ${n} feature PRD(s) of a reconstruction as a map-reduce (drafters return row proposals; the orchestrator is the single serial reducer)`,
    applyHint: (engine, out2) => `merge the proposals into architecture/INTERFACES.md + architecture/DATA-MODEL.md and write each features/<slug>/PRD.md yourself (the serial REDUCE of references/orchestration.md), then gate: node ${engine} --check --out ${out2}`
  },
  "review-find": {
    role: "finder",
    title: "Find",
    schema: FINDINGS_SCHEMA,
    description: (n) => `Review the ${n} flagged feature PRD(s) of a reconstruction against the nine buildability checks (adversarial finder fan-out)`,
    applyHint: (engine, out2) => `merge the findings into ${join32(out2, "findings.json")} ({ "findings": [...] }), then: node ${engine} --review --apply ${join32(out2, "findings.json")} --out ${out2} \u2014 then fan the surviving blockers out with --orchestrate --phase review-verify`
  },
  "review-verify": {
    role: "verifier",
    title: "Verify",
    schema: BLOCKER_VERDICT_SCHEMA,
    description: (n) => `Independently confirm or refute the ${n} open review blocker(s) of a reconstruction (adversarial verifier fan-out)`,
    applyHint: (engine, out2) => `stamp each verdict/verifierNote onto its finding (match by id) in ${join32(out2, "findings.json")}, then re-run: node ${engine} --review --apply ${join32(out2, "findings.json")} --out ${out2} \u2014 a refuted blocker drops from the residual`
  },
  adjudicate: {
    role: "adjudicator",
    title: "Adjudicate",
    schema: ADJUDICATE_SCHEMA,
    description: (n) => `Adjudicate the ${n} requirement\u2194evidence pair(s) of a reconstruction's verification gate (fan-out, fail-closed fold)`,
    applyHint: (engine, out2) => `fill the verdicts into ${join32(out2, "verdicts.json")}, then: node ${engine} --verify --apply ${join32(out2, "verdicts.json")} --out ${out2} && node ${engine} --check --semantic --out ${out2}`
  }
};
function phaseSpec(name2) {
  const spec = PHASE_SPECS[name2];
  if (!spec) throw new Error(`no phase spec for "${name2}"`);
  return spec;
}
function toBatches(groups, batchSize) {
  const out2 = [];
  for (const ids of groups) {
    for (let i2 = 0; i2 < ids.length; i2 += batchSize) out2.push(ids.slice(i2, i2 + batchSize));
  }
  return out2;
}
function phaseWorkflowScript(ph, outAbs, engineAbs, batchSize) {
  const spec = phaseSpec(ph.name);
  const scriptPath = join32(outAbs, "orchestration", `${ph.name}.workflow.mjs`);
  const meta = { name: `reconstruct-${ph.name}`, description: spec.description(ph.items), phases: [{ title: spec.title }] };
  return [
    `export const meta = ${JSON.stringify(meta)}`,
    ``,
    `// NOT a plain Node script: launch via the Workflow tool \u2014 Workflow({ scriptPath: ${JSON.stringify(scriptPath)} }).`,
    `// Emitted by \`reconstruct --orchestrate\` from the CURRENT worklist. The worklist is the source`,
    `// of truth: if it changes, re-run \`--orchestrate --phase ${ph.name}\` before launching.`,
    ``,
    `// Constants for THIS reconstruction (injected at emit time; no Date.now/Math.random in this harness).`,
    `const OUT = ${JSON.stringify(outAbs)}`,
    `const ENGINE = ${JSON.stringify(engineAbs)}`,
    `const WORKLIST = ${JSON.stringify(ph.worklist)}`,
    `const AGENTS = OUT + '/orchestration/agents'`,
    `const BATCHES = ${JSON.stringify(toBatches(ph.groups, batchSize))}`,
    `const SCHEMA = ${JSON.stringify(spec.schema)}`,
    ``,
    `function contract(name, extra) {`,
    `  return 'Read and follow the dispatch contract at ' + AGENTS + '/' + name + '.md VERBATIM.\\n'`,
    `    + 'Constants: OUT=' + OUT + '  ENGINE=' + ENGINE + '  WORKLIST=' + WORKLIST + '.\\n'`,
    `    + 'Invoke the engine only by its ABSOLUTE path: node ' + ENGINE + ' <flags> \u2014 read-only flags only.'`,
    `    + (extra ? '\\n' + extra : '')`,
    `}`,
    ``,
    `log('reconstruct ${ph.name}: ' + ${JSON.stringify(String(ph.items))} + ' item(s) across ' + BATCHES.length + ' agent(s)')`,
    ``,
    `phase(${JSON.stringify(spec.title)})`,
    `const results = await pipeline(BATCHES, (batch, _item, i) =>`,
    `  agent(contract('${spec.role}', 'ITEMS=' + batch.join(',')), { label: '${ph.name}:' + (i + 1), phase: ${JSON.stringify(spec.title)}, agentType: 'general-purpose', schema: SCHEMA }))`,
    ``,
    `// One-writer rule: this workflow only COLLECTS fragments. The main agent stays the single`,
    `// serial reducer \u2014 it folds them in itself. Next step:`,
    `//   ${spec.applyHint(engineAbs, outAbs)}`,
    `return { phase: ${JSON.stringify(ph.name)}, worklist: WORKLIST, results: results.filter(Boolean) }`,
    ``
  ].join("\n");
}
function agentContracts(outAbs, engineAbs) {
  const footer = ONE_WRITER_FOOTER.replaceAll("<OUT>", outAbs);
  void engineAbs;
  return {
    drafter: `# Contract: drafter

You draft ONE feature of a reconstruction at a time, to full PRD depth \u2014 the MAP half of the enrichment map-reduce (\`references/orchestration.md\`, Phase 1).

Worklist: \`${join32(outAbs, "inventory.json")}\` (\`features[]\` \u2014 each entry carries \`slug\`, \`files\`, \`routes\`, \`interfaces\`, \`entities\`, \`writes\`). Handle ONLY the features whose \`slug\` is named in your prompt (\`ITEMS=<slug,\u2026>\`). If an ITEMS id is no longer in the worklist, skip it and say so in your note.

For EACH of your features:

1. Read ONLY its slice of the tree: the feature's \`files\` plus the \`inventory.hints.*Candidates\` (routes/api/schema/realtime/auth/design-system) that fall inside those files, its scaffold \`features/<slug>/PRD.md\` (including the embedded \`## Source material\`), and the copied ground truth under \`${join32(outAbs, "data")}\`. File paths in the inventory are relative to the analyzed repo \u2014 prefer the embedded source and \`data/\` copies; open the original repo only when the tree references paths it did not embed.
2. Draft the COMPLETE \`features/<slug>/PRD.md\` content \u2014 the full spine (context & goal, user stories, numbered functional requirements, interfaces & data, Given/When/Then acceptance criteria, edge cases & failure modes, definition of done), resolving every \`> \u{1F9E0}\` callout.
3. PROPOSE \u2014 do not write \u2014 the shared-doc rows your feature touches:
   - interface ROW PROPOSALS: method \xB7 path \xB7 kind \xB7 auth \xB7 input \xB7 output \xB7 side-effects;
   - entity ROW PROPOSALS: entity \xB7 fields+types \xB7 constraints \xB7 relations \xB7 enums;
   - every enum with its COMPLETE member list.
4. Ground everything in the source you actually read \u2014 never invent. Anything the source cannot settle goes into \`notes\`, not into the PRD as fact.

Return (structured output): \`{ "proposals": [{ "slug", "prd", "interfaceRows", "entityRows", "enums", "notes" }] }\` \u2014 your ITEMS only.

The orchestrator runs the REDUCE serially: it unions your rows into the canonical \`architecture/INTERFACES.md\` / \`architecture/DATA-MODEL.md\` (deduping by path/operation and by entity name), reconciles conflicts against source, and writes the feature PRDs.
${footer}`,
    finder: `# Contract: finder

You are a FINDER of the AI buildability review \u2014 one adversarial reviewer per flagged feature (\`references/orchestration.md\`, Phase 2 step B; rubric: \`references/ai-review-rubric.md\`).

Worklist: \`${join32(outAbs, "REVIEW.todo.json")}\` (\`units[]\`; the flagged ones carry \`needsReview: true\`). Handle ONLY the features named in your prompt (\`ITEMS=<feature,\u2026>\`). If an ITEMS id is no longer in the worklist, skip it and say so in your note.

For EACH of your features:

1. Read \`features/<feature>/PRD.md\`, the architecture docs it references (\`architecture/INTERFACES.md\`, \`architecture/DATA-MODEL.md\`, \`architecture/ARCHITECTURE.md\`), and the ground truth (the embedded \`## Source material\`, \`data/\`).
2. Apply the nine checks \u2014 stories, requirements, acceptance, write-contract, enum, consistency, faithfulness, i18n, rebuild-test. Be ADVERSARIAL: hunt for reasons the unit is NOT buildable by a fresh agent from its PRD + the architecture docs alone; do not bless it.
3. Emit each finding as \`{ feature, severity (blocker|major|minor), category, problem, fix }\` \u2014 \`problem\` concrete and grounded in what you read, \`fix\` actionable. Leave \`verdict\` unset: an INDEPENDENT verifier rules on each blocker, never you.

Return (structured output): \`{ "findings": [ \u2026 ] }\` \u2014 your ITEMS only (an empty array means the unit passes).
${footer}`,
    verifier: `# Contract: verifier

You are an INDEPENDENT VERIFIER of the review loop \u2014 one fresh, adversarial agent per open blocker (\`references/orchestration.md\`, Phase 2 step C). A finding "counts" only when you confirm it.

Worklist: \`${join32(outAbs, "REVIEW.json")}\` (\`failures[]\` \u2014 the open blockers, each \`{ id, feature, category, problem, fix }\`). Handle ONLY the blockers whose \`id\` is named in your prompt (\`ITEMS=<id,\u2026>\`). If an ITEMS id is no longer in the worklist, skip it and say so in your note.

For EACH of your blockers:

1. Read its failure entry, then the feature's \`features/<feature>/PRD.md\` and the architecture docs \u2014 independently. You were NOT the finder: assume the blocker is WRONG until the docs prove it.
2. Try to REFUTE it: \`refuted\` when the PRD/architecture docs already answer the stated problem; \`confirmed\` only if you cannot refute it from what you read. A refuted blocker does not gate (the engine drops it from the residual set).
3. \`verifierNote\` is REQUIRED \u2014 one line grounded in what you read (quote or paraphrase the decisive passage).

Return (structured output): \`{ "verdicts": [{ "id", "verdict", "verifierNote" }] }\` \u2014 your ITEMS only.
${footer}`,
    adjudicator: `# Contract: adjudicator

You adjudicate the requirement\u2194source verification gate of a reconstruction \u2014 judging whether each PRD requirement TRACES to the original code (faithful inference) or was invented.

Worklist: \`${join32(outAbs, "VERIFY.todo.json")}\` (\`pairs[]\`, each \`{ claimId, claim, feature, evidenceRef, digest }\`). Handle ONLY the pairs whose \`claimId\` is named in your prompt (\`ITEMS=<id,\u2026>\`). If an ITEMS id is no longer in the worklist, skip it and say so in your note.

For EACH of your pairs:

1. Open the cited evidence \u2014 \`evidenceRef\` is a file path, \`route \u2026\`, \`interface \u2026\`, \`entity \u2026\` or \`feature \u2026\` the reconstruction captured; \`digest\` lists the nearest matches \u2014 and read it in context (the feature PRD's embedded \`## Source material\`, \`data/\`, the architecture docs).
2. Set \`verdict\`: \`supported\` (the requirement traces to the source exactly), \`partial\` (real but overstated), \`unsupported\` (traces to nothing \u2014 invented), \`refuted\` (the source contradicts it). When unsure, choose the HARSHER verdict \u2014 a false pass is worse than a false fail.
3. Stamp \`confidence\` alongside the verdict: **confirmed** (you read the cited evidence and it decisively supports the requirement), **inferred** (consistent with the source but indirect \u2014 a convention, a pattern, or standard library/DB behavior, with no false certainty), or **gap** (the evidence is thin or missing and a human should confirm). The label never gates \u2014 the \`verdict\` kind does \u2014 but it keeps a grounded fact machine-distinguishable from an inference.
4. \`note\` is REQUIRED \u2014 one line grounded in what you read.

Return (structured output): \`{ "verdicts": [{ "claimId", "verdict", "note", "confidence" }] }\` \u2014 your ITEMS only. The fold is fail-closed: \`--verify --apply\` re-resolves every \`evidenceRef\` against the inventory, so a fabricated citation is rejected.
${footer}`
  };
}
function runbookMd(phases, outAbs, engineAbs) {
  const status = phases.map((p) => `| ${p.name} | \`${p.worklist}\` | ${p.ready ? `ready (${p.items} item(s))` : "not ready"} | \`${p.prerequisite}\` |`).join("\n");
  const engine = `node ${engineAbs}`;
  const agents = join32(outAbs, "orchestration", "agents");
  return `# reconstruct \u2014 sequential RUNBOOK (eco / no-subagent fallback)

Out: \`${outAbs}\` \xB7 Engine: \`${engine}\`

Generated by \`reconstruct --orchestrate\` from the CURRENT state of the reconstruction. This
sequential path is correctness-identical to the multi-agent workflows \u2014 same worklists, same
contracts, same fail-closed gates; only wall-clock differs. Fan-out is an optimization, not a
requirement.

## Phase status

| Phase | Worklist | Status | Produce it with |
|---|---|---|---|
${status}

## The loop (play every role yourself, one unit at a time)

1. **Analyze** (if not done): \`${engine} --repo <repo> --out ${outAbs}\` \u2192 \`${join32(outAbs, "inventory.json")}\` (greenfield: \`--scratch --plan <plan.json>\`).
2. **Enrich \u2014 the map-reduce, played solo**: for EVERY \`inventory.json\` feature, apply \`${join32(agents, "drafter.md")}\` yourself (draft the PRD + the interface/entity row proposals), then play the reducer \u2014 merge every proposal into \`architecture/INTERFACES.md\` / \`architecture/DATA-MODEL.md\` and write the feature PRDs. Gate: \`${engine} --check --out ${outAbs}\`.
3. **Review \u2014 find**: \`${engine} --review --out ${outAbs}\` writes \`${join32(outAbs, "REVIEW.todo.json")}\` (flagging only what changed). For EVERY flagged unit, apply \`${join32(agents, "finder.md")}\` yourself; save the findings as \`${join32(outAbs, "findings.json")}\` (\`{ "findings": [...] }\`), then reduce: \`${engine} --review --apply ${join32(outAbs, "findings.json")} --out ${outAbs}\`.
4. **Review \u2014 verify**: for EVERY open blocker in \`${join32(outAbs, "REVIEW.json")}\` (\`failures[]\`), apply \`${join32(agents, "verifier.md")}\` yourself (confirm/refute + note, stamped onto the matching finding in \`findings.json\` by \`id\`), then re-reduce: \`${engine} --review --apply ${join32(outAbs, "findings.json")} --out ${outAbs}\`. Loop 2\u21924 until \`REVIEW.json.ok\` (or \`staleRounds >= 2\` / round > 5).
5. **Adjudicate the requirement gate**: \`${engine} --verify --out ${outAbs}\` writes \`${join32(outAbs, "VERIFY.todo.json")}\`. For EVERY pair, apply \`${join32(agents, "adjudicator.md")}\` yourself (verdict + confidence + note \u2192 \`${join32(outAbs, "verdicts.json")}\`), then fold: \`${engine} --verify --apply ${join32(outAbs, "verdicts.json")} --out ${outAbs}\`.
6. **Gate**: \`${engine} --check --semantic --out ${outAbs}\` must exit 0 before presenting anything.

Never fanned out (orchestrator-only, always serial): the greenfield interview, \`--brainstorm\`
(the divergent phase), every reduce/merge step, and the scratch build itself.

With subagents available, prefer the emitted workflows instead: \`--orchestrate --out ${outAbs} --phase <p>\`
then \`Workflow({ scriptPath: "${join32(outAbs, "orchestration", "<p>.workflow.mjs")}" })\` \u2014 you stay the sole writer either way.
`;
}

// src/orchestrate.ts
var PHASES = ["enrich-map", "review-find", "review-verify", "adjudicate"];
var SMALL_WORKLIST = 3;
var PHASE_BATCH = {
  "enrich-map": 1,
  "review-find": 1,
  "review-verify": 4,
  adjudicate: 4
};
var MAX_AGENTS = 40;
function batchSizeFor(phase, items, override) {
  if (override !== void 0 && override > 0) return Math.floor(override);
  const base = PHASE_BATCH[phase];
  if (items <= 0) return base;
  return Math.max(base, Math.ceil(items / MAX_AGENTS));
}
function batchNotice(phase, items, batch, override) {
  const agents = Math.ceil(items / batch);
  const why = override !== void 0 ? " (--batch-size)" : batch > PHASE_BATCH[phase] ? ` (capped at ${MAX_AGENTS} agents)` : "";
  return `phase "${phase}": ${items} item(s) \u2192 ${agents} agent(s), ${batch} item(s) each${why}.`;
}
function readJson2(path) {
  try {
    return JSON.parse(readFileSync24(path, "utf8"));
  } catch {
    return void 0;
  }
}
function workspaceGroups(inv) {
  const features = inv.features ?? [];
  const workspaces = (inv.workspaces ?? []).slice().sort((a, b) => b.path.length - a.path.length);
  if (!workspaces.length) return features.length ? [features.map((f) => f.slug)] : [];
  const groupOf = (files) => {
    const counts = /* @__PURE__ */ new Map();
    for (const file of files) {
      const ws = workspaces.find((w) => file === w.path || file.startsWith(`${w.path}/`));
      const key = ws ? ws.name : "";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let best = "";
    let bestCount = 0;
    for (const [key, count] of counts) {
      if (count > bestCount) {
        best = key;
        bestCount = count;
      }
    }
    return best;
  };
  const groups = /* @__PURE__ */ new Map();
  for (const f of features) {
    const key = groupOf(f.files ?? []);
    const bucket = groups.get(key);
    if (bucket) bucket.push(f.slug);
    else groups.set(key, [f.slug]);
  }
  return [...groups.values()];
}
function listPhases(outDir, engineAbs, batchOverride) {
  const out2 = resolve4(outDir);
  const invPath = join33(out2, "inventory.json");
  const inv = readJson2(invPath);
  const invReady = !!inv && Array.isArray(inv.features);
  const enrichGroups = invReady ? workspaceGroups(inv) : [];
  const enrichIds = enrichGroups.flat();
  const todoPath = join33(out2, "REVIEW.todo.json");
  const todo = readJson2(todoPath);
  const findReady = !!todo && Array.isArray(todo.units);
  const findIds = findReady ? todo.units.filter((u) => u.needsReview).map((u) => u.feature) : [];
  const revPath = join33(out2, "REVIEW.json");
  const rev = readJson2(revPath);
  const verifyReady = !!rev && (Array.isArray(rev.failures) || Array.isArray(rev.findings));
  const blockerIds = verifyReady ? recomputeReviewGate(rev) : [];
  const verPath = join33(out2, "VERIFY.todo.json");
  const ver = readJson2(verPath);
  const adjReady = !!ver && Array.isArray(ver.pairs);
  const adjIds = adjReady ? ver.pairs.map((p) => p.claimId) : [];
  const shaped = (p) => {
    const batch = batchSizeFor(p.name, p.items, batchOverride);
    return { ...p, batch, agents: p.items ? Math.ceil(p.items / batch) : 0 };
  };
  return [
    shaped({
      name: "enrich-map",
      ready: invReady,
      worklist: invPath,
      items: enrichIds.length,
      ids: enrichIds,
      groups: enrichGroups,
      prerequisite: `node ${engineAbs} --repo <repo> --out ${out2}`
    }),
    shaped({
      name: "review-find",
      ready: findReady,
      worklist: todoPath,
      items: findIds.length,
      ids: findIds,
      groups: findIds.length ? [findIds] : [],
      prerequisite: `node ${engineAbs} --review --out ${out2}`
    }),
    shaped({
      name: "review-verify",
      ready: verifyReady,
      worklist: revPath,
      items: blockerIds.length,
      ids: blockerIds,
      groups: blockerIds.length ? [blockerIds] : [],
      prerequisite: `node ${engineAbs} --review --apply <findings.json> --out ${out2}`
    }),
    shaped({
      name: "adjudicate",
      ready: adjReady,
      worklist: verPath,
      items: adjIds.length,
      ids: adjIds,
      groups: adjIds.length ? [adjIds] : [],
      prerequisite: `node ${engineAbs} --verify --out ${out2}`
    })
  ];
}
function orchestrateRun(outDir, engineAbs, opts = {}) {
  const out2 = resolve4(outDir);
  if (!existsSync14(out2)) {
    return { exitCode: 2, written: [], notices: [], errors: [`out dir not found: ${out2}`], phases: [] };
  }
  const phases = listPhases(out2, engineAbs, opts.batchSize);
  let selected = phases.filter((p) => p.ready);
  if (opts.phase !== void 0) {
    const ph = phases.find((p) => p.name === opts.phase);
    if (!ph) {
      return {
        exitCode: 2,
        written: [],
        notices: [],
        errors: [`unknown phase "${opts.phase}" \u2014 expected one of: ${PHASES.join(", ")}.`],
        phases
      };
    }
    if (!ph.ready) {
      return {
        exitCode: 2,
        written: [],
        notices: [],
        errors: [`phase "${ph.name}" is not ready \u2014 its worklist ${ph.worklist} does not exist yet. Produce it first: ${ph.prerequisite}`],
        phases
      };
    }
    selected = [ph];
  }
  const orchDir = join33(out2, "orchestration");
  const agentsDir = join33(orchDir, "agents");
  mkdirSync5(join33(orchDir, "out"), { recursive: true });
  mkdirSync5(agentsDir, { recursive: true });
  const written = [];
  const notices = [];
  for (const [name2, content] of Object.entries(agentContracts(out2, engineAbs))) {
    const p = join33(agentsDir, `${name2}.md`);
    writeFileSync8(p, content);
    written.push(p);
  }
  if (!opts.eco) {
    for (const ph of selected) {
      if (ph.items === 0) {
        notices.push(`phase "${ph.name}": worklist is empty \u2014 nothing to orchestrate.`);
        continue;
      }
      if (ph.items <= SMALL_WORKLIST) {
        notices.push(`phase "${ph.name}": only ${ph.items} item(s) \u2014 the sequential --eco path is equivalent and cheaper.`);
      }
      const batch = batchSizeFor(ph.name, ph.items, opts.batchSize);
      notices.push(batchNotice(ph.name, ph.items, batch, opts.batchSize));
      const p = join33(orchDir, `${ph.name}.workflow.mjs`);
      writeFileSync8(p, phaseWorkflowScript(ph, out2, engineAbs, batch));
      written.push(p);
    }
  }
  const rb = join33(orchDir, "RUNBOOK.md");
  writeFileSync8(rb, runbookMd(phases, out2, engineAbs));
  written.push(rb);
  return { exitCode: 0, written, notices, errors: [], phases };
}

// src/cli.ts
var HELP2 = `reconstruct v${VERSION}
Analyze a repository and generate reconstruction PRDs to rebuild it from scratch.

Usage:
  reconstruct [--repo <path>] [--out <path>] [options]
  reconstruct --scratch --plan <plan.json> [--out <path>] [options]
  reconstruct --orchestrate [--phase <p>] [--eco] [--list] --out <path>

Options:
  --repo <path>        Repository to analyze            (default: current dir)
  --out <path>         Output directory                 (default: <repo>/reconstruction)
  --mode <mode>        preserve | redesign              (default: preserve)
  --level <level>      light | complex                  (default: light)
  --fidelity <mode>    mirror | embed | describe        (default: derived from mode+level)
  --granularity <g>    coarse | fine (feature grouping) (default: coarse)
  --scratch            Build from a plan.json (greenfield), not a repo
  --plan <path>        The plan.json driving --scratch   (required with --scratch)
  --tdd                Emit test-first build guidance into the PRDs/REBUILD
  --check              Validate an existing --out tree for buildability, then exit
  --verify             Write a requirement\u2192source verification worklist for --out
  --review             Write the AI buildability review worklist for --out
  --brainstorm         Scaffold a BRAINSTORM.md into --out (divergent phase before building)
  --orchestrate        Emit the multi-agent orchestration for --out's CURRENT worklists
                       (per-phase workflows + agent contracts + RUNBOOK) into <out>/orchestration/
  --phase <name>       --orchestrate: emit one phase only \u2014 enrich-map | review-find |
                       review-verify | adjudicate (exit 2 if its worklist is missing)
  --eco                --orchestrate: emit only RUNBOOK.md + agents/*.md (sequential low-token path)
  --list               --orchestrate: print the {"phases":[...]} readiness JSON, write nothing
  --batch-size <n>     --orchestrate: items per subagent (default: per-phase, see below)
  --max-verify <n>     --verify: cap the requirement\u2194evidence worklist (default: 60)
  --force              Overwrite an --out tree that already holds ENRICHED prose
  --apply <path>       Apply an agent-filled verdicts/findings file (--verify/--review)
  --semantic           Fold VERIFY.json + REVIEW.json into --check (fail on unsupported reqs / blockers)
  --allow-unverified   With --check --semantic: downgrade a missing/unreadable ledger to a warning
  --include <glob>     Only analyze files matching glob (repeatable, comma-ok)
  --exclude <glob>     Skip files matching glob          (repeatable, comma-ok)
  --max-embed-bytes N  Max bytes embedded per file      (default: 16000)
  --merge              Also write RECONSTRUCTION.md (whole tree in one file)
  --summary            SUMMARY.md is written on every run; this only selects it
                       for the standalone (no --repo) bundling post-step
  --features           Also write FEATURES.md (every feature PRD, nothing else)
  --specs              Also write SPECS.md (whole spec, source code stripped \u2014 implement from this)
  --json               Print the inventory JSON only, write nothing
  -h, --help           Show this help
  -v, --version        Show version

Fidelity defaults:
  preserve+light  -> mirror     preserve+complex -> embed
  redesign+light  -> embed      redesign+complex -> describe

Brainstorm (optional divergent phase, before building):
  --brainstorm scaffolds a BRAINSTORM.md into --out \u2014 a divergent worklist for
  generating 3+ genuinely different directions, scoring them, and converging on
  one (with \u{1F9E0} callouts so --check gates an un-enriched brainstorm). If --out is
  an existing reconstruction (has inventory.json), it seeds the recovered surface
  so you brainstorm evolutions of what's built. Feed the chosen direction to the
  greenfield interview, or to iteration PRDs. See references/brainstorm-playbook.md.
    reconstruct --brainstorm --out ./ideas            # a fresh idea
    reconstruct --brainstorm --out ./reconstruction   # evolve an existing one

Orchestration (fan the judgment phases out to subagents):
  --orchestrate reads --out's CURRENT worklists and emits, per ready phase, a
  launchable multi-agent workflow (<out>/orchestration/<phase>.workflow.mjs), the
  agents/<role>.md dispatch contracts (drafter/finder/verifier/adjudicator) and a
  sequential RUNBOOK.md fallback. Phases: enrich-map (one drafter per
  inventory.json feature, grouped by workspace), review-find (one finder per
  flagged REVIEW.todo.json unit), review-verify (one independent verifier per
  open REVIEW.json blocker), adjudicate (one adjudicator per VERIFY.todo.json
  pair). Subagents RETURN fragments; the reduce (--review/--verify --apply and
  every doc merge) always stays with the orchestrator. Re-run it whenever a
  worklist changes \u2014 emission is deterministic and idempotent.
  Fan-out width: enrich-map/review-find dispatch ONE agent per item (the unit of
  work is a whole PRD); review-verify/adjudicate batch 4 (each item is one short
  judgement). Past 40 agents the batch grows instead of the fleet \u2014 always
  reported, never silent. --batch-size <n> overrides all of it.
    reconstruct --orchestrate --out <dir> [--phase <p>] [--eco] [--list]

Re-running over an existing --out:
  A normal (--repo / --scratch) run RE-RENDERS every document, so it would
  overwrite prose an agent already wrote. The CLI detects an ENRICHED tree \u2014 a
  document whose \u{1F9E0} callouts are all resolved, or a REVIEW.json/VERIFY.json
  ledger \u2014 and refuses the run. To continue an existing tree use --check /
  --review / --verify; to re-scaffold, point --out at a new directory; --force
  overwrites and LOSES the enrichment.

From scratch (greenfield):
  --scratch builds the SAME reconstruction tree from a plan.json interview
  instead of a repo. mode/fidelity collapse to scratch/describe; --level still
  applies (complex = deeper interview + alternatives). It also writes CONTEXT.md
  (glossary) and docs/adr/ (decisions), and links them from 00-overview.
    reconstruct --scratch --plan plan.json --out ./reconstruction --level complex

Bundling:
  SUMMARY.md (a one-page digest: stack, features in build order, interface/data
  counts, unknowns) is written on EVERY run \u2014 read it to orient instead of
  inventory.json, which carries one entry per analyzed file.
  --merge / --features / --specs during a normal run append the
  file(s) to the output tree. RECONSTRUCTION.md is the whole tree in one file
  (with the embedded source); SPECS.md is the same whole tree (architecture +
  features) with the source code stripped \u2014 the self-sufficient, code-free spec
  to hand an agent to implement from; FEATURES.md is the feature PRDs only.
  Used WITHOUT --repo, they run as a post-step on an existing reconstruction:
    reconstruct --merge --summary --features --specs --out <reconstruction-dir>

Validation:
  --check runs on an already-enriched output tree and exits non-zero if it is
  not buildable: a missing required document, unresolved \u{1F9E0} callouts or "fill
  this in" placeholders, a feature PRD missing a spine section or leaving one
  empty, or an architecture doc emptied of its contract (no entities in
  DATA-MODEL.md, no operations in INTERFACES.md). On the scratch path it also
  checks feature\u2192entity/operation reference integrity. An uncovered locale is
  reported as a warning. Run it before calling a reconstruction done:
    reconstruct --check --out <reconstruction-dir>

  --review drives the AI buildability review (the semantic layer --check can't
  judge). It writes a per-feature worklist (REVIEW.todo.json/REVIEW.md), flagging
  only the features that changed since the last round. An agent fans out one
  reviewer per flagged feature + one independent verifier per blocker, fills the
  findings, then applies them \u2014 the engine reduces them to a pass / no-progress
  signal so the convergence loop terminates (see references/orchestration.md):
    reconstruct --review --out <dir>
    reconstruct --review --apply findings.json --out <dir>
  --check --semantic folds VERIFY.json (refuted/unsupported requirements) and
  REVIEW.json (unresolved blockers) into the gate \u2014 additive, never a relaxation.
  It re-reduces the persisted verdicts/findings and re-resolves every cited
  evidenceRef against the inventory (a tampered or stale ok:true never passes),
  and it FAILS CLOSED: a missing or unreadable ledger is an error \u2014 run --verify
  and --review first, or pass --allow-unverified to downgrade it to a warning.
  --check, --verify and --review are mutually exclusive (run one at a time).
`;
function fail(message) {
  process.stderr.write(`reconstruct: ${message}
`);
  process.exit(1);
}
function oneOf(name2, value, allowed) {
  if (!allowed.includes(value)) {
    fail(`invalid --${name2} "${value}" (expected: ${allowed.join(", ")})`);
  }
  return value;
}
function defaultFidelity(mode, level) {
  if (mode === "preserve") return level === "light" ? "mirror" : "embed";
  return level === "light" ? "embed" : "describe";
}
function splitGlobs(value) {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}
var VALUE_FLAGS = /* @__PURE__ */ new Set([
  "repo",
  "out",
  "mode",
  "level",
  "fidelity",
  "granularity",
  "plan",
  "max-embed-bytes",
  "include",
  "exclude",
  "apply",
  "phase",
  "max-verify",
  "batch-size"
]);
function parseArgs(argv) {
  const raw = {};
  const includeGlobs = [];
  const excludeGlobs = [];
  let json = false;
  let merge = false;
  let summary = false;
  let features = false;
  let specs = false;
  let scratch = false;
  let tdd = false;
  let check = false;
  let verify = false;
  let review = false;
  let semantic = false;
  let allowUnverified = false;
  let brainstorm = false;
  let orchestrate = false;
  let eco = false;
  let list = false;
  let force = false;
  for (let i2 = 0; i2 < argv.length; i2++) {
    const arg = argv[i2];
    if (arg === "-h" || arg === "--help") {
      process.stdout.write(HELP2);
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
    if (arg === "--merge") {
      merge = true;
      continue;
    }
    if (arg === "--summary") {
      summary = true;
      continue;
    }
    if (arg === "--features") {
      features = true;
      continue;
    }
    if (arg === "--specs") {
      specs = true;
      continue;
    }
    if (arg === "--scratch") {
      scratch = true;
      continue;
    }
    if (arg === "--tdd") {
      tdd = true;
      continue;
    }
    if (arg === "--check") {
      check = true;
      continue;
    }
    if (arg === "--verify") {
      verify = true;
      continue;
    }
    if (arg === "--review") {
      review = true;
      continue;
    }
    if (arg === "--semantic") {
      semantic = true;
      continue;
    }
    if (arg === "--allow-unverified") {
      allowUnverified = true;
      continue;
    }
    if (arg === "--brainstorm") {
      brainstorm = true;
      continue;
    }
    if (arg === "--orchestrate") {
      orchestrate = true;
      continue;
    }
    if (arg === "--eco") {
      eco = true;
      continue;
    }
    if (arg === "--list") {
      list = true;
      continue;
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      const key = eq !== -1 ? arg.slice(2, eq) : arg.slice(2);
      if (!VALUE_FLAGS.has(key)) {
        fail(`unknown flag: --${key} (run --help for the supported options)`);
      }
      let value;
      if (eq !== -1) {
        value = arg.slice(eq + 1);
      } else {
        const next = argv[i2 + 1];
        if (next === void 0 || next.startsWith("--")) {
          fail(`missing value for --${key}`);
        }
        value = next;
        i2++;
      }
      if (key === "include") includeGlobs.push(...splitGlobs(value));
      else if (key === "exclude") excludeGlobs.push(...splitGlobs(value));
      else raw[key] = value;
      continue;
    }
    fail(`unexpected argument: ${arg} (run --help for usage)`);
  }
  const actions = [check, verify, review, brainstorm, orchestrate].filter(Boolean).length;
  if (actions > 1) {
    fail(`--check, --verify, --review, --brainstorm and --orchestrate are mutually exclusive \u2014 run one at a time`);
  }
  if (scratch && raw.plan === void 0) {
    fail(`--scratch requires --plan <path> (the plan.json produced by the interview)`);
  }
  const plan = raw.plan ? resolve5(raw.plan) : "";
  const standalone = (merge || summary || features || specs) && !json && !scratch && raw.repo === void 0;
  const repo = resolve5(raw.repo ?? process.cwd());
  if (!standalone && !scratch && !check && !verify && !review && !brainstorm && !orchestrate && (!existsSync15(repo) || !statSync7(repo).isDirectory())) {
    fail(`repo path is not a directory: ${repo}`);
  }
  const level = oneOf("level", raw.level ?? "light", ["light", "complex"]);
  const mode = scratch ? "scratch" : oneOf("mode", raw.mode ?? "preserve", ["preserve", "redesign"]);
  const fidelity = scratch ? "describe" : oneOf("fidelity", raw.fidelity ?? defaultFidelity(mode, level), ["mirror", "embed", "describe"]);
  const granularity = oneOf("granularity", raw.granularity ?? "coarse", ["coarse", "fine"]);
  const out2 = resolve5(
    raw.out ?? (standalone || check || verify || review || brainstorm || orchestrate ? process.cwd() : scratch ? join34(process.cwd(), "reconstruction") : join34(repo, "reconstruction"))
  );
  const maxEmbedBytes = raw["max-embed-bytes"] ? Number(raw["max-embed-bytes"]) : 16e3;
  if (!Number.isFinite(maxEmbedBytes) || maxEmbedBytes <= 0) {
    fail(`invalid --max-embed-bytes`);
  }
  const positive = (key) => {
    if (raw[key] === void 0) return void 0;
    const n = Number(raw[key]);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) fail(`invalid --${key}: expected a positive integer`);
    return n;
  };
  const maxVerify = positive("max-verify");
  const batchSize = positive("batch-size");
  return {
    repo,
    out: out2,
    mode,
    level,
    fidelity,
    granularity,
    include: includeGlobs,
    exclude: excludeGlobs,
    json,
    maxEmbedBytes,
    merge,
    summary,
    features,
    specs,
    standalone,
    scratch,
    plan,
    tdd,
    check,
    verify,
    review,
    apply: raw.apply ?? "",
    semantic,
    allowUnverified,
    brainstorm,
    orchestrate,
    phase: raw.phase ?? "",
    eco,
    list,
    force,
    ...maxVerify !== void 0 ? { maxVerify } : {},
    ...batchSize !== void 0 ? { batchSize } : {}
  };
}
function guardEnrichedOutput(opts) {
  if (opts.force || opts.json) return;
  const witnesses = detectEnrichment(opts.out);
  if (witnesses.length) fail(formatEnrichmentRefusal(opts.out, witnesses));
}
function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.verify) {
    try {
      if (opts.apply) {
        const r = applyVerdicts(opts.out, resolve5(opts.apply));
        process.stdout.write(formatVerifyReport(r) + "\n");
        if (!r.ok) process.exit(1);
        return;
      }
      const wl = runVerify(opts.out, { ...opts.maxVerify !== void 0 ? { maxVerify: opts.maxVerify } : {} });
      const { total, kept, capped } = wl.coverage;
      process.stderr.write(
        `reconstruct: ${kept} requirement\u2194evidence pair(s) \u2192 ${opts.out}/VERIFY.md & VERIFY.todo.json
` + // Never let a capped worklist read as full coverage.
        (capped ? `  \u26A0 coverage: ${kept} of ${total} requirement(s) \u2014 CAPPED; the other ${total - kept} go unadjudicated (raise with --max-verify ${total})
` : "") + `  adjudicate each verdict, save as verdicts.json, then: node scripts/analyze.mjs --verify --apply verdicts.json --out ${opts.out}
`
      );
      return;
    } catch (e) {
      fail(e.message);
    }
  }
  if (opts.review) {
    try {
      if (opts.apply) {
        const r = applyFindings(opts.out, resolve5(opts.apply));
        process.stdout.write(formatReviewReport(r) + "\n");
        if (!r.ok) process.exit(1);
        return;
      }
      const wl = runReview(opts.out);
      const due = wl.units.filter((u) => u.needsReview).length;
      process.stderr.write(
        `reconstruct: review round ${wl.round} \u2014 ${due}/${wl.units.length} unit(s) to review \u2192 ${opts.out}/REVIEW.md & REVIEW.todo.json
  review each flagged unit (+ verify each blocker), save findings.json, then: node scripts/analyze.mjs --review --apply findings.json --out ${opts.out}
`
      );
      return;
    } catch (e) {
      fail(e.message);
    }
  }
  if (opts.brainstorm) {
    const r = runBrainstorm(opts.out);
    process.stderr.write(
      `reconstruct: ${r.created ? "wrote" : "kept existing"} ${r.relPath}${r.seeded ? " (seeded from the recovered surface)" : " (blank scaffold)"} \u2192 ${opts.out}
  fill in the concepts + chosen direction, then gate it: node scripts/analyze.mjs --check --out ${opts.out}
`
    );
    return;
  }
  if (opts.orchestrate) {
    const engineAbs = realpathSync2(fileURLToPath2(import.meta.url));
    if (opts.list) {
      if (!existsSync15(opts.out)) {
        process.stderr.write(`reconstruct --orchestrate: out dir not found: ${opts.out}
`);
        process.exit(2);
      }
      process.stdout.write(JSON.stringify({ phases: listPhases(opts.out, engineAbs, opts.batchSize) }, null, 2) + "\n");
      return;
    }
    const res = orchestrateRun(opts.out, engineAbs, {
      phase: opts.phase || void 0,
      eco: opts.eco,
      ...opts.batchSize !== void 0 ? { batchSize: opts.batchSize } : {}
    });
    if (res.exitCode !== 0) {
      for (const e of res.errors) process.stderr.write(`reconstruct --orchestrate: ${e}
`);
      process.exit(res.exitCode);
    }
    process.stdout.write(`reconstruct --orchestrate: generated
${res.written.map((w) => `  ${w}`).join("\n")}
`);
    for (const n of res.notices) process.stderr.write(`reconstruct --orchestrate: note \u2014 ${n}
`);
    const workflows = res.written.filter((w) => w.endsWith(".workflow.mjs"));
    if (workflows.length) {
      process.stdout.write(
        `
${workflows.map((w) => `Launch: Workflow({ scriptPath: ${JSON.stringify(w)} })`).join("\n")}
Then fold the returned fragments in yourself (single serial reducer) and run the fold command shown at the end of each workflow.
`
      );
    } else {
      process.stdout.write(`Follow ${join34(opts.out, "orchestration", "RUNBOOK.md")} sequentially (the eco path).
`);
    }
    if (!opts.phase && workflows.length === 0 && !opts.eco) {
      process.stderr.write(`reconstruct --orchestrate: no ready phase \u2014 phases are ${PHASES.join(", ")} (see --list).
`);
    }
    return;
  }
  if (opts.check) {
    const result = checkOutput(opts.out);
    if (opts.semantic) {
      foldSemantic(opts.out, result, { allowUnverified: opts.allowUnverified });
      foldReview(opts.out, result, { allowUnverified: opts.allowUnverified });
    }
    process.stdout.write(formatCheckReport(result, opts.out) + "\n");
    if (result.errors.length) process.exit(1);
    return;
  }
  if (opts.scratch) {
    let plan;
    try {
      plan = loadPlan(opts.plan);
    } catch (e) {
      fail(e.message);
    }
    const consistency = validatePlanConsistency(plan);
    if (consistency.errors.length) {
      fail(`plan.json is internally inconsistent (fix these before rendering):
  - ` + consistency.errors.join("\n  - "));
    }
    const effOpts = { ...opts, tdd: opts.tdd || !!plan.tdd };
    const inv2 = planToInventory(plan, effOpts);
    if (effOpts.json) {
      process.stdout.write(JSON.stringify(inv2, null, 2) + "\n");
      return;
    }
    guardEnrichedOutput(effOpts);
    const result = render(inv2, effOpts);
    writeOutput(result, effOpts);
    const docs = writeArtifactsIfAbsent(renderScratchDocs(plan), effOpts.out);
    const adrCount = docs.filter((p) => p.startsWith("docs/adr/")).length;
    const lines2 = [
      `reconstruct: planned ${inv2.repoName} from scratch (${inv2.features.length} feature(s))`,
      `  stack:    ${inv2.stack.primaryLanguage}${inv2.stack.frameworks.length ? " \xB7 " + inv2.stack.frameworks.join(", ") : ""}`,
      `  surface:  ${inv2.features.length} feature(s) \xB7 ${inv2.interfaces?.length ?? 0} interface(s) \xB7 ${inv2.dataModel?.length ?? 0} entit(y/ies) \xB7 ${inv2.i18n ? inv2.i18n.locales.length : 0} locale(s)`,
      `  docs:     ${docs.includes("CONTEXT.md") ? "CONTEXT.md" : "CONTEXT.md (kept existing)"}${adrCount ? ` + ${adrCount} ADR(s)` : ""} (written if absent)`,
      ...consistency.warnings.length ? [`  warnings: ${consistency.warnings.length} consistency warning(s) to resolve while enriching:`, ...consistency.warnings.map((w) => `    \u26A0 ${w}`)] : [],
      ...effOpts.tdd ? [`  tdd:      test-first build guidance embedded in the PRDs`] : [],
      ...effOpts.features ? [`  features: FEATURES.md (feature PRDs only)`] : [],
      ...effOpts.specs ? [`  specs:    SPECS.md (whole spec, source stripped)`] : [],
      ...effOpts.merge ? [`  merged:   RECONSTRUCTION.md (whole tree in one file)`] : [],
      `  output:   ${effOpts.out}`,
      `  next:     read ${join34(effOpts.out, "SUMMARY.md")} to orient, then ${join34(effOpts.out, effOpts.merge ? "RECONSTRUCTION.md" : "REBUILD.md")}`
    ];
    process.stderr.write(lines2.join("\n") + "\n");
    return;
  }
  if (opts.standalone) {
    let result;
    try {
      result = bundleExisting(opts);
    } catch (e) {
      fail(e.message);
    }
    writeOutput(result, opts);
    const made = [
      ...opts.summary ? ["SUMMARY.md"] : [],
      ...opts.features ? ["FEATURES.md"] : [],
      ...opts.specs ? ["SPECS.md"] : [],
      ...opts.merge ? ["RECONSTRUCTION.md"] : []
    ];
    process.stderr.write(`reconstruct: bundled ${made.join(" + ")} into ${opts.out}
`);
    return;
  }
  let inv;
  try {
    inv = analyze(opts);
  } catch (e) {
    fail(e.message);
  }
  if (opts.json) {
    process.stdout.write(JSON.stringify(inv, null, 2) + "\n");
    return;
  }
  guardEnrichedOutput(opts);
  try {
    const result = render(inv, opts);
    writeOutput(result, opts);
  } catch (e) {
    fail(e.message);
  }
  const hintTotal = inv.hints.routeCandidates.length + inv.hints.apiCandidates.length + inv.hints.schemaCandidates.length + inv.hints.realtimeCandidates.length + inv.hints.authCandidates.length + inv.hints.designSystemCandidates.length;
  const lines = [
    `reconstruct: analyzed ${inv.fileCount} files (${inv.totalLines} lines) in ${inv.repoName}`,
    `  stack:    ${inv.stack.primaryLanguage}${inv.stack.frameworks.length ? " \xB7 " + inv.stack.frameworks.join(", ") : ""}`,
    `  libs:     ${inv.stack.libraries.length ? inv.stack.libraries.join(", ") : "\u2014"}`,
    `  features: ${inv.features.length} \xB7 routes: ${inv.routes.length} \xB7 locales: ${inv.i18n ? inv.i18n.locales.length : 0}`,
    `  hints:    ${hintTotal} candidate(s) to verify (routes/API/schema/realtime/auth/design-system) \xB7 ${inv.hints.entryPoints.length} entry point(s)`,
    ...inv.workspaces ? [`  monorepo: ${inv.workspaces.length} workspace(s) \xB7 ${inv.workspaces.reduce((n, w) => n + (w.dependsOn?.length ?? 0), 0)} dependency edge(s)`] : [],
    `  excluded: ${inv.excludedCount} file(s) skipped by ignore rules${opts.include.length || opts.exclude.length ? " + scoping globs" : ""}`,
    ...inv.warnings?.length ? [`  warnings: ${inv.warnings.length} analysis warning(s) \u2014 detection degraded, verify these by hand:`, ...inv.warnings.map((w) => `    \u26A0 ${w}`)] : [],
    ...inv.unknowns.length ? [`  unknowns: ${inv.unknowns.length} item(s) for the agent to resolve (see inventory.json)`] : [],
    `  mode/level/fidelity/granularity: ${opts.mode}/${opts.level}/${opts.fidelity}/${opts.granularity}`,
    ...opts.features ? [`  features: FEATURES.md (feature PRDs only)`] : [],
    ...opts.specs ? [`  specs:    SPECS.md (whole spec, source stripped)`] : [],
    ...opts.merge ? [`  merged:   RECONSTRUCTION.md (whole tree in one file)`] : [],
    `  output:   ${opts.out}`,
    // Orient from SUMMARY.md, not inventory.json: same picture, a fraction of the
    // tokens (inventory.json carries one entry per analyzed file).
    `  next:     read ${join34(opts.out, "SUMMARY.md")} to orient, then ${join34(opts.out, opts.merge ? "RECONSTRUCTION.md" : "REBUILD.md")}`
  ];
  process.stderr.write(lines.join("\n") + "\n");
}
function isInvokedDirectly() {
  const argv1 = process.argv[1];
  if (argv1 === void 0) return false;
  const modulePath = fileURLToPath2(import.meta.url);
  try {
    if (realpathSync2(argv1) === realpathSync2(modulePath)) return true;
  } catch {
  }
  return import.meta.url === pathToFileURL(argv1).href;
}
if (isInvokedDirectly()) main();
export {
  parseArgs
};
// "Copyright" and "@license" are already caught by DIRECTIVE_RE.
