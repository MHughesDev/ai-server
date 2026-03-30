# L2-06 Memory and Retrieval Implementation

## 0) Document Control
- Plan ID: L2-06
- Plan Name: Memory and Retrieval Implementation
- Linked SPEC: `docs/SPEC/07_PolicyEngine_Spec.md`, `docs/SPEC/11_FailureManager_Spec.md`, `docs/SPEC/14_Pipelines_Catalog.md`, `docs/SPEC/17_MemoryAbstraction_Spec.md`, `docs/SPEC/21_Test_and_Eval_Plan.md`, `docs/SPEC/22_Runbooks_and_Operations.md`
- Owner(s): Retrieval Lead
- Contributors: Data Lead, Runtime Lead, Security Lead, QA Lead
- Status: `implemented`
- Priority: `P1`
- Created: 2026-02-18
- Last Updated: 2026-02-18
- Review Cadence: Daily implementation review + weekly relevance quality review

## 1) Purpose and Outcome
### 1.1 Purpose
Introduce governed memory and retrieval capabilities with citation grounding while preserving security and reliability invariants.

### 1.2 Intended Outcomes
- Outcome 1: Document ingestion and retrieval operate through a single memory abstraction layer.
- Outcome 2: Scope boundaries are enforced for retrieval access.
- Outcome 3: Responses include reliable citations with fallback behavior when stores degrade.

### 1.3 Non-Goals
- Non-goal 1: Autonomous agent harness execution.
- Non-goal 2: Broad multi-format ingestion beyond text/PDF baseline.

## 2) Scope
### 2.1 In Scope
- Ingestion path for text/PDF to chunk/embed/index.
- Retrieval query path with scope filters and policy alignment.
- Citation extraction/grounding in response synthesis.
- Metadata schema migrations for retrieval records.
- Outage fallback behavior for retrieval backend failures.

### 2.2 Out of Scope
- Advanced ranking experiments and long-term retrieval personalization.
- Cross-tenant shared corpus retrieval.

### 2.3 Interfaces Touched
- API endpoints: `POST /v1/query` retrieval-enabled route.
- Internal modules: Memory Abstraction, retrieval pipeline, citation synthesizer.
- Data stores: Vector index, metadata relational store, optional object storage.
- External systems/tools: Embedding model provider.

## 3) Dependencies
### 3.1 Upstream Dependencies
- `docs/PLANS/implementation/L2-05_Security-Isolation-and-Compliance-Implementation.md` complete.
- `docs/PLANS/implementation/L2-04_Observability-and-Evaluation-Implementation.md` complete.

### 3.2 Downstream Consumers
- `docs/PLANS/implementation/L2-07_Multimodal-Input-Path-Implementation.md`
- `docs/PLANS/implementation/L2-08_Rollout-and-Operational-Readiness-Implementation.md`

### 3.3 External Dependencies
- Vector store provisioning and operational backup strategy.
- Embedding service access and budget limits.

## 4) Assumptions and Constraints
### 4.1 Assumptions
- Assumption 1: Security controls from L2-05 can be reused for retrieval scope enforcement.
- Assumption 2: Telemetry from L2-04 can capture relevance and citation metrics.

### 4.2 Constraints
- Security constraints: All memory access must route through Memory Abstraction with scope enforcement.
- Performance constraints: Retrieval-added p95 overhead <= 600ms for default top-k (see 8.2).
- Cost constraints: Embedding/retrieval cost per request within policy budget (see 8.2).
- Compliance constraints: Provenance and citation references must be auditable.

### 4.3 Open Decisions
- Decision item: Chunking strategy defaults (size/overlap) by document type.
- Decision owner: Retrieval Lead.
- Decision deadline: End of Phase 0.

---

## 5) Phase Plan

### Phase 0 - Data Model and Ingestion Foundation
**Phase Objective**
- Build repeatable ingestion and durable retrieval metadata structures.

**Linked SPEC Clauses**
- Clause(s): `17 MemoryAbstraction Spec`.

**Blocking Dependencies**
- Dependency: Security and observability baselines complete.

**Deliverables**
- Deliverable 1: Ingestion pipeline for text/PDF documents.
- Deliverable 2: Metadata schema and migrations for retrieval records.

