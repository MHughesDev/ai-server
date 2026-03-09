/**
 * Core metrics with cardinality controls (allowlist labels).
 * @see docs/SPEC/18_Observability_Spec.md, L2-04 Phase 1
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
const MAX_COUNTER_SERIES = 2_000;
const MAX_HISTOGRAM_SERIES = 500;
const MAX_HISTOGRAM_SAMPLES_PER_SERIES = 256;
function sanitizeLabelKey(key) {
    return ALLOWED_LABELS.has(key) ? key : "unknown";
}
/** In-memory counters (for GET /metrics and tests).
 * PRODUCTION: Counters and histogram arrays grow unbounded with label combinations; long-lived processes may need bounded cardinality, periodic export-and-reset, or a fixed-size reservoir for histogram values.
 */
const counters = new Map();
const histograms = new Map();
let droppedCounterSeries = 0;
let droppedHistogramSeries = 0;
let droppedHistogramSamples = 0;
function counterKey(name, labels) {
    const parts = Object.entries(labels)
        .filter(([k]) => ALLOWED_LABELS.has(k))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${sanitizeLabelKey(k)}="${String(v).slice(0, 64)}"`);
    return parts.length ? `${name}{${parts.join(",")}}` : name;
}
export function incrementCounter(name, value = 1, labels = {}) {
    const key = counterKey(name, labels);
    if (!counters.has(key) && counters.size >= MAX_COUNTER_SERIES) {
        droppedCounterSeries += 1;
        return;
    }
    counters.set(key, (counters.get(key) ?? 0) + value);
}
export function recordHistogram(name, value, labels = {}) {
    const key = counterKey(name, labels);
    if (!histograms.has(key) && histograms.size >= MAX_HISTOGRAM_SERIES) {
        droppedHistogramSeries += 1;
        return;
    }
    const list = histograms.get(key) ?? [];
    if (list.length >= MAX_HISTOGRAM_SAMPLES_PER_SERIES) {
        list.shift();
        droppedHistogramSamples += 1;
    }
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
/** Parse metric key "name{label1=val1,...}" into name and labels object */
function parseMetricKey(key) {
    const brace = key.indexOf("{");
    if (brace < 0)
        return { name: key, labels: {} };
    const name = key.slice(0, brace);
    const rest = key.slice(brace + 1, key.length - 1);
    const labels = {};
    for (const part of rest.split(",")) {
        const eq = part.indexOf("=");
        if (eq < 0)
            continue;
        const k = part.slice(0, eq).trim();
        const v = part.slice(eq + 1).trim().replace(/^"|"$/g, "");
        if (k && v !== undefined)
            labels[k] = v;
    }
    return { name, labels };
}
function formatLabels(labels) {
    const parts = Object.entries(labels)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}="${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
    return parts.length ? `{${parts.join(",")}}` : "";
}
/**
 * Export metrics in Prometheus exposition text format (for scraping).
 * @see https://prometheus.io/docs/instrumenting/exposition_formats/
 */
export function getPrometheusText() {
    const lines = [];
    const counters = getCounterSnapshot();
    const histograms = getHistogramSnapshot();
    const seenTypes = new Set();
    for (const [key, value] of Object.entries(counters)) {
        const { name, labels } = parseMetricKey(key);
        const safeName = name.replace(/[^a-zA-Z0-9_]/g, "_");
        if (!seenTypes.has(safeName)) {
            lines.push(`# TYPE ${safeName} counter`);
            seenTypes.add(safeName);
        }
        lines.push(`${safeName}${formatLabels(labels)} ${value}`);
    }
    for (const [key, data] of Object.entries(histograms)) {
        const { name, labels } = parseMetricKey(key);
        const baseName = name.replace(/[^a-zA-Z0-9_]/g, "_");
        const countName = `${baseName}_count`;
        const sumName = `${baseName}_sum`;
        if (!seenTypes.has(baseName)) {
            lines.push(`# TYPE ${baseName} summary`);
            seenTypes.add(baseName);
        }
        lines.push(`${countName}${formatLabels(labels)} ${data.count}`);
        lines.push(`${sumName}${formatLabels(labels)} ${data.sum}`);
    }
    return lines.length ? lines.join("\n") + "\n" : "# No metrics yet\n";
}
/** Reset all metrics (for tests) */
export function resetMetrics() {
    counters.clear();
    histograms.clear();
    droppedCounterSeries = 0;
    droppedHistogramSeries = 0;
    droppedHistogramSamples = 0;
}
/** Internal observability for bounded-memory behavior and backpressure visibility. */
export function getMetricsInternalStats() {
    return {
        droppedCounterSeries,
        droppedHistogramSeries,
        droppedHistogramSamples,
    };
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
class DeterministicTraceSampler {
    sampleRate;
    constructor(sampleRate) {
        this.sampleRate = sampleRate;
    }
    shouldSample(traceId, _operation) {
        if (this.sampleRate >= 1)
            return true;
        if (this.sampleRate <= 0)
            return false;
        // Deterministic sampling based on traceId hash
        const hash = traceId.split("").reduce((acc, char) => {
            return (acc * 31 + char.charCodeAt(0)) & 0x7fffffff;
        }, 0);
        return (hash % 1000) / 1000 < this.sampleRate;
    }
}
let traceSampler = new DeterministicTraceSampler(1);
export function setTraceSampleRate(rate) {
    traceSampler = new DeterministicTraceSampler(Math.max(0, Math.min(1, rate)));
}
export function shouldSampleTrace(traceId, operation) {
    return traceSampler.shouldSample(traceId, operation);
}
/**
 * Record request rate metric (part of RED).
 * Call at the start of request handling.
 */
export function recordRequestRate(route) {
    incrementCounter(METRIC_REQUESTS_TOTAL, 1, { route });
}
/**
 * Record error metric (part of RED).
 * Call when request results in an error.
 */
export function recordError(route, errorCode) {
    incrementCounter(METRIC_ERRORS_TOTAL, 1, { route, error_code: errorCode });
}
/**
 * Record request duration (part of RED).
 * Call at the end of request handling with duration in ms.
 */
export function recordDuration(route, durationMs) {
    recordHistogram(METRIC_REQUEST_LATENCY_MS, durationMs, { route });
}
/**
 * Complete RED metrics recording for a request.
 * Helper to record all three RED metrics in one call.
 */
export function recordRedMetrics(route, durationMs, errorCode) {
    recordRequestRate(route);
    if (errorCode) {
        recordError(route, errorCode);
    }
    recordDuration(route, durationMs);
}
/** Timestamp annotation for Prometheus export (L2-04) */
export function getPrometheusTimestampAnnotation() {
    return `# Timestamp: ${Date.now()}\n`;
}
/**
 * L2-04: Export-and-reset strategy for long-lived processes.
 * Returns current metrics and resets counters (histograms are preserved for history).
 * Use this for periodic metric export to prevent unbounded memory growth.
 */
export function exportAndResetCounters() {
    const snapshot = getCounterSnapshot();
    const droppedStats = getMetricsInternalStats();
    const timestamp = Date.now();
    // Reset counters only (preserve histograms for historical analysis)
    counters.clear();
    droppedCounterSeries = 0;
    return {
        counters: snapshot,
        timestamp,
        droppedStats,
    };
}
//# sourceMappingURL=metrics.js.map