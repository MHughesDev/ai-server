/**
 * Agent Harness Contract – data foundation after the orchestration layer.
 *
 * When a user query comes in it flows: Ingress → Brain stem → Control plane → Dispatch gate
 * (and optionally retrieval). This contract is the single shape that harnesses receive:
 * everything that is known and authorized at the moment we hand off to a pipeline.
 *
 * Build all agent/pipeline harnesses against AgentHarnessInput so they share one
 * data foundation and can rely on canonical request, intent, policy, plan, caller,
 * and optional retrieval context without re-deriving from raw request.
 *
 * @see docs/SPEC/02_API_Contracts.md, docs/ARCHITECTURE/Architecture_document_Finalized.md (orchestration flow)
 * @see L2-99 Deferred Coding Agent Harness Readiness Gate
 */

import { z } from "zod";
import { CanonicalRequestSchema } from "./canonical-request.js";
import { IntentBundleSchema } from "./intent-bundle.js";
import { PolicyDecisionSchema } from "./policy-decision.js";
import { PipelinePlanSchema } from "./pipeline-plan.js";

/** Caller identity and scope for harness (snake_case; maps from ingress CallerContext). */
export const HarnessCallerContextSchema = z.object({
  app_id: z.string().min(1),
  user_id: z.string().min(1),
  org_id: z.string().min(1),
  session_id: z.string().optional(),
  scopes: z.array(z.string()).default([]),
});
export type HarnessCallerContext = z.infer<typeof HarnessCallerContextSchema>;

/** Citation shape passed into harness (matches memory CitationSpec / response Citation). */
export const HarnessCitationSchema = z.object({
  source: z.string(),
  ref: z.string(),
  span: z.string().optional(),
});
export type HarnessCitation = z.infer<typeof HarnessCitationSchema>;

/** Optional retrieval context when memory/retrieval ran before the harness. */
export const RetrievalContextSchema = z.object({
  contextText: z.string(),
  citations: z.array(HarnessCitationSchema).default([]),
});
export type RetrievalContext = z.infer<typeof RetrievalContextSchema>;

/**
 * Post-orchestration input for agent/pipeline harnesses.
 * This is the only data foundation harnesses need; all fields are set by the time
 * the harness runs (after policy allow, route decision, and optional retrieval).
 */
export const AgentHarnessInputSchema = z.object({
  /** Normalized request (brain stem canonicalize). */
  canonical: CanonicalRequestSchema,
  /** Intent and routing signals (brain stem intent). */
  intent: IntentBundleSchema,
  /** Policy outcome: allowed, budgets, memory_scope, allowed_pipelines, etc. */
  policy: PolicyDecisionSchema,
  /** Concrete execution plan: pipeline_type, strategy, budgets, tools, memory. */
  plan: PipelinePlanSchema,
  /** Caller identity and scopes (from ingress). */
  caller: HarnessCallerContextSchema,
  /** Set when retrieval ran and returned context (L2-06). */
  retrievalContext: RetrievalContextSchema.optional(),
  /**
   * Epoch ms when `plan.budgets.deadline_ms` budget started (WANT-015).
   * Query handler sets this at request ingress so pipelines share one global clock.
   */
  request_started_at_ms: z.number().optional(),
});

export type AgentHarnessInput = z.infer<typeof AgentHarnessInputSchema>;

/** Validate AgentHarnessInput; throws ZodError on failure. */
export function validateAgentHarnessInput(data: unknown): AgentHarnessInput {
  return AgentHarnessInputSchema.parse(data);
}
