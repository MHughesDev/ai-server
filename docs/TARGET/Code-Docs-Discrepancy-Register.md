# Code ↔ Docs discrepancy register

**Audit date:** 2026-03-24  
**Method:** Read `src/server/routes.ts`, `src/server/index.ts`, `src/server/middleware.ts`, `src/server/query-handler.ts`, `src/ingress/validate.ts`, `openapi.yaml`, `docs/SPEC/02_API_Contracts.md`, `docs/OPERATIONS/Production-Readiness-Gaps-Report.md`, `docs/PLANS/SOW-Documentation-Implementation-Gap-Closure.md` (gap register excerpt).

**Legend:** **P0** = materially wrong contract/security/deploy; **P1** = misleading ops/readiness; **P2** = cleanup / planning doc drift.

---

## Summary counts

| Severity | Count (approx.) |
|----------|-----------------|
| P0 | 0 (no missing routes in OpenAPI vs `routes.ts` for audited paths) |
| P1 | 6 |
| P2 | 8+ |

**Routes vs OpenAPI:** Paths in `openapi.yaml` match the route table in `src/server/routes.ts` for: `/healthz`, `/readyz`, `/metrics`, `/v1/version`, `/v1/preflight`, `/token/exchange`, `/v1/query`, `/v1/query/async`, `/v1/jobs`, `/v1/jobs/{id}`, `/v1/jobs/{id}/cancel`, `/admin/flags*`.

**SPEC 02:** Endpoint table aligns with `routes.ts` for the audited snapshot.

---

## Discrepancy table

| ID | Area | Code evidence | Doc / claim | Severity | Action |
|----|------|---------------|-------------|----------|--------|
| D-001 | Async HTTP API | `routes.ts`: async job paths when `jobQueueService` set; optional **`Idempotency-Key`** on `POST /v1/query/async` (2026-03-24). | Historical gaps text that implied **no** async HTTP API. | P1 | **Doc fix (ongoing):** §9.8 + SPEC 02 + OpenAPI describe async jobs + idempotency; refresh any remaining “sync-only runtime” wording in older sections to distinguish **`POST /v1/query`** (sync) vs **`/v1/query/async`**. |
| D-002 | Sync response `mode` | `query-handler.ts`: successful paths set `mode: "sync"`. | Request/contract docs may imply `async` for sync path — verify `docs/SPEC/02` prose (table is OK). | P2 | Clarify in SPEC 02 that **`POST /v1/query` responses use `mode: "sync"`** unless doc already says so. |
| D-003 | SOW gap register | Ongoing reconciliation vs `src/**` (e.g. async jobs, idempotency, sinks, audit lock, retrieval timeout). | Older SOW rows may still read **open** until touched. | P1 | **Doc fix:** Refresh gap register rows as code changes (**2026-03-24:** GAP-OBS-001, GAP-SEC-001, GAP-MEM-001, GAP-API-001, executive summary). |
| D-004 | Server lifecycle | `index.ts`: `PORT` validated (1–65535); TLS load failure **throws**; graceful shutdown (`SIGTERM`/`SIGINT`) drains connections. | `Production-Readiness-Gaps-Report.md` §9.1: claims missing PORT validation, graceful shutdown, TLS fail-open. | P1 | **Doc fix:** Replace §9.1 bullets with **current** behavior or move old text to “historical”. |
| D-005 | Read timeout | `middleware.ts` `readJsonBody`: default `timeoutMs` 30s, `aborted` handling. | §9.1: “Read timeout for slow clients missing”. | P1 | **Doc fix:** Remove or mark implemented; cite `requestReadTimeoutMs` / `readJsonBody`. |
| D-006 | Request processing timeout | `routes.ts` `withRequestTimeout(handleQuery(...), REQUEST_PROCESSING_TIMEOUT_MS)` (default 120s). | §9.1: “No global request deadline wrapper”. | P2 | **Doc fix:** Note wrapper exists for `/v1/query`; optional: distinguish from `plan.budgets.deadline_ms` enforcement depth. |
| D-007 | Tenant usage fail-soft | `query-handler.ts`: `recordTenantUsage` in **try/catch** — emits ERROR event, does not rethrow. | §9.3: “Tenant usage recording can fail request”. | P1 | **Doc fix:** Update to match fail-soft (unless another path still throws). |
| D-008 | Rollout flag | `routes.ts` + `bootstrap`: `platform_production_rollout_enabled` gates production for `/token/exchange`, `/v1/query/async`, `/v1/query`; preflight checks flag. | §9.10: “rollout flags … advisory only” (overbroad). | P2 | **Doc fix:** Say **partially enforced** on listed routes; note any flags still parse-only separately (`GAP-BUDGET-002`). |
| D-009 | MVP disabled response | `runtime_mvp_query_chat_enabled` false → **404** **`MVP_QUERY_DISABLED`** `ApiPlainError` (not `ResponseEnvelope`). | **Closed 2026-03-25** — SPEC 02 + `openapi.yaml` `404` → `ApiPlainError`; `MvpQueryDisabledResponse` removed. | P2 | **Fixed** (code + docs + OpenAPI). |
| D-010 | Ingress validate comment | `validate.ts` `requireAuthHeader` JSDoc updated **2026-03-24** (removed “stub” wording). | — | P2 | **Done** (comment only); table §2 in gaps report still lists line 28 “auth stub” — refresh that table separately. |
| D-011 | SPEC 00 | N/A | “stubs in key production paths” — partially true for defaults; overlaps with gaps report tone. | P2 | Optional refresh to point at **as-built snapshot** + this register. |

