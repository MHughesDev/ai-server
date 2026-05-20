# Scope of Work — Centralized Multimodal AI Server

**Source:** `docs/ARCHITECTURE/Architecture_document_Finalized.md`  
**Purpose:** Map the architecture to implementation approach for each part, and define a full Scope of Work so a **coding agent** can execute it (across one or many conversations). The architecture holds full contract shapes and rules; this SOW holds **execution order**, **file paths**, **conventions**, and **verification steps**.  
**Status:** Finalized for coding agents as an implementation baseline; production-hardening readiness is tracked in [`to-do.md`](../../to-do.md).

---

## 0) Document Control

| Field | Value |
|-------|--------|
| Document | Scope of Work (Architecture → Implementation) |
| Linked | Architecture_document_Finalized.md, to-do.md, L2-01 through L2-08, L2-99 |
| Owner | Platform Lead / Tech Lead |
| Status | Finalized |
| Last Updated | 2026-03-03 (status language reconciled with active gap-closure SOW; implementation-complete does not imply production-ready) |

---

## 0.1) How to Use This SOW (Coding Agent Instructions)

- **Authority:** For full contract JSON shapes, engine I/O contracts, workflow catalog, and guardrails, **read the Architecture document** (`docs/ARCHITECTURE/Architecture_document_Finalized.md`). This SOW does not repeat those; it references them (e.g. “Architecture §8.6”, “§10.1 Planning Engine”).
- **Entrypoints:** The primary query path is `src/server/routes.ts` (POST /v1/query) → `src/server/query-handler.ts` → validateIngress → canonicalize → extractIntent → control plane → dispatch gate → pipeline/harness. The control plane produces a PipelinePlan; only the workflow runtime (pipelines/ or workflows/) executes workflows and calls engines.
- **Execution:** Work **phase-by-phase** (M1 → M2 → … → M6). Within a phase, complete tasks in the order given. A phase may span multiple conversations; resume by re-reading the SOW and the current phase’s **Entry criteria** and **Task list**.
- **Resume:** When resuming, (1) open this SOW and find the current phase (§4.1); (2) check **Entry criteria** are met; (3) continue from the next incomplete **Task**; (4) run **Verification** and satisfy **Exit criteria** before starting the next phase.
- **Locations:** Use the **exact file paths** and **module boundaries** in this SOW. When adding new code, follow **Conventions** (§0.2) and **Repository layout** (§2.5).
- **Verification:** After each task or phase, run the **Verification steps** listed. Consider the phase **complete** only when **Exit criteria** and **Definition of Done** are satisfied.
- **Gaps:** If a contract or type is missing in the repo, see **Contract and type gaps** (§2.6) and **What might need to be added** (§7); add the minimal type/schema in `src/contracts/` (or as specified) and re-export from `contracts/index.ts`.

---

## 0.2) Conventions and Technical Standards

- **Language:** TypeScript; strict mode. Use existing `tsconfig` and build commands.
- **Schemas:** Use **Zod** for runtime validation of contracts (see `src/contracts/*.ts`). Export both schema and inferred type (e.g. `XSchema`, `type X = z.infer<typeof XSchema>`).
- **Tests:** Unit tests live next to source as `*.test.ts` (e.g. `src/engines/execution_engine.test.ts`). Integration tests in `src/server/*.integration.test.ts` or under `tests/` as agreed. Run with `npm test`.
- **Imports:** Use path aliases or relative imports from `src/`; use `.js` extension in relative imports for ESM (e.g. `from "../contracts/index.js"`).
- **No engine-to-engine calls:** No file under `src/engines/` may import another file under `src/engines/` for the purpose of invoking an engine. Workflow runtime and orchestrator alone dispatch engines. Verify with a test or lint rule that engines do not import other engines.
- **Observability:** Emit events via `observability/` (e.g. `getObservability()?.events.emit(...)`). Use event types from Architecture §13 (ROUTE_DECISION, POLICY_DECISION, WORKFLOW_START/END, ENGINE_START/END, TOOL_*, MEMORY_*, etc.). Include `trace_id`, `request_id`, and cost/latency where applicable.
- **Errors:** Use contract error codes and `contracts/errors.ts` taxonomy where defined; avoid throwing raw strings.
- **Config/feature flags:** Add new flags in `src/config/schema.ts` (FeatureFlagsSchema) and document in config/SPEC. Defaults must be safe (e.g. new capabilities off in production until gated).
- **PipelinePlan = workflow execution spec:** The orchestrator output is `PipelinePlan` (see `src/contracts/pipeline-plan.ts`). Field `pipeline_type` is the workflow_id. Keep a single clear spec per request; workflow runtime consumes only this.

**Verification commands (run these to confirm phase/task completion):**

- `npm run build` — must pass (TypeScript compile).
- `npm test` — must pass (unit + integration tests).
- For M1+: no file under `src/engines/` may `import` from another file under `src/engines/` (grep or lint rule).
- After M1: `src/server/query.integration.test.ts` (or equivalent) must pass for the reactive chat path.

---

## 1) Architecture-to-Implementation Map

For each major part of the architecture document, the following table states **what it is**, **how it is implemented**, and **where it lives** (code/plans).

| Architecture Section | What It Is | How It Is Implemented | Current State / Plan |
|----------------------|------------|------------------------|----------------------|
| **North Star (§1)** | Single `POST /v1/query` API; canonicalize → intent → policy → workflows → gateways; coherent response + telemetry | Single entrypoint in `server/routes.ts` → `query-handler.ts`; flow: ingress → brainstem → control plane → router → pipeline → gateways; response assembly with telemetry | Ingress + Brain Stem done; Orchestrator + workflow runtime partial (L2-02 MVP) |
| **Core Principles (§2)** | Cognitive boundary, industry-agnostic core, multi-datatype, policy-gated, composability, observability, modality as input property | Enforced by: (1) no AI in ingress/validation, (2) engines only via gateways, (3) workflows as graphs not modality names, (4) contracts + observability events | Design rules; verified via code review + guardrails (§16) |
| **Layer 1 — Model Primitives (§3)** | Stateless inference: LLMs, classifiers, embeddings, vision/OCR | **Model Gateway** in `src/gateways/model-gateway.ts`; provider abstraction, retries, token/cost accounting; no planning/looping/tools in gateway | Exists; extended per provider and model type |
| **Layer 2 — Engines (§3, §10)** | 8 engines: Planning, Execution, Evaluation, Tool, Memory, Classification, Synthesis, Condensing; one gateway each; no orchestration | New `src/engines/` with one module per engine; each accepts EngineInvocation, returns EngineResult; gateways called only from engines | **All eight engines done (Segment M):** Execution, Synthesis, Classification, Tool, Evaluation, Memory, Planning, Condensing. See `docs/REFERENCE/Engines-and-Contracts.md`. |
| **Layer 3 — Workflows (§3, §11)** | Versioned graphs of engine calls; reactive chat, coding agent, deep research, tool automation, decision, extraction, verification, planning-only, batch | **Workflow registry** + definitions in `src/workflows/registry.ts`; runtime executes WorkflowDefinition via per-pipeline harnesses or workflow runner | All catalog workflows done (Segment M): reactive_chat, coding_agent, deep_research, decision, tool_automation, extraction, verification, planning_only, batch_analysis; nesting via runner |
| **Layer 4 — Orchestration (§3, §9)** | Ingress (mindless) + Brain Stem (canonicalize + intent) + Policy + Budgets + Workflow selection + Execution supervisor | `ingress/`, `brainstem/`, `controlplane/` (policy, budgets, dispatch), `router/`; orchestrator produces workflow execution spec (PipelinePlan); only orchestrator starts/stops loops, sub-workflows, budgets | Ingress + Brain Stem ✅; control plane + router ✅; workflow nesting later |
| **External API (§5)** | `POST /v1/query`; `GET /healthz`, `readyz`, `metrics`, `v1/version` | `server/routes.ts` + `query-handler.ts`; health/ready/metrics/version in server | Implemented; version endpoint as needed |
| **RequestEnvelope (§6.1)** | External request contract: contract_version, request_id, caller, input (text, attachments, structured), preferences | Validated in `ingress/validate.ts`; types in `contracts/request-envelope.ts`; schema + body size checks | L2-01; implemented |
| **ResponseEnvelope (§6.2)** | External response: status, output (text, structured, attachments, citations), telemetry, error | Built in query-handler / synthesis path; types in `contracts/response-envelope.ts` | L2-01; implemented |
| **Semantic reinforcement (§7)** | artifact_kind, schema_ref, provenance, sensitivity on all artifacts | All Typed Artifacts carry artifact_kind (required); schema_ref required for cross-engine artifacts; encoding for transport | Contracts in place; enforced in engine I/O (Milestone 2) |
| **CanonicalRequest (§8.1)** | Brain Stem output: unified multimodal representation, modality tags, token estimates, attachment handles | Produced in `brainstem/canonicalize.ts`; code-only; evolution to full Typed Artifact envelopes | Implemented; evolution in Milestone 2 |
| **IntentBundle (§8.2)** | Intent, complexity, risk_flags, tool_likelihood, requires_memory | Produced in `brainstem/intent.ts`; code and/or AI (rules vs classifier LLM); used by router | Implemented |
| **PolicyDecision (§8.3)** | allowed_workflows, budgets, memory_rules, safety_profile, audit_level | Produced in `controlplane/policy-evaluator.ts`; code-only from caller + rules | L2-01 contracts; L2-03 policy implementation |
| **Typed Artifact (§8.4)** | Universal envelope: artifact_id, artifact_kind, schema_ref, encoding, content, metadata | Used by all engines; created by code; content from code or model; validation by schema_ref | Contracts; full adoption in engines (Milestone 2) |
| **Task (§8.5)** | Unit of work: task_id, category, objective, input_artifacts, constraints | From WorkflowDefinition or Planning Engine; consumed by Execution/other engines | With workflow/planning implementation |
| **EngineInvocation / EngineResult (§8.6)** | Standard input/output for every engine | `engines/base.ts` or shared types; every engine implements same contract | **Implemented:** contracts + engine stubs; see `docs/REFERENCE/Engines-and-Contracts.md`. |
| **WorkflowDefinition (§8.7)** | workflow_id, version, entry_conditions, steps (engine_call | workflow_call | decision), stop_conditions | JSON definitions in `workflows/definitions/`; registry in `workflows/registry.ts`; runtime resolves steps and dispatches | Milestone 1–2; nesting in Milestone 6 |
| **Ingress (§9.1)** | TLS, auth, rate limit, payload limits, request ID, no AI | `ingress/validate.ts`, attachments, errors | ✅ Implemented |
| **Brain Stem (§9.2)** | Canonicalize → CanonicalRequest; intent → IntentBundle; no long loops | `brainstem/canonicalize.ts`, `intent.ts`, `preprocess.ts` | ✅ Implemented |
| **Orchestrator (§9.3)** | Policy, budgets, workflow selection, execution supervisor (state machine, retries, nesting) | `controlplane/` (policy-evaluator, resource-manager, tenant-budget, dispatch-gate), `router/default-router.ts`; output = PipelinePlan / workflow execution spec | Implemented; workflow spec consumed by runtime |
| **Workflow Runtime (§9.4)** | Execute WorkflowDefinition: resolve dependencies, dispatch engine calls, stop conditions | Per-workflow harness in `pipelines/` + workflow runner (`src/workflows/runner.ts`) for graph execution | Implemented; runner used for composite_example and Segment M workflows |
| **Engines (§9.5, §10)** | Planning, Execution, Evaluation, Tool, Memory, Classification, Synthesis, Condensing | One file per engine under `engines/`; each uses at most one gateway; EngineInvocation → EngineResult | All eight implemented (Segment M) |
| **Gateways (§12)** | Model, Tool, Memory choke points | `gateways/model-gateway.ts`, `tool-gateway.ts`; Memory via `memory/` (memory-gateway, retrieval-service, in-memory-store, structured-store, object-store) | Model + Tool gateways exist; Memory Gateway complete (Segment I): vector + structured + object, retention |
| **Observability (§13)** | Events: ROUTE_DECISION, POLICY_DECISION, WORKFLOW_START/END, ENGINE_*, TOOL_*, etc.; trace_id, cost, latency | `observability/` (emitter, events, metrics, redact, context); Prometheus text at GET /metrics (?format=prometheus or Accept: text/plain); span hierarchy tests | L2-04; implemented |
| **Repo layout (§14)** | Ingress, brainstem, controlplane, router, pipelines, workflows, engines, contracts, observability, server | Align `src/` to this layout; add `workflows/`, `engines/` and gateways under engines or gateways | L2-01 scaffold; workflows/ and engines/ added in milestones |
| **Guardrails (§16)** | Engines never call each other; only Orchestrator loops/sub-workflows/budgets; Tool deterministic; Memory scoped; no modality-named workflows | Code review + tests; no direct engine→engine calls; tool execution schema-validated only | Verification in implementation and tests |

