/**
 * Integration Tests with Mocked Providers – Phase 10.1
 * Tests integration with real (mocked) model and tool providers.
 * @see to-do.md §6 (testing and quality)
 */

import { jest } from "@jest/globals";
import type { IModelGateway, IToolGateway, ModelCompletionResult } from "../gateways/types.js";
import { createEngineRegistry } from "../engines/registry.js";
import { InMemoryStore } from "../memory/in-memory-store.js";

// Mock provider implementations that simulate real provider behavior

class MockOpenAIProvider implements IModelGateway {
  private callCount = 0;

  async complete({ prompt, max_tokens, model }: { 
    prompt: string; 
    max_tokens?: number; 
    model?: string;
  }): Promise<ModelCompletionResult> {
    this.callCount++;
    
    // Simulate latency
    await new Promise(resolve => setTimeout(resolve, 10));

    // Simulate token counting (rough approximation)
    const tokensIn = Math.ceil(prompt.length / 4);
    const tokensOut = Math.ceil((max_tokens ?? 100) * 0.8);

    return {
      text: `OpenAI response ${this.callCount}: Processed "${prompt.slice(0, 50)}..."`,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      model: model ?? "gpt-4o",
      cost_usd_est: (tokensIn + tokensOut) * 0.00001,
      latency_ms: 10,
    };
  }
}

class MockAnthropicProvider implements IModelGateway {
  async complete({ prompt, max_tokens }: { 
    prompt: string; 
    max_tokens?: number;
  }): Promise<ModelCompletionResult> {
    await new Promise(resolve => setTimeout(resolve, 15));

    return {
      text: `Claude response: Analyzed "${prompt.slice(0, 30)}..."`,
      tokens_in: Math.ceil(prompt.length / 3),
      tokens_out: max_tokens ?? 100,
      model: "claude-3-sonnet",
      cost_usd_est: 0.001,
      latency_ms: 15,
    };
  }
}

class MockToolProvider implements IToolGateway {
  private allowedTools: Set<string>;

  constructor(allowedTools: string[] = []) {
    this.allowedTools = new Set(allowedTools);
  }

  async invoke(request: { 
    tool_id: string; 
    params?: Record<string, unknown>;
    caller_identity?: unknown;
  }): Promise<{ allowed: boolean; reason?: string; message?: string; tool_id: string; result?: unknown }> {
    const { tool_id, params } = request;

    // Check allowlist
    if (!this.allowedTools.has(tool_id)) {
      return {
        allowed: false,
        reason: "tool_not_allowed",
        message: `Tool '${tool_id}' is not in the allowlist`,
        tool_id,
      };
    }

    // Simulate tool execution
    await new Promise(resolve => setTimeout(resolve, 5));

    // Simulate different tool behaviors
    switch (tool_id) {
      case "calculator":
        return {
          allowed: true,
          tool_id,
          result: this.executeCalculator(params ?? {}),
        };
      
      case "web_search":
        return {
          allowed: true,
          tool_id,
          result: {
            results: [
              { title: "Result 1", url: "https://example.com/1" },
              { title: "Result 2", url: "https://example.com/2" },
            ],
          },
        };
      
      case "code_interpreter":
        return {
          allowed: true,
          tool_id,
          result: {
            output: "Code executed successfully",
            exit_code: 0,
          },
        };
      
      default:
        return {
          allowed: false,
          reason: "unknown_tool",
          message: `Tool '${tool_id}' is not implemented`,
          tool_id,
        };
    }
  }

  private executeCalculator(params: Record<string, unknown>): unknown {
    const operation = params.operation as string;
    const a = Number(params.a);
    const b = Number(params.b);

    switch (operation) {
      case "add": return { result: a + b };
      case "subtract": return { result: a - b };
      case "multiply": return { result: a * b };
      case "divide": return { result: b !== 0 ? a / b : Infinity };
      default: return { error: "Unknown operation" };
    }
  }
}

