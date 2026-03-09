/**
 * Tenant-level budget tracking – cross-request cost caps per org (L2-03 gap).
 * @see docs/SPEC/09_ResourceManager_Spec.md, L2-03 shared budget counters
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
const WINDOW_MS = 60 * 60 * 1000; // 1 hour sliding window
class InMemoryTenantBudgetBackend {
    usage = new Map();
    async get(orgId) {
        return [...(this.usage.get(orgId) ?? [])];
    }
    async set(orgId, entries) {
        if (entries.length === 0)
            this.usage.delete(orgId);
        else
            this.usage.set(orgId, entries);
    }
    async reset() {
        this.usage.clear();
    }
}
class FileTenantBudgetBackend {
    storePath;
    constructor(storePath) {
        this.storePath = storePath;
    }
    readAll() {
        if (!existsSync(this.storePath))
            return {};
        const raw = readFileSync(this.storePath, "utf8").trim();
        if (!raw)
            return {};
        const parsed = JSON.parse(raw);
        return parsed ?? {};
    }
    writeAll(data) {
        mkdirSync(dirname(this.storePath), { recursive: true });
        writeFileSync(this.storePath, JSON.stringify(data), "utf8");
    }
    async get(orgId) {
        return [...(this.readAll()[orgId] ?? [])];
    }
    async set(orgId, entries) {
        const all = this.readAll();
        if (entries.length === 0)
            delete all[orgId];
        else
            all[orgId] = entries;
        this.writeAll(all);
    }
    async reset() {
        this.writeAll({});
    }
}
class UpstashRedisTenantBudgetBackend {
    baseUrl;
    token;
    constructor(baseUrl, token) {
        this.baseUrl = baseUrl;
        this.token = token;
    }
    async eval(command) {
        const response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/${command.join("/")}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${this.token}` },
        });
        if (!response.ok) {
            throw new Error(`upstash backend request failed (${response.status})`);
        }
        const payload = (await response.json());
        return payload.result;
    }
    async get(orgId) {
        const key = `tenant_budget:${orgId}`;
        const value = await this.eval(["GET", key]);
        if (typeof value !== "string" || !value.trim())
            return [];
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    }
    async set(orgId, entries) {
        const key = `tenant_budget:${orgId}`;
        if (entries.length === 0) {
            await this.eval(["DEL", key]);
            return;
        }
        await this.eval(["SET", key, JSON.stringify(entries)]);
    }
    async reset() {
        // Best-effort global reset disabled for shared backends.
        await Promise.resolve();
    }
}
let backend = null;
function getBackend() {
    if (backend)
        return backend;
    const filePath = process.env.TENANT_BUDGET_STORE_PATH?.trim();
    const redisUrl = process.env.TENANT_BUDGET_REDIS_REST_URL?.trim();
    const redisToken = process.env.TENANT_BUDGET_REDIS_REST_TOKEN?.trim();
    if (redisUrl && redisToken) {
        backend = new UpstashRedisTenantBudgetBackend(redisUrl, redisToken);
        return backend;
    }
    backend = filePath ? new FileTenantBudgetBackend(filePath) : new InMemoryTenantBudgetBackend();
    return backend;
}
/** Cap in USD per org per hour; 0 or unset = disabled */
function getTenantCostCapUsdPerHour() {
    const v = process.env.TENANT_COST_CAP_USD_PER_HOUR;
    if (v == null || v === "")
        return 0;
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
}
async function prune(orgId, now) {
    const list = await getBackend().get(orgId);
    const cutoff = now - WINDOW_MS;
    const kept = list.filter((e) => e.ts > cutoff);
    await getBackend().set(orgId, kept);
}
/**
 * Record usage for a tenant (call after request completes).
 * Used for cross-request tenant cost caps.
 * PRODUCTION: Wrapped in try/catch to prevent audit failures from failing requests.
 */
export async function recordTenantUsage(orgId, usage) {
    try {
        const cap = getTenantCostCapUsdPerHour();
        if (cap <= 0)
            return;
        const cost = usage.cost_usd ?? 0;
        if (cost <= 0)
            return;
        const now = Date.now();
        await prune(orgId, now);
        const list = await getBackend().get(orgId);
        list.push({ ts: now, cost_usd: cost });
        await getBackend().set(orgId, list);
    }
    catch (err) {
        // Log but don't fail the request - usage recording is best-effort
        // In production, this would emit a metric or log to a monitoring system
        console.error("Failed to record tenant usage (non-blocking):", err instanceof Error ? err.message : String(err));
    }
}
/**
 * Check if tenant is within their hourly cost cap (before allowing request).
 * Returns { allowed: false } when cap is set and current window usage >= cap.
 */
export async function checkTenantBudget(orgId) {
    const cap = getTenantCostCapUsdPerHour();
    if (cap <= 0)
        return { allowed: true };
    const now = Date.now();
    await prune(orgId, now);
    const list = await getBackend().get(orgId);
    const total = list.reduce((s, e) => s + e.cost_usd, 0);
    return { allowed: total < cap };
}
/** Reset tenant usage (for tests). */
export function resetTenantBudgets() {
    const current = backend;
    backend = null;
    if (current) {
        void current.reset();
    }
}
//# sourceMappingURL=tenant-budget.js.map