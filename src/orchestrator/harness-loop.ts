/**
 * Autonomous execution ↔ tool harness loop — owned by orchestrator, not pipelines (WANT-004).
 */

import type { TypedArtifact } from "../contracts/index.js";
import type { EngineResult } from "../contracts/engine-result.js";
import type { ResponseEnvelope } from "../contracts/response-envelope.js";
import {
  buildBudgetExceededEnvelope,
  isFiniteToolBudget,
} from "../governance/budget-exceeded.js";
import { RequestDeadlineExceededError } from "../utils/async-deadline.js";
import {
  buildDeadlineExceededEnvelope,
  type PipelineDeadline,
} from "../utils/pipeline-deadline.js";
import type { OrchestratorExecutionSpec } from "./execution-spec.js";
import { hasToolBudgetRemaining } from "./execution-spec.js";

export interface HarnessLoopCallbacks {
  runExecution: (ctx: {
    iteration: number;
    context: TypedArtifact[];
    suggestedToolRef?: string;
  }) => Promise<EngineResult>;
  runTool: (ctx: {
    iteration: number;
    toolId: string;
    lastOutput: TypedArtifact;
    arguments?: Record<string, unknown>;
  }) => Promise<EngineResult>;
  onHarnessIteration?: (payload: {
    workflow_id: string;
    iteration: number;
    tool_calls_so_far: number;
    proposed_next_action?: string;
  }) => void;
  onWorkflowEnd?: (payload: { workflow_id: string; duration_ms: number; status: string }) => void;
}

export interface HarnessLoopParams {
  spec: OrchestratorExecutionSpec;
  workflowId: string;
  requestId: string;
  workflowStart: number;
  deadline: PipelineDeadline;
  allowlist: string[];
  initialContext: TypedArtifact[];
  basePrompt: string;
  callbacks: HarnessLoopCallbacks;
}

export type HarnessLoopOutcome =
  | {
      status: "ok";
      lastOutput: TypedArtifact;
      toolCallsCount: number;
      accumulatedExecTokens: number;
      accumulatedExecCost: number;
      totalExecDuration: number;
    }
  | { status: "blocked"; envelope: ResponseEnvelope }
  | { status: "error"; envelope: ResponseEnvelope }
  | { status: "deadline"; envelope: ResponseEnvelope };

