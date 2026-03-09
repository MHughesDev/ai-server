# 19 Security and Isolation Spec

## Source Alignment
- Normative architecture: `docs/Architecture_document_Finalized.md` (Sections 12, 18.1, 18.2, 18.6, 18.7, 18.8).
- Current-state gaps: `docs/Production-Readiness-Gaps-Report.md` (identity binding, endpoint exposure, secrets/audit hardening, tool sandbox enforcement).

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

## Current-State Notes
- Some auth and endpoint controls remain incomplete for production.
- Tool execution and secrets integration still include stub/deferred paths in current implementation.
