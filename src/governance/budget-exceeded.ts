/**
 * Shared blocked envelope for budget dimensions (WANT-014 alignment across runner + pipelines).
 */

import type { ResponseEnvelope } from "../contracts/response-envelope.js";

export function isFiniteToolBudget(budget: number | undefined): budget is number {
  return budget != null && Number.isFinite(budget) && budget >= 0;
}

/** Upper bound on harness execution↔tool iterations to avoid runaway loops when `tool_budget` is very large. */
export const HARNESS_TOOL_ITERATION_ABSOLUTE_CAP = 500;

export function buildBudgetExceededEnvelope(
  requestId: string,
  pipelineId: string,
  workflowStart: number,
  detail: Record<string, unknown>,
  toolCalls = 0
): ResponseEnvelope {
  return {
    request_id: requestId,
    status: "blocked",
    mode: "sync",
    error: {
      code: "BUDGET_EXCEEDED",
      message: "Workflow budget exceeded",
      detail,
    },
    telemetry: {
      pipeline: pipelineId,
      models_used: [],
      tool_calls: toolCalls,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd_est: 0,
      latency_ms: Date.now() - workflowStart,
    },
  };
}