---

## Closed / aligned (no action)

- **OpenAPI vs `routes.ts`:** Audited paths present in both.
- **`docs/SPEC/02_API_Contracts.md` endpoint table:** Matches `routes.ts` for listed routes.
- **`docs/SPEC/20_Config_and_FeatureFlags.md`:** Realigned to `FeatureFlagsSchema` in `schema.ts` with enforcement matrix (2026-03-24); removed non-schema flag names from normative SPEC 20 list. **Follow-on:** `resolveFeatureFlagEnabled` + policy/coding-agent caller-scoped resolution (same as query/routes); matrix rows for `enable_org_memory`, harness, and security hardening in coding-agent updated to **Dynamic**.
- **Dependency-aware `/healthz` and `/readyz`:** Code and gaps §9.2 agree.
- **Rate limiting:** Code and gaps §9.3 agree.
- **Async idempotency:** Optional `Idempotency-Key` on `POST /v1/query/async` (`job-queue.ts`, `async-idempotency.ts`); SPEC 02 + OpenAPI aligned **2026-03-24**.

---

## Recommended next steps

1. Edit `docs/OPERATIONS/Production-Readiness-Gaps-Report.md` §9.1, §9.3 (tenant usage), §9.8, §9.10, §10 async bullet per rows above.
2. Reconcile `docs/PLANS/SOW-Documentation-Implementation-Gap-Closure.md` gap register against `routes.ts` / `validate.ts` / `rate-limit.ts`.
3. Run `npm run verify:sow` and add **Last verified** to `docs/CURRENT/As-Built-Snapshot.md`.
4. Optional: script to diff `routes.ts` path literals vs `openapi.yaml` paths on each PR.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-24 | Initial audit pass; OpenAPI/SPEC 02 route table aligned with code. |
| 2026-03-24 | Target backlog (`Target-State-Backlog.md`) **Implementation status** filled from `src/`; README `dist/` section aligned with `.gitignore` (resolves stale “track dist” doc). |
| 2026-03-24 | **Stale doc closed:** §9.9 “policy omits registered workflows” was false vs `policy-evaluator.ts`; gaps report, SOW `GAP-POLICY-001`, **WANT-022**, Go/No-Go table updated. |
| 2026-03-24 | **§9.5 observability** updated vs code: metrics/emitter/sinks were already largely bounded/async; added Prometheus drop metrics, in-memory audit cap + `verifyAuditIntegrity` suffix semantics; **WANT-038/040/041** adjusted. |
| 2026-03-24 | **WANT-048–050 slice:** SPEC 02 execution model; OpenAPI request/response schemas aligned to Zod; **D-009** closed; **WANT-050** → Met in target backlog. |
| 2026-03-24 | **WANT-052 slice:** SPEC 20 aligned to `FeatureFlagsSchema`; removed fictional flags from SPEC 20; gaps §7 + harness runbook updated; **WANT-052** status → Met (with static/dynamic caveat). |
| 2026-03-24 | **WANT-054 slice:** fail-fast release metadata when production + rollout enabled; **WANT-054** → Met. |
| 2026-03-24 | **WANT-052 follow-on:** `resolveFeatureFlagEnabled` (`feature-flags.ts`); `policy-evaluator` / `coding-agent-pipeline` / `query-handler` / `routes` share resolution; SPEC 20 + target backlog note updated. |
| 2026-03-24 | **WANT-049 slice:** async **`Idempotency-Key`** + **`IDEMPOTENCY_KEY_CONFLICT`**; gaps §9.8 §10, SPEC 02, OpenAPI, as-built snapshot, **D-001** action narrowed. |
| 2026-03-24 | **WANT-040 + L2-99 docs:** `verifyAuditLogFileIntegrity` (`audit-logger.ts`); SPEC 19 + gaps §9.5; L2-99 handoff/plan corrected vs **`FeatureFlagsSchema`** (no `governance_harness_*`). |
| 2026-03-24 | **WANT-039 / SOW slice:** production sink path bootstrap validation; optional sink `fsync` envs; **D-003** narrative; SOW gaps **GAP-OBS-001**, **GAP-SEC-001**, **GAP-MEM-001** updated. |
| 2026-03-24 | **Shutdown + GAP-OPS-002 / GAP-API-002:** `server/index.ts` sink flush on SIGINT/SIGTERM; SOW rows closed/partial; gaps §9.1. |
