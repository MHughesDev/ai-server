/**
 * Chroma Vector Store Adapter
 * Gap 3B: Vector Embeddings Integration
 * Lightweight local vector database
 */

import type {
  VectorStore,
  VectorStoreConfig,
  VectorDocument,
  VectorSearchResult,
} from "../vector-store.js";

export class ChromaAdapter implements VectorStore {
  private config: VectorStoreConfig;
  private client: unknown | null = null;
  private collection: unknown | null = null;

  constructor(config: VectorStoreConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      const { ChromaClient } = await import("chromadb");
      this.client = new ChromaClient({
        path: this.config.chromaUrl ?? "http://localhost:8000",
      });

      const collectionName = this.config.indexName ?? "ai-server-vectors";

      // Get or create collection
      try {
        this.collection = await (this.client as { getCollection: (params: { name: string }) => Promise<unknown> }).getCollection({
          name: collectionName,
        });
      } catch {
        this.collection = await (this.client as { createCollection: (params: { name: string; metadata?: Record<string, unknown> }) => Promise<unknown> }).createCollection({
          name: collectionName,
          metadata: { description: "AI Server vector storage" },
        });
      }

      console.log("[vector-store] Chroma adapter initialized");
    } catch (err) {
      throw new Error(
        `Failed to initialize Chroma client: ${err instanceof Error ? err.message : String(err)}. ` +
          "Ensure chromadb is installed: npm install chromadb"
      );
    }
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    if (!this.collection) {
      throw new Error("Chroma collection not initialized");
    }

    const ids = documents.map(d => d.id);
    const embeddings = documents.map(d => d.vector);
    const metadatas = documents.map(d => d.metadata);
    const documents_text = documents.map(d => d.content);

    await (this.collection as {
      upsert: (params: {
        ids: string[];
        embeddings: number[][];
        metadatas: VectorDocument["metadata"][];
        documents: string[];
      }) => Promise<void>;
    }).upsert({
      ids,
      embeddings,
      metadatas,
      documents: documents_text,
    });
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
    if (!this.collection) {
      throw new Error("Chroma collection not initialized");
    }

    const where: Record<string, unknown> = {};
    if (options.filter) {
      const conditions: Record<string, unknown>[] = [];
      if (options.filter.org_id) {
        conditions.push({ org_id: { $eq: options.filter.org_id } });
      }
      if (options.filter.app_id) {
        conditions.push({ app_id: { $eq: options.filter.app_id } });
      }
      if (options.filter.user_id) {
        conditions.push({ user_id: { $eq: options.filter.user_id } });
      }
      if (conditions.length > 0) {
        where.$and = conditions;
      }
    }

    const results = await (this.collection as {
      query: (params: {
        queryEmbeddings: number[][];
        nResults: number;
        where?: Record<string, unknown>;
        include?: string[];
      }) => Promise<{
        ids: string[][];
        distances: number[][];
        documents: string[][];
        metadatas: VectorDocument["metadata"][][];
      }>;
    }).query({
      queryEmbeddings: [queryVector],
      nResults: options.topK,
      where: Object.keys(where).length > 0 ? where : undefined,
      include: ["metadatas", "documents", "distances"],
    });

    const items: VectorSearchResult[] = [];
    for (let i = 0; i < results.ids[0].length; i++) {
      items.push({
        document: {
          id: results.ids[0][i],
          vector: [],
          content: results.documents[0][i] ?? "",
          metadata: results.metadatas[0][i] ?? {},
        },
        score: 1 - (results.distances[0][i] ?? 0),
        distance: results.distances[0][i] ?? 0,
      });
    }

    return items;
  }

  async delete(ids: string[]): Promise<void> {
    if (!this.collection) {
      throw new Error("Chroma collection not initialized");
    }

    await (this.collection as { delete: (params: { ids: string[] }) => Promise<void> }).delete({
      ids,
    });
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      if (!this.client) {
        return { healthy: false, latencyMs: 0, error: "Client not initialized" };
      }
      await (this.client as { heartbeat: () => Promise<number> }).heartbeat();
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  close(): Promise<void> {
    this.client = null;
    this.collection = null;
    return Promise.resolve();
  }
}
