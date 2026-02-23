# 19 Security and Isolation Spec

## Threats
Prompt injection, cross-tenant leakage, tool-based exfiltration, unauthorized side effects, resource abuse.

## Controls
Sandboxed tools, scoped secrets, strict memory boundaries, content sanitization, policy-as-code checks, immutable security audit logs.

## Compliance
Retention/deletion controls and incident evidence requirements.

## L2-05 Implementation Notes
- **Audit:** Append-only tamper-evident audit log with hash chain (`sequence_id`, `previous_event_hash`, `event_hash`). Security-relevant events: SECURITY_POLICY_DECISION, SECURITY_ROUTE_DENY, SECURITY_ERROR.
- **Secrets:** Scoped resolution by caller `orgId` and `scopes`; scope format `org_id` or `role:roleName`. Violations throw and are metered.
- **Tool Gateway:** Deny/stub-only in this cycle; all `invoke()` return structured deny. No real tool execution until future controlled enablement.
