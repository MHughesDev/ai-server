/**
 * MongoDB Persistent Store Adapter
 * Gap 3C: Persistent Memory Configuration
 * Document-based persistence
 */

import type {
  PersistentMemoryStore,
  PersistentMemoryConfig,
} from "../persistent-store.js";
import type { RetrievalChunk, StructuredRecord, ObjectBlob } from "../types.js";

interface MongoClient {
  connect(): Promise<void>;
  close(): Promise<void>;
  db(name: string): {
    collection(name: string): {
      insertOne(doc: unknown): Promise<void>;
      insertMany(docs: unknown[]): Promise<void>;
      findOne(query: unknown): Promise<unknown>;
      find(query: unknown): { toArray(): Promise<unknown[]> };
      updateOne(query: unknown, update: unknown, options?: unknown): Promise<void>;
      deleteOne(query: unknown): Promise<void>;
      deleteMany(query: unknown): Promise<void>;
      createIndex(keys: unknown, options?: unknown): Promise<void>;
    };
  };
}

export class MongoPersistentStore implements PersistentMemoryStore {
  private client: MongoClient | null = null;
  private config: NonNullable<PersistentMemoryConfig["mongodb"]>;
  private dbName: string;
  private collectionPrefix: string;

  constructor(config: PersistentMemoryConfig["mongodb"]) {
    this.config = {
      url: config?.url ?? "mongodb://localhost:27017",
      database: config?.database ?? "ai_server",
      collectionPrefix: config?.collectionPrefix ?? "",
    };
    this.dbName = this.config.database ?? "ai_server";
    this.collectionPrefix = this.config.collectionPrefix ?? "";
  }

  async initialize(): Promise<void> {
    try {
      const { MongoClient } = await import("mongodb");
      this.client = new MongoClient(this.config.url) as unknown as MongoClient;
      await this.client.connect();

      // Create indexes
      const db = this.client.db(this.dbName);
      const chunks = db.collection(`${this.collectionPrefix}chunks`);
      await chunks.createIndex({ org_id: 1, app_id: 1, user_id: 1 });
      await chunks.createIndex({ document_id: 1 });
      await chunks.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });

