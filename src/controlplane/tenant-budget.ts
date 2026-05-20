/**
 * Tenant-level budget tracking – cross-request cost caps per org (L2-03 gap).
 * @see docs/SPEC/09_ResourceManager_Spec.md, L2-03 shared budget counters
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const WINDOW_MS = 60 * 60 * 1000; // 1 hour sliding window

/** Usage entry for sliding window */
interface UsageEntry {
  ts: number;
  cost_usd: number;
}

interface TenantBudgetBackend {
  get(orgId: string): Promise<UsageEntry[]>;
  set(orgId: string, entries: UsageEntry[]): Promise<void>;
  reset(): Promise<void>;
  /** Close pools / handles when backend is swapped (tests, reload). */
  dispose(): Promise<void>;
}

class InMemoryTenantBudgetBackend implements TenantBudgetBackend {
  private readonly usage = new Map<string, UsageEntry[]>();

  get(orgId: string): Promise<UsageEntry[]> {
    return Promise.resolve([...(this.usage.get(orgId) ?? [])]);
  }

  set(orgId: string, entries: UsageEntry[]): Promise<void> {
    if (entries.length === 0) this.usage.delete(orgId);
    else this.usage.set(orgId, entries);
    return Promise.resolve();
  }

  reset(): Promise<void> {
    this.usage.clear();
    return Promise.resolve();
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }
}

class FileTenantBudgetBackend implements TenantBudgetBackend {
  constructor(private readonly storePath: string) {}

  private readAll(): Record<string, UsageEntry[]> {
    if (!existsSync(this.storePath)) return {};
    const raw = readFileSync(this.storePath, "utf8").trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, UsageEntry[]>;
    return parsed ?? {};
  }

  private writeAll(data: Record<string, UsageEntry[]>): void {
    mkdirSync(dirname(this.storePath), { recursive: true });
    writeFileSync(this.storePath, JSON.stringify(data), "utf8");
  }

  get(orgId: string): Promise<UsageEntry[]> {
    return Promise.resolve([...(this.readAll()[orgId] ?? [])]);
  }

  set(orgId: string, entries: UsageEntry[]): Promise<void> {
    const all = this.readAll();
    if (entries.length === 0) delete all[orgId];
    else all[orgId] = entries;
    this.writeAll(all);
    return Promise.resolve();
  }

  reset(): Promise<void> {
    this.writeAll({});
    return Promise.resolve();
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }
}

/** Minimal Redis client for tenant budget (ioredis or test mock). */
export interface TenantBudgetRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

/**
 * Shared Redis tenant budget via REDIS_URL (ioredis).
 * Aligns with memory/rate-limit production wiring (PR-007).
 */
export class IoredisTenantBudgetBackend implements TenantBudgetBackend {
  private client: TenantBudgetRedisClient | null = null;
  private readonly injectedTestClient: TenantBudgetRedisClient | undefined;
  private readonly keyPrefix: string;

  constructor(
    private readonly url: string,
    options?: { testClient?: TenantBudgetRedisClient; keyPrefix?: string }
  ) {
    this.injectedTestClient = options?.testClient;
    this.keyPrefix = options?.keyPrefix ?? "tenant_budget:";
  }

  private async getClient(): Promise<TenantBudgetRedisClient> {
    if (this.injectedTestClient) return this.injectedTestClient;
    if (this.client) return this.client;
    const { Redis } = (await import("ioredis")) as unknown as {
      Redis: new (url: string, options?: Record<string, unknown>) => TenantBudgetRedisClient;
    };
    this.client = new Redis(this.url, { maxRetriesPerRequest: 2 });
    return this.client;
  }

  private key(orgId: string): string {
    return `${this.keyPrefix}${orgId}`;
  }

  async get(orgId: string): Promise<UsageEntry[]> {
    const raw = await (await this.getClient()).get(this.key(orgId));
    if (!raw?.trim()) return [];
    const parsed = JSON.parse(raw) as UsageEntry[];
    return Array.isArray(parsed) ? parsed : [];
  }

