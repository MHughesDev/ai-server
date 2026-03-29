import { runWorkflow } from "./runner.js";
import { registerWorkflowDefinition } from "./registry.js";
import type { WorkflowDefinition } from "../contracts/workflow-definition.js";
import type { IEngine } from "../engines/base.js";
import type { PipelineInput } from "../pipelines/types.js";

function makeInput(workflowId: string, budgets?: PipelineInput["plan"]["budgets"]): PipelineInput {
  return {
    canonical: {
      request_id: "550e8400-e29b-41d4-a716-446655440000",
      modalities: ["text"],
      text: "hello",
      attachments: [],
      token_estimate: 10,
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
      allow_tools: [],
      deny_tools: [],
      memory_scope: "none",
      allowed_pipelines: [workflowId],
    },
    plan: {
      pipeline_type: workflowId,
      strategy_id: "test",
      execution_mode: "sync_stream",
      budgets,
      tools_enabled: [],
      verification_level: "basic",
    },
    caller: {
      app_id: "a1",
      user_id: "u1",
      org_id: "o1",
      scopes: [],
    },
  };
}

function makeWorkflow(workflowId: string, stopConditions: WorkflowDefinition["stop_conditions"]): WorkflowDefinition {
  return {
    workflow_id: workflowId,
    version: "v1",
    steps: [
      { step_id: "s1", kind: "engine_call", ref: "execution", depends_on: [] },
      { step_id: "s2", kind: "engine_call", ref: "synthesis", depends_on: ["s1"] },
    ],
    stop_conditions: stopConditions,
  };
}

describe("workflow runner budget enforcement", () => {
  it("enforces stop_conditions.deadline_ms centrally", async () => {
    const workflowId = "runner_deadline_test";
    registerWorkflowDefinition(makeWorkflow(workflowId, { max_iterations: 1, deadline_ms: 1 }));
    const slowEngine: IEngine = {
      async invoke() {
        await new Promise((r) => setTimeout(r, 5));
        return {
          invocation_id: "inv-1",
          status: "success",
          result_artifacts: [{ artifact_id: "a1", artifact_kind: "report", encoding: "text", content: { inline: "ok" } }],
          metrics: { cost_estimate_usd: 0.01, tokens_used: 1, duration_ms: 5 },
        };
      },
    };
    const response = await runWorkflow({
      workflowId,
      input: makeInput(workflowId, { deadline_ms: 10_000 }),
      deps: { getEngine: () => slowEngine, getPipelineForWorkflow: () => undefined },
    });
    expect(response.status).toBe("blocked");
    expect(response.error?.code).toBe("BUDGET_EXCEEDED");
    expect(response.error?.detail).toMatchObject({ dimension: "deadline_ms" });
  });

  it("enforces cost_budget_usd during workflow execution", async () => {
    const workflowId = "runner_cost_test";
    registerWorkflowDefinition(makeWorkflow(workflowId, { max_iterations: 1, deadline_ms: 10_000 }));
    const costEngine: IEngine = {
      async invoke() {
        await Promise.resolve();
        return {
          invocation_id: "inv-cost",
          status: "success",
          result_artifacts: [{ artifact_id: "a1", artifact_kind: "report", encoding: "text", content: { inline: "ok" } }],
          metrics: { cost_estimate_usd: 0.2, tokens_used: 1, duration_ms: 1 },
        };
      },
    };
    const response = await runWorkflow({
      workflowId,
      input: makeInput(workflowId, { cost_budget_usd: 0.3, deadline_ms: 10_000 }),
      deps: { getEngine: () => costEngine, getPipelineForWorkflow: () => undefined },
    });
    expect(response.status).toBe("blocked");
    expect(response.error?.code).toBe("BUDGET_EXCEEDED");
    expect(response.error?.detail).toMatchObject({ dimension: "cost_budget_usd" });
  });

  it("enforces plan tool_budget across tool engine_call steps", async () => {
    const workflowId = "runner_tool_budget_test";
    registerWorkflowDefinition({
      workflow_id: workflowId,
      version: "v1",
      steps: [
        { step_id: "t1", kind: "engine_call", ref: "tool", depends_on: [] },
        { step_id: "t2", kind: "engine_call", ref: "tool", depends_on: ["t1"] },
      ],
      stop_conditions: { max_iterations: 1, deadline_ms: 10_000 },
    });
    const toolEngine: IEngine = {
      async invoke() {
        await Promise.resolve();
        return {
          invocation_id: "inv-tool",
          status: "success",
          result_artifacts: [
            {
              artifact_id: "a1",
              artifact_kind: "report",
              encoding: "text",
              content: { inline: "ok" },
            },
          ],
          metrics: { duration_ms: 1 },
        };
      },
    };
    const response = await runWorkflow({
      workflowId,
      input: makeInput(workflowId, { tool_budget: 1, deadline_ms: 10_000 }),
      deps: { getEngine: (ref) => (ref === "tool" ? toolEngine : undefined), getPipelineForWorkflow: () => undefined },
    });
    expect(response.status).toBe("blocked");
    expect(response.error?.code).toBe("BUDGET_EXCEEDED");
    expect(response.error?.detail).toMatchObject({
      dimension: "tool_budget",
      tool_budget: 1,
      tool_calls: 1,
    });
    expect(response.telemetry?.tool_calls).toBe(1);
  });

  it("enforces token_budget cumulatively across engine_call steps (WANT-014)", async () => {
    const workflowId = "runner_token_budget_cumulative";
    registerWorkflowDefinition(makeWorkflow(workflowId, { max_iterations: 1, deadline_ms: 10_000 }));
    let invocations = 0;
    const tokenEngine: IEngine = {
      async invoke() {
        invocations += 1;
        await Promise.resolve();
        return {
          invocation_id: `inv-${invocations}`,
          status: "success",
          result_artifacts: [
            { artifact_id: "a1", artifact_kind: "report", encoding: "text", content: { inline: "ok" } },
          ],
          metrics: { tokens_used: 100, duration_ms: 1 },
        };
      },
    };
    const response = await runWorkflow({
      workflowId,
      input: makeInput(workflowId, { token_budget: 150, deadline_ms: 10_000 }),
      deps: { getEngine: () => tokenEngine, getPipelineForWorkflow: () => undefined },
    });
    expect(response.status).toBe("blocked");
    expect(response.error?.code).toBe("BUDGET_EXCEEDED");
    expect(response.error?.detail).toMatchObject({
      dimension: "token_budget",
      token_budget: 150,
      tokens_used: 200,
    });
    expect(invocations).toBe(2);
  });

  it("blocks tool steps when tool_budget is zero", async () => {
    const workflowId = "runner_tool_budget_zero";
    registerWorkflowDefinition({
      workflow_id: workflowId,
      version: "v1",
      steps: [{ step_id: "t1", kind: "engine_call", ref: "tool", depends_on: [] }],
      stop_conditions: { max_iterations: 1, deadline_ms: 10_000 },
    });
    const response = await runWorkflow({
      workflowId,
      input: makeInput(workflowId, { tool_budget: 0, deadline_ms: 10_000 }),
      deps: {
        getEngine: () => ({
          invoke() {
            return Promise.resolve({
              invocation_id: "x",
              status: "success",
              result_artifacts: [],
              metrics: {},
            });
          },
        }),
        getPipelineForWorkflow: () => undefined,
      },
    });
    expect(response.status).toBe("blocked");
    expect(response.error?.detail).toMatchObject({ dimension: "tool_budget", tool_budget: 0 });
  });
});
