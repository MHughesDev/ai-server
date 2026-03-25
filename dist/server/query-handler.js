/**
 * POST /v1/query handler – ingress → brain stem → policy → router → response.
 * @see L2-02 MVP runtime, L2-04 observability wiring
 */
import { canonicalize } from "../brainstem/canonicalize.js";
import { extractIntent } from "../brainstem/intent.js";
import { createControlPlane } from "../controlplane/control-plane-impl.js";
import { assertCanDispatch, canDispatch } from "../controlplane/dispatch-gate.js";
import { defaultRouter } from "../router/default-router.js";
import { createChatPipeline } from "../pipelines/chat-pipeline.js";
import { createCodingAgentPipeline } from "../pipelines/coding-agent-pipeline.js";
import { createDeepResearchPipeline } from "../pipelines/deep-research-pipeline.js";
import { createDecisionPipeline } from "../pipelines/decision-pipeline.js";
import { createNestedWorkflowPipeline } from "../pipelines/nested-workflow-pipeline.js";
import { createEngineRegistry } from "../engines/registry.js";
import { createProviderBackedModelGateway, ModelGatewayError } from "../gateways/model-gateway.js";
import { getDefaultToolGateway, AllowlistToolGateway, ExecutableToolGateway } from "../gateways/tool-gateway.js";
import { runWithContextAsync, createContext, getTraceContext, getObservability, } from "../observability/index.js";
import { incrementCounter, recordHistogram, METRIC_REQUESTS_TOTAL, METRIC_ERRORS_TOTAL, METRIC_REQUEST_LATENCY_MS, METRIC_ROUTE_TOTAL, METRIC_SECURITY_DENY_TOTAL, METRIC_AUDIT_WRITE_LATENCY_MS, METRIC_RETRIEVAL_LATENCY_MS, METRIC_RETRIEVAL_FALLBACK_TOTAL, METRIC_RETRIEVAL_HITS_TOTAL, } from "../observability/metrics.js";
import { getConfig } from "../bootstrap/index.js";
import { resolveFeatureFlagEnabled } from "../config/feature-flags.js";
import { writeAuditEvent } from "../security/audit-logger.js";
import { redact } from "../observability/redact.js";
import { recordTenantUsage } from "../controlplane/tenant-budget.js";
import { getDefaultStore } from "../memory/default-store.js";
import { runRetrieval } from "../memory/retrieval-service.js";
class RequestDeadlineExceededError extends Error {
    deadlineMs;
    constructor(deadlineMs) {
        super(`Request deadline exceeded after ${deadlineMs}ms`);
        this.deadlineMs = deadlineMs;
        this.name = "RequestDeadlineExceededError";
    }
}
async function withDeadline(promise, deadlineMs) {
    if (!deadlineMs || deadlineMs <= 0)
        return promise;
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    reject(new RequestDeadlineExceededError(deadlineMs));
                }, deadlineMs);
            }),
        ]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
function emit(event) {
    const obs = getObservability();
    if (obs)
        obs.events.emit(event);
}
function resolveQueryGovernanceGateFlags(ingressResult) {
    const config = getConfig();
    const flagContext = {
        org_id: ingressResult.callerContext.orgId,
        app_id: ingressResult.callerContext.appId,
        user_id: ingressResult.callerContext.userId,
    };
    const isFlagEnabled = (flagName) => resolveFeatureFlagEnabled(flagName, config, flagContext);
    return {
        multimodalInputPathEnabled: isFlagEnabled("multimodal_input_path_enabled") && isFlagEnabled("enable_multimodal_pipeline"),
        observabilityEnabled: isFlagEnabled("observability_required_events_v1"),
        securityHardControlsEnabled: isFlagEnabled("security_hard_controls_enabled"),
    };
}
/**
 * Brain stem + control plane through the dispatch gate (policy → budget → route → plan).
 * Async submit uses `skipPolicyTelemetryIfDispatchAllowed` so allowed jobs do not duplicate POLICY/BUDGET events before `handleQuery` runs on the worker.
 */
