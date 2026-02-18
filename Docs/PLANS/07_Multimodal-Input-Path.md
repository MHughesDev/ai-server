# Plan 07 - Multimodal Input Path

## 0) Document Control
- Plan ID: PLAN-07
- Plan Name: Multimodal Input Path
- Linked SPEC: `Docs/Overview.md` sections `05`, `13`, `14`, `16`; `Docs/Architecture.md` sections `8.5`, milestone 4 subset
- Owner(s): Multimodal Lead
- Contributors: Runtime, Retrieval, Model Gateway, QA, Security
- Status: `draft`
- Priority: `P1`
- Created: 2026-02-18
- Last Updated: 2026-02-18
- Review Cadence: Weekly

## 1) Purpose and Outcome
### 1.1 Purpose
Enable safe and deterministic handling of image/PDF multimodal requests with clear routing and grounded outputs.

### 1.2 Intended Outcomes
- Outcome 1: Multimodal payloads are canonicalized and validated consistently.
- Outcome 2: Router selects multimodal-capable path based on intent and capability.
- Outcome 3: Outputs include provenance/citations when supported.

### 1.3 Non-Goals
- Non-goal 1: End-to-end autonomous coding from multimodal prompts.
- Non-goal 2: Full document understanding for all file types from day one.

## 2) Scope
### 2.1 In Scope
- Capability/process/interface in scope: Payload validation, canonicalization for image/PDF, routing, model gateway integration, multimodal error handling.

### 2.2 Out of Scope
- Explicitly excluded work: Tool-driven multimodal workflows and harness loops.

### 2.3 Interfaces Touched
- API endpoints: `/v1/query` accepts multimodal attachments metadata.
- Internal modules: Ingress validators, Brain Stem canonicalizer, Router, Model Gateway.
- Data stores: Temporary media metadata store and retrieval index integration points.
- External systems/tools: Multimodal-capable model providers.

## 3) Dependencies
### 3.1 Upstream Dependencies
- Blocking plans/specs/services: Plans 01-04 and Plan 06 retrieval groundwork.

### 3.2 Downstream Consumers
- Plans/features blocked by this plan: Future advanced multimodal reasoning and Plan 99 context features.

### 3.3 External Dependencies
- Vendor/platform/team approvals: Provider capability and media handling policy approvals.

## 4) Assumptions and Constraints
### 4.1 Assumptions
- Assumption 1: Initial multimodal support limited to image and PDF.
- Assumption 2: Attachment size and count limits are enforced at ingress.

### 4.2 Constraints
- Security constraints: Media validation and strict MIME/type checks.
- Performance constraints: Attachment processing overhead bounded.
- Cost constraints: Multimodal model usage tracked and limited.
- Compliance constraints: Media handling and retention policy compliance.

### 4.3 Open Decisions
- Decision item: Inline media transport vs pre-signed URL ingestion for larger payloads.
- Decision owner: Multimodal Lead.
- Decision deadline: Before Phase 1 implementation lock.

---

## 5) Phase Plan

### Phase 0 - Foundations
**Phase Objective**
- Define multimodal request contract and canonicalization strategy.

**Linked SPEC Clauses**
- Clause(s): `05 Brain Stem Spec`, `13 Router and Dispatch Spec`, `16 Tool Gateway Spec`.

**Blocking Dependencies**
- Dependency: Plan 01 contract baseline and Plan 02 ingress pipeline.

**Deliverables**
- Deliverable 1: Multimodal payload schema and validation rules.
- Deliverable 2: Canonical multimodal representation format.

**Workstreams**
- Architecture/contracts: Attachment contract and error codes.
- Implementation scaffolding: Parser/canonicalizer interfaces.
- Validation setup: File-type and size validation tests.
- Documentation: Supported formats and limits.

**Task List**
- [ ] Task P0-01: Define attachment schema and accepted MIME types.
- [ ] Task P0-02: Define multimodal canonicalization output format.
- [ ] Task P0-03: Define router capability checks for multimodal path.

**Entry Criteria**
- Criteria: Upstream contract and routing interfaces stable.

**Exit Criteria**
- Criteria: Multimodal contracts approved and test skeleton ready.

**Risks**
- Risk: Ambiguous payload formats from clients.
- Mitigation: Strict validation and detailed client error messages.

**Rollback/Fallback**
- Rollback condition: Contract complexity blocks adoption.
- Rollback action: Restrict to one attachment type in first rollout.

---

### Phase 1 - MVP Path
**Phase Objective**
- Deliver initial image/PDF handling and route to capable model path.

**Linked SPEC Clauses**
- Clause(s): `15 Model Gateway Spec`, `14 Pipelines Catalog`.

**Blocking Dependencies**
- Dependency: Multimodal provider integration and quotas.

**Deliverables**
- Deliverable 1: Image/PDF request ingestion and canonicalization.
- Deliverable 2: Routed multimodal response path with structured errors.

