# L2-03 Sprint Handoff – Policy Budgeting and Routing

**Plan:** L2-03 Policy Budgeting and Routing Implementation  
**Status:** Implementation complete  
**Handoff to:** L2-04 Observability and Evaluation, L2-05 Security Isolation and Compliance  

---

## 1) L2-04 / L2-05 start checklist

- [x] Policy evaluator implemented with deterministic allow/deny and reason codes
- [x] Resource manager: effective budgets and budget-exceeded enforcement (hard-stop)
- [x] Router returns explicit `RouteResult` (allow + PipelinePlan | deny + denyReason)
- [x] Control plane orchestrates policy → budget → router; no dispatch without allow + plan
- [x] Dispatch precondition: `assertCanDispatch` / `canDispatch`; bypass-attempt tests in CI
- [x] Governance events emitted: POLICY_DECISION, BUDGET_ASSIGN, ROUTE_DECISION, ERROR
- [x] Feature flag: `control_plane_enforcement_enabled` (config); default true in dev/staging
- [x] Integration tests: happy path, budget-exceeded (blocked + BUDGET_EXCEEDED)
- [ ] Readiness review meeting (owner sign-off)
- [ ] L2-04 / L2-05 implementation start

**Definition of ready for L2-04 / L2-05:** All items above except the review meeting are done. Downstream plans can consume governance event contracts and decision traces.

---

## 2) Governance event contracts (L2-03 Phase 4)

Events are emitted when `observability_required_events_v1` is true. Payloads are redacted per policy.

| Event             | When emitted                    | Key payload fields (sample) |
|-------------------|---------------------------------|-----------------------------|
| POLICY_DECISION   | After control plane policy eval | `allowed`, `deny_reason`, `memory_scope`, `allowed_pipelines` |
| BUDGET_ASSIGN     | After policy (and budget check) | `token_budget`, `tool_budget`, `deadline_ms`, `cost_budget_usd` |
| ROUTE_DECISION    | After router                    | `deny` (bool), `deny_reason` or `pipeline_type`, `strategy_id` |
| PIPELINE_START    | Before pipeline run             | `pipeline_type`, `strategy_id` |
| PIPELINE_END      | After pipeline run              | `pipeline_type`, `strategy_id`, `duration_ms`, `status` |
| FINAL_SYNTH       | After response synthesis        | `pipeline_type`, `status` |
| ERROR             | On deny or failure              | `code`, `message`, `stage`, `detail_redacted` |

**Sample POLICY_DECISION (allowed):**  
`{ "event_type": "POLICY_DECISION", "request_id": "<uuid>", "payload": { "allowed": true, "memory_scope": "none", "allowed_pipelines": ["reactive_chat", "chat"] } }`

**Sample ROUTE_DECISION (denied):**  
`{ "event_type": "ROUTE_DECISION", "payload": { "deny": true, "deny_reason": "BUDGET_EXCEEDED" } }`

---

## 3) Deny reason taxonomy (response error codes)

| Deny reason       | HTTP suggestion | Retryable | When used |
|-------------------|-----------------|-----------|-----------|
| POLICY_BLOCKED    | 403             | No        | Policy evaluator deny (org/app/intent/risk) |
| BUDGET_EXCEEDED   | 429             | No        | Token/cost budget exceeded |
| AUTH_INVALID      | 401             | No        | Reserved for auth failures |
| RATE_LIMITED      | 429             | Yes       | Reserved for rate-limit |

Response envelope for denied requests: `status: "blocked"`, `error: { code, message, detail }`.

---

## 4) Known risks and deferred work

- **Dynamic policy refresh:** Not implemented; policy rules are static (e.g. deny lists empty). Target: L2-08 hardening.
- **Shared budget counters:** Per-request budgets only; no cross-request tenant caps in this implementation. Target: future resource manager iteration.
- **Strategy weighting:** Router uses deterministic tie-breaker (chat); no advanced strategy weighting.

---

## 5) CI and verification

| Check                 | Command / location |
|-----------------------|--------------------|
| Unit tests (policy, budget, router, dispatch gate) | `npm test` (controlplane/*.test.ts) |
| Integration (allow, budget-exceeded)              | `npm test` (query.integration.test.ts) |
| Typecheck             | `npm run typecheck` |
| Lint                  | `npm run lint` |

---

## 6) Config and feature flags

- **control_plane_enforcement_enabled**  
  Default: `true` in dev/staging, `false` in production until canary.  
  When true, every `POST /v1/query` goes through policy → budget → router; denied requests return `status: "blocked"` with taxonomy error code.

- **observability_required_events_v1**  
  When true, governance events (POLICY_DECISION, BUDGET_ASSIGN, ROUTE_DECISION, etc.) are emitted for observability consumption (L2-04).
