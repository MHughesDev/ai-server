/**
 * Rollout policy parser and release config validation tests (L2-08).
 */

import {
  parseRolloutPolicy,
  parseCanaryThresholds,
  validateReleaseConfig,
  CanaryThresholdsSchema,
  RolloutPolicySchema,
} from "./policy.js";

describe("RolloutPolicySchema", () => {
  it("accepts valid defaults", () => {
    const policy = RolloutPolicySchema.parse({});
    expect(policy.rollback_allowed).toBe(true);
    expect(policy.canary.max_error_rate_promotion).toBe(0.01);
    expect(policy.canary.abort_error_rate).toBe(0.05);
    expect(policy.canary.max_p95_latency_ratio).toBe(1.1);
    expect(policy.canary.observation_window_minutes).toBe(15);
  });

  it("accepts custom canary thresholds", () => {
    const policy = RolloutPolicySchema.parse({
      canary: {
        max_error_rate_promotion: 0.02,
        abort_error_rate: 0.1,
        max_p95_latency_ratio: 1.2,
        observation_window_minutes: 30,
      },
    });
    expect(policy.canary.max_error_rate_promotion).toBe(0.02);
    expect(policy.canary.observation_window_minutes).toBe(30);
  });

  it("rejects invalid canary error rate", () => {
    expect(() =>
      RolloutPolicySchema.parse({
        canary: { max_error_rate_promotion: 1.5 },
      })
    ).toThrow();
  });
});

describe("CanaryThresholdsSchema", () => {
  it("rejects negative observation_window_minutes", () => {
    expect(() =>
      CanaryThresholdsSchema.parse({ observation_window_minutes: -1 })
    ).toThrow();
  });
});

describe("parseRolloutPolicy", () => {
  it("returns default policy for null/undefined", () => {
    expect(parseRolloutPolicy(null)).toEqual({
      canary: {
        max_error_rate_promotion: 0.01,
        abort_error_rate: 0.05,
        max_p95_latency_ratio: 1.1,
        observation_window_minutes: 15,
      },
      rollback_allowed: true,
    });
    expect(parseRolloutPolicy(undefined)).toEqual(parseRolloutPolicy(null));
  });

  it("returns default policy for non-object", () => {
    expect(parseRolloutPolicy("string").canary.observation_window_minutes).toBe(15);
  });

  it("parses partial canary from object", () => {
    const policy = parseRolloutPolicy({
      canary: {
        max_error_rate_promotion: 0.02,
        observation_window_minutes: 30,
      },
    });
    expect(policy.canary.max_error_rate_promotion).toBe(0.02);
    expect(policy.canary.observation_window_minutes).toBe(30);
    expect(policy.canary.abort_error_rate).toBe(0.05);
  });

  it("respects rollback_allowed false", () => {
    const policy = parseRolloutPolicy({ rollback_allowed: false });
    expect(policy.rollback_allowed).toBe(false);
  });
});

describe("parseCanaryThresholds", () => {
  it("uses defaults for empty object", () => {
    const t = parseCanaryThresholds({});
    expect(t.max_error_rate_promotion).toBe(0.01);
    expect(t.observation_window_minutes).toBe(15);
  });

  it("parses string numbers from env-like input", () => {
    const t = parseCanaryThresholds({
      max_error_rate_promotion: "0.03",
      observation_window_minutes: "20",
    });
    expect(t.max_error_rate_promotion).toBe(0.03);
    expect(t.observation_window_minutes).toBe(20);
  });

  it("accepts observation_window_min as alias", () => {
    const t = parseCanaryThresholds({ observation_window_min: 25 });
    expect(t.observation_window_minutes).toBe(25);
  });
});

describe("validateReleaseConfig", () => {
  it("validates dev without release_id", () => {
    const r = validateReleaseConfig({ env: "dev" });
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("validates staging", () => {
    expect(validateReleaseConfig({ env: "staging" }).valid).toBe(true);
  });

  it("production without release_id or build_id adds warning", () => {
    const r = validateReleaseConfig({ env: "production" });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("RELEASE_ID") || e.includes("BUILD_ID"))).toBe(true);
  });

  it("production with build_id is valid", () => {
    const r = validateReleaseConfig({ env: "production", build_id: "b123" });
    expect(r.valid).toBe(true);
  });

  it("rejects invalid env", () => {
    const r = validateReleaseConfig({ env: "prod" });
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toContain("Invalid env");
  });
});
