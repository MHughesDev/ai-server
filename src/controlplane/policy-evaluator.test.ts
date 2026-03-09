/**
 * Policy evaluator tests – deterministic outcomes for role, org, scope (L2-03 P0-03).
 */

import { evaluatePolicy } from "./policy-evaluator.js";
import type { PolicyInput } from "./policy-input.js";
import { listRegisteredWorkflowIds } from "../workflows/registry.js";

function makeInput(overrides: Partial<PolicyInput> = {}): PolicyInput {
  return {
    caller: {
      appId: "app1",
      userId: "user1",
      orgId: "org1",
      scopes: [],
    },
    canonical: {
      request_id: "550e8400-e29b-41d4-a716-446655440000",
      modalities: ["text"],
      text: "hello",
      attachments: [],
      token_estimate: 10,
      caller_app_id: "app1",
      caller_user_id: "user1",
      caller_org_id: "org1",
    },
    intent: {
      intents: ["chat"],
      confidence: 0.9,
      primary_intent: "chat",
    },
    ...overrides,
  };
}

describe("policy evaluator", () => {
  it("allows request with valid caller and chat intent", () => {
    const decision = evaluatePolicy(makeInput());
    expect(decision.allowed).toBe(true);
    expect(decision.deny_reason).toBeUndefined();
    expect(decision.allowed_pipelines).toContain("reactive_chat");
    expect(decision.max_budgets?.token_budget).toBe(8192);
  });

  it("keeps allowed_pipelines aligned with workflow registry", () => {
    const decision = evaluatePolicy(makeInput());
    expect(decision.allowed_pipelines).toEqual(listRegisteredWorkflowIds());
  });

  it("returns deterministic result for same input", () => {
    const input = makeInput();
    const a = evaluatePolicy(input);
    const b = evaluatePolicy(input);
    expect(a.allowed).toBe(b.allowed);
    expect(a.deny_reason).toBe(b.deny_reason);
    expect(a.allowed_pipelines).toEqual(b.allowed_pipelines);
  });

  it("denies when risk_flags contain high_risk", () => {
    const decision = evaluatePolicy(
      makeInput({ intent: { intents: ["chat"], confidence: 0.9, risk_flags: ["high_risk"] } })
    );
    expect(decision.allowed).toBe(false);
    expect(decision.deny_reason).toBe("POLICY_BLOCKED");
  });

  it("denies when risk_flags contain blocked", () => {
    const decision = evaluatePolicy(
      makeInput({ intent: { intents: ["chat"], confidence: 0.9, risk_flags: ["blocked"] } })
    );
    expect(decision.allowed).toBe(false);
    expect(decision.deny_reason).toBe("POLICY_BLOCKED");
  });

  it("allows chat primary_intent with default budgets", () => {
    const decision = evaluatePolicy(makeInput());
    expect(decision.allowed).toBe(true);
    expect(decision.max_budgets).toBeDefined();
    expect(decision.max_budgets?.deadline_ms).toBe(60_000);
    expect(decision.max_budgets?.cost_budget_usd).toBe(1.0);
  });

  it("denies when org_id is in POLICY_DENY_ORG_IDS (dynamic policy from env)", () => {
    const prev = process.env.POLICY_DENY_ORG_IDS;
    process.env.POLICY_DENY_ORG_IDS = "org1,other";
    try {
      const decision = evaluatePolicy(makeInput({ caller: { ...makeInput().caller, orgId: "org1" } }));
      expect(decision.allowed).toBe(false);
      expect(decision.deny_reason).toBe("POLICY_BLOCKED");
    } finally {
      if (prev !== undefined) process.env.POLICY_DENY_ORG_IDS = prev;
      else delete process.env.POLICY_DENY_ORG_IDS;
    }
  });

  it("denies when app_id is in POLICY_DENY_APP_IDS (dynamic policy from env)", () => {
    const prev = process.env.POLICY_DENY_APP_IDS;
    process.env.POLICY_DENY_APP_IDS = "blocked-app";
    try {
      const decision = evaluatePolicy(makeInput({ caller: { ...makeInput().caller, appId: "blocked-app" } }));
      expect(decision.allowed).toBe(false);
      expect(decision.deny_reason).toBe("POLICY_BLOCKED");
    } finally {
      if (prev !== undefined) process.env.POLICY_DENY_APP_IDS = prev;
      else delete process.env.POLICY_DENY_APP_IDS;
    }
  });
});
