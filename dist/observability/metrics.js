/**
 * Core metrics with cardinality controls (allowlist labels).
 * @see Docs/SPEC/18_Observability_Spec.md, L2-04 Phase 1
 */
/** Allowed label names to control cardinality */
const ALLOWED_LABELS = new Set([
    "route",
    "pipeline_type",
    "status",
    "error_code",
    "env",
    "reason",
    "event_type",
]);
function sanitizeLabelKey(key) {
    return ALLOWED_LABELS.has(key) ? key : "unknown";
}
/** In-memory counters (for GET /metrics and tests) */
const counters = new Map();
const histograms = new Map();
function counterKey(name, labels) {
    const parts = Object.entries(labels)
        .filter(([k]) => ALLOWED_LABELS.has(k))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${sanitizeLabelKey(k)}="${String(v).slice(0, 64)}"`);
    return parts.length ? `${name}{${parts.join(",")}}` : name;
}
export function incrementCounter(name, value = 1, labels = {}) {
    const key = counterKey(name, labels);
    counters.set(key, (counters.get(key) ?? 0) + value);
}
export function recordHistogram(name, value, labels = {}) {
    const key = counterKey(name, labels);
    const list = histograms.get(key) ?? [];
    list.push(value);
    histograms.set(key, list);
}
/** Get current counter values for export (e.g. GET /metrics) */
export function getCounterSnapshot() {
    const out = {};
    for (const [key, value] of counters) {
        out[key] = value;
    }
    return out;
}
/** Get histogram summaries (count, sum) per series for export */
export function getHistogramSnapshot() {
    const out = {};
    for (const [key, values] of histograms) {
        out[key] = {
            count: values.length,
            sum: values.reduce((a, b) => a + b, 0),
        };
    }
    return out;
}
/** Reset all metrics (for tests) */
export function resetMetrics() {
    counters.clear();
    histograms.clear();
}
/** Standard metric names */
export const METRIC_REQUESTS_TOTAL = "requests_total";
export const METRIC_ERRORS_TOTAL = "errors_total";
export const METRIC_REQUEST_LATENCY_MS = "request_latency_ms";
export const METRIC_ROUTE_TOTAL = "route_total";
export const METRIC_COST_USD = "cost_usd";
/** L2-05 Security metrics */
export const METRIC_SECURITY_DENY_TOTAL = "security_deny_total";
export const METRIC_SECRET_SCOPE_VIOLATIONS_TOTAL = "secret_scope_violations_total";
export const METRIC_AUDIT_WRITE_LATENCY_MS = "audit_write_latency_ms";
/** L2-06 Memory/retrieval metrics */
export const METRIC_RETRIEVAL_LATENCY_MS = "retrieval_latency_ms";
export const METRIC_RETRIEVAL_FALLBACK_TOTAL = "retrieval_fallback_total";
export const METRIC_RETRIEVAL_HITS_TOTAL = "retrieval_hits_total";
/** L2-07 Multimodal: attachment validation rejections by reason */
export const METRIC_ATTACHMENT_REJECT_TOTAL = "attachment_reject_total";
//# sourceMappingURL=metrics.js.map