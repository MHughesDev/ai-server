/**
 * Rollout policy parsing and validation – canary thresholds, promotion/abort criteria.
 * @see docs/PLANS/implementation/L2-08_Rollout-and-Operational-Readiness-Implementation.md
 * @see docs/SPEC/20_Config_and_FeatureFlags.md
 */

import { z } from "zod";
import { resolveFeatureFlagEnabled } from "../config/feature-flags.js";
import type { Config } from "../config/schema.js";

/** Canary success/failure thresholds (L2-08). */
export const CanaryThresholdsSchema = z.object({
  /** Max allowed error rate (0–1) for promotion. */
  max_error_rate_promotion: z.number().min(0).max(1).default(0.01),
  /** Error rate (0–1) above which canary is aborted. */
  abort_error_rate: z.number().min(0).max(1).default(0.05),
  /** Max p95 latency ratio vs baseline (e.g. 1.1 = 10% over). */
  max_p95_latency_ratio: z.number().positive().default(1.1),
  /** Canary observation window in minutes before promotion decision. */
  observation_window_minutes: z.number().int().positive().default(15),
});

export type CanaryThresholds = z.infer<typeof CanaryThresholdsSchema>;

/** Rollout policy: environment progression and canary rules. */
export const RolloutPolicySchema = z.object({
  /** Canary cohort thresholds. */
  canary: CanaryThresholdsSchema.default({}),
  /** Whether rollback is allowed (e.g. false during freeze). */
  rollback_allowed: z.boolean().default(true),
});

export type RolloutPolicy = z.infer<typeof RolloutPolicySchema>;

const DEFAULT_POLICY: RolloutPolicy = {
  canary: {
    max_error_rate_promotion: 0.01,
    abort_error_rate: 0.05,
    max_p95_latency_ratio: 1.1,
    observation_window_minutes: 15,
  },
  rollback_allowed: true,
};

/**
 * Parse rollout policy from a record (e.g. env or config).
 * Invalid or missing values fall back to defaults.
 */
export function parseRolloutPolicy(input: unknown): RolloutPolicy {
  if (input == null || typeof input !== "object") {
    return DEFAULT_POLICY;
  }
  const raw = input as Record<string, unknown>;
  const canary =
    raw.canary != null && typeof raw.canary === "object"
      ? parseCanaryThresholds(raw.canary as Record<string, unknown>)
      : DEFAULT_POLICY.canary;
  const rollback_allowed =
    typeof raw.rollback_allowed === "boolean" ? raw.rollback_allowed : true;
  return RolloutPolicySchema.parse({ canary, rollback_allowed });
}

/**
 * Parse canary thresholds from a record (e.g. env vars).
 * Numbers can be strings; invalid values use defaults.
 */
export function parseCanaryThresholds(input: Record<string, unknown>): CanaryThresholds {
  const toNum = (v: unknown, def: number): number => {
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string") {
      const n = parseFloat(v);
      if (!Number.isNaN(n)) return n;
    }
    return def;
  };
  const max_error_rate_promotion = toNum(
    input.max_error_rate_promotion,
    DEFAULT_POLICY.canary.max_error_rate_promotion
  );
  const abort_error_rate = toNum(
    input.abort_error_rate,
    DEFAULT_POLICY.canary.abort_error_rate
  );
  const max_p95_latency_ratio = toNum(
    input.max_p95_latency_ratio,
    DEFAULT_POLICY.canary.max_p95_latency_ratio
  );
  const observation_window_minutes = Math.floor(
    toNum(
      input.observation_window_minutes ?? input.observation_window_min,
      DEFAULT_POLICY.canary.observation_window_minutes
    )
  );
  return CanaryThresholdsSchema.parse({
    max_error_rate_promotion,
    abort_error_rate,
    max_p95_latency_ratio,
    observation_window_minutes,
  });
}

/**
 * Validate release config for deployment: env, optional release_id/build_id.
 * **Soft check:** production without `release_id`/`build_id` yields `valid: false` (bootstrap logs a **warn**).
 * **Hard check:** when `platform_production_rollout_enabled` is true in production, bootstrap also calls
 * `assertProductionReleaseMetadataWhenRollout` and **throws** if both are missing.
 */
export function validateReleaseConfig(config: {
  env: string;
  release_id?: string;
  build_id?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const allowedEnv = ["dev", "staging", "production"];
  if (!allowedEnv.includes(config.env)) {
    errors.push(`Invalid env: ${config.env}. Allowed: ${allowedEnv.join(", ")}`);
  }
  if (config.env === "production" && !config.release_id && !config.build_id) {
    errors.push("Production should set RELEASE_ID or BUILD_ID for traceability");
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Fail-fast when production rollout is enabled but neither `RELEASE_ID` nor `BUILD_ID` is set.
 * Soft check for production without rollout remains `validateReleaseConfig` + warn in bootstrap.
 */
export function assertProductionReleaseMetadataWhenRollout(
  config: Pick<Config, "env" | "flags" | "release">
): void {
  if (
    config.env !== "production" ||
    !resolveFeatureFlagEnabled("platform_production_rollout_enabled", config as Config)
  ) {
    return;
  }
  const rid = config.release?.release_id?.trim();
  const bid = config.release?.build_id?.trim();
  if (!rid && !bid) {
    throw new Error(
      "Production rollout requires RELEASE_ID or BUILD_ID for traceability"
    );
  }
}