  async set(orgId: string, entries: UsageEntry[]): Promise<void> {
    const client = await this.getClient();
    if (entries.length === 0) {
      await client.del(this.key(orgId));
      return;
    }
    await client.set(this.key(orgId), JSON.stringify(entries));
  }

  async reset(): Promise<void> {
    await Promise.resolve();
  }

  dispose(): Promise<void> {
    this.client = null;
    return Promise.resolve();
  }
}

class UpstashRedisTenantBudgetBackend implements TenantBudgetBackend {
  constructor(private readonly baseUrl: string, private readonly token: string) {}

  private async eval(command: string[]): Promise<unknown> {
    const response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/${command.join("/")}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!response.ok) {
      throw new Error(`upstash backend request failed (${response.status})`);
    }
    const payload = (await response.json()) as { result?: unknown };
    return payload.result;
  }

  async get(orgId: string): Promise<UsageEntry[]> {
    const key = `tenant_budget:${orgId}`;
    const value = await this.eval(["GET", key]);
    if (typeof value !== "string" || !value.trim()) return [];
    const parsed = JSON.parse(value) as UsageEntry[];
    return Array.isArray(parsed) ? parsed : [];
  }

  async set(orgId: string, entries: UsageEntry[]): Promise<void> {
    const key = `tenant_budget:${orgId}`;
    if (entries.length === 0) {
      await this.eval(["DEL", key]);
      return;
    }
    await this.eval(["SET", key, JSON.stringify(entries)]);
  }

  async reset(): Promise<void> {
    // Best-effort global reset disabled for shared backends.
    await Promise.resolve();
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }
}

interface PgPoolLike {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  end: () => Promise<void>;
}

/**
 * Durable tenant usage rows for cross-request cost caps (WANT-017 / Architecture §18.3).
 * Requires optional dependency `pg` (`npm install pg`). Connection: **`TENANT_BUDGET_POSTGRES_URL`**.
 */
class PostgresTenantBudgetBackend implements TenantBudgetBackend {
  private pool: PgPoolLike | null = null;
  private readonly initPromise: Promise<void>;
  private readonly tableName: string;

  constructor(
    private readonly connectionString: string,
    tableName = "ai_tenant_budget_usage"
  ) {
    this.tableName = tableName.replace(/[^a-zA-Z0-9_]/g, "_") || "ai_tenant_budget_usage";
    this.initPromise = this.ensureSchema();
  }

  private async ensureSchema(): Promise<void> {
    const pg = (await import("pg")) as { Pool: new (cfg: object) => PgPoolLike };
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

  private async poolReady(): Promise<PgPoolLike> {
    await this.initPromise;
    if (!this.pool) throw new Error("PostgreSQL pool not initialized");
    return this.pool;
  }

  async get(orgId: string): Promise<UsageEntry[]> {
    const pool = await this.poolReady();
    const { rows } = await pool.query(`SELECT entries FROM ${this.tableName} WHERE org_id = $1`, [
      orgId,
    ]);
    const row = rows[0] as { entries?: unknown } | undefined;
    if (!row?.entries) return [];
    const raw = row.entries;
    const parsed = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is UsageEntry =>
        e != null &&
        typeof e === "object" &&
        typeof (e as UsageEntry).ts === "number" &&
        typeof (e as UsageEntry).cost_usd === "number"
    );
  }

  async set(orgId: string, entries: UsageEntry[]): Promise<void> {
    const pool = await this.poolReady();
    if (entries.length === 0) {
      await pool.query(`DELETE FROM ${this.tableName} WHERE org_id = $1`, [orgId]);
      return;
    }
    await pool.query(
      `INSERT INTO ${this.tableName} (org_id, entries, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (org_id) DO UPDATE SET entries = EXCLUDED.entries, updated_at = NOW()`,
      [orgId, JSON.stringify(entries)]
    );
  }

  async reset(): Promise<void> {
    try {
      const pool = await this.poolReady();
      await pool.query(`DELETE FROM ${this.tableName}`);
    } catch {
      /* pool may not exist yet */
    }
  }

