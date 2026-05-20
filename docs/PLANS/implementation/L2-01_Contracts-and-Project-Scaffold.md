# L2-01 Contracts and Project Scaffold

## 0) Document Control
- Plan ID: L2-01
- Plan Name: Contracts and Project Scaffold
- Linked SPEC: `docs/SPEC/01_Principles_and_Invariants.md`, `docs/SPEC/02_API_Contracts.md`, `docs/SPEC/03_Component_Map.md`, `docs/SPEC/04_Ingress_Spec.md`, `docs/SPEC/05_BrainStem_Spec.md`, `docs/SPEC/20_Config_and_FeatureFlags.md`, `docs/SPEC/21_Test_and_Eval_Plan.md`
- Owner(s): Platform Lead
- Contributors: API Lead, Runtime Lead, QA Lead
- Status: `complete`
- Priority: `P0`
- Created: 2026-02-18
- Last Updated: 2026-02-26
- Review Cadence: Daily check-in + end-of-sprint gate review

## 1) Purpose and Outcome
### 1.1 Purpose
Establish the contract-first baseline for the entire AI server so downstream implementation can proceed without schema ambiguity or interface churn.

### 1.2 Intended Outcomes
- Outcome 1: External and internal canonical contracts are implemented and versioned.
- Outcome 2: Runtime scaffold mirrors the component boundaries in architecture docs.
- Outcome 3: CI quality gates (lint, type, tests) are required and deterministic.

### 1.3 Non-Goals
- Non-goal 1: End-to-end model execution path.
- Non-goal 2: Final policy/routing decisions beyond contract placeholders.

## 2) Scope
### 2.1 In Scope
- Contract definitions and validators for `RequestEnvelope`, `ResponseEnvelope`, `CanonicalRequest`, `IntentBundle`, `PolicyDecision`, `PipelinePlan`, `TypedArtifact`, `Task`, `EngineInvocation`, `EngineResult`, and `WorkflowDefinition`.
- Project scaffold for ingress, brain stem, control plane, router, gateways, pipelines, **workflows** (registry + definitions), **engines**, and observability modules.
- Baseline configuration loader and feature flag defaults.
- Baseline CI workflow and starter tests.

### 2.2 Out of Scope
- Production-grade pipeline execution logic.
- Tool execution implementation.
- Retrieval and multimodal processing implementation.

### 2.3 Interfaces Touched
- API endpoints: `POST /v1/query` contract package only.
- Internal modules: Contract schemas, configuration module, startup/bootstrap.
- Data stores: None mandatory in this plan.
- External systems/tools: CI provider, dependency scanner.

## 3) Dependencies
### 3.1 Upstream Dependencies
- `to-do.md` §10 — delivery phase sequencing.
- Architecture invariants accepted by owners.

### 3.2 Downstream Consumers
- `docs/PLANS/implementation/L2-02_MVP-Runtime-Single-Endpoint-Chat.md`
- `docs/PLANS/implementation/L2-03_Policy-Budgeting-and-Routing-Implementation.md`
- All subsequent L2 plans.

### 3.3 External Dependencies
- CI pipeline permissions and runner availability.
- Team agreement on schema versioning policy.

## 4) Assumptions and Constraints
### 4.1 Assumptions
- Assumption 1: Core contracts can be stabilized within one sprint.
- Assumption 2: Runtime codebase can adopt one shared schema package.

### 4.2 Constraints
- Security constraints: No secrets in scaffold defaults; env validation on startup.
- Performance constraints: Schema validation overhead < 5ms per request (see 8.2).
- Cost constraints: CI runtime for baseline suite <= 8 minutes (see 8.2).
- Compliance constraints: Error taxonomy and contracts remain auditable by version.

### 4.3 Open Decisions
- Decision item: Contract versioning cadence (semantic vs sprint-based tags).
- Decision owner: Platform Lead.
- Decision deadline: Before Sprint 1 implementation starts.

---

## 5) Phase Plan

### Phase 0 - Contract Freeze
**Phase Objective**
- Define and freeze minimum viable contracts that satisfy architecture and API requirements.

**Linked SPEC Clauses**
- Clause(s): `01 Principles and Invariants`, `02 API Contracts`.

**Blocking Dependencies**
- Dependency: Master delivery sequencing accepted.

**Deliverables**
- Deliverable 1: Versioned schema package for all required objects.
- Deliverable 2: Error model taxonomy map with deterministic ingress failures.

**Workstreams**
- Architecture/contracts: Draft and align all schema objects.
- Implementation scaffolding: Add schema package and validators.
- Validation setup: Build contract validation tests.
- Documentation: Publish schema change policy and examples.

