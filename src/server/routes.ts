/**
 * HTTP route handlers – health, ready, metrics, version, query.
 * @see docs/SPEC/02_API_Contracts.md
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { validateIngress } from "../ingress/validate.js";
import type { IngressRejection } from "../ingress/errors.js";
import { getConfig } from "../bootstrap/index.js";
import { CONTRACT_VERSION } from "../contracts/index.js";
import {
  readJsonBody,
  HEADER_REQUEST_ID,
  HEADER_AUTHORIZATION,
  BodyTooLargeError,
  RequestAbortedError,
  RequestReadTimeoutError,
} from "./middleware.js";
import { handleQuery, preflightAsyncQueryGovernance } from "./query-handler.js";
import {
  exchangeToken,
  queryRequiresAiJwt,
  verifyQueryCallerFromAuthHeader,
} from "./auth.js";
import {
  checkQueryRateLimitAsync,
  createRateLimitedRejection,
  attachRateLimitHeaders,
  detectAbuse,
} from "./rate-limit.js";
import { checkOperationalDependenciesAsync } from "./dependencies.js";
import { RequestQueue, sendBackpressureResponse, handleCors } from "./transport.js";
import { type JobQueueService, IdempotencyKeyConflictError } from "../queue/job-queue.js";
import {
  fingerprintAsyncQueryEnvelope,
  MAX_ASYNC_IDEMPOTENCY_KEY_LENGTH,
} from "../queue/async-idempotency.js";
import type { JobStatus } from "../queue/types.js";
import type { FeatureFlags } from "../config/schema.js";
import type { FlagScope } from "../config/feature-flags.js";
import { getFeatureFlagService, resolveFeatureFlagEnabled } from "../config/feature-flags.js";
import { runProductionPreflight } from "./preflight.js";

// Global request queue for backpressure (Phase 7.1)
const requestQueue = new RequestQueue({
  maxConcurrent: parseInt(process.env.MAX_CONCURRENT_REQUESTS ?? "100", 10),
  maxQueueDepth: parseInt(process.env.MAX_REQUEST_QUEUE_DEPTH ?? "50", 10),
});

// Gap 3A: Async job queue service (initialized by bootstrap)
let jobQueueService: JobQueueService | null = null;

export function setJobQueueService(service: JobQueueService | null): void {
  jobQueueService = service;
}

export function getJobQueueService(): JobQueueService | null {
  return jobQueueService;
}

class RequestProcessingTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Request processing timed out after ${timeoutMs}ms`);
    this.name = "RequestProcessingTimeoutError";
  }
}

async function withRequestTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new RequestProcessingTimeoutError(timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  // L2-06 Phase 7.1: CORS handling
  const corsHandled = handleCors(req, res, {
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS?.split(",") ?? "*",
    allowedMethods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    allowCredentials: process.env.CORS_ALLOW_CREDENTIALS === "true",
    maxAge: 86400,
  });
  if (corsHandled) return;

  // L2-06 Phase 7.1: Request queue / backpressure
  const queueRelease = await requestQueue.acquire();
  if (!queueRelease) {
    sendBackpressureResponse(res, 10);
    return;
  }

  try {
    await processRequest(req, res);
  } finally {
    queueRelease();
  }
}

async function processRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const method = req.method ?? "GET";
  const scheme = (req.socket as { encrypted?: boolean }).encrypted ? "https" : "http";
  const url = new URL(req.url ?? "/", `${scheme}://${req.headers.host ?? "localhost"}`);
  const path = url.pathname;
  const config = getConfig();
  const authHeader = getHeaderValue(req.headers[HEADER_AUTHORIZATION]);

  if (method === "GET" && path === "/healthz") {
    if (!isOperationalAccessAllowed(config.operationalBearerToken, authHeader)) {
      sendJson(res, 401, {
        status: "error",
        error: { code: "AUTH_INVALID", message: "Unauthorized operational endpoint access" },
      });
      return;
    }
    // L2-04: Async dependency-aware health check
    const deps = await checkOperationalDependenciesAsync(config);
    sendJson(res, deps.healthy ? 200 : 503, {
      status: deps.healthy ? "ok" : "degraded",
      version: deps.version,
      dependencies: deps.dependencies,
    });
    return;
  }
  if (method === "GET" && path === "/readyz") {
    if (!isOperationalAccessAllowed(config.operationalBearerToken, authHeader)) {
      sendJson(res, 401, {
        status: "error",
        error: { code: "AUTH_INVALID", message: "Unauthorized operational endpoint access" },
      });
      return;
    }
    // L2-04: Async dependency-aware readiness check
    const deps = await checkOperationalDependenciesAsync(config);
    sendJson(res, deps.ready ? 200 : 503, {
      ready: deps.ready,
      version: deps.version,
      dependencies: deps.dependencies,
    });
    return;
  }
  if (method === "GET" && path === "/metrics") {
    if (!isOperationalAccessAllowed(config.operationalBearerToken, authHeader)) {
      sendJson(res, 401, {
        status: "error",
        error: { code: "AUTH_INVALID", message: "Unauthorized operational endpoint access" },
      });
      return;
    }
    const { getCounterSnapshot, getHistogramSnapshot, getPrometheusText } = await import("../observability/metrics.js");
    const urlFormat = url.searchParams.get("format");
    const accept = (req.headers["accept"] as string) ?? "";
    const wantsPrometheus =
      urlFormat === "prometheus" || accept.includes("text/plain");
    if (wantsPrometheus) {
      const text = getPrometheusText();
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(text);
      return;
    }
    const counters = getCounterSnapshot();
    const histograms = getHistogramSnapshot();
    sendJson(res, 200, { counters, histograms });
    return;
  }
  if (method === "GET" && path === "/v1/version") {
    if (!isOperationalAccessAllowed(config.operationalBearerToken, authHeader)) {
      sendJson(res, 401, {
        status: "error",
        error: { code: "AUTH_INVALID", message: "Unauthorized operational endpoint access" },
      });
      return;
    }
    const versionPayload: Record<string, unknown> = {
      contract_version: CONTRACT_VERSION,
      api: "v1",
      version: process.env.APP_VERSION ?? "0.1.0",
    };
    if (config.release?.release_id) versionPayload.release_id = config.release.release_id;
    if (config.release?.build_id) versionPayload.build_id = config.release.build_id;
    if (config.env) versionPayload.env = config.env;
    sendJson(res, 200, versionPayload);
    return;
  }
  if (method === "GET" && path === "/v1/preflight") {
    if (!isOperationalAccessAllowed(config.operationalBearerToken, authHeader)) {
      sendJson(res, 401, {
        status: "error",
        error: { code: "AUTH_INVALID", message: "Unauthorized operational endpoint access" },
      });
      return;
    }
    const report = await runProductionPreflight(config);
    sendJson(res, report.summary.status === "pass" ? 200 : 503, report);
    return;
  }

  if (method === "POST" && path === "/token/exchange") {
    const rolloutEnabled = isFeatureFlagEnabled("platform_production_rollout_enabled", config);
    if (config.env === "production" && !rolloutEnabled) {
      sendJson(res, 503, {
        status: "error",
        error: { code: "POLICY_BLOCKED", message: "Platform rollout is currently disabled" },
      });
      return;
    }
    try {
      const body = await readJsonBody(req, config.maxRequestBodyBytes, {
        timeoutMs: config.requestReadTimeoutMs,
      });
      const response = await exchangeToken(body, config);
      sendJson(res, 200, response);
    } catch (err) {
      if (isIngressRejection(err)) {
        sendErrorRejection(res, err);
        return;
      }
      if (err instanceof Error && (err.name === "BodyTooLargeError" || err.name === "InvalidJsonError")) {
        sendJson(res, 400, {
          request_id: (req.headers[HEADER_REQUEST_ID] as string) || null,
          status: "error",
          error: {
            code: "INVALID_PAYLOAD",
            message: err.message,
            detail: err instanceof BodyTooLargeError ? { max_bytes: err.maxBytes } : undefined,
          },
        });
        return;
      }
      if (err instanceof RequestReadTimeoutError) {
        sendJson(res, 408, {
          request_id: (req.headers[HEADER_REQUEST_ID] as string) || null,
          status: "error",
          error: {
            code: "INVALID_PAYLOAD",
            message: err.message,
            detail: { timeout_ms: err.timeoutMs },
          },
        });
        return;
      }
      if (err instanceof RequestAbortedError) {
        sendJson(res, 499, {
          request_id: (req.headers[HEADER_REQUEST_ID] as string) || null,
          status: "error",
          error: {
            code: "INVALID_PAYLOAD",
            message: err.message,
          },
        });
        return;
      }
      sendJson(res, 500, {
        status: "error",
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
    return;
  }

  // Gap 3A: Async job submission endpoint
  if (method === "POST" && path === "/v1/query/async") {
    const rolloutEnabled = isFeatureFlagEnabled("platform_production_rollout_enabled", config);
    if (config.env === "production" && !rolloutEnabled) {
      sendJson(res, 503, {
        status: "error",
        error: { code: "POLICY_BLOCKED", message: "Platform rollout is currently disabled" },
      });
      return;
    }
    if (!jobQueueService) {
      sendJson(res, 503, {
        status: "error",
        error: { code: "ASYNC_NOT_AVAILABLE", message: "Async job queue not configured" },
      });
      return;
    }
    try {
      const verifiedCallerContext = verifyQueryCallerFromAuthHeader(authHeader, config);
      const flagContext = verifiedCallerContext
        ? {
            org_id: verifiedCallerContext.orgId,
            app_id: verifiedCallerContext.appId,
            user_id: verifiedCallerContext.userId,
          }
        : undefined;
      const multimodalInputPathEnabled = isFeatureFlagEnabled(
        "multimodal_input_path_enabled",
        config,
        flagContext
      );
      const contentLength = req.headers["content-length"];
      const len = contentLength ? parseInt(contentLength, 10) : undefined;
      const body = await readJsonBody(req, config.maxRequestBodyBytes, {
        timeoutMs: config.requestReadTimeoutMs,
      });
      const requestIdHeader = req.headers[HEADER_REQUEST_ID] as string | undefined;
      const ingressResult = validateIngress(body, {
        maxBodyBytes: config.maxRequestBodyBytes,
        contentLength: len,
        requestIdHeader,
        requireAuthHeader: queryRequiresAiJwt(config),
        authHeader,
        contractVersion: CONTRACT_VERSION,
        multimodalInputPathEnabled,
        attachmentLimits: {
          maxCount: config.maxAttachmentCount,
          maxBytesPerAttachment: config.maxAttachmentBytes,
        },
        verifiedCallerContext,
      });

      // Rate limiting
      const rateLimitDecision = await checkQueryRateLimitAsync(
        config.ingress_rate_limit,
        ingressResult.callerContext,
        req.socket.remoteAddress
      );
      attachRateLimitHeaders(res, rateLimitDecision);
      if (!rateLimitDecision.allowed) {
        throw createRateLimitedRejection(rateLimitDecision);
      }

      const governanceBlocked = await preflightAsyncQueryGovernance(ingressResult);
      if (governanceBlocked) {
        sendJson(res, 200, governanceBlocked);
        return;
      }

      let idempotencyKey: string | undefined;
      const idemHeaderRaw = getHeaderValue(req.headers["idempotency-key"]);
      if (idemHeaderRaw !== undefined) {
        const trimmed = idemHeaderRaw.trim();
        if (trimmed.length > MAX_ASYNC_IDEMPOTENCY_KEY_LENGTH) {
          sendJson(res, 400, {
            status: "error",
            error: {
              code: "INVALID_PAYLOAD",
              message: `Idempotency-Key exceeds max length (${MAX_ASYNC_IDEMPOTENCY_KEY_LENGTH})`,
            },
          });
          return;
        }
        if (trimmed.length > 0) {
          idempotencyKey = trimmed;
        }
      }

      // Extract webhook URL from headers if provided
      const webhookUrl = req.headers["x-webhook-url"] as string | undefined;

      const submission = {
        request: ingressResult,
        webhook_url: webhookUrl,
        max_attempts: 3,
        metadata: {
          org_id: ingressResult.callerContext.orgId,
          app_id: ingressResult.callerContext.appId,
          user_id: ingressResult.callerContext.userId,
          trace_id: requestIdHeader,
        },
        ...(idempotencyKey
          ? {
              idempotency: {
                key: idempotencyKey,
                fingerprint: fingerprintAsyncQueryEnvelope(ingressResult.envelope),
              },
            }
          : {}),
      };

      // Submit async job
      const job = await jobQueueService.submitJob(submission);

      sendJson(res, 202, {
        status: "accepted",
        job_id: job.id,
        status_url: `/v1/jobs/${job.id}`,
        created_at: job.created_at,
      });
    } catch (err) {
      if (isIngressRejection(err)) {
        sendErrorRejection(res, err);
        return;
      }
      if (err instanceof IdempotencyKeyConflictError) {
        sendJson(res, 409, {
          status: "error",
          error: {
            code: "IDEMPOTENCY_KEY_CONFLICT",
            message: "Idempotency-Key already used for a different request body",
          },
        });
        return;
      }
      sendJson(res, 500, {
        status: "error",
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
    return;
  }

  // Gap 3A: Get job status endpoint
  if (method === "GET" && path.startsWith("/v1/jobs/")) {
    if (!jobQueueService) {
      sendJson(res, 503, {
        status: "error",
        error: { code: "ASYNC_NOT_AVAILABLE", message: "Async job queue not configured" },
      });
      return;
    }
    const jobId = path.replace("/v1/jobs/", "");
    if (!jobId || jobId.includes("/")) {
      sendJson(res, 400, {
        status: "error",
        error: { code: "INVALID_JOB_ID", message: "Invalid job ID" },
      });
      return;
    }
    const job = await jobQueueService.getJob(jobId);
    if (!job) {
      sendJson(res, 404, {
        status: "error",
        error: { code: "JOB_NOT_FOUND", message: "Job not found" },
      });
      return;
    }
    sendJson(res, 200, { status: "ok", job });
    return;
  }

  // Gap 3A: Cancel job endpoint
  if (method === "POST" && path.startsWith("/v1/jobs/") && path.endsWith("/cancel")) {
    if (!jobQueueService) {
      sendJson(res, 503, {
        status: "error",
        error: { code: "ASYNC_NOT_AVAILABLE", message: "Async job queue not configured" },
      });
      return;
    }
    const jobId = path.replace("/v1/jobs/", "").replace("/cancel", "");
    if (!jobId || jobId.includes("/")) {
      sendJson(res, 400, {
        status: "error",
        error: { code: "INVALID_JOB_ID", message: "Invalid job ID" },
      });
      return;
    }
    const cancelled = await jobQueueService.cancelJob(jobId);
    if (!cancelled) {
      sendJson(res, 409, {
        status: "error",
        error: { code: "CANNOT_CANCEL", message: "Job cannot be cancelled (not found or already completed)" },
      });
      return;
    }
    sendJson(res, 200, { status: "ok", job_id: jobId, cancelled: true });
    return;
  }

  // Gap 3A: List jobs endpoint
  if (method === "GET" && path === "/v1/jobs") {
    if (!jobQueueService) {
      sendJson(res, 503, {
        status: "error",
        error: { code: "ASYNC_NOT_AVAILABLE", message: "Async job queue not configured" },
      });
      return;
    }
    const urlParams = new URLSearchParams(url.search);
    const jobs = await jobQueueService.listJobs({
      status: urlParams.get("status") as JobStatus | undefined,
      org_id: urlParams.get("org_id") ?? undefined,
      app_id: urlParams.get("app_id") ?? undefined,
      user_id: urlParams.get("user_id") ?? undefined,
      limit: urlParams.get("limit") ? parseInt(urlParams.get("limit")!, 10) : undefined,
      offset: urlParams.get("offset") ? parseInt(urlParams.get("offset")!, 10) : undefined,
    });
    sendJson(res, 200, { status: "ok", jobs, count: jobs.length });
    return;
  }

  // Gap 3D: Feature flag admin endpoints
  if (path.startsWith("/admin/flags")) {
    if (!isOperationalAccessAllowed(config.operationalBearerToken, authHeader)) {
      sendJson(res, 401, {
        status: "error",
        error: { code: "AUTH_INVALID", message: "Unauthorized admin endpoint access" },
      });
      return;
    }

    const flagService = getFeatureFlagService();

    if (!flagService) {
      sendJson(res, 503, {
        status: "error",
        error: { code: "FLAGS_NOT_AVAILABLE", message: "Feature flag service not initialized" },
      });
      return;
    }

    // GET /admin/flags - List all flags
    if (method === "GET" && path === "/admin/flags") {
      const flags = flagService.getAllFlags();
      sendJson(res, 200, { status: "ok", flags });
      return;
    }

    // POST /admin/flags/evaluate - Evaluate a flag
    if (method === "POST" && path === "/admin/flags/evaluate") {
      const body = (await readJsonBody(req, config.maxRequestBodyBytes, {
        timeoutMs: config.requestReadTimeoutMs,
      })) as Record<string, unknown>;
      const result = flagService.evaluateFlag(body.flag_name as keyof FeatureFlags, {
        org_id: typeof body.org_id === "string" ? body.org_id : undefined,
        app_id: typeof body.app_id === "string" ? body.app_id : undefined,
        user_id: typeof body.user_id === "string" ? body.user_id : undefined,
      });
      sendJson(res, 200, { status: "ok", result });
      return;
    }

    // POST /admin/flags/overrides - Create override
    if (method === "POST" && path === "/admin/flags/overrides") {
      const body = (await readJsonBody(req, config.maxRequestBodyBytes, {
        timeoutMs: config.requestReadTimeoutMs,
      })) as Record<string, unknown>;
      flagService.setOverride({
        flag_name: String(body.flag_name ?? ""),
        scope: body.scope as FlagScope,
        scope_id: String(body.scope_id ?? ""),
        enabled: body.enabled === true,
        variant: typeof body.variant === "string" ? body.variant : undefined,
        payload:
          body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
            ? (body.payload as Record<string, unknown>)
            : undefined,
        expires_at: typeof body.expires_at === "string" ? body.expires_at : undefined,
      });
      sendJson(res, 201, { status: "ok", message: "Override created" });
      return;
    }

    // DELETE /admin/flags/overrides/:flag/:scope/:scopeId - Remove override
    if (method === "DELETE" && path.startsWith("/admin/flags/overrides/")) {
      const parts = path.replace("/admin/flags/overrides/", "").split("/");
      if (parts.length === 3) {
        const [flagName, scope, scopeId] = parts;
        flagService.removeOverride(flagName, scope as FlagScope, scopeId);
        sendJson(res, 200, { status: "ok", message: "Override removed" });
        return;
      }
    }

    // GET /admin/flags/overrides/:scope/:scopeId - List overrides for scope
    if (method === "GET" && path.startsWith("/admin/flags/overrides/")) {
      const parts = path.replace("/admin/flags/overrides/", "").split("/");
      if (parts.length === 2) {
        const [scope, scopeId] = parts;
        const overrides = flagService.getOverrides(scope as FlagScope, scopeId);
        sendJson(res, 200, { status: "ok", overrides });
        return;
      }
    }
  }

  if (method === "POST" && path === "/v1/query") {
    const rolloutEnabled = isFeatureFlagEnabled("platform_production_rollout_enabled", config);
    if (config.env === "production" && !rolloutEnabled) {
      sendJson(res, 503, {
        status: "error",
        error: { code: "POLICY_BLOCKED", message: "Platform rollout is currently disabled" },
      });
      return;
    }
    // PRODUCTION: Add per-request timeout (e.g. from plan.budgets.deadline_ms) so slow pipelines don't hold connections indefinitely.
    if (!isFeatureFlagEnabled("runtime_mvp_query_chat_enabled", config)) {
      sendJson(res, 404, { error: "MVP query endpoint not enabled" });
      return;
    }
    try {
      const verifiedCallerContext = verifyQueryCallerFromAuthHeader(authHeader, config);
      const flagContext = verifiedCallerContext
        ? {
            org_id: verifiedCallerContext.orgId,
            app_id: verifiedCallerContext.appId,
            user_id: verifiedCallerContext.userId,
          }
        : undefined;
      const multimodalInputPathEnabled = isFeatureFlagEnabled(
        "multimodal_input_path_enabled",
        config,
        flagContext
      );
      const contentLength = req.headers["content-length"];
      const len = contentLength ? parseInt(contentLength, 10) : undefined;
      const body = await readJsonBody(req, config.maxRequestBodyBytes, {
        timeoutMs: config.requestReadTimeoutMs,
      });
      const requestIdHeader = req.headers[HEADER_REQUEST_ID] as string | undefined;
      const ingressResult = validateIngress(body, {
        maxBodyBytes: config.maxRequestBodyBytes,
        contentLength: len,
        requestIdHeader,
        requireAuthHeader: queryRequiresAiJwt(config),
        authHeader,
        contractVersion: CONTRACT_VERSION,
        multimodalInputPathEnabled,
        attachmentLimits: {
          maxCount: config.maxAttachmentCount,
          maxBytesPerAttachment: config.maxAttachmentBytes,
        },
        verifiedCallerContext,
      });
      // L2-05: Async rate limiting with Redis support
      const rateLimitDecision = await checkQueryRateLimitAsync(
        config.ingress_rate_limit,
        ingressResult.callerContext,
        req.socket.remoteAddress
      );
      // L2-05: Attach rate limit headers
      attachRateLimitHeaders(res, rateLimitDecision);
      if (!rateLimitDecision.allowed) {
        throw createRateLimitedRejection(rateLimitDecision);
      }
      // L2-05: Abuse detection
      const abuseResult = detectAbuse(req, ingressResult.callerContext);
      if (abuseResult.detected) {
        console.warn("[rate-limit] Abuse detected:", {
          orgId: ingressResult.callerContext.orgId,
          appId: ingressResult.callerContext.appId,
          userId: ingressResult.callerContext.userId,
          patterns: abuseResult.patterns,
        });
        // Log but don't block - can be enhanced to block if needed
      }
      const processingTimeoutMs = parseInt(process.env.REQUEST_PROCESSING_TIMEOUT_MS ?? "120000", 10);
      const response = await withRequestTimeout(handleQuery(ingressResult), processingTimeoutMs);
      sendJson(res, 200, response);
    } catch (err) {
      if (isIngressRejection(err)) {
        if (err.code === "ATTACHMENT_REJECTED" && err.detail?.attachment_reason) {
          const { incrementCounter, METRIC_ATTACHMENT_REJECT_TOTAL } = await import("../observability/metrics.js");
          incrementCounter(METRIC_ATTACHMENT_REJECT_TOTAL, 1, {
            reason: String(err.detail.attachment_reason),
          });
        }
        sendErrorRejection(res, err);
        return;
      }
      if (err instanceof RequestProcessingTimeoutError) {
        sendJson(res, 504, {
          request_id: (req.headers[HEADER_REQUEST_ID] as string) || null,
          status: "error",
          error: {
            code: "TIMEOUT",
            message: err.message,
            detail: { timeout_ms: err.timeoutMs },
          },
        });
        return;
      }
      if (err instanceof Error && (err.name === "BodyTooLargeError" || err.name === "InvalidJsonError")) {
        sendJson(res, 400, {
          request_id: (req.headers[HEADER_REQUEST_ID] as string) || null,
          status: "error",
          error: {
            code: "INVALID_PAYLOAD",
            message: err.message,
            detail: err instanceof BodyTooLargeError ? { max_bytes: err.maxBytes } : undefined,
          },
        });
        return;
      }
      if (err instanceof RequestReadTimeoutError) {
        sendJson(res, 408, {
          request_id: (req.headers[HEADER_REQUEST_ID] as string) || null,
          status: "error",
          error: {
            code: "INVALID_PAYLOAD",
            message: err.message,
            detail: { timeout_ms: err.timeoutMs },
          },
        });
        return;
      }
      if (err instanceof RequestAbortedError) {
        sendJson(res, 499, {
          request_id: (req.headers[HEADER_REQUEST_ID] as string) || null,
          status: "error",
          error: {
            code: "INVALID_PAYLOAD",
            message: err.message,
          },
        });
        return;
      }
      sendJson(res, 500, {
        status: "error",
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function isFeatureFlagEnabled(
  flagName: keyof FeatureFlags,
  config: ReturnType<typeof getConfig>,
  context?: { org_id?: string; app_id?: string; user_id?: string }
): boolean {
  return resolveFeatureFlagEnabled(flagName, config, context);
}

function isOperationalAccessAllowed(
  expectedToken: string | undefined,
  authHeader: string | undefined
): boolean {
  if (!expectedToken) return true;
  return authHeader === `Bearer ${expectedToken}`;
}

function isIngressRejection(err: unknown): err is IngressRejection {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    "httpStatus" in err
  );
}

function sendErrorRejection(res: ServerResponse, rej: IngressRejection): void {
  sendJson(res, rej.httpStatus, {
    status: "error",
    error: {
      code: rej.code,
      message: rej.message,
      detail: rej.detail,
    },
  });
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown
): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}
