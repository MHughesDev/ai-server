/**
 * Redaction utility for logs, events, and traces.
 * @see docs/SPEC/18_Observability_Spec.md, L2-04 Phase 0 – no PII/secrets in telemetry
 */
export type RedactionLevel = "none" | "minimal" | "full";
export type RedactOptions = {
    /** When true, treat the object as a telemetry event `payload` body: allow non-allowlisted keys except sensitive. */
    payloadRoot?: boolean;
};
/**
 * Redact an object for telemetry: strip sensitive keys and optionally restrict to allowlist.
 * - none: remove only SENSITIVE_KEYS (and nested keys containing them).
 * - minimal: only allow ALLOWLIST_MINIMAL at top level; nested under `payload` (or with `payloadRoot: true`) keeps non-sensitive keys.
 * - full: same as minimal but also redact string values to length-only or "[REDACTED]".
 */
export declare function redact(obj: unknown, level?: RedactionLevel, options?: RedactOptions): Record<string, unknown>;
/**
 * One-line error text for console logs — message only, no stack (WANT-012).
 */
export declare function safeLogError(err: unknown): string;
/**
 * Redact a string that might contain secrets (e.g. headers).
 */
export declare function redactString(s: string, level?: RedactionLevel): string;
//# sourceMappingURL=redact.d.ts.map