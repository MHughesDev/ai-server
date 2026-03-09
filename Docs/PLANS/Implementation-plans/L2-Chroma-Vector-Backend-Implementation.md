# L2-Chroma: Chroma DB Vector Backend Implementation Plan

**Status:** Draft  
**Target:** Migrate vector storage from Redis to Chroma DB  
**Priority:** Medium (Post-MVP Enhancement)  
**Estimated Effort:** 2-3 days  
**Prerequisites:** L2-06 (Memory & Retrieval Infrastructure) completed

---

## 1. Overview

### 1.1 Purpose
This plan outlines the implementation of a Chroma DB vector backend to replace or supplement the current Redis-based vector storage. Chroma provides native vector similarity search, simplified embedding management, and better developer experience for local and production deployments.

### 1.2 Goals
- Implement `ChromaVectorBackend` class conforming to `VectorBackend` interface
- Maintain backward compatibility with existing memory abstraction layer
- Support scope-based access control (user/project/org)
- Provide health check integration
- Enable seamless switching between Redis and Chroma via environment configuration

### 1.3 Non-Goals
- Migration of non-vector Redis usage (rate limiting, tenant budgets)
- Support for other vector databases (Pinecone, Weaviate, pgvector)
- Chroma-specific embedding generation (we continue using OpenAI/Hash providers)
- Real-time replication or sync between Redis and Chroma

---

## 2. Background

### 2.1 Current State
The system currently supports three vector backend implementations:
- `InMemoryVectorBackend` - Development/testing only
- `FileVectorBackend` - Local persistence for development
- `RedisVectorBackend` - Production deployment with Redis

All backends implement the `VectorBackend` interface from `vector-retrieval-adapter.ts`.

### 2.2 Why Chroma
- **Native vector operations:** Built-in cosine similarity search
- **Simplified deployment:** Single binary or Docker container
- **Developer experience:** Intuitive API, better debugging
- **Performance:** Optimized for embedding storage and retrieval
- **Ecosystem:** Growing community, LangChain integration

### 2.3 Trade-offs
| Aspect | Redis | Chroma |
|--------|-------|--------|
| Operational maturity | High (existing deployment) | Medium (newer project) |
| Horizontal scaling | Built-in clustering | Limited (single-node) |
| Persistence | AOF/RDB snapshots | Persistent by default |
| Vector search | Application-level cosine | Native similarity index |
| Connection pooling | Mature (ioredis) | Basic (chromadb client) |

---

## 3. Technical Design

### 3.1 Architecture

```
┌─────────────────────────────────┐
│     VectorRetrievalAdapter      │
│  (unchanged - embedding layer)   │
└─────────────┬───────────────────┘
              │
┌─────────────▼───────────────────┐
│      VectorBackend Interface     │
│  - upsert(records)              │
│  - query(input)                 │
│  - isAvailable()                │
└─────────────┬───────────────────┘
              │
    ┌─────────┴─────────┐
    │                 │
┌───▼────┐       ┌────▼──────┐
│  Redis │       │   Chroma  │
│Backend │       │  Backend  │
└────────┘       └───────────┘
```

### 3.2 Data Model Mapping

| `VectorRecord` Field | Chroma Representation |
|---------------------|----------------------|
| `id` | Document `id` (primary key) |
| `text` | Document `document` content |
| `embedding` | Document `embedding` vector |
| `scope` | Metadata field `scope` |
| `scope_keys` | Metadata JSON `scope_keys` |
| `document_id` | Metadata `document_id` |
| `position` | Metadata `position` |
| `source_label` | Metadata `source_label` |
| `created_at` | Metadata `created_at` |

### 3.3 Scope Enforcement Strategy

Chroma supports `where` clause filtering on metadata. Two implementation options:

**Option A: Pre-filter in Chroma (Recommended)**
```typescript
// Build where clause from scope/scope_keys
const where = buildChromaWhereClause(scope, scopeKeys);
const results = await collection.query({
  queryEmbeddings: [query_embedding],
  nResults: top_k,
  where: where,  // Chroma filters before returning
});
```

**Option B: Post-filter in application**
```typescript
// Query all, then filter (current Redis approach)
const results = await collection.query({...});
return results.filter(r => scopeAllowsAccess(...));
```

