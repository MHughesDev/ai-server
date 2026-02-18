# L2-02 MVP Runtime Single Endpoint Chat

## 0) Document Control
- Plan ID: L2-02
- Plan Name: MVP Runtime Single Endpoint Chat
- Linked SPEC: `Docs/SPEC/02_API_Contracts.md`, `Docs/SPEC/04_Ingress_Spec.md`, `Docs/SPEC/05_BrainStem_Spec.md`, `Docs/SPEC/13_Router_and_Dispatch_Spec.md`, `Docs/SPEC/15_ModelGateway_Spec.md`
- Owner(s): Runtime Lead
- Contributors: API Lead, Brain Stem Lead, Gateway Lead, QA Lead
- Status: `draft`
- Priority: `P0`
- Created: 2026-02-18
- Last Updated: 2026-02-18
- Review Cadence: Daily implementation standup + gate review at sprint end

## 1) Purpose and Outcome
### 1.1 Purpose
Deliver the first production-shaped request path through `POST /v1/query`, with deterministic ingress, first cognition at Brain Stem, and a reliable chat pipeline response.

### 1.2 Intended Outcomes
- Outcome 1: Clients can call one endpoint and receive contract-compliant responses.
- Outcome 2: Ingress rejections are deterministic and taxonomy-correct.
- Outcome 3: Every request produces baseline traceability data.

### 1.3 Non-Goals
- Non-goal 1: Full policy/budget router matrix.
- Non-goal 2: Retrieval or multimodal behavior.

## 2) Scope
### 2.1 In Scope
- HTTP endpoint wiring for `POST /v1/query`.
- Ingress middleware chain (auth, rate/quota, payload checks, request id normalization).
- Brain Stem canonicalization and minimal intent extraction for chat-first behavior.
- Chat pipeline invocation via Model Gateway abstraction.
- Integration tests for happy-path and deterministic ingress failures.

### 2.2 Out of Scope
- Generalized pipeline planner/executor loops.
- Tool execution beyond deny/stub behavior.
- Advanced route selection for non-chat pipelines.

### 2.3 Interfaces Touched
- API endpoints: `POST /v1/query`, `GET /healthz`, `GET /readyz`, `GET /metrics`.
- Internal modules: Ingress, Brain Stem, Router placeholder, Chat pipeline, Model Gateway.
- Data stores: Optional request metadata store and log sink.
- External systems/tools: Model provider sandbox/test account.

## 3) Dependencies
### 3.1 Upstream Dependencies
- `Docs/PLANS/Implementation-plans/L2-01_Contracts-and-Project-Scaffold.md` complete and accepted.

### 3.2 Downstream Consumers
- `Docs/PLANS/Implementation-plans/L2-03_Policy-Budgeting-and-Routing-Implementation.md`
- `Docs/PLANS/Implementation-plans/L2-04_Observability-and-Evaluation-Implementation.md`

### 3.3 External Dependencies
- Network and credentials for model provider in non-production environment.
- Runtime deployment environment for API smoke tests.

## 4) Assumptions and Constraints
### 4.1 Assumptions
- Assumption 1: Chat path can be stabilized before policy/routing expansion.
- Assumption 2: Brain Stem can use simple intent extraction without heavy cognition.

### 4.2 Constraints
- Security constraints: Ingress remains non-cognitive and enforces auth/quotas.
- Performance constraints: MVP p95 should be acceptable for interactive chat baseline.
- Cost constraints: Request-level model usage tracked and bounded by conservative defaults.
- Compliance constraints: Response and error envelopes follow contract definitions exactly.

### 4.3 Open Decisions
- Decision item: Initial streaming behavior (`sync` only vs early SSE support).
- Decision owner: Runtime Lead.
- Decision deadline: Before final integration gate.

---

## 5) Phase Plan

### Phase 0 - Endpoint and Ingress Baseline
**Phase Objective**
- Implement deterministic endpoint ingress pipeline without cognition.

**Linked SPEC Clauses**
- Clause(s): `02 API Contracts`, `04 Ingress Spec`.

**Blocking Dependencies**
- Dependency: L2-01 contract package and scaffold complete.

**Deliverables**
- Deliverable 1: `POST /v1/query` endpoint with contract validation.
- Deliverable 2: Deterministic reject responses for auth/rate/payload failures.

