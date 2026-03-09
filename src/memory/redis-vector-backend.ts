/**
 * Redis vector backend with connection pooling and retry logic.
 * L2-06: Production vector store implementation with Redis/Valkey.
 * @see L2-06 Phase 6.1
 */

import type {
  VectorBackend,
  VectorRecord,
  VectorQueryResult,
} from "./vector-retrieval-adapter.js";
import type { RetrievalScope } from "./types.js";

export interface RedisVectorBackendOptions {
  /** Redis connection URL (redis://host:port or rediss:// for TLS) */
  url: string;
  /** Connection pool size */
  poolSize?: number;
  /** Key prefix for namespacing */
  keyPrefix?: string;
  /** Command timeout in ms */
  commandTimeoutMs?: number;
  /** Retry attempts for transient failures */
  retryAttempts?: number;
  /** Initial retry delay in ms (exponential backoff) */
  retryDelayMs?: number;
  /** Max retry delay in ms */
  maxRetryDelayMs?: number;
}

interface RedisClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ping(): Promise<string>;
  hset(key: string, field: string, value: string): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  hdel(key: string, ...fields: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  expire(key: string, seconds: number): Promise<number>;
  quit(): Promise<void>;
}

export class RedisVectorBackend implements VectorBackend {
  private client: RedisClient | null = null;
  private readonly options: Required<RedisVectorBackendOptions>;
  private readonly keyPrefix: string;

  constructor(options: RedisVectorBackendOptions) {
    this.options = {
      poolSize: options.poolSize ?? 10,
      keyPrefix: options.keyPrefix ?? "ai:vec:",
      commandTimeoutMs: options.commandTimeoutMs ?? 5000,
      retryAttempts: options.retryAttempts ?? 3,
      retryDelayMs: options.retryDelayMs ?? 100,
      maxRetryDelayMs: options.maxRetryDelayMs ?? 5000,
      ...options,
    };
    this.keyPrefix = this.options.keyPrefix;
  }

  private async getClient(): Promise<RedisClient> {
    if (this.client) return this.client;

    // Dynamic import to handle optional dependency
    try {
      const { Redis } = await import("ioredis");
      this.client = new Redis(this.options.url, {
        maxRetriesPerRequest: this.options.retryAttempts,
        retryStrategy: (times: number) => {
          const delay = Math.min(
            this.options.retryDelayMs * Math.pow(2, times - 1),
            this.options.maxRetryDelayMs
          );
          return delay;
        },
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: this.options.commandTimeoutMs,
      }) as unknown as RedisClient;

      await this.client.connect();
      return this.client;
    } catch (err) {
      throw new Error(
        `Failed to create Redis client: ${err instanceof Error ? err.message : String(err)}. ` +
          "Ensure ioredis is installed: npm install ioredis"
      );
    }
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < this.options.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // Don't retry on non-transient errors
        if (attempt < this.options.retryAttempts - 1) {
          const delay = Math.min(
            this.options.retryDelayMs * Math.pow(2, attempt),
            this.options.maxRetryDelayMs
          );
          await sleep(delay);
        }
      }
    }
    throw lastError ?? new Error("Operation failed after retries");
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    const client = await this.getClient();

    await this.withRetry(async () => {
      for (const record of records) {
        const key = this.recordKey(record.id);
        const embeddingJson = JSON.stringify(record.embedding);
        await client.hset(key, "embedding", embeddingJson);
        await client.hset(key, "text", record.text);
        await client.hset(key, "scope", record.scope);
        await client.hset(key, "scope_keys", JSON.stringify(record.scope_keys));
        await client.hset(key, "document_id", record.document_id);
        await client.hset(key, "position", String(record.position));
        if (record.source_label) {
          await client.hset(key, "source_label", record.source_label);
        }
        await client.hset(key, "created_at", record.created_at);
      }
    });
  }

  async query(input: {
    query_embedding: number[];
    scope: RetrievalScope;
    scope_keys: Record<string, string>;
    top_k: number;
  }): Promise<VectorQueryResult[]> {
    const client = await this.getClient();

    return this.withRetry(async () => {
      // Get all record keys
      const keys = await client.keys(`${this.keyPrefix}*`);
      const matches: VectorQueryResult[] = [];

      for (const key of keys) {
        const data = await client.hgetall(key);
        if (!data || Object.keys(data).length === 0) continue;

        const record: VectorRecord = {
          id: key.replace(this.keyPrefix, ""),
          text: data["text"] ?? "",
          embedding: JSON.parse(data["embedding"] ?? "[]"),
          scope: data["scope"] as RetrievalScope,
          scope_keys: JSON.parse(data["scope_keys"] ?? "{}"),
          document_id: data["document_id"] ?? "",
          position: parseInt(data["position"] ?? "0", 10),
          source_label: data["source_label"],
          created_at: data["created_at"] ?? new Date().toISOString(),
        };

        // Check scope access
        if (!this.scopeAllowsAccess(input.scope, input.scope_keys, record.scope, record.scope_keys)) {
          continue;
        }

        const score = cosineSimilarity(input.query_embedding, record.embedding);
        matches.push({ record, score });
      }

      // Sort by score descending and return top_k
      matches.sort((a, b) => b.score - a.score);
      return matches.slice(0, input.top_k);
    });
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.withRetry(async () => {
        await this.client!.ping();
      });
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  private recordKey(id: string): string {
    return `${this.keyPrefix}${id}`;
  }

  private scopeAllowsAccess(
    requestScope: RetrievalScope,
    requestScopeKeys: Record<string, string>,
    chunkScope: RetrievalScope,
    chunkScopeKeys: Record<string, string>
  ): boolean {
    if (requestScope === "none" || chunkScope === "none") return false;

    const hierarchy: Record<RetrievalScope, number> = {
      user: 1,
      project: 2,
      org: 3,
      none: 0,
    };

    const reqLevel = hierarchy[requestScope];
    const chunkLevel = hierarchy[chunkScope];
    if (reqLevel < chunkLevel) return false;

    if (requestScope === "user") {
      return (
        chunkScopeKeys["user_id"] !== undefined &&
        chunkScopeKeys["user_id"] === requestScopeKeys["user_id"]
      );
    }

    if (requestScope === "project") {
      const userMatch =
        chunkScopeKeys["user_id"] === undefined ||
        chunkScopeKeys["user_id"] === requestScopeKeys["user_id"];
      const projectMatch =
        chunkScopeKeys["project_id"] !== undefined &&
        chunkScopeKeys["project_id"] === requestScopeKeys["project_id"];
      return userMatch && projectMatch;
    }

    if (requestScope === "org") {
      return (
        chunkScopeKeys["org_id"] !== undefined &&
        chunkScopeKeys["org_id"] === requestScopeKeys["org_id"]
      );
    }

    return false;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
