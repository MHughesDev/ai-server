/**
 * POST /v1/query handler – ingress → brain stem → policy → router → response.
 * @see L2-02 MVP runtime, L2-04 observability wiring
 */

import type { IngressResult } from "../ingress/types.js";
import { canonicalize } from "../brainstem/canonicalize.js";
import { extractIntent } from "../brainstem/intent.js";
import { createControlPlane } from "../controlplane/control-plane-impl.js";
import { assertCanDispatch, canDispatch } from "../controlplane/dispatch-gate.js";
import { defaultRouter } from "../router/default-router.js";
import { createChatPipeline } from "../pipelines/chat-pipeline.js";
import { withTimeoutAndRetry, StubModelGateway, ModelGatewayError } from "../gateways/model-gateway.js";
import type { ResponseEnvelope } from "../contracts/response-envelope.js";
import {
  runWithContextAsync,
  createContext,
  getTraceContext,
  getObservability,
  type TelemetryEvent,
} from "../observability/index.js";
import {
  incrementCounter,
  recordHistogram,
  METRIC_REQUESTS_TOTAL,
  METRIC_ERRORS_TOTAL,
  METRIC_REQUEST_LATENCY_MS,
  METRIC_ROUTE_TOTAL,
  METRIC_SECURITY_DENY_TOTAL,
  METRIC_AUDIT_WRITE_LATENCY_MS,
  METRIC_RETRIEVAL_LATENCY_MS,
  METRIC_RETRIEVAL_FALLBACK_TOTAL,
  METRIC_RETRIEVAL_HITS_TOTAL,
} from "../observability/metrics.js";
import { getConfig } from "../bootstrap/index.js";
import { writeAuditEvent } from "../security/audit-logger.js";
import { recordTenantUsage } from "../controlplane/tenant-budget.js";
import { getDefaultStore } from "../memory/default-store.js";
import { runRetrieval } from "../memory/retrieval-service.js";

function emit(event: TelemetryEvent): void {
  const obs = getObservability();
  if (obs) obs.events.emit(event);
}