**Workstreams**
- Core implementation: Endpoint controller and middleware ordering.
- Integration: Request ID propagation and envelope validation.
- Basic observability: Basic request log events.
- Basic docs: Endpoint behavior and error table.

**Task List**
- [ ] Task P0-01: Implement endpoint request validation and envelope parsing.
- [ ] Task P0-02: Implement ingress middleware chain in deterministic order.
- [ ] Task P0-03: Add failure taxonomy tests for ingress rejection paths.

**Entry Criteria**
- Criteria: Contract tests and startup smoke are green.

**Exit Criteria**
- Criteria: Ingress pass/fail behavior deterministic under test.

**Risks**
- Risk: Hidden business logic leaks into ingress.
- Mitigation: Enforce strict code review rule for ingress boundary.

**Rollback/Fallback**
- Rollback condition: Ingress behavior changes unpredictably with payload variants.
- Rollback action: Revert middleware change set and restore known deterministic order.

---

### Phase 1 - Brain Stem and Chat Path
**Phase Objective**
- Stand up first cognition boundary and route to chat pipeline reliably.

**Linked SPEC Clauses**
- Clause(s): `05 BrainStem Spec`, `14 Pipelines Catalog`.

**Blocking Dependencies**
- Dependency: Endpoint and ingress baseline stable.

**Deliverables**
- Deliverable 1: `CanonicalRequest` + `IntentBundle` generation for chat scenarios.
- Deliverable 2: Chat pipeline path that calls Model Gateway and returns `ResponseEnvelope`.

**Workstreams**
- Core implementation: Canonicalization and lightweight intent classification.
- Integration: Route to chat pipeline with fallback handling.
- Basic observability: Emit route and model usage summaries.
- Basic docs: Brain Stem behavior and intent assumptions.

**Task List**
- [ ] Task P1-01: Implement text canonicalization and input normalization.
- [ ] Task P1-02: Implement minimal chat intent extraction logic.
- [ ] Task P1-03: Route requests to chat pipeline and synthesize response envelope.

**Entry Criteria**
- Criteria: Ingress phase accepted and stable.

**Exit Criteria**
- Criteria: Chat requests return valid response envelopes in integration tests.

**Risks**
- Risk: Intent misclassification sends requests to wrong placeholder route.
- Mitigation: Default-safe route policy to chat or deterministic decline.

**Rollback/Fallback**
- Rollback condition: Brain Stem introduces unstable routing behavior.
- Rollback action: Force deterministic chat route while preserving canonicalization output.

---

### Phase 2 - Model Gateway Integration
**Phase Objective**
- Abstract provider interactions through stable gateway contract.

**Linked SPEC Clauses**
- Clause(s): `15 ModelGateway Spec`.

**Blocking Dependencies**
- Dependency: Phase 1 chat path in place.

**Deliverables**
- Deliverable 1: Gateway client with timeout/retry and usage accounting hooks.
- Deliverable 2: Structured provider error mapping to response error taxonomy.

**Workstreams**
- Core implementation: Provider abstraction and invocation contract.
- Integration: Gateway integration with chat pipeline.
- Basic observability: Usage counters and latency timers.
- Basic docs: Provider configuration and failure mapping.

**Task List**
- [ ] Task P2-01: Implement gateway request/response translation.
- [ ] Task P2-02: Add timeout, retry, and deterministic error mapping.
- [ ] Task P2-03: Add token/cost usage capture in response telemetry.

**Entry Criteria**
- Criteria: Chat path functional with local stub provider.

**Exit Criteria**
- Criteria: External provider integration passes smoke and failure mapping tests.

**Risks**
- Risk: Provider inconsistency causes flaky integration tests.
- Mitigation: Use test doubles for core CI, run provider tests in scheduled jobs.

**Rollback/Fallback**
- Rollback condition: Provider integration degrades endpoint reliability.
- Rollback action: Revert to deterministic local stub mode via feature flag.

---

### Phase 3 - Integration and Regression Baseline
**Phase Objective**
- Lock MVP behavior with end-to-end tests and contract assertions.

**Linked SPEC Clauses**
- Clause(s): `21 Test and Eval Plan`.

**Blocking Dependencies**
- Dependency: Endpoint, Brain Stem, and gateway path merged.

