/**
 * Default router tests – L2-03 allow/deny, L2-07 capability-aware multimodal.
 */

import { defaultRouter } from "./default-router.js";
import type { RouterInput } from "./types.js";
import type { CanonicalRequest } from "../contracts/canonical-request.js";
import type { IntentBundle } from "../contracts/intent-bundle.js";
import type { PolicyDecision } from "../contracts/policy-decision.js";

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
    primary_intent: "chat",
    confidence: 0.9,
    complexity: "low",
    risk_hint: "low",
  };
  const policy: PolicyDecision = {
    allowed: true,
    allowed_pipelines: ["reactive_chat"],
    allow_tools: [],
    deny_tools: [],
    memory_scope: "none",
  };
  return { canonical, intent, policy, ...overrides };
}

describe("defaultRouter", () => {
  it("allows and returns reactive_chat plan when policy allows", async () => {
    const result = await defaultRouter.plan(minimalInput());
    expect(result.allowed).toBe(true);
    expect(result.pipelinePlan?.pipeline_type).toBe("reactive_chat");
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

  it("denies with MULTIMODAL_UNSUPPORTED when request has image modality but no capable pipeline allowed", async () => {
    const input = minimalInput({
      canonical: {
        ...minimalInput().canonical,
        modalities: ["text", "image"],
        attachments: [{ id: "a1", type: "image", uri: "https://example.com/1.png", token_estimate: 256 }],
      },
      multimodalCapablePipelines: ["reactive_chat"],
      policy: { ...minimalInput().policy, allowed_pipelines: ["rag_chat"] },
    });
    const result = await defaultRouter.plan(input);
    expect(result.allowed).toBe(false);
    expect(result.denyReason).toBe("MULTIMODAL_UNSUPPORTED");
  });

  it("allows when request has image modality and policy allows reactive_chat and it is capable", async () => {
    const input = minimalInput({
      canonical: {
        ...minimalInput().canonical,
        modalities: ["text", "image"],
        attachments: [{ id: "a1", type: "image", uri: "https://example.com/1.png", token_estimate: 256 }],
      },
      multimodalCapablePipelines: ["reactive_chat"],
      policy: { ...minimalInput().policy, allowed_pipelines: ["reactive_chat"] },
    });
    const result = await defaultRouter.plan(input);
    expect(result.allowed).toBe(true);
    expect(result.pipelinePlan?.pipeline_type).toBe("reactive_chat");
  });

  it("allows text-only when multimodalCapablePipelines is empty (no capability check)", async () => {
    const input = minimalInput({
      canonical: { ...minimalInput().canonical, modalities: ["text"] },
      multimodalCapablePipelines: [],
    });
    const result = await defaultRouter.plan(input);
    expect(result.allowed).toBe(true);
  });
});
