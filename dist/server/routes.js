/**
 * HTTP route handlers – health, ready, metrics, version, query.
 * @see Docs/SPEC/02_API_Contracts.md
 */
import { validateIngress } from "../ingress/validate.js";
import { getConfig } from "../bootstrap/index.js";
import { CONTRACT_VERSION } from "../contracts/index.js";
import { readJsonBody, HEADER_REQUEST_ID, HEADER_AUTHORIZATION, BodyTooLargeError } from "./middleware.js";
import { handleQuery } from "./query-handler.js";
export async function handleRequest(req, res) {
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const path = url.pathname;
    if (method === "GET" && path === "/healthz") {
        sendJson(res, 200, { status: "ok" });
        return;
    }
    if (method === "GET" && path === "/readyz") {
        sendJson(res, 200, { ready: true });
        return;
    }
    if (method === "GET" && path === "/metrics") {
        const { getCounterSnapshot, getHistogramSnapshot } = await import("../observability/metrics.js");
        const counters = getCounterSnapshot();
        const histograms = getHistogramSnapshot();
        sendJson(res, 200, { counters, histograms });
        return;
    }
    if (method === "GET" && path === "/v1/version") {
        const config = getConfig();
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
    if (method === "POST" && path === "/v1/query") {
        const config = getConfig();
        if (!config.flags.runtime_mvp_query_chat_enabled) {
            sendJson(res, 404, { error: "MVP query endpoint not enabled" });
            return;
        }
        try {
            const contentLength = req.headers["content-length"];
            const len = contentLength ? parseInt(contentLength, 10) : undefined;
            const body = await readJsonBody(req, config.maxRequestBodyBytes);
            const requestIdHeader = req.headers[HEADER_REQUEST_ID];
            const authHeader = req.headers[HEADER_AUTHORIZATION];
            const ingressResult = validateIngress(body, {
                maxBodyBytes: config.maxRequestBodyBytes,
                contentLength: len,
                requestIdHeader,
                requireAuthHeader: false,
                authHeader,
                contractVersion: CONTRACT_VERSION,
                multimodalInputPathEnabled: config.flags.multimodal_input_path_enabled,
                attachmentLimits: {
                    maxCount: config.maxAttachmentCount,
                    maxBytesPerAttachment: config.maxAttachmentBytes,
                },
            });
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
            sendJson(res, 500, {
                status: "error",
                error: { code: "INTERNAL_ERROR", message: "Internal server error" },
            });
        }
        return;
    }
    sendJson(res, 404, { error: "Not found" });
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