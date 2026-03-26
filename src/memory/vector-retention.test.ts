import { evictVectorRecords } from "./vector-retrieval-adapter.js";

describe("evictVectorRecords", () => {
  it("keeps only the newest chunks per scope when max_chunks_per_scope is set", () => {
    const records = [
      {
        id: "a",
        text: "old",
        embedding: [],
        scope: "org" as const,
        scope_keys: { org_id: "o1" },
        document_id: "d1",
        position: 0,
        created_at: "2020-01-01T00:00:00.000Z",
      },
      {
        id: "b",
        text: "new",
        embedding: [],
        scope: "org" as const,
        scope_keys: { org_id: "o1" },
        document_id: "d2",
        position: 0,
        created_at: "2020-01-02T00:00:00.000Z",
      },
    ];
    const out = evictVectorRecords(records, { max_chunks_per_scope: 1 });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b");
  });

  it("drops records older than ttl_seconds", () => {
    const old = new Date(Date.now() - 120_000).toISOString();
    const recent = new Date(Date.now() - 30_000).toISOString();
    const records = [
      {
        id: "a",
        text: "x",
        embedding: [],
        scope: "org" as const,
        scope_keys: { org_id: "o1" },
        document_id: "d1",
        position: 0,
        created_at: old,
      },
      {
        id: "b",
        text: "y",
        embedding: [],
        scope: "org" as const,
        scope_keys: { org_id: "o1" },
        document_id: "d2",
        position: 0,
        created_at: recent,
      },
    ];
    const out = evictVectorRecords(records, { ttl_seconds: 60 });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b");
  });
});
