/**
 * Telemetry event emitter – emits canonical events with redaction.
 * @see docs/SPEC/18_Observability_Spec.md, L2-04 Phase 0
 */
import type { TelemetryEvent } from "./events.js";
import { type RedactionLevel } from "./redact.js";
export interface EventEmitter {
    emit(event: TelemetryEvent): void;
}
/** In-memory + console emitter for dev/staging; applies redaction before emit. L2-04: optional sampling. */
export declare function createEmitter(options?: {
    redactionLevel?: RedactionLevel;
    logToConsole?: boolean;
    capture?: TelemetryEvent[];
    maxCaptureSize?: number;
    /** L2-04: Trace sample rate 0–1; 1 = emit all; <1 = sample (deterministic by trace_id when present) */
    sampleRate?: number;
}): EventEmitter;
/** No-op emitter when observability is disabled */
export declare const noopEmitter: EventEmitter;
//# sourceMappingURL=emitter.d.ts.map