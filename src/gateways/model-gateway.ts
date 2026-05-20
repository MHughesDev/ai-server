/**
 * Model Gateway – provider abstraction with timeout, retry, error mapping.
 * Production: Circuit breaker, health checks, fallback providers, capability taxonomy.
 * @see docs/SPEC/15_ModelGateway_Spec.md, L2-02 Phase 2
 */

import { assertRuntimeModelGateway } from "../config/assert-production-model-gateway.js";
import { classifyModelProviderFailure } from "./model-provider-retry.js";
import { raceWithTimeout } from "../utils/race-with-timeout.js";
import type { IModelGateway, ModelCompletionRequest, ModelCompletionResult } from "./types.js";
import { getErrorMeta, isErrorCode } from "../contracts/errors.js";
import type { ErrorCode } from "../contracts/errors.js";
import type { ModelCapabilityRegistry, ModelRouteConfig, ModelSelectionContext } from "./model-routing.js";
import { resolveModelRoute } from "./model-routing.js";

export type { ModelRouteConfig, ModelCapabilityRegistry, ModelSelectionContext } from "./model-routing.js";
export { resolveModelRoute } from "./model-routing.js";
export {
  classifyModelProviderFailure,
  isRetryableModelProviderHttpStatus,
  parseModelProviderErrorBody,
} from "./model-provider-retry.js";
export type {
  ModelProviderFailureClassification,
  ParsedModelProviderError,
} from "./model-provider-retry.js";

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

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeoutMs: 30000,
  halfOpenMaxCalls: 3,
};

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

export interface ModelRoutingConfig {
  default_capability: string;
  providers: ModelProviderConfig[];
  registry: ModelCapabilityRegistry;
  /** Runtime environment for production routing guards (WANT-023). */
  runtime_env?: "dev" | "staging" | "production";
  /** Provider ID to use when primary fails. If not set, uses first provider as fallback. */
  fallback_provider?: string;
  /** Enable circuit breaker for providers */
  enable_circuit_breaker?: boolean;
  /** Enable health checks */
  enable_health_checks?: boolean;
}

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
} as const;

export type CapabilityType = keyof typeof CAPABILITY_TAXONOMY;

const DEFAULT_CONFIG: ModelGatewayConfig = {
  timeoutMs: 30_000,
  maxRetries: 2,
  defaultModel: "stub",
};

/** Thrown when gateway fails (maps to MODEL_FAILURE or INTERNAL_ERROR) */
export class ModelGatewayError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "ModelGatewayError";
  }
}

/**
 * Circuit breaker for model providers.
 * Prevents cascading failures by opening after threshold failures,
 * then attempting recovery after timeout.
 */
export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failures = 0;
  private lastFailureTime = 0;
  private lastSuccessTime = 0;
  private halfOpenCalls = 0;
  private totalCalls = 0;
  private totalFailures = 0;

  constructor(private readonly config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG) {}

  getHealth(): ProviderHealth {
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

  isOpen(): boolean {
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

  recordSuccess(): void {
    this.totalCalls++;
    this.lastSuccessTime = Date.now();
    if (this.state === "HALF_OPEN") {
      this.halfOpenCalls++;
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.state = "CLOSED";
        this.failures = 0;
        this.halfOpenCalls = 0;
      }
    } else if (this.state === "CLOSED" && this.failures > 0) {
      this.failures = Math.max(0, this.failures - 1);
    }
  }

  recordFailure(): void {
    this.totalCalls++;
    this.totalFailures++;
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.state === "HALF_OPEN" || this.failures >= this.config.failureThreshold) {
      this.state = "OPEN";
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new ModelGatewayError(
        "Circuit breaker is OPEN - provider temporarily unavailable",
        "MODEL_FAILURE",
        true
      );
    }
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }
}

/** Health check result for providers */
export interface HealthCheckResult {
  providerId: string;
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

/** Global provider health tracking */
const providerHealth = new Map<string, CircuitBreaker>();

export function getProviderHealth(providerId: string): ProviderHealth | undefined {
  return providerHealth.get(providerId)?.getHealth();
}

export function getAllProviderHealth(): Record<string, ProviderHealth> {
  const result: Record<string, ProviderHealth> = {};
  for (const [id, breaker] of providerHealth.entries()) {
    result[id] = breaker.getHealth();
  }
  return result;
}

export function resetProviderHealth(providerId?: string): void {
  if (providerId) {
    providerHealth.delete(providerId);
  } else {
    providerHealth.clear();
  }
}

/**
 * Stub implementation – returns deterministic response for tests and MVP.
 * No external provider call.
 */
export class StubModelGateway implements IModelGateway {
  private config: ModelGatewayConfig;

