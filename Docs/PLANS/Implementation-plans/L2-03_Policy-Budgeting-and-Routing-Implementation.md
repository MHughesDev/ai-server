# L2-03 Policy Budgeting and Routing Implementation

## 0) Document Control
- Plan ID: L2-03
- Plan Name: Policy Budgeting and Routing Implementation
- Linked SPEC: `docs/SPEC/01_Principles_and_Invariants.md`, `docs/SPEC/03_Component_Map.md`, `docs/SPEC/06_ControlPlane_Spec.md`, `docs/SPEC/07_PolicyEngine_Spec.md`, `docs/SPEC/08_StrategyEngine_Spec.md`, `docs/SPEC/09_ResourceManager_Spec.md`, `docs/SPEC/13_Router_and_Dispatch_Spec.md`, `docs/SPEC/18_Observability_Spec.md`, `docs/SPEC/19_Security_and_Isolation_Spec.md`
- Owner(s): Control Plane Lead
- Contributors: Policy Lead, Router Lead, Runtime Lead, QA Lead
- Status: `complete`
- Priority: `P0`
- Created: 2026-02-18
- Last Updated: 2026-02-18
- Implementation completed: 2026-02-18
- Review Cadence: Daily + cross-functional architecture review twice weekly

## 1) Purpose and Outcome
### 1.1 Purpose
Implement enforceable governance controls so no request can execute without explicit policy, budget, and route decisions.

### 1.2 Intended Outcomes
- Outcome 1: Every request receives deterministic `PolicyDecision`.
- Outcome 2: Effective budgets are assigned and enforced before dispatch.
- Outcome 3: Router emits explicit allow/deny plus concrete `PipelinePlan`.

### 1.3 Non-Goals
- Non-goal 1: Full observability dashboards and alert suites.
- Non-goal 2: Retrieval quality and multimodal pipeline behavior.

## 2) Scope
### 2.1 In Scope
- Policy rule evaluation and deterministic decision model.
- Resource budgeting (tokens, tools, wall-clock, optional cost cap).
- Strategy and routing selection with deny behavior.
- Dispatch preconditions and bypass-prevention checks.
- Integration tests for allow, deny, and budget-exceeded paths.

### 2.2 Out of Scope
- Tool execution internals.
- Complex planner/executor loop behavior.
- Production rollout mechanics.

### 2.3 Interfaces Touched
- API endpoints: `POST /v1/query` decision path before execution.
- Internal modules: Control Plane, Policy Engine, Strategy Engine, Resource Manager, Router.
- Data stores: Policy rules/config store, request budget state store.
- External systems/tools: Optional policy-as-code source and rules governance.

## 3) Dependencies
### 3.1 Upstream Dependencies
- `docs/PLANS/Implementation-plans/L2-02_MVP-Runtime-Single-Endpoint-Chat.md` complete.
- Contracts from L2-01 stable.

### 3.2 Downstream Consumers
- `docs/PLANS/Implementation-plans/L2-04_Observability-and-Evaluation-Implementation.md`
- `docs/PLANS/Implementation-plans/L2-05_Security-Isolation-and-Compliance-Implementation.md`
- `docs/PLANS/Implementation-plans/L2-06_Memory-and-Retrieval-Implementation.md`

### 3.3 External Dependencies
- Stakeholder-approved baseline policies by role/org class.
- Budget policy defaults and escalation rules.

## 4) Assumptions and Constraints
### 4.1 Assumptions
- Assumption 1: Policy rules can be represented deterministically for MVP governance.
- Assumption 2: Routing decisions can be separated from execution logic cleanly.

### 4.2 Constraints
- Security constraints: No execution path can bypass policy or budget checks.
- Performance constraints: Combined governance decision p95 <= 150ms (see 8.2).
- Cost constraints: Budget enforcement prevents spend above configured hard cap (see 8.2).
- Compliance constraints: Policy and routing decisions must be auditable.

### 4.3 Open Decisions
- Decision item: Real-time policy source refresh strategy (cache TTL vs push updates).
- Decision owner: Control Plane Lead.
- Decision deadline: Before production readiness planning begins.

---

## 5) Phase Plan

### Phase 0 - Deterministic Policy Core
**Phase Objective**
- Implement policy evaluator with explicit and reproducible outputs.

