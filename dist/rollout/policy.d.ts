/**
 * Rollout policy parsing and validation – canary thresholds, promotion/abort criteria.
 * @see docs/PLANS/implementation/L2-08_Rollout-and-Operational-Readiness-Implementation.md
 * @see docs/SPEC/20_Config_and_FeatureFlags.md
 */
import { z } from "zod";
/** Canary success/failure thresholds (L2-08). */
export declare const CanaryThresholdsSchema: z.ZodObject<{
    /** Max allowed error rate (0–1) for promotion. */
    max_error_rate_promotion: z.ZodDefault<z.ZodNumber>;
    /** Error rate (0–1) above which canary is aborted. */
    abort_error_rate: z.ZodDefault<z.ZodNumber>;
    /** Max p95 latency ratio vs baseline (e.g. 1.1 = 10% over). */
    max_p95_latency_ratio: z.ZodDefault<z.ZodNumber>;
    /** Canary observation window in minutes before promotion decision. */
    observation_window_minutes: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    max_error_rate_promotion: number;
    abort_error_rate: number;
    max_p95_latency_ratio: number;
    observation_window_minutes: number;
}, {
    max_error_rate_promotion?: number | undefined;
    abort_error_rate?: number | undefined;
    max_p95_latency_ratio?: number | undefined;
    observation_window_minutes?: number | undefined;
}>;
export type CanaryThresholds = z.infer<typeof CanaryThresholdsSchema>;
/** Rollout policy: environment progression and canary rules. */
export declare const RolloutPolicySchema: z.ZodObject<{
    /** Canary cohort thresholds. */
    canary: z.ZodDefault<z.ZodObject<{
        /** Max allowed error rate (0–1) for promotion. */
        max_error_rate_promotion: z.ZodDefault<z.ZodNumber>;
        /** Error rate (0–1) above which canary is aborted. */
        abort_error_rate: z.ZodDefault<z.ZodNumber>;
        /** Max p95 latency ratio vs baseline (e.g. 1.1 = 10% over). */
        max_p95_latency_ratio: z.ZodDefault<z.ZodNumber>;
        /** Canary observation window in minutes before promotion decision. */
        observation_window_minutes: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        max_error_rate_promotion: number;
        abort_error_rate: number;
        max_p95_latency_ratio: number;
        observation_window_minutes: number;
    }, {
        max_error_rate_promotion?: number | undefined;
        abort_error_rate?: number | undefined;
        max_p95_latency_ratio?: number | undefined;
        observation_window_minutes?: number | undefined;
    }>>;
    /** Whether rollback is allowed (e.g. false during freeze). */
    rollback_allowed: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    canary: {
        max_error_rate_promotion: number;
        abort_error_rate: number;
        max_p95_latency_ratio: number;
        observation_window_minutes: number;
    };
    rollback_allowed: boolean;
}, {
    canary?: {
        max_error_rate_promotion?: number | undefined;
        abort_error_rate?: number | undefined;
        max_p95_latency_ratio?: number | undefined;
        observation_window_minutes?: number | undefined;
    } | undefined;
    rollback_allowed?: boolean | undefined;
}>;
export type RolloutPolicy = z.infer<typeof RolloutPolicySchema>;
/**
 * Parse rollout policy from a record (e.g. env or config).
 * Invalid or missing values fall back to defaults.
 */
export declare function parseRolloutPolicy(input: unknown): RolloutPolicy;
/**
 * Parse canary thresholds from a record (e.g. env vars).
 * Numbers can be strings; invalid values use defaults.
 */
export declare function parseCanaryThresholds(input: Record<string, unknown>): CanaryThresholds;
/**
 * Validate release config for deployment: env, optional release_id/build_id.
 * **Soft check:** production without `release_id`/`build_id` yields `valid: false` (bootstrap logs a **warn**).
 * **Hard check:** when `platform_production_rollout_enabled` is true in production, bootstrap also calls
 * `assertProductionReleaseMetadataWhenRollout` and **throws** if both are missing.
 */
export declare function validateReleaseConfig(config: {
    env: string;
    release_id?: string;
    build_id?: string;
}): {
    valid: boolean;
    errors: string[];
};
/**
 * Fail-fast when production rollout is enabled but neither `RELEASE_ID` nor `BUILD_ID` is set.
 * Soft check for production without rollout remains `validateReleaseConfig` + warn in bootstrap.
 */
export declare function assertProductionReleaseMetadataWhenRollout(config: {
    env: string;
    flags: {
        platform_production_rollout_enabled: boolean;
    };
    release?: {
        release_id?: string;
        build_id?: string;
    } | null;
}): void;
//# sourceMappingURL=policy.d.ts.map