  constructor(config: Partial<ModelGatewayConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  complete(request: ModelCompletionRequest): Promise<ModelCompletionResult> {
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

class FramedEchoModelGateway implements IModelGateway {
  constructor(
    private readonly providerId: string,
    private readonly defaultModel: string
  ) {}

  complete(request: ModelCompletionRequest): Promise<ModelCompletionResult> {
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

class OpenAiCompatibleModelGateway implements IModelGateway {
  private readonly endpoint: string;
  private readonly apiKey?: string;

  constructor(
    private readonly providerId: string,
    private readonly defaultModel: string,
    private readonly provider: ModelProviderConfig
  ) {
    const baseUrl = provider.base_url ?? "https://api.openai.com";
    const completionPath = provider.completion_path ?? "/v1/chat/completions";
    this.endpoint = `${baseUrl.replace(/\/+$/, "")}/${completionPath.replace(/^\/+/, "")}`;
    this.apiKey = provider.api_key ?? (provider.api_key_env ? process.env[provider.api_key_env] : undefined);
  }

  async complete(request: ModelCompletionRequest): Promise<ModelCompletionResult> {
    const model = request.model ?? this.defaultModel;
    if (!this.apiKey) {
      throw new ModelGatewayError(
        `Model provider '${this.providerId}' is missing API key`,
        "MODEL_FAILURE",
        false
      );
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
      const failure = classifyModelProviderFailure(status, bodyText);
      const detail = bodyText.slice(0, 400);
      throw new ModelGatewayError(
        `Model provider '${this.providerId}' HTTP ${status} (${failure.code}, retryable=${failure.retryable}): ${detail}`,
        failure.code,
        failure.retryable
      );
    }
    const body = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string }; text?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      model?: string;
    };
    const text =
      body.choices?.[0]?.message?.content ??
      body.choices?.[0]?.text ??
      "";
    const tokensIn = body.usage?.prompt_tokens ?? Math.ceil((request.prompt?.length ?? 0) / 4);
    const tokensOut =
      body.usage?.completion_tokens ??
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

function createProviderGateway(provider: ModelProviderConfig): IModelGateway {
  if (provider.kind === "openai_compatible") {
    return new OpenAiCompatibleModelGateway(provider.id, provider.default_model, provider);
  }
  if (provider.kind === "framed_echo") {
    return new FramedEchoModelGateway(provider.id, provider.default_model);
  }
  return new StubModelGateway({ defaultModel: provider.default_model });
}

/**
 * Perform health check on a provider.
 * Returns latency and health status.
 */
export async function checkProviderHealth(
  providerId: string,
  provider: IModelGateway,
  testRequest?: ModelCompletionRequest
): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const testReq = testRequest ?? { prompt: "Health check ping", max_tokens: 5 };
    await provider.complete(testReq);
    return { providerId, healthy: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      providerId,
      healthy: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function createProviderBackedModelGateway(
  config: ModelGatewayConfig & ModelRoutingConfig,
  selection: ModelSelectionContext
): IModelGateway {
  if (config.runtime_env) {
    assertRuntimeModelGateway(
      {
        env: config.runtime_env,
        providers: config.providers.map((p) => ({ id: p.id, kind: p.kind })),
        registry: config.registry,
        default_capability: config.default_capability,
        defaultModel: config.defaultModel,
      },
      selection
    );
  }

  const providers = new Map<string, IModelGateway>();
  const breakers = new Map<string, CircuitBreaker>();

  for (const provider of config.providers) {
    providers.set(provider.id, createProviderGateway(provider));
    if (config.enable_circuit_breaker !== false) {
      if (!providerHealth.has(provider.id)) {
        providerHealth.set(provider.id, new CircuitBreaker());
      }
      breakers.set(provider.id, providerHealth.get(provider.id)!);
    }
  }

  const fallbackProvider = config.providers[0];
  if (!fallbackProvider) {
    throw new Error("At least one model provider is required");
  }
  const fallbackRoute: ModelRouteConfig = {
    provider: fallbackProvider.id,
    model: config.defaultModel,
  };

  // Determine fallback provider ID
  const fallbackProviderId = config.fallback_provider ?? fallbackProvider.id;

  async function executeWithCircuitBreaker(
    providerId: string,
    request: ModelCompletionRequest
  ): Promise<ModelCompletionResult> {
    const targetProvider = providers.get(providerId);
    if (!targetProvider) {
      throw new ModelGatewayError(
        `Unknown model provider '${providerId}'`,
        "INTERNAL_ERROR",
        false
      );
    }

    const breaker = breakers.get(providerId);
    if (breaker) {
      return breaker.execute(() => targetProvider.complete(request));
    }
    return targetProvider.complete(request);
  }

  const providerGateway: IModelGateway = {
    async complete(request: ModelCompletionRequest): Promise<ModelCompletionResult> {
      const route = resolveModelRoute(config.registry, selection, fallbackRoute);

      try {
        // Try primary provider
        return await executeWithCircuitBreaker(route.provider, {
          ...request,
          model: request.model ?? route.model,
        });
      } catch (err) {
        // If primary fails and we have a different fallback, try it
        if (route.provider !== fallbackProviderId && providers.has(fallbackProviderId)) {
          try {
            const fallbackResult = await executeWithCircuitBreaker(fallbackProviderId, {
              ...request,
              model: request.model ?? route.model,
            });
            // Mark as using fallback
            return { ...fallbackResult, model: `${fallbackResult.model} (fallback:${route.provider})` };
          } catch (fallbackErr) {
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
export async function runProviderHealthChecks(
  config: ModelRoutingConfig,
  testRequest?: ModelCompletionRequest
): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];
  for (const providerConfig of config.providers) {
    const provider = createProviderGateway(providerConfig);
    const result = await checkProviderHealth(providerConfig.id, provider, testRequest);
    results.push(result);

    // Update circuit breaker state based on health check
    const breaker = providerHealth.get(providerConfig.id);
    if (breaker) {
      if (result.healthy) {
        breaker.recordSuccess();
      } else {
        breaker.recordFailure();
      }
    }
  }
  return results;
}

const GATEWAY_TIMEOUT_MESSAGE = "Model gateway timeout";

function transientNodeCauseCode(code: string | undefined): boolean {
  if (!code) return false;
  return (
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_SOCKET"
  );
}

function classifyRetryability(error: unknown): {
  code: ErrorCode;
  retryable: boolean;
  message: string;
} {
  if (error instanceof ModelGatewayError) {
    return { code: error.code, retryable: error.retryable, message: error.message };
  }
  if (error instanceof Error) {
    if (error.message === GATEWAY_TIMEOUT_MESSAGE) {
      return { code: "MODEL_FAILURE", retryable: true, message: error.message };
    }
    if (error.name === "TypeError" && /\bfetch\b/i.test(error.message)) {
      return { code: "MODEL_FAILURE", retryable: true, message: error.message };
    }
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause instanceof Error && transientNodeCauseCode((cause as NodeJS.ErrnoException).code)) {
      return { code: "MODEL_FAILURE", retryable: true, message: error.message };
    }
    if (cause && typeof cause === "object" && cause !== null && "code" in cause) {
      const c = (cause as { code?: string }).code;
      if (transientNodeCauseCode(c)) {
        return { code: "MODEL_FAILURE", retryable: true, message: error.message };
      }
    }
  }
  if (typeof error === "object" && error !== null) {
    const errObj = error as { code?: string; retryable?: boolean; message?: string };
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
export function withTimeoutAndRetry(
  gateway: IModelGateway,
  config: Partial<ModelGatewayConfig> = {}
): IModelGateway {
  const { timeoutMs, maxRetries } = { ...DEFAULT_CONFIG, ...config };
  return {
    async complete(req: ModelCompletionRequest): Promise<ModelCompletionResult> {
      let lastErr: unknown;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await raceWithTimeout(
            gateway.complete(req),
            timeoutMs,
            GATEWAY_TIMEOUT_MESSAGE
          );
          return result;
        } catch (err) {
          lastErr = err;
          const classified = classifyRetryability(err);
          if (attempt < maxRetries && classified.retryable) continue;
          throw new ModelGatewayError(
            classified.message,
            classified.code,
            classified.retryable
          );
        }
      }
      const classified = classifyRetryability(lastErr);
      throw new ModelGatewayError(
        classified.message,
        classified.code,
        classified.retryable
      );
    },
  };
}
