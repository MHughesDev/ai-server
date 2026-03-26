# Engines and Engine Contracts

This document describes the **engine layer** (Layer 2) and the **contracts** used for engine invocation and artifacts. It is the reference for implementers and coding agents working on workflows, pipelines, and engines.

**Source of truth for shapes:** `docs/ARCHITECTURE/Architecture_document_Finalized.md` (§8.4–8.6, §10).  
**Source of truth for production requirements:** `docs/ARCHITECTURE/Architecture_document_Finalized.md` (§18).  
**Current implementation deltas:** `docs/OPERATIONS/Production-Readiness-Gaps-Report.md`.  
**Implementation:** `src/contracts/` (schemas and validators), `src/engines/` (engine modules).

---

## 0) Production Readiness Note

- Engine contracts in this document describe the target architecture boundary.
- Some runtime engine paths are currently stubbed/deferred (notably called out in the gaps report).
- Production-selected workflows should not depend on stub-only engines or stub-only gateway delegates.

---

## 1) Purpose of the Engine Layer

- **Engines** are bounded, reusable building blocks. Each engine has a single responsibility and uses **at most one gateway** (Model, Tool, or Memory).
- **Workflows** (and pipeline harnesses) orchestrate engines; they build **EngineInvocation** from the pipeline plan and context, call the engine, and consume **EngineResult**.
- **Rule:** No engine may call another engine. Only the workflow runtime (e.g. `pipelines/`) or orchestrator dispatches engines.

---

## 2) Engine Contracts (Summary)

| Contract | Purpose | Location |
|----------|---------|----------|
| **TypedArtifact** | Universal envelope for any payload passed between engines or from engines to the response | `src/contracts/typed-artifact.ts` |
| **Task** | Unit of work: what to do, with which inputs and constraints | `src/contracts/task.ts` |
| **EngineInvocation** | Standard input to every engine: invocation_id, engine_type, task, context_artifacts, actor_context, budgets, safety, metadata | `src/contracts/engine-invocation.ts` |
| **EngineResult** | Standard output: invocation_id, status, result_artifacts, confidence, proposed_next_action, metrics, error | `src/contracts/engine-result.ts` |

**WorkflowDefinition** (workflow graph template): `workflow_id`, `version`, `entry_conditions`, `steps` (engine_call | workflow_call | decision), `stop_conditions` — `src/contracts/workflow-definition.ts`. Workflow registry: `src/workflows/registry.ts` (getWorkflowDefinition, registerWorkflowDefinition); definitions: `src/workflows/definitions/*.json` (e.g. `reactive_chat.json`).

All are validated with **Zod**; validators and types are exported from `src/contracts/index.ts` (e.g. `validateEngineInvocation`, `validateWorkflowDefinition`, `EngineResult`).

---

## 2.5) Model Gateway API (engine-facing)
All model-using engines call the **Model Gateway**. No engine calls providers directly.

**ModelInvokeRequest** (assembled by code logic; consumed by model provider):
```json
{
  "request_id": "<uuid>",
  "model_id": "<provider_model_id>",
  "task": "<generation|classification|embedding|vision|ranking|other>",
  "input": {
    "text": "<optional>",
    "messages": [],
    "artifacts": [],
    "attachments": []
  },
  "parameters": {
    "temperature": "<0..2>",
    "top_p": "<0..1>",
    "max_output_tokens": "<int>",
    "stop": ["<string>"],
    "response_format": "<text|json|schema_ref>"
  },
  "budgets": { "token_budget": "<int>", "cost_budget_usd": "<float>", "deadline_ms": "<int>" },
  "safety": { "profile": "<standard|strict|regulated>", "redaction_level": "<none|low|medium|high>" },
  "metadata": { "trace_id": "<string>", "engine_type": "<planning|execution|evaluation|classification|synthesis|condensing>", "contract_version": "v1" }
}
```

**ModelInvokeResponse** (produced by model provider; returned to engine):
```json
{
  "request_id": "<uuid>",
  "status": "<ok|error|blocked>",
  "output": {
    "text": "<model_output_text_optional>",
    "structured": { "model_output": "<json_optional>" },
    "embeddings": ["<vector_optional>"],
    "labels": [ { "label": "<label>", "confidence": "<0..1>" } ]
  },
  "usage": { "tokens_in": "<int>", "tokens_out": "<int>", "cost_usd": "<float>" },
  "model_info": { "provider": "<string>", "model_id": "<string>", "latency_ms": "<int>" },
  "error": { "code": "<string>", "message": "<string>" }
}
```

