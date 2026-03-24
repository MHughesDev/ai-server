# Plan 02 - MVP Runtime (Single Endpoint + Chat)

## 0) Document Control
- Plan ID: PLAN-02
- Plan Name: MVP Runtime (Single Endpoint + Chat)
- Linked SPEC: `docs/ARCHITECTURE/Overview.md` sections `02`, `04`, `05`, `15`, `18`; `docs/ARCHITECTURE/Architecture_document_Finalized.md` milestone 1
- Owner(s): Runtime Lead
- Contributors: API, Model Gateway, Observability, QA
- Status: `draft`
- Priority: `P0`
- Created: 2026-02-18
- Last Updated: 2026-02-18
- Review Cadence: Twice weekly

## 1) Purpose and Outcome
### 1.1 Purpose
Deliver a reliable, observable baseline runtime that serves chat requests through a stable endpoint.

### 1.2 Intended Outcomes
- Outcome 1: `/v1/query` works end-to-end for chat.
- Outcome 2: Ingress guardrails and canonicalization are enforced.
- Outcome 3: Baseline telemetry supports debugging and operations.

### 1.3 Non-Goals
- Non-goal 1: Multi-pipeline routing policies beyond chat baseline.
- Non-goal 2: Coding agent harness loops.

## 2) Scope
### 2.1 In Scope
- Capability/process/interface in scope: Ingress middleware, canonicalization, minimal intent extraction, chat pipeline, model gateway integration.

### 2.2 Out of Scope
- Explicitly excluded work: Tool gateway execution and planning/execution loops.

### 2.3 Interfaces Touched
- API endpoints: `/v1/query`, health/readiness endpoints.
- Internal modules: Ingress, Brain Stem, Router (chat default), Model Gateway.
- Data stores: Config store for model/provider settings.
- External systems/tools: Model provider APIs, telemetry backend.

## 3) Dependencies
### 3.1 Upstream Dependencies
- Blocking plans/specs/services: Plan 01 contract enforcement and version policy.

### 3.2 Downstream Consumers
- Plans/features blocked by this plan: Plan 03, Plan 04, Plan 06, Plan 07.

### 3.3 External Dependencies
- Vendor/platform/team approvals: Provider credentials and quota setup.

## 4) Assumptions and Constraints
### 4.1 Assumptions
- Assumption 1: Text-first canonicalization is acceptable for MVP.
- Assumption 2: One primary model provider is sufficient initially.

### 4.2 Constraints
- Security constraints: Auth/rate/payload controls required at ingress.
- Performance constraints: MVP latency must stay within initial budget.
- Cost constraints: Basic token and call budgets tracked.
- Compliance constraints: Request/response metadata traceable without sensitive leakage.

### 4.3 Open Decisions
- Decision item: Streaming support in MVP vs post-MVP.
- Decision owner: Runtime Lead.
- Decision deadline: Before Phase 2 start.

---

## 5) Phase Plan

### Phase 0 - Foundations
**Phase Objective**
- Prepare runtime scaffolding and baseline request lifecycle.

**Linked SPEC Clauses**
- Clause(s): `04 Ingress Spec`, `05 Brain Stem Spec`, `15 Model Gateway Spec`.

**Blocking Dependencies**
- Dependency: Contract schemas and validation middleware from Plan 01.

**Deliverables**
- Deliverable 1: Ingress middleware chain design.
- Deliverable 2: Chat pipeline skeleton with provider abstraction.

**Workstreams**
- Architecture/contracts: Endpoint behavior and error model mapping.
- Implementation scaffolding: Middleware and pipeline interfaces.
- Validation setup: Smoke tests for endpoint lifecycle.
- Documentation: API usage notes and constraints.

**Task List**
- [ ] Task P0-01: Implement middleware stack (auth, rate, request-id, payload cap).
- [ ] Task P0-02: Build canonical request mapping for text payloads.
- [ ] Task P0-03: Add chat route scaffold with provider adapter.

**Entry Criteria**
- Criteria: Plan 01 contracts accepted.

**Exit Criteria**
- Criteria: Baseline endpoint path compiles and passes smoke tests.

**Risks**
- Risk: Middleware order causes unintended denials.
- Mitigation: Explicit middleware sequence tests.

**Rollback/Fallback**
- Rollback condition: Middleware chain instability.
- Rollback action: Reduce to minimal secure middleware set and reintroduce incrementally.

---

### Phase 1 - MVP Path
**Phase Objective**
- Deliver full chat request-response behavior with baseline observability.

**Linked SPEC Clauses**
- Clause(s): `02 API Contracts`, `18 Observability Spec`.

**Blocking Dependencies**
- Dependency: Provider credentials and gateway config ready.

**Deliverables**
- Deliverable 1: `/v1/query` chat response path in staging.
- Deliverable 2: Basic tracing, metrics, and structured errors.

