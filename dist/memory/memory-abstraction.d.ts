/**
 * Memory abstraction – governed interface for retrieval and write-back.
 * @see Docs/SPEC/17_MemoryAbstraction_Spec.md
 */
import type { RetrievalRequest, RetrievalResult, RetrievalScope, IngestionInput, IngestionResult } from "./types.js";
/**
 * Scope check: whether a request scope is allowed to access data for given scope_keys.
 * Enforces user/project/org boundaries (org can see project/user; project can see user; user only self).
 */
export declare function scopeAllowsAccess(requestScope: RetrievalScope, requestScopeKeys: Record<string, string>, chunkScope: RetrievalScope, chunkScopeKeys: Record<string, string>): boolean;
/** Memory store interface – retrieval and optional ingestion. */
export interface IMemoryStore {
    /** Retrieve with scope enforcement. Returns empty hits and degraded flag when unavailable. */
    retrieve(request: RetrievalRequest): Promise<RetrievalResult>;
    /** Ingest document chunks (optional; not all stores support). */
    ingest?(input: IngestionInput): Promise<IngestionResult>;
    /** Health check for fallback decision. */
    isAvailable?(): Promise<boolean>;
}
//# sourceMappingURL=memory-abstraction.d.ts.map