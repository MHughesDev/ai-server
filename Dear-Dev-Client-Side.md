# Dear Dev (Client-Side)

This document is for **client-side developers** integrating with this AI server. It summarizes what you need to call the API and handle responses.

---

## What This Server Is

- **UI-less API server only** — no web UI or dashboards in this repo. Your client (web app, mobile app, CLI, etc.) is the front end.
- **Contract version:** **v1** (see `src/contracts/CHANGELOG.md` for history and version policy).

---

## Endpoints You'll Use

| Method | Path | Purpose |
|--------|------|--------|
| `POST` | `/v1/query` | Send a user query and get an AI response. |
| `GET` | `/v1/jobs/{job_id}` | (Optional) Poll async job status/result. |
| `GET` | `/v1/version` | Contract version, API version, app version, env; optional `release_id`, `build_id`. |
| `GET` | `/healthz` | Liveness. |
| `GET` | `/readyz` | Readiness. |
| `GET` | `/metrics` | Prometheus metrics (if you need them). |

---

## Request Shape (POST /v1/query)

Send a **RequestEnvelope** (JSON):

- **`request_id`** — Your id for this request (for correlation).
- **`caller`** — `{ app_id, user_id, org_id, session_id, scopes[] }`.
- **`input`** — `{ text, attachments[], structured }`.
- **`preferences`** — `{ response_format, verbosity, stream }`.

---

## Response Shape

You get a **ResponseEnvelope** (JSON):

- **`request_id`** — Echo of your request id.
- **`status`** — Request outcome.
- **`output`** — `{ text, structured, citations[] }`.
- **`telemetry`** — `{ pipeline, models_used, tool_calls, tokens_in, tokens_out, cost_usd_est, latency_ms }`.
- **`error`** — `{ code, message, detail }` when something went wrong.

---

## Error Codes to Handle

Handle these in your client:

- `AUTH_INVALID` — Fix auth and retry.
- `RATE_LIMITED` — Back off and retry later.
- `POLICY_BLOCKED` — Request not allowed by policy.
- `BUDGET_EXCEEDED` — Quota/budget limit hit.
- `TOOL_TIMEOUT` — Server-side tool timed out.
- `MODEL_FAILURE` — Model error; may retry.
- `INTERNAL_ERROR` — Server bug; retry with backoff or show generic error.
- `INVALID_PAYLOAD` — Fix request body and resend.
- `CONTRACT_VERSION_UNSUPPORTED` — Upgrade client to match server contract.
- `ATTACHMENT_REJECTED` — Attachment not accepted (e.g. type/size).
- `MULTIMODAL_UNSUPPORTED` — Multimodal input not supported for this request.
- `RETRIEVAL_UNAVAILABLE` — Memory/retrieval store unavailable; response may be degraded.

**Full taxonomy** (HTTP status suggestion, retryable flag): `src/contracts/ERROR_CODES.md`.

---

## Where to Go Deeper

- **Full API contracts and types:** `docs/SPEC/02_API_Contracts.md`
- **Overview and documentation index:** `docs/ARCHITECTURE/Overview.md`
- **Architecture (finalized):** `docs/ARCHITECTURE/Architecture_document_Finalized.md`
- **Contract changelog and version policy:** `src/contracts/CHANGELOG.md`

Use **`/v1/version`** at startup or in your build to confirm contract and API version compatibility with your client.

Good building.
