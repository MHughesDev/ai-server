# Plan 01 - Platform Foundation and Contracts

## 0) Document Control
- Plan ID: PLAN-01
- Plan Name: Platform Foundation and Contracts
- Linked SPEC: `Docs/Overview.md` sections `00-03`, `20`; `Docs/Architecture.md` sections `5-7`
- Owner(s): Platform Lead
- Contributors: API Lead, Runtime Lead, QA Lead
- Status: `draft`
- Priority: `P0`
- Created: 2026-02-18
- Last Updated: 2026-02-18
- Review Cadence: Twice weekly

## 1) Purpose and Outcome
### 1.1 Purpose
Establish stable interfaces and conventions so all downstream plans can implement confidently without contract churn.

### 1.2 Intended Outcomes
- Outcome 1: External and internal contracts versioned and tested.
- Outcome 2: Dependency boundaries documented and enforced.
- Outcome 3: Configuration and feature-flag governance operational.

### 1.3 Non-Goals
- Non-goal 1: Building policy/routing logic itself.
- Non-goal 2: Implementing coding agent harness behavior.

## 2) Scope
### 2.1 In Scope
- Capability/process/interface in scope: Contract definitions, schema validation, versioning rules, component dependency rules.

### 2.2 Out of Scope
- Explicitly excluded work: Full pipeline implementations beyond scaffolding.

### 2.3 Interfaces Touched
- API endpoints: `/v1/query` contract shape and error envelope.
- Internal modules: Canonicalization outputs and routing decision shapes.
- Data stores: Config source and feature flag definitions.
- External systems/tools: Schema tooling and CI checks.

## 3) Dependencies
### 3.1 Upstream Dependencies
- Blocking plans/specs/services: Architecture baseline approved from master spec.

### 3.2 Downstream Consumers
- Plans/features blocked by this plan: Plans 02-08 and Plan 99.

### 3.3 External Dependencies
- Vendor/platform/team approvals: API governance and security review for headers/auth semantics.

## 4) Assumptions and Constraints
### 4.1 Assumptions
- Assumption 1: Contract-first development is accepted by all teams.
- Assumption 2: CI can enforce schema and dependency checks.

### 4.2 Constraints
- Security constraints: Backward-compatible security header policy.
- Performance constraints: Validation overhead must remain low.
- Cost constraints: Minimal tooling overhead in CI.
- Compliance constraints: Contract changes tracked and reviewable.

### 4.3 Open Decisions
- Decision item: Contract versioning approach (path vs header strategy).
- Decision owner: API Lead.
- Decision deadline: Before Phase 1 exit.

---

## 5) Phase Plan

### Phase 0 - Foundations
**Phase Objective**
- Lock contract skeletons and naming conventions.

**Linked SPEC Clauses**
- Clause(s): `02 API Contracts`, `03 Component Map`, `20 Config and Feature Flags`.

**Blocking Dependencies**
- Dependency: Approval of canonical types list.

**Deliverables**
- Deliverable 1: `RequestEnvelope`/`ResponseEnvelope` schema docs.
- Deliverable 2: Internal type contracts (`CanonicalRequest`, `IntentBundle`, `PolicyDecision`, `PipelinePlan`).

**Workstreams**
- Architecture/contracts: Type definitions and invariants.
- Implementation scaffolding: Validation library and schema test harness.
- Validation setup: Contract snapshot tests.
- Documentation: Interface ownership matrix.

**Task List**
- [ ] Task P0-01: Define and review external schemas.
- [ ] Task P0-02: Define internal canonical types and mapping rules.
- [ ] Task P0-03: Add schema diff checks to CI.

**Entry Criteria**
- Criteria: Master spec sections linked and accepted as source of truth.

**Exit Criteria**
- Criteria: Contracts approved with tests and version policy documented.

**Risks**
- Risk: Early implementation shortcuts bypass contracts.
- Mitigation: CI enforcement and review checklist.

**Rollback/Fallback**
- Rollback condition: Contract model blocks urgent delivery.
- Rollback action: Temporary compatibility adapter with strict deprecation date.

---

### Phase 1 - MVP Path
**Phase Objective**
- Integrate contract validation into MVP runtime path.

**Linked SPEC Clauses**
- Clause(s): `04 Ingress Spec`, `05 Brain Stem Spec`.

**Blocking Dependencies**
- Dependency: Phase 0 contract approval.

**Deliverables**
- Deliverable 1: Request validation middleware.
- Deliverable 2: Canonicalization interface adapter.

**Workstreams**
- Core implementation: Validation and coercion behavior.
- Integration: Ingress-to-brain stem mapping path.
- Basic observability: Validation and schema error metrics.
- Basic docs: Error code catalog.