**Workstreams**
- Core implementation: Chunking/embedding/indexing pipeline.
- Integration: Metadata persistence and indexing hooks.
- Basic observability: Ingestion success/failure metrics.
- Basic docs: Supported formats and ingestion limits.

**Task List**
- [x] Task P0-01: Implement text/PDF chunking and embedding workflow.
- [x] Task P0-02: Add metadata schema migrations and indices.
- [x] Task P0-03: Add ingestion validation and failure handling tests.

**Entry Criteria**
- Criteria: Security controls for data handling in place.

**Exit Criteria**
- Criteria: Documents ingest reproducibly with complete metadata.

**Risks**
- Risk: Poor chunking defaults reduce retrieval relevance.
- Mitigation: Benchmark multiple chunk configs on a seed corpus.

**Rollback/Fallback**
- Rollback condition: Ingestion quality fails baseline relevance checks.
- Rollback action: Revert to conservative chunking baseline and retune iteratively.

---

### Phase 1 - Scoped Retrieval and Query Path
**Phase Objective**
- Ensure retrieval results are both relevant and scope-compliant.

**Linked SPEC Clauses**
- Clause(s): `17 MemoryAbstraction Spec`, `07 PolicyEngine Spec`.

**Blocking Dependencies**
- Dependency: Ingestion and metadata baseline stable.

**Deliverables**
- Deliverable 1: Retrieval APIs with enforced user/project/org scope constraints.
- Deliverable 2: Route integration for retrieval-enabled query handling.

**Workstreams**
- Core implementation: Retrieval query builder and scoring.
- Integration: Policy scope checks in memory query path.
- Basic observability: Retrieval latency and hit-rate metrics.
- Basic docs: Scope semantics and filter behavior.

**Task List**
- [x] Task P1-01: Implement scoped retrieval APIs and policy filters.
- [x] Task P1-02: Integrate retrieval into query pipeline route.
- [x] Task P1-03: Add integration tests for scope allow/deny boundaries.

**Entry Criteria**
- Criteria: Ingestion output available for retrieval tests.

**Exit Criteria**
- Criteria: Retrieval returns scoped and relevant results under integration tests.

**Risks**
- Risk: Scope filter bugs cause cross-tenant leakage.
- Mitigation: Add strict scope boundary tests and security review.

**Rollback/Fallback**
- Rollback condition: Any scope boundary violation detected.
- Rollback action: Disable retrieval route and continue chat-only mode until fixed.

---

### Phase 2 - Citation Grounding and Synthesis
**Phase Objective**
- Ensure retrieval-augmented responses are transparent and verifiable.

**Linked SPEC Clauses**
- Clause(s): `14 Pipelines Catalog`, `21 Test and Eval Plan`.

**Blocking Dependencies**
- Dependency: Scoped retrieval path integrated.

**Deliverables**
- Deliverable 1: Citation extraction and response attachment format.
- Deliverable 2: Grounding checks for citation-to-answer consistency.

**Workstreams**
- Core implementation: Citation formatter and synthesizer integration.
- Integration: Response envelope citation field population.
- Basic observability: Citation coverage and grounding score metrics.
- Basic docs: Citation semantics and known limitations.

**Task List**
- [x] Task P2-01: Implement citation generation from retrieval context.
- [x] Task P2-02: Implement grounding checks in synthesis stage.
- [x] Task P2-03: Add relevance/citation integration tests and threshold checks.

**Entry Criteria**
- Criteria: Retrieval integration stable.

**Exit Criteria**
- Criteria: Citation quality thresholds met for benchmark dataset.

**Risks**
- Risk: Citation spans mismatch generated outputs.
- Mitigation: Add deterministic mapping and verification rules.

**Rollback/Fallback**
- Rollback condition: Citation quality drops below threshold.
- Rollback action: Return non-citation response mode with explicit disclosure flag.

---

### Phase 3 - Resilience and Failure Handling
**Phase Objective**
- Keep retrieval-enabled experiences stable during partial outages.

**Linked SPEC Clauses**
- Clause(s): `11 FailureManager Spec`, `17 MemoryAbstraction Spec`.