**Decision:** Use Option A for efficiency, with Option B as fallback for complex hierarchy queries.

### 3.4 Collection Strategy

Two approaches for organizing data:

**Option 1: Single Collection (Recommended)**
- One collection per deployment
- All scopes mixed
- Rely on `where` filtering

**Option 2: Collection-per-Scope**
- Separate collections: `user_data`, `project_data`, `org_data`
- Simpler permission model
- More complex collection management

**Decision:** Option 1 for simplicity; revisit if scale demands separation.

---

## 4. Implementation Phases

### Phase 1: Core Backend Implementation (Day 1)

**4.1.1 Create `src/memory/chroma-vector-backend.ts`**
```typescript
export interface ChromaVectorBackendOptions {
  url: string;
  collectionName?: string;
  authToken?: string;
  tenant?: string;
  database?: string;
  timeoutMs?: number;
  retryAttempts?: number;
}

export class ChromaVectorBackend implements VectorBackend {
  private client: ChromaClient | null = null;
  private collection: Collection | null = null;
  
  constructor(private readonly options: ChromaVectorBackendOptions) {}
  
  async upsert(records: VectorRecord[]): Promise<void> { ... }
  async query(input: {...}): Promise<VectorQueryResult[]> { ... }
  async isAvailable(): Promise<boolean> { ... }
  async disconnect(): Promise<void> { ... }
}
```

**Tasks:**
- [ ] Implement `getClient()` with lazy initialization
- [ ] Implement `getCollection()` with auto-creation
- [ ] Implement `upsert()` using `collection.upsert()`
- [ ] Implement `query()` with scope-based `where` filtering
- [ ] Implement `isAvailable()` with ping check
- [ ] Add retry logic with exponential backoff
- [ ] Add proper error handling and messages

**4.1.2 Update `src/memory/index.ts`**
- [ ] Add export: `export * from "./chroma-vector-backend.js";`

**4.1.3 Update `src/memory/default-store.ts`**
- [ ] Add import for `ChromaVectorBackend`
- [ ] Add environment variable detection for `CHROMA_URL`
- [ ] Modify `createVectorStore()` to prioritize Chroma if configured

**Priority logic:**
```typescript
if (chromaUrl) {
  vectorBackend = new ChromaVectorBackend({...});
} else if (redisUrl) {
  vectorBackend = new RedisVectorBackend({...});
} else if (vectorStorePath) {
  vectorBackend = new FileVectorBackend(vectorStorePath);
} else {
  vectorBackend = new InMemoryVectorBackend();
}
```

### Phase 2: Configuration & Health Checks (Day 2)

**4.2.1 Environment Variables**
New environment variables to support:
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CHROMA_URL` | Yes* | — | Chroma server URL |
| `CHROMA_COLLECTION` | No | `ai_server_memory` | Collection name |
| `CHROMA_AUTH_TOKEN` | No | — | Authentication token |
| `CHROMA_TENANT` | No | `default_tenant` | Multi-tenant support |
| `CHROMA_DATABASE` | No | `default_database` | Database name |
| `CHROMA_TIMEOUT_MS` | No | `5000` | Request timeout |
| `CHROMA_RETRY_ATTEMPTS` | No | `3` | Retry count |

*Required only if using Chroma backend

**4.2.2 Update `src/server/dependencies.ts`**
- [ ] Modify `checkVectorBackendHealth()` to detect Chroma and test connectivity
- [ ] Return actual health status instead of static "configured" message

**4.2.3 Optional: Config Schema Updates**
- [ ] Consider adding `"chroma"` to backend enum in `MemoryRuntimeSchema`
- [ ] Add Chroma-specific config parsing if complex options needed

### Phase 3: Testing & Validation (Day 2-3)

**4.3.1 Unit Tests: `src/memory/chroma-vector-backend.test.ts`**
- [ ] Mock ChromaClient and Collection
- [ ] Test `upsert()` with various record counts
- [ ] Test `query()` with and without scope filtering
- [ ] Test `isAvailable()` for connected/disconnected states
- [ ] Test retry logic
- [ ] Test error handling

**4.3.2 Integration Tests**
- [ ] Add Chroma test case to `src/memory/default-store.test.ts`
- [ ] Test full retrieval flow with real Chroma instance (Docker)

**4.3.3 Test in Docker**
```yaml
# docker-compose.test.yml
services:
  chroma:
    image: chromadb/chroma:0.5.0
    ports:
      - "8000:8000"
  test:
    build: .
    environment:
      - CHROMA_URL=http://chroma:8000
    depends_on:
      - chroma
