/**
 * Tenant budget tests – cross-request cost cap (L2-03 shared budget counters).
 */

import {
  checkTenantBudget,
  recordTenantUsage,
  resetTenantBudgets,
} from "./tenant-budget.js";

describe("tenant-budget", () => {
  beforeEach(() => {
    resetTenantBudgets();
    delete process.env.TENANT_COST_CAP_USD_PER_HOUR;
  });

  it("allows when cap is unset (0)", () => {
    expect(checkTenantBudget("org1").allowed).toBe(true);
    recordTenantUsage("org1", { cost_usd: 1000 });
    expect(checkTenantBudget("org1").allowed).toBe(true);
  });

  it("allows when under cap", () => {
    process.env.TENANT_COST_CAP_USD_PER_HOUR = "10";
    expect(checkTenantBudget("org1").allowed).toBe(true);
    recordTenantUsage("org1", { cost_usd: 3 });
    expect(checkTenantBudget("org1").allowed).toBe(true);
    recordTenantUsage("org1", { cost_usd: 4 });
    expect(checkTenantBudget("org1").allowed).toBe(true);
  });

  it("denies when at or over cap", () => {
    process.env.TENANT_COST_CAP_USD_PER_HOUR = "5";
    recordTenantUsage("org1", { cost_usd: 2 });
    recordTenantUsage("org1", { cost_usd: 3 });
    expect(checkTenantBudget("org1").allowed).toBe(false);
  });

  it("ignores zero cost_usd", () => {
    process.env.TENANT_COST_CAP_USD_PER_HOUR = "1";
    recordTenantUsage("org1", { cost_usd: 0 });
    recordTenantUsage("org1", { cost_usd: 0 });
    expect(checkTenantBudget("org1").allowed).toBe(true);
  });

  it("scopes by org_id", () => {
    process.env.TENANT_COST_CAP_USD_PER_HOUR = "2";
    recordTenantUsage("org1", { cost_usd: 3 });
    expect(checkTenantBudget("org1").allowed).toBe(false);
    expect(checkTenantBudget("org2").allowed).toBe(true);
  });
});