**Task List**
- [ ] Task P1-01: Implement strict/lenient validation modes.
- [ ] Task P1-02: Emit structured schema errors.
- [ ] Task P1-03: Verify backward-compatible response envelope behavior.

**Entry Criteria**
- Criteria: Contract tests green.

**Exit Criteria**
- Criteria: MVP accepts/returns only compliant envelopes.

**Risks**
- Risk: Client breakage due to stricter validation.
- Mitigation: Compatibility mode and migration notes.

**Rollback/Fallback**
- Rollback condition: Production clients fail at elevated rate.
- Rollback action: Toggle compatibility flag and re-enable strict mode per cohort.

---

### Phase 2 - Hardening
**Phase Objective**
- Prevent contract drift and strengthen compatibility management.

**Linked SPEC Clauses**
- Clause(s): `01 Principles and Invariants`, `02 API Contracts`.

**Blocking Dependencies**
- Dependency: MVP runtime validation active.

**Deliverables**
- Deliverable 1: Contract compatibility matrix.
- Deliverable 2: Deprecation and migration policy.

**Workstreams**
- Reliability/failure handling: Typed error model coverage.
- Security/safety: Header and auth contract checks.
- Observability expansion: Contract mismatch telemetry.
- Test expansion: Version skew tests.

**Task List**
- [ ] Task P2-01: Add contract compatibility test suite.
- [ ] Task P2-02: Define deprecation window policy.
- [ ] Task P2-03: Add schema drift dashboard panel.

**Entry Criteria**
- Criteria: Contract use in production path verified.

**Exit Criteria**
- Criteria: Drift alerts and compatibility controls active.

**Risks**
- Risk: Multiple versions increase complexity.
- Mitigation: Limit simultaneous supported versions.

**Rollback/Fallback**
- Rollback condition: New version causes instability.
- Rollback action: Revert version default and keep dual support window.

---

### Phase 3 - Scale and Performance
**Phase Objective**
- Keep contract enforcement efficient at high throughput.

**Linked SPEC Clauses**
- Clause(s): `09 Resource Manager Spec`, `13 Router and Dispatch Spec`.

**Blocking Dependencies**
- Dependency: Hardening instrumentation in place.

**Deliverables**
- Deliverable 1: Validation performance profile.
- Deliverable 2: Optimized parsing/serialization path.

**Workstreams**
- Performance profiling: Validation CPU/memory impact.
- Capacity/scaling: Throughput impact benchmarks.
- Cost optimization: Reduce schema validation overhead.
- High-volume validation: Sustained load tests.

**Task List**
- [ ] Task P3-01: Benchmark validation at target QPS.
- [ ] Task P3-02: Optimize hot path serialization.
- [ ] Task P3-03: Set contract validation SLO budget.

**Entry Criteria**
- Criteria: Hardening complete.

**Exit Criteria**
- Criteria: Validation overhead remains within approved latency budget.

**Risks**
- Risk: Optimization weakens correctness.
- Mitigation: Keep golden contract tests mandatory.

**Rollback/Fallback**
- Rollback condition: Optimized path produces invalid outputs.
- Rollback action: Switch to safe path behind flag.

---

### Phase 4 - Operations and Continuous Improvement
**Phase Objective**
- Make contract governance routine and auditable.

**Linked SPEC Clauses**
- Clause(s): `21 Test and Eval Plan`, `22 Runbooks and Operations`.

**Blocking Dependencies**
- Dependency: Monitoring and alerting dashboards live.

**Deliverables**
- Deliverable 1: Contract change runbook.
- Deliverable 2: Quarterly contract review cadence.

**Workstreams**
- Operations readiness: Change approval workflow.
- Evaluation feedback loops: Drift and client usage review.
- Incident readiness: Contract rollback procedure.
- Knowledge transfer: Consumer integration guidance.

**Task List**
- [ ] Task P4-01: Publish contract change and rollback runbook.
- [ ] Task P4-02: Schedule recurring compatibility reviews.
- [ ] Task P4-03: Train support/on-call on schema incidents.

**Entry Criteria**
- Criteria: Contract metrics and alerts stable for one release cycle.

**Exit Criteria**
- Criteria: Contract governance process adopted by all owners.

**Risks**
- Risk: Governance fatigue.
- Mitigation: Lightweight review templates and automation.

**Rollback/Fallback**
- Rollback condition: Process overhead blocks delivery.
- Rollback action: Reduce review steps while keeping safety checks automated.

---

