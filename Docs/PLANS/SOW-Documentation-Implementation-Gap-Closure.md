# SOW - Documentation vs Implementation Gap Closure

## 0) Document Control

| Field | Value |
|---|---|
| Document | Documentation-to-Implementation Gap Closure SOW |
| Repository | `ai-server` |
| Date | 2026-03-02 |
| Prepared by | Coding agent |
| Primary Inputs | `docs/SPEC/00-22`, `docs/PLANS/Scope-of-Work.md`, `docs/PLANS/00_Master-Delivery-Plan.md`, `docs/OPERATIONS/Production-Readiness-Gaps-Report.md`, `src/**` |
| Parity audit | [`docs/TARGET/Code-Docs-Discrepancy-Register.md`](../TARGET/Code-Docs-Discrepancy-Register.md) — row-level code vs doc findings (2026-03-24) |
| Objective | Close production-impacting gaps between documented target behavior and current runtime behavior |
| Success Definition | Documentation and runtime behavior align for identity, governance, execution, observability, memory, and operations |

---

## 1) Purpose and Scope

This SOW defines the remaining work to align the documented architecture/operations target with the implemented codebase.

### In Scope

- Security and identity trust-boundary closure.
- Runtime and contract behavior alignment (sync/async/idempotency/doc contract fields).
- Model/tool/memory production-path hardening.
- Workflow and budget enforcement closure.
- Observability, audit, and ops hardening.
- Documentation reconciliation to remove contradictory "complete" claims.

### Out of Scope

- New product workflows unrelated to documented target-state parity.
- UI/dashboard implementation (explicitly deferred in repo docs).
- Provider-specific commercial negotiations or platform procurement.

---

## 2) Assessment Method

- Compared requirements in `docs/SPEC/*` and plan docs against actual implementation paths in `src/server`, `src/controlplane`, `src/workflows`, `src/gateways`, `src/memory`, `src/observability`, and `src/security`.
- Prioritized gaps by production impact: security boundary, correctness, availability, and operational risk.
- Treated "current-state notes" in docs as acknowledged deltas, but still included them in execution backlog where runtime remains incomplete.

---

## 3) Executive Summary

### Open Gaps (Current) - Post Agent 3 Updates (2026-03-06)

- **2026-03-24 parity pass:** Several items below were overstated vs code — **token exchange**, **caller strict-match**, **query rate limits**, and **dependency-aware health** are implemented; see [`Code-Docs-Discrepancy-Register.md`](../TARGET/Code-Docs-Discrepancy-Register.md) and updated gap rows §4.
- **2026-03-24 follow-on:** Audit/event file sinks use **async queued `appendFile`** (not sync); **production** validates sink parent dir + file writability at bootstrap; optional **`AUDIT_LOG_FSYNC`** / **`OBSERVABILITY_EVENT_SINK_FSYNC`** for per-append durability.
- **Critical:** Residual identity/auth edge cases (`GAP-AUTH-003`), stub model gateway when provider not configured.
- **High:** Tool execution defaults, workflow policy/catalog misalignment, async **contract** vs **`POST /v1/query`** sync `mode` where product expects otherwise.
- **Medium:** Memory retrieval context caps, in-memory-only defaults, flag-to-runtime drift for niche paths.

### Closed/Reduced by Agent 3 (2026-03-06)

- **Workflow:** Decision step semantics implemented with branch conditions. Cycle detection and dependency validation at registration. Central `stop_conditions` enforcement (`max_iterations`, `deadline_ms`, `cost_budget_usd`).
- **Model Gateway:** Circuit breaker pattern, provider health checks, fallback provider mechanism, capability taxonomy (chat/classification/vision/embedding/code/summarization/extraction/reasoning).
- **Tool Gateway:** Caller identity context (org_id, app_id, user_id, session_id, roles, trace_id) passed through tool invocations. Sandbox controls enforce timeout/network/filesystem.
- **Budget:** Deadline and cost budget enforcement in workflow runner with accumulated cost tracking.
- **Evaluation/Classification:** Production-ready engines with model-based and heuristic evaluation.

### Validated as Already Closed (No New Work Needed Here)

