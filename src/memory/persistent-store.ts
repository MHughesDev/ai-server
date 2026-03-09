/**
 * Persistent Memory Store Interface
 * Gap 3C: Persistent Memory Configuration
 * Unified interface for multiple persistent backends
 */

import type { RetrievalChunk, StructuredRecord, ObjectBlob } from "./types.js";

export type PersistentBackend = "redis" | "postgres" | "mongodb" | "s3";

export interface PersistentMemoryConfig {
  backend: PersistentBackend;
  /** Redis configuration */
  redis?: {
    url?: string;
    cluster?: boolean;
    sentinel?: boolean;
    masterName?: string;
    keyPrefix?: string;
    ttlSeconds?: number;
    maxRetries?: number;
    retryDelayMs?: number;
  };
  /** PostgreSQL configuration */
  postgres?: {
    connectionString?: string;
    tablePrefix?: string;
    poolSize?: number;
  };
  /** MongoDB configuration */
  mongodb?: {
    url?: string;
    database?: string;
    collectionPrefix?: string;
  };
  /** S3-compatible configuration */
  s3?: {
    endpoint?: string;
    region?: string;
    bucket?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    prefix?: string;
  };
}

export interface PersistentMemoryStore {
  /** Initialize connection */
  initialize(): Promise<void>;

  /** Health check */
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }>;

  // Retrieval chunks
  storeChunks(chunks: RetrievalChunk[]): Promise<void>;
  retrieveChunks(query: {
    scope_keys: Record<string, string>;
    top_k: number;
    filters?: Record<string, unknown>;
  }): Promise<RetrievalChunk[]>;
  deleteChunks(chunkIds: string[]): Promise<void>;

  // Structured records
  storeRecord(record: StructuredRecord): Promise<void>;
  getRecord(key: string, scope_keys: Record<string, string>): Promise<StructuredRecord | null>;
  deleteRecord(key: string, scope_keys: Record<string, string>): Promise<void>;
  queryRecords(query: {
    prefix?: string;
    scope_keys: Record<string, string>;
  }): Promise<StructuredRecord[]>;

  // Object blobs
  storeBlob(blob: ObjectBlob): Promise<void>;
  getBlob(id: string, scope_keys: Record<string, string>): Promise<ObjectBlob | null>;
  deleteBlob(id: string, scope_keys: Record<string, string>): Promise<void>;

  // TTL and cleanup
  setTTL(key: string, ttlSeconds: number): Promise<void>;
  cleanupExpired(): Promise<number>;

  /** Close connection */
  close(): Promise<void>;
}

/** Factory function to create persistent store */
export async function createPersistentStore(
  config: PersistentMemoryConfig
): Promise<PersistentMemoryStore> {
  switch (config.backend) {
    case "redis": {
      const { RedisPersistentStore } = await import("./persistent-adapters/redis-store.js");
      return new RedisPersistentStore(config.redis ?? {});
    }
    case "postgres": {
      const { PostgresPersistentStore } = await import("./persistent-adapters/postgres-store.js");
      return new PostgresPersistentStore(config.postgres ?? {});
    }
    case "mongodb": {
      const { MongoPersistentStore } = await import("./persistent-adapters/mongo-store.js");
      return new MongoPersistentStore(config.mongodb ?? {});
    }
    case "s3": {
      const { S3PersistentStore } = await import("./persistent-adapters/s3-store.js");
      return new S3PersistentStore(config.s3 ?? {});
    }
    default:
      throw new Error(`Unknown persistent backend: ${config.backend}`);
  }
}
