/**
 * Memory Gateway tests – L2-06 Segment I
 * Tests composition of vector, structured, and object stores with retention config.
 */

import { jest } from "@jest/globals";
import { createMemoryGateway, type MemoryGatewayOptions } from "./memory-gateway.js";
import type { IMemoryStore, IStructuredStore, IObjectStore } from "./memory-abstraction.js";
import type { MemoryRetentionConfig } from "../config/schema.js";

// Mock store implementations
function createMockMemoryStore(): jest.Mocked<IMemoryStore> {
  return {
    retrieve: jest.fn().mockResolvedValue({ hits: [], degraded: false }),
    ingest: jest.fn().mockResolvedValue({ document_id: "mock", chunks_written: 1 }),
    isAvailable: jest.fn().mockResolvedValue(true),
  } as unknown as jest.Mocked<IMemoryStore>;
}

function createMockStructuredStore(): jest.Mocked<IStructuredStore> {
  return {
    get: jest.fn().mockResolvedValue(null),
    put: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(true),
    list: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<IStructuredStore>;
}

function createMockObjectStore(): jest.Mocked<IObjectStore> {
  return {
    get: jest.fn().mockResolvedValue(null),
    put: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(true),
    list: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<IObjectStore>;
}

describe("createMemoryGateway", () => {
  let mockVectorStore: jest.Mocked<IMemoryStore>;
  let mockStructuredStore: jest.Mocked<IStructuredStore>;
  let mockObjectStore: jest.Mocked<IObjectStore>;

  beforeEach(() => {
    mockVectorStore = createMockMemoryStore();
    mockStructuredStore = createMockStructuredStore();
    mockObjectStore = createMockObjectStore();
  });

  it("creates gateway with all stores", () => {
    const retention: MemoryRetentionConfig = {
      max_chunks_per_scope: 100,
      ttl_seconds: 3600,
    };

    const gateway = createMemoryGateway({
      vectorStore: mockVectorStore,
      structuredStore: mockStructuredStore,
      objectStore: mockObjectStore,
      retention,
    });

    expect(gateway.vectorStore).toBe(mockVectorStore);
    expect(gateway.structuredStore).toBe(mockStructuredStore);
    expect(gateway.objectStore).toBe(mockObjectStore);
    expect(gateway.retention).toBe(retention);
  });

  it("creates gateway without retention config", () => {
    const gateway = createMemoryGateway({
      vectorStore: mockVectorStore,
      structuredStore: mockStructuredStore,
      objectStore: mockObjectStore,
    });

    expect(gateway.retention).toBeUndefined();
  });

  it("uses vectorStoreGetter when provided instead of static vectorStore", () => {
    const dynamicStore = createMockMemoryStore();
    const getter = jest.fn().mockReturnValue(dynamicStore);

    const gateway = createMemoryGateway({
      vectorStore: mockVectorStore,
      vectorStoreGetter: getter,
      structuredStore: mockStructuredStore,
      objectStore: mockObjectStore,
    });

    // Access vectorStore multiple times
    const store1 = gateway.vectorStore;
    const store2 = gateway.vectorStore;

    expect(getter).toHaveBeenCalledTimes(2);
    expect(store1).toBe(dynamicStore);
    expect(store2).toBe(dynamicStore);
  });

  it("falls back to static vectorStore when getter not provided", () => {
    const gateway = createMemoryGateway({
      vectorStore: mockVectorStore,
      structuredStore: mockStructuredStore,
      objectStore: mockObjectStore,
    });

    const store = gateway.vectorStore;
    expect(store).toBe(mockVectorStore);
  });

  it("throws error when neither vectorStore nor vectorStoreGetter provided", () => {
    const gateway = createMemoryGateway({
      structuredStore: mockStructuredStore,
      objectStore: mockObjectStore,
    } as MemoryGatewayOptions);
    
    // Error is thrown when accessing vectorStore getter
    expect(() => gateway.vectorStore).toThrow("MemoryGateway: provide vectorStore or vectorStoreGetter");
  });

  it("allows vector operations through the gateway", async () => {
    const gateway = createMemoryGateway({
      vectorStore: mockVectorStore,
      structuredStore: mockStructuredStore,
      objectStore: mockObjectStore,
    });

    // Test retrieve
    const retrieveResult = await gateway.vectorStore.retrieve({
      query_text: "test query",
      scope: "org",
      scope_keys: { org_id: "o1" },
      top_k: 5,
    });
    expect(mockVectorStore.retrieve).toHaveBeenCalledWith({
      query_text: "test query",
      scope: "org",
      scope_keys: { org_id: "o1" },
      top_k: 5,
    });
    expect(retrieveResult.hits).toEqual([]);

    // Test ingest
    await gateway.vectorStore.ingest?.({
      document_id: "doc1",
      text: "test content",
      scope: "org",
      scope_keys: { org_id: "o1" },
    });
    expect(mockVectorStore.ingest).toHaveBeenCalledWith({
      document_id: "doc1",
      text: "test content",
      scope: "org",
      scope_keys: { org_id: "o1" },
    });
  });

  it("allows structured store operations through the gateway", async () => {
    const gateway = createMemoryGateway({
      vectorStore: mockVectorStore,
      structuredStore: mockStructuredStore,
      objectStore: mockObjectStore,
    });

    // Test put and get
    await gateway.structuredStore.put({
      key: "test-key",
      scope: "user",
      scope_keys: { user_id: "u1" },
      value: { data: "value" },
    });
    expect(mockStructuredStore.put).toHaveBeenCalled();

    await gateway.structuredStore.get("test-key", "user", { user_id: "u1" });
    expect(mockStructuredStore.get).toHaveBeenCalledWith("test-key", "user", { user_id: "u1" });

    // Test list
    await gateway.structuredStore.list("org", { org_id: "o1" });
    expect(mockStructuredStore.list).toHaveBeenCalledWith("org", { org_id: "o1" });

    // Test delete
    await gateway.structuredStore.delete("test-key", "user", { user_id: "u1" });
    expect(mockStructuredStore.delete).toHaveBeenCalledWith("test-key", "user", { user_id: "u1" });
  });

  it("allows object store operations through the gateway", async () => {
    const gateway = createMemoryGateway({
      vectorStore: mockVectorStore,
      structuredStore: mockStructuredStore,
      objectStore: mockObjectStore,
    });

    // Test put and get
    await gateway.objectStore.put({
      id: "blob-1",
      scope: "project",
      scope_keys: { project_id: "p1" },
      content_type: "application/json",
      content: Buffer.from("{}")
    });
    expect(mockObjectStore.put).toHaveBeenCalled();

    await gateway.objectStore.get("blob-1", "project", { project_id: "p1" });
    expect(mockObjectStore.get).toHaveBeenCalledWith("blob-1", "project", { project_id: "p1" });

    // Test list
    await gateway.objectStore.list("org", { org_id: "o1" });
    expect(mockObjectStore.list).toHaveBeenCalledWith("org", { org_id: "o1" });

    // Test delete
    await gateway.objectStore.delete("blob-1", "project", { project_id: "p1" });
    expect(mockObjectStore.delete).toHaveBeenCalledWith("blob-1", "project", { project_id: "p1" });
  });

  it("exposes retention config for policy decisions", () => {
    const retention: MemoryRetentionConfig = {
      max_chunks_per_scope: 50,
      ttl_seconds: 1800,
    };

    const gateway = createMemoryGateway({
      vectorStore: mockVectorStore,
      structuredStore: mockStructuredStore,
      objectStore: mockObjectStore,
      retention,
    });

    expect(gateway.retention?.max_chunks_per_scope).toBe(50);
    expect(gateway.retention?.ttl_seconds).toBe(1800);
  });
});
