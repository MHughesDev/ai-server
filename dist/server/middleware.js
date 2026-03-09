/**
 * HTTP middleware helpers – body parsing, size limit, request id.
 * @see L2-02 Phase 0: deterministic ingress pipeline
 */
export const HEADER_REQUEST_ID = "x-request-id";
export const HEADER_AUTHORIZATION = "authorization";
export const HEADER_CONTENT_LENGTH = "content-length";
export const HEADER_CONTENT_TYPE = "application/json";
/**
 * Read request body up to maxBytes; resolve with parsed JSON or reject.
 * PRODUCTION: Add a read timeout (e.g. 30s) so slow clients cannot hold the connection open; handle req.aborted so aborted connections don't leave the promise hanging.
 */
export function readJsonBody(req, maxBytes, options) {
    return new Promise((resolve, reject) => {
        const timeoutMs = options?.timeoutMs ?? 30_000;
        const contentLength = req.headers[HEADER_CONTENT_LENGTH];
        const len = contentLength ? parseInt(contentLength, 10) : NaN;
        if (!isNaN(len) && len > maxBytes) {
            reject(new BodyTooLargeError(len, maxBytes));
            return;
        }
        let settled = false;
        const timer = setTimeout(() => {
            if (settled)
                return;
            settled = true;
            req.destroy();
            reject(new RequestReadTimeoutError(timeoutMs));
        }, timeoutMs);
        const cleanup = () => {
            clearTimeout(timer);
            req.removeAllListeners("data");
            req.removeAllListeners("end");
            req.removeAllListeners("error");
            req.removeAllListeners("aborted");
        };
        const fail = (err) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            reject(err);
        };
        const ok = (value) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            resolve(value);
        };
        const chunks = [];
        let total = 0;
        req.on("data", (chunk) => {
            total += chunk.length;
            if (total > maxBytes) {
                req.destroy();
                fail(new BodyTooLargeError(total, maxBytes));
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => {
            const raw = Buffer.concat(chunks);
            if (raw.length === 0) {
                ok(undefined);
                return;
            }
            try {
                const body = JSON.parse(raw.toString("utf8"));
                ok(body);
            }
            catch {
                fail(new InvalidJsonError());
            }
        });
        req.on("aborted", () => fail(new RequestAbortedError()));
        req.on("error", (err) => fail(err));
    });
}
export class BodyTooLargeError extends Error {
    received;
    maxBytes;
    constructor(received, maxBytes) {
        super(`Body size ${received} exceeds limit ${maxBytes}`);
        this.received = received;
        this.maxBytes = maxBytes;
        this.name = "BodyTooLargeError";
    }
}
export class InvalidJsonError extends Error {
    constructor() {
        super("Invalid JSON body");
        this.name = "InvalidJsonError";
    }
}
export class RequestReadTimeoutError extends Error {
    timeoutMs;
    constructor(timeoutMs) {
        super(`Request body read timed out after ${timeoutMs}ms`);
        this.timeoutMs = timeoutMs;
        this.name = "RequestReadTimeoutError";
    }
}
export class RequestAbortedError extends Error {
    constructor() {
        super("Request was aborted by the client");
        this.name = "RequestAbortedError";
    }
}
//# sourceMappingURL=middleware.js.map