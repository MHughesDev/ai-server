/**
 * Redaction utility for logs, events, and traces.
 * @see docs/SPEC/18_Observability_Spec.md, L2-04 Phase 0 – no PII/secrets in telemetry
 */

/** Keys that must never appear in telemetry (secrets, PII); match on normalized key only */
const SENSITIVE_KEYS = new Set([
  "password",
  "secret",
  "token",
  "authorization",
  "auth",
  "api_key",
  "apikey",
  "api_secret",
  "cookie",
  "session_id",
  "user_id",
  "email",
  "ssn",
  "credit_card",
  "content_b64",
  "bearer",
  "client_secret",
  "access_token",
  "refresh_token",
  "id_token",
  "private_key",
  "passwd",
  "credentials",
  "credential",
  "signing_key",
  "webhook_secret",
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
  "tool_id",
  "roles",
  "hit_count",
  "latency_ms",
  "scope",
  "degraded",
  "error",
  "caller_org",
  "caller_app",
  "caller_user",
]);

export type RedactionLevel = "none" | "minimal" | "full";

const PRODUCTION_ALLOWED_LEVELS: RedactionLevel[] = ["minimal", "full"];

function isSensitiveKey(key: string): boolean {
  const keyLower = key.toLowerCase().replace(/[-_]/g, "_");
  return (
    SENSITIVE_KEYS.has(keyLower) ||
    keyLower.includes("password") ||
    keyLower.includes("secret") ||
    keyLower.includes("credential")
  );
}

/** Recursively detect sensitive key names (for tests and acceptance). */
export function payloadHasSensitiveKeys(payload: unknown): boolean {
  if (payload == null || typeof payload !== "object") return false;
  if (Array.isArray(payload)) {
    return payload.some((item) => payloadHasSensitiveKeys(item));
  }
  const record = payload as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (isSensitiveKey(key)) return true;
    if (value !== null && typeof value === "object" && payloadHasSensitiveKeys(value)) {
      return true;
    }
  }
  return false;
}

/** Resolve emitter redaction level from env (default minimal). */
export function resolveTelemetryRedactionLevel(): RedactionLevel {
  const raw = (process.env.OBSERVABILITY_REDACTION_LEVEL ?? "minimal").trim().toLowerCase();
  if (raw === "none" || raw === "minimal" || raw === "full") return raw;
  return "minimal";
}

/** Production must not disable telemetry redaction (PR-013). */
export function assertProductionTelemetryRedactionLevel(): void {
  const level = resolveTelemetryRedactionLevel();
  if (!PRODUCTION_ALLOWED_LEVELS.includes(level)) {
    throw new Error(
      "Production requires OBSERVABILITY_REDACTION_LEVEL=minimal or full (none exposes PII/secrets in telemetry)"
    );
  }
}

export type RedactOptions = {
  /** When true, treat the object as a telemetry event `payload` body: allow non-allowlisted keys except sensitive. */
  payloadRoot?: boolean;
};

function redactArrayElement(
  value: unknown,
  level: RedactionLevel,
  insideTelemetryPayload: boolean
): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value !== "object") {
    if (level === "full" && typeof value === "string" && value.length > 0) {
      return "[REDACTED]";
    }
    return value;
  }
  return redactRecord(value, level, insideTelemetryPayload);
}

function redactRecord(
  obj: unknown,
  level: RedactionLevel,
  insideTelemetryPayload: boolean
): Record<string, unknown> {
  if (obj === null || obj === undefined) {
    return {};
  }
  if (typeof obj !== "object") {
    return level === "full" ? { "[value]": "[REDACTED]" } : { value: obj };
  }
  const record = obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (isSensitiveKey(key)) {
      continue;
    }
    const applyAllowlist = (level === "minimal" || level === "full") && !insideTelemetryPayload;
    if (applyAllowlist) {
      const allowed =
        ALLOWLIST_MINIMAL.has(key) ||
        ALLOWLIST_MINIMAL.has(key.toLowerCase()) ||
        key === "payload";
      if (!allowed && level === "minimal") continue;
      if (!allowed && level === "full") continue;
    }
    const descendPayload = insideTelemetryPayload || key === "payload";
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      out[key] = redactRecord(value, level, descendPayload);
    } else if (Array.isArray(value)) {
      out[key] = value.map((v) => redactArrayElement(v, level, descendPayload));
    } else if (level === "full" && typeof value === "string" && value.length > 0) {
      out[key] = "[REDACTED]";
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Redact an object for telemetry: strip sensitive keys and optionally restrict to allowlist.
 * - none: remove only SENSITIVE_KEYS (and nested keys containing them).
 * - minimal: only allow ALLOWLIST_MINIMAL at top level; nested under `payload` (or with `payloadRoot: true`) keeps non-sensitive keys.
 * - full: same as minimal but also redact string values to length-only or "[REDACTED]".
 */
export function redact(
  obj: unknown,
  level: RedactionLevel = "minimal",
  options?: RedactOptions
): Record<string, unknown> {
  return redactRecord(obj, level, options?.payloadRoot ?? false);
}

/**
 * One-line error text for console logs — message only, no stack (WANT-012).
 */
export function safeLogError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Redact a string that might contain secrets (e.g. headers).
 */
export function redactString(s: string, level: RedactionLevel = "minimal"): string {
  if (level === "none") return s;
  return "[REDACTED]";
}
