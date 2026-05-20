/**
 * Apply orchestrator normalization to a router-produced PipelinePlan before pipeline execution (WANT-004).
 */

import type { PipelinePlan } from "../contracts/pipeline-plan.js";
import { resolveOrchestratorExecutionSpec } from "./execution-spec.js";

/**
 * Returns a plan copy with orchestrator-resolved budgets and execution_mode.
 * Harness token scaling and budget defaults live here — not in pipelines.
 */
export function applyOrchestratorToPipelinePlan(plan: PipelinePlan): PipelinePlan {
  const spec = resolveOrchestratorExecutionSpec(plan);
  return {
    ...plan,
    execution_mode: spec.execution_mode,
    harness_autonomous_execution: spec.harness_autonomous_execution
      ? true
      : plan.harness_autonomous_execution,
    budgets: { ...plan.budgets, ...spec.budgets },
  };
}
