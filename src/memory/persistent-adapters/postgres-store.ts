/**
 * PostgreSQL Persistent Store Adapter
 * Gap 3C: Persistent Memory Configuration
 * SQL-based persistence with connection pooling
 */

import type {
  PersistentMemoryStore,
  PersistentMemoryConfig,
} from "../persistent-store.js";
import type { RetrievalChunk, StructuredRecord, ObjectBlob } from "../types.js";

interface PgPool {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  end: () => Promise<void>;
}

export class PostgresPersistentStore implements PersistentMemoryStore {
  private pool: PgPool | null = null;
  private config: NonNullable<PersistentMemoryConfig["postgres"]>;
  private tablePrefix: string;

  constructor(config: PersistentMemoryConfig["postgres"]) {
    this.config = {
      connectionString: config?.connectionString ?? "postgresql://localhost:5432/aidb",
      tablePrefix: config?.tablePrefix ?? "ai_",
      poolSize: config?.poolSize ?? 10,
    };
    this.tablePrefix = this.config.tablePrefix!;
  }

  async initialize(): Promise<void> {
    try {
      const { Pool } = await import("pg");
      this.pool = new Pool({
        connectionString: this.config.connectionString,
        max: this.config.poolSize,
      }) as PgPool;

      // Create tables if not exists
      await this.createTables();

      console.log("[postgres-store] PostgreSQL persistent store initialized");
    } catch (err) {
      throw new Error(
        `Failed to initialize PostgreSQL client: ${err instanceof Error ? err.message : String(err)}. ` +
          "Ensure pg is installed: npm install pg"
      );
    }
  }

