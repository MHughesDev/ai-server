/**
 * Error taxonomy – deterministic ingress and runtime error codes.
 * @see docs/SPEC/02_API_Contracts.md, L2-01 error model
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
  /** Async POST /v1/query/async: Idempotency-Key reused with a different request body */
  "IDEMPOTENCY_KEY_CONFLICT",
  /** Job HTTP API: queue worker not configured (`routes.ts` 503) */
  "ASYNC_NOT_AVAILABLE",
  /** GET /v1/jobs/{id}: malformed job id */
  "INVALID_JOB_ID",
  /** GET /v1/jobs/{id}: no such job */
  "JOB_NOT_FOUND",
  /** POST /v1/jobs/{id}/cancel: job missing or not cancellable */
  "CANNOT_CANCEL",
  /** GET /admin/flags*: feature flag service not initialized */
  "FLAGS_NOT_AVAILABLE",
  /**
   * HTTP layer: overall request processing timeout (`withRequestTimeout` on `/v1/query`).
   * Distinct from TOOL_TIMEOUT (tool gateway).
   */
  "TIMEOUT",
  /** No matching route (fall-through in `routes.ts`) */
  "NOT_FOUND",
  /** `POST /v1/query` when `runtime_mvp_query_chat_enabled` is false */
  "MVP_QUERY_DISABLED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Map from error code to HTTP status suggestion and retry guidance */
export const ERROR_TAXONOMY: Record<
  ErrorCode,
  { httpStatus: number; retryable: boolean; description: string }
> = {
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
  IDEMPOTENCY_KEY_CONFLICT: {
    httpStatus: 409,
    retryable: false,
    description: "Idempotency-Key already used for a different async query body in this scope",
  },
  ASYNC_NOT_AVAILABLE: {
    httpStatus: 503,
    retryable: true,
    description: "Async job queue is not configured",
  },
  INVALID_JOB_ID: {
    httpStatus: 400,
    retryable: false,
    description: "Job id path parameter is not valid",
  },
  JOB_NOT_FOUND: {
    httpStatus: 404,
    retryable: false,
    description: "No job exists for the given id",
  },
  CANNOT_CANCEL: {
    httpStatus: 409,
    retryable: false,
    description: "Job cannot be cancelled (missing or already completed)",
  },
  FLAGS_NOT_AVAILABLE: {
    httpStatus: 503,
    retryable: true,
    description: "Feature flag service not initialized",
  },
  TIMEOUT: {
    httpStatus: 504,
    retryable: true,
    description: "HTTP request processing exceeded configured timeout",
  },
  NOT_FOUND: {
    httpStatus: 404,
    retryable: false,
    description: "No handler for the requested path/method",
  },
  MVP_QUERY_DISABLED: {
    httpStatus: 404,
    retryable: false,
    description: "MVP query/chat route disabled by feature flag",
  },
};

export function isErrorCode(code: string): code is ErrorCode {
  return ERROR_CODES.includes(code as ErrorCode);
}

export function getErrorMeta(code: ErrorCode): (typeof ERROR_TAXONOMY)[ErrorCode] {
  return ERROR_TAXONOMY[code];
}