**Deliverables**
- Deliverable 1: Integration suite for success and fail-paths.
- Deliverable 2: Contract compliance checks in CI for response payloads.

**Workstreams**
- Core implementation: Integration harness and fixtures.
- Integration: Realistic request scenarios.
- Basic observability: Validation of trace/request id propagation.
- Basic docs: Known MVP limitations and unsupported cases.

**Task List**
- [ ] Task P3-01: Build e2e tests for happy-path chat flow.
- [ ] Task P3-02: Add deterministic fail-path tests (invalid payload/auth/rate).
- [ ] Task P3-03: Add response schema validation assertions in e2e.

**Entry Criteria**
- Criteria: Gateway integration stable.

**Exit Criteria**
- Criteria: MVP integration suite passes consistently in CI.

**Risks**
- Risk: Contract mismatch between app and tests.
- Mitigation: Reuse shared contract validators in tests.

**Rollback/Fallback**
- Rollback condition: E2E failures reveal systemic contract incompatibility.
- Rollback action: Lock endpoint output to previous known-good contract version.

---

### Phase 4 - Sprint Gate and Handoff
**Phase Objective**
- Finalize MVP gate and prepare for governance core implementation.

**Linked SPEC Clauses**
- Clause(s): `06 Control Plane Spec`, `07 Policy Engine Spec`, `13 Router and Dispatch Spec`.

**Blocking Dependencies**
- Dependency: Integration and regression baseline green.

**Deliverables**
- Deliverable 1: Sprint gate report with performance, reliability, and known risks.
- Deliverable 2: Handoff package for L2-03 policy/budget/routing sprint.

**Workstreams**
- Core implementation: Stabilization fixes.
- Integration: Ensure route placeholders are compatible with upcoming policy layer.
- Basic observability: Confirm minimum trace fields are present.
- Basic docs: Publish MVP limitations and migration notes.

**Task List**
- [ ] Task P4-01: Execute final gate checklist and sign-off.
- [ ] Task P4-02: Document technical debt and owner assignments.
- [ ] Task P4-03: Publish L2-03 handoff details and interface contracts.

**Entry Criteria**
- Criteria: CI integration suite stable for 3 consecutive runs.

**Exit Criteria**
- Criteria: MVP accepted and approved for governance-core expansion.

**Risks**
- Risk: Hidden reliability issues in sustained load.
- Mitigation: Add short staging soak before gate sign-off.

**Rollback/Fallback**
- Rollback condition: Soak reveals critical reliability issues.
- Rollback action: Delay handoff and run stabilization patch cycle.

---

## 6) Detailed Backlog (Task Table)
| Task ID | Description | Owner Role | Estimate | Priority | Dependencies | Definition of Done | Verification Method |
|---|---|---|---|---|---|---|---|
| MVP-001 | Build `POST /v1/query` endpoint and request validator | API Lead | 1d | P0 | L2-01 | Endpoint accepts valid envelopes and rejects invalid | Unit + integration tests |
| MVP-002 | Implement deterministic ingress middleware chain | Runtime Lead | 1d | P0 | MVP-001 | Auth/rate/payload checks deterministic | Failure-path tests |
| MVP-003 | Implement Brain Stem canonicalizer and basic intent extractor | Brain Stem Lead | 1.5d | P0 | MVP-002 | Canonical request + intent produced for chat requests | Unit tests |
| MVP-004 | Implement chat route and response synthesizer | Runtime Lead | 1d | P0 | MVP-003 | Chat pipeline invoked and returns valid envelope | Integration tests |
| MVP-005 | Integrate Model Gateway abstraction | Gateway Lead | 1.5d | P0 | MVP-004 | Provider call behind gateway with timeout/retry | Gateway tests |
| MVP-006 | Add e2e happy path and rejection path suite | QA Lead | 1d | P0 | MVP-005 | Core e2e scenarios pass in CI | CI run |
| MVP-007 | Add request trace propagation and usage telemetry baseline | Runtime Lead | 0.5d | P1 | MVP-005 | Trace/request ids present in logs and responses | Trace assertions |
| MVP-008 | Publish MVP gate report and L2-03 handoff | Runtime Lead | 0.5d | P1 | MVP-006,MVP-007 | Gate report approved | Review sign-off |