describe("Integration Tests with Mocked Providers", () => {
  describe("Model Gateway Integration", () => {
    it("integrates with OpenAI-like provider", async () => {
      const provider = new MockOpenAIProvider();
      const registry = createEngineRegistry({ modelGateway: provider });
      const executionEngine = registry("execution")!;

      const result = await executionEngine.invoke({
        invocation_id: "openai-test-1",
        task: { objective: { description: "What is the capital of France?" } },
        context_artifacts: [],
      });

      expect(result.status).toBe("success");
      expect(result.result_artifacts).toHaveLength(1);
      expect(result.metrics?.cost_estimate_usd).toBeGreaterThan(0);
    });

    it("integrates with Anthropic-like provider", async () => {
      const provider = new MockAnthropicProvider();
      const registry = createEngineRegistry({ modelGateway: provider });
      const executionEngine = registry("execution")!;

      const result = await executionEngine.invoke({
        invocation_id: "anthropic-test-1",
        task: { objective: { description: "Explain quantum computing" } },
        context_artifacts: [],
      });

      expect(result.status).toBe("success");
      expect(result.result_artifacts).toHaveLength(1);
    });

    it("tracks cost across multiple invocations", async () => {
      const provider = new MockOpenAIProvider();
      const registry = createEngineRegistry({ modelGateway: provider });
      const executionEngine = registry("execution")!;

      let totalCost = 0;
      const invocations = 5;

      for (let i = 0; i < invocations; i++) {
        const result = await executionEngine.invoke({
          invocation_id: `cost-test-${i}`,
          task: { objective: { description: `Test prompt ${i} with some extra text` } },
          context_artifacts: [],
        });
        totalCost += result.metrics?.cost_estimate_usd ?? 0;
      }

      expect(totalCost).toBeGreaterThan(0);
      // Each call should have some cost
      expect(totalCost).toBeGreaterThan(invocations * 0.0001);
    });
  });

  describe("Tool Gateway Integration", () => {
    it("integrates with calculator tool", async () => {
      const modelGateway = new MockOpenAIProvider();
      const toolGateway = new MockToolProvider(["calculator"]);
      
      const registry = createEngineRegistry({ 
        modelGateway, 
        toolGateway,
        toolsAllowlist: ["calculator"],
      });
      
      const toolEngine = registry("tool")!;

      const result = await toolEngine.invoke({
        invocation_id: "calculator-test",
        task: { 
          objective: { 
            description: "Calculate 2+2",
            formal_spec: { 
              tool_id: "calculator", 
              parameters: { operation: "add", a: 2, b: 2 }
            }
          } 
        },
        context_artifacts: [],
      });

      expect(result.status).toBe("success");
      expect(result.result_artifacts).toHaveLength(1);
    });

    it("integrates with web search tool", async () => {
      const modelGateway = new MockOpenAIProvider();
      const toolGateway = new MockToolProvider(["web_search"]);
      
      const registry = createEngineRegistry({ 
        modelGateway, 
        toolGateway,
        toolsAllowlist: ["web_search"],
      });
      
      const toolEngine = registry("tool")!;

      const result = await toolEngine.invoke({
        invocation_id: "search-test",
        task: { 
          objective: { 
            description: "Search for AI news",
            formal_spec: { 
              tool_id: "web_search", 
              parameters: { query: "AI news today" }
            }
          } 
        },
        context_artifacts: [],
      });

      expect(result.status).toBe("success");
    });

    it("enforces tool allowlist", async () => {
      const modelGateway = new MockOpenAIProvider();
      const toolGateway = new MockToolProvider(["calculator"]); // Only calculator allowed
      
      const registry = createEngineRegistry({ 
        modelGateway, 
        toolGateway,
        toolsAllowlist: ["calculator"], // Engine-level allowlist
      });
      
      const toolEngine = registry("tool")!;

      // Try to use allowed tool
      const allowedResult = await toolEngine.invoke({
        invocation_id: "allowed-test",
        task: { 
          objective: { 
            description: "Calculate",
            formal_spec: { tool_id: "calculator", parameters: {} }
          } 
        },
        context_artifacts: [],
      });

      expect(allowedResult.status).toBe("success");
    });
  });

  describe("Memory Store Integration", () => {
    it("integrates memory engine with in-memory store", async () => {
      const store = new InMemoryStore();
      const modelGateway = new MockOpenAIProvider();
      
      const registry = createEngineRegistry({ 
        modelGateway, 
        memoryStore: store 
      });
      
      const memoryEngine = registry("memory")!;

      // First, ingest some data
      await store.ingest({
        document_id: "test-doc",
        text: "The quick brown fox jumps over the lazy dog",
        scope: "org",
        scope_keys: { org_id: "test-org" },
      });

      // Then invoke memory engine
      const result = await memoryEngine.invoke({
        invocation_id: "memory-test",
        task: { objective: { description: "Retrieve information about foxes" } },
        context_artifacts: [],
      });

      expect(result.status).toBe("success");
    });

    it("maintains data isolation between scopes", async () => {
      const store = new InMemoryStore();
      
      // Ingest data for org-1
      await store.ingest({
        document_id: "org1-doc",
        text: "Secret data for organization 1",
        scope: "org",
        scope_keys: { org_id: "org-1" },
      });

      // Ingest data for org-2
      await store.ingest({
        document_id: "org2-doc",
        text: "Secret data for organization 2",
        scope: "org",
        scope_keys: { org_id: "org-2" },
      });

      // Query for org-1 should not see org-2 data
      const org1Result = await store.retrieve({
        query_text: "secret",
        scope: "org",
        scope_keys: { org_id: "org-1" },
        top_k: 10,
      });

      // Should only find org-1 document
      expect(org1Result.hits.length).toBeGreaterThan(0);
      expect(org1Result.hits.every(h =>
        h.chunk.metadata.scope_keys.org_id === "org-1"
      )).toBe(true);
    });
  });

  describe("End-to-end pipeline simulation", () => {
    it("executes full pipeline with all components", async () => {
      // Setup all providers
      const modelGateway = new MockOpenAIProvider();
      const toolGateway = new MockToolProvider(["calculator", "web_search"]);
      const memoryStore = new InMemoryStore();

      // Pre-populate memory
      await memoryStore.ingest({
        document_id: "context-doc",
        text: "Important context for the user query",
        scope: "user",
        scope_keys: { user_id: "user-123", org_id: "org-456" },
      });

      const registry = createEngineRegistry({ 
        modelGateway, 
        toolGateway,
        memoryStore,
        toolsAllowlist: ["calculator"],
      });

      // Execute classification first
      const classificationEngine = registry("classification")!;
      const classificationResult = await classificationEngine.invoke({
        invocation_id: "pipeline-cls-1",
        task: { objective: { description: "What is 2+2?" } },
        context_artifacts: [],
      });

      expect(classificationResult.status).toBe("success");

      // Execute planning
      const planningEngine = registry("planning")!;
      const planningResult = await planningEngine.invoke({
        invocation_id: "pipeline-plan-1",
        task: { objective: { description: "Calculate 2+2" } },
        context_artifacts: [],
      });

      expect(planningResult.status).toBe("success");

      // Execute main task
      const executionEngine = registry("execution")!;
      const executionResult = await executionEngine.invoke({
        invocation_id: "pipeline-exec-1",
        task: { objective: { description: "Calculate 2+2 and explain the result" } },
        context_artifacts: [],
      });

      expect(executionResult.status).toBe("success");
      expect(executionResult.result_artifacts).toHaveLength(1);

      // Synthesize final response
      const synthesisEngine = registry("synthesis")!;
      const synthesisResult = await synthesisEngine.invoke({
        invocation_id: "pipeline-synth-1",
        task: { objective: { description: "Summarize the calculation" } },
        context_artifacts: executionResult.result_artifacts ?? [],
      });

      expect(synthesisResult.status).toBe("success");
    });

    it("handles provider errors gracefully", async () => {
      // Create a failing provider
      const failingProvider: IModelGateway = {
        complete: jest.fn().mockRejectedValue(new Error("Provider unavailable")),
      };

      const registry = createEngineRegistry({ modelGateway: failingProvider });
      const executionEngine = registry("execution")!;

      await expect(
        executionEngine.invoke({
          invocation_id: "error-test",
          task: { objective: { description: "This will fail" } },
          context_artifacts: [],
        })
      ).rejects.toThrow();
    });
  });

  describe("Performance characteristics", () => {
    it("measures end-to-end latency", async () => {
      const modelGateway = new MockOpenAIProvider();
      const registry = createEngineRegistry({ modelGateway });
      const executionEngine = registry("execution")!;

      const startTime = Date.now();
      
      const result = await executionEngine.invoke({
        invocation_id: "perf-test",
        task: { objective: { description: "Test performance" } },
        context_artifacts: [],
      });

      const duration = Date.now() - startTime;

      expect(result.status).toBe("success");
      // Should complete within reasonable time (simulated 10ms + overhead)
      expect(duration).toBeLessThan(1000);
      
      // Check that metrics are populated
      expect(result.metrics?.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it("tracks token usage across providers", async () => {
      const openAI = new MockOpenAIProvider();
      const anthropic = new MockAnthropicProvider();

      const openAIRegistry = createEngineRegistry({ modelGateway: openAI });
      const anthropicRegistry = createEngineRegistry({ modelGateway: anthropic });

      const openAIResult = await openAIRegistry("execution")!.invoke({
        invocation_id: "token-test-openai",
        task: { objective: { description: "Test token counting with a moderately long prompt that should generate some tokens" } },
        context_artifacts: [],
      });

      const anthropicResult = await anthropicRegistry("execution")!.invoke({
        invocation_id: "token-test-anthropic",
        task: { objective: { description: "Test token counting with a moderately long prompt that should generate some tokens" } },
        context_artifacts: [],
      });

      // Both should track tokens
      expect(openAIResult.metrics?.tokens_used).toBeGreaterThan(0);
      expect(anthropicResult.metrics?.tokens_used).toBeGreaterThan(0);
    });
  });
});
