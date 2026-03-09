# Plan 99 - Deferred Coding Agent Harness Readiness Gate

## 0) Document Control
- Plan ID: PLAN-99
- Plan Name: Deferred Coding Agent Harness Readiness Gate
- Linked SPEC: `docs/Overview.md` sections `13`, `16`, `19`, `21`, `22`; `docs/Architecture_document_Finalized.md` milestone 3 (deferred)
- Owner(s): Platform Lead
- Contributors: Runtime, Security, Ops, QA, Product
- Status: `draft`
- Priority: `P1`
- Created: 2026-02-18
- Last Updated: 2026-02-18
- Review Cadence: Monthly until activated

## 1) Purpose and Outcome
### 1.1 Purpose
Define objective readiness criteria and prerequisite controls so coding harness work starts only when platform foundations are proven.

### 1.2 Intended Outcomes
- Outcome 1: Clear Go/No-Go gate for harness kickoff.
- Outcome 2: No major foundational rework required once harness starts.
- Outcome 3: Security and operational risk of harness scope reduced before development.

### 1.3 Non-Goals
- Non-goal 1: Implementing planner/executor loops now.
- Non-goal 2: Enabling unrestricted tool execution.

## 2) Scope
### 2.1 In Scope
- Capability/process/interface in scope: Readiness criteria, prerequisite evidence, dependency closure, risk register for harness kickoff.

### 2.2 Out of Scope
- Explicitly excluded work: Any direct coding harness implementation.

### 2.3 Interfaces Touched
- API endpoints: None directly; readiness references current `/v1/query` behavior.
- Internal modules: Policy, router, observability, security controls, ops readiness.
- Data stores: Evidence registry, risk log, release metrics.
- External systems/tools: CI reports, security scans, incident records.

## 3) Dependencies
### 3.1 Upstream Dependencies
- Blocking plans/specs/services: Plans 00-08 must meet acceptance criteria.

### 3.2 Downstream Consumers
- Plans/features blocked by this plan: Future Coding Agent Harness implementation plan.

### 3.3 External Dependencies
- Vendor/platform/team approvals: Security and operations leadership sign-off.

## 4) Assumptions and Constraints
### 4.1 Assumptions
- Assumption 1: Harness scope remains deferred until readiness gate passes.
- Assumption 2: Foundational plans remain source of truth for controls and operations.

### 4.2 Constraints
- Security constraints: No harness start without proven isolation and audit controls.
- Performance constraints: Existing SLOs must remain stable pre-harness.
- Cost constraints: Baseline platform cost predictability required.
- Compliance constraints: Audit evidence must be complete before kickoff.

### 4.3 Open Decisions
- Decision item: Minimum confidence threshold for enabling harness in production timeline.
- Decision owner: Platform Lead + Security Lead + Product.
- Decision deadline: At Plan 08 Phase 4 exit.

---

## 5) Phase Plan

### Phase 0 - Foundations
**Phase Objective**
- Define readiness framework and evidence model.

**Linked SPEC Clauses**
- Clause(s): `01 Principles and Invariants`, `19 Security and Isolation Spec`, `22 Runbooks and Operations`.

**Blocking Dependencies**
- Dependency: Plan 00 governance structure active.

**Deliverables**
- Deliverable 1: Readiness checklist with measurable thresholds.
- Deliverable 2: Evidence collection template and owners.

**Workstreams**
- Architecture/contracts: Harness prerequisite interface stability criteria.
- Implementation scaffolding: Evidence aggregation process.
- Validation setup: Gate scoring model.
- Documentation: Go/No-Go decision workflow.

**Task List**
- [ ] Task P0-01: Define readiness categories and metrics.
- [ ] Task P0-02: Assign evidence owners per category.
- [ ] Task P0-03: Publish gate scoring rubric.

**Entry Criteria**
- Criteria: Master plan dependencies and owners confirmed.

**Exit Criteria**
- Criteria: Readiness framework approved by platform/security/ops.

**Risks**
- Risk: Subjective decisions override data.
- Mitigation: Quantitative gate thresholds and required approvers.

**Rollback/Fallback**
- Rollback condition: Criteria too strict or too loose.
- Rollback action: Recalibrate thresholds with historical performance data.

---

### Phase 1 - MVP Path
**Phase Objective**
- Begin collecting evidence as foundational plans complete.

**Linked SPEC Clauses**
- Clause(s): `18 Observability Spec`, `21 Test and Eval Plan`.

**Blocking Dependencies**
- Dependency: Plans 02-05 have measurable outputs.

**Deliverables**
- Deliverable 1: Initial readiness scorecard.
- Deliverable 2: Gap list for unmet prerequisites.

**Workstreams**
- Core implementation: Automated evidence pull from CI/monitoring.
- Integration: Link plan acceptance outputs to readiness board.
- Basic observability: Gate score trend dashboard.
- Basic docs: Gap remediation ownership.