**Workstreams**
- Core implementation: Media preprocessing and capability-based route selection.
- Integration: Model provider request/response mapping.
- Basic observability: Multimodal request and failure metrics.
- Basic docs: Usage guide and known constraints.

**Task List**
- [ ] Task P1-01: Implement attachment validation and parsing.
- [ ] Task P1-02: Route multimodal requests to compatible provider path.
- [ ] Task P1-03: Return standardized multimodal error responses.

**Entry Criteria**
- Criteria: Phase 0 contracts complete and provider access available.

**Exit Criteria**
- Criteria: Multimodal MVP scenarios pass in staging.

**Risks**
- Risk: Provider capability mismatch.
- Mitigation: Capability matrix and fallback routing logic.

**Rollback/Fallback**
- Rollback condition: High failure rate in multimodal path.
- Rollback action: Disable multimodal flag while preserving text path.

---

### Phase 2 - Hardening
**Phase Objective**
- Improve multimodal quality, reliability, and safety.

**Linked SPEC Clauses**
- Clause(s): `19 Security and Isolation Spec`, `21 Test and Eval Plan`.

**Blocking Dependencies**
- Dependency: MVP multimodal path stable.

**Deliverables**
- Deliverable 1: Robust failure handling for bad media/provider issues.
- Deliverable 2: Quality and security regression tests.

**Workstreams**
- Reliability/failure handling: Corrupt file and provider error recovery.
- Security/safety: File content checks and malicious payload handling.
- Observability expansion: Quality metrics by media type.
- Test expansion: Multimodal regression corpus.

**Task List**
- [ ] Task P2-01: Add malformed/corrupt media test coverage.
- [ ] Task P2-02: Add malicious payload and abuse tests.
- [ ] Task P2-03: Add multimodal quality benchmark checks.

**Entry Criteria**
- Criteria: MVP multimodal baseline established.

**Exit Criteria**
- Criteria: Hardening tests pass with no critical defects.

**Risks**
- Risk: Security scanner false negatives on novel media.
- Mitigation: Layered validation and deny unknown types.

**Rollback/Fallback**
- Rollback condition: Security concerns in media pipeline.
- Rollback action: Restrict accepted media types and lower size limits.

---

### Phase 3 - Scale and Performance
**Phase Objective**
- Optimize media processing and multimodal inference costs.

**Linked SPEC Clauses**
- Clause(s): `09 Resource Manager Spec`, `18 Observability Spec`.

**Blocking Dependencies**
- Dependency: Hardening metrics and test corpus available.

**Deliverables**
- Deliverable 1: Multimodal throughput and latency profile.
- Deliverable 2: Cost optimization strategy for media-heavy requests.

**Workstreams**
- Performance profiling: Preprocessing and inference timing.
- Capacity/scaling: Queue/backpressure behavior for large payloads.
- Cost optimization: Routing/caching strategy tuning.
- High-volume validation: Mixed media load tests.

**Task List**
- [ ] Task P3-01: Benchmark multimodal request path under load.
- [ ] Task P3-02: Optimize media preprocessing pipeline.
- [ ] Task P3-03: Tune routing for cost vs quality tradeoffs.

**Entry Criteria**
- Criteria: Hardening suite stable.

**Exit Criteria**
- Criteria: Multimodal SLO and cost budgets met.

**Risks**
- Risk: Large payload bursts degrade shared system performance.
- Mitigation: Strict limits, queueing, and priority controls.

**Rollback/Fallback**
- Rollback condition: Throughput degradation impacts core traffic.
- Rollback action: Throttle multimodal traffic and prioritize text path.

---

### Phase 4 - Operations and Continuous Improvement
**Phase Objective**
- Operationalize multimodal support and continuous quality improvements.

**Linked SPEC Clauses**
- Clause(s): `22 Runbooks and Operations`, `21 Test and Eval Plan`.

**Blocking Dependencies**
- Dependency: Production canary successful and alerts tuned.

**Deliverables**
- Deliverable 1: Multimodal incident runbook and support workflow.
- Deliverable 2: Ongoing multimodal quality review loop.

**Workstreams**
- Operations readiness: Alert ownership and incident response.
- Evaluation feedback loops: Quality drift tracking by media type.
- Incident readiness: Provider capability regression drill.
- Knowledge transfer: Support and client guidance updates.

**Task List**
- [ ] Task P4-01: Publish multimodal operations runbook.
- [ ] Task P4-02: Run provider regression simulation drill.
- [ ] Task P4-03: Establish monthly multimodal quality review.

**Entry Criteria**
- Criteria: Production multimodal canary stable.

**Exit Criteria**
- Criteria: Team can operate multimodal path with predictable quality.

**Risks**
- Risk: Provider updates silently alter behavior.
- Mitigation: Provider compatibility tests in CI.

**Rollback/Fallback**
- Rollback condition: Unexpected provider behavior shift.
- Rollback action: Pin provider version/config and disable affected mode.

---

