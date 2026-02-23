/**
 * Chunker unit tests – L2-06 Phase 0
 */

import { chunkText } from "./chunker.js";

describe("chunkText", () => {
  it("returns single chunk for short text", () => {
    const out = chunkText("Hello world.");
    expect(out).toEqual(["Hello world."]);
  });

  it("returns empty array for empty or whitespace-only text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n  ")).toEqual([]);
  });

  it("splits long text into multiple chunks with default size", () => {
    const long = "a".repeat(600);
    const out = chunkText(long);
    expect(out.length).toBeGreaterThanOrEqual(2);
    const totalLen = out.join("").length;
    expect(totalLen).toBeGreaterThanOrEqual(500);
  });

  it("respects custom chunk_size and overlap", () => {
    const text = "one two three four five six seven eight nine ten.";
    const out = chunkText(text, { chunk_size: 20, overlap: 5 });
    expect(out.length).toBeGreaterThanOrEqual(1);
    out.forEach((c) => expect(c.length).toBeLessThanOrEqual(25));
  });

  it("breaks on sentence boundary when possible", () => {
    const text = "First sentence. ".repeat(50) + "Last.";
    const out = chunkText(text, { chunk_size: 100, overlap: 10 });
    expect(out.length).toBeGreaterThan(1);
    expect(out.some((c) => c.includes("First sentence"))).toBe(true);
  });
});
