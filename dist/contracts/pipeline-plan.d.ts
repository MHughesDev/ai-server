/**
 * PipelinePlan – internal Router output (concrete execution setup).
 * @see docs/ARCHITECTURE/Overview.md, docs/ARCHITECTURE/Architecture_document_Finalized.md (6.4), SPEC 13
 */
import { z } from "zod";
declare const BudgetsSchema: z.ZodObject<{
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
export declare const PipelinePlanSchema: z.ZodObject<{
    pipeline_type: z.ZodString;
    strategy_id: z.ZodOptional<z.ZodString>;
    execution_mode: z.ZodDefault<z.ZodLiteral<"sync_stream">>;
    /**
     * When true, coding_agent may run the autonomous harness loop (tool iterations).
     * Resolved by the router from policy + feature flags — pipelines must not re-decide independently (WANT-004).
     */
    harness_autonomous_execution: z.ZodOptional<z.ZodBoolean>;
    budgets: z.ZodOptional<z.ZodObject<{
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
    constraints: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    verification_level: z.ZodDefault<z.ZodEnum<["none", "basic", "strict"]>>;
    /** Optional fallback plan (structure matches PipelinePlan; no deep validation here) */
    fallback_plan: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    /** Model set for this plan (optional) */
    models: z.ZodOptional<z.ZodObject<{
        planner: z.ZodOptional<z.ZodString>;
        executor: z.ZodOptional<z.ZodString>;
        vision: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        planner?: string | undefined;
        executor?: string | undefined;
        vision?: string | undefined;
    }, {
        planner?: string | undefined;
        executor?: string | undefined;
        vision?: string | undefined;
    }>>;
    /** Tools enabled for this run */
    tools_enabled: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** L2-05: Sandbox options for tool execution (Architecture §12). */
    sandbox: z.ZodOptional<z.ZodObject<{
        timeout_ms: z.ZodOptional<z.ZodNumber>;
        network_access: z.ZodOptional<z.ZodBoolean>;
        filesystem_access: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        timeout_ms?: number | undefined;
        network_access?: boolean | undefined;
        filesystem_access?: boolean | undefined;
    }, {
        timeout_ms?: number | undefined;
        network_access?: boolean | undefined;
        filesystem_access?: boolean | undefined;
    }>>;
    /** Memory config */
    memory: z.ZodOptional<z.ZodObject<{
        retrieval: z.ZodOptional<z.ZodString>;
        top_k: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        retrieval?: string | undefined;
        top_k?: number | undefined;
    }, {
        retrieval?: string | undefined;
        top_k?: number | undefined;
    }>>;
    verification: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        checks: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        checks?: string[] | undefined;
    }, {
        enabled: boolean;
        checks?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    pipeline_type: string;
    execution_mode: "sync_stream";
    verification_level: "strict" | "none" | "basic";
    tools_enabled: string[];
    memory?: {
        retrieval?: string | undefined;
        top_k?: number | undefined;
    } | undefined;
    strategy_id?: string | undefined;
    harness_autonomous_execution?: boolean | undefined;
    budgets?: {
        deadline_ms?: number | undefined;
        token_budget?: number | undefined;
        tool_budget?: number | undefined;
        cost_budget_usd?: number | undefined;
    } | undefined;
    constraints?: Record<string, unknown> | undefined;
    fallback_plan?: Record<string, unknown> | undefined;
    models?: {
        planner?: string | undefined;
        executor?: string | undefined;
        vision?: string | undefined;
    } | undefined;
    sandbox?: {
        timeout_ms?: number | undefined;
        network_access?: boolean | undefined;
        filesystem_access?: boolean | undefined;
    } | undefined;
    verification?: {
        enabled: boolean;
        checks?: string[] | undefined;
    } | undefined;
}, {
    pipeline_type: string;
    memory?: {
        retrieval?: string | undefined;
        top_k?: number | undefined;
    } | undefined;
    strategy_id?: string | undefined;
    execution_mode?: "sync_stream" | undefined;
    harness_autonomous_execution?: boolean | undefined;
    budgets?: {
        deadline_ms?: number | undefined;
        token_budget?: number | undefined;
        tool_budget?: number | undefined;
        cost_budget_usd?: number | undefined;
    } | undefined;
    constraints?: Record<string, unknown> | undefined;
    verification_level?: "strict" | "none" | "basic" | undefined;
    fallback_plan?: Record<string, unknown> | undefined;
    models?: {
        planner?: string | undefined;
        executor?: string | undefined;
        vision?: string | undefined;
    } | undefined;
    tools_enabled?: string[] | undefined;
    sandbox?: {
        timeout_ms?: number | undefined;
        network_access?: boolean | undefined;
        filesystem_access?: boolean | undefined;
    } | undefined;
    verification?: {
        enabled: boolean;
        checks?: string[] | undefined;
    } | undefined;
}>;
export type PipelinePlan = z.infer<typeof PipelinePlanSchema>;
export type PipelineBudgets = z.infer<typeof BudgetsSchema>;
export {};
//# sourceMappingURL=pipeline-plan.d.ts.map