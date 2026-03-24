# Contract package changelog

## v1 (2026-02-18)

- Initial versioned schema package (L2-01).
- **RequestEnvelope**: request_id, caller, input, preferences, optional `mode` (**`sync` only**), optional deadline_ms, contract_version. **Strict** (unknown keys rejected); **`idempotency_key` not supported** in v1 runtime.
- **ResponseEnvelope**: request_id, status, output, telemetry, error, optional `mode` (**`sync` only**). **`job_id` / async acceptance** are not on this object — use HTTP **202** body from `POST /v1/query/async`.
- **CanonicalRequest**: internal unified representation (modalities, text, attachments, token_estimate, caller ids).
- **IntentBundle**: intents, confidence, modalities_detected, complexity, constraints_hints, primary_intent, risk_flags, routing_hints.
- **PolicyDecision**: allowed (boolean), deny_reason (optional; POLICY_BLOCKED, BUDGET_EXCEEDED, AUTH_INVALID, RATE_LIMITED), allow_tools, deny_tools, memory_scope, max_budgets, safety_profile, redaction_level, audit_level, allowed_pipelines, strategy (L2-03).
- **PipelinePlan**: pipeline_type, strategy_id, execution_mode, budgets, constraints, verification_level, fallback_plan, models, tools_enabled, **sandbox** (optional; timeout_ms, network_access, filesystem_access), memory, verification. **tools_enabled** is set by the router from PolicyDecision (allow_tools minus deny_tools).
- **Error taxonomy**: AUTH_INVALID, RATE_LIMITED, POLICY_BLOCKED, BUDGET_EXCEEDED, TOOL_TIMEOUT, MODEL_FAILURE, INTERNAL_ERROR, INVALID_PAYLOAD, CONTRACT_VERSION_UNSUPPORTED.
- Validators: Zod schemas with parse(); all throw on invalid input.

### Additive (2026-02-26) — M1 Engine layer

- **TypedArtifact** (Architecture §8.4): Universal envelope for engine I/O. Fields: artifact_id, artifact_kind (required), schema_ref, encoding, content (inline | ref), metadata (created_by, provenance, trust_score, sensitivity). Artifact kinds: workflow_plan, evaluation_report, tool_result, memory_response, code_patch, report, diff, document_chunk, research_report, decision_memo, normalized_record, custom.
- **Task** (Architecture §8.5): Unit of work within a workflow. Fields: task_id, task_type, category (analysis | transformation | generation | evaluation | action | classification | retrieval | synthesis), objective, input_artifacts (TypedArtifact[]), expected_output_schema, constraints_hints.
- **EngineInvocation** (Architecture §8.6): Standard input for every engine. Fields: invocation_id, engine_type (planning | execution | evaluation | tool | memory | classification | synthesis | condensing), task, context_artifacts, actor_context, budgets, safety, metadata (trace_id, contract_version).
- **EngineResult** (Architecture §8.6): Standard output for every engine. Fields: invocation_id, status (success | fail | blocked), result_artifacts, confidence, proposed_next_action (type, ref, arguments), metrics (duration_ms, tokens_used, cost_estimate_usd), error.
- New validators: validateTypedArtifact, validateTask, validateEngineInvocation, validateEngineResult. No breaking changes to existing contracts.
- **WorkflowDefinition** (Architecture §8.7): Versioned workflow graph template. Fields: workflow_id, version, entry_conditions (intents, required_capabilities, risk_allowed), steps (step_id, kind [engine_call | workflow_call | decision], ref, input_mapping, depends_on), stop_conditions (max_iterations, deadline_ms). Implemented in `workflow-definition.ts`; workflow registry in `src/workflows/registry.ts`; definitions in `src/workflows/definitions/*.json`. New validator: validateWorkflowDefinition.

### Additive (2026-02-26) — M2 Typed Artifacts end-to-end

- **ResponseEnvelope.output.attachments**: Optional array of `{ artifact_uri?, artifact_id?, artifact_kind? }`. Populated from Synthesis engine result_artifacts; see Architecture §8.4 and SOW M2.
- **CanonicalRequest → Typed Artifacts**: New helper `canonicalToTypedArtifacts(canonical)` in `src/brainstem/canonical-to-artifacts.ts`. Produces report artifact(s) for text (schema_ref `schema://user_input@v1`) and document_chunk artifact(s) for attachments (schema_ref `schema://attachment_handle@v1`). Exported from `brainstem/index.js`.
- **Engine result artifacts**: Execution and Synthesis engines set `schema_ref: "schema://report@v1"` on result Typed Artifacts. All engine I/O is Typed Artifact only; no raw string payloads across the engine boundary.
- No breaking changes to existing validators or external contracts.

### Additive (2026-02-26) — L2-05 Segment G (Security)

- **PipelinePlan.sandbox**: Optional sandbox options for tool execution (timeout_ms, network_access, filesystem_access). Set by router when tools_enabled is non-empty (e.g. timeout_ms from budget deadline_ms).
- **Router:** PipelinePlan.tools_enabled is derived from PolicyDecision.allow_tools minus PolicyDecision.deny_tools (no hardcoded tool list).
- **Telemetry and audit:** Events and audit payloads use PolicyDecision.redaction_level; audit payloads are redacted before write (no raw secrets in logs). TOOL_ACCESS audit events written when policy.audit_level !== "none" and security_hard_controls_enabled.
- No breaking changes to existing contracts.

### Additive (2026-02-27) — Segment N (closure)

- **Error code taxonomy (client doc):** `src/contracts/ERROR_CODES.md` documents all `ResponseEnvelope.error.code` values with HTTP suggestion, retryable flag, and when each is used. Codes and metadata remain in `errors.ts` (ERROR_CODES, ERROR_TAXONOMY, getErrorMeta). No contract schema change.
- **SOW verification:** `npm run verify:sow` (lint → typecheck → build → test) is the machine-checkable SOW gate; see `docs/PLANS/Scope-of-Work.md` §4.1 Segment N.

### Additive (2026-03-24) — Async idempotency

- **Error taxonomy:** **`IDEMPOTENCY_KEY_CONFLICT`** (**409**) when **`POST /v1/query/async`** reuses **`Idempotency-Key`** with a different body fingerprint (same tenant scope). Documented in `ERROR_CODES.md`; not a `ResponseEnvelope.error` path.
- **RequestEnvelope:** still **strict**; body **`idempotency_key`** remains unsupported — use HTTP **`Idempotency-Key`** on the async route only.

## Version policy

- Bump contract_version when breaking changes to external (RequestEnvelope, ResponseEnvelope) or internal canonical types.
- Optional new fields are additive; avoid removing fields; document deprecation before removal.
