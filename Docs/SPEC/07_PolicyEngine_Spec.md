# 07 Policy Engine Spec

## Source Alignment
- Normative architecture: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 8.3, 9.3, 16, 18.1, 18.3).
- Current-state gaps: `docs/OPERATIONS/Production-Readiness-Gaps-Report.md` (identity binding, allowlist alignment, runtime gate enforcement).

## Purpose
Deterministic policy evaluation that translates identity, tenant rules, and risk posture into enforceable execution constraints.

## Inputs
- Verified caller context (`org_id`, `app_id`, `user_id`, scopes, roles).
- Request metadata and intent/risk hints.
- Tenant/org policy configuration.

## Output
`PolicyDecision` including:
- Allowed workflows and engines.
- Tool allow/deny sets.
- Memory scope and write rules.
- Safety profile and redaction/audit levels.
- Max budgets (token/tool/time/cost).

## Enforcement Model
- Policy output must be enforced by dispatch and gateways.
- Deny-by-default applies to tools and sensitive memory operations.
- Policy decisions are auditable artifacts/events.

## Production Requirements
- Caller identity must be token-bound (not body-trusted).
- Unknown issuer, invalid claims, or scope mismatch fail closed.
- Policy allowlist and registered workflow catalog must remain aligned.

**As-built (2026-03-24):** `evaluatePolicy` in `src/controlplane/policy-evaluator.ts` sets `allowed_pipelines` from `listRegisteredWorkflowIds()` in `src/workflows/registry.ts`, so the default allowlist tracks registered workflow ids (router still must select a workflow matching intent).
