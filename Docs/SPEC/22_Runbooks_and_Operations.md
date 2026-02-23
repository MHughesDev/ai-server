# 22 Runbooks and Operations

## Core Runbooks
Provider outage, tool failure spikes, memory store outage, latency spikes, cost spikes. **Memory and Retrieval (L2-06):** `docs/Runbooks/Memory-Retrieval-Outage.md` — retrieval store unavailable, citation quality, scope violation; kill switch: `memory_retrieval_enabled=false`. Harness Readiness Gate (L2-99): `docs/Runbooks/Harness-Readiness-Gate.md` — evidence validation, scorecard disputes, go/no-go sign-off, exception remediation. **Release and Rollback (L2-08):** `docs/Runbooks/Release-and-Rollback.md` — release execution, canary analysis, rollback operations, emergency mitigation; owner: Operations Lead; escalation: Operations → SRE → Security → Leadership incident commander. **Multimodal Input Path (L2-07):** `docs/Runbooks/Multimodal-Input-Path.md` — attachment failure triage, capability mismatch, kill switch, supported matrix.

## Dashboards
This repository is a UI-less API server; it does not build or host dashboards. Top errors, strategy health, tool failure rates, queue depth, latency percentiles, and cost by org/app are consumed via metrics/events (e.g. `GET /metrics`) or via external dashboards (e.g. Grafana/Prometheus) when provisioned by ops.

## Incident Workflow
Classify -> mitigate -> validate recovery -> postmortem with owners and follow-ups.
