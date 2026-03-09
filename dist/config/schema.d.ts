/**
 * Config schema and load order – strict validation on startup.
 * @see docs/SPEC/20_Config_and_FeatureFlags.md
 * CONFIG_FILE env var supported: optional path to JSON overlay; env still wins over file.
 */
import { z } from "zod";
declare const FeatureFlagsSchema: z.ZodObject<{
    enable_org_memory: z.ZodDefault<z.ZodBoolean>;
    enable_cost_caps: z.ZodDefault<z.ZodBoolean>;
    enable_multimodal_pipeline: z.ZodDefault<z.ZodBoolean>;
    /** L2-07: Multimodal input path (attachment validation, preprocess, capability routing); default false in production */
    multimodal_input_path_enabled: z.ZodDefault<z.ZodBoolean>;
    /** L2-02: MVP query/chat endpoint; false in production until gate, true in dev/staging */
    runtime_mvp_query_chat_enabled: z.ZodDefault<z.ZodBoolean>;
    /** L2-04: Emit required events and traces; true in dev/staging, controlled in production */
    observability_required_events_v1: z.ZodDefault<z.ZodBoolean>;
    /** L2-05: Security hard controls (audit, secret scope, tool deny); true in dev/staging, controlled in production */
    security_hard_controls_enabled: z.ZodDefault<z.ZodBoolean>;
    /** L2-99: When true (and gate passed), coding-agent runs autonomous loop (execution ↔ tool)* → synthesis. Default false until readiness gate approves. */
    harness_autonomous_execution_enabled: z.ZodDefault<z.ZodBoolean>;
    /** L2-06: Memory retrieval enabled; false in production until quality gate passes */
    memory_retrieval_enabled: z.ZodDefault<z.ZodBoolean>;
    /** L2-08: global production rollout kill-switch for runtime behavior and docs parity. */
    platform_production_rollout_enabled: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    enable_org_memory: boolean;
    enable_cost_caps: boolean;
    enable_multimodal_pipeline: boolean;
    multimodal_input_path_enabled: boolean;
    runtime_mvp_query_chat_enabled: boolean;
    observability_required_events_v1: boolean;
    security_hard_controls_enabled: boolean;
    harness_autonomous_execution_enabled: boolean;
    memory_retrieval_enabled: boolean;
    platform_production_rollout_enabled: boolean;
}, {
    enable_org_memory?: boolean | undefined;
    enable_cost_caps?: boolean | undefined;
    enable_multimodal_pipeline?: boolean | undefined;
    multimodal_input_path_enabled?: boolean | undefined;
    runtime_mvp_query_chat_enabled?: boolean | undefined;
    observability_required_events_v1?: boolean | undefined;
    security_hard_controls_enabled?: boolean | undefined;
    harness_autonomous_execution_enabled?: boolean | undefined;
    memory_retrieval_enabled?: boolean | undefined;
    platform_production_rollout_enabled?: boolean | undefined;
}>;
/** L2-06 Segment I: Memory retention/TTL for vector (and optionally structured/object) stores. */
export declare const MemoryRetentionSchema: z.ZodDefault<z.ZodOptional<z.ZodObject<{
    /** TTL in seconds; chunks older than this may be evicted (where supported). */
    ttl_seconds: z.ZodOptional<z.ZodNumber>;
    /** Max chunks per scope (scope_keys) before evicting oldest; optional. */
    max_chunks_per_scope: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    ttl_seconds?: number | undefined;
    max_chunks_per_scope?: number | undefined;
}, {
    ttl_seconds?: number | undefined;
    max_chunks_per_scope?: number | undefined;
}>>>;
export type MemoryRetentionConfig = z.infer<typeof MemoryRetentionSchema>;
/** L2-06: Embedding provider configuration for vector similarity search. */
declare const EmbeddingConfigSchema: z.ZodDefault<z.ZodObject<{
    /** Embedding provider type: hash (deterministic local), openai (OpenAI API), or gateway (model gateway). */
    provider: z.ZodDefault<z.ZodEnum<["hash", "openai", "gateway"]>>;
    /** Model name for embedding generation (used by openai and gateway providers). */
    model: z.ZodDefault<z.ZodString>;
    /** Environment variable name containing the API key (for openai provider). */
    api_key_env: z.ZodDefault<z.ZodString>;
    /** Vector dimensions (used by hash provider; openai/gateway use provider dimensions). */
    dimensions: z.ZodDefault<z.ZodNumber>;
    /** Base URL for embedding API (for openai provider, defaults to OpenAI API). */
    base_url: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    provider: "hash" | "openai" | "gateway";
    model: string;
    api_key_env: string;
    dimensions: number;
    base_url?: string | undefined;
}, {
    provider?: "hash" | "openai" | "gateway" | undefined;
    model?: string | undefined;
    api_key_env?: string | undefined;
    dimensions?: number | undefined;
    base_url?: string | undefined;
}>>;
export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>;
/** Runtime controls for retrieval boundedness and backend selection. */
declare const MemoryRuntimeSchema: z.ZodDefault<z.ZodObject<{
    /** Retrieval timeout in milliseconds before deterministic degraded fallback. */
    retrieval_timeout_ms: z.ZodDefault<z.ZodNumber>;
    /** Max context chars assembled from retrieval hits. @deprecated Use max_context_tokens */
    max_context_chars: z.ZodDefault<z.ZodNumber>;
    /** Max tokens for context (more accurate than character count for LLM budgeting). L2-06 */
    max_context_tokens: z.ZodDefault<z.ZodNumber>;
    /** Max chunks accepted per ingest call before trim/reject policy applies. */
    max_chunks_per_ingest: z.ZodDefault<z.ZodNumber>;
    /** Chunk-cap policy when ingest exceeds max_chunks_per_ingest. */
    ingest_chunk_cap_policy: z.ZodDefault<z.ZodEnum<["trim", "reject"]>>;
    /** Backend mode for vector retrieval path selection. */
    backend: z.ZodDefault<z.ZodEnum<["in_memory", "vector"]>>;
    /** L2-06 Gap A: Vector embedding configuration for semantic similarity search. */
    embedding: z.ZodDefault<z.ZodObject<{
        /** Embedding provider type: hash (deterministic local), openai (OpenAI API), or gateway (model gateway). */
        provider: z.ZodDefault<z.ZodEnum<["hash", "openai", "gateway"]>>;
        /** Model name for embedding generation (used by openai and gateway providers). */
        model: z.ZodDefault<z.ZodString>;
        /** Environment variable name containing the API key (for openai provider). */
        api_key_env: z.ZodDefault<z.ZodString>;
        /** Vector dimensions (used by hash provider; openai/gateway use provider dimensions). */
        dimensions: z.ZodDefault<z.ZodNumber>;
        /** Base URL for embedding API (for openai provider, defaults to OpenAI API). */
        base_url: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        provider: "hash" | "openai" | "gateway";
        model: string;
        api_key_env: string;
        dimensions: number;
        base_url?: string | undefined;
    }, {
        provider?: "hash" | "openai" | "gateway" | undefined;
        model?: string | undefined;
        api_key_env?: string | undefined;
        dimensions?: number | undefined;
        base_url?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    retrieval_timeout_ms: number;
    max_context_chars: number;
    max_context_tokens: number;
    max_chunks_per_ingest: number;
    ingest_chunk_cap_policy: "trim" | "reject";
    backend: "in_memory" | "vector";
    embedding: {
        provider: "hash" | "openai" | "gateway";
        model: string;
        api_key_env: string;
        dimensions: number;
        base_url?: string | undefined;
    };
}, {
    retrieval_timeout_ms?: number | undefined;
    max_context_chars?: number | undefined;
    max_context_tokens?: number | undefined;
    max_chunks_per_ingest?: number | undefined;
    ingest_chunk_cap_policy?: "trim" | "reject" | undefined;
    backend?: "in_memory" | "vector" | undefined;
    embedding?: {
        provider?: "hash" | "openai" | "gateway" | undefined;
        model?: string | undefined;
        api_key_env?: string | undefined;
        dimensions?: number | undefined;
        base_url?: string | undefined;
    } | undefined;
}>>;
export type MemoryRuntimeConfig = z.infer<typeof MemoryRuntimeSchema>;
declare const AuthClaimMappingSchema: z.ZodDefault<z.ZodObject<{
    org_id: z.ZodDefault<z.ZodString>;
    app_id: z.ZodDefault<z.ZodString>;
    user_id: z.ZodDefault<z.ZodString>;
    session_id: z.ZodDefault<z.ZodString>;
    scopes: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    org_id: string;
    app_id: string;
    user_id: string;
    session_id: string;
    scopes: string;
}, {
    org_id?: string | undefined;
    app_id?: string | undefined;
    user_id?: string | undefined;
    session_id?: string | undefined;
    scopes?: string | undefined;
}>>;
declare const AuthIdpRegistryEntrySchema: z.ZodEffects<z.ZodObject<{
    issuer: z.ZodString;
    audience: z.ZodString;
    jwt_algorithm: z.ZodDefault<z.ZodEnum<["HS256", "RS256"]>>;
    jwt_secret: z.ZodOptional<z.ZodString>;
    jwks_uri: z.ZodOptional<z.ZodString>;
    claim_mapping: z.ZodDefault<z.ZodDefault<z.ZodObject<{
        org_id: z.ZodDefault<z.ZodString>;
        app_id: z.ZodDefault<z.ZodString>;
        user_id: z.ZodDefault<z.ZodString>;
        session_id: z.ZodDefault<z.ZodString>;
        scopes: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        org_id: string;
        app_id: string;
        user_id: string;
        session_id: string;
        scopes: string;
    }, {
        org_id?: string | undefined;
        app_id?: string | undefined;
        user_id?: string | undefined;
        session_id?: string | undefined;
        scopes?: string | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    issuer: string;
    audience: string;
    jwt_algorithm: "HS256" | "RS256";
    claim_mapping: {
        org_id: string;
        app_id: string;
        user_id: string;
        session_id: string;
        scopes: string;
    };
    jwt_secret?: string | undefined;
    jwks_uri?: string | undefined;
}, {
    issuer: string;
    audience: string;
    jwt_algorithm?: "HS256" | "RS256" | undefined;
    jwt_secret?: string | undefined;
    jwks_uri?: string | undefined;
    claim_mapping?: {
        org_id?: string | undefined;
        app_id?: string | undefined;
        user_id?: string | undefined;
        session_id?: string | undefined;
        scopes?: string | undefined;
    } | undefined;
}>, {
    issuer: string;
    audience: string;
    jwt_algorithm: "HS256" | "RS256";
    claim_mapping: {
        org_id: string;
        app_id: string;
        user_id: string;
        session_id: string;
        scopes: string;
    };
    jwt_secret?: string | undefined;
    jwks_uri?: string | undefined;
}, {
    issuer: string;
    audience: string;
    jwt_algorithm?: "HS256" | "RS256" | undefined;
    jwt_secret?: string | undefined;
    jwks_uri?: string | undefined;
    claim_mapping?: {
        org_id?: string | undefined;
        app_id?: string | undefined;
        user_id?: string | undefined;
        session_id?: string | undefined;
        scopes?: string | undefined;
    } | undefined;
}>;
declare const AuthAppRegistryEntrySchema: z.ZodObject<{
    client_id: z.ZodString;
    client_secret: z.ZodString;
    app_id: z.ZodString;
    allowed_issuers: z.ZodArray<z.ZodString, "many">;
    allowed_scopes: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    app_id: string;
    client_id: string;
    client_secret: string;
    allowed_issuers: string[];
    allowed_scopes: string[];
}, {
    app_id: string;
    client_id: string;
    client_secret: string;
    allowed_issuers: string[];
    allowed_scopes: string[];
}>;
declare const AuthConfigSchema: z.ZodDefault<z.ZodObject<{
    ai_jwt_issuer: z.ZodDefault<z.ZodString>;
    ai_jwt_audience: z.ZodDefault<z.ZodString>;
    ai_jwt_secret: z.ZodDefault<z.ZodString>;
    ai_jwt_ttl_seconds: z.ZodDefault<z.ZodNumber>;
    query_required_scopes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    idp_registry: z.ZodDefault<z.ZodArray<z.ZodEffects<z.ZodObject<{
        issuer: z.ZodString;
        audience: z.ZodString;
        jwt_algorithm: z.ZodDefault<z.ZodEnum<["HS256", "RS256"]>>;
        jwt_secret: z.ZodOptional<z.ZodString>;
        jwks_uri: z.ZodOptional<z.ZodString>;
        claim_mapping: z.ZodDefault<z.ZodDefault<z.ZodObject<{
            org_id: z.ZodDefault<z.ZodString>;
            app_id: z.ZodDefault<z.ZodString>;
            user_id: z.ZodDefault<z.ZodString>;
            session_id: z.ZodDefault<z.ZodString>;
            scopes: z.ZodDefault<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            org_id: string;
            app_id: string;
            user_id: string;
            session_id: string;
            scopes: string;
        }, {
            org_id?: string | undefined;
            app_id?: string | undefined;
            user_id?: string | undefined;
            session_id?: string | undefined;
            scopes?: string | undefined;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        issuer: string;
        audience: string;
        jwt_algorithm: "HS256" | "RS256";
        claim_mapping: {
            org_id: string;
            app_id: string;
            user_id: string;
            session_id: string;
            scopes: string;
        };
        jwt_secret?: string | undefined;
        jwks_uri?: string | undefined;
    }, {
        issuer: string;
        audience: string;
        jwt_algorithm?: "HS256" | "RS256" | undefined;
        jwt_secret?: string | undefined;
        jwks_uri?: string | undefined;
        claim_mapping?: {
            org_id?: string | undefined;
            app_id?: string | undefined;
            user_id?: string | undefined;
            session_id?: string | undefined;
            scopes?: string | undefined;
        } | undefined;
    }>, {
        issuer: string;
        audience: string;
        jwt_algorithm: "HS256" | "RS256";
        claim_mapping: {
            org_id: string;
            app_id: string;
            user_id: string;
            session_id: string;
            scopes: string;
        };
        jwt_secret?: string | undefined;
        jwks_uri?: string | undefined;
    }, {
        issuer: string;
        audience: string;
        jwt_algorithm?: "HS256" | "RS256" | undefined;
        jwt_secret?: string | undefined;
        jwks_uri?: string | undefined;
        claim_mapping?: {
            org_id?: string | undefined;
            app_id?: string | undefined;
            user_id?: string | undefined;
            session_id?: string | undefined;
            scopes?: string | undefined;
        } | undefined;
    }>, "many">>;
    app_registry: z.ZodDefault<z.ZodArray<z.ZodObject<{
        client_id: z.ZodString;
        client_secret: z.ZodString;
        app_id: z.ZodString;
        allowed_issuers: z.ZodArray<z.ZodString, "many">;
        allowed_scopes: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        app_id: string;
        client_id: string;
        client_secret: string;
        allowed_issuers: string[];
        allowed_scopes: string[];
    }, {
        app_id: string;
        client_id: string;
        client_secret: string;
        allowed_issuers: string[];
        allowed_scopes: string[];
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    ai_jwt_issuer: string;
    ai_jwt_audience: string;
    ai_jwt_secret: string;
    ai_jwt_ttl_seconds: number;
    query_required_scopes: string[];
    idp_registry: {
        issuer: string;
        audience: string;
        jwt_algorithm: "HS256" | "RS256";
        claim_mapping: {
            org_id: string;
            app_id: string;
            user_id: string;
            session_id: string;
            scopes: string;
        };
        jwt_secret?: string | undefined;
        jwks_uri?: string | undefined;
    }[];
    app_registry: {
        app_id: string;
        client_id: string;
        client_secret: string;
        allowed_issuers: string[];
        allowed_scopes: string[];
    }[];
}, {
    ai_jwt_issuer?: string | undefined;
    ai_jwt_audience?: string | undefined;
    ai_jwt_secret?: string | undefined;
    ai_jwt_ttl_seconds?: number | undefined;
    query_required_scopes?: string[] | undefined;
    idp_registry?: {
        issuer: string;
        audience: string;
        jwt_algorithm?: "HS256" | "RS256" | undefined;
        jwt_secret?: string | undefined;
        jwks_uri?: string | undefined;
        claim_mapping?: {
            org_id?: string | undefined;
            app_id?: string | undefined;
            user_id?: string | undefined;
            session_id?: string | undefined;
            scopes?: string | undefined;
        } | undefined;
    }[] | undefined;
    app_registry?: {
        app_id: string;
        client_id: string;
        client_secret: string;
        allowed_issuers: string[];
        allowed_scopes: string[];
    }[] | undefined;
}>>;
declare const IngressRateLimitSchema: z.ZodDefault<z.ZodObject<{
    max_requests: z.ZodDefault<z.ZodNumber>;
    window_ms: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    max_requests: number;
    window_ms: number;
}, {
    max_requests?: number | undefined;
    window_ms?: number | undefined;
}>>;
declare const ModelGatewaySettingsSchema: z.ZodDefault<z.ZodObject<{
    timeout_ms: z.ZodDefault<z.ZodNumber>;
    max_retries: z.ZodDefault<z.ZodNumber>;
    default_model: z.ZodDefault<z.ZodString>;
    default_capability: z.ZodDefault<z.ZodString>;
    providers: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodDefault<z.ZodEnum<["stub", "framed_echo", "openai_compatible"]>>;
        default_model: z.ZodString;
        base_url: z.ZodOptional<z.ZodString>;
        api_key_env: z.ZodOptional<z.ZodString>;
        api_key: z.ZodOptional<z.ZodString>;
        completion_path: z.ZodOptional<z.ZodString>;
        input_cost_per_million_usd: z.ZodOptional<z.ZodNumber>;
        output_cost_per_million_usd: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: "stub" | "framed_echo" | "openai_compatible";
        default_model: string;
        api_key_env?: string | undefined;
        base_url?: string | undefined;
        api_key?: string | undefined;
        completion_path?: string | undefined;
        input_cost_per_million_usd?: number | undefined;
        output_cost_per_million_usd?: number | undefined;
    }, {
        id: string;
        default_model: string;
        api_key_env?: string | undefined;
        base_url?: string | undefined;
        kind?: "stub" | "framed_echo" | "openai_compatible" | undefined;
        api_key?: string | undefined;
        completion_path?: string | undefined;
        input_cost_per_million_usd?: number | undefined;
        output_cost_per_million_usd?: number | undefined;
    }>, "many">>;
    registry: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        default: z.ZodOptional<z.ZodObject<{
            provider: z.ZodString;
            model: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            provider: string;
            model: string;
        }, {
            provider: string;
            model: string;
        }>>;
        org: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            provider: z.ZodString;
            model: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            provider: string;
            model: string;
        }, {
            provider: string;
            model: string;
        }>>>;
        app: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            provider: z.ZodString;
            model: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            provider: string;
            model: string;
        }, {
            provider: string;
            model: string;
        }>>>;
        user: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            provider: z.ZodString;
            model: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            provider: string;
            model: string;
        }, {
            provider: string;
            model: string;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        default?: {
            provider: string;
            model: string;
        } | undefined;
        org?: Record<string, {
            provider: string;
            model: string;
        }> | undefined;
        app?: Record<string, {
            provider: string;
            model: string;
        }> | undefined;
        user?: Record<string, {
            provider: string;
            model: string;
        }> | undefined;
    }, {
        default?: {
            provider: string;
            model: string;
        } | undefined;
        org?: Record<string, {
            provider: string;
            model: string;
        }> | undefined;
        app?: Record<string, {
            provider: string;
            model: string;
        }> | undefined;
        user?: Record<string, {
            provider: string;
            model: string;
        }> | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    default_model: string;
    timeout_ms: number;
    max_retries: number;
    default_capability: string;
    providers: {
        id: string;
        kind: "stub" | "framed_echo" | "openai_compatible";
        default_model: string;
        api_key_env?: string | undefined;
        base_url?: string | undefined;
        api_key?: string | undefined;
        completion_path?: string | undefined;
        input_cost_per_million_usd?: number | undefined;
        output_cost_per_million_usd?: number | undefined;
    }[];
    registry: Record<string, {
        default?: {
            provider: string;
            model: string;
        } | undefined;
        org?: Record<string, {
            provider: string;
            model: string;
        }> | undefined;
        app?: Record<string, {
            provider: string;
            model: string;
        }> | undefined;
        user?: Record<string, {
            provider: string;
            model: string;
        }> | undefined;
    }>;
}, {
    default_model?: string | undefined;
    timeout_ms?: number | undefined;
    max_retries?: number | undefined;
    default_capability?: string | undefined;
    providers?: {
        id: string;
        default_model: string;
        api_key_env?: string | undefined;
        base_url?: string | undefined;
        kind?: "stub" | "framed_echo" | "openai_compatible" | undefined;
        api_key?: string | undefined;
        completion_path?: string | undefined;
        input_cost_per_million_usd?: number | undefined;
        output_cost_per_million_usd?: number | undefined;
    }[] | undefined;
    registry?: Record<string, {
        default?: {
            provider: string;
            model: string;
        } | undefined;
        org?: Record<string, {
            provider: string;
            model: string;
        }> | undefined;
        app?: Record<string, {
            provider: string;
            model: string;
        }> | undefined;
        user?: Record<string, {
            provider: string;
            model: string;
        }> | undefined;
    }> | undefined;
}>>;
export type AuthClaimMapping = z.infer<typeof AuthClaimMappingSchema>;
export type AuthIdpRegistryEntry = z.infer<typeof AuthIdpRegistryEntrySchema>;
export type AuthAppRegistryEntry = z.infer<typeof AuthAppRegistryEntrySchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type IngressRateLimitConfig = z.infer<typeof IngressRateLimitSchema>;
export type ModelGatewaySettings = z.infer<typeof ModelGatewaySettingsSchema>;
export declare const ConfigSchema: z.ZodObject<{
    /** Environment name (dev, staging, production) */
    env: z.ZodDefault<z.ZodEnum<["dev", "staging", "production"]>>;
    /** Log level */
    logLevel: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error"]>>;
    /** Require Authorization header at ingress for /v1/query. */
    requireAuthHeader: z.ZodDefault<z.ZodBoolean>;
    /** L2-auth: trust-token exchange + AI JWT validation settings. */
    auth: z.ZodDefault<z.ZodObject<{
        ai_jwt_issuer: z.ZodDefault<z.ZodString>;
        ai_jwt_audience: z.ZodDefault<z.ZodString>;
        ai_jwt_secret: z.ZodDefault<z.ZodString>;
        ai_jwt_ttl_seconds: z.ZodDefault<z.ZodNumber>;
        query_required_scopes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        idp_registry: z.ZodDefault<z.ZodArray<z.ZodEffects<z.ZodObject<{
            issuer: z.ZodString;
            audience: z.ZodString;
            jwt_algorithm: z.ZodDefault<z.ZodEnum<["HS256", "RS256"]>>;
            jwt_secret: z.ZodOptional<z.ZodString>;
            jwks_uri: z.ZodOptional<z.ZodString>;
            claim_mapping: z.ZodDefault<z.ZodDefault<z.ZodObject<{
                org_id: z.ZodDefault<z.ZodString>;
                app_id: z.ZodDefault<z.ZodString>;
                user_id: z.ZodDefault<z.ZodString>;
                session_id: z.ZodDefault<z.ZodString>;
                scopes: z.ZodDefault<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                org_id: string;
                app_id: string;
                user_id: string;
                session_id: string;
                scopes: string;
            }, {
                org_id?: string | undefined;
                app_id?: string | undefined;
                user_id?: string | undefined;
                session_id?: string | undefined;
                scopes?: string | undefined;
            }>>>;
        }, "strip", z.ZodTypeAny, {
            issuer: string;
            audience: string;
            jwt_algorithm: "HS256" | "RS256";
            claim_mapping: {
                org_id: string;
                app_id: string;
                user_id: string;
                session_id: string;
                scopes: string;
            };
            jwt_secret?: string | undefined;
            jwks_uri?: string | undefined;
        }, {
            issuer: string;
            audience: string;
            jwt_algorithm?: "HS256" | "RS256" | undefined;
            jwt_secret?: string | undefined;
            jwks_uri?: string | undefined;
            claim_mapping?: {
                org_id?: string | undefined;
                app_id?: string | undefined;
                user_id?: string | undefined;
                session_id?: string | undefined;
                scopes?: string | undefined;
            } | undefined;
        }>, {
            issuer: string;
            audience: string;
            jwt_algorithm: "HS256" | "RS256";
            claim_mapping: {
                org_id: string;
                app_id: string;
                user_id: string;
                session_id: string;
                scopes: string;
            };
            jwt_secret?: string | undefined;
            jwks_uri?: string | undefined;
        }, {
            issuer: string;
            audience: string;
            jwt_algorithm?: "HS256" | "RS256" | undefined;
            jwt_secret?: string | undefined;
            jwks_uri?: string | undefined;
            claim_mapping?: {
                org_id?: string | undefined;
                app_id?: string | undefined;
                user_id?: string | undefined;
                session_id?: string | undefined;
                scopes?: string | undefined;
            } | undefined;
        }>, "many">>;
        app_registry: z.ZodDefault<z.ZodArray<z.ZodObject<{
            client_id: z.ZodString;
            client_secret: z.ZodString;
            app_id: z.ZodString;
            allowed_issuers: z.ZodArray<z.ZodString, "many">;
            allowed_scopes: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            app_id: string;
            client_id: string;
            client_secret: string;
            allowed_issuers: string[];
            allowed_scopes: string[];
        }, {
            app_id: string;
            client_id: string;
            client_secret: string;
            allowed_issuers: string[];
            allowed_scopes: string[];
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        ai_jwt_issuer: string;
        ai_jwt_audience: string;
        ai_jwt_secret: string;
        ai_jwt_ttl_seconds: number;
        query_required_scopes: string[];
        idp_registry: {
            issuer: string;
            audience: string;
            jwt_algorithm: "HS256" | "RS256";
            claim_mapping: {
                org_id: string;
                app_id: string;
                user_id: string;
                session_id: string;
                scopes: string;
            };
            jwt_secret?: string | undefined;
            jwks_uri?: string | undefined;
        }[];
        app_registry: {
            app_id: string;
            client_id: string;
            client_secret: string;
            allowed_issuers: string[];
            allowed_scopes: string[];
        }[];
    }, {
        ai_jwt_issuer?: string | undefined;
        ai_jwt_audience?: string | undefined;
        ai_jwt_secret?: string | undefined;
        ai_jwt_ttl_seconds?: number | undefined;
        query_required_scopes?: string[] | undefined;
        idp_registry?: {
            issuer: string;
            audience: string;
            jwt_algorithm?: "HS256" | "RS256" | undefined;
            jwt_secret?: string | undefined;
            jwks_uri?: string | undefined;
            claim_mapping?: {
                org_id?: string | undefined;
                app_id?: string | undefined;
                user_id?: string | undefined;
                session_id?: string | undefined;
                scopes?: string | undefined;
            } | undefined;
        }[] | undefined;
        app_registry?: {
            app_id: string;
            client_id: string;
            client_secret: string;
            allowed_issuers: string[];
            allowed_scopes: string[];
        }[] | undefined;
    }>>;
    /** L2-auth: deterministic ingress limit for /v1/query; set max_requests=0 to disable. */
    ingress_rate_limit: z.ZodDefault<z.ZodObject<{
        max_requests: z.ZodDefault<z.ZodNumber>;
        window_ms: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        max_requests: number;
        window_ms: number;
    }, {
        max_requests?: number | undefined;
        window_ms?: number | undefined;
    }>>;
    /** Optional bearer token required for operational endpoints when provided. */
    operationalBearerToken: z.ZodOptional<z.ZodString>;
    /** L2-model: provider-backed model gateway settings and capability/scope routing registry. */
    model_gateway: z.ZodDefault<z.ZodObject<{
        timeout_ms: z.ZodDefault<z.ZodNumber>;
        max_retries: z.ZodDefault<z.ZodNumber>;
        default_model: z.ZodDefault<z.ZodString>;
        default_capability: z.ZodDefault<z.ZodString>;
        providers: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodDefault<z.ZodEnum<["stub", "framed_echo", "openai_compatible"]>>;
            default_model: z.ZodString;
            base_url: z.ZodOptional<z.ZodString>;
            api_key_env: z.ZodOptional<z.ZodString>;
            api_key: z.ZodOptional<z.ZodString>;
            completion_path: z.ZodOptional<z.ZodString>;
            input_cost_per_million_usd: z.ZodOptional<z.ZodNumber>;
            output_cost_per_million_usd: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            kind: "stub" | "framed_echo" | "openai_compatible";
            default_model: string;
            api_key_env?: string | undefined;
            base_url?: string | undefined;
            api_key?: string | undefined;
            completion_path?: string | undefined;
            input_cost_per_million_usd?: number | undefined;
            output_cost_per_million_usd?: number | undefined;
        }, {
            id: string;
            default_model: string;
            api_key_env?: string | undefined;
            base_url?: string | undefined;
            kind?: "stub" | "framed_echo" | "openai_compatible" | undefined;
            api_key?: string | undefined;
            completion_path?: string | undefined;
            input_cost_per_million_usd?: number | undefined;
            output_cost_per_million_usd?: number | undefined;
        }>, "many">>;
        registry: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
            default: z.ZodOptional<z.ZodObject<{
                provider: z.ZodString;
                model: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                provider: string;
                model: string;
            }, {
                provider: string;
                model: string;
            }>>;
            org: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                provider: z.ZodString;
                model: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                provider: string;
                model: string;
            }, {
                provider: string;
                model: string;
            }>>>;
            app: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                provider: z.ZodString;
                model: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                provider: string;
                model: string;
            }, {
                provider: string;
                model: string;
            }>>>;
            user: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                provider: z.ZodString;
                model: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                provider: string;
                model: string;
            }, {
                provider: string;
                model: string;
            }>>>;
        }, "strip", z.ZodTypeAny, {
            default?: {
                provider: string;
                model: string;
            } | undefined;
            org?: Record<string, {
                provider: string;
                model: string;
            }> | undefined;
            app?: Record<string, {
                provider: string;
                model: string;
            }> | undefined;
            user?: Record<string, {
                provider: string;
                model: string;
            }> | undefined;
        }, {
            default?: {
                provider: string;
                model: string;
            } | undefined;
            org?: Record<string, {
                provider: string;
                model: string;
            }> | undefined;
            app?: Record<string, {
                provider: string;
                model: string;
            }> | undefined;
            user?: Record<string, {
                provider: string;
                model: string;
            }> | undefined;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        default_model: string;
        timeout_ms: number;
        max_retries: number;
        default_capability: string;
        providers: {
            id: string;
            kind: "stub" | "framed_echo" | "openai_compatible";
            default_model: string;
            api_key_env?: string | undefined;
            base_url?: string | undefined;
            api_key?: string | undefined;
            completion_path?: string | undefined;
            input_cost_per_million_usd?: number | undefined;
            output_cost_per_million_usd?: number | undefined;
        }[];
        registry: Record<string, {
            default?: {
                provider: string;
                model: string;
            } | undefined;
            org?: Record<string, {
                provider: string;
                model: string;
            }> | undefined;
            app?: Record<string, {
                provider: string;
                model: string;
            }> | undefined;
            user?: Record<string, {
                provider: string;
                model: string;
            }> | undefined;
        }>;
    }, {
        default_model?: string | undefined;
        timeout_ms?: number | undefined;
        max_retries?: number | undefined;
        default_capability?: string | undefined;
        providers?: {
            id: string;
            default_model: string;
            api_key_env?: string | undefined;
            base_url?: string | undefined;
            kind?: "stub" | "framed_echo" | "openai_compatible" | undefined;
            api_key?: string | undefined;
            completion_path?: string | undefined;
            input_cost_per_million_usd?: number | undefined;
            output_cost_per_million_usd?: number | undefined;
        }[] | undefined;
        registry?: Record<string, {
            default?: {
                provider: string;
                model: string;
            } | undefined;
            org?: Record<string, {
                provider: string;
                model: string;
            }> | undefined;
            app?: Record<string, {
                provider: string;
                model: string;
            }> | undefined;
            user?: Record<string, {
                provider: string;
                model: string;
            }> | undefined;
        }> | undefined;
    }>>;
    /** Max request body size in bytes */
    maxRequestBodyBytes: z.ZodDefault<z.ZodNumber>;
    /** Max time to read request body before aborting slow clients. */
    requestReadTimeoutMs: z.ZodDefault<z.ZodNumber>;
    /** Feature flags */
    flags: z.ZodDefault<z.ZodObject<{
        enable_org_memory: z.ZodDefault<z.ZodBoolean>;
        enable_cost_caps: z.ZodDefault<z.ZodBoolean>;
        enable_multimodal_pipeline: z.ZodDefault<z.ZodBoolean>;
        /** L2-07: Multimodal input path (attachment validation, preprocess, capability routing); default false in production */
        multimodal_input_path_enabled: z.ZodDefault<z.ZodBoolean>;
        /** L2-02: MVP query/chat endpoint; false in production until gate, true in dev/staging */
        runtime_mvp_query_chat_enabled: z.ZodDefault<z.ZodBoolean>;
        /** L2-04: Emit required events and traces; true in dev/staging, controlled in production */
        observability_required_events_v1: z.ZodDefault<z.ZodBoolean>;
        /** L2-05: Security hard controls (audit, secret scope, tool deny); true in dev/staging, controlled in production */
        security_hard_controls_enabled: z.ZodDefault<z.ZodBoolean>;
        /** L2-99: When true (and gate passed), coding-agent runs autonomous loop (execution ↔ tool)* → synthesis. Default false until readiness gate approves. */
        harness_autonomous_execution_enabled: z.ZodDefault<z.ZodBoolean>;
        /** L2-06: Memory retrieval enabled; false in production until quality gate passes */
        memory_retrieval_enabled: z.ZodDefault<z.ZodBoolean>;
        /** L2-08: global production rollout kill-switch for runtime behavior and docs parity. */
        platform_production_rollout_enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enable_org_memory: boolean;
        enable_cost_caps: boolean;
        enable_multimodal_pipeline: boolean;
        multimodal_input_path_enabled: boolean;
        runtime_mvp_query_chat_enabled: boolean;
        observability_required_events_v1: boolean;
        security_hard_controls_enabled: boolean;
        harness_autonomous_execution_enabled: boolean;
        memory_retrieval_enabled: boolean;
        platform_production_rollout_enabled: boolean;
    }, {
        enable_org_memory?: boolean | undefined;
        enable_cost_caps?: boolean | undefined;
        enable_multimodal_pipeline?: boolean | undefined;
        multimodal_input_path_enabled?: boolean | undefined;
        runtime_mvp_query_chat_enabled?: boolean | undefined;
        observability_required_events_v1?: boolean | undefined;
        security_hard_controls_enabled?: boolean | undefined;
        harness_autonomous_execution_enabled?: boolean | undefined;
        memory_retrieval_enabled?: boolean | undefined;
        platform_production_rollout_enabled?: boolean | undefined;
    }>>;
    /** Release metadata for GET /v1/version and audit (L2-08) */
    release: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        release_id: z.ZodOptional<z.ZodString>;
        build_id: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        release_id?: string | undefined;
        build_id?: string | undefined;
    }, {
        release_id?: string | undefined;
        build_id?: string | undefined;
    }>>>;
    /** L2-06 Segment I: Memory retention policies for vector/structured/object stores. */
    memoryRetention: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        /** TTL in seconds; chunks older than this may be evicted (where supported). */
        ttl_seconds: z.ZodOptional<z.ZodNumber>;
        /** Max chunks per scope (scope_keys) before evicting oldest; optional. */
        max_chunks_per_scope: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        ttl_seconds?: number | undefined;
        max_chunks_per_scope?: number | undefined;
    }, {
        ttl_seconds?: number | undefined;
        max_chunks_per_scope?: number | undefined;
    }>>>;
    /** Runtime memory controls: bounded retrieval/context, ingest caps, backend selection. */
    memory: z.ZodDefault<z.ZodObject<{
        /** Retrieval timeout in milliseconds before deterministic degraded fallback. */
        retrieval_timeout_ms: z.ZodDefault<z.ZodNumber>;
        /** Max context chars assembled from retrieval hits. @deprecated Use max_context_tokens */
        max_context_chars: z.ZodDefault<z.ZodNumber>;
        /** Max tokens for context (more accurate than character count for LLM budgeting). L2-06 */
        max_context_tokens: z.ZodDefault<z.ZodNumber>;
        /** Max chunks accepted per ingest call before trim/reject policy applies. */
        max_chunks_per_ingest: z.ZodDefault<z.ZodNumber>;
        /** Chunk-cap policy when ingest exceeds max_chunks_per_ingest. */
        ingest_chunk_cap_policy: z.ZodDefault<z.ZodEnum<["trim", "reject"]>>;
        /** Backend mode for vector retrieval path selection. */
        backend: z.ZodDefault<z.ZodEnum<["in_memory", "vector"]>>;
        /** L2-06 Gap A: Vector embedding configuration for semantic similarity search. */
        embedding: z.ZodDefault<z.ZodObject<{
            /** Embedding provider type: hash (deterministic local), openai (OpenAI API), or gateway (model gateway). */
            provider: z.ZodDefault<z.ZodEnum<["hash", "openai", "gateway"]>>;
            /** Model name for embedding generation (used by openai and gateway providers). */
            model: z.ZodDefault<z.ZodString>;
            /** Environment variable name containing the API key (for openai provider). */
            api_key_env: z.ZodDefault<z.ZodString>;
            /** Vector dimensions (used by hash provider; openai/gateway use provider dimensions). */
            dimensions: z.ZodDefault<z.ZodNumber>;
            /** Base URL for embedding API (for openai provider, defaults to OpenAI API). */
            base_url: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            provider: "hash" | "openai" | "gateway";
            model: string;
            api_key_env: string;
            dimensions: number;
            base_url?: string | undefined;
        }, {
            provider?: "hash" | "openai" | "gateway" | undefined;
            model?: string | undefined;
            api_key_env?: string | undefined;
            dimensions?: number | undefined;
            base_url?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        retrieval_timeout_ms: number;
        max_context_chars: number;
        max_context_tokens: number;
        max_chunks_per_ingest: number;
        ingest_chunk_cap_policy: "trim" | "reject";
        backend: "in_memory" | "vector";
        embedding: {
            provider: "hash" | "openai" | "gateway";
            model: string;
            api_key_env: string;
            dimensions: number;
            base_url?: string | undefined;
        };
    }, {
        retrieval_timeout_ms?: number | undefined;
        max_context_chars?: number | undefined;
        max_context_tokens?: number | undefined;
        max_chunks_per_ingest?: number | undefined;
        ingest_chunk_cap_policy?: "trim" | "reject" | undefined;
        backend?: "in_memory" | "vector" | undefined;
        embedding?: {
            provider?: "hash" | "openai" | "gateway" | undefined;
            model?: string | undefined;
            api_key_env?: string | undefined;
            dimensions?: number | undefined;
            base_url?: string | undefined;
        } | undefined;
    }>>;
    /** L2-07: Max attachments per request when multimodal path enabled */
    maxAttachmentCount: z.ZodDefault<z.ZodNumber>;
    /** L2-07: Max bytes per attachment (content_b64 decoded size) */
    maxAttachmentBytes: z.ZodDefault<z.ZodNumber>;
    /** L2-04: Trace sample rate 0–1 (1 = full volume; use <1 in production to reduce telemetry volume) */
    observability_trace_sample_rate: z.ZodDefault<z.ZodNumber>;
    /** HTTPS: port for TLS server when TLS key/cert are set; default 3443 */
    httpsPort: z.ZodDefault<z.ZodNumber>;
    /** HTTPS: path to TLS private key file; when set with tlsCertPath, HTTPS server is started */
    tlsKeyPath: z.ZodOptional<z.ZodString>;
    /** HTTPS: path to TLS certificate file; when set with tlsKeyPath, HTTPS server is started */
    tlsCertPath: z.ZodOptional<z.ZodString>;
    /** Optional persistent audit sink path (validated). */
    auditLogPath: z.ZodOptional<z.ZodString>;
    /** Optional persistent observability event sink path (validated). */
    observabilityEventSinkPath: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    env: "dev" | "staging" | "production";
    logLevel: "debug" | "info" | "warn" | "error";
    requireAuthHeader: boolean;
    auth: {
        ai_jwt_issuer: string;
        ai_jwt_audience: string;
        ai_jwt_secret: string;
        ai_jwt_ttl_seconds: number;
        query_required_scopes: string[];
        idp_registry: {
            issuer: string;
            audience: string;
            jwt_algorithm: "HS256" | "RS256";
            claim_mapping: {
                org_id: string;
                app_id: string;
                user_id: string;
                session_id: string;
                scopes: string;
            };
            jwt_secret?: string | undefined;
            jwks_uri?: string | undefined;
        }[];
        app_registry: {
            app_id: string;
            client_id: string;
            client_secret: string;
            allowed_issuers: string[];
            allowed_scopes: string[];
        }[];
    };
    ingress_rate_limit: {
        max_requests: number;
        window_ms: number;
    };
    model_gateway: {
        default_model: string;
        timeout_ms: number;
        max_retries: number;
        default_capability: string;
        providers: {
            id: string;
            kind: "stub" | "framed_echo" | "openai_compatible";
            default_model: string;
            api_key_env?: string | undefined;
            base_url?: string | undefined;
            api_key?: string | undefined;
            completion_path?: string | undefined;
            input_cost_per_million_usd?: number | undefined;
            output_cost_per_million_usd?: number | undefined;
        }[];
        registry: Record<string, {
            default?: {
                provider: string;
                model: string;
            } | undefined;
            org?: Record<string, {
                provider: string;
                model: string;
            }> | undefined;
            app?: Record<string, {
                provider: string;
                model: string;
            }> | undefined;
            user?: Record<string, {
                provider: string;
                model: string;
            }> | undefined;
        }>;
    };
    maxRequestBodyBytes: number;
    requestReadTimeoutMs: number;
    flags: {
        enable_org_memory: boolean;
        enable_cost_caps: boolean;
        enable_multimodal_pipeline: boolean;
        multimodal_input_path_enabled: boolean;
        runtime_mvp_query_chat_enabled: boolean;
        observability_required_events_v1: boolean;
        security_hard_controls_enabled: boolean;
        harness_autonomous_execution_enabled: boolean;
        memory_retrieval_enabled: boolean;
        platform_production_rollout_enabled: boolean;
    };
    release: {
        release_id?: string | undefined;
        build_id?: string | undefined;
    };
    memoryRetention: {
        ttl_seconds?: number | undefined;
        max_chunks_per_scope?: number | undefined;
    };
    memory: {
        retrieval_timeout_ms: number;
        max_context_chars: number;
        max_context_tokens: number;
        max_chunks_per_ingest: number;
        ingest_chunk_cap_policy: "trim" | "reject";
        backend: "in_memory" | "vector";
        embedding: {
            provider: "hash" | "openai" | "gateway";
            model: string;
            api_key_env: string;
            dimensions: number;
            base_url?: string | undefined;
        };
    };
    maxAttachmentCount: number;
    maxAttachmentBytes: number;
    observability_trace_sample_rate: number;
    httpsPort: number;
    operationalBearerToken?: string | undefined;
    tlsKeyPath?: string | undefined;
    tlsCertPath?: string | undefined;
    auditLogPath?: string | undefined;
    observabilityEventSinkPath?: string | undefined;
}, {
    env?: "dev" | "staging" | "production" | undefined;
    logLevel?: "debug" | "info" | "warn" | "error" | undefined;
    requireAuthHeader?: boolean | undefined;
    auth?: {
        ai_jwt_issuer?: string | undefined;
        ai_jwt_audience?: string | undefined;
        ai_jwt_secret?: string | undefined;
        ai_jwt_ttl_seconds?: number | undefined;
        query_required_scopes?: string[] | undefined;
        idp_registry?: {
            issuer: string;
            audience: string;
            jwt_algorithm?: "HS256" | "RS256" | undefined;
            jwt_secret?: string | undefined;
            jwks_uri?: string | undefined;
            claim_mapping?: {
                org_id?: string | undefined;
                app_id?: string | undefined;
                user_id?: string | undefined;
                session_id?: string | undefined;
                scopes?: string | undefined;
            } | undefined;
        }[] | undefined;
        app_registry?: {
            app_id: string;
            client_id: string;
            client_secret: string;
            allowed_issuers: string[];
            allowed_scopes: string[];
        }[] | undefined;
    } | undefined;
    ingress_rate_limit?: {
        max_requests?: number | undefined;
        window_ms?: number | undefined;
    } | undefined;
    operationalBearerToken?: string | undefined;
    model_gateway?: {
        default_model?: string | undefined;
        timeout_ms?: number | undefined;
        max_retries?: number | undefined;
        default_capability?: string | undefined;
        providers?: {
            id: string;
            default_model: string;
            api_key_env?: string | undefined;
            base_url?: string | undefined;
            kind?: "stub" | "framed_echo" | "openai_compatible" | undefined;
            api_key?: string | undefined;
            completion_path?: string | undefined;
            input_cost_per_million_usd?: number | undefined;
            output_cost_per_million_usd?: number | undefined;
        }[] | undefined;
        registry?: Record<string, {
            default?: {
                provider: string;
                model: string;
            } | undefined;
            org?: Record<string, {
                provider: string;
                model: string;
            }> | undefined;
            app?: Record<string, {
                provider: string;
                model: string;
            }> | undefined;
            user?: Record<string, {
                provider: string;
                model: string;
            }> | undefined;
        }> | undefined;
    } | undefined;
    maxRequestBodyBytes?: number | undefined;
    requestReadTimeoutMs?: number | undefined;
    flags?: {
        enable_org_memory?: boolean | undefined;
        enable_cost_caps?: boolean | undefined;
        enable_multimodal_pipeline?: boolean | undefined;
        multimodal_input_path_enabled?: boolean | undefined;
        runtime_mvp_query_chat_enabled?: boolean | undefined;
        observability_required_events_v1?: boolean | undefined;
        security_hard_controls_enabled?: boolean | undefined;
        harness_autonomous_execution_enabled?: boolean | undefined;
        memory_retrieval_enabled?: boolean | undefined;
        platform_production_rollout_enabled?: boolean | undefined;
    } | undefined;
    release?: {
        release_id?: string | undefined;
        build_id?: string | undefined;
    } | undefined;
    memoryRetention?: {
        ttl_seconds?: number | undefined;
        max_chunks_per_scope?: number | undefined;
    } | undefined;
    memory?: {
        retrieval_timeout_ms?: number | undefined;
        max_context_chars?: number | undefined;
        max_context_tokens?: number | undefined;
        max_chunks_per_ingest?: number | undefined;
        ingest_chunk_cap_policy?: "trim" | "reject" | undefined;
        backend?: "in_memory" | "vector" | undefined;
        embedding?: {
            provider?: "hash" | "openai" | "gateway" | undefined;
            model?: string | undefined;
            api_key_env?: string | undefined;
            dimensions?: number | undefined;
            base_url?: string | undefined;
        } | undefined;
    } | undefined;
    maxAttachmentCount?: number | undefined;
    maxAttachmentBytes?: number | undefined;
    observability_trace_sample_rate?: number | undefined;
    httpsPort?: number | undefined;
    tlsKeyPath?: string | undefined;
    tlsCertPath?: string | undefined;
    auditLogPath?: string | undefined;
    observabilityEventSinkPath?: string | undefined;
}>;
export type Config = z.infer<typeof ConfigSchema>;
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
/** Load from process.env; if CONFIG_FILE is set, overlay file (env still wins). Failure-fast on invalid. */
export declare function loadConfigFromEnv(): Config;
export {};
//# sourceMappingURL=schema.d.ts.map