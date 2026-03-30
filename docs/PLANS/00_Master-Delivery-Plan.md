# AI Server Master Delivery Plan (Harness Deferred)

## 0) Document Control
- Plan ID: PLAN-00
- Plan Name: Master Delivery Plan (Harness Deferred)
- Linked SPEC: `docs/ARCHITECTURE/Overview.md` or `docs/ARCHITECTURE/Overview.md`, `docs/Architecture.md` or `docs/ARCHITECTURE/Architecture_document_Finalized.md`
- Implementation status and gaps: SOW §2.6 (Contract and Type Gaps), §7 (What Might Need to Be Added); see `docs/PLANS/Scope-of-Work.md`.
- Owner(s): Tech Lead, Platform Lead
- Contributors: API, Runtime, Security, Ops, QA
- Status: `draft`
- Priority: `P0`
- Created: 2026-02-18
- Last Updated: 2026-02-27
- **Implementation status (SOW):** Core implementation phases are complete, but production readiness remains conditional on closing active gaps in `docs/PLANS/SOW-Documentation-Implementation-Gap-Closure.md` (observability sink hardening, readiness dependency checks, and doc/runtime parity updates). Completion language in this plan should be interpreted as implementation-complete, not production-ready.
- Review Cadence: Weekly delivery review + daily async status

## 0.1) Canonical L2 implementation write-ups (Plans 01–08 and 99)

The former numbered drafts at `docs/PLANS/01_*.md` … `docs/PLANS/99_*.md` duplicated the L2 implementation series and were **removed** to reduce drift. Use these documents as the phased delivery source of truth:

| Plan | Canonical implementation document |
|------|-----------------------------------|
| 01 | [`implementation/L2-01_Contracts-and-Project-Scaffold.md`](./implementation/L2-01_Contracts-and-Project-Scaffold.md) |
| 02 | [`implementation/L2-02_MVP-Runtime-Single-Endpoint-Chat.md`](./implementation/L2-02_MVP-Runtime-Single-Endpoint-Chat.md) |
| 03 | [`implementation/L2-03_Policy-Budgeting-and-Routing-Implementation.md`](./implementation/L2-03_Policy-Budgeting-and-Routing-Implementation.md) |
| 04 | [`implementation/L2-04_Observability-and-Evaluation-Implementation.md`](./implementation/L2-04_Observability-and-Evaluation-Implementation.md) |
| 05 | [`implementation/L2-05_Security-Isolation-and-Compliance-Implementation.md`](./implementation/L2-05_Security-Isolation-and-Compliance-Implementation.md) |
| 06 | [`implementation/L2-06_Memory-and-Retrieval-Implementation.md`](./implementation/L2-06_Memory-and-Retrieval-Implementation.md) |
| 07 | [`implementation/L2-07_Multimodal-Input-Path-Implementation.md`](./implementation/L2-07_Multimodal-Input-Path-Implementation.md) |
| 08 | [`implementation/L2-08_Rollout-and-Operational-Readiness-Implementation.md`](./implementation/L2-08_Rollout-and-Operational-Readiness-Implementation.md) |
| 99 | [`implementation/L2-99_Deferred-Coding-Agent-Harness-Readiness-Gate.md`](./implementation/L2-99_Deferred-Coding-Agent-Harness-Readiness-Gate.md) |

Sprint handoff material previously in separate `*_Handoff.md` files is merged into each L2 doc under **Sprint handoff archive**.

## 1) Purpose and Outcome
### 1.1 Purpose
Coordinate platform work so the system reaches production-ready status only after active operational and security gaps are closed. **Coding agent harness (autonomous loop) is implemented** and gated by `harness_autonomous_execution_enabled`; enable after L2-99 readiness gate passes.

### 1.2 Intended Outcomes
- Outcome 1: Stable contracts and policy/routing core in production shape.
- Outcome 2: End-to-end observability, security controls, and operational readiness in place.
- Outcome 3: Harness start criteria are objective and measurable.

### 1.3 Non-Goals
- Non-goal 1: Enabling the autonomous coding agent loop in production before the L2-99 readiness gate passes (implementation is complete; use `harness_autonomous_execution_enabled` only after sign-off).
- Non-goal 2: Shipping broad tool-execution capabilities in this cycle.

## 2) Scope
### 2.1 In Scope
- Capability/process/interface in scope: Master sequencing for Plans 01-08 and deferred gate for Plan 99.

### 2.2 Out of Scope
- Explicitly excluded until gate passes: Enabling autonomous harness execution in production (code is implemented; enable via `harness_autonomous_execution_enabled` only after L2-99 go decision).