- `PORT` validation and graceful shutdown are implemented in `src/server/index.ts`.
- TLS fail-closed behavior is implemented when TLS is configured but invalid in `src/server/index.ts`.
- Request read timeout and aborted request handling are implemented in `src/server/middleware.ts`.
- Tenant usage record failures are fail-soft (emit error event, do not fail response) in `src/server/query-handler.ts`.
- `AUDIT_LOG_PATH` and `OBSERVABILITY_EVENT_SINK_PATH` are now schema-backed in `src/config/schema.ts`.

---

## 4) Gap Register (Authoritative Backlog)

| Gap ID | Severity | Documentation Expectation | Current Implementation Evidence | Required Outcome |
|---|---|---|---|---|
| GAP-AUTH-001 | ~~Critical~~ **Closed** | `POST /token/exchange` trust boundary exists (`docs/SPEC/02`, `04`, `19`) | **Implemented:** `POST /token/exchange` in `src/server/routes.ts` (see also `src/server/auth.ts`) — **verified 2026-03-24** | ~~Implement token exchange~~ **DONE** |
| GAP-AUTH-002 | ~~Critical~~ **Closed** | Caller context derived from verified claims (`docs/SPEC/02`, `04`, `07`, `19`) | **`validateIngress`** enforces **`assertCallerStrictMatch`** when `verifiedCallerContext` is supplied (`src/ingress/validate.ts`) — **verified 2026-03-24** | ~~Bind caller context~~ **DONE** (keep monitoring edge cases) |
| GAP-AUTH-003 | ~~High~~ **Medium** | Production auth boundary with deterministic deny (`docs/SPEC/04`, `19`) | **Partial:** AI JWT verification and query path wiring exist (`auth.ts`, `routes.ts`); `requireAuthHeader` remains an ingress option — re-verify against SPEC 04 for any remaining “presence only” paths | Close any remaining production gaps per SPEC 04 |
| GAP-AUTH-004 | ~~High~~ **Closed** | Deterministic 429 rate limit/quota behavior (`docs/SPEC/04`, `02`) | **`checkQueryRateLimitAsync`** on `/v1/query` and `/v1/query/async` (`src/server/routes.ts`) — **verified 2026-03-24** | ~~Add ingress rate limiting~~ **DONE** (tune config/backends) |
| GAP-API-001 | ~~High~~ **Partial** | Async mode only when lifecycle exists (`docs/SPEC/02`, `13`) | **HTTP async jobs** when `JobQueueService` configured: `/v1/query/async`, `/v1/jobs*`. **`POST /v1/query`** still **`mode: "sync"`**. Optional **`Idempotency-Key`** on **`POST /v1/query/async`** (in-process dedupe; SPEC 02 + OpenAPI) — **2026-03-24** | Optional: cross-replica idempotency store; future **`ResponseEnvelope.mode`** if product needs it |
| GAP-API-002 | ~~High~~ **Partial** | API fields documented must match runtime (`docs/SPEC/02`) | **Ingress + success envelopes:** Zod **`RequestEnvelopeSchema`** / **`ResponseEnvelopeSchema`**, **`openapi.yaml`**, SPEC 02 aligned **2026-03-24**. **Remaining:** some **error** bodies (e.g. middleware `408`/`499`, MVP 404 plain JSON) are not full `ResponseEnvelope` — document as-as-built or narrow over time | Keep OpenAPI/SPEC 02 in sync with `routes.ts` / `query-handler.ts`; optional error-envelope harmonization |
| GAP-MODEL-001 | ~~Critical~~ High | Provider-backed model gateway (`docs/SPEC/15`) | **Partially implemented** (Agent 3, 2026-03-06): Circuit breaker, health checks, fallback provider added to `src/gateways/model-gateway.ts`. `OpenAiCompatibleModelGateway` exists for real providers. `StubModelGateway` still default in query handler pending production config | Wire production provider config and retire stub default |
| GAP-MODEL-002 | ~~High~~ Medium | Capability + scope model selection (`docs/SPEC/15`) | **Implemented** (Agent 3, 2026-03-06): `CAPABILITY_TAXONOMY` added with chat, classification, vision, embedding, code, summarization, extraction, reasoning capabilities. `resolveModelRoute()` exists for scope-based routing | Add provider config in schema and verify end-to-end |
| GAP-TOOL-001 | ~~High~~ Medium | Real side-effecting tool execution under policy (`docs/SPEC/16`) | **Partially implemented**: `ExecutableToolGateway` exists with `web_search`, `file_write_preview`, `stub_tool`. **Still uses** `StubAllowedToolGateway` in query path pending production enablement | Enable `ExecutableToolGateway` in production configuration |
| GAP-TOOL-002 | ~~High~~ Medium | Sandbox controls enforce timeout/network/fs and identity attribution (`docs/SPEC/16`, `19`) | **Implemented** (Agent 3, 2026-03-06): `AllowlistToolGateway` enforces `timeout_ms`, `network_access`, `filesystem_access`. Tool metadata `requires_network`/`requires_filesystem` checked. **Caller identity** passed from `tool_engine.ts` with org_id, app_id, user_id, session_id, roles, trace_id | Verify sandbox enforcement in integration tests |
| GAP-POLICY-001 | ~~High~~ **Closed** | Policy allowlist synchronized with workflow catalog (`docs/SPEC/07`, `14`) | **`evaluatePolicy`** uses **`listRegisteredWorkflowIds()`** for `allowed_pipelines` (`policy-evaluator.ts`) — **verified 2026-03-24** | ~~Align allowlist~~ **DONE**; monitor router selection coverage |
| GAP-WORKFLOW-001 | ~~High~~ Closed | Decision steps supported (`docs/SPEC/14`) | ~~`decision` step is no-op~~ **Implemented** (Agent 3, 2026-03-06): Decision step branching with condition evaluation (`score > 0.8`, `passed == true`, etc.) in `src/workflows/runner.ts` | ~~Implement decision-step semantics~~ **COMPLETE** |
| GAP-WORKFLOW-002 | ~~High~~ Closed | Invalid dependency refs and cycles rejected (`docs/SPEC/10`, `14`) | ~~`sortSteps` returns partial order without hard failure~~ **Implemented** (Agent 3, 2026-03-06): DFS-based cycle detection and dependency validation in `WorkflowDefinitionSchema` at registration time | ~~Add graph validation~~ **COMPLETE** |
| GAP-WORKFLOW-003 | ~~High~~ Closed | Central `stop_conditions` enforcement (`docs/SPEC/10`, `14`) | ~~`max_iterations`/`deadline_ms` not centrally enforced~~ **Implemented** (Agent 3, 2026-03-06): `runWorkflow()` enforces `max_iterations`, `deadline_ms`, and `cost_budget_usd` centrally with accumulated cost tracking | ~~Enforce global stop conditions~~ **COMPLETE** |
| GAP-BUDGET-001 | ~~High~~ Medium | Runtime enforces deadline and cost budgets (`docs/SPEC/06`, `09`) | **Implemented** (Agent 3, 2026-03-06): `runWorkflow()` in `src/workflows/runner.ts` enforces `deadline_ms`, `max_iterations`, and `cost_budget_usd` with real-time accumulated cost tracking. **Still needs** enforcement in non-workflow paths | Verify budget enforcement across all pipeline paths |
| GAP-BUDGET-002 | ~~Medium~~ **Partial** | Flags map to behavior (`docs/SPEC/20`) | **2026-03-24:** Matrix in **`docs/SPEC/20_Config_and_FeatureFlags.md`**; **`resolveFeatureFlagEnabled`** used on query/routes/policy/coding-agent paths per matrix. **Remaining static:** bootstrap/preflight + `server/index.ts` emitter where SPEC 20 notes | Tighten any remaining static reads if admin overrides must apply there |
| GAP-BUDGET-003 | Medium | Tenant cost controls durable/shared (`docs/SPEC/09`) | Process-local usage map in `src/controlplane/tenant-budget.ts` | Move tenant budget accounting to shared durable backend |
| GAP-MEM-001 | ~~High~~ **Partial** | Retrieval timeout and bounded context (`docs/SPEC/17`) | **`runRetrieval`** uses **`retrieval_timeout_ms`** / `withTimeoutOrDegraded` (`retrieval-service.ts`) — **verified 2026-03-24** | Tighten max context / token caps vs SPEC if still short |
| GAP-MEM-002 | High | Persistent/vector retrieval for production (`docs/SPEC/17`) | Default in-memory lexical store in `src/memory/default-store.ts` and `src/memory/in-memory-store.ts` | Add production store adapter and embedding/vector retrieval path |
| GAP-MEM-003 | Medium | Config retention is runtime enforced (`docs/SPEC/17`, `20`) | `memoryRetention` parsed but not wired into default store creation | Apply retention config in store construction path |
| GAP-MEM-004 | Medium | Bounded ingestion behavior (`docs/SPEC/17`) | No per-ingest chunk cap in `src/memory/in-memory-store.ts` | Add hard ingest caps and reject/trim behavior |
| GAP-OBS-001 | ~~Medium~~ **Closed** | Non-blocking bounded sinks (`docs/SPEC/18`, `22`) | **`createFileEventSink`** / **`createFileAuditSink`**: async **`appendFile`**, bounded queues, rotation, backpressure — **verified 2026-03-24** | ~~Replace sync sinks~~ **DONE** (optional `*_FSYNC` env for durability) |
| GAP-OBS-002 | ~~Medium~~ **Partial** | Bounded long-running memory usage (`docs/SPEC/18`) | Metrics/emitter use **series caps**, capture ring, Prometheus drop counters (`metrics.ts`, `emitter.ts`) — **2026-03-24** | Monitor cardinality under load; tune caps |
| GAP-SEC-001 | ~~Medium~~ **Closed** | Integrity-preserving audit writes under concurrency (`docs/SPEC/19`) | **`writeAuditEventAsync`** + lock; **`verifyAuditLogFileIntegrity`** for on-disk JSONL — **2026-03-24** | ~~Single-writer~~ **DONE** (optional fsync + ops verify) |
| GAP-OPS-001 | ~~Medium~~ **Closed** | Dependency-aware readiness (`docs/SPEC/22`) | **`checkOperationalDependenciesAsync`** drives `/healthz` and `/readyz` with **503** when unhealthy/not ready — **verified 2026-03-24** | ~~Add dependency probes~~ **DONE** (configure `DependenciesConfig`) |
| GAP-OPS-002 | ~~Medium~~ **Closed** | Production endpoint protection is enforced (`docs/SPEC/04`, `22`) | **`bootstrap()`** throws if **`NODE_ENV=production`** and **`OPERATIONAL_BEARER_TOKEN`** unset; `isOperationalAccessAllowed` then always requires matching Bearer on `/healthz`, `/readyz`, `/metrics`, `/admin/*`, etc. — **verified 2026-03-24** | ~~Fail-fast production~~ **DONE** (dev/staging may omit token → routes allow per `routes.ts`) |
| GAP-DOC-001 | Medium | Plan status reflects runtime truth | `docs/PLANS/Scope-of-Work.md` and `docs/PLANS/00_Master-Delivery-Plan.md` contain "complete" language while critical runtime stubs remain | Update plan status and checklists to distinguish implemented vs production-ready |
| GAP-DOC-002 | Medium | Config/flag naming consistency | Master plan references `platform.master_rollout_enabled`; runtime uses `platform_production_rollout_enabled` (`src/config/schema.ts`) | Normalize naming and references across docs and code |

