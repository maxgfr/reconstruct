#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};

// src/types.ts
var ENGINE_VERSION, SCHEMA_VERSION, EXTRACTOR_VERSION;
var init_types = __esm({
  "src/types.ts"() {
    "use strict";
    ENGINE_VERSION = "2.28.0";
    SCHEMA_VERSION = 5;
    EXTRACTOR_VERSION = 13;
  }
});

// src/util.ts
import { spawnSync } from "child_process";
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
function droppedKeywords(question) {
  const out2 = [];
  for (const raw of foldText(question).split(/[^A-Za-z0-9_]+/)) {
    if (!raw) continue;
    if (raw.length < 2 || STOPWORDS.has(raw.toLowerCase())) out2.push(raw);
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
function stemOf(term) {
  if (term.length < 4) return term;
  let t = term;
  if (t.endsWith("ies") && t.length > 4) t = t.slice(0, -3) + "y";
  else if (t.endsWith("sses")) t = t.slice(0, -2);
  else if (t.endsWith("ses") && t.length > 4) t = t.slice(0, -1);
  else if (t.endsWith("s") && !t.endsWith("ss") && !t.endsWith("us") && !t.endsWith("is")) t = t.slice(0, -1);
  if (t.endsWith("ying") && t.length > 5) t = t.slice(0, -4) + "y";
  else if (t.endsWith("ing") && t.length > 5) t = t.slice(0, -3);
  else if (t.endsWith("ed") && t.length > 4) t = t.slice(0, -2);
  if (t.endsWith("e") && t.length > 3) t = t.slice(0, -1);
  return t;
}
var whichCache, STOPWORDS;
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

// src/ignore.ts
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
function isIgnored(rules, rel2, isDir) {
  let ignored = false;
  for (const rule of rules) {
    if (rule.dirOnly && !isDir) continue;
    if (rule.re.test(rel2)) ignored = !rule.negated;
  }
  return ignored;
}
var init_ignore = __esm({
  "src/ignore.ts"() {
    "use strict";
    init_util();
  }
});

// src/walk.ts
import { readdirSync, statSync, lstatSync, readFileSync, realpathSync } from "fs";
import { join, sep, extname } from "path";
function walk(root, opts = {}) {
  const maxFileBytes = opts.maxFileBytes ?? 1024 * 1024;
  const maxFiles = opts.maxFiles ?? Infinity;
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
      const rel2 = frame.rel ? `${frame.rel}/${name2}` : name2;
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
        if (useGitignore && rules.length && isIgnored(rules, rel2, true)) continue;
        stack.push({ dir: abs, rel: rel2, rules });
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
      if (useGitignore && rules.length && isIgnored(rules, rel2, false)) {
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
      out2.push({ rel: rel2.split(sep).join("/"), abs, size: st.size, ext, mtimeMs: st.mtimeMs });
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
var IGNORE_DIRS, LOCKFILES, BINARY_EXT, DEFAULT_MAX_FILES;
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

// src/git.ts
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
  const num2 = sh("git", [...gitArgs(dir), "diff", "-z", "-M", "--numstat", ...rangeArgs(spec)]);
  if (num2.ok) {
    const toks = num2.stdout.split("\0");
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
var gitArgs, rangeArgs;
var init_git = __esm({
  "src/git.ts"() {
    "use strict";
    init_util();
    gitArgs = (dir) => ["-C", dir, "-c", "core.quotePath=false"];
    rangeArgs = (spec) => spec.staged ? ["--cached"] : [spec.mergeBase];
  }
});

// src/hash.ts
import { createHash } from "crypto";
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

// src/lang/common.ts
function scan(rel2, content, lang, rules) {
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
        file: rel2,
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
function blankComments(src) {
  const out2 = src.split("");
  let i2 = 0;
  const n = src.length;
  while (i2 < n) {
    const c2 = src[i2];
    const next = src[i2 + 1];
    if (c2 === "/" && next === "/") {
      while (i2 < n && src[i2] !== "\n") {
        out2[i2] = " ";
        i2++;
      }
      continue;
    }
    if (c2 === "/" && next === "*") {
      while (i2 < n && !(src[i2] === "*" && src[i2 + 1] === "/")) {
        if (src[i2] !== "\n") out2[i2] = " ";
        i2++;
      }
      if (i2 < n) out2[i2] = " ";
      if (i2 + 1 < n) out2[i2 + 1] = " ";
      i2 += 2;
      continue;
    }
    if (c2 === '"' || c2 === "'" || c2 === "`") {
      const quote = c2;
      i2++;
      while (i2 < n && src[i2] !== quote) {
        if (src[i2] === "\\") i2++;
        i2++;
      }
      i2++;
      continue;
    }
    i2++;
  }
  return out2.join("");
}
function extractReexports(rel2, content, localSymbols) {
  if (!REEXPORT_EXTS.has(rel2.slice(rel2.lastIndexOf(".")))) return [];
  const lang = /\.(ts|tsx|mts|cts)$/.test(rel2) ? "typescript" : "javascript";
  const out2 = [];
  const seen = /* @__PURE__ */ new Set();
  const lineAt = (idx) => content.slice(0, idx).split(/\r?\n/).length;
  const localDeclOf = /* @__PURE__ */ new Map();
  for (const s of localSymbols) if (!localDeclOf.has(s.name)) localDeclOf.set(s.name, s);
  const scanned = blankComments(content);
  const named = /export\s*\{([\s\S]*?)\}\s*(?:from\s*['"]([^'"]+)['"])?\s*;?/g;
  let m;
  while ((m = named.exec(scanned)) && out2.length < MAX_REEXPORTS) {
    const from = m[2];
    const listAt = m.index + m[0].indexOf("{") + 1;
    let cursor = 0;
    for (const part of m[1].split(",")) {
      const partAt = listAt + cursor;
      cursor += part.length + 1;
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
        file: rel2,
        line: decl ? decl.line : lineAt(partAt),
        ...decl?.endLine !== void 0 ? { endLine: decl.endLine } : {},
        signature: from ? `export { ${name2} } from "${from}"` : `export { ${name2} }`,
        exported: true,
        lang
      });
    }
  }
  const star = /export\s*\*\s*(?:as\s+([A-Za-z_$][\w$]*)\s+)?from\s*['"]([^'"]+)['"]/g;
  while ((m = star.exec(scanned)) && out2.length < MAX_REEXPORTS) {
    const ns = m[1];
    const from = m[2];
    const key = "*" + (ns ?? from);
    if (seen.has(key)) continue;
    seen.add(key);
    out2.push({
      name: ns ?? `* (${from})`,
      kind: ns ? "reexport" : "reexport-all",
      file: rel2,
      line: lineAt(m.index),
      signature: `export * ${ns ? `as ${ns} ` : ""}from "${from}"`,
      exported: true,
      lang
    });
  }
  return out2;
}
var EXT_LANG, REEXPORT_EXTS, MAX_REEXPORTS;
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
      ".astro": "astro",
      // Extended-tier AST languages (src/ast/loader.ts EXT_GRAMMAR). Without an
      // entry here `extToLang` answered "other", which `classify` reads as non-code
      // — so a real scan never called extractCode for them and they extracted
      // nothing, while the quality harness (which calls extractCode directly)
      // published a perfect score. The grammar still arrives via `grammars pull`;
      // absent it these fall back to the regex tier like any other language.
      ".zig": "zig",
      ".hcl": "hcl",
      ".tf": "terraform",
      ".tfvars": "terraform",
      ".sol": "solidity"
    };
    REEXPORT_EXTS = /* @__PURE__ */ new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
    MAX_REEXPORTS = 400;
  }
});

// src/lang/js-ts.ts
function stemOf2(rel2) {
  return (rel2.split("/").pop() ?? "").replace(/\.[^.]+$/, "");
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
var RULES, ANON_DEFAULT_RE, NAMED_DEFAULT_RE, EXPORT_LIST_RE, CJS_OBJECT_RE, DEFAULT_ID_RE, jsTs;
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
      // A module constant bound to a VALUE, not exported: `const RE = /href=/g`.
      // The AST tier indexes these (a top-level binding is a declaration, only an
      // in-function one is a local), and a fallback tier that answers "no such
      // symbol" for every module constant diverges from the engine it stands in for.
      //
      // Anchored at column 0, unlike every rule above it: a line scanner cannot see
      // scope, so `^\s*` here would sweep in each `const x = 1` inside every function
      // body — the locals-flood the AST tier's inFunctionBody filter exists to
      // prevent, and the surplus this project criticises in a flat tags file. Column
      // 0 is the one module-scope proxy a line can carry. Must stay AFTER the arrow
      // and export rules: `scan()` keeps the first rule that matches a line.
      { re: /^(?:const|let|var)\s+(?<name>[\w$]+)\s*[:=]/, kind: "const", exported: false },
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
      extract(rel2, content) {
        const lang = rel2.match(/\.(ts|tsx|mts|cts)$/) ? "typescript" : "javascript";
        const symbols = scan(rel2, content, lang, RULES);
        const lines = content.split(/\r?\n/);
        for (let i2 = 0; i2 < lines.length; i2++) {
          const line = lines[i2];
          if (ANON_DEFAULT_RE.test(line) && !NAMED_DEFAULT_RE.test(line)) {
            symbols.push({
              name: stemOf2(rel2),
              kind: "default",
              file: rel2,
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

// src/lang/python.ts
var pub, RULES2, python;
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
      extract(rel2, content) {
        return scan(rel2, content, "python", RULES2);
      }
    };
  }
});

// src/lang/go.ts
var upper, RULES3, go;
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
      extract(rel2, content) {
        return scan(rel2, content, "go", RULES3);
      }
    };
  }
});

// src/lang/ruby.ts
var RULES4, ruby;
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
      extract(rel2, content) {
        return scan(rel2, content, "ruby", RULES4);
      }
    };
  }
});

// src/lang/java.ts
var RULES5, java;
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
      extract(rel2, content) {
        return scan(rel2, content, "java", RULES5);
      }
    };
  }
});

// src/lang/rust.ts
var isPub, RULES6, rust;
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
      extract(rel2, content) {
        return scan(rel2, content, "rust", RULES6);
      }
    };
  }
});

// src/lang/csharp.ts
var pub2, RULES7, csharp;
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
      extract(rel2, content) {
        return scan(rel2, content, "csharp", RULES7);
      }
    };
  }
});

// src/lang/php.ts
var RULES8, php;
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
      extract(rel2, content) {
        return scan(rel2, content, "php", RULES8);
      }
    };
  }
});

// src/lang/swift.ts
var vis, MODS, RULES9, swift;
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
      extract(rel2, content) {
        return scan(rel2, content, "swift", RULES9);
      }
    };
  }
});

// src/lang/kotlin.ts
var vis2, RULES10, kotlin;
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
      extract(rel2, content) {
        return scan(rel2, content, "kotlin", RULES10);
      }
    };
  }
});

// src/lang/c.ts
var NOT_KEYWORD, RULES11, c;
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
      extract(rel2, content) {
        return scan(rel2, content, rel2.match(/\.(c|h)$/) ? "c" : "cpp", RULES11);
      }
    };
  }
});

// src/lang/lua.ts
var RULES12, lua;
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
      extract(rel2, content) {
        return scan(rel2, content, "lua", RULES12);
      }
    };
  }
});

// src/lang/shell.ts
var RULES13, shell;
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
      extract(rel2, content) {
        return scan(rel2, content, "shell", RULES13);
      }
    };
  }
});

// src/lang/elixir.ts
var RULES14, elixir;
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
      extract(rel2, content) {
        return scan(rel2, content, "elixir", RULES14);
      }
    };
  }
});

// src/lang/scala.ts
var RULES15, scala;
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
      extract(rel2, content) {
        return scan(rel2, content, "scala", RULES15);
      }
    };
  }
});

// src/lang/dart.ts
var vis3, RULES16, dart;
var init_dart = __esm({
  "src/lang/dart.ts"() {
    "use strict";
    init_common();
    vis3 = (m) => !(m.groups?.name ?? "").startsWith("_");
    RULES16 = [
      {
        re: /^\s*(?:abstract\s+|base\s+|final\s+|sealed\s+|interface\s+)*class\s+(?<name>\w+)/,
        kind: "class",
        exported: vis3
      },
      { re: /^\s*mixin\s+(?<name>\w+)/, kind: "mixin", exported: vis3 },
      { re: /^\s*extension\s+(?<name>\w+)/, kind: "extension", exported: vis3 },
      { re: /^\s*enum\s+(?<name>\w+)/, kind: "enum", exported: vis3 },
      { re: /^\s*typedef\s+(?<name>\w+)/, kind: "type", exported: vis3 },
      // A method or function: a return type (or `void`/`Future<…>`) then a name and
      // an argument list. `get`/`set` accessors are matched by their own rule below
      // so the accessor keyword does not read as the name.
      {
        re: /^\s*(?:@\w+\s+)*(?:static\s+|final\s+|const\s+|external\s+|abstract\s+)*(?:[\w<>,?\[\]. ]+\s+)?(?<name>\w+)\s*\([^)]*\)\s*(?:async\s*\*?\s*)?(?:=>|\{|;)/,
        kind: "function",
        exported: vis3
      },
      { re: /^\s*(?:static\s+)?[\w<>,?\[\]. ]+\s+get\s+(?<name>\w+)/, kind: "getter", exported: vis3 },
      { re: /^\s*(?:static\s+)?set\s+(?<name>\w+)\s*\(/, kind: "setter", exported: vis3 }
    ];
    dart = {
      lang: "dart",
      exts: [".dart"],
      extract(rel2, content) {
        return scan(rel2, content, "dart", RULES16);
      }
    };
  }
});

// src/lang/registry.ts
function extractSymbols(rel2, ext, content) {
  const extractor = BY_EXT.get(ext);
  let symbols;
  if (!extractor) symbols = [];
  else {
    try {
      symbols = extractor.extract(rel2, content);
    } catch {
      symbols = [];
    }
  }
  const known = new Set(symbols.map((s) => s.name));
  const reexports = extractReexports(rel2, content, symbols).filter((s) => !known.has(s.name));
  return reexports.length ? [...symbols, ...reexports] : symbols;
}
function languageOf(ext) {
  return BY_EXT.get(ext)?.lang ?? extToLang(ext);
}
var EXTRACTORS, BY_EXT;
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
    init_dart();
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
      scala,
      dart
    ];
    BY_EXT = /* @__PURE__ */ new Map();
    for (const e of EXTRACTORS) for (const ext of e.exts) BY_EXT.set(ext, e);
  }
});

// src/classify.ts
function isDoc(rel2, ext) {
  const base = rel2.split("/").pop().toLowerCase();
  return DOC_EXT.has(ext) || DOC_BASENAME.test(base) || DOC_DIR.test(rel2);
}
function isConfig(rel2, ext) {
  const base = rel2.split("/").pop().toLowerCase();
  return CONFIG_BASENAME.has(base) || CONFIG_EXT.has(ext);
}
function isCode(ext) {
  return !NON_CODE_LANGS.has(languageOf(ext));
}
function classify(rel2, ext) {
  if (isCode(ext)) return "code";
  if (isDoc(rel2, ext)) return "doc";
  if (isConfig(rel2, ext)) return "config";
  return "other";
}
var DOC_BASENAME, DOC_EXT, DOC_DIR, CONFIG_BASENAME, CONFIG_EXT, MARKDOWN_EXT, NON_CODE_LANGS;
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

// src/glob.ts
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
  return (rel2) => res.some((r) => r.test(rel2));
}
function compileGlobFilter(globs) {
  if (!globs || globs.length === 0) return null;
  const include = compileGlobs(globs.filter((g) => !g.startsWith("!")));
  const exclude = compileGlobs(globs.filter((g) => g.startsWith("!")).map((g) => g.slice(1)));
  return (rel2) => (!include || include(rel2)) && !exclude?.(rel2);
}
var init_glob = __esm({
  "src/glob.ts"() {
    "use strict";
    init_util();
  }
});

// src/sort.ts
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

// src/extract/markdown.ts
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

