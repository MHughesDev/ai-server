# AI Server

Production-grade, modular, multimodal AI server with strict cognition boundary and pluggable pipelines.

**Scope:** This repository delivers a **UI-less API server** only. No web UI, admin UI, or dashboards are built or maintained here; dashboard and alert panels are deferred to ops and external systems (e.g. Grafana, Prometheus).

## Docs

- [AGENTS.md](AGENTS.md) – **for AI coding agents:** pointer to deploy playbook and verification gates
- [Overview](docs/Overview.md) – master spec and canonical types
- [Architecture](docs/Architecture_document_Finalized.md) – components and flow (finalized)
- [Production Readiness Gaps](docs/Production-Readiness-Gaps-Report.md) – canonical current implementation status and remaining work
- [Production Readiness — Go/No-Go & agent playbook](docs/Production-Readiness-Go-No-Go-Summary.md) – scorecard, deploy checklist, **agent briefing** to get to green CI and deployment
- [Production Deployment Guide](docs/Production-Deployment-Guide.md) – canonical deployment and launch runbook
- [Scope of Work](docs/PLANS/Scope-of-Work.md) – implementation phases, segments, file paths, verification (§4.1, §9)
- [Master Delivery Plan](docs/PLANS/00_Master-Delivery-Plan.md)
- [L2-01 Contracts and Project Scaffold](docs/PLANS/Implementation-plans/L2-01_Contracts-and-Project-Scaffold.md)
- [L2-01 Handoff](docs/PLANS/Implementation-plans/L2-01_Handoff.md) (Sprint 1 checklist, compatibility matrix, runbook)

## Documentation Governance

To prevent documentation drift, use this update policy:

- **Target-state requirements:** update `docs/Architecture_document_Finalized.md` (Section 18 is normative for production behavior).
- **Current-state implementation and open gaps:** update `docs/Production-Readiness-Gaps-Report.md`.
- **Deployment/launch procedures and checklists:** update `docs/Production-Deployment-Guide.md`.
- **Index/navigation only:** update `docs/Overview.md`.

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

**Decision:** The `dist/` directory is currently tracked in Git for development convenience, but this is a **temporary arrangement**.

### Current State
- `dist/` contains compiled JavaScript and TypeScript declaration files
- Tracked in Git to allow quick testing and development without requiring a build step
- Includes `.js`, `.d.ts`, `.js.map`, and `.d.ts.map` files

### Future State (Production)
- `dist/` should **NOT** be tracked in production repositories
- Build artifacts should be generated in CI/CD pipelines only
- Docker images and deployments should build from source

### Rationale
| Approach | Pros | Cons |
|----------|------|------|
| **Track `dist/`** (current) | Quick dev setup, easy testing, no build step for newcomers | Pollutes diffs, risk of stale artifacts, merge conflicts |
| **Ignore `dist/`** (target) | Clean diffs, single source of truth, CI-controlled builds | Requires build step, slightly longer dev setup |

### Migration Plan
1. **Phase 1** (current): Keep tracking for development velocity
2. **Phase 2**: Add `.gitattributes` to mark `dist/` as generated
3. **Phase 3**: Add CI check to verify `dist/` is up-to-date with `src/`
4. **Phase 4**: Remove from tracking, add to `.gitignore`, update CI to build always

### Developer Workflow
```bash
# When making changes:
1. Edit files in `src/`
2. Run `npm run build` to update `dist/`
3. Commit both `src/` and `dist/` changes together

# CI verification (future):
npm ci
npm run build
git diff --exit-code dist/  # Fails if dist/ not updated
```