**Task List**
- [x] Task P0-01: Draft v1 schema definitions and examples.
- [x] Task P0-02: Add JSON schema or typed validator enforcement.
- [x] Task P0-03: Lock first contract version with changelog entry.

**Entry Criteria**
- Criteria: Owners align on external and internal contract set.

**Exit Criteria**
- Criteria: Contract tests pass and schema artifacts are versioned.

**Risks**
- Risk: Contract field churn blocks downstream teams.
- Mitigation: Enforce explicit version bump process.

**Rollback/Fallback**
- Rollback condition: Validation strategy causes incompatibility across modules.
- Rollback action: Revert to last stable schema tag and defer optional fields.

---

### Phase 1 - Runtime Scaffold
**Phase Objective**
- Stand up a repo module structure aligned to architecture boundaries.

**Linked SPEC Clauses**
- Clause(s): `03 Component Map`.

**Blocking Dependencies**
- Dependency: Phase 0 contract freeze completed.

**Deliverables**
- Deliverable 1: Base module tree for ingress, brain stem, control plane, router, gateways.
- Deliverable 2: Application bootstrap with deterministic startup validation.

**Workstreams**
- Architecture/contracts: Ensure module boundaries map to component map.
- Implementation scaffolding: Create package directories and base interfaces.
- Validation setup: Add import and startup smoke test.
- Documentation: Module ownership and boundary notes.

**Task List**
- [x] Task P1-01: Create component-aligned package structure.
- [x] Task P1-02: Add interfaces/stubs for core components.
- [x] Task P1-03: Add bootstrap path with startup checks.

**Entry Criteria**
- Criteria: Schema package merged and consumable.

**Exit Criteria**
- Criteria: App starts and loads deterministic config in local and CI.

**Risks**
- Risk: Early coupling between modules.
- Mitigation: Keep interfaces narrow and dependency direction explicit.

**Rollback/Fallback**
- Rollback condition: Scaffold introduces unresolvable cyclic dependencies.
- Rollback action: Collapse to minimal package skeleton and re-split with dependency rules.

---

### Phase 2 - Config and Feature Flag Baseline
**Phase Objective**
- Provide consistent runtime behavior across environments through explicit config and flags.

**Linked SPEC Clauses**
- Clause(s): `20 Config and Feature Flags`.

**Blocking Dependencies**
- Dependency: Phase 1 scaffold complete.

**Deliverables**
- Deliverable 1: Config loader with strict required/optional validation.
- Deliverable 2: Initial feature flag registry with safe defaults.

**Workstreams**
- Architecture/contracts: Bind config values to contract/runtime requirements.
- Implementation scaffolding: Implement config abstraction.
- Validation setup: Unit tests for missing/invalid config behavior.
- Documentation: Environment setup matrix and defaults.

**Task List**
- [x] Task P2-01: Implement config schema and load order.
- [x] Task P2-02: Register baseline flags for non-core capabilities.
- [x] Task P2-03: Add failure-fast startup behavior.

**Entry Criteria**
- Criteria: Module scaffold merged.

**Exit Criteria**
- Criteria: Config behavior deterministic across dev/staging CI contexts.

**Risks**
- Risk: Hidden config drift between environments.
- Mitigation: Single config schema and startup dump of non-secret settings.

**Rollback/Fallback**
- Rollback condition: Config rollout breaks local developer startup.
- Rollback action: Provide compatibility adapter for old env var names until migration completes.

---

### Phase 3 - CI and Quality Gate Baseline
**Phase Objective**
- Establish minimum engineering safety net before any major runtime features.

**Linked SPEC Clauses**
- Clause(s): `21 Test and Eval Plan`.

**Blocking Dependencies**
- Dependency: Contracts and scaffold are merged.

**Deliverables**
- Deliverable 1: Required lint/type/test checks in CI.
- Deliverable 2: Seed contract/config test suite with deterministic outcomes.

**Workstreams**
- Architecture/contracts: Enforce schema checks in CI.
- Implementation scaffolding: Integrate CI config and scripts.
- Validation setup: Add unit and smoke integration tests.
- Documentation: Local command parity with CI.

**Task List**
- [x] Task P3-01: Add CI jobs and branch protection requirements.
- [x] Task P3-02: Add minimal but representative unit tests.
- [x] Task P3-03: Add CI troubleshooting runbook section.

**Entry Criteria**
- Criteria: Config and startup baseline complete.

**Exit Criteria**
- Criteria: CI passes reliably and blocks invalid contract changes.

