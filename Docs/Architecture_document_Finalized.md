# Architecture document.md — Centralized Multimodal AI Server (Finalized, Cursor‑Ready)

> **Goal:** A centralized, production‑grade, industry‑agnostic AI platform exposed through a **single primary endpoint** that abstracts model calls, tools, memory, and agentic workflows—while enforcing strict policy, budgets, and observability.  
> **Hard rule:** **Ingress is mindless** (non‑AI). **Cognition begins at the Brain Stem.**  
> **Core shift:** Move from “pipelines” to **Models → Engines → Workflows → Orchestration** (workflow‑of‑workflows supported).

---

## 1) North Star

### What this server is
A single “AI Server” that applications call via one stable API surface (`POST /v1/query`). The server:
- Canonicalizes multimodal input (text/images/PDF/JSON/audio/etc.)
- Extracts intent + risk + complexity
- Enforces org/app/user policy and budgets
- Selects and orchestrates **workflows** assembled from reusable **engines**
- Executes only through strict **gateways** (models/tools/memory)
- Returns a coherent response with full telemetry + traceability

### What this server is not
- Not a thin proxy to one model
- Not a monolithic “one agent to rule them all”
- Not a system where auth / rate limiting / quota depends on model reasoning
- Not “engine per data type” (engines are multi‑datatype by contract)

---

## 2) Core Principles (Non‑Negotiable)

1. **Strict Cognitive Boundary**
   - **Ingress = deterministic**: auth, rate limits, payload checks, request IDs.
   - **Brain Stem = first cognition**: canonicalize + intent extraction + risk/complexity.
2. **Industry‑agnostic core**
   - Engines and orchestration remain industry domain‑agnostic.
   - Domain specialization happens in **workflows + configs + tool adapters**, not in engine implementations.
3. **Multi‑data‑type by design**
   - Engines consume/produce **Typed Artifacts**, not just natural language strings.
4. **Policy‑gated execution**
   - Orchestrator enforces who can do what, and within which budgets.
   - All tools and memory are scoped and gated.
5. **Composability**
   - Engines are atomic building blocks.
   - Workflows are versioned graphs of engine calls.
   - Workflows may call other workflows (nested workflows).
6. **Observability is a product feature**
   - Every run is traceable: storing all contracts/json, routing rationale, budgets, engine/tool/memory events, costs, outcomes. everything.
7. **Modalities are an input property, not a workflow type**
   - Ingress + Brain Stem canonicalize *all* modalities into **Typed Artifacts** (or attachment handles + structured payload as current evolution).
   - Workflows must never be named by modality (no “multimodal workflow”). all workflows are multimodel in nature because of the orkestration layer
   - Workflows are selected by **intent + complexity + risk + tool/memory needs**, not by “has images/PDFs”.
   - This keeps the architecture from drifting into special-case pipelines.

---

## 3) The Final Layer Model (Models → Engines → Workflows → Orchestration)

### Layer 1 — Model Primitives (Atomic Inference)
Stateless inference endpoints:
- LLMs (general, coding)
- classifiers
- embeddings
- vision / OCR / doc understanding
- org‑custom fine‑tunes

**Rule:** no planning, no looping, no tools, no policy.

### Layer 2 — Engines (Reusable, Multi‑Dataype Blocks)
A small fixed set of **localized** engines that operate over **Typed Artifacts**. Each engine has a single job, uses at most one gateway (Model, Tool, or Memory), and never orchestrates or calls another engine.

- Planning Engine
- Execution Engine
- Evaluation Engine
- Tool Execution Engine
- Memory Engine
- Classification Engine
- Synthesis Engine
- Condensing Engine

**Rule:** engines do not orchestrate; they perform a unique bounded function that contributes to the compilation of a workflow.

### Layer 3 — Workflows (Harness Graphs)
Workflows assemble engines into end‑to‑end behavior. All workflows are **inherently multimodal** because canonicalization produces typed artifacts (or handles) for every input; workflows are defined by **cognitive/runtime behavior and capability needs**, not by modality.

- reactive chat
- coding agent loop (plan/execute/tool/verify)
- deep research (multi-source, evidence-first)
- tool automation
- decision / recommendation
- extraction & normalization (generic structuring)
- verification / audit loop
- planning-only / decomposition
- batch analysis / reporting

**Rule:** workflows are versioned graphs, can call sub‑workflows via the orchestrator.

### Layer 4 — Orchestration & Governance (Control Runtime)
This is the runtime that owns control flow and enforcement. It includes your already‑implemented front door:

- **Ingress (mindless)** ✅ (already implemented)

- **Brain Stem (canonicalize + intent)** ✅ (already implemented)
- Policy + budgets + workflow selection
- Execution supervisor (state machine, retries, fallbacks, nesting)
- Trace + audit + evaluation hooks

**Rule:** Orchestration owns loops, nesting, stop conditions, retries, and budget enforcement. Engines do not.

**Authority boundary (only Orchestrator can):**
- start/stop loops
- invoke sub-workflows
- change execution mode (sync/async)
- allocate or reduce budgets at runtime
- enforce global stop conditions

**Engines can only:** produce artifacts; propose next actions (non-binding). They cannot become mini-orchestrators.

---

## 4) High‑Level System Flow (Final)

```mermaid
flowchart TD
  A[Client Apps] --> B[Ingress: deterministic]
  B --> C[Brain Stem: canonicalize + intent + risk/complexity]
  C --> D[Orchestrator: policy + budgets + workflow selection]
  D --> E[Workflow Runtime: execute workflow graph]
  E --> F1[Engine Calls (Layer 2)]
  F1 --> G1[Model Gateway (Layer 1)]
  F1 --> G2[Tool Gateway]
  F1 --> G3[Memory Gateway]
  E --> H[Synthesis Engine]
  H --> I[ResponseEnvelope + Telemetry + Trace]
```

---

## 5) Minimal External API Surface

### Primary endpoint (apps use this)
- `POST /v1/query`  
  Single entry point for all tasks. Orchestrator selects the workflow.

### Identity trust boundary endpoint (production)
- `POST /token/exchange`  
  Exchanges a validated external IdP JWT + app credentials for a short-lived server AI JWT used by `/v1/query`.

### Operational endpoints (non‑cognitive)
- `GET /healthz` (liveness)
- `GET /readyz` (readiness)
- `GET /metrics` (Prometheus / OTEL exporter)
- `GET /v1/version` (build + model registry versions)

---

## 6) External Request/Response Contracts (Stable)

### 6.1 RequestEnvelope (external)
**Produced by:** client request payload. **Validated by:** code logic (schema, auth, payload limits, contract version). Effective caller context for production execution is derived from verified server trust-token claims, not trusted directly from body fields. No AI.

```json
{
  "contract_version": "v1",
  "request_id": "uuid",
  "timestamp": "2025-02-23T12:00:00.000Z",
  "mode": "auto|sync|stream|async",
  "deadline_ms": 60000,
  "caller": {
    "org_id": "string",
    "app_id": "string",
    "user_id": "string",
    "session_id": "string",
    "scopes": ["string"]
  },
  "input": {
    "text": "string_optional",
    "attachments": [
      {
        "id": "string",
        "type": "image|pdf|json|audio|binary|other",
        "content_b64": "string_optional",
        "uri": "string_optional",
        "meta": { "filename": "string", "mime": "string" }
      }
    ],
    "structured": { "any": "json" }
  },
  "preferences": {
    "response_format": "text|json|markdown|report|diff",
    "verbosity": "low|medium|high",
    "stream": true,
    "safety_profile": "standard|strict|regulated"
  }
}
```

