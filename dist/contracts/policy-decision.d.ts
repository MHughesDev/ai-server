/**
 * PolicyDecision – internal Control Plane output (allow/deny + budgets).
 * @see Docs/Overview.md, Docs/Architecture.md (6.3), SPEC 07, L2-03
 */
import { z } from "zod";
import type { ErrorCode } from "./errors.js";
declare const MaxBudgetsSchema: z.ZodObject<{
    token_budget: z.ZodOptional<z.ZodNumber>;
    tool_budget: z.ZodOptional<z.ZodNumber>;
    deadline_ms: z.ZodOptional<z.ZodNumber>;
    cost_budget_usd: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    deadline_ms?: number | undefined;
    token_budget?: number | undefined;
    tool_budget?: number | undefined;
    cost_budget_usd?: number | undefined;
}, {
    deadline_ms?: number | undefined;
    token_budget?: number | undefined;
    tool_budget?: number | undefined;
    cost_budget_usd?: number | undefined;
}>;
/** Deny reason codes mapped to API error taxonomy (L2-03 GOV-002) */
export declare const POLICY_DENY_REASONS: readonly ["POLICY_BLOCKED", "BUDGET_EXCEEDED", "AUTH_INVALID", "RATE_LIMITED"];
export type PolicyDenyReason = (typeof POLICY_DENY_REASONS)[number];
export declare function isPolicyDenyReason(s: string): s is PolicyDenyReason;
/** Ensures policy deny reason is a valid ErrorCode for response taxonomy */
export declare function policyDenyReasonToErrorCode(reason: PolicyDenyReason): ErrorCode;
export declare const PolicyDecisionSchema: z.ZodObject<{
    /** If false, request must not proceed; deny_reason set to taxonomy code. Default true for backward compat. */
    allowed: z.ZodDefault<z.ZodBoolean>;
    /** Set when allowed is false; one of POLICY_BLOCKED, BUDGET_EXCEEDED, AUTH_INVALID, RATE_LIMITED */
    deny_reason: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
    allow_tools: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    deny_tools: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    memory_scope: z.ZodDefault<z.ZodEnum<["user", "project", "org", "none"]>>;
    max_budgets: z.ZodOptional<z.ZodObject<{
        token_budget: z.ZodOptional<z.ZodNumber>;
        tool_budget: z.ZodOptional<z.ZodNumber>;
        deadline_ms: z.ZodOptional<z.ZodNumber>;
        cost_budget_usd: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        deadline_ms?: number | undefined;
        token_budget?: number | undefined;
        tool_budget?: number | undefined;
        cost_budget_usd?: number | undefined;
    }, {
        deadline_ms?: number | undefined;
        token_budget?: number | undefined;
        tool_budget?: number | undefined;
        cost_budget_usd?: number | undefined;
    }>>;
    safety_profile: z.ZodDefault<z.ZodEnum<["standard", "strict", "internal"]>>;
    redaction_level: z.ZodDefault<z.ZodEnum<["none", "minimal", "full"]>>;
    audit_level: z.ZodDefault<z.ZodEnum<["none", "summary", "full"]>>;
    /** Allowed pipeline types (chat, rag, tool_agent, etc.) */
    allowed_pipelines: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Strategy hint: reactive, planner_executor, etc. */
    strategy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    allowed: boolean;
    allow_tools: string[];
    deny_tools: string[];
    memory_scope: "user" | "project" | "org" | "none";
    safety_profile: "standard" | "strict" | "internal";
    redaction_level: "none" | "minimal" | "full";
    audit_level: "none" | "full" | "summary";
    allowed_pipelines: string[];
    deny_reason?: string | undefined;
    max_budgets?: {
        deadline_ms?: number | undefined;
        token_budget?: number | undefined;
        tool_budget?: number | undefined;
        cost_budget_usd?: number | undefined;
    } | undefined;
    strategy?: string | undefined;
}, {
    allowed?: boolean | undefined;
    deny_reason?: string | undefined;
    allow_tools?: string[] | undefined;
    deny_tools?: string[] | undefined;
    memory_scope?: "user" | "project" | "org" | "none" | undefined;
    max_budgets?: {
        deadline_ms?: number | undefined;
        token_budget?: number | undefined;
        tool_budget?: number | undefined;
        cost_budget_usd?: number | undefined;
    } | undefined;
    safety_profile?: "standard" | "strict" | "internal" | undefined;
    redaction_level?: "none" | "minimal" | "full" | undefined;
    audit_level?: "none" | "full" | "summary" | undefined;
    allowed_pipelines?: string[] | undefined;
    strategy?: string | undefined;
}>;
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;
export type MaxBudgets = z.infer<typeof MaxBudgetsSchema>;
export {};
//# sourceMappingURL=policy-decision.d.ts.map