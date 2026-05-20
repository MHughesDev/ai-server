# Unified backlog — AI Server

**Purpose:** Single task register for production readiness, target-state gaps, code stubs, documentation parity, and operations. Replaces scattered checklists and gap/backlog markdown files (see [Consolidated sources](#consolidated-sources)).

**Last aggregated:** 2026-05-20 (repo scan + prior readiness docs)  
**Last task closed:** WANT-004 — orchestrator sole authority for loops/budgets/mode (2026-05-20)

**Definition of done (technical):** `npm run verify:sow` passes; `openapi.yaml` and `docs/SPEC/02_API_Contracts.md` match `src/server/routes.ts`.

---

## How to use this file

| Column / field | Meaning |
|----------------|---------|
| **Status** | `open` · `partial` · `blocked` · `done` (update when closing work) |
| **Priority** | **P0** launch blocker · **P1** hardening · **P2** stretch / post-launch |
| **ID** | Stable handle: `WANT-xxx` (target), `GAP-xxx` (doc/runtime), `PR-xxx` (production checklist), `STUB-xxx` (code), `DOC-xxx`, `OPS-xxx` |

**Canonical references (not task lists):**

- Agent playbook: [`docs/OPERATIONS/Production-Readiness-Go-No-Go-Summary.md`](docs/OPERATIONS/Production-Readiness-Go-No-Go-Summary.md)
- Current-state narrative: [`docs/OPERATIONS/Production-Readiness-Gaps-Report.md`](docs/OPERATIONS/Production-Readiness-Gaps-Report.md)
- Normative architecture: [`docs/ARCHITECTURE/Architecture_document_Finalized.md`](docs/ARCHITECTURE/Architecture_document_Finalized.md) §18
- HTTP surface: [`src/server/routes.ts`](src/server/routes.ts)

---

## Summary

| Area | Open / partial (approx.) | P0 focus |
|------|--------------------------|----------|
| Production launch checklist | ~70 unchecked | Config, secrets, providers, memory, verification |
| Target requirements (`WANT-xxx`) | 22 **Partial** | No stubs in prod, memory/vector, observability proof |
| Gap register (`GAP-xxx`) | 14 **Partial** / open | Model/tool production wiring, memory persistence |
| Code stubs & placeholders | 15+ locations | Secrets manager, embeddings bridge, test stubs (OK in tests) |
| Documentation & parity | 12+ | OpenAPI/SPEC sync, gaps report §9 refresh |
| Operations / L2-99 | 6+ | Drills, evidence pack, go/no-go sign-off |

---

## 1. Production launch (P0) — must configure before go-live

From former `Production-Readiness-Complete-Checklist.md` Phase 1–2 and gaps report §10.

### 1.1 Config & secrets

| ID | Task | Status | Priority | Evidence / files |
|----|------|--------|----------|------------------|
| PR-001 | Set `OPERATIONAL_BEARER_TOKEN` for protected ops endpoints | done | P0 | Bootstrap fail-fast in production (`bootstrap/index.ts`); routes require Bearer when set; `.env.example` + `operational-auth.integration.test.ts` (2026-05-20). **Deploy:** set env in prod/K8s (`k8s/base/secret.yaml`). |
| PR-002 | Configure real model providers (`MODEL_GATEWAY_PROVIDERS_JSON` / registry); no stub-only in production | done | P0 | `assert-production-model-gateway.ts` + bootstrap: `openai_compatible` only in prod, API key env required, registry must route to real provider; `.env.example`; tests (2026-05-20). **Deploy:** set `MODEL_GATEWAY_*` + `MODEL_PROVIDER_API_KEY` in prod. |
| PR-003 | Set auth: `AUTH_AI_JWT_SECRET`, IdP/app registry JSON, scopes | done | P0 | `assert-production-auth.ts` + bootstrap: strong `AUTH_AI_JWT_SECRET`, `REQUIRE_AUTH_HEADER`, explicit `AUTH_*_REGISTRY_JSON`, no dev IdP/app defaults, scope + issuer checks; `.env.example`; tests (2026-05-20). **Deploy:** set auth env in prod. |
| PR-004 | Set `RELEASE_ID` / `BUILD_ID` when `PLATFORM_PRODUCTION_ROLLOUT_ENABLED=true` | done | P0 | `assertProductionReleaseMetadataWhenRollout` uses `resolveFeatureFlagEnabled`; bootstrap fail-fast; `/v1/version` exposes ids; `.env.example`, k8s env; tests (2026-05-20). **Deploy:** set `RELEASE_ID` and/or `BUILD_ID` when enabling rollout. |
| PR-005 | Replace stub secrets manager with Vault/KMS (or documented prod backend) | done | P0 | `secrets-backend.ts` + `assert-production-secrets-backend.ts`: `env`/`aws_secrets_manager`/`vault` backends, `SCOPED_SECRETS_JSON` or prefixed env; bootstrap fail-fast; preflight; tests (2026-05-20). **Deploy:** set `SECRETS_BACKEND` and inject scoped secrets. |
| PR-006 | Configure persistent memory (Redis/vector/Chroma per product target); not in-memory only | done | P0 | `assert-production-memory.ts` + bootstrap: `MEMORY_BACKEND=vector` + `REDIS_URL` or `CHROMA_URL`; preflight; k8s; `default-store` blocks in-memory vector fallback in prod; tests (2026-05-20). **Deploy:** set `MEMORY_BACKEND=vector` and `REDIS_URL`. |
| PR-007 | Tenant budget: shared durable backend (Postgres/Redis), not process-local only | done | P0 | `IoredisTenantBudgetBackend` via `REDIS_URL`; `assert-production-tenant-budget.ts`; bootstrap/preflight; tests (2026-05-20). **Deploy:** `REDIS_URL` or `TENANT_BUDGET_POSTGRES_URL`. |

### 1.2 Security & rollout controls

| ID | Task | Status | Priority | Evidence / files |
|----|------|--------|----------|------------------|
| PR-010 | Enable rollout only after canary sign-off: `PLATFORM_PRODUCTION_ROLLOUT_ENABLED=true` | done | P0 | `ROLLOUT_CANARY_SIGNOFF=true` required when rollout on; `assertProductionRolloutCanarySignoff`; preflight `rollout.canary_signoff`; bootstrap tests; runbook/SPEC 20/k8s prod (2026-05-20). **Deploy:** preflight pass → canary → signoff → enable rollout flag. |
| PR-011 | Verify kill-switch end-to-end | done | P0 | `isProductionRolloutTrafficBlocked` + `rollout-kill-switch.integration.test.ts`: 503 POLICY_BLOCKED on `/token/exchange`, `/v1/query`, `/v1/query/async` in prod when off; dev not blocked; recovery on re-enable (2026-05-20). |
| PR-012 | Confirm audit + event sinks persistent with rotation | done | P0 | `assert-production-persistent-sinks.ts`, `file-sink-options.ts`, `wirePersistentSinksFromConfig`; rotation tests; bootstrap/preflight/k8s (2026-05-20). **Deploy:** set both sink paths + optional `*_MAX_FILE_BYTES` / `*_MAX_ROTATED_FILES`. |
| PR-013 | Confirm PII/secrets redaction active in telemetry | done | P0 | `assert-production-telemetry-redaction.ts`, `resolveTelemetryRedactionLevel`, `payloadHasSensitiveKeys`; emitter+sink E2E test; bootstrap/preflight/k8s (2026-05-20). **Deploy:** `OBSERVABILITY_REDACTION_LEVEL=minimal` (not `none`). |
| PR-014 | Security review before enabling executable tools in production | done | P0 | `assert-production-tool-execution.ts`, `resolveToolExecutionEnabled`, bootstrap/preflight; `TOOL_EXECUTION_SECURITY_REVIEW_SIGNOFF` + `TOOL_FILESYSTEM_ROOT` when `TOOL_EXECUTION_ENABLED=true` (2026-05-20). **Deploy:** review SPEC 16 sandbox → signoff → enable tools. |

### 1.3 Infrastructure hardening

| ID | Task | Status | Priority | Evidence / files |
|----|------|--------|----------|------------------|
| PR-020 | Fix timer leaks on success paths in model/tool gateway races | done | P1 | `race-with-timeout.ts`; model/tool gateways use shared helper; fake-timer tests prove zero pending timers on success (2026-05-20). |
| PR-021 | Request/connection limits under load (memory exhaustion) | done | P1 | `connection-limits.ts`, `connection-tracker.ts`, `RequestQueue` backpressure, `server.maxConnections`; bootstrap/preflight/k8s (2026-05-20). **Deploy:** set `MAX_CONNECTIONS`, `MAX_CONNECTIONS_PER_IP`, `MAX_CONCURRENT_REQUESTS`, `MAX_REQUEST_QUEUE_DEPTH`, `MAX_BODY_BYTES`. |
| PR-022 | Graceful request draining on SIGTERM (verify SLO) | done | P0 | `graceful-shutdown.ts`, in-flight tracking in `routes.ts`, `waitForDrain` + integration test; k8s `terminationGracePeriodSeconds: 45`; bootstrap/preflight (2026-05-20). **Deploy:** `SHUTDOWN_DRAIN_TIMEOUT_MS=30000`, grace period ≥ 45s. |
| PR-023 | Wire `plan.budgets.deadline_ms` through all pipeline hops | done | P0 | `pipeline-deadline.ts` (`PipelineDeadline`); chat/coding-agent/deep-research/decision pipelines + `workflows/runner.ts`; outer `withDeadline` in `query-handler.ts`; tests (2026-05-20). |
| PR-024 | Run `npm run verify:sow` on release branch | done | P0 | Verified 2026-05-20 on `cursor/consolidate-todo-md-9c5f`: lint, typecheck, build, 574 tests pass |

### 1.4 CI/CD, canary, and sign-off (L2-08)

| ID | Task | Status | Priority | Evidence / files |
|----|------|--------|----------|------------------|
| PR-030 | CI/CD: signed artifacts, manifest validation, pre-release smoke | done | P0 | `.github/workflows/ci.yml` `release-gates` job; `scripts/release/*`, `validate-*`, `pre-release-smoke.mjs`; `npm run validate:manifests`, `release:artifacts`, `smoke:pre-release`; `src/release/release-pipeline.test.ts` (2026-05-20) |
| PR-031 | Canary cohorts + rollback drills with MTTR evidence | done | P0 | `src/rollout/cohorts.ts`, `policy.ts` (`evaluateCanaryDecision`, `loadRolloutPolicyFromEnv`), `rollback-drill.ts`, `rollback-drill.integration.test.ts`, `npm run drill:rollback`, CI evidence artifact; runbook updated (2026-05-20) |
| PR-032 | Incident simulation drills (provider, policy, budget) | done | P0 | `src/operations/incident-drills*.ts`, `npm run drill:incidents`, `Incident-Simulation-Drills.md`, CI evidence artifact (2026-05-20) |
| PR-033 | Formal go/no-go with signatories + evidence package | done | P0 | `src/governance/go-no-go.ts`, `npm run go-no-go:package`, `Go-No-Go-Decision.md`, templates, CI artifact (2026-05-20) |
| PR-034 | L2-99 harness readiness decision recorded | done | P1 | `src/governance/harness-readiness.ts`, `npm run harness-readiness:record`, `L2-99_Evidence-Checklist.md`, CI artifact `harness-readiness-decision.json` (2026-05-20) |

---

## 2. Target requirements (`WANT-xxx`) — partial or not met

Normative source was `docs/TARGET/Target-State-Backlog.md`. **Product decisions (2026-03-24):** single instance; Postgres + Chroma; all requests authenticated; token-only identity; hard budgets; no production stubs; HTTP-safe tools; vector required when memory on; full SPEC 18 observability before WANT-037 met.

| ID | Want (short) | Status | Priority | Remaining work |
|----|--------------|--------|----------|----------------|
| WANT-004 | Orchestrator sole authority for loops/budgets/mode | done | P0 | `src/orchestrator/*` (execution-spec, apply-plan, harness-loop); query-handler applies plan; coding-agent uses orchestrator loop; tests (2026-05-20) |
| WANT-012 | Secrets never in logs/events; consistent redaction | partial | P0 | Audit emitters at source; sync-sink thoroughness |
| WANT-014 | Runtime budget enforcement (token/tool/deadline/cost) | partial | P0 | Non-workflow multi-hop paths; per-hop telemetry accuracy |
| WANT-015 | Global per-request deadline | partial | P0 | Deeper pipeline deadline audit beyond HTTP wrapper |
| WANT-023 | Production real model providers (no stub-only) | partial | P0 | Bootstrap validates provider + key + registry (2026-05-20); dev defaults remain framed/stub |
| WANT-026 | Model retry policy by error class | partial | P1 | Richer provider body/error-code mapping |
| WANT-027 | Gateway timeouts without timer leaks | partial | P1 | Deterministic error mapping product-wide |
| WANT-029 | Tool sandbox + auditable identity | partial | P0 | Custom tools/registry beyond builtins |
| WANT-030 | No stub delegates for side-effecting tools | partial | P0 | Enable `ExecutableToolGateway` in prod config after review |
| WANT-031 | Persistent memory + strict scope | partial | P0 | Chroma/Redis/vector; drop lexical-only default in prod |
| WANT-032 | Vector/embeddings in production retrieval | partial | P0 | `provider: "gateway"` embeddings bridge (see STUB-003) |
| WANT-034 | Ingest chunk limits | partial | P0 | Enforce caps on all ingest paths |
| WANT-035 | Retention wired to all backends | partial | P0 | Redis-native TTL optional; cross-tier parity docs |
| WANT-036 | Memory abstraction fully defined | partial | P1 | Structured/object store persistence beyond in-process |
| WANT-037 | Full observability event taxonomy + trace continuity | partial | P0 | Automated proof vs `docs/SPEC/18_Observability_Spec.md` |
| WANT-040 | Audit hash chain atomicity | partial | P1 | fsync/crash-byte policy if required |
| WANT-042 | Trace sampling, alert drills, eval baselines | partial | P1 | Run staging drills; expand eval dataset |
| WANT-048 | Contracts match runtime (external errors in OpenAPI) | partial | P0 | Harmonize middleware 408/499 plain JSON or document as-built |
| WANT-049 | Async semantics complete where exposed | partial | P1 | Cross-replica idempotency if required; optional `ResponseEnvelope.mode` |
| WANT-053 | Rollout/harness gates on runtime paths | partial | P0 | L2-99 process + harness evidence |
| WANT-055 | Critical module test coverage | partial | P1 | Per gaps report critical paths |
| WANT-056 | No stub engines on production paths | partial | P0 | Real engines when providers/tools enabled |
| WANT-059 | Every request traceable | partial | P0 | Prove completeness vs SPEC 18 |
| WANT-060 | Safe degradation on dependency failure | partial | P1 | Broader bounded-fallback coverage |

**Expansion backlog (not yet split into rows):** mine additional WANT items from `docs/SPEC/02`, `04`, `07`, `15`–`17`, `19`, `20`, `22` (see Architecture §18).

---

## 3. Doc/runtime gap register (`GAP-xxx`)

Former `docs/PLANS/SOW-Documentation-Implementation-Gap-Closure.md`. Closed items omitted; **Partial** and open only.

| ID | Severity | Summary | Status | Required outcome |
|----|----------|---------|--------|------------------|
| GAP-AUTH-003 | Medium | Production auth boundary — any “presence only” paths | partial | Re-verify vs `docs/SPEC/04`; close remaining gaps |
| GAP-API-001 | Medium | Async contract vs sync `POST /v1/query` | partial | Optional cross-replica idempotency; product decision on `ResponseEnvelope.mode` |
| GAP-API-002 | Medium | All client error shapes in OpenAPI/SPEC 02 | partial | Keep OpenAPI in sync; optional full `ResponseEnvelope` on errors |
| GAP-MODEL-001 | High | Production provider config; stub still default without config | done | Bootstrap fail-fast + registry routing (PR-002, 2026-05-20); query path uses `createProviderBackedModelGateway` when configured |
| GAP-MODEL-002 | Medium | Capability + scope routing E2E | partial | Provider config in schema + integration proof; optional live E2E |
| GAP-TOOL-001 | Medium | Real tool execution in production | partial | Enable `ExecutableToolGateway` under policy |
| GAP-TOOL-002 | Medium | Sandbox + identity (implemented) | partial | Integration tests for sandbox enforcement |
| GAP-BUDGET-001 | Medium | Deadline/cost on non-workflow paths | partial | Audit all pipeline entrypoints |
| GAP-BUDGET-002 | Medium | All flags use dynamic resolution | partial | Bootstrap/preflight/emitter static reads if overrides required |
| GAP-BUDGET-003 | Medium | Tenant cost durable/shared | partial | Prefer Postgres/Redis in multi-instance future |
| GAP-MEM-001 | Medium | Retrieval timeout/context caps vs SPEC | partial | Token caps vs SPEC 17 |
| GAP-MEM-002 | High | Vector/persistent retrieval for production | open | Chroma/pgvector/Redis vector; not in-memory lexical default |
| GAP-MEM-003 | Medium | Retention in default store path | partial | Wire `memoryRetention` everywhere |
| GAP-MEM-004 | Medium | Bounded ingest chunks | partial | Hard caps in `in-memory-store` / all stores |
| GAP-OBS-002 | Medium | Long-run memory bounded under load | partial | Tune metric/emitter caps in prod |
| GAP-DOC-001 | Medium | Plans say “complete” while stubs remain | open | **This file** replaces scattered checklists |
| GAP-DOC-002 | Medium | Flag naming drift in old docs | open | Use `platform_production_rollout_enabled` everywhere |

---

## 4. Code stubs, placeholders, and unfinished logic

| ID | Location | Description | Status | Priority | Action |
|----|----------|-------------|--------|----------|--------|
| STUB-001 | `src/security/secret-scope.ts` | Stub secrets: redacted placeholder only | done | P0 | PR-005: pluggable backends; stub dev-only |
| STUB-002 | `src/gateways/model-gateway.ts` | `StubModelGateway` / `defaultModel: "stub"` for dev | partial | P0 | Prod must use `openai_compatible` |
| STUB-003 | `src/memory/default-store.ts` | Embedding `provider: "gateway"` not implemented; hash fallback | open | P0 | Model-gateway embedding path |
| STUB-004 | `src/memory/in-memory-store.ts` | Text match placeholder, no real embedding | open | P1 | Dev/test only in prod |
| STUB-005 | `src/gateways/tool-gateway.ts` | `StubAllowedToolGateway`; deny/stub mode default | partial | P0 | Policy-gated real execution |
| STUB-006 | `src/gateways/tool-gateway.ts` | `Tool '…' is not implemented` for unknown tools | open | P1 | Tool registry expansion |
| STUB-007 | `src/controlplane/stub-policy.ts` | MVP stub policy (default allow chat) | partial | P1 | Production policy profiles |
| STUB-008 | `src/engines/*` | `createStub*Engine()` for execution/synthesis/planning/condensing | partial | P1 | OK in tests; prod uses real engines via registry |
| STUB-009 | `src/ingress/types.ts`, `src/pipelines/types.ts`, `src/brainstem/types.ts` | Interface comments say “Stub” | open | P2 | Refresh comments to match implementations |
| STUB-010 | `src/pipelines/types.ts` | Pipeline execute described as stub | open | P2 | Verify vs actual pipeline runners |
| STUB-011 | `k8s/base/secret.yaml` | Placeholder secret values | open | P0 | Replace before deploy |
| STUB-012 | `terraform/modules/ai-server/main.tf` | ACM cert placeholder (manual validation) | open | P2 | Ops: complete cert workflow |

**Intentional dev/test stubs (do not remove):** `stub` / `framed_echo` provider kinds in `config/schema.ts`; `StubAllowedToolGateway` in tests; engine stub factories in `*.test.ts`.

---

## 5. Gateway, memory, HTTP, and workflow hardening

| ID | Task | Status | Priority | Key files |
|----|------|--------|----------|-----------|
| PR-100 | Model: fallback provider, circuit breaker tuning, cost per call | partial | P1 | `model-gateway.ts` |
| PR-101 | Tool: allowlist enforcement, execution timeouts in prod | partial | P0 | `tool-gateway.ts` |
| PR-102 | Memory: Chroma backend (product target) + integration tests | open | P0 | `L2-Chroma-Vector-Backend-Implementation.md`, `it.skipIf` chroma test |
| PR-103 | Memory: backup/recovery strategy documented | open | P1 | Ops runbook |
| PR-104 | HTTP: CORS, compression, Keep-Alive, backpressure 503 | open | P1 | `server/middleware.ts` |
| PR-105 | Workflow: decision step — **implemented**; verify integration coverage | partial | P2 | `workflows/runner.ts` |
| PR-106 | Config hot reload without restart | open | P2 | `config/schema.ts` |
| PR-107 | Feature flag change audit logging | open | P2 | admin flags paths |
| PR-108 | Real secrets rotation policy + access audit | open | P1 | `secret-scope.ts` |

---

## 6. Testing and quality

| ID | Task | Status | Priority | Notes |
|----|------|--------|----------|-------|
| QA-001 | `npm run verify:sow` green on main | done | P0 | Same verification as PR-024 (2026-05-20) |
| QA-002 | Staging canary: `/healthz`, `/readyz`, `/v1/version`, `/metrics` | open | P0 | |
| QA-003 | SLO/error/cost vs staging baseline | open | P0 | |
| QA-004 | Unit tests: `default-store`, `memory-gateway` (if still missing coverage) | partial | P1 | Agent 5 added many; re-verify |
| QA-005 | Unit tests: `stub-policy`, `policy-input`, `middleware`, `rollout` | open | P2 | Cleanup checklist §3.2 |
| QA-006 | Load/chaos + contract compatibility suites in CI | partial | P1 | `src/testing/*.test.ts` |
| QA-007 | Chroma integration test when `CHROMA_URL` set | open | P1 | `it.skipIf(!process.env.CHROMA_URL)` |
| QA-008 | Engine guardrail: no engine imports engine | open | P2 | `engine-architecture-invariants.test.ts` |
| QA-009 | Expand eval baseline (retrieval, multimodal) | open | P1 | `src/eval/baseline.json` |
| QA-010 | Alert simulation drill in staging | blocked | P1 | Blocked on telemetry stack |

---

## 7. Documentation and parity

| ID | Task | Status | Priority | Notes |
|----|------|--------|----------|-------|
| DOC-001 | `openapi.yaml` ↔ `routes.ts` ↔ `docs/SPEC/02_API_Contracts.md` | partial | P0 | Ongoing |
| DOC-002 | `docs/SPEC/20` ↔ `src/config/schema.ts` flag matrix | partial | P0 | |
| DOC-003 | Refresh `Production-Readiness-Gaps-Report.md` §9 stale bullets | open | P1 | D-004–D-008 from discrepancy register |
| DOC-004 | Populate `docs/CURRENT/As-Built-Snapshot.md` after `verify:sow` | partial | P1 | |
| DOC-005 | Populate `docs/CURRENT/Config-Flags-Inventory.md` | open | P2 | |
| DOC-006 | Publish OpenAPI docs + SDK note | open | P2 | |
| DOC-007 | Centralize logging abstraction (optional) | open | P2 | |
| DOC-008 | SPEC 22 runbook index complete | open | P2 | |
| DOC-009 | Grep obsolete phrases (“sync-only”, “no /token/exchange”) | open | P2 | |
| DOC-010 | Update references to point at **`to-do.md`** (this file) | partial | P0 | Post-consolidation |

**Code–docs discrepancy actions (from register):**

| ID | Action | Priority |
|----|--------|----------|
| D-001 | Clarify sync `POST /v1/query` vs `/v1/query/async` in all docs | P1 |
| D-003 | Keep gap narrative aligned with code (use GAP-xxx above) | P1 |
| D-004–D-008 | Fix gaps report §9.1/9.3/9.8/9.10 to match implemented behavior | P1 |

---

## 8. Operations and deployment checklist

From `scripts/README.md` and deployment guide.

| ID | Task | Status | Priority |
|----|------|--------|----------|
| OPS-001 | HTTPS / TLS certificates | open | P0 |
| OPS-002 | Log rotation `/var/log/ai-server` | open | P0 |
| OPS-003 | Backup script → S3/object storage | open | P1 |
| OPS-004 | Configure canary/rollback/health alerts (Grafana/Prometheus) | open | P1 |
| OPS-005 | Protect `/metrics`, `/healthz`, `/readyz` at network edge if no bearer | open | P0 |
| OPS-006 | L2-99 evidence dimensions: security, policy, observability, reliability, ops, governance | done | P1 | `docs/PLANS/implementation/L2-99_Evidence-Checklist.md` + `DEFAULT_HARNESS_EVIDENCE` in `harness-readiness.ts` (2026-05-20) |
| OPS-007 | Post-launch week 1–2 monitoring plan | open | P1 |

---

## 9. Optional / post-launch (Phase 12)

| ID | Task | Priority |
|----|------|----------|
| OPT-001 | Async job queue hardening + cross-replica idempotency | P2 |
| OPT-002 | Streaming response support | P2 |
| OPT-003 | Predictive canary analysis | P2 |
| OPT-004 | GDPR right-to-be-forgotten workflows | P2 |
| OPT-005 | SOC 2 evidence collection | P2 |
| OPT-006 | Data residency controls | P2 |

---

## 10. Master delivery phases (sequencing)

Former `docs/PLANS/00_Master-Delivery-Plan.md` — unchecked phase tasks:

| Task ID | Description | Status | Priority |
|---------|-------------|--------|----------|
| P0-01 | Publish plan order, owners, inter-plan dependencies | open | P2 |
| P0-02 | Cross-plan gate criteria and acceptance matrix | open | P2 |
| P0-03 | Approve deferred harness gate criteria | done | P1 | Frozen in `src/governance/scorecard.ts` `DEFAULT_THRESHOLDS` + L2-99 evidence checklist (2026-05-20) |
| P1-03 | Publish MVP readiness report | open | P2 |
| P2-02 | Validate security controls; audit artifacts | open | P0 |
| P2-03 | Enable quality gates for regressions | partial | P1 |
| P3-01 | Performance/load tests; publish bottlenecks | open | P1 |
| P3-02 | Top latency/cost optimizations | open | P1 |
| P3-03 | Production capacity thresholds | open | P1 |
| P4-01 | Rollback drill + incident drill | done | P0 | PR-031 rollback + PR-032 incident drills in CI (2026-05-20) |
| P4-02 | Post-launch metrics review | open | P1 |
| P4-03 | Go/No-Go for Plan 99 harness kickoff | done | P1 | PR-034 harness readiness decision record + templates (2026-05-20) |
| MDP-001–004 | Portfolio hygiene tasks | open | P2 |

**L2 implementation plans** (`docs/PLANS/implementation/L2-*.md`) remain the how-to source for each layer; track completion here via PR/GAP/WANT IDs.

---

## Consolidated sources

The following task/backlog/checklist files were **merged into this file and removed** (2026-05-20):

| Removed file | Content migrated to |
|--------------|---------------------|
| `Production-Readiness-Complete-Checklist.md` | §1, §5, §6, §9 |
| `docs/PLANS/Cleanup-and-Finalization-Checklist.md` | §6, §7 |
| `docs/TARGET/Target-State-Backlog.md` | §2 (+ product decisions summary) |
| `docs/PLANS/SOW-Documentation-Implementation-Gap-Closure.md` | §3 |
| `docs/PLANS/00_Master-Delivery-Plan.md` | §10 |
| `docs/PLANS/implementation/L2-99_Evidence-Checklist.md` | OPS-006 |
| `docs/PLANS/implementation/L2-04_Gate-Report-and-Known-Gaps.md` | QA-009, QA-010, §6 |
| `docs/TARGET/Documentation-Finalization-Plan.md` | §7 |
| `docs/TARGET/Code-Docs-Parity-Audit-Plan.md` | §7 |
| `docs/CURRENT/Known-Deltas.md` | §2, §3 |
| `Agent-5-Handoff.md` | §6 (tests/docs delivered); PR-024 |

**Retained (reference, not task registers):** `docs/OPERATIONS/Production-Readiness-Gaps-Report.md`, `docs/OPERATIONS/Production-Readiness-Go-No-Go-Summary.md`, `docs/PLANS/Scope-of-Work.md`, `docs/TARGET/Code-Docs-Discrepancy-Register.md`, L2 implementation plans, runbooks.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-20 | Initial consolidation from repo-wide scan and legacy checklist/backlog/gap docs |