Production rule: if `caller` fields are included in the body, they are advisory and MUST strict-match authenticated claims; mismatch is rejected.

### 6.2 ResponseEnvelope (external)
**Produced by:** code logic (assembly, status, telemetry, error) + **AI model** (content of `output.text` / `output.structured` when filled by Synthesis or Execution Engine).

```json
{
  "contract_version": "v1",
  "request_id": "uuid",
  "status": "ok|blocked|error|accepted",
  "mode": "sync|stream|async",
  "output": {
    "text": "<model_output_text_optional>",
    "structured": { "model_output": "<json_optional>" },
    "attachments": [
      { "artifact_uri": "<artifact_uri>", "artifact_kind": "<report|diff|file|other>" }
    ],
    "citations": [
      { "source": "<source>", "ref": "<ref>", "span": "<span>" }
    ]
  },
  "telemetry": {
    "workflow_id": "string",
    "workflow_version": "string",
    "strategy": "reactive|planner_executor|tree_search|htn",
    "models_used": ["string"],
    "engine_calls": 0,
    "tool_calls": 0,
    "tokens_in": 0,
    "tokens_out": 0,
    "cost_usd_est": 0.0,
    "latency_ms": 0,
    "trace_id": "string",
    "request_timestamp": "2025-02-23T12:00:00.000Z"
  },
  "error": {
    "code": "string",
    "message": "string",
    "detail": { "any": "json" }
  }
}
```

---

## 7) Semantic Reinforcement: Transport vs Meaning

Everything is transported as JSON over HTTP, but **meaning is carried by explicit semantic fields**:
- `artifact_kind` (what it is)
- `schema_ref` (what shape/version it must match)
- `provenance` and `sensitivity` (where it came from, how it must be handled)

This avoids the “but it is already JSON” confusion:
- JSON is a serialization format
- The artifact kind and schema define the *semantic type* and validation rules

**Artifact semantics (company-grade):**
- **artifact_kind** = semantic identity (what this is); **must** be present on every Typed Artifact.
- **schema_ref** = validation contract (what it must conform to); **must** be present for any artifact that crosses engine boundaries (except a few “raw” kinds).
- **encoding** = transport encoding (how bytes are stored/transmitted); not meaning.

---

## 8) Internal Canonical Types (The Spine)

**Determination: code logic vs AI model**  
For each contract below, the document states whether the **producer** of that structure uses **code logic** (deterministic rules, schema validation, heuristics, no model call), **AI model** (LLM or other inference), or **hybrid**. This drives where the “cognitive boundary” sits and where to add observability.

### 8.1 CanonicalRequest (Brain Stem output #1)
**Produced by:** code logic (canonicalize). No AI: normalization, modality detection, token estimates, and attachment handles are deterministic from the request.

- Unified representation after multimodal parsing
- Contains modality tags, token estimates, attachment handles
- Normalizes input into **typed artifacts** (or attachment handles + structured payload) to remove text bias
- *Implementation note:* Current code produces CanonicalRequest with handles and structured payload; full §8.4 Typed Artifact envelopes are the target evolution.

### 8.2 IntentBundle (Brain Stem output #2)
**Produced by:** **code logic** and/or **AI model** (implementation choice; see below).

The `intent` field is the **result** of intent extraction: we *classify* the user’s goal into one of the allowed values (chat, coding, deep_research, etc.). This is what we “look for” — the inferred user intent used for workflow selection. It can be produced by **code logic** (rules, keywords, fast path; e.g. “contains ‘research’ → deep_research”) or by an **AI model** (classification LLM) for richer, context-aware routing. Same contract either way.

- **intent:** Output of classification. **Code logic** = rules/keywords (cheap, deterministic). **AI model** = classifier LLM (richer, may be slower). Implementations can use code-only, model-only, or hybrid (code first, model on uncertain).
- **complexity:** Can be **code logic** (e.g. token count, attachment count, step heuristics) or **AI model** (LLM that estimates single_step vs multi_step vs long_horizon). Code is cheaper and sufficient for many cases.
- **risk_flags:** Can be **code logic** (keyword/PII detectors, blocklists, policy rules) or **AI model** (safety classifier). Often **hybrid**: code for obvious blocks, model for nuanced policy_sensitive/high_impact.

```json
{
  "intent": "<chat|coding|deep_research|tooling|decision|extraction|verification|workflow>",
  "confidence": "<0..1>",
  "complexity": "<single_step|multi_step|long_horizon>",
  "modalities_detected": ["<text|pdf|image|json>"],
  "requires_memory": "<true|false>",
  "tool_likelihood": {
    "filesystem": "<0..1>",
    "web_search": "<0..1>",
    "cli": "<0..1>",
    "http_api": "<0..1>"
  },
  "risk_flags": ["<none|pii|policy_sensitive|high_impact|regulated>"],
  "routing_hints": ["<string>"]
}
```

### 8.3 PolicyDecision (Orchestrator governance)
**Produced by:** code logic (policy evaluator). No AI: allow/deny, budgets, and allowed_workflows come from rules and caller identity.

```json
{
  "allowed_workflows": ["string"],
  "allowed_engines": ["planning","execution","evaluation","tool","memory","classification","synthesis","condensing"],
  "model_budget": { "max_tokens": 16000, "max_cost_usd": 0.25 },
  "tool_budget": { "max_calls": 12, "max_seconds": 90 },
  "memory_rules": {
    "allowed_scopes": ["user","project"],
    "write_back": "allowed|denied"
  },
  "safety_profile": "standard|strict|regulated",
  "audit_level": "none|standard|full"
}
```
*Implementation:* Current code uses `allowed_pipelines` (= allowed_workflows), `max_budgets` (token_budget, tool_budget, deadline_ms, cost_budget_usd), `memory_scope`, `allow_tools`/`deny_tools`.

### 8.4 Typed Artifact (the universal data substrate)
**Envelope produced by:** code logic (whoever creates the artifact). **Content** may be from **code logic** (e.g. tool result, structured record) or **AI model** (e.g. workflow_plan from Planning Engine, text from Synthesis). The envelope itself (artifact_id, artifact_kind, schema_ref, encoding, metadata) is always code.

**Key idea:** this is a universal *envelope* for any payload. The payload can be inline (small) or a reference (object store).

**Rules:** `artifact_kind` **must** be present. `schema_ref` **must** be present for any artifact that crosses engine boundaries (except a few “raw” kinds). `encoding` is about serialization, not meaning.

```json
{
  "artifact_id": "<uuid>",
  "artifact_kind": "<workflow_plan|evaluation_report|tool_result|memory_response|code_patch|report|diff|document_chunk|research_report|decision_memo|normalized_record|custom>",
  "schema_ref": "<optional://schema/name@vX>",
  "encoding": "json|text|binary",
  "content": { "inline": "<payload_or_ref>", "ref": "<optional://object_store/uri>" },
  "metadata": {
    "created_by": "<engine_or_workflow_id>",
    "provenance": "<source description>",
    "trust_score": "<0..1>",
    "sensitivity": "<public|internal|confidential|restricted>"
  }
}
```

### 8.5 Task (unit of work within a workflow)
**Produced by:** **code logic** when built from a static WorkflowDefinition or router; **AI model** when produced by the Planning Engine (task graph from objective + context).

```json
{
  "task_id": "<task_id>",
  "task_type": "<task_type>",
  "category": "<analysis|transformation|generation|evaluation|action|classification|retrieval|synthesis>",
  "objective": { "formal_spec": {}, "description": "<optional>" },
  "input_artifacts": [],
  "expected_output_schema": {},
  "constraints_hints": {
    "latency_class": "<interactive|batch|long_horizon>",
    "accuracy_level": "<approximate|high_precision>",
    "deterministic_required": "<true|false>"
  }
}
```

