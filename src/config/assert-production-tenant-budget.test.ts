/**
 * Production tenant budget assertion tests (PR-007).
 */

import { assertProductionTenantBudget } from "./assert-production-tenant-budget.js";
import { loadConfigFromEnv } from "./schema.js";

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

function productionConfig() {
  process.env.NODE_ENV = "production";
  return loadConfigFromEnv();
}

describe("assertProductionTenantBudget", () => {
  it("allows REDIS_URL", () => {
    process.env.REDIS_URL = "redis://redis:6379";
    expect(() => assertProductionTenantBudget(productionConfig())).not.toThrow();
  });

  it("allows TENANT_BUDGET_POSTGRES_URL", () => {
    delete process.env.REDIS_URL;
    process.env.TENANT_BUDGET_POSTGRES_URL = "postgres://localhost/db";
    expect(() => assertProductionTenantBudget(productionConfig())).not.toThrow();
  });

  it("throws when only in-memory backend would be used", () => {
    delete process.env.REDIS_URL;
    delete process.env.TENANT_BUDGET_POSTGRES_URL;
    delete process.env.TENANT_BUDGET_REDIS_REST_URL;
    delete process.env.TENANT_BUDGET_REDIS_REST_TOKEN;
    expect(() => assertProductionTenantBudget(productionConfig())).toThrow(
      /shared tenant budget backend/
    );
  });

  it("skips in non-production", () => {
    process.env.NODE_ENV = "development";
    expect(() => assertProductionTenantBudget(loadConfigFromEnv())).not.toThrow();
  });
});
