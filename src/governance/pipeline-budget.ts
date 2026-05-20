/**
 * Cumulative token/cost budget enforcement for multi-hop pipelines (WANT-014).
 * Mirrors `workflows/runner.ts` hard-stop semantics between engine hops.
 */

import type { ResponseEnvelope } from "../contracts/response-envelope.js";
import { buildBudgetExceededEnvelope } from "./budget-exceeded.js";

export interface PipelineBudgetLimits {
  token_budget?: number;
  cost_budget_usd?: number;
}

export interface HopMetrics {
  tokens_used?: number;
  cost_estimate_usd?: number;
}

export interface PipelineBudgetCheckContext {
  requestId: string;
  pipelineId: string;
  workflowStart: number;
  limits: PipelineBudgetLimits;
  toolCalls?: number;
}

export class PipelineBudgetAccumulator {
  accumulatedTokens = 0;
  accumulatedCostUsd = 0;

  constructor(private readonly limits: PipelineBudgetLimits) {}

  record(metrics?: HopMetrics): void {
    this.accumulatedTokens += metrics?.tokens_used ?? 0;
    this.accumulatedCostUsd += metrics?.cost_estimate_usd ?? 0;
  }

  /** Returns a blocked envelope when a cumulative limit is exceeded; otherwise null. */
  checkBlocked(ctx: Omit<PipelineBudgetCheckContext, "limits">): ResponseEnvelope | null {
    const { token_budget: tokenBudget, cost_budget_usd: costBudgetUsd } = this.limits;
    if (
      tokenBudget != null &&
      Number.isFinite(tokenBudget) &&
      this.accumulatedTokens > tokenBudget
    ) {
      return buildBudgetExceededEnvelope(
        ctx.requestId,
        ctx.pipelineId,
        ctx.workflowStart,
        {
          dimension: "token_budget",
          token_budget: tokenBudget,
          tokens_used: this.accumulatedTokens,
        },
        ctx.toolCalls ?? 0,
        {
          tokens_in: this.accumulatedTokens,
          cost_usd_est: this.accumulatedCostUsd,
        }
      );
    }
    if (
      costBudgetUsd != null &&
      Number.isFinite(costBudgetUsd) &&
      this.accumulatedCostUsd > costBudgetUsd
    ) {
      return buildBudgetExceededEnvelope(
        ctx.requestId,
        ctx.pipelineId,
        ctx.workflowStart,
        {
          dimension: "cost_budget_usd",
          cost_budget_usd: costBudgetUsd,
          cost_used_usd: this.accumulatedCostUsd,
        },
        ctx.toolCalls ?? 0,
        {
          tokens_in: this.accumulatedTokens,
          cost_usd_est: this.accumulatedCostUsd,
        }
      );
    }
    return null;
  }

  totals(): { tokens_in: number; cost_usd_est: number } {
    return {
      tokens_in: this.accumulatedTokens,
      cost_usd_est: this.accumulatedCostUsd,
    };
  }
}

export function createPipelineBudgetAccumulator(
  limits: PipelineBudgetLimits | undefined
): PipelineBudgetAccumulator {
  return new PipelineBudgetAccumulator(limits ?? {});
}

/** Check pre-accumulated totals (e.g. harness loop) without mutating an accumulator instance. */
export function checkCumulativeBudgetState(
  state: { accumulatedTokens: number; accumulatedCostUsd: number },
  limits: PipelineBudgetLimits,
  ctx: Omit<PipelineBudgetCheckContext, "limits">
): ResponseEnvelope | null {
  const acc = createPipelineBudgetAccumulator(limits);
  acc.accumulatedTokens = state.accumulatedTokens;
  acc.accumulatedCostUsd = state.accumulatedCostUsd;
  return acc.checkBlocked(ctx);
}

/** Sum metrics from all hops for accurate pipeline telemetry (WANT-014). */
export function sumHopMetrics(
  ...hops: Array<HopMetrics | undefined>
): { tokens_in: number; cost_usd_est: number } {
  let tokens_in = 0;
  let cost_usd_est = 0;
  for (const hop of hops) {
    tokens_in += hop?.tokens_used ?? 0;
    cost_usd_est += hop?.cost_estimate_usd ?? 0;
  }
  return { tokens_in, cost_usd_est };
}
