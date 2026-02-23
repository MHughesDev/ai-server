/**
 * Retrieval service – scoped retrieval with fallback and observability.
 * @see L2-06 Phase 1–3, MEM-003, MEM-006
 */
import type { IMemoryStore } from "./memory-abstraction.js";
import type { RetrievalScope, RetrievalResult, RetrievalCallerContext, CitationSpec } from "./types.js";
export interface RetrievalServiceInput {
    query_text: string;
    scope: RetrievalScope;
    caller: RetrievalCallerContext;
    top_k?: number;
}
export interface RetrievalServiceResult {
    result: RetrievalResult;
    citations: CitationSpec[];
    /** Context text to prepend to model prompt (concatenated chunks). */
    contextText: string;
}
/**
 * Build scope_keys from caller context for the given scope.
 */
export declare function scopeKeysFromCaller(_scope: RetrievalScope, caller: RetrievalCallerContext): Record<string, string>;
/**
 * Run scoped retrieval and format citations + context text.
 * On store failure, returns degraded result (empty hits, empty citations, empty context).
 */
export declare function runRetrieval(store: IMemoryStore, input: RetrievalServiceInput): Promise<RetrievalServiceResult>;
//# sourceMappingURL=retrieval-service.d.ts.map