### 2.3 Interfaces Touched
- API endpoints: `/v1/query`, operational health/metrics endpoints.
- Internal modules: Ingress, Brain Stem, Policy, Router, Gateway, Observability, Memory, Multimodal path.
- Data stores: Config store, telemetry backend, vector store (for retrieval readiness).
- External systems/tools: Model providers, telemetry stack, incident tooling.

## 3) Dependencies
### 3.1 Upstream Dependencies
- Blocking plans/specs/services: Finalized architecture contracts from `docs/ARCHITECTURE/Overview.md` / `docs/ARCHITECTURE/Overview.md` and `docs/Architecture.md` / `docs/ARCHITECTURE/Architecture_document_Finalized.md`.

### 3.2 Downstream Consumers
- Plans/features blocked by this plan: Plan 99 (Deferred Coding Agent Harness), product integrations.

### 3.3 External Dependencies
- Vendor/platform/team approvals: Provider API access, telemetry workspace provisioning, security review sign-off.

## 4) Assumptions and Constraints
### 4.1 Assumptions
- Assumption 1: Team can deliver MVP runtime and policy core in parallel.
- Assumption 2: Observability and security requirements can be implemented incrementally without re-architecture.

### 4.2 Constraints
- Security constraints: Principle of least privilege and redaction by default.
- Performance constraints: P95 latency and cost budgets must be defined before production rollout.
- Cost constraints: Provider token spend ceilings enforced by policy.
- Compliance constraints: Auditability of policy decisions and access paths.

### 4.3 Open Decisions
- Decision item: Internal transport for future long-running jobs (HTTP-only now vs queue later).
- Decision owner: Platform Lead.
- Decision deadline: Before Plan 08 production rollout.

---

## 5) Phase Plan

### Phase 0 - Foundations
**Phase Objective**
- Establish integrated delivery sequencing, ownership, and quality gates across all plans.

**Linked SPEC Clauses**
- Clause(s): `01 Principles and Invariants`, `03 Component Map`, `20 Config and Feature Flags`.

**Blocking Dependencies**
- Dependency: Architecture contract review completed.

**Deliverables**
- Deliverable 1: Cross-plan dependency map with critical path.
- Deliverable 2: Shared Definition of Done across plans.

**Workstreams**
- Architecture/contracts: Contract freeze windows and change control.
- Implementation scaffolding: Plan templates instantiated and owner assigned.
- Validation setup: Global quality gate checklist.
- Documentation: Single source plan index.

**Task List**
- [ ] Task P0-01: Publish plan order, owners, and inter-plan dependencies.
- [ ] Task P0-02: Define cross-plan gate criteria and acceptance matrix.
- [ ] Task P0-03: Approve deferred harness gate criteria.

**Entry Criteria**
- Criteria: Plan list approved by technical and product owners.

**Exit Criteria**
- Criteria: Plans 01-08 are ready with clear start/stop criteria and dependencies.

**Risks**
- Risk: Teams execute out of sequence and cause churn.
- Mitigation: Enforce dependency gates and weekly architecture review.

**Rollback/Fallback**
- Rollback condition: Delivery order creates repeated rework.
- Rollback action: Re-baseline scope and freeze downstream starts for one sprint.

---

### Phase 1 - MVP Path
**Phase Objective**
- Deliver minimum end-to-end value while preserving interface stability.

**Linked SPEC Clauses**
- Clause(s): `02 API Contracts`, `04 Ingress Spec`, `05 Brain Stem Spec`, `15 Model Gateway Spec`.

**Blocking Dependencies**
- Dependency: Plan 01 start criteria met.

**Deliverables**
- Deliverable 1: `/v1/query` with chat flow.
- Deliverable 2: Baseline telemetry and error model.

**Workstreams**
- Core implementation: Ingress + Brain Stem + chat path.
- Integration: Gateway integration and error envelopes.
- Basic observability: Initial traces/metrics/events.
- Basic docs: API and runbook basics.

**Task List**
- [x] Task P1-01: Complete Plan 01 and verify acceptance criteria.
- [x] Task P1-02: Confirm interoperability with policy/routing placeholders.
- [ ] Task P1-03: Publish MVP readiness report.

**Entry Criteria**
- Criteria: Plan 01 approved and unblocked.

**Exit Criteria**
- Criteria: MVP runtime stable, instrumented, and documented.

**Risks**
- Risk: Contract drift during implementation.
- Mitigation: Contract tests in CI and schema version checks.

**Rollback/Fallback**
- Rollback condition: Reliability below baseline.
- Rollback action: Disable new path flags and revert to minimal chat-only route.

---

### Phase 2 - Hardening
**Phase Objective**
- Harden governance, reliability, and test confidence before scale.

**Linked SPEC Clauses**
- Clause(s): `06 Control Plane Spec`, `07 Policy Engine Spec`, `13 Router and Dispatch Spec`, `19 Security and Isolation Spec`.

