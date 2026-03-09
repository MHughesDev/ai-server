/**
 * Core metrics with cardinality controls (allowlist labels).
 * @see docs/SPEC/18_Observability_Spec.md, L2-04 Phase 1
 */
export declare function incrementCounter(name: string, value?: number, labels?: Record<string, string>): void;
export declare function recordHistogram(name: string, value: number, labels?: Record<string, string>): void;
/** Get current counter values for export (e.g. GET /metrics) */
export declare function getCounterSnapshot(): Record<string, number>;
/** Get histogram summaries (count, sum) per series for export */
export declare function getHistogramSnapshot(): Record<string, {
    count: number;
    sum: number;
}>;
/**
 * Export metrics in Prometheus exposition text format (for scraping).
 * @see https://prometheus.io/docs/instrumenting/exposition_formats/
 */
export declare function getPrometheusText(): string;
/** Reset all metrics (for tests) */
export declare function resetMetrics(): void;
/** Internal observability for bounded-memory behavior and backpressure visibility. */
export declare function getMetricsInternalStats(): {
    droppedCounterSeries: number;
    droppedHistogramSeries: number;
    droppedHistogramSamples: number;
};
/** Standard metric names */
export declare const METRIC_REQUESTS_TOTAL = "requests_total";
export declare const METRIC_ERRORS_TOTAL = "errors_total";
export declare const METRIC_REQUEST_LATENCY_MS = "request_latency_ms";
export declare const METRIC_ROUTE_TOTAL = "route_total";
export declare const METRIC_COST_USD = "cost_usd";
/** L2-05 Security metrics */
export declare const METRIC_SECURITY_DENY_TOTAL = "security_deny_total";
export declare const METRIC_SECRET_SCOPE_VIOLATIONS_TOTAL = "secret_scope_violations_total";
export declare const METRIC_AUDIT_WRITE_LATENCY_MS = "audit_write_latency_ms";
/** L2-06 Memory/retrieval metrics */
export declare const METRIC_RETRIEVAL_LATENCY_MS = "retrieval_latency_ms";
export declare const METRIC_RETRIEVAL_FALLBACK_TOTAL = "retrieval_fallback_total";
export declare const METRIC_RETRIEVAL_HITS_TOTAL = "retrieval_hits_total";
/** L2-07 Multimodal: attachment validation rejections by reason */
export declare const METRIC_ATTACHMENT_REJECT_TOTAL = "attachment_reject_total";
export declare function setTraceSampleRate(rate: number): void;
export declare function shouldSampleTrace(traceId: string, operation: string): boolean;
/**
 * Record request rate metric (part of RED).
 * Call at the start of request handling.
 */
export declare function recordRequestRate(route: string): void;
/**
 * Record error metric (part of RED).
 * Call when request results in an error.
 */
export declare function recordError(route: string, errorCode: string): void;
/**
 * Record request duration (part of RED).
 * Call at the end of request handling with duration in ms.
 */
export declare function recordDuration(route: string, durationMs: number): void;
/**
 * Complete RED metrics recording for a request.
 * Helper to record all three RED metrics in one call.
 */
export declare function recordRedMetrics(route: string, durationMs: number, errorCode?: string): void;
/** Timestamp annotation for Prometheus export (L2-04) */
export declare function getPrometheusTimestampAnnotation(): string;
/**
 * L2-04: Export-and-reset strategy for long-lived processes.
 * Returns current metrics and resets counters (histograms are preserved for history).
 * Use this for periodic metric export to prevent unbounded memory growth.
 */
export declare function exportAndResetCounters(): {
    counters: Record<string, number>;
    timestamp: number;
    droppedStats: {
        droppedCounterSeries: number;
        droppedHistogramSeries: number;
        droppedHistogramSamples: number;
    };
};
//# sourceMappingURL=metrics.d.ts.map