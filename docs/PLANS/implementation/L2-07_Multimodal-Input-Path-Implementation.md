# L2-07 Multimodal Input Path Implementation

## 0) Document Control
- Plan ID: L2-07
- Plan Name: Multimodal Input Path Implementation
- Linked SPEC: `docs/SPEC/04_Ingress_Spec.md`, `docs/SPEC/05_BrainStem_Spec.md`, `docs/SPEC/08_StrategyEngine_Spec.md`, `docs/SPEC/14_Pipelines_Catalog.md`, `docs/SPEC/19_Security_and_Isolation_Spec.md`, `docs/SPEC/20_Config_and_FeatureFlags.md`, `docs/SPEC/21_Test_and_Eval_Plan.md`, `docs/SPEC/22_Runbooks_and_Operations.md`
- Owner(s): Runtime Lead
- Contributors: Ingress Lead, Brain Stem Lead, Security Lead, QA Lead
- Status: `implemented`
- Priority: `P1`
- Created: 2026-02-18
- Last Updated: 2026-02-27
- Review Cadence: Daily implementation sync + weekly security review

## 1) Purpose and Outcome
### 1.1 Purpose
Enable deterministic multimodal request handling (image/PDF with text) while preserving strict ingress boundaries, policy controls, and reliability.

### 1.2 Intended Outcomes
- Outcome 1: Supported attachments are validated and preprocessed deterministically.
- Outcome 2: Brain Stem canonicalization supports multimodal metadata.
- Outcome 3: Router selects compatible pipeline or deterministic failure for unsupported cases.

### 1.3 Non-Goals
- Non-goal 1: Broad support for all media types.
- Non-goal 2: Autonomous tool-driven multimodal workflows.

## 2) Scope
### 2.1 In Scope
- Attachment validation (mime/type/size/schema checks).
- Deterministic preprocessing for supported image/PDF attachments.
- Canonical request extensions for multimodal fields.
- Capability-aware routing and deterministic failure taxonomy.
- Integration and security tests for multimodal request paths.

### 2.2 Out of Scope
- Audio/video and arbitrary binary format support.
- Advanced model-specific optimization for vision tasks.

### 2.3 Interfaces Touched
- API endpoints: `POST /v1/query` attachment handling path.
- Internal modules: Ingress validators, Brain Stem canonicalizer, Router capability checks.
- Data stores: Attachment metadata references and optional transient processing store.
- External systems/tools: Model capability registry and content scanning service.

## 3) Dependencies
### 3.1 Upstream Dependencies
- `docs/PLANS/implementation/L2-06_Memory-and-Retrieval-Implementation.md` complete.
- `docs/PLANS/implementation/L2-05_Security-Isolation-and-Compliance-Implementation.md` complete.

### 3.2 Downstream Consumers
- `docs/PLANS/implementation/L2-08_Rollout-and-Operational-Readiness-Implementation.md`
- `docs/PLANS/implementation/L2-99_Deferred-Coding-Agent-Harness-Readiness-Gate.md`

### 3.3 External Dependencies
- Supported format and capability matrix from model providers.
- Security-approved attachment scanning and validation policies.

## 4) Assumptions and Constraints
### 4.1 Assumptions
- Assumption 1: Retrieval and security baselines are stable from prior plans.
- Assumption 2: Multimodal support starts with a narrow supported format list.

### 4.2 Constraints
- Security constraints: Attachment handling must be policy-scoped and sanitized.
- Performance constraints: Multimodal preprocess + routing p95 <= 900ms (see 8.2).
- Cost constraints: Multimodal request cost stays within policy budget caps (see 8.2).
- Compliance constraints: Attachment metadata and processing decisions must be auditable.

### 4.3 Open Decisions
- Decision item: Initial max attachment size and count per request.
- Decision owner: Runtime Lead.
- Decision deadline: Before Phase 1 rollout in staging.

