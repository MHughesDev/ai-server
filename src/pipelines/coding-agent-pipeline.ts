/**
 * Coding Agent pipeline – execution ↔ tool ↔ evaluation → synthesis.
 * When plan.harness_autonomous_execution (L2-99 / WANT-004), runs orchestrator harness loop then evaluation → synthesis.
 * @see SOW M3 F.5–F.6; L2-99 Harness Readiness Gate; workflows/definitions coding_agent
 */

import type { IPipeline, PipelineInput } from "./types.js";
import type { IModelGateway, IToolGateway } from "../gateways/types.js";
import type { ResponseEnvelope } from "../contracts/response-envelope.js";
import type { EngineInvocation, TypedArtifact } from "../contracts/index.js";
import { canonicalToTypedArtifacts } from "../brainstem/canonical-to-artifacts.js";
import { createExecutionEngine } from "../engines/execution_engine.js";
import { createToolEngine } from "../engines/tool_engine.js";
import { createEvaluationEngine } from "../engines/evaluation_engine.js";
import { createSynthesisEngine } from "../engines/synthesis_engine.js";
import { getDefaultToolGateway } from "../gateways/tool-gateway.js";
import { getTraceContext } from "../observability/context.js";
import { getObservability } from "../observability/index.js";
import { randomUUID } from "node:crypto";
import { RequestDeadlineExceededError } from "../utils/async-deadline.js";
import {
  buildDeadlineExceededEnvelope,
  PipelineDeadline,
} from "../utils/pipeline-deadline.js";
import {
  hasToolBudgetRemaining,
  resolveOrchestratorExecutionSpec,
  runExecutionToolHarnessLoop,
} from "../orchestrator/index.js";

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