---

## 2) Implementation Approach by Layer

### 2.1 Layer 1 — Model Primitives

- **Implementation:** Single **Model Gateway** module. No planning, looping, or tools in this layer.
- **Approach:** Provider abstraction (OpenAI / local / others), retries/fallbacks, token and cost accounting, optional cache, safety metadata. All model calls from Layer 2 engines go through this gateway.
- **Deliverables:** Keep/extend `gateways/model-gateway.ts`; add provider adapters and cost/token accounting as needed.

### 2.2 Layer 2 — Engines

- **Implementation:** One module per engine under `src/engines/`. Each engine:
  - Accepts **EngineInvocation** (task, context_artifacts, actor_context, budgets, safety).
  - Returns **EngineResult** (status, result_artifacts, proposed_next_action, metrics).
  - Uses **at most one** of: Model Gateway, Tool Gateway, Memory Gateway.
  - Does not call another engine; does not orchestrate.
- **Approach:** Base interface in `engines/base.ts`; engines implemented incrementally (Execution + Synthesis + Classification first, then Planning, Tool, Memory, Evaluation, Condensing). For Milestone 1, “stub” means: implements the EngineInvocation → EngineResult contract; may return minimal success or delegate to Model Gateway with minimal prompt; does not use Tool or Memory gateways (see §0.1).
- **Deliverables:** `planning_engine.ts`, `execution_engine.ts`, `evaluation_engine.ts`, `tool_engine.ts`, `memory_engine.ts`, `classification_engine.ts`, `synthesis_engine.ts`, `condensing_engine.ts`; plus gateways as choke points.

### 2.3 Layer 3 — Workflows

- **Implementation:** Workflows are **versioned graphs** (WorkflowDefinition). Workflow runtime:
  - Loads definitions from `workflows/definitions/*.json` and registry.
  - Resolves step dependencies, dispatches engine calls via orchestrator/engine layer.
  - Handles `engine_call`, `workflow_call` (nested), and `decision` steps.
  - Enforces stop_conditions (max_iterations, deadline_ms) as directed by orchestrator.
- **Approach:** Start with Reactive Chat as single-pass graph; add Coding Agent (plan/execute/tool/eval loop), then Deep Research, Tool Automation, Decision, Extraction, Verification, Planning-only, Batch. Nested workflows in a later phase.
- **Deliverables:** `workflows/registry.ts`, `workflows/definitions/reactive_chat.json`, then other workflow JSONs; workflow graph executor or equivalent harness per workflow until full graph executor exists.

### 2.4 Layer 4 — Orchestration

- **Implementation:** Combines existing **Ingress** (deterministic) and **Brain Stem** (canonicalize + intent) with:
  - **Policy:** policy-evaluator produces PolicyDecision (allowed_workflows, budgets, memory_rules, safety_profile).
  - **Budgets:** resource-manager / tenant-budget enforce token, cost, tool, time limits.
  - **Workflow selection:** router maps IntentBundle + PolicyDecision → workflow_id (pipeline_type) and strategy.
  - **Execution supervisor:** state machine, retries, fallbacks, nested workflow calls; only orchestrator starts/stops loops and allocates budgets.
- **Approach:** Orchestrator output is a single **workflow execution spec** (PipelinePlan: workflow_id/pipeline_type, strategy, budgets, tools_enabled, memory, models). Workflow runtime consumes this only; it does not bypass policy or budgets. Request flow: `routes.ts` → `query-handler.ts` → ingress validate → brainstem → control plane → dispatch gate → pipeline/harness (see §0.1).
- **Deliverables:** Keep and harden `controlplane/`, `router/`; ensure one clear spec per request; add nesting and budget inheritance when adding sub-workflows.

### 2.5) Repository Layout (Exact Paths)

Implement under `src/`. Create only what is specified; do not add top-level folders not listed here.

| Path | Purpose |
|------|--------|
| `src/ingress/` | Request validation, auth, payload limits; no AI. Existing. |
| `src/brainstem/` | Canonicalize → CanonicalRequest; intent → IntentBundle. Existing. |
| `src/controlplane/` | Policy, budgets, dispatch gate; produces PipelinePlan. Existing. |
| `src/router/` | Maps IntentBundle + PolicyDecision → pipeline_type (workflow_id) + PipelinePlan. Existing. |
| `src/pipelines/` | Per-workflow harnesses implementing `IPipeline` (run(input) → ResponseEnvelope). Existing: `chat-pipeline.ts`. |
| `src/workflows/` | **Add:** Workflow registry and definition loader. |
| `src/workflows/definitions/` | **Add:** JSON files for each workflow (reactive_chat.json, coding_agent.json, …). |
| `src/engines/` | **Add:** One module per engine; base interface; no engine imports another engine. |
| `src/gateways/` | Model, Tool gateways. Memory abstraction under `src/memory/`. Existing. |
| `src/contracts/` | All shared schemas and types (RequestEnvelope, ResponseEnvelope, CanonicalRequest, IntentBundle, PolicyDecision, PipelinePlan, TypedArtifact, EngineInvocation, EngineResult, Task, WorkflowDefinition). Add missing ones here. |
| `src/observability/` | Events, metrics, tracing, redaction. Existing. |
| `src/server/` | Routes, query-handler. Existing. |
| `src/config/` | Config schema, feature flags. Existing. |

Tests: `*.test.ts` next to source. Integration: `*.integration.test.ts` under `src/server/` or `tests/` as in project.

### 2.6) Contract and Type Gaps (To Add When Implementing)

The architecture defines these; the codebase may not yet have them. Add under `src/contracts/` with Zod schemas and export from `contracts/index.ts`.

| Contract | Architecture ref | Notes |
|---------|------------------|--------|
| **TypedArtifact** | §8.4 | artifact_id, artifact_kind (required), schema_ref, encoding, content (inline/ref), metadata (provenance, sensitivity). |
| **EngineInvocation** | §8.6 | invocation_id, engine_type, task, context_artifacts, actor_context, budgets, safety, metadata (trace_id, contract_version). |
| **EngineResult** | §8.6 | invocation_id, status, result_artifacts, confidence, proposed_next_action, metrics, error. |
| **Task** | §8.5 | task_id, task_type, category, objective, input_artifacts, expected_output_schema, constraints_hints. |
| **WorkflowDefinition** | §8.7 | workflow_id, version, entry_conditions (intents, required_capabilities, risk_allowed), steps (step_id, kind, ref, input_mapping, depends_on), stop_conditions. |

**Status:** All of the above are now implemented in `src/contracts/` and exported from `contracts/index.ts`. WorkflowDefinition is in `workflow-definition.ts`; workflow registry is in `src/workflows/registry.ts` with `workflows/definitions/reactive_chat.json`.

Engine-specific invocation shapes (e.g. PlanningInvocation §10.1) can be extensions or sub-types of EngineInvocation; keep one canonical EngineInvocation/EngineResult for the engine boundary.

## 3) Full Scope of Work

### 3.1 Scope Statement

The Scope of Work covers the end-to-end implementation of the **Centralized Multimodal AI Server** as specified in the Architecture document: a single primary endpoint (`POST /v1/query`) that canonicalizes input, extracts intent and risk, enforces policy and budgets, selects and runs workflows composed of engines, and returns a coherent response with full telemetry. Implementation is **TypeScript** under `src/`, with contracts, gateways, engines, workflows, and orchestration aligned to the four-layer model (Models → Engines → Workflows → Orchestration).

### 3.2 In Scope

