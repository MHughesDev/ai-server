/**
 * Default router tests – L2-03 allow/deny, L2-07 capability-aware multimodal.
 */

import { defaultRouter } from "./default-router.js";
import type { RouterInput } from "./types.js";
import type { CanonicalRequest } from "../contracts/canonical-request.js";
import type { IntentBundle } from "../contracts/intent-bundle.js";
import type { PolicyDecision } from "../contracts/policy-decision.js";
import type { CallerContext } from "../ingress/types.js";

const defaultCaller: CallerContext = {
  appId: "a1",
  userId: "u1",
  orgId: "o1",
  scopes: [],
};

function minimalInput(overrides: Partial<RouterInput> = {}): RouterInput {
  const canonical: CanonicalRequest = {
    request_id: "550e8400-e29b-41d4-a716-446655440000",
    modalities: ["text"],
    text: "hello",
    attachments: [],
    token_estimate: 10,
    caller_app_id: "a1",
    caller_user_id: "u1",
    caller_org_id: "o1",
  };
  const intent: IntentBundle = {
    intents: ["chat"],
    confidence: 0.9,
    modalities_detected: ["text"],
    primary_intent: "chat",
    risk_flags: [],
    routing_hints: ["reactive_chat"],
  };
  const policy: PolicyDecision = {
    allowed: true,
    allowed_pipelines: ["reactive_chat"],
    allow_tools: [],
    deny_tools: [],
    memory_scope: "none",
  };
  return { canonical, intent, policy, caller: defaultCaller, ...overrides };
}

