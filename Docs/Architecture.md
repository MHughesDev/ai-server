# Architecture document.md — Centralized Multimodal AI Server (Cursor‑Ready)

> **Goal:** A centralized, production‑grade intelligence system exposed through a **single primary endpoint** that abstracts model orchestration, tool execution, memory retrieval, and agentic reasoning loops.  
> **Hard rule:** **Ingress is mindless** (non‑AI). **Cognition begins at the Brain Stem.**

---

## 1) North Star

### What this server is
A single “AI Server” that applications call via one stable API surface. The server decides **how** to answer (pipeline selection), **what** to use (models/tools/memory), and **how to verify** results, while maintaining observability, safety, and cost controls.

### What this server is not
- Not a thin proxy to one model
- Not a monolithic “one agent to rule them all”
- Not a system where authentication/rate limiting depends on model inference

---

## 2) Core Principles (Non‑Negotiable)

1. **Strict Cognitive Boundary**
   - **Ingress = deterministic** (TLS, auth, quotas, payload limits).
   - **Brain Stem = first cognition** (canonicalize + intent + memory scoping).
2. **Multimodal by construction**
   - Text, images, PDFs, and structured JSON become a **single canonical request** format.
3. **Pipeline = agent harness**
   - Each pipeline is a pluggable execution graph (planner → tools → memory → verification → synthesis).
4. **Policy‑gated execution**
   - Caller identity and budget constraints must gate tool use, memory scope, and model selection.
5. **Observability is a first‑class product feature**
   - Every request generates a trace, costs, tool calls, and evaluation outcomes.

---

## 3) High‑Level System Flow

```mermaid
flowchart TD
  A[Client Apps] --> B[Ingress (Zero Intelligence)]
  B --> C[Brain Stem (Canonicalize + Intent + Memory Scope)]
  C --> D[Policy & Strategy Gate]
  D --> E[Pipeline Router]
  E --> F1[Chat Pipeline]
  E --> F2[Coding Agent Pipeline]
  E --> F3[RAG / Retrieval Pipeline]
  E --> F4[Tool Agent Pipeline]
  E --> F5[Multimodal Reasoning Pipeline]
  F1 --> G[Response Synthesizer]
  F2 --> G
  F3 --> G
  F4 --> G
  F5 --> G
  G --> H[Client Response]
```

---

## 4) Minimal External API Surface (MVP → Production)

### Primary endpoint (the one apps use)
- `POST /v1/query`  
  Single entrypoint for all tasks. The server decides the pipeline.

### Operational endpoints (non‑cognitive)
- `GET /healthz` (liveness)
- `GET /readyz` (readiness)
- `GET /metrics` (Prometheus / OTEL exporter)
- `GET /v1/version` (build + model registry versions)

> Keep the app‑facing surface minimal; add admin endpoints only behind private network + auth.

---

## 5) Request/Response Contracts (Stable)

### 5.1 RequestEnvelope (external)
```json
{
  "request_id": "uuid",
  "caller": {
    "app_id": "string",
    "user_id": "string",
    "org_id": "string",
    "session_id": "string",
    "scopes": ["string"]
  },
  "input": {
    "text": "string",
    "attachments": [
      {
        "id": "string",
        "type": "image|pdf|json|other",
        "content_b64": "string_optional",
        "uri": "string_optional",
        "meta": { "filename": "string", "mime": "string" }
      }
    ],
    "structured": { "any": "json" }
  },
  "preferences": {
    "response_format": "text|json|markdown",
    "verbosity": "low|medium|high",
    "stream": true
  }
}
```

### 5.2 ResponseEnvelope (external)
```json
{
  "request_id": "uuid",
  "status": "ok|error",
  "output": {
    "text": "string",
    "structured": { "any": "json" },
    "citations": [
      { "source": "string", "ref": "string", "span": "string" }
    ]
  },
  "telemetry": {
    "pipeline": "string",
    "models_used": ["string"],
    "tool_calls": 3,
    "tokens_in": 1234,
    "tokens_out": 456,
    "cost_usd_est": 0.0123,
    "latency_ms": 8421
  },
  "error": {
    "code": "string",
    "message": "string",
    "detail": { "any": "json" }
  }
}
```

---

## 6) Internal Canonical Types (The Spine)

These objects are **internal** and versioned. They enable modularity.

### 6.1 CanonicalRequest
- Unified representation after multimodal parsing
- Always includes modality tags, token estimates, and attachment handles

### 6.2 IntentBundle (Brain Stem output)
```json
{
  "intent": "chat|coding_agent|rag|tool_agent|multimodal_reasoning",
  "confidence": 0.0,
  "complexity": "single_step|multi_step|long_horizon",
  "requires_memory": true,
  "memory_scope": ["user", "project", "org"],
  "tool_probability": {
    "filesystem": 0.0,
    "web_search": 0.0,
    "cli": 0.0,
    "http_api": 0.0
  },
  "risk_flags": ["none|pii|policy_sensitive|high_impact"],
  "routing_hints": ["string"]
}
```

