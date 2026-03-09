/**
 * Vector Store Interface
 * Gap 3B: Vector Embeddings Integration
 * Provides pluggable vector database adapters for semantic search
 */

export interface VectorDocument {
  id: string;
  vector: number[];
  content: string;
  metadata: {
    org_id?: string;
    app_id?: string;
    user_id?: string;
    session_id?: string;
    timestamp: string;
    [key: string]: unknown;
  };
}

export interface VectorSearchResult {
  document: VectorDocument;
  score: number;
  distance: number;
}

export interface VectorStoreConfig {
  backend: "pinecone" | "weaviate" | "chroma" | "pgvector" | "in_memory";
  dimensions: number;
  indexName?: string;
  namespace?: string;
  /** For Pinecone */
  pineconeApiKey?: string;
  pineconeEnvironment?: string;
  /** For Weaviate */
  weaviateUrl?: string;
  weaviateApiKey?: string;
  /** For Chroma */
  chromaUrl?: string;
  chromaTenant?: string;
  /** For pgvector */
  pgConnectionString?: string;
  pgTableName?: string;
}

export interface VectorStore {
  /** Initialize the vector store connection */
  initialize(): Promise<void>;

  /** Store documents with vectors */
  upsert(documents: VectorDocument[]): Promise<void>;

  /** Search for similar vectors */
  search(
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
  ): Promise<VectorSearchResult[]>;

  /** Delete documents by ID */
  delete(ids: string[]): Promise<void>;

  /** Check if store is healthy */
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }>;

  /** Close connection */
  close(): Promise<void>;
}

/** Factory function to create vector store based on config */
export async function createVectorStore(config: VectorStoreConfig): Promise<VectorStore> {
  switch (config.backend) {
    case "pinecone": {
      const { PineconeAdapter } = await import("./vector-adapters/pinecone.js");
      return new PineconeAdapter(config);
    }
    case "weaviate": {
      const { WeaviateAdapter } = await import("./vector-adapters/weaviate.js");
      return new WeaviateAdapter(config);
    }
    case "chroma": {
      const { ChromaAdapter } = await import("./vector-adapters/chroma.js");
      return new ChromaAdapter(config);
    }
    case "pgvector": {
      const { PgVectorAdapter } = await import("./vector-adapters/pgvector.js");
      return new PgVectorAdapter(config);
    }
    case "in_memory":
    default: {
      const { InMemoryVectorStore } = await import("./vector-adapters/in-memory.js");
      return new InMemoryVectorStore(config);
    }
  }
}
