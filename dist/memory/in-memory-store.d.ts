/**
 * In-memory memory store – MVP implementation for tests and dev without vector DB.
 * L2-06 Segment I: Optional retention (TTL and max_chunks_per_scope) when provided.
 * @see L2-06 Phase 0, MEM-001/MEM-002
 */
import type { IMemoryStore } from "./memory-abstraction.js";
import type { RetrievalRequest, RetrievalResult, IngestionInput, IngestionResult } from "./types.js";
/** L2-06 Segment I: Retention options for in-memory store (matches config MemoryRetentionConfig shape). */
export interface MemoryRetentionOptions {
    ttl_seconds?: number;
    max_chunks_per_scope?: number;
    /** Max chunks accepted per ingest call before policy applies. */
    max_chunks_per_ingest?: number;
    /** Policy when ingest chunk count exceeds max_chunks_per_ingest. */
    ingest_chunk_cap_policy?: "trim" | "reject";
}
/**
 * In-memory store: chunks stored by scope; retrieval filters by scope and does
 * simple substring match for ranking (no embeddings). Suitable for tests and dev.
 * When retention is set: evicts chunks older than ttl_seconds; evicts oldest per scope when over max_chunks_per_scope.
 */
export declare class InMemoryStore implements IMemoryStore {
    private chunks;
    private available;
    private readonly retention;
    constructor(retention?: MemoryRetentionOptions);
    private evictByRetention;
    retrieve(request: RetrievalRequest): Promise<RetrievalResult>;
    ingest(input: IngestionInput): Promise<IngestionResult>;
    isAvailable(): Promise<boolean>;
    /** Test hook: set unavailable to simulate outage. */
    setAvailable(value: boolean): void;
    /** Test hook: clear all chunks. */
    clear(): void;
}
//# sourceMappingURL=in-memory-store.d.ts.map