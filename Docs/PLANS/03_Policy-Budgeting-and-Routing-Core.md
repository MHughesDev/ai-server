# Plan 03 - Policy, Budgeting, and Routing Core

## 0) Document Control
- Plan ID: PLAN-03
- Plan Name: Policy, Budgeting, and Routing Core
- Linked SPEC: `docs/Overview.md` sections `06`, `07`, `08`, `13`, `20`; `docs/Architecture_document_Finalized.md` milestone 2
- Owner(s): Control Plane Lead
- Contributors: Policy, Router, Runtime, Security, QA
- Status: `draft`
- Priority: `P0`
- Created: 2026-02-18
- Last Updated: 2026-02-18
- Review Cadence: Twice weekly

## 1) Purpose and Outcome
### 1.1 Purpose
Add deterministic governance so requests are routed and constrained safely by policy, budget, and caller context.

### 1.2 Intended Outcomes
- Outcome 1: `PolicyDecision` enforced for every request.
- Outcome 2: Budget controls prevent runaway cost and unsafe tool/model use.
- Outcome 3: Router produces traceable `PipelinePlan` decisions.

### 1.3 Non-Goals
- Non-goal 1: Tool execution harness for coding workflows.
- Non-goal 2: Full adaptive strategy optimization.

## 2) Scope
### 2.1 In Scope
- Capability/process/interface in scope: Policy decision object, routing rules, budget checks, structured deny/over-budget responses.

### 2.2 Out of Scope
- Explicitly excluded work: Planner/executor loops and file/tool mutation workflows.

### 2.3 Interfaces Touched
- API endpoints: `/v1/query` response/error behavior for policy outcomes.
- Internal modules: Policy engine, strategy hooks, router, budget manager.
- Data stores: Policy config, budget counters/quotas.
- External systems/tools: Identity metadata source and telemetry store.

## 3) Dependencies
### 3.1 Upstream Dependencies
- Blocking plans/specs/services: Plan 01 contract stability and Plan 02 runtime path.

### 3.2 Downstream Consumers
- Plans/features blocked by this plan: Plans 04, 06, 08, and Plan 99 readiness.

### 3.3 External Dependencies
- Vendor/platform/team approvals: Security sign-off for deny rules and budget enforcement defaults.

## 4) Assumptions and Constraints
### 4.1 Assumptions
- Assumption 1: Caller identity/tenant metadata is available at ingress.
- Assumption 2: Policy rules can be expressed declaratively.

### 4.2 Constraints
- Security constraints: Deny-by-default on unknown caller/tool scopes.
- Performance constraints: Policy + routing overhead must remain bounded.
- Cost constraints: Budget checks must be strict and inexpensive.
- Compliance constraints: Policy decisions must be auditable.

### 4.3 Open Decisions
- Decision item: Real-time budget store design (in-memory cache + persistent backing strategy).
- Decision owner: Control Plane Lead.
- Decision deadline: Before Phase 2 completion.

---

## 5) Phase Plan

### Phase 0 - Foundations
**Phase Objective**
- Define policy model, enforcement points, and routing interfaces.

**Linked SPEC Clauses**
- Clause(s): `07 Policy Engine Spec`, `13 Router and Dispatch Spec`, `09 Resource Manager Spec`.

**Blocking Dependencies**
- Dependency: Plan 02 request path stable.

**Deliverables**
- Deliverable 1: `PolicyDecision` schema and evaluation contract.
- Deliverable 2: Router decision matrix and default fallback rules.

**Workstreams**
- Architecture/contracts: Policy/routing contract definitions.
- Implementation scaffolding: Policy evaluator and router interfaces.
- Validation setup: Contract tests and deny-path tests.
- Documentation: Policy rule authoring guide.

**Task List**
- [ ] Task P0-01: Define policy rule model and precedence.
- [ ] Task P0-02: Define budget dimensions (token, cost, calls).
- [ ] Task P0-03: Define router inputs/outputs and fallback behavior.

**Entry Criteria**
- Criteria: Upstream contracts and runtime integration points confirmed.

**Exit Criteria**
- Criteria: Policy/routing contracts approved and test skeleton ready.

**Risks**
- Risk: Rule precedence ambiguity.
- Mitigation: Explicit deterministic evaluation order and tests.

**Rollback/Fallback**
- Rollback condition: Policy model blocks initial rollout.
- Rollback action: Ship minimal deny-list ruleset while preserving interfaces.

---

### Phase 1 - MVP Path
**Phase Objective**
- Enforce policy and route requests using deterministic rules.

**Linked SPEC Clauses**
- Clause(s): `06 Control Plane Spec`, `07 Policy Engine Spec`, `13 Router and Dispatch Spec`.

**Blocking Dependencies**
- Dependency: Phase 0 definitions approved.

**Deliverables**
- Deliverable 1: Policy decision evaluation in request path.
- Deliverable 2: Router selecting chat/default pipelines with trace events.

