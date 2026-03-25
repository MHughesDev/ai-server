# How the Server Works (Newcomer Guide)

This is the practical onboarding guide for understanding how requests move through the AI server today.

For the broader architecture map, read `World-Model-Codebase.md` first.

## What This Server Is

This repository is a UI-less AI API server with one main runtime endpoint (`POST /v1/query`).

The server's job is to:

- validate and normalize incoming requests
- determine intent and governance constraints
- pick and execute the right pipeline
- enforce policy/budget/tool/memory controls
- return one response envelope with telemetry

## Read Order (Fast Onboarding)

1. `docs/REFERENCE/World-Model-Codebase.md` (mental map)
2. `src/server/routes.ts` (HTTP endpoints)
3. `src/server/query-handler.ts` (main orchestration)
4. `src/controlplane` + `src/router` (governance and routing)
5. `src/pipelines` + `src/engines` (execution behavior)
6. `src/gateways` + `src/memory` (external and stateful boundaries)

## Golden Boundary: Where Cognition Starts

- Ingress (`src/ingress`) is deterministic validation and identity handling.
- Brain Stem (`src/brainstem`) is where request meaning starts (canonicalization + intent hints).
- Everything after Brain Stem is governance and execution under explicit controls.

This boundary is the core safety/design invariant.

## End-to-End Query Flow (Strict Order)

For every `POST /v1/query`:

1. **Route + body read**
   - `routes.ts` reads JSON with size/time protections (`readJsonBody`).
2. **Auth + ingress validation**
   - AI JWT is verified (`verifyQueryCallerFromAuthHeader`).
   - envelope and attachment validation runs (`validateIngress`).
   - caller/body strict-match is enforced when token claims are present.
3. **Rate limit**
   - fixed-window query limiter runs (`checkQueryRateLimit`).
4. **Canonicalize**
   - `canonicalize(...)` produces `CanonicalRequest`.
5. **Intent extraction**
   - `extractIntent(...)` emits `IntentBundle` routing hints.
6. **Control plane**
   - policy evaluation -> budget checks -> route planning.
7. **Dispatch gate**
   - no execution unless allow + pipeline plan are present.
8. **Optional retrieval**
   - retrieval context can be assembled before pipeline for non-chat workflows.
   - reactive chat can run retrieval through Memory Engine inside the pipeline.
9. **Pipeline run**
   - selected pipeline executes engines via gateways.
   - run is wrapped in deadline enforcement.
10. **Response + telemetry**
    - envelope returned.
    - metrics/events/audit/tenant usage updated.

## Runtime Endpoints

Implemented in `src/server/routes.ts`:

- `POST /v1/query`
- `POST /token/exchange`
- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /v1/version`

Operational endpoints can require `OPERATIONAL_BEARER_TOKEN`.

## Pipeline Types You Will See

Router and query handler currently wire these main paths:

- `reactive_chat`
  - execution -> synthesis
  - optional memory retrieval via Memory Engine
- `coding_agent`
  - execution -> tool -> evaluation -> synthesis
  - optional autonomous `(execution <-> tool)*` loop behind `harness_autonomous_execution_enabled`
- `deep_research`
  - execution -> evaluation -> synthesis
  - returns structured research output
- `decision`
  - execution -> evaluation -> synthesis
  - returns structured decision memo output
- nested workflow pipelines (`tool_automation`, `extraction`, `verification`, `planning_only`, `batch_analysis`, `composite_example`)
  - executed by workflow runner over workflow definitions

## Core Contracts to Understand

External:

- `RequestEnvelope`
- `ResponseEnvelope`

Internal spine:

- `CanonicalRequest`
- `IntentBundle`
- `PolicyDecision`
- `PipelinePlan`

Execution and workflow:

- `TypedArtifact`
- `EngineInvocation`
- `EngineResult`
- `WorkflowDefinition`
- `AgentHarnessInput` (single post-orchestration input shape for pipelines)

All live under `src/contracts`.

## Governance Model in Practice

`src/controlplane` is where non-bypass controls are applied:

- policy allow/deny and allowed pipelines
- memory scope decisions
- request budget checks
- tenant budget checks
- route planning
- final dispatch assertion before execution

If governance denies, pipeline execution does not happen.

## Gateway Boundaries

Pipelines/engines never directly call providers or external systems; they go through gateways:

- model: `src/gateways/model-gateway.ts`
- tool: `src/gateways/tool-gateway.ts`
- memory: `src/memory/*` abstractions and adapters

This is where retries, timeout behavior, allowlists, sandbox checks, and provider selection are centralized.

## Observability and Audit

Key modules:

- `src/observability/context.ts` (trace context propagation)
- `src/observability/events.ts` (event taxonomy)
- `src/observability/emitter.ts` (redaction + sampling + sink)
- `src/observability/metrics.ts` (counters/histograms + Prometheus export)
- `src/security/audit-logger.ts` (tamper-evident audit chain + sink)

Important point: redaction level flows from policy into emitted events/audit paths in query handling.

## Configuration and Feature Flags

Single source of truth: `src/config/schema.ts`.

High-impact runtime flags include:

- `runtime_mvp_query_chat_enabled`
- `platform_production_rollout_enabled`
- `memory_retrieval_enabled`
- `multimodal_input_path_enabled`
- `harness_autonomous_execution_enabled`
- `observability_required_events_v1`
- `security_hard_controls_enabled`

Bootstrap checks in `src/bootstrap/index.ts` enforce production constraints at startup.

## What Is Mature vs Still Lightweight

Mature/implemented today:

- token exchange and JWT query auth path
- ingress caller matching and rate limiting
- provider-backed model gateway routing
- tool allowlist/sandbox policy checks with executable tools
- bounded retrieval timeout/context handling
- workflow definition validation (including dependency and cycle checks)
- dependency-aware readiness/health responses

Still intentionally lightweight in parts:

- policy evaluator is deterministic and simple, not a full external policy system
- sandbox controls are policy-level checks, not full process/container isolation
- many deployments still use in-memory defaults unless configured for persistent backends

Note: Evaluation and classification engines have model-based implementations available (not stubs). They use modelGateway for real evaluation/classification with heuristic fallbacks.

## If You Need To Change Something

- API schema or error code: `src/contracts`
- auth/token logic: `src/server/auth.ts`
- request validation/attachments: `src/ingress`
- route selection rules: `src/router/default-router.ts`
- governance logic: `src/controlplane`
- pipeline behavior: `src/pipelines`
- workflow graph behavior: `src/workflows`
- provider/tool execution: `src/gateways`
- retrieval/memory behavior: `src/memory`
- telemetry/audit behavior: `src/observability`, `src/security`

## Local Verify Loop

Typical local verification:

```bash
npm run lint
npm run typecheck
npm run build
npm test
```

Server startup paths:

```bash
npm run start:dev
npm run start
```

## One-Line Mental Model

The server is a governed execution runtime: deterministic ingress and policy choose the path, pipelines execute through engine/gateway contracts, and every request is observable and auditable.
