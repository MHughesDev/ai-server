/**
 * Budget inheritance for nested workflows (M6).
 * Child plan budgets must not exceed parent; stop_conditions from child definition apply.
 * @see SOW Segment K, Architecture §9.4
 */

import type { PipelinePlan } from "../contracts/pipeline-plan.js";
import type { WorkflowDefinition } from "../contracts/workflow-definition.js";

/**
 * Build a child PipelinePlan with budgets inherited from parent (child ≤ parent).
 * Uses parent's pipeline_type for the child workflow (ref), and clamps budgets
 * by parent and child stop_conditions (deadline_ms).
 */
export function inheritBudgets(
  parentPlan: PipelinePlan,
  childDefinition: WorkflowDefinition
): PipelinePlan {
  const parentBudgets = parentPlan.budgets ?? {};
  const childStop = childDefinition.stop_conditions ?? {};
  const deadlineMs = minPositive(
    parentBudgets.deadline_ms,
    childStop.deadline_ms
  );
  const tokenBudget = parentBudgets.token_budget;
  const toolBudget = parentBudgets.tool_budget;
  const costBudgetUsd = parentBudgets.cost_budget_usd;

  const budgets = {
    ...(tokenBudget !== undefined && { token_budget: tokenBudget }),
    ...(toolBudget !== undefined && { tool_budget: toolBudget }),
    ...(deadlineMs !== undefined && { deadline_ms: deadlineMs }),
    ...(costBudgetUsd !== undefined && { cost_budget_usd: costBudgetUsd }),
  };

  return {
    ...parentPlan,
    pipeline_type: childDefinition.workflow_id,
    strategy_id: parentPlan.strategy_id ?? "nested",
    budgets: Object.keys(budgets).length > 0 ? budgets : undefined,
  };
}

function minPositive(...values: (number | undefined)[]): number | undefined {
  const defined = values.filter((v): v is number => typeof v === "number" && v > 0);
  if (defined.length === 0) return undefined;
  return Math.min(...defined);
}
