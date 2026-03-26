# 02 API Contracts

## Source alignment
- **Canonical HTTP routes:** `src/server/routes.ts` (implemented paths and methods).
- **Machine-readable summary:** `openapi.yaml` — route table + **`RequestEnvelope` / `ResponseEnvelope`** aligned to Zod in `src/contracts/request-envelope.ts` and `response-envelope.ts` (not legacy `intent`/`version` ingress shapes).
- Normative architecture: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 5, 6, 8, 18).
- Gaps and posture: `docs/OPERATIONS/Production-Readiness-Gaps-Report.md`.

## Transport
- HTTP on `PORT` and optional HTTPS on `HTTPS_PORT` when TLS material is configured.
- Production target requires fail-closed TLS behavior when TLS is configured but invalid.

## Implemented endpoints (sync with `routes.ts`)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/healthz` | Liveness + dependency summary. If `OPERATIONAL_BEARER_TOKEN` is set, requires `Authorization: Bearer <token>`. Processing bounded by **`REQUEST_PROCESSING_TIMEOUT_MS`** (504 **`TIMEOUT`** if dependency checks stall). |
| GET | `/readyz` | Readiness + dependencies; same operational bearer rule and **`REQUEST_PROCESSING_TIMEOUT_MS`** / **504 `TIMEOUT`**. |
| GET | `/metrics` | JSON counters/histograms, or Prometheus text via `?format=prometheus` or `Accept: text/plain`. Same operational bearer rule and processing timeout. |
| GET | `/v1/version` | Contract version, app version, optional `release_id` / `build_id`. Same operational bearer rule. Uses `REQUEST_PROCESSING_TIMEOUT_MS` like other operational GETs; may return **504** `TIMEOUT` (same error body shape as `/healthz`). |
| GET | `/v1/preflight` | Production preflight report. Same operational bearer rule; **`REQUEST_PROCESSING_TIMEOUT_MS`** / **504 `TIMEOUT`** on slow checks. |
| POST | `/token/exchange` | Identity trust boundary for AI JWT (payload per deployment). May return 503 when production rollout flag disables platform. After body read, bounded by **`REQUEST_PROCESSING_TIMEOUT_MS`** (504 **`TIMEOUT`**). |
| POST | `/v1/query` | Primary synchronous ingress (`RequestEnvelope`). Gated by feature flags (`runtime_mvp_query_chat_enabled`, `platform_production_rollout_enabled` in production). |
| POST | `/v1/query/async` | Async job submission (same ingress body as sync). Runs governance gate before enqueue; **200** + `ResponseEnvelope` when blocked, **202** when accepted. Optional `Idempotency-Key` (dedupe per tenant + body fingerprint; see § Execution model). Optional `X-Webhook-Url`. Returns 503 when queue not configured (`ASYNC_NOT_AVAILABLE`) or rollout disabled. |
| GET | `/v1/jobs` | List jobs; query params: `status`, `org_id`, `app_id`, `user_id`, `limit`, `offset`. Same **`REQUEST_PROCESSING_TIMEOUT_MS`** wall-clock bound as sync query (504 **`TIMEOUT`** if the queue backend stalls). |
| GET | `/v1/jobs/{job_id}` | Job status (single path segment for `job_id`). Same processing timeout / **504 `TIMEOUT`** as above. |
| POST | `/v1/jobs/{job_id}/cancel` | Cancel job. Same processing timeout / **504 `TIMEOUT`** as above. |
| GET | `/admin/flags` | List flags (operational bearer when token configured). Processing bounded by **`REQUEST_PROCESSING_TIMEOUT_MS`**. |
| POST | `/admin/flags/evaluate` | Evaluate flag. Same processing timeout after body read. |
| POST | `/admin/flags/overrides` | Create override. Same processing timeout after body read. |
| DELETE | `/admin/flags/overrides/{flag_name}/{scope}/{scope_id}` | Remove override. Same processing timeout. |
| GET | `/admin/flags/overrides/{scope}/{scope_id}` | List overrides for scope. Same processing timeout. |

