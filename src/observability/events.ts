/**
 * Canonical event taxonomy and schema for observability.
 * @see docs/SPEC/18_Observability_Spec.md, L2-04 Phase 0
 */

import { z } from "zod";

/** Required event types per SPEC 18 and Architecture §13 */
export const REQUIRED_EVENT_TYPES = [
  "ROUTE_DECISION",
  "POLICY_DECISION",
  "BUDGET_ASSIGN",
  "PIPELINE_START",
  "PIPELINE_END",
  "WORKFLOW_START",
  "WORKFLOW_END",
  "ENGINE_START",
  "ENGINE_END",
  "TOOL_START",
  "TOOL_END",
  "MEMORY_QUERY",
  "MEMORY_WRITE",
  "VERIFY_RESULT",
  "FINAL_SYNTH",
  "ERROR",
  "HARNESS_ITERATION",
] as const;

export type RequiredEventType = (typeof REQUIRED_EVENT_TYPES)[number];

export function isRequiredEventType(s: string): s is RequiredEventType {
  return (REQUIRED_EVENT_TYPES as readonly string[]).includes(s);
}

/** Base fields present on every telemetry event */
const EventBaseSchema = z.object({
  event_type: z.string(),
  request_id: z.string(),
  trace_id: z.string().optional(),
  timestamp_iso: z.string().optional(),
  /** Redaction level applied: none | minimal | full */
  redaction_level: z.enum(["none", "minimal", "full"]).optional(),
});

/** Payloads for governance and lifecycle events (allowlisted fields only) */
export const RouteDecisionPayloadSchema = z.object({
  route: z.string().optional(),
  pipeline_type: z.string().optional(),
  strategy_id: z.string().optional(),
  deny: z.boolean().optional(),
  reason: z.string().optional(),
});

export const PolicyDecisionPayloadSchema = z.object({
  allowed: z.boolean(),
  deny_reason: z.string().optional(),
  memory_scope: z.string().optional(),
  allowed_pipelines: z.array(z.string()).optional(),
});

export const BudgetAssignPayloadSchema = z.object({
  token_budget: z.number().optional(),
  tool_budget: z.number().optional(),
  deadline_ms: z.number().optional(),
  cost_budget_usd: z.number().optional(),
});

export const PipelineLifecyclePayloadSchema = z.object({
  pipeline_type: z.string().optional(),
  strategy_id: z.string().optional(),
  duration_ms: z.number().optional(),
  status: z.enum(["ok", "error", "blocked"]).optional(),
});

export const ErrorEventPayloadSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  stage: z.string().optional(),
  /** No PII – redacted detail only */
  detail_redacted: z.record(z.unknown()).optional(),
});

export type RouteDecisionPayload = z.infer<typeof RouteDecisionPayloadSchema>;
export type PolicyDecisionPayload = z.infer<typeof PolicyDecisionPayloadSchema>;
export type BudgetAssignPayload = z.infer<typeof BudgetAssignPayloadSchema>;
export type PipelineLifecyclePayload = z.infer<typeof PipelineLifecyclePayloadSchema>;
export type ErrorEventPayload = z.infer<typeof ErrorEventPayloadSchema>;

/** Single telemetry event (base + optional typed payload) */
export const TelemetryEventSchema = EventBaseSchema.and(
  z.object({
    payload: z.record(z.unknown()).optional(),
  })
);

export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;

/** Validate event has required base fields and known event_type */
export function validateTelemetryEvent(data: unknown): TelemetryEvent {
  const parsed = TelemetryEventSchema.parse(data);
  if (!parsed.event_type || typeof parsed.request_id !== "string") {
    throw new Error("event_type and request_id are required");
  }
  return parsed;
}
