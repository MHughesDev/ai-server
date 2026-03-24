# 17 Memory Abstraction Spec

## Source Alignment
- Normative architecture: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 10.5, 12, 18.7).
- Current-state gaps: `docs/OPERATIONS/Production-Readiness-Gaps-Report.md` (in-memory defaults, retrieval quality, timeout/context bounds, contract completeness).

## Purpose
Unified memory interface for retrieval and persistence with strict scope governance.

## Responsibilities
- Scope enforcement (`user`, `project`, `org`, `none` where relevant).
- Retrieval controls (top-k, filters, recency/trust constraints).
- Write-back governance and provenance capture.
- Retention controls (TTL and size constraints).

## Gateway Composition
- Vector store (`IMemoryStore`) for retrieval.
- Structured store (`IStructuredStore`) for keyed records.
- Object store (`IObjectStore`) for blob artifacts.
- Exposed through `IMemoryGateway` composition.

## Production Target State
- Persistent/shared stores (not process-local only) for production paths.
- Embedding/vector similarity retrieval path with lexical fallback only as explicit degrade mode.
- Retrieval timeout and bounded context-size controls.
- Ingestion chunk caps and retention applied from validated config.

## Current-State Notes
- In-memory implementations exist for vector/structured/object stores.
- Retrieval quality and timeout hardening remain tracked for production readiness.
- Any `TBD` memory abstraction surfaces must be finalized before production.
