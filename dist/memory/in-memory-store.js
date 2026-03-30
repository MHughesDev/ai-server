/**
 * In-memory memory store – MVP implementation for tests and dev without vector DB.
 * L2-06 Segment I: Optional retention (TTL and max_chunks_per_scope) when provided.
 * @see L2-06 Phase 0, MEM-001/MEM-002
 */
import { scopeAllowsAccess } from "./memory-abstraction.js";
import { chunkText } from "./chunker.js";
import { emitMemoryWriteEvent } from "../observability/taxonomy-events.js";
import { randomUUID } from "node:crypto";
const defaultTopK = 10;
const defaultMaxChunksPerIngest = 128;
function scopeKey(scope, scope_keys) {
    const parts = [scope, ...Object.entries(scope_keys).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v)];
    return parts.join(":");
}
/**
 * In-memory store: chunks stored by scope; retrieval filters by scope and does
 * simple substring match for ranking (no embeddings). Suitable for tests and dev.
 * When retention is set: evicts chunks older than ttl_seconds; evicts oldest per scope when over max_chunks_per_scope.
 */
export class InMemoryStore {
    chunks = [];
    available = true;
    retention;
    constructor(retention) {
        this.retention = retention;
    }
    evictByRetention() {
        if (!this.retention)
            return;
        const now = Date.now();
        if (this.retention.ttl_seconds != null && this.retention.ttl_seconds > 0) {
            const cutoff = new Date(now - this.retention.ttl_seconds * 1000).toISOString();
            this.chunks = this.chunks.filter((s) => (s.chunk.metadata.created_at ?? "") > cutoff);
        }
        const maxChunks = this.retention.max_chunks_per_scope;
        if (maxChunks != null && maxChunks > 0) {
            const byScope = new Map();
            for (const s of this.chunks) {
                const sk = scopeKey(s.chunk.metadata.scope, s.chunk.metadata.scope_keys);
                const list = byScope.get(sk) ?? [];
                list.push(s);
                byScope.set(sk, list);
            }
            this.chunks = [];
            for (const list of byScope.values()) {
                list.sort((a, b) => (a.chunk.metadata.created_at ?? "").localeCompare(b.chunk.metadata.created_at ?? ""));
                const keep = list.slice(-maxChunks);
                this.chunks.push(...keep);
            }
        }
    }
    async retrieve(request) {
        await Promise.resolve(); // satisfy async contract for future async store impl
        this.evictByRetention();
        const start = Date.now();
        if (!this.available) {
            return {
                hits: [],
                degraded: true,
                latency_ms: Date.now() - start,
            };
        }
        const queryNorm = request.query_text.toLowerCase().trim();
        const candidates = [];
        for (const stored of this.chunks) {
            const { chunk } = stored;
            const allowed = scopeAllowsAccess(request.scope, request.scope_keys, chunk.metadata.scope, chunk.metadata.scope_keys);
            if (!allowed)
                continue;
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
            degraded: false,
            latency_ms: Date.now() - start,
        };
    }
    async ingest(input) {
        await Promise.resolve();
        if (!this.available) {
            const unavailable = {
                document_id: input.document_id,
                chunks_written: 0,
                error: "store_unavailable",
            };
            emitMemoryWriteEvent({
                document_id: unavailable.document_id,
                scope: input.scope,
                chunks_written: 0,
                error: unavailable.error,
                store: "in_memory",
            });
            return unavailable;
        }
        const chunkStrings = chunkText(input.text, { chunk_size: 512, overlap: 64 });
        const maxChunksPerIngest = this.retention?.max_chunks_per_ingest ?? defaultMaxChunksPerIngest;
        const capPolicy = this.retention?.ingest_chunk_cap_policy ?? "trim";
        if (chunkStrings.length > maxChunksPerIngest && capPolicy === "reject") {
            const rejected = {
                document_id: input.document_id,
                chunks_written: 0,
                chunks_dropped: chunkStrings.length,
                error: "ingest_chunk_cap_exceeded",
            };
            emitMemoryWriteEvent({
                document_id: rejected.document_id,
                scope: input.scope,
                chunks_written: 0,
                chunks_dropped: rejected.chunks_dropped,
                error: rejected.error,
                store: "in_memory",
            });
            return rejected;
        }
        const boundedChunks = chunkStrings.length > maxChunksPerIngest
            ? chunkStrings.slice(0, maxChunksPerIngest)
            : chunkStrings;
        const dropped = Math.max(0, chunkStrings.length - boundedChunks.length);
        let written = 0;
        for (let i = 0; i < boundedChunks.length; i++) {
            const chunk = {
                text: boundedChunks[i],
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
        this.evictByRetention();
        const done = {
            document_id: input.document_id,
            chunks_written: written,
            chunks_dropped: dropped,
            error: dropped > 0 ? "ingest_chunks_trimmed" : undefined,
        };
        emitMemoryWriteEvent({
            document_id: done.document_id,
            scope: input.scope,
            chunks_written: done.chunks_written,
            chunks_dropped: done.chunks_dropped,
            ...(done.error ? { error: done.error } : {}),
            store: "in_memory",
        });
        return done;
    }
    async isAvailable() {
        await Promise.resolve();
        return this.available;
    }
    /** Test hook: set unavailable to simulate outage. */
    setAvailable(value) {
        this.available = value;
    }
    /** Test hook: clear all chunks. */
    clear() {
        this.chunks = [];
    }
}
function scoreTextMatch(textNorm, queryNorm) {
    if (queryNorm.length === 0)
        return 0;
    if (textNorm.includes(queryNorm)) {
        const count = (textNorm.match(new RegExp(escapeRe(queryNorm), "g")) ?? []).length;
        return 0.5 + Math.min(count * 0.2, 0.5);
    }
    const words = queryNorm.split(/\s+/).filter(Boolean);
    let score = 0;
    for (const w of words) {
        if (w.length < 2)
            continue;
        if (textNorm.includes(w))
            score += 0.15;
    }
    return Math.min(score, 1);
}
function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
//# sourceMappingURL=in-memory-store.js.map