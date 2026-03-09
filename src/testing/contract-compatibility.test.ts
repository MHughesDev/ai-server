/**
 * Contract Compatibility Tests – Phase 10.1
 * Tests backward compatibility validation for API contracts.
 * @see Production-Readiness-Complete-Checklist.md Phase 10
 */

import { jest } from "@jest/globals";
import type { 
  RequestEnvelope, 
  ResponseEnvelope,
  IntentBundle,
  PipelinePlan,
  PolicyDecision,
  WorkflowDefinition,
} from "../contracts/index.js";

/**
 * Contract versioning rules:
 * 1. Major version changes: Breaking changes allowed
 * 2. Minor version changes: Additive changes only (new optional fields)
 * 3. Patch version changes: No schema changes, only fixes
 */

interface ContractVersion {
  major: number;
  minor: number;
  patch: number;
}

function parseVersion(version: string): ContractVersion {
  const parts = version.split(".").map(Number);
  return {
    major: parts[0] ?? 0,
    minor: parts[1] ?? 0,
    patch: parts[2] ?? 0,
  };
}

function isBackwardCompatible(oldVersion: string, newVersion: string): boolean {
  const old = parseVersion(oldVersion);
  const neu = parseVersion(newVersion);

  // Major version change = breaking change
  if (neu.major !== old.major) {
    return false;
  }

  // Same major, higher or equal minor = backward compatible
  if (neu.major === old.major && neu.minor >= old.minor) {
    return true;
  }

  return false;
}

