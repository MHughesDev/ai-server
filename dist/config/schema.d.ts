/**
 * Config schema and load order – strict validation on startup.
 * @see Docs/SPEC/20_Config_and_FeatureFlags.md
 * L2-01 gap: optional CONFIG_FILE path for central config override (env still wins over file).
 */
import { z } from "zod";
declare const FeatureFlagsSchema: z.ZodObject<{
    enable_async_jobs: z.ZodDefault<z.ZodBoolean>;
    enable_web_tool: z.ZodDefault<z.ZodBoolean>;
    enable_org_memory: z.ZodDefault<z.ZodBoolean>;
    enable_strict_verifier: z.ZodDefault<z.ZodBoolean>;
    enable_cost_caps: z.ZodDefault<z.ZodBoolean>;
    enable_multimodal_pipeline: z.ZodDefault<z.ZodBoolean>;
    /** L2-07: Multimodal input path (attachment validation, preprocess, capability routing); default false in production */
    multimodal_input_path_enabled: z.ZodDefault<z.ZodBoolean>;
    contracts_v1_enabled: z.ZodDefault<z.ZodBoolean>;
    /** L2-02: MVP query/chat endpoint; false in production until gate, true in dev/staging */
    runtime_mvp_query_chat_enabled: z.ZodDefault<z.ZodBoolean>;
    /** L2-03: Policy/budget/router enforcement; true in dev/staging, false in production until canary */
    control_plane_enforcement_enabled: z.ZodDefault<z.ZodBoolean>;
    /** L2-04: Emit required events and traces; true in dev/staging, controlled in production */
    observability_required_events_v1: z.ZodDefault<z.ZodBoolean>;
    /** L2-05: Security hard controls (audit, secret scope, tool deny); true in dev/staging, controlled in production */
    security_hard_controls_enabled: z.ZodDefault<z.ZodBoolean>;
    /** L2-08: Production rollout gate; false until readiness gate passes. @see Docs/SPEC/20_Config_and_FeatureFlags.md */
    platform_production_rollout_enabled: z.ZodDefault<z.ZodBoolean>;
    /** L2-99: Harness readiness gate workflow active; harness execution remains false until approved */
    governance_harness_readiness_gate_active: z.ZodDefault<z.ZodBoolean>;
    /** L2-06: Memory retrieval enabled; false in production until quality gate passes */
    memory_retrieval_enabled: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    enable_async_jobs: boolean;
    enable_web_tool: boolean;
    enable_org_memory: boolean;
    enable_strict_verifier: boolean;
    enable_cost_caps: boolean;
    enable_multimodal_pipeline: boolean;
    multimodal_input_path_enabled: boolean;
    contracts_v1_enabled: boolean;
    runtime_mvp_query_chat_enabled: boolean;
    control_plane_enforcement_enabled: boolean;
    observability_required_events_v1: boolean;
    security_hard_controls_enabled: boolean;
    platform_production_rollout_enabled: boolean;
    governance_harness_readiness_gate_active: boolean;
    memory_retrieval_enabled: boolean;
}, {
    enable_async_jobs?: boolean | undefined;
    enable_web_tool?: boolean | undefined;
    enable_org_memory?: boolean | undefined;
    enable_strict_verifier?: boolean | undefined;
    enable_cost_caps?: boolean | undefined;
    enable_multimodal_pipeline?: boolean | undefined;
    multimodal_input_path_enabled?: boolean | undefined;
    contracts_v1_enabled?: boolean | undefined;
    runtime_mvp_query_chat_enabled?: boolean | undefined;
    control_plane_enforcement_enabled?: boolean | undefined;
    observability_required_events_v1?: boolean | undefined;
    security_hard_controls_enabled?: boolean | undefined;
    platform_production_rollout_enabled?: boolean | undefined;
    governance_harness_readiness_gate_active?: boolean | undefined;
    memory_retrieval_enabled?: boolean | undefined;
}>;
export declare const ConfigSchema: z.ZodObject<{
    /** Environment name (dev, staging, production) */
    env: z.ZodDefault<z.ZodEnum<["dev", "staging", "production"]>>;
    /** Log level */
    logLevel: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error"]>>;
    /** Max request body size in bytes */
    maxRequestBodyBytes: z.ZodDefault<z.ZodNumber>;
    /** Feature flags */
    flags: z.ZodDefault<z.ZodObject<{
        enable_async_jobs: z.ZodDefault<z.ZodBoolean>;
        enable_web_tool: z.ZodDefault<z.ZodBoolean>;
        enable_org_memory: z.ZodDefault<z.ZodBoolean>;
        enable_strict_verifier: z.ZodDefault<z.ZodBoolean>;
        enable_cost_caps: z.ZodDefault<z.ZodBoolean>;
        enable_multimodal_pipeline: z.ZodDefault<z.ZodBoolean>;
        /** L2-07: Multimodal input path (attachment validation, preprocess, capability routing); default false in production */
        multimodal_input_path_enabled: z.ZodDefault<z.ZodBoolean>;
        contracts_v1_enabled: z.ZodDefault<z.ZodBoolean>;
        /** L2-02: MVP query/chat endpoint; false in production until gate, true in dev/staging */
        runtime_mvp_query_chat_enabled: z.ZodDefault<z.ZodBoolean>;
        /** L2-03: Policy/budget/router enforcement; true in dev/staging, false in production until canary */
        control_plane_enforcement_enabled: z.ZodDefault<z.ZodBoolean>;
        /** L2-04: Emit required events and traces; true in dev/staging, controlled in production */
        observability_required_events_v1: z.ZodDefault<z.ZodBoolean>;
        /** L2-05: Security hard controls (audit, secret scope, tool deny); true in dev/staging, controlled in production */
        security_hard_controls_enabled: z.ZodDefault<z.ZodBoolean>;
        /** L2-08: Production rollout gate; false until readiness gate passes. @see Docs/SPEC/20_Config_and_FeatureFlags.md */
        platform_production_rollout_enabled: z.ZodDefault<z.ZodBoolean>;
        /** L2-99: Harness readiness gate workflow active; harness execution remains false until approved */
        governance_harness_readiness_gate_active: z.ZodDefault<z.ZodBoolean>;
        /** L2-06: Memory retrieval enabled; false in production until quality gate passes */
        memory_retrieval_enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enable_async_jobs: boolean;
        enable_web_tool: boolean;
        enable_org_memory: boolean;
        enable_strict_verifier: boolean;
        enable_cost_caps: boolean;
        enable_multimodal_pipeline: boolean;
        multimodal_input_path_enabled: boolean;
        contracts_v1_enabled: boolean;
        runtime_mvp_query_chat_enabled: boolean;
        control_plane_enforcement_enabled: boolean;
        observability_required_events_v1: boolean;
        security_hard_controls_enabled: boolean;
        platform_production_rollout_enabled: boolean;
        governance_harness_readiness_gate_active: boolean;
        memory_retrieval_enabled: boolean;
    }, {
        enable_async_jobs?: boolean | undefined;
        enable_web_tool?: boolean | undefined;
        enable_org_memory?: boolean | undefined;
        enable_strict_verifier?: boolean | undefined;
        enable_cost_caps?: boolean | undefined;
        enable_multimodal_pipeline?: boolean | undefined;
        multimodal_input_path_enabled?: boolean | undefined;
        contracts_v1_enabled?: boolean | undefined;
        runtime_mvp_query_chat_enabled?: boolean | undefined;
        control_plane_enforcement_enabled?: boolean | undefined;
        observability_required_events_v1?: boolean | undefined;
        security_hard_controls_enabled?: boolean | undefined;
        platform_production_rollout_enabled?: boolean | undefined;
        governance_harness_readiness_gate_active?: boolean | undefined;
        memory_retrieval_enabled?: boolean | undefined;
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
    /** L2-07: Max attachments per request when multimodal path enabled */
    maxAttachmentCount: z.ZodDefault<z.ZodNumber>;
    /** L2-07: Max bytes per attachment (content_b64 decoded size) */
    maxAttachmentBytes: z.ZodDefault<z.ZodNumber>;
    /** L2-04: Trace sample rate 0–1 (1 = full volume; use <1 in production to reduce telemetry volume) */
    observability_trace_sample_rate: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    env: "dev" | "staging" | "production";
    logLevel: "debug" | "info" | "warn" | "error";
    maxRequestBodyBytes: number;
    flags: {
        enable_async_jobs: boolean;
        enable_web_tool: boolean;
        enable_org_memory: boolean;
        enable_strict_verifier: boolean;
        enable_cost_caps: boolean;
        enable_multimodal_pipeline: boolean;
        multimodal_input_path_enabled: boolean;
        contracts_v1_enabled: boolean;
        runtime_mvp_query_chat_enabled: boolean;
        control_plane_enforcement_enabled: boolean;
        observability_required_events_v1: boolean;
        security_hard_controls_enabled: boolean;
        platform_production_rollout_enabled: boolean;
        governance_harness_readiness_gate_active: boolean;
        memory_retrieval_enabled: boolean;
    };
    release: {
        release_id?: string | undefined;
        build_id?: string | undefined;
    };
    maxAttachmentCount: number;
    maxAttachmentBytes: number;
    observability_trace_sample_rate: number;
}, {
    env?: "dev" | "staging" | "production" | undefined;
    logLevel?: "debug" | "info" | "warn" | "error" | undefined;
    maxRequestBodyBytes?: number | undefined;
    flags?: {
        enable_async_jobs?: boolean | undefined;
        enable_web_tool?: boolean | undefined;
        enable_org_memory?: boolean | undefined;
        enable_strict_verifier?: boolean | undefined;
        enable_cost_caps?: boolean | undefined;
        enable_multimodal_pipeline?: boolean | undefined;
        multimodal_input_path_enabled?: boolean | undefined;
        contracts_v1_enabled?: boolean | undefined;
        runtime_mvp_query_chat_enabled?: boolean | undefined;
        control_plane_enforcement_enabled?: boolean | undefined;
        observability_required_events_v1?: boolean | undefined;
        security_hard_controls_enabled?: boolean | undefined;
        platform_production_rollout_enabled?: boolean | undefined;
        governance_harness_readiness_gate_active?: boolean | undefined;
        memory_retrieval_enabled?: boolean | undefined;
    } | undefined;
    release?: {
        release_id?: string | undefined;
        build_id?: string | undefined;
    } | undefined;
    maxAttachmentCount?: number | undefined;
    maxAttachmentBytes?: number | undefined;
    observability_trace_sample_rate?: number | undefined;
}>;
export type Config = z.infer<typeof ConfigSchema>;
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
/** Load from process.env; if CONFIG_FILE is set, overlay file (env still wins). Failure-fast on invalid. */
export declare function loadConfigFromEnv(): Config;
export {};
//# sourceMappingURL=schema.d.ts.map