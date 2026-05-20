/**
 * SPEC 18 events emitted from engines/stores outside pipeline-local emitters (WANT-037).
 */

import { emitTelemetryEvent } from "./emit-telemetry.js";

export function emitVerifyResultEvent(payload: Record<string, unknown>): void {
  emitTelemetryEvent({
    event_type: "VERIFY_RESULT",
    redaction_level: "minimal",
    payload,
  });
}

export function emitMemoryWriteEvent(payload: Record<string, unknown>): void {
  emitTelemetryEvent({
    event_type: "MEMORY_WRITE",
    redaction_level: "minimal",
    payload,
  });
}

/** SPEC 18 `MEMORY_QUERY` — single emission site for `runRetrieval` (WANT-037). */
export function emitMemoryQueryEvent(payload: Record<string, unknown>): void {
  emitTelemetryEvent({
    event_type: "MEMORY_QUERY",
    redaction_level: "minimal",
    payload,
  });
}
