/**
 * Production tenant budget persistence guards (PR-007).
 */

import type { Config } from "./schema.js";
import { hasDurableTenantBudgetBackend } from "../controlplane/tenant-budget.js";

/** Fail fast when production would use process-local tenant budget only. */
export function assertProductionTenantBudget(config: Config): void {
  if (config.env !== "production") return;

  if (hasDurableTenantBudgetBackend()) return;

  throw new Error(
    "Production requires a shared tenant budget backend: TENANT_BUDGET_POSTGRES_URL, TENANT_BUDGET_REDIS_REST_URL+TENANT_BUDGET_REDIS_REST_TOKEN, or REDIS_URL (in-memory/file are single-process only)"
  );
}
