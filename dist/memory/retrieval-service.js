/**
 * Retrieval service – scoped retrieval with fallback and observability.
 * @see L2-06 Phase 1–3, MEM-003, MEM-006
 */
import { citationsFromRetrievalHits } from "./citation-formatter.js";
const DEFAULT_TOP_K = 5;
/**
 * Build scope_keys from caller context for the given scope.
 */
export function scopeKeysFromCaller(_scope, caller) {
    const keys = {};
    if (caller.org_id)
        keys["org_id"] = caller.org_id;
    if (caller.project_id)
        keys["project_id"] = caller.project_id;
    if (caller.user_id)
        keys["user_id"] = caller.user_id;
    if (caller.app_id)
        keys["app_id"] = caller.app_id;
    return keys;
}
/**
 * Run scoped retrieval and format citations + context text.
 * On store failure, returns degraded result (empty hits, empty citations, empty context).
 */
export async function runRetrieval(store, input) {
    const topK = input.top_k ?? DEFAULT_TOP_K;
    const scopeKeys = scopeKeysFromCaller(input.scope, input.caller);
    const request = {
        query_text: input.query_text,
        scope: input.scope,
        scope_keys: scopeKeys,
        top_k: topK,
    };
    const result = await store.retrieve(request);
    const citations = citationsFromRetrievalHits(result.hits);
    const contextText = result.hits
        .map((h) => h.chunk.text)
        .filter(Boolean)
        .join("\n\n");
    return {
        result,
        citations,
        contextText,
    };
}
//# sourceMappingURL=retrieval-service.js.map