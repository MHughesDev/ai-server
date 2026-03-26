/**
 * SPEC 18 events emitted from engines/stores outside pipeline-local emitters (WANT-037).
 */

import { getObservability } from "./types.js";
import { getTraceContext } from "./context.js";

export function emitVerifyResultEvent(payload: Record<string, unknown>): void {
  const obs = getObservability();
  const ctx = getTraceContext();
  if (obs?.events) {
    obs.events.emit({
      event_type: "VERIFY_RESULT",
      request_id: ctx?.request_id ?? "unknown",
      trace_id: ctx?.trace_id,
      timestamp_iso: new Date().toISOString(),
      redaction_level: "minimal",
      payload,
    });
  }
}

export function emitMemoryWriteEvent(payload: Record<string, unknown>): void {
  const obs = getObservability();
  const ctx = getTraceContext();
  if (obs?.events) {
    obs.events.emit({
      event_type: "MEMORY_WRITE",
      request_id: ctx?.request_id ?? "unknown",
      trace_id: ctx?.trace_id,
      timestamp_iso: new Date().toISOString(),
      redaction_level: "minimal",
      payload,
    });
  }
}

/** SPEC 18 `MEMORY_QUERY` — single emission site for `runRetrieval` (WANT-037). */
export function emitMemoryQueryEvent(payload: Record<string, unknown>): void {
  const obs = getObservability();
  const ctx = getTraceContext();
  if (obs?.events) {
    obs.events.emit({
      event_type: "MEMORY_QUERY",
      request_id: ctx?.request_id ?? "unknown",
      trace_id: ctx?.trace_id,
      timestamp_iso: new Date().toISOString(),
      redaction_level: "minimal",
      payload,
    });
  }
}
