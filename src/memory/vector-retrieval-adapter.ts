/**
 * Vector retrieval adapter path with embedding + vector backend abstraction.
 * Provides a production-ready interface boundary; default backend/provider are in-memory.
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { IMemoryStore } from "./memory-abstraction.js";
import { scopeAllowsAccess } from "./memory-abstraction.js";
import { chunkText } from "./chunker.js";
import { emitMemoryWriteEvent } from "../observability/taxonomy-events.js";
import type {
  IngestionInput,
  IngestionResult,
  RetrievalChunk,
  RetrievalRequest,
  RetrievalResult,
  RetrievalScope,
} from "./types.js";

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

export interface VectorRecord {
  id: string;
  text: string;
  embedding: number[];
  scope: RetrievalScope;
  scope_keys: Record<string, string>;
  document_id: string;
  position: number;
  source_label?: string;
  created_at: string;
}

export interface VectorQueryResult {
  record: VectorRecord;
  score: number;
}

/** Same shape as config `memoryRetention` — applied to vector records’ `created_at` and scope grouping. */
export interface VectorRetentionPolicy {
  ttl_seconds?: number;
  max_chunks_per_scope?: number;
}

export interface VectorBackend {
  upsert(records: VectorRecord[]): Promise<void>;
  query(input: {
    query_embedding: number[];
    scope: RetrievalScope;
    scope_keys: Record<string, string>;
    top_k: number;
  }): Promise<VectorQueryResult[]>;
  isAvailable?(): Promise<boolean>;
  /**
   * Optional: evict by TTL / max chunks per scope (parity with `InMemoryStore` retention).
   * Implemented by `InMemoryVectorBackend`, `FileVectorBackend`, and `RedisVectorBackend` (WANT-035).
   */
  pruneRetention?(policy: VectorRetentionPolicy): Promise<void>;
}

export function vectorScopeKey(scope: RetrievalScope, scope_keys: Record<string, string>): string {
  const parts = [
    scope,
    ...Object.entries(scope_keys)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => v),
  ];
  return parts.join(":");
}

/** Evict by TTL first, then cap chunks per scope (keep newest by `created_at`). Exported for tests. */
export function evictVectorRecords(
  records: VectorRecord[],
  policy: VectorRetentionPolicy
): VectorRecord[] {
  let out = records;
  if (policy.ttl_seconds != null && policy.ttl_seconds > 0) {
    const cutoff = new Date(Date.now() - policy.ttl_seconds * 1000).toISOString();
    out = out.filter((r) => r.created_at > cutoff);
  }
  const maxChunks = policy.max_chunks_per_scope;
  if (maxChunks == null || maxChunks <= 0) {
    return out;
  }
  const byScope = new Map<string, VectorRecord[]>();
  for (const r of out) {
    const sk = vectorScopeKey(r.scope, r.scope_keys);
    const list = byScope.get(sk) ?? [];
    list.push(r);
    byScope.set(sk, list);
  }
  const next: VectorRecord[] = [];
  for (const list of byScope.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    next.push(...list.slice(-maxChunks));
  }
  return next;
}

export interface VectorRetrievalAdapterOptions {
  chunk_size?: number;
  overlap?: number;
  max_chunks_per_ingest?: number;
  ingest_chunk_cap_policy?: "trim" | "reject";
  /** In-memory / file vector backends only; see `VectorBackend.pruneRetention`. */
  retention?: VectorRetentionPolicy;
}

const DEFAULT_CHUNK_SIZE = 512;
const DEFAULT_CHUNK_OVERLAP = 64;
const DEFAULT_MAX_CHUNKS_PER_INGEST = 128;

function normalizeVectorRetention(r?: VectorRetentionPolicy): VectorRetentionPolicy | undefined {
  if (!r) return undefined;
  const hasTtl = r.ttl_seconds != null && r.ttl_seconds > 0;
  const hasCap = r.max_chunks_per_scope != null && r.max_chunks_per_scope > 0;
  if (!hasTtl && !hasCap) return undefined;
  return { ttl_seconds: r.ttl_seconds, max_chunks_per_scope: r.max_chunks_per_scope };
}