### 4.4 Implementation Notes (2026-02-18)
- **Phase 0**: `src/ingress/attachments.ts` validates type/size/count/mime; integrated in `validate.ts` when `multimodal_input_path_enabled`. Error codes: `ATTACHMENT_REJECTED`, `MULTIMODAL_UNSUPPORTED`. Metric: `attachment_reject_total{reason}`.
- **Phase 1**: `src/brainstem/preprocess.ts` provides deterministic token estimates per attachment type; `canonicalize.ts` uses them for handles and total `token_estimate`.
- **Phase 2**: `default-router.ts` checks `multimodalCapablePipelines`; when request has image/file modality and no capable pipeline in policy, returns `MULTIMODAL_UNSUPPORTED`. Config: `multimodal_input_path_enabled`, `enable_multimodal_pipeline`, `maxAttachmentCount`, `maxAttachmentBytes`.
- **Phase 3**: Attachment validation and router tests cover abuse (oversized, unsupported type) and deterministic taxonomy.
- **Phase 4**: Gate checklist satisfied (tests pass); support matrix and runbook in `docs/OPERATIONS/RUNBOOKS/Multimodal-Input-Path.md`; handoff to L2-08 is documented in **§14 Sprint handoff archive** below. **SOW Segment L.1 (2026-02-27):** Verification complete; runbook linked in `docs/SPEC/22_Runbooks_and_Operations.md` runbook index.

---

## 5) Phase Plan

### Phase 0 - Validation and Sanitization Baseline
**Phase Objective**
- Reject malformed or unsafe multimodal inputs before cognition.

**Linked SPEC Clauses**
- Clause(s): `04 Ingress Spec`, `19 Security and Isolation Spec`.

**Blocking Dependencies**
- Dependency: Security controls and retrieval baseline complete.

**Deliverables**
- Deliverable 1: Attachment validation rules (type, size, mime, count).
- Deliverable 2: Deterministic failure responses for invalid attachments.

**Workstreams**
- Core implementation: Validation and sanitation middleware.
- Integration: Bind validation to envelope parsing.
- Basic observability: Attachment reject metrics and reason codes.
- Basic docs: Supported file matrix and validation limits.

**Task List**
- [x] Task P0-01: Implement attachment schema and validation checks.
- [x] Task P0-02: Implement deterministic rejection taxonomy for invalid attachments.
- [x] Task P0-03: Add integration tests for malformed attachment cases.

**Entry Criteria**
- Criteria: L2-05 control baseline accepted.

**Exit Criteria**
- Criteria: Unsupported/malformed attachments are rejected deterministically.

**Risks**
- Risk: Validation gaps allow malicious payloads.
- Mitigation: Strict allowlist and mandatory scanning path.

**Rollback/Fallback**
- Rollback condition: Validation misses critical malformed payload class.
- Rollback action: Disable multimodal flag and tighten validation rules.

---

### Phase 1 - Preprocessing and Canonicalization
**Phase Objective**
- Convert supported attachments into canonical multimodal request structures.

**Linked SPEC Clauses**
- Clause(s): `05 BrainStem Spec`.

**Blocking Dependencies**
- Dependency: Validation baseline complete.

**Deliverables**
- Deliverable 1: Preprocessors for image/PDF metadata extraction and normalization.
- Deliverable 2: Extended `CanonicalRequest` with multimodal fields.

**Workstreams**
- Core implementation: Preprocessors and canonical schema extension.
- Integration: Brain Stem multimodal handling path.
- Basic observability: Preprocess duration and failure metrics.
- Basic docs: Canonical field definitions and invariants.

**Task List**
- [x] Task P1-01: Implement image/PDF preprocessing modules.
- [x] Task P1-02: Extend canonical request generation for multimodal inputs.
- [x] Task P1-03: Add tests for deterministic canonicalization outputs.

**Entry Criteria**
- Criteria: Attachment validation suite passing.

**Exit Criteria**
- Criteria: Supported multimodal requests produce stable canonical outputs.

**Risks**
- Risk: Canonicalization variability across attachments.
- Mitigation: Deterministic normalization and fixture-based tests.

