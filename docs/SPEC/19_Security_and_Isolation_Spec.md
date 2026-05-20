# 19 Security and Isolation Spec

## Source Alignment
- Normative architecture: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 12, 18.1, 18.2, 18.6, 18.7, 18.8).
- Current-state gaps: `docs/OPERATIONS/Production-Readiness-Gaps-Report.md` (identity binding, endpoint exposure, secrets/audit hardening, tool sandbox enforcement).

## Threat Model
- Cross-tenant impersonation or leakage.
- Prompt/tool-assisted exfiltration.
- Unauthorized side effects via tools.
- Secret exposure in logs/events.
- Governance bypass in execution paths.

## Core Controls
- Identity-bound auth and trust-token exchange.
- Deterministic policy enforcement at dispatch and gateway boundaries.
- Tool sandbox controls with deny-by-default allowlists.
- Memory scope isolation and provenance.
- Redacted observability and tamper-evident audit trails.

## Identity and Auth Target State
- `POST /v1/query` requires server-issued AI JWT.
- `POST /token/exchange` validates registered IdP token + app credentials before minting trust token.
- Body `caller` fields must strict-match claims when present.
- Unknown issuer/signature/audience/scope mismatch fail closed.

## Audit and Compliance
- Security events are append-only and integrity-protected.
- Secrets are never written to logs/events/audit.
- Retention and incident-evidence requirements must be operationally enforced.

**As-built (2026-03-24):** `writeAuditEvent` / `writeAuditEventAsync` use an async lock for hash-chain assignment; the file sink uses a bounded async queue. The **in-memory** ring is capped (default 10_000 entries, oldest evicted) so long-lived processes do not grow RAM unbounded—**authoritative chain for compliance remains on disk** when a file sink is configured. `verifyAuditIntegrity()` validates the **retained in-memory window** (internal hash links), not necessarily from `"genesis"` after trimming. **`verifyAuditLogFileIntegrity(filePath)`** (async) scans one **on-disk** newline-delimited JSON file and verifies recomputed `event_hash` values and line-to-line `previous_event_hash` links; run per rotated file (`.1`, `.2`, …) or merge externally for end-to-end history.

## Scoped secrets (PR-005)

- `resolveSecret(ref, caller)` enforces scope, then resolves via `SECRETS_BACKEND` (`src/security/secrets-backend.ts`).
- **Dev:** `stub` returns `[REDACTED]` (no real material).
- **Production:** `env`, `aws_secrets_manager`, or `vault` — values injected via `SCOPED_SECRETS_JSON` and/or `SCOPED_SECRETS_ENV_PREFIX` (K8s secrets, External Secrets, AWS SM, Vault agent). Bootstrap fail-fast when `stub` or missing material.

## Current-State Notes
- Some auth and endpoint controls remain incomplete for production.
- Tool execution still includes deny-by-default stub paths; secrets backend is production-configurable (see above).