### 8.6 EngineInvocation / EngineResult (universal engine contract envelope)

**EngineInvocation** — **Produced by:** code logic (orchestrator or workflow runtime assembles invocation from plan and context).
```json
{
  "invocation_id": "uuid",
  "engine_type": "planning|execution|evaluation|tool|memory|classification|synthesis|condensing",
  "task": {},
  "context_artifacts": [],
  "actor_context": {
    "org_id": "string",
    "app_id": "string",
    "user_id": "string",
    "roles": ["string"]
  },
  "budgets": {
    "token_budget": 0,
    "time_budget_ms": 0,
    "cost_budget_usd": 0,
    "tool_budget": 0
  },
  "safety": { "safety_profile": "standard|strict|regulated" },
  "metadata": { "trace_id": "string", "contract_version": "v1" }
}
```

**EngineResult** — **Produced by:** code logic (envelope, status, metrics) + **AI model** or **code logic** for `result_artifacts` depending on engine (e.g. Execution = model, Tool = code).
```json
{
  "invocation_id": "uuid",
  "status": "success|fail|blocked",
  "result_artifacts": [
    {
      "artifact_kind": "<artifact_kind>",
      "schema_ref": "<schema_ref>",
      "encoding": "json",
      "content": { "inline": "<model_or_tool_output>" }
    }
  ],
  "confidence": "<0..1>",
  "proposed_next_action": {
    "type": "<none|call_tool|invoke_workflow|request_replan>",
    "ref": "<tool_id_or_workflow_id>",
    "arguments": { "any": "<json>" }
  },
  "metrics": { "duration_ms": 0, "tokens_used": 0, "cost_estimate_usd": 0.0 },
  "error": { "code": "<string>", "message": "<string>", "detail": { "any": "<json>" } }
}
```

### 8.7 WorkflowDefinition (Layer 3 graph)
**Produced by:** code logic / config (registered workflow templates; authored or generated offline). No runtime AI.

```json
{
  "workflow_id": "string",
  "version": "v1",
  "entry_conditions": {
    "intents": ["string"],
    "required_capabilities": {
      "needs_memory": true,
      "needs_tools": ["web_search"],
      "needs_verification": true
    },
    "risk_allowed": ["standard","strict"]
  },
  "steps": [
    {
      "step_id": "s1",
      "kind": "engine_call|workflow_call|decision",
      "ref": "planning|execution|evaluation|tool|memory|classification|synthesis|condensing OR sub_workflow_id",
      "input_mapping": {},
      "depends_on": ["step_id"]
    }
  ],
  "stop_conditions": { "max_iterations": 3, "deadline_ms": 60000 }
}
```

**Workflow nesting rule:** `workflow_call` is executed by the orchestrator; sub‑workflow inherits parent constraints (possibly tightened). Orchestrator enforces budget inheritance.

---

## 9) Component Breakdown (What you have + what gets added)

### 9.1 Ingress (Layer 4 — already implemented)
**Does**
- TLS termination (or at LB)
- auth verification
- rate limit / quota (or at LB/middleware)
- payload limits
- request IDs / trace propagation
- *Implementation:* TypeScript `src/ingress/validate.ts` — body size, RequestEnvelope schema validation, contract version, optional auth stub, optional attachment validation. Output: validated envelope + caller context.

**Does not**
- call models
- do intent extraction
- run tools
- do memory retrieval

### 9.2 Brain Stem (Layer 4 — already implemented)
**Does**
- multimodal canonicalization → CanonicalRequest + typed artifacts (or attachment handles + structured payload)
- intent extraction → IntentBundle
- complexity + risk hints
- lightweight memory scope hinting (no heavy retrieval loops)
- *Implementation:* TypeScript `src/brainstem/canonicalize.ts`, `intent.ts`. CanonicalRequest has modalities, text, attachment handles, token_estimate; full Typed Artifact envelopes are target evolution.

**Does not**
- execute long tool loops
- run workflows
- bypass policy
- do heavy retrieval itself

### 9.3 Orchestrator (Layer 4 — maps to Control Plane + dispatch)
**Responsibilities**
- Policy enforcement (per org/app/user)
- Budget computation (tokens/cost/tools/time)
- Workflow selection (IntentBundle + PolicyDecision)
- Workflow execution supervisor:
  - state machine
  - iteration limits
  - retries / fallbacks
  - nested workflow calls
  - cancellation + timeouts
- Emits decision traces + OTEL spans/events

**Orchestration output contract:** By the end of the orchestration layer, the system produces a **workflow execution spec** — a single, clear JSON that specifies: **which workflow(s)** to run (workflow_id / pipeline_type), **in what order** (single today; nested later), strategy, budgets, tools_enabled, memory config, models. *Current implementation:* this is **PipelinePlan** (pipeline_type, strategy_id, budgets, tools_enabled, sandbox, memory, models). **tools_enabled** is derived from PolicyDecision (allow_tools minus deny_tools); **sandbox** (e.g. timeout_ms) is set from budget when tools are enabled. The workflow runtime (today: one harness per workflow; later: graph executor) consumes this spec. *Terminology:* pipeline = workflow; pipeline_type = workflow_id; allowed_pipelines = allowed_workflows.

**Semantic reinforcement:**
- Orchestrator produces **decision artifacts** (policy decision, workflow selection, budget assignment) that are stored as typed artifacts for audit/replay.

### 9.4 Workflow Runtime (Layer 3)
**Responsibilities**
- Executes WorkflowDefinition graphs:
  - resolves dependencies
  - dispatches engine calls
  - collects artifacts
  - enforces stop conditions (as directed by orchestrator)
- Does not own policy/budgets (orchestrator does)

*Current implementation:* Workflow execution uses a harness per workflow: **reactive_chat** in `src/pipelines/chat-pipeline.ts`, **coding_agent** in `src/pipelines/coding-agent-pipeline.ts` (supports autonomous (execution ↔ tool)* loop when `harness_autonomous_execution_enabled`, L2-99), **deep_research** in `src/pipelines/deep-research-pipeline.ts`, **decision** in `src/pipelines/decision-pipeline.ts`. Each builds EngineInvocation(s), calls engines (Execution, Synthesis; coding_agent adds Tool and Evaluation; deep_research/decision add Evaluation), and assembles ResponseEnvelope from EngineResult(s). **WorkflowDefinition** contract and **workflow registry** are implemented: contract in `src/contracts/workflow-definition.ts` (steps support `engine_call`, `workflow_call`, `decision`); registry in `src/workflows/registry.ts`; definitions for reactive_chat, coding_agent, deep_research, decision. The orchestration output (workflow execution spec = PipelinePlan) drives which pipeline runs; router selects by intent and policy. **Tool Engine** (`src/engines/tool_engine.ts`) and **Tool Gateway** (allowlist from policy via PipelinePlan.tools_enabled, sandbox from PipelinePlan.sandbox) are implemented per M3; **Evaluation Engine** stub and **Memory Engine** (M4) are implemented. **Next (M6):** Workflow nesting — `workflow_call` steps, workflow runner, budget inheritance, trace continuity; see SOW §4.1 M6 and §9 Segment K.

**Current implemented workflows (2026-02-27):**
- reactive_chat
- coding_agent
- deep_research
- decision
- tool_automation
- extraction_normalization
- verification_audit
- planning_only
- batch_analysis

**Current implemented engines (2026-02-27):**
- planning
- execution
- evaluation
- tool
- memory
- classification
- synthesis
- condensing