- **Contracts:** RequestEnvelope, ResponseEnvelope, CanonicalRequest, IntentBundle, PolicyDecision, Typed Artifact, Task, EngineInvocation, EngineResult, WorkflowDefinition, PipelinePlan (workflow execution spec). Versioning and validation.
- **Ingress & Brain Stem:** Maintain and extend as needed; no AI in ingress; Brain Stem produces CanonicalRequest + IntentBundle; evolution to full Typed Artifact envelopes where applicable.
- **Orchestration:** Policy evaluation, budget enforcement, workflow selection, execution supervisor (state machine, retries, fallbacks, nested workflow calls when implemented).
- **Workflow runtime:** Workflow registry, WorkflowDefinition loading, step resolution, engine dispatch, stop conditions; one harness per workflow initially, then graph-based execution where beneficial.
- **Engines:** All eight engines (Planning, Execution, Evaluation, Tool, Memory, Classification, Synthesis, Condensing) as bounded modules with single-gateway use and EngineInvocation/EngineResult contract.
- **Gateways:** Model Gateway (provider abstraction, retries, token/cost); Tool Gateway (registry, sandbox, timeouts, secrets); Memory Gateway (vector/structured/object store, scope, retention).
- **Workflows:** Reactive Chat, Coding Agent, Deep Research, Tool Automation, Decision & Recommendation, Extraction & Normalization, Verification/Audit, Planning-only, Batch Analysis; workflow nesting when in scope.
- **Observability:** Required events taxonomy (ROUTE_DECISION, POLICY_DECISION, WORKFLOW_*, ENGINE_*, TOOL_*, MEMORY_*, etc.); trace_id, request_id, cost, latency; OTEL/Prometheus/redaction.
- **Config & feature flags:** Central config schema, load order, feature flags for non-core capabilities, failure-fast startup.
- **CI & quality:** Lint, type-check, unit and integration tests, contract validation, security scanning; deterministic gates.
- **Security & compliance:** Policy-gated execution, redaction, audit trails, secret handling, sandbox for tools.
- **Operational readiness:** Health/ready/metrics/version endpoints; runbooks; rollout and rollback strategy.

**Implementation reinforcement (for agents)**  
- **Tests:** Each engine must have unit tests for EngineInvocation → EngineResult (happy path + at least one failure). Each workflow/pipeline must have at least one integration test from query entrypoint. All contracts must have validation tests; CI runs lint, type-check, and these tests as gates. See §0.1.
- **Errors:** Use existing ingress and contract error shapes; map engine/workflow failures to `ResponseEnvelope.error` with stable `code`; preserve `trace_id` and `request_id` in responses and events.
- **Contracts:** Do not change existing `contract_version` or remove required fields; new fields must be optional or additive; document in Architecture and `contracts/CHANGELOG.md` when applicable.
- **Observability:** Emit events per Architecture §13; every engine call must emit ENGINE_START/ENGINE_END (or equivalent) with trace_id and metrics; Tool/Memory usage must emit TOOL_*/MEMORY_* events.
- **Security:** Tool Gateway must enforce allowlists from PolicyDecision; no raw secrets in logs (use observability redaction); sandbox and scope as specified in Architecture §12 and §16.

### 3.3 Out of Scope

- Product-specific or industry-specific business logic beyond configs, tool adapters, and schemas.
- Building net-new transport protocols (HTTP-only for primary API).
- UI or customer-facing dashboards (observability data export only).
- Enabling autonomous harness execution in production until the L2-99 readiness gate has passed (implementation is complete and gated by `harness_autonomous_execution_enabled`; set to true only after formal go and sign-off).

### 3.4 Dependencies

- **Upstream:** Architecture document finalized; contract and schema versioning policy agreed.
- **Cross-plan:** L2-01 (Contracts & Scaffold) before MVP and policy work; L2-02 (MVP Chat) before complex workflows; L2-03 (Policy/Budgeting/Routing) for enforcement; L2-04 (Observability); L2-05 (Security); L2-06 (Memory); L2-07 (Multimodal); L2-08 (Rollout); L2-99 (Coding Agent Harness) after readiness gate.
- **External:** Model provider APIs, telemetry backend, (optional) vector/store backends for memory.

---

## 4) Phased Deliverables (Aligned to Architecture Milestones)

| Phase | Name | Deliverables | Plan Reference |
|-------|------|--------------|----------------|
| **M1** | Orchestrator entrypoint + simplest workflow | Ingress + Brain Stem unchanged; Orchestrator skeleton (policy, budgets, workflow selection); Reactive Chat workflow; Execution + Synthesis + Classification engine stubs; OTEL spans ingress → brainstem → orchestrator → workflow → engines | §15 Milestone 1; L2-02 |
| **M2** | Typed Artifacts end-to-end | CanonicalRequest produces typed artifacts/refs; engines consume/produce artifacts only; Synthesis outputs ResponseEnvelope attachments | §15 Milestone 2 |
| **M3** | Tool Engine + Coding Agent | Tool gateway sandbox + allowlists; Coding Agent workflow (planning → execution ↔ tool ↔ evaluation); verification via tests/build | §15 Milestone 3; L2-05 |
| **M4** | Memory Engine + document-grounded | Memory gateway (vector + structured + object store); workflows with required_capabilities.needs_memory; citation grounding | §15 Milestone 4; L2-06 |
| **M5** | Deep Research + Decision workflows | Deep Research (gather → synthesize → critique; ResearchReport artifact); Decision & Recommendation (DecisionMemo artifact) | §15 Milestone 5 |
| **M6** | Workflow nesting | Parent workflows call sub-workflows via orchestrator; inherited budgets and trace continuity | §15 Milestone 6 |

**Recommended execution order (linear)**  
1. L2-01 (Contracts & Scaffold) — contract freeze, scaffold, config, CI.  
2. M1 — Orchestrator skeleton + Reactive Chat workflow + Execution/Synthesis/Classification stubs; OTEL across ingress → brainstem → orchestrator → workflow → engines.  
3. L2-03 — Full policy evaluation and budget enforcement in orchestrator.  
4. M2 — Typed Artifacts end-to-end; CanonicalRequest/engines/Synthesis produce consume artifacts only.  
5. L2-04 — Observability event taxonomy, metrics, tracing, redaction.  
6. M3 — Tool Engine + Tool Gateway sandbox + Coding Agent workflow.  
7. L2-05 — Security (isolation, sandbox, compliance).  
8. M4 — Memory Engine + Memory Gateway + document-grounded workflows.  
9. L2-06 — Memory implementation per plan.  
10. M5 — Deep Research + Decision workflows.  
11. M6 — Workflow nesting.  
12. L2-07, L2-08 — Multimodal hardening, rollout and ops. L2-99 (Coding Agent Harness): autonomous loop implemented and gated by `harness_autonomous_execution_enabled`; enable only after readiness gate passes.

Additional cross-cutting work (from existing L2 plans):

- **Contracts & scaffold (L2-01):** Contract freeze, runtime scaffold, config, feature flags, CI baseline — foundation for all phases.
- **Policy, budgeting, routing (L2-03):** Full policy evaluation and budget enforcement in orchestrator.
- **Observability (L2-04):** Full event taxonomy, metrics, tracing, redaction.
- **Security (L2-05):** Isolation, sandbox, compliance controls.
- **Multimodal (L2-07):** Multimodal canonicalization and attachment handling.
- **Rollout & ops (L2-08):** Production rollout, runbooks, on-call readiness.

---

## 4.1) Phase Execution Guide (For Coding Agent)

Each phase has **entry criteria**, **ordered tasks** with file paths and “done when”, **verification steps**, and **exit criteria**. Do not start a phase until entry criteria are met. Mark the phase complete only when exit criteria and definitions of done are satisfied.

---

### Resume here (current phase)

**As of latest implementation-baseline update:** Segments A through **L**, **Segment M**, **Segment N (closure)**, and **Segment I** (L2-06 Memory Gateway expansion) are implementation-complete. Production hardening and operational readiness must be validated against [`to-do.md`](../../to-do.md) before claiming production-ready status.

**Best recommendation — continue from:**

| Priority | Segment | What to do |
|----------|---------|------------|
| — | *(current)* | All phased segments (A–O) complete; L2-99 autonomous harness implemented (enable via flag after gate). Next: production sign-off, L2-07/L2-08 hardening per plans, or net-new features per Architecture. |

**Resume steps for a coding agent:**

1. **If adding new work:** (1) Open Architecture and SOW §4 / §9 for the target phase; (2) Follow entry criteria and task order; (3) Run verification after each task.

**Quick verification (before marking L.5 done):** `npm run build` && `npm test`; grep for `ATTACHMENT_REJECTED`, `MULTIMODAL_UNSUPPORTED`, `attachment_reject_total` in `src/` (L.1a); confirm runbook links in `docs/SPEC/22_Runbooks_and_Operations.md`.

**References:** §9 Segment I (Memory), Segment O (Hardening); L2-06 Memory plan; L2-07 Multimodal, L2-08 Rollout; `docs/OPERATIONS/RUNBOOKS/`, `docs/OPERATIONS/RUNBOOKS/` (both path forms); `src/server/routes.ts`, `src/rollout/policy.ts`.

---

### M1 — Orchestrator entrypoint + simplest workflow

**Current state (as of last SOW update):** Segment A through **Segment K** (M6), **Segment L**, **Segment M**, **Segment N**, and **Segment I** (L2-06 Memory Gateway) are **complete**. Resume from **Segment O** (production hardening) per §4.

**Entry criteria:** L2-01 complete (contracts, scaffold, config, CI). Ingress and Brain Stem and control plane + router exist and are wired in `query-handler.ts`.

**Tasks (in order):**

1. **Add engine contracts**  
   Add `src/contracts/typed-artifact.ts`, `engine-invocation.ts`, `engine-result.ts`, `task.ts` (see Architecture §8.4–8.6). Export from `contracts/index.ts`.  
   **Done when:** Validators exist for EngineInvocation and EngineResult (or equivalent parse); types exported; `npm run build` passes.

2. **Add engines scaffold**  
   Create `src/engines/base.ts` exporting interface `IEngine { invoke(inv: EngineInvocation): Promise<EngineResult> }`.  
   Create stubs: `src/engines/execution_engine.ts`, `synthesis_engine.ts`, `classification_engine.ts` each implementing `IEngine`, returning valid EngineResult (e.g. success with minimal result_artifacts). Execution/Synthesis may call Model Gateway; Classification may call Model Gateway or return stub labels. No engine may import another engine.  
   **Done when:** `npm run build` passes; each stub has a unit test that calls `invoke` with minimal EngineInvocation and asserts EngineResult shape and status.

3. **Wire Reactive Chat to engines**  
   Refactor `src/pipelines/chat-pipeline.ts` (or add a thin adapter) so the reactive chat path builds EngineInvocation(s) for Execution and Synthesis, calls the corresponding engines, and assembles ResponseEnvelope from EngineResult(s). Keep existing `IPipeline` and `PipelineInput`; plan from `input.plan` (PipelinePlan).  
   **Done when:** Existing chat integration test still passes; telemetry shows engine_calls.