## 6) Detailed Backlog (Task Table)
| Task ID | Description | Owner Role | Estimate | Priority | Dependencies | Definition of Done | Verification Method |
|---|---|---|---|---|---|---|---|
| P01-001 | Define external API schemas | API Lead | 2d | P0 | None | Schemas approved | Design review |
| P01-002 | Define internal canonical types | Platform Lead | 2d | P0 | P01-001 | Type docs approved | Architecture review |
| P01-003 | Add schema checks to CI | QA Lead | 1d | P0 | P01-001 | CI fails on schema drift | CI run |
| P01-004 | Publish versioning and deprecation policy | API Lead | 1d | P1 | P01-002 | Policy doc merged | Team sign-off |

## 7) Validation and Test Strategy
### 7.1 Unit
- Required unit coverage: Envelope validation, canonical mapping helpers, error code mapping.

### 7.2 Integration
- Required integration scenarios: Ingress validation to brain stem handoff.

### 7.3 End-to-End
- Required e2e scenarios: Valid request pass, invalid request reject, compatibility mode behavior.

### 7.4 Negative and Failure Path Testing
- Required failure scenarios: Missing headers, malformed payload, unsupported version.

### 7.5 CI Quality Gates
- Required checks: Schema snapshots, compatibility matrix checks, lint and type checks.

## 8) Observability and Metrics
### 8.1 Required Instrumentation
- Logs: Validation failures and version info.
- Metrics: Validation error rate by code, version usage distribution.
- Traces: Validation span and canonicalization span.
- Events: Contract version change deployment event.

### 8.2 SLO/SLA Targets
- Latency targets: Validation adds <= 50ms P95.
- Error rate targets: Schema false-positive reject rate < 0.1%.
- Cost targets: Negligible incremental compute cost.

### 8.3 Alerting and Dashboards
- Alerts required: Sudden schema reject spikes, version skew anomalies.
- Dashboard panels required: Top validation errors, request version breakdown.

## 9) Security and Policy Checks
### 9.1 Threats Introduced by This Scope
- Threat: Accepting malformed inputs that bypass downstream checks.

### 9.2 Required Controls
- Control: Strict schema validation and header normalization.

### 9.3 Security Validation
- Static analysis: Schema and parser dependency scanning.
- Runtime checks: Header validation and auth field presence.
- Abuse/misuse tests: Oversized payloads and crafted malformed bodies.

### 9.4 Audit Artifacts
- Required artifacts: Contract approval notes and version rollout records.

## 10) Rollout Strategy
### 10.1 Feature Flags
- Flag name: `contracts.strict_validation_enabled`
- Default state: false
- Rollout criteria: Compatibility mode error rate stable below threshold.

### 10.2 Environment Progression
- Dev -> Staging -> Production path: Staging soak for 48h before prod.

### 10.3 Canary/Cohort Plan
- Cohort definition: Internal clients then selected low-risk clients.
- Success criteria: No material increase in reject/error rates.

### 10.4 Kill Switch and Rollback
- Trigger conditions: Validation rejects exceed threshold.
- Rollback steps: Disable strict mode, keep telemetry on, investigate and patch.

## 11) Operational Readiness
### 11.1 Runbook Changes
- Runbook updates required: Validation reject triage and version rollback.

### 11.2 On-Call Readiness
- Alert owner: API on-call.
- Escalation path: API -> Platform -> Security.

### 11.3 Support Handoff
- Documentation handoff: Client integration and migration guide.
- Training handoff: Support session on common validation failures.

## 12) Acceptance Criteria (Final Gate)
### 12.1 Functional Acceptance
- Criterion: Contracts enforced on all ingress paths.

### 12.2 Non-Functional Acceptance
- Criterion: Validation overhead within target budget.

### 12.3 Security/Compliance Acceptance
- Criterion: Input validation and header controls tested and approved.

### 12.4 Documentation Acceptance
- Criterion: Contract docs and migration policy published.

## 13) Post-Implementation Review
### 13.1 Review Date
- Date: First biweekly release review after rollout.

### 13.2 Success Metrics Review
- Metrics reviewed: Reject rate, compatibility incidents, contract drift alerts.
- Outcome: To be filled.

### 13.3 Deferred Work
- Follow-up task: Add schema fuzzing at larger scale.
- Target phase: Platform hardening follow-up.

---

## 14) Quick-Start Duplication Checklist
- Copy this template into `<PLAN_NAME>_PLAN.md`.
- Fill sections 0-4 first before tasking.
- Populate Phase 0-4 entry/exit criteria before assigning owners.
- Add task IDs and dependencies in section 6.
- Define objective acceptance criteria in section 12 before starting implementation.