There is **no** separate HTTP route in this server for `/v1/intent`, `/v1/retrieve`, or `/v1/ingest`; those concerns are handled inside the query pipeline and internal contracts where enabled.

## Execution model: synchronous query vs async jobs (WANT-049 / WANT-050)

This server exposes **two different HTTP patterns**; they must not be conflated:

| Pattern | HTTP | Response body | `ResponseEnvelope.mode` |
|--------|------|---------------|---------------------------|
| **Synchronous query** | `POST /v1/query` | `ResponseEnvelope` on success | Always **`sync`** when the field is present (`src/server/query-handler.ts`). |
| **Async job** | `POST /v1/query/async` | **202** acceptance JSON (`job_id`, …) when the job is enqueued; **200** + `ResponseEnvelope` when policy/budget/route denies **before** enqueue (same gate as sync; `src/server/query-handler.ts` `preflightAsyncQueryGovernance`, `routes.ts`). | N/A on **202**; **`sync`** on blocked/error envelope when HTTP **200**. |
| **Job lifecycle** | `GET /v1/jobs`, `GET /v1/jobs/{id}`, `POST /v1/jobs/{id}/cancel` | Job records / errors per `routes.ts` | N/A |

**Ingress schema (strict):** The JSON body for both `POST /v1/query` and `POST /v1/query/async` is validated by Zod **`RequestEnvelopeSchema`** in `src/contracts/request-envelope.ts`:

- **Unknown keys are rejected** (`.strict()`), including paper-only fields such as `idempotency_key`, top-level `timestamp`, `safety_profile`, legacy `version`/`intent` shapes, etc.
- **`mode`**, if sent, may only be **`"sync"`** or omitted. Values **`async`** and **`auto`** are invalid and return **`INVALID_PAYLOAD`**.
- Async execution is **not** requested via `RequestEnvelope.mode`; clients must call **`POST /v1/query/async`** when a job queue is configured.

**Idempotency:** **`POST /v1/query`** remains **without** idempotency; unknown body keys such as `idempotency_key` are still rejected (strict schema). **`POST /v1/query/async`** supports optional HTTP header **`Idempotency-Key`** (trimmed, max **256** characters). The server scopes keys by caller **org_id / app_id / user_id** and fingerprints the logical body (**caller + input + preferences + `mode` + `deadline_ms` + `contract_version`**, **not** `request_id`). Matching key + fingerprint replays the **same** `job_id` (`202`); the same key with a different fingerprint returns **`409`** with **`IDEMPOTENCY_KEY_CONFLICT`**. In-process replay slots expire after **24 hours** (see `JobQueueService` in `src/queue/job-queue.ts`).

**MVP flag:** When `runtime_mvp_query_chat_enabled` is false, `POST /v1/query` returns **404** with **`ApiPlainError`**: `status: "error"`, `error.code` **`MVP_QUERY_DISABLED`**, `error.message` describing the gate — not a `ResponseEnvelope`.

**Unknown route:** Unmatched methods/paths fall through to **404** **`NOT_FOUND`** (`ApiPlainError`), same shape as other plain JSON errors from `routes.ts`.

**OpenAPI:** `openapi.yaml` `RequestEnvelope` / `ResponseEnvelope` components match the Zod shapes above (aligned 2026-03-24). Internal types (`IntentBundle`, `CanonicalRequest`, …) are not the HTTP ingress body.

## RequestEnvelope (external ingress)
- **Canonical definition:** `src/contracts/request-envelope.ts` (`RequestEnvelopeSchema`) and `validateRequestEnvelope` in `src/contracts/index.ts`.
- **Fields:** `request_id` (UUID), `caller` (`app_id`, `user_id`, `org_id`, optional `session_id`, `scopes`), `input` (optional text, attachments, structured), `preferences` (response_format, verbosity, stream), optional `mode` (`sync` only), optional `deadline_ms`, `contract_version` (default `v1`).
- **Production identity:** Effective caller context should be derived from verified AI JWT claims where configured; body caller fields must align with enforcement rules in `src/ingress/validate.ts`.

