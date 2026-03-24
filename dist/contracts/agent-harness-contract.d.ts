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
/** Caller identity and scope for harness (snake_case; maps from ingress CallerContext). */
export declare const HarnessCallerContextSchema: z.ZodObject<{
    app_id: z.ZodString;
    user_id: z.ZodString;
    org_id: z.ZodString;
    session_id: z.ZodOptional<z.ZodString>;
    scopes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    org_id: string;
    app_id: string;
    user_id: string;
    scopes: string[];
    session_id?: string | undefined;
}, {
    org_id: string;
    app_id: string;
    user_id: string;
    session_id?: string | undefined;
    scopes?: string[] | undefined;
}>;
export type HarnessCallerContext = z.infer<typeof HarnessCallerContextSchema>;
/** Citation shape passed into harness (matches memory CitationSpec / response Citation). */
export declare const HarnessCitationSchema: z.ZodObject<{
    source: z.ZodString;
    ref: z.ZodString;
    span: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    source: string;
    ref: string;
    span?: string | undefined;
}, {
    source: string;
    ref: string;
    span?: string | undefined;
}>;
export type HarnessCitation = z.infer<typeof HarnessCitationSchema>;
/** Optional retrieval context when memory/retrieval ran before the harness. */
export declare const RetrievalContextSchema: z.ZodObject<{
    contextText: z.ZodString;
    citations: z.ZodDefault<z.ZodArray<z.ZodObject<{
        source: z.ZodString;
        ref: z.ZodString;
        span: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        source: string;
        ref: string;
        span?: string | undefined;
    }, {
        source: string;
        ref: string;
        span?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    citations: {
        source: string;
        ref: string;
        span?: string | undefined;
    }[];
    contextText: string;
}, {
    contextText: string;
    citations?: {
        source: string;
        ref: string;
        span?: string | undefined;
    }[] | undefined;
}>;
export type RetrievalContext = z.infer<typeof RetrievalContextSchema>;
/**
 * Post-orchestration input for agent/pipeline harnesses.
 * This is the only data foundation harnesses need; all fields are set by the time
 * the harness runs (after policy allow, route decision, and optional retrieval).
 */
export declare const AgentHarnessInputSchema: z.ZodObject<{
    /** Normalized request (brain stem canonicalize). */
    canonical: z.ZodObject<{
        request_id: z.ZodString;
        modalities: z.ZodDefault<z.ZodArray<z.ZodEnum<["text", "image", "file", "structured"]>, "many">>;
        text: z.ZodDefault<z.ZodString>;
        attachments: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodEnum<["image", "pdf", "json", "other"]>;
            uri: z.ZodOptional<z.ZodString>;
            token_estimate: z.ZodOptional<z.ZodNumber>;
            mime: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "image" | "pdf" | "json" | "other";
            id: string;
            uri?: string | undefined;
            mime?: string | undefined;
            token_estimate?: number | undefined;
        }, {
            type: "image" | "pdf" | "json" | "other";
            id: string;
            uri?: string | undefined;
            mime?: string | undefined;
            token_estimate?: number | undefined;
        }>, "many">>;
        structured: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        token_estimate: z.ZodDefault<z.ZodNumber>;
        caller_app_id: z.ZodString;
        caller_user_id: z.ZodString;
        caller_org_id: z.ZodString;
        session_id: z.ZodOptional<z.ZodString>;
        conversation_id: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        attachments: {
            type: "image" | "pdf" | "json" | "other";
            id: string;
            uri?: string | undefined;
            mime?: string | undefined;
            token_estimate?: number | undefined;
        }[];
        request_id: string;
        token_estimate: number;
        modalities: ("image" | "text" | "structured" | "file")[];
        caller_app_id: string;
        caller_user_id: string;
        caller_org_id: string;
        session_id?: string | undefined;
        structured?: Record<string, unknown> | undefined;
        conversation_id?: string | undefined;
    }, {
        request_id: string;
        caller_app_id: string;
        caller_user_id: string;
        caller_org_id: string;
        session_id?: string | undefined;
        text?: string | undefined;
        attachments?: {
            type: "image" | "pdf" | "json" | "other";
            id: string;
            uri?: string | undefined;
            mime?: string | undefined;
            token_estimate?: number | undefined;
        }[] | undefined;
        structured?: Record<string, unknown> | undefined;
        token_estimate?: number | undefined;
        modalities?: ("image" | "text" | "structured" | "file")[] | undefined;
        conversation_id?: string | undefined;
    }>;
    /** Intent and routing signals (brain stem intent). */
    intent: z.ZodObject<{
        intents: z.ZodArray<z.ZodString, "many">;
        confidence: z.ZodNumber;
        modalities_detected: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        complexity: z.ZodOptional<z.ZodObject<{
            horizon: z.ZodOptional<z.ZodEnum<["single_step", "multi_step", "long_horizon"]>>;
            tool_likelihood: z.ZodOptional<z.ZodNumber>;
            retrieval_likelihood: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            horizon?: "single_step" | "multi_step" | "long_horizon" | undefined;
            tool_likelihood?: number | undefined;
            retrieval_likelihood?: number | undefined;
        }, {
            horizon?: "single_step" | "multi_step" | "long_horizon" | undefined;
            tool_likelihood?: number | undefined;
            retrieval_likelihood?: number | undefined;
        }>>;
        constraints_hints: z.ZodOptional<z.ZodObject<{
            needs_web: z.ZodOptional<z.ZodBoolean>;
            needs_files: z.ZodOptional<z.ZodBoolean>;
            needs_code: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            needs_web?: boolean | undefined;
            needs_files?: boolean | undefined;
            needs_code?: boolean | undefined;
        }, {
            needs_web?: boolean | undefined;
            needs_files?: boolean | undefined;
            needs_code?: boolean | undefined;
        }>>;
        primary_intent: z.ZodOptional<z.ZodEnum<["chat", "coding_agent", "rag", "tool_agent", "multimodal_reasoning"]>>;
        risk_flags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        routing_hints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        intents: string[];
        confidence: number;
        modalities_detected: string[];
        risk_flags: string[];
        routing_hints: string[];
        complexity?: {
            horizon?: "single_step" | "multi_step" | "long_horizon" | undefined;
            tool_likelihood?: number | undefined;
            retrieval_likelihood?: number | undefined;
        } | undefined;
        constraints_hints?: {
            needs_web?: boolean | undefined;
            needs_files?: boolean | undefined;
            needs_code?: boolean | undefined;
        } | undefined;
        primary_intent?: "chat" | "coding_agent" | "rag" | "tool_agent" | "multimodal_reasoning" | undefined;
    }, {
        intents: string[];
        confidence: number;
        modalities_detected?: string[] | undefined;
        complexity?: {
            horizon?: "single_step" | "multi_step" | "long_horizon" | undefined;
            tool_likelihood?: number | undefined;
            retrieval_likelihood?: number | undefined;
        } | undefined;
        constraints_hints?: {
            needs_web?: boolean | undefined;
            needs_files?: boolean | undefined;
            needs_code?: boolean | undefined;
        } | undefined;
        primary_intent?: "chat" | "coding_agent" | "rag" | "tool_agent" | "multimodal_reasoning" | undefined;
        risk_flags?: string[] | undefined;
        routing_hints?: string[] | undefined;
    }>;
    /** Policy outcome: allowed, budgets, memory_scope, allowed_pipelines, etc. */
    policy: z.ZodObject<{
        allowed: z.ZodDefault<z.ZodBoolean>;
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
        allowed_pipelines: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        strategy: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        allowed: boolean;
        allow_tools: string[];
        deny_tools: string[];
        memory_scope: "org" | "user" | "project" | "none";
        safety_profile: "strict" | "standard" | "internal";
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
        memory_scope?: "org" | "user" | "project" | "none" | undefined;
        max_budgets?: {
            deadline_ms?: number | undefined;
            token_budget?: number | undefined;
            tool_budget?: number | undefined;
            cost_budget_usd?: number | undefined;
        } | undefined;
        safety_profile?: "strict" | "standard" | "internal" | undefined;
        redaction_level?: "none" | "minimal" | "full" | undefined;
        audit_level?: "none" | "full" | "summary" | undefined;
        allowed_pipelines?: string[] | undefined;
        strategy?: string | undefined;
    }>;
    /** Concrete execution plan: pipeline_type, strategy, budgets, tools, memory. */
    plan: z.ZodObject<{
        pipeline_type: z.ZodString;
        strategy_id: z.ZodOptional<z.ZodString>;
        execution_mode: z.ZodDefault<z.ZodLiteral<"sync_stream">>;
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
        fallback_plan: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
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
        tools_enabled: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
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
    /** Caller identity and scopes (from ingress). */
    caller: z.ZodObject<{
        app_id: z.ZodString;
        user_id: z.ZodString;
        org_id: z.ZodString;
        session_id: z.ZodOptional<z.ZodString>;
        scopes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        org_id: string;
        app_id: string;
        user_id: string;
        scopes: string[];
        session_id?: string | undefined;
    }, {
        org_id: string;
        app_id: string;
        user_id: string;
        session_id?: string | undefined;
        scopes?: string[] | undefined;
    }>;
    /** Set when retrieval ran and returned context (L2-06). */
    retrievalContext: z.ZodOptional<z.ZodObject<{
        contextText: z.ZodString;
        citations: z.ZodDefault<z.ZodArray<z.ZodObject<{
            source: z.ZodString;
            ref: z.ZodString;
            span: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            source: string;
            ref: string;
            span?: string | undefined;
        }, {
            source: string;
            ref: string;
            span?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        citations: {
            source: string;
            ref: string;
            span?: string | undefined;
        }[];
        contextText: string;
    }, {
        contextText: string;
        citations?: {
            source: string;
            ref: string;
            span?: string | undefined;
        }[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    caller: {
        org_id: string;
        app_id: string;
        user_id: string;
        scopes: string[];
        session_id?: string | undefined;
    };
    canonical: {
        text: string;
        attachments: {
            type: "image" | "pdf" | "json" | "other";
            id: string;
            uri?: string | undefined;
            mime?: string | undefined;
            token_estimate?: number | undefined;
        }[];
        request_id: string;
        token_estimate: number;
        modalities: ("image" | "text" | "structured" | "file")[];
        caller_app_id: string;
        caller_user_id: string;
        caller_org_id: string;
        session_id?: string | undefined;
        structured?: Record<string, unknown> | undefined;
        conversation_id?: string | undefined;
    };
    intent: {
        intents: string[];
        confidence: number;
        modalities_detected: string[];
        risk_flags: string[];
        routing_hints: string[];
        complexity?: {
            horizon?: "single_step" | "multi_step" | "long_horizon" | undefined;
            tool_likelihood?: number | undefined;
            retrieval_likelihood?: number | undefined;
        } | undefined;
        constraints_hints?: {
            needs_web?: boolean | undefined;
            needs_files?: boolean | undefined;
            needs_code?: boolean | undefined;
        } | undefined;
        primary_intent?: "chat" | "coding_agent" | "rag" | "tool_agent" | "multimodal_reasoning" | undefined;
    };
    policy: {
        allowed: boolean;
        allow_tools: string[];
        deny_tools: string[];
        memory_scope: "org" | "user" | "project" | "none";
        safety_profile: "strict" | "standard" | "internal";
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
    };
    plan: {
        pipeline_type: string;
        execution_mode: "sync_stream";
        verification_level: "strict" | "none" | "basic";
        tools_enabled: string[];
        memory?: {
            retrieval?: string | undefined;
            top_k?: number | undefined;
        } | undefined;
        strategy_id?: string | undefined;
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
    };
    retrievalContext?: {
        citations: {
            source: string;
            ref: string;
            span?: string | undefined;
        }[];
        contextText: string;
    } | undefined;
}, {
    caller: {
        org_id: string;
        app_id: string;
        user_id: string;
        session_id?: string | undefined;
        scopes?: string[] | undefined;
    };
    canonical: {
        request_id: string;
        caller_app_id: string;
        caller_user_id: string;
        caller_org_id: string;
        session_id?: string | undefined;
        text?: string | undefined;
        attachments?: {
            type: "image" | "pdf" | "json" | "other";
            id: string;
            uri?: string | undefined;
            mime?: string | undefined;
            token_estimate?: number | undefined;
        }[] | undefined;
        structured?: Record<string, unknown> | undefined;
        token_estimate?: number | undefined;
        modalities?: ("image" | "text" | "structured" | "file")[] | undefined;
        conversation_id?: string | undefined;
    };
    intent: {
        intents: string[];
        confidence: number;
        modalities_detected?: string[] | undefined;
        complexity?: {
            horizon?: "single_step" | "multi_step" | "long_horizon" | undefined;
            tool_likelihood?: number | undefined;
            retrieval_likelihood?: number | undefined;
        } | undefined;
        constraints_hints?: {
            needs_web?: boolean | undefined;
            needs_files?: boolean | undefined;
            needs_code?: boolean | undefined;
        } | undefined;
        primary_intent?: "chat" | "coding_agent" | "rag" | "tool_agent" | "multimodal_reasoning" | undefined;
        risk_flags?: string[] | undefined;
        routing_hints?: string[] | undefined;
    };
    policy: {
        allowed?: boolean | undefined;
        deny_reason?: string | undefined;
        allow_tools?: string[] | undefined;
        deny_tools?: string[] | undefined;
        memory_scope?: "org" | "user" | "project" | "none" | undefined;
        max_budgets?: {
            deadline_ms?: number | undefined;
            token_budget?: number | undefined;
            tool_budget?: number | undefined;
            cost_budget_usd?: number | undefined;
        } | undefined;
        safety_profile?: "strict" | "standard" | "internal" | undefined;
        redaction_level?: "none" | "minimal" | "full" | undefined;
        audit_level?: "none" | "full" | "summary" | undefined;
        allowed_pipelines?: string[] | undefined;
        strategy?: string | undefined;
    };
    plan: {
        pipeline_type: string;
        memory?: {
            retrieval?: string | undefined;
            top_k?: number | undefined;
        } | undefined;
        strategy_id?: string | undefined;
        execution_mode?: "sync_stream" | undefined;
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
    };
    retrievalContext?: {
        contextText: string;
        citations?: {
            source: string;
            ref: string;
            span?: string | undefined;
        }[] | undefined;
    } | undefined;
}>;
export type AgentHarnessInput = z.infer<typeof AgentHarnessInputSchema>;
/** Validate AgentHarnessInput; throws ZodError on failure. */
export declare function validateAgentHarnessInput(data: unknown): AgentHarnessInput;
//# sourceMappingURL=agent-harness-contract.d.ts.map