/**
 * Budget inheritance tests (M6 Segment K.4).
 * @see SOW Segment K – budget inheritance and trace continuity
 */

import { inheritBudgets } from "./budget-utils.js";
import type { PipelinePlan } from "../contracts/pipeline-plan.js";
import type { WorkflowDefinition } from "../contracts/workflow-definition.js";

describe("inheritBudgets", () => {
  const childDef: WorkflowDefinition = {
    workflow_id: "reactive_chat",
    version: "v1",
    steps: [],
    stop_conditions: { max_iterations: 1, deadline_ms: 30_000 },
  };

  it("returns child plan with pipeline_type from child definition", () => {
    const parent: PipelinePlan = {
      pipeline_type: "composite_example",
      strategy_id: "composite",
      execution_mode: "sync_stream",
      budgets: { token_budget: 4096, deadline_ms: 60_000 },
    };
    const child = inheritBudgets(parent, childDef);
    expect(child.pipeline_type).toBe("reactive_chat");
    expect(child.strategy_id).toBe("composite");
  });

  it("clamps deadline_ms to min(parent, child stop_conditions)", () => {
    const parent: PipelinePlan = {
      pipeline_type: "composite_example",
      execution_mode: "sync_stream",
      budgets: { token_budget: 1000, deadline_ms: 120_000 },
    };
    const child = inheritBudgets(parent, childDef);
    expect(child.budgets?.deadline_ms).toBe(30_000);
  });

  it("inherits token_budget and tool_budget from parent when child has no lower stop", () => {
    const parent: PipelinePlan = {
      pipeline_type: "composite_example",
      execution_mode: "sync_stream",
      budgets: { token_budget: 2048, tool_budget: 5, deadline_ms: 45_000 },
    };
    const child = inheritBudgets(parent, childDef);
    expect(child.budgets?.token_budget).toBe(2048);
    expect(child.budgets?.tool_budget).toBe(5);
    expect(child.budgets?.deadline_ms).toBe(30_000);
  });

  it("child exceeding parent deadline gets parent deadline when child has no stop_conditions", () => {
    const defNoStop: WorkflowDefinition = {
      workflow_id: "reactive_chat",
      version: "v1",
      steps: [],
    };
    const parent: PipelinePlan = {
      pipeline_type: "composite_example",
      execution_mode: "sync_stream",
      budgets: { deadline_ms: 10_000 },
    };
    const child = inheritBudgets(parent, defNoStop);
    expect(child.budgets?.deadline_ms).toBe(10_000);
  });

  it("passes through parent strategy_id when present", () => {
    const parent: PipelinePlan = {
      pipeline_type: "composite_example",
      strategy_id: "composite_example",
      execution_mode: "sync_stream",
      budgets: {},
    };
    const child = inheritBudgets(parent, childDef);
    expect(child.strategy_id).toBe("composite_example");
  });
});
