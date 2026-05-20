/**
 * Tenant budget tests – cross-request cost cap (L2-03 shared budget counters).
 */

import {
  checkTenantBudget,
  hasDurableTenantBudgetBackend,
  IoredisTenantBudgetBackend,
  recordTenantUsage,
  resetTenantBudgets,
  setTenantBudgetBackendForTest,
  type TenantBudgetRedisClient,
} from "./tenant-budget.js";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("tenant-budget", () => {
  beforeEach(async () => {
    await resetTenantBudgets();
    delete process.env.TENANT_COST_CAP_USD_PER_HOUR;
    delete process.env.TENANT_BUDGET_STORE_PATH;
    delete process.env.TENANT_BUDGET_POSTGRES_URL;
    delete process.env.TENANT_BUDGET_POSTGRES_TABLE;
    delete process.env.TENANT_BUDGET_REDIS_REST_URL;
    delete process.env.TENANT_BUDGET_REDIS_REST_TOKEN;
    delete process.env.REDIS_URL;
  });

  it("allows when cap is unset (0)", async () => {
    await expect(checkTenantBudget("org1")).resolves.toEqual({ allowed: true });
    await recordTenantUsage("org1", { cost_usd: 1000 });
    await expect(checkTenantBudget("org1")).resolves.toEqual({ allowed: true });
  });

  it("allows when under cap", async () => {
    process.env.TENANT_COST_CAP_USD_PER_HOUR = "10";
    await expect(checkTenantBudget("org1")).resolves.toEqual({ allowed: true });
    await recordTenantUsage("org1", { cost_usd: 3 });
    await expect(checkTenantBudget("org1")).resolves.toEqual({ allowed: true });
    await recordTenantUsage("org1", { cost_usd: 4 });
    await expect(checkTenantBudget("org1")).resolves.toEqual({ allowed: true });
  });

  it("denies when at or over cap", async () => {
    process.env.TENANT_COST_CAP_USD_PER_HOUR = "5";
    await recordTenantUsage("org1", { cost_usd: 2 });
    await recordTenantUsage("org1", { cost_usd: 3 });
    await expect(checkTenantBudget("org1")).resolves.toEqual({ allowed: false });
  });

  it("ignores zero cost_usd", async () => {
    process.env.TENANT_COST_CAP_USD_PER_HOUR = "1";
    await recordTenantUsage("org1", { cost_usd: 0 });
    await recordTenantUsage("org1", { cost_usd: 0 });
    await expect(checkTenantBudget("org1")).resolves.toEqual({ allowed: true });
  });

  it("scopes by org_id", async () => {
    process.env.TENANT_COST_CAP_USD_PER_HOUR = "2";
    await recordTenantUsage("org1", { cost_usd: 3 });
    await expect(checkTenantBudget("org1")).resolves.toEqual({ allowed: false });
    await expect(checkTenantBudget("org2")).resolves.toEqual({ allowed: true });
  });

  it("reports durable backend when REDIS_URL is set", () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    expect(hasDurableTenantBudgetBackend()).toBe(true);
  });

  it("uses redis-backed backend with mock ioredis client", async () => {
    const store = new Map<string, string>();
    const mockClient: TenantBudgetRedisClient = {
      get: (key) => Promise.resolve(store.get(key) ?? null),
      set: (key, value) => {
        store.set(key, value);
        return Promise.resolve();
      },
      del: (key) => {
        store.delete(key);
        return Promise.resolve();
      },
    };
    setTenantBudgetBackendForTest(
      new IoredisTenantBudgetBackend("redis://unused", { testClient: mockClient })
    );
    process.env.TENANT_COST_CAP_USD_PER_HOUR = "5";
    await recordTenantUsage("org1", { cost_usd: 6 });
    await expect(checkTenantBudget("org1")).resolves.toEqual({ allowed: false });
    expect(store.size).toBeGreaterThan(0);
  });

  it("uses file-backed backend when TENANT_BUDGET_STORE_PATH is set", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tenant-budget-"));
    const storePath = join(dir, "budget.json");
    try {
      process.env.TENANT_BUDGET_STORE_PATH = storePath;
      process.env.TENANT_COST_CAP_USD_PER_HOUR = "10";
      await resetTenantBudgets();
      await recordTenantUsage("org1", { cost_usd: 2.5 });
      const serialized = readFileSync(storePath, "utf8");
      expect(serialized).toContain("org1");
      await expect(checkTenantBudget("org1")).resolves.toEqual({ allowed: true });
    } finally {
      await resetTenantBudgets();
      rmSync(dir, { recursive: true, force: true });
      delete process.env.TENANT_BUDGET_STORE_PATH;
    }
  });
});