**Workstreams**
- Core implementation: Chat inference and response formatting.
- Integration: Provider fail/timeout handling.
- Basic observability: Request traces and core latency metrics.
- Basic docs: Known limits and expected behavior.

**Task List**
- [ ] Task P1-01: Implement gateway invocation with timeout and retry policy.
- [ ] Task P1-02: Emit response envelopes with stable error model.
- [ ] Task P1-03: Add golden path integration test.

**Entry Criteria**
- Criteria: Phase 0 complete and smoke tests green.

**Exit Criteria**
- Criteria: Chat success path and common failure paths validated.

**Risks**
- Risk: Provider latency variance.
- Mitigation: Timeout policy and fallback response behavior.

**Rollback/Fallback**
- Rollback condition: High timeout/error rates in rollout.
- Rollback action: Limit traffic cohort and route to previous stable provider config.

---

### Phase 2 - Hardening
**Phase Objective**
- Improve reliability and correctness for production-readiness.

**Linked SPEC Clauses**
- Clause(s): `11 Failure Manager Spec`, `18 Observability Spec`, `21 Test and Eval Plan`.

**Blocking Dependencies**
- Dependency: MVP traffic testing results.

**Deliverables**
- Deliverable 1: Failure taxonomy handling in runtime.
- Deliverable 2: Expanded integration and negative tests.

**Workstreams**
- Reliability/failure handling: Timeout, retry, and fallback tuning.
- Security/safety: Input sanitization and abuse resistance.
- Observability expansion: Provider error and retry metrics.
- Test expansion: Negative request and provider failure simulations.

**Task List**
- [ ] Task P2-01: Implement consistent timeout/retry behavior matrix.
- [ ] Task P2-02: Add provider outage simulation tests.
- [ ] Task P2-03: Add request abuse and oversized payload tests.

**Entry Criteria**
- Criteria: MVP path stable in staging.

**Exit Criteria**
- Criteria: Failure modes and mitigations validated in CI/staging.

**Risks**
- Risk: Retry policy increases latency/cost.
- Mitigation: Cap retries and monitor cost-per-request.

**Rollback/Fallback**
- Rollback condition: Hardening changes regress SLO.
- Rollback action: Revert retry matrix via config flag.

---

### Phase 3 - Scale and Performance
**Phase Objective**
- Optimize chat runtime for higher throughput and lower unit cost.

**Linked SPEC Clauses**
- Clause(s): `09 Resource Manager Spec`, `12 Evaluation Engine Spec`.

**Blocking Dependencies**
- Dependency: Hardening telemetry baseline.

**Deliverables**
- Deliverable 1: Performance profile and optimization report.
- Deliverable 2: Updated capacity estimates for production.

**Workstreams**
- Performance profiling: Hot path latency breakdown.
- Capacity/scaling: Concurrency/backpressure behavior.
- Cost optimization: Model and token usage tuning.
- High-volume validation: Load/soak tests.

**Task List**
- [ ] Task P3-01: Run load tests at target and burst traffic.
- [ ] Task P3-02: Optimize serialization and provider request shaping.
- [ ] Task P3-03: Set autoscaling and throttling thresholds.

**Entry Criteria**
- Criteria: Stable failure handling and observability.

**Exit Criteria**
- Criteria: SLO and cost goals met under expected load.

**Risks**
- Risk: Scaling reveals hidden lock/contention issues.
- Mitigation: Concurrency profiling and stress testing.

**Rollback/Fallback**
- Rollback condition: Throughput optimizations cause instability.
- Rollback action: Disable optimization flags and return to stable runtime profile.

---

### Phase 4 - Operations and Continuous Improvement
**Phase Objective**
- Transition MVP runtime to durable operations and iterative tuning.

**Linked SPEC Clauses**
- Clause(s): `22 Runbooks and Operations`, `21 Test and Eval Plan`.

**Blocking Dependencies**
- Dependency: Production dashboards and alerts configured.

**Deliverables**
- Deliverable 1: Runtime incident runbooks.
- Deliverable 2: Ongoing quality review cadence.

**Workstreams**
- Operations readiness: On-call support for endpoint incidents.
- Evaluation feedback loops: Weekly regression review.
- Incident readiness: Drill for provider outage and rollback.
- Knowledge transfer: Support and product handoff.

**Task List**
- [ ] Task P4-01: Publish and test runtime incident runbook.
- [ ] Task P4-02: Complete one game day scenario.
- [ ] Task P4-03: Establish monthly optimization backlog review.

**Entry Criteria**
- Criteria: Production rollout successful for canary cohort.

**Exit Criteria**
- Criteria: Stable on-call handling and documented continuous improvement loop.

**Risks**
- Risk: Alert fatigue from noisy signals.
- Mitigation: Tune alert thresholds and severities.

**Rollback/Fallback**
- Rollback condition: Operational load unsustainable.
- Rollback action: Reduce scope to essential signals and simplify runbook flow.

---

