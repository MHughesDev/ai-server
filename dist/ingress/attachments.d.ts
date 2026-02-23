/**
 * Attachment validation – type, size, count, mime allowlist (L2-07 Phase 0).
 * @see Docs/SPEC/04_Ingress_Spec.md, Docs/SPEC/19_Security_and_Isolation_Spec.md
 */
import type { Attachment } from "../contracts/request-envelope.js";
/** Deterministic reject reason for attachment validation */
export type AttachmentRejectReason = "unsupported_type" | "count_exceeded" | "too_large" | "invalid_mime" | "missing_content";
export interface AttachmentValidationLimits {
    maxCount: number;
    maxBytesPerAttachment: number;
    /** Allowed MIME types (lowercase); empty = allow any declared mime */
    allowedMimeTypes: string[];
    /** Allowed attachment types from schema */
    allowedTypes: ("image" | "pdf" | "json" | "other")[];
}
export declare function getDefaultAttachmentLimits(): AttachmentValidationLimits;
export interface AttachmentValidationResult {
    valid: true;
}
export interface AttachmentValidationRejection {
    valid: false;
    reason: AttachmentRejectReason;
    attachmentId?: string;
    detail?: Record<string, unknown>;
}
export type AttachmentValidationOutcome = AttachmentValidationResult | AttachmentValidationRejection;
/**
 * Validate attachments for count, type, size (content_b64 decoded), and mime allowlist.
 * Deterministic: same input always yields same outcome.
 */
export declare function validateAttachments(attachments: Attachment[], limits?: Partial<AttachmentValidationLimits>): AttachmentValidationOutcome;
//# sourceMappingURL=attachments.d.ts.map