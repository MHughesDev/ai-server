/**
 * Decision pipeline cumulative budget enforcement (WANT-014).
 */

import { describe, it, expect } from "@jest/globals";
import { createDecisionPipeline } from "./decision-pipeline.js";
import { validateAgentHarnessInput } from "../contracts/agent-harness-contract.js";
import type { IModelGateway } from "../gateways/types.js";

const RID = "550e8400-e29b-41d4-a716-446655440001";

function decisionInput(budgets: { token_budget: number; cost_budget_usd?: number }) {
  return validateAgentHarnessInput({
    canonical: {
      request_id: RID,
      text: "choose option",
      caller_app_id: "a1",
      caller_user_id: "u1",
      caller_org_id: "o1",
    },
    intent: {
      intents: ["decision"],
      confidence: 0.9,
      primary_intent: "chat",
      routing_hints: ["decision"],
    },
    policy: {
      allowed: true,
      allowed_pipelines: ["decision"],
      audit_level: "summary",
      redaction_level: "minimal",
    },
    plan: {
      pipeline_type: "decision",
      budgets,
    },
    caller: { app_id: "a1", user_id: "u1", org_id: "o1", scopes: [] },
  });
}

describe("createDecisionPipeline cumulative budgets (WANT-014)", () => {
  it("returns blocked BUDGET_EXCEEDED when cumulative tokens exceed budget across hops", async () => {
    let hop = 0;
    const modelGateway: IModelGateway = {
      complete() {
        hop += 1;
        return Promise.resolve({
          text: hop === 1 ? "options" : "memo",
          tokens_in: 1,
          tokens_out: hop === 1 ? 100 : 80,
          model: "stub",
          cost_usd_est: 0.01,
        });
      },
    };
    const pipeline = createDecisionPipeline({ modelGateway });
    const out = await pipeline.run(decisionInput({ token_budget: 150 }));
    expect(out.status).toBe("blocked");
    expect(out.error?.code).toBe("BUDGET_EXCEEDED");
    expect(out.error?.detail).toMatchObject({
      dimension: "token_budget",
      token_budget: 150,
    });
    expect((out.error?.detail as { tokens_used?: number }).tokens_used).toBeGreaterThan(150);
    expect(hop).toBeGreaterThanOrEqual(2);
  });

  it("returns blocked when cumulative cost exceeds cost_budget_usd", async () => {
    const modelGateway: IModelGateway = {
      complete() {
        return Promise.resolve({
          text: "step",
          tokens_in: 1,
          tokens_out: 1,
          model: "stub",
          cost_usd_est: 0.3,
        });
      },
    };
    const pipeline = createDecisionPipeline({ modelGateway });
    const out = await pipeline.run(decisionInput({ token_budget: 10_000, cost_budget_usd: 0.5 }));
    expect(out.status).toBe("blocked");
    expect(out.error?.detail).toMatchObject({ dimension: "cost_budget_usd" });
  });
});