## 6) Detailed Backlog (Task Table)
| Task ID | Description | Owner Role | Estimate | Priority | Dependencies | Definition of Done | Verification Method |
|---|---|---|---|---|---|---|---|
| P02-001 | Build ingress middleware chain | Runtime Engineer | 3d | P0 | Plan 01 | Middleware enabled with tests | Integration tests |
| P02-002 | Implement text canonicalization | Runtime Engineer | 2d | P0 | P02-001 | Canonical output stable | Contract tests |
| P02-003 | Wire chat pipeline to gateway | Gateway Engineer | 3d | P0 | P02-002 | Chat responses returned reliably | End-to-end test |
| P02-004 | Add tracing/metrics baseline | SRE/Observability | 2d | P0 | P02-003 | Dashboards show core KPIs | Dashboard review |

## 7) Validation and Test Strategy
### 7.1 Unit
- Required unit coverage: Middleware behavior, canonical mapper, response formatter.

### 7.2 Integration
- Required integration scenarios: Endpoint->ingress->brain stem->gateway->response.

### 7.3 End-to-End
- Required e2e scenarios: Chat success, auth failure, rate-limit rejection, provider timeout.

### 7.4 Negative and Failure Path Testing
- Required failure scenarios: Invalid payload, provider outage, malformed provider response.

### 7.5 CI Quality Gates
- Required checks: Unit + integration suite, contract tests, smoke load test.

## 8) Observability and Metrics
### 8.1 Required Instrumentation
- Logs: Request lifecycle logs with correlation ids.
- Metrics: p50/p95 latency, error counts by class, provider timeout rate.
- Traces: End-to-end span chain for request processing.
- Events: Route selected, provider call result, fallback activated.

### 8.2 SLO/SLA Targets
- Latency targets: P95 <= 2.5s for chat path.
- Error rate targets: <= 1% server-side error rate.
- Cost targets: Cost-per-request baseline documented and monitored.

### 8.3 Alerting and Dashboards
- Alerts required: Latency spike, timeout spike, error budget burn.
- Dashboard panels required: Request volume, error classes, provider health, token usage.

## 9) Security and Policy Checks
### 9.1 Threats Introduced by This Scope
- Threat: Endpoint abuse through unauthenticated or oversized requests.

### 9.2 Required Controls
- Control: Auth checks, rate limiting, payload caps, request-id tracing.

### 9.3 Security Validation
- Static analysis: Dependency and secrets scanning.
- Runtime checks: Auth and limit enforcement tests.
- Abuse/misuse tests: Flood simulation, malformed payload replay.

### 9.4 Audit Artifacts
- Required artifacts: Security test results and rollout approval evidence.

## 10) Rollout Strategy
### 10.1 Feature Flags
- Flag name: `mvp.chat_runtime_enabled`
- Default state: false
- Rollout criteria: Staging soak 48h, no P0/P1 defects.

### 10.2 Environment Progression
- Dev -> Staging -> Production path: Internal canary then limited production cohort.

### 10.3 Canary/Cohort Plan
- Cohort definition: Internal applications and low-risk tenants.
- Success criteria: SLO adherence and stable error profile.

### 10.4 Kill Switch and Rollback
- Trigger conditions: Error budget burn, severe timeout spikes.
- Rollback steps: Disable chat runtime flag and route to stable response mode.

## 11) Operational Readiness
### 11.1 Runbook Changes
- Runbook updates required: Provider timeout triage and rollback runbook.

### 11.2 On-Call Readiness
- Alert owner: Runtime on-call.
- Escalation path: Runtime -> Platform -> Infra.

### 11.3 Support Handoff
- Documentation handoff: API usage and known limitations.
- Training handoff: Support walkthrough for common incident classes.

## 12) Acceptance Criteria (Final Gate)
### 12.1 Functional Acceptance
- Criterion: `/v1/query` serves valid chat responses with contract compliance.

### 12.2 Non-Functional Acceptance
- Criterion: Latency/error/cost targets met in staging and canary.

### 12.3 Security/Compliance Acceptance
- Criterion: Ingress controls and abuse tests pass.

### 12.4 Documentation Acceptance
- Criterion: Endpoint, runbook, and ops docs complete.

## 13) Post-Implementation Review
### 13.1 Review Date
- Date: 2 weeks after first production cohort launch.

### 13.2 Success Metrics Review
- Metrics reviewed: SLO attainment, top errors, provider stability.
- Outcome: To be filled.

### 13.3 Deferred Work
- Follow-up task: Evaluate streaming and multi-provider fallback.
- Target phase: Next runtime enhancement cycle.

---

## 14) Quick-Start Duplication Checklist
- Copy this template into `<PLAN_NAME>_PLAN.md`.
- Fill sections 0-4 first before tasking.
- Populate Phase 0-4 entry/exit criteria before assigning owners.
- Add task IDs and dependencies in section 6.
- Define objective acceptance criteria in section 12 before starting implementation.
