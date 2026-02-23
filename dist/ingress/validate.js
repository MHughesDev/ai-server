/**
 * Ingress validation – deterministic envelope validation and rejection.
 * @see Docs/SPEC/04_Ingress_Spec.md, L2-02 Phase 0
 */
import { ZodError } from "zod";
import { validateRequestEnvelope, CONTRACT_VERSION, } from "../contracts/index.js";
import { ERROR_CODES, getErrorMeta } from "../contracts/errors.js";
import { validateAttachments, getDefaultAttachmentLimits, } from "./attachments.js";
/**
 * Normalize request id: use header value if envelope has none, or keep envelope.
 * Mutates obj.request_id if missing and header present.
 */
function normalizeRequestId(obj, requestIdHeader) {
    if (requestIdHeader && typeof requestIdHeader === "string" && requestIdHeader.trim()) {
        const rid = obj.request_id || requestIdHeader.trim();
        if (!obj.request_id)
            obj.request_id = rid;
    }
}
/**
 * Validate and normalize request envelope; returns IngressResult or throws IngressRejection.
 * Order: body size (caller checks), request id normalization, schema validation, contract version, auth stub.
 */
export function validateIngress(body, opts) {
    if (opts.contentLength !== undefined && opts.contentLength > opts.maxBodyBytes) {
        throw createRejection("INVALID_PAYLOAD", "Request body exceeds max size", {
            max_bytes: opts.maxBodyBytes,
            received: opts.contentLength,
        });
    }
    if (body === null || body === undefined) {
        throw createRejection("INVALID_PAYLOAD", "Request body is required", {});
    }
    const obj = typeof body === "object" && body !== null ? body : undefined;
    if (!obj || Array.isArray(body)) {
        throw createRejection("INVALID_PAYLOAD", "Request body must be a JSON object", {});
    }
    normalizeRequestId(obj, opts.requestIdHeader);
    let envelope;
    try {
        envelope = validateRequestEnvelope(body);
    }
    catch (err) {
        if (err instanceof ZodError) {
            const issues = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
            throw createRejection("INVALID_PAYLOAD", "Request envelope validation failed", {
                details: issues,
            });
        }
        throw createRejection("INVALID_PAYLOAD", "Invalid request envelope", {});
    }
    const requiredVersion = opts.contractVersion ?? CONTRACT_VERSION;
    if (envelope.contract_version !== requiredVersion) {
        throw createRejection("CONTRACT_VERSION_UNSUPPORTED", "Unsupported contract_version", {
            expected: requiredVersion,
            received: envelope.contract_version,
        });
    }
    if (opts.requireAuthHeader && !opts.authHeader) {
        throw createRejection("AUTH_INVALID", "Missing or invalid authorization", {});
    }
    if (opts.multimodalInputPathEnabled && envelope.input?.attachments?.length) {
        const outcome = validateAttachments(envelope.input.attachments, opts.attachmentLimits ?? getDefaultAttachmentLimits());
        if (!outcome.valid) {
            throw createRejection("ATTACHMENT_REJECTED", `Attachment validation failed: ${outcome.reason}`, {
                attachment_reason: outcome.reason,
                attachment_id: outcome.attachmentId,
                ...outcome.detail,
            });
        }
    }
    const callerContext = {
        appId: envelope.caller.app_id,
        userId: envelope.caller.user_id,
        orgId: envelope.caller.org_id,
        sessionId: envelope.caller.session_id,
        scopes: envelope.caller.scopes ?? [],
    };
    return { envelope, callerContext };
}
function createRejection(code, message, detail) {
    return {
        code,
        message,
        detail: Object.keys(detail).length ? detail : undefined,
        httpStatus: getErrorMeta(code).httpStatus,
        retryable: getErrorMeta(code).retryable,
    };
}
export { ERROR_CODES, getErrorMeta };
//# sourceMappingURL=validate.js.map