describe("defaultRouter", () => {
  it("allows and returns reactive_chat plan when policy allows", async () => {
    const result = await defaultRouter.plan(minimalInput());
    expect(result.allowed).toBe(true);
    expect(result.pipelinePlan?.pipeline_type).toBe("reactive_chat");
    expect(result.pipelinePlan?.budgets?.cost_budget_usd).toBeDefined();
  });

  it("denies when policy.allowed is false", async () => {
    const base = minimalInput();
    const result = await defaultRouter.plan({
      ...base,
      policy: { ...base.policy, allowed: false, deny_reason: "POLICY_BLOCKED" },
    });
    expect(result.allowed).toBe(false);
    expect(result.denyReason).toBe("POLICY_BLOCKED");
  });

  it("denies with MULTIMODAL_UNSUPPORTED when intent needs attachment processing but no capable pipeline allowed", async () => {
    const base = minimalInput();
    const input = minimalInput({
      canonical: {
        ...base.canonical,
        modalities: ["text", "image"],
        attachments: [{ id: "a1", type: "image", uri: "https://example.com/1.png", token_estimate: 256 }],
      },
      intent: {
        ...base.intent,
        constraints_hints: { needs_attachment_processing: true },
      },
      multimodalCapablePipelines: ["reactive_chat"],
      policy: { ...base.policy, allowed_pipelines: ["rag_chat"] },
    });
    const result = await defaultRouter.plan(input);
    expect(result.allowed).toBe(false);
    expect(result.denyReason).toBe("MULTIMODAL_UNSUPPORTED");
  });

  it("allows when intent needs attachment processing and policy allows a capable pipeline", async () => {
    const base = minimalInput();
    const input = minimalInput({
      canonical: {
        ...base.canonical,
        modalities: ["text", "image"],
        attachments: [{ id: "a1", type: "image", uri: "https://example.com/1.png", token_estimate: 256 }],
      },
      intent: {
        ...base.intent,
        constraints_hints: { needs_attachment_processing: true },
      },
      multimodalCapablePipelines: ["reactive_chat"],
      policy: { ...base.policy, allowed_pipelines: ["reactive_chat"] },
    });
    const result = await defaultRouter.plan(input);
    expect(result.allowed).toBe(true);
    expect(result.pipelinePlan?.pipeline_type).toBe("reactive_chat");
  });

  it("does not apply multimodal capability gate when intent lacks needs_attachment_processing (WANT-007)", async () => {
    const base = minimalInput();
    const input = minimalInput({
      canonical: {
        ...base.canonical,
        modalities: ["text", "image"],
        attachments: [{ id: "a1", type: "image", uri: "https://example.com/1.png", token_estimate: 256 }],
      },
      intent: base.intent,
      multimodalCapablePipelines: ["reactive_chat"],
      policy: { ...base.policy, allowed_pipelines: ["rag_chat"] },
    });
    const result = await defaultRouter.plan(input);
    expect(result.allowed).toBe(true);
  });

  it("allows text-only when multimodalCapablePipelines is empty (no capability check)", async () => {
    const input = minimalInput({
      canonical: { ...minimalInput().canonical, modalities: ["text"] },
      multimodalCapablePipelines: [],
    });
    const result = await defaultRouter.plan(input);
    expect(result.allowed).toBe(true);
  });

  it("sets tools_enabled from policy allow_tools minus deny_tools when coding_agent (L2-05)", async () => {
    const input = minimalInput({
      intent: {
        ...minimalInput().intent,
        primary_intent: "coding_agent",
        complexity: { tool_likelihood: 0.8 },
      },
      policy: {
        ...minimalInput().policy,
        allowed_pipelines: ["reactive_chat", "coding_agent"],
        allow_tools: ["stub_tool", "other_tool"],
        deny_tools: ["other_tool"],
      },
    });
    const result = await defaultRouter.plan(input);
    expect(result.allowed).toBe(true);
    expect(result.pipelinePlan?.pipeline_type).toBe("coding_agent");
    expect(result.pipelinePlan?.tools_enabled).toEqual(["stub_tool"]);
  });

  it("does not set harness_autonomous_execution when bootstrap has not run (safe default)", async () => {
    const input = minimalInput({
      intent: {
        ...minimalInput().intent,
        complexity: { tool_likelihood: 0.9 },
      },
      policy: {
        ...minimalInput().policy,
        allowed_pipelines: ["coding_agent", "reactive_chat"],
        allow_tools: ["stub_tool"],
      },
    });
    const result = await defaultRouter.plan(input);
    expect(result.allowed).toBe(true);
    expect(result.pipelinePlan?.pipeline_type).toBe("coding_agent");
    expect(result.pipelinePlan?.harness_autonomous_execution).toBeUndefined();
  });

  it("sets harness_autonomous_execution when bootstrap enables flag and coding_agent has tools", async () => {
    const { bootstrap, resetConfigForTest } = await import("../bootstrap/index.js");
    const prev = process.env.HARNESS_AUTONOMOUS_EXECUTION_ENABLED;
    process.env.HARNESS_AUTONOMOUS_EXECUTION_ENABLED = "true";
    try {
      resetConfigForTest();
      bootstrap();
      const input = minimalInput({
        intent: {
          ...minimalInput().intent,
          complexity: { tool_likelihood: 0.9 },
        },
        policy: {
          ...minimalInput().policy,
          allowed_pipelines: ["coding_agent", "reactive_chat"],
          allow_tools: ["stub_tool"],
        },
      });
      const result = await defaultRouter.plan(input);
      expect(result.pipelinePlan?.harness_autonomous_execution).toBe(true);
    } finally {
      if (prev !== undefined) process.env.HARNESS_AUTONOMOUS_EXECUTION_ENABLED = prev;
      else delete process.env.HARNESS_AUTONOMOUS_EXECUTION_ENABLED;
      resetConfigForTest();
    }
  });

  it("propagates policy cost/tool budgets to pipeline plan", async () => {
    const input = minimalInput({
      policy: {
        ...minimalInput().policy,
        max_budgets: {
          token_budget: 1000,
          tool_budget: 7,
          deadline_ms: 12_000,
          cost_budget_usd: 0.25,
        },
      },
    });
    const result = await defaultRouter.plan(input);
    expect(result.allowed).toBe(true);
    expect(result.pipelinePlan?.budgets).toMatchObject({
      token_budget: 1000,
      tool_budget: 7,
      deadline_ms: 12_000,
      cost_budget_usd: 0.25,
    });
  });

  it("sets sandbox timeout only when enabled tools need no network or filesystem", async () => {
    const input = minimalInput({
      intent: {
        ...minimalInput().intent,
        primary_intent: "coding_agent",
        complexity: { tool_likelihood: 0.8 },
      },
      policy: {
        ...minimalInput().policy,
        allowed_pipelines: ["reactive_chat", "coding_agent"],
        allow_tools: ["stub_tool"],
        max_budgets: {
          token_budget: 4096,
          tool_budget: 5,
          deadline_ms: 12_000,
          cost_budget_usd: 0.5,
        },
      },
    });
    const result = await defaultRouter.plan(input);
    expect(result.pipelinePlan?.sandbox).toEqual({ timeout_ms: 12_000 });
  });

  it("sets sandbox network_access when policy enables a network tool (coding_agent)", async () => {
    const input = minimalInput({
      intent: {
        ...minimalInput().intent,
        primary_intent: "coding_agent",
        complexity: { tool_likelihood: 0.8 },
      },
      policy: {
        ...minimalInput().policy,
        allowed_pipelines: ["reactive_chat", "coding_agent"],
        allow_tools: ["web_search"],
        max_budgets: {
          token_budget: 4096,
          tool_budget: 5,
          deadline_ms: 15_000,
          cost_budget_usd: 0.5,
        },
      },
    });
    const result = await defaultRouter.plan(input);
    expect(result.pipelinePlan?.sandbox?.network_access).toBe(true);
    expect(result.pipelinePlan?.sandbox?.timeout_ms).toBe(15_000);
  });

  it("sets sandbox filesystem_access when policy enables file_write_preview", async () => {
    const input = minimalInput({
      intent: {
        ...minimalInput().intent,
        primary_intent: "coding_agent",
        complexity: { tool_likelihood: 0.8 },
      },
      policy: {
        ...minimalInput().policy,
        allowed_pipelines: ["reactive_chat", "coding_agent"],
        allow_tools: ["file_write_preview"],
        max_budgets: {
          token_budget: 4096,
          tool_budget: 5,
          deadline_ms: 20_000,
          cost_budget_usd: 0.5,
        },
      },
    });
    const result = await defaultRouter.plan(input);
    expect(result.pipelinePlan?.sandbox?.filesystem_access).toBe(true);
    expect(result.pipelinePlan?.sandbox?.timeout_ms).toBe(20_000);
  });
});