---

## 5) Work Packages and Execution Plan

## WP-1 Identity and Trust Boundary (Critical Path)

**Covers:** `GAP-AUTH-001` to `GAP-AUTH-004` (operational bearer: **`GAP-OPS-002` closed** — production bootstrap)  
**Objective:** Enforce production-grade identity, caller binding, and ingress controls.

> **2026-03-24 audit:** `/token/exchange`, caller strict-match when verified context is present, and ingress rate limiting on query routes are **implemented**; see gap register rows for `GAP-AUTH-001`–`004`. **`GAP-OPS-002` closed:** production requires operational bearer. Remaining: **`GAP-AUTH-003`** nuances.

- Implement `/token/exchange` endpoint and AI JWT minting flow.
- Add IdP/app registry for issuer, JWKS, audience, and claim mapping.
- Derive caller context from verified claims; reject body/claim mismatch.
- Require AI JWT on `/v1/query` in production profile.
- Add deterministic ingress rate limiting returning `RATE_LIMITED`.
- ~~Add production bootstrap guard~~ **Done** — `OPERATIONAL_BEARER_TOKEN` required in production (`bootstrap/index.ts`).

**Exit Criteria**

- `/token/exchange` exists with integration tests for valid/invalid flows.
- `/v1/query` caller context is claim-derived only.
- Invalid token/issuer/scope/audience requests fail closed.
- Rate-limited requests consistently return 429 with structured error.

