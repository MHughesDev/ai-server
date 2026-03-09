/**
 * Model Gateway – provider abstraction with timeout, retry, error mapping.
 * Production: Circuit breaker, health checks, fallback providers, capability taxonomy.
 * @see docs/SPEC/15_ModelGateway_Spec.md, L2-02 Phase 2
 */
import { getErrorMeta, isErrorCode } from "../contracts/errors.js";
const DEFAULT_CIRCUIT_CONFIG = {
    failureThreshold: 5,
    recoveryTimeoutMs: 30000,
    halfOpenMaxCalls: 3,
};
/** Extended capability taxonomy for production routing */
export const CAPABILITY_TAXONOMY = {
    chat: { description: "General conversational AI", defaultModel: "gpt-4o-mini" },
    classification: { description: "Intent and category classification", defaultModel: "gpt-4o-mini" },
    vision: { description: "Image understanding and analysis", defaultModel: "gpt-4o" },
    embedding: { description: "Vector embedding generation", defaultModel: "text-embedding-3-small" },
    code: { description: "Code generation and analysis", defaultModel: "gpt-4o" },
    summarization: { description: "Text summarization", defaultModel: "gpt-4o-mini" },
    extraction: { description: "Structured data extraction", defaultModel: "gpt-4o-mini" },
    reasoning: { description: "Complex reasoning tasks", defaultModel: "o1-mini" },
};
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
 * Circuit breaker for model providers.
 * Prevents cascading failures by opening after threshold failures,
 * then attempting recovery after timeout.
 */
