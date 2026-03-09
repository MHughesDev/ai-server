/**
 * Engine Registry tests – SOW M6 Segment K
 * Tests engine registration and lookup for workflow runner.
 */

import { jest } from "@jest/globals";
import { createEngineRegistry } from "./registry.js";
import type { IModelGateway, IToolGateway } from "../gateways/types.js";
import type { IMemoryStore } from "../memory/memory-abstraction.js";

// Mock gateway implementations
function createMockModelGateway(): jest.Mocked<IModelGateway> {
  return {
    complete: jest.fn().mockResolvedValue({
      text: "mock completion",
      tokens_in: 10,
      tokens_out: 20,
      model: "mock-model",
    }),
  } as unknown as jest.Mocked<IModelGateway>;
}

function createMockToolGateway(): jest.Mocked<IToolGateway> {
  return {
    invoke: jest.fn().mockResolvedValue({
      allowed: false,
      reason: "stub",
      message: "Tool execution denied - stub",
      tool_id: "mock-tool",
    }),
  } as unknown as jest.Mocked<IToolGateway>;
}

function createMockMemoryStore(): jest.Mocked<IMemoryStore> {
  return {
    retrieve: jest.fn().mockResolvedValue({ hits: [], degraded: false }),
  } as unknown as jest.Mocked<IMemoryStore>;
}