/**
 * Deterministic local embedding provider for tests/dev.
 * Replace this with provider API adapter for production deployments.
 */
export class HashEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly dimensions = 64) {}

  async embed(texts: string[]): Promise<number[][]> {
    await Promise.resolve();
    return texts.map((text) => this.embedOne(text));
  }

  private embedOne(text: string): number[] {
    const vec = new Array<number>(this.dimensions).fill(0);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const bucket = (code + i) % this.dimensions;
      vec[bucket] += 1;
    }
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return vec;
    return vec.map((v) => v / norm);
  }
}

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model = "text-embedding-3-small",
    private readonly baseUrl = "https://api.openai.com"
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    const response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });
    if (!response.ok) {
      throw new Error(`embedding provider request failed (${response.status})`);
    }
    const payload = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    return (payload.data ?? []).map((d) => d.embedding ?? []);
  }
}

/** In-memory vector backend for local runtime/tests behind backend abstraction. */
export class InMemoryVectorBackend implements VectorBackend {
  private records: VectorRecord[] = [];
  private available = true;

  async upsert(records: VectorRecord[]): Promise<void> {
    await Promise.resolve();
    if (!this.available) throw new Error("vector_backend_unavailable");
    this.records.push(...records);
  }

  async query(input: {
    query_embedding: number[];
    scope: RetrievalScope;
    scope_keys: Record<string, string>;
    top_k: number;
  }): Promise<VectorQueryResult[]> {
    await Promise.resolve();
    if (!this.available) return [];
    const matches: VectorQueryResult[] = [];
    for (const record of this.records) {
      const allowed = scopeAllowsAccess(
        input.scope,
        input.scope_keys,
        record.scope,
        record.scope_keys
      );
      if (!allowed) continue;
      matches.push({
        record,
        score: cosineSimilarity(input.query_embedding, record.embedding),
      });
    }
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, Math.max(0, input.top_k));
  }

  async isAvailable(): Promise<boolean> {
    await Promise.resolve();
    return this.available;
  }

  setAvailable(value: boolean): void {
    this.available = value;
  }

  clear(): void {
    this.records = [];
  }

  async pruneRetention(policy: VectorRetentionPolicy): Promise<void> {
    await Promise.resolve();
    this.records = evictVectorRecords(this.records, policy);
  }
}

export class FileVectorBackend implements VectorBackend {
  private records: VectorRecord[] | null = null;

  constructor(private readonly storePath: string) {}

