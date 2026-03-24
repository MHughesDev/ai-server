/**
 * Weaviate Vector Store Adapter
 * Gap 3B: Vector Embeddings Integration
 * Open-source vector database with GraphQL interface
 */

import type {
  VectorStore,
  VectorStoreConfig,
  VectorDocument,
  VectorSearchResult,
} from "../vector-store.js";

export class WeaviateAdapter implements VectorStore {
  private config: VectorStoreConfig;
  private client: any | null = null;

  constructor(config: VectorStoreConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (!this.config.weaviateUrl) {
      throw new Error("Weaviate adapter requires weaviateUrl");
    }

    try {
      const { default: weaviate } = await import("weaviate-ts-client");
      const module = await import("weaviate-ts-client");
      this.client = weaviate.client({
        scheme: this.config.weaviateUrl.startsWith("https") ? "https" : "http",
        host: this.config.weaviateUrl.replace(/^https?:\/\//, ""),
        apiKey: this.config.weaviateApiKey
          ? new module.ApiKey(this.config.weaviateApiKey)
          : undefined,
      });
      console.log("[vector-store] Weaviate adapter initialized");
    } catch (err) {
      throw new Error(
        `Failed to initialize Weaviate client: ${err instanceof Error ? err.message : String(err)}. ` +
          "Ensure weaviate-ts-client is installed: npm install weaviate-ts-client"
      );
    }
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    if (!this.client) {
      throw new Error("Weaviate client not initialized");
    }

    const className = this.config.indexName ?? "AiServerVector";

    // Check if class exists, create if not
    try {
      await this.client.schema
        .classCreator()
        .withClass({
          class: className,
          vectorizer: "none", // We provide our own vectors
          properties: [
            { name: "content", dataType: ["text"] },
            { name: "org_id", dataType: ["text"] },
            { name: "app_id", dataType: ["text"] },
            { name: "user_id", dataType: ["text"] },
            { name: "session_id", dataType: ["text"] },
            { name: "timestamp", dataType: ["text"] },
          ],
        })
        .do();
    } catch {
      // Class may already exist, continue
    }

    let batcher = this.client.batch.objectsBatcher();

    for (const doc of documents) {
      batcher = batcher.withObject({
        class: className,
        id: doc.id,
        vector: doc.vector,
        properties: {
          content: doc.content,
          ...doc.metadata,
        },
      });
    }

    await batcher.do();
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
      throw new Error("Weaviate client not initialized");
    }

    const className = this.config.indexName ?? "AiServerVector";
    const whereFilter: Record<string, unknown> = { operator: "And", operands: [] as unknown[] };
    if (options.filter?.org_id) {
      (whereFilter.operands as unknown[]).push({
        path: ["org_id"],
        operator: "Equal",
        valueText: options.filter.org_id,
      });
    }
    if (options.filter?.app_id) {
      (whereFilter.operands as unknown[]).push({
        path: ["app_id"],
        operator: "Equal",
        valueText: options.filter.app_id,
      });
    }
    if (options.filter?.user_id) {
      (whereFilter.operands as unknown[]).push({
        path: ["user_id"],
        operator: "Equal",
        valueText: options.filter.user_id,
      });
    }

    let queryBuilder = this.client.graphql
      .get()
      .withClassName(className)
      .withNearVector({ vector: queryVector });

    if ((whereFilter.operands as unknown[]).length > 0) {
      queryBuilder = queryBuilder.withWhere(whereFilter);
    }

    const result = await queryBuilder
      .withFields("content org_id app_id user_id session_id timestamp _additional { id certainty }")
      .withLimit(options.topK)
      .do();

    const items = (result?.data?.Get?.[className] ?? []) as Array<{
      _additional: { id: string; certainty: number };
      content: string;
      org_id?: string;
      app_id?: string;
      user_id?: string;
      session_id?: string;
      timestamp?: string;
    }>;

    return items.map(item => ({
      document: {
        id: item._additional.id,
        vector: [],
        content: item.content,
        metadata: {
          org_id: item.org_id as string,
          app_id: item.app_id as string,
          user_id: item.user_id as string,
          session_id: item.session_id as string,
          timestamp: item.timestamp as string,
        },
      },
      score: item._additional.certainty,
      distance: 1 - item._additional.certainty,
    }));
  }

  async delete(ids: string[]): Promise<void> {
    if (!this.client) {
      throw new Error("Weaviate client not initialized");
    }

    const className = this.config.indexName ?? "AiServerVector";

    for (const id of ids) {
      await this.client.data
        .deleter()
        .withClassName(className)
        .withId(id)
        .do();
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      if (!this.client) {
        return { healthy: false, latencyMs: 0, error: "Client not initialized" };
      }
      await this.client.misc.metaGetter().do();
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
    return Promise.resolve();
  }
}
