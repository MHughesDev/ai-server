/**
 * Tenant-level budget tracking – cross-request cost caps per org (L2-03 gap).
 * @see docs/SPEC/09_ResourceManager_Spec.md, L2-03 shared budget counters
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
const WINDOW_MS = 60 * 60 * 1000; // 1 hour sliding window
class InMemoryTenantBudgetBackend {
    usage = new Map();
    get(orgId) {
        return Promise.resolve([...(this.usage.get(orgId) ?? [])]);
    }
    set(orgId, entries) {
        if (entries.length === 0)
            this.usage.delete(orgId);
        else
            this.usage.set(orgId, entries);
        return Promise.resolve();
    }
    reset() {
        this.usage.clear();
        return Promise.resolve();
    }
    dispose() {
        return Promise.resolve();
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
    get(orgId) {
        return Promise.resolve([...(this.readAll()[orgId] ?? [])]);
    }
    set(orgId, entries) {
        const all = this.readAll();
        if (entries.length === 0)
            delete all[orgId];
        else
            all[orgId] = entries;
        this.writeAll(all);
        return Promise.resolve();
    }
    reset() {
        this.writeAll({});
        return Promise.resolve();
    }
    dispose() {
        return Promise.resolve();
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
    dispose() {
        return Promise.resolve();
    }
}
/**
 * Durable tenant usage rows for cross-request cost caps (WANT-017 / Architecture §18.3).
 * Requires optional dependency `pg` (`npm install pg`). Connection: **`TENANT_BUDGET_POSTGRES_URL`**.
 */
class PostgresTenantBudgetBackend {
    connectionString;
    pool = null;
    initPromise;
    tableName;
    constructor(connectionString, tableName = "ai_tenant_budget_usage") {
        this.connectionString = connectionString;
        this.tableName = tableName.replace(/[^a-zA-Z0-9_]/g, "_") || "ai_tenant_budget_usage";
        this.initPromise = this.ensureSchema();
    }
    async ensureSchema() {
        const pg = (await import("pg"));
        this.pool = new pg.Pool({
            connectionString: this.connectionString,
            max: 5,
        });
        await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        org_id TEXT PRIMARY KEY,
        entries JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    }
    async poolReady() {
        await this.initPromise;
        if (!this.pool)
            throw new Error("PostgreSQL pool not initialized");
        return this.pool;
    }
    async get(orgId) {
        const pool = await this.poolReady();
        const { rows } = await pool.query(`SELECT entries FROM ${this.tableName} WHERE org_id = $1`, [
            orgId,
        ]);
        const row = rows[0];
        if (!row?.entries)
            return [];
        const raw = row.entries;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!Array.isArray(parsed))
            return [];
        return parsed.filter((e) => e != null &&
            typeof e === "object" &&
            typeof e.ts === "number" &&
            typeof e.cost_usd === "number");
    }
    async set(orgId, entries) {
        const pool = await this.poolReady();
        if (entries.length === 0) {
            await pool.query(`DELETE FROM ${this.tableName} WHERE org_id = $1`, [orgId]);
            return;
        }
        await pool.query(`INSERT INTO ${this.tableName} (org_id, entries, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (org_id) DO UPDATE SET entries = EXCLUDED.entries, updated_at = NOW()`, [orgId, JSON.stringify(entries)]);
    }
    async reset() {
        try {
            const pool = await this.poolReady();
            await pool.query(`DELETE FROM ${this.tableName}`);
        }
        catch {
            /* pool may not exist yet */
        }
    }
    async dispose() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
        }
    }
}
let backend = null;
function getBackend() {
    if (backend)
        return backend;
    const filePath = process.env.TENANT_BUDGET_STORE_PATH?.trim();
    const redisUrl = process.env.TENANT_BUDGET_REDIS_REST_URL?.trim();
    const redisToken = process.env.TENANT_BUDGET_REDIS_REST_TOKEN?.trim();
    const postgresUrl = process.env.TENANT_BUDGET_POSTGRES_URL?.trim();
    if (redisUrl && redisToken) {
        backend = new UpstashRedisTenantBudgetBackend(redisUrl, redisToken);
        return backend;
    }
    if (postgresUrl) {
        const customTable = process.env.TENANT_BUDGET_POSTGRES_TABLE?.trim();
        backend = new PostgresTenantBudgetBackend(postgresUrl, customTable && customTable.length > 0 ? customTable : undefined);
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
/** Reset tenant usage and release backend resources (for tests). */
export async function resetTenantBudgets() {
    const current = backend;
    backend = null;
    if (!current)
        return;
    try {
        await current.reset();
    }
    finally {
        await current.dispose();
    }
}
//# sourceMappingURL=tenant-budget.js.map