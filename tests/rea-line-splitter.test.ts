import { describe, expect, it } from "vitest";
import { LineSplitter } from "../src/rea.js";

describe("rea stdio LineSplitter", () => {
  it("joins a line split across chunks and emits several lines from one chunk", () => {
    const s = new LineSplitter();
    expect(s.push('{"id":1,')).toEqual([]);
    expect(s.push('"r":2}\n{"id":2}\n\n  {"id"')).toEqual(['{"id":1,"r":2}', '{"id":2}']);
    expect(s.push(":3}\r\n")).toEqual(['{"id":3}']);
  });

  it("stays linear on one huge line delivered in small chunks", () => {
    const s = new LineSplitter();
    const chunk = "x".repeat(64 * 1024);
    const t = performance.now();
    for (let i = 0; i < 800; i++) expect(s.push(chunk)).toEqual([]);
    const [line] = s.push("\n");
    expect(line?.length).toBe(800 * 64 * 1024);
    // The previous buffer-rescan reader took ~5 s here; the bound only trips on a regression.
    expect(performance.now() - t).toBeLessThan(2000);
  });
});