  private async load(): Promise<VectorRecord[]> {
    if (this.records) return this.records;
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as VectorRecord[];
      this.records = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.records = [];
    }
    return this.records;
  }

  private async persist(): Promise<void> {
    const current = this.records ?? [];
    await mkdir(dirname(this.storePath), { recursive: true });
    await writeFile(this.storePath, JSON.stringify(current), "utf8");
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    const existing = await this.load();
    existing.push(...records);
    this.records = existing;
    await this.persist();
  }

  async pruneRetention(policy: VectorRetentionPolicy): Promise<void> {
    const existing = await this.load();
    this.records = evictVectorRecords(existing, policy);
    await this.persist();
  }

  async query(input: {
    query_embedding: number[];
    scope: RetrievalScope;
    scope_keys: Record<string, string>;
    top_k: number;
  }): Promise<VectorQueryResult[]> {
    const existing = await this.load();
    const matches: VectorQueryResult[] = [];
    for (const record of existing) {
      const allowed = scopeAllowsAccess(
        input.scope,
        input.scope_keys,
        record.scope,
        record.scope_keys
      );
      if (!allowed) continue;
      matches.push({
        record,
        score: cosineSimilarity(input.query_embedding, record.embedding),
      });
    }
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, Math.max(0, input.top_k));
  }

  isAvailable(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

type NormalizedVectorAdapterOpts = Required<
  Pick<
    VectorRetrievalAdapterOptions,
    "chunk_size" | "overlap" | "max_chunks_per_ingest" | "ingest_chunk_cap_policy"
  >
>;

export class VectorRetrievalAdapter implements IMemoryStore {
  private readonly options: NormalizedVectorAdapterOpts;
  private readonly retentionPolicy: VectorRetentionPolicy | undefined;

  constructor(
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly backend: VectorBackend,
    options?: VectorRetrievalAdapterOptions
  ) {
    this.options = {
      chunk_size: options?.chunk_size ?? DEFAULT_CHUNK_SIZE,
      overlap: options?.overlap ?? DEFAULT_CHUNK_OVERLAP,
      max_chunks_per_ingest: options?.max_chunks_per_ingest ?? DEFAULT_MAX_CHUNKS_PER_INGEST,
      ingest_chunk_cap_policy: options?.ingest_chunk_cap_policy ?? "trim",
    };
    this.retentionPolicy = normalizeVectorRetention(options?.retention);
  }

  private async applyVectorRetention(): Promise<void> {
    if (!this.retentionPolicy || !this.backend.pruneRetention) return;
    await this.backend.pruneRetention(this.retentionPolicy);
  }

  async retrieve(request: RetrievalRequest): Promise<RetrievalResult> {
    await this.applyVectorRetention();
    const start = Date.now();
    const vectors = await this.embeddingProvider.embed([request.query_text]);
    const queryVector = vectors[0] ?? [];
    const results = await this.backend.query({
      query_embedding: queryVector,
      scope: request.scope,
      scope_keys: request.scope_keys,
      top_k: request.top_k,
    });
    const hits = results.map((r) => ({
      score: r.score,
      chunk: {
        text: r.record.text,
        embedding: r.record.embedding,
        metadata: {
          chunk_id: r.record.id,
          document_id: r.record.document_id,
          scope: r.record.scope,
          scope_keys: { ...r.record.scope_keys },
          position: r.record.position,
          source_label: r.record.source_label,
          created_at: r.record.created_at,
        },
      } as RetrievalChunk,
    }));
    return { hits, latency_ms: Date.now() - start };
  }

  async ingest(input: IngestionInput): Promise<IngestionResult> {
    const rawChunks = chunkText(input.text, {
      chunk_size: this.options.chunk_size,
      overlap: this.options.overlap,
    });

    if (rawChunks.length > this.options.max_chunks_per_ingest) {
      if (this.options.ingest_chunk_cap_policy === "reject") {
        const rejected: IngestionResult = {
          document_id: input.document_id,
          chunks_written: 0,
          chunks_dropped: rawChunks.length,
          error: "ingest_chunk_cap_exceeded",
        };
        emitMemoryWriteEvent({
          document_id: rejected.document_id,
          scope: input.scope,
          chunks_written: 0,
          chunks_dropped: rejected.chunks_dropped,
          error: rejected.error,
          backend: "vector",
        });
        return rejected;
      }
    }

    const cappedChunks =
      this.options.ingest_chunk_cap_policy === "trim"
        ? rawChunks.slice(0, this.options.max_chunks_per_ingest)
        : rawChunks;

    const dropped = Math.max(0, rawChunks.length - cappedChunks.length);
    const embeddings = await this.embeddingProvider.embed(cappedChunks);
    const now = new Date().toISOString();
    const records: VectorRecord[] = cappedChunks.map((text, index) => ({
      id: randomUUID(),
      text,
      embedding: embeddings[index] ?? [],
      scope: input.scope,
      scope_keys: { ...input.scope_keys },
      document_id: input.document_id,
      position: index,
      source_label: input.source_label,
      created_at: now,
    }));
    await this.backend.upsert(records);
    await this.applyVectorRetention();
    const done: IngestionResult = {
      document_id: input.document_id,
      chunks_written: records.length,
      chunks_dropped: dropped,
      error: dropped > 0 ? "ingest_chunks_trimmed" : undefined,
    };
    emitMemoryWriteEvent({
      document_id: done.document_id,
      scope: input.scope,
      chunks_written: done.chunks_written,
      chunks_dropped: done.chunks_dropped,
      ...(done.error ? { error: done.error } : {}),
      backend: "vector",
    });
    return done;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.backend.isAvailable) return true;
    return this.backend.isAvailable();
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