export async function runQueryGovernanceGate(ingressResult, start, gateFlags, options) {
    const { multimodalInputPathEnabled, observabilityEnabled, securityHardControlsEnabled } = gateFlags;
    const requestId = ingressResult.envelope.request_id;
    const canonical = canonicalize(ingressResult.envelope, ingressResult.callerContext);
    const intent = extractIntent(canonical);
    const controlPlane = createControlPlane({ router: defaultRouter });
    const multimodalCapablePipelines = multimodalInputPathEnabled ? ["reactive_chat"] : undefined;
    const result = await controlPlane.decide({
        canonical,
        intent,
        caller: ingressResult.callerContext,
        multimodalCapablePipelines,
    });
    const redactionLevel = (result.policyDecision.redaction_level ?? "minimal");
    const emitPolicyPhase = !options.skipPolicyTelemetryIfDispatchAllowed || !canDispatch(result);
    if (emitPolicyPhase && observabilityEnabled) {
        emit(buildEvent("POLICY_DECISION", {
            allowed: result.policyDecision.allowed,
            deny_reason: result.policyDecision.deny_reason,
            memory_scope: result.policyDecision.memory_scope,
            allowed_pipelines: result.policyDecision.allowed_pipelines,
        }, redactionLevel));
        const budgets = result.policyDecision.max_budgets ?? {};
        emit(buildEvent("BUDGET_ASSIGN", {
            token_budget: budgets.token_budget,
            tool_budget: budgets.tool_budget,
            deadline_ms: budgets.deadline_ms,
            cost_budget_usd: budgets.cost_budget_usd,
        }, redactionLevel));
    }
    if (emitPolicyPhase && securityHardControlsEnabled) {
        writeSecurityAudit("SECURITY_POLICY_DECISION", {
            allowed: result.policyDecision.allowed,
            deny_reason: result.policyDecision.deny_reason ?? null,
            memory_scope: result.policyDecision.memory_scope ?? null,
        }, redactionLevel);
    }
    if (!canDispatch(result)) {
        const denyReason = result.routeResult.allowed ? "POLICY_BLOCKED" : result.routeResult.denyReason;
        if (securityHardControlsEnabled) {
            incrementCounter(METRIC_SECURITY_DENY_TOTAL, 1, { reason: denyReason });
            writeSecurityAudit("SECURITY_ROUTE_DENY", {
                deny_reason: denyReason,
                stage: "control_plane",
            }, redactionLevel);
        }
        if (observabilityEnabled) {
            emit(buildEvent("ROUTE_DECISION", {
                deny: true,
                deny_reason: denyReason,
            }, redactionLevel));
            emit(buildEvent("ERROR", {
                code: denyReason,
                message: "Request denied by governance",
                stage: "control_plane",
                detail_redacted: {},
            }, redactionLevel));
        }
        incrementCounter(METRIC_REQUESTS_TOTAL, 1, { route: "denied", status: "blocked" });
        recordHistogram(METRIC_REQUEST_LATENCY_MS, Date.now() - start, {
            route: "denied",
            status: "blocked",
        });
        const blockedMessage = result.policyDecision.deny_reason === "BUDGET_EXCEEDED"
            ? "Token or cost budget exceeded"
            : denyReason === "MULTIMODAL_UNSUPPORTED"
                ? "Multimodal request but no capable pipeline allowed"
                : "Request blocked by policy";
        return {
            status: "blocked",
            response: {
                request_id: requestId,
                status: "blocked",
                error: {
                    code: denyReason,
                    message: blockedMessage,
                    detail: {},
                },
                mode: "sync",
                telemetry: {
                    pipeline: "none",
                    models_used: [],
                    tool_calls: 0,
                    tokens_in: 0,
                    tokens_out: 0,
                    cost_usd_est: 0,
                    latency_ms: Date.now() - start,
                },
            },
        };
    }
    assertCanDispatch(result);
    return {
        status: "ok",
        data: { canonical, intent, result, redactionLevel },
    };
}
/**
 * Run the same dispatch gate as `handleQuery` before enqueueing async work. Returns a blocked `ResponseEnvelope` when policy/budget/route would deny; otherwise `null`. Allowed path skips allow-side policy telemetry to avoid duplicate events when the worker runs `handleQuery`.
 */
