/**
 * Emitter and event presence tests – L2-04 Phase 0
 */

import { createEmitter, noopEmitter } from "./emitter.js";
import { setEventSink } from "./event-sink.js";
import type { TelemetryEvent } from "./events.js";
import { REQUIRED_EVENT_TYPES } from "./events.js";

describe("createEmitter", () => {
  it("captures emitted events", () => {
    const captured: TelemetryEvent[] = [];
    const emitter = createEmitter({ capture: captured });
    emitter.emit({
      event_type: "POLICY_DECISION",
      request_id: "req-1",
      payload: { allowed: true },
    });
    expect(captured).toHaveLength(1);
    expect(captured[0].event_type).toBe("POLICY_DECISION");
    expect((captured[0].payload as { allowed: boolean }).allowed).toBe(true);
  });

  it("redacts sensitive payload fields", () => {
    const captured: TelemetryEvent[] = [];
    const emitter = createEmitter({ capture: captured, redactionLevel: "minimal" });
    emitter.emit({
      event_type: "POLICY_DECISION",
      request_id: "req-1",
      payload: { allowed: true, password: "secret", token_budget: 4096 },
    });
    expect(captured[0].payload).not.toHaveProperty("password");
    expect((captured[0].payload as { token_budget: number }).token_budget).toBe(4096);
  });

  it("bounds capture buffer size when maxCaptureSize is set", () => {
    const captured: TelemetryEvent[] = [];
    const emitter = createEmitter({ capture: captured, maxCaptureSize: 3 });
    for (let i = 0; i < 5; i++) {
      emitter.emit({
        event_type: "POLICY_DECISION",
        request_id: `req-${i}`,
        payload: { idx: i },
      });
    }
    expect(captured).toHaveLength(3);
    expect(captured[0].request_id).toBe("req-2");
    expect(captured[2].request_id).toBe("req-4");
  });
});

describe("noopEmitter", () => {
  it("does not throw on emit", () => {
    noopEmitter.emit({
      event_type: "ERROR",
      request_id: "req-1",
      payload: { code: "TEST" },
    });
  });
});

describe("trace sampling (L2-04)", () => {
  it("with sampleRate 0 captures no events", () => {
    const captured: TelemetryEvent[] = [];
    const emitter = createEmitter({ capture: captured, sampleRate: 0 });
    for (let i = 0; i < 20; i++) {
      emitter.emit({
        event_type: "POLICY_DECISION",
        request_id: `req-${i}`,
        trace_id: `trace-${i}`,
        payload: {},
      });
    }
    expect(captured).toHaveLength(0);
  });

  it("with sampleRate 1 captures all events", () => {
    const captured: TelemetryEvent[] = [];
    const emitter = createEmitter({ capture: captured, sampleRate: 1 });
    emitter.emit({
      event_type: "POLICY_DECISION",
      request_id: "req-1",
      payload: {},
    });
    emitter.emit({
      event_type: "FINAL_SYNTH",
      request_id: "req-2",
      trace_id: "t2",
      payload: {},
    });
    expect(captured).toHaveLength(2);
  });

  it("deterministic sampling: same trace_id always same result", () => {
    const captured: TelemetryEvent[] = [];
    const emitter = createEmitter({ capture: captured, sampleRate: 0.5 });
    const traceId = "deterministic-trace-id-12345";
    for (let i = 0; i < 10; i++) {
      emitter.emit({
        event_type: "POLICY_DECISION",
        request_id: `req-${i}`,
        trace_id: traceId,
        payload: {},
      });
    }
    const count = captured.length;
    expect(count).toBe(10);
    captured.length = 0;
    for (let i = 0; i < 10; i++) {
      emitter.emit({
        event_type: "POLICY_DECISION",
        request_id: `req2-${i}`,
        trace_id: traceId,
        payload: {},
      });
    }
    expect(captured.length).toBe(count);
  });
});

describe("event sink integration (L2-04)", () => {
  afterEach(() => {
    setEventSink(null);
  });

  it("when event sink is set, emitted events are written to sink", () => {
    const sinkEvents: TelemetryEvent[] = [];
    setEventSink({
      write(ev) {
        sinkEvents.push(ev);
      },
    });
    const captured: TelemetryEvent[] = [];
    const emitter = createEmitter({ capture: captured });
    emitter.emit({
      event_type: "POLICY_DECISION",
      request_id: "req-sink",
      payload: { allowed: true },
    });
    expect(captured).toHaveLength(1);
    expect(sinkEvents).toHaveLength(1);
    expect(sinkEvents[0]?.event_type).toBe("POLICY_DECISION");
    expect(sinkEvents[0]?.request_id).toBe("req-sink");
  });
});

describe("required event presence", () => {
  it("emitter can emit all required event types", () => {
    const captured: TelemetryEvent[] = [];
    const emitter = createEmitter({ capture: captured });
    for (const eventType of REQUIRED_EVENT_TYPES) {
      emitter.emit({
        event_type: eventType,
        request_id: "req-1",
        payload: {},
      });
    }
    const types = captured.map((e) => e.event_type);
    expect(types).toHaveLength(REQUIRED_EVENT_TYPES.length);
    for (const t of REQUIRED_EVENT_TYPES) {
      expect(types).toContain(t);
    }
  });
});
