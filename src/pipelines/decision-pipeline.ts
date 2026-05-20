/**
 * Decision & Recommendation pipeline – options → score → decision memo (M5).
 * @see SOW Segment J; Architecture §11.5
 * Flow: execution (generate options) → evaluation (score/rank) → synthesis (decision memo).
 */

import type { IPipeline, PipelineInput } from "./types.js";
import type { IModelGateway } from "../gateways/types.js";
import type { ResponseEnvelope } from "../contracts/response-envelope.js";
import type { EngineInvocation, TypedArtifact } from "../contracts/index.js";
import type { DecisionMemoContent, Option } from "../contracts/m5-artifacts.js";
import { canonicalToTypedArtifacts } from "../brainstem/canonical-to-artifacts.js";
import { createExecutionEngine } from "../engines/execution_engine.js";
import { createEvaluationEngine } from "../engines/evaluation_engine.js";
import { createSynthesisEngine } from "../engines/synthesis_engine.js";
import { getTraceContext } from "../observability/context.js";
import { getObservability } from "../observability/index.js";
import { randomUUID } from "node:crypto";
import { RequestDeadlineExceededError } from "../utils/async-deadline.js";
import { createPipelineBudgetAccumulator } from "../governance/pipeline-budget.js";
import {
  buildDeadlineExceededEnvelope,
  PipelineDeadline,
} from "../utils/pipeline-deadline.js";

function emitEngineEvent(
  eventType: "ENGINE_START" | "ENGINE_END",
  payload: {
    engine_type: string;
    invocation_id: string;
    duration_ms?: number;
    cost_estimate_usd?: number;
    tokens_used?: number;
  }
): void {
  const obs = getObservability();
  const ctx = getTraceContext();
  if (obs?.events) {
    obs.events.emit({
      event_type: eventType,
      request_id: ctx?.request_id ?? "unknown",
      trace_id: ctx?.trace_id,
      timestamp_iso: new Date().toISOString(),
      redaction_level: "minimal",
      payload,
    });
  }
}

function emitWorkflowEvent(
  eventType: "WORKFLOW_START" | "WORKFLOW_END",
  payload: { workflow_id: string; duration_ms?: number; status?: string }
): void {
  const obs = getObservability();
  const ctx = getTraceContext();
  if (obs?.events) {
    obs.events.emit({
      event_type: eventType,
      request_id: ctx?.request_id ?? "unknown",
      trace_id: ctx?.trace_id,
      timestamp_iso: new Date().toISOString(),
      redaction_level: "minimal",
      payload,
    });
  }
}

function textToArtifact(text: string, artifactId: string): TypedArtifact {
  return {
    artifact_id: artifactId,
    artifact_kind: "report",
    encoding: "text",
    content: { inline: text },
  };
}

export interface CreateDecisionPipelineOptions {
  modelGateway: IModelGateway;
}

