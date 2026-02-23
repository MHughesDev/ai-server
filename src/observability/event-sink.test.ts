/**
 * Event sink tests – L2-04 long-term retention (optional file sink).
 */

import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setEventSink, getEventSink, createFileEventSink } from "./event-sink.js";
import type { TelemetryEvent } from "./events.js";

const tempPath = () => join(tmpdir(), `event-sink-test-${Date.now()}-${Math.random().toString(36).slice(2)}.ndjson`);

describe("event sink", () => {
  afterEach(() => {
    setEventSink(null);
  });

  it("getEventSink returns null when unset", () => {
    setEventSink(null);
    expect(getEventSink()).toBeNull();
  });

  it("setEventSink and getEventSink round-trip", () => {
    const sink: { write: (e: TelemetryEvent) => void } = { write: () => {} };
    setEventSink(sink);
    expect(getEventSink()).toBe(sink);
  });

  it("createFileEventSink appends one JSON line per event (NDJSON)", () => {
    const path = tempPath();
    try {
      const sink = createFileEventSink(path);
      const e1: TelemetryEvent = { event_type: "POLICY_DECISION", request_id: "r1", payload: { allowed: true } };
      const e2: TelemetryEvent = { event_type: "FINAL_SYNTH", request_id: "r2", trace_id: "t2" };
      sink.write(e1);
      sink.write(e2);
      expect(existsSync(path)).toBe(true);
      const content = readFileSync(path, "utf8");
      const lines = content.trim().split("\n");
      expect(lines).toHaveLength(2);
      const first = JSON.parse(lines[0] ?? "") as TelemetryEvent;
      const second = JSON.parse(lines[1] ?? "") as TelemetryEvent;
      expect(first.event_type).toBe("POLICY_DECISION");
      expect(first.request_id).toBe("r1");
      expect(second.event_type).toBe("FINAL_SYNTH");
      expect(second.trace_id).toBe("t2");
    } finally {
      if (existsSync(path)) unlinkSync(path);
    }
  });
});
