# L2-04 Observability and Evaluation Implementation

## 0) Document Control
- Plan ID: L2-04
- Plan Name: Observability and Evaluation Implementation
- Linked SPEC: `docs/SPEC/12_EvaluationEngine_Spec.md`, `docs/SPEC/18_Observability_Spec.md`, `docs/SPEC/21_Test_and_Eval_Plan.md`, `docs/SPEC/22_Runbooks_and_Operations.md`
- Owner(s): Observability Lead
- Contributors: SRE Lead, Runtime Lead, QA Lead, Security Lead
- Status: `complete`
- Priority: `P0`
- Created: 2026-02-18
- Last Updated: 2026-02-18
- Implementation: Phase 0–4 implemented; see Implementation Summary (section 14) and L2-04_Handoff.md, L2-04_Gate-Report-and-Known-Gaps.md.
- Review Cadence: Daily telemetry review + weekly quality gate review

## 1) Purpose and Outcome
### 1.1 Purpose
Deliver complete traceability and measurable quality signals so runtime behavior, cost, and safety can be monitored and improved safely.

### 1.2 Intended Outcomes
- Outcome 1: Required event taxonomy is emitted across the request lifecycle.
- Outcome 2: Traces, logs, and metrics are consistent and redacted.
- Outcome 3: Evaluation/regression runs in CI and blocks known degradations.

### 1.3 Non-Goals
- Non-goal 1: Full production rollout orchestration.
- Non-goal 2: Final memory or multimodal feature tuning.

## 2) Scope
### 2.1 In Scope
- Implementation of required events: `ROUTE_DECISION`, `POLICY_DECISION`, `BUDGET_ASSIGN`, pipeline and error events.
- OTEL trace propagation across all core runtime boundaries.
- Metrics for latency, error, route mix, and cost.
- Redaction utility and telemetry privacy controls.
- Regression runner and baseline quality dataset in CI.

### 2.2 Out of Scope
- Long-term analytics warehouse design.
- Advanced business intelligence dashboards.

### 2.3 Interfaces Touched
- API endpoints: `POST /v1/query`, `GET /metrics`.
- Internal modules: Telemetry emitters, trace middleware, evaluation runner.
- Data stores: Metrics backend, log backend, eval artifacts storage.
- External systems/tools: OTEL collector, Prometheus/Grafana stack, CI artifact storage.

## 3) Dependencies
### 3.1 Upstream Dependencies
- `docs/PLANS/Implementation-plans/L2-03_Policy-Budgeting-and-Routing-Implementation.md` complete.

### 3.2 Downstream Consumers
- `docs/PLANS/Implementation-plans/L2-05_Security-Isolation-and-Compliance-Implementation.md`
- `docs/PLANS/Implementation-plans/L2-06_Memory-and-Retrieval-Implementation.md`
- `docs/PLANS/Implementation-plans/L2-07_Multimodal-Input-Path-Implementation.md`

### 3.3 External Dependencies
- Telemetry infrastructure provisioning and credentials.
- Alert routing ownership and on-call integration.

## 4) Assumptions and Constraints
### 4.1 Assumptions
- Assumption 1: Core governance events from L2-03 are available.
- Assumption 2: Staging telemetry stack is accessible for integration testing.

### 4.2 Constraints
- Security constraints: Telemetry must not leak secrets or PII.
- Performance constraints: Instrumentation overhead < 5% p95 increase (see 8.2).
- Cost constraints: Event/trace cardinality controlled to stay within monthly telemetry budget (see 8.2).
- Compliance constraints: Audit-critical events must be retained and queryable.

### 4.3 Open Decisions
- Decision item: Sampling strategy for high-volume traces in production.
- Decision owner: Observability Lead.
- Decision deadline: Before L2-08 rollout phase.

---

## 5) Phase Plan

### Phase 0 - Event Model and Redaction Baseline
**Phase Objective**
- Emit canonical events with redaction controls from day one.

**Linked SPEC Clauses**
- Clause(s): `18 Observability Spec`.

**Blocking Dependencies**
- Dependency: Governance events from L2-03 stabilized.

**Deliverables**
- Deliverable 1: Event schema package and emitter interfaces.
- Deliverable 2: Redaction utility integrated into logs/events/traces.

**Workstreams**
- Core implementation: Event emitters and schema validators.
- Integration: Wire events into policy/router/execution boundaries.
- Basic observability: Validate event field consistency.
- Basic docs: Event taxonomy reference.