### 9.5 Engines (Layer 2)
Engines are the reusable building blocks. Engines are multi‑datatype because they operate on typed artifacts plus schema refs, not on raw text.

---

## 10) Engine Catalog (Layer 2) — Final Contracts

> All engines accept/return **Typed Artifacts**. Engines specialize via `task_type` and `schema_ref`, not by creating new engines per industry or per data modality.

| Engine | Single job | Gateway used | Never does |
|--------|------------|--------------|------------|
| Planning | Produce a WorkflowPlan from objective + constraints | Model (LLM) | Execute, tool, memory, loop |
| Execution | One-step reasoning/transformation over artifacts | Model (LLM) | Plan, tool, memory, loop |
| Evaluation | Verdict/score of artifacts vs criteria | Model (LLM) | Plan, execute, tool, memory |
| Tool | Run one tool call under sandbox | Tool Gateway only | LLM, plan, memory, other tools |
| Memory | Retrieve/write under scope | Memory Gateway only | LLM reasoning, plan, tool |
| Classification | Label artifacts (intent/taxonomy/risk) | Model (LLM) | Plan, execute, tool, synthesize |
| Synthesis | Compose final deliverable from artifacts | Model (LLM) | Plan, execute, tool, memory |
| Condensing | Compress/summarize content into smaller artifact | Model (LLM) | Plan, execute, tool, memory |

**Localization rules (all engines):**
- **One gateway per engine:** An engine touches at most one of Model / Tool / Memory gateway. No engine composes multiple gateways.
- **No orchestration:** Engines do not start loops, call sub-workflows, or allocate budgets. They return artifacts and optional `proposed_next_action` (non-binding).
- **No engine-to-engine calls:** Workflows and orchestrator wire engines; engines never invoke another engine.
- **Strict input/output:** Input is always an EngineInvocation (task + context_artifacts + budgets). Output is always EngineResult (result_artifacts + optional proposed_next_action). No ad-hoc side channels.
- **Stateless within request:** An engine does not retain state across invocations; all context is in the invocation payload.

### 10.1 Planning Engine
**Localized scope:** Produces a single artifact—a **WorkflowPlan**—from objective, environment state, and constraints. No execution, no side effects.

**Does**
- Consumes objective + capabilities + constraints (assembled by orchestrator/workflow).
- Calls **Model Gateway only** (LLM) to produce task graph / HTN / tree_search structure.
- Returns one Typed Artifact: `workflow_plan` with tasks, topology, and estimates.

**Does not**
- Execute tasks or tools; retrieve or write memory; loop internally; mutate global state; call any gateway other than Model.

**WorkflowPlan vs WorkflowDefinition:** **WorkflowDefinition** = a versioned template graph (registered in workflow registry). **WorkflowPlan** = a per-request instantiated plan (produced by Planning Engine or Orchestrator), derived from a WorkflowDefinition + runtime constraints. Planning outputs a *WorkflowPlan instance* (request-scoped), not a workflow definition template.

**Input (PlanningInvocation)** — **Assembled by:** code logic (orchestrator/workflow). **Consumed by:** Planning Engine (AI model).
```json
{
  "engine_type": "planning",
  "objective": { "formal_spec": {} },
  "environment_state": [ { "artifact_id": "..." } ],
  "capabilities": {
    "available_engines": ["execution","evaluation","tool","memory","classification","synthesis", "condense"],
    "available_tools": ["string"]
  },
  "constraints": { "budgets": {}, "safety": {}, "compliance": {} },
  "prior_attempts": [ { "artifact_id": "optional prior plan or failure report" } ]
}
```

**Output (WorkflowPlan artifact)** — **Produced by:** AI model (Planning Engine produces the task graph / plan content).
```json
{
  "artifact_kind": "workflow_plan",
  "schema_ref": "schema://workflow_plan@v1",
  "encoding": "json",
  "content": {
    "plan_id": "<plan_id>",
    "topology": "<sequential|graph|htn|tree_search>",
    "tasks": [
      { "task_id": "<task_id>", "engine": "<execution|evaluation|tool|memory|classification|synthesis|condensing>", "task_type": "<task_type>", "depends_on": [] }
    ],
    "estimates": { "token_estimate": "<int>", "tool_calls_estimate": "<int>" }
  }
}
```

### 10.2 Execution Engine (single bounded reasoning/transformation step)
**Localized scope:** Performs **one** Task: transforms input artifacts into output artifacts using reasoning/generation. May propose a next action (e.g. “call tool X”) but does not perform it.

**Does**
- Consumes one Task + context_artifacts (assembled by workflow).
- Calls **Model Gateway only** (LLM) to analyze, transform, or generate content.
- Returns result_artifacts + optional `proposed_next_action` (type `call_tool` | `invoke_workflow`; orchestrator decides whether to honor it).

**Does not**
- Call Tool or Memory gateways; execute tools; replan; loop; override policy or budgets.

**Input** — **Assembled by:** code logic. **Consumed by:** Execution Engine (AI model).
```json
{
  "engine_type": "execution",
  "task": {
    "task_type": "analyze|transform|generate|extract|patch",
    "input_artifacts": [],
    "expected_output_schema": {}
  },
  "context_artifacts": [],
  "constraints": { "budgets": {}, "safety": {}, "compliance": {} }
}
```

**Output** — **Produced by:** AI model (Execution Engine uses LLM to transform inputs into result_artifacts; proposed_next_action may be model-generated).
```json
{
  "status": "success",
  "result_artifacts": [
    {
      "artifact_kind": "<custom>",
      "schema_ref": "<schema://task_output@v1>",
      "encoding": "json",
      "content": { "result": "<model_output_json>" }
    }
  ],
  "proposed_next_action": { "type": "<none|call_tool|invoke_workflow>", "ref": "<id>", "arguments": { "any": "<json>" } },
  "confidence": "<0..1>"
}
```

### 10.3 Evaluation Engine (judge outcomes)
**Localized scope:** Produces a **single** verdict/score for given artifacts against given criteria. No plan changes, no execution, no tool/memory access.

**Does**
- Consumes target_artifacts + criteria (formal_rules, expected_schema, thresholds) from workflow.
- Calls **Model Gateway only** (LLM as judge) to produce verdict, score, and evidence references.
- Returns one Typed Artifact: `evaluation_report` (verdict, score, confidence, evidence_artifacts).

**Does not**
- Modify plans or artifacts; execute tools; trigger replanning; call Tool or Memory gateways.

**Input** — **Assembled by:** code logic. **Consumed by:** Evaluation Engine (AI model).
```json
{
  "engine_type": "evaluation",
  "target_artifacts": [],
  "criteria": { "formal_rules": {}, "expected_schema": {}, "thresholds": {} }
}
```

**Output** — **Produced by:** AI model (Evaluation Engine / judge LLM produces verdict, score, evidence).
```json
{
  "artifact_kind": "<evaluation_report>",
  "schema_ref": "<schema://evaluation_report@v1>",
  "encoding": "json",
  "content": {
    "verdict": "<pass|fail|uncertain>",
    "score": "<0..1>",
    "confidence": "<0..1>",
    "evidence_artifacts": []
  }
}
```

### 10.4 Tool Execution Engine (deterministic)
**Localized scope:** Executes **one** tool call: parameters in, result out. No language understanding, no planning, no model calls.

**Does**
- Consumes tool_id + parameters + sandbox_profile (from workflow/orchestrator).
- Calls **Tool Gateway only**: resolve tool, run in sandbox, enforce timeout/allowlist.
- Returns one Typed Artifact: `tool_result` (status, result_artifacts, optional logs_ref).

