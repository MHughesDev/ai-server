/**
 * Coding agent harness — tool_budget enforcement (WANT-014).
 */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { createCodingAgentPipeline } from "./coding-agent-pipeline.js";
import { validateAgentHarnessInput } from "../contracts/agent-harness-contract.js";
import type { IModelGateway, IToolGateway } from "../gateways/types.js";

const RID = "550e8400-e29b-41d4-a716-446655440000";

function harnessInput(toolBudget: number) {
  return validateAgentHarnessInput({
    canonical: {
      request_id: RID,
      text: "run tool",
      caller_app_id: "a1",
      caller_user_id: "u1",
      caller_org_id: "o1",
    },
    intent: {
      intents: ["coding"],
      confidence: 0.9,
      primary_intent: "coding_agent",
    },
    policy: {
      allowed: true,
      allow_tools: ["stub_tool"],
      allowed_pipelines: ["coding_agent"],
      audit_level: "summary",
      redaction_level: "minimal",
    },
    plan: {
      pipeline_type: "coding_agent",
      harness_autonomous_execution: true,
      tools_enabled: ["stub_tool"],
      budgets: { tool_budget: toolBudget, token_budget: 2048 },
    },
    caller: { app_id: "a1", user_id: "u1", org_id: "o1", scopes: [] },
  });
}

describe("createCodingAgentPipeline deadline_ms (PR-023)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns DEADLINE_EXCEEDED when a hop exceeds plan deadline_ms", async () => {
    const modelGateway: IModelGateway = {
      complete() {
        return new Promise((resolve) => {
          setTimeout(
            () => resolve({ text: "slow", tokens_in: 1, tokens_out: 1, model: "stub" }),
            200
          );
        });
      },
    };
    const pipeline = createCodingAgentPipeline({ modelGateway });
    const input = validateAgentHarnessInput({
      ...harnessInput(0),
      plan: {
        ...harnessInput(0).plan,
        harness_autonomous_execution: false,
        tools_enabled: [],
        budgets: { token_budget: 2048, deadline_ms: 50 },
      },
    });
    const runPromise = pipeline.run(input);
    jest.advanceTimersByTime(60);
    const out = await runPromise;
    expect(out.status).toBe("error");
    expect(out.error?.code).toBe("DEADLINE_EXCEEDED");
  });
});

describe("createCodingAgentPipeline tool_budget (WANT-014)", () => {
  it("returns blocked BUDGET_EXCEEDED when model proposes a tool but tool_budget is 0", async () => {
    const modelGateway: IModelGateway = {
      complete() {
        return Promise.resolve({ text: "step", tokens_in: 1, tokens_out: 1, model: "stub" });
      },
    };
    const toolGateway: IToolGateway = {
      invoke(req) {
        return Promise.resolve({ allowed: true, tool_id: req.tool_id, result: { ok: true } });
      },
    };
    const pipeline = createCodingAgentPipeline({ modelGateway, toolGateway });
    const out = await pipeline.run(harnessInput(0));
    expect(out.status).toBe("blocked");
    expect(out.error?.code).toBe("BUDGET_EXCEEDED");
    expect(out.error?.detail).toMatchObject({
      dimension: "tool_budget",
      tool_budget: 0,
      tool_calls: 0,
    });
  });

  it("allows tool_budget greater than the old implicit cap of 10 (absolute cap still applies)", async () => {
    const toolInvoke = jest.fn((req: Parameters<IToolGateway["invoke"]>[0]) =>
      Promise.resolve({
        allowed: true as const,
        tool_id: req.tool_id,
        result: { echo: "ok" },
      })
    );
    const toolGateway: IToolGateway = { invoke: toolInvoke };
    const modelGateway: IModelGateway = {
      complete() {
        return Promise.resolve({ text: "step", tokens_in: 1, tokens_out: 1, model: "stub" });
      },
    };
    const pipeline = createCodingAgentPipeline({ modelGateway, toolGateway });
    const out = await pipeline.run(harnessInput(14));
    expect(toolInvoke.mock.calls.length).toBe(14);
    expect(out.status).toBe("blocked");
    expect(out.error?.code).toBe("BUDGET_EXCEEDED");
    expect(out.error?.detail).toMatchObject({ dimension: "tool_budget", tool_budget: 14 });
  });

  it("returns blocked BUDGET_EXCEEDED when cumulative tokens exceed budget in single-pass mode", async () => {
    let hop = 0;
    const modelGateway: IModelGateway = {
      complete() {
        hop += 1;
        return Promise.resolve({
          text: "step",
          tokens_in: 1,
          tokens_out: hop === 1 ? 120 : 50,
          model: "stub",
        });
      },
    };
    const pipeline = createCodingAgentPipeline({ modelGateway });
    const input = validateAgentHarnessInput({
      ...harnessInput(1),
      plan: {
        ...harnessInput(1).plan,
        harness_autonomous_execution: false,
        tools_enabled: [],
        budgets: { tool_budget: 0, token_budget: 150 },
      },
    });
    const out = await pipeline.run(input);
    expect(out.status).toBe("blocked");
    expect(out.error?.code).toBe("BUDGET_EXCEEDED");
    expect(out.error?.detail).toMatchObject({ dimension: "token_budget", token_budget: 150 });
  });
});
