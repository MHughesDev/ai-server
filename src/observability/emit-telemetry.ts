/**
 * Canonical telemetry emit path (WANT-012) — all non–query-handler emitters should use this.
 */

import type { TelemetryEvent } from "./events.js";
import { getObservability } from "./types.js";
import { getTraceContext } from "./context.js";
import type { RedactionLevel } from "./redact.js";

export type TelemetryEmitInput = Omit<TelemetryEvent, "request_id" | "trace_id" | "timestamp_iso"> &
  Partial<Pick<TelemetryEvent, "request_id" | "trace_id" | "timestamp_iso">>;

/** Emit through the configured observability emitter (redaction applied in emitter + sink). */
export function emitTelemetryEvent(input: TelemetryEmitInput): void {
  const obs = getObservability();
  if (!obs) return;
  const ctx = getTraceContext();
  obs.events.emit({
    request_id: input.request_id ?? ctx?.request_id ?? "unknown",
    trace_id: input.trace_id ?? ctx?.trace_id,
    timestamp_iso: input.timestamp_iso ?? new Date().toISOString(),
    ...input,
  });
}

/** Engine/pipeline lifecycle events with policy-driven redaction level when provided. */
export function emitEngineLifecycleEvent(
  eventType: "ENGINE_START" | "ENGINE_END",
  payload: Record<string, unknown>,
  redactionLevel: RedactionLevel = "minimal"
): void {
  emitTelemetryEvent({
    event_type: eventType,
    redaction_level: redactionLevel,
    payload,
  });
}

export function emitWorkflowLifecycleEvent(
  eventType: "WORKFLOW_START" | "WORKFLOW_END",
  payload: { workflow_id: string; duration_ms?: number; status?: string },
  redactionLevel: RedactionLevel = "minimal"
): void {
  emitTelemetryEvent({
    event_type: eventType,
    redaction_level: redactionLevel,
    payload,
  });
}

export function emitHarnessIterationEvent(
  payload: {
    workflow_id: string;
    iteration: number;
    tool_calls_so_far: number;
    proposed_next_action?: string;
  },
  redactionLevel: RedactionLevel = "minimal"
): void {
  emitTelemetryEvent({
    event_type: "HARNESS_ITERATION",
    redaction_level: redactionLevel,
    payload,
  });
}