**Risks**
- Risk: Flaky tests reduce trust in gates.
- Mitigation: Keep tests deterministic and avoid network dependencies.

**Rollback/Fallback**
- Rollback condition: CI blocks all merges due to unstable checks.
- Rollback action: Temporarily narrow required checks to stable subset while fixing flakiness.

---

### Phase 4 - Sprint Handoff Readiness
**Phase Objective**
- Prepare L2-02 execution with explicit readiness criteria and ownership handoff.

**Linked SPEC Clauses**
- Clause(s): `02 API Contracts`, `04 Ingress Spec`, `05 BrainStem Spec`.

**Blocking Dependencies**
- Dependency: CI quality baseline complete.

**Deliverables**
- Deliverable 1: Sprint 1 start checklist signed by owners.
- Deliverable 2: Contract compatibility matrix for MVP endpoint.

**Workstreams**
- Architecture/contracts: Final review of schema assumptions.
- Implementation scaffolding: Confirm interfaces needed by MVP.
- Validation setup: Confirm test harness for endpoint path.
- Documentation: Publish handoff notes and known limits.

**Task List**
- [x] Task P4-01: Run readiness review meeting.
- [x] Task P4-02: Publish sprint handoff checklist.
- [x] Task P4-03: Capture open risks and owners.

**Entry Criteria**
- Criteria: CI stable and contract package tagged.

**Exit Criteria**
- Criteria: L2-02 can start without contract/scaffold blockers.

**Risks**
- Risk: Hidden dependency gaps for Sprint 1.
- Mitigation: Add cross-team review with explicit acceptance checklist.

**Rollback/Fallback**
- Rollback condition: Handoff reveals missing interfaces for MVP.
- Rollback action: Allocate micro-scope fix window before Sprint 1 starts.

---

## 6) Detailed Backlog (Task Table)
| Task ID | Description | Owner Role | Estimate | Priority | Dependencies | Definition of Done | Verification Method |
|---|---|---|---|---|---|---|---|
| CNP-001 | Define v1 contract objects and examples | Platform Lead | 1.5d | P0 | None | Schemas approved and committed | Schema review + tests |
| CNP-002 | Implement contract validators | API Lead | 1d | P0 | CNP-001 | Validation passes valid data and rejects invalid | Unit tests |
| CNP-003 | Publish error taxonomy mapping | Runtime Lead | 0.5d | P0 | CNP-001 | Error map linked to contract package | Review checklist |
| CNP-004 | Create architecture-aligned module scaffold | Runtime Lead | 1d | P0 | CNP-001 | Module tree exists with stubs/interfaces | Startup smoke |
| CNP-005 | Implement config loader and feature flags | Platform Lead | 1d | P0 | CNP-004 | Config schema validated on startup | Config unit tests |
| CNP-006 | Add lint/type/test CI workflow | QA Lead | 1d | P0 | CNP-002,CNP-005 | Required checks active and passing | CI run |
| CNP-007 | Add seed unit + smoke tests | QA Lead | 1d | P1 | CNP-004,CNP-006 | Baseline tests deterministic | CI repeat runs |
| CNP-008 | Final sprint handoff and sign-off notes | Platform Lead | 0.5d | P1 | CNP-007 | Handoff document accepted | Review meeting |

**Handoff artifact:** Sprint handoff checklist, compatibility matrix, schema examples, CI commands, known limits, and open risks are in **§14** below. Runbook: [CI-Bootstrap-Troubleshooting.md](../../OPERATIONS/RUNBOOKS/CI-Bootstrap-Troubleshooting.md).

## 7) Validation and Test Strategy
### 7.1 Unit
- Required unit coverage: 85%+ for contract validators and config parsing paths.

### 7.2 Integration
- Required integration scenarios: App bootstrap with full config and missing-config failures.

### 7.3 End-to-End
- Required e2e scenarios: N/A for this sprint; limited to startup and contract smoke.

### 7.4 Negative and Failure Path Testing
- Required failure scenarios: Invalid envelope fields, unknown contract version, missing required env vars.

### 7.5 CI Quality Gates
- Required checks: lint, type-check, unit tests, startup smoke test.

## 8) Observability and Metrics
### 8.1 Required Instrumentation
- Logs: Structured startup/config validation logs (non-secret fields only).
- Metrics: Validation pass/fail counters in test harness.
- Traces: Bootstrap trace not required yet.
- Events: Contract validation outcomes in CI artifacts.

### 8.2 SLO/SLA Targets
- Latency targets: Schema validation overhead < 5ms per request in local benchmark.
- Error rate targets: 0 known false positives in validator tests.
- Cost targets: CI runtime for baseline suite <= 8 minutes.