**Task List**
- [ ] Task P1-01: Stand up readiness dashboard and scorecard.
- [ ] Task P1-02: Collect first evidence batch from completed plans.
- [ ] Task P1-03: Publish top readiness gaps and action owners.

**Entry Criteria**
- Criteria: Foundation framework active.

**Exit Criteria**
- Criteria: Scorecard operational and updated each release.

**Risks**
- Risk: Evidence quality inconsistent across teams.
- Mitigation: Standardized evidence schema and review.

**Rollback/Fallback**
- Rollback condition: Evidence ingestion fails repeatedly.
- Rollback action: Temporary manual evidence process with strict checklist.

---

### Phase 2 - Hardening
**Phase Objective**
- Close high-risk readiness gaps and validate prerequisites under stress.

**Linked SPEC Clauses**
- Clause(s): `19 Security and Isolation Spec`, `22 Runbooks and Operations`.

**Blocking Dependencies**
- Dependency: Plans 06-08 nearing completion.

**Deliverables**
- Deliverable 1: Closed P0/P1 readiness gaps.
- Deliverable 2: Verified rollback and incident handling for pre-harness platform.

**Workstreams**
- Reliability/failure handling: Readiness stress tests and drill outcomes.
- Security/safety: Isolation and audit prerequisite verification.
- Observability expansion: Decision confidence metrics.
- Test expansion: Pre-harness regression confidence suite.

**Task List**
- [ ] Task P2-01: Resolve all critical readiness gaps.
- [ ] Task P2-02: Re-run security and ops drills with updated controls.
- [ ] Task P2-03: Validate regression suite stability over multiple releases.

**Entry Criteria**
- Criteria: Scorecard identifies and prioritizes gaps.

**Exit Criteria**
- Criteria: No unresolved critical prerequisites remain.

**Risks**
- Risk: Hidden dependencies emerge late.
- Mitigation: Cross-plan dependency review before final decision.

**Rollback/Fallback**
- Rollback condition: New critical gap discovered near decision date.
- Rollback action: Defer kickoff and execute targeted remediation sprint.

---

### Phase 3 - Scale and Performance
**Phase Objective**
- Verify platform can absorb harness-related load and control complexity.

**Linked SPEC Clauses**
- Clause(s): `09 Resource Manager Spec`, `12 Evaluation Engine Spec`.

**Blocking Dependencies**
- Dependency: Hardening gap closure complete.

**Deliverables**
- Deliverable 1: Capacity assessment for expected harness workloads.
- Deliverable 2: Cost and performance risk model.

**Workstreams**
- Performance profiling: Baseline headroom analysis.
- Capacity/scaling: Queueing/backpressure readiness for longer tasks.
- Cost optimization: Scenario-based cost modeling.
- High-volume validation: Simulated harness-like traffic patterns.

**Task List**
- [ ] Task P3-01: Run synthetic long-task workload tests.
- [ ] Task P3-02: Validate budget controls for burst scenarios.
- [ ] Task P3-03: Publish scaling recommendations for harness launch.

**Entry Criteria**
- Criteria: Hardening acceptance complete.

**Exit Criteria**
- Criteria: Capacity and cost headroom sufficient for pilot harness scope.

**Risks**
- Risk: Simulated workloads underrepresent real harness behavior.
- Mitigation: Conservative multipliers and staged pilot assumptions.

**Rollback/Fallback**
- Rollback condition: Capacity headroom insufficient.
- Rollback action: Delay kickoff and prioritize infrastructure scaling.

---

### Phase 4 - Operations and Continuous Improvement
**Phase Objective**
- Make final Go/No-Go decision and define launch guardrails if approved.

**Linked SPEC Clauses**
- Clause(s): `22 Runbooks and Operations`, `20 Config and Feature Flags`.

**Blocking Dependencies**
- Dependency: All readiness categories green or formally accepted exceptions.

**Deliverables**
- Deliverable 1: Signed Go/No-Go decision record.
- Deliverable 2: If Go, initial harness pilot guardrails and phased rollout constraints.

**Workstreams**
- Operations readiness: Pilot support model and escalation path.
- Evaluation feedback loops: Pilot KPI and stop-condition definitions.
- Incident readiness: Harness-specific preflight incident checklist.
- Knowledge transfer: Kickoff briefing for harness implementation team.

**Task List**
- [ ] Task P4-01: Conduct final readiness review board.
- [ ] Task P4-02: Issue signed decision memo and next steps.
- [ ] Task P4-03: If approved, publish harness pilot constraints.

**Entry Criteria**
- Criteria: Readiness score meets threshold with reviewed evidence.

**Exit Criteria**
- Criteria: Decision finalized and communicated with clear action plan.

**Risks**
- Risk: Pressure to start without full readiness.
- Mitigation: Enforce mandatory sign-offs and exception protocol.

**Rollback/Fallback**
- Rollback condition: Early pilot indicates foundational issues.
- Rollback action: Stop pilot and return to remediation plan.

---

