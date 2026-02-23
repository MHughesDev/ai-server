/**
 * Optional persistent event sink for observability (long-term retention).
 * @see Docs/SPEC/18_Observability_Spec.md, L2-04 – in-memory/capture only → optional sink
 * When set, emitted events (after sampling/redaction) are also written to the sink.
 */
import type { TelemetryEvent } from "./events.js";
/** Sink for telemetry events; e.g. file append or OTEL exporter. */
export interface IEventSink {
    write(event: TelemetryEvent): void;
}
export declare function setEventSink(sink: IEventSink | null): void;
export declare function getEventSink(): IEventSink | null;
/** File sink: one JSON line per event (NDJSON). Enable via OBSERVABILITY_EVENT_SINK_PATH. */
export declare function createFileEventSink(filePath: string): IEventSink;
//# sourceMappingURL=event-sink.d.ts.map