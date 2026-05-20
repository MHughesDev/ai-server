/**
 * Per-request deadline budget shared across pipeline hops (PR-023).
 * @see WANT-004, WANT-015, plan.budgets.deadline_ms
 */

import type { ResponseEnvelope } from "../contracts/response-envelope.js";
import { RequestDeadlineExceededError, withDeadline } from "./async-deadline.js";

/** Tracks elapsed time against `plan.budgets.deadline_ms` for multi-hop pipelines. */
export class PipelineDeadline {
  constructor(
    private readonly totalDeadlineMs: number | undefined,
    private readonly startedAtMs: number = Date.now()
  ) {}

  static fromPlan(deadlineMs?: number, startedAtMs?: number): PipelineDeadline {
    return new PipelineDeadline(deadlineMs, startedAtMs);
  }

  get planDeadlineMs(): number | undefined {
    return this.totalDeadlineMs;
  }

  remainingMs(now = Date.now()): number | undefined {
    if (!this.totalDeadlineMs || this.totalDeadlineMs <= 0) return undefined;
    return this.totalDeadlineMs - (now - this.startedAtMs);
  }

  isExceeded(now = Date.now()): boolean {
    const remaining = this.remainingMs(now);
    return remaining !== undefined && remaining <= 0;
  }

  assertRemaining(now = Date.now()): void {
    const remaining = this.remainingMs(now);
    if (remaining !== undefined && remaining <= 0) {
      throw new RequestDeadlineExceededError(this.totalDeadlineMs!);
    }
  }

  /** Run async work within remaining plan deadline (no-op when unset). */
  async run<T>(work: () => Promise<T>): Promise<T> {
    this.assertRemaining();
    const remaining = this.remainingMs();
    if (remaining === undefined) {
      return work();
    }
    return withDeadline(work(), remaining);
  }
}

export function buildDeadlineExceededEnvelope(params: {
  requestId: string;
  pipelineType: string;
  deadlineMs: number;
  latencyMs: number;
  tokensIn?: number;
  costUsdEst?: number;
  toolCalls?: number;
}): ResponseEnvelope {
  return {
    request_id: params.requestId,
    status: "error",
    mode: "sync",
    error: {
      code: "DEADLINE_EXCEEDED",
      message: `Pipeline exceeded deadline of ${params.deadlineMs}ms`,
    },
    telemetry: {
      pipeline: params.pipelineType,
      models_used: [],
      tool_calls: params.toolCalls ?? 0,
      tokens_in: params.tokensIn ?? 0,
      tokens_out: 0,
      cost_usd_est: params.costUsdEst ?? 0,
      latency_ms: params.latencyMs,
    },
  };
}