### 8.3 Alerting and Dashboards
This project is a UI-less API server; dashboard panels are out of scope and deferred to ops/external tooling (e.g. Grafana).
- Alerts required: CI required checks failing for 3 consecutive runs.
- Dashboard panels required (if ops provisions): CI pass rate, average run duration, flaky test count.

## 9) Security and Policy Checks
### 9.1 Threats Introduced by This Scope
- Threat: Contracts accidentally permit unsafe or unbounded payload shapes.

### 9.2 Required Controls
- Control: Strict schema validation and payload size constraints at contract layer.

### 9.3 Security Validation
- Static analysis: Dependency scan and secret scan on CI.
- Runtime checks: Startup validation rejects insecure/missing config.
- Abuse/misuse tests: Malformed payload and oversized body test cases.

### 9.4 Audit Artifacts
- Required artifacts: Tagged contract version, change log entries, CI report for validator suite.

## 10) Rollout Strategy
### 10.1 Feature Flags
- Flag name: `contracts.v1_enabled`
- Default state: true in all environments after merge.
- Rollout criteria: Validator and compatibility tests pass.

### 10.2 Environment Progression
- Dev -> Staging -> Production path: Contracts and config code promoted via standard CI pipeline.

### 10.3 Canary/Cohort Plan
- Cohort definition: Internal integration tests only.
- Success criteria: Zero contract mismatch in integration suite.

### 10.4 Kill Switch and Rollback
- Trigger conditions: Widespread contract incompatibility in downstream plan branches.
- Rollback steps: Revert to previous contract tag and set compatibility adapter.

## 11) Operational Readiness
### 11.1 Runbook Changes
- Runbook updates required: CI bootstrap troubleshooting and schema migration notes.

### 11.2 On-Call Readiness
- Alert owner: Platform on-call.
- Escalation path: Platform -> Runtime -> Engineering manager.

### 11.3 Support Handoff
- Documentation handoff: Contract package README and config reference.
- Training handoff: 30-minute walkthrough for Sprint 1 implementers.

## 12) Acceptance Criteria (Final Gate)
### 12.1 Functional Acceptance
- Criterion: All required contracts exist, validate correctly, and are versioned.

### 12.2 Non-Functional Acceptance
- Criterion: Baseline CI checks required and consistently green.

### 12.3 Security/Compliance Acceptance
- Criterion: Config and contract controls prevent unsafe defaults and pass scanning checks.

### 12.4 Documentation Acceptance
- Criterion: Handoff docs include schema examples, version policy, and CI commands.

## 13) Post-Implementation Review
### 13.1 Review Date
- Date: 1 week after L2-02 starts.

### 13.2 Success Metrics Review
- Metrics reviewed: Contract-change failure count, CI pass rate, startup failures in integration.
- Outcome: To be recorded during review.

### 13.3 Deferred Work
- Follow-up task: Contract extensions needed by multimodal and retrieval plans.
- Target phase: L2-06 and L2-07 preparation.

## 14) Sprint handoff archive (L2-01 → L2-02)

*Merged from the former `L2-01_Handoff.md` (same content; single source of truth).*

**Plan:** L2-01 Contracts and Project Scaffold  
**Status:** Implementation complete  
**Handoff to:** L2-02 MVP Runtime Single Endpoint Chat  

### 1) Sprint 1 (L2-02) start checklist

- [x] Contract package merged and versioned (v1)
- [x] All required contracts implemented and validated (RequestEnvelope, ResponseEnvelope, CanonicalRequest, IntentBundle, PolicyDecision, PipelinePlan, TypedArtifact, Task, EngineInvocation, EngineResult, WorkflowDefinition)
- [x] Error taxonomy defined and linked to contract package
- [x] Module scaffold in place (ingress, brainstem, controlplane, router, gateways, pipelines, workflows, engines, observability)
- [x] Bootstrap loads config and validates on startup
- [x] Config schema and feature flags with safe defaults
- [x] CI workflow: lint, typecheck, test, startup smoke
- [x] Seed unit and smoke tests deterministic
- [ ] Readiness review meeting (owner sign-off)
- [ ] L2-02 implementation start

**Definition of ready for L2-02:** All items above except the review meeting are done. L2-02 can start without contract or scaffold blockers.

### 2) Contract compatibility matrix (MVP endpoint)

