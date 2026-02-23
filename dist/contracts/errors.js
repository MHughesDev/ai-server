/**
 * Error taxonomy – deterministic ingress and runtime error codes.
 * @see Docs/SPEC/02_API_Contracts.md, L2-01 error model
 */
export const ERROR_CODES = [
    "AUTH_INVALID",
    "RATE_LIMITED",
    "POLICY_BLOCKED",
    "BUDGET_EXCEEDED",
    "TOOL_TIMEOUT",
    "MODEL_FAILURE",
    "INTERNAL_ERROR",
    "INVALID_PAYLOAD",
    "CONTRACT_VERSION_UNSUPPORTED",
    /** L2-06: Retrieval/store unavailable; safe to degrade to non-retrieval path */
    "RETRIEVAL_UNAVAILABLE",
    /** L2-07: Unsupported or invalid attachment (type/size/count/mime) */
    "ATTACHMENT_REJECTED",
    /** L2-07: Request has multimodal content but no capable pipeline allowed */
    "MULTIMODAL_UNSUPPORTED",
];
/** Map from error code to HTTP status suggestion and retry guidance */
export const ERROR_TAXONOMY = {
    AUTH_INVALID: { httpStatus: 401, retryable: false, description: "Authentication failed or token invalid" },
    RATE_LIMITED: { httpStatus: 429, retryable: true, description: "Rate limit or quota exceeded" },
    POLICY_BLOCKED: { httpStatus: 403, retryable: false, description: "Request blocked by policy" },
    BUDGET_EXCEEDED: { httpStatus: 429, retryable: false, description: "Token/cost/tool budget exceeded" },
    TOOL_TIMEOUT: { httpStatus: 504, retryable: true, description: "Tool execution timed out" },
    MODEL_FAILURE: { httpStatus: 502, retryable: true, description: "Model provider or inference failure" },
    INTERNAL_ERROR: { httpStatus: 500, retryable: true, description: "Internal server error" },
    INVALID_PAYLOAD: { httpStatus: 400, retryable: false, description: "Request envelope validation failed" },
    CONTRACT_VERSION_UNSUPPORTED: {
        httpStatus: 400,
        retryable: false,
        description: "Unsupported contract_version",
    },
    RETRIEVAL_UNAVAILABLE: {
        httpStatus: 503,
        retryable: true,
        description: "Memory/retrieval store unavailable; response may be degraded",
    },
    ATTACHMENT_REJECTED: {
        httpStatus: 400,
        retryable: false,
        description: "Attachment validation failed (type, size, count, or mime)",
    },
    MULTIMODAL_UNSUPPORTED: {
        httpStatus: 400,
        retryable: false,
        description: "Multimodal request but no capable pipeline allowed",
    },
};
export function isErrorCode(code) {
    return ERROR_CODES.includes(code);
}
export function getErrorMeta(code) {
    return ERROR_TAXONOMY[code];
}
//# sourceMappingURL=errors.js.map