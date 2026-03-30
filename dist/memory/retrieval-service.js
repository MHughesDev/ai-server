/**
 * Retrieval service – scoped retrieval with fallback and observability.
 * L2-06 Phase 6.2: Token-based context capping for accurate LLM context budgeting.
 * @see L2-06 Phase 1–3, MEM-003, MEM-006
 */
import { citationsFromRetrievalHits } from "./citation-formatter.js";
import { buildTokenBoundedContext, DEFAULT_MAX_CONTEXT_TOKENS, AVG_CHARS_PER_TOKEN, } from "../utils/tokens.js";
import { emitMemoryQueryEvent } from "../observability/taxonomy-events.js";
const DEFAULT_TOP_K = 5;
const DEFAULT_RETRIEVAL_TIMEOUT_MS = 1_500;
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
 * PRODUCTION: Uses token-based context capping for accurate LLM context budgeting.
 */
export async function runRetrieval(store, input) {
    const topK = input.top_k ?? DEFAULT_TOP_K;
    const timeoutMs = input.retrieval_timeout_ms ?? DEFAULT_RETRIEVAL_TIMEOUT_MS;
    // Prefer token-based budget, fall back to character-based with conversion
    const maxContextTokens = input.max_context_tokens ??
        (input.max_context_chars ? Math.floor(input.max_context_chars / AVG_CHARS_PER_TOKEN) : undefined) ??
        DEFAULT_MAX_CONTEXT_TOKENS;
    const scopeKeys = scopeKeysFromCaller(input.scope, input.caller);
    const request = {
        query_text: input.query_text,
        scope: input.scope,
        scope_keys: scopeKeys,
        top_k: topK,
    };
    const start = Date.now();
    const result = await withTimeoutOrDegraded(store.retrieve(request), timeoutMs, start);
    emitMemoryQueryEvent({
        hit_count: result.hits.length,
        latency_ms: result.latency_ms ?? Date.now() - start,
        scope: input.scope,
        degraded: result.degraded === true,
    });
    // Use token-bounded context building for accurate LLM budgeting
    const bounded = buildTokenBoundedContext(result.hits.map((h) => ({ text: h.chunk.text, ...h })), { maxTokens: maxContextTokens });
    const hitsIncluded = bounded.includedIndices.map((i) => result.hits[i]);
    const citations = citationsFromRetrievalHits(hitsIncluded);
    return {
        result,
        citations,
        contextText: bounded.contextText,
        contextTokens: {
            estimated: bounded.totalTokens,
            wasTruncated: bounded.wasTruncated,
        },
    };
}
async function withTimeoutOrDegraded(retrievalPromise, timeoutMs, startMs) {
    let timer;
    try {
        return await Promise.race([
            retrievalPromise,
            new Promise((resolve) => {
                timer = setTimeout(() => {
                    resolve({
                        hits: [],
                        degraded: true,
                        latency_ms: Date.now() - startMs,
                    });
                }, timeoutMs);
            }),
        ]);
    }
    catch {
        return {
            hits: [],
            degraded: true,
            latency_ms: Date.now() - startMs,
        };
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
//# sourceMappingURL=retrieval-service.js.map