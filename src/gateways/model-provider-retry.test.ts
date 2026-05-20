/**
 * Model provider retry policy tests (WANT-026).
 */

import {
  classifyModelProviderFailure,
  isRetryableModelProviderHttpStatus,
  parseModelProviderErrorBody,
} from "./model-provider-retry.js";

describe("parseModelProviderErrorBody", () => {
  it("parses nested OpenAI error object", () => {
    const parsed = parseModelProviderErrorBody(
      JSON.stringify({
        error: {
          message: "Incorrect API key",
          type: "invalid_request_error",
          code: "invalid_api_key",
        },
      })
    );
    expect(parsed).toEqual({
      message: "Incorrect API key",
      type: "invalid_request_error",
      code: "invalid_api_key",
      param: undefined,
    });
  });

  it("returns undefined for non-JSON bodies", () => {
    expect(parseModelProviderErrorBody("upstream timeout")).toBeUndefined();
  });
});

describe("classifyModelProviderFailure", () => {
  it("maps invalid_api_key to AUTH_INVALID and non-retryable even on 429", () => {
    const body = JSON.stringify({
      error: { type: "invalid_request_error", code: "invalid_api_key", message: "bad key" },
    });
    expect(classifyModelProviderFailure(401, body)).toEqual({
      code: "AUTH_INVALID",
      retryable: false,
      providerCode: "invalid_api_key",
      providerType: "invalid_request_error",
    });
  });

  it("maps rate_limit_exceeded to RATE_LIMITED and retryable", () => {
    const body = JSON.stringify({
      error: { type: "rate_limit_error", code: "rate_limit_exceeded", message: "slow down" },
    });
    expect(classifyModelProviderFailure(429, body)).toEqual({
      code: "RATE_LIMITED",
      retryable: true,
      providerCode: "rate_limit_exceeded",
      providerType: "rate_limit_error",
    });
  });

  it("maps insufficient_quota to BUDGET_EXCEEDED and non-retryable on 429", () => {
    const body = JSON.stringify({
      error: { type: "insufficient_quota", code: "insufficient_quota", message: "quota" },
    });
    expect(classifyModelProviderFailure(429, body)).toMatchObject({
      code: "BUDGET_EXCEEDED",
      retryable: false,
    });
  });

  it("maps context_length_exceeded to INVALID_PAYLOAD and non-retryable", () => {
    const body = JSON.stringify({
      error: {
        type: "invalid_request_error",
        code: "context_length_exceeded",
        message: "too long",
      },
    });
    expect(classifyModelProviderFailure(400, body)).toMatchObject({
      code: "INVALID_PAYLOAD",
      retryable: false,
    });
  });

  it("maps server_error type to retryable MODEL_FAILURE on 502", () => {
    const body = JSON.stringify({
      error: { type: "server_error", message: "upstream" },
    });
    expect(classifyModelProviderFailure(502, body)).toMatchObject({
      code: "MODEL_FAILURE",
      retryable: true,
      providerType: "server_error",
    });
  });

  it("falls back to HTTP status when body is absent", () => {
    expect(classifyModelProviderFailure(503)).toEqual({
      code: "MODEL_FAILURE",
      retryable: true,
      providerCode: undefined,
      providerType: undefined,
    });
    expect(classifyModelProviderFailure(400)).toEqual({
      code: "INVALID_PAYLOAD",
      retryable: false,
      providerCode: undefined,
      providerType: undefined,
    });
  });
});

describe("isRetryableModelProviderHttpStatus", () => {
  it("treats rate limits, request timeout, and 5xx as retryable", () => {
    expect(isRetryableModelProviderHttpStatus(408)).toBe(true);
    expect(isRetryableModelProviderHttpStatus(429)).toBe(true);
    expect(isRetryableModelProviderHttpStatus(500)).toBe(true);
    expect(isRetryableModelProviderHttpStatus(503)).toBe(true);
  });

  it("does not retry typical client errors including 409 conflict", () => {
    expect(isRetryableModelProviderHttpStatus(400)).toBe(false);
    expect(isRetryableModelProviderHttpStatus(401)).toBe(false);
    expect(isRetryableModelProviderHttpStatus(409)).toBe(false);
  });
});