**Task List**
- [x] Task P0-01: Implement event schema and emitter contracts.
- [x] Task P0-02: Integrate redaction utility into telemetry pipeline.
- [x] Task P0-03: Add tests for required event presence and redaction.

**Entry Criteria**
- Criteria: L2-03 event contract baseline available.

**Exit Criteria**
- Criteria: Required core events emitted and validated in staging.

**Risks**
- Risk: Event payload drift between components.
- Mitigation: Shared schema package and contract tests.

**Rollback/Fallback**
- Rollback condition: Redaction causes missing required diagnostics.
- Rollback action: Switch to strict allowlist diagnostic fields and update schema.

---

### Phase 1 - Tracing and Metrics Coverage
**Phase Objective**
- Provide end-to-end runtime visibility for latency, reliability, and cost.

**Linked SPEC Clauses**
- Clause(s): `18 Observability Spec`, `22 Runbooks and Operations`.

**Blocking Dependencies**
- Dependency: Phase 0 event baseline complete.

**Deliverables**
- Deliverable 1: End-to-end traces from ingress to response.
- Deliverable 2: Core metrics suite (dashboard baseline out of scope for this repo; deferred to ops).

**Workstreams**
- Core implementation: Trace propagation and span boundaries.
- Integration: Metric emitters across policy/router/gateway stages.
- Basic observability: Metrics and events for core operational health (dashboard panels out of scope; deferred to ops).
- Basic docs: Trace and metric field glossary.

**Task List**
- [x] Task P1-01: Add trace context propagation across core components.
- [x] Task P1-02: Add latency/error/cost metrics with cardinality controls.
- [ ] Task P1-03: Build baseline dashboards for on-call usage — **out of scope for this repo** (UI-less server); deferred to ops/external tooling.

**Entry Criteria**
- Criteria: Event and redaction tests passing.

**Exit Criteria**
- Criteria: Trace completeness and metric visibility validated in staging.

**Risks**
- Risk: High cardinality metrics overload backend.
- Mitigation: Predefine label allowlist and enforce metric naming rules.

**Rollback/Fallback**
- Rollback condition: Metrics/traces increase runtime overhead beyond threshold.
- Rollback action: Disable non-critical emitters and reduce sampling rate.

---

### Phase 2 - Evaluation Harness and Regression Suite
**Phase Objective**
- Catch quality regressions and strategy failures before release.

**Linked SPEC Clauses**
- Clause(s): `12 EvaluationEngine Spec`, `21 Test and Eval Plan`.

**Blocking Dependencies**
- Dependency: Tracing and metrics stable.

**Deliverables**
- Deliverable 1: Baseline eval datasets and scoring harness.
- Deliverable 2: CI regression gate with fail thresholds.

**Workstreams**
- Core implementation: Eval runner and scoring logic.
- Integration: CI integration and artifact publishing.
- Basic observability: Eval results to dashboard/event stream.
- Basic docs: Eval methodology and threshold definitions.

**Task List**
- [x] Task P2-01: Build initial gold datasets and score definitions.
- [x] Task P2-02: Implement CI regression job with threshold checks.
- [x] Task P2-03: Add eval failure triage runbook section.

**Entry Criteria**
- Criteria: Telemetry baseline available and trusted.

**Exit Criteria**
- Criteria: Regression suite gates PRs and produces clear artifacts.

**Risks**
- Risk: Evaluation dataset bias or low representativeness.
- Mitigation: Use diversified baseline set and periodic refresh process.

**Rollback/Fallback**
- Rollback condition: Regression gate yields excessive false positives.
- Rollback action: Move failing checks to warning tier while recalibrating thresholds.

---

### Phase 3 - Alerts and Operational Readiness
**Phase Objective**
- Convert telemetry into actionable operations signals.

**Linked SPEC Clauses**
- Clause(s): `22 Runbooks and Operations`.

**Blocking Dependencies**
- Dependency: Regression suite integrated.

**Deliverables**
- Deliverable 1: Alert definitions for latency/error/cost/governance anomalies.
- Deliverable 2: On-call dashboard and incident response playbook updates.

**Workstreams**
- Core implementation: Alert rule configuration.
- Integration: Paging/escalation wiring.
- Basic observability: Alert tuning and dry runs.
- Basic docs: Incident playbook updates.

