/**
 * Config schema and load order – strict validation on startup.
 * @see docs/SPEC/20_Config_and_FeatureFlags.md
 * CONFIG_FILE env var supported: optional path to JSON overlay; env still wins over file.
 */

import { readFileSync, existsSync } from "node:fs";
import { z } from "zod";

const FeatureFlagsSchema = z.object({
  enable_org_memory: z.boolean().default(false),
  enable_cost_caps: z.boolean().default(true),
  enable_multimodal_pipeline: z.boolean().default(false),
  /** L2-07: Multimodal input path (attachment validation, preprocess, capability routing); default false in production */
  multimodal_input_path_enabled: z.boolean().default(false),
  /** L2-02: MVP query/chat endpoint; false in production until gate, true in dev/staging */
  runtime_mvp_query_chat_enabled: z.boolean().default(true),
  /** L2-04: Emit required events and traces; true in dev/staging, controlled in production */
  observability_required_events_v1: z.boolean().default(true),
  /** L2-05: Security hard controls (audit, secret scope, tool deny); true in dev/staging, controlled in production */
  security_hard_controls_enabled: z.boolean().default(true),
  /** L2-99: When true (and gate passed), coding-agent runs autonomous loop (execution ↔ tool)* → synthesis. Default false until readiness gate approves. */
  harness_autonomous_execution_enabled: z.boolean().default(false),
  /** L2-06: Memory retrieval enabled; false in production until quality gate passes */
  memory_retrieval_enabled: z.boolean().default(false),
  /** L2-08: global production rollout kill-switch for runtime behavior and docs parity. */
  platform_production_rollout_enabled: z.boolean().default(false),
});

/** Release/deployment metadata for traceability (L2-08). Optional; from env at deploy time. */
const ReleaseMetadataSchema = z
  .object({
    release_id: z.string().optional(),
    build_id: z.string().optional(),
  })
  .optional()
  .default({});

/** L2-06 Segment I: Memory retention/TTL for vector (and optionally structured/object) stores. */
export const MemoryRetentionSchema = z
  .object({
    /** TTL in seconds; chunks older than this may be evicted (where supported). */
    ttl_seconds: z.number().int().min(0).optional(),
    /** Max chunks per scope (scope_keys) before evicting oldest; optional. */
    max_chunks_per_scope: z.number().int().min(0).optional(),
  })
  .optional()
  .default({});

export type MemoryRetentionConfig = z.infer<typeof MemoryRetentionSchema>;

/** L2-06: Embedding provider configuration for vector similarity search. */
const EmbeddingConfigSchema = z
  .object({
    /** Embedding provider type: hash (deterministic local), openai (OpenAI API), or gateway (model gateway). */
    provider: z.enum(["hash", "openai", "gateway"]).default("hash"),
    /** Model name for embedding generation (used by openai and gateway providers). */
    model: z.string().min(1).default("text-embedding-3-small"),
    /** Environment variable name containing the API key (for openai provider). */
    api_key_env: z.string().min(1).default("OPENAI_API_KEY"),
    /** Vector dimensions (used by hash provider; openai/gateway use provider dimensions). */
    dimensions: z.number().int().positive().default(1536),
    /** Base URL for embedding API (for openai provider, defaults to OpenAI API). */
    base_url: z.string().min(1).optional(),
  })
  .default({});

export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>;

/** Runtime controls for retrieval boundedness and backend selection. */
const MemoryRuntimeSchema = z
  .object({
    /** Retrieval timeout in milliseconds before deterministic degraded fallback. */
    retrieval_timeout_ms: z.number().int().positive().default(1_500),
    /** Max context chars assembled from retrieval hits. @deprecated Use max_context_tokens */
    max_context_chars: z.number().int().positive().default(4_000),
    /** Max tokens for context (more accurate than character count for LLM budgeting). L2-06 */
    max_context_tokens: z.number().int().positive().default(1_000),
    /** Max chunks accepted per ingest call before trim/reject policy applies. */
    max_chunks_per_ingest: z.number().int().positive().default(128),
    /** Chunk-cap policy when ingest exceeds max_chunks_per_ingest. */
    ingest_chunk_cap_policy: z.enum(["trim", "reject"]).default("trim"),
    /** Backend mode for vector retrieval path selection. */
    backend: z.enum(["in_memory", "vector"]).default("in_memory"),
    /** L2-06 Gap A: Vector embedding configuration for semantic similarity search. */
    embedding: EmbeddingConfigSchema,
  })
  .default({});

