/**
 * Redaction utility for logs, events, and traces.
 * @see docs/SPEC/18_Observability_Spec.md, L2-04 Phase 0 – no PII/secrets in telemetry
 */
/** Keys that must never appear in telemetry (secrets, PII) */
const SENSITIVE_KEYS = new Set([
    "password",
    "secret",
    "token",
    "authorization",
    "auth",
    "api_key",
    "apikey",
    "cookie",
    "session_id",
    "user_id",
    "email",
    "ssn",
    "credit_card",
    "content_b64",
    "bearer",
]);
/** Keys allowed in telemetry at "minimal" redaction (ids only, no content) */
const ALLOWLIST_MINIMAL = new Set([
    "request_id",
    "trace_id",
    "event_type",
    "timestamp_iso",
    "redaction_level",
    "pipeline_type",
    "strategy_id",
    "route",
    "allowed",
    "deny_reason",
    "code",
    "message",
    "stage",
    "duration_ms",
    "status",
    "token_budget",
    "tool_budget",
    "deadline_ms",
    "cost_budget_usd",
    "allow_tools",
    "deny_tools",
    "memory_scope",
    "allowed_pipelines",
    "reason",
    "deny",
    "detail_redacted",
    "payload",
    "cost_estimate_usd",
    "tokens_used",
    "workflow_id",
    "engine_type",
    "invocation_id",
    "hit_count",
    "latency_ms",
    "scope",
    "caller_org",
    "caller_app",
    "caller_user",
]);
/**
 * Redact an object for telemetry: strip sensitive keys and optionally restrict to allowlist.
 * - none: remove only SENSITIVE_KEYS (and nested keys containing them).
 * - minimal: only allow ALLOWLIST_MINIMAL at top level; payload may contain allowlisted payload keys.
 * - full: same as minimal but also redact string values to length-only or "[REDACTED]".
 */
export function redact(obj, level = "minimal") {
    if (obj === null || obj === undefined) {
        return {};
    }
    if (typeof obj !== "object") {
        return level === "full" ? { "[value]": "[REDACTED]" } : { value: obj };
    }
    const record = obj;
    const out = {};
    for (const [key, value] of Object.entries(record)) {
        const keyLower = key.toLowerCase().replace(/[-_]/g, "_");
        if (SENSITIVE_KEYS.has(key) || keyLower.includes("password") || keyLower.includes("secret")) {
            continue;
        }
        if (level === "minimal" || level === "full") {
            const allowed = ALLOWLIST_MINIMAL.has(key) ||
                ALLOWLIST_MINIMAL.has(key.toLowerCase()) ||
                key === "payload";
            if (!allowed && level === "minimal")
                continue;
            if (!allowed && level === "full")
                continue;
        }
        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            out[key] = redact(value, level);
        }
        else if (Array.isArray(value)) {
            out[key] = value.map((v) => redact(v, level));
        }
        else if (level === "full" && typeof value === "string" && value.length > 0) {
            out[key] = "[REDACTED]";
        }
        else {
            out[key] = value;
        }
    }
    return out;
}
/**
 * Redact a string that might contain secrets (e.g. headers).
 */
export function redactString(s, level = "minimal") {
    if (level === "none")
        return s;
    return "[REDACTED]";
}
//# sourceMappingURL=redact.js.map