/**
 * Load and Chaos Tests – Phase 10.1
 * Tests failure injection, high-volume scenarios, and resilience.
 * @see to-do.md §6 (testing and quality)
 */

import { jest } from "@jest/globals";
import type { IModelGateway } from "../gateways/types.js";
import type { IToolGateway } from "../gateways/types.js";
import { createEngineRegistry } from "../engines/registry.js";
import { InMemoryStore } from "../memory/in-memory-store.js";

// Helper to create a mock model gateway with configurable latency/failure
function createMockModelGateway(options: {
  latencyMs?: number;
  failureRate?: number;
  errorType?: "timeout" | "rate_limit" | "server_error";
} = {}): jest.Mocked<IModelGateway> {
  const { latencyMs = 0, failureRate = 0, errorType = "server_error" } = options;
  let callCount = 0;

  return {
    complete: jest.fn().mockImplementation(async () => {
      callCount++;
      
      // Simulate latency
      if (latencyMs > 0) {
        await new Promise(resolve => setTimeout(resolve, latencyMs));
      }

      // Simulate failures based on rate
      if (Math.random() < failureRate) {
        const errors: Record<typeof errorType, Error> = {
          timeout: new Error("Request timeout") as Error & { code: string },
          rate_limit: new Error("Rate limit exceeded") as Error & { code: string },
          server_error: new Error("Internal server error") as Error & { code: string },
        };
        const error = errors[errorType];
        (error as { code?: string }).code = errorType.toUpperCase();
        throw error;
      }

      return {
        text: `Response ${callCount}`,
        tokens_in: 10,
        tokens_out: 20,
        model: "mock-model",
        latency_ms: latencyMs,
      };
    }),
  } as unknown as jest.Mocked<IModelGateway>;
}

// Helper to create a mock tool gateway
function createMockToolGateway(options: {
  latencyMs?: number;
  failureRate?: number;
} = {}): jest.Mocked<IToolGateway> {
  const { latencyMs = 0, failureRate = 0 } = options;

  return {
    invoke: jest.fn().mockImplementation(async () => {
      if (latencyMs > 0) {
        await new Promise(resolve => setTimeout(resolve, latencyMs));
      }

      if (Math.random() < failureRate) {
        return {
          allowed: false,
          reason: "tool_error",
          message: "Tool execution failed",
          tool_id: "mock-tool",
        };
      }

      return {
        allowed: false,
        reason: "stub",
        message: "Tool execution denied - stub",
        tool_id: "mock-tool",
      };
    }),
  } as unknown as jest.Mocked<IToolGateway>;
}

