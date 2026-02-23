/**
 * Contract validation tests – deterministic outcomes for CI.
 */

import {
  validateRequestEnvelope,
  validateResponseEnvelope,
  validateCanonicalRequest,
  validateIntentBundle,
  validatePolicyDecision,
  validatePipelinePlan,
  CONTRACT_VERSION,
} from "./index.js";
import { ERROR_CODES, ERROR_TAXONOMY, isErrorCode, getErrorMeta } from "./errors.js";

describe("RequestEnvelope", () => {
  const valid = {
    request_id: "550e8400-e29b-41d4-a716-446655440000",
    caller: { app_id: "a1", user_id: "u1", org_id: "o1", scopes: [] },
    input: { text: "hello", attachments: [], structured: undefined },
    preferences: { response_format: "text", verbosity: "medium", stream: false },
    contract_version: CONTRACT_VERSION,
  };

  it("accepts valid envelope", () => {
    const result = validateRequestEnvelope(valid);
    expect(result.request_id).toBe(valid.request_id);
    expect(result.caller.app_id).toBe("a1");
  });

  it("rejects invalid request_id (not UUID)", () => {
    expect(() => validateRequestEnvelope({ ...valid, request_id: "not-a-uuid" })).toThrow();
  });

  it("rejects missing required caller", () => {
    expect(() => validateRequestEnvelope({ ...valid, caller: undefined })).toThrow();
  });

  it("rejects invalid preference enum", () => {
    expect(() =>
      validateRequestEnvelope({
        ...valid,
        preferences: { ...valid.preferences, response_format: "xml" },
      })
    ).toThrow();
  });

  it("accepts any contract_version string (unsupported versions rejected at ingress)", () => {
    expect(validateRequestEnvelope({ ...valid, contract_version: "v2" }).contract_version).toBe("v2");
    expect(validateRequestEnvelope({ ...valid, contract_version: "unknown" }).contract_version).toBe("unknown");
  });
});

describe("ResponseEnvelope", () => {
  const valid = {
    request_id: "550e8400-e29b-41d4-a716-446655440000",
    status: "ok" as const,
    output: { text: "hi", citations: [] },
    telemetry: { tokens_in: 10, tokens_out: 5, cost_usd_est: 0, latency_ms: 100 },
  };

  it("accepts valid response", () => {
    const result = validateResponseEnvelope(valid);
    expect(result.status).toBe("ok");
    expect(result.output?.text).toBe("hi");
  });

  it("rejects invalid status", () => {
    expect(() => validateResponseEnvelope({ ...valid, status: "pending" })).toThrow();
  });
});

describe("CanonicalRequest", () => {
  const valid = {
    request_id: "550e8400-e29b-41d4-a716-446655440000",
    modalities: ["text"],
    text: "hello",
    attachments: [],
    token_estimate: 0,
    caller_app_id: "a1",
    caller_user_id: "u1",
    caller_org_id: "o1",
  };

  it("accepts valid canonical request", () => {
    const result = validateCanonicalRequest(valid);
    expect(result.text).toBe("hello");
  });

  it("rejects missing required caller fields", () => {
    expect(() => validateCanonicalRequest({ ...valid, caller_org_id: "" })).toThrow();
  });
});

describe("IntentBundle", () => {
  const valid = {
    intents: ["chat"],
    confidence: 0.9,
    modalities_detected: [],
    primary_intent: "chat",
  };

  it("accepts valid intent bundle", () => {
    const result = validateIntentBundle(valid);
    expect(result.confidence).toBe(0.9);
  });

  it("rejects confidence > 1", () => {
    expect(() => validateIntentBundle({ ...valid, confidence: 1.5 })).toThrow();
  });
});

describe("PolicyDecision", () => {
  const valid = {
    allowed: true as const,
    allow_tools: [] as string[],
    deny_tools: [] as string[],
    memory_scope: "user" as const,
    safety_profile: "standard" as const,
    allowed_pipelines: ["chat"],
  };

  it("accepts valid policy decision", () => {
    const result = validatePolicyDecision(valid);
    expect(result.memory_scope).toBe("user");
    expect(result.allowed).toBe(true);
  });

  it("accepts denied decision with deny_reason", () => {
    const denied = { ...valid, allowed: false, deny_reason: "POLICY_BLOCKED" as const };
    const result = validatePolicyDecision(denied);
    expect(result.allowed).toBe(false);
    expect(result.deny_reason).toBe("POLICY_BLOCKED");
  });
});

describe("PipelinePlan", () => {
  const valid = {
    pipeline_type: "chat",
    strategy_id: "reactive",
    execution_mode: "sync_stream" as const,
    budgets: { token_budget: 4096 },
    verification_level: "basic" as const,
    tools_enabled: [],
  };

  it("accepts valid pipeline plan", () => {
    const result = validatePipelinePlan(valid);
    expect(result.pipeline_type).toBe("chat");
  });
});

describe("Error taxonomy", () => {
  it("exposes all required codes", () => {
    expect(ERROR_CODES).toContain("AUTH_INVALID");
    expect(ERROR_CODES).toContain("RATE_LIMITED");
    expect(ERROR_CODES).toContain("POLICY_BLOCKED");
    expect(ERROR_CODES).toContain("BUDGET_EXCEEDED");
    expect(ERROR_CODES).toContain("TOOL_TIMEOUT");
    expect(ERROR_CODES).toContain("MODEL_FAILURE");
    expect(ERROR_CODES).toContain("INTERNAL_ERROR");
  });

  it("isErrorCode identifies valid codes", () => {
    expect(isErrorCode("AUTH_INVALID")).toBe(true);
    expect(isErrorCode("UNKNOWN")).toBe(false);
  });

  it("getErrorMeta returns http status and retryable", () => {
    const meta = getErrorMeta("RATE_LIMITED");
    expect(meta.httpStatus).toBe(429);
    expect(meta.retryable).toBe(true);
    expect(ERROR_TAXONOMY.INVALID_PAYLOAD.retryable).toBe(false);
  });
});
