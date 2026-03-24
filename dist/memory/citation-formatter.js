/**
 * Citation formatter – build response citations from retrieval hits.
 * @see L2-06 Phase 2, MEM-005, docs/SPEC/17_MemoryAbstraction_Spec.md
 */
/**
 * Build citation list from retrieval hits for response envelope.
 * source = source_label or document_id; ref = chunk_id or doc#chunk; span = excerpt.
 */
export function citationsFromRetrievalHits(hits) {
    const seen = new Set();
    const out = [];
    for (const hit of hits) {
        const meta = hit.chunk.metadata;
        const ref = meta.chunk_id || `${meta.document_id}#${meta.position ?? out.length}`;
        if (seen.has(ref))
            continue;
        seen.add(ref);
        out.push({
            source: meta.source_label ?? meta.document_id,
            ref,
            span: hit.chunk.text.slice(0, 200).trim() + (hit.chunk.text.length > 200 ? "…" : ""),
        });
    }
    return out;
}
//# sourceMappingURL=citation-formatter.js.map