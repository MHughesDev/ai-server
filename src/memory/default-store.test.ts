import { bootstrap, resetConfigForTest } from "../bootstrap/index.js";
import { getDefaultStore, getMemoryGateway, setDefaultStore } from "./default-store.js";
import { InMemoryStore } from "./in-memory-store.js";
import { VectorRetrievalAdapter } from "./vector-retrieval-adapter.js";

describe("default store wiring", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetConfigForTest();
    setDefaultStore(null);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetConfigForTest();
    setDefaultStore(null);
  });

  it("applies memoryRetention config to default in-memory store", async () => {
    process.env.MEMORY_BACKEND = "in_memory";
    process.env.MEMORY_RETENTION_MAX_CHUNKS_PER_SCOPE = "1";
    bootstrap();
    const store = getDefaultStore();
    expect(store).toBeInstanceOf(InMemoryStore);
    await store.ingest?.({
      document_id: "doc-1",
      text: "alpha one",
      scope: "org",
      scope_keys: { org_id: "o1" },
    });
    await store.ingest?.({
      document_id: "doc-2",
      text: "alpha two",
      scope: "org",
      scope_keys: { org_id: "o1" },
    });
    const out = await store.retrieve({
      query_text: "alpha",
      scope: "org",
      scope_keys: { org_id: "o1" },
      top_k: 10,
    });
    expect(out.hits.length).toBeLessThanOrEqual(1);
    expect(getMemoryGateway().retention?.max_chunks_per_scope).toBe(1);
  });

  it("creates vector adapter default store when MEMORY_BACKEND=vector", async () => {
    process.env.MEMORY_BACKEND = "vector";
    process.env.MEMORY_MAX_CHUNKS_PER_INGEST = "2";
    process.env.MEMORY_INGEST_CHUNK_CAP_POLICY = "trim";
    bootstrap();
    const store = getDefaultStore();
    expect(store).toBeInstanceOf(VectorRetrievalAdapter);
    const ingest = await store.ingest?.({
      document_id: "vec-doc",
      text: "vector alpha ".repeat(1_000),
      scope: "org",
      scope_keys: { org_id: "o1" },
      source_label: "vec.txt",
    });
    expect(ingest?.chunks_written).toBe(2);
    expect(ingest?.error).toBe("ingest_chunks_trimmed");
    const out = await store.retrieve({
      query_text: "vector alpha",
      scope: "org",
      scope_keys: { org_id: "o1" },
      top_k: 3,
    });
    expect(out.hits.length).toBeGreaterThan(0);
  });
});