export type MemoryRuntimeConfig = z.infer<typeof MemoryRuntimeSchema>;

const AuthClaimMappingSchema = z
  .object({
    org_id: z.string().min(1).default("org_id"),
    app_id: z.string().min(1).default("azp"),
    user_id: z.string().min(1).default("sub"),
    session_id: z.string().min(1).default("session_id"),
    scopes: z.string().min(1).default("scope"),
  })
  .default({});

const DEFAULT_AUTH_IDP_REGISTRY: Array<{
  issuer: string;
  audience: string;
  jwt_algorithm: "HS256" | "RS256";
  jwt_secret?: string;
  jwks_uri?: string;
  claim_mapping: Record<string, never>;
}> = [
  {
    issuer: "https://idp.local/default",
    audience: "ai-server-token-exchange",
    jwt_algorithm: "HS256",
    jwt_secret: "dev-external-idp-secret",
    claim_mapping: {},
  },
];

const DEFAULT_AUTH_APP_REGISTRY = [
  {
    client_id: "app-client",
    client_secret: "app-secret",
    app_id: "a1",
    allowed_issuers: ["https://idp.local/default"],
    allowed_scopes: ["query:invoke"],
  },
];

const AuthIdpRegistryEntrySchema = z.object({
  issuer: z.string().min(1),
  audience: z.string().min(1),
  jwt_algorithm: z.enum(["HS256", "RS256"]).default("HS256"),
  jwt_secret: z.string().min(1).optional(),
  jwks_uri: z.string().url().optional(),
  claim_mapping: AuthClaimMappingSchema.default({}),
}).superRefine((entry, ctx) => {
  if (entry.jwt_algorithm === "HS256" && !entry.jwt_secret) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "jwt_secret is required for HS256 idp entries",
      path: ["jwt_secret"],
    });
  }
  if (entry.jwt_algorithm === "RS256" && !entry.jwks_uri) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "jwks_uri is required for RS256 idp entries",
      path: ["jwks_uri"],
    });
  }
});

const AuthAppRegistryEntrySchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  app_id: z.string().min(1),
  allowed_issuers: z.array(z.string().min(1)).min(1),
  allowed_scopes: z.array(z.string().min(1)).min(1),
});

const AuthConfigSchema = z
  .object({
    ai_jwt_issuer: z.string().min(1).default("ai-server"),
    ai_jwt_audience: z.string().min(1).default("ai-server-query"),
    ai_jwt_secret: z.string().min(1).default("dev-ai-jwt-secret"),
    ai_jwt_ttl_seconds: z.number().int().min(60).max(3600).default(900),
    query_required_scopes: z.array(z.string().min(1)).min(1).default(["query:invoke"]),
    idp_registry: z.array(AuthIdpRegistryEntrySchema).min(1).default(DEFAULT_AUTH_IDP_REGISTRY),
    app_registry: z.array(AuthAppRegistryEntrySchema).min(1).default(DEFAULT_AUTH_APP_REGISTRY),
  })
  .default({});

const IngressRateLimitSchema = z
  .object({
    max_requests: z.number().int().min(0).default(0),
    window_ms: z.number().int().positive().default(60_000),
  })
  .default({});

const ModelProviderSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["stub", "framed_echo", "openai_compatible"]).default("framed_echo"),
  default_model: z.string().min(1),
  base_url: z.string().url().optional(),
  api_key_env: z.string().min(1).optional(),
  api_key: z.string().min(1).optional(),
  completion_path: z.string().min(1).optional(),
  input_cost_per_million_usd: z.number().nonnegative().optional(),
  output_cost_per_million_usd: z.number().nonnegative().optional(),
});

const ModelRouteSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
});

const ModelCapabilityRegistrySchema = z
  .record(
    z.object({
      default: ModelRouteSchema.optional(),
      org: z.record(ModelRouteSchema).optional(),
      app: z.record(ModelRouteSchema).optional(),
      user: z.record(ModelRouteSchema).optional(),
    })
  )
  .default({
    chat: {
      default: {
        provider: "framed",
        model: "framed-chat",
      },
    },
  });

const ModelGatewaySettingsSchema = z
  .object({
    timeout_ms: z.number().int().positive().default(25_000),
    max_retries: z.number().int().min(0).default(2),
    default_model: z.string().min(1).default("framed-chat"),
    default_capability: z.string().min(1).default("chat"),
    providers: z.array(ModelProviderSchema).min(1).default([
      {
        id: "framed",
        kind: "framed_echo",
        default_model: "framed-chat",
      },
    ]),
    registry: ModelCapabilityRegistrySchema,
  })
  .default({});

