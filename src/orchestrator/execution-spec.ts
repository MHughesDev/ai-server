/**
 * Orchestrator execution spec — sole authority for harness mode, loop caps, and normalized budgets (WANT-004).
 * Pipelines and workflow runners consume this output; they must not read feature flags or re-derive mode.
 */

import type { PipelinePlan, PipelineBudgets } from "../contracts/pipeline-plan.js";
import {
  HARNESS_TOOL_ITERATION_ABSOLUTE_CAP,
  isFiniteToolBudget,
} from "../governance/budget-exceeded.js";

/** Defaults aligned with router/control-plane when policy omits explicit budgets. */
export const ORCHESTRATOR_DEFAULT_TOOL_BUDGET = 10;
export const ORCHESTRATOR_DEFAULT_TOKEN_BUDGET = 4096;
export const ORCHESTRATOR_DEFAULT_DEADLINE_MS = 30_000;
export const ORCHESTRATOR_DEFAULT_COST_BUDGET_USD = 0.5;

export interface OrchestratorExecutionSpec {
  execution_mode: "sync_stream";
  harness_autonomous_execution: boolean;
  budgets: Required<
    Pick<PipelineBudgets, "token_budget" | "tool_budget" | "deadline_ms" | "cost_budget_usd">
  >;
  /** Max (execution ↔ tool) rounds for autonomous harness (includes budget-exceeded probe round). */
  max_harness_iterations: number;
  tools_enabled: string[];
}

export function scaleTokenBudgetForHarness(baseTokenBudget: number): number {
  return Math.min(2_000_000, Math.max(baseTokenBudget * 48, 200_000));
}

/** One extra execution round after the last allowed tool so BUDGET_EXCEEDED can surface when the model still proposes a tool. */
export function resolveMaxHarnessIterations(toolBudget: number): number {
  return Math.min(Math.max(toolBudget + 1, 1), HARNESS_TOOL_ITERATION_ABSOLUTE_CAP);
}

function normalizeBudgets(plan: PipelinePlan, harness: boolean): OrchestratorExecutionSpec["budgets"] {
  const raw = plan.budgets ?? {};
  const tokenBase = raw.token_budget ?? ORCHESTRATOR_DEFAULT_TOKEN_BUDGET;
  const token_budget = harness ? scaleTokenBudgetForHarness(tokenBase) : tokenBase;
  const tool_budget = isFiniteToolBudget(raw.tool_budget)
    ? raw.tool_budget
    : ORCHESTRATOR_DEFAULT_TOOL_BUDGET;
  return {
    token_budget,
    tool_budget,
    deadline_ms: raw.deadline_ms ?? ORCHESTRATOR_DEFAULT_DEADLINE_MS,
    cost_budget_usd: raw.cost_budget_usd ?? ORCHESTRATOR_DEFAULT_COST_BUDGET_USD,
  };
}

/**
 * Resolve execution mode and budgets from the router-produced plan only (no feature-flag reads).
 */
export function resolveOrchestratorExecutionSpec(plan: PipelinePlan): OrchestratorExecutionSpec {
  const tools_enabled = plan.tools_enabled ?? [];
  const harness_autonomous_execution =
    plan.harness_autonomous_execution === true && tools_enabled.length > 0;
  const budgets = normalizeBudgets(plan, harness_autonomous_execution);
  return {
    execution_mode: plan.execution_mode ?? "sync_stream",
    harness_autonomous_execution,
    budgets,
    max_harness_iterations: resolveMaxHarnessIterations(budgets.tool_budget),
    tools_enabled,
  };
}

export function hasToolBudgetRemaining(toolCallsCount: number, toolBudget: number): boolean {
  return toolBudget > 0 && toolCallsCount < toolBudget;
}
