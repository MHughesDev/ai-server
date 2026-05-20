/**
 * Event sink tests – L2-04 long-term retention (optional file sink).
 */

import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setEventSink, getEventSink, createFileEventSink, setEventBackpressureCallback, isEventBackpressureActive } from "./event-sink.js";
import type { TelemetryEvent } from "./events.js";

const tempPath = () => join(tmpdir(), `event-sink-test-${Date.now()}-${Math.random().toString(36).slice(2)}.ndjson`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1_000
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("timed out waiting for condition");
    }
    await sleep(10);
  }
}

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

  it("rotates event file when max size exceeded (PR-012)", async () => {
    const path = tempPath();
    const rotated = `${path}.1`;
    try {
      const sink = createFileEventSink(path, {
        maxFileSizeBytes: 200,
        maxRotatedFiles: 2,
        maxQueueSize: 50,
      });
      for (let i = 0; i < 6; i++) {
        sink.write({
          event_type: "POLICY_DECISION",
          request_id: `r-${i}`,
          payload: { data: "y".repeat(120) },
        });
      }
      await waitFor(() => existsSync(rotated));
      await waitFor(() => {
        const status = sink.getStatus?.();
        return !!status && status.queueDepth === 0 && !status.isDraining;
      });
      expect(existsSync(rotated)).toBe(true);
    } finally {
      if (existsSync(rotated)) unlinkSync(rotated);
      if (existsSync(path)) unlinkSync(path);
    }
  });

  it("createFileEventSink appends one JSON line per event (NDJSON)", async () => {
    const path = tempPath();
    try {
      const sink = createFileEventSink(path);
      const e1: TelemetryEvent = { event_type: "POLICY_DECISION", request_id: "r1", payload: { allowed: true } };
      const e2: TelemetryEvent = { event_type: "FINAL_SYNTH", request_id: "r2", trace_id: "t2" };
      sink.write(e1);
      sink.write(e2);
      await waitFor(() => existsSync(path));
      await waitFor(() => {
        const status = sink.getStatus?.();
        return !!status && status.queueDepth === 0 && !status.isDraining;
      });
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

  it("drops oldest events under backpressure", async () => {
    const path = tempPath();
    try {
      const sink = createFileEventSink(path, { maxQueueSize: 1, maxFileSizeBytes: 1_000_000_000 });
      for (let i = 0; i < 2_000; i++) {
        sink.write({ event_type: "POLICY_DECISION", request_id: `r-${i}` });
      }
      await waitFor(() => {
        const status = sink.getStatus?.();
        return !!status && status.droppedEvents > 0;
      });
      const status = sink.getStatus?.();
      expect(status?.droppedEvents).toBeGreaterThanOrEqual(1);
    } finally {
      if (existsSync(path)) unlinkSync(path);
    }
  });

  describe("backpressure handling (L2-04)", () => {
    beforeEach(() => {
      setEventBackpressureCallback(null);
    });

    it("triggers backpressure callback when threshold reached", () => {
      const path = tempPath();
      let backpressureTriggered = false;

      setEventBackpressureCallback(() => {
        backpressureTriggered = true;
      });

      try {
        // Create sink with lower threshold to trigger backpressure sooner
        const sink = createFileEventSink(path, {
          maxQueueSize: 5,
          backpressureThreshold: 0.4,
        });

        // Fill past 40% threshold (2 items triggers backpressure)
        for (let i = 0; i < 3; i++) {
          sink.write({ event_type: "FILL", request_id: `r-${i}` });
        }

        // Check immediately
        expect(backpressureTriggered).toBe(true);
        expect(isEventBackpressureActive()).toBe(true);
      } finally {
        if (existsSync(path)) unlinkSync(path);
      }
    });

    it("status includes backpressure indicator", () => {
      const path = tempPath();

      try {
        const sink = createFileEventSink(path, {
          maxQueueSize: 10,
          backpressureThreshold: 0.4,
        });

        // Initially no backpressure
        let status = sink.getStatus?.();
        expect(status?.backpressureActive).toBe(false);

        // Fill past 40% threshold (4 items)
        for (let i = 0; i < 5; i++) {
          sink.write({ event_type: "FILL", request_id: `r-${i}` });
        }

        // Check immediately
        status = sink.getStatus?.();
        expect(status?.backpressureActive).toBe(true);
      } finally {
        if (existsSync(path)) unlinkSync(path);
      }
    });

    it("isBackpressureActive returns correct state", () => {
      const path = tempPath();

      try {
        const sink = createFileEventSink(path, {
          maxQueueSize: 5,
          backpressureThreshold: 0.6,
        });

        // Initially no backpressure
        expect(sink.isBackpressureActive?.()).toBe(false);

        // Fill past 60% threshold (3 items)
        for (let i = 0; i < 4; i++) {
          sink.write({ event_type: "FILL", request_id: `r-${i}` });
        }

        // Check immediately
        expect(sink.isBackpressureActive?.()).toBe(true);
      } finally {
        if (existsSync(path)) unlinkSync(path);
      }
    });
  });
});
