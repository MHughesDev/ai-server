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
  validateTypedArtifact,
  validateTask,
  validateEngineInvocation,
  validateEngineResult,
  validateWorkflowDefinition,
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

  it("accepts explicit sync mode", () => {
    expect(validateRequestEnvelope({ ...valid, mode: "sync" }).mode).toBe("sync");
  });

  it("rejects async/auto request modes in sync-only contract", () => {
    expect(() => validateRequestEnvelope({ ...valid, mode: "async" })).toThrow();
    expect(() => validateRequestEnvelope({ ...valid, mode: "auto" })).toThrow();
  });

  it("rejects paper-only request fields", () => {
    expect(() => validateRequestEnvelope({ ...valid, idempotency_key: "idem-1" })).toThrow();
    expect(() => validateRequestEnvelope({ ...valid, timestamp: "2026-01-01T00:00:00.000Z" })).toThrow();
    expect(() =>
      validateRequestEnvelope({
        ...valid,
        preferences: { ...valid.preferences, safety_profile: "strict" },
      })
    ).toThrow();
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

  it("rejects async lifecycle response fields and statuses", () => {
    expect(() => validateResponseEnvelope({ ...valid, status: "accepted" })).toThrow();
    expect(() => validateResponseEnvelope({ ...valid, mode: "async" })).toThrow();
    expect(() => validateResponseEnvelope({ ...valid, mode: "stream" })).toThrow();
    expect(() => validateResponseEnvelope({ ...valid, job_id: "job-123" })).toThrow();
  });

  it("rejects paper-only telemetry fields", () => {
    expect(() =>
      validateResponseEnvelope({
        ...valid,
        telemetry: { ...valid.telemetry, workflow_id: "wf_1" },
      })
    ).toThrow();
    expect(() =>
      validateResponseEnvelope({
        ...valid,
        telemetry: { ...valid.telemetry, engine_calls: 2 },
      })
    ).toThrow();
    expect(() =>
      validateResponseEnvelope({
        ...valid,
        telemetry: { ...valid.telemetry, trace_id: "tr_123" },
      })
    ).toThrow();
  });

  it("accepts output.attachments (M2)", () => {
    const withAttachments = {
      ...valid,
      output: {
        text: "hi",
        citations: [] as { source: string; ref: string }[],
        attachments: [
          { artifact_id: "a1", artifact_kind: "report" },
          { artifact_uri: "https://example.com/out", artifact_kind: "report" },
        ],
      },
    };
    const result = validateResponseEnvelope(withAttachments);
    expect(result.output?.attachments).toHaveLength(2);
    expect(result.output?.attachments?.[0].artifact_id).toBe("a1");
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

  it("rejects async_job execution mode in sync-only plan contract", () => {
    expect(() => validatePipelinePlan({ ...valid, execution_mode: "async_job" })).toThrow();
  });
});

describe("TypedArtifact", () => {
  const valid = {
    artifact_id: "a1",
    artifact_kind: "report" as const,
    encoding: "text" as const,
    content: { inline: "hello" },
  };

  it("accepts valid typed artifact", () => {
    const result = validateTypedArtifact(valid);
    expect(result.artifact_kind).toBe("report");
    expect(result.content.inline).toBe("hello");
  });

  it("rejects missing artifact_kind", () => {
    expect(() => validateTypedArtifact({ ...valid, artifact_kind: undefined })).toThrow();
  });
});

describe("Task", () => {
  const valid = {
    task_id: "t1",
    task_type: "execute",
    category: "generation" as const,
    input_artifacts: [],
  };

  it("accepts valid task", () => {
    const result = validateTask(valid);
    expect(result.task_id).toBe("t1");
    expect(result.category).toBe("generation");
  });
});

describe("EngineInvocation", () => {
  const valid = {
    invocation_id: "inv-1",
    engine_type: "execution" as const,
    task: {
      task_id: "t1",
      task_type: "execute",
      category: "generation" as const,
      input_artifacts: [],
    },
    context_artifacts: [],
  };

  it("accepts valid engine invocation", () => {
    const result = validateEngineInvocation(valid);
    expect(result.engine_type).toBe("execution");
    expect(result.task.task_id).toBe("t1");
  });

  it("rejects invalid engine_type", () => {
    expect(() => validateEngineInvocation({ ...valid, engine_type: "unknown" })).toThrow();
  });

  it("accepts context_artifacts as TypedArtifacts with schema_ref (M2 engine I/O)", () => {
    const typedArtifact = {
      artifact_id: "ctx1",
      artifact_kind: "report" as const,
      schema_ref: "schema://user_input@v1",
      encoding: "text" as const,
      content: { inline: "user text" },
    };
    const inv = {
      ...valid,
      task: { ...valid.task, input_artifacts: [typedArtifact] },
      context_artifacts: [typedArtifact],
    };
    const result = validateEngineInvocation(inv);
    expect(result.context_artifacts).toHaveLength(1);
    expect(result.context_artifacts[0].schema_ref).toBe("schema://user_input@v1");
  });
});

describe("EngineResult", () => {
  const valid = {
    invocation_id: "inv-1",
    status: "success" as const,
    result_artifacts: [],
  };

  it("accepts valid engine result", () => {
    const result = validateEngineResult(valid);
    expect(result.status).toBe("success");
  });

  it("rejects invalid status", () => {
    expect(() => validateEngineResult({ ...valid, status: "pending" })).toThrow();
  });

  it("accepts result_artifacts as TypedArtifacts with schema_ref (M2 engine I/O)", () => {
    const resultArtifact = {
      artifact_id: "res1",
      artifact_kind: "report" as const,
      schema_ref: "schema://report@v1",
      encoding: "text" as const,
      content: { inline: "model output" },
    };
    const res = { ...valid, result_artifacts: [resultArtifact] };
    const result = validateEngineResult(res);
    expect(result.result_artifacts).toHaveLength(1);
    expect(result.result_artifacts[0].artifact_kind).toBe("report");
    expect(result.result_artifacts[0].schema_ref).toBe("schema://report@v1");
  });
});

describe("WorkflowDefinition", () => {
  const valid = {
    workflow_id: "reactive_chat",
    version: "v1",
    entry_conditions: { intents: ["query", "chat"] },
    steps: [
      { step_id: "s1", kind: "engine_call" as const, ref: "execution", input_mapping: {}, depends_on: [] },
      { step_id: "s2", kind: "engine_call" as const, ref: "synthesis", input_mapping: {}, depends_on: ["s1"] },
    ],
    stop_conditions: { max_iterations: 1, deadline_ms: 60000 },
  };

  it("accepts valid workflow definition", () => {
    const result = validateWorkflowDefinition(valid);
    expect(result.workflow_id).toBe("reactive_chat");
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].ref).toBe("execution");
  });

  it("rejects missing workflow_id", () => {
    expect(() => validateWorkflowDefinition({ ...valid, workflow_id: undefined })).toThrow();
  });

  it("rejects invalid step kind", () => {
    expect(() =>
      validateWorkflowDefinition({
        ...valid,
        steps: [{ ...valid.steps[0], kind: "invalid" }],
      })
    ).toThrow();
  });

  it("rejects unknown step dependencies", () => {
    expect(() =>
      validateWorkflowDefinition({
        ...valid,
        steps: [{ ...valid.steps[0], depends_on: ["missing"] }],
      })
    ).toThrow(/unknown dependency/i);
  });

  it("rejects workflow dependency cycles", () => {
    expect(() =>
      validateWorkflowDefinition({
        ...valid,
        steps: [
          { step_id: "a", kind: "engine_call" as const, ref: "execution", depends_on: ["b"] },
          { step_id: "b", kind: "engine_call" as const, ref: "synthesis", depends_on: ["a"] },
        ],
      })
    ).toThrow(/cycle/i);
  });

  it("accepts decision steps when branch targets exist", () => {
    const withDecision = validateWorkflowDefinition({
      ...valid,
      steps: [
        { step_id: "s1", kind: "engine_call" as const, ref: "execution", input_mapping: {}, depends_on: [] },
        { step_id: "s2", kind: "engine_call" as const, ref: "synthesis", input_mapping: {}, depends_on: ["s1"] },
        {
          step_id: "d1",
          kind: "decision" as const,
          ref: "route",
          depends_on: ["s2"],
          branches: [{ condition: "score > 0.5", target_step: "s2" }],
          default_target: "s2",
        },
      ],
    });
    expect(withDecision.steps).toHaveLength(3);
    expect(withDecision.steps[2].kind).toBe("decision");
  });

  it("rejects decision steps with unknown branch targets", () => {
    expect(() =>
      validateWorkflowDefinition({
        ...valid,
        steps: [
          { step_id: "s1", kind: "engine_call" as const, ref: "execution" },
          {
            step_id: "d1",
            kind: "decision" as const,
            ref: "route",
            depends_on: ["s1"],
            branches: [{ condition: "true", target_step: "missing" }],
          },
        ],
      })
    ).toThrow(/unknown branch target/i);
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
    expect(ERROR_CODES).toContain("IDEMPOTENCY_KEY_CONFLICT");
    expect(ERROR_CODES).toContain("ASYNC_NOT_AVAILABLE");
    expect(ERROR_CODES).toContain("TIMEOUT");
    expect(ERROR_CODES).toContain("FLAGS_NOT_AVAILABLE");
    expect(ERROR_CODES).toContain("NOT_FOUND");
    expect(ERROR_CODES).toContain("MVP_QUERY_DISABLED");
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
    expect(getErrorMeta("IDEMPOTENCY_KEY_CONFLICT").httpStatus).toBe(409);
  });
});
