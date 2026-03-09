/**
 * Classification engine – unit tests (EngineInvocation → EngineResult).
 */

import { createClassificationEngine } from "./classification_engine.js";
import type { EngineInvocation } from "../contracts/index.js";
import { validateEngineResult } from "../contracts/index.js";

function minimalInvocation(overrides: Partial<EngineInvocation> = {}): EngineInvocation {
  return {
    invocation_id: "inv-cls-1",
    engine_type: "classification",
    task: { task_id: "t1", task_type: "classify", category: "classification" },
    context_artifacts: [],
    ...overrides,
  };
}

describe("Classification Engine", () => {
  it("implements IEngine and returns valid EngineResult", async () => {
    const engine = createClassificationEngine();
    const inv = minimalInvocation();
    const result = await engine.invoke(inv);
    expect(result.invocation_id).toBe("inv-cls-1");
    expect(result.status).toBe("success");
    expect(result.result_artifacts.length).toBe(1);
    const content = result.result_artifacts[0].content as { inline?: { all_labels?: string[] } };
    expect(Array.isArray(content?.inline?.all_labels)).toBe(true);
    validateEngineResult(result);
  });
});