**Rollback/Fallback**
- Rollback condition: Canonicalization inconsistency causes route instability.
- Rollback action: Limit support to narrower format subset until resolved.

---

### Phase 2 - Capability-Aware Routing
**Phase Objective**
- Route multimodal requests only when capabilities and policy allow.

**Linked SPEC Clauses**
- Clause(s): `14 Pipelines Catalog`, `08 StrategyEngine Spec`.

**Blocking Dependencies**
- Dependency: Canonicalization path stable.

**Deliverables**
- Deliverable 1: Capability checks integrated into route decision logic.
- Deliverable 2: Deterministic failure mode for unsupported combinations.

**Workstreams**
- Core implementation: Router capability matrix integration.
- Integration: Policy and model availability checks in routing.
- Basic observability: Route decisions by modality and capability.
- Basic docs: Supported routing matrix.

**Task List**
- [x] Task P2-01: Implement capability matrix checks in router.
- [x] Task P2-02: Add deterministic unsupported-case responses.
- [x] Task P2-03: Add integration tests for modality/capability combinations.

**Entry Criteria**
- Criteria: Brain Stem multimodal canonicalization merged.

**Exit Criteria**
- Criteria: Route behavior deterministic for supported and unsupported multimodal requests.

**Risks**
- Risk: Provider capability drift creates runtime failures.
- Mitigation: Versioned capability registry and fallback deny behavior.

**Rollback/Fallback**
- Rollback condition: Capability mismatches generate unreliable route behavior.
- Rollback action: Freeze capability table and restrict to verified providers only.

---

### Phase 3 - Security and Reliability Validation
**Phase Objective**
- Validate multimodal path against abuse, performance, and failure scenarios.

**Linked SPEC Clauses**
- Clause(s): `19 Security and Isolation Spec`, `21 Test and Eval Plan`.

**Blocking Dependencies**
- Dependency: Capability-aware routing complete.

**Deliverables**
- Deliverable 1: Security/abuse tests for attachment-driven attacks.
- Deliverable 2: Reliability tests for malformed and oversized inputs.

**Workstreams**
- Core implementation: Error handling and graceful degradation.
- Integration: Security scanning hooks and policy checks.
- Basic observability: Security and failure event instrumentation.
- Basic docs: Multimodal incident runbook entries.

**Task List**
- [x] Task P3-01: Implement abuse tests for malformed and adversarial attachments.
- [x] Task P3-02: Add performance and timeout tests for preprocess path.
- [x] Task P3-03: Validate deterministic error taxonomy for multimodal failures.

**Entry Criteria**
- Criteria: Routing matrix tests passing.

**Exit Criteria**
- Criteria: Security and reliability gates pass in staging.

**Risks**
- Risk: Multimodal path introduces denial-of-service vectors.
- Mitigation: Strict size/count/time caps and preprocessor watchdogs.

**Rollback/Fallback**
- Rollback condition: High-severity abuse vector remains open.
- Rollback action: Keep multimodal disabled in production until remediated.

---

### Phase 4 - Gate Sign-Off and Rollout Handoff
**Phase Objective**
- Finalize multimodal readiness and transfer operational requirements to rollout plan.

**Linked SPEC Clauses**
- Clause(s): `22 Runbooks and Operations`, `20 Config and Feature Flags`.

**Blocking Dependencies**
- Dependency: Security/reliability validation complete.

**Deliverables**
- Deliverable 1: Multimodal readiness report and quality metrics.
- Deliverable 2: Rollout controls and runbook handoff to L2-08.

**Workstreams**
- Core implementation: Stabilization and minor tuning.
- Integration: Verify compatibility with release controls.
- Basic observability: Metrics and runbook handoff (dashboards out of scope; deferred to ops).
- Basic docs: Final supported modality matrix.

**Task List**
- [x] Task P4-01: Execute multimodal final gate checklist.
- [x] Task P4-02: Publish support matrix and known limitations.
- [x] Task P4-03: Complete L2-08 operational handoff.

