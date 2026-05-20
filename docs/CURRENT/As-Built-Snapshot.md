# As-built snapshot

**Doc role:** current-state  
**Canonical for:** High-level “what the code does today” at a point in time.  
**Not authoritative for:** Normative future requirements and open tasks (see `to-do.md` §2 `WANT-xxx`).  
**Last verified:** **2026-03-24** — route inventory + parity audit pass (`docs/TARGET/Code-Docs-Discrepancy-Register.md`). **Not yet:** `npm run verify:sow` in this environment (run locally after changes).

## Target backlog alignment (WANT-xxx)

- **2026-03-24:** **Product decisions** that narrow acceptance criteria (instances, Postgres/Chroma, auth, budgets, tools, memory tiers, contracts, tests): summarized in [`to-do.md`](../../to-do.md) §2.
- **2026-05-20:** Open tasks and `WANT-xxx` / `GAP-xxx` status: [`to-do.md`](../../to-do.md).
- **High-impact “Partial” / open clusters:** **WANT-040** (on-disk verify + optional **`AUDIT_LOG_FSYNC`**; multi-replica / crash-edge cases still ops-owned), **WANT-049** (async **`Idempotency-Key`** in-process; no sync idempotency / cross-replica store), **WANT-053** (rollout vs process L2-99). **WANT-022** / **WANT-039** / **WANT-050** / **WANT-052** met; **WANT-038/041** met for in-process bounds (see § Summary observability bounds).
- **Artifact policy:** `dist/` is gitignored; build required — see root `README.md` § Build Artifacts (**WANT-058**).

## Summary

- **HTTP routes:** See [`Route-Inventory.md`](./Route-Inventory.md); ground truth is `src/server/routes.ts`.
- **Async jobs:** `POST /v1/query/async` and `/v1/jobs*` exist when a `JobQueueService` is configured; otherwise **503** `ASYNC_NOT_AVAILABLE`. Optional header **`Idempotency-Key`** dedupes async job creation per tenant + body fingerprint (**409** `IDEMPOTENCY_KEY_CONFLICT` on mismatch). **`POST /v1/query`** completes synchronously with **`mode: "sync"`**. **Ingress JSON is strict** (no body `idempotency_key`, no `mode: async`); see `docs/SPEC/02_API_Contracts.md` § Execution model.
- **Production rollout:** In **production**, `platform_production_rollout_enabled` **false** blocks `POST /token/exchange`, `POST /v1/query`, and `POST /v1/query/async` with **503**. With rollout **true**, bootstrap requires **`RELEASE_ID` or `BUILD_ID`** (see `docs/SPEC/20_Config_and_FeatureFlags.md`).
- **Health:** `/healthz` and `/readyz` are dependency-aware (not static always-200).
- **Rate limiting:** Query routes use `checkQueryRateLimitAsync` from `src/server/rate-limit.ts`.
- **Observability bounds:** In-process metrics use series/sample caps and expose `ai_server_metrics_dropped_total` in Prometheus text; emitter capture ring defaults to 1000; audit in-memory ring defaults to 10_000 entries (file sink holds full chain). **Production** bootstrap validates sink **`AUDIT_LOG_PATH`** / **`OBSERVABILITY_EVENT_SINK_PATH`** when set; optional **`AUDIT_LOG_FSYNC`** / **`OBSERVABILITY_EVENT_SINK_FSYNC`**.
- **Server lifecycle:** `src/server/index.ts` validates `PORT`, fail-closed TLS load when paths set, graceful shutdown with connection drain then **audit/event file sink flush** (`shutdownPersistentAuditFileSink`, event sink `close()`).
- **Feature flags:** Only keys in `FeatureFlagsSchema` (`schema.ts`) are loaded; behavior + static vs dynamic reads: **`docs/SPEC/20_Config_and_FeatureFlags.md`**.

## Parity / gaps

- Row-level doc vs code issues: [`docs/TARGET/Code-Docs-Discrepancy-Register.md`](../TARGET/Code-Docs-Discrepancy-Register.md).
- Narrative gaps (stub vs prod paths, memory, embeddings): `docs/OPERATIONS/Production-Readiness-Gaps-Report.md`.

## How to maintain

1. After route or contract changes, update `Route-Inventory.md` from `routes.ts` and bump **Last verified**.
2. Run `npm run verify:sow` at repo root; note pass date here.
3. Refresh `docs/TARGET/Code-Docs-Discrepancy-Register.md` when doing a formal parity pass.
