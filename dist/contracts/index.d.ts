/**
 * Contracts package – versioned schemas and validators for external and internal APIs.
 * @see Docs/PLANS/Implementation-plans/L2-01_Contracts-and-Project-Scaffold.md
 */
export * from "./request-envelope.js";
export * from "./response-envelope.js";
export * from "./canonical-request.js";
export * from "./intent-bundle.js";
export * from "./policy-decision.js";
export * from "./pipeline-plan.js";
export * from "./agent-harness-contract.js";
export * from "./errors.js";
/** Validate RequestEnvelope; throws ZodError on failure */
export declare function validateRequestEnvelope(data: unknown): {
    request_id: string;
    caller: {
        app_id: string;
        user_id: string;
        org_id: string;
        scopes: string[];
        session_id?: string | undefined;
    };
    input: {
        attachments: {
            type: "image" | "pdf" | "json" | "other";
            id: string;
            content_b64?: string | undefined;
            uri?: string | undefined;
            meta?: {
                filename?: string | undefined;
                mime?: string | undefined;
            } | undefined;
        }[];
        text?: string | undefined;
        structured?: Record<string, unknown> | undefined;
    };
    preferences: {
        response_format: "json" | "text" | "markdown";
        verbosity: "low" | "medium" | "high";
        stream: boolean;
    };
    contract_version: string;
    mode?: "auto" | "sync" | "async" | undefined;
    deadline_ms?: number | undefined;
    idempotency_key?: string | undefined;
};
/** Validate ResponseEnvelope; throws ZodError on failure */
export declare function validateResponseEnvelope(data: unknown): {
    status: "error" | "ok" | "blocked" | "accepted";
    request_id: string;
    error?: {
        code: string;
        message: string;
        detail?: Record<string, unknown> | undefined;
    } | undefined;
    mode?: "stream" | "sync" | "async" | undefined;
    output?: {
        citations: {
            source: string;
            ref: string;
            span?: string | undefined;
        }[];
        text?: string | undefined;
        structured?: Record<string, unknown> | undefined;
    } | undefined;
    telemetry?: {
        models_used: string[];
        tool_calls: number;
        tokens_in: number;
        tokens_out: number;
        cost_usd_est: number;
        latency_ms: number;
        pipeline?: string | undefined;
    } | undefined;
    job_id?: string | undefined;
};
/** Validate CanonicalRequest */
export declare function validateCanonicalRequest(data: unknown): {
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
/** Validate IntentBundle */
export declare function validateIntentBundle(data: unknown): {
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
/** Validate PolicyDecision */
export declare function validatePolicyDecision(data: unknown): {
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
};
/** Validate PipelinePlan */
export declare function validatePipelinePlan(data: unknown): {
    pipeline_type: string;
    execution_mode: "sync_stream" | "async_job";
    verification_level: "none" | "strict" | "basic";
    tools_enabled: string[];
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
    memory?: {
        retrieval?: string | undefined;
        top_k?: number | undefined;
    } | undefined;
    verification?: {
        enabled: boolean;
        checks?: string[] | undefined;
    } | undefined;
};
export declare const CONTRACT_VERSION = "v1";
//# sourceMappingURL=index.d.ts.map