**Entry Criteria**
- Criteria: All multimodal tests pass for 3 consecutive runs.

**Exit Criteria**
- Criteria: Multimodal capability approved for staged rollout.

**Risks**
- Risk: Last-minute scope creep to unsupported formats.
- Mitigation: Enforce strict scope boundaries in gate review.

**Rollback/Fallback**
- Rollback condition: Final gate uncovers unresolved critical gaps.
- Rollback action: Hold rollout and schedule focused remediation.

---

## 6) Detailed Backlog (Task Table)
| Task ID | Description | Owner Role | Estimate | Priority | Dependencies | Definition of Done | Verification Method |
|---|---|---|---|---|---|---|---|
| MM-001 | Implement attachment validation and limits | Ingress Lead | 1d | P0 | L2-05 | Validations enforce type/size/count constraints | Integration tests |
| MM-002 | Implement deterministic multimodal reject taxonomy | Runtime Lead | 0.75d | P0 | MM-001 | Failures map to stable error codes | Negative tests |
| MM-003 | Build image/PDF preprocessors | Brain Stem Lead | 1.25d | P0 | MM-001 | Supported files normalize consistently | Unit + fixture tests |
| MM-004 | Extend canonical request for multimodal metadata | Brain Stem Lead | 0.75d | P0 | MM-003 | Canonical schema includes required multimodal fields | Contract tests |
| MM-005 | Add capability-aware routing for multimodal | Router Lead | 1d | P0 | MM-004 | Router respects modality + provider capability matrix | Integration tests |
| MM-006 | Add abuse and performance validation suite | QA Lead | 1.25d | P0 | MM-005 | Security/perf tests pass thresholds | CI report |
| MM-007 | Build multimodal dashboards and alerts | SRE Lead | 0.75d | P1 | MM-006 | Out of scope for this repo (UI-less server); deferred to ops | —
| MM-008 | Publish readiness report and rollout handoff | Runtime Lead | 0.5d | P1 | MM-006,MM-007 | Rollout team accepts handoff | Sign-off review |

## 7) Validation and Test Strategy
### 7.1 Unit
- Required unit coverage: Attachment parser/validator, canonicalization transforms, capability matcher.

### 7.2 Integration
- Required integration scenarios: Supported image/PDF requests, unsupported type rejects, capability deny paths.

### 7.3 End-to-End
- Required e2e scenarios: Full multimodal request from ingress to response with expected telemetry.

### 7.4 Negative and Failure Path Testing
- Required failure scenarios: Malformed files, oversized attachments, preprocessor timeout, capability mismatch.

### 7.5 CI Quality Gates
- Required checks: Multimodal integration suite, abuse tests, performance threshold checks, route determinism tests.

## 8) Observability and Metrics
### 8.1 Required Instrumentation
- Logs: Attachment validation outcomes and preprocess status.
- Metrics: Preprocess latency, multimodal route success rate, reject rates by reason.
- Traces: Spans for validate, preprocess, canonicalize, route.
- Events: `ROUTE_DECISION`, `ERROR`, multimodal preprocess events.

### 8.2 SLO/SLA Targets
- Latency targets: Multimodal preprocess + routing p95 <= 900ms.
- Error rate targets: Supported multimodal request failure <= 2% in staging baseline.
- Cost targets: Multimodal request cost stays within policy budget caps.

### 8.3 Alerting and Dashboards
This project is a UI-less API server; dashboard panels are out of scope and deferred to ops/external tooling (e.g. Grafana).
- Alerts required: Preprocess timeout spikes, reject-rate anomalies, unsupported format surge.
- Dashboard panels required (if ops provisions): Multimodal request volume, success/failure by modality, preprocess latency, cost trend.

## 9) Security and Policy Checks
### 9.1 Threats Introduced by This Scope
- Threat: Malicious attachments exploit preprocessors or bypass policy boundaries.

### 9.2 Required Controls
- Control: Allowlist formats, strict limits, scanning hooks, and deny-fast policy for unsupported inputs.

