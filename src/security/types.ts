/**
 * Security module types – audit events, secret scope, tool deny.
 * @see docs/SPEC/19_Security_and_Isolation_Spec.md, L2-05
 */

/** Caller context for scope checks (role/org/env) */
export interface CallerContext {
  appId: string;
  userId: string;
  orgId: string;
  sessionId?: string;
  scopes: string[];
}

/** Redaction level for audit payload (WANT-012); defaults to OBSERVABILITY_REDACTION_LEVEL when omitted. */
export type AuditRedactionLevel = "none" | "minimal" | "full";

/** Immutable audit event – security-relevant action for tamper-evident log */
export interface AuditEvent {
  event_type: string;
  request_id: string;
  trace_id?: string;
  timestamp_iso: string;
  /** Redacted/safe payload only */
  payload: Record<string, unknown>;
  /** Optional override; payload is redacted at write time before hash chain and sinks. */
  redaction_level?: AuditRedactionLevel;
  /** Set by audit logger for integrity chain */
  sequence_id?: number;
  previous_event_hash?: string;
}

/** Secret reference for scoped resolution */
export interface SecretRef {
  key: string;
  /** Scope: org_id or org_id:env or role:name */
  scope: string;
  env?: string;
}

/** Result of tool invocation – deny-only in L2-05 */
export interface ToolDenyResult {
  allowed: false;
  reason: ToolDenyReason;
  message: string;
  tool_id: string;
}

export type ToolDenyReason =
  | "TOOL_GATEWAY_DENY_STUB"
  | "TOOL_NOT_ALLOWED"
  | "POLICY_DENY"
  | "SCOPE_VIOLATION";