---

## 3) TypedArtifact

- **artifact_id** (string), **artifact_kind** (required; e.g. `report`, `tool_result`, `workflow_plan`), **schema_ref** (optional URI), **encoding** (`json` | `text` | `binary`), **content** (`{ inline?, ref? }`), **metadata** (created_by, provenance, trust_score, sensitivity).
- Cross-engine artifacts must carry **artifact_kind** and, where applicable, **schema_ref** (Architecture §8.4).

---

## 4) Task

- **task_id**, **task_type**, **category** (e.g. `generation`, `synthesis`, `classification`), **objective** (formal_spec, description), **input_artifacts** (TypedArtifact[]), **expected_output_schema**, **constraints_hints** (latency_class, accuracy_level, deterministic_required).
- Produced by the workflow runtime from the pipeline plan and canonical request, or (later) by the Planning Engine.

---

## 5) EngineInvocation and EngineResult

- **EngineInvocation:** Identifies the call (`invocation_id`, `engine_type`), the work (`task`), the context (`context_artifacts`), who is acting (`actor_context`), and limits (`budgets`, `safety`). Optional `metadata.trace_id` and `metadata.contract_version` for observability.
- **EngineResult:** Same `invocation_id`, **status** (`success` | `fail` | `blocked`), **result_artifacts** (TypedArtifact[]), optional **confidence**, **proposed_next_action** (e.g. call_tool, invoke_workflow), **metrics** (duration_ms, tokens_used, cost_estimate_usd), **error** (code, message, detail) when status is not success.

Every engine implements the same boundary: accept `EngineInvocation`, return `EngineResult`.

---

## 6) Engines Implemented (M1–M5, Segment M)

| Engine | Module | Role | Gateway |
|--------|--------|------|---------|
| Execution | `src/engines/execution_engine.ts` | Single-pass execution (e.g. answer from prompt) | Model Gateway |
| Synthesis | `src/engines/synthesis_engine.ts` | Produce final response from context/artifacts | Model Gateway |
| Classification | `src/engines/classification_engine.ts` | Return classification labels (stub) | None (stub) |
| **Tool** | **`src/engines/tool_engine.ts`** | **Invoke tool via Gateway only; allowlist from plan** | **Tool Gateway** |
| **Evaluation** | **`src/engines/evaluation_engine.ts`** | **Verify/rate artifacts (stub for Coding Agent)** | **None (stub)** |
| **Memory** | **`src/engines/memory_engine.ts`** | **Scoped retrieve (and optional write/delete); calls Memory Gateway only** | **Memory Gateway (`src/memory/`)** |
| **Planning** | **`src/engines/planning_engine.ts`** | **Produce WorkflowPlan (task graph) from objective + context** | **Model Gateway** |
| **Condensing** | **`src/engines/condensing_engine.ts`** | **Compress/summarize content into smaller artifact** | **Model Gateway** |

Base interface: **`IEngine`** in `src/engines/base.ts` — `invoke(inv: EngineInvocation): Promise<EngineResult>`.

**M2:** All engine I/O uses Typed Artifacts only; Execution and Synthesis set `schema_ref: "schema://report@v1"` on result artifacts. No raw string payloads cross the engine boundary.

**M3:** Tool Engine accepts `EngineInvocation` with `task.objective.formal_spec` carrying `tool_id` and `parameters`; allowlist is from **PipelinePlan.tools_enabled**, which the router sets from **PolicyDecision** (allow_tools minus deny_tools). Tool Gateway returns discriminated result: denied (`allowed: false`, reason, message) or allowed (`allowed: true`, tool_id, result, duration_ms). Tool Engine returns `EngineResult` with `tool_result` artifact or blocked/fail status.