---

## WP-2 API Contract and Runtime Semantics Alignment

**Covers:** `GAP-API-001`, `GAP-API-002`  
**Objective:** Remove contract drift and make runtime semantics explicit.

- Make an explicit product decision:
  - **Path A:** finish async/idempotency semantics to match contracts (HTTP job API exists when queue is configured; **`POST /v1/query`** remains sync with `mode: "sync"`), or
  - **Path B:** narrow contracts/docs to as-built (sync query + optional job API).
- Align `RequestEnvelope` and `ResponseEnvelope` fields with documented spec.
- Ensure telemetry contract fields are either implemented or removed from docs.

**Exit Criteria**

- No contract fields are "paper-only."
- Integration tests cover chosen sync/async semantics and idempotency behavior.
- Docs and schemas are internally consistent.

---

## WP-3 Model and Tool Gateway Productionization

**Covers:** `GAP-MODEL-001`, `GAP-MODEL-002`, `GAP-TOOL-001`, `GAP-TOOL-002`  
**Status:** ~~Not Started~~ **Partially Complete** (Agent 3, 2026-03-06)  
**Objective:** Replace stubs in execution-critical gateways.

- ~~Implement provider-backed model gateway adapters~~ **Exists**: `OpenAiCompatibleModelGateway` in `src/gateways/model-gateway.ts`. **Added by Agent 3**: Circuit breaker, health checks, fallback provider, capability taxonomy.
- ~~Add model registry by capability~~ **COMPLETE** (Agent 3): `CAPABILITY_TAXONOMY` with 8 capability types (chat, classification, vision, embedding, code, summarization, extraction, reasoning).
- ~~Replace `StubAllowedToolGateway`~~ **Partial**: `ExecutableToolGateway` exists. Still need to enable in production config.
- ~~Enforce sandbox controls~~ **COMPLETE** (Agent 3): Timeout, network, filesystem controls in `AllowlistToolGateway`.
- ~~Add caller identity context~~ **COMPLETE** (Agent 3): Full identity (org_id, app_id, user_id, session_id, roles, trace_id) passed from `tool_engine.ts`.