**Does not**
- Call Model or Memory gateways; interpret natural language; plan; evaluate; run multiple tools in one invocation.

**Input** — **Assembled by:** code logic. **Consumed by:** Tool Engine (code).
```json
{
  "engine_type": "tool",
  "tool_id": "string",
  "parameters": {},
  "sandbox_profile": { "network_access": false, "filesystem_access": "scoped", "timeout_ms": 30000 }
}
```

**Output** — **Produced by:** code logic (deterministic tool execution; no LLM).
```json
{
  "artifact_kind": "tool_result",
  "schema_ref": "schema://tool_result@v1",
  "encoding": "json",
  "content": { "tool_id": "string", "status": "ok|error", "result_artifacts": [], "logs_ref": "optional" }
}
```

### 10.5 Memory Engine (scoped retrieval/write)
**Localized scope:** Performs **one** memory operation (retrieve or write) within a given scope. No reasoning about when to remember; workflow decides when to call.

**Does**
- Consumes operation (`retrieve` | `write` | `delete`) + scope + query/artifacts (from workflow).
- Calls **Memory Gateway only**: vector/structured/object store; scope and retention enforced by gateway.
- Returns one Typed Artifact: `memory_response` (retrieved_artifacts or write_status). Embedding for semantic search may use Model Gateway internally via gateway abstraction; the Memory Engine’s *contract* is code-assembled.

**Does not**
- Decide when retrieval is needed; plan; synthesize; call Tool Gateway; perform multi-step reasoning.

**Input** — **Assembled by:** code logic. **Consumed by:** Memory Engine (code; retrieval/write logic; embeddings may use model).
```json
{
  "engine_type": "memory",
  "operation": "retrieve|write|delete",
  "scope": "user|project|org",
  "query": { "structured_query": {}, "semantic_query": "optional" },
  "artifacts": [],
  "options": { "top_k": 8, "filters": {}, "recency": "optional" }
}
```

**Output** — **Produced by:** code logic (retrieval/write result). Optional: embedding model used for semantic search, but the Memory Engine response envelope is code-assembled.
```json
{
  "artifact_kind": "memory_response",
  "schema_ref": "schema://memory_response@v1",
  "encoding": "json",
  "content": { "retrieved_artifacts": [], "write_status": "success|denied|n/a" }
}
```

### 10.6 Classification Engine (intent/risk/taxonomy labeling)
**Localized scope:** Produces **labels + confidences** for given artifacts against a label_schema. No planning, no execution, no final answer.

**Does**
- Consumes artifacts + label_schema (allowed_labels, multi_label) from workflow/Brain Stem.
- Calls **Model Gateway only** (classifier LLM or dedicated classifier model) to produce labels.
- Returns one Typed Artifact: `classification_report` (labels with confidence). Used for intent, risk, taxonomy, or any closed-set labeling.

**Does not**
- Plan; run tools; synthesize final answer; call Tool or Memory gateways.

**Input** — **Assembled by:** code logic. **Consumed by:** Classification Engine (AI model).
```json
{
  "engine_type": "classification",
  "artifacts": [],
  "label_schema": { "allowed_labels": ["string"], "multi_label": true }
}
```

**Output** — **Produced by:** AI model (Classification Engine / classifier LLM produces labels and confidences).
```json
{
  "artifact_kind": "<classification_report>",
  "schema_ref": "<schema://classification_report@v1>",
  "encoding": "json",
  "content": { "labels": [ { "label": "<label>", "confidence": "<0..1>" } ] }
}
```

### 10.7 Synthesis Engine (final packaging)
**Localized scope:** Composes the **final deliverable** from source artifacts into one response (text, json, report, diff, api_payload). No deep reasoning, no planning, no tool/memory calls.

**Does**
- Consumes source_artifacts + output_format (type, optional schema_ref) from workflow.
- Calls **Model Gateway only** (LLM) to compose narrative, structure, and citations from artifacts.
- Returns one Typed Artifact: `final_response` (text, structured, attachments). Typically the last engine in a workflow before ResponseEnvelope assembly.

**Does not**
- Do deep reasoning or replanning; call Tool or Memory gateways; execute tools; produce intermediate plans or task graphs.

**Input** — **Assembled by:** code logic. **Consumed by:** Synthesis Engine (AI model).
```json
{
  "engine_type": "synthesis",
  "source_artifacts": [],
  "output_format": { "type": "text|json|markdown|report|diff|api_payload", "schema_ref": "optional" }
}
```

**Output** — **Produced by:** AI model (Synthesis Engine / LLM composes final text, structured output, attachments from source artifacts).
```json
{
  "artifact_kind": "<final_response>",
  "schema_ref": "<schema://final_response@v1>",
  "encoding": "json",
  "content": { "text": "<model_output_text_optional>", "structured": { "model_output": "<json_optional>" }, "attachments": [] }
}
```

### 10.8 Condensing Engine (compress/summarize)
**Localized scope:** Reduces one or more artifacts into a **single, smaller artifact** (summary, digest, compressed representation). Used for context window management, recap, or chunk reduction—not for planning or execution.

**Does**
- Consumes source_artifacts + condensing_spec (max_tokens, format_hint, preserve_keys) from workflow.
- Calls **Model Gateway only** (LLM) to summarize or compress content.
- Returns one Typed Artifact: condensed content (e.g. `artifact_kind: condensed_summary`) with schema_ref. No side effects.

**Does not**
- Plan; execute tasks; call tools; read/write memory; call Tool or Memory gateways; produce workflow plans or final user-facing responses.

**Input** — **Assembled by:** code logic. **Consumed by:** Condensing Engine (AI model).
```json
{
  "engine_type": "condensing",
  "source_artifacts": [],
  "condensing_spec": {
    "max_output_tokens": 0,
    "format_hint": "summary|bullets|structured",
    "preserve_schema_ref": "optional"
  }
}
```

**Output** — **Produced by:** AI model (Condensing Engine produces condensed artifact).
```json
{
  "artifact_kind": "<condensed_summary>",
  "schema_ref": "<schema://condensed_summary@v1>",
  "encoding": "json",
  "content": { "summary": "<model_output_text_optional>", "structured": { "model_output": "<json_optional>" }, "source_artifact_ids": [] }
}
```

---

## 11) Workflow Catalog (Layer 3) — Real Implementable Workflows (Modality-Agnostic)

> All workflows are inherently multimodal because Ingress + Brain Stem canonicalize every input into Typed Artifacts (or handles + structured payload).
> Therefore workflows are defined by **behavior and capability needs** (tools, memory, verification, horizon),
> not by modality (image/pdf/audio/etc).

### 11.1 Workflow: Reactive Chat (fast lane)
**Use:** Q&A, explanations, quick drafting, low-risk assistance  
**Behavior:** single-pass, minimal tool use  
**Engines:** classification → (optional memory retrieve) → execution → synthesis  
**Stop conditions:** single pass; strict latency budget

---

### 11.2 Workflow: Coding Agent (plan/execute/tool/verify loop)
**Use:** bugfix, feature, refactor, patch generation  
**Behavior:** bounded iterative loop with verification gates  
**Engines:** planning → (execution ↔ tool ↔ evaluation)* → synthesis  
**Tools:** filesystem/cli/tests (policy-gated)  
**Stop conditions:** max iterations, deadline, tool budget, verification pass

---

### 11.3 Workflow: Deep Research (multi-source, evidence-first)
**Use:** “Research X deeply”, produce report with traceable sources + claims  
**Behavior:** iterative gather → synthesize → critique → gather loop  
**Engines:** planning → (tool:web_search ↔ execution:summarize ↔ evaluation:coverage/consistency)* → synthesis:report  
**Outputs:** structured “ResearchReport” artifact (claims, evidence links, confidence, open questions)  
**Stop conditions:** coverage threshold met, diminishing returns, deadline/cost budget

