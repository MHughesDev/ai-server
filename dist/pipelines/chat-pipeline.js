/**
 * Chat pipeline – reactive_chat path via Execution + Synthesis engines.
 * @see docs/SPEC/14_Pipelines_Catalog.md, L2-02 Phase 1, SOW M1 – wire to engines
 * When plan.memory is set and memoryStore is provided, uses Memory Engine for retrieval (SOW M4).
 */
import { canonicalToTypedArtifacts } from "../brainstem/canonical-to-artifacts.js";
import { createExecutionEngine } from "../engines/execution_engine.js";
import { createSynthesisEngine } from "../engines/synthesis_engine.js";
import { createMemoryEngine } from "../engines/memory_engine.js";
import { getTraceContext } from "../observability/context.js";
import { getObservability } from "../observability/index.js";
import { randomUUID } from "node:crypto";
function emitEngineEvent(eventType, payload) {
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
function emitWorkflowEvent(eventType, payload) {
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
function textToArtifact(text, artifactId) {
    return {
        artifact_id: artifactId,
        artifact_kind: "report",
        encoding: "text",
        content: { inline: text },
    };
}
/** Deadline exceeded error for pipeline timeouts */
class DeadlineExceededError extends Error {
    deadlineMs;
    constructor(deadlineMs) {
        super(`Pipeline deadline exceeded after ${deadlineMs}ms`);
        this.deadlineMs = deadlineMs;
        this.name = "DeadlineExceededError";
    }
}
async function runWithDeadline(promise, deadlineMs) {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new DeadlineExceededError(deadlineMs)), deadlineMs);
            }),
        ]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
export function createChatPipeline(gateway, options) {
    const executionEngine = createExecutionEngine(gateway);
    const synthesisEngine = createSynthesisEngine(gateway);
    const memoryStore = options?.memoryStore;
    return {
        async run(input) {
            const { canonical, plan, retrievalContext: inputRetrievalContext, caller } = input;
            // L2-05 Phase 1: Per-request deadline enforcement from plan.budgets.deadline_ms
            const deadlineMs = plan.budgets?.deadline_ms;
            const pipelineStart = Date.now();
            const ctx = getTraceContext();
            const requestId = canonical.request_id;
            const traceId = ctx?.trace_id;
            const workflowId = plan.pipeline_type;
            const workflowStart = Date.now();
            emitWorkflowEvent("WORKFLOW_START", { workflow_id: workflowId });
            // M4: When plan has memory and we have a store, use Memory Engine for retrieval (workflow uses engine).
            let retrievalContext = inputRetrievalContext;
            const memoryScopeFromPolicy = input.policy?.memory_scope;
            if (plan.memory?.retrieval &&
                memoryStore &&
                memoryScopeFromPolicy &&
                memoryScopeFromPolicy !== "none") {
                const memoryEngine = createMemoryEngine(memoryStore);
                const memoryInv = {
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
                const memoryResult = await memoryEngine.invoke(memoryInv);
                if (memoryResult.status === "success" && memoryResult.result_artifacts[0]) {
                    const art = memoryResult.result_artifacts[0];
                    const inline = art.content?.inline;
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
            // PRODUCTION: retrievalContext.contextText is unbounded; cap or truncate by token estimate so context + question doesn't exceed token_budget and doesn't blow memory.
            const prompt = retrievalContext?.contextText && retrievalContext.contextText.length > 0
                ? `Context:\n${retrievalContext.contextText}\n\nQuestion: ${basePrompt}`
                : basePrompt;
            const inputArtifacts = canonicalToTypedArtifacts(canonical);
            if (inputArtifacts.length === 0) {
                inputArtifacts.push(textToArtifact(basePrompt || "(no input)", randomUUID()));
            }
            const executionInvocationId = randomUUID();
            const executionInv = {
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
            // L2-05 Phase 1: Deadline enforcement for execution engine
            let executionResult;
            try {
                if (deadlineMs) {
                    const remainingMs = deadlineMs - (executionStart - pipelineStart);
                    if (remainingMs <= 0) {
                        throw new DeadlineExceededError(deadlineMs);
                    }
                    executionResult = await runWithDeadline(executionEngine.invoke(executionInv), remainingMs);
                }
                else {
                    executionResult = await executionEngine.invoke(executionInv);
                }
            }
            catch (err) {
                if (err instanceof DeadlineExceededError) {
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
                            code: "DEADLINE_EXCEEDED",
                            message: `Pipeline exceeded deadline of ${deadlineMs}ms`,
                        },
                        telemetry: {
                            pipeline: plan.pipeline_type,
                            models_used: [],
                            tool_calls: 0,
                            tokens_in: 0,
                            tokens_out: 0,
                            cost_usd_est: 0,
                            latency_ms: Date.now() - workflowStart,
                        },
                    };
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
            const synthesisInputArtifact = executionOutputArtifact != null
                ? executionOutputArtifact
                : textToArtifact(prompt, randomUUID());
            const synthesisInvocationId = randomUUID();
            const synthesisInv = {
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
            // L2-05 Phase 1: Deadline enforcement for synthesis engine
            let synthesisResult;
            try {
                if (deadlineMs) {
                    const remainingMs = deadlineMs - (synthesisStart - pipelineStart);
                    if (remainingMs <= 0) {
                        throw new DeadlineExceededError(deadlineMs);
                    }
                    synthesisResult = await runWithDeadline(synthesisEngine.invoke(synthesisInv), remainingMs);
                }
                else {
                    synthesisResult = await synthesisEngine.invoke(synthesisInv);
                }
            }
            catch (err) {
                if (err instanceof DeadlineExceededError) {
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
                            code: "DEADLINE_EXCEEDED",
                            message: `Pipeline exceeded deadline of ${deadlineMs}ms`,
                        },
                        telemetry: {
                            pipeline: plan.pipeline_type,
                            models_used: [],
                            tool_calls: 0,
                            tokens_in: executionResult.metrics?.tokens_used ?? 0,
                            tokens_out: 0,
                            cost_usd_est: executionResult.metrics?.cost_estimate_usd ?? 0,
                            latency_ms: Date.now() - workflowStart,
                        },
                    };
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
            const citations = retrievalContext?.citations?.length
                ? retrievalContext.citations.map((c) => ({
                    source: c.source,
                    ref: c.ref,
                    span: c.span,
                }))
                : [];
            const outputText = synthesisResult.status === "success" && synthesisResult.result_artifacts[0] != null
                ? String(synthesisResult.result_artifacts[0].content?.inline ?? "")
                : "";
            const attachments = (synthesisResult.result_artifacts ?? []).map((a) => ({
                artifact_id: a.artifact_id,
                artifact_uri: typeof a.content?.ref === "string" ? a.content.ref : undefined,
                artifact_kind: a.artifact_kind,
            }));
            const execMetrics = executionResult.metrics ?? {};
            const synthMetrics = synthesisResult.metrics ?? {};
            const tokensIn = (execMetrics.tokens_used ?? 0) + (synthMetrics.tokens_used ?? 0);
            const costUsd = (execMetrics.cost_estimate_usd ?? 0) + (synthMetrics.cost_estimate_usd ?? 0);
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
//# sourceMappingURL=chat-pipeline.js.map