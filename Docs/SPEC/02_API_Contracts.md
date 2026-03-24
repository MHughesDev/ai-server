# 02 API Contracts

## Source alignment
- **Canonical HTTP routes:** `src/server/routes.ts` (implemented paths and methods).
- **Machine-readable summary:** `openapi.yaml` (kept in sync with that route table).
- Normative architecture: `docs/Architecture_document_Finalized.md` (Sections 5, 6, 8, 18).
- Gaps and posture: `docs/Production-Readiness-Gaps-Report.md`.

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
| POST | `/v1/query/async` | Async job submission (same ingress body as sync). Optional `X-Webhook-Url`. Returns 503 when queue not configured (`ASYNC_NOT_AVAILABLE`) or rollout disabled. |
| GET | `/v1/jobs` | List jobs; query params: `status`, `org_id`, `app_id`, `user_id`, `limit`, `offset`. |
| GET | `/v1/jobs/{job_id}` | Job status (single path segment for `job_id`). |
| POST | `/v1/jobs/{job_id}/cancel` | Cancel job. |
| GET | `/admin/flags` | List flags (operational bearer when token configured). |
| POST | `/admin/flags/evaluate` | Evaluate flag. |
| POST | `/admin/flags/overrides` | Create override. |
| DELETE | `/admin/flags/overrides/{flag_name}/{scope}/{scope_id}` | Remove override. |
| GET | `/admin/flags/overrides/{scope}/{scope_id}` | List overrides for scope. |

There is **no** separate HTTP route in this server for `/v1/intent`, `/v1/retrieve`, or `/v1/ingest`; those concerns are handled inside the query pipeline and internal contracts where enabled.

## RequestEnvelope (external ingress)
- Validated by `validateIngress` / contract version in code; see `src/ingress` and `src/contracts`.
- Typical fields include `request_id`, contract `version`, `timestamp`, and `intent` bundle with scope and artifacts.
- **Production identity:** Effective caller context should be derived from verified AI JWT claims where configured; body caller fields must align with enforcement rules in code.

## ResponseEnvelope (external)
- Returned for successful `/v1/query` processing paths; includes `request_id`, `status`, `output`, `telemetry`, and optional `error` detail per runtime.

## Async job API
- **Accepted response** for `POST /v1/query/async`: `job_id`, `status_url`, `created_at` (HTTP 202).
- **Job record** and errors use codes such as `ASYNC_NOT_AVAILABLE`, `JOB_NOT_FOUND`, `INVALID_JOB_ID`, `CANNOT_CANCEL` as implemented in `routes.ts`.

## Error taxonomy
Primary code set is defined in `src/contracts/errors.ts` and `src/contracts/ERROR_CODES.md`. Core categories include:
- Auth and payload: `AUTH_INVALID`, `INVALID_PAYLOAD`, `CONTRACT_VERSION_UNSUPPORTED`.
- Governance: `POLICY_BLOCKED`, `BUDGET_EXCEEDED`, `RATE_LIMITED`.
- Runtime: `MODEL_FAILURE`, `TOOL_TIMEOUT`, `RETRIEVAL_UNAVAILABLE`, `INTERNAL_ERROR`.
- Multimodal: `ATTACHMENT_REJECTED`, `MULTIMODAL_UNSUPPORTED`.

## Internal contracts
Contracts are versioned and validated in `src/contracts/`:
- `CanonicalRequest`, `IntentBundle`, `PolicyDecision`, `PipelinePlan`.
- `TypedArtifact`, `Task`, `EngineInvocation`, `EngineResult`, `WorkflowDefinition`.
- Workflow-specific artifacts (for example research and decision outputs).

## Contract consistency requirement
- Exposed API fields must match implemented runtime semantics in `src/server/routes.ts`.
- `openapi.yaml` and this document should be updated whenever routes or auth behavior change.
