/**
 * Pinecone Vector Store Adapter
 * Gap 3B: Vector Embeddings Integration
 * Production-ready managed vector database
 */

import type {
  VectorStore,
  VectorStoreConfig,
  VectorDocument,
  VectorSearchResult,
} from "../vector-store.js";

export class PineconeAdapter implements VectorStore {
  private config: VectorStoreConfig;
  private client: unknown | null = null;

  constructor(config: VectorStoreConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (!this.config.pineconeApiKey) {
      throw new Error("Pinecone adapter requires pineconeApiKey");
    }

    try {
      // Dynamic import to avoid hard dependency
      const { Pinecone } = await import("@pinecone-database/pinecone");
      this.client = new Pinecone({
        apiKey: this.config.pineconeApiKey,
      });
      console.log("[vector-store] Pinecone adapter initialized");
    } catch (err) {
      throw new Error(
        `Failed to initialize Pinecone client: ${err instanceof Error ? err.message : String(err)}. ` +
          "Ensure @pinecone-database/pinecone is installed: npm install @pinecone-database/pinecone"
      );
    }
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    if (!this.client) {
      throw new Error("Pinecone client not initialized");
    }

    const indexName = this.config.indexName ?? "ai-server-vectors";
    const index = (this.client as { index(name: string): unknown }).index(indexName);
    const namespace = this.config.namespace ?? "default";

    const vectors = documents.map(doc => ({
      id: doc.id,
      values: doc.vector,
      metadata: doc.metadata,
    }));

    const ns = (index as { namespace(name: string): { upsert(vectors: unknown[]): Promise<void> } }).namespace(namespace);
    await ns.upsert(vectors);
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
    if (!this.client) {
      throw new Error("Pinecone client not initialized");
    }

    const indexName = this.config.indexName ?? "ai-server-vectors";
    const index = (this.client as { index(name: string): unknown }).index(indexName);
    const namespace = this.config.namespace ?? "default";

    const ns = (index as { namespace(name: string): { query(params: unknown): Promise<{ matches: Array<{ id: string; score: number; metadata: Record<string, unknown> }> }> } }).namespace(namespace);

    const filter: Record<string, unknown> = {};
    if (options.filter?.org_id) filter.org_id = { $eq: options.filter.org_id };
    if (options.filter?.app_id) filter.app_id = { $eq: options.filter.app_id };
    if (options.filter?.user_id) filter.user_id = { $eq: options.filter.user_id };
    if (options.filter?.session_id) filter.session_id = { $eq: options.filter.session_id };

    const results = await ns.query({
      vector: queryVector,
      topK: options.topK,
      includeMetadata: true,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });

    return (results.matches || []).map(match => ({
      document: {
        id: match.id,
        vector: [], // Pinecone doesn't return vectors in query results by default
        content: (match.metadata?.content as string) ?? "",
        metadata: match.metadata as VectorDocument["metadata"],
      },
      score: match.score,
      distance: 1 - match.score,
    }));
  }

  async delete(ids: string[]): Promise<void> {
    if (!this.client) {
      throw new Error("Pinecone client not initialized");
    }

    const indexName = this.config.indexName ?? "ai-server-vectors";
    const index = (this.client as { index(name: string): unknown }).index(indexName);
    const namespace = this.config.namespace ?? "default";

    const ns = (index as { namespace(name: string): { deleteOne(id: string): Promise<void>; deleteMany(ids: string[]): Promise<void> } }).namespace(namespace);

    if (ids.length === 1) {
      await ns.deleteOne(ids[0]!);
    } else {
      await ns.deleteMany(ids);
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      if (!this.client) {
        return { healthy: false, latencyMs: 0, error: "Client not initialized" };
      }
      const pc = this.client as { describeIndex(name: string): Promise<unknown> };
      await pc.describeIndex(this.config.indexName ?? "ai-server-vectors");
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
    // Pinecone client doesn't require explicit cleanup
    this.client = null;
  }
}