### 6.3 PolicyDecision
```json
{
  "allowed_pipelines": ["chat", "coding_agent", "rag", "tool_agent", "multimodal_reasoning"],
  "model_budget": { "max_tokens": 16000, "max_cost_usd": 0.25 },
  "tool_budget": { "max_calls": 12, "max_seconds": 90 },
  "memory_rules": { "allowed_scopes": ["user", "project"], "write_back": "allowed|denied" },
  "safety_profile": "standard|strict|internal",
  "strategy": "reactive|planner_executor|tree_search|htn"
}
```

### 6.4 PipelinePlan
A concrete execution graph selection:
```json
{
  "pipeline": "coding_agent",
  "strategy": "planner_executor",
  "models": {
    "planner": "gpt-5.x",
    "executor": "gpt-5.x",
    "vision": "gpt-5.x-vision"
  },
  "tools_enabled": ["filesystem", "cli"],
  "memory": { "retrieval": "vector+structured", "top_k": 8 },
  "verification": { "enabled": true, "checks": ["self_consistency", "unit_tests"] }
}
```

---

## 7) Component Breakdown (Responsibilities + Interfaces)

### 7.1 Ingress (Zero Intelligence)
**Responsibilities**
- TLS termination (often at LB / API gateway)
- Verify auth token
- Rate limit / quota
- Enforce payload limits
- Normalize headers + request ids

**Interface**
- Input: raw HTTP request
- Output: authenticated RequestEnvelope + caller identity

**Notes**
- Never call models here.
- Never do intent classification here.

---

### 7.2 Brain Stem (First Cognition Layer)
**Responsibilities**
- Multimodal canonicalization (text + image + PDF + JSON)
- Conversation state loading (history, session metadata)
- Memory scoping + lightweight memory prefetch decision
- Intent extraction + confidence scoring
- Complexity/horizon estimation

**Interface**
- Input: RequestEnvelope
- Output: (CanonicalRequest, IntentBundle)

**Design rule**
- Brain Stem is allowed to do **cheap** cognition to route efficiently.
- It must not run long tool loops.

---

### 7.3 Policy & Strategy Gate
**Responsibilities**
- Enforce caller policy (org/app/user rules)
- Budget calculation (tokens/cost/tool calls)
- Decide strategy (reactive vs planner/executor vs HTN)
- Restrict tools and memory scope

**Interface**
- Input: (CanonicalRequest, IntentBundle, CallerContext)
- Output: PolicyDecision

---

### 7.4 Pipeline Router
**Responsibilities**
- Translate (IntentBundle + PolicyDecision) → PipelinePlan
- Choose pipeline template + model set
- Attach budgets + tool availability
- Prepare execution graph

**Interface**
- Input: (CanonicalRequest, IntentBundle, PolicyDecision)
- Output: PipelinePlan

---

### 7.5 Pipeline Harness (Execution Graph)
Each pipeline is a **harness** with the same internal shape:

1) **Planner** (LLM call)  
2) **Executor** (tool calls + state updates)  
3) **Memory** (retrieve/write)  
4) **Verifier** (checks)  
5) **Synthesizer** (final response)

**Interface**
- Input: (CanonicalRequest, PipelinePlan)
- Output: ResponseEnvelope + Trace

**Important**
- Tool execution goes through a **Tool Gateway**.
- Memory access goes through a **Memory Abstraction**.
- Models are accessed through a **Model Gateway**.

---

### 7.6 Tool Gateway (Isolated + Budgeted)
**Responsibilities**
- Tool registry and permissions
- Sandbox execution (filesystem/cli/http)
- Circuit breakers, retries, timeouts
- Tool logs + redaction

**Interface**
- Input: ToolInvocation
- Output: ToolResult + artifacts

---

### 7.7 Memory Abstraction (Vector + Structured)
**Responsibilities**
- Vector retrieval (Chroma)
- Structured store (Postgres)
- Memory scope enforcement (user/project/org)
- Write‑back decisions + summarization

**Interface**
- Input: MemoryQuery (scope + query + top_k)
- Output: MemoryContext (chunks + structured facts)

---

### 7.8 Model Gateway (Routing + Fallback)
**Responsibilities**
- Provider abstraction (OpenAI / local / others)
- Model selection + fallbacks
- Token accounting + cost tracking
- Caching (optional)

**Interface**
- Input: ModelCall (model, prompt, tools schema)
- Output: ModelResult (text/structured/tool calls)

---

### 7.9 Observability & Evaluation
**Responsibilities**
- OpenTelemetry traces
- Metrics: latency, cost, token usage, tool failures
- Evaluation hooks: regression tests, harness benchmarks
- Audit logs for safety events

---

## 8) Pipeline Templates (Initial Set)

### 8.1 Chat Pipeline (Reactive)
Best for: simple Q&A, general conversation  
Strategy: `reactive`  
Tools: usually none  
Memory: optional user memory

### 8.2 Coding Agent Pipeline (Planner/Executor)
Best for: multi‑step coding tasks  
Strategy: `planner_executor`  
Tools: filesystem, cli, tests  
Verification: unit tests, build checks