4. **OTEL / observability spans**  
   Ensure one span across ingress → brainstem → orchestrator → workflow → engine(s). Emit WORKFLOW_START and WORKFLOW_END (or PIPELINE_START/PIPELINE_END) and ENGINE_START/ENGINE_END for each engine call (Architecture §13).  
   **Done when:** Observability tests or a single query run show span hierarchy and events.

**Verification:** `npm run build`, `npm test`. Run `src/server/query.integration.test.ts`; no regressions. Confirm no file under `src/engines/` imports from another under `src/engines/`.

**Exit criteria:** Reactive Chat runs through orchestrator and at least Execution + Synthesis engines; OTEL spans cover the path; engine boundary is clear and tested.

---

### M2 — Typed Artifacts end-to-end

**Entry criteria:** M1 complete. EngineInvocation/EngineResult and engine stubs exist. Reactive Chat uses engines.

**Tasks (in order):**

1. **CanonicalRequest → Typed Artifacts**  
   Evolve `brainstem/canonicalize.ts` so its output can be represented as or converted to Typed Artifacts (or attachment handles + structured payload with artifact_kind/schema_ref where applicable). See Architecture §8.1, §8.4.  
   **Done when:** CanonicalRequest (or derived structure) carries artifact_kind and, where needed, schema_ref for downstream engines.

2. **Engines consume and produce only artifacts**  
   Execution, Synthesis, Classification accept context_artifacts and task input_artifacts as Typed Artifacts; they return result_artifacts as Typed Artifacts (artifact_kind, schema_ref set).  
   **Done when:** All engine I/O uses the Typed Artifact envelope; no raw string payloads crossing the engine boundary.

3. **Synthesis → ResponseEnvelope attachments**  
   Map Synthesis output (final_response artifact) to ResponseEnvelope `output.text`, `output.structured`, `output.attachments` (artifact_uri, artifact_kind).  
   **Done when:** ResponseEnvelope.attachments populated from Synthesis result_artifacts where applicable.

**Verification:** `npm run build`, `npm test`. Contract tests for Typed Artifact and engine I/O.

**Exit criteria:** End-to-end request produces ResponseEnvelope built from Typed Artifacts; artifact_kind and schema_ref present on cross-engine artifacts. **Met:** canonicalToTypedArtifacts, engine schema_ref, output.attachments, contract tests.

---

### M3 — Tool Engine + Coding Agent

**Entry criteria:** M2 complete. Tool Gateway exists (`src/gateways/tool-gateway.ts`). Policy/allowed_tools in place (L2-03/L2-05).

**Tasks (in order):**

1. **Tool Execution Engine**  
   Implement `src/engines/tool_engine.ts`: accepts EngineInvocation with tool_id, parameters, sandbox_profile; calls Tool Gateway only; returns EngineResult with tool_result artifact (Architecture §10.4). No model calls.  
   **Done when:** Unit test passes with mock Tool Gateway; tool_engine never imports model gateway or another engine.

2. **Tool Gateway sandbox and allowlists**  
   Tool Gateway enforces allowlist (from policy), sandbox options (network_access, filesystem_access, timeout_ms), and returns structured tool result (Architecture §12).  
   **Done when:** Tool call denied when not in allowlist; allowed call returns result within timeout.

3. **Coding Agent workflow**  
   Add workflow definition (e.g. `workflows/definitions/coding_agent.json`) and/or harness in `pipelines/` that runs: planning → (execution ↔ tool ↔ evaluation)* → synthesis. Use Planning Engine for WorkflowPlan; workflow runtime executes tasks, dispatches Tool Engine when proposed_next_action is call_tool; Evaluation for verification.  
   **Done when:** Integration test for coding-agent path runs; tool_calls and engine_calls in telemetry; verification step can pass/fail.

**Verification:** `npm run build`, `npm test`; integration test for coding agent; security/audit tests for tool deny.

**Exit criteria:** Tool Engine and Coding Agent workflow implemented; tools gated by policy; verification loop present.

---

### M4 — Memory Engine + document-grounded

**Entry criteria:** M3 complete. Memory abstraction exists (`src/memory/`); L2-06 retrieval service and stores available.

**Tasks (in order):**

1. **Memory Engine**  
   Implement `src/engines/memory_engine.ts`: operation (retrieve | write | delete), scope, query, artifacts; calls Memory Gateway only; returns memory_response artifact (Architecture §10.5).  
   **Done when:** Unit test with mock Memory Gateway; no model/tool calls inside engine (semantic search may use gateway-internal embedding; contract is code-assembled).

2. **Workflows with needs_memory**  
   Workflow definitions that require memory carry `required_capabilities.needs_memory`; orchestrator/plan includes memory config when policy allows.  
   **Done when:** At least one workflow uses Memory Engine for retrieval; citations in response when memory returns hits.

3. **Citation grounding**  
   ResponseEnvelope citations populated from memory_response and/or synthesis; traceability to source.  
   **Done when:** E2E test with memory returns citations in output.

**Verification:** `npm run build`, `npm test`; retrieval integration tests; scope enforcement (user/project) respected.

**Exit criteria:** Memory Engine implemented; at least one workflow uses memory; citations in response. **Met:** `src/engines/memory_engine.ts`, reactive_chat uses Memory Engine when plan.memory set; `reactive_chat.json` has `required_capabilities.needs_memory`; chat-pipeline populates citations from memory_response; query-handler passes memoryStore to chat pipeline for reactive_chat.

---

### M5 — Deep Research + Decision workflows

**Entry criteria:** M4 complete. Tool and Memory engines exist.

**Tasks (in order):**

1. **Deep Research workflow**  
   Add workflow definition and runtime: planning → (tool:web_search ↔ execution:summarize ↔ evaluation:coverage/consistency)* → synthesis:report. Output ResearchReport artifact (Architecture §11.3).  
   **Done when:** Integration test “research X” returns structured report with evidence; stop conditions (coverage, deadline) enforced.

2. **Decision & Recommendation workflow**  
   Add workflow: planning → execution(generate options) → evaluation(score/rank) → synthesis(decision memo). Output DecisionMemo artifact (Architecture §11.5).  
   **Done when:** Integration test with decision-style prompt returns options, scores, recommendation.

**Verification:** `npm run build`, `npm test`; workflow-specific integration tests.

**Exit criteria:** Deep Research and Decision workflows implemented and tested.

---

### M6 — Workflow nesting

**Entry criteria:** M5 complete. Workflow registry and definitions exist; orchestrator produces PipelinePlan.

**Tasks (in order):**

1. **Sub-workflow invocation**  
   Orchestrator can invoke a sub-workflow (workflow_call step); WorkflowDefinition steps may have kind: "workflow_call", ref: sub_workflow_id. Orchestrator passes down budgets (inherited, not exceeding parent) and trace_id.  
   **Done when:** Parent workflow includes a step that calls another workflow; E2E run shows nested execution and correct telemetry (workflow_id for parent and child).

2. **Budget inheritance and trace continuity**  
   Sub-workflow runs with budgets ≤ parent; all engine/tool/memory events carry same trace_id; cost/latency rolled up to parent.  
   **Done when:** Test that exceeds budget in child fails without exceeding parent budget; trace tree is continuous.

**Verification:** `npm run build`, `npm test`; integration test for nested workflow and budget inheritance.

**Exit criteria:** Nested workflows run via orchestrator; budgets and trace correctly inherited and enforced.

---

## 5) Deliverables Checklist (Consolidated)

- [x] **Contracts:** All external and internal contracts (RequestEnvelope, ResponseEnvelope, CanonicalRequest, IntentBundle, PolicyDecision, Typed Artifact, Task, EngineInvocation, EngineResult, WorkflowDefinition) defined, versioned, and validated. (L2-01)
- [x] **Scaffold:** Repo layout aligned to architecture (ingress, brainstem, controlplane, router, pipelines, workflows, engines, contracts, observability, server). (L2-01)
- [x] **Config & flags:** Config schema, load order, feature flag registry, failure-fast startup. (L2-01)
- [x] **CI:** Lint, type-check, unit/integration tests, contract and security checks. (L2-01)
- [x] **Ingress:** Validation, auth, rate limit, payload limits, request ID; no AI. (Done)
- [x] **Brain Stem:** Canonicalize → CanonicalRequest; intent → IntentBundle; evolution to typed artifacts. (Done; evolution in M2)
- [x] **Orchestrator:** Policy + budgets + workflow selection + execution supervisor; single workflow execution spec (PipelinePlan). (L2-02, L2-03)
- [x] **Workflow runtime:** Registry, WorkflowDefinition loading, step execution, engine dispatch; Reactive Chat then other workflows. WorkflowDefinition JSON must conform to Architecture §8.7 and §11; registry loads from `workflows/definitions/` and exposes by workflow_id + version. (M1–M6)
- [x] **Engines:** All eight engines implemented with EngineInvocation/EngineResult; single gateway per engine. (M1–M5) — *Execution, Synthesis, Classification, Tool, Evaluation, Memory, Planning, Condensing done (Segment M).*
- [x] **Model Gateway:** Provider abstraction, retries, token/cost accounting. (Existing; extend)
- [x] **Tool Gateway:** Registry, sandbox, timeouts, allowlists, secrets. (L2-05, M3) — *Allowlist + sandbox + StubAllowedToolGateway; deny-only default*
- [x] **Memory Gateway:** Vector/structured/object store, scope, retention. (L2-06, M4) — *Engine uses `src/memory/` (IMemoryStore, runRetrieval); reactive_chat calls Memory Engine; L2-06 Phase 0–1 implemented; Segment I complete: IMemoryGateway (vector + structured + object), retention config in schema, InMemoryStore retention (TTL/max_chunks), unit tests for structured/object stores.*
- [x] **Workflows:** Reactive Chat, Coding Agent, Deep Research, Tool Automation, Decision, Extraction, Verification, Planning-only, Batch; nesting in M6. (M1–M6) — *All done: Reactive Chat (with Memory Engine), Coding Agent, Deep Research, Decision, Tool Automation, Extraction, Verification, Planning-only, Batch (Segment M).*
- [x] **Observability:** Event taxonomy, trace_id/request_id, cost/latency, Prometheus text export, redaction. (L2-04)
- [x] **Security:** Policy enforcement, redaction, audit, sandbox, compliance. (L2-05) — *Segment G complete; Segment O.1: L2-05 Phases 0–4 implemented (audit, secret scope, tool deny, abuse tests, security gate); no residual controls.*
- [x] **Multimodal:** Canonicalization of attachments and structured input. (L2-07) — *Segment L.1 complete: attachment validation, Brain Stem multimodal, router capability checks, runbook linked in SPEC 22.*
- [x] **Rollout:** Runbooks, health/ready/metrics/version, rollout and rollback. (L2-08) — *Segment L.2–L.5 complete: endpoints confirmed, Query-and-Policy-Failures runbook, on-call/escalation in SPEC 22, rollout policy reference, L2-99 gate documented.*
- [x] **L2-99 Autonomous harness:** Coding-agent autonomous loop (execution ↔ tool)* → evaluation → synthesis implemented; gated by `harness_autonomous_execution_enabled` (default false). Enable after readiness gate and sign-off. See `docs/OPERATIONS/RUNBOOKS/Harness-Readiness-Gate.md`, `docs/SPEC/20_Config_and_FeatureFlags.md`.
- [x] **Closure (Segment N):** Error code taxonomy documented (`src/contracts/errors.ts`, `src/contracts/ERROR_CODES.md`); `npm run verify:sow` (lint → typecheck → build → test) passes; §6 Acceptance Criteria confirmed; lint clean.

