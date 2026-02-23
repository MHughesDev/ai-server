/**
 * Attachment validation – type, size, count, mime allowlist (L2-07 Phase 0).
 * @see Docs/SPEC/04_Ingress_Spec.md, Docs/SPEC/19_Security_and_Isolation_Spec.md
 */
const DEFAULT_LIMITS = {
    maxCount: 10,
    maxBytesPerAttachment: 4 * 1024 * 1024, // 4 MiB
    allowedMimeTypes: [
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "application/pdf",
        "application/json",
    ],
    allowedTypes: ["image", "pdf", "json"],
};
export function getDefaultAttachmentLimits() {
    return { ...DEFAULT_LIMITS };
}
/**
 * Validate attachments for count, type, size (content_b64 decoded), and mime allowlist.
 * Deterministic: same input always yields same outcome.
 */
export function validateAttachments(attachments, limits = {}) {
    const lim = { ...DEFAULT_LIMITS, ...limits };
    if (attachments.length > lim.maxCount) {
        return {
            valid: false,
            reason: "count_exceeded",
            detail: { max_count: lim.maxCount, received: attachments.length },
        };
    }
    for (const a of attachments) {
        if (!lim.allowedTypes.includes(a.type)) {
            return {
                valid: false,
                reason: "unsupported_type",
                attachmentId: a.id,
                detail: { type: a.type, allowed: lim.allowedTypes },
            };
        }
        if (a.meta?.mime && lim.allowedMimeTypes.length > 0) {
            const mime = a.meta.mime.toLowerCase().trim();
            if (!lim.allowedMimeTypes.includes(mime)) {
                return {
                    valid: false,
                    reason: "invalid_mime",
                    attachmentId: a.id,
                    detail: { mime: a.meta.mime, allowed: lim.allowedMimeTypes },
                };
            }
        }
        if (a.content_b64) {
            let sizeBytes;
            try {
                sizeBytes = Math.ceil((a.content_b64.length * 3) / 4);
            }
            catch {
                return {
                    valid: false,
                    reason: "too_large",
                    attachmentId: a.id,
                    detail: { message: "Invalid base64 content" },
                };
            }
            if (sizeBytes > lim.maxBytesPerAttachment) {
                return {
                    valid: false,
                    reason: "too_large",
                    attachmentId: a.id,
                    detail: {
                        max_bytes: lim.maxBytesPerAttachment,
                        received_bytes: sizeBytes,
                    },
                };
            }
        }
    }
    return { valid: true };
}
//# sourceMappingURL=attachments.js.map