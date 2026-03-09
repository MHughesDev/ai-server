/**
 * In-Memory Vector Store Adapter
 * Gap 3B: Vector Embeddings Integration
 * For development and testing - uses cosine similarity
 */

import type { VectorStore, VectorStoreConfig, VectorDocument, VectorSearchResult } from "../vector-store.js";

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class InMemoryVectorStore implements VectorStore {
  private documents = new Map<string, VectorDocument>();

  constructor(_config: VectorStoreConfig) {}

  async initialize(): Promise<void> {
    console.log("[vector-store] In-memory vector store initialized");
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    for (const doc of documents) {
      this.documents.set(doc.id, doc);
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
    let docs = Array.from(this.documents.values());

    // Apply filters
    if (options.filter) {
      if (options.filter.org_id) {
        docs = docs.filter(d => d.metadata?.org_id === options.filter!.org_id);
      }
      if (options.filter.app_id) {
        docs = docs.filter(d => d.metadata?.app_id === options.filter!.app_id);
      }
      if (options.filter.user_id) {
        docs = docs.filter(d => d.metadata?.user_id === options.filter!.user_id);
      }
      if (options.filter.session_id) {
        docs = docs.filter(d => d.metadata?.session_id === options.filter!.session_id);
      }
    }

    // Calculate similarity and sort
    const results: VectorSearchResult[] = docs.map(doc => {
      const similarity = cosineSimilarity(queryVector, doc.vector);
      return {
        document: doc,
        score: similarity,
        distance: 1 - similarity,
      };
    });

    results.sort((a, b) => b.score - a.score);

    return results.slice(0, options.topK);
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.documents.delete(id);
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    return {
      healthy: true,
      latencyMs: Date.now() - start,
    };
  }

  async close(): Promise<void> {
    this.documents.clear();
  }

  // For testing
  reset(): void {
    this.documents.clear();
  }

  get count(): number {
    return this.documents.size;
  }
}
