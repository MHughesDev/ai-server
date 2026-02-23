# AI Server

Production-grade, modular, multimodal AI server with strict cognition boundary and pluggable pipelines.

**Scope:** This repository delivers a **UI-less API server** only. No web UI, admin UI, or dashboards are built or maintained here; dashboard and alert panels are deferred to ops and external systems (e.g. Grafana, Prometheus).

## Docs

- [Overview](Docs/Overview.md) – master spec and canonical types
- [Architecture](Docs/Architecture.md) – components and flow
- [Master Delivery Plan](Docs/PLANS/00_Master-Delivery-Plan.md)
- [L2-01 Contracts and Project Scaffold](Docs/PLANS/Implementation-plans/L2-01_Contracts-and-Project-Scaffold.md)
- [L2-01 Handoff](Docs/PLANS/Implementation-plans/L2-01_Handoff.md) (Sprint 1 checklist, compatibility matrix, runbook)

## Prerequisites

- Node.js >= 20
- npm

## Commands (parity with CI)

```bash
npm ci
npm run build
npm run typecheck
npm run lint
npm run test
npm run test:ci          # with coverage
node dist/bootstrap/index.js   # startup smoke
```

## Structure

- `src/contracts` – versioned API and internal schemas (RequestEnvelope, ResponseEnvelope, CanonicalRequest, IntentBundle, PolicyDecision, PipelinePlan) and error taxonomy
- `src/config` – config schema and feature flags (env-based)
- `src/ingress` – request validation interface (stub)
- `src/brainstem` – canonicalization + intent interface (stub)
- `src/controlplane` – policy/strategy interface (stub)
- `src/router` – pipeline plan interface (stub)
- `src/gateways` – model/tool/memory interfaces (stubs)
- `src/pipelines` – pipeline harness interface (stub)
- `src/observability` – tracing/metrics interface (stub)
- `src/bootstrap` – startup and config validation

## Contract version

Current supported contract version: **v1**. See `src/contracts/CHANGELOG.md` for schema history and version policy.
