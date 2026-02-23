/**
 * Resource manager tests – budget assignment and exact threshold (L2-03 P1-03).
 */

import { assignBudgets, checkBudget } from "./resource-manager.js";
import type { PolicyDecision } from "../contracts/policy-decision.js";
import type { CanonicalRequest } from "../contracts/canonical-request.js";

const baseCanonical: CanonicalRequest = {
  request_id: "550e8400-e29b-41d4-a716-446655440000",
  modalities: ["text"],
  text: "hello",
  attachments: [],
  token_estimate: 100,
  caller_app_id: "a1",
  caller_user_id: "u1",
  caller_org_id: "o1",
};

const allowedPolicy: PolicyDecision = {
  allowed: true,
  allow_tools: [],
  deny_tools: [],
  memory_scope: "none",
  max_budgets: { token_budget: 500, tool_budget: 5, deadline_ms: 10_000, cost_budget_usd: 0.1 },
  allowed_pipelines: ["chat"],
};

describe("resource manager", () => {
  describe("assignBudgets", () => {
    it("returns policy max_budgets when set", () => {
      const effective = assignBudgets(allowedPolicy, baseCanonical);
      expect(effective.token_budget).toBe(500);
      expect(effective.deadline_ms).toBe(10_000);
    });

    it("returns defaults when policy has no max_budgets", () => {
      const policy = { ...allowedPolicy, max_budgets: undefined };
      const effective = assignBudgets(policy, baseCanonical);
      expect(effective.token_budget).toBe(4096);
      expect(effective.deadline_ms).toBe(30_000);
    });
  });

  describe("checkBudget", () => {
    it("allows when token_estimate equals token_budget (exact threshold)", () => {
      const canonical = { ...baseCanonical, token_estimate: 500 };
      const result = checkBudget(allowedPolicy, canonical);
      expect(result.allowed).toBe(true);
      expect(result.effectiveBudgets?.token_budget).toBe(500);
    });

    it("allows when token_estimate below token_budget", () => {
      const result = checkBudget(allowedPolicy, baseCanonical);
      expect(result.allowed).toBe(true);
    });

    it("denies with BUDGET_EXCEEDED when token_estimate exceeds token_budget", () => {
      const canonical = { ...baseCanonical, token_estimate: 501 };
      const result = checkBudget(allowedPolicy, canonical);
      expect(result.allowed).toBe(false);
      expect(result.deny_reason).toBe("BUDGET_EXCEEDED");
    });
  });
});
