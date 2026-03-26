/**
 * Telemetry event emitter – emits canonical events with redaction.
 * @see docs/SPEC/18_Observability_Spec.md, L2-04 Phase 0
 */

import { createHash } from "node:crypto";
import type { TelemetryEvent } from "./events.js";
import { getEventSink } from "./event-sink.js";
import { redact, safeLogError, type RedactionLevel } from "./redact.js";

export interface EventEmitter {
  emit(event: TelemetryEvent): void;
}

/** Deterministic sample decision from trace_id (0–1); same trace_id => same result */
function shouldSampleTrace(traceId: string, sampleRate: number): boolean {
  const h = createHash("sha256").update(traceId).digest();
  const bucket = (h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3];
  const normalized = (Math.abs(bucket) % 10_000) / 10_000;
  return normalized < sampleRate;
}

/** In-memory + console emitter for dev/staging; applies redaction before emit. L2-04: optional sampling. */
export function createEmitter(options?: {
  redactionLevel?: RedactionLevel;
  logToConsole?: boolean;
  capture?: TelemetryEvent[];
  maxCaptureSize?: number;
  /** L2-04: Trace sample rate 0–1; 1 = emit all; <1 = sample (deterministic by trace_id when present) */
  sampleRate?: number;
}): EventEmitter {
  const redactionLevel = options?.redactionLevel ?? "minimal";
  const logToConsole = options?.logToConsole ?? false;
  const capture = options?.capture;
  const maxCaptureSize = options?.maxCaptureSize ?? 1_000;
  const sampleRate = options?.sampleRate ?? 1;

  return {
    emit(event: TelemetryEvent): void {
      if (sampleRate < 1) {
        const tid = event.trace_id;
        const keep = tid
          ? shouldSampleTrace(tid, sampleRate)
          : Math.random() < sampleRate;
        if (!keep) return;
      }
      const level = (event.redaction_level as RedactionLevel) ?? redactionLevel;
      const redacted: TelemetryEvent = {
        ...event,
        payload: event.payload ? (redact(event.payload, level) as TelemetryEvent["payload"]) : undefined,
      };
      const out = redact(redacted, level) as TelemetryEvent;
      if (capture) {
        if (capture.length >= maxCaptureSize) {
          capture.shift();
        }
        capture.push(out);
      }
      if (logToConsole) {
        console.debug("[observability]", JSON.stringify(out));
      }
      const sink = getEventSink();
      if (sink) {
        try {
          sink.write(out);
        } catch (err) {
          console.error("[observability] event sink write failed", safeLogError(err));
        }
      }
    },
  };
}

/** No-op emitter when observability is disabled */
export const noopEmitter: EventEmitter = {
  emit(_event: TelemetryEvent): void {
    // no-op
  },
};
