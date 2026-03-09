/**
 * Planning engine – unit tests (EngineInvocation → EngineResult).
 */

import { createPlanningEngine, createStubPlanningEngine } from "./planning_engine.js";
import { StubModelGateway } from "../gateways/model-gateway.js";
import type { EngineInvocation } from "../contracts/index.js";
import { validateEngineResult } from "../contracts/index.js";

function minimalInvocation(overrides: Partial<EngineInvocation> = {}): EngineInvocation {
  return {
    invocation_id: "inv-plan-1",
    engine_type: "planning",
    task: {
      task_id: "t1",
      task_type: "plan",
      category: "analysis",
      objective: { description: "Plan steps for research" },
    },
    context_artifacts: [],
    ...overrides,
  };
}

describe("Planning Engine", () => {
  it("implements IEngine and returns valid EngineResult (stub)", async () => {
    const engine = createStubPlanningEngine();
    const inv = minimalInvocation();
    const result = await engine.invoke(inv);
    expect(result.invocation_id).toBe("inv-plan-1");
    expect(result.status).toBe("success");
    expect(Array.isArray(result.result_artifacts)).toBe(true);
    expect(result.result_artifacts.length).toBe(1);
    expect(result.result_artifacts[0].artifact_kind).toBe("workflow_plan");
    expect(result.result_artifacts[0].schema_ref).toContain("workflow_plan");
    const content = result.result_artifacts[0].content as { inline?: { steps?: unknown[] } };
    expect(Array.isArray(content?.inline?.steps)).toBe(true);
    validateEngineResult(result);
  });

  it("returns valid EngineResult when using Model Gateway", async () => {
    const gateway = new StubModelGateway();
    const engine = createPlanningEngine(gateway);
    const inv = minimalInvocation();
    const result = await engine.invoke(inv);
    expect(result.invocation_id).toBe("inv-plan-1");
    expect(result.status).toBe("success");
    expect(result.result_artifacts.length).toBe(1);
    expect(result.result_artifacts[0].artifact_kind).toBe("workflow_plan");
    validateEngineResult(result);
  });

  it("exports planning engine factories", () => {
    expect(createPlanningEngine).toBeDefined();
    expect(createStubPlanningEngine).toBeDefined();
  });
});