export type AuthClaimMapping = z.infer<typeof AuthClaimMappingSchema>;
export type AuthIdpRegistryEntry = z.infer<typeof AuthIdpRegistryEntrySchema>;
export type AuthAppRegistryEntry = z.infer<typeof AuthAppRegistryEntrySchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type IngressRateLimitConfig = z.infer<typeof IngressRateLimitSchema>;
export type ModelGatewaySettings = z.infer<typeof ModelGatewaySettingsSchema>;

export const ConfigSchema = z.object({
  /** Environment name (dev, staging, production) */
  env: z.enum(["dev", "staging", "production"]).default("dev"),
  /** Log level */
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /** Require Authorization header at ingress for /v1/query. */
  requireAuthHeader: z.boolean().default(false),
  /** L2-auth: trust-token exchange + AI JWT validation settings. */
  auth: AuthConfigSchema,
  /** L2-auth: deterministic ingress limit for /v1/query; set max_requests=0 to disable. */
  ingress_rate_limit: IngressRateLimitSchema,
  /** Optional bearer token required for operational endpoints when provided. */
  operationalBearerToken: z.string().min(1).optional(),
  /** L2-model: provider-backed model gateway settings and capability/scope routing registry. */
  model_gateway: ModelGatewaySettingsSchema,
  /** Max request body size in bytes */
  maxRequestBodyBytes: z.number().int().positive().default(1_000_000),
  /** Max time to read request body before aborting slow clients. */
  requestReadTimeoutMs: z.number().int().positive().default(30_000),
  /** Feature flags */
  flags: FeatureFlagsSchema.default({}),
  /** Release metadata for GET /v1/version and audit (L2-08) */
  release: ReleaseMetadataSchema,
  /** L2-06 Segment I: Memory retention policies for vector/structured/object stores. */
  memoryRetention: MemoryRetentionSchema,
  /** Runtime memory controls: bounded retrieval/context, ingest caps, backend selection. */
  memory: MemoryRuntimeSchema,
  /** L2-07: Max attachments per request when multimodal path enabled */
  maxAttachmentCount: z.number().int().min(0).max(100).default(10),
  /** L2-07: Max bytes per attachment (content_b64 decoded size) */
  maxAttachmentBytes: z.number().int().positive().default(4 * 1024 * 1024),
  /** L2-04: Trace sample rate 0–1 (1 = full volume; use <1 in production to reduce telemetry volume) */
  observability_trace_sample_rate: z.number().min(0).max(1).default(1),
  /** HTTPS: port for TLS server when TLS key/cert are set; default 3443 */
  httpsPort: z.number().int().min(1).max(65535).default(3443),
  /** HTTPS: path to TLS private key file; when set with tlsCertPath, HTTPS server is started */
  tlsKeyPath: z.string().min(1).optional(),
  /** HTTPS: path to TLS certificate file; when set with tlsKeyPath, HTTPS server is started */
  tlsCertPath: z.string().min(1).optional(),
  /** Optional persistent audit sink path (validated). */
  auditLogPath: z.string().min(1).optional(),
  /** Optional persistent observability event sink path (validated). */
  observabilityEventSinkPath: z.string().min(1).optional(),
  /** Gap 3A: Async job queue configuration */
  queueBackend: z.enum(["memory", "redis", "postgres"]).default("memory"),
  queueWorkers: z.number().int().min(1).default(2),
  queueMaxRetries: z.number().int().min(0).default(3),
  queueWebhookTimeoutMs: z.number().int().positive().default(30000),
  queueWebhookRetryAttempts: z.number().int().min(0).default(3),
  queueJobTimeoutMs: z.number().int().positive().default(300000),
});

export type Config = z.infer<typeof ConfigSchema>;
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

/** Deep merge: target is mutated, source wins on defined keys */
function mergeConfig(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    const v = source[key];
    if (v != null && typeof v === "object" && !Array.isArray(v) && key in target && typeof (target)[key] === "object") {
      mergeConfig((target)[key] as Record<string, unknown>, v as Record<string, unknown>);
    } else if (v !== undefined) {
      (target)[key] = v;
    }
  }
}

/** Load optional overlay from CONFIG_FILE (JSON); throws on missing/invalid when set.
 */
