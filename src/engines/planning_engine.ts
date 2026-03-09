/**
 * Planning Engine – produces WorkflowPlan (task graph) from objective + context.
 * Uses Model Gateway only. No engine-to-engine calls.
 * @see Architecture §10.1; SOW Segment M.1
 */

import type { IEngine } from "./base.js";
import type { EngineInvocation, EngineResult, TypedArtifact } from "../contracts/index.js";
import type { IModelGateway } from "../gateways/types.js";
import { randomUUID } from "node:crypto";

/** Schema ref for workflow plan artifact */
export const SCHEMA_REF_WORKFLOW_PLAN = "schema://workflow_plan@v1";

function createWorkflowPlanArtifact(plan: { steps?: Array<{ step_id: string; ref: string; depends_on?: string[] }> }): TypedArtifact {
  return {
    artifact_id: randomUUID(),
    artifact_kind: "workflow_plan",
    schema_ref: SCHEMA_REF_WORKFLOW_PLAN,
    encoding: "json",
    content: { inline: plan },
  };
}

export function createPlanningEngine(gateway: IModelGateway): IEngine {
  return {
    async invoke(inv: EngineInvocation): Promise<EngineResult> {
      const start = Date.now();
      const objective =
        typeof inv.task.objective?.description === "string"
          ? inv.task.objective.description
          : inv.context_artifacts.length > 0 &&
              (inv.context_artifacts[0].content as { inline?: string })?.inline != null
            ? String((inv.context_artifacts[0].content as { inline: string }).inline)
            : "(no objective)";
      const maxTokens = inv.budgets?.token_budget ?? 2048;
      const result = await gateway.complete({
        prompt: `Given this objective, produce a minimal task plan as JSON with a "steps" array of { "step_id", "ref", "depends_on" }. Objective: ${objective.slice(0, 500)}`,
        max_tokens: maxTokens,
        model: undefined,
      });
      const durationMs = Date.now() - start;
      // Parse or stub: use model output if valid JSON with steps, else minimal plan
      let plan: { steps: Array<{ step_id: string; ref: string; depends_on?: string[] }> };
      try {
        const parsed = JSON.parse(result.text) as unknown;
        if (parsed && typeof parsed === "object" && Array.isArray((parsed as { steps?: unknown }).steps)) {
          plan = parsed as { steps: Array<{ step_id: string; ref: string; depends_on?: string[] }> };
        } else {
          plan = { steps: [{ step_id: "s1", ref: "execution", depends_on: [] }] };
        }
      } catch {
        plan = { steps: [{ step_id: "s1", ref: "execution", depends_on: [] }] };
      }
      const artifact = createWorkflowPlanArtifact(plan);
      return {
        invocation_id: inv.invocation_id,
        status: "success",
        result_artifacts: [artifact],
        confidence: 0.85,
        metrics: {
          duration_ms: durationMs,
          tokens_used: (result.tokens_in ?? 0) + (result.tokens_out ?? 0),
          cost_estimate_usd: result.cost_usd_est,
        },
      };
    },
  };
}

/** Stub planning engine for tests (no Model Gateway). */
export function createStubPlanningEngine(): IEngine {
  return {
    async invoke(inv: EngineInvocation): Promise<EngineResult> {
      await Promise.resolve();
      const artifact = createWorkflowPlanArtifact({
        steps: [
          { step_id: "s1", ref: "execution", depends_on: [] },
          { step_id: "s2", ref: "synthesis", depends_on: ["s1"] },
        ],
      });
      return {
        invocation_id: inv.invocation_id,
        status: "success",
        result_artifacts: [artifact],
        confidence: 0.9,
        metrics: { duration_ms: 0 },
      };
    },
  };
}
