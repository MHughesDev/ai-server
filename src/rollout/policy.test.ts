/**
 * Rollout policy parser and release config validation tests (L2-08).
 */

import { loadConfigFromEnv } from "../config/schema.js";
import {
  parseRolloutPolicy,
  parseCanaryThresholds,
  validateReleaseConfig,
  assertProductionReleaseMetadataWhenRollout,
  assertProductionRolloutCanarySignoff,
  isProductionRolloutTrafficBlocked,
  isRolloutCanarySignoffAcknowledged,
  productionRolloutDisabledResponse,
  evaluateCanaryDecision,
  loadRolloutPolicyFromEnv,
  resetRolloutPolicyCacheForTest,
  getDefaultRolloutPolicy,
  CanaryThresholdsSchema,
  RolloutPolicySchema,
} from "./policy.js";
import { DEFAULT_CANARY_COHORTS } from "./cohorts.js";

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
    const policy = parseRolloutPolicy(null);
    expect(policy.canary).toEqual({
      max_error_rate_promotion: 0.01,
      abort_error_rate: 0.05,
      max_p95_latency_ratio: 1.1,
      observation_window_minutes: 15,
    });
    expect(policy.rollback_allowed).toBe(true);
    expect(policy.cohorts).toEqual(DEFAULT_CANARY_COHORTS);
    expect(policy.max_rollback_mttr_ms).toBe(120_000);
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

  it("parses custom cohorts and MTTR SLO", () => {
    const policy = parseRolloutPolicy({
      cohorts: [{ id: "pilot", stage: "internal", traffic_percent: 5 }],
      max_rollback_mttr_ms: 60_000,
    });
    expect(policy.cohorts).toHaveLength(1);
    expect(policy.cohorts[0].id).toBe("pilot");
    expect(policy.max_rollback_mttr_ms).toBe(60_000);
  });
});

describe("evaluateCanaryDecision", () => {
  it("promotes when metrics are within thresholds", () => {
    expect(
      evaluateCanaryDecision(
        { error_rate: 0.005, p95_latency_ms: 100, baseline_p95_latency_ms: 100 },
        getDefaultRolloutPolicy()
      )
    ).toBe("promote");
  });

  it("aborts when error rate exceeds abort threshold", () => {
    expect(
      evaluateCanaryDecision(
        { error_rate: 0.1, p95_latency_ms: 100, baseline_p95_latency_ms: 100 },
        getDefaultRolloutPolicy()
      )
    ).toBe("abort");
  });

  it("aborts when latency ratio exceeds threshold", () => {
    expect(
      evaluateCanaryDecision(
        { error_rate: 0.001, p95_latency_ms: 200, baseline_p95_latency_ms: 100 },
        getDefaultRolloutPolicy()
      )
    ).toBe("abort");
  });
});

describe("loadRolloutPolicyFromEnv", () => {
  const originalJson = process.env.ROLLOUT_POLICY_JSON;

  beforeEach(() => {
    resetRolloutPolicyCacheForTest();
  });

  afterEach(() => {
    resetRolloutPolicyCacheForTest();
    if (originalJson === undefined) delete process.env.ROLLOUT_POLICY_JSON;
    else process.env.ROLLOUT_POLICY_JSON = originalJson;
  });

  it("loads policy from ROLLOUT_POLICY_JSON", () => {
    process.env.ROLLOUT_POLICY_JSON = JSON.stringify({
      max_rollback_mttr_ms: 90_000,
      canary: { observation_window_minutes: 20 },
    });
    const policy = loadRolloutPolicyFromEnv();
    expect(policy.max_rollback_mttr_ms).toBe(90_000);
    expect(policy.canary.observation_window_minutes).toBe(20);
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

describe("assertProductionReleaseMetadataWhenRollout", () => {
  it("no-ops when not production", () => {
    expect(() =>
      assertProductionReleaseMetadataWhenRollout({
        env: "dev",
        flags: { platform_production_rollout_enabled: true },
        release: {},
      })
    ).not.toThrow();
  });

  it("no-ops when production but rollout disabled", () => {
    expect(() =>
      assertProductionReleaseMetadataWhenRollout({
        env: "production",
        flags: { platform_production_rollout_enabled: false },
        release: {},
      })
    ).not.toThrow();
  });

  it("throws when production rollout enabled and no release metadata", () => {
    expect(() =>
      assertProductionReleaseMetadataWhenRollout({
        env: "production",
        flags: { platform_production_rollout_enabled: true },
        release: {},
      })
    ).toThrow("RELEASE_ID or BUILD_ID");
  });

  it("allows release_id only", () => {
    expect(() =>
      assertProductionReleaseMetadataWhenRollout({
        env: "production",
        flags: { platform_production_rollout_enabled: true },
        release: { release_id: "rel-1" },
      })
    ).not.toThrow();
  });
});

describe("production rollout kill-switch helpers", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("blocks only in production when flag is off", () => {
    process.env.NODE_ENV = "production";
    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "false";
    expect(isProductionRolloutTrafficBlocked(loadConfigFromEnv())).toBe(true);

    process.env.NODE_ENV = "development";
    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "false";
    expect(isProductionRolloutTrafficBlocked(loadConfigFromEnv())).toBe(false);

    process.env.NODE_ENV = "production";
    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "true";
    expect(isProductionRolloutTrafficBlocked(loadConfigFromEnv())).toBe(false);
  });

  it("returns stable POLICY_BLOCKED envelope", () => {
    const body = productionRolloutDisabledResponse();
    expect(body.error.code).toBe("POLICY_BLOCKED");
    expect(body.status).toBe("error");
  });
});

describe("assertProductionRolloutCanarySignoff", () => {
  const originalSignoff = process.env.ROLLOUT_CANARY_SIGNOFF;

  afterEach(() => {
    if (originalSignoff === undefined) delete process.env.ROLLOUT_CANARY_SIGNOFF;
    else process.env.ROLLOUT_CANARY_SIGNOFF = originalSignoff;
  });

  it("no-ops when rollout disabled", () => {
    delete process.env.ROLLOUT_CANARY_SIGNOFF;
    expect(() =>
      assertProductionRolloutCanarySignoff({
        env: "production",
        flags: { platform_production_rollout_enabled: false },
      })
    ).not.toThrow();
  });

  it("throws when rollout enabled without signoff", () => {
    delete process.env.ROLLOUT_CANARY_SIGNOFF;
    expect(() =>
      assertProductionRolloutCanarySignoff({
        env: "production",
        flags: { platform_production_rollout_enabled: true },
      })
    ).toThrow(/ROLLOUT_CANARY_SIGNOFF=true/);
  });

  it("allows when signoff is true", () => {
    process.env.ROLLOUT_CANARY_SIGNOFF = "true";
    expect(() =>
      assertProductionRolloutCanarySignoff({
        env: "production",
        flags: { platform_production_rollout_enabled: true },
      })
    ).not.toThrow();
    expect(isRolloutCanarySignoffAcknowledged()).toBe(true);
  });
});
