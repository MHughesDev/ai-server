/**
 * Orchestrator execution spec and harness loop caps (WANT-004).
 */

import { describe, it, expect } from "@jest/globals";
import type { PipelinePlan } from "../contracts/pipeline-plan.js";
import {
  applyOrchestratorToPipelinePlan,
  resolveMaxHarnessIterations,
  resolveOrchestratorExecutionSpec,
  scaleTokenBudgetForHarness,
} from "./index.js";

function codingAgentPlan(overrides: Partial<PipelinePlan> = {}): PipelinePlan {
  return {
    pipeline_type: "coding_agent",
    execution_mode: "sync_stream",
    verification_level: "basic",
    tools_enabled: ["stub_tool"],
    ...overrides,
  };
}

describe("resolveOrchestratorExecutionSpec (WANT-004)", () => {
  it("does not enable harness without harness_autonomous_execution on plan", () => {
    const spec = resolveOrchestratorExecutionSpec(
      codingAgentPlan({ harness_autonomous_execution: undefined })
    );
    expect(spec.harness_autonomous_execution).toBe(false);
  });

  it("does not enable harness when flag is set but tools_enabled is empty", () => {
    const spec = resolveOrchestratorExecutionSpec(
      codingAgentPlan({
        harness_autonomous_execution: true,
        tools_enabled: [],
      })
    );
    expect(spec.harness_autonomous_execution).toBe(false);
  });

  it("enables harness only when plan flag and tools are present", () => {
    const spec = resolveOrchestratorExecutionSpec(
      codingAgentPlan({ harness_autonomous_execution: true })
    );
    expect(spec.harness_autonomous_execution).toBe(true);
    expect(spec.max_harness_iterations).toBe(resolveMaxHarnessIterations(spec.budgets.tool_budget));
  });

  it("scales token budget for harness runs", () => {
    const spec = resolveOrchestratorExecutionSpec(
      codingAgentPlan({
        harness_autonomous_execution: true,
        budgets: { token_budget: 4096, tool_budget: 10 },
      })
    );
    expect(spec.budgets.token_budget).toBe(scaleTokenBudgetForHarness(4096));
  });

  it("leaves token budget unchanged for non-harness plans", () => {
    const spec = resolveOrchestratorExecutionSpec(
      codingAgentPlan({ budgets: { token_budget: 1000, tool_budget: 3 } })
    );
    expect(spec.budgets.token_budget).toBe(1000);
  });
});

describe("applyOrchestratorToPipelinePlan (WANT-004)", () => {
  it("writes normalized budgets onto the plan copy", () => {
    const normalized = applyOrchestratorToPipelinePlan(
      codingAgentPlan({
        harness_autonomous_execution: true,
        budgets: { token_budget: 4096, tool_budget: 7 },
      })
    );
    expect(normalized.budgets?.token_budget).toBe(scaleTokenBudgetForHarness(4096));
    expect(normalized.budgets?.tool_budget).toBe(7);
    expect(normalized.harness_autonomous_execution).toBe(true);
  });
});

describe("resolveMaxHarnessIterations", () => {
  it("includes one probe iteration beyond tool_budget", () => {
    expect(resolveMaxHarnessIterations(0)).toBe(1);
    expect(resolveMaxHarnessIterations(14)).toBe(15);
  });
});
