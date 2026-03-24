# 20 Config and Feature Flags

## Source Alignment
- **Canonical schema:** `src/config/schema.ts` (`FeatureFlagsSchema`, `loadConfigFromEnv`, `CONFIG_FILE` overlay).
- **Runtime evaluation:** `src/config/feature-flags.ts` (`FeatureFlagService`, `resolveFeatureFlagEnabled`, admin overrides); `isFeatureFlagEnabled` in `src/server/routes.ts` delegates to the same resolution.
- Normative architecture: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 12, 18.9, 18.11).
- Gaps narrative: `docs/OPERATIONS/Production-Readiness-Gaps-Report.md`.

## Configuration Sources
- Environment variables (primary); see `loadConfigFromEnv()` in `schema.ts` for names.
- Optional JSON overlay: `CONFIG_FILE` (env still wins on merge); invalid/missing file when set **throws** at startup.

## Configuration Requirements
- Runtime-impacting settings must be represented in validated `ConfigSchema`.
- Invalid required config must fail startup in production (see `bootstrap/index.ts` `assertProductionReadiness` when rollout flag + production).

---

## Feature flags in schema (complete list)

Only the following keys exist on `config.flags` (Zod `FeatureFlagsSchema`). Names **not** in this list are **not** loaded from config (historical docs may still mention them).

| Flag | Default | Primary env var |
|------|---------|-------------------|
| `enable_org_memory` | `false` | `ENABLE_ORG_MEMORY=true` |
| `enable_cost_caps` | `true` | `ENABLE_COST_CAPS=false` to disable |
| `enable_multimodal_pipeline` | `false` | `ENABLE_MULTIMODAL_PIPELINE=true` |
| `multimodal_input_path_enabled` | `false` | `MULTIMODAL_INPUT_PATH_ENABLED=true` |
| `runtime_mvp_query_chat_enabled` | `true` (non-prod unless forced false) | `RUNTIME_MVP_QUERY_CHAT_ENABLED` |
| `observability_required_events_v1` | `true` | `OBSERVABILITY_REQUIRED_EVENTS_V1=false` to disable |
| `security_hard_controls_enabled` | `true` | `SECURITY_HARD_CONTROLS_ENABLED=false` to disable |
| `harness_autonomous_execution_enabled` | `false` | `HARNESS_AUTONOMOUS_EXECUTION_ENABLED=true` |
| `memory_retrieval_enabled` | `false` | `MEMORY_RETRIEVAL_ENABLED=true` |
| `platform_production_rollout_enabled` | `false` | `PLATFORM_PRODUCTION_ROLLOUT_ENABLED=true` |

**Rollout alias:** `PLATFORM_MASTER_ROLLOUT_ENABLED` is accepted as a legacy alias for the same boolean; prefer `PLATFORM_PRODUCTION_ROLLOUT_ENABLED`.

**Async jobs:** There is **no** `enable_async_jobs` flag. Job endpoints are available when `QUEUE_WORKERS_COUNT` (and related queue env) cause `bootstrap` to register a `JobQueueService` (`src/bootstrap/index.ts`); otherwise routes return **503** `ASYNC_NOT_AVAILABLE`.

---

## Flag enforcement matrix (as-built 2026-03-24)

**Resolution models**
- **Dynamic:** `resolveFeatureFlagEnabled(name, config, context?)` in `feature-flags.ts` — used by `isFeatureFlagEnabled` in `routes.ts`, `isFlagEnabled` in `query-handler.ts`, policy `memory_scope` (`enable_org_memory`), and coding-agent harness flags — uses `FeatureFlagService.evaluateFlag` when the service is initialized (admin overrides + org/app/user context), else `config.flags[name]`.
- **Static:** direct read of `config.flags` / `getConfig().flags` — **does not** apply admin overrides from `/admin/flags`.