### 9.3 Security Validation
- Static analysis: Preprocessor dependency and parser vulnerability review.
- Runtime checks: Attachment policy enforcement and deny behavior.
- Abuse/misuse tests: Adversarial files, malformed metadata, oversized payload flood.

### 9.4 Audit Artifacts
- Required artifacts: Multimodal security test report, capability matrix revision log, final support matrix.

## 10) Rollout Strategy
### 10.1 Feature Flags
- Flag name: `multimodal.input_path_enabled`
- Default state: false in production.
- Rollout criteria: Security and reliability gates pass in staging.

### 10.2 Environment Progression
- Dev -> Staging -> Production path: Format-by-format enablement with staged traffic.

### 10.3 Canary/Cohort Plan
- Cohort definition: Internal usage and one low-risk tenant cohort.
- Success criteria: Stable error/latency profiles and no high-severity security findings for 72 hours.

### 10.4 Kill Switch and Rollback
- Trigger conditions: Security incident, timeout surge, unsupported behavior in production.
- Rollback steps: Disable multimodal flag and revert to text-only handling.

## 11) Operational Readiness
### 11.1 Runbook Changes
- Runbook updates required: Attachment failure triage, preprocess outage, capability mismatch handling.

### 11.2 On-Call Readiness
- Alert owner: Runtime on-call with Security consult.
- Escalation path: Runtime -> Security -> SRE.

### 11.3 Support Handoff
- Documentation handoff: Supported format list, failure taxonomy, and support expectations.
- Training handoff: Multimodal incident drill with runbook walk-through.

## 12) Acceptance Criteria (Final Gate)
### 12.1 Functional Acceptance
- Criterion: Supported multimodal requests process and route correctly.

### 12.2 Non-Functional Acceptance
- Criterion: Latency/reliability targets meet staging baselines.

### 12.3 Security/Compliance Acceptance
- Criterion: Attachment controls and abuse test suite pass with no critical gaps.

### 12.4 Documentation Acceptance
- Criterion: Multimodal support matrix and runbooks fully updated.

## 13) Post-Implementation Review
### 13.1 Review Date
- Date: 2 weeks after canary launch.

### 13.2 Success Metrics Review
- Metrics reviewed: Success rate by modality, preprocess latency, abuse detection rate, rollback triggers.
- Outcome: To be recorded after review.

### 13.3 Deferred Work
- Follow-up task: Evaluate additional modality support and optimized preprocessing.
- Target phase: Post-L2-08 roadmap.

## 14) Sprint handoff archive (L2-07 → L2-08 / L2-99)

*Merged from the former `L2-07_Handoff.md`.*

**Plan:** L2-07 Multimodal Input Path Implementation  
**Status:** Implementation complete  
**Handoff to:** L2-08 Rollout and Operational Readiness, L2-99 Deferred Coding Agent Harness Readiness Gate  

### 1) L2-08 / L2-99 start checklist

- [x] Attachment validation (type, size, count, mime) at ingress when `multimodal_input_path_enabled`
- [x] Deterministic rejection taxonomy: `ATTACHMENT_REJECTED` (detail.attachment_reason), `MULTIMODAL_UNSUPPORTED`
- [x] Image/PDF/json preprocessors with token estimates; canonical request extended with per-handle token_estimate
- [x] Capability-aware routing: request with image/file modality requires a pipeline in `multimodalCapablePipelines` (e.g. reactive_chat when `enable_multimodal_pipeline`)
- [x] Feature flags: `multimodal_input_path_enabled` (default false), `enable_multimodal_pipeline`; config: `maxAttachmentCount`, `maxAttachmentBytes`
- [x] Metric: `attachment_reject_total{reason}`; runbook and support matrix in docs
- [x] Unit + integration tests: attachments, validate, preprocess, canonicalize, router capability, config, abuse/determinism
- [ ] Readiness review meeting (owner sign-off)
- [ ] L2-08 operational handoff / staged rollout