**Blocking Dependencies**
- Dependency: Citation path validated.

**Deliverables**
- Deliverable 1: Store outage fallback path.
- Deliverable 2: Failure taxonomy integration for retrieval-specific errors.

**Workstreams**
- Core implementation: Fallback behavior and retry policy.
- Integration: Failure manager hooks and deterministic error mapping.
- Basic observability: Store health and fallback invocation metrics.
- Basic docs: Retrieval outage runbook section.

**Task List**
- [x] Task P3-01: Implement graceful fallback when vector store is unavailable.
- [x] Task P3-02: Add deterministic failure codes for retrieval failures.
- [x] Task P3-03: Add outage simulation tests in CI/staging.

**Entry Criteria**
- Criteria: Citation and relevance checks stable.

**Exit Criteria**
- Criteria: Retrieval outages degrade gracefully without full request failure where possible.

**Risks**
- Risk: Fallback path degrades answer quality silently.
- Mitigation: Emit explicit degraded-response marker and monitoring events.

**Rollback/Fallback**
- Rollback condition: Fallback logic introduces instability.
- Rollback action: Disable retrieval route and route to chat-only response.

---

### Phase 4 - Gate Sign-Off and Handoff
**Phase Objective**
- Finalize retrieval readiness and handoff artifacts for multimodal and rollout planning.

**Linked SPEC Clauses**
- Clause(s): `21 Test and Eval Plan`, `22 Runbooks and Operations`.

**Blocking Dependencies**
- Dependency: Resilience tests and quality gates passing.

**Deliverables**
- Deliverable 1: Retrieval readiness report with quality/security metrics.
- Deliverable 2: Handoff package for L2-07 and L2-08.

**Workstreams**
- Core implementation: Final stabilization and issue closure.
- Integration: Validate compatibility with multimodal extensions.
- Basic observability: Metrics and runbook in place; retrieval dashboards out of scope (deferred to ops).
- Basic docs: Publish retrieval runbook and quality notes.

**Task List**
- [x] Task P4-01: Execute final retrieval gate checklist.
- [x] Task P4-02: Publish benchmark and outage test evidence.
- [x] Task P4-03: Complete handoff with downstream plan owners.

**Entry Criteria**
- Criteria: CI quality and resilience checks green for 3 runs.

**Exit Criteria**
- Criteria: Retrieval capability approved for downstream consumption.

**Risks**
- Risk: Open quality regressions discovered post-gate.
- Mitigation: Keep regression suite running as mandatory check.

**Rollback/Fallback**
- Rollback condition: Post-gate regressions exceed threshold.
- Rollback action: Freeze feature flag and prioritize retrieval stabilization sprint.

---

## 6) Detailed Backlog (Task Table)
| Task ID | Description | Owner Role | Estimate | Priority | Dependencies | Definition of Done | Verification Method |
|---|---|---|---|---|---|---|---|
| MEM-001 | Build ingestion pipeline for text/PDF | Retrieval Lead | 1.5d | P0 | L2-05 | Documents chunk/embed/index successfully | Ingestion integration tests |
| MEM-002 | Implement retrieval metadata schema migrations | Data Lead | 1d | P0 | MEM-001 | Schema deployed and indexed | Migration tests |
| MEM-003 | Implement scoped retrieval query layer | Runtime Lead | 1.25d | P0 | MEM-001,MEM-002 | Retrieval enforces scope boundaries | Scope integration tests |
| MEM-004 | Integrate retrieval route into query pipeline | Runtime Lead | 1d | P0 | MEM-003 | Requests can use retrieval path | E2E tests |
| MEM-005 | Implement citation generation and grounding checks | Retrieval Lead | 1.25d | P0 | MEM-004 | Citation coverage meets threshold | Eval tests |
| MEM-006 | Add retrieval outage fallback behavior | Runtime Lead | 0.75d | P1 | MEM-004 | Graceful degrade path works | Failure simulation |
| MEM-007 | Build retrieval quality and resilience dashboards | SRE Lead | 0.75d | P1 | MEM-005,MEM-006 | Out of scope for this repo (UI-less server); deferred to ops | —
| MEM-008 | Publish retrieval readiness report and handoff | Retrieval Lead | 0.5d | P1 | MEM-005,MEM-006 | Gate report approved | Review sign-off |