| Flag | Enforced (behavior) | Resolution | Code references (indicative) |
|------|----------------------|------------|------------------------------|
| `platform_production_rollout_enabled` | **503** on `POST /token/exchange`, `POST /v1/query`, `POST /v1/query/async` in **production** when false; preflight check; bootstrap production gates (JWT, auth header, IdP/app defaults, CORS, TLS, synthetic model providers) when true + production | Dynamic on routes; static in bootstrap/preflight | `routes.ts`, `bootstrap/index.ts`, `preflight.ts` |
| `runtime_mvp_query_chat_enabled` | **404** MVP-disabled body when false on `POST /v1/query` | Dynamic | `routes.ts` |
| `multimodal_input_path_enabled` | Attachment validation path + ingress options for query/async when combined with `enable_multimodal_pipeline` | Dynamic | `routes.ts`, `query-handler.ts` |
| `enable_multimodal_pipeline` | Must be **true** with `multimodal_input_path_enabled` for multimodal pipeline set in control plane | Dynamic | `query-handler.ts` |
| `observability_required_events_v1` | Emits governance/telemetry events in query path when true; emitter creation in `index.ts` gated on flag; production bootstrap requires trace sample rate &lt; 1 when flag + rollout | Dynamic (query); static (bootstrap `index.ts` emitter) | `query-handler.ts`, `server/index.ts`, `bootstrap/index.ts` |
| `security_hard_controls_enabled` | Security audit writes / policy event path in query handler; coding-agent tool audit when policy audit level allows | Dynamic | `query-handler.ts`, `coding-agent-pipeline.ts` |
| `enable_cost_caps` | Strips or applies cost budget from plan when disabled/enabled; preflight **warn** if false | Dynamic | `query-handler.ts`, `preflight.ts` |
| `memory_retrieval_enabled` | Gating retrieval / memory features in query path | Dynamic | `query-handler.ts` |
| `enable_org_memory` | Policy `memory_scope` **org** vs **none** | Dynamic (caller org/app/user) | `policy-evaluator.ts` |
| `harness_autonomous_execution_enabled` | Enables autonomous harness loop in coding-agent pipeline when tools allowlisted | Dynamic (caller org/app/user) | `coding-agent-pipeline.ts` |

**Admin API:** `GET/POST /admin/flags*` (operational bearer) can evaluate or override flags via `FeatureFlagService` — effective only where **dynamic** resolution is used.

---

## Governance rule for flags
- Every schema flag must affect runtime or documented bootstrap/preflight behavior (matrix above).
- Prefer **one** resolution style per flag over time (static vs dynamic) to avoid surprise when using admin overrides.

## Transport and Lifecycle Configuration
- `PORT`, `HTTPS_PORT`, `TLS_KEY_PATH`, `TLS_CERT_PATH`.
- Production target is fail-closed behavior when TLS is configured but invalid (`server/index.ts`).

### Release traceability (`RELEASE_ID`, `BUILD_ID`)

- Loaded into `config.release` when either env var is set (`schema.ts`); exposed on **`GET /v1/version`** when present.
- **Production without rollout:** if both are missing, `validateReleaseConfig` returns invalid and bootstrap logs a **warning** (server still starts).
- **Production with `platform_production_rollout_enabled`:** bootstrap **`assertProductionReleaseMetadataWhenRollout`** — startup **throws** unless at least one of `RELEASE_ID` or `BUILD_ID` is non-empty (`src/rollout/policy.ts`, `src/bootstrap/index.ts`).

## Retention and Limits
- Memory retention: `MEMORY_RETENTION_TTL_SECONDS`, `MEMORY_RETENTION_MAX_CHUNKS_PER_SCOPE` → `config.memoryRetention` → in-memory store (`default-store.ts`).
- Multimodal attachment bounds: `MAX_ATTACHMENT_COUNT`, `MAX_ATTACHMENT_BYTES`.
- Rate limit ingress: `INGRESS_RATE_LIMIT_MAX_REQUESTS`, `INGRESS_RATE_LIMIT_WINDOW_MS`.

## Current-State Notes
- **Historical flag names** in L2-99 / harness docs (`governance_harness_readiness_gate_active`, etc.) are **not** in `FeatureFlagsSchema` until re-added; use `harness_autonomous_execution_enabled` for autonomous execution and process gates for readiness.
- **Admin overrides:** policy and coding-agent paths use the same `resolveFeatureFlagEnabled` hierarchy as the query route (caller-scoped context).