  private async createTables(): Promise<void> {
    if (!this.pool) throw new Error("Pool not initialized");

    // Chunks table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}chunks (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        org_id TEXT,
        app_id TEXT,
        user_id TEXT,
        session_id TEXT,
        document_id TEXT NOT NULL,
        scope TEXT NOT NULL,
        position INTEGER,
        source_label TEXT,
        embedding JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE
      )
    `);

    // Records table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}records (
        key TEXT NOT NULL,
        scope TEXT NOT NULL,
        org_id TEXT,
        app_id TEXT,
        user_id TEXT,
        value JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE,
        PRIMARY KEY (key, org_id, app_id, user_id)
      )
    `);

    // Blobs table (stores up to 1MB - larger blobs should use S3)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}blobs (
        id TEXT NOT NULL,
        scope TEXT NOT NULL,
        org_id TEXT,
        app_id TEXT,
        user_id TEXT,
        content BYTEA NOT NULL,
        content_type TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE,
        PRIMARY KEY (id, org_id, app_id, user_id)
      )
    `);

    // Indexes
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_${this.tablePrefix}chunks_org ON ${this.tablePrefix}chunks(org_id)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_${this.tablePrefix}chunks_app ON ${this.tablePrefix}chunks(app_id)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_${this.tablePrefix}chunks_document ON ${this.tablePrefix}chunks(document_id)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_${this.tablePrefix}chunks_expires ON ${this.tablePrefix}chunks(expires_at)`);
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      if (!this.pool) {
        return { healthy: false, latencyMs: 0, error: "Pool not initialized" };
      }
      await this.pool.query("SELECT 1");
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async storeChunks(chunks: RetrievalChunk[]): Promise<void> {
    if (!this.pool) throw new Error("Pool not initialized");

    for (const chunk of chunks) {
      await this.pool.query(
        `
        INSERT INTO ${this.tablePrefix}chunks 
        (id, text, org_id, app_id, user_id, session_id, document_id, scope, position, source_label, embedding, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW() + INTERVAL '24 hours')
        ON CONFLICT (id) DO UPDATE SET
          text = EXCLUDED.text,
          embedding = EXCLUDED.embedding,
          expires_at = EXCLUDED.expires_at
      `,
        [
          chunk.metadata.chunk_id,
          chunk.text,
          chunk.metadata.scope_keys.org_id ?? null,
          chunk.metadata.scope_keys.app_id ?? null,
          chunk.metadata.scope_keys.user_id ?? null,
          chunk.metadata.scope_keys.session_id ?? null,
          chunk.metadata.document_id,
          chunk.metadata.scope,
          chunk.metadata.position ?? null,
          chunk.metadata.source_label ?? null,
          chunk.embedding ? JSON.stringify(chunk.embedding) : null,
        ]
      );
    }
  }

  async retrieveChunks(query: {
    scope_keys: Record<string, string>;
    top_k: number;
    filters?: Record<string, unknown>;
  }): Promise<RetrievalChunk[]> {
    if (!this.pool) throw new Error("Pool not initialized");

    let sql = `SELECT * FROM ${this.tablePrefix}chunks WHERE 1=1`;
    const params: unknown[] = [];
    let paramIdx = 1;

    if (query.scope_keys.org_id) {
      sql += ` AND org_id = $${paramIdx++}`;
      params.push(query.scope_keys.org_id);
    }
    if (query.scope_keys.app_id) {
      sql += ` AND app_id = $${paramIdx++}`;
      params.push(query.scope_keys.app_id);
    }
    if (query.scope_keys.user_id) {
      sql += ` AND user_id = $${paramIdx++}`;
      params.push(query.scope_keys.user_id);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIdx++}`;
    params.push(query.top_k);

    const result = await this.pool.query(sql, params);

    return (result.rows as Array<{
      id: string;
      text: string;
      org_id: string | null;
      app_id: string | null;
      user_id: string | null;
      session_id: string | null;
      document_id: string;
      scope: string;
      position: number | null;
      source_label: string | null;
      embedding: string | null;
      created_at: string;
    }>).map(row => ({
      text: row.text,
      metadata: {
        chunk_id: row.id,
        document_id: row.document_id,
        scope: row.scope as RetrievalChunk["metadata"]["scope"],
        scope_keys: {
          ...(row.org_id && { org_id: row.org_id }),
          ...(row.app_id && { app_id: row.app_id }),
          ...(row.user_id && { user_id: row.user_id }),
          ...(row.session_id && { session_id: row.session_id }),
        },
        position: row.position ?? undefined,
        source_label: row.source_label ?? undefined,
        created_at: row.created_at,
      },
      embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
    }));
  }

  async deleteChunks(chunkIds: string[]): Promise<void> {
    if (!this.pool) throw new Error("Pool not initialized");

    await this.pool.query(`DELETE FROM ${this.tablePrefix}chunks WHERE id = ANY($1)`, [chunkIds]);
  }

  async storeRecord(record: StructuredRecord): Promise<void> {
    if (!this.pool) throw new Error("Pool not initialized");

    await this.pool.query(
      `
      INSERT INTO ${this.tablePrefix}records (key, scope, org_id, app_id, user_id, value, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (key, org_id, app_id, user_id) DO UPDATE SET
        value = EXCLUDED.value,
        expires_at = EXCLUDED.expires_at
    `,
      [
        record.key,
        record.scope,
        record.scope_keys.org_id ?? null,
        record.scope_keys.app_id ?? null,
        record.scope_keys.user_id ?? null,
        JSON.stringify(record.value),
        record.expires_at ?? null,
      ]
    );
  }

  async getRecord(key: string, scope_keys: Record<string, string>): Promise<StructuredRecord | null> {
    if (!this.pool) throw new Error("Pool not initialized");

    const result = await this.pool.query(
      `SELECT * FROM ${this.tablePrefix}records WHERE key = $1 AND org_id = $2 AND app_id = $3 AND user_id = $4`,
      [key, scope_keys.org_id ?? null, scope_keys.app_id ?? null, scope_keys.user_id ?? null]
    );

    const row = result.rows[0] as { scope: string; org_id: string | null; app_id: string | null; user_id: string | null; value: string; created_at: string; expires_at: string | null } | undefined;
    if (!row) return null;

    return {
      key,
      scope: row.scope as StructuredRecord["scope"],
      scope_keys: {
        ...(row.org_id && { org_id: row.org_id }),
        ...(row.app_id && { app_id: row.app_id }),
        ...(row.user_id && { user_id: row.user_id }),
      },
      value: JSON.parse(row.value),
      created_at: row.created_at,
      expires_at: row.expires_at ?? undefined,
    };
  }

  async deleteRecord(key: string, scope_keys: Record<string, string>): Promise<void> {
    if (!this.pool) throw new Error("Pool not initialized");

    await this.pool.query(
      `DELETE FROM ${this.tablePrefix}records WHERE key = $1 AND org_id = $2 AND app_id = $3 AND user_id = $4`,
      [key, scope_keys.org_id ?? null, scope_keys.app_id ?? null, scope_keys.user_id ?? null]
    );
  }

  async queryRecords(query: {
    prefix?: string;
    scope_keys: Record<string, string>;
  }): Promise<StructuredRecord[]> {
    if (!this.pool) throw new Error("Pool not initialized");

    let sql = `SELECT * FROM ${this.tablePrefix}records WHERE org_id = $1 AND app_id = $2 AND user_id = $3`;
    const params: unknown[] = [
      query.scope_keys.org_id ?? null,
      query.scope_keys.app_id ?? null,
      query.scope_keys.user_id ?? null,
    ];

    if (query.prefix) {
      sql += ` AND key LIKE $4`;
      params.push(`${query.prefix}%`);
    }

    const result = await this.pool.query(sql, params);

    return (result.rows as Array<{ key: string; scope: string; org_id: string | null; app_id: string | null; user_id: string | null; value: string; created_at: string; expires_at: string | null }>).map(row => ({
      key: row.key,
      scope: row.scope as StructuredRecord["scope"],
      scope_keys: {
        ...(row.org_id && { org_id: row.org_id }),
        ...(row.app_id && { app_id: row.app_id }),
        ...(row.user_id && { user_id: row.user_id }),
      },
      value: JSON.parse(row.value),
      created_at: row.created_at,
      expires_at: row.expires_at ?? undefined,
    }));
  }

  async storeBlob(blob: ObjectBlob): Promise<void> {
    if (!this.pool) throw new Error("Pool not initialized");

    const content = typeof blob.content === "string" ? Buffer.from(blob.content) : Buffer.from(blob.content);

    await this.pool.query(
      `
      INSERT INTO ${this.tablePrefix}blobs (id, scope, org_id, app_id, user_id, content, content_type, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id, org_id, app_id, user_id) DO UPDATE SET
        content = EXCLUDED.content,
        content_type = EXCLUDED.content_type,
        expires_at = EXCLUDED.expires_at
    `,
      [
        blob.id,
        blob.scope,
        blob.scope_keys.org_id ?? null,
        blob.scope_keys.app_id ?? null,
        blob.scope_keys.user_id ?? null,
        content,
        blob.content_type ?? null,
        blob.expires_at ?? null,
      ]
    );
  }

  async getBlob(id: string, scope_keys: Record<string, string>): Promise<ObjectBlob | null> {
    if (!this.pool) throw new Error("Pool not initialized");

    const result = await this.pool.query(
      `SELECT * FROM ${this.tablePrefix}blobs WHERE id = $1 AND org_id = $2 AND app_id = $3 AND user_id = $4`,
      [id, scope_keys.org_id ?? null, scope_keys.app_id ?? null, scope_keys.user_id ?? null]
    );

    const row = result.rows[0] as { scope: string; org_id: string | null; app_id: string | null; user_id: string | null; content: Buffer; content_type: string | null; created_at: string; expires_at: string | null } | undefined;
    if (!row) return null;

    return {
      id,
      scope: row.scope as ObjectBlob["scope"],
      scope_keys: {
        ...(row.org_id && { org_id: row.org_id }),
        ...(row.app_id && { app_id: row.app_id }),
        ...(row.user_id && { user_id: row.user_id }),
      },
      content: row.content,
      content_type: row.content_type ?? undefined,
      created_at: row.created_at,
      expires_at: row.expires_at ?? undefined,
    };
  }

  async deleteBlob(id: string, scope_keys: Record<string, string>): Promise<void> {
    if (!this.pool) throw new Error("Pool not initialized");

    await this.pool.query(
      `DELETE FROM ${this.tablePrefix}blobs WHERE id = $1 AND org_id = $2 AND app_id = $3 AND user_id = $4`,
      [id, scope_keys.org_id ?? null, scope_keys.app_id ?? null, scope_keys.user_id ?? null]
    );
  }

  async setTTL(key: string, ttlSeconds: number): Promise<void> {
    if (!this.pool) throw new Error("Pool not initialized");

    // Update TTL on all tables
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    await this.pool.query(
      `UPDATE ${this.tablePrefix}chunks SET expires_at = $1 WHERE id = $2`,
      [expiresAt, key]
    );
    await this.pool.query(
      `UPDATE ${this.tablePrefix}records SET expires_at = $1 WHERE key = $2`,
      [expiresAt, key]
    );
    await this.pool.query(
      `UPDATE ${this.tablePrefix}blobs SET expires_at = $1 WHERE id = $2`,
      [expiresAt, key]
    );
  }

  async cleanupExpired(): Promise<number> {
    if (!this.pool) throw new Error("Pool not initialized");

    let deleted = 0;

    const chunksResult = await this.pool.query(
      `DELETE FROM ${this.tablePrefix}chunks WHERE expires_at < NOW() RETURNING id`
    );
    deleted += chunksResult.rows.length;

    const recordsResult = await this.pool.query(
      `DELETE FROM ${this.tablePrefix}records WHERE expires_at < NOW() RETURNING key`
    );
    deleted += recordsResult.rows.length;

    const blobsResult = await this.pool.query(
      `DELETE FROM ${this.tablePrefix}blobs WHERE expires_at < NOW() RETURNING id`
    );
    deleted += blobsResult.rows.length;

    return deleted;
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