export async function preflightAsyncQueryGovernance(ingressResult) {
    const requestId = ingressResult.envelope.request_id;
    const ctx = createContext(requestId);
    const start = Date.now();
    const gateFlags = resolveQueryGovernanceGateFlags(ingressResult);
    return runWithContextAsync(ctx, async () => {
        const gate = await runQueryGovernanceGate(ingressResult, start, gateFlags, {
            skipPolicyTelemetryIfDispatchAllowed: true,
        });
        return gate.status === "blocked" ? gate.response : null;
    });
}
function buildEvent(event_type, payload, redaction_level = "minimal") {
    const ctx = getTraceContext();
    return {
        event_type,
        request_id: ctx?.request_id ?? "unknown",
        trace_id: ctx?.trace_id,
        timestamp_iso: new Date().toISOString(),
        redaction_level,
        payload,
    };
}
function capabilityForPipeline(pipelineType) {
    if (pipelineType === "decision")
        return "classification";
    if (pipelineType === "deep_research")
        return "reasoning";
    return "chat";
}
/** L2-05: Audit payloads are redacted so no raw secrets in audit log. */
function writeSecurityAudit(event_type, payload, redactionLevel = "minimal") {
    const ctx = getTraceContext();
    const start = Date.now();
    const safePayload = redact(payload, redactionLevel);
    writeAuditEvent({
        event_type,
        request_id: ctx?.request_id ?? "unknown",
        trace_id: ctx?.trace_id,
        timestamp_iso: new Date().toISOString(),
        payload: safePayload,
    });
    recordHistogram(METRIC_AUDIT_WRITE_LATENCY_MS, Date.now() - start, {
        event_type,
    });
}
/**
 * Handle validated query: canonicalize → intent → control plane (policy → budget → route) → dispatch gate → pipeline.
 * No pipeline runs without explicit allow and pipeline plan (L2-03 non-bypass).
 */
