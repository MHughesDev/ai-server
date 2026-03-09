/**
 * S3-Compatible Persistent Store Adapter
 * Gap 3C: Persistent Memory Configuration
 * For large context storage using object storage
 */

import type {
  PersistentMemoryStore,
  PersistentMemoryConfig,
} from "../persistent-store.js";
import type { RetrievalChunk, StructuredRecord, ObjectBlob } from "../types.js";

interface S3Client {
  send(command: unknown): Promise<unknown>;
  putObject(params: {
    Bucket: string;
    Key: string;
    Body: Buffer | string;
    ContentType?: string;
    Metadata?: Record<string, string>;
  }): Promise<void>;
  getObject(params: { Bucket: string; Key: string }): Promise<{ Body: { toString(): string } }>;
  deleteObject(params: { Bucket: string; Key: string }): Promise<void>;
  listObjectsV2(params: {
    Bucket: string;
    Prefix?: string;
    MaxKeys?: number;
  }): Promise<{ Contents?: Array<{ Key: string; LastModified: Date }> }>;
}

export class S3PersistentStore implements PersistentMemoryStore {
  private client: S3Client | null = null;
  private config: NonNullable<PersistentMemoryConfig["s3"]>;

  constructor(config: PersistentMemoryConfig["s3"]) {
    this.config = {
      endpoint: config?.endpoint,
      region: config?.region ?? "us-east-1",
      bucket: config?.bucket ?? "ai-server-memory",
      accessKeyId: config?.accessKeyId,
      secretAccessKey: config?.secretAccessKey,
      prefix: config?.prefix ?? "memory/",
    };
  }

  async initialize(): Promise<void> {
    try {
      // Dynamic import of AWS SDK v3
      const { S3Client } = await import("@aws-sdk/client-s3");

      this.client = new S3Client({
        region: this.config.region,
        endpoint: this.config.endpoint,
        credentials: this.config.accessKeyId && this.config.secretAccessKey
          ? {
              accessKeyId: this.config.accessKeyId,
              secretAccessKey: this.config.secretAccessKey,
            }
          : undefined,
        forcePathStyle: !!this.config.endpoint, // Required for MinIO and other S3-compatible stores
      }) as unknown as S3Client;

      // Verify connection by attempting to list objects
      await this.listObjectsV2({
        Bucket: this.config.bucket!,
        MaxKeys: 1,
      });

      console.log("[s3-store] S3 persistent store initialized");
    } catch (err) {
      throw new Error(
        `Failed to initialize S3 client: ${err instanceof Error ? err.message : String(err)}. ` +
          "Ensure @aws-sdk/client-s3 is installed: npm install @aws-sdk/client-s3"
      );
    }
  }