---

## 6) Acceptance Criteria (Summary)

- **Functional:** Single `POST /v1/query` path from ingress through brain stem, orchestrator, selected workflow, and engines to ResponseEnvelope; all workflows in catalog implementable; contracts validated end-to-end.
- **Non-functional:** Schema validation overhead within budget (<5ms where specified); CI stable and required checks passing; latency/cost targets met per plan.
- **Security/Compliance:** No AI in ingress; policy and budgets enforced; tool execution deterministic and gated; memory scoped; audit trail for decisions and access.
- **Architecture:** Engines do not call each other; only orchestrator starts/stops loops and sub-workflows; workflows selected by intent/complexity/risk/capabilities, not modality; single workflow execution spec per request.
- **Documentation:** Contract versioning policy, schema examples, runbooks, and handoff docs current and linked.
- **Testing:** Unit tests per engine (EngineInvocation → EngineResult); at least one integration test per workflow from query entrypoint; contract validation tests for all exported contracts; CI gates include lint, type-check, and these tests.
- **Observability:** Required events (§13) emitted at appropriate points; trace_id and request_id carried on all events; cost and latency recorded for engine/tool/memory usage.

---

## 7) What Might Need to Be Added (Recommendations)

Use this section when implementing or extending the system. Add only what the current phase or task requires; do not add speculative code.

| Area | What to add | When | Where / notes |
|------|-------------|------|----------------|
| **Contracts** | TypedArtifact, EngineInvocation, EngineResult, Task, WorkflowDefinition | Before or during M1 | `src/contracts/*.ts`; Zod schemas; export from `contracts/index.ts`. Use Architecture §8 for field lists. |
| **Feature flags** | Flags for new workflows or engines (e.g. `coding_agent_workflow_enabled`, `memory_engine_enabled`, `harness_autonomous_execution_enabled`) | When adding a new workflow or engine | `src/config/schema.ts` FeatureFlagsSchema; default `false` in production until gated. Document in config/SPEC. L2-99: `harness_autonomous_execution_enabled` enables autonomous (execution ↔ tool)* loop in coding-agent pipeline; env `HARNESS_AUTONOMOUS_EXECUTION_ENABLED`. |
| **Event types** | New event names if not in Architecture §13 | When adding a new step type or gateway | `observability/events.ts` or equivalent; include in required-events list if observability plan requires it. |
| **Workflow definitions** | JSON files per workflow | M1 (reactive_chat), M3 (coding_agent), M4 (if needed), M5 (deep_research, decision), etc. | `src/workflows/definitions/<workflow_id>.json`. Conform to WorkflowDefinition schema (§8.7); steps reference engine_type or sub_workflow_id. |
| **Schema refs** | Central registry or enum for schema_ref URIs (e.g. `schema://workflow_plan@v1`) | When engines produce artifacts with schema_ref | **Done:** `docs/REFERENCE/schemas/schema-ref-catalog.md` (Segment O.2). Optional code enum in `contracts/schema-refs.ts` if desired. |
| **Engine registry** | Map engine_type string → IEngine implementation | When multiple engines are used by workflow runtime | e.g. `src/engines/registry.ts` or passed into workflow runner; orchestrator or runtime resolves and invokes. |
| **Lint / guardrails** | Rule or test that engines do not import other engines | M1 or when engines folder exists | ESLint no-restricted-imports for `src/engines/*` importing from `src/engines/*`, or unit test that greps engine files for imports from engines. |
| **Integration test helpers** | Minimal RequestEnvelope / CanonicalRequest builders for tests | When writing integration tests | e.g. `tests/fixtures/request-builder.ts` or in existing test utils; avoid duplicating full schema in every test. |
| **Runbooks** | Steps for “query fails”, “tool denied”, “budget exceeded”, “rollback” | L2-08 / rollout | **Done:** `docs/OPERATIONS/RUNBOOKS/Query-and-Policy-Failures.md` (triage for query failure, tool denied, budget exceeded); rollback in `Release-and-Rollback.md`. Runbook index and on-call/escalation in `docs/SPEC/22_Runbooks_and_Operations.md`. Linked from SOW and Master plan (Segment L.2b complete). |
| **CHANGELOG** | Contract or API change entries | When changing RequestEnvelope, ResponseEnvelope, or public contract | `src/contracts/CHANGELOG.md` or project root CHANGELOG; note version and breaking vs additive. |

If the architecture document already specifies something in detail (e.g. exact JSON for EngineResult), do not duplicate it here—implement to the architecture and add only the minimal code and config needed to satisfy the SOW phase.

- **schema_ref catalog (optional):** A single place (e.g. Architecture appendix or `docs/REFERENCE/schemas/`) listing all `schema_ref` URIs and artifact kinds for consistent validation across engines. **Done:** `docs/REFERENCE/schemas/schema-ref-catalog.md` (Segment O.2).
- **Error code taxonomy:** Central list of `ResponseEnvelope.error.code` and when each is used (e.g. POLICY_DENIED, BUDGET_EXCEEDED, TOOL_TIMEOUT). Can live in `src/contracts/errors.ts` plus a short doc. See Segment N.1.
- **Verification script (optional):** A command (e.g. `npm run verify:sow`) that runs lint, type-check, contract tests, and a minimal e2e so “phase complete” is machine-checkable. See Segment N.2.

---

## 8) References

- **Architecture:** `docs/ARCHITECTURE/Architecture_document_Finalized.md`
- **Task backlog:** [`to-do.md`](../../to-do.md) (includes former master-plan phase tasks in §10)
- **Implementation plans:** `docs/PLANS/implementation/L2-01_Contracts-and-Project-Scaffold.md` through L2-08, L2-99.
- **Architecture milestones (§15):** Milestones 1–6 in Architecture document.

---

## 9) Segmented Task List (Execution Checklist)

Use this list for resuming work and tracking progress. Complete segments in order; within each segment, complete tasks in sequence. Reference §4.1 for full task descriptions and verification steps.

---

### Segment A — Foundation (L2-01: Contracts & Scaffold)

| # | Task | Done |
|---|------|------|
| A.1 | Add/verify RequestEnvelope and ResponseEnvelope contracts and validation | ☑ |
| A.2 | Add/verify CanonicalRequest, IntentBundle, PolicyDecision in contracts | ☑ |
| A.3 | Add PipelinePlan (workflow execution spec) contract | ☑ |
| A.4 | Add TypedArtifact contract (artifact_id, artifact_kind, schema_ref, encoding, content, metadata) | ☑ |
| A.5 | Add Task contract (task_id, category, objective, input_artifacts, constraints) | ☑ |
| A.6 | Add EngineInvocation and EngineResult contracts; export all from `contracts/index.ts` | ☑ |
| A.7 | Add WorkflowDefinition contract (workflow_id, version, steps, stop_conditions) | ☑ |
| A.8 | Align repo layout: ensure `src/ingress`, `brainstem`, `controlplane`, `router`, `pipelines`, `contracts`, `observability`, `server`, `config` exist | ☑ |
| A.9 | Create `src/workflows/` and `src/workflows/definitions/` | ☑ |
| A.10 | Create `src/engines/` (empty until M1) | ☑ |
| A.11 | Config schema and feature flags in `src/config/schema.ts`; document in config/SPEC | ☑ |
| A.12 | CI: lint, type-check, unit/integration test gates | ☑ |
| A.13 | Run `npm run build` and `npm test`; all pass | ☑ |

---

### Segment B — M1: Orchestrator + Reactive Chat + Engine Stubs

| # | Task | Done |
|---|------|------|
| B.1 | Add `src/contracts/typed-artifact.ts`, `engine-invocation.ts`, `engine-result.ts`, `task.ts`; export from index | ☑ |
| B.2 | Create `src/engines/base.ts` with `IEngine { invoke(inv: EngineInvocation): Promise<EngineResult> }` | ☑ |
| B.3 | Create `src/engines/execution_engine.ts` stub (implements IEngine; may call Model Gateway) | ☑ |
| B.4 | Create `src/engines/synthesis_engine.ts` stub (implements IEngine; may call Model Gateway) | ☑ |
| B.5 | Create `src/engines/classification_engine.ts` stub (implements IEngine; stub or Model Gateway) | ☑ |
| B.6 | Add unit test for each engine: invoke with minimal EngineInvocation, assert EngineResult shape | ☑ |
| B.7 | Verify no file under `src/engines/` imports from another under `src/engines/` (grep or lint rule) | ☑ |
| B.8 | Refactor `src/pipelines/chat-pipeline.ts`: build EngineInvocation(s) for Execution + Synthesis, call engines, assemble ResponseEnvelope from EngineResult(s) | ☑ |
| B.9 | Ensure chat integration test still passes; telemetry shows engine_calls | ☑ |
| B.10 | Add OTEL span across ingress → brainstem → orchestrator → workflow → engine(s) | ☑ |
| B.11 | Emit WORKFLOW_START/WORKFLOW_END and ENGINE_START/ENGINE_END per Architecture §13 | ☑ |
| B.12 | Run verification: `npm run build`, `npm test`, query integration test; no regressions | ☑ |

---

### Segment C — L2-03: Policy, Budgets, Routing

| # | Task | Done |
|---|------|------|
| C.1 | Policy evaluator produces PolicyDecision (allowed_workflows, budgets, memory_rules, safety_profile) | ☑ |
| C.2 | Resource-manager / tenant-budget enforce token, cost, tool, time limits | ☑ |
| C.3 | Router maps IntentBundle + PolicyDecision → workflow_id (pipeline_type) + PipelinePlan | ☑ |
| C.4 | Single clear PipelinePlan per request; workflow runtime consumes only this | ☑ |
| C.5 | Tests for policy deny and budget enforcement | ☑ |

