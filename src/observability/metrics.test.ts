/**
 * Metrics and cardinality guardrails tests – L2-04 Phase 1 (7.1 metric label validation)
 */

import {
  incrementCounter,
  recordHistogram,
  getCounterSnapshot,
  getHistogramSnapshot,
  getPrometheusText,
  getMetricsInternalStats,
  resetMetrics,
  METRIC_REQUESTS_TOTAL,
  METRIC_ERRORS_TOTAL,
  setTraceSampleRate,
  shouldSampleTrace,
  recordRequestRate,
  recordError,
  recordDuration,
  recordRedMetrics,
  exportAndResetCounters,
  getPrometheusTimestampAnnotation,
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

  it("getPrometheusText returns exposition format with TYPE and metrics", () => {
    incrementCounter(METRIC_REQUESTS_TOTAL, 1, { route: "reactive_chat", status: "ok" });
    recordHistogram("request_latency_ms", 42, { route: "reactive_chat", status: "ok" });
    const text = getPrometheusText();
    expect(text).toContain("# TYPE");
    expect(text).toContain("requests_total");
    expect(text).toContain("request_latency_ms");
    expect(text).toContain("reactive_chat");
    expect(text).toContain(" 1\n");
    expect(text).toContain(" 42\n");
    expect(text).toContain("ai_server_metrics_dropped_total");
    expect(text).toContain('dimension="counter_series"');
  });

  it("bounds histogram samples and tracks dropped counts", () => {
    for (let i = 0; i < 300; i++) {
      recordHistogram("bounded_latency_ms", i, { route: "reactive_chat", status: "ok" });
    }
    const snap = getHistogramSnapshot();
    const key = Object.keys(snap).find((k) => k.includes("bounded_latency_ms"));
    expect(key).toBeDefined();
    expect(snap[key!].count).toBeLessThanOrEqual(256);
    const stats = getMetricsInternalStats();
    expect(stats.droppedHistogramSamples).toBeGreaterThan(0);
  });

  describe("trace sampling (L2-04)", () => {
    it("samples all traces at rate 1.0", () => {
      setTraceSampleRate(1.0);
      expect(shouldSampleTrace("trace-1", "query")).toBe(true);
      expect(shouldSampleTrace("trace-2", "query")).toBe(true);
    });

    it("samples no traces at rate 0.0", () => {
      setTraceSampleRate(0.0);
      expect(shouldSampleTrace("trace-1", "query")).toBe(false);
      expect(shouldSampleTrace("trace-2", "query")).toBe(false);
    });

    it("deterministically samples at intermediate rates", () => {
      setTraceSampleRate(0.5);
      const samples = Array.from({ length: 1000 }, (_, i) =>
        shouldSampleTrace(`trace-${i}`, "query")
      );
      const sampledCount = samples.filter(Boolean).length;
      // Should be roughly 50% with some variance
      expect(sampledCount).toBeGreaterThan(400);
      expect(sampledCount).toBeLessThan(600);
    });

    it("consistent sampling for same trace ID", () => {
      setTraceSampleRate(0.5);
      const traceId = "consistent-trace-id";
      // Same trace ID should always have same sampling decision
      const first = shouldSampleTrace(traceId, "query");
      for (let i = 0; i < 10; i++) {
        expect(shouldSampleTrace(traceId, "query")).toBe(first);
      }
    });
  });

  describe("RED metrics helpers (L2-04)", () => {
    it("records request rate", () => {
      recordRequestRate("/v1/query");
      recordRequestRate("/v1/query");
      const snap = getCounterSnapshot();
      expect(snap["requests_total{route=\"/v1/query\"}"]).toBe(2);
    });

    it("records errors", () => {
      recordError("/v1/query", "AUTH_INVALID");
      recordError("/v1/query", "AUTH_INVALID");
      const snap = getCounterSnapshot();
      expect(snap["errors_total{error_code=\"AUTH_INVALID\",route=\"/v1/query\"}"]).toBe(2);
    });

    it("records duration", () => {
      recordDuration("/v1/query", 150);
      recordDuration("/v1/query", 250);
      const snap = getHistogramSnapshot();
      const key = Object.keys(snap).find((k) =>
        k.includes("request_latency_ms") && k.includes("/v1/query")
      );
      expect(key).toBeDefined();
      expect(snap[key!].count).toBe(2);
      expect(snap[key!].sum).toBe(400);
    });

    it("records complete RED metrics", () => {
      recordRedMetrics("/v1/query", 100, "INTERNAL_ERROR");
      recordRedMetrics("/v1/query", 200); // Success

      const counters = getCounterSnapshot();
      expect(counters["requests_total{route=\"/v1/query\"}"]).toBe(2);
      expect(counters["errors_total{error_code=\"INTERNAL_ERROR\",route=\"/v1/query\"}"]).toBe(1);

      const histograms = getHistogramSnapshot();
      const key = Object.keys(histograms).find((k) =>
        k.includes("request_latency_ms") && k.includes("/v1/query")
      );
      expect(histograms[key!].count).toBe(2);
    });
  });

  describe("export and reset (L2-04)", () => {
    it("exports counters and resets them", () => {
      incrementCounter("test_counter", 5, { route: "test" });
      const result = exportAndResetCounters();

      expect(result.counters["test_counter{route=\"test\"}"]).toBe(5);
      expect(result.timestamp).toBeGreaterThan(0);
      expect(Object.keys(getCounterSnapshot())).toHaveLength(0);
    });

    it("preserves histograms after counter reset", () => {
      incrementCounter("test_counter", 1);
      recordHistogram("test_histogram", 100);

      exportAndResetCounters();

      // Counters should be reset
      expect(Object.keys(getCounterSnapshot())).toHaveLength(0);
      // Histograms should be preserved
      expect(Object.keys(getHistogramSnapshot())).toHaveLength(1);
    });
  });

  describe("Prometheus timestamp annotation (L2-04)", () => {
    it("includes timestamp in annotation", () => {
      const annotation = getPrometheusTimestampAnnotation();
      expect(annotation).toContain("Timestamp:");
      expect(annotation).toContain(String(Date.now()).slice(0, 10)); // First 10 digits of timestamp
    });
  });
});