export async function handleQuery(ingressResult) {
    const config = getConfig();
    const requestId = ingressResult.envelope.request_id;
    const ctx = createContext(requestId);
    const start = Date.now();
    const flagContext = {
        org_id: ingressResult.callerContext.orgId,
        app_id: ingressResult.callerContext.appId,
        user_id: ingressResult.callerContext.userId,
    };
    const isFlagEnabled = (flagName) => resolveFeatureFlagEnabled(flagName, config, flagContext);
    const gateFlags = resolveQueryGovernanceGateFlags(ingressResult);
    const memoryRetrievalEnabled = isFlagEnabled("memory_retrieval_enabled");
    const costCapsEnabled = isFlagEnabled("enable_cost_caps");
    const toolExecutionEnabled = process.env.TOOL_EXECUTION_ENABLED === "true";
    const { observabilityEnabled, securityHardControlsEnabled } = gateFlags;
    return runWithContextAsync(ctx, async () => {
        try {
            const gate = await runQueryGovernanceGate(ingressResult, start, gateFlags, {
                skipPolicyTelemetryIfDispatchAllowed: false,
            });
            if (gate.status === "blocked") {
                return gate.response;
            }
            const { canonical, intent, result, redactionLevel } = gate.data;
            const plan = result.pipelinePlan;
            if (!costCapsEnabled && plan.budgets?.cost_budget_usd !== undefined) {
                plan.budgets = { ...plan.budgets, cost_budget_usd: undefined };
            }
            // L2-06: Enable retrieval in plan when flag and policy scope allow
            const memoryScope = result.policyDecision.memory_scope ?? "none";
            if (memoryRetrievalEnabled &&
                memoryScope !== "none" &&
                !plan.memory?.retrieval) {
                plan.memory = { retrieval: memoryScope, top_k: 5 };
            }
            if (observabilityEnabled) {
                emit(buildEvent("ROUTE_DECISION", {
                    route: plan.pipeline_type,
                    pipeline_type: plan.pipeline_type,
                    strategy_id: plan.strategy_id,
                    deny: false,
                }, redactionLevel));
                emit(buildEvent("PIPELINE_START", {
                    pipeline_type: plan.pipeline_type,
                    strategy_id: plan.strategy_id,
                }, redactionLevel));
            }
            // L2-06: Run scoped retrieval when plan has memory.retrieval; for reactive_chat the pipeline uses Memory Engine instead.
            let retrievalContext;
            const pipelineUsesMemoryEngine = plan.pipeline_type === "reactive_chat";
            if (plan.memory?.retrieval &&
                memoryScope !== "none" &&
                !pipelineUsesMemoryEngine) {
                const store = getDefaultStore();
                const caller = {
                    user_id: ingressResult.callerContext.userId,
                    app_id: ingressResult.callerContext.appId,
                    org_id: ingressResult.callerContext.orgId,
                };
                try {
                    const retrievalResult = await runRetrieval(store, {
                        query_text: canonical.text ?? "",
                        scope: memoryScope,
                        caller,
                        top_k: plan.memory.top_k ?? 5,
                        retrieval_timeout_ms: config.memory.retrieval_timeout_ms,
                        max_context_chars: config.memory.max_context_chars,
                        max_context_tokens: plan.budgets?.token_budget != null
                            ? Math.max(64, Math.min(config.memory.max_context_tokens, Math.floor(plan.budgets.token_budget * 0.5)))
                            : config.memory.max_context_tokens,
                    });
                    if (retrievalResult.result.degraded) {
                        incrementCounter(METRIC_RETRIEVAL_FALLBACK_TOTAL, 1, { status: "degraded" });
                        if (observabilityEnabled) {
                            emit(buildEvent("ERROR", {
                                code: "RETRIEVAL_UNAVAILABLE",
                                message: "Retrieval store degraded; proceeding without context",
                                stage: "retrieval",
                                detail_redacted: {},
                            }, redactionLevel));
                        }
                    }
                    else {
                        retrievalContext = {
                            contextText: retrievalResult.contextText,
                            citations: retrievalResult.citations,
                        };
                        if (retrievalResult.result.latency_ms !== undefined) {
                            recordHistogram(METRIC_RETRIEVAL_LATENCY_MS, retrievalResult.result.latency_ms, {
                                pipeline_type: plan.pipeline_type,
                            });
                        }
                        incrementCounter(METRIC_RETRIEVAL_HITS_TOTAL, 1, {
                            pipeline_type: plan.pipeline_type,
                            status: retrievalResult.result.hits.length > 0 ? "hit" : "miss",
                        });
                        if (observabilityEnabled) {
                            emit(buildEvent("MEMORY_QUERY", {
                                hit_count: retrievalResult.result.hits.length,
                                latency_ms: retrievalResult.result.latency_ms,
                                scope: memoryScope,
                            }, redactionLevel));
                        }
                    }
                }
                catch (err) {
                    incrementCounter(METRIC_RETRIEVAL_FALLBACK_TOTAL, 1, { status: "error" });
                    if (observabilityEnabled) {
                        emit(buildEvent("ERROR", {
                            code: "RETRIEVAL_UNAVAILABLE",
                            message: err instanceof Error ? err.message : String(err),
                            stage: "retrieval",
                            detail_redacted: {},
                        }, redactionLevel));
                    }
                    // Proceed without retrieval (degraded path)
                }
            }
            const harnessInput = {
                canonical,
                intent,
                policy: result.policyDecision,
                plan,
                caller: {
                    app_id: ingressResult.callerContext.appId,
                    user_id: ingressResult.callerContext.userId,
                    org_id: ingressResult.callerContext.orgId,
                    session_id: ingressResult.callerContext.sessionId,
                    scopes: ingressResult.callerContext.scopes,
                },
                retrievalContext,
            };
            const modelGateway = createProviderBackedModelGateway({
                timeoutMs: config.model_gateway.timeout_ms,
                maxRetries: config.model_gateway.max_retries,
                defaultModel: config.model_gateway.default_model,
                default_capability: config.model_gateway.default_capability,
                providers: config.model_gateway.providers,
                registry: config.model_gateway.registry,
            }, {
                capability: capabilityForPipeline(plan.pipeline_type),
                org_id: ingressResult.callerContext.orgId,
                app_id: ingressResult.callerContext.appId,
                user_id: ingressResult.callerContext.userId,
            });
            const pipelineUsesMemory = pipelineUsesMemoryEngine ? { memoryStore: getDefaultStore() } : undefined;
            const hasToolsInPlan = (plan.tools_enabled?.length ?? 0) > 0;
            if (hasToolsInPlan && !toolExecutionEnabled) {
                console.warn("[query] tools requested in plan but TOOL_EXECUTION_ENABLED is false; using deny-only gateway");
            }
            /** WANT-006: Tools only via gateway; `plan.tools_enabled` is policy/router output. */
            const toolGatewayForPlan = hasToolsInPlan
                ? toolExecutionEnabled
                    ? new AllowlistToolGateway({
                        allowlist: plan.tools_enabled,
                        sandbox: plan.sandbox,
                        delegate: new ExecutableToolGateway(),
                    })
                    : getDefaultToolGateway()
                : getDefaultToolGateway();
            const memoryStoreForEngines = getDefaultStore();
            const getEngine = createEngineRegistry({
                modelGateway,
                toolGateway: toolGatewayForPlan,
                memoryStore: memoryStoreForEngines,
                toolsAllowlist: plan.tools_enabled,
            });
            // Closure references runnerDeps; must be assigned after getPipelineForWorkflow is defined
            // eslint-disable-next-line prefer-const -- circular: getPipelineForWorkflow closes over runnerDeps
            let runnerDeps;
            const getPipelineForWorkflow = (workflowId) => {
                switch (workflowId) {
                    case "coding_agent":
                        return createCodingAgentPipeline({
                            modelGateway,
                            toolGateway: toolGatewayForPlan,
                        });
                    case "deep_research":
                        return createDeepResearchPipeline({ modelGateway });
                    case "decision":
                        return createDecisionPipeline({ modelGateway });
                    case "tool_automation":
                    case "extraction":
                    case "verification":
                    case "planning_only":
                    case "batch_analysis":
                        return createNestedWorkflowPipeline({ runnerDeps });
                    default:
                        return createChatPipeline(modelGateway, pipelineUsesMemory);
                }
            };
            runnerDeps = { getEngine, getPipelineForWorkflow };
            const pipeline = plan.pipeline_type === "composite_example" ||
                plan.pipeline_type === "tool_automation" ||
                plan.pipeline_type === "extraction" ||
                plan.pipeline_type === "verification" ||
                plan.pipeline_type === "planning_only" ||
                plan.pipeline_type === "batch_analysis"
                ? createNestedWorkflowPipeline({ runnerDeps })
                : plan.pipeline_type === "coding_agent"
                    ? createCodingAgentPipeline({
                        modelGateway,
                        toolGateway: toolGatewayForPlan,
                    })
                    : plan.pipeline_type === "deep_research"
                        ? createDeepResearchPipeline({ modelGateway })
                        : plan.pipeline_type === "decision"
                            ? createDecisionPipeline({ modelGateway })
                            : createChatPipeline(modelGateway, pipelineUsesMemory);
            const response = await withDeadline(pipeline.run(harnessInput), plan.budgets?.deadline_ms);
            const latencyMs = Date.now() - start;
            incrementCounter(METRIC_REQUESTS_TOTAL, 1, { route: plan.pipeline_type, status: "ok" });
            incrementCounter(METRIC_ROUTE_TOTAL, 1, { pipeline_type: plan.pipeline_type });
            recordHistogram(METRIC_REQUEST_LATENCY_MS, latencyMs, {
                route: plan.pipeline_type,
                status: "ok",
            });
            if (observabilityEnabled) {
                emit(buildEvent("PIPELINE_END", {
                    pipeline_type: plan.pipeline_type,
                    strategy_id: plan.strategy_id,
                    duration_ms: latencyMs,
                    status: "ok",
                }, redactionLevel));
                emit(buildEvent("FINAL_SYNTH", {
                    pipeline_type: plan.pipeline_type,
                    status: "ok",
                }, redactionLevel));
            }
            const telemetry = response.telemetry;
            const costUsd = telemetry?.cost_usd_est ?? 0;
            const tokenUsage = (telemetry?.tokens_in ?? 0) + (telemetry?.tokens_out ?? 0);
            const tokenBudget = plan.budgets?.token_budget;
            const costBudgetUsd = plan.budgets?.cost_budget_usd;
            if (tokenBudget != null &&
                Number.isFinite(tokenBudget) &&
                tokenUsage > tokenBudget) {
                return {
                    request_id: requestId,
                    status: "blocked",
                    mode: "sync",
                    error: {
                        code: "BUDGET_EXCEEDED",
                        message: "Token budget exceeded",
                        detail: { token_budget: tokenBudget, tokens_used: tokenUsage },
                    },
                    telemetry: {
                        pipeline: telemetry?.pipeline ?? plan.pipeline_type,
                        models_used: telemetry?.models_used ?? [],
                        tool_calls: telemetry?.tool_calls ?? 0,
                        tokens_in: telemetry?.tokens_in ?? 0,
                        tokens_out: telemetry?.tokens_out ?? 0,
                        cost_usd_est: costUsd,
                        latency_ms: telemetry?.latency_ms ?? Date.now() - start,
                    },
                };
            }
            if (costCapsEnabled &&
                costBudgetUsd != null &&
                Number.isFinite(costBudgetUsd) &&
                costUsd > costBudgetUsd) {
                return {
                    request_id: requestId,
                    status: "blocked",
                    mode: "sync",
                    error: {
                        code: "BUDGET_EXCEEDED",
                        message: "Cost budget exceeded",
                        detail: { cost_budget_usd: costBudgetUsd, cost_used_usd: costUsd },
                    },
                    telemetry: {
                        pipeline: telemetry?.pipeline ?? plan.pipeline_type,
                        models_used: telemetry?.models_used ?? [],
                        tool_calls: telemetry?.tool_calls ?? 0,
                        tokens_in: telemetry?.tokens_in ?? 0,
                        tokens_out: telemetry?.tokens_out ?? 0,
                        cost_usd_est: costUsd,
                        latency_ms: telemetry?.latency_ms ?? Date.now() - start,
                    },
                };
            }
            try {
                await recordTenantUsage(ingressResult.callerContext.orgId, { cost_usd: costUsd });
            }
            catch (usageErr) {
                if (observabilityEnabled) {
                    emit(buildEvent("ERROR", {
                        code: "TENANT_USAGE_RECORD_FAILED",
                        message: usageErr instanceof Error ? usageErr.message : String(usageErr),
                        stage: "tenant_budget",
                        detail_redacted: {},
                    }, redactionLevel));
                }
            }
            return {
                ...response,
                telemetry: {
                    pipeline: telemetry?.pipeline ?? plan.pipeline_type,
                    models_used: telemetry?.models_used ?? [],
                    tool_calls: telemetry?.tool_calls ?? 0,
                    tokens_in: telemetry?.tokens_in ?? 0,
                    tokens_out: telemetry?.tokens_out ?? 0,
                    cost_usd_est: costUsd,
                    latency_ms: telemetry?.latency_ms ?? latencyMs,
                },
            };
        }
        catch (err) {
            if (err instanceof RequestDeadlineExceededError) {
                const latencyMs = Date.now() - start;
                incrementCounter(METRIC_REQUESTS_TOTAL, 1, { route: "deadline", status: "blocked" });
                recordHistogram(METRIC_REQUEST_LATENCY_MS, latencyMs, {
                    route: "deadline",
                    status: "blocked",
                });
                return {
                    request_id: requestId,
                    status: "blocked",
                    mode: "sync",
                    error: {
                        code: "BUDGET_EXCEEDED",
                        message: err.message,
                        detail: { deadline_ms: err.deadlineMs },
                    },
                    telemetry: {
                        pipeline: "unknown",
                        models_used: [],
                        tool_calls: 0,
                        tokens_in: 0,
                        tokens_out: 0,
                        cost_usd_est: 0,
                        latency_ms: latencyMs,
                    },
                };
            }
            const latencyMs = Date.now() - start;
            const errorCode = err instanceof ModelGatewayError ? err.code : "INTERNAL_ERROR";
            incrementCounter(METRIC_ERRORS_TOTAL, 1, { error_code: errorCode });
            incrementCounter(METRIC_REQUESTS_TOTAL, 1, { route: "unknown", status: "error" });
            recordHistogram(METRIC_REQUEST_LATENCY_MS, latencyMs, {
                route: "unknown",
                status: "error",
            });
            if (securityHardControlsEnabled) {
                incrementCounter(METRIC_SECURITY_DENY_TOTAL, 1, { reason: "ERROR" });
                writeSecurityAudit("SECURITY_ERROR", {
                    code: errorCode,
                    stage: "query",
                    message_redacted: true,
                });
            }
            if (observabilityEnabled) {
                emit(buildEvent("ERROR", {
                    code: errorCode,
                    message: err instanceof Error ? err.message : String(err),
                    stage: "query",
                    detail_redacted: {},
                }));
            }
            if (err instanceof ModelGatewayError) {
                return {
                    request_id: requestId,
                    status: "error",
                    mode: "sync",
                    error: {
                        code: err.code,
                        message: err.message,
                        detail: { retryable: err.retryable },
                    },
                    telemetry: {
                        pipeline: "reactive_chat",
                        models_used: [],
                        tool_calls: 0,
                        tokens_in: 0,
                        tokens_out: 0,
                        cost_usd_est: 0,
                        latency_ms: latencyMs,
                    },
                };
            }
            throw err;
        }
    });
}
//# sourceMappingURL=query-handler.js.map