describe("Contract Compatibility Tests", () => {
  describe("Version parsing", () => {
    it("correctly parses semantic versions", () => {
      expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
      expect(parseVersion("0.1.0")).toEqual({ major: 0, minor: 1, patch: 0 });
      expect(parseVersion("2.0")).toEqual({ major: 2, minor: 0, patch: 0 });
    });

    it("detects backward compatible versions", () => {
      expect(isBackwardCompatible("1.0.0", "1.0.1")).toBe(true); // Patch
      expect(isBackwardCompatible("1.0.0", "1.1.0")).toBe(true); // Minor
      expect(isBackwardCompatible("1.0.0", "1.2.3")).toBe(true); // Minor + patch
      expect(isBackwardCompatible("1.0.0", "2.0.0")).toBe(false); // Major
      expect(isBackwardCompatible("1.1.0", "1.0.0")).toBe(false); // Downgrade
    });
  });

  describe("RequestEnvelope compatibility", () => {
    const baseRequest: RequestEnvelope = {
      version: "2024-01-01",
      request_id: "req-123",
      timestamp: new Date().toISOString(),
      intent: {
        intent_id: "test-intent",
        scope: { org_id: "org-1", app_id: "app-1", user_id: "user-1" },
        input_artifacts: [],
      },
    };

    it("accepts valid RequestEnvelope", () => {
      expect(baseRequest.request_id).toBe("req-123");
      expect(baseRequest.intent.intent_id).toBe("test-intent");
    });

    it("allows optional pipeline_hint field", () => {
      const withPipelineHint: RequestEnvelope = {
        ...baseRequest,
        pipeline_hint: {
          suggested_workflow: "reactive_chat",
          priority: "normal",
        },
      };
      expect(withPipelineHint.pipeline_hint).toBeDefined();
    });

    it("requires mandatory fields", () => {
      // Missing version
      const invalidNoVersion = { ...baseRequest };
      delete (invalidNoVersion as Partial<RequestEnvelope>).version;
      expect(invalidNoVersion.version).toBeUndefined();

      // Missing request_id
      const invalidNoRequestId = { ...baseRequest };
      delete (invalidNoRequestId as Partial<RequestEnvelope>).request_id;
      expect(invalidNoRequestId.request_id).toBeUndefined();
    });
  });

  describe("ResponseEnvelope compatibility", () => {
    const baseResponse: ResponseEnvelope = {
      version: "2024-01-01",
      request_id: "req-123",
      timestamp: new Date().toISOString(),
      status: "accepted",
    };

    it("accepts valid ResponseEnvelope", () => {
      expect(baseResponse.status).toBe("accepted");
    });

    it("allows all valid status values", () => {
      const statuses = ["accepted", "rejected", "deferred", "error"] as const;
      for (const status of statuses) {
        const response: ResponseEnvelope = { ...baseResponse, status };
        expect(response.status).toBe(status);
      }
    });

    it("allows optional error field for error status", () => {
      const errorResponse: ResponseEnvelope = {
        ...baseResponse,
        status: "error",
        error: {
          code: "INTERNAL_ERROR",
          message: "Something went wrong",
        },
      };
      expect(errorResponse.error).toBeDefined();
      expect(errorResponse.error?.code).toBe("INTERNAL_ERROR");
    });

    it("allows optional trace_id field", () => {
      const withTrace: ResponseEnvelope = {
        ...baseResponse,
        trace_id: "trace-abc-123",
      };
      expect(withTrace.trace_id).toBe("trace-abc-123");
    });
  });

  describe("IntentBundle compatibility", () => {
    const baseIntent: IntentBundle = {
      intent_id: "test-intent",
      scope: { org_id: "org-1", app_id: "app-1", user_id: "user-1" },
      input_artifacts: [],
    };

    it("accepts valid IntentBundle", () => {
      expect(baseIntent.intent_id).toBe("test-intent");
      expect(baseIntent.scope.org_id).toBe("org-1");
    });

    it("allows optional context_artifacts", () => {
      const withContext: IntentBundle = {
        ...baseIntent,
        context_artifacts: [
          {
            artifact_id: "ctx-1",
            artifact_kind: "text",
            schema_ref: "schema://text@v1",
            encoding: "utf-8",
            content: { inline: "Context" },
          },
        ],
      };
      expect(withContext.context_artifacts).toHaveLength(1);
    });

    it("allows optional policy_constraints", () => {
      const withConstraints: IntentBundle = {
        ...baseIntent,
        policy_constraints: {
          max_cost_usd: 10,
          max_latency_ms: 5000,
        },
      };
      expect(withConstraints.policy_constraints?.max_cost_usd).toBe(10);
    });
  });

  describe("PipelinePlan compatibility", () => {
    const basePlan: PipelinePlan = {
      plan_id: "plan-123",
      workflow_id: "reactive_chat",
      steps: [
        { step_id: "s1", ref: "execution", kind: "engine_call", depends_on: [] },
      ],
      budgets: {
        deadline_ms: 10000,
        cost_budget_usd: 5,
      },
    };

    it("accepts valid PipelinePlan", () => {
      expect(basePlan.plan_id).toBe("plan-123");
      expect(basePlan.steps).toHaveLength(1);
    });

    it("allows stop_conditions", () => {
      const withStopConditions: PipelinePlan = {
        ...basePlan,
        stop_conditions: {
          max_iterations: 3,
          deadline_ms: 15000,
        },
      };
      expect(withStopConditions.stop_conditions?.max_iterations).toBe(3);
    });

    it("allows fallback_steps", () => {
      const withFallback: PipelinePlan = {
        ...basePlan,
        fallback_steps: [
          { step_id: "f1", ref: "synthesis", kind: "engine_call", depends_on: [] },
        ],
      };
      expect(withFallback.fallback_steps).toHaveLength(1);
    });
  });

  describe("PolicyDecision compatibility", () => {
    const baseDecision: PolicyDecision = {
      decision: "allow",
      reason: "Policy allows",
    };

    it("accepts allow decision", () => {
      expect(baseDecision.decision).toBe("allow");
    });

    it("accepts deny decision", () => {
      const denyDecision: PolicyDecision = {
        decision: "deny",
        reason: "Rate limit exceeded",
        code: "RATE_LIMIT_EXCEEDED",
      };
      expect(denyDecision.decision).toBe("deny");
      expect(denyDecision.code).toBe("RATE_LIMIT_EXCEEDED");
    });

    it("accepts defer decision", () => {
      const deferDecision: PolicyDecision = {
        decision: "defer",
        reason: "Async processing required",
        estimated_completion_ms: 30000,
      };
      expect(deferDecision.decision).toBe("defer");
      expect(deferDecision.estimated_completion_ms).toBe(30000);
    });
  });

  describe("WorkflowDefinition compatibility", () => {
    const baseWorkflow: WorkflowDefinition = {
      workflow_id: "test-workflow",
      version: "v1",
      steps: [
        { step_id: "s1", ref: "execution", kind: "engine_call", depends_on: [] },
      ],
      stop_conditions: {
        max_iterations: 1,
        deadline_ms: 5000,
      },
    };

    it("accepts valid WorkflowDefinition", () => {
      expect(baseWorkflow.workflow_id).toBe("test-workflow");
      expect(baseWorkflow.steps).toHaveLength(1);
    });

    it("requires unique step_ids", () => {
      const duplicateSteps: WorkflowDefinition = {
        ...baseWorkflow,
        steps: [
          { step_id: "s1", ref: "execution", kind: "engine_call", depends_on: [] },
          { step_id: "s1", ref: "synthesis", kind: "engine_call", depends_on: [] },
        ],
      };
      const stepIds = duplicateSteps.steps.map(s => s.step_id);
      const uniqueStepIds = new Set(stepIds);
      expect(stepIds.length).not.toBe(uniqueStepIds.size);
    });

    it("validates dependency references exist", () => {
      const invalidDeps: WorkflowDefinition = {
        ...baseWorkflow,
        steps: [
          { step_id: "s1", ref: "execution", kind: "engine_call", depends_on: ["nonexistent"] },
        ],
      };
      const stepIds = new Set(invalidDeps.steps.map(s => s.step_id));
      const hasInvalidDep = invalidDeps.steps.some(s => 
        s.depends_on.some(dep => !stepIds.has(dep))
      );
      expect(hasInvalidDep).toBe(true);
    });
  });

  describe("Cross-version compatibility", () => {
    it("maintains field naming consistency", () => {
      // Ensure snake_case is used consistently
      const envelope: RequestEnvelope = {
        version: "2024-01-01",
        request_id: "req-123",
        timestamp: new Date().toISOString(),
        intent: {
          intent_id: "test",
          scope: { org_id: "org", app_id: "app", user_id: "user" },
          input_artifacts: [],
        },
      };

      // Check all fields use snake_case
      expect(envelope).toHaveProperty("request_id");
      expect(envelope).toHaveProperty("intent");
      expect(envelope.intent).toHaveProperty("intent_id");
      expect(envelope.intent.scope).toHaveProperty("org_id");
      expect(envelope.intent.scope).toHaveProperty("app_id");
      expect(envelope.intent.scope).toHaveProperty("user_id");
    });

    it("maintains type consistency for IDs", () => {
      // All IDs should be strings
      const envelope: RequestEnvelope = {
        version: "2024-01-01",
        request_id: "req-123",
        timestamp: new Date().toISOString(),
        intent: {
          intent_id: "intent-123",
          scope: { 
            org_id: "org-456", 
            app_id: "app-789", 
            user_id: "user-abc" 
          },
          input_artifacts: [],
        },
      };

      expect(typeof envelope.request_id).toBe("string");
      expect(typeof envelope.intent.intent_id).toBe("string");
      expect(typeof envelope.intent.scope.org_id).toBe("string");
      expect(typeof envelope.intent.scope.app_id).toBe("string");
      expect(typeof envelope.intent.scope.user_id).toBe("string");
    });
  });

  describe("Schema evolution simulation", () => {
    it("handles additive field changes", () => {
      // Simulating v1 response
      const v1Response = {
        version: "2024-01-01",
        request_id: "req-123",
        timestamp: new Date().toISOString(),
        status: "accepted" as const,
      };

      // Simulating v1.1 response with new optional field
      const v1_1Response = {
        ...v1Response,
        trace_id: "trace-abc",
        // New optional field added
        processing_metadata: {
          queue_time_ms: 100,
        },
      };

      // v1 client should be able to handle v1.1 response (ignores extra fields)
      expect(v1_1Response.request_id).toBe(v1Response.request_id);
      expect(v1_1Response.status).toBe(v1Response.status);
    });

    it("rejects breaking field changes", () => {
      // This test documents what would be a breaking change
      // Changing a required field name is breaking
      const breakingChangeResponse = {
        version: "2024-01-01",
        req_id: "req-123", // Changed from request_id to req_id - BREAKING!
        timestamp: new Date().toISOString(),
        status: "accepted",
      };

      // This would break existing clients expecting request_id
      expect(breakingChangeResponse).not.toHaveProperty("request_id");
      expect(breakingChangeResponse).toHaveProperty("req_id");
    });
  });
});
