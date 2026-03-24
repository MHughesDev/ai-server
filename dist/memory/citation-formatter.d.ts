/**
 * Citation formatter – build response citations from retrieval hits.
 * @see L2-06 Phase 2, MEM-005, docs/SPEC/17_MemoryAbstraction_Spec.md
 */
import type { RetrievalHit } from "./types.js";
import type { CitationSpec } from "./types.js";
/**
 * Build citation list from retrieval hits for response envelope.
 * source = source_label or document_id; ref = chunk_id or doc#chunk; span = excerpt.
 */
export declare function citationsFromRetrievalHits(hits: RetrievalHit[]): CitationSpec[];
//# sourceMappingURL=citation-formatter.d.ts.map