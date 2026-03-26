# ResponseEnvelope.error.code — Error Code Taxonomy

Clients should use the `code` field on `ResponseEnvelope.error` for stable handling and i18n. The table below lists the **canonical HTTP-oriented** codes in `src/contracts/errors.ts` (`ERROR_CODES`, `ErrorCode`, `ERROR_TAXONOMY`, `getErrorMeta`). **`ResponseEnvelopeSchema`** still allows **any string** for `error.code` (see Zod in `response-envelope.ts`); the runtime may return additional engine or pipeline codes such as **`DEADLINE_EXCEEDED`**, **`RETRIEVAL_FAILED`**, **`MEMORY_OPERATION_UNSUPPORTED`**, **`TOOL_NOT_ALLOWED`**, **`JOB_PROCESSING_ERROR`**, **`SERVICE_UNAVAILABLE`**, **`WORKFLOW_NOT_FOUND`**, etc.

| Code | HTTP suggestion | Retryable | When used |
|------|------------------|-----------|-----------|
| **AUTH_INVALID** | 401 | No | Authentication failed or token invalid. |
| **RATE_LIMITED** | 429 | Yes | Rate limit or quota exceeded. |
| **POLICY_BLOCKED** | 403 | No | Request blocked by policy (e.g. workflow/tool not allowed). |
| **BUDGET_EXCEEDED** | 429 | No | Token, cost, or tool budget exceeded. |
| **TOOL_TIMEOUT** | 504 | Yes | Tool execution timed out. |
| **MODEL_FAILURE** | 502 | Yes | Model provider or inference failure. |
| **INTERNAL_ERROR** | 500 | Yes | Internal server error. |
| **INVALID_PAYLOAD** | 400 | No | Request envelope validation failed. |
| **CONTRACT_VERSION_UNSUPPORTED** | 400 | No | Unsupported `contract_version`. |
| **RETRIEVAL_UNAVAILABLE** | 503 | Yes | Memory/retrieval store unavailable; response may be degraded. |
| **ATTACHMENT_REJECTED** | 400 | No | Attachment validation failed (type, size, count, or mime). |
| **MULTIMODAL_UNSUPPORTED** | 400 | No | Multimodal request but no capable pipeline allowed by policy. |
| **IDEMPOTENCY_KEY_CONFLICT** | 409 | No | `POST /v1/query/async`: same `Idempotency-Key` (per tenant scope) already used with a different request body. |
| **ASYNC_NOT_AVAILABLE** | 503 | Yes | Job HTTP routes when the async queue is not configured. |
| **INVALID_JOB_ID** | 400 | No | `GET` / `POST …/cancel` job paths: malformed `jobId`. |
| **JOB_NOT_FOUND** | 404 | No | `GET /v1/jobs/{id}`: unknown job. |
| **CANNOT_CANCEL** | 409 | No | `POST /v1/jobs/{id}/cancel`: job missing or not cancellable. |
| **FLAGS_NOT_AVAILABLE** | 503 | Yes | `/admin/flags*` when the feature-flag service is not initialized. |
| **TIMEOUT** | 504 | Yes | HTTP `withRequestTimeout` / `withProcessingOrTimeout` (`REQUEST_PROCESSING_TIMEOUT_MS`): `POST /v1/query`, `POST /v1/query/async` (through enqueue), job routes, `GET /healthz`, `GET /readyz`, `GET /metrics`, `GET /v1/preflight`, `POST /token/exchange` (after body read), `/admin/flags*`. Not `TOOL_TIMEOUT`. |
| **NOT_FOUND** | 404 | No | Unmatched HTTP path/method (fall-through in `routes.ts`). |
| **MVP_QUERY_DISABLED** | 404 | No | `POST /v1/query` when `runtime_mvp_query_chat_enabled` is false. |

**Usage:** Prefer mapping server responses to these codes rather than free-form messages. For HTTP status, use `getErrorMeta(code).httpStatus` when propagating to the client.

**References:** Architecture §6.2 (ResponseEnvelope), SOW §7 / Segment N.1, `docs/SPEC/02_API_Contracts.md`.
