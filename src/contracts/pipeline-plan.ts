/**
 * PipelinePlan – internal Router output (concrete execution setup).
 * @see docs/ARCHITECTURE/Overview.md, docs/ARCHITECTURE/Architecture_document_Finalized.md (6.4), SPEC 13
 */

import { z } from "zod";

const BudgetsSchema = z.object({
  token_budget: z.number().int().min(0).optional(),
  tool_budget: z.number().int().min(0).optional(),
  deadline_ms: z.number().int().positive().optional(),
  cost_budget_usd: z.number().min(0).optional(),
});

const ConstraintsSchema = z.record(z.unknown()).optional();

const VerificationSchema = z
  .object({
    enabled: z.boolean(),
    checks: z.array(z.string()).optional(),
  })
  .optional();

export const PipelinePlanSchema = z.object({
  pipeline_type: z.string(),
  strategy_id: z.string().optional(),
  execution_mode: z.literal("sync_stream").default("sync_stream"),
  /**
   * When true, coding_agent may run the autonomous harness loop (tool iterations).
   * Resolved by the router from policy + feature flags — pipelines must not re-decide independently (WANT-004).
   */
  harness_autonomous_execution: z.boolean().optional(),
  budgets: BudgetsSchema.optional(),
  constraints: ConstraintsSchema,
  verification_level: z.enum(["none", "basic", "strict"]).default("basic"),
  /** Optional fallback plan (structure matches PipelinePlan; no deep validation here) */
  fallback_plan: z.record(z.unknown()).optional(),
  /** Model set for this plan (optional) */
  models: z
    .object({
      planner: z.string().optional(),
      executor: z.string().optional(),
      vision: z.string().optional(),
    })
    .optional(),
  /** Tools enabled for this run */
  tools_enabled: z.array(z.string()).default([]),
  /** L2-05: Sandbox options for tool execution (Architecture §12). */
  sandbox: z
    .object({
      timeout_ms: z.number().int().positive().optional(),
      network_access: z.boolean().optional(),
      filesystem_access: z.boolean().optional(),
    })
    .optional(),
  /** Memory config */
  memory: z
    .object({
      retrieval: z.string().optional(),
      top_k: z.number().int().min(0).optional(),
    })
    .optional(),
  verification: VerificationSchema,
});

export type PipelinePlan = z.infer<typeof PipelinePlanSchema>;
export type PipelineBudgets = z.infer<typeof BudgetsSchema>;