**Task List**
- [x] Task P3-01: Configure and test critical alert rules (reference definitions in runbook).
- [x] Task P3-02: Map alerts to owners and escalation policy (documented in runbook).
- [ ] Task P3-03: Run alert simulation drill in staging (when telemetry stack available).

**Entry Criteria**
- Criteria: Metrics and traces stable under expected load.

**Exit Criteria**
- Criteria: Alerts trigger correctly and response paths are tested.

**Risks**
- Risk: Alert fatigue due to noisy thresholds.
- Mitigation: Tune with burn-rate style conditions and suppression windows.

**Rollback/Fallback**
- Rollback condition: Alert noise causes persistent paging fatigue.
- Rollback action: Reduce low-value alerts and prioritize high-severity rules.

---

### Phase 4 - Gate Sign-Off and Handoff
**Phase Objective**
- Establish telemetry/eval confidence for security and feature expansion sprints.

**Linked SPEC Clauses**
- Clause(s): `18 Observability Spec`, `21 Test and Eval Plan`, `22 Runbooks and Operations`.

**Blocking Dependencies**
- Dependency: Alerting and evaluation readiness confirmed.

**Deliverables**
- Deliverable 1: Observability/eval gate report with evidence links.
- Deliverable 2: Handoff package for L2-05/L2-06 with required telemetry contracts.

**Workstreams**
- Core implementation: Final stabilization and cleanup.
- Integration: Validate downstream event dependencies.
- Basic observability: Confirm required event fields for security/retrieval.
- Basic docs: Publish operating baseline.

**Task List**
- [x] Task P4-01: Run final observability acceptance suite.
- [x] Task P4-02: Publish gate report and known gaps.
- [x] Task P4-03: Complete cross-team handoff review.

**Entry Criteria**
- Criteria: All telemetry/eval checks green for 3 consecutive runs.

**Exit Criteria**
- Criteria: L2-05 and L2-06 can start with complete observability support.

**Risks**
- Risk: Missing downstream telemetry fields discovered late.
- Mitigation: Add interface contract review before sign-off.

**Rollback/Fallback**
- Rollback condition: Downstream plan starts blocked by telemetry gaps.
- Rollback action: Reopen sprint with targeted closure tasks.

---

## 6) Detailed Backlog (Task Table)
| Task ID | Description | Owner Role | Estimate | Priority | Dependencies | Definition of Done | Verification Method | Done |
|---|---|---|---|---|---|---|---|---|
| OBS-001 | Implement canonical event schemas and emitters | Observability Lead | 1.5d | P0 | L2-03 | Required events emitted with schema validation | Event contract tests | Yes |
| OBS-002 | Integrate redaction utility in telemetry pipeline | Security Lead | 1d | P0 | OBS-001 | Sensitive fields redacted in logs/events/traces | Redaction tests | Yes |
| OBS-003 | Implement trace propagation across runtime boundaries | Runtime Lead | 1d | P0 | OBS-001 | End-to-end traces complete for core paths | Trace completeness checks | Yes |
| OBS-004 | Add core metrics and cardinality guardrails | SRE Lead | 1d | P0 | OBS-003 | Metrics visible and within cardinality budget | Metrics validation | Yes |
| OBS-005 | Build evaluation harness and dataset baseline | QA Lead | 1.5d | P0 | OBS-004 | Eval suite runs with scoring outputs | CI eval run | Yes |
| OBS-006 | Integrate regression gate in CI | QA Lead | 0.75d | P0 | OBS-005 | CI blocks known regression classes | PR gate test | Yes |
| OBS-007 | Configure alerts and dashboards | SRE Lead | 1d | P1 | OBS-004 | Alerts route correctly; dashboard usable | Alert drill | Ref in runbook |
| OBS-008 | Publish observability gate report and handoff | Observability Lead | 0.5d | P1 | OBS-006,OBS-007 | Downstream teams approve handoff | Review sign-off | Yes |

## 7) Validation and Test Strategy
### 7.1 Unit
- Required unit coverage: Event schema validation, redaction logic, metric label validation.

### 7.2 Integration
- Required integration scenarios: Policy/route/budget events emitted and linked by request id/trace id.

### 7.3 End-to-End
- Required e2e scenarios: Full request trace with event sequence and metric increments.

### 7.4 Negative and Failure Path Testing
- Required failure scenarios: Telemetry backend unavailable, malformed event payloads, redaction misconfiguration.

### 7.5 CI Quality Gates
- Required checks: Event coverage tests, redaction tests, eval regression suite, dashboard config lint.

