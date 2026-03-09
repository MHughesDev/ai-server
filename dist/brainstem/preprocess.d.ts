/**
 * Multimodal preprocessing – deterministic metadata and token estimates (L2-07 Phase 1).
 * @see docs/SPEC/05_BrainStem_Spec.md
 */
import type { Attachment } from "../contracts/request-envelope.js";
export interface PreprocessResult {
    token_estimate: number;
    mime?: string;
}
/**
 * Preprocess a single attachment: normalize mime and compute token estimate.
 * Deterministic: no I/O, same input yields same output.
 */
export declare function preprocessAttachment(attachment: Attachment): PreprocessResult;
/**
 * Preprocess all attachments; returns array of results in same order.
 */
export declare function preprocessAttachments(attachments: Attachment[]): PreprocessResult[];
//# sourceMappingURL=preprocess.d.ts.map