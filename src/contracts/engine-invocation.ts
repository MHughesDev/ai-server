/**
 * EngineInvocation – standard input for every engine.
 * @see Architecture §8.6
 */

import { z } from "zod";
import { TaskSchema } from "./task.js";
import { TypedArtifactSchema } from "./typed-artifact.js";

export const ENGINE_TYPES = [
  "planning",
  "execution",
  "evaluation",
  "tool",
  "memory",
  "classification",
  "synthesis",
  "condensing",
] as const;
export type EngineType = (typeof ENGINE_TYPES)[number];

export const ActorContextSchema = z.object({
  org_id: z.string(),
  app_id: z.string(),
  user_id: z.string(),
  roles: z.array(z.string()).default([]),
});
export type ActorContext = z.infer<typeof ActorContextSchema>;

export const InvocationBudgetsSchema = z.object({
  token_budget: z.number().int().min(0).optional(),
  time_budget_ms: z.number().int().min(0).optional(),
  cost_budget_usd: z.number().min(0).optional(),
  tool_budget: z.number().int().min(0).optional(),
});
export type InvocationBudgets = z.infer<typeof InvocationBudgetsSchema>;

export const InvocationSafetySchema = z.object({
  safety_profile: z.enum(["standard", "strict", "regulated"]).optional(),
});
export type InvocationSafety = z.infer<typeof InvocationSafetySchema>;

export const InvocationMetadataSchema = z.object({
  trace_id: z.string().optional(),
  contract_version: z.string().optional(),
});
export type InvocationMetadata = z.infer<typeof InvocationMetadataSchema>;

export const EngineInvocationSchema = z.object({
  invocation_id: z.string(),
  engine_type: z.enum(ENGINE_TYPES),
  task: TaskSchema,
  context_artifacts: z.array(TypedArtifactSchema).default([]),
  actor_context: ActorContextSchema.optional(),
  budgets: InvocationBudgetsSchema.optional(),
  safety: InvocationSafetySchema.optional(),
  metadata: InvocationMetadataSchema.optional(),
});
export type EngineInvocation = z.infer<typeof EngineInvocationSchema>;
