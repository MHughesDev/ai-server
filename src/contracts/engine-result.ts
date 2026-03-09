/**
 * EngineResult – standard output for every engine.
 * @see Architecture §8.6
 */

import { z } from "zod";
import { TypedArtifactSchema } from "./typed-artifact.js";

export const RESULT_STATUSES = ["success", "fail", "blocked"] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const ProposedNextActionTypeSchema = z.enum([
  "none",
  "call_tool",
  "invoke_workflow",
  "request_replan",
]);
export type ProposedNextActionType = z.infer<typeof ProposedNextActionTypeSchema>;

export const ProposedNextActionSchema = z.object({
  type: ProposedNextActionTypeSchema,
  ref: z.string().optional(),
  arguments: z.record(z.unknown()).optional(),
});
export type ProposedNextAction = z.infer<typeof ProposedNextActionSchema>;

export const EngineMetricsSchema = z.object({
  duration_ms: z.number().optional(),
  tokens_used: z.number().optional(),
  cost_estimate_usd: z.number().optional(),
});
export type EngineMetrics = z.infer<typeof EngineMetricsSchema>;

export const EngineErrorDetailSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  detail: z.record(z.unknown()).optional(),
});
export type EngineErrorDetail = z.infer<typeof EngineErrorDetailSchema>;

export const EngineResultSchema = z.object({
  invocation_id: z.string(),
  status: z.enum(RESULT_STATUSES),
  result_artifacts: z.array(TypedArtifactSchema).default([]),
  confidence: z.number().min(0).max(1).optional(),
  proposed_next_action: ProposedNextActionSchema.optional(),
  metrics: EngineMetricsSchema.optional(),
  error: EngineErrorDetailSchema.optional(),
});
export type EngineResult = z.infer<typeof EngineResultSchema>;
