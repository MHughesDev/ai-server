# L2-05 Sprint Handoff – Security Isolation and Compliance

**Plan:** L2-05 Security Isolation and Compliance Implementation  
**Status:** Implementation complete  
**Handoff to:** L2-06 Memory and Retrieval, L2-07 Multimodal Input Path, L2-08 Rollout and Operational Readiness  

---

## 1) Downstream start checklist

- [x] Tamper-evident audit logger (append-only, hash chain integrity)
- [x] Scoped secret resolution by caller role/org/env; scope violation throws and is metered
- [x] Tool Gateway deny/stub-only: `IToolGateway.invoke()` always returns structured deny
- [x] Security audit events written on POLICY_DECISION, ROUTE_DENY, ERROR, **TOOL_ACCESS** (when audit_level !== "none") when `security_hard_controls_enabled`
- [x] Metrics: `security_deny_total`, `secret_scope_violations_total`, `audit_write_latency_ms`
- [x] Abuse/misuse tests: scope escalation, tool bypass, audit integrity under load
- [x] Feature flag: `security_hard_controls_enabled` (default true in dev/staging)
- [ ] Formal security gate review (owner sign-off)
- [ ] L2-06 / L2-07 / L2-08 implementation start

**Definition of ready for downstream:** All implementation items above are done. Downstream plans can rely on audit artifacts, secret scope checks, and deny-only tool gateway.

---

## 2) Security audit events and integrity

When `security_hard_controls_enabled` is true, the following audit event types are written to the tamper-evident log:

| Audit event type           | When emitted                    | Key payload fields (redacted)        |
|----------------------------|----------------------------------|--------------------------------------|
| SECURITY_POLICY_DECISION  | After policy evaluation          | `allowed`, `deny_reason`, `memory_scope` |
| SECURITY_ROUTE_DENY       | When request is blocked (route)   | `deny_reason`, `stage`               |
| SECURITY_ERROR            | On query path error              | `code`, `stage`, `message_redacted`  |
| TOOL_ACCESS               | After tool invoke (coding agent) when audit_level !== "none" | `tool_id`, `allowed`, `status`, `duration_ms` (redacted per policy) |

Each audit entry has: `sequence_id`, `previous_event_hash`, `event_hash` (SHA-256 over payload + chain). Use `verifyAuditIntegrity()` to detect tampering. Snapshot via `getAuditLogSnapshot()` (read-only). **All audit payloads are redacted** per **policy.redaction_level** before write (no raw secrets in audit log). Telemetry events also use policy.redaction_level.

---

## 3) Secret scope and Tool Gateway

**Secret scope:**  
- `resolveSecret(ref, caller)` checks `ref.scope` against `caller.orgId` / `caller.scopes`.  
- Scope format: `"org_id"` or `"role:roleName"`.  
- Violation throws `SecretScopeViolationError` and increments `secret_scope_violations_total`.  
- Stub implementation returns `"[REDACTED]"` when allowed; production should integrate a secrets manager.

**Tool Gateway:**  
- Allowlist and sandbox are sourced from **PolicyDecision** via **PipelinePlan**: router sets `tools_enabled` = `policy.allow_tools` minus `policy.deny_tools`; optional `plan.sandbox` (e.g. timeout_ms) when tools are enabled. Query-handler builds **AllowlistToolGateway** when plan has non-empty `tools_enabled` (delegate: StubAllowedToolGateway for stub path).
- `getDefaultToolGateway()` returns a deny-only implementation when no tools are enabled.
- Every `invoke(request)` through the default gateway returns `{ allowed: false, reason: "TOOL_GATEWAY_DENY_STUB", message, tool_id }`. When AllowlistToolGateway is used, tool not in allowlist returns `TOOL_NOT_IN_ALLOWLIST`; allowed calls are delegated to the configured delegate.
- No real tool execution in production until controlled enablement; stub path allows configured tools for testing.

---

## 4) Config and feature flags

- **security_hard_controls_enabled**  
  Default: `true`. Env: `SECURITY_HARD_CONTROLS_ENABLED=false` to disable.  
  When true: security audit events are written, security deny metrics incremented, and audit write latency recorded.

---

## 5) CI and verification

| Check                         | Command / location                          |
|-------------------------------|----------------------------------------------|
| Unit (audit, secret scope, tool gateway) | `npm test` (security/*.test.ts, gateways/tool-gateway.test.ts) |
| Abuse/misuse                  | `npm test` (security/abuse.test.ts)          |
| Integration (audit on query) | `npm test` (query.integration.test.ts)       |
| Typecheck                     | `npm run typecheck`                          |
| Lint                          | `npm run lint`                               |

---

## 6) Known risks and deferred work

- **Audit persistence:** In-memory log only; production should use append-only/tamper-evident sink (e.g. backend-native immutability or external SIEM).
- **Secrets manager:** Stub returns redacted placeholder; real resolution and rotation to be integrated per environment.
- **Controlled tool execution:** Enabling real tool execution is out of scope; prerequisites and policy hooks are in place for future cycles.
