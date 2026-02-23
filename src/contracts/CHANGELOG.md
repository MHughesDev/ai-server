# Contract package changelog

## v1 (2026-02-18)

- Initial versioned schema package (L2-01).
- **RequestEnvelope**: request_id, caller, input, preferences, optional mode/deadline_ms/idempotency_key, contract_version.
- **ResponseEnvelope**: request_id, status, output, telemetry, error, optional job_id, mode.
- **CanonicalRequest**: internal unified representation (modalities, text, attachments, token_estimate, caller ids).
- **IntentBundle**: intents, confidence, modalities_detected, complexity, constraints_hints, primary_intent, risk_flags, routing_hints.
- **PolicyDecision**: allowed (boolean), deny_reason (optional; POLICY_BLOCKED, BUDGET_EXCEEDED, AUTH_INVALID, RATE_LIMITED), allow_tools, deny_tools, memory_scope, max_budgets, safety_profile, redaction_level, audit_level, allowed_pipelines, strategy (L2-03).
- **PipelinePlan**: pipeline_type, strategy_id, execution_mode, budgets, constraints, verification_level, fallback_plan, models, tools_enabled, memory, verification.
- **Error taxonomy**: AUTH_INVALID, RATE_LIMITED, POLICY_BLOCKED, BUDGET_EXCEEDED, TOOL_TIMEOUT, MODEL_FAILURE, INTERNAL_ERROR, INVALID_PAYLOAD, CONTRACT_VERSION_UNSUPPORTED.
- Validators: Zod schemas with parse(); all throw on invalid input.

## Version policy

- Bump contract_version when breaking changes to external (RequestEnvelope, ResponseEnvelope) or internal canonical types.
- Optional new fields are additive; avoid removing fields; document deprecation before removal.
