# Route inventory

**Purpose:** HTTP surface mirrored from `src/server/routes.ts` (method, path, auth / behavior notes).  
**Source revision:** Audit **2026-03-25** against `routes.ts` in this repo.

**Operational bearer:** When `OPERATIONAL_BEARER_TOKEN` (config `operationalBearerToken`) is **set**, listed operational routes require `Authorization: Bearer <token>`. When **unset**, those routes do **not** require that header (see `isOperationalAccessAllowed` in `routes.ts`).

| Method | Path | Auth / access | Notes |
|--------|------|----------------|-------|
| GET | `/healthz` | Operational bearer if configured | 200 or **503** from dependency checks; **504** `TIMEOUT` if `REQUEST_PROCESSING_TIMEOUT_MS` exceeded |
| GET | `/readyz` | Operational bearer if configured | 200 or **503**; **504** `TIMEOUT` same |
| GET | `/metrics` | Operational bearer if configured | JSON snapshot or Prometheus text; **504** `TIMEOUT` same |
| GET | `/v1/version` | Operational bearer if configured | Contract + app version; `withProcessingOrTimeout` (`REQUEST_PROCESSING_TIMEOUT_MS`) |
| GET | `/v1/preflight` | Operational bearer if configured | 200 vs **503**; **504** `TIMEOUT` if preflight stalls |
| POST | `/token/exchange` | Body per exchange contract | Production + rollout disabled → **503** `POLICY_BLOCKED`; after body read, **504** `TIMEOUT` cap |
| POST | `/v1/query/async` | AI JWT / ingress auth per config | No job queue → **503** `ASYNC_NOT_AVAILABLE`; rollout gate same as exchange; **504** `TIMEOUT` (governance through enqueue) |
| GET | `/v1/jobs/{id}` | Same as async path | No queue → **503**; invalid id shape → **400**; **504** `TIMEOUT` |
| POST | `/v1/jobs/{id}/cancel` | Same | No queue → **503**; **504** `TIMEOUT` |
| GET | `/v1/jobs` | Same | Query filters; **504** `TIMEOUT` |
| GET | `/admin/flags` | Operational bearer **always** when token set | No flag service → **503** `FLAGS_NOT_AVAILABLE`; **504** `TIMEOUT` cap |
| POST | `/admin/flags/evaluate` | Operational bearer if configured | **504** `TIMEOUT` after body read |
| POST | `/admin/flags/overrides` | Operational bearer if configured | **504** `TIMEOUT` after body read |
| DELETE | `/admin/flags/overrides/{flag}/{scope}/{scopeId}` | Operational bearer if configured | **504** `TIMEOUT` |
| GET | `/admin/flags/overrides/{scope}/{scopeId}` | Operational bearer if configured | **504** `TIMEOUT` |
| POST | `/v1/query` | AI JWT / ingress + rate limit | `runtime_mvp_query_chat_enabled` off → **404** **`MVP_QUERY_DISABLED`** (`ApiPlainError`); production rollout off → **503**; **504** `TIMEOUT` (`REQUEST_PROCESSING_TIMEOUT_MS`) |

**Also:** CORS and request-queue backpressure run before routing (`handleCors`, `RequestQueue`). Any method/path not listed above falls through to **404** **`NOT_FOUND`** (`ApiPlainError`).

**Canonical code:** `src/server/routes.ts`. **OpenAPI:** repo root `openapi.yaml`. **Narrative:** `docs/SPEC/02_API_Contracts.md`.
