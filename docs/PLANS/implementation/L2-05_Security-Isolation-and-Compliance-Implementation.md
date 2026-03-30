# L2-05 Security Isolation and Compliance Implementation

## 0) Document Control
- Plan ID: L2-05
- Plan Name: Security Isolation and Compliance Implementation
- Linked SPEC: `docs/SPEC/16_ToolGateway_Spec.md`, `docs/SPEC/19_Security_and_Isolation_Spec.md`, `docs/SPEC/21_Test_and_Eval_Plan.md`, `docs/SPEC/22_Runbooks_and_Operations.md`
- Owner(s): Security Lead
- Contributors: Platform Lead, Runtime Lead, SRE Lead, QA Lead
- Status: `implemented`
- Priority: `P0`
- Created: 2026-02-18
- Last Updated: 2026-02-26
- Review Cadence: Daily risk triage + formal security review each week

**Implementation note (M3):** Tool Gateway now has AllowlistToolGateway and StubAllowedToolGateway in addition to DenyOnlyToolGateway (see SPEC 16). Tool Engine enforces allowlist; default remains deny-only in production.

**Implementation note (L2-05 Segment G, 2026-02-26):** Tool Gateway allowlist is sourced from **PolicyDecision**: router sets **PipelinePlan.tools_enabled** = `policy.allow_tools` minus `policy.deny_tools`; optional **PipelinePlan.sandbox** (e.g. timeout_ms from budget) is set when tools are enabled. Query-handler builds AllowlistToolGateway when plan has tools_enabled. **Redaction:** All telemetry events and security audit payloads use **policy.redaction_level** (none/minimal/full); audit log payloads are redacted before write so no raw secrets appear in logs. **Audit trail:** TOOL_ACCESS audit events are written when policy.audit_level !== "none" and security_hard_controls_enabled, with tool_id, allowed, status, duration_ms (payload redacted). See SOW §4.1 Segment G and SPEC 19.

## 1) Purpose and Outcome
### 1.1 Purpose
Harden isolation, auditing, and compliance controls so advanced capability work can proceed without violating governance or safety requirements.

### 1.2 Intended Outcomes
- Outcome 1: Security-relevant actions produce immutable audit artifacts.
- Outcome 2: Secrets and sensitive data handling is scope-bound and redacted.
- Outcome 3: Tool Gateway remains deny/stub-only and policy-enforced.

### 1.3 Non-Goals
- Non-goal 1: Enabling unrestricted tool execution.
- Non-goal 2: Performance optimization unrelated to security controls.

## 2) Scope
### 2.1 In Scope
- Immutable audit event pipeline with integrity checks.
- Scoped secret access policy and runtime enforcement.
- Security profile enforcement (redaction, access boundaries, deny-by-default).
- Tool Gateway guardrails (deny/stub mode only in this cycle).
- Abuse/misuse/security integration tests.

### 2.2 Out of Scope
- External compliance certification workflows.
- Full sandbox execution for tool actions.

### 2.3 Interfaces Touched
- API endpoints: `POST /v1/query` security gating behaviors.
- Internal modules: Security middleware, Tool Gateway guardrails, audit logger.
- Data stores: Audit log store, secret reference metadata, policy config.
- External systems/tools: Secrets manager, SIEM integration (if available).

## 3) Dependencies
### 3.1 Upstream Dependencies
- `docs/PLANS/implementation/L2-03_Policy-Budgeting-and-Routing-Implementation.md` complete.
- `docs/PLANS/implementation/L2-04_Observability-and-Evaluation-Implementation.md` baseline complete.

### 3.2 Downstream Consumers
- `docs/PLANS/implementation/L2-06_Memory-and-Retrieval-Implementation.md`
- `docs/PLANS/implementation/L2-07_Multimodal-Input-Path-Implementation.md`
- `docs/PLANS/implementation/L2-08_Rollout-and-Operational-Readiness-Implementation.md`

### 3.3 External Dependencies
- Security policy approval and owner assignment.
- Access to secrets management integration in target environments.

## 4) Assumptions and Constraints
### 4.1 Assumptions
- Assumption 1: Existing policy decisions can drive security profile enforcement.
- Assumption 2: Audit sink supports append-only or tamper-evident storage mode.

### 4.2 Constraints
- Security constraints: Least privilege by default; deny unless explicitly allowed.
- Performance constraints: Security controls add <= 100ms p95 overhead (see 8.2).
- Cost constraints: Audit storage growth stays within retention budget (see 8.2).
- Compliance constraints: Required logs must be retained and queryable per policy.

### 4.3 Open Decisions
- Decision item: Tamper-evidence method (hash chain vs backend-native immutability).
- Decision owner: Security Lead.
- Decision deadline: Before final security gate review.

---

## 5) Phase Plan

### Phase 0 - Threat and Control Baseline
**Phase Objective**
- Align concrete controls against known threats and governance requirements.

**Linked SPEC Clauses**
- Clause(s): `19 Security and Isolation Spec`.

**Blocking Dependencies**
- Dependency: Governance events and decision traces available.

**Deliverables**
- Deliverable 1: Updated threat model and control matrix.
- Deliverable 2: Security acceptance criteria per control area.

**Workstreams**
- Security/safety: Threat model update and control mapping.
- Reliability/failure handling: Define secure failure defaults.
- Observability expansion: Security event requirements.
- Documentation: Compliance evidence checklist.

**Task List**
- [x] Task P0-01: Update threat model with current architecture state.
- [x] Task P0-02: Map controls to modules and owners.
- [x] Task P0-03: Publish security acceptance matrix.

**Entry Criteria**
- Criteria: L2-03 and L2-04 accepted.

**Exit Criteria**
- Criteria: Security control set approved by security and platform owners.

**Risks**
- Risk: Control gaps discovered late in implementation.
- Mitigation: Front-load threat review and explicit owner sign-off.

**Rollback/Fallback**
- Rollback condition: Control baseline lacks coverage for major threat classes.
- Rollback action: Pause execution work and close control gaps first.

---

### Phase 1 - Audit and Secret Scope Enforcement
**Phase Objective**
- Implement tamper-evident audit logging and least-privilege secret access.

**Linked SPEC Clauses**
- Clause(s): `19 Security and Isolation Spec`, `22 Runbooks and Operations`.

**Blocking Dependencies**
- Dependency: Phase 0 control matrix approved.

**Deliverables**
- Deliverable 1: Immutable or tamper-evident audit logger.
- Deliverable 2: Scoped secret resolution and runtime policy checks.

**Workstreams**
- Security/safety: Secret policy and access controls.
- Reliability/failure handling: Fail-safe behavior for missing or invalid secret scopes.
- Observability expansion: Security event logging.
- Documentation: Audit field definitions and retention policy.

**Task List**
- [x] Task P1-01: Implement append-only audit event writer with integrity markers.
- [x] Task P1-02: Enforce scoped secret access by caller role/org/environment.
- [x] Task P1-03: Add tests for secret scope violations and audit integrity.

**Entry Criteria**
- Criteria: Threat model and controls finalized.

**Exit Criteria**
- Criteria: Security-critical actions are audited and scope checks enforce least privilege.

**Risks**
- Risk: Audit throughput bottlenecks during traffic spikes.
- Mitigation: Buffered writes with guaranteed persistence semantics.

**Rollback/Fallback**
- Rollback condition: Audit layer causes severe runtime degradation.
- Rollback action: Use asynchronous audit pipeline with strict loss detection and backpressure.

---

### Phase 2 - Tool Gateway Hard Controls
**Phase Objective**
- Ensure tool surfaces remain locked down while preserving future integration points.

**Linked SPEC Clauses**
- Clause(s): `16 ToolGateway Spec`.

**Blocking Dependencies**
- Dependency: Audit and secret controls active.

**Deliverables**
- Deliverable 1: Tool Gateway deny/stub-only enforcement with policy hooks.
- Deliverable 2: Structured tool-deny events and error taxonomy mapping.

**Workstreams**
- Security/safety: Deny-by-default tool policy.
- Reliability/failure handling: Deterministic deny behavior for all tool invocations.
- Observability expansion: Tool deny event stream.
- Documentation: Future enablement prerequisites and controls.

**Task List**
- [x] Task P2-01: Enforce deny/stub behavior for all tool categories.
- [x] Task P2-02: Add runtime checks that block unsanctioned tool invocation.
- [x] Task P2-03: Add integration tests for tool misuse and bypass attempts.

**Entry Criteria**
- Criteria: Phase 1 controls passing tests.

**Exit Criteria**
- Criteria: No tool call can execute outside approved stub path.

**Risks**
- Risk: Hidden direct tool invocation path bypasses gateway.
- Mitigation: Static code checks and runtime interceptors on tool interfaces.

**Rollback/Fallback**
- Rollback condition: Unsanctioned tool execution path detected.
- Rollback action: Immediate hard disable of tool interfaces and incident escalation.

---

### Phase 3 - Abuse and Compliance Validation
**Phase Objective**
- Validate controls against realistic abuse scenarios and compliance evidence needs.

**Linked SPEC Clauses**
- Clause(s): `19 Security and Isolation Spec`, `21 Test and Eval Plan`.

**Blocking Dependencies**
- Dependency: Tool gateway controls integrated.

**Deliverables**
- Deliverable 1: Abuse/misuse test suite and results.
- Deliverable 2: Compliance artifact package for audit review.

**Workstreams**
- Security/safety: Abuse simulation and controls verification.
- Reliability/failure handling: Secure degradation paths.
- Observability expansion: Security alert tuning.
- Documentation: Compliance evidence index and traceability map.

**Task List**
- [x] Task P3-01: Build abuse tests (prompt injection, scope escalation, payload abuse).
- [x] Task P3-02: Validate control behavior under fault scenarios.
- [x] Task P3-03: Generate compliance evidence bundle.

**Entry Criteria**
- Criteria: Core controls and tool lock-down stable.

**Exit Criteria**
- Criteria: Critical abuse scenarios mitigated with passing tests.

**Risks**
- Risk: False negatives in abuse simulation coverage.
- Mitigation: Include adversarial review and expand edge-case corpus.

**Rollback/Fallback**
- Rollback condition: Critical abuse vector remains unmitigated.
- Rollback action: Block downstream feature plans until remediation is complete.

---

### Phase 4 - Security Gate and Handoff
**Phase Objective**
- Provide formal security sign-off and downstream control requirements.

**Linked SPEC Clauses**
- Clause(s): `22 Runbooks and Operations`.

**Blocking Dependencies**
- Dependency: Abuse and compliance validation complete.

**Deliverables**
- Deliverable 1: Security gate report with open risks and accepted exceptions.
- Deliverable 2: Security handoff for retrieval, multimodal, and rollout plans.

**Workstreams**
- Security/safety: Final risk disposition.
- Reliability/failure handling: Incident runbook finalization.
- Observability expansion: Security alert ownership transfer.
- Documentation: Handoff package and approval record.

**Task List**
- [x] Task P4-01: Conduct formal security gate review.
- [x] Task P4-02: Document accepted exceptions with expiration dates.
- [x] Task P4-03: Handoff controls checklist to downstream plan owners.

**Entry Criteria**
- Criteria: Abuse suite and compliance artifacts complete.

**Exit Criteria**
- Criteria: Security sign-off obtained for downstream work.

**Risks**
- Risk: Exception debt accumulates without closure.
- Mitigation: Time-boxed exception SLAs and owner accountability.

**Rollback/Fallback**
- Rollback condition: Sign-off blocked by unresolved critical findings.
- Rollback action: Open remediation sprint and hold downstream start.

---

## 6) Detailed Backlog (Task Table)
| Task ID | Description | Owner Role | Estimate | Priority | Dependencies | Definition of Done | Verification Method |
|---|---|---|---|---|---|---|---|
| SEC-001 | Update threat model and control matrix | Security Lead | 1d | P0 | L2-03,L2-04 | Threat model approved with mapped controls | Security review |
| SEC-002 | Implement tamper-evident audit logger | Platform Lead | 1.5d | P0 | SEC-001 | Audit events immutable/tamper-evident | Integrity tests |
| SEC-003 | Implement scoped secret resolution policy | Security Lead | 1d | P0 | SEC-001 | Secret access constrained by role/org/env | Scope tests |
| SEC-004 | Enforce deny/stub-only tool gateway mode | Runtime Lead | 1d | P0 | SEC-002,SEC-003 | No real tool execution possible | Integration tests |
| SEC-005 | Add abuse/misuse test suite | QA Lead | 1.5d | P0 | SEC-004 | Critical abuse cases covered and passing | Security test report |
| SEC-006 | Generate compliance evidence package | Security Lead | 0.75d | P1 | SEC-002,SEC-005 | Required artifacts complete and linked | Audit checklist |
| SEC-007 | Tune security alerts and incident hooks | SRE Lead | 0.75d | P1 | SEC-005 | Alerts actionable and routed | Alert drill |
| SEC-008 | Final gate review and downstream handoff | Security Lead | 0.5d | P1 | SEC-006,SEC-007 | Sign-off recorded and handoff accepted | Gate review minutes |

## 7) Validation and Test Strategy
### 7.1 Unit
- Required unit coverage: Secret scope evaluator, audit integrity component, tool deny checks.

### 7.2 Integration
- Required integration scenarios: Scoped secret access success/failure, tool deny behavior, audit writes on key events.

### 7.3 End-to-End
- Required e2e scenarios: Full request path generates required security artifacts and enforces controls.

### 7.4 Negative and Failure Path Testing
- Required failure scenarios: Secret manager outage, tampered audit payload, policy bypass attempts.

### 7.5 CI Quality Gates
- Required checks: Security test suite, redaction checks, static analysis, dependency scan, abuse scenarios.

## 8) Observability and Metrics
### 8.1 Required Instrumentation
- Logs: Security decisions, deny reasons, and audit write outcomes.
- Metrics: Security deny rates, secret scope violations, audit write latency.
- Traces: Security span annotations in request traces.
- Events: Security policy decision, tool deny, audit write events.

### 8.2 SLO/SLA Targets
- Latency targets: Security controls add <= 100ms p95 overhead.
- Error rate targets: Security control processing failure rate <= 0.2%.
- Cost targets: Audit storage growth within retention budget.

### 8.3 Alerting and Dashboards
This project is a UI-less API server; dashboard panels are out of scope and deferred to ops/external tooling (e.g. Grafana).
- Alerts required: Scope violation spikes, audit integrity failure, unexpected tool invocation attempts.
- Dashboard panels required (if ops provisions): Security events by severity, deny trend, exception count, audit health.

## 9) Security and Policy Checks
### 9.1 Threats Introduced by This Scope
- Threat: Misconfigured controls create false sense of security while leaving bypass paths.

### 9.2 Required Controls
- Control: Defense-in-depth with runtime checks plus immutable audit artifacts.

### 9.3 Security Validation
- Static analysis: Security lint rules and dependency CVE checks.
- Runtime checks: Secret access and tool invocation enforcement.
- Abuse/misuse tests: Injection, escalation, malformed payload abuse.

### 9.4 Audit Artifacts
- Required artifacts: Security gate report, abuse test results, exception register, audit integrity logs.

## 10) Rollout Strategy
### 10.1 Feature Flags
- Flag name: `security.hard_controls_enabled`
- Default state: true in dev/staging; controlled production rollout.
- Rollout criteria: Security suite and gate review pass.

### 10.2 Environment Progression
- Dev -> Staging -> Production path: Incremental control activation with validation at each stage.

### 10.3 Canary/Cohort Plan
- Cohort definition: Internal traffic with high-observability mode enabled.
- Success criteria: No critical security alerts and acceptable overhead for 72 hours.

### 10.4 Kill Switch and Rollback
- Trigger conditions: Control regressions causing severe availability impact or bypass.
- Rollback steps: Revert control profile to last approved baseline and isolate affected change.

## 11) Operational Readiness
### 11.1 Runbook Changes
- Runbook updates required: Security incident handling, audit integrity breach response, secret scope failures.

### 11.2 On-Call Readiness
- Alert owner: Security on-call with runtime backup.
- Escalation path: Security -> Platform -> Incident commander.

### 11.3 Support Handoff
- Documentation handoff: Security controls matrix and evidence index.
- Training handoff: Security incident simulation session for on-call teams.

## 12) Acceptance Criteria (Final Gate)
### 12.1 Functional Acceptance
- Criterion: Security controls enforce scope and deny behavior as designed.

### 12.2 Non-Functional Acceptance
- Criterion: Security overhead and reliability remain within agreed thresholds.

### 12.3 Security/Compliance Acceptance
- Criterion: No unresolved critical findings; required audit evidence complete.

### 12.4 Documentation Acceptance
- Criterion: Security runbooks, control matrix, and exception policies are current and approved.

## 13) Post-Implementation Review
### 13.1 Review Date
- Date: 2 weeks after L2-06 starts.

### 13.2 Success Metrics Review
- Metrics reviewed: Security incident count, scope violation trends, audit integrity failures, exception closure rate.
- Outcome: To be recorded after review.

### 13.3 Deferred Work
- Follow-up task: Controlled tool execution enablement prerequisites for future cycles.
- Target phase: Post-L2-99 planning cycle.

## 14) Sprint handoff archive (L2-05 → L2-06 / L2-07 / L2-08)

*Merged from the former `L2-05_Handoff.md`.*

**Plan:** L2-05 Security Isolation and Compliance Implementation  
**Status:** Implementation complete  
**Handoff to:** L2-06 Memory and Retrieval, L2-07 Multimodal Input Path, L2-08 Rollout and Operational Readiness  

### 1) Downstream start checklist

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

### 2) Security audit events and integrity

When `security_hard_controls_enabled` is true, the following audit event types are written to the tamper-evident log:

| Audit event type           | When emitted                    | Key payload fields (redacted)        |
|----------------------------|----------------------------------|--------------------------------------|
| SECURITY_POLICY_DECISION  | After policy evaluation          | `allowed`, `deny_reason`, `memory_scope` |
| SECURITY_ROUTE_DENY       | When request is blocked (route)   | `deny_reason`, `stage`               |
| SECURITY_ERROR            | On query path error              | `code`, `stage`, `message_redacted`  |
| TOOL_ACCESS               | After tool invoke (coding agent) when audit_level !== "none" | `tool_id`, `allowed`, `status`, `duration_ms` (redacted per policy) |

Each audit entry has: `sequence_id`, `previous_event_hash`, `event_hash` (SHA-256 over payload + chain). Use `verifyAuditIntegrity()` to detect tampering. Snapshot via `getAuditLogSnapshot()` (read-only). **All audit payloads are redacted** per **policy.redaction_level** before write (no raw secrets in audit log). Telemetry events also use policy.redaction_level.

### 3) Secret scope and Tool Gateway

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

### 4) Config and feature flags

- **security_hard_controls_enabled**  
  Default: `true`. Env: `SECURITY_HARD_CONTROLS_ENABLED=false` to disable.  
  When true: security audit events are written, security deny metrics incremented, and audit write latency recorded.

### 5) CI and verification

| Check                         | Command / location                          |
|-------------------------------|----------------------------------------------|
| Unit (audit, secret scope, tool gateway) | `npm test` (security/*.test.ts, gateways/tool-gateway.test.ts) |
| Abuse/misuse                  | `npm test` (security/abuse.test.ts)          |
| Integration (audit on query) | `npm test` (query.integration.test.ts)       |
| Typecheck                     | `npm run typecheck`                          |
| Lint                          | `npm run lint`                               |

### 6) Known risks and deferred work

- **Audit persistence:** In-memory log only; production should use append-only/tamper-evident sink (e.g. backend-native immutability or external SIEM).
- **Secrets manager:** Stub returns redacted placeholder; real resolution and rotation to be integrated per environment.
- **Controlled tool execution:** Enabling real tool execution is out of scope; prerequisites and policy hooks are in place for future cycles.
