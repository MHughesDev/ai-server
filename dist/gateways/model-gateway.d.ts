/**
 * Model Gateway – provider abstraction with timeout, retry, error mapping.
 * Production: Circuit breaker, health checks, fallback providers, capability taxonomy.
 * @see docs/SPEC/15_ModelGateway_Spec.md, L2-02 Phase 2
 */
import type { IModelGateway, ModelCompletionRequest, ModelCompletionResult } from "./types.js";
import type { ErrorCode } from "../contracts/errors.js";
export interface ModelGatewayConfig {
    timeoutMs: number;
    maxRetries: number;
    defaultModel: string;
}
/** Circuit breaker states */
type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";
export interface CircuitBreakerConfig {
    failureThreshold: number;
    recoveryTimeoutMs: number;
    halfOpenMaxCalls: number;
}
export interface ProviderHealth {
    state: CircuitState;
    failures: number;
    lastFailureTime: number;
    lastSuccessTime: number;
    halfOpenCalls: number;
    totalCalls: number;
    totalFailures: number;
}
export interface ModelProviderConfig {
    id: string;
    kind: "stub" | "framed_echo" | "openai_compatible";
    default_model: string;
    base_url?: string;
    api_key_env?: string;
    api_key?: string;
    completion_path?: string;
    input_cost_per_million_usd?: number;
    output_cost_per_million_usd?: number;
}
export interface ModelRouteConfig {
    provider: string;
    model: string;
}
export interface ModelCapabilityRegistry {
    [capability: string]: {
        default?: ModelRouteConfig;
        org?: Record<string, ModelRouteConfig>;
        app?: Record<string, ModelRouteConfig>;
        user?: Record<string, ModelRouteConfig>;
    };
}
export interface ModelRoutingConfig {
    default_capability: string;
    providers: ModelProviderConfig[];
    registry: ModelCapabilityRegistry;
    /** Provider ID to use when primary fails. If not set, uses first provider as fallback. */
    fallback_provider?: string;
    /** Enable circuit breaker for providers */
    enable_circuit_breaker?: boolean;
    /** Enable health checks */
    enable_health_checks?: boolean;
}
/** Extended capability taxonomy for production routing */
export declare const CAPABILITY_TAXONOMY: {
    readonly chat: {
        readonly description: "General conversational AI";
        readonly defaultModel: "gpt-4o-mini";
    };
    readonly classification: {
        readonly description: "Intent and category classification";
        readonly defaultModel: "gpt-4o-mini";
    };
    readonly vision: {
        readonly description: "Image understanding and analysis";
        readonly defaultModel: "gpt-4o";
    };
    readonly embedding: {
        readonly description: "Vector embedding generation";
        readonly defaultModel: "text-embedding-3-small";
    };
    readonly code: {
        readonly description: "Code generation and analysis";
        readonly defaultModel: "gpt-4o";
    };
    readonly summarization: {
        readonly description: "Text summarization";
        readonly defaultModel: "gpt-4o-mini";
    };
    readonly extraction: {
        readonly description: "Structured data extraction";
        readonly defaultModel: "gpt-4o-mini";
    };
    readonly reasoning: {
        readonly description: "Complex reasoning tasks";
        readonly defaultModel: "o1-mini";
    };
};
export type CapabilityType = keyof typeof CAPABILITY_TAXONOMY;
export interface ModelSelectionContext {
    capability?: string;
    org_id?: string;
    app_id?: string;
    user_id?: string;
}
/** Thrown when gateway fails (maps to MODEL_FAILURE or INTERNAL_ERROR) */
export declare class ModelGatewayError extends Error {
    readonly code: ErrorCode;
    readonly retryable: boolean;
    constructor(message: string, code: ErrorCode, retryable: boolean);
}
/**
 * Circuit breaker for model providers.
 * Prevents cascading failures by opening after threshold failures,
 * then attempting recovery after timeout.
 */
export declare class CircuitBreaker {
    private readonly config;
    private state;
    private failures;
    private lastFailureTime;
    private lastSuccessTime;
    private halfOpenCalls;
    private totalCalls;
    private totalFailures;
    constructor(config?: CircuitBreakerConfig);
    getHealth(): ProviderHealth;
    isOpen(): boolean;
    recordSuccess(): void;
    recordFailure(): void;
    execute<T>(fn: () => Promise<T>): Promise<T>;
}
/** Health check result for providers */
export interface HealthCheckResult {
    providerId: string;
    healthy: boolean;
    latencyMs: number;
    error?: string;
}
export declare function getProviderHealth(providerId: string): ProviderHealth | undefined;
export declare function getAllProviderHealth(): Record<string, ProviderHealth>;
export declare function resetProviderHealth(providerId?: string): void;
/**
 * Stub implementation – returns deterministic response for tests and MVP.
 * No external provider call.
 */
export declare class StubModelGateway implements IModelGateway {
    private config;
    constructor(config?: Partial<ModelGatewayConfig>);
    complete(request: ModelCompletionRequest): Promise<ModelCompletionResult>;
}
export declare function resolveModelRoute(registry: ModelCapabilityRegistry, selection: ModelSelectionContext, fallback: ModelRouteConfig): ModelRouteConfig;
/**
 * Perform health check on a provider.
 * Returns latency and health status.
 */
export declare function checkProviderHealth(providerId: string, provider: IModelGateway, testRequest?: ModelCompletionRequest): Promise<HealthCheckResult>;
export declare function createProviderBackedModelGateway(config: ModelGatewayConfig & ModelRoutingConfig, selection: ModelSelectionContext): IModelGateway;
/**
 * Run health checks on all configured providers.
 * Useful for readiness probes.
 */
export declare function runProviderHealthChecks(config: ModelRoutingConfig, testRequest?: ModelCompletionRequest): Promise<HealthCheckResult[]>;
/**
 * HTTP statuses from an OpenAI-compatible provider where a retry may succeed.
 * 4xx client mistakes (except 408/429) and 409 conflicts are not retried.
 */
export declare function isRetryableModelProviderHttpStatus(status: number): boolean;
/**
 * Gateway wrapper that enforces timeout and retries, maps errors to taxonomy.
 */
export declare function withTimeoutAndRetry(gateway: IModelGateway, config?: Partial<ModelGatewayConfig>): IModelGateway;
export {};
//# sourceMappingURL=model-gateway.d.ts.map