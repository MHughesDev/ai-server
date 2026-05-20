/**
 * Production memory persistence guards (PR-006).
 */

import type { Config } from "./schema.js";

/** Fail fast when production would use process-local in-memory memory only. */
export function assertProductionMemory(config: Config): void {
  if (config.env !== "production") return;

  if (config.memory.backend !== "vector") {
    throw new Error(
      "Production requires MEMORY_BACKEND=vector (in_memory is dev/single-process only)"
    );
  }

  const redisUrl = process.env.REDIS_URL?.trim();
  const chromaUrl = process.env.CHROMA_URL?.trim();
  if (!redisUrl && !chromaUrl) {
    throw new Error(
      "Production requires REDIS_URL or CHROMA_URL for persistent vector memory (MEMORY_VECTOR_STORE_PATH is not sufficient for multi-instance production)"
    );
  }
}
