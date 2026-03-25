# Route inventory

**Purpose:** HTTP surface mirrored from `src/server/routes.ts` (method, path, auth / behavior notes).  
**Source revision:** Audit **2026-03-24** against `routes.ts` in this repo.

**Operational bearer:** When `OPERATIONAL_BEARER_TOKEN` (config `operationalBearerToken`) is **set**, listed operational routes require `Authorization: Bearer <token>`. When **unset**, those routes do **not** require that header (see `isOperationalAccessAllowed` in `routes.ts`).

| Method | Path | Auth / access | Notes |
|--------|------|----------------|-------|
| GET | `/healthz` | Operational bearer if configured | 200 or **503** from dependency checks |
| GET | `/readyz` | Operational bearer if configured | 200 or **503** |
| GET | `/metrics` | Operational bearer if configured | JSON snapshot or Prometheus text (`?format=prometheus` / `Accept`) |
| GET | `/v1/version` | Operational bearer if configured | Contract + app version, optional release fields |
| GET | `/v1/preflight` | Operational bearer if configured | 200 vs **503** from preflight summary |
| POST | `/token/exchange` | Body per exchange contract | Production + rollout disabled → **503** `POLICY_BLOCKED` |
| POST | `/v1/query/async` | AI JWT / ingress auth per config | No job queue → **503** `ASYNC_NOT_AVAILABLE`; rollout gate same as exchange |
| GET | `/v1/jobs/{id}` | Same as async path | No queue → **503**; invalid id shape → **400** |
| POST | `/v1/jobs/{id}/cancel` | Same | No queue → **503** |
| GET | `/v1/jobs` | Same | Query filters: `status`, `org_id`, `app_id`, `user_id`, `limit`, `offset` |
| GET | `/admin/flags` | Operational bearer **always** when token set | No flag service → **503** `FLAGS_NOT_AVAILABLE` |
| POST | `/admin/flags/evaluate` | Operational bearer if configured | |
| POST | `/admin/flags/overrides` | Operational bearer if configured | |
| DELETE | `/admin/flags/overrides/{flag}/{scope}/{scopeId}` | Operational bearer if configured | |
| GET | `/admin/flags/overrides/{scope}/{scopeId}` | Operational bearer if configured | |
| POST | `/v1/query` | AI JWT / ingress + rate limit | `runtime_mvp_query_chat_enabled` off → **404** (non-envelope body); production rollout off → **503**; processing timeout wrapper |

**Also:** CORS and request-queue backpressure run before routing (`handleCors`, `RequestQueue`).

**Canonical code:** `src/server/routes.ts`. **OpenAPI:** repo root `openapi.yaml`. **Narrative:** `docs/SPEC/02_API_Contracts.md`.
