/**
 * PolicyDecision – internal Control Plane output (allow/deny + budgets).
 * @see docs/ARCHITECTURE/Overview.md, docs/ARCHITECTURE/Architecture_document_Finalized.md (6.3), SPEC 07, L2-03
 */

import { z } from "zod";
import type { ErrorCode } from "./errors.js";
import { ERROR_CODES } from "./errors.js";

const MaxBudgetsSchema = z.object({
  token_budget: z.number().int().min(0).optional(),
  tool_budget: z.number().int().min(0).optional(),
  deadline_ms: z.number().int().positive().optional(),
  cost_budget_usd: z.number().min(0).optional(),
});

const MemoryScopeSchema = z.enum(["user", "project", "org", "none"]);

/** Deny reason codes mapped to API error taxonomy (L2-03 GOV-002) */
export const POLICY_DENY_REASONS = [
  "POLICY_BLOCKED",
  "BUDGET_EXCEEDED",
  "AUTH_INVALID",
  "RATE_LIMITED",
] as const;
export type PolicyDenyReason = (typeof POLICY_DENY_REASONS)[number];

export function isPolicyDenyReason(s: string): s is PolicyDenyReason {
  return (POLICY_DENY_REASONS as readonly string[]).includes(s);
}

/** Ensures policy deny reason is a valid ErrorCode for response taxonomy */
export function policyDenyReasonToErrorCode(reason: PolicyDenyReason): ErrorCode {
  if (ERROR_CODES.includes(reason as ErrorCode)) return reason as ErrorCode;
  return "POLICY_BLOCKED";
}

export const PolicyDecisionSchema = z.object({
  /** If false, request must not proceed; deny_reason set to taxonomy code. Default true for backward compat. */
  allowed: z.boolean().default(true),
  /** Set when allowed is false; one of POLICY_BLOCKED, BUDGET_EXCEEDED, AUTH_INVALID, RATE_LIMITED */
  deny_reason: z.enum(POLICY_DENY_REASONS as unknown as [string, ...string[]]).optional(),
  allow_tools: z.array(z.string()).default([]),
  deny_tools: z.array(z.string()).default([]),
  memory_scope: MemoryScopeSchema.default("none"),
  max_budgets: MaxBudgetsSchema.optional(),
  safety_profile: z.enum(["standard", "strict", "internal"]).default("standard"),
  redaction_level: z.enum(["none", "minimal", "full"]).default("minimal"),
  audit_level: z.enum(["none", "summary", "full"]).default("summary"),
  /** Allowed pipeline types (chat, rag, tool_agent, etc.) */
  allowed_pipelines: z.array(z.string()).default([]),
  /** Strategy hint: reactive, planner_executor, etc. */
  strategy: z.string().optional(),
});

export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;
export type MaxBudgets = z.infer<typeof MaxBudgetsSchema>;
