# Query and Policy Failures Runbook (L2-08 / SOW Segment L.2b)

Triage procedures for query failure, tool denied, and budget exceeded. For rollback and release procedures, see **Release-and-Rollback.md**. Owner: Operations on-call; escalation: Operations → SRE → Security → Leadership incident commander.

## Source Alignment

- Normative production behavior: `docs/Architecture_document_Finalized.md` (Section 18).
- Current implementation deltas: `docs/Production-Readiness-Gaps-Report.md`.

This runbook follows current behavior while preserving production-target guidance where runtime gaps still exist.

---

## Query failure (general)

### Symptoms
- Client receives error response from `POST /v1/query` (e.g. 4xx/5xx, or ResponseEnvelope with `status: "error"`).
- Error codes may include: `INVALID_PAYLOAD`, `CONTRACT_VERSION_UNSUPPORTED`, `AUTH_INVALID`, `POLICY_DENIED`, `MULTIMODAL_UNSUPPORTED`, `ATTACHMENT_REJECTED`, `BUDGET_EXCEEDED`, `INTERNAL_ERROR`.

### Triage steps
1. **Check response envelope:** Note `error.code`, `error.message`, `request_id`, and any `detail` (e.g. `attachment_reason` for ATTACHMENT_REJECTED).
2. **Ingress/validation failures:** `INVALID_PAYLOAD` — verify client request conforms to RequestEnvelope (contract version, body size, schema). `ATTACHMENT_REJECTED` — see Multimodal-Input-Path runbook; check attachment type/size/count/mime.
3. **Policy/routing failures:** `POLICY_DENIED`, `MULTIMODAL_UNSUPPORTED` — see **Policy deny** and **Tool denied** below; confirm policy evaluator and router config (allowed_pipelines, multimodal flags).
4. **Budget:** `BUDGET_EXCEEDED` — see **Budget exceeded** below.
5. **Server errors:** `INTERNAL_ERROR` — check logs and metrics; trace_id/request_id for correlation; escalate to SRE if persistent.
6. **Observability:** Use `GET /metrics` and trace_id to correlate with ENGINE_*, WORKFLOW_*, ROUTE_DECISION events.

### References
- `docs/SPEC/02_API_Contracts.md` (request/response envelope).
- `docs/Runbooks/Multimodal-Input-Path.md` for attachment-related failures.
- `docs/SPEC/22_Runbooks_and_Operations.md` (incident workflow).

---

## Tool denied

### Symptoms
- Query path returns error when a tool would be invoked; error code `POLICY_DENIED` or tool-related deny reason.
- Tool Gateway denies execution (not in allowlist, sandbox violation, timeout).
- Metrics: `security_deny_total` or tool denial events (TOOL_ACCESS, TOOL_*).

### Triage steps
1. **Confirm deny reason:** Check response `error.detail` and policy decision (allowed_workflows, allow_tools, deny_tools).
2. **Allowlist:** Policy supplies `allow_tools`; Tool Gateway enforces allowlist. If client expects a tool that is denied, verify:
   - Tool id is in policy `allow_tools` for the caller/tenant.
   - `deny_tools` does not list it.
   - Feature flags (e.g. `enable_web_tool`) if tool is gated.
3. **Sandbox / timeout:** Tool Gateway sandbox (network_access, filesystem_access, timeout_ms) may reject or time out; check gateway logs and metrics.
4. **Audit:** TOOL_ACCESS and audit_level events; use for security review if misuse suspected.
5. **Kill switch:** No single “disable all tools” beyond policy (empty allow_tools or pipeline that does not use tools). Restrict via policy and allowed_pipelines.

### References
- Architecture §12 (Tool Gateway), §16 (guardrails).
- L2-05 Security implementation; `src/gateways/tool-gateway.ts`, policy evaluator.

---

## Budget exceeded

### Symptoms
- Response error code `BUDGET_EXCEEDED` (or policy deny reason indicating budget).
- Request terminated due to token_budget, deadline_ms, or cost cap.

### Triage steps
1. **Confirm budget source:** PolicyDecision supplies `max_budgets` (token_budget, deadline_ms); resource-manager or workflow runtime enforces.
2. **Client impact:** Inform caller that request exceeded allowed budget; they may retry with smaller scope or request budget increase (policy/tenant config).
3. **Tuning:** If false positives (legitimate requests failing): review default budgets in policy/stub (`controlplane/`, L2-03); adjust per-tenant or per-pipeline if supported.
4. **Cost caps:** If `enable_cost_caps` is true, cost may also trigger budget-style termination; check cost metrics and caps config.
5. **Observability:** ENGINE_*, WORKFLOW_* events carry cost/latency; use for tuning and capacity planning.

### References
- `src/controlplane/resource-manager.ts`, policy evaluator (max_budgets).
- L2-03 Policy, budgets, routing; Architecture §8.3 (PolicyDecision), §9.3 (orchestrator).

---

## Rollback (traffic or release)

For rollback of a bad release or traffic kill-switch, use **Release-and-Rollback.md**: kill-switch `PLATFORM_PRODUCTION_ROLLOUT_ENABLED=false`, revert to last known good release, verify health/ready/version, then incident protocol and postmortem.

---

## References
- `docs/PLANS/Scope-of-Work.md` §7, §4.1 Segment L (L.2b).
- `docs/Runbooks/Release-and-Rollback.md`
- `docs/SPEC/22_Runbooks_and_Operations.md`
