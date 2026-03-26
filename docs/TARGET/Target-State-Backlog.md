# Target-State Backlog — “What we eventually want”

**Purpose:** Hold **normative target requirements** extracted from Architecture and SPECs **before** reconciling other docs to **current code**. This file is the stable “north star” list; implementation status belongs in gap reports or a separate column after verification.

**Path note:** Canonical documentation root is **`docs/`** (lowercase). After 2026-03-24, architecture, operations, reference, and `PLANS/implementation/` live under subfolders; see [`docs-move-map.md`](./docs-move-map.md).

**Primary sources (normative):**

| Source | Role |
|--------|------|
| `docs/ARCHITECTURE/Architecture_document_Finalized.md` §2–5, §16, **§18** | Layer model, API surface, **production target state (SHALL)** |
| `docs/SPEC/00_System_Overview.md` | System purpose, external surface, invariants |
| `docs/SPEC/01_Principles_and_Invariants.md` | Non-negotiable invariants, production target clarification |
| `docs/SPEC/02_API_Contracts.md` … `docs/SPEC/22_*` | Detailed contracts (mine each for requirements when expanding this backlog) |

**Not in scope for this file:** Step-by-step implementation plans, release checklists, or “current state” narratives — those stay in PLANS / readiness docs and should **reference** `WANT-xxx` IDs after reconciliation.

**Execution plan:** See [`Documentation-Finalization-Plan.md`](./Documentation-Finalization-Plan.md) — phased steps to align docs with code, deduplicate plans, and then fill the **Implementation status** column below using `WANT-xxx` traceability.

---

## How to use the table

| Column | Meaning |
|--------|---------|
| **ID** | Stable handle; cite in PRs and gap docs. |
| **Capability** | Thematic bucket (Identity, Governance, Memory, …). |
| **Want** | One-sentence outcome (not a specific library name unless fixed in Architecture). |
| **Source** | Doc + section; add line anchors when helpful. |
| **Type** | Contract · Security · Governance · Ops · Performance · Product. |
| **Priority** | P0 = blocking broad production; P1 = hardening; P2 = stretch. |
| **Depends on** | Other WANT-IDs or external deps (IdP, Redis, …). |
| **Implementation status** | **Met** = behavior matches the Want in code for normal paths; **Partial** = implemented but gaps remain; **Not started** = missing or only stubbed. Cite `src/…` paths or tests. Refresh when behavior changes. |

**Evidence pass:** 2026-03-24 — statuses below were set from static review of `src/` (not a substitute for `npm run verify:sow`; run that locally after edits).

---

## Narrowed target — product & deployment decisions (owner Q&A)

**Recorded:** 2026-03-24  
**Purpose:** Constrain backlog interpretation and acceptance tests. These choices **narrow** generic Architecture/SPEC language into **this product’s** target; they do not replace normative SPECs—implement and then align SPECs/OpenAPI where they differ.

### Decisions (by question)

| # | Topic | Decision |
|---|--------|----------|
| 1 | App instances | **One** instance for now (single deployment unit). |
| 2 | Cross-instance shared state | **Not required** on day one (no mandate for Redis/global counters across replicas for v1). |
| 3 | Backing stores | **PostgreSQL** for durable **non–vector** data (non–AI-memory persistence). **Chroma** for **vector** storage, embeddings, and AI-context retrieval. |
| 4 | Authentication | **All** production requests are **authenticated** (no anonymous client surface for this target). |
| 5 | Caller identity | **Token claims only** — not body-spoofed `caller` fields as source of truth. |
| 6 | Extra secret redaction | **No** additional formal classes beyond current policy (no extra PII/prompt redaction mandate captured here). |
| 7 | Control-plane bypass | **No** routes that skip policy → budget → route → dispatch for governed execution. |
| 8 | Token / tool budgets | **Hard enforcement** (stop/limit execution per policy, not advisory). |
| 9 | Tenant cost over budget | **Blocked** (deny request / do not proceed per policy). |
| 10 | Model providers | **No stubs** in target production posture: **real** model responses via **local** inference or **API** models (e.g. GPT-class, Claude-class). |
| 11 | Tools | **HTTP-safe only** for now (no arbitrary filesystem/network tool execution in this milestone). |
| 12 | Autonomous tool use | **In scope** (coding-agent / harness autonomous path is part of the target). |
| 13 | Memory tiers | **In-memory** for **execution-scoped** state for the lifetime of a request/workflow run. **PostgreSQL** for durable **non–AI-memory** data. **Chroma** for **AI memory**: context, embeddings, retrieval. |
| 14 | Memory “on” | When memory features are **on**, **vector + embeddings** are **required** (lexical-only is not an acceptable primary path). |
| 15 | Retention | **Same guarantees** across backends where applicable (TTL / max-chunks parity intent for configured stores). |
| 16 | Async idempotency | **In-process** deduplication is **sufficient** (no cross-replica idempotency store required for this target). |
| 17 | Sync `POST /v1/query` idempotency | **None** required. |
| 18 | Contracts | **Every** error shape and code exposed to clients must appear in **`openapi.yaml`** and **`docs/SPEC/02_API_Contracts.md`** (full external parity). |
| 19 | Observability events | **Full** coverage vs **`docs/SPEC/18_Observability_Spec.md`** before calling **WANT-037** met. |
| 20 | Audit | **Single-file JSONL** + integrity verification is **enough** (no multi-segment join / fsync-by-default requirement from this Q&A). |
| 21 | Trace sampling | **Fixed rate** only for now (no adaptive/head-based requirement). |
| 22 | Test “done” | **Critical paths** called out in **`docs/OPERATIONS/Production-Readiness-Gaps-Report.md`** must be covered (not a numeric coverage %). |
| 23 | Architecture proofs (orchestration/engine invariants) | **Written design + spot checks** are acceptable (no mandatory arch linter). |
| 24 | Release style | **Big bang** (single coordinated release to this target, not phased feature flags per subsystem). |
| 25 | Explicit out-of-scope (3–6 mo) | **None** declared yet — treat full backlog + SPECs as in motion until reprioritized. |

