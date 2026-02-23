/**
 * Tenant-level budget tracking – cross-request cost caps per org (L2-03 gap).
 * @see Docs/SPEC/09_ResourceManager_Spec.md, L2-03 shared budget counters
 */

const WINDOW_MS = 60 * 60 * 1000; // 1 hour sliding window

/** Usage entry for sliding window */
interface UsageEntry {
  ts: number;
  cost_usd: number;
}

const tenantUsage = new Map<string, UsageEntry[]>();

/** Cap in USD per org per hour; 0 or unset = disabled */
function getTenantCostCapUsdPerHour(): number {
  const v = process.env.TENANT_COST_CAP_USD_PER_HOUR;
  if (v == null || v === "") return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function prune(orgId: string, now: number): void {
  const list = tenantUsage.get(orgId);
  if (!list) return;
  const cutoff = now - WINDOW_MS;
  const kept = list.filter((e) => e.ts > cutoff);
  if (kept.length === 0) tenantUsage.delete(orgId);
  else tenantUsage.set(orgId, kept);
}

/**
 * Record usage for a tenant (call after request completes).
 * Used for cross-request tenant cost caps.
 */
export function recordTenantUsage(
  orgId: string,
  usage: { cost_usd?: number; tokens?: number }
): void {
  const cap = getTenantCostCapUsdPerHour();
  if (cap <= 0) return;
  const cost = usage.cost_usd ?? 0;
  if (cost <= 0) return;
  const now = Date.now();
  const list = tenantUsage.get(orgId) ?? [];
  list.push({ ts: now, cost_usd: cost });
  tenantUsage.set(orgId, list);
}

/**
 * Check if tenant is within their hourly cost cap (before allowing request).
 * Returns { allowed: false } when cap is set and current window usage >= cap.
 */
export function checkTenantBudget(orgId: string): { allowed: boolean } {
  const cap = getTenantCostCapUsdPerHour();
  if (cap <= 0) return { allowed: true };
  const now = Date.now();
  prune(orgId, now);
  const list = tenantUsage.get(orgId) ?? [];
  const total = list.reduce((s, e) => s + e.cost_usd, 0);
  return { allowed: total < cap };
}

/** Reset tenant usage (for tests). */
export function resetTenantBudgets(): void {
  tenantUsage.clear();
}
