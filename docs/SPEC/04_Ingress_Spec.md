# 04 Ingress Spec

## Source Alignment
- Normative architecture: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 2, 9.1, 18.1, 18.2, 18.9).
- Current-state gaps: `docs/OPERATIONS/Production-Readiness-Gaps-Report.md` (identity binding, endpoint protection, rate limiting, lifecycle hardening).

## Purpose
Deterministic trust boundary that validates and normalizes requests before cognition begins.

## Responsibilities
- Authentication and trust-token validation.
- Payload bounds and contract validation (version, envelope, attachments).
- Request/trace identity normalization.
- Deterministic rejection with explicit error taxonomy.
- Optional ingress-level protections (rate limits, quotas, abuse controls).

## Non-Responsibilities
- No model calls.
- No intent extraction.
- No tool execution.
- No memory retrieval orchestration.

## Input and Output
- Input: raw HTTP request.
- Output: validated request envelope + caller context, or structured rejection.

## Production Target
- `POST /v1/query` requires server-issued AI JWT.
- Caller context is claim-derived; body caller is advisory-only and must match claims.
- Operational endpoints are not implicitly public in production.
- Rate limiting and quota controls return deterministic `429` behavior.

## Current-State Notes
- Current implementation still contains auth and identity-binding gaps in some paths.
- Read timeout, graceful shutdown, and TLS fail-closed behaviors are tracked as production hardening items.
