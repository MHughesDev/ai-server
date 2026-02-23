/**
 * Text chunker – fixed-size chunks with optional overlap for retrieval.
 * @see L2-06 Phase 0, MEM-001
 */
export interface ChunkerOptions {
    /** Target chunk size in characters. Default 512. */
    chunk_size?: number;
    /** Overlap in characters between consecutive chunks. Default 64. */
    overlap?: number;
    /** Minimum chunk size (merge tiny tail). Default 32. */
    min_chunk_size?: number;
}
/**
 * Split text into overlapping chunks. Tries to break on sentence/word boundaries when possible.
 */
export declare function chunkText(text: string, options?: ChunkerOptions): string[];
//# sourceMappingURL=chunker.d.ts.map