| Contract / area        | Version | MVP (L2-02) use | Notes |
|------------------------|---------|-----------------|--------|
| RequestEnvelope        | v1      | Yes             | Only `contract_version: "v1"` accepted. |
| ResponseEnvelope       | v1      | Yes             | status: ok \| blocked \| error \| accepted |
| CanonicalRequest       | (internal) | Yes          | Brain Stem produces this from RequestEnvelope |
| IntentBundle           | (internal) | Yes          | Brain Stem produces this; chat path uses primary_intent |
| PolicyDecision         | (internal) | Placeholder   | L2-03 implements; MVP can return allow-all placeholder |
| PipelinePlan           | (internal) | Placeholder   | Router stub; MVP uses single chat pipeline |
| TypedArtifact, Task    | (internal) | Yes          | Engine I/O; see `src/contracts/typed-artifact.ts`, `task.ts` |
| EngineInvocation, EngineResult | (internal) | Yes | Engine boundary; see `src/contracts/engine-invocation.ts`, `engine-result.ts` |
| WorkflowDefinition     | (internal) | Yes          | Workflow registry; see `src/contracts/workflow-definition.ts`, `src/workflows/registry.ts` |
| Error codes            | —       | Yes             | Use ERROR_TAXONOMY; INVALID_PAYLOAD for envelope validation failures |

**MVP endpoint:** `POST /v1/query` – accept RequestEnvelope (v1), return ResponseEnvelope. Ingress validates envelope; Brain Stem produces CanonicalRequest + IntentBundle; chat pipeline returns ResponseEnvelope.

### 3) Schema examples and version policy

#### RequestEnvelope (minimal valid)

```json
{
  "request_id": "<uuid>",
  "caller": { "app_id": "<app_id>", "user_id": "<user_id>", "org_id": "<org_id>", "scopes": [] },
  "input": { "text": "<user_input_text_optional>", "attachments": [] },
  "preferences": { "response_format": "text", "verbosity": "<low|medium|high>", "stream": false },
  "contract_version": "v1"
}
```

#### ResponseEnvelope (success)

```json
{
  "request_id": "<uuid>",
  "status": "ok",
  "output": { "text": "<model_output_text_optional>", "citations": [] },
  "telemetry": { "tokens_in": "<int>", "tokens_out": "<int>", "cost_usd_est": "<float>", "latency_ms": "<int>" }
}
```

#### Version policy

- **Current supported:** `contract_version: "v1"` only. Any other value is rejected (CONTRACT_VERSION_UNSUPPORTED).
- **Changes:** Additive optional fields are allowed; breaking changes require a new version and explicit migration.
- **Changelog:** `src/contracts/CHANGELOG.md`.

### 4) CI commands (local parity with CI)

| CI step        | Local command |
|----------------|---------------|
| Lint           | `npm run lint` |
| Typecheck      | `npm run typecheck` |
| Unit + smoke   | `npm run test` or `npm run test:ci` (with coverage) |
| Build          | `npm run build` |
| Startup smoke  | `node dist/bootstrap/index.js` |

Full CI: `.github/workflows/ci.yml` runs on push/PR to `main`.

### 5) Known limits

- **Contracts:** Only v1 supported; no streaming schema yet. All engine/workflow contracts (TypedArtifact, Task, EngineInvocation, EngineResult, WorkflowDefinition) are implemented and exported from `src/contracts/index.ts`.
- **Scaffold:** Workflow registry (`src/workflows/registry.ts`) and definitions (`src/workflows/definitions/reactive_chat.json`) exist; reactive_chat is loaded by registry. All component modules have interfaces/stubs; routing, policy, and pipeline execution use engines per SOW M1.
- **Config:** Env-based only; no central config service.
- **CI:** No dependency or secret scanning yet (plan §9.3 calls for it in follow-up).

### 6) Open risks and owners

| Risk | Owner | Mitigation |
|------|--------|-------------|
| Contract field churn blocks L2-02 | Platform Lead | Change policy in CHANGELOG; avoid breaking changes to v1. |
| Hidden dependency gaps for MVP | Runtime Lead | Use this handoff checklist; add integration test for envelope → response path in L2-02. |
| Config drift between environments | Platform Lead | Single config schema; document env vars in README/config reference. |

### 7) References

- Contract package: `src/contracts/` (schemas, validators, errors; includes WorkflowDefinition, TypedArtifact, Task, EngineInvocation, EngineResult)
- Workflow registry: `src/workflows/registry.ts`; definitions: `src/workflows/definitions/*.json`
- Config: `src/config/schema.ts`; feature flags in config.flags
- Bootstrap: `src/bootstrap/index.ts`
- CI: `.github/workflows/ci.yml`
- Runbook: `docs/OPERATIONS/RUNBOOKS/CI-Bootstrap-Troubleshooting.md`
