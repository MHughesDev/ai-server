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
| GET | `/healthz` | Liveness + dependency summary. If `OPERATIONAL_BEARER_TOKEN` is set, requires `Authorization: Bearer <token>`. |
| GET | `/readyz` | Readiness + dependencies; same operational bearer rule. |
| GET | `/metrics` | JSON counters/histograms, or Prometheus text via `?format=prometheus` or `Accept: text/plain`. Same operational bearer rule. |
| GET | `/v1/version` | Contract version, app version, optional `release_id` / `build_id`. Same operational bearer rule. |
| GET | `/v1/preflight` | Production preflight report. Same operational bearer rule. |
| POST | `/token/exchange` | Identity trust boundary for AI JWT (payload per deployment). May return 503 when production rollout flag disables platform. |
| POST | `/v1/query` | Primary synchronous ingress (`RequestEnvelope`). Gated by feature flags (`runtime_mvp_query_chat_enabled`, `platform_production_rollout_enabled` in production). |
| POST | `/v1/query/async` | Async job submission (same ingress body as sync). Optional `Idempotency-Key` (dedupe per tenant + body fingerprint; see § Execution model). Optional `X-Webhook-Url`. Returns 503 when queue not configured (`ASYNC_NOT_AVAILABLE`) or rollout disabled. |
| GET | `/v1/jobs` | List jobs; query params: `status`, `org_id`, `app_id`, `user_id`, `limit`, `offset`. |
| GET | `/v1/jobs/{job_id}` | Job status (single path segment for `job_id`). |
| POST | `/v1/jobs/{job_id}/cancel` | Cancel job. |
| GET | `/admin/flags` | List flags (operational bearer when token configured). |
| POST | `/admin/flags/evaluate` | Evaluate flag. |
| POST | `/admin/flags/overrides` | Create override. |
| DELETE | `/admin/flags/overrides/{flag_name}/{scope}/{scope_id}` | Remove override. |
| GET | `/admin/flags/overrides/{scope}/{scope_id}` | List overrides for scope. |

There is **no** separate HTTP route in this server for `/v1/intent`, `/v1/retrieve`, or `/v1/ingest`; those concerns are handled inside the query pipeline and internal contracts where enabled.

## Execution model: synchronous query vs async jobs (WANT-049 / WANT-050)

This server exposes **two different HTTP patterns**; they must not be conflated:

| Pattern | HTTP | Response body | `ResponseEnvelope.mode` |
|--------|------|---------------|---------------------------|
| **Synchronous query** | `POST /v1/query` | `ResponseEnvelope` on success | Always **`sync`** when the field is present (`src/server/query-handler.ts`). |
| **Async job** | `POST /v1/query/async` | **202** acceptance JSON: `status`, `job_id`, `status_url`, `created_at` — **not** a `ResponseEnvelope` | N/A (no envelope on this response). |
| **Job lifecycle** | `GET /v1/jobs`, `GET /v1/jobs/{id}`, `POST /v1/jobs/{id}/cancel` | Job records / errors per `routes.ts` | N/A |

**Ingress schema (strict):** The JSON body for both `POST /v1/query` and `POST /v1/query/async` is validated by Zod **`RequestEnvelopeSchema`** in `src/contracts/request-envelope.ts`:

- **Unknown keys are rejected** (`.strict()`), including paper-only fields such as `idempotency_key`, top-level `timestamp`, `safety_profile`, legacy `version`/`intent` shapes, etc.
- **`mode`**, if sent, may only be **`"sync"`** or omitted. Values **`async`** and **`auto`** are invalid and return **`INVALID_PAYLOAD`**.
- Async execution is **not** requested via `RequestEnvelope.mode`; clients must call **`POST /v1/query/async`** when a job queue is configured.