## ResponseEnvelope (external)
- **Canonical definition:** `src/contracts/response-envelope.ts` (`ResponseEnvelopeSchema`).
- Returned on **200** from `POST /v1/query` for handled outcomes; includes `request_id`, `status` (`ok` \| `blocked` \| `error`), optional `output`, `telemetry`, `error`, and optional **`mode`**: literal **`sync`** only.

## Async job API
- **Governance preflight:** After ingress and rate limits, the server runs the same control-plane dispatch gate as sync (`policy → budget → route → plan`). If dispatch is denied, the handler returns HTTP **200** with a `ResponseEnvelope` (`status: "blocked"`, error codes such as `POLICY_BLOCKED` / `BUDGET_EXCEEDED`) and **does not** enqueue a job.
- **Accepted response** when enqueued: `job_id`, `status_url`, `created_at` (HTTP **202**).
- **Idempotency:** optional `Idempotency-Key` header; **`409`** + `IDEMPOTENCY_KEY_CONFLICT` when the key was already used with a different body in the same tenant scope.
- **Job record** and errors use codes such as `ASYNC_NOT_AVAILABLE`, `JOB_NOT_FOUND`, `INVALID_JOB_ID`, `CANNOT_CANCEL` as implemented in `routes.ts`.

## Error taxonomy
Primary code set is defined in `src/contracts/errors.ts` and `src/contracts/ERROR_CODES.md`. Core categories include:
- Auth and payload: `AUTH_INVALID`, `INVALID_PAYLOAD`, `CONTRACT_VERSION_UNSUPPORTED`.
- Governance: `POLICY_BLOCKED`, `BUDGET_EXCEEDED`, `RATE_LIMITED`.
- Runtime: `MODEL_FAILURE`, `TOOL_TIMEOUT`, `RETRIEVAL_UNAVAILABLE`, `INTERNAL_ERROR`.
- Multimodal: `ATTACHMENT_REJECTED`, `MULTIMODAL_UNSUPPORTED`.
- Async jobs: `IDEMPOTENCY_KEY_CONFLICT` (**409** on `POST /v1/query/async` when `Idempotency-Key` was already used with a different body in the same tenant scope).
- **HTTP surface (jobs / rollout / admin / ingress):** `ASYNC_NOT_AVAILABLE` (**503** when the job queue is not configured), `INVALID_JOB_ID`, `JOB_NOT_FOUND`, `CANNOT_CANCEL`, `FLAGS_NOT_AVAILABLE`, **`NOT_FOUND`** / **`MVP_QUERY_DISABLED`** (**404**), and **`TIMEOUT`** (**504** for `REQUEST_PROCESSING_TIMEOUT_MS` on query/job routes, **`GET /healthz`**, **`GET /readyz`**, **`GET /metrics`**, **`GET /v1/preflight`**, **`POST /token/exchange`** (after body read), **`/admin/flags*`** — distinct from **`TOOL_TIMEOUT`**). Production rollout disabled responses reuse **`POLICY_BLOCKED`** on **503** per `routes.ts`. **`openapi.yaml`** `ErrorCode` enum documents plain JSON routes; **`ResponseEnvelope.error.code`** remains **`string`** in Zod / **`ResponseErrorNested`** so engine and pipeline codes (e.g. **`DEADLINE_EXCEEDED`**, **`RETRIEVAL_FAILED`**) stay valid (**2026-03-25**).

## Internal contracts
Contracts are versioned and validated in `src/contracts/`:
- `CanonicalRequest`, `IntentBundle`, `PolicyDecision`, `PipelinePlan`.
- `TypedArtifact`, `Task`, `EngineInvocation`, `EngineResult`, `WorkflowDefinition`.
- Workflow-specific artifacts (for example research and decision outputs).

## Contract consistency requirement
- Exposed API fields must match implemented runtime semantics in `src/server/routes.ts`.
- `openapi.yaml` and this document should be updated whenever routes or auth behavior change.