**M4:** Memory Engine accepts `EngineInvocation` with `engine_type: "memory"` and `task.objective.formal_spec`: `operation` ("retrieve" | "write" | "delete"), `query_text`, `scope`, `top_k`. Calls **Memory Gateway only** (`IMemoryStore` / `runRetrieval` in `src/memory/`). Returns `EngineResult` with `memory_response` Typed Artifact (artifact_kind `memory_response`, schema_ref `schema://memory_response@v1`) containing `retrieved_artifacts`, `citations`, `contextText`, `degraded`, `latency_ms`. Write/delete return blocked in this release. Reactive Chat pipeline calls the Memory Engine when `plan.memory?.retrieval` and policy `memory_scope` ≠ none; citations flow to ResponseEnvelope. Workflow definition `reactive_chat.json` has `required_capabilities.needs_memory: true`. **Scope enforcement** is validated by E2E test in `src/server/retrieval.integration.test.ts` (caller org only receives citations from their org). **Segment I (L2-06):** Memory Gateway is composed in `src/memory/memory-gateway.ts`: `IMemoryGateway` exposes `vectorStore` (IMemoryStore), `structuredStore` (IStructuredStore), `objectStore` (IObjectStore), and optional `retention`. Use `getMemoryGateway()` from `src/memory/default-store.ts` for the full gateway; `getDefaultStore()` returns the vector store (same instance). Retention config: `config.memoryRetention` (ttl_seconds, max_chunks_per_scope); env `MEMORY_RETENTION_TTL_SECONDS`, `MEMORY_RETENTION_MAX_CHUNKS_PER_SCOPE`. InMemoryStore constructor accepts optional retention and evicts by TTL and max chunks per scope. Structured store: `src/memory/structured-store.ts` (key-value by scope). Object store: `src/memory/object-store.ts` (blobs by id and scope). See SPEC 17, SOW §9 Segment I.

**Segment M:** Planning Engine returns a `workflow_plan` Typed Artifact (schema_ref `schema://workflow_plan@v1`); Condensing Engine returns a condensed `report` artifact. Both use Model Gateway only. All eight engines are registered in `src/engines/registry.ts` (execution, synthesis, classification, evaluation, tool, memory, planning, condensing).

**Registry:** `src/engines/registry.ts` — `createEngineRegistry(options)` builds a map from engine ref (e.g. `"planning"`, `"condensing"`) to `IEngine` for use by the workflow runtime.

**Current implemented workflows (engine consumers):**
- reactive_chat
- coding_agent
- deep_research
- decision
- tool_automation
- extraction_normalization
- verification_audit
- planning_only
- batch_analysis

---

## 7) Reactive Chat Flow (M1 + M2)

For the **reactive_chat** pipeline (`src/pipelines/chat-pipeline.ts`):

1. **Input as Typed Artifacts (M2):** Canonical request is converted to Typed Artifacts via `canonicalToTypedArtifacts(canonical)` (`src/brainstem/canonical-to-artifacts.ts`). Text becomes a `report` artifact with `schema_ref: "schema://user_input@v1"`; attachments become `document_chunk` artifacts with `schema_ref: "schema://attachment_handle@v1"`.
2. Build **EngineInvocation** for **Execution**: `task.input_artifacts` and `context_artifacts` are the typed artifacts from step 1; budgets from plan, actor_context from caller, metadata with trace_id.
3. Call **Execution engine** → **EngineResult** (result_artifacts = [text artifact with `schema_ref: "schema://report@v1"`]).
4. Build **EngineInvocation** for **Synthesis**: context_artifacts = [execution result artifact], same budgets and caller.
5. Call **Synthesis engine** → **EngineResult** (result_artifacts = [final text artifact with schema_ref]).
6. Assemble **ResponseEnvelope**: output.text from synthesis result_artifacts, output.attachments from all synthesis result_artifacts (artifact_id, artifact_uri, artifact_kind), citations from retrieval, telemetry from both engines.

**M4 (Memory):** When `plan.memory?.retrieval` is set and policy `memory_scope` ≠ none, the chat pipeline receives an optional **memoryStore** (`IMemoryStore`). It invokes the **Memory Engine** with an EngineInvocation (operation retrieve, query_text from canonical, scope from policy, top_k from plan). The engine returns a `memory_response` artifact with `citations` and `contextText`. The pipeline uses that as retrieval context (prepends contextText to the prompt and sets `output.citations` from the artifact). For **reactive_chat**, query-handler does not run retrieval itself; it passes `memoryStore: getDefaultStore()` into `createChatPipeline`, so the workflow uses the Memory Engine. All model calls go through the **Model Gateway**; the pipeline passes the gateway into the engines (e.g. `createExecutionEngine(gateway)`).

---

## 7.5) Coding Agent Flow (M3)

For the **coding_agent** pipeline (`src/pipelines/coding-agent-pipeline.ts`):

