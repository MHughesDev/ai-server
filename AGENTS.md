# Agent instructions (coding / deployment)

**Primary briefing for production readiness and deploy work:** read and follow:

- [`docs/Production-Readiness-Go-No-Go-Summary.md`](docs/Production-Readiness-Go-No-Go-Summary.md) — includes **AGENT PLAYBOOK** (phases, files to search, verification commands, constraints).

**Definition of done (technical):** `npm run verify:sow` passes at repo root; align `openapi.yaml` and `docs/SPEC/02_API_Contracts.md` with `src/server/routes.ts`; fix Docker/K8s/deploy issues per the playbook.

**Do not:** commit secrets; disable CI checks to pass builds.

**Canonical HTTP routes:** `src/server/routes.ts`