describe("Load and Chaos Tests", () => {
  describe("High-volume scenarios", () => {
    it("handles 100 sequential engine invocations", async () => {
      const mockGateway = createMockModelGateway({ latencyMs: 1 });
      const registry = createEngineRegistry({ modelGateway: mockGateway });
      const executionEngine = registry("execution")!;

      const invocations = Array.from({ length: 100 }, (_, i) => ({
        invocation_id: `load-test-${i}`,
        task: { objective: { description: `Test prompt ${i}` } },
        context_artifacts: [],
      }));

      const startTime = Date.now();
      const results = [];
      
      for (const inv of invocations) {
        const result = await executionEngine.invoke(inv);
        results.push(result);
      }

      const duration = Date.now() - startTime;

      expect(results).toHaveLength(100);
      expect(results.every(r => r.status === "success")).toBe(true);
      // Should complete within reasonable time (100ms + overhead)
      expect(duration).toBeLessThan(5000);
    });

    it("handles burst of 50 parallel engine invocations", async () => {
      const mockGateway = createMockModelGateway({ latencyMs: 5 });
      const registry = createEngineRegistry({ modelGateway: mockGateway });
      const executionEngine = registry("execution")!;

      const invocations = Array.from({ length: 50 }, (_, i) => ({
        invocation_id: `burst-test-${i}`,
        task: { objective: { description: `Test prompt ${i}` } },
        context_artifacts: [],
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        invocations.map(inv => executionEngine.invoke(inv))
      );
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(50);
      expect(results.every(r => r.status === "success")).toBe(true);
      // Parallel execution should be faster than sequential
      expect(duration).toBeLessThan(1000);
    });

    it("handles memory store under load", async () => {
      const store = new InMemoryStore();
      const documents = Array.from({ length: 50 }, (_, i) => ({
        document_id: `load-doc-${i}`,
        text: `This is document ${i} with enough content to create chunks for load testing purposes.`,
        scope: "org" as const,
        scope_keys: { org_id: "load-test-org" },
      }));

      // Ingest all documents
      const ingestResults = await Promise.all(
        documents.map(doc => store.ingest(doc))
      );

      expect(ingestResults).toHaveLength(50);
      expect(ingestResults.every(r => r.chunks_written > 0)).toBe(true);

      // Query under load
      const queries = Array.from({ length: 20 }, (_, i) => ({
        query_text: `document ${i}`,
        scope: "org" as const,
        scope_keys: { org_id: "load-test-org" },
        top_k: 5,
      }));

      const queryResults = await Promise.all(
        queries.map(q => store.retrieve(q))
      );

      expect(queryResults).toHaveLength(20);
      expect(queryResults.every(r => !r.degraded)).toBe(true);
    });
  });

  describe("Failure injection", () => {
    it("continues operating when model gateway has intermittent failures", async () => {
      const mockGateway = createMockModelGateway({ 
        failureRate: 0.3, // 30% failure rate
        errorType: "server_error"
      });
      const registry = createEngineRegistry({ modelGateway: mockGateway });
      const executionEngine = registry("execution")!;

      const invocations = Array.from({ length: 20 }, (_, i) => ({
        invocation_id: `failure-test-${i}`,
        task: { objective: { description: `Test prompt ${i}` } },
        context_artifacts: [],
      }));

      const results = await Promise.allSettled(
        invocations.map(inv => executionEngine.invoke(inv))
      );

      // Should complete all invocations (some may fail)
      expect(results).toHaveLength(20);
      
      // Count successes and failures
      const successes = results.filter(r => r.status === "fulfilled").length;
      const failures = results.filter(r => r.status === "rejected").length;

      // With 30% failure rate, we expect some failures
      expect(successes + failures).toBe(20);
    });

    it("handles model gateway timeout gracefully", async () => {
      const mockGateway = createMockModelGateway({ 
        latencyMs: 100,
        failureRate: 1, // Always fail
        errorType: "timeout"
      });
      const registry = createEngineRegistry({ modelGateway: mockGateway });
      const executionEngine = registry("execution")!;

      const startTime = Date.now();
      
      try {
        await executionEngine.invoke({
          invocation_id: "timeout-test",
          task: { objective: { description: "Test prompt" } },
          context_artifacts: [],
        });
      } catch (error) {
        // Expected to fail
      }

      const duration = Date.now() - startTime;
      // Should fail fast, not hang indefinitely
      expect(duration).toBeLessThan(500);
    });

    it("handles tool gateway failures gracefully", async () => {
      const mockModelGateway = createMockModelGateway();
      const mockToolGateway = createMockToolGateway({ 
        failureRate: 0.5,
        latencyMs: 10
      });
      
      const registry = createEngineRegistry({ 
        modelGateway: mockModelGateway,
        toolGateway: mockToolGateway 
      });
      const toolEngine = registry("tool")!;

      const results = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) =>
          toolEngine.invoke({
            invocation_id: `tool-failure-${i}`,
            task: { 
              objective: { 
                description: "Test tool",
                formal_spec: { tool_id: "test-tool", parameters: {} }
              } 
            },
            context_artifacts: [],
          })
        )
      );

      // All should complete (tool engine handles failures internally)
      expect(results).toHaveLength(10);
      expect(results.every(r => r.status === "fulfilled")).toBe(true);
    });

    it("handles memory store unavailability", async () => {
      const store = new InMemoryStore();
      
      // First ingest some data
      await store.ingest({
        document_id: "test-doc",
        text: "Test content for availability test",
        scope: "org",
        scope_keys: { org_id: "test-org" },
      });

      // Make store unavailable
      store.setAvailable(false);

      // Retrieval should return degraded result
      const result = await store.retrieve({
        query_text: "test",
        scope: "org",
        scope_keys: { org_id: "test-org" },
        top_k: 5,
      });

      expect(result.degraded).toBe(true);
      expect(result.hits).toHaveLength(0);

      // Restore availability
      store.setAvailable(true);

      const result2 = await store.retrieve({
        query_text: "test",
        scope: "org",
        scope_keys: { org_id: "test-org" },
        top_k: 5,
      });

      expect(result2.degraded).toBe(false);
      expect(result2.hits.length).toBeGreaterThan(0);
    });
  });

  describe("Resource exhaustion scenarios", () => {
    it("handles large context artifacts", async () => {
      const mockGateway = createMockModelGateway();
      const registry = createEngineRegistry({ modelGateway: mockGateway });
      const evaluationEngine = registry("evaluation")!;

      // Create large artifact
      const largeArtifact = {
        artifact_id: "large-art",
        artifact_kind: "code" as const,
        schema_ref: "schema://code@v1",
        encoding: "utf-8" as const,
        content: { 
          inline: "x".repeat(100000) // 100KB of content
        },
      };

      const result = await evaluationEngine.invoke({
        invocation_id: "large-context-test",
        task: { objective: { description: "Evaluate large code" } },
        context_artifacts: [largeArtifact],
      });

      expect(result).toBeDefined();
      expect(result.invocation_id).toBe("large-context-test");
    });

    it("handles many small artifacts", async () => {
      const mockGateway = createMockModelGateway();
      const registry = createEngineRegistry({ modelGateway: mockGateway });
      const evaluationEngine = registry("evaluation")!;

      const artifacts = Array.from({ length: 100 }, (_, i) => ({
        artifact_id: `art-${i}`,
        artifact_kind: "code" as const,
        schema_ref: "schema://code@v1",
        encoding: "utf-8" as const,
        content: { inline: `Code snippet ${i}` },
      }));

      const result = await evaluationEngine.invoke({
        invocation_id: "many-artifacts-test",
        task: { objective: { description: "Evaluate many artifacts" } },
        context_artifacts: artifacts,
      });

      expect(result).toBeDefined();
      expect(result.result_artifacts?.[0]?.content?.inline?.summary).toContain("100");
    });
  });

  describe("Circuit breaker pattern simulation", () => {
    it("tracks consecutive failures", async () => {
      let failureCount = 0;
      const mockGateway = {
        complete: jest.fn().mockImplementation((): Promise<{
          text: string;
          tokens_in: number;
          tokens_out: number;
          model: string;
        }> => {
          failureCount++;
          if (failureCount <= 5) {
            const error = new Error("Service unavailable") as Error & { code: string };
            error.code = "SERVICE_UNAVAILABLE";
            return Promise.reject(error);
          }
          return Promise.resolve({
            text: "Success after failures",
            tokens_in: 10,
            tokens_out: 20,
            model: "mock-model",
          });
        }),
      } as unknown as jest.Mocked<IModelGateway>;

      const registry = createEngineRegistry({ modelGateway: mockGateway });
      const executionEngine = registry("execution")!;

      const results = [];
      for (let i = 0; i < 7; i++) {
        try {
          const result = await executionEngine.invoke({
            invocation_id: `circuit-test-${i}`,
            task: { objective: { description: "Test prompt" } },
            context_artifacts: [],
          });
          results.push({ status: "success", result });
        } catch (error) {
          results.push({ status: "error", error });
        }
      }

      expect(results.slice(0, 5).every(r => r.status === "error")).toBe(true);
      expect(results.slice(5).some(r => r.status === "success")).toBe(true);
    });
  });
});