**Workstreams**
- Core implementation: Rule evaluation and deny/allow decisions.
- Integration: Router integration and response mapping.
- Basic observability: Policy/routing decision telemetry.
- Basic docs: Rule lifecycle and incident handling.

**Task List**
- [ ] Task P1-01: Implement policy evaluator and enforcement middleware.
- [ ] Task P1-02: Implement router with deterministic selection rules.
- [ ] Task P1-03: Return structured budget/policy errors to clients.

**Entry Criteria**
- Criteria: Phase 0 contracts and tests available.

**Exit Criteria**
- Criteria: Requests consistently produce policy and routing decisions.

**Risks**
- Risk: Incorrect deny/allow mapping.
- Mitigation: Golden policy scenario tests.

**Rollback/Fallback**
- Rollback condition: Deny spikes for valid traffic.
- Rollback action: Roll back to previous policy ruleset and keep conservative defaults.

---

### Phase 2 - Hardening
**Phase Objective**
- Improve safety, rule correctness, and budget reliability.

**Linked SPEC Clauses**
- Clause(s): `11 Failure Manager Spec`, `12 Evaluation Engine Spec`, `19 Security and Isolation Spec`.

**Blocking Dependencies**
- Dependency: MVP policy/routing active in staging.

**Deliverables**
- Deliverable 1: Full deny/failure taxonomy and recovery handling.
- Deliverable 2: Budget integrity checks and abuse resistance.

**Workstreams**
- Reliability/failure handling: Budget store degradation handling.
- Security/safety: Rule audit and least-privilege defaults.
- Observability expansion: Decision outcomes and drift metrics.
- Test expansion: Abuse and replay scenarios.

**Task List**
- [ ] Task P2-01: Add policy simulation test suite with expected outcomes.
- [ ] Task P2-02: Add budget race-condition and replay protection tests.
- [ ] Task P2-03: Add policy config validation guardrails.

**Entry Criteria**
- Criteria: Staging policy/routing path stable.

**Exit Criteria**
- Criteria: Hardening suite passes and audit evidence generated.

**Risks**
- Risk: Budget counter inconsistency under concurrency.
- Mitigation: Atomic updates and reconciliation job.

**Rollback/Fallback**
- Rollback condition: Budget enforcement instability.
- Rollback action: Apply static conservative quotas until store issue resolved.

---

### Phase 3 - Scale and Performance
**Phase Objective**
- Scale policy and routing decisions with low latency overhead.

**Linked SPEC Clauses**
- Clause(s): `09 Resource Manager Spec`, `18 Observability Spec`.

**Blocking Dependencies**
- Dependency: Hardening coverage complete.

**Deliverables**
- Deliverable 1: Policy/routing latency profile at target load.
- Deliverable 2: Optimized cache strategy for policy context.

**Workstreams**
- Performance profiling: Policy eval and router decision timing.
- Capacity/scaling: Throughput behavior under concurrency.
- Cost optimization: Reduce policy backend calls.
- High-volume validation: Load tests with mixed caller cohorts.

**Task List**
- [ ] Task P3-01: Benchmark policy/routing overhead and optimize hotspots.
- [ ] Task P3-02: Introduce safe caching with invalidation strategy.
- [ ] Task P3-03: Validate budget enforcement under peak load.

**Entry Criteria**
- Criteria: Hardening gates green.

**Exit Criteria**
- Criteria: Added overhead within agreed latency budget.

**Risks**
- Risk: Cache staleness leads to incorrect permissions.
- Mitigation: Short TTL + event-driven invalidation.

**Rollback/Fallback**
- Rollback condition: Incorrect decisions traced to cache behavior.
- Rollback action: Disable cache and use direct policy source.

---

### Phase 4 - Operations and Continuous Improvement
**Phase Objective**
- Establish durable policy governance and routing quality loop.

**Linked SPEC Clauses**
- Clause(s): `22 Runbooks and Operations`, `21 Test and Eval Plan`.

**Blocking Dependencies**
- Dependency: Dashboards and incident runbooks complete.

**Deliverables**
- Deliverable 1: Policy change management runbook.
- Deliverable 2: Ongoing routing quality review cadence.

**Workstreams**
- Operations readiness: Alert ownership and escalation.
- Evaluation feedback loops: Policy false-positive/false-negative analysis.
- Incident readiness: Rollback drills for policy misconfiguration.
- Knowledge transfer: Rule-author training and review process.

**Task List**
- [ ] Task P4-01: Publish policy incident runbook and rollback template.
- [ ] Task P4-02: Establish weekly policy outcome review.
- [ ] Task P4-03: Run one policy misconfiguration game day.

**Entry Criteria**
- Criteria: Policy/routing stable in production canary.

**Exit Criteria**
- Criteria: Governance process operational and auditable.

**Risks**
- Risk: Frequent policy changes increase incident risk.
- Mitigation: Require staged rollout and peer approval.

**Rollback/Fallback**
- Rollback condition: Policy changes trigger sustained incidents.
- Rollback action: Freeze policy edits and restore last known-good set.

---

