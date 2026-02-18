# PLAN Template (Phase-Separated, Verbose)

## 0) Document Control
- Plan ID:
- Plan Name:
- Linked SPEC:
- Owner(s):
- Contributors:
- Status: `draft | ready | in-progress | blocked | done`
- Priority: `P0 | P1 | P2 | P3`
- Created:
- Last Updated:
- Review Cadence:

## 1) Purpose and Outcome
### 1.1 Purpose
Describe why this plan exists and what gap it closes.

### 1.2 Intended Outcomes
- Outcome 1:
- Outcome 2:
- Outcome 3:

### 1.3 Non-Goals
- Non-goal 1:
- Non-goal 2:

## 2) Scope
### 2.1 In Scope
- Capability/process/interface in scope:

### 2.2 Out of Scope
- Explicitly excluded work:

### 2.3 Interfaces Touched
- API endpoints:
- Internal modules:
- Data stores:
- External systems/tools:

## 3) Dependencies
### 3.1 Upstream Dependencies
- Blocking plans/specs/services:

### 3.2 Downstream Consumers
- Plans/features blocked by this plan:

### 3.3 External Dependencies
- Vendor/platform/team approvals:

## 4) Assumptions and Constraints
### 4.1 Assumptions
- Assumption 1:
- Assumption 2:

### 4.2 Constraints
- Security constraints:
- Performance constraints:
- Cost constraints:
- Compliance constraints:

### 4.3 Open Decisions
- Decision item:
- Decision owner:
- Decision deadline:

---

## 5) Phase Plan

### Phase 0 - Foundations
**Phase Objective**
- Establish contracts, guardrails, and minimum scaffolding.

**Linked SPEC Clauses**
- Clause(s):

**Blocking Dependencies**
- Dependency:

**Deliverables**
- Deliverable 1:
- Deliverable 2:

**Workstreams**
- Architecture/contracts:
- Implementation scaffolding:
- Validation setup:
- Documentation:

**Task List**
- [ ] Task P0-01:
- [ ] Task P0-02:
- [ ] Task P0-03:

**Entry Criteria**
- Criteria:

**Exit Criteria**
- Criteria:

**Risks**
- Risk:
- Mitigation:

**Rollback/Fallback**
- Rollback condition:
- Rollback action:

---

### Phase 1 - MVP Path
**Phase Objective**
- Deliver minimum end-to-end capability.

**Linked SPEC Clauses**
- Clause(s):

**Blocking Dependencies**
- Dependency:

**Deliverables**
- Deliverable 1:
- Deliverable 2:

**Workstreams**
- Core implementation:
- Integration:
- Basic observability:
- Basic docs:

**Task List**
- [ ] Task P1-01:
- [ ] Task P1-02:
- [ ] Task P1-03:

**Entry Criteria**
- Criteria:

**Exit Criteria**
- Criteria:

**Risks**
- Risk:
- Mitigation:

**Rollback/Fallback**
- Rollback condition:
- Rollback action:

---

### Phase 2 - Hardening
**Phase Objective**
- Improve reliability, safety, policy enforcement, and test depth.

**Linked SPEC Clauses**
- Clause(s):

**Blocking Dependencies**
- Dependency:

**Deliverables**
- Deliverable 1:
- Deliverable 2:

**Workstreams**
- Reliability/failure handling:
- Security/safety:
- Observability expansion:
- Test expansion:

**Task List**
- [ ] Task P2-01:
- [ ] Task P2-02:
- [ ] Task P2-03:

**Entry Criteria**
- Criteria:

**Exit Criteria**
- Criteria:

**Risks**
- Risk:
- Mitigation:

**Rollback/Fallback**
- Rollback condition:
- Rollback action:

---

### Phase 3 - Scale and Performance
**Phase Objective**
- Optimize throughput, latency, concurrency, and cost efficiency.

**Linked SPEC Clauses**
- Clause(s):

**Blocking Dependencies**
- Dependency:

**Deliverables**
- Deliverable 1:
- Deliverable 2:

**Workstreams**
- Performance profiling:
- Capacity/scaling:
- Cost optimization:
- High-volume validation:

**Task List**
- [ ] Task P3-01:
- [ ] Task P3-02:
- [ ] Task P3-03:

**Entry Criteria**
- Criteria:

**Exit Criteria**
- Criteria:

**Risks**
- Risk:
- Mitigation:

**Rollback/Fallback**
- Rollback condition:
- Rollback action:

---

### Phase 4 - Operations and Continuous Improvement
**Phase Objective**
- Operationalize runbooks, governance loops, and continuous tuning.

**Linked SPEC Clauses**
- Clause(s):

**Blocking Dependencies**
- Dependency:

**Deliverables**
- Deliverable 1:
- Deliverable 2:

**Workstreams**
- Operations readiness:
- Evaluation feedback loops:
- Incident readiness:
- Knowledge transfer:

**Task List**
- [ ] Task P4-01:
- [ ] Task P4-02:
- [ ] Task P4-03:

**Entry Criteria**
- Criteria:

**Exit Criteria**
- Criteria:

**Risks**
- Risk:
- Mitigation:

**Rollback/Fallback**
- Rollback condition:
- Rollback action:

---

## 6) Detailed Backlog (Task Table)
| Task ID | Description | Owner Role | Estimate | Priority | Dependencies | Definition of Done | Verification Method |
|---|---|---|---|---|---|---|---|
| EX-001 |  |  |  |  |  |  |  |
| EX-002 |  |  |  |  |  |  |  |

## 7) Validation and Test Strategy
### 7.1 Unit
- Required unit coverage:

### 7.2 Integration
- Required integration scenarios:

### 7.3 End-to-End
- Required e2e scenarios:

### 7.4 Negative and Failure Path Testing
- Required failure scenarios:

### 7.5 CI Quality Gates
- Required checks:

## 8) Observability and Metrics
### 8.1 Required Instrumentation
- Logs:
- Metrics:
- Traces:
- Events:

### 8.2 SLO/SLA Targets
- Latency targets:
- Error rate targets:
- Cost targets:

### 8.3 Alerting and Dashboards
- Alerts required:
- Dashboard panels required:

## 9) Security and Policy Checks
### 9.1 Threats Introduced by This Scope
- Threat:

### 9.2 Required Controls
- Control:

### 9.3 Security Validation
- Static analysis:
- Runtime checks:
- Abuse/misuse tests:

### 9.4 Audit Artifacts
- Required artifacts:

## 10) Rollout Strategy
### 10.1 Feature Flags
- Flag name:
- Default state:
- Rollout criteria:

### 10.2 Environment Progression
- Dev -> Staging -> Production path:

### 10.3 Canary/Cohort Plan
- Cohort definition:
- Success criteria:

### 10.4 Kill Switch and Rollback
- Trigger conditions:
- Rollback steps:

## 11) Operational Readiness
### 11.1 Runbook Changes
- Runbook updates required:

### 11.2 On-Call Readiness
- Alert owner:
- Escalation path:

### 11.3 Support Handoff
- Documentation handoff:
- Training handoff:

## 12) Acceptance Criteria (Final Gate)
### 12.1 Functional Acceptance
- Criterion:

### 12.2 Non-Functional Acceptance
- Criterion:

### 12.3 Security/Compliance Acceptance
- Criterion:

### 12.4 Documentation Acceptance
- Criterion:

## 13) Post-Implementation Review
### 13.1 Review Date
- Date:

### 13.2 Success Metrics Review
- Metrics reviewed:
- Outcome:

### 13.3 Deferred Work
- Follow-up task:
- Target phase:

---

## 14) Quick-Start Duplication Checklist
- Copy this template into `<PLAN_NAME>_PLAN.md`.
- Fill sections 0-4 first before tasking.
- Populate Phase 0-4 entry/exit criteria before assigning owners.
- Add task IDs and dependencies in section 6.
- Define objective acceptance criteria in section 12 before starting implementation.
