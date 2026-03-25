# Plan 04 - Observability and Evaluation System

## 0) Document Control
- Plan ID: PLAN-04
- Plan Name: Observability and Evaluation System
- Linked SPEC: `docs/ARCHITECTURE/Overview.md` sections `12`, `18`, `21`, `22`
- Owner(s): Observability Lead
- Contributors: Runtime, Control Plane, QA, Security, SRE
- Status: `complete`
- Priority: `P0`
- Created: 2026-02-18
- Last Updated: 2026-02-26
- Review Cadence: Weekly
- Implementation: L2-04 implementation plan complete; event schema, redaction, trace context, metrics (including Prometheus exposition at GET /metrics), WORKFLOW_START/END and ENGINE_* with cost/latency, span hierarchy acceptance tests, eval harness and runbook in place. See `docs/PLANS/implementation/L2-04_Observability-and-Evaluation-Implementation.md` section 14.

## 1) Purpose and Outcome
### 1.1 Purpose
Create the telemetry and evaluation backbone needed to detect regressions, explain behavior, and safely ship changes.

### 1.2 Intended Outcomes
- Outcome 1: Required logs/metrics/traces/events emitted across core paths.
- Outcome 2: Dashboards and alerts cover reliability, cost, and policy health.
- Outcome 3: Regression evaluation harness gates releases.

### 1.3 Non-Goals
- Non-goal 1: Building full experimentation platform for advanced model optimization.
- Non-goal 2: Replacing operational dashboards from other systems.

## 2) Scope
### 2.1 In Scope
- Capability/process/interface in scope: Telemetry schema, instrumentation library usage, dashboards, alerting, gold-set evaluation harness.

### 2.2 Out of Scope
- Explicitly excluded work: Product analytics beyond platform health and quality.

### 2.3 Interfaces Touched
- API endpoints: No direct changes; telemetry emitted from request lifecycle.
- Internal modules: Ingress, brain stem, policy, router, gateway, retrieval and multimodal flows.
- Data stores: Metrics backend, log store, trace store, eval dataset store.
- External systems/tools: OTEL collector, dashboard/alert platform, CI system.

## 3) Dependencies
### 3.1 Upstream Dependencies
- Blocking plans/specs/services: Plans 02 and 03 provide primary instrumentation points.

### 3.2 Downstream Consumers
- Plans/features blocked by this plan: Plan 08 production readiness and Plan 99 readiness gate.

### 3.3 External Dependencies
- Vendor/platform/team approvals: Telemetry backend provisioning and retention policy approvals.

## 4) Assumptions and Constraints
### 4.1 Assumptions
- Assumption 1: OTEL-compatible instrumentation is acceptable baseline.
- Assumption 2: Gold datasets can be curated from representative traffic.

### 4.2 Constraints
- Security constraints: Redaction before export; no sensitive payload leakage.
- Performance constraints: Instrumentation overhead limited.
- Cost constraints: Telemetry sampling and retention budgets enforced.
- Compliance constraints: Audit trail retention meets policy.

### 4.3 Open Decisions
- Decision item: Sampling rates by environment and traffic class.
- Decision owner: Observability Lead.
- Decision deadline: Before Phase 1 exit.

---

## 5) Phase Plan

### Phase 0 - Foundations
**Phase Objective**
- Define telemetry contract and evaluation framework structure.

**Linked SPEC Clauses**
- Clause(s): `18 Observability Spec`, `21 Test and Eval Plan`.

**Blocking Dependencies**
- Dependency: Core component event taxonomy from Plans 02-03.

**Deliverables**
- Deliverable 1: Standard telemetry field schema and naming.
- Deliverable 2: Evaluation harness design and seed datasets.

**Workstreams**
- Architecture/contracts: Event schema and trace conventions.
- Implementation scaffolding: Instrumentation helper package.
- Validation setup: Telemetry schema contract tests.
- Documentation: Dashboard and alert ownership map.

**Task List**
- [ ] Task P0-01: Define required events and trace spans.
- [ ] Task P0-02: Define redaction and field classification policy.
- [ ] Task P0-03: Create initial gold-set evaluation dataset.

**Entry Criteria**
- Criteria: Upstream runtime and control-plane event points identified.

**Exit Criteria**
- Criteria: Telemetry and evaluation contracts approved.

**Risks**
- Risk: Inconsistent event names reduce usefulness.
- Mitigation: Shared schema package and lint checks.

**Rollback/Fallback**
- Rollback condition: Schema complexity blocks adoption.
- Rollback action: Prioritize critical events and phase in optional fields.

---

### Phase 1 - MVP Path
**Phase Objective**
- Instrument critical path and stand up baseline dashboards/alerts.

**Linked SPEC Clauses**
- Clause(s): `18 Observability Spec`, `22 Runbooks and Operations`.

**Blocking Dependencies**
- Dependency: Telemetry storage and collector available.

**Deliverables**
- Deliverable 1: End-to-end traces for request lifecycle.
- Deliverable 2: Core dashboards and high-severity alerts.

