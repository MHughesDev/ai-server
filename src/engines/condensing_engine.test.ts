/**
 * Condensing engine – unit tests (EngineInvocation → EngineResult).
 */

import { createCondensingEngine, createStubCondensingEngine } from "./condensing_engine.js";
import { StubModelGateway } from "../gateways/model-gateway.js";
import type { EngineInvocation } from "../contracts/index.js";
import { validateEngineResult } from "../contracts/index.js";

function minimalInvocation(overrides: Partial<EngineInvocation> = {}): EngineInvocation {
  return {
    invocation_id: "inv-cond-1",
    engine_type: "condensing",
    task: {
      task_id: "t1",
      task_type: "condense",
      category: "transformation",
      objective: { description: "Summarize the content" },
    },
    context_artifacts: [],
    ...overrides,
  };
}

describe("Condensing Engine", () => {
  it("implements IEngine and returns valid EngineResult (stub)", async () => {
    const engine = createStubCondensingEngine();
    const inv = minimalInvocation();
    const result = await engine.invoke(inv);
    expect(result.invocation_id).toBe("inv-cond-1");
    expect(result.status).toBe("success");
    expect(Array.isArray(result.result_artifacts)).toBe(true);
    expect(result.result_artifacts.length).toBe(1);
    expect(result.result_artifacts[0].artifact_kind).toBe("report");
    expect(typeof (result.result_artifacts[0].content as { inline?: string })?.inline).toBe("string");
    validateEngineResult(result);
  });

  it("returns valid EngineResult when using Model Gateway", async () => {
    const gateway = new StubModelGateway();
    const engine = createCondensingEngine(gateway);
    const inv = minimalInvocation({
      context_artifacts: [
        {
          artifact_id: "a1",
          artifact_kind: "report",
          encoding: "text",
          content: { inline: "Long text to condense here." },
        },
      ],
    });
    const result = await engine.invoke(inv);
    expect(result.invocation_id).toBe("inv-cond-1");
    expect(result.status).toBe("success");
    expect(result.result_artifacts.length).toBe(1);
    validateEngineResult(result);
  });
});