1. **Entry:** Router returns `pipeline_type: "coding_agent"` when policy allows `coding_agent` and `intent.complexity.tool_likelihood >= 0.5`. Plan includes `tools_enabled` from **PolicyDecision** (allow_tools minus deny_tools; e.g. `["stub_tool"]` when policy allows it) as the allowlist for the Tool Engine; optional `plan.sandbox` (e.g. timeout_ms) is set when tools are enabled.
2. **Input as Typed Artifacts:** Same as reactive chat — `canonicalToTypedArtifacts(canonical)`; text and attachments become artifacts.
3. **Step 1 — Execution:** Build EngineInvocation for Execution; call Execution engine (Model Gateway). Result artifact becomes context for next step.
4. **Step 2 — Tool (if tools_enabled):** If `plan.tools_enabled` has at least one tool, build EngineInvocation for **Tool** with `task.objective.formal_spec: { tool_id, parameters }`; call Tool Engine with allowlist from plan (sourced from policy). Tool Engine calls Tool Gateway only; gateway may allow (structured result) or deny. Pipeline emits TOOL_START/TOOL_END and ENGINE_START/ENGINE_END for the tool step; when policy.audit_level !== "none", writes TOOL_ACCESS audit event (redacted per policy.redaction_level). Tool result artifact (or execution output if tool denied) feeds evaluation.
5. **Step 3 — Evaluation:** Build EngineInvocation for **Evaluation** (stub); call Evaluation engine. Result artifact (evaluation_report) or prior artifact feeds synthesis.
6. **Step 4 — Synthesis:** Build EngineInvocation for Synthesis; call Synthesis engine. Assemble ResponseEnvelope with output.text, attachments, telemetry (including `tool_calls` count).

**Workflow definition:** `src/workflows/definitions/coding_agent.json`; registry: `getWorkflowDefinition("coding_agent", "v1")`. Steps: execution → tool → evaluation → synthesis (linear; nesting later).

**Autonomous mode (L2-99):** When `harness_autonomous_execution_enabled` is true (and plan has tools), the pipeline runs an **autonomous loop**: (execution → tool when Execution returns `proposed_next_action.type === "call_tool"`)* until budget/deadline or no proposal, then evaluation → synthesis. The Execution engine returns `proposed_next_action` when `task.objective.formal_spec.suggested_tool_ref` is set. The pipeline emits **HARNESS_ITERATION** (payload: workflow_id, iteration, tool_calls_so_far) each tool round. Config: `src/config/schema.ts`; env `HARNESS_AUTONOMOUS_EXECUTION_ENABLED`. See `docs/OPERATIONS/RUNBOOKS/Harness-Readiness-Gate.md`.

**Tool Gateway (M3):** `src/gateways/tool-gateway.ts` — **DenyOnlyToolGateway** (default: all invocations denied); **AllowlistToolGateway** (allowlist + optional sandbox timeout); **StubAllowedToolGateway** (tests). Allowlist and sandbox are sourced from PolicyDecision via PipelinePlan (router sets tools_enabled = allow_tools minus deny_tools; query-handler builds AllowlistToolGateway when plan has tools_enabled). Types in `src/gateways/types.ts`: `ToolInvokeResult` is a discriminated union (denied vs allowed with result, duration_ms).

---

## 7.6) Deep Research Flow (M5)

For the **deep_research** pipeline (`src/pipelines/deep-research-pipeline.ts`):

1. **Entry:** Router returns `pipeline_type: "deep_research"` when policy allows `deep_research` and `intent.routing_hints` includes `"deep_research"` (set by Brain Stem when user text matches patterns such as "research", "deep research", "find out about", "investigate").
2. **Flow:** Execution (summarize/gather on query) → Evaluation (stub) → Synthesis. All engines receive Typed Artifacts; Synthesis result is turned into a **ResearchReport** content shape.
3. **Artifacts:** Pipeline builds **ResearchReportContent** (summary, claims with evidence_links, open_questions) per `src/contracts/m5-artifacts.ts` (ResearchReportContentSchema). ResponseEnvelope has `output.text` (summary), `output.structured` (ResearchReportContent), `output.attachments` with one entry of `artifact_kind: "research_report"`.
4. **Workflow definition:** Registered in `src/workflows/registry.ts` as `deep_research` v1; steps: execution → evaluation → synthesis. Architecture §11.3.

---

## 7.7) Decision & Recommendation Flow (M5)

For the **decision** pipeline (`src/pipelines/decision-pipeline.ts`):