// src/extract/literals.ts
function isInterestingString(value) {
  if (value.length < MIN_LITERAL_LEN || value.length > MAX_LITERAL_LEN) return false;
  return HAS_SUBSTANCE.test(value);
}
function isInterestingNumber(raw) {
  const v = raw.trim();
  if (!v || v.length > MAX_LITERAL_LEN) return false;
  if (TRIVIAL_NUMBERS.has(v)) return false;
  return Number.isFinite(Number(v));
}
function unquote(text) {
  let s = text;
  const raw = /^(?:[rRbBuUfF]{1,2}|@|\$)?(?:#*)?(['"`])/.exec(s);
  if (raw) {
    const q = raw[1];
    const start2 = s.indexOf(q);
    const end = s.lastIndexOf(q);
    if (end > start2) s = s.slice(start2 + 1, end);
  }
  return s;
}
var MAX_LITERAL_LEN, MIN_LITERAL_LEN, MAX_LITERALS, TRIVIAL_NUMBERS, HAS_SUBSTANCE, LiteralCollector;
var init_literals = __esm({
  "src/extract/literals.ts"() {
    "use strict";
    init_sort();
    MAX_LITERAL_LEN = 80;
    MIN_LITERAL_LEN = 2;
    MAX_LITERALS = 256;
    TRIVIAL_NUMBERS = /* @__PURE__ */ new Set(["0", "1", "-1", "2", "-2"]);
    HAS_SUBSTANCE = /[\p{L}\p{N}]/u;
    LiteralCollector = class {
      seen = /* @__PURE__ */ new Set();
      out = [];
      get full() {
        return this.out.length >= MAX_LITERALS;
      }
      add(kind, value, line) {
        if (this.full) return;
        if (kind === "string" && !isInterestingString(value)) return;
        if (kind === "number" && !isInterestingNumber(value)) return;
        if (kind === "regex" && !value) return;
        const key = `${kind}\0${value}\0${line}`;
        if (this.seen.has(key)) return;
        this.seen.add(key);
        this.out.push({ value, line, kind });
      }
      addString(text, line) {
        this.add("string", unquote(text), line);
      }
      result() {
        if (!this.out.length) return void 0;
        return this.out.sort((a, b) => byStr(a.value, b.value) || a.line - b.line || byStr(a.kind, b.kind));
      }
    };
  }
});

// node_modules/.pnpm/web-tree-sitter@0.26.12/node_modules/web-tree-sitter/web-tree-sitter.js
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
          return new Promise((resolve5, reject) => {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.responseType = "arraybuffer";
            xhr.onload = () => {
              if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                resolve5(xhr.response);
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
      return new Promise((resolve5, reject) => {
        Module["instantiateWasm"](info2, (mod, inst) => {
          resolve5(receiveInstance(mod, inst));
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
  var bigintToI53Checked = /* @__PURE__ */ __name((num2) => num2 < INT53_MIN || num2 > INT53_MAX ? NaN : Number(num2), "bigintToI53Checked");
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
    var num2 = 0;
    for (var i2 = 0; i2 < iovcnt; i2++) {
      var ptr = LE_HEAP_LOAD_U32((iov >> 2) * 4);
      var len = LE_HEAP_LOAD_U32((iov + 4 >> 2) * 4);
      iov += 8;
      for (var j = 0; j < len; j++) {
        printChar(fd, HEAPU8[ptr + j]);
      }
      num2 += len;
    }
    LE_HEAP_STORE_U32((pnum >> 2) * 4, num2);
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
    moduleRtn = new Promise((resolve5, reject) => {
      readyPromiseResolve = resolve5;
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
var __defProp2, __name, Edit, SIZE_OF_SHORT, SIZE_OF_INT, SIZE_OF_CURSOR, SIZE_OF_NODE, SIZE_OF_POINT, SIZE_OF_RANGE, ZERO_POINT, INTERNAL, C, LookaheadIterator, Tree, TreeCursor, Node, LANGUAGE_FUNCTION_REGEX, Language, web_tree_sitter_default, Module3, TRANSFER_BUFFER, LANGUAGE_VERSION, MIN_COMPATIBLE_VERSION, Parser, PREDICATE_STEP_TYPE_CAPTURE, PREDICATE_STEP_TYPE_STRING, QUERY_WORD_REGEX, CaptureQuantifier, isCaptureStep, isStringStep, QueryErrorKind, QueryError, Query;
var init_web_tree_sitter = __esm({
  "node_modules/.pnpm/web-tree-sitter@0.26.12/node_modules/web-tree-sitter/web-tree-sitter.js"() {
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

// src/ast/loader.ts
import { readFileSync as readFileSync2, existsSync } from "fs";
import { homedir } from "os";
import { dirname, join as join2 } from "path";
import { fileURLToPath } from "url";
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
  const withDirs = (tier, dir) => ({
    tier,
    dir,
    cacheDir,
    dirs: [dir, ...existsSync(join2(dir, "..", EXTENDED_DIR)) ? [join2(dir, "..", EXTENDED_DIR)] : []]
  });
  const legacy = process.env.CODEINDEX_GRAMMAR_DIR ?? process.env.ULTRAINDEX_GRAMMAR_DIR;
  if (legacy && legacy.trim() && existsSync(legacy)) return withDirs("env", legacy);
  const here = opts.moduleDir ?? dirname(fileURLToPath(import.meta.url));
  const adjacent = [
    join2(here, "grammars"),
    // bundle: <...>/scripts/grammars
    join2(here, "..", "..", "scripts", "grammars"),
    // dev: src/ast → <repo>/scripts/grammars
    join2(here, "..", "scripts", "grammars")
  ];
  for (const c2 of adjacent) if (existsSync(c2)) return withDirs("adjacent", c2);
  const env = process.env.CODEINDEX_GRAMMARS_DIR;
  if (env && env.trim() && existsSync(env)) return withDirs("env", env);
  if (existsSync(cacheDir)) return withDirs("cache", cacheDir);
  return { tier: "none", cacheDir, dirs: [] };
}
function resolveGrammarsDir(opts) {
  return resolveGrammarsTier(opts).dir;
}
async function ensureGrammars(keys) {
  const { dirs } = resolveGrammarsTier();
  if (!dirs.length) return;
  const firstIn = (name2) => {
    for (const d of dirs) {
      const p = join2(d, name2);
      if (existsSync(p)) return p;
    }
    return void 0;
  };
  if (!runtimeReady) {
    const runtime = firstIn("web-tree-sitter.wasm");
    if (!runtime) return;
    await Parser.init({ wasmBinary: readFileSync2(runtime) });
    runtimeReady = true;
    parser = new Parser();
  }
  for (const key of new Set(keys)) {
    if (loaded.has(key) || failed.has(key)) continue;
    const wasm = firstIn(`${key}.wasm`);
    if (!wasm) {
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
function languageFor(key) {
  return loaded.get(key);
}
function parserFor(key) {
  const lang = loaded.get(key);
  if (!parser || !lang) return null;
  parser.setLanguage(lang);
  return parser;
}
var CORE_GRAMMARS, EXTENDED_GRAMMARS, EXT_GRAMMAR, EXTENDED_DIR, runtimeReady, parser, loaded, failed;
var init_loader = __esm({
  "src/ast/loader.ts"() {
    "use strict";
    init_web_tree_sitter();
    init_types();
    CORE_GRAMMARS = /* @__PURE__ */ new Set([
      "typescript",
      "tsx",
      "javascript",
      "python",
      "go",
      "rust",
      "java",
      "ruby",
      "c",
      "cpp",
      "c_sharp",
      "php",
      "scala",
      "bash",
      "lua"
    ]);
    EXTENDED_GRAMMARS = /* @__PURE__ */ new Set(["kotlin", "elixir", "zig", "hcl", "terraform", "solidity"]);
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
      ".lua": "lua",
      // Extended tier — resolvable only after a `grammars pull`.
      ".kt": "kotlin",
      ".kts": "kotlin",
      ".ex": "elixir",
      ".exs": "elixir",
      ".zig": "zig",
      ".hcl": "hcl",
      ".tf": "terraform",
      ".tfvars": "terraform",
      ".sol": "solidity"
    };
    EXTENDED_DIR = "grammars-extended";
    runtimeReady = false;
    parser = null;
    loaded = /* @__PURE__ */ new Map();
    failed = /* @__PURE__ */ new Set();
  }
});

// src/ast/node.ts
function findFirst(node, pred) {
  for (const c2 of node.namedChildren) {
    if (pred(c2)) return c2;
    const deep = findFirst(c2, pred);
    if (deep) return deep;
  }
  return void 0;
}
function nameOf(node) {
  const named = node.childForFieldName("name");
  if (named?.text) return named.text;
  let decl = node.childForFieldName("declarator");
  while (decl) {
    const inner = decl.childForFieldName("name");
    if (inner?.text) return inner.text;
    if (decl.namedChildren.length === 0 && /(^|_)identifier$/.test(decl.type)) return decl.text;
    const next = decl.childForFieldName("declarator");
    if (!next || next === decl) break;
    decl = next;
  }
  const varDecl = findFirst(node, (n) => n.type === "variable_declarator");
  const varName = varDecl?.childForFieldName("name");
  if (varName?.text) return varName.text;
  for (const c2 of node.namedChildren) {
    if (/(^|_)(identifier|name|constant)$/.test(c2.type)) return c2.text;
  }
  return void 0;
}
function readName(node) {
  if (!node) return void 0;
  const kids = node.namedChildren;
  if (kids.length === 0) return IDENT_LEAF.test(node.type) ? node.text : void 0;
  const seg = node.childForFieldName("name") ?? node.childForFieldName("property") ?? node.childForFieldName("attribute") ?? node.childForFieldName("field") ?? // Callee wrappers that point at the real callee via a `function` field:
  // scala's generic_function (`foo[Int](x)`) and a curried/chained
  // call_expression callee (`curried(a)(b)`) — descend to the inner name
  // instead of tripping over type_arguments/arguments as the last child.
  node.childForFieldName("function");
  if (seg) return readName(seg);
  const last = kids[kids.length - 1];
  return last && last !== node ? readName(last) : void 0;
}
function readReceiver(node) {
  if (!node || node.namedChildren.length === 0) return void 0;
  const obj = node.childForFieldName("object") ?? node.childForFieldName("operand") ?? node.childForFieldName("value") ?? node.childForFieldName("path") ?? node.childForFieldName("expression") ?? node.childForFieldName("argument") ?? node.childForFieldName("receiver") ?? node.childForFieldName("table");
  const name2 = obj ? readName(obj) : void 0;
  return name2 && /^[A-Za-z_]\w*$/.test(name2) ? name2 : void 0;
}
function readTypeName(node) {
  if (!node) return void 0;
  const base = node.childForFieldName("type") ?? node.childForFieldName("name");
  if (base && /generic|qualified|scoped|nested/.test(node.type)) return readTypeName(base);
  if (node.namedChildren.length === 0) return TYPE_LEAF.test(node.type) ? node.text : void 0;
  let last;
  const visit = (n) => {
    if (n.namedChildren.length === 0) {
      if (TYPE_LEAF.test(n.type)) last = n.text;
      return;
    }
    if (/arguments|parameters/.test(n.type)) return;
    for (const c2 of n.namedChildren) visit(c2);
  };
  visit(node);
  return last;
}
var IDENT_LEAF, TYPE_LEAF;
var init_node = __esm({
  "src/ast/node.ts"() {
    "use strict";
    IDENT_LEAF = /(^|_)(identifier|name|constant|word)$/;
    TYPE_LEAF = /identifier|constant|(^|_)name$/;
  }
});

// src/ast/specs.ts
function heritageTargets(clause) {
  if (!clause) return [];
  const out2 = [];
  for (const c2 of clause.namedChildren) {
    if (/arguments|parameters/.test(c2.type)) continue;
    const n = readTypeName(c2);
    if (n) out2.push(n);
  }
  return out2;
}
function tsHeritage(node, ctx) {
  if (!ctx.self) return [];
  const heritage = childOfType(node, "class_heritage");
  if (!heritage) return [];
  const out2 = [];
  for (const to of heritageTargets(childOfType(heritage, "extends_clause"))) out2.push(rel("extends", ctx.self, to, node));
  for (const to of heritageTargets(childOfType(heritage, "implements_clause"))) out2.push(rel("implements", ctx.self, to, node));
  return out2;
}
function firstIsBase(clause, self, node) {
  const targets = heritageTargets(clause);
  return targets.map((to, i2) => rel(i2 === 0 ? "extends" : "implements", self, to, node));
}
var childOfType, rel, PUBLIC_MEMBER_KINDS, FUNCTION_KINDS, FUNCTION_VALUE_TYPES, byPublicKeyword, byNotPrivate, byNotLocal, byPub, byCapital, byPyConvention, always, neverExport, hasFunctionDeclarator, ELIXIR_DEFS, HCL_BLOCKS, TERRAFORM_SPEC, TS_SPEC, SPECS;
var init_specs = __esm({
  "src/ast/specs.ts"() {
    "use strict";
    init_node();
    childOfType = (node, type) => node.namedChildren.find((c2) => c2.type === type);
    rel = (kind, from, to, node) => ({
      kind,
      from,
      to,
      line: node.startPosition.row + 1
    });
    PUBLIC_MEMBER_KINDS = /* @__PURE__ */ new Set(["interface", "trait", "enum", "protocol", "annotation"]);
    FUNCTION_KINDS = /* @__PURE__ */ new Set(["function", "method", "def", "constructor", "operator"]);
    FUNCTION_VALUE_TYPES = /* @__PURE__ */ new Set([
      "function",
      "function_expression",
      "arrow_function",
      "generator_function",
      "class",
      "function_definition",
      "lambda"
    ]);
    byPublicKeyword = (line) => /\b(public|internal)\b/.test(line);
    byNotPrivate = (line) => !/\b(private|protected)\b/.test(line);
    byNotLocal = (line) => !/^local\b/.test(line);
    byPub = (line) => /\bpub\b/.test(line);
    byCapital = (_l, name2) => /^[A-Z]/.test(name2);
    byPyConvention = (_l, name2) => !name2.startsWith("_") || /^__\w+__$/.test(name2);
    always = () => true;
    neverExport = () => false;
    hasFunctionDeclarator = (node) => findFirst(node, (n) => n.type === "function_declarator") !== void 0;
    ELIXIR_DEFS = {
      defmodule: "module",
      defprotocol: "protocol",
      defimpl: "impl",
      defstruct: "struct",
      defexception: "exception",
      def: "function",
      defp: "function",
      defmacro: "macro",
      defmacrop: "macro",
      defguard: "guard",
      defguardp: "guard",
      defdelegate: "function"
    };
    HCL_BLOCKS = /* @__PURE__ */ new Set(["resource", "data", "variable", "output", "module", "provider", "locals", "terraform"]);
    TERRAFORM_SPEC = {
      lang: "terraform",
      defs: { block: "block" },
      containers: /* @__PURE__ */ new Set(["config_file", "body"]),
      exported: always,
      kindFrom: {
        block: (node) => {
          const type = node.namedChildren.find((c2) => c2.type === "identifier")?.text;
          return type && HCL_BLOCKS.has(type) ? type : void 0;
        }
      },
      nameFrom: {
        // A block's identity is its labels: `resource "aws_instance" "web"` is
        // addressed as aws_instance.web, which is exactly how Terraform names it.
        block: (node) => {
          const labels = node.namedChildren.filter((c2) => c2.type === "string_lit").map((c2) => c2.text.replace(/^"|"$/g, ""));
          if (labels.length) return labels.join(".");
          return node.namedChildren.find((c2) => c2.type === "identifier")?.text;
        }
      }
    };
    TS_SPEC = {
      lang: "typescript",
      defs: {
        function_declaration: "function",
        generator_function_declaration: "function",
        // `declare function f(): void` and an overload signature — the ENTIRE
        // content of a typical `.d.ts`, previously indexed as nothing.
        function_signature: "function",
        class_declaration: "class",
        abstract_class_declaration: "class",
        interface_declaration: "interface",
        type_alias_declaration: "type",
        enum_declaration: "enum",
        enum_assignment: "enum-member",
        method_definition: "method",
        method_signature: "method",
        abstract_method_signature: "method",
        // Interface members and class fields — the shape of the data, and the half
        // of a TypeScript API that an index of declarations alone never showed.
        property_signature: "property",
        public_field_definition: "property",
        // The three ANONYMOUS interface members. `property_signature` and
        // `method_signature` were already mapped, so these were the one remaining
        // part of a `.d.ts` still invisible: a callable interface, a constructor
        // type, an index signature. They carry no name node — see nameFrom.
        call_signature: "call-signature",
        construct_signature: "construct-signature",
        index_signature: "index-signature",
        // `namespace X {}` / `module X {}`
        internal_module: "namespace",
        module: "namespace",
        variable_declarator: "const"
      },
      containers: /* @__PURE__ */ new Set([
        "class_body",
        "export_statement",
        "ambient_declaration",
        "program",
        "lexical_declaration",
        "variable_declaration",
        "interface_body",
        "object_type",
        "enum_body",
        // Function bodies, for nested declarations — route handlers, hooks, helper
        // closures.
        //
        // `statement_block` alone was NOT enough, and the gap was measured: the walk
        // descends into a non-declaration node only when THAT node's own type is a
        // container, so listing the block without the statements that OWN one stops
        // the descent exactly one node short. Same declaration, one block apart, one
        // indexed and one not:
        //
        //   function f() { function a() {} }      → found
        //   try { function a() {} } catch {}      → lost
        //   if (x) { function a() {} }            → lost
        //   app.get("/x", (req, res) => { … })    → lost
        //
        // That last one is the case this comment already claimed to support. The
        // AST-vs-regex differential found 91 such declarations in THIS repo alone,
        // including every closure `src/ast/extract.ts` is built from — `walk`,
        // `emit`, `walkChildren`, `walkBody`, `docOf` — all declared inside a `try`,
        // so codeindex could not find its own AST walk by name.
        "statement_block",
        "try_statement",
        "catch_clause",
        "finally_clause",
        "if_statement",
        "else_clause",
        "for_statement",
        "for_in_statement",
        "while_statement",
        "do_statement",
        "switch_statement",
        "switch_body",
        "switch_case",
        "switch_default",
        "labeled_statement",
        "return_statement",
        // A callback passed as an argument: expression_statement → call_expression →
        // arguments → arrow_function → statement_block. Every link has to be walkable
        // or the chain breaks at the first missing one.
        "expression_statement",
        "call_expression",
        "arguments",
        "arrow_function",
        "function_expression",
        "function",
        // The IIFE's own link: `(function () { … })()` parses as
        // expression_statement → call_expression → parenthesized_expression →
        // function_expression, and without the parens listed the descent stopped one
        // node short — the same break the statement containers above were added for.
        // Whole categories of file are written inside one (browser scripts, UMD and
        // loader bundles), so for those the index held no functions at all. Named by
        // the ctags differential on a real loader script.
        "parenthesized_expression"
      ]),
      exported: neverExport,
      // export is tracked structurally; see LangSpec.exportMarkers
      exportMarkers: /* @__PURE__ */ new Set(["export_statement", "ambient_declaration"]),
      bareMembers: { enum_body: "enum-member" },
      nameFrom: {
        // Anonymous by construction: an interface's call/construct/index signature
        // has no identifier to read. Naming them after the FORM they take keeps them
        // addressable and stable instead of dropping them for want of a name.
        call_signature: () => "(call)",
        construct_signature: () => "(construct)",
        index_signature: (node) => `[${node.namedChildren.find((c2) => c2.type === "identifier")?.text ?? "key"}]`
      },
      privateMember: (node) => {
        for (const c2 of node.namedChildren) {
          if (c2.type === "accessibility_modifier" && /^(private|protected)/.test(c2.text)) return true;
          if (c2.type === "private_property_identifier") return true;
        }
        return false;
      },
      imports: { import_statement: "string" },
      calls: { call_expression: "function", new_expression: "constructor" },
      assignments: true,
      relationsFrom: {
        class_declaration: tsHeritage,
        abstract_class_declaration: tsHeritage,
        interface_declaration: (node, ctx) => ctx.self ? heritageTargets(childOfType(node, "extends_type_clause")).map((to) => rel("extends", ctx.self, to, node)) : []
      }
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
          field_definition: "property",
          variable_declarator: "const"
        }
      },
      python: {
        lang: "python",
        defs: { function_definition: "function", class_definition: "class" },
        containers: /* @__PURE__ */ new Set(["block", "decorated_definition", "module"]),
        exported: byPyConvention,
        imports: { import_statement: "path", import_from_statement: "path" },
        calls: { call: "function" },
        docstring: true,
        // Python has no interfaces, so every base is an `extends`; graph resolution
        // reclassifies one that turns out to name a Protocol.
        relationsFrom: {
          class_definition: (node, ctx) => ctx.self ? heritageTargets(node.childForFieldName("superclasses")).map((to) => rel("extends", ctx.self, to, node)) : []
        },
        // Python declares constants and dataclass fields by ASSIGNING them; there is
        // no declaration node to map. `X = 1` at module scope is a constant, the same
        // shape inside a class body is a field, and inside a function it is a local
        // (excluded via ctx.inFunctionBody).
        extraMembers: (node, ctx) => {
          if (ctx.inFunctionBody) return [];
          if (node.type === "import_from_statement") {
            const out2 = [];
            for (const child of node.namedChildren) {
              if (child.type !== "aliased_import") continue;
              const original = child.namedChildren[0]?.text;
              const alias = child.childForFieldName("alias")?.text;
              if (original && alias && original === alias) out2.push({ name: alias, kind: "reexport" });
            }
            return out2;
          }
          if (node.type !== "expression_statement") return [];
          const assign = node.namedChildren[0];
          if (!assign || assign.type !== "assignment") return [];
          const left = assign.childForFieldName("left");
          if (!left || left.type !== "identifier") return [];
          return [{ name: left.text, kind: ctx.ownerKind === "class" ? "field" : "const" }];
        }
      },
      go: {
        lang: "go",
        defs: {
          function_declaration: "function",
          method_declaration: "method",
          type_spec: "type",
          const_spec: "const",
          var_spec: "var",
          field_declaration: "field",
          // Interface method sets: `method_spec` through grammar 0.22, renamed
          // `method_elem` in 0.23 — both listed so a grammar bump cannot silently
          // drop every interface method from the index.
          method_spec: "method",
          method_elem: "method",
          // The `package` clause. PHP's `namespace` and Scala's `package` are already
          // symbols — Go's is the same declaration and was the single largest cluster
          // the universal-ctags differential reported against gin (one per file).
          package_clause: "package"
        },
        containers: /* @__PURE__ */ new Set([
          "type_declaration",
          "const_declaration",
          "var_declaration",
          // A GROUPED `var ( … )` nests its specs in a var_spec_list; the ungrouped
          // form hangs them off var_declaration directly. Only the grouped shape has
          // this extra level, which is why grouped `const ( … )` worked and grouped
          // `var ( … )` did not — 14 exported names per file in gin, found by the
          // universal-ctags differential.
          "var_spec_list",
          "source_file",
          // A struct/interface body hangs one level below its type_spec.
          "struct_type",
          "interface_type",
          "field_declaration_list"
        ]),
        exported: byCapital,
        imports: { import_declaration: "string" },
        calls: { call_expression: "function" },
        // A method's receiver is what it belongs to: `func (s *Scheduler) Start()`
        // is Scheduler.Start, not a free function named Start.
        parentFrom: {
          method_declaration: (node) => readTypeName(node.childForFieldName("receiver"))
        },
        nameFrom: {
          // An EMBEDDED field (`struct { Scheduler }`) has a type and no name. The
          // generic reader would return the type as the field name; returning
          // undefined skips it, and the relation below records the embedding instead.
          field_declaration: (node) => node.childForFieldName("name")?.text
        },
        relationsFrom: {
          // Embedding IS Go's inheritance: `type Audited struct { Scheduler }`
          // promotes every Scheduler method onto Audited.
          field_declaration: (node, ctx) => {
            if (!ctx.self || node.childForFieldName("name")) return [];
            const to = readTypeName(node.childForFieldName("type"));
            return to ? [rel("extends", ctx.self, to, node)] : [];
          }
        }
      },
      ruby: {
        lang: "ruby",
        defs: { method: "def", singleton_method: "def", class: "class", module: "module" },
        containers: /* @__PURE__ */ new Set(["class", "module", "body_statement", "program"]),
        exported: always,
        // Ruby models every invocation — dotted, parenthesized, or bare command form
        // (`puts "x"`) — as a `call` node whose callee is the `method` field.
        calls: { call: "function" },
        // A bare `private` switches every following definition in the body to
        // private. It is a method call, not a keyword, so nothing but position says so.
        sectionVisibility: (node) => (node.type === "identifier" || node.type === "call") && /^(private|protected)$/.test(node.text) ? false : node.type === "identifier" && node.text === "public" ? true : void 0,
        relationsFrom: {
          class: (node, ctx) => {
            if (!ctx.self) return [];
            const to = readTypeName(node.childForFieldName("superclass"));
            return to ? [rel("extends", ctx.self, to, node)] : [];
          },
          // `include Runnable` mixes a module in — Ruby's only `implements`. It is a
          // method call, so nothing but the callee name identifies it.
          call: (node, ctx) => {
            const method = node.childForFieldName("method");
            if (!ctx.self || !method || !/^(include|prepend|extend)$/.test(method.text)) return [];
            const out2 = [];
            for (const a of node.childForFieldName("arguments")?.namedChildren ?? []) {
              const to = readTypeName(a);
              if (to) out2.push(rel("implements", ctx.self, to, node));
            }
            return out2;
          }
        },
        extraMembers: (node, ctx) => {
          if (ctx.inFunctionBody) return [];
          if (node.type === "assignment") {
            const left = node.childForFieldName("left");
            return left?.type === "constant" ? [{ name: left.text, kind: "const" }] : [];
          }
          if (node.type === "call") {
            const method = node.childForFieldName("method");
            if (!method || !/^attr_(reader|writer|accessor)$/.test(method.text)) return [];
            const args2 = node.childForFieldName("arguments");
            const out2 = [];
            for (const a of args2?.namedChildren ?? []) {
              if (a.type === "simple_symbol") out2.push({ name: a.text.replace(/^:/, ""), kind: "attr" });
            }
            return out2;
          }
          return [];
        }
      },
      java: {
        lang: "java",
        defs: {
          class_declaration: "class",
          interface_declaration: "interface",
          annotation_type_declaration: "annotation",
          enum_declaration: "enum",
          enum_constant: "enum-member",
          record_declaration: "record",
          method_declaration: "method",
          constructor_declaration: "constructor",
          compact_constructor_declaration: "constructor",
          field_declaration: "field",
          // `interface Cfg { int MAX = 5; }` — an interface constant is its OWN node,
          // not a field_declaration, so interface constants were invisible.
          constant_declaration: "field",
          // `@interface Marker { String value(); }` — the annotation type was mapped
          // and its body was a container, but its ELEMENTS had no entry, so every
          // `@interface` in a repo indexed as an empty shell.
          annotation_type_element_declaration: "method"
        },
        containers: /* @__PURE__ */ new Set([
          "class_body",
          "interface_body",
          "enum_body",
          "enum_body_declarations",
          "annotation_type_body",
          "program",
          // A record's components ARE its public accessors.
          "formal_parameters"
        ]),
        exported: byPublicKeyword,
        imports: { import_declaration: "path" },
        calls: { method_invocation: "function", object_creation_expression: "constructor" },
        kindFrom: {
          // A RECORD's components are its public accessors and belong in the index; a
          // method's or constructor's parameters are arguments and do not. Both are
          // `formal_parameter` under `formal_parameters`, so only the grandparent
          // distinguishes them.
          formal_parameter: (node) => node.parent?.parent?.type === "record_declaration" ? "field" : void 0
        },
        publicMember: (node) => node.parent?.parent?.type === "record_declaration",
        nameFrom: {
          // `private final List<JobSpec> pending = …` — the generic reader's last
          // resort would return the TYPE (`List`); the name is on the declarator.
          field_declaration: (node) => findFirst(node, (n) => n.type === "variable_declarator")?.childForFieldName("name")?.text,
          // Same declarator shape as a field.
          constant_declaration: (node) => findFirst(node, (n) => n.type === "variable_declarator")?.childForFieldName("name")?.text
        },
        relationsFrom: {
          class_declaration: (node, ctx) => {
            if (!ctx.self) return [];
            const out2 = [];
            for (const to of heritageTargets(node.childForFieldName("superclass"))) out2.push(rel("extends", ctx.self, to, node));
            const interfaces = node.childForFieldName("interfaces");
            for (const to of heritageTargets(childOfType(interfaces ?? node, "type_list") ?? interfaces))
              out2.push(rel("implements", ctx.self, to, node));
            return out2;
          },
          interface_declaration: (node, ctx) => {
            const extendsClause = node.childForFieldName("interfaces") ?? childOfType(node, "extends_interfaces");
            return ctx.self ? heritageTargets(childOfType(extendsClause ?? node, "type_list") ?? extendsClause).map(
              (to) => rel("extends", ctx.self, to, node)
            ) : [];
          },
          record_declaration: (node, ctx) => {
            const interfaces = node.childForFieldName("interfaces");
            return ctx.self ? heritageTargets(childOfType(interfaces ?? node, "type_list") ?? interfaces).map(
              (to) => rel("implements", ctx.self, to, node)
            ) : [];
          }
        }
      },
      rust: {
        lang: "rust",
        defs: {
          function_item: "function",
          // A trait's method declarations have no body and are a different node.
          function_signature_item: "function",
          struct_item: "struct",
          enum_item: "enum",
          enum_variant: "enum-member",
          field_declaration: "field",
          trait_item: "trait",
          type_item: "type",
          associated_type: "type",
          mod_item: "mod",
          const_item: "const",
          static_item: "static",
          union_item: "union",
          macro_definition: "macro"
        },
        containers: /* @__PURE__ */ new Set([
          "impl_item",
          "declaration_list",
          "source_file",
          "field_declaration_list",
          "enum_variant_list",
          // `extern "C" { fn … }` — an FFI block's items sit in a declaration_list
          // under this node, so without it a crate's whole foreign interface was
          // unreachable by the walk.
          "foreign_mod_item",
          // A `fn` or `struct` declared inside a function body. The AST-vs-regex
          // differential found 21 of these in ripgrep that the AST tier missed and
          // the regex tier caught — the cheapest oracle in the repo pointing
          // straight at a hole.
          "block"
        ]),
        exported: byPub,
        calls: { call_expression: "function" },
        parentFrom: {
          // `impl Scheduler` / `impl Display for Scheduler` — the members belong to
          // the TYPE in both forms (the trait is recorded as a relation, not a parent).
          impl_item: (node) => readTypeName(node.childForFieldName("type"))
        },
        // `static ARGS_GZIP: &[&str] = …` inside a function is a named, addressable
        // declaration — Rust keeps `let` for the local binding, so these two node
        // types are never one. ripgrep declares ~15 of them inside functions and the
        // ctags differential caught every one.
        nestedDefs: /* @__PURE__ */ new Set(["const_item", "static_item"]),
        publicMembersIn: {
          // A trait implementation's methods are callable by anyone holding the
          // trait, so `pub` is neither required nor allowed on them.
          impl_item: (node) => node.childForFieldName("trait") !== null
        },
        relationsFrom: {
          impl_item: (node, ctx) => {
            const to = readTypeName(node.childForFieldName("trait"));
            return ctx.self && to ? [rel("implements", ctx.self, to, node)] : [];
          }
        }
      },
      c_sharp: {
        lang: "csharp",
        defs: {
          class_declaration: "class",
          interface_declaration: "interface",
          struct_declaration: "struct",
          enum_declaration: "enum",
          enum_member_declaration: "enum-member",
          record_declaration: "record",
          delegate_declaration: "delegate",
          method_declaration: "method",
          constructor_declaration: "constructor",
          property_declaration: "property",
          indexer_declaration: "indexer",
          operator_declaration: "operator",
          field_declaration: "field",
          event_declaration: "event",
          event_field_declaration: "event",
          // `property_declaration` and `operator_declaration` were mapped; a
          // user-defined conversion and a finalizer were not, and both are part of
          // the type's surface.
          conversion_operator_declaration: "operator",
          destructor_declaration: "destructor"
        },
        containers: /* @__PURE__ */ new Set([
          "namespace_declaration",
          "declaration_list",
          "compilation_unit",
          "file_scoped_namespace_declaration",
          "enum_member_declaration_list",
          // A positional record's parameters ARE its public properties.
          "parameter_list"
        ]),
        exported: byPublicKeyword,
        calls: { invocation_expression: "function", object_creation_expression: "constructor" },
        kindFrom: {
          // Same rule as Java: a positional RECORD's parameters are its properties,
          // while a delegate's or a method's are arguments.
          parameter: (node) => node.parent?.parent?.type === "record_declaration" ? "field" : void 0
        },
        publicMember: (node) => node.parent?.parent?.type === "record_declaration",
        nameFrom: {
          // C# wraps a field's declarator one level deeper than Java's, inside a
          // `variable_declaration` — same problem, same fix.
          field_declaration: (node) => findFirst(node, (n) => n.type === "variable_declarator")?.childForFieldName("name")?.text,
          event_field_declaration: (node) => findFirst(node, (n) => n.type === "variable_declarator")?.childForFieldName("name")?.text,
          // `operator int(...)` names its TARGET type, and for a predefined target
          // (`int`, `bool`, `string` — the common case) that is a `predefined_type`
          // node the identifier-ish reader skips, so the declaration vanished. Only a
          // user-defined target happened to work.
          conversion_operator_declaration: (node) => node.childForFieldName("type")?.text
        },
        relationsFrom: {
          class_declaration: (node, ctx) => ctx.self ? firstIsBase(childOfType(node, "base_list"), ctx.self, node) : [],
          struct_declaration: (node, ctx) => ctx.self ? firstIsBase(childOfType(node, "base_list"), ctx.self, node) : [],
          record_declaration: (node, ctx) => ctx.self ? firstIsBase(childOfType(node, "base_list"), ctx.self, node) : [],
          interface_declaration: (node, ctx) => ctx.self ? heritageTargets(childOfType(node, "base_list")).map((to) => rel("extends", ctx.self, to, node)) : []
        }
      },
      php: {
        lang: "php",
        defs: {
          function_definition: "function",
          class_declaration: "class",
          interface_declaration: "interface",
          trait_declaration: "trait",
          enum_declaration: "enum",
          enum_case: "enum-member",
          method_declaration: "method",
          property_declaration: "property",
          const_declaration: "const",
          namespace_definition: "namespace"
        },
        containers: /* @__PURE__ */ new Set(["declaration_list", "enum_declaration_list", "program"]),
        // PHP has real visibility keywords, so `always` was throwing away a fact the
        // source states outright — a `private function` read as part of the API.
        exported: byNotPrivate,
        calls: {
          function_call_expression: "function",
          member_call_expression: "member",
          object_creation_expression: "constructor"
        },
        nameFrom: {
          property_declaration: (node) => findFirst(node, (n) => n.type === "variable_name")?.text.replace(/^\$/, ""),
          const_declaration: (node) => findFirst(node, (n) => n.type === "const_element")?.namedChildren[0]?.text
        },
        relationsFrom: {
          class_declaration: (node, ctx) => {
            if (!ctx.self) return [];
            const out2 = [];
            for (const to of heritageTargets(childOfType(node, "base_clause"))) out2.push(rel("extends", ctx.self, to, node));
            for (const to of heritageTargets(childOfType(node, "class_interface_clause")))
              out2.push(rel("implements", ctx.self, to, node));
            return out2;
          },
          interface_declaration: (node, ctx) => ctx.self ? heritageTargets(childOfType(node, "base_clause")).map((to) => rel("extends", ctx.self, to, node)) : []
        }
      },
      c: {
        lang: "c",
        defs: {
          function_definition: "function",
          struct_specifier: "struct",
          enum_specifier: "enum",
          enumerator: "enum-member",
          union_specifier: "union",
          type_definition: "type",
          field_declaration: "field",
          // A prototype (`int foo(int);`) or an `extern` global. C++ has mapped this
          // all along and C did not, so a header of prototypes — the entire public
          // interface of a C library — indexed to NOTHING, while the byte-identical
          // file read as C++ indexed fully. A same-family asymmetry is a miss, not a
          // stance. Found by the grammar-vocabulary oracle.
          declaration: "const"
        },
        // C has no visibility keyword — headers are the interface, so everything
        // counts as exported (same stance as the regex extractor).
        containers: /* @__PURE__ */ new Set([
          "translation_unit",
          "declaration_list",
          "field_declaration_list",
          "enumerator_list",
          "linkage_specification",
          "preproc_ifdef",
          "preproc_if"
        ]),
        exported: always,
        calls: { call_expression: "function" },
        kindFrom: {
          // In a struct body a `field_declaration` is a data member; with a
          // function_declarator it is a function-pointer member.
          field_declaration: (node) => hasFunctionDeclarator(node) ? "method" : "field",
          // Same split as C++: a `declaration` is a prototype or a variable.
          declaration: (node) => hasFunctionDeclarator(node) ? "function" : "const"
        }
      },
      cpp: {
        lang: "cpp",
        defs: {
          function_definition: "function",
          class_specifier: "class",
          struct_specifier: "struct",
          enum_specifier: "enum",
          enumerator: "enum-member",
          union_specifier: "union",
          type_definition: "type",
          alias_declaration: "type",
          concept_definition: "concept",
          namespace_definition: "namespace",
          namespace_alias_definition: "namespace",
          field_declaration: "field",
          declaration: "const",
          // `using Base::f;` re-exports a base member into this class, a real part of
          // the type's surface. `alias_declaration` (`using X = Y`) was mapped; this
          // form was not.
          using_declaration: "using",
          friend_declaration: "friend"
        },
        containers: /* @__PURE__ */ new Set([
          "translation_unit",
          "declaration_list",
          "field_declaration_list",
          "enumerator_list",
          "template_declaration",
          "linkage_specification",
          "preproc_ifdef",
          "preproc_if"
        ]),
        exported: always,
        calls: { call_expression: "function", new_expression: "constructor" },
        kindFrom: {
          // C++ spells a member FUNCTION declaration and a data member with the same
          // node; only a function_declarator inside tells them apart. Likewise a
          // namespace-scope `declaration` is a constant or a free function.
          field_declaration: (node) => hasFunctionDeclarator(node) ? "method" : "field",
          declaration: (node) => hasFunctionDeclarator(node) ? "function" : "const"
        },
        sectionVisibility: (node) => node.type === "access_specifier" ? !/^(private|protected)/.test(node.text) : void 0,
        nameFrom: {
          // `friend class X;` works through the last-resort reader (its type_identifier
          // is a direct child), but `friend void g();` wraps the name in a nested
          // `declaration` the reader will not cross — so the function form emitted
          // nothing. Descend one level when the direct read fails.
          friend_declaration: (node) => nameOf(node) ?? (node.namedChildren[0] ? nameOf(node.namedChildren[0]) : void 0)
        },
        relationsFrom: {
          // C++ has no interfaces — a pure-virtual base is still `extends`.
          class_specifier: (node, ctx) => ctx.self ? heritageTargets(childOfType(node, "base_class_clause")).map((to) => rel("extends", ctx.self, to, node)) : [],
          struct_specifier: (node, ctx) => ctx.self ? heritageTargets(childOfType(node, "base_class_clause")).map((to) => rel("extends", ctx.self, to, node)) : []
        }
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
          val_declaration: "val",
          var_definition: "var",
          type_definition: "type",
          given_definition: "given",
          // NOTE: `extension_definition` is deliberately NOT a def. The node is
          // anonymous — its children are the receiver `parameters` and the `def`s —
          // so there is no name to emit. It qualifies its members instead; see
          // parentFrom below.
          // The `package` clause, which the grammar's own tags.scm reports as a
          // definition and we did not. Same reasoning as PHP's `namespace_definition`:
          // "where is this package declared" is a real navigation question, and the
          // clause is already walked as a container either way.
          package_clause: "package"
        },
        // package_clause carries braced-package bodies (`package com.acme { … }`);
        // template_body is every class/object/trait body.
        containers: /* @__PURE__ */ new Set([
          "compilation_unit",
          "package_clause",
          "template_body",
          "class_parameters",
          "parameters",
          // The `def`s an `extension` block introduces hang directly off it.
          "extension_definition"
        ]),
        parentFrom: {
          // `extension (queue: String) def shout` adds `shout` TO String. Without
          // this the def surfaced unparented, reading as a top-level `shout` — the
          // same collision the Rust `impl` fix removed.
          extension_definition: (node) => readTypeName(childOfType(node, "parameters")?.namedChildren[0]?.childForFieldName("type") ?? null)
        },
        exported: byNotPrivate,
        kindFrom: {
          // `class Scheduler(val queue: String)` declares a public accessor;
          // `class Scheduler(queue: String)` declares a private constructor
          // parameter. Only the first is a member of the type — and a `case class`
          // makes every parameter one.
          class_parameter: (node) => {
            if (/^\s*(?:val|var)\b/.test(node.text)) return /^\s*var\b/.test(node.text) ? "var" : "val";
            return node.parent?.parent?.type === "class_definition" && /\bcase\s+class\b/.test(node.parent.parent.text.slice(0, 80)) ? "val" : void 0;
          }
        },
        // Qualified calls are call_expression → field_expression (value/field);
        // `new Widget(...)` is an instance_expression with a bare type child.
        calls: { call_expression: "function", instance_expression: "constructor" },
        relationsFrom: {
          // `extends Base with A with B` — the first parent is the superclass, the
          // `with` mixins are traits, i.e. Scala's `implements`.
          class_definition: (node, ctx) => ctx.self ? firstIsBase(childOfType(node, "extends_clause"), ctx.self, node) : [],
          object_definition: (node, ctx) => ctx.self ? firstIsBase(childOfType(node, "extends_clause"), ctx.self, node) : [],
          trait_definition: (node, ctx) => ctx.self ? heritageTargets(childOfType(node, "extends_clause")).map((to) => rel("extends", ctx.self, to, node)) : []
        }
      },
      bash: {
        lang: "shell",
        // `declaration_command` is `declare`/`readonly`/`export` — the only way a
        // shell script states a named constant. Without it bash indexed functions and
        // nothing else, so a config script of `export` lines came back empty.
        defs: { function_definition: "function", declaration_command: "const" },
        // if/compound bodies carry guarded definitions (`if …; then f() { … }; fi`).
        containers: /* @__PURE__ */ new Set(["program", "if_statement", "compound_statement"]),
        // Shell has no visibility — every function is callable from outside.
        exported: always,
        // Every invocation is a `command` whose `name` field is a command_name
        // wrapping a `word` leaf (hence IDENT_LEAF includes `word`).
        calls: { command: "function" },
        nameFrom: {
          // The name is on the ASSIGNMENT, not the command: `declare -r RO=1` leads
          // with its flag word, which the generic reader would return as the name.
          // `local` is function-scoped, so it declares nothing about the script.
          declaration_command: (node) => /^\s*local\b/.test(node.text) ? void 0 : findFirst(node, (n) => n.type === "variable_name")?.text
        }
      },
      // --- EXTENDED TIER (pull-only; see scripts/fetch-grammars.mjs) --------------
      kotlin: {
        lang: "kotlin",
        defs: {
          class_declaration: "class",
          object_declaration: "object",
          function_declaration: "function",
          property_declaration: "property",
          enum_entry: "enum-member",
          type_alias: "type",
          class_parameter: "property"
        },
        containers: /* @__PURE__ */ new Set([
          "source_file",
          "class_body",
          "enum_class_body",
          "companion_object",
          "object_declaration",
          // `class Worker(val queue: String)` — a val/var primary-constructor
          // parameter is a property of the class, not just an argument.
          "primary_constructor",
          "class_parameters"
        ]),
        // Kotlin is public by default; `internal` is module-wide, which still counts
        // as reachable from outside the file.
        exported: byNotPrivate,
        calls: { call_expression: "function" },
        kindFrom: {
          // A bare `(queue: String)` parameter is an argument, not a property; only
          // `val`/`var` (or a `data class`, where every parameter is one) declares a member.
          class_parameter: (node) => /^\s*(?:val|var)\b/.test(node.text) || /\bdata\s+class\b/.test(node.parent?.parent?.parent?.text.slice(0, 80) ?? "") ? "property" : void 0,
          // One node type covers class, interface, enum class and annotation class —
          // only the leading keyword tells them apart.
          class_declaration: (node) => {
            const head = node.text.slice(0, 80);
            if (/\binterface\b/.test(head)) return "interface";
            if (/\benum\s+class\b/.test(head)) return "enum";
            if (/\bannotation\s+class\b/.test(head)) return "annotation";
            return "class";
          }
        },
        nameFrom: {
          // `val depth: Int` wraps the name in a variable_declaration.
          property_declaration: (node) => findFirst(node, (n) => n.type === "variable_declaration")?.namedChildren[0]?.text ?? node.namedChildren.find((c2) => c2.type === "identifier")?.text
        },
        relationsFrom: {
          class_declaration: (node, ctx) => {
            if (!ctx.self) return [];
            const out2 = [];
            for (const spec of childOfType(node, "delegation_specifiers")?.namedChildren ?? []) {
              const to = readTypeName(spec);
              if (!to) continue;
              out2.push(rel(findFirst(spec, (n) => n.type === "constructor_invocation") ? "extends" : "implements", ctx.self, to, node));
            }
            return out2;
          }
        }
      },
      elixir: {
        lang: "elixir",
        // Elixir has NO declaration node types: `defmodule`, `def` and `defp` are
        // ordinary macro CALLS, so every declaration in the language arrives as the
        // same `call` node and only its callee name says what it declares.
        defs: {},
        containers: /* @__PURE__ */ new Set(["source", "do_block", "call", "stab_clause"]),
        // `defp`/`defmacrop` are the private forms; everything else is public.
        exported: (header) => !/^\s*defp?macrop\b|^\s*defp\b/.test(header),
        calls: { call: "function" },
        kindFrom: {
          call: (node) => ELIXIR_DEFS[node.childForFieldName("target")?.text ?? node.namedChildren[0]?.text ?? ""]
        },
        skipCall: (node) => {
          if (node.parent?.type === "unary_operator") return true;
          if (node.parent?.type !== "arguments") return false;
          const decl = node.parent.parent;
          const target = decl?.childForFieldName("target") ?? decl?.namedChildren[0];
          return target !== void 0 && ELIXIR_DEFS[target.text] !== void 0;
        },
        // Elixir documents with `@doc "…"` / `@moduledoc "…"` — a preceding
        // `unary_operator` wrapping a call, not a comment. Without this, Elixir
        // symbols carry no intent at all, which is the one thing the doc field is for.
        docFrom: (node) => {
          let prev = node.previousNamedSibling;
          while (prev && prev.type === "unary_operator") {
            const inner = prev.namedChildren[0];
            const target = inner?.childForFieldName("target") ?? inner?.namedChildren[0];
            if (target && /^(doc|moduledoc)$/.test(target.text)) {
              const str2 = findFirst(prev, (n) => n.type === "string");
              if (str2) return str2.text.replace(/^"""|"""$/g, "").replace(/^"|"$/g, "").trim() || void 0;
            }
            prev = prev.previousNamedSibling;
          }
          return void 0;
        },
        nameFrom: {
          call: (node) => {
            const args2 = node.childForFieldName("arguments") ?? node.namedChildren.find((c2) => c2.type === "arguments");
            const first = args2?.namedChildren[0];
            if (!first) return void 0;
            if (first.type === "alias") return first.text;
            if (first.type === "identifier") return first.text;
            const inner = first.childForFieldName("target") ?? first.namedChildren[0];
            return inner && /identifier|alias/.test(inner.type) ? inner.text : void 0;
          }
        }
      },
      zig: {
        lang: "zig",
        defs: {
          function_declaration: "function",
          variable_declaration: "const",
          container_field: "field",
          test_declaration: "test"
        },
        containers: /* @__PURE__ */ new Set([
          "source_file",
          // A type is a `const X = struct { … }`, so the declaration itself must be
          // walked into to reach the members.
          "variable_declaration",
          "struct_declaration",
          "enum_declaration",
          "union_declaration",
          "error_set_declaration",
          "opaque_declaration",
          "block"
        ]),
        exported: byPub,
        calls: { call_expression: "function" },
        kindFrom: {
          // Zig declares every type as a constant bound to a container literal.
          variable_declaration: (node) => {
            const builtin = node.namedChildren.find((c2) => c2.type === "builtin_function");
            if (builtin && /^@(import|cImport)\b/.test(builtin.text)) return void 0;
            for (const c2 of node.namedChildren) {
              if (c2.type === "struct_declaration") return "struct";
              if (c2.type === "enum_declaration") return "enum";
              if (c2.type === "union_declaration") return "union";
              if (c2.type === "error_set_declaration") return "error";
              if (c2.type === "opaque_declaration") return "opaque";
            }
            return /^\s*(?:pub\s+)?var\b/.test(node.text.slice(0, 24)) ? "var" : "const";
          },
          // The same node is a struct field and an enum member; only the enclosing
          // container literal distinguishes them.
          container_field: (node) => node.parent?.type === "enum_declaration" ? "enum-member" : "field"
        }
      },
      solidity: {
        lang: "solidity",
        defs: {
          contract_declaration: "contract",
          interface_declaration: "interface",
          library_declaration: "library",
          function_definition: "function",
          constructor_definition: "constructor",
          modifier_definition: "modifier",
          event_definition: "event",
          error_declaration: "error",
          struct_declaration: "struct",
          struct_member: "field",
          enum_declaration: "enum",
          enum_value: "enum-member",
          state_variable_declaration: "field",
          constant_variable_declaration: "const",
          user_defined_type_definition: "type",
          // `fallback()` / `receive()` are a distinct node from `function_definition`
          // and are part of the contract's ABI — arguably its most
          // security-relevant part.
          fallback_receive_definition: "function"
        },
        containers: /* @__PURE__ */ new Set(["source_file", "contract_body", "struct_declaration", "enum_declaration", "enum_body"]),
        // Solidity states visibility on every member; `public`/`external` is the
        // contract's ABI, `internal`/`private` is not.
        exported: (header, name2) => /\b(public|external)\b/.test(header) ? true : /\b(internal|private)\b/.test(header) ? false : byCapital(header, name2) || true,
        calls: { call_expression: "function" },
        nameFrom: {
          // `uint256 public constant MAX = 5` leads with its TYPE, and `type_name`
          // ends in "name", so the generic reader's last resort would return the type.
          state_variable_declaration: (node) => node.namedChildren.find((c2) => c2.type === "identifier")?.text,
          // `fallback()` / `receive()` carry NO identifier child at all — the keyword
          // IS the name — so the generic reader returned undefined and the node was
          // skipped, making the `defs` entry unreachable. The name comes from which
          // keyword opens the declaration.
          fallback_receive_definition: (node) => /^\s*receive\b/.test(node.text) ? "receive" : "fallback",
          // An enum member is a LEAF whose own text is the name — it has no
          // identifier child for the generic reader to find.
          enum_value: (node) => node.text
        },
        relationsFrom: {
          // `contract S is Base, IRunnable` does not distinguish a base contract
          // from an interface; resolution corrects whichever turns out to be one.
          contract_declaration: (node, ctx) => ctx.self ? node.namedChildren.filter((c2) => c2.type === "inheritance_specifier").map((c2) => readTypeName(c2)).filter((to) => to !== void 0).map((to) => rel("extends", ctx.self, to, node)) : [],
          interface_declaration: (node, ctx) => ctx.self ? node.namedChildren.filter((c2) => c2.type === "inheritance_specifier").map((c2) => readTypeName(c2)).filter((to) => to !== void 0).map((to) => rel("extends", ctx.self, to, node)) : []
        }
      },
      terraform: TERRAFORM_SPEC,
      hcl: { ...TERRAFORM_SPEC, lang: "hcl" },
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
  }
});

// src/ast/signature.ts
function bodyStart(node) {
  const byField = node.childForFieldName("body");
  let best = byField && byField.startIndex > node.startIndex ? byField.startIndex : void 0;
  const consider = (n) => {
    if (BODY_TYPES.has(n.type) && n.startIndex > node.startIndex && (best === void 0 || n.startIndex < best)) {
      best = n.startIndex;
    }
  };
  for (const c2 of node.namedChildren) {
    consider(c2);
    for (const g of c2.namedChildren) consider(g);
  }
  return best;
}
function declHeader(node, src) {
  const end = bodyStart(node) ?? node.endIndex;
  return src.slice(node.startIndex, end).replace(/\s+/g, " ").trim().replace(/\s*(?:\{|=>|=)$/, "").trim().slice(0, MAX_SIGNATURE);
}
var BODY_TYPES, MAX_SIGNATURE;
var init_signature = __esm({
  "src/ast/signature.ts"() {
    "use strict";
    BODY_TYPES = /* @__PURE__ */ new Set([
      "block",
      "statement_block",
      "class_body",
      "declaration_list",
      "field_declaration_list",
      "template_body",
      "compound_statement",
      "body_statement",
      "enum_body",
      "enum_body_declarations",
      "enum_variant_list",
      "enum_member_declaration_list",
      "enumerator_list",
      "interface_body",
      "object_type",
      "do_block",
      // Zig binds every type to a constant holding a container literal, so the
      // literal IS the body: without these, a struct's signature swallowed every
      // field it declares.
      "struct_declaration",
      "enum_declaration",
      "union_declaration",
      "error_set_declaration",
      "opaque_declaration",
      // Solidity, Kotlin.
      "contract_body",
      "enum_class_body"
    ]);
    MAX_SIGNATURE = 400;
  }
});

// src/extract/doc-text.ts
function isDirective(line) {
  return DIRECTIVE_RE.test(line.trim());
}
function isBanner(line) {
  return BANNER_RE.test(line.trim());
}
function stripCommentMarkers(raw) {
  return raw.replace(/\*+\/\s*$/, "").replace(/^\s*\/\*+!?/, "").replace(/^\s*\/\/[/!]?/, "").replace(/^\s*--+/, "").replace(/^\s*#+/, "").replace(/^\s*\*+/, "").replace(/^\s*(?:"""|''')/, "").replace(/(?:"""|''')\s*$/, "").replace(/[-=~_]{3,}/g, " ").trim();
}
function stripDocMarkup(text) {
  return text.replace(/<\/?[A-Za-z][^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function summarizeDocLines(lines, maxLen = MAX_DOC) {
  const kept = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || isDirective(t) || isBanner(t)) continue;
    if (/^@[a-z]/i.test(t)) break;
    kept.push(t);
  }
  const text = stripDocMarkup(kept.join(" "));
  if (text.length < 3) return void 0;
  const sentence = /^(.*?[.!?])(\s|$)/.exec(text);
  return (sentence ? sentence[1] : text).slice(0, maxLen);
}
var DIRECTIVE_RE, BANNER_RE, MAX_DOC;
var init_doc_text = __esm({
  "src/extract/doc-text.ts"() {
    "use strict";
    DIRECTIVE_RE = /^(eslint\b|eslint-|prettier\b|prettier-|tslint\b|jshint\b|jslint\b|globals?\b|istanbul\b|c8\s|v8\s|@ts-|ts-|@flow\b|@jsx\b|@jsxRuntime\b|@jest-environment\b|@vitest-environment\b|@license\b|@preserve\b|@copyright\b|copyright\b|spdx-|<reference\b|use strict|biome-|deno-lint|noqa\b|type:\s*ignore|pylint:|flake8:|mypy:|coding[:=])/i;
    BANNER_RE = /^((?:mit|isc|bsd|apache|gnu|gpl|mpl|lgpl|agpl)\s+licen[sc]ed?\b|licen[sc]ed\b|(?:released|distributed)\s+under\b|all rights reserved\b|https?:\/\/|www\.)/i;
    MAX_DOC = 300;
  }
});

// src/ast/doc.ts
function commentLinesAbove(node) {
  const blocks = [];
  let prev = node.previousNamedSibling;
  let nextRow = node.startPosition.row;
  while (prev && COMMENT_TYPE.test(prev.type)) {
    if (nextRow - prev.endPosition.row > 1) break;
    blocks.push(prev);
    nextRow = prev.startPosition.row;
    prev = prev.previousNamedSibling;
  }
  if (!blocks.length) return [];
  blocks.reverse();
  const lines = [];
  for (const b of blocks) for (const l of b.text.split(/\r?\n/)) lines.push(stripCommentMarkers(l));
  return lines;
}
function docCommentFor(node) {
  let anchor = node;
  while (anchor) {
    const lines = commentLinesAbove(anchor);
    if (lines.length) {
      const doc = summarizeDocLines(lines);
      if (doc) return doc;
    }
    const parent = anchor.parent;
    if (!parent || !DOC_WRAPPERS.has(parent.type)) return void 0;
    const prev = anchor.previousNamedSibling;
    if (prev && !DECORATION.test(prev.type)) return void 0;
    anchor = parent;
  }
  return void 0;
}
function docstringFor(node) {
  const body2 = node.childForFieldName("body");
  const first = body2?.namedChildren[0];
  if (!first) return void 0;
  const str2 = first.type === "string" ? first : first.type === "expression_statement" ? first.namedChildren[0] : void 0;
  if (!str2 || str2.type !== "string") return void 0;
  return summarizeDocLines(str2.text.split(/\r?\n/).map(stripCommentMarkers));
}
var COMMENT_TYPE, DOC_WRAPPERS, DECORATION;
var init_doc = __esm({
  "src/ast/doc.ts"() {
    "use strict";
    init_doc_text();
    COMMENT_TYPE = /(^|_)comment$/;
    DOC_WRAPPERS = /* @__PURE__ */ new Set([
      "export_statement",
      "ambient_declaration",
      "decorated_definition",
      "template_declaration",
      "labeled_statement",
      "lexical_declaration",
      "variable_declaration",
      "type_declaration",
      "const_declaration",
      "var_declaration",
      "body_statement",
      // tree-sitter-hcl hoists a leading comment out of the block body the same way
      // tree-sitter-ruby does, so the first block in a file would read as undocumented.
      "body"
    ]);
    DECORATION = /decorator|annotation|modifiers/;
  }
});

// src/ast/extract.ts
function isPlainString(node) {
  return node.namedChildren.every((c2) => STRING_PART.test(c2.type));
}
function collectAll(root, spec, defNames, maxCalls, wantImports) {
  const identsFound = /* @__PURE__ */ new Set();
  const wantCalls = spec.calls !== void 0;
  const calls = [];
  const callSeen = /* @__PURE__ */ new Set();
  const addCall = (name2, node, receiver) => {
    if (!name2 || name2.length < 2 || !/^[A-Za-z_]\w*$/.test(name2)) return;
    const line = node.startPosition.row + 1;
    const key = `${name2} ${line}`;
    if (callSeen.has(key)) return;
    callSeen.add(key);
    calls.push(receiver ? { name: name2, line, receiver } : { name: name2, line });
  };
  const termsFound = /* @__PURE__ */ new Set();
  const addTerms2 = (text) => {
    if (termsFound.size >= MAX_TERMS) return;
    for (const t of subtokens(text)) {
      if (termsFound.size >= MAX_TERMS) return;
      termsFound.add(t);
    }
  };
  const literals = new LiteralCollector();
  const wantNames = spec.imports?.import_statement !== void 0;
  const namesFound = /* @__PURE__ */ new Set();
  const wantRefs = wantImports && spec.imports !== void 0;
  const refs = [];
  const refSeen = /* @__PURE__ */ new Set();
  const addRef = (s) => {
    const v = s.trim();
    if (v && !refSeen.has(v)) {
      refSeen.add(v);
      refs.push({ kind: "import", spec: v });
    }
  };
  const visit = (node) => {
    const type = node.type;
    const kids = node.namedChildren;
    if (kids.length === 0 && REF_IDENT_TYPE.test(type)) {
      const text = node.text;
      if (REF_IDENT_TEXT.test(text) && !defNames.has(text)) identsFound.add(text);
    }
    if (COMMENT_NODE.test(type)) {
      for (const line of node.text.split(/\r?\n/)) addTerms2(stripCommentMarkers(line));
    } else if (kids.length === 0 && STRING_NODE.test(type) && node.endIndex - node.startIndex <= MAX_LITERAL_LEN2) {
      addTerms2(node.text.replace(/^['"`]+|['"`]+$/g, ""));
    }
    if (!literals.full) {
      const line = node.startPosition.row + 1;
      if (STRING_NODE.test(type) && isPlainString(node)) literals.addString(node.text, line);
      else if (kids.length === 0 && NUMBER_NODE.test(type)) literals.add("number", node.text.trim(), line);
      else if (REGEX_NODE.test(type)) literals.add("regex", node.text, line);
    }
    if (wantCalls && !(spec.kindFrom?.[type] && spec.kindFrom[type](node)) && !spec.skipCall?.(node)) {
      const how = spec.calls[type];
      if (how === "function") {
        const callee = node.childForFieldName("function") ?? node.childForFieldName("callee") ?? node.childForFieldName("method") ?? node.childForFieldName("name") ?? node.childForFieldName("target") ?? kids[0] ?? null;
        addCall(readName(callee), node, readReceiver(callee) ?? readReceiver(node));
      } else if (how === "member") {
        addCall(readName(node.childForFieldName("name")), node, readReceiver(node));
      } else if (how === "constructor") {
        let t = node.childForFieldName("constructor") ?? node.childForFieldName("type") ?? node.childForFieldName("name");
        for (let i2 = 0; !t && i2 < kids.length; i2++) {
          const c2 = kids[i2];
          if (IDENT_LEAF.test(c2.type)) t = c2;
        }
        addCall(readName(t), node, readReceiver(t ?? null));
      }
    }
    if (wantNames && type === "import_statement") {
      for (const clause of kids) {
        if (clause.type !== "import_clause") continue;
        for (const named of clause.namedChildren) {
          if (named.type !== "named_imports") continue;
          for (const specifier of named.namedChildren) {
            if (specifier.type !== "import_specifier") continue;
            const nm = specifier.childForFieldName("name") ?? specifier.namedChildren[0];
            if (nm?.text) namesFound.add(nm.text);
          }
        }
      }
    }
    if (wantRefs) {
      const how = spec.imports[type];
      if (how === "string") {
        const str2 = findFirst(node, (n) => /string/.test(n.type));
        if (str2) addRef(str2.text.replace(/^['"]|['"]$/g, ""));
      } else if (how === "path") {
        const name2 = node.childForFieldName("name") ?? node.childForFieldName("module_name");
        addRef((name2 ?? node).text.replace(/^(import|from)\s+/, "").split(/\s+/)[0]);
      }
    }
    for (const c2 of kids) visit(c2);
  };
  visit(root);
  calls.sort((a, b) => byStr(a.name, b.name) || a.line - b.line);
  return {
    refs,
    idents: [...identsFound].sort().slice(0, MAX_REF_IDENTS),
    calls: calls.slice(0, maxCalls),
    importedNames: [...namesFound].sort(byStr).slice(0, MAX_IMPORTED_NAMES),
    terms: [...termsFound].sort(byStr),
    literals: literals.result() ?? []
  };
}
function boundNames(pattern) {
  const out2 = [];
  const visit = (n) => {
    if (/^(shorthand_property_identifier_pattern|identifier)$/.test(n.type)) {
      if (!out2.includes(n.text)) out2.push(n.text);
      return;
    }
    if (n.type === "pair_pattern") {
      const v = n.childForFieldName("value");
      if (v) visit(v);
      return;
    }
    for (const c2 of n.namedChildren) visit(c2);
  };
  for (const c2 of pattern.namedChildren) visit(c2);
  return out2;
}
function extractAst(rel2, ext, content, opts = {}) {
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
    const maxSymbols = opts.maxSymbols ?? MAX_SYMBOLS;
    const symbols = [];
    const root = tree.rootNode;
    const stem = (rel2.split("/").pop() ?? "").replace(/\.[^.]+$/, "");
    const exportedNames = /* @__PURE__ */ new Set();
    const emit2 = (s) => {
      if (symbols.length < maxSymbols) symbols.push(s);
    };
    const relations = [];
    const relSeen = /* @__PURE__ */ new Set();
    const collectRelations = (node, self) => {
      const reader = spec.relationsFrom?.[node.type];
      if (!reader) return;
      for (const r of reader(node, { self })) {
        if (r.from === r.to) continue;
        const key2 = `${r.kind} ${r.from} ${r.to}`;
        if (relSeen.has(key2) || relations.length >= MAX_RELATIONS) continue;
        relSeen.add(key2);
        relations.push(r);
      }
    };
    const visibilityOf = (node, header, name2, ctx) => {
      if (ctx.inFunctionBody) return false;
      if (spec.privateMember?.(node) === true) return false;
      if (spec.publicMember?.(node) === true) return true;
      if (!ctx.sectionPublic) return false;
      if (ctx.forcePublic) return true;
      return ctx.exported || spec.exported(header, name2);
    };
    const docOf = (node) => spec.docFrom?.(node) ?? (spec.docstring ? docstringFor(node) : void 0) ?? docCommentFor(node);
    const walkChildren = (container, ctx) => {
      let sectionPublic = ctx.sectionPublic;
      const bareKind = spec.bareMembers?.[container.type];
      for (const c2 of container.namedChildren) {
        if (spec.sectionVisibility) {
          const flip = spec.sectionVisibility(c2);
          if (flip !== void 0) {
            sectionPublic = flip;
            continue;
          }
        }
        const childCtx = sectionPublic === ctx.sectionPublic ? ctx : { ...ctx, sectionPublic };
        if (bareKind && c2.namedChildren.length === 0 && IDENT_LEAF.test(c2.type)) {
          emit2({
            name: c2.text,
            kind: bareKind,
            file: rel2,
            line: c2.startPosition.row + 1,
            endLine: c2.endPosition.row + 1,
            ...childCtx.parent ? { parent: childCtx.parent } : {},
            exported: childCtx.forcePublic || childCtx.exported,
            lang: spec.lang
          });
          continue;
        }
        for (const extra of spec.extraMembers?.(c2, { ownerKind: childCtx.ownerKind, inFunctionBody: childCtx.inFunctionBody }) ?? []) {
          const header = declHeader(c2, content);
          const doc = docCommentFor(c2);
          emit2({
            name: extra.name,
            kind: extra.kind,
            file: rel2,
            line: c2.startPosition.row + 1,
            endLine: c2.endPosition.row + 1,
            ...childCtx.parent ? { parent: childCtx.parent } : {},
            ...childCtx.parentPath && childCtx.parentPath !== childCtx.parent ? { parentPath: childCtx.parentPath } : {},
            signature: header,
            ...doc ? { doc } : {},
            exported: visibilityOf(c2, header, extra.name, childCtx),
            lang: spec.lang
          });
        }
        walk2(c2, childCtx);
      }
    };
    const walkBody = (node, ctx) => {
      let descended = false;
      for (const c2 of node.namedChildren) {
        if (!spec.containers.has(c2.type)) continue;
        descended = true;
        walkChildren(c2, ctx);
      }
      if (!descended && spec.containers.has(node.type)) walkChildren(node, ctx);
    };
    const walk2 = (node, ctx) => {
      if (ctx.funcDepth > MAX_FUNC_DEPTH) return;
      const type = node.type;
      const isExportMarker = spec.exportMarkers?.has(type) === true;
      const nowExported = ctx.exported || isExportMarker;
      if (type === "export_statement") {
        for (const c2 of node.namedChildren) {
          if (c2.type === "identifier") exportedNames.add(c2.text);
          else if (c2.type === "export_clause") {
            for (const clause of c2.namedChildren) {
              const nm = clause.childForFieldName("name") ?? clause.namedChildren[0];
              if (nm?.text) exportedNames.add(nm.text);
            }
          }
        }
        if (stem && node.children.some((c2) => c2.type === "default")) {
          for (const c2 of node.namedChildren) {
            const fnLike = ANON_DEFAULT_FN.has(c2.type);
            const classLike = ANON_DEFAULT_CLASS.has(c2.type);
            if ((fnLike || classLike) && !c2.childForFieldName("name")) {
              const doc = docCommentFor(node);
              emit2({
                name: stem,
                kind: classLike ? "class" : "function",
                file: rel2,
                line: node.startPosition.row + 1,
                endLine: node.endPosition.row + 1,
                signature: declHeader(node, content),
                ...doc ? { doc } : {},
                exported: true,
                lang: spec.lang
              });
              break;
            }
          }
        }
      }
      if (spec.assignments && type === "expression_statement") {
        const expr = node.namedChildren[0];
        if (expr?.type === "assignment_expression") {
          const left = expr.childForFieldName("left");
          const right = expr.childForFieldName("right");
          if (left?.type === "member_expression" && left.text === "module.exports" && right) {
            if (right.type === "object") {
              for (const p of right.namedChildren) {
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
          const funcy = right && FUNCTION_VALUE_TYPES.has(right.type);
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
              const doc = docCommentFor(node);
              emit2({
                name: name2,
                kind: right.type === "class" ? "class" : "function",
                file: rel2,
                line: expr.startPosition.row + 1,
                endLine: expr.endPosition.row + 1,
                ...ctx.parent ? { parent: ctx.parent } : {},
                signature: declHeader(expr, content),
                ...doc ? { doc } : {},
                exported: !ctx.inFunctionBody && (nowExported || exportedAssign),
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
                  emit2({
                    name: prop.text,
                    kind: "const",
                    file: rel2,
                    line: expr.startPosition.row + 1,
                    endLine: expr.endPosition.row + 1,
                    ...ctx.parent ? { parent: ctx.parent } : {},
                    signature: declHeader(expr, content),
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
      if (spec.assignments && type === "assignment_statement") {
        const vars = node.children.find((c2) => c2.type === "variable_list");
        const vals = node.children.find((c2) => c2.type === "expression_list");
        const targets = vars?.namedChildren ?? [];
        const values = vals?.namedChildren ?? [];
        const pairs = Math.min(targets.length, values.length);
        for (let i2 = 0; i2 < pairs; i2++) {
          const target = targets[i2];
          const value = values[i2];
          if (value.type !== "function_definition" || !/^[\w.:]+$/.test(target.text)) continue;
          const header = declHeader(node, content);
          const doc = docCommentFor(node);
          emit2({
            name: target.text,
            kind: "function",
            file: rel2,
            line: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
            ...ctx.parent ? { parent: ctx.parent } : {},
            signature: header,
            ...doc ? { doc } : {},
            exported: visibilityOf(node, header, target.text, { ...ctx, exported: nowExported }),
            lang: spec.lang
          });
        }
        return;
      }
      const qualifier = spec.parentFrom?.[type]?.(node);
      const chooser = spec.kindFrom?.[type];
      const kind = chooser ? chooser(node) : spec.defs[type];
      if (kind) {
        const reader = spec.nameFrom?.[type];
        const name2 = reader ? reader(node) : nameOf(node);
        const pattern = node.namedChildren.find((c2) => c2.type === "object_pattern" || c2.type === "array_pattern");
        if (pattern && !ctx.inFunctionBody) {
          const header = declHeader(node, content);
          const doc = docOf(node);
          for (const bound of boundNames(pattern)) {
            emit2({
              name: bound,
              kind,
              file: rel2,
              line: node.startPosition.row + 1,
              endLine: node.endPosition.row + 1,
              ...ctx.parent ? { parent: ctx.parent } : {},
              signature: header,
              ...doc ? { doc } : {},
              exported: visibilityOf(node, header, bound, { ...ctx, exported: nowExported }),
              lang: spec.lang
            });
          }
          return;
        }
        const declaresFunction = FUNCTION_KINDS.has(kind) || NESTED_TYPE_KINDS.has(kind) || spec.nestedDefs?.has(type) === true || FUNCTION_VALUE_TYPES.has(node.childForFieldName("value")?.type ?? "");
        if (name2 && (!ctx.inFunctionBody || declaresFunction)) {
          const header = declHeader(node, content);
          const doc = docOf(node);
          const parent = qualifier ?? ctx.parent;
          const parentPath = qualifier ?? ctx.parentPath;
          emit2({
            name: name2,
            kind,
            file: rel2,
            line: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
            ...parent ? { parent } : {},
            ...parentPath && parentPath !== parent ? { parentPath } : {},
            signature: header,
            ...doc ? { doc } : {},
            exported: visibilityOf(node, header, name2, { ...ctx, exported: nowExported }),
            lang: spec.lang
          });
          collectRelations(node, name2);
          const entersFunction = FUNCTION_KINDS.has(kind);
          walkBody(node, {
            parent: name2,
            parentPath: parentPath ? `${parentPath}/${name2}` : name2,
            ownerKind: kind,
            exported: nowExported,
            forcePublic: PUBLIC_MEMBER_KINDS.has(kind),
            inFunctionBody: ctx.inFunctionBody || entersFunction,
            funcDepth: ctx.funcDepth + (entersFunction ? 1 : 0),
            sectionPublic: true
          });
          return;
        }
      }
      collectRelations(node, qualifier ?? ctx.parent);
      if (spec.containers.has(type)) {
        const forcePublic = ctx.forcePublic || spec.publicMembersIn?.[type]?.(node) === true;
        const entersFunction = FUNCTION_VALUE_TYPES.has(type);
        walkChildren(node, {
          ...ctx,
          exported: nowExported,
          forcePublic,
          inFunctionBody: ctx.inFunctionBody || entersFunction,
          funcDepth: ctx.funcDepth + (entersFunction ? 1 : 0),
          ...qualifier ? { parent: qualifier, parentPath: qualifier, ownerKind: "type" } : {}
        });
      }
    };
    walkChildren(root, {
      exported: false,
      forcePublic: false,
      inFunctionBody: false,
      funcDepth: 0,
      sectionPublic: true
    });
    if (exportedNames.size) {
      for (const s of symbols) if (!s.exported && exportedNames.has(s.name)) s.exported = true;
    }
    const wantImports = opts.imports !== false;
    const { refs, idents, calls, importedNames, terms, literals } = collectAll(
      root,
      spec,
      new Set(symbols.map((s) => s.name)),
      opts.maxCalls ?? MAX_CALLS,
      wantImports
    );
    let pkg;
    if (wantImports && spec.lang === "java") {
      const p = findFirst(root, (n) => n.type === "package_declaration");
      if (p) pkg = p.text.replace(/^package\s+/, "").replace(/;.*$/, "").trim();
    }
    relations.sort((a, b) => byStr(a.from, b.from) || byStr(a.kind, b.kind) || byStr(a.to, b.to));
    return {
      symbols,
      refs,
      pkg,
      idents,
      calls,
      importedNames,
      relations,
      terms,
      literals,
      ...symbols.length >= maxSymbols ? { truncated: true } : {}
    };
  } catch {
    return void 0;
  } finally {
    tree?.delete();
  }
}
var MAX_REF_IDENTS, MAX_CALLS, MAX_IMPORTED_NAMES, MAX_SYMBOLS, MAX_RELATIONS, MAX_TERMS, MAX_LITERAL_LEN2, MAX_FUNC_DEPTH, NESTED_TYPE_KINDS, ANON_DEFAULT_FN, ANON_DEFAULT_CLASS, REF_IDENT_TYPE, REF_IDENT_TEXT, COMMENT_NODE, STRING_NODE, NUMBER_NODE, REGEX_NODE, STRING_PART;
var init_extract = __esm({
  "src/ast/extract.ts"() {
    "use strict";
    init_literals();
    init_sort();
    init_loader();
    init_node();
    init_specs();
    init_signature();
    init_doc();
    init_doc_text();
    init_util();
    MAX_REF_IDENTS = 512;
    MAX_CALLS = 512;
    MAX_IMPORTED_NAMES = 256;
    MAX_SYMBOLS = 2e3;
    MAX_RELATIONS = 256;
    MAX_TERMS = 512;
    MAX_LITERAL_LEN2 = 80;
    MAX_FUNC_DEPTH = 2;
    NESTED_TYPE_KINDS = /* @__PURE__ */ new Set(["class", "struct", "enum", "interface", "trait", "type", "record", "union"]);
    ANON_DEFAULT_FN = /* @__PURE__ */ new Set([
      "function",
      "function_expression",
      "function_declaration",
      "generator_function",
      "generator_function_declaration",
      "arrow_function"
    ]);
    ANON_DEFAULT_CLASS = /* @__PURE__ */ new Set(["class", "class_declaration", "abstract_class_declaration"]);
    REF_IDENT_TYPE = /identifier|constant|(^|_)name$/;
    REF_IDENT_TEXT = /^[A-Za-z_]\w{4,}$/;
    COMMENT_NODE = /(^|_)comment$/;
    STRING_NODE = /(^|_)string(_literal)?$/;
    NUMBER_NODE = /(^|_)(integer|float|number|decimal|numeric)(_literal)?$/;
    REGEX_NODE = /(^|_)(regex|regular_expression)(_pattern|_literal)?$/;
    STRING_PART = /(^|_)(fragment|content|escape_sequence|character)$/;
  }
});

// src/extract/code.ts
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
    const rel2 = /^\s*require_relative\s+['"]([^'"]+)['"]/gm;
    while (m = rel2.exec(content)) specs.add(/^\.\.?\//.test(m[1]) ? m[1] : "./" + m[1]);
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
function collectTermsRegex(content) {
  const found = /* @__PURE__ */ new Set();
  const add = (text) => {
    if (found.size >= MAX_TERMS2) return;
    for (const t of subtokens(text)) {
      if (found.size >= MAX_TERMS2) return;
      found.add(t);
    }
  };
  let inBlock = false;
  for (const raw of content.split("\n")) {
    if (found.size >= MAX_TERMS2) break;
    let line = raw;
    if (inBlock) {
      const close = line.indexOf("*/");
      add(stripCommentMarkers(close === -1 ? line : line.slice(0, close)));
      if (close === -1) continue;
      inBlock = false;
      line = line.slice(close + 2);
    }
    const open = line.indexOf("/*");
    if (open !== -1) {
      const close = line.indexOf("*/", open + 2);
      add(stripCommentMarkers(line.slice(open, close === -1 ? void 0 : close)));
      if (close === -1) {
        inBlock = true;
        line = line.slice(0, open);
      } else line = line.slice(0, open) + line.slice(close + 2);
    }
    const lineComment = /(^|\s)(\/\/|#|--)(.*)$/.exec(line);
    if (lineComment) {
      add(stripCommentMarkers(lineComment[2] + lineComment[3]));
      line = line.slice(0, lineComment.index);
    }
    for (const m of line.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
      const body2 = m[2];
      if (body2.length && body2.length <= MAX_LITERAL_LEN3) add(body2);
    }
  }
  return [...found].sort();
}
function collectLiteralsRegex(content) {
  const literals = new LiteralCollector();
  let inBlock = false;
  let lineNo = 0;
  for (const raw of content.split("\n")) {
    lineNo++;
    if (literals.full) break;
    let line = raw;
    if (inBlock) {
      const close = line.indexOf("*/");
      if (close === -1) continue;
      inBlock = false;
      line = line.slice(close + 2);
    }
    const open = line.indexOf("/*");
    if (open !== -1) {
      const close = line.indexOf("*/", open + 2);
      if (close === -1) {
        inBlock = true;
        line = line.slice(0, open);
      } else line = line.slice(0, open) + line.slice(close + 2);
    }
    const lineComment = /(^|\s)(\/\/|#|--)(.*)$/.exec(line);
    if (lineComment) line = line.slice(0, lineComment.index);
    for (const m of line.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
      literals.add("string", m[2], lineNo);
    }
    for (const m of line.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, " ").matchAll(/(?<![\w.])-?\d[\d_]*(?:\.\d+)?(?![\w.])/g)) {
      literals.add("number", m[0].replace(/_/g, ""), lineNo);
    }
  }
  return literals.result();
}
function extractCode(rel2, ext, content, opts = {}) {
  const ast = extractAst(rel2, ext, content, { maxCalls: opts.maxCallsPerFile, imports: false });
  const raw = ast ? ast.symbols : extractSymbols(rel2, ext, content);
  const symbols = raw.slice(0, MAX_FILE_SYMBOLS);
  const known = new Set(symbols.map((s) => s.name));
  const reexports = extractReexports(rel2, content, symbols).filter((s) => !known.has(s.name));
  const refs = extractImports(ext, content);
  const importSpecs = new Set(refs.map((r) => r.spec));
  const literals = (ast ? ast.literals.length ? ast.literals : void 0 : collectLiteralsRegex(content))?.filter(
    (l) => !(l.kind === "string" && importSpecs.has(l.value))
  );
  return {
    symbols: [...symbols, ...reexports],
    // A re-export list that hit its own ceiling is truncated too — a barrel that
    // looks complete while hiding names is the failure the walk's `capped` flag
    // exists to prevent.
    ...ast?.truncated || raw.length > symbols.length || reexports.length >= MAX_REEXPORTS ? { truncated: true } : {},
    summary: topDocComment(content),
    refs,
    // pkg anchors namespace→source-root resolution: Java's `package`, C#'s
    // `namespace` (block or file-scoped). Both feed the same resolver pattern.
    pkg: ext === ".java" ? /^\s*package\s+([\w.]+)\s*;/m.exec(content)?.[1] : ext === ".cs" ? /^\s*(?:file-scoped\s+)?namespace\s+([\w.]+)/m.exec(content)?.[1] : void 0,
    idents: ast?.idents,
    // AST call sites when a grammar parsed the file; the conservative regex
    // collector otherwise, so caller indexes exist without the wasm sidecar.
    // `symbols` (this file's own regex-extracted defs) lets the collector
    // exclude a definition's own name+line from its call candidates.
    calls: ast ? ast.calls : collectCallsRegex(content, symbols, opts.maxCallsPerFile),
    importedNames: ast?.importedNames,
    relations: ast?.relations?.length ? ast.relations : void 0,
    // The AST tier reads comments and literals structurally; without a grammar
    // the line scanner above still supplies a vocabulary, so search quality does
    // not silently collapse for a language with no wasm.
    terms: ast ? ast.terms : collectTermsRegex(content),
    literals: literals?.length ? literals : void 0
  };
}
var MAX_FILE_SYMBOLS, JS_TS, PY, C_CPP, MAX_USE_EXPANSION, CALL_KEYWORDS, DEF_INTRODUCERS, MAX_TERMS2, MAX_LITERAL_LEN3;
var init_code = __esm({
  "src/extract/code.ts"() {
    "use strict";
    init_literals();
    init_registry();
    init_extract();
    init_common();
    init_doc_text();
    init_util();
    MAX_FILE_SYMBOLS = 2e3;
    JS_TS = /* @__PURE__ */ new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
    PY = /* @__PURE__ */ new Set([".py", ".pyi"]);
    C_CPP = /* @__PURE__ */ new Set([".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".hh"]);
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
    MAX_TERMS2 = 512;
    MAX_LITERAL_LEN3 = 80;
  }
});

// src/extract/config.ts
function extractConfigLiterals(content) {
  const literals = new LiteralCollector();
  let lineNo = 0;
  for (const raw of content.split("\n")) {
    lineNo++;
    if (literals.full) break;
    const line = stripTrailingComment(raw);
    for (const m of line.matchAll(QUOTED)) literals.add("string", m[2], lineNo);
    const bare = UNQUOTED_SCALAR.exec(line);
    if (bare) {
      const v = bare[1].trim();
      if (v && !/^[[{|>&*-]/.test(v) && !HAS_QUOTE.test(v)) literals.add("string", v, lineNo);
    }
    for (const m of line.replace(QUOTED, " ").matchAll(BARE_NUMBER)) {
      literals.add("number", m[0].replace(/_/g, ""), lineNo);
    }
  }
  return literals.result();
}
function stripTrailingComment(line) {
  let inQuote;
  for (let i2 = 0; i2 < line.length; i2++) {
    const c2 = line[i2];
    if (inQuote) {
      if (c2 === "\\") i2++;
      else if (c2 === inQuote) inQuote = void 0;
    } else if (c2 === '"' || c2 === "'") inQuote = c2;
    else if (c2 === "#") return line.slice(0, i2);
  }
  return line;
}
var QUOTED, HAS_QUOTE, BARE_NUMBER, UNQUOTED_SCALAR;
var init_config = __esm({
  "src/extract/config.ts"() {
    "use strict";
    init_literals();
    QUOTED = /(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
    HAS_QUOTE = /(['"])((?:\\.|(?!\1)[^\\])*)\1/;
    BARE_NUMBER = /(?<![\w.$-])-?\d[\d_]*(?:\.\d+)?(?![\w.$-])/g;
    UNQUOTED_SCALAR = /^\s*[\w.$-]+\s*[:=]\s*([^#\n]+?)\s*$/;
  }
});

// src/scan.ts
import { basename } from "path";
function countLines(s) {
  if (!s) return 0;
  let n = 1;
  for (let i2 = 0; i2 < s.length; i2++) if (s.charCodeAt(i2) === 10) n++;
  return n;
}
function buildCodeRecord(rel2, ext, size, content, hash, lang, opts = {}) {
  const record = {
    rel: rel2,
    ext,
    size,
    lines: countLines(content),
    hash,
    kind: "code",
    lang,
    headings: [],
    symbols: [],
    refs: []
  };
  if (content) {
    const code = extractCode(rel2, ext, content, { maxCallsPerFile: opts.maxCallsPerFile });
    record.title = basename(rel2);
    record.summary = code.summary;
    record.symbols = code.symbols;
    record.refs = code.refs;
    record.pkg = code.pkg;
    record.idents = code.idents;
    record.calls = code.calls;
    record.importedNames = code.importedNames;
    record.truncated = code.truncated;
    record.relations = code.relations;
    record.terms = code.terms;
  } else {
    record.title = basename(rel2);
  }
  return record;
}
function* keptFiles(root, opts) {
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
  for (const f of walked) {
    if (outPrefix && (f.abs === opts.out || f.abs.startsWith(outPrefix))) continue;
    if (include && !include(f.rel)) continue;
    if (exclude && exclude(f.rel)) continue;
    yield { f, kind: classify(f.rel, f.ext), lang: extToLang(f.ext) };
  }
  return { capped, excluded };
}
function keptCodeFiles(root, opts = {}) {
  const out2 = [];
  const it = keptFiles(root, opts);
  for (let step = it.next(); !step.done; step = it.next()) {
    if (step.value.kind === "code") out2.push({ f: step.value.f, lang: step.value.lang });
  }
  return out2;
}
function scanSummary(root, opts = {}) {
  const languages = {};
  let fileCount = 0;
  const it = keptFiles(root, opts);
  let step = it.next();
  for (; !step.done; step = it.next()) {
    languages[step.value.lang] = (languages[step.value.lang] ?? 0) + 1;
    fileCount++;
  }
  return { root, commit: headCommit(root), fileCount, languages, capped: step.value.capped, excluded: step.value.excluded };
}
function scanRepo(root, opts = {}) {
  const files = [];
  const languages = {};
  const docText = /* @__PURE__ */ new Map();
  const mtimes = /* @__PURE__ */ new Map();
  const cache = opts.cache;
  let allReused = cache !== void 0;
  let cacheDirty = cache === void 0;
  const it = keptFiles(root, opts);
  let step = it.next();
  for (; !step.done; step = it.next()) {
    const { f, kind, lang } = step.value;
    languages[lang] = (languages[lang] ?? 0) + 1;
    mtimes.set(f.rel, f.mtimeMs);
    const cached = opts.cache?.get(f.rel);
    if (kind !== "doc" && !opts.fullHash && cached && cached.size !== void 0 && cached.mtimeMs !== void 0 && cached.size === f.size && cached.mtimeMs === f.mtimeMs) {
      files.push(cached.record);
      continue;
    }
    const pre = opts.extracted?.get(f.rel);
    const preUsable = pre && pre.size === f.size && pre.mtimeMs === f.mtimeMs ? pre : void 0;
    const content = preUsable ? void 0 : readText(f.abs);
    const hash = preUsable ? preUsable.record.hash : sha1(content);
    if (cached && cached.hash === hash) {
      files.push(cached.record);
      if (kind === "doc" && content) docText.set(f.rel, content);
      if (cached.size !== f.size || cached.mtimeMs !== f.mtimeMs) cacheDirty = true;
      continue;
    }
    allReused = false;
    cacheDirty = true;
    if (preUsable) {
      files.push(preUsable.record);
      continue;
    }
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
        record.truncated = code.truncated;
        record.relations = code.relations;
        record.terms = code.terms;
        record.literals = code.literals;
      } else if (kind === "config") {
        record.title = basename(f.rel);
        record.literals = extractConfigLiterals(content);
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
    capped: step.value.capped,
    excluded: step.value.excluded,
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
    init_config();
  }
});

// src/preload.ts
import { readFileSync as readFileSync3 } from "fs";
import { join as join3 } from "path";
function toCacheMap(scan2) {
  const m = /* @__PURE__ */ new Map();
  for (const f of scan2.files) m.set(f.rel, { hash: f.hash, record: f, size: f.size, mtimeMs: scan2.mtimes.get(f.rel) });
  return m;
}
function readPersistedIndex(repo, indexDir = INDEX_DIR) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync3(join3(repo, indexDir, "cache.json"), "utf8"));
  } catch {
    return void 0;
  }
  if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION || parsed.extractorVersion !== EXTRACTOR_VERSION || !parsed.files) {
    return void 0;
  }
  return {
    cacheMap: new Map(Object.entries(parsed.files)),
    meta: {
      engineVersion: parsed.engineVersion,
      commit: parsed.commit,
      graphSha1: parsed.graphSha1,
      symbolsSha1: parsed.symbolsSha1
    }
  };
}
function preloadArtifacts(repo, scan2, meta, indexDir = INDEX_DIR) {
  if (!scan2.contentUnchanged || meta.engineVersion !== ENGINE_VERSION || meta.commit !== scan2.commit || meta.graphSha1 === void 0 || meta.symbolsSha1 === void 0) {
    return void 0;
  }
  const dir = join3(repo, indexDir);
  let graphBytes;
  let symbolsBytes;
  try {
    graphBytes = readFileSync3(join3(dir, "graph.json"));
    symbolsBytes = readFileSync3(join3(dir, "symbols.json"));
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
function preloadSession(repo, opts, indexDir = INDEX_DIR) {
  const persisted = readPersistedIndex(repo, indexDir);
  if (!persisted) return void 0;
  const scan2 = scanRepo(repo, { ...opts, cache: persisted.cacheMap });
  return { scan: scan2, cacheMap: toCacheMap(scan2), arts: preloadArtifacts(repo, scan2, persisted.meta, indexDir) };
}
var INDEX_DIR;
var init_preload = __esm({
  "src/preload.ts"() {
    "use strict";
    init_types();
    init_scan();
    init_hash();
    INDEX_DIR = ".codeindex";
  }
});

// src/resolve.ts
import { posix } from "path";
import { join as join7 } from "path";
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
function readTsConfig(root, fileSet, rel2, warnings, seen) {
  if (seen.has(rel2)) return void 0;
  seen.add(rel2);
  const cfg = tolerantJsonParse(readText(join7(root, rel2)));
  if (cfg === void 0) {
    warnings.push(`unparseable ${rel2} \u2014 its path aliases were ignored`);
    return void 0;
  }
  const dir = rel2.includes("/") ? posix.dirname(rel2) : "";
  const eff = { baseUrlDir: "", pathsDir: "" };
  const exts = cfg.extends === void 0 ? [] : Array.isArray(cfg.extends) ? cfg.extends : [cfg.extends];
  for (const ext of exts) {
    if (typeof ext !== "string") continue;
    const baseRel = resolveExtends(fileSet, dir, ext);
    if (!baseRel) {
      if (/^\.\.?\//.test(ext)) warnings.push(`${rel2} extends "${ext}" which is missing \u2014 its path aliases were ignored`);
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
  for (const rel2 of fileSet) {
    const base = rel2.slice(rel2.lastIndexOf("/") + 1);
    const isRootBase = rel2 === "tsconfig.base.json";
    if (base !== "tsconfig.json" && base !== "jsconfig.json" && !isRootBase) continue;
    const dir = rel2.includes("/") ? posix.dirname(rel2) : "";
    const eff = readTsConfig(scan2.root, fileSet, rel2, warnings, /* @__PURE__ */ new Set());
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
  for (const rel2 of fileSet) {
    if (rel2 !== "go.mod" && !rel2.endsWith("/go.mod")) continue;
    const text = readText(join7(scan2.root, rel2));
    const m = /^\s*module\s+(\S+)/m.exec(text);
    if (!m) continue;
    const dir = rel2.includes("/") ? posix.dirname(rel2) : "";
    goModules.push({ module: m[1], dir, replaces: parseGoReplaces(text, dir) });
  }
  goModules.sort((a, b) => b.dir.length - a.dir.length || (a.dir < b.dir ? -1 : 1));
  const rustCrates = [];
  for (const rel2 of fileSet) {
    if (rel2 !== "Cargo.toml" && !rel2.endsWith("/Cargo.toml")) continue;
    const text = readText(join7(scan2.root, rel2));
    const m = /\[package\][^[]*?^\s*name\s*=\s*"([^"]+)"/ms.exec(text);
    if (!m) continue;
    const dir = rel2.includes("/") ? posix.dirname(rel2) : "";
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
  for (const rel2 of fileSet) {
    const base = rel2.split("/").pop();
    if (base === "__init__.py" || base === "pyproject.toml" || base === "setup.py") {
      pyRoots.add(rel2.includes("/") ? posix.dirname(rel2) : "");
    }
  }
  const workspacePackages = [];
  for (const rel2 of fileSet) {
    if (rel2 !== "package.json" && !rel2.endsWith("/package.json")) continue;
    const pkg = tolerantJsonParse(readText(join7(scan2.root, rel2)));
    if (pkg === void 0) {
      warnings.push(`unparseable ${rel2} \u2014 skipped for workspace resolution`);
      continue;
    }
    if (typeof pkg.name !== "string") continue;
    const mainCandidates = [pkg.source, pkg.main, pkg.module, pkg.types].filter(
      (v) => typeof v === "string"
    );
    workspacePackages.push({
      name: pkg.name,
      dir: rel2.includes("/") ? posix.dirname(rel2) : "",
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
  for (const rel2 of fileSet) {
    if (rel2 !== "composer.json" && !rel2.endsWith("/composer.json")) continue;
    const composer = tolerantJsonParse(readText(join7(scan2.root, rel2)));
    if (!composer) {
      warnings.push(`unparseable ${rel2} \u2014 skipped for PHP PSR-4 resolution`);
      continue;
    }
    const baseDir = rel2.includes("/") ? posix.dirname(rel2) : "";
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
    const inDir = (ctx.filesByDir.get(d) ?? []).filter((f) => f.endsWith(".go")).sort();
    return inDir.length ? { kind: "resolved", target: inDir[0] } : { kind: "dangling", reason: "missing-package" };
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
        const inDir = (ctx.filesByDir.get(dir) ?? []).filter((f) => f.endsWith(".java")).sort();
        if (inDir.length) return inDir[0];
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
var ASSET_EXT, JS_EXT_PROBES, JS_INDEX, JS_TS2, SFC_HTML, PY2, C_CPP2, BUILD_DIRS, CONDITION_PRIORITY, MAX_EXPORT_TARGETS;
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

// src/modules.ts
import { posix as posix2 } from "path";
function isTestFile(rel2) {
  return TEST_FILE.test(rel2.split("/").pop());
}
function dirOf(rel2) {
  return rel2.includes("/") ? posix2.dirname(rel2) : ROOT_PATH;
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
var ROOT_PATH, TIER0, TIER2_ANY, TIER2_LEAF, TEST_FILE;
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

// src/calls.ts
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

// src/relations.ts
function typeDefs(scan2) {
  const defs = /* @__PURE__ */ new Map();
  const seen = /* @__PURE__ */ new Set();
  for (const f of scan2.files) {
    for (const s of f.symbols) {
      if (!TYPE_KINDS.has(s.kind)) continue;
      const dedup = `${s.name} ${s.file}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      let arr = defs.get(s.name);
      if (!arr) defs.set(s.name, arr = []);
      arr.push({ name: s.name, file: s.file, kind: s.kind, lang: s.lang, line: s.line });
    }
  }
  return defs;
}
function resolveRelations(scan2, importPairs) {
  const defs = typeDefs(scan2);
  const out2 = [];
  for (const f of scan2.files) {
    if (!f.relations?.length) continue;
    const family = familyOf(f.lang);
    for (const r of f.relations) {
      const cands = (defs.get(r.to) ?? []).filter((d) => familyOf(d.lang) === family);
      if (!cands.length) continue;
      const imported = cands.filter((d) => importPairs.has(`${f.rel}|${d.file}`) || d.file === f.rel);
      const pool = imported.length ? imported : cands;
      const chosen = pickCandidate(f.rel, pool.map((d) => ({ file: d.file, lang: d.lang })));
      if (!chosen) continue;
      const target = pool.find((d) => d.file === chosen.file);
      out2.push({
        kind: CONTRACT_KINDS.has(target.kind) ? "implements" : r.kind,
        from: r.from,
        fromFile: f.rel,
        fromLine: r.line,
        to: target.name,
        toFile: target.file,
        toKind: target.kind
      });
    }
  }
  return out2.sort(
    (a, b) => byStr(a.fromFile, b.fromFile) || byStr(a.from, b.from) || byStr(a.kind, b.kind) || byStr(a.to, b.to)
  );
}
function resolveRelationEdges(scan2, importPairs) {
  const agg = /* @__PURE__ */ new Map();
  for (const r of resolveRelations(scan2, importPairs)) {
    if (r.toFile === r.fromFile) continue;
    const key = `${r.fromFile}${SEP}${r.toFile}${SEP}${r.kind}`;
    const prev = agg.get(key);
    if (prev) prev.weight = Math.min(prev.weight + 1, 5);
    else agg.set(key, { from: r.fromFile, to: r.toFile, kind: r.kind, weight: 1 });
  }
  return [...agg.values()].sort((a, b) => byStr(a.from, b.from) || byStr(a.to, b.to) || byStr(a.kind, b.kind));
}
function buildTypeHierarchy(scan2, importPairs) {
  const defs = typeDefs(scan2);
  const resolved = resolveRelations(scan2, importPairs);
  const entries = /* @__PURE__ */ new Map();
  const keyOf2 = (name2, file) => `${name2}${SEP}${file}`;
  for (const arr of defs.values()) {
    for (const d of arr) {
      entries.set(keyOf2(d.name, d.file), {
        name: d.name,
        file: d.file,
        line: d.line,
        kind: d.kind,
        extends: [],
        implements: [],
        extendedBy: [],
        implementedBy: [],
        unresolved: []
      });
    }
  }
  const refTo = (e) => ({ name: e.name, file: e.file, line: e.line, kind: e.kind });
  for (const r of resolved) {
    const sub = entries.get(keyOf2(r.from, r.fromFile));
    const sup = entries.get(keyOf2(r.to, r.toFile));
    if (!sup) continue;
    if (sub) {
      (r.kind === "extends" ? sub.extends : sub.implements).push(refTo(sup));
      (r.kind === "extends" ? sup.extendedBy : sup.implementedBy).push(refTo(sub));
    } else {
      (r.kind === "extends" ? sup.extendedBy : sup.implementedBy).push({
        name: r.from,
        file: r.fromFile,
        line: r.fromLine,
        kind: "unknown"
      });
    }
  }
  const resolvedKeys = new Set(resolved.map((r) => `${r.fromFile}${SEP}${r.from}${SEP}${r.kind}${SEP}${r.to}`));
  for (const f of scan2.files) {
    for (const r of f.relations ?? []) {
      if (resolvedKeys.has(`${f.rel}${SEP}${r.from}${SEP}${r.kind}${SEP}${r.to}`)) continue;
      const other = r.kind === "extends" ? "implements" : "extends";
      if (resolvedKeys.has(`${f.rel}${SEP}${r.from}${SEP}${other}${SEP}${r.to}`)) continue;
      entries.get(keyOf2(r.from, f.rel))?.unresolved.push({ kind: r.kind, to: r.to });
    }
  }
  const sortRefs = (a, b) => byStr(a.name, b.name) || byStr(a.file, b.file);
  const out2 = /* @__PURE__ */ new Map();
  const sortedKeys = [...entries.keys()].sort(byStr);
  for (const k of sortedKeys) {
    const e = entries.get(k);
    e.extends.sort(sortRefs);
    e.implements.sort(sortRefs);
    e.extendedBy.sort(sortRefs);
    e.implementedBy.sort(sortRefs);
    e.unresolved.sort((a, b) => byStr(a.kind, b.kind) || byStr(a.to, b.to));
    if (!out2.has(e.name)) out2.set(e.name, e);
    else out2.set(`${e.name}@${e.file}`, e);
  }
  return out2;
}
function implementationsOf(hierarchy, name2) {
  const root = hierarchy.get(name2);
  if (!root) return [];
  const seen = /* @__PURE__ */ new Set([`${root.name}${SEP}${root.file}`]);
  const out2 = [];
  let frontier = [root];
  while (frontier.length) {
    const next = [];
    for (const e of frontier) {
      for (const child of [...e.implementedBy, ...e.extendedBy]) {
        const key = `${child.name}${SEP}${child.file}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out2.push(child);
        const entry = hierarchy.get(child.name) ?? hierarchy.get(`${child.name}@${child.file}`);
        if (entry && entry.file === child.file) next.push(entry);
      }
    }
    frontier = next;
  }
  return out2.sort((a, b) => byStr(a.name, b.name) || byStr(a.file, b.file));
}
function typeEntry(hierarchy, name2) {
  return hierarchy.get(name2);
}
var SEP, CONTRACT_KINDS, TYPE_KINDS;
var init_relations = __esm({
  "src/relations.ts"() {
    "use strict";
    init_calls();
    init_sort();
    SEP = "\0";
    CONTRACT_KINDS = /* @__PURE__ */ new Set(["interface", "trait", "protocol"]);
    TYPE_KINDS = /* @__PURE__ */ new Set([
      "class",
      "interface",
      "trait",
      "struct",
      "type",
      "enum",
      "record",
      "object",
      "protocol",
      "module",
      "mod",
      "union",
      "annotation"
    ]);
  }
});

// src/render/symbols-json.ts
function computeSymbolRefs(scan2) {
  const unique = uniqueDefsFor(scan2);
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
function buildSymbolIndex(scan2, refs = /* @__PURE__ */ new Map(), schemaVersion = SCHEMA_VERSION) {
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
  return { schemaVersion, defs, refs: refsOut };
}
function renderSymbolsJson(index) {
  return JSON.stringify(index, null, 2) + "\n";
}
var init_symbols_json = __esm({
  "src/render/symbols-json.ts"() {
    "use strict";
    init_types();
    init_sort();
    init_derived();
  }
});

// src/callers.ts
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
      if (!s.exported || REFERENCE_KINDS2.has(s.kind)) continue;
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
      if (!REFERENCE_KINDS2.has(s.kind) && !byName.has(s.name)) byName.set(s.name, s);
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
    if (REFERENCE_KINDS2.has(s.kind)) continue;
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
    const symbols = f.symbols.filter((s) => !REFERENCE_KINDS2.has(s.kind));
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
var REFERENCE_KINDS2;
var init_callers = __esm({
  "src/callers.ts"() {
    "use strict";
    init_calls();
    init_derived();
    init_sort();
    REFERENCE_KINDS2 = /* @__PURE__ */ new Set(["reexport", "reexport-all", "default"]);
  }
});

// src/symbolgraph.ts
function symbolId(s) {
  return s.parent ? `${s.file}#${s.parent}/${s.name}` : `${s.file}#${s.name}`;
}
function toNode(s) {
  return {
    id: symbolId(s),
    name: s.name,
    kind: s.kind,
    file: s.file,
    line: s.line,
    ...s.endLine !== void 0 ? { endLine: s.endLine } : {},
    exported: s.exported,
    ...s.doc ? { doc: s.doc } : {},
    ...s.signature ? { signature: s.signature } : {}
  };
}
function buildSymbolGraph(scan2, importPairs) {
  const nodes = /* @__PURE__ */ new Map();
  const perFile = /* @__PURE__ */ new Map();
  const defs = /* @__PURE__ */ new Map();
  const defSeen = /* @__PURE__ */ new Set();
  for (const f of scan2.files) {
    const usable = [];
    for (const s of f.symbols) {
      if (REFERENCE_KINDS3.has(s.kind)) continue;
      usable.push(s);
      nodes.set(symbolId(s), toNode(s));
      if (!s.exported) continue;
      const key = `${s.name} ${s.file}`;
      if (defSeen.has(key)) continue;
      defSeen.add(key);
      let arr = defs.get(s.name);
      if (!arr) defs.set(s.name, arr = []);
      arr.push(s);
    }
    perFile.set(f.rel, usable);
  }
  const agg = /* @__PURE__ */ new Map();
  const add = (from, to, kind) => {
    if (from === to) return;
    const key = `${from}${SEP2}${to}${SEP2}${kind}`;
    const prev = agg.get(key);
    if (prev) prev.weight += 1;
    else agg.set(key, { from, to, kind, weight: 1 });
  };
  for (const f of scan2.files) {
    if (!f.calls?.length) continue;
    const family = familyOf(f.lang);
    const own = perFile.get(f.rel) ?? [];
    const localByName = /* @__PURE__ */ new Map();
    for (const s of own) if (!localByName.has(s.name)) localByName.set(s.name, s);
    for (const c2 of f.calls) {
      const caller = enclosingAmong(own, c2.line);
      if (!caller) continue;
      const local = localByName.get(c2.name);
      if (local) {
        if (local.line !== c2.line) add(symbolId(caller), symbolId(local), "calls");
        continue;
      }
      const cands = (defs.get(c2.name) ?? []).filter((d) => familyOf(d.lang) === family && d.file !== f.rel);
      if (!cands.length) continue;
      const imported = cands.filter((d) => importPairs.has(`${f.rel}|${d.file}`));
      const pool = imported.length ? imported : family === "js" ? [] : cands;
      if (!pool.length) continue;
      const chosen = pickCandidate(f.rel, pool.map((d) => ({ file: d.file, lang: d.lang })));
      if (!chosen) continue;
      const target = pool.find((d) => d.file === chosen.file);
      add(symbolId(caller), symbolId(target), "calls");
    }
  }
  const typeIdByNameFile = /* @__PURE__ */ new Map();
  for (const node of nodes.values()) typeIdByNameFile.set(`${node.name} ${node.file}`, node.id);
  for (const r of resolveRelations(scan2, importPairs)) {
    const from = typeIdByNameFile.get(`${r.from} ${r.fromFile}`);
    const to = typeIdByNameFile.get(`${r.to} ${r.toFile}`);
    if (from && to) add(from, to, r.kind);
  }
  const edges = [...agg.values()].sort(
    (a, b) => byStr(a.from, b.from) || byStr(a.kind, b.kind) || byStr(a.to, b.to)
  );
  const out2 = /* @__PURE__ */ new Map();
  const inc = /* @__PURE__ */ new Map();
  for (const e of edges) {
    (out2.get(e.from) ?? out2.set(e.from, []).get(e.from)).push(e);
    (inc.get(e.to) ?? inc.set(e.to, []).get(e.to)).push(e);
  }
  const byName = /* @__PURE__ */ new Map();
  for (const id of [...nodes.keys()].sort(byStr)) {
    const n = nodes.get(id);
    (byName.get(n.name) ?? byName.set(n.name, []).get(n.name)).push(id);
  }
  return { nodes, edges, out: out2, in: inc, byName };
}
function neighborhood(graph, name2, opts = {}) {
  const depthLimit = Math.max(1, Math.min(opts.depth ?? 2, MAX_DEPTH));
  const direction = opts.direction ?? "both";
  const rootIds = graph.nodes.has(name2) ? [name2] : graph.byName.get(name2) ?? [...graph.nodes.keys()].filter((id) => id.endsWith(`#${name2}`));
  const root = rootIds.map((id) => graph.nodes.get(id)).filter(Boolean);
  if (!root.length) return { root: [], nodes: [], edges: [] };
  const depthOf = /* @__PURE__ */ new Map();
  for (const id of rootIds) depthOf.set(id, 0);
  const picked = /* @__PURE__ */ new Map();
  let frontier = [...rootIds];
  let truncated = false;
  for (let d = 1; d <= depthLimit && frontier.length; d++) {
    const next = [];
    for (const id of frontier) {
      const step = (edges2, other) => {
        for (const e of edges2 ?? []) {
          picked.set(`${e.from}${SEP2}${e.to}${SEP2}${e.kind}`, e);
          const o = other(e);
          if (depthOf.has(o)) continue;
          if (depthOf.size >= MAX_NODES) {
            truncated = true;
            continue;
          }
          depthOf.set(o, d);
          next.push(o);
        }
      };
      if (direction !== "in") step(graph.out.get(id), (e) => e.to);
      if (direction !== "out") step(graph.in.get(id), (e) => e.from);
    }
    frontier = next;
  }
  const nodes = [...depthOf.entries()].map(([id, depth]) => ({ ...graph.nodes.get(id), depth })).sort((a, b) => a.depth - b.depth || byStr(a.file, b.file) || byStr(a.name, b.name));
  const edges = [...picked.values()].filter((e) => depthOf.has(e.from) && depthOf.has(e.to)).sort((a, b) => byStr(a.from, b.from) || byStr(a.kind, b.kind) || byStr(a.to, b.to));
  return { root, nodes, edges, ...truncated ? { truncated: true } : {} };
}
var SEP2, REFERENCE_KINDS3, MAX_DEPTH, MAX_NODES;
var init_symbolgraph = __esm({
  "src/symbolgraph.ts"() {
    "use strict";
    init_calls();
    init_callers();
    init_relations();
    init_sort();
    SEP2 = "\0";
    REFERENCE_KINDS3 = /* @__PURE__ */ new Set(["reexport", "reexport-all", "default"]);
    MAX_DEPTH = 5;
    MAX_NODES = 400;
  }
});

// src/tests-map.ts
function isTestPath(rel2) {
  if (TEST_DIR.test(rel2)) return true;
  if (isTestFile(rel2)) return true;
  const base = rel2.split("/").pop();
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
var BASENAME_PATTERNS, TEST_DIR;
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

// src/bm25.ts
function addTerms(doc, field, text) {
  const f = doc.fields[field];
  for (const t of subtokens(text)) {
    f.tf.set(t, (f.tf.get(t) ?? 0) + 1);
    f.len++;
    doc.all.add(t);
  }
}
function emptyFields() {
  const out2 = {};
  for (const f of FIELDS) out2[f] = { tf: /* @__PURE__ */ new Map(), len: 0 };
  return out2;
}
function buildDocs(scan2) {
  const docs = [];
  for (const f of scan2.files) {
    const doc = {
      file: f.rel,
      fields: emptyFields(),
      all: /* @__PURE__ */ new Set(),
      symbols: [],
      decls: [],
      exactNames: /* @__PURE__ */ new Set(),
      isTest: isTestPath(f.rel)
    };
    const seenSym = /* @__PURE__ */ new Set();
    for (const s of f.symbols) {
      addTerms(doc, "name", s.name);
      if (s.doc) addTerms(doc, "doc", s.doc);
      doc.exactNames.add(foldText(s.name).toLowerCase());
      if (!seenSym.has(s.name)) {
        seenSym.add(s.name);
        doc.symbols.push(s.name);
        doc.decls.push({ name: s.name, kind: s.kind, line: s.line });
      }
    }
    for (const seg of f.rel.split("/")) addTerms(doc, "path", seg);
    for (const h of f.headings) addTerms(doc, "heading", h);
    if (f.summary) addTerms(doc, "summary", f.summary);
    for (const t of f.terms ?? []) addTerms(doc, "body", t);
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
function buildStemIndex(docs) {
  const seen = /* @__PURE__ */ new Set();
  const index = /* @__PURE__ */ new Map();
  for (const d of docs) {
    for (const term of d.all) {
      if (seen.has(term)) continue;
      seen.add(term);
      const stem = stemOf(term);
      if (stem === term) continue;
      let arr = index.get(stem);
      if (!arr) index.set(stem, arr = []);
      arr.push(term);
    }
  }
  for (const arr of index.values()) arr.sort(byStr);
  return index;
}
function buildTrigramIndex(docs) {
  const index = /* @__PURE__ */ new Map();
  for (const d of docs) {
    for (const term of d.all) {
      if (!index.has(term)) index.set(term, charTrigrams(term));
    }
  }
  return index;
}
function searchIndex(scan2, query, opts = {}) {
  return runSearch(scan2, query, opts).results;
}
function explainQuery(scan2, query, opts = {}) {
  return runSearch(scan2, query, opts);
}
function emptyExplanation(query, verdict, note) {
  return {
    results: [],
    explain: {
      query,
      terms: [],
      droppedStopwords: droppedKeywords(query),
      unresolvedTerms: [],
      verdict,
      note,
      bridgedOnlyResults: 0,
      resultCount: 0
    }
  };
}
function runSearch(scan2, query, opts = {}) {
  const terms = [];
  const seen = /* @__PURE__ */ new Set();
  for (const kw of keywords(query)) {
    for (const t of subtokens(kw)) {
      if (seen.has(t)) continue;
      seen.add(t);
      terms.push(t);
    }
  }
  if (!terms.length) {
    const dropped = droppedKeywords(query);
    return emptyExplanation(
      query,
      "none",
      dropped.length ? `Nothing was searched for: every token in this query (${dropped.join(", ")}) is a stopword or too short to index. Search with the identifiers or domain words you are actually looking for.` : "Nothing was searched for: the query carried no indexable token."
    );
  }
  const queryWantsTests = terms.some((t) => TEST_INTENT.test(t));
  const docs = bm25DocsFor(scan2);
  const n = docs.length;
  if (!n) return emptyExplanation(query, "none", "This index contains no files.");
  const avgLen = {};
  for (const f of FIELDS) {
    let total = 0;
    for (const d of docs) total += d.fields[f].len;
    avgLen[f] = total / n || 1;
  }
  const df = /* @__PURE__ */ new Map();
  for (const t of terms) {
    let count = 0;
    for (const d of docs) if (d.all.has(t)) count++;
    df.set(t, count);
  }
  const fuzzyEnabled = opts.fuzzy ?? true;
  const fuzzyCandidates = /* @__PURE__ */ new Map();
  if (fuzzyEnabled) {
    const unmatched = terms.filter((t) => df.get(t) === 0);
    if (unmatched.length) {
      const stemIndex = bm25StemsFor(scan2);
      const stillUnmatched = [];
      for (const t of unmatched) {
        const viaStem = (stemIndex.get(stemOf(t)) ?? []).filter((v) => v !== t);
        if (viaStem.length) {
          fuzzyCandidates.set(
            t,
            viaStem.slice(0, FUZZY_CAP).map((term) => ({ term, dice: STEM_WEIGHT }))
          );
        } else stillUnmatched.push(t);
      }
      if (stillUnmatched.length) {
        const trigramIndex = bm25TrigramsFor(scan2);
        for (const t of stillUnmatched) {
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
  }
  const vocabDf = /* @__PURE__ */ new Map();
  const dfOfVocabTerm = (term) => {
    const known = df.get(term) ?? vocabDf.get(term);
    if (known !== void 0) return known;
    let count = 0;
    for (const d of docs) if (d.all.has(term)) count++;
    vocabDf.set(term, count);
    return count;
  };
  const idfOf = (docFreq) => Math.log(1 + (n - docFreq + 0.5) / (docFreq + 0.5));
  const prior = opts.rank === "graph" ? importPagerankFor(scan2) : void 0;
  const results = [];
  for (const d of docs) {
    let score = 0;
    const matched = [];
    const matchedFields = /* @__PURE__ */ new Set();
    const symbolTerms = /* @__PURE__ */ new Set();
    const fuzzyHit = /* @__PURE__ */ new Set();
    let exactNameHit = false;
    const weightedTf = (term) => {
      let wtf = 0;
      for (const f of FIELDS) {
        const fd = d.fields[f];
        const tf = fd.tf.get(term);
        if (!tf) continue;
        matchedFields.add(f);
        const b = FIELD_B[f];
        wtf += FIELD_WEIGHT[f] * tf / (1 - b + b * fd.len / avgLen[f]);
      }
      return wtf;
    };
    for (const t of terms) {
      const wtf = weightedTf(t);
      if (wtf > 0) {
        matched.push(t);
        symbolTerms.add(t);
        if (d.exactNames.has(t)) exactNameHit = true;
        score += idfOf(df.get(t)) * (wtf / (K1 + wtf));
        continue;
      }
      for (const cand of fuzzyCandidates.get(t) ?? []) {
        const cwtf = weightedTf(cand.term);
        if (!cwtf) continue;
        score += idfOf(dfOfVocabTerm(cand.term)) * (cwtf / (K1 + cwtf)) * cand.dice;
        symbolTerms.add(cand.term);
        fuzzyHit.add(t);
      }
    }
    if (!matched.length && !fuzzyHit.size) continue;
    if (exactNameHit) score *= EXACT_NAME_BOOST;
    if (d.isTest && !queryWantsTests) score *= TEST_DEMOTION;
    if (prior) {
      score *= 1 + 0.35 * Math.log1p(prior.get(d.file) ?? 0);
    }
    const scored = d.decls.map((decl) => {
      const toks = new Set(subtokens(decl.name));
      let hits2 = 0;
      for (const t of symbolTerms) if (toks.has(t)) hits2++;
      return { decl, hits: hits2 };
    }).filter((s) => s.hits > 0).sort((a, b) => b.hits - a.hits || byStr(a.decl.name, b.decl.name));
    const hits = scored.slice(0, TOP_SYMBOLS).map((s) => s.decl);
    const result = {
      file: d.file,
      score: Number(score.toFixed(4)),
      matchedTerms: matched.sort(byStr),
      topSymbols: hits.map((h) => h.name)
    };
    if (matchedFields.size) result.matchedFields = FIELDS.filter((f) => matchedFields.has(f));
    if (hits.length) {
      result.symbolHits = hits;
      result.line = Math.min(...hits.map((h) => h.line));
    }
    if (fuzzyHit.size) result.fuzzyTerms = [...fuzzyHit].sort(byStr);
    if (!matched.length) result.bridgedOnly = true;
    results.push(result);
  }
  results.sort((a, b) => b.score - a.score || byStr(a.file, b.file));
  const kept = (opts.exact ? results.filter((r) => !r.bridgedOnly) : results).slice(0, opts.limit ?? DEFAULT_LIMIT);
  return { results: kept, explain: explainOf(query, terms, df, fuzzyCandidates, kept) };
}
function explainOf(query, terms, df, fuzzyCandidates, kept) {
  const diagnostics = terms.map((term) => {
    const frequency = df.get(term) ?? 0;
    const candidates = frequency === 0 ? fuzzyCandidates.get(term) ?? [] : [];
    if (!candidates.length) return { term, df: frequency };
    const via = candidates[0].dice === STEM_WEIGHT ? "stem" : "trigram";
    return { term, df: frequency, bridge: { via, to: candidates.map((c2) => c2.term), dice: candidates[0].dice } };
  });
  const unresolvedTerms = diagnostics.filter((d) => d.df === 0 && !d.bridge).map((d) => d.term).sort(byStr);
  const wholeIdentifier = !/\s/.test(query.trim()) && terms.length ? { term: terms[0], df: df.get(terms[0]) ?? 0 } : void 0;
  const bridgedOnlyResults = kept.filter((r) => r.bridgedOnly).length;
  const allBridged = kept.length > 0 && bridgedOnlyResults === kept.length;
  const missingIdentifier = wholeIdentifier?.df === 0;
  const verdict = !kept.length ? "none" : missingIdentifier || allBridged ? "weak" : "match";
  const explain = {
    query,
    terms: diagnostics,
    droppedStopwords: droppedKeywords(query),
    unresolvedTerms,
    ...wholeIdentifier ? { wholeIdentifier } : {},
    verdict,
    bridgedOnlyResults,
    resultCount: kept.length
  };
  const note = noteFor(explain, missingIdentifier, allBridged);
  if (note) explain.note = note;
  return explain;
}
function noteFor(explain, missingIdentifier, allBridged) {
  const { verdict, wholeIdentifier, resultCount, terms } = explain;
  if (verdict === "match") return void 0;
  if (!resultCount) {
    return explain.unresolvedTerms.length ? `No file matches. ${explain.unresolvedTerms.length === 1 ? "The term" : "The terms"} ${explain.unresolvedTerms.join(", ")} appear nowhere in this index.` : "No file matches this query.";
  }
  if (missingIdentifier && wholeIdentifier) {
    const parts2 = terms.filter((t) => t.term !== wholeIdentifier.term && t.df > 0).map((t) => t.term).join(", ");
    const near = terms.find((t) => t.term === wholeIdentifier.term)?.bridge?.to ?? [];
    const because = parts2 ? ` The ${resultCount} result${resultCount === 1 ? "" : "s"} below match only its parts (${parts2}).` : "";
    const suggestion = near.length ? ` Closest indexed name${near.length === 1 ? "" : "s"}: ${near.join(", ")}.` : "";
    return `No file in this index defines or mentions "${wholeIdentifier.term}".${because}${suggestion} If you expected it here, check you are indexing the right branch or commit.`;
  }
  if (allBridged) {
    const bridged = terms.filter((t) => t.bridge);
    const spelled = bridged.map((t) => `"${t.term}" \u2192 ${t.bridge.to.join(", ")}`).join("; ");
    return `Nothing matched verbatim. Every result below came from a near match: ${spelled}. Re-run with --exact to see only literal matches.`;
  }
  return void 0;
}
var K1, DEFAULT_LIMIT, TOP_SYMBOLS, FUZZY_DICE_THRESHOLD, FUZZY_CAP, STEM_WEIGHT, FIELDS, FIELD_WEIGHT, FIELD_B, EXACT_NAME_BOOST, TEST_DEMOTION, TEST_INTENT;
var init_bm25 = __esm({
  "src/bm25.ts"() {
    "use strict";
    init_derived();
    init_util();
    init_tests_map();
    init_sort();
    K1 = 1.2;
    DEFAULT_LIMIT = 20;
    TOP_SYMBOLS = 5;
    FUZZY_DICE_THRESHOLD = 0.6;
    FUZZY_CAP = 3;
    STEM_WEIGHT = 0.9;
    FIELDS = ["name", "path", "heading", "summary", "doc", "body"];
    FIELD_WEIGHT = { name: 3, path: 2, heading: 1.5, summary: 1.5, doc: 1.6, body: 0.7 };
    FIELD_B = { name: 0.75, path: 0.75, heading: 0.75, summary: 0.75, doc: 0.75, body: 0.4 };
    EXACT_NAME_BOOST = 1.35;
    TEST_DEMOTION = 0.65;
    TEST_INTENT = /^(test|tests|spec|specs|fixture|fixtures|mock|mocks|stub|stubs)$/;
  }
});

// src/centrality.ts
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
var DAMPING, MAX_ITERS, CONVERGENCE, BETWEENNESS_MAX_NODES;
var init_centrality = __esm({
  "src/centrality.ts"() {
    "use strict";
    DAMPING = 0.85;
    MAX_ITERS = 100;
    CONVERGENCE = 1e-10;
    BETWEENNESS_MAX_NODES = 3e3;
  }
});

// src/complexity.ts
import { join as join8 } from "path";
function complexityOfSource(source) {
  return 1 + (source.match(BRANCH_RE) ?? []).length;
}
function symbolComplexity(scan2, rel2, top = 50) {
  const out2 = [];
  for (const f of scan2.files) {
    if (f.kind !== "code") continue;
    if (rel2 && f.rel !== rel2) continue;
    if (!f.symbols.length) continue;
    const lines = readText(join8(scan2.root, f.rel)).split("\n");
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

// src/derived.ts
import { join as join9 } from "path";
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
function publishImportPairs(scan2, ctx, pairs) {
  const c2 = caches.get(scan2);
  if (!c2 || c2.resolveCtx !== ctx || c2.importPairs) return;
  c2.importPairs = pairs;
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
function hierarchyFor(scan2) {
  const c2 = cacheFor(scan2);
  return c2.hierarchy ??= buildTypeHierarchy(scan2, importPairsFor(scan2));
}
function symbolGraphFor(scan2) {
  const c2 = cacheFor(scan2);
  return c2.symbolGraph ??= buildSymbolGraph(scan2, importPairsFor(scan2));
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
function importPagerankFor(scan2) {
  const c2 = cacheFor(scan2);
  if (!c2.importPagerank) {
    const ids = scan2.files.map((f) => f.rel);
    const edges = [];
    for (const pair of importPairsFor(scan2)) {
      const sep3 = pair.indexOf("|");
      edges.push({ from: pair.slice(0, sep3), to: pair.slice(sep3 + 1), kind: "import", weight: 1 });
    }
    c2.importPagerank = pagerankOf(ids, edges);
  }
  return c2.importPagerank;
}
function bm25StemsFor(scan2) {
  const c2 = cacheFor(scan2);
  const bm25 = c2.bm25 ??= { docs: buildDocs(scan2) };
  return bm25.stems ??= buildStemIndex(bm25.docs);
}
function fileComplexityFor(scan2) {
  const c2 = cacheFor(scan2);
  if (!c2.fileComplexity) {
    const m = /* @__PURE__ */ new Map();
    for (const f of scan2.files) {
      if (f.kind !== "code") continue;
      m.set(f.rel, complexityOfSource(readText(join9(scan2.root, f.rel))));
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
    init_relations();
    init_symbolgraph();
    init_bm25();
    init_centrality();
    init_complexity();
    init_walk();
    caches = /* @__PURE__ */ new WeakMap();
  }
});

// src/graph.ts
import { join as join10 } from "path";
function isDistinctive(name2) {
  if (name2.length < 5) return false;
  const internalUpper = /[a-z][A-Z]/.test(name2) || /[A-Z]{2}/.test(name2);
  return internalUpper || name2.includes("_") || /\d/.test(name2);
}
function uniqueSymbolDefs(scan2) {
  const byName = /* @__PURE__ */ new Map();
  for (const f of scan2.files) {
    for (const s of f.symbols) {
      if (!s.exported || REFERENCE_KINDS4.has(s.kind) || !isDistinctive(s.name)) continue;
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
  for (const e of resolveRelationEdges(scan2, importPairs)) {
    collect(fileEdgeMap, e);
    callPairs.add(`${e.from}|${e.to}`);
  }
  publishImportPairs(scan2, ctx, importPairs);
  const unique = uniqueDefsFor(scan2);
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
      const content = scan2.docText.get(f.rel) ?? readText(join10(scan2.root, f.rel));
      if (!content) continue;
      const tokens = /* @__PURE__ */ new Map();
      for (const tok of content.split(/[^A-Za-z0-9_]+/)) {
        if (unique.has(tok)) tokens.set(tok, (tokens.get(tok) ?? 0) + 1);
      }
      for (const [name2, count] of tokens) {
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
  const KIND_RANK = {
    import: 7,
    extends: 6,
    implements: 5,
    call: 4,
    use: 3,
    "doc-link": 2,
    mention: 1,
    contains: 0
  };
  const modEdgeMap = /* @__PURE__ */ new Map();
  for (const e of fileEdges) {
    if (e.dangling || !fileSet.has(e.to)) continue;
    const from = moduleOf.get(e.from);
    const to = moduleOf.get(e.to);
    if (!from || !to || from === to) continue;
    const k = `${from}${SEP3}${to}`;
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
var REFERENCE_KINDS4, SEP3, keyOf;
var init_graph = __esm({
  "src/graph.ts"() {
    "use strict";
    init_types();
    init_resolve();
    init_calls();
    init_relations();
    init_derived();
    init_walk();
    init_sort();
    REFERENCE_KINDS4 = /* @__PURE__ */ new Set(["reexport", "reexport-all", "default"]);
    SEP3 = "\0";
    keyOf = (from, to, kind) => `${from}${SEP3}${to}${SEP3}${kind}`;
  }
});

// src/query.ts
import { join as join11 } from "path";
function symbolsOverview(scan2, rel2) {
  const f = scan2.files.find((x) => x.rel === rel2);
  if (!f) return [];
  return [...f.symbols].filter((s) => !REFERENCE_KINDS5.has(s.kind)).sort((a, b) => a.line - b.line || byStr(a.name, b.name));
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
      if (REFERENCE_KINDS5.has(s.kind)) continue;
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
      const content = readText(join11(scan2.root, m.file));
      if (!content) continue;
      m.body = content.split("\n").slice(m.line - 1, end).join("\n");
    }
  }
  if (opts.concise) {
    return capped.map((m) => ({
      name: m.name,
      kind: m.kind,
      file: m.file,
      line: m.line,
      ...m.body !== void 0 ? { body: m.body } : {}
    }));
  }
  return capped;
}
function findReferences(scan2, name2) {
  const defs = [];
  for (const f of scan2.files) {
    for (const s of f.symbols) {
      if (s.name === name2 && !REFERENCE_KINDS5.has(s.kind)) defs.push(s);
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
var REFERENCE_KINDS5;
var init_query = __esm({
  "src/query.ts"() {
    "use strict";
    init_walk();
    init_derived();
    init_sort();
    REFERENCE_KINDS5 = /* @__PURE__ */ new Set(["reexport", "reexport-all", "default"]);
  }
});

// src/edit.ts
import { readFileSync as readFileSync6, writeFileSync as writeFileSync2 } from "fs";
import { join as join12 } from "path";
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
  return readFileSync6(abs, "utf8").split("\n");
}
function replaceSymbolBody(scan2, namePath, body2, file) {
  const sym = resolveUniqueSymbol(scan2, namePath, file);
  const end = sym.endLine ?? sym.line;
  const abs = join12(scan2.root, sym.file);
  const lines = readLines(abs);
  const newLines = body2.replace(/^\n+|\n+$/g, "").split("\n");
  lines.splice(sym.line - 1, end - sym.line + 1, ...newLines);
  writeFileSync2(abs, lines.join("\n"));
  return { file: sym.file, startLine: sym.line, endLine: sym.line + newLines.length - 1, lines: newLines.length };
}
function insertAt(scan2, sym, body2, index, blankBefore, blankAfter) {
  const abs = join12(scan2.root, sym.file);
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

// src/memory.ts
import { mkdirSync as mkdirSync2, readdirSync as readdirSync2, readFileSync as readFileSync7, rmSync as rmSync2, statSync as statSync3, writeFileSync as writeFileSync3 } from "fs";
import { dirname as dirname4, join as join13 } from "path";
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
  return join13(repo, ...MEMORY_DIR, `${sanitize(name2)}.md`);
}
function writeMemory(repo, name2, content) {
  const path = memoryPath(repo, name2);
  mkdirSync2(dirname4(path), { recursive: true });
  writeFileSync3(path, content.endsWith("\n") ? content : content + "\n");
  return sanitize(name2);
}
function readMemory(repo, name2) {
  try {
    return readFileSync7(memoryPath(repo, name2), "utf8");
  } catch {
    return void 0;
  }
}
function deleteMemory(repo, name2) {
  const path = memoryPath(repo, name2);
  try {
    statSync3(path);
  } catch {
    return false;
  }
  rmSync2(path);
  return true;
}
function listMemories(repo) {
  const root = join13(repo, ...MEMORY_DIR);
  const out2 = [];
  const walk2 = (dir, prefix) => {
    let entries;
    try {
      entries = readdirSync2(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) walk2(join13(dir, e.name), prefix ? `${prefix}/${e.name}` : e.name);
      else if (e.name.endsWith(".md")) out2.push(prefix ? `${prefix}/${e.name.slice(0, -3)}` : e.name.slice(0, -3));
    }
  };
  walk2(root, "");
  return out2.sort();
}
var MEMORY_DIR;
var init_memory = __esm({
  "src/memory.ts"() {
    "use strict";
    MEMORY_DIR = [".codeindex", "memories"];
  }
});

// src/workspaces.ts
import { existsSync as existsSync5, readdirSync as readdirSync3, statSync as statSync4 } from "fs";
import { join as join14 } from "path";
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
  const path = join14(root, dir, "package.json");
  if (!existsSync5(path)) return void 0;
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
  const path = join14(root, dir, "Cargo.toml");
  if (!existsSync5(path)) return void 0;
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
  const path = join14(root, dir, "go.mod");
  if (!existsSync5(path)) return void 0;
  const name2 = readText(path).match(/^module\s+(\S+)/m)?.[1] ?? dir;
  return { name: name2, dir, kind: "go", manifest: `${dir}/go.mod` };
}
function probeMaven(root, dir) {
  const path = join14(root, dir, "pom.xml");
  if (!existsSync5(path)) return void 0;
  return { name: ownArtifactId(readText(path)) ?? dir, dir, kind: "maven", manifest: `${dir}/pom.xml` };
}
function probePyproject(root, dir) {
  const path = join14(root, dir, "pyproject.toml");
  if (!existsSync5(path)) return void 0;
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
  const path = join14(root, dir, "composer.json");
  if (!existsSync5(path)) return void 0;
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
  const path = join14(root, dir, "project.json");
  if (!existsSync5(path)) return void 0;
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
    if (existsSync5(join14(root, dir, f))) {
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
function isDirAt(root, rel2) {
  try {
    return statSync4(join14(root, rel2)).isDirectory();
  } catch {
    return false;
  }
}
function subdirsOf(root, base) {
  let entries;
  try {
    entries = readdirSync3(base ? join14(root, base) : root, { withFileTypes: true });
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
  const pkg = readJson(join14(root, "package.json"), "package.json", warnings);
  const ws = pkg?.workspaces;
  if (Array.isArray(ws)) {
    for (const x of ws) if (typeof x === "string") push(x, "npm");
  } else if (ws && typeof ws === "object" && Array.isArray(ws.packages)) {
    for (const x of ws.packages) if (typeof x === "string") push(x, "npm");
  }
  const pnpm = readText(join14(root, "pnpm-workspace.yaml"));
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
  const lerna = readJson(join14(root, "lerna.json"), "lerna.json", warnings);
  if (lerna && Array.isArray(lerna.packages)) {
    return lerna.packages.filter((x) => typeof x === "string").map((pattern) => ({ pattern, kind: "lerna" }));
  }
  const nx = readJson(join14(root, "nx.json"), "nx.json", warnings);
  if (nx) {
    const layout = nx.workspaceLayout ?? {};
    const appsDir = typeof layout.appsDir === "string" ? layout.appsDir : "apps";
    const libsDir = typeof layout.libsDir === "string" ? layout.libsDir : "libs";
    return [.../* @__PURE__ */ new Set([appsDir, libsDir])].map((dir) => ({ pattern: `${dir}/*`, kind: "nx" }));
  }
  return [];
}
function detectCargoMembers(root, found, warnings) {
  const toml = readText(join14(root, "Cargo.toml"));
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
  const gowork = readText(join14(root, "go.work"));
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
  const pom = readText(join14(root, "pom.xml"));
  if (!pom) return;
  const modules = pom.match(/<modules>([\s\S]*?)<\/modules>/)?.[1];
  if (!modules) return;
  for (const m of modules.matchAll(/<module>\s*([^<]+?)\s*<\/module>/g)) {
    addPackage(root, m[1], found, "maven", warnings);
  }
}
function detectUvMembers(root, found, warnings) {
  const toml = readText(join14(root, "pyproject.toml"));
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
  const composer = readJson(join14(root, "composer.json"), "composer.json", warnings);
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
    const text = readText(join14(root, f));
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
  const manifest = readJson(join14(root, pkg.dir, "package.json"), `${pkg.dir}/package.json`, warnings);
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
function normalizeDepPath(fromDir, rel2) {
  const parts2 = `${fromDir}/${rel2}`.split("/");
  const out2 = [];
  for (const p of parts2) {
    if (!p || p === ".") continue;
    if (p === "..") out2.pop();
    else out2.push(p);
  }
  return out2.join("/");
}
function cargoEdges(root, pkg, byName, byDir) {
  const toml = readText(join14(root, pkg.dir, "Cargo.toml"));
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
  const gomod = readText(join14(root, pkg.dir, "go.mod"));
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
  const pom = readText(join14(root, pkg.dir, "pom.xml"));
  if (!pom) return [];
  const edges = /* @__PURE__ */ new Set();
  for (const m of pom.replace(/<parent>[\s\S]*?<\/parent>/g, "").matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
    const aid = m[1].match(/<artifactId>\s*([^<]+?)\s*<\/artifactId>/)?.[1];
    if (aid && aid !== pkg.name && byName.has(aid)) edges.add(aid);
  }
  return [...edges];
}
function uvEdges(root, pkg, byName) {
  const toml = readText(join14(root, pkg.dir, "pyproject.toml"));
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
  const manifest = readJson(join14(root, pkg.dir, "composer.json"), `${pkg.dir}/composer.json`, warnings);
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
    const text = readText(join14(root, pkg.dir, f));
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
    packageOf: (rel2) => byDepth.find((p) => rel2 === p.dir || rel2.startsWith(p.dir + "/"))
  };
}
var WS_SKIP_DIRS, MAX_RECURSE_DEPTH;
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

// src/community.ts
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
var GAMMA, MAX_SWEEPS, MAX_PASSES, EPS, OVERSIZE_FRACTION, OVERSIZE_MIN;
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

// src/surprise.ts
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
var SURPRISE_CAP, MAX_PAIR_EDGES, DEP_KINDS;
var init_surprise = __esm({
  "src/surprise.ts"() {
    "use strict";
    init_sort();
    SURPRISE_CAP = 24;
    MAX_PAIR_EDGES = 2;
    DEP_KINDS = /* @__PURE__ */ new Set(["import", "call", "use"]);
  }
});

// src/render/graph-json.ts
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

// src/literals.ts
function isDistinctive2(value, kind) {
  if (kind !== "string") return true;
  return value.length >= DISTINCTIVE_MIN_LEN || HAS_SEPARATOR.test(value);
}
function isFunctionValued(signature) {
  if (!signature) return false;
  for (let i2 = 0; i2 < signature.length; i2++) {
    if (signature[i2] !== "=") continue;
    if (signature[i2 + 1] === "=" || signature[i2 + 1] === ">") continue;
    if ("=!<>+-*/%&|^".includes(signature[i2 - 1] ?? "")) continue;
    return FUNCTION_RHS.test(signature.slice(i2 + 1));
  }
  return false;
}
function holderFor(symbols, line) {
  let best;
  for (const s of symbols) {
    if (!HOLDER_KINDS.has(s.kind)) continue;
    if (isFunctionValued(s.signature)) continue;
    const end = s.endLine ?? s.line;
    if (end - s.line > MAX_HOLDER_SPAN) continue;
    if (line < s.line || line > end) continue;
    if (!best || s.line > best.line) best = s;
  }
  return best;
}
function findLiteralDuplications(scan2, opts = {}) {
  const minFiles = opts.minFiles ?? DEFAULTS.minFiles;
  const minCount = opts.minCount ?? DEFAULTS.minCount;
  const groups = /* @__PURE__ */ new Map();
  for (const f of scan2.files) {
    if (!f.literals?.length) continue;
    if (!opts.includeTests && isTestPath(f.rel)) continue;
    for (const lit of f.literals) {
      if (opts.kinds && !opts.kinds.has(lit.kind)) continue;
      if (!isDistinctive2(lit.value, lit.kind)) continue;
      const key = `${lit.kind}\0${lit.value}`;
      let g = groups.get(key);
      if (!g) groups.set(key, g = { value: lit.value, kind: lit.kind, sites: [] });
      const holder = holderFor(f.symbols, lit.line);
      g.sites.push(
        holder ? { file: f.rel, line: lit.line, holder: holder.name, holderExported: holder.exported } : { file: f.rel, line: lit.line }
      );
    }
  }
  const duplications = [];
  for (const g of groups.values()) {
    const files = new Set(g.sites.map((s) => s.file));
    if (files.size < minFiles || g.sites.length < minCount) continue;
    const holders = g.sites.filter((s) => s.holder);
    const literals = g.sites.filter((s) => !s.holder);
    const distinctHolderNames = new Set(holders.map((h) => h.holder));
    const distinctHolders = new Set(holders.map((h) => `${h.file}\0${h.holder}`));
    let tier = distinctHolders.size >= 2 ? "competing" : holders.length > 0 ? "bypassed" : "uncentralized";
    if (g.kind === "number") {
      if (distinctHolderNames.size !== 1 || literals.length === 0) continue;
      tier = "bypassed";
    }
    if (tier === "bypassed" && literals.length === 0) continue;
    duplications.push({
      value: g.value,
      kind: g.kind,
      tier,
      holders: holders.sort(siteOrder),
      literals: literals.sort(siteOrder),
      files: files.size,
      count: g.sites.length
    });
  }
  duplications.sort(
    (a, b) => tierRank(a.tier) - tierRank(b.tier) || b.files - a.files || b.count - a.count || byStr(a.value, b.value)
  );
  return { duplications, families: groupFamilies(duplications) };
}
function siteOrder(a, b) {
  return byStr(a.file, b.file) || a.line - b.line;
}
function tierRank(t) {
  return t === "competing" ? 0 : t === "bypassed" ? 1 : 2;
}
function groupFamilies(dups) {
  const byPrefix = /* @__PURE__ */ new Map();
  for (const d of dups) {
    if (d.kind !== "string" || !PATH_LIKE.test(d.value)) continue;
    const prefix = pathPrefix(d.value);
    if (!prefix) continue;
    const list = byPrefix.get(prefix);
    if (list) list.push(d);
    else byPrefix.set(prefix, [d]);
  }
  const families = [];
  for (const [prefix, members] of byPrefix) {
    if (members.length < FAMILY_MIN_MEMBERS) continue;
    const files = /* @__PURE__ */ new Set();
    let count = 0;
    for (const m of members) {
      for (const s of [...m.holders, ...m.literals]) files.add(s.file);
      count += m.count;
    }
    families.push({ prefix, members, files: files.size, count });
  }
  families.sort((a, b) => b.files - a.files || b.count - a.count || byStr(a.prefix, b.prefix));
  return families;
}
function pathPrefix(value) {
  const body2 = value.startsWith("/") ? value.slice(1) : value;
  const cut = body2.search(/[/:]/);
  if (cut <= 0) return void 0;
  const prefix = (value.startsWith("/") ? "/" : "") + body2.slice(0, cut);
  return prefix.length >= FAMILY_MIN_PREFIX ? prefix : void 0;
}
var LITERAL_DUPLICATION_CAP, DEFAULTS, HOLDER_KINDS, MAX_HOLDER_SPAN, DISTINCTIVE_MIN_LEN, HAS_SEPARATOR, PATH_LIKE, FAMILY_MIN_MEMBERS, FAMILY_MIN_PREFIX, FUNCTION_RHS;
var init_literals2 = __esm({
  "src/literals.ts"() {
    "use strict";
    init_tests_map();
    init_sort();
    LITERAL_DUPLICATION_CAP = 24;
    DEFAULTS = { minFiles: 2, minCount: 3 };
    HOLDER_KINDS = /* @__PURE__ */ new Set(["const", "constant", "variable", "enum", "enumerator", "property", "field", "static"]);
    MAX_HOLDER_SPAN = 12;
    DISTINCTIVE_MIN_LEN = 6;
    HAS_SEPARATOR = /[/:._-]/;
    PATH_LIKE = /^[/@a-z0-9][\w./:@-]*$/i;
    FAMILY_MIN_MEMBERS = 2;
    FAMILY_MIN_PREFIX = 4;
    FUNCTION_RHS = /^\s*(?:async\b|function\b|\(|[A-Za-z_$][\w$]*\s*=>)/;
  }
});

// src/pipeline.ts
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
  const { duplications } = findLiteralDuplications(scan2);
  if (duplications.length) graph.literalDuplications = duplications.slice(0, LITERAL_DUPLICATION_CAP);
  const symbols = buildSymbolIndex(scan2, symbolRefsFor(scan2), opts.meta?.schemaVersion);
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
    init_literals2();
    init_symbols_json();
  }
});

// src/grep.ts
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

// src/embed/model.ts
import { createHash as createHash3 } from "crypto";
import { existsSync as existsSync6, readFileSync as readFileSync8 } from "fs";
import { join as join16 } from "path";
function resolveEmbedModelDir(repo) {
  const env = process.env.CODEINDEX_EMBED_DIR;
  const candidates = [];
  if (env) candidates.push(env);
  if (repo) candidates.push(join16(repo, ".codeindex", DEFAULT_EMBED_DIRNAME));
  candidates.push(join16(process.cwd(), ".codeindex", DEFAULT_EMBED_DIRNAME));
  for (const c2 of candidates) {
    if (existsSync6(join16(c2, "model.json"))) return c2;
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
  const path = join16(dir, "model.json");
  if (!existsSync6(path)) return void 0;
  const raw = JSON.parse(readFileSync8(path, "utf8"));
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
var EMBED_VERSION, DEFAULT_EMBED_DIRNAME, DEFAULT_EMBED_URL, EMBED_ASSET_SHA256;
var init_model = __esm({
  "src/embed/model.ts"() {
    "use strict";
    EMBED_VERSION = 1;
    DEFAULT_EMBED_DIRNAME = "models";
    DEFAULT_EMBED_URL = "https://github.com/maxgfr/codeindex/releases/download/embed-model-v1/model.json";
    EMBED_ASSET_SHA256 = "163ad053eab4e9a80d421ed4164f32292c83290f02fbbe6fe4b9b1cd6ea18d34";
  }
});

// src/embed/encode.ts
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

// src/embed/index.ts
function symbolText(rel2, name2, signature, summary) {
  return [name2, signature ?? "", summary ?? "", rel2.replace(/\//g, " ")].join("\n");
}
function fileText(rel2, title, summary, headings) {
  return [title ?? "", summary ?? "", ...headings, rel2.replace(/\//g, " ")].join("\n");
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

// src/embed/search.ts
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
var DEFAULT_LIMIT2, RRF_K;
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

// src/embed/endpoint.ts
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

// src/repomap.ts
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

// src/coupling.ts
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
        const key = `${unique[i2]}${SEP4}${unique[j]}`;
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }
    }
  }
  const out2 = [];
  for (const [key, together] of pairs) {
    if (together < minTogether) continue;
    const [a, b] = key.split(SEP4);
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
var SEP4;
var init_coupling = __esm({
  "src/coupling.ts"() {
    "use strict";
    init_util();
    init_sort();
    SEP4 = "\0";
  }
});

// src/onboard.ts
import { existsSync as existsSync7, readFileSync as readFileSync9 } from "fs";
import { join as join17, resolve as resolve2 } from "path";
function tagline(root) {
  for (const name2 of README_NAMES) {
    const path = join17(root, name2);
    if (!existsSync7(path)) continue;
    let text;
    try {
      text = readFileSync9(path, "utf8");
    } catch {
      continue;
    }
    for (const raw of text.split(/\n\s*\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || line.startsWith("<")) continue;
      if (/^(\[!\[|!\[|\[)/.test(line) && !/[.:]\s/.test(line)) continue;
      const cleaned = line.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
      if (cleaned.length > 20) return cleaned.slice(0, 400);
    }
    break;
  }
  return void 0;
}
function onboardBrief(scan2, graph, opts = {}) {
  const lines = [];
  const name2 = resolve2(scan2.root).replace(/\/+$/, "").split("/").pop() || "repository";
  lines.push(`# ${name2}`, "");
  const summary = tagline(scan2.root);
  if (summary) lines.push(summary, "");
  const languages = Object.entries(graph.languages).sort((a, b) => b[1] - a[1] || byStr(a[0], b[0])).slice(0, 6).map(([lang, count]) => `${lang} ${count}`).join(", ");
  lines.push(`**${graph.fileCount} indexed files** \xB7 ${languages}`, "");
  const workspaces = detectWorkspaces(scan2.root);
  if (workspaces.packages.length > 1) {
    lines.push(`## Layout \u2014 monorepo, ${workspaces.packages.length} packages`, "");
    for (const pkg of workspaces.packages.slice(0, 20)) lines.push(`- \`${pkg.dir}\` \u2014 ${pkg.name}`);
    if (workspaces.packages.length > 20) lines.push(`- \u2026and ${workspaces.packages.length - 20} more`);
    if (workspaces.cycle?.length) lines.push("", `\u26A0 dependency cycle: ${workspaces.cycle.join(" \u2192 ")}`);
    lines.push("");
  }
  lines.push("## Key files", "", renderRepoMap(scan2, graph, { budgetTokens: opts.budgetTokens ?? 900 }).trim(), "");
  const { churn, ok: churnOk } = gitChurn(scan2.root);
  if (churnOk && churn.size) {
    const hotspots = rankHotspots(scan2, churn, 8);
    if (hotspots.length) {
      lines.push("## Where work concentrates", "", "Files ranked by commits \xD7 size \u2014 where changes and defects cluster.", "");
      for (const spot of hotspots) lines.push(`- \`${spot.rel}\` \u2014 ${spot.commits} commits, ${spot.lines} lines`);
      lines.push("");
    }
  }
  lines.push(
    "## Next",
    "",
    "- `search <query>` \u2014 BM25 over names, paths, doc comments and prose; `explain_search` says whether it really matched",
    "- `find_symbol <Name>` / `symbols_overview <file>` \u2014 read structure without reading files",
    "- `find_references <Name>` \u2014 three labelled tiers; add `lsp: true` when a language server is configured",
    ""
  );
  const brief = lines.join("\n");
  if (opts.remember === false) return { brief };
  const memoryName = opts.memoryName ?? "onboarding";
  writeMemory(scan2.root, memoryName, brief);
  return { brief, memory: memoryName };
}
var README_NAMES;
var init_onboard = __esm({
  "src/onboard.ts"() {
    "use strict";
    init_repomap();
    init_workspaces();
    init_coupling();
    init_git();
    init_memory();
    init_sort();
    README_NAMES = ["README.md", "README.markdown", "README.rst", "README.txt", "README"];
  }
});

// src/lsp/protocol.ts
function encodeMessage(msg) {
  const body2 = JSON.stringify(msg);
  return `Content-Length: ${byteLength(body2)}${HEADER_END}${body2}`;
}
function byteLength(s) {
  return new TextEncoder().encode(s).byteLength;
}
function createFramer() {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = new Uint8Array(0);
  const append = (chunk) => {
    const next = new Uint8Array(buffer.length + chunk.length);
    next.set(buffer);
    next.set(chunk, buffer.length);
    buffer = next;
  };
  const headerEnd = () => {
    for (let i2 = 0; i2 + 3 < buffer.length; i2++) {
      if (buffer[i2] === 13 && buffer[i2 + 1] === 10 && buffer[i2 + 2] === 13 && buffer[i2 + 3] === 10) return i2;
    }
    return -1;
  };
  return {
    push(chunk) {
      append(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
      const out2 = [];
      for (; ; ) {
        const end = headerEnd();
        if (end < 0) return out2;
        const headers = decoder.decode(buffer.subarray(0, end));
        const match = /content-length:\s*(\d+)/i.exec(headers);
        if (!match) {
          buffer = buffer.subarray(end + 4);
          continue;
        }
        const length = Number(match[1]);
        if (!Number.isSafeInteger(length) || length < 0 || length > MAX_FRAME_BYTES) {
          buffer = buffer.subarray(end + 4);
          continue;
        }
        const start2 = end + 4;
        if (buffer.length < start2 + length) return out2;
        const body2 = decoder.decode(buffer.subarray(start2, start2 + length));
        buffer = buffer.subarray(start2 + length);
        try {
          out2.push(JSON.parse(body2));
        } catch {
        }
      }
    }
  };
}
function fileUri(root, rel2) {
  const abs = `${root.replace(/\/+$/, "")}/${rel2.replace(/^\/+/, "")}`;
  const drive = /^([A-Za-z]):/.exec(abs);
  const path = drive ? `/${abs}` : abs;
  return "file://" + path.split("/").map((segment, i2) => i2 === 0 ? segment : encodeURIComponent(segment)).join("/");
}
function relFromUri(root, uri) {
  if (!uri.startsWith("file://")) return void 0;
  let path = decodeURIComponent(uri.slice("file://".length));
  if (/^\/[A-Za-z]:/.test(path)) path = path.slice(1);
  const base = root.replace(/\/+$/, "");
  if (path === base) return "";
  if (!path.startsWith(`${base}/`)) return void 0;
  return path.slice(base.length + 1);
}
function locationsToRefs(root, raw) {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
  const seen = /* @__PURE__ */ new Set();
  const out2 = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const uri = item.uri ?? item.targetUri;
    if (!uri) continue;
    const file = relFromUri(root, uri);
    if (file === void 0 || file === "") continue;
    const start2 = (item.range ?? item.targetSelectionRange ?? item.targetRange)?.start;
    const line = typeof start2?.line === "number" ? start2.line + 1 : 1;
    const character = typeof start2?.character === "number" ? start2.character : void 0;
    const key = `${file}:${line}:${character ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out2.push(character === void 0 ? { file, line } : { file, line, character });
  }
  return out2.sort((a, b) => byStr(a.file, b.file) || a.line - b.line || (a.character ?? 0) - (b.character ?? 0));
}
var MAX_FRAME_BYTES, HEADER_END;
var init_protocol = __esm({
  "src/lsp/protocol.ts"() {
    "use strict";
    init_sort();
    MAX_FRAME_BYTES = 32 * 1024 * 1024;
    HEADER_END = "\r\n\r\n";
  }
});

// src/lsp/client.ts
async function openLspSession(transport, options) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT;
  const framer = createFramer();
  const pending = /* @__PURE__ */ new Map();
  const open = /* @__PURE__ */ new Set();
  let nextId = 1;
  let dead;
  const failAll = (error) => {
    dead = error;
    for (const [, p] of pending) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    pending.clear();
  };
  transport.onData((chunk) => {
    for (const message of framer.push(chunk)) {
      if (typeof message.id !== "number") continue;
      const waiter = pending.get(message.id);
      if (!waiter) continue;
      pending.delete(message.id);
      clearTimeout(waiter.timer);
      if (message.error) waiter.reject(new Error(`${message.error.message} (code ${message.error.code})`));
      else waiter.resolve(message.result);
    }
  });
  transport.onExit((code) => failAll(new Error(`language server exited (code ${code ?? "unknown"})`)));
  const notify = (method, params) => {
    if (dead) return;
    transport.write(encodeMessage({ jsonrpc: "2.0", method, params }));
  };
  const request = (method, params, budget = timeoutMs) => {
    if (dead) return Promise.reject(dead);
    const id = nextId++;
    return new Promise((resolve5, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new LspTimeout(method, budget));
      }, budget);
      timer.unref?.();
      pending.set(id, { resolve: resolve5, reject, timer });
      transport.write(encodeMessage({ jsonrpc: "2.0", id, method, params }));
    });
  };
  const initResult = await request(
    "initialize",
    {
      processId: null,
      rootUri: fileUri(options.root, ""),
      workspaceFolders: [{ uri: fileUri(options.root, ""), name: "repo" }],
      capabilities: {
        textDocument: {
          references: { dynamicRegistration: false },
          definition: { dynamicRegistration: false, linkSupport: true },
          implementation: { dynamicRegistration: false, linkSupport: true }
        }
      },
      ...options.initializationOptions !== void 0 ? { initializationOptions: options.initializationOptions } : {}
    },
    startupTimeoutMs
  );
  notify("initialized", {});
  const provides = (key) => {
    const value = initResult?.capabilities?.[key];
    return value === true || typeof value === "object" && value !== null;
  };
  const capabilities = {
    references: provides("referencesProvider"),
    definition: provides("definitionProvider"),
    implementation: provides("implementationProvider"),
    typeHierarchy: provides("typeHierarchyProvider")
  };
  const positionOf = (rel2, line, character) => ({
    textDocument: { uri: fileUri(options.root, rel2) },
    // The engine counts lines from 1; LSP counts from 0.
    position: { line: Math.max(0, line - 1), character }
  });
  return {
    capabilities,
    didOpen(rel2, text, languageId) {
      if (open.has(rel2)) return;
      open.add(rel2);
      notify("textDocument/didOpen", {
        textDocument: { uri: fileUri(options.root, rel2), languageId, version: 1, text }
      });
    },
    async references(rel2, line, character) {
      if (!capabilities.references) return [];
      const raw = await request("textDocument/references", {
        ...positionOf(rel2, line, character),
        context: { includeDeclaration: true }
      });
      return locationsToRefs(options.root, raw);
    },
    async definition(rel2, line, character) {
      if (!capabilities.definition) return [];
      return locationsToRefs(options.root, await request("textDocument/definition", positionOf(rel2, line, character)));
    },
    async shutdown() {
      try {
        for (const rel2 of open) notify("textDocument/didClose", { textDocument: { uri: fileUri(options.root, rel2) } });
        open.clear();
        await request("shutdown", null, Math.min(timeoutMs, 2e3));
        notify("exit", void 0);
      } catch {
      } finally {
        failAll(new Error("session closed"));
        transport.close();
      }
    }
  };
}
var LspTimeout, DEFAULT_TIMEOUT, DEFAULT_STARTUP_TIMEOUT;
var init_client = __esm({
  "src/lsp/client.ts"() {
    "use strict";
    init_protocol();
    LspTimeout = class extends Error {
      constructor(method, ms) {
        super(`${method} exceeded ${ms}ms`);
        this.name = "LspTimeout";
      }
    };
    DEFAULT_TIMEOUT = 5e3;
    DEFAULT_STARTUP_TIMEOUT = 15e3;
  }
});

// src/lsp/config.ts
import { existsSync as existsSync8, readFileSync as readFileSync10 } from "fs";
import { join as join18, resolve as resolve3 } from "path";
function resolveLspConfigPath(repo) {
  const env = process.env.CODEINDEX_LSP_CONFIG;
  if (env !== void 0) {
    const trimmed = env.trim();
    if (!trimmed || trimmed === "0" || trimmed.toLowerCase() === "off") return { path: void 0, source: "none" };
    return { path: resolve3(trimmed), source: "env" };
  }
  const inRepo = join18(repo, LSP_CONFIG_DIR, LSP_CONFIG_NAME);
  if (existsSync8(inRepo)) return { path: inRepo, source: "repo" };
  const inCwd = join18(process.cwd(), LSP_CONFIG_DIR, LSP_CONFIG_NAME);
  if (inCwd !== inRepo && existsSync8(inCwd)) return { path: inCwd, source: "cwd" };
  return { path: void 0, source: "none" };
}
function parseLspConfig(payload) {
  if (!payload || typeof payload !== "object") throw new Error("lsp.json must be a JSON object");
  const raw = payload;
  if (raw.version !== 1) throw new Error(`lsp.json: unsupported version ${JSON.stringify(raw.version)} (expected 1)`);
  if (!Array.isArray(raw.servers)) throw new Error("lsp.json: `servers` must be an array");
  const ids = /* @__PURE__ */ new Set();
  const servers = raw.servers.map((entry, i2) => {
    if (!entry || typeof entry !== "object") throw new Error(`lsp.json: servers[${i2}] must be an object`);
    const s = entry;
    const id = typeof s.id === "string" && s.id.trim() ? s.id.trim() : void 0;
    if (!id) throw new Error(`lsp.json: servers[${i2}].id must be a non-empty string`);
    if (ids.has(id)) throw new Error(`lsp.json: duplicate server id ${JSON.stringify(id)}`);
    ids.add(id);
    if (typeof s.command !== "string" || !s.command.trim()) throw new Error(`lsp.json: servers[${i2}].command must be a non-empty string`);
    if (!Array.isArray(s.languages) || !s.languages.length || s.languages.some((l) => typeof l !== "string")) {
      throw new Error(`lsp.json: servers[${i2}].languages must be a non-empty array of strings`);
    }
    if (s.args !== void 0 && (!Array.isArray(s.args) || s.args.some((a) => typeof a !== "string"))) {
      throw new Error(`lsp.json: servers[${i2}].args must be an array of strings`);
    }
    return {
      id,
      languages: s.languages,
      ...typeof s.languageId === "string" ? { languageId: s.languageId } : {},
      command: s.command,
      ...Array.isArray(s.args) ? { args: s.args } : {},
      ...s.env && typeof s.env === "object" ? { env: s.env } : {},
      ...s.initializationOptions !== void 0 ? { initializationOptions: s.initializationOptions } : {},
      ...typeof s.timeoutMs === "number" ? { timeoutMs: s.timeoutMs } : {},
      ...typeof s.startupTimeoutMs === "number" ? { startupTimeoutMs: s.startupTimeoutMs } : {}
    };
  });
  return { version: 1, servers };
}
function loadLspConfig(repo) {
  const { path } = resolveLspConfigPath(repo);
  if (!path || !existsSync8(path)) return void 0;
  let payload;
  try {
    payload = JSON.parse(readFileSync10(path, "utf8"));
  } catch (e) {
    throw new Error(`${path}: ${e instanceof Error ? e.message : String(e)}`);
  }
  return parseLspConfig(payload);
}
function serverForLang(config, lang) {
  return config.servers.find((s) => s.languages.includes(lang));
}
function timeoutFor(server) {
  return positiveEnv("CODEINDEX_LSP_TIMEOUT_MS") ?? server.timeoutMs ?? DEFAULT_TIMEOUT_MS;
}
function startupTimeoutFor(server) {
  return positiveEnv("CODEINDEX_LSP_STARTUP_TIMEOUT_MS") ?? server.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;
}
function positiveEnv(name2) {
  const raw = process.env[name2];
  if (raw === void 0) return void 0;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : void 0;
}
var LSP_CONFIG_NAME, LSP_CONFIG_DIR, DEFAULT_TIMEOUT_MS, DEFAULT_STARTUP_TIMEOUT_MS;
var init_config2 = __esm({
  "src/lsp/config.ts"() {
    "use strict";
    LSP_CONFIG_NAME = "lsp.json";
    LSP_CONFIG_DIR = ".codeindex";
    DEFAULT_TIMEOUT_MS = 5e3;
    DEFAULT_STARTUP_TIMEOUT_MS = 15e3;
  }
});

// src/lsp/refs.ts
import { readFileSync as readFileSync11 } from "fs";
import { join as join19 } from "path";
function lspUnavailable(server, reason) {
  return { server, ok: false, reason, refs: [], agreement: { both: [], lspOnly: [], staticOnly: [] } };
}
function columnOfSymbol(root, rel2, line, name2) {
  try {
    const lines = readFileSync11(join19(root, rel2), "utf8").split(/\r?\n/);
    const index = lines[line - 1]?.indexOf(name2) ?? -1;
    return index < 0 ? 0 : index;
  } catch {
    return 0;
  }
}
function agreementOf(refs, statik) {
  const lspFiles = new Set(refs.map((r) => r.file));
  const staticFiles = /* @__PURE__ */ new Set([
    ...statik.callSites.map((c2) => c2.file),
    ...statik.referencingFiles,
    // Declaration sites are references in the LSP sense (includeDeclaration),
    // so counting them keeps the two sides comparing the same population.
    ...statik.defs.map((d) => d.file)
  ]);
  const both = [];
  const lspOnly = [];
  const staticOnly = [];
  for (const file of lspFiles) (staticFiles.has(file) ? both : lspOnly).push(file);
  for (const file of staticFiles) if (!lspFiles.has(file)) staticOnly.push(file);
  return { both: both.sort(byStr), lspOnly: lspOnly.sort(byStr), staticOnly: staticOnly.sort(byStr) };
}
async function annotateWithLsp(scan2, name2, statik, session, serverId, languageId) {
  if (!session.capabilities.references) {
    return { ...statik, lsp: lspUnavailable(serverId, "server does not provide textDocument/references") };
  }
  if (!statik.defs.length) {
    return { ...statik, lsp: lspUnavailable(serverId, `no declaration of ${name2} to anchor a request on`) };
  }
  const seen = /* @__PURE__ */ new Set();
  const refs = [];
  try {
    for (const def of statik.defs) {
      const text = readTextOrEmpty(scan2.root, def.file);
      if (!text) continue;
      session.didOpen(def.file, text, languageId);
      const character = columnOfSymbol(scan2.root, def.file, def.line, name2);
      for (const ref of await session.references(def.file, def.line, character)) {
        const key = `${ref.file}:${ref.line}:${ref.character ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        refs.push(ref);
      }
    }
  } catch (e) {
    return {
      ...statik,
      lsp: {
        server: serverId,
        ok: false,
        reason: e instanceof Error ? e.message : String(e),
        refs: refs.sort(refOrder),
        agreement: agreementOf(refs, statik)
      }
    };
  }
  refs.sort(refOrder);
  return { ...statik, lsp: { server: serverId, ok: true, refs, agreement: agreementOf(refs, statik) } };
}
function refOrder(a, b) {
  return byStr(a.file, b.file) || a.line - b.line || (a.character ?? 0) - (b.character ?? 0);
}
function readTextOrEmpty(root, rel2) {
  try {
    return readFileSync11(join19(root, rel2), "utf8");
  } catch {
    return "";
  }
}
var init_refs = __esm({
  "src/lsp/refs.ts"() {
    "use strict";
    init_sort();
  }
});

// src/lsp/spawn.ts
import { spawn } from "child_process";
function spawnLspTransport(server, cwd) {
  let child;
  try {
    child = spawn(server.command, server.args ?? [], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      ...server.env ? { env: { ...process.env, ...server.env } } : {}
    });
  } catch {
    return void 0;
  }
  let exited = false;
  const dataListeners = [];
  const exitListeners = [];
  const fireExit = (code) => {
    if (exited) return;
    exited = true;
    for (const listener of exitListeners) listener(code);
  };
  child.on("error", () => fireExit(null));
  child.on("close", (code) => fireExit(code));
  child.stdout?.on("data", (chunk) => {
    for (const listener of dataListeners) listener(chunk);
  });
  child.stderr?.on("data", () => {
  });
  return {
    write(chunk) {
      if (exited) return;
      try {
        child.stdin?.write(chunk);
      } catch {
        fireExit(null);
      }
    },
    onData(cb) {
      dataListeners.push(cb);
    },
    onExit(cb) {
      if (exited) cb(null);
      else exitListeners.push(cb);
    },
    close() {
      try {
        child.stdin?.end();
      } catch {
      }
      const timer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
        }
      }, 2e3);
      timer.unref?.();
      child.on("close", () => clearTimeout(timer));
    }
  };
}
var init_spawn = __esm({
  "src/lsp/spawn.ts"() {
    "use strict";
  }
});

// src/lsp/index.ts
async function lspStatus(scan2, repo, probe = false) {
  const { path, source } = resolveLspConfigPath(repo);
  const config = loadLspConfig(repo);
  if (!config) return { lspVersion: 1, mode: "none", configPath: path ?? null, source, servers: [], unmappedLanguages: [] };
  const counts = /* @__PURE__ */ new Map();
  for (const file of scan2.files) counts.set(file.lang, (counts.get(file.lang) ?? 0) + 1);
  const servers = [];
  for (const server of config.servers) {
    const status = {
      id: server.id,
      languages: server.languages,
      command: server.command,
      onPath: have(server.command),
      filesInRepo: server.languages.reduce((sum, lang) => sum + (counts.get(lang) ?? 0), 0)
    };
    if (probe) {
      const session = await tryOpen(server, scan2.root);
      if (session.ok) {
        status.reachable = true;
        status.capabilities = session.session.capabilities;
        await session.session.shutdown();
      } else {
        status.reachable = false;
        status.error = session.reason;
      }
    }
    servers.push(status);
  }
  const claimed = new Set(config.servers.flatMap((s) => s.languages));
  const unmappedLanguages = [...counts.keys()].filter((lang) => !claimed.has(lang) && lang !== "other").sort();
  return { lspVersion: 1, mode: "configured", configPath: path ?? null, source, servers, unmappedLanguages };
}
async function tryOpen(server, root) {
  if (!have(server.command)) return { ok: false, reason: `${server.command} is not on PATH` };
  const transport = spawnLspTransport(server, root);
  if (!transport) return { ok: false, reason: `could not start ${server.command}` };
  try {
    const session = await openLspSession(transport, {
      root,
      timeoutMs: timeoutFor(server),
      startupTimeoutMs: startupTimeoutFor(server),
      ...server.initializationOptions !== void 0 ? { initializationOptions: server.initializationOptions } : {}
    });
    return { ok: true, session };
  } catch (e) {
    transport.close();
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
async function referencesWithLsp(scan2, repo, name2, statik) {
  let config;
  try {
    config = loadLspConfig(repo);
  } catch (e) {
    return { ...statik, lsp: lspUnavailable("(config)", e instanceof Error ? e.message : String(e)) };
  }
  if (!config) return statik;
  const lang = statik.defs[0]?.lang;
  if (!lang) return { ...statik, lsp: lspUnavailable("(none)", `no declaration of ${name2} to anchor a request on`) };
  const server = serverForLang(config, lang);
  if (!server) return { ...statik, lsp: lspUnavailable("(none)", `no server configured for ${lang}`) };
  const opened = await tryOpen(server, scan2.root);
  if (!opened.ok) return { ...statik, lsp: lspUnavailable(server.id, opened.reason) };
  try {
    return await annotateWithLsp(scan2, name2, statik, opened.session, server.id, server.languageId ?? server.languages[0]);
  } finally {
    await opened.session.shutdown();
  }
}
var init_lsp = __esm({
  "src/lsp/index.ts"() {
    "use strict";
    init_util();
    init_client();
    init_config2();
    init_refs();
    init_spawn();
  }
});

// src/rules.ts
function isEntrypointLike(rel2) {
  const base = rel2.split("/").pop();
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
        throw new Error(`${at} (${r.name}): \`builtin\` must be "cycles", "orphans" or "literals"`);
      return {
        name: r.name,
        builtin: r.builtin,
        severity: r.severity,
        comment: r.comment,
        ...r.tiers !== void 0 ? { tiers: r.tiers } : {}
      };
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
      } else if (rule.builtin === "literals") {
        const wanted = new Set(rule.tiers?.length ? rule.tiers : GATED_TIERS);
        for (const d of graph.literalDuplications ?? []) {
          if (!wanted.has(d.tier)) continue;
          const origin = d.holders[0] ?? d.literals[0];
          emit2(rule, {
            from: `${origin.file}:${origin.line}`,
            to: `${d.tier} ${JSON.stringify(d.value)} (${d.count} sites, ${d.files} files)`,
            kind: "literal"
          });
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
var EDGE_KINDS, SEVERITIES, BUILTINS, GATED_TIERS, ENTRYPOINT_STEMS;
var init_rules = __esm({
  "src/rules.ts"() {
    "use strict";
    init_glob();
    init_sort();
    EDGE_KINDS = /* @__PURE__ */ new Set(["contains", "doc-link", "import", "call", "use", "mention"]);
    SEVERITIES = /* @__PURE__ */ new Set(["error", "warn"]);
    BUILTINS = /* @__PURE__ */ new Set(["cycles", "orphans", "literals"]);
    GATED_TIERS = ["competing", "bypassed"];
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

// src/deadcode.ts
function findDeadCode(scan2) {
  const callers = callerIndexFor(scan2);
  const refs = symbolRefsFor(scan2);
  const out2 = [];
  const consider = (s) => s.exported && !REFERENCE_KINDS7.has(s.kind) && !isTestPath(s.file) && !ENTRYPOINT_RE.test(s.file);
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
var REFERENCE_KINDS7, ENTRYPOINT_RE;
var init_deadcode = __esm({
  "src/deadcode.ts"() {
    "use strict";
    init_derived();
    init_tests_map();
    init_sort();
    REFERENCE_KINDS7 = /* @__PURE__ */ new Set(["reexport", "reexport-all", "default"]);
    ENTRYPOINT_RE = /(^|\/)(index|main|cli|app|server|engine)\.[a-z]+$/;
  }
});

// src/viz.ts
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
function clusterNodeId(slug) {
  return "m_" + slug.replace(/[^A-Za-z0-9_]/g, "_");
}
function renderMermaidClustered(graph, opts = {}) {
  const maxModules = opts.maxModules ?? CLUSTER_MAX_MODULES;
  const maxEdges = opts.maxEdges ?? CLUSTER_MAX_EDGES;
  const ranked = graph.modules.slice().sort((a, b) => degreeOf(b) - degreeOf(a) || byStr(a.slug, b.slug));
  const shown = ranked.slice(0, maxModules);
  const shownSet = new Set(shown.map((m) => m.slug));
  const edges = graph.moduleEdges.filter((e) => shownSet.has(e.from) && shownSet.has(e.to)).sort((a, b) => b.weight - a.weight || byStr(a.from, b.from) || byStr(a.to, b.to)).slice(0, maxEdges);
  const lines = [];
  lines.push(
    `%% ${opts.title ?? "module graph"} \u2014 ${shown.length} of ${graph.modules.length} modules, ${edges.length} of ${graph.moduleEdges.length} edges`
  );
  if (shown.length < graph.modules.length || edges.length < graph.moduleEdges.length) {
    lines.push("%% truncated to the most-connected modules/edges; see graph.json for the full graph");
  }
  lines.push("flowchart LR");
  for (const tier of [0, 1, 2]) {
    const inTier = shown.filter((m) => m.tier === tier);
    if (!inTier.length) continue;
    lines.push(`  subgraph ${TIER_LABEL[tier]}`);
    for (const m of inTier) lines.push(`    ${clusterNodeId(m.slug)}["${m.path.replace(/"/g, "'")}"]`);
    lines.push("  end");
  }
  for (const e of edges) {
    const label = e.weight > 1 ? `|${e.weight}| ` : "";
    lines.push(`  ${clusterNodeId(e.from)} -->${label ? " " + label : " "}${clusterNodeId(e.to)}`);
  }
  return {
    content: "```mermaid\n" + lines.join("\n") + "\n```\n",
    shownModules: shown.length,
    totalModules: graph.modules.length,
    shownEdges: edges.length,
    totalEdges: graph.moduleEdges.length
  };
}
var sanitizeId, TIER_LABEL, CLUSTER_MAX_MODULES, CLUSTER_MAX_EDGES, degreeOf;
var init_viz = __esm({
  "src/viz.ts"() {
    "use strict";
    init_sort();
    sanitizeId = (slug) => slug.replace(/[^\w]/g, "_");
    TIER_LABEL = { 0: "Foundations", 1: "Features", 2: "Tail" };
    CLUSTER_MAX_MODULES = 40;
    CLUSTER_MAX_EDGES = 80;
    degreeOf = (m) => m.degIn + m.degOut;
  }
});

// src/mcp/protocol.ts
import { existsSync as existsSync9 } from "fs";
import { join as join20 } from "path";
import { pathToFileURL as pathToFileURL2 } from "url";
function validateArgs(schema, args2) {
  const props = schema.properties ?? {};
  for (const [key, value] of Object.entries(args2)) {
    if (value === void 0 || value === null) continue;
    const spec = props[key];
    if (!spec?.type) continue;
    const actual = Array.isArray(value) ? "array" : typeof value;
    if (spec.type === "number") {
      if (actual === "number") continue;
      if (actual === "string" && Number.isFinite(Number(value)) && value.trim() !== "") continue;
      return `\`${key}\` must be a number, got ${actual === "string" ? JSON.stringify(value) : actual}`;
    }
    if (spec.type === "array") {
      if (actual !== "array") return `\`${key}\` must be an array of strings, got ${actual}`;
      if (spec.items?.type === "string" && !value.every((x) => typeof x === "string")) {
        return `\`${key}\` must be an array of strings`;
      }
      continue;
    }
    if (actual !== spec.type) return `\`${key}\` must be a ${spec.type}, got ${actual}`;
  }
  return void 0;
}
function structuredContentFor(text, capped, hasSchema) {
  if (capped || !hasSchema) return void 0;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return void 0;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return void 0;
  return parsed;
}
function negotiateProtocol(requested) {
  return typeof requested === "string" && PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL;
}
function capResponse(text, tool, repo, maxBytes) {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes <= maxBytes) return text;
  const artifact = ARTIFACT_FOR[tool] ? join20(repo, INDEX_DIR, ARTIFACT_FOR[tool]) : void 0;
  return JSON.stringify(
    {
      truncated: true,
      tool,
      bytes,
      maxBytes,
      reason: "This response exceeds the configured limit and was withheld rather than sent as an unusable partial payload.",
      narrower: NARROWER[tool] ?? "narrow the request with `scope`, `include`/`exclude`, or a `limit`",
      ...artifact && existsSync9(artifact) ? { artifact, artifactNote: "The full result is already on disk here \u2014 read it directly if you need all of it." } : artifact ? { artifactNote: `Run \`codeindex index --repo ${repo} --out ${join20(repo, INDEX_DIR)}\` to get this as a file.` } : {}
    },
    null,
    2
  ) + "\n";
}
function resourceLinkFor(text, tool) {
  const artifactName = ARTIFACT_FOR[tool];
  if (!artifactName) return void 0;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return void 0;
  }
  if (parsed.truncated !== true || typeof parsed.artifact !== "string") return void 0;
  return {
    type: "resource_link",
    uri: pathToFileURL2(parsed.artifact).href,
    name: artifactName,
    description: `The full ${tool} result this call was too large to inline.`,
    mimeType: "application/json"
  };
}
var PROTOCOL_VERSIONS, LATEST_PROTOCOL, ANNOTATIONS_SINCE, RICH_TOOLS_SINCE, DEFAULT_MAX_RESPONSE_BYTES, NARROWER, ARTIFACT_FOR;
var init_protocol2 = __esm({
  "src/mcp/protocol.ts"() {
    "use strict";
    init_preload();
    PROTOCOL_VERSIONS = ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"];
    LATEST_PROTOCOL = PROTOCOL_VERSIONS[PROTOCOL_VERSIONS.length - 1];
    ANNOTATIONS_SINCE = "2025-03-26";
    RICH_TOOLS_SINCE = "2025-06-18";
    DEFAULT_MAX_RESPONSE_BYTES = 1e6;
    NARROWER = {
      graph: "pass `scope` to a subdirectory, or use repo_map / mermaid for an overview",
      symbols: "pass `name` to look up one symbol, or use find_symbol / symbols_overview",
      callers: "pass `name` to look up one symbol's call sites",
      dead_code: "pass `scope` to a subdirectory",
      find_references: "the symbol is referenced very widely \u2014 narrow with `scope` on a graph query",
      check_rules: "narrow the rule set, or pass `scope` to a subdirectory"
    };
    ARTIFACT_FOR = { graph: "graph.json", symbols: "symbols.json" };
  }
});

// src/mcp/tools.ts
function annotationsFor(name2) {
  const meta = TOOL_META[name2];
  if (!meta) return void 0;
  return {
    readOnlyHint: !meta.write,
    ...meta.write ? { destructiveHint: meta.destructive === true, idempotentHint: meta.idempotent === true } : {},
    openWorldHint: meta.openWorld === true
  };
}
function profileNames() {
  return ["all", ...Object.keys(TOOL_PROFILES).sort()];
}
function toolsInProfiles(spec) {
  const names = spec.split(",").map((s) => s.trim()).filter(Boolean);
  const out2 = /* @__PURE__ */ new Set();
  for (const name2 of names) {
    if (name2 === "all") return new Set(TOOLS.map((t) => t.name));
    const profile = TOOL_PROFILES[name2];
    if (!profile) throw new Error(`unknown tool profile "${name2}" \u2014 one of: ${profileNames().join(", ")}`);
    for (const tool of profile) out2.add(tool);
  }
  return out2;
}
function toolsFor(defaultRepo, protocolVersion = PROTOCOL_VERSIONS[0], profile) {
  const withAnnotations = protocolVersion >= ANNOTATIONS_SINCE;
  const withRich = protocolVersion >= RICH_TOOLS_SINCE;
  const allowed = profile ? toolsInProfiles(profile) : void 0;
  const TOOLS_ = allowed ? TOOLS.filter((t) => allowed.has(t.name)) : TOOLS;
  if (!defaultRepo && !withAnnotations && !withRich) return TOOLS_;
  return TOOLS_.map((t) => ({
    ...t,
    ...withRich && TOOL_META[t.name] ? { title: TOOL_META[t.name].title } : {},
    ...withRich && OUTPUT_SCHEMAS[t.name] ? { outputSchema: OUTPUT_SCHEMAS[t.name] } : {},
    ...withAnnotations ? { annotations: annotationsFor(t.name) } : {},
    inputSchema: !defaultRepo ? t.inputSchema : {
      ...t.inputSchema,
      properties: {
        ...t.inputSchema.properties,
        repo: {
          type: "string",
          description: `Absolute path to the repository root (optional \u2014 defaults to ${defaultRepo})`
        }
      },
      required: t.inputSchema.required.filter((r) => r !== "repo")
    }
  }));
}
var repoProp, scopeProps, TOOLS, strArr, anyObj, OUTPUT_SCHEMAS, TOOL_META, TOOL_PROFILES;
var init_tools = __esm({
  "src/mcp/tools.ts"() {
    "use strict";
    init_protocol2();
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
          properties: {
            ...repoProp,
            name: { type: "string", description: "Symbol name to look up" },
            recall: {
              type: "boolean",
              description: "Recall-oriented binding: relax the JS/TS import gate to unique repo-wide names, labelling each site corroborated|unique-name (default false = precision)"
            }
          },
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
        description: `Find symbol declarations by name or name path ('Class/method' matches a method inside Class). Each match carries its COMPLETE SIGNATURE (parameters and return type) by default, because "what shape is it" is the question that follows "where is it" almost every time and one round trip beats two. Options: substring matching, includeBody for the declaration's source, concise to drop everything but name/kind/file/line when you genuinely only want a location. Exact-name matches rank first.`,
        inputSchema: {
          type: "object",
          properties: {
            ...repoProp,
            namePath: { type: "string", description: "Symbol name or Parent/child path" },
            substring: { type: "boolean" },
            includeBody: { type: "boolean" },
            concise: {
              type: "boolean",
              description: "Return only name/kind/file/line \u2014 drop the signature, line span, visibility and language. Roughly 2.5x smaller; use it when you are resolving a path and nothing more (default false)."
            },
            maxResults: { type: "number", description: "Cap matches (default 50)" }
          },
          required: ["repo", "namePath"]
        }
      },
      {
        name: "find_references",
        description: "Who references a symbol? Three labeled tiers: defs (declarations), callSites (line-precise, import-corroborated call bindings), referencingFiles (file-level identifier/doc mentions \u2014 may include homonyms). Confidence decreases across tiers; the labels let you decide what to trust.",
        inputSchema: {
          type: "object",
          properties: {
            ...repoProp,
            name: { type: "string", description: "Symbol name" },
            lsp: {
              type: "boolean",
              description: "Also ask a configured language server (see lsp_status) and append an `lsp` block: its references plus an `agreement` matrix (both / lspOnly / staticOnly). The three static tiers are unchanged either way. `staticOnly` is where the homonyms are. No config, no binary, a crash or a timeout all degrade to the static answer with a stated reason (default false)."
            }
          },
          required: ["repo", "name"]
        }
      },
      {
        name: "lsp_status",
        description: "Is the optional LSP tier configured, and would it answer? Reports the config path and its source, each server with whether its command is on PATH and how many files in this repo it claims, and the languages no server covers. Opt-in by asset: the tier is active only when <repo>/.codeindex/lsp.json exists (or CODEINDEX_LSP_CONFIG points at one). `probe: true` additionally starts each server to read the capabilities it really advertises. The tier never touches graph.json/symbols.json \u2014 it annotates query answers only.",
        inputSchema: {
          type: "object",
          properties: {
            ...repoProp,
            probe: { type: "boolean", description: "Start each server and read its real capabilities (default false: no spawn)" }
          },
          required: ["repo"]
        }
      },
      {
        name: "onboard",
        description: "One call that says what this repository IS: its own tagline, size and language mix, monorepo layout when there is one, a token-budgeted map of the highest-PageRank files with their key signatures, and where git says work concentrates. Composes scan_summary + workspaces + repo_map + hotspots so the first four round trips of a session become one, and persists the result as the `onboarding` memory (read_memory) so the next session does not repeat them. Set remember:false to skip the write.",
        inputSchema: {
          type: "object",
          properties: {
            ...repoProp,
            budgetTokens: { type: "number", description: "Token budget for the key-files section (default 900)" },
            remember: { type: "boolean", description: "Persist the brief as the `onboarding` memory (default true)" }
          },
          required: ["repo"]
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
        description: "Dead-code candidates in two labeled tiers: 'unreferenced' (no call site binds AND nothing references the name) and 'uncalled' (referenced somewhere \u2014 re-export, type position \u2014 but never called). Exported symbols only; test files and entrypoint-looking files excluded as roots. On a large repo this list runs to thousands of entries \u2014 pass `limit`, or `scope` to one subdirectory.",
        inputSchema: {
          type: "object",
          properties: {
            ...repoProp,
            ...scopeProps,
            limit: { type: "number", description: "Cap entries (default: all)" }
          },
          required: ["repo"]
        }
      },
      {
        name: "duplicated_literals",
        description: "Values with no single source of truth: one literal written out across many files. Three labeled tiers \u2014 'competing' (two or more exported constants hold the same value), 'bypassed' (a constant holds it and other files rewrite it anyway), 'uncentralized' (nothing holds it). Path-like values are also grouped into namespace families, so a whole route space reports once instead of once per route. Covers config files (JSON/YAML/TOML) as well as code, which is where the dangerous cases live: a threshold declared in TypeScript and again in a rules JSON is checked by no compiler. Use it to answer 'what breaks if this value changes' and 'is there already a helper for this'.",
        inputSchema: {
          type: "object",
          properties: {
            ...repoProp,
            ...scopeProps,
            minFiles: { type: "number", description: "Distinct files a value must span (default 2)" },
            minCount: { type: "number", description: "Total occurrences required (default 3)" },
            includeTests: { type: "boolean", description: "Count test files too (default false)" },
            limit: { type: "number", description: "Cap duplications (default: all)" }
          },
          required: ["repo"]
        }
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
            scope: { type: "string", description: "Restrict to one directory (repo-relative)" },
            globs: { type: "array", items: { type: "string" }, description: "Restrict to matching paths" },
            ignoreCase: { type: "boolean" },
            maxHits: { type: "number" }
          },
          required: ["repo", "pattern"]
        }
      },
      {
        name: "search",
        description: 'Natural-language-ish lexical search: BM25F ranking over SIX weighted fields \u2014 symbol names (camelCase/snake_case subtokens), path segments, markdown headings, the file summary, per-symbol DOC COMMENTS, and the prose body (comment + short-literal words). The last two are why "where is rate limiting handled" works: the phrase lives in a comment, not in a name. Results carry `matchedFields`, a `line` anchor and `symbolHits` (name/kind/line). NOT embeddings by default \u2014 deterministic, diacritic-folded, zero API keys. Answers "where is auth handled?"-style queries with ranked files, matched terms and top symbols. Query terms with zero document frequency get a deterministic trigram-fuzzy fallback (typo-tolerant) unless `fuzzy: false`. Set `semantic: true` to RRF-fuse an embedding tier (HTTP endpoint, else a local static model) with lexical \u2014 the response then wraps the ranked list as `{ results, tier, degradedReason? }`, `tier` being "endpoint"/"static" when fusion happened or "lexical" (with `degradedReason`) when it did not (see embed_status). Without `semantic`, the response is the bare ranked array, unchanged.',
        inputSchema: {
          type: "object",
          properties: {
            ...repoProp,
            ...scopeProps,
            query: { type: "string", description: "Natural-language or identifier query" },
            limit: { type: "number", description: "Max results (default 20)" },
            fuzzy: {
              type: "boolean",
              description: 'Fallback for query terms with zero document frequency: a morphological stem match first ("caching" finds "cache"), then trigram similarity for typos (default true)'
            },
            rank: {
              type: "string",
              description: `Structural prior: "graph" multiplies the lexical score by the file's PageRank over the resolved import graph; "lexical" (default) scores on text alone. Unproven on the judged corpus \u2014 see SearchOptions.rank.`
            },
            exact: {
              type: "boolean",
              description: "Drop results that carry no verbatim query-term match \u2014 the ones the stem/trigram bridge produced (default false)."
            },
            explain: {
              type: "boolean",
              description: "Wrap the response as `{ results, explain }` with the query verdict (default false = bare array). See explain_search."
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
        name: "explain_search",
        description: 'Search, and say whether the query actually found anything. Returns `{ results, explain }` where explain.verdict is "match" (a verbatim term matched), "weak" (results exist but rest on a near match, or the identifier you asked for has document frequency 0) or "none". Use this instead of `search` whenever an empty-feeling or surprising result matters: a query for an identifier that is NOT in the indexed tree still returns confident-looking rows built from its subtokens \u2014 searching "nullGipStep7" in a repo that only has "nullGipStep2" ranks files matching "null" and "gip" \u2014 and only the verdict distinguishes that from a real hit. Also names the terms dropped as stopwords, the terms that exist nowhere, and what each near match bridged to.',
        inputSchema: {
          type: "object",
          properties: {
            ...repoProp,
            ...scopeProps,
            query: { type: "string", description: "Natural-language or identifier query" },
            limit: { type: "number", description: "Max results (default 20)" },
            fuzzy: { type: "boolean", description: "Stem/trigram fallback for zero-document-frequency terms (default true)" },
            exact: { type: "boolean", description: "Drop results carrying no verbatim term match (default false)" }
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
        name: "type_hierarchy",
        description: "How do types relate? For one type: the base classes it extends, the interfaces/traits it implements, and \u2014 the reverse direction, which no other tool answers \u2014 what extends or implements IT, plus any declared supertype with no definition in this repo. Omit `name` for the whole hierarchy.",
        inputSchema: {
          type: "object",
          properties: { ...repoProp, name: { type: "string", description: "Type name to look up" } },
          required: ["repo"]
        }
      },
      {
        name: "implementations",
        description: "Who implements this interface (or extends this class)? Walks the hierarchy TRANSITIVELY, so a class implementing a sub-interface of the one asked about is included. The tool to reach for before changing an interface.",
        inputSchema: {
          type: "object",
          properties: { ...repoProp, name: { type: "string", description: "Interface/trait/class name" } },
          required: ["repo", "name"]
        }
      },
      {
        name: "call_graph",
        description: "What does this symbol reach, and what reaches it? A bounded symbol-to-symbol neighborhood around `symbol` \u2014 `depth` hops (default 2) following `calls`/`extends`/`implements` edges, `direction` out (callees) | in (callers) | both. Answers impact questions the one-hop `callers` tool cannot.",
        inputSchema: {
          type: "object",
          properties: {
            ...repoProp,
            symbol: { type: "string", description: "Symbol name to centre on" },
            depth: { type: "number", description: "Hops to follow (default 2, max 5)" },
            direction: { type: "string", description: "out | in | both (default both)" }
          },
          required: ["repo", "symbol"]
        }
      },
      {
        name: "check_rules",
        description: 'Validate dependency-cruiser-style architecture rules against the link-graph. Rules (inline JSON array): forbidden edges {name, from, to, kind?, severity?, comment?} with glob paths, plus builtins {name, builtin: "cycles"|"orphans"} (module-level import cycles; edge-less code files). Returns deterministic violations with severity error|warn \u2014 a CI gate.',
        inputSchema: {
          type: "object",
          properties: {
            ...repoProp,
            ...scopeProps,
            rules: { type: "array", description: "Rules array (inline JSON \u2014 see description)" },
            configPath: {
              type: "string",
              description: "Read the rules from this JSON file instead (repo-relative or absolute) \u2014 the CLI's --config. Ignored when `rules` is given."
            }
          },
          required: ["repo"]
        }
      }
    ];
    strArr = { type: "array", items: { type: "string" } };
    anyObj = { type: "object" };
    OUTPUT_SCHEMAS = {
      call_graph: {
        type: "object",
        properties: {
          root: { type: "array", items: anyObj },
          nodes: { type: "array", items: anyObj },
          edges: { type: "array", items: anyObj },
          truncated: { type: "boolean" }
        },
        required: ["root", "nodes", "edges"]
      },
      scan_summary: {
        type: "object",
        properties: {
          engineVersion: { type: "string" },
          commit: { type: "string" },
          fileCount: { type: "integer" },
          languages: { type: "object", additionalProperties: { type: "integer" } },
          capped: { type: "boolean" }
        },
        required: ["engineVersion", "fileCount", "languages", "capped"]
      },
      graph: {
        type: "object",
        properties: {
          schemaVersion: { type: "integer" },
          version: { type: "string" },
          commit: { type: "string" },
          fileCount: { type: "integer" },
          languages: { type: "object", additionalProperties: { type: "integer" } },
          files: { type: "array", items: anyObj },
          modules: { type: "array", items: anyObj },
          fileEdges: { type: "array", items: anyObj },
          moduleEdges: { type: "array", items: anyObj }
        },
        required: ["schemaVersion", "files", "fileEdges", "modules", "moduleEdges"]
      },
      // Two shapes, both objects: the whole index, or one symbol's entry.
      symbols: {
        oneOf: [
          {
            type: "object",
            properties: { schemaVersion: { type: "integer" }, defs: anyObj, refs: anyObj },
            required: ["schemaVersion", "defs"]
          },
          {
            type: "object",
            properties: { name: { type: "string" }, defs: { type: "array", items: anyObj }, refs: strArr },
            required: ["name", "defs", "refs"]
          }
        ]
      },
      // The whole index (symbol name -> entry), one entry, or the not-found notice.
      callers: {
        oneOf: [
          { type: "object", additionalProperties: anyObj },
          { type: "object", properties: { error: { type: "string" } }, required: ["error"] }
        ]
      },
      workspaces: {
        type: "object",
        properties: {
          packages: { type: "array", items: anyObj },
          cycle: { type: ["array", "null"], items: { type: "string" } },
          topoOrder: strArr
        },
        required: ["packages", "topoOrder"]
      },
      churn: {
        type: "object",
        properties: { ok: { type: "boolean" }, churn: { type: "object", additionalProperties: { type: "integer" } } },
        required: ["ok", "churn"]
      },
      find_references: {
        type: "object",
        properties: {
          defs: { type: "array", items: anyObj },
          callSites: { type: "array", items: anyObj },
          referencingFiles: strArr
        },
        required: ["defs", "callSites", "referencingFiles"]
      },
      lsp_status: {
        type: "object",
        properties: {
          lspVersion: { type: "number" },
          mode: { type: "string", enum: ["none", "configured"] },
          configPath: { type: ["string", "null"] },
          source: { type: "string", enum: ["env", "repo", "cwd", "none"] },
          servers: { type: "array", items: anyObj },
          unmappedLanguages: strArr
        },
        required: ["lspVersion", "mode", "source", "servers", "unmappedLanguages"]
      },
      onboard: {
        type: "object",
        properties: { brief: { type: "string" }, memory: { type: "string" } },
        required: ["brief"]
      },
      explain_search: {
        type: "object",
        properties: {
          results: { type: "array", items: anyObj },
          explain: {
            type: "object",
            properties: {
              query: { type: "string" },
              terms: { type: "array", items: anyObj },
              droppedStopwords: strArr,
              unresolvedTerms: strArr,
              wholeIdentifier: anyObj,
              verdict: { type: "string", enum: ["match", "weak", "none"] },
              note: { type: "string" },
              bridgedOnlyResults: { type: "number" },
              resultCount: { type: "number" }
            },
            required: ["query", "terms", "droppedStopwords", "unresolvedTerms", "verdict", "bridgedOnlyResults", "resultCount"]
          }
        },
        required: ["results", "explain"]
      },
      hotspots: {
        type: "object",
        properties: { churnOk: { type: "boolean" }, hotspots: { type: "array", items: anyObj } },
        required: ["churnOk", "hotspots"]
      },
      coupling: {
        type: "object",
        properties: { ok: { type: "boolean" }, couplings: { type: "array", items: anyObj } },
        required: ["ok", "couplings"]
      },
      duplicated_literals: {
        type: "object",
        properties: {
          duplications: { type: "array", items: anyObj },
          families: { type: "array", items: anyObj }
        },
        required: ["duplications", "families"]
      },
      embed_status: {
        type: "object",
        properties: {
          embedVersion: { type: "integer" },
          mode: { type: "string", enum: ["none", "static", "endpoint"] },
          model: {},
          endpoint: {},
          endpointReachable: { type: "boolean" }
        },
        required: ["embedVersion", "mode"]
      },
      write_memory: {
        type: "object",
        properties: { written: { type: "string" } },
        required: ["written"]
      },
      delete_memory: {
        type: "object",
        properties: { deleted: { type: "boolean" } },
        required: ["deleted"]
      }
    };
    for (const name2 of ["replace_symbol_body", "insert_after_symbol", "insert_before_symbol"]) {
      OUTPUT_SCHEMAS[name2] = {
        type: "object",
        properties: {
          file: { type: "string" },
          symbol: { type: "string" },
          startLine: { type: "integer" },
          endLine: { type: "integer" }
        },
        required: ["file"]
      };
    }
    TOOL_META = {
      scan_summary: { title: "Scan summary" },
      graph: { title: "Link graph" },
      symbols: { title: "Symbol index" },
      callers: { title: "Caller index" },
      workspaces: { title: "Monorepo workspaces" },
      churn: { title: "Git churn" },
      symbols_overview: { title: "File symbol overview" },
      find_symbol: { title: "Find symbol" },
      find_references: { title: "Find references" },
      repo_map: { title: "Repository map" },
      onboard: { title: "Project brief", write: true, destructive: false, idempotent: true },
      hotspots: { title: "Hotspots" },
      coupling: { title: "Change coupling" },
      replace_symbol_body: { title: "Replace symbol body", write: true, destructive: true, idempotent: true },
      insert_after_symbol: { title: "Insert after symbol", write: true, destructive: false, idempotent: false },
      insert_before_symbol: { title: "Insert before symbol", write: true, destructive: false, idempotent: false },
      write_memory: { title: "Write memory", write: true, destructive: false, idempotent: true },
      read_memory: { title: "Read memory" },
      list_memories: { title: "List memories" },
      delete_memory: { title: "Delete memory", write: true, destructive: true, idempotent: true },
      dead_code: { title: "Dead-code candidates" },
      duplicated_literals: { title: "Values with no single source of truth" },
      complexity: { title: "Complexity" },
      mermaid: { title: "Mermaid module diagram" },
      grep: { title: "Grep file contents" },
      search: { title: "Lexical search", openWorld: true },
      explain_search: { title: "Search with a verdict", openWorld: true },
      // openWorld: it spawns a process the user configured, whose answer this
      // engine does not determine — the same honesty `search` and `embed_status`
      // already carry for reaching outside their own artifacts.
      lsp_status: { title: "LSP tier status", openWorld: true },
      embed_status: { title: "Embedding tier status", openWorld: true },
      type_hierarchy: { title: "Type hierarchy" },
      implementations: { title: "Implementations" },
      call_graph: { title: "Call graph neighborhood" },
      check_rules: { title: "Check architecture rules" }
    };
    TOOL_PROFILES = {
      // Land in an unfamiliar repository and get your bearings.
      orient: ["scan_summary", "repo_map", "onboard", "workspaces", "mermaid", "read_memory", "list_memories"],
      // Locate a thing.
      find: ["search", "explain_search", "grep", "find_symbol", "symbols", "symbols_overview"],
      // Decide whether changing it is safe.
      impact: ["find_references", "callers", "call_graph", "dead_code", "type_hierarchy", "implementations", "lsp_status"],
      // Change it.
      edit: ["find_symbol", "symbols_overview", "replace_symbol_body", "insert_after_symbol", "insert_before_symbol"],
      // Where the work and the risk concentrate.
      risk: ["hotspots", "churn", "coupling", "complexity", "check_rules", "duplicated_literals", "dead_code"]
    };
  }
});

// src/mcp/session.ts
import { statSync as statSync5 } from "fs";
import { join as join21 } from "path";
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
    stat = statSync5(join21(modelDir, "model.json"));
  } catch {
    return void 0;
  }
  const key = `${modelDir}:${stat.mtimeMs}:${stat.size}`;
  if (embedModelCache && embedModelCache.key === key) return embedModelCache.model;
  const model = loadEmbedModel(modelDir);
  if (model) embedModelCache = { key, model };
  return model;
}
function sessionGet(key) {
  const i2 = sessionCaches.findIndex((e) => e.key === key);
  if (i2 < 0) return void 0;
  const [entry] = sessionCaches.splice(i2, 1);
  sessionCaches.unshift(entry);
  return entry;
}
function sessionPut(entry) {
  const i2 = sessionCaches.findIndex((e) => e.key === entry.key);
  if (i2 >= 0) sessionCaches.splice(i2, 1);
  sessionCaches.unshift(entry);
  sessionCaches.length = Math.min(sessionCaches.length, SESSION_CACHE_MAX);
  return entry;
}
function sessionClear() {
  sessionCaches.length = 0;
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
function getScan(repo, opts = {}, walked) {
  const key = sessionKey(repo, opts);
  const hit = sessionGet(key);
  if (hit) {
    const fresh = scanRepo(repo, { ...opts, cache: hit.cacheMap, precomputedWalk: walked });
    if (fresh.contentUnchanged) {
      if (fresh.cacheDirty) hit.cacheMap = toCacheMap(fresh);
      if (hit.scan.commit !== fresh.commit) hit.scan.commit = fresh.commit;
      return hit.scan;
    }
    sessionPut({ key, scan: fresh, cacheMap: toCacheMap(fresh) });
    return fresh;
  }
  const preloaded = preloadSession(repo, { ...opts, precomputedWalk: walked });
  if (preloaded) {
    sessionPut({ key, scan: preloaded.scan, cacheMap: preloaded.cacheMap, arts: preloaded.arts });
    return preloaded.scan;
  }
  const scan2 = scanRepo(repo, { ...opts, precomputedWalk: walked });
  sessionPut({ key, scan: scan2, cacheMap: toCacheMap(scan2) });
  return scan2;
}
function getScanSummary(repo, opts = {}, walked) {
  if (sessionCaches.some((e) => e.key === sessionKey(repo, opts))) {
    const scan2 = getScan(repo, opts, walked);
    return {
      root: scan2.root,
      commit: scan2.commit,
      fileCount: scan2.files.length,
      languages: scan2.languages,
      capped: scan2.capped,
      excluded: scan2.excluded
    };
  }
  return scanSummary(repo, { ...opts, precomputedWalk: walked });
}
function getArtifacts(repo, opts = {}, walked) {
  const scan2 = getScan(repo, opts, walked);
  const entry = sessionCaches.find((e) => e.scan === scan2);
  if (entry) return entry.arts ??= buildArtifactsFromScan(scan2, opts);
  return buildArtifactsFromScan(scan2, opts);
}
async function warmGrammarsForRepo(repo) {
  await warmGrammarsForWalk(walk(repo, {}));
}
async function warmGrammarsForWalk(walked) {
  await ensureGrammars(grammarKeysForExts(walked.files.map((f) => f.ext)));
}
var embeddingIndexCache, embedModelCache, SESSION_CACHE_MAX, sessionCaches;
var init_session = __esm({
  "src/mcp/session.ts"() {
    "use strict";
    init_pipeline();
    init_scan();
    init_preload();
    init_walk();
    init_loader();
    init_model();
    init_embed();
    init_hash();
    SESSION_CACHE_MAX = 4;
    sessionCaches = [];
  }
});

// src/mcp.ts
var mcp_exports = {};
__export(mcp_exports, {
  DEFAULT_MAX_RESPONSE_BYTES: () => DEFAULT_MAX_RESPONSE_BYTES,
  OUTPUT_SCHEMAS: () => OUTPUT_SCHEMAS,
  PROTOCOL_VERSIONS: () => PROTOCOL_VERSIONS,
  TOOLS: () => TOOLS,
  TOOL_META: () => TOOL_META,
  TOOL_PROFILES: () => TOOL_PROFILES,
  annotationsFor: () => annotationsFor,
  capResponse: () => capResponse,
  getArtifacts: () => getArtifacts,
  getScan: () => getScan,
  getScanSummary: () => getScanSummary,
  memoizedEmbedModel: () => memoizedEmbedModel,
  memoizedEmbeddingIndex: () => memoizedEmbeddingIndex,
  negotiateProtocol: () => negotiateProtocol,
  profileNames: () => profileNames,
  resourceLinkFor: () => resourceLinkFor,
  runMcpServer: () => runMcpServer,
  scanFingerprint: () => scanFingerprint,
  structuredContentFor: () => structuredContentFor,
  toCacheMap: () => toCacheMap,
  toolsFor: () => toolsFor,
  toolsInProfiles: () => toolsInProfiles,
  validateArgs: () => validateArgs,
  warmGrammarsForRepo: () => warmGrammarsForRepo,
  warmGrammarsForWalk: () => warmGrammarsForWalk
});
import { readFileSync as readFileSync12 } from "fs";
import { isAbsolute, join as join22 } from "path";
import { createInterface } from "readline";
function str(v) {
  return typeof v === "string" && v ? v : void 0;
}
function strArray(v) {
  return Array.isArray(v) && v.every((x) => typeof x === "string") && v.length ? v : void 0;
}
function num(v) {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : void 0;
}
function errMessage(e) {
  return e instanceof Error ? e.message : String(e);
}
async function callTool(name2, args2, defaultRepo) {
  const repo = str(args2.repo) ?? defaultRepo;
  if (!repo) throw new Error("`repo` is required (absolute path to the repository root)");
  const scanOpts = { scope: str(args2.scope), include: strArray(args2.include), exclude: strArray(args2.exclude) };
  const rankArg = str(args2.rank);
  const rankOpt = rankArg === "graph" || rankArg === "lexical" ? { rank: rankArg } : {};
  let walked;
  if (!SCANLESS_TOOLS.has(name2)) {
    walked = walk(repo, {});
    await warmGrammarsForWalk(walked);
  }
  if (name2 === "scan_summary") {
    const s = getScanSummary(repo, scanOpts, walked);
    return JSON.stringify(
      { engineVersion: ENGINE_VERSION, commit: s.commit, fileCount: s.fileCount, languages: s.languages, capped: s.capped },
      null,
      2
    );
  }
  if (name2 === "graph") {
    return renderGraphJson(getArtifacts(repo, scanOpts, walked).graph);
  }
  if (name2 === "symbols") {
    const { symbols } = getArtifacts(repo, scanOpts, walked);
    const lookup = str(args2.name);
    if (lookup) {
      return JSON.stringify({ name: lookup, defs: symbols.defs[lookup] ?? [], refs: symbols.refs[lookup] ?? [] }, null, 2);
    }
    return JSON.stringify(symbols, null, 2);
  }
  if (name2 === "callers") {
    const scan2 = getScan(repo, scanOpts, walked);
    const index = args2.recall === true ? buildCallerIndex(scan2, void 0, { recall: true }) : callerIndexFor(scan2);
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
    return JSON.stringify(symbolsOverview(getScan(repo, scanOpts, walked), file), null, 2);
  }
  if (name2 === "find_symbol") {
    const namePath = str(args2.namePath);
    if (!namePath) throw new Error("`namePath` is required");
    const matches = findSymbol(getScan(repo, scanOpts, walked), namePath, {
      substring: args2.substring === true,
      includeBody: args2.includeBody === true,
      concise: args2.concise === true,
      maxResults: num(args2.maxResults)
    });
    return JSON.stringify(matches, null, 2);
  }
  if (name2 === "find_references") {
    const symName = str(args2.name);
    if (!symName) throw new Error("`name` is required");
    const scan2 = getScan(repo, scanOpts, walked);
    const statik = findReferences(scan2, symName);
    if (args2.lsp === true) return JSON.stringify(await referencesWithLsp(scan2, repo, symName, statik), null, 2);
    return JSON.stringify(statik, null, 2);
  }
  if (name2 === "lsp_status") {
    return JSON.stringify(await lspStatus(getScan(repo, scanOpts, walked), repo, args2.probe === true), null, 2);
  }
  if (name2 === "replace_symbol_body" || name2 === "insert_after_symbol" || name2 === "insert_before_symbol") {
    const namePath = str(args2.namePath);
    const body2 = typeof args2.body === "string" ? args2.body : void 0;
    if (!namePath || body2 === void 0) throw new Error("`namePath` and `body` are required");
    const scan2 = getScan(repo, scanOpts, walked);
    const fn = name2 === "replace_symbol_body" ? replaceSymbolBody : name2 === "insert_after_symbol" ? insertAfterSymbol : insertBeforeSymbol;
    const result = fn(scan2, namePath, body2, str(args2.file));
    sessionClear();
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
    const all = findDeadCode(getScan(repo, scanOpts, walked));
    const limit = num(args2.limit);
    if (limit === void 0 || all.length <= limit) return JSON.stringify(all, null, 2);
    return JSON.stringify({ total: all.length, shown: limit, truncated: true, candidates: all.slice(0, limit) }, null, 2);
  }
  if (name2 === "duplicated_literals") {
    const report = findLiteralDuplications(getScan(repo, scanOpts, walked), {
      minFiles: num(args2.minFiles),
      minCount: num(args2.minCount),
      includeTests: args2.includeTests === true
    });
    const limit = num(args2.limit);
    if (limit === void 0 || report.duplications.length <= limit) return JSON.stringify(report, null, 2);
    return JSON.stringify(
      {
        total: report.duplications.length,
        shown: limit,
        truncated: true,
        duplications: report.duplications.slice(0, limit),
        families: report.families
      },
      null,
      2
    );
  }
  if (name2 === "complexity") {
    const scan2 = getScan(repo, scanOpts, walked);
    if (args2.risk === true) {
      const { churn, ok } = gitChurn(repo, { since: str(args2.since) });
      return JSON.stringify({ churnOk: ok, risks: riskHotspots(scan2, churn, num(args2.top)) }, null, 2);
    }
    return JSON.stringify(symbolComplexity(scan2, str(args2.file), num(args2.top)), null, 2);
  }
  if (name2 === "mermaid") {
    const { graph } = getArtifacts(repo, scanOpts, walked);
    return renderMermaid(graph, { module: str(args2.module), maxEdges: num(args2.maxEdges) });
  }
  if (name2 === "onboard") {
    const scan2 = getScan(repo, scanOpts, walked);
    const { graph } = getArtifacts(repo, scanOpts, walked);
    return JSON.stringify(
      onboardBrief(scan2, graph, {
        ...typeof args2.budgetTokens === "number" ? { budgetTokens: args2.budgetTokens } : {},
        ...args2.remember === false ? { remember: false } : {}
      }),
      null,
      2
    );
  }
  if (name2 === "repo_map") {
    const { scan: scan2, graph } = getArtifacts(repo, scanOpts, walked);
    return renderRepoMap(scan2, graph, { budgetTokens: typeof args2.budgetTokens === "number" ? args2.budgetTokens : void 0 });
  }
  if (name2 === "hotspots") {
    const scan2 = getScan(repo, scanOpts, walked);
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
    const scope = str(args2.scope);
    const globs = strArray(args2.globs);
    const hits = grepRepo(repo, pattern, {
      globs: scope ? [...globs ?? [], `${scope.replace(/\/+$/, "")}/**`] : globs,
      ignoreCase: args2.ignoreCase === true,
      maxHits: typeof args2.maxHits === "number" ? args2.maxHits : void 0
    });
    return JSON.stringify(hits, null, 2);
  }
  if (name2 === "search") {
    const query = str(args2.query);
    if (!query) throw new Error("`query` is required");
    const scan2 = getScan(repo, scanOpts, walked);
    const limit = typeof args2.limit === "number" ? args2.limit : void 0;
    const fuzzy = typeof args2.fuzzy === "boolean" ? args2.fuzzy : void 0;
    const exactOpt = args2.exact === true ? { exact: true } : {};
    if (args2.semantic === true) {
      const endpoint = resolveEmbedEndpoint();
      if (endpoint) {
        try {
          const index = await memoizedEmbeddingIndex({ mode: "endpoint", identity: endpoint, scan: scan2 }, () => buildEndpointIndex(scan2));
          const queryVec = await encodeQueryViaEndpoint(query);
          const results3 = searchSemantic(scan2, query, index, { queryVec, limit, fuzzy });
          return JSON.stringify({ results: results3, tier: "endpoint" }, null, 2);
        } catch (e) {
          const results3 = searchIndex(scan2, query, { limit, fuzzy, ...rankOpt });
          return JSON.stringify(
            { results: results3, tier: "lexical", degradedReason: `embedding endpoint failed: ${errMessage(e)}` },
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
        const results3 = searchSemantic(scan2, query, index, { model, limit, fuzzy });
        return JSON.stringify({ results: results3, tier: "static" }, null, 2);
      }
      const results2 = searchIndex(scan2, query, { limit, fuzzy, ...rankOpt });
      return JSON.stringify(
        { results: results2, tier: "lexical", degradedReason: "no embedding endpoint or static model configured \u2014 see embed_status" },
        null,
        2
      );
    }
    const { results, explain } = explainQuery(scan2, query, { limit, fuzzy, ...exactOpt, ...rankOpt });
    return JSON.stringify(args2.explain === true ? { results, explain } : results, null, 2);
  }
  if (name2 === "explain_search") {
    const query = str(args2.query);
    if (!query) throw new Error("`query` is required");
    const scan2 = getScan(repo, scanOpts, walked);
    const limit = typeof args2.limit === "number" ? args2.limit : void 0;
    const fuzzy = typeof args2.fuzzy === "boolean" ? args2.fuzzy : void 0;
    const { results, explain } = explainQuery(scan2, query, {
      limit,
      fuzzy,
      ...args2.exact === true ? { exact: true } : {},
      ...rankOpt
    });
    return JSON.stringify({ results, explain }, null, 2);
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
  if (name2 === "type_hierarchy") {
    const hierarchy = hierarchyFor(getScan(repo, scanOpts, walked));
    const wanted = str(args2.name);
    if (!wanted) {
      const obj = {};
      for (const [key, entry2] of hierarchy) obj[key] = entry2;
      return JSON.stringify(obj, null, 2);
    }
    const entry = hierarchy.get(wanted);
    if (!entry) return JSON.stringify({ error: `no type named ${wanted}` }, null, 2);
    return JSON.stringify(entry, null, 2);
  }
  if (name2 === "implementations") {
    const wanted = str(args2.name);
    if (!wanted) throw new Error("`name` is required");
    const hierarchy = hierarchyFor(getScan(repo, scanOpts, walked));
    if (!hierarchy.has(wanted)) return JSON.stringify({ error: `no type named ${wanted}` }, null, 2);
    return JSON.stringify({ name: wanted, implementations: implementationsOf(hierarchy, wanted) }, null, 2);
  }
  if (name2 === "call_graph") {
    const symbol = str(args2.symbol);
    if (!symbol) throw new Error("`symbol` is required");
    const direction = str(args2.direction);
    const dir = direction === "out" || direction === "in" ? direction : "both";
    const result = neighborhood(symbolGraphFor(getScan(repo, scanOpts, walked)), symbol, {
      ...typeof args2.depth === "number" ? { depth: args2.depth } : {},
      direction: dir
    });
    if (!result.root.length) return JSON.stringify({ error: `no symbol named ${symbol}` }, null, 2);
    return JSON.stringify(result, null, 2);
  }
  if (name2 === "check_rules") {
    const configPath = str(args2.configPath);
    let payload = args2.rules;
    if (payload === void 0 && configPath) {
      const abs = isAbsolute(configPath) ? configPath : join22(repo, configPath);
      try {
        payload = JSON.parse(readFileSync12(abs, "utf8"));
      } catch (e) {
        throw new Error(`cannot read rules from ${abs}: ${errMessage(e)}`);
      }
    }
    if (payload === void 0) throw new Error("`rules` (or `configPath`) is required");
    const rules = parseRules(payload);
    const { graph } = getArtifacts(repo, scanOpts, walked);
    return JSON.stringify(checkRules(graph, rules), null, 2);
  }
  throw new Error(`unknown tool: ${name2}`);
}
async function runMcpServer(opts = {}) {
  const serverInfo = {
    name: opts.serverInfo?.name ?? "codeindex",
    version: opts.serverInfo?.version ?? ENGINE_VERSION
  };
  let protocolVersion = PROTOCOL_VERSIONS[0];
  let tools = toolsFor(opts.defaultRepo, protocolVersion, opts.profile);
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
        protocolVersion = negotiateProtocol(req.params?.protocolVersion);
        tools = toolsFor(opts.defaultRepo, protocolVersion, opts.profile);
        send({
          id: req.id,
          result: {
            protocolVersion,
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
          const decl = tools.find(
            (t) => t.name === name2
          );
          const invalid = decl ? validateArgs(decl.inputSchema, args2) : void 0;
          if (invalid) throw new Error(invalid);
          const raw = await callTool(name2, args2, opts.defaultRepo);
          const repo = str(args2.repo) ?? opts.defaultRepo ?? "";
          const text = capResponse(raw, name2, repo, opts.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES);
          const capped = text !== raw;
          const link = capped && protocolVersion >= RICH_TOOLS_SINCE ? resourceLinkFor(text, name2) : void 0;
          const structured = protocolVersion >= RICH_TOOLS_SINCE ? structuredContentFor(text, capped, OUTPUT_SCHEMAS[name2] !== void 0) : void 0;
          send({
            id: req.id,
            result: {
              content: link ? [{ type: "text", text }, link] : [{ type: "text", text }],
              ...structured ? { structuredContent: structured } : {}
            }
          });
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
var SCANLESS_TOOLS;
var init_mcp = __esm({
  "src/mcp.ts"() {
    "use strict";
    init_types();
    init_graph_json();
    init_callers();
    init_derived();
    init_relations();
    init_symbolgraph();
    init_workspaces();
    init_git();
    init_grep();
    init_coupling();
    init_repomap();
    init_deadcode();
    init_literals2();
    init_complexity();
    init_viz();
    init_query();
    init_lsp();
    init_onboard();
    init_edit();
    init_memory();
    init_bm25();
    init_rules();
    init_model();
    init_embed();
    init_search();
    init_endpoint();
    init_walk();
    init_tools();
    init_protocol2();
    init_session();
    init_tools();
    init_protocol2();
    init_session();
    SCANLESS_TOOLS = /* @__PURE__ */ new Set([
      "workspaces",
      "churn",
      "coupling",
      "grep",
      "write_memory",
      "read_memory",
      "list_memories",
      "delete_memory",
      "embed_status",
      // scan_summary counts and classifies by path only — it never parses, so the
      // grammar warm (a whole extra walk) would be pure overhead. When a scan is
      // already cached getScanSummary reuses it, warm grammars included.
      "scan_summary"
    ]);
  }
});

// src/rewrite.ts
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
  const tokens = tokenize2(line);
  if (!tokens || tokens.length < 2) return void 0;
  const [head, ...args2] = tokens;
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
var SHELL_METACHARS, GREP_BINARIES;
var init_rewrite = __esm({
  "src/rewrite.ts"() {
    "use strict";
    SHELL_METACHARS = /[|&;<>`\n\r$(){}]/;
    GREP_BINARIES = /* @__PURE__ */ new Set(["grep", "egrep", "rg", "ripgrep"]);
  }
});

// src/engine.ts
init_types();
init_walk();
init_scan();
init_scan();
init_preload();

// src/pool.ts
init_hash();
init_walk();
init_registry();
init_loader();
init_scan();
import { existsSync as existsSync2, statSync as statSync2 } from "fs";
import { availableParallelism } from "os";
import { dirname as dirname2, join as join4 } from "path";
import { fileURLToPath as fileURLToPath2, pathToFileURL } from "url";
import { Worker } from "worker_threads";
function resolveEngineUrl() {
  try {
    const here = fileURLToPath2(import.meta.url);
    if (here.endsWith("engine.mjs")) return pathToFileURL(here).href;
    const adjacent = join4(dirname2(here), "engine.mjs");
    if (existsSync2(adjacent)) return pathToFileURL(adjacent).href;
    return void 0;
  } catch {
    return void 0;
  }
}
var WORKER_TIMEOUT_MS = 10 * 60 * 1e3;
function workerCount(requested) {
  const env = process.env["CODEINDEX_WORKERS"];
  const raw = requested ?? (env !== void 0 && env !== "" ? Number(env) : void 0);
  if (raw !== void 0) return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  let cores = 1;
  try {
    cores = availableParallelism();
  } catch {
    cores = 1;
  }
  return Math.max(0, Math.min(cores - 1, 8));
}
async function runExtractWorker(input, post) {
  await ensureGrammars(input.grammarKeys);
  const ready = input.grammarKeys.filter((k) => grammarReady(k));
  const records = [];
  for (const job of input.jobs) {
    let size;
    let mtimeMs;
    try {
      const st = statSync2(job.abs);
      size = st.size;
      mtimeMs = st.mtimeMs;
    } catch {
      continue;
    }
    const content = readText(job.abs);
    const record = buildCodeRecord(job.rel, job.ext, size, content, sha1(content), extToLang(job.ext), {
      maxCallsPerFile: input.maxCallsPerFile
    });
    records.push({ rel: job.rel, size, mtimeMs, record });
  }
  post({ ready, records });
}
async function extractInParallel(jobs, grammarKeys, count, opts = {}) {
  if (count < 2 || jobs.length === 0) return void 0;
  const engineUrl = resolveEngineUrl();
  if (!engineUrl) return void 0;
  const wanted = grammarKeys.filter((k) => grammarReady(k)).sort();
  const shards = Array.from({ length: Math.min(count, jobs.length) }, () => []);
  jobs.forEach((j, i2) => shards[i2 % shards.length].push(j));
  const bootstrap = `import { runExtractWorker } from ${JSON.stringify(engineUrl)};
import { parentPort, workerData } from "node:worker_threads";
runExtractWorker(workerData.input, (o) => parentPort.postMessage(o)).catch((e) => parentPort.postMessage({ error: String(e) }));
`;
  try {
    const outputs = await Promise.all(
      shards.map(
        (jobsForShard) => new Promise((resolve5, reject) => {
          const w = new Worker(bootstrap, {
            eval: true,
            workerData: { input: { jobs: jobsForShard, grammarKeys: wanted, maxCallsPerFile: opts.maxCallsPerFile } }
          });
          const timer = setTimeout(() => {
            reject(new Error("extraction worker timed out"));
            void w.terminate();
          }, WORKER_TIMEOUT_MS);
          const settle = (fn) => {
            clearTimeout(timer);
            fn();
          };
          w.once("message", (m) => {
            settle(() => resolve5(m));
            void w.terminate();
          });
          w.once("error", (e) => settle(() => reject(e)));
          w.once("exit", (code) => {
            if (code !== 0) settle(() => reject(new Error(`extraction worker exited with ${code}`)));
          });
        })
      )
    );
    const out2 = /* @__PURE__ */ new Map();
    for (const o of outputs) {
      if ("error" in o) return void 0;
      if (o.ready.slice().sort().join(",") !== wanted.join(",")) return void 0;
      for (const r of o.records) out2.set(r.rel, { size: r.size, mtimeMs: r.mtimeMs, record: r.record });
    }
    return out2;
  } catch {
    return void 0;
  }
}
async function scanRepoParallel(root, opts = {}) {
  const count = workerCount(opts.workers);
  if (count < 2) return scanRepo(root, opts);
  const walked = opts.precomputedWalk ?? walk(root, {
    maxFileBytes: opts.maxBytes,
    maxFiles: opts.maxFiles,
    gitignore: opts.gitignore,
    ignoreDirs: opts.ignoreDirs
  });
  const scanOpts = { ...opts, precomputedWalk: walked };
  const jobs = [];
  for (const { f } of keptCodeFiles(root, scanOpts)) {
    const cached = opts.cache?.get(f.rel);
    if (!opts.fullHash && cached && cached.size !== void 0 && cached.mtimeMs !== void 0 && cached.size === f.size && cached.mtimeMs === f.mtimeMs) {
      continue;
    }
    jobs.push({ abs: f.abs, rel: f.rel, ext: f.ext });
  }
  if (jobs.length === 0) return scanRepo(root, scanOpts);
  const grammarKeys = grammarKeysForExts(walked.files.map((f) => f.ext));
  const extracted = await extractInParallel(jobs, grammarKeys, count, { maxCallsPerFile: opts.maxCallsPerFile });
  return scanRepo(root, extracted ? { ...scanOpts, extracted } : scanOpts);
}

// src/engine.ts
init_glob();
init_ignore();
init_classify();

// src/categorize.ts
import { basename as basename2 } from "path";
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
  ".elm",
  ".hcl",
  ".tf",
  ".tfvars",
  ".sol",
  ".hh",
  ".sc",
  ".pyi",
  ".rake",
  ".cxx"
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
function categorize(rel2, ext) {
  const lower = rel2.toLowerCase();
  const base = basename2(lower);
  const segments = lower.split("/");
  const inDir = (names) => names.some((n) => segments.includes(n));
  if (inDir(I18N_DIRS) && I18N_EXTS.has(ext)) return "i18n";
  if (ext === ".prisma" || ext === ".sql" || ext === ".graphql" || ext === ".gql" || base.startsWith("schema.") || base === "models.py" || inDir(SCHEMA_DIRS)) {
    return "schema";
  }
  if (lower.includes(".test.") || lower.includes(".spec.") || inDir(TEST_DIRS)) return "test";
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

// src/engine.ts
init_registry();
init_code();
init_markdown();
init_loader();
init_extract();

// src/ast/tags.ts
init_web_tree_sitter();
init_loader();
init_sort();
import { existsSync as existsSync3, readFileSync as readFileSync4 } from "fs";
import { join as join5 } from "path";
var queries = /* @__PURE__ */ new Map();
function queryFor(key, language) {
  const cached = queries.get(key);
  if (cached !== void 0) return cached;
  let compiled = null;
  for (const dir of resolveGrammarsTier().dirs) {
    const path = join5(dir, `${key}.tags.scm`);
    if (!existsSync3(path)) continue;
    try {
      compiled = new Query(language, readFileSync4(path, "utf8"));
    } catch {
      compiled = null;
    }
    break;
  }
  queries.set(key, compiled);
  return compiled;
}
function tagsQueryStatus(key) {
  const present = resolveGrammarsTier().dirs.some((d) => existsSync3(join5(d, `${key}.tags.scm`)));
  if (!present) return { present: false, compiled: false };
  const language = languageFor(key);
  if (!language) return { present: true, compiled: false };
  return { present: true, compiled: queryFor(key, language) !== null };
}
function extractTags(ext, content) {
  const key = grammarKeyForExt(ext);
  if (!key) return [];
  const language = languageFor(key);
  const parser2 = parserFor(key);
  if (!language || !parser2) return [];
  const query = queryFor(key, language);
  if (!query) return [];
  let tree = null;
  try {
    tree = parser2.parse(content);
    if (!tree) return [];
    const out2 = [];
    const seen = /* @__PURE__ */ new Set();
    for (const match of query.matches(tree.rootNode)) {
      let name2;
      let kind;
      let line = 0;
      for (const capture of match.captures) {
        if (capture.name === "name") {
          name2 = capture.node.text;
          line = capture.node.startPosition.row + 1;
        } else if (capture.name.startsWith("definition.")) {
          kind = capture.name.slice("definition.".length);
        }
      }
      if (!name2 || !kind) continue;
      const dedup = `${kind} ${name2} ${line}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      out2.push({ kind, name: name2, line });
    }
    return out2.sort((a, b) => a.line - b.line || byStr(a.name, b.name) || byStr(a.kind, b.kind));
  } catch {
    return [];
  } finally {
    tree?.delete();
  }
}

// src/engine.ts
init_loader();
init_loader();

// src/ast/grammars-pull.ts
init_types();
import { createHash as createHash2 } from "crypto";
import { existsSync as existsSync4, mkdirSync, mkdtempSync, readFileSync as readFileSync5, renameSync, rmSync, writeFileSync } from "fs";
import { dirname as dirname3, join as join6, resolve, sep as sep2 } from "path";
import { gunzipSync } from "zlib";
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
    const rel2 = safeRelPath(entry.name);
    if (rel2 === null) throw new Error(`refusing unsafe tar entry: ${entry.name}`);
    const dest = resolve(destDir, rel2);
    if (dest !== root && !dest.startsWith(root + sep2)) {
      throw new Error(`tar entry escapes destination: ${entry.name}`);
    }
    mkdirSync(dirname3(dest), { recursive: true });
    writeFileSync(dest, entry.data);
    written.push(rel2);
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
  const runtime = join6(cacheDir, "web-tree-sitter.wasm");
  const markerPath = join6(dirname3(cacheDir), `${ENGINE_VERSION}.sha256`);
  if (existsSync4(runtime) && expected && existsSync4(markerPath)) {
    let marker = "";
    try {
      marker = readFileSync5(markerPath, "utf8").trim();
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
    mkdirSync(dirname3(cacheDir), { recursive: true });
    tmp = mkdtempSync(join6(dirname3(cacheDir), ".grammars-tmp-"));
    extractGrammarsTarball(bytes, tmp);
    if (!existsSync4(join6(tmp, "web-tree-sitter.wasm"))) {
      throw new Error("archive is missing web-tree-sitter.wasm");
    }
    if (existsSync4(cacheDir)) rmSync(cacheDir, { recursive: true, force: true });
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

// src/ast/warm.ts
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

// src/engine.ts
init_resolve();
init_modules();
init_graph();
init_calls();
init_relations();
init_symbolgraph();
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

// src/render/scip.ts
init_types();
init_walk();
init_sort();
import { join as join15 } from "path";
var Bytes = class {
  buf;
  len = 0;
  constructor(capacity = 64) {
    this.buf = new Uint8Array(capacity);
  }
  get length() {
    return this.len;
  }
  grow(need) {
    if (this.len + need <= this.buf.length) return;
    let cap = this.buf.length * 2 || 64;
    while (cap < this.len + need) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }
  // Rewind without releasing the buffer, so a per-item scratch sink is
  // allocated once per document instead of once per occurrence/symbol.
  reset() {
    this.len = 0;
  }
  push(byte) {
    this.grow(1);
    this.buf[this.len++] = byte;
  }
  pushAll(src) {
    this.grow(src.length);
    if (src instanceof Uint8Array) this.buf.set(src, this.len);
    else for (let i2 = 0; i2 < src.length; i2++) this.buf[this.len + i2] = src[i2];
    this.len += src.length;
  }
  // A view over exactly the bytes written — no copy. Callers must not retain it
  // across further writes to this sink.
  view() {
    return this.buf.subarray(0, this.len);
  }
  toUint8Array() {
    return this.buf.slice(0, this.len);
  }
};
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
  out2.pushAll(payload);
}
function pushMessage(out2, field, payload) {
  pushLenDelim(out2, field, payload.view());
}
function pushString(out2, field, s) {
  pushLenDelim(out2, field, utf8.encode(s));
}
function pushPackedInt32(out2, field, values) {
  const payload = new Bytes(values.length * 2);
  for (const v of values) pushVarint(payload, v);
  pushMessage(out2, field, payload);
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
function fileNamespace(rel2) {
  return "`" + rel2.replace(/`/g, "``") + "`/";
}
function parentDescriptor(parent) {
  return escapeId(parent) + "#";
}
var TYPE_KINDS2 = /* @__PURE__ */ new Set(["class", "interface", "enum", "struct", "trait", "type"]);
var METHOD_KINDS = /* @__PURE__ */ new Set(["function", "method", "def"]);
function suffixFor(kind) {
  if (TYPE_KINDS2.has(kind)) return "#";
  if (METHOD_KINDS.has(kind)) return "().";
  return ".";
}
function baseSymbol(rel2, sym) {
  let s = SYMBOL_PREFIX + fileNamespace(rel2);
  if (sym.parent) s += parentDescriptor(sym.parent);
  return s + escapeId(sym.name) + suffixFor(sym.kind);
}
function enclosingSymbolOf(rel2, parent) {
  return SYMBOL_PREFIX + fileNamespace(rel2) + parentDescriptor(parent);
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
var REFERENCE_KINDS6 = /* @__PURE__ */ new Set(["reexport", "reexport-all", "default"]);
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
      if (sym.exported && !REFERENCE_KINDS6.has(sym.kind)) {
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
  const documents = [];
  for (const f of docs) {
    const text = readText(join15(scan2.root, f.rel));
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
    const doc = new Bytes(1024);
    pushString(doc, F_DOC_RELPATH, f.rel);
    const ob = new Bytes(64);
    for (const o of occs) {
      const key = `${o.range.join(",")} ${o.roles} ${o.symbol}`;
      if (seenOcc.has(key)) continue;
      seenOcc.add(key);
      ob.reset();
      pushPackedInt32(ob, F_OCC_RANGE, o.range);
      pushString(ob, F_OCC_SYMBOL, o.symbol);
      if (o.roles !== 0) pushVarintField(ob, F_OCC_ROLES, o.roles);
      pushMessage(doc, F_DOC_OCCURRENCES, ob);
    }
    const sb = new Bytes(64);
    for (const si of infos) {
      sb.reset();
      pushString(sb, F_SI_SYMBOL, si.symbol);
      if (si.kind !== void 0) pushVarintField(sb, F_SI_KIND, si.kind);
      pushString(sb, F_SI_DISPLAY_NAME, si.displayName);
      if (si.enclosing) pushString(sb, F_SI_ENCLOSING, si.enclosing);
      pushMessage(doc, F_DOC_SYMBOLS, sb);
    }
    pushString(doc, F_DOC_LANGUAGE, f.lang);
    pushVarintField(doc, F_DOC_POSITION_ENCODING, POSITION_ENCODING_UTF16);
    documents.push(doc);
  }
  const toolInfo = new Bytes();
  pushString(toolInfo, F_TOOL_NAME, "codeindex");
  pushString(toolInfo, F_TOOL_VERSION, toolVersion);
  const metadata2 = new Bytes();
  pushMessage(metadata2, F_META_TOOL_INFO, toolInfo);
  pushString(metadata2, F_META_PROJECT_ROOT, projectRoot);
  pushVarintField(metadata2, F_META_TEXT_ENCODING, TEXT_ENCODING_UTF8);
  let total = 0;
  for (const d of documents) total += d.length;
  const index = new Bytes(total + metadata2.length + 16);
  pushMessage(index, F_INDEX_METADATA, metadata2);
  for (const d of documents) pushMessage(index, F_INDEX_DOCUMENTS, d);
  return index.toUint8Array();
}

// src/engine.ts
init_pipeline();
init_git();
init_grep();
init_bm25();
init_model();
init_encode();
init_embed();
init_search();
init_endpoint();
init_onboard();
init_lsp();
init_config2();
init_client();
init_spawn();
init_protocol();
init_refs();
init_rules();
init_coupling();
init_repomap();
init_deadcode();
init_literals2();
init_complexity();
init_viz();

// src/traverse.ts
init_sort();
var DEPENDS_KINDS = /* @__PURE__ */ new Set(["import", "use", "call"]);
function hubThreshold(degrees) {
  const sorted = degrees.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const p99 = n === 0 ? 0 : sorted[Math.min(n - 1, Math.floor(0.99 * n))];
  return Math.max(50, p99);
}
function reverseClosure(edges, seeds, depth = Infinity) {
  const dependents = /* @__PURE__ */ new Map();
  for (const e of edges) {
    if (e.dangling || !DEPENDS_KINDS.has(e.kind)) continue;
    let arr = dependents.get(e.to);
    if (!arr) dependents.set(e.to, arr = []);
    arr.push(e);
  }
  const depthOf = /* @__PURE__ */ new Map();
  const seen = new Set(seeds);
  let frontier = [...seeds];
  for (let d = 1; d <= depth && frontier.length; d++) {
    const next = [];
    for (const node of frontier) {
      for (const e of (dependents.get(node) ?? []).slice().sort((a, b) => byStr(a.from, b.from))) {
        if (seen.has(e.from)) continue;
        seen.add(e.from);
        depthOf.set(e.from, d);
        next.push(e.from);
      }
    }
    frontier = next;
  }
  return depthOf;
}
function impactOf(graph, target, depth = Infinity) {
  const moduleOf = new Map(graph.files.map((f) => [f.rel, f.module]));
  const mod = graph.modules.find((m) => m.slug === target);
  const file = mod ? void 0 : graph.files.find((f) => f.rel === target);
  if (!mod && !file) return void 0;
  const seeds = mod ? mod.members : [file.rel];
  const depthOf = reverseClosure(graph.fileEdges, seeds, depth);
  const files = [...depthOf.entries()].map(([rel2, d]) => ({ rel: rel2, module: moduleOf.get(rel2) ?? "root", depth: d })).sort((a, b) => a.depth - b.depth || byStr(a.rel, b.rel));
  const modules = [...new Set(files.map((f) => f.module).filter((m) => m !== target))].sort(byStr);
  return { target, scope: mod ? "module" : "file", seeds, files, modules };
}
function bfs(edges, start2, depth, kinds) {
  const out2 = /* @__PURE__ */ new Map();
  const inn = /* @__PURE__ */ new Map();
  const degree = /* @__PURE__ */ new Map();
  for (const e of edges) {
    if (e.dangling) continue;
    if (kinds && !kinds.has(e.kind)) continue;
    (out2.get(e.from) ?? out2.set(e.from, []).get(e.from)).push(e);
    (inn.get(e.to) ?? inn.set(e.to, []).get(e.to)).push(e);
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  const threshold = hubThreshold([...degree.values()]);
  const seen = /* @__PURE__ */ new Set([start2]);
  const links = [];
  let frontier = [start2];
  for (let d = 1; d <= depth; d++) {
    const next = [];
    for (const node of frontier) {
      if (node !== start2 && (degree.get(node) ?? 0) >= threshold) continue;
      for (const e of (out2.get(node) ?? []).slice().sort((a, b) => byStr(a.to, b.to))) {
        if (seen.has(e.to)) continue;
        links.push({ node: e.to, direction: "out", kind: e.kind, weight: e.weight, depth: d, confidence: e.confidence });
        seen.add(e.to);
        next.push(e.to);
      }
      for (const e of (inn.get(node) ?? []).slice().sort((a, b) => byStr(a.from, b.from))) {
        if (seen.has(e.from)) continue;
        links.push({ node: e.from, direction: "in", kind: e.kind, weight: e.weight, depth: d, confidence: e.confidence });
        seen.add(e.from);
        next.push(e.from);
      }
    }
    frontier = next;
  }
  return links;
}
function neighborsOf(graph, target, depth = 1, kinds) {
  const mod = graph.modules.find((m) => m.slug === target);
  if (mod) {
    return { target, scope: "module", links: bfs(graph.moduleEdges, target, depth, kinds), members: mod.members };
  }
  const file = graph.files.find((f) => f.rel === target);
  if (file) {
    return { target, scope: "file", links: bfs(graph.fileEdges, target, depth, kinds) };
  }
  return void 0;
}

// src/delta.ts
init_git();
init_sort();
init_walk();
init_util();
var RISK_WEIGHTS = {
  exportedChange: 25,
  // an exported symbol changed: consumers may break
  hubHigh: 20,
  // pagerank percentile ≥ .90
  hubMed: 10,
  // pagerank percentile ≥ .75
  blastHigh: 20,
  // ≥ 20 dependent files or ≥ 5 dependent modules
  blastMed: 10,
  // ≥ 5 dependent files
  testGap: 20,
  // a testable module with no covering test
  surprise: 10,
  // the module sits on a surprising cross-community edge
  dangling: 15
  // a changed file carries a dangling import
};
var HIGH_MIN = 60;
var MEDIUM_MIN = 30;
var OPEN_CAP = 3;
var DEFAULT_DELTA_DEPTH = 2;
function symbolsInHunks(defs, hunks) {
  const out2 = [];
  const seen = /* @__PURE__ */ new Set();
  const push = (d, approx) => {
    const key = `${d.name}:${d.line}`;
    if (seen.has(key)) return;
    seen.add(key);
    out2.push({
      name: d.name,
      kind: d.kind,
      exported: d.exported,
      line: d.line,
      ...d.endLine !== void 0 ? { endLine: d.endLine } : {},
      ...d.parent !== void 0 ? { parent: d.parent } : {},
      ...approx ? { approx: true } : {}
    });
  };
  const span = (d) => (d.endLine ?? d.line) - d.line;
  for (const h of hunks) {
    const enclosing = defs.filter((d) => d.line <= h.end && (d.endLine ?? d.line) >= h.start);
    if (enclosing.length) {
      enclosing.sort((a, b) => span(a) - span(b) || b.line - a.line || byStr(a.name, b.name));
      for (const d of enclosing) push(d, false);
    } else {
      const above = defs.filter((d) => d.line <= h.start && d.endLine === void 0);
      const near = above[above.length - 1];
      if (near) push(near, true);
    }
  }
  return out2;
}
function percentile(values, mine) {
  if (values.length <= 1) return 0;
  let smaller = 0;
  for (const v of values) if (v < mine) smaller++;
  return smaller / (values.length - 1);
}
function computeDelta(graph, symbols, diff, depth = DEFAULT_DELTA_DEPTH) {
  const notes = [...diff.notes ?? []];
  if (!symbols) notes.push("symbol index missing \u2014 symbol-level attribution disabled");
  const fileByRel = new Map(graph.files.map((f) => [f.rel, f]));
  const defsByFile = /* @__PURE__ */ new Map();
  if (symbols) {
    for (const [name2, entries] of Object.entries(symbols.defs)) {
      for (const d of entries) {
        let arr = defsByFile.get(d.file);
        if (!arr) defsByFile.set(d.file, arr = []);
        arr.push({ name: name2, ...d });
      }
    }
    for (const arr of defsByFile.values()) arr.sort((a, b) => a.line - b.line || byStr(a.name, b.name));
  }
  const deleted = [];
  const unindexed = [];
  const changes = [];
  for (const df of [...diff.files].sort((a, b) => byStr(a.path, b.path))) {
    const carry = {
      ...df.oldPath !== void 0 ? { oldPath: df.oldPath } : {},
      ...df.binary ? { binary: true } : {},
      ...df.linesAdded !== void 0 ? { linesAdded: df.linesAdded } : {},
      ...df.linesDeleted !== void 0 ? { linesDeleted: df.linesDeleted } : {}
    };
    if (df.status === "deleted") {
      deleted.push(df.path);
      changes.push({ path: df.path, status: df.status, ...carry, hunks: [], symbols: [] });
      continue;
    }
    const node = fileByRel.get(df.path);
    if (!node) {
      unindexed.push(df.path);
      continue;
    }
    let hunks = diff.hunks.get(df.path) ?? [];
    if (!hunks.length && df.status === "added" && !df.binary) hunks = [{ start: 1, end: Math.max(node.lines, 1) }];
    const syms = df.binary ? [] : symbolsInHunks(defsByFile.get(df.path) ?? [], hunks);
    changes.push({
      path: df.path,
      status: df.status,
      ...carry,
      module: node.module,
      hunks: hunks.map((h) => ({ start: h.start, end: h.end })),
      symbols: syms
    });
  }
  const changedRels = new Set(changes.filter((c2) => c2.status !== "deleted").map((c2) => c2.path));
  const dangling = graph.fileEdges.filter((e) => e.dangling && (e.kind === "import" || e.kind === "doc-link") && changedRels.has(e.from)).map((e) => ({ from: e.from, spec: e.to, reason: e.reason ?? "unknown" })).sort((a, b) => byStr(a.from, b.from) || byStr(a.spec, b.spec));
  const intoIgnoredTree = (from, spec) => {
    if (!spec.startsWith(".")) return false;
    const segs = from.split("/").slice(0, -1);
    for (const part of spec.split("/")) {
      if (part === "." || part === "") continue;
      if (part === "..") segs.pop();
      else segs.push(part);
    }
    return segs.some((seg) => IGNORE_DIRS.has(seg));
  };
  const byModule = /* @__PURE__ */ new Map();
  for (const c2 of changes) {
    if (c2.status === "deleted" || !c2.module) continue;
    let arr = byModule.get(c2.module);
    if (!arr) byModule.set(c2.module, arr = []);
    arr.push(c2);
  }
  const nonTestCode = /* @__PURE__ */ new Set();
  for (const f of graph.files) {
    if (f.fileKind === "code" && !f.testFile) nonTestCode.add(f.module);
  }
  const pagerankKnown = graph.modules.some((m) => m.pagerank !== void 0);
  const metricOf = (m) => pagerankKnown ? m.pagerank ?? 0 : m.degIn + m.degOut;
  const metricValues = graph.modules.map(metricOf);
  const metricName = pagerankKnown ? "pagerank" : "degree";
  const modules = [];
  for (const slug of [...byModule.keys()].sort(byStr)) {
    const m = graph.modules.find((x) => x.slug === slug);
    if (!m) continue;
    const moduleChanges = byModule.get(slug);
    const reasons = [];
    let score = 0;
    const exportedNames = [...new Set(moduleChanges.flatMap((c2) => c2.symbols.filter((s) => s.exported).map((s) => s.name)))].sort(byStr);
    if (exportedNames.length) {
      score += RISK_WEIGHTS.exportedChange;
      const shown = exportedNames.slice(0, 3).join(", ") + (exportedNames.length > 3 ? ", \u2026" : "");
      reasons.push(exportedNames.length === 1 ? `exported symbol ${shown} changed` : `exported symbols ${shown} changed`);
    }
    const pct = percentile(metricValues, metricOf(m));
    if (pct >= 0.9) {
      score += RISK_WEIGHTS.hubHigh;
      reasons.push(`${metricName} p${Math.round(pct * 100)} hub`);
    } else if (pct >= 0.75) {
      score += RISK_WEIGHTS.hubMed;
      reasons.push(`${metricName} p${Math.round(pct * 100)} hub`);
    }
    const depthByRel = /* @__PURE__ */ new Map();
    const impModules = /* @__PURE__ */ new Set();
    for (const c2 of moduleChanges) {
      const imp = impactOf(graph, c2.path, depth);
      if (!imp) continue;
      for (const f of imp.files) {
        const prev = depthByRel.get(f.rel);
        if (prev === void 0 || f.depth < prev) depthByRel.set(f.rel, f.depth);
      }
      for (const im of imp.modules) if (im !== slug) impModules.add(im);
    }
    const transitiveFiles = depthByRel.size;
    const directFiles = [...depthByRel.values()].filter((d) => d === 1).length;
    const impact = { directFiles, transitiveFiles, modules: [...impModules].sort(byStr) };
    if (transitiveFiles >= 20 || impact.modules.length >= 5) {
      score += RISK_WEIGHTS.blastHigh;
      reasons.push(`${transitiveFiles} dependent files across ${impact.modules.length} modules (depth ${depth})`);
    } else if (transitiveFiles >= 5) {
      score += RISK_WEIGHTS.blastMed;
      reasons.push(`${transitiveFiles} dependent files across ${impact.modules.length} modules (depth ${depth})`);
    }
    const testable = m.tier <= 1 && m.symbols > 0 && nonTestCode.has(slug);
    const coveredBy = m.testedBy ?? [];
    const tests = testable ? coveredBy.length ? { status: "covered", files: coveredBy } : { status: "gap", files: [] } : { status: "n/a", files: [] };
    if (tests.status === "gap") {
      score += RISK_WEIGHTS.testGap;
      reasons.push("no test covers this module");
    }
    const sup = (graph.surprises ?? []).find((s) => s.from === slug || s.to === slug);
    if (sup) {
      score += RISK_WEIGHTS.surprise;
      reasons.push(`cross-community edge to ${sup.from === slug ? sup.to : sup.from} (surprising)`);
    }
    const moduleDangling = dangling.filter(
      (d) => moduleChanges.some((c2) => c2.path === d.from) && !intoIgnoredTree(d.from, d.spec)
    );
    if (moduleDangling.length) {
      score += RISK_WEIGHTS.dangling;
      const first = moduleDangling[0];
      const more = moduleDangling.length > 1 ? ` (+${moduleDangling.length - 1} more)` : "";
      reasons.push(`dangling import "${first.spec}" in ${first.from}${more}`);
    }
    score = Math.min(100, score);
    const changedFiles = moduleChanges.map((c2) => c2.path).sort(byStr);
    const allSyms = moduleChanges.flatMap((c2) => c2.symbols);
    const open = moduleChanges.slice().sort(
      (a, b) => b.symbols.filter((s) => s.exported).length - a.symbols.filter((s) => s.exported).length || b.symbols.length - a.symbols.length || byStr(a.path, b.path)
    ).slice(0, OPEN_CAP).map((c2) => c2.path);
    modules.push({
      slug,
      path: m.path,
      score,
      bucket: score >= HIGH_MIN ? "HIGH" : score >= MEDIUM_MIN ? "MEDIUM" : "LOW",
      reasons,
      changedFiles,
      changedSymbols: {
        total: new Set(allSyms.map((s) => `${s.name}:${s.line}`)).size,
        exported: new Set(allSyms.filter((s) => s.exported).map((s) => `${s.name}:${s.line}`)).size
      },
      impact,
      tests,
      open
    });
  }
  modules.sort((a, b) => b.score - a.score || byStr(a.slug, b.slug));
  return {
    base: diff.base,
    ...graph.commit !== void 0 ? { indexCommit: graph.commit } : {},
    depth,
    changes,
    modules,
    dangling,
    deleted: deleted.sort(byStr),
    unindexed: unindexed.sort(byStr),
    notes
  };
}
function deltaFor(repo, graph, symbols, opts = {}) {
  if (!have("git")) return { error: "git is required for delta and was not found on PATH" };
  if (!isGitWorktree(repo)) return { error: `delta needs a git worktree \u2014 ${repo} is not inside one` };
  const notes = [];
  let base;
  if (opts.staged) {
    const head = sh("git", ["-C", repo, "rev-parse", "HEAD"]);
    if (!head.ok) return { error: "cannot resolve HEAD \u2014 empty repository?" };
    base = { ref: "HEAD", mergeBase: head.stdout.trim(), staged: true };
  } else {
    const r = resolveBaseRef(repo, opts.base);
    if ("error" in r) return { error: r.error };
    if (r.note) notes.push(r.note);
    base = { ref: r.ref, mergeBase: r.mergeBase, staged: false };
  }
  const spec = opts.staged ? { staged: true } : { mergeBase: base.mergeBase };
  const files = diffFiles(repo, spec);
  if (!opts.staged) {
    const known = new Set(files.map((f) => f.path));
    for (const u of untrackedFiles(repo)) {
      if (!known.has(u)) files.push({ path: u, status: "added" });
    }
  }
  return computeDelta(graph, symbols, { files, hunks: diffHunks(repo, spec), base, notes }, opts.depth ?? DEFAULT_DELTA_DEPTH);
}
function formatDeltaPanel(res) {
  const mb = res.base.mergeBase.slice(0, 7);
  const vs = `${res.base.staged ? "staged vs " : ""}${res.base.ref}`;
  if (!res.changes.length && !res.unindexed.length) {
    return `codeindex: no changes vs ${vs} (merge-base ${mb})
`;
  }
  const changedCount = res.changes.length + res.unindexed.length;
  const lines = [
    `codeindex: delta vs ${vs} (merge-base ${mb}) \u2014 ${changedCount} changed file(s), ${res.modules.length} module(s)${res.indexCommit ? `, index @ ${res.indexCommit}` : ""}`
  ];
  for (const n of res.notes) lines.push(`  note: ${n}`);
  for (const m of res.modules) {
    lines.push(`  ${m.bucket.padEnd(6)} ${m.slug}  score ${m.score}${m.reasons.length ? ` \u2014 ${m.reasons.join("; ")}` : ""}`);
    const tests = m.tests.status === "gap" ? "GAP" : m.tests.status === "covered" ? `covered (${m.tests.files.length})` : "n/a";
    lines.push(`         open: ${m.open.join(", ") || "\u2014"} \xB7 tests: ${tests}`);
  }
  if (res.dangling.length) {
    lines.push(`  dangling:  ${res.dangling.map((d) => `${d.spec} (from ${d.from})`).join(" \xB7 ")}`);
  }
  if (res.deleted.length) lines.push(`  deleted:   ${res.deleted.join(", ")}`);
  if (res.unindexed.length) lines.push(`  unindexed: ${res.unindexed.join(", ")}`);
  return lines.join("\n") + "\n";
}

// src/engine.ts
init_mcp();
init_rewrite();
init_hash();
init_sort();
init_util();

// src/engine-cli.ts
init_types();
init_types();
init_loader();
import { existsSync as existsSync10, mkdirSync as mkdirSync3, readFileSync as readFileSync13, writeFileSync as writeFileSync4 } from "fs";
import { join as join23, resolve as resolve4 } from "path";
init_pipeline();
init_hash();
init_graph_json();
init_symbols_json();
init_scan();
init_preload();
init_walk();
init_relations();
init_callers();
init_symbolgraph();
init_callers();
init_workspaces();
init_git();
init_grep();
init_coupling();
init_repomap();
init_deadcode();
init_literals2();
init_complexity();
init_viz();
init_bm25();
init_rules();
init_model();
init_embed();
init_search();
init_endpoint();
init_util();
init_lsp();
init_tools();
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
  hierarchy   Type hierarchy: extends/implements, and what extends/implements it
  implementations  Everything implementing/extending a type (transitively)
  callgraph   Bounded symbol-to-symbol neighborhood (--depth, --direction)
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
  lsp         Optional LSP tier (opt-in by asset \u2014 the tier is active only when
              <repo>/.codeindex/lsp.json exists, or CODEINDEX_LSP_CONFIG points
              at one). It annotates QUERY answers only and never touches
              graph.json/symbols.json:
                lsp status     Config path and source, each server with whether
                               its command is on PATH and how many files it
                               claims, and the languages nothing covers (JSON).
                               --probe also starts each server to read the
                               capabilities it really advertises
  grammars    Tree-sitter wasm grammars (optional AST tier; regex without them).
              Two tiers: CORE ships with the bundle; EXTENDED (kotlin, elixir,
              zig, solidity, hcl/terraform) arrives only via \`grammars pull\`.
              Precedence: bundle-adjacent > CODEINDEX_GRAMMARS_DIR > shared cache:
                grammars status  Active tier (adjacent/env/cache/none), resolved
                                 dir, pinned ENGINE_VERSION, pull-needed (JSON)
                grammars pull    Fetch the per-release grammars-<version>.tar.gz
                                 asset into the shared cache (sha256-verified,
                                 atomic). Override the source with
                                 CODEINDEX_GRAMMARS_URL
  rules       Architecture rules (forbidden edges, cycles, orphans, literals)
              validated against the link-graph: --config <codeindex.rules.json>;
              exits 1 on any error-severity violation (a CI gate)
  repomap     Token-budgeted map of the highest-PageRank files (--budget-tokens)
  hotspots    Churn \xD7 size ranking of the files where work concentrates (JSON)
  coupling    Change coupling: files that change together (JSON; --since <ref>)
  literals    Values with no single source of truth: one literal written out
              across many files, in three labeled tiers \u2014 'competing' (two or
              more exported constants hold it), 'bypassed' (a constant holds
              it and other files rewrite it anyway), 'uncentralized' (nothing
              holds it). Groups path-like values into namespace families so a
              whole route space reports once, not forty times. Reads code AND
              config files (JSON/YAML/TOML), because the duplications that hurt
              are the ones crossing a language boundary no compiler checks.
              (--min-files, --min-count, --include-tests)
  deadcode    Dead-code candidates in two labeled tiers: 'unreferenced' (no
              call site binds AND nothing references the name) and 'uncalled'
              (referenced \u2014 re-export, type position \u2014 but never called)
  complexity  Cyclomatic-complexity estimates, most-complex first. Pass a file
              positional for one file; omit for the repo-wide top
  risk        Complexity \xD7 git-churn ranking (JSON; --since <ref> to bound)
  delta       Review panel for the git diff: changed files -> enclosing symbols ->
              blast radius -> risk score with explained reasons
              (--base <ref> | --staged, --depth <n>, --json)
  impact      Reverse dependency closure of a file or module: everything that
              transitively imports/uses/calls it (--depth <n>; JSON)
  neighbors   Graph neighbours of a file or module, both directions
              (--depth <n>, --kind import,call,use,doc-link,mention; JSON)
  mermaid     Mermaid diagram of the module graph; pass a module positional to
              focus on one neighborhood
  rewrite     Map an expensive tree-wide search onto its indexed equivalent:
              cli.mjs rewrite '<command line>'. Prints the replacement command
              and exits 0, or exits 1 when it has no opinion (run the original).
              Deliberately conservative \u2014 any shell metacharacter or unknown
              flag refuses the rewrite
  mcp         Run as an MCP server over stdio (33 tools: scan_summary, graph,
              symbols, callers, workspaces, churn, symbols_overview,
              find_symbol, find_references, lsp_status, onboard, repo_map,
              hotspots, coupling, dead_code, complexity, mermaid, grep, search,
              explain_search, embed_status, check_rules, the memory quartet and
              the three symbolic-edit writes). Flags: --repo <dir> pins ONE
              repository so the per-tool repo argument becomes optional (an
              explicit per-call repo still wins); --server-name <name> overrides
              the announced serverInfo; --max-response-bytes <n> caps a single
              tool response (default 1e6; a response under the cap is
              byte-identical, one over it is replaced by an actionable notice
              instead of an unusable blob); --tools <profile[,profile]>
              advertises a named subset (all | orient | find | impact | edit |
              risk, default all) \u2014 every advertised tool's schema costs an agent
              context on EVERY turn, and a tool left out is still answerable
              when called by name
  version     Print the engine version

Flags (accepted before OR after the subcommand: '--repo X scan' and
'scan --repo X' are equivalent):
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
  --max-files <n>     Cap walked files (default: none \u2014 the whole tree is
                      indexed; a cap sets the \`capped\` flag)
  --max-bytes <n>     Skip files above this size (default 1 MiB)
  --max-calls <n>     Per-file call-site cap for extraction (default 512)
  --no-ast            Skip tree-sitter grammars even when present (regex tier)
  --workers <n>       \`index\`: extraction worker threads (default: cores-1,
                      capped at 8; 0 or 1 forces the single-threaded path).
                      Also settable with CODEINDEX_WORKERS. Artifacts are
                      byte-identical either way
  --index <dir>       Persisted index the READ commands reuse, relative to the
                      repo (default .codeindex \u2014 i.e. what \`index --out\` wrote
                      there). A fresh index turns the scan into a stat pass and,
                      when it still matches the worktree, skips the pipeline
                      entirely. Stale/absent/corrupt \u2192 a normal cold build
  --no-index-cache    Never reuse a persisted index; always build from scratch
  --config <file>     Rules config for \`rules\` (JSON: [{name, from, to, \u2026}])
  --limit <n>         Max results for \`search\` (default 20)
  --no-fuzzy          \`search\`: disable trigram fuzzy fallback for query terms
                      with zero document frequency (default: enabled)
  --exact             \`search\`: drop results that carry no verbatim term match
                      (the ones the stem/trigram bridge produced)
  --explain           \`search\`: emit { results, explain } \u2014 which terms matched,
                      which bridged, and whether the query really found anything
  --semantic          \`search\`: RRF-fuse an embedding tier with lexical \u2014 the
                      HTTP endpoint if CODEINDEX_EMBED_ENDPOINT is set, else a
                      local static model (lexical-only when neither is available)
  --run               \`embed serve\`: run the docker command instead of printing it
  --probe             \`lsp status\`: start each server and read the capabilities
                      it really advertises (default: no spawn)
  --recall            \`callers\`: recall-oriented binding (issue #7) \u2014 relaxes
                      the JS/TS import gate to unique repo-wide names and labels
                      each site corroborated|unique-name
  --ignore-case       \`grep\`: case-insensitive matching
  --max-hits <n>      \`grep\`: cap returned hits (default 200)
  --min-files <n>     \`literals\`: distinct files a value must span (default 2)
  --min-count <n>     \`literals\`: total occurrences required (default 3)
  --include-tests     \`literals\`: count test files too. Off by default \u2014 a test
                      restating a value is usually asserting it deliberately
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
    const num2 = () => {
      const raw = next();
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`${a} expects a positive number, got "${raw}"`);
      return n;
    };
    if (a === "--repo") flags2.repo = resolve4(next());
    else if (a === "--out") {
      const v = next();
      flags2.out = v === "-" ? "-" : resolve4(v);
    } else if (a === "--project-root") flags2.projectRoot = next();
    else if (a === "--include") flags2.include.push(next());
    else if (a === "--exclude") flags2.exclude.push(next());
    else if (a === "--scope") flags2.scope = next();
    else if (a === "--no-gitignore") flags2.gitignore = false;
    else if (a === "--ignore-dir") flags2.ignoreDirs.push(next());
    else if (a === "--max-files") flags2.maxFiles = num2();
    else if (a === "--max-bytes") flags2.maxBytes = num2();
    else if (a === "--max-calls") flags2.maxCalls = num2();
    else if (a === "--ignore-case") flags2.ignoreCase = true;
    else if (a === "--max-hits") flags2.maxHits = num2();
    else if (a === "--budget-tokens") flags2.budgetTokens = num2();
    else if (a === "--min-files") flags2.minFiles = num2();
    else if (a === "--min-count") flags2.minCount = num2();
    else if (a === "--include-tests") flags2.includeTests = true;
    else if (a === "--no-ast") flags2.noAst = true;
    else if (a === "--index") flags2.indexDir = next();
    else if (a === "--no-index-cache") flags2.noIndexCache = true;
    else if (a === "--workers") {
      const raw = next();
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) throw new Error(`--workers expects a non-negative integer, got "${raw}"`);
      flags2.workers = n;
    } else if (a === "--since") flags2.since = next();
    else if (a === "--config") flags2.config = resolve4(next());
    else if (a === "--limit") flags2.limit = num2();
    else if (a === "--no-fuzzy") flags2.fuzzy = false;
    else if (a === "--exact") flags2.exact = true;
    else if (a === "--explain") flags2.explain = true;
    else if (a === "--semantic") flags2.semantic = true;
    else if (a === "--recall") flags2.recall = true;
    else if (a === "--run") flags2.run = true;
    else if (a === "--probe") flags2.probe = true;
    else if (a === "--base") flags2.base = next();
    else if (a === "--staged") flags2.staged = true;
    else if (a === "--depth") flags2.depth = num2();
    else if (a === "--kind") flags2.kind = next();
    else if (a === "--rank") {
      const v = next();
      if (v !== "graph" && v !== "lexical") throw new Error(`--rank expects graph|lexical, got "${v}"`);
      flags2.rank = v;
    } else if (a === "--direction") {
      const v = next();
      if (v !== "out" && v !== "in" && v !== "both") throw new Error(`--direction expects out|in|both, got "${v}"`);
      flags2.direction = v;
    } else if (a === "--json") flags2.json = true;
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
  let maxResponseBytes;
  let profile;
  for (let i2 = 0; i2 < argv.length; i2++) {
    const a = argv[i2];
    if (a === "--repo") {
      const v = argv[++i2];
      if (!v) throw new Error("--repo requires a directory");
      defaultRepo = resolve4(v);
    } else if (a === "--server-name") {
      const v = argv[++i2];
      if (!v) throw new Error("--server-name requires a value");
      name2 = v;
    } else if (a === "--max-response-bytes") {
      const v = argv[++i2];
      const n = Number(v);
      if (!v || !Number.isFinite(n) || n <= 0) throw new Error("--max-response-bytes requires a positive number");
      maxResponseBytes = n;
    } else if (a === "--tools") {
      const v = argv[++i2];
      if (!v) throw new Error(`--tools requires a profile: ${profileNames().join(", ")}`);
      toolsInProfiles(v);
      profile = v === "all" ? void 0 : v;
    } else {
      throw new Error(`unknown flag for \`mcp\`: ${a}`);
    }
  }
  if (defaultRepo && !existsSync10(defaultRepo)) throw new Error(`--repo path does not exist: ${defaultRepo}`);
  return { defaultRepo, serverInfo: name2 ? { name: name2 } : void 0, maxResponseBytes, profile };
}
var VALUE_FLAGS = /* @__PURE__ */ new Set([
  "--repo",
  "--out",
  "--project-root",
  "--include",
  "--exclude",
  "--scope",
  "--ignore-dir",
  "--max-files",
  "--max-bytes",
  "--max-calls",
  "--max-hits",
  "--budget-tokens",
  "--min-files",
  "--min-count",
  "--since",
  "--config",
  "--limit",
  "--server-name",
  "--tools",
  "--workers",
  "--index",
  "--max-response-bytes"
]);
function hoistLeadingFlags(argv) {
  const lead = [];
  let i2 = 0;
  while (i2 < argv.length) {
    const a = argv[i2];
    if (a === void 0 || !a.startsWith("-")) break;
    lead.push(a);
    i2++;
    if (VALUE_FLAGS.has(a) && i2 < argv.length) {
      lead.push(argv[i2]);
      i2++;
    }
  }
  if (lead.length === 0 || i2 >= argv.length) return argv;
  return [argv[i2], ...lead, ...argv.slice(i2 + 1)];
}
async function runCli(rawArgv) {
  const argv = hoistLeadingFlags(rawArgv);
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
  if (!existsSync10(flags2.repo)) throw new Error(`--repo path does not exist: ${flags2.repo}`);
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
  const indexDir = flags2.indexDir ?? INDEX_DIR;
  let preloadTried = false;
  let preloaded;
  const tryPreload = () => {
    if (preloadTried) return preloaded;
    preloadTried = true;
    if (flags2.noIndexCache) return void 0;
    const p = preloadSession(flags2.repo, scanOptions(flags2, precomputedWalk), indexDir);
    if (p) preloaded = { scan: p.scan, arts: p.arts };
    return preloaded;
  };
  const readScan = () => tryPreload()?.scan ?? scanRepo(flags2.repo, scanOptions(flags2, precomputedWalk));
  const readArtifacts = () => {
    const p = tryPreload();
    if (p?.arts) return p.arts;
    if (p) return buildArtifactsFromScan(p.scan, scanOptions(flags2, precomputedWalk));
    return buildIndexArtifacts(flags2.repo, scanOptions(flags2, precomputedWalk));
  };
  if (cmd === "index") {
    if (!flags2.out) throw new Error("index needs --out <dir>");
    const outDir = flags2.out;
    mkdirSync3(outDir, { recursive: true });
    const cachePath = join23(outDir, "cache.json");
    let cache;
    let meta = {};
    try {
      const parsed = JSON.parse(readFileSync13(cachePath, "utf8"));
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
    const scan2 = await scanRepoParallel(flags2.repo, {
      ...scanOptions(flags2, precomputedWalk),
      cache,
      out: outDir,
      workers: flags2.workers
    });
    const modelDir = resolveEmbedModelDir(flags2.repo);
    const model = modelDir ? loadEmbedModel(modelDir) : void 0;
    const graphPath = join23(outDir, "graph.json");
    const symbolsPath = join23(outDir, "symbols.json");
    const embedPath = join23(outDir, "embeddings.bin");
    const artifactSha = (path) => {
      try {
        return sha1(readFileSync13(path));
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
    const s = scanSummary(flags2.repo, scanOptions(flags2, precomputedWalk));
    const summary = {
      engineVersion: ENGINE_VERSION,
      commit: s.commit,
      fileCount: s.fileCount,
      languages: s.languages,
      capped: s.capped
    };
    emit(JSON.stringify(summary, null, 2) + "\n", flags2.out);
  } else if (cmd === "graph") {
    const { graph } = readArtifacts();
    emit(renderGraphJson(graph), flags2.out);
  } else if (cmd === "symbols") {
    const { symbols } = readArtifacts();
    emit(renderSymbolsJson(symbols), flags2.out);
  } else if (cmd === "scip") {
    const scan2 = readScan();
    const bytes = renderScip(scan2, { projectRoot: flags2.projectRoot });
    const out2 = flags2.out ?? resolve4("index.scip");
    if (out2 === "-") process.stdout.write(Buffer.from(bytes));
    else {
      writeFileSync4(out2, bytes);
      process.stderr.write(`codeindex: SCIP index \u2192 ${out2} (${bytes.length} bytes)
`);
    }
  } else if (cmd === "callers") {
    const scan2 = readScan();
    const index = buildCallerIndex(scan2, void 0, { recall: flags2.recall });
    const obj = {};
    for (const [name2, entry] of index) obj[name2] = entry;
    emit(JSON.stringify(obj, null, 2) + "\n", flags2.out);
  } else if (cmd === "hierarchy") {
    const scan2 = readScan();
    const hierarchy = buildTypeHierarchy(scan2, computeImportPairs(scan2));
    if (flags2.positional) {
      const entry = hierarchy.get(flags2.positional);
      if (!entry) throw new Error(`no type named ${flags2.positional}`);
      emit(JSON.stringify(entry, null, 2) + "\n", flags2.out);
    } else {
      const obj = {};
      for (const [key, entry] of hierarchy) obj[key] = entry;
      emit(JSON.stringify(obj, null, 2) + "\n", flags2.out);
    }
  } else if (cmd === "implementations") {
    if (!flags2.positional) throw new Error("implementations needs a type name: cli.mjs implementations <Name> --repo <dir>");
    const scan2 = readScan();
    const hierarchy = buildTypeHierarchy(scan2, computeImportPairs(scan2));
    if (!hierarchy.has(flags2.positional)) throw new Error(`no type named ${flags2.positional}`);
    emit(
      JSON.stringify({ name: flags2.positional, implementations: implementationsOf(hierarchy, flags2.positional) }, null, 2) + "\n",
      flags2.out
    );
  } else if (cmd === "callgraph") {
    if (!flags2.positional) throw new Error("callgraph needs a symbol: cli.mjs callgraph <Symbol> --repo <dir>");
    const scan2 = readScan();
    const graph = buildSymbolGraph(scan2, computeImportPairs(scan2));
    const result = neighborhood(graph, flags2.positional, {
      ...flags2.depth !== void 0 ? { depth: flags2.depth } : {},
      ...flags2.direction ? { direction: flags2.direction } : {}
    });
    if (!result.root.length) throw new Error(`no symbol named ${flags2.positional}`);
    emit(JSON.stringify(result, null, 2) + "\n", flags2.out);
  } else if (cmd === "search") {
    if (!flags2.positional) throw new Error('search needs a query: cli.mjs search "<query>" --repo <dir>');
    const scan2 = readScan();
    const searchOpts = {
      limit: flags2.limit,
      fuzzy: flags2.fuzzy,
      ...flags2.exact ? { exact: true } : {},
      ...flags2.rank ? { rank: flags2.rank } : {}
    };
    const warnIfWeak = () => {
      const { explain } = explainQuery(scan2, flags2.positional, searchOpts);
      if (explain.note) process.stderr.write(`codeindex: ${explain.note}
`);
    };
    if (flags2.semantic) {
      const endpoint = resolveEmbedEndpoint();
      const lexical = () => {
        const results = searchIndex(scan2, flags2.positional, searchOpts);
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
      warnIfWeak();
    } else {
      const { results, explain } = explainQuery(scan2, flags2.positional, searchOpts);
      emit(JSON.stringify(flags2.explain ? { results, explain } : results, null, 2) + "\n", flags2.out);
      if (explain.note) process.stderr.write(`codeindex: ${explain.note}
`);
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
      const scan2 = readScan();
      const index = buildEmbeddingIndex(scan2, model);
      writeFileSync4(join23(flags2.out, "embeddings.bin"), serializeEmbeddings(index));
      process.stderr.write(`codeindex: ${index.records.length} embedding records \u2192 ${flags2.out}/embeddings.bin (model ${model.modelId})
`);
    } else if (sub === "pull") {
      const { url, sha256 } = resolveEmbedPullUrl();
      const destDir = process.env.CODEINDEX_EMBED_DIR ?? join23(flags2.repo, ".codeindex", "models");
      mkdirSync3(destDir, { recursive: true });
      process.stderr.write(`codeindex: fetching model from ${url} \u2192 ${join23(destDir, "model.json")}
`);
      let body2;
      try {
        body2 = await fetchEmbedModel(url, sha256);
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
      writeFileSync4(join23(destDir, "model.json"), body2);
      process.stderr.write(`codeindex: model written to ${join23(destDir, "model.json")}
`);
    } else {
      throw new Error("embed needs a subcommand: status | build | pull | serve");
    }
  } else if (cmd === "lsp") {
    const sub = flags2.positional;
    if (sub !== "status") throw new Error("lsp needs a subcommand: status");
    emit(JSON.stringify(await lspStatus(readScan(), flags2.repo, flags2.probe === true), null, 2) + "\n", flags2.out);
  } else if (cmd === "grammars") {
    const sub = flags2.positional;
    const cacheDir = sharedGrammarsCacheDir();
    if (sub === "status") {
      const info2 = resolveGrammarsTier();
      const present = (name2) => info2.dirs.some((d) => existsSync10(join23(d, name2)));
      const runtimePresent = present("web-tree-sitter.wasm");
      const target = resolveGrammarsPullTarget();
      const resolvedIn = (keys) => [...keys].filter((k) => present(`${k}.wasm`)).sort();
      const core = resolvedIn(CORE_GRAMMARS);
      const extended = resolvedIn(EXTENDED_GRAMMARS);
      const status = {
        engineVersion: ENGINE_VERSION,
        tier: info2.tier,
        dir: info2.dir ?? null,
        dirs: info2.dirs,
        cacheDir,
        runtimePresent,
        pullNeeded: !runtimePresent,
        core: { resolved: core.length, of: CORE_GRAMMARS.size, missing: [...CORE_GRAMMARS].filter((k) => !core.includes(k)).sort() },
        extended: {
          resolved: extended.length,
          of: EXTENDED_GRAMMARS.size,
          missing: [...EXTENDED_GRAMMARS].filter((k) => !extended.includes(k)).sort()
        },
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
    const rules = parseRules(JSON.parse(readFileSync13(flags2.config, "utf8")));
    const { graph } = readArtifacts();
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
    const { scan: scan2, graph } = readArtifacts();
    emit(renderRepoMap(scan2, graph, { budgetTokens: flags2.budgetTokens }), flags2.out);
  } else if (cmd === "hotspots") {
    const scan2 = readScan();
    const { churn, ok } = gitChurn(flags2.repo, { since: flags2.since });
    emit(JSON.stringify({ churnOk: ok, hotspots: rankHotspots(scan2, churn) }, null, 2) + "\n", flags2.out);
  } else if (cmd === "coupling") {
    const { ok, couplings } = changeCoupling(flags2.repo, { since: flags2.since });
    emit(JSON.stringify({ ok, couplings }, null, 2) + "\n", flags2.out);
  } else if (cmd === "deadcode") {
    emit(JSON.stringify(findDeadCode(readScan()), null, 2) + "\n", flags2.out);
  } else if (cmd === "literals") {
    const report = findLiteralDuplications(readScan(), {
      minFiles: flags2.minFiles,
      minCount: flags2.minCount,
      includeTests: flags2.includeTests
    });
    emit(JSON.stringify(report, null, 2) + "\n", flags2.out);
  } else if (cmd === "complexity") {
    const scan2 = readScan();
    emit(JSON.stringify(symbolComplexity(scan2, flags2.positional), null, 2) + "\n", flags2.out);
  } else if (cmd === "risk") {
    const scan2 = readScan();
    const { churn, ok } = gitChurn(flags2.repo, { since: flags2.since });
    emit(JSON.stringify({ churnOk: ok, risks: riskHotspots(scan2, churn) }, null, 2) + "\n", flags2.out);
  } else if (cmd === "delta") {
    const { graph, symbols } = readArtifacts();
    const res = deltaFor(flags2.repo, graph, symbols, {
      base: flags2.base,
      staged: flags2.staged,
      depth: flags2.depth
    });
    if ("error" in res) throw new Error(res.error);
    emit(flags2.json ? JSON.stringify(res, null, 2) + "\n" : formatDeltaPanel(res), flags2.out);
  } else if (cmd === "impact") {
    if (!flags2.positional) throw new Error("impact needs a target: cli.mjs impact <file|module> --repo <dir>");
    const { graph } = readArtifacts();
    const res = impactOf(graph, flags2.positional, flags2.depth ?? Infinity);
    if (!res) throw new Error(`no such file or module in the index: ${flags2.positional}`);
    emit(JSON.stringify(res, null, 2) + "\n", flags2.out);
  } else if (cmd === "neighbors") {
    if (!flags2.positional) throw new Error("neighbors needs a target: cli.mjs neighbors <file|module> --repo <dir>");
    const { graph } = readArtifacts();
    const kinds = flags2.kind ? new Set(flags2.kind.split(",").map((k) => k.trim()).filter(Boolean)) : void 0;
    const res = neighborsOf(graph, flags2.positional, flags2.depth ?? 1, kinds);
    if (!res) throw new Error(`no such file or module in the index: ${flags2.positional}`);
    emit(JSON.stringify(res, null, 2) + "\n", flags2.out);
  } else if (cmd === "mermaid") {
    const { graph } = readArtifacts();
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
export {
  CORE_GRAMMARS,
  DEFAULT_DELTA_DEPTH,
  DEFAULT_GRAMMARS_URL,
  DEFAULT_MAX_FILES,
  EMBED_VERSION,
  ENGINE_VERSION,
  EXTENDED_GRAMMARS,
  EXTRACTOR_VERSION,
  EXT_GRAMMAR,
  INDEX_DIR,
  LspTimeout,
  MARKDOWN_EXT,
  MAX_FRAME_BYTES,
  RISK_WEIGHTS,
  SCHEMA_VERSION,
  agreementOf,
  allGrammarKeys,
  applyCentrality,
  basicTokenize,
  betweennessOf,
  buildArtifactsFromScan,
  buildCallerIndex,
  buildCodeRecord,
  buildEmbeddingIndex,
  buildEndpointIndex,
  buildGraph,
  buildIndexArtifacts,
  buildModules,
  buildRawCallerIndex,
  buildResolveContext,
  buildSymbolGraph,
  buildSymbolIndex,
  buildTypeHierarchy,
  byKey,
  byStr,
  categorize,
  changeCoupling,
  changedSince,
  checkRules,
  classify,
  clip,
  clipInline,
  columnOfSymbol,
  communityOf,
  compileGlobs,
  complexityOfSource,
  computeDelta,
  computeImportPairs,
  computeSurprises,
  computeSymbolRefs,
  computeTestMap,
  createFramer,
  deleteMemory,
  deltaFor,
  deserializeEmbeddings,
  detectCommunities,
  detectWorkspaces,
  diffFiles,
  diffHunks,
  embedEndpointUrl,
  embedViaEndpoint,
  embeddingUnits,
  enclosingSymbol,
  encode,
  encodeMessage,
  encodeQueryViaEndpoint,
  ensureGrammars,
  escapeRegExp,
  explainQuery,
  extToLang,
  extractAst,
  extractCode,
  extractGrammarsTarball,
  extractInParallel,
  extractMarkdown,
  extractSymbols,
  extractTags,
  extractTarInto,
  fetchExpectedSha256,
  fetchGrammarsTarball,
  fileUri,
  findDeadCode,
  findLiteralDuplications,
  findReferences,
  findSymbol,
  foldText,
  formatDeltaPanel,
  gitChurn,
  grammarKeyForExt,
  grammarKeysForExts,
  grammarReady,
  grepRepo,
  hasEmbedModel,
  have,
  headCommit,
  healthzUrl,
  hubThreshold,
  impactOf,
  implementationsOf,
  insertAfterSymbol,
  insertBeforeSymbol,
  intDot,
  isCode,
  isDoc,
  isGitWorktree,
  isIgnored,
  isSurprising,
  isTestFile,
  isTestPath,
  keptCodeFiles,
  keywords,
  languageOf,
  listMemories,
  loadEmbedModel,
  loadLspConfig,
  locationsToRefs,
  lspStatus,
  lspUnavailable,
  neighborhood,
  neighborsOf,
  onboardBrief,
  openLspSession,
  pagerankOf,
  parseGitignore,
  parseLspConfig,
  parseRules,
  preloadArtifacts,
  preloadSession,
  probeEndpoint,
  pullGrammars,
  quantize,
  rankHotspots,
  rankedKeywords,
  readMemory,
  readPersistedIndex,
  readText,
  referencesWithLsp,
  relFromUri,
  renderGraphJson,
  renderMermaid,
  renderMermaidClustered,
  renderRepoMap,
  renderScip,
  renderSymbolsJson,
  replaceSymbolBody,
  resolveBaseRef,
  resolveCallEdges,
  resolveDocLink,
  resolveEmbedEndpoint,
  resolveEmbedModelDir,
  resolveEmbedPullUrl,
  resolveGrammarsDir,
  resolveGrammarsPullTarget,
  resolveGrammarsTier,
  resolveImport,
  resolveLspConfigPath,
  resolveRelationEdges,
  resolveRelations,
  resolveUniqueSymbol,
  reverseClosure,
  rewriteCommand,
  riskHotspots,
  roundHalfToEven,
  rrf,
  runCli,
  runExtractWorker,
  runMcpServer,
  scanRepo,
  scanRepoParallel,
  scanSummary,
  searchIndex,
  searchSemantic,
  serializeEmbeddings,
  serverForLang,
  sh,
  sha1,
  sharedGrammarsCacheDir,
  shortHash,
  slugify,
  spawnLspTransport,
  subtokens,
  symbolComplexity,
  symbolId,
  symbolsInHunks,
  symbolsOverview,
  tagsQueryStatus,
  testsForModule,
  tierForPath,
  toCacheMap,
  tokenize,
  typeEntry,
  uniqueSymbolDefs,
  untestedModules,
  untrackedFiles,
  walk,
  warmGrammars,
  wordpiece,
  workerCount,
  writeMemory
};
// "Copyright" and "@license" are already caught by DIRECTIVE_RE.