**Linked SPEC Clauses**
- Clause(s): `06 Control Plane Spec`, `07 Policy Engine Spec`.

**Blocking Dependencies**
- Dependency: MVP endpoint flow stable from L2-02.

**Deliverables**
- Deliverable 1: Policy rule evaluation engine and decision object generation.
- Deliverable 2: Standardized deny reason taxonomy mapped to response errors.

**Workstreams**
- Core implementation: Policy evaluation engine.
- Integration: Brain Stem context to policy input mapping.
- Basic observability: Policy decision event emission baseline.
- Basic docs: Rule format and override procedure.

**Task List**
- [x] Task P0-01: Implement policy input model and evaluator.
- [x] Task P0-02: Implement allow/deny outputs with reason codes.
- [x] Task P0-03: Add policy unit tests covering role, org, and scope cases.

**Entry Criteria**
- Criteria: L2-02 response path contract stable.

**Exit Criteria**
- Criteria: Policy decisions deterministic for all baseline test fixtures.

**Risks**
- Risk: Ambiguous policy precedence leads to nondeterministic output.
- Mitigation: Define and test strict precedence order.

**Rollback/Fallback**
- Rollback condition: Policy output inconsistency under identical inputs.
- Rollback action: Freeze dynamic rules and fall back to static baseline policy set.

---

### Phase 1 - Budget Assignment and Enforcement
**Phase Objective**
- Bound execution resources before any pipeline dispatch.

**Linked SPEC Clauses**
- Clause(s): `09 Resource Manager Spec`.

**Blocking Dependencies**
- Dependency: Policy core emits stable decisions.

**Deliverables**
- Deliverable 1: Effective budgets object from policy + strategy + runtime state.
- Deliverable 2: Deterministic budget-exceeded behavior and error responses.

**Workstreams**
- Core implementation: Resource manager and budget reconciliation.
- Integration: Request-level budget state tracking.
- Basic observability: Budget assign and budget reject events.
- Basic docs: Budget defaults and override controls.

**Task List**
- [x] Task P1-01: Implement budget assignment logic and constraints.
- [x] Task P1-02: Implement hard-stop behavior for exceeded budgets.
- [x] Task P1-03: Add tests at exact threshold boundaries.

**Entry Criteria**
- Criteria: Policy decision path integrated.

**Exit Criteria**
- Criteria: Over-budget requests fail predictably with correct taxonomy.

**Risks**
- Risk: Race conditions in shared budget counters.
- Mitigation: Use atomic updates and isolation for request scope.

**Rollback/Fallback**
- Rollback condition: Budget tracker inconsistencies under concurrency tests.
- Rollback action: Disable shared counters and enforce per-request hard caps only.

---

### Phase 2 - Strategy and Routing Selection
**Phase Objective**
- Translate intent + policy + budgets into explicit route decisions and pipeline plans.

**Linked SPEC Clauses**
- Clause(s): `08 Strategy Engine Spec`, `13 Router and Dispatch Spec`.

**Blocking Dependencies**
- Dependency: Budget enforcement complete.

**Deliverables**
- Deliverable 1: Router strategy selection and `PipelinePlan` generation.
- Deliverable 2: Explicit deny route when policy or budget prohibits execution.

**Workstreams**
- Core implementation: Strategy engine and router rules.
- Integration: Bind route selection to request lifecycle.
- Basic observability: Route decision event with rationale fields.
- Basic docs: Route precedence and fallback behavior.

**Task List**
- [x] Task P2-01: Implement strategy selection with deterministic tie-breakers.
- [x] Task P2-02: Implement router output (`allow`, `deny`, `pipeline`).
- [x] Task P2-03: Add allow/deny route integration tests.

**Entry Criteria**
- Criteria: Policy and budgets are integrated and validated.

**Exit Criteria**
- Criteria: All requests emit explicit route decisions under test.

**Risks**
- Risk: Route logic complexity introduces hidden bypasses.
- Mitigation: Add deny-by-default behavior and bypass invariants in tests.

**Rollback/Fallback**
- Rollback condition: Router regression causes unsafe route selection.
- Rollback action: Lock to minimal safe route table and deny unknown combinations.

---

### Phase 3 - Non-Bypass Enforcement and Gate Tests
**Phase Objective**
- Prove no execution path can bypass governance controls.