---

### Segment D — M2: Typed Artifacts End-to-End

| # | Task | Done |
|---|------|------|
| D.1 | Evolve `brainstem/canonicalize.ts`: output as/converted to Typed Artifacts (artifact_kind, schema_ref where applicable) | ☑ |
| D.2 | Execution engine: accept context_artifacts and task input_artifacts as Typed Artifacts; return result_artifacts as Typed Artifacts | ☑ |
| D.3 | Synthesis engine: same I/O as Typed Artifacts only | ☑ |
| D.4 | Classification engine: same I/O as Typed Artifacts only | ☑ |
| D.5 | Map Synthesis output (final_response artifact) to ResponseEnvelope output.text, output.structured, output.attachments | ☑ |
| D.6 | Contract tests for Typed Artifact and engine I/O; no raw string payloads across engine boundary | ☑ |
| D.7 | Run verification: build, test, E2E produces ResponseEnvelope from Typed Artifacts | ☑ |

---

### Segment E — L2-04: Observability

| # | Task | Done |
|---|------|------|
| E.1 | Event taxonomy per Architecture §13 (ROUTE_DECISION, POLICY_DECISION, WORKFLOW_*, ENGINE_*, TOOL_*, MEMORY_*) | ☑ |
| E.2 | trace_id, request_id on all events; cost/latency where applicable | ☑ |
| E.3 | OTEL/Prometheus integration; redaction for secrets/sensitive data | ☑ |
| E.4 | Observability tests or run confirm span hierarchy and events | ☑ |

---

### Segment F — M3: Tool Engine + Coding Agent

| # | Task | Done |
|---|------|------|
| F.1 | Implement `src/engines/tool_engine.ts`: EngineInvocation → EngineResult; calls Tool Gateway only; no model/other engine | ☑ |
| F.2 | Unit test for tool_engine with mock Tool Gateway | ☑ |
| F.3 | Tool Gateway: allowlist from policy, sandbox (network_access, filesystem_access, timeout_ms), structured result | ☑ |
| F.4 | Tool call denied when not in allowlist; allowed call returns result within timeout | ☑ |
| F.5 | Add `workflows/definitions/coding_agent.json` and/or harness in pipelines | ☑ |
| F.6 | Coding Agent flow: planning → (execution ↔ tool ↔ evaluation)* → synthesis | ☑ |
| F.7 | Integration test for coding-agent path; tool_calls and engine_calls in telemetry | ☑ |
| F.8 | Run verification: build, test, integration test, security/audit for tool deny | ☑ |

---

### Segment G — L2-05: Security

| # | Task | Done |
|---|------|------|
| G.1 | Tool Gateway allowlists from PolicyDecision; sandbox and scope per Architecture §12, §16 | ☑ |
| G.2 | No raw secrets in logs; use observability redaction | ☑ |
| G.3 | Audit trail for decisions and access; compliance controls as specified | ☑ |

---

### Segment H — M4: Memory Engine + Document-Grounded

| # | Task | Done |
|---|------|------|
| H.1 | Implement `src/engines/memory_engine.ts`: operation (retrieve \| write \| delete), scope, query, artifacts; Memory Gateway only | ☑ |
| H.2 | Unit test for memory_engine with mock Memory Gateway (`src/engines/memory_engine.test.ts`) | ☑ |
| H.3 | Workflow definitions with `required_capabilities.needs_memory`; orchestrator includes memory config when policy allows | ☑ |
| H.4 | At least one workflow uses Memory Engine for retrieval; citations in response when memory returns hits | ☑ |
| H.5 | ResponseEnvelope citations from memory_response and/or synthesis; traceability to source | ☑ |
| H.6 | E2E test with memory returns citations; scope (user/project) enforced | ☑ |
| H.7 | Run verification: build, test, retrieval integration tests | ☑ |

**Segment H implementation notes (for coding agent):**

- **Memory Gateway for M4:** Use the existing memory layer under `src/memory/` as the gateway. The Memory Engine should depend on `IMemoryStore` (`memory-abstraction.ts`) and/or `runRetrieval` (`retrieval-service.ts`). Inject the store (e.g. `default-store` or test double) via constructor or factory; do not import a specific store inside the engine if avoidable so tests can inject a mock. Scope and caller context come from `actor_context` on EngineInvocation; map to `RetrievalCallerContext` and `RetrievalScope` in `src/memory/types.ts`.
- **Task payload for memory:** EngineInvocation.task for engine_type `"memory"` can carry structured fields (e.g. in task.objective or a task payload): `operation: "retrieve" | "write" | "delete"`, `query_text` (for retrieve), `scope`, and optionally `scope_keys`. For retrieve, call `runRetrieval(store, { query_text, scope, caller, top_k })`; map `RetrievalServiceResult.citations` and `contextText` into the `memory_response` Typed Artifact (artifact_kind `memory_response`, schema_ref as agreed).
- **Citations:** `CitationSpec` in `src/memory/types.ts` (source, ref, span) maps to ResponseEnvelope citation shape. Synthesis or the pipeline should merge memory citations with any synthesis-generated citations and set `output.citations` on ResponseEnvelope.
- **Observability:** Emit MEMORY_* events (e.g. MEMORY_RETRIEVAL_START/MEMORY_RETRIEVAL_END or equivalent per Architecture §13) with trace_id, scope, and latency; use existing `observability/events.ts` and redaction for any sensitive payload.
- **L2-06:** Retrieval semantics, scope enforcement, and fallback behavior are defined in `docs/PLANS/implementation/L2-06_Memory-and-Retrieval-Implementation.md`; the Memory Engine is the single call path from workflows into that layer.
- **Scope enforcement E2E:** `src/server/retrieval.integration.test.ts` includes a test "enforces scope: caller org only receives citations from their org" (two orgs, caller as o1; citations must include only o1 source, not o2).

---

### Segment I — L2-06: Memory Implementation

| # | Task | Done |
|---|------|------|
| I.1 | Memory Gateway: vector + structured + object store; scope, retention | ☑ |
| I.2 | Retrieval service and stores per L2-06 plan | ☑ |
| I.3 | Retention policies and TTL for vector/structured/object stores | ☑ |
| I.4 | Run verification: `npm run build`, `npm test`; retrieval integration tests | ☑ |

**Segment I implementation notes:** L2-06 plan status is "implemented" for Phase 0–1 (ingestion, scoped retrieval). Segment I tasks cover any remaining gateway expansion (vector/structured/object store backends, retention policies) and alignment with the Memory Engine from Segment H. The Memory Engine (H) calls into `src/memory/`; I.1–I.2 extend or harden that layer per L2-06 phases.

**Segment I — File paths and verification (quick reference):**

| Task | Primary files / locations | Done when |
|------|---------------------------|-----------|
| **I.1** | `src/memory/` (abstraction, stores, retrieval-service), `src/gateways/` (if Memory Gateway wrapper) | Vector/structured/object store backends implemented; scope and retention configurable. |
| **I.2** | `src/memory/retrieval-service.ts`, `src/memory/*-store.ts`, `src/memory/types.ts` | Retrieval service and stores match L2-06 plan; ingestion and scoped retrieval tested. |
| **I.3** | `src/memory/` (retention config), `src/config/schema.ts` | Retention/TTL config in schema; stores respect retention where applicable. |
| **I.4** | — | Build and tests pass; `src/server/retrieval.integration.test.ts` (or equivalent) passes. |

**Plan reference:** `docs/PLANS/implementation/L2-06_Memory-and-Retrieval-Implementation.md`

---

### Segment J — M5: Deep Research + Decision Workflows

| # | Task | Done |
|---|------|------|
| J.1 | Deep Research workflow definition and runtime: planning → (tool:web_search ↔ execution:summarize ↔ evaluation)* → synthesis:report | ☑ |
| J.2 | ResearchReport artifact; stop conditions (coverage, deadline) enforced | ☑ |
| J.3 | Integration test “research X” returns structured report with evidence | ☑ |
| J.4 | Decision & Recommendation workflow: planning → execution(options) → evaluation(score/rank) → synthesis(decision memo) | ☑ |
| J.5 | DecisionMemo artifact | ☑ |
| J.6 | Integration test for decision-style prompt returns options, scores, recommendation | ☑ |
| J.7 | Run verification: build, test, workflow-specific integration tests | ☑ |

---

### Segment K — M6: Workflow Nesting

| # | Task | Done |
|---|------|------|
| K.1 | WorkflowDefinition steps support kind: "workflow_call", ref: sub_workflow_id | ☑ |
| K.2 | Orchestrator invokes sub-workflow; passes budgets (inherited, ≤ parent) and trace_id | ☑ |
| K.3 | E2E: parent workflow calls sub-workflow; telemetry shows parent and child workflow_id | ☑ |
| K.4 | Budget inheritance: child exceeding budget fails without exceeding parent; trace tree continuous | ☑ |
| K.5 | Run verification: build, test, integration test for nested workflow and budget inheritance | ☑ |

**Segment K implementation notes (for coding agent):**

- **Contract:** `WorkflowDefinition` already supports `kind: "workflow_call"` and `ref` (Architecture §8.7) in `src/contracts/workflow-definition.ts`. For `workflow_call`, `ref` is the sub-workflow_id (e.g. `"reactive_chat"`). K.1 is satisfied once at least one workflow definition uses a step with `kind: "workflow_call"` and the runtime interprets it.
- **Workflow runner:** Add a **workflow graph executor** (e.g. `src/workflows/runner.ts` or `graph-executor.ts`) that:
  - Accepts `workflow_id`, `version`, execution input (canonical, plan, caller, retrievalContext, policy), and dependencies (engine registry, pipeline factory).
  - Loads `WorkflowDefinition` via `getWorkflowDefinition(workflow_id, version)` from `src/workflows/registry.ts`.
  - Resolves steps in dependency order (`depends_on`). For each step:
    - **engine_call:** resolve engine by `ref` (e.g. `"execution"`, `"synthesis"`), build `EngineInvocation`, invoke engine, collect `result_artifacts` for downstream steps.
    - **workflow_call:** treat `ref` as sub_workflow_id. Load sub-workflow definition; build **child PipelinePlan** with same `pipeline_type` = ref, **inherited budgets** (see below), same trace_id (from `getTraceContext()`). Obtain pipeline instance for ref (same mapping as in `query-handler.ts`: reactive_chat → createChatPipeline, coding_agent → createCodingAgentPipeline, etc.), call `pipeline.run({ ...input, plan: childPlan })`. Map returned `ResponseEnvelope` to artifacts (e.g. output text as a single artifact) and pass as result for downstream steps.
  - Enforces `stop_conditions` (max_iterations, deadline_ms) at runner level; child plan’s budgets must not exceed parent.