## 6) Detailed Backlog (Task Table)
| Task ID | Description | Owner Role | Estimate | Priority | Dependencies | Definition of Done | Verification Method |
|---|---|---|---|---|---|---|---|
| P99-001 | Define readiness rubric and thresholds | Platform Lead | 2d | P0 | Plan 00 | Rubric approved by stakeholders | Review record |
| P99-002 | Build readiness scorecard and dashboard | Ops/QA | 3d | P1 | P99-001 | Scorecard auto-updates from evidence | Dashboard demo |
| P99-003 | Close critical readiness gaps | Cross-functional | 1-2 sprints | P0 | P99-002 | No unresolved critical gaps | Audit review |
| P99-004 | Execute final Go/No-Go board | Platform + Security + Ops | 1d | P0 | P99-003 | Decision memo published | Sign-off record |

## 7) Validation and Test Strategy
### 7.1 Unit
- Required unit coverage: Score calculation logic and threshold checks.

### 7.2 Integration
- Required integration scenarios: Evidence ingestion from CI, observability, and security reports.

### 7.3 End-to-End
- Required e2e scenarios: Full readiness review workflow from data ingest to decision memo.

### 7.4 Negative and Failure Path Testing
- Required failure scenarios: Missing evidence, stale metrics, conflicting signals.

### 7.5 CI Quality Gates
- Required checks: Scorecard integrity checks and mandatory evidence completeness.

## 8) Observability and Metrics
### 8.1 Required Instrumentation
- Logs: Readiness data ingest outcomes and decision actions.
- Metrics: Readiness score by category, unresolved gap counts, evidence freshness.
- Traces: Evidence pipeline processing path.
- Events: Readiness review started/completed, decision published.

### 8.2 SLO/SLA Targets
- Latency targets: Readiness dashboard updates within 1 hour of new evidence.
- Error rate targets: Evidence processing failure < 1%.
- Cost targets: Operational overhead minimal versus delivery gains.

### 8.3 Alerting and Dashboards
- Alerts required: Stale evidence, score regression, unresolved critical gaps.
- Dashboard panels required: Readiness trend, blocker map, decision timeline.

## 9) Security and Policy Checks
### 9.1 Threats Introduced by This Scope
- Threat: Incomplete evidence leading to unsafe kickoff decision.

### 9.2 Required Controls
- Control: Mandatory evidence completeness and multi-party sign-off.

### 9.3 Security Validation
- Static analysis: Decision tooling and pipeline configuration checks.
- Runtime checks: Access control to readiness artifacts.
- Abuse/misuse tests: Unauthorized decision override attempts.

### 9.4 Audit Artifacts
- Required artifacts: Readiness scorecards, sign-off records, exception approvals.

## 10) Rollout Strategy
### 10.1 Feature Flags
- Flag name: `harness.readiness_gate_enforced`
- Default state: true
- Rollout criteria: Enabled immediately and remains enforced until kickoff.

### 10.2 Environment Progression
- Dev -> Staging -> Production path: Readiness criteria reviewed across all environments.

### 10.3 Canary/Cohort Plan
- Cohort definition: Not applicable for implementation; applies to decision process participants.
- Success criteria: Reliable, repeatable, and auditable Go/No-Go outcomes.

### 10.4 Kill Switch and Rollback
- Trigger conditions: Evidence corruption or governance process failure.
- Rollback steps: Pause decisions, repair data pipeline, rerun review with verified data.

## 11) Operational Readiness
### 11.1 Runbook Changes
- Runbook updates required: Readiness review SOP and exception handling procedure.

### 11.2 On-Call Readiness
- Alert owner: Platform governance owner.
- Escalation path: Platform -> Security -> Ops leadership.

### 11.3 Support Handoff
- Documentation handoff: Decision rubric and evidence source index.
- Training handoff: Review board process training.

## 12) Acceptance Criteria (Final Gate)
### 12.1 Functional Acceptance
- Criterion: Readiness gate workflow runs end-to-end with complete evidence.

### 12.2 Non-Functional Acceptance
- Criterion: Readiness scoring remains stable and timely.

### 12.3 Security/Compliance Acceptance
- Criterion: Decision process is auditable and access controlled.

### 12.4 Documentation Acceptance
- Criterion: Go/No-Go process and criteria fully documented.

## 13) Post-Implementation Review
### 13.1 Review Date
- Date: Immediately after Go/No-Go decision cycle.

### 13.2 Success Metrics Review
- Metrics reviewed: Decision quality, gap closure rate, evidence freshness.
- Outcome: To be filled.

### 13.3 Deferred Work
- Follow-up task: Convert this readiness plan into active harness implementation plan if approved.
- Target phase: Next cycle.

---

## 14) Quick-Start Duplication Checklist
- Copy this template into `<PLAN_NAME>_PLAN.md`.
- Fill sections 0-4 first before tasking.
- Populate Phase 0-4 entry/exit criteria before assigning owners.
- Add task IDs and dependencies in section 6.
- Define objective acceptance criteria in section 12 before starting implementation.