## 6) Detailed Backlog (Task Table)
| Task ID | Description | Owner Role | Estimate | Priority | Dependencies | Definition of Done | Verification Method |
|---|---|---|---|---|---|---|---|
| P07-001 | Define multimodal schema/canonical format | Multimodal Lead | 2d | P0 | Plan 01 | Contract approved | Design review |
| P07-002 | Implement image/PDF validation and parsing | Runtime Engineer | 4d | P1 | P07-001 | Valid attachments processed | Integration tests |
| P07-003 | Add multimodal routing/provider integration | Gateway Engineer | 4d | P1 | P07-002 | Requests route and respond reliably | E2E tests |
| P07-004 | Add multimodal quality and security gates | QA + Security | 3d | P1 | P07-003 | Regression checks in CI | CI reports |

## 7) Validation and Test Strategy
### 7.1 Unit
- Required unit coverage: Attachment validators, MIME checks, canonical mapping.

### 7.2 Integration
- Required integration scenarios: Attachment intake -> canonicalization -> router -> provider call.

### 7.3 End-to-End
- Required e2e scenarios: Valid image request, valid PDF request, unsupported type rejection.

### 7.4 Negative and Failure Path Testing
- Required failure scenarios: Corrupt file, oversized media, provider capability mismatch.

### 7.5 CI Quality Gates
- Required checks: Media validation suite, multimodal quality set, security misuse tests.

## 8) Observability and Metrics
### 8.1 Required Instrumentation
- Logs: Media validation outcomes and routing decisions.
- Metrics: Multimodal latency, failure rates, payload distribution, cost per request.
- Traces: Media parse and provider inference spans.
- Events: Attachment rejected, multimodal fallback, provider mismatch.

### 8.2 SLO/SLA Targets
- Latency targets: Multimodal P95 <= 4.5s (initial target).
- Error rate targets: Multimodal server-side errors <= 2%.
- Cost targets: Per-request multimodal cost within defined budget caps.

### 8.3 Alerting and Dashboards
- Alerts required: Multimodal error spike, payload reject spike, cost anomaly.
- Dashboard panels required: Multimodal request mix, quality indicators, provider health.

## 9) Security and Policy Checks
### 9.1 Threats Introduced by This Scope
- Threat: Malicious media payloads and unsafe parser behavior.

### 9.2 Required Controls
- Control: Strict media type/size validation and safe parsing strategy.

### 9.3 Security Validation
- Static analysis: Parser dependency and vulnerability checks.
- Runtime checks: Type/size enforcement and suspicious payload detection.
- Abuse/misuse tests: Malformed media, zip-bomb-like payload behavior.

### 9.4 Audit Artifacts
- Required artifacts: Media policy docs, security test results, rollout approvals.

## 10) Rollout Strategy
### 10.1 Feature Flags
- Flag name: `multimodal.pipeline_enabled`
- Default state: false
- Rollout criteria: Staging quality/security gates pass.

### 10.2 Environment Progression
- Dev -> Staging -> Production path: Internal and limited media size first.

### 10.3 Canary/Cohort Plan
- Cohort definition: Internal testers and selected opt-in clients.
- Success criteria: Error, quality, and cost metrics within thresholds.

### 10.4 Kill Switch and Rollback
- Trigger conditions: Security concern, high failure rate, cost spike.
- Rollback steps: Disable multimodal flag and route all traffic to text path.

## 11) Operational Readiness
### 11.1 Runbook Changes
- Runbook updates required: Media parse failures, provider mismatch, cost anomalies.

### 11.2 On-Call Readiness
- Alert owner: Runtime/Gateway on-call.
- Escalation path: Runtime -> Security -> Platform.

### 11.3 Support Handoff
- Documentation handoff: Multimodal limits and troubleshooting guide.
- Training handoff: Support training for common attachment failures.

## 12) Acceptance Criteria (Final Gate)
### 12.1 Functional Acceptance
- Criterion: Supported multimodal requests are processed and routed correctly.

### 12.2 Non-Functional Acceptance
- Criterion: Multimodal SLO and cost targets met in canary.

### 12.3 Security/Compliance Acceptance
- Criterion: Media handling controls and abuse tests pass.

### 12.4 Documentation Acceptance
- Criterion: Multimodal API and runbook docs completed.

## 13) Post-Implementation Review
### 13.1 Review Date
- Date: 30 days after multimodal canary rollout.

### 13.2 Success Metrics Review
- Metrics reviewed: Quality, latency, reject rates, incident count.
- Outcome: To be filled.

### 13.3 Deferred Work
- Follow-up task: Advanced multimodal reasoning strategy tuning.
- Target phase: Future expansion cycle.

---

## 14) Quick-Start Duplication Checklist
- Copy this template into `<PLAN_NAME>_PLAN.md`.
- Fill sections 0-4 first before tasking.
- Populate Phase 0-4 entry/exit criteria before assigning owners.
- Add task IDs and dependencies in section 6.
- Define objective acceptance criteria in section 12 before starting implementation.