1. **Entry:** Router returns `pipeline_type: "decision"` when policy allows `decision` and `intent.routing_hints` includes `"decision"` (set when user text matches "decide", "choose between", "which option", "recommend", etc.).
2. **Flow:** Execution (generate options) → Evaluation (score/rank) → Synthesis (decision memo). Pipeline builds **DecisionMemoContent** (question, options with scores, assumptions, risks, recommendation) per `src/contracts/m5-artifacts.ts` (DecisionMemoContentSchema).
3. **Artifacts:** ResponseEnvelope has `output.text` (recommendation), `output.structured` (DecisionMemoContent), `output.attachments` with `artifact_kind: "decision_memo"`.
4. **Workflow definition:** Registered in `src/workflows/registry.ts` as `decision` v1; steps: execution → evaluation → synthesis. Architecture §11.5.

---

## 8) Observability

- For each engine call, the pipeline (or workflow runtime) emits:
  - **ENGINE_START** — payload: engine_type, invocation_id.
  - **ENGINE_END** — payload: engine_type, invocation_id, duration_ms, cost_estimate_usd, tokens_used (when available from EngineResult.metrics).
- At workflow run boundaries, the pipeline emits **WORKFLOW_START** (payload: workflow_id) and **WORKFLOW_END** (payload: workflow_id, duration_ms, status).
- For each **tool** call, the coding-agent pipeline emits **TOOL_START** and **TOOL_END** (payload: tool_id, invocation_id, duration_ms). In autonomous mode it also emits **HARNESS_ITERATION** per tool round (payload: workflow_id, iteration, tool_calls_so_far, proposed_next_action).
- **PIPELINE_START** and **PIPELINE_END** are emitted by the query handler; **trace_id** and **request_id** are carried in context and in engine invocation metadata.
- For each **memory** (retrieval) call, the Memory Engine emits **ENGINE_START** / **ENGINE_END**; **MEMORY_QUERY** is emitted inside **`runRetrieval`** (payload: hit_count, latency_ms, scope, degraded; optional error on engine-level failure before/without a normal retrieval result).
- Event taxonomy: `src/observability/events.ts` (`REQUIRED_EVENT_TYPES` includes ENGINE_START, ENGINE_END, WORKFLOW_START, WORKFLOW_END, and all §13 types).
- **GET /metrics:** Default response is JSON (counters, histograms). Prometheus exposition text is returned when `Accept: text/plain` or `?format=prometheus` (see SPEC 18 and `src/observability/metrics.ts` — `getPrometheusText()`).

---

## 9) Guardrails

- **No engine-to-engine calls:** No file under `src/engines/` may import another under `src/engines/` for the purpose of invoking an engine. Verified by review and tests; pipelines and orchestrator are the only callers of engines.
- **Single gateway per engine:** Each engine uses at most one of: Model Gateway, Tool Gateway, Memory Gateway.
- **Contracts:** Use `validateEngineInvocation` / `validateEngineResult` (and artifact validators) in tests; keep engine I/O on the canonical EngineInvocation/EngineResult and TypedArtifact shapes.

---

## 10) References

- **Architecture:** `docs/ARCHITECTURE/Architecture_document_Finalized.md` (§8.4–8.7, §9.4–9.5, §10).
- **Scope of Work:** `docs/PLANS/Scope-of-Work.md` (§2.2, §4.1 M1–M6, §9 Segment A–O). **Current resume:** Segments A–L, **Segment M**, **Segment N (closure)**, and **Segment I (L2-06 Memory Gateway)** complete (all eight engines; all workflows; memory gateway vector+structured+object and retention; error taxonomy in `src/contracts/errors.ts` and `src/contracts/ERROR_CODES.md`; `npm run verify:sow` passes). Next (optional): Segment O (production hardening). SOW §9 includes file-path and verification tables for Segments I, M, N, O. Workflow nesting (M6) is implemented per SOW §9 Segment K: workflow runner (`src/workflows/runner.ts`), `workflow_call` step kind, budget inheritance, trace continuity.
- **Contract changelog:** `src/contracts/CHANGELOG.md`.
- **Engines package:** `src/engines/README.md`.
- **Workflow registry:** `src/workflows/registry.ts`; definitions: `src/workflows/definitions/`.
- **Canonical → Artifacts (M2):** `src/brainstem/canonical-to-artifacts.ts` — `canonicalToTypedArtifacts(canonical)`.
- **M5 artifact content shapes:** `src/contracts/m5-artifacts.ts` (ResearchReportContent, DecisionMemoContent).
