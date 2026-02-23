/**
 * In-memory store tests – L2-06 Phase 0/1 (ingestion, scoped retrieval)
 */

import { InMemoryStore } from "./in-memory-store.js";

describe("InMemoryStore", () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  it("ingests text and returns chunk count", async () => {
    const result = await store.ingest({
      document_id: "doc1",
      text: "Hello world. This is a test document for retrieval.",
      scope: "org",
      scope_keys: { org_id: "o1" },
      source_label: "test.txt",
    });
    expect(result.chunks_written).toBeGreaterThanOrEqual(1);
    expect(result.document_id).toBe("doc1");
  });

  it("retrieves scoped results by query text", async () => {
    await store.ingest({
      document_id: "doc1",
      text: "The quick brown fox jumps over the lazy dog.",
      scope: "org",
      scope_keys: { org_id: "o1" },
    });
    const result = await store.retrieve({
      query_text: "brown fox",
      scope: "org",
      scope_keys: { org_id: "o1" },
      top_k: 5,
    });
    expect(result.degraded).toBeFalsy();
    expect(result.hits.length).toBeGreaterThanOrEqual(1);
    expect(result.hits[0].chunk.text).toContain("brown");
  });

  it("returns empty hits for scope mismatch", async () => {
    await store.ingest({
      document_id: "doc1",
      text: "Secret org o2 content.",
      scope: "org",
      scope_keys: { org_id: "o2" },
    });
    const result = await store.retrieve({
      query_text: "secret",
      scope: "org",
      scope_keys: { org_id: "o1" },
      top_k: 5,
    });
    expect(result.hits).toHaveLength(0);
  });

  it("returns degraded and empty when unavailable", async () => {
    store.setAvailable(false);
    const result = await store.retrieve({
      query_text: "any",
      scope: "org",
      scope_keys: { org_id: "o1" },
      top_k: 5,
    });
    expect(result.degraded).toBe(true);
    expect(result.hits).toHaveLength(0);
  });

  it("ingest returns error when unavailable", async () => {
    store.setAvailable(false);
    const result = await store.ingest({
      document_id: "d",
      text: "x",
      scope: "user",
      scope_keys: { user_id: "u1" },
    });
    expect(result.chunks_written).toBe(0);
    expect(result.error).toBe("store_unavailable");
  });
});
