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
 */
export function readJsonBody(req, maxBytes) {
    return new Promise((resolve, reject) => {
        const contentLength = req.headers[HEADER_CONTENT_LENGTH];
        const len = contentLength ? parseInt(contentLength, 10) : NaN;
        if (!isNaN(len) && len > maxBytes) {
            reject(new BodyTooLargeError(len, maxBytes));
            return;
        }
        const chunks = [];
        let total = 0;
        req.on("data", (chunk) => {
            total += chunk.length;
            if (total > maxBytes) {
                req.destroy();
                reject(new BodyTooLargeError(total, maxBytes));
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => {
            const raw = Buffer.concat(chunks);
            if (raw.length === 0) {
                resolve(undefined);
                return;
            }
            try {
                const body = JSON.parse(raw.toString("utf8"));
                resolve(body);
            }
            catch {
                reject(new InvalidJsonError());
            }
        });
        req.on("error", reject);
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
//# sourceMappingURL=middleware.js.map