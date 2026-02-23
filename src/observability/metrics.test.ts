/**
 * Metrics and cardinality guardrails tests – L2-04 Phase 1 (7.1 metric label validation)
 */

import {
  incrementCounter,
  recordHistogram,
  getCounterSnapshot,
  getHistogramSnapshot,
  resetMetrics,
  METRIC_REQUESTS_TOTAL,
  METRIC_ERRORS_TOTAL,
} from "./metrics.js";

describe("observability metrics", () => {
  beforeEach(() => {
    resetMetrics();
  });

  it("increments counters with allowed labels", () => {
    incrementCounter(METRIC_REQUESTS_TOTAL, 1, { route: "reactive_chat", status: "ok" });
    incrementCounter(METRIC_REQUESTS_TOTAL, 2, { route: "reactive_chat", status: "error" });
    const snap = getCounterSnapshot();
    expect(Object.keys(snap).length).toBe(2);
    const total = Object.values(snap).reduce((a, b) => a + b, 0);
    expect(total).toBe(3);
  });

  it("records histograms with allowed labels", () => {
    recordHistogram("request_latency_ms", 10, { route: "reactive_chat", status: "ok" });
    recordHistogram("request_latency_ms", 20, { route: "reactive_chat", status: "ok" });
    const snap = getHistogramSnapshot();
    const key = Object.keys(snap).find((k) => k.includes("request_latency_ms"));
    expect(key).toBeDefined();
    expect(snap[key!].count).toBe(2);
    expect(snap[key!].sum).toBe(30);
  });

  it("resetMetrics clears counters and histograms", () => {
    incrementCounter(METRIC_ERRORS_TOTAL, 1);
    recordHistogram("request_latency_ms", 5);
    resetMetrics();
    expect(Object.keys(getCounterSnapshot()).length).toBe(0);
    expect(Object.keys(getHistogramSnapshot()).length).toBe(0);
  });
});