**Linked SPEC Clauses**
- Clause(s): `01 Principles and Invariants`, `03 Component Map`.

**Blocking Dependencies**
- Dependency: Strategy and routing implementation merged.

**Deliverables**
- Deliverable 1: Integration suite proving policy/budget checks happen before dispatch.
- Deliverable 2: Invariant checks integrated into CI.

**Workstreams**
- Core implementation: Guardrails and assertions in dispatch boundary.
- Integration: Non-bypass tests against all route classes.
- Basic observability: Decision trace completeness checks.
- Basic docs: Governance invariant evidence package.

**Task List**
- [x] Task P3-01: Implement dispatch precondition assertions.
- [x] Task P3-02: Add bypass-attempt negative tests.
- [x] Task P3-03: Add CI invariants gate for governance sequence.

**Entry Criteria**
- Criteria: Route decision outputs stable.

**Exit Criteria**
- Criteria: CI proves no bypass path through routing/dispatch.

**Risks**
- Risk: Hidden legacy path bypasses control plane.
- Mitigation: Route all dispatch calls through one shared gateway.

**Rollback/Fallback**
- Rollback condition: Any bypass discovered in CI or review.
- Rollback action: Block release and disable affected route path immediately.

---

### Phase 4 - Handoff to Observability and Security Sprints
**Phase Objective**
- Provide stable governance artifacts for telemetry and security hardening.

**Linked SPEC Clauses**
- Clause(s): `18 Observability Spec`, `19 Security and Isolation Spec`.

**Blocking Dependencies**
- Dependency: Non-bypass tests passing.

**Deliverables**
- Deliverable 1: Governance event contract list and sample payloads.
- Deliverable 2: Signed handoff with known risks for L2-04 and L2-05.

**Workstreams**
- Core implementation: Final hardening patches.
- Integration: Ensure decision traces are emitted and consumable.
- Basic observability: Validate event fields and IDs.
- Basic docs: Governance runbook section.

**Task List**
- [x] Task P4-01: Publish policy/route event contracts.
- [x] Task P4-02: Execute governance gate review.
- [x] Task P4-03: Handoff to observability/security owners.

**Entry Criteria**
- Criteria: Governance CI gates green.

**Exit Criteria**
- Criteria: L2-04 and L2-05 start without policy/budget/routing blockers.

**Risks**
- Risk: Missing event fields block observability sprint.
- Mitigation: Contract checklists included in handoff.

**Rollback/Fallback**
- Rollback condition: Handoff reveals missing governance artifacts.
- Rollback action: Extend sprint with targeted closure tasks before downstream start.

---

## 6) Detailed Backlog (Task Table)
| Task ID | Description | Owner Role | Estimate | Priority | Dependencies | Definition of Done | Verification Method |
|---|---|---|---|---|---|---|---|
| GOV-001 | Implement deterministic policy evaluator | Policy Lead | 1.5d | P0 | L2-02 | Policy decision object generated for all baseline fixtures | Unit tests |
| GOV-002 | Implement deny reason taxonomy mapping | Runtime Lead | 0.5d | P0 | GOV-001 | Deny reasons map to stable error codes | Contract tests |
| GOV-003 | Implement resource manager budget assignment | Control Plane Lead | 1d | P0 | GOV-001 | Effective budgets produced per request | Unit tests |
| GOV-004 | Implement budget-exceeded enforcement path | Control Plane Lead | 0.75d | P0 | GOV-003 | Over-budget requests rejected deterministically | Integration tests |
| GOV-005 | Implement strategy selector and router decisions | Router Lead | 1.25d | P0 | GOV-003 | Router returns allow/deny + pipeline plan | Integration tests |
| GOV-006 | Add non-bypass dispatch assertions | Router Lead | 0.75d | P0 | GOV-005 | Dispatch blocked without governance artifacts | Negative tests |
| GOV-007 | Build allow/deny/budget e2e suite | QA Lead | 1d | P0 | GOV-004,GOV-005 | Governance matrix passes in CI | CI run |
| GOV-008 | Publish governance handoff package | Control Plane Lead | 0.5d | P1 | GOV-007 | Event contracts and risks documented | Review sign-off |

## 7) Validation and Test Strategy
### 7.1 Unit
- Required unit coverage: Policy evaluator, budget allocator, route selector tie-breakers.

