# Internal query execution audit (WANT-013)

**Purpose:** Record every path that executes governed query logic (`handleQuery` and its governance gate) outside the primary **`POST /v1/query`** HTTP handler, so production “no bypass” reviews have a single checklist.

**Canonical gate:** `runQueryGovernanceGate` + `assertCanDispatch` run inside **`handleQuery`** (`src/server/query-handler.ts`) before pipeline dispatch.

## Entry points

| Entry | Call path | Governance / identity notes |
|--------|-----------|------------------------------|
| **HTTP** `POST /v1/query` | `routes.ts` → `handleQuery(ingressResult)` | Full ingress (`validateIngress`), optional AI JWT, rate limits, then `handleQuery`. |
| **HTTP** `POST /v1/query/async` (worker) | `bootstrap/index.ts` registers `createJobQueueService(..., handleQuery)` | **Preflight:** `preflightAsyncQueryGovernance` in `routes.ts` before enqueue matches dispatch gate for blocked cases. **Worker:** same `handleQuery` as sync — no slimmer code path. |
| **Eval harness** | `src/eval/runner.ts` → `validateIngress(...)` → `handleQuery(ingressResult)` | **Not an HTTP trust boundary:** ingress uses relaxed options (no production AI JWT, smaller max body). Uses same **`handleQuery`** so policy/budget/route/dispatch still run. Intended for CI / offline scoring, not Internet-facing. |
| **Tests** | e.g. `observability-acceptance.test.ts`, governance tests | Call `handleQuery` or `validateIngress` + handler with fixture config; not production traffic. |

## Callers that do *not* invoke `handleQuery`

- **`preflightAsyncQueryGovernance`** — uses the same gate logic as `handleQuery` for async submit only; returns a blocked envelope or `null`; does not run the full pipeline.
- **Load / perf harnesses** — may call `store.retrieve`, stubs, or engines directly; out of scope for this audit unless they claim to represent customer query traffic.

## Review cadence

Revisit this file when adding a new **production** entry point that could run models, tools, or workflows, or when splitting `handleQuery` / governance helpers.
