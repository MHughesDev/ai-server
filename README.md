# AI Server

Production-grade, modular, multimodal AI server with strict cognition boundary and pluggable pipelines.

**Scope:** This repository delivers a **UI-less API server** only. No web UI, admin UI, or dashboards are built or maintained here; dashboard and alert panels are deferred to ops and external systems (e.g. Grafana, Prometheus).

## Docs

- [AGENTS.md](AGENTS.md) – **for AI coding agents:** pointer to deploy playbook and verification gates
- [Start here (bootstrap)](docs/START-HERE.md) – deterministic read order for new sessions
- [Docs index](docs/README.md) – folder map and navigation
- [Overview](docs/ARCHITECTURE/Overview.md) – documentation index and SPEC/runbook lists
- [Architecture](docs/ARCHITECTURE/Architecture_document_Finalized.md) – components and flow (finalized)
- [Production Readiness Gaps](docs/OPERATIONS/Production-Readiness-Gaps-Report.md) – canonical current implementation status and remaining work
- [Production Readiness — Go/No-Go & agent playbook](docs/OPERATIONS/Production-Readiness-Go-No-Go-Summary.md) – scorecard, deploy checklist, **agent briefing** to get to green CI and deployment
- [Production Deployment Guide](docs/OPERATIONS/Production-Deployment-Guide.md) – canonical deployment and launch runbook
- [Scope of Work](docs/PLANS/Scope-of-Work.md) – implementation phases, segments, file paths, verification (§4.1, §9)
- [Master Delivery Plan](docs/PLANS/00_Master-Delivery-Plan.md)
- [L2-01 Contracts and Project Scaffold](docs/PLANS/implementation/L2-01_Contracts-and-Project-Scaffold.md) (includes §14 sprint handoff: checklist, compatibility matrix, runbook pointers)

## Documentation Governance

To prevent documentation drift, use this update policy:

- **Target-state requirements:** update `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Section 18 is normative for production behavior).
- **Current-state implementation and open gaps:** update `docs/OPERATIONS/Production-Readiness-Gaps-Report.md`.
- **Deployment/launch procedures and checklists:** update `docs/OPERATIONS/Production-Deployment-Guide.md`.
- **Index/navigation only:** update `docs/ARCHITECTURE/Overview.md` and `docs/START-HERE.md` when structure changes.

Do not create parallel status or checklist docs unless there is a strict audience separation and a clear owner.

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
npm run verify:sow       # lint + typecheck + build + test (SOW gate)
node dist/bootstrap/index.js   # startup smoke
```

## Structure

- `src/contracts` – versioned API and internal schemas (RequestEnvelope, ResponseEnvelope, CanonicalRequest, IntentBundle, PolicyDecision, PipelinePlan); error taxonomy in `errors.ts` and [ERROR_CODES.md](src/contracts/ERROR_CODES.md) (client-facing `ResponseEnvelope.error.code` list)
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

## Build Artifacts (`dist/`)

**Current policy (aligned with repo):** `dist/` is **not** tracked — it is listed in `.gitignore`. TypeScript emits compiled `.js` / `.d.ts` here when you run the build.

### Expectations
- **Local / CI:** Run `npm run build` before `npm start` (or use `npm run verify:sow`, which includes `build`).
- **Docker / deploy:** Image or pipeline should build from `src/` so `dist/` is fresh on the artifact you ship.
- **Contents:** Compiled `.js`, `.d.ts`, and source maps from `tsc`.

### Developer workflow
```bash
npm run build    # regenerates dist/ from src/
npm test         # uses ts-jest from src in dev; production start uses dist/ via package.json "start"
```

**Traceability:** Target backlog **WANT-058** and `docs/CURRENT/As-Built-Snapshot.md` reference this policy.