function loadConfigFileOverlay(): Record<string, unknown> {
  const path = process.env.CONFIG_FILE;
  if (!path) return {};
  if (!existsSync(path)) {
    throw new Error(`CONFIG_FILE is set but file does not exist: ${path}`);
  }
  try {
    const content = readFileSync(path, "utf8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`CONFIG_FILE is invalid JSON or unreadable (${path}): ${reason}`);
  }
}

function parseJsonEnv(name: string): unknown {
  const raw = process.env[name];
  if (!raw || !raw.trim()) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`${name} is invalid JSON: ${reason}`);
  }
}

function parseCsvEnv(value: string | undefined): string[] | undefined {
  if (!value || !value.trim()) return undefined;
  const parsed = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parsed.length ? parsed : undefined;
}

/** Load from process.env; if CONFIG_FILE is set, overlay file (env still wins). Failure-fast on invalid. */
export function loadConfigFromEnv(): Config {
  const rolloutFromLegacy = process.env.PLATFORM_MASTER_ROLLOUT_ENABLED;
  const rolloutFromCanonical = process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED;
  if (
    rolloutFromLegacy !== undefined &&
    rolloutFromCanonical !== undefined &&
    rolloutFromLegacy !== rolloutFromCanonical
  ) {
    console.warn(
      "[config] PLATFORM_MASTER_ROLLOUT_ENABLED conflicts with PLATFORM_PRODUCTION_ROLLOUT_ENABLED; canonical flag wins"
    );
  }
  const rolloutEnabledRaw = rolloutFromCanonical ?? rolloutFromLegacy;

  const raw = {
    env: process.env.NODE_ENV ?? "development",
    logLevel: process.env.LOG_LEVEL ?? "info",
    requireAuthHeader: process.env.REQUIRE_AUTH_HEADER === "true",
    operationalBearerToken: process.env.OPERATIONAL_BEARER_TOKEN?.trim() || undefined,
    maxRequestBodyBytes: process.env.MAX_BODY_BYTES
      ? parseInt(process.env.MAX_BODY_BYTES, 10)
      : 1_000_000,
    requestReadTimeoutMs: process.env.REQUEST_READ_TIMEOUT_MS
      ? parseInt(process.env.REQUEST_READ_TIMEOUT_MS, 10)
      : 30_000,
    flags: {
      enable_org_memory: process.env.ENABLE_ORG_MEMORY === "true",
      enable_cost_caps: process.env.ENABLE_COST_CAPS !== "false",
      enable_multimodal_pipeline: process.env.ENABLE_MULTIMODAL_PIPELINE === "true",
      multimodal_input_path_enabled: process.env.MULTIMODAL_INPUT_PATH_ENABLED === "true",
      runtime_mvp_query_chat_enabled:
        process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED === "true" ||
        (process.env.NODE_ENV !== "production" &&
          process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED !== "false"),
      observability_required_events_v1: process.env.OBSERVABILITY_REQUIRED_EVENTS_V1 !== "false",
      security_hard_controls_enabled: process.env.SECURITY_HARD_CONTROLS_ENABLED !== "false",
      harness_autonomous_execution_enabled:
        process.env.HARNESS_AUTONOMOUS_EXECUTION_ENABLED === "true",
      memory_retrieval_enabled: process.env.MEMORY_RETRIEVAL_ENABLED === "true",
      platform_production_rollout_enabled: rolloutEnabledRaw === "true",
    },
  };
  const env = raw.env === "production" ? "production" : raw.env === "staging" ? "staging" : "dev";
  const release =
    process.env.RELEASE_ID || process.env.BUILD_ID
      ? {
          release_id: process.env.RELEASE_ID ?? undefined,
          build_id: process.env.BUILD_ID ?? undefined,
        }
      : undefined;
  const maxAttachmentCount = process.env.MAX_ATTACHMENT_COUNT
    ? parseInt(process.env.MAX_ATTACHMENT_COUNT, 10)
    : 10;
  const maxAttachmentBytes = process.env.MAX_ATTACHMENT_BYTES
    ? parseInt(process.env.MAX_ATTACHMENT_BYTES, 10)
    : 4 * 1024 * 1024;
  const observabilityTraceSampleRate = process.env.OBSERVABILITY_TRACE_SAMPLE_RATE
    ? parseFloat(process.env.OBSERVABILITY_TRACE_SAMPLE_RATE)
    : 1;
  const httpsPort = process.env.HTTPS_PORT ? parseInt(process.env.HTTPS_PORT, 10) : 3443;
  const tlsKeyPath = process.env.TLS_KEY_PATH?.trim() || undefined;
  const tlsCertPath = process.env.TLS_CERT_PATH?.trim() || undefined;
  const auditLogPath = process.env.AUDIT_LOG_PATH?.trim() || undefined;
  const observabilityEventSinkPath = process.env.OBSERVABILITY_EVENT_SINK_PATH?.trim() || undefined;

  const memoryRetentionTtl = process.env.MEMORY_RETENTION_TTL_SECONDS
    ? parseInt(process.env.MEMORY_RETENTION_TTL_SECONDS, 10)
    : undefined;
  const memoryRetentionMaxChunks = process.env.MEMORY_RETENTION_MAX_CHUNKS_PER_SCOPE
    ? parseInt(process.env.MEMORY_RETENTION_MAX_CHUNKS_PER_SCOPE, 10)
    : undefined;
  const memoryRetention =
    memoryRetentionTtl !== undefined || memoryRetentionMaxChunks !== undefined
      ? { ttl_seconds: memoryRetentionTtl, max_chunks_per_scope: memoryRetentionMaxChunks }
      : undefined;
  const memoryBackend = process.env.MEMORY_BACKEND === "vector" ? "vector" : "in_memory";
  const memoryRetrievalTimeoutMs = process.env.MEMORY_RETRIEVAL_TIMEOUT_MS
    ? parseInt(process.env.MEMORY_RETRIEVAL_TIMEOUT_MS, 10)
    : 1_500;
  const memoryMaxContextChars = process.env.MEMORY_MAX_CONTEXT_CHARS
    ? parseInt(process.env.MEMORY_MAX_CONTEXT_CHARS, 10)
    : 4_000;
  const memoryMaxContextTokens = process.env.MEMORY_MAX_CONTEXT_TOKENS
    ? parseInt(process.env.MEMORY_MAX_CONTEXT_TOKENS, 10)
    : 1_000;
  const memoryMaxChunksPerIngest = process.env.MEMORY_MAX_CHUNKS_PER_INGEST
    ? parseInt(process.env.MEMORY_MAX_CHUNKS_PER_INGEST, 10)
    : 128;
  const memoryIngestChunkCapPolicy =
    process.env.MEMORY_INGEST_CHUNK_CAP_POLICY === "reject" ? "reject" : "trim";

  // L2-06 Gap A: Embedding configuration for vector similarity search
  const embeddingProvider = process.env.MEMORY_EMBEDDING_PROVIDER ?? "hash";
  const embeddingModel = process.env.MEMORY_EMBEDDING_MODEL ?? "text-embedding-3-small";
  const embeddingApiKeyEnv = process.env.MEMORY_EMBEDDING_API_KEY_ENV ?? "OPENAI_API_KEY";
  const embeddingDimensions = process.env.MEMORY_EMBEDDING_DIMENSIONS
    ? parseInt(process.env.MEMORY_EMBEDDING_DIMENSIONS, 10)
    : 1536;
  const embeddingBaseUrl = process.env.MEMORY_EMBEDDING_BASE_URL?.trim() || undefined;
  const authQueryRequiredScopes =
    parseCsvEnv(process.env.AUTH_QUERY_REQUIRED_SCOPES) ?? ["query:invoke"];
  const authIdpRegistry = parseJsonEnv("AUTH_IDP_REGISTRY_JSON");
  const authAppRegistry = parseJsonEnv("AUTH_APP_REGISTRY_JSON");
  const ingressRateLimitMaxRequests = process.env.INGRESS_RATE_LIMIT_MAX_REQUESTS
    ? parseInt(process.env.INGRESS_RATE_LIMIT_MAX_REQUESTS, 10)
    : 0;
  const ingressRateLimitWindowMs = process.env.INGRESS_RATE_LIMIT_WINDOW_MS
    ? parseInt(process.env.INGRESS_RATE_LIMIT_WINDOW_MS, 10)
    : 60_000;
  const modelGatewayProviders = parseJsonEnv("MODEL_GATEWAY_PROVIDERS_JSON");
  const modelGatewayRegistry = parseJsonEnv("MODEL_GATEWAY_REGISTRY_JSON");

  const authConfig: Record<string, unknown> = {
    ai_jwt_issuer: process.env.AUTH_AI_JWT_ISSUER ?? "ai-server",
    ai_jwt_audience: process.env.AUTH_AI_JWT_AUDIENCE ?? "ai-server-query",
    ai_jwt_secret: process.env.AUTH_AI_JWT_SECRET ?? "dev-ai-jwt-secret",
    ai_jwt_ttl_seconds: process.env.AUTH_AI_JWT_TTL_SECONDS
      ? parseInt(process.env.AUTH_AI_JWT_TTL_SECONDS, 10)
      : 900,
    query_required_scopes: authQueryRequiredScopes,
  };
  if (authIdpRegistry !== undefined) authConfig.idp_registry = authIdpRegistry;
  if (authAppRegistry !== undefined) authConfig.app_registry = authAppRegistry;

  const fromEnv: Record<string, unknown> = {
    ...raw,
    env,
    logLevel: raw.logLevel,
    requireAuthHeader: raw.requireAuthHeader,
    operationalBearerToken: raw.operationalBearerToken,
    maxRequestBodyBytes: raw.maxRequestBodyBytes,
    requestReadTimeoutMs: raw.requestReadTimeoutMs,
    auth: authConfig,
    ingress_rate_limit: {
      max_requests: ingressRateLimitMaxRequests,
      window_ms: ingressRateLimitWindowMs,
    },
    model_gateway: {
      timeout_ms: process.env.MODEL_GATEWAY_TIMEOUT_MS
        ? parseInt(process.env.MODEL_GATEWAY_TIMEOUT_MS, 10)
        : 25_000,
      max_retries: process.env.MODEL_GATEWAY_MAX_RETRIES
        ? parseInt(process.env.MODEL_GATEWAY_MAX_RETRIES, 10)
        : 2,
      default_model: process.env.MODEL_GATEWAY_DEFAULT_MODEL ?? "framed-chat",
      default_capability: process.env.MODEL_GATEWAY_DEFAULT_CAPABILITY ?? "chat",
      providers: modelGatewayProviders ?? [
        {
          id: "framed",
          kind: "framed_echo",
          default_model: "framed-chat",
        },
      ],
      registry: modelGatewayRegistry ?? {
        chat: {
          default: {
            provider: "framed",
            model: "framed-chat",
          },
        },
      },
    },
    memoryRetention,
    memory: {
      retrieval_timeout_ms: memoryRetrievalTimeoutMs,
      max_context_chars: memoryMaxContextChars,
      max_context_tokens: memoryMaxContextTokens,
      max_chunks_per_ingest: memoryMaxChunksPerIngest,
      ingest_chunk_cap_policy: memoryIngestChunkCapPolicy,
      backend: memoryBackend,
      embedding: {
        provider: embeddingProvider as "hash" | "openai" | "gateway",
        model: embeddingModel,
        api_key_env: embeddingApiKeyEnv,
        dimensions: embeddingDimensions,
        base_url: embeddingBaseUrl,
      },
    },
    maxAttachmentCount,
    maxAttachmentBytes,
    observability_trace_sample_rate: observabilityTraceSampleRate,
    httpsPort,
    tlsKeyPath,
    tlsCertPath,
    auditLogPath,
    observabilityEventSinkPath,
    queueBackend: (process.env.QUEUE_BACKEND as "memory" | "redis" | "postgres") ?? "memory",
    queueWorkers: parseInt(process.env.QUEUE_WORKERS_COUNT ?? "2", 10),
    queueMaxRetries: parseInt(process.env.QUEUE_MAX_RETRIES ?? "3", 10),
    queueWebhookTimeoutMs: parseInt(process.env.QUEUE_WEBHOOK_TIMEOUT_MS ?? "30000", 10),
    queueWebhookRetryAttempts: parseInt(process.env.QUEUE_WEBHOOK_RETRY_ATTEMPTS ?? "3", 10),
    queueJobTimeoutMs: parseInt(process.env.QUEUE_JOB_TIMEOUT_MS ?? "300000", 10),
    flags: {
      ...raw.flags,
      harness_autonomous_execution_enabled:
        process.env.HARNESS_AUTONOMOUS_EXECUTION_ENABLED === "true",
    },
    release,
  };
  const fileOverlay = loadConfigFileOverlay();
  const toParse =
    Object.keys(fileOverlay).length > 0
      ? (() => {
          const base = { ...fromEnv };
          mergeConfig(base, fileOverlay);
          return base;
        })()
      : fromEnv;
  const parsed = ConfigSchema.parse(toParse);
  return parsed;
}