**Blocking Dependencies**
- Dependency: Plan 02, Plan 04, Plan 05 in-progress with no critical blockers.

**Deliverables**
- Deliverable 1: Enforced policy and budgets.
- Deliverable 2: Security controls and eval gates active.

**Workstreams**
- Reliability/failure handling: Structured error taxonomy and fallback paths.
- Security/safety: Access controls, redaction, audit traces.
- Observability expansion: Policy/routing and budget events.
- Test expansion: Negative path and abuse cases.

**Task List**
- [x] Task P2-01: Complete policy and routing acceptance tests.
- [ ] Task P2-02: Validate security controls and produce audit artifacts.
- [ ] Task P2-03: Enable quality gates for regressions.

**Entry Criteria**
- Criteria: MVP baseline running with stable contracts.

**Exit Criteria**
- Criteria: Governance and safety are measurable and enforceable.

**Risks**
- Risk: Policy latency impact.
- Mitigation: Cache policy context and profile hot paths.

**Rollback/Fallback**
- Rollback condition: Hardening changes regress latency or availability.
- Rollback action: Roll back to previous policy ruleset and reduced checks via feature flags.

---

### Phase 3 - Scale and Performance
**Phase Objective**
- Optimize throughput, latency, and cost while preserving control guarantees.

**Linked SPEC Clauses**
- Clause(s): `09 Resource Manager Spec`, `12 Evaluation Engine Spec`, `18 Observability Spec`.

**Blocking Dependencies**
- Dependency: Plans 03, 06, and 07 complete enough for load scenarios.

**Deliverables**
- Deliverable 1: Performance baseline and capacity model.
- Deliverable 2: Cost guardrails and optimization backlog.

**Workstreams**
- Performance profiling: End-to-end latency breakdown.
- Capacity/scaling: Concurrency and backpressure design.
- Cost optimization: Provider and token usage tuning.
- High-volume validation: Load and soak tests.

**Task List**
- [ ] Task P3-01: Run performance/load tests and publish bottlenecks.
- [ ] Task P3-02: Implement top latency and cost optimizations.
- [ ] Task P3-03: Approve production capacity thresholds.

**Entry Criteria**
- Criteria: Hardening quality gates passing consistently.

**Exit Criteria**
- Criteria: SLO/cost targets met in staging under representative load.

**Risks**
- Risk: Traffic burst behavior not captured.
- Mitigation: Add burst and chaos scenarios to load suite.

**Rollback/Fallback**
- Rollback condition: Optimization introduces instability.
- Rollback action: Disable optimization flag and restore known stable settings.

---

### Phase 4 - Operations and Continuous Improvement
**Phase Objective**
- Operationalize governance loops and prepare deferred harness handoff.

**Linked SPEC Clauses**
- Clause(s): `22 Runbooks and Operations`, `21 Test and Eval Plan`, `20 Config and Feature Flags`.

**Blocking Dependencies**
- Dependency: Plan 08 complete and on-call readiness validated.

**Deliverables**
- Deliverable 1: Production runbooks and incident playbook in use.
- Deliverable 2: Harness readiness decision record.

**Workstreams**
- Operations readiness: Alert routing and response ownership.
- Evaluation feedback loops: Weekly regression and quality review cadence.
- Incident readiness: Game days and postmortems.
- Knowledge transfer: Handoff docs for harness-start team.

**Task List**
- [ ] Task P4-01: Execute one rollback drill and one incident drill.
- [ ] Task P4-02: Complete post-launch metrics review.
- [ ] Task P4-03: Decide Go/No-Go for Plan 99 kickoff.

**Entry Criteria**
- Criteria: Production rollout complete with stable telemetry.

**Exit Criteria**
- Criteria: Operations steady state achieved and deferred scope queued.

**Risks**
- Risk: Operational debt accumulates before harness begins.
- Mitigation: Weekly ops debt triage with explicit SLA.

**Rollback/Fallback**
- Rollback condition: Operational incidents exceed error budget.
- Rollback action: Freeze new feature work and prioritize reliability fixes.

---

## 6) Detailed Backlog (Task Table)
| Task ID | Description | Owner Role | Estimate | Priority | Dependencies | Definition of Done | Verification Method |
|---|---|---|---|---|---|---|---|
| MDP-001 | Publish cross-plan dependency map | Tech Lead | 1d | P0 | None | Dependency map approved | Plan review sign-off |
| MDP-002 | Define shared quality gate matrix | QA Lead | 2d | P0 | MDP-001 | Gate matrix in docs and CI mapping | CI checklist review |
| MDP-003 | Approve harness deferred gate criteria | Platform + Security | 1d | P0 | MDP-002 | Go/No-Go criteria documented | Architecture review |
| MDP-004 | Run monthly portfolio health review | Tech Lead | 0.5d/month | P1 | MDP-001 | Risks/deps updated | Review notes |

