/**
 * In-memory memory store – MVP implementation for tests and dev without vector DB.
 * @see L2-06 Phase 0, MEM-001/MEM-002
 */

import type { IMemoryStore } from "./memory-abstraction.js";
import { scopeAllowsAccess } from "./memory-abstraction.js";
import type {
  RetrievalRequest,
  RetrievalResult,
  RetrievalChunk,
  RetrievalHit,
  IngestionInput,
  IngestionResult,
} from "./types.js";
import { chunkText } from "./chunker.js";
import { randomUUID } from "node:crypto";

interface StoredChunk {
  chunk: RetrievalChunk;
  /** Simple text match score placeholder (no real embedding). */
  textNorm: string;
}

const defaultTopK = 10;

/**
 * In-memory store: chunks stored by scope; retrieval filters by scope and does
 * simple substring match for ranking (no embeddings). Suitable for tests and dev.
 */
export class InMemoryStore implements IMemoryStore {
  private chunks: StoredChunk[] = [];
  private available = true;

  async retrieve(request: RetrievalRequest): Promise<RetrievalResult> {
    await Promise.resolve(); // satisfy async contract for future async store impl
    const start = Date.now();
    if (!this.available) {
      return {
        hits: [],
        degraded: true,
        latency_ms: Date.now() - start,
      };
    }
    const queryNorm = request.query_text.toLowerCase().trim();
    const candidates: RetrievalHit[] = [];
    for (const stored of this.chunks) {
      const { chunk } = stored;
      const allowed = scopeAllowsAccess(
        request.scope,
        request.scope_keys,
        chunk.metadata.scope,
        chunk.metadata.scope_keys
      );
      if (!allowed) continue;
      const score = queryNorm.length
        ? scoreTextMatch(stored.textNorm, queryNorm)
        : 0;
      if (score > 0) {
        candidates.push({ chunk, score });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const topK = Math.min(request.top_k || defaultTopK, candidates.length);
    const hits = candidates.slice(0, topK);
    return {
      hits,
      latency_ms: Date.now() - start,
    };
  }

  async ingest(input: IngestionInput): Promise<IngestionResult> {
    await Promise.resolve();
    if (!this.available) {
      return {
        document_id: input.document_id,
        chunks_written: 0,
        error: "store_unavailable",
      };
    }
    const chunkStrings = chunkText(input.text, { chunk_size: 512, overlap: 64 });
    let written = 0;
    for (let i = 0; i < chunkStrings.length; i++) {
      const chunk: RetrievalChunk = {
        text: chunkStrings[i],
        metadata: {
          chunk_id: randomUUID(),
          document_id: input.document_id,
          scope: input.scope,
          scope_keys: { ...input.scope_keys },
          position: i,
          source_label: input.source_label,
          created_at: new Date().toISOString(),
        },
      };
      this.chunks.push({
        chunk,
        textNorm: chunk.text.toLowerCase(),
      });
      written++;
    }
    return { document_id: input.document_id, chunks_written: written };
  }

  async isAvailable(): Promise<boolean> {
    await Promise.resolve();
    return this.available;
  }

  /** Test hook: set unavailable to simulate outage. */
  setAvailable(value: boolean): void {
    this.available = value;
  }

  /** Test hook: clear all chunks. */
  clear(): void {
    this.chunks = [];
  }
}

function scoreTextMatch(textNorm: string, queryNorm: string): number {
  if (queryNorm.length === 0) return 0;
  if (textNorm.includes(queryNorm)) {
    const count = (textNorm.match(new RegExp(escapeRe(queryNorm), "g")) ?? []).length;
    return 0.5 + Math.min(count * 0.2, 0.5);
  }
  const words = queryNorm.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const w of words) {
    if (w.length < 2) continue;
    if (textNorm.includes(w)) score += 0.15;
  }
  return Math.min(score, 1);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