## 6) Detailed Backlog (Task Table)
| Task ID | Description | Owner Role | Estimate | Priority | Dependencies | Definition of Done | Verification Method |
|---|---|---|---|---|---|---|---|
| P03-001 | Implement `PolicyDecision` evaluation path | Control Plane Engineer | 4d | P0 | Plan 02 | Decisions produced for all requests | Integration tests |
| P03-002 | Implement budget enforcement checks | Control Plane Engineer | 3d | P0 | P03-001 | Budget denials issued correctly | Scenario tests |
| P03-003 | Implement deterministic router rules | Runtime Engineer | 3d | P0 | P03-001 | Pipeline selected and traced | E2E traces |
| P03-004 | Add policy/routing audit dashboards | SRE | 2d | P1 | P03-001 | Dashboards and alerts live | Dashboard validation |

## 7) Validation and Test Strategy
### 7.1 Unit
- Required unit coverage: Rule evaluator, precedence logic, budget calculators.

### 7.2 Integration
- Required integration scenarios: Ingress identity -> policy -> router -> response.

### 7.3 End-to-End
- Required e2e scenarios: Allowed request, denied request, over-budget request.

### 7.4 Negative and Failure Path Testing
- Required failure scenarios: Missing policy config, budget store latency, stale rule cache.

### 7.5 CI Quality Gates
- Required checks: Policy simulation suite, budget race tests, routing regression tests.

## 8) Observability and Metrics
### 8.1 Required Instrumentation
- Logs: Policy rule matched, budget decisions, router choice.
- Metrics: Allow/deny rates, budget denial counts, routing distribution.
- Traces: Decision spans with reason codes (redacted).
- Events: Policy config update, emergency rollback, budget threshold trip.

### 8.2 SLO/SLA Targets
- Latency targets: Policy + routing adds <= 100ms P95.
- Error rate targets: Incorrect decision rate < 0.1% by audit sampling.
- Cost targets: Budget protections keep spend within approved envelope.

### 8.3 Alerting and Dashboards
- Alerts required: Deny spikes, budget denial anomalies, policy backend degradation.
- Dashboard panels required: Decision trend, route mix, budget burn, false-positive sample rate.

## 9) Security and Policy Checks
### 9.1 Threats Introduced by This Scope
- Threat: Misconfigured rules granting excessive access.

### 9.2 Required Controls
- Control: Deny-by-default and staged policy rollout with peer review.

### 9.3 Security Validation
- Static analysis: Rule schema validation and dependency scanning.
- Runtime checks: Authorization and deny-path enforcement checks.
- Abuse/misuse tests: Escalation attempts and quota evasion attempts.

### 9.4 Audit Artifacts
- Required artifacts: Rule change log, decision audit samples, rollback record.

## 10) Rollout Strategy
### 10.1 Feature Flags
- Flag name: `control.policy_routing_enabled`
- Default state: false
- Rollout criteria: Simulation suite and staging soak pass.

### 10.2 Environment Progression
- Dev -> Staging -> Production path: Internal canary then gradual cohort expansion.

### 10.3 Canary/Cohort Plan
- Cohort definition: Internal traffic and low-risk tenants.
- Success criteria: No abnormal deny spikes; policy overhead within target.

### 10.4 Kill Switch and Rollback
- Trigger conditions: Policy misrouting, false deny surge, budget errors.
- Rollback steps: Disable policy-routing flag, return to safe default route and static quotas.

## 11) Operational Readiness
### 11.1 Runbook Changes
- Runbook updates required: Policy rollback, budget store degradation playbook.

### 11.2 On-Call Readiness
- Alert owner: Control plane on-call.
- Escalation path: Control Plane -> Security -> Platform.

### 11.3 Support Handoff
- Documentation handoff: Decision reason code catalog.
- Training handoff: Rule authoring and incident triage.

## 12) Acceptance Criteria (Final Gate)
### 12.1 Functional Acceptance
- Criterion: Every request receives policy and routing decisions with traceability.

### 12.2 Non-Functional Acceptance
- Criterion: Added decision overhead within SLO budgets.

### 12.3 Security/Compliance Acceptance
- Criterion: Least-privilege controls and audit requirements satisfied.

### 12.4 Documentation Acceptance
- Criterion: Rule lifecycle docs and runbooks published.

## 13) Post-Implementation Review
### 13.1 Review Date
- Date: 2 weeks after production canary reaches steady state.

### 13.2 Success Metrics Review
- Metrics reviewed: Deny precision, budget effectiveness, decision latency.
- Outcome: To be filled.

### 13.3 Deferred Work
- Follow-up task: Adaptive strategy optimization for route quality.
- Target phase: After baseline operations maturity.

---

## 14) Quick-Start Duplication Checklist
- Copy this template into `<PLAN_NAME>_PLAN.md`.
- Fill sections 0-4 first before tasking.
- Populate Phase 0-4 entry/exit criteria before assigning owners.
- Add task IDs and dependencies in section 6.
- Define objective acceptance criteria in section 12 before starting implementation.