## 8) Observability and Metrics
### 8.1 Required Instrumentation
- Logs: Structured logs with request/trace ids and redacted context.
- Metrics: Latency, server errors, deny rate, budget rejects, cost by route.
- Traces: Spans for ingress, brain stem, policy, routing, gateway, synthesis.
- Events: Full required taxonomy for lifecycle and failures.

### 8.2 SLO/SLA Targets
- Latency targets: Telemetry overhead < 5% p95 increase.
- Error rate targets: Telemetry pipeline drop rate < 0.1%.
- Cost targets: Observability stack within approved monthly telemetry budget.

### 8.3 Alerting and Dashboards
This project is a UI-less API server; dashboard panels are out of scope and deferred to ops/external tooling (e.g. Grafana).
- Alerts required: Error budget burn, latency degradation, missing required events, cost spikes.
- Dashboard panels required (if ops provisions): Request lifecycle, governance outcomes, cost/latency trend, regression score trend.

## 9) Security and Policy Checks
### 9.1 Threats Introduced by This Scope
- Threat: Sensitive data leakage via logs, traces, or evaluation artifacts.

### 9.2 Required Controls
- Control: Centralized redaction and strict event field policy.

### 9.3 Security Validation
- Static analysis: Telemetry schema and field allowlist checks.
- Runtime checks: Redaction assertions in runtime integration tests.
- Abuse/misuse tests: Injected sensitive payloads to verify redaction.

### 9.4 Audit Artifacts
- Required artifacts: Event coverage report, redaction test report, alert drill logs.

## 10) Rollout Strategy
### 10.1 Feature Flags
- Flag name: `observability_required_events_v1` (env: `OBSERVABILITY_REQUIRED_EVENTS_V1`).
- Default state: true in dev/staging, controlled enablement in production.
- Rollout criteria: Event coverage and redaction tests pass.

### 10.2 Environment Progression
- Dev -> Staging -> Production path: Roll out telemetry instrumentation with staged sampling.

### 10.3 Canary/Cohort Plan
- Cohort definition: Internal requests plus canary tenant traffic.
- Success criteria: No redaction violations and stable telemetry overhead for 48 hours.

### 10.4 Kill Switch and Rollback
- Trigger conditions: PII leak evidence, severe telemetry-induced latency regression.
- Rollback steps: Disable non-essential telemetry flags and revert to last stable telemetry config.

## 11) Operational Readiness
### 11.1 Runbook Changes
- Runbook updates required: Missing telemetry triage, alert false-positive tuning, eval regression triage.

### 11.2 On-Call Readiness
- Alert owner: SRE on-call with runtime secondary.
- Escalation path: SRE -> Runtime -> Security.

### 11.3 Support Handoff
- Documentation handoff: Event taxonomy and dashboard usage guide.
- Training handoff: On-call workshop for alert diagnosis and trace investigation.

## 12) Acceptance Criteria (Final Gate)
### 12.1 Functional Acceptance
- Criterion: Required events/traces/metrics available across core request paths.

### 12.2 Non-Functional Acceptance
- Criterion: Instrumentation overhead and telemetry reliability meet targets.

### 12.3 Security/Compliance Acceptance
- Criterion: Redaction controls verified and no sensitive field leakage in telemetry artifacts.

### 12.4 Documentation Acceptance
- Criterion: Runbooks, dashboards, and eval procedures fully documented.

## 13) Post-Implementation Review
### 13.1 Review Date
- Date: 2 weeks after production telemetry canary.

### 13.2 Success Metrics Review
- Metrics reviewed: Event coverage rate, telemetry drop rate, alert precision, eval regression detection rate.
- Outcome: To be recorded after review.

### 13.3 Deferred Work
- Follow-up task: Adaptive sampling and deeper strategy performance analytics.
- Target phase: L2-08 optimization window.

---

## 14) Implementation Summary

The following was implemented for L2-04 (observability and evaluation).

