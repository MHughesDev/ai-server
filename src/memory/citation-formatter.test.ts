/**
 * Citation formatter tests – L2-06 Phase 2
 */

import { citationsFromRetrievalHits } from "./citation-formatter.js";
import type { RetrievalHit, RetrievalChunk } from "./types.js";

function hit(text: string, docId: string, chunkId: string, sourceLabel?: string): RetrievalHit {
  const chunk: RetrievalChunk = {
    text,
    metadata: {
      chunk_id: chunkId,
      document_id: docId,
      scope: "org",
      scope_keys: { org_id: "o1" },
      source_label: sourceLabel,
    },
  };
  return { chunk, score: 0.9 };
}

describe("citationsFromRetrievalHits", () => {
  it("returns one citation per hit with source and ref", () => {
    const hits = [
      hit("Excerpt one.", "doc1", "c1", "Manual.pdf"),
      hit("Excerpt two.", "doc2", "c2"),
    ];
    const out = citationsFromRetrievalHits(hits);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      source: "Manual.pdf",
      ref: "c1",
      span: "Excerpt one.",
    });
    expect(out[1].source).toBe("doc2");
    expect(out[1].ref).toBe("c2");
  });

  it("deduplicates by ref", () => {
    const hits = [
      hit("Same.", "doc1", "c1"),
      hit("Same again.", "doc1", "c1"),
    ];
    const out = citationsFromRetrievalHits(hits);
    expect(out).toHaveLength(1);
  });

  it("truncates long span to 200 chars with ellipsis", () => {
    const long = "x".repeat(250);
    const hits = [hit(long, "d", "c")];
    const out = citationsFromRetrievalHits(hits);
    expect(out[0].span).toHaveLength(201);
    expect(out[0].span!.endsWith("…")).toBe(true);
  });

  it("returns empty array for no hits", () => {
    expect(citationsFromRetrievalHits([])).toEqual([]);
  });
});