```

### Phase 4: Documentation & Rollout (Day 3)

**4.4.1 Code Documentation**
- [ ] Add JSDoc comments to all public methods
- [ ] Document scope filtering strategy
- [ ] Add troubleshooting notes

**4.4.2 Update Documentation Files**
- [ ] `Docs/World-Model-Codebase.md` - Update Memory Model section
- [ ] `Docs/SPEC/17_MemoryAbstraction_Spec.md` - Add Chroma backend spec
- [ ] `docs/Runbooks/Memory-Retrieval-Outage.md` - Add Chroma-specific troubleshooting
- [ ] `README.md` - Update environment variable reference

**4.4.3 Infrastructure Examples**
- [ ] Update `docs/Runbooks/Infrastructure-as-Code-Examples.md` with Chroma service definition
- [ ] Provide Docker Compose example
- [ ] Provide Kubernetes deployment example

---

## 5. Implementation Details

### 5.1 Chroma Backend Implementation Sketch

```typescript
// src/memory/chroma-vector-backend.ts

import type { VectorBackend, VectorRecord, VectorQueryResult } from "./vector-retrieval-adapter.js";
import type { RetrievalScope } from "./types.js";

export interface ChromaVectorBackendOptions {
  url: string;
  collectionName?: string;
  authToken?: string;
  tenant?: string;
  database?: string;
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  maxRetryDelayMs?: number;
}

// Dynamic import type for chromadb
interface ChromaClient {
  heartbeat(): Promise<number>;
  getOrCreateCollection(options: { name: string; metadata?: Record<string, unknown> }): Promise<Collection>;
}

interface Collection {
  upsert(options: {
    ids: string[];
    embeddings: number[][];
    documents: string[];
    metadatas: Record<string, unknown>[];
  }): Promise<void>;
  query(options: {
    queryEmbeddings: number[][];
    nResults: number;
    where?: Record<string, unknown>;
    include?: string[];
  }): Promise<{
    ids: string[][];
    distances: number[][];
    documents: string[][];
    metadatas: Record<string, unknown>[][];
  }>;
}

export class ChromaVectorBackend implements VectorBackend {
  private client: ChromaClient | null = null;
  private collection: Collection | null = null;
  private readonly options: Required<ChromaVectorBackendOptions>;

  constructor(options: ChromaVectorBackendOptions) {
    this.options = {
      collectionName: options.collectionName ?? "ai_server_memory",
      tenant: options.tenant ?? "default_tenant",
      database: options.database ?? "default_database",
      timeoutMs: options.timeoutMs ?? 5000,
      retryAttempts: options.retryAttempts ?? 3,
      retryDelayMs: options.retryDelayMs ?? 100,
      maxRetryDelayMs: options.maxRetryDelayMs ?? 5000,
      authToken: options.authToken ?? "",
      ...options,
    };
  }

  private async getClient(): Promise<ChromaClient> {
    if (this.client) return this.client;
    
    try {
      const { ChromaClient } = await import("chromadb");
      this.client = new ChromaClient({
        path: this.options.url,
        ...(this.options.authToken ? { auth: { provider: "token", credentials: this.options.authToken } } : {}),
      }) as ChromaClient;
      return this.client;
    } catch (err) {
      throw new Error(
        `Failed to create Chroma client: ${err instanceof Error ? err.message : String(err)}. ` +
        "Ensure chromadb is installed: npm install chromadb"
      );
    }
  }

