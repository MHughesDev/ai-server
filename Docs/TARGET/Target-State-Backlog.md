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

## Target-state backlog (extracted)

| ID | Capability | Want | Source | Type | Priority | Depends on | Implementation status |
|----|------------|------|--------|------|----------|------------|-------------------------|
| WANT-001 | Architecture | Single primary app entrypoint `POST /v1/query` for governed execution. | Architecture §1, §5; SPEC 00 | Product | P0 | — | **Met** — `src/server/routes.ts` `POST /v1/query`; gated by `runtime_mvp_query_chat_enabled`. |
| WANT-002 | Architecture | Ingress is deterministic (auth, rate limits, payload limits, request IDs); **no** model reasoning at ingress. | Architecture §2; SPEC 01 | Security | P0 | — | **Met** — `validateIngress` (`src/ingress/validate.ts`); body limits + `readJsonBody`; rate limit on query routes; no LLM in ingress. |
| WANT-003 | Architecture | Brain Stem is first cognitive step (canonicalize, intent, risk/complexity). | Architecture §2–4; SPEC 01 | Product | P0 | WANT-002 | **Met** — `handleQuery`: `canonicalize` → `extractIntent` → control plane (`src/server/query-handler.ts`, `src/brainstem/*`). |
| WANT-004 | Architecture | Orchestrator is sole authority for loops, nesting, retries, stop conditions, execution mode, runtime budget changes. | Architecture §3–4, §16; SPEC 01 | Governance | P0 | — | **Partial** — `src/workflows/runner.ts` centralizes workflow loops/stop; chat/other pipelines have local iteration; execution mode split across router/pipelines. |
| WANT-005 | Architecture | Engines do not orchestrate and do not call other engines; at most one gateway per engine. | Architecture §3; SPEC 01 | Governance | P0 | — | **Partial** — production registry wiring; tests use `createStub*` engines; verify all engine paths match invariant. |
| WANT-006 | Architecture | Tools and memory only via gateways; policy-gated. | Architecture §3–4; SPEC 00–01 | Security | P0 | — | **Partial** — `tool-gateway`, memory stores/gateway; policy gates tool allowlists; spot-check each pipeline for direct bypass. |
| WANT-007 | Architecture | Workflows are modality-agnostic graphs; selection by intent/risk/complexity/capability, not input modality names. | Architecture §2–3; SPEC 01 | Product | P1 | — | **Partial** — router uses intent/risk signals; multimodal flags influence pipeline set; full modality-agnostic claim not formally proven. |
| WANT-008 | API | Expose identity trust boundary `POST /token/exchange` for production (external IdP JWT → short-lived server AI JWT). | Architecture §5; SPEC 00 | Security | P0 | — | **Met** — `src/server/routes.ts`, `src/server/auth.ts` exchange + mint/verify. |
| WANT-009 | API | Operational surface: `GET /healthz`, `/readyz`, `/metrics`, `/v1/version` as defined in Architecture/SPEC. | Architecture §5; SPEC 00 | Ops | P0 | — | **Met** — same file; optional bearer when `OPERATIONAL_BEARER_TOKEN` set. Also `GET /v1/preflight`. |
| WANT-010 | Identity | Production identity context from **verified** token claims, not body-spoofed caller fields. | Architecture §18.1; SPEC 01 “Production Target” | Security | P0 | WANT-008 | **Partial** — `assertCallerStrictMatch` when `verifiedCallerContext` provided (`validate.ts`); strength depends on `requireAuthHeader` / production profile. |
| WANT-011 | Identity | AI JWTs are short-lived; validation enforces issuer, audience, scope, and claim binding to requests. | Architecture §18.1 | Security | P0 | WANT-008 | **Partial** — `auth.ts` JWT validation + TTL config; keep aligned with SPEC 19 for all edge cases. |
| WANT-012 | Security | Secrets never appear in logs/events/audit; redaction policy applied consistently. | Architecture §18.2 | Security | P0 | — | **Partial** — `redaction_level` on events/audit paths (`query-handler.ts`); gaps report still notes sync sink and thoroughness risks. |
| WANT-013 | Governance | Policy → budget → route → dispatch gate is **non-bypassable** in production. | Architecture §18.3 | Governance | P0 | — | **Partial** — `createControlPlane` → `assertCanDispatch` before pipeline (`query-handler.ts`); prove non-bypass for every production entrypoint. |
| WANT-014 | Governance | Budget fields (`token_budget`, `tool_budget`, `deadline_ms`, `cost_budget_usd`) enforced at runtime, not only computed. | Architecture §18.3 | Governance | P0 | WANT-013 | **Partial** — `deadline_ms` + `cost_budget_usd` enforced on main query pipeline (`query-handler.ts` `withDeadline`, cost checks); `resource-manager.ts` still documents pass-through only; token/tool budgets need cross-path audit. |
| WANT-015 | Governance | Global per-request deadline bounds total wall-clock execution. | Architecture §18.3 | Performance | P0 | WANT-014 | **Partial** — `withRequestTimeout` on `/v1/query` (`routes.ts`) + pipeline `withDeadline`; not all routes/pipelines audited. |
| WANT-016 | Governance | Rate limit / quota yields deterministic **429** and explicit error taxonomy. | Architecture §18.3 | Security | P0 | — | **Met** — `checkQueryRateLimitAsync`, `RATE_LIMITED` + 429 (`src/server/rate-limit.ts`, `contracts/errors.ts`); test `auth.integration.test.ts`. |
| WANT-017 | Governance | Cross-request tenant cost controls use **shared persistent** counters (not process-local only). | Architecture §18.3 | Governance | P0 | — | **Partial** — `tenant-budget.ts` supports file/Redis backends; default in-memory unless configured. |
| WANT-018 | Governance | Tenant usage accounting failures are **fail-soft** for user responses unless policy mandates hard-fail. | Architecture §18.3 | Governance | P0 | WANT-017 | **Met** — `recordTenantUsage` try/catch in `query-handler.ts` (emits event, returns response). |
| WANT-019 | Workflows | Workflow definitions fail validation on cycles, missing refs, invalid graphs. | Architecture §18.4 | Governance | P0 | — | **Met** — `WorkflowDefinitionSchema` / `workflow-definition.ts` validation. |
| WANT-020 | Workflows | `stop_conditions` (`max_iterations`, `deadline_ms`) enforced centrally by workflow runtime. | Architecture §18.4 | Governance | P0 | WANT-004 | **Met** — `src/workflows/runner.ts` (also cost stop conditions). |
| WANT-021 | Workflows | `decision` steps are explicitly implemented **or** rejected at validation (no silent no-op). | Architecture §18.4 | Product | P1 | WANT-019 | **Met** — decision branching in `runner.ts` (per gaps report §3.1). |
| WANT-022 | Workflows | Policy allowlists stay aligned with registered workflow catalog (no dead production workflows). | Architecture §18.4 | Governance | P0 | WANT-013 | **Met** — `evaluatePolicy` sets `allowed_pipelines` from `listRegisteredWorkflowIds()` (`policy-evaluator.ts`); gaps §9.9 updated 2026-03-24. |
| WANT-023 | Model | Production uses real providers, not stub-only execution. | Architecture §18.5 | Product | P0 | — | **Partial** — `OpenAiCompatibleModelGateway` when configured; stub fallback if no provider (by design for dev). |
| WANT-024 | Model | Model registry supports **capability** and **scope/tenancy** routing axes. | Architecture §18.5 | Product | P0 | WANT-023 | **Met** — `model-gateway.ts` capability taxonomy + `resolveModelRoute` scope precedence. |
| WANT-025 | Model | Provider endpoints, credentials, and guardrails live in **validated** config. | Architecture §18.5 | Ops | P0 | WANT-023 | **Met** — `src/config/schema.ts` model provider fields + env. |
| WANT-026 | Model | Model calls use strict timeout, retry policy, and **retryability classification** by error class. | Architecture §18.5 | Performance | P1 | WANT-023 | **Partial** — timeouts/retries exist; gaps §9.11: retryability/timer cleanup improvements. |
| WANT-027 | Model | Gateway timeouts avoid timer leaks/churn; deterministic error mapping. | Architecture §18.5 | Performance | P1 | WANT-026 | **Partial** — same §9.11 timer-churn note. |
| WANT-028 | Tools | Tool execution deny-by-default unless policy + allowlist permit. | Architecture §18.6 | Security | P0 | — | **Met** — deny-only / allowlist paths (`tool-gateway.ts`) for default production posture. |
| WANT-029 | Tools | Allowed tools run with sandbox (timeout, filesystem/network) and **auditable identity context**. | Architecture §18.6 | Security | P0 | WANT-010, WANT-028 | **Partial** — `AllowlistToolGateway` enforces sandbox dimensions when executable path used; verify all tool entrypoints. |
| WANT-030 | Tools | Production does not rely on stub delegates for real side-effecting tools. | Architecture §18.6 | Security | P0 | WANT-028 | **Partial** — real tools behind config (`TOOL_EXECUTION_ENABLED`, gateway selection); default may stay stub/deny until enabled. |
| WANT-031 | Memory | Production memory uses persistent/shared backends with **strict scope** enforcement. | Architecture §18.7 | Security | P0 | — | **Partial** — `default-store.ts` vector/Redis backends when configured; lexical in-memory path remains default without config. |
| WANT-032 | Memory | Retrieval uses embeddings/vector similarity in production; lexical-only is explicit fallback. | Architecture §18.7 | Product | P1 | WANT-031 | **Partial** — vector + embeddings when `memoryRuntime.backend === "vector"` and providers configured; hash fallback documented in code. |
| WANT-033 | Memory | Retrieval has bounded latency (timeout/fallback) and bounded context size. | Architecture §18.7 | Performance | P0 | WANT-031 | **Partial** — `retrieval-service.ts` `retrieval_timeout_ms`, token-bounded context; gaps may still list other unbounded paths. |
| WANT-034 | Memory | Ingestion enforces per-document/request chunk limits. | Architecture §18.7 | Performance | P0 | WANT-031 | **Partial** — `max_chunks_per_ingest` / cap policy in `default-store.ts` + `InMemoryStore` options. |
| WANT-035 | Memory | Retention (TTL/max chunks) wired from validated config into active stores. | Architecture §18.7 | Ops | P0 | WANT-031 | **Partial** — retention passed into `InMemoryStore` from schema-driven config; verify vector path parity. |
| WANT-036 | Memory | Memory abstraction contracts fully defined (no production `TBD` surfaces). | Architecture §18.7 | Product | P1 | WANT-031 | **Partial** — types and gateway exist; occasional `TBD`/fallback comments in gateways and embedding path. |
| WANT-037 | Observability | Required event taxonomy with trace continuity end-to-end. | Architecture §18.8; SPEC 01 | Ops | P0 | — | **Partial** — emitter + event types + trace context; `observability_required_events_v1` flag; full taxonomy coverage TBD vs SPEC 18. |
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
| WANT-048 | Contracts | External/internal contracts match actual runtime behavior. | Architecture §18.10 | Contract | P0 | — | **Partial** — `openapi.yaml` **RequestEnvelope** / **ResponseEnvelope** aligned to Zod (2026-03-24); rolling parity for every error shape + internal-only contracts still manual. |
| WANT-049 | Contracts | If async mode is exposed (`mode`, `job_id`, `accepted`, async lifecycle), full async semantics (queue, status, idempotency) exist. | Architecture §18.10 | Contract | P0 | — | **Partial** — Queue + job HTTP when configured; **`POST /v1/query`** remains **`mode: "sync"`**; **`POST /v1/query/async`** supports optional **`Idempotency-Key`** (tenant-scoped + body fingerprint, **409** on conflict; in-process replay **24h** — see SPEC 02, `job-queue.ts`). **Not:** sync path idempotency or cross-replica idempotency without shared store. |
| WANT-050 | Contracts | If async not implemented, contract surfaces **narrowed** until implemented. | Architecture §18.10 | Contract | P0 | WANT-049 | **Met** — Zod ingress is **strict** (rejects `async`/`auto` `mode`, `idempotency_key`, etc.); async is **separate route**; see SPEC 02 § Execution model. |
| WANT-051 | Config | Runtime-impacting settings in validated schema (auth, providers, sinks, retention, flags). | Architecture §18.11 | Ops | P0 | — | **Met** — `src/config/schema.ts` (Zod) covers major domains. |
| WANT-052 | Config | Feature flags map to **explicit** runtime behavior (not parse-only). | Architecture §18.11 | Governance | P0 | WANT-051 | **Met** — schema flags documented in SPEC 20 matrix; policy (`enable_org_memory`) and coding-agent harness flags use `resolveFeatureFlagEnabled` with caller context so `/admin/flags` overrides align with query/routes (2026-03-24). **Remaining static paths:** bootstrap/preflight and `server/index.ts` emitter gating where noted in SPEC 20. |
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

---

*End of target-state backlog.*
