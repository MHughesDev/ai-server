/**
 * Contracts package – versioned schemas and validators for external and internal APIs.
 * @see docs/PLANS/Implementation-plans/L2-01_Contracts-and-Project-Scaffold.md
 */
export * from "./request-envelope.js";
export * from "./response-envelope.js";
export * from "./canonical-request.js";
export * from "./intent-bundle.js";
export * from "./policy-decision.js";
export * from "./pipeline-plan.js";
export * from "./typed-artifact.js";
export * from "./task.js";
export * from "./engine-invocation.js";
export * from "./engine-result.js";
export * from "./workflow-definition.js";
export * from "./agent-harness-contract.js";
export * from "./errors.js";
export * from "./m5-artifacts.js";
/** Validate RequestEnvelope; throws ZodError on failure */
export declare function validateRequestEnvelope(data: unknown): {
    request_id: string;
    caller: {
        org_id: string;
        app_id: string;
        user_id: string;
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
    mode?: "sync" | undefined;
    deadline_ms?: number | undefined;
};
/** Validate ResponseEnvelope; throws ZodError on failure */
export declare function validateResponseEnvelope(data: unknown): {
    status: "error" | "ok" | "blocked";
    request_id: string;
    error?: {
        code: string;
        message: string;
        detail?: Record<string, unknown> | undefined;
    } | undefined;
    mode?: "sync" | undefined;
    output?: {
        attachments: {
            artifact_uri?: string | undefined;
            artifact_id?: string | undefined;
            artifact_kind?: string | undefined;
        }[];
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
/** Validate PipelinePlan */
export declare function validatePipelinePlan(data: unknown): {
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
/** Validate TypedArtifact */
export declare function validateTypedArtifact(data: unknown): {
    artifact_id: string;
    artifact_kind: "custom" | "workflow_plan" | "evaluation_report" | "tool_result" | "memory_response" | "code_patch" | "report" | "diff" | "document_chunk" | "research_report" | "decision_memo" | "normalized_record" | "classification_result";
    encoding: "binary" | "json" | "text";
    content: {
        ref?: string | undefined;
        inline?: unknown;
    };
    schema_ref?: string | undefined;
    metadata?: {
        created_by?: string | undefined;
        provenance?: string | undefined;
        trust_score?: number | undefined;
        sensitivity?: "internal" | "public" | "confidential" | "restricted" | undefined;
    } | undefined;
};
/** Validate Task */
export declare function validateTask(data: unknown): {
    task_id: string;
    task_type: string;
    category: "retrieval" | "analysis" | "transformation" | "generation" | "evaluation" | "action" | "classification" | "synthesis";
    input_artifacts: {
        artifact_id: string;
        artifact_kind: "custom" | "workflow_plan" | "evaluation_report" | "tool_result" | "memory_response" | "code_patch" | "report" | "diff" | "document_chunk" | "research_report" | "decision_memo" | "normalized_record" | "classification_result";
        encoding: "binary" | "json" | "text";
        content: {
            ref?: string | undefined;
            inline?: unknown;
        };
        schema_ref?: string | undefined;
        metadata?: {
            created_by?: string | undefined;
            provenance?: string | undefined;
            trust_score?: number | undefined;
            sensitivity?: "internal" | "public" | "confidential" | "restricted" | undefined;
        } | undefined;
    }[];
    constraints_hints?: {
        latency_class?: "long_horizon" | "interactive" | "batch" | undefined;
        accuracy_level?: "approximate" | "high_precision" | undefined;
        deterministic_required?: boolean | undefined;
    } | undefined;
    objective?: {
        formal_spec?: Record<string, unknown> | undefined;
        description?: string | undefined;
    } | undefined;
    expected_output_schema?: Record<string, unknown> | undefined;
};
/** Validate EngineInvocation */
export declare function validateEngineInvocation(data: unknown): {
    invocation_id: string;
    engine_type: "memory" | "evaluation" | "classification" | "synthesis" | "planning" | "execution" | "tool" | "condensing";
    task: {
        task_id: string;
        task_type: string;
        category: "retrieval" | "analysis" | "transformation" | "generation" | "evaluation" | "action" | "classification" | "synthesis";
        input_artifacts: {
            artifact_id: string;
            artifact_kind: "custom" | "workflow_plan" | "evaluation_report" | "tool_result" | "memory_response" | "code_patch" | "report" | "diff" | "document_chunk" | "research_report" | "decision_memo" | "normalized_record" | "classification_result";
            encoding: "binary" | "json" | "text";
            content: {
                ref?: string | undefined;
                inline?: unknown;
            };
            schema_ref?: string | undefined;
            metadata?: {
                created_by?: string | undefined;
                provenance?: string | undefined;
                trust_score?: number | undefined;
                sensitivity?: "internal" | "public" | "confidential" | "restricted" | undefined;
            } | undefined;
        }[];
        constraints_hints?: {
            latency_class?: "long_horizon" | "interactive" | "batch" | undefined;
            accuracy_level?: "approximate" | "high_precision" | undefined;
            deterministic_required?: boolean | undefined;
        } | undefined;
        objective?: {
            formal_spec?: Record<string, unknown> | undefined;
            description?: string | undefined;
        } | undefined;
        expected_output_schema?: Record<string, unknown> | undefined;
    };
    context_artifacts: {
        artifact_id: string;
        artifact_kind: "custom" | "workflow_plan" | "evaluation_report" | "tool_result" | "memory_response" | "code_patch" | "report" | "diff" | "document_chunk" | "research_report" | "decision_memo" | "normalized_record" | "classification_result";
        encoding: "binary" | "json" | "text";
        content: {
            ref?: string | undefined;
            inline?: unknown;
        };
        schema_ref?: string | undefined;
        metadata?: {
            created_by?: string | undefined;
            provenance?: string | undefined;
            trust_score?: number | undefined;
            sensitivity?: "internal" | "public" | "confidential" | "restricted" | undefined;
        } | undefined;
    }[];
    budgets?: {
        token_budget?: number | undefined;
        tool_budget?: number | undefined;
        cost_budget_usd?: number | undefined;
        time_budget_ms?: number | undefined;
    } | undefined;
    metadata?: {
        contract_version?: string | undefined;
        trace_id?: string | undefined;
    } | undefined;
    actor_context?: {
        org_id: string;
        app_id: string;
        user_id: string;
        roles: string[];
    } | undefined;
    safety?: {
        safety_profile?: "strict" | "standard" | "regulated" | undefined;
    } | undefined;
};
/** Validate EngineResult */
export declare function validateEngineResult(data: unknown): {
    status: "blocked" | "success" | "fail";
    invocation_id: string;
    result_artifacts: {
        artifact_id: string;
        artifact_kind: "custom" | "workflow_plan" | "evaluation_report" | "tool_result" | "memory_response" | "code_patch" | "report" | "diff" | "document_chunk" | "research_report" | "decision_memo" | "normalized_record" | "classification_result";
        encoding: "binary" | "json" | "text";
        content: {
            ref?: string | undefined;
            inline?: unknown;
        };
        schema_ref?: string | undefined;
        metadata?: {
            created_by?: string | undefined;
            provenance?: string | undefined;
            trust_score?: number | undefined;
            sensitivity?: "internal" | "public" | "confidential" | "restricted" | undefined;
        } | undefined;
    }[];
    error?: {
        code: string;
        message?: string | undefined;
        detail?: Record<string, unknown> | undefined;
    } | undefined;
    confidence?: number | undefined;
    proposed_next_action?: {
        type: "none" | "call_tool" | "invoke_workflow" | "request_replan";
        ref?: string | undefined;
        arguments?: Record<string, unknown> | undefined;
    } | undefined;
    metrics?: {
        duration_ms?: number | undefined;
        tokens_used?: number | undefined;
        cost_estimate_usd?: number | undefined;
    } | undefined;
};
/** Validate WorkflowDefinition */
export declare function validateWorkflowDefinition(data: unknown): {
    workflow_id: string;
    version: string;
    steps: {
        kind: "engine_call" | "workflow_call" | "decision";
        ref: string;
        step_id: string;
        input_mapping?: Record<string, unknown> | undefined;
        depends_on?: string[] | undefined;
        branches?: {
            condition: string;
            target_step: string;
        }[] | undefined;
        default_target?: string | undefined;
    }[];
    entry_conditions?: {
        intents?: string[] | undefined;
        required_capabilities?: {
            needs_memory?: boolean | undefined;
            needs_tools?: string[] | undefined;
            needs_verification?: boolean | undefined;
        } | undefined;
        risk_allowed?: string[] | undefined;
    } | undefined;
    stop_conditions?: {
        deadline_ms?: number | undefined;
        max_iterations?: number | undefined;
    } | undefined;
};
export declare const CONTRACT_VERSION = "v1";
//# sourceMappingURL=index.d.ts.map