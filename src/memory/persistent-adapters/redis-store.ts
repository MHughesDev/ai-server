/**
 * Redis Persistent Store Adapter
 * Gap 3C: Persistent Memory Configuration
 * With connection pooling, retry logic, and circuit breaker
 */

import type {
  PersistentMemoryStore,
  PersistentMemoryConfig,
} from "../persistent-store.js";
import type { RetrievalChunk, StructuredRecord, ObjectBlob } from "../types.js";

interface RedisClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ping(): Promise<string>;
  set(key: string, value: string, options?: { EX?: number }): Promise<void>;
  get(key: string): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  hset(key: string, field: string, value: string): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  hdel(key: string, ...fields: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  expire(key: string, seconds: number): Promise<number>;
  quit(): Promise<void>;
}

export class RedisPersistentStore implements PersistentMemoryStore {
  private client: RedisClient | null = null;
  private config: NonNullable<PersistentMemoryConfig["redis"]>;
  private keyPrefix: string;
  private isConnected = false;
  private circuitBreaker = {
    failures: 0,
    lastFailure: 0,
    state: "CLOSED" as "CLOSED" | "OPEN" | "HALF_OPEN",
  };

  constructor(config: PersistentMemoryConfig["redis"]) {
    this.config = {
      url: config?.url ?? "redis://localhost:6379",
      cluster: config?.cluster ?? false,
      sentinel: config?.sentinel ?? false,
      masterName: config?.masterName ?? "mymaster",
      keyPrefix: config?.keyPrefix ?? "ai:memory:",
      ttlSeconds: config?.ttlSeconds ?? 86400, // 24 hours default
      maxRetries: config?.maxRetries ?? 3,
      retryDelayMs: config?.retryDelayMs ?? 100,
    };
    this.keyPrefix = this.config.keyPrefix!;
  }