describe("createEngineRegistry", () => {
  let mockModelGateway: jest.Mocked<IModelGateway>;
  let mockToolGateway: jest.Mocked<IToolGateway>;
  let mockMemoryStore: jest.Mocked<IMemoryStore>;

  beforeEach(() => {
    mockModelGateway = createMockModelGateway();
    mockToolGateway = createMockToolGateway();
    mockMemoryStore = createMockMemoryStore();
  });

  it("returns registry function", () => {
    const registry = createEngineRegistry({ modelGateway: mockModelGateway });
    expect(typeof registry).toBe("function");
  });

  describe("core engines (always available)", () => {
    it("provides execution engine", () => {
      const registry = createEngineRegistry({ modelGateway: mockModelGateway });
      const engine = registry("execution");
      expect(engine).toBeDefined();
      expect(typeof engine?.invoke).toBe("function");
    });

    it("provides synthesis engine", () => {
      const registry = createEngineRegistry({ modelGateway: mockModelGateway });
      const engine = registry("synthesis");
      expect(engine).toBeDefined();
      expect(typeof engine?.invoke).toBe("function");
    });

    it("provides classification engine", () => {
      const registry = createEngineRegistry({ modelGateway: mockModelGateway });
      const engine = registry("classification");
      expect(engine).toBeDefined();
      expect(typeof engine?.invoke).toBe("function");
    });

    it("provides evaluation engine", () => {
      const registry = createEngineRegistry({ modelGateway: mockModelGateway });
      const engine = registry("evaluation");
      expect(engine).toBeDefined();
      expect(typeof engine?.invoke).toBe("function");
    });

    it("provides planning engine", () => {
      const registry = createEngineRegistry({ modelGateway: mockModelGateway });
      const engine = registry("planning");
      expect(engine).toBeDefined();
      expect(typeof engine?.invoke).toBe("function");
    });

    it("provides condensing engine", () => {
      const registry = createEngineRegistry({ modelGateway: mockModelGateway });
      const engine = registry("condensing");
      expect(engine).toBeDefined();
      expect(typeof engine?.invoke).toBe("function");
    });
  });

  describe("conditional engines (require additional gateways)", () => {
    it("provides tool engine when toolGateway is provided", () => {
      const registry = createEngineRegistry({
        modelGateway: mockModelGateway,
        toolGateway: mockToolGateway,
      });
      const engine = registry("tool");
      expect(engine).toBeDefined();
      expect(typeof engine?.invoke).toBe("function");
    });

    it("returns undefined for tool engine when toolGateway not provided", () => {
      const registry = createEngineRegistry({ modelGateway: mockModelGateway });
      const engine = registry("tool");
      expect(engine).toBeUndefined();
    });

    it("provides memory engine when memoryStore is provided", () => {
      const registry = createEngineRegistry({
        modelGateway: mockModelGateway,
        memoryStore: mockMemoryStore,
      });
      const engine = registry("memory");
      expect(engine).toBeDefined();
      expect(typeof engine?.invoke).toBe("function");
    });

    it("returns undefined for memory engine when memoryStore not provided", () => {
      const registry = createEngineRegistry({ modelGateway: mockModelGateway });
      const engine = registry("memory");
      expect(engine).toBeUndefined();
    });
  });

  describe("engine invocation", () => {
    it("execution engine can be invoked", async () => {
      const registry = createEngineRegistry({ modelGateway: mockModelGateway });
      const engine = registry("execution");
      const result = await engine?.invoke({
        invocation_id: "test-1",
        task: { objective: { description: "test prompt" } },
        context_artifacts: [],
      });
      expect(result).toBeDefined();
      expect(result?.status).toBeDefined();
      expect(result?.invocation_id).toBe("test-1");
    });

    it("synthesis engine can be invoked", async () => {
      const registry = createEngineRegistry({ modelGateway: mockModelGateway });
      const engine = registry("synthesis");
      const result = await engine?.invoke({
        invocation_id: "test-2",
        task: { objective: { description: "test prompt" } },
        context_artifacts: [],
      });
      expect(result).toBeDefined();
      expect(result?.status).toBeDefined();
      expect(result?.invocation_id).toBe("test-2");
    });

    it("classification engine can be invoked", async () => {
      const registry = createEngineRegistry({ modelGateway: mockModelGateway });
      const engine = registry("classification");
      const result = await engine?.invoke({
        invocation_id: "test-3",
        task: { objective: { description: "test prompt" } },
        context_artifacts: [],
      });
      expect(result).toBeDefined();
      expect(result?.status).toBeDefined();
      expect(result?.invocation_id).toBe("test-3");
    });

    it("evaluation engine can be invoked", async () => {
      const registry = createEngineRegistry({ modelGateway: mockModelGateway });
      const engine = registry("evaluation");
      const result = await engine?.invoke({
        invocation_id: "test-4",
        task: { objective: { description: "test prompt" } },
        context_artifacts: [],
      });
      expect(result).toBeDefined();
      expect(result?.status).toBeDefined();
      expect(result?.invocation_id).toBe("test-4");
    });
  });

  describe("tool engine with allowlist", () => {
    it("creates tool engine with allowlist when provided", () => {
      const allowlist = ["allowed-tool-1", "allowed-tool-2"];
      const registry = createEngineRegistry({
        modelGateway: mockModelGateway,
        toolGateway: mockToolGateway,
        toolsAllowlist: allowlist,
      });
      const engine = registry("tool");
      expect(engine).toBeDefined();
    });

    it("tool engine can be invoked with formal_spec", async () => {
      const registry = createEngineRegistry({
        modelGateway: mockModelGateway,
        toolGateway: mockToolGateway,
        toolsAllowlist: ["test-tool"],
      });
      const engine = registry("tool");
      const result = await engine?.invoke({
        invocation_id: "test-tool-1",
        task: { 
          objective: { 
            description: "test prompt",
            formal_spec: { tool_id: "test-tool", parameters: {} }
          } 
        },
        context_artifacts: [],
      });
      expect(result).toBeDefined();
      expect(result?.invocation_id).toBe("test-tool-1");
    });

    it("tool engine fails when tool_id missing", async () => {
      const registry = createEngineRegistry({
        modelGateway: mockModelGateway,
        toolGateway: mockToolGateway,
        toolsAllowlist: ["test-tool"],
      });
      const engine = registry("tool");
      const result = await engine?.invoke({
        invocation_id: "test-tool-2",
        task: { 
          objective: { 
            description: "test prompt"
          } 
        },
        context_artifacts: [],
      });
      expect(result).toBeDefined();
      expect(result?.status).toBe("fail");
      expect(result?.error?.code).toBe("TOOL_INVOCATION_INVALID");
    });
  });

  describe("unknown engine refs", () => {
    it("returns undefined for unknown engine refs", () => {
      const registry = createEngineRegistry({ modelGateway: mockModelGateway });
      expect(registry("unknown")).toBeUndefined();
      expect(registry("")).toBeUndefined();
      expect(registry("invalid")).toBeUndefined();
    });

    it("returns undefined for non-engine strings", () => {
      const registry = createEngineRegistry({ modelGateway: mockModelGateway });
      expect(registry("not-an-engine")).toBeUndefined();
      expect(registry("foo")).toBeUndefined();
      expect(registry("bar")).toBeUndefined();
    });
  });

  describe("engine singleton behavior", () => {
    it("returns same engine instance on multiple lookups", () => {
      const registry = createEngineRegistry({ modelGateway: mockModelGateway });
      const engine1 = registry("execution");
      const engine2 = registry("execution");
      expect(engine1).toBe(engine2);
    });

    it("engines are created once per registry", () => {
      const registry1 = createEngineRegistry({ modelGateway: mockModelGateway });
      const registry2 = createEngineRegistry({ modelGateway: mockModelGateway });
      
      const engine1 = registry1("execution");
      const engine2 = registry2("execution");
      
      // Different registries create different instances
      expect(engine1).not.toBe(engine2);
    });
  });

  describe("all expected engine refs", () => {
    it("provides all 8 documented engine types when all gateways provided", () => {
      const registry = createEngineRegistry({
        modelGateway: mockModelGateway,
        toolGateway: mockToolGateway,
        memoryStore: mockMemoryStore,
      });

      const expectedEngines = [
        "execution",
        "synthesis",
        "classification",
        "evaluation",
        "tool",
        "memory",
        "planning",
        "condensing",
      ];

      for (const engineRef of expectedEngines) {
        const engine = registry(engineRef);
        expect(engine).toBeDefined();
        expect(typeof engine?.invoke).toBe("function");
      }
    });
  });
});