      console.log("[mongo-store] MongoDB persistent store initialized");
    } catch (err) {
      throw new Error(
        `Failed to initialize MongoDB client: ${err instanceof Error ? err.message : String(err)}. ` +
          "Ensure mongodb is installed: npm install mongodb"
      );
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      if (!this.client) {
        return { healthy: false, latencyMs: 0, error: "Client not initialized" };
      }
      const db = this.client.db(this.dbName);
      await db.collection("health").findOne({});
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
    if (!this.client) throw new Error("Client not initialized");
    const db = this.client.db(this.dbName);
    const collection = db.collection(`${this.collectionPrefix}chunks`);

    const docs = chunks.map(chunk => ({
      _id: chunk.metadata.chunk_id,
      text: chunk.text,
      metadata: chunk.metadata,
      embedding: chunk.embedding,
      org_id: chunk.metadata.scope_keys.org_id ?? null,
      app_id: chunk.metadata.scope_keys.app_id ?? null,
      user_id: chunk.metadata.scope_keys.user_id ?? null,
      document_id: chunk.metadata.document_id,
      created_at: new Date(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }));

    await collection.insertMany(docs);
  }

  async retrieveChunks(query: {
    scope_keys: Record<string, string>;
    top_k: number;
    filters?: Record<string, unknown>;
  }): Promise<RetrievalChunk[]> {
    if (!this.client) throw new Error("Client not initialized");
    const db = this.client.db(this.dbName);
    const collection = db.collection(`${this.collectionPrefix}chunks`);

    const mongoQuery: Record<string, unknown> = {};
    if (query.scope_keys.org_id) mongoQuery.org_id = query.scope_keys.org_id;
    if (query.scope_keys.app_id) mongoQuery.app_id = query.scope_keys.app_id;
    if (query.scope_keys.user_id) mongoQuery.user_id = query.scope_keys.user_id;

    const results = await collection.find(mongoQuery).toArray();

    return results.map((doc: unknown) => {
      const d = doc as { text: string; metadata: RetrievalChunk["metadata"]; embedding?: number[] };
      return {
        text: d.text,
        metadata: d.metadata,
        embedding: d.embedding,
      };
    });
  }

  async deleteChunks(chunkIds: string[]): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");
    const db = this.client.db(this.dbName);
    const collection = db.collection(`${this.collectionPrefix}chunks`);

    await collection.deleteMany({ _id: { $in: chunkIds } });
  }

  async storeRecord(record: StructuredRecord): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");
    const db = this.client.db(this.dbName);
    const collection = db.collection(`${this.collectionPrefix}records`);

    await collection.updateOne(
      {
        key: record.key,
        org_id: record.scope_keys.org_id ?? null,
        app_id: record.scope_keys.app_id ?? null,
        user_id: record.scope_keys.user_id ?? null,
      },
      {
        $set: {
          key: record.key,
          scope: record.scope,
          org_id: record.scope_keys.org_id ?? null,
          app_id: record.scope_keys.app_id ?? null,
          user_id: record.scope_keys.user_id ?? null,
          value: record.value,
          created_at: record.created_at ?? new Date().toISOString(),
          expires_at: record.expires_at ? new Date(record.expires_at) : new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      },
      { upsert: true }
    );
  }

  async getRecord(key: string, scope_keys: Record<string, string>): Promise<StructuredRecord | null> {
    if (!this.client) throw new Error("Client not initialized");
    const db = this.client.db(this.dbName);
    const collection = db.collection(`${this.collectionPrefix}records`);

    const result = await collection.findOne({
      key,
      org_id: scope_keys.org_id ?? null,
      app_id: scope_keys.app_id ?? null,
      user_id: scope_keys.user_id ?? null,
    });

    if (!result) return null;

    const doc = result as { scope: string; org_id: string | null; app_id: string | null; user_id: string | null; value: unknown; created_at: string; expires_at: Date };
    return {
      key,
      scope: doc.scope as StructuredRecord["scope"],
      scope_keys: {
        ...(doc.org_id && { org_id: doc.org_id }),
        ...(doc.app_id && { app_id: doc.app_id }),
        ...(doc.user_id && { user_id: doc.user_id }),
      },
      value: doc.value,
      created_at: doc.created_at,
      expires_at: doc.expires_at.toISOString(),
    };
  }

  async deleteRecord(key: string, scope_keys: Record<string, string>): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");
    const db = this.client.db(this.dbName);
    const collection = db.collection(`${this.collectionPrefix}records`);

    await collection.deleteOne({
      key,
      org_id: scope_keys.org_id ?? null,
      app_id: scope_keys.app_id ?? null,
      user_id: scope_keys.user_id ?? null,
    });
  }

  async queryRecords(query: {
    prefix?: string;
    scope_keys: Record<string, string>;
  }): Promise<StructuredRecord[]> {
    if (!this.client) throw new Error("Client not initialized");
    const db = this.client.db(this.dbName);
    const collection = db.collection(`${this.collectionPrefix}records`);

    const mongoQuery: Record<string, unknown> = {
      org_id: query.scope_keys.org_id ?? null,
      app_id: query.scope_keys.app_id ?? null,
      user_id: query.scope_keys.user_id ?? null,
    };

    if (query.prefix) {
      mongoQuery.key = { $regex: `^${query.prefix}` };
    }

    const results = await collection.find(mongoQuery).toArray();

    return results.map((doc: unknown) => {
      const d = doc as { key: string; scope: string; org_id: string | null; app_id: string | null; user_id: string | null; value: unknown; created_at: string; expires_at: Date };
      return {
        key: d.key,
        scope: d.scope as StructuredRecord["scope"],
        scope_keys: {
          ...(d.org_id && { org_id: d.org_id }),
          ...(d.app_id && { app_id: d.app_id }),
          ...(d.user_id && { user_id: d.user_id }),
        },
        value: d.value,
        created_at: d.created_at,
        expires_at: d.expires_at.toISOString(),
      };
    });
  }

  async storeBlob(blob: ObjectBlob): Promise<void> {
    // MongoDB has 16MB document limit, so use GridFS for larger blobs
    // This is a simplified implementation storing small blobs directly
    if (!this.client) throw new Error("Client not initialized");
    const db = this.client.db(this.dbName);
    const collection = db.collection(`${this.collectionPrefix}blobs`);

    const content = typeof blob.content === "string" ? blob.content : Buffer.from(blob.content).toString("base64");

    await collection.updateOne(
      {
        id: blob.id,
        org_id: blob.scope_keys.org_id ?? null,
        app_id: blob.scope_keys.app_id ?? null,
        user_id: blob.scope_keys.user_id ?? null,
      },
      {
        $set: {
          id: blob.id,
          scope: blob.scope,
          org_id: blob.scope_keys.org_id ?? null,
          app_id: blob.scope_keys.app_id ?? null,
          user_id: blob.scope_keys.user_id ?? null,
          content,
          is_binary: typeof blob.content !== "string",
          content_type: blob.content_type,
          created_at: blob.created_at ?? new Date().toISOString(),
          expires_at: blob.expires_at ? new Date(blob.expires_at) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      { upsert: true }
    );
  }

  async getBlob(id: string, scope_keys: Record<string, string>): Promise<ObjectBlob | null> {
    if (!this.client) throw new Error("Client not initialized");
    const db = this.client.db(this.dbName);
    const collection = db.collection(`${this.collectionPrefix}blobs`);

    const result = await collection.findOne({
      id,
      org_id: scope_keys.org_id ?? null,
      app_id: scope_keys.app_id ?? null,
      user_id: scope_keys.user_id ?? null,
    });

    if (!result) return null;

    const doc = result as { scope: string; org_id: string | null; app_id: string | null; user_id: string | null; content: string; is_binary: boolean; content_type?: string; created_at: string; expires_at: Date };
    return {
      id,
      scope: doc.scope as ObjectBlob["scope"],
      scope_keys: {
        ...(doc.org_id && { org_id: doc.org_id }),
        ...(doc.app_id && { app_id: doc.app_id }),
        ...(doc.user_id && { user_id: doc.user_id }),
      },
      content: doc.is_binary ? Buffer.from(doc.content, "base64") : doc.content,
      content_type: doc.content_type,
      created_at: doc.created_at,
      expires_at: doc.expires_at.toISOString(),
    };
  }

  async deleteBlob(id: string, scope_keys: Record<string, string>): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");
    const db = this.client.db(this.dbName);
    const collection = db.collection(`${this.collectionPrefix}blobs`);

    await collection.deleteOne({
      id,
      org_id: scope_keys.org_id ?? null,
      app_id: scope_keys.app_id ?? null,
      user_id: scope_keys.user_id ?? null,
    });
  }

  async setTTL(key: string, ttlSeconds: number): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");
    const db = this.client.db(this.dbName);

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await db.collection(`${this.collectionPrefix}chunks`).updateOne(
      { _id: key },
      { $set: { expires_at: expiresAt } }
    );
    await db.collection(`${this.collectionPrefix}records`).updateOne(
      { key },
      { $set: { expires_at: expiresAt } }
    );
    await db.collection(`${this.collectionPrefix}blobs`).updateOne(
      { id: key },
      { $set: { expires_at: expiresAt } }
    );
  }

  cleanupExpired(): Promise<number> {
    // MongoDB TTL indexes handle this automatically
    return Promise.resolve(0);
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}