**Key semantic rule:** Deep Research produces a *claim-evidence graph* as artifacts, not just prose.

---

### 11.4 Workflow: Tool Automation (ops / backoffice / integration actions)
**Use:** call APIs, update tickets/records, generate exports, run commands  
**Behavior:** plan + execute deterministic actions with sanity checks  
**Engines:** classification → planning → tool* → evaluation → synthesis  
**Stop conditions:** strict tool budget + audit requirements

---

### 11.5 Workflow: Decision & Recommendation (options, tradeoffs, constraints)
**Use:** choose among alternatives (architecture, vendor, plan, policy)  
**Behavior:** generate options → score → justify → verify constraints  
**Engines:** planning → execution(generate options) → evaluation(score/rank) → synthesis(decision memo)  
**Outputs:** DecisionMemo artifact (options, scores, assumptions, risks, recommendation)  
**Stop conditions:** confidence threshold or max iterations

---

### 11.6 Workflow: Extraction & Normalization (generic structuring lane)
**Use:** convert messy inputs into canonical structured records (forms, tables, entity extraction)  
**Behavior:** transform + validate schema + correct loop  
**Engines:** classification → execution(extract/transform) → evaluation(schema validity) → (optional memory write) → synthesis  
**Outputs:** normalized_record artifacts bound to schema_ref  
**Stop conditions:** schema-valid + confidence threshold or bounded retries

---

### 11.7 Workflow: Verification / Red-Team / Consistency Loop (high assurance lane)
**Use:** when correctness matters (math, specs, code review notes, important summaries)  
**Behavior:** produce → verify → adversarial check → repair loop  
**Engines:** execution → evaluation(verification checks) → execution(repair) → synthesis  
**Verification sources:** unit tests, rule checks, cross-consistency, self-consistency, tool-based checks  
**Stop conditions:** verified pass, bounded retries, deadline

---

### 11.8 Workflow: Planning-Only / Decomposition (no execution)
**Use:** break down a project/task into plan, milestones, artifacts, acceptance criteria  
**Behavior:** planning + optional evaluation of plan quality  
**Engines:** planning → evaluation(plan quality / completeness) → synthesis(plan)  
**Outputs:** WorkflowPlan + milestone artifacts  
**Stop conditions:** single pass or one refinement pass

---

### 11.9 Workflow: Batch Analysis / Reporting
**Use:** run analyses over many items, produce aggregated reports  
**Behavior:** batch loop with aggregation + synthesis  
**Engines:** planning → (execution ↔ evaluation)* → synthesis(report)  
**Stop conditions:** batch complete, deadline, cost budget

Industry customization happens via policy + tool adapters + schemas + configs. Nested workflows execute via orchestrator; budgets inherit and cannot exceed parent limits.

---

## 12) Gateways (Choke Points)

### Model Gateway (Layer 1 access)
- Provider abstraction (external APIs + internal/self-hosted providers)
- capability-type + scope/tenancy model registry (org-wide, app-scoped, user-scoped)
- caller-context + policy-driven model resolution (org/app/user + required capability)
- retries/fallbacks with retryability classification by error type
- token + cost accounting
- cache (optional)
- safety metadata plumbing
- provider endpoints/credentials/quotas loaded from validated config schema

#### Model Gateway API (engine-facing contract)
All engines that use models call this gateway. No engine calls providers directly.

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

### Tool Gateway (Tool Execution Engine runtime)
- default deny + explicit allowlist by policy and tenant/application
- tool registry + permission mapping
- sandbox isolation
- timeouts/retries/circuit breakers
- secrets injection (ephemeral)
- execution identity binding + auditable trace context
- redaction of logs

### Memory Gateway (Memory Engine backends)
- vector store + structured store + object store
- scope enforcement + retention policies
- retrieval/ingestion bounds (timeouts/fallback, context size caps, chunk limits)
- production uses persistent/shared stores; in-memory is local/dev fallback
- provenance tracking

*Implementation (2026-02-27):* **Segment I (L2-06) complete.** Gateway composed in `src/memory/memory-gateway.ts`: `IMemoryGateway` holds `vectorStore` (IMemoryStore), `structuredStore` (IStructuredStore), `objectStore` (IObjectStore), and optional `retention`. `getMemoryGateway()` in `default-store.ts` returns the composed gateway; `getDefaultStore()` returns the same vector store for retrieval. Structured store: `src/memory/structured-store.ts` (InMemoryStructuredStore, key-value by scope). Object store: `src/memory/object-store.ts` (InMemoryObjectStore, blobs by id and scope). Retention: config `memoryRetention` (ttl_seconds, max_chunks_per_scope) in `src/config/schema.ts`; InMemoryStore accepts optional retention and evicts by TTL and max chunks per scope. See SOW §9 Segment I; SPEC 17.

---

## 13) Observability & Evaluation (Always On)

**Required events taxonomy**
- ROUTE_DECISION
- POLICY_DECISION
- BUDGET_ASSIGN
- WORKFLOW_START/END
- ENGINE_START/END
- TOOL_START/END
- MEMORY_QUERY/WRITE
- VERIFY_RESULT
- FINAL_SYNTH
- ERROR

All events carry: `trace_id`, `request_id`, `org_id/app_id/user_id` (redacted as policy dictates), and cost/latency metrics. ENGINE_END payloads include duration_ms and, when available, cost_estimate_usd and tokens_used. Pipelines emit WORKFLOW_START/WORKFLOW_END at workflow run boundaries. Metrics are exposed at GET /metrics (JSON by default; Prometheus exposition format when Accept: text/plain or ?format=prometheus).

---

## 14) Updated Repo Layout (Cursor‑Friendly)

Implementation is **TypeScript** under `src/`. Logical layout (current + target):

```text
ai-server/
  docs/
    Architecture document.md
    engine_contracts.md
    workflow_catalog.md
    api_contracts.md
  src/
    ingress/               # (existing)
      validate.ts
      types.ts
      attachments.ts
      errors.ts
    brainstem/             # (existing)
      canonicalize.ts
      intent.ts
      preprocess.ts
      index.ts
    controlplane/          # Orchestration: policy + budget + router (existing)
      control-plane-impl.ts
      policy-evaluator.ts
      resource-manager.ts
      tenant-budget.ts
      dispatch-gate.ts
      types.ts
    router/                # Workflow selection → PipelinePlan (existing)
      default-router.ts
      types.ts
    pipelines/             # Workflow runtime (one harness per workflow today)
      chat-pipeline.ts
      types.ts
    workflows/             # NEW (Layer 3 target): registry + definitions
      registry.ts
      definitions/
        reactive_chat.json
        coding_agent.json
        deep_research.json
        tool_automation.json
        decision_recommendation.json
        extraction_normalization.json
        verification_audit.json
        planning_only.json
        batch_analysis.json
    engines/               # NEW (Layer 2 target)
      base.ts
      planning_engine.ts
      execution_engine.ts
      evaluation_engine.ts
      tool_engine.ts
      memory_engine.ts
      classification_engine.ts
      synthesis_engine.ts
      condensing_engine.ts
      model_gateway.ts
      tool_gateway.ts
      memory_gateway.ts
    contracts/
    observability/
      tracing.ts
      metrics.ts
      events.ts
      redaction.ts
    server/
      routes.ts
      query-handler.ts
  tests/
    unit/
    integration/
    workflow_regression/
  deploy/
    docker/
    k8s/
    helm/
```