/** L2-99: Emit harness iteration event for autonomous loop observability. */
function emitHarnessIteration(payload: {
  workflow_id: string;
  iteration: number;
  tool_calls_so_far: number;
  proposed_next_action?: string;
}): void {
  const obs = getObservability();
  const ctx = getTraceContext();
  if (obs?.events) {
    obs.events.emit({
      event_type: "HARNESS_ITERATION",
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

export interface CreateCodingAgentPipelineOptions {
  modelGateway: IModelGateway;
  toolGateway?: IToolGateway;
}

export function createCodingAgentPipeline(options: CreateCodingAgentPipelineOptions): IPipeline {
  const { modelGateway, toolGateway = getDefaultToolGateway() } = options;
  const executionEngine = createExecutionEngine(modelGateway);
  const synthesisEngine = createSynthesisEngine(modelGateway);
  const evaluationEngine = createEvaluationEngine();

  return {
    async run(input: PipelineInput): Promise<ResponseEnvelope> {
      const { canonical, plan, retrievalContext } = input;
      const ctx = getTraceContext();
      const requestId = canonical.request_id;
      const traceId = ctx?.trace_id;
      const workflowId = plan.pipeline_type;
      const workflowStart = Date.now();
      const allowlist = plan.tools_enabled ?? [];
      const toolEngine = createToolEngine(toolGateway ?? getDefaultToolGateway(), { allowlist });

      emitWorkflowEvent("WORKFLOW_START", { workflow_id: workflowId });

      /** WANT-004: mode and budgets resolved by orchestrator from plan — no feature-flag or local mode logic. */
      const execSpec = resolveOrchestratorExecutionSpec(plan);
      const basePrompt = canonical.text || "(no input)";
      const prompt =
        retrievalContext?.contextText && retrievalContext.contextText.length > 0
          ? `Context:\n${retrievalContext.contextText}\n\nTask: ${basePrompt}`
          : basePrompt;

      const inputArtifacts: TypedArtifact[] = canonicalToTypedArtifacts(canonical);
      if (inputArtifacts.length === 0) {
        inputArtifacts.push(textToArtifact(basePrompt || "(no input)", randomUUID()));
      }

      const actorContext = {
        org_id: input.caller.org_id,
        app_id: input.caller.app_id,
        user_id: input.caller.user_id,
        roles: input.caller.scopes ?? [],
      };

      const autonomousMode = execSpec.harness_autonomous_execution;
      const toolBudget = execSpec.budgets.tool_budget;
      const deadline = PipelineDeadline.fromPlan(execSpec.budgets.deadline_ms, workflowStart);
      const deadlineMs = deadline.planDeadlineMs;

      const budgets = {
        token_budget: execSpec.budgets.token_budget,
        tool_budget: toolBudget,
      };
      const metadata = {
        trace_id: traceId,
        contract_version: "v1",
        audit_level: input.policy.audit_level,
        redaction_level: input.policy.redaction_level,
      };
      let executionOutput: TypedArtifact;
      let toolOutput: TypedArtifact;
      let toolCallsCount = 0;
      let executionResult: Awaited<ReturnType<typeof executionEngine.invoke>> | undefined;
      let totalExecDuration = 0;
      let accumulatedExecTokens = 0;
      let accumulatedExecCost = 0;

      const runOneExecution = async (
        contextArtifacts: TypedArtifact[],
        taskId: string,
        suggestedToolRef?: string
      ): Promise<Awaited<ReturnType<typeof executionEngine.invoke>>> => {
        const executionInvId = randomUUID();
        const objective: { description: string; formal_spec?: Record<string, unknown> } = {
          description: prompt,
        };
        if (suggestedToolRef) {
          objective.formal_spec = { suggested_tool_ref: suggestedToolRef };
        }
        const executionInv: EngineInvocation = {
          invocation_id: executionInvId,
          engine_type: "execution",
          task: {
            task_id: taskId,
            task_type: "execute",
            category: "generation",
            objective,
            input_artifacts: contextArtifacts,
          },
          context_artifacts: contextArtifacts,
          actor_context: actorContext,
          budgets,
          metadata,
        };
        emitEngineEvent("ENGINE_START", { engine_type: "execution", invocation_id: executionInvId });
        const execStart = Date.now();
        const result = await deadline.run(() => executionEngine.invoke(executionInv));
        const execDuration = Date.now() - execStart;
        emitEngineEvent("ENGINE_END", {
          engine_type: "execution",
          invocation_id: executionInvId,
          duration_ms: execDuration,
          cost_estimate_usd: result.metrics?.cost_estimate_usd,
          tokens_used: result.metrics?.tokens_used,
        });
        return result;
      };

      if (autonomousMode) {
        const harnessOutcome = await runExecutionToolHarnessLoop({
          spec: execSpec,
          workflowId,
          requestId,
          workflowStart,
          deadline,
          allowlist,
          initialContext: inputArtifacts,
          basePrompt,
          callbacks: {
            onHarnessIteration: emitHarnessIteration,
            onWorkflowEnd: (payload) => emitWorkflowEvent("WORKFLOW_END", payload),
            runExecution: async ({ iteration, context, suggestedToolRef }) =>
              runOneExecution(context, `t_exec_${iteration}`, suggestedToolRef),
            runTool: async ({ iteration, toolId, lastOutput, arguments: toolArgs }) => {
              const toolInvId = randomUUID();
              const toolInv: EngineInvocation = {
                invocation_id: toolInvId,
                engine_type: "tool",
                task: {
                  task_id: `t_tool_${iteration}`,
                  task_type: "invoke_tool",
                  category: "action",
                  objective: {
                    formal_spec: {
                      tool_id: toolId,
                      parameters: toolArgs ?? { prompt: basePrompt },
                    },
                  },
                  input_artifacts: [lastOutput],
                },
                context_artifacts: [lastOutput],
                actor_context: actorContext,
                budgets,
                metadata,
              };
              emitEngineEvent("ENGINE_START", { engine_type: "tool", invocation_id: toolInvId });
              const toolStart = Date.now();
              const toolResult = await deadline.run(() => toolEngine.invoke(toolInv));
              emitEngineEvent("ENGINE_END", {
                engine_type: "tool",
                invocation_id: toolInvId,
                duration_ms: Date.now() - toolStart,
              });
              return toolResult;
            },
          },
        });

        if (harnessOutcome.status !== "ok") {
          return harnessOutcome.envelope;
        }
        toolCallsCount = harnessOutcome.toolCallsCount;
        accumulatedExecTokens = harnessOutcome.accumulatedExecTokens;
        accumulatedExecCost = harnessOutcome.accumulatedExecCost;
        totalExecDuration = harnessOutcome.totalExecDuration;
        executionOutput = harnessOutcome.lastOutput;
        toolOutput = harnessOutcome.lastOutput;
      } else {
        // Single-pass: execution → optional one tool → evaluation → synthesis
        try {
          executionResult = await runOneExecution(inputArtifacts, "t1");
        } catch (err) {
          if (err instanceof RequestDeadlineExceededError && deadlineMs) {
            emitWorkflowEvent("WORKFLOW_END", {
              workflow_id: workflowId,
              duration_ms: Date.now() - workflowStart,
              status: "error",
            });
            return buildDeadlineExceededEnvelope({
              requestId,
              pipelineType: plan.pipeline_type,
              deadlineMs,
              latencyMs: Date.now() - workflowStart,
            });
          }
          throw err;
        }
        totalExecDuration = executionResult.metrics?.duration_ms ?? 0;

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
              latency_ms: totalExecDuration,
            },
          };
        }

        executionOutput =
          executionResult.result_artifacts[0] ?? textToArtifact(prompt, randomUUID());
        toolOutput = executionOutput;
        const firstToolId = allowlist[0];
        if (firstToolId && hasToolBudgetRemaining(toolCallsCount, toolBudget)) {
          const toolInvId = randomUUID();
          const toolInv: EngineInvocation = {
            invocation_id: toolInvId,
            engine_type: "tool",
            task: {
              task_id: "t2",
              task_type: "invoke_tool",
              category: "action",
              objective: { formal_spec: { tool_id: firstToolId, parameters: { prompt: basePrompt } } },
              input_artifacts: [executionOutput],
            },
            context_artifacts: [executionOutput],
            actor_context: actorContext,
            budgets,
            metadata,
          };
          emitEngineEvent("ENGINE_START", { engine_type: "tool", invocation_id: toolInvId });
          const toolStart = Date.now();
          try {
            const toolResult = await deadline.run(() => toolEngine.invoke(toolInv));
            const toolDuration = Date.now() - toolStart;
            emitEngineEvent("ENGINE_END", {
              engine_type: "tool",
              invocation_id: toolInvId,
              duration_ms: toolDuration,
            });
            toolCallsCount += 1;
            if (toolResult.status === "success" && toolResult.result_artifacts[0]) {
              toolOutput = toolResult.result_artifacts[0];
            }
          } catch (err) {
            if (err instanceof RequestDeadlineExceededError && deadlineMs) {
              emitWorkflowEvent("WORKFLOW_END", {
                workflow_id: workflowId,
                duration_ms: Date.now() - workflowStart,
                status: "error",
              });
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
        }
      }

      // Step 3: Evaluation
      const evalInvId = randomUUID();
      const evalInv: EngineInvocation = {
        invocation_id: evalInvId,
        engine_type: "evaluation",
        task: {
          task_id: "t3",
          task_type: "evaluate",
          category: "evaluation",
          input_artifacts: [toolOutput],
        },
        context_artifacts: [toolOutput],
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
          emitWorkflowEvent("WORKFLOW_END", {
            workflow_id: workflowId,
            duration_ms: Date.now() - workflowStart,
            status: "error",
          });
          return buildDeadlineExceededEnvelope({
            requestId,
            pipelineType: plan.pipeline_type,
            deadlineMs,
            latencyMs: Date.now() - workflowStart,
            toolCalls: toolCallsCount,
            tokensIn: accumulatedExecTokens,
            costUsdEst: accumulatedExecCost,
          });
        }
        throw err;
      }
      const evalDuration = Date.now() - evalStart;
      emitEngineEvent("ENGINE_END", {
        engine_type: "evaluation",
        invocation_id: evalInvId,
        duration_ms: evalDuration,
      });

      const synthesisInput =
        evaluationResult.status === "success" && evaluationResult.result_artifacts[0]
          ? evaluationResult.result_artifacts[0]
          : toolOutput;

      // Step 4: Synthesis
      const synthesisInvId = randomUUID();
      const synthesisInv: EngineInvocation = {
        invocation_id: synthesisInvId,
        engine_type: "synthesis",
        task: {
          task_id: "t4",
          task_type: "synthesize",
          category: "synthesis",
          input_artifacts: [],
        },
        context_artifacts: [synthesisInput],
        actor_context: actorContext,
        budgets,
        metadata,
      };
      emitEngineEvent("ENGINE_START", { engine_type: "synthesis", invocation_id: synthesisInvId });
      const synthStart = Date.now();
      let synthesisResult;
      try {
        synthesisResult = await deadline.run(() => synthesisEngine.invoke(synthesisInv));
      } catch (err) {
        if (err instanceof RequestDeadlineExceededError && deadlineMs) {
          emitWorkflowEvent("WORKFLOW_END", {
            workflow_id: workflowId,
            duration_ms: Date.now() - workflowStart,
            status: "error",
          });
          return buildDeadlineExceededEnvelope({
            requestId,
            pipelineType: plan.pipeline_type,
            deadlineMs,
            latencyMs: Date.now() - workflowStart,
            toolCalls: toolCallsCount,
            tokensIn: accumulatedExecTokens,
            costUsdEst: accumulatedExecCost,
          });
        }
        throw err;
      }
      const synthDuration = Date.now() - synthStart;
      emitEngineEvent("ENGINE_END", {
        engine_type: "synthesis",
        invocation_id: synthesisInvId,
        duration_ms: synthDuration,
        cost_estimate_usd: synthesisResult.metrics?.cost_estimate_usd,
        tokens_used: synthesisResult.metrics?.tokens_used,
      });

      const citations = retrievalContext?.citations?.length
        ? retrievalContext.citations.map((c) => ({
            source: c.source,
            ref: c.ref,
            span: c.span,
          }))
        : [];

      const outputText =
        synthesisResult.status === "success" && synthesisResult.result_artifacts[0] != null
          ? String(
              (synthesisResult.result_artifacts[0].content as { inline?: string })?.inline ?? ""
            )
          : "";

      const attachments = (synthesisResult.result_artifacts ?? []).map((a) => ({
        artifact_id: a.artifact_id,
        artifact_uri: typeof a.content?.ref === "string" ? a.content.ref : undefined,
        artifact_kind: a.artifact_kind,
      }));

      const synthMetrics = synthesisResult.metrics ?? {};
      const execTokens = autonomousMode
        ? accumulatedExecTokens
        : (executionResult?.metrics?.tokens_used ?? 0);
      const execCost = autonomousMode
        ? accumulatedExecCost
        : (executionResult?.metrics?.cost_estimate_usd ?? 0);
      const tokensIn = execTokens + (synthMetrics.tokens_used ?? 0);
      const costUsd = execCost + (synthMetrics.cost_estimate_usd ?? 0);

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
          text: outputText,
          citations,
          attachments,
        },
        telemetry: {
          pipeline: plan.pipeline_type,
          models_used: [],
          tool_calls: toolCallsCount,
          tokens_in: tokensIn,
          tokens_out: 0,
          cost_usd_est: costUsd,
          latency_ms: totalExecDuration + evalDuration + synthDuration,
        },
      };
    },
  };
}