export async function runExecutionToolHarnessLoop(
  params: HarnessLoopParams
): Promise<HarnessLoopOutcome> {
  const {
    spec,
    workflowId,
    requestId,
    workflowStart,
    deadline,
    allowlist,
    initialContext,
    basePrompt,
    callbacks,
  } = params;
  const toolBudget = spec.budgets.tool_budget;
  const deadlineMs = deadline.planDeadlineMs;
  const maxIterations = spec.max_harness_iterations;

  let context: TypedArtifact[] = [...initialContext];
  let iter = 0;
  let lastOutput: TypedArtifact =
    initialContext[0] ??
    ({ artifact_id: "harness_seed", artifact_kind: "report", encoding: "text", content: { inline: "" } } as TypedArtifact);
  let toolCallsCount = 0;
  let accumulatedExecTokens = 0;
  let accumulatedExecCost = 0;
  let totalExecDuration = 0;

  const endWorkflow = (status: string) => {
    callbacks.onWorkflowEnd?.({
      workflow_id: workflowId,
      duration_ms: Date.now() - workflowStart,
      status,
    });
  };

  while (iter < maxIterations) {
    if (deadline.isExceeded()) {
      endWorkflow("error");
      return {
        status: "deadline",
        envelope: buildDeadlineExceededEnvelope({
          requestId,
          pipelineType: workflowId,
          deadlineMs: deadlineMs!,
          latencyMs: Date.now() - workflowStart,
          toolCalls: toolCallsCount,
          tokensIn: accumulatedExecTokens,
          costUsdEst: accumulatedExecCost,
        }),
      };
    }

    let execResult: EngineResult;
    try {
      execResult = await callbacks.runExecution({
        iteration: iter,
        context,
        suggestedToolRef: allowlist[0],
      });
    } catch (err) {
      if (err instanceof RequestDeadlineExceededError && deadlineMs) {
        endWorkflow("error");
        return {
          status: "deadline",
          envelope: buildDeadlineExceededEnvelope({
            requestId,
            pipelineType: workflowId,
            deadlineMs,
            latencyMs: Date.now() - workflowStart,
            toolCalls: toolCallsCount,
            tokensIn: accumulatedExecTokens,
            costUsdEst: accumulatedExecCost,
          }),
        };
      }
      throw err;
    }

    totalExecDuration += execResult.metrics?.duration_ms ?? 0;
    accumulatedExecTokens += execResult.metrics?.tokens_used ?? 0;
    accumulatedExecCost += execResult.metrics?.cost_estimate_usd ?? 0;
    lastOutput = execResult.result_artifacts[0] ?? lastOutput;

    if (execResult.status !== "success") {
      endWorkflow("error");
      return {
        status: "error",
        envelope: {
          request_id: requestId,
          status: "error",
          mode: "sync",
          error: {
            code: execResult.error?.code ?? "INTERNAL_ERROR",
            message: execResult.error?.message ?? "Execution engine failed",
            detail: execResult.error?.detail,
          },
          telemetry: {
            pipeline: workflowId,
            models_used: [],
            tool_calls: toolCallsCount,
            tokens_in: execResult.metrics?.tokens_used ?? 0,
            tokens_out: 0,
            cost_usd_est: execResult.metrics?.cost_estimate_usd ?? 0,
            latency_ms: Date.now() - workflowStart,
          },
        },
      };
    }

    const proposed = execResult.proposed_next_action;
    const wantsTool =
      proposed?.type === "call_tool" &&
      typeof proposed.ref === "string" &&
      allowlist.includes(proposed.ref);

    if (wantsTool && isFiniteToolBudget(toolBudget) && !hasToolBudgetRemaining(toolCallsCount, toolBudget)) {
      endWorkflow("blocked");
      return {
        status: "blocked",
        envelope: buildBudgetExceededEnvelope(
          requestId,
          workflowId,
          workflowStart,
          {
            dimension: "tool_budget",
            tool_budget: toolBudget,
            tool_calls: toolCallsCount,
          },
          toolCallsCount
        ),
      };
    }

    const shouldCallTool = wantsTool && hasToolBudgetRemaining(toolCallsCount, toolBudget);

    if (shouldCallTool && proposed.ref) {
      const toolId = proposed.ref;
      let toolResult: EngineResult;
      try {
        toolResult = await callbacks.runTool({
          iteration: iter,
          toolId,
          lastOutput,
          arguments: proposed.arguments ?? { prompt: basePrompt },
        });
      } catch (err) {
        if (err instanceof RequestDeadlineExceededError && deadlineMs) {
          endWorkflow("error");
          return {
            status: "deadline",
            envelope: buildDeadlineExceededEnvelope({
              requestId,
              pipelineType: workflowId,
              deadlineMs,
              latencyMs: Date.now() - workflowStart,
              toolCalls: toolCallsCount,
              tokensIn: accumulatedExecTokens,
              costUsdEst: accumulatedExecCost,
            }),
          };
        }
        throw err;
      }
      toolCallsCount++;
      if (toolResult.status === "success" && toolResult.result_artifacts[0]) {
        const toolArtifact = toolResult.result_artifacts[0];
        context = [...context, lastOutput, toolArtifact];
        lastOutput = toolArtifact;
      } else {
        context = [...context, lastOutput];
      }
      callbacks.onHarnessIteration?.({
        workflow_id: workflowId,
        iteration: iter,
        tool_calls_so_far: toolCallsCount,
        proposed_next_action: proposed.type,
      });
    } else {
      break;
    }
    iter++;
  }

  return {
    status: "ok",
    lastOutput,
    toolCallsCount,
    accumulatedExecTokens,
    accumulatedExecCost,
    totalExecDuration,
  };
}