### Traceability to `WANT-xxx`

| WANT IDs | How the decisions above apply |
|----------|-------------------------------|
| **WANT-004 – WANT-007** | Orchestration/modality claims judged against **written design + spot checks** (Q23); **big-bang** delivery (Q24). |
| **WANT-010, WANT-011** | **All-auth** (Q4), **token-only** identity (Q5). |
| **WANT-012** | No **extra** redaction policy beyond current code/docs (Q6); still must meet Architecture “no secrets in logs” baseline. |
| **WANT-013 – WANT-015** | **No bypass** (Q7); **hard** budget enforcement (Q8); deadlines must cover all governed paths as implementation catches up. Internal `handleQuery` callers: **`docs/TARGET/Internal-Query-Execution-Audit.md`**. |
| **WANT-017** | **Blocked** when over limit (Q9); **one instance** (Q1) and **no cross-replica** requirement (Q2) — **PostgreSQL** (Q3) is the intended durable store for non-vector accounting where persistence is needed. |
| **WANT-023, WANT-056** | **No production stubs** (Q10); real local or API models. |
| **WANT-026, WANT-027** | Unchanged technically; retry/timer work still P1 hardening. |
| **WANT-029, WANT-030** | **HTTP-safe tools only** (Q11); autonomous harness **in scope** (Q12). |
| **WANT-031 – WANT-036** | **Three-tier memory** (Q13); **vector+embeddings mandatory** when memory on (Q14); **retention parity** across backends (Q15); **Chroma** + **Postgres** as named targets (Q3, Q13). |
| **WANT-037, WANT-042** | **Full** observability event taxonomy per **`docs/SPEC/18_Observability_Spec.md`** (Q19); **fixed** trace sample rate (Q21). |
| **WANT-040** | **Single-file JSONL** audit scope accepted (Q20). |
| **WANT-048** | **Every** client-visible error documented (Q18). |
| **WANT-049** | **In-process** async idempotency OK (Q16); **no** sync query idempotency (Q17). |
| **WANT-053** | Autonomous execution / harness aligned with **Q12** and **SPEC 20**. |
| **WANT-055** | Tests gated on **gaps report** critical paths (Q22). |
| **WANT-059** | “Every request traceable” interpreted with **full** **`docs/SPEC/18_Observability_Spec.md`** taxonomy (Q19). |

**Implementation note:** Tenant hourly cost accounting can use **Postgres** via **`TENANT_BUDGET_POSTGRES_URL`** (`tenant-budget.ts`). Remaining **Partial** rows may still need **Chroma** (vector) and other adapters **or** updates here if technology choices change.

---

## Target-state backlog (extracted)

