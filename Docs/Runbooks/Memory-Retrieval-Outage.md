# Memory and Retrieval Outage

Runbook for retrieval/store degradation and citation issues (L2-06). Segment I: Memory Gateway also includes structured and object stores; retention (TTL, max chunks per scope) applies to the vector store when configured.

## Source Alignment

- Normative production requirements: `docs/Architecture_document_Finalized.md` (Sections 12, 18.7).
- Current implementation deltas/gaps: `docs/Production-Readiness-Gaps-Report.md`.

Production target assumes persistent/shared retrieval backends with bounded latency and context; this runbook includes current degrade behavior while those targets are still being hardened.

---

## Retrieval store unavailable

### Symptom

- Logs or events show `RETRIEVAL_UNAVAILABLE` or retrieval stage errors.
- Responses succeed but without citations (degraded path).
- Metrics: `retrieval_fallback_total` increases.

### Actions

1. **Confirm fallback behavior:** Requests should still return 200 with `status: "ok"`; only retrieval context and citations are missing. No need to fail the request.
2. **Check store health:** If using a dedicated vector store, verify connectivity and disk/index health. For in-memory default store (`getDefaultStore()` / `getMemoryGateway().vectorStore`), restart restores state but clears corpus. Structured and object stores (`getMemoryGateway().structuredStore`, `objectStore`) are in-memory; they are not used for retrieval path but may hold metadata/blobs.
3. **Temporary disable retrieval:** Set `MEMORY_RETRIEVAL_ENABLED=false` and restart to stop retrieval attempts until store is fixed.
4. **Emit and review:** Ensure `observability_required_events_v1` is true so ERROR events with stage `retrieval` are emitted for diagnosis.

### Rollback

- Set `MEMORY_RETRIEVAL_ENABLED=false`. Redeploy or restart. All requests continue as chat-only (no retrieval, no citations).

---

## Citation quality regression

### Symptom

- Citations in responses are wrong, missing, or not grounded in the answer.

### Actions

1. **Check retrieval hit rate:** Metrics `retrieval_hits_total` (status hit/miss). Low hit rate may explain empty citations.
2. **Scope alignment:** Verify policy `memory_scope` and corpus scope (user/project/org) match; scope mismatch returns no hits.
3. **Corpus freshness:** If using in-memory store, restarts clear the corpus; re-ingest after deploy if needed.
4. **Threshold (future):** L2-06 MVP does not enforce a grounding threshold; consider adding in a later iteration.

### Rollback

- Disable retrieval via `memory_retrieval_enabled=false` until quality is restored.

---

## Scope violation or leakage concern

### Symptom

- Suspicion that retrieval returned data from another tenant/org.

### Actions

1. **Audit:** Review retrieval access logs and scope filters. All retrieval goes through `scopeAllowsAccess` in `memory-abstraction.ts`.
2. **Tests:** Run scope boundary tests (`memory-abstraction.test.ts`, in-memory-store scope tests). Any failure is a P0.
3. **Kill switch:** Set `memory_retrieval_enabled=false` immediately and investigate before re-enabling.

---

## Metrics reference

| Metric | Meaning |
|--------|--------|
| retrieval_latency_ms | Latency of store.retrieve() when retrieval runs. |
| retrieval_fallback_total | Count of degraded or error fallbacks (labels: status=degraded \| error). |
| retrieval_hits_total | Count of retrieval runs with hit vs miss (labels: pipeline_type, status=hit \| miss). |

---

## References

- Plan: L2-06 Memory and Retrieval Implementation  
- Spec: 17 MemoryAbstraction Spec, 11 FailureManager Spec  
- Handoff: `docs/PLANS/Implementation-plans/L2-06_Handoff.md`