- **Budget inheritance:** Child plan’s `budgets` must be ≤ parent. For example: `token_budget: Math.min(parent.budgets?.token_budget ?? Infinity, childDef.stop_conditions?.max_iterations ? parent.budgets?.token_budget : undefined)`, and `deadline_ms: Math.min(parent.budgets?.deadline_ms ?? Infinity, childDef.stop_conditions?.deadline_ms ?? Infinity)`. Use a shared helper (e.g. `inheritBudgets(parentPlan, childDefinition)`) so all nesting paths apply the same rules.
- **Trace continuity:** Do not create a new trace_id for the sub-workflow. Use the same `runWithContextAsync` / `getTraceContext()` so that all ENGINE_*, WORKFLOW_*, TOOL_*, MEMORY_* events carry the same `trace_id`. Emit `WORKFLOW_START` / `WORKFLOW_END` for both parent and child with `workflow_id` so telemetry shows hierarchy (parent workflow_id and child workflow_id in respective events).
- **Pipeline selection for nested run:** The runner needs a way to get a pipeline for a given `pipeline_type` (sub_workflow_id). Options: (1) Pass a `getPipelineForWorkflow(workflowId: string): IPipeline` (or similar) from query-handler into the runner, which encapsulates the existing switch (coding_agent → createCodingAgentPipeline(...), etc.); or (2) introduce a small registry in `src/pipelines/` that maps workflow_id → factory. Prefer (1) to avoid duplicating gateway/store creation.
- **Example parent workflow:** Register a workflow that includes a `workflow_call` step, e.g. `workflow_id: "composite_example"`, steps: `[{ step_id: "s1", kind: "workflow_call", ref: "reactive_chat", depends_on: [] }, { step_id: "s2", kind: "engine_call", ref: "synthesis", depends_on: ["s1"] }]`. Then route to it when intent matches (e.g. add router rule or test-only route) so E2E can hit the nested path.
- **query-handler integration:** When `plan.pipeline_type` is a workflow that is run by the runner (e.g. `composite_example`), instantiate a pipeline that delegates to the runner (e.g. `createNestedWorkflowPipeline({ runner, getPipelineForWorkflow, ... })`) and pass the same harness input (canonical, plan, caller, etc.). Runner runs the graph; for `workflow_call` it calls `getPipelineForWorkflow(ref).run({ ...input, plan: childPlan })` and continues.
- **Verification:** (K.3) E2E test: send request that results in a workflow with a `workflow_call` step; assert events contain both parent and child `workflow_id` and same `trace_id`. (K.4) Budget test: parent with e.g. `token_budget: 100`; child workflow that would exceed 100 fails with BUDGET_EXCEEDED or equivalent without the parent budget being exceeded; trace remains continuous.
- **References:** Architecture §8.7 (WorkflowDefinition), §9.4 (Workflow Runtime), §11 (workflow catalog); `src/workflows/registry.ts`, `src/contracts/workflow-definition.ts`, `src/server/query-handler.ts` (pipeline selection).

---

### Segment L — L2-07, L2-08: Multimodal & Rollout

| # | Task | Done |
|---|------|------|
| L.1a | **L2-07 verification:** Confirm attachment validation (type/size/count/mime) in ingress; ATTACHMENT_REJECTED / MULTIMODAL_UNSUPPORTED taxonomy; `attachment_reject_total` metric | ☑ |
| L.1b | Confirm Brain Stem canonicalization supports multimodal (handles, token_estimate); preprocess for image/PDF per L2-07 Phase 1 | ☑ |
| L.1c | Confirm router capability checks (`multimodalCapablePipelines`); deterministic MULTIMODAL_UNSUPPORTED when policy has no capable pipeline; config flags `multimodal_input_path_enabled`, `enable_multimodal_pipeline`, `maxAttachmentCount`, `maxAttachmentBytes` | ☑ |
| L.1d | Confirm runbook `docs/OPERATIONS/RUNBOOKS/Multimodal-Input-Path.md` exists and is linked from SPEC 22 and SOW §7/§8 | ☑ |
| L.2a | **L2-08 endpoints:** Confirm `GET /healthz`, `GET /readyz`, `GET /metrics`, `GET /v1/version` exist in `src/server/routes.ts`; document contract (e.g. version returns contract_version, api, version, env, optional release_id/build_id) in runbooks or SPEC | ☑ |
| L.2b | Runbooks: Ensure `docs/OPERATIONS/RUNBOOKS/` contains (or links) procedures for query failure, tool denied, budget exceeded, rollback; link from SOW §7 and Master plan. Add sections to `Release-and-Rollback.md` or create **Query-and-Policy-Failures.md** (triage steps). Existing: Release-and-Rollback.md, Multimodal-Input-Path.md, Memory-Retrieval-Outage.md, Harness-Readiness-Gate.md. | ☑ |
| L.2c | Escalation and ownership: Document on-call owner and escalation path (e.g. Operations → SRE → Security) in runbooks or docs/SPEC/22_Runbooks_and_Operations.md | ☑ |
| L.3a | **Rollout strategy:** Document rollout and rollback (canary, kill-switch `PLATFORM_PRODUCTION_ROLLOUT_ENABLED`, promotion criteria); reference `src/rollout/policy.ts` and L2-08 Phase 1 | ☑ |
| L.3b | Document on-call responsibilities and escalation; align with L2-08 §11.2 (Operations on-call, escalation path) | ☑ |
| L.4 | **L2-99 gate:** Autonomous harness loop implemented and gated by `harness_autonomous_execution_enabled`; do not enable until readiness gate (Segment L.2–L.3) and security/observability sign-off. See Harness-Readiness-Gate runbook. | ☑ |
| L.5 | Run verification: `npm run build`, `npm test`; integration tests for version endpoint and any L2-07/L2-08 code paths | ☑ |

**Segment L implementation notes (for coding agent):**

- **L2-07 status:** Plan `L2-07_Multimodal-Input-Path-Implementation.md` is marked *implemented* (Phases 0–4). L.1 tasks are **verification and documentation**: confirm attachment validation in `src/ingress/` (e.g. `attachments.ts`, `validate.ts`), Brain Stem extensions in `src/brainstem/canonicalize.ts` and `preprocess.ts`, router capability checks in `src/router/default-router.ts`, and that runbook `docs/OPERATIONS/RUNBOOKS/Multimodal-Input-Path.md` exists and is linked. If any gap is found, implement the minimal change to satisfy the SOW; otherwise mark L.1 done.
- **L2-08 status:** SOW Segment L complete. Endpoints confirmed in `src/server/routes.ts` (healthz, readyz, metrics, v1/version). Rollout policy documented in `src/rollout/policy.ts` and referenced in `docs/OPERATIONS/RUNBOOKS/Release-and-Rollback.md`. Runbooks: `docs/OPERATIONS/RUNBOOKS/Query-and-Policy-Failures.md` (query failure, tool denied, budget exceeded), `Release-and-Rollback.md`, `Multimodal-Input-Path.md`, and others; runbook index and on-call/escalation in `docs/SPEC/22_Runbooks_and_Operations.md`.
- **Runbook coverage:** SOW §7 and §4.1 call out runbooks for “query fails”, “tool denied”, “budget exceeded”, “rollback”. Prefer adding sections to `Release-and-Rollback.md` or a single `Query-and-Policy-Failures.md` rather than proliferating many small files; link from SPEC 22 and Master plan.
- **L.4 (L2-99):** Autonomous harness execution is implemented in `src/pipelines/coding-agent-pipeline.ts` (branch on `harness_autonomous_execution_enabled`); Execution engine returns `proposed_next_action` when task has `suggested_tool_ref`. Enable via `HARNESS_AUTONOMOUS_EXECUTION_ENABLED=true` only after readiness gate and sign-off. See `docs/PLANS/implementation/L2-99_*` and `docs/OPERATIONS/RUNBOOKS/Harness-Readiness-Gate.md`.
- **References:** Architecture §6.1 (RequestEnvelope input/attachments), §8.1 (CanonicalRequest), §8.4 (Typed Artifact); `docs/SPEC/22_Runbooks_and_Operations.md`; L2-07 Phase 0–4 task lists; L2-08 Phase 0–3 and §13 Implementation Summary.

**Segment L — File paths and verification (quick reference for coding agent):**

| Task group | Primary files / locations | Done when / verification |
|------------|---------------------------|---------------------------|
| **L.1a** | `src/ingress/validate.ts`, `src/ingress/attachments.ts` | Attachment validation (type/size/count/mime) in ingress; error codes ATTACHMENT_REJECTED, MULTIMODAL_UNSUPPORTED; metric `attachment_reject_total` in `src/observability/metrics.ts`. |
| **L.1b** | `src/brainstem/canonicalize.ts`, `src/brainstem/preprocess.ts` | CanonicalRequest supports multimodal (handles, token_estimate); preprocess provides token estimates per attachment type (L2-07 Phase 1). |
| **L.1c** | `src/router/default-router.ts`, `src/config/schema.ts` | Router checks `multimodalCapablePipelines`; MULTIMODAL_UNSUPPORTED when no capable pipeline; flags: `multimodal_input_path_enabled`, `enable_multimodal_pipeline`, `maxAttachmentCount`, `maxAttachmentBytes`. |
| **L.1d** | `docs/OPERATIONS/RUNBOOKS/Multimodal-Input-Path.md` | Runbook exists; linked from SPEC 22 and SOW §7/§8. |
| **L.2a** | `src/server/routes.ts` | GET /healthz, /readyz, /metrics, /v1/version implemented; version contract (contract_version, api, version, env, optional release_id/build_id) documented in runbooks or SPEC. |
| **L.2b** | `docs/OPERATIONS/RUNBOOKS/`, `docs/OPERATIONS/RUNBOOKS/Release-and-Rollback.md` or new `Query-and-Policy-Failures.md` | Runbooks for query failure, tool denied, budget exceeded, rollback present or linked (sections in Release-and-Rollback or new Query-and-Policy-Failures.md); link from SOW §7 and Master plan. |
| **L.2c** | `docs/SPEC/22_Runbooks_and_Operations.md` or runbooks | On-call owner and escalation path (e.g. Operations → SRE → Security) documented. |
| **L.3a** | `src/rollout/policy.ts`, L2-08 plan | Rollout/rollback documented: canary, kill-switch PLATFORM_PRODUCTION_ROLLOUT_ENABLED, promotion criteria; reference rollout policy and L2-08 Phase 1. |
| **L.3b** | Runbooks or SPEC 22 | On-call responsibilities and escalation aligned with L2-08 §11.2. |
| **L.4** | L2-99 plan, `docs/OPERATIONS/RUNBOOKS/Harness-Readiness-Gate.md`, `src/config/schema.ts` (harness_autonomous_execution_enabled) | Autonomous harness implemented; gated by flag; enable only after Segment L.2–L.3 and security/observability sign-off. |
| **L.5** | — | `npm run build`, `npm test` pass; integration tests for version endpoint and L2-07/L2-08 paths as needed. |