export class CircuitBreaker {
    config;
    state = "CLOSED";
    failures = 0;
    lastFailureTime = 0;
    lastSuccessTime = 0;
    halfOpenCalls = 0;
    totalCalls = 0;
    totalFailures = 0;
    constructor(config = DEFAULT_CIRCUIT_CONFIG) {
        this.config = config;
    }
    getHealth() {
        return {
            state: this.state,
            failures: this.failures,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            halfOpenCalls: this.halfOpenCalls,
            totalCalls: this.totalCalls,
            totalFailures: this.totalFailures,
        };
    }
    isOpen() {
        if (this.state === "OPEN") {
            const now = Date.now();
            if (now - this.lastFailureTime >= this.config.recoveryTimeoutMs) {
                this.state = "HALF_OPEN";
                this.halfOpenCalls = 0;
                return false;
            }
            return true;
        }
        return false;
    }
    recordSuccess() {
        this.totalCalls++;
        this.lastSuccessTime = Date.now();
        if (this.state === "HALF_OPEN") {
            this.halfOpenCalls++;
            if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
                this.state = "CLOSED";
                this.failures = 0;
                this.halfOpenCalls = 0;
            }
        }
        else if (this.state === "CLOSED" && this.failures > 0) {
            this.failures = Math.max(0, this.failures - 1);
        }
    }
    recordFailure() {
        this.totalCalls++;
        this.totalFailures++;
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.state === "HALF_OPEN" || this.failures >= this.config.failureThreshold) {
            this.state = "OPEN";
        }
    }
    async execute(fn) {
        if (this.isOpen()) {
            throw new ModelGatewayError("Circuit breaker is OPEN - provider temporarily unavailable", "MODEL_FAILURE", true);
        }
        try {
            const result = await fn();
            this.recordSuccess();
            return result;
        }
        catch (err) {
            this.recordFailure();
            throw err;
        }
    }
}
/** Global provider health tracking */
const providerHealth = new Map();
export function getProviderHealth(providerId) {
    return providerHealth.get(providerId)?.getHealth();
}
export function getAllProviderHealth() {
    const result = {};
    for (const [id, breaker] of providerHealth.entries()) {
        result[id] = breaker.getHealth();
    }
    return result;
}
export function resetProviderHealth(providerId) {
    if (providerId) {
        providerHealth.delete(providerId);
    }
    else {
        providerHealth.clear();
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
class FramedEchoModelGateway {
    providerId;
    defaultModel;
    constructor(providerId, defaultModel) {
        this.providerId = providerId;
        this.defaultModel = defaultModel;
    }
    complete(request) {
        const model = request.model ?? this.defaultModel;
        const tokensIn = Math.ceil((request.prompt?.length ?? 0) / 4);
        const tokensOut = Math.min(request.max_tokens ?? 100, 50);
        const text = `[provider:${this.providerId}|model:${model}] ${request.prompt ?? ""}`.slice(0, 400);
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
class OpenAiCompatibleModelGateway {
    providerId;
    defaultModel;
    provider;
    endpoint;
    apiKey;
    constructor(providerId, defaultModel, provider) {
        this.providerId = providerId;
        this.defaultModel = defaultModel;
        this.provider = provider;
        const baseUrl = provider.base_url ?? "https://api.openai.com";
        const completionPath = provider.completion_path ?? "/v1/chat/completions";
        this.endpoint = `${baseUrl.replace(/\/+$/, "")}/${completionPath.replace(/^\/+/, "")}`;
        this.apiKey = provider.api_key ?? (provider.api_key_env ? process.env[provider.api_key_env] : undefined);
    }
    async complete(request) {
        const model = request.model ?? this.defaultModel;
        if (!this.apiKey) {
            throw new ModelGatewayError(`Model provider '${this.providerId}' is missing API key`, "MODEL_FAILURE", false);
        }
        const started = Date.now();
        const resp = await fetch(this.endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model,
                max_tokens: request.max_tokens,
                messages: [{ role: "user", content: request.prompt }],
            }),
        });
        if (!resp.ok) {
            const status = resp.status;
            const bodyText = await resp.text();
            throw new ModelGatewayError(`Model provider '${this.providerId}' HTTP ${status}: ${bodyText.slice(0, 400)}`, "MODEL_FAILURE", status === 408 || status === 409 || status === 429 || status >= 500);
        }
        const body = (await resp.json());
        const text = body.choices?.[0]?.message?.content ??
            body.choices?.[0]?.text ??
            "";
        const tokensIn = body.usage?.prompt_tokens ?? Math.ceil((request.prompt?.length ?? 0) / 4);
        const tokensOut = body.usage?.completion_tokens ??
            Math.max(0, (body.usage?.total_tokens ?? 0) - tokensIn);
        const inRate = this.provider.input_cost_per_million_usd ?? 0;
        const outRate = this.provider.output_cost_per_million_usd ?? 0;
        const costUsd = inRate > 0 || outRate > 0
            ? (tokensIn / 1_000_000) * inRate + (tokensOut / 1_000_000) * outRate
            : undefined;
        return {
            text,
            tokens_in: tokensIn,
            tokens_out: tokensOut,
            model: body.model ?? model,
            cost_usd_est: costUsd,
            latency_ms: Date.now() - started,
        };
    }
}
function createProviderGateway(provider) {
    if (provider.kind === "openai_compatible") {
        return new OpenAiCompatibleModelGateway(provider.id, provider.default_model, provider);
    }
    if (provider.kind === "framed_echo") {
        return new FramedEchoModelGateway(provider.id, provider.default_model);
    }
    return new StubModelGateway({ defaultModel: provider.default_model });
}
export function resolveModelRoute(registry, selection, fallback) {
    const capability = selection.capability ?? "chat";
    const routesForCapability = registry[capability];
    if (!routesForCapability)
        return fallback;
    if (selection.user_id && routesForCapability.user?.[selection.user_id]) {
        return routesForCapability.user[selection.user_id];
    }
    if (selection.app_id && routesForCapability.app?.[selection.app_id]) {
        return routesForCapability.app[selection.app_id];
    }
    if (selection.org_id && routesForCapability.org?.[selection.org_id]) {
        return routesForCapability.org[selection.org_id];
    }
    return routesForCapability.default ?? fallback;
}
/**
 * Perform health check on a provider.
 * Returns latency and health status.
 */
export async function checkProviderHealth(providerId, provider, testRequest) {
    const start = Date.now();
    try {
        const testReq = testRequest ?? { prompt: "Health check ping", max_tokens: 5 };
        await provider.complete(testReq);
        return { providerId, healthy: true, latencyMs: Date.now() - start };
    }
    catch (err) {
        return {
            providerId,
            healthy: false,
            latencyMs: Date.now() - start,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
export function createProviderBackedModelGateway(config, selection) {
    const providers = new Map();
    const breakers = new Map();
    for (const provider of config.providers) {
        providers.set(provider.id, createProviderGateway(provider));
        if (config.enable_circuit_breaker !== false) {
            if (!providerHealth.has(provider.id)) {
                providerHealth.set(provider.id, new CircuitBreaker());
            }
            breakers.set(provider.id, providerHealth.get(provider.id));
        }
    }
    const fallbackProvider = config.providers[0];
    if (!fallbackProvider) {
        throw new Error("At least one model provider is required");
    }
    const fallbackRoute = {
        provider: fallbackProvider.id,
        model: config.defaultModel,
    };
    // Determine fallback provider ID
    const fallbackProviderId = config.fallback_provider ?? fallbackProvider.id;
    async function executeWithCircuitBreaker(providerId, request) {
        const targetProvider = providers.get(providerId);
        if (!targetProvider) {
            throw new ModelGatewayError(`Unknown model provider '${providerId}'`, "INTERNAL_ERROR", false);
        }
        const breaker = breakers.get(providerId);
        if (breaker) {
            return breaker.execute(() => targetProvider.complete(request));
        }
        return targetProvider.complete(request);
    }
    const providerGateway = {
        async complete(request) {
            const route = resolveModelRoute(config.registry, selection, fallbackRoute);
            try {
                // Try primary provider
                return await executeWithCircuitBreaker(route.provider, {
                    ...request,
                    model: request.model ?? route.model,
                });
            }
            catch (err) {
                // If primary fails and we have a different fallback, try it
                if (route.provider !== fallbackProviderId && providers.has(fallbackProviderId)) {
                    try {
                        const fallbackResult = await executeWithCircuitBreaker(fallbackProviderId, {
                            ...request,
                            model: request.model ?? route.model,
                        });
                        // Mark as using fallback
                        return { ...fallbackResult, model: `${fallbackResult.model} (fallback:${route.provider})` };
                    }
                    catch (fallbackErr) {
                        // Both failed - throw original error
                    }
                }
                throw err;
            }
        },
    };
    return withTimeoutAndRetry(providerGateway, config);
}
/**
 * Run health checks on all configured providers.
 * Useful for readiness probes.
 */
export async function runProviderHealthChecks(config, testRequest) {
    const results = [];
    for (const providerConfig of config.providers) {
        const provider = createProviderGateway(providerConfig);
        const result = await checkProviderHealth(providerConfig.id, provider, testRequest);
        results.push(result);
        // Update circuit breaker state based on health check
        const breaker = providerHealth.get(providerConfig.id);
        if (breaker) {
            if (result.healthy) {
                breaker.recordSuccess();
            }
            else {
                breaker.recordFailure();
            }
        }
    }
    return results;
}
function classifyRetryability(error) {
    if (error instanceof ModelGatewayError) {
        return { code: error.code, retryable: error.retryable, message: error.message };
    }
    if (typeof error === "object" && error !== null) {
        const errObj = error;
        const maybeCode = errObj.code;
        if (typeof maybeCode === "string" && isErrorCode(maybeCode)) {
            const meta = getErrorMeta(maybeCode);
            return {
                code: maybeCode,
                retryable: errObj.retryable ?? meta.retryable,
                message: errObj.message ?? "Model request failed",
            };
        }
        if (typeof errObj.retryable === "boolean") {
            return {
                code: "MODEL_FAILURE",
                retryable: errObj.retryable,
                message: errObj.message ?? "Model request failed",
            };
        }
    }
    return {
        code: "MODEL_FAILURE",
        retryable: getErrorMeta("MODEL_FAILURE").retryable,
        message: error instanceof Error ? error.message : "Model request failed",
    };
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
                let timer;
                try {
                    const timeoutPromise = new Promise((_, reject) => {
                        timer = setTimeout(() => reject(new Error("Model gateway timeout")), timeoutMs);
                    });
                    const result = await Promise.race([gateway.complete(req), timeoutPromise]);
                    return result;
                }
                catch (err) {
                    lastErr = err;
                    const classified = classifyRetryability(err);
                    if (attempt < maxRetries && classified.retryable)
                        continue;
                    throw new ModelGatewayError(classified.message, classified.code, classified.retryable);
                }
                finally {
                    if (timer)
                        clearTimeout(timer);
                }
            }
            const classified = classifyRetryability(lastErr);
            throw new ModelGatewayError(classified.message, classified.code, classified.retryable);
        },
    };
}
//# sourceMappingURL=model-gateway.js.map