export function createDecisionPipeline(options: CreateDecisionPipelineOptions): IPipeline {
  const { modelGateway } = options;
  const executionEngine = createExecutionEngine(modelGateway);
  const evaluationEngine = createEvaluationEngine();
  const synthesisEngine = createSynthesisEngine(modelGateway);

  return {
    async run(input: PipelineInput): Promise<ResponseEnvelope> {
      const { canonical, plan, caller } = input;
      const ctx = getTraceContext();
      const requestId = canonical.request_id;
      const traceId = ctx?.trace_id;
      const workflowId = plan.pipeline_type;
      const workflowStart = Date.now();
      const deadline = PipelineDeadline.fromPlan(plan.budgets?.deadline_ms, workflowStart);
      const deadlineMs = deadline.planDeadlineMs;
      const maxTokens = plan.budgets?.token_budget ?? 2048;
      const query = canonical.text || "(no input)";
      const prompt = `List and briefly describe 2–3 options for: ${query}. Then recommend one with a short justification.`;

      emitWorkflowEvent("WORKFLOW_START", { workflow_id: workflowId });

      const inputArtifacts: TypedArtifact[] = canonicalToTypedArtifacts(canonical);
      if (inputArtifacts.length === 0) {
        inputArtifacts.push(textToArtifact(query, randomUUID()));
      }
      const actorContext = {
        org_id: caller.org_id,
        app_id: caller.app_id,
        user_id: caller.user_id,
        roles: caller.scopes ?? [],
      };
      const budgets = { token_budget: maxTokens };
      const metadata = { trace_id: traceId, contract_version: "v1" };
      const budget = createPipelineBudgetAccumulator(plan.budgets);
      const budgetCtx = {
        requestId,
        pipelineId: plan.pipeline_type,
        workflowStart,
        toolCalls: 0,
      };

      // Step 1: Execution (generate options)
      const execInvId = randomUUID();
      const execInv: EngineInvocation = {
        invocation_id: execInvId,
        engine_type: "execution",
        task: {
          task_id: "t1",
          task_type: "execute",
          category: "generation",
          objective: { description: prompt },
          input_artifacts: inputArtifacts,
        },
        context_artifacts: inputArtifacts,
        actor_context: actorContext,
        budgets,
        metadata,
      };
      emitEngineEvent("ENGINE_START", { engine_type: "execution", invocation_id: execInvId });
      const execStart = Date.now();
      let executionResult;
      try {
        executionResult = await deadline.run(() => executionEngine.invoke(execInv));
      } catch (err) {
        if (err instanceof RequestDeadlineExceededError && deadlineMs) {
          return buildDeadlineExceededEnvelope({
            requestId,
            pipelineType: plan.pipeline_type,
            deadlineMs,
            latencyMs: Date.now() - workflowStart,
          });
        }
        throw err;
      }
      const execDuration = Date.now() - execStart;
      emitEngineEvent("ENGINE_END", {
        engine_type: "execution",
        invocation_id: execInvId,
        duration_ms: execDuration,
        cost_estimate_usd: executionResult.metrics?.cost_estimate_usd,
        tokens_used: executionResult.metrics?.tokens_used,
      });
      budget.record(executionResult.metrics);
      const execBlocked = budget.checkBlocked(budgetCtx);
      if (execBlocked) {
        emitWorkflowEvent("WORKFLOW_END", {
          workflow_id: workflowId,
          duration_ms: Date.now() - workflowStart,
          status: "blocked",
        });
        return execBlocked;
      }

      if (executionResult.status !== "success") {
        emitWorkflowEvent("WORKFLOW_END", {
          workflow_id: workflowId,
          duration_ms: Date.now() - workflowStart,
          status: "error",
        });
        return {
          request_id: requestId,
          status: "error",
          mode: "sync",
          error: {
            code: executionResult.error?.code ?? "INTERNAL_ERROR",
            message: executionResult.error?.message ?? "Execution engine failed",
            detail: executionResult.error?.detail,
          },
          telemetry: {
            pipeline: plan.pipeline_type,
            models_used: [],
            tool_calls: 0,
            tokens_in: executionResult.metrics?.tokens_used ?? 0,
            tokens_out: 0,
            cost_usd_est: executionResult.metrics?.cost_estimate_usd ?? 0,
            latency_ms: execDuration,
          },
        };
      }

      const execOutput = executionResult.result_artifacts[0] ?? textToArtifact(prompt, randomUUID());
      const execText = String((execOutput.content as { inline?: string })?.inline ?? "");

      // Step 2: Evaluation (score/rank)
      const evalInvId = randomUUID();
      const evalInv: EngineInvocation = {
        invocation_id: evalInvId,
        engine_type: "evaluation",
        task: {
          task_id: "t2",
          task_type: "evaluate",
          category: "evaluation",
          input_artifacts: [execOutput],
        },
        context_artifacts: [execOutput],
        actor_context: actorContext,
        budgets,
        metadata,
      };
      emitEngineEvent("ENGINE_START", { engine_type: "evaluation", invocation_id: evalInvId });
      const evalStart = Date.now();
      let evaluationResult;
      try {
        evaluationResult = await deadline.run(() => evaluationEngine.invoke(evalInv));
      } catch (err) {
        if (err instanceof RequestDeadlineExceededError && deadlineMs) {
          return buildDeadlineExceededEnvelope({
            requestId,
            pipelineType: plan.pipeline_type,
            deadlineMs,
            latencyMs: Date.now() - workflowStart,
            tokensIn: executionResult.metrics?.tokens_used ?? 0,
            costUsdEst: executionResult.metrics?.cost_estimate_usd ?? 0,
          });
        }
        throw err;
      }
      const evalDuration = Date.now() - evalStart;
      emitEngineEvent("ENGINE_END", {
        engine_type: "evaluation",
        invocation_id: evalInvId,
        duration_ms: evalDuration,
        cost_estimate_usd: evaluationResult.metrics?.cost_estimate_usd,
        tokens_used: evaluationResult.metrics?.tokens_used,
      });
      budget.record(evaluationResult.metrics);
      const evalBlocked = budget.checkBlocked(budgetCtx);
      if (evalBlocked) {
        emitWorkflowEvent("WORKFLOW_END", {
          workflow_id: workflowId,
          duration_ms: Date.now() - workflowStart,
          status: "blocked",
        });
        return evalBlocked;
      }

      const evalOutput =
        evaluationResult.status === "success" && evaluationResult.result_artifacts[0]
          ? evaluationResult.result_artifacts[0]
          : execOutput;

      // Step 3: Synthesis (decision memo)
      const synthInvId = randomUUID();
      const synthInv: EngineInvocation = {
        invocation_id: synthInvId,
        engine_type: "synthesis",
        task: {
          task_id: "t3",
          task_type: "synthesize",
          category: "synthesis",
          input_artifacts: [],
        },
        context_artifacts: [evalOutput],
        actor_context: actorContext,
        budgets,
        metadata,
      };
      emitEngineEvent("ENGINE_START", { engine_type: "synthesis", invocation_id: synthInvId });
      const synthStart = Date.now();
      let synthesisResult;
      try {
        synthesisResult = await deadline.run(() => synthesisEngine.invoke(synthInv));
      } catch (err) {
        if (err instanceof RequestDeadlineExceededError && deadlineMs) {
          return buildDeadlineExceededEnvelope({
            requestId,
            pipelineType: plan.pipeline_type,
            deadlineMs,
            latencyMs: Date.now() - workflowStart,
            tokensIn: executionResult.metrics?.tokens_used ?? 0,
            costUsdEst: executionResult.metrics?.cost_estimate_usd ?? 0,
          });
        }
        throw err;
      }
      const synthDuration = Date.now() - synthStart;
      emitEngineEvent("ENGINE_END", {
        engine_type: "synthesis",
        invocation_id: synthInvId,
        duration_ms: synthDuration,
        cost_estimate_usd: synthesisResult.metrics?.cost_estimate_usd,
        tokens_used: synthesisResult.metrics?.tokens_used,
      });
      budget.record(synthesisResult.metrics);
      const synthBlocked = budget.checkBlocked(budgetCtx);
      if (synthBlocked) {
        emitWorkflowEvent("WORKFLOW_END", {
          workflow_id: workflowId,
          duration_ms: Date.now() - workflowStart,
          status: "blocked",
        });
        return synthBlocked;
      }

      const memoText =
        synthesisResult.status === "success" && synthesisResult.result_artifacts[0] != null
          ? String(
              (synthesisResult.result_artifacts[0].content as { inline?: string })?.inline ?? ""
            )
          : execText;

      // Build DecisionMemo artifact (options, scores, recommendation)
      const options: Option[] = [
        { option_id: "opt1", label: "Option A", description: execText.slice(0, 100), score: 0.8 },
        { option_id: "opt2", label: "Option B", description: "", score: 0.6 },
      ];
      const decisionMemo: DecisionMemoContent = {
        question: query,
        options,
        assumptions: [],
        risks: [],
        recommendation: memoText.slice(0, 300),
        recommendation_option_id: "opt1",
      };
      const memoArtifactId = randomUUID();

      const { tokens_in: tokensIn, cost_usd_est: costUsd } = budget.totals();

      emitWorkflowEvent("WORKFLOW_END", {
        workflow_id: workflowId,
        duration_ms: Date.now() - workflowStart,
        status: "ok",
      });

      return {
        request_id: requestId,
        status: "ok",
        mode: "sync",
        output: {
          text: decisionMemo.recommendation ?? memoText,
          structured: decisionMemo as unknown as Record<string, unknown>,
          citations: [],
          attachments: [
            {
              artifact_id: memoArtifactId,
              artifact_kind: "decision_memo",
            },
          ],
        },
        telemetry: {
          pipeline: plan.pipeline_type,
          models_used: [],
          tool_calls: 0,
          tokens_in: tokensIn,
          tokens_out: 0,
          cost_usd_est: costUsd,
          latency_ms: execDuration + evalDuration + synthDuration,
        },
      };
    },
  };
}
