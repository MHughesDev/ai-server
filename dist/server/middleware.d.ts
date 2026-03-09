/**
 * HTTP middleware helpers – body parsing, size limit, request id.
 * @see L2-02 Phase 0: deterministic ingress pipeline
 */
import type { IncomingMessage } from "node:http";
export declare const HEADER_REQUEST_ID = "x-request-id";
export declare const HEADER_AUTHORIZATION = "authorization";
export declare const HEADER_CONTENT_LENGTH = "content-length";
export declare const HEADER_CONTENT_TYPE = "application/json";
/**
 * Read request body up to maxBytes; resolve with parsed JSON or reject.
 * PRODUCTION: Add a read timeout (e.g. 30s) so slow clients cannot hold the connection open; handle req.aborted so aborted connections don't leave the promise hanging.
 */
export declare function readJsonBody(req: IncomingMessage, maxBytes: number, options?: {
    timeoutMs?: number;
}): Promise<unknown>;
export declare class BodyTooLargeError extends Error {
    readonly received: number;
    readonly maxBytes: number;
    constructor(received: number, maxBytes: number);
}
export declare class InvalidJsonError extends Error {
    constructor();
}
export declare class RequestReadTimeoutError extends Error {
    readonly timeoutMs: number;
    constructor(timeoutMs: number);
}
export declare class RequestAbortedError extends Error {
    constructor();
}
//# sourceMappingURL=middleware.d.ts.map