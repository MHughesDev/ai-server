/**
 * Model provider retry policy by error class (WANT-026).
 * Maps OpenAI-compatible HTTP status + JSON error bodies to taxonomy codes and retryability.
 */

import type { ErrorCode } from "../contracts/errors.js";

export interface ParsedModelProviderError {
  message?: string;
  type?: string;
  code?: string;
  param?: string | null;
}

export interface ModelProviderFailureClassification {
  code: ErrorCode;
  retryable: boolean;
  providerType?: string;
  providerCode?: string;
}

/** Provider `error.code` values that must not be retried. */
const NON_RETRYABLE_PROVIDER_CODES = new Set([
  "invalid_api_key",
  "incorrect_api_key",
  "invalid_organization",
  "model_not_found",
  "model_deprecated",
  "context_length_exceeded",
  "string_above_max_length",
  "insufficient_quota",
  "billing_hard_limit_reached",
  "content_policy_violation",
  "organization_deactivated",
  "permission_denied",
  "access_denied",
]);

/** Provider `error.code` values where a retry may succeed. */
const RETRYABLE_PROVIDER_CODES = new Set([
  "rate_limit_exceeded",
  "engine_overloaded",
  "overloaded",
  "slow_down",
  "server_error",
  "service_unavailable",
  "timeout",
  "request_timeout",
]);

/** Provider `error.type` values that must not be retried. */
const NON_RETRYABLE_PROVIDER_TYPES = new Set([
  "invalid_request_error",
  "authentication_error",
  "authorization_error",
  "insufficient_quota",
  "invalid_api_key",
]);

/** Provider `error.type` values where a retry may succeed. */
const RETRYABLE_PROVIDER_TYPES = new Set([
  "rate_limit_error",
  "server_error",
  "tokens",
  "overloaded_error",
]);

export function parseModelProviderErrorBody(bodyText: string): ParsedModelProviderError | undefined {
  const trimmed = bodyText.trim();
  if (!trimmed.startsWith("{")) return undefined;
  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    const errRaw = json.error ?? json;
    if (!errRaw || typeof errRaw !== "object") return undefined;
    const err = errRaw as Record<string, unknown>;
    return {
      message: typeof err.message === "string" ? err.message : undefined,
      type: typeof err.type === "string" ? err.type : undefined,
      code: typeof err.code === "string" ? err.code : undefined,
      param: err.param === null || typeof err.param === "string" ? err.param : undefined,
    };
  } catch {
    return undefined;
  }
}

function normalizeToken(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase() || undefined;
}

function errorCodeFromProviderHints(
  providerCode: string | undefined,
  providerType: string | undefined,
  httpStatus: number
): ErrorCode {
  if (
    providerCode === "insufficient_quota" ||
    providerCode === "billing_hard_limit_reached" ||
    providerType === "insufficient_quota"
  ) {
    return "BUDGET_EXCEEDED";
  }
  if (
    providerType === "authentication_error" ||
    providerType === "authorization_error" ||
    providerType === "invalid_api_key" ||
    providerCode === "invalid_api_key" ||
    providerCode === "incorrect_api_key" ||
    httpStatus === 401
  ) {
    return "AUTH_INVALID";
  }
  if (
    providerType === "rate_limit_error" ||
    providerCode === "rate_limit_exceeded" ||
    httpStatus === 429
  ) {
    return "RATE_LIMITED";
  }
  if (
    providerCode === "context_length_exceeded" ||
    providerCode === "string_above_max_length" ||
    providerType === "invalid_request_error" ||
    httpStatus === 400 ||
    httpStatus === 404 ||
    httpStatus === 422
  ) {
    return "INVALID_PAYLOAD";
  }
  if (httpStatus >= 500) return "MODEL_FAILURE";
  return "MODEL_FAILURE";
}

/**
 * HTTP statuses from an OpenAI-compatible provider where a retry may succeed
 * when the response body does not specify a non-retryable error class.
 */
export function isRetryableModelProviderHttpStatus(status: number): boolean {
  if (status === 408 || status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

/**
 * Classify provider HTTP failure into platform error code and retry policy.
 * Body `type`/`code` take precedence over raw HTTP status (WANT-026).
 */
export function classifyModelProviderFailure(
  status: number,
  bodyText?: string
): ModelProviderFailureClassification {
  const parsed = bodyText ? parseModelProviderErrorBody(bodyText) : undefined;
  const providerCode = normalizeToken(parsed?.code);
  const providerType = normalizeToken(parsed?.type);

  if (providerCode && NON_RETRYABLE_PROVIDER_CODES.has(providerCode)) {
    return {
      code: errorCodeFromProviderHints(providerCode, providerType, status),
      retryable: false,
      providerCode: parsed?.code,
      providerType: parsed?.type,
    };
  }
  if (providerType && NON_RETRYABLE_PROVIDER_TYPES.has(providerType)) {
    return {
      code: errorCodeFromProviderHints(providerCode, providerType, status),
      retryable: false,
      providerCode: parsed?.code,
      providerType: parsed?.type,
    };
  }
  if (providerCode && RETRYABLE_PROVIDER_CODES.has(providerCode)) {
    return {
      code: errorCodeFromProviderHints(providerCode, providerType, status),
      retryable: true,
      providerCode: parsed?.code,
      providerType: parsed?.type,
    };
  }
  if (providerType && RETRYABLE_PROVIDER_TYPES.has(providerType)) {
    return {
      code: errorCodeFromProviderHints(providerCode, providerType, status),
      retryable: true,
      providerCode: parsed?.code,
      providerType: parsed?.type,
    };
  }

  if (status === 401) {
    return {
      code: "AUTH_INVALID",
      retryable: false,
      providerCode: parsed?.code,
      providerType: parsed?.type,
    };
  }
  if (status === 429) {
    return {
      code: "RATE_LIMITED",
      retryable: true,
      providerCode: parsed?.code,
      providerType: parsed?.type,
    };
  }
  if (status === 400 || status === 404 || status === 422) {
    return {
      code: "INVALID_PAYLOAD",
      retryable: false,
      providerCode: parsed?.code,
      providerType: parsed?.type,
    };
  }

  const retryable = isRetryableModelProviderHttpStatus(status);
  return {
    code: errorCodeFromProviderHints(providerCode, providerType, status),
    retryable,
    providerCode: parsed?.code,
    providerType: parsed?.type,
  };
}