**Exit Criteria**

- Query path no longer hardwires stub model/tool delegates. **Still needed**.
- ~~Tool execution path is policy allowlisted and sandbox-enforced.~~ **COMPLETE**.
- Integration tests verify deny, timeout, and side-effect control behavior. **Still needed**.

---

## WP-4 Governance, Workflow, and Budget Enforcement

**Covers:** `GAP-POLICY-001`, `GAP-WORKFLOW-001` to `003`, `GAP-BUDGET-001` to `003`  
**Objective:** Make control-plane guarantees enforceable and complete.

- Align policy allowed workflows with registered workflow catalog (or intentionally remove deferred workflows).
- Add workflow DAG validation (unknown deps + cycle detection) at registration/load.
- Implement `decision` step handling or reject workflows containing it.
- Enforce `stop_conditions` centrally in runner (`max_iterations`, `deadline_ms`).
- Enforce cost budgets and unify deadline enforcement across all pipeline paths.
- Move tenant budget accounting to shared backend.
- Wire or retire parse-only flags.

**Exit Criteria**

- Invalid workflows fail fast before execution.
- All configured budgets are enforced during runtime.
- Policy/workflow catalog drift tests exist and pass.

---

## WP-5 Memory and Retrieval Production Hardening

**Covers:** `GAP-MEM-001` to `GAP-MEM-004`  
**Objective:** Make memory behavior bounded, configurable, and production-capable.

- Add retrieval timeout wrapper and deterministic degraded fallback.
- Add context-size truncation/token budgeting for retrieval context.
- Wire `memoryRetention` config to default store/gateway creation.
- Add per-ingest chunk caps and rejection/truncation policy.
- Add production vector store adapter path and embedding retrieval.

**Exit Criteria**

- Retrieval cannot hang request path.
- Context and ingest are bounded by explicit limits.
- Production memory backend is pluggable and tested.

---

## WP-6 Observability, Audit, and Operations Hardening

**Covers:** `GAP-OBS-001`, `GAP-OBS-002`, `GAP-SEC-001`, `GAP-OPS-001`  
**Objective:** Remove operational fragility and unbounded growth paths.

> **2026-03-24:** Async queued file sinks + rotation/backpressure are **implemented**; audit hash-chain uses **async lock** + optional **`verifyAuditLogFileIntegrity`** / **`AUDIT_LOG_FSYNC`**; metrics/emitter use **caps**; **`/healthz`/`/readyz`** dependency checks **implemented** (`GAP-OPS-001` closed). Remaining: tune caps under load, optional stricter sink durability policy.

