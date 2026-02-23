/**
 * Core metrics with cardinality controls (allowlist labels).
 * @see Docs/SPEC/18_Observability_Spec.md, L2-04 Phase 1
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
/** Reset all metrics (for tests) */
export declare function resetMetrics(): void;
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
//# sourceMappingURL=metrics.d.ts.map