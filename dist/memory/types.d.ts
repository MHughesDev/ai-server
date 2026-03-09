/**
 * Memory and retrieval types – scope, chunks, retrieval results, citations.
 * @see docs/SPEC/17_MemoryAbstraction_Spec.md, L2-06
 */
/** Policy-defined scope for retrieval (user, project, org, none). */
export type RetrievalScope = "user" | "project" | "org" | "none";
/** Caller context used to build scope filters. */
export interface RetrievalCallerContext {
    user_id?: string;
    app_id?: string;
    org_id?: string;
    project_id?: string;
}
/** Chunk metadata for retrieval records (indexed). */
export interface ChunkMetadata {
    chunk_id: string;
    document_id: string;
    scope: RetrievalScope;
    /** Scope-bound keys: e.g. org_id, project_id, user_id */
    scope_keys: Record<string, string>;
    /** Position in document (for ordering/citation) */
    position?: number;
    /** Optional source label for citation (e.g. filename) */
    source_label?: string;
    created_at?: string;
}
/** A single chunk with text and metadata. */
export interface RetrievalChunk {
    text: string;
    metadata: ChunkMetadata;
    /** Optional embedding vector (opaque to abstraction for MVP) */
    embedding?: number[];
}
/** Request to the memory abstraction for retrieval. */
export interface RetrievalRequest {
    query_text: string;
    scope: RetrievalScope;
    scope_keys: Record<string, string>;
    top_k: number;
    /** Optional filters beyond scope */
    filters?: Record<string, unknown>;
}
/** A single retrieval hit with score. */
export interface RetrievalHit {
    chunk: RetrievalChunk;
    score: number;
}
/** Result of a retrieval query. */
export interface RetrievalResult {
    hits: RetrievalHit[];
    /** True if store was unavailable and result is empty fallback */
    degraded?: boolean;
    /** Latency in ms */
    latency_ms?: number;
}
/** Citation format for response envelope (matches contracts Citation). */
export interface CitationSpec {
    source: string;
    ref: string;
    span?: string;
}
/** Input for ingestion (single document). */
export interface IngestionInput {
    document_id: string;
    text: string;
    scope: RetrievalScope;
    scope_keys: Record<string, string>;
    source_label?: string;
}
/** Result of ingestion for one document. */
export interface IngestionResult {
    document_id: string;
    chunks_written: number;
    /** Number of chunks dropped due to ingest cap policy. */
    chunks_dropped?: number;
    error?: string;
}
/** L2-06 Segment I: Structured store – key-value records scoped by scope_keys. */
export interface StructuredRecord {
    key: string;
    scope: RetrievalScope;
    scope_keys: Record<string, string>;
    value: unknown;
    created_at?: string;
    expires_at?: string;
}
/** L2-06 Segment I: Object store – blob by id and scope (e.g. raw documents). */
export interface ObjectBlob {
    id: string;
    scope: RetrievalScope;
    scope_keys: Record<string, string>;
    content: string | Uint8Array;
    content_type?: string;
    created_at?: string;
    expires_at?: string;
}
//# sourceMappingURL=types.d.ts.map