/**
 * Default memory store for the server – production-ready implementation with Redis support.
 * L2-06 Segment I: Memory gateway composes vector + structured + object stores; getDefaultStore returns gateway vector store.
 * @see L2-06, docs/SPEC/17_MemoryAbstraction_Spec.md
 */

import type { IMemoryStore } from "./memory-abstraction.js";
import type { IMemoryGateway } from "./memory-gateway.js";
import { createMemoryGateway } from "./memory-gateway.js";
import { InMemoryStore } from "./in-memory-store.js";
import { getConfig } from "../bootstrap/index.js";
import type { MemoryRetentionConfig, MemoryRuntimeConfig, EmbeddingConfig } from "../config/schema.js";
import { InMemoryStructuredStore } from "./structured-store.js";
import { InMemoryObjectStore } from "./object-store.js";
import {
  FileVectorBackend,
  HashEmbeddingProvider,
  InMemoryVectorBackend,
  OpenAiEmbeddingProvider,
  VectorRetrievalAdapter,
  type EmbeddingProvider,
} from "./vector-retrieval-adapter.js";
import { RedisVectorBackend } from "./redis-vector-backend.js";
import { RetryConfigs } from "../utils/retry.js";

let defaultStore: IMemoryStore | null = null;
let gatewayInstance: IMemoryGateway | null = null;

/**
 * Return the default memory store (lazy singleton). Used by query-handler and tests.
 * This is the vector store from the memory gateway.
 * PRODUCTION: Supports Redis vector backend for production deployments.
 */
export function getDefaultStore(): IMemoryStore {
  if (!defaultStore) {
    const memoryRuntime = getMemoryRuntimeConfig();
    const retention = getMemoryRetentionConfig();

    if (memoryRuntime.backend === "vector") {
      defaultStore = createVectorStore(memoryRuntime);
    } else {
      defaultStore = new InMemoryStore({
        ttl_seconds: retention?.ttl_seconds,
        max_chunks_per_scope: retention?.max_chunks_per_scope,
        max_chunks_per_ingest: memoryRuntime.max_chunks_per_ingest,
        ingest_chunk_cap_policy: memoryRuntime.ingest_chunk_cap_policy,
      });
    }
  }
  return defaultStore;
}

/**
 * Create an embedding provider based on configuration.
 * L2-06 Gap A: Supports hash (deterministic local), openai (OpenAI API), and gateway (model gateway) providers.
 */
function createEmbeddingProvider(config: EmbeddingConfig): EmbeddingProvider {
  switch (config.provider) {
    case "openai": {
      const apiKey = process.env[config.api_key_env]?.trim();
      if (!apiKey) {
        console.warn(
          `[memory] Embedding provider 'openai' selected but ${config.api_key_env} is not set. Falling back to hash provider.`
        );
        return new HashEmbeddingProvider(config.dimensions);
      }
      return new OpenAiEmbeddingProvider(
        apiKey,
        config.model,
        config.base_url || "https://api.openai.com"
      );
    }
    case "gateway": {
      // Not implemented: no IModelGateway → embeddings bridge yet; hash is deterministic local fallback.
      console.warn(
        `[memory] Embedding provider 'gateway' is not implemented; using hash embeddings until a model-gateway embedding path exists.`
      );
      return new HashEmbeddingProvider(config.dimensions);
    }
    case "hash":
    default:
      return new HashEmbeddingProvider(config.dimensions);
  }
}

/**
 * Create a production-ready vector store with retry logic.
 * L2-06 Gap A: Uses embedding configuration from config schema for vector similarity search.
 */
function createVectorStore(
  memoryRuntime: MemoryRuntimeConfig
): IMemoryStore {
  const embeddingConfig = memoryRuntime.embedding;
  const embeddingProvider = createEmbeddingProvider(embeddingConfig);
  const retention = getMemoryRetentionConfig();
  const retentionForVector =
    retention.ttl_seconds != null || retention.max_chunks_per_scope != null
      ? {
          ttl_seconds: retention.ttl_seconds,
          max_chunks_per_scope: retention.max_chunks_per_scope,
        }
      : undefined;

  // Determine vector backend type
  const redisUrl = process.env.REDIS_URL?.trim();
  const vectorStorePath = process.env.MEMORY_VECTOR_STORE_PATH?.trim();

  let vectorBackend;

  if (redisUrl) {
    // Production: Redis vector backend with connection pooling
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
    /** TTL / per-scope caps: `VectorRetrievalAdapter` calls `pruneRetention` on retrieve/ingest (in-memory, file, and Redis vector backends). */
    retention: retentionForVector,
  });
}

/**
 * Replace default store (e.g. for tests or production vector DB).
 * Invalidates the cached gateway so next getMemoryGateway() uses the new store.
 */
export function setDefaultStore(store: IMemoryStore | null): void {
  defaultStore = store;
  gatewayInstance = null;
}

/**
 * Return the memory gateway (vector + structured + object stores). Scope and retention enforced by each store.
 * Vector store is the same instance returned by getDefaultStore() so tests can setDefaultStore(mock) and use the gateway.
 */
export function getMemoryGateway(): IMemoryGateway {
  if (!gatewayInstance) {
    const retention = getMemoryRetentionConfig();
    gatewayInstance = createMemoryGateway({
      vectorStoreGetter: getDefaultStore,
      structuredStore: new InMemoryStructuredStore(),
      objectStore: new InMemoryObjectStore(),
      retention,
    });
  }
  return gatewayInstance;
}

function getMemoryRetentionConfig(): MemoryRetentionConfig {
  try {
    return getConfig().memoryRetention;
  } catch {
    return {};
  }
}

function getMemoryRuntimeConfig(): MemoryRuntimeConfig {
  try {
    return getConfig().memory;
  } catch {
    return {
      retrieval_timeout_ms: 1_500,
      max_context_chars: 4_000,
      max_context_tokens: 1_000,
      max_chunks_per_ingest: 128,
      ingest_chunk_cap_policy: "trim",
      backend: "in_memory",
      embedding: {
        provider: "hash",
        model: "text-embedding-3-small",
        api_key_env: "OPENAI_API_KEY",
        dimensions: 1536,
      },
    };
  }
}
