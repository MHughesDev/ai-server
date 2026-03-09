# 02 API Contracts

## Source Alignment
- Normative architecture: `docs/Architecture_document_Finalized.md` (Sections 5, 6, 8, 18).
- Current-state gaps: `docs/Production-Readiness-Gaps-Report.md` (identity binding, async drift, endpoint security, runtime enforcement).

## Transport
- HTTP on `PORT` and optional HTTPS on `HTTPS_PORT` when TLS material is configured.
- Production target requires fail-closed TLS behavior when TLS is configured but invalid.

## Endpoints
- `POST /v1/query` (primary entrypoint).
- `POST /token/exchange` (production identity trust boundary).
- `GET /healthz`, `GET /readyz`, `GET /metrics`, `GET /v1/version`.
- `GET /v1/jobs/{job_id}` is not exposed in the current sync-only contract profile.

## RequestEnvelope (external)
- `request_id`, `contract_version`, optional `mode` (`sync` only), optional `deadline_ms`.
- `caller { org_id, app_id, user_id, session_id, scopes[] }`.
- `input { text, attachments[], structured }`.
- `preferences { response_format, verbosity, stream }`.
- Async/idempotency request fields (for example `idempotency_key`) are not part of the v1 contract and are rejected.

### Production Identity Rule
- Effective caller context must be derived from verified AI JWT claims.
- Body `caller` fields are advisory and must strict-match claims or be rejected.
- Current state still includes body-driven caller behavior in parts of runtime; treat this as non-production.

## ResponseEnvelope (external)
- `request_id`, `status` (`ok | blocked | error`), optional `mode` (`sync` only).
- `output { text, structured, attachments[], citations[] }`.
- `telemetry { pipeline, models_used, tool_calls, tokens_in, tokens_out, cost_usd_est, latency_ms }`.
- `error { code, message, detail }`.
- Async lifecycle response fields (for example `status=accepted`, `job_id`) are not part of the v1 contract.

## Error Taxonomy
Primary code set is defined in `src/contracts/errors.ts` and `src/contracts/ERROR_CODES.md`. Core categories include:
- Auth and payload: `AUTH_INVALID`, `INVALID_PAYLOAD`, `CONTRACT_VERSION_UNSUPPORTED`.
- Governance: `POLICY_BLOCKED`, `BUDGET_EXCEEDED`, `RATE_LIMITED`.
- Runtime: `MODEL_FAILURE`, `TOOL_TIMEOUT`, `RETRIEVAL_UNAVAILABLE`, `INTERNAL_ERROR`.
- Multimodal: `ATTACHMENT_REJECTED`, `MULTIMODAL_UNSUPPORTED`.

## Internal Contracts
Contracts are versioned and validated in `src/contracts/`:
- `CanonicalRequest`, `IntentBundle`, `PolicyDecision`, `PipelinePlan`.
- `TypedArtifact`, `Task`, `EngineInvocation`, `EngineResult`, `WorkflowDefinition`.
- Workflow-specific artifacts (for example research and decision outputs).

## Contract Consistency Requirement
- Exposed API fields must match implemented runtime semantics.
- Current v1 profile is sync-only; async lifecycle fields are excluded until queue/status/result/idempotency runtime support exists.
