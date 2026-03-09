/**
 * Synthesis engine – unit tests (EngineInvocation → EngineResult).
 */

import { createSynthesisEngine, createStubSynthesisEngine } from "./synthesis_engine.js";
import { StubModelGateway } from "../gateways/model-gateway.js";
import type { EngineInvocation } from "../contracts/index.js";
import { validateEngineResult } from "../contracts/index.js";

function minimalInvocation(overrides: Partial<EngineInvocation> = {}): EngineInvocation {
  return {
    invocation_id: "inv-synth-1",
    engine_type: "synthesis",
    task: { task_id: "t1", task_type: "synthesize", category: "synthesis" },
    context_artifacts: [
      {
        artifact_id: "a1",
        artifact_kind: "report",
        encoding: "text",
        content: { inline: "Hello from execution" },
      },
    ],
    ...overrides,
  };
}

describe("Synthesis Engine", () => {
  it("implements IEngine and returns valid EngineResult (stub)", async () => {
    const engine = createStubSynthesisEngine();
    const inv = minimalInvocation();
    const result = await engine.invoke(inv);
    expect(result.invocation_id).toBe("inv-synth-1");
    expect(result.status).toBe("success");
    expect(result.result_artifacts.length).toBeGreaterThanOrEqual(1);
    validateEngineResult(result);
  });

  it("returns valid EngineResult when using Model Gateway", async () => {
    const gateway = new StubModelGateway();
    const engine = createSynthesisEngine(gateway);
    const inv = minimalInvocation();
    const result = await engine.invoke(inv);
    expect(result.invocation_id).toBe("inv-synth-1");
    expect(result.status).toBe("success");
    expect(result.result_artifacts.length).toBe(1);
    validateEngineResult(result);
  });
});
