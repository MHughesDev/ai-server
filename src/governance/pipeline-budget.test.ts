/**
 * Pipeline cumulative budget accumulator (WANT-014).
 */

import { describe, it, expect } from "@jest/globals";
import {
  createPipelineBudgetAccumulator,
  checkCumulativeBudgetState,
  sumHopMetrics,
} from "./pipeline-budget.js";

describe("PipelineBudgetAccumulator (WANT-014)", () => {
  it("blocks when cumulative tokens exceed token_budget", () => {
    const acc = createPipelineBudgetAccumulator({ token_budget: 150 });
    acc.record({ tokens_used: 100 });
    expect(acc.checkBlocked({
      requestId: "r1",
      pipelineId: "decision",
      workflowStart: Date.now() - 100,
    })).toBeNull();
    acc.record({ tokens_used: 60 });
    const blocked = acc.checkBlocked({
      requestId: "r1",
      pipelineId: "decision",
      workflowStart: Date.now() - 100,
    });
    expect(blocked?.status).toBe("blocked");
    expect(blocked?.error?.detail).toMatchObject({
      dimension: "token_budget",
      token_budget: 150,
      tokens_used: 160,
    });
    expect(blocked?.telemetry?.tokens_in).toBe(160);
  });

  it("blocks when cumulative cost exceeds cost_budget_usd", () => {
    const acc = createPipelineBudgetAccumulator({ cost_budget_usd: 0.5 });
    acc.record({ cost_estimate_usd: 0.3 });
    acc.record({ cost_estimate_usd: 0.25 });
    const blocked = acc.checkBlocked({
      requestId: "r1",
      pipelineId: "chat",
      workflowStart: Date.now() - 50,
    });
    expect(blocked?.error?.detail).toMatchObject({
      dimension: "cost_budget_usd",
      cost_budget_usd: 0.5,
      cost_used_usd: 0.55,
    });
  });

  it("checkCumulativeBudgetState mirrors accumulator checks for harness totals", () => {
    const blocked = checkCumulativeBudgetState(
      { accumulatedTokens: 200, accumulatedCostUsd: 0 },
      { token_budget: 150 },
      { requestId: "r1", pipelineId: "coding_agent", workflowStart: Date.now() }
    );
    expect(blocked?.status).toBe("blocked");
  });
});

describe("sumHopMetrics", () => {
  it("sums tokens and cost across hops", () => {
    expect(
      sumHopMetrics(
        { tokens_used: 10, cost_estimate_usd: 0.1 },
        { tokens_used: 5, cost_estimate_usd: 0.2 }
      )
    ).toEqual({ tokens_in: 15, cost_usd_est: expect.closeTo(0.3, 5) });
  });
});
