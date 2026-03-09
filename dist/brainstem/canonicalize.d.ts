/**
 * Brain Stem – text canonicalization and input normalization.
 * @see docs/SPEC/05_BrainStem_Spec.md, L2-02 Phase 1, L2-07 Phase 1
 */
import type { RequestEnvelope } from "../contracts/request-envelope.js";
import type { CanonicalRequest } from "../contracts/canonical-request.js";
/**
 * Build CanonicalRequest from validated RequestEnvelope.
 * Normalizes text (trim, single string), maps attachments to handles with token estimates, sets modalities.
 */
export declare function canonicalize(envelope: RequestEnvelope): CanonicalRequest;
//# sourceMappingURL=canonicalize.d.ts.map