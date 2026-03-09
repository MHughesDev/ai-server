/**
 * Execution engine – unit tests (EngineInvocation → EngineResult).
 */

import { createExecutionEngine, createStubExecutionEngine } from "./execution_engine.js";
import { StubModelGateway } from "../gateways/model-gateway.js";
import type { EngineInvocation } from "../contracts/index.js";
import { validateEngineResult } from "../contracts/index.js";

function minimalInvocation(overrides: Partial<EngineInvocation> = {}): EngineInvocation {
  return {
    invocation_id: "inv-1",
    engine_type: "execution",
    task: {
      task_id: "t1",
      task_type: "execute",
      category: "generation",
      objective: { description: "Say hello" },
    },
    context_artifacts: [],
    ...overrides,
  };
}

describe("Execution Engine", () => {
  it("implements IEngine and returns valid EngineResult (stub)", async () => {
    const engine = createStubExecutionEngine();
    const inv = minimalInvocation();
    const result = await engine.invoke(inv);
    expect(result.invocation_id).toBe("inv-1");
    expect(result.status).toBe("success");
    expect(Array.isArray(result.result_artifacts)).toBe(true);
    expect(result.result_artifacts.length).toBeGreaterThanOrEqual(1);
    validateEngineResult(result);
  });

  it("returns valid EngineResult when using Model Gateway", async () => {
    const gateway = new StubModelGateway();
    const engine = createExecutionEngine(gateway);
    const inv = minimalInvocation();
    const result = await engine.invoke(inv);
    expect(result.invocation_id).toBe("inv-1");
    expect(result.status).toBe("success");
    expect(result.result_artifacts.length).toBe(1);
    expect(typeof (result.result_artifacts[0].content as { inline?: string })?.inline).toBe("string");
    validateEngineResult(result);
  });

  it("failure path: invalid invocation still returns EngineResult shape", async () => {
    const engine = createStubExecutionEngine();
    const inv = minimalInvocation({ invocation_id: "inv-fail" });
    const result = await engine.invoke(inv);
    expect(result.status).toBe("success");
    expect(result.invocation_id).toBe("inv-fail");
    validateEngineResult(result);
  });
});