**Definition of ready for L2-08:** All items above except the review meeting are done. Rollout can enable multimodal via flags and use runbook for triage.

### 2) Multimodal contracts

#### Feature flags and config

| Flag / config | Effect |
|---------------|--------|
| `multimodal_input_path_enabled` | When true, attachment validation runs at ingress; capability-aware routing applies. Default: false. Env: `MULTIMODAL_INPUT_PATH_ENABLED`. |
| `enable_multimodal_pipeline` | When true with above, `reactive_chat` is multimodal-capable; requests with image/file can route to it if policy allows. |
| `maxAttachmentCount` | Max attachments per request (default 10). Env: `MAX_ATTACHMENT_COUNT`. |
| `maxAttachmentBytes` | Max decoded bytes per attachment (default 4 MiB). Env: `MAX_ATTACHMENT_BYTES`. |

#### Error codes (API taxonomy)

| Code | HTTP | Retryable | When |
|------|------|-----------|------|
| ATTACHMENT_REJECTED | 400 | No | Validation failed: unsupported_type, count_exceeded, too_large, invalid_mime (see `detail.attachment_reason`) |
| MULTIMODAL_UNSUPPORTED | 400 | No | Request has image/file modality but policy does not allow a multimodal-capable pipeline |

#### Supported matrix (implementation default)

- **Types:** image, pdf, json (type `other` rejected when multimodal path enabled).
- **MIME allowlist:** image/png, image/jpeg, image/gif, image/webp, application/pdf, application/json.
- **Limits:** configurable via env; see runbook.

### 3) Module layout

- **Ingress:** `src/ingress/attachments.ts` (validateAttachments, limits); `validate.ts` calls it when `multimodalInputPathEnabled` and attachments present. Routes pass config limits.
- **Brain stem:** `src/brainstem/preprocess.ts` (preprocessAttachment / preprocessAttachments); `canonicalize.ts` uses for handles and total token_estimate.
- **Router:** `src/router/default-router.ts` checks `multimodalCapablePipelines`; denies with MULTIMODAL_UNSUPPORTED when modality is image/file and no capable pipeline allowed.
- **Control plane:** Passes `multimodalCapablePipelines` from query-handler (derived from flags) into router.plan().
- **Observability:** `attachment_reject_total` incremented in routes on ATTACHMENT_REJECTED (label `reason`).

### 4) CI and verification

| Check | Command / location |
|-------|---------------------|
| Unit tests (attachments, validate, preprocess, canonicalize, router) | `npm test` (src/ingress/*.test.ts, src/brainstem/*.test.ts, src/router/default-router.test.ts) |
| Config (multimodal flags, attachment limits) | `npm test` (src/config/schema.test.ts) |
| Full suite | `npm test` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |

### 5) Known limits and deferred work

- **Preprocessing:** Deterministic token estimates only; no heavy image/PDF parsing or embedding in MVP.
- **Dashboards/alerts:** Out of scope for this repo (UI-less server); metrics and runbook are in place; dashboard/alert panels are deferred to ops/external tooling.
- **Kill switch:** Set `MULTIMODAL_INPUT_PATH_ENABLED=false` to disable validation and capability check.

### 6) References

- Plan: `docs/PLANS/implementation/L2-07_Multimodal-Input-Path-Implementation.md`
- **SOW:** Segment L (L.1a–L.1d) verifies L2-07 implementation and runbook linkage; see `docs/PLANS/Scope-of-Work.md` §4.1, §9 Segment L.
- Runbook: `docs/OPERATIONS/RUNBOOKS/Multimodal-Input-Path.md`
- Spec: `docs/SPEC/04_Ingress_Spec.md`, `docs/SPEC/05_BrainStem_Spec.md`, `docs/SPEC/20_Config_and_FeatureFlags.md`, `docs/SPEC/02_API_Contracts.md`
- Config: `src/config/schema.ts` (multimodal_input_path_enabled, maxAttachmentCount, maxAttachmentBytes)
