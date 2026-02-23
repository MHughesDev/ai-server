/**
 * Dispatch gate tests – no bypass; assertCanDispatch and canDispatch (L2-03 Phase 3).
 */

import { assertCanDispatch, canDispatch, DispatchBlockedError } from "./dispatch-gate.js";
import type { ControlPlaneResult } from "./types.js";
import type { PolicyDecision } from "../contracts/policy-decision.js";
import type { PipelinePlan } from "../contracts/pipeline-plan.js";
import type { RouteResult } from "../router/types.js";

function allowedResult(plan: PipelinePlan): ControlPlaneResult {
  const policy: PolicyDecision = {
    allowed: true,
    allow_tools: [],
    deny_tools: [],
    memory_scope: "none",
    allowed_pipelines: ["chat"],
  };
  const routeResult: RouteResult = { allowed: true, pipelinePlan: plan };
  return {
    policyDecision: policy,
    routeResult,
    pipelinePlan: plan,
  };
}

function deniedResult(denyReason: "POLICY_BLOCKED" | "BUDGET_EXCEEDED"): ControlPlaneResult {
  const policy: PolicyDecision = {
    allowed: false,
    deny_reason: denyReason,
    allow_tools: [],
    deny_tools: [],
    memory_scope: "none",
    allowed_pipelines: [],
  };
  const routeResult: RouteResult = { allowed: false, denyReason };
  return {
    policyDecision: policy,
    routeResult,
    pipelinePlan: undefined,
  };
}

const minimalPlan: PipelinePlan = {
  pipeline_type: "reactive_chat",
  strategy_id: "reactive",
  execution_mode: "sync_stream",
  verification_level: "basic",
  tools_enabled: [],
};

describe("dispatch gate", () => {
  describe("canDispatch", () => {
    it("returns true when routeResult.allowed and pipelinePlan present", () => {
      const result = allowedResult(minimalPlan);
      expect(canDispatch(result)).toBe(true);
    });

    it("returns false when routeResult.allowed is false", () => {
      const result = deniedResult("POLICY_BLOCKED");
      expect(canDispatch(result)).toBe(false);
    });

  });

  describe("assertCanDispatch", () => {
    it("does not throw when result allows and has pipelinePlan", () => {
      const result = allowedResult(minimalPlan);
      expect(() => assertCanDispatch(result)).not.toThrow();
    });

    it("throws DispatchBlockedError when result is denied", () => {
      const result = deniedResult("BUDGET_EXCEEDED");
      expect(() => assertCanDispatch(result)).toThrow(DispatchBlockedError);
      expect(() => assertCanDispatch(result)).toThrow("Dispatch precondition failed");
      try {
        assertCanDispatch(result);
      } catch (e) {
        expect((e as DispatchBlockedError).denyReason).toBe("BUDGET_EXCEEDED");
      }
    });

    it("throws with denyReason POLICY_BLOCKED when route denied", () => {
      const result = deniedResult("POLICY_BLOCKED");
      expect(() => assertCanDispatch(result)).toThrow(DispatchBlockedError);
      try {
        assertCanDispatch(result);
      } catch (e) {
        expect((e as DispatchBlockedError).denyReason).toBe("POLICY_BLOCKED");
      }
    });
  });
});
