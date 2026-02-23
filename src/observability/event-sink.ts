/**
 * Optional persistent event sink for observability (long-term retention).
 * @see Docs/SPEC/18_Observability_Spec.md, L2-04 – in-memory/capture only → optional sink
 * When set, emitted events (after sampling/redaction) are also written to the sink.
 */

import { appendFileSync } from "node:fs";
import type { TelemetryEvent } from "./events.js";

/** Sink for telemetry events; e.g. file append or OTEL exporter. */
export interface IEventSink {
  write(event: TelemetryEvent): void;
}

let eventSink: IEventSink | null = null;

export function setEventSink(sink: IEventSink | null): void {
  eventSink = sink;
}

export function getEventSink(): IEventSink | null {
  return eventSink;
}

/** File sink: one JSON line per event (NDJSON). Enable via OBSERVABILITY_EVENT_SINK_PATH. */
export function createFileEventSink(filePath: string): IEventSink {
  return {
    write(event: TelemetryEvent): void {
      appendFileSync(filePath, JSON.stringify(event) + "\n", "utf8");
    },
  };
}
