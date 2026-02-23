/**
 * Text chunker – fixed-size chunks with optional overlap for retrieval.
 * @see L2-06 Phase 0, MEM-001
 */
const DEFAULT_CHUNK_SIZE = 512;
const DEFAULT_OVERLAP = 64;
const DEFAULT_MIN_CHUNK_SIZE = 32;
/**
 * Split text into overlapping chunks. Tries to break on sentence/word boundaries when possible.
 */
export function chunkText(text, options = {}) {
    const chunkSize = options.chunk_size ?? DEFAULT_CHUNK_SIZE;
    const overlap = Math.min(options.overlap ?? DEFAULT_OVERLAP, chunkSize - 1);
    const minChunkSize = options.min_chunk_size ?? DEFAULT_MIN_CHUNK_SIZE;
    if (!text || text.length <= chunkSize) {
        const t = text.trim();
        return t ? [t] : [];
    }
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        let end = Math.min(start + chunkSize, text.length);
        let slice = text.slice(start, end);
        if (end < text.length) {
            const lastNewline = slice.lastIndexOf("\n");
            const lastPeriod = slice.lastIndexOf(". ");
            const lastSpace = slice.lastIndexOf(" ");
            const breakAt = Math.max(lastNewline, lastPeriod, lastSpace);
            if (breakAt > minChunkSize) {
                end = start + breakAt + 1;
                slice = text.slice(start, end);
            }
        }
        const trimmed = slice.trim();
        if (trimmed.length >= minChunkSize || end >= text.length) {
            chunks.push(trimmed);
        }
        start = end - (end < text.length ? overlap : 0);
    }
    return chunks.filter((c) => c.length > 0);
}
//# sourceMappingURL=chunker.js.map