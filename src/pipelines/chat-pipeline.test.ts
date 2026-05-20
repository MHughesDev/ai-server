/**
 * Chat pipeline cumulative budget enforcement (WANT-014).
 */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { createChatPipeline } from "./chat-pipeline.js";
import { validateAgentHarnessInput } from "../contracts/agent-harness-contract.js";
import type { IModelGateway } from "../gateways/types.js";

const RID = "550e8400-e29b-41d4-a716-446655440002";

function chatInput(tokenBudget: number) {
  return validateAgentHarnessInput({
    canonical: {
      request_id: RID,
      text: "hello",
      caller_app_id: "a1",
      caller_user_id: "u1",
      caller_org_id: "o1",
    },
    intent: {
      intents: ["chat"],
      confidence: 0.9,
      primary_intent: "chat",
    },
    policy: {
      allowed: true,
      allowed_pipelines: ["reactive_chat"],
      audit_level: "summary",
      redaction_level: "minimal",
    },
    plan: {
      pipeline_type: "reactive_chat",
      budgets: { token_budget: tokenBudget },
    },
    caller: { app_id: "a1", user_id: "u1", org_id: "o1", scopes: [] },
  });
}

describe("createChatPipeline deadline_ms (WANT-015)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns DEADLINE_EXCEEDED when request_started_at_ms anchor already exhausted", async () => {
    const anchor = Date.now();
    jest.advanceTimersByTime(100);
    const modelGateway: IModelGateway = {
      complete() {
        return Promise.resolve({ text: "ok", tokens_in: 1, tokens_out: 1, model: "stub" });
      },
    };
    const input = validateAgentHarnessInput({
      ...chatInput(2048),
      request_started_at_ms: anchor,
      plan: { pipeline_type: "reactive_chat", budgets: { token_budget: 2048, deadline_ms: 50 } },
    });
    const pipeline = createChatPipeline(modelGateway);
    const runPromise = pipeline.run(input);
    jest.advanceTimersByTime(1);
    const out = await runPromise;
    expect(out.status).toBe("error");
    expect(out.error?.code).toBe("DEADLINE_EXCEEDED");
  });
});

describe("createChatPipeline cumulative budgets (WANT-014)", () => {
  it("returns blocked BUDGET_EXCEEDED when execution + synthesis tokens exceed budget", async () => {
    let hop = 0;
    const modelGateway: IModelGateway = {
      complete() {
        hop += 1;
        return Promise.resolve({
          text: "reply",
          tokens_in: 1,
          tokens_out: hop === 1 ? 100 : 60,
          model: "stub",
        });
      },
    };
    const pipeline = createChatPipeline(modelGateway);
    const out = await pipeline.run(chatInput(150));
    expect(out.status).toBe("blocked");
    expect(out.error?.code).toBe("BUDGET_EXCEEDED");
    expect(out.error?.detail).toMatchObject({ dimension: "token_budget", token_budget: 150 });
    expect(hop).toBe(2);
  });
});
