# L2-06 Sprint Handoff – Memory and Retrieval Implementation

**Plan:** L2-06 Memory and Retrieval Implementation  
**Status:** Implementation complete  
**Handoff to:** L2-07 Multimodal Input Path, L2-08 Rollout and Operational Readiness  

---

## 1) L2-07 / L2-08 start checklist

- [x] Memory abstraction (IMemoryStore) and scope enforcement implemented
- [x] Text chunking and in-memory ingestion pipeline (MVP; no PDF/embedding yet)
- [x] Scoped retrieval integrated into POST /v1/query when `memory_retrieval_enabled` and policy `memory_scope` ≠ none
- [x] Citation generation from retrieval hits and attachment to response envelope `output.citations`
- [x] Graceful fallback when store unavailable (degraded path; no request failure)
- [x] Error code `RETRIEVAL_UNAVAILABLE` in taxonomy; MEMORY_QUERY and ERROR events for retrieval
- [x] Feature flag: `memory_retrieval_enabled` (default false in production)
- [x] Unit tests: chunker, scope filter, citation formatter, in-memory store, retrieval service
- [x] Integration test: response envelope includes citations array
- [x] E2E integration test: full retrieval path (ingest → query → citations) with env set before bootstrap
- [ ] Readiness review meeting (owner sign-off)
- [ ] L2-07 / L2-08 implementation start

**Definition of ready for L2-07 / L2-08:** All items above except the review meeting are done. Downstream plans can rely on retrieval path and citation contract.

---

## 2) Memory and retrieval contracts

### Feature flag and policy

| Flag / policy           | Effect |
|------------------------|--------|
| `memory_retrieval_enabled` | When true, retrieval runs on query if policy `memory_scope` is user/project/org. |
| `enable_org_memory`    | When true, policy evaluator sets `memory_scope: "org"` so retrieval is allowed for org-scoped corpus. |

### Response envelope

- `output.citations`: array of `{ source, ref, span? }` (always present; empty when retrieval disabled or no hits).
- When retrieval runs and returns hits, citations are derived from retrieval chunks and attached to the response.

### Events (when `observability_required_events_v1`)

| Event        | When emitted |
|-------------|----------------|
| MEMORY_QUERY | After successful retrieval (with hit_count, latency_ms, scope). |
| ERROR        | When retrieval is degraded or throws (code RETRIEVAL_UNAVAILABLE, stage "retrieval"). |

### Error code

- **RETRIEVAL_UNAVAILABLE**: 503, retryable; used when store is down or returns degraded. Request proceeds without retrieval (degraded response).

---

## 3) Config and feature flags

- **memory_retrieval_enabled**  
  Default: `false`. Set `MEMORY_RETRIEVAL_ENABLED=true` to enable retrieval path. Requires policy to allow a non-none `memory_scope` (e.g. set `ENABLE_ORG_MEMORY=true` for org scope).

- **enable_org_memory**  
  When true, policy returns `memory_scope: "org"` so retrieval can run with org-scoped filters.

---

## 4) Module layout

- `src/memory/`: types, chunker, memory-abstraction (scope + IMemoryStore), in-memory-store, retrieval-service, citation-formatter, default-store.
- Query-handler: calls `runRetrieval(getDefaultStore(), …)` when plan.memory?.retrieval and scope ≠ none; passes `retrievalContext` to pipeline; on failure or degraded, continues without retrieval.
- Chat pipeline: accepts optional `retrievalContext`; prepends context to prompt and sets `output.citations` from retrieval.

---

## 5) CI and verification

| Check | Command / location |
|-------|---------------------|
| Unit tests (memory) | `npm test` (src/memory/*.test.ts) |
| Integration (envelope, citations) | `npm test` (query.integration.test.ts) |
| E2E retrieval (ingest → query → citations) | `npm test` (retrieval.integration.test.ts) |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |

### 5.1 Benchmark and outage test evidence

- **Scope boundary:** `src/memory/memory-abstraction.test.ts` (scopeAllowsAccess user/project/org/none).
- **Outage fallback:** `src/memory/in-memory-store.test.ts` (returns degraded and empty when unavailable; ingest error when unavailable).
- **Ingest-and-retrieve:** `src/memory/retrieval-service.test.ts` (runRetrieval with store hits and degraded).
- **Full path E2E:** `src/server/retrieval.integration.test.ts` (retrieval enabled + org memory, ingest doc, POST /v1/query, assert citations).
- **Citation formatter:** `src/memory/citation-formatter.test.ts` (citations from hits, dedupe, span truncation).

---

## 6) Known limits and deferred work

- **Store:** Default is in-memory (no vector DB); swap via `setDefaultStore()` or production adapter.
- **Ingestion:** Text-only chunking; no PDF parsing or real embeddings in MVP.
- **Ranking:** In-memory store uses simple text match; production should use vector similarity.
- **Grounding:** Citation extraction only; no strict grounding score threshold in synthesis yet.

---

## 7) References

- Spec: `Docs/SPEC/17_MemoryAbstraction_Spec.md`
- Plan: `Docs/PLANS/Implementation-plans/L2-06_Memory-and-Retrieval-Implementation.md`
- Runbook: `docs/Runbooks/Memory-Retrieval-Outage.md`
- Config: `src/config/schema.ts` (memory_retrieval_enabled, enable_org_memory)
