# ResponseEnvelope.error.code — Error Code Taxonomy

Clients should use the `code` field on `ResponseEnvelope.error` for stable handling and i18n. All codes are defined in `src/contracts/errors.ts` and re-exported as `ERROR_CODES`, `ErrorCode`, `ERROR_TAXONOMY`, `getErrorMeta`.

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

**Usage:** Prefer mapping server responses to these codes rather than free-form messages. For HTTP status, use `getErrorMeta(code).httpStatus` when propagating to the client.

**References:** Architecture §6.2 (ResponseEnvelope), SOW §7 / Segment N.1, `Docs/SPEC/02_API_Contracts.md`.
