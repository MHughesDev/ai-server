/**
 * Optional persistent event sink for observability (long-term retention).
 * @see Docs/SPEC/18_Observability_Spec.md, L2-04 – in-memory/capture only → optional sink
 * When set, emitted events (after sampling/redaction) are also written to the sink.
 */
import { appendFileSync } from "node:fs";
let eventSink = null;
export function setEventSink(sink) {
    eventSink = sink;
}
export function getEventSink() {
    return eventSink;
}
/** File sink: one JSON line per event (NDJSON). Enable via OBSERVABILITY_EVENT_SINK_PATH. */
export function createFileEventSink(filePath) {
    return {
        write(event) {
            appendFileSync(filePath, JSON.stringify(event) + "\n", "utf8");
        },
    };
}
//# sourceMappingURL=event-sink.js.map