## 7) Validation and Test Strategy
### 7.1 Unit
- Required unit coverage: Ingress middleware, canonicalizer, route handler, gateway adapters.

### 7.2 Integration
- Required integration scenarios: Valid chat request, auth failure, rate-limit failure, payload validation failure.

### 7.3 End-to-End
- Required e2e scenarios: Full endpoint to provider and response envelope emission.

### 7.4 Negative and Failure Path Testing
- Required failure scenarios: Provider timeout, invalid contract payload, unsupported input shape.

### 7.5 CI Quality Gates
- Required checks: lint, type-check, unit tests, integration tests, e2e smoke.

## 8) Observability and Metrics
### 8.1 Required Instrumentation
- Logs: Request accepted/rejected with reason code and request id.
- Metrics: Request volume, ingress reject count, p95 latency, provider error count.
- Traces: End-to-end spans from ingress through gateway call.
- Events: `ROUTE_DECISION`, `ERROR` (baseline version).

### 8.2 SLO/SLA Targets
- Latency targets: p95 <= 2.5s for MVP chat requests.
- Error rate targets: <= 1.5% server-side error rate in staging baseline.
- Cost targets: Median request cost within budget baseline set by platform.

### 8.3 Alerting and Dashboards
- Alerts required: Error spike, latency breach, provider timeout surge.
- Dashboard panels required: Request throughput, reject taxonomy, gateway latency, cost trend.

## 9) Security and Policy Checks
### 9.1 Threats Introduced by This Scope
- Threat: Ingress bypass or weak validation introduces unsafe payload execution paths.

### 9.2 Required Controls
- Control: Deterministic auth/limit checks and strict schema validation before cognition.

### 9.3 Security Validation
- Static analysis: Dependency and secrets scanning.
- Runtime checks: Auth failures, quota enforcement, payload limit enforcement.
- Abuse/misuse tests: Replayed invalid payloads, oversized request bodies.

### 9.4 Audit Artifacts
- Required artifacts: Error taxonomy report, ingress test report, endpoint gate decision log.

## 10) Rollout Strategy
### 10.1 Feature Flags
- Flag name: `runtime.mpp_query_chat_enabled`
- Default state: false in production, true in dev/staging.
- Rollout criteria: Integration and soak tests pass.

### 10.2 Environment Progression
- Dev -> Staging -> Production path: Deploy to dev, run smoke, promote to staging for soak, then controlled production enablement.

### 10.3 Canary/Cohort Plan
- Cohort definition: Internal app traffic only for initial canary.
- Success criteria: p95 and error rates within 10% of staging baseline for 24 hours.

### 10.4 Kill Switch and Rollback
- Trigger conditions: Error rate > 2x baseline or sustained latency breach.
- Rollback steps: Disable endpoint flag, route to stable fallback response mode, open incident.

## 11) Operational Readiness
### 11.1 Runbook Changes
- Runbook updates required: Ingress rejection troubleshooting and provider timeout handling.

### 11.2 On-Call Readiness
- Alert owner: Runtime on-call.
- Escalation path: Runtime -> Platform -> Provider operations contact.

### 11.3 Support Handoff
- Documentation handoff: MVP endpoint contract examples and known limitations.
- Training handoff: On-call walkthrough for ingress and gateway failure handling.

## 12) Acceptance Criteria (Final Gate)
### 12.1 Functional Acceptance
- Criterion: `POST /v1/query` returns valid `ResponseEnvelope` for supported MVP requests.

### 12.2 Non-Functional Acceptance
- Criterion: Meets baseline latency and reliability thresholds in staging soak.

### 12.3 Security/Compliance Acceptance
- Criterion: Deterministic ingress controls pass abuse and failure-path tests.

### 12.4 Documentation Acceptance
- Criterion: Endpoint behavior, error model, and operational runbook updates are complete.

## 13) Post-Implementation Review
### 13.1 Review Date
- Date: 1 week after production canary.

### 13.2 Success Metrics Review
- Metrics reviewed: p95 latency, server error rate, ingress reject distribution, provider timeout rates.
- Outcome: To be recorded after review.

### 13.3 Deferred Work
- Follow-up task: Implement policy/budget/routing enforcement.
- Target phase: L2-03.