**Segment L plan references:**  
- L2-07: `docs/PLANS/implementation/L2-07_Multimodal-Input-Path-Implementation.md`  
- L2-08: `docs/PLANS/implementation/L2-08_Rollout-and-Operational-Readiness-Implementation.md`

**Segment L verification commands (run before marking L.5 done):**  
`npm run build` && `npm test`; optionally: `curl -s http://localhost:<port>/v1/version` (or use integration test); grep for `ATTACHMENT_REJECTED`, `MULTIMODAL_UNSUPPORTED`, `attachment_reject_total` in `src/` to confirm L.1a; confirm runbook links in `docs/SPEC/22_Runbooks_and_Operations.md`.

---

### Segment M — Remaining Engines and Workflows (Post-M6, Optional)

Execute after Segment K (and preferably after L) when the full workflow catalog and all eight engines are required. Can be done incrementally (e.g. Planning Engine first for workflows that need it, then Condensing, then workflows in priority order).

| # | Task | Done |
|---|------|------|
| M.1 | **Planning Engine:** Implement `src/engines/planning_engine.ts`; accepts EngineInvocation (task graph objective + context); returns WorkflowPlan artifact; uses Model Gateway only (Architecture §10.1). | ☑ |
| M.2 | Unit test for planning_engine; no engine-to-engine imports | ☑ |
| M.3 | **Condensing Engine:** Implement `src/engines/condensing_engine.ts`; compress/summarize content into smaller artifact; Model Gateway only (Architecture §10.8). | ☑ |
| M.4 | Unit test for condensing_engine | ☑ |
| M.5 | **Tool Automation workflow:** Definition + runtime; classification → planning → tool* → evaluation → synthesis; strict tool budget + audit (Architecture §11.4). | ☑ |
| M.6 | **Extraction & Normalization workflow:** Definition + runtime; classification → execution(extract/transform) → evaluation(schema validity) → optional memory write → synthesis; normalized_record artifacts (Architecture §11.6). | ☑ |
| M.7 | **Verification / Audit workflow:** Definition + runtime; execution → evaluation(verification) → execution(repair) → synthesis; verification sources per §11.7. | ☑ |
| M.8 | **Planning-only workflow:** Definition + runtime; planning → evaluation(plan quality) → synthesis(plan); WorkflowPlan + milestone artifacts (Architecture §11.8). | ☑ |
| M.9 | **Batch Analysis workflow:** Definition + runtime; planning → (execution ↔ evaluation)* → synthesis(report); batch complete/deadline/cost stop conditions (Architecture §11.9). | ☑ |
| M.10 | Integration tests per new workflow; router/PolicyDecision allows new workflow_ids when configured | ☑ |
| M.11 | Run verification: build, test, workflow-specific integration tests | ☑ |

**Segment M implementation notes (for coding agent):**

- **Planning Engine (§10.1):** Input is PlanningInvocation (or EngineInvocation with engine_type `"planning"`); task carries objective + context; output is WorkflowPlan artifact (task graph). WorkflowPlan is request-scoped; WorkflowDefinition is the template. Planning uses Model Gateway only.
- **Condensing Engine (§10.8):** Input: artifacts to compress/summarize; output: condensed artifact. Model Gateway only.
- **Workflow definitions:** Add JSON under `src/workflows/definitions/` for `tool_automation.json`, `extraction.json`, `verification.json`, `planning_only.json`, `batch_analysis.json`. Conform to WorkflowDefinition schema; register in `src/workflows/registry.ts`.
- **Router:** Extend router (or policy) to map intents/capabilities to new workflow_ids; add feature flags in config if gating is required (e.g. `tool_automation_workflow_enabled`).
- **References:** Architecture §10.1 (Planning), §10.8 (Condensing), §11.4–§11.9 (workflow catalog).

**Segment M — File paths and verification (quick reference):**

| Task | Primary files / locations | Done when |
|------|---------------------------|-----------|
| **M.1** | `src/engines/planning_engine.ts` | Implements IEngine; accepts EngineInvocation; returns EngineResult with WorkflowPlan artifact; Model Gateway only. |
| **M.2** | `src/engines/planning_engine.test.ts` | Unit test: invoke with minimal EngineInvocation; assert EngineResult shape; no engine-to-engine imports. |
| **M.3** | `src/engines/condensing_engine.ts` | Implements IEngine; compress/summarize artifacts; Model Gateway only. |
| **M.4** | `src/engines/condensing_engine.test.ts` | Unit test for condensing_engine. |
| **M.5** | `src/workflows/definitions/tool_automation.json`, `src/pipelines/` (harness or runner) | Workflow definition + runtime; classification → planning → tool* → evaluation → synthesis; tool budget + audit. |
| **M.6** | `src/workflows/definitions/extraction.json`, pipeline | Definition + runtime; classification → execution(extract/transform) → evaluation(schema) → optional memory write → synthesis. |
| **M.7** | `src/workflows/definitions/verification.json`, pipeline | Definition + runtime; execution → evaluation(verification) → execution(repair) → synthesis. |
| **M.8** | `src/workflows/definitions/planning_only.json`, pipeline | Definition + runtime; planning → evaluation(plan quality) → synthesis(plan). |
| **M.9** | `src/workflows/definitions/batch_analysis.json`, pipeline | Definition + runtime; planning → (execution ↔ evaluation)* → synthesis(report); batch stop conditions. |
| **M.10** | `src/server/*.integration.test.ts`, `src/router/default-router.ts`, `src/config/schema.ts` | Integration test per new workflow; router/PolicyDecision allows new workflow_ids when feature-flagged. |
| **M.11** | — | `npm run build`, `npm test`; workflow-specific integration tests pass. |

---

### Segment N — Closure and Verification (Optional)

Use for final acceptance and machine-checkable “SOW complete” state. Can run in parallel with or after Segment L/M.

| # | Task | Done |
|---|------|------|
| N.1 | **Error code taxonomy:** Central list of `ResponseEnvelope.error.code` (e.g. POLICY_DENIED, BUDGET_EXCEEDED, TOOL_TIMEOUT, WORKFLOW_NOT_ALLOWED). Implement or extend `src/contracts/errors.ts`; short doc in contracts or Docs. | ☑ |
| N.2 | **verify:sow script:** Add `npm run verify:sow` (or equivalent) that runs lint, type-check, contract tests, and a minimal e2e so “phase complete” is machine-checkable (§7). | ☑ |
| N.3 | **Final acceptance:** Confirm §6 Acceptance Criteria (functional, non-functional, security, architecture, documentation, testing, observability) are satisfied; update checklist §5 if needed. | ☑ |

**Segment N implementation notes:**

- **N.1:** See §7 “Error code taxonomy”; keep codes stable and documented for clients.
- **N.2:** Script can invoke `npm run build`, `npm test`, and optionally a single query e2e; exit non-zero if any fail.
- **N.3:** No code change required; verification and checklist update only.

**Segment N — File paths and verification (quick reference):**

| Task | Primary files / locations | Done when |
|------|---------------------------|-----------|
| **N.1** | `src/contracts/errors.ts`, `docs/` or `src/contracts/` (short doc) | Central list of `ResponseEnvelope.error.code` (POLICY_DENIED, BUDGET_EXCEEDED, TOOL_TIMEOUT, WORKFLOW_NOT_ALLOWED, etc.); documented for clients. |
| **N.2** | `package.json` (scripts), optional `scripts/verify-sow.ts` or shell script | `npm run verify:sow` runs lint, type-check, contract tests, minimal e2e; exits non-zero on failure. |
| **N.3** | This SOW §5, §6 | §6 Acceptance Criteria reviewed; §5 checklist updated; phase completion machine-checkable where applicable. |

---

### Segment O — Production Hardening & Optional Extensions

Execute after Segment N (and preferably after Segment I if Memory Gateway expansion is in scope). Use when targeting production or when L2-05/L2-06 plans or §7 call for additional work.

| # | Task | Done |
|---|------|------|
| O.1 | **L2-05 residual:** Review L2-05 plan for any security controls not yet implemented (isolation, sandbox, compliance); implement as needed for production sign-off | ☑ |
| O.2 | **Schema ref catalog (optional):** Add a single place listing `schema_ref` URIs and artifact kinds (e.g. Architecture appendix or `docs/REFERENCE/schemas/`) for consistent validation across engines (§7) | ☑ |
| O.3 | **Runbooks / ops:** Add or update runbooks per §7 and L2-08 if new workflows or gateways introduce new failure modes | ☑ |
| O.4 | Run verification: `npm run build`, `npm test`, `npm run verify:sow`; update §5 checklist (Security, Memory Gateway) when applicable | ☑ |

**Segment O implementation notes:**

- **O.1:** L2-05 plan (Phases 0–4) is fully implemented: threat/control baseline, audit + secret scope (Phase 1), tool gateway hard controls (Phase 2), abuse/compliance validation (Phase 3), security gate and handoff (Phase 4). Segment G delivered allowlists from policy, redaction_level, TOOL_ACCESS audit. No residual controls required for current production sign-off; §5 Security row marked complete.
- **O.2:** Catalog added at `docs/REFERENCE/schemas/schema-ref-catalog.md` listing all `schema_ref` URIs and artifact kinds; referenced from §7.
- **O.3:** Runbook index in SPEC 22 covers query/tool/budget (Query-and-Policy-Failures), rollout (Release-and-Rollback), memory (Memory-Retrieval-Outage), multimodal, harness gate, observability. Security/audit incidents triaged via Query-and-Policy-Failures and escalation path (Operations → SRE → Security); no new runbook file required.

**References:** §5 Deliverables Checklist (Security, Memory Gateway); §7 What Might Need to Be Added; L2-05, L2-06, L2-08 plans.

---

*End of Scope of Work*