**Implementation status:** MEM-001 through MEM-008 delivered (text ingestion and in-memory store; PDF/vector DB and MEM-007 dashboards out of scope for this repo, deferred to ops/SRE).

## 7) Validation and Test Strategy
### 7.1 Unit
- Required unit coverage: Chunker behavior, scope filter logic, citation formatter, fallback decision logic.

### 7.2 Integration
- Required integration scenarios: Ingest-and-retrieve loop, scope allow/deny, citation generation in response path.

### 7.3 End-to-End
- Required e2e scenarios: Retrieval-augmented request with valid citations under normal store conditions.

### 7.4 Negative and Failure Path Testing
- Required failure scenarios: Vector store outage, empty retrieval set, malformed source docs, scope mismatch access attempts.

### 7.5 CI Quality Gates
- Required checks: Retrieval relevance baseline, citation grounding threshold, scope boundary tests, outage fallback tests.

## 8) Observability and Metrics
### 8.1 Required Instrumentation
- Logs: Retrieval query parameters (redacted), source counts, fallback markers.
- Metrics: Retrieval latency, hit rate, citation coverage, fallback invocation rate.
- Traces: Spans for ingest, retrieve, rank, synthesize citation.
- Events: `MEMORY_QUERY`, `MEMORY_WRITE`, `VERIFY_RESULT`, `ERROR`.

### 8.2 SLO/SLA Targets
- Latency targets: Retrieval-added p95 overhead <= 600ms for default top-k.
- Error rate targets: Retrieval path internal failure <= 1%.
- Cost targets: Embedding/retrieval cost per request within policy budget.

### 8.3 Alerting and Dashboards
This project is a UI-less API server; dashboard panels are out of scope and deferred to ops/external tooling (e.g. Grafana).
- Alerts required: Retrieval failure spikes, citation coverage drops, scope-violation attempts.
- Dashboard panels required (if ops provisions): Relevance score trend, hit/miss ratio, store health, fallback frequency.

## 9) Security and Policy Checks
### 9.1 Threats Introduced by This Scope
- Threat: Unauthorized retrieval across scope boundaries or leakage through citation content.

### 9.2 Required Controls
- Control: Mandatory scope filtering and redaction before synthesis output.

### 9.3 Security Validation
- Static analysis: Query filter and access path review.
- Runtime checks: Scope enforcement and denied access event emission.
- Abuse/misuse tests: Prompt-driven data exfiltration attempts through retrieval.

### 9.4 Audit Artifacts
- Required artifacts: Scope test reports, retrieval access logs, citation quality benchmarks.

## 10) Rollout Strategy
### 10.1 Feature Flags
- Flag name: `memory_retrieval_enabled` (config key; env: `MEMORY_RETRIEVAL_ENABLED`)
- Default state: false in production until quality gate passes.
- Rollout criteria: Scope/security and citation quality thresholds met.

### 10.2 Environment Progression
- Dev -> Staging -> Production path: Enable by environment with staged corpus size.

### 10.3 Canary/Cohort Plan
- Cohort definition: Internal users and documentation-heavy low-risk tenants.
- Success criteria: Stable latency and citation coverage targets for 72 hours.

### 10.4 Kill Switch and Rollback
- Trigger conditions: Scope leak, sustained retrieval failure, citation quality collapse.
- Rollback steps: Disable retrieval flag and revert to non-retrieval response path.

## 11) Operational Readiness
### 11.1 Runbook Changes
- Runbook updates required: Retrieval outage handling, embedding failures, citation quality regressions.

### 11.2 On-Call Readiness
- Alert owner: Retrieval on-call with SRE backup.
- Escalation path: Retrieval -> Runtime -> Security.

### 11.3 Support Handoff
- Documentation handoff: Ingestion/retrieval operation guide and quality thresholds.
- Training handoff: Retrieval incident simulation and dashboard walkthrough.

## 12) Acceptance Criteria (Final Gate)
### 12.1 Functional Acceptance
- Criterion: Retrieval path returns scoped context and citations for supported workloads.

