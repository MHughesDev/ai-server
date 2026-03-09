/**
 * WorkflowDefinition – versioned graph template for Layer 3 workflows.
 * @see Architecture §8.7
 */

import { z } from "zod";

export const EntryConditionsSchema = z.object({
  intents: z.array(z.string()).optional(),
  required_capabilities: z
    .object({
      needs_memory: z.boolean().optional(),
      needs_tools: z.array(z.string()).optional(),
      needs_verification: z.boolean().optional(),
    })
    .optional(),
  risk_allowed: z.array(z.string()).optional(),
});
export type EntryConditions = z.infer<typeof EntryConditionsSchema>;

export const WORKFLOW_STEP_KINDS = ["engine_call", "workflow_call", "decision"] as const;
export type WorkflowStepKind = (typeof WORKFLOW_STEP_KINDS)[number];

/** Decision branch configuration */
export const DecisionBranchSchema = z.object({
  condition: z.string(), // Expression like "score > 0.8" or "label == 'urgent'"
  target_step: z.string(), // Step ID to jump to when condition is true
});
export type DecisionBranch = z.infer<typeof DecisionBranchSchema>;

export const WorkflowStepSchema = z.object({
  step_id: z.string(),
  kind: z.enum(WORKFLOW_STEP_KINDS),
  ref: z.string(),
  input_mapping: z.record(z.unknown()).optional(),
  depends_on: z.array(z.string()).optional(),
  /** For decision steps: defines branching logic based on previous step results */
  branches: z.array(DecisionBranchSchema).optional(),
  /** Default target step if no branch conditions match (for decision steps) */
  default_target: z.string().optional(),
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const StopConditionsSchema = z.object({
  max_iterations: z.number().int().positive().optional(),
  deadline_ms: z.number().int().positive().optional(),
});
export type StopConditions = z.infer<typeof StopConditionsSchema>;

export const WorkflowDefinitionSchema = z.object({
  workflow_id: z.string(),
  version: z.string(),
  entry_conditions: EntryConditionsSchema.optional(),
  steps: z.array(WorkflowStepSchema),
  stop_conditions: StopConditionsSchema.optional(),
}).superRefine((def, ctx) => {
  const stepIds = new Set<string>();
  for (let i = 0; i < def.steps.length; i++) {
    const step = def.steps[i];
    // Decision steps are now supported
    if (stepIds.has(step.step_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate step_id: ${step.step_id}`,
        path: ["steps", i, "step_id"],
      });
      continue;
    }
    stepIds.add(step.step_id);
  }

  // Validate dependencies and branch targets exist
  for (let i = 0; i < def.steps.length; i++) {
    const step = def.steps[i];
    for (const dep of step.depends_on ?? []) {
      if (!stepIds.has(dep)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `unknown dependency '${dep}' for step '${step.step_id}'`,
          path: ["steps", i, "depends_on"],
        });
      }
    }
    // Validate decision branch targets
    if (step.kind === "decision") {
      for (const branch of step.branches ?? []) {
        if (!stepIds.has(branch.target_step)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `decision step '${step.step_id}' has unknown branch target '${branch.target_step}'`,
            path: ["steps", i, "branches"],
          });
        }
      }
      if (step.default_target && !stepIds.has(step.default_target)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `decision step '${step.step_id}' has unknown default_target '${step.default_target}'`,
          path: ["steps", i, "default_target"],
        });
      }
    }
  }

  // Cycle detection using DFS
  const adjacency = new Map<string, string[]>();
  for (const step of def.steps) {
    const deps = [...(step.depends_on ?? [])];
    // Add branch targets as edges for cycle detection
    if (step.kind === "decision") {
      for (const branch of step.branches ?? []) {
        deps.push(branch.target_step);
      }
      if (step.default_target) {
        deps.push(step.default_target);
      }
    }
    adjacency.set(step.step_id, deps);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const hasCycleFrom = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const dep of adjacency.get(node) ?? []) {
      if (adjacency.has(dep) && hasCycleFrom(dep)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  for (const node of adjacency.keys()) {
    if (hasCycleFrom(node)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `workflow dependency cycle detected near step '${node}'`,
        path: ["steps"],
      });
      break;
    }
  }
});
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