  async dispose(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

let backend: TenantBudgetBackend | null = null;

/** True when tenant budget state is shared across instances (PR-007). */
export function hasDurableTenantBudgetBackend(): boolean {
  const upstashUrl = process.env.TENANT_BUDGET_REDIS_REST_URL?.trim();
  const upstashToken = process.env.TENANT_BUDGET_REDIS_REST_TOKEN?.trim();
  return !!(
    process.env.TENANT_BUDGET_POSTGRES_URL?.trim() ||
    (upstashUrl && upstashToken) ||
    process.env.REDIS_URL?.trim()
  );
}

function getBackend(): TenantBudgetBackend {
  if (backend) return backend;
  const filePath = process.env.TENANT_BUDGET_STORE_PATH?.trim();
  const upstashUrl = process.env.TENANT_BUDGET_REDIS_REST_URL?.trim();
  const upstashToken = process.env.TENANT_BUDGET_REDIS_REST_TOKEN?.trim();
  const postgresUrl = process.env.TENANT_BUDGET_POSTGRES_URL?.trim();
  const sharedRedisUrl = process.env.REDIS_URL?.trim();
  if (upstashUrl && upstashToken) {
    console.info("[tenant-budget] backend: upstash-redis");
    backend = new UpstashRedisTenantBudgetBackend(upstashUrl, upstashToken);
    return backend;
  }
  if (postgresUrl) {
    console.info("[tenant-budget] backend: postgres");
    const customTable = process.env.TENANT_BUDGET_POSTGRES_TABLE?.trim();
    backend = new PostgresTenantBudgetBackend(
      postgresUrl,
      customTable && customTable.length > 0 ? customTable : undefined
    );
    return backend;
  }
  if (sharedRedisUrl) {
    console.info("[tenant-budget] backend: redis");
    backend = new IoredisTenantBudgetBackend(sharedRedisUrl);
    return backend;
  }
  if (filePath) {
    console.info("[tenant-budget] backend: file", { path: filePath });
    backend = new FileTenantBudgetBackend(filePath);
    return backend;
  }
  console.warn("[tenant-budget] backend: in-memory (dev only; set REDIS_URL or TENANT_BUDGET_POSTGRES_URL for production)");
  backend = new InMemoryTenantBudgetBackend();
  return backend;
}

/** Cap in USD per org per hour; 0 or unset = disabled */
function getTenantCostCapUsdPerHour(): number {
  const v = process.env.TENANT_COST_CAP_USD_PER_HOUR;
  if (v == null || v === "") return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function prune(orgId: string, now: number): Promise<void> {
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
export async function recordTenantUsage(
  orgId: string,
  usage: { cost_usd?: number; tokens?: number }
): Promise<void> {
  try {
    const cap = getTenantCostCapUsdPerHour();
    if (cap <= 0) return;
    const cost = usage.cost_usd ?? 0;
    if (cost <= 0) return;
    const now = Date.now();
    await prune(orgId, now);
    const list = await getBackend().get(orgId);
    list.push({ ts: now, cost_usd: cost });
    await getBackend().set(orgId, list);
  } catch (err) {
    // Log but don't fail the request - usage recording is best-effort
    // In production, this would emit a metric or log to a monitoring system
    console.error("Failed to record tenant usage (non-blocking):", err instanceof Error ? err.message : String(err));
  }
}

/**
 * Check if tenant is within their hourly cost cap (before allowing request).
 * Returns { allowed: false } when cap is set and current window usage >= cap.
 */
export async function checkTenantBudget(orgId: string): Promise<{ allowed: boolean }> {
  const cap = getTenantCostCapUsdPerHour();
  if (cap <= 0) return { allowed: true };
  const now = Date.now();
  await prune(orgId, now);
  const list = await getBackend().get(orgId);
  const total = list.reduce((s, e) => s + e.cost_usd, 0);
  return { allowed: total < cap };
}

/** Test-only: replace backend without reading env. */
export function setTenantBudgetBackendForTest(next: TenantBudgetBackend | null): void {
  backend = next;
}

/** Reset tenant usage and release backend resources (for tests). */
export async function resetTenantBudgets(): Promise<void> {
  const current = backend;
  backend = null;
  if (!current) return;
  try {
    await current.reset();
  } finally {
    await current.dispose();
  }
}
