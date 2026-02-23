/**
 * Telemetry event emitter – emits canonical events with redaction.
 * @see Docs/SPEC/18_Observability_Spec.md, L2-04 Phase 0
 */
import { createHash } from "node:crypto";
import { getEventSink } from "./event-sink.js";
import { redact } from "./redact.js";
/** Deterministic sample decision from trace_id (0–1); same trace_id => same result */
function shouldSampleTrace(traceId, sampleRate) {
    const h = createHash("sha256").update(traceId).digest();
    const bucket = (h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3];
    const normalized = (Math.abs(bucket) % 10_000) / 10_000;
    return normalized < sampleRate;
}
/** In-memory + console emitter for dev/staging; applies redaction before emit. L2-04: optional sampling. */
export function createEmitter(options) {
    const redactionLevel = options?.redactionLevel ?? "minimal";
    const logToConsole = options?.logToConsole ?? false;
    const capture = options?.capture ?? [];
    const sampleRate = options?.sampleRate ?? 1;
    return {
        emit(event) {
            if (sampleRate < 1) {
                const tid = event.trace_id;
                const keep = tid
                    ? shouldSampleTrace(tid, sampleRate)
                    : Math.random() < sampleRate;
                if (!keep)
                    return;
            }
            const level = event.redaction_level ?? redactionLevel;
            const redacted = {
                ...event,
                payload: event.payload ? redact(event.payload, level) : undefined,
            };
            const out = redact(redacted, level);
            capture.push(out);
            if (logToConsole) {
                console.debug("[observability]", JSON.stringify(out));
            }
            const sink = getEventSink();
            if (sink) {
                try {
                    sink.write(out);
                }
                catch (err) {
                    console.error("[observability] event sink write failed", err);
                }
            }
        },
    };
}
/** No-op emitter when observability is disabled */
export const noopEmitter = {
    emit(_event) {
        // no-op
    },
};
//# sourceMappingURL=emitter.js.map