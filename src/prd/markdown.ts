import { posix } from "node:path";

// The few CommonMark rules every markdown pass in this repo must agree on.
// Fences in particular: a block opened with ```` (4) is closed only by a run of
// at least 4 of the same character, so embedded source that itself contains
// ``` stays inside its block for the bundlers, the stripper and the gate alike.

export interface Fence {
  char: "`" | "~";
  len: number;
}

/** The fence a line opens, if it is an opening code fence. */
export function fenceOpen(line: string): Fence | null {
  const m = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
  if (!m?.[1]) return null;
  const char = m[1][0] as "`" | "~";
  // A backtick fence's info string cannot itself contain a backtick.
  if (char === "`" && (m[2] ?? "").includes("`")) return null;
  return { char, len: m[1].length };
}

/** Whether `line` closes the block opened by `open`. */
export function closesFence(line: string, open: Fence): boolean {
  const m = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
  return Boolean(m?.[1] && m[1][0] === open.char && m[1].length >= open.len);
}

/** A backtick fence long enough to wrap `body` verbatim. */
export function codeFence(body: string): string {
  let longest = 0;
  for (const m of body.matchAll(/`+/g)) longest = Math.max(longest, m[0].length);
  return "`".repeat(Math.max(3, longest + 1));
}

/** Lines of `md` with a flag telling whether each sits inside a fenced block (fence lines included). */
export function fencedLines(md: string): { line: string; code: boolean }[] {
  const out: { line: string; code: boolean }[] = [];
  let open: Fence | null = null;
  for (const line of md.split("\n")) {
    if (open) {
      out.push({ line, code: true });
      if (closesFence(line, open)) open = null;
      continue;
    }
    open = fenceOpen(line);
    out.push({ line, code: open !== null });
  }
  return out;
}

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|#|\/)/i;

/**
 * Rewrite the relative link targets of a document that lived in `fromDir` so
 * they resolve from the tree root instead — what a bundle needs when it inlines
 * `features/x/PRD.md` into a root-level file. Fenced code and inline code spans
 * are left alone; external, absolute and anchor-only links too.
 */
export function rebaseLinks(md: string, fromDir: string): string {
  if (fromDir === "" || fromDir === ".") return md;
  const rebase = (target: string): string => {
    if (EXTERNAL.test(target)) return target;
    const hash = target.indexOf("#");
    const path = hash === -1 ? target : target.slice(0, hash);
    const rest = hash === -1 ? "" : target.slice(hash);
    return posix.normalize(posix.join(fromDir, path)) + rest;
  };
  return fencedLines(md)
    .map(({ line, code }) => {
      if (code) return line;
      // Split around inline code spans; rewrite only the prose between them.
      return line
        .split(/(`+[^`]*`+)/)
        .map((part, i) =>
          i % 2 === 1
            ? part
            : part
                .replace(/\]\(<([^>\n]+)>((?:\s+"[^"]*")?)\)/g, (_m, t: string, title: string) => `](<${rebase(t)}>${title})`)
                .replace(/\]\(([^)\s<][^)\s]*)((?:\s+"[^"]*")?)\)/g, (_m, t: string, title: string) => `](${rebase(t)}${title})`),
        )
        .join("");
    })
    .join("\n");
}