---

## 15) Implementation Plan (Optimized for “you already have Ingress + Brain Stem”)

### Milestone 1 — Wire existing layers into the Orchestrator entrypoint
- Keep Ingress + Brain Stem as‑is
- Add Orchestrator skeleton: policy + budgets + workflow selection (control plane + router)
- Implement simplest workflow: Reactive Chat
- Implement minimal engines: Execution + Synthesis + Classification stubs
- OTEL trace spans across ingress → brainstem → orchestrator → workflow → engines

### Milestone 2 — Typed Artifacts end‑to‑end
- CanonicalRequest produces typed artifacts (or refs); current code uses attachment handles + structured payload as evolution path
- Engines consume/produce artifacts only
- Synthesis outputs ResponseEnvelope attachments

*Implementation (2026-02-27):* M2 complete. `brainstem/canonical-to-artifacts.ts` provides `canonicalToTypedArtifacts(canonical)`; Execution and Synthesis set `schema_ref` on result artifacts; ResponseEnvelope includes `output.attachments`. M5 complete: Deep Research and Decision pipelines produce ResearchReport and DecisionMemo artifacts. **Segment M complete:** All eight engines (Planning, Condensing) and workflows tool_automation, extraction, verification, planning_only, batch_analysis are implemented; run via workflow runner when router selects by `routing_hints`. **Resume:** SOW §4.1 — Segments K, L, M complete. Next: optional Segment I (L2-06 gateway expansion), Segment N (closure). SOW §9 has implementation notes and file-path/verification tables for Segments I, M, and N.

### Milestone 3 — Tool Engine + Coding Agent workflow
- Tool gateway sandbox + allowlists
- Coding agent workflow (planning → execution ↔ tool ↔ evaluation)
- Verification via tests/build

*Implementation (2026-02-27):* M3 complete. Tool Engine (`src/engines/tool_engine.ts`) calls Tool Gateway only; allowlist from **PolicyDecision** via **PipelinePlan.tools_enabled** (router sets tools_enabled = policy.allow_tools minus policy.deny_tools). PipelinePlan includes optional **sandbox** (timeout_ms, etc.) when tools are enabled. Tool Gateway: DenyOnlyToolGateway (default), AllowlistToolGateway (allowlist + sandbox, built by query-handler when plan has tools_enabled), StubAllowedToolGateway (tests). Coding agent pipeline runs execution → tool → evaluation → synthesis; writes **TOOL_ACCESS** audit events when policy.audit_level !== "none". Telemetry and audit use **policy.redaction_level**. See SOW §4.1 M3, Segment F and G, and SPEC 16, 19.

### Milestone 4 — Memory Engine + document‑grounded workflows
- Memory gateway (vector + structured + object store)
- Citation grounding evaluation; workflows that need memory use required_capabilities.needs_memory

*Implementation (2026-02-27):* M4 / SOW Segment H complete; **Segment I (L2-06)** complete. Memory Engine (`src/engines/memory_engine.ts`) implements `IEngine`; calls Memory Gateway only (`runRetrieval` / `IMemoryStore` in `src/memory/`); returns `memory_response` Typed Artifact with citations and contextText. Reactive Chat invokes Memory Engine when `plan.memory?.retrieval` is set and policy `memory_scope` ≠ none; query-handler passes `memoryStore: getDefaultStore()` to `createChatPipeline` (vector store from `getMemoryGateway().vectorStore`). **Memory Gateway** (`src/memory/memory-gateway.ts`): composed vector + structured + object stores; retention config in schema; InMemoryStore supports TTL and max_chunks_per_scope. Scope enforced at retrieval layer; E2E test in `src/server/retrieval.integration.test.ts` asserts caller org only receives citations from their org. Workflow `reactive_chat.json` has `required_capabilities.needs_memory: true`. See SOW §4.1 M4, §9 Segment H and I; Engines-and-Contracts.md §6–7; SPEC 17.

### Milestone 5 — Deep Research + Decision workflows
- Deep Research workflow (gather → synthesize → critique loop; ResearchReport artifact)
- Decision & Recommendation workflow (options, scores, DecisionMemo artifact)

*Implementation (2026-02-27):* M5 / SOW Segment J complete. **Deep Research** pipeline (`src/pipelines/deep-research-pipeline.ts`): execution → evaluation → synthesis; produces **ResearchReport** artifact (claims, evidence links, open questions); content shape in `src/contracts/m5-artifacts.ts` (ResearchReportContentSchema). **Decision** pipeline (`src/pipelines/decision-pipeline.ts`): execution → evaluation → synthesis; produces **DecisionMemo** artifact (options, scores, recommendation); DecisionMemoContentSchema in m5-artifacts. Router selects `deep_research` when `intent.routing_hints` includes `"deep_research"`, `decision` when `routing_hints` includes `"decision"`; policy allows both in `allowed_pipelines`. Workflow definitions registered in `src/workflows/registry.ts` (deep_research, decision). See SOW §4.1 M5, §9 Segment J; SPEC 14 Pipelines Catalog; Engines-and-Contracts.md §7.6–7.7.

### Milestone 6 — Workflow nesting
- Parent workflows calling sub‑workflows via orchestrator
- Enforce inherited budgets + trace continuity

*Implementation (2026-02-27):* Segment K (M6) complete. Workflow runner (`src/workflows/runner.ts`), `workflow_call` step kind, budget inheritance, trace continuity; E2E and budget-inheritance tests. **Segment L** (L2-07/08), **Segment M** (Planning + Condensing engines; tool_automation, extraction, verification, planning_only, batch_analysis workflows), **Segment N (closure)**, and **Segment I (L2-06 Memory Gateway expansion)** complete. Next (optional): Segment O (production hardening). §9 Segment K has full implementation notes; §9 Segment M has engine and workflow file-path tables; §9 Segment I has memory gateway and retention.

## 16) Guardrails (Keep the architecture from collapsing)
- Engines **never** call each other directly; only workflows/orchestrator coordinate.
- **Only Orchestrator** can start/stop loops, invoke sub-workflows, change execution mode, allocate or reduce budgets, enforce global stop conditions. Engines can only produce artifacts and propose next actions (non-binding).
- Tool execution is deterministic and schema‑validated; no LLM interpretation in Tool Engine.
- Memory Engine enforces scope; workflows decide when to retrieve/write.
- Brain Stem stays “cheap cognition” only; no long loops.
- Workflows are selected by **intent + complexity + risk + capability needs**, not by modality; no modality-named workflows.
- Orchestrator output is a single, clear **workflow execution spec** (which workflow(s), in what order, strategy, budgets, tools, memory, models); workflow runtime consumes this only.

---

## 17) Summary
You keep your implemented “front door” (Ingress + canonicalize + intent extraction) and elevate it into the **Layer 4 Orchestration runtime**. Below that, the system becomes a reusable, multi‑industry platform built from:
- **Layer 1:** Models (atomic inference)
- **Layer 2:** Engines (multi‑datatype building blocks)
- **Layer 3:** Workflows (graphs; modality-agnostic, defined by behavior and capability needs; can call other workflows)
- **Layer 4:** Orchestration (governance + runtime; includes existing ingress/brainstem; produces a clear **workflow execution spec** JSON that the workflow runtime consumes)

**Design rules:** Modalities are an input property, not a workflow type. By the end of orchestration, a single JSON specifies which workflow(s) to run, in what order, with strategy and budgets. Current implementation uses PipelinePlan (pipeline_type = workflow_id); workflow catalog is reactive chat, coding agent, deep research, tool automation, decision/recommendation, extraction & normalization, verification/audit, planning-only, batch analysis.