## 7) Validation and Test Strategy
### 7.1 Unit
- Required unit coverage: Contract schema validation and decision logic helpers.

### 7.2 Integration
- Required integration scenarios: Cross-plan interfaces (ingress->brain stem->policy->router->gateway).

### 7.3 End-to-End
- Required e2e scenarios: Chat success path, budget exceeded path, policy deny path.

### 7.4 Negative and Failure Path Testing
- Required failure scenarios: Provider outage, telemetry outage, invalid payload, policy backend latency.

### 7.5 CI Quality Gates
- Required checks: Schema checks, integration smoke, security scanning, regression eval subset.

## 8) Observability and Metrics
### 8.1 Required Instrumentation
- Logs: Structured logs with request id and redacted context.
- Metrics: Latency, error rate, budget denials, routing distribution.
- Traces: End-to-end span tree across all core components.
- Events: Policy decisions, routing decisions, rollback events.

### 8.2 SLO/SLA Targets
- Latency targets: P95 <= 2.5s for chat path in production baseline.
- Error rate targets: <= 1% server-side errors, excluding client validation failures.
- Cost targets: Monthly token spend within approved budget envelope.

### 8.3 Alerting and Dashboards
This project is a UI-less API server; dashboard panels are out of scope and deferred to ops/external tooling (e.g. Grafana).
- Alerts required: Error budget burn, denial spikes, latency spikes, cost spikes.
- Dashboard panels required (if ops provisions): Request volume, route mix, policy outcomes, cost per caller.

## 9) Security and Policy Checks
### 9.1 Threats Introduced by This Scope
- Threat: Inconsistent policy enforcement across routes.

### 9.2 Required Controls
- Control: Central policy decision path and enforcement tests at all route entry points.

### 9.3 Security Validation
- Static analysis: Dependency and secret scanning.
- Runtime checks: Auth, rate limits, policy deny enforcement.
- Abuse/misuse tests: Prompt abuse, budget abuse, malformed payload replay.

### 9.4 Audit Artifacts
- Required artifacts: Policy decision logs, release approvals, rollback drill reports.

## 10) Rollout Strategy
### 10.1 Feature Flags
- Flag name: `platform_production_rollout_enabled` (legacy alias: `PLATFORM_MASTER_ROLLOUT_ENABLED`)
- Default state: false
- Rollout criteria: All P0 plans pass acceptance and staging soak.

### 10.2 Environment Progression
- Dev -> Staging -> Production path: Planned wave by wave, one major plan per wave.

### 10.3 Canary/Cohort Plan
- Cohort definition: Internal callers first, then selected low-risk tenant cohort.
- Success criteria: Error and latency within 10% of staging baseline.

### 10.4 Kill Switch and Rollback
- Trigger conditions: Error budget burn > 2x, policy bypass evidence, severe cost spike.
- Rollback steps: Disable rollout flags, route to stable previous version, incident response.

## 11) Operational Readiness
### 11.1 Runbook Changes
- Runbook updates required: Release, rollback, policy outage, provider outage.

### 11.2 On-Call Readiness
- Alert owner: Platform on-call.
- Escalation path: Platform -> Security -> Infra -> Leadership.

### 11.3 Support Handoff
- Documentation handoff: Plan index and runbook references.
- Training handoff: One walkthrough per team before production wave.

## 12) Acceptance Criteria (Final Gate)
### 12.1 Functional Acceptance
- Criterion: Plans 01-08 accepted with no unresolved P0 defects.

### 12.2 Non-Functional Acceptance
- Criterion: Latency, availability, and cost targets meet defined thresholds.

### 12.3 Security/Compliance Acceptance
- Criterion: Security review complete with required controls and audit evidence.

### 12.4 Documentation Acceptance
- Criterion: All plans and runbooks current, linked, and owner-assigned.

## 13) Post-Implementation Review
### 13.1 Review Date
- Date: 2 weeks after production rollout completion.

### 13.2 Success Metrics Review
- Metrics reviewed: SLO attainment, policy enforcement rate, incident count, change failure rate.
- Outcome: To be filled at review.

### 13.3 Deferred Work
- Follow-up task: Start Plan 99 if readiness gate passes.
- Target phase: Next delivery cycle.

---

## 14) Quick-Start Duplication Checklist
- Copy this template into `<PLAN_NAME>_PLAN.md`.
- Fill sections 0-4 first before tasking.
- Populate Phase 0-4 entry/exit criteria before assigning owners.
- Add task IDs and dependencies in section 6.
- Define objective acceptance criteria in section 12 before starting implementation.
