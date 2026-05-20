/**
 * Canary cohort assignment tests (PR-031).
 */

import {
  DEFAULT_CANARY_COHORTS,
  resolveCanaryCohort,
  stableTrafficBucket,
} from "./cohorts.js";

describe("canary cohorts (PR-031)", () => {
  it("assigns internal orgs to internal cohort", () => {
    const r = resolveCanaryCohort(
      { org_id: "internal", app_id: "a", user_id: "u" },
      DEFAULT_CANARY_COHORTS
    );
    expect(r.cohort_id).toBe("internal");
    expect(r.stage).toBe("internal");
  });

  it("returns stable when no active cohort and no explicit match", () => {
    const r = resolveCanaryCohort(
      { org_id: "customer-1", app_id: "a", user_id: "u" },
      DEFAULT_CANARY_COHORTS
    );
    expect(r.cohort_id).toBe("stable");
  });

  it("assigns percent traffic when active cohort is low_risk", () => {
    const scope = { org_id: "customer-1", app_id: "app", user_id: "user" };
    const bucket = stableTrafficBucket(scope);
    const r = resolveCanaryCohort(scope, DEFAULT_CANARY_COHORTS, "low_risk");
    if (bucket < 10) {
      expect(r.cohort_id).toBe("low_risk");
    } else {
      expect(r.cohort_id).toBe("stable");
    }
  });

  it("stableTrafficBucket is deterministic", () => {
    const scope = { org_id: "o", app_id: "a", user_id: "u" };
    expect(stableTrafficBucket(scope)).toBe(stableTrafficBucket(scope));
  });
});