---

## 18) Production Readiness Target State (Normative)

This section defines how the server **must** behave in production. It is the authoritative architecture target state. The production gaps report is a tracking artifact for implementation delta against these requirements.

### 18.1 Identity, Authentication, and Tenant Binding

- `POST /v1/query` SHALL require a server-issued AI JWT; unauthenticated requests and non-exchanged third-party tokens are rejected.
- Effective caller context (`org_id`, `app_id`, `user_id`, `scopes`, optional `session_id`) SHALL be derived from verified AI JWT claims.
- Body `caller` fields, if present, SHALL be treated as advisory and MUST strict-match token claims; mismatch is rejected.
- The platform SHALL support multi-IdP federation with **Keycloak as default**, with per-org/app issuer registry entries (`issuer`, `jwks_uri`, expected `aud`, claim mappings).
- The token exchange boundary (`POST /token/exchange`) SHALL validate external IdP JWTs plus app credentials, then mint short-lived server trust tokens for query execution.
- App registry entries SHALL define app credentials, allowed IdPs, and allowed scopes; exchange is denied when registration or scope checks fail.
- Trust-token signing keys SHALL support rotation (JWKS) and short TTL windows (for example 5-30 minutes).
- Unknown issuer, invalid signature, key mismatch, expired token, claim mismatch, or scope mismatch SHALL fail closed.

### 18.2 Ingress and Operational Endpoint Security

- Ingress remains deterministic and non-cognitive: payload limits, schema checks, request IDs, auth checks, contract checks.
- `/metrics`, `/healthz`, `/readyz`, and `/v1/version` SHALL be protected by auth, mTLS, and/or private admin listener/network boundary; they are not implicitly public in production.
- Secrets for model/tool/memory integrations SHALL be resolved from managed secrets backends in production; stub placeholders are non-production only.
- Secrets SHALL never be emitted in logs/events/audit; redaction policy SHALL be enforced consistently.

### 18.3 Governance, Budgets, and Runtime Enforcement

- Governance enforcement (`policy -> budget -> route -> dispatch gate`) SHALL be non-bypassable in production.
- Assigned budgets (`token_budget`, `tool_budget`, `deadline_ms`, `cost_budget_usd`) SHALL be enforced at runtime, not only computed.
- A global request deadline wrapper SHALL bound total wall-clock execution for each request.
- Rate limiting and quota enforcement SHALL produce deterministic `429` behavior and explicit error taxonomy.
- Cross-request tenant cost controls SHALL use shared/persistent counters (not process-local only).
- Tenant usage accounting failures SHALL default to fail-soft handling (log + metric + audit) so successful user responses are not retroactively converted to `500` unless policy requires hard-fail.

### 18.4 Orchestration Correctness and Workflow Safety

- Orchestrator remains the only authority for loops, retries, nesting, and stop conditions.
- Workflow definitions SHALL fail validation on cycles, missing refs, and invalid dependency graphs.
- `stop_conditions` (`max_iterations`, `deadline_ms`) SHALL be enforced centrally by workflow runtime.
- `decision` step semantics SHALL be explicitly implemented or explicitly rejected at validation time.
- Policy allowlists and registered workflow catalog SHALL stay aligned; no dead or unreachable production workflows.

### 18.5 Model Gateway Target State

- Production SHALL use real model providers (internal and external), not stub-only model execution.
- Model registry SHALL support two routing axes:
  - **Capability type** (chat, classification, embedding, vision, multimodal, etc.; extensible taxonomy)
  - **Scope/tenancy** (org-wide, app-scoped, user-scoped models)
- Model resolution SHALL use caller context + policy constraints to select the provider/model across those two axes.
- Provider endpoints, credential references, and rate/usage guardrails SHALL be defined in validated config schema.
- Model calls SHALL include strict timeout, retry policy, and retryability classification by error class.
- Gateway timeout logic SHALL avoid timer leaks/churn and enforce deterministic error mapping.

### 18.6 Tool Gateway Target State

- Tool execution remains deny-by-default unless explicitly allowed by policy + allowlist.
- Allowed tools SHALL run in constrained sandbox settings (timeout, filesystem/network controls, and auditable identity context).
- Production SHALL not depend on stub tool delegates for real side-effecting actions.
- Tool invocations SHALL be audited with policy-compliant redaction and deterministic deny reasons.

### 18.7 Memory and Retrieval Target State

- Production memory SHALL use persistent/shared backends (vector, structured, object) with strict scope enforcement.
- Retrieval quality path SHALL include embeddings/vector similarity in production; lexical-only ranking may be explicit fallback only.
- Retrieval SHALL support bounded latency (timeouts/fallback) and bounded context size (token/size caps).
- Ingestion SHALL enforce per-request/document chunk limits to prevent unbounded memory growth.
- Retention settings (TTL/max chunks) SHALL be wired from validated config into active stores.
- Memory abstraction contracts SHALL be fully defined (no production `TBD` interface surfaces).

### 18.8 Observability, Audit, and Evaluation

- Required event taxonomy SHALL be emitted with trace continuity across ingress -> brainstem -> control plane -> workflow -> engine/tool/memory.
- Event and audit sinks SHALL be non-blocking, persistent, and operationally bounded (rotation, backpressure, failure policy).
- Sink settings (path/endpoint, retention, and write policy) SHALL be validated in config and enforced before serving production traffic.
- Audit integrity chain updates SHALL be serialized/atomic in runtime write path.
- Metrics and capture buffers SHALL enforce bounded cardinality/memory strategy in long-running services.
- Production readiness requires trace sampling policy, alert simulation drills, and expanded eval baselines for retrieval and multimodal behavior.

### 18.9 Server Lifecycle, Transport, and Reliability

- Startup SHALL fail fast on invalid required config (including explicit `CONFIG_FILE` errors when configured).
- Server SHALL validate port/TLS settings and implement graceful shutdown (SIGTERM/SIGINT drain + close).
- If TLS is configured but invalid, startup SHALL fail (no silent fail-open to unintended HTTP-only mode).
- Body read path SHALL enforce read timeout and aborted-request handling.
- Health/readiness SHALL reflect dependency state and return non-ready status (`503`) when required dependencies degrade.

### 18.10 Contract and Execution-Mode Consistency

- External and internal contracts SHALL match actual runtime behavior.
- If async mode is exposed (`mode=async`, `job_id`, `accepted`, `async_job`), the platform SHALL provide full async lifecycle semantics (queue, status, retrieval, idempotency).
- If async/idempotency lifecycle is not implemented, these contract surfaces SHALL be constrained/removed until implemented.

### 18.11 Configuration and Rollout Governance

- All runtime-impacting settings SHALL be represented in validated config schema (including auth trust settings, model/provider registry and credential refs, audit/event sink settings, and memory retention).
- Feature flags SHALL not be parse-only; each production flag SHALL map to explicit runtime behavior.
- Rollout gates (production rollout enablement, harness readiness) SHALL be enforced in runtime control paths, not advisory only.
- Production deployments SHALL carry release/build metadata for traceability and rollback operations; missing required metadata SHALL fail gate checks in production.

### 18.12 Quality and Operability Requirements

- Critical runtime modules SHALL have unit + integration coverage at minimum for governance, memory gateway, workflows registry/runner, and evaluation paths.
- Production-selected engines (evaluation/classification/planning/execution/synthesis) SHALL not rely on stub implementations in production request paths.
- Runbooks SHALL cover release/rollback, observability incidents, memory outages, and security event response.
- Artifact/release policy (`dist/` tracked vs CI-built) SHALL be explicit and consistent across local/dev/CI environments.

**End of document**