- ~~Replace sync sink writes~~ **Done** — async `appendFile` queues; optional `*_FSYNC` env vars.
- Bounded in-memory metric/capture policies — **largely done**; continue tuning.
- Audit integrity — **done** for in-process + on-disk verify helper; optional fsync.
- Dependency checks — **done**.

**Exit Criteria**

- Sink writes are non-blocking under normal operations (**met**; optional fsync mode excepted).
- Long-running process memory growth is bounded (**partially met** — monitor).
- Readiness accurately reflects dependency health (**met**).

---

## WP-7 Documentation Reconciliation and Governance

**Covers:** `GAP-DOC-001`, `GAP-DOC-002`  
**Objective:** Ensure docs describe reality and target-state deltas clearly.

- Update plan docs to separate "implemented" from "production-ready."
- Correct feature-flag naming inconsistencies across plans/specs/runtime.
- Update spec notes where runtime has already closed prior gaps.
- Add a single canonical "target vs current" matrix and maintain it per release.

**Exit Criteria**

- No contradictory completion claims across `docs/PLANS` and `docs/SPEC`.
- All referenced flag names and endpoints match runtime implementation.

---

## 6) Dependency Order and Suggested Phasing

1. **Phase 1:** WP-1 (Identity/Trust boundary)  
2. **Phase 2:** WP-2 (Contract alignment decision and implementation)  
3. **Phase 3:** WP-3 (Model/tool productionization)  
4. **Phase 4:** WP-4 (Workflow/governance enforcement)  
5. **Phase 5:** WP-5 (Memory hardening)  
6. **Phase 6:** WP-6 (Observability/audit/ops hardening)  
7. **Phase 7:** WP-7 (Documentation reconciliation)  

**Relative Effort (T-shirt sizing):**

- WP-1: L
- WP-2: M-L (depends on async decision)
- WP-3: L
- WP-4: M-L
- WP-5: M-L
- WP-6: M
- WP-7: S-M

---

## 7) Test and Verification Requirements

For each work package:

- `npm run build`
- `npm run test`
- `npm run verify:sow`

Additional required coverage:

- **Auth tests:** token exchange, caller binding mismatch, issuer/audience/scope failures.
- **Contract tests:** schema and runtime behavior parity (sync/async decision path).
- **Workflow tests:** cycle detection, invalid deps, decision-step semantics, stop conditions.
- **Budget tests:** token, cost, deadline, tenant cap behavior under load and failure.
- **Memory tests:** retrieval timeout fallback, context truncation, ingest cap enforcement.
- **Ops tests:** readiness dependency failure returns 503; sink backpressure/degradation behavior.

---

## 8) Acceptance Criteria (Program-Level)

- No production path depends on stub-only model/tool execution.
- Caller context is cryptographically bound and cannot be body-spoofed.
- Documented API contract fields and runtime semantics are consistent.
- Workflow runtime enforces graph validity and stop conditions.
- Budget dimensions (token, cost, deadline, tool) are enforced, observable, and tested.
- Memory retrieval and ingestion are bounded and configurable.
- Observability/audit sinks are non-blocking and operationally safe.
- Docs no longer claim completion for unresolved critical/high gaps.

---

## 9) Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Async lifecycle scope expansion | Delays alignment | Decide sync-only vs async lifecycle early in WP-2 |
| Auth migration breaks existing clients | Adoption friction | Support staged migration with clear compatibility window |
| Provider/tool integration complexity | Runtime instability | Add canary rollout and strict feature gating |
| Shared tenant budget backend outage | Request deny spikes | Fail-soft usage recording, fail-closed only where policy requires |
| Documentation drift reappears | Regressed clarity | Add release-gate checklist requiring doc/runtime parity review |

---

## 10) Deliverables

- Updated runtime modules in `src/server`, `src/ingress`, `src/controlplane`, `src/gateways`, `src/workflows`, `src/memory`, `src/observability`, `src/security`.
- Contract/schema updates in `src/contracts` and config updates in `src/config/schema.ts`.
- New/updated tests across unit and integration layers for each closed gap.
- Updated docs in `docs/SPEC`, `docs/PLANS`, and runbooks reflecting actual runtime behavior.

---

*End of SOW*