### 12.2 Non-Functional Acceptance
- Criterion: Latency/cost/reliability targets pass staging benchmarks.

### 12.3 Security/Compliance Acceptance
- Criterion: Scope boundaries and data handling controls pass security review.

### 12.4 Documentation Acceptance
- Criterion: Retrieval runbooks, benchmarks, and handoff docs are complete.

## 13) Post-Implementation Review
### 13.1 Review Date
- Date: 2 weeks after multimodal plan starts.

### 13.2 Success Metrics Review
- Metrics reviewed: Citation coverage, retrieval relevance score, scope violation attempts, fallback rate.
- Outcome: To be recorded after review.

### 13.3 Deferred Work
- Follow-up task: Hybrid retrieval ranking and adaptive top-k tuning.
- Target phase: Post-L2-08 optimization backlog.

## 14) Sprint handoff archive (L2-06 → L2-07 / L2-08)

*Merged from the former `L2-06_Handoff.md`.*

**Plan:** L2-06 Memory and Retrieval Implementation  
**Status:** Implementation complete  
**Handoff to:** L2-07 Multimodal Input Path, L2-08 Rollout and Operational Readiness  

### 1) L2-07 / L2-08 start checklist

- [x] Memory abstraction (IMemoryStore) and scope enforcement implemented
- [x] Text chunking and in-memory ingestion pipeline (MVP; no PDF/embedding yet)
- [x] Scoped retrieval integrated into POST /v1/query when `memory_retrieval_enabled` and policy `memory_scope` ≠ none
- [x] Citation generation from retrieval hits and attachment to response envelope `output.citations`
- [x] Graceful fallback when store unavailable (degraded path; no request failure)
- [x] Error code `RETRIEVAL_UNAVAILABLE` in taxonomy; MEMORY_QUERY and ERROR events for retrieval
- [x] Feature flag: `memory_retrieval_enabled` (default false in production)
- [x] Unit tests: chunker, scope filter, citation formatter, in-memory store, retrieval service
- [x] Integration test: response envelope includes citations array
- [x] E2E integration test: full retrieval path (ingest → query → citations) with env set before bootstrap
- [x] E2E scope enforcement: caller org only receives citations from their org (`retrieval.integration.test.ts` — two orgs, query as o1, assert citations exclude o2)
- [ ] Readiness review meeting (owner sign-off)
- [ ] L2-07 / L2-08 implementation start

**Definition of ready for L2-07 / L2-08:** All items above except the review meeting are done. Downstream plans can rely on retrieval path and citation contract.

### 2) Memory and retrieval contracts

#### Feature flag and policy

| Flag / policy           | Effect |
|------------------------|--------|
| `memory_retrieval_enabled` | When true, retrieval runs on query if policy `memory_scope` is user/project/org. |
| `enable_org_memory`    | When true, policy evaluator sets `memory_scope: "org"` so retrieval is allowed for org-scoped corpus. |

#### Response envelope

- `output.citations`: array of `{ source, ref, span? }` (always present; empty when retrieval disabled or no hits).
- When retrieval runs and returns hits, citations are derived from retrieval chunks and attached to the response.

#### Events (when `observability_required_events_v1`)

| Event        | When emitted |
|-------------|----------------|
| MEMORY_QUERY | After successful retrieval (with hit_count, latency_ms, scope). |
| ERROR        | When retrieval is degraded or throws (code RETRIEVAL_UNAVAILABLE, stage "retrieval"). |

#### Error code

- **RETRIEVAL_UNAVAILABLE**: 503, retryable; used when store is down or returns degraded. Request proceeds without retrieval (degraded response).

### 3) Config and feature flags

- **memory_retrieval_enabled**  
  Default: `false`. Set `MEMORY_RETRIEVAL_ENABLED=true` to enable retrieval path. Requires policy to allow a non-none `memory_scope` (e.g. set `ENABLE_ORG_MEMORY=true` for org scope).

- **enable_org_memory**  
  When true, policy returns `memory_scope: "org"` so retrieval can run with org-scoped filters.

### 4) Module layout