  private async getCollection(): Promise<Collection> {
    if (this.collection) return this.collection;
    const client = await this.getClient();
    this.collection = await client.getOrCreateCollection({
      name: this.options.collectionName,
      metadata: { created_by: "ai_server", tenant: this.options.tenant },
    });
    return this.collection;
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    const collection = await this.getCollection();
    
    await this.withRetry(async () => {
      await collection.upsert({
        ids: records.map(r => r.id),
        embeddings: records.map(r => r.embedding),
        documents: records.map(r => r.text),
        metadatas: records.map(r => ({
          scope: r.scope,
          scope_keys: JSON.stringify(r.scope_keys),
          document_id: r.document_id,
          position: r.position,
          source_label: r.source_label ?? null,
          created_at: r.created_at,
        })),
      });
    });
  }

  async query(input: {
    query_embedding: number[];
    scope: RetrievalScope;
    scope_keys: Record<string, string>;
    top_k: number;
  }): Promise<VectorQueryResult[]> {
    const collection = await this.getCollection();
    
    return this.withRetry(async () => {
      // Build Chroma where clause from scope
      const where = this.buildWhereClause(input.scope, input.scope_keys);
      
      const results = await collection.query({
        queryEmbeddings: [input.query_embedding],
        nResults: input.top_k * 2, // Fetch extra for scope filtering
        where: where,
        include: ["distances", "documents", "metadatas"],
      });

      // Map results
      const matches: VectorQueryResult[] = [];
      const ids = results.ids[0] ?? [];
      const distances = results.distances[0] ?? [];
      const documents = results.documents[0] ?? [];
      const metadatas = results.metadatas[0] ?? [];

      for (let i = 0; i < ids.length; i++) {
        const metadata = metadatas[i] ?? {};
        const recordScope = metadata["scope"] as RetrievalScope;
        const recordScopeKeys = JSON.parse((metadata["scope_keys"] as string) ?? "{}");
        
        // Double-check scope access (Chroma where may not handle full hierarchy)
        if (!this.scopeAllowsAccess(input.scope, input.scope_keys, recordScope, recordScopeKeys)) {
          continue;
        }

        const record: VectorRecord = {
          id: ids[i],
          text: documents[i] ?? "",
          embedding: [], // Not returned by query, would need separate fetch
          scope: recordScope,
          scope_keys: recordScopeKeys,
          document_id: (metadata["document_id"] as string) ?? "",
          position: (metadata["position"] as number) ?? 0,
          source_label: (metadata["source_label"] as string) ?? undefined,
          created_at: (metadata["created_at"] as string) ?? new Date().toISOString(),
        };

        // Chroma returns L2 distance by default; convert to similarity score
        const distance = distances[i] ?? 0;
        const score = 1 / (1 + distance); // Convert distance to similarity

        matches.push({ record, score });
      }

      matches.sort((a, b) => b.score - a.score);
      return matches.slice(0, input.top_k);
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      const client = await this.getClient();
      await client.heartbeat();
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // Chroma client doesn't require explicit disconnect
    this.client = null;
    this.collection = null;
  }

  // Helper methods...
  private buildWhereClause(scope: RetrievalScope, scopeKeys: Record<string, string>): Record<string, unknown> | undefined {
    // Build Chroma where clause based on scope hierarchy
    // This is a simplified version - full implementation handles all scope levels
    if (scope === "none") return undefined;
    
    return {
      scope: { "$eq": scope },
      ...(scope === "user" && scopeKeys.user_id ? { "scope_keys": { "$contains": `"user_id":"${scopeKeys.user_id}"` } } : {}),
      ...(scope === "project" && scopeKeys.project_id ? { "scope_keys": { "$contains": `"project_id":"${scopeKeys.project_id}"` } } : {}),
      ...(scope === "org" && scopeKeys.org_id ? { "scope_keys": { "$contains": `"org_id":"${scopeKeys.org_id}"` } } : {}),
    };
  }

  private scopeAllowsAccess(
    requestScope: RetrievalScope,
    requestScopeKeys: Record<string, string>,
    chunkScope: RetrievalScope,
    chunkScopeKeys: Record<string, string>
  ): boolean {
    // Same logic as in memory-abstraction.ts
    // ...
    return true; // Simplified
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < this.options.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.options.retryAttempts - 1) {
          const delay = Math.min(
            this.options.retryDelayMs * Math.pow(2, attempt),
            this.options.maxRetryDelayMs
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError ?? new Error("Operation failed after retries");
  }
}
```

### 5.2 Default Store Integration

```typescript
// In src/memory/default-store.ts, modify createVectorStore():

function createVectorStore(memoryRuntime: MemoryRuntimeConfig): IMemoryStore {
  const embeddingApiKey = process.env.OPENAI_EMBEDDINGS_API_KEY?.trim();
  const embeddingModel = process.env.OPENAI_EMBEDDINGS_MODEL?.trim() || "text-embedding-3-small";
  const embeddingProvider = embeddingApiKey
    ? new OpenAiEmbeddingProvider(embeddingApiKey, embeddingModel)
    : new HashEmbeddingProvider();

  // Determine vector backend type (Chroma takes precedence)
  const chromaUrl = process.env.CHROMA_URL?.trim();
  const redisUrl = process.env.REDIS_URL?.trim();
  const vectorStorePath = process.env.MEMORY_VECTOR_STORE_PATH?.trim();

  let vectorBackend;

  if (chromaUrl) {
    // Chroma: Native vector database with similarity search
    vectorBackend = new ChromaVectorBackend({
      url: chromaUrl,
      collectionName: process.env.CHROMA_COLLECTION ?? "ai_server_memory",
      authToken: process.env.CHROMA_AUTH_TOKEN,
      tenant: process.env.CHROMA_TENANT,
      database: process.env.CHROMA_DATABASE,
      timeoutMs: memoryRuntime.retrieval_timeout_ms,
      retryAttempts: RetryConfigs.vectorStore.maxAttempts,
      retryDelayMs: RetryConfigs.vectorStore.initialDelayMs,
      maxRetryDelayMs: RetryConfigs.vectorStore.maxDelayMs,
    });
  } else if (redisUrl) {
    // Fallback: Redis vector backend with connection pooling
    vectorBackend = new RedisVectorBackend({
      url: redisUrl,
      poolSize: parseInt(process.env.REDIS_POOL_SIZE ?? "10", 10),
      keyPrefix: process.env.REDIS_KEY_PREFIX ?? "ai:vec:",
      commandTimeoutMs: memoryRuntime.retrieval_timeout_ms,
      retryAttempts: RetryConfigs.vectorStore.maxAttempts,
      retryDelayMs: RetryConfigs.vectorStore.initialDelayMs,
      maxRetryDelayMs: RetryConfigs.vectorStore.maxDelayMs,
    });
  } else if (vectorStorePath) {
    // Development: File-backed vector store
    vectorBackend = new FileVectorBackend(vectorStorePath);
  } else {
    // Fallback: In-memory vector store
    vectorBackend = new InMemoryVectorBackend();
  }

  return new VectorRetrievalAdapter(embeddingProvider, vectorBackend, {
    max_chunks_per_ingest: memoryRuntime.max_chunks_per_ingest,
    ingest_chunk_cap_policy: memoryRuntime.ingest_chunk_cap_policy,
  });
}
```

---

## 6. Testing Strategy

### 6.1 Unit Tests

```typescript
// src/memory/chroma-vector-backend.test.ts

describe("ChromaVectorBackend", () => {
  let backend: ChromaVectorBackend;
  let mockClient: jest.Mocked<ChromaClient>;
  let mockCollection: jest.Mocked<Collection>;

  beforeEach(() => {
    mockCollection = {
      upsert: jest.fn(),
      query: jest.fn(),
    } as unknown as jest.Mocked<Collection>;

    mockClient = {
      heartbeat: jest.fn(),
      getOrCreateCollection: jest.fn().mockResolvedValue(mockCollection),
    } as unknown as jest.Mocked<ChromaClient>;

    // Mock the chromadb import
    jest.doMock("chromadb", () => ({
      ChromaClient: jest.fn().mockReturnValue(mockClient),
    }));

    backend = new ChromaVectorBackend({ url: "http://localhost:8000" });
  });

  describe("upsert", () => {
    it("should upsert records to collection", async () => {
      const records: VectorRecord[] = [
        {
          id: "rec-1",
          text: "test text",
          embedding: [0.1, 0.2, 0.3],
          scope: "org",
          scope_keys: { org_id: "o1" },
          document_id: "doc-1",
          position: 0,
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      await backend.upsert(records);

      expect(mockCollection.upsert).toHaveBeenCalledWith({
        ids: ["rec-1"],
        embeddings: [[0.1, 0.2, 0.3]],
        documents: ["test text"],
        metadatas: [{
          scope: "org",
          scope_keys: '{"org_id":"o1"}',
          document_id: "doc-1",
          position: 0,
          source_label: null,
          created_at: "2024-01-01T00:00:00Z",
        }],
      });
    });
  });

  describe("query", () => {
    it("should query with scope filtering", async () => {
      mockCollection.query.mockResolvedValue({
        ids: [["rec-1"]],
        distances: [[0.5]],
        documents: [["test text"]],
        metadatas: [[{
          scope: "org",
          scope_keys: '{"org_id":"o1"}',
          document_id: "doc-1",
          position: 0,
          created_at: "2024-01-01T00:00:00Z",
        }]],
      });

      const results = await backend.query({
        query_embedding: [0.1, 0.2, 0.3],
        scope: "org",
        scope_keys: { org_id: "o1" },
        top_k: 5,
      });

      expect(mockCollection.query).toHaveBeenCalledWith({
        queryEmbeddings: [[0.1, 0.2, 0.3]],
        nResults: 10, // top_k * 2
        where: expect.any(Object),
        include: ["distances", "documents", "metadatas"],
      });

      expect(results).toHaveLength(1);
      expect(results[0].record.id).toBe("rec-1");
    });
  });

  describe("isAvailable", () => {
    it("should return true when heartbeat succeeds", async () => {
      mockClient.heartbeat.mockResolvedValue(1);
      const available = await backend.isAvailable();
      expect(available).toBe(true);
    });

    it("should return false when heartbeat fails", async () => {
      mockClient.heartbeat.mockRejectedValue(new Error("Connection failed"));
      const available = await backend.isAvailable();
      expect(available).toBe(false);
    });
  });
});
```

### 6.2 Integration Tests

```typescript
// src/memory/default-store.test.ts - Add:

describe("Chroma backend integration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.CHROMA_URL = process.env.CHROMA_URL || "http://localhost:8000";
    process.env.MEMORY_BACKEND = "vector";
    resetConfigForTest();
    setDefaultStore(null);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetConfigForTest();
    setDefaultStore(null);
  });

  it.skipIf(!process.env.CHROMA_URL)("creates Chroma vector store when CHROMA_URL is set", async () => {
    bootstrap();
    const store = getDefaultStore();
    expect(store).toBeInstanceOf(VectorRetrievalAdapter);
    
    // Verify it works end-to-end
    await store.ingest?.({
      document_id: "chroma-doc",
      text: "Chroma vector storage test",
      scope: "org",
      scope_keys: { org_id: "test-org" },
    });

    const out = await store.retrieve({
      query_text: "vector storage",
      scope: "org",
      scope_keys: { org_id: "test-org" },
      top_k: 3,
    });

    expect(out.hits.length).toBeGreaterThan(0);
    expect(out.degraded).toBeFalsy();
  });
});
```

---

## 7. Docker & Infrastructure

### 7.1 Docker Compose Example

```yaml
# docker-compose.chroma.yml
version: "3.8"

services:
  chroma:
    image: chromadb/chroma:0.5.0
    container_name: ai-server-chroma
    ports:
      - "8000:8000"
    volumes:
      - chroma-data:/chroma/chroma
    environment:
      - IS_PERSISTENT=TRUE
      - PERSIST_DIRECTORY=/chroma/chroma
      - ANONYMIZED_TELEMETRY=FALSE
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/heartbeat"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  ai-server:
    build: .
    container_name: ai-server
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - CHROMA_URL=http://chroma:8000
      - CHROMA_COLLECTION=ai_server_prod
      - MEMORY_BACKEND=vector
      - OPENAI_EMBEDDINGS_API_KEY=${OPENAI_EMBEDDINGS_API_KEY}
    depends_on:
      chroma:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  chroma-data:
```

### 7.2 Kubernetes Deployment

```yaml
# k8s/chroma-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chroma
spec:
  replicas: 1
  selector:
    matchLabels:
      app: chroma
  template:
    metadata:
      labels:
        app: chroma
    spec:
      containers:
        - name: chroma
          image: chromadb/chroma:0.5.0
          ports:
            - containerPort: 8000
          env:
            - name: IS_PERSISTENT
              value: "TRUE"
            - name: PERSIST_DIRECTORY
              value: "/data"
            - name: ANONYMIZED_TELEMETRY
              value: "FALSE"
          volumeMounts:
            - name: chroma-storage
              mountPath: /data
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "2Gi"
              cpu: "1000m"
      volumes:
        - name: chroma-storage
          persistentVolumeClaim:
            claimName: chroma-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: chroma
spec:
  selector:
    app: chroma
  ports:
    - port: 8000
      targetPort: 8000
```

---

## 8. Rollout & Migration

### 8.1 Deployment Options

**Option A: Greenfield Deployment (Recommended for new installations)**
1. Deploy Chroma alongside existing Redis
2. Configure `CHROMA_URL` to activate Chroma backend
3. New data goes to Chroma; Redis remains for other services

**Option B: Gradual Migration (For existing Redis deployments)**
1. Dual-write period: Write to both Redis and Chroma
2. Read from Chroma with Redis fallback
3. Validate data consistency
4. Remove Redis vector backend

**Decision:** Option A for initial implementation; Option B documentation for future migrations.

### 8.2 Environment Promotion

| Environment | Backend | Notes |
|-------------|---------|-------|
| Local dev | InMemory or File | Default, no external deps |
| CI/Test | InMemory | Fast, deterministic |
| Staging | Chroma (Docker) | Validate integration |
| Production | Chroma (K8s/Cloud) | Scaled deployment |

### 8.3 Monitoring

```typescript
// Metrics to track
- chroma_upsert_duration_ms
- chroma_query_duration_ms
- chroma_query_results_count
- chroma_connection_errors_total
- chroma_retry_attempts_total
- chroma_scope_filtered_results_count
```

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Chroma client compatibility issues | Medium | High | Pin to tested version; abstract behind interface |
| Scope filtering differences from Redis | Medium | High | Extensive testing; double-check in application layer |
| Performance regression vs Redis | Low | High | Benchmark before rollout; keep Redis as fallback |
| Chroma deployment complexity | Low | Medium | Provide Docker Compose; document ops procedures |
| Embedding dimension mismatch | Low | High | Validate on collection creation; clear error messages |

---

## 10. Success Criteria

- [ ] `ChromaVectorBackend` implements `VectorBackend` interface
- [ ] Unit tests pass with >90% coverage
- [ ] Integration tests pass with real Chroma instance
- [ ] Health checks report accurate Chroma connectivity
- [ ] Documentation updated in 4+ files
- [ ] Docker Compose example provided and tested
- [ ] No regressions in existing Redis/File/InMemory backends
- [ ] Scope-based access control works correctly
- [ ] Performance benchmark shows acceptable latency (<100ms p99 for query)

---

## 11. Post-Implementation

### 11.1 Future Enhancements
- Multi-collection support (scope-based sharding)
- Chroma Cloud integration (managed service)
- Embedding caching layer
- Batch query optimization

### 11.2 Deprecation Path
- Monitor Redis vector backend usage
- Document migration guide for existing Redis users
- Consider deprecating Redis vector backend in v2.0

---

## 12. References

- Chroma Documentation: https://docs.trychroma.com/
- Chroma GitHub: https://github.com/chroma-core/chroma
- Current Redis Backend: `src/memory/redis-vector-backend.ts`
- Vector Backend Interface: `src/memory/vector-retrieval-adapter.ts` (lines 42-51)
- Memory SPEC: `Docs/SPEC/17_MemoryAbstraction_Spec.md`

---

## 13. Handoff Checklist

- [ ] Code review completed
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Runbook created for operations
- [ ] Performance benchmarked
- [ ] Security review (auth tokens, TLS)
- [ ] Monitoring dashboards created
- [ ] Rollback procedure documented

---

**Next Review Date:** 2024-Q3  
**Owner:** TBD  
**Stakeholders:** Platform Team, DevOps, AI Engineering
