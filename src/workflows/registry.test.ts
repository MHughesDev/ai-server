import { registerWorkflowDefinition, listRegisteredWorkflowIds } from "./registry.js";
import type { WorkflowDefinition } from "../contracts/workflow-definition.js";

function baseWorkflow(workflowId: string): WorkflowDefinition {
  return {
    workflow_id: workflowId,
    version: "v1",
    steps: [
      { step_id: "s1", kind: "engine_call", ref: "execution", depends_on: [] },
      { step_id: "s2", kind: "engine_call", ref: "synthesis", depends_on: ["s1"] },
    ],
    stop_conditions: { max_iterations: 1, deadline_ms: 1_000 },
  };
}

describe("workflow registry validation", () => {
  it("lists registered workflows for policy/catalog alignment", () => {
    const ids = listRegisteredWorkflowIds();
    expect(ids).toContain("reactive_chat");
    expect(ids).toContain("tool_automation");
  });

  it("rejects workflow registration with unknown dependency", () => {
    expect(() =>
      registerWorkflowDefinition({
        ...baseWorkflow("registry_unknown_dep_test"),
        steps: [{ step_id: "s1", kind: "engine_call", ref: "execution", depends_on: ["missing"] }],
      })
    ).toThrow(/unknown dependency/i);
  });

  it("rejects workflow registration with dependency cycle", () => {
    expect(() =>
      registerWorkflowDefinition({
        ...baseWorkflow("registry_cycle_test"),
        steps: [
          { step_id: "a", kind: "engine_call", ref: "execution", depends_on: ["b"] },
          { step_id: "b", kind: "engine_call", ref: "synthesis", depends_on: ["a"] },
        ],
      })
    ).toThrow(/cycle/i);
  });

  it("accepts decision step definitions with proper validation", () => {
    // Decision steps are now supported - verify valid decision step is accepted
    expect(() =>
      registerWorkflowDefinition({
        ...baseWorkflow("registry_decision_test"),
        steps: [
          { step_id: "s1", kind: "engine_call", ref: "execution", depends_on: [] },
          { step_id: "d1", kind: "decision", ref: "route", depends_on: ["s1"], branches: [{ condition: "score > 0.8", target_step: "s1" }] },
        ],
      })
    ).not.toThrow();
  });

  it("rejects decision step with invalid branch target", () => {
    expect(() =>
      registerWorkflowDefinition({
        ...baseWorkflow("registry_decision_invalid_branch"),
        steps: [
          { step_id: "d1", kind: "decision", ref: "route", depends_on: [], branches: [{ condition: "score > 0.8", target_step: "nonexistent" }] },
        ],
      })
    ).toThrow(/unknown branch target/i);
  });
});
