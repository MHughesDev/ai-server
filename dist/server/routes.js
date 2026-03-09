/**
 * HTTP route handlers – health, ready, metrics, version, query.
 * @see docs/SPEC/02_API_Contracts.md
 */
import { validateIngress } from "../ingress/validate.js";
import { getConfig } from "../bootstrap/index.js";
import { CONTRACT_VERSION } from "../contracts/index.js";
import { readJsonBody, HEADER_REQUEST_ID, HEADER_AUTHORIZATION, BodyTooLargeError, RequestAbortedError, RequestReadTimeoutError, } from "./middleware.js";
import { handleQuery } from "./query-handler.js";
import { exchangeToken, queryRequiresAiJwt, verifyQueryCallerFromAuthHeader, } from "./auth.js";
import { checkQueryRateLimitAsync, createRateLimitedRejection, attachRateLimitHeaders, detectAbuse, } from "./rate-limit.js";
import { checkOperationalDependenciesAsync } from "./dependencies.js";
import { RequestQueue, sendBackpressureResponse, handleCors } from "./transport.js";
// Global request queue for backpressure (Phase 7.1)
const requestQueue = new RequestQueue({
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_REQUESTS ?? "100", 10),
    maxQueueDepth: parseInt(process.env.MAX_REQUEST_QUEUE_DEPTH ?? "50", 10),
});
export async function handleRequest(req, res) {
    // L2-06 Phase 7.1: CORS handling
    const corsHandled = handleCors(req, res, {
        allowedOrigins: process.env.CORS_ALLOWED_ORIGINS?.split(",") ?? "*",
        allowedMethods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
        allowCredentials: process.env.CORS_ALLOW_CREDENTIALS === "true",
        maxAge: 86400,
    });
    if (corsHandled)
        return;
    // L2-06 Phase 7.1: Request queue / backpressure
    const queueRelease = await requestQueue.acquire();
    if (!queueRelease) {
        sendBackpressureResponse(res, 10);
        return;
    }
    try {
        await processRequest(req, res);
    }
    finally {
        queueRelease();
    }
}
async function processRequest(req, res) {
    const method = req.method ?? "GET";
    const scheme = req.socket.encrypted ? "https" : "http";
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
        const accept = req.headers["accept"] ?? "";
        const wantsPrometheus = urlFormat === "prometheus" || accept.includes("text/plain");
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
        const versionPayload = {
            contract_version: CONTRACT_VERSION,
            api: "v1",
            version: process.env.APP_VERSION ?? "0.1.0",
        };
        if (config.release?.release_id)
            versionPayload.release_id = config.release.release_id;
        if (config.release?.build_id)
            versionPayload.build_id = config.release.build_id;
        if (config.env)
            versionPayload.env = config.env;
        sendJson(res, 200, versionPayload);
        return;
    }
    if (method === "POST" && path === "/token/exchange") {
        if (config.env === "production" && !config.flags.platform_production_rollout_enabled) {
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
        }
        catch (err) {
            if (isIngressRejection(err)) {
                sendErrorRejection(res, err);
                return;
            }
            if (err instanceof Error && (err.name === "BodyTooLargeError" || err.name === "InvalidJsonError")) {
                sendJson(res, 400, {
                    request_id: req.headers[HEADER_REQUEST_ID] || null,
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
                    request_id: req.headers[HEADER_REQUEST_ID] || null,
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
                    request_id: req.headers[HEADER_REQUEST_ID] || null,
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
    if (method === "POST" && path === "/v1/query") {
        if (config.env === "production" && !config.flags.platform_production_rollout_enabled) {
            sendJson(res, 503, {
                status: "error",
                error: { code: "POLICY_BLOCKED", message: "Platform rollout is currently disabled" },
            });
            return;
        }
        // PRODUCTION: Add per-request timeout (e.g. from plan.budgets.deadline_ms) so slow pipelines don't hold connections indefinitely.
        if (!config.flags.runtime_mvp_query_chat_enabled) {
            sendJson(res, 404, { error: "MVP query endpoint not enabled" });
            return;
        }
        try {
            const verifiedCallerContext = verifyQueryCallerFromAuthHeader(authHeader, config);
            const contentLength = req.headers["content-length"];
            const len = contentLength ? parseInt(contentLength, 10) : undefined;
            const body = await readJsonBody(req, config.maxRequestBodyBytes, {
                timeoutMs: config.requestReadTimeoutMs,
            });
            const requestIdHeader = req.headers[HEADER_REQUEST_ID];
            const ingressResult = validateIngress(body, {
                maxBodyBytes: config.maxRequestBodyBytes,
                contentLength: len,
                requestIdHeader,
                requireAuthHeader: queryRequiresAiJwt(config),
                authHeader,
                contractVersion: CONTRACT_VERSION,
                multimodalInputPathEnabled: config.flags.multimodal_input_path_enabled,
                attachmentLimits: {
                    maxCount: config.maxAttachmentCount,
                    maxBytesPerAttachment: config.maxAttachmentBytes,
                },
                verifiedCallerContext,
            });
            // L2-05: Async rate limiting with Redis support
            const rateLimitDecision = await checkQueryRateLimitAsync(config.ingress_rate_limit, ingressResult.callerContext, req.socket.remoteAddress);
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
            const response = await handleQuery(ingressResult);
            sendJson(res, 200, response);
        }
        catch (err) {
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
            if (err instanceof Error && (err.name === "BodyTooLargeError" || err.name === "InvalidJsonError")) {
                sendJson(res, 400, {
                    request_id: req.headers[HEADER_REQUEST_ID] || null,
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
                    request_id: req.headers[HEADER_REQUEST_ID] || null,
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
                    request_id: req.headers[HEADER_REQUEST_ID] || null,
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
function getHeaderValue(value) {
    if (!value)
        return undefined;
    return Array.isArray(value) ? value[0] : value;
}
function isOperationalAccessAllowed(expectedToken, authHeader) {
    if (!expectedToken)
        return true;
    return authHeader === `Bearer ${expectedToken}`;
}
function isIngressRejection(err) {
    return (typeof err === "object" &&
        err !== null &&
        "code" in err &&
        "httpStatus" in err);
}
function sendErrorRejection(res, rej) {
    sendJson(res, rej.httpStatus, {
        status: "error",
        error: {
            code: rej.code,
            message: rej.message,
            detail: rej.detail,
        },
    });
}
function sendJson(res, statusCode, body) {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}
//# sourceMappingURL=routes.js.map