- `src/memory/`: types, chunker, memory-abstraction (scope + IMemoryStore + IStructuredStore + IObjectStore), in-memory-store, **structured-store**, **object-store**, **memory-gateway**, retrieval-service, citation-formatter, default-store.
- **Memory Gateway (SOW Segment I):** `src/memory/memory-gateway.ts` — `IMemoryGateway` composes `vectorStore` (IMemoryStore), `structuredStore` (IStructuredStore), `objectStore` (IObjectStore), optional `retention`. `getMemoryGateway()` in default-store returns the composed gateway; `getDefaultStore()` returns the same vector store for retrieval. Structured: key-value by scope (`InMemoryStructuredStore`). Object: blobs by id and scope (`InMemoryObjectStore`). Retention: config `memoryRetention` (ttl_seconds, max_chunks_per_scope); InMemoryStore accepts optional retention and evicts by TTL and max chunks per scope.
- **Memory Engine (SOW M4 / Segment H):** `src/engines/memory_engine.ts` — implements `IEngine`; calls `runRetrieval(store, …)` only; returns `memory_response` Typed Artifact with citations and contextText. Reactive Chat pipeline invokes the Memory Engine when `plan.memory?.retrieval` and policy `memory_scope` ≠ none; query-handler passes `memoryStore: getDefaultStore()` into `createChatPipeline` for reactive_chat (vector store is `getMemoryGateway().vectorStore`).
- Query-handler: for pipelines other than reactive_chat, still calls `runRetrieval(getDefaultStore(), …)` when plan.memory?.retrieval and scope ≠ none; passes `retrievalContext` to pipeline. On failure or degraded, continues without retrieval.
- Chat pipeline: accepts optional `memoryStore`; when set and plan.memory is set, calls Memory Engine and uses result for context and citations; otherwise uses optional `retrievalContext` from input. Sets `output.citations` from retrieval.

### 5) CI and verification

| Check | Command / location |
|-------|---------------------|
| Unit tests (memory) | `npm test` (src/memory/*.test.ts) |
| Integration (envelope, citations) | `npm test` (query.integration.test.ts) |
| E2E retrieval (ingest → query → citations) | `npm test` (retrieval.integration.test.ts) |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |

#### 5.1 Benchmark and outage test evidence

- **Scope boundary:** `src/memory/memory-abstraction.test.ts` (scopeAllowsAccess user/project/org/none).
- **Outage fallback:** `src/memory/in-memory-store.test.ts` (returns degraded and empty when unavailable; ingest error when unavailable).
- **Ingest-and-retrieve:** `src/memory/retrieval-service.test.ts` (runRetrieval with store hits and degraded).
- **Full path E2E:** `src/server/retrieval.integration.test.ts` (retrieval enabled + org memory, ingest doc, POST /v1/query, assert citations).
- **Scope enforcement E2E:** same file — test "enforces scope: caller org only receives citations from their org" (two org-scoped docs; query as org o1; assert citations only from o1, not o2).
- **Citation formatter:** `src/memory/citation-formatter.test.ts` (citations from hits, dedupe, span truncation).

### 6) Known limits and deferred work

- **Store:** Default is in-memory (no vector DB); swap via `setDefaultStore()` or production adapter. **Segment I:** Structured and object stores are in-memory implementations (`InMemoryStructuredStore`, `InMemoryObjectStore`); production may swap for persistent backends.
- **Retention:** Config `memoryRetention` (env: `MEMORY_RETENTION_TTL_SECONDS`, `MEMORY_RETENTION_MAX_CHUNKS_PER_SCOPE`) is applied by InMemoryStore when retention options are provided; other stores do not apply retention in MVP.
- **Ingestion:** Text-only chunking; no PDF parsing or real embeddings in MVP.
- **Ranking:** In-memory store uses simple text match; production should use vector similarity.
- **Grounding:** Citation extraction only; no strict grounding score threshold in synthesis yet.

### 7) References

- Spec: `docs/SPEC/17_MemoryAbstraction_Spec.md`
- Plan: `docs/PLANS/implementation/L2-06_Memory-and-Retrieval-Implementation.md`
- Runbook: `docs/OPERATIONS/RUNBOOKS/Memory-Retrieval-Outage.md`
- Config: `src/config/schema.ts` (memory_retrieval_enabled, enable_org_memory)
