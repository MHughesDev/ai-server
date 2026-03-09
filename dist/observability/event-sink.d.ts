/**
 * Optional persistent event sink for observability (long-term retention).
 * @see docs/SPEC/18_Observability_Spec.md, L2-04 – in-memory/capture only → optional sink
 * When set, emitted events (after sampling/redaction) are also written to the sink.
 * L2-04: Backpressure handling for high-volume scenarios.
 */
import type { TelemetryEvent } from "./events.js";
/** Sink for telemetry events; e.g. file append or OTEL exporter. */
export interface IEventSink {
    write(event: TelemetryEvent): void;
    getStatus?(): EventSinkStatus;
    close?(): Promise<void>;
    /** L2-04: Returns true when backpressure is active (queue above threshold) */
    isBackpressureActive?(): boolean;
}
export interface EventSinkStatus {
    queueDepth: number;
    maxQueueSize: number;
    droppedEvents: number;
    isDraining: boolean;
    lastError: string | null;
    /** L2-04: Backpressure indicator */
    backpressureActive: boolean;
}
export interface FileEventSinkOptions {
    maxQueueSize?: number;
    maxFileSizeBytes?: number;
    maxRotatedFiles?: number;
    /** L2-04: Backpressure threshold (0-1), default 0.8 */
    backpressureThreshold?: number;
}
/** L2-04: Set callback for backpressure events */
export declare function setEventBackpressureCallback(callback: (() => void) | null): void;
/** L2-04: Check if event sink backpressure is active */
export declare function isEventBackpressureActive(): boolean;
export declare function setEventSink(sink: IEventSink | null): void;
export declare function getEventSink(): IEventSink | null;
/** File sink: one JSON line per event (NDJSON). Enable via OBSERVABILITY_EVENT_SINK_PATH.
 * Non-blocking queued writer with bounded queue and size-based rotation.
 * L2-04: Backpressure handling for queue management.
 */
export declare function createFileEventSink(filePath: string, options?: FileEventSinkOptions): IEventSink;
//# sourceMappingURL=event-sink.d.ts.map