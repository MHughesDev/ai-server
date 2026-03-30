/**
 * Error taxonomy – deterministic ingress and runtime error codes.
 * @see docs/SPEC/02_API_Contracts.md, L2-01 error model
 */
export declare const ERROR_CODES: readonly ["AUTH_INVALID", "RATE_LIMITED", "POLICY_BLOCKED", "BUDGET_EXCEEDED", "TOOL_TIMEOUT", "MODEL_FAILURE", "INTERNAL_ERROR", "INVALID_PAYLOAD", "CONTRACT_VERSION_UNSUPPORTED", "RETRIEVAL_UNAVAILABLE", "ATTACHMENT_REJECTED", "MULTIMODAL_UNSUPPORTED", "IDEMPOTENCY_KEY_CONFLICT", "ASYNC_NOT_AVAILABLE", "INVALID_JOB_ID", "JOB_NOT_FOUND", "CANNOT_CANCEL", "FLAGS_NOT_AVAILABLE", "TIMEOUT", "NOT_FOUND", "MVP_QUERY_DISABLED"];
export type ErrorCode = (typeof ERROR_CODES)[number];
/** Map from error code to HTTP status suggestion and retry guidance */
export declare const ERROR_TAXONOMY: Record<ErrorCode, {
    httpStatus: number;
    retryable: boolean;
    description: string;
}>;
export declare function isErrorCode(code: string): code is ErrorCode;
export declare function getErrorMeta(code: ErrorCode): (typeof ERROR_TAXONOMY)[ErrorCode];
//# sourceMappingURL=errors.d.ts.map