### 7.2 Integration
- Required integration scenarios: Allowed request, denied request, budget-exceeded request.

### 7.3 End-to-End
- Required e2e scenarios: Request traverses ingress/brain stem/governance and dispatches only when allowed.

### 7.4 Negative and Failure Path Testing
- Required failure scenarios: Missing policy decision, invalid budget object, route selection for unsupported intent.

### 7.5 CI Quality Gates
- Required checks: Governance matrix tests, non-bypass invariant tests, contract compatibility tests.

## 8) Observability and Metrics
### 8.1 Required Instrumentation
- Logs: Policy inputs (redacted), decisions, budget calculations, route outcomes.
- Metrics: Deny rate, budget rejection rate, decision latency, route distribution.
- Traces: Spans for policy evaluation, budget assignment, route selection.
- Events: `POLICY_DECISION`, `BUDGET_ASSIGN`, `ROUTE_DECISION`, `ERROR`.

### 8.2 SLO/SLA Targets
- Latency targets: Combined governance decision p95 <= 150ms.
- Error rate targets: Governance processing internal errors <= 0.5%.
- Cost targets: Budget enforcement prevents spend above configured hard cap.

### 8.3 Alerting and Dashboards
This project is a UI-less API server; dashboard panels are out of scope and deferred to ops/external tooling (e.g. Grafana).
- Alerts required: Deny spike anomalies, missing policy decisions, budget assignment failures.
- Dashboard panels required (if ops provisions): Decision latency histogram, allow/deny ratios, route mix by intent.

## 9) Security and Policy Checks
### 9.1 Threats Introduced by This Scope
- Threat: Policy bypass or permissive defaults permit unauthorized tool/model usage.

### 9.2 Required Controls
- Control: Deny-by-default semantics and mandatory policy/budget preconditions before dispatch.

### 9.3 Security Validation
- Static analysis: Policy rule linting and code scan.
- Runtime checks: Deny path enforcement and immutable decision trace capture.
- Abuse/misuse tests: Role escalation attempts and budget abuse attempts.

### 9.4 Audit Artifacts
- Required artifacts: Policy decision audit logs, budget rejection reports, route decision records.

## 10) Rollout Strategy
### 10.1 Feature Flags
- Flag name: `control_plane.enforcement_enabled`
- Default state: true in dev/staging, false in production until canary.
- Rollout criteria: Governance matrix and non-bypass tests pass.

### 10.2 Environment Progression
- Dev -> Staging -> Production path: Enable in dev, soak in staging, canary by low-risk internal callers.

### 10.3 Canary/Cohort Plan
- Cohort definition: Internal traffic + one low-risk tenant.
- Success criteria: No unauthorized executions and stable decision latency for 48 hours.

### 10.4 Kill Switch and Rollback
- Trigger conditions: Unauthorized route observed or decision failure spike.
- Rollback steps: Disable enforcement flag, revert to last stable governance profile, incident escalation.

## 11) Operational Readiness
### 11.1 Runbook Changes
- Runbook updates required: Policy incident response and budget-rejection troubleshooting.

### 11.2 On-Call Readiness
- Alert owner: Control Plane on-call.
- Escalation path: Control Plane -> Security -> Platform.

### 11.3 Support Handoff
- Documentation handoff: Governance event schema and deny reason catalog.
- Training handoff: Cross-team walkthrough of routing decision traces.

## 12) Acceptance Criteria (Final Gate)
### 12.1 Functional Acceptance
- Criterion: All requests receive deterministic policy, budget, and route decisions.

### 12.2 Non-Functional Acceptance
- Criterion: Governance latency and reliability targets met under staging load.

### 12.3 Security/Compliance Acceptance
- Criterion: No bypass path exists; deny-by-default enforcement proven by tests.

### 12.4 Documentation Acceptance
- Criterion: Policy rules, budget rules, and route logic documented with audit artifacts.

## 13) Post-Implementation Review
### 13.1 Review Date
- Date: 1 week after L2-04 kickoff.

### 13.2 Success Metrics Review
- Metrics reviewed: Deny/allow distribution, budget rejection correctness, decision latency, bypass incidents.
- Outcome: To be recorded after review.

### 13.3 Deferred Work
- Follow-up task: Dynamic policy refresh and advanced strategy weighting.
- Target phase: L2-08 hardening window.
