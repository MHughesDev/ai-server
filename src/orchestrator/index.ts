/**
 * Orchestration layer — loops, budgets, and execution mode (WANT-004).
 * @see docs/ARCHITECTURE/Architecture_document_Finalized.md §9
 */

export {
  applyOrchestratorToPipelinePlan,
} from "./apply-plan.js";
export {
  ORCHESTRATOR_DEFAULT_COST_BUDGET_USD,
  ORCHESTRATOR_DEFAULT_DEADLINE_MS,
  ORCHESTRATOR_DEFAULT_TOKEN_BUDGET,
  ORCHESTRATOR_DEFAULT_TOOL_BUDGET,
  hasToolBudgetRemaining,
  resolveMaxHarnessIterations,
  resolveOrchestratorExecutionSpec,
  scaleTokenBudgetForHarness,
  type OrchestratorExecutionSpec,
} from "./execution-spec.js";
export {
  runExecutionToolHarnessLoop,
  type HarnessLoopCallbacks,
  type HarnessLoopOutcome,
  type HarnessLoopParams,
} from "./harness-loop.js";