  private async getClient(): Promise<RedisClient> {
    // Circuit breaker check
    if (this.circuitBreaker.state === "OPEN") {
      const now = Date.now();
      if (now - this.circuitBreaker.lastFailure < 30000) {
        throw new Error("Circuit breaker is OPEN - Redis temporarily unavailable");
      }
      this.circuitBreaker.state = "HALF_OPEN";
      console.log("[redis-store] Circuit breaker entering HALF_OPEN state");
    }

    if (this.client && this.isConnected) {
      return this.client;
    }

    try {
      const { Redis } = await import("ioredis");

      let client: RedisClient;

      if (this.config.cluster) {
        // Redis Cluster mode
        const cluster = new (Redis as unknown as { Cluster: new (...args: unknown[]) => unknown }).Cluster(
          [{ host: this.config.url!.replace(/^redis:\/\//, "").split(":")[0], port: parseInt(this.config.url!.split(":")[1] ?? "6379", 10) }],
          {
            maxRetriesPerRequest: this.config.maxRetries,
            retryDelayOnFailover: this.config.retryDelayMs,
            retryDelayOnClusterDown: this.config.retryDelayMs,
          }
        ) as RedisClient;
        client = cluster;
      } else if (this.config.sentinel) {
        // Redis Sentinel mode for high availability
        client = new Redis({
          sentinels: [{ host: this.config.url!.replace(/^redis:\/\//, "").split(":")[0], port: parseInt(this.config.url!.split(":")[1] ?? "6379") }],
          name: this.config.masterName,
          maxRetriesPerRequest: this.config.maxRetries,
        }) as unknown as RedisClient;
      } else {
        // Standard Redis mode
        client = new Redis(this.config.url!, {
          maxRetriesPerRequest: this.config.maxRetries,
          retryStrategy: (times: number) => {
            const delay = Math.min(this.config.retryDelayMs! * Math.pow(2, times - 1), 5000);
            return delay;
          },
          lazyConnect: true,
          keepAlive: 30000,
          connectTimeout: 10000,
          commandTimeout: 5000,
        }) as unknown as RedisClient;
      }

      await client.connect();
      this.client = client;
      this.isConnected = true;

      // Record success - close circuit breaker
      if (this.circuitBreaker.state === "HALF_OPEN") {
        this.circuitBreaker.state = "CLOSED";
        this.circuitBreaker.failures = 0;
        console.log("[redis-store] Circuit breaker closed - Redis is healthy");
      }

      return client;
    } catch (err) {
      this.recordFailure();
      throw new Error(
        `Failed to connect to Redis: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();
    this.isConnected = false;

    if (this.circuitBreaker.failures >= 5) {
      this.circuitBreaker.state = "OPEN";
      console.error("[redis-store] Circuit breaker opened due to repeated failures");
    }
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < this.config.maxRetries!; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.config.maxRetries! - 1) {
          const delay = Math.min(this.config.retryDelayMs! * Math.pow(2, attempt), 5000);
          await sleep(delay);
        }
      }
    }
    this.recordFailure();
    throw lastError ?? new Error("Operation failed after retries");
  }

  async initialize(): Promise<void> {
    await this.getClient();
    console.log("[redis-store] Redis persistent store initialized");
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const client = await this.getClient();
      await this.withRetry(() => client.ping());
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async storeChunks(chunks: RetrievalChunk[]): Promise<void> {
    const client = await this.getClient();

    await this.withRetry(async () => {
      for (const chunk of chunks) {
        const key = this.chunkKey(chunk.metadata.chunk_id, chunk.metadata.scope_keys);
        const value = JSON.stringify({
          text: chunk.text,
          metadata: chunk.metadata,
          embedding: chunk.embedding,
        });
        await client.set(key, value, { EX: this.config.ttlSeconds });
      }
    });
  }

  async retrieveChunks(query: {
    scope_keys: Record<string, string>;
    top_k: number;
    filters?: Record<string, unknown>;
  }): Promise<RetrievalChunk[]> {
    const client = await this.getClient();

    return this.withRetry(async () => {
      // Get all keys matching the scope pattern
      const pattern = this.scopePattern(query.scope_keys);
      const keys = await client.keys(pattern);

      const chunks: RetrievalChunk[] = [];
      for (const key of keys) {
        const value = await client.get(key);
        if (value) {
          const data = JSON.parse(value) as { text: string; metadata: RetrievalChunk["metadata"]; embedding?: number[] };
          chunks.push({
            text: data.text,
            metadata: data.metadata,
            embedding: data.embedding,
          });
        }
      }

      // Simple scoring (in production, use vector similarity)
      chunks.sort((a, b) => b.metadata.position! - a.metadata.position!);

      return chunks.slice(0, query.top_k);
    });
  }

  async deleteChunks(chunkIds: string[]): Promise<void> {
    const client = await this.getClient();

    await this.withRetry(async () => {
      for (const id of chunkIds) {
        // We need to find the key first - this is a simplification
        const keys = await client.keys(`${this.keyPrefix}chunk:*:${id}`);
        for (const key of keys) {
          await client.del(key);
        }
      }
    });
  }

  async storeRecord(record: StructuredRecord): Promise<void> {
    const client = await this.getClient();

    await this.withRetry(async () => {
      const key = this.recordKey(record.key, record.scope_keys);
      const value = JSON.stringify({
        value: record.value,
        scope: record.scope,
        scope_keys: record.scope_keys,
        created_at: record.created_at ?? new Date().toISOString(),
        expires_at: record.expires_at,
      });
      const ttl = record.expires_at
        ? Math.floor((new Date(record.expires_at).getTime() - Date.now()) / 1000)
        : this.config.ttlSeconds;
      await client.set(key, value, { EX: Math.max(1, ttl!) });
    });
  }

  async getRecord(key: string, scope_keys: Record<string, string>): Promise<StructuredRecord | null> {
    const client = await this.getClient();

    return this.withRetry(async () => {
      const recordKey = this.recordKey(key, scope_keys);
      const value = await client.get(recordKey);
      if (!value) return null;

      const data = JSON.parse(value) as { value: unknown; scope: string; scope_keys: Record<string, string>; created_at: string; expires_at?: string };
      return {
        key,
        scope: data.scope as StructuredRecord["scope"],
        scope_keys: data.scope_keys,
        value: data.value,
        created_at: data.created_at,
        expires_at: data.expires_at,
      };
    });
  }

  async deleteRecord(key: string, scope_keys: Record<string, string>): Promise<void> {
    const client = await this.getClient();

    await this.withRetry(async () => {
      const recordKey = this.recordKey(key, scope_keys);
      await client.del(recordKey);
    });
  }

  async queryRecords(query: {
    prefix?: string;
    scope_keys: Record<string, string>;
  }): Promise<StructuredRecord[]> {
    const client = await this.getClient();

    return this.withRetry(async () => {
      const pattern = query.prefix
        ? `${this.keyPrefix}record:${this.scopeToString(query.scope_keys)}:${query.prefix}*`
        : `${this.keyPrefix}record:${this.scopeToString(query.scope_keys)}:*`;

      const keys = await client.keys(pattern);
      const records: StructuredRecord[] = [];

      for (const key of keys) {
        const value = await client.get(key);
        if (value) {
          const data = JSON.parse(value) as { value: unknown; scope: string; scope_keys: Record<string, string>; created_at: string; expires_at?: string };
          const keyParts = key.split(":");
          records.push({
            key: keyParts[keyParts.length - 1]!,
            scope: data.scope as StructuredRecord["scope"],
            scope_keys: data.scope_keys,
            value: data.value,
            created_at: data.created_at,
            expires_at: data.expires_at,
          });
        }
      }

      return records;
    });
  }

  async storeBlob(blob: ObjectBlob): Promise<void> {
    const client = await this.getClient();

    await this.withRetry(async () => {
      const key = this.blobKey(blob.id, blob.scope_keys);
      const content = typeof blob.content === "string" ? blob.content : Buffer.from(blob.content).toString("base64");
      const value = JSON.stringify({
        content,
        content_type: blob.content_type,
        scope: blob.scope,
        scope_keys: blob.scope_keys,
        created_at: blob.created_at ?? new Date().toISOString(),
        expires_at: blob.expires_at,
        is_binary: typeof blob.content !== "string",
      });
      const ttl = blob.expires_at
        ? Math.floor((new Date(blob.expires_at).getTime() - Date.now()) / 1000)
        : this.config.ttlSeconds;
      await client.set(key, value, { EX: Math.max(1, ttl!) });
    });
  }

  async getBlob(id: string, scope_keys: Record<string, string>): Promise<ObjectBlob | null> {
    const client = await this.getClient();

    return this.withRetry(async () => {
      const key = this.blobKey(id, scope_keys);
      const value = await client.get(key);
      if (!value) return null;

      const data = JSON.parse(value) as { content: string; content_type?: string; scope: string; scope_keys: Record<string, string>; created_at: string; expires_at?: string; is_binary: boolean };
      return {
        id,
        scope: data.scope as ObjectBlob["scope"],
        scope_keys: data.scope_keys,
        content: data.is_binary ? Buffer.from(data.content, "base64") : data.content,
        content_type: data.content_type,
        created_at: data.created_at,
        expires_at: data.expires_at,
      };
    });
  }

  async deleteBlob(id: string, scope_keys: Record<string, string>): Promise<void> {
    const client = await this.getClient();

    await this.withRetry(async () => {
      const key = this.blobKey(id, scope_keys);
      await client.del(key);
    });
  }

  async setTTL(key: string, ttlSeconds: number): Promise<void> {
    const client = await this.getClient();

    await this.withRetry(async () => {
      await client.expire(key, ttlSeconds);
    });
  }

  async cleanupExpired(): Promise<number> {
    // Redis handles expiration automatically
    return 0;
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }

  // Helper methods
  private chunkKey(chunkId: string, scopeKeys: Record<string, string>): string {
    return `${this.keyPrefix}chunk:${this.scopeToString(scopeKeys)}:${chunkId}`;
  }

  private recordKey(key: string, scopeKeys: Record<string, string>): string {
    return `${this.keyPrefix}record:${this.scopeToString(scopeKeys)}:${key}`;
  }

  private blobKey(id: string, scopeKeys: Record<string, string>): string {
    return `${this.keyPrefix}blob:${this.scopeToString(scopeKeys)}:${id}`;
  }

  private scopeToString(scopeKeys: Record<string, string>): string {
    return Object.entries(scopeKeys)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(":");
  }

  private scopePattern(scopeKeys: Record<string, string>): string {
    const scopeStr = this.scopeToString(scopeKeys);
    return `${this.keyPrefix}chunk:${scopeStr}:*`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
