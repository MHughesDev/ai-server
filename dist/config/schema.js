/**
 * Config schema and load order – strict validation on startup.
 * @see Docs/SPEC/20_Config_and_FeatureFlags.md
 * L2-01 gap: optional CONFIG_FILE path for central config override (env still wins over file).
 */
import { readFileSync, existsSync } from "node:fs";
import { z } from "zod";
const FeatureFlagsSchema = z.object({
    enable_async_jobs: z.boolean().default(false),
    enable_web_tool: z.boolean().default(false),
    enable_org_memory: z.boolean().default(false),
    enable_strict_verifier: z.boolean().default(false),
    enable_cost_caps: z.boolean().default(true),
    enable_multimodal_pipeline: z.boolean().default(false),
    /** L2-07: Multimodal input path (attachment validation, preprocess, capability routing); default false in production */
    multimodal_input_path_enabled: z.boolean().default(false),
    contracts_v1_enabled: z.boolean().default(true),
    /** L2-02: MVP query/chat endpoint; false in production until gate, true in dev/staging */
    runtime_mvp_query_chat_enabled: z.boolean().default(true),
    /** L2-03: Policy/budget/router enforcement; true in dev/staging, false in production until canary */
    control_plane_enforcement_enabled: z.boolean().default(true),
    /** L2-04: Emit required events and traces; true in dev/staging, controlled in production */
    observability_required_events_v1: z.boolean().default(true),
    /** L2-05: Security hard controls (audit, secret scope, tool deny); true in dev/staging, controlled in production */
    security_hard_controls_enabled: z.boolean().default(true),
    /** L2-08: Production rollout gate; false until readiness gate passes. @see Docs/SPEC/20_Config_and_FeatureFlags.md */
    platform_production_rollout_enabled: z.boolean().default(false),
    /** L2-99: Harness readiness gate workflow active; harness execution remains false until approved */
    governance_harness_readiness_gate_active: z.boolean().default(true),
    /** L2-06: Memory retrieval enabled; false in production until quality gate passes */
    memory_retrieval_enabled: z.boolean().default(false),
});
/** Release/deployment metadata for traceability (L2-08). Optional; from env at deploy time. */
const ReleaseMetadataSchema = z
    .object({
    release_id: z.string().optional(),
    build_id: z.string().optional(),
})
    .optional()
    .default({});
export const ConfigSchema = z.object({
    /** Environment name (dev, staging, production) */
    env: z.enum(["dev", "staging", "production"]).default("dev"),
    /** Log level */
    logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
    /** Max request body size in bytes */
    maxRequestBodyBytes: z.number().int().positive().default(1_000_000),
    /** Feature flags */
    flags: FeatureFlagsSchema.default({}),
    /** Release metadata for GET /v1/version and audit (L2-08) */
    release: ReleaseMetadataSchema,
    /** L2-07: Max attachments per request when multimodal path enabled */
    maxAttachmentCount: z.number().int().min(0).max(100).default(10),
    /** L2-07: Max bytes per attachment (content_b64 decoded size) */
    maxAttachmentBytes: z.number().int().positive().default(4 * 1024 * 1024),
    /** L2-04: Trace sample rate 0–1 (1 = full volume; use <1 in production to reduce telemetry volume) */
    observability_trace_sample_rate: z.number().min(0).max(1).default(1),
});
/** Deep merge: target is mutated, source wins on defined keys */
function mergeConfig(target, source) {
    for (const key of Object.keys(source)) {
        const v = source[key];
        if (v != null && typeof v === "object" && !Array.isArray(v) && key in target && typeof target[key] === "object") {
            mergeConfig(target[key], v);
        }
        else if (v !== undefined) {
            target[key] = v;
        }
    }
}
/** Load optional overlay from CONFIG_FILE (JSON); returns {} if unset or missing */
function loadConfigFileOverlay() {
    const path = process.env.CONFIG_FILE;
    if (!path || !existsSync(path))
        return {};
    try {
        const content = readFileSync(path, "utf8");
        return JSON.parse(content);
    }
    catch {
        return {};
    }
}
/** Load from process.env; if CONFIG_FILE is set, overlay file (env still wins). Failure-fast on invalid. */
export function loadConfigFromEnv() {
    const raw = {
        env: process.env.NODE_ENV ?? "development",
        logLevel: process.env.LOG_LEVEL ?? "info",
        maxRequestBodyBytes: process.env.MAX_BODY_BYTES
            ? parseInt(process.env.MAX_BODY_BYTES, 10)
            : 1_000_000,
        flags: {
            enable_async_jobs: process.env.ENABLE_ASYNC_JOBS === "true",
            enable_web_tool: process.env.ENABLE_WEB_TOOL === "true",
            enable_org_memory: process.env.ENABLE_ORG_MEMORY === "true",
            enable_strict_verifier: process.env.ENABLE_STRICT_VERIFIER === "true",
            enable_cost_caps: process.env.ENABLE_COST_CAPS !== "false",
            enable_multimodal_pipeline: process.env.ENABLE_MULTIMODAL_PIPELINE === "true",
            multimodal_input_path_enabled: process.env.MULTIMODAL_INPUT_PATH_ENABLED === "true",
            contracts_v1_enabled: process.env.CONTRACTS_V1_ENABLED !== "false",
            runtime_mvp_query_chat_enabled: process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED === "true" ||
                (process.env.NODE_ENV !== "production" &&
                    process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED !== "false"),
            control_plane_enforcement_enabled: process.env.CONTROL_PLANE_ENFORCEMENT_ENABLED !== "false" &&
                process.env.NODE_ENV !== "production",
            observability_required_events_v1: process.env.OBSERVABILITY_REQUIRED_EVENTS_V1 !== "false",
            security_hard_controls_enabled: process.env.SECURITY_HARD_CONTROLS_ENABLED !== "false",
            governance_harness_readiness_gate_active: process.env.GOVERNANCE_HARNESS_READINESS_GATE_ACTIVE !== "false",
            memory_retrieval_enabled: process.env.MEMORY_RETRIEVAL_ENABLED === "true",
        },
    };
    const env = raw.env === "production" ? "production" : raw.env === "staging" ? "staging" : "dev";
    const release = process.env.RELEASE_ID || process.env.BUILD_ID
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
    const fromEnv = {
        ...raw,
        env,
        logLevel: raw.logLevel,
        maxRequestBodyBytes: raw.maxRequestBodyBytes,
        maxAttachmentCount,
        maxAttachmentBytes,
        observability_trace_sample_rate: observabilityTraceSampleRate,
        flags: {
            ...raw.flags,
            platform_production_rollout_enabled: process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED === "true",
            governance_harness_readiness_gate_active: process.env.GOVERNANCE_HARNESS_READINESS_GATE_ACTIVE !== "false",
        },
        release,
    };
    const fileOverlay = loadConfigFileOverlay();
    const toParse = Object.keys(fileOverlay).length > 0
        ? (() => {
            const base = { ...fromEnv };
            mergeConfig(base, fileOverlay);
            return base;
        })()
        : fromEnv;
    const parsed = ConfigSchema.parse(toParse);
    return parsed;
}
//# sourceMappingURL=schema.js.map