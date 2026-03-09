/**
 * Task – unit of work within a workflow.
 * @see Architecture §8.5
 */

import { z } from "zod";
import { TypedArtifactSchema } from "./typed-artifact.js";

export const TASK_CATEGORIES = [
  "analysis",
  "transformation",
  "generation",
  "evaluation",
  "action",
  "classification",
  "retrieval",
  "synthesis",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const TaskObjectiveSchema = z.object({
  formal_spec: z.record(z.unknown()).optional(),
  description: z.string().optional(),
});
export type TaskObjective = z.infer<typeof TaskObjectiveSchema>;

export const TaskConstraintsSchema = z.object({
  latency_class: z.enum(["interactive", "batch", "long_horizon"]).optional(),
  accuracy_level: z.enum(["approximate", "high_precision"]).optional(),
  deterministic_required: z.boolean().optional(),
});
export type TaskConstraints = z.infer<typeof TaskConstraintsSchema>;

export const TaskSchema = z.object({
  task_id: z.string(),
  task_type: z.string(),
  category: z.enum(TASK_CATEGORIES),
  objective: TaskObjectiveSchema.optional(),
  input_artifacts: z.array(TypedArtifactSchema).default([]),
  expected_output_schema: z.record(z.unknown()).optional(),
  constraints_hints: TaskConstraintsSchema.optional(),
});
export type Task = z.infer<typeof TaskSchema>;