### 8.3 RAG / Retrieval Pipeline
Best for: document‑grounded responses  
Strategy: `rag`  
Tools: retriever, document chunker  
Verification: citation coverage + answer grounding

### 8.4 Tool Agent Pipeline
Best for: actions requiring APIs / systems  
Strategy: `planner_executor`  
Tools: http_api, cli, web_search  
Verification: tool result sanity + policy checks

### 8.5 Multimodal Reasoning Pipeline
Best for: image/pdf + text reasoning  
Strategy: `multimodal_reasoner`  
Tools: pdf chunker, vision embeddings  
Verification: cross‑modal consistency checks

---

## 9) Budgeting & Safety (Concrete Rules)

### 9.1 Budgets
- Token budget per request (max_tokens)
- Cost budget per request (max_cost_usd)
- Tool call budget (max_calls)
- Wall‑clock execution budget (max_seconds)

### 9.2 Safety Gates
- Disallow tools by default unless policy enables
- Restrict memory scope by caller scope
- Redact secrets/PII in traces and tool logs
- Require verification for “high impact” intents

---

## 10) Suggested Repo Layout (Cursor‑Friendly)

```
ai-server/
  docs/
    Architecture document.md
    api_contracts.md
    pipeline_templates.md
  src/
    ingress/
      middleware_auth.py
      middleware_rate_limit.py
      request_ids.py
    brainstem/
      canonicalizer.py
      intent_extractor.py
      memory_scoper.py
      schemas.py
    policy/
      policy_engine.py
      budgets.py
      safety_profiles.py
    router/
      pipeline_router.py
      plans.py
    pipelines/
      base_harness.py
      chat/
        pipeline.py
      coding_agent/
        pipeline.py
      rag/
        pipeline.py
      tool_agent/
        pipeline.py
      multimodal/
        pipeline.py
    gateways/
      model_gateway.py
      tool_gateway.py
      memory_gateway.py
    observability/
      tracing.py
      metrics.py
      eval_hooks.py
    server/
      http_api.py
      streaming.py
  tests/
    unit/
    integration/
    harness_regression/
  deploy/
    docker/
    k8s/
    helm/
```

---

## 11) Implementation Plan (Milestones)

### Milestone 1 — MVP “Single Endpoint + Chat”
- Build Ingress middleware (auth + rate limit + request ids)
- Implement Brain Stem canonicalizer (text‑only first)
- Implement minimal intent extraction (chat vs not chat)
- Implement Chat pipeline with Model Gateway
- Implement OTEL traces + basic metrics

**Acceptance**
- `/v1/query` returns correct responses
- Traces show pipeline selection + tokens

---

### Milestone 2 — Routing + Policy Gate
- Add PolicyDecision object and enforcement
- Add Pipeline Router logic
- Add budgets: tokens/cost/tool calls
- Add memory scoping decisions (no write‑back yet)

**Acceptance**
- Requests from different callers get different allowed tools/models
- Budget exceeded returns structured errors

---

### Milestone 3 — Coding Agent Harness
- Add Tool Gateway (filesystem + cli sandbox)
- Add coding pipeline planner/executor loop
- Add verification: run tests / build
- Add artifact outputs (logs, patches)

**Acceptance**
- Coding tasks produce correct diffs and pass tests when possible
- Tool logs recorded with redaction

---

### Milestone 4 — RAG + Multimodal
- Add PDF chunking + embeddings
- Add vector retrieval via Chroma
- Add multimodal canonicalization for images/PDFs
- Add citation grounding checks

**Acceptance**
- Document questions produce cited answers
- Multimodal tasks route correctly

---

## 12) Cursor Execution Notes (How to Work From This Doc)

When implementing, keep these “contract boundaries” stable:
- `RequestEnvelope` (external API)
- `CanonicalRequest` + `IntentBundle` (Brain Stem output)
- `PolicyDecision` (policy gate output)
- `PipelinePlan` (router output)

Everything else can evolve behind the interfaces.

---

## 13) Open Questions (Decide Early)

1. **Transport**
   - HTTP only initially vs add gRPC for internal pipelines?
2. **State**
   - Stateless server + external stores (recommended) vs in‑process state?
3. **Queues**
   - Do long‑horizon tasks require a job queue + worker pool?
4. **Memory writes**
   - Always explicit vs allow automatic write‑back with policy gating?

---

## 14) Next Task List (Cursor TODOs)

- [ ] Implement `/v1/query` with RequestEnvelope validation
- [ ] Add Ingress middleware (auth/rate/payload caps)
- [ ] Implement Brain Stem canonicalizer (text → CanonicalRequest)
- [ ] Implement IntentBundle extraction (heuristics → model later)
- [ ] Implement PolicyDecision + budgets
- [ ] Implement Pipeline Router with 2 pipelines: chat + coding_agent stubs
- [ ] Implement OTEL tracing + metrics
- [ ] Add golden‑path integration test: chat request routes + responds

---

**End of document**
