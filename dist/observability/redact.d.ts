/**
 * Redaction utility for logs, events, and traces.
 * @see Docs/SPEC/18_Observability_Spec.md, L2-04 Phase 0 – no PII/secrets in telemetry
 */
export type RedactionLevel = "none" | "minimal" | "full";
/**
 * Redact an object for telemetry: strip sensitive keys and optionally restrict to allowlist.
 * - none: remove only SENSITIVE_KEYS (and nested keys containing them).
 * - minimal: only allow ALLOWLIST_MINIMAL at top level; payload may contain allowlisted payload keys.
 * - full: same as minimal but also redact string values to length-only or "[REDACTED]".
 */
export declare function redact(obj: unknown, level?: RedactionLevel): Record<string, unknown>;
/**
 * Redact a string that might contain secrets (e.g. headers).
 */
export declare function redactString(s: string, level?: RedactionLevel): string;
//# sourceMappingURL=redact.d.ts.map