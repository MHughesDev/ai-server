/**
 * Embedding Service
 * Gap 3B: Vector Embeddings Integration
 * Generates vector embeddings for semantic search
 */

import { createHash } from "node:crypto";
import type { Config } from "../config/schema.js";

export interface EmbeddingResult {
  vector: number[];
  model: string;
  dimensions: number;
}

export interface EmbeddingProvider {
  generate(texts: string[]): Promise<EmbeddingResult[]>;
  healthCheck(): Promise<{ healthy: boolean; error?: string }>;
}

/** Deterministic hash-based embedding for testing (not for production) */
class HashEmbeddingProvider implements EmbeddingProvider {
  private dimensions: number;

  constructor(dimensions: number = 1536) {
    this.dimensions = dimensions;
  }

  generate(texts: string[]): Promise<EmbeddingResult[]> {
    const results = texts.map(text => {
      // Create a deterministic vector based on text hash
      const hash = createHash("sha256").update(text).digest();
      const vector: number[] = [];
      for (let i = 0; i < this.dimensions; i++) {
        // Use hash bytes to generate vector values between -1 and 1
        const byteIndex = i % hash.length;
        vector.push((hash[byteIndex] / 128) - 1);
      }
      return {
        vector,
        model: "hash-deterministic",
        dimensions: this.dimensions,
      };
    });
    return Promise.resolve(results);
  }

  healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    return Promise.resolve({ healthy: true });
  }
}

/** OpenAI API embedding provider */
class OpenAiEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private model: string;
  private dimensions: number;
  private baseUrl: string;

  constructor(config: {
    apiKey: string;
    model?: string;
    dimensions?: number;
    baseUrl?: string;
  }) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? "text-embedding-3-small";
    this.dimensions = config.dimensions ?? 1536;
    this.baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  }

  async generate(texts: string[]): Promise<EmbeddingResult[]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        dimensions: this.dimensions,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embedding API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
      model: string;
    };

    return data.data
      .sort((a, b) => a.index - b.index)
      .map(item => ({
        vector: item.embedding,
        model: data.model,
        dimensions: item.embedding.length,
      }));
  }

  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      await this.generate(["health check"]);
      return { healthy: true };
    } catch (err) {
      return {
        healthy: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

/** Gateway-based embedding provider (uses model gateway) */
class GatewayEmbeddingProvider implements EmbeddingProvider {
  private gateway: {
    complete(request: { prompt: string; model?: string }): Promise<{ text: string }>;
  };
  private model: string;

  constructor(gateway: unknown, model?: string) {
    this.gateway = gateway as { complete(request: { prompt: string; model?: string }): Promise<{ text: string }> };
    this.model = model ?? "text-embedding-3-small";
  }

  async generate(texts: string[]): Promise<EmbeddingResult[]> {
    // For gateway, we need to use the embedding model
    const results: EmbeddingResult[] = [];
    for (const text of texts) {
      const result = await this.gateway.complete({
        prompt: `Generate embedding vector for: ${text}`,
        model: this.model,
      });
      // Parse the response as a vector (this is a simplified example)
      const vector = JSON.parse(result.text) as number[];
      results.push({
        vector,
        model: this.model,
        dimensions: vector.length,
      });
    }
    return results;
  }

  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      await this.generate(["test"]);
      return { healthy: true };
    } catch (err) {
      return {
        healthy: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

/** Factory function to create embedding provider */
export function createEmbeddingProvider(
  config: Config,
  modelGateway?: unknown
): EmbeddingProvider {
  const embeddingConfig = config.memory?.embedding;
  const provider = embeddingConfig?.provider ?? "hash";

  switch (provider) {
    case "openai": {
      const apiKey = process.env[embeddingConfig?.api_key_env ?? "OPENAI_API_KEY"];
      if (!apiKey) {
        throw new Error(`OpenAI embedding provider requires ${embeddingConfig?.api_key_env ?? "OPENAI_API_KEY"} environment variable`);
      }
      return new OpenAiEmbeddingProvider({
        apiKey,
        model: embeddingConfig?.model,
        dimensions: embeddingConfig?.dimensions,
        baseUrl: embeddingConfig?.base_url,
      });
    }
    case "gateway": {
      if (!modelGateway) {
        throw new Error("Gateway embedding provider requires model gateway");
      }
      return new GatewayEmbeddingProvider(modelGateway, embeddingConfig?.model);
    }
    case "hash":
    default:
      return new HashEmbeddingProvider(embeddingConfig?.dimensions ?? 1536);
  }
}