  // Helper to wrap S3 client methods
  private async putObject(params: Parameters<S3Client["putObject"]>[0]): Promise<void> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const cmd = new PutObjectCommand(params);
    await (this.client as S3Client).send(cmd);
  }

  private async getObject(params: Parameters<S3Client["getObject"]>[0]): Promise<{ Body: { transformToString(): Promise<string> } }> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const cmd = new GetObjectCommand(params);
    return (this.client as S3Client).send(cmd) as Promise<{ Body: { transformToString(): Promise<string> } }>;
  }

  private async deleteObject(params: Parameters<S3Client["deleteObject"]>[0]): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const cmd = new DeleteObjectCommand(params);
    await (this.client as S3Client).send(cmd);
  }

  private async listObjectsV2(params: Parameters<S3Client["listObjectsV2"]>[0]): Promise<{ Contents?: Array<{ Key: string; LastModified: Date }> }> {
    const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const cmd = new ListObjectsV2Command(params);
    return (this.client as S3Client).send(cmd) as Promise<{ Contents?: Array<{ Key: string; LastModified: Date }> }>;
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      if (!this.client) {
        return { healthy: false, latencyMs: 0, error: "Client not initialized" };
      }
      await this.listObjectsV2({
        Bucket: this.config.bucket!,
        MaxKeys: 1,
      });
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Chunks are stored as JSON objects (S3 is not ideal for small objects, but works for large batches)
  async storeChunks(chunks: RetrievalChunk[]): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");

    // Group chunks by document for efficient storage
    const byDocument = new Map<string, RetrievalChunk[]>();
    for (const chunk of chunks) {
      const docId = chunk.metadata.document_id;
      if (!byDocument.has(docId)) {
        byDocument.set(docId, []);
      }
      byDocument.get(docId)!.push(chunk);
    }

    for (const [docId, docChunks] of byDocument.entries()) {
      const key = `${this.config.prefix}chunks/${docId}.json`;
      const content = JSON.stringify(docChunks);

      await this.putObject({
        Bucket: this.config.bucket!,
        Key: key,
        Body: content,
        ContentType: "application/json",
        Metadata: {
          document_id: docId,
          chunk_count: String(docChunks.length),
          org_id: docChunks[0]?.metadata.scope_keys.org_id ?? "",
          app_id: docChunks[0]?.metadata.scope_keys.app_id ?? "",
          user_id: docChunks[0]?.metadata.scope_keys.user_id ?? "",
        },
      });
    }
  }

  async retrieveChunks(query: {
    scope_keys: Record<string, string>;
    top_k: number;
    filters?: Record<string, unknown>;
  }): Promise<RetrievalChunk[]> {
    if (!this.client) throw new Error("Client not initialized");

    // List all chunk files
    const prefix = `${this.config.prefix}chunks/`;
    const listResult = await this.listObjectsV2({
      Bucket: this.config.bucket!,
      Prefix: prefix,
    });

    const chunks: RetrievalChunk[] = [];

    for (const obj of listResult.Contents || []) {
      if (!obj.Key?.endsWith(".json")) continue;

      try {
        const result = await this.getObject({
          Bucket: this.config.bucket!,
          Key: obj.Key,
        });
        const content = await result.Body.transformToString();
        const docChunks = JSON.parse(content) as RetrievalChunk[];

        // Filter by scope
        const filtered = docChunks.filter(chunk => {
          if (query.scope_keys.org_id && chunk.metadata.scope_keys.org_id !== query.scope_keys.org_id) return false;
          if (query.scope_keys.app_id && chunk.metadata.scope_keys.app_id !== query.scope_keys.app_id) return false;
          if (query.scope_keys.user_id && chunk.metadata.scope_keys.user_id !== query.scope_keys.user_id) return false;
          return true;
        });

        chunks.push(...filtered);
      } catch {
        // Skip corrupted objects
        continue;
      }
    }

    // Sort by recency and return top_k
    chunks.sort((a, b) => new Date(b.metadata.created_at ?? 0).getTime() - new Date(a.metadata.created_at ?? 0).getTime());
    return chunks.slice(0, query.top_k);
  }

  async deleteChunks(chunkIds: string[]): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");

    // S3 doesn't support partial deletes, so we need to rewrite documents
    // This is a simplification - in production, track which documents contain which chunks
    for (const chunkId of chunkIds) {
      const key = `${this.config.prefix}chunks/${chunkId.split("-")[0]}.json`;
      try {
        await this.deleteObject({
          Bucket: this.config.bucket!,
          Key: key,
        });
      } catch {
        // May not exist
      }
    }
  }

  async storeRecord(record: StructuredRecord): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");

    const key = `${this.config.prefix}records/${this.scopeToPath(record.scope_keys)}/${record.key}.json`;
    const content = JSON.stringify(record);

    await this.putObject({
      Bucket: this.config.bucket!,
      Key: key,
      Body: content,
      ContentType: "application/json",
      Metadata: {
        scope: record.scope,
        org_id: record.scope_keys.org_id ?? "",
        app_id: record.scope_keys.app_id ?? "",
        user_id: record.scope_keys.user_id ?? "",
      },
    });
  }

  async getRecord(key: string, scope_keys: Record<string, string>): Promise<StructuredRecord | null> {
    if (!this.client) throw new Error("Client not initialized");

    const path = `${this.config.prefix}records/${this.scopeToPath(scope_keys)}/${key}.json`;

    try {
      const result = await this.getObject({
        Bucket: this.config.bucket!,
        Key: path,
      });
      const content = await result.Body.transformToString();
      return JSON.parse(content) as StructuredRecord;
    } catch {
      return null;
    }
  }

  async deleteRecord(key: string, scope_keys: Record<string, string>): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");

    const path = `${this.config.prefix}records/${this.scopeToPath(scope_keys)}/${key}.json`;

    try {
      await this.deleteObject({
        Bucket: this.config.bucket!,
        Key: path,
      });
    } catch {
      // May not exist
    }
  }

  async queryRecords(query: {
    prefix?: string;
    scope_keys: Record<string, string>;
  }): Promise<StructuredRecord[]> {
    if (!this.client) throw new Error("Client not initialized");

    const prefixPath = `${this.config.prefix}records/${this.scopeToPath(query.scope_keys)}/${query.prefix ?? ""}`;

    const listResult = await this.listObjectsV2({
      Bucket: this.config.bucket!,
      Prefix: prefixPath,
    });

    const records: StructuredRecord[] = [];

    for (const obj of listResult.Contents || []) {
      if (!obj.Key?.endsWith(".json")) continue;

      try {
        const result = await this.getObject({
          Bucket: this.config.bucket!,
          Key: obj.Key,
        });
        const content = await result.Body.transformToString();
        records.push(JSON.parse(content) as StructuredRecord);
      } catch {
        continue;
      }
    }

    return records;
  }

  async storeBlob(blob: ObjectBlob): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");

    const key = `${this.config.prefix}blobs/${this.scopeToPath(blob.scope_keys)}/${blob.id}`;
    const body = typeof blob.content === "string" ? blob.content : Buffer.from(blob.content);

    await this.putObject({
      Bucket: this.config.bucket!,
      Key: key,
      Body: body,
      ContentType: blob.content_type ?? "application/octet-stream",
      Metadata: {
        scope: blob.scope,
        org_id: blob.scope_keys.org_id ?? "",
        app_id: blob.scope_keys.app_id ?? "",
        user_id: blob.scope_keys.user_id ?? "",
        created_at: blob.created_at ?? new Date().toISOString(),
        is_binary: typeof blob.content !== "string" ? "true" : "false",
      },
    });
  }

  async getBlob(id: string, scope_keys: Record<string, string>): Promise<ObjectBlob | null> {
    if (!this.client) throw new Error("Client not initialized");

    const key = `${this.config.prefix}blobs/${this.scopeToPath(scope_keys)}/${id}`;

    try {
      const result = await this.getObject({
        Bucket: this.config.bucket!,
        Key: key,
      });
      const content = await result.Body.transformToString();

      return {
        id,
        scope: "org" as ObjectBlob["scope"], // Simplified
        scope_keys,
        content,
      };
    } catch {
      return null;
    }
  }

  async deleteBlob(id: string, scope_keys: Record<string, string>): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");

    const key = `${this.config.prefix}blobs/${this.scopeToPath(scope_keys)}/${id}`;

    try {
      await this.deleteObject({
        Bucket: this.config.bucket!,
        Key: key,
      });
    } catch {
      // May not exist
    }
  }

  async setTTL(_key: string, _ttlSeconds: number): Promise<void> {
    // S3 doesn't natively support TTL; would need lifecycle policies or external cleanup
    console.warn("[s3-store] TTL not directly supported; configure S3 lifecycle policies");
  }

  async cleanupExpired(): Promise<number> {
    // S3 lifecycle policies handle this automatically
    return 0;
  }

  async close(): Promise<void> {
    this.client = null;
  }

  private scopeToPath(scope_keys: Record<string, string>): string {
    const parts: string[] = [];
    if (scope_keys.org_id) parts.push(`org=${scope_keys.org_id}`);
    if (scope_keys.app_id) parts.push(`app=${scope_keys.app_id}`);
    if (scope_keys.user_id) parts.push(`user=${scope_keys.user_id}`);
    return parts.join("/") || "global";
  }
}