**Idempotency:** **`POST /v1/query`** remains **without** idempotency; unknown body keys such as `idempotency_key` are still rejected (strict schema). **`POST /v1/query/async`** supports optional HTTP header **`Idempotency-Key`** (trimmed, max **256** characters). The server scopes keys by caller **org_id / app_id / user_id** and fingerprints the logical body (**caller + input + preferences + `mode` + `deadline_ms` + `contract_version`**, **not** `request_id`). Matching key + fingerprint replays the **same** `job_id` (`202`); the same key with a different fingerprint returns **`409`** with **`IDEMPOTENCY_KEY_CONFLICT`**. In-process replay slots expire after **24 hours** (see `JobQueueService` in `src/queue/job-queue.ts`).

**MVP flag:** When `runtime_mvp_query_chat_enabled` is false, `POST /v1/query` returns **404** with `{ "error": "MVP query endpoint not enabled" }` — a **plain object**, not a `ResponseEnvelope`.

**OpenAPI:** `openapi.yaml` `RequestEnvelope` / `ResponseEnvelope` components match the Zod shapes above (aligned 2026-03-24). Internal types (`IntentBundle`, `CanonicalRequest`, …) are not the HTTP ingress body.

## RequestEnvelope (external ingress)
- **Canonical definition:** `src/contracts/request-envelope.ts` (`RequestEnvelopeSchema`) and `validateRequestEnvelope` in `src/contracts/index.ts`.
- **Fields:** `request_id` (UUID), `caller` (`app_id`, `user_id`, `org_id`, optional `session_id`, `scopes`), `input` (optional text, attachments, structured), `preferences` (response_format, verbosity, stream), optional `mode` (`sync` only), optional `deadline_ms`, `contract_version` (default `v1`).
- **Production identity:** Effective caller context should be derived from verified AI JWT claims where configured; body caller fields must align with enforcement rules in `src/ingress/validate.ts`.

## ResponseEnvelope (external)
- **Canonical definition:** `src/contracts/response-envelope.ts` (`ResponseEnvelopeSchema`).
- Returned on **200** from `POST /v1/query` for handled outcomes; includes `request_id`, `status` (`ok` \| `blocked` \| `error`), optional `output`, `telemetry`, `error`, and optional **`mode`**: literal **`sync`** only.

## Async job API
- **Accepted response** for `POST /v1/query/async`: `job_id`, `status_url`, `created_at` (HTTP **202**).
- **Idempotency:** optional `Idempotency-Key` header; **`409`** + `IDEMPOTENCY_KEY_CONFLICT` when the key was already used with a different body in the same tenant scope.
- **Job record** and errors use codes such as `ASYNC_NOT_AVAILABLE`, `JOB_NOT_FOUND`, `INVALID_JOB_ID`, `CANNOT_CANCEL` as implemented in `routes.ts`.

## Error taxonomy
Primary code set is defined in `src/contracts/errors.ts` and `src/contracts/ERROR_CODES.md`. Core categories include:
- Auth and payload: `AUTH_INVALID`, `INVALID_PAYLOAD`, `CONTRACT_VERSION_UNSUPPORTED`.
- Governance: `POLICY_BLOCKED`, `BUDGET_EXCEEDED`, `RATE_LIMITED`.
- Runtime: `MODEL_FAILURE`, `TOOL_TIMEOUT`, `RETRIEVAL_UNAVAILABLE`, `INTERNAL_ERROR`.
- Multimodal: `ATTACHMENT_REJECTED`, `MULTIMODAL_UNSUPPORTED`.
- Async jobs: `IDEMPOTENCY_KEY_CONFLICT` (**409** on `POST /v1/query/async` when `Idempotency-Key` was already used with a different body in the same tenant scope).

## Internal contracts
Contracts are versioned and validated in `src/contracts/`:
- `CanonicalRequest`, `IntentBundle`, `PolicyDecision`, `PipelinePlan`.
- `TypedArtifact`, `Task`, `EngineInvocation`, `EngineResult`, `WorkflowDefinition`.
- Workflow-specific artifacts (for example research and decision outputs).

## Contract consistency requirement
- Exposed API fields must match implemented runtime semantics in `src/server/routes.ts`.
- `openapi.yaml` and this document should be updated whenever routes or auth behavior change.