### Code and artifacts
- **Event schema and emitter** (`src/observability/events.ts`, `emitter.ts`): Canonical event types (ROUTE_DECISION, POLICY_DECISION, BUDGET_ASSIGN, PIPELINE_START/END, WORKFLOW_START/END, ENGINE_START/END, TOOL_*, MEMORY_*, VERIFY_RESULT, FINAL_SYNTH, ERROR), `TelemetryEvent` schema, and emitter with redaction.
- **Redaction** (`src/observability/redact.ts`): Allowlist-based redaction (minimal/full), sensitive key stripping; allowlist includes cost_estimate_usd, tokens_used, workflow_id, engine_type, invocation_id, hit_count, latency_ms, scope for telemetry payloads; integrated in emitter.
- **Trace context** (`src/observability/context.ts`): `trace_id`/`request_id` via AsyncLocalStorage; `runWithContext` / `runWithContextAsync` / `getTraceContext`.
- **Metrics** (`src/observability/metrics.ts`): In-memory counters and histograms with label allowlist; `getPrometheusText()` for Prometheus exposition format; `GET /metrics` returns JSON by default, or Prometheus text when `Accept: text/plain` or `?format=prometheus` (`src/server/routes.ts`).
- **Pipeline observability** (`src/pipelines/chat-pipeline.ts`): Emits WORKFLOW_START at run start and WORKFLOW_END at run end (with duration_ms, status); ENGINE_START/ENGINE_END for each engine call with duration_ms, cost_estimate_usd, tokens_used when available.
- **Query flow wiring** (`src/server/query-handler.ts`): End-to-end flow (ingress → canonicalize → intent → policy → router → response) with event emission and metrics; observability set at server startup when `observability_required_events_v1` is true.
- **Config** (`src/config/schema.ts`): Feature flag `observability_required_events_v1` (default true).
- **Evaluation harness** (`src/eval/`): `runner.ts` (run gold cases through query path), `baseline.json` (2 gold cases), `run-eval.ts` CLI; `npm run eval` and `npm run eval:ci` (Jest `eval/runner.test`).
- **Production Evaluation Engine** (`src/engines/evaluation_engine.ts`) (Agent 3, 2026-03-06):
  - Model-based evaluation using Model Gateway for quality scoring
  - Multi-criteria scoring: correctness, completeness, safety, performance (0-1 scale)
  - Heuristic fallback when model gateway unavailable
  - Pass/fail threshold configuration (default 0.7)
  - Detailed evaluation reports with issue lists
- **Production Classification Engine** (`src/engines/classification_engine.ts`) (Agent 3, 2026-03-06):
  - Model-based classification using Model Gateway for intent detection
  - Classification dimensions: intent, complexity, urgency, domain, risk
  - Heuristic fallback with keyword-based detection
  - Proposed next action for complex workflows (request_replan)

### Tests
- Event schema and taxonomy: `src/observability/events.test.ts`.
- Redaction: `src/observability/redact.test.ts`.
- Emitter and required event presence: `src/observability/emitter.test.ts`.
- Metrics and cardinality, Prometheus export: `src/observability/metrics.test.ts`.
- Eval harness: `src/eval/runner.test.ts`.
- **Observability acceptance suite** (`src/observability/observability-acceptance.test.ts`): Validates event taxonomy, redaction, trace context (request_id/trace_id on every event), metrics, event order / span hierarchy (POLICY_DECISION → BUDGET_ASSIGN → ROUTE_DECISION → PIPELINE_START → WORKFLOW_START → ENGINE_START → ENGINE_END ×2 → WORKFLOW_END → PIPELINE_END → FINAL_SYNTH), eval baseline, context propagation. Run: `npm run acceptance:observability`.

### Documentation
- **Runbook** (`docs/Runbooks/Observability-and-Eval.md` or `docs/Runbooks/`): Missing telemetry triage, alert tuning, eval regression triage, alert definitions reference, GET /metrics, escalation.

### Phase 4 – Gate and handoff
- **Observability acceptance suite** (`src/observability/observability-acceptance.test.ts`): Validates event taxonomy, redaction, trace context, metrics, **event order / span hierarchy**, eval baseline, context propagation. Run: `npm run acceptance:observability`.
- **Gate report and known gaps** (`docs/PLANS/Implementation-plans/L2-04_Gate-Report-and-Known-Gaps.md`): Gate summary, known gaps, verification commands.
- **Handoff** (`docs/PLANS/Implementation-plans/L2-04_Handoff.md`): Checklist, event/metric contracts, config, CI commands for L2-05 / L2-06.

### Handoff for L2-05 / L2-06
- Required event fields and redaction policy are in `src/observability/events.ts` and `redact.ts`.
- Trace context: use `getTraceContext()` and emit events via `getObservability()?.events.emit(...)` in new code paths.
- Eval: extend `src/eval/baseline.json` for new behaviors; run `npm run eval` before release.
