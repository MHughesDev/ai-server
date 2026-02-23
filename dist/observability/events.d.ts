/**
 * Canonical event taxonomy and schema for observability.
 * @see Docs/SPEC/18_Observability_Spec.md, L2-04 Phase 0
 */
import { z } from "zod";
/** Required event types per SPEC 18 */
export declare const REQUIRED_EVENT_TYPES: readonly ["ROUTE_DECISION", "POLICY_DECISION", "BUDGET_ASSIGN", "PIPELINE_START", "PIPELINE_END", "TOOL_START", "TOOL_END", "MEMORY_QUERY", "MEMORY_WRITE", "VERIFY_RESULT", "FINAL_SYNTH", "ERROR"];
export type RequiredEventType = (typeof REQUIRED_EVENT_TYPES)[number];
export declare function isRequiredEventType(s: string): s is RequiredEventType;
/** Payloads for governance and lifecycle events (allowlisted fields only) */
export declare const RouteDecisionPayloadSchema: z.ZodObject<{
    route: z.ZodOptional<z.ZodString>;
    pipeline_type: z.ZodOptional<z.ZodString>;
    strategy_id: z.ZodOptional<z.ZodString>;
    deny: z.ZodOptional<z.ZodBoolean>;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    pipeline_type?: string | undefined;
    strategy_id?: string | undefined;
    reason?: string | undefined;
    route?: string | undefined;
    deny?: boolean | undefined;
}, {
    pipeline_type?: string | undefined;
    strategy_id?: string | undefined;
    reason?: string | undefined;
    route?: string | undefined;
    deny?: boolean | undefined;
}>;
export declare const PolicyDecisionPayloadSchema: z.ZodObject<{
    allowed: z.ZodBoolean;
    deny_reason: z.ZodOptional<z.ZodString>;
    memory_scope: z.ZodOptional<z.ZodString>;
    allowed_pipelines: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    allowed: boolean;
    deny_reason?: string | undefined;
    memory_scope?: string | undefined;
    allowed_pipelines?: string[] | undefined;
}, {
    allowed: boolean;
    deny_reason?: string | undefined;
    memory_scope?: string | undefined;
    allowed_pipelines?: string[] | undefined;
}>;
export declare const BudgetAssignPayloadSchema: z.ZodObject<{
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
export declare const PipelineLifecyclePayloadSchema: z.ZodObject<{
    pipeline_type: z.ZodOptional<z.ZodString>;
    strategy_id: z.ZodOptional<z.ZodString>;
    duration_ms: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["ok", "error", "blocked"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "error" | "ok" | "blocked" | undefined;
    pipeline_type?: string | undefined;
    strategy_id?: string | undefined;
    duration_ms?: number | undefined;
}, {
    status?: "error" | "ok" | "blocked" | undefined;
    pipeline_type?: string | undefined;
    strategy_id?: string | undefined;
    duration_ms?: number | undefined;
}>;
export declare const ErrorEventPayloadSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodOptional<z.ZodString>;
    stage: z.ZodOptional<z.ZodString>;
    /** No PII – redacted detail only */
    detail_redacted: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    code: string;
    message?: string | undefined;
    stage?: string | undefined;
    detail_redacted?: Record<string, unknown> | undefined;
}, {
    code: string;
    message?: string | undefined;
    stage?: string | undefined;
    detail_redacted?: Record<string, unknown> | undefined;
}>;
export type RouteDecisionPayload = z.infer<typeof RouteDecisionPayloadSchema>;
export type PolicyDecisionPayload = z.infer<typeof PolicyDecisionPayloadSchema>;
export type BudgetAssignPayload = z.infer<typeof BudgetAssignPayloadSchema>;
export type PipelineLifecyclePayload = z.infer<typeof PipelineLifecyclePayloadSchema>;
export type ErrorEventPayload = z.infer<typeof ErrorEventPayloadSchema>;
/** Single telemetry event (base + optional typed payload) */
export declare const TelemetryEventSchema: z.ZodIntersection<z.ZodObject<{
    event_type: z.ZodString;
    request_id: z.ZodString;
    trace_id: z.ZodOptional<z.ZodString>;
    timestamp_iso: z.ZodOptional<z.ZodString>;
    /** Redaction level applied: none | minimal | full */
    redaction_level: z.ZodOptional<z.ZodEnum<["none", "minimal", "full"]>>;
}, "strip", z.ZodTypeAny, {
    request_id: string;
    event_type: string;
    redaction_level?: "none" | "minimal" | "full" | undefined;
    trace_id?: string | undefined;
    timestamp_iso?: string | undefined;
}, {
    request_id: string;
    event_type: string;
    redaction_level?: "none" | "minimal" | "full" | undefined;
    trace_id?: string | undefined;
    timestamp_iso?: string | undefined;
}>, z.ZodObject<{
    payload: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    payload?: Record<string, unknown> | undefined;
}, {
    payload?: Record<string, unknown> | undefined;
}>>;
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
/** Validate event has required base fields and known event_type */
export declare function validateTelemetryEvent(data: unknown): TelemetryEvent;
//# sourceMappingURL=events.d.ts.map