function buildEvent(
  event_type: string,
  payload: Record<string, unknown>,
  redaction_level: "minimal" = "minimal"
): TelemetryEvent {
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

function writeSecurityAudit(
  event_type: string,
  payload: Record<string, unknown>
): void {
  const ctx = getTraceContext();
  const start = Date.now();
  writeAuditEvent({
    event_type,
    request_id: ctx?.request_id ?? "unknown",
    trace_id: ctx?.trace_id,
    timestamp_iso: new Date().toISOString(),
    payload,
  });
  recordHistogram(METRIC_AUDIT_WRITE_LATENCY_MS, Date.now() - start, {
    event_type,
  });
}

/**
 * Handle validated query: canonicalize → intent → control plane (policy → budget → route) → dispatch gate → pipeline.
 * No pipeline runs without explicit allow and pipeline plan (L2-03 non-bypass).
 */
export async function handleQuery(ingressResult: IngressResult): Promise<ResponseEnvelope> {
  const config = getConfig();
  const requestId = ingressResult.envelope.request_id;
  const ctx = createContext(requestId);
  const start = Date.now();

  return runWithContextAsync(ctx, async () => {
    try {
      const canonical = canonicalize(ingressResult.envelope);
      const intent = extractIntent(canonical);

      const controlPlane = createControlPlane({ router: defaultRouter });
      const multimodalCapablePipelines =
        config.flags.multimodal_input_path_enabled && config.flags.enable_multimodal_pipeline
          ? ["reactive_chat"]
          : undefined;
      const result = await controlPlane.decide({
        canonical,
        intent,
        caller: ingressResult.callerContext,
        multimodalCapablePipelines,
      });

      if (config.flags.observability_required_events_v1) {
        emit(
          buildEvent("POLICY_DECISION", {
            allowed: result.policyDecision.allowed,
            deny_reason: result.policyDecision.deny_reason,
            memory_scope: result.policyDecision.memory_scope,
            allowed_pipelines: result.policyDecision.allowed_pipelines,
          })
        );
        const budgets = result.policyDecision.max_budgets ?? {};
        emit(
          buildEvent("BUDGET_ASSIGN", {
            token_budget: budgets.token_budget,
            tool_budget: budgets.tool_budget,
            deadline_ms: budgets.deadline_ms,
            cost_budget_usd: budgets.cost_budget_usd,
          })
        );
      }
      if (config.flags.security_hard_controls_enabled) {
        writeSecurityAudit("SECURITY_POLICY_DECISION", {
          allowed: result.policyDecision.allowed,
          deny_reason: result.policyDecision.deny_reason ?? null,
          memory_scope: result.policyDecision.memory_scope ?? null,
        });
      }

      if (!canDispatch(result)) {
        const denyReason = result.routeResult.allowed ? "POLICY_BLOCKED" : result.routeResult.denyReason;
        if (config.flags.security_hard_controls_enabled) {
          incrementCounter(METRIC_SECURITY_DENY_TOTAL, 1, { reason: denyReason });
          writeSecurityAudit("SECURITY_ROUTE_DENY", {
            deny_reason: denyReason,
            stage: "control_plane",
          });
        }
        if (config.flags.observability_required_events_v1) {
          emit(
            buildEvent("ROUTE_DECISION", {
              deny: true,
              deny_reason: denyReason,
            })
          );
          emit(
            buildEvent("ERROR", {
              code: denyReason,
              message: "Request denied by governance",
              stage: "control_plane",
              detail_redacted: {},
            })
          );
        }
        incrementCounter(METRIC_REQUESTS_TOTAL, 1, { route: "denied", status: "blocked" });
        recordHistogram(METRIC_REQUEST_LATENCY_MS, Date.now() - start, {
          route: "denied",
          status: "blocked",
        });
        const blockedMessage =
          result.policyDecision.deny_reason === "BUDGET_EXCEEDED"
            ? "Token or cost budget exceeded"
            : denyReason === "MULTIMODAL_UNSUPPORTED"
              ? "Multimodal request but no capable pipeline allowed"
              : "Request blocked by policy";
        return {
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
        };
      }

      assertCanDispatch(result);
      const plan = result.pipelinePlan;

      // L2-06: Enable retrieval in plan when flag and policy scope allow
      const memoryScope = result.policyDecision.memory_scope ?? "none";
      if (
        config.flags.memory_retrieval_enabled &&
        memoryScope !== "none" &&
        !plan.memory?.retrieval
      ) {
        plan.memory = { retrieval: "default", top_k: 5 };
      }

      if (config.flags.observability_required_events_v1) {
        emit(
          buildEvent("ROUTE_DECISION", {
            route: plan.pipeline_type,
            pipeline_type: plan.pipeline_type,
            strategy_id: plan.strategy_id,
            deny: false,
          })
        );
        emit(
          buildEvent("PIPELINE_START", {
            pipeline_type: plan.pipeline_type,
            strategy_id: plan.strategy_id,
          })
        );
      }

      // L2-06: Run scoped retrieval when plan has memory.retrieval; fallback on failure
      let retrievalContext: { contextText: string; citations: Array<{ source: string; ref: string; span?: string }> } | undefined;
      if (plan.memory?.retrieval && memoryScope !== "none") {
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
          });
          if (retrievalResult.result.degraded) {
            incrementCounter(METRIC_RETRIEVAL_FALLBACK_TOTAL, 1, { status: "degraded" });
            if (config.flags.observability_required_events_v1) {
              emit(
                buildEvent("ERROR", {
                  code: "RETRIEVAL_UNAVAILABLE",
                  message: "Retrieval store degraded; proceeding without context",
                  stage: "retrieval",
                  detail_redacted: {},
                })
              );
            }
          } else {
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
            if (config.flags.observability_required_events_v1) {
              emit(
                buildEvent("MEMORY_QUERY", {
                  hit_count: retrievalResult.result.hits.length,
                  latency_ms: retrievalResult.result.latency_ms,
                  scope: memoryScope,
                })
              );
            }
          }
        } catch (err) {
          incrementCounter(METRIC_RETRIEVAL_FALLBACK_TOTAL, 1, { status: "error" });
          if (config.flags.observability_required_events_v1) {
            emit(
              buildEvent("ERROR", {
                code: "RETRIEVAL_UNAVAILABLE",
                message: err instanceof Error ? err.message : String(err),
                stage: "retrieval",
                detail_redacted: {},
              })
            );
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
      const chatPipeline = createChatPipeline(
        withTimeoutAndRetry(new StubModelGateway(), { timeoutMs: 25_000, maxRetries: 2 })
      );
      const response = await chatPipeline.run(harnessInput);

      const latencyMs = Date.now() - start;
      incrementCounter(METRIC_REQUESTS_TOTAL, 1, { route: plan.pipeline_type, status: "ok" });
      incrementCounter(METRIC_ROUTE_TOTAL, 1, { pipeline_type: plan.pipeline_type });
      recordHistogram(METRIC_REQUEST_LATENCY_MS, latencyMs, {
        route: plan.pipeline_type,
        status: "ok",
      });

      if (config.flags.observability_required_events_v1) {
        emit(
          buildEvent("PIPELINE_END", {
            pipeline_type: plan.pipeline_type,
            strategy_id: plan.strategy_id,
            duration_ms: latencyMs,
            status: "ok",
          })
        );
        emit(
          buildEvent("FINAL_SYNTH", {
            pipeline_type: plan.pipeline_type,
            status: "ok",
          })
        );
      }

      const telemetry = response.telemetry;
      const costUsd = telemetry?.cost_usd_est ?? 0;
      recordTenantUsage(ingressResult.callerContext.orgId, { cost_usd: costUsd });
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
    } catch (err) {
      const latencyMs = Date.now() - start;
      const errorCode = err instanceof ModelGatewayError ? err.code : "INTERNAL_ERROR";
      incrementCounter(METRIC_ERRORS_TOTAL, 1, { error_code: errorCode });
      incrementCounter(METRIC_REQUESTS_TOTAL, 1, { route: "unknown", status: "error" });
      recordHistogram(METRIC_REQUEST_LATENCY_MS, latencyMs, {
        route: "unknown",
        status: "error",
      });
      if (config.flags.security_hard_controls_enabled) {
        incrementCounter(METRIC_SECURITY_DENY_TOTAL, 1, { reason: "ERROR" });
        writeSecurityAudit("SECURITY_ERROR", {
          code: errorCode,
          stage: "query",
          message_redacted: true,
        });
      }
      if (config.flags.observability_required_events_v1) {
        emit(
          buildEvent("ERROR", {
            code: errorCode,
            message: err instanceof Error ? err.message : String(err),
            stage: "query",
            detail_redacted: {},
          })
        );
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
