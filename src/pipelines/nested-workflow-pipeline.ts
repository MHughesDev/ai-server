/**
 * Nested workflow pipeline – runs workflows that may contain workflow_call steps (M6).
 * Delegates to workflow runner with getEngine and getPipelineForWorkflow from query-handler.
 * @see SOW Segment K, Architecture §9.4
 */

import type { IPipeline, PipelineInput } from "./types.js";
import type { ResponseEnvelope } from "../contracts/response-envelope.js";
import { runWorkflow, type WorkflowRunnerDeps } from "../workflows/runner.js";

export interface NestedWorkflowPipelineOptions {
  runnerDeps: WorkflowRunnerDeps;
}

/**
 * Create a pipeline that runs the workflow specified in input.plan.pipeline_type
 * via the workflow runner (supports workflow_call and engine_call steps).
 */
export function createNestedWorkflowPipeline(options: NestedWorkflowPipelineOptions): IPipeline {
  const { runnerDeps } = options;

  return {
    async run(input: PipelineInput): Promise<ResponseEnvelope> {
      const workflowId = input.plan.pipeline_type;
      return runWorkflow({
        workflowId,
        version: "v1",
        input,
        deps: runnerDeps,
      });
    },
  };
}
