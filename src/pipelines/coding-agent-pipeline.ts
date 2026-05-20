/**
 * Coding Agent pipeline – execution ↔ tool ↔ evaluation → synthesis.
 * When harness_autonomous_execution_enabled (L2-99), runs autonomous loop: (execution ↔ tool)* → evaluation → synthesis.
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
import {
  buildBudgetExceededEnvelope,
  HARNESS_TOOL_ITERATION_ABSOLUTE_CAP,
  isFiniteToolBudget,
} from "../governance/budget-exceeded.js";
import { RequestDeadlineExceededError } from "../utils/async-deadline.js";
import {
  buildDeadlineExceededEnvelope,
  PipelineDeadline,
} from "../utils/pipeline-deadline.js";

/** Default max tool rounds when plan omits `tool_budget` (matches prior router defaults). */
const DEFAULT_MAX_HARNESS_ITERATIONS = 10;

function hasToolBudgetRemaining(toolCallsCount: number, toolBudget: number): boolean {
  return toolBudget > 0 && toolCallsCount < toolBudget;
}

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

      const maxTokens = plan.budgets?.token_budget ?? 1024;
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

      /** Autonomous harness: orchestration decided in router → `PipelinePlan.harness_autonomous_execution` (WANT-004). */
      const autonomousMode =
        plan.harness_autonomous_execution === true && allowlist.length > 0;

      const toolBudget = plan.budgets?.tool_budget ?? DEFAULT_MAX_HARNESS_ITERATIONS;
      const deadline = PipelineDeadline.fromPlan(plan.budgets?.deadline_ms, workflowStart);
      const deadlineMs = deadline.planDeadlineMs;

      const budgets = { token_budget: maxTokens, tool_budget: toolBudget };
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
        // L2-99: Autonomous harness loop — (execution ↔ tool)* until budget/deadline/no proposal.
        let context: TypedArtifact[] = [...inputArtifacts];
        // One extra execution round may be needed after the last allowed tool so we can block with
        // BUDGET_EXCEEDED when the model still proposes a tool (parity with `workflows/runner.ts`).
        const maxIterations = Math.min(
          Math.max(toolBudget + 1, 1),
          HARNESS_TOOL_ITERATION_ABSOLUTE_CAP
        );
        let iter = 0;
        let lastOutput: TypedArtifact = textToArtifact(prompt, randomUUID());

        while (iter < maxIterations) {
          if (deadline.isExceeded()) {
            emitWorkflowEvent("WORKFLOW_END", {
              workflow_id: workflowId,
              duration_ms: Date.now() - workflowStart,
              status: "error",
            });
            return buildDeadlineExceededEnvelope({
              requestId,
              pipelineType: plan.pipeline_type,
              deadlineMs: deadlineMs!,
              latencyMs: Date.now() - workflowStart,
              toolCalls: toolCallsCount,
              tokensIn: accumulatedExecTokens,
              costUsdEst: accumulatedExecCost,
            });
          }
          let execResult;
          try {
            execResult = await runOneExecution(
            context,
            `t_exec_${iter}`,
            allowlist[0]
            );
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
          totalExecDuration += execResult.metrics?.duration_ms ?? 0;
          accumulatedExecTokens += execResult.metrics?.tokens_used ?? 0;
          accumulatedExecCost += execResult.metrics?.cost_estimate_usd ?? 0;
          lastOutput = execResult.result_artifacts[0] ?? lastOutput;

          if (execResult.status !== "success") {
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
                code: execResult.error?.code ?? "INTERNAL_ERROR",
                message: execResult.error?.message ?? "Execution engine failed",
                detail: execResult.error?.detail,
              },
              telemetry: {
                pipeline: plan.pipeline_type,
                models_used: [],
                tool_calls: toolCallsCount,
                tokens_in: execResult.metrics?.tokens_used ?? 0,
                tokens_out: 0,
                cost_usd_est: execResult.metrics?.cost_estimate_usd ?? 0,
                latency_ms: Date.now() - workflowStart,
              },
            };
          }

          const proposed = execResult.proposed_next_action;
          const wantsTool =
            proposed?.type === "call_tool" &&
            typeof proposed.ref === "string" &&
            allowlist.includes(proposed.ref);

          if (wantsTool && isFiniteToolBudget(toolBudget) && !hasToolBudgetRemaining(toolCallsCount, toolBudget)) {
            emitWorkflowEvent("WORKFLOW_END", {
              workflow_id: workflowId,
              duration_ms: Date.now() - workflowStart,
              status: "blocked",
            });
            return buildBudgetExceededEnvelope(
              requestId,
              workflowId,
              workflowStart,
              {
                dimension: "tool_budget",
                tool_budget: toolBudget,
                tool_calls: toolCallsCount,
              },
              toolCallsCount
            );
          }

          const shouldCallTool = wantsTool && hasToolBudgetRemaining(toolCallsCount, toolBudget);

          if (shouldCallTool && proposed.ref) {
            const toolId = proposed.ref;
            const toolInvId = randomUUID();
            const toolInv: EngineInvocation = {
              invocation_id: toolInvId,
              engine_type: "tool",
              task: {
                task_id: `t_tool_${iter}`,
                task_type: "invoke_tool",
                category: "action",
                objective: {
                  formal_spec: {
                    tool_id: toolId,
                    parameters: proposed.arguments ?? { prompt: basePrompt },
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
            let toolResult;
            try {
              toolResult = await deadline.run(() => toolEngine.invoke(toolInv));
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
            const toolDuration = Date.now() - toolStart;
            emitEngineEvent("ENGINE_END", {
              engine_type: "tool",
              invocation_id: toolInvId,
              duration_ms: toolDuration,
            });
            toolCallsCount++;
            if (toolResult.status === "success" && toolResult.result_artifacts[0]) {
              const toolArtifact = toolResult.result_artifacts[0];
              context = [...context, lastOutput, toolArtifact];
              lastOutput = toolArtifact;
            } else {
              context = [...context, lastOutput];
            }
            emitHarnessIteration({
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

        executionOutput = lastOutput;
        toolOutput = lastOutput;
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
