/**
 * Ingress validation – deterministic envelope validation and rejection.
 * @see Docs/SPEC/04_Ingress_Spec.md, L2-02 Phase 0
 */
import { type ErrorCode, ERROR_CODES, getErrorMeta } from "../contracts/errors.js";
import type { IngressResult } from "./types.js";
import { type AttachmentValidationLimits } from "./attachments.js";
export interface IngressValidateOptions {
    /** Max body size in bytes */
    maxBodyBytes: number;
    /** Raw body length (for size check before parse) */
    contentLength?: number;
    /** Optional request id from header (normalized into envelope if envelope missing) */
    requestIdHeader?: string;
    /** Auth stub: if true and authHeader missing, reject with AUTH_INVALID */
    requireAuthHeader?: boolean;
    /** Auth header value expected (e.g. Bearer token) */
    authHeader?: string;
    /** Contract version required; default v1 */
    contractVersion?: string;
    /** L2-07: When true, validate attachments (type/size/count/mime); reject with ATTACHMENT_REJECTED on failure */
    multimodalInputPathEnabled?: boolean;
    /** L2-07: Attachment limits when multimodalInputPathEnabled; defaults from getDefaultAttachmentLimits() */
    attachmentLimits?: Partial<AttachmentValidationLimits>;
}
/**
 * Validate and normalize request envelope; returns IngressResult or throws IngressRejection.
 * Order: body size (caller checks), request id normalization, schema validation, contract version, auth stub.
 */
export declare function validateIngress(body: unknown, opts: IngressValidateOptions): IngressResult;
export { ERROR_CODES, getErrorMeta };
export type { ErrorCode };
export type { IngressRejection } from "./errors.js";
//# sourceMappingURL=validate.d.ts.map