**Workstreams**
- Core implementation: Add instrumentation to all key modules.
- Integration: OTEL pipeline and dashboard integration.
- Basic observability: Error, latency, and cost signals.
- Basic docs: Alert playbook and field definitions.

**Task List**
- [ ] Task P1-01: Instrument traces and correlation IDs end-to-end.
- [ ] Task P1-02: Publish baseline latency/error/cost dashboards.
- [ ] Task P1-03: Add critical alerts with escalation routing.

**Entry Criteria**
- Criteria: Phase 0 standards finalized.

**Exit Criteria**
- Criteria: Core observability available for staging and canary.

**Risks**
- Risk: Alert noise and false positives.
- Mitigation: Alert tuning period and severity tiers.

**Rollback/Fallback**
- Rollback condition: Telemetry volume causes cost/performance issues.
- Rollback action: Increase sampling and reduce non-critical logs.

---

### Phase 2 - Hardening
**Phase Objective**
- Expand evaluation coverage and increase signal quality.

**Linked SPEC Clauses**
- Clause(s): `12 Evaluation Engine Spec`, `21 Test and Eval Plan`.

**Blocking Dependencies**
- Dependency: Baseline instrumentation stable in staging.

**Deliverables**
- Deliverable 1: Regression eval suite for routing/policy behavior.
- Deliverable 2: Dashboard quality improvements and noisy-alert cleanup.

**Workstreams**
- Reliability/failure handling: Failure-path events and correlation.
- Security/safety: Redaction checks and telemetry access controls.
- Observability expansion: Per-caller and per-route slices.
- Test expansion: Eval regression automation in CI.

**Task List**
- [ ] Task P2-01: Add evaluation scenarios for policy/routing regressions.
- [ ] Task P2-02: Add telemetry redaction tests.
- [ ] Task P2-03: Refine alerts using baseline data.

**Entry Criteria**
- Criteria: MVP dashboards active and reviewed.

**Exit Criteria**
- Criteria: Regression checks block unsafe releases.

**Risks**
- Risk: Gold dataset drift.
- Mitigation: Scheduled dataset refresh and versioning.

**Rollback/Fallback**
- Rollback condition: Eval gate instability blocks all releases.
- Rollback action: Gate on critical subset while fixing flaky cases.

---

### Phase 3 - Scale and Performance
**Phase Objective**
- Keep observability and eval systems efficient under higher load.

**Linked SPEC Clauses**
- Clause(s): `18 Observability Spec`, `09 Resource Manager Spec`.

**Blocking Dependencies**
- Dependency: Hardening gates in CI established.

**Deliverables**
- Deliverable 1: Telemetry cost/performance optimization plan.
- Deliverable 2: Scalable eval execution strategy.

**Workstreams**
- Performance profiling: Instrumentation overhead measurements.
- Capacity/scaling: Collector throughput and storage capacity.
- Cost optimization: Sampling/retention optimization by signal class.
- High-volume validation: Load impact tests on telemetry path.

**Task List**
- [ ] Task P3-01: Measure and reduce instrumentation overhead.
- [ ] Task P3-02: Optimize retention and sampling policies.
- [ ] Task P3-03: Parallelize evaluation runs for release cadence.

**Entry Criteria**
- Criteria: Reliable baseline telemetry and eval gates.

**Exit Criteria**
- Criteria: Signal quality preserved within cost budget.

**Risks**
- Risk: Over-sampling blinds incident response.
- Mitigation: Protect always-on critical event set.

**Rollback/Fallback**
- Rollback condition: Visibility drops below operational need.
- Rollback action: Re-enable higher sampling for priority signals immediately.

---

### Phase 4 - Operations and Continuous Improvement
**Phase Objective**
- Establish durable telemetry and evaluation governance.

**Linked SPEC Clauses**
- Clause(s): `22 Runbooks and Operations`, `21 Test and Eval Plan`.

**Blocking Dependencies**
- Dependency: Production telemetry and alert ownership stable.

**Deliverables**
- Deliverable 1: Observability/eval runbook set.
- Deliverable 2: Regular quality and cost review process.

**Workstreams**
- Operations readiness: Ownership and escalation matrix.
- Evaluation feedback loops: Weekly regression review and action tracking.
- Incident readiness: Telemetry outage and false-alert playbooks.
- Knowledge transfer: Team training on dashboards and traces.

**Task List**
- [ ] Task P4-01: Publish observability runbooks and owner map.
- [ ] Task P4-02: Run telemetry outage drill.
- [ ] Task P4-03: Start monthly eval quality council.

**Entry Criteria**
- Criteria: Production canary operating with stable telemetry.

**Exit Criteria**
- Criteria: Team demonstrates repeatable incident and regression response.

**Risks**
- Risk: Ownership ambiguity for dashboards.
- Mitigation: Single owner per signal family.

**Rollback/Fallback**
- Rollback condition: Operational confusion during incidents.
- Rollback action: Consolidate dashboards and simplify escalation paths.

---

## 6) Detailed Backlog (Task Table)
| Task ID | Description | Owner Role | Estimate | Priority | Dependencies | Definition of Done | Verification Method |
|---|---|---|---|---|---|---|---|
| P04-001 | Define telemetry schema and conventions | Observability Lead | 2d | P0 | Plans 02-03 | Schema approved | Architecture review |
| P04-002 | Instrument critical path spans/events | Runtime + Control Plane | 4d | P0 | P04-001 | End-to-end traces visible | Trace validation |
| P04-003 | Build core dashboards and alerts | SRE | 3d | P0 | P04-002 | Dashboards active and actionable | On-call test |
| P04-004 | Add eval regression suite to CI | QA Lead | 3d | P1 | P04-001 | Gated regressions in CI | CI runs |

## 7) Validation and Test Strategy
### 7.1 Unit
- Required unit coverage: Telemetry field mapping, redaction helpers, eval scoring utilities.

### 7.2 Integration
- Required integration scenarios: Trace propagation across all core modules.

### 7.3 End-to-End
- Required e2e scenarios: End-to-end request with complete trace and expected events.

### 7.4 Negative and Failure Path Testing
- Required failure scenarios: Collector outage, malformed telemetry event, missing span context.

### 7.5 CI Quality Gates
- Required checks: Telemetry schema checks, eval regression suite, dashboard query validation.

## 8) Observability and Metrics
### 8.1 Required Instrumentation
- Logs: Structured lifecycle and policy reason logs (redacted).
- Metrics: Latency, error rates, cost, route mix, deny rates.
- Traces: Full request trace with component spans.
- Events: Route decision, policy decision, budget exceeded, fallback, rollback.

### 8.2 SLO/SLA Targets
- Latency targets: Instrumentation overhead <= 5% request time.
- Error rate targets: Telemetry pipeline delivery success >= 99.5%.
- Cost targets: Telemetry storage/ingest within approved monthly budget.

### 8.3 Alerting and Dashboards
- Alerts required: SLO burn, denial anomalies, missing telemetry coverage.
- Dashboard panels required: Request health, policy/routing health, cost trends, incident timeline.

## 9) Security and Policy Checks
### 9.1 Threats Introduced by This Scope
- Threat: Sensitive data leakage in telemetry payloads.

### 9.2 Required Controls
- Control: Mandatory redaction and field-level classification before emit.

### 9.3 Security Validation
- Static analysis: Telemetry schema scan and secret pattern scan.
- Runtime checks: Redaction verification on sampled events.
- Abuse/misuse tests: Intentional secret injection and leak detection tests.

### 9.4 Audit Artifacts
- Required artifacts: Redaction test reports, retention policy approvals, access audit logs.

## 10) Rollout Strategy
### 10.1 Feature Flags
- Flag name: `obs.telemetry_v1_enabled`
- Default state: false
- Rollout criteria: Staging verification of signal completeness and redaction.

### 10.2 Environment Progression
- Dev -> Staging -> Production path: Incremental module-by-module instrumentation rollout.

### 10.3 Canary/Cohort Plan
- Cohort definition: Internal traffic only before tenant-facing rollout.
- Success criteria: Signal completeness > 95%, no sensitive leakage findings.

### 10.4 Kill Switch and Rollback
- Trigger conditions: Telemetry-induced latency/cost spikes or leakage concerns.
- Rollback steps: Disable non-critical signal flags and revert to minimal safe telemetry.

## 11) Operational Readiness
### 11.1 Runbook Changes
- Runbook updates required: Missing signal triage, alert tuning, telemetry outage response.

### 11.2 On-Call Readiness
- Alert owner: SRE on-call.
- Escalation path: SRE -> Runtime/Control Plane -> Security.

### 11.3 Support Handoff
- Documentation handoff: Dashboard catalog and alert meanings.
- Training handoff: Trace-reading workshop for responders.

## 12) Acceptance Criteria (Final Gate)
### 12.1 Functional Acceptance
- Criterion: Required telemetry and eval checks are active and trusted.

### 12.2 Non-Functional Acceptance
- Criterion: Overhead and telemetry cost within budget.

### 12.3 Security/Compliance Acceptance
- Criterion: Redaction and retention controls verified.

### 12.4 Documentation Acceptance
- Criterion: Dashboard/runbook/eval docs complete and owner-assigned.

## 13) Post-Implementation Review
### 13.1 Review Date
- Date: 30 days after production rollout.

### 13.2 Success Metrics Review
- Metrics reviewed: Alert precision, incident MTTR, regression catch rate.
- Outcome: To be filled.

### 13.3 Deferred Work
- Follow-up task: Advanced eval scoring and strategy comparison expansion.
- Target phase: After baseline platform stabilization.

---

## 14) Quick-Start Duplication Checklist
- Copy this template into `<PLAN_NAME>_PLAN.md`.
- Fill sections 0-4 first before tasking.
- Populate Phase 0-4 entry/exit criteria before assigning owners.
- Add task IDs and dependencies in section 6.
- Define objective acceptance criteria in section 12 before starting implementation.