| ID | Capability | Want | Source | Type | Priority | Depends on | Implementation status |
|----|------------|------|--------|------|----------|------------|-------------------------|
| WANT-001 | Architecture | Single primary app entrypoint `POST /v1/query` for governed execution. | Architecture §1, §5; SPEC 00 | Product | P0 | — | **Met** — `src/server/routes.ts` `POST /v1/query`; gated by `runtime_mvp_query_chat_enabled`. |
| WANT-002 | Architecture | Ingress is deterministic (auth, rate limits, payload limits, request IDs); **no** model reasoning at ingress. | Architecture §2; SPEC 01 | Security | P0 | — | **Met** — `validateIngress` (`src/ingress/validate.ts`); body limits + `readJsonBody`; rate limit on query routes; no LLM in ingress. |
| WANT-003 | Architecture | Brain Stem is first cognitive step (canonicalize, intent, risk/complexity). | Architecture §2–4; SPEC 01 | Product | P0 | WANT-002 | **Met** — `handleQuery`: `canonicalize` → `extractIntent` → control plane (`src/server/query-handler.ts`, `src/brainstem/*`). |
| WANT-004 | Architecture | Orchestrator is sole authority for loops, nesting, retries, stop conditions, execution mode, runtime budget changes. | Architecture §3–4, §16; SPEC 01 | Governance | P0 | — | **Partial** — `src/workflows/runner.ts` centralizes workflow graph execution/stop. **Execution mode (harness):** `default-router.ts` sets `PipelinePlan.harness_autonomous_execution` from `resolveFeatureFlagEnabled` + caller; `coding-agent-pipeline.ts` consumes plan only (no independent flag decision). `RouterInput.caller` wired in `control-plane-impl.ts`. **Deadline primitive:** shared **`withDeadline`** + **`RequestDeadlineExceededError`** in **`src/utils/async-deadline.ts`** used by **`query-handler.ts`** and **`pipelines/chat-pipeline.ts`** (**2026-03-25**). Tests: `default-router.test.ts`, `async-deadline.test.ts`. **Remaining:** other pipeline-local iteration / full budget+mode centralization. |
| WANT-005 | Architecture | Engines do not orchestrate and do not call other engines; at most one gateway per engine. | Architecture §3; SPEC 01 | Governance | P0 | — | **Met** — `src/engines/*_engine.ts` / `tool_engine.ts` import only `./base.js` from `engines/` (no sibling engine imports); **`engine-architecture-invariants.test.ts`**. **`createEngineRegistry`** (`registry.ts`) injects one **`IModelGateway`** into all model engines, optional **`IToolGateway`** / **`IMemoryStore`** for tool/memory engines. Unit tests may use **`createStub*`** factories; production path uses registry from `query-handler.ts`. |
| WANT-006 | Architecture | Tools and memory only via gateways; policy-gated. | Architecture §3–4; SPEC 00–01 | Security | P0 | — | **Met** — Tools: **`AllowlistToolGateway`** + **`plan.tools_enabled`** (`query-handler.ts`); **`createToolEngine` → `IToolGateway`** only. Memory: **`getDefaultStore`** + **`runRetrieval`** / **`createMemoryEngine`(`IMemoryStore`)**; pipelines import only **`memory-abstraction`** / **`memory/types`** (see **`gateway-access-invariants.test.ts`**). Engines: **`tool_engine`** / **`memory_engine`** separation asserted in same test. |
| WANT-007 | Architecture | Workflows are modality-agnostic graphs; selection by intent/risk/complexity/capability, not input modality names. | Architecture §2–3; SPEC 01 | Product | P1 | — | **Met** — Brain stem sets `constraints_hints.needs_attachment_processing` from canonical modalities (`extractIntent`); default router gates multimodal capability on that hint only, not raw modality strings (`default-router.ts`). Tests: `intent.test.ts`, `default-router.test.ts`. |
| WANT-008 | API | Expose identity trust boundary `POST /token/exchange` for production (external IdP JWT → short-lived server AI JWT). | Architecture §5; SPEC 00 | Security | P0 | — | **Met** — `src/server/routes.ts`, `src/server/auth.ts` exchange + mint/verify. |
| WANT-009 | API | Operational surface: `GET /healthz`, `/readyz`, `/metrics`, `/v1/version` as defined in Architecture/SPEC. | Architecture §5; SPEC 00 | Ops | P0 | — | **Met** — same file; optional bearer when `OPERATIONAL_BEARER_TOKEN` set. Also `GET /v1/preflight`. |
| WANT-010 | Identity | Production identity context from **verified** token claims, not body-spoofed caller fields. | Architecture §18.1; SPEC 01 “Production Target” | Security | P0 | WANT-008 | **Met** — `verifyQueryCallerFromAuthHeader` + `queryRequiresAiJwt` on `/v1/query` and `/v1/query/async` (`routes.ts`); `assertCallerStrictMatch` + `callerContext` from claims (`validate.ts`); **`canonicalize(envelope, callerContext)`** so `CanonicalRequest` caller fields match ingress trust boundary, not raw envelope (`canonicalize.ts`, `query-handler.ts`). Tests: `validate.test.ts`, `canonicalize.test.ts`. |
| WANT-011 | Identity | AI JWTs are short-lived; validation enforces issuer, audience, scope, and claim binding to requests. | Architecture §18.1 | Security | P0 | WANT-008 | **Met** — `verifyQueryCallerFromAuthHeader`: HS256 + `assertStandardClaims` (iss/aud/exp/nbf, clock skew); `assertAiJwtQueryShape` requires integer `iat`/`exp`, `iat` not far future, `exp > iat`, **exp−iat ≤ 3600** (matches config schema max), **`sub` === `user_id`**; `query_required_scopes` enforced (`auth.ts`). Integration tests: `auth.integration.test.ts`. |
| WANT-012 | Security | Secrets never appear in logs/events/audit; redaction policy applied consistently. | Architecture §18.2 | Security | P0 | — | **Partial** — Expanded `SENSITIVE_KEYS` + normalized key checks; primitive arrays no longer wrapped as objects in `redact`; `safeLogError` for server/bootstrap/sink/audit/flags/retention/eval console paths; abuse warning uses `redact(..., "none")` without `user_id`. Emitters/audit still rely on safe payloads at source; gaps report may still note sync-sink/thoroughness. |
| WANT-013 | Governance | Policy → budget → route → dispatch gate is **non-bypassable** in production. | Architecture §18.3 | Governance | P0 | — | **Met** — Shared `runQueryGovernanceGate` + `assertCanDispatch` before pipeline (`query-handler.ts`); **`POST /v1/query/async`** preflight + worker path documented with eval/tests in **`docs/TARGET/Internal-Query-Execution-Audit.md`** (**2026-03-25**). Re-audit when adding new production query entrypoints. |
| WANT-014 | Governance | Budget fields (`token_budget`, `tool_budget`, `deadline_ms`, `cost_budget_usd`) enforced at runtime, not only computed. | Architecture §18.3 | Governance | P0 | WANT-013 | **Partial** — `deadline_ms` + `cost_budget_usd` on main query pipeline (`query-handler.ts` `withDeadline`, cost checks); **`tool_budget`** + **cumulative `token_budget`** on **`workflows/runner.ts`** (`metrics.tokens_used` per step, child pipeline telemetry, **`runner.test.ts`**); **coding-agent** autonomous harness: **`tool_budget`**, **`HARNESS_TOOL_ITERATION_ABSOLUTE_CAP`**, **`BUDGET_EXCEEDED`**, tests **`coding-agent-pipeline.test.ts`**. Ingress **`token_estimate`** vs **`token_budget`** via **`checkBudget`**. **Remaining:** single-pipeline paths that run multiple model hops without `runWorkflow` rely on **`query-handler`** post-hoc token check only; spot-check if any report misleading per-hop telemetry. |
| WANT-015 | Governance | Global per-request deadline bounds total wall-clock execution. | Architecture §18.3 | Performance | P0 | WANT-014 | **Partial** — `withRequestTimeout` / **`withProcessingOrTimeout`** on **all above job/query routes**, **`GET /healthz`**, **`GET /readyz`**, **`GET /metrics`**, **`GET /v1/version`**, **`GET /v1/preflight`**, **`POST /token/exchange`** (after body read), and **`/admin/flags*`** (`routes.ts`, `REQUEST_PROCESSING_TIMEOUT_MS`) + pipeline `withDeadline`. **Eval/CLI** paths use `handleQuery` without HTTP deadline — acceptable for harnesses; deeper pipeline deadline audit remains. |
| WANT-016 | Governance | Rate limit / quota yields deterministic **429** and explicit error taxonomy. | Architecture §18.3 | Security | P0 | — | **Met** — `checkQueryRateLimitAsync`, `RATE_LIMITED` + 429 (`src/server/rate-limit.ts`, `contracts/errors.ts`); test `auth.integration.test.ts`. |
| WANT-017 | Governance | Cross-request tenant cost controls use **shared persistent** counters (not process-local only). | Architecture §18.3 | Governance | P0 | — | **Met** — `tenant-budget.ts`: **PostgreSQL** via **`TENANT_BUDGET_POSTGRES_URL`** + optional **`TENANT_BUDGET_POSTGRES_TABLE`** (`PostgresTenantBudgetBackend`, optional **`pg`**); Upstash **Redis** REST; **file** (`TENANT_BUDGET_STORE_PATH`). Selection order: Redis → Postgres → file → in-memory (dev default). **`resetTenantBudgets()`** is async (pool/file teardown). Deploy: `docs/OPERATIONS/Production-Deployment-Guide.md` § Tenant Budget. |
| WANT-018 | Governance | Tenant usage accounting failures are **fail-soft** for user responses unless policy mandates hard-fail. | Architecture §18.3 | Governance | P0 | WANT-017 | **Met** — `recordTenantUsage` try/catch in `query-handler.ts` (emits event, returns response). |
| WANT-019 | Workflows | Workflow definitions fail validation on cycles, missing refs, invalid graphs. | Architecture §18.4 | Governance | P0 | — | **Met** — `WorkflowDefinitionSchema` / `workflow-definition.ts` validation. |
| WANT-020 | Workflows | `stop_conditions` (`max_iterations`, `deadline_ms`) enforced centrally by workflow runtime. | Architecture §18.4 | Governance | P0 | WANT-004 | **Met** — `src/workflows/runner.ts` (also cost stop conditions). |
| WANT-021 | Workflows | `decision` steps are explicitly implemented **or** rejected at validation (no silent no-op). | Architecture §18.4 | Product | P1 | WANT-019 | **Met** — decision branching in `runner.ts` (per gaps report §3.1). |
| WANT-022 | Workflows | Policy allowlists stay aligned with registered workflow catalog (no dead production workflows). | Architecture §18.4 | Governance | P0 | WANT-013 | **Met** — `evaluatePolicy` sets `allowed_pipelines` from `listRegisteredWorkflowIds()` (`policy-evaluator.ts`); gaps §9.9 updated 2026-03-24. |
| WANT-023 | Model | Production uses real providers, not stub-only execution. | Architecture §18.5 | Product | P0 | — | **Partial** — `OpenAiCompatibleModelGateway` when configured; **`bootstrap()`** rejects **`env=production`** unless **`model_gateway.providers`** includes at least one **`openai_compatible`** entry (**`bootstrap.test.ts`**); **`platform_production_rollout_enabled`** still forbids **any** `stub`/`framed_echo` provider. Dev/staging may keep framed/stub defaults. **Remaining:** optional stricter checks (e.g. API key present at startup) are product-specific. |
| WANT-024 | Model | Model registry supports **capability** and **scope/tenancy** routing axes. | Architecture §18.5 | Product | P0 | WANT-023 | **Met** — `model-gateway.ts` capability taxonomy + `resolveModelRoute` scope precedence. |
| WANT-025 | Model | Provider endpoints, credentials, and guardrails live in **validated** config. | Architecture §18.5 | Ops | P0 | WANT-023 | **Met** — `src/config/schema.ts` model provider fields + env. |
| WANT-026 | Model | Model calls use strict timeout, retry policy, and **retryability classification** by error class. | Architecture §18.5 | Performance | P1 | WANT-023 | **Partial** — **`isRetryableModelProviderHttpStatus`** (408/429/5xx; not 409/other 4xx); **`classifyRetryability`** treats gateway timeout, **`TypeError` fetch**, and transient **`cause.code`** (e.g. **`ECONNREFUSED`**, Undici) as retryable (**2026-03-25**). **Remaining:** richer provider body/error-code mapping if needed. |
| WANT-027 | Model | Gateway timeouts avoid timer leaks/churn; deterministic error mapping. | Architecture §18.5 | Performance | P1 | WANT-026 | **Partial** — model/tool **`Promise.race`** paths cancel timers; **async job** worker path uses **`raceWithTimeout`** (2026-03-25); deterministic error mapping still product-specific. |
| WANT-028 | Tools | Tool execution deny-by-default unless policy + allowlist permit. | Architecture §18.6 | Security | P0 | — | **Met** — deny-only / allowlist paths (`tool-gateway.ts`) for default production posture. |
| WANT-029 | Tools | Allowed tools run with sandbox (timeout, filesystem/network) and **auditable identity context**. | Architecture §18.6 | Security | P0 | WANT-010, WANT-028 | **Partial** — `AllowlistToolGateway` + builtin metadata; **`default-router`** sandbox flags (**2026-03-25**); **`tool_engine`** emits **`TOOL_START`/`TOOL_END`** (caller_org/app/user) + **`TOOL_ACCESS`** audit on every invocation (**2026-03-25**), with **`audit_level`/`redaction_level`** on **`EngineInvocation.metadata`** (from policy in **`coding-agent-pipeline`** + **`workflows/runner`**). **Remaining:** custom tools/registry parity beyond builtins. |
| WANT-030 | Tools | Production does not rely on stub delegates for real side-effecting tools. | Architecture §18.6 | Security | P0 | WANT-028 | **Partial** — real tools behind config (`TOOL_EXECUTION_ENABLED`, gateway selection); default may stay stub/deny until enabled. |
| WANT-031 | Memory | Production memory uses persistent/shared backends with **strict scope** enforcement. | Architecture §18.7 | Security | P0 | — | **Partial** — `default-store.ts` vector/Redis backends when configured; lexical in-memory path remains default without config. |
| WANT-032 | Memory | Retrieval uses embeddings/vector similarity in production; lexical-only is explicit fallback. | Architecture §18.7 | Product | P1 | WANT-031 | **Partial** — vector + embeddings when `memoryRuntime.backend === "vector"` and providers configured; hash fallback documented in code. |
| WANT-033 | Memory | Retrieval has bounded latency (timeout/fallback) and bounded context size. | Architecture §18.7 | Performance | P0 | WANT-031 | **Met** (runtime) — production retrieval goes through **`runRetrieval`** only (`query-handler`, **`memory_engine`**); tests/load harnesses call **`store.retrieve`** directly. |
| WANT-034 | Memory | Ingestion enforces per-document/request chunk limits. | Architecture §18.7 | Performance | P0 | WANT-031 | **Partial** — `max_chunks_per_ingest` / cap policy in `default-store.ts` + `InMemoryStore` options. |
| WANT-035 | Memory | Retention (TTL/max chunks) wired from validated config into active stores. | Architecture §18.7 | Ops | P0 | WANT-031 | **Partial** — retention on **`InMemoryStore`** + **`VectorRetrievalAdapter`** with **`pruneRetention`** on **in-memory / file / Redis** vector backends (**`redis-vector-backend.ts`**, **`redis-vector-backend.test.ts`**, **2026-03-25**). **Remaining:** optional Redis-native TTL (`EXPIRE` on ingest) for large corpora without full-key scans; cross-tier parity docs. |
| WANT-036 | Memory | Memory abstraction contracts fully defined (no production `TBD` surfaces). | Architecture §18.7 | Product | P1 | WANT-031 | **Partial** — **`IMemoryAbstraction`** = **`IMemoryStore`** in **`gateways/types.ts`** (WANT-036 **2026-03-25**); embedding **`provider: "gateway"`** documents explicit hash fallback in **`default-store.ts`**. **Remaining:** structured/object store persistence beyond in-process impls; any new memory surfaces should land in **`memory-abstraction.ts`** first. |
| WANT-037 | Observability | Required event taxonomy with trace continuity end-to-end. | Architecture §18.8; SPEC 01 | Ops | P0 | — | **Partial** — emitter + event types + trace context; **`VERIFY_RESULT`**, **`MEMORY_WRITE`**, **`MEMORY_QUERY`** wired (**2026-03-25**): **`emitMemoryQueryEvent`** + **`runRetrieval`** (hit/miss/degraded); memory engine catch path; `observability_required_events_v1` flag; automated “every request” proof vs SPEC 18 still TBD. |
| WANT-038 | Observability | Event and audit sinks non-blocking, persistent, bounded (rotation, backpressure, failure policy). | Architecture §18.8 | Ops | P0 | — | **Met** — async file sinks + bounded queues + rotation (`event-sink.ts`, `audit-logger.ts`); see SPEC 18 as-built 2026-03-24. |
| WANT-039 | Observability | Sink settings validated in config before production traffic. | Architecture §18.8 | Ops | P0 | — | **Met** — **`assertProductionSinkPathsWritable`** in bootstrap when **`NODE_ENV=production`** and sink paths set (parent dir exists + writable; existing file writable). Env **`AUDIT_LOG_FSYNC`** / **`OBSERVABILITY_EVENT_SINK_FSYNC`** documented in schema + Observability runbook. |
| WANT-040 | Observability | Audit integrity chain updates serialized/atomic on write path. | Architecture §18.8 | Security | P1 | WANT-038 | **Partial** — in-process serialization + **`verifyAuditLogFileIntegrity`** for **single-file** on-disk JSONL verification (2026-03-24); crash-level byte atomicity / `fsync` policy and cross-segment joining remain ops/product choices. |
| WANT-041 | Observability | Metrics/capture buffers bounded for long-running processes. | Architecture §18.8 | Performance | P1 | — | **Met** — metric series/sample caps + Prometheus `ai_server_metrics_dropped_total`; emitter `maxCaptureSize`; see `metrics.ts` / `emitter.ts` (2026-03-24). |
| WANT-042 | Observability | Production: trace sampling policy, alert simulation drills, expanded eval baselines (retrieval/multimodal). | Architecture §18.8 | Ops | P1 | WANT-037 | **Partial** — `observability_trace_sample_rate` in config; drills/baselines are process/runbook, not all in repo. |
| WANT-043 | Reliability | Startup fails fast on invalid required config (including `CONFIG_FILE` errors when set). | Architecture §18.9 | Ops | P0 | — | **Met** — `loadConfigWithOptionalFile` throws on bad/missing `CONFIG_FILE` (`schema.ts`). |
| WANT-044 | Reliability | Validate port/TLS; graceful shutdown (SIGTERM/SIGINT drain). | Architecture §18.9 | Ops | P0 | — | **Met** — `src/server/index.ts` PORT check, drain, closers. |
| WANT-045 | Reliability | TLS configured but invalid → startup **fails** (no silent HTTP-only). | Architecture §18.9 | Security | P0 | WANT-044 | **Met** — TLS load throws in `index.ts`. |
| WANT-046 | Reliability | Body read path enforces read timeout and aborted-request handling. | Architecture §18.9 | Security | P0 | — | **Met** — `readJsonBody` (`middleware.ts`) default 30s timeout + `aborted`. |
| WANT-047 | Reliability | Health/readiness reflect dependencies; **503** when required deps degrade. | Architecture §18.9 | Ops | P0 | WANT-009 | **Met** — `checkOperationalDependenciesAsync` + `routes.ts` 503 paths. |
| WANT-048 | Contracts | External/internal contracts match actual runtime behavior. | Architecture §18.10 | Contract | P0 | — | **Partial** — **RequestEnvelope** / **ResponseEnvelope** + **`ErrorCode`** (plain JSON routes) + **`ResponseErrorNested.error.code`** as **`string`** (matches Zod / pipeline engine codes) + **`ApiPlainError`** / **`QueryIngressErrorBody`** in **`openapi.yaml`**; **`routes.ts`** / **`errors.ts`** jobs, rollout **503**, admin flags, ingress **408/499/504**, **404** **`NOT_FOUND`** / **`MVP_QUERY_DISABLED`**; **`ERROR_CODES.md`** + SPEC 02/20. **Remaining:** internal-only contracts. |
| WANT-049 | Contracts | If async mode is exposed (`mode`, `job_id`, `accepted`, async lifecycle), full async semantics (queue, status, idempotency) exist. | Architecture §18.10 | Contract | P0 | — | **Partial** — Queue + job HTTP when configured; **`POST /v1/query`** remains **`mode: "sync"`**; **`POST /v1/query/async`** supports optional **`Idempotency-Key`** (tenant-scoped + body fingerprint, **409** on conflict; in-process replay **24h** — see SPEC 02, `job-queue.ts`). **Not:** sync path idempotency or cross-replica idempotency without shared store. |
| WANT-050 | Contracts | If async not implemented, contract surfaces **narrowed** until implemented. | Architecture §18.10 | Contract | P0 | WANT-049 | **Met** — Zod ingress is **strict** (rejects `async`/`auto` `mode`, `idempotency_key`, etc.); async is **separate route**; see SPEC 02 § Execution model. |
| WANT-051 | Config | Runtime-impacting settings in validated schema (auth, providers, sinks, retention, flags). | Architecture §18.11 | Ops | P0 | — | **Met** — `src/config/schema.ts` (Zod) covers major domains. |
| WANT-052 | Config | Feature flags map to **explicit** runtime behavior (not parse-only). | Architecture §18.11 | Governance | P0 | WANT-051 | **Met** — schema flags in SPEC 20; **`resolveFeatureFlagEnabled`** on query/routes/policy/harness; **`bootstrap/index.ts`** rollout gates + **`preflight.ts`** flag checks use **`resolveFeatureFlagEnabled`** (**2026-03-25**); **`server/index.ts`** emitter already dynamic. **Cosmetic:** debug **`safeDump`** still prints env **`config.flags`** only. |
| WANT-053 | Config | Rollout/harness gates enforced on runtime paths, not advisory only. | Architecture §18.11 | Governance | P0 | WANT-052 | **Partial** — `platform_production_rollout_enabled` drives **503** on key POST routes in production + strict bootstrap when enabled; **L2-99** is **process** (L2-99 plan docs reconciled **2026-03-24** — no `governance_harness_*` in `FeatureFlagsSchema`; use SPEC 20 + `harness_autonomous_execution_enabled` for runtime harness). |
| WANT-054 | Config | Release/build metadata for traceability; gate checks in production when required. | Architecture §18.11 | Ops | P0 | WANT-053 | **Met** — `GET /v1/version` exposes optional ids; **fail-fast** when **production + `platform_production_rollout_enabled`** and both `RELEASE_ID`/`BUILD_ID` missing (`assertProductionReleaseMetadataWhenRollout`, 2026-03-24). |
| WANT-055 | Quality | Critical modules covered by unit + integration tests (governance, memory gateway, workflows, eval paths). | Architecture §18.12 | Product | P1 | — | **Partial** — Jest suite exists; gaps report lists modules needing more unit tests. |
| WANT-056 | Quality | Production paths do not rely on stub engines where Architecture requires real implementations. | Architecture §18.12 | Product | P1 | WANT-023, WANT-030 | **Partial** — model/tool/eval paths can use real impls; stub engines still used where provider/tool not enabled. |
| WANT-057 | Quality | Runbooks: release/rollback, observability, memory outage, security response. | Architecture §18.12 | Ops | P0 | — | **Met** — `docs/OPERATIONS/RUNBOOKS/` (e.g. Release-and-Rollback, Observability-and-Eval, Memory-Retrieval-Outage, Query-and-Policy-Failures). |
| WANT-058 | Quality | Artifact policy for `dist/` (tracked vs CI-built) explicit and consistent. | Architecture §18.12 | Ops | P2 | — | **Met** — `dist/` in `.gitignore`; `verify:sow` runs `build`; README updated 2026-03-24 to match. |
| WANT-059 | Principles | Every request traceable (governance + execution events, costs, errors). | Architecture §2; SPEC 01 | Ops | P0 | WANT-037 | **Partial** — events + metrics when flags on; completeness vs “every request” not proven. |
| WANT-060 | Principles | Safe degradation: structured errors and bounded fallbacks when dependencies fail. | SPEC 01 | Product | P1 | WANT-047 | **Partial** — structured ingress/policy errors; retrieval fail-soft; dependency 503s on health paths. |

