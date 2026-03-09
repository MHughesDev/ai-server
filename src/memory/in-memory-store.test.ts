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

  it("evicts by max_chunks_per_scope when retention is set", async () => {
    const storeWithRetention = new InMemoryStore({ max_chunks_per_scope: 2 });
    await storeWithRetention.ingest({
      document_id: "d1",
      text: "First document with some content for chunking.",
      scope: "user",
      scope_keys: { user_id: "u1" },
    });
    await storeWithRetention.ingest({
      document_id: "d2",
      text: "Second document with more content to create multiple chunks for retention test.",
      scope: "user",
      scope_keys: { user_id: "u1" },
    });
    const result = await storeWithRetention.retrieve({
      query_text: "document",
      scope: "user",
      scope_keys: { user_id: "u1" },
      top_k: 20,
    });
    expect(result.hits.length).toBeLessThanOrEqual(2);
  });

  it("trims ingest when chunk cap policy is trim", async () => {
    const trimStore = new InMemoryStore({
      max_chunks_per_ingest: 2,
      ingest_chunk_cap_policy: "trim",
    });
    const result = await trimStore.ingest({
      document_id: "trim-doc",
      text: "alpha ".repeat(1_500),
      scope: "org",
      scope_keys: { org_id: "o1" },
    });
    expect(result.chunks_written).toBe(2);
    expect(result.chunks_dropped).toBeGreaterThan(0);
    expect(result.error).toBe("ingest_chunks_trimmed");
  });

  it("rejects ingest when chunk cap policy is reject", async () => {
    const rejectStore = new InMemoryStore({
      max_chunks_per_ingest: 2,
      ingest_chunk_cap_policy: "reject",
    });
    const result = await rejectStore.ingest({
      document_id: "reject-doc",
      text: "alpha ".repeat(1_500),
      scope: "org",
      scope_keys: { org_id: "o1" },
    });
    expect(result.chunks_written).toBe(0);
    expect(result.chunks_dropped).toBeGreaterThan(0);
    expect(result.error).toBe("ingest_chunk_cap_exceeded");
  });
});
