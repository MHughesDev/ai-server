/**
 * Model Gateway – provider abstraction with timeout, retry, error mapping.
 * @see Docs/SPEC/15_ModelGateway_Spec.md, L2-02 Phase 2
 */
import { getErrorMeta } from "../contracts/errors.js";
const DEFAULT_CONFIG = {
    timeoutMs: 30_000,
    maxRetries: 2,
    defaultModel: "stub",
};
/** Thrown when gateway fails (maps to MODEL_FAILURE or INTERNAL_ERROR) */
export class ModelGatewayError extends Error {
    code;
    retryable;
    constructor(message, code, retryable) {
        super(message);
        this.code = code;
        this.retryable = retryable;
        this.name = "ModelGatewayError";
    }
}
/**
 * Stub implementation – returns deterministic response for tests and MVP.
 * No external provider call.
 */
export class StubModelGateway {
    config;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    complete(request) {
        const model = request.model ?? this.config.defaultModel;
        const tokensIn = Math.ceil((request.prompt?.length ?? 0) / 4);
        const tokensOut = Math.min(request.max_tokens ?? 100, 50);
        const text = `Echo: ${(request.prompt ?? "").slice(0, 80)}...`;
        return Promise.resolve({
            text,
            tokens_in: tokensIn,
            tokens_out: tokensOut,
            model,
            cost_usd_est: 0,
            latency_ms: 10,
        });
    }
}
/**
 * Gateway wrapper that enforces timeout and retries, maps errors to taxonomy.
 */
export function withTimeoutAndRetry(gateway, config = {}) {
    const { timeoutMs, maxRetries } = { ...DEFAULT_CONFIG, ...config };
    return {
        async complete(req) {
            let lastErr;
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    const result = await Promise.race([
                        gateway.complete(req),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("Model gateway timeout")), timeoutMs)),
                    ]);
                    return result;
                }
                catch (err) {
                    lastErr = err;
                    const meta = getErrorMeta("MODEL_FAILURE");
                    if (attempt < maxRetries && meta.retryable)
                        continue;
                    throw new ModelGatewayError(err instanceof Error ? err.message : "Model request failed", "MODEL_FAILURE", true);
                }
            }
            throw new ModelGatewayError(lastErr instanceof Error ? lastErr.message : "Model request failed", "MODEL_FAILURE", true);
        },
    };
}
//# sourceMappingURL=model-gateway.js.map