/**
 * pgvector Vector Store Adapter
 * Gap 3B: Vector Embeddings Integration
 * PostgreSQL extension for vector storage
 */

import type {
  VectorStore,
  VectorStoreConfig,
  VectorDocument,
  VectorSearchResult,
} from "../vector-store.js";

export class PgVectorAdapter implements VectorStore {
  private config: VectorStoreConfig;
  private pool: unknown | null = null;
  private tableName: string;

  constructor(config: VectorStoreConfig) {
    this.config = config;
    this.tableName = config.pgTableName ?? "ai_vectors";
  }

  async initialize(): Promise<void> {
    if (!this.config.pgConnectionString) {
      throw new Error("pgvector adapter requires pgConnectionString");
    }

    try {
      const { Pool } = await import("pg");
      this.pool = new Pool({
        connectionString: this.config.pgConnectionString,
      });

      // Ensure pgvector extension is installed
      const pool = this.pool as { query: (sql: string) => Promise<void> };
      await pool.query("CREATE EXTENSION IF NOT EXISTS vector");

      // Create table if not exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          embedding vector(${this.config.dimensions}),
          org_id TEXT,
          app_id TEXT,
          user_id TEXT,
          session_id TEXT,
          timestamp TEXT NOT NULL,
          metadata JSONB
        )
      `);

      // Create indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_embedding 
        ON ${this.tableName} USING ivfflat (embedding vector_cosine_ops)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_org 
        ON ${this.tableName}(org_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_app 
        ON ${this.tableName}(app_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_user 
        ON ${this.tableName}(user_id)
      `);

      console.log("[vector-store] pgvector adapter initialized");
    } catch (err) {
      throw new Error(
        `Failed to initialize pgvector client: ${err instanceof Error ? err.message : String(err)}. ` +
          "Ensure pg is installed: npm install pg, and pgvector extension is available in PostgreSQL"
      );
    }
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    if (!this.pool) {
      throw new Error("pgvector pool not initialized");
    }

    const pool = this.pool as { query: (sql: string, params: unknown[]) => Promise<void> };

    for (const doc of documents) {
      const vectorLiteral = `[${doc.vector.join(",")}]`;
      await pool.query(
        `
        INSERT INTO ${this.tableName} (id, content, embedding, org_id, app_id, user_id, session_id, timestamp, metadata)
        VALUES ($1, $2, $3::vector, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          org_id = EXCLUDED.org_id,
          app_id = EXCLUDED.app_id,
          user_id = EXCLUDED.user_id,
          session_id = EXCLUDED.session_id,
          timestamp = EXCLUDED.timestamp,
          metadata = EXCLUDED.metadata
      `,
        [
          doc.id,
          doc.content,
          vectorLiteral,
          doc.metadata?.org_id ?? null,
          doc.metadata?.app_id ?? null,
          doc.metadata?.user_id ?? null,
          doc.metadata?.session_id ?? null,
          doc.metadata?.timestamp ?? new Date().toISOString(),
          JSON.stringify(doc.metadata ?? {}),
        ]
      );
    }
  }

  async search(
    queryVector: number[],
    options: {
      topK: number;
      filter?: {
        org_id?: string;
        app_id?: string;
        user_id?: string;
        session_id?: string;
      };
    }
  ): Promise<VectorSearchResult[]> {
    if (!this.pool) {
      throw new Error("pgvector pool not initialized");
    }

    const pool = this.pool as {
      query: (sql: string, params: unknown[]) => Promise<{ rows: Array<{ id: string; content: string; embedding: string; org_id: string | null; app_id: string | null; user_id: string | null; session_id: string | null; timestamp: string; metadata: Record<string, unknown>; distance: number }> }>;
    };

    const vectorLiteral = `[${queryVector.join(",")}]`;

    let whereClause = "WHERE 1=1";
    const params: unknown[] = [vectorLiteral, options.topK];
    let paramIdx = 3;

    if (options.filter?.org_id) {
      whereClause += ` AND org_id = $${paramIdx++}`;
      params.push(options.filter.org_id);
    }
    if (options.filter?.app_id) {
      whereClause += ` AND app_id = $${paramIdx++}`;
      params.push(options.filter.app_id);
    }
    if (options.filter?.user_id) {
      whereClause += ` AND user_id = $${paramIdx++}`;
      params.push(options.filter.user_id);
    }

    const result = await pool.query(
      `
      SELECT 
        id, content, embedding, org_id, app_id, user_id, session_id, timestamp, metadata,
        embedding <=> $1::vector as distance
      FROM ${this.tableName}
      ${whereClause}
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `,
      params
    );

    return result.rows.map(row => ({
      document: {
        id: row.id,
        vector: JSON.parse(row.embedding.replace(/\[|\]/g, "").split(",").map(Number) as unknown as string),
        content: row.content,
        metadata: {
          org_id: row.org_id ?? undefined,
          app_id: row.app_id ?? undefined,
          user_id: row.user_id ?? undefined,
          session_id: row.session_id ?? undefined,
          timestamp: row.timestamp,
          ...row.metadata,
        },
      },
      score: 1 - row.distance,
      distance: row.distance,
    }));
  }

  async delete(ids: string[]): Promise<void> {
    if (!this.pool) {
      throw new Error("pgvector pool not initialized");
    }

    const pool = this.pool as { query: (sql: string, params: unknown[]) => Promise<void> };
    await pool.query(`DELETE FROM ${this.tableName} WHERE id = ANY($1)`, [ids]);
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      if (!this.pool) {
        return { healthy: false, latencyMs: 0, error: "Pool not initialized" };
      }
      const pool = this.pool as { query: (sql: string) => Promise<unknown> };
      await pool.query("SELECT 1");
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      const pool = this.pool as { end: () => Promise<void> };
      await pool.end();
      this.pool = null;
    }
  }
}
