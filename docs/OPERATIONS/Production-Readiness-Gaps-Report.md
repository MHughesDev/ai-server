# Production Readiness – Gaps and Undefined Areas

**Purpose:** Consolidated report of areas still undefined or needing work for this AI server to be production-grade.  
**Source:** Deep codebase search (src/, docs/, specs, plans).  
**Date:** 2026-02-28.
**Status:** Canonical current-state implementation and remaining-gap tracker.

> **Documentation authority:** For target-state requirements, use `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Section 18). This file is the single source of truth for implementation status and remaining production work.
>
> **Consolidation note:** Findings from `docs/CODEBASE-DOCS-VERIFICATION-REPORT.md` are incorporated here. That verification report is now treated as historical evidence to reduce duplicate status documents.

---

## 1. Critical production blockers

### 1.1 Model gateway implementation status (PARTIALLY COMPLETE)

- **Location:** `src/gateways/model-gateway.ts`, `src/server/query-handler.ts`
- **Status:** ✅ **OpenAI-compatible provider IS implemented** with circuit breakers, health checks, capability taxonomy, and scope/tenancy routing. Stub is used as fallback when no provider is configured.
- **What's Implemented:**
  - `OpenAiCompatibleModelGateway` (lines 284-357): Full HTTP provider with API key resolution, request/response mapping, token counting
  - Circuit breaker (lines 124-202): CLOSED/OPEN/HALF_OPEN states with failure tracking
  - Health checks (lines 394-412, 499-520): Provider health monitoring with fallback
  - Capability taxonomy (lines 81-90): 8 capability types (text/chat, classification, vision, multimodal, etc.)
  - Scope/tenancy routing (lines 369-388): user->app->org->default precedence
  - Provider factory (lines 359-367): Creates providers by route type
- **Remaining Gap:** Production deployments need to configure real API keys and endpoints in environment variables or config. The default stub behavior is intentional for development/testing.
- **Config:** Model gateway settings are in `src/config/schema.ts` (lines 195-210) and read from env vars like `MODEL_PROVIDER_*`.

### 1.2 Tool execution status (IMPLEMENTED - defaults to deny-only)

- **Location:** `src/gateways/tool-gateway.ts`
- **Status:** ✅ **Executable tools ARE implemented** but production defaults to deny-only for security.
- **What's Implemented:**
  - `ExecutableToolGateway` class (lines 279-305): Real tool execution with sandbox controls
  - `web_search` tool (lines 190-251): Real DuckDuckGo API calls with result formatting
  - `file_write_preview` tool (lines 252-277): Real filesystem writes with path sandboxing
  - Path sandboxing via `TOOL_FILESYSTEM_ROOT` (lines 154-170)
  - Sandbox controls: `timeout_ms`, `network_access`, `filesystem_access` (types.ts)
  - Deny-only mode for security (lines 40-50): Returns `{ denied: true, reason }` for unapproved tools
- **Default Behavior:** Production uses `DenyOnlyToolGateway` by default. Enable executable tools by configuring `toolDelegate` in pipeline plan with appropriate allowlists.
- **Action:** Security review required before enabling executable tools in production. Current implementation supports allowlist + sandbox controls.

### 1.3 Caller identity and auth (IMPLEMENTED)

- **Location:** `src/server/auth.ts`, `src/server/routes.ts`, `src/ingress/validate.ts`
- **Status:** ✅ **Multi-IdP auth with token exchange IS implemented**
- **What's Implemented:**
  - `/token/exchange` endpoint (routes.ts:157-216): Full token exchange implementation
  - HS256 JWT validation (auth.ts:97-200): External JWT validation with shared secrets
  - RS256 JWT validation (auth.ts:201-280): JWKS-based validation with key rotation
  - IdP registry (schema.ts:109-131): Configured issuers, JWKS URLs, audiences
  - App registry (schema.ts:133-139): App credentials and allowed scopes
  - AI JWT issuance (auth.ts:385-480): Server-signed tokens with claims
  - Caller strict-match validation (validate.ts): Enforces token claims match request body
- **Security Features:**
  - Short-lived AI JWTs (configurable TTL)
  - JWKS key rotation support
  - Auth failure audit logging
  - Deny-by-default when verification fails
- **Action:** Production deployments should configure IdP registry and app credentials in config. Current implementation supports Keycloak and custom IdPs.

---

## 2. Stubs and placeholders in code

| File | Line(s) | Description |
|------|--------|--------------|
| `src/ingress/types.ts` | 22 | IIngress described as "Stub: validate and normalize HTTP to RequestEnvelope" |
| `src/ingress/validate.ts` | 56+ | Historical note: `requireAuthHeader` option; **caller strict-match** when `verifiedCallerContext` is supplied (see `assertCallerStrictMatch`) |
| `src/brainstem/types.ts` | 14 | "Stub: RequestEnvelope → (CanonicalRequest, IntentBundle)" |
| `src/gateways/model-gateway.ts` | 19, 35–38 | `defaultModel: "stub"` for dev; `OpenAiCompatibleModelGateway` IS implemented for production |
| `src/gateways/types.ts` | 28, 53, 58 | Tool "L2-05+ deny/stub only"; **`IMemoryAbstraction`** is a type alias of **`IMemoryStore`** (no TBD stub) |
| `src/gateways/tool-gateway.ts` | 2, 8–9, 85–87 | Deny/stub-only mode; `StubAllowedToolGateway` for tests/stub runs |
| `src/security/secret-scope.ts` | 45 | "Stub implementation: returns redacted placeholder when allowed; throws on violation" |
| `src/pipelines/types.ts` | 22 | "Stub: execute pipeline and return ResponseEnvelope" |
| `src/controlplane/stub-policy.ts` | 2 | "Stub policy – default allow chat for MVP" |
| `src/controlplane/policy-evaluator.ts` | 61 | `allowTools` includes `["stub_tool"]` when coding_agent allowed |
| `src/engines/execution_engine.ts` | 2–3, 66–67 | Execution engine stub; `createStubExecutionEngine()` for tests |
| `src/engines/synthesis_engine.ts` | 2–3, 55–56 | Synthesis engine stub; `createStubSynthesisEngine()` for tests |
| `src/engines/planning_engine.ts` | 43, 71–72 | "Parse or stub" for plan; `createStubPlanningEngine()` for tests |
| `src/engines/evaluation_engine.ts` | 2–3 | Evaluation engine – **model-based evaluation IS implemented** (lines 54-108); heuristic fallback available |
| `src/engines/condensing_engine.ts` | 56–57 | `createStubCondensingEngine()` for tests |
| `src/engines/classification_engine.ts` | 2–3 | Classification engine – model-based classification IS implemented (lines 70-124) |
| `src/memory/in-memory-store.ts` | 23 | "Simple text match score placeholder (no real embedding)" |
| `src/workflows/runner.ts` | 500-533 | Decision step IS implemented with branch condition evaluation |

---

## 3. Workflow and engine gaps

### 3.1 Decision step (IMPLEMENTED)

- **Location:** `src/workflows/runner.ts` lines 500-533
- **Status:** ✅ **Decision steps ARE fully implemented**
- **Features:**
  - Branch condition evaluation (lines 42-100): Expression parser with comparison operators (>, >=, <, <=, ==, !=)
  - Target resolution (lines 105-124): Resolves branch targets from decision outcomes
  - Default target support: Falls back to default_target when no conditions match
  - Integration: Runner evaluates decision steps during workflow execution
- **Impact:** Workflows with `decision` steps function correctly with branching logic.

### 3.2 Evaluation and classification engines (IMPLEMENTED)

- **Evaluation engine:** ✅ **Model-based evaluation IS implemented** (src/engines/evaluation_engine.ts lines 54-108)
  - Uses modelGateway.complete() for real evaluation
  - Supports configurable evaluationModel
  - Heuristic fallback when model evaluation fails
  - Quality scoring (0-1), pass/fail verdict, multi-criteria assessment
- **Classification engine:** ✅ **Model-based classification IS implemented** (src/engines/classification_engine.ts lines 70-124)
  - Standard label taxonomy: intent, complexity, urgency, domain, risk
  - Model-based primary path with heuristic fallback
  - Returns structured classification labels for routing decisions

---

## 4. Memory and retrieval

### 4.1 In-memory store and ranking

- **Location:** `src/memory/in-memory-store.ts`
- **Issue:** Default store is in-memory; ranking uses "simple text match" (no embeddings). Docs (L2-06 Handoff) state: "Production should use vector similarity."
- **Action:** For production retrieval quality: integrate a vector store and real embeddings; keep in-memory as dev/test option.

### 4.2 Memory gateway and vector store

- **Location:** `src/memory/memory-gateway.ts` line 41
- **Issue:** `createMemoryGateway()` throws if neither `vectorStore` nor `vectorStoreGetter` is provided. Default-store wiring must supply one.
- **Docs (L2-06):** Structured and object stores are in-memory; production may swap for persistent backends. No PDF parsing or real embeddings in MVP.

### 4.3 IMemoryAbstraction (gateways/types.ts)

- **Status:** ✅ **`IMemoryAbstraction`** is documented as a **type alias** of **`IMemoryStore`** (`memory-abstraction.ts`) — same retrieval/ingest contract as SPEC 17.

### 4.4 Retrieval timeout/fallback behavior not production-hardened

- **Location:** `src/memory/retrieval-service.ts`
- **Issue:** `runRetrieval()` awaits `store.retrieve()` without a timeout/deadline wrapper. The file includes a production TODO for timeout + context cap, so slow/unavailable stores can still block request time.
- **Action:** Enforce bounded retrieval latency (timeout + deterministic fallback/degraded behavior) and wire it to request/workflow deadline controls.

---

## 5. Security and audit

### 5.1 Audit persistence (IMPLEMENTED with rotation)

- **Location:** `src/security/audit-logger.ts`
- **Status:** ✅ **File sink with rotation IS implemented** - more complete than previously documented
- **What's Implemented:**
  - `AUDIT_LOG_PATH` config validation (schema.ts:259)
  - File sink with rotation (lines 56-180)
  - Bounded queue (maxQueueSize) with backpressure handling (lines 35-36, 60-64, 127)
  - Hash-chain integrity (lines 230-270): previous_event_hash linking for tamper evidence
  - Status reporting for health checks (lines 182-184, 297-312)
- **Remaining Gap:** Async writer (currently sync with queue). Production note: File sink uses synchronous writes for durability; async writer with rotation could improve performance under high load.
- **Action:** For high-throughput production, consider async single-writer optimization. Current implementation is production-ready for moderate loads.

### 5.2 Secrets

- **Location:** `src/security/secret-scope.ts`
- **Issue:** Stub returns redacted placeholder when allowed; no real secrets manager integration (e.g. vault, KMS).
- **Action:** For production, integrate a real secrets backend and keep redaction policy.

### 5.3 Operational endpoints access control

- **Location:** `src/server/routes.ts`
- **Issue:** `/metrics`, `/v1/version`, `/healthz`, and `/readyz` are publicly served with no auth or network guard in app logic.
- **Action:** Protect operational endpoints via auth, mTLS, or private/admin listener boundaries (and document the required deployment controls).

---

## 6. Observability and eval (documented gaps)

From **L2-04 Gate Report and Known Gaps** and related docs:

| Gap | Impact | Target |
|-----|--------|--------|
| **Trace sampling** | Production trace sampling not implemented; full volume in dev/staging | Before L2-08 production rollout |
| **Event retention** | Events in-memory/capture only; no persistent event sink in this implementation | Per-environment (e.g. OTEL collector) |
| **Alert simulation** | P3-03: Alert simulation in staging not run (telemetry stack not yet available) | When staging telemetry stack available |
| **Eval dataset** | Baseline has 2 gold cases; expand for L2-06 retrieval, L2-07 multimodal | As features land |
| **Dashboard panels** | Out of scope (UI-less server); deferred to ops (Grafana/Prometheus, etc.) | Ops |

- **Event sink status:** `OBSERVABILITY_EVENT_SINK_PATH` is wired in `src/server/index.ts`, but it bypasses schema validation and still uses synchronous file appends without rotation/backpressure controls.

---

## 7. Configuration gaps

- **Model/provider posture:** `model_gateway` (providers, registry, timeouts) is **schema-backed** (`src/config/schema.ts`); production still requires **non-synthetic** providers when `platform_production_rollout_enabled` is used in production (`bootstrap/index.ts`).
- **Audit/event sinks:** `auditLogPath` and `observabilityEventSinkPath` are **schema-backed**; in **production**, bootstrap **`assertProductionSinkPathsWritable`** requires parent directories to exist and be writable (and existing sink files writable). Optional **`AUDIT_LOG_FSYNC`** / **`OBSERVABILITY_EVENT_SINK_FSYNC`** force `fsync` after each append (`server/index.ts`).
- **Feature flags:** Canonical list and **per-flag enforcement** are documented in **`docs/SPEC/20_Config_and_FeatureFlags.md`** (matrix, 2026-03-24). Legacy prose naming flags **not** present in `FeatureFlagsSchema` (e.g. `enable_async_jobs`, `governance_harness_readiness_gate_active`) should be treated as **historical** unless reintroduced in schema.
- **Memory retention:** `memoryRetention` is applied on the **in-memory** store path in `default-store.ts`; confirm **vector** path parity when using `MEMORY_BACKEND=vector`.

---

## 8. Tests and quality (Cleanup checklist)

From **`to-do.md`** §6 (testing) and former cleanup checklist:

- **Missing unit tests (high value):**  
  `default-store`, `memory-gateway`, `evaluation_engine`, `engines/registry`, `workflows/registry`.
- **Optional:** stub-policy, policy-input, model-gateway with mocked provider, server middleware, rollout.
- **Test strategy:** Document that pipelines/routes are covered by integration tests and whether more unit tests are required.
- **dist/ in git:** Decide whether to track `dist/` or build in CI only; document in README/CONTRIBUTING.

---

## 9. Additional codebase production gaps

### 9.1 Server lifecycle and timeouts

- **Graceful shutdown + PORT validation (IMPLEMENTED)**  
  **Location:** `src/server/index.ts`  
  **Status:** `PORT` is validated as an integer in range 1–65535 at startup. SIGTERM/SIGINT triggers draining (`connectionState.draining`), closes listeners, and closes connections with a configurable drain timeout (`SHUTDOWN_DRAIN_TIMEOUT_MS`).  
  **Remaining:** ~~Sink flush on shutdown~~ **Implemented (2026-03-24):** after connection drain, **`shutdownPersistentAuditFileSink`** drains the audit file queue (30s cap) then stops accepts; **`getEventSink()?.close()`** flushes the observability NDJSON queue; then HTTP/HTTPS listeners finish closing (`src/server/index.ts`).

- **HTTPS startup when TLS material is bad (FAIL-CLOSED when TLS configured)**  
  **Location:** `src/server/index.ts`  
  **Status:** If `tlsKeyPath` / `tlsCertPath` are set and `readFileSync` fails, startup **throws** and does not silently fall back to HTTP-only.  
  **Remaining:** Optional hardening (async load, preflight file existence).

- **Read timeout for slow clients (IMPLEMENTED)**  
  **Location:** `src/server/middleware.ts` (`readJsonBody`)  
  **Status:** Default read timeout (e.g. 30s via `timeoutMs`), `req.aborted` handling, and destroy-on-timeout.  
  **Action:** Document `requestReadTimeoutMs` / env if exposed for operators.

- **Per-request processing timeout vs pipeline budget (PARTIAL)**  
  **Locations:** `src/server/routes.ts` (`withRequestTimeout` around `/v1/query`), `src/server/query-handler.ts`, `src/pipelines/chat-pipeline.ts`  
  **Issue:** HTTP-level processing timeout exists for the query route; deep pipeline hangs may still need stronger alignment with `plan.budgets.deadline_ms` and cost budget enforcement (see resource manager).  
  **Action:** Continue tightening deadline propagation from plan into execution paths where not already wired.

- **Budget fields (where enforced)**  
  **Locations:** `src/controlplane/resource-manager.ts`, `src/server/query-handler.ts`, `src/workflows/runner.ts`, pipelines  
  **Status:** **`assignBudgets` / `checkBudget`** distribute caps from policy; **ingress token** pre-check uses **`token_budget`** vs **`token_estimate`**. **`query-handler`** wraps the query pipeline with **`withDeadline`**, post-run **token** / **cost** checks (when cost caps enabled), and **`runner`** enforces **deadline**, **cost_budget_usd**, and **`tool_budget`** on workflow steps (including aggregated child **`telemetry.tool_calls`**).  
  **Remaining:** Audit any non-query entrypoints and long-lived subprocess paths for the same caps.

### 9.2 Health/readiness probes (IMPLEMENTED with dependency checks)

- **/healthz and /readyz ARE dependency-aware**
  **Location:** `src/server/dependencies.ts`, `src/server/routes.ts` (lines 79-111)
  **Status:** ✅ **Dependency-aware health checks ARE implemented**
  **What's Implemented:**
  - IdP health checks (lines 49-85): JWKS endpoint probing
  - Redis health checks (lines 87-115): Connection ping verification
  - Audit sink status checks (lines 297-312)
  - Event sink status checks (lines 274-296)
  - Model provider health checks (lines 117-145)
  - 503 response when unhealthy (routes.ts:79-94, 96-111)
  **Action:** Configure `DependenciesConfig` in schema for health check endpoints.

### 9.3 Rate limiting and tenant budgets (IMPLEMENTED)

- **Rate limiting IS implemented**  
  **Location:** `src/server/rate-limit.ts`  
  **Status:** ✅ **Full rate limiting with abuse detection IS implemented**  
  **What's Implemented:**
  - Fixed-window algorithm (lines 30-80)
  - In-memory backend (lines 30-80)
  - Redis backend (lines 82-180)
  - Abuse detection with error rate patterns (lines 360-420)
  - Standard rate limit headers X-RateLimit-* (lines 320-358)
  - Async rate limit check integration (lines 250-310)
  **Action:** Configure `RateLimitConfig` in schema. Rate limiting is enforced in query handler.

- **Tenant budget tracking (IMPLEMENTED with multi-backend)**  
  **Location:** `src/controlplane/tenant-budget.ts`  
  **Status:** ✅ **Multi-backend support IS implemented**  
  **What's Implemented:**
  - In-memory backend (lines 23-38)
  - File backend (lines 40-70)
  - Redis/Upstash backend (lines 72-108)
  - Hourly cost cap enforcement (lines 170-180)
  - Usage recording with cost tracking (lines 145-165)
  **Action:** Configure tenant budget backend in production for shared state across instances.

- **Tenant usage recording (FAIL-SOFT)**  
  **Location:** `src/server/query-handler.ts`  
  **Status:** `recordTenantUsage` is wrapped in try/catch; failures emit observability events and do **not** fail the successful query response.  
  **Remaining:** Monitor `TENANT_USAGE_RECORD_FAILED` and backend availability.

### 9.4 Memory and prompt size limits

- **Ingestion chunk count unbounded**  
  **Location:** `src/memory/in-memory-store.ts`  
  **Issue:** Large documents can create many chunks and cause memory pressure.  
  **Action:** Cap chunks per ingest or enforce max input size.

- **Retrieval context sizing**  
  **Locations:** `src/memory/retrieval-service.ts` (**`runRetrieval`**), `src/engines/memory_engine.ts` (passes optional **`max_context_tokens`** / **`retrieval_timeout_ms`** from formal_spec), `src/pipelines/chat-pipeline.ts` + `src/server/query-handler.ts` (reactive_chat: same config + **`token_budget`** clamp as pre-pipeline retrieval).  
  **Remaining:** Audit any **`store.retrieve`** call sites that bypass **`runRetrieval`**.

### 9.5 Observability and audit robustness

- **Metrics and capture buffers (BOUNDED + visibility)**  
  **Locations:** `src/observability/metrics.ts`, `src/observability/emitter.ts`  
  **Status:** ✅ Counters/histograms use **series and sample caps** (`MAX_COUNTER_SERIES`, `MAX_HISTOGRAM_SERIES`, reservoir per series); dropped increments are exposed as **`ai_server_metrics_dropped_total`** in Prometheus text. `createEmitter` uses **`maxCaptureSize`** (default 1000) with FIFO eviction.  
  **Remaining:** Operational runbooks should document scrape intervals and optional `exportAndResetCounters()` for counter reset strategy.

- **Event/audit sinks (async queued + rotation; hash chain guarded)**  
  **Locations:** `src/observability/event-sink.ts`, `src/security/audit-logger.ts`  
  **Status:** ✅ File sinks use **`appendFile`** (async) with **bounded queues**, rotation, and backpressure signals—not `appendFileSync`. Audit **async lock** serializes hash-chain updates; **in-memory audit ring** capped (default 10k entries) with **suffix** `verifyAuditIntegrity()` semantics after trim.  
  **Remaining:** Optional hardening: stronger **single-byte-range** atomic append / `fsync` policy for crash durability on specific filesystems; **multi-replica** sinks if audit must survive process loss without replay. **On-disk chain verify:** `verifyAuditLogFileIntegrity(path)` (`audit-logger.ts`) validates a **single** JSONL file (per rotated segment); merge segments for a full historical audit if rotation is used.

### 9.6 Workflow validation (IMPLEMENTED)

- **Workflow cycle detection IS implemented**  
  **Location:** `src/contracts/workflow-definition.ts` (lines 105-142)  
  **Status:** ✅ **DFS-based cycle detection IS implemented at definition validation time**  
  **What's Implemented:**
  - DFS-based cycle detection in superRefine (lines 105-142)
  - hasCycleFrom() recursive check (lines 122-132)
  - Validation errors at workflow registration time

- **Dependency validation IS implemented**  
  **Location:** `src/contracts/workflow-definition.ts` (lines 72-83, 84-102)  
  **Status:** ✅ **Dependency and branch target validation IS implemented**  
  **What's Implemented:**
  - Unknown `depends_on` references are rejected (lines 72-83)
  - Decision branch targets are validated (lines 84-94)
  - Default targets are validated (lines 95-102)
  - Duplicate step ID detection (lines 57-70)
  **Action:** All workflow definitions are validated at registration time. Invalid workflows fail fast.

### 9.7 Configuration fail-fast

- **`CONFIG_FILE` invalid or missing when set (FAIL-FAST)**  
  **Location:** `src/config/schema.ts` (`loadConfigWithOptionalFile`)  
  **Status:** ✅ **Throws** if `CONFIG_FILE` points to a missing file or invalid JSON — server does not start with a silent ignore.  
  **Remaining:** Broader “required config in production” matrix (beyond `CONFIG_FILE`) may still need explicit bootstrap guards.

### 9.8 Async/stream/idempotency contract drift

- **HTTP async jobs vs synchronous `/v1/query` response shape**  
  **Locations:** `src/contracts/request-envelope.ts`, `src/contracts/response-envelope.ts`, `src/server/routes.ts`, `src/server/query-handler.ts`, `src/queue/*`  
  **What is implemented:** When a job queue is configured (`JobQueueService`), the server exposes `POST /v1/query/async`, `GET /v1/jobs`, `GET /v1/jobs/{id}`, and `POST /v1/jobs/{id}/cancel`. If the queue is not configured, these paths return **503** with `ASYNC_NOT_AVAILABLE`.  
  **What remains:** The **`POST /v1/query`** success path still returns **`mode: "sync"`** in the `ResponseEnvelope` (synchronous HTTP completion). JSON body **`idempotency_key`** remains rejected (strict ingress). Optional HTTP **`Idempotency-Key`** on **`POST /v1/query/async`** implements **in-process** deduplication per tenant + body fingerprint (`src/queue/job-queue.ts`, `src/queue/async-idempotency.ts`); **multi-instance** deployments need a shared store if strict cross-replica idempotency is required. Full alignment of `mode` (`auto`/`async`) with router behavior and any future **`ResponseEnvelope.mode`** expansion are still optional product work.  
  **Action:** **SPEC 02** § *Execution model* and **`openapi.yaml`** document as-built behavior including async idempotency header semantics.

### 9.9 Workflow and policy alignment

- **Policy `allowed_pipelines` tracks the workflow registry (IMPLEMENTED)**  
  **Locations:** `src/workflows/registry.ts` (`listRegisteredWorkflowIds`), `src/controlplane/policy-evaluator.ts`  
  **Status:** ✅ **`evaluatePolicy`** sets `allowed_pipelines` to **`listRegisteredWorkflowIds()`**, so registered workflows (including `tool_automation`, `extraction`, `verification`, `planning_only`, `batch_analysis`) are not omitted by a static shortlist.  
  **Remaining:** Router/intent routing must still **select** a workflow id that matches caller intent and capability; verify integration tests cover non-default workflow selection paths.

- **`stop_conditions.max_iterations` and `stop_conditions.deadline_ms` ARE enforced**  
  **Location:** `src/workflows/runner.ts` (lines 328-374)  
  **Status:** ✅ **Stop conditions ARE centrally enforced in runner**  
  **What's Enforced:**
  - `max_iterations` at workflow start (lines 328-350, 364-374)
  - `deadline_ms` during step execution (lines 352-363)
  - Combined limits via maxStepExecutions guard
  - Budget exceeded responses (lines 347-373)
  **Action:** Stop conditions are enforced. No additional work needed.

### 9.10 Rollout governance enforcement gaps

- **Production rollout flag (PARTIALLY enforced)**  
  **Locations:** `src/config/schema.ts`, `src/bootstrap/index.ts`, `src/server/routes.ts`, `src/server/preflight.ts`  
  **What is enforced:** In **production**, when `platform_production_rollout_enabled` is **false**, `POST /token/exchange`, `POST /v1/query`, and `POST /v1/query/async` return **503** with a rollout-disabled error; preflight reports this as fail when the flag is off.  
  **Remaining:** Policy/coding-agent/query/routes use **`resolveFeatureFlagEnabled`** where documented in **`docs/SPEC/20_Config_and_FeatureFlags.md`**; bootstrap/preflight and `server/index.ts` emitter paths may still read flags statically as noted in the matrix. Legacy `governance_harness_*` is **not** a schema flag today. **Release/build ids:** fail-fast when **production + `platform_production_rollout_enabled`** and both `RELEASE_ID`/`BUILD_ID` unset; otherwise production still **warns** only (`validateReleaseConfig`).  
  **Action:** Complete a per-flag enforcement matrix; tighten release metadata checks where policy requires hard failure.

### 9.11 Model/tool/async timeout wrapper robustness

- **Cancelable timeouts (current)**  
  **Locations:** `src/gateways/model-gateway.ts` (`withTimeoutAndRetry` — `try`/`finally` + **`clearTimeout`**), `src/gateways/tool-gateway.ts` (`AllowlistToolGateway` — same), `src/queue/job-queue.ts` (**2026-03-25:** `raceWithTimeout` for job processing; webhook **`fetch`** abort timer cleared in **`finally`** on all paths).  
  **Remaining:** Optional: map provider **JSON** error bodies (e.g. OpenAI `type`/`code`) to non-retryable invalid-key vs retryable overload; tool gateway errors are separate.

### 9.12 Tool sandbox controls are only partially enforced

- **Sandbox dimensions (network / filesystem / timeout)**  
  **Locations:** `src/gateways/tool-gateway.ts` (`AllowlistToolGateway` + builtin **`requires_network` / `requires_filesystem`** metadata), `src/router/default-router.ts` (**2026-03-25:** sets **`sandbox.network_access` / `sandbox.filesystem_access`** from enabled tool ids via **`toolIdRequiresNetworkAccess`** / **`toolIdRequiresFilesystemAccess`** so HTTP/fs tools are not denied when policy allows them).  
  **Remaining:** Custom executable registries beyond builtins need matching policy→sandbox wiring if introduced. **`TOOL_ACCESS`** + **`TOOL_START`/`TOOL_END`** with caller hints are centralized in **`tool_engine`** (2026-03-25); identity still flows via **`ToolInvokeRequest.caller_identity`**.

---

## 10. Summary – Production Readiness Status

### ✅ Production-Ready (Implemented)

1. **Model Gateway** - OpenAI-compatible provider with circuit breakers, health checks, capability taxonomy, scope/tenancy routing
2. **All 8 Engines** - Registered and functional (Execution, Synthesis, Classification, Evaluation, Tool, Memory, Planning, Condensing)
3. **All 9+ Workflows** - Registered with validation
4. **Decision Steps** - Branching logic fully implemented
5. **Cycle Detection** - DFS validation at definition time
6. **Tool Gateway** - Executable tools with sandbox controls (deny-by-default)
7. **Auth System** - Multi-IdP with token exchange, HS256/RS256, caller strict-match
8. **Rate Limiting** - Fixed-window with Redis/in-memory backends, abuse detection
9. **Observability** - Full event taxonomy with redaction, metrics, audit logging
10. **Config Schema** - Comprehensive validation
11. **Health/Readiness** - Dependency-aware checks (IdP, Redis, sinks, providers)
12. **Stop Conditions** - max_iterations and deadline_ms enforced in runner
13. **Dependency Validation** - Unknown dependencies and branch targets rejected
14. **Tenant Budget** - Multi-backend support (in-memory, file, Redis)
15. **Audit Logging** - File sink with rotation, bounded queue, backpressure, hash-chain

### ⚠️ Remaining Real Gaps (Require Work)

1. **Async contract alignment** - HTTP async job endpoints exist when the queue is configured; **`POST /v1/query`** still completes synchronously with **`mode: "sync"`**. **`POST /v1/query/async`** supports header **`Idempotency-Key`** (in-process; see §9.8). Optional future **`ResponseEnvelope.mode`** expansion remains separate (see §9.8).
2. **Vector Embeddings** - In-memory text matching only (integrate vector DB for production retrieval)
3. **Feature flag resolution consistency** - All schema flags are mapped to behavior (**`docs/SPEC/20_Config_and_FeatureFlags.md`**); remaining work is **unifying** static `config.flags` reads vs `FeatureFlagService` (admin overrides) where product requires it
4. **Persistent Memory** - Default is in-memory (configure Redis/vector backend for production)

### 📋 Production Deployment Checklist

1. **Must-configure for production:**
   - Model provider API keys/endpoints (env vars or config)
   - IdP registry with JWKS URLs
   - App registry with credentials
   - Redis or persistent backend for tenant budgets and rate limiting
   - Audit log and event sink paths with proper permissions
   - When **`PLATFORM_PRODUCTION_ROLLOUT_ENABLED=true`**, set **`RELEASE_ID` and/or `BUILD_ID`** (bootstrap fail-fast if both missing)

2. **Should-have for hardening:**
   - Confirm shutdown/sink flush and connection limits meet SLOs (graceful shutdown and PORT validation exist in code)
   - Tighten pipeline/plan deadline propagation beyond HTTP-level query timeout
   - Tool sandbox security review before enabling executable tools
   - Persistent memory backend (vector DB)
   - Production trace sampling strategy

3. **Nice-to-have:**
   - Real secrets manager integration (vault, KMS)
   - Additional unit tests for coverage
   - Async job implementation (if async mode needed)

---

## 11. Cross-cutting implementation notes (Agent 3, 2026-03-06)

*Consolidated from removed duplicate `docs/PLANS/implementation/Agent-3-Changes-Summary.md` and `Agent-3-Handoff.md`; normative behavior remains in code and SPECs.*

- **Model gateway:** Circuit breaker, provider health checks, fallback routing, `CAPABILITY_TAXONOMY` — see `docs/SPEC/15_ModelGateway_Spec.md` and `src/gateways/model-gateway.ts`.
- **Tool gateway:** Caller identity on `ToolInvokeRequest`, deny-by-default allowlist, sandbox metadata from policy/plan — `src/gateways/tool-gateway.ts`, `docs/SPEC/16_ToolGateway_Spec.md`.
- **Workflow runner:** Decision steps, cycle detection (definition-time), dependency validation, stop conditions (`max_iterations`, `deadline_ms`) — `src/workflows/runner.ts`, `docs/SPEC/10_ExecutionSupervisor_Spec.md`.
- **Budget enforcement:** Tenant usage recording guard — `src/controlplane/tenant-budget.ts` and related call sites.
- **Engines:** Evaluation engine and classification engine production paths via Model Gateway — `src/engines/evaluation_engine.ts`, `src/engines/classification_engine.ts`.

---

## 12. References

- **Unified task backlog:** [`to-do.md`](../../to-do.md)
- **L2-05 / L2-06 sprint handoffs:** Audit/secrets and memory limits are archived in **`docs/PLANS/implementation/L2-05_Security-Isolation-and-Compliance-Implementation.md` §14** and **`L2-06_Memory-and-Retrieval-Implementation.md` §14**.
- **Scope of Work:** `docs/PLANS/Scope-of-Work.md`
- **SPEC 20 (config):** `docs/SPEC/20_Config_and_FeatureFlags.md`
- **Architecture target state:** `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Section 18)
