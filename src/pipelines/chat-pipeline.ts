/**
 * Chat pipeline – reactive_chat path via Execution + Synthesis engines.
 * @see docs/SPEC/14_Pipelines_Catalog.md, L2-02 Phase 1, SOW M1 – wire to engines
 * When plan.memory is set and memoryStore is provided, uses Memory Engine for retrieval (SOW M4).
 */

import type { IPipeline, PipelineInput } from "./types.js";
import type { IModelGateway } from "../gateways/types.js";
import type { ResponseEnvelope } from "../contracts/response-envelope.js";
import type { EngineInvocation, TypedArtifact } from "../contracts/index.js";
import { canonicalToTypedArtifacts } from "../brainstem/canonical-to-artifacts.js";
import { createExecutionEngine } from "../engines/execution_engine.js";
import { createSynthesisEngine } from "../engines/synthesis_engine.js";
import { createMemoryEngine } from "../engines/memory_engine.js";
import type { IMemoryStore } from "../memory/memory-abstraction.js";
import { getTraceContext } from "../observability/context.js";
import { getObservability } from "../observability/index.js";
import { randomUUID } from "node:crypto";
import { DEFAULT_MAX_CONTEXT_TOKENS } from "../utils/tokens.js";
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

export function createChatPipeline(
  gateway: IModelGateway,
  options?: {
    memoryStore?: IMemoryStore;
    /** Config cap; combined with plan.token_budget like `query-handler` pre-pipeline retrieval. */
    memoryMaxContextTokens?: number;
    memoryRetrievalTimeoutMs?: number;
  }
): IPipeline {
  const executionEngine = createExecutionEngine(gateway);
  const synthesisEngine = createSynthesisEngine(gateway);
  const memoryStore = options?.memoryStore;

  return {
    async run(input: PipelineInput): Promise<ResponseEnvelope> {
      const { canonical, plan, retrievalContext: inputRetrievalContext, caller } = input;

      const deadline = PipelineDeadline.fromPlan(plan.budgets?.deadline_ms);
      const deadlineMs = deadline.planDeadlineMs;
      const ctx = getTraceContext();
      const requestId = canonical.request_id;
      const traceId = ctx?.trace_id;
      const workflowId = plan.pipeline_type;
      const workflowStart = Date.now();
      const budget = createPipelineBudgetAccumulator(plan.budgets);
      const budgetCtx = {
        requestId,
        pipelineId: plan.pipeline_type,
        workflowStart,
        toolCalls: 0,
      };

      emitWorkflowEvent("WORKFLOW_START", { workflow_id: workflowId });

      // M4: When plan has memory and we have a store, use Memory Engine for retrieval (workflow uses engine).
      let retrievalContext = inputRetrievalContext;
      const memoryScopeFromPolicy = input.policy?.memory_scope;
      if (
        plan.memory?.retrieval &&
        memoryStore &&
        memoryScopeFromPolicy &&
        memoryScopeFromPolicy !== "none"
      ) {
        const cfgCap = options?.memoryMaxContextTokens ?? DEFAULT_MAX_CONTEXT_TOKENS;
        const retrievalMaxContextTokens =
          plan.budgets?.token_budget != null
            ? Math.max(64, Math.min(cfgCap, Math.floor(plan.budgets.token_budget * 0.5)))
            : cfgCap;
        const memoryEngine = createMemoryEngine(memoryStore);
        const memoryInv: EngineInvocation = {
          invocation_id: randomUUID(),
          engine_type: "memory",
          task: {
            task_id: "mem-1",
            task_type: "retrieve",
            category: "retrieval",
            input_artifacts: [],
            objective: {
              formal_spec: {
                operation: "retrieve",
                query_text: canonical.text ?? "",
                scope: memoryScopeFromPolicy,
                top_k: plan.memory.top_k ?? 5,
                max_context_tokens: retrievalMaxContextTokens,
                ...(options?.memoryRetrievalTimeoutMs != null && options.memoryRetrievalTimeoutMs > 0
                  ? { retrieval_timeout_ms: options.memoryRetrievalTimeoutMs }
                  : {}),
              },
            },
          },
          context_artifacts: [],
          actor_context: {
            org_id: caller.org_id,
            app_id: caller.app_id,
            user_id: caller.user_id,
            roles: caller.scopes ?? [],
          },
          metadata: { trace_id: traceId, contract_version: "v1" },
        };
        let memoryResult;
        try {
          memoryResult = await deadline.run(() => memoryEngine.invoke(memoryInv));
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
        budget.record(memoryResult.metrics);
        const memoryBlocked = budget.checkBlocked(budgetCtx);
        if (memoryBlocked) {
          emitWorkflowEvent("WORKFLOW_END", {
            workflow_id: workflowId,
            duration_ms: Date.now() - workflowStart,
            status: "blocked",
          });
          return memoryBlocked;
        }
        if (memoryResult.status === "success" && memoryResult.result_artifacts[0]) {
          const art = memoryResult.result_artifacts[0];
          const inline = (art.content as { inline?: { citations?: Array<{ source: string; ref: string; span?: string }>; contextText?: string } })?.inline;
          if (inline) {
            retrievalContext = {
              contextText: inline.contextText ?? "",
              citations: inline.citations ?? [],
            };
          }
        }
      }

      const maxTokens = plan.budgets?.token_budget ?? 1024;
      const basePrompt = canonical.text || "(no input)";
      const prompt =
        retrievalContext?.contextText && retrievalContext.contextText.length > 0
          ? `Context:\n${retrievalContext.contextText}\n\nQuestion: ${basePrompt}`
          : basePrompt;

      const inputArtifacts: TypedArtifact[] = canonicalToTypedArtifacts(canonical);
      if (inputArtifacts.length === 0) {
        inputArtifacts.push(
          textToArtifact(basePrompt || "(no input)", randomUUID())
        );
      }

      const executionInvocationId = randomUUID();
      const executionInv: EngineInvocation = {
        invocation_id: executionInvocationId,
        engine_type: "execution",
        task: {
          task_id: "t1",
          task_type: "execute",
          category: "generation",
          objective: { description: prompt },
          input_artifacts: inputArtifacts,
        },
        context_artifacts: inputArtifacts,
        actor_context: {
          org_id: input.caller.org_id,
          app_id: input.caller.app_id,
          user_id: input.caller.user_id,
          roles: input.caller.scopes ?? [],
        },
        budgets: { token_budget: maxTokens },
        metadata: { trace_id: traceId, contract_version: "v1" },
      };

      emitEngineEvent("ENGINE_START", {
        engine_type: "execution",
        invocation_id: executionInvocationId,
      });
      const executionStart = Date.now();
      let executionResult;
      try {
        executionResult = await deadline.run(() => executionEngine.invoke(executionInv));
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
      const executionDuration = Date.now() - executionStart;
      emitEngineEvent("ENGINE_END", {
        engine_type: "execution",
        invocation_id: executionInvocationId,
        duration_ms: executionDuration,
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
            tokens_in: 0,
            tokens_out: 0,
            cost_usd_est: 0,
            latency_ms: executionDuration,
          },
        };
      }

      const executionOutputArtifact = executionResult.result_artifacts[0];
      const synthesisInputArtifact =
        executionOutputArtifact != null
          ? executionOutputArtifact
          : textToArtifact(prompt, randomUUID());

      const synthesisInvocationId = randomUUID();
      const synthesisInv: EngineInvocation = {
        invocation_id: synthesisInvocationId,
        engine_type: "synthesis",
        task: {
          task_id: "t2",
          task_type: "synthesize",
          category: "synthesis",
          input_artifacts: [],
        },
        context_artifacts: [synthesisInputArtifact],
        actor_context: {
          org_id: input.caller.org_id,
          app_id: input.caller.app_id,
          user_id: input.caller.user_id,
          roles: input.caller.scopes ?? [],
        },
        budgets: { token_budget: maxTokens },
        metadata: { trace_id: traceId, contract_version: "v1" },
      };

      emitEngineEvent("ENGINE_START", {
        engine_type: "synthesis",
        invocation_id: synthesisInvocationId,
      });
      const synthesisStart = Date.now();
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
            tokensIn: executionResult.metrics?.tokens_used ?? 0,
            costUsdEst: executionResult.metrics?.cost_estimate_usd ?? 0,
          });
        }
        throw err;
      }
      const synthesisDuration = Date.now() - synthesisStart;
      emitEngineEvent("ENGINE_END", {
        engine_type: "synthesis",
        invocation_id: synthesisInvocationId,
        duration_ms: synthesisDuration,
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
          text: outputText,
          citations,
          attachments,
        },
        telemetry: {
          pipeline: plan.pipeline_type,
          models_used: [],
          tool_calls: 0,
          tokens_in: tokensIn,
          tokens_out: 0,
          cost_usd_est: costUsd,
          latency_ms: executionDuration + synthesisDuration,
        },
      };
    },
  };
}
