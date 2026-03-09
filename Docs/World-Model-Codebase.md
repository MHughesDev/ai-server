# AI Server World Model (Current Runtime)

This document is the practical mental model for how this repository behaves today.

It is intentionally implementation-grounded (from `src/`), while still aligned to the architecture docs.

## Source Alignment

- Target-state architecture: `Architecture_document_Finalized.md`
- Current implementation contracts/specs: `SPEC/`
- Operational reality in code: `src/`

When these disagree, treat this file and `src/` as the best "what runs now" guide, and treat architecture docs as the target design intent.

## 1) System Identity

The system is a UI-less API server with a single primary entrypoint (`POST /v1/query`) and strict governance around model, tool, and memory usage.

Core promise:

- Deterministic ingress and governance.
- Cognition starts only after canonicalization/intent extraction.
- All execution is routed through policy, budget, and dispatch checks.
- Models/tools/memory are accessed through gateways and engine contracts.

## 2) Runtime Endpoints (What the Server Exposes)

Defined in `src/server/routes.ts`:

- `POST /v1/query` - main request path.
- `POST /token/exchange` - external token to AI JWT exchange.
- `GET /healthz` - dependency health status.
- `GET /readyz` - dependency readiness status.
- `GET /metrics` - JSON or Prometheus metrics.
- `GET /v1/version` - contract/app/release metadata.

Operational endpoints can be bearer-protected by `OPERATIONAL_BEARER_TOKEN`.

## 3) Layered Model (Mapped to Code)

### Layer 4: Orchestration and Governance

- `src/ingress` - schema/body/attachment validation, caller enforcement.
- `src/brainstem` - canonicalization + intent hints.
- `src/controlplane` - policy, budget, tenant budget, dispatch gating.
- `src/router` - route and `PipelinePlan` selection.
- `src/server/query-handler.ts` - end-to-end orchestration glue.

### Layer 3: Workflows and Pipelines

- `src/pipelines` - runtime harnesses (`reactive_chat`, `coding_agent`, `deep_research`, `decision`, nested).
- `src/workflows` - graph definitions/registry + workflow runner + budget inheritance.

### Layer 2: Engines

- `src/engines` - execution, synthesis, tool, memory, planning, condensing, evaluation, classification.
- Engines consume `EngineInvocation` and return `EngineResult` + typed artifacts.

### Layer 1: Model/Tool/Memory Primitives

- `src/gateways/model-gateway.ts` - provider routing, retry, timeout, cost estimation.
- `src/gateways/tool-gateway.ts` - allowlist + sandbox checks + executable tools.
- `src/memory` - retrieval abstraction, vector/in-memory backends, structured/object stores.

## 4) Canonical Request Lifecycle (Main Path)

For `POST /v1/query`, the concrete order is:

1. `routes.ts` reads JSON body with timeout/size checks (`readJsonBody`).
2. Auth is validated (`verifyQueryCallerFromAuthHeader`), then ingress validates contract and caller match (`validateIngress`).
3. Rate limiting applies (`checkQueryRateLimit`).
4. `handleQuery` runs:
   - canonicalize (`brainstem/canonicalize.ts`)
   - intent extraction (`brainstem/intent.ts`)
   - control plane decision (`createControlPlane(...).decide(...)`)
   - dispatch guard (`assertCanDispatch`)
   - optional retrieval (query-handler path or memory engine path, pipeline-dependent)
   - pipeline execution with deadline (`withDeadline`)
   - telemetry, metrics, audit, tenant usage recording
5. `ResponseEnvelope` returns.

## 5) Data Contracts That Matter Most

Defined in `src/contracts`:

- External API:
  - `RequestEnvelope`
  - `ResponseEnvelope`
- Internal spine:
  - `CanonicalRequest`
  - `IntentBundle`
  - `PolicyDecision`
  - `PipelinePlan`
- Engine/workflow:
  - `TypedArtifact`
  - `Task`
  - `EngineInvocation`
  - `EngineResult`
  - `WorkflowDefinition`
- Harness handoff:
  - `AgentHarnessInput` (single post-orchestration shape given to pipelines)

## 6) Routing and Pipeline Selection Model

Router logic (`src/router/default-router.ts`) selects pipeline based on:

- policy allow/deny
- allowed pipeline set from policy
- intent hints (`tool_likelihood`, `routing_hints`)
- multimodal capability checks

Current pipeline behaviors:

- `reactive_chat` - execution + synthesis (and memory engine retrieval when enabled).
- `coding_agent` - execution -> tool -> evaluation -> synthesis; optional autonomous `(execution <-> tool)*` loop behind flag.
- `deep_research` - execution -> evaluation -> synthesis, returns structured research artifact payload.
- `decision` - execution -> evaluation -> synthesis, returns structured decision memo payload.
- nested workflow pipelines - graph execution via workflow runner (engine_call/workflow_call).

## 7) Policy, Budgets, and Enforcement Boundaries

Policy (`src/controlplane/policy-evaluator.ts`):

- Deny lists (org/app), risk checks, allowed pipeline set, memory scope, max budgets.

Budgeting:

- Request token budget hard-checked in `resource-manager.ts`.
- Tenant cost caps checked before run (`checkTenantBudget`) and updated after run (`recordTenantUsage`).
- Deadline enforced around pipeline run in query handler and also inside workflow runner.
- Cost cap enforcement happens post-run in query handler and intra-workflow in runner.

Dispatch safety:

- `assertCanDispatch` ensures no pipeline can run without governance allow + plan.

## 8) Memory Model

Memory stack (`src/memory`):

- Retrieval abstraction: `IMemoryStore`.
- Backends:
  - in-memory text-scored store (`InMemoryStore`)
  - vector path (`VectorRetrievalAdapter`) using hash or OpenAI embeddings and in-memory/file vector backend.
- Additional stores: structured key-value + object blob stores with scope-aware access.
- Retrieval bounded by timeout and context-size limits (`retrieval-service.ts`).

Scope is enforced with `scopeAllowsAccess(...)` and caller-derived scope keys.

## 9) Tool Execution Model

Tool stack:

- `ToolEngine` uses `IToolGateway` only.
- Query handler builds `AllowlistToolGateway` with:
  - policy-derived allowlist
  - sandbox options from `PipelinePlan`
  - delegate `ExecutableToolGateway`

Built-in executable tools:

- `stub_tool`
- `web_search` (network)
- `file_write_preview` (filesystem, rooted by `TOOL_FILESYSTEM_ROOT` / cwd sandbox path checks)

## 10) Observability and Audit

Observability (`src/observability`):

- trace context propagation via async local storage
- structured event taxonomy
- redaction utility
- metrics with bounded series/sample caps
- optional file event sink with queue + rotation

Security audit (`src/security/audit-logger.ts`):

- append-only hash-chain entries
- optional non-blocking file sink with queue + rotation
- sink status exposed for readiness checks

## 11) Configuration and Feature Gates

Central schema: `src/config/schema.ts`

Important flags:

- `runtime_mvp_query_chat_enabled`
- `platform_production_rollout_enabled`
- `harness_autonomous_execution_enabled`
- `memory_retrieval_enabled`
- `multimodal_input_path_enabled`
- `observability_required_events_v1`
- `security_hard_controls_enabled`

Bootstrap (`src/bootstrap/index.ts`) validates critical production safety constraints (for example: operational token requirement and non-synthetic model providers when rollout is enabled).

## 12) Current Reality: Mature vs Stubbed Areas

Implemented and active:

- `/token/exchange` + AI JWT verification on query path
- caller strict-match enforcement at ingress
- query rate limiting
- provider-backed model gateway
- executable tool path with allowlist/sandbox checks
- retrieval timeout + bounded context assembly
- workflow definition validation (duplicate ids, unknown deps, cycle detection, decision-step rejection)
- dependency-aware health/ready responses
- graceful shutdown and optional HTTPS startup

Still lightweight or partially stubbed:

- evaluation and classification engines are mostly stub behavior
- policy evaluator is deterministic but simple (not full external policy system)
- tool sandbox checks are policy-level checks, not full OS/container isolation
- default deployments still commonly rely on in-memory stores unless configured otherwise

## 13) Quick "Where Do I Change X?" Map

- API shape/errors/contracts: `src/contracts`
- Auth/token exchange: `src/server/auth.ts`
- Request validation/attachments: `src/ingress`
- Routing/pipeline selection: `src/router/default-router.ts`
- Governance decisions: `src/controlplane`
- Pipeline logic: `src/pipelines`
- Workflow graph behavior: `src/workflows`
- Model/tool provider behavior: `src/gateways`
- Retrieval/memory behavior: `src/memory`
- Events/metrics/audit: `src/observability`, `src/security/audit-logger.ts`

## 14) One-Sentence Mental Model

The server is a governed orchestration runtime: deterministic ingress and policy choose a pipeline, pipelines execute engine contracts through gateways, and every decision/execution path is observable and auditable.