---

## Expansion backlog (not yet row-split)

Mine these for additional WANT rows in a second pass:

- `docs/SPEC/02_API_Contracts.md` — sync/async fields, error envelopes, versioning.
- `docs/SPEC/04_Ingress_Spec.md` — TLS, payload limits, auth ordering.
- `docs/SPEC/07_PolicyEngine_Spec.md` — policy outputs and enforcement hooks.
- `docs/SPEC/15_ModelGateway_Spec.md` — provider adapters, token accounting.
- `docs/SPEC/16_ToolGateway_Spec.md` — sandbox dimensions, audit.
- `docs/SPEC/17_MemoryAbstraction_Spec.md` — store types, scope, retrieval.
- `docs/SPEC/19_Security_and_Isolation_Spec.md` — isolation, audit, abuse.
- `docs/SPEC/20_Config_and_FeatureFlags.md` — flag semantics and defaults.
- `docs/SPEC/22_Runbooks_and_Operations.md` — operational requirements and SLO references.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-24 | **Narrowed target — product & deployment decisions:** owner Q&A (single instance, Postgres+Chroma, auth/token-only, hard budgets, blocked tenant overage, no stubs, HTTP-safe tools, autonomous tools in scope, memory tiering, vector required when memory on, contract/observability/audit/test acceptance) + **`WANT-xxx` traceability** table. |
| 2026-03-24 | Initial extraction from Architecture §18 and SPEC 00/01; placeholder status column for reconciliation pass. |
| 2026-03-24 | **Implementation status** column filled from `src/` evidence pass; README `dist/` policy aligned with `.gitignore`. |
| 2026-03-24 | **WANT-022** set to **Met** after verifying `policy-evaluator.ts` uses `listRegisteredWorkflowIds()`; gaps §9.9 and SOW `GAP-POLICY-001` updated (prior narrative was stale). |
| 2026-03-24 | **WANT-038/040/041** refreshed: bounded metrics (incl. Prometheus drop counters), in-memory audit cap + suffix integrity verify; gaps §9.5, SPEC 18/19 as-built notes. |
| 2026-03-24 | **WANT-048–050 slice:** SPEC 02 execution-model section; `openapi.yaml` schemas match Zod request/response envelopes; **WANT-050** → **Met** (strict ingress + separate async HTTP). |
| 2026-03-24 | **WANT-052 slice:** SPEC 20 flag list + enforcement matrix; gaps §7 + harness runbook; **WANT-052** → **Met** (with static/dynamic caveat); **WANT-053** clarified. |
| 2026-03-24 | **WANT-054 slice:** `assertProductionReleaseMetadataWhenRollout` in bootstrap; SPEC 20 release section; **WANT-054** → **Met**. |
| 2026-03-24 | **WANT-052 follow-on:** `resolveFeatureFlagEnabled` in `feature-flags.ts`; `policy-evaluator` + `coding-agent-pipeline` use caller-scoped dynamic resolution; routes/query-handler delegate; SPEC 20 matrix + backlog note updated. |
| 2026-03-24 | **WANT-049 slice:** `Idempotency-Key` on `POST /v1/query/async` (`async-idempotency.ts`, `JobQueueService`); **`IDEMPOTENCY_KEY_CONFLICT`**; OpenAPI + SPEC 02 + gaps §9.8 + **WANT-049** row refreshed. |
| 2026-03-24 | **WANT-040 slice:** `verifyAuditLogFileIntegrity` (`audit-logger.ts`) + tests; SPEC 19 + gaps §9.5; L2-99 plan docs corrected (no `governance_harness_*` schema flag). |
| 2026-03-24 | **WANT-039 + sink durability:** `sink-paths.ts` + bootstrap; **`AUDIT_LOG_FSYNC`** / **`OBSERVABILITY_EVENT_SINK_FSYNC`**; SOW **GAP-OBS-001** / **GAP-SEC-001** / **GAP-MEM-001**; Observability runbook; **WANT-039** → **Met**. |
| 2026-03-24 | **Shutdown + SOW:** graceful sink flush (`shutdownPersistentAuditFileSink`, event `close()`); SOW **GAP-OPS-002** → **Closed**, **GAP-API-002** → **Partial**; gaps §9.1, SPEC 18, runbook. |
| 2026-03-24 | **WANT-013 slice:** `runQueryGovernanceGate` / `preflightAsyncQueryGovernance`; async submit governance preflight; OpenAPI + SPEC 02 **200** blocked envelope on `/v1/query/async`. |
| 2026-03-25 | **WANT-017:** `PostgresTenantBudgetBackend`, env **`TENANT_BUDGET_POSTGRES_URL`** / **`TENANT_BUDGET_POSTGRES_TABLE`**; optional **`pg`** + **`@types/pg`**; async **`resetTenantBudgets`**; deployment guide tenant section aligned. |
| 2026-03-25 | **WANT-004 slice:** `harness_autonomous_execution` on **`PipelinePlan`**; router resolves flag; coding pipeline obeys plan; **`RouterInput.caller`**. |
| 2026-03-25 | **WANT-005:** `engine-architecture-invariants.test.ts`; `base.ts` / `registry.ts` doc cross-refs. |
| 2026-03-25 | **WANT-006:** `governance/gateway-access-invariants.test.ts`; `tool-gateway.ts` / `query-handler` notes. |
| 2026-03-25 | **WANT-014 slice:** `tool_budget` enforcement in `workflows/runner.ts` (tool steps + sub-workflow tool totals); `resource-manager` / gaps §9.1 / §9.4 aligned to split enforcement; `runner.test.ts` coverage. |
| 2026-03-25 | **WANT-026 / WANT-027 slice (timers):** `job-queue.ts` — `raceWithTimeout` clears job timeout on completion; webhook attempt **`finally`** clears abort timer; gaps §9.11 updated (model/tool wrappers already used **`clearTimeout`**). |
| 2026-03-25 | **WANT-033 slice:** `memory_engine` forwards **`retrieval_timeout_ms`** / **`max_context_tokens`** into **`runRetrieval`**; **`createChatPipeline`** sets formal_spec from **`config.memory`** + **`plan.budgets.token_budget`** (parity with **`query-handler`** retrieval block); `memory_engine.test.ts` coverage. |
| 2026-03-25 | **WANT-026 slice:** `model-gateway` — **`isRetryableModelProviderHttpStatus`**; expanded **`classifyRetryability`** for timeout / fetch **`TypeError`** / socket cause codes; `model-gateway.test.ts` cases. |
| 2026-03-25 | **WANT-029 / §9.12 slice:** **`toolIdRequiresNetworkAccess`** / **`toolIdRequiresFilesystemAccess`**; **`default-router`** fills **`plan.sandbox`** network/fs from **`tools_enabled`**; gaps §9.12; `default-router.test.ts`. |
| 2026-03-25 | **WANT-037 slice:** **`emitVerifyResultEvent`** / **`emitMemoryWriteEvent`** (`taxonomy-events.ts`); **`evaluation_engine`** + **`in-memory-store`** + **`vector-retrieval-adapter`**; SPEC 18 as-built note; tests. |
| 2026-03-25 | **WANT-037 follow-on:** **`emitMemoryQueryEvent`**; central **`MEMORY_QUERY`** in **`runRetrieval`** (degraded + success); query-handler duplicate removed; memory engine success path deduped; catch path + redact allowlist (`degraded`, `error`); retrieval + taxonomy tests; SPEC 18 + Engines reference. |
| 2026-03-25 | **WANT-048 slice:** **`errors.ts`** operational codes (**`ASYNC_NOT_AVAILABLE`**, **`INVALID_JOB_ID`**, **`JOB_NOT_FOUND`**, **`CANNOT_CANCEL`**, **`FLAGS_NOT_AVAILABLE`**, **`TIMEOUT`**); **`openapi.yaml`** job/admin/ingress responses + **`ErrorDetail.detail`** fix + **`ResponseErrorNested.code`** as open **`string`** (Zod parity); **`ERROR_CODES.md`**, SPEC 02, **`contracts.test.ts`**. |
| 2026-03-25 | **WANT-048 follow-on:** **`NOT_FOUND`** + **`MVP_QUERY_DISABLED`** (**`ApiPlainError`**); removed **`MvpQueryDisabledResponse`**; SPEC 02/20 + **`routes.errors.integration.test.ts`**. |
| 2026-03-25 | **WANT-029 slice:** **`tool_engine`** central **`TOOL_START`/`TOOL_END`** + **`TOOL_ACCESS`**; **`InvocationMetadata`** **`audit_level`/`redaction_level`**; **`runner`**, **`coding-agent-pipeline`**, **`redact`** allowlist; **`tool_engine`** audit tests. **WANT-033** row → **Met** (no prod **`store.retrieve`** bypass). |
| 2026-03-25 | **WANT-052 slice:** **`bootstrap`** + **`preflight`** use **`resolveFeatureFlagEnabled`** for rollout / security_hard_controls / cost_caps (aligns with SPEC 20 dynamic matrix). |
| 2026-03-25 | **WANT-035 slice:** **`memoryRetention`** → **`VectorRetrievalAdapter.retention`** + **`VectorBackend.pruneRetention`** (**`InMemoryVectorBackend`**, **`FileVectorBackend`**); **`evictVectorRecords`** + tests. |

---

*End of target-state backlog.*
