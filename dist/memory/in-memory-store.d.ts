/**
 * In-memory memory store – MVP implementation for tests and dev without vector DB.
 * @see L2-06 Phase 0, MEM-001/MEM-002
 */
import type { IMemoryStore } from "./memory-abstraction.js";
import type { RetrievalRequest, RetrievalResult, IngestionInput, IngestionResult } from "./types.js";
/**
 * In-memory store: chunks stored by scope; retrieval filters by scope and does
 * simple substring match for ranking (no embeddings). Suitable for tests and dev.
 */
export declare class InMemoryStore implements IMemoryStore {
    private chunks;
    private available;
    retrieve(request: RetrievalRequest): Promise<RetrievalResult>;
    ingest(input: IngestionInput): Promise<IngestionResult>;
    isAvailable(): Promise<boolean>;
    /** Test hook: set unavailable to simulate outage. */
    setAvailable(value: boolean): void;
    /** Test hook: clear all chunks. */
    clear(): void;
}
//# sourceMappingURL=in